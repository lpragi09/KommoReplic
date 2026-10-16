import "server-only";
import { connection } from "next/server";
import { db, hash, now, uid } from "./store";
import { renderText } from "../robots/engine";
import {
  DomainError,
  type Broadcast,
  type BroadcastFilter,
  type CalendarMark,
  type CustomField,
  type MarkColor,
  type FieldValue,
  type ID,
  type Member,
  type Message,
  type Role,
  type TeamMessage,
} from "../types";

/* Equipe, campos personalizados, chat da equipe e disparos — banco em memória. */

const ROLES: Role[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Admin", isAdmin: true },
  { id: "00000000-0000-4000-8000-000000000002", name: "Gerente", isAdmin: false },
  { id: "00000000-0000-4000-8000-000000000003", name: "Vendedor", isAdmin: false },
];
const roleOf = (m: { role: "admin" | "member"; roleKey?: "gerente" | "vendedor" }) => (m.role === "admin" ? ROLES[0] : m.roleKey === "gerente" ? ROLES[1] : ROLES[2]);

function assertAdmin(wsId: ID, actor: ID) {
  const m = db.memberships.find((x) => x.workspaceId === wsId && x.userId === actor);
  if (!m || m.role !== "admin") throw new DomainError("forbidden", "Só administradores podem mexer na equipe.");
}

// ---------------------------------------------------------------------------
// equipe
// ---------------------------------------------------------------------------
export async function listMembers(wsId: ID): Promise<{ roles: Role[]; members: Member[] }> {
  await connection();
  const members = db.memberships
    .filter((m) => m.workspaceId === wsId)
    .map((m) => {
      const u = db.users.find((x) => x.id === m.userId)!;
      const r = roleOf(m);
      return { userId: u.id, name: u.name, email: u.email, roleId: r.id, roleName: r.name, isAdmin: r.isAdmin };
    })
    .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, "pt-BR"));
  return { roles: ROLES, members };
}

export async function addMember(wsId: ID, actor: ID, input: { name: string; email: string; password: string; roleId: ID }) {
  assertAdmin(wsId, actor);
  const email = input.email.trim().toLowerCase();
  let u = db.users.find((x) => x.email === email);
  if (!u) {
    u = { id: uid(), name: input.name.trim(), email, passwordHash: hash(input.password) };
    db.users.push(u);
  }
  if (db.memberships.some((m) => m.workspaceId === wsId && m.userId === u!.id)) throw new DomainError("invalid", "Essa pessoa já está na equipe.");
  const r = ROLES.find((x) => x.id === input.roleId) ?? ROLES[2];
  db.memberships.push({ workspaceId: wsId, userId: u.id, role: r.isAdmin ? "admin" : "member", roleKey: r.isAdmin ? undefined : r.id === ROLES[1].id ? "gerente" : "vendedor" });
}

export async function setMemberRole(wsId: ID, actor: ID, userId: ID, roleId: ID) {
  assertAdmin(wsId, actor);
  const m = db.memberships.find((x) => x.workspaceId === wsId && x.userId === userId);
  if (!m) throw new DomainError("not_found");
  const r = ROLES.find((x) => x.id === roleId);
  if (!r) throw new DomainError("invalid", "Papel inválido.");
  if (m.role === "admin" && !r.isAdmin && db.memberships.filter((x) => x.workspaceId === wsId && x.role === "admin").length === 1)
    throw new DomainError("invalid", "A empresa precisa de pelo menos um administrador.");
  m.role = r.isAdmin ? "admin" : "member";
  m.roleKey = r.isAdmin ? undefined : r.id === ROLES[1].id ? "gerente" : "vendedor";
}

export async function removeMember(wsId: ID, actor: ID, userId: ID) {
  assertAdmin(wsId, actor);
  const m = db.memberships.find((x) => x.workspaceId === wsId && x.userId === userId);
  if (!m) return;
  if (m.role === "admin" && db.memberships.filter((x) => x.workspaceId === wsId && x.role === "admin").length === 1)
    throw new DomainError("invalid", "A empresa precisa de pelo menos um administrador.");
  db.memberships = db.memberships.filter((x) => x !== m);
}

// ---------------------------------------------------------------------------
// campos personalizados do lead
// ---------------------------------------------------------------------------
export async function listFields(wsId: ID): Promise<CustomField[]> {
  await connection();
  return db.fields.filter((f) => f.workspaceId === wsId).sort((a, b) => a.sort - b.sort);
}

export async function saveField(wsId: ID, id: ID | null, input: Omit<CustomField, "id" | "sort">): Promise<CustomField> {
  if (id) {
    const f = db.fields.find((x) => x.id === id && x.workspaceId === wsId);
    if (!f) throw new DomainError("not_found");
    Object.assign(f, input);
    return f;
  }
  const f = { ...input, id: uid(), workspaceId: wsId, sort: db.fields.filter((x) => x.workspaceId === wsId).length };
  db.fields.push(f);
  return f;
}

export async function deleteField(wsId: ID, id: ID) {
  db.fields = db.fields.filter((x) => !(x.id === id && x.workspaceId === wsId));
}

export async function getLeadCustom(wsId: ID, leadId: ID): Promise<Record<string, FieldValue>> {
  await connection();
  if (!db.leads.some((l) => l.id === leadId && l.workspaceId === wsId)) throw new DomainError("not_found");
  return { ...(db.leadCustom[leadId] ?? {}) };
}

export async function setLeadCustom(wsId: ID, _actor: ID, leadId: ID, fieldId: ID, value: FieldValue) {
  const l = db.leads.find((x) => x.id === leadId && x.workspaceId === wsId);
  if (!l) throw new DomainError("not_found");
  const cur = (db.leadCustom[leadId] ??= {});
  if (value === null || value === "") delete cur[fieldId];
  else cur[fieldId] = value;
  l.lastActivityAt = now();
}

// ---------------------------------------------------------------------------
// chat da equipe
// ---------------------------------------------------------------------------
export async function listTeamMessages(wsId: ID): Promise<TeamMessage[]> {
  await connection();
  return db.teamMessages
    .filter((m) => m.workspaceId === wsId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-200)
    .map(({ workspaceId: _w, ...m }) => ({ ...m, userName: db.users.find((u) => u.id === m.userId)?.name ?? "Alguém" }));
}

export async function sendTeamMessage(wsId: ID, actor: ID, body: string) {
  if (!body.trim()) throw new DomainError("invalid", "A mensagem está vazia.");
  db.teamMessages.push({ id: uid(), workspaceId: wsId, userId: actor, body: body.trim(), createdAt: now() });
}

// ---------------------------------------------------------------------------
// disparos
// ---------------------------------------------------------------------------
function audience(wsId: ID, f: BroadcastFilter) {
  return db.leads
    .filter(
      (l) =>
        l.workspaceId === wsId &&
        (!f.pipelineId || l.pipelineId === f.pipelineId) &&
        (!f.stageIds.length || f.stageIds.includes(l.stageId)) &&
        (!f.tag || l.tags.includes(f.tag)),
    )
    .map((l) => {
      const conv = db.conversations.find((c) => c.leadId === l.id);
      const ch = conv ? db.channels.find((c) => c.id === conv.channelId) : undefined;
      const link = db.leadContacts.find((x) => x.leadId === l.id && x.isMain) ?? db.leadContacts.find((x) => x.leadId === l.id);
      const contact = db.contacts.find((c) => c.id === (conv?.contactId ?? link?.contactId));
      return { lead: l, conv, kind: ch?.kind ?? null, contactName: contact?.name ?? "", responsible: db.users.find((u) => u.id === l.responsibleUserId)?.name ?? "" };
    })
    .filter((x) => !f.channels.length || (x.kind && f.channels.includes(x.kind)));
}

export async function previewBroadcast(wsId: ID, f: BroadcastFilter) {
  await connection();
  const a = audience(wsId, f);
  return { leads: a.length, reachable: a.filter((x) => x.conv).length };
}

export async function sendBroadcast(wsId: ID, actor: ID, input: { name: string; body: string; filter: BroadcastFilter }): Promise<Broadcast> {
  const ws = db.workspaces.find((w) => w.id === wsId)!;
  let sent = 0;
  let failed = 0;
  const targets = audience(wsId, input.filter);
  for (const t of targets) {
    if (!t.conv || !t.kind) {
      failed++;
      continue;
    }
    if (t.kind === "whatsapp" && (!t.conv.lastInboundAt || Date.now() - Date.parse(t.conv.lastInboundAt) > 864e5)) {
      failed++; // fora da janela de 24h: WhatsApp só aceita modelo aprovado
      continue;
    }
    const text = renderText(input.body, { wsName: ws.name, lead: t.lead, contactName: t.contactName, conversation: t.conv, channelKind: t.kind, responsibleName: t.responsible });
    const m: Message = { id: uid(), conversationId: t.conv.id, direction: "out", body: text, senderUserId: actor, clientId: null, status: t.kind === "webchat" ? "sent" : "queued", sentAt: now() };
    db.messages.push(m);
    Object.assign(t.conv, { lastMessageAt: m.sentAt, lastMessagePreview: text, isUnanswered: false });
    sent++;
  }
  const b = { id: uid(), workspaceId: wsId, name: input.name.trim(), body: input.body.trim(), filter: input.filter, total: targets.length, sent, failed, createdBy: actor, createdAt: now() };
  db.broadcasts.push(b);
  return { ...b, createdBy: db.users.find((u) => u.id === actor)?.name ?? "" };
}

export async function listBroadcasts(wsId: ID): Promise<Broadcast[]> {
  await connection();
  return db.broadcasts
    .filter((b) => b.workspaceId === wsId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ workspaceId: _w, ...b }) => ({ ...b, createdBy: db.users.find((u) => u.id === b.createdBy)?.name ?? "" }));
}

// ---------------------------------------------------------------------------
// marcações do calendário
// ---------------------------------------------------------------------------
type MarkRow = CalendarMark & { workspaceId: string };
const gm = globalThis as unknown as { __crmMarks?: MarkRow[] };
const marks = (gm.__crmMarks ??= []);

export async function listMarks(wsId: ID, from: string, to: string): Promise<CalendarMark[]> {
  await connection();
  return marks.filter((m) => m.workspaceId === wsId && m.date >= from && m.date <= to).map(({ workspaceId: _w, ...m }) => m);
}

export async function saveMark(wsId: ID, actor: ID, id: ID | null, input: { date: string; label: string; color: MarkColor; note: string | null }): Promise<CalendarMark> {
  if (id) {
    const m = marks.find((x) => x.id === id && x.workspaceId === wsId);
    if (!m) throw new DomainError("not_found");
    Object.assign(m, input);
    return m;
  }
  const m: MarkRow = { ...input, id: uid(), workspaceId: wsId, createdBy: db.users.find((u) => u.id === actor)?.name ?? "" };
  marks.push(m);
  return m;
}

export async function deleteMark(wsId: ID, id: ID) {
  const i = marks.findIndex((x) => x.id === id && x.workspaceId === wsId);
  if (i >= 0) marks.splice(i, 1);
}
