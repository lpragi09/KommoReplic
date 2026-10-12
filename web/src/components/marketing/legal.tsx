import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";

/** Moldura das páginas legais. O texto é RASCUNHO até revisão de um advogado. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> {BRAND.name}
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p role="note" className="rounded-sm bg-warning-soft px-3 py-2 text-sm text-warning">
          Rascunho para revisão jurídica. Ainda não vale como contrato.
        </p>
        <h1 className="mt-6 text-display tracking-tight text-fg">{title}</h1>
        <p className="mt-2 text-sm text-muted">Atualizado em {updated}</p>
        <div className="mt-10 flex flex-col gap-8 text-base text-fg [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:max-w-[68ch] [&_p]:text-muted [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:text-muted">
          {children}
        </div>
      </main>
    </div>
  );
}
