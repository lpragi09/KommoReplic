import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "@/components/ui/icons";
import { getCompany } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/bits";
import { stageBar } from "@/lib/stage-colors";
import { NewContactButton } from "@/components/lists/lists";

export const metadata = { title: "Empresa" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export default async function CompanyPage({ params }: PageProps<"/[ws]/companies/[id]">) {
  const { ws: slug, id } = await params;
  const { ws } = await requireWorkspace(slug);
  const d = await getCompany(ws.id, id).catch(() => null);
  if (!d) notFound();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Link href={`/${slug}/companies`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Empresas
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]">
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-[linear-gradient(145deg,#3b82f6,var(--accent))] text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.3)]" aria-hidden>
            <Building2 className="size-7" weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-fg">{d.company.name}</h1>
            <p className="text-sm text-muted">
              {d.contacts.length} {d.contacts.length === 1 ? "pessoa" : "pessoas"} · {d.leads.length} {d.leads.length === 1 ? "negócio" : "negócios"}
            </p>
          </div>
          <NewContactButton slug={slug} defaultCompany={d.company.name} label="Adicionar pessoa" />
        </div>
        <section aria-labelledby="pc" className="mt-6">
          <h2 id="pc" className="text-caps uppercase text-muted">
            Pessoas ({d.contacts.length})
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {d.contacts.length === 0 && <li className="text-sm text-muted">Ninguém vinculado ainda.</li>}
            {d.contacts.map((c) => (
              <li key={c.id}>
                <Link href={`/${slug}/contacts/${c.id}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-border-input">
                  <Avatar name={c.name} size={24} /> {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="nc" className="mt-6">
          <h2 id="nc" className="text-caps uppercase text-muted">
            Negócios ({d.leads.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {d.leads.length === 0 && <li className="text-sm text-muted">Nenhum negócio ainda.</li>}
            {d.leads.map((l) => (
              <li key={l.id}>
                <Link href={`/${slug}/leads/${l.id}`} className="flex items-center gap-3 rounded-md border border-border p-3 hover:border-border-input">
                  <span className={cn("size-2.5 shrink-0 rounded-pill", stageBar[l.stage.color])} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">{leadTitle(l)}</span>
                  <span className="hidden text-sm text-muted sm:inline">{l.stage.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{money(l.priceCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
