"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Voltar sempre sobe UMA seção (robô → Automações, canal → Configurações).
   Não usa o histórico do navegador: na tela principal de uma seção não há botão de voltar. */

/** mantido para o layout (antes contava telas para o histórico) */
export function NavTracker() {
  return null;
}

export function BackButton({ href, fallback, label = "Voltar", className }: { href?: string; fallback?: string; label?: string; className?: string }) {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  const parent = href ?? fallback ?? (parts.length > 2 ? "/" + parts.slice(0, -1).join("/") : `/${parts[0] ?? ""}`);
  return (
    <Link
      href={parent}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted transition-[background-color,color,transform] duration-fast ease-out hover:bg-surface hover:text-fg active:scale-95",
        className,
      )}
    >
      <ArrowLeft className="size-5" aria-hidden />
    </Link>
  );
}
