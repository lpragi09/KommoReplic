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
import { cleanAttribution } from "@/lib/utm";
import { MAX_ATTACHMENT, kindOf } from "@/lib/attachments";
import { emailOn, inviteEmail, sendEmail } from "@/lib/email";
import { checkTemplate } from "@/lib/template-rules";
import { AI_PACKS, PLAN_PRICES, aiMonth, limitsOf, planCharge, upgradeFor, type AiPackKey, type Limits, type PriceKey } from "@/lib/plans";
import { createPayment, getPayment, decodeRef, mpOn, type MpPayment, type Payer, type Purchase } from "@/lib/mercadopago";
import { applyPayment } from "@/lib/billing-apply";
import { randomUUID } from "node:crypto";
import { MetaError, verifyAccount } from "@/lib/meta";
import { META_PICK_COOKIE, igAccounts, igSubscribe, listPages, readPick, subscribePage } from "@/lib/meta-login";
import { aiAvailable, aiErrorText, askAgent, checkApiKey } from "@/lib/ai-agent";
import { OUT_OF_CREDITS, agentAllowed } from "@/data/ai/runner";
import { after } from "next/server";

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

/** limites do plano da empresa; estoura com a mensagem de upgrade quando passar */
async function planLimits(wsId: string) {
  const a = await data.getAccess(wsId);
  const l = limitsOf(a.plan);
  const over = (what: string, max: number, check: (x: Limits) => boolean) =>
    new DomainError("invalid", `Seu plano ${l.name} permite até ${max} ${what}. Para mais, passe para o ${upgradeFor(check)} em Configurações → Plano e cobrança.`);
  return { l, over };
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
  redirect(wss[0] ? `/${wss[0].slug}/home` : "/onboarding"); // quem entra cai no Início
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
  if (!(await rateLimit(`login:${await clientIp()}:${parsed.data.email.toLowerCase()}`, 5, 60_000)))
    return { error: "Muitas tentativas. Espere um minuto e tente de novo.", values };
  try {
    await setSession(await data.signIn(parsed.data.email, parsed.data.password));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, values };
    throw e;
  }
  const next = String(form.get("next") ?? "");
  if (INVITE_PATH.test(next)) redirect(next); // veio de um convite: volta para aceitar
  await afterLogin();
  return {};
}

/** "Esqueci minha senha": manda o link. A resposta é sempre a mesma, exista a conta ou não. */
export async function requestResetAction(_: FormState, form: FormData): Promise<FormState & { sent?: boolean; devLink?: string }> {
  const email = String(form.get("email") ?? "").trim();
  const values = { email };
  if (!z.string().email().safeParse(email).success) return { error: "Digite um email válido.", values };
  if (!(await rateLimit(`reset:${await clientIp()}`, 5, 10 * 60_000))) return { error: "Muitos pedidos. Espere alguns minutos.", values };
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const devLink = await data.requestPasswordReset(email, `${origin}/auth/callback?next=/nova-senha`);
  return { sent: true, values, devLink: devLink ?? undefined };
}

/** grava a senha nova e já entra */
export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa de pelo menos 8 caracteres." };
  if (password.length > 72) return { error: "Senha longa demais." };
  if (password !== String(form.get("again") ?? "")) return { error: "As duas senhas não são iguais." };
  if (!(await rateLimit(`reset-set:${await clientIp()}`, 10, 10 * 60_000))) return { error: "Muitas tentativas. Espere alguns minutos." };
  try {
    const session = await data.resetPassword(String(form.get("token") ?? "") || null, password);
    if (session) await setSession(session);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  await afterLogin();
  return {};
}

/** único "next" aceito no login: a página de um convite (nada de redirecionar para fora) */
const INVITE_PATH = /^\/convite\/[A-Za-z0-9_-]{20,60}$/;

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
  if (!(await rateLimit(`signup:${await clientIp()}`, 5, 10 * 60_000))) return { error: "Muitos cadastros deste endereço. Tente mais tarde.", values };
  try {
    const { company, docType, document, phone } = parsed.data;
    await setSession(await data.signUp(parsed.data.name, parsed.data.email, parsed.data.password, { company, docType, document, phone }));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, values };
    throw e;
  }
  redirect("/onboarding");
}

/** "Continuar com Google": manda para o Google; a volta cai em /auth/callback */
export async function googleSignInAction(): Promise<FormState> {
  const origin = (await headers()).get("origin") ?? process.env.APP_URL ?? "";
  let url: string;
  try {
    url = await data.oauthUrl("google", `${origin}/auth/callback`);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  redirect(url);
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
    .refine((s) => !["login", "signup", "onboarding", "chat", "design", "api", "_next", "termos", "privacidade", "app", "sair", "convite", "descadastrar", "admin", "esqueci", "nova-senha", "auth"].includes(s), "Esse endereço é reservado."),
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
  await data.syncLeadAttribution(wsId, leadId); // origem (UTM) da conversa passa para o lead antes dos robôs lerem
  await data.fireRobots(wsId, { trigger: "lead_created", leadId });
  await data.fireRobots(wsId, { trigger: "stage_enter", leadId, stageId, via: "created" });
}

export async function moveLeadAction(slug: string, leadId: string, stageId: string, lossReasonId?: string | null) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.moveLead(ws.id, user.id, id.parse(leadId), id.parse(stageId), lossReasonId ? id.parse(lossReasonId) : null);
    // o quadro só chama ao mudar de etapa; "uma vez por lead" evita repetir se voltar e ir de novo
    await data.fireRobots(ws.id, { trigger: "stage_enter", leadId, stageId, via: "moved" });
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
    const old = rest.responsibleUserId !== undefined || rest.tags !== undefined || price !== undefined ? (await data.getLead(ws.id, id.parse(leadId))).lead : null;
    const cents = price !== undefined ? parseBRL(price) : undefined;
    await data.updateLead(ws.id, user.id, id.parse(leadId), { ...rest, ...(cents !== undefined ? { priceCents: cents } : {}) });
    // gatilhos: responsável mudou, etiqueta nova, valor da venda mudou
    if (old && rest.responsibleUserId !== undefined && rest.responsibleUserId !== old.responsibleUserId) await data.fireRobots(ws.id, { trigger: "responsible_changed", leadId });
    for (const tag of old && rest.tags ? rest.tags.filter((t) => !old.tags.includes(t)) : []) await data.fireRobots(ws.id, { trigger: "tag_added", leadId, tag });
    if (old && cents !== undefined && cents !== old.priceCents) await data.fireRobots(ws.id, { trigger: "field_changed", leadId, field: "price" });
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
    await data.syncLeadAttribution(ws.id, id.parse(leadId));
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
    await data.deliverQueued(ws.id).catch(() => 0); // WhatsApp/Instagram/Messenger: sai pela Meta na hora
    return null;
  });
}

/** anexo (foto, áudio, vídeo, documento) com legenda opcional; o arquivo vem no FormData */
export async function sendAttachmentAction(slug: string, conversationId: string, form: FormData) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new DomainError("invalid", "Escolha um arquivo.");
    if (file.size > MAX_ATTACHMENT) throw new DomainError("invalid", "Arquivo grande demais: o limite é 4 MB.");
    const mime = file.type || "application/octet-stream";
    if (!kindOf(mime)) throw new DomainError("invalid", "Esse tipo de arquivo não é aceito. Use foto, áudio, vídeo, PDF ou documento do Office.");
    const caption = z.string().max(1000).parse(String(form.get("caption") ?? ""));
    const clientId = id.parse(String(form.get("clientId") ?? ""));
    await data.sendAttachment(ws.id, user.id, id.parse(conversationId), { name: file.name || "arquivo", mime, bytes: new Uint8Array(await file.arrayBuffer()) }, caption, clientId);
    await data.deliverQueued(ws.id).catch(() => 0);
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

export async function createContactAction(slug: string, input: { name: string; phone?: string; email?: string; companyName?: string }) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const v = z
      .object({
        name: z.string().trim().min(1, "Digite o nome.").max(120),
        phone: z.string().max(30).optional(),
        email: z.string().max(200).optional(),
        companyName: z.string().trim().max(160, "Nome da empresa com no máximo 160 caracteres.").optional(),
      })
      .parse(input);
    const c = await data.createContact(ws.id, user.id, v);
    return { id: c.id };
  });
}

/** telefone brasileiro no formato que os canais usam (+55DDDNÚMERO); outro formato fica como veio */
function normalPhone(raw: string) {
  const d = digits(raw);
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `+${d}`;
  return raw.trim().startsWith("+") && d.length >= 8 ? `+${d}` : d;
}

const importRows = z
  .array(
    z.object({
      name: z.string().trim().max(120),
      phone: z.string().max(40).optional(),
      email: z.string().max(200).optional(),
      companyName: z.string().trim().max(160).optional(),
    }),
  )
  .min(1, "A planilha não tem nenhuma linha com contato.")
  .max(1000, "Até 1.000 contatos por vez. Divida a planilha e importe em partes.");

/** Importa contatos de uma planilha (já lida no navegador). Pula quem já existe pelo telefone ou email. */
export async function importContactsAction(slug: string, rows: z.input<typeof importRows>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (!(await rateLimit(`import:${ws.id}`, 5, 10 * 60_000))) throw new DomainError("invalid", "Muitas importações seguidas. Espere alguns minutos.");
    const list = importRows.parse(rows);
    const seen = new Set<string>();
    for (const c of await data.listContacts(ws.id, "", true))
      for (const i of c.identities) seen.add(i.kind === "email" ? `e:${i.value.toLowerCase()}` : `p:${digits(i.value)}`);
    let created = 0;
    let skipped = 0;
    for (const r of list) {
      const phone = r.phone ? normalPhone(r.phone) : "";
      const email = r.email?.trim().toLowerCase() ?? "";
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
      const keys = [phone && `p:${digits(phone)}`, validEmail && `e:${validEmail}`].filter(Boolean) as string[];
      const name = r.name || validEmail || phone;
      if (!name || keys.some((k) => seen.has(k))) {
        skipped++;
        continue;
      }
      keys.forEach((k) => seen.add(k));
      await data.createContact(ws.id, user.id, { name, phone: phone || undefined, email: validEmail || undefined, companyName: r.companyName || undefined });
      created++;
    }
    return { created, skipped };
  });
}

/** "marcar tudo como lido" nas notificações: o que já existe agora fica apagado e sai da contagem */
export async function markNotificationsSeenAction(slug: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.markNotificationsSeen(ws.id, user.id);
    refresh();
    return null;
  });
}

export async function createCompanyAction(slug: string, name: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const c = await data.createCompany(ws.id, user.id, { name: z.string().trim().min(1, "Digite o nome da empresa.").max(160).parse(name) });
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
  attribution: z.record(z.string(), z.string().max(400)).optional(),
});

export async function visitorSendAction(input: z.input<typeof visitorMsg>) {
  return run(async () => {
    const v = visitorMsg.parse(input);
    const ip = await clientIp();
    if (!(await rateLimit(`chat-ip:${ip}`, 30, 60_000)) || !(await rateLimit(`chat-v:${v.visitorId}`, 12, 60_000)))
      throw new DomainError("invalid", "Muitas mensagens seguidas. Espere um pouco.");
    const { channelId, workspaceId: ws } = await data.getWebchat(v.publicKey);
    const got = await data.receiveInbound(channelId, v.visitorId, v.name, v.body, v.messageId);
    if (got) await data.attributeInbound(got.conversationId, v.body, cleanAttribution(v.attribution, v.attribution?.via === "site" ? "site" : "webchat"));
    if (got && (await data.getAccess(ws).catch(() => null))?.state !== "locked") {
      // primeiro a mensagem (pode ser a resposta de um robô que esperava), depois "primeiro contato"
      await data.fireRobots(ws, { trigger: "message_in", conversationId: got.conversationId, text: v.body });
      if (got.isNew) await data.fireRobots(ws, { trigger: "new_contact", conversationId: got.conversationId, text: v.body });
      after(() => data.answerWithAgent(got.conversationId)); // agente de IA, se ligado (depois dos robôs, sem segurar o visitante)
    }
    return null;
  });
}

/** visitante do chat do site manda um arquivo (foto, áudio, PDF...): entra como mensagem recebida com o anexo */
export async function visitorUploadAction(form: FormData) {
  return run(async () => {
    const v = visitorMsg.pick({ publicKey: true, visitorId: true, name: true, messageId: true }).parse({
      publicKey: String(form.get("publicKey") ?? ""),
      visitorId: String(form.get("visitorId") ?? ""),
      name: String(form.get("name") ?? ""),
      messageId: String(form.get("messageId") ?? ""),
    });
    const ip = await clientIp();
    if (!(await rateLimit(`chat-file-ip:${ip}`, 6, 60_000)) || !(await rateLimit(`chat-file-v:${v.visitorId}`, 4, 60_000)))
      throw new DomainError("invalid", "Muitos arquivos seguidos. Espere um pouco.");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new DomainError("invalid", "Escolha um arquivo.");
    if (file.size > MAX_ATTACHMENT) throw new DomainError("invalid", "Arquivo grande demais: o limite é 4 MB.");
    const mime = file.type || "application/octet-stream";
    const kind = kindOf(mime);
    if (!kind) throw new DomainError("invalid", "Esse tipo de arquivo não é aceito. Mande foto, áudio, vídeo ou PDF.");
    const caption = z.string().trim().max(1000).parse(String(form.get("caption") ?? ""));
    const body = caption || { image: "[foto]", audio: "[áudio]", video: "[vídeo]", file: "[arquivo]" }[kind];
    const { channelId, workspaceId: ws } = await data.getWebchat(v.publicKey);
    const got = await data.receiveInbound(channelId, v.visitorId, v.name, body, v.messageId);
    if (!got) return null; // repetido (duplo clique)
    await data.attachInbound(got.messageId, { name: file.name || "arquivo", mime, bytes: new Uint8Array(await file.arrayBuffer()) });
    if ((await data.getAccess(ws).catch(() => null))?.state !== "locked") {
      await data.fireRobots(ws, { trigger: "message_in", conversationId: got.conversationId, text: body });
      if (got.isNew) await data.fireRobots(ws, { trigger: "new_contact", conversationId: got.conversationId, text: body });
    }
    return null;
  });
}

export async function visitorThreadAction(publicKey: string, visitorId: string) {
  const v = visitorMsg.pick({ publicKey: true, visitorId: true }).parse({ publicKey, visitorId });
  const msgs = await data.visitorThread(v.publicKey, v.visitorId);
  // o visitante só vê texto, direção e hora — nada de ids internos ou de quem respondeu
  return msgs.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    sentAt: m.sentAt,
    kind: m.kind ?? "text",
    file: m.file ? { name: m.file.name, mime: m.file.mime, size: m.file.size, url: m.file.url } : null,
  }));
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

const PLAN = z.enum(Object.keys(PLAN_PRICES) as [PriceKey, ...PriceKey[]]);
const PERIOD = z.enum(["mensal", "anual"]);

async function requireAdmin(slug: string) {
  const ctx = await requireWorkspace(slug);
  const me = (await data.listMembers(ctx.ws.id)).members.find((m) => m.userId === ctx.user.id);
  if (!me?.isAdmin) throw new DomainError("forbidden", "Só administradores mexem nisso.");
  return ctx;
}

// ---------------------------------------------------------------------------
// checkout no próprio site: dados de cobrança → Pix, boleto ou cartão (Mercado Pago)
// ---------------------------------------------------------------------------
const billingInput = z
  .object({
    person: z.enum(["pf", "pj"]),
    doc: z.string().transform(digits),
    name: z.string().trim().min(2, "Escreva o nome completo ou a razão social.").max(120),
    email: z.string().trim().toLowerCase().email("Email inválido.").max(200),
    phone: z.string().transform(digits).pipe(z.string().max(13)),
    address: z.object({
      zip: z.string().transform(digits).pipe(z.string().length(8, "CEP com 8 números.")),
      street: z.string().trim().min(2, "Escreva a rua.").max(120),
      number: z.string().trim().min(1, "Escreva o número (ou S/N).").max(10),
      complement: z.string().trim().max(60),
      district: z.string().trim().min(2, "Escreva o bairro.").max(80),
      city: z.string().trim().min(2, "Escreva a cidade.").max(80),
      state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF com 2 letras."),
    }),
  })
  .refine((v) => validDoc(v.person === "pf" ? "cpf" : "cnpj", v.doc), { message: "CPF ou CNPJ inválido.", path: ["doc"] });

export async function saveBillingProfileAction(slug: string, input: z.input<typeof billingInput>) {
  return run(async () => {
    const { ws } = await requireAdmin(slug);
    await data.saveBillingProfile(ws.id, billingInput.parse(input));
    return null;
  });
}

const PACK = z.enum(AI_PACKS.map((p) => p.key) as [AiPackKey, ...AiPackKey[]]);
const purchaseInput = z.discriminatedUnion("kind", [z.object({ kind: z.literal("plan"), plan: PLAN, period: PERIOD }), z.object({ kind: z.literal("credits"), pack: PACK })]);
const methodInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pix") }),
  z.object({ kind: z.literal("boleto") }),
  z.object({
    kind: z.literal("card"),
    token: z.string().min(8).max(200),
    paymentMethodId: z.string().regex(/^[a-z_]{2,30}$/),
    issuerId: z.string().max(20).optional(),
    installments: z.number().int().min(1).max(12),
  }),
]);

/** o que está sendo comprado, com preço e usuários calculados aqui no servidor */
async function purchaseQuote(wsId: string, input: z.input<typeof purchaseInput>) {
  const v = purchaseInput.parse(input);
  if (v.kind === "credits") {
    const p = AI_PACKS.find((x) => x.key === v.pack)!;
    return { purchase: { kind: "credits", ws: wsId, pack: p.key } as Purchase, title: `netzer · ${p.credits} respostas da IA`, cents: p.cents, maxInstallments: 1 };
  }
  const seats = Math.max(1, (await data.listMembers(wsId)).members.length);
  const { cents } = planCharge(v.plan, v.period, seats);
  return {
    purchase: { kind: "plan", ws: wsId, key: v.plan, period: v.period, seats } as Purchase,
    title: `netzer ${PLAN_PRICES[v.plan].name} · ${v.period === "anual" ? "1 ano" : "1 mês"} · ${seats} ${seats === 1 ? "usuário" : "usuários"}`,
    cents,
    maxInstallments: v.period === "anual" ? 12 : 1,
  };
}

const REJECTED: Record<string, string> = {
  cc_rejected_insufficient_amount: "Cartão sem limite para este valor.",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) errado.",
  cc_rejected_bad_filled_date: "Data de validade errada.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_call_for_authorize: "O banco pediu para você autorizar a compra. Ligue para o banco e tente de novo.",
  cc_rejected_card_disabled: "Cartão bloqueado. Ligue para o banco para liberar.",
  cc_rejected_duplicated_payment: "Você já fez um pagamento igual agora há pouco.",
  cc_rejected_high_risk: "O pagamento foi recusado pela análise de segurança. Tente Pix ou outro cartão.",
  cc_rejected_max_attempts: "Muitas tentativas com este cartão. Use outro cartão ou Pix.",
};

/** o que a tela precisa saber do pagamento: situação e, no Pix e no boleto, como pagar */
function paymentView(p: MpPayment) {
  const td = p.point_of_interaction?.transaction_data;
  return {
    id: String(p.id),
    status: p.status as "approved" | "pending" | "in_process" | "rejected" | "cancelled" | string,
    message: p.status === "rejected" ? (REJECTED[p.status_detail ?? ""] ?? "Pagamento recusado. Confira os dados ou use outra forma de pagamento.") : null,
    pix: td?.qr_code ? { code: td.qr_code, image: td.qr_code_base64 ?? null } : null,
    boleto: p.transaction_details?.external_resource_url ? { url: p.transaction_details.external_resource_url, barcode: p.barcode?.content ?? null } : null,
    expiresAt: p.date_of_expiration ?? null,
  };
}

export async function payAction(slug: string, purchase: z.input<typeof purchaseInput>, method: z.input<typeof methodInput>) {
  return run(async () => {
    const { ws } = await requireAdmin(slug);
    if (!mpOn()) throw new DomainError("invalid", "Cobrança ainda não configurada.");
    if (!(await rateLimit(`pay:${ws.id}`, 10, 10 * 60_000))) throw new DomainError("invalid", "Muitas tentativas de pagamento. Espere alguns minutos.");
    const q = await purchaseQuote(ws.id, purchase);
    const m = methodInput.parse(method);
    if (m.kind === "card" && m.installments > q.maxInstallments) throw new DomainError("invalid", q.maxInstallments === 1 ? "Este pagamento é à vista." : `Até ${q.maxInstallments}x.`);
    const b = await data.getBillingProfile(ws.id);
    if (!b) throw new DomainError("invalid", "Preencha os dados de cobrança primeiro.");
    const [first, ...rest] = b.name.split(/\s+/);
    const payer: Payer = {
      email: b.email,
      first_name: first,
      last_name: rest.join(" ") || first,
      identification: { type: b.person === "pf" ? "CPF" : "CNPJ", number: b.doc },
      address: { zip_code: b.address.zip, street_name: b.address.street, street_number: b.address.number, neighborhood: b.address.district, city: b.address.city, federal_unit: b.address.state },
    };
    let pay: MpPayment;
    try {
      pay = await createPayment({ purchase: q.purchase, title: q.title, cents: q.cents, payer, method: m, idempotencyKey: randomUUID() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[mercadopago] pagamento", msg);
      // quem paga é admin da empresa: dizer o motivo ajuda a resolver sem abrir os logs
      if (/live credentials/i.test(msg)) throw new DomainError("invalid", "Credenciais de teste do Mercado Pago só aceitam comprador de teste. Use as credenciais de produção para cobrar de verdade.");
      if (/respondeu 401/.test(msg)) throw new DomainError("invalid", "A chave do Mercado Pago (MP_ACCESS_TOKEN) foi recusada. Confira se é o Access Token de produção atual.");
      if (/payer|identification|email/i.test(msg)) throw new DomainError("invalid", "O Mercado Pago recusou os dados do pagador. Confira CPF/CNPJ e email em Alterar dados.");
      throw new DomainError("invalid", "O Mercado Pago não aceitou o pagamento agora. Confira os dados e tente de novo.");
    }
    const view = paymentView(pay);
    await data.saveCheckoutPayment(ws.id, { id: view.id, title: q.title, cents: q.cents, method: m.kind, status: view.status, pix: view.pix, boleto: view.boleto, expiresAt: view.expiresAt, createdAt: new Date().toISOString() });
    if (await applyPayment(pay).catch(() => false)) refresh();
    return view;
  });
}

/** a tela do Pix pergunta de tempos em tempos se já caiu; quando cai, libera na hora (sem esperar o webhook) */
export async function paymentStatusAction(slug: string, paymentId: string) {
  return run(async () => {
    const { ws } = await requireWorkspace(slug);
    if (!/^\d{1,30}$/.test(paymentId)) throw new DomainError("not_found");
    const pay = await getPayment(paymentId);
    if (decodeRef(pay.external_reference)?.ws !== ws.id) throw new DomainError("not_found");
    await data.setCheckoutPaymentStatus(String(pay.id), pay.status);
    if (await applyPayment(pay).catch(() => false)) refresh();
    return paymentView(pay);
  });
}

/** chave própria da Anthropic: a empresa paga a IA direto, sem gastar crédito. null tira. */
export async function saveAiKeyAction(slug: string, key: string | null) {
  return run(async () => {
    const { user, ws } = await requireAdmin(slug);
    if (!(await rateLimit(`ai-key:${user.id}`, 10, 60_000))) throw new DomainError("invalid", "Muitas tentativas. Espere um minuto.");
    const k = key === null ? null : z.string().trim().regex(/^sk-ant-[A-Za-z0-9_-]{20,200}$/, "Essa não parece uma chave da Anthropic (começa com sk-ant-).").parse(key);
    if (k) {
      try {
        await checkApiKey(k);
      } catch (e) {
        throw new DomainError("invalid", aiErrorText(e));
      }
    }
    await data.setAiOwnKey(ws.id, k);
    return null;
  });
}

// ---------------------------------------------------------------------------
// robôs e modelos de mensagem
// ---------------------------------------------------------------------------
const channelKind = z.enum(["whatsapp", "instagram", "messenger", "webchat"]);
const stepId = z.string().min(1).max(40);
const nextRef = z.string().min(1).max(40).nullable().optional();
const pos = { x: z.number().finite().min(-20000).max(20000).optional(), y: z.number().finite().min(-20000).max(20000).optional(), next: nextRef };
const base = { id: stepId, ...pos };
const branch = z.object({ id: stepId, label: z.string().trim().max(60), next: nextRef.transform((v) => v ?? null) });
const robotStep = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("message"),
    text: z.string().trim().min(1, "Escreva a mensagem do robô.").max(2000, "Mensagem longa demais."),
    buttons: z.array(branch.refine((b) => b.label.length > 0, "Dê um texto para cada botão.")).max(10, "No máximo 10 botões.").optional(),
    elseNext: nextRef,
  }),
  z.object({ ...base, type: z.literal("wait"), minutes: z.number().int().min(1, "Espera mínima de 1 minuto.").max(43200, "Espera máxima de 30 dias.") }),
  z.object({ ...base, type: z.literal("wait_reply"), minutes: z.number().int().min(1).max(43200, "Espera máxima de 30 dias."), timeoutNext: nextRef }),
  z.object({
    ...base,
    type: z.literal("condition"),
    source: z.enum(["message", "utm_source", "utm_campaign", "tag", "channel"]),
    rules: z.array(branch.extend({ op: z.enum(["contains", "equals", "not_contains"]) }).refine((b) => b.label.length > 0, "Preencha o valor de cada regra.")).min(1, "A condição precisa de pelo menos uma regra.").max(10),
    elseNext: nextRef,
  }),
  z.object({
    ...base,
    type: z.literal("validate"),
    kind: z.enum(["any", "email", "phone", "number", "cpf"]),
    question: z.string().trim().min(1, "Escreva a pergunta.").max(1000),
    retryText: z.string().trim().max(1000),
    tries: z.number().int().min(1).max(5),
    failNext: nextRef,
    saveFieldId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
  }),
  z.object({ ...base, type: z.literal("round_robin"), userIds: z.array(z.string().uuid()).min(1, "Escolha pelo menos uma pessoa para o rodízio.").max(50) }),
  z.object({ ...base, type: z.literal("internal"), text: z.string().trim().min(1, "Escreva o aviso para a equipe.").max(1000) }),
  z.object({ ...base, type: z.literal("task"), text: z.string().trim().min(1, "Escreva o texto da tarefa.").max(500), dueMinutes: z.number().int().min(0).max(43200) }),
  z.object({ ...base, type: z.literal("tag"), tag: z.string().trim().min(1, "Escreva a etiqueta.").max(40), remove: z.boolean().optional() }),
  z.object({ ...base, type: z.literal("responsible"), userId: z.string().uuid("Escolha quem vai ser o responsável.") }),
  z.object({ ...base, type: z.literal("stage"), stageId: z.string().uuid("Escolha a etapa de destino.") }),
  z.object({ ...base, type: z.literal("note"), text: z.string().trim().min(1, "Escreva a nota.").max(2000) }),
  z.object({ ...base, type: z.literal("set_field"), fieldId: z.union([z.literal("price"), z.string().uuid("Escolha o campo.")]), value: z.string().trim().max(500) }),
  z.object({ ...base, type: z.literal("close") }),
  z.object({ ...base, type: z.literal("webhook"), url: z.string().trim().regex(/^https:\/\/[^\s/]+\.[^\s]+$/, "O webhook precisa de um endereço https:// válido.").max(500) }),
  z.object({ ...base, type: z.literal("start_robot"), robotId: z.string().uuid("Escolha o robô.") }),
  z.object({ ...base, type: z.literal("ai"), on: z.boolean() }),
  z.object({ ...base, type: z.literal("complete_tasks") }),
  z.object({ ...base, type: z.literal("create_lead"), stageId: z.string().uuid("Escolha a etapa do lead novo."), name: z.string().trim().max(200) }),
  z.object({ ...base, type: z.literal("email"), subject: z.string().trim().min(1, "Escreva o assunto do email.").max(200), text: z.string().trim().min(1, "Escreva o texto do email.").max(5000) }),
  z.object({ ...base, type: z.literal("stop") }),
]);
const robotInput = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao robô.").max(80),
    active: z.boolean(),
    trigger: z.enum(["stage_enter", "lead_created", "message_in", "new_contact", "responsible_changed", "tag_added", "field_changed", "no_reply", "schedule_daily"]),
    pipelineId: id.nullable(),
    stageId: id.nullable(),
    channels: z.array(channelKind).max(4),
    keywords: z.array(z.string().trim().min(1).max(40)).max(20),
    once: z.boolean(),
    steps: z.array(robotStep).min(1, "Adicione pelo menos um passo.").max(60, "No máximo 60 passos."),
    start: z.object({ x: z.number().finite(), y: z.number().finite(), next: nextRef }).optional(),
    conditions: z
      .object({
        utmField: z.enum(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]).optional(),
        utmContains: z.string().trim().max(80).optional(),
        when: z.enum(["created", "moved", "both"]).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
        ownerId: z.string().uuid().optional(),
        hours: z
          .object({ from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/), days: z.array(z.number().int().min(0).max(6)).max(7) })
          .refine((h) => h.from !== h.to, "O horário de início e de fim não podem ser iguais.")
          .optional(),
        origin: z.literal("stage_trigger").optional(),
        action: z.enum(["robot", "message", "email", "task", "tag", "stage", "responsible", "webhook", "note", "ai_on", "ai_off", "complete_tasks", "field", "create_lead"]).optional(),
        detached: z.boolean().optional(),
        tagTrigger: z.string().trim().max(40).optional(),
        fieldTrigger: z.string().trim().max(60).optional(),
        stayInStage: z.boolean().optional(),
        dailyAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.").optional(),
        dailyDone: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .optional(),
  })
  .refine((r) => r.trigger !== "stage_enter" || !!r.stageId, "Escolha a etapa que dispara o robô.")
  .refine((r) => r.trigger !== "schedule_daily" || !!r.stageId, "O gatilho diário precisa de uma etapa.");

export async function saveRobotAction(slug: string, robotId: string | null, input: z.input<typeof robotInput>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const v = robotInput.parse(input);
    if (v.active) {
      const { l, over } = await planLimits(ws.id);
      const on = (await data.listRobots(ws.id)).filter((x) => x.active && x.id !== robotId).length;
      if (on + 1 > l.activeRobots) throw over("robôs ligados", l.activeRobots, (x) => x.activeRobots > on);
    }
    const r = await data.saveRobot(ws.id, user.id, robotId ? id.parse(robotId) : null, v);
    return { id: r.id };
  });
}

/** "Aplicar também aos leads que já estão nesta etapa": roda só este gatilho para cada lead da etapa (até 300) */
export async function applyStageTriggerAction(slug: string, robotId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    const r = (await data.listRobots(ws.id)).find((x) => x.id === id.parse(robotId));
    if (!r || !r.stageId) throw new DomainError("invalid", "Gatilho não encontrado.");
    if (!r.active) throw new DomainError("invalid", "Ligue o gatilho antes de aplicar aos leads da etapa.");
    const leads = (await data.listLeads(ws.id, { stageId: r.stageId })).slice(0, 300);
    for (const l of leads)
      await data.fireRobots(
        ws.id,
        r.trigger === "responsible_changed"
          ? { trigger: "responsible_changed", leadId: l.id, robotId: r.id }
          : r.trigger === "schedule_daily"
            ? { trigger: "schedule_daily", leadId: l.id, robotId: r.id }
            : { trigger: "stage_enter", leadId: l.id, stageId: r.stageId, robotId: r.id },
      );
    return { count: leads.length };
  });
}

export async function setRobotActiveAction(slug: string, robotId: string, active: boolean) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    if (active) {
      const { l, over } = await planLimits(ws.id);
      const on = (await data.listRobots(ws.id)).filter((x) => x.active && x.id !== robotId).length;
      if (on + 1 > l.activeRobots) throw over("robôs ligados", l.activeRobots, (x) => x.activeRobots > on);
    }
    await data.setRobotActive(ws.id, id.parse(robotId), z.boolean().parse(active));
    return null;
  });
}

/** tira o robô do funil (ou põe de volta) sem apagar: ele some da coluna e para de disparar sozinho */
export async function detachRobotAction(slug: string, robotId: string, detached: boolean) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const { robot: r } = await data.getRobot(ws.id, id.parse(robotId));
    const { id: _i, workspaceId: _w, runCount: _c, lastRunAt: _l, createdAt: _a, ...input } = r;
    const conditions = { ...(r.conditions ?? {}), detached: z.boolean().parse(detached) || undefined };
    await data.saveRobot(ws.id, user.id, r.id, { ...input, conditions });
    refresh();
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
  body: z.string().trim().min(1, "Escreva o texto do modelo.").max(6000, "Texto longo demais."),
  network: z.enum(["whatsapp", "instagram", "messenger", "tiktok", "webchat"]).default("webchat"),
  category: z.enum(["marketing", "utility", "authentication"]).nullable().default(null),
  header: z.string().trim().max(60).nullable().default(null).transform((v) => v || null),
  footer: z.string().trim().max(60).nullable().default(null).transform((v) => v || null),
  buttons: z
    .array(z.object({ kind: z.enum(["reply", "url"]), text: z.string().trim().max(40), url: z.string().trim().max(500).optional() }))
    .max(13)
    .default([]),
}).superRefine((t, ctx) => {
  // as mesmas regras da tela, conferidas no servidor
  const problems = checkTemplate(t.network, { body: t.body, header: t.header ?? undefined, footer: t.footer ?? undefined, buttons: t.buttons, category: t.category });
  if (problems.length) ctx.addIssue({ code: "custom", message: problems[0] });
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

const newInvite = z.object({ email: z.string().trim().email("Digite um email válido.").max(200), roleId: id });
const inviteToken = z.string().regex(/^[A-Za-z0-9_-]{20,60}$/, "Convite inválido.");

/** convite por link: devolve o endereço para o admin mandar (WhatsApp, email...) */
export async function createInviteAction(slug: string, input: z.input<typeof newInvite>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const { l, over } = await planLimits(ws.id);
    const n = (await data.listMembers(ws.id)).members.length + (await data.listInvites(ws.id)).length;
    if (n + 1 > l.users) throw over("pessoas na equipe (contando convites abertos)", l.users, (x) => x.users > n);
    const v = newInvite.parse(input);
    const { token } = await data.createInvite(ws.id, user.id, v);
    const origin = process.env.APP_URL || ((await headers()).get("origin") ?? "");
    const url = `${origin}/convite/${token}`;
    // com o Resend configurado o convite também chega por email; sem ele, o admin manda o link
    const role = (await data.listMembers(ws.id)).roles.find((r) => r.id === v.roleId)?.name ?? "integrante";
    const emailed = await sendEmail({ to: v.email.trim().toLowerCase(), ...inviteEmail({ workspace: ws.name, inviter: user.name || user.email, role, url }) });
    return { url, emailed };
  });
}

export async function revokeInviteAction(slug: string, inviteId: string) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.revokeInvite(ws.id, user.id, id.parse(inviteId));
    return null;
  });
}

/** quem já tem conta e está logado aceita o convite */
export async function acceptInviteAction(token: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/convite/${inviteToken.parse(token)}`);
  let slug: string;
  try {
    slug = (await data.acceptInvite(inviteToken.parse(token), user.id)).slug;
  } catch (e) {
    if (e instanceof DomainError || e instanceof z.ZodError) return { error: e instanceof DomainError ? e.message : "Convite inválido." };
    throw e;
  }
  redirect(`/${slug}/home`);
}

const newAccount = z.object({
  name: z.string().trim().min(2, "Digite seu nome.").max(120),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(72),
});

/** quem não tem conta cria a senha no convite e já entra */
export async function acceptInviteNewAccountAction(token: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { name: String(form.get("name") ?? "") };
  const parsed = newAccount.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  if (!(await rateLimit(`convite:${await clientIp()}`, 10, 10 * 60_000))) return { error: "Muitas tentativas. Tente mais tarde.", values };
  let slug: string;
  try {
    const out = await data.acceptInviteNewAccount(inviteToken.parse(token), parsed.data);
    slug = out.slug;
    await setSession(await data.signIn(out.email, parsed.data.password));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, values };
    if (e instanceof z.ZodError) return { error: "Convite inválido.", values };
    throw e;
  }
  redirect(`/${slug}/home`);
}

export async function addMemberAction(slug: string, input: z.input<typeof newMember>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const { l, over } = await planLimits(ws.id);
    const n = (await data.listMembers(ws.id)).members.length;
    if (n + 1 > l.users) throw over("pessoas na equipe", l.users, (x) => x.users > n);
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
    await data.fireRobots(ws.id, { trigger: "field_changed", leadId, field: fieldId });
    return null;
  });
}

// ---------------------------------------------------------------------------
// chat da equipe
// ---------------------------------------------------------------------------
/** arquivo (foto, áudio, vídeo, documento) no chat da equipe, com legenda opcional */
export async function sendTeamAttachmentAction(slug: string, form: FormData) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (!(await rateLimit(`team-file:${user.id}`, 10, 60_000))) throw new DomainError("invalid", "Muitos arquivos seguidos. Espere um pouco.");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new DomainError("invalid", "Escolha um arquivo.");
    if (file.size > MAX_ATTACHMENT) throw new DomainError("invalid", "Arquivo grande demais: o limite é 4 MB.");
    const mime = file.type || "application/octet-stream";
    if (!kindOf(mime)) throw new DomainError("invalid", "Esse tipo de arquivo não é aceito. Use foto, áudio, vídeo, PDF ou documento do Office.");
    const caption = z.string().max(1000).parse(String(form.get("caption") ?? ""));
    await data.sendTeamAttachment(ws.id, user.id, { name: file.name || "arquivo", mime, bytes: new Uint8Array(await file.arrayBuffer()) }, caption);
    return null;
  });
}

export async function sendTeamMessageAction(slug: string, body: string) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (!(await rateLimit(`team:${user.id}`, 30, 60_000))) throw new DomainError("invalid", "Muitas mensagens seguidas. Espere um pouco.");
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

export async function sendBroadcastAction(slug: string, input: { name: string; body: string; filter: z.input<typeof bcFilter>; medium?: "message" | "email"; subject?: string }) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (!(await planLimits(ws.id)).l.broadcasts) throw new DomainError("invalid", `Disparos fazem parte do plano ${upgradeFor((x) => x.broadcasts)} em diante. Mude em Configurações → Plano e cobrança.`);
    if (!(await rateLimit(`bc:${ws.id}`, 5, 60 * 60_000))) throw new DomainError("invalid", "Limite de 5 disparos por hora. Tente mais tarde.");
    const v = z
      .object({
        name: z.string().trim().min(1, "Dê um nome ao disparo.").max(80),
        medium: z.enum(["message", "email"]).default("message"),
        subject: z.string().trim().max(200).optional(),
        body: z.string().trim().min(1, "Escreva a mensagem.").max(5000),
        filter: bcFilter,
      })
      .refine((x) => x.medium !== "email" || !!x.subject, "Escreva o assunto do email.")
      .refine((x) => x.medium === "email" || x.body.length <= 2000, "Mensagem longa demais (máximo 2.000 caracteres).")
      .parse(input);
    if (v.medium === "email" && !emailOn()) throw new DomainError("invalid", "Para disparar email, configure o Resend na Vercel (RESEND_API_KEY e EMAIL_FROM).");
    const b = await data.sendBroadcast(ws.id, user.id, v);
    await data.deliverQueued(ws.id).catch(() => 0);
    return { sent: b.sent, failed: b.failed, total: b.total };
  });
}

// ---------------------------------------------------------------------------
// origem do lead (UTMs) e links rastreáveis
// ---------------------------------------------------------------------------
const attrInput = z.record(z.string(), z.string().max(400));

export async function setLeadAttributionAction(slug: string, leadId: string, input: z.input<typeof attrInput>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.setLeadAttribution(ws.id, user.id, id.parse(leadId), cleanAttribution(attrInput.parse(input), "manual"));
    return null;
  });
}

const linkInput = z.object({
  name: z.string().trim().min(1, "Dê um nome ao link (ex.: Anúncio Instagram outubro).").max(80),
  phone: z
    .string()
    .transform((v) => {
      const d = digits(v);
      return d.length === 10 || d.length === 11 ? `55${d}` : d; // número brasileiro sem o 55
    })
    .refine((v) => v.length >= 12 && v.length <= 15, "WhatsApp com DDD, ex.: (11) 98888-1234."),
  message: z.string().trim().max(500, "Mensagem longa demais."),
  defaults: attrInput,
});

export async function saveTrackingLinkAction(slug: string, linkId: string | null, input: z.input<typeof linkInput>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const v = linkInput.parse(input);
    if (!linkId) {
      const { l: lim, over } = await planLimits(ws.id);
      const n = (await data.listTrackingLinks(ws.id)).length;
      if (n + 1 > lim.trackingLinks) throw over("links rastreáveis", lim.trackingLinks, (x) => x.trackingLinks > n);
    }
    const l = await data.saveTrackingLink(ws.id, user.id, linkId ? id.parse(linkId) : null, { ...v, defaults: cleanAttribution(v.defaults) ?? {} });
    return { id: l.id, code: l.code };
  });
}

const codeInput = z.object({
  code: z
    .string()
    .trim()
    .min(3, "O código precisa de pelo menos 3 caracteres (ex.: G-01-34).")
    .max(30)
    .regex(/^[\p{L}\p{N}._#/-]+$/u, "Use só letras, números e - _ . / # (sem espaço)."),
  name: z.string().trim().min(1, "Dê um nome (ex.: Anúncio revisão).").max(80),
  defaults: z.record(z.string(), z.string().max(150)),
});

export async function saveMessageCodeAction(slug: string, codeId: string | null, input: z.input<typeof codeInput>) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    const v = codeInput.parse(input);
    await data.saveMessageCode(ws.id, codeId ? id.parse(codeId) : null, { ...v, defaults: cleanAttribution(v.defaults) ?? {} });
    refresh();
    return null;
  });
}

export async function deleteMessageCodeAction(slug: string, codeId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteMessageCode(ws.id, id.parse(codeId));
    refresh();
    return null;
  });
}

const sourceRule = z
  .object({
    pipelineId: z.string().uuid(),
    channelId: z.string().uuid().nullable(),
    match: z.enum(["keyword", "code", "link", "ad"]),
    value: z.string().trim().max(200),
  })
  .refine((v) => v.match === "ad" || v.value.length > 0, { message: "Preencha a condição da regra.", path: ["value"] });

/** regra de entrada: contato novo que bate com ela entra neste funil em vez do funil padrão do canal */
export async function saveSourceRuleAction(slug: string, input: z.input<typeof sourceRule>) {
  return run(async () => {
    await requireActive(slug);
    const { ws } = await requireAdmin(slug);
    const v = sourceRule.parse(input);
    await data.saveSourceRule(ws.id, { ...v, value: v.match === "ad" ? "" : v.value });
    refresh();
    return null;
  });
}

export async function deleteSourceRuleAction(slug: string, ruleId: string) {
  return run(async () => {
    const { ws } = await requireAdmin(slug);
    await data.deleteSourceRule(ws.id, id.parse(ruleId));
    refresh();
    return null;
  });
}

/** canal passa a mandar os contatos novos para este funil */
export async function setChannelPipelineAction(slug: string, channelId: string, pipelineId: string) {
  return run(async () => {
    await requireActive(slug);
    const { ws } = await requireAdmin(slug);
    await data.setChannelPipeline(ws.id, id.parse(channelId), id.parse(pipelineId));
    refresh();
    return null;
  });
}

export async function deleteTrackingLinkAction(slug: string, linkId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteTrackingLink(ws.id, id.parse(linkId));
    return null;
  });
}

// ---------------------------------------------------------------------------
// marcações do calendário
// ---------------------------------------------------------------------------
const markInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  label: z.string().trim().min(1, "Escreva a marcação (ex.: Promoção, Folga).").max(60),
  color: z.enum(["blue", "green", "amber", "red", "purple", "gray"]),
  note: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => v || null),
});

export async function saveMarkAction(slug: string, markId: string | null, input: z.input<typeof markInput>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    await data.saveMark(ws.id, user.id, markId ? id.parse(markId) : null, markInput.parse(input));
    return null;
  });
}

export async function deleteMarkAction(slug: string, markId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteMark(ws.id, id.parse(markId));
    return null;
  });
}

// ---------------------------------------------------------------------------
// canais da Meta (WhatsApp Cloud API, Instagram, Messenger)
// ---------------------------------------------------------------------------
const connectInput = z.object({
  kind: z.enum(["whatsapp", "instagram", "messenger"]),
  externalId: z.string().trim().regex(/^\d{5,25}$/, "O ID tem só números (copie do painel da Meta)."),
  pageId: z
    .string()
    .trim()
    .regex(/^\d{5,25}$/, "O ID da página tem só números.")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  token: z.string().trim().min(20, "Cole o token de acesso permanente.").max(1000),
  /** chave secreta do app da Meta, quando o app é da própria empresa (confere a assinatura dos avisos desse app) */
  appSecret: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/i, "A chave secreta do app tem 32 letras e números (Configurações do app → Básico).")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  pipelineId: id.nullable(),
});

export async function connectChannelAction(slug: string, input: z.input<typeof connectInput>) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    const v = connectInput.parse(input);
    await checkChannelLimit(ws.id, v.kind, v.externalId);
    let name: string;
    try {
      name = await verifyAccount(v.kind, v.externalId, v.token); // a Meta confirma que o ID e o token batem
    } catch (e) {
      throw new DomainError("invalid", e instanceof MetaError ? e.message : "Não deu para falar com a Meta agora. Tente de novo.");
    }
    const ch = await data.connectChannel(ws.id, user.id, { ...v, name });
    return { id: ch.id, name };
  });
}

/** limite de canais de rede social do plano. Reconectar é a mesma conta; outro número do mesmo tipo conta como canal novo */
async function checkChannelLimit(wsId: string, kind: string, externalId: string) {
  const { l, over } = await planLimits(wsId);
  const social = (await data.listChannels(wsId)).filter((c) => c.kind !== "webchat" && c.status === "connected");
  const isReconnect = social.some((c) => c.kind === kind && c.externalId === externalId);
  if (!isReconnect && social.length + 1 > l.socialChannels) throw over("canais de rede social", l.socialChannels, (x) => x.socialChannels > social.length);
}

/** "Conectar com Facebook": a pessoa escolheu a página na volta do login da Meta. O token vem do cookie cifrado,
    e a página é procurada de novo na Meta (a tela só manda o id). */
export async function connectMetaPageAction(slug: string, pageId: string, pipelineId: string | null) {
  return run(async () => {
    await requireActive(slug);
    const { user, ws } = await requireAdmin(slug);
    const pick = await readPick(slug, user.id);
    if (!pick) throw new DomainError("invalid", "O login da Meta expirou. Clique em “Conectar com Facebook” de novo.");
    const pid = pipelineId ? id.parse(pipelineId) : null;
    try {
      if (pick.kind === "ig") {
        // login com o Instagram: as contas são as liberadas no token
        const me = (await igAccounts(pick.token)).find((a) => a.id === pageId);
        if (!me) throw new DomainError("invalid", "Conta não encontrada. Entre de novo pelo Instagram e marque a conta.");
        await checkChannelLimit(ws.id, "instagram", me.id);
        await igSubscribe(me.id, pick.token);
        await data.connectChannel(ws.id, user.id, { kind: "instagram", externalId: me.id, token: pick.token, name: `@${me.username}`, pipelineId: pid });
        (await cookies()).delete(META_PICK_COOKIE);
        refresh();
        return null;
      }
      const page = (await listPages(pick.token)).find((p) => p.id === pageId);
      if (!page) throw new DomainError("invalid", "Página não encontrada. Ela foi liberada no login da Meta?");
      if (pick.kind === "instagram" && !page.ig) throw new DomainError("invalid", "Essa página não tem um Instagram profissional ligado. Ligue em Configurações da página → Contas vinculadas.");
      const externalId = pick.kind === "instagram" ? page.ig!.id : page.id;
      await checkChannelLimit(ws.id, pick.kind, externalId);
      await subscribePage(page.id, page.token);
      const name = pick.kind === "instagram" ? `@${page.ig!.username}` : page.name;
      await data.connectChannel(ws.id, user.id, { kind: pick.kind, externalId, pageId: pick.kind === "instagram" ? page.id : undefined, token: page.token, name, pipelineId: pid });
    } catch (e) {
      if (e instanceof MetaError) throw new DomainError("invalid", e.message);
      throw e;
    }
    (await cookies()).delete(META_PICK_COOKIE);
    refresh();
    return null;
  });
}

export async function disconnectChannelAction(slug: string, channelId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.disconnectChannel(ws.id, id.parse(channelId));
    return null;
  });
}

// ---------------------------------------------------------------------------
// agente de IA (Claude) que responde os clientes
// ---------------------------------------------------------------------------
const agentInput = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Dê um nome ao agente.").max(40),
  tone: z.enum(["amigavel", "formal", "direto"]),
  instructions: z.string().max(4000, "Instruções com no máximo 4.000 caracteres."),
  knowledge: z.string().max(30000, "A base de conhecimento passa de 30.000 caracteres. Resuma as partes longas."),
  channels: z.array(z.enum(["webchat", "whatsapp", "instagram", "messenger"])).max(4),
  handoffMessage: z.string().trim().min(1, "Escreva a mensagem de quando passa para a equipe.").max(300),
});

export async function saveAgentAction(slug: string, input: z.input<typeof agentInput>) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    const v = agentInput.parse(input);
    if (v.enabled) {
      const [access, wallet, own] = await Promise.all([data.getAccess(ws.id), data.getAiWallet(ws.id), data.getAiOwnKey(ws.id)]);
      if (!agentAllowed(access, wallet.extra, !!own))
        throw new DomainError("invalid", `O agente de IA está no plano ${upgradeFor((x) => x.aiAgent)}, ou compre créditos de IA em Configurações → Plano e cobrança → Complementos.`);
      if (!own && !aiAvailable()) throw new DomainError("invalid", "A IA ainda não está configurada no servidor. Use a sua chave da Anthropic abaixo ou salve desligado por enquanto.");
      if (!v.channels.length) throw new DomainError("invalid", "Marque pelo menos um canal para o agente atender.");
    }
    await data.saveAgent(ws.id, v);
    return null;
  });
}

const testTurn = z.object({ role: z.enum(["cliente", "empresa"]), text: z.string().max(2000) });

/** conversa de teste na tela do agente: usa a configuração ainda não salva */
export async function testAgentAction(slug: string, input: z.input<typeof agentInput>, turns: z.input<typeof testTurn>[]) {
  return run(async () => {
    const { user, ws } = await requireActive(slug);
    if (!(await rateLimit(`ai-test:${user.id}`, 20, 60_000))) throw new DomainError("invalid", "Muitos testes seguidos. Espere um minuto.");
    const own = await data.getAiOwnKey(ws.id);
    if (!own && !aiAvailable()) throw new DomainError("invalid", "A IA ainda não está configurada no servidor. Use a sua chave da Anthropic.");
    const v = agentInput.parse(input);
    const t = z.array(testTurn).min(1).max(30).parse(turns);
    // o teste também é uma resposta da IA: gasta crédito (com chave própria, a conta é da empresa)
    const included = limitsOf((await data.getAccess(ws.id)).plan).aiCredits;
    const month = aiMonth();
    if (!own && !(await data.spendAiCredit(ws.id, included, month))) throw new DomainError("invalid", `Sem créditos: ${OUT_OF_CREDITS}.`);
    try {
      const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
      return await askAgent({ ...v, updatedAt: null }, { company: ws.name, channel: "webchat", contactName: "Cliente de teste", today }, t, own);
    } catch (e) {
      if (!own) await data.refundAiCredit(ws.id, included, month);
      throw new DomainError("invalid", aiErrorText(e));
    }
  });
}

export async function setConversationAiAction(slug: string, conversationId: string, paused: boolean) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.setConversationAi(ws.id, id.parse(conversationId), paused);
    if (!paused) after(() => data.answerWithAgent(conversationId)); // devolveu para a IA: ela responde o que ficou pendente
    return null;
  });
}

// ---------------------------------------------------------------------------
// funis e etapas
// ---------------------------------------------------------------------------
const pipeName = z.string().trim().min(1, "Dê um nome ao funil.").max(80, "Nome com no máximo 80 caracteres.");
const stageName = z.string().trim().min(1, "Dê um nome à etapa.").max(60, "Nome com no máximo 60 caracteres.");
const stageColor = z.enum(["1", "2", "3", "4", "5", "6", "7", "8"]);

export async function createPipelineAction(slug: string, name: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    const n = pipeName.parse(name);
    const { l, over } = await planLimits(ws.id);
    const count = (await data.listPipelines(ws.id)).length;
    if (count + 1 > l.pipelines) throw over("funis", l.pipelines, (x) => x.pipelines > count);
    return { id: (await data.createPipeline(ws.id, n)).id };
  });
}

export async function renamePipelineAction(slug: string, pipelineId: string, name: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.renamePipeline(ws.id, id.parse(pipelineId), pipeName.parse(name));
    return null;
  });
}

export async function deletePipelineAction(slug: string, pipelineId: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deletePipeline(ws.id, id.parse(pipelineId));
    return null;
  });
}

export async function addStageAction(slug: string, pipelineId: string, name: string) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    return { id: (await data.addStage(ws.id, id.parse(pipelineId), stageName.parse(name))).id };
  });
}

export async function updateStageAction(slug: string, stageId: string, patch: { name?: string; color?: string }) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.updateStage(ws.id, id.parse(stageId), { name: patch.name === undefined ? undefined : stageName.parse(patch.name), color: patch.color === undefined ? undefined : stageColor.parse(patch.color) });
    return null;
  });
}

export async function deleteStageAction(slug: string, stageId: string, moveTo?: string | null) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.deleteStage(ws.id, id.parse(stageId), moveTo ? id.parse(moveTo) : null);
    return null;
  });
}

// ---------------------------------------------------------------------------
// foto de perfil e logo da empresa (data URL já reduzida no navegador)
// ---------------------------------------------------------------------------
const photo = z
  .string()
  .max(200_000, "Imagem grande demais.")
  .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/, "Formato de imagem inválido.")
  .nullable();

// ---------------------------------------------------------------------------
// configurações: meus dados e dados da empresa
// ---------------------------------------------------------------------------
export async function updateMyNameAction(slug: string, name: string) {
  return run(async () => {
    const { user } = await requireWorkspace(slug);
    await data.updateMyName(user.id, z.string().trim().min(2, "Digite seu nome.").max(120).parse(name));
    return null;
  });
}

export async function changeMyEmailAction(slug: string, email: string) {
  return run(async () => {
    const { user } = await requireWorkspace(slug);
    if (!(await rateLimit(`email-change:${user.id}`, 3, 60 * 60_000))) throw new DomainError("invalid", "Muitas trocas de email. Tente daqui a uma hora.");
    const v = z
      .string()
      .trim()
      .email("Digite um email válido.")
      .refine((e) => !isDisposableEmail(e), "Use um email de verdade: endereços temporários não são aceitos.")
      .parse(email);
    if (v.toLowerCase() === user.email.toLowerCase()) throw new DomainError("invalid", "Esse já é o seu email.");
    return data.changeMyEmail(user.id, v);
  });
}

export async function changeMyPasswordAction(slug: string, current: string, next: string) {
  return run(async () => {
    const { user } = await requireWorkspace(slug);
    if (!(await rateLimit(`pwd:${user.id}`, 5, 15 * 60_000))) throw new DomainError("invalid", "Muitas tentativas. Espere alguns minutos.");
    await data.changeMyPassword(user.id, z.string().min(1, "Digite a senha atual.").parse(current), z.string().min(8, "A senha nova precisa de pelo menos 8 caracteres.").max(72).parse(next));
    return null;
  });
}

const wsInput = z.object({
  name: z.string().trim().min(2, "Dê um nome para a empresa.").max(120),
  phone: z
    .string()
    .optional()
    .transform((v) => digits(v ?? ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "WhatsApp com DDD, ex.: (11) 98888-1234.")
    .transform((v) => v || null),
  timezone: z.enum(["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Noronha", "America/Rio_Branco"]),
  currency: z.enum(["BRL", "USD", "EUR"]),
});

export async function updateWorkspaceAction(slug: string, input: z.input<typeof wsInput>) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    await data.updateWorkspace(ws.id, user.id, wsInput.parse(input));
    return null;
  });
}

export async function setMyAvatarAction(slug: string, avatar: string | null) {
  return run(async () => {
    const { user, ws } = await requireWorkspace(slug);
    const pic = photo.parse(avatar);
    await data.setMyAvatar(user.id, pic);
    const admin = (await data.listMembers(ws.id)).members.find((m) => m.userId === user.id)?.isAdmin;
    if (admin) await data.setWorkspaceLogo(ws.id, pic).catch(() => undefined);
    refresh();
    return null;
  });
}

export async function setLogoAction(slug: string, logo: string | null) {
  return run(async () => {
    const { ws } = await requireActive(slug);
    await data.setWorkspaceLogo(ws.id, photo.parse(logo));
    return null;
  });
}

// ---------------------------------------------------------------------------
// estatísticas: metas e ROI (só administradores)
// ---------------------------------------------------------------------------
const month = z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido.");
const goalRow = z.object({ userId: id, cents: z.number().int().min(0).max(1e13), count: z.number().int().min(0).max(1e6) });

export async function saveGoalsAction(slug: string, m: string, goals: z.input<typeof goalRow>[]) {
  return run(async () => {
    const { ws } = await requireAdmin(slug);
    await data.saveGoals(ws.id, month.parse(m), z.array(goalRow).max(500).parse(goals));
    refresh();
    return null;
  });
}

const roiInput = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao relatório.").max(80),
    investment: z.string().max(30),
    utmSource: z.string().trim().max(80),
    utmCampaign: z.string().trim().max(120),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data inicial."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data final."),
  })
  .refine((r) => r.to >= r.from, "A data final vem depois da inicial.");

export async function saveRoiReportAction(slug: string, reportId: string | null, input: z.input<typeof roiInput>) {
  return run(async () => {
    const { ws } = await requireAdmin(slug);
    const v = roiInput.parse(input);
    await data.saveRoiReport(ws.id, reportId ? id.parse(reportId) : null, {
      name: v.name,
      investmentCents: parseBRL(v.investment),
      utmSource: v.utmSource || null,
      utmCampaign: v.utmCampaign || null,
      from: v.from,
      to: v.to,
    });
    refresh();
    return null;
  });
}

export async function deleteRoiReportAction(slug: string, reportId: string) {
  return run(async () => {
    const { ws } = await requireAdmin(slug);
    await data.deleteRoiReport(ws.id, id.parse(reportId));
    refresh();
    return null;
  });
}
