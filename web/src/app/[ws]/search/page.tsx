import Link from "next/link";
import { Building2, Columns3, Contact, Search } from "lucide-react";
import { search } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, phone } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/bits";

export default async function SearchPage({ params, searchParams }: PageProps<"/[ws]/search">) {
  const { ws: slug } = await params;
  const { q = "" } = (await searchParams) as { q?: string };
  const { ws } = await requireWorkspace(slug);
  const r = await search(ws.id, q);
  const total = r.leads.length + r.contacts.length + r.companies.length;
  return (
    <>
      <PageHeader title="Buscar" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          <form role="search" className="flex items-center gap-2 rounded-md border border-border-input px-3 focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/30">
            <Search className="size-5 text-muted" aria-hidden />
            <label htmlFor="gq" className="sr-only">
              Buscar leads, contatos e empresas
            </label>
            <input id="gq" name="q" defaultValue={q} autoFocus placeholder="Nome, telefone ou #número do lead" className="h-11 flex-1 bg-transparent text-md outline-none" />
          </form>
          {q.trim().length >= 2 && total === 0 && <EmptyState icon={Search} title="Nada encontrado" text={`Nenhum resultado para “${q}”.`} />}
          {q.trim().length < 2 && <p className="mt-4 text-sm text-muted">Digite pelo menos 2 letras e tecle Enter.</p>}
          <Group title="Negócios" icon={Columns3} items={r.leads.map((l) => ({ id: l.id, href: `/${slug}/leads/${l.id}`, title: leadTitle(l), sub: `#${l.number}` }))} />
          <Group
            title="Contatos"
            icon={Contact}
            items={r.contacts.map((c) => {
              const p = c.identities.find((i) => i.kind === "phone");
              return { id: c.id, href: `/${slug}/contacts/${c.id}`, title: c.name, sub: p ? phone(p.value) : "" };
            })}
          />
          <Group title="Empresas" icon={Building2} items={r.companies.map((c) => ({ id: c.id, href: `/${slug}/companies/${c.id}`, title: c.name, sub: "" }))} />
        </div>
      </div>
    </>
  );
}

function Group({ title, icon: Icon, items }: { title: string; icon: typeof Search; items: { id: string; href: string; title: string; sub: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="mb-2 flex items-center gap-1.5 text-caps uppercase text-muted">
        <Icon className="size-4" aria-hidden /> {title}
      </h2>
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((i) => (
          <li key={i.id}>
            <Link href={i.href} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface">
              <span className="min-w-0 truncate text-base text-fg">{i.title}</span>
              <span className="shrink-0 text-sm text-muted">{i.sub}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
