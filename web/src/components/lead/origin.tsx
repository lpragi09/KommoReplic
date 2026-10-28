"use client";

import { useState, useTransition } from "react";
import type { Attribution } from "@/data/types";
import { setLeadAttributionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { Pencil, Link2 } from "@/components/ui/icons";
import { ATTR_KEYS, ATTR_LABEL, VIA_LABEL, attrSummary } from "@/lib/utm";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" }) : "");

const EDITABLE = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Aba "Origem" do cartão do lead: de onde ele veio (UTMs, anúncio, link) e edição manual. */
export function LeadOrigin({ slug, leadId, attribution }: { slug: string; leadId: string; attribution: Attribution | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const a = attribution;
  const rows = a ? ATTR_KEYS.filter((k) => a[k]).map((k) => [ATTR_LABEL[k], a[k]!] as const) : [];

  const save = () =>
    start(async () => {
      const res = await setLeadAttributionAction(slug, leadId, draft);
      if (!res.ok) return setError(res.error);
      setError(null);
      setOpen(false);
    });

  return (
    <div className="flex flex-col gap-3 text-sm">
      {a?.via && (
        <p className="w-fit rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-text">
          {VIA_LABEL[a.via]}
          {a.link_name ? ` · ${a.link_name}` : ""}
        </p>
      )}
      {rows.length ? (
        <dl className="flex flex-col divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-2 py-1.5">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 break-words text-fg">{v.startsWith("http") ? <a href={v} target="_blank" rel="noreferrer noopener" className="text-accent-text underline">{v}</a> : v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {/* veio por mais de uma campanha: o 1º contato e o caminho inteiro */}
      {a?.first && (
        <div className="rounded-md bg-surface px-3 py-2 shadow-[inset_0_0_0_1px_var(--border)]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">1º contato (como ele chegou a primeira vez)</p>
          <p className="mt-0.5 text-fg">
            {attrSummary(a.first) ?? "Sem origem"} <span className="text-xs text-muted">{day(a.first.at)}</span>
          </p>
        </div>
      )}
      {a?.history && a.history.length > 1 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Caminho até aqui</p>
          <ol className="relative flex flex-col gap-2 border-l-2 border-border pl-4">
            {a.history.map((t, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-pill ${i === a.history!.length - 1 ? "bg-accent" : "bg-border-input"}`} aria-hidden />
                <span className="text-fg">{t.label}</span>
                <span className="ml-2 text-xs text-muted">
                  {t.via ? VIA_LABEL[t.via] : ""} {day(t.at)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {!rows.length && (
        <p className="text-muted">Origem desconhecida. Use os links rastreáveis (Configurações → Rastreamento e UTMs) para saber de qual campanha vem cada lead.</p>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="w-fit"
        icon={<Pencil className="size-4" aria-hidden />}
        onClick={() => {
          setDraft(Object.fromEntries(EDITABLE.map((k) => [k, a?.[k] ?? ""])));
          setError(null);
          setOpen(true);
        }}
      >
        {rows.length ? "Editar origem" : "Preencher origem"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        icon={<Link2 className="size-5" />}
        title="Origem do lead"
        description="Para quando o cliente veio por indicação, ligação ou um lugar sem link."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {EDITABLE.map((k) => (
            <Field key={k} label={`${ATTR_LABEL[k]} (${k})`} value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} maxLength={150} />
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </Dialog>
    </div>
  );
}
