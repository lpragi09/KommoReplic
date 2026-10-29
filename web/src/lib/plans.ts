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
  /** agente de IA respondendo os clientes */
  aiAgent: boolean;
  /** respostas da IA incluídas por mês (1 crédito = 1 resposta). Passou disso, usa os créditos comprados ou a chave própria */
  aiCredits: number;
};

const INF = Number.POSITIVE_INFINITY;

export const LIMITS: Record<PlanKey, Limits> = {
  trial: { name: "Teste grátis", pipelines: INF, users: INF, socialChannels: INF, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiAgent: true, aiCredits: 100 },
  basic: { name: "Autônomo", pipelines: 1, users: 2, socialChannels: 1, activeRobots: 3, trackingLinks: 3, broadcasts: false, reportsFull: false, aiAgent: false, aiCredits: 0 },
  advanced: { name: "Equipe", pipelines: INF, users: INF, socialChannels: 3, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiAgent: true, aiCredits: 500 },
  pro: { name: "Operação", pipelines: INF, users: INF, socialChannels: INF, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiAgent: true, aiCredits: 2000 },
};

export const limitsOf = (plan: PlanKey | null | undefined) => LIMITS[plan ?? "trial"] ?? LIMITS.trial;

/** plano mais barato que libera o recurso, para a mensagem de upgrade */
export function upgradeFor(check: (l: Limits) => boolean): string {
  return (["basic", "advanced", "pro"] as const).map((k) => LIMITS[k]).find(check)?.name ?? "Operação";
}

export const fmtLimit = (n: number) => (Number.isFinite(n) ? String(n) : "ilimitado");

/** preço por usuário em reais: mensal (m) e anual por mês (a, cobrado 12x de uma vez). A tela e a cobrança leem daqui. */
export const PLAN_PRICES = {
  autonomo: { plan: "basic", name: "Autônomo", m: 59, a: 49 },
  equipe: { plan: "advanced", name: "Equipe", m: 99, a: 82 },
  operacao: { plan: "pro", name: "Operação", m: 159, a: 132 },
} as const satisfies Record<string, { plan: Exclude<PlanKey, "trial">; name: string; m: number; a: number }>;
export type PriceKey = keyof typeof PLAN_PRICES;
export type Period = "mensal" | "anual";

/** quanto cobrar (centavos) e quantos meses o pagamento cobre */
export function planCharge(key: PriceKey, period: Period, seats: number) {
  const p = PLAN_PRICES[key];
  return period === "anual" ? { cents: p.a * 12 * seats * 100, months: 12 } : { cents: p.m * seats * 100, months: 1 };
}

/** valor de um dia do plano (centavos), para aproveitar o tempo que sobrou ao trocar de plano */
export const dailyCents = (plan: PlanKey, seats: number) => {
  const p = Object.values(PLAN_PRICES).find((x) => x.plan === plan);
  return p ? (p.m * 100 * seats) / 30 : 0;
};

/** pacotes avulsos de créditos de IA. Não vencem; o plano gasta primeiro. */
export const AI_PACKS = [
  { key: "ia_500", credits: 500, cents: 2900 },
  { key: "ia_2000", credits: 2000, cents: 9900 },
  { key: "ia_5000", credits: 5000, cents: 21900 },
] as const;
export type AiPackKey = (typeof AI_PACKS)[number]["key"];

/** mês corrente no fuso de Brasília (créditos do plano zeram na virada) */
export const aiMonth = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
