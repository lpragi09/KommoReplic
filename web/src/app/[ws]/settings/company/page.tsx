import { listMembers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { CompanyForm } from "@/components/settings/account";
import { PhotoPicker } from "@/components/settings/photo";

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
          <section aria-label="Logo da empresa" className="flex items-center gap-4 rounded-xl bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
            <PhotoPicker slug={slug} kind="logo" current={ws.logo ?? null} label="Trocar o logo da empresa" className="size-16 rounded-lg bg-accent" fallback={<span className="text-2xl font-bold text-on-accent">{ws.name.slice(0, 1).toUpperCase()}</span>} />
            <div>
              <h2 className="text-base font-semibold text-fg">Logo da empresa</h2>
              <p className="text-sm text-muted">Aparece no menu e nas configurações. Sua foto pessoal fica em Meu perfil.</p>
            </div>
          </section>
          <CompanyForm slug={slug} ws={{ name: ws.name, phone: ws.phone ?? null, timezone: ws.timezone, currency: ws.currency, slug: ws.slug }} canEdit={canEdit} />
        </div>
      </div>
    </>
  );
}
