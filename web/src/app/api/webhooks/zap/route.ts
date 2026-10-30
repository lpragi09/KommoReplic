import { after } from "next/server";
import { adminClient } from "@/lib/supabase/clients";
import { answerWithAgent, attributeInbound, deliverQueued, fireRobotsForMessage } from "@/data";
import { QR_PREFIX, zapSignatureOk } from "@/lib/zap";

/* Avisos da ponte do WhatsApp por QR code (zap-bridge): mensagem recebida e mudança de conexão.
   Só vale com a assinatura do ZAP_BRIDGE_TOKEN. A mensagem entra pelo mesmo caminho do webhook da Meta
   (receive_inbound é idempotente pelo id), e robôs, envio e IA rodam depois da resposta. */

type ZapEvent =
  | { type: "message"; session: string; from: string; name: string; text: string; id: string }
  | { type: "status"; session: string; status: "open" | "logged_out"; me?: { phone: string; name: string } };

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

  if (ev.type === "status") {
    if (ev.status === "logged_out") await db.from("channels").update({ status: "disconnected", status_detail: "Desconectado pelo celular. Leia o QR code de novo." }).eq("id", ch.id);
    else if (ch.status !== "connected") {
      const name = `WhatsApp ${ev.me?.name ?? ""} ${ev.me?.phone ? `+${ev.me.phone}` : ""}`.replace(/\s+/g, " ").trim();
      await db.from("channels").update({ status: "connected", status_detail: null, name }).eq("id", ch.id);
    }
    return new Response("ok", { status: 200 });
  }

  if (ch.status !== "connected" || !/^\d{6,20}$/.test(ev.from) || !ev.text) return new Response("ok (ignorado)", { status: 200 });
  const { data: msgId, error } = await db.rpc("receive_inbound", { p_channel: ch.id, p_thread: ev.from, p_sender_name: ev.name ?? "", p_body: ev.text.slice(0, 4000), p_external_id: `qr-${ev.id}` });
  if (error) {
    console.error("[zap] receive_inbound", error.message);
    return new Response("erro", { status: 500 }); // a ponte não reenvia, mas fica no log
  }
  if (!msgId) return new Response("ok (repetida)", { status: 200 });
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
