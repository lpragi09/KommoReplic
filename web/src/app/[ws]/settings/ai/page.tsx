import { getAccess, getAgent, getAiWallet } from "@/data";
import { agentAllowed } from "@/data/ai/runner";
import { requireWorkspace } from "@/data/session";
import { aiAvailable } from "@/lib/ai-agent";
import { PageHeader } from "@/components/shell/page-header";
import { AgentSettings } from "@/components/settings/agent";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Agente de IA" };

export default async function AgentPage({ params }: PageProps<"/[ws]/settings/ai">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [agent, access, wallet] = await Promise.all([getAgent(ws.id), getAccess(ws.id), getAiWallet(ws.id)]);
  const allowed = agentAllowed(access, wallet.extra, !!wallet.ownKeyHint);
  return (
    <>
      <PageHeader title="Agente de IA" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <AgentSettings slug={slug} company={ws.name} agent={agent} hasKey={aiAvailable() || !!wallet.ownKeyHint} blocked={!allowed} wallet={wallet} />
    </>
  );
}
