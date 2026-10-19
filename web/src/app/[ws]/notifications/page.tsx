import Link from "next/link";
import { AlarmClock, Bell, MessageSquare, UserPlus } from "@/components/ui/icons";
import { requireWorkspace } from "@/data/session";
import { loadNotifications, type NotificationItem } from "@/data/notifications";
import { when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/bits";
import { MarkAllSeen } from "@/components/shell/mark-all-seen";

export const metadata = { title: "Notificações" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const icon = { incoming: UserPlus, message: MessageSquare, task: AlarmClock } as const;

/* Notificações calculadas do estado atual (data/notifications.ts). Somem quando resolvidas;
   "marcar tudo como lido" apaga as que já existem e zera a contagem do menu. */
export default async function NotificationsPage({ params }: PageProps<"/[ws]/notifications">) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  const { items, unseen } = await loadNotifications(slug, ws.id, user.id);
  const fresh = items.filter((n) => !n.seen);
  const old = items.filter((n) => n.seen);
  return (
    <>
      <PageHeader title="Notificações" actions={unseen > 0 ? <MarkAllSeen slug={slug} /> : undefined} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
          {items.length === 0 ? (
            <EmptyState icon={Bell} title="Nada novo" text="Mensagens, novos contatos e tarefas atrasadas aparecem aqui." />
          ) : (
            <>
              {fresh.length > 0 && <List items={fresh} />}
              {old.length > 0 && (
                <section aria-labelledby="vistas">
                  <h2 id="vistas" className="mb-2 text-sm font-medium text-muted">
                    Já vistas · somem quando resolvidas
                  </h2>
                  <List items={old} />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function List({ items }: { items: NotificationItem[] }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {items.map((n) => {
        const I = icon[n.kind];
        return (
          <li key={n.kind + n.id}>
            <Link href={n.href} className={cn("flex gap-3 px-4 py-3", n.seen ? "bg-surface hover:bg-canvas" : "hover:bg-surface")}>
              <I className={cn("mt-0.5 size-5 shrink-0", n.seen ? "text-muted" : "text-accent")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("text-base text-fg", !n.seen && "font-medium")}>{n.text}</p>
                <p className="truncate text-sm text-muted">{n.sub}</p>
              </div>
              <time className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                {n.at && when(n.at)}
              </time>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
