/* Componentes sem estado: servem tanto em componentes de servidor quanto de cliente. */
import type { ReactNode } from "react";
import { X, type LucideIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function Badge({ children, tone = "accent", className }: { children?: ReactNode; tone?: "accent" | "neutral" | "dot"; className?: string }) {
  if (tone === "dot") return <span className={cn("inline-block size-2 rounded-pill bg-accent", className)} aria-hidden />;
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill px-1.5 text-xs font-semibold leading-none",
        tone === "accent" ? "bg-accent text-on-accent" : "bg-canvas text-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Tag({ children, onRemove, tone = 0 }: { children: string; onRemove?: () => void; tone?: 0 | 1 | 2 | 3 }) {
  const bg = ["bg-accent-soft text-accent-text", "bg-stage-1 text-fg", "bg-stage-2 text-fg", "bg-stage-3 text-fg"][tone];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-pill px-2 text-xs font-medium", bg)}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remover tag ${children}`} className="-mr-1 rounded-pill p-0.5 hover:bg-bg/60">
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

export function Avatar({ name, size = 32, badge }: { name: string; size?: 20 | 24 | 32 | 40; badge?: ReactNode }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const dim = { 20: "size-5 text-[9px]", 24: "size-6 text-[10px]", 32: "size-8 text-xs", 40: "size-10 text-sm" }[size];
  return (
    <span className="relative inline-flex shrink-0">
      <span className={cn("inline-flex items-center justify-center rounded-sm bg-canvas font-semibold text-fg", dim)} aria-hidden>
        {initials}
      </span>
      <span className="sr-only">{name}</span>
      {badge && <span className="absolute -bottom-0.5 -right-0.5 rounded-xs bg-bg p-px">{badge}</span>}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon className="size-9 text-muted" weight="light" aria-hidden />
      <p className="text-md text-fg">{title}</p>
      <p className="max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-canvas", className)} aria-hidden />;
}
