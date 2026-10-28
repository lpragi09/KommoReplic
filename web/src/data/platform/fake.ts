import "server-only";
import { db, hash, now, seedWorkspaceBasics, uid } from "../fake/store";
import { DomainError } from "../types";
import type { AuditRow, PlatformRepo } from "./types";

/* Central da plataforma no banco em memória (desenvolvimento e testes). */

type Meta = { createdAt: Map<string, string>; demos: Set<string>; banned: Set<string>; audit: AuditRow[] };
const g = globalThis as unknown as { __crmPlatform?: Meta };
const meta: Meta = (g.__crmPlatform ??= { createdAt: new Map(), demos: new Set(), banned: new Set(), audit: [] });
const born = (id: string) => {
  if (!meta.createdAt.has(id)) meta.createdAt.set(id, now());
  return meta.createdAt.get(id)!;
};

export const platform: PlatformRepo = {
  async listWorkspaces() {
    const month = new Date(Date.now() - 30 * 864e5).toISOString();
    return db.workspaces.map((w) => {
      const admin = db.memberships.find((m) => m.workspaceId === w.id && m.role === "admin");
      const owner = admin && db.users.find((u) => u.id === admin.userId);
      const s = db.subs[w.id];
      const convs = new Set(db.conversations.filter((c) => c.workspaceId === w.id).map((c) => c.id));
      const leads = db.leads.filter((l) => l.workspaceId === w.id);
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        createdAt: born(w.id),
        isDemo: meta.demos.has(w.id),
        ownerId: owner?.id ?? null,
        ownerEmail: owner?.email ?? null,
        ownerName: owner?.name ?? null,
        plan: s?.plan ?? "trial",
        status: s?.status ?? "trialing",
        trialEndsAt: s?.trialEndsAt ?? null,
        seats: db.memberships.filter((m) => m.workspaceId === w.id).length,
        paying: false,
        members: db.memberships.filter((m) => m.workspaceId === w.id).length,
        leads: leads.length,
        messages30d: db.messages.filter((m) => convs.has(m.conversationId) && m.sentAt >= month).length,
        lastActivity: leads.map((l) => l.lastActivityAt).sort().pop() ?? null,
      };
    });
  },

  async listUsers() {
    return db.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: born(u.id),
      lastSignInAt: db.sessions.some((s) => s.userId === u.id) ? now() : null,
      banned: meta.banned.has(u.id),
      workspaces: db.memberships
        .filter((m) => m.userId === u.id)
        .map((m) => db.workspaces.find((w) => w.id === m.workspaceId))
        .filter((w): w is NonNullable<typeof w> => !!w)
        .map((w) => ({ slug: w.slug, name: w.name })),
    }));
  },

  async listAudit(limit = 200) {
    return meta.audit.slice(0, limit);
  },

  async audit(actor, action, target, detail = {}) {
    meta.audit.unshift({ id: uid(), at: now(), actor, action, target, detail });
  },

  async extendTrial(wsId, days) {
    const s = db.subs[wsId];
    const from = Math.max(Date.now(), s?.trialEndsAt ? Date.parse(s.trialEndsAt) : 0);
    db.subs[wsId] = { plan: "trial", status: "trialing", trialEndsAt: new Date(from + days * 864e5).toISOString() };
  },

  async setPlan(wsId, plan) {
    db.subs[wsId] = plan === "trial" ? { plan, status: "trialing", trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString() } : { ...(db.subs[wsId] ?? { trialEndsAt: null }), plan, status: "active" };
  },

  async setBlocked(wsId, blocked) {
    const s = db.subs[wsId] ?? { plan: "trial" as const, status: "trialing" as const, trialEndsAt: null };
    if (blocked) db.subs[wsId] = { ...s, status: "canceled" };
    else db.subs[wsId] = !s.plan || s.plan === "trial" ? { ...s, status: "trialing", trialEndsAt: new Date(Date.now() + 7 * 864e5).toISOString() } : { ...s, status: "active" };
  },

  async setUserBanned(userId, banned) {
    if (banned) {
      meta.banned.add(userId);
      db.sessions = db.sessions.filter((s) => s.userId !== userId); // derruba quem está logado
    } else meta.banned.delete(userId);
  },

  async setUserPassword(userId, password) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new DomainError("not_found");
    u.passwordHash = hash(password);
  },

  async createDemo({ name, email, password }) {
    const mail = email.trim().toLowerCase();
    if (db.users.some((u) => u.email === mail)) throw new DomainError("invalid", "Já existe uma conta com esse email.");
    const user = { id: uid(), name, email: mail, passwordHash: hash(password) };
    db.users.push(user);
    const slug = `${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "demo"}-${Math.random().toString(36).slice(2, 6)}`;
    const ws = { id: uid(), slug, name, timezone: "America/Sao_Paulo", currency: "BRL" };
    db.workspaces.push(ws);
    db.memberships.push({ workspaceId: ws.id, userId: user.id, role: "admin" });
    seedWorkspaceBasics(db, ws.id);
    db.subs[ws.id] = { plan: "pro", status: "active", trialEndsAt: null };
    meta.demos.add(ws.id);
    await seedFakeDemo(ws.id, user.id);
    return { slug };
  },

  async resetDemo(wsId) {
    if (!meta.demos.has(wsId)) throw new DomainError("invalid", "Essa empresa não é de demonstração.");
    const ids = new Set(db.leads.filter((l) => l.workspaceId === wsId).map((l) => l.id));
    db.leads = db.leads.filter((l) => l.workspaceId !== wsId);
    db.tasks = db.tasks.filter((t) => t.workspaceId !== wsId);
    db.leadContacts = db.leadContacts.filter((x) => !ids.has(x.leadId));
    const owner = db.memberships.find((m) => m.workspaceId === wsId && m.role === "admin")?.userId ?? "";
    await seedFakeDemo(wsId, owner);
  },
};

/** alguns negócios espalhados pelo funil, como na demonstração do Supabase */
async function seedFakeDemo(wsId: string, userId: string) {
  const p = db.pipelines.find((x) => x.workspaceId === wsId)!;
  const open = p.stages.filter((s) => s.kind === "open");
  const deals: [string, number, number][] = [
    ["Clínica Vida — 2 implantes", 0, 1250000],
    ["Pet Shop Bicho Feliz — plano anual", 1, 480000],
    ["Escola Saber — 3 unidades", 2, 3600000],
    ["Torres Consultoria — projeto", 3, 900000],
  ];
  for (const [name, stage, cents] of deals)
    db.leads.push({
      id: uid(),
      workspaceId: wsId,
      number: ++db.leadSeq,
      name,
      pipelineId: p.id,
      stageId: open[stage].id,
      responsibleUserId: userId,
      priceCents: cents,
      currency: "BRL",
      lossReasonId: null,
      source: "manual",
      companyId: null,
      tags: [],
      closedAt: null,
      closestTaskAt: null,
      lastActivityAt: now(),
      createdAt: now(),
    });
}
