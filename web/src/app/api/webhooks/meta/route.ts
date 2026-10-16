import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/clients";
import { after } from "next/server";
import { answerWithAgent, attributeInbound, deliverQueued, fireRobotsForMessage, updateDeliveryStatus } from "@/data";
import { cleanAttribution } from "@/lib/utm";

/* Webhook da Meta (WhatsApp Cloud API).
   GET: handshake de verificação (hub.verify_token).
   POST: confere X-Hub-Signature-256 com o App Secret, grava cada mensagem com o id da Meta
   (receive_inbound é idempotente) e responde 200 rápido. Mídia e status de entrega: a construir. */

export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === process.env.META_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
}

function validSignature(body: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
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
      /** anúncio "clique para WhatsApp": a Meta manda de qual anúncio veio */
      referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string; ctwa_clid?: string };
    }[];
    /** avisos do que enviamos: enviada, entregue, lida, falhou */
    statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
  };
};
/** Instagram e Messenger: eventos de mensagem por página/conta */
type Messaging = {
  sender?: { id: string };
  recipient?: { id: string };
  message?: { mid: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string }; attachments?: { type: string }[] };
  referral?: { ref?: string; source?: string; ad_id?: string; ads_context_data?: { ad_title?: string } };
};

/** grava a mensagem recebida, liga a origem (anúncio ou link rastreável) e roda os robôs */
async function inbound(channelId: string, thread: string, name: string, text: string, externalId: string, ad: ReturnType<typeof cleanAttribution>) {
  const db = adminClient();
  const { data: msgId, error } = await db.rpc("receive_inbound", { p_channel: channelId, p_thread: thread, p_sender_name: name, p_body: text, p_external_id: externalId });
  if (error) return console.error("[meta] receive_inbound", error.message);
  if (!msgId) return; // repetida
  const { data: row } = await db.from("messages").select("conversation_id, workspace_id").eq("id", msgId).maybeSingle();
  if (row) await attributeInbound(row.conversation_id as string, text, ad);
  await fireRobotsForMessage(msgId as string); // robôs: boas-vindas, palavra-chave, respostas de botão...
  if (!row) return;
  await deliverQueued(row.workspace_id as string).catch(() => 0);
  // agente de IA depois da resposta 200 (a Meta reenvia se o webhook demora)
  after(async () => {
    await answerWithAgent(row.conversation_id as string);
    await deliverQueued(row.workspace_id as string).catch(() => 0);
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-hub-signature-256"))) return new Response("assinatura inválida", { status: 401 });

  const payload = JSON.parse(body) as { object?: string; entry?: { id?: string; changes?: WaChange[]; messaging?: Messaging[] }[] };
  const db = adminClient();
  for (const entry of payload.entry ?? []) {
    // ---------- WhatsApp Cloud API ----------
    for (const change of entry.changes ?? []) {
      const v = change.value;
      for (const st of v?.statuses ?? []) await updateDeliveryStatus(st.id, st.status, st.errors?.[0]?.message ?? st.errors?.[0]?.title);
      const phoneId = v?.metadata?.phone_number_id;
      if (!phoneId || !v?.messages?.length) continue;
      const { data: ch } = await db.from("channels").select("id").eq("kind", "whatsapp").eq("external_id", phoneId).eq("status", "connected").maybeSingle();
      if (!ch) continue; // número que não é de nenhum cliente nosso
      for (const m of v.messages) {
        const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
        const text =
          m.type === "text" ? (m.text?.body ?? "") : m.type === "button" ? (m.button?.text ?? "") : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "") : `[${m.type}]`;
        const ad = m.referral
          ? cleanAttribution({ utm_source: "meta", utm_medium: "ctwa", ad_id: m.referral.source_id, ad_headline: m.referral.headline, ctwa_clid: m.referral.ctwa_clid, landing: m.referral.source_url }, "meta_ad")
          : null;
        await inbound(ch.id, m.from, name, text || `[${m.type}]`, m.id, ad);
      }
    }
    // ---------- Instagram Direct e Messenger ----------
    if (entry.messaging?.length && entry.id) {
      const kind = payload.object === "instagram" ? "instagram" : "messenger";
      const { data: ch } = await db.from("channels").select("id").eq("kind", kind).eq("external_id", entry.id).eq("status", "connected").maybeSingle();
      if (!ch) continue;
      for (const ev of entry.messaging) {
        const m = ev.message;
        if (!m || m.is_echo || !ev.sender?.id) continue; // eco = nossa própria mensagem
        const text = m.text ?? (m.attachments?.length ? `[${m.attachments[0].type}]` : "");
        if (!text) continue;
        const ad = ev.referral?.ad_id
          ? cleanAttribution({ utm_source: kind, utm_medium: "ad", ad_id: ev.referral.ad_id, ad_headline: ev.referral.ads_context_data?.ad_title }, "meta_ad")
          : null;
        await inbound(ch.id, ev.sender.id, "", text, m.mid, ad);
      }
    }
  }
  return new Response("ok", { status: 200 });
}
