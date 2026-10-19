import "server-only";
import { aiAvailable, askAgent, type Turn } from "@/lib/ai-agent";
import { aiMonth, limitsOf } from "@/lib/plans";
import type { Access, AgentConfig, ChannelKind, ID } from "../types";

/* Quando o agente de IA responde. Igual nos dois bancos: cada um só diz como ler e gravar (AgentStore).
   Responde se: a empresa ligou o agente, o plano libera, o canal está marcado, ninguém da equipe assumiu
   a conversa, nenhum robô está no meio de um fluxo e a última mensagem é do cliente. */

export type AgentSnapshot = {
  wsId: ID;
  company: string;
  access: Access;
  cfg: AgentConfig | null;
  channel: ChannelKind;
  contactName: string;
  aiPaused: boolean;
  robotWaiting: boolean;
  /** últimas mensagens, da mais antiga para a mais nova */
  history: { direction: "in" | "out"; body: string; byAi: boolean }[];
  /** respostas da IA nesta conversa na última hora (trava contra loop e custo) */
  aiLastHour: number;
  /** chave própria da Anthropic da empresa (já aberta): com ela, a conta da IA é da empresa e não gasta crédito */
  ownKey: string | null;
  /** créditos avulsos que sobram (liberam a IA mesmo em plano sem agente) */
  extraCredits: number;
};

export type AgentStore = {
  snapshot(conversationId: ID): Promise<AgentSnapshot | null>;
  reply(conversationId: ID, text: string): Promise<void>;
  handoff(conversationId: ID, reason: string): Promise<void>;
  /** gasta 1 crédito do mês (plano primeiro, depois avulsos). false = acabou. Atômico no banco. */
  spend(wsId: ID, included: number, month: string): Promise<boolean>;
  /** devolve o crédito quando a chamada à IA falhou */
  refund(wsId: ID, included: number, month: string): Promise<void>;
};

const MAX_PER_HOUR = 30;

/** o plano inclui o agente, ou a empresa comprou créditos avulsos, ou usa a própria chave */
export function agentAllowed(access: Access, extraCredits = 0, ownKey = false) {
  return access.state !== "locked" && (limitsOf(access.plan).aiAgent || extraCredits > 0 || ownKey);
}

export const OUT_OF_CREDITS = "os créditos de IA do mês acabaram (compre mais em Configurações → Plano e cobrança → Complementos, ou use a chave própria da Anthropic)";

export async function runAgent(store: AgentStore, conversationId: ID) {
  try {
    const s = await store.snapshot(conversationId);
    if (!s?.cfg?.enabled || !s.cfg.channels.includes(s.channel) || s.aiPaused || s.robotWaiting) return;
    if (!s.ownKey && !aiAvailable()) return;
    if (!agentAllowed(s.access, s.extraCredits, !!s.ownKey)) return;
    const last = s.history[s.history.length - 1];
    if (!last || last.direction !== "in") return; // um robô (ou alguém) já respondeu
    if (s.aiLastHour >= MAX_PER_HOUR) return store.handoff(conversationId, "muitas mensagens seguidas com a IA");

    const turns: Turn[] = s.history.map((m) => ({ role: m.direction === "in" ? "cliente" : "empresa", text: m.body }));
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    // a conta da IA: chave própria (a empresa paga direto à Anthropic) ou crédito (plano + avulsos)
    const included = limitsOf(s.access.plan).aiCredits;
    const month = aiMonth();
    if (!s.ownKey && !(await store.spend(s.wsId, included, month))) return store.handoff(conversationId, OUT_OF_CREDITS);
    let ans;
    try {
      ans = await askAgent(s.cfg, { company: s.company, channel: s.channel, contactName: s.contactName, today }, turns, s.ownKey);
    } catch (e) {
      if (!s.ownKey) await store.refund(s.wsId, included, month);
      throw e;
    }
    if (ans.reply) await store.reply(conversationId, ans.reply);
    if (ans.handoff) await store.handoff(conversationId, ans.handoff);
  } catch (e) {
    console.error("[agente de IA] falhou", e);
  }
}
