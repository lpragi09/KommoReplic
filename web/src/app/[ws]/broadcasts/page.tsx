import { listBroadcasts, listPipelines, listTemplates } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Broadcasts } from "@/components/team/broadcasts";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Disparos" };

export default async function BroadcastsPage({ params }: PageProps<"/[ws]/broadcasts">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [pipelines, templates, history] = await Promise.all([listPipelines(ws.id), listTemplates(ws.id), listBroadcasts(ws.id)]);
  return (
    <>
      <PageHeader title="Disparos" crumbs={[{ label: "Automações", href: `/${slug}/automations` }]} />
      <Broadcasts slug={slug} pipelines={pipelines} templates={templates} history={history} />
    </>
  );
}
