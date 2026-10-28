import { headers } from "next/headers";
import { listChannels, listLeads, listMessageCodes, listTrackingLinks } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { TrackingManager } from "@/components/settings/tracking";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Rastreamento e UTMs" };

export default async function TrackingPage({ params }: PageProps<"/[ws]/settings/tracking">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [links, channels, leads, codes] = await Promise.all([listTrackingLinks(ws.id), listChannels(ws.id), listLeads(ws.id), listMessageCodes(ws.id)]);
  const stats: Record<string, { leads: number; won: number; cents: number }> = {};
  for (const l of leads) {
    const a = l.attribution;
    if (!a) continue;
    // o lead conta para cada link por onde passou (1º contato e o atual), uma vez só por link
    const ids = new Set([a, a.first].flatMap((x) => (x ? [x.link_id ?? links.find((k) => k.name === x.link_name)?.id] : [])).filter((x): x is string => !!x));
    for (const id of ids) {
      const s = (stats[id] ??= { leads: 0, won: 0, cents: 0 });
      s.leads++;
      if (l.stage.kind === "won") {
        s.won++;
        s.cents += l.priceCents;
      }
    }
  }
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title="Rastreamento e UTMs" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <TrackingManager slug={slug} origin={origin} links={links} stats={stats} codes={codes} chatKey={channels.find((c) => c.kind === "webchat")?.publicKey ?? null} />
    </>
  );
}
