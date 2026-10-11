import "server-only";
import { connection } from "next/server";
import { db, hash, now, seedWorkspaceBasics, uid } from "./store";
import {
  DomainError,
  type ChannelKind,
  type Contact,
  type Conversation,
  type FeedItem,
  type ID,
  type IncomingLead,
  type Lead,
  type LeadCard,
  type LeadEvent,
  type Message,
  type Stage,
  type Task,
  type User,
  type Subscription,
  type Workspace,
} from "../types";

/* Repositório falso. Cada função é a mesma assinatura que a versão Supabase terá
   (src/data/supabase/repo.ts). Permissões por papel ainda NÃO são aplicadas aqui:
   no Supabase quem aplica é o RLS do schema.sql. */

export const MANAGES_OWN_SESSION = false; // sessão própria em cookie (crm_session)

const live = () => connection(); // impede o Next de congelar dados em memória no prerender

// ---------------------------------------------------------------------------
// sessão
// ---------------------------------------------------------------------------
export async function userBySessionToken(token: string | undefined): Promise<User | null> {
  await live();
  const s = token && db.sessions.find((x) => x.token === token);
  if (!s) return null;
  const u = db.users.find((x) => x.id === s.userId);
  return u ? { id: u.id, name: u.name, email: u.email } : null;
}

export async function signIn(email: string, password: string): Promise<string> {
  const addr = email.trim().toLowerCase();
  let u = db.users.find((x) => x.email.toLowerCase() === addr);
  if (!u) {
    // MODO DEMONSTRAÇÃO (só no repositório falso): email novo entra direto, já como admin da "Loja Demo".
    // No Supabase o login exige conta de verdade.
    if (password.length < 1) throw new DomainError("invalid", "Digite a senha.");
    u = { id: uid(), name: addr.split("@")[0], email: addr, passwordHash: hash(password) };
    db.users.push(u);
    const demo = db.workspaces.find((w) => w.slug === "demo");
    if (demo) db.memberships.push({ workspaceId: demo.id, userId: u.id, role: "admin" });
  }
  if (u.passwordHash !== hash(password)) throw new DomainError("invalid", "Email ou senha incorretos.");
  const token = uid();
  db.sessions.push({ token, userId: u.id });
  return token;
}

export async function signUp(name: string, email: string, password: string): Promise<string> {
  if (db.users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase()))
    throw new DomainError("invalid", "Já existe uma conta com esse email.");
  const u = { id: uid(), name: name.trim(), email: email.trim().toLowerCase(), passwordHash: hash(password) };
  db.users.push(u);
  const token = uid();
  db.sessions.push({ token, userId: u.id });
  return token;
}

export async function signOut(token: string) {
  db.sessions = db.sessions.filter((s) => s.token !== token);
}

export async function getSubscription(wsId: ID): Promise<Subscription> {
  await live();
  const ws = db.workspaces.find((w) => w.id === wsId);
  if (!ws) throw new DomainError("not_found");
  return { plan: "trial", status: "trialing", seats: db.memberships.filter((m) => m.workspaceId === wsId).length, stripeCustomerId: null, trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString(), currentPeriodEnd: null };
}

export async function deleteAccount(userId: ID) {
  const mine = db.memberships.filter((m) => m.userId === userId).map((m) => m.workspaceId);
  const solo = mine.filter((ws) => db.memberships.filter((m) => m.workspaceId === ws).length === 1);
  db.workspaces = db.workspaces.filter((w) => !solo.includes(w.id));
  db.memberships = db.memberships.filter((m) => m.userId !== userId && !solo.includes(m.workspaceId));
  db.sessions = db.sessions.filter((s) => s.userId !== userId);
  db.users = db.users.filter((u) => u.id !== userId);
}

export async function workspacesOf(userId: ID): Promise<Workspace[]> {
  await live();
  const ids = db.memberships.filter((m) => m.userId === userId).map((m) => m.workspaceId);
  return db.workspaces.filter((w) => ids.includes(w.id));
}

export async function workspaceForUser(slug: string, userId: ID): Promise<Workspace> {
  await live();
  const ws = db.workspaces.find((w) => w.slug === slug);
  if (!ws) throw new DomainError("not_found");
  if (!db.memberships.some((m) => m.workspaceId === ws.id && m.userId === userId)) throw new DomainError("forbidden");
  return ws;
}

export async function createWorkspace(userId: ID, input: { name: string; slug: string; timezone: string; currency: string }) {
  if (db.workspaces.some((w) => w.slug === input.slug)) throw new DomainError("invalid", "Esse endereço já está em uso.");
  const ws: Workspace = { id: uid(), ...input };
  db.workspaces.push(ws);
  db.memberships.push({ workspaceId: ws.id, userId, role: "admin" });
  seedWorkspaceBasics(db, ws.id);
  return ws;
}

export async function listUsers(wsId: ID): Promise<User[]> {
  await live();
  const ids = db.memberships.filter((m) => m.workspaceId === wsId).map((m) => m.userId);
  return db.users.filter((u) => ids.includes(u.id)).map(({ id, name, email }) => ({ id, name, email }));
}

// ---------------------------------------------------------------------------
// funil
// ---------------------------------------------------------------------------
export async function listPipelines(wsId: ID) {
  await live();
  return db.pipelines.filter((p) => p.workspaceId === wsId).sort((a, b) => a.sort - b.sort);
}

export async function listLossReasons(wsId: ID) {
  await live();
  return db.lossReasons.filter((r) => r.workspaceId === wsId);
}

export async function listTaskTypes(wsId: ID) {
  await live();
  return db.taskTypes.filter((r) => r.workspaceId === wsId);
}

const stageOf = (id: ID): Stage | undefined => db.pipelines.flatMap((p) => p.stages).find((s) => s.id === id);

function toCard(l: Lead): LeadCard {
  const link = db.leadContacts.find((x) => x.leadId === l.id && x.isMain) ?? db.leadContacts.find((x) => x.leadId === l.id);
  const mainContact = link ? (db.contacts.find((c) => c.id === link.contactId) ?? null) : null;
  const conv = db.conversations.find((c) => c.leadId === l.id);
  const channel = conv ? db.channels.find((c) => c.id === conv.channelId) : undefined;
  const taskState = !l.closestTaskAt ? "none" : l.closestTaskAt < now() ? "late" : "ok";
  return { ...l, mainContact, hasUnread: (conv?.unreadCount ?? 0) > 0, channelKind: channel?.kind ?? null, taskState };
}

export type LeadFilter = { q?: string; owner?: ID; tag?: string; task?: "none" | "late" };

function matches(l: Lead, f: LeadFilter) {
  if (f.owner && l.responsibleUserId !== f.owner) return false;
  if (f.tag && !l.tags.includes(f.tag)) return false;
  if (f.task === "none" && l.closestTaskAt) return false;
  if (f.task === "late" && !(l.closestTaskAt && l.closestTaskAt < now())) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const contactNames = db.leadContacts
      .filter((x) => x.leadId === l.id)
      .map((x) => db.contacts.find((c) => c.id === x.contactId)?.name ?? "");
    if (![l.name, `#${l.number}`, ...contactNames].some((s) => s.toLowerCase().includes(q))) return false;
  }
  return true;
}

export async function getBoard(wsId: ID, pipelineId: ID | undefined, f: LeadFilter = {}) {
  await live();
  const pipelines = await listPipelines(wsId);
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
  if (!pipeline) throw new DomainError("not_found");
  const leads = db.leads.filter((l) => l.pipelineId === pipeline.id && matches(l, f));
  const columns = [...pipeline.stages]
    .sort((a, b) => a.sort - b.sort)
    .map((stage) => {
      const ls = leads.filter((l) => l.stageId === stage.id).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
      return { stage, leads: ls.map(toCard), count: ls.length, totalCents: ls.reduce((s, l) => s + l.priceCents, 0) };
    });
  const incoming = db.incoming
    .filter((i) => i.pipelineId === pipeline.id && i.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { pipeline, pipelines, columns, incoming };
}

export async function listLeads(wsId: ID, f: LeadFilter & { pipelineId?: ID; stageId?: ID } = {}) {
  await live();
  return db.leads
    .filter((l) => l.workspaceId === wsId && (!f.pipelineId || l.pipelineId === f.pipelineId) && (!f.stageId || l.stageId === f.stageId) && matches(l, f))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    .map((l) => ({ ...toCard(l), stage: stageOf(l.stageId)! }));
}

function event(leadId: ID, kind: LeadEvent["kind"], before: LeadEvent["before"], after: LeadEvent["after"], actor: ID | null) {
  db.events.push({ id: uid(), leadId, kind, before, after, actorUserId: actor, createdAt: now() });
}

function getLeadRow(wsId: ID, id: ID) {
  const l = db.leads.find((x) => x.id === id && x.workspaceId === wsId);
  if (!l) throw new DomainError("not_found");
  return l;
}

export async function createLead(
  wsId: ID,
  actor: ID,
  input: { pipelineId: ID; stageId: ID; name: string; priceCents: number; contactName?: string; contactPhone?: string },
) {
  const st = stageOf(input.stageId);
  if (!st || st.pipelineId !== input.pipelineId) throw new DomainError("invalid", "Etapa inválida.");
  const l: Lead = {
    id: uid(),
    workspaceId: wsId,
    number: ++db.leadSeq,
    name: input.name.trim(),
    pipelineId: input.pipelineId,
    stageId: input.stageId,
    responsibleUserId: actor,
    priceCents: Math.max(0, Math.round(input.priceCents)),
    currency: "BRL",
    lossReasonId: null,
    source: "manual",
    companyId: null,
    tags: [],
    closedAt: st.kind === "open" ? null : now(),
    closestTaskAt: null,
    lastActivityAt: now(),
    createdAt: now(),
  };
  db.leads.push(l);
  event(l.id, "lead_created", null, { stageId: l.stageId }, actor);
  if (input.contactName?.trim() || input.contactPhone?.trim()) {
    const phone = input.contactPhone?.replace(/[^\d+]/g, "") ?? "";
    const existing = phone ? db.contacts.find((c) => c.workspaceId === wsId && c.identities.some((i) => i.kind === "phone" && i.value === phone)) : undefined;
    const c: Contact = existing ?? {
      id: uid(),
      workspaceId: wsId,
      name: input.contactName?.trim() || phone,
      companyId: null,
      responsibleUserId: actor,
      identities: phone ? [{ kind: "phone", value: phone }] : [],
      createdAt: now(),
    };
    if (!existing) db.contacts.push(c);
    db.leadContacts.push({ leadId: l.id, contactId: c.id, isMain: true });
  }
  return l;
}

export async function updateLead(
  wsId: ID,
  actor: ID,
  id: ID,
  patch: Partial<Pick<Lead, "name" | "priceCents" | "responsibleUserId" | "tags">>,
) {
  const l = getLeadRow(wsId, id);
  if (patch.name !== undefined && patch.name !== l.name) {
    event(id, "name_changed", { name: l.name }, { name: patch.name }, actor);
    l.name = patch.name.trim();
  }
  if (patch.priceCents !== undefined && patch.priceCents !== l.priceCents) {
    if (patch.priceCents < 0 || !Number.isFinite(patch.priceCents)) throw new DomainError("invalid", "Valor inválido.");
    event(id, "price_changed", { priceCents: l.priceCents }, { priceCents: patch.priceCents }, actor);
    l.priceCents = Math.round(patch.priceCents);
  }
  if (patch.responsibleUserId !== undefined && patch.responsibleUserId !== l.responsibleUserId) {
    event(id, "responsible_changed", { userId: l.responsibleUserId }, { userId: patch.responsibleUserId }, actor);
    l.responsibleUserId = patch.responsibleUserId;
  }
  if (patch.tags) l.tags = [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  l.lastActivityAt = now();
  return l;
}

export async function moveLead(wsId: ID, actor: ID, id: ID, stageId: ID, lossReasonId?: ID | null) {
  const l = getLeadRow(wsId, id);
  const st = stageOf(stageId);
  if (!st || st.pipelineId !== l.pipelineId) throw new DomainError("invalid", "Etapa inválida para este funil.");
  if (st.kind === "lost" && !lossReasonId) throw new DomainError("invalid", "Escolha o motivo da perda.");
  if (l.stageId === stageId) return l;
  event(id, "stage_changed", { stageId: l.stageId }, { stageId }, actor);
  l.stageId = stageId;
  l.closedAt = st.kind === "open" ? null : now();
  l.lossReasonId = st.kind === "lost" ? (lossReasonId ?? null) : null;
  l.lastActivityAt = now();
  return l;
}

export async function deleteLead(wsId: ID, id: ID) {
  getLeadRow(wsId, id);
  db.leads = db.leads.filter((l) => l.id !== id);
  db.leadContacts = db.leadContacts.filter((x) => x.leadId !== id);
  db.tasks = db.tasks.filter((t) => t.leadId !== id);
  for (const c of db.conversations) if (c.leadId === id) c.leadId = null;
}

// ---------------------------------------------------------------------------
// cartão do lead
// ---------------------------------------------------------------------------
const userName = (id: ID | null) => db.users.find((u) => u.id === id)?.name ?? "Sistema";

function eventText(e: LeadEvent): string {
  const stage = (v: unknown) => stageOf(String(v))?.name ?? "—";
  const brl = (c: unknown) => (Number(c) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  switch (e.kind) {
    case "lead_created":
      return `${userName(e.actorUserId)} criou o lead`;
    case "stage_changed":
      return `${userName(e.actorUserId)} moveu de ${stage(e.before?.stageId)} para ${stage(e.after?.stageId)}`;
    case "responsible_changed":
      return `Responsável: ${userName((e.before?.userId as ID) ?? null)} → ${userName((e.after?.userId as ID) ?? null)}`;
    case "price_changed":
      return `Valor: ${brl(e.before?.priceCents)} → ${brl(e.after?.priceCents)}`;
    case "name_changed":
      return `Nome alterado para “${String(e.after?.name)}”`;
    case "task_completed":
      return `${userName(e.actorUserId)} concluiu uma tarefa`;
    case "contact_linked":
      return `${userName(e.actorUserId)} vinculou um contato`;
  }
}

export async function getLead(wsId: ID, id: ID) {
  await live();
  const l = getLeadRow(wsId, id);
  const pipeline = db.pipelines.find((p) => p.id === l.pipelineId)!;
  const contacts = db.leadContacts
    .filter((x) => x.leadId === id)
    .sort((a, b) => Number(b.isMain) - Number(a.isMain))
    .map((x) => db.contacts.find((c) => c.id === x.contactId)!)
    .filter(Boolean);
  const company = l.companyId ? (db.companies.find((c) => c.id === l.companyId) ?? null) : null;
  const conversation = db.conversations.find((c) => c.leadId === id) ?? null;
  const channel = conversation ? db.channels.find((c) => c.id === conversation.channelId)! : null;

  const feed: FeedItem[] = [
    ...(conversation
      ? db.messages
          .filter((m) => m.conversationId === conversation.id)
          .map((m) => ({ type: "message" as const, at: m.sentAt, message: m, channelKind: channel!.kind }))
      : []),
    ...db.notes.filter((n) => n.leadId === id).map((n) => ({ type: "note" as const, at: n.createdAt, note: n, author: userName(n.createdBy) })),
    ...db.tasks.filter((t) => t.leadId === id).map((t) => ({ type: "task" as const, at: t.completedAt ?? t.createdAt, task: t })),
    ...db.events.filter((e) => e.leadId === id).map((e) => ({ type: "event" as const, at: e.createdAt, event: e, text: eventText(e) })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return { lead: toCard(l), pipeline, contacts, company, conversation, channel, feed };
}

// ---------------------------------------------------------------------------
// notas e tarefas
// ---------------------------------------------------------------------------
export async function addNote(wsId: ID, actor: ID, leadId: ID, body: string) {
  const l = getLeadRow(wsId, leadId);
  if (!body.trim()) throw new DomainError("invalid", "A nota está vazia.");
  db.notes.push({ id: uid(), leadId, contactId: null, body: body.trim(), createdBy: actor, createdAt: now() });
  l.lastActivityAt = now();
}

function syncClosestTask(leadId: ID | null) {
  if (!leadId) return;
  const l = db.leads.find((x) => x.id === leadId);
  if (!l) return;
  l.closestTaskAt = db.tasks.filter((t) => t.leadId === leadId && !t.completedAt).map((t) => t.dueAt).sort()[0] ?? null;
}

export async function createTask(wsId: ID, actor: ID, input: { leadId: ID | null; text: string; dueAt: string; taskTypeId: ID | null; responsibleUserId?: ID }) {
  if (input.leadId) getLeadRow(wsId, input.leadId);
  if (Number.isNaN(Date.parse(input.dueAt))) throw new DomainError("invalid", "Prazo inválido.");
  const t: Task = {
    id: uid(),
    workspaceId: wsId,
    leadId: input.leadId,
    contactId: null,
    taskTypeId: input.taskTypeId,
    responsibleUserId: input.responsibleUserId ?? actor,
    text: input.text.trim(),
    dueAt: new Date(input.dueAt).toISOString(),
    completedAt: null,
    resultText: null,
    createdAt: now(),
  };
  db.tasks.push(t);
  syncClosestTask(t.leadId);
  return t;
}

export async function completeTask(wsId: ID, actor: ID, taskId: ID, resultText: string) {
  const t = db.tasks.find((x) => x.id === taskId && x.workspaceId === wsId);
  if (!t) throw new DomainError("not_found");
  if (t.completedAt) return t;
  t.completedAt = now();
  t.resultText = resultText.trim() || null;
  if (t.leadId) event(t.leadId, "task_completed", null, { taskId }, actor);
  syncClosestTask(t.leadId);
  return t;
}

export async function listTasks(wsId: ID, f: { from?: string; to?: string; owner?: ID; open?: boolean } = {}) {
  await live();
  return db.tasks
    .filter(
      (t) =>
        t.workspaceId === wsId &&
        (!f.owner || t.responsibleUserId === f.owner) &&
        (f.open === undefined || !t.completedAt === f.open) &&
        (!f.from || t.dueAt >= f.from) &&
        (!f.to || t.dueAt < f.to),
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((t) => ({ ...t, lead: t.leadId ? (db.leads.find((l) => l.id === t.leadId) ?? null) : null, owner: userName(t.responsibleUserId) }));
}

// ---------------------------------------------------------------------------
// leads de entrada
// ---------------------------------------------------------------------------
function pendingIncoming(wsId: ID, id: ID): IncomingLead {
  const il = db.incoming.find((x) => x.id === id && x.workspaceId === wsId);
  if (!il) throw new DomainError("not_found");
  if (il.status !== "pending") throw new DomainError("already_resolved", "Alguém da equipe já cuidou deste contato.");
  return il;
}

export async function acceptIncoming(wsId: ID, actor: ID, id: ID) {
  const il = pendingIncoming(wsId, id);
  il.status = "accepted"; // marcado antes de criar: um vencedor só (no Supabase, update ... where status='pending')
  const pipeline = db.pipelines.find((p) => p.id === il.pipelineId)!;
  const first = [...pipeline.stages].filter((s) => s.kind === "open").sort((a, b) => a.sort - b.sort)[0];
  const contact = il.contactId ? db.contacts.find((c) => c.id === il.contactId) : undefined;
  const l = await createLead(wsId, actor, { pipelineId: pipeline.id, stageId: first.id, name: "", priceCents: 0 });
  l.source = il.kind;
  if (contact) {
    contact.responsibleUserId ??= actor;
    db.leadContacts.push({ leadId: l.id, contactId: contact.id, isMain: true });
  }
  const conv = il.conversationId ? db.conversations.find((c) => c.id === il.conversationId) : undefined;
  if (conv) {
    conv.leadId = l.id;
    conv.assignedUserId ??= actor;
  }
  il.resolvedLeadId = l.id;
  il.resolvedBy = actor;
  return l;
}

export async function declineIncoming(wsId: ID, actor: ID, id: ID) {
  const il = pendingIncoming(wsId, id);
  il.status = "declined";
  il.resolvedBy = actor;
  const conv = il.conversationId ? db.conversations.find((c) => c.id === il.conversationId) : undefined;
  if (conv) conv.status = "closed";
}

export async function linkIncoming(wsId: ID, actor: ID, id: ID, leadId: ID) {
  const il = pendingIncoming(wsId, id);
  const l = getLeadRow(wsId, leadId);
  il.status = "linked";
  il.resolvedLeadId = l.id;
  il.resolvedBy = actor;
  const target = db.leadContacts.find((x) => x.leadId === l.id && x.isMain);
  const stranger = il.contactId ? db.contacts.find((c) => c.id === il.contactId) : undefined;
  const conv = il.conversationId ? db.conversations.find((c) => c.id === il.conversationId) : undefined;
  if (target && stranger && target.contactId !== stranger.id) {
    // mescla: identidades do desconhecido passam para o contato do lead
    const keep = db.contacts.find((c) => c.id === target.contactId)!;
    keep.identities.push(...stranger.identities.filter((i) => !keep.identities.some((k) => k.kind === i.kind && k.value === i.value)));
    db.contacts = db.contacts.filter((c) => c.id !== stranger.id);
    if (conv) conv.contactId = keep.id;
  } else if (stranger && !target) {
    db.leadContacts.push({ leadId: l.id, contactId: stranger.id, isMain: true });
  }
  if (conv) {
    conv.leadId = l.id;
    conv.assignedUserId ??= actor;
  }
  event(l.id, "contact_linked", null, { incomingId: id }, actor);
  l.lastActivityAt = now();
  return l;
}

// ---------------------------------------------------------------------------
// conversas
// ---------------------------------------------------------------------------
export type ConvFilter = "all" | "unread" | "unanswered" | "mine";

export async function listConversations(wsId: ID, actor: ID, f: ConvFilter = "all") {
  await live();
  return db.conversations
    .filter(
      (c) =>
        c.workspaceId === wsId &&
        c.status === "open" &&
        (f !== "unread" || c.unreadCount > 0) &&
        (f !== "unanswered" || c.isUnanswered) &&
        (f !== "mine" || c.assignedUserId === actor),
    )
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
    .map((c) => ({
      ...c,
      contact: db.contacts.find((x) => x.id === c.contactId)!,
      channel: db.channels.find((x) => x.id === c.channelId)!,
      lead: c.leadId ? (db.leads.find((l) => l.id === c.leadId) ?? null) : null,
    }));
}

export async function getConversation(wsId: ID, id: ID) {
  await live();
  const c = db.conversations.find((x) => x.id === id && x.workspaceId === wsId);
  if (!c) throw new DomainError("not_found");
  return {
    conversation: c,
    contact: db.contacts.find((x) => x.id === c.contactId)!,
    channel: db.channels.find((x) => x.id === c.channelId)!,
    lead: c.leadId ? toCard(db.leads.find((l) => l.id === c.leadId)!) : null,
    messages: db.messages.filter((m) => m.conversationId === id).sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
  };
}

export async function markConversationRead(wsId: ID, id: ID) {
  const c = db.conversations.find((x) => x.id === id && x.workspaceId === wsId);
  if (c) c.unreadCount = 0;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;
export const windowClosed = (c: Conversation, kind: ChannelKind) =>
  kind === "whatsapp" && (!c.lastInboundAt || Date.now() - Date.parse(c.lastInboundAt) > WINDOW_MS);

export async function sendMessage(wsId: ID, actor: ID, conversationId: ID, body: string, clientId: string) {
  const c = db.conversations.find((x) => x.id === conversationId && x.workspaceId === wsId);
  if (!c) throw new DomainError("not_found");
  const ch = db.channels.find((x) => x.id === c.channelId)!;
  if (windowClosed(c, ch.kind)) throw new DomainError("window_closed", "Fora da janela de 24h. Use um modelo aprovado.");
  if (!body.trim()) throw new DomainError("invalid", "A mensagem está vazia.");
  const dup = db.messages.find((m) => m.conversationId === conversationId && m.clientId === clientId);
  if (dup) return dup; // duplo clique / reenvio do navegador
  const m: Message = { id: uid(), conversationId, direction: "out", body: body.trim(), senderUserId: actor, clientId, status: "sent", sentAt: now() };
  db.messages.push(m);
  c.lastMessageAt = m.sentAt;
  c.lastMessagePreview = m.body;
  c.isUnanswered = false;
  c.unreadCount = 0;
  c.assignedUserId ??= actor;
  if (c.leadId) {
    const l = db.leads.find((x) => x.id === c.leadId);
    if (l) l.lastActivityAt = now();
  }
  return m;
}

// ---------------------------------------------------------------------------
// chat do site (público, sem login)
// ---------------------------------------------------------------------------
export async function getWebchat(publicKey: string) {
  await live();
  const ch = db.channels.find((c) => c.kind === "webchat" && c.publicKey === publicKey && c.status === "connected");
  if (!ch) throw new DomainError("not_found");
  const ws = db.workspaces.find((w) => w.id === ch.workspaceId)!;
  return { channelId: ch.id, workspaceName: ws.name };
}

export async function visitorThread(publicKey: string, visitorId: string) {
  await live();
  const ch = db.channels.find((c) => c.kind === "webchat" && c.publicKey === publicKey);
  if (!ch) throw new DomainError("not_found");
  const conv = db.conversations.find((c) => c.channelId === ch.id && c.externalThreadId === visitorId);
  return conv ? db.messages.filter((m) => m.conversationId === conv.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt)) : [];
}

/** Mesmo caminho que o webhook da Meta vai usar: acha/cria contato → conversa → mensagem → lead de entrada. */
export async function receiveInbound(channelId: ID, externalThreadId: string, senderName: string, body: string, externalId: string) {
  const ch = db.channels.find((c) => c.id === channelId);
  if (!ch) throw new DomainError("not_found");
  const text = body.trim().slice(0, 4000);
  if (!text) throw new DomainError("invalid");

  let conv = db.conversations.find((c) => c.channelId === ch.id && c.externalThreadId === externalThreadId);
  if (conv && db.messages.some((m) => m.conversationId === conv!.id && m.clientId === externalId)) return; // dedup
  if (!conv) {
    const idKind = ch.kind === "messenger" ? "webchat" : ch.kind;
    let contact = db.contacts.find((c) => c.workspaceId === ch.workspaceId && c.identities.some((i) => i.kind === idKind && i.value === externalThreadId));
    if (!contact) {
      contact = {
        id: uid(),
        workspaceId: ch.workspaceId,
        name: senderName.trim().slice(0, 80) || `Visitante ${externalThreadId.slice(-4)}`,
        companyId: null,
        responsibleUserId: null,
        identities: [{ kind: idKind, value: externalThreadId }],
        createdAt: now(),
      };
      db.contacts.push(contact);
    }
    const existingLead = db.leadContacts.find((x) => x.contactId === contact!.id);
    conv = {
      id: uid(),
      workspaceId: ch.workspaceId,
      channelId: ch.id,
      contactId: contact.id,
      leadId: existingLead?.leadId ?? null,
      externalThreadId,
      status: "open",
      assignedUserId: null,
      unreadCount: 0,
      isUnanswered: true,
      lastMessageAt: null,
      lastInboundAt: null,
      lastMessagePreview: "",
    };
    db.conversations.push(conv);
  }
  const m: Message = { id: uid(), conversationId: conv.id, direction: "in", body: text, senderUserId: null, clientId: externalId, status: "received", sentAt: now() };
  db.messages.push(m);
  Object.assign(conv, {
    status: "open",
    unreadCount: conv.unreadCount + 1,
    isUnanswered: true,
    lastMessageAt: m.sentAt,
    lastInboundAt: m.sentAt,
    lastMessagePreview: text,
  });

  if (conv.leadId) {
    const l = db.leads.find((x) => x.id === conv!.leadId);
    if (l) l.lastActivityAt = now();
    return;
  }
  const pending = db.incoming.find((i) => i.conversationId === conv!.id && i.status === "pending");
  if (pending) {
    pending.preview = text; // um card por conversa: atualiza a prévia
    return;
  }
  const contact = db.contacts.find((c) => c.id === conv!.contactId)!;
  db.incoming.push({
    id: uid(),
    workspaceId: ch.workspaceId,
    pipelineId: ch.defaultPipelineId ?? db.pipelines.find((p) => p.workspaceId === ch.workspaceId)!.id,
    channelId: ch.id,
    conversationId: conv.id,
    contactId: contact.id,
    kind: "chat",
    preview: text,
    who: contact.name,
    status: "pending",
    resolvedLeadId: null,
    resolvedBy: null,
    createdAt: now(),
  });
}

// ---------------------------------------------------------------------------
// contatos, empresas, canais, busca, painel
// ---------------------------------------------------------------------------
export async function listContacts(wsId: ID, q = "") {
  await live();
  const s = q.toLowerCase();
  return db.contacts
    .filter((c) => c.workspaceId === wsId && (!s || c.name.toLowerCase().includes(s) || c.identities.some((i) => i.value.includes(s))))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((c) => ({
      ...c,
      company: c.companyId ? (db.companies.find((x) => x.id === c.companyId) ?? null) : null,
      leadCount: db.leadContacts.filter((x) => x.contactId === c.id).length,
      owner: c.responsibleUserId ? userName(c.responsibleUserId) : null,
    }));
}

export async function getContact(wsId: ID, id: ID) {
  await live();
  const c = db.contacts.find((x) => x.id === id && x.workspaceId === wsId);
  if (!c) throw new DomainError("not_found");
  const leads = db.leadContacts
    .filter((x) => x.contactId === id)
    .map((x) => db.leads.find((l) => l.id === x.leadId)!)
    .filter(Boolean)
    .map((l) => ({ ...l, stage: stageOf(l.stageId)! }));
  return { contact: c, company: c.companyId ? (db.companies.find((x) => x.id === c.companyId) ?? null) : null, leads };
}

export async function createContact(wsId: ID, actor: ID, input: { name: string; phone?: string; email?: string }) {
  const c: Contact = {
    id: uid(),
    workspaceId: wsId,
    name: input.name.trim(),
    companyId: null,
    responsibleUserId: actor,
    identities: [
      ...(input.phone ? [{ kind: "phone" as const, value: input.phone.replace(/[^\d+]/g, "") }] : []),
      ...(input.email ? [{ kind: "email" as const, value: input.email.trim().toLowerCase() }] : []),
    ],
    createdAt: now(),
  };
  db.contacts.push(c);
  return c;
}

export async function listCompanies(wsId: ID) {
  await live();
  return db.companies
    .filter((c) => c.workspaceId === wsId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((c) => ({
      ...c,
      contactCount: db.contacts.filter((x) => x.companyId === c.id).length,
      leadCount: db.leads.filter((l) => l.companyId === c.id).length,
    }));
}

export async function getCompany(wsId: ID, id: ID) {
  await live();
  const c = db.companies.find((x) => x.id === id && x.workspaceId === wsId);
  if (!c) throw new DomainError("not_found");
  return {
    company: c,
    contacts: db.contacts.filter((x) => x.companyId === id),
    leads: db.leads.filter((l) => l.companyId === id).map((l) => ({ ...l, stage: stageOf(l.stageId)! })),
  };
}

export async function listChannels(wsId: ID) {
  await live();
  return db.channels.filter((c) => c.workspaceId === wsId);
}

export async function search(wsId: ID, q: string) {
  await live();
  const s = q.trim().toLowerCase();
  if (s.length < 2) return { leads: [], contacts: [], companies: [] };
  return {
    leads: db.leads.filter((l) => l.workspaceId === wsId && (l.name.toLowerCase().includes(s) || `#${l.number}`.includes(s))).slice(0, 5),
    contacts: db.contacts
      .filter((c) => c.workspaceId === wsId && (c.name.toLowerCase().includes(s) || c.identities.some((i) => i.value.toLowerCase().includes(s))))
      .slice(0, 5),
    companies: db.companies.filter((c) => c.workspaceId === wsId && c.name.toLowerCase().includes(s)).slice(0, 5),
  };
}

export async function getDashboard(wsId: ID, f: { from: string; owner?: ID }) {
  await live();
  const leads = db.leads.filter((l) => l.workspaceId === wsId && (!f.owner || l.responsibleUserId === f.owner));
  const kind = (l: Lead) => stageOf(l.stageId)?.kind;
  const convs = db.conversations.filter((c) => c.workspaceId === wsId && c.status === "open");
  const inbound = db.messages.filter((m) => m.direction === "in" && m.sentAt >= f.from && convs.some((c) => c.id === m.conversationId));
  const byChannel = new Map<string, number>();
  for (const m of inbound) {
    const ch = db.channels.find((c) => c.id === db.conversations.find((x) => x.id === m.conversationId)?.channelId);
    if (ch) byChannel.set(ch.name, (byChannel.get(ch.name) ?? 0) + 1);
  }
  return {
    won: leads.filter((l) => kind(l) === "won" && l.closedAt && l.closedAt >= f.from),
    lost: leads.filter((l) => kind(l) === "lost" && l.closedAt && l.closedAt >= f.from),
    active: leads.filter((l) => kind(l) === "open"),
    withoutTask: leads.filter((l) => kind(l) === "open" && !l.closestTaskAt),
    openConversations: convs.length,
    unanswered: convs.filter((c) => c.isUnanswered).length,
    inboundByChannel: [...byChannel.entries()].map(([name, count]) => ({ name, count })),
    tasksDue: db.tasks.filter((t) => t.workspaceId === wsId && !t.completedAt && (!f.owner || t.responsibleUserId === f.owner)).length,
  };
}
