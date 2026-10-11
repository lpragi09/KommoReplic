import { getSubscription } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Billing, DeleteAccount } from "@/components/settings/billing";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)
export const metadata = { title: "Plano e cobrança" };

export default async function BillingPage({ params }: PageProps<"/[ws]/settings/billing">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const sub = await getSubscription(ws.id);
  return (
    <>
      <PageHeader title="Plano e cobrança" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:p-6">
          <Billing slug={slug} sub={sub} />
          <DeleteAccount />
        </div>
      </div>
    </>
  );
}
