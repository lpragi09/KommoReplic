"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Tempo real provisório: recarrega os dados do servidor a cada 4s com a aba visível.
   O replica-backend troca por Supabase Realtime (canal ws:{workspace_id}). */
export function LiveRefresh({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !document.querySelector("[data-editing]")) router.refresh();
    }, ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
