"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { Subscription } from "@/data/types";
import { deleteAccountAction, openBillingPortalAction, startCheckoutAction } from "@/app/actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";

const plans = [
  { key: "autonomo", name: "Autônomo", m: 59, a: 49 },
  { key: "equipe", name: "Equipe", m: 99, a: 82 },
  { key: "operacao", name: "Operação", m: 159, a: 132 },
] as const;
const planOf = { trial: "Teste grátis", basic: "Autônomo", advanced: "Equipe", pro: "Operação" };
const statusOf = { trialing: "em teste", active: "ativo", past_due: "pagamento pendente", canceled: "cancelado", unpaid: "não pago" };

export function Billing({ slug, sub }: { slug: string; sub: Subscription }) {
  const [annual, setAnnual] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const go = (p: Promise<{ ok: true; data: { url: string | null } } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await p;
      if (!r.ok) return setError(r.error);
      if (r.data.url) window.location.href = r.data.url;
    });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-md border border-border p-4" aria-label="Plano atual">
        <p className="text-sm text-muted">Plano atual</p>
        <p className="text-lg text-fg">
          {planOf[sub.plan]} · <span className={cn(sub.status === "past_due" || sub.status === "unpaid" ? "text-danger" : "text-muted")}>{statusOf[sub.status]}</span>
        </p>
        <p className="text-sm text-muted">
          {sub.seats} {sub.seats === 1 ? "usuário" : "usuários"}
          {sub.trialEndsAt && sub.status === "trialing" && <> · teste até {new Date(sub.trialEndsAt).toLocaleDateString("pt-BR")}</>}
        </p>
        {sub.stripeCustomerId && (
          <Button className="mt-3" variant="secondary" loading={pending} onClick={() => go(openBillingPortalAction(slug, sub.stripeCustomerId!))}>
            Trocar plano, cartão ou cancelar
          </Button>
        )}
      </section>

      <section aria-label="Assinar">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm text-fg">Mensal</span>
          <button
            role="switch"
            aria-checked={annual}
            aria-label="Cobrança anual (2 meses grátis)"
            onClick={() => setAnnual((v) => !v)}
            className={cn("relative h-6 w-11 rounded-pill transition-colors", annual ? "bg-accent" : "bg-border-input")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-pill bg-bg transition-transform", annual ? "translate-x-5" : "translate-x-0.5")} />
          </button>
          <span className="text-sm text-fg">Anual · 2 meses grátis</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <li key={p.key} className="flex flex-col rounded-md border border-border p-4">
              <p className="font-medium text-fg">{p.name}</p>
              <p className="mt-1 text-xl text-fg">
                R$ {annual ? p.a : p.m}
                <span className="text-sm text-muted"> /usuário/mês</span>
              </p>
              <Button className="mt-4" size="sm" loading={pending} onClick={() => go(startCheckoutAction(slug, `${p.key}_${annual ? "anual" : "mensal"}`, sub.seats))}>
                Assinar
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Check className="size-4 text-success" aria-hidden /> Sem fidelidade: cancela em um clique pelo botão acima.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="rounded-md border border-danger p-4" aria-labelledby="del-t">
      <h2 id="del-t" className="font-medium text-danger">
        Excluir minha conta
      </h2>
      <p className="mt-1 text-sm text-muted">Apaga seu login e seus dados. Empresas em que você é a única pessoa são apagadas junto, com leads, conversas e arquivos.</p>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Excluir a conta para sempre?"
        description="Não dá para desfazer. Digite EXCLUIR para confirmar."
        trigger={
          <Button variant="danger" size="sm" className="mt-3">
            Excluir minha conta
          </Button>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={confirm !== "EXCLUIR"} loading={pending} onClick={() => start(() => deleteAccountAction())}>
              Excluir para sempre
            </Button>
          </>
        }
      >
        <label htmlFor="del-confirm" className="sr-only">
          Digite EXCLUIR
        </label>
        <input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-9 w-full rounded-sm border border-border-input px-2 text-base" autoComplete="off" />
      </Dialog>
    </section>
  );
}
