/* Tipos do domínio. Espelham replica/schema.sql em camelCase.
   A camada real (Supabase) devolve exatamente estes formatos. */

export type ID = string;
export type ISO = string; // timestamptz em UTC

export type User = { id: ID; name: string; email: string; /** foto (data URL pequena) */ avatar?: string | null };
export type Workspace = { id: ID; slug: string; name: string; timezone: string; currency: string; /** logo (data URL pequena) */ logo?: string | null; /** WhatsApp da empresa (só dígitos) */ phone?: string | null };

export type StageKind = "open" | "won" | "lost";
export type StageColor = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "won" | "lost";
export type Stage = { id: ID; pipelineId: ID; name: string; color: StageColor; kind: StageKind; sort: number };
export type Pipeline = { id: ID; workspaceId: ID; name: string; sort: number; stages: Stage[] };
export type LossReason = { id: ID; name: string };

export type IdentityKind = "phone" | "email" | "whatsapp" | "instagram" | "webchat";
export type Identity = { kind: IdentityKind; value: string };

export type Company = { id: ID; workspaceId: ID; name: string; responsibleUserId: ID | null; createdAt: ISO };
export type Contact = {
  id: ID;
  workspaceId: ID;
  name: string;
  companyId: ID | null;
  responsibleUserId: ID | null;
  identities: Identity[];
  createdAt: ISO;
  /** pediu para não receber emails (link de descadastro) */
  emailOptOut?: boolean;
  /** foto de perfil (WhatsApp por QR code) */
  avatarUrl?: string | null;
};

export type Lead = {
  id: ID;
  workspaceId: ID;
  number: number;
  name: string;
  pipelineId: ID;
  stageId: ID;
  responsibleUserId: ID | null;
  priceCents: number;
  currency: string;
  lossReasonId: ID | null;
  source: string;
  companyId: ID | null;
  tags: string[];
  closedAt: ISO | null;
  closestTaskAt: ISO | null;
  lastActivityAt: ISO;
  /** de onde o lead veio (UTMs, anúncio); null quando não se sabe */
  attribution?: Attribution | null;
  createdAt: ISO;
};

export type LeadCard = Lead & {
  mainContact: Contact | null;
  hasUnread: boolean;
  channelKind: ChannelKind | null;
  taskState: "none" | "ok" | "late";
};

export type TaskType = { id: ID; name: string };
export type Task = {
  id: ID;
  workspaceId: ID;
  leadId: ID | null;
  contactId: ID | null;
  taskTypeId: ID | null;
  responsibleUserId: ID;
  text: string;
  dueAt: ISO;
  completedAt: ISO | null;
  resultText: string | null;
  createdAt: ISO;
};

export type Note = { id: ID; leadId: ID | null; contactId: ID | null; body: string; createdBy: ID; createdAt: ISO };

export type EventKind =
  | "lead_created"
  | "stage_changed"
  | "responsible_changed"
  | "price_changed"
  | "name_changed"
  | "task_completed"
  | "contact_linked"
  | "automation_ran";
export type LeadEvent = {
  id: ID;
  leadId: ID;
  kind: EventKind;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actorUserId: ID | null;
  createdAt: ISO;
};

export type ChannelKind = "whatsapp" | "instagram" | "messenger" | "webchat";
export type Channel = {
  id: ID;
  workspaceId: ID;
  kind: ChannelKind;
  name: string;
  publicKey: string | null;
  defaultPipelineId: ID | null;
  status: "connecting" | "connected" | "error" | "disconnected";
  /** id da conta na rede (número do WhatsApp, página, perfil); webchat não tem */
  externalId?: string | null;
};

export type Conversation = {
  id: ID;
  workspaceId: ID;
  channelId: ID;
  contactId: ID;
  leadId: ID | null;
  externalThreadId: string;
  status: "open" | "closed";
  assignedUserId: ID | null;
  unreadCount: number;
  isUnanswered: boolean;
  lastMessageAt: ISO | null;
  lastInboundAt: ISO | null;
  lastMessagePreview: string;
  attribution?: Attribution | null;
  /** a IA parou de responder nesta conversa (um vendedor assumiu ou ela passou para humano) */
  aiPaused?: boolean;
};

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received";
export type Message = {
  id: ID;
  conversationId: ID;
  direction: "in" | "out";
  body: string;
  senderUserId: ID | null;
  clientId: string | null;
  status: MessageStatus;
  sentAt: ISO;
  /** escrita pelo agente de IA */
  byAi?: boolean;
  /** texto (padrão) ou anexo */
  kind?: "text" | "image" | "audio" | "video" | "file";
  /** anexo; url é um link temporário para mostrar/baixar (null se não deu para gerar) */
  file?: MessageFile | null;
};

export type MessageFile = { id: ID; name: string; mime: string; size: number; url: string | null };

export type IncomingLead = {
  id: ID;
  workspaceId: ID;
  pipelineId: ID;
  channelId: ID | null;
  conversationId: ID | null;
  contactId: ID | null;
  kind: "chat" | "call" | "email" | "form";
  preview: string;
  who: string;
  status: "pending" | "accepted" | "declined" | "linked";
  resolvedLeadId: ID | null;
  resolvedBy: ID | null;
  createdAt: ISO;
};

export type FeedItem =
  | { type: "message"; at: ISO; message: Message; channelKind: ChannelKind }
  | { type: "note"; at: ISO; note: Note; author: string }
  | { type: "task"; at: ISO; task: Task }
  | { type: "event"; at: ISO; event: LeadEvent; text: string };

/* ---------- robôs (automações em passos, estilo Salesbot + funil digital) ---------- */
export type RobotTrigger = "stage_enter" | "lead_created" | "message_in" | "new_contact" | "responsible_changed" | "tag_added" | "field_changed" | "no_reply" | "schedule_daily";
/** gatilho de etapa (estilo funil digital do Kommo): o que ele faz */
export type StageTriggerAction = "robot" | "message" | "email" | "task" | "tag" | "stage" | "responsible" | "webhook" | "note" | "ai_on" | "ai_off" | "complete_tasks" | "field" | "create_lead";
/** horário de atividade: só roda nesses dias/horas (fuso de Brasília) */
export type ActiveHours = { from: string; to: string; days: number[] };
/** posição no quadro e ligação para o próximo passo (null = termina; ausente = o seguinte da lista) */
type StepBase = { id: string; x?: number; y?: number; next?: string | null };
/** saída com rótulo (botão, regra de condição) que leva a um passo */
export type StepBranch = { id: string; label: string; next: string | null };
export type ConditionSource = "message" | "utm_source" | "utm_campaign" | "tag" | "channel";
export type RobotStep = StepBase &
  (
    | { type: "message"; text: string; buttons?: StepBranch[]; elseNext?: string | null }
    | { type: "wait"; minutes: number }
    | { type: "wait_reply"; minutes: number; timeoutNext?: string | null }
    | { type: "condition"; source: ConditionSource; rules: (StepBranch & { op: "contains" | "equals" | "not_contains" })[]; elseNext?: string | null }
    | { type: "validate"; kind: "any" | "email" | "phone" | "number" | "cpf"; question: string; retryText: string; tries: number; failNext?: string | null; saveFieldId?: string }
    | { type: "round_robin"; userIds: string[] }
    | { type: "internal"; text: string }
    | { type: "task"; text: string; dueMinutes: number }
    | { type: "tag"; tag: string; remove?: boolean }
    | { type: "responsible"; userId: string }
    | { type: "stage"; stageId: string }
    | { type: "note"; text: string }
    | { type: "set_field"; fieldId: string; value: string }
    | { type: "close" }
    | { type: "webhook"; url: string }
    | { type: "email"; subject: string; text: string }
    | { type: "ai"; on: boolean }
    | { type: "complete_tasks" }
    | { type: "create_lead"; stageId: string; name: string }
    | { type: "start_robot"; robotId: string }
    | { type: "stop" }
  );
export type RobotStepType = RobotStep["type"];
export type Robot = {
  id: ID;
  workspaceId: ID;
  name: string;
  active: boolean;
  trigger: RobotTrigger;
  pipelineId: ID | null;
  stageId: ID | null;
  /** vazio = todos os canais */
  channels: ChannelKind[];
  /** só para "message_in": dispara se a mensagem tiver alguma destas palavras (vazio = qualquer mensagem) */
  keywords: string[];
  /** roda uma vez só por lead/conversa */
  once: boolean;
  steps: RobotStep[];
  /** quadro: posição do bloco de início */
  start?: { x: number; y: number; next?: string | null };
  /** filtros opcionais e regras do gatilho de etapa */
  conditions?: {
    /** só para leads cuja UTM contém o texto */
    utmField?: (typeof UTM_KEYS)[number];
    utmContains?: string;
    /** entrou na etapa: só quando o lead nasce nela, só quando é movido para ela, ou os dois (padrão) */
    when?: "created" | "moved" | "both";
    /** só para leads com alguma destas etiquetas */
    tags?: string[];
    /** só para leads deste responsável */
    ownerId?: string;
    /** só roda nesse horário; fora dele, pula */
    hours?: ActiveHours;
    /** criado pelo "Adicionar" de uma etapa do funil digital (aparece como gatilho, não como robô) */
    origin?: "stage_trigger";
    action?: StageTriggerAction;
    /** tirado do funil: não dispara sozinho, mas continua salvo e pode ser chamado por um gatilho de etapa */
    detached?: boolean;
    /** "tag_added": só esta etiqueta dispara (vazio = qualquer uma) */
    tagTrigger?: string;
    /** "field_changed": só este campo ("price" = valor da venda, ou o id do campo personalizado) */
    fieldTrigger?: string;
    /** com espera: só age se o lead ainda estiver na etapa quando o tempo passar */
    stayInStage?: boolean;
    /** "schedule_daily": horário (Brasília, HH:MM) e o último dia em que rodou */
    dailyAt?: string;
    dailyDone?: string;
  };
  runCount: number;
  lastRunAt: ISO | null;
  createdAt: ISO;
};
export type RobotInput = Omit<Robot, "id" | "workspaceId" | "runCount" | "lastRunAt" | "createdAt">;
export type RobotLogLine = { at: ISO; text: string; ok: boolean };
export type RobotRun = {
  id: ID;
  workspaceId: ID;
  robotId: ID;
  leadId: ID | null;
  conversationId: ID | null;
  step: number;
  /** passo atual (robôs com caminhos); null = começo */
  cursor?: string | null;
  /** esperando resposta do cliente, tentativas da validação etc. */
  state?: { wait?: "time" | "reply"; tries?: number };
  depth: number;
  status: "waiting" | "running" | "done" | "failed";
  runAt: ISO;
  log: RobotLogLine[];
  createdAt: ISO;
};
export type RobotEvent =
  | { trigger: "stage_enter"; leadId: ID; stageId: ID; depth?: number; via?: "created" | "moved"; robotId?: ID }
  | { trigger: "lead_created"; leadId: ID; depth?: number }
  | { trigger: "responsible_changed"; leadId: ID; depth?: number; robotId?: ID }
  | { trigger: "message_in" | "new_contact" | "no_reply"; conversationId: ID; text: string }
  | { trigger: "tag_added"; leadId: ID; tag: string; depth?: number }
  | { trigger: "field_changed"; leadId: ID; field: string; depth?: number }
  | { trigger: "schedule_daily"; leadId: ID; robotId: ID };

export type Template = {
  id: ID;
  workspaceId: ID;
  name: string;
  shortcut: string | null;
  body: string;
  /** rede para a qual o modelo foi escrito (regras e prévia mudam por rede) */
  network: "whatsapp" | "instagram" | "messenger" | "tiktok" | "webchat";
  /** só WhatsApp: categoria cobrada pela Meta */
  category: "marketing" | "utility" | "authentication" | null;
  header: string | null;
  footer: string | null;
  buttons: { kind: "reply" | "url"; text: string; url?: string }[];
  /** só WhatsApp: situação na Meta */
  waStatus: "draft" | "pending" | "approved" | "rejected" | null;
  createdAt: ISO;
};
export type TemplateInput = Pick<Template, "name" | "shortcut" | "body" | "network" | "category" | "header" | "footer" | "buttons">;

/** dados de cobrança da empresa (nota e boleto pedem documento e endereço) */
export type BillingProfile = {
  person: "pf" | "pj";
  doc: string;
  name: string;
  email: string;
  phone: string;
  address: { zip: string; street: string; number: string; complement: string; district: string; city: string; state: string };
};

/** pagamento gerado no checkout (aprovado ou não); no Pix/boleto em aberto, guarda como pagar */
export type CheckoutPayment = {
  id: string;
  title: string;
  cents: number;
  method: "pix" | "boleto" | "card";
  status: string;
  pix: { code: string; image: string | null } | null;
  boleto: { url: string; barcode: string | null } | null;
  expiresAt: ISO | null;
  createdAt: ISO;
};

export type Subscription = {
  plan: "trial" | "basic" | "advanced" | "pro";
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
  seats: number;
  stripeCustomerId: string | null;
  trialEndsAt: ISO | null;
  currentPeriodEnd: ISO | null;
};

/** Erro de domínio com código estável — a UI traduz o código, não a mensagem. */
export class DomainError extends Error {
  constructor(
    public code: "not_found" | "forbidden" | "already_resolved" | "invalid" | "window_closed" | "unauthenticated",
    message?: string,
  ) {
    super(message ?? code);
  }
}

/* ---------- equipe ---------- */
export type Role = { id: ID; name: string; isAdmin: boolean };
export type Member = { userId: ID; name: string; email: string; roleId: ID; roleName: string; isAdmin: boolean };
/** convite por link ainda não aceito */
export type Invite = { id: ID; email: string; roleId: ID; roleName: string; expiresAt: ISO };
/** o que a página do convite mostra (aberta por quem recebeu o link) */
export type InviteInfo = { workspaceName: string; workspaceSlug: string; email: string; roleName: string; state: "ok" | "expired" | "accepted" };

/* ---------- campos personalizados (valores ficam no lead, chave = id do campo) ---------- */
export type FieldKind = "text" | "textarea" | "number" | "money" | "select" | "date" | "checkbox" | "url" | "phone" | "email";
export type CustomField = { id: ID; name: string; kind: FieldKind; options: string[]; sort: number };
export type FieldValue = string | number | boolean | null;

/* ---------- chat interno da equipe ---------- */
export type TeamMessage = { id: ID; userId: ID; userName: string; body: string; createdAt: ISO; kind?: "text" | "image" | "audio" | "video" | "file"; file?: MessageFile | null };

/* ---------- disparos em massa ---------- */
export type BroadcastFilter = { pipelineId: ID | null; stageIds: ID[]; tag: string | null; channels: ChannelKind[] };
export type Broadcast = {
  id: ID;
  name: string;
  body: string;
  filter: BroadcastFilter;
  total: number;
  sent: number;
  failed: number;
  createdBy: string;
  createdAt: ISO;
  /** "message": pelo canal da conversa; "email": para o email do contato principal */
  medium?: "message" | "email";
  subject?: string | null;
};

/* ---------- cadastro e acesso (teste grátis / plano) ---------- */
export type SignupInfo = { company: string; docType: "cpf" | "cnpj" | null; document: string; phone: string };
/** créditos de IA da empresa no mês */
export type AiWallet = {
  /** AAAA-MM */
  month: string;
  /** respostas da IA gastas neste mês (plano + avulsos) */
  used: number;
  /** quanto o plano inclui por mês */
  included: number;
  /** créditos avulsos comprados que ainda sobram (não vencem) */
  extra: number;
  /** chave própria da Anthropic: só o final, para mostrar; com ela a IA não gasta crédito */
  ownKeyHint: string | null;
};

/* ---------- estatísticas ---------- */
/** uma linha do registro de atividade (eventos do lead, notas e tarefas), com os campos já normalizados */
export type ActivityEvent = {
  id: ID;
  at: ISO;
  kind: EventKind | "note_added" | "task_created" | "task_done";
  leadId: ID | null;
  /** null = robô/sistema */
  actorUserId: ID | null;
  stageFrom?: ID | null;
  stageTo?: ID | null;
  userFrom?: ID | null;
  userTo?: ID | null;
  centsFrom?: number | null;
  centsTo?: number | null;
  nameFrom?: string | null;
  nameTo?: string | null;
  /** robô que fez (automation_ran) */
  robot?: string | null;
  /** texto livre: nota, tarefa, o que o robô fez */
  text?: string | null;
};
/** mensagens no período por canal */
export type MessageStats = { kind: ChannelKind; received: number; sent: number; delivered: number; read: number; failed: number; byAi: number };
/** meta do mês por pessoa (valor em centavos e/ou quantidade de vendas) */
export type SalesGoal = { userId: ID; cents: number; count: number };
/** relatório de ROI: quanto investiu numa origem (UTM) num período, contra o que vendeu */
export type RoiReport = { id: ID; name: string; investmentCents: number; utmSource: string | null; utmCampaign: string | null; from: string; to: string; createdAt: ISO };

/** contagens para a aba Uso do plano */
export type UsageCounts = { leads: number; contacts: number; companies: number; pipelines: number; users: number; socialChannels: number; activeRobots: number; trackingLinks: number; customFields: number };

export type Access = {
  state: "trial" | "active" | "locked";
  /** plano contratado (no teste, "trial": tudo liberado) */
  plan: "trial" | "basic" | "advanced" | "pro";
  /** por que travou ou avisa: teste acabou, pagamento falhou, plano cancelado */
  reason: "trial_over" | "unpaid" | "canceled" | null;
  trialEndsAt: ISO | null;
  daysLeft: number | null;
};

/* ---------- origem do lead (UTMs e anúncios) ---------- */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  /** id do clique do anúncio "clique para WhatsApp" da Meta */
  ctwa_clid?: string;
  ad_id?: string;
  ad_headline?: string;
  landing?: string;
  referrer?: string;
  /** por onde a origem chegou */
  via?: "link" | "site" | "webchat" | "meta_ad" | "manual" | "code";
  link_name?: string;
  link_id?: string;
  at?: ISO;
  /** primeiro contato (quando o lead voltou depois por outra campanha) */
  first?: Attribution;
  /** caminho do lead: cada campanha diferente por onde ele chegou, da mais antiga à mais nova (até 10) */
  history?: AttributionTouch[];
};
export type AttributionTouch = { at?: ISO; via?: Attribution["via"]; label: string };
/** código no texto pronto do anúncio (ex.: "G-01-34"): quando a mensagem chega com ele, a origem é preenchida sozinha */
export type MessageCode = { id: ID; code: string; name: string; defaults: Attribution; matched: number; createdAt: ISO };
/** de onde os leads de um funil vêm além do canal padrão: "mensagem do WhatsApp com a palavra orçamento → funil Orçamentos" */
export type SourceRule = { id: ID; pipelineId: ID; channelId: ID | null; match: "keyword" | "code" | "link" | "ad"; value: string; matched: number; createdAt: ISO };
export type TrackingLink = { id: ID; name: string; code: string; phone: string; message: string; defaults: Attribution; clicks: number; matched: number; createdAt: ISO };

/* ---------- marcações no calendário (etiqueta num dia: promoção, folga, feriado municipal) ---------- */
export type MarkColor = "blue" | "green" | "amber" | "red" | "purple" | "gray";
export type CalendarMark = { id: ID; date: string; label: string; color: MarkColor; note: string | null; createdBy: string };

// ---------------------------------------------------------------------------
// agente de IA
// ---------------------------------------------------------------------------
export type AgentTone = "amigavel" | "formal" | "direto";
export type AgentConfig = {
  enabled: boolean;
  name: string;
  tone: AgentTone;
  instructions: string;
  knowledge: string;
  channels: ChannelKind[];
  handoffMessage: string;
  updatedAt: ISO | null;
};
export const AGENT_DEFAULT: AgentConfig = {
  enabled: false,
  name: "Assistente",
  tone: "amigavel",
  instructions: "",
  knowledge: "",
  channels: ["webchat", "whatsapp", "instagram", "messenger"],
  handoffMessage: "Vou chamar alguém da equipe para continuar com você. Só um instante!",
  updatedAt: null,
};
