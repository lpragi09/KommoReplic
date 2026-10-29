import type { Attribution, SourceRule } from "@/data/types";

/* Regras de entrada: a mesma rede social pode alimentar vários funis. A mensagem nova entra no funil da primeira
   regra que bater (na ordem em que foram criadas); nenhuma bateu, vale o funil padrão do canal. */

const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** "orçamento, preço" → qualquer uma das palavras, sem ligar para acento ou maiúscula */
export const keywords = (value: string) => value.split(",").map((w) => plain(w.trim())).filter(Boolean);

export function routeFor<R extends Pick<SourceRule, "channelId" | "match" | "value" | "createdAt">>(rules: R[], msg: { channelId: string | null; body: string; attribution: Attribution | null }): R | null {
  const text = plain(msg.body);
  const hit = (r: R) => {
    switch (r.match) {
      case "keyword":
        return keywords(r.value).some((w) => text.includes(w));
      case "code":
        return !!r.value.trim() && msg.body.toUpperCase().includes(r.value.trim().toUpperCase());
      case "link":
        return !!r.value && msg.attribution?.link_id === r.value;
      case "ad":
        return msg.attribution?.via === "meta_ad";
    }
  };
  return [...rules].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((r) => (!r.channelId || r.channelId === msg.channelId) && hit(r)) ?? null;
}

export const MATCH_LABEL: Record<SourceRule["match"], string> = {
  keyword: "tem a palavra",
  code: "tem o código",
  link: "veio do link",
  ad: "veio de anúncio da Meta",
};
