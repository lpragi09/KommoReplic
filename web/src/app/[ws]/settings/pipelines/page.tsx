import Link from "next/link";
import { listPipelines } from "@/data";
import { requireWorkspace } from "@/data/session";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { stageBar } from "@/lib/stage-colors";

export const metadata = { title: "Funis e etapas" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export default async function PipelinesSettings({ params }: PageProps<"/[ws]/settings/pipelines">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const pipelines = await listPipelines(ws.id);
  return (
    <>
      <PageHeader title="Funis e etapas" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          <p className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-sm text-fg">
            Crie, renomeie e apague funis e etapas direto no{" "}
            <Link href={`/${slug}/leads`} className="font-medium text-accent-text underline">
              funil
            </Link>
            : o botão <strong>⋯</strong> ao lado do nome do funil e o <strong>⋯</strong> no topo de cada etapa. A coluna <strong>+ Nova etapa</strong> fica no fim.
          </p>
          {pipelines.map((p) => (
            <section key={p.id} className="mb-4 rounded-md border border-border" aria-label={p.name}>
              <h2 className="border-b border-border px-4 py-2 font-medium text-fg">{p.name}</h2>
              <ol className="divide-y divide-border">
                {[...p.stages]
                  .sort((a, b) => a.sort - b.sort)
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className={cn("size-3 rounded-pill", stageBar[s.color])} aria-hidden />
                      <span className="flex-1 text-fg">{s.name}</span>
                      {s.kind !== "open" && <span className="text-xs text-muted">fixa</span>}
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
