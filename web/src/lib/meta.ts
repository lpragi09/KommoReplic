import "server-only";

/* Cliente mínimo da Graph API da Meta (WhatsApp Cloud API, Instagram e Messenger).
   Só o que o sistema usa: conferir a conta ao conectar, enviar texto e mídia e baixar a mídia recebida. */

const GRAPH = "https://graph.facebook.com/v21.0";

export class MetaError extends Error {}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || body.error) {
    const m = body.error?.message ?? `erro ${res.status}`;
    throw new MetaError(/token|OAuth|session/i.test(m) ? "A Meta recusou o token: confira se ele é permanente e tem as permissões do canal." : `A Meta respondeu: ${m}`);
  }
  return body;
}

/** confere a conta antes de salvar o canal; devolve um nome legível */
export async function verifyAccount(kind: "whatsapp" | "instagram" | "messenger", externalId: string, token: string) {
  if (kind === "whatsapp") {
    const r = await call<{ display_phone_number?: string; verified_name?: string }>(`/${encodeURIComponent(externalId)}?fields=display_phone_number,verified_name`, token);
    return `${r.verified_name ?? "WhatsApp"} ${r.display_phone_number ?? ""}`.trim();
  }
  if (kind === "instagram") {
    const r = await call<{ username?: string }>(`/${encodeURIComponent(externalId)}?fields=username`, token);
    return r.username ? `@${r.username}` : "Instagram";
  }
  const r = await call<{ name?: string }>(`/${encodeURIComponent(externalId)}?fields=name`, token);
  return r.name ?? "Messenger";
}

/** envia texto; devolve o id da mensagem na Meta (para casar com os avisos de entregue/lida) */
export async function sendText(kind: "whatsapp" | "instagram" | "messenger", externalId: string, token: string, to: string, text: string) {
  if (kind === "whatsapp") {
    const r = await call<{ messages?: { id: string }[] }>(`/${encodeURIComponent(externalId)}/messages`, token, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: text } }),
    });
    return r.messages?.[0]?.id ?? null;
  }
  // Instagram e Messenger: Send API da página (resposta dentro da janela de 24h)
  const r = await call<{ message_id?: string }>(`/${encodeURIComponent(externalId)}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ recipient: { id: to }, messaging_type: "RESPONSE", message: { text } }),
  });
  return r.message_id ?? null;
}

/** envia um anexo por link (o arquivo fica no nosso storage com link assinado); devolve o id da mensagem na Meta */
export async function sendMedia(
  kind: "whatsapp" | "instagram" | "messenger",
  externalId: string,
  token: string,
  to: string,
  media: { type: "image" | "audio" | "video" | "file"; link: string; caption?: string; filename?: string },
) {
  if (kind === "whatsapp") {
    const t = media.type === "file" ? "document" : media.type;
    const payload: Record<string, string> = { link: media.link };
    if (media.caption && t !== "audio") payload.caption = media.caption;
    if (t === "document" && media.filename) payload.filename = media.filename;
    const r = await call<{ messages?: { id: string }[] }>(`/${encodeURIComponent(externalId)}/messages`, token, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: t, [t]: payload }),
    });
    return r.messages?.[0]?.id ?? null;
  }
  // Instagram e Messenger: o anexo vai sozinho; a legenda segue como texto logo depois
  const r = await call<{ message_id?: string }>(`/${encodeURIComponent(externalId)}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ recipient: { id: to }, messaging_type: "RESPONSE", message: { attachment: { type: media.type, payload: { url: media.link, is_reusable: false } } } }),
  });
  if (media.caption) await sendText(kind, externalId, token, to, media.caption);
  return r.message_id ?? null;
}

/** baixa a mídia que o cliente mandou: WhatsApp pelo id (com o token); Instagram/Messenger pelo link do aviso */
export async function downloadMedia(source: { mediaId: string; token: string } | { url: string }, maxBytes: number) {
  let url: string;
  let headers: Record<string, string> = {};
  let mime = "";
  if ("mediaId" in source) {
    const meta = await call<{ url?: string; mime_type?: string }>(`/${encodeURIComponent(source.mediaId)}`, source.token);
    if (!meta.url) throw new MetaError("A Meta não devolveu o arquivo.");
    url = meta.url;
    mime = meta.mime_type ?? "";
    headers = { authorization: `Bearer ${source.token}` };
  } else url = source.url;
  if (!/^https:\/\/([a-z0-9-]+\.)*(fbcdn\.net|fbsbx\.com|facebook\.com|whatsapp\.net|cdninstagram\.com|lookaside\.fbsbx\.com)\//i.test(url))
    throw new MetaError("Link de mídia fora da Meta: ignorado.");
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000), redirect: "follow" });
  if (!res.ok) throw new MetaError(`Não deu para baixar a mídia (erro ${res.status}).`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new MetaError("Arquivo grande demais.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new MetaError("Arquivo grande demais.");
  return { bytes, mime: (mime || res.headers.get("content-type") || "application/octet-stream").split(";")[0] };
}
