"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCheck, Clock, FileText, Mic, Paperclip, Send, Smile, StickyNote } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Badge } from "@/components/ui/bits";
import { Button, IconButton } from "@/components/ui/button";

export type MsgStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type Msg =
  | { id: string; kind: "in" | "out"; text: string; at: string; status?: MsgStatus }
  | { id: string; kind: "note"; text: string; at: string; author: string }
  | { id: string; kind: "system"; text: string; at: string };

const statusText: Record<MsgStatus, string> = {
  sending: "enviando",
  sent: "enviada",
  delivered: "entregue",
  read: "lida",
  failed: "falhou",
};

function StatusIcon({ s }: { s: MsgStatus }) {
  const cls = "size-3.5";
  const icon = {
    sending: <Clock className={cls} aria-hidden />,
    sent: <Check className={cls} aria-hidden />,
    delivered: <CheckCheck className={cls} aria-hidden />,
    read: <CheckCheck className={cn(cls, "text-accent")} aria-hidden />,
    failed: <AlertTriangle className={cn(cls, "text-danger")} aria-hidden />,
  }[s];
  return (
    <>
      {icon}
      <span className="sr-only">{statusText[s]}</span>
    </>
  );
}

export function MessageBubble({ m, onRetry }: { m: Msg; onRetry?: () => void }) {
  if (m.kind === "system") {
    return <p className="py-1 text-center text-xs text-muted">{m.text} · {m.at}</p>;
  }
  if (m.kind === "note") {
    return (
      <div className="rounded-lg border border-border bg-bubble-note px-3 py-2">
        <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-warning">
          <StickyNote className="size-3.5" aria-hidden /> Nota interna · {m.author}
        </p>
        <p className="text-base text-fg">{m.text}</p>
        <p className="mt-1 text-right text-xs text-muted">{m.at}</p>
      </div>
    );
  }
  const out = m.kind === "out";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[72%] rounded-lg px-3 py-2",
          out ? "rounded-br-xs bg-bubble-out" : "rounded-bl-xs border border-border bg-bubble-in",
        )}
      >
        <p className="whitespace-pre-wrap text-base text-fg">{m.text}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted">
          {m.at}
          {out && m.status && <StatusIcon s={m.status} />}
        </p>
        {m.status === "failed" && (
          <button onClick={onRetry} className="mt-1 text-xs font-semibold text-danger hover:underline">
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}

type Mode = "chat" | "note" | "task" | "email";
const modes: { value: Mode; label: string }[] = [
  { value: "chat", label: "Chat" },
  { value: "note", label: "Nota" },
  { value: "task", label: "Tarefa" },
  { value: "email", label: "Email" },
];

export function Composer({ windowClosed = false }: { windowClosed?: boolean }) {
  const [mode, setMode] = useState<Mode>("chat");
  const [text, setText] = useState("");
  const blocked = windowClosed && mode === "chat";
  return (
    <div className="rounded-md border border-border bg-bg">
      <div role="tablist" aria-label="Tipo de registro" className="flex gap-3 border-b border-border px-3">
        {modes.map((m) => (
          <button
            key={m.value}
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              "-mb-px h-8 border-b-2 text-sm font-medium",
              mode === m.value ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {blocked && (
        <div className="flex items-center justify-between gap-3 bg-warning-soft px-3 py-2 text-sm text-warning">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-4" aria-hidden />
            Fora da janela de 24h — só modelos aprovados.
          </span>
          <Button size="sm" variant="secondary" icon={<FileText className="size-4" aria-hidden />}>
            Escolher modelo
          </Button>
        </div>
      )}
      <label htmlFor="composer" className="sr-only">
        {mode === "note" ? "Escrever nota interna" : "Escrever mensagem"}
      </label>
      <textarea
        id="composer"
        rows={2}
        value={text}
        disabled={blocked}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          mode === "note" ? "Nota interna — use @ para chamar um colega" : "Escreva… use / para modelos, [ para campos"
        }
        className={cn(
          "block w-full resize-none px-3 py-2 text-base text-fg outline-none placeholder:text-muted disabled:bg-surface",
          mode === "note" && "bg-bubble-note",
        )}
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        <IconButton label="Emoji" size={28} disabled={blocked}>
          <Smile className="size-4" />
        </IconButton>
        <IconButton label="Anexar arquivo" size={28} disabled={blocked}>
          <Paperclip className="size-4" />
        </IconButton>
        <IconButton label="Gravar áudio" size={28} disabled={blocked}>
          <Mic className="size-4" />
        </IconButton>
        <Button size="sm" className="ml-auto" disabled={!text.trim() || blocked} icon={<Send className="size-4" aria-hidden />}>
          {mode === "note" ? "Salvar nota" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

export type Conv = { id: string; name: string; channel: string; preview: string; at: string; unread: number; waiting?: string };

export function ConversationList({ items, activeId }: { items: Conv[]; activeId?: string }) {
  return (
    <ul role="listbox" aria-label="Conversas" className="w-[var(--inbox-list)] divide-y divide-border border-r border-border bg-bg">
      {items.map((c) => {
        const on = c.id === activeId;
        return (
          <li
            key={c.id}
            role="option"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={cn("relative flex cursor-pointer gap-3 px-4 py-3 hover:bg-surface", on && "bg-accent-soft hover:bg-accent-soft")}
          >
            {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden />}
            <Avatar name={c.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className={cn("flex-1 truncate text-base text-fg", c.unread ? "font-semibold" : "font-medium")}>{c.name}</span>
                <time className="text-xs text-muted">{c.at}</time>
              </div>
              <p className="truncate text-sm text-muted">
                <span className="sr-only">{c.channel}: </span>
                {c.preview}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted">{c.channel}</span>
                {c.waiting && <span className="text-xs font-medium text-warning">Sem resposta há {c.waiting}</span>}
                {c.unread > 0 && (
                  <Badge className="ml-auto">
                    {c.unread}
                    <span className="sr-only"> não lidas</span>
                  </Badge>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
