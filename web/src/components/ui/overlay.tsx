"use client";

import type { ReactNode } from "react";
import { Dialog as D, Tabs as T } from "radix-ui";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function Dialog({
  trigger,
  title,
  description,
  children,
  footer,
  size = "md",
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--inverse-bg)_55%,transparent)]" />
        <D.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-bg shadow-[0_0_0_1px_color-mix(in_srgb,var(--border)_80%,transparent),0_30px_70px_-20px_rgba(14,26,58,.45)]",
            { sm: "max-w-[400px]", md: "max-w-[560px]", lg: "max-w-[720px]", xl: "max-w-[1040px]" }[size],
          )}
        >
          {/* cabeçalho com luz azul suave e filete de cor no topo */}
          <div className="relative flex shrink-0 items-start justify-between gap-4 bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--accent)_9%,var(--bg)),var(--bg)_60%)] px-6 pb-4 pt-6">
            <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--stage-4),transparent)]" aria-hidden />
            <div>
              <D.Title className="text-xl font-semibold tracking-tight text-fg">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close aria-label="Fechar" className="rounded-pill p-1.5 text-muted transition-colors hover:bg-surface hover:text-fg">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
          {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface/60 px-6 py-3.5">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const DialogClose = D.Close;

export function Tabs({ tabs, defaultValue }: { tabs: { value: string; label: string; content: ReactNode }[]; defaultValue?: string }) {
  return (
    <T.Root defaultValue={defaultValue ?? tabs[0]?.value}>
      <T.List className="flex gap-4 border-b border-border">
        {tabs.map((t) => (
          <T.Trigger
            key={t.value}
            value={t.value}
            className="-mb-px h-9 border-b-2 border-transparent text-sm font-medium text-muted hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
          >
            {t.label}
          </T.Trigger>
        ))}
      </T.List>
      {tabs.map((t) => (
        <T.Content key={t.value} value={t.value} className="pt-3">
          {t.content}
        </T.Content>
      ))}
    </T.Root>
  );
}
