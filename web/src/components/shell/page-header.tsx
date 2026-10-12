import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { ChevronRight } from "@/components/ui/icons";
import { BackButton } from "./back-button";

/** Topbar da seção: título à esquerda, controles no meio, ações à direita. Quebra em 2 linhas no celular. */
export function PageHeader({
  title,
  children,
  actions,
  className,
  crumbs,
  back = true,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** trilha acima do título, ex.: [{ label: "Configurações", href: "/ws/settings" }] */
  crumbs?: { label: string; href: string }[];
  back?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex min-h-[var(--topbar)] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-bg px-4 py-2 md:py-0",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {back && <BackButton className="-ml-2" />}
        <div className="min-w-0">
          {crumbs && crumbs.length > 0 && (
            <nav aria-label="Trilha" className="flex items-center gap-1 text-xs text-muted">
              {crumbs.map((c) => (
                <span key={c.href} className="flex items-center gap-1">
                  <Link href={c.href} className="hover:text-fg hover:underline">
                    {c.label}
                  </Link>
                  <ChevronRight className="size-3" aria-hidden />
                </span>
              ))}
            </nav>
          )}
          <h1 className="truncate text-lg font-semibold tracking-tight text-fg">{title}</h1>
        </div>
      </div>
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
