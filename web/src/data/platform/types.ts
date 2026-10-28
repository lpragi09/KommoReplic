/* Central da plataforma: o que os donos do netzer veem de todas as empresas. */

export type PlanKey = "trial" | "basic" | "advanced" | "pro";
export type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "unpaid";

export type PlatformWorkspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  isDemo: boolean;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  plan: PlanKey;
  status: SubStatus;
  trialEndsAt: string | null;
  seats: number;
  /** tem cliente no Stripe (paga de verdade); sem isso e ativo = cortesia liberada pela central */
  paying: boolean;
  members: number;
  leads: number;
  messages30d: number;
  lastActivity: string | null;
};

export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
  workspaces: { slug: string; name: string }[];
};

export type AuditRow = { id: string; at: string; actor: string; action: string; target: string; detail: Record<string, unknown> };

export interface PlatformRepo {
  listWorkspaces(): Promise<PlatformWorkspace[]>;
  listUsers(): Promise<PlatformUser[]>;
  listAudit(limit?: number): Promise<AuditRow[]>;
  audit(actor: string, action: string, target: string, detail?: Record<string, unknown>): Promise<void>;
  extendTrial(wsId: string, days: number): Promise<void>;
  /** "trial" volta ao teste de 14 dias; os outros liberam o plano como cortesia */
  setPlan(wsId: string, plan: PlanKey): Promise<void>;
  setBlocked(wsId: string, blocked: boolean): Promise<void>;
  setUserBanned(userId: string, banned: boolean): Promise<void>;
  setUserPassword(userId: string, password: string): Promise<void>;
  createDemo(input: { name: string; email: string; password: string; owner: string }): Promise<{ slug: string }>;
  resetDemo(wsId: string): Promise<void>;
}
