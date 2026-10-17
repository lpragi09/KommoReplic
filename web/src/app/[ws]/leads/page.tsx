import Link from "next/link";
import { Bot, Columns3 } from "@/components/ui/icons";
import { getBoard, listLeads, listLossReasons, listUsers, type LeadFilter } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, money, when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { Board, stageBar } from "@/components/pipeline/kanban";
import { LeadsToolbar } from "@/components/pipeline/toolbar";
import { NewLeadButton } from "@/components/pipeline/new-lead";
import { LeadsViews } from "@/components/pipeline/views";
import { Avatar, EmptyState, Tag } from "@/components/ui/bits";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

type SP = { pipeline?: string; view?: string; q?: string; owner?: string; task?: string; tag?: string };

export default async function LeadsPage({ params, searchParams }: PageProps<"/[ws]/leads">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as SP;
  const { ws } = await requireWorkspace(slug);
  const filter: LeadFilter = { q: sp.q, owner: sp.owner, tag: sp.tag, task: sp.task === "none" || sp.task === "late" ? sp.task : undefined };
  const [board, users, lossReasons] = await Promise.all([getBoard(ws.id, sp.pipeline, filter), listUsers(ws.id), listLossReasons(ws.id)]);
  const firstOpen = board.columns.find((c) => c.stage.kind === "open")!.stage;
  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? "Sem responsável";

  return (
    <>
      <PageHeader
        title="Funil de vendas"
        actions={
          <>
            <Link
              href={`/${slug}/automations`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[linear-gradient(135deg,#0b1220,#1e293b)] px-4 text-sm font-semibold uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_8px_18px_-10px_rgba(14,26,58,.8)] transition-[filter,transform] duration-fast hover:brightness-125 active:scale-[.98]"
            >
              <Bot className="size-4 text-[#7aa2ff]" aria-hidden /> Automatize
            </Link>
            <NewLeadButton slug={slug} pipelineId={board.pipeline.id} stages={board.columns.map((c) => c.stage).filter((s) => s.kind === "open")} defaultStageId={firstOpen.id} />
          </>
        }
      >
        <LeadsToolbar slug={slug} pipelines={board.pipelines} users={users} pipelineId={board.pipeline.id} />
      </PageHeader>

      <LeadsViews
        list={<ListView slug={slug} wsId={ws.id} pipelineId={board.pipeline.id} filter={filter} userName={userName} />}
        kanban={
          <>
            {board.columns.every((c) => c.count === 0) && board.incoming.length === 0 && !sp.q && !sp.owner && !sp.task && (
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-accent-soft px-4 py-2.5 text-sm">
                <Columns3 className="size-4 text-accent" aria-hidden />
                <p className="text-fg">
                  <strong>Seu funil está vazio.</strong> Crie o primeiro lead pelo botão “Novo lead”, ou conecte o chat do site para receber contatos automaticamente.
                </p>
                <Link href={`/${slug}/settings/channels`} className="font-medium text-accent-text underline">
                  Conectar canal
                </Link>
              </div>
            )}
            <Board
              slug={slug}
              pipelineId={board.pipeline.id}
              columns={board.columns}
              incoming={board.incoming}
              lossReasons={lossReasons}
              users={users}
              linkTargets={board.columns.flatMap((c) => c.leads).map((l) => ({ id: l.id, title: `${leadTitle(l)} · #${l.number}` }))}
            />
          </>
        }
      />
    </>
  );
}

async function ListView({
  slug,
  wsId,
  pipelineId,
  filter,
  userName,
}: {
  slug: string;
  wsId: string;
  pipelineId: string;
  filter: Parameters<typeof listLeads>[1];
  userName: (id: string | null) => string;
}) {
  const leads = await listLeads(wsId, { ...filter, pipelineId });
  if (leads.length === 0) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState icon={Columns3} title="Nenhum lead encontrado" text="Ajuste a busca ou os filtros." />
      </div>
    );
  }
  const total = leads.reduce((s, l) => s + l.priceCents, 0);
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <caption className="sr-only">Leads do funil</caption>
        <thead className="sticky top-0 bg-surface text-caps uppercase text-muted">
          <tr className="h-10 border-b border-border">
            <th scope="col" className="px-4 font-semibold">Lead</th>
            <th scope="col" className="px-4 font-semibold">Etapa</th>
            <th scope="col" className="px-4 font-semibold">Contato</th>
            <th scope="col" className="px-4 text-right font-semibold">Valor</th>
            <th scope="col" className="px-4 font-semibold">Responsável</th>
            <th scope="col" className="px-4 font-semibold">Próxima tarefa</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="h-11 border-b border-border text-base hover:bg-surface">
              <td className="max-w-80 px-4">
                <Link href={`/${slug}/leads/${l.id}`} className="block truncate font-medium text-fg hover:text-accent-text hover:underline">
                  {leadTitle(l)}
                </Link>
                {l.tags.length > 0 && (
                  <span className="mt-0.5 flex gap-1">
                    {l.tags.slice(0, 3).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </span>
                )}
              </td>
              <td className="px-4">
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className={cn("size-2.5 rounded-pill", stageBar[l.stage.color])} aria-hidden />
                  {l.stage.name}
                </span>
              </td>
              <td className="max-w-48 truncate px-4 text-sm text-muted">{l.mainContact?.name ?? "—"}</td>
              <td className="px-4 text-right font-semibold tabular-nums">{money(l.priceCents)}</td>
              <td className="px-4">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Avatar name={userName(l.responsibleUserId)} size={24} />
                  {userName(l.responsibleUserId)}
                </span>
              </td>
              <td className={cn("px-4 text-sm", l.taskState === "late" ? "text-danger" : l.taskState === "none" ? "text-warning" : "text-muted")}>
                {l.closestTaskAt ? when(l.closestTaskAt) : "Sem tarefa"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="h-10 text-sm text-muted">
            <td className="px-4" colSpan={3}>
              {leads.length} leads
            </td>
            <td className="px-4 text-right font-semibold text-fg tabular-nums">{money(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
