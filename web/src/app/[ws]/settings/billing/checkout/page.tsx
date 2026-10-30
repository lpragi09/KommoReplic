import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getBillingProfile, listMembers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { mpOn } from "@/lib/mercadopago";
import { AI_PACKS, PLAN_PRICES, planCharge, type PriceKey } from "@/lib/plans";
import { PageHeader } from "@/components/shell/page-header";
import { Checkout, type CheckoutItem } from "@/components/settings/checkout";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)
export const metadata = { title: "Pagamento" };

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[ws]/settings/billing/checkout">) {
  await connection(); // dados de cobrança e sessão do Supabase: sempre na hora do pedido
  const { ws: slug } = await params;
  const sp = (await searchParams) as { plano?: string; periodo?: string; pacote?: string };
  const { user, ws } = await requireWorkspace(slug);
  const [members, profile] = await Promise.all([listMembers(ws.id), getBillingProfile(ws.id)]);
  const isAdmin = !!members.members.find((m) => m.userId === user.id)?.isAdmin;

  // o mesmo cálculo do servidor na hora de cobrar (o valor final sai de lá, não desta tela)
  let item: CheckoutItem;
  const pack = AI_PACKS.find((p) => p.key === sp.pacote);
  if (pack) item = { purchase: { kind: "credits", pack: pack.key }, title: `${pack.credits.toLocaleString("pt-BR")} respostas da IA`, detail: "Créditos avulsos, não vencem", cents: pack.cents, maxInstallments: 1 };
  else if (sp.plano && Object.hasOwn(PLAN_PRICES, sp.plano)) {
    const key = sp.plano as PriceKey;
    const period = sp.periodo === "anual" ? "anual" : "mensal";
    const seats = Math.max(1, members.members.length);
    item = {
      purchase: { kind: "plan", plan: key, period },
      title: `Plano ${PLAN_PRICES[key].name} · ${period === "anual" ? "anual" : "mensal"}`,
      detail: `${seats} ${seats === 1 ? "usuário" : "usuários"} · R$ ${period === "anual" ? PLAN_PRICES[key].a : PLAN_PRICES[key].m}/usuário/mês`,
      cents: planCharge(key, period, seats).cents,
      maxInstallments: period === "anual" ? 12 : 1,
    };
  } else redirect(`/${slug}/settings/billing`);

  return (
    <>
      <PageHeader title="Pagamento" crumbs={[{ label: "Plano e cobrança", href: `/${slug}/settings/billing` }]} />
      <Checkout
        slug={slug}
        item={item}
        profile={profile}
        defaultEmail={user.email}
        ready={mpOn()}
        publicKey={process.env.MP_PUBLIC_KEY ?? null}
        isAdmin={isAdmin}
      />
    </>
  );
}
