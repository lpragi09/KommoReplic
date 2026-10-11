import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { listTasks } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/bits";
import { TaskItem } from "@/components/lead/feed";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const TZ = "America/Sao_Paulo";
/** meia-noite de hoje no fuso do workspace, em UTC */
function startOfDay(offsetDays = 0) {
  const ymd = new Date(Date.now() + offsetDays * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  return new Date(`${ymd}T00:00:00-03:00`).toISOString(); // TODO: offset vindo do fuso do workspace
}

export default async function CalendarPage({ params, searchParams }: PageProps<"/[ws]/calendar">) {
  const { ws: slug } = await params;
  const { who = "me", done } = (await searchParams) as { who?: string; done?: string };
  const { user, ws } = await requireWorkspace(slug);
  const tasks = await listTasks(ws.id, { owner: who === "me" ? user.id : undefined, open: done ? undefined : true });
  const today = startOfDay(0);
  const tomorrow = startOfDay(1);
  const after = startOfDay(2);
  const groups = [
    { key: "late", title: "Atrasadas", items: tasks.filter((t) => !t.completedAt && t.dueAt < new Date().toISOString()) },
    { key: "today", title: "Hoje", items: tasks.filter((t) => t.dueAt >= today && t.dueAt < tomorrow && !(t.dueAt < new Date().toISOString() && !t.completedAt)) },
    { key: "tomorrow", title: "Amanhã", items: tasks.filter((t) => t.dueAt >= tomorrow && t.dueAt < after) },
    { key: "later", title: "Depois", items: tasks.filter((t) => t.dueAt >= after) },
    { key: "past", title: "Antes (concluídas)", items: tasks.filter((t) => t.completedAt && t.dueAt < today) },
  ].filter((g) => g.items.length);

  const tab = (v: string, label: string, on: boolean, extra = "") => (
    <Link
      href={`/${slug}/calendar?who=${v}${extra}`}
      aria-current={on ? "page" : undefined}
      className={cn("h-8 rounded-pill px-3 text-sm leading-8", on ? "bg-inverse-bg text-on-inverse" : "text-muted hover:bg-surface hover:text-fg")}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Tarefas">
        <nav aria-label="De quem" className="flex gap-1">
          {tab("me", "Minhas", who === "me", done ? "&done=1" : "")}
          {tab("all", "Da equipe", who === "all", done ? "&done=1" : "")}
        </nav>
        <Link href={`/${slug}/calendar?who=${who}${done ? "" : "&done=1"}`} className="text-sm text-accent-text underline">
          {done ? "Esconder concluídas" : "Mostrar concluídas"}
        </Link>
      </PageHeader>
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
          {groups.length === 0 && (
            <EmptyState icon={CalendarCheck} title="Tudo em dia" text="Nenhuma tarefa aberta. Crie tarefas pelo cartão de cada lead." />
          )}
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <h2 id={`g-${g.key}`} className={cn("mb-2 text-caps uppercase", g.key === "late" ? "text-danger" : "text-muted")}>
                {g.title} ({g.items.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {g.items.map((t) => (
                  <li key={t.id}>
                    <TaskItem slug={slug} t={t} />
                    <p className="mt-1 flex gap-2 px-1 text-xs text-muted">
                      {t.lead && (
                        <Link href={`/${slug}/leads/${t.lead.id}`} className="text-accent-text hover:underline">
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
    </>
  );
}
