"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import type { TeamMessage } from "@/data/types";
import { sendTeamMessageAction } from "@/app/actions";
import { Avatar, EmptyState } from "@/components/ui/bits";
import { IconButton } from "@/components/ui/button";
import { MessageSquare, Send } from "@/components/ui/icons";
import { dayLabel, timeOnly } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Conversa interna da equipe: combinar quem atende quem, avisar de reunião, pedir ajuda. O cliente nunca vê. */
export function TeamChat({ slug, meId, meName, messages }: { slug: string; meId: string; meName: string; messages: TeamMessage[] }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [list, addOptimistic] = useOptimistic(messages, (cur, m: TeamMessage) => [...cur, m]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [list.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    start(async () => {
      addOptimistic({ id: `tmp-${Date.now()}`, userId: meId, userName: meName, body, createdAt: new Date().toISOString() });
      const res = await sendTeamMessageAction(slug, body);
      if (!res.ok) {
        setError(res.error);
        setText(body);
      } else setError(null);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {list.length === 0 ? (
          <div className="grid h-full place-items-center">
            <EmptyState icon={MessageSquare} title="Chat da equipe" text="Combine quem atende quem, avise de reuniões e peça ajuda. Só a equipe vê." />
          </div>
        ) : (
          <ol className="mx-auto flex max-w-3xl flex-col gap-1">
            {list.map((m, i) => {
              const day = dayLabel(m.createdAt);
              const showDay = i === 0 || dayLabel(list[i - 1].createdAt) !== day;
              const mine = m.userId === meId;
              const grouped = i > 0 && list[i - 1].userId === m.userId && !showDay;
              return (
                <li key={m.id} className="flex flex-col">
                  {showDay && <p className="my-3 self-center rounded-pill bg-bg px-3 py-0.5 text-xs text-muted shadow-[0_0_0_1px_var(--border)]">{day}</p>}
                  <div className={cn("flex items-end gap-2", mine && "flex-row-reverse", grouped ? "mt-0.5" : "mt-2")}>
                    <span className={cn("shrink-0", grouped && "invisible")}>
                      <Avatar name={m.userName} size={32} />
                    </span>
                    <div className={cn("max-w-[75%] rounded-md px-3 py-2 shadow-[0_1px_2px_rgba(14,26,58,.08)]", mine ? "rounded-br-xs bg-accent text-on-accent" : "rounded-bl-xs bg-bg text-fg")}>
                      {!grouped && !mine && <p className="mb-0.5 text-xs font-semibold text-accent-text">{m.userName}</p>}
                      <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                      <p className={cn("mt-0.5 text-right text-[11px] tabular-nums", mine ? "text-on-accent" : "text-muted")}>{timeOnly(m.createdAt)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div ref={end} />
      </div>
      <form
        className="border-t border-border bg-bg p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {error && (
          <p role="alert" className="mx-auto mb-2 max-w-3xl text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label htmlFor="team-msg" className="sr-only">
            Mensagem para a equipe
          </label>
          <textarea
            id="team-msg"
            rows={1}
            value={text}
            maxLength={4000}
            placeholder="Escreva para a equipe…  (Enter envia, Shift+Enter quebra linha)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2 text-base text-fg shadow-[inset_0_1px_2px_rgba(14,26,58,.06)] focus:border-focus focus:outline-none focus:shadow-[0_0_0_4px_rgba(37,99,235,.15)] [field-sizing:content]"
          />
          <IconButton type="submit" label="Enviar" size={36} tone="accent" disabled={!text.trim()}>
            <Send className="size-5" />
          </IconButton>
        </div>
      </form>
    </div>
  );
}
