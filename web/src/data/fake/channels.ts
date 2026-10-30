import "server-only";
import { db, uid } from "./store";
import { open, seal } from "@/lib/secret-box";
import { sendText } from "@/lib/meta";
import { DomainError, type Channel, type ID } from "../types";

/* Canais da Meta no banco em memória (mesmo comportamento do Supabase). */

type Social = "whatsapp" | "instagram" | "messenger";
const g = globalThis as unknown as { __crmSecrets?: Map<string, { token: string; pageId?: string; appSecret?: string }> };
const secrets = (g.__crmSecrets ??= new Map());

export async function connectChannel(wsId: ID, _actor: ID, input: { kind: Social; externalId: string; pageId?: string; token: string; appSecret?: string; name: string; pipelineId: ID | null }): Promise<Channel> {
  if (db.channels.some((c) => c.kind === input.kind && c.externalId === input.externalId && c.workspaceId !== wsId && c.status !== "disconnected"))
    throw new DomainError("invalid", "Essa conta já está conectada em outra empresa.");
  let ch = db.channels.find((c) => c.workspaceId === wsId && c.kind === input.kind && c.externalId === input.externalId);
  if (!ch) {
    ch = { id: uid(), workspaceId: wsId, kind: input.kind, name: input.name, publicKey: null, defaultPipelineId: input.pipelineId, status: "connected" };
    db.channels.push(ch);
  }
  Object.assign(ch, { name: input.name, status: "connected", defaultPipelineId: input.pipelineId, externalId: input.externalId });
  secrets.set(ch.id, { token: seal(input.token), pageId: input.pageId, appSecret: input.appSecret ? seal(input.appSecret) : secrets.get(ch.id)?.appSecret });
  return ch;
}

export async function disconnectChannel(wsId: ID, channelId: ID) {
  const ch = db.channels.find((c) => c.id === channelId && c.workspaceId === wsId && c.kind !== "webchat");
  if (!ch) throw new DomainError("not_found");
  ch.status = "disconnected";
  secrets.delete(channelId);
}

export async function deliverQueued(wsId: ID | null, messageIds?: ID[]) {
  let sent = 0;
  for (const m of db.messages.filter((x) => x.status === "queued" && x.direction === "out" && (!messageIds || messageIds.includes(x.id)))) {
    const conv = db.conversations.find((c) => c.id === m.conversationId);
    const ch = conv && db.channels.find((c) => c.id === conv.channelId);
    if (!conv || !ch || (wsId && ch.workspaceId !== wsId) || ch.kind === "webchat" || ch.status !== "connected") continue;
    const sec = secrets.get(ch.id);
    const ext = (ch as Channel & { externalId?: string }).externalId;
    if (!sec || !ext) continue;
    try {
      await sendText(ch.kind as Social, ch.kind === "instagram" ? (sec.pageId ?? ext) : ext, open(sec.token), conv.externalThreadId, m.body);
      m.status = "sent";
      sent++;
    } catch {
      m.status = "failed";
    }
  }
  return sent;
}

export async function updateDeliveryStatus(_externalId: string, _status: string, _error?: string) {}
