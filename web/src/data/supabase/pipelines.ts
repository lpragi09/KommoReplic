import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { userClient } from "@/lib/supabase/clients";
import { DomainError, type ID, type Pipeline, type Stage, type StageColor } from "../types";

/* Funis e etapas no Supabase. A RLS já deixa só administradores escreverem (policy admin_write). */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Só administradores podem mudar funis e etapas.");
    if (r.error.code === "23514") throw new DomainError("invalid", "Nome grande demais.");
    throw new Error(r.error.message);
  }
  return r.data;
}
const toStage = (r: Row): Stage => ({ id: r.id, pipelineId: r.pipeline_id, name: r.name, color: r.color, kind: r.kind, sort: r.sort });
const COLORS: StageColor[] = ["1", "2", "3", "4", "5", "6", "7", "8"];

export async function createPipeline(wsId: ID, name: string): Promise<Pipeline> {
  const sb = await userClient();
  const last = check(await sb.from("pipelines").select("sort").eq("workspace_id", wsId).order("sort", { ascending: false }).limit(1));
  const p = check(await sb.from("pipelines").insert({ workspace_id: wsId, name, sort: (last[0]?.sort ?? 0) + 1 }).select("*").single());
  const base = [
    ["Primeiro contato", "2", "open", 0],
    ["Qualificado", "4", "open", 1],
    ["Proposta enviada", "6", "open", 2],
    ["Negociação", "8", "open", 3],
    ["Ganho", "won", "won", 90],
    ["Perdido", "lost", "lost", 91],
  ] as const;
  const stages = check(
    await sb
      .from("stages")
      .insert(base.map(([n, color, kind, sort]) => ({ workspace_id: wsId, pipeline_id: p.id, name: n, color, kind, sort })))
      .select("*"),
  );
  return { id: p.id, workspaceId: wsId, name: p.name, sort: p.sort, stages: stages.map(toStage) };
}

export async function renamePipeline(wsId: ID, id: ID, name: string) {
  const sb = await userClient();
  const r = check(await sb.from("pipelines").update({ name }).eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem mudar funis e etapas.");
}

/** "apaga" arquivando: some da tela; só sem leads ativos e se não for o último funil */
export async function deletePipeline(wsId: ID, id: ID) {
  const sb = await userClient();
  const all = check(await sb.from("pipelines").select("id").eq("workspace_id", wsId).eq("is_archived", false));
  if (all.length <= 1) throw new DomainError("invalid", "Este é o único funil. Crie outro antes de excluir.");
  const { count } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("pipeline_id", id).is("deleted_at", null);
  if (count) throw new DomainError("invalid", `Este funil tem ${count} ${count === 1 ? "lead" : "leads"}. Mova ou exclua antes de apagar o funil.`);
  const r = check(await sb.from("pipelines").update({ is_archived: true }).eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem mudar funis e etapas.");
}

export async function addStage(wsId: ID, pipelineId: ID, name: string): Promise<Stage> {
  const sb = await userClient();
  const open = check(await sb.from("stages").select("sort").eq("pipeline_id", pipelineId).eq("workspace_id", wsId).eq("kind", "open").order("sort"));
  if (open.length >= 20) throw new DomainError("invalid", "Um funil pode ter até 20 etapas.");
  const sort = Math.max(-1, ...open.map((s: Row) => s.sort)) + 1;
  return toStage(check(await sb.from("stages").insert({ workspace_id: wsId, pipeline_id: pipelineId, name, color: COLORS[open.length % COLORS.length], kind: "open", sort }).select("*").single()));
}

export async function updateStage(wsId: ID, stageId: ID, patch: { name?: string; color?: StageColor }) {
  const sb = await userClient();
  const s = check(await sb.from("stages").select("kind").eq("id", stageId).eq("workspace_id", wsId).maybeSingle());
  if (!s) throw new DomainError("not_found");
  const row: Row = {};
  if (patch.name) row.name = patch.name;
  if (patch.color && s.kind === "open") row.color = patch.color;
  const r = check(await sb.from("stages").update(row).eq("id", stageId).eq("workspace_id", wsId).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem mudar funis e etapas.");
}

export async function deleteStage(wsId: ID, stageId: ID, moveTo?: ID | null) {
  const sb = await userClient();
  const s = check(await sb.from("stages").select("*").eq("id", stageId).eq("workspace_id", wsId).maybeSingle());
  if (!s) throw new DomainError("not_found");
  if (s.kind !== "open") throw new DomainError("invalid", "As etapas de ganho e perda são fixas.");
  const open: Row[] = check(await sb.from("stages").select("id, sort").eq("pipeline_id", s.pipeline_id).eq("kind", "open").order("sort"));
  if (open.length <= 1) throw new DomainError("invalid", "O funil precisa de pelo menos uma etapa.");
  const i = open.findIndex((x) => x.id === stageId);
  const target = (moveTo && open.find((x) => x.id === moveTo && x.id !== stageId)) || open[i - 1] || open[i + 1];
  // leads (inclusive os excluídos, que ainda apontam para a etapa) vão para a etapa de destino
  check(await sb.from("leads").update({ stage_id: target.id }).eq("stage_id", stageId).eq("workspace_id", wsId));
  check(await sb.from("stages").delete().eq("id", stageId).eq("workspace_id", wsId));
  return target.id as string;
}
