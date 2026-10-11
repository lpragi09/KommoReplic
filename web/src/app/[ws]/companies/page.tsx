import Link from "next/link";
import { Building2 } from "lucide-react";
import { listCompanies } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/bits";
import { ListsTabs } from "@/components/lists/lists";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export default async function CompaniesPage({ params }: PageProps<"/[ws]/companies">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const companies = await listCompanies(ws.id);
  return (
    <>
      <PageHeader title="Empresas">
        <ListsTabs slug={slug} active="companies" />
      </PageHeader>
      {companies.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <EmptyState icon={Building2} title="Nenhuma empresa ainda" text="Empresas agrupam contatos e negócios de um mesmo cliente." />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[480px] text-left">
            <caption className="sr-only">Empresas</caption>
            <thead className="sticky top-0 bg-surface text-caps uppercase text-muted">
              <tr className="h-10 border-b border-border">
                <th scope="col" className="px-4 font-semibold">Empresa</th>
                <th scope="col" className="px-4 font-semibold">Contatos</th>
                <th scope="col" className="px-4 font-semibold">Negócios</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="h-12 border-b border-border hover:bg-surface">
                  <td className="px-4">
                    <Link href={`/${slug}/companies/${c.id}`} className="font-medium text-fg hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 text-sm tabular-nums">{c.contactCount}</td>
                  <td className="px-4 text-sm tabular-nums">{c.leadCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
