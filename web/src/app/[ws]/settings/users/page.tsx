import { listMembers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { TeamManager } from "@/components/settings/team";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Equipe e permissões" };

export default async function UsersPage({ params }: PageProps<"/[ws]/settings/users">) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  const { roles, members } = await listMembers(ws.id);
  const canManage = !!members.find((m) => m.userId === user.id)?.isAdmin;
  return (
    <>
      <PageHeader title="Equipe e permissões" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <TeamManager slug={slug} roles={roles} members={members} meId={user.id} canManage={canManage} />
    </>
  );
}
