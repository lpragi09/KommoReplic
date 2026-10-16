"use client";

import { useState, useTransition } from "react";
import { setConversationAiAction } from "@/app/actions";
import { Sparkle } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Na conversa: mostra se o agente de IA está atendendo e deixa pausar ou devolver para ele. */
export function AiSwitch({ slug, conversationId, paused }: { slug: string; conversationId: string; paused: boolean }) {
  const [off, setOff] = useState(paused);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toggle = () =>
    start(async () => {
      const res = await setConversationAiAction(slug, conversationId, !off);
      if (!res.ok) return setError(res.error);
      setError(null);
      setOff(!off);
    });
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={!off}
        title={off ? "A IA não responde esta conversa. Clique para ela voltar a atender." : "A IA está respondendo. Clique para pausar e atender você."}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm font-medium transition-colors duration-fast disabled:opacity-60",
          off ? "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--border)] hover:text-fg" : "bg-accent-soft text-accent-text hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
        )}
      >
        <Sparkle className="size-3.5" weight={off ? "regular" : "fill"} aria-hidden />
        {off ? "IA pausada · devolver" : "IA atendendo · pausar"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
