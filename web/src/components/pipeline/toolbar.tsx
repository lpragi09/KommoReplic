"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useInstantParams } from "@/components/ui/instant-link";
import { Popover } from "radix-ui";
import { AlarmClock, CalendarCheck, Check, Filter, Funnel, KanbanIcon, ListBullets, Search, Users, X, Globe } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/bits";
import { SegmentedControl } from "@/components/ui/interactive";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { PipelineMenu } from "./manage";

const TASKS: { v: string; label: string; icon: ReactNode }[] = [
  { v: "", label: "Qualquer", icon: <CalendarCheck className="size-4" aria-hidden /> },
  { v: "none", label: "Sem tarefa", icon: <CalendarCheck className="size-4" aria-hidden /> },
  { v: "late", label: "Atrasadas", icon: <AlarmClock className="size-4" aria-hidden /> },
];

export function LeadsToolbar({
  slug,
  pipelines,
  users,
  pipelineId,
  origins = [],
}: {
  slug: string;
  pipelines: { id: string; name: string }[];
  users: { id: string; name: string }[];
  pipelineId: string;
  /** origens dos leads deste funil ("none" = sem origem) */
  origins?: string[];
}) {
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  // filtros acendem no clique; o funil filtrado chega do servidor por trás
  const { params, set, pending } = useInstantParams();
  const view = (sp.get("view") as "kanban" | "list") ?? "kanban";
  const owner = params.get("owner") ?? "";
  const task = params.get("task") ?? "";
  const origin = params.get("origin") ?? "";
  const activeFilters = [owner, task, origin, params.get("tag")].filter(Boolean).length;
  const originLabel = (o: string) => (o === "none" ? "Sem origem" : o.charAt(0).toUpperCase() + o.slice(1));
  const ownerName = users.find((u) => u.id === owner)?.name;
  const current = pipelines.find((p) => p.id === pipelineId);

  const chip = (on: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-2 rounded-pill px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-fast ease-out",
      on ? "bg-accent text-on-accent shadow-[0_6px_14px_-8px_rgba(31,122,85,.8)]" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-bg hover:shadow-[inset_0_0_0_1px_var(--border-input)]",
    );

  return (
    // no celular a barra vai para baixo do título (título e botões numa linha só) e a busca divide a linha com Filtros
    <div className="order-last flex w-full flex-wrap items-center gap-2 pb-1 md:order-none md:w-auto md:pb-0">
      {pipelines.length > 0 && (
        <Select
          label="Funil"
          hideLabel
          size="sm"
          icon={<Funnel className="size-4" aria-hidden />}
          value={pipelineId}
          onValueChange={(v) => set({ pipeline: v })}
          options={pipelines.map((p) => ({ value: p.id, label: p.name, icon: <Funnel className="size-4 text-muted" aria-hidden /> }))}
          triggerClassName="h-10 min-w-0 flex-1 max-w-56 rounded-pill bg-bg font-medium md:min-w-40 md:flex-none"
        />
      )}
      {current && <PipelineMenu slug={slug} pipeline={current} />}

      <SegmentedControl
        label="Visualização"
        compact
        value={view}
        onChange={(v) => {
          // troca na hora: só muda o endereço (o Next acompanha o history), sem pedir a página ao servidor
          const next = new URLSearchParams(sp.toString());
          if (v === "kanban") next.delete("view");
          else next.set("view", v);
          window.history.replaceState(null, "", `${path}${next.size ? `?${next}` : ""}`);
        }}
        options={[
          { value: "kanban", label: "Kanban", icon: <KanbanIcon className="size-4" aria-hidden /> },
          { value: "list", label: "Lista", icon: <ListBullets className="size-4" aria-hidden /> },
        ]}
      />

      <form
        role="search"
        className="group flex h-10 min-w-0 flex-1 basis-40 items-center gap-2 rounded-pill bg-surface px-3.5 shadow-[inset_0_0_0_1px_var(--border)] transition-[box-shadow,background-color] duration-fast focus-within:bg-bg focus-within:shadow-[inset_0_0_0_1px_var(--focus),0_0_0_4px_rgba(31,122,85,.15)] sm:w-64 sm:flex-none"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim() || null });
        }}
      >
        <Search className="size-4 shrink-0 text-muted group-focus-within:text-accent" aria-hidden />
        <label htmlFor="lead-search" className="sr-only">
          Buscar leads
        </label>
        <input
          id="lead-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome ou #número…"
          className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
        />
        {q && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setQ("");
              set({ q: null });
            }}
            className="grid size-6 place-items-center rounded-pill text-muted hover:bg-canvas hover:text-fg"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </form>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-pill px-4 text-sm font-medium transition-[background-color,box-shadow] duration-fast",
              activeFilters ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]" : "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-input)]",
            )}
          >
            <Filter className="size-4" aria-hidden /> Filtros
            {activeFilters > 0 && <span className="grid size-5 place-items-center rounded-pill bg-accent text-[11px] font-semibold text-on-accent">{activeFilters}</span>}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="z-50 w-[min(380px,calc(100vw-24px))] rounded-xl bg-bg shadow-[0_0_0_1px_var(--border),0_24px_50px_-18px_rgba(20,28,24,.45)] data-[state=open]:animate-[fx-pop_.14s_ease-out]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-semibold text-fg">Filtrar leads</p>
              {activeFilters > 0 && (
                <button type="button" onClick={() => set({ owner: null, task: null, tag: null, origin: null })} className="text-sm font-medium text-accent-text hover:underline">
                  Limpar tudo
                </button>
              )}
            </div>
            <div className="flex flex-col gap-5 p-4">
              <fieldset>
                <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Users className="size-3.5" aria-hidden /> Responsável
                </legend>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={!owner} onClick={() => set({ owner: null })} className={chip(!owner)}>
                    Todos
                  </button>
                  {users.map((u) => (
                    <button key={u.id} type="button" aria-pressed={owner === u.id} onClick={() => set({ owner: owner === u.id ? null : u.id })} className={cn(chip(owner === u.id), "pl-1.5")}>
                      <Avatar name={u.name} size={24} />
                      {u.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <CalendarCheck className="size-3.5" aria-hidden /> Tarefas
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TASKS.map((t) => (
                    <button key={t.label} type="button" aria-pressed={task === t.v} onClick={() => set({ task: t.v || null })} className={chip(task === t.v)}>
                      {task === t.v ? <Check className="size-4" aria-hidden /> : t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {origins.length > 0 && (
                <fieldset>
                  <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <Globe className="size-3.5" aria-hidden /> Origem
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" aria-pressed={!origin} onClick={() => set({ origin: null })} className={chip(!origin)}>
                      Todas
                    </button>
                    {origins.map((o) => (
                      <button key={o} type="button" aria-pressed={origin === o} onClick={() => set({ origin: origin === o ? null : o })} className={chip(origin === o)}>
                        {originLabel(o)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* filtros ativos à vista, cada um com o seu × */}
      {ownerName && (
        <button type="button" onClick={() => set({ owner: null })} className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-surface pl-1 pr-2.5 text-sm text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-canvas">
          <Avatar name={ownerName} size={24} /> {ownerName.split(" ")[0]}
          <X className="size-3.5 text-muted" aria-hidden />
          <span className="sr-only">(tirar filtro)</span>
        </button>
      )}
      {origin && (
        <button type="button" onClick={() => set({ origin: null })} className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-surface px-2.5 text-sm text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-canvas">
          <Globe className="size-3.5 text-muted" aria-hidden /> {originLabel(origin)}
          <X className="size-3.5 text-muted" aria-hidden />
          <span className="sr-only">(tirar filtro)</span>
        </button>
      )}
      {task && (
        <button type="button" onClick={() => set({ task: null })} className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-surface px-2.5 text-sm text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-canvas">
          {TASKS.find((t) => t.v === task)?.label}
          <X className="size-3.5 text-muted" aria-hidden />
          <span className="sr-only">(tirar filtro)</span>
        </button>
      )}
    </div>
  );
}
