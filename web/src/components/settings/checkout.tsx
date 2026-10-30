"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { BillingProfile } from "@/data/types";
import { payAction, paymentStatusAction, saveBillingProfileAction } from "@/app/actions";
import { maskDoc, maskPhone } from "@/lib/document";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Barcode, Check, Copy, CreditCard, QrCode } from "@/components/ui/icons";

/* Checkout no próprio site, em 2 passos: dados de cobrança e pagamento (Pix, cartão ou boleto).
   O cartão é digitado no formulário do Mercado Pago (Card Payment Brick), que devolve só um token:
   o número do cartão nunca passa pelo nosso servidor. Pix e boleto são gerados pelo servidor. */

export type CheckoutItem = {
  purchase: { kind: "plan"; plan: "autonomo" | "equipe" | "operacao"; period: "mensal" | "anual" } | { kind: "credits"; pack: "ia_500" | "ia_2000" | "ia_5000" };
  title: string;
  detail: string;
  cents: number;
  maxInstallments: number;
};

type Result = Extract<Awaited<ReturnType<typeof payAction>>, { ok: true }>["data"];
type Method = "pix" | "card" | "boleto";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const EMPTY: BillingProfile = { person: "pf", doc: "", name: "", email: "", phone: "", address: { zip: "", street: "", number: "", complement: "", district: "", city: "", state: "" } };

export function Checkout({
  slug,
  item,
  profile,
  defaultEmail,
  ready,
  publicKey,
  isAdmin,
}: {
  slug: string;
  item: CheckoutItem;
  profile: BillingProfile | null;
  defaultEmail: string;
  ready: boolean;
  publicKey: string | null;
  isAdmin: boolean;
}) {
  const [step, setStep] = useState<"dados" | "pagamento">(profile ? "pagamento" : "dados");
  const [saved, setSaved] = useState<BillingProfile | null>(profile);
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ol className="flex items-center gap-2 text-sm" aria-label="Etapas">
            {(["dados", "pagamento"] as const).map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-border" aria-hidden />}
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs font-semibold",
                    step === s ? "bg-accent text-on-accent" : s === "dados" && saved ? "bg-success-soft text-success" : "bg-bg text-muted shadow-[0_0_0_1px_var(--border)]",
                  )}
                  aria-current={step === s ? "step" : undefined}
                >
                  {s === "dados" && saved && step !== s ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span className={cn(step === s ? "font-medium text-fg" : "text-muted")}>{s === "dados" ? "Dados de cobrança" : "Pagamento"}</span>
              </li>
            ))}
          </ol>

          {!ready && (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
              Cobrança ainda não configurada. O pagamento fica disponível assim que o Mercado Pago for ligado no servidor.
            </p>
          )}
          {!isAdmin ? (
            <p className="rounded-xl bg-bg p-5 text-sm text-muted shadow-[0_0_0_1px_var(--border)]">Só administradores da empresa fazem pagamentos. Peça para um administrador assinar.</p>
          ) : result ? (
            <ResultView slug={slug} result={result} onRetry={() => setResult(null)} onUpdate={setResult} />
          ) : step === "dados" ? (
            <BillingForm
              slug={slug}
              initial={saved ?? { ...EMPTY, email: defaultEmail }}
              onSaved={(p) => {
                setSaved(p);
                setStep("pagamento");
              }}
            />
          ) : (
            <PaymentStep slug={slug} item={item} profile={saved!} ready={ready} publicKey={publicKey} onEdit={() => setStep("dados")} onResult={setResult} />
          )}
        </div>

        <aside className="h-fit rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] lg:sticky lg:top-6" aria-label="Resumo do pedido">
          <h2 className="text-sm font-medium text-muted">Resumo</h2>
          <p className="mt-3 font-semibold text-fg">{item.title}</p>
          <p className="text-sm text-muted">{item.detail}</p>
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm text-muted">Total</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-fg">{brl(item.cents)}</span>
          </div>
          {item.maxInstallments > 1 && <p className="mt-1 text-right text-xs text-muted">no cartão em até {item.maxInstallments}x</p>}
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 text-xs text-muted">
            <li className="flex gap-1.5">
              <Check className="size-3.5 shrink-0 text-success" aria-hidden /> Pix libera na hora
            </li>
            <li className="flex gap-1.5">
              <Check className="size-3.5 shrink-0 text-success" aria-hidden /> Sem cobrança automática nem fidelidade
            </li>
            <li className="flex gap-1.5">
              <Check className="size-3.5 shrink-0 text-success" aria-hidden /> Pagamento processado pelo Mercado Pago
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

/* ---------- passo 1: dados de cobrança ---------- */

function BillingForm({ slug, initial, onSaved }: { slug: string; initial: BillingProfile; onSaved: (p: BillingProfile) => void }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [cepState, setCepState] = useState<"idle" | "loading" | "notfound">("idle");
  const set = (patch: Partial<BillingProfile>) => setF((x) => ({ ...x, ...patch }));
  const setAddr = (patch: Partial<BillingProfile["address"]>) => setF((x) => ({ ...x, address: { ...x.address, ...patch } }));
  const docType = f.person === "pf" ? "cpf" : "cnpj";

  // CEP completo: preenche rua, bairro, cidade e UF pelo ViaCEP (consulta pública, feita pelo navegador)
  const lookupCep = async (raw: string) => {
    const zip = raw.replace(/\D/g, "");
    if (zip.length !== 8) return;
    setCepState("loading");
    try {
      const r = (await (await fetch(`https://viacep.com.br/ws/${zip}/json/`)).json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (r.erro) return setCepState("notfound");
      setAddr({ street: r.logradouro || f.address.street, district: r.bairro || f.address.district, city: r.localidade ?? "", state: r.uf ?? "" });
      setCepState("idle");
    } catch {
      setCepState("idle"); // sem internet ou ViaCEP fora: a pessoa digita
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveBillingProfileAction(slug, f);
      if (!r.ok) return setError(r.error);
      onSaved({ ...f, doc: f.doc.replace(/\D/g, ""), phone: f.phone.replace(/\D/g, ""), address: { ...f.address, zip: f.address.zip.replace(/\D/g, ""), state: f.address.state.toUpperCase() } });
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] sm:p-6" aria-labelledby="dados-t">
      <div>
        <h2 id="dados-t" className="text-lg font-semibold text-fg">
          Dados de cobrança
        </h2>
        <p className="text-sm text-muted">Vão no recibo e no boleto. Ficam salvos para a próxima vez.</p>
      </div>

      <fieldset className="flex gap-2">
        <legend className="sr-only">Tipo de cadastro</legend>
        {(
          [
            ["pf", "Pessoa física (CPF)"],
            ["pj", "Empresa (CNPJ)"],
          ] as const
        ).map(([v, label]) => (
          <label
            key={v}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2.5 text-sm font-medium transition-shadow duration-fast",
              f.person === v ? "bg-accent-soft text-accent-text shadow-[0_0_0_2px_var(--accent)]" : "text-fg shadow-[0_0_0_1px_var(--border)] hover:shadow-[0_0_0_1px_var(--border-input)]",
            )}
          >
            <input type="radio" name="person" value={v} checked={f.person === v} onChange={() => set({ person: v, doc: "" })} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.person === "pf" ? "CPF" : "CNPJ"} inputMode="numeric" autoComplete="off" required value={maskDoc(docType, f.doc)} onChange={(e) => set({ doc: e.target.value.replace(/\D/g, "").slice(0, docType === "cpf" ? 11 : 14) })} />
        <Field label={f.person === "pf" ? "Nome completo" : "Razão social"} autoComplete={f.person === "pf" ? "name" : "organization"} required value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
        <Field label="Email para o recibo" type="email" autoComplete="email" required value={f.email} onChange={(e) => set({ email: e.target.value })} maxLength={200} />
        <Field label="Telefone (opcional)" type="tel" autoComplete="tel" value={maskPhone(f.phone)} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
      </div>

      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-6">
        <Field
          className="sm:col-span-2"
          label="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          required
          value={f.address.zip.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2")}
          onChange={(e) => {
            const zip = e.target.value.replace(/\D/g, "").slice(0, 8);
            setAddr({ zip });
            if (zip.length === 8) void lookupCep(zip);
          }}
          hint={cepState === "loading" ? "Buscando endereço…" : cepState === "notfound" ? "CEP não encontrado: preencha à mão." : undefined}
        />
        <Field className="sm:col-span-4" label="Rua" autoComplete="address-line1" required value={f.address.street} onChange={(e) => setAddr({ street: e.target.value })} maxLength={120} />
        <Field className="sm:col-span-2" label="Número" required value={f.address.number} onChange={(e) => setAddr({ number: e.target.value })} maxLength={10} />
        <Field className="sm:col-span-4" label="Complemento (opcional)" autoComplete="address-line2" value={f.address.complement} onChange={(e) => setAddr({ complement: e.target.value })} maxLength={60} />
        <Field className="sm:col-span-2" label="Bairro" required value={f.address.district} onChange={(e) => setAddr({ district: e.target.value })} maxLength={80} />
        <Field className="sm:col-span-3" label="Cidade" autoComplete="address-level2" required value={f.address.city} onChange={(e) => setAddr({ city: e.target.value })} maxLength={80} />
        <Field className="sm:col-span-1" label="UF" autoComplete="address-level1" required value={f.address.state} onChange={(e) => setAddr({ state: e.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() })} />
      </div>

      {error && (
        <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="self-end">
        Continuar para o pagamento
      </Button>
    </form>
  );
}

/* ---------- passo 2: forma de pagamento ---------- */

const METHODS: { v: Method; label: string; hint: string; icon: typeof QrCode }[] = [
  { v: "pix", label: "Pix", hint: "Libera na hora", icon: QrCode },
  { v: "card", label: "Cartão de crédito", hint: "Libera na hora", icon: CreditCard },
  { v: "boleto", label: "Boleto", hint: "Até 2 dias úteis", icon: Barcode },
];

function PaymentStep({
  slug,
  item,
  profile,
  ready,
  publicKey,
  onEdit,
  onResult,
}: {
  slug: string;
  item: CheckoutItem;
  profile: BillingProfile;
  ready: boolean;
  publicKey: string | null;
  onEdit: () => void;
  onResult: (r: Result) => void;
}) {
  const [method, setMethod] = useState<Method>("pix");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const pay = (m: Method) =>
    start(async () => {
      const r = await payAction(slug, item.purchase, { kind: m as "pix" | "boleto" });
      if (!r.ok) return setError(r.error);
      onResult(r.data);
    });

  return (
    <section className="flex flex-col gap-5 rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] sm:p-6" aria-labelledby="pag-t">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="pag-t" className="text-lg font-semibold text-fg">
            Forma de pagamento
          </h2>
          <p className="text-sm text-muted">
            {profile.name} · {maskDoc(profile.person === "pf" ? "cpf" : "cnpj", profile.doc)}
          </p>
        </div>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-accent-text hover:underline">
          Alterar dados
        </button>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Forma de pagamento</legend>
        {METHODS.map((m) => {
          const off = m.v === "card" && !publicKey;
          return (
            <label
              key={m.v}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3.5 py-3 transition-shadow duration-fast",
                method === m.v ? "bg-accent-soft shadow-[0_0_0_2px_var(--accent)]" : "shadow-[0_0_0_1px_var(--border)] hover:shadow-[0_0_0_1px_var(--border-input)]",
                off && "pointer-events-none opacity-50",
              )}
            >
              <input type="radio" name="method" value={m.v} checked={method === m.v} disabled={off} onChange={() => (setMethod(m.v), setError(undefined))} className="sr-only" />
              <m.icon className={cn("size-5 shrink-0", method === m.v ? "text-accent" : "text-muted")} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{m.label}</span>
                <span className="block text-xs text-muted">{off ? "Em breve" : m.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {method === "pix" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Gere o código, pague no app do seu banco e o plano libera sozinho em segundos.</p>
          <Button size="lg" disabled={!ready} loading={pending} onClick={() => pay("pix")} className="self-start">
            Gerar Pix de {brl(item.cents)}
          </Button>
        </div>
      )}
      {method === "boleto" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Vence em 3 dias. Depois de pago, o banco leva até 2 dias úteis para confirmar.</p>
          <Button size="lg" disabled={!ready} loading={pending} onClick={() => pay("boleto")} className="self-start">
            Gerar boleto de {brl(item.cents)}
          </Button>
        </div>
      )}
      {method === "card" && publicKey && <CardBrick slug={slug} item={item} profile={profile} publicKey={publicKey} onResult={onResult} onError={setError} />}

      {error && (
        <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

/* ---------- cartão: formulário do Mercado Pago (Card Payment Brick) ---------- */

type MpBricks = { create: (type: string, container: string, settings: unknown) => Promise<{ unmount: () => void }> };
declare global {
  interface Window {
    MercadoPago?: new (key: string, opts: { locale: string }) => { bricks: () => MpBricks };
  }
}

function loadSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk"));
    document.head.appendChild(s);
  });
}

function CardBrick({
  slug,
  item,
  profile,
  publicKey,
  onResult,
  onError,
}: {
  slug: string;
  item: CheckoutItem;
  profile: BillingProfile;
  publicKey: string;
  onResult: (r: Result) => void;
  onError: (e: string | undefined) => void;
}) {
  const [loading, setLoading] = useState(true);
  const handlers = useRef({ onResult, onError });
  useEffect(() => {
    handlers.current = { onResult, onError };
  });

  useEffect(() => {
    let ctrl: { unmount: () => void } | null = null;
    let gone = false;
    const dark = document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark";
    loadSdk()
      .then(async () => {
        if (gone || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        ctrl = await mp.bricks().create("cardPayment", "mp-card-brick", {
          initialization: { amount: item.cents / 100, payer: { email: profile.email, identification: { type: profile.person === "pf" ? "CPF" : "CNPJ", number: profile.doc } } },
          customization: { paymentMethods: { maxInstallments: item.maxInstallments, minInstallments: 1 }, visual: { style: { theme: dark ? "dark" : "default" } } },
          callbacks: {
            onReady: () => setLoading(false),
            onError: () => handlers.current.onError("Não deu para carregar o formulário do cartão. Recarregue a página ou use Pix."),
            onSubmit: async (d: { token: string; payment_method_id: string; issuer_id?: string | number; installments: number }) => {
              handlers.current.onError(undefined);
              const r = await payAction(slug, item.purchase, { kind: "card", token: d.token, paymentMethodId: d.payment_method_id, issuerId: d.issuer_id ? String(d.issuer_id) : undefined, installments: Number(d.installments) || 1 });
              if (!r.ok) {
                handlers.current.onError(r.error);
                throw new Error(r.error); // o formulário do Mercado Pago volta a ficar editável
              }
              handlers.current.onResult(r.data);
            },
          },
        });
        if (gone) ctrl.unmount();
      })
      .catch(() => {
        setLoading(false);
        handlers.current.onError("Não deu para carregar o formulário do cartão. Confira a internet ou use Pix.");
      });
    return () => {
      gone = true;
      ctrl?.unmount();
    };
  }, [slug, item, profile, publicKey]);

  return (
    <div>
      {loading && <p className="text-sm text-muted">Carregando formulário seguro do cartão…</p>}
      <div id="mp-card-brick" />
    </div>
  );
}

/* ---------- resultado ---------- */

function ResultView({ slug, result, onRetry, onUpdate }: { slug: string; result: Result; onRetry: () => void; onUpdate: (r: Result) => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const box = "flex flex-col gap-4 rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] sm:p-6";

  if (result.status === "approved")
    return (
      <section className={box} role="status">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success" aria-hidden>
          <Check className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-fg">Pagamento aprovado</h2>
          <p className="text-sm text-muted">Tudo liberado. O recibo vai para o email de cobrança.</p>
        </div>
        <Link href={`/${slug}/settings/billing`} className="inline-flex h-10 w-fit items-center rounded-md bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover">
          Ver meu plano
        </Link>
      </section>
    );

  if (result.status === "rejected" || result.status === "cancelled")
    return (
      <section className={box} role="alert">
        <h2 className="text-lg font-semibold text-fg">Pagamento não aprovado</h2>
        <p className="text-sm text-muted">{result.message ?? "Tente outra forma de pagamento."}</p>
        <Button className="self-start" onClick={onRetry}>
          Tentar de novo
        </Button>
      </section>
    );

  if (result.pix)
    return (
      <section className={box} aria-labelledby="pix-t">
        <h2 id="pix-t" className="text-lg font-semibold text-fg">
          Pague com Pix
        </h2>
        <PixBox slug={slug} paymentId={result.id} pix={result.pix} onChange={(status) => onUpdate({ ...result, status })} />
      </section>
    );

  if (result.boleto)
    return (
      <section className={box} aria-labelledby="bol-t">
        <div>
          <h2 id="bol-t" className="text-lg font-semibold text-fg">
            Boleto gerado
          </h2>
          <p className="text-sm text-muted">Pague até o vencimento. A liberação acontece sozinha quando o banco confirmar (até 2 dias úteis).</p>
        </div>
        {result.boleto.barcode && (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-2 text-sm">{result.boleto.barcode}</code>
            <Button variant="secondary" size="sm" icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} onClick={() => copy(result.boleto!.barcode!)}>
              {copied ? "Copiado" : "Copiar código"}
            </Button>
          </div>
        )}
        <a href={result.boleto.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 w-fit items-center rounded-md bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover">
          Abrir boleto <span className="sr-only">(abre em nova aba)</span>
        </a>
      </section>
    );

  return (
    <section className={box} role="status">
      <h2 className="text-lg font-semibold text-fg">Pagamento em análise</h2>
      <p className="text-sm text-muted">O Mercado Pago está conferindo. Assim que aprovar, o plano libera sozinho e você recebe o recibo por email.</p>
      <Link href={`/${slug}/settings/billing`} className="text-sm font-medium text-accent-text hover:underline">
        Voltar para Plano e cobrança
      </Link>
    </section>
  );
}

/** QR code + copia e cola do Pix; pergunta a cada 5 s se já caiu (o webhook também libera, isto só mostra na hora) */
export function PixBox({ slug, paymentId, pix, onChange }: { slug: string; paymentId: string; pix: { code: string; image: string | null }; onChange: (status: string) => void }) {
  const [copied, setCopied] = useState(false);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await paymentStatusAction(slug, paymentId);
      if (r.ok && r.data.status !== "pending" && r.data.status !== "in_process") changed.current(r.data.status);
    }, 5000);
    return () => clearInterval(t);
  }, [slug, paymentId]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pix.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Abra o app do banco, escolha Pix e leia o QR code ou cole o código. Esta tela atualiza sozinha quando o pagamento cair.</p>
      {pix.image && (
        // eslint-disable-next-line @next/next/no-img-element -- QR code em base64 vindo do Mercado Pago
        <img src={`data:image/png;base64,${pix.image}`} alt="QR code do Pix" className="size-56 self-center rounded-lg bg-white p-2 shadow-[0_0_0_1px_var(--border)]" />
      )}
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-2 text-sm">{pix.code}</code>
        <Button variant="secondary" size="sm" icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} onClick={copy}>
          {copied ? "Copiado" : "Copiar código"}
        </Button>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <span className="size-2 animate-pulse rounded-full bg-warning" aria-hidden /> Aguardando o pagamento…
      </p>
    </div>
  );
}
