import type { Attribution } from "@/data/types";

/* UTMs e ids de clique: leitura da URL, limpeza e rótulos. Roda no navegador e no servidor. */

export const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ctwa_clid", "ad_id", "ad_headline", "landing", "referrer"] as const;
type AttrKey = (typeof ATTR_KEYS)[number];

export const ATTR_LABEL: Record<AttrKey, string> = {
  utm_source: "Fonte",
  utm_medium: "Mídia",
  utm_campaign: "Campanha",
  utm_term: "Termo",
  utm_content: "Conteúdo",
  gclid: "Clique Google",
  fbclid: "Clique Facebook",
  ctwa_clid: "Clique anúncio WhatsApp",
  ad_id: "Anúncio (id)",
  ad_headline: "Anúncio",
  landing: "Página de entrada",
  referrer: "Veio de",
};

export const VIA_LABEL: Record<NonNullable<Attribution["via"]>, string> = {
  link: "Link rastreável",
  site: "Script do site",
  webchat: "Chat do site",
  meta_ad: "Anúncio da Meta",
  manual: "Preenchido à mão",
  code: "Código na mensagem",
};

/** o código mais longo da lista que aparece na mensagem (assim "G-01-34" ganha de "G-01-3") */
export function matchCode<T extends { code: string }>(body: string, codes: T[]): T | null {
  const text = body.toUpperCase();
  return [...codes].sort((a, b) => b.code.length - a.code.length).find((c) => c.code.trim() && text.includes(c.code.trim().toUpperCase())) ?? null;
}

/** Aceita só as chaves conhecidas, texto curto, sem controle. Nada vindo de fora entra sem passar aqui. */
export function cleanAttribution(input: unknown, via?: Attribution["via"]): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const src = input as Record<string, unknown>;
  const out: Attribution = {};
  for (const k of ATTR_KEYS) {
    const v = src[k];
    if (typeof v !== "string") continue;
    const t = v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, k === "landing" || k === "referrer" ? 300 : 150);
    if (t) out[k] = t;
  }
  if (typeof src.link_name === "string" && src.link_name.trim()) out.link_name = src.link_name.trim().slice(0, 80);
  if (!Object.keys(out).length) return null;
  out.via = via ?? (typeof src.via === "string" && src.via in VIA_LABEL ? (src.via as Attribution["via"]) : undefined);
  out.at = new Date().toISOString();
  return out;
}

/** UTMs e ids de clique de uma query string (?utm_source=...). */
export function fromSearch(search: string | URLSearchParams): Record<string, string> {
  const p = typeof search === "string" ? new URLSearchParams(search) : search;
  const out: Record<string, string> = {};
  for (const k of ATTR_KEYS) {
    const v = p.get(k);
    if (v) out[k] = v;
  }
  return out;
}

/** código que vai no fim da mensagem do WhatsApp (o cliente vê; o sistema usa para saber de qual link veio) */
export const refText = (ref: string) => `Código do atendimento: ${ref}`;
/** "Código do atendimento: K7Q2M" (ou o antigo "(ref: K7Q2M)") na mensagem do cliente → "K7Q2M" */
export const REF_RE = /(?:\bref|c[oó]digo do atendimento|\bc[oó]d(?:igo)?)[:\s#.-]*([A-Z0-9]{5,8})\b/i;
export const findRef = (body: string) => body.match(REF_RE)?.[1]?.toUpperCase() ?? null;

/** de onde veio, numa palavra (para o filtro do funil): "instagram", "google", "meta", "chat do site"... */
export function originOf(a: Attribution | null | undefined): string | null {
  if (!a) return null;
  const s = a.utm_source ?? (a.via === "meta_ad" ? "meta" : a.gclid ? "google" : a.fbclid ? "facebook" : a.via === "webchat" ? "chat do site" : a.via === "link" ? (a.link_name ?? "link rastreável") : null);
  return s ? s.trim().toLowerCase().slice(0, 60) : null;
}

const hasSource = (a: Attribution) => !!(a.utm_source || a.utm_campaign || a.ad_id || a.link_name || a.gclid || a.fbclid);
const sameTouch = (x: Attribution, y: Attribution) =>
  (x.utm_source ?? "") === (y.utm_source ?? "") && (x.utm_campaign ?? "") === (y.utm_campaign ?? "") && (x.ad_id ?? "") === (y.ad_id ?? "") && (x.link_name ?? "") === (y.link_name ?? "");
function bare(a: Attribution): Attribution {
  const { first: _f, history: _h, ...rest } = a;
  return rest;
}
const touchOf = (a: Attribution) => ({ at: a.at, via: a.via, label: attrSummary(bare(a)) ?? "Sem origem" });

/** Junta uma origem nova à que o lead já tem: a mais nova vira a principal, a 1ª fica guardada e o caminho cresce.
    Devolve null quando não há nada novo (mesma campanha de novo, ou visita sem campanha). */
export function addTouch(cur: Attribution | null | undefined, next: Attribution): Attribution | null {
  if (!cur) return { ...bare(next), history: [touchOf(next)] };
  if (!hasSource(next) || sameTouch(cur, next)) return null;
  const first = cur.first ?? bare(cur);
  const history = [...(cur.history ?? [touchOf(cur)]), touchOf(next)].slice(-10);
  return { ...bare(next), first, history };
}

/** fonte / campanha legível para listas e relatórios */
export function attrSummary(a: Attribution | null | undefined) {
  if (!a) return null;
  const src = a.utm_source ?? (a.via === "meta_ad" ? "meta" : a.gclid ? "google" : a.fbclid ? "facebook" : undefined);
  const parts = [src, a.utm_medium, a.utm_campaign ?? a.ad_headline].filter(Boolean);
  return parts.length ? parts.join(" · ") : a.via ? VIA_LABEL[a.via] : null;
}
