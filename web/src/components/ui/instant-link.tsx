"use client";

import { createContext, use, useEffect, useOptimistic, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

/* Trocas que dependem do endereço (filtros, abas, período) acendem na hora do clique.
   A página nova vem do servidor por trás; enquanto isso a opção escolhida já aparece marcada
   e o conteúdo fica levemente apagado. Quando a resposta chega, o React assume o estado real. */

/** enquanto a página nova não chega, marca o documento: o CSS apaga um pouco o conteúdo (sem travar a tela) */
function useBusy(pending: boolean) {
  useEffect(() => {
    if (!pending) return;
    const el = document.documentElement;
    el.dataset.busy = "1";
    return () => {
      delete el.dataset.busy;
    };
  }, [pending]);
}

type Group = { picked: string | null; go: (href: string) => void; pending: boolean };
const Ctx = createContext<Group | null>(null);

/** agrupa links que se excluem (só um aceso por vez) */
export function LinkGroup({ children, className, label, as = "nav" }: { children: ReactNode; className?: string; label?: string; as?: "nav" | "div" | "ul" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useOptimistic<string | null>(null);
  useBusy(pending);
  const go = (href: string) =>
    start(() => {
      setPicked(href);
      router.push(href, { scroll: false });
    });
  const Tag = as;
  return (
    <Ctx value={{ picked, go, pending }}>
      <Tag aria-label={label} className={className} aria-busy={pending || undefined}>
        {children}
      </Tag>
    </Ctx>
  );
}

/** link do grupo: `active` é o estado do servidor; no clique ele já se marca e desmarca os vizinhos */
export function InstantLink({
  href,
  active,
  className,
  activeClassName,
  inactiveClassName,
  children,
  current = "page",
}: {
  href: string;
  active: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  children: ReactNode;
  current?: "page" | "true";
}) {
  const g = use(Ctx);
  const on = g?.picked ? g.picked === href : active;
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? current : undefined}
      onClick={(e) => {
        if (!g || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nova aba continua normal
        e.preventDefault();
        g.go(href);
      }}
      className={cn(className, on ? activeClassName : inactiveClassName)}
    >
      {children}
    </Link>
  );
}

/** parâmetros do endereço com troca otimista (filtros que a própria tela monta, como no funil) */
export function useInstantParams() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [query, setQuery] = useOptimistic(sp.toString());
  useBusy(pending);
  const params = new URLSearchParams(query);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(query);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => {
      setQuery(next.toString());
      router.replace(`${path}?${next.toString()}`, { scroll: false });
    });
  };
  return { params, set, pending };
}
