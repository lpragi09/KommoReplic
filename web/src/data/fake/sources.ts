import "server-only";
import { connection } from "next/server";
import { db, now, uid } from "./store";
import { routeFor } from "@/lib/routing";
import { DomainError, type ID, type SourceRule } from "../types";

/* Fontes de cada funil (regras de entrada e canal padrão) — banco em memória. */

type RuleRow = SourceRule & { workspaceId: string };
const g = globalThis as unknown as { __crmRules?: RuleRow[] };
const rules = (g.__crmRules ??= []);

export async function listSourceRules(wsId: ID): Promise<SourceRule[]> {
  await connection();
  return rules.filter((r) => r.workspaceId === wsId).map(({ workspaceId: _w, ...r }) => r);
}

export async function saveSourceRule(wsId: ID, input: Pick<SourceRule, "pipelineId" | "channelId" | "match" | "value">): Promise<SourceRule> {
  if (!db.pipelines.some((p) => p.id === input.pipelineId && p.workspaceId === wsId)) throw new DomainError("not_found");
  if (input.channelId && !db.channels.some((c) => c.id === input.channelId && c.workspaceId === wsId)) throw new DomainError("not_found");
  const row: RuleRow = { ...input, id: uid(), workspaceId: wsId, matched: 0, createdAt: now() };
  rules.push(row);
  const { workspaceId: _w, ...r } = row;
  return r;
}

export async function deleteSourceRule(wsId: ID, id: ID) {
  const i = rules.findIndex((r) => r.id === id && r.workspaceId === wsId);
  if (i < 0) throw new DomainError("not_found");
  rules.splice(i, 1);
}

/** canal passa a mandar os contatos novos para este funil (o padrão dele) */
export async function setChannelPipeline(wsId: ID, channelId: ID, pipelineId: ID) {
  const ch = db.channels.find((c) => c.id === channelId && c.workspaceId === wsId);
  if (!ch || !db.pipelines.some((p) => p.id === pipelineId && p.workspaceId === wsId)) throw new DomainError("not_found");
  ch.defaultPipelineId = pipelineId;
}

/** contato novo ainda na coluna de entrada: vai para o funil da regra que bater */
export async function routeInbound(conversationId: ID, body: string) {
  const conv = db.conversations.find((c) => c.id === conversationId);
  const inc = conv && db.incoming.find((i) => i.conversationId === conversationId && i.status === "pending");
  if (!conv || !inc) return;
  const rule = routeFor(
    rules.filter((r) => r.workspaceId === conv.workspaceId),
    { channelId: conv.channelId, body, attribution: conv.attribution ?? null },
  );
  if (!rule) return;
  rule.matched += 1;
  inc.pipelineId = rule.pipelineId;
}
