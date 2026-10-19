import "server-only";
import { getBoard, getNotificationsSeen, listConversations, listTasks } from ".";
import { leadTitle } from "@/lib/format";

export type NotificationItem = { id: string; at: string; kind: "incoming" | "message" | "task"; text: string; sub: string; href: string; seen: boolean };

/* Notificações calculadas do estado atual: contatos novos na entrada, conversas não lidas e tarefas atrasadas.
   Somem sozinhas quando resolvidas; "marcar como lido" guarda até quando a pessoa já viu (o que é mais antigo fica apagado). */
export async function loadNotifications(slug: string, wsId: string, userId: string) {
  const [unread, board, tasks, seenAt] = await Promise.all([
    listConversations(wsId, userId, "unread"),
    getBoard(wsId, undefined),
    listTasks(wsId, { owner: userId, open: true, to: new Date().toISOString() }),
    getNotificationsSeen(wsId, userId),
  ]);
  const seen = (at: string) => !!seenAt && !!at && at <= seenAt;
  const items: NotificationItem[] = [
    ...board.incoming.map((i) => ({ id: i.id, at: i.createdAt, kind: "incoming" as const, text: `Novo contato: ${i.who}`, sub: i.preview, href: `/${slug}/leads` })),
    ...unread.map((c) => ({ id: c.id, at: c.lastMessageAt ?? "", kind: "message" as const, text: `${c.unreadCount} nova(s) de ${c.contact.name}`, sub: c.lastMessagePreview ?? "", href: `/${slug}/inbox?c=${c.id}` })),
    ...tasks.map((t) => ({ id: t.id, at: t.dueAt, kind: "task" as const, text: `Tarefa atrasada${t.lead ? ` · ${leadTitle(t.lead)}` : ""}`, sub: t.text, href: t.lead ? `/${slug}/leads/${t.lead.id}` : `/${slug}/calendar` })),
  ]
    .map((n) => ({ ...n, seen: seen(n.at) }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return { items, unseen: items.filter((n) => !n.seen).length, unread, board };
}
