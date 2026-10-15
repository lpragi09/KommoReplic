"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { tickRobotsAction } from "@/app/actions";

const editing = () => !!document.querySelector("[data-editing]");

/* Atualização ao vivo.
   - Supabase: assina o canal privado ws:{workspace} (o banco avisa por trigger) e recarrega os dados
     do servidor; quem decide o que aparece continua sendo o RLS.
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
      const refresh = () => {
        // junta rajadas de eventos (ex.: 20 mensagens chegando) num refresh só
        if (pending) return;
        pending = setTimeout(() => {
          pending = null;
          if (!editing()) router.refresh();
        }, 300);
      };
      let channel: ReturnType<typeof sb.channel> | null = null;
      void sb.realtime.setAuth().then(() => {
        channel = sb.channel(`ws:${wsId}`, { config: { private: true } }).on("broadcast", { event: "change" }, refresh).subscribe();
      });
      return () => {
        if (pending) clearTimeout(pending);
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
