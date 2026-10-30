/* Limites de cada plano. Um lugar só: a tela de planos mostra, o servidor confere.
   O teste grátis libera tudo (igual ao Operação) para a pessoa conhecer o produto inteiro. */

export type PlanKey = "trial" | "basic" | "advanced" | "pro";

export type Limits = {
  name: string;
  pipelines: number;
  users: number;
  /** canais de rede social conectados (WhatsApp, Instagram, Messenger, TikTok); o chat do site é sempre livre */
  socialChannels: number;
  activeRobots: number;
  trackingLinks: number;
  broadcasts: boolean;
  reportsFull: boolean;
  /** respostas da IA incluídas por mês. Zero em todos: a IA é paga à parte, com créditos comprados ou chave própria */
  aiCredits: number;
};

const INF = Number.POSITIVE_INFINITY;

export const LIMITS: Record<PlanKey, Limits> = {
  trial: { name: "Teste grátis", pipelines: INF, users: INF, socialChannels: INF, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiCredits: 0 },
  basic: { name: "Autônomo", pipelines: 1, users: 2, socialChannels: 1, activeRobots: 3, trackingLinks: 3, broadcasts: false, reportsFull: false, aiCredits: 0 },
  advanced: { name: "Equipe", pipelines: INF, users: INF, socialChannels: 3, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiCredits: 0 },
  pro: { name: "Operação", pipelines: INF, users: INF, socialChannels: INF, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiCredits: 0 },
};

export const limitsOf = (plan: PlanKey | null | undefined) => LIMITS[plan ?? "trial"] ?? LIMITS.trial;

/** plano mais barato que libera o recurso, para a mensagem de upgrade */
export function upgradeFor(check: (l: Limits) => boolean): string {
  return (["basic", "advanced", "pro"] as const).map((k) => LIMITS[k]).find(check)?.name ?? "Operação";
}

export const fmtLimit = (n: number) => (Number.isFinite(n) ? String(n) : "ilimitado");

/** preço por empresa em reais: mensal com N usuários incluídos e valor por usuário a mais (0 = não aceita extra).
    O anual é 10 meses (2 grátis), cobrado de uma vez. A tela, o checkout e a cobrança leem daqui. */
export const PLAN_PRICES = {
  autonomo: { plan: "basic", name: "Autônomo", base: 69, included: 2, extra: 0 },
  equipe: { plan: "advanced", name: "Equipe", base: 149, included: 5, extra: 29 },
  operacao: { plan: "pro", name: "Operação", base: 299, included: 10, extra: 25 },
} as const satisfies Record<string, { plan: Exclude<PlanKey, "trial">; name: string; base: number; included: number; extra: number }>;

/** mensal em reais para tantos usuários */
export const monthlyPrice = (key: PriceKey, seats: number) => {
  const p = PLAN_PRICES[key];
  return p.base + Math.max(0, seats - p.included) * p.extra;
};
export const ANNUAL_MONTHS = 10; // anual = 10 meses: 2 grátis
export type PriceKey = keyof typeof PLAN_PRICES;
export type Period = "mensal" | "anual";

/** quanto cobrar (centavos) e quantos meses o pagamento cobre */
export function planCharge(key: PriceKey, period: Period, seats: number) {
  const m = monthlyPrice(key, seats) * 100;
  return period === "anual" ? { cents: m * ANNUAL_MONTHS, months: 12 } : { cents: m, months: 1 };
}

/** valor de um dia do plano (centavos), para aproveitar o tempo que sobrou ao trocar de plano */
export const dailyCents = (plan: PlanKey, seats: number) => {
  const key = (Object.keys(PLAN_PRICES) as PriceKey[]).find((k) => PLAN_PRICES[k].plan === plan);
  return key ? (monthlyPrice(key, seats) * 100) / 30 : 0;
};

/** pacotes de créditos de IA. Não vencem; o preço já inclui a nossa margem sobre o custo da Anthropic. */
export const AI_PACKS = [
  { key: "ia_500", credits: 500, cents: 2900 },
  { key: "ia_2000", credits: 2000, cents: 9900 },
  { key: "ia_5000", credits: 5000, cents: 21900 },
] as const;
export type AiPackKey = (typeof AI_PACKS)[number]["key"];

/** mês corrente no fuso de Brasília (créditos do plano zeram na virada) */
export const aiMonth = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
