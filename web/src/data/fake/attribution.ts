import "server-only";
import { randomInt } from "node:crypto";
import { connection } from "next/server";
import { db, now, uid } from "./store";
import { addTouch, findRef } from "@/lib/utm";
import { DomainError, type Attribution, type ID, type TrackingLink } from "../types";

/* Origem dos leads e links rastreáveis — banco em memória. */

type LinkRow = TrackingLink & { workspaceId: string };
type ClickRow = { id: string; workspaceId: string; linkId: string; ref: string; attribution: Attribution; conversationId: string | null; createdAt: string };
const g = globalThis as unknown as { __crmLinks?: { links: LinkRow[]; clicks: ClickRow[] } };
const store = (g.__crmLinks ??= { links: [], clicks: [] });

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para ninguém confundir
const newRef = (n = 5) => Array.from({ length: n }, () => ALPHA[randomInt(ALPHA.length)]).join("");
const newCode = () => Array.from({ length: 8 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[randomInt(31)]).join("");

/** junta a origem à da conversa (1º contato guardado, caminho do lead) e passa para o lead dela */
function setConversationAttribution(conversationId: ID, attr: Attribution) {
  const c = db.conversations.find((x) => x.id === conversationId);
  if (!c) return;
  const merged = addTouch(c.attribution, attr);
  if (!merged) return;
  c.attribution = merged;
  if (c.leadId) {
    const l = db.leads.find((x) => x.id === c.leadId);
    if (l) l.attribution = merged;
  }
}
function copyToLead(leadId: ID, attr: Attribution | null | undefined) {
  const l = db.leads.find((x) => x.id === leadId);
  if (l && attr && !l.attribution) l.attribution = attr;
}

/** Mensagem recebida: procura o código do link rastreável e/ou grava a origem que veio junto (chat do site, anúncio). */
export async function attributeInbound(conversationId: ID, body: string, extra?: Attribution | null) {
  const ref = findRef(body);
  const click = ref ? store.clicks.find((k) => k.ref === ref && !k.conversationId) : undefined;
  if (click) {
    click.conversationId = conversationId;
    const link = store.links.find((l) => l.id === click.linkId);
    if (link) link.matched += 1;
    setConversationAttribution(conversationId, click.attribution);
  } else if (extra) setConversationAttribution(conversationId, extra);
}

/** quando o lead nasce ou é vinculado a uma conversa com origem */
export async function syncLeadAttribution(_wsId: ID, leadId: ID) {
  const c = db.conversations.find((x) => x.leadId === leadId && x.attribution);
  copyToLead(leadId, c?.attribution);
}

export async function getLeadAttribution(wsId: ID, leadId: ID): Promise<Attribution | null> {
  await connection();
  const l = db.leads.find((x) => x.id === leadId && x.workspaceId === wsId);
  if (!l) throw new DomainError("not_found");
  return l.attribution ?? db.conversations.find((c) => c.leadId === leadId)?.attribution ?? null;
}

export async function setLeadAttribution(wsId: ID, _actor: ID, leadId: ID, attr: Attribution | null) {
  const l = db.leads.find((x) => x.id === leadId && x.workspaceId === wsId);
  if (!l) throw new DomainError("not_found");
  l.attribution = attr;
  l.lastActivityAt = now();
}

// ---------------------------------------------------------------------------
// links rastreáveis
// ---------------------------------------------------------------------------
export async function listTrackingLinks(wsId: ID): Promise<TrackingLink[]> {
  await connection();
  return store.links.filter((l) => l.workspaceId === wsId).map(({ workspaceId: _w, ...l }) => l);
}

export async function saveTrackingLink(wsId: ID, _actor: ID, id: ID | null, input: { name: string; phone: string; message: string; defaults: Attribution }): Promise<TrackingLink> {
  if (id) {
    const l = store.links.find((x) => x.id === id && x.workspaceId === wsId);
    if (!l) throw new DomainError("not_found");
    Object.assign(l, input);
    return l;
  }
  const l: LinkRow = { ...input, id: uid(), workspaceId: wsId, code: newCode(), clicks: 0, matched: 0, createdAt: now() };
  store.links.push(l);
  return l;
}

export async function deleteTrackingLink(wsId: ID, id: ID) {
  store.links = store.links.filter((l) => !(l.id === id && l.workspaceId === wsId));
}

/** Clique público no link: guarda as UTMs e devolve para onde redirecionar, com o código que vai na mensagem. */
export async function clickTrackingLink(code: string, attr: Attribution | null) {
  const l = store.links.find((x) => x.code === code);
  if (!l) return null;
  const ref = newRef();
  l.clicks += 1;
  store.clicks.push({ id: uid(), workspaceId: l.workspaceId, linkId: l.id, ref, attribution: { ...l.defaults, ...(attr ?? {}), via: attr?.via ?? "link", link_name: l.name, link_id: l.id, at: now() }, conversationId: null, createdAt: now() });
  return { phone: l.phone, message: l.message, ref };
}
