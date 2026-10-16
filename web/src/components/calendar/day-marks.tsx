"use client";

import { useState, useTransition } from "react";
import type { CalendarMark, MarkColor } from "@/data/types";
import { deleteMarkAction, saveMarkAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { Plus, Trash2 } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export const MARK_TONE: Record<MarkColor, { chip: string; dot: string; label: string }> = {
  blue: { chip: "bg-accent-soft text-accent-text", dot: "bg-accent", label: "Azul" },
  green: { chip: "bg-success-soft text-success", dot: "bg-success", label: "Verde" },
  amber: { chip: "bg-[color-mix(in_srgb,var(--warning)_15%,var(--bg))] text-warning", dot: "bg-warning", label: "Âmbar" },
  red: { chip: "bg-danger-soft text-danger", dot: "bg-danger", label: "Vermelho" },
  purple: { chip: "bg-[color-mix(in_srgb,#7c3aed_12%,var(--bg))] text-[#6d28d9]", dot: "bg-[#7c3aed]", label: "Roxo" },
  gray: { chip: "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)]", dot: "bg-muted", label: "Cinza" },
};

const SUGGESTIONS = ["Promoção", "Folga", "Feriado municipal", "Evento", "Reunião de equipe", "Pagamento"];

type Draft = { id: string | null; label: string; color: MarkColor; note: string };

/** Marcações de um dia: chips clicáveis (editar) e o "+" para criar. */
export function DayMarks({ slug, date, marks, dayLabel }: { slug: string; date: string; marks: CalendarMark[]; dayLabel: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (!draft) return;
      const res = await saveMarkAction(slug, draft.id, { date, label: draft.label, color: draft.color, note: draft.note });
      if (!res.ok) return setError(res.error);
      setDraft(null);
    });
  const remove = () =>
    start(async () => {
      if (!draft?.id) return;
      const res = await deleteMarkAction(slug, draft.id);
      if (!res.ok) return setError(res.error);
      setDraft(null);
    });

  return (
    <>
      {marks.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => {
            setError(null);
            setDraft({ id: m.id, label: m.label, color: m.color, note: m.note ?? "" });
          }}
          title={m.note ? `${m.label} — ${m.note}` : `${m.label} (clique para editar)`}
          className={cn("mt-1 block w-full truncate rounded-xs px-1.5 py-0.5 text-left text-[11px] font-medium transition-[filter] hover:brightness-95", MARK_TONE[m.color].chip)}
        >
          {m.label}
        </button>
      ))}
      <button
        type="button"
        aria-label={`Adicionar marcação em ${dayLabel}`}
        title="Adicionar marcação"
        onClick={() => {
          setError(null);
          setDraft({ id: null, label: "", color: "blue", note: "" });
        }}
        className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-pill bg-bg text-muted opacity-0 shadow-[0_0_0_1px_var(--border)] transition-opacity duration-fast hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
      <Dialog
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Editar marcação" : "Nova marcação"}
        description={dayLabel}
        size="sm"
        footer={
          <>
            {draft?.id && (
              <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={remove} disabled={pending}>
                Apagar
              </Button>
            )}
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <Field label="Marcação" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={60} placeholder="Ex.: Promoção de aniversário" autoFocus />
            <div className="-mt-2 flex flex-wrap gap-1">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setDraft({ ...draft, label: s })} className="rounded-pill bg-surface px-2 py-0.5 text-xs text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-input)]">
                  {s}
                </button>
              ))}
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-fg">Cor</legend>
              <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
                {(Object.keys(MARK_TONE) as MarkColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === c}
                    aria-label={MARK_TONE[c].label}
                    title={MARK_TONE[c].label}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={cn("grid size-8 place-items-center rounded-pill transition-[box-shadow,transform] duration-fast", draft.color === c ? "scale-110 shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--accent)]" : "hover:scale-105")}
                  >
                    <span className={cn("size-6 rounded-pill", MARK_TONE[c].dot)} />
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Observação (opcional)
              <textarea rows={2} value={draft.note} maxLength={500} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="resize-y border border-border text-base font-normal text-fg" />
            </label>
            <p className="flex items-center gap-2 text-xs text-muted">
              Prévia: <span className={cn("rounded-xs px-1.5 py-0.5 text-[11px] font-medium", MARK_TONE[draft.color].chip)}>{draft.label || "Marcação"}</span>
            </p>
            {error && (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
