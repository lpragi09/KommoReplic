import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { userClient } from "@/lib/supabase/clients";
import { DomainError, type ActivityEvent, type ChannelKind, type ID, type MessageStats, type RoiReport, type SalesGoal } from "../types";

/* Estatísticas no Supabase. Tudo pela sessão de quem está vendo (RLS): cada um só conta o que pode ver.
   Mensagens por canal são somadas no banco (função message_stats), sem trazer as mensagens para o servidor. */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Só administradores mudam isso.");
    if (r.error.code === "42P01") throw new DomainError("invalid", "Rode o atualizacao-estatisticas.sql no Supabase.");
    throw new Error(r.error.message);
  }
  return r.data;
}
const iso = (v: string) => new Date(v).toISOString();
const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

export async function getActivity(wsId: ID, from: string): Promise<ActivityEvent[]> {
  const sb = await userClient();
  const [ev, notes, created, done] = await Promise.all([
    sb.from("events").select("id, kind, lead_id, before, after, actor_user_id, created_at").eq("workspace_id", wsId).gte("created_at", from).neq("kind", "task_completed").order("created_at", { ascending: false }).limit(3000),
    sb.from("notes").select("id, lead_id, body, created_by, created_at").eq("workspace_id", wsId).gte("created_at", from).not("lead_id", "is", null).order("created_at", { ascending: false }).limit(1500),
    sb.from("tasks").select("id, lead_id, text, responsible_user_id, created_at").eq("workspace_id", wsId).gte("created_at", from).order("created_at", { ascending: false }).limit(1500),
    sb.from("tasks").select("id, lead_id, text, responsible_user_id, completed_at").eq("workspace_id", wsId).gte("completed_at", from).order("completed_at", { ascending: false }).limit(1500),
  ]);
  const out: ActivityEvent[] = [];
  for (const e of (ev.data ?? []) as Row[]) {
    const b = e.before ?? {};
    const a = e.after ?? {};
    out.push({
      id: e.id,
      at: iso(e.created_at),
      kind: e.kind,
      leadId: e.lead_id,
      actorUserId: e.actor_user_id,
      stageFrom: str(b.stage_id),
      stageTo: str(a.stage_id),
      userFrom: str(b.user_id),
      userTo: str(a.user_id),
      centsFrom: num(b.price_cents),
      centsTo: num(a.price_cents),
      nameFrom: str(b.name),
      nameTo: str(a.name),
      robot: str(a.robot),
      text: str(a.text),
    });
  }
  for (const n of (notes.data ?? []) as Row[]) out.push({ id: n.id, at: iso(n.created_at), kind: "note_added", leadId: n.lead_id, actorUserId: n.created_by, text: n.body });
  for (const t of (created.data ?? []) as Row[]) out.push({ id: `${t.id}:c`, at: iso(t.created_at), kind: "task_created", leadId: t.lead_id, actorUserId: t.responsible_user_id, text: t.text });
  for (const t of (done.data ?? []) as Row[]) out.push({ id: `${t.id}:d`, at: iso(t.completed_at), kind: "task_done", leadId: t.lead_id, actorUserId: t.responsible_user_id, text: t.text });
  return out.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 5000);
}

export async function getMessageStats(wsId: ID, from: string): Promise<MessageStats[]> {
  const sb = await userClient();
  const { data, error } = await sb.rpc("message_stats", { p_ws: wsId, p_from: from });
  if (error) return []; // banco sem a atualização: a aba mostra vazio
  return ((data ?? []) as Row[]).map((r) => ({
    kind: r.kind as ChannelKind,
    received: Number(r.received) || 0,
    sent: Number(r.sent) || 0,
    delivered: Number(r.delivered) || 0,
    read: Number(r.read) || 0,
    failed: Number(r.failed) || 0,
    byAi: Number(r.by_ai) || 0,
  }));
}

export async function listGoals(wsId: ID, month: string): Promise<SalesGoal[]> {
  const sb = await userClient();
  const { data, error } = await sb.from("sales_goals").select("user_id, cents, count").eq("workspace_id", wsId).eq("month", month);
  if (error) return [];
  return ((data ?? []) as Row[]).map((r) => ({ userId: r.user_id, cents: Number(r.cents) || 0, count: r.count ?? 0 }));
}

export async function saveGoals(wsId: ID, month: string, goals: SalesGoal[]) {
  const sb = await userClient();
  check(await sb.from("sales_goals").delete().eq("workspace_id", wsId).eq("month", month));
  const rows = goals.filter((x) => x.cents > 0 || x.count > 0).map((x) => ({ workspace_id: wsId, month, user_id: x.userId, cents: x.cents, count: x.count }));
  if (rows.length) check(await sb.from("sales_goals").insert(rows));
}

const toRoi = (r: Row): RoiReport => ({
  id: r.id,
  name: r.name,
  investmentCents: Number(r.investment_cents) || 0,
  utmSource: r.utm_source,
  utmCampaign: r.utm_campaign,
  from: r.from_date,
  to: r.to_date,
  createdAt: iso(r.created_at),
});

export async function listRoiReports(wsId: ID): Promise<RoiReport[]> {
  const sb = await userClient();
  const { data, error } = await sb.from("roi_reports").select("*").eq("workspace_id", wsId).order("created_at");
  if (error) return [];
  return (data as Row[]).map(toRoi);
}

export async function saveRoiReport(wsId: ID, id: ID | null, input: Omit<RoiReport, "id" | "createdAt">): Promise<RoiReport> {
  const sb = await userClient();
  const row = { workspace_id: wsId, name: input.name, investment_cents: input.investmentCents, utm_source: input.utmSource, utm_campaign: input.utmCampaign, from_date: input.from, to_date: input.to };
  if (!id) {
    const { count } = await sb.from("roi_reports").select("id", { count: "exact", head: true }).eq("workspace_id", wsId);
    if ((count ?? 0) >= 25) throw new DomainError("invalid", "Dá para ter até 25 relatórios de ROI. Apague um antigo.");
  }
  const r = id ? check(await sb.from("roi_reports").update(row).eq("workspace_id", wsId).eq("id", id).select("*").maybeSingle()) : check(await sb.from("roi_reports").insert(row).select("*").single());
  if (!r) throw new DomainError("not_found");
  return toRoi(r);
}

export async function deleteRoiReport(wsId: ID, id: ID) {
  const sb = await userClient();
  check(await sb.from("roi_reports").delete().eq("workspace_id", wsId).eq("id", id));
}
