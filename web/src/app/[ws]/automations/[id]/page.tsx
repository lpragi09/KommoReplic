import { notFound } from "next/navigation";
import { getRobot, listChannels, listPipelines, listTemplates, listUsers } from "@/data";
import { DomainError } from "@/data/types";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { RobotEditor } from "@/components/robots/editor";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Robô" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RobotPage({ params }: PageProps<"/[ws]/automations/[id]">) {
  const { ws: slug, id } = await params;
  if (!UUID.test(id)) notFound();
  const { ws } = await requireWorkspace(slug);
  const found = await getRobot(ws.id, id).catch((e) => {
    if (e instanceof DomainError) return null;
    throw e;
  });
  if (!found) notFound();
  const [pipelines, users, templates, channels] = await Promise.all([listPipelines(ws.id), listUsers(ws.id), listTemplates(ws.id), listChannels(ws.id)]);
  const { robot, runs } = found;
  const { id: _id, workspaceId: _w, runCount: _c, lastRunAt: _l, createdAt: _a, ...initial } = robot;
  return (
    <>
      <PageHeader title={robot.name} crumbs={[{ label: "Automações", href: `/${slug}/automations` }]} />
      <RobotEditor
        key={robot.id}
        slug={slug}
        robotId={robot.id}
        initial={initial}
        pipelines={pipelines}
        users={users}
        templates={templates}
        runs={runs}
        connected={channels.filter((c) => c.status === "connected").map((c) => c.kind)}
      />
    </>
  );
}
