/* Tipos do domínio. Espelham replica/schema.sql em camelCase.
   A camada real (Supabase) devolve exatamente estes formatos. */

export type ID = string;
export type ISO = string; // timestamptz em UTC

export type User = { id: ID; name: string; email: string };
export type Workspace = { id: ID; slug: string; name: string; timezone: string; currency: string };

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
};

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
export type RobotTrigger = "stage_enter" | "lead_created" | "message_in" | "new_contact";
export type RobotStep =
  | { id: string; type: "message"; text: string }
  | { id: string; type: "wait"; minutes: number }
  | { id: string; type: "task"; text: string; dueMinutes: number }
  | { id: string; type: "tag"; tag: string }
  | { id: string; type: "responsible"; userId: string }
  | { id: string; type: "stage"; stageId: string }
  | { id: string; type: "note"; text: string };
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
  depth: number;
  status: "waiting" | "running" | "done" | "failed";
  runAt: ISO;
  log: RobotLogLine[];
  createdAt: ISO;
};
export type RobotEvent =
  | { trigger: "stage_enter"; leadId: ID; stageId: ID; depth?: number }
  | { trigger: "lead_created"; leadId: ID; depth?: number }
  | { trigger: "message_in" | "new_contact"; conversationId: ID; text: string };

export type Template = { id: ID; workspaceId: ID; name: string; shortcut: string | null; body: string; createdAt: ISO };

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

/* ---------- campos personalizados (valores ficam no lead, chave = id do campo) ---------- */
export type FieldKind = "text" | "textarea" | "number" | "money" | "select" | "date" | "checkbox" | "url" | "phone" | "email";
export type CustomField = { id: ID; name: string; kind: FieldKind; options: string[]; sort: number };
export type FieldValue = string | number | boolean | null;

/* ---------- chat interno da equipe ---------- */
export type TeamMessage = { id: ID; userId: ID; userName: string; body: string; createdAt: ISO };

/* ---------- disparos em massa ---------- */
export type BroadcastFilter = { pipelineId: ID | null; stageIds: ID[]; tag: string | null; channels: ChannelKind[] };
export type Broadcast = { id: ID; name: string; body: string; filter: BroadcastFilter; total: number; sent: number; failed: number; createdBy: string; createdAt: ISO };

/* ---------- cadastro e acesso (teste grátis / plano) ---------- */
export type SignupInfo = { company: string; docType: "cpf" | "cnpj" | null; document: string; phone: string };
export type Access = {
  state: "trial" | "active" | "locked";
  /** por que travou ou avisa: teste acabou, pagamento falhou, plano cancelado */
  reason: "trial_over" | "unpaid" | "canceled" | null;
  trialEndsAt: ISO | null;
  daysLeft: number | null;
};
