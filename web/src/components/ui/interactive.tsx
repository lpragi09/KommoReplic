"use client";

import { useState, type ReactNode } from "react";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  compact,
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  /** no celular mostra só os ícones (o texto continua para leitor de tela) */
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 items-center gap-0.5 rounded-pill bg-surface p-1 shadow-[inset_0_0_0_1px_var(--border)]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = options.findIndex((x) => x.value === value);
              const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
              onChange(next.value);
            }}
            tabIndex={on ? 0 : -1}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-pill px-3.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-fast ease-out",
              compact && o.icon && "px-2.5 sm:px-3.5",
              on ? "bg-bg text-fg shadow-[0_0_0_1px_var(--border),0_2px_6px_-2px_rgba(14,26,58,.25)]" : "text-muted hover:text-fg",
            )}
          >
            {o.icon && <span className={cn("grid place-items-center", on && "text-accent")}>{o.icon}</span>}
            {compact && o.icon ? <span className="sr-only sm:not-sr-only">{o.label}</span> : o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toast mínimo para a galeria. No app vira um provider com fila. */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: "info" | "error"; action?: string } | null>(null);
  const node = toast && (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md bg-inverse-bg px-4 py-3 text-sm text-on-inverse shadow-pop"
    >
      {toast.text}
      {toast.action && <button className="font-semibold text-stage-3 hover:underline">{toast.action}</button>}
      <button onClick={() => setToast(null)} aria-label="Fechar aviso" className="text-nav-muted hover:text-on-inverse">
        <X className="size-4" />
      </button>
    </div>
  );
  return { show: setToast, node };
}
