import { after } from "next/server";
import { adminClient } from "@/lib/supabase/clients";
import { answerWithAgent, attributeInbound, deliverQueued, fireRobotsForMessage } from "@/data";
import { QR_PREFIX, zapSignatureOk } from "@/lib/zap";

/* Avisos da ponte do WhatsApp por QR code (zap-bridge): mensagem recebida e mudança de conexão.
   Só vale com a assinatura do ZAP_BRIDGE_TOKEN. A mensagem entra pelo mesmo caminho do webhook da Meta
   (receive_inbound é idempotente pelo id), e robôs, envio e IA rodam depois da resposta. */

type ZapEvent =
  | { type: "message"; session: string; from: string; name: string; text: string; id: string; photo?: string | null }
  | { type: "photos"; session: string; photos: { from: string; url: string }[] }
  | { type: "names"; session: string; names: { from: string; name: string }[] }
  | { type: "status"; session: string; status: "open" | "logged_out"; me?: { phone: string; name: string } }
  | { type: "history"; session: string; messages: { from: string; out: boolean; name: string; text: string; id: string; at: string }[] };

/** número (ou "lid:<código>" das contas que escondem o número) */
const THREAD = /^(lid:)?\d{6,25}$/;

export async function POST(req: Request) {
  const body = await req.text();
  if (!zapSignatureOk(body, req.headers.get("x-zap-signature"))) return new Response("assinatura inválida", { status: 401 });
  let ev: ZapEvent;
  try {
    ev = JSON.parse(body) as ZapEvent;
  } catch {
    return new Response("corpo inválido", { status: 400 });
  }
  const db = adminClient();
  const { data: ch } = await db.from("channels").select("id, workspace_id, status").eq("kind", "whatsapp").eq("external_id", `${QR_PREFIX}${ev.session}`).maybeSingle();
  if (!ch) return new Response("ok (sessão sem canal)", { status: 200 });

  // troca só nome que o próprio netzer inventou (nunca o da agenda já aplicado nem o que a equipe editou)
  const renamePlaceholder = async (thread: string, raw: string | null | undefined) => {
    const name = String(raw ?? "").trim().slice(0, 80);
    if (!name || !THREAD.test(thread)) return false;
    const { data: ident } = await db.from("contact_identities").select("contact_id, contacts(name)").eq("workspace_id", ch.workspace_id).eq("kind", "whatsapp").eq("value", thread).maybeSingle();
    const current = (ident?.contacts as { name?: string } | null)?.name ?? "";
    if (!ident || current === name || !/^(Contato WhatsApp \d{1,4}|\+?\d{6,25}|Visitante \S{1,6})$/.test(current)) return false;
    await db.from("contacts").update({ name }).eq("id", ident.contact_id);
    return true;
  };


  if (ev.type === "status") {
    if (ev.status === "logged_out") await db.from("channels").update({ status: "disconnected", status_detail: "Desconectado pelo celular. Leia o QR code de novo." }).eq("id", ch.id);
    else if (ch.status !== "connected") {
      const name = `WhatsApp ${ev.me?.name ?? ""} ${ev.me?.phone ? `+${ev.me.phone}` : ""}`.replace(/\s+/g, " ").trim();
      await db.from("channels").update({ status: "connected", status_detail: null, name }).eq("id", ch.id);
    }
    return new Response("ok", { status: 200 });
  }

  // histórico que o WhatsApp manda ao conectar: entra como conversa já lida, sem lead e sem robô
  if (ev.type === "history") {
    // o histórico chega segundos depois de parear, às vezes antes do aviso de "conectado": se chegou, está pareado
    if (ch.status !== "connected") await db.from("channels").update({ status: "connected", status_detail: null }).eq("id", ch.id);
    let saved = 0;
    for (const m of (ev.messages ?? []).slice(0, 500)) {
      if (!THREAD.test(m.from) || !m.text || Number.isNaN(Date.parse(m.at))) continue;
      const { data, error } = await db.rpc("import_history", { p_channel: ch.id, p_thread: m.from, p_sender_name: m.name ?? "", p_body: m.text, p_external_id: `qr-${m.id}`, p_out: !!m.out, p_at: m.at });
      if (error) {
        console.error("[zap] import_history", error.message);
        return Response.json({ ok: false, saved, error: error.message }, { status: 500 });
      }
      if (data) saved++;
    }
    // nome que a pessoa colocou no próprio WhatsApp (vem nas mensagens dela): vale para quem não está na agenda
    const pushNames = new Map<string, string>();
    for (const m of ev.messages ?? []) if (!m.out && m.name) pushNames.set(m.from, m.name);
    for (const [from, name] of pushNames) await renamePlaceholder(from, name);
    return Response.json({ ok: true, saved });
  }

  // foto de perfil do WhatsApp vai para o contato (só link https do próprio WhatsApp)
  const savePhoto = async (thread: string, url: string | null | undefined) => {
    if (!url || !/^https:\/\/[a-z0-9.-]+\.whatsapp\.net\//i.test(url) || !THREAD.test(thread)) return;
    const { data: ident } = await db.from("contact_identities").select("contact_id").eq("workspace_id", ch.workspace_id).eq("kind", "whatsapp").eq("value", thread).maybeSingle();
    if (ident) await db.from("contacts").update({ avatar_url: url }).eq("id", ident.contact_id);
  };
  // nome salvo na agenda do celular
  if (ev.type === "names") {
    let renamed = 0;
    for (const n of (ev.names ?? []).slice(0, 300)) if (await renamePlaceholder(n.from, n.name)) renamed++;
    return Response.json({ ok: true, renamed });
  }
  if (ev.type === "photos") {
    for (const p of (ev.photos ?? []).slice(0, 100)) await savePhoto(p.from, p.url);
    return new Response("ok", { status: 200 });
  }

  if (ch.status !== "connected" || !THREAD.test(ev.from) || !ev.text) return new Response("ok (ignorado)", { status: 200 });
  const { data: msgId, error } = await db.rpc("receive_inbound", { p_channel: ch.id, p_thread: ev.from, p_sender_name: ev.name ?? "", p_body: ev.text.slice(0, 4000), p_external_id: `qr-${ev.id}` });
  if (error) {
    console.error("[zap] receive_inbound", error.message);
    return new Response("erro", { status: 500 }); // a ponte não reenvia, mas fica no log
  }
  if (!msgId) return new Response("ok (repetida)", { status: 200 });
  await savePhoto(ev.from, ev.photo);
  await renamePlaceholder(ev.from, ev.name);
  const { data: row } = await db.from("messages").select("conversation_id, workspace_id").eq("id", msgId).maybeSingle();
  if (row) {
    await attributeInbound(row.conversation_id as string, ev.text, null);
    after(async () => {
      try {
        await fireRobotsForMessage(msgId as string);
        await deliverQueued(row.workspace_id as string).catch(() => 0);
        await answerWithAgent(row.conversation_id as string);
        await deliverQueued(row.workspace_id as string).catch(() => 0);
      } catch (e) {
        console.error("[zap] depois da mensagem", e);
      }
    });
  }
  return new Response("ok", { status: 200 });
}
