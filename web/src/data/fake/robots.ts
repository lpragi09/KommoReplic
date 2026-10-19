import "server-only";
import { deliverQueued } from "./channels";
import { connection } from "next/server";
import { db, now, uid } from "./store";
import { fireRobots as fire, tickRobots as tick, type RobotPort } from "../robots/engine";
import { DomainError, type ID, type Message, type Robot, type RobotEvent, type RobotInput, type RobotRun, type Template, type TemplateInput } from "../types";

/* Robôs e modelos no banco em memória. */

const port: RobotPort = {
  async activeRobots(wsId) {
    return db.robots.filter((r) => r.workspaceId === wsId && r.active);
  },
  async robot(wsId, id) {
    return db.robots.find((r) => r.id === id && r.workspaceId === wsId) ?? null;
  },
  async hasRun(robotId, key) {
    return db.robotRuns.some((x) => x.robotId === robotId && (key.leadId ? x.leadId === key.leadId : x.conversationId === key.conversationId));
  },
  async countRuns(robotId, before) {
    return db.robotRuns.filter((x) => x.robotId === robotId && x.createdAt < before).length;
  },
  async waitingReply(wsId, conversationId) {
    return db.robotRuns
      .filter((x) => x.workspaceId === wsId && x.conversationId === conversationId && x.status === "waiting" && x.state?.wait === "reply")
      .map((x) => ({ ...x, log: [...x.log], state: { ...x.state } }));
  },
  async closeConversation(_wsId, c) {
    const row = db.conversations.find((x) => x.id === c.id);
    if (row) row.status = "closed";
  },
  async removeTag(_wsId, lead, tag) {
    const row = db.leads.find((l) => l.id === lead.id);
    if (row) row.tags = row.tags.filter((t) => t !== tag);
  },
  async setField(_wsId, lead, fieldId, value) {
    const cur = (db.leadCustom[lead.id] ??= {});
    if (value) cur[fieldId] = value;
    else delete cur[fieldId];
  },
  async notifyTeam(wsId, text) {
    const admin = db.memberships.find((m) => m.workspaceId === wsId && m.role === "admin");
    if (admin) db.teamMessages.push({ id: uid(), workspaceId: wsId, userId: admin.userId, body: text, createdAt: now() });
  },
  async context(wsId, leadId, conversationId) {
    const ws = db.workspaces.find((w) => w.id === wsId)!;
    let conversation = conversationId ? (db.conversations.find((c) => c.id === conversationId) ?? null) : null;
    const lid = leadId ?? conversation?.leadId ?? null;
    const lead = lid ? (db.leads.find((l) => l.id === lid) ?? null) : null;
    if (!conversation && lead) conversation = db.conversations.find((c) => c.leadId === lead.id) ?? null;
    const link = lead ? (db.leadContacts.find((x) => x.leadId === lead.id && x.isMain) ?? db.leadContacts.find((x) => x.leadId === lead.id)) : undefined;
    const contact = db.contacts.find((c) => c.id === (conversation?.contactId ?? link?.contactId));
    const channel = conversation ? db.channels.find((c) => c.id === conversation.channelId) : undefined;
    return {
      wsName: ws.name,
      lead,
      contactName: contact?.name ?? "",
      contactId: contact?.id ?? null,
      contactEmail: contact?.identities.find((i) => i.kind === "email")?.value ?? null,
      emailOptOut: !!contact?.emailOptOut,
      conversation,
      channelKind: channel?.kind ?? null,
      responsibleName: db.users.find((u) => u.id === lead?.responsibleUserId)?.name ?? "",
    };
  },
  async sendMessage(_wsId, c, kind, text) {
    if (kind === "whatsapp" && (!c.lastInboundAt || Date.now() - Date.parse(c.lastInboundAt) > 864e5))
      throw new Error("Não enviado: fora da janela de 24h do WhatsApp (precisa de modelo aprovado).");
    const m: Message = { id: uid(), conversationId: c.id, direction: "out", body: text, senderUserId: null, clientId: null, status: kind === "webchat" ? "sent" : "queued", sentAt: now() };
    db.messages.push(m);
    Object.assign(c, { lastMessageAt: m.sentAt, lastMessagePreview: text, isUnanswered: false });
  },
  async createTask(wsId, lead, text, dueAt) {
    db.tasks.push({ id: uid(), workspaceId: wsId, leadId: lead.id, contactId: null, taskTypeId: null, responsibleUserId: lead.responsibleUserId ?? db.memberships.find((m) => m.workspaceId === wsId && m.role === "admin")!.userId, text, dueAt, completedAt: null, resultText: null, createdAt: now() });
    const row = db.leads.find((l) => l.id === lead.id);
    if (row) row.closestTaskAt = db.tasks.filter((t) => t.leadId === lead.id && !t.completedAt).map((t) => t.dueAt).sort()[0] ?? null;
  },
  async addTag(_wsId, lead, tag) {
    const row = db.leads.find((l) => l.id === lead.id);
    if (row && !row.tags.includes(tag)) row.tags = [...row.tags, tag].slice(0, 20);
  },
  async setResponsible(wsId, lead, userId) {
    if (!db.memberships.some((m) => m.workspaceId === wsId && m.userId === userId)) throw new Error("Pulado: essa pessoa não está mais na equipe.");
    const row = db.leads.find((l) => l.id === lead.id);
    if (row) row.responsibleUserId = userId;
  },
  async moveStage(_wsId, lead, stageId) {
    const row = db.leads.find((l) => l.id === lead.id);
    const st = db.pipelines.flatMap((p) => p.stages).find((s) => s.id === stageId);
    if (!row || !st || st.pipelineId !== row.pipelineId) throw new Error("Pulado: etapa não existe neste funil.");
    if (st.kind === "lost") throw new Error("Pulado: mover para Perdido exige motivo; faça à mão.");
    if (row.stageId === stageId) return false;
    db.events.push({ id: uid(), leadId: row.id, kind: "stage_changed", before: { stageId: row.stageId }, after: { stageId }, actorUserId: null, createdAt: now() });
    row.stageId = stageId;
    row.closedAt = st.kind === "open" ? null : now();
    row.lastActivityAt = now();
    return true;
  },
  async addNote(_wsId, lead, text) {
    db.notes.push({ id: uid(), leadId: lead.id, contactId: null, body: text, createdBy: "", createdAt: now() });
  },
  async logOnLead(_wsId, leadId, robot, text) {
    db.events.push({ id: uid(), leadId, kind: "automation_ran", before: null, after: { robot, text }, actorUserId: null, createdAt: now() });
  },
  async saveRun(run) {
    const i = db.robotRuns.findIndex((x) => x.id === run.id);
    if (i >= 0) db.robotRuns[i] = { ...run, log: [...run.log], state: { ...run.state } };
    else db.robotRuns.push({ ...run, log: [...run.log], state: { ...run.state } });
  },
  async claim(run) {
    const row = db.robotRuns.find((x) => x.id === run.id);
    if (!row || row.status !== "waiting") return false;
    row.status = run.status = "running";
    return true;
  },
  async dueRuns(wsId, at, limit) {
    return db.robotRuns
      .filter((x) => x.status === "waiting" && x.runAt <= at && (!wsId || x.workspaceId === wsId))
      .slice(0, limit)
      .map((x) => ({ ...x, log: [...x.log], state: { ...x.state } }));
  },
  async bump(robotId, at) {
    const r = db.robots.find((x) => x.id === robotId);
    if (r) {
      r.runCount += 1;
      r.lastRunAt = at;
    }
  },
};

export async function fireRobots(wsId: ID, ev: RobotEvent) {
  await fire(port, wsId, ev);
  await tick(port, wsId);
  await deliverQueued(wsId).catch(() => 0); // mensagens dos robôs saem pela Meta na hora
}
export async function tickRobots(wsId: ID | null) {
  const n = await tick(port, wsId);
  await deliverQueued(wsId).catch(() => 0);
  return n;
}
/** Mesmo papel do webhook da Meta no Supabase: dispara os robôs de uma mensagem recebida. */
export async function fireRobotsForMessage(messageId: ID) {
  const m = db.messages.find((x) => x.id === messageId);
  const c = m && db.conversations.find((x) => x.id === m.conversationId);
  if (!m || !c) return;
  await fireRobots(c.workspaceId, { trigger: "message_in", conversationId: c.id, text: m.body });
  if (db.messages.filter((x) => x.conversationId === c.id && x.direction === "in").length === 1)
    await fire(port, c.workspaceId, { trigger: "new_contact", conversationId: c.id, text: m.body });
}

// ---------------------------------------------------------------------------
// tela de automações
// ---------------------------------------------------------------------------
export async function listRobots(wsId: ID): Promise<Robot[]> {
  await connection();
  return db.robots.filter((r) => r.workspaceId === wsId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getRobot(wsId: ID, id: ID): Promise<{ robot: Robot; runs: (RobotRun & { leadName: string | null })[] }> {
  await connection();
  const robot = db.robots.find((r) => r.id === id && r.workspaceId === wsId);
  if (!robot) throw new DomainError("not_found");
  const runs = db.robotRuns
    .filter((x) => x.robotId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30)
    .map((x) => {
      const l = db.leads.find((y) => y.id === x.leadId);
      const c = db.conversations.find((y) => y.id === x.conversationId);
      return { ...x, leadName: l ? l.name || `Lead #${l.number}` : (db.contacts.find((y) => y.id === c?.contactId)?.name ?? null) };
    });
  return { robot, runs };
}

export async function saveRobot(wsId: ID, _actor: ID, id: ID | null, input: RobotInput): Promise<Robot> {
  if (id) {
    const r = db.robots.find((x) => x.id === id && x.workspaceId === wsId);
    if (!r) throw new DomainError("not_found");
    Object.assign(r, input);
    return r;
  }
  const r: Robot = { ...input, id: uid(), workspaceId: wsId, runCount: 0, lastRunAt: null, createdAt: now() };
  db.robots.push(r);
  return r;
}

export async function setRobotActive(wsId: ID, id: ID, active: boolean) {
  const r = db.robots.find((x) => x.id === id && x.workspaceId === wsId);
  if (!r) throw new DomainError("not_found");
  r.active = active;
}

export async function deleteRobot(wsId: ID, id: ID) {
  db.robots = db.robots.filter((x) => !(x.id === id && x.workspaceId === wsId));
  db.robotRuns = db.robotRuns.filter((x) => x.robotId !== id);
}

// ---------------------------------------------------------------------------
// modelos de mensagem
// ---------------------------------------------------------------------------
export async function listTemplates(wsId: ID): Promise<Template[]> {
  await connection();
  return db.templates.filter((t) => t.workspaceId === wsId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function saveTemplate(wsId: ID, id: ID | null, input: TemplateInput): Promise<Template> {
  if (input.shortcut && db.templates.some((t) => t.workspaceId === wsId && t.id !== id && t.shortcut === input.shortcut))
    throw new DomainError("invalid", "Já existe um modelo com esse atalho.");
  if (id) {
    const t = db.templates.find((x) => x.id === id && x.workspaceId === wsId);
    if (!t) throw new DomainError("not_found");
    Object.assign(t, input);
    return t;
  }
  const t: Template = { ...input, id: uid(), workspaceId: wsId, waStatus: input.network === "whatsapp" ? "draft" : null, createdAt: now() };
  db.templates.push(t);
  return t;
}

export async function deleteTemplate(wsId: ID, id: ID) {
  db.templates = db.templates.filter((x) => !(x.id === id && x.workspaceId === wsId));
}
