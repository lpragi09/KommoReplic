import "server-only";
import { randomUUID } from "node:crypto";
import { humanMinutes } from "@/lib/robot-meta";
import { UTM_KEYS } from "../types";
import type { ChannelKind, Conversation, ID, Lead, Robot, RobotEvent, RobotRun, RobotStep } from "../types";

/* Motor dos robôs. Um só para os dois bancos: cada repositório entrega um "Port"
   (ler robôs, mandar mensagem, criar tarefa...) e o motor decide o que roda e quando.
   O robô age como "sistema": nada aqui depende de quem está logado. */

export type RobotCtx = {
  wsName: string;
  lead: Lead | null;
  contactName: string;
  conversation: Conversation | null;
  channelKind: ChannelKind | null;
  responsibleName: string;
};

export interface RobotPort {
  activeRobots(wsId: ID): Promise<Robot[]>;
  robot(wsId: ID, id: ID): Promise<Robot | null>;
  /** já rodou para este lead (ou conversa, quando ainda não há lead)? */
  hasRun(robotId: ID, key: { leadId: ID | null; conversationId: ID | null }): Promise<boolean>;
  context(wsId: ID, leadId: ID | null, conversationId: ID | null): Promise<RobotCtx>;
  sendMessage(wsId: ID, conversation: Conversation, kind: ChannelKind, text: string): Promise<void>;
  createTask(wsId: ID, lead: Lead, text: string, dueAt: string): Promise<void>;
  addTag(wsId: ID, lead: Lead, tag: string): Promise<void>;
  setResponsible(wsId: ID, lead: Lead, userId: ID): Promise<void>;
  /** devolve false se o lead já estava na etapa */
  moveStage(wsId: ID, lead: Lead, stageId: ID): Promise<boolean>;
  addNote(wsId: ID, lead: Lead, text: string): Promise<void>;
  logOnLead(wsId: ID, leadId: ID, robotName: string, text: string): Promise<void>;
  saveRun(run: RobotRun): Promise<void>;
  /** marca um passo agendado como "rodando"; false se outro processo pegou antes */
  claim(run: RobotRun): Promise<boolean>;
  dueRuns(wsId: ID | null, now: string, limit: number): Promise<RobotRun[]>;
  bump(robotId: ID, at: string): Promise<void>;
}

const MAX_DEPTH = 5; // robô que move etapa pode disparar outro robô; trava contra laço

const nowIso = () => new Date().toISOString();
// "Visitante 4521" ou só o telefone não é nome de gente: aí o robô não chama pelo nome
const realName = (s: string) => (/^visitante(\s|$)/i.test(s.trim()) || /^[+\d\s()-]+$/.test(s.trim()) ? "" : s.trim());
const firstName = (s: string) => realName(s).split(/\s+/)[0] ?? "";

/** {{nome}}, {{nome_completo}}, {{empresa}}, {{responsavel}}, {{lead}} */
export function renderText(text: string, ctx: RobotCtx) {
  const vars: Record<string, string> = {
    nome: firstName(ctx.contactName) || "tudo bem",
    nome_completo: realName(ctx.contactName),
    empresa: ctx.wsName,
    responsavel: ctx.responsibleName,
    lead: ctx.lead?.name || (ctx.lead ? `#${ctx.lead.number}` : ""),
    ...Object.fromEntries(UTM_KEYS.map((k) => [k, attrOf(ctx)?.[k] ?? ""])),
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k: string) => vars[k.toLowerCase()] ?? m).trim();
}


const attrOf = (ctx: RobotCtx) => ctx.lead?.attribution ?? ctx.conversation?.attribution ?? null;

function matches(r: Robot, ev: RobotEvent, ctx: RobotCtx) {
  if (r.trigger !== ev.trigger) return false;
  const c = r.conditions;
  if (c?.utmField && c.utmContains?.trim()) {
    const v = attrOf(ctx)?.[c.utmField];
    if (!v || !v.toLowerCase().includes(c.utmContains.trim().toLowerCase())) return false;
  }
  if (r.channels.length && !(ctx.channelKind && r.channels.includes(ctx.channelKind))) return false;
  switch (ev.trigger) {
    case "stage_enter":
      return r.stageId === ev.stageId;
    case "lead_created":
      return !r.pipelineId || r.pipelineId === ctx.lead?.pipelineId;
    case "message_in": {
      if (!r.keywords.length) return true;
      const t = ev.text.toLowerCase();
      return r.keywords.some((k) => k.trim() && t.includes(k.trim().toLowerCase()));
    }
    case "new_contact":
      return true;
  }
}

/** Dispara os robôs que combinam com o evento. Nunca derruba a ação de quem chamou. */
export async function fireRobots(port: RobotPort, wsId: ID, ev: RobotEvent) {
  try {
    const robots = await port.activeRobots(wsId);
    if (!robots.some((r) => r.trigger === ev.trigger)) return;
    const leadId = "leadId" in ev ? ev.leadId : null;
    const conversationId = "conversationId" in ev ? ev.conversationId : null;
    const ctx = await port.context(wsId, leadId, conversationId);
    const depth = "depth" in ev ? (ev.depth ?? 0) : 0;
    for (const r of robots) {
      if (!matches(r, ev, ctx)) continue;
      const key = { leadId: ctx.lead?.id ?? null, conversationId: ctx.conversation?.id ?? null };
      if (r.once && (await port.hasRun(r.id, key))) continue;
      const run: RobotRun = {
        id: randomUUID(),
        workspaceId: wsId,
        robotId: r.id,
        leadId: key.leadId,
        conversationId: key.conversationId,
        step: 0,
        depth,
        status: "running",
        runAt: nowIso(),
        log: [],
        createdAt: nowIso(),
      };
      await advance(port, r, run, ctx);
    }
  } catch (e) {
    console.error("[robôs] falha ao disparar", e);
  }
}

/** Continua os robôs que estavam esperando ("Esperar 2 dias") e já passaram da hora. */
export async function tickRobots(port: RobotPort, wsId: ID | null, limit = 25) {
  try {
    const due = await port.dueRuns(wsId, nowIso(), limit);
    for (const run of due) {
      if (!(await port.claim(run))) continue;
      const r = await port.robot(run.workspaceId, run.robotId);
      if (!r || !r.active) {
        run.status = "failed";
        run.log.push({ at: nowIso(), text: "Robô desligado antes de terminar.", ok: false });
        await port.saveRun(run);
        continue;
      }
      const ctx = await port.context(run.workspaceId, run.leadId, run.conversationId);
      await advance(port, r, run, ctx);
    }
    return due.length;
  } catch (e) {
    console.error("[robôs] falha ao continuar", e);
    return 0;
  }
}

async function advance(port: RobotPort, r: Robot, run: RobotRun, ctx: RobotCtx) {
  const log = (text: string, ok = true) => run.log.push({ at: nowIso(), text, ok });
  for (let i = run.step; i < r.steps.length; i++) {
    const step = r.steps[i];
    if (step.type === "wait") {
      const min = Math.max(1, Math.round(step.minutes));
      run.step = i + 1;
      run.status = "waiting";
      run.runAt = new Date(Date.now() + min * 60_000).toISOString();
      log(`Esperando ${humanMinutes(min)}.`);
      await port.saveRun(run);
      return;
    }
    try {
      const text = await runStep(port, r, run, step, ctx);
      log(text);
      if (ctx.lead && step.type !== "message") await port.logOnLead(run.workspaceId, ctx.lead.id, r.name, text);
    } catch (e) {
      log(e instanceof Error && e.message ? e.message : "Não deu para executar este passo.", false);
    }
  }
  run.step = r.steps.length;
  run.status = run.log.some((l) => !l.ok) ? "failed" : "done";
  await port.saveRun(run);
  await port.bump(r.id, nowIso());
}

async function runStep(port: RobotPort, r: Robot, run: RobotRun, step: RobotStep, ctx: RobotCtx): Promise<string> {
  const ws = run.workspaceId;
  const needLead = () => {
    if (!ctx.lead) throw new Error("Pulado: o contato ainda não virou lead (aceite na entrada do funil).");
    return ctx.lead;
  };
  switch (step.type) {
    case "message": {
      if (!ctx.conversation || !ctx.channelKind) throw new Error("Pulado: este lead ainda não tem conversa em nenhum canal.");
      const body = renderText(step.text, ctx);
      if (!body) throw new Error("Pulado: mensagem vazia.");
      await port.sendMessage(ws, ctx.conversation, ctx.channelKind, body);
      return `Mensagem enviada: “${body.length > 80 ? body.slice(0, 80) + "…" : body}”`;
    }
    case "task": {
      const lead = needLead();
      const text = renderText(step.text, ctx) || "Retornar contato";
      await port.createTask(ws, lead, text, new Date(Date.now() + Math.max(0, step.dueMinutes) * 60_000).toISOString());
      return `Tarefa criada: ${text}`;
    }
    case "tag": {
      const lead = needLead();
      const tag = step.tag.trim();
      if (!tag) throw new Error("Pulado: etiqueta vazia.");
      await port.addTag(ws, lead, tag);
      if (!lead.tags.includes(tag)) lead.tags.push(tag);
      return `Etiqueta adicionada: ${tag}`;
    }
    case "responsible": {
      const lead = needLead();
      await port.setResponsible(ws, lead, step.userId);
      lead.responsibleUserId = step.userId;
      return "Responsável alterado.";
    }
    case "stage": {
      const lead = needLead();
      const moved = await port.moveStage(ws, lead, step.stageId);
      if (!moved) return "Lead já estava nesta etapa.";
      lead.stageId = step.stageId;
      if (run.depth + 1 <= MAX_DEPTH) await fireRobots(port, ws, { trigger: "stage_enter", leadId: lead.id, stageId: step.stageId, depth: run.depth + 1 });
      return "Lead movido de etapa.";
    }
    case "note": {
      const lead = needLead();
      const text = renderText(step.text, ctx);
      if (!text) throw new Error("Pulado: nota vazia.");
      await port.addNote(ws, lead, text);
      return "Nota adicionada.";
    }
    case "wait":
      return "";
  }
  void r;
}

