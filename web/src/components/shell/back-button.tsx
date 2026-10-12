"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Quantas telas a pessoa já visitou DENTRO do app nesta aba.
   As trocas de tela não recarregam a página, então o document.referrer não serve. */
let visited = 0;

/** Montado uma vez no layout: conta cada troca de tela. */
export function NavTracker() {
  const path = usePathname();
  useEffect(() => {
    visited += 1;
  }, [path]);
  return null;
}

/** Voltar para a tela anterior do app. Se não houver (chegou por link ou favorito), vai para a tela-pai. */
export function BackButton({ fallback, label = "Voltar", className }: { fallback?: string; label?: string; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  // tela-pai: /ws/a/b -> /ws/a ; /ws/a -> /ws/leads (o funil é a "casa")
  const parts = path.split("/").filter(Boolean);
  const parent = fallback ?? (parts.length > 2 ? "/" + parts.slice(0, -1).join("/") : `/${parts[0] ?? ""}/leads`);
  return (
    <button
      type="button"
      onClick={() => (visited > 1 ? router.back() : router.push(parent))}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted transition-[background-color,color,transform] duration-fast ease-out hover:bg-surface hover:text-fg active:scale-95",
        className,
      )}
    >
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );
}
