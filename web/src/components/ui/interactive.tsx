"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-4">
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
              "h-14 border-b-2 text-caps uppercase transition-colors duration-fast",
              on ? "border-accent text-accent-text" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {o.label}
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
