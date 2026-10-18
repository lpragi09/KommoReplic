import type { ReactNode } from "react";
import { notFound } from "next/navigation";

/* Galeria do design system: ferramenta de desenvolvimento. Em produção só abre com SHOW_DESIGN=1. */
export default function DesignLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DESIGN !== "1") notFound();
  return children;
}
