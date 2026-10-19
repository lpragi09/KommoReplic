import Link from "next/link";
import { Bell, ChevronRight } from "@/components/ui/icons";
import { requireWorkspace } from "@/data/session";
import { loadNotifications, type NotificationItem } from "@/data/notifications";
import { when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/bits";
import { MarkAllSeen } from "@/components/shell/mark-all-seen";
import { AlertsToggle, KIND, KindIcon } from "@/components/shell/notify";

export const metadata = { title: "Notificações" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const FILTERS = [
  { v: "todas", label: "Todas" },
  { v: "incoming", label: "Contatos novos" },
  { v: "message", label: "Mensagens" },
  { v: "tarefas", label: "Tarefas" },
] as const;

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** agrupa por dia: Hoje, Ontem e as datas anteriores */
function byDay(list: NotificationItem[]) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 864e5).toISOString());
  const groups = new Map<string, NotificationItem[]>();
  for (const n of list) {
    const k = n.at ? dayKey(n.at) : today;
    const label = k === today ? "Hoje" : k === yesterday ? "Ontem" : new Date(`${k}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    groups.set(label, [...(groups.get(label) ?? []), n]);
  }
  return groups;
}

/* Notificações calculadas do estado atual (data/notifications.ts). Somem quando resolvidas;
   "marcar tudo como lido" apaga as que já existem e zera a contagem do menu. */
export default async function NotificationsPage({ params, searchParams }: PageProps<"/[ws]/notifications">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { tipo?: string };
  const filter = FILTERS.find((f) => f.v === sp.tipo)?.v ?? "todas";
  const { user, ws } = await requireWorkspace(slug);
  const { items, unseen } = await loadNotifications(slug, ws.id, user.id);
  const count = (v: (typeof FILTERS)[number]["v"]) => (v === "todas" ? items.length : items.filter((n) => (v === "tarefas" ? n.kind === "task" || n.kind === "today" : n.kind === v)).length);
  const shown = filter === "todas" ? items : items.filter((n) => (filter === "tarefas" ? n.kind === "task" || n.kind === "today" : n.kind === filter));

  const groups = byDay(shown);

  return (
    <>
      <PageHeader title="Notificações" actions={unseen > 0 ? <MarkAllSeen slug={slug} /> : undefined} />
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <nav aria-label="Filtrar notificações" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const on = f.v === filter;
                const n = count(f.v);
                return (
                  <Link
                    key={f.v}
                    href={`/${slug}/notifications${f.v === "todas" ? "" : `?tipo=${f.v}`}`}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm transition-colors duration-fast",
                      on ? "bg-inverse-bg font-medium text-on-inverse" : "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-canvas",
                    )}
                  >
                    {f.label}
                    <span className={cn("rounded-pill px-1.5 text-xs tabular-nums", on ? "bg-[color-mix(in_srgb,var(--on-inverse)_18%,transparent)]" : "bg-surface text-muted")}>{n}</span>
                  </Link>
                );
              })}
            </nav>
            <AlertsToggle />
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={Bell} title={filter === "todas" ? "Tudo em dia" : "Nada aqui"} text="Contatos novos, mensagens não lidas e tarefas aparecem aqui e somem quando resolvidos." />
          ) : (
            [...groups.entries()].map(([label, list]) => (
              <section key={label} aria-label={label}>
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted first-letter:uppercase">{label}</h2>
                <ul className="overflow-hidden rounded-xl bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
                  {list.map((n) => (
                    <li key={n.kind + n.id} className="border-b border-border last:border-0">
                      <Link href={n.href} className={cn("group flex items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface", !n.seen && "bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]")}>
                        <KindIcon kind={n.kind} seen={n.seen} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2">
                            <span className={cn("truncate text-base text-fg", !n.seen && "font-semibold")}>{n.text}</span>
                          </p>
                          <p className="truncate text-sm text-muted">{n.sub || KIND[n.kind].label}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <time className="text-xs text-muted" suppressHydrationWarning>
                            {n.at && n.kind !== "today" && when(n.at)}
                          </time>
                          {!n.seen && n.kind !== "today" && <span className="size-2 rounded-pill bg-accent" aria-label="nova" />}
                          <ChevronRight className="size-4 text-muted opacity-0 transition-opacity duration-fast group-hover:opacity-100" aria-hidden />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          <p className="px-1 text-xs text-muted">As notificações somem sozinhas quando o assunto é resolvido: contato aceito, conversa lida ou tarefa concluída.</p>
        </div>
      </div>
    </>
  );
}
