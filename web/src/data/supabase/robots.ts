import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { fireRobots as fire, tickRobots as tick, type RobotPort } from "../robots/engine";
import { DomainError, type Conversation, type ID, type Lead, type Robot, type RobotEvent, type RobotInput, type RobotRun, type Template } from "../types";

/* Robôs e modelos no Supabase.
   - Execução: chave secreta (adminClient), sempre filtrando por workspace_id — o robô age como "sistema".
   - Telas (listar, salvar, ligar/desligar): sessão do usuário, e o RLS decide (só admin altera). */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Só administradores podem alterar isto.");
    if (r.error.code === "23505") throw new DomainError("invalid", "Já existe um modelo com esse atalho.");
    throw new Error(r.error.message);
  }
  return r.data;
}

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);

const toRobot = (r: Row): Robot => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  active: r.is_active,
  trigger: r.trigger,
  pipelineId: r.pipeline_id,
  stageId: r.stage_id,
  channels: r.channels ?? [],
  keywords: r.keywords ?? [],
  once: r.once,
  steps: Array.isArray(r.steps) ? r.steps : [],
  runCount: r.run_count ?? 0,
  lastRunAt: iso(r.last_run_at),
  createdAt: new Date(r.created_at).toISOString(),
});
const fromRobot = (i: RobotInput) => ({
  name: i.name,
  is_active: i.active,
  trigger: i.trigger,
  pipeline_id: i.pipelineId,
  stage_id: i.trigger === "stage_enter" ? i.stageId : null,
  channels: i.channels,
  keywords: i.keywords,
  once: i.once,
  steps: i.steps,
});
const toRun = (r: Row): RobotRun => ({
  id: r.id,
  workspaceId: r.workspace_id,
  robotId: r.robot_id,
  leadId: r.lead_id,
  conversationId: r.conversation_id,
  step: r.step,
  depth: r.depth,
  status: r.status,
  runAt: new Date(r.run_at).toISOString(),
  log: Array.isArray(r.log) ? r.log : [],
  createdAt: new Date(r.created_at).toISOString(),
});
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
  lastActivityAt: new Date(r.last_activity_at).toISOString(),
  createdAt: new Date(r.created_at).toISOString(),
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
});

const port: RobotPort = {
  async activeRobots(wsId) {
    return check(await adminClient().from("robots").select("*").eq("workspace_id", wsId).eq("is_active", true)).map(toRobot);
  },
  async robot(wsId, id) {
    const r = check(await adminClient().from("robots").select("*").eq("workspace_id", wsId).eq("id", id).maybeSingle());
    return r ? toRobot(r) : null;
  },
  async hasRun(robotId, key) {
    let q = adminClient().from("robot_runs").select("id").eq("robot_id", robotId).limit(1);
    q = key.leadId ? q.eq("lead_id", key.leadId) : q.eq("conversation_id", key.conversationId ?? "00000000-0000-0000-0000-000000000000");
    return check(await q).length > 0;
  },
  async context(wsId, leadId, conversationId) {
    const a = adminClient();
    const ws = check(await a.from("workspaces").select("name").eq("id", wsId).single());
    let conv: Row | null = conversationId
      ? check(await a.from("conversations").select("*, channels(kind), contacts(name)").eq("workspace_id", wsId).eq("id", conversationId).maybeSingle())
      : null;
    const lid = leadId ?? conv?.lead_id ?? null;
    const leadRow: Row | null = lid
      ? check(await a.from("leads").select("*, lead_tags(tags(name)), lead_contacts(is_main, contacts(name))").eq("workspace_id", wsId).eq("id", lid).is("deleted_at", null).maybeSingle())
      : null;
    if (!conv && leadRow)
      conv = check(
        await a.from("conversations").select("*, channels(kind), contacts(name)").eq("workspace_id", wsId).eq("lead_id", leadRow.id).order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      );
    const links: Row[] = leadRow?.lead_contacts ?? [];
    const main = links.find((x) => x.is_main) ?? links[0];
    const owner = leadRow?.responsible_user_id ? check(await a.from("profiles").select("full_name").eq("id", leadRow.responsible_user_id).maybeSingle()) : null;
    return {
      wsName: ws.name,
      lead: leadRow ? toLead(leadRow) : null,
      contactName: conv?.contacts?.name ?? main?.contacts?.name ?? "",
      conversation: conv ? toConversation(conv) : null,
      channelKind: conv?.channels?.kind ?? null,
      responsibleName: owner?.full_name ?? "",
    };
  },
  async sendMessage(wsId, c, kind, text) {
    if (kind === "whatsapp" && (!c.lastInboundAt || Date.now() - Date.parse(c.lastInboundAt) > 864e5))
      throw new Error("Não enviado: fora da janela de 24h do WhatsApp (precisa de modelo aprovado).");
    // chat do site: entregue ao gravar. WhatsApp/Instagram: fica na fila até o canal da Meta ser conectado.
    check(
      await adminClient()
        .from("messages")
        .insert({ workspace_id: wsId, conversation_id: c.id, channel_id: c.channelId, direction: "out", body: text, sender_user_id: null, status: kind === "webchat" ? "sent" : "queued" }),
    );
  },
  async createTask(wsId, lead, text, dueAt) {
    const a = adminClient();
    let owner = lead.responsibleUserId;
    if (!owner) owner = check(await a.from("memberships").select("user_id").eq("workspace_id", wsId).eq("status", "active").order("created_at").limit(1).single()).user_id;
    check(await a.from("tasks").insert({ workspace_id: wsId, lead_id: lead.id, text, due_at: dueAt, responsible_user_id: owner }));
  },
  async addTag(wsId, lead, tag) {
    const a = adminClient();
    check(await a.from("tags").upsert({ workspace_id: wsId, name: tag }, { onConflict: "workspace_id,name", ignoreDuplicates: true }));
    const t = check(await a.from("tags").select("id").eq("workspace_id", wsId).eq("name", tag).single());
    check(await a.from("lead_tags").upsert({ lead_id: lead.id, tag_id: t.id, workspace_id: wsId }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true }));
  },
  async setResponsible(wsId, lead, userId) {
    const a = adminClient();
    const m = check(await a.from("memberships").select("id").eq("workspace_id", wsId).eq("user_id", userId).eq("status", "active").maybeSingle());
    if (!m) throw new Error("Pulado: essa pessoa não está mais na equipe.");
    check(await a.from("leads").update({ responsible_user_id: userId }).eq("workspace_id", wsId).eq("id", lead.id));
  },
  async moveStage(wsId, lead, stageId) {
    const a = adminClient();
    const st = check(await a.from("stages").select("kind, pipeline_id").eq("id", stageId).maybeSingle());
    if (!st || st.pipeline_id !== lead.pipelineId) throw new Error("Pulado: etapa não existe neste funil.");
    if (st.kind === "lost") throw new Error("Pulado: mover para Perdido exige motivo; faça à mão.");
    if (lead.stageId === stageId) return false;
    check(await a.from("leads").update({ stage_id: stageId, last_activity_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("id", lead.id));
    return true;
  },
  async addNote(wsId, lead, text) {
    check(await adminClient().from("notes").insert({ workspace_id: wsId, lead_id: lead.id, body: text, kind: "system" }));
  },
  async logOnLead(wsId, leadId, robot, text) {
    check(await adminClient().from("events").insert({ workspace_id: wsId, lead_id: leadId, kind: "automation_ran", after: { robot, text } }));
  },
  async saveRun(run) {
    check(
      await adminClient()
        .from("robot_runs")
        .upsert({ id: run.id, workspace_id: run.workspaceId, robot_id: run.robotId, lead_id: run.leadId, conversation_id: run.conversationId, step: run.step, depth: run.depth, status: run.status, run_at: run.runAt, log: run.log }),
    );
  },
  async claim(run) {
    const r = check(await adminClient().from("robot_runs").update({ status: "running" }).eq("id", run.id).eq("status", "waiting").select("id"));
    if (r.length) run.status = "running";
    return r.length > 0;
  },
  async dueRuns(wsId, at, limit) {
    let q = adminClient().from("robot_runs").select("*").eq("status", "waiting").lte("run_at", at).order("run_at").limit(limit);
    if (wsId) q = q.eq("workspace_id", wsId);
    return check(await q).map(toRun);
  },
  async bump(robotId, at) {
    const a = adminClient();
    const r = check(await a.from("robots").select("run_count").eq("id", robotId).maybeSingle());
    if (r) check(await a.from("robots").update({ run_count: (r.run_count ?? 0) + 1, last_run_at: at }).eq("id", robotId));
  },
};

export async function fireRobots(wsId: ID, ev: RobotEvent) {
  await fire(port, wsId, ev);
  await tick(port, wsId);
}
export async function tickRobots(wsId: ID | null) {
  return tick(port, wsId);
}
/** Webhook da Meta: a mensagem já foi gravada pelo receive_inbound; dispara os robôs dela. */
export async function fireRobotsForMessage(messageId: ID) {
  const m = check(await adminClient().from("messages").select("workspace_id, conversation_id, body").eq("id", messageId).maybeSingle());
  if (!m) return;
  const { count } = await adminClient().from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", m.conversation_id).eq("direction", "in");
  if (count === 1) await fire(port, m.workspace_id, { trigger: "new_contact", conversationId: m.conversation_id, text: m.body });
  await fireRobots(m.workspace_id, { trigger: "message_in", conversationId: m.conversation_id, text: m.body });
}

// ---------------------------------------------------------------------------
// telas
// ---------------------------------------------------------------------------
export async function listRobots(wsId: ID): Promise<Robot[]> {
  const sb = await userClient();
  return check(await sb.from("robots").select("*").eq("workspace_id", wsId).order("created_at")).map(toRobot);
}

export async function getRobot(wsId: ID, id: ID): Promise<{ robot: Robot; runs: (RobotRun & { leadName: string | null })[] }> {
  const sb = await userClient();
  const r = check(await sb.from("robots").select("*").eq("workspace_id", wsId).eq("id", id).maybeSingle());
  if (!r) throw new DomainError("not_found");
  const runs = check(
    await sb.from("robot_runs").select("*, leads(name, number), conversations(contacts(name))").eq("robot_id", id).order("created_at", { ascending: false }).limit(30),
  ).map((x: Row) => ({
    ...toRun(x),
    leadName: x.leads ? x.leads.name || `Lead #${x.leads.number}` : (x.conversations?.contacts?.name ?? null),
  }));
  return { robot: toRobot(r), runs };
}

export async function saveRobot(wsId: ID, actor: ID, id: ID | null, input: RobotInput): Promise<Robot> {
  const sb = await userClient();
  const row = fromRobot(input);
  const r = id
    ? check(await sb.from("robots").update(row).eq("workspace_id", wsId).eq("id", id).select("*").maybeSingle())
    : check(await sb.from("robots").insert({ ...row, workspace_id: wsId, created_by: actor }).select("*").single());
  if (!r) throw new DomainError("forbidden", "Só administradores podem alterar robôs.");
  return toRobot(r);
}

export async function setRobotActive(wsId: ID, id: ID, active: boolean) {
  const sb = await userClient();
  const r = check(await sb.from("robots").update({ is_active: active }).eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem alterar robôs.");
}

export async function deleteRobot(wsId: ID, id: ID) {
  const sb = await userClient();
  const r = check(await sb.from("robots").delete().eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem apagar robôs.");
}

const toTemplate = (r: Row): Template => ({ id: r.id, workspaceId: r.workspace_id, name: r.name, shortcut: r.shortcut, body: r.body, createdAt: new Date(r.created_at).toISOString() });

export async function listTemplates(wsId: ID): Promise<Template[]> {
  const sb = await userClient();
  return check(await sb.from("templates").select("*").eq("workspace_id", wsId).eq("kind", "chat").order("name")).map(toTemplate);
}

export async function saveTemplate(wsId: ID, id: ID | null, input: { name: string; shortcut: string | null; body: string }): Promise<Template> {
  const sb = await userClient();
  const r = id
    ? check(await sb.from("templates").update(input).eq("workspace_id", wsId).eq("id", id).select("*").maybeSingle())
    : check(await sb.from("templates").insert({ ...input, workspace_id: wsId, kind: "chat" }).select("*").single());
  if (!r) throw new DomainError("forbidden", "Só administradores podem alterar modelos.");
  return toTemplate(r);
}

export async function deleteTemplate(wsId: ID, id: ID) {
  const sb = await userClient();
  const r = check(await sb.from("templates").delete().eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem apagar modelos.");
}
