import Link from "next/link";
import { InstantLink, LinkGroup } from "@/components/ui/instant-link";
import { connection } from "next/server";
import { getAccess, getAiWallet, getSubscription, getUsageCounts, listCheckoutPayments, listMembers } from "@/data";
import { refreshOpenPayments } from "@/lib/billing-apply";
import { aiAvailable } from "@/lib/ai-agent";
import { PaymentsHistory } from "@/components/settings/payments";
import { requireWorkspace } from "@/data/session";
import { AI_PACKS } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { Billing, DeleteAccount } from "@/components/settings/billing";
import { AiAddons } from "@/components/settings/addons";
import { UsagePanel } from "@/components/settings/usage";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)
export const metadata = { title: "Plano e cobrança" };

const TABS = [
  { v: "plano", label: "Meu plano" },
  { v: "complementos", label: "Complementos" },
  { v: "uso", label: "Uso" },
] as const;

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const packPrices = Object.fromEntries(AI_PACKS.map((p) => [p.key, brl(p.cents)]));

export default async function BillingPage({ params, searchParams }: PageProps<"/[ws]/settings/billing">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { bemvindo?: string; semteste?: string; aba?: string; creditos?: string };
  const tab = TABS.find((t) => t.v === sp.aba)?.v ?? "plano";
  const { user, ws } = await requireWorkspace(slug);
  const [sub, access] = await Promise.all([getSubscription(ws.id), getAccess(ws.id)]);
  return (
    <>
      <PageHeader title="Plano e cobrança" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
          <LinkGroup label="Seções do plano" className="flex gap-1 border-b border-border">
            {TABS.map((t) => (
              <InstantLink key={t.v} href={`/${slug}/settings/billing${t.v === "plano" ? "" : `?aba=${t.v}`}`} active={t.v === tab} className="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-fast" activeClassName="border-accent text-fg" inactiveClassName="border-transparent text-muted hover:text-fg">
                {t.label}
              </InstantLink>
            ))}
          </LinkGroup>
          {tab === "plano" && (
            <>
              <Billing slug={slug} sub={sub} access={access} welcome={sp.semteste ? "no_trial" : sp.bemvindo ? "new" : null} />
              <Payments slug={slug} wsId={ws.id} />
              <DeleteAccount />
            </>
          )}
          {tab === "complementos" && <Addons slug={slug} wsId={ws.id} userId={user.id} bought={!!sp.creditos} />}
          {tab === "uso" && <Usage slug={slug} wsId={ws.id} access={access} />}
        </div>
      </div>
    </>
  );
}

async function Addons({ slug, wsId, userId, bought }: { slug: string; wsId: string; userId: string; bought: boolean }) {
  const [wallet, members] = await Promise.all([getAiWallet(wsId), listMembers(wsId)]);
  const isAdmin = !!members.members.find((m) => m.userId === userId)?.isAdmin;
  return <AiAddons slug={slug} wallet={wallet} prices={packPrices} isAdmin={isAdmin} bought={bought} onSale={aiAvailable()} />;
}

async function Usage({ slug, wsId, access }: { slug: string; wsId: string; access: Awaited<ReturnType<typeof getAccess>> }) {
  const [usage, wallet] = await Promise.all([getUsageCounts(wsId), getAiWallet(wsId)]);
  return <UsagePanel slug={slug} access={access} usage={usage} wallet={wallet} />;
}

/** histórico do checkout; o que está em aberto é conferido no Mercado Pago antes de mostrar */
async function Payments({ slug, wsId }: { slug: string; wsId: string }) {
  const { payments, now } = await loadPayments(wsId);
  return <PaymentsHistory slug={slug} payments={payments} now={now} />;
}

async function loadPayments(wsId: string) {
  await connection();
  const now = Date.now();
  return { payments: await refreshOpenPayments(await listCheckoutPayments(wsId), now), now };
}
