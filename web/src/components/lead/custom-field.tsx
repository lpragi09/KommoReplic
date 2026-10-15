"use client";

import { useState, useTransition } from "react";
import type { CustomField, FieldValue } from "@/data/types";
import { setLeadFieldAction } from "@/app/actions";
import { cn } from "@/lib/cn";

const base =
  "h-8 w-full rounded-sm border border-transparent bg-transparent px-1 text-base text-fg placeholder:text-muted hover:border-border-input focus:border-focus focus:outline-none";

/** Valor de um campo personalizado no cartão do lead. Salva ao sair do campo (ou na hora, em lista/caixa/data). */
export function CustomFieldInput({ slug, leadId, field, value, onError }: { slug: string; leadId: string; field: CustomField; value: FieldValue | undefined; onError: (msg: string) => void }) {
  const [v, setV] = useState<FieldValue>(value ?? (field.kind === "checkbox" ? false : ""));
  const [saved, setSaved] = useState<FieldValue>(value ?? (field.kind === "checkbox" ? false : ""));
  const [pending, start] = useTransition();
  const id = `cf-${field.id}`;

  const save = (next: FieldValue) => {
    if (next === saved) return;
    start(async () => {
      const res = await setLeadFieldAction(slug, leadId, field.id, next === "" ? null : next);
      if (res.ok) setSaved(next);
      else {
        onError(res.error);
        setV(saved);
      }
    });
  };

  const label = (
    <label htmlFor={id} className="sr-only">
      {field.name}
    </label>
  );

  switch (field.kind) {
    case "checkbox":
      return (
        <span className="flex h-8 items-center px-1">
          <input
            id={id}
            type="checkbox"
            checked={!!v}
            disabled={pending}
            onChange={(e) => {
              setV(e.target.checked);
              save(e.target.checked);
            }}
            className="size-4 accent-[var(--accent)]"
          />
          {label}
        </span>
      );
    case "select":
      return (
        <>
          {label}
          <select
            id={id}
            value={String(v ?? "")}
            disabled={pending}
            onChange={(e) => {
              setV(e.target.value);
              save(e.target.value);
            }}
            className={base}
          >
            <option value="">—</option>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </>
      );
    case "date":
      return (
        <>
          {label}
          <input id={id} type="date" value={String(v ?? "")} onChange={(e) => setV(e.target.value)} onBlur={() => save(v)} className={base} />
        </>
      );
    case "textarea":
      return (
        <>
          {label}
          <textarea id={id} rows={2} value={String(v ?? "")} maxLength={2000} placeholder="—" onChange={(e) => setV(e.target.value)} onBlur={() => save(v)} className={cn(base, "h-auto resize-y py-1")} />
        </>
      );
    case "number":
    case "money":
      return (
        <span className="flex items-center">
          {field.kind === "money" && <span className="pl-1 text-sm text-muted">R$</span>}
          {label}
          <input
            id={id}
            inputMode="decimal"
            value={String(v ?? "")}
            placeholder="—"
            onChange={(e) => setV(e.target.value.replace(/[^\d,.-]/g, ""))}
            onBlur={() => {
              const raw = String(v ?? "").trim();
              if (!raw) return save("");
              const n = Number(raw.replace(/\./g, "").replace(",", "."));
              if (!Number.isFinite(n)) {
                onError("Digite um número.");
                return setV(saved);
              }
              setV(n);
              save(n);
            }}
            className={base}
          />
        </span>
      );
    default:
      return (
        <>
          {label}
          <input
            id={id}
            type={field.kind === "email" ? "email" : field.kind === "url" ? "url" : field.kind === "phone" ? "tel" : "text"}
            value={String(v ?? "")}
            maxLength={500}
            placeholder="—"
            onChange={(e) => setV(e.target.value)}
            onBlur={() => save(String(v ?? "").trim())}
            className={base}
          />
        </>
      );
  }
}
