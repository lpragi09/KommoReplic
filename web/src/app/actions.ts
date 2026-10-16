"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import * as data from "@/data";
import { SESSION_COOKIE, currentUser, requireWorkspace } from "@/data/session";
import { DomainError } from "@/data/types";
import { rateLimit } from "@/lib/rate-limit";
import { digits, isDisposableEmail, validDoc } from "@/lib/document";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Como requireWorkspace, mas recusa quando o teste acabou ou o plano está suspenso. */
async function requireActive(slug: string) {
  const ctx = await requireWorkspace(slug);
  const access = await data.getAccess(ctx.ws.id);
  if (access.state === "locked") throw new DomainError("invalid", "Seu teste grátis terminou. Ative um plano em Configurações → Plano e cobrança para continuar.");
  return ctx;
}

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const out = await fn();
    refresh();
    return { ok: true, data: out };
  } catch (e) {
    if (e instanceof DomainError) return fail(e.code === "invalid" || e.code === "already_resolved" || e.code === "window_closed" || (e.code === "forbidden" && e.message !== "forbidden") ? e.message : "Não deu certo desta vez e nada foi perdido. Tente de novo.");
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

const docFields = {
  docType: z.enum(["cpf", "cnpj"], { message: "Escolha CPF ou CNPJ." }),
  document: z.string().transform(digits),
  phone: z
    .string()
    .optional()
    .transform((v) => digits(v ?? ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 11), "WhatsApp com DDD, ex.: (11) 98888-1234."),
};
const validDocument = (d: { docType: "cpf" | "cnpj"; document: string }) => validDoc(d.docType, d.document);
const docMessage = { message: "Confira o CPF ou CNPJ: os números não batem.", path: ["document"] };

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Digite seu nome."),
    email: z
      .string()
      .trim()
      .email("Digite um email válido.")
      .refine((e) => !isDisposableEmail(e), "Use um email de verdade: endereços temporários não são aceitos."),
    password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
    company: z.string().trim().min(2, "Digite o nome da empresa ou do seu negócio.").max(120),
    ...docFields,
  })
  .refine(validDocument, docMessage);

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  const keep = ["name", "email", "company", "docType", "document", "phone"] as const;
  const values = Object.fromEntries(keep.map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  if (!rateLimit(`signup:${await clientIp()}`, 5, 10 * 60_000)) return { error: "Muitos cadastros deste endereço. Tente mais tarde.", values };
  try {
    const { company, docType, document, phone } = parsed.data;
    await setSession(await data.signUp(parsed.data.name, parsed.data.email, parsed.data.password, { company, docType, document, phone }));
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

const wsSchema = z
  .object({
  name: z.string().trim().min(2, "Dê um nome para a empresa."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "Use de 3 a 40 letras minúsculas, números ou hífen.")
    .refine((s) => !["login", "signup", "onboarding", "chat", "design", "api", "_next", "termos", "privacidade", "app"].includes(s), "Esse endereço é reservado."),
  timezone: z.string().min(1),
  currency: z.enum(["BRL", "USD", "EUR"]),
  ...docFields,
})
  .refine(validDocument, docMessage);

export async function createWorkspaceAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = wsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  let slug: string;
  let trial = true;
  try {
    const ws = await data.createWorkspace(user.id, parsed.data);
    slug = ws.slug;
    trial = (await data.getAccess(ws.id)).state !== "locked";
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, values };
    throw e;
  }
  // logo depois de criar: a tela de planos. Sem teste (documento ou email já usou), ela já explica.
  redirect(`/${slug}/settings/billing?${trial ? "bemvindo=1" : "semteste=1"}`);
}

// ---------------------------------------------------------------------------
// leads
// ---------------------------------------------------------------------------
const id = z.string().uuid();

/** Lead novo: robôs de "lead novo no funil" e de "entrou na etapa" (a etapa onde ele nasceu). */
async function robotsForNewLead(wsId: string, leadId: string, stageId: string) {
  await data.fireRobots(wsId, { trigger: "lead_created", leadId });
  await data.fireRobots(wsId, { trigger: "stage_enter", leadId, stageId });
}

export async function moveLeadAction(slug: string, leadId: string, stageId: string, lossReasonId?: string | null) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.moveLead(ws.id, user.id, id.parse(leadId), id.parse(stageId), lossReasonId ? id.parse(lossReasonId) : null);
    // o quadro só chama ao mudar de etapa; "uma vez por lead" evita repetir se voltar e ir de novo
    await data.fireRobots(ws.id, { trigger: "stage_enter", leadId, stageId });
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
    const { user, ws } = await requireActive(slug);
    const v = newLead.parse(input);
    const l = await data.createLead(ws.id, user.id, { ...v, priceCents: parseBRL(v.price) });
    await robotsForNewLead(ws.id, l.id, l.stageId);
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
    const { user, ws } = await requireActive(slug);
    const { price, ...rest } = leadPatch.parse(input);
    await data.updateLead(ws.id, user.id, id.parse(leadId), { ...rest, ...(price !== undefined ? { priceCents: parseBRL(price) } : {}) });
    return null;
  });
}

export async function deleteLeadAction(slug: string, leadId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteLead(ws.id, id.parse(leadId));
    return null;
  });
}

export async function addNoteAction(slug: string, leadId: string, body: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
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
    const { user, ws } = await requireActive(slug);
    await data.createTask(ws.id, user.id, newTask.parse(input));
    return null;
  });
}

export async function completeTaskAction(slug: string, taskId: string, result: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.completeTask(ws.id, user.id, id.parse(taskId), z.string().max(1000).parse(result));
    return null;
  });
}

// ---------------------------------------------------------------------------
// leads de entrada
// ---------------------------------------------------------------------------
export async function acceptIncomingAction(slug: string, incomingId: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const l = await data.acceptIncoming(ws.id, user.id, id.parse(incomingId));
    await robotsForNewLead(ws.id, l.id, l.stageId);
    return { leadId: l.id };
  });
}

export async function declineIncomingAction(slug: string, incomingId: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.declineIncoming(ws.id, user.id, id.parse(incomingId));
    return null;
  });
}

export async function linkIncomingAction(slug: string, incomingId: string, leadId: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.linkIncoming(ws.id, user.id, id.parse(incomingId), id.parse(leadId));
    return null;
  });
}

// ---------------------------------------------------------------------------
// conversas
// ---------------------------------------------------------------------------
export async function sendMessageAction(slug: string, conversationId: string, body: string, clientId: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.sendMessage(ws.id, user.id, id.parse(conversationId), z.string().max(4000).parse(body), id.parse(clientId));
    return null;
  });
}

export async function markReadAction(slug: string, conversationId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.markConversationRead(ws.id, id.parse(conversationId));
    return null;
  });
}

export async function createContactAction(slug: string, input: { name: string; phone?: string; email?: string }) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
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
    const { channelId, workspaceId: ws } = await data.getWebchat(v.publicKey);
    const got = await data.receiveInbound(channelId, v.visitorId, v.name, v.body, v.messageId);
    if (got && (await data.getAccess(ws).catch(() => null))?.state !== "locked") {
      if (got.isNew) await data.fireRobots(ws, { trigger: "new_contact", conversationId: got.conversationId, text: v.body });
      await data.fireRobots(ws, { trigger: "message_in", conversationId: got.conversationId, text: v.body });
    }
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

// ---------------------------------------------------------------------------
// robôs e modelos de mensagem
// ---------------------------------------------------------------------------
const channelKind = z.enum(["whatsapp", "instagram", "messenger", "webchat"]);
const stepId = z.string().min(1).max(40);
const robotStep = z.discriminatedUnion("type", [
  z.object({ id: stepId, type: z.literal("message"), text: z.string().trim().min(1, "Escreva a mensagem do robô.").max(2000, "Mensagem longa demais.") }),
  z.object({ id: stepId, type: z.literal("wait"), minutes: z.number().int().min(1, "Espera mínima de 1 minuto.").max(43200, "Espera máxima de 30 dias.") }),
  z.object({ id: stepId, type: z.literal("task"), text: z.string().trim().min(1, "Escreva o texto da tarefa.").max(500), dueMinutes: z.number().int().min(0).max(43200) }),
  z.object({ id: stepId, type: z.literal("tag"), tag: z.string().trim().min(1, "Escreva a etiqueta.").max(40) }),
  z.object({ id: stepId, type: z.literal("responsible"), userId: z.string().uuid("Escolha quem vai ser o responsável.") }),
  z.object({ id: stepId, type: z.literal("stage"), stageId: z.string().uuid("Escolha a etapa de destino.") }),
  z.object({ id: stepId, type: z.literal("note"), text: z.string().trim().min(1, "Escreva a nota.").max(2000) }),
]);
const robotInput = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao robô.").max(80),
    active: z.boolean(),
    trigger: z.enum(["stage_enter", "lead_created", "message_in", "new_contact"]),
    pipelineId: id.nullable(),
    stageId: id.nullable(),
    channels: z.array(channelKind).max(4),
    keywords: z.array(z.string().trim().min(1).max(40)).max(20),
    once: z.boolean(),
    steps: z.array(robotStep).min(1, "Adicione pelo menos um passo.").max(30, "No máximo 30 passos."),
  })
  .refine((r) => r.trigger !== "stage_enter" || !!r.stageId, "Escolha a etapa que dispara o robô.");

export async function saveRobotAction(slug: string, robotId: string | null, input: z.input<typeof robotInput>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const r = await data.saveRobot(ws.id, user.id, robotId ? id.parse(robotId) : null, robotInput.parse(input));
    return { id: r.id };
  });
}

export async function setRobotActiveAction(slug: string, robotId: string, active: boolean) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.setRobotActive(ws.id, id.parse(robotId), z.boolean().parse(active));
    return null;
  });
}

export async function deleteRobotAction(slug: string, robotId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteRobot(ws.id, id.parse(robotId));
    return null;
  });
}

/** Chamado pela tela aberta a cada ~30s: continua robôs que estavam em "Esperar". */
export async function tickRobotsAction(slug: string) {
  const { ws } = await requireWorkspace(slug);
  if ((await data.getAccess(ws.id)).state === "locked") return 0;
  const n = await data.tickRobots(ws.id);
  if (n > 0) refresh();
  return n;
}

const templateInput = z.object({
  name: z.string().trim().min(1, "Dê um nome ao modelo.").max(80),
  shortcut: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) => s.replace(/^\//, ""))
    .refine((s) => s === "" || /^[a-z0-9-]{2,30}$/.test(s), "Atalho: 2 a 30 letras minúsculas, números ou hífen.")
    .transform((s) => s || null),
  body: z.string().trim().min(1, "Escreva o texto do modelo.").max(2000, "Texto longo demais."),
});

export async function saveTemplateAction(slug: string, templateId: string | null, input: z.input<typeof templateInput>) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    const t = await data.saveTemplate(ws.id, templateId ? id.parse(templateId) : null, templateInput.parse(input));
    return { id: t.id };
  });
}

export async function deleteTemplateAction(slug: string, templateId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteTemplate(ws.id, id.parse(templateId));
    return null;
  });
}

// ---------------------------------------------------------------------------
// equipe
// ---------------------------------------------------------------------------
const newMember = z.object({
  name: z.string().trim().min(2, "Digite o nome da pessoa.").max(120),
  email: z.string().trim().email("Digite um email válido."),
  password: z.string().min(8, "A senha inicial precisa de pelo menos 8 caracteres.").max(72),
  roleId: id,
});

export async function addMemberAction(slug: string, input: z.input<typeof newMember>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.addMember(ws.id, user.id, newMember.parse(input));
    return null;
  });
}

export async function setMemberRoleAction(slug: string, userId: string, roleId: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.setMemberRole(ws.id, user.id, id.parse(userId), id.parse(roleId));
    return null;
  });
}

export async function removeMemberAction(slug: string, userId: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (userId === user.id) throw new DomainError("invalid", "Você não pode remover a si mesmo.");
    await data.removeMember(ws.id, user.id, id.parse(userId));
    return null;
  });
}

// ---------------------------------------------------------------------------
// campos personalizados
// ---------------------------------------------------------------------------
const fieldInput = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao campo.").max(60),
    kind: z.enum(["text", "textarea", "number", "money", "select", "date", "checkbox", "url", "phone", "email"]),
    options: z.array(z.string().trim().min(1).max(60)).max(50),
  })
  .refine((f) => f.kind !== "select" || f.options.length >= 2, "Uma lista precisa de pelo menos 2 opções.");

export async function saveFieldAction(slug: string, fieldId: string | null, input: z.input<typeof fieldInput>) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    const f = fieldInput.parse(input);
    await data.saveField(ws.id, fieldId ? id.parse(fieldId) : null, { ...f, options: f.kind === "select" ? [...new Set(f.options)] : [] });
    return null;
  });
}

export async function deleteFieldAction(slug: string, fieldId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteField(ws.id, id.parse(fieldId));
    return null;
  });
}

const fieldValue = z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]);

export async function setLeadFieldAction(slug: string, leadId: string, fieldId: string, value: z.input<typeof fieldValue>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.setLeadCustom(ws.id, user.id, id.parse(leadId), id.parse(fieldId), fieldValue.parse(value));
    return null;
  });
}

// ---------------------------------------------------------------------------
// chat da equipe
// ---------------------------------------------------------------------------
export async function sendTeamMessageAction(slug: string, body: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (!rateLimit(`team:${user.id}`, 30, 60_000)) throw new DomainError("invalid", "Muitas mensagens seguidas. Espere um pouco.");
    await data.sendTeamMessage(ws.id, user.id, z.string().trim().min(1, "Escreva uma mensagem.").max(4000).parse(body));
    return null;
  });
}

// ---------------------------------------------------------------------------
// disparos
// ---------------------------------------------------------------------------
const bcFilter = z.object({
  pipelineId: id.nullable(),
  stageIds: z.array(id).max(50),
  tag: z.string().trim().max(40).nullable(),
  channels: z.array(channelKind).max(4),
});

export async function previewBroadcastAction(slug: string, filter: z.input<typeof bcFilter>) {
  const { ws } = await requireWorkspace(slug);
  return data.previewBroadcast(ws.id, bcFilter.parse(filter));
}

export async function sendBroadcastAction(slug: string, input: { name: string; body: string; filter: z.input<typeof bcFilter> }) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (!rateLimit(`bc:${ws.id}`, 5, 60 * 60_000)) throw new DomainError("invalid", "Limite de 5 disparos por hora. Tente mais tarde.");
    const v = z
      .object({ name: z.string().trim().min(1, "Dê um nome ao disparo.").max(80), body: z.string().trim().min(1, "Escreva a mensagem.").max(2000), filter: bcFilter })
      .parse(input);
    const b = await data.sendBroadcast(ws.id, user.id, v);
    return { sent: b.sent, failed: b.failed, total: b.total };
  });
}
