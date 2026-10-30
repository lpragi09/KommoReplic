"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutPayment } from "@/data/types";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/overlay";
import { Barcode, CreditCard, QrCode } from "@/components/ui/icons";
import { PixBox } from "@/components/settings/checkout";

/* Pagamentos feitos no checkout: situação de cada um e, no Pix/boleto ainda em aberto, como pagar de novo. */

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const METHOD = { pix: { label: "Pix", icon: QrCode }, boleto: { label: "Boleto", icon: Barcode }, card: { label: "Cartão", icon: CreditCard } };
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** aberto e ainda dentro do prazo: dá para pagar */
const payable = (p: CheckoutPayment, now: number) => (p.status === "pending" || p.status === "in_process") && (!p.expiresAt || Date.parse(p.expiresAt) > now);

function statusOf(p: CheckoutPayment, now: number): { text: string; tone: string } {
  const waiting = "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-fg";
  if (p.status === "approved") return { text: "Pago", tone: "bg-success-soft text-success" };
  if (p.status === "rejected") return { text: "Recusado", tone: "bg-danger-soft text-danger" };
  if (p.status === "cancelled") return { text: "Cancelado", tone: "bg-surface text-muted" };
  if (p.status === "refunded" || p.status === "charged_back") return { text: "Estornado", tone: "bg-surface text-muted" };
  if (!payable(p, now)) return { text: "Vencido", tone: "bg-surface text-muted" };
  return { text: p.status === "in_process" ? "Em análise" : "Aguardando pagamento", tone: waiting };
}

export function PaymentsHistory({ slug, payments, now }: { slug: string; payments: CheckoutPayment[]; now: number }) {
  const router = useRouter();
  const [pix, setPix] = useState<CheckoutPayment | null>(null);
  if (!payments.length) return null;
  return (
    <section aria-labelledby="pag-hist-t" className="rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
      <h2 id="pag-hist-t" className="text-lg font-semibold text-fg">
        Pagamentos
      </h2>
      <ul className="mt-3 divide-y divide-border">
        {payments.map((p) => {
          const m = METHOD[p.method];
          const st = statusOf(p, now);
          const open = payable(p, now);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <m.icon className="size-5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{p.title}</p>
                <p className="text-xs text-muted">
                  {m.label} · {when(p.createdAt)}
                  {open && p.expiresAt && <> · vence {when(p.expiresAt)}</>}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums text-fg">{brl(p.cents)}</span>
              <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", st.tone)}>{st.text}</span>
              {open && p.pix && (
                <button type="button" onClick={() => setPix(p)} className="text-sm font-medium text-accent-text hover:underline">
                  Ver QR code
                </button>
              )}
              {open && p.boleto && (
                <a href={p.boleto.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent-text hover:underline">
                  Abrir boleto <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {pix?.pix && (
        <Dialog open onOpenChange={(o) => !o && setPix(null)} icon={<QrCode className="size-5" />} title={`Pix de ${brl(pix.cents)}`} description={pix.title}>
          <PixBox
            slug={slug}
            paymentId={pix.id}
            pix={pix.pix}
            onChange={() => {
              setPix(null);
              router.refresh(); // caiu (ou venceu): a lista e o plano mostram a situação nova
            }}
          />
        </Dialog>
      )}
    </section>
  );
}
