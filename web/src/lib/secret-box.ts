import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/* Tokens dos canais (Meta) guardados criptografados (AES-256-GCM).
   Chave: CHANNEL_SECRET_KEY (recomendado) ou, na falta dela, derivada da chave secreta do Supabase.
   O banco só vê texto cifrado; quem lê é o servidor. */

function key() {
  const raw = process.env.CHANNEL_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  // em produção, chave conhecida de todos não protege nada: melhor parar do que cifrar com ela
  if (!raw && process.env.NODE_ENV === "production") throw new Error("Variável de ambiente ausente: CHANNEL_SECRET_KEY (veja web/.env.example)");
  return createHash("sha256").update(`recadi-canais:${raw || "recadi-dev-only"}`).digest();
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function open(sealed: string) {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("token ilegível");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}
