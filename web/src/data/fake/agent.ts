import "server-only";
import { connection } from "next/server";
import { db, now, uid } from "./store";
import { accessOf } from "../access";
import { runAgent, type AgentStore } from "../ai/runner";
import { AGENT_DEFAULT, DomainError, type AgentConfig, type ID } from "../types";

/* Agente de IA no banco em memória (mesmo comportamento do Supabase). */

const g = globalThis as unknown as { __crmAgents?: Map<string, AgentConfig> };
const agents = (g.__crmAgents ??= new Map());

export async function getAgent(wsId: ID): Promise<AgentConfig> {
  await connection();
  return { ...AGENT_DEFAULT, ...agents.get(wsId) };
}

export async function saveAgent(wsId: ID, input: Omit<AgentConfig, "updatedAt">): Promise<AgentConfig> {
  const cfg = { ...input, updatedAt: now() };
  agents.set(wsId, cfg);
  return cfg;
}

export async function setConversationAi(wsId: ID, conversationId: ID, paused: boolean) {
  const c = db.conversations.find((x) => x.id === conversationId && x.workspaceId === wsId);
  if (!c) throw new DomainError("not_found");
  c.aiPaused = paused;
}

const store: AgentStore = {
  async snapshot(conversationId) {
    const c = db.conversations.find((x) => x.id === conversationId);
    const ch = c && db.channels.find((x) => x.id === c.channelId);
    if (!c || !ch) return null;
    const s = db.subs[c.workspaceId];
    const msgs = db.messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    const hourAgo = new Date(Date.now() - 36e5).toISOString();
    return {
      wsId: c.workspaceId,
      company: db.workspaces.find((w) => w.id === c.workspaceId)?.name ?? "",
      access: accessOf(s?.status ?? "trialing", s?.trialEndsAt ?? new Date(Date.now() + 864e5).toISOString(), s?.plan ?? "trial"),
      cfg: agents.get(c.workspaceId) ?? null,
      channel: ch.kind,
      contactName: db.contacts.find((x) => x.id === c.contactId)?.name ?? "",
      aiPaused: !!c.aiPaused,
      robotWaiting: db.robotRuns.some((r) => r.conversationId === c.id && r.status === "waiting"),
      history: msgs.slice(-30).map((m) => ({ direction: m.direction, body: m.body, byAi: !!m.byAi })),
      aiLastHour: msgs.filter((m) => m.byAi && m.sentAt >= hourAgo).length,
    };
  },
  async reply(conversationId, text) {
    const c = db.conversations.find((x) => x.id === conversationId)!;
    const ch = db.channels.find((x) => x.id === c.channelId)!;
    const m = { id: uid(), conversationId, direction: "out" as const, body: text, senderUserId: null, clientId: null, status: ch.kind === "webchat" ? ("sent" as const) : ("queued" as const), sentAt: now(), byAi: true };
    db.messages.push(m);
    Object.assign(c, { lastMessageAt: m.sentAt, lastMessagePreview: text, isUnanswered: false });
  },
  async handoff(conversationId, reason) {
    const c = db.conversations.find((x) => x.id === conversationId)!;
    Object.assign(c, { aiPaused: true, isUnanswered: true });
    if (c.leadId) db.notes.push({ id: uid(), leadId: c.leadId, contactId: null, body: `Agente de IA passou a conversa para a equipe: ${reason}`, createdBy: "", createdAt: now() });
  },
};

export const answerWithAgent = (conversationId: ID) => runAgent(store, conversationId);
