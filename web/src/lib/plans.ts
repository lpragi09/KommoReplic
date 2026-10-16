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
};

const INF = Number.POSITIVE_INFINITY;

export const LIMITS: Record<PlanKey, Limits> = {
  trial: { name: "Teste grátis", pipelines: INF, users: INF, socialChannels: INF, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiAgent: true },
  basic: { name: "Autônomo", pipelines: 1, users: 2, socialChannels: 1, activeRobots: 3, trackingLinks: 3, broadcasts: false, reportsFull: false, aiAgent: false },
  advanced: { name: "Equipe", pipelines: INF, users: INF, socialChannels: 3, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiAgent: true },
  pro: { name: "Operação", pipelines: INF, users: INF, socialChannels: INF, activeRobots: INF, trackingLinks: INF, broadcasts: true, reportsFull: true, aiAgent: true },
};

export const limitsOf = (plan: PlanKey | null | undefined) => LIMITS[plan ?? "trial"] ?? LIMITS.trial;

/** plano mais barato que libera o recurso, para a mensagem de upgrade */
export function upgradeFor(check: (l: Limits) => boolean): string {
  return (["basic", "advanced", "pro"] as const).map((k) => LIMITS[k]).find(check)?.name ?? "Operação";
}

export const fmtLimit = (n: number) => (Number.isFinite(n) ? String(n) : "ilimitado");
