import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { accessOf } from "../access";
import { runAgent, type AgentStore } from "../ai/runner";
import { aiMonth, limitsOf } from "@/lib/plans";
import { open, seal } from "@/lib/secret-box";
import { AGENT_DEFAULT, DomainError, type AgentConfig, type AiWallet, type ID, type UsageCounts } from "../types";

/* Agente de IA no Supabase: configuração por empresa (tabela ai_agents) e respostas gravadas com by_ai. */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Só administradores podem mudar o agente de IA.");
    if (r.error.code === "42P01") throw new DomainError("invalid", "Rode o atualizacao-canais.sql no Supabase para ligar o agente de IA.");
    throw new Error(r.error.message);
  }
  return r.data;
}

const toAgent = (r: Row | null): AgentConfig =>
  r
    ? { enabled: r.enabled, name: r.name, tone: r.tone, instructions: r.instructions, knowledge: r.knowledge, channels: r.channels ?? [], handoffMessage: r.handoff_message, updatedAt: r.updated_at }
    : { ...AGENT_DEFAULT };

export async function getAgent(wsId: ID): Promise<AgentConfig> {
  const sb = await userClient();
  const { data, error } = await sb.from("ai_agents").select("*").eq("workspace_id", wsId).maybeSingle();
  if (error) return { ...AGENT_DEFAULT }; // banco ainda sem a atualização: tela abre com o padrão
  return toAgent(data);
}

export async function saveAgent(wsId: ID, c: Omit<AgentConfig, "updatedAt">): Promise<AgentConfig> {
  const sb = await userClient();
  const row = { workspace_id: wsId, enabled: c.enabled, name: c.name, tone: c.tone, instructions: c.instructions, knowledge: c.knowledge, channels: c.channels, handoff_message: c.handoffMessage, updated_at: new Date().toISOString() };
  return toAgent(check(await sb.from("ai_agents").upsert(row).select("*").single()));
}

export async function setConversationAi(wsId: ID, conversationId: ID, paused: boolean) {
  const sb = await userClient();
  const r = check(await sb.from("conversations").update({ ai_paused: paused }).eq("workspace_id", wsId).eq("id", conversationId).select("id"));
  if (!r.length) throw new DomainError("not_found");
}

/* ---------- créditos de IA ----------
   ai_wallets: uso do mês e créditos avulsos (membros leem). ai_keys: chave própria cifrada (só o servidor).
   Gastar e somar créditos são funções do banco (atômicas), chamadas só pelo servidor. */

export async function getAiWallet(wsId: ID): Promise<AiWallet> {
  const sb = await userClient();
  const [w, acc] = await Promise.all([sb.from("ai_wallets").select("*").eq("workspace_id", wsId).maybeSingle(), sb.rpc("workspace_access", { p_ws: wsId }).maybeSingle()]);
  const r = (w.error ? null : w.data) as Row | null;
  const plan = ((acc.data as Row | null)?.plan ?? "trial") as Parameters<typeof limitsOf>[0];
  const month = aiMonth();
  return { month, used: r && r.month === month ? r.used : 0, included: limitsOf(plan).aiCredits, extra: r?.extra ?? 0, ownKeyHint: r?.api_key_hint ?? null };
}

export async function setAiOwnKey(wsId: ID, key: string | null) {
  const a = adminClient();
  if (key) check(await a.from("ai_keys").upsert({ workspace_id: wsId, key_enc: seal(key), updated_at: new Date().toISOString() }));
  else check(await a.from("ai_keys").delete().eq("workspace_id", wsId));
  check(await a.from("ai_wallets").upsert({ workspace_id: wsId, api_key_hint: key ? `…${key.slice(-4)}` : null, updated_at: new Date().toISOString() }));
}

export async function addAiCredits(wsId: ID, sessionId: string, credits: number) {
  return !!check(await adminClient().rpc("add_ai_credits", { p_session: sessionId, p_ws: wsId, p_credits: credits }));
}

/** banco ainda sem a atualização dos créditos: a IA segue respondendo como antes (não trava ninguém) */
const missingFn = (e: PostgrestError | null) => !!e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01");

export async function spendAiCredit(wsId: ID, included: number, month: string) {
  const r = await adminClient().rpc("spend_ai_credit", { p_ws: wsId, p_included: included, p_month: month });
  if (missingFn(r.error)) return true;
  return !!check(r);
}

export async function refundAiCredit(wsId: ID, included: number, month: string) {
  await adminClient().rpc("refund_ai_credit", { p_ws: wsId, p_included: included, p_month: month }); // se falhar, perde 1 crédito: não vale travar a conversa
}

export async function getAiOwnKey(wsId: ID) {
  const { data, error } = await adminClient().from("ai_keys").select("key_enc").eq("workspace_id", wsId).maybeSingle();
  if (error || !data?.key_enc) return null;
  try {
    return open(data.key_enc);
  } catch {
    return null; // chave do servidor trocou: a empresa salva a dela de novo
  }
}

export async function getUsageCounts(wsId: ID): Promise<UsageCounts> {
  const sb = await userClient();
  const n = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };
  const [leads, contacts, companies, pipelines, users, socialChannels, activeRobots, trackingLinks, customFields] = await Promise.all([
    n(sb.from("leads").select("id", head).eq("workspace_id", wsId).is("deleted_at", null)),
    n(sb.from("contacts").select("id", head).eq("workspace_id", wsId).is("deleted_at", null)),
    n(sb.from("companies").select("id", head).eq("workspace_id", wsId).is("deleted_at", null)),
    n(sb.from("pipelines").select("id", head).eq("workspace_id", wsId)),
    n(sb.from("memberships").select("user_id", head).eq("workspace_id", wsId)),
    n(sb.from("channels").select("id", head).eq("workspace_id", wsId).neq("kind", "webchat").neq("status", "disconnected")),
    n(sb.from("robots").select("id", head).eq("workspace_id", wsId).eq("active", true)),
    n(sb.from("tracking_links").select("id", head).eq("workspace_id", wsId)),
    n(sb.from("custom_fields").select("id", head).eq("workspace_id", wsId)),
  ]);
  return { leads, contacts, companies, pipelines, users, socialChannels, activeRobots, trackingLinks, customFields };
}

const store: AgentStore = {
  spend: spendAiCredit,
  refund: refundAiCredit,
  async snapshot(conversationId) {
    const a = adminClient();
    const c = check(await a.from("conversations").select("id, workspace_id, ai_paused, contacts(name), channels(kind), workspaces(name)").eq("id", conversationId).maybeSingle());
    if (!c) return null;
    const hourAgo = new Date(Date.now() - 36e5).toISOString();
    const [cfg, sub, msgs, waiting, recent, wallet, ownKey] = await Promise.all([
      a.from("ai_agents").select("*").eq("workspace_id", c.workspace_id).maybeSingle(),
      a.from("subscriptions").select("plan, status, trial_ends_at").eq("workspace_id", c.workspace_id).maybeSingle(),
      a.from("messages").select("direction, body, by_ai").eq("conversation_id", conversationId).order("sent_at", { ascending: false }).limit(30),
      a.from("robot_runs").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId).eq("status", "waiting"),
      a.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId).eq("by_ai", true).gte("sent_at", hourAgo),
      a.from("ai_wallets").select("extra").eq("workspace_id", c.workspace_id).maybeSingle(),
      getAiOwnKey(c.workspace_id),
    ]);
    if (cfg.error) return null; // tabela ainda não criada
    const s = sub.data as Row | null;
    return {
      wsId: c.workspace_id,
      company: c.workspaces?.name ?? "",
      access: s ? accessOf(s.status, s.trial_ends_at, s.plan) : accessOf("trialing", null),
      cfg: cfg.data ? toAgent(cfg.data) : null,
      channel: c.channels?.kind,
      contactName: c.contacts?.name ?? "",
      aiPaused: !!c.ai_paused,
      robotWaiting: (waiting.count ?? 0) > 0,
      history: ((msgs.data ?? []) as Row[]).reverse().map((m) => ({ direction: m.direction, body: m.body, byAi: !!m.by_ai })),
      aiLastHour: recent.count ?? 0,
      ownKey,
      extraCredits: (wallet.data as Row | null)?.extra ?? 0,
    };
  },
  async reply(conversationId, text) {
    const a = adminClient();
    const c = check(await a.from("conversations").select("workspace_id, channel_id, channels(kind)").eq("id", conversationId).single());
    check(
      await a.from("messages").insert({
        workspace_id: c.workspace_id,
        conversation_id: conversationId,
        channel_id: c.channel_id,
        direction: "out",
        body: text,
        sender_user_id: null,
        by_ai: true,
        status: c.channels?.kind === "webchat" ? "sent" : "queued", // redes sociais: saem pela Meta no deliverQueued
      }),
    );
  },
  async handoff(conversationId, reason) {
    const a = adminClient();
    const c = check(await a.from("conversations").update({ ai_paused: true, is_unanswered: true }).eq("id", conversationId).select("workspace_id, lead_id").single());
    if (c.lead_id) await a.from("notes").insert({ workspace_id: c.workspace_id, lead_id: c.lead_id, body: `Agente de IA passou a conversa para a equipe: ${reason}`, kind: "system" });
  },
};

export const answerWithAgent = (conversationId: ID) => runAgent(store, conversationId);
