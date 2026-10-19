"use client";

import { useState } from "react";
import Link from "next/link";
import type { NotificationItem } from "@/data/notifications";
import { when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Bell, ChevronRight } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/bits";
import { AlertsToggle, KIND, KindIcon } from "./notify";

/* Lista da tela de Notificações. O filtro troca na hora, sem ir ao servidor (a lista inteira já veio). */

const FILTERS = [
  { v: "todas", label: "Todas" },
  { v: "incoming", label: "Contatos novos" },
  { v: "message", label: "Mensagens" },
  { v: "tarefas", label: "Tarefas" },
] as const;
export type Filter = (typeof FILTERS)[number]["v"];

const pass = (f: Filter, n: NotificationItem) => f === "todas" || (f === "tarefas" ? n.kind === "task" || n.kind === "today" : n.kind === f);

export function NotificationList({ items, initial }: { items: (NotificationItem & { day: string })[]; initial: Filter }) {
  const [filter, setFilter] = useState<Filter>(initial);
  const pick = (f: Filter) => {
    setFilter(f);
    // guarda no endereço sem recarregar (voltar e atualizar mantêm o filtro)
    const url = new URL(window.location.href);
    if (f === "todas") url.searchParams.delete("tipo");
    else url.searchParams.set("tipo", f);
    window.history.replaceState(null, "", url);
  };
  const shown = items.filter((n) => pass(filter, n));
  const groups = new Map<string, typeof shown>();
  for (const n of shown) groups.set(n.day, [...(groups.get(n.day) ?? []), n]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div role="group" aria-label="Filtrar notificações" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = f.v === filter;
            return (
              <button
                key={f.v}
                type="button"
                aria-pressed={on}
                onClick={() => pick(f.v)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm transition-colors duration-fast",
                  on ? "bg-inverse-bg font-medium text-on-inverse" : "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-canvas",
                )}
              >
                {f.label}
                <span className={cn("rounded-pill px-1.5 text-xs tabular-nums", on ? "bg-[color-mix(in_srgb,var(--on-inverse)_18%,transparent)]" : "bg-surface text-muted")}>
                  {items.filter((n) => pass(f.v, n)).length}
                </span>
              </button>
            );
          })}
        </div>
        <AlertsToggle />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Bell} title={filter === "todas" ? "Tudo em dia" : "Nada aqui"} text="Contatos novos, mensagens não lidas e tarefas aparecem aqui e somem quando resolvidos." />
      ) : (
        [...groups.entries()].map(([label, list]) => (
          <section key={label} aria-label={label}>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</h2>
            <ul className="overflow-hidden rounded-xl bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
              {list.map((n) => (
                <li key={n.kind + n.id} className="border-b border-border last:border-0">
                  <Link href={n.href} className={cn("group flex items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface", !n.seen && "bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]")}>
                    <KindIcon kind={n.kind} seen={n.seen} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-base text-fg", !n.seen && "font-semibold")}>{n.text}</p>
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
    </>
  );
}
