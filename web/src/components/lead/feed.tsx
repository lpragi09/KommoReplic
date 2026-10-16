"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRightLeft, Check, CheckCheck, CircleCheck, Clock, Sparkle, StickyNote } from "@/components/ui/icons";
import type { FeedItem, MessageStatus } from "@/data/types";
import { completeTaskAction } from "@/app/actions";
import { dayLabel, timeOnly, when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

const statusText: Record<MessageStatus, string> = {
  queued: "na fila",
  sent: "enviada",
  delivered: "entregue",
  read: "lida",
  failed: "falhou",
  received: "recebida",
};

function Status({ s }: { s: MessageStatus }) {
  const cls = "size-3.5";
  const icon =
    s === "queued" ? <Clock className={cls} aria-hidden /> :
    s === "sent" ? <Check className={cls} aria-hidden /> :
    s === "delivered" ? <CheckCheck className={cls} aria-hidden /> :
    s === "read" ? <CheckCheck className={cn(cls, "text-accent")} aria-hidden /> :
    s === "failed" ? <AlertTriangle className={cn(cls, "text-danger")} aria-hidden /> : null;
  return (
    <>
      {icon}
      <span className="sr-only">{statusText[s]}</span>
    </>
  );
}

type Filter = "all" | "message" | "note" | "task" | "event";
const filters: { v: Filter; label: string }[] = [
  { v: "all", label: "Tudo" },
  { v: "message", label: "Mensagens" },
  { v: "note", label: "Notas" },
  { v: "task", label: "Tarefas" },
  { v: "event", label: "Histórico" },
];

export function Feed({ slug, items, contactName }: { slug: string; items: FeedItem[]; contactName: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const end = useRef<HTMLLIElement>(null);
  const shown = filter === "all" ? items : items.filter((i) => i.type === filter);
  const count = items.length;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const rows = shown.map((it, i) => {
    const day = dayLabel(it.at);
    return { it, day, sep: i === 0 || dayLabel(shown[i - 1].at) !== day };
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="group" aria-label="Filtrar histórico" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-bg px-3 py-2">
        {filters.map((f) => (
          <button
            key={f.v}
            type="button"
            aria-pressed={filter === f.v}
            onClick={() => setFilter(f.v)}
            className={cn("h-7 shrink-0 rounded-pill px-3 text-sm", filter === f.v ? "bg-inverse-bg text-on-inverse" : "text-muted hover:bg-surface hover:text-fg")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-surface p-4" aria-live="polite" aria-relevant="additions">
        {shown.length === 0 && <li className="py-10 text-center text-sm text-muted">Nada por aqui ainda.</li>}
        {rows.map(({ it, day, sep }) => {
          const key = it.type === "message" ? it.message.id : it.type === "note" ? it.note.id : it.type === "task" ? it.task.id : it.event.id;
          return (
            <li key={`${it.type}-${key}`} className="flex flex-col gap-2">
              {sep && (
                <p className="my-1 text-center text-xs font-medium text-muted" suppressHydrationWarning>
                  {day}
                </p>
              )}
              <Item slug={slug} it={it} contactName={contactName} />
            </li>
          );
        })}
        <li ref={end} aria-hidden className="list-none" />
      </ol>
    </div>
  );
}

function Item({ slug, it, contactName }: { slug: string; it: FeedItem; contactName: string }) {
  if (it.type === "event") {
    return (
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <ArrowRightLeft className="size-3.5 shrink-0" aria-hidden />
        <span>
          {it.text} · <time suppressHydrationWarning>{timeOnly(it.at)}</time>
        </span>
      </p>
    );
  }
  if (it.type === "note") {
    return (
      <div className="rounded-lg border border-border bg-bubble-note px-3 py-2">
        <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-warning">
          <StickyNote className="size-3.5" aria-hidden /> Nota interna · {it.author}
        </p>
        <p className="whitespace-pre-wrap break-words text-base text-fg">{it.note.body}</p>
        <p className="mt-1 text-right text-xs text-muted" suppressHydrationWarning>
          {timeOnly(it.at)}
        </p>
      </div>
    );
  }
  if (it.type === "task") return <TaskItem slug={slug} t={it.task} />;

  const m = it.message;
  const out = m.direction === "out";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-lg px-3 py-2 sm:max-w-[72%]", out ? "rounded-br-xs bg-bubble-out" : "rounded-bl-xs border border-border bg-bubble-in")}>
        {!out && <p className="mb-0.5 text-xs font-semibold text-accent-text">{contactName}</p>}
        {m.byAi && (
          <p className="mb-0.5 inline-flex items-center gap-1 text-xs font-semibold text-accent-text">
            <Sparkle className="size-3" weight="fill" aria-hidden /> Agente de IA
          </p>
        )}
        <p className="whitespace-pre-wrap break-words text-base text-fg">{m.body}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted">
          <time suppressHydrationWarning>{timeOnly(m.sentAt)}</time>
          {out && <Status s={m.status} />}
        </p>
      </div>
    </div>
  );
}

export function TaskItem({ slug, t }: { slug: string; t: Extract<FeedItem, { type: "task" }>["task"] }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("");
  const [pending, start] = useTransition();
  const late = !t.completedAt && t.dueAt < new Date().toISOString();
  return (
    <div className={cn("rounded-lg border bg-bg px-3 py-2", late ? "border-danger" : "border-border")}>
      <div className="flex items-start gap-2">
        {t.completedAt ? <CircleCheck className="mt-0.5 size-4 text-success" aria-label="Concluída" /> : <Clock className={cn("mt-0.5 size-4", late ? "text-danger" : "text-accent")} aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className={cn("break-words text-base text-fg", t.completedAt && "text-muted line-through")}>{t.text || "Tarefa"}</p>
          <p className={cn("text-xs", late ? "text-danger" : "text-muted")} suppressHydrationWarning>
            {late && "Atrasada · "}Prazo: {when(t.dueAt)}
          </p>
          {t.resultText && <p className="mt-1 text-sm text-fg">Resultado: {t.resultText}</p>}
        </div>
        {!t.completedAt && !open && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Concluir
          </Button>
        )}
      </div>
      {open && (
        <form
          data-editing
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await completeTaskAction(slug, t.id, result);
              setOpen(false);
            });
          }}
        >
          <label className="sr-only" htmlFor={`res-${t.id}`}>
            Resultado da tarefa
          </label>
          <input
            id={`res-${t.id}`}
            autoFocus
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="O que aconteceu? (opcional)…"
            className="h-8 flex-1 rounded-sm border border-border-input px-2 text-base outline-none focus:border-focus"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" type="submit" loading={pending}>
              Concluir tarefa
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
