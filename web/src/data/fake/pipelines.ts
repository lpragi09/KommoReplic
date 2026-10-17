import "server-only";
import { db, defaultStages, uid } from "./store";
import { DomainError, type ID, type Pipeline, type Stage, type StageColor } from "../types";

/* Funis e etapas no banco em memória (mesmas regras do Supabase). */

const COLORS: StageColor[] = ["1", "2", "3", "4", "5", "6", "7", "8"];

function pipe(wsId: ID, id: ID) {
  const p = db.pipelines.find((x) => x.id === id && x.workspaceId === wsId);
  if (!p) throw new DomainError("not_found");
  return p;
}

export async function createPipeline(wsId: ID, name: string): Promise<Pipeline> {
  const id = uid();
  const p: Pipeline = { id, workspaceId: wsId, name, sort: Math.max(0, ...db.pipelines.filter((x) => x.workspaceId === wsId).map((x) => x.sort)) + 1, stages: defaultStages(id) };
  db.pipelines.push(p);
  return p;
}

export async function renamePipeline(wsId: ID, id: ID, name: string) {
  pipe(wsId, id).name = name;
}

export async function deletePipeline(wsId: ID, id: ID) {
  pipe(wsId, id);
  if (db.pipelines.filter((x) => x.workspaceId === wsId).length <= 1) throw new DomainError("invalid", "Este é o único funil. Crie outro antes de excluir.");
  const n = db.leads.filter((l) => l.pipelineId === id).length;
  if (n) throw new DomainError("invalid", `Este funil tem ${n} ${n === 1 ? "lead" : "leads"}. Mova ou exclua antes de apagar o funil.`);
  db.pipelines = db.pipelines.filter((x) => x.id !== id);
}

export async function addStage(wsId: ID, pipelineId: ID, name: string): Promise<Stage> {
  const p = pipe(wsId, pipelineId);
  const open = p.stages.filter((s) => s.kind === "open");
  if (open.length >= 20) throw new DomainError("invalid", "Um funil pode ter até 20 etapas.");
  const sort = Math.max(-1, ...open.map((s) => s.sort)) + 1;
  const s = { id: uid(), pipelineId, name, color: COLORS[open.length % COLORS.length], kind: "open" as const, sort };
  p.stages.push(s);
  return s;
}

export async function updateStage(wsId: ID, stageId: ID, patch: { name?: string; color?: StageColor }) {
  const s = db.pipelines.filter((p) => p.workspaceId === wsId).flatMap((p) => p.stages).find((x) => x.id === stageId);
  if (!s) throw new DomainError("not_found");
  if (patch.name) s.name = patch.name;
  if (patch.color && s.kind === "open") s.color = patch.color;
}

/** apaga uma etapa aberta; os leads dela vão para `moveTo` (ou para a etapa anterior) */
export async function deleteStage(wsId: ID, stageId: ID, moveTo?: ID | null) {
  const p = db.pipelines.find((x) => x.workspaceId === wsId && x.stages.some((s) => s.id === stageId));
  const s = p?.stages.find((x) => x.id === stageId);
  if (!p || !s) throw new DomainError("not_found");
  if (s.kind !== "open") throw new DomainError("invalid", "As etapas de ganho e perda são fixas.");
  const open = p.stages.filter((x) => x.kind === "open").sort((a, b) => a.sort - b.sort);
  if (open.length <= 1) throw new DomainError("invalid", "O funil precisa de pelo menos uma etapa.");
  const i = open.findIndex((x) => x.id === stageId);
  const target = (moveTo && open.find((x) => x.id === moveTo && x.id !== stageId)) || open[i - 1] || open[i + 1];
  for (const l of db.leads) if (l.stageId === stageId) l.stageId = target.id;
  p.stages = p.stages.filter((x) => x.id !== stageId);
  return target.id;
}
