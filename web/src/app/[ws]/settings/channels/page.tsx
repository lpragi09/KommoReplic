import { headers } from "next/headers";
import { listChannels, listPipelines } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { ChannelsManager } from "@/components/settings/channels";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Canais" };

export default async function ChannelsPage({ params }: PageProps<"/[ws]/settings/channels">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [channels, pipelines] = await Promise.all([listChannels(ws.id), listPipelines(ws.id)]);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title="Canais" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <ChannelsManager slug={slug} channels={channels} pipelines={pipelines} webhookUrl={`${origin}/api/webhooks/meta`} chatBase={origin} />
    </>
  );
}
