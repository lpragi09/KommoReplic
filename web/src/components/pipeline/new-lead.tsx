"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Coins, Phone, Plus, Sparkle, UserCircle } from "@/components/ui/icons";
import type { Stage } from "@/data/types";
import { createLeadAction } from "@/app/actions";
import { Avatar } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";
import { stageBar } from "./kanban";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** igual ao servidor: ponto é milhar, vírgula é centavo ("12.500,50" → 12500.5) */
const parseMoney = (s: string) => {
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function NewLeadButton({ slug, pipelineId, stages, defaultStageId }: { slug: string; pipelineId: string; stages: Stage[]; defaultStageId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const empty = { name: "", price: "", stageId: defaultStageId, contactName: "", contactPhone: "" };
  const [f, setF] = useState(empty);
  const stage = stages.find((s) => s.id === f.stageId) ?? stages[0];

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const r = await createLeadAction(slug, { pipelineId, ...f });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setF(empty);
      router.push(`/${slug}/leads/${r.data.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setError(undefined);
      }}
      size="lg"
      icon={<Plus className="size-5" weight="bold" />}
      title="Novo lead"
      description="Só o que você já sabe. O resto dá para completar no cartão."
      trigger={<Button icon={<Plus className="size-4" aria-hidden />}>Novo lead</Button>}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-lead" loading={pending} icon={<Plus className="size-4" aria-hidden />}>
            Criar lead
          </Button>
        </>
      }
    >
      <form id="new-lead" onSubmit={submit} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]" data-editing>
        <div className="flex min-w-0 flex-col gap-5">
          <Field label="Nome do negócio" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Clínica Vida — 2 implantes" autoFocus maxLength={200} hint="Sem nome, ele vira “Lead #número”." />

          <Field
            label="Valor"
            value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })}
            adornment={
              <span className="flex items-center gap-1.5">
                <Coins className="size-4" aria-hidden /> R$
              </span>
            }
            inputMode="decimal"
            placeholder="0,00"
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg">Etapa</legend>
            <div className="flex flex-wrap gap-2">
              {stages.map((s) => {
                const on = s.id === f.stageId;
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center gap-2 rounded-pill px-3 text-sm font-medium transition-[background-color,box-shadow,color] duration-fast has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                      on ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-bg hover:shadow-[inset_0_0_0_1px_var(--border-input)]",
                    )}
                  >
                    <input type="radio" name="stageId" value={s.id} checked={on} onChange={() => setF({ ...f, stageId: s.id })} className="sr-only" />
                    <span className={cn("size-2.5 rounded-pill", stageBar[s.color])} aria-hidden />
                    {s.name}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="rounded-lg bg-surface p-4 shadow-[inset_0_0_0_1px_var(--border)]">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <UserCircle className="size-4" aria-hidden /> Contato <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome do contato" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} maxLength={120} adornment={<UserCircle className="size-4" aria-hidden />} placeholder="Ana Paula" />
              <Field
                label="Telefone do contato"
                type="tel"
                value={f.contactPhone}
                onChange={(e) => setF({ ...f, contactPhone: e.target.value })}
                placeholder="+55 11 90000-0000"
                maxLength={30}
                adornment={<Phone className="size-4" aria-hidden />}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        {/* prévia: o cartão como vai aparecer no funil */}
        <aside aria-label="Prévia do cartão" className="hidden md:block">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Sparkle className="size-3.5" weight="fill" aria-hidden /> Como vai aparecer
          </p>
          <div className="rounded-xl bg-[linear-gradient(160deg,var(--accent-soft),var(--surface))] p-3">
            <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-fg">
              <span className={cn("size-2 rounded-pill", stage && stageBar[stage.color])} aria-hidden />
              {stage?.name}
            </p>
            <div className="overflow-hidden rounded-lg bg-bg shadow-[0_0_0_1px_var(--border),0_10px_24px_-14px_rgba(20,28,24,.45)]">
              <div className={cn("h-1", stage && stageBar[stage.color])} />
              <div className="p-3">
                <p className={cn("line-clamp-2 break-words text-sm font-semibold", f.name.trim() ? "text-fg" : "text-muted")}>{f.name.trim() || "Lead #novo"}</p>
                <p className="mt-1 text-sm font-medium tabular-nums text-fg">{brl.format(parseMoney(f.price))}</p>
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
                  {f.contactName.trim() ? (
                    <>
                      <Avatar name={f.contactName} size={24} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-fg">{f.contactName}</p>
                        {f.contactPhone && <p className="truncate text-xs text-muted">{f.contactPhone}</p>}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted">Sem contato ainda</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </Dialog>
  );
}
