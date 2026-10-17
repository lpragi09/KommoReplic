import Link from "next/link";
import { ByParam, ParamTabs } from "@/components/pipeline/views";
import { CalendarCheck } from "@/components/ui/icons";
import { listMarks, listTasks } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/bits";
import { TaskItem } from "@/components/lead/feed";
import {
  MonthCalendar,
  UpcomingDays,
  localDay,
  monthGrid,
  shiftMonth,
} from "@/components/calendar/month";
import { ChevronRight } from "@/components/ui/icons";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const TZ = "America/Sao_Paulo";
/** meia-noite de hoje no fuso do workspace, em UTC */
function startOfDay(offsetDays = 0) {
  const ymd = new Date(Date.now() + offsetDays * 864e5).toLocaleDateString(
    "en-CA",
    { timeZone: TZ },
  );
  return new Date(`${ymd}T00:00:00-03:00`).toISOString(); // TODO: offset vindo do fuso do workspace
}

export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<"/[ws]/calendar">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as {
    who?: string;
    done?: string;
    view?: string;
    m?: string;
  };
  const { who = "me", done } = sp;
  const view = sp.view === "lista" ? "lista" : "mes";
  const { user, ws } = await requireWorkspace(slug);
  // datas só depois de ler a sessão: a página é dinâmica (o Next não congela "hoje" no build)
  const thisMonth = localDay(new Date().toISOString()).slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? "") ? sp.m! : thisMonth;
  const grid = monthGrid(month);
  // as duas visões chegam prontas: trocar Mês/Lista é instantâneo (ByParam)
  const [marks, monthTasks, listTasksAll] = await Promise.all([
    listMarks(ws.id, grid.days[0], grid.days[grid.days.length - 1]),
    listTasks(ws.id, { owner: who === "me" ? user.id : undefined, from: new Date(grid.from).toISOString(), to: new Date(grid.to).toISOString() }),
    listTasks(ws.id, { owner: who === "me" ? user.id : undefined, open: done ? undefined : true }),
  ]);
  const tasks = listTasksAll;
  const q = (p: Record<string, string | undefined>, v: "mes" | "lista" = view) => {
    const s = new URLSearchParams(
      Object.entries({
        who,
        view: v === "lista" ? "lista" : undefined,
        m: v === "mes" ? month : undefined,
        done,
        ...p,
      }).filter(([, v]) => v) as [string, string][],
    );
    return `/${slug}/calendar?${s}`;
  };
  const monthLabel = new Date(`${month}-15T12:00:00Z`)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
  const today = startOfDay(0);
  const tomorrow = startOfDay(1);
  const after = startOfDay(2);
  const groups = [
    {
      key: "late",
      title: "Atrasadas",
      items: tasks.filter(
        (t) => !t.completedAt && t.dueAt < new Date().toISOString(),
      ),
    },
    {
      key: "today",
      title: "Hoje",
      items: tasks.filter(
        (t) =>
          t.dueAt >= today &&
          t.dueAt < tomorrow &&
          !(t.dueAt < new Date().toISOString() && !t.completedAt),
      ),
    },
    {
      key: "tomorrow",
      title: "Amanhã",
      items: tasks.filter((t) => t.dueAt >= tomorrow && t.dueAt < after),
    },
    {
      key: "later",
      title: "Depois",
      items: tasks.filter((t) => t.dueAt >= after),
    },
    {
      key: "past",
      title: "Antes (concluídas)",
      items: tasks.filter((t) => t.completedAt && t.dueAt < today),
    },
  ].filter((g) => g.items.length);

  const tab = (v: string, label: string, on: boolean, cur: "mes" | "lista") => (
    <Link
      href={q({ who: v }, cur)}
      aria-current={on ? "page" : undefined}
      className={cn(
        "h-8 rounded-pill px-3 text-sm leading-8",
        on
          ? "bg-inverse-bg text-on-inverse"
          : "text-muted hover:bg-surface hover:text-fg",
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Calendário">
        <ParamTabs
          param="view"
          label="Visão"
          fallback="mes"
          options={[
            { value: "mes", label: "Mês" },
            { value: "lista", label: "Lista" },
          ]}
        />
        <ByParam
          param="view"
          fallback="mes"
          nodes={{
            lista: (
              <>
                <nav aria-label="De quem" className="flex gap-1">
                  {tab("me", "Minhas", who === "me", "lista")}
                  {tab("all", "Da equipe", who === "all", "lista")}
                </nav>
                <Link href={q({ done: done ? undefined : "1" }, "lista")} className="text-sm text-accent-text underline">
                  {done ? "Esconder concluídas" : "Mostrar concluídas"}
                </Link>
              </>
            ),
            mes: (
              <>
                <nav aria-label="De quem" className="flex gap-1">
                  {tab("me", "Minhas", who === "me", "mes")}
                  {tab("all", "Da equipe", who === "all", "mes")}
                </nav>
                <nav aria-label="Mês" className="ml-auto flex items-center gap-1">
                  <Link href={q({ m: shiftMonth(month, -1) }, "mes")} aria-label="Mês anterior" className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg">
                    <ChevronRight className="size-4 rotate-180" aria-hidden />
                  </Link>
                  <span className="min-w-36 text-center text-sm font-semibold text-fg" aria-live="polite">
                    {monthLabel}
                  </span>
                  <Link href={q({ m: shiftMonth(month, 1) }, "mes")} aria-label="Próximo mês" className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg">
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                  {month !== thisMonth && (
                    <Link href={q({ m: thisMonth }, "mes")} className="ml-1 h-8 rounded-pill px-3 text-sm leading-8 text-accent-text hover:bg-accent-soft">
                      Hoje
                    </Link>
                  )}
                </nav>
              </>
            ),
          }}
        />
      </PageHeader>
      <ByParam
        param="view"
        fallback="mes"
        nodes={{
          mes: (
        <div className="flex-1 overflow-y-auto bg-surface">
          <div className="mx-auto max-w-7xl p-4 sm:p-6">
            <MonthCalendar
              slug={slug}
              month={month}
              tasks={monthTasks}
              marks={marks}
              showOwner={who === "all"}
            />
          </div>
        </div>
          ),
          lista: (
        <div className="flex-1 overflow-y-auto bg-surface">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
            {groups.length === 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-bg px-4 py-3 text-sm text-muted shadow-[0_0_0_1px_var(--border)]">
                <CalendarCheck className="size-4 text-success" aria-hidden /> Tudo em dia: nenhuma tarefa aberta. Crie tarefas pelo cartão de cada lead.
              </p>
            )}
            <UpcomingDays slug={slug} tasks={tasks} />
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`g-${g.key}`}>
                <h2
                  id={`g-${g.key}`}
                  className={cn(
                    "mb-2 text-caps uppercase",
                    g.key === "late" ? "text-danger" : "text-muted",
                  )}
                >
                  {g.title} ({g.items.length})
                </h2>
                <ul className="flex flex-col gap-2">
                  {g.items.map((t) => (
                    <li key={t.id}>
                      <TaskItem slug={slug} t={t} />
                      <p className="mt-1 flex gap-2 px-1 text-xs text-muted">
                        {t.lead && (
                          <Link
                            href={`/${slug}/leads/${t.lead.id}`}
                            className="text-accent-text hover:underline"
                          >
                            {leadTitle(t.lead)}
                          </Link>
                        )}
                        {who === "all" && <span>· {t.owner}</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
          ),
        }}
      />
    </>
  );
}
