"use client";

import { useState, useTransition } from "react";
import type { CustomField, FieldKind } from "@/data/types";
import { deleteFieldAction, saveFieldAction } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/bits";
import { ListPlus, Pencil, Plus, Trash2 } from "@/components/ui/icons";

export const KIND_LABEL: Record<FieldKind, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  money: "Valor (R$)",
  select: "Lista de opções",
  date: "Data",
  checkbox: "Sim / não",
  url: "Link",
  phone: "Telefone",
  email: "Email",
};

type Draft = { id: string | null; name: string; kind: FieldKind; options: string };

export function FieldsManager({ slug, fields }: { slug: string; fields: CustomField[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (!draft) return;
      const options = draft.options
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      const res = await saveFieldAction(slug, draft.id, { name: draft.name, kind: draft.kind, options });
      if (!res.ok) return setError(res.error);
      setError(null);
      setDraft(null);
    });
  const remove = (f: CustomField) =>
    start(async () => {
      const res = await deleteFieldAction(slug, f.id);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted">Dados extras que aparecem no cartão de cada lead, na aba “Principal”.</p>
          <Button
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => {
              setError(null);
              setDraft({ id: null, name: "", kind: "text", options: "" });
            }}
          >
            Novo campo
          </Button>
        </div>
        {error && !draft && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {fields.length === 0 ? (
          <EmptyState icon={ListPlus} title="Nenhum campo ainda" text="Ex.: “Como conheceu”, “Data do evento”, “CPF/CNPJ”, “Tamanho do pedido”." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{f.name}</p>
                  <p className="truncate text-sm text-muted">
                    {KIND_LABEL[f.kind]}
                    {f.kind === "select" && f.options.length > 0 && ` · ${f.options.join(", ")}`}
                  </p>
                </div>
                <IconButton
                  label={`Editar ${f.name}`}
                  onClick={() => {
                    setError(null);
                    setDraft({ id: f.id, name: f.name, kind: f.kind, options: f.options.join("\n") });
                  }}
                >
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label={`Apagar ${f.name}`} tone="danger" onClick={() => remove(f)} disabled={pending}>
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        icon={<ListPlus className="size-5" />}
        title={draft?.id ? "Editar campo" : "Novo campo"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              Salvar campo
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3">
            <Field label="Nome do campo" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} autoFocus placeholder="Ex.: Como conheceu" />
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Tipo
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as FieldKind })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal text-fg">
                {(Object.keys(KIND_LABEL) as FieldKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {draft.kind === "select" && (
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Opções (uma por linha)
                <textarea
                  rows={5}
                  value={draft.options}
                  onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                  placeholder={"Instagram\nIndicação\nGoogle"}
                  className="resize-y rounded-sm border border-border bg-bg px-3 py-2 text-base font-normal text-fg hover:border-border-input focus:border-focus focus:outline-none"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
