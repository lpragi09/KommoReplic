import "server-only";
import { cookies } from "next/headers";
import { MetaError } from "@/lib/meta";
import { open } from "@/lib/secret-box";

/* "Conectar com Facebook" para Instagram e Messenger (login da Meta pelo servidor, sem SDK na página).
   O cliente entra na Meta, autoriza o app da netzer e escolhe a página; guardamos o token da página,
   que não vence quando vem de um token de usuário de longa duração.
   Precisa de META_APP_ID, META_APP_SECRET e APP_URL. Com META_LOGIN_CONFIG_ID (Login do Facebook para Empresas)
   a Meta usa as permissões da configuração; sem ela, pede as permissões abaixo. */

const VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export type MetaKind = "instagram" | "messenger";

/** cookies cifrados do login: o state (10 min) e o token para escolher a página (30 min) */
export const META_STATE_COOKIE = "meta_oauth";
export const META_PICK_COOKIE = "meta_pick";
export type MetaPick = { token: string; slug: string; kind: MetaKind; user: string; exp: number };

export const metaLoginOn = () => !!process.env.META_APP_ID && !!process.env.META_APP_SECRET && !!process.env.APP_URL;

const redirectUri = () => `${process.env.APP_URL!.replace(/\/$/, "")}/api/meta/callback`;

const SCOPES: Record<MetaKind, string[]> = {
  messenger: ["pages_show_list", "pages_messaging", "pages_manage_metadata", "business_management"],
  instagram: ["pages_show_list", "pages_messaging", "pages_manage_metadata", "business_management", "instagram_basic", "instagram_manage_messages"],
};

export function loginUrl(state: string, kind: MetaKind) {
  const q = new URLSearchParams({ client_id: process.env.META_APP_ID!, redirect_uri: redirectUri(), state, response_type: "code" });
  const config = process.env.META_LOGIN_CONFIG_ID;
  if (config) q.set("config_id", config);
  else q.set("scope", SCOPES[kind].join(","));
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${q}`;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || body.error) throw new MetaError(`A Meta respondeu: ${body.error?.message ?? `erro ${res.status}`}`);
  return body;
}

/** código do login → token de usuário de longa duração (~60 dias; os tokens de página tirados dele não vencem) */
export async function exchangeCode(code: string) {
  const app = { client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET! };
  const short = await get<{ access_token: string }>("/oauth/access_token", { ...app, redirect_uri: redirectUri(), code });
  const long = await get<{ access_token: string }>("/oauth/access_token", { ...app, grant_type: "fb_exchange_token", fb_exchange_token: short.access_token });
  return long.access_token;
}

export type MetaPage = { id: string; name: string; token: string; ig: { id: string; username: string } | null };

/** páginas que a pessoa autorizou, com o Instagram profissional ligado a cada uma */
export async function listPages(userToken: string): Promise<MetaPage[]> {
  const r = await get<{ data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[] }>("/me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  });
  return (r.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    token: p.access_token,
    ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username ?? "instagram" } : null,
  }));
}

/** liga a página ao app para os avisos de mensagem chegarem no nosso webhook (Messenger e Instagram) */
export async function subscribePage(pageId: string, pageToken: string) {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ subscribed_fields: "messages,messaging_postbacks", access_token: pageToken }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || !body.success) throw new MetaError(`A Meta não ligou a página ao app: ${body.error?.message ?? `erro ${res.status}`}`);
}

/** token do login guardado na volta da Meta, se ainda vale para esta empresa e esta pessoa */
export async function readPick(slug: string, userId: string): Promise<MetaPick | null> {
  const raw = (await cookies()).get(META_PICK_COOKIE)?.value;
  if (!raw) return null;
  try {
    const p = JSON.parse(open(raw)) as MetaPick;
    return p.slug === slug && p.user === userId && p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
