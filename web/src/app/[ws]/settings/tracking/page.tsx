import { headers } from "next/headers";
import { listChannels, listTrackingLinks } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { TrackingManager } from "@/components/settings/tracking";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Rastreamento e UTMs" };

export default async function TrackingPage({ params }: PageProps<"/[ws]/settings/tracking">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [links, channels] = await Promise.all([listTrackingLinks(ws.id), listChannels(ws.id)]);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title="Rastreamento e UTMs" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <TrackingManager slug={slug} origin={origin} links={links} chatKey={channels.find((c) => c.kind === "webchat")?.publicKey ?? null} />
    </>
  );
}
