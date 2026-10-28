import "server-only";
import { randomInt } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { addTouch, findRef } from "@/lib/utm";
import { DomainError, type Attribution, type ID, type TrackingLink } from "../types";

/* Origem dos leads e links rastreáveis — Supabase.
   Cliques e mensagens chegam sem login (público/webhook): esses caminhos usam a chave secreta e sempre filtram pela empresa do link/conversa.
   Telas da equipe usam a sessão (RLS: membro lê, admin altera). */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Só administradores podem alterar links rastreáveis.");
    throw new Error(r.error.message);
  }
  return r.data;
}

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newRef = (n = 5) => Array.from({ length: n }, () => ALPHA[randomInt(ALPHA.length)]).join("");
const newCode = () => Array.from({ length: 8 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[randomInt(31)]).join("");

const toLink = (r: Row): TrackingLink => ({
  id: r.id,
  name: r.name,
  code: r.code,
  phone: r.phone,
  message: r.message ?? "",
  defaults: r.defaults ?? {},
  clicks: r.clicks ?? 0,
  matched: r.matched ?? 0,
  createdAt: new Date(r.created_at).toISOString(),
});

/** Mensagem recebida: procura o código do link rastreável e/ou grava a origem que veio junto. A trigger passa para o lead. */
export async function attributeInbound(conversationId: ID, body: string, extra?: Attribution | null) {
  const a = adminClient();
  const conv = check(await a.from("conversations").select("id, workspace_id, attribution").eq("id", conversationId).maybeSingle());
  if (!conv) return;
  let attr = extra ?? null;
  const ref = findRef(body);
  if (ref) {
    const click = check(await a.from("link_clicks").select("id, link_id, attribution").eq("ref", ref).eq("workspace_id", conv.workspace_id).is("conversation_id", null).maybeSingle());
    if (click) {
      attr = click.attribution;
      await a.from("link_clicks").update({ conversation_id: conversationId }).eq("id", click.id);
      const link = check(await a.from("tracking_links").select("matched").eq("id", click.link_id).maybeSingle());
      if (link) await a.from("tracking_links").update({ matched: (link.matched ?? 0) + 1 }).eq("id", click.link_id);
    }
  }
  const merged = attr ? addTouch(conv.attribution, attr) : null;
  if (merged) await a.from("conversations").update({ attribution: merged }).eq("id", conversationId); // a trigger leva para o lead
}

/** No Supabase a trigger attribution_to_lead já copia a origem quando a conversa ganha lead. */
export async function syncLeadAttribution(_wsId: ID, _leadId: ID) {}

export async function getLeadAttribution(wsId: ID, leadId: ID): Promise<Attribution | null> {
  const sb = await userClient();
  const l = check(await sb.from("leads").select("attribution").eq("workspace_id", wsId).eq("id", leadId).maybeSingle());
  if (!l) throw new DomainError("not_found");
  if (l.attribution) return l.attribution;
  const c = check(await sb.from("conversations").select("attribution").eq("lead_id", leadId).not("attribution", "is", null).limit(1).maybeSingle());
  return c?.attribution ?? null;
}

export async function setLeadAttribution(wsId: ID, _actor: ID, leadId: ID, attr: Attribution | null) {
  const sb = await userClient();
  const r = check(await sb.from("leads").update({ attribution: attr, last_activity_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("id", leadId).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Você não pode editar este lead.");
}

export async function listTrackingLinks(wsId: ID): Promise<TrackingLink[]> {
  const sb = await userClient();
  const { data, error } = await sb.from("tracking_links").select("*").eq("workspace_id", wsId).order("created_at");
  if (error) return []; // banco sem a atualização de UTM: tela abre vazia
  return (data ?? []).map(toLink);
}

export async function saveTrackingLink(wsId: ID, actor: ID, id: ID | null, input: { name: string; phone: string; message: string; defaults: Attribution }) {
  const sb = await userClient();
  const r = id
    ? check(await sb.from("tracking_links").update(input).eq("workspace_id", wsId).eq("id", id).select("*").maybeSingle())
    : check(await sb.from("tracking_links").insert({ ...input, workspace_id: wsId, code: newCode(), created_by: actor }).select("*").single());
  if (!r) throw new DomainError("forbidden", "Só administradores podem alterar links rastreáveis.");
  return toLink(r);
}

export async function deleteTrackingLink(wsId: ID, id: ID) {
  const sb = await userClient();
  const r = check(await sb.from("tracking_links").delete().eq("workspace_id", wsId).eq("id", id).select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem apagar links rastreáveis.");
}

export async function clickTrackingLink(code: string, attr: Attribution | null) {
  const a = adminClient();
  const l = check(await a.from("tracking_links").select("id, workspace_id, name, phone, message, defaults, clicks").eq("code", code).maybeSingle());
  if (!l) return null;
  const ref = newRef();
  await a.from("link_clicks").insert({
    workspace_id: l.workspace_id,
    link_id: l.id,
    ref,
    attribution: { ...(l.defaults ?? {}), ...(attr ?? {}), via: attr?.via ?? "link", link_name: l.name, link_id: l.id, at: new Date().toISOString() },
  });
  await a.from("tracking_links").update({ clicks: (l.clicks ?? 0) + 1 }).eq("id", l.id);
  return { phone: l.phone as string, message: (l.message as string) ?? "", ref };
}
