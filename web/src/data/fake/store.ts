import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type {
  Channel,
  Company,
  Contact,
  Conversation,
  IncomingLead,
  Lead,
  LeadEvent,
  LossReason,
  Message,
  Note,
  Pipeline,
  Broadcast,
  CustomField,
  FieldValue,
  Robot,
  SignupInfo,
  RobotRun,
  TeamMessage,
  Task,
  Template,
  TaskType,
  User,
  Workspace,
} from "../types";
import { PRESETS } from "@/lib/robot-meta";

/* Banco em memória para desenvolvimento, até o replica-backend ligar o Supabase.
   Vive em globalThis para sobreviver ao hot reload. Reinicia ao reiniciar o servidor. */

export type Membership = { workspaceId: string; userId: string; role: "admin" | "member"; roleKey?: "gerente" | "vendedor" };
export type Session = { token: string; userId: string };

export type DB = {
  users: (User & { passwordHash: string; signup?: SignupInfo })[];
  sessions: Session[];
  workspaces: Workspace[];
  memberships: Membership[];
  pipelines: Pipeline[];
  lossReasons: (LossReason & { workspaceId: string })[];
  taskTypes: (TaskType & { workspaceId: string })[];
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  leadContacts: { leadId: string; contactId: string; isMain: boolean }[];
  tasks: Task[];
  notes: Note[];
  events: LeadEvent[];
  channels: Channel[];
  conversations: Conversation[];
  messages: Message[];
  incoming: IncomingLead[];
  robots: Robot[];
  robotRuns: RobotRun[];
  templates: Template[];
  fields: (CustomField & { workspaceId: string })[];
  leadCustom: Record<string, Record<string, FieldValue>>;
  teamMessages: (Omit<TeamMessage, "userName"> & { workspaceId: string })[];
  broadcasts: (Broadcast & { workspaceId: string })[];
  leadSeq: number;
  subs: Record<string, { trialEndsAt: string | null; status: "trialing" | "active" | "past_due" | "canceled" | "unpaid"; plan?: "trial" | "basic" | "advanced" | "pro" }>;
  trialClaims: Set<string>;
};

export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const uid = () => randomUUID();
export const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ahead = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

/* Conta de teste. Credenciais documentadas em web/README.md (seção "Dados de exemplo"). */
export const SEED_LOGIN = { email: "demo@exemplo.com", password: "demo1234" };

export function defaultStages(pipelineId: string) {
  const names: [string, Pipeline["stages"][number]["color"]][] = [
    ["Primeiro contato", "2"],
    ["Qualificado", "4"],
    ["Proposta enviada", "6"],
    ["Negociação", "8"],
  ];
  return [
    ...names.map(([name, color], i) => ({ id: uid(), pipelineId, name, color, kind: "open" as const, sort: i })),
    { id: uid(), pipelineId, name: "Ganho", color: "won" as const, kind: "won" as const, sort: 90 },
    { id: uid(), pipelineId, name: "Perdido", color: "lost" as const, kind: "lost" as const, sort: 91 },
  ];
}

export function seedWorkspaceBasics(db: DB, workspaceId: string) {
  const pid = uid();
  db.pipelines.push({ id: pid, workspaceId, name: "Vendas", sort: 0, stages: defaultStages(pid) });
  for (const name of ["Preço", "Escolheu concorrente", "Sem resposta", "Sem orçamento agora"])
    db.lossReasons.push({ id: uid(), workspaceId, name });
  for (const name of ["Follow-up", "Ligação", "Reunião", "Enviar proposta"]) db.taskTypes.push({ id: uid(), workspaceId, name });
  db.channels.push({
    id: uid(),
    workspaceId,
    kind: "webchat",
    name: "Chat do site",
    publicKey: uid().slice(0, 8),
    defaultPipelineId: pid,
    status: "connected",
  });
  return pid;
}

function seed(): DB {
  const db: DB = {
    users: [],
    sessions: [],
    workspaces: [],
    memberships: [],
    pipelines: [],
    lossReasons: [],
    taskTypes: [],
    companies: [],
    contacts: [],
    leads: [],
    leadContacts: [],
    tasks: [],
    notes: [],
    events: [],
    channels: [],
    conversations: [],
    messages: [],
    incoming: [],
    robots: [],
    robotRuns: [],
    templates: [],
    fields: [],
    leadCustom: {},
    teamMessages: [],
    broadcasts: [],
    leadSeq: 1000,
    subs: {},
    trialClaims: new Set(),
  };

  const ana = { id: uid(), name: "Ana Souza", email: SEED_LOGIN.email, passwordHash: hash(SEED_LOGIN.password) };
  const bruno = { id: uid(), name: "Bruno Lima", email: "bruno@exemplo.com", passwordHash: hash("demo1234") };
  db.users.push(ana, bruno);

  const ws: Workspace = { id: uid(), slug: "demo", name: "Loja Demo", timezone: "America/Sao_Paulo", currency: "BRL" };
  db.workspaces.push(ws);
  db.memberships.push({ workspaceId: ws.id, userId: ana.id, role: "admin" }, { workspaceId: ws.id, userId: bruno.id, role: "member" });

  const pid = seedWorkspaceBasics(db, ws.id);
  const stages = db.pipelines[0].stages;
  const chat = db.channels[0];

  const company = (name: string): Company => {
    const c = { id: uid(), workspaceId: ws.id, name, responsibleUserId: ana.id, createdAt: ago(5000) };
    db.companies.push(c);
    return c;
  };
  const contact = (name: string, phone: string, companyId: string | null, owner = ana.id): Contact => {
    const c: Contact = {
      id: uid(),
      workspaceId: ws.id,
      name,
      companyId,
      responsibleUserId: owner,
      identities: [{ kind: "phone", value: phone }],
      createdAt: ago(4000),
    };
    db.contacts.push(c);
    return c;
  };
  const lead = (name: string, stageIdx: number, price: number, c: Contact, owner: string, tags: string[], minutesAgo: number) => {
    const st = stages[stageIdx];
    const l: Lead = {
      id: uid(),
      workspaceId: ws.id,
      number: ++db.leadSeq,
      name,
      pipelineId: pid,
      stageId: st.id,
      responsibleUserId: owner,
      priceCents: price * 100,
      currency: "BRL",
      lossReasonId: null,
      source: "manual",
      companyId: c.companyId,
      tags,
      closedAt: st.kind === "open" ? null : ago(minutesAgo),
      closestTaskAt: null,
      lastActivityAt: ago(minutesAgo),
      createdAt: ago(minutesAgo + 600),
    };
    db.leads.push(l);
    db.leadContacts.push({ leadId: l.id, contactId: c.id, isMain: true });
    db.events.push({ id: uid(), leadId: l.id, kind: "lead_created", before: null, after: { stageId: stages[0].id }, actorUserId: owner, createdAt: l.createdAt });
    if (stageIdx > 0)
      db.events.push({ id: uid(), leadId: l.id, kind: "stage_changed", before: { stageId: stages[0].id }, after: { stageId: st.id }, actorUserId: owner, createdAt: ago(minutesAgo + 30) });
    return l;
  };
  const task = (l: Lead, text: string, dueMin: number, owner: string) => {
    db.tasks.push({
      id: uid(),
      workspaceId: ws.id,
      leadId: l.id,
      contactId: null,
      taskTypeId: db.taskTypes[0].id,
      responsibleUserId: owner,
      text,
      dueAt: dueMin >= 0 ? ahead(dueMin) : ago(-dueMin),
      completedAt: null,
      resultText: null,
      createdAt: ago(300),
    });
  };

  const vida = company("Clínica Vida");
  const bicho = company("Pet Shop Bicho Feliz");
  const saber = company("Escola Saber");

  const marina = contact("Marina Alves", "+5511988881234", vida.id);
  const carlos = contact("Carlos Reis", "+5511977772222", bicho.id, bruno.id);
  const joana = contact("Joana Prado", "+5521966663333", saber.id, bruno.id);
  const rafa = contact("Rafael Torres", "+5531955554444", null);
  const lu = contact("Luciana Mota", "+5541944445555", null, bruno.id);

  const l1 = lead("Clínica Vida — 2 implantes", 0, 12500, marina, ana.id, ["indicação"], 12);
  const l2 = lead("Pet Shop Bicho Feliz — plano anual", 1, 4800, carlos, bruno.id, ["varejo", "SP", "anual"], 300);
  const l3 = lead("Escola Saber — 3 unidades", 2, 36000, joana, bruno.id, ["educação"], 1440);
  const l4 = lead("Rafael Torres — consultoria", 3, 9000, rafa, ana.id, [], 2880);
  lead("Luciana Mota — pacote mensal", 4, 2400, lu, bruno.id, ["recorrente"], 4320);

  task(l1, "Ligar para confirmar horários", 120, ana.id);
  task(l2, "Enviar proposta revisada", -600, bruno.id);
  task(l3, "Reunião com a diretoria", 2880, bruno.id);
  void l4; // sem tarefa: aparece com o aviso "Sem tarefa"

  db.notes.push({ id: uid(), leadId: l3.id, contactId: null, body: "Querem começar em fevereiro. Decisão com a diretora pedagógica.", createdBy: bruno.id, createdAt: ago(1500) });

  // conversa de chat do site já ligada ao lead da Marina
  const conv: Conversation = {
    id: uid(),
    workspaceId: ws.id,
    channelId: chat.id,
    contactId: marina.id,
    leadId: l1.id,
    externalThreadId: "visitor-marina",
    status: "open",
    assignedUserId: ana.id,
    unreadCount: 1,
    isUnanswered: true,
    lastMessageAt: ago(12),
    lastInboundAt: ago(12),
    lastMessagePreview: "Vocês atendem sábado?",
  };
  db.conversations.push(conv);
  marina.identities.push({ kind: "webchat", value: "visitor-marina" });
  db.messages.push(
    { id: uid(), conversationId: conv.id, direction: "in", body: "Oi! Queria um orçamento para dois implantes.", senderUserId: null, clientId: null, status: "received", sentAt: ago(40) },
    { id: uid(), conversationId: conv.id, direction: "out", body: "Olá, Marina! Claro. Posso te ligar hoje à tarde?", senderUserId: ana.id, clientId: null, status: "read", sentAt: ago(35) },
    { id: uid(), conversationId: conv.id, direction: "in", body: "Vocês atendem sábado?", senderUserId: null, clientId: null, status: "received", sentAt: ago(12) },
  );

  // um desconhecido esperando na etapa de entrada
  const stranger: Contact = { id: uid(), workspaceId: ws.id, name: "Visitante 4521", companyId: null, responsibleUserId: null, identities: [{ kind: "webchat", value: "visitor-4521" }], createdAt: ago(6) };
  db.contacts.push(stranger);
  const conv2: Conversation = {
    id: uid(),
    workspaceId: ws.id,
    channelId: chat.id,
    contactId: stranger.id,
    leadId: null,
    externalThreadId: "visitor-4521",
    status: "open",
    assignedUserId: null,
    unreadCount: 1,
    isUnanswered: true,
    lastMessageAt: ago(6),
    lastInboundAt: ago(6),
    lastMessagePreview: "Boa tarde, quanto custa a consulta?",
  };
  db.conversations.push(conv2);
  db.messages.push({ id: uid(), conversationId: conv2.id, direction: "in", body: "Boa tarde, quanto custa a consulta?", senderUserId: null, clientId: null, status: "received", sentAt: ago(6) });
  db.incoming.push({
    id: uid(),
    workspaceId: ws.id,
    pipelineId: pid,
    channelId: chat.id,
    conversationId: conv2.id,
    contactId: stranger.id,
    kind: "chat",
    preview: conv2.lastMessagePreview,
    who: stranger.name,
    status: "pending",
    resolvedLeadId: null,
    resolvedBy: null,
    createdAt: ago(6),
  });

  // robôs de exemplo (os mesmos modelos prontos da tela de Automações)
  for (const p of PRESETS.filter((x) => x.key === "boas-vindas" || x.key === "follow-up")) {
    const st = typeof p.stage === "number" ? stages[p.stage] : undefined;
    db.robots.push({ ...structuredClone(p.robot), id: uid(), workspaceId: ws.id, pipelineId: pid, stageId: st?.id ?? null, runCount: 0, lastRunAt: null, createdAt: ago(9000) });
  }
  for (const [name, shortcut, body] of [
    ["Horário de atendimento", "horario", "Atendemos de segunda a sexta, das 9h às 18h, e sábado das 9h às 13h."],
    ["Endereço", "endereco", "Estamos na Rua Exemplo, 123 — Centro. Tem estacionamento na frente."],
    ["Pedir dados para orçamento", "orcamento", "Para te mandar o orçamento certinho, me passa: nome completo, cidade e o que você precisa?"],
  ])
    db.templates.push({ id: uid(), workspaceId: ws.id, name, shortcut, body, network: "webchat", category: null, header: null, footer: null, buttons: [], waStatus: null, createdAt: ago(9000) });

  db.fields.push(
    { id: uid(), workspaceId: ws.id, name: "Como conheceu", kind: "select", options: ["Instagram", "Indicação", "Google", "Passou na frente"], sort: 0 },
    { id: uid(), workspaceId: ws.id, name: "Data do evento", kind: "date", options: [], sort: 1 },
  );
  db.leadCustom[l1.id] = { [db.fields[0].id]: "Indicação" };
  db.teamMessages.push(
    { id: uid(), workspaceId: ws.id, userId: bruno.id, body: "Pessoal, a Escola Saber pediu reunião na quinta. Alguém cobre a tarde?", createdAt: ago(95) },
    { id: uid(), workspaceId: ws.id, userId: ana.id, body: "Pego eu! Já criei a tarefa.", createdAt: ago(80) },
  );

  for (const l of db.leads) {
    const open = db.tasks.filter((t) => t.leadId === l.id && !t.completedAt).map((t) => t.dueAt).sort();
    l.closestTaskAt = open[0] ?? null;
  }
  return db;
}

const g = globalThis as unknown as { __crmdb?: DB };
export const db: DB = (g.__crmdb ??= seed());
