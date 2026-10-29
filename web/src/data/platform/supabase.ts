import "server-only";
import { adminClient } from "@/lib/supabase/clients";
import { DomainError } from "../types";
import type { AuditRow, PlatformRepo, PlatformUser, PlatformWorkspace } from "./types";

/* Central da plataforma no Supabase: tudo com a chave de serviço, depois de a ação conferir
   que quem pediu é dono do netzer (lib/platform.ts). Nunca chega ao navegador. */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

const fail = (e: { message: string; code?: string } | null) => {
  if (!e) return;
  if (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01") throw new DomainError("invalid", "Rode o atualizacao-plataforma.sql no Supabase para ligar a central.");
  if (e.code === "23505") throw new DomainError("invalid", "Já existe uma empresa com esse endereço.");
  throw new Error(e.message);
};
const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "demo";

export const platform: PlatformRepo = {
  async listWorkspaces() {
    const { data, error } = await adminClient().rpc("platform_workspaces");
    fail(error);
    return ((data ?? []) as Row[]).map(
      (r): PlatformWorkspace => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        createdAt: iso(r.created_at)!,
        isDemo: !!r.is_demo,
        ownerId: r.owner_id,
        ownerEmail: r.owner_email,
        ownerName: r.owner_name,
        plan: r.plan ?? "trial",
        status: r.status ?? "trialing",
        trialEndsAt: iso(r.trial_ends_at),
        seats: r.seats ?? 1,
        paying: !!r.stripe_customer_id,
        members: Number(r.members) || 0,
        leads: Number(r.leads) || 0,
        messages30d: Number(r.messages_30d) || 0,
        lastActivity: iso(r.last_activity),
      }),
    );
  },

  async listUsers() {
    const a = adminClient();
    const users: Row[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await a.auth.admin.listUsers({ page, perPage: 500 });
      if (error) throw new Error(error.message);
      users.push(...data.users);
      if (data.users.length < 500) break;
    }
    const { data: ms } = await a.from("memberships").select("user_id, workspaces(name, slug)").eq("status", "active");
    const byUser = new Map<string, { slug: string; name: string }[]>();
    for (const m of (ms ?? []) as Row[]) if (m.workspaces) byUser.set(m.user_id, [...(byUser.get(m.user_id) ?? []), { slug: m.workspaces.slug, name: m.workspaces.name }]);
    return users
      .map(
        (u): PlatformUser => ({
          id: u.id,
          email: u.email ?? "",
          name: (u.user_metadata?.full_name as string) || "",
          createdAt: iso(u.created_at)!,
          lastSignInAt: iso(u.last_sign_in_at),
          banned: !!u.banned_until && Date.parse(u.banned_until) > Date.now(),
          workspaces: byUser.get(u.id) ?? [],
        }),
      )
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  },

  async listAudit(limit = 200) {
    const { data, error } = await adminClient().from("platform_audit").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) return [];
    return ((data ?? []) as Row[]).map((r): AuditRow => ({ id: String(r.id), at: iso(r.created_at)!, actor: r.actor_email, action: r.action, target: r.target, detail: r.detail ?? {} }));
  },

  async audit(actor, action, target, detail = {}) {
    await adminClient().from("platform_audit").insert({ actor_email: actor, action, target, detail }); // registro não pode derrubar a ação
  },

  async extendTrial(wsId, days) {
    const a = adminClient();
    const { data } = await a.from("subscriptions").select("trial_ends_at").eq("workspace_id", wsId).maybeSingle();
    const from = Math.max(Date.now(), data?.trial_ends_at ? Date.parse(data.trial_ends_at) : 0);
    fail((await a.from("subscriptions").update({ plan: "trial", status: "trialing", trial_ends_at: new Date(from + days * 864e5).toISOString() }).eq("workspace_id", wsId)).error);
  },

  async setPlan(wsId, plan) {
    const patch = plan === "trial" ? { plan, status: "trialing", trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString() } : { plan, status: "active", ...(await courtesyEnd(wsId)) };
    fail((await adminClient().from("subscriptions").update(patch).eq("workspace_id", wsId)).error);
  },

  async setBlocked(wsId, blocked) {
    const a = adminClient();
    if (blocked) return fail((await a.from("subscriptions").update({ status: "canceled" }).eq("workspace_id", wsId)).error);
    const { data } = await a.from("subscriptions").select("plan, trial_ends_at").eq("workspace_id", wsId).maybeSingle();
    const patch =
      !data || data.plan === "trial"
        ? { status: "trialing", trial_ends_at: new Date(Math.max(Date.now() + 7 * 864e5, data?.trial_ends_at ? Date.parse(data.trial_ends_at) : 0)).toISOString() }
        : { status: "active", ...(await courtesyEnd(wsId)) };
    fail((await a.from("subscriptions").update(patch).eq("workspace_id", wsId)).error);
  },

  async setUserBanned(userId, banned) {
    const { error } = await adminClient().auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
    if (error) throw new DomainError("invalid", "Não deu para mudar o acesso desse usuário.");
  },

  async setUserPassword(userId, password) {
    const { error } = await adminClient().auth.admin.updateUserById(userId, { password });
    if (error) throw new DomainError("invalid", error.message.includes("weak") ? "Senha fraca demais." : "Não deu para trocar a senha.");
  },

  async createDemo({ name, email, password }) {
    const a = adminClient();
    const { data, error } = await a.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) throw new DomainError("invalid", error?.message.includes("registered") ? "Já existe uma conta com esse email." : "Não deu para criar o usuário da demonstração.");
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const r = await a.rpc("platform_create_demo", { p_user: data.user.id, p_name: name, p_slug: slug });
    if (r.error) {
      await a.auth.admin.deleteUser(data.user.id); // não deixa usuário solto se a empresa não nasceu
      fail(r.error);
    }
    return { slug };
  },

  async resetDemo(wsId) {
    fail((await adminClient().rpc("platform_reset_demo", { p_ws: wsId })).error);
  },
};

/** liberar pela Central com o período pago já vencido vira cortesia sem data de fim (senão o cron trava de novo) */
async function courtesyEnd(wsId: string) {
  const { data } = await adminClient().from("subscriptions").select("current_period_end").eq("workspace_id", wsId).maybeSingle();
  return data?.current_period_end && Date.parse(data.current_period_end) < Date.now() ? { current_period_end: null } : {};
}
