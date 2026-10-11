import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/clients";

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
    messages?: { id: string; from: string; type: string; text?: { body: string } }[];
  };
};

export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-hub-signature-256"))) return new Response("assinatura inválida", { status: 401 });

  const payload = JSON.parse(body) as { entry?: { changes?: WaChange[] }[] };
  const db = adminClient();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      const phoneId = v?.metadata?.phone_number_id;
      if (!phoneId || !v?.messages?.length) continue;
      const { data: ch } = await db.from("channels").select("id").eq("kind", "whatsapp").eq("external_id", phoneId).maybeSingle();
      if (!ch) continue; // número que não é de nenhum cliente nosso
      for (const m of v.messages) {
        const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
        const text = m.type === "text" ? (m.text?.body ?? "") : `[${m.type}]`; // mídia: baixar no job (TODO)
        const { error } = await db.rpc("receive_inbound", { p_channel: ch.id, p_thread: m.from, p_sender_name: name, p_body: text, p_external_id: m.id });
        if (error) console.error("[meta] receive_inbound", error.message);
      }
    }
  }
  return new Response("ok", { status: 200 });
}
