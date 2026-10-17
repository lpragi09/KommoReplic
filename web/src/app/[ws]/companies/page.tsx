import Link from "next/link";
import { ArrowRight, Briefcase, Building2, Contact } from "@/components/ui/icons";
import { listCompanies, listContacts } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { ListsTabs, NewCompanyButton } from "@/components/lists/lists";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Empresas" };

export default async function CompaniesPage({ params }: PageProps<"/[ws]/companies">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [companies, contacts] = await Promise.all([listCompanies(ws.id), listContacts(ws.id)]);
  return (
    <>
      <PageHeader title="Contatos" actions={<NewCompanyButton slug={slug} />}>
        <ListsTabs slug={slug} active="companies" counts={{ contacts: contacts.length, companies: companies.length }} />
      </PageHeader>
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6">
          {/* o que é uma empresa aqui */}
          <section aria-label="O que são empresas" className="fx-aurora overflow-hidden rounded-xl p-6">
            <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-night-muted">Para quem vende para empresas</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-on-night">Junte as pessoas e os negócios de um mesmo cliente</h2>
                <p className="mt-2 max-w-xl text-sm text-on-night-muted">
                  Quando o cliente é uma empresa, você costuma falar com várias pessoas dela. Aqui fica tudo junto: quem trabalha lá, os negócios abertos e o histórico.
                </p>
              </div>
              {/* exemplo visual */}
              <div className="rounded-lg bg-[color-mix(in_srgb,var(--on-night)_8%,transparent)] p-4 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-night)_12%,transparent)] sm:min-w-80" aria-hidden>
                <p className="flex items-center gap-2 text-sm font-semibold text-on-night">
                  <span className="grid size-8 place-items-center rounded-md bg-accent text-on-accent">
                    <Building2 className="size-4" weight="fill" />
                  </span>
                  Clínica Vida
                </p>
                <div className="mt-3 flex flex-col gap-1.5 border-l border-[color-mix(in_srgb,var(--on-night)_20%,transparent)] pl-4 text-xs text-on-night-muted">
                  <span className="flex items-center gap-1.5">
                    <Contact className="size-3.5" /> Dra. Marina · dona
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Contact className="size-3.5" /> Paulo · recepção
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="size-3.5" /> 2 implantes · R$ 12.500
                  </span>
                </div>
              </div>
            </div>
          </section>

          {companies.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl bg-bg px-6 py-12 text-center shadow-[0_0_0_1px_var(--border)]">
              <span className="grid size-14 place-items-center rounded-xl bg-accent-soft text-accent" aria-hidden>
                <Building2 className="size-7" weight="fill" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-fg">Nenhuma empresa ainda</h2>
              <p className="mt-1 max-w-md text-sm text-muted">Crie aqui, ou escreva o nome da empresa ao cadastrar um contato: ela é criada junto e já fica ligada a ele.</p>
              <div className="mt-5">
                <NewCompanyButton slug={slug} label="Criar a primeira empresa" />
              </div>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/${slug}/companies/${c.id}`}
                    className="group flex h-full items-center gap-4 rounded-xl bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)] transition-[box-shadow,transform] duration-fast hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--border-input),0_14px_30px_-16px_rgba(29,78,216,.45)]"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[linear-gradient(145deg,#3b82f6,var(--accent))] text-lg font-bold text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.3)]" aria-hidden>
                      {c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-fg group-hover:text-accent-text">{c.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Contact className="size-3.5" aria-hidden /> {c.contactCount} {c.contactCount === 1 ? "pessoa" : "pessoas"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="size-3.5" aria-hidden /> {c.leadCount} {c.leadCount === 1 ? "negócio" : "negócios"}
                        </span>
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
