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

/** pacotes avulsos de créditos de IA (lookup_key do preço no Stripe → créditos). Não vencem; o plano gasta primeiro. */
export const AI_PACKS = [
  { key: "ia_500", credits: 500 },
  { key: "ia_2000", credits: 2000 },
  { key: "ia_5000", credits: 5000 },
] as const;
export type AiPackKey = (typeof AI_PACKS)[number]["key"];

/** mês corrente no fuso de Brasília (créditos do plano zeram na virada) */
export const aiMonth = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
