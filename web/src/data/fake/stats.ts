import "server-only";
import { connection } from "next/server";
import { db, now, uid } from "./store";
import { DomainError, type ActivityEvent, type ID, type MessageStats, type RoiReport, type SalesGoal } from "../types";

type Store = { goals: Map<string, SalesGoal[]>; roi: (RoiReport & { workspaceId: string })[] };

/* Estatísticas no banco em memória: registro de atividade, mensagens por canal, metas e ROI. */

const g = globalThis as unknown as { __crmStats?: Store };
const store: Store = (g.__crmStats ??= { goals: new Map(), roi: [] });

const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

export async function getActivity(wsId: ID, from: string): Promise<ActivityEvent[]> {
  await connection();
  const leads = new Set(db.leads.filter((l) => l.workspaceId === wsId).map((l) => l.id));
  const out: ActivityEvent[] = [];
  for (const e of db.events) {
    if (!leads.has(e.leadId) || e.createdAt < from || e.kind === "task_completed") continue;
    const b = e.before ?? {};
    const a = e.after ?? {};
    out.push({
      id: e.id,
      at: e.createdAt,
      kind: e.kind,
      leadId: e.leadId,
      actorUserId: e.actorUserId || null,
      stageFrom: str(b.stageId),
      stageTo: str(a.stageId),
      userFrom: str(b.userId),
      userTo: str(a.userId),
      centsFrom: num(b.priceCents),
      centsTo: num(a.priceCents),
      nameFrom: str(b.name),
      nameTo: str(a.name),
      robot: str(a.robot),
      text: str(a.text),
    });
  }
  for (const n of db.notes) if (n.leadId && leads.has(n.leadId) && n.createdAt >= from) out.push({ id: n.id, at: n.createdAt, kind: "note_added", leadId: n.leadId, actorUserId: n.createdBy || null, text: n.body });
  for (const t of db.tasks) {
    if (t.workspaceId !== wsId) continue;
    if (t.createdAt >= from) out.push({ id: `${t.id}:c`, at: t.createdAt, kind: "task_created", leadId: t.leadId, actorUserId: t.responsibleUserId, text: t.text });
    if (t.completedAt && t.completedAt >= from) out.push({ id: `${t.id}:d`, at: t.completedAt, kind: "task_done", leadId: t.leadId, actorUserId: t.responsibleUserId, text: t.text });
  }
  return out.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 5000);
}

export async function getMessageStats(wsId: ID, from: string): Promise<MessageStats[]> {
  await connection();
  const conv = new Map(db.conversations.filter((c) => c.workspaceId === wsId).map((c) => [c.id, c]));
  const kindOf = new Map(db.channels.filter((c) => c.workspaceId === wsId).map((c) => [c.id, c.kind]));
  const by = new Map<string, MessageStats>();
  for (const m of db.messages) {
    const c = conv.get(m.conversationId);
    if (!c || m.sentAt < from) continue;
    const kind = kindOf.get(c.channelId);
    if (!kind) continue;
    const s = by.get(kind) ?? { kind, received: 0, sent: 0, delivered: 0, read: 0, failed: 0, byAi: 0 };
    if (m.direction === "in") s.received++;
    else {
      s.sent++;
      if (m.status === "delivered" || m.status === "read") s.delivered++;
      if (m.status === "read") s.read++;
      if (m.status === "failed") s.failed++;
      if (m.byAi) s.byAi++;
    }
    by.set(kind, s);
  }
  return [...by.values()];
}

export async function listGoals(wsId: ID, month: string): Promise<SalesGoal[]> {
  await connection();
  return store.goals.get(`${wsId}:${month}`) ?? [];
}

export async function saveGoals(wsId: ID, month: string, goals: SalesGoal[]) {
  store.goals.set(
    `${wsId}:${month}`,
    goals.filter((x) => x.cents > 0 || x.count > 0),
  );
}

export async function listRoiReports(wsId: ID): Promise<RoiReport[]> {
  await connection();
  return store.roi.filter((r) => r.workspaceId === wsId).map(({ workspaceId: _w, ...r }) => r);
}

export async function saveRoiReport(wsId: ID, id: ID | null, input: Omit<RoiReport, "id" | "createdAt">): Promise<RoiReport> {
  if (id) {
    const r = store.roi.find((x) => x.id === id && x.workspaceId === wsId);
    if (!r) throw new DomainError("not_found");
    Object.assign(r, input);
    return r;
  }
  if (store.roi.filter((x) => x.workspaceId === wsId).length >= 25) throw new DomainError("invalid", "Dá para ter até 25 relatórios de ROI. Apague um antigo.");
  const r = { ...input, id: uid(), workspaceId: wsId, createdAt: now() };
  store.roi.push(r);
  return r;
}

export async function deleteRoiReport(wsId: ID, id: ID) {
  store.roi = store.roi.filter((x) => !(x.id === id && x.workspaceId === wsId));
}
