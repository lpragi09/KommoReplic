"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Kanban e Lista chegam prontos do servidor; a troca é só aqui no navegador (sem buscar a página de novo). */
export function LeadsViews({ kanban, list }: { kanban: ReactNode; list: ReactNode }) {
  return useSearchParams().get("view") === "list" ? list : kanban;
}

/** mostra um dos blocos conforme ?param= no endereço (troca na hora, sem ir ao servidor) */
export function ByParam({ param, nodes, fallback }: { param: string; nodes: Record<string, ReactNode>; fallback: string }) {
  const v = useSearchParams().get(param) ?? fallback;
  return <>{nodes[v] ?? nodes[fallback]}</>;
}

/** abas que só trocam o ?param= no endereço (history), para usar com ByParam */
export function ParamTabs({ param, label, fallback, options }: { param: string; label: string; fallback: string; options: { value: string; label: string }[] }) {
  const sp = useSearchParams();
  const path = usePathname();
  const current = sp.get(param) ?? fallback;
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 items-center gap-0.5 rounded-pill bg-surface p-1 shadow-[inset_0_0_0_1px_var(--border)]">
      {options.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              const next = new URLSearchParams(sp.toString());
              if (o.value === fallback) next.delete(param);
              else next.set(param, o.value);
              window.history.replaceState(null, "", `${path}${next.size ? `?${next}` : ""}`);
            }}
            className={
              on
                ? "inline-flex h-8 items-center rounded-pill bg-bg px-3.5 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--border),0_2px_6px_-2px_rgba(20,28,24,.25)]"
                : "inline-flex h-8 items-center rounded-pill px-3.5 text-sm font-medium text-muted hover:text-fg"
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
