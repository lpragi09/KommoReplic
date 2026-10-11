import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Topbar da seção: título à esquerda, controles no meio, ações à direita. Quebra em 2 linhas no celular. */
export function PageHeader({ title, children, actions, className }: { title: ReactNode; children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "flex min-h-[var(--topbar)] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-bg px-4 py-2 md:py-0",
        className,
      )}
    >
      <h1 className="min-w-0 truncate text-lg text-fg">{title}</h1>
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StubPage({ title, screen, text }: { title: string; screen: string; text: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="grid flex-1 place-items-center p-6">
        <div className="max-w-md rounded-lg border border-dashed border-border-input p-6 text-center">
          <p className="text-caps uppercase text-muted">{screen} · em construção</p>
          <p className="mt-2 text-base text-fg">{text}</p>
        </div>
      </div>
    </>
  );
}
