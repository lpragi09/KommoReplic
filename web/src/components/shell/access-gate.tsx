"use client";

import { daysLeftText } from "@/data/access";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Access } from "@/data/types";
import { Lightning, Sparkle } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Trava do teste grátis.
   - Em teste: faixa fina no topo com os dias que faltam (fica mais forte nos últimos 3).
   - Travado: toda tela vira o aviso para ativar o plano; só "Plano e cobrança" continua abrindo.
   O servidor também recusa as ações (requireActive): esconder a tela não é a única barreira. */
export function AccessGate({ slug, access, children, platformAdmin = false }: { slug: string; access: Access; children: ReactNode; platformAdmin?: boolean }) {
  const path = usePathname();
  const billing = `/${slug}/settings/billing`;
  const onBilling = path.startsWith(billing);

  if (access.state === "locked" && !onBilling) return <Paywall billing={billing} access={access} platformAdmin={platformAdmin} />;

  const urgent = access.state === "trial" && access.daysLeft !== null && access.daysLeft <= 2;
  return (
    <>
      {access.state === "trial" && access.daysLeft !== null && !onBilling && (
        <div
          role="status"
          className={cn(
            "flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm",
            urgent ? "bg-[linear-gradient(90deg,var(--accent),var(--stage-6))] text-on-accent" : "bg-accent-soft text-accent-text",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkle className="size-3.5" weight="fill" aria-hidden />
            Teste grátis: {daysLeftText(access.daysLeft)}
          </span>
          <Link href={billing} className={cn("font-semibold underline underline-offset-2", urgent ? "text-on-accent" : "text-accent-text")}>
            Escolher meu plano
          </Link>
        </div>
      )}
      {access.reason === "unpaid" && access.state === "active" && !onBilling && (
        <div role="alert" className="flex shrink-0 items-center justify-center gap-3 bg-danger-soft px-4 py-1.5 text-sm text-danger">
          O pagamento do plano não passou.
          <Link href={billing} className="font-semibold underline underline-offset-2">
            Atualizar cartão
          </Link>
        </div>
      )}
      {children}
    </>
  );
}

const copy: Record<NonNullable<Access["reason"]>, { title: string; text: string }> = {
  trial_over: {
    title: "Seu teste grátis terminou",
    text: "Seus leads, conversas e robôs estão guardados. Ative um plano para voltar a usar tudo de onde parou. Enquanto isso, as mensagens que chegarem continuam sendo salvas.",
  },
  unpaid: {
    title: "Plano suspenso por falta de pagamento",
    text: "Atualize o cartão para reativar. Nada foi apagado e as mensagens que chegarem continuam sendo salvas.",
  },
  canceled: {
    title: "Seu plano foi cancelado",
    text: "Seus dados continuam aqui. Escolha um plano para voltar a usar.",
  },
};

function Paywall({ billing, access, platformAdmin }: { billing: string; access: Access; platformAdmin: boolean }) {
  const c = copy[access.reason ?? "trial_over"];
  return (
    <div className="fx-aurora grid flex-1 place-items-center overflow-y-auto p-4">
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-bg p-8 text-center text-fg shadow-[0_0_0_1px_var(--border),0_30px_60px_-30px_rgba(0,0,0,.6)]">
        <span className="fx-glow mx-auto grid size-12 place-items-center rounded-lg bg-accent text-on-accent" aria-hidden>
          <Lightning className="size-6" weight="fill" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mx-auto mt-2 max-w-[44ch] text-base text-muted">{c.text}</p>
        <Link
          href={billing}
          className="fx-shine mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-accent px-6 text-md font-medium text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_8px_20px_-8px_rgba(31,122,85,.7)] hover:bg-accent-hover"
        >
          Ver planos e ativar
        </Link>
        <p className="mt-4 text-xs text-muted">Sem fidelidade. Cancela em um clique.</p>
        {/* dono do netzer: libera a própria empresa como cortesia pela Central */}
        {platformAdmin && (
          <Link href="/admin?aba=empresas" className="mt-5 inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-medium text-accent-text shadow-[inset_0_0_0_1px_var(--border-input)] hover:bg-accent-soft">
            Você é dono do netzer: liberar pela Central
          </Link>
        )}
      </div>
    </div>
  );
}
