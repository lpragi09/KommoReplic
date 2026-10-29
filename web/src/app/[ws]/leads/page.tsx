import Link from "next/link";
import { Bot, Columns3 } from "@/components/ui/icons";
import { getBoard, listChannels, listLeads, listLossReasons, listMembers, listMessageCodes, listSourceRules, listTrackingLinks, listUsers, type LeadFilter } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, money, when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { Board } from "@/components/pipeline/kanban";
import { stageBar } from "@/lib/stage-colors";
import { LeadsToolbar } from "@/components/pipeline/toolbar";
import { NewLeadButton } from "@/components/pipeline/new-lead";
import { LeadsViews } from "@/components/pipeline/views";
import { SourcesPanel } from "@/components/pipeline/sources";
import { Avatar, EmptyState, Tag } from "@/components/ui/bits";

export const metadata = { title: "Funil de vendas" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

type SP = { pipeline?: string; view?: string; q?: string; owner?: string; task?: string; tag?: string; origin?: string };

export default async function LeadsPage({ params, searchParams }: PageProps<"/[ws]/leads">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as SP;
  const { user, ws } = await requireWorkspace(slug);
  const filter: LeadFilter = { q: sp.q, owner: sp.owner, tag: sp.tag, task: sp.task === "none" || sp.task === "late" ? sp.task : undefined, origin: sp.origin?.slice(0, 60) || undefined };
  const [board, users, lossReasons, channels, rules, links, codes, members] = await Promise.all([
    getBoard(ws.id, sp.pipeline, filter),
    listUsers(ws.id),
    listLossReasons(ws.id),
    listChannels(ws.id),
    listSourceRules(ws.id),
    listTrackingLinks(ws.id),
    listMessageCodes(ws.id),
    listMembers(ws.id),
  ]);
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
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[linear-gradient(135deg,#0b120e,#1b2a22)] px-3 sm:px-4 text-sm font-semibold uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_8px_18px_-10px_rgba(20,28,24,.8)] transition-[filter,transform] duration-fast hover:brightness-125 active:scale-[.98]"
            >
              <Bot className="size-4 text-[#6fd3a5]" aria-hidden /> <span className="sr-only sm:not-sr-only">Automatize</span>
            </Link>
            <NewLeadButton slug={slug} pipelineId={board.pipeline.id} stages={board.columns.map((c) => c.stage).filter((s) => s.kind === "open")} defaultStageId={firstOpen.id} />
          </>
        }
      >
        <LeadsToolbar slug={slug} pipelines={board.pipelines} users={users} pipelineId={board.pipeline.id} origins={board.origins} />
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
              sources={
                <SourcesPanel
                  slug={slug}
                  pipelineId={board.pipeline.id}
                  pipelines={board.pipelines}
                  channels={channels}
                  rules={rules}
                  links={links}
                  codes={codes}
                  isAdmin={!!members.members.find((m) => m.userId === user.id)?.isAdmin}
                />
              }
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
  // resumo por etapa, na ordem do funil
  const byStage = new Map<string, { name: string; color: (typeof leads)[number]["stage"]["color"]; sort: number; n: number; cents: number }>();
  for (const l of leads) {
    const cur = byStage.get(l.stage.id) ?? { name: l.stage.name, color: l.stage.color, sort: l.stage.sort, n: 0, cents: 0 };
    cur.n++;
    cur.cents += l.priceCents;
    byStage.set(l.stage.id, cur);
  }
  const stages = [...byStage.values()].sort((a, b) => a.sort - b.sort);
  /** nome curto do responsável: sem nome no perfil, usa o começo do email */
  const who = (id: string | null) => {
    const n = userName(id);
    return n.includes("@") ? n.split("@")[0] : n;
  };
  const task = (l: (typeof leads)[number]) =>
    l.taskState === "late"
      ? { cls: "bg-danger-soft text-danger", text: `Atrasada · ${when(l.closestTaskAt!)}` }
      : l.taskState === "none"
        ? { cls: "bg-warning-soft text-warning", text: "Sem tarefa" }
        : { cls: "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)]", text: l.closestTaskAt ? when(l.closestTaskAt) : "—" };

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-6">
        {/* resumo */}
        <section aria-label="Resumo" className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="text-sm text-muted">
            <strong className="text-2xl font-semibold tabular-nums text-fg">{leads.length}</strong> {leads.length === 1 ? "lead" : "leads"}
            <span className="mx-2 text-border-input" aria-hidden>
              ·
            </span>
            <strong className="text-2xl font-semibold tabular-nums text-fg">{money(total)}</strong> no total
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {stages.map((st) => (
              <li key={st.name} className="inline-flex items-center gap-1.5 rounded-pill bg-bg px-2.5 py-1 text-xs text-fg shadow-[inset_0_0_0_1px_var(--border)]">
                <span className={cn("size-2 rounded-pill", stageBar[st.color])} aria-hidden />
                {st.name}
                <span className="font-semibold tabular-nums">{st.n}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* tabela (computador) */}
        <div className="hidden overflow-hidden rounded-xl bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Leads do funil</caption>
            <thead className="border-b border-border bg-surface text-xs font-medium text-muted">
              <tr className="h-10">
                <th scope="col" className="pl-5 pr-3 font-medium">Negócio</th>
                <th scope="col" className="px-3 font-medium">Etapa</th>
                <th scope="col" className="px-3 font-medium">Contato</th>
                <th scope="col" className="px-3 text-right font-medium">Valor</th>
                <th scope="col" className="px-3 font-medium">Responsável</th>
                <th scope="col" className="px-3 pr-5 font-medium">Próxima tarefa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((l) => {
                const t = task(l);
                return (
                  <tr key={l.id} className="group relative h-16 text-sm transition-colors duration-fast hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
                    <td className="max-w-80 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-xs font-semibold text-accent-text" aria-hidden>
                          {leadTitle(l).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/${slug}/leads/${l.id}`} className="block truncate font-semibold text-fg after:absolute after:inset-0 after:content-[''] group-hover:text-accent-text">
                            {leadTitle(l)}
                          </Link>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                            #{l.number}
                            {l.tags.slice(0, 2).map((tg) => (
                              <Tag key={tg}>{tg}</Tag>
                            ))}
                            {l.tags.length > 2 && <span>+{l.tags.length - 2}</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-[inset_0_0_0_1px_var(--border)]">
                        <span className={cn("size-2 rounded-pill", stageBar[l.stage.color])} aria-hidden />
                        {l.stage.name}
                      </span>
                    </td>
                    <td className="max-w-48 truncate px-3 text-muted">{l.mainContact?.name ?? "Sem contato"}</td>
                    <td className="px-3 text-right font-semibold tabular-nums text-fg">{money(l.priceCents)}</td>
                    <td className="px-3">
                      <span className="inline-flex max-w-44 items-center gap-2">
                        <Avatar name={userName(l.responsibleUserId)} size={24} />
                        <span className="truncate">{who(l.responsibleUserId)}</span>
                      </span>
                    </td>
                    <td className="px-3 pr-5">
                      <span className={cn("inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium", t.cls)} suppressHydrationWarning>
                        {t.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* cartões (celular) */}
        <ul className="flex flex-col gap-2 md:hidden">
          {leads.map((l) => {
            const t = task(l);
            return (
              <li key={l.id}>
                <Link href={`/${slug}/leads/${l.id}`} className="flex flex-col gap-2 rounded-xl bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] active:scale-[.99]">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-fg">{leadTitle(l)}</p>
                      <p className="truncate text-xs text-muted">
                        #{l.number} · {l.mainContact?.name ?? "Sem contato"}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums text-fg">{money(l.priceCents)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-[inset_0_0_0_1px_var(--border)]">
                      <span className={cn("size-2 rounded-pill", stageBar[l.stage.color])} aria-hidden />
                      {l.stage.name}
                    </span>
                    <span className={cn("inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium", t.cls)} suppressHydrationWarning>
                      {t.text}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
                      <Avatar name={userName(l.responsibleUserId)} size={20} />
                      {who(l.responsibleUserId)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
