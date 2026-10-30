import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";
import { LEGAL, legalComplete } from "@/lib/legal";

/** Quem responde pelo serviço e como falar com ele */
export function LegalContact() {
  return (
    <ul>
      <li>Responsável: {LEGAL.company || "em preenchimento"}</li>
      <li>CNPJ/CPF: {LEGAL.document || "em preenchimento"}</li>
      <li>Endereço: {LEGAL.address || "em preenchimento"}</li>
      <li>Email: {LEGAL.email ? <a href={`mailto:${LEGAL.email}`} className="underline">{LEGAL.email}</a> : "em preenchimento"}</li>
    </ul>
  );
}

/** Moldura das páginas legais. */
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
        {!legalComplete() && (
          <p role="note" className="rounded-sm bg-warning-soft px-3 py-2 text-sm text-warning">
            Versão em preparação: os dados da empresa responsável ainda estão sendo preenchidos.
          </p>
        )}
        <h1 className="mt-6 text-display tracking-tight text-fg">{title}</h1>
        <p className="mt-2 text-sm text-muted">Atualizado em {updated}</p>
        <div className="mt-10 flex flex-col gap-8 text-base text-fg [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:max-w-[68ch] [&_p]:text-muted [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:text-muted">
          {children}
        </div>
      </main>
    </div>
  );
}
