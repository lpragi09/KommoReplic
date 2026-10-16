import { getAccess, getAgent } from "@/data";
import { requireWorkspace } from "@/data/session";
import { aiAvailable } from "@/lib/ai-agent";
import { limitsOf, upgradeFor } from "@/lib/plans";
import { PageHeader } from "@/components/shell/page-header";
import { AgentSettings } from "@/components/settings/agent";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Agente de IA" };

export default async function AgentPage({ params }: PageProps<"/[ws]/settings/ai">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [agent, access] = await Promise.all([getAgent(ws.id), getAccess(ws.id)]);
  const allowed = limitsOf(access.plan).aiAgent;
  return (
    <>
      <PageHeader title="Agente de IA" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <AgentSettings slug={slug} company={ws.name} agent={agent} hasKey={aiAvailable()} blockedPlan={allowed ? null : upgradeFor((x) => x.aiAgent)} />
    </>
  );
}
