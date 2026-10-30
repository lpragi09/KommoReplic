"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { Pipeline } from "@/data/types";
import { leadFromConversationAction, moveLeadAction } from "@/app/actions";
import { cn } from "@/lib/cn";

/* No topo do chat: põe a conversa no funil (cria o lead na etapa escolhida) ou muda a etapa do lead,
   sem sair da conversa. As etapas vêm agrupadas por funil. */
export function FunnelPicker({ slug, conversationId, lead, pipelines }: { slug: string; conversationId: string; lead: { id: string; stageId: string } | null; pipelines: Pipeline[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const change = (stageId: string) =>
    start(async () => {
      if (!stageId || stageId === lead?.stageId) return;
      const r = lead ? await moveLeadAction(slug, lead.id, stageId) : await leadFromConversationAction(slug, conversationId, stageId);
      if (!r.ok) return setError(r.error);
      setError(null);
      router.refresh();
    });
  return (
    <label className="flex flex-col gap-0.5">
      <span className="sr-only">{lead ? "Etapa do lead" : "Colocar no funil"}</span>
      <select
        value={lead?.stageId ?? ""}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        aria-busy={pending || undefined}
        className={cn(
          "h-9 max-w-[16rem] rounded-sm border px-2.5 text-sm text-fg outline-none focus-visible:border-focus disabled:opacity-60",
          lead ? "border-border bg-bg" : "border-accent bg-accent-soft font-medium text-accent-text",
        )}
      >
        {!lead && <option value="">Colocar no funil…</option>}
        {pipelines.map((p) => (
          <optgroup key={p.id} label={p.name}>
            {[...p.stages]
              .sort((a, b) => a.sort - b.sort)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {lead ? `Etapa: ${s.name}` : s.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}
