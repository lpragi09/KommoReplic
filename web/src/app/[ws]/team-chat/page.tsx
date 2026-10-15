import Link from "next/link";
import { listTeamMessages } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { TeamChat } from "@/components/team/team-chat";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Chat da equipe" };

export default async function TeamChatPage({ params }: PageProps<"/[ws]/team-chat">) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  const messages = await listTeamMessages(ws.id);
  return (
    <>
      <PageHeader title="Chat da equipe" crumbs={[{ label: "Caixa de entrada", href: `/${slug}/inbox` }]}>
        <p className="hidden text-sm text-muted md:block">Só a equipe vê. Clientes ficam na <Link href={`/${slug}/inbox`} className="text-accent-text underline">Caixa de entrada</Link>.</p>
      </PageHeader>
      <TeamChat slug={slug} meId={user.id} meName={user.name} messages={messages} />
    </>
  );
}
