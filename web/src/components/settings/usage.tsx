import Link from "next/link";
import type { Access, AiWallet, UsageCounts } from "@/data/types";
import { fmtLimit, limitsOf } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { NetzerMark } from "@/components/brand/logo";
import { AiCreditsMeter } from "./addons";

/* Aba Uso: quanto a empresa usa de cada limite do plano e dos créditos de IA. */

const fmt = (n: number) => n.toLocaleString("pt-BR");

function Row({ label, used, max }: { label: string; used: number; max: number }) {
  const finite = Number.isFinite(max);
  const pct = finite && max > 0 ? Math.min(100, (used / max) * 100) : 0;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-fg">{label}</span>
        <span className={cn("tabular-nums", finite && used >= max ? "font-medium text-danger" : "text-muted")}>
          {finite ? (
            <>
              <strong className="font-semibold text-fg">{fmt(used)}</strong> / {fmt(max)}
            </>
          ) : (
            <>
              <strong className="font-semibold text-fg">{fmt(used)}</strong> · ilimitado
            </>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-surface shadow-[inset_0_0_0_1px_var(--border)]">
        <div
          className={cn("h-full rounded-pill", !finite ? "bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]" : pct >= 100 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-accent")}
          style={{ width: finite ? `${Math.max(used ? 2 : 0, pct)}%` : "100%" }}
        />
      </div>
    </li>
  );
}

export function UsagePanel({ slug, access, usage, wallet }: { slug: string; access: Access; usage: UsageCounts; wallet: AiWallet }) {
  const l = limitsOf(access.plan);
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]" aria-labelledby="uso-t">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-accent-soft text-accent-text" aria-hidden>
            <NetzerMark className="h-6" />
          </span>
          <div>
            <h2 id="uso-t" className="text-base font-semibold text-fg">
              Plano {l.name}
            </h2>
            <p className="text-sm text-muted">O que sua empresa usa hoje de cada limite</p>
          </div>
        </div>
        <ul className="flex flex-col gap-4">
          <Row label="Leads" used={usage.leads} max={Infinity} />
          <Row label="Contatos e empresas" used={usage.contacts + usage.companies} max={Infinity} />
          <Row label="Funis" used={usage.pipelines} max={l.pipelines} />
          <Row label="Usuários" used={usage.users} max={l.users} />
          <Row label="Canais conectados (WhatsApp, Instagram, Facebook)" used={usage.socialChannels} max={l.socialChannels} />
          <Row label="Robôs ligados" used={usage.activeRobots} max={l.activeRobots} />
          <Row label="Links rastreáveis" used={usage.trackingLinks} max={l.trackingLinks} />
          <Row label="Campos personalizados" used={usage.customFields} max={Infinity} />
        </ul>
        <p className="mt-5 text-xs text-muted">
          Chat do site sempre livre. Limites: funis {fmtLimit(l.pipelines)}, usuários {fmtLimit(l.users)}, canais {fmtLimit(l.socialChannels)}.{" "}
          <Link href={`/${slug}/settings/billing`} className="text-accent-text underline">
            Ver planos
          </Link>
        </p>
      </section>

      <section className="rounded-xl bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]" aria-labelledby="ia-t">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="ia-t" className="text-base font-semibold text-fg">
            Créditos de IA
          </h2>
          <Link href={`/${slug}/settings/billing?aba=complementos`} className="inline-flex h-8 items-center rounded-sm px-3 text-sm font-medium text-accent-text shadow-[0_0_0_1px_var(--border-input)] hover:bg-accent-soft">
            Gerenciar créditos
          </Link>
        </div>
        <AiCreditsMeter wallet={wallet} />
      </section>
    </div>
  );
}
