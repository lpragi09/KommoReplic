import Link from "next/link";
import type { ActivityEvent, Lead, MessageStats, Pipeline, RoiReport, SalesGoal, Stage, User } from "@/data/types";
import { leadTitle, money } from "@/lib/format";
import { stageBar } from "@/lib/stage-colors";
import { channelLabel } from "@/lib/robot-meta";
import { cn } from "@/lib/cn";
import { Bot, ChartPie, Clock, Funnel, TrendingUp, Trophy, Users } from "@/components/ui/icons";
import { Bars, Card, Kpi, Table } from "./ui";
import { ActivityLogTable, GoalsEditor, RoiEditor, type LogRow } from "./client";

/* Seções das estatísticas (como o Análise de dados do Kommo, com o que dá para medir de verdade aqui). */

type L = Lead & { stage: Stage };
const DAY = 864e5;
const userName = (users: User[], id: string | null | undefined) => {
  const u = users.find((x) => x.id === id);
  return u ? u.name || u.email.split("@")[0] : "—";
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const daysTxt = (ms: number) => {
  const d = ms / DAY;
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${d < 10 ? d.toFixed(1).replace(".", ",") : Math.round(d)} dias`;
};

/* ---------------- análise de vendas ---------------- */
export function SalesAnalysis({ pipeline, leads, activity, label }: { pipeline: Pipeline; leads: L[]; activity: ActivityEvent[]; label: string }) {
  const stages = [...pipeline.stages].sort((a, b) => a.sort - b.sort);
  const ids = new Set(leads.map((l) => l.id));
  const byId = new Map(leads.map((l) => [l.id, l]));
  const ev = activity.filter((e) => e.leadId && ids.has(e.leadId)).sort((a, b) => a.at.localeCompare(b.at));
  const lostStages = new Set(stages.filter((s) => s.kind === "lost").map((s) => s.id));

  const rows = stages.map((s) => {
    const inside = leads.filter((l) => l.stageId === s.id);
    const entered = new Set(ev.filter((e) => (e.kind === "stage_changed" || e.kind === "lead_created") && e.stageTo === s.id).map((e) => e.leadId!));
    const lost = new Set(ev.filter((e) => e.kind === "stage_changed" && e.stageFrom === s.id && e.stageTo && lostStages.has(e.stageTo)).map((e) => e.leadId!));
    // tempo médio na etapa: da entrada (evento ou criação) até a saída, para quem saiu no período
    const spans: number[] = [];
    for (const out of ev.filter((e) => e.kind === "stage_changed" && e.stageFrom === s.id)) {
      const enter = [...ev].reverse().find((e) => e.leadId === out.leadId && e.at < out.at && e.stageTo === s.id);
      const start = enter?.at ?? (byId.get(out.leadId!)?.createdAt as string | undefined);
      if (start && start < out.at) spans.push(Date.parse(out.at) - Date.parse(start));
    }
    return {
      s,
      inside: inside.length,
      insideCents: inside.reduce((x, l) => x + l.priceCents, 0),
      entered: entered.size,
      enteredCents: [...entered].reduce((x, id) => x + (byId.get(id)?.priceCents ?? 0), 0),
      lost: lost.size,
      lostCents: [...lost].reduce((x, id) => x + (byId.get(id)?.priceCents ?? 0), 0),
      avg: spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null,
    };
  });
  const open = rows.filter((r) => r.s.kind === "open");
  const totalNew = new Set(ev.filter((e) => e.kind === "lead_created").map((e) => e.leadId)).size;
  const won = rows.filter((r) => r.s.kind === "won").reduce((a, r) => a + r.entered, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Leads novos" value={String(totalNew)} sub={label} />
        <Kpi icon={Trophy} label="Ganhos" value={String(won)} sub={`${pct(won, totalNew)}% dos novos`} tone="success" />
        <Kpi icon={Funnel} label="No funil agora" value={String(open.reduce((a, r) => a + r.inside, 0))} sub={money(open.reduce((a, r) => a + r.insideCents, 0))} />
        <Kpi icon={Clock} label="Tempo até ganhar" value={(() => { const w = rows.find((r) => r.s.kind === "won"); const spans = ev.filter((e) => e.kind === "stage_changed" && e.stageTo === w?.s.id).map((e) => Date.parse(e.at) - Date.parse(byId.get(e.leadId!)?.createdAt ?? e.at)).filter((x) => x > 0); return spans.length ? daysTxt(spans.reduce((a, b) => a + b, 0) / spans.length) : "—"; })()} sub="da criação ao ganho, em média" />
      </div>

      <Card title="Etapa por etapa" sub={`Entradas e perdas ${label}. “Dentro” é agora.`}>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[720px] border-separate border-spacing-x-1.5 text-sm">
            <caption className="sr-only">Análise de vendas por etapa</caption>
            <thead>
              <tr>
                <th scope="col" className="w-36 pb-2 text-left text-xs font-medium text-muted">
                  <span className="sr-only">Medida</span>
                </th>
                {rows.map((r) => (
                  <th key={r.s.id} scope="col" className="min-w-28 pb-2 text-left align-bottom font-medium">
                    <span className={cn("mb-2 block h-1 rounded-pill", stageBar[r.s.color])} aria-hidden />
                    <span className="line-clamp-2 text-xs text-fg">{r.s.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Dentro da etapa", (r: (typeof rows)[number]) => [r.inside, r.insideCents]],
                  ["Entrou na etapa", (r: (typeof rows)[number]) => [r.entered, r.enteredCents]],
                  ["Perdidos daqui", (r: (typeof rows)[number]) => [r.lost, r.lostCents]],
                ] as const
              ).map(([name, get]) => (
                <tr key={name}>
                  <th scope="row" className="py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                    {name}
                  </th>
                  {rows.map((r) => {
                    const [n, c] = get(r);
                    return (
                      <td key={r.s.id} className={cn("rounded-md px-2 py-2 tabular-nums", name === "Perdidos daqui" ? (n ? "bg-danger-soft text-danger" : "bg-surface text-muted") : "bg-surface text-fg")}>
                        <strong className="font-semibold">{n}</strong>
                        <span className="block text-xs text-muted">{money(c)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Tempo médio
                </th>
                {rows.map((r) => (
                  <td key={r.s.id} className="rounded-md bg-surface px-2 py-2 text-xs tabular-nums text-fg">
                    {r.s.kind === "open" && r.avg !== null ? daysTxt(r.avg) : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Funil de conversão" sub="Quantos dos que entraram em cada etapa chegaram à seguinte">
        {open.every((r) => r.entered === 0) ? (
          <p className="text-sm text-muted">Sem movimento {label}.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {open.map((r, i) => {
              const max = Math.max(1, ...open.map((x) => x.entered));
              const next = open[i + 1];
              return (
                <li key={r.s.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate text-fg">{r.s.name}</span>
                  <span className="h-6 overflow-hidden rounded-sm bg-surface">
                    <span className={cn("block h-full rounded-sm", stageBar[r.s.color])} style={{ width: `${Math.max(2, (r.entered / max) * 100)}%` }} />
                  </span>
                  <span className="w-28 text-right tabular-nums text-muted">
                    <strong className="text-fg">{r.entered}</strong>
                    {next && r.entered > 0 && <span className="ml-1 text-xs">→ {pct(next.entered, r.entered)}%</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

/* ---------------- relatório consolidado ---------------- */
export function Consolidated({ leads, users, from, days, label }: { leads: L[]; users: User[]; from: string; days: number; label: string }) {
  const bucket = days > 120 ? 30 : days > 31 ? 7 : 1; // dia, semana ou mês
  const start = Date.parse(from);
  const n = Math.ceil(days / bucket);
  const created = Array(n).fill(0) as number[];
  const won = Array(n).fill(0) as number[];
  for (const l of leads) {
    const c = Math.floor((Date.parse(l.createdAt) - start) / (bucket * DAY));
    if (c >= 0 && c < n) created[c]++;
    if (l.stage.kind === "won" && l.closedAt) {
      const w = Math.floor((Date.parse(l.closedAt) - start) / (bucket * DAY));
      if (w >= 0 && w < n) won[w]++;
    }
  }
  const total = leads.length;
  const totalCents = leads.reduce((a, l) => a + l.priceCents, 0);
  const byStage = new Map<string, { name: string; color: Stage["color"]; n: number; cents: number }>();
  for (const l of leads) {
    const c = byStage.get(l.stageId) ?? { name: l.stage.name, color: l.stage.color, n: 0, cents: 0 };
    c.n++;
    c.cents += l.priceCents;
    byStage.set(l.stageId, c);
  }
  const stages = [...byStage.values()].sort((a, b) => b.n - a.n);
  const top = stages.slice(0, 6);
  const rest = stages.slice(6);
  const byUser = users
    .map((u) => {
      const mine = leads.filter((l) => l.responsibleUserId === u.id);
      return { name: u.name || u.email.split("@")[0], n: mine.length, cents: mine.reduce((a, l) => a + l.priceCents, 0) };
    })
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);

  // donut das etapas
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = [...top, ...(rest.length ? [{ name: "Outras", color: "8" as Stage["color"], n: rest.reduce((a, s) => a + s.n, 0), cents: rest.reduce((a, s) => a + s.cents, 0) }] : [])].map((s) => {
    const len = total ? (s.n / total) * C : 0;
    const arc = { ...s, len, off: acc };
    acc += len;
    return arc;
  });

  return (
    <div className="flex flex-col gap-4">
      <Card title="Leads" sub={`Criados e ganhos por ${bucket === 1 ? "dia" : bucket === 7 ? "semana" : "mês"} · ${label}`}>
        <LineChart series={[{ name: "Criados", values: created, cls: "stroke-[var(--accent)]", dot: "fill-[var(--accent)]", bg: "bg-[var(--accent)]" }, { name: "Ganhos", values: won, cls: "stroke-[var(--warning)]", dot: "fill-[var(--warning)]", bg: "bg-[var(--warning)]" }]} labels={created.map((_, i) => new Date(start + i * bucket * DAY).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }))} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Card title="Etapas do funil" sub="Onde estão os leads">
          {stages.length === 0 ? (
            <p className="text-sm text-muted">Nenhum lead.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {top.map((s) => (
                <li key={s.name} className="flex items-center gap-3">
                  <span className="w-12 text-right text-xl font-light tabular-nums text-fg">{pct(s.n, total)}%</span>
                  <span className={cn("h-9 w-1 rounded-pill", stageBar[s.color])} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-fg">{s.name}</span>
                    <span className="block text-xs tabular-nums text-muted">
                      {s.n} leads, {money(s.cents)}
                    </span>
                  </span>
                </li>
              ))}
              {rest.length > 0 && (
                <li className="flex items-center gap-3">
                  <span className="w-12 text-right text-xl font-light tabular-nums text-fg">{pct(rest.reduce((a, s) => a + s.n, 0), total)}%</span>
                  <span className="h-9 w-1 rounded-pill bg-border-input" aria-hidden />
                  <span className="text-sm text-muted">Outras {rest.length} etapas</span>
                </li>
              )}
            </ul>
          )}
        </Card>
        <section aria-label="Total de leads" className="grid place-items-center rounded-lg bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
          <div className="relative size-48">
            <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
              <circle cx="70" cy="70" r={R} fill="none" strokeWidth="14" className="stroke-[var(--surface)]" />
              {arcs.map((a) => (
                <circle key={a.name} cx="70" cy="70" r={R} fill="none" strokeWidth="14" strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.off} className={cn("transition-all", strokeOf[a.color])} />
              ))}
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <p className="text-4xl font-light tabular-nums tracking-tight text-fg">{total}</p>
              <p className="text-xs text-muted">leads · {money(totalCents)}</p>
            </div>
          </div>
        </section>
        <Card title="Leads por pessoa" sub="Responsável atual">
          <Bars rows={byUser.map((u) => ({ label: u.name, value: u.n, extra: `${pct(u.n, total)}% · ${money(u.cents)}` }))} empty="Nenhum lead com responsável." />
        </Card>
      </div>
    </div>
  );
}

const strokeOf: Record<Stage["color"], string> = {
  "1": "stroke-[var(--stage-1)]",
  "2": "stroke-[var(--stage-2)]",
  "3": "stroke-[var(--stage-3)]",
  "4": "stroke-[var(--stage-4)]",
  "5": "stroke-[var(--stage-5)]",
  "6": "stroke-[var(--stage-6)]",
  "7": "stroke-[var(--stage-7)]",
  "8": "stroke-[var(--stage-8)]",
  won: "stroke-[var(--stage-won)]",
  lost: "stroke-[var(--stage-lost)]",
};

function LineChart({ series, labels }: { series: { name: string; values: number[]; cls: string; dot: string; bg: string }[]; labels: string[] }) {
  const W = 1100;
  const H = 220;
  const P = { l: 32, r: 12, t: 12, b: 28 };
  const n = labels.length;
  const max = Math.max(4, ...series.flatMap((s) => s.values));
  const x = (i: number) => P.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const ticks = [0, Math.round(max / 2), max];
  const every = Math.max(1, Math.ceil(n / 8));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label={series.map((s) => `${s.name}: ${s.values.reduce((a, b) => a + b, 0)}`).join(", ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="stroke-[var(--border)]" strokeDasharray="3 4" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="fill-[var(--text-muted)] text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <g key={s.name}>
            <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" className={s.cls} />
            {n <= 45 && s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" className={s.dot} />)}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-pill", s.bg)} aria-hidden /> {s.name} ({s.values.reduce((a, b) => a + b, 0)})
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/* ---------------- relatório por atividades ---------------- */
export function ByActivity({ users, leads, activity, from, label }: { users: User[]; leads: L[]; activity: ActivityEvent[]; from: string; label: string }) {
  const row = (id: string | null) => {
    const mine = (e: ActivityEvent) => e.actorUserId === id;
    const own = leads.filter((l) => l.responsibleUserId === id && l.stage.kind === "open");
    const won = leads.filter((l) => l.responsibleUserId === id && l.stage.kind === "won" && l.closedAt && l.closedAt >= from);
    return {
      open: own.length,
      openCents: own.reduce((a, l) => a + l.priceCents, 0),
      notes: activity.filter((e) => e.kind === "note_added" && mine(e)).length,
      tasks: activity.filter((e) => e.kind === "task_created" && mine(e)).length,
      done: activity.filter((e) => e.kind === "task_done" && mine(e)).length,
      moves: activity.filter((e) => e.kind === "stage_changed" && mine(e)).length,
      won: won.length,
      wonCents: won.reduce((a, l) => a + l.priceCents, 0),
    };
  };
  const rows = users.map((u) => ({ name: u.name || u.email.split("@")[0], ...row(u.id) })).sort((a, b) => b.wonCents - a.wonCents || b.open - a.open);
  const robots = { runs: activity.filter((e) => e.kind === "automation_ran").length, moves: activity.filter((e) => e.kind === "stage_changed" && !e.actorUserId).length };
  return (
    <div className="flex flex-col gap-4">
      <Card title="Por pessoa" sub={`O que cada um fez ${label}`}>
        <Table
          caption="Relatório por atividades"
          head={[{ label: "Pessoa" }, { label: "Leads em andamento", right: true }, { label: "Notas", right: true }, { label: "Tarefas criadas", right: true }, { label: "Tarefas feitas", right: true }, { label: "Etapas movidas", right: true }, { label: "Vendas", right: true }]}
        >
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="max-w-48 truncate py-2.5 pr-2 font-medium text-fg">{r.name}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-fg">
                {r.open} <span className="text-xs text-muted">({money(r.openCents)})</span>
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{r.notes}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{r.tasks}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{r.done}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{r.moves}</td>
              <td className="py-2.5 pl-2 text-right tabular-nums font-semibold text-fg">
                {r.won} <span className="text-xs font-normal text-muted">({money(r.wonCents)})</span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="Robôs" icon={Bot} sub="O trabalho que a automação tirou da equipe">
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-md bg-surface p-3">
            <dd className="text-2xl font-semibold tabular-nums text-fg">{robots.runs}</dd>
            <dt className="text-xs text-muted">ações de robô nos leads</dt>
          </div>
          <div className="rounded-md bg-surface p-3">
            <dd className="text-2xl font-semibold tabular-nums text-fg">{robots.moves}</dd>
            <dt className="text-xs text-muted">leads movidos por robô</dt>
          </div>
        </dl>
      </Card>
    </div>
  );
}

/* ---------------- registro de atividade ---------------- */
export function ActivityLog({ slug, activity, leads, users, pipelines }: { slug: string; activity: ActivityEvent[]; leads: L[]; users: User[]; pipelines: Pipeline[] }) {
  const lead = new Map(leads.map((l) => [l.id, l]));
  const stage = new Map(pipelines.flatMap((p) => p.stages.map((s) => [s.id, { name: s.name, color: s.color, pipeline: p.name }] as const)));
  const st = (id: string | null | undefined) => (id ? (stage.get(id) ?? null) : null);
  const rows: LogRow[] = activity.slice(0, 1500).map((e) => {
    const l = e.leadId ? lead.get(e.leadId) : undefined;
    const who = e.kind === "automation_ran" ? `Robô${e.robot ? ` (${e.robot})` : ""}` : e.actorUserId ? userName(users, e.actorUserId) : "Robô / sistema";
    const base = { id: e.id, at: e.at, who, robot: !e.actorUserId || e.kind === "automation_ran", object: l ? leadTitle(l) : "Lead apagado", href: l ? `/${slug}/leads/${l.id}` : null };
    switch (e.kind) {
      case "lead_created":
        return { ...base, type: "Lead", what: "Lead criado", after: { text: st(e.stageTo)?.name ?? "", stage: st(e.stageTo) } };
      case "stage_changed":
        return { ...base, type: "Lead", what: "Etapa alterada", before: { text: st(e.stageFrom)?.name ?? "—", stage: st(e.stageFrom) }, after: { text: st(e.stageTo)?.name ?? "—", stage: st(e.stageTo) } };
      case "responsible_changed":
        return { ...base, type: "Lead", what: "Responsável alterado", before: { text: userName(users, e.userFrom) }, after: { text: userName(users, e.userTo) } };
      case "price_changed":
        return { ...base, type: "Lead", what: "Valor alterado", before: { text: e.centsFrom == null ? "—" : money(e.centsFrom) }, after: { text: e.centsTo == null ? "—" : money(e.centsTo) } };
      case "name_changed":
        return { ...base, type: "Lead", what: "Nome alterado", before: { text: e.nameFrom || "—" }, after: { text: e.nameTo || "—" } };
      case "note_added":
        return { ...base, type: "Nota", what: "Nota adicionada", after: { text: e.text ?? "" } };
      case "task_created":
        return { ...base, type: "Tarefa", what: "Tarefa criada", after: { text: e.text ?? "" } };
      case "task_done":
        return { ...base, type: "Tarefa", what: "Tarefa concluída", after: { text: e.text ?? "" } };
      case "automation_ran":
        return { ...base, type: "Lead", what: e.text ?? "Robô rodou" };
      default:
        return { ...base, type: "Lead", what: e.kind.replace(/_/g, " ") };
    }
  });
  return (
    <Card title="Registro de atividade" sub={`${activity.length.toLocaleString("pt-BR")} atividades no período${activity.length > 1500 ? " (mostrando as 1.500 mais novas)" : ""}`}>
      <ActivityLogTable rows={rows} />
    </Card>
  );
}

/* ---------------- metas ---------------- */
export function Goals({ slug, users, leads, goals, month, by, canEdit }: { slug: string; users: User[]; leads: L[]; goals: SalesGoal[]; month: string; by: "valor" | "qtd"; canEdit: boolean }) {
  const [y, m] = month.split("-").map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const now = new Date();
  const curMonth = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const pace = month < curMonth ? 1 : month > curMonth ? 0 : Number(now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(8, 10)) / daysIn;
  const inMonth = (l: L) => l.stage.kind === "won" && !!l.closedAt && new Date(l.closedAt).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).startsWith(month);
  const rows = users.map((u) => {
    const g = goals.find((x) => x.userId === u.id);
    const won = leads.filter((l) => l.responsibleUserId === u.id && inMonth(l));
    const got = by === "valor" ? won.reduce((a, l) => a + l.priceCents, 0) : won.length;
    const target = by === "valor" ? (g?.cents ?? 0) : (g?.count ?? 0);
    return { id: u.id, name: u.name || u.email.split("@")[0], got, target };
  });
  const total = { got: rows.reduce((a, r) => a + r.got, 0), target: rows.reduce((a, r) => a + r.target, 0) };
  const fmt = (v: number) => (by === "valor" ? money(v) : `${v} ${v === 1 ? "venda" : "vendas"}`);
  const shift = (d: number) => {
    const dt = new Date(y, m - 1 + d, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };
  const q = (p: Record<string, string>) => `/${slug}/reports?${new URLSearchParams({ aba: "metas", mes: month, por: by, ...p })}`;
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });


  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={q({ mes: shift(-1) })} className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg" aria-label="Mês anterior">
          ‹
        </Link>
        <h2 className="min-w-40 text-center text-base font-semibold capitalize text-fg">{monthName}</h2>
        <Link href={q({ mes: shift(1) })} className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg" aria-label="Próximo mês">
          ›
        </Link>
        <nav aria-label="Medir por" className="ml-auto flex rounded-sm bg-surface p-0.5 shadow-[inset_0_0_0_1px_var(--border)]">
          {(
            [
              ["valor", "Por venda"],
              ["qtd", "Por quantidade"],
            ] as const
          ).map(([v, l]) => (
            <Link key={v} href={q({ por: v })} aria-current={by === v ? "page" : undefined} className={cn("h-8 rounded-[6px] px-3 text-sm leading-8", by === v ? "bg-bg font-medium text-fg shadow-[0_0_0_1px_var(--border)]" : "text-muted hover:text-fg")}>
              {l}
            </Link>
          ))}
        </nav>
        {canEdit && <GoalsEditor slug={slug} month={month} users={users.map((u) => ({ id: u.id, name: u.name || u.email }))} goals={goals} />}
      </div>
      <Card title="Metas do mês" sub="Verde: no ritmo ou à frente. Vermelho: abaixo do ritmo do mês (a linha fina marca onde deveria estar hoje).">
        {total.target === 0 && <p className="mb-4 rounded-md bg-surface px-3 py-2 text-sm text-muted">{canEdit ? "Nenhuma meta definida para este mês. Use “Definir metas”." : "Nenhuma meta definida para este mês."}</p>}
        <ul className="flex flex-col gap-4">
          <li className="grid gap-2 sm:grid-cols-[12rem_1fr_12rem] sm:items-center">
            <span className="font-semibold text-fg">Total da equipe</span>
            <GoalBar {...total} pace={pace} />
            <span className="text-sm tabular-nums text-muted sm:text-right">
              <strong className="text-fg">{fmt(total.got)}</strong> de {fmt(total.target)} {total.target ? `· ${pct(total.got, total.target)}%` : ""}
            </span>
          </li>
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 sm:grid-cols-[12rem_1fr_12rem] sm:items-center">
              <span className="truncate text-fg">{r.name}</span>
              <GoalBar got={r.got} target={r.target} pace={pace} />
              <span className="text-sm tabular-nums text-muted sm:text-right">
                <strong className="text-fg">{fmt(r.got)}</strong> {r.target ? `de ${fmt(r.target)} · ${pct(r.got, r.target)}%` : "· sem meta"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function GoalBar({ got, target, pace }: { got: number; target: number; pace: number }) {
  const ratio = target ? got / target : 0;
  const behind = target > 0 && ratio < pace;
  return (
    <div className="relative h-3 overflow-hidden rounded-pill bg-surface shadow-[inset_0_0_0_1px_var(--border)]">
      <div className={cn("h-full rounded-pill", !target ? "bg-border-input" : behind ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(100, target ? ratio * 100 : 0)}%` }} />
      {target > 0 && pace > 0 && pace < 1 && <span className="absolute inset-y-0 w-px bg-fg/50" style={{ left: `${pace * 100}%` }} aria-hidden />}
    </div>
  );
}

/* ---------------- ROI ---------------- */
export function Roi({ slug, reports, leads, canEdit }: { slug: string; reports: RoiReport[]; leads: L[]; canEdit: boolean }) {
  const calc = (r: RoiReport) => {
    const from = `${r.from}T00:00:00-03:00`;
    const to = `${r.to}T23:59:59-03:00`;
    const has = (v: string | undefined, want: string | null) => !want || (v ?? "").toLowerCase().includes(want.toLowerCase());
    const mine = leads.filter((l) => l.createdAt >= new Date(from).toISOString() && l.createdAt <= new Date(to).toISOString() && has(l.attribution?.utm_source, r.utmSource) && has(l.attribution?.utm_campaign, r.utmCampaign));
    const won = mine.filter((l) => l.stage.kind === "won");
    const revenue = won.reduce((a, l) => a + l.priceCents, 0);
    return { leads: mine.length, won: won.length, lost: mine.filter((l) => l.stage.kind === "lost").length, revenue, roi: r.investmentCents ? Math.round(((revenue - r.investmentCents) / r.investmentCents) * 100) : null };
  };
  const all = reports.map((r) => ({ r, ...calc(r) }));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: TrendingUp, t: "Compare gasto e venda", d: "Coloque quanto investiu numa campanha e veja quanto ela vendeu." },
          { icon: ChartPie, t: "Pela origem do lead", d: "Usa a fonte e a campanha (UTM) que o lead trouxe ao chegar." },
          { icon: Funnel, t: "Decida onde investir", d: "ROI positivo: a campanha se pagou. Negativo: reveja." },
        ].map((x) => (
          <div key={x.t} className="flex gap-3 rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border)]">
            <x.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-fg">{x.t}</p>
              <p className="text-xs text-muted">{x.d}</p>
            </div>
          </div>
        ))}
      </div>
      <Card title="Seus relatórios de ROI" sub="Até 25 relatórios." action={canEdit ? <RoiEditor slug={slug} /> : undefined}>
        {all.length === 0 ? (
          <p className="text-sm text-muted">Ainda não há relatórios. {canEdit ? "Crie o primeiro em “Novo relatório”." : ""}</p>
        ) : (
          <Table
            caption="Relatórios de ROI"
            head={[{ label: "Nome" }, { label: "Investimento", right: true }, { label: "Leads", right: true }, { label: "Ganhos", right: true }, { label: "Perdidos", right: true }, { label: "Receita", right: true }, { label: "ROI", right: true }, { label: "" }]}
          >
            {all.map(({ r, ...c }) => (
              <tr key={r.id}>
                <td className="max-w-56 py-2.5 pr-2">
                  <span className="block truncate font-medium text-fg">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[r.utmSource && `fonte “${r.utmSource}”`, r.utmCampaign && `campanha “${r.utmCampaign}”`].filter(Boolean).join(" · ") || "todas as origens"} · {new Date(`${r.from}T12:00:00`).toLocaleDateString("pt-BR")} a {new Date(`${r.to}T12:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{money(r.investmentCents)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{c.leads}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-success">{c.won}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-danger">{c.lost}</td>
                <td className="px-2 py-2.5 text-right tabular-nums font-medium text-fg">{money(c.revenue)}</td>
                <td className={cn("px-2 py-2.5 text-right font-semibold tabular-nums", c.roi === null ? "text-muted" : c.roi >= 0 ? "text-success" : "text-danger")}>{c.roi === null ? "—" : `${c.roi > 0 ? "+" : ""}${c.roi}%`}</td>
                <td className="py-2.5 pl-2 text-right">{canEdit && <RoiEditor slug={slug} report={r} />}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ---------------- mensagens por canal ---------------- */
export function Messages({ stats, label }: { stats: MessageStats[]; label: string }) {
  const sum = stats.reduce((a, s) => ({ received: a.received + s.received, sent: a.sent + s.sent, read: a.read + s.read, byAi: a.byAi + s.byAi }), { received: 0, sent: 0, read: 0, byAi: 0 });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Recebidas" value={sum.received.toLocaleString("pt-BR")} sub={label} />
        <Kpi icon={TrendingUp} label="Enviadas" value={sum.sent.toLocaleString("pt-BR")} sub={label} />
        <Kpi icon={Trophy} label="Lidas" value={`${pct(sum.read, sum.sent)}%`} sub="das enviadas (onde o canal informa)" tone="success" />
        <Kpi icon={Bot} label="Pela IA" value={sum.byAi.toLocaleString("pt-BR")} sub="respostas do agente" />
      </div>
      <Card title="Por canal" sub={`Mensagens ${label}. Entrega e leitura vêm do WhatsApp, Instagram e Messenger; no chat do site toda enviada conta como entregue.`}>
        {stats.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma mensagem no período.</p>
        ) : (
          <Table caption="Mensagens por canal" head={[{ label: "Canal" }, { label: "Recebidas", right: true }, { label: "Enviadas", right: true }, { label: "Entregues", right: true }, { label: "Lidas", right: true }, { label: "Falharam", right: true }, { label: "Pela IA", right: true }]}>
            {stats.map((s) => (
              <tr key={s.kind}>
                <td className="py-2.5 pr-2 font-medium text-fg">{channelLabel(s.kind)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{s.received}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{s.sent}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {s.kind === "webchat" ? s.sent : s.delivered} <span className="text-xs text-muted">{pct(s.kind === "webchat" ? s.sent : s.delivered, s.sent)}%</span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {s.kind === "webchat" ? "—" : <>{s.read} <span className="text-xs text-muted">{pct(s.read, s.sent)}%</span></>}
                </td>
                <td className={cn("px-2 py-2.5 text-right tabular-nums", s.failed && "text-danger")}>{s.failed}</td>
                <td className="py-2.5 pl-2 text-right tabular-nums">{s.byAi}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
