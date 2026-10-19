import Link from "next/link";
import { getAccess, listBroadcasts, listPipelines, listTemplates } from "@/data";
import { limitsOf, upgradeFor } from "@/lib/plans";
import { Megaphone } from "@/components/ui/icons";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Broadcasts } from "@/components/team/broadcasts";
import { emailOn } from "@/lib/email";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Disparos" };

export default async function BroadcastsPage({ params }: PageProps<"/[ws]/broadcasts">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [pipelines, templates, history, access] = await Promise.all([listPipelines(ws.id), listTemplates(ws.id), listBroadcasts(ws.id), getAccess(ws.id)]);
  const allowed = limitsOf(access.plan).broadcasts;
  return (
    <>
      <PageHeader title="Disparos" crumbs={[{ label: "Automações", href: `/${slug}/automations` }]} />
      {allowed ? (
        <Broadcasts slug={slug} pipelines={pipelines} templates={templates} history={history} emailReady={emailOn()} />
      ) : (
        <div className="grid flex-1 place-items-center bg-surface p-6">
          <div className="max-w-md rounded-xl bg-bg p-8 text-center shadow-[0_0_0_1px_var(--border),0_20px_40px_-24px_rgba(20,28,24,.4)]">
            <span className="fx-tile mx-auto size-12" aria-hidden>
              <Megaphone className="size-6" weight="fill" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-fg">Disparos estão no plano {upgradeFor((x) => x.broadcasts)}</h2>
            <p className="mt-1 text-sm text-muted">Mande uma mensagem para todos os leads de uma etapa ou etiqueta de uma vez, com o nome de cada um.</p>
            <Link href={`/${slug}/settings/billing`} className="mt-5 inline-flex h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover">
              Ver planos
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
