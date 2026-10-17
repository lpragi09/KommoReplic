"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Rolagem para o lado com barra nossa (maior que a do navegador), arrastável, com setas.
   A barra do navegador fica escondida; roda do mouse, toque e teclado continuam funcionando. */
export function HScroll({ children, className, label = "Rolagem das etapas" }: { children: ReactNode; className?: string; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ left: 0, width: 1, max: 0 }); // posição e largura do "polegar" em %
  const drag = useRef<{ x: number; start: number } | null>(null);

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const width = el.scrollWidth ? el.clientWidth / el.scrollWidth : 1;
    setM({ left: max > 0 ? (el.scrollLeft / max) * (1 - width) : 0, width, max });
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    // roda do mouse "para baixo" também anda para o lado quando não há rolagem vertical por perto
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) return;
      if ((e.target as HTMLElement).closest("ul, textarea, [data-scroll]")) return;
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [measure]);

  const by = (dx: number) => box.current?.scrollBy({ left: dx, behavior: "smooth" });
  const onThumbDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: box.current?.scrollLeft ?? 0 };
  };
  const onThumbMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = box.current;
    const t = track.current;
    if (!d || !el || !t) return;
    const ratio = m.max / (t.clientWidth * (1 - m.width) || 1);
    el.scrollLeft = d.start + (e.clientX - d.x) * ratio;
  };
  const onTrackDown = (e: React.PointerEvent) => {
    const t = track.current;
    const el = box.current;
    if (!t || !el || e.target !== t) return;
    const r = t.getBoundingClientRect();
    const at = (e.clientX - r.left) / r.width; // pula para onde clicou
    el.scrollTo({ left: Math.max(0, Math.min(1, (at - m.width / 2) / (1 - m.width))) * m.max, behavior: "smooth" });
  };

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div ref={box} className="no-scrollbar flex min-h-0 flex-1 overflow-x-auto">
        {children}
      </div>
      {m.max > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border bg-bg/90 px-3 py-2">
          <button type="button" aria-label="Rolar para a esquerda" onClick={() => by(-360)} disabled={m.left <= 0.001} className="grid size-7 place-items-center rounded-pill text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-30">
            <ChevronRight className="size-4 rotate-180" aria-hidden />
          </button>
          <div
            ref={track}
            onPointerDown={onTrackDown}
            role="scrollbar"
            aria-label={label}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((m.left / Math.max(0.0001, 1 - m.width)) * 100)}
            aria-controls={undefined}
            className="relative h-3 flex-1 cursor-pointer rounded-pill bg-surface shadow-[inset_0_0_0_1px_var(--border)]"
          >
            <div
              onPointerDown={onThumbDown}
              onPointerMove={onThumbMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              className="absolute inset-y-0.5 cursor-grab rounded-pill bg-[linear-gradient(90deg,var(--accent),#3b82f6)] shadow-[0_2px_6px_-2px_rgba(29,78,216,.6)] transition-[filter] hover:brightness-110 active:cursor-grabbing"
              style={{ left: `${m.left * 100}%`, width: `${Math.max(m.width * 100, 6)}%` }}
            />
          </div>
          <button type="button" aria-label="Rolar para a direita" onClick={() => by(360)} disabled={m.left >= 1 - m.width - 0.001} className="grid size-7 place-items-center rounded-pill text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-30">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
