import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/* Link de descadastro dos emails: /descadastrar/{contato}.{assinatura}.
   A assinatura (HMAC) impede que alguém descadastre outra pessoa trocando o id na URL. */

function key() {
  const raw = process.env.CHANNEL_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw && process.env.NODE_ENV === "production") throw new Error("Variável de ambiente ausente: CHANNEL_SECRET_KEY (veja web/.env.example)");
  return `netzer-descadastro:${raw || "dev-only"}`;
}

const sign = (contactId: string) => createHmac("sha256", key()).update(contactId).digest("base64url").slice(0, 32);

export function unsubscribeToken(contactId: string) {
  return `${contactId}.${sign(contactId)}`;
}

/** devolve o id do contato se a assinatura confere; null se o link foi adulterado */
export function readUnsubscribeToken(token: string) {
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export function unsubscribeUrl(contactId: string) {
  return `${process.env.APP_URL || "http://localhost:3000"}/descadastrar/${unsubscribeToken(contactId)}`;
}
