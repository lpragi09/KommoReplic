import Link from "next/link";
import type { ReactNode } from "react";
import { getDashboard, listLeads, listLossReasons, listPipelines, listRobots, listUsers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { money } from "@/lib/format";
import { VIA_LABEL } from "@/lib/utm";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { Bot, TrendingDown, TrendingUp, Trophy, Users, type LucideIcon } from "@/components/ui/icons";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Relatórios" };

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
  const sp = (await searchParams) as { p?: string; pipeline?: string };
  const period = periods.find((p) => p.v === sp.p) ?? periods[1];
  const { ws } = await requireWorkspace(slug);
  const from = daysAgo(Number(period.v));
  const [pipelines, leads, users, reasons, dash, robots] = await Promise.all([
    listPipelines(ws.id),
    listLeads(ws.id),
    listUsers(ws.id),
    listLossReasons(ws.id),
    getDashboard(ws.id, { from }),
    listRobots(ws.id).catch(() => []), // antes de rodar a atualização do banco, a tabela de robôs ainda não existe
  ]);
  const pipeline = pipelines.find((p) => p.id === sp.pipeline) ?? pipelines[0];
  const inPipe = leads.filter((l) => l.pipelineId === pipeline?.id);
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

  const href = (p: Partial<{ p: string; pipeline: string }>) => `/${slug}/reports?${new URLSearchParams({ p: period.v, ...(pipeline ? { pipeline: pipeline.id } : {}), ...p })}`;

  return (
    <>
      <PageHeader title="Relatórios">
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
        {pipelines.length > 1 && (
          <nav aria-label="Funil" className="flex gap-1">
            {pipelines.map((p) => (
              <Link key={p.id} href={href({ pipeline: p.id })} aria-current={p.id === pipeline?.id ? "page" : undefined} className={cn("h-8 rounded-sm px-2 text-sm leading-8", p.id === pipeline?.id ? "font-medium text-fg" : "text-muted hover:text-fg")}>
                {p.name}
              </Link>
            ))}
          </nav>
        )}
      </PageHeader>
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
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
        </div>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone?: "success" }) {
  return (
    <div className="rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className={cn("grid size-7 place-items-center rounded-sm", tone === "success" ? "bg-success-soft text-success" : "bg-accent-soft text-accent-text")} aria-hidden>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
    </div>
  );
}

function Card({ title, sub, children, icon: Icon }: { title: string; sub?: string; children: ReactNode; icon?: LucideIcon }) {
  return (
    <section className="rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]" aria-label={title}>
      <header className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted" aria-hidden />}
        <div>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Bars({ rows, empty, tone }: { rows: { label: string; value: number; extra?: string }[]; empty: string; tone?: "danger" }) {
  if (!rows.length || rows.every((r) => r.value === 0)) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-fg">{r.label}</span>
            {r.extra && <span className="text-xs tabular-nums text-muted">{r.extra}</span>}
            <span className="w-8 text-right font-medium tabular-nums text-fg">{r.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-pill bg-surface">
            <div className={cn("h-full rounded-pill", tone === "danger" ? "bg-danger" : "bg-[linear-gradient(90deg,var(--accent),var(--stage-4))]")} style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
