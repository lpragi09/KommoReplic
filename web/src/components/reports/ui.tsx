import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "@/components/ui/icons";

/* Peças das estatísticas (servidor): número grande, cartão e barras. */

export function Kpi({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone?: "success" }) {
  return (
    <div className="rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className={cn("grid size-7 place-items-center rounded-sm", tone === "success" ? "bg-success-soft text-success" : "bg-accent-soft text-accent-text")} aria-hidden>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
    </div>
  );
}

export function Card({ title, sub, children, icon: Icon, action, className }: { title: string; sub?: string; children: ReactNode; icon?: LucideIcon; action?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]", className)} aria-label={title}>
      <header className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted" aria-hidden />}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Bars({ rows, empty, tone }: { rows: { label: string; value: number; extra?: string; color?: string }[]; empty: string; tone?: "danger" }) {
  if (!rows.length || rows.every((r) => r.value === 0)) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-fg">{r.label}</span>
            {r.extra && <span className="text-xs tabular-nums text-muted">{r.extra}</span>}
            <span className="w-8 text-right font-medium tabular-nums text-fg">{r.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-pill bg-surface">
            <div
              className={cn("h-full rounded-pill", r.color ?? (tone === "danger" ? "bg-danger" : "bg-[linear-gradient(90deg,var(--accent),var(--stage-4))]"))}
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** tabela com cabeçalho fixo e rolagem lateral no celular */
export function Table({ head, children, caption }: { head: { label: string; right?: boolean }[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            {head.map((h) => (
              <th key={h.label} scope="col" className={cn("px-2 pb-2 font-medium first:pl-0 last:pr-0", h.right && "text-right")}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
