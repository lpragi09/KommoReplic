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
  | "contact_linked";
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
