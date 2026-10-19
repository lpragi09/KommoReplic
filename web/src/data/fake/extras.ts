import "server-only";
import { connection } from "next/server";
import { randomBytes } from "node:crypto";
import { db, hash, now, uid } from "./store";
import { renderText } from "../robots/engine";
import { marketingEmail, sendEmailBatch, type OutEmail } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { kindOf } from "@/lib/attachments";
import {
  DomainError,
  type Broadcast,
  type BroadcastFilter,
  type CalendarMark,
  type CustomField,
  type MarkColor,
  type FieldValue,
  type ID,
  type Invite,
  type InviteInfo,
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

/** cria o acesso de alguém novo; quem já tem conta só entra por convite (a pessoa aceita) */
export async function addMember(wsId: ID, actor: ID, input: { name: string; email: string; password: string; roleId: ID }) {
  assertAdmin(wsId, actor);
  const email = input.email.trim().toLowerCase();
  const existing = db.users.find((x) => x.email === email);
  if (existing && db.memberships.some((m) => m.workspaceId === wsId && m.userId === existing.id)) throw new DomainError("invalid", "Essa pessoa já está na equipe.");
  if (existing) throw new DomainError("invalid", "Esse email já tem conta. Use “Convidar por link”: a pessoa aceita com a conta dela.");
  const u = { id: uid(), name: input.name.trim(), email, passwordHash: hash(input.password) };
  db.users.push(u);
  join(wsId, u.id, input.roleId);
}

function join(wsId: ID, userId: ID, roleId: ID) {
  const r = ROLES.find((x) => x.id === roleId) ?? ROLES[2];
  db.memberships.push({ workspaceId: wsId, userId, role: r.isAdmin ? "admin" : "member", roleKey: r.isAdmin ? undefined : r.id === ROLES[1].id ? "gerente" : "vendedor" });
}

// ---------------------------------------------------------------------------
// convites por link (o link leva um token; aqui só fica o hash)
// ---------------------------------------------------------------------------
type InviteRow = { id: ID; workspaceId: ID; email: string; roleId: ID; tokenHash: string; expiresAt: string; acceptedAt: string | null };
const gi = globalThis as unknown as { __crmInvites?: InviteRow[] };
const invites = (gi.__crmInvites ??= []);

export async function createInvite(wsId: ID, actor: ID, input: { email: string; roleId: ID }) {
  assertAdmin(wsId, actor);
  const email = input.email.trim().toLowerCase();
  const u = db.users.find((x) => x.email === email);
  if (u && db.memberships.some((m) => m.workspaceId === wsId && m.userId === u.id)) throw new DomainError("invalid", "Essa pessoa já está na equipe.");
  if (!ROLES.some((r) => r.id === input.roleId)) throw new DomainError("invalid", "Papel inválido.");
  // um convite aberto por email: gerar de novo troca o link
  for (let i = invites.length - 1; i >= 0; i--) if (invites[i].workspaceId === wsId && invites[i].email === email && !invites[i].acceptedAt) invites.splice(i, 1);
  const token = randomBytes(24).toString("base64url");
  invites.push({ id: uid(), workspaceId: wsId, email, roleId: input.roleId, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), acceptedAt: null });
  return { token };
}

export async function listInvites(wsId: ID): Promise<Invite[]> {
  await connection();
  return invites
    .filter((i) => i.workspaceId === wsId && !i.acceptedAt && i.expiresAt > now())
    .map((i) => ({ id: i.id, email: i.email, roleId: i.roleId, roleName: ROLES.find((r) => r.id === i.roleId)?.name ?? "", expiresAt: i.expiresAt }));
}

export async function revokeInvite(wsId: ID, actor: ID, id: ID) {
  assertAdmin(wsId, actor);
  const i = invites.findIndex((x) => x.id === id && x.workspaceId === wsId);
  if (i >= 0) invites.splice(i, 1);
}

function inviteByToken(token: string) {
  return invites.find((i) => i.tokenHash === hash(token)) ?? null;
}

export async function getInvite(token: string): Promise<InviteInfo | null> {
  await connection();
  const i = inviteByToken(token);
  const ws = i && db.workspaces.find((w) => w.id === i.workspaceId);
  if (!i || !ws) return null;
  return { workspaceName: ws.name, workspaceSlug: ws.slug, email: i.email, roleName: ROLES.find((r) => r.id === i.roleId)?.name ?? "", state: i.acceptedAt ? "accepted" : i.expiresAt < now() ? "expired" : "ok" };
}

function openInvite(token: string) {
  const i = inviteByToken(token);
  if (!i || i.acceptedAt || i.expiresAt < now()) throw new DomainError("invalid", "Este convite não vale mais. Peça um link novo para quem convidou.");
  return i;
}

/** quem já tem conta (e está logado com o email do convite) entra na equipe */
export async function acceptInvite(token: string, userId: ID) {
  const i = openInvite(token);
  const u = db.users.find((x) => x.id === userId);
  if (!u || u.email !== i.email) throw new DomainError("invalid", `Este convite é para ${i.email}. Entre com essa conta para aceitar.`);
  if (!db.memberships.some((m) => m.workspaceId === i.workspaceId && m.userId === userId)) join(i.workspaceId, userId, i.roleId);
  i.acceptedAt = now();
  return { slug: db.workspaces.find((w) => w.id === i.workspaceId)!.slug };
}

/** quem ainda não tem conta cria a senha no próprio convite (o email é o do convite) */
export async function acceptInviteNewAccount(token: string, input: { name: string; password: string }) {
  const i = openInvite(token);
  if (db.users.some((x) => x.email === i.email)) throw new DomainError("invalid", "Esse email já tem conta. Entre com ela para aceitar o convite.");
  const u = { id: uid(), name: input.name.trim(), email: i.email, passwordHash: hash(input.password) };
  db.users.push(u);
  join(i.workspaceId, u.id, i.roleId);
  i.acceptedAt = now();
  return { slug: db.workspaces.find((w) => w.id === i.workspaceId)!.slug, email: i.email };
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

/** arquivo no chat da equipe: no banco em memória vira data URL (demonstração) */
export async function sendTeamAttachment(wsId: ID, actor: ID, file: { name: string; mime: string; bytes: Uint8Array }, caption: string) {
  const kind = kindOf(file.mime);
  if (!kind) throw new DomainError("invalid", "Esse tipo de arquivo não é aceito.");
  const body = caption.trim() || { image: "[foto]", audio: "[áudio]", video: "[vídeo]", file: "[arquivo]" }[kind];
  const url = `data:${file.mime};base64,${Buffer.from(file.bytes).toString("base64")}`;
  db.teamMessages.push({ id: uid(), workspaceId: wsId, userId: actor, body, createdAt: now(), kind, file: { id: uid(), name: file.name.slice(0, 200), mime: file.mime, size: file.bytes.byteLength, url } });
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
      const mainContact = db.contacts.find((c) => c.id === link?.contactId) ?? contact;
      return {
        lead: l,
        conv,
        kind: ch?.kind ?? null,
        contactName: contact?.name ?? "",
        responsible: db.users.find((u) => u.id === l.responsibleUserId)?.name ?? "",
        contactId: mainContact?.id ?? null,
        email: mainContact?.identities.find((i) => i.kind === "email")?.value ?? null,
        optOut: !!mainContact?.emailOptOut,
      };
    })
    .filter((x) => !f.channels.length || (x.kind && f.channels.includes(x.kind)));
}

export async function previewBroadcast(wsId: ID, f: BroadcastFilter) {
  await connection();
  const a = audience(wsId, f);
  return { leads: a.length, reachable: a.filter((x) => x.conv).length, emails: a.filter((x) => x.email && !x.optOut).length };
}

export async function sendBroadcast(wsId: ID, actor: ID, input: { name: string; body: string; filter: BroadcastFilter; medium?: "message" | "email"; subject?: string }): Promise<Broadcast> {
  const ws = db.workspaces.find((w) => w.id === wsId)!;
  let sent = 0;
  let failed = 0;
  const targets = audience(wsId, input.filter);
  if (input.medium === "email") {
    const out: OutEmail[] = [];
    for (const t of targets) {
      if (!t.email || t.optOut) continue;
      const ctx = { wsName: ws.name, lead: t.lead, contactName: t.contactName, conversation: null, channelKind: null, responsibleName: t.responsible };
      const unsub = t.contactId ? unsubscribeUrl(t.contactId) : null;
      out.push({ to: t.email, subject: renderText(input.subject ?? "", ctx) || ws.name, ...marketingEmail({ company: ws.name, text: renderText(input.body, ctx), unsubscribe: unsub }), unsubscribe: unsub });
    }
    sent = await sendEmailBatch(out);
    failed = targets.length - sent;
  }
  for (const t of input.medium === "email" ? [] : targets) {
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
  const b = { id: uid(), workspaceId: wsId, name: input.name.trim(), body: input.body.trim(), filter: input.filter, total: targets.length, sent, failed, createdBy: actor, createdAt: now(), medium: input.medium ?? "message", subject: input.subject?.trim() || null };
  db.broadcasts.push(b);
  return { ...b, createdBy: db.users.find((u) => u.id === actor)?.name ?? "" };
}

export async function optOutContact(contactId: ID): Promise<{ workspaceName: string } | null> {
  const c = db.contacts.find((x) => x.id === contactId);
  if (!c) return null;
  c.emailOptOut = true;
  return { workspaceName: db.workspaces.find((w) => w.id === c.workspaceId)?.name ?? "" };
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
