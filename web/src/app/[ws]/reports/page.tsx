import Link from "next/link";
import { getActivity, getDashboard, getMessageStats, listGoals, listLeads, listLossReasons, listMembers, listPipelines, listRoiReports, listRobots, listUsers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { money } from "@/lib/format";
import { VIA_LABEL } from "@/lib/utm";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import type { ReactNode } from "react";
import { Bot, TrendingDown, TrendingUp, Trophy, Users } from "@/components/ui/icons";
import { Bars, Card, Kpi } from "@/components/reports/ui";
import { ActivityLog, ByActivity, Consolidated, Goals, Messages, Roi, SalesAnalysis } from "@/components/reports/sections";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Estatísticas" };

const SECTIONS = [
  { v: "geral", label: "Visão geral" },
  { v: "vendas", label: "Análise de vendas" },
  { v: "consolidado", label: "Relatório consolidado" },
  { v: "atividades", label: "Por atividades" },
  { v: "registro", label: "Registro de atividade" },
  { v: "metas", label: "Metas" },
  { v: "roi", label: "ROI" },
  { v: "mensagens", label: "Mensagens por canal" },
] as const;
type Section = (typeof SECTIONS)[number]["v"];

const periods = [
  { v: "7", label: "7 dias" },
  { v: "30", label: "30 dias" },
  { v: "90", label: "90 dias" },
  { v: "365", label: "12 meses" },
] as const;

const daysAgo = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

const sourceLabel: Record<string, string> = { manual: "Criado à mão", chat: "Chat / mensagem", call: "Ligação", email: "Email", form: "Formulário", import: "Importação" };

export default async function ReportsPage({ params, searchParams }: PageProps<"/[ws]/reports">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { p?: string; pipeline?: string; aba?: string; mes?: string; por?: string };
  const period = periods.find((p) => p.v === sp.p) ?? periods[1];
  const section: Section = SECTIONS.find((x) => x.v === sp.aba)?.v ?? "geral";
  const { user, ws } = await requireWorkspace(slug);
  const from = daysAgo(Number(period.v));
  const [pipelines, leads, users] = await Promise.all([listPipelines(ws.id), listLeads(ws.id), listUsers(ws.id)]);
  const pipeline = pipelines.find((p) => p.id === sp.pipeline) ?? pipelines[0];
  const inPipe = leads.filter((l) => l.pipelineId === pipeline?.id);
  const label = `nos últimos ${period.label}`;
  const usesPeriod = section !== "metas" && section !== "roi";
  const usesPipeline = section === "geral" || section === "vendas" || section === "consolidado";
  const href = (p: Partial<{ p: string; pipeline: string; aba: string }>) => `/${slug}/reports?${new URLSearchParams({ aba: section, p: period.v, ...(pipeline ? { pipeline: pipeline.id } : {}), ...p })}`;
  const isAdmin = async () => !!(await listMembers(ws.id)).members.find((m) => m.userId === user.id)?.isAdmin;

  let body: ReactNode;
  switch (section) {
    case "vendas":
      body = pipeline ? <SalesAnalysis pipeline={pipeline} leads={inPipe} activity={await getActivity(ws.id, from)} label={label} /> : null;
      break;
    case "consolidado":
      body = <Consolidated leads={inPipe} users={users} from={from} days={Number(period.v)} label={label} />;
      break;
    case "atividades":
      body = <ByActivity users={users} leads={leads} activity={await getActivity(ws.id, from)} from={from} label={label} />;
      break;
    case "registro":
      body = <ActivityLog slug={slug} activity={await getActivity(ws.id, from)} leads={leads} users={users} pipelines={pipelines} />;
      break;
    case "metas": {
      const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
      const [goals, admin] = await Promise.all([listGoals(ws.id, mes), isAdmin()]);
      body = <Goals slug={slug} users={users} leads={leads} goals={goals} month={mes} by={sp.por === "qtd" ? "qtd" : "valor"} canEdit={admin} />;
      break;
    }
    case "roi": {
      const [reports, admin] = await Promise.all([listRoiReports(ws.id), isAdmin()]);
      body = <Roi slug={slug} reports={reports} leads={leads} canEdit={admin} />;
      break;
    }
    case "mensagens":
      body = <Messages stats={await getMessageStats(ws.id, from)} label={label} />;
      break;
    default:
      body = await Overview({ slug, wsId: ws.id, from, period, pipeline, inPipe, users });
  }

  return (
    <>
      <PageHeader title="Estatísticas">
        {usesPeriod && (
          <nav aria-label="Período" className="flex gap-1">
            {periods.map((p) => (
              <Link
                key={p.v}
                href={href({ p: p.v })}
                aria-current={p.v === period.v ? "page" : undefined}
                className={cn("h-8 rounded-pill px-3 text-sm leading-8 transition-colors duration-fast", p.v === period.v ? "bg-inverse-bg text-on-inverse" : "text-muted hover:bg-surface hover:text-fg")}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        )}
        {usesPipeline && pipelines.length > 1 && (
          <nav aria-label="Funil" className="flex gap-1">
            {pipelines.map((p) => (
              <Link key={p.id} href={href({ pipeline: p.id })} aria-current={p.id === pipeline?.id ? "page" : undefined} className={cn("h-8 rounded-sm px-2 text-sm leading-8", p.id === pipeline?.id ? "font-medium text-fg" : "text-muted hover:text-fg")}>
                {p.name}
              </Link>
            ))}
          </nav>
        )}
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col bg-surface lg:flex-row">
        <nav aria-label="Seções das estatísticas" className="shrink-0 overflow-x-auto border-b border-border bg-bg lg:w-56 lg:overflow-visible lg:border-b-0 lg:border-r">
          <p className="hidden px-5 pb-2 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted lg:block">Análise de dados</p>
          <ul className="flex gap-1 p-2 lg:flex-col lg:p-3 lg:pt-0">
            {SECTIONS.map((x) => (
              <li key={x.v}>
                <Link
                  href={href({ aba: x.v })}
                  aria-current={x.v === section ? "page" : undefined}
                  className={cn("block whitespace-nowrap rounded-sm px-3 py-2 text-sm transition-colors duration-fast", x.v === section ? "bg-accent-soft font-medium text-accent-text" : "text-fg hover:bg-surface")}
                >
                  {x.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">{body}</div>
        </div>
      </div>
    </>
  );
}

type Users = Awaited<ReturnType<typeof listUsers>>;
type Leads = Awaited<ReturnType<typeof listLeads>>;
type Pipe = Awaited<ReturnType<typeof listPipelines>>[number];

async function Overview({ slug, wsId, from, period, pipeline, inPipe, users }: { slug: string; wsId: string; from: string; period: (typeof periods)[number]; pipeline: Pipe | undefined; inPipe: Leads; users: Users }) {
  const [reasons, dash, robots] = await Promise.all([
    listLossReasons(wsId),
    getDashboard(wsId, { from }),
    listRobots(wsId).catch(() => []), // antes de rodar a atualização do banco, a tabela de robôs ainda não existe
  ]);
  const created = inPipe.filter((l) => l.createdAt >= from);
  const won = inPipe.filter((l) => l.stage.kind === "won" && l.closedAt && l.closedAt >= from);
  const lost = inPipe.filter((l) => l.stage.kind === "lost" && l.closedAt && l.closedAt >= from);
  const wonCents = won.reduce((s, l) => s + l.priceCents, 0);
  const conversion = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null;
  const avg = won.length ? Math.round(wonCents / won.length) : 0;
  const runs = robots.reduce((s, r) => s + r.runCount, 0);

  const stages = pipeline ? [...pipeline.stages].sort((a, b) => a.sort - b.sort).filter((s) => s.kind === "open") : [];
  const byStage = stages.map((s) => {
    const ls = inPipe.filter((l) => l.stageId === s.id);
    return { name: s.name, count: ls.length, cents: ls.reduce((x, l) => x + l.priceCents, 0) };
  });
  const byOwner = users
    .map((u) => {
      const mine = inPipe.filter((l) => l.responsibleUserId === u.id);
      const w = mine.filter((l) => l.stage.kind === "won" && l.closedAt && l.closedAt >= from);
      return { name: u.name || u.email, active: mine.filter((l) => l.stage.kind === "open").length, won: w.length, cents: w.reduce((x, l) => x + l.priceCents, 0) };
    })
    .sort((a, b) => b.cents - a.cents || b.active - a.active);
  const byReason = reasons
    .map((r) => ({ name: r.name, count: lost.filter((l) => l.lossReasonId === r.id).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const sources = new Map<string, number>();
  for (const l of created) sources.set(l.source, (sources.get(l.source) ?? 0) + 1);
  // campanhas: leads criados no período por fonte/campanha, com o que já virou venda (o Kommo não liga UTM a venda)
  const camp = new Map<string, { leads: number; won: number; cents: number }>();
  for (const l of created) {
    const a = l.attribution;
    const key = a ? [a.utm_source ?? (a.via === "meta_ad" ? "meta" : a.via ? VIA_LABEL[a.via] : "—"), a.utm_campaign ?? a.ad_headline ?? a.link_name].filter(Boolean).join(" · ") : "Sem origem";
    const c = camp.get(key) ?? { leads: 0, won: 0, cents: 0 };
    c.leads += 1;
    if (l.stage.kind === "won") {
      c.won += 1;
      c.cents += l.priceCents;
    }
    camp.set(key, c);
  }
  const byCampaign = [...camp.entries()].map(([name, c]) => ({ name, ...c })).sort((a, b) => b.cents - a.cents || b.leads - a.leads).slice(0, 12);
  const bySource = [...sources.entries()].map(([k, count]) => ({ name: sourceLabel[k] ?? k, count })).sort((a, b) => b.count - a.count);

  return (
    <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Users} label="Leads novos" value={String(created.length)} sub={`nos últimos ${period.label}`} />
            <Kpi icon={Trophy} label="Vendas ganhas" value={money(wonCents)} sub={`${won.length} ${won.length === 1 ? "negócio" : "negócios"} · ticket ${money(avg)}`} tone="success" />
            <Kpi icon={TrendingUp} label="Conversão" value={conversion === null ? "—" : `${conversion}%`} sub="ganhos ÷ fechados no período" />
            <Kpi icon={Bot} label="Robôs" value={String(runs)} sub={`execuções · ${robots.filter((r) => r.active).length} ligados`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Funil agora" sub="Leads abertos em cada etapa">
              <Bars rows={byStage.map((s) => ({ label: s.name, value: s.count, extra: money(s.cents) }))} empty="Nenhum lead aberto neste funil." />
            </Card>
            <Card title="Por responsável" sub={`Vendas ganhas nos últimos ${period.label}`}>
              {byOwner.length === 0 ? (
                <p className="text-sm text-muted">Sem pessoas na equipe.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="pb-2 font-medium">Pessoa</th>
                      <th className="pb-2 text-right font-medium">Abertos</th>
                      <th className="pb-2 text-right font-medium">Ganhos</th>
                      <th className="pb-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byOwner.map((o) => (
                      <tr key={o.name} className="border-t border-border">
                        <td className="max-w-40 truncate py-2 text-fg">{o.name}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{o.active}</td>
                        <td className="py-2 text-right tabular-nums text-fg">{o.won}</td>
                        <td className="py-2 text-right font-medium tabular-nums text-fg">{money(o.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title="Campanhas" sub={`Leads criados nos últimos ${period.label}, por fonte e campanha (UTM)`}>
              {byCampaign.length === 0 || (byCampaign.length === 1 && byCampaign[0].name === "Sem origem") ? (
                <p className="text-sm text-muted">
                  Nenhum lead com origem ainda. Crie links rastreáveis em{" "}
                  <Link href={`/${slug}/settings/tracking`} className="text-accent-text underline">
                    Configurações → Rastreamento e UTMs
                  </Link>
                  .
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="pb-2 font-medium">Origem</th>
                      <th className="pb-2 text-right font-medium">Leads</th>
                      <th className="pb-2 text-right font-medium">Vendas</th>
                      <th className="pb-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCampaign.map((c) => (
                      <tr key={c.name} className="border-t border-border">
                        <td className="max-w-48 truncate py-2 text-fg">{c.name}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{c.leads}</td>
                        <td className="py-2 text-right tabular-nums text-fg">{c.won}</td>
                        <td className="py-2 text-right font-medium tabular-nums text-fg">{money(c.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title="De onde vêm os leads" sub={`Criados nos últimos ${period.label}`}>
              <Bars rows={bySource.map((s) => ({ label: s.name, value: s.count }))} empty="Nenhum lead novo no período." />
            </Card>
            <Card title="Mensagens recebidas por canal" sub={`Nos últimos ${period.label}`}>
              <Bars rows={dash.inboundByChannel.map((c) => ({ label: c.name, value: c.count }))} empty="Nenhuma mensagem recebida no período." />
            </Card>
            <Card title="Por que perdemos" sub={`${lost.length} ${lost.length === 1 ? "negócio perdido" : "negócios perdidos"} no período`} icon={TrendingDown}>
              <Bars rows={byReason.map((r) => ({ label: r.name, value: r.count }))} empty="Nenhuma perda no período. 🎉" tone="danger" />
            </Card>
            <Card title="Atendimento agora" sub="Conversas abertas e tarefas">
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  { k: "Conversas abertas", v: dash.openConversations },
                  { k: "Sem resposta", v: dash.unanswered },
                  { k: "Tarefas abertas", v: dash.tasksDue },
                ].map((x) => (
                  <div key={x.k} className="rounded-md bg-surface p-3">
                    <dd className="text-xl font-semibold tabular-nums text-fg">{x.v}</dd>
                    <dt className="text-xs text-muted">{x.k}</dt>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
    </>
  );
}
