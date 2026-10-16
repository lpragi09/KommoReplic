import Link from "next/link";
import type { Task, Lead } from "@/data/types";
import { holidayMap } from "@/lib/holidays";
import { leadTitle } from "@/lib/format";
import { cn } from "@/lib/cn";

/* Calendário do mês: feriados nacionais e as tarefas de cada dia. Só servidor, sem JS no navegador. */

const TZ = "America/Sao_Paulo";
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** dias do quadro (semanas completas, domingo a sábado) para o mês "AAAA-MM" */
export function monthGrid(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 864e5);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((first.getUTCDay() + daysInMonth) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10));
  return { days, from: `${days[0]}T00:00:00-03:00`, to: `${days[days.length - 1]}T23:59:59-03:00` };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

type T = Task & { lead: Lead | null; owner: string };

export function MonthCalendar({ slug, month, tasks, showOwner }: { slug: string; month: string; tasks: T[]; showOwner: boolean }) {
  const { days } = monthGrid(month);
  const today = localDay(new Date().toISOString());
  const nowIso = new Date().toISOString();
  const hol = holidayMap(days.map((d) => Number(d.slice(0, 4))));
  const byDay = new Map<string, T[]>();
  for (const t of tasks) {
    const k = localDay(t.dueAt);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const monthHolidays = [...hol.values()].filter((h) => h.date.startsWith(month));
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]">
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <thead>
            <tr>
              {WEEK.map((w, i) => (
                <th key={w} scope="col" className={cn("border-b border-border py-2.5 text-xs font-semibold uppercase tracking-[0.12em]", i === 0 || i === 6 ? "text-muted" : "text-fg")}>
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((wk) => (
              <tr key={wk[0]}>
                {wk.map((d, i) => {
                  const inMonth = d.startsWith(month);
                  const h = hol.get(d);
                  const items = (byDay.get(d) ?? []).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
                  const isToday = d === today;
                  const label = new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
                  return (
                    <td
                      key={d}
                      aria-label={`${label}${h ? `, ${h.name}` : ""}${items.length ? `, ${items.length} ${items.length === 1 ? "tarefa" : "tarefas"}` : ""}`}
                      className={cn(
                        "h-[120px] border-b border-r border-border p-1.5 align-top last:border-r-0",
                        !inMonth && "bg-surface/70",
                        inMonth && (i === 0 || i === 6) && "bg-[color-mix(in_srgb,var(--surface)_45%,var(--bg))]",
                        h && inMonth && (h.kind === "nacional" ? "bg-[color-mix(in_srgb,var(--danger)_5%,var(--bg))]" : "bg-[color-mix(in_srgb,var(--warning)_6%,var(--bg))]"),
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={cn(
                            "grid size-7 place-items-center rounded-pill text-sm tabular-nums",
                            isToday ? "bg-accent font-semibold text-on-accent shadow-[0_4px_12px_-4px_rgba(29,78,216,.7)]" : inMonth ? "text-fg" : "text-muted",
                            h?.kind === "nacional" && !isToday && inMonth && "font-semibold text-danger",
                          )}
                        >
                          {Number(d.slice(8))}
                        </span>
                        {items.length > 0 && <span className="mt-1 rounded-pill bg-accent-soft px-1.5 text-[11px] font-medium tabular-nums text-accent-text">{items.length}</span>}
                      </div>
                      {h && (
                        <p className={cn("mt-1 truncate rounded-xs px-1.5 py-0.5 text-[11px] font-medium", h.kind === "nacional" ? "bg-danger-soft text-danger" : "bg-[color-mix(in_srgb,var(--warning)_15%,var(--bg))] text-warning")} title={h.kind === "facultativo" ? `${h.name} (ponto facultativo)` : h.name}>
                          {h.name}
                        </p>
                      )}
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {items.slice(0, 3).map((t) => {
                          const late = !t.completedAt && t.dueAt < nowIso;
                          const content = (
                            <>
                              <span className={cn("size-1.5 shrink-0 rounded-pill", t.completedAt ? "bg-success" : late ? "bg-danger" : "bg-accent")} aria-hidden />
                              <span className="tabular-nums text-muted">{time(t.dueAt)}</span>
                              <span className={cn("truncate", t.completedAt && "text-muted line-through")}>{t.text || "Tarefa"}</span>
                            </>
                          );
                          const cls = "flex items-center gap-1 rounded-xs px-1 py-0.5 text-[11px] text-fg";
                          return (
                            <li key={t.id} title={`${t.text}${t.lead ? ` · ${leadTitle(t.lead)}` : ""}${showOwner ? ` · ${t.owner}` : ""}`}>
                              {t.lead ? (
                                <Link href={`/${slug}/leads/${t.lead.id}`} className={cn(cls, "hover:bg-accent-soft")}>
                                  {content}
                                </Link>
                              ) : (
                                <span className={cls}>{content}</span>
                              )}
                            </li>
                          );
                        })}
                        {items.length > 3 && <li className="px-1 text-[11px] font-medium text-accent-text">+{items.length - 3} mais</li>}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <section aria-labelledby="fer-t" className="min-w-64 flex-1">
          <h2 id="fer-t" className="mb-2 text-sm font-semibold text-fg">
            Feriados do mês
          </h2>
          {monthHolidays.length === 0 ? (
            <p className="text-sm text-muted">Nenhum feriado nacional neste mês.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {monthHolidays.map((h) => (
                <li key={h.date} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2 rounded-pill", h.kind === "nacional" ? "bg-danger" : "bg-warning")} aria-hidden />
                  <span className="w-28 tabular-nums text-muted">{new Date(`${h.date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                  <span className="text-fg">{h.name}</span>
                  {h.kind === "facultativo" && <span className="text-xs text-muted">(ponto facultativo)</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-pill bg-accent" /> a fazer</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-pill bg-danger" /> atrasada</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-pill bg-success" /> concluída</span>
          <span>Feriados estaduais e municipais não aparecem.</span>
        </p>
      </div>
    </div>
  );
}
