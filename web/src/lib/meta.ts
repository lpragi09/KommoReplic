import "server-only";

/* Cliente mínimo da Graph API da Meta (WhatsApp Cloud API, Instagram e Messenger).
   Só o que o Recadi usa: conferir a conta ao conectar e enviar texto. */

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
