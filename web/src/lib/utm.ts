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
};

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

/** "(ref: K7Q2M)" na mensagem do cliente → "K7Q2M" */
export const REF_RE = /\bref[:\s#-]*([A-Z0-9]{5,8})\b/i;
export const findRef = (body: string) => body.match(REF_RE)?.[1]?.toUpperCase() ?? null;

/** fonte / campanha legível para listas e relatórios */
export function attrSummary(a: Attribution | null | undefined) {
  if (!a) return null;
  const src = a.utm_source ?? (a.via === "meta_ad" ? "meta" : a.gclid ? "google" : a.fbclid ? "facebook" : undefined);
  const parts = [src, a.utm_medium, a.utm_campaign ?? a.ad_headline].filter(Boolean);
  return parts.length ? parts.join(" · ") : a.via ? VIA_LABEL[a.via] : null;
}
