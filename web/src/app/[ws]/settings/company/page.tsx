import { listMembers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { CompanyForm } from "@/components/settings/account";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Dados da empresa" };

export default async function CompanySettings({ params }: PageProps<"/[ws]/settings/company">) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  const canEdit = !!(await listMembers(ws.id)).members.find((m) => m.userId === user.id)?.isAdmin;
  return (
    <>
      <PageHeader title="Dados da empresa" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
          <CompanyForm slug={slug} ws={{ name: ws.name, phone: ws.phone ?? null, timezone: ws.timezone, currency: ws.currency, slug: ws.slug }} canEdit={canEdit} />
        </div>
      </div>
    </>
  );
}
