import "server-only";
import { getBoard, getNotificationsSeen, listConversations, listTasks } from ".";
import { leadTitle } from "@/lib/format";

export type NotificationItem = { id: string; at: string; kind: "incoming" | "message" | "task" | "today"; text: string; sub: string; href: string; seen: boolean };

/* Notificações calculadas do estado atual: contatos novos na entrada, conversas não lidas, tarefas atrasadas e as de hoje.
   Somem sozinhas quando resolvidas; "marcar como lido" guarda até quando a pessoa já viu (o que é mais antigo fica apagado). */
/** fim do dia de hoje em Brasília, em ISO */
function endOfToday() {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return new Date(`${day}T23:59:59-03:00`).toISOString();
}

export async function loadNotifications(slug: string, wsId: string, userId: string) {
  const now = new Date().toISOString();
  const [unread, board, tasks, seenAt] = await Promise.all([
    listConversations(wsId, userId, "unread"),
    getBoard(wsId, undefined),
    listTasks(wsId, { owner: userId, open: true, to: endOfToday() }),
    getNotificationsSeen(wsId, userId),
  ]);
  const seen = (at: string) => !!seenAt && !!at && at <= seenAt;
  const items: NotificationItem[] = [
    ...board.incoming.map((i) => ({ id: i.id, at: i.createdAt, kind: "incoming" as const, text: `Novo contato: ${i.who}`, sub: i.preview, href: `/${slug}/leads` })),
    ...unread.map((c) => ({ id: c.id, at: c.lastMessageAt ?? "", kind: "message" as const, text: c.unreadCount > 1 ? `${c.unreadCount} mensagens novas de ${c.contact.name}` : `Mensagem nova de ${c.contact.name}`, sub: c.lastMessagePreview ?? "", href: `/${slug}/inbox?c=${c.id}` })),
    ...tasks.map((t) => {
      const late = t.dueAt <= now;
      return {
        id: t.id,
        // tarefa de hoje entra na lista na hora em que vence; até lá aparece com o horário de agora (fica no topo do dia)
        at: late ? t.dueAt : now,
        kind: late ? ("task" as const) : ("today" as const),
        text: `${late ? "Tarefa atrasada" : `Tarefa hoje às ${new Date(t.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`}${t.lead ? ` · ${leadTitle(t.lead)}` : ""}`,
        sub: t.text,
        href: t.lead ? `/${slug}/leads/${t.lead.id}` : `/${slug}/calendar`,
      };
    }),
  ]
    .map((n) => ({ ...n, seen: n.kind === "today" ? false : seen(n.at) }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return { items, unseen: items.filter((n) => !n.seen && n.kind !== "today").length, unread, board };
}
