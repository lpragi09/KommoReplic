import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { accessOf } from "../access";
import { runAgent, type AgentStore } from "../ai/runner";
import { AGENT_DEFAULT, DomainError, type AgentConfig, type ID } from "../types";

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

const store: AgentStore = {
  async snapshot(conversationId) {
    const a = adminClient();
    const c = check(await a.from("conversations").select("id, workspace_id, ai_paused, contacts(name), channels(kind), workspaces(name)").eq("id", conversationId).maybeSingle());
    if (!c) return null;
    const hourAgo = new Date(Date.now() - 36e5).toISOString();
    const [cfg, sub, msgs, waiting, recent] = await Promise.all([
      a.from("ai_agents").select("*").eq("workspace_id", c.workspace_id).maybeSingle(),
      a.from("subscriptions").select("plan, status, trial_ends_at").eq("workspace_id", c.workspace_id).maybeSingle(),
      a.from("messages").select("direction, body, by_ai").eq("conversation_id", conversationId).order("sent_at", { ascending: false }).limit(30),
      a.from("robot_runs").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId).eq("status", "waiting"),
      a.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId).eq("by_ai", true).gte("sent_at", hourAgo),
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
