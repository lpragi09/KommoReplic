import { requireWorkspace } from "@/data/session";
import { loadNotifications, type NotificationItem } from "@/data/notifications";
import { PageHeader } from "@/components/shell/page-header";
import { MarkAllSeen } from "@/components/shell/mark-all-seen";
import { NotificationList, type Filter } from "@/components/shell/notification-list";

const FILTERS: Filter[] = ["todas", "incoming", "message", "tarefas"];

export const metadata = { title: "Notificações" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** rótulo do dia de cada notificação: Hoje, Ontem ou a data */
function withDay(list: NotificationItem[]) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 864e5).toISOString());
  return list.map((n) => {
    const k = n.at ? dayKey(n.at) : today;
    const day = k === today ? "Hoje" : k === yesterday ? "Ontem" : new Date(`${k}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    return { ...n, day };
  });
}

/* Notificações calculadas do estado atual (data/notifications.ts). Somem quando resolvidas;
   "marcar tudo como lido" apaga as que já existem e zera a contagem do menu. */
export default async function NotificationsPage({ params, searchParams }: PageProps<"/[ws]/notifications">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { tipo?: string };
  const { user, ws } = await requireWorkspace(slug);
  const { items, unseen } = await loadNotifications(slug, ws.id, user.id);
  return (
    <>
      <PageHeader title="Notificações" actions={unseen > 0 ? <MarkAllSeen slug={slug} /> : undefined} />
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4 sm:p-6">
          <NotificationList items={withDay(items)} initial={FILTERS.find((x) => x === sp.tipo) ?? "todas"} />
          <p className="px-1 text-xs text-muted">As notificações somem sozinhas quando o assunto é resolvido: contato aceito, conversa lida ou tarefa concluída.</p>
        </div>
      </div>
    </>
  );
}
