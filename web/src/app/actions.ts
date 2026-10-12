"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import * as data from "@/data";
import { SESSION_COOKIE, currentUser, requireWorkspace } from "@/data/session";
import { DomainError } from "@/data/types";
import { rateLimit } from "@/lib/rate-limit";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const out = await fn();
    refresh();
    return { ok: true, data: out };
  } catch (e) {
    if (e instanceof DomainError) return fail(e.code === "invalid" || e.code === "already_resolved" || e.code === "window_closed" ? e.message : "Não deu certo desta vez e nada foi perdido. Tente de novo.");
    if (e instanceof z.ZodError) return fail(e.issues[0]?.message ?? "Dados inválidos.");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// autenticação
// ---------------------------------------------------------------------------
async function setSession(token: string) {
  if (data.MANAGES_OWN_SESSION) return; // Supabase Auth já gravou os próprios cookies
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
}

async function afterLogin() {
  const user = await currentUser();
  const wss = user ? await data.workspacesOf(user.id) : [];
  redirect(wss[0] ? `/${wss[0].slug}/leads` : "/onboarding");
}

export type FormState = { error?: string; values?: Record<string, string> };

const signInSchema = z.object({
  email: z.string().trim().email("Digite um email válido."),
  password: z.string().min(1, "Digite a senha."),
});

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: String(form.get("email") ?? "") };
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  if (!rateLimit(`login:${await clientIp()}:${parsed.data.email.toLowerCase()}`, 5, 60_000))
    return { error: "Muitas tentativas. Espere um minuto e tente de novo.", values };
  try {
    await setSession(await data.signIn(parsed.data.email, parsed.data.password));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, values };
    throw e;
  }
  await afterLogin();
  return {};
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Digite seu nome."),
  email: z.string().trim().email("Digite um email válido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  if (!rateLimit(`signup:${await clientIp()}`, 5, 10 * 60_000)) return { error: "Muitos cadastros deste endereço. Tente mais tarde.", values };
  try {
    await setSession(await data.signUp(parsed.data.name, parsed.data.email, parsed.data.password));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, values };
    throw e;
  }
  redirect("/onboarding");
}

export async function signOutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token || data.MANAGES_OWN_SESSION) await data.signOut(token ?? "");
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

const wsSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome para a empresa."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "Use de 3 a 40 letras minúsculas, números ou hífen.")
    .refine((s) => !["login", "signup", "onboarding", "chat", "design", "api", "_next", "termos", "privacidade", "app"].includes(s), "Esse endereço é reservado."),
  timezone: z.string().min(1),
  currency: z.enum(["BRL", "USD", "EUR"]),
});

export async function createWorkspaceAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = wsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  let slug: string;
  try {
    slug = (await data.createWorkspace(user.id, parsed.data)).slug;
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, values };
    throw e;
  }
  redirect(`/${slug}/leads`);
}

// ---------------------------------------------------------------------------
// leads
// ---------------------------------------------------------------------------
const id = z.string().uuid();

export async function moveLeadAction(slug: string, leadId: string, stageId: string, lossReasonId?: string | null) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.moveLead(ws.id, user.id, id.parse(leadId), id.parse(stageId), lossReasonId ? id.parse(lossReasonId) : null);
    return null;
  });
}

const newLead = z.object({
  pipelineId: id,
  stageId: id,
  name: z.string().trim().max(200, "Nome longo demais."),
  price: z.string().optional(),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
});

/** "12.500,50" → 1250050 centavos */
function parseBRL(s?: string) {
  if (!s?.trim()) return 0;
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new DomainError("invalid", "Valor inválido.");
  return Math.round(n * 100);
}

export async function createLeadAction(slug: string, input: z.input<typeof newLead>) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    const v = newLead.parse(input);
    const l = await data.createLead(ws.id, user.id, { ...v, priceCents: parseBRL(v.price) });
    return { id: l.id };
  });
}

const leadPatch = z.object({
  name: z.string().trim().max(200).optional(),
  price: z.string().optional(),
  responsibleUserId: id.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export async function updateLeadAction(slug: string, leadId: string, input: z.input<typeof leadPatch>) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    const { price, ...rest } = leadPatch.parse(input);
    await data.updateLead(ws.id, user.id, id.parse(leadId), { ...rest, ...(price !== undefined ? { priceCents: parseBRL(price) } : {}) });
    return null;
  });
}

export async function deleteLeadAction(slug: string, leadId: string) {
  return run(async () => {
    const { ws } = await requireWorkspace(slug);
    await data.deleteLead(ws.id, id.parse(leadId));
    return null;
  });
}

export async function addNoteAction(slug: string, leadId: string, body: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.addNote(ws.id, user.id, id.parse(leadId), z.string().max(5000).parse(body));
    return null;
  });
}

const newTask = z.object({
  leadId: id.nullable(),
  text: z.string().trim().max(500),
  dueAt: z.string().min(1, "Escolha o prazo."),
  taskTypeId: id.nullable(),
  responsibleUserId: id.optional(),
});

export async function createTaskAction(slug: string, input: z.input<typeof newTask>) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.createTask(ws.id, user.id, newTask.parse(input));
    return null;
  });
}

export async function completeTaskAction(slug: string, taskId: string, result: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.completeTask(ws.id, user.id, id.parse(taskId), z.string().max(1000).parse(result));
    return null;
  });
}

// ---------------------------------------------------------------------------
// leads de entrada
// ---------------------------------------------------------------------------
export async function acceptIncomingAction(slug: string, incomingId: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    const l = await data.acceptIncoming(ws.id, user.id, id.parse(incomingId));
    return { leadId: l.id };
  });
}

export async function declineIncomingAction(slug: string, incomingId: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.declineIncoming(ws.id, user.id, id.parse(incomingId));
    return null;
  });
}

export async function linkIncomingAction(slug: string, incomingId: string, leadId: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.linkIncoming(ws.id, user.id, id.parse(incomingId), id.parse(leadId));
    return null;
  });
}

// ---------------------------------------------------------------------------
// conversas
// ---------------------------------------------------------------------------
export async function sendMessageAction(slug: string, conversationId: string, body: string, clientId: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.sendMessage(ws.id, user.id, id.parse(conversationId), z.string().max(4000).parse(body), id.parse(clientId));
    return null;
  });
}

export async function markReadAction(slug: string, conversationId: string) {
  return run(async () => {
    const { ws } = await requireWorkspace(slug);
    await data.markConversationRead(ws.id, id.parse(conversationId));
    return null;
  });
}

export async function createContactAction(slug: string, input: { name: string; phone?: string; email?: string }) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    const v = z
      .object({ name: z.string().trim().min(1, "Digite o nome.").max(120), phone: z.string().max(30).optional(), email: z.string().max(200).optional() })
      .parse(input);
    const c = await data.createContact(ws.id, user.id, v);
    return { id: c.id };
  });
}

// ---------------------------------------------------------------------------
// chat do site (visitante anônimo)
// ---------------------------------------------------------------------------
const visitorMsg = z.object({
  publicKey: z.string().min(4).max(40),
  visitorId: z.string().regex(/^v-[a-z0-9-]{8,40}$/),
  name: z.string().trim().max(80),
  body: z.string().trim().min(1, "Escreva uma mensagem.").max(2000, "Mensagem longa demais."),
  messageId: z.string().uuid(),
});

export async function visitorSendAction(input: z.input<typeof visitorMsg>) {
  return run(async () => {
    const v = visitorMsg.parse(input);
    const ip = await clientIp();
    if (!rateLimit(`chat-ip:${ip}`, 30, 60_000) || !rateLimit(`chat-v:${v.visitorId}`, 12, 60_000))
      throw new DomainError("invalid", "Muitas mensagens seguidas. Espere um pouco.");
    const { channelId } = await data.getWebchat(v.publicKey);
    await data.receiveInbound(channelId, v.visitorId, v.name, v.body, v.messageId);
    return null;
  });
}

export async function visitorThreadAction(publicKey: string, visitorId: string) {
  const v = visitorMsg.pick({ publicKey: true, visitorId: true }).parse({ publicKey, visitorId });
  const msgs = await data.visitorThread(v.publicKey, v.visitorId);
  // o visitante só vê texto, direção e hora — nada de ids internos ou de quem respondeu
  return msgs.map((m) => ({ id: m.id, direction: m.direction, body: m.body, sentAt: m.sentAt }));
}

// ---------------------------------------------------------------------------
// conta e cobrança
// ---------------------------------------------------------------------------
/** Exclui a conta de verdade (LGPD e exigência da Apple). Empresas em que a pessoa é a única integrante vão junto. */
export async function deleteAccountAction() {
  const user = await currentUser();
  if (!user) redirect("/login");
  await data.deleteAccount(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}

async function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new DomainError("invalid", "Cobrança ainda não configurada.");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}

const LOOKUP = z.enum(["autonomo_mensal", "autonomo_anual", "equipe_mensal", "equipe_anual", "operacao_mensal", "operacao_anual"]);

/** Stripe Checkout para assinar um plano. Nada de formulário de cartão nosso. */
export async function startCheckoutAction(slug: string, lookupKey: string, seats: number) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    const s = await stripe();
    const prices = await s.prices.list({ lookup_keys: [LOOKUP.parse(lookupKey)], limit: 1 });
    if (!prices.data[0]) throw new DomainError("invalid", "Plano não encontrado no Stripe.");
    const origin = (await headers()).get("origin") ?? process.env.APP_URL ?? "";
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: ws.id,
      customer_email: user.email,
      // formas de pagamento (cartão, Pix) vêm do painel do Stripe
      line_items: [{ price: prices.data[0].id, quantity: Math.max(1, Math.min(500, Math.round(seats))) }],
      subscription_data: { metadata: { workspace_id: ws.id } },
      success_url: `${origin}/${slug}/settings/billing?ok=1`,
      cancel_url: `${origin}/${slug}/settings/billing`,
    });
    return { url: session.url };
  });
}

/** Portal do Stripe: trocar plano, cartão, usuários — e cancelar em um clique. */
export async function openBillingPortalAction(slug: string, customerId: string) {
  return run(async () => {
    await requireWorkspace(slug);
    const s = await stripe();
    const origin = (await headers()).get("origin") ?? process.env.APP_URL ?? "";
    const portal = await s.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/${slug}/settings/billing` });
    return { url: portal.url };
  });
}
