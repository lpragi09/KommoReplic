import Link from "next/link";
import type { ReactNode } from "react";
import { getBoard, getDashboard, listUsers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/bits";
import { stageBar } from "@/lib/stage-colors";
import {
  AlarmClock,
  ArrowRight,
  CalendarCheck,
  ChartPie,
  Globe,
  InstagramLogo,
  MessageSquare,
  MessengerLogo,
  Sparkle,
  TrendingDown,
  Trophy,
  WhatsappLogo,
  type LucideIcon,
} from "@/components/ui/icons";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Painel" };

const periodStart = (days: number) =>
  days === 0 ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : new Date(Date.now() - days * 864e5).toISOString();

const periods = [
  { v: "today", label: "Hoje", days: 0 },
  { v: "week", label: "7 dias", days: 7 },
  { v: "month", label: "30 dias", days: 30 },
] as const;

const channelIcon = (name: string): LucideIcon =>
  /whats/i.test(name) ? WhatsappLogo : /insta/i.test(name) ? InstagramLogo : /messenger|facebook/i.test(name) ? MessengerLogo : Globe;

const card = "rounded-xl bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]";

export default async function HomePage({ params, searchParams }: PageProps<"/[ws]/home">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { p?: string; u?: string };
  const period = periods.find((p) => p.v === sp.p) ?? periods[1];
  const { user, ws } = await requireWorkspace(slug);
  const from = periodStart(period.days);
  const [d, users, board] = await Promise.all([getDashboard(ws.id, { from, owner: sp.u }), listUsers(ws.id), getBoard(ws.id, undefined, { owner: sp.u })]);
  const q = (p: Partial<{ p: string; u: string }>) => {
    const s = new URLSearchParams({ p: period.v, ...(sp.u ? { u: sp.u } : {}), ...p });
    if (p.u === "") s.delete("u");
    return `/${slug}/home?${s}`;
  };
  const leadsHref = (extra: string) => `/${slug}/leads?view=list${sp.u ? `&owner=${sp.u}` : ""}${extra}`;

  const sum = (xs: { priceCents: number }[]) => xs.reduce((s, l) => s + l.priceCents, 0);
  const wonV = sum(d.won);
  const activeV = sum(d.active);
  const closed = d.won.length + d.lost.length;
  const rate = closed ? Math.round((d.won.length / closed) * 100) : null;
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: ws.timezone }).format(new Date()));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: ws.timezone }).format(new Date());
  const who = users.find((u) => u.id === sp.u);

  const open = board.columns.filter((c) => c.stage.kind === "open");
  const maxCount = Math.max(1, ...open.map((c) => c.count));
  const maxMsg = Math.max(1, ...d.inboundByChannel.map((c) => c.count));
  const totalMsg = d.inboundByChannel.reduce((s, c) => s + c.count, 0);

  const todo: { text: string; href: string; tone: "warning" | "danger" | "accent" }[] = [];
  if (d.unanswered) todo.push({ text: `${d.unanswered} ${d.unanswered === 1 ? "conversa espera" : "conversas esperam"} resposta`, href: `/${slug}/inbox?f=unanswered`, tone: "danger" });
  if (d.withoutTask.length) todo.push({ text: `${d.withoutTask.length} ${d.withoutTask.length === 1 ? "lead está" : "leads estão"} sem próxima tarefa`, href: leadsHref("&task=none"), tone: "warning" });
  if (d.tasksDue) todo.push({ text: `${d.tasksDue} ${d.tasksDue === 1 ? "tarefa aberta" : "tarefas abertas"} na agenda`, href: `/${slug}/calendar`, tone: "accent" });

  return (
    <>
      <PageHeader title="Painel">
        <nav aria-label="Período" className="inline-flex h-10 items-center gap-0.5 rounded-pill bg-surface p-1 shadow-[inset_0_0_0_1px_var(--border)]">
          {periods.map((p) => (
            <Link
              key={p.v}
              href={q({ p: p.v })}
              aria-current={p.v === period.v ? "page" : undefined}
              className={cn("inline-flex h-8 items-center rounded-pill px-3.5 text-sm font-medium transition-colors", p.v === period.v ? "bg-bg text-fg shadow-[0_0_0_1px_var(--border),0_2px_6px_-2px_rgba(14,26,58,.25)]" : "text-muted hover:text-fg")}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Pessoa" className="flex flex-wrap items-center gap-1.5">
          <Link href={q({ u: "" })} aria-current={!sp.u ? "page" : undefined} className={cn("inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-medium", !sp.u ? "bg-accent text-on-accent" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-bg")}>
            Equipe toda
          </Link>
          {users.map((u) => (
            <Link
              key={u.id}
              href={q({ u: u.id })}
              aria-current={sp.u === u.id ? "page" : undefined}
              className={cn("inline-flex h-9 items-center gap-2 rounded-pill pl-1 pr-3.5 text-sm font-medium", sp.u === u.id ? "bg-accent text-on-accent" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-bg")}
            >
              <Avatar name={u.name || u.email} size={24} /> {(u.name || u.email).split(/[ @]/)[0]}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6">
          {/* topo: saudação + o que fazer agora */}
          <section aria-label="Resumo" className="fx-aurora overflow-hidden rounded-xl p-6 sm:p-8">
            <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="text-sm capitalize text-on-night-muted">{today}</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-on-night">
                  {hello}, {(user.name || "tudo bem").split(" ")[0]}
                  {who ? <span className="text-on-night-muted"> · vendo {who.name.split(" ")[0]}</span> : null}
                </h2>
                {todo.length ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {todo.map((t) => (
                      <li key={t.text}>
                        <Link
                          href={t.href}
                          className="group inline-flex items-center gap-2 rounded-pill bg-[color-mix(in_srgb,var(--on-night)_10%,transparent)] py-1.5 pl-2 pr-3.5 text-sm font-medium text-on-night shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-night)_14%,transparent)] hover:bg-[color-mix(in_srgb,var(--on-night)_16%,transparent)]"
                        >
                          <span className={cn("size-2 rounded-pill", t.tone === "danger" ? "bg-[#f87171]" : t.tone === "warning" ? "bg-[#fbbf24]" : "bg-[#7aa2ff]")} aria-hidden />
                          {t.text}
                          <ArrowRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm text-on-night-muted">
                    <Sparkle className="size-4 text-[#7aa2ff]" weight="fill" aria-hidden /> Tudo em dia: nenhuma conversa esperando e todos os leads com próxima tarefa.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:min-w-[420px]">
                <div className="rounded-lg bg-[color-mix(in_srgb,var(--on-night)_7%,transparent)] px-4 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-night)_12%,transparent)]">
                  <p className="text-xs text-on-night-muted">No funil agora</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-on-night">{money(activeV)}</p>
                  <p className="text-xs text-on-night-muted">{d.active.length} em andamento</p>
                </div>
                <div className="rounded-lg bg-[color-mix(in_srgb,#22c55e_16%,transparent)] px-4 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,#22c55e_30%,transparent)]">
                  <p className="text-xs text-on-night-muted">Ganho no período</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-on-night">{money(wonV)}</p>
                  <p className="text-xs text-on-night-muted">
                    {d.won.length} {d.won.length === 1 ? "negócio" : "negócios"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* números */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={MessageSquare} tone="from-[#3b82f6] to-[var(--accent)]" label="Conversas abertas" value={String(d.openConversations)} sub={d.unanswered ? `${d.unanswered} sem resposta` : "Todas respondidas"} subTone={d.unanswered ? "danger" : "success"} href={`/${slug}/inbox`} />
            <Kpi icon={Trophy} tone="from-[#34d399] to-[#059669]" label="Negócios ganhos" value={String(d.won.length)} sub={money(wonV)} href={leadsHref("")} />
            <Kpi icon={TrendingDown} tone="from-[#fb7185] to-[#e11d48]" label="Negócios perdidos" value={String(d.lost.length)} sub={money(sum(d.lost))} />
            <Kpi icon={ChartPie} tone="from-[#a78bfa] to-[#6d28d9]" label="Taxa de conversão" value={rate === null ? "—" : `${rate}%`} sub={closed ? `${d.won.length} de ${closed} fechados` : "Nada fechado no período"} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* funil */}
            <section className={cn(card, "p-5")} aria-labelledby="funil">
              <div className="flex items-center justify-between gap-3">
                <h2 id="funil" className="font-semibold text-fg">
                  {board.pipeline.name} agora
                </h2>
                <Link href={`/${slug}/leads`} className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                  Abrir funil <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
              {open.every((c) => c.count === 0) ? (
                <p className="mt-6 rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted">Nenhum lead em andamento. Os leads aparecem aqui etapa por etapa.</p>
              ) : (
                <ol className="mt-5 flex flex-col gap-2">
                  {open.map((c, i) => {
                    // formato de funil: a barra encolhe a cada etapa, e o preenchimento mostra quantos leads há nela
                    const shape = 100 - (i / Math.max(1, open.length)) * 38;
                    return (
                      <li key={c.stage.id} className="flex items-center gap-3">
                        <div className="w-36 shrink-0 truncate text-sm text-fg">{c.stage.name}</div>
                        <div className="flex flex-1 justify-center">
                          <div className="relative h-9 overflow-hidden rounded-md bg-surface shadow-[inset_0_0_0_1px_var(--border)]" style={{ width: `${shape}%` }}>
                            <div className={cn("absolute inset-y-0 left-0 opacity-25", stageBar[c.stage.color])} style={{ width: `${Math.max(c.count ? 8 : 0, (c.count / maxCount) * 100)}%` }} />
                            <div className={cn("absolute inset-y-0 left-0 w-1.5", stageBar[c.stage.color])} />
                            <span className="relative flex h-full items-center justify-between pl-4 pr-3 text-sm">
                              <span className="font-semibold tabular-nums text-fg">{c.count}</span>
                              <span className="tabular-nums font-medium text-fg">{money(c.totalCents)}</span>
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <div className="flex flex-col gap-5">
              {/* canais */}
              <section className={cn(card, "p-5")} aria-labelledby="canais">
                <div className="flex items-baseline justify-between">
                  <h2 id="canais" className="font-semibold text-fg">
                    Mensagens recebidas
                  </h2>
                  <span className="text-sm tabular-nums text-muted">{totalMsg} no período</span>
                </div>
                {d.inboundByChannel.length === 0 ? (
                  <p className="mt-4 rounded-lg bg-surface px-4 py-6 text-center text-sm text-muted">Nenhuma mensagem no período.</p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {d.inboundByChannel.map((c) => {
                      const Icon = channelIcon(c.name);
                      return (
                        <li key={c.name} className="flex items-center gap-3 text-sm">
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent" aria-hidden>
                            <Icon className="size-4" weight="fill" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between">
                              <span className="truncate text-fg">{c.name}</span>
                              <span className="tabular-nums font-medium text-fg">{c.count}</span>
                            </div>
                            <div className="mt-1.5 h-2 rounded-pill bg-surface" aria-hidden>
                              <div className="h-2 rounded-pill bg-[linear-gradient(90deg,var(--accent),#60a5fa)]" style={{ width: `${(c.count / maxMsg) * 100}%` }} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* precisa de atenção */}
              <section className={cn(card, "p-5")} aria-labelledby="atencao">
                <h2 id="atencao" className="flex items-center gap-2 font-semibold text-fg">
                  <AlarmClock className="size-4 text-warning" aria-hidden /> Sem próxima tarefa
                </h2>
                {d.withoutTask.length === 0 ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                    <CalendarCheck className="size-4 text-success" aria-hidden /> Todos os leads têm o próximo passo marcado.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {d.withoutTask.slice(0, 5).map((l) => (
                      <li key={l.id}>
                        <Link href={`/${slug}/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent-text">
                          <span className="truncate text-fg">{leadTitle(l)}</span>
                          <span className="shrink-0 tabular-nums text-muted">{money(l.priceCents)}</span>
                        </Link>
                      </li>
                    ))}
                    {d.withoutTask.length > 5 && (
                      <li className="pt-2">
                        <Link href={leadsHref("&task=none")} className="text-sm font-medium text-accent-text hover:underline">
                          Ver todos os {d.withoutTask.length}
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {/* últimos ganhos */}
          {d.won.length > 0 && (
            <section className={cn(card, "p-5")} aria-labelledby="ganhos">
              <h2 id="ganhos" className="flex items-center gap-2 font-semibold text-fg">
                <Trophy className="size-4 text-success" weight="fill" aria-hidden /> Ganhos no período
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.won.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    <Link href={`/${slug}/leads/${l.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-success-soft px-4 py-3 text-sm transition-shadow hover:shadow-[inset_0_0_0_1px_var(--success)]">
                      <span className="truncate font-medium text-fg">{leadTitle(l)}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-success">{money(l.priceCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, tone, label, value, sub, subTone, href }: { icon: LucideIcon; tone: string; label: string; value: string; sub: string; subTone?: "danger" | "success"; href?: string }): ReactNode {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <span className={cn("grid size-11 place-items-center rounded-lg bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_18px_-8px_rgba(14,26,58,.45)]", tone)} aria-hidden>
          <Icon className="size-5" weight="fill" />
        </span>
        {href && <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </div>
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-fg">{value}</p>
      <p className={cn("mt-1 text-sm", subTone === "danger" ? "text-danger" : subTone === "success" ? "text-success" : "text-muted")}>{sub}</p>
    </>
  );
  const cls = cn(card, "group block p-5");
  return href ? (
    <Link href={href} className={cn(cls, "transition-[box-shadow,transform] duration-fast hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--border-input),0_14px_30px_-16px_rgba(29,78,216,.45)]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
