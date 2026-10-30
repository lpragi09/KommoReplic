import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/clients";
import { after } from "next/server";
import { answerWithAgent, attachInbound, attributeInbound, deliverQueued, fireRobotsForMessage, updateDeliveryStatus } from "@/data";
import { downloadMedia } from "@/lib/meta";
import { MAX_ATTACHMENT } from "@/lib/attachments";
import { cleanAttribution } from "@/lib/utm";
import { open } from "@/lib/secret-box";

/* Webhook da Meta (WhatsApp Cloud API).
   GET: handshake de verificação (hub.verify_token).
   POST: confere X-Hub-Signature-256, grava cada mensagem com o id da Meta (receive_inbound é idempotente)
   e responde 200 rápido. A assinatura vale com a META_APP_SECRET (app da netzer) ou com a chave secreta do app
   que a própria empresa cadastrou no canal; aviso de um canal só é aceito se a assinatura bater com uma delas. */

export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === process.env.META_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
}

function validSignature(body: string, header: string | null, secret: string | undefined) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

type WaChange = {
  value?: {
    metadata?: { phone_number_id?: string };
    contacts?: { wa_id: string; profile?: { name?: string } }[];
    messages?: {
      id: string;
      from: string;
      type: string;
      text?: { body: string };
      button?: { text?: string };
      interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
      image?: WaMedia;
      audio?: WaMedia;
      video?: WaMedia;
      document?: WaMedia;
      sticker?: WaMedia;
      /** anúncio "clique para WhatsApp": a Meta manda de qual anúncio veio */
      referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string; ctwa_clid?: string };
    }[];
    /** avisos do que enviamos: enviada, entregue, lida, falhou */
    statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
  };
};
type WaMedia = { id: string; mime_type?: string; caption?: string; filename?: string };

/** onde baixar a mídia recebida: WhatsApp pelo id (com o token do canal), Instagram/Messenger pelo link do aviso */
type InboundMedia = { mediaId: string; name: string } | { url: string; name: string };

const PLACEHOLDER: Record<string, string> = { image: "[foto]", audio: "[áudio]", video: "[vídeo]", document: "[arquivo]", file: "[arquivo]", sticker: "[figurinha]" };

/** Instagram e Messenger: eventos de mensagem por página/conta */
type Messaging = {
  sender?: { id: string };
  recipient?: { id: string };
  message?: { mid: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string }; attachments?: { type: string; payload?: { url?: string } }[] };
  referral?: { ref?: string; source?: string; ad_id?: string; ads_context_data?: { ad_title?: string } };
};

type Job = () => Promise<void>;

/** grava a mensagem recebida e liga a origem (anúncio ou link rastreável); robôs e IA vão para a fila de depois */
async function inbound(jobs: Job[], channelId: string, thread: string, name: string, text: string, externalId: string, ad: ReturnType<typeof cleanAttribution>, media?: InboundMedia) {
  const db = adminClient();
  const { data: msgId, error } = await db.rpc("receive_inbound", { p_channel: channelId, p_thread: thread, p_sender_name: name, p_body: text, p_external_id: externalId });
  if (error) return console.error("[meta] receive_inbound", error.message);
  if (!msgId) return; // repetida
  const { data: row } = await db.from("messages").select("conversation_id, workspace_id").eq("id", msgId).maybeSingle();
  if (!row) return;
  await attributeInbound(row.conversation_id as string, text, ad);
  jobs.push(async () => {
    // mídia: baixa da Meta e guarda no storage antes dos robôs (falha aqui não impede o resto)
    if (media)
      await saveMedia(channelId, msgId as string, media).catch((e) => console.error("[meta] mídia", e instanceof Error ? e.message : e));
    await fireRobotsForMessage(msgId as string); // robôs: boas-vindas, palavra-chave, respostas de botão...
    await deliverQueued(row.workspace_id as string).catch(() => 0);
    await answerWithAgent(row.conversation_id as string);
    await deliverQueued(row.workspace_id as string).catch(() => 0);
  });
}

async function saveMedia(channelId: string, messageId: string, media: InboundMedia) {
  let file: { bytes: Uint8Array; mime: string };
  if ("mediaId" in media) {
    const { data: sec } = await adminClient().from("channel_secrets").select("token_enc").eq("channel_id", channelId).maybeSingle();
    if (!sec?.token_enc) return;
    file = await downloadMedia({ mediaId: media.mediaId, token: open(sec.token_enc as string) }, MAX_ATTACHMENT * 4);
  } else file = await downloadMedia({ url: media.url }, MAX_ATTACHMENT * 4);
  await attachInbound(messageId, { name: media.name, mime: file.mime, bytes: file.bytes });
}

export async function POST(req: Request) {
  const body = await req.text();
  const header = req.headers.get("x-hub-signature-256");
  if (!header?.startsWith("sha256=")) return new Response("assinatura inválida", { status: 401 });
  // app da netzer, ou o app do Instagram dentro dele (login do Instagram assina com a chave própria)
  const appOk = validSignature(body, header, process.env.META_APP_SECRET) || validSignature(body, header, process.env.INSTAGRAM_APP_SECRET);

  type Payload = { object?: string; entry?: { id?: string; changes?: WaChange[]; messaging?: Messaging[] }[] };
  let payload: Payload;
  try {
    payload = JSON.parse(body) as Payload;
  } catch {
    return new Response("corpo inválido", { status: 400 });
  }
  const db = adminClient();
  const jobs: Job[] = [];
  // canal conectado com esse id, e só se a assinatura veio do app do sistema ou do app que a empresa cadastrou nele
  const trust = new Map<string, boolean>();
  let anyTrusted = false;
  async function trustedChannel(kind: string, externalId: string) {
    const { data: ch } = await db.from("channels").select("id").eq("kind", kind).eq("external_id", externalId).eq("status", "connected").maybeSingle();
    if (!ch) return null; // conta que não é de nenhum cliente nosso
    if (!trust.has(ch.id)) {
      let ok = appOk;
      if (!ok) {
        const { data: sec } = await db.from("channel_secrets").select("app_secret_enc").eq("channel_id", ch.id).maybeSingle();
        try {
          ok = !!sec?.app_secret_enc && validSignature(body, header, open(sec.app_secret_enc as string));
        } catch {
          ok = false;
        }
      }
      trust.set(ch.id, ok);
    }
    if (trust.get(ch.id)) anyTrusted = true;
    return trust.get(ch.id) ? (ch as { id: string }) : null;
  }

  for (const entry of payload.entry ?? []) {
    // ---------- WhatsApp Cloud API ----------
    for (const change of entry.changes ?? []) {
      const v = change.value;
      const phoneId = v?.metadata?.phone_number_id;
      if (!phoneId || (!v?.messages?.length && !v?.statuses?.length)) continue;
      const ch = await trustedChannel("whatsapp", phoneId);
      if (!ch) continue;
      for (const st of v.statuses ?? []) await updateDeliveryStatus(st.id, st.status, st.errors?.[0]?.message ?? st.errors?.[0]?.title);
      for (const m of v.messages ?? []) {
        const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
        const wm = m.image ?? m.audio ?? m.video ?? m.document ?? m.sticker;
        const text =
          m.type === "text"
            ? (m.text?.body ?? "")
            : m.type === "button"
              ? (m.button?.text ?? "")
              : m.type === "interactive"
                ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "")
                : (wm?.caption ?? PLACEHOLDER[m.type] ?? `[${m.type}]`);
        const media: InboundMedia | undefined = wm?.id ? { mediaId: wm.id, name: wm.filename ?? `${m.type}-${m.id.slice(-8)}` } : undefined;
        const ad = m.referral
          ? cleanAttribution({ utm_source: "meta", utm_medium: "ctwa", ad_id: m.referral.source_id, ad_headline: m.referral.headline, ctwa_clid: m.referral.ctwa_clid, landing: m.referral.source_url }, "meta_ad")
          : null;
        await inbound(jobs, ch.id, m.from, name, text || `[${m.type}]`, m.id, ad, media);
      }
    }
    // ---------- Instagram Direct e Messenger ----------
    if (entry.messaging?.length && entry.id) {
      const kind = payload.object === "instagram" ? "instagram" : "messenger";
      const ch = await trustedChannel(kind, entry.id);
      if (!ch) continue;
      for (const ev of entry.messaging) {
        const m = ev.message;
        if (!m || m.is_echo || !ev.sender?.id) continue; // eco = nossa própria mensagem
        const att = m.attachments?.[0];
        const text = m.text ?? (att ? (PLACEHOLDER[att.type] ?? `[${att.type}]`) : "");
        const media: InboundMedia | undefined = att?.payload?.url ? { url: att.payload.url, name: `${att.type}-${m.mid.slice(-8)}` } : undefined;
        if (!text) continue;
        const ad = ev.referral?.ad_id
          ? cleanAttribution({ utm_source: kind, utm_medium: "ad", ad_id: ev.referral.ad_id, ad_headline: ev.referral.ads_context_data?.ad_title }, "meta_ad")
          : null;
        await inbound(jobs, ch.id, ev.sender.id, "", text, m.mid, ad, media);
      }
    }
  }
  // as mensagens já estão gravadas: robôs, envio e IA rodam depois da resposta 200 (a Meta reenvia se o webhook demora),
  // uma de cada vez e na ordem em que chegaram
  if (jobs.length)
    after(async () => {
      for (const job of jobs) await job().catch((e) => console.error("[meta] depois da mensagem", e));
    });
  // nenhuma assinatura conferiu (nem a do sistema, nem a de algum canal citado): recusa
  if (!appOk && !anyTrusted) return new Response("assinatura inválida", { status: 401 });
  return new Response("ok", { status: 200 });
}
