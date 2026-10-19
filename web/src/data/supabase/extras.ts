import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { renderText } from "../robots/engine";
import {
  DomainError,
  type Broadcast,
  type BroadcastFilter,
  type ChannelKind,
  type CalendarMark,
  type CustomField,
  type MarkColor,
  type FieldValue,
  type ID,
  type Invite,
  type InviteInfo,
  type Lead,
  type Member,
  type Role,
  type TeamMessage,
} from "../types";

/* Equipe, campos personalizados, chat da equipe e disparos — Supabase.
   Quase tudo pela sessão do usuário (o RLS decide). A chave secreta só entra para criar o login de alguém novo. */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Você não tem permissão para isto.");
    throw new Error(r.error.message);
  }
  return r.data;
}

async function me() {
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new DomainError("unauthenticated");
  return { sb, uid: data.user.id };
}

async function assertAdmin(wsId: ID) {
  const { sb, uid } = await me();
  const m = check(await sb.from("memberships").select("roles(is_admin)").eq("workspace_id", wsId).eq("user_id", uid).eq("status", "active").maybeSingle());
  if (!m?.roles?.is_admin) throw new DomainError("forbidden", "Só administradores podem mexer na equipe.");
  return { sb, uid };
}

// ---------------------------------------------------------------------------
// equipe
// ---------------------------------------------------------------------------
export async function listMembers(wsId: ID): Promise<{ roles: Role[]; members: Member[] }> {
  const sb = await userClient();
  const [roles, rows] = await Promise.all([
    sb.from("roles").select("id, name, is_admin").eq("workspace_id", wsId).order("created_at"),
    sb.from("memberships").select("user_id, role_id, roles(name, is_admin), profiles:user_id(full_name, email)").eq("workspace_id", wsId).eq("status", "active"),
  ]);
  const members: Member[] = check(rows).map((m: Row) => ({
    userId: m.user_id,
    name: m.profiles?.full_name || m.profiles?.email || "",
    email: m.profiles?.email ?? "",
    roleId: m.role_id,
    roleName: m.roles?.name ?? "",
    isAdmin: !!m.roles?.is_admin,
  }));
  members.sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, "pt-BR"));
  return { roles: check(roles).map((r: Row) => ({ id: r.id, name: r.name, isAdmin: r.is_admin })), members };
}

export async function addMember(wsId: ID, _actor: ID, input: { name: string; email: string; password: string; roleId: ID }) {
  await assertAdmin(wsId);
  const a = adminClient();
  const email = input.email.trim().toLowerCase();
  const role = check(await a.from("roles").select("id").eq("workspace_id", wsId).eq("id", input.roleId).maybeSingle());
  if (!role) throw new DomainError("invalid", "Papel inválido.");
  // quem já tem conta só entra por convite (a pessoa aceita com a conta dela)
  const existing: string | null = check(await a.from("profiles").select("id").eq("email", email).maybeSingle())?.id ?? null;
  if (existing) {
    const inTeam = check(await a.from("memberships").select("id").eq("workspace_id", wsId).eq("user_id", existing).maybeSingle());
    throw new DomainError("invalid", inTeam ? "Essa pessoa já está na equipe." : "Esse email já tem conta. Use “Convidar por link”: a pessoa aceita com a conta dela.");
  }
  const userId = await newLogin(email, input.name, input.password);
  check(await a.from("memberships").insert({ workspace_id: wsId, user_id: userId, role_id: role.id }));
}

/** cria o login (email já confirmado: quem garante o email é o admin que convidou) e o perfil */
async function newLogin(email: string, name: string, password: string) {
  const a = adminClient();
  const { data, error } = await a.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name.trim() } });
  if (error) throw new DomainError("invalid", error.message.includes("already") ? "Esse email já tem conta. Entre com ela." : "Não deu para criar o acesso dessa pessoa.");
  await a.from("profiles").upsert({ id: data.user.id, email, full_name: name.trim() }, { onConflict: "id" });
  return data.user.id as string;
}

// ---------------------------------------------------------------------------
// convites por link (o link leva um token; o banco guarda só o hash)
// ---------------------------------------------------------------------------
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createInvite(wsId: ID, _actor: ID, input: { email: string; roleId: ID }) {
  const { sb, uid } = await assertAdmin(wsId);
  const a = adminClient();
  const email = input.email.trim().toLowerCase();
  const role = check(await sb.from("roles").select("id").eq("workspace_id", wsId).eq("id", input.roleId).maybeSingle());
  if (!role) throw new DomainError("invalid", "Papel inválido.");
  const existing: string | null = check(await a.from("profiles").select("id").eq("email", email).maybeSingle())?.id ?? null;
  if (existing && check(await a.from("memberships").select("id").eq("workspace_id", wsId).eq("user_id", existing).maybeSingle()))
    throw new DomainError("invalid", "Essa pessoa já está na equipe.");
  // um convite aberto por email (índice único): gerar de novo troca o link
  check(await sb.from("invitations").delete().eq("workspace_id", wsId).ilike("email", email).is("accepted_at", null));
  const token = randomBytes(24).toString("base64url");
  check(await sb.from("invitations").insert({ workspace_id: wsId, email, role_id: role.id, token_hash: sha(token), invited_by: uid }));
  return { token };
}

export async function listInvites(wsId: ID): Promise<Invite[]> {
  const sb = await userClient();
  const rows = check(await sb.from("invitations").select("id, email, role_id, expires_at, roles(name)").eq("workspace_id", wsId).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at"));
  return rows.map((r: Row) => ({ id: r.id, email: r.email, roleId: r.role_id, roleName: r.roles?.name ?? "", expiresAt: new Date(r.expires_at).toISOString() }));
}

export async function revokeInvite(wsId: ID, _actor: ID, id: ID) {
  const { sb } = await assertAdmin(wsId);
  check(await sb.from("invitations").delete().eq("workspace_id", wsId).eq("id", id));
}

/** página pública do convite: lê pelo hash com a chave secreta (quem abre ainda não é da empresa) */
async function inviteRow(token: string) {
  return check(await adminClient().from("invitations").select("id, workspace_id, email, role_id, expires_at, accepted_at, roles(name), workspaces(name, slug)").eq("token_hash", sha(token)).maybeSingle()) as Row | null;
}

export async function getInvite(token: string): Promise<InviteInfo | null> {
  const r = await inviteRow(token);
  if (!r?.workspaces) return null;
  return { workspaceName: r.workspaces.name, workspaceSlug: r.workspaces.slug, email: r.email, roleName: r.roles?.name ?? "", state: r.accepted_at ? "accepted" : new Date(r.expires_at) < new Date() ? "expired" : "ok" };
}

async function openInvite(token: string) {
  const r = await inviteRow(token);
  if (!r || r.accepted_at || new Date(r.expires_at) < new Date()) throw new DomainError("invalid", "Este convite não vale mais. Peça um link novo para quem convidou.");
  return r;
}

async function joinFromInvite(r: Row, userId: string) {
  const a = adminClient();
  const inTeam = check(await a.from("memberships").select("id").eq("workspace_id", r.workspace_id).eq("user_id", userId).maybeSingle());
  if (!inTeam) check(await a.from("memberships").insert({ workspace_id: r.workspace_id, user_id: userId, role_id: r.role_id }));
  check(await a.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", r.id));
  return { slug: r.workspaces.slug as string };
}

/** quem já tem conta (e está logado com o email do convite) entra na equipe */
export async function acceptInvite(token: string, userId: ID) {
  const r = await openInvite(token);
  const { data } = await (await userClient()).auth.getUser();
  if (!data.user || data.user.id !== userId || (data.user.email ?? "").toLowerCase() !== String(r.email).toLowerCase())
    throw new DomainError("invalid", `Este convite é para ${r.email}. Entre com essa conta para aceitar.`);
  return joinFromInvite(r, userId);
}

/** quem ainda não tem conta cria a senha no próprio convite (o email é o do convite) */
export async function acceptInviteNewAccount(token: string, input: { name: string; password: string }) {
  const r = await openInvite(token);
  const userId = await newLogin(String(r.email).toLowerCase(), input.name, input.password);
  const out = await joinFromInvite(r, userId);
  return { ...out, email: String(r.email).toLowerCase() };
}

async function adminsLeft(wsId: ID) {
  const rows = check(await adminClient().from("memberships").select("user_id, roles!inner(is_admin)").eq("workspace_id", wsId).eq("status", "active").eq("roles.is_admin", true));
  return rows.length as number;
}

export async function setMemberRole(wsId: ID, _actor: ID, userId: ID, roleId: ID) {
  const { sb } = await assertAdmin(wsId);
  const role = check(await sb.from("roles").select("id, is_admin").eq("workspace_id", wsId).eq("id", roleId).maybeSingle());
  if (!role) throw new DomainError("invalid", "Papel inválido.");
  const cur = check(await sb.from("memberships").select("roles(is_admin)").eq("workspace_id", wsId).eq("user_id", userId).maybeSingle());
  if (cur?.roles?.is_admin && !role.is_admin && (await adminsLeft(wsId)) <= 1) throw new DomainError("invalid", "A empresa precisa de pelo menos um administrador.");
  check(await sb.from("memberships").update({ role_id: role.id }).eq("workspace_id", wsId).eq("user_id", userId));
}

export async function removeMember(wsId: ID, _actor: ID, userId: ID) {
  const { sb } = await assertAdmin(wsId);
  const cur = check(await sb.from("memberships").select("roles(is_admin)").eq("workspace_id", wsId).eq("user_id", userId).maybeSingle());
  if (!cur) return;
  if (cur.roles?.is_admin && (await adminsLeft(wsId)) <= 1) throw new DomainError("invalid", "A empresa precisa de pelo menos um administrador.");
  check(await sb.from("memberships").delete().eq("workspace_id", wsId).eq("user_id", userId));
}

// ---------------------------------------------------------------------------
// campos personalizados do lead
// ---------------------------------------------------------------------------
const toField = (r: Row): CustomField => ({
  id: r.id,
  name: r.name,
  kind: r.kind === "multiselect" || r.kind === "datetime" ? (r.kind === "multiselect" ? "select" : "date") : r.kind,
  options: (Array.isArray(r.options) ? r.options : []).map((o: Row | string) => (typeof o === "string" ? o : o.label)).filter(Boolean),
  sort: r.sort,
});

export async function listFields(wsId: ID): Promise<CustomField[]> {
  const sb = await userClient();
  return check(await sb.from("custom_fields").select("*").eq("workspace_id", wsId).eq("entity", "lead").order("sort")).map(toField);
}

export async function saveField(wsId: ID, id: ID | null, input: Omit<CustomField, "id" | "sort">): Promise<CustomField> {
  const sb = await userClient();
  const row = { name: input.name, kind: input.kind, options: input.options.map((label) => ({ id: label, label })) };
  let r: Row | null;
  if (id) r = check(await sb.from("custom_fields").update(row).eq("workspace_id", wsId).eq("id", id).select("*").maybeSingle());
  else {
    const { count } = await sb.from("custom_fields").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("entity", "lead");
    r = check(await sb.from("custom_fields").insert({ ...row, workspace_id: wsId, entity: "lead", sort: count ?? 0 }).select("*").single());
  }
  if (!r) throw new DomainError("forbidden", "Só administradores podem alterar campos.");
  return toField(r);
}

export async function deleteField(wsId: ID, id: ID) {
  const sb = await userClient();
  const r = check(await sb.from("custom_fields").delete().eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem apagar campos.");
}

export async function getLeadCustom(wsId: ID, leadId: ID): Promise<Record<string, FieldValue>> {
  const sb = await userClient();
  const r = check(await sb.from("leads").select("custom").eq("workspace_id", wsId).eq("id", leadId).maybeSingle());
  if (!r) throw new DomainError("not_found");
  return (r.custom ?? {}) as Record<string, FieldValue>;
}

export async function setLeadCustom(wsId: ID, _actor: ID, leadId: ID, fieldId: ID, value: FieldValue) {
  const sb = await userClient();
  const cur = await getLeadCustom(wsId, leadId);
  if (value === null || value === "") delete cur[fieldId];
  else cur[fieldId] = value;
  const r = check(await sb.from("leads").update({ custom: cur, last_activity_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("id", leadId).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Você não pode editar este lead.");
}

// ---------------------------------------------------------------------------
// chat da equipe
// ---------------------------------------------------------------------------
export async function listTeamMessages(wsId: ID): Promise<TeamMessage[]> {
  const sb = await userClient();
  const rows = check(await sb.from("team_messages").select("id, user_id, body, created_at, profiles:user_id(full_name, email)").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(200));
  return rows
    .reverse()
    .map((m: Row) => ({ id: m.id, userId: m.user_id, userName: m.profiles?.full_name || m.profiles?.email || "Alguém", body: m.body, createdAt: new Date(m.created_at).toISOString() }));
}

export async function sendTeamMessage(wsId: ID, _actor: ID, body: string) {
  if (!body.trim()) throw new DomainError("invalid", "A mensagem está vazia.");
  const { sb, uid } = await me();
  check(await sb.from("team_messages").insert({ workspace_id: wsId, user_id: uid, body: body.trim() }));
}

// ---------------------------------------------------------------------------
// disparos
// ---------------------------------------------------------------------------
async function audience(wsId: ID, f: BroadcastFilter) {
  const sb = await userClient();
  let q = sb
    .from("leads")
    .select("*, lead_tags(tags(name)), lead_contacts(is_main, contacts(name)), conversations(id, channel_id, last_inbound_at, contacts(name), channels(kind)), profiles:responsible_user_id(full_name)")
    .eq("workspace_id", wsId)
    .is("deleted_at", null)
    .limit(2000);
  if (f.pipelineId) q = q.eq("pipeline_id", f.pipelineId);
  if (f.stageIds.length) q = q.in("stage_id", f.stageIds);
  const rows: Row[] = check(await q);
  return rows
    .map((r) => {
      const tags: string[] = (r.lead_tags ?? []).map((t: Row) => t.tags?.name).filter(Boolean);
      const conv: Row | undefined = (r.conversations ?? [])[0];
      const main = (r.lead_contacts ?? []).find((x: Row) => x.is_main) ?? (r.lead_contacts ?? [])[0];
      const lead = { id: r.id, name: r.name, number: Number(r.number), pipelineId: r.pipeline_id, stageId: r.stage_id, tags } as unknown as Lead;
      return { lead, tags, conv, kind: (conv?.channels?.kind ?? null) as ChannelKind | null, contactName: conv?.contacts?.name ?? main?.contacts?.name ?? "", responsible: r.profiles?.full_name ?? "" };
    })
    .filter((x) => (!f.tag || x.tags.includes(f.tag)) && (!f.channels.length || (x.kind && f.channels.includes(x.kind))));
}

export async function previewBroadcast(wsId: ID, f: BroadcastFilter) {
  const a = await audience(wsId, f);
  return { leads: a.length, reachable: a.filter((x) => x.conv).length };
}

export async function sendBroadcast(wsId: ID, _actor: ID, input: { name: string; body: string; filter: BroadcastFilter }): Promise<Broadcast> {
  const { sb, uid } = await me();
  const ws = check(await sb.from("workspaces").select("name").eq("id", wsId).single());
  const targets = await audience(wsId, input.filter);
  let sent = 0;
  let failed = 0;
  const rows: Row[] = [];
  for (const t of targets) {
    if (!t.conv || !t.kind || (t.kind === "whatsapp" && (!t.conv.last_inbound_at || Date.now() - Date.parse(t.conv.last_inbound_at) > 864e5))) {
      failed++;
      continue;
    }
    const body = renderText(input.body, { wsName: ws.name, lead: t.lead, contactName: t.contactName, conversation: null, channelKind: t.kind, responsibleName: t.responsible });
    rows.push({ workspace_id: wsId, conversation_id: t.conv.id, channel_id: t.conv.channel_id, direction: "out", body, sender_user_id: uid, status: t.kind === "webchat" ? "sent" : "queued" });
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("messages").insert(rows.slice(i, i + 200));
    if (error) failed += Math.min(200, rows.length - i);
    else sent += Math.min(200, rows.length - i);
  }
  const b = check(
    await sb
      .from("broadcasts")
      .insert({ workspace_id: wsId, name: input.name.trim(), body: input.body.trim(), filter: input.filter, total: targets.length, sent, failed, created_by: uid })
      .select("*")
      .single(),
  );
  return { id: b.id, name: b.name, body: b.body, filter: b.filter, total: b.total, sent: b.sent, failed: b.failed, createdBy: "", createdAt: new Date(b.created_at).toISOString() };
}

export async function listBroadcasts(wsId: ID): Promise<Broadcast[]> {
  const sb = await userClient();
  return check(await sb.from("broadcasts").select("*, profiles:created_by(full_name)").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(100)).map((b: Row) => ({
    id: b.id,
    name: b.name,
    body: b.body,
    filter: b.filter,
    total: b.total,
    sent: b.sent,
    failed: b.failed,
    createdBy: b.profiles?.full_name ?? "",
    createdAt: new Date(b.created_at).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// marcações do calendário
// ---------------------------------------------------------------------------
const toMark = (r: Row): CalendarMark => ({ id: r.id, date: r.date, label: r.label, color: r.color, note: r.note ?? null, createdBy: r.profiles?.full_name ?? "" });

export async function listMarks(wsId: ID, from: string, to: string): Promise<CalendarMark[]> {
  const sb = await userClient();
  const { data, error } = await sb.from("calendar_marks").select("*, profiles:created_by(full_name)").eq("workspace_id", wsId).gte("date", from).lte("date", to).order("date");
  if (error) return []; // banco sem a atualização: calendário abre sem marcações
  return (data ?? []).map(toMark);
}

export async function saveMark(wsId: ID, _actor: ID, id: ID | null, input: { date: string; label: string; color: MarkColor; note: string | null }): Promise<CalendarMark> {
  const { sb, uid } = await me();
  const r = id
    ? check(await sb.from("calendar_marks").update(input).eq("workspace_id", wsId).eq("id", id).select("*").maybeSingle())
    : check(await sb.from("calendar_marks").insert({ ...input, workspace_id: wsId, created_by: uid }).select("*").single());
  if (!r) throw new DomainError("not_found");
  return toMark(r);
}

export async function deleteMark(wsId: ID, id: ID) {
  const sb = await userClient();
  check(await sb.from("calendar_marks").delete().eq("workspace_id", wsId).eq("id", id));
}
