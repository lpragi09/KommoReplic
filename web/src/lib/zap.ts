import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/* WhatsApp por QR code: conversa com a ponte (zap-bridge, na VM da Oracle) que segura a conexão do WhatsApp Web.
   Não é a API oficial: o número pode ser bloqueado pelo WhatsApp se mandar muita mensagem. O canal fica com
   external_id "qr:<sessão>" e config.provider "qr". Precisa de ZAP_BRIDGE_URL e ZAP_BRIDGE_TOKEN. */

export const zapOn = () => !!process.env.ZAP_BRIDGE_URL && !!process.env.ZAP_BRIDGE_TOKEN;
export const QR_PREFIX = "qr:";

async function bridge<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${process.env.ZAP_BRIDGE_URL!.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.ZAP_BRIDGE_TOKEN}`, "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `ponte do WhatsApp respondeu ${res.status}`);
  return body;
}

export type ZapStatus = { status: "none" | "starting" | "qr" | "open" | "closed"; qr?: string | null; me?: { phone: string; name: string } | null };

export const zapStart = (session: string) => bridge<{ status: string }>(`/sessions/${session}`, { method: "POST" });
export const zapStatus = (session: string) => bridge<ZapStatus>(`/sessions/${session}`);
export const zapStop = (session: string) => bridge<{ ok: boolean }>(`/sessions/${session}`, { method: "DELETE" });

export async function zapSend(session: string, to: string, text: string, media?: { type: string; url: string; filename?: string }) {
  const r = await bridge<{ id: string | null }>(`/sessions/${session}/send`, { method: "POST", body: JSON.stringify({ to, text, media }) });
  return r.id;
}

/** os avisos da ponte vêm assinados com o mesmo token */
export function zapSignatureOk(body: string, signature: string | null) {
  if (!zapOn() || !signature) return false;
  const want = Buffer.from(createHmac("sha256", process.env.ZAP_BRIDGE_TOKEN!).update(body).digest("hex"));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}
