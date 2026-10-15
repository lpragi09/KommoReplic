import Link from "next/link";
import { listPipelines, listRobots } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { RobotsBoard } from "@/components/robots/board";
import { ChatText, Megaphone, Plus } from "@/components/ui/icons";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Automações" };

export default async function AutomationsPage({ params }: PageProps<"/[ws]/automations">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [pipelines, robots] = await Promise.all([listPipelines(ws.id), listRobots(ws.id)]);
  return (
    <>
      <PageHeader
        title="Automações"
        actions={
          <>
            <Link href={`/${slug}/broadcasts`} className="inline-flex h-9 items-center gap-2 rounded-sm px-3 text-base text-fg hover:bg-surface">
              <Megaphone className="size-4" aria-hidden /> Disparos
            </Link>
            <Link href={`/${slug}/templates`} className="inline-flex h-9 items-center gap-2 rounded-sm px-3 text-base text-fg hover:bg-surface">
              <ChatText className="size-4" aria-hidden /> Modelos de mensagem
            </Link>
            <Link
              href={`/${slug}/automations/new`}
              className="fx-shine inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-4 text-base font-medium text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_6px_16px_-6px_rgba(29,78,216,.6)] hover:bg-accent-hover"
            >
              <Plus className="size-4" aria-hidden /> Novo robô
            </Link>
          </>
        }
      />
      <RobotsBoard slug={slug} pipelines={pipelines} robots={robots} />
    </>
  );
}
