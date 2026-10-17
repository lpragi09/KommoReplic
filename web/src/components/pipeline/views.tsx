"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/** Kanban e Lista chegam prontos do servidor; a troca é só aqui no navegador (sem buscar a página de novo). */
export function LeadsViews({ kanban, list }: { kanban: ReactNode; list: ReactNode }) {
  return useSearchParams().get("view") === "list" ? list : kanban;
}
