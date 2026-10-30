"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { tickRobotsAction } from "@/app/actions";

const editing = () => !!document.querySelector("[data-editing]");

/* Atualização ao vivo.
   - Supabase: assina o canal privado ws:{workspace} (o banco avisa por trigger) e recarrega os dados
     do servidor; quem decide o que aparece continua sendo o RLS. Se o canal cair, consulta a cada 15s
     até voltar; ao voltar para a aba, recarrega uma vez (pode ter perdido avisos com a aba dormindo).
   - Repositório falso: recarrega a cada 4s com a aba visível. */
export function LiveRefresh({ wsId, slug, ms = 4000 }: { wsId: string; slug: string; ms?: number }) {
  const router = useRouter();

  // robôs com "Esperar": enquanto alguém da equipe está com o painel aberto, continua os que venceram
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void tickRobotsAction(slug).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [slug]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase") {
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      let pending: ReturnType<typeof setTimeout> | null = null;
      let last = 0;
      const refresh = () => {
        // no máximo um refresh a cada 3 s: rajadas de eventos (muitas mensagens chegando) viram um só
        if (pending) return;
        const wait = Math.max(300, last + 3000 - Date.now());
        pending = setTimeout(() => {
          pending = null;
          last = Date.now();
          if (!editing()) router.refresh();
        }, wait);
      };
      let channel: ReturnType<typeof sb.channel> | null = null;
      let fallback: ReturnType<typeof setInterval> | null = null;
      const startFallback = () => {
        fallback ??= setInterval(() => {
          if (document.visibilityState === "visible") refresh();
        }, 15_000);
      };
      const stopFallback = () => {
        if (fallback) clearInterval(fallback);
        fallback = null;
      };
      void sb.realtime
        .setAuth()
        .then(() => {
          channel = sb
            .channel(`ws:${wsId}`, { config: { private: true } })
            .on("broadcast", { event: "change" }, refresh)
            .subscribe((status) => {
              if (status === "SUBSCRIBED") stopFallback();
              else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") startFallback();
            });
        })
        .catch(startFallback);
      const onVisible = () => {
        if (document.visibilityState === "visible") refresh();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        if (pending) clearTimeout(pending);
        stopFallback();
        document.removeEventListener("visibilitychange", onVisible);
        if (channel) void sb.removeChannel(channel);
      };
    }
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !editing()) router.refresh();
    }, ms);
    return () => clearInterval(t);
  }, [router, ms, wsId]);

  return null;
}
