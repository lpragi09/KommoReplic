import { listUsers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { PhotoPicker } from "@/components/settings/photo";
import { ProfileForms } from "@/components/settings/account";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Meu perfil" };

export default async function ProfilePage({ params }: PageProps<"/[ws]/settings/profile">) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  const me = (await listUsers(ws.id)).find((u) => u.id === user.id);
  const name = me?.name || user.name || user.email;
  const initials = name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <>
      <PageHeader title="Meu perfil" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
          <section className="flex flex-wrap items-center gap-6 rounded-xl bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
            <PhotoPicker
              slug={slug}
              kind="me"
              current={me?.avatar ?? null}
              label="Trocar minha foto"
              className="size-28 rounded-pill bg-accent-soft shadow-[0_0_0_4px_var(--bg),0_0_0_6px_var(--accent)]"
              fallback={<span className="text-3xl font-semibold text-accent-text">{initials}</span>}
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold text-fg">{name}</h2>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <p className="mt-3 text-sm text-muted">Clique na foto para trocar. Ela aparece para a equipe no lugar das suas iniciais: nos cartões, nas conversas e no chat da equipe.</p>
            </div>
          </section>
          <ProfileForms slug={slug} name={me?.name || user.name || ""} email={user.email} />
        </div>
      </div>
    </>
  );
}
