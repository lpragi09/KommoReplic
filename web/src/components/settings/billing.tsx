"use client";

import { daysLeftText } from "@/data/access";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Sparkle, Trash2 } from "@/components/ui/icons";
import type { Access, Subscription } from "@/data/types";
import { deleteAccountAction, startCheckoutAction } from "@/app/actions";
import { PLAN_PRICES, type PriceKey } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Switch } from "@/components/robots/parts";

const plans: { key: PriceKey; who: string; items: string[]; hot?: boolean }[] = [
  { key: "autonomo", who: "1 a 2 pessoas", items: ["1 funil", "Chat do site + 1 WhatsApp", "Tarefas e painel", "Robôs de boas-vindas", "IA com créditos avulsos"] },
  {
    key: "equipe",
    who: "o time de vendas",
    items: ["Funis ilimitados", "3 canais", "Papéis: todos, equipe ou só os meus", "Robôs ilimitados e disparos", "Agente de IA: 500 respostas/mês"],
    hot: true,
  },
  { key: "operacao", who: "filiais e alto volume", items: ["Canais ilimitados", "Agente de IA: 2.000 respostas/mês", "Relatórios completos", "Histórico de auditoria", "Suporte com prazo de resposta"] },
];
const planOf = { trial: "Teste grátis", basic: "Autônomo", advanced: "Equipe", pro: "Operação" };
const statusOf = { trialing: "em teste", active: "ativo", past_due: "pagamento pendente", canceled: "cancelado", unpaid: "não pago" };

export function Billing({ slug, sub, access, welcome }: { slug: string; sub: Subscription; access: Access; welcome: "new" | "no_trial" | null }) {
  const [annual, setAnnual] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const go = (key: string | null, p: Promise<{ ok: true; data: { url: string | null } } | { ok: false; error: string }>) =>
    start(async () => {
      setPicked(key);
      const r = await p;
      if (!r.ok) return setError(r.error);
      if (r.data.url) window.location.href = r.data.url;
    });

  const locked = access.state === "locked";
  return (
    <div className="flex flex-col gap-6">
      {/* boas-vindas logo após criar a conta */}
      {welcome === "new" && (
        <section className="fx-aurora overflow-hidden rounded-xl p-6 sm:p-8" aria-labelledby="bv-t">
          <div className="relative z-10">
            <p className="inline-flex items-center gap-1.5 rounded-pill bg-[color-mix(in_srgb,var(--on-night)_10%,transparent)] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-on-night-muted">
              <Sparkle className="size-3 text-aurora-2" weight="fill" aria-hidden /> Conta criada
            </p>
            <h2 id="bv-t" className="mt-4 text-2xl font-semibold tracking-tight text-on-night">
              Escolha seu plano. <span className="fx-gradient-text">Os 14 dias grátis já começaram.</span>
            </h2>
            <p className="mt-2 max-w-[56ch] text-base text-on-night-muted">
              Assine agora ou use tudo liberado até {access.trialEndsAt ? new Date(access.trialEndsAt).toLocaleDateString("pt-BR") : "o fim do teste"}. No fim do teste o painel pausa até você ativar um plano; nada é apagado.
            </p>
            <Link
              href={`/${slug}/leads`}
              className="mt-5 inline-flex h-10 items-center rounded-pill bg-on-night px-5 text-sm font-medium text-night transition-transform duration-fast ease-out active:scale-[0.98]"
            >
              Continuar no teste grátis →
            </Link>
          </div>
        </section>
      )}
      {(welcome === "no_trial" || locked) && (
        <section role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,var(--bg))] p-4">
          <h2 className="font-semibold text-fg">{welcome === "no_trial" ? "Este CPF/CNPJ ou email já usou o teste grátis" : "Ative um plano para continuar"}</h2>
          <p className="mt-1 text-sm text-muted">
            {welcome === "no_trial"
              ? "O teste de 14 dias vale uma vez por documento e por email. Sua empresa foi criada: é só escolher um plano abaixo para começar."
              : "O painel está pausado. Seus dados continuam guardados e voltam assim que o plano for ativado."}
          </p>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-surface p-4 shadow-[inset_0_0_0_1px_var(--border)]" aria-label="Plano atual">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Plano atual</p>
          <p className="text-lg text-fg">
            {planOf[sub.plan]} ·{" "}
            <span className={cn(sub.status === "past_due" || sub.status === "unpaid" || locked ? "text-danger" : "text-muted")}>
              {locked && sub.status === "trialing" ? "teste encerrado" : statusOf[sub.status]}
            </span>
          </p>
          <p className="text-sm text-muted">
            {sub.seats} {sub.seats === 1 ? "usuário" : "usuários"}
            {access.state === "trial" && access.daysLeft !== null && (
              <>
                {" "}
                · {daysLeftText(access.daysLeft)} de teste
                {access.trialEndsAt && <> (até {new Date(access.trialEndsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })})</>}
              </>
            )}
          </p>
        </div>
        {sub.currentPeriodEnd && sub.status !== "trialing" && (
          <p className={cn("text-sm", sub.status === "active" ? "text-muted" : "text-danger")}>
            {sub.status === "active" ? "Pago até" : "Venceu em"}{" "}
            <span className="font-medium text-fg">{new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
            {sub.status !== "active" && " · renove abaixo"}
          </p>
        )}
      </section>

      <section aria-labelledby="planos-t">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="planos-t" className="mr-auto text-lg font-semibold text-fg">
            Planos
          </h2>
          <span className="text-sm text-fg">Mensal</span>
          <Switch checked={annual} onChange={setAnnual} label="Cobrança anual (2 meses grátis)" />
          <span className="text-sm text-fg">
            Anual <span className="rounded-pill bg-success-soft px-1.5 py-0.5 text-xs font-medium text-success">2 meses grátis</span>
          </span>
        </div>
        <ul className="grid gap-4 lg:grid-cols-3">
          {plans.map((p) => {
            const hot = !!p.hot;
            const price = PLAN_PRICES[p.key];
            const current = sub.status !== "trialing" && sub.plan === price.plan;
            return (
              <li
                key={p.key}
                className={cn(
                  "relative flex flex-col rounded-xl p-6",
                  hot
                    ? "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_10%,var(--bg)),var(--bg)_55%)] shadow-[0_0_0_2px_var(--accent),0_20px_40px_-24px_rgba(31,122,85,.6)]"
                    : "bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]",
                )}
              >
                {hot && <span className="absolute -top-3 left-6 rounded-pill bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">Mais escolhido</span>}
                <h3 className="text-base font-semibold text-fg">{price.name}</h3>
                <p className="text-sm text-muted">Para {p.who}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums text-fg">R$ {annual ? price.a : price.m}</span>
                  <span className="text-sm text-muted">/usuário/mês</span>
                </p>
                <p className="mt-1 h-5 text-xs text-muted">{annual ? `R$ ${price.a * 12} por ano, por usuário (até 12x)` : ""}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5 border-t border-border pt-5">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2 text-sm text-fg">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {i}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={hot ? "primary" : "secondary"}
                  size="lg"
                  loading={pending && picked === p.key}
                  disabled={pending && picked !== p.key}
                  onClick={() => go(p.key, startCheckoutAction(slug, p.key, annual ? "anual" : "mensal"))}
                >
                  {current ? "Renovar" : "Assinar"} {price.name}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
          <Check className="size-4 text-success" aria-hidden /> Pix, cartão ou boleto pelo Mercado Pago. Sem fidelidade e sem cobrança automática: você paga o mês (ou o ano) quando quiser continuar.
        </p>
        {error && (
          <p role="alert" className="mt-2 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
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
        icon={<Trash2 className="size-5" />}
        tone="danger"
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
