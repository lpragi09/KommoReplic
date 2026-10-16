import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { open, seal } from "@/lib/secret-box";
import { sendText } from "@/lib/meta";
import { DomainError, type Channel, type ID } from "../types";

/* Canais da Meta no Supabase: conectar (token cifrado), desconectar e entregar a fila de mensagens. */

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do PostgREST */
type Row = Record<string, any>;
type Social = "whatsapp" | "instagram" | "messenger";

function check(r: { data: unknown; error: PostgrestError | null }): any {
  if (r.error) {
    if (r.error.code === "42501" || r.error.message.includes("row-level security")) throw new DomainError("forbidden", "Só administradores podem conectar canais.");
    if (r.error.code === "23505") throw new DomainError("invalid", "Essa conta já está conectada (aqui ou em outra empresa).");
    throw new Error(r.error.message);
  }
  return r.data;
}

export async function connectChannel(wsId: ID, _actor: ID, input: { kind: Social; externalId: string; pageId?: string; token: string; name: string; pipelineId: ID | null }): Promise<Channel> {
  const sb = await userClient();
  const existing = check(await sb.from("channels").select("id").eq("workspace_id", wsId).eq("kind", input.kind).eq("external_id", input.externalId).maybeSingle());
  const row = { name: input.name, external_id: input.externalId, status: "connected", status_detail: null, default_pipeline_id: input.pipelineId, config: input.pageId ? { page_id: input.pageId } : {} };
  const ch = existing
    ? check(await sb.from("channels").update(row).eq("id", existing.id).select("*").single())
    : check(await sb.from("channels").insert({ ...row, workspace_id: wsId, kind: input.kind }).select("*").single());
  check(await adminClient().from("channel_secrets").upsert({ channel_id: ch.id, workspace_id: wsId, token_enc: seal(input.token), updated_at: new Date().toISOString() }));
  return { id: ch.id, workspaceId: wsId, kind: ch.kind, name: ch.name, publicKey: ch.public_key, defaultPipelineId: ch.default_pipeline_id, status: ch.status };
}

export async function disconnectChannel(wsId: ID, channelId: ID) {
  const sb = await userClient();
  const r = check(await sb.from("channels").update({ status: "disconnected" }).eq("workspace_id", wsId).eq("id", channelId).neq("kind", "webchat").select("id"));
  if (!r.length) throw new DomainError("forbidden", "Só administradores podem desconectar canais.");
  await adminClient().from("channel_secrets").delete().eq("channel_id", channelId);
}

/** Entrega mensagens "na fila" pela Meta. Sem ids: as mais antigas da fila (rede de segurança do cron). */
export async function deliverQueued(wsId: ID | null, messageIds?: ID[]) {
  const a = adminClient();
  let q = a
    .from("messages")
    .select("id, body, channel_id, conversations(external_thread_id), channels(kind, external_id, status, config)")
    .eq("status", "queued")
    .eq("direction", "out")
    .order("created_at")
    .limit(50);
  if (wsId) q = q.eq("workspace_id", wsId);
  if (messageIds?.length) q = q.in("id", messageIds);
  const rows: Row[] = check(await q);
  let sent = 0;
  for (const m of rows) {
    const ch = m.channels as Row | null;
    if (!ch || ch.kind === "webchat" || ch.status !== "connected" || !ch.external_id) continue; // canal ainda não conectado: fica na fila
    const sec = check(await a.from("channel_secrets").select("token_enc").eq("channel_id", m.channel_id).maybeSingle());
    if (!sec) continue;
    try {
      const via = ch.kind === "instagram" ? (ch.config?.page_id ?? ch.external_id) : ch.external_id;
      const extId = await sendText(ch.kind, via, open(sec.token_enc), m.conversations?.external_thread_id, m.body);
      await a.from("messages").update({ status: "sent", external_id: extId, error: null }).eq("id", m.id);
      sent++;
    } catch (e) {
      await a.from("messages").update({ status: "failed", error: e instanceof Error ? e.message.slice(0, 300) : "falha no envio" }).eq("id", m.id);
    }
  }
  return sent;
}

/** avisos da Meta (enviada, entregue, lida, falhou) atualizam a mensagem */
export async function updateDeliveryStatus(externalId: string, status: string, error?: string) {
  const map: Record<string, string> = { sent: "sent", delivered: "delivered", read: "read", failed: "failed" };
  const st = map[status];
  if (!st) return;
  await adminClient().from("messages").update({ status: st, ...(error ? { error: error.slice(0, 300) } : {}) }).eq("external_id", externalId).eq("direction", "out");
}
