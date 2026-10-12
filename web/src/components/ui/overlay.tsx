"use client";

import type { ReactNode } from "react";
import { Dialog as D, Tabs as T } from "radix-ui";
import { X } from "lucide-react";
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
  size?: "sm" | "md" | "lg";
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-inverse-bg/50" />
        <D.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg bg-bg shadow-pop",
            { sm: "max-w-[400px]", md: "max-w-[560px]", lg: "max-w-[720px]" }[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div>
              <D.Title className="text-lg text-fg">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close aria-label="Fechar" className="rounded-sm p-1 text-muted hover:bg-surface hover:text-fg">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="px-6 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-3">{footer}</div>}
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
