// Ponte do WhatsApp por QR code para o netzer (WhatsApp Web, via Baileys).
// Uma sessão por canal: o netzer pede o QR, a pessoa lê no celular e as mensagens passam a chegar no webhook.
// Fica atrás do Caddy (HTTPS). Toda chamada do netzer traz o token; todo aviso para o netzer vai assinado com ele.
//
// Variáveis (.env): BRIDGE_TOKEN, NETZER_WEBHOOK, PORT (padrão 3210), DATA_DIR (padrão ./sessions)

import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";

const TOKEN = process.env.BRIDGE_TOKEN ?? "";
const WEBHOOK = process.env.NETZER_WEBHOOK ?? "";
const PORT = Number(process.env.PORT ?? 3210);
const DATA = process.env.DATA_DIR ?? "./sessions";
if (TOKEN.length < 24 || !WEBHOOK) {
  console.error("Defina BRIDGE_TOKEN (24+ caracteres) e NETZER_WEBHOOK no .env");
  process.exit(1);
}
mkdirSync(DATA, { recursive: true });

const logger = pino({ level: "silent" });
/** id da sessão -> { sock, status: "starting" | "qr" | "open" | "closed", qr, me } */
const sessions = new Map();
const validId = (id) => /^[a-zA-Z0-9-]{8,64}$/.test(id);

function sign(body) {
  return createHmac("sha256", TOKEN).update(body).digest("hex");
}

async function notify(event) {
  const body = JSON.stringify(event);
  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "content-type": "application/json", "x-zap-signature": sign(body) }, body, signal: AbortSignal.timeout(15000) });
    if (!res.ok) console.error("[webhook]", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error("[webhook] falhou", e?.message ?? e);
  }
}

/** texto legível de uma mensagem recebida (mídia vira um aviso entre colchetes) */
function textOf(m) {
  const c = m.message ?? {};
  const inner = c.ephemeralMessage?.message ?? c.viewOnceMessage?.message ?? c;
  return (
    inner.conversation ??
    inner.extendedTextMessage?.text ??
    inner.imageMessage?.caption ??
    inner.videoMessage?.caption ??
    inner.documentMessage?.caption ??
    inner.buttonsResponseMessage?.selectedDisplayText ??
    inner.listResponseMessage?.title ??
    (inner.imageMessage ? "[imagem]" : inner.audioMessage ? "[áudio]" : inner.videoMessage ? "[vídeo]" : inner.documentMessage ? "[arquivo]" : inner.stickerMessage ? "[figurinha]" : inner.locationMessage ? "[localização]" : null)
  );
}

async function start(id) {
  const cur = sessions.get(id);
  if (cur && cur.status !== "closed") return cur;
  const s = { sock: null, status: "starting", qr: null, me: null };
  sessions.set(id, s);
  const { state, saveCreds } = await useMultiFileAuthState(join(DATA, id));
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  const sock = makeWASocket({ auth: state, logger, version, browser: ["netzer", "Chrome", "1.0"], markOnlineOnConnect: false, syncFullHistory: false });
  s.sock = sock;
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (u) => {
    if (u.qr) {
      s.status = "qr";
      s.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 });
    }
    if (u.connection === "open") {
      s.status = "open";
      s.qr = null;
      const jid = sock.user?.id ?? "";
      s.me = { phone: jid.split(":")[0].split("@")[0], name: sock.user?.name ?? "" };
      notify({ type: "status", session: id, status: "open", me: s.me });
    }
    if (u.connection === "close") {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        // desconectado pelo celular: apaga a sessão e avisa o netzer
        s.status = "closed";
        rmSync(join(DATA, id), { recursive: true, force: true });
        sessions.delete(id);
        notify({ type: "status", session: id, status: "logged_out" });
      } else {
        s.status = "closed";
        setTimeout(() => start(id).catch((e) => console.error("[reconectar]", id, e?.message)), 3000);
      }
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      const jid = m.key.remoteJid ?? "";
      if (m.key.fromMe || !jid.endsWith("@s.whatsapp.net")) continue; // grupos, status e as nossas: fora
      const text = textOf(m);
      if (!text) continue;
      await notify({ type: "message", session: id, from: jid.split("@")[0], name: m.pushName ?? "", text, id: m.key.id });
    }
  });
  return s;
}

async function readBody(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1_000_000) throw new Error("corpo grande demais");
  }
  return data ? JSON.parse(data) : {};
}

function authorized(req) {
  const got = Buffer.from((req.headers.authorization ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

const send = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/health") return send(res, 200, { ok: true, sessions: sessions.size });
    if (!authorized(req)) return send(res, 401, { error: "não autorizado" });
    const [, root, id, action] = url.pathname.split("/");
    if (root !== "sessions" || !validId(id ?? "")) return send(res, 404, { error: "não encontrado" });

    if (req.method === "POST" && !action) {
      const s = await start(id);
      return send(res, 200, { status: s.status });
    }
    if (req.method === "GET" && !action) {
      const s = sessions.get(id);
      return send(res, 200, s ? { status: s.status, qr: s.qr, me: s.me } : { status: "none" });
    }
    if (req.method === "DELETE" && !action) {
      const s = sessions.get(id);
      await s?.sock?.logout().catch(() => {});
      sessions.delete(id);
      rmSync(join(DATA, id), { recursive: true, force: true });
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && action === "send") {
      const s = sessions.get(id);
      if (!s || s.status !== "open") return send(res, 409, { error: "WhatsApp desconectado: leia o QR code de novo." });
      const b = await readBody(req);
      const to = `${String(b.to ?? "").replace(/\D/g, "")}@s.whatsapp.net`;
      let content;
      if (b.media?.url) {
        const kind = b.media.type === "image" ? "image" : b.media.type === "video" ? "video" : b.media.type === "audio" ? "audio" : "document";
        content = { [kind]: { url: b.media.url }, ...(kind !== "audio" && b.text ? { caption: b.text } : {}), ...(kind === "document" ? { fileName: b.media.filename ?? "arquivo" } : {}) };
      } else content = { text: String(b.text ?? "").slice(0, 4096) };
      const r = await s.sock.sendMessage(to, content);
      return send(res, 200, { id: r?.key?.id ?? null });
    }
    send(res, 404, { error: "não encontrado" });
  } catch (e) {
    console.error("[http]", e?.message ?? e);
    send(res, 500, { error: "erro na ponte" });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`ponte do WhatsApp ouvindo em 127.0.0.1:${PORT}`));

// volta as sessões que já estavam conectadas antes de reiniciar
for (const id of readdirSync(DATA)) if (validId(id)) start(id).catch((e) => console.error("[iniciar]", id, e?.message));
