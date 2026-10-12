"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Search, X } from "@/components/ui/icons";
import { Badge } from "@/components/ui/bits";
import { SegmentedControl } from "@/components/ui/interactive";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export function LeadsToolbar({ pipelines, users }: { pipelines: { id: string; name: string }[]; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(sp.get("q") ?? "");

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  const view = (sp.get("view") as "kanban" | "list") ?? "kanban";
  const activeFilters = ["owner", "task", "tag"].filter((k) => sp.get(k)).length;
  const sel = "h-9 rounded-sm border border-border bg-bg px-2.5 text-base text-fg shadow-[0_1px_2px_rgba(14,26,58,.06)] hover:border-border-input focus:border-focus";

  return (
    <>
      <label className="sr-only" htmlFor="pipeline">
        Funil
      </label>
      <select id="pipeline" className={cn(sel, "max-w-48")} value={sp.get("pipeline") ?? pipelines[0]?.id} onChange={(e) => set({ pipeline: e.target.value })}>
        {pipelines.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <SegmentedControl
        label="Visualização"
        value={view}
        onChange={(v) => set({ view: v === "kanban" ? null : v })}
        options={[
          { value: "kanban", label: "Kanban" },
          { value: "list", label: "Lista" },
        ]}
      />
      <form
        role="search"
        className="w-full sm:w-56"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim() || null });
        }}
      >
        <Field label="Buscar leads" hideLabel placeholder="Buscar nome ou #número…" adornment={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <Button variant="secondary" icon={<Filter className="size-4" aria-hidden />} aria-expanded={open} aria-controls="filtros" onClick={() => setOpen((v) => !v)}>
        Filtros {activeFilters > 0 && <Badge tone="neutral">{activeFilters}</Badge>}
      </Button>
      {open && (
        <div id="filtros" className="flex w-full flex-wrap items-end gap-3 pb-2" data-editing>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-owner" className="text-sm font-medium text-fg">
              Responsável
            </label>
            <select id="f-owner" className={sel} value={sp.get("owner") ?? ""} onChange={(e) => set({ owner: e.target.value || null })}>
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-task" className="text-sm font-medium text-fg">
              Tarefas
            </label>
            <select id="f-task" className={sel} value={sp.get("task") ?? ""} onChange={(e) => set({ task: e.target.value || null })}>
              <option value="">Qualquer</option>
              <option value="none">Sem tarefa</option>
              <option value="late">Atrasadas</option>
            </select>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={() => set({ owner: null, task: null, tag: null })}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </>
  );
}
