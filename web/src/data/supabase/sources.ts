import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { routeFor } from "@/lib/routing";
import { DomainError, type ID, type SourceRule } from "../types";

/* Fontes de cada funil (regras de entrada e canal padrão) — Supabase.
   A tela usa a sessão (RLS: membro lê, admin altera); a mensagem que chega pelo webhook usa a chave secreta. */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42P01") throw new DomainError("invalid", "Rode a atualização do banco (atualizacao-fontes-funil.sql) para usar regras de entrada.");
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Só administradores mudam as fontes do funil.");
    throw new Error(r.error.message);
  }
  return r.data;
}

const toRule = (r: Row): SourceRule => ({ id: r.id, pipelineId: r.pipeline_id, channelId: r.channel_id, match: r.match, value: r.value, matched: r.matched, createdAt: r.created_at });

export async function listSourceRules(wsId: ID): Promise<SourceRule[]> {
  const sb = await userClient();
  const { data, error } = await sb.from("source_rules").select("*").eq("workspace_id", wsId).order("created_at");
  if (error) return []; // banco sem a atualização: o painel abre sem regras
  return (data ?? []).map(toRule);
}

export async function saveSourceRule(wsId: ID, input: Pick<SourceRule, "pipelineId" | "channelId" | "match" | "value">): Promise<SourceRule> {
  const sb = await userClient();
  // funil e canal precisam ser desta empresa (o RLS só confere a empresa da regra)
  if (!check(await sb.from("pipelines").select("id").eq("workspace_id", wsId).eq("id", input.pipelineId).maybeSingle())) throw new DomainError("not_found");
  if (input.channelId && !check(await sb.from("channels").select("id").eq("workspace_id", wsId).eq("id", input.channelId).maybeSingle())) throw new DomainError("not_found");
  const row = check(
    await sb.from("source_rules").insert({ workspace_id: wsId, pipeline_id: input.pipelineId, channel_id: input.channelId, match: input.match, value: input.value }).select("*").single(),
  );
  return toRule(row);
}

export async function deleteSourceRule(wsId: ID, id: ID) {
  const sb = await userClient();
  const r = check(await sb.from("source_rules").delete().eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r?.length) throw new DomainError("forbidden", "Só administradores mudam as fontes do funil.");
}

/** canal passa a mandar os contatos novos para este funil (o padrão dele) */
export async function setChannelPipeline(wsId: ID, channelId: ID, pipelineId: ID) {
  const sb = await userClient();
  if (!check(await sb.from("pipelines").select("id").eq("workspace_id", wsId).eq("id", pipelineId).maybeSingle())) throw new DomainError("not_found");
  const r = check(await sb.from("channels").update({ default_pipeline_id: pipelineId }).eq("workspace_id", wsId).eq("id", channelId).select("id"));
  if (!r?.length) throw new DomainError("forbidden", "Só administradores mudam as fontes do funil.");
}

/** contato novo ainda na coluna de entrada: vai para o funil da regra que bater */
export async function routeInbound(conversationId: ID, body: string) {
  const a = adminClient();
  const conv = (await a.from("conversations").select("workspace_id, channel_id, attribution").eq("id", conversationId).maybeSingle()).data;
  if (!conv) return;
  const { data: list, error } = await a.from("source_rules").select("*").eq("workspace_id", conv.workspace_id);
  if (error || !list?.length) return; // sem regras (ou banco sem a atualização): fica no funil padrão do canal
  const rule = routeFor(list.map(toRule), { channelId: conv.channel_id, body, attribution: conv.attribution ?? null });
  if (!rule) return;
  const moved = (await a.from("incoming_leads").update({ pipeline_id: rule.pipelineId }).eq("conversation_id", conversationId).eq("status", "pending").select("id")).data;
  if (moved?.length) await a.from("source_rules").update({ matched: rule.matched + 1 }).eq("id", rule.id);
}
