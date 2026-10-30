"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { saveAiKeyAction } from "@/app/actions";
import type { AiWallet } from "@/data/types";
import { AI_PACKS } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Check, Sparkle } from "@/components/ui/icons";

/* Complementos: créditos de IA avulsos e chave própria da Anthropic.
   O plano inclui N respostas por mês; passou disso, gasta os avulsos (não vencem). Com chave própria, a empresa paga a IA direto. */

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function AiCreditsMeter({ wallet, compact }: { wallet: AiWallet; compact?: boolean }) {
  const total = wallet.included + wallet.extra + Math.max(0, wallet.used - wallet.included);
  const left = Math.max(0, wallet.included - wallet.used) + wallet.extra;
  const pct = total ? Math.min(100, (wallet.used / total) * 100) : 0;
  if (wallet.ownKeyHint)
    return <p className="text-sm text-muted">Usando a sua chave da Anthropic ({wallet.ownKeyHint}): as respostas não gastam crédito. {fmt(wallet.used)} respostas este mês.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-fg">{compact ? "Créditos de IA" : "Respostas da IA neste mês"}</span>
        <span className="tabular-nums text-muted">
          <strong className="font-semibold text-fg">{fmt(wallet.used)}</strong> / {fmt(total)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-surface shadow-[inset_0_0_0_1px_var(--border)]" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={wallet.used} aria-label="Créditos de IA usados">
        <div className={cn("h-full rounded-pill", left === 0 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-[linear-gradient(90deg,var(--accent),var(--stage-4))]")} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted">
        {fmt(wallet.included)} por mês no plano{wallet.extra > 0 && <> · {fmt(wallet.extra)} avulsos sobrando (não vencem)</>} · {left === 0 ? <span className="font-medium text-danger">acabaram: a IA passa as conversas para a equipe</span> : <>sobram {fmt(left)}</>}
      </p>
    </div>
  );
}

export function AiAddons({ slug, wallet, prices, isAdmin, bought, onSale }: { slug: string; wallet: AiWallet; prices: Record<string, string>; isAdmin: boolean; bought: boolean; onSale: boolean }) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [keyMsg, setKeyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveKey = (ev: FormEvent | null, value: string | null) => {
    ev?.preventDefault();
    start(async () => {
      setPicked("key");
      const r = await saveAiKeyAction(slug, value);
      setKeyMsg(r.ok ? { ok: true, text: value ? "Chave salva e testada. A IA agora usa a sua conta da Anthropic." : "Chave removida. A IA volta a usar os créditos." } : { ok: false, text: r.error });
      if (r.ok) setKey("");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {bought && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          <Check className="size-4" aria-hidden /> Pagamento recebido. Os créditos entram em instantes (com Pix, assim que o banco confirmar).
        </p>
      )}

      <section className="rounded-xl bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]" aria-labelledby="cred-t">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[linear-gradient(135deg,var(--accent),var(--stage-4))] text-on-accent" aria-hidden>
            <Sparkle className="size-5" weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="cred-t" className="text-base font-semibold text-fg">
              Créditos de IA adicionais
            </h2>
            <p className="mt-0.5 max-w-[62ch] text-sm text-muted">
              Cada resposta do agente de IA gasta 1 crédito. O plano inclui um tanto por mês; quando acaba, a IA usa os créditos avulsos. Sem crédito, ela passa a conversa para a equipe e nada fica sem resposta.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <AiCreditsMeter wallet={wallet} />
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {AI_PACKS.map((p, i) => (
            <li key={p.key} className={cn("flex flex-col rounded-lg p-4", i === 1 ? "shadow-[0_0_0_2px_var(--accent)]" : "shadow-[0_0_0_1px_var(--border)]")}>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">{fmt(p.credits)}</p>
              <p className="text-sm text-muted">respostas da IA</p>
              <p className="mt-3 text-sm font-medium text-fg">{prices[p.key] ?? "Preço na próxima tela"}</p>
              {!onSale ? (
                <Button className="mt-3" variant="secondary" size="sm" disabled>
                  Em breve
                </Button>
              ) : isAdmin ? (
                <Link href={`/${slug}/settings/billing/checkout?pacote=${p.key}`} className={cn(buttonClass(i === 1 ? "primary" : "secondary", "sm"), "mt-3")}>
                  Adicionar créditos
                </Link>
              ) : (
                <Button className="mt-3" variant={i === 1 ? "primary" : "secondary"} size="sm" disabled>
                  Adicionar créditos
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!isAdmin && <p className="mt-3 text-xs text-muted">Só administradores compram créditos.</p>}
        {error && (
          <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-xl bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]" aria-labelledby="key-t">
        <h2 id="key-t" className="text-base font-semibold text-fg">
          Usar a minha chave da Anthropic
        </h2>
        <p className="mt-0.5 max-w-[62ch] text-sm text-muted">
          Para alto volume: a empresa cria uma chave em console.anthropic.com e paga a IA direto para a Anthropic, sem limite de créditos. A chave fica guardada criptografada e nunca aparece de novo na tela.
        </p>
        {wallet.ownKeyHint ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1 text-sm font-medium text-success">
              <Check className="size-4" aria-hidden /> Chave ativa ({wallet.ownKeyHint})
            </span>
            {isAdmin && (
              <Button variant="secondary" size="sm" loading={pending && picked === "key"} onClick={() => saveKey(null, null)}>
                Remover chave
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => saveKey(e, key)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Chave da API" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." autoComplete="off" spellCheck={false} disabled={!isAdmin} />
            </div>
            <Button type="submit" disabled={!isAdmin || !key.trim()} loading={pending && picked === "key"}>
              Testar e salvar
            </Button>
          </form>
        )}
        {keyMsg && (
          <p role={keyMsg.ok ? "status" : "alert"} className={cn("mt-3 rounded-sm px-3 py-2 text-sm", keyMsg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
            {keyMsg.text}
          </p>
        )}
      </section>
    </div>
  );
}
