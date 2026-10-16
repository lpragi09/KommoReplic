import "server-only";
import { aiAvailable, askAgent, type Turn } from "@/lib/ai-agent";
import { limitsOf } from "@/lib/plans";
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
};

export type AgentStore = {
  snapshot(conversationId: ID): Promise<AgentSnapshot | null>;
  reply(conversationId: ID, text: string): Promise<void>;
  handoff(conversationId: ID, reason: string): Promise<void>;
};

const MAX_PER_HOUR = 30;

export function agentAllowed(access: Access) {
  return access.state !== "locked" && limitsOf(access.plan).aiAgent;
}

export async function runAgent(store: AgentStore, conversationId: ID) {
  if (!aiAvailable()) return;
  try {
    const s = await store.snapshot(conversationId);
    if (!s?.cfg?.enabled || !s.cfg.channels.includes(s.channel) || s.aiPaused || s.robotWaiting) return;
    if (!agentAllowed(s.access)) return;
    const last = s.history[s.history.length - 1];
    if (!last || last.direction !== "in") return; // um robô (ou alguém) já respondeu
    if (s.aiLastHour >= MAX_PER_HOUR) return store.handoff(conversationId, "muitas mensagens seguidas com a IA");

    const turns: Turn[] = s.history.map((m) => ({ role: m.direction === "in" ? "cliente" : "empresa", text: m.body }));
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    const ans = await askAgent(s.cfg, { company: s.company, channel: s.channel, contactName: s.contactName, today }, turns);
    if (ans.reply) await store.reply(conversationId, ans.reply);
    if (ans.handoff) await store.handoff(conversationId, ans.handoff);
  } catch (e) {
    console.error("[agente de IA] falhou", e);
  }
}
