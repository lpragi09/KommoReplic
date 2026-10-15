import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { renderText } from "../robots/engine";
import {
  DomainError,
  type Broadcast,
  type BroadcastFilter,
  type ChannelKind,
  type CustomField,
  type FieldValue,
  type ID,
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
  let userId: string | null = check(await a.from("profiles").select("id").eq("email", email).maybeSingle())?.id ?? null;
  if (!userId) {
    const { data, error } = await a.auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { full_name: input.name.trim() } });
    if (error) throw new DomainError("invalid", error.message.includes("already") ? "Esse email já tem conta. Peça para a pessoa entrar e tente de novo." : "Não deu para criar o acesso dessa pessoa.");
    userId = data.user.id;
    await a.from("profiles").upsert({ id: userId, email, full_name: input.name.trim() }, { onConflict: "id" });
  }
  const exists = check(await a.from("memberships").select("id").eq("workspace_id", wsId).eq("user_id", userId).maybeSingle());
  if (exists) throw new DomainError("invalid", "Essa pessoa já está na equipe.");
  check(await a.from("memberships").insert({ workspace_id: wsId, user_id: userId, role_id: role.id }));
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
