import Link from "next/link";
import { At, Building2, Contact, Phone, WhatsappLogo, InstagramLogo, Globe, Briefcase } from "@/components/ui/icons";
import { listCompanies, listContacts } from "@/data";
import { requireWorkspace } from "@/data/session";
import { phone } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/bits";
import { ContactsCsvButtons, ListsTabs, NewContactButton, SearchPill } from "@/components/lists/lists";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Contatos" };

const idIcon = { phone: Phone, email: At, whatsapp: WhatsappLogo, instagram: InstagramLogo, webchat: Globe } as const;
/** o id do visitante e o do Instagram são internos: na tela vale o nome do canal */
const idText = (kind: keyof typeof idIcon, value: string) =>
  kind === "phone" || kind === "whatsapp" ? phone(value) : kind === "webchat" ? "Chat do site" : kind === "instagram" ? "Instagram" : value;

export default async function ContactsPage({ params, searchParams }: PageProps<"/[ws]/contacts">) {
  const { ws: slug } = await params;
  const { q = "" } = (await searchParams) as { q?: string };
  const { ws } = await requireWorkspace(slug);
  const [contacts, companies] = await Promise.all([listContacts(ws.id, q), listCompanies(ws.id)]);
  const withDeals = contacts.filter((c) => c.leadCount > 0).length;
  const withCompany = contacts.filter((c) => c.company).length;

  return (
    <>
      <PageHeader
        title="Contatos"
        actions={
          <>
            <ContactsCsvButtons slug={slug} />
            <NewContactButton slug={slug} companies={companies.map((c) => c.name)} />
          </>
        }
      >
        <ListsTabs slug={slug} active="contacts" counts={{ contacts: contacts.length, companies: companies.length }} />
        <SearchPill id="cq" placeholder="Buscar nome ou telefone…" defaultValue={q} />
      </PageHeader>
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6">
          {!q && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Contact, label: "Pessoas", value: contacts.length, tone: "from-[#3b82f6] to-[var(--accent)]" },
                { icon: Briefcase, label: "Com negócio aberto ou fechado", value: withDeals, tone: "from-[#34d399] to-[#059669]" },
                { icon: Building2, label: "Ligadas a uma empresa", value: withCompany, tone: "from-[#a78bfa] to-[#6d28d9]" },
              ].map((k) => (
                <div key={k.label} className="flex items-center gap-4 rounded-xl bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]">
                  <span className={`grid size-11 place-items-center rounded-lg bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)] ${k.tone}`} aria-hidden>
                    <k.icon className="size-5" weight="fill" />
                  </span>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-fg">{k.value}</p>
                    <p className="text-sm text-muted">{k.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl bg-bg px-6 py-14 text-center shadow-[0_0_0_1px_var(--border)]">
              <span className="grid size-14 place-items-center rounded-xl bg-accent-soft text-accent" aria-hidden>
                <Contact className="size-7" weight="fill" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-fg">{q ? "Nenhum contato encontrado" : "Nenhum contato ainda"}</h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                {q ? "Tente outro nome ou número." : "Os contatos aparecem sozinhos quando alguém manda mensagem ou quando você cria um lead. Também dá para cadastrar à mão."}
              </p>
              {!q && (
                <div className="mt-5">
                  <NewContactButton slug={slug} companies={companies.map((c) => c.name)} label="Cadastrar o primeiro contato" />
                </div>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/${slug}/contacts/${c.id}`}
                    className="group flex h-full flex-col gap-3 rounded-xl bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)] transition-[box-shadow,transform] duration-fast hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--border-input),0_14px_30px_-16px_rgba(29,78,216,.45)]"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-fg group-hover:text-accent-text">{c.name}</p>
                        <p className="flex items-center gap-1 truncate text-sm text-muted">
                          {c.company ? (
                            <>
                              <Building2 className="size-3.5 shrink-0" aria-hidden /> {c.company.name}
                            </>
                          ) : (
                            "Sem empresa"
                          )}
                        </p>
                      </div>
                      {c.leadCount > 0 && (
                        <span className="shrink-0 rounded-pill bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                          {c.leadCount} {c.leadCount === 1 ? "negócio" : "negócios"}
                        </span>
                      )}
                    </div>
                    {c.identities.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {c.identities.slice(0, 3).map((i) => {
                          const Icon = idIcon[i.kind] ?? Phone;
                          return (
                            <li key={i.kind + i.value} className="inline-flex max-w-full items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-xs text-fg shadow-[inset_0_0_0_1px_var(--border)]">
                              <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                              <span className="truncate">{idText(i.kind, i.value)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {c.owner && <p className="mt-auto text-xs text-muted">Responsável: {c.owner}</p>}
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
