import Link from "next/link";
import { AlarmClock, Bell, MessageSquare, UserPlus } from "@/components/ui/icons";
import { getBoard, listConversations, listTasks } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, when } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/bits";

export const metadata = { title: "Notificações" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

/* Por enquanto as notificações são calculadas do estado atual (não lidas, entradas, tarefas atrasadas).
   A tabela notifications do schema entra com o replica-backend, junto com "marcar como lida". */
export default async function NotificationsPage({ params }: PageProps<"/[ws]/notifications">) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  const [unread, board, tasks] = await Promise.all([
    listConversations(ws.id, user.id, "unread"),
    getBoard(ws.id, undefined),
    listTasks(ws.id, { owner: user.id, open: true, to: new Date().toISOString() }),
  ]);
  const items = [
    ...board.incoming.map((i) => ({ id: i.id, at: i.createdAt, icon: UserPlus, text: `Novo contato: ${i.who}`, sub: i.preview, href: `/${slug}/leads` })),
    ...unread.map((c) => ({ id: c.id, at: c.lastMessageAt ?? "", icon: MessageSquare, text: `${c.unreadCount} nova(s) de ${c.contact.name}`, sub: c.lastMessagePreview, href: `/${slug}/inbox?c=${c.id}` })),
    ...tasks.map((t) => ({ id: t.id, at: t.dueAt, icon: AlarmClock, text: `Tarefa atrasada${t.lead ? ` · ${leadTitle(t.lead)}` : ""}`, sub: t.text, href: t.lead ? `/${slug}/leads/${t.lead.id}` : `/${slug}/calendar` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <>
      <PageHeader title="Notificações" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          {items.length === 0 ? (
            <EmptyState icon={Bell} title="Nada novo" text="Mensagens, novos contatos e tarefas atrasadas aparecem aqui." />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} className="flex gap-3 px-4 py-3 hover:bg-surface">
                    <n.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-fg">{n.text}</p>
                      <p className="truncate text-sm text-muted">{n.sub}</p>
                    </div>
                    <time className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                      {n.at && when(n.at)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
