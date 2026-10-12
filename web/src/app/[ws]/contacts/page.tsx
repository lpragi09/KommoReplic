import Link from "next/link";
import { Contact, Search } from "lucide-react";
import { listContacts } from "@/data";
import { requireWorkspace } from "@/data/session";
import { phone } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar, EmptyState } from "@/components/ui/bits";
import { ListsTabs, NewContactButton } from "@/components/lists/lists";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export default async function ContactsPage({ params, searchParams }: PageProps<"/[ws]/contacts">) {
  const { ws: slug } = await params;
  const { q = "" } = (await searchParams) as { q?: string };
  const { ws } = await requireWorkspace(slug);
  const contacts = await listContacts(ws.id, q);
  return (
    <>
      <PageHeader title="Contatos" actions={<NewContactButton slug={slug} />}>
        <ListsTabs slug={slug} active="contacts" />
        <form role="search" className="flex w-full items-center gap-2 rounded-sm border border-border-input px-2 focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/30 sm:w-64">
          <Search className="size-4 text-muted" aria-hidden />
          <label htmlFor="cq" className="sr-only">
            Buscar contatos
          </label>
          <input id="cq" name="q" defaultValue={q} autoComplete="off" placeholder="Nome ou telefone…" className="h-9 flex-1 bg-transparent text-base outline-none" />
        </form>
      </PageHeader>
      {contacts.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <EmptyState
            icon={Contact}
            title={q ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
            text={q ? "Tente outro nome ou número." : "Contatos aparecem aqui quando você cria leads ou recebe mensagens."}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">Contatos</caption>
            <thead className="sticky top-0 bg-surface text-caps uppercase text-muted">
              <tr className="h-10 border-b border-border">
                <th scope="col" className="px-4 font-semibold">Nome</th>
                <th scope="col" className="px-4 font-semibold">Telefone / email</th>
                <th scope="col" className="px-4 font-semibold">Empresa</th>
                <th scope="col" className="px-4 font-semibold">Negócios</th>
                <th scope="col" className="px-4 font-semibold">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const main = c.identities.find((i) => i.kind === "phone") ?? c.identities.find((i) => i.kind === "email");
                return (
                  <tr key={c.id} className="h-12 border-b border-border hover:bg-surface">
                    <td className="max-w-72 px-4">
                      <Link href={`/${slug}/contacts/${c.id}`} className="flex items-center gap-2 font-medium text-fg hover:underline">
                        <Avatar name={c.name} size={24} />
                        <span className="truncate">{c.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 text-sm text-muted">{main ? (main.kind === "phone" ? phone(main.value) : main.value) : "—"}</td>
                    <td className="px-4 text-sm">
                      {c.company ? (
                        <Link href={`/${slug}/companies/${c.company.id}`} className="hover:underline">
                          {c.company.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 text-sm tabular-nums">{c.leadCount}</td>
                    <td className="px-4 text-sm text-muted">{c.owner ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
