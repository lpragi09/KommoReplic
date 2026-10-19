import "server-only";
import { connection } from "next/server";
import { db, now, uid } from "./store";
import { accessOf } from "../access";
import { runAgent, type AgentStore } from "../ai/runner";
import { aiMonth, limitsOf } from "@/lib/plans";
import { open, seal } from "@/lib/secret-box";
import { AGENT_DEFAULT, DomainError, type AgentConfig, type AiWallet, type ID, type UsageCounts } from "../types";

/* Agente de IA no banco em memória (mesmo comportamento do Supabase). */

const g = globalThis as unknown as { __crmAgents?: Map<string, AgentConfig> };
const agents = (g.__crmAgents ??= new Map());
type WalletRow = { month: string; used: number; extra: number; keyEnc: string | null; hint: string | null; purchases: Set<string> };
const gw = globalThis as unknown as { __crmWallets?: Map<string, WalletRow> };
const wallets = (gw.__crmWallets ??= new Map());
const wallet = (wsId: ID) => {
  let w = wallets.get(wsId);
  if (!w) wallets.set(wsId, (w = { month: aiMonth(), used: 0, extra: 0, keyEnc: null, hint: null, purchases: new Set() }));
  return w;
};

/* ---------- créditos de IA ---------- */

export async function getAiWallet(wsId: ID): Promise<AiWallet> {
  await connection();
  const w = wallet(wsId);
  const s = db.subs[wsId];
  const month = aiMonth();
  return { month, used: w.month === month ? w.used : 0, included: limitsOf(s?.plan ?? "trial").aiCredits, extra: w.extra, ownKeyHint: w.hint };
}

/** chave própria da Anthropic (null tira). Quem chama já conferiu que é admin e que a chave funciona. */
export async function setAiOwnKey(wsId: ID, key: string | null) {
  const w = wallet(wsId);
  w.keyEnc = key ? seal(key) : null;
  w.hint = key ? `…${key.slice(-4)}` : null;
}

/** compra confirmada pelo Stripe: soma uma vez por sessão (o webhook pode repetir) */
export async function addAiCredits(wsId: ID, sessionId: string, credits: number) {
  const w = wallet(wsId);
  if (w.purchases.has(sessionId)) return false;
  w.purchases.add(sessionId);
  w.extra += credits;
  return true;
}

export async function spendAiCredit(wsId: ID, included: number, month: string) {
  const w = wallet(wsId);
  if (w.month !== month) Object.assign(w, { month, used: 0 });
  if (w.used < included) return (w.used++, true);
  if (w.extra > 0) return (w.used++, w.extra--, true);
  return false;
}

export async function refundAiCredit(wsId: ID, included: number, month: string) {
  const w = wallet(wsId);
  if (w.month !== month || w.used <= 0) return;
  if (w.used > included) w.extra++;
  w.used--;
}

const ownKeyOf = (wsId: ID) => {
  const enc = wallets.get(wsId)?.keyEnc;
  return enc ? open(enc) : null;
};
export async function getAiOwnKey(wsId: ID) {
  return ownKeyOf(wsId);
}

export async function getUsageCounts(wsId: ID): Promise<UsageCounts> {
  await connection();
  const links = (globalThis as unknown as { __crmLinks?: { links: { workspaceId: string }[] } }).__crmLinks?.links ?? [];
  return {
    leads: db.leads.filter((l) => l.workspaceId === wsId).length,
    contacts: db.contacts.filter((c) => c.workspaceId === wsId).length,
    companies: db.companies.filter((c) => c.workspaceId === wsId).length,
    pipelines: db.pipelines.filter((p) => p.workspaceId === wsId).length,
    users: db.memberships.filter((m) => m.workspaceId === wsId).length,
    socialChannels: db.channels.filter((c) => c.workspaceId === wsId && c.kind !== "webchat" && c.status !== "disconnected").length,
    activeRobots: db.robots.filter((r) => r.workspaceId === wsId && r.active).length,
    trackingLinks: links.filter((l) => l.workspaceId === wsId).length,
    customFields: db.fields.filter((f) => f.workspaceId === wsId).length,
  };
}

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
  spend: spendAiCredit,
  refund: refundAiCredit,
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
      ownKey: ownKeyOf(c.workspaceId),
      extraCredits: wallets.get(c.workspaceId)?.extra ?? 0,
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
