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
const HISTORY_DAYS = Number(process.env.HISTORY_DAYS ?? 30);
/** "5511999@s.whatsapp.net" -> "5511999"; "123@lid" -> "lid:123"; grupo/status -> null */
function threadOfJid(jid) {
  if (!jid) return null;
  const base = jid.split("@")[0].split(":")[0];
  if (jid.endsWith("@s.whatsapp.net")) return base;
  if (jid.endsWith("@lid")) return `lid:${base}`;
  return null;
}

/** jid -> { url, at }: a foto muda pouco e o WhatsApp limita quantas consultas aceita */
const photoCache = new Map();
const jidOf = (thread) => (thread.startsWith("lid:") ? `${thread.slice(4)}@lid` : `${thread}@s.whatsapp.net`);
async function photoOf(sock, thread) {
  const jid = jidOf(thread);
  const hit = photoCache.get(jid);
  if (hit && Date.now() - hit.at < 12 * 3600_000) return hit.url;
  const url = await sock.profilePictureUrl(jid, "image").catch(() => null); // perfil sem foto ou privado: null
  photoCache.set(jid, { url, at: Date.now() });
  return url;
}

/** quem é o contato: o número quando o WhatsApp manda; senão o código "lid" (contas que escondem o número) */
function threadOf(key) {
  const jid = key.remoteJid ?? "";
  if (jid.endsWith("@s.whatsapp.net")) return jid.split("@")[0].split(":")[0];
  if (jid.endsWith("@lid")) {
    const pn = key.senderPn ?? "";
    return pn.endsWith("@s.whatsapp.net") ? pn.split("@")[0].split(":")[0] : `lid:${jid.split("@")[0].split(":")[0]}`;
  }
  return null; // grupo, status, canal
}

function sign(body) {
  return createHmac("sha256", TOKEN).update(body).digest("hex");
}

async function notify(event) {
  const body = JSON.stringify(event);
  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "content-type": "application/json", "x-zap-signature": sign(body) }, body, signal: AbortSignal.timeout(60000) });
    if (!res.ok) console.error("[webhook]", event.type, res.status, (await res.text()).slice(0, 300));
    else if (event.type === "history") console.log("[histórico] netzer respondeu:", (await res.text()).slice(0, 200));
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
  // syncFullHistory: o WhatsApp manda o histórico recente ao conectar (com a identidade "Mac OS Desktop" ele recusa a conexão)
  const sock = makeWASocket({ auth: state, logger, version, browser: ["netzer", "Chrome", "1.0"], markOnlineOnConnect: false, syncFullHistory: true });
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
      console.log(`[conexão] ${id} conectado ${s.me.phone}`);
      notify({ type: "status", session: id, status: "open", me: s.me });
    }
    if (u.connection === "close") {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      console.log(`[conexão] ${id} fechou (${code ?? "?"})`);
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
  // nomes da agenda do celular chegam na sincronização de contatos (depois de conectar): junta e manda em lotes
  const pendingNames = new Map();
  let namesTimer = null;
  const queueNames = (list) => {
    for (const c of list ?? []) {
      const name = c.name ?? c.notify ?? c.verifiedName; // "name" é o nome salvo na agenda: tem preferência
      if (!name) continue;
      for (const jid of [c.id, c.lid, c.phoneNumber]) {
        const t = threadOfJid(jid);
        if (t && (c.name || !pendingNames.has(t))) pendingNames.set(t, name);
      }
    }
    if (!pendingNames.size || namesTimer) return;
    namesTimer = setTimeout(async () => {
      namesTimer = null;
      const all = [...pendingNames].map(([from, name]) => ({ from, name }));
      pendingNames.clear();
      console.log(`[nomes] ${id}: ${all.length} contatos`);
      for (let i = 0; i < all.length; i += 300) await notify({ type: "names", session: id, names: all.slice(i, i + 300) });
    }, 4000);
  };
  sock.ev.on("contacts.upsert", queueNames);
  sock.ev.on("contacts.update", queueNames);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      const from = threadOf(m.key);
      if (m.key.fromMe || !from) continue; // grupos, status e as nossas: fora
      const text = textOf(m);
      if (!text) continue;
      await notify({ type: "message", session: id, from, name: m.pushName ?? "", text, id: m.key.id, photo: await photoOf(sock, from) });
    }
  });

  // histórico que o WhatsApp manda ao conectar: só conversas individuais dos últimos HISTORY_DAYS dias, em lotes
  sock.ev.on("messaging-history.set", async ({ messages, contacts, chats }) => {
    queueNames(contacts);
    // nome de cada conversa: agenda do celular, nome público do perfil ou o nome da conversa
    const names = new Map();
    for (const c of chats ?? []) if (c.name) names.set(c.id, c.name);
    for (const c of contacts ?? []) {
      const n = c.name ?? c.notify ?? c.verifiedName;
      if (n) names.set(c.id, n);
      if (n && c.lid) names.set(c.lid, n);
    }
    const since = Date.now() / 1000 - HISTORY_DAYS * 86400;
    const items = [];
    for (const m of messages ?? []) {
      const ts = Number(m.messageTimestamp ?? 0);
      const from = threadOf(m.key);
      const text = from && ts >= since ? textOf(m) : null;
      if (!text) continue;
      items.push({ from, out: !!m.key.fromMe, name: m.key.fromMe ? "" : (m.pushName ?? names.get(m.key.remoteJid) ?? ""), text, id: m.key.id, at: new Date(ts * 1000).toISOString() });
    }
    // limite para não pesar o netzer: as 50 últimas de cada conversa, nas 300 conversas mais recentes
    const byThread = new Map();
    for (const it of items) (byThread.get(it.from) ?? byThread.set(it.from, []).get(it.from)).push(it);
    const threads = [...byThread.values()]
      .map((list) => list.sort((a, b) => a.at.localeCompare(b.at)).slice(-50))
      .sort((a, b) => b[b.length - 1].at.localeCompare(a[a.length - 1].at))
      .slice(0, 300);
    items.length = 0;
    for (const list of threads) items.push(...list);
    items.sort((a, b) => a.at.localeCompare(b.at));
    console.log(`[histórico] ${id}: ${items.length} mensagens dos últimos ${HISTORY_DAYS} dias (de ${messages?.length ?? 0} recebidas)`);
    for (let i = 0; i < items.length; i += 200) await notify({ type: "history", session: id, messages: items.slice(i, i + 200) });
    // fotos das conversas importadas, devagar (uma por vez) para não esbarrar no limite do WhatsApp
    const photos = [];
    for (const list of threads) {
      const url = await photoOf(sock, list[0].from);
      if (url) photos.push({ from: list[0].from, url });
      if (photos.length === 50) await notify({ type: "photos", session: id, photos: photos.splice(0) });
    }
    if (photos.length) await notify({ type: "photos", session: id, photos });
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
    if (req.method === "GET" && action === "photo") {
      const s = sessions.get(id);
      const to = url.searchParams.get("to") ?? "";
      if (!s || s.status !== "open" || !/^(lid:)?\d{6,25}$/.test(to)) return send(res, 200, { url: null });
      return send(res, 200, { url: await photoOf(s.sock, to) });
    }
    if (req.method === "POST" && action === "send") {
      const s = sessions.get(id);
      if (!s || s.status !== "open") return send(res, 409, { error: "WhatsApp desconectado: leia o QR code de novo." });
      const b = await readBody(req);
      const raw = String(b.to ?? "");
      const to = raw.startsWith("lid:") ? `${raw.slice(4).replace(/\D/g, "")}@lid` : `${raw.replace(/\D/g, "")}@s.whatsapp.net`;
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
