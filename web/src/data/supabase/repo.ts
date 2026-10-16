import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import {
  DomainError,
  type Channel,
  type ChannelKind,
  type Company,
  type Contact,
  type Conversation,
  type FeedItem,
  type ID,
  type IncomingLead,
  type Lead,
  type LeadCard,
  type LeadEvent,
  type LossReason,
  type Message,
  type Note,
  type Pipeline,
  type Stage,
  type Task,
  type TaskType,
  type Subscription,
  type Access,
  type SignupInfo,
  type User,
  type Workspace,
} from "../types";
import type { ConvFilter, LeadFilter } from "../fake/repo";
import { accessOf } from "../access";

/* Repositório real (Supabase). Mesmas assinaturas do falso.
   Quem decide o que cada usuário vê é o RLS (supabase/migrations). O parâmetro `actor`
   existe só por compatibilidade: aqui o banco usa auth.uid() da sessão. */

export const MANAGES_OWN_SESSION = true;

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- parâmetros mantidos para ter a mesma assinatura do repositório falso */
type Row = Record<string, any>;

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
const isoReq = (v: string) => new Date(v).toISOString();

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) throw toDomain(r.error);
  return r.data;
}
function toDomain(e: PostgrestError | Error): DomainError | Error {
  const m = e.message ?? "";
  if (m.includes("already_resolved")) return new DomainError("already_resolved", "Alguém da equipe já cuidou deste contato.");
  if (m.includes("not_found") || ("code" in e && e.code === "PGRST116")) return new DomainError("not_found");
  if (m.includes("forbidden") || ("code" in e && e.code === "42501")) return new DomainError("forbidden");
  if (m.includes("slug_taken")) return new DomainError("invalid", "Esse endereço já está em uso.");
  if (m.includes("slug_reserved")) return new DomainError("invalid", "Esse endereço é reservado.");
  if (m.includes("loss_reason_required")) return new DomainError("invalid", "Escolha o motivo da perda.");
  if (m.includes("invalid_document")) return new DomainError("invalid", "CPF ou CNPJ inválido.");
  if (m.includes("create_workspace")) return new DomainError("invalid", "Falta rodar a atualização do banco (supabase/atualizacao-cadastro.sql).");
  if (m.includes("invalid")) return new DomainError("invalid");
  return e instanceof Error ? e : new Error(m);
}

// ---------------------------------------------------------------------------
// mapeamento linha → tipo do domínio
// ---------------------------------------------------------------------------
const toStage = (r: Row): Stage => ({ id: r.id, pipelineId: r.pipeline_id, name: r.name, color: r.color, kind: r.kind, sort: r.sort });
const toContact = (r: Row): Contact => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  companyId: r.company_id,
  responsibleUserId: r.responsible_user_id,
  identities: (r.contact_identities ?? []).map((i: Row) => ({ kind: i.kind, value: i.value })),
  createdAt: isoReq(r.created_at),
});
const toCompany = (r: Row): Company => ({ id: r.id, workspaceId: r.workspace_id, name: r.name, responsibleUserId: r.responsible_user_id, createdAt: isoReq(r.created_at) });
const toLead = (r: Row): Lead => ({
  id: r.id,
  workspaceId: r.workspace_id,
  number: Number(r.number),
  name: r.name,
  pipelineId: r.pipeline_id,
  stageId: r.stage_id,
  responsibleUserId: r.responsible_user_id,
  priceCents: Number(r.price_cents),
  currency: r.currency,
  lossReasonId: r.loss_reason_id,
  source: r.source ?? "manual",
  companyId: r.company_id,
  tags: (r.lead_tags ?? []).map((t: Row) => t.tags?.name).filter(Boolean),
  closedAt: iso(r.closed_at),
  closestTaskAt: iso(r.closest_task_at),
  lastActivityAt: isoReq(r.last_activity_at),
  createdAt: isoReq(r.created_at),
  attribution: r.attribution ?? null,
});
const toConversation = (r: Row): Conversation => ({
  id: r.id,
  workspaceId: r.workspace_id,
  channelId: r.channel_id,
  contactId: r.contact_id,
  leadId: r.lead_id,
  externalThreadId: r.external_thread_id,
  status: r.status,
  assignedUserId: r.assigned_user_id,
  unreadCount: r.unread_count,
  isUnanswered: r.is_unanswered,
  lastMessageAt: iso(r.last_message_at),
  lastInboundAt: iso(r.last_inbound_at),
  lastMessagePreview: r.last_message_preview ?? "",
  attribution: r.attribution ?? null,
  aiPaused: r.ai_paused ?? false,
});
const toMessage = (r: Row): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  direction: r.direction,
  body: r.body,
  senderUserId: r.sender_user_id,
  clientId: r.client_id,
  status: r.status,
  sentAt: isoReq(r.sent_at),
  byAi: r.by_ai ?? false,
});
const toChannel = (r: Row): Channel => ({
  id: r.id,
  workspaceId: r.workspace_id,
  kind: r.kind,
  name: r.name,
  publicKey: r.public_key,
  defaultPipelineId: r.default_pipeline_id,
  status: r.status,
});
const toTask = (r: Row): Task => ({
  id: r.id,
  workspaceId: r.workspace_id,
  leadId: r.lead_id,
  contactId: r.contact_id,
  taskTypeId: r.task_type_id,
  responsibleUserId: r.responsible_user_id,
  text: r.text,
  dueAt: isoReq(r.due_at),
  completedAt: iso(r.completed_at),
  resultText: r.result_text,
  createdAt: isoReq(r.created_at),
});

const LEAD_SELECT =
  "*, lead_tags(tags(name)), lead_contacts(is_main, contacts(*, contact_identities(kind, value))), conversations(unread_count, channels(kind))";

function toCard(r: Row): LeadCard {
  const l = toLead(r);
  const links: Row[] = r.lead_contacts ?? [];
  const main = links.find((x) => x.is_main) ?? links[0];
  const conv: Row | undefined = (r.conversations ?? [])[0];
  const now = new Date().toISOString();
  return {
    ...l,
    mainContact: main?.contacts ? toContact(main.contacts) : null,
    hasUnread: (conv?.unread_count ?? 0) > 0,
    channelKind: (conv?.channels?.kind as ChannelKind) ?? null,
    taskState: !l.closestTaskAt ? "none" : l.closestTaskAt < now ? "late" : "ok",
  };
}

// ---------------------------------------------------------------------------
// sessão (o Supabase Auth guarda a sessão nos próprios cookies)
// ---------------------------------------------------------------------------
export async function userBySessionToken(_token?: string): Promise<User | null> {
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await sb.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, name: p?.full_name || data.user.email || "", email: data.user.email ?? "" };
}

export async function signIn(email: string, password: string): Promise<string> {
  const sb = await userClient();
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new DomainError("invalid", "Email ou senha incorretos.");
  return "";
}

export async function signUp(name: string, email: string, password: string, signup?: SignupInfo): Promise<string> {
  const sb = await userClient();
  // empresa e documento ficam no cadastro até a pessoa confirmar o email e abrir a empresa
  const meta = { full_name: name.trim(), ...(signup ? { company: signup.company, doc_type: signup.docType, document: signup.document, phone: signup.phone } : {}) };
  const { data, error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: meta } });
  if (error) throw new DomainError("invalid", error.message.includes("registered") ? "Já existe uma conta com esse email." : "Não deu para criar a conta.");
  if (!data.session) throw new DomainError("invalid", "Enviamos um link de confirmação para o seu email. Abra-o para continuar.");
  return "";
}

export async function signOut(_token?: string) {
  const sb = await userClient();
  await sb.auth.signOut({ scope: "local" });
}

export async function getAccess(wsId: ID): Promise<Access> {
  const sb = await userClient();
  const { data, error } = await sb.rpc("workspace_access", { p_ws: wsId }).maybeSingle();
  const r = data as Row | null;
  if (error || !r) return accessOf("trialing", null); // banco ainda sem a atualização de cadastro: não trava ninguém
  return accessOf(r.status, iso(r.trial_ends_at), r.plan);
}

export async function signupInfo(_userId: ID): Promise<SignupInfo | null> {
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  const m = (data.user?.user_metadata ?? {}) as Record<string, string | undefined>;
  if (!m.company && !m.document) return null;
  return { company: m.company ?? "", docType: m.doc_type === "cpf" || m.doc_type === "cnpj" ? m.doc_type : null, document: m.document ?? "", phone: m.phone ?? "" };
}

export async function getSubscription(wsId: ID): Promise<Subscription> {
  const sb = await userClient();
  const { data: s } = await sb.from("subscriptions").select("*").eq("workspace_id", wsId).maybeSingle();
  if (!s) return { plan: "trial", status: "trialing", seats: 1, stripeCustomerId: null, trialEndsAt: null, currentPeriodEnd: null }; // só admin lê (RLS)
  return { plan: s.plan, status: s.status, seats: s.seats, stripeCustomerId: s.stripe_customer_id, trialEndsAt: iso(s.trial_ends_at), currentPeriodEnd: iso(s.current_period_end) };
}

export async function deleteAccount(userId: ID) {
  const admin = adminClient();
  const mine = check(await admin.from("memberships").select("workspace_id").eq("user_id", userId)).map((m: Row) => m.workspace_id as string);
  for (const ws of mine) {
    const { count } = await admin.from("memberships").select("id", { count: "exact", head: true }).eq("workspace_id", ws);
    if (count === 1) check(await admin.from("workspaces").delete().eq("id", ws)); // cascata apaga tudo da empresa
    // TODO: apagar também os arquivos do Storage em attachments/{ws}/
  }
  // empresas com outras pessoas continuam; o que ele criou fica sem autor (on delete set null)
  check(await admin.from("workspaces").update({ created_by: null }).eq("created_by", userId).select("id"));
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  await (await userClient()).auth.signOut({ scope: "local" });
}

export async function workspacesOf(_userId: ID): Promise<Workspace[]> {
  const sb = await userClient();
  const rows = check(await sb.from("workspaces").select("*").order("created_at"));
  return rows.map((w: Row) => ({ id: w.id, slug: w.slug, name: w.name, timezone: w.timezone, currency: w.currency }));
}

export async function workspaceForUser(slug: string, _userId: ID): Promise<Workspace> {
  const sb = await userClient();
  const { data } = await sb.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (!data) throw new DomainError("not_found"); // RLS: quem não é membro não enxerga
  return { id: data.id, slug: data.slug, name: data.name, timezone: data.timezone, currency: data.currency };
}

export async function createWorkspace(
  _userId: ID,
  input: { name: string; slug: string; timezone: string; currency: string; docType: "cpf" | "cnpj"; document: string; phone?: string },
) {
  const sb = await userClient();
  // usuário criado no painel do Supabase antes do setup.sql não tem perfil: cria agora
  const { data: me } = await sb.auth.getUser();
  if (me.user) {
    await adminClient()
      .from("profiles")
      .upsert({ id: me.user.id, email: me.user.email, full_name: (me.user.user_metadata?.full_name as string) ?? "" }, { onConflict: "id", ignoreDuplicates: true });
  }
  check(
    await sb.rpc("create_workspace", {
      p_name: input.name,
      p_slug: input.slug,
      p_timezone: input.timezone,
      p_currency: input.currency,
      p_doc_type: input.docType,
      p_document: input.document.replace(/\D/g, ""),
      p_phone: input.phone?.replace(/\D/g, "") || null,
    }),
  );
  return workspaceForUser(input.slug, _userId);
}

export async function listUsers(wsId: ID): Promise<User[]> {
  const sb = await userClient();
  const rows = check(await sb.from("memberships").select("user_id, profiles:user_id(full_name, email)").eq("workspace_id", wsId).eq("status", "active"));
  return rows.map((m: Row) => ({ id: m.user_id, name: m.profiles?.full_name || m.profiles?.email || "", email: m.profiles?.email ?? "" }));
}

// ---------------------------------------------------------------------------
// funil
// ---------------------------------------------------------------------------
export async function listPipelines(wsId: ID): Promise<Pipeline[]> {
  const sb = await userClient();
  const rows = check(await sb.from("pipelines").select("*, stages(*)").eq("workspace_id", wsId).eq("is_archived", false).order("sort"));
  return rows.map((p: Row) => ({ id: p.id, workspaceId: p.workspace_id, name: p.name, sort: p.sort, stages: (p.stages ?? []).map(toStage) }));
}

export async function listLossReasons(wsId: ID): Promise<(LossReason & { workspaceId: string })[]> {
  const sb = await userClient();
  return check(await sb.from("loss_reasons").select("id, name, workspace_id").eq("workspace_id", wsId).order("sort")).map((r: Row) => ({ id: r.id, name: r.name, workspaceId: r.workspace_id }));
}

export async function listTaskTypes(wsId: ID): Promise<(TaskType & { workspaceId: string })[]> {
  const sb = await userClient();
  return check(await sb.from("task_types").select("id, name, workspace_id").eq("workspace_id", wsId).order("sort")).map((r: Row) => ({ id: r.id, name: r.name, workspaceId: r.workspace_id }));
}

function applyFilter(rows: LeadCard[], f: LeadFilter) {
  const now = new Date().toISOString();
  return rows.filter((l) => {
    if (f.owner && l.responsibleUserId !== f.owner) return false;
    if (f.tag && !l.tags.includes(f.tag)) return false;
    if (f.task === "none" && l.closestTaskAt) return false;
    if (f.task === "late" && !(l.closestTaskAt && l.closestTaskAt < now)) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      if (![l.name, `#${l.number}`, l.mainContact?.name ?? ""].some((s) => s.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

async function leadCards(wsId: ID, f: LeadFilter & { pipelineId?: ID; stageId?: ID }) {
  const sb = await userClient();
  let q = sb.from("leads").select(LEAD_SELECT).eq("workspace_id", wsId).is("deleted_at", null).order("last_activity_at", { ascending: false }).limit(2000);
  if (f.pipelineId) q = q.eq("pipeline_id", f.pipelineId);
  if (f.stageId) q = q.eq("stage_id", f.stageId);
  if (f.owner) q = q.eq("responsible_user_id", f.owner);
  return applyFilter(check(await q).map(toCard), f);
}

export async function getBoard(wsId: ID, pipelineId: ID | undefined, f: LeadFilter = {}) {
  const pipelines = await listPipelines(wsId);
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
  if (!pipeline) throw new DomainError("not_found");
  const leads = await leadCards(wsId, { ...f, pipelineId: pipeline.id });
  const columns = [...pipeline.stages]
    .sort((a, b) => a.sort - b.sort)
    .map((stage) => {
      const ls = leads.filter((l) => l.stageId === stage.id);
      return { stage, leads: ls, count: ls.length, totalCents: ls.reduce((s, l) => s + l.priceCents, 0) };
    });
  const sb = await userClient();
  const inc = check(
    await sb.from("incoming_leads").select("*, contacts(name)").eq("pipeline_id", pipeline.id).eq("status", "pending").order("created_at", { ascending: false }),
  );
  const incoming: IncomingLead[] = inc.map((r: Row) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    pipelineId: r.pipeline_id,
    channelId: r.channel_id,
    conversationId: r.conversation_id,
    contactId: r.contact_id,
    kind: r.kind,
    preview: r.payload?.preview ?? "",
    who: r.contacts?.name ?? "Contato novo",
    status: r.status,
    resolvedLeadId: r.resolved_lead_id,
    resolvedBy: r.resolved_by,
    createdAt: isoReq(r.created_at),
  }));
  return { pipeline, pipelines, columns, incoming };
}

export async function listLeads(wsId: ID, f: LeadFilter & { pipelineId?: ID; stageId?: ID } = {}) {
  const [cards, pipelines] = await Promise.all([leadCards(wsId, f), listPipelines(wsId)]);
  const stages = new Map(pipelines.flatMap((p) => p.stages).map((s) => [s.id, s]));
  return cards.map((l) => ({ ...l, stage: stages.get(l.stageId)! }));
}

async function leadRow(id: ID): Promise<Lead> {
  const sb = await userClient();
  const { data, error } = await sb.from("leads").select("*, lead_tags(tags(name))").eq("id", id).maybeSingle();
  if (error) throw toDomain(error);
  if (!data) throw new DomainError("not_found");
  return toLead(data);
}

export async function createLead(
  wsId: ID,
  actor: ID,
  input: { pipelineId: ID; stageId: ID; name: string; priceCents: number; contactName?: string; contactPhone?: string },
) {
  const sb = await userClient();
  const lead = check(
    await sb
      .from("leads")
      .insert({ workspace_id: wsId, pipeline_id: input.pipelineId, stage_id: input.stageId, name: input.name.trim(), price_cents: Math.max(0, Math.round(input.priceCents)), responsible_user_id: actor, created_by: actor, source: "manual" })
      .select("id")
      .single(),
  );
  if (input.contactName?.trim() || input.contactPhone?.trim()) {
    const phone = input.contactPhone?.replace(/[^\d+]/g, "") ?? "";
    let contactId: string | null = null;
    if (phone) {
      const { data } = await sb.from("contact_identities").select("contact_id").eq("workspace_id", wsId).eq("kind", "phone").eq("value", phone).maybeSingle();
      contactId = data?.contact_id ?? null;
    }
    if (!contactId) {
      const c = check(await sb.from("contacts").insert({ workspace_id: wsId, name: input.contactName?.trim() || phone, responsible_user_id: actor, created_by: actor }).select("id").single());
      contactId = c.id;
      if (phone) check(await sb.from("contact_identities").insert({ workspace_id: wsId, contact_id: contactId, kind: "phone", value: phone, is_primary: true }));
    }
    check(await sb.from("lead_contacts").insert({ lead_id: lead.id, contact_id: contactId, workspace_id: wsId, is_main: true }));
  }
  return leadRow(lead.id);
}

async function setTags(wsId: ID, leadId: ID, tags: string[]) {
  const sb = await userClient();
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  if (clean.length) check(await sb.from("tags").upsert(clean.map((name) => ({ workspace_id: wsId, name })), { onConflict: "workspace_id,name", ignoreDuplicates: true }));
  const ids = clean.length ? check(await sb.from("tags").select("id").eq("workspace_id", wsId).in("name", clean)).map((t: Row) => t.id) : [];
  check(await sb.from("lead_tags").delete().eq("lead_id", leadId));
  if (ids.length) check(await sb.from("lead_tags").insert(ids.map((tag_id: string) => ({ lead_id: leadId, tag_id, workspace_id: wsId }))));
}

export async function updateLead(wsId: ID, _actor: ID, id: ID, patch: Partial<Pick<Lead, "name" | "priceCents" | "responsibleUserId" | "tags">>) {
  const sb = await userClient();
  const row: Row = { last_activity_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.priceCents !== undefined) {
    if (patch.priceCents < 0 || !Number.isFinite(patch.priceCents)) throw new DomainError("invalid", "Valor inválido.");
    row.price_cents = Math.round(patch.priceCents);
  }
  if (patch.responsibleUserId !== undefined) row.responsible_user_id = patch.responsibleUserId;
  const updated = check(await sb.from("leads").update(row).eq("id", id).eq("workspace_id", wsId).select("id"));
  if (!updated.length) throw new DomainError("forbidden");
  if (patch.tags) await setTags(wsId, id, patch.tags);
  return leadRow(id);
}

export async function moveLead(wsId: ID, _actor: ID, id: ID, stageId: ID, lossReasonId?: ID | null) {
  const sb = await userClient();
  const updated = check(
    await sb.from("leads").update({ stage_id: stageId, loss_reason_id: lossReasonId ?? null, last_activity_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", wsId).select("id"),
  );
  if (!updated.length) throw new DomainError("forbidden");
  return leadRow(id);
}

export async function deleteLead(wsId: ID, id: ID) {
  const sb = await userClient();
  // exclusão lógica; a limpeza definitiva roda num job depois de 30 dias
  const updated = check(await sb.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", wsId).select("id"));
  if (!updated.length) throw new DomainError("forbidden");
}

// ---------------------------------------------------------------------------
// cartão do lead
// ---------------------------------------------------------------------------
export async function getLead(wsId: ID, id: ID) {
  const sb = await userClient();
  const { data: r, error } = await sb.from("leads").select(LEAD_SELECT).eq("id", id).eq("workspace_id", wsId).is("deleted_at", null).maybeSingle();
  if (error) throw toDomain(error);
  if (!r) throw new DomainError("not_found");
  const lead = toCard(r);
  const [pipelines, users] = await Promise.all([listPipelines(wsId), listUsers(wsId)]);
  const pipeline = pipelines.find((p) => p.id === lead.pipelineId)!;
  const stageName = (sid: unknown) => pipeline.stages.find((s) => s.id === sid)?.name ?? "—";
  const userName = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? "Sistema";
  const contacts: Contact[] = (r.lead_contacts ?? [])
    .sort((a: Row, b: Row) => Number(b.is_main) - Number(a.is_main))
    .map((x: Row) => toContact(x.contacts));
  const company = lead.companyId ? toCompany(check(await sb.from("companies").select("*").eq("id", lead.companyId).single())) : null;
  const convRow = (await sb.from("conversations").select("*, channels(*)").eq("lead_id", id).order("last_message_at", { ascending: false }).limit(1).maybeSingle()).data;
  const conversation = convRow ? toConversation(convRow) : null;
  const channel = convRow?.channels ? toChannel(convRow.channels) : null;

  const [msgs, notes, tasks, events] = await Promise.all([
    conversation ? sb.from("messages").select("*").eq("conversation_id", conversation.id).order("sent_at").limit(500) : Promise.resolve({ data: [], error: null }),
    sb.from("notes").select("*").eq("lead_id", id).order("created_at"),
    sb.from("tasks").select("*").eq("lead_id", id).order("created_at"),
    sb.from("events").select("*").eq("lead_id", id).order("created_at"),
  ]);
  const brl = (c: unknown) => (Number(c) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const text = (e: Row) => {
    const b = e.before ?? {};
    const a = e.after ?? {};
    switch (e.kind) {
      case "lead_created":
        return `${userName(e.actor_user_id)} criou o lead`;
      case "stage_changed":
        return `${userName(e.actor_user_id)} moveu de ${stageName(b.stage_id)} para ${stageName(a.stage_id)}`;
      case "responsible_changed":
        return `Responsável: ${userName(b.user_id ?? null)} → ${userName(a.user_id ?? null)}`;
      case "price_changed":
        return `Valor: ${brl(b.price_cents)} → ${brl(a.price_cents)}`;
      case "name_changed":
        return `Nome alterado para “${a.name}”`;
      case "task_completed":
        return `${userName(e.actor_user_id)} concluiu uma tarefa`;
      case "contact_linked":
        return `${userName(e.actor_user_id)} vinculou um contato`;
      case "automation_ran":
        return `Robô “${a.robot ?? ""}”: ${a.text ?? ""}`;
      default:
        return e.kind;
    }
  };
  const feed: FeedItem[] = [
    ...check(msgs as { data: Row[]; error: PostgrestError | null }).map((m: Row) => ({ type: "message" as const, at: isoReq(m.sent_at), message: toMessage(m), channelKind: channel!.kind })),
    ...check(notes).map((n: Row) => ({
      type: "note" as const,
      at: isoReq(n.created_at),
      note: { id: n.id, leadId: n.lead_id, contactId: n.contact_id, body: n.body, createdBy: n.created_by, createdAt: isoReq(n.created_at) } satisfies Note,
      author: userName(n.created_by),
    })),
    ...check(tasks).map((t: Row) => ({ type: "task" as const, at: iso(t.completed_at) ?? isoReq(t.created_at), task: toTask(t) })),
    ...check(events).map((e: Row) => ({
      type: "event" as const,
      at: isoReq(e.created_at),
      event: { id: e.id, leadId: e.lead_id, kind: e.kind, before: e.before, after: e.after, actorUserId: e.actor_user_id, createdAt: isoReq(e.created_at) } as LeadEvent,
      text: text(e),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return { lead, pipeline, contacts, company, conversation, channel, feed };
}

// ---------------------------------------------------------------------------
// notas e tarefas
// ---------------------------------------------------------------------------
export async function addNote(wsId: ID, actor: ID, leadId: ID, body: string) {
  if (!body.trim()) throw new DomainError("invalid", "A nota está vazia.");
  const sb = await userClient();
  check(await sb.from("notes").insert({ workspace_id: wsId, lead_id: leadId, body: body.trim(), created_by: actor }));
  await sb.from("leads").update({ last_activity_at: new Date().toISOString() }).eq("id", leadId);
}

export async function createTask(wsId: ID, actor: ID, input: { leadId: ID | null; text: string; dueAt: string; taskTypeId: ID | null; responsibleUserId?: ID }) {
  if (Number.isNaN(Date.parse(input.dueAt))) throw new DomainError("invalid", "Prazo inválido.");
  const sb = await userClient();
  const r = check(
    await sb
      .from("tasks")
      .insert({ workspace_id: wsId, lead_id: input.leadId, text: input.text.trim(), due_at: new Date(input.dueAt).toISOString(), task_type_id: input.taskTypeId, responsible_user_id: input.responsibleUserId ?? actor, created_by: actor })
      .select("*")
      .single(),
  );
  return toTask(r);
}

export async function completeTask(wsId: ID, actor: ID, taskId: ID, resultText: string) {
  const sb = await userClient();
  const r = check(
    await sb.from("tasks").update({ completed_at: new Date().toISOString(), result_text: resultText.trim() || null }).eq("id", taskId).eq("workspace_id", wsId).is("completed_at", null).select("*").maybeSingle(),
  );
  if (!r) return toTask(check(await sb.from("tasks").select("*").eq("id", taskId).single()));
  if (r.lead_id) await sb.from("events").insert({ workspace_id: wsId, lead_id: r.lead_id, kind: "task_completed", after: { task_id: taskId }, actor_user_id: actor });
  return toTask(r);
}

export async function listTasks(wsId: ID, f: { from?: string; to?: string; owner?: ID; open?: boolean } = {}) {
  const sb = await userClient();
  let q = sb.from("tasks").select("*, leads(*, lead_tags(tags(name))), profiles:responsible_user_id(full_name)").eq("workspace_id", wsId).order("due_at").limit(1000);
  if (f.owner) q = q.eq("responsible_user_id", f.owner);
  if (f.open === true) q = q.is("completed_at", null);
  if (f.open === false) q = q.not("completed_at", "is", null);
  if (f.from) q = q.gte("due_at", f.from);
  if (f.to) q = q.lt("due_at", f.to);
  return check(await q).map((t: Row) => ({ ...toTask(t), lead: t.leads ? toLead(t.leads) : null, owner: t.profiles?.full_name ?? "" }));
}

// ---------------------------------------------------------------------------
// leads de entrada
// ---------------------------------------------------------------------------
export async function acceptIncoming(_wsId: ID, _actor: ID, id: ID) {
  const sb = await userClient();
  const leadId = check(await sb.rpc("accept_incoming_lead", { p_incoming: id }));
  return leadRow(leadId as string);
}
export async function declineIncoming(_wsId: ID, _actor: ID, id: ID) {
  const sb = await userClient();
  check(await sb.rpc("decline_incoming_lead", { p_incoming: id }));
}
export async function linkIncoming(_wsId: ID, _actor: ID, id: ID, leadId: ID) {
  const sb = await userClient();
  check(await sb.rpc("link_incoming_lead", { p_incoming: id, p_lead: leadId }));
  return leadRow(leadId);
}

// ---------------------------------------------------------------------------
// conversas
// ---------------------------------------------------------------------------
export async function listConversations(wsId: ID, actor: ID, f: ConvFilter = "all") {
  const sb = await userClient();
  let q = sb
    .from("conversations")
    .select("*, contacts(*, contact_identities(kind, value)), channels(*), leads(*, lead_tags(tags(name)))")
    .eq("workspace_id", wsId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (f === "unread") q = q.gt("unread_count", 0);
  if (f === "unanswered") q = q.eq("is_unanswered", true);
  if (f === "mine") q = q.eq("assigned_user_id", actor);
  return check(await q).map((c: Row) => ({ ...toConversation(c), contact: toContact(c.contacts), channel: toChannel(c.channels), lead: c.leads ? toLead(c.leads) : null }));
}

export async function getConversation(wsId: ID, id: ID) {
  const sb = await userClient();
  const { data: c, error } = await sb.from("conversations").select("*, contacts(*, contact_identities(kind, value)), channels(*)").eq("id", id).eq("workspace_id", wsId).maybeSingle();
  if (error) throw toDomain(error);
  if (!c) throw new DomainError("not_found");
  const lead = c.lead_id ? toCard(check(await sb.from("leads").select(LEAD_SELECT).eq("id", c.lead_id).single())) : null;
  const messages = check(await sb.from("messages").select("*").eq("conversation_id", id).order("sent_at").limit(500)).map(toMessage);
  return { conversation: toConversation(c), contact: toContact(c.contacts), channel: toChannel(c.channels), lead, messages };
}

export async function markConversationRead(wsId: ID, id: ID) {
  const sb = await userClient();
  await sb.from("conversations").update({ unread_count: 0 }).eq("id", id).eq("workspace_id", wsId);
}

const WINDOW_MS = 24 * 60 * 60 * 1000;
export const windowClosed = (c: Conversation, kind: ChannelKind) =>
  kind === "whatsapp" && (!c.lastInboundAt || Date.now() - Date.parse(c.lastInboundAt) > WINDOW_MS);

export async function sendMessage(wsId: ID, actor: ID, conversationId: ID, body: string, clientId: string) {
  if (!body.trim()) throw new DomainError("invalid", "A mensagem está vazia.");
  const { conversation, channel } = await getConversation(wsId, conversationId);
  if (windowClosed(conversation, channel.kind)) throw new DomainError("window_closed", "Fora da janela de 24h. Use um modelo aprovado.");
  const sb = await userClient();
  const { data: dup } = await sb.from("messages").select("*").eq("conversation_id", conversationId).eq("client_id", clientId).maybeSingle();
  if (dup) return toMessage(dup);
  // chat do site: a mensagem já está "enviada" quando grava. WhatsApp/Instagram: entra como "queued" e o envio à API do canal acontece num job (a construir junto com o canal).
  const status = channel.kind === "webchat" ? "sent" : "queued";
  const r = check(
    await sb
      .from("messages")
      .insert({ workspace_id: wsId, conversation_id: conversationId, channel_id: channel.id, direction: "out", body: body.trim(), sender_user_id: actor, client_id: clientId, status })
      .select("*")
      .single(),
  );
  if (!conversation.aiPaused) await sb.from("conversations").update({ ai_paused: true }).eq("id", conversationId); // vendedor assumiu: a IA para
  return toMessage(r);
}

// ---------------------------------------------------------------------------
// chat do site (público): só pelo servidor, com a chave secreta
// ---------------------------------------------------------------------------
export async function getWebchat(publicKey: string) {
  const { data } = await adminClient().from("channels").select("id, workspace_id, workspaces(name)").eq("kind", "webchat").eq("public_key", publicKey).eq("status", "connected").maybeSingle();
  if (!data) throw new DomainError("not_found");
  const ws = data.workspaces as unknown as { name: string } | null;
  return { channelId: data.id as string, workspaceId: data.workspace_id as string, workspaceName: ws?.name ?? "" };
}

export async function visitorThread(publicKey: string, visitorId: string): Promise<Message[]> {
  const rows = check(await adminClient().rpc("visitor_thread", { p_key: publicKey, p_thread: visitorId })) as Row[];
  return rows.map((m) => ({ id: m.id, conversationId: "", direction: m.direction, body: m.body, senderUserId: null, clientId: null, status: "received", sentAt: isoReq(m.sent_at) }));
}

export async function receiveInbound(channelId: ID, externalThreadId: string, senderName: string, body: string, externalId: string): Promise<{ conversationId: ID; isNew: boolean } | null> {
  const a = adminClient();
  const msgId = check(await a.rpc("receive_inbound", { p_channel: channelId, p_thread: externalThreadId, p_sender_name: senderName, p_body: body, p_external_id: externalId })) as string | null;
  if (!msgId) return null; // repetida
  const m = check(await a.from("messages").select("conversation_id").eq("id", msgId).single());
  const { count } = await a.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", m.conversation_id).eq("direction", "in");
  return { conversationId: m.conversation_id, isNew: count === 1 };
}

// ---------------------------------------------------------------------------
// contatos, empresas, canais, busca, painel
// ---------------------------------------------------------------------------
export async function listContacts(wsId: ID, q = "") {
  const sb = await userClient();
  let query = sb
    .from("contacts")
    .select("*, contact_identities(kind, value), companies(*), lead_contacts(lead_id), profiles:responsible_user_id(full_name)")
    .eq("workspace_id", wsId)
    .is("deleted_at", null)
    .order("name")
    .limit(500);
  if (q.trim()) query = query.ilike("name", `%${q.trim().replace(/[%_]/g, "")}%`);
  return check(await query).map((c: Row) => ({
    ...toContact(c),
    company: c.companies ? toCompany(c.companies) : null,
    leadCount: (c.lead_contacts ?? []).length,
    owner: c.profiles?.full_name ?? null,
  }));
}

export async function getContact(wsId: ID, id: ID) {
  const sb = await userClient();
  const { data: c, error } = await sb.from("contacts").select("*, contact_identities(kind, value), companies(*), lead_contacts(leads(*, lead_tags(tags(name))))").eq("id", id).eq("workspace_id", wsId).maybeSingle();
  if (error) throw toDomain(error);
  if (!c) throw new DomainError("not_found");
  const stages = new Map((await listPipelines(wsId)).flatMap((p) => p.stages).map((s) => [s.id, s]));
  const leads = (c.lead_contacts ?? []).map((x: Row) => x.leads).filter(Boolean).map((l: Row) => ({ ...toLead(l), stage: stages.get(l.stage_id)! }));
  return { contact: toContact(c), company: c.companies ? toCompany(c.companies) : null, leads };
}

export async function createContact(wsId: ID, actor: ID, input: { name: string; phone?: string; email?: string }) {
  const sb = await userClient();
  const c = check(await sb.from("contacts").insert({ workspace_id: wsId, name: input.name.trim(), responsible_user_id: actor, created_by: actor }).select("*").single());
  const ids = [
    ...(input.phone ? [{ kind: "phone", value: input.phone.replace(/[^\d+]/g, "") }] : []),
    ...(input.email ? [{ kind: "email", value: input.email.trim().toLowerCase() }] : []),
  ].filter((i) => i.value);
  if (ids.length) check(await sb.from("contact_identities").insert(ids.map((i) => ({ ...i, workspace_id: wsId, contact_id: c.id }))));
  return toContact({ ...c, contact_identities: ids });
}

export async function listCompanies(wsId: ID) {
  const sb = await userClient();
  return check(await sb.from("companies").select("*, contacts(id), leads(id)").eq("workspace_id", wsId).is("deleted_at", null).order("name")).map((c: Row) => ({
    ...toCompany(c),
    contactCount: (c.contacts ?? []).length,
    leadCount: (c.leads ?? []).length,
  }));
}

export async function getCompany(wsId: ID, id: ID) {
  const sb = await userClient();
  const { data: c, error } = await sb.from("companies").select("*, contacts(*, contact_identities(kind, value)), leads(*, lead_tags(tags(name)))").eq("id", id).eq("workspace_id", wsId).maybeSingle();
  if (error) throw toDomain(error);
  if (!c) throw new DomainError("not_found");
  const stages = new Map((await listPipelines(wsId)).flatMap((p) => p.stages).map((s) => [s.id, s]));
  return {
    company: toCompany(c),
    contacts: (c.contacts ?? []).map(toContact),
    leads: (c.leads ?? []).map((l: Row) => ({ ...toLead(l), stage: stages.get(l.stage_id)! })),
  };
}

export async function listChannels(wsId: ID): Promise<Channel[]> {
  const sb = await userClient();
  return check(await sb.from("channels").select("*").eq("workspace_id", wsId).order("created_at")).map(toChannel);
}

export async function search(wsId: ID, q: string) {
  const s = q.trim().replace(/[%_,()]/g, "");
  if (s.length < 2) return { leads: [] as Lead[], contacts: [] as Contact[], companies: [] as Company[] };
  const sb = await userClient();
  const num = s.replace(/^#/, "");
  const [leads, contacts, byPhone, companies] = await Promise.all([
    sb.from("leads").select("*, lead_tags(tags(name))").eq("workspace_id", wsId).is("deleted_at", null).or(/^\d+$/.test(num) ? `name.ilike.%${s}%,number.eq.${num}` : `name.ilike.%${s}%`).limit(5),
    sb.from("contacts").select("*, contact_identities(kind, value)").eq("workspace_id", wsId).is("deleted_at", null).ilike("name", `%${s}%`).limit(5),
    sb.from("contact_identities").select("contacts(*, contact_identities(kind, value))").eq("workspace_id", wsId).ilike("value", `%${s}%`).limit(5),
    sb.from("companies").select("*").eq("workspace_id", wsId).is("deleted_at", null).ilike("name", `%${s}%`).limit(5),
  ]);
  const cs = new Map<string, Contact>();
  for (const c of check(contacts)) cs.set(c.id, toContact(c));
  for (const r of check(byPhone)) if (r.contacts) cs.set((r.contacts as unknown as Row).id, toContact(r.contacts as unknown as Row));
  return { leads: check(leads).map(toLead), contacts: [...cs.values()].slice(0, 5), companies: check(companies).map(toCompany) };
}

export async function getDashboard(wsId: ID, f: { from: string; owner?: ID }) {
  const sb = await userClient();
  const [pipelines, leads, convs, inbound, tasks] = await Promise.all([
    listPipelines(wsId),
    (() => {
      let q = sb.from("leads").select("*").eq("workspace_id", wsId).is("deleted_at", null).limit(5000);
      if (f.owner) q = q.eq("responsible_user_id", f.owner);
      return q;
    })(),
    sb.from("conversations").select("id, is_unanswered").eq("workspace_id", wsId).eq("status", "open"),
    sb.from("messages").select("channels(name)").eq("workspace_id", wsId).eq("direction", "in").gte("sent_at", f.from).limit(10000),
    (() => {
      let q = sb.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).is("completed_at", null);
      if (f.owner) q = q.eq("responsible_user_id", f.owner);
      return q;
    })(),
  ]);
  const kinds = new Map(pipelines.flatMap((p) => p.stages).map((s) => [s.id, s.kind]));
  const ls: Lead[] = check(leads).map(toLead);
  const byChannel = new Map<string, number>();
  for (const m of check(inbound)) {
    const n = (m.channels as unknown as Row)?.name ?? "—";
    byChannel.set(n, (byChannel.get(n) ?? 0) + 1);
  }
  const open = check(convs);
  return {
    won: ls.filter((l) => kinds.get(l.stageId) === "won" && l.closedAt && l.closedAt >= f.from),
    lost: ls.filter((l) => kinds.get(l.stageId) === "lost" && l.closedAt && l.closedAt >= f.from),
    active: ls.filter((l) => kinds.get(l.stageId) === "open"),
    withoutTask: ls.filter((l) => kinds.get(l.stageId) === "open" && !l.closestTaskAt),
    openConversations: open.length,
    unanswered: open.filter((c: Row) => c.is_unanswered).length,
    inboundByChannel: [...byChannel.entries()].map(([name, count]) => ({ name, count })),
    tasksDue: tasks.count ?? 0,
  };
}

export * from "./robots";
export * from "./extras";
export * from "./attribution";
export * from "./channels";
export * from "./agent";
