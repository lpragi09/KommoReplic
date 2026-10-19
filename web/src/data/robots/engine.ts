import "server-only";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { humanMinutes } from "@/lib/robot-meta";
import { validCPF } from "@/lib/document";
import { UTM_KEYS } from "../types";
import { emailOn, marketingEmail, sendEmailBatch } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import type { ChannelKind, Conversation, ID, Lead, Robot, RobotEvent, RobotRun, RobotStep } from "../types";

/* Motor dos robôs. Um só para os dois bancos: cada repositório entrega um "Port"
   (ler robôs, mandar mensagem, criar tarefa...) e o motor decide o que roda e quando.
   O robô é um fluxo: cada passo aponta para o próximo (next), e botões/condições abrem caminhos.
   Robôs antigos, em linha reta, sem "next", seguem a ordem da lista.
   O robô age como "sistema": nada aqui depende de quem está logado. */

export type RobotCtx = {
  wsName: string;
  lead: Lead | null;
  contactName: string;
  /** contato principal: id e email (para o passo "Enviar email"); optOut = pediu para não receber */
  contactId?: string | null;
  contactEmail?: string | null;
  emailOptOut?: boolean;
  conversation: Conversation | null;
  channelKind: ChannelKind | null;
  responsibleName: string;
};

export interface RobotPort {
  activeRobots(wsId: ID): Promise<Robot[]>;
  robot(wsId: ID, id: ID): Promise<Robot | null>;
  /** já rodou para este lead (ou conversa, quando ainda não há lead)? */
  hasRun(robotId: ID, key: { leadId: ID | null; conversationId: ID | null }): Promise<boolean>;
  /** quantas execuções deste robô começaram antes de `before` (para o rodízio) */
  countRuns(robotId: ID, before: string): Promise<number>;
  /** execuções esperando a resposta do cliente nesta conversa */
  waitingReply(wsId: ID, conversationId: ID): Promise<RobotRun[]>;
  context(wsId: ID, leadId: ID | null, conversationId: ID | null): Promise<RobotCtx>;
  sendMessage(wsId: ID, conversation: Conversation, kind: ChannelKind, text: string): Promise<void>;
  closeConversation(wsId: ID, conversation: Conversation): Promise<void>;
  createTask(wsId: ID, lead: Lead, text: string, dueAt: string): Promise<void>;
  addTag(wsId: ID, lead: Lead, tag: string): Promise<void>;
  removeTag(wsId: ID, lead: Lead, tag: string): Promise<void>;
  setResponsible(wsId: ID, lead: Lead, userId: ID): Promise<void>;
  setField(wsId: ID, lead: Lead, fieldId: ID, value: string): Promise<void>;
  /** devolve false se o lead já estava na etapa */
  moveStage(wsId: ID, lead: Lead, stageId: ID): Promise<boolean>;
  addNote(wsId: ID, lead: Lead, text: string): Promise<void>;
  /** aviso no chat interno da equipe */
  notifyTeam(wsId: ID, text: string): Promise<void>;
  logOnLead(wsId: ID, leadId: ID, robotName: string, text: string): Promise<void>;
  saveRun(run: RobotRun): Promise<void>;
  /** marca um passo agendado como "rodando"; false se outro processo pegou antes */
  claim(run: RobotRun): Promise<boolean>;
  dueRuns(wsId: ID | null, now: string, limit: number): Promise<RobotRun[]>;
  bump(robotId: ID, at: string): Promise<void>;
}

const MAX_DEPTH = 5; // robô que move etapa ou inicia outro robô: trava contra laço
const MAX_HOPS = 60; // passos por rodada (laço no desenho do fluxo não trava o servidor)

const nowIso = () => new Date().toISOString();
// "Visitante 4521" ou só o telefone não é nome de gente: aí o robô não chama pelo nome
const realName = (s: string) => (/^visitante(\s|$)/i.test(s.trim()) || /^[+\d\s()-]+$/.test(s.trim()) ? "" : s.trim());
const firstName = (s: string) => realName(s).split(/\s+/)[0] ?? "";
const attrOf = (ctx: RobotCtx) => ctx.lead?.attribution ?? ctx.conversation?.attribution ?? null;

/** {{nome}}, {{nome_completo}}, {{empresa}}, {{responsavel}}, {{lead}}, {{utm_*}} */
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

/** dentro do horário de atividade? (fuso de Brasília; "até" menor que "de" atravessa a meia-noite) */
export function inHours(h: { from: string; to: string; days: number[] } | undefined, now = new Date()) {
  if (!h) return true;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hm = `${get("hour").replace("24", "00")}:${get("minute")}`;
  if (h.days.length && !h.days.includes(day)) return false;
  return h.from <= h.to ? hm >= h.from && hm < h.to : hm >= h.from || hm < h.to;
}

function matches(r: Robot, ev: RobotEvent, ctx: RobotCtx) {
  if (r.trigger !== ev.trigger) return false;
  if (r.conditions?.detached) return false; // fora do funil: só roda quando outro robô ou gatilho chama
  if ("robotId" in ev && ev.robotId && r.id !== ev.robotId) return false; // "aplicar aos leads que já estão na etapa"
  const c = r.conditions;
  if (c?.tags?.length && !c.tags.some((t) => ctx.lead?.tags.some((x) => x.toLowerCase() === t.toLowerCase()))) return false;
  if (c?.ownerId && ctx.lead?.responsibleUserId !== c.ownerId) return false;
  if (!inHours(c?.hours)) return false;
  if (c?.utmField && c.utmContains?.trim()) {
    const v = attrOf(ctx)?.[c.utmField];
    if (!v || !v.toLowerCase().includes(c.utmContains.trim().toLowerCase())) return false;
  }
  if (r.channels.length && !(ctx.channelKind && r.channels.includes(ctx.channelKind))) return false;
  switch (ev.trigger) {
    case "stage_enter": {
      if (r.stageId !== ev.stageId) return false;
      const when = c?.when ?? "both";
      return when === "both" || !ev.via || when === ev.via;
    }
    case "responsible_changed":
      return !r.stageId || r.stageId === ctx.lead?.stageId;
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

// ---------------------------------------------------------------------------
// fluxo: quem vem depois de quem
// ---------------------------------------------------------------------------
const byId = (r: Robot, id: string | null | undefined) => (id ? r.steps.find((s) => s.id === id) : undefined);
/** próximo passo: o ligado no quadro; sem ligação definida (robô antigo), o seguinte da lista */
export function nextOf(r: Robot, step: RobotStep): string | null {
  if (step.next !== undefined) return step.next;
  const i = r.steps.findIndex((s) => s.id === step.id);
  return r.steps[i + 1]?.id ?? null;
}
export const startOf = (r: Robot) => (r.start?.next !== undefined ? r.start.next : (r.steps[0]?.id ?? null));

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** qual botão o cliente escolheu: pelo número ("1"), pelo texto exato ou contido */
function pickButton(buttons: NonNullable<Extract<RobotStep, { type: "message" }>["buttons"]>, reply: string) {
  const r = norm(reply);
  const n = Number(r.match(/^\d+/)?.[0]);
  if (n >= 1 && n <= buttons.length) return buttons[n - 1];
  return buttons.find((b) => norm(b.label) === r) ?? buttons.find((b) => r.includes(norm(b.label)) && norm(b.label).length > 1) ?? null;
}

function validAnswer(kind: Extract<RobotStep, { type: "validate" }>["kind"], reply: string) {
  const t = reply.trim();
  switch (kind) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
    case "phone":
      return t.replace(/\D/g, "").length >= 10 && t.replace(/\D/g, "").length <= 13;
    case "number":
      return /^-?\d+([.,]\d+)?$/.test(t);
    case "cpf":
      return validCPF(t);
    default:
      return t.length > 0;
  }
}

function conditionValue(step: Extract<RobotStep, { type: "condition" }>, ctx: RobotCtx, lastMessage: string) {
  switch (step.source) {
    case "message":
      return [lastMessage];
    case "utm_source":
      return [attrOf(ctx)?.utm_source ?? ""];
    case "utm_campaign":
      return [attrOf(ctx)?.utm_campaign ?? ""];
    case "tag":
      return ctx.lead?.tags ?? [];
    case "channel":
      return [ctx.channelKind ?? ""];
  }
}

/** endereço que não é da internet pública (rede interna, loopback, metadados da nuvem, CGNAT) */
function privateIp(ip: string) {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** webhook de saída: só https, só endereço público (conferido no DNS), sem seguir redirecionamento, 5 s de limite */
async function postWebhook(url: string, payload: unknown) {
  const refuse = () => new Error("Webhook recusado: use um endereço https público.");
  const u = new URL(url);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (u.protocol !== "https:" || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw refuse();
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length || ips.some(privateIp)) throw refuse();
  const res = await fetch(u, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Netzer-Robo/1.0" },
    body: JSON.stringify(payload),
    redirect: "manual", // um redirecionamento poderia levar para um endereço interno
    signal: AbortSignal.timeout(5000),
  });
  if (res.status >= 300 && res.status < 400) throw new Error("Webhook respondeu com redirecionamento; use o endereço final.");
  if (!res.ok) throw new Error(`Webhook respondeu ${res.status}.`);
}

// ---------------------------------------------------------------------------
// disparo e continuação
// ---------------------------------------------------------------------------
function newRun(wsId: ID, r: Robot, ctx: RobotCtx, depth: number): RobotRun {
  return {
    id: randomUUID(),
    workspaceId: wsId,
    robotId: r.id,
    leadId: ctx.lead?.id ?? null,
    conversationId: ctx.conversation?.id ?? null,
    step: 0,
    cursor: undefined,
    state: {},
    depth,
    status: "running",
    runAt: nowIso(),
    log: [],
    createdAt: nowIso(),
  };
}

/** Dispara os robôs que combinam com o evento. Nunca derruba a ação de quem chamou. */
export async function fireRobots(port: RobotPort, wsId: ID, ev: RobotEvent) {
  try {
    // resposta do cliente: primeiro continua os robôs que estavam esperando por ela
    if (ev.trigger === "message_in") {
      const waiting = await port.waitingReply(wsId, ev.conversationId);
      let consumed = false;
      for (const run of waiting) {
        if (!(await port.claim(run))) continue;
        const r = await port.robot(wsId, run.robotId);
        if (!r || (!r.active && run.depth === 0)) continue; // robô chamado por outro (gatilho de etapa) segue mesmo desligado
        const ctx = await port.context(wsId, run.leadId, run.conversationId);
        await advance(port, r, run, ctx, ev.text);
        consumed = true;
      }
      if (consumed) return; // a mensagem era a resposta do robô: não dispara outros por cima
    }

    const robots = await port.activeRobots(wsId);
    if (!robots.some((r) => r.trigger === ev.trigger)) return;
    const leadId = "leadId" in ev ? ev.leadId : null;
    const conversationId = "conversationId" in ev ? ev.conversationId : null;
    const ctx = await port.context(wsId, leadId, conversationId);
    const depth = "depth" in ev ? (ev.depth ?? 0) : 0;
    const lastMessage = "text" in ev ? ev.text : "";
    for (const r of robots) {
      if (!matches(r, ev, ctx)) continue;
      const key = { leadId: ctx.lead?.id ?? null, conversationId: ctx.conversation?.id ?? null };
      if (r.once && (await port.hasRun(r.id, key))) continue;
      await advance(port, r, newRun(wsId, r, ctx, depth), ctx, undefined, lastMessage);
    }
  } catch (e) {
    console.error("[robôs] falha ao disparar", e);
  }
}

/** Continua os robôs que estavam esperando (tempo, ou resposta que não veio no prazo). */
export async function tickRobots(port: RobotPort, wsId: ID | null, limit = 25) {
  try {
    const due = await port.dueRuns(wsId, nowIso(), limit);
    for (const run of due) {
      if (!(await port.claim(run))) continue;
      const r = await port.robot(run.workspaceId, run.robotId);
      if (!r || (!r.active && run.depth === 0)) {
        run.status = "failed";
        run.log.push({ at: nowIso(), text: "Robô desligado antes de terminar.", ok: false });
        await port.saveRun(run);
        continue;
      }
      const ctx = await port.context(run.workspaceId, run.leadId, run.conversationId);
      // esperava resposta e o prazo acabou: segue pelo caminho de "sem resposta"
      if (run.state?.wait === "reply") {
        const step = byId(r, run.cursor);
        run.log.push({ at: nowIso(), text: "O cliente não respondeu no prazo.", ok: true });
        run.cursor = step?.type === "wait_reply" ? (step.timeoutNext ?? null) : step?.type === "message" ? (step.elseNext ?? null) : step?.type === "validate" ? (step.failNext ?? null) : null;
        run.state = {};
      }
      await advance(port, r, run, ctx);
    }
    return due.length;
  } catch (e) {
    console.error("[robôs] falha ao continuar", e);
    return 0;
  }
}

/** Anda pelo fluxo a partir do cursor. `reply`: resposta do cliente que destrava o passo atual. */
async function advance(port: RobotPort, r: Robot, run: RobotRun, ctx: RobotCtx, reply?: string, lastMessage = "") {
  const log = (text: string, ok = true) => run.log.push({ at: nowIso(), text, ok });
  const ws = run.workspaceId;
  // execução antiga (salva por índice) vira cursor
  let id: string | null = run.cursor !== undefined ? run.cursor : run.step > 0 ? (r.steps[run.step]?.id ?? null) : startOf(r);
  let pendingReply = reply;
  const msg = pendingReply ?? lastMessage;

  const waitReply = async (stepId: string, minutes: number) => {
    run.cursor = stepId;
    run.status = "waiting";
    run.state = { ...run.state, wait: "reply" };
    run.runAt = new Date(Date.now() + Math.max(1, minutes) * 60_000).toISOString();
    await port.saveRun(run);
  };
  const needLead = () => {
    if (!ctx.lead) throw new Error("Pulado: o contato ainda não virou lead (aceite na entrada do funil).");
    return ctx.lead;
  };
  const send = async (text: string) => {
    if (!ctx.conversation || !ctx.channelKind) throw new Error("Pulado: este lead ainda não tem conversa em nenhum canal.");
    const body = renderText(text, ctx);
    if (!body) throw new Error("Pulado: mensagem vazia.");
    await port.sendMessage(ws, ctx.conversation, ctx.channelKind, body);
    return body;
  };

  for (let hops = 0; id && hops < MAX_HOPS; hops++) {
    const step = byId(r, id);
    if (!step) break;
    let next: string | null = nextOf(r, step);
    try {
      switch (step.type) {
        case "wait": {
          const min = Math.max(1, Math.round(step.minutes));
          run.cursor = next;
          run.status = "waiting";
          run.state = { wait: "time" };
          run.runAt = new Date(Date.now() + min * 60_000).toISOString();
          log(`Esperando ${humanMinutes(min)}.`);
          await port.saveRun(run);
          return;
        }
        case "wait_reply": {
          if (pendingReply === undefined) {
            log("Esperando o cliente responder.");
            return await waitReply(step.id, step.minutes);
          }
          log(`Cliente respondeu: “${pendingReply.slice(0, 60)}”`);
          pendingReply = undefined;
          run.state = {};
          break;
        }
        case "message": {
          const buttons = step.buttons?.filter((b) => b.label.trim()) ?? [];
          if (buttons.length && pendingReply !== undefined) {
            // voltou com a resposta: escolhe o caminho do botão
            const b = pickButton(buttons, pendingReply);
            log(b ? `Cliente escolheu “${b.label}”.` : `Resposta fora dos botões: “${pendingReply.slice(0, 60)}”.`);
            next = b ? b.next : (step.elseNext ?? null);
            pendingReply = undefined;
            run.state = {};
            break;
          }
          // canais sem botão nativo recebem as opções numeradas
          const body = buttons.length ? `${step.text}\n\n${buttons.map((b, i) => `${i + 1} - ${b.label}`).join("\n")}` : step.text;
          const sent = await send(body);
          log(`Mensagem enviada: “${sent.length > 80 ? sent.slice(0, 80) + "…" : sent}”`);
          if (buttons.length) return await waitReply(step.id, 1440);
          break;
        }
        case "validate": {
          if (pendingReply === undefined) {
            await send(step.question);
            log(`Pergunta enviada: “${step.question.slice(0, 60)}”`);
            return await waitReply(step.id, 1440);
          }
          const answer = pendingReply;
          pendingReply = undefined;
          if (validAnswer(step.kind, answer)) {
            log(`Resposta válida: “${answer.slice(0, 60)}”.`);
            if (ctx.lead) {
              if (step.saveFieldId) await port.setField(ws, ctx.lead, step.saveFieldId, answer.trim());
              else await port.addNote(ws, ctx.lead, `Resposta ao robô “${r.name}”: ${answer.trim()}`);
            }
            run.state = {};
          } else {
            const tries = (run.state?.tries ?? 0) + 1;
            if (tries < step.tries) {
              if (step.retryText.trim()) await send(step.retryText);
              log(`Resposta inválida (${tries}/${step.tries}); perguntou de novo.`, true);
              run.state = { tries };
              return await waitReply(step.id, 1440);
            }
            log(`Resposta inválida depois de ${step.tries} tentativas.`, true);
            run.state = {};
            next = step.failNext ?? null;
          }
          break;
        }
        case "condition": {
          const values = conditionValue(step, ctx, msg).map(norm);
          const hit = step.rules.find((rule) => {
            const v = norm(rule.label);
            if (!v) return false;
            if (rule.op === "equals") return values.some((x) => x === v);
            if (rule.op === "not_contains") return values.every((x) => !x.includes(v));
            return values.some((x) => x.includes(v));
          });
          log(hit ? `Condição: “${hit.label}”.` : "Condição: nenhuma regra bateu (senão).");
          next = hit ? hit.next : (step.elseNext ?? null);
          break;
        }
        case "round_robin": {
          const lead = needLead();
          const users = step.userIds.filter(Boolean);
          if (!users.length) throw new Error("Pulado: rodízio sem vendedores.");
          const n = await port.countRuns(r.id, run.createdAt);
          const userId = users[n % users.length];
          await port.setResponsible(ws, lead, userId);
          lead.responsibleUserId = userId;
          log("Rodízio: lead entregue ao próximo vendedor da vez.");
          await port.logOnLead(ws, lead.id, r.name, "Rodízio: novo responsável.");
          break;
        }
        case "internal": {
          const text = renderText(step.text, ctx);
          await port.notifyTeam(ws, `🤖 ${r.name}: ${text}`);
          log("Aviso enviado para a equipe.");
          break;
        }
        case "task": {
          const lead = needLead();
          const text = renderText(step.text, ctx) || "Retornar contato";
          await port.createTask(ws, lead, text, new Date(Date.now() + Math.max(0, step.dueMinutes) * 60_000).toISOString());
          log(`Tarefa criada: ${text}`);
          await port.logOnLead(ws, lead.id, r.name, `Tarefa criada: ${text}`);
          break;
        }
        case "tag": {
          const lead = needLead();
          const tag = step.tag.trim();
          if (!tag) throw new Error("Pulado: etiqueta vazia.");
          if (step.remove) {
            await port.removeTag(ws, lead, tag);
            lead.tags = lead.tags.filter((t) => t !== tag);
          } else {
            await port.addTag(ws, lead, tag);
            if (!lead.tags.includes(tag)) lead.tags.push(tag);
          }
          log(`Etiqueta ${step.remove ? "removida" : "adicionada"}: ${tag}`);
          await port.logOnLead(ws, lead.id, r.name, `Etiqueta ${step.remove ? "removida" : "adicionada"}: ${tag}`);
          break;
        }
        case "responsible": {
          const lead = needLead();
          const changed = lead.responsibleUserId !== step.userId;
          await port.setResponsible(ws, lead, step.userId);
          lead.responsibleUserId = step.userId;
          log("Responsável alterado.");
          await port.logOnLead(ws, lead.id, r.name, "Responsável alterado.");
          if (changed && run.depth + 1 <= MAX_DEPTH) await fireRobots(port, ws, { trigger: "responsible_changed", leadId: lead.id, depth: run.depth + 1 });
          break;
        }
        case "stage": {
          const lead = needLead();
          const moved = await port.moveStage(ws, lead, step.stageId);
          if (moved) {
            lead.stageId = step.stageId;
            log("Lead movido de etapa.");
            await port.logOnLead(ws, lead.id, r.name, "Lead movido de etapa.");
            if (run.depth + 1 <= MAX_DEPTH) await fireRobots(port, ws, { trigger: "stage_enter", leadId: lead.id, stageId: step.stageId, depth: run.depth + 1, via: "moved" });
          } else log("Lead já estava nesta etapa.");
          break;
        }
        case "email": {
          if (!ctx.contactEmail) throw new Error("Pulado: o contato não tem email.");
          if (ctx.emailOptOut) throw new Error("Pulado: o contato pediu para não receber emails.");
          if (!emailOn()) throw new Error("Pulado: email não configurado (RESEND_API_KEY e EMAIL_FROM).");
          const subject = renderText(step.subject, ctx) || ctx.wsName;
          const body = renderText(step.text, ctx);
          if (!body) throw new Error("Pulado: email vazio.");
          const unsub = ctx.contactId ? unsubscribeUrl(ctx.contactId) : null;
          const ok = await sendEmailBatch([{ to: ctx.contactEmail, subject, ...marketingEmail({ company: ctx.wsName, text: body, unsubscribe: unsub }), unsubscribe: unsub }]);
          if (!ok) throw new Error("O email não saiu: o Resend recusou (confira o domínio e a chave).");
          log(`Email enviado para ${ctx.contactEmail}.`);
          if (ctx.lead) await port.logOnLead(ws, ctx.lead.id, r.name, `Email enviado: ${subject}`);
          break;
        }
        case "note": {
          const lead = needLead();
          const text = renderText(step.text, ctx);
          if (!text) throw new Error("Pulado: nota vazia.");
          await port.addNote(ws, lead, text);
          log("Nota adicionada.");
          break;
        }
        case "set_field": {
          const lead = needLead();
          await port.setField(ws, lead, step.fieldId, renderText(step.value, ctx));
          log("Campo preenchido.");
          break;
        }
        case "close": {
          if (ctx.conversation) await port.closeConversation(ws, ctx.conversation);
          log("Conversa fechada.");
          break;
        }
        case "webhook": {
          await postWebhook(step.url, {
            evento: "robo",
            robo: { id: r.id, nome: r.name },
            lead: ctx.lead ? { id: ctx.lead.id, nome: ctx.lead.name, numero: ctx.lead.number, valor_centavos: ctx.lead.priceCents, etiquetas: ctx.lead.tags, origem: ctx.lead.attribution ?? null } : null,
            contato: { nome: ctx.contactName },
            canal: ctx.channelKind,
            em: nowIso(),
          });
          log("Webhook enviado.");
          break;
        }
        case "start_robot": {
          const other = await port.robot(ws, step.robotId);
          // desligado = não dispara pelo próprio gatilho; chamado por outro robô (ou gatilho de etapa), roda
          if (!other) throw new Error("Pulado: o outro robô foi apagado.");
          if (run.depth + 1 > MAX_DEPTH) throw new Error("Pulado: muitos robôs encadeados.");
          log(`Passou para o robô “${other.name}”.`);
          await advance(port, other, newRun(ws, other, ctx, run.depth + 1), ctx, undefined, msg);
          next = null;
          break;
        }
        case "stop":
          log("Parou aqui.");
          next = null;
          break;
      }
    } catch (e) {
      log(e instanceof Error && e.message ? e.message : "Não deu para executar este passo.", false);
      pendingReply = undefined;
    }
    id = next;
  }
  run.cursor = null;
  run.status = run.log.some((l) => !l.ok) ? "failed" : "done";
  run.state = {};
  await port.saveRun(run);
  await port.bump(r.id, nowIso());
}
