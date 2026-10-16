"use client";

import { useState } from "react";
import { Field } from "@/components/ui/input";
import { maskDoc, maskPhone, validDoc, type DocType } from "@/lib/document";
import { cn } from "@/lib/cn";

/** Empresa, CPF/CNPJ e WhatsApp — usado no cadastro e na criação da empresa. */
export function CompanyFields({
  defaults,
  companyLabel = "Nome da empresa",
  companyName = "company",
  withCompany = true,
}: {
  withCompany?: boolean;
  defaults?: {
    company?: string;
    docType?: string | null;
    document?: string;
    phone?: string;
  };
  companyLabel?: string;
  companyName?: string;
}) {
  const [type, setType] = useState<DocType>(
    defaults?.docType === "cnpj" ? "cnpj" : "cpf",
  );
  const [doc, setDoc] = useState(maskDoc(type, defaults?.document ?? ""));
  const [phone, setPhone] = useState(maskPhone(defaults?.phone ?? ""));
  const [touched, setTouched] = useState(false);
  const full = doc.replace(/\D/g, "").length === (type === "cpf" ? 11 : 14);
  const bad = touched && full && !validDoc(type, doc);

  return (
    <>
      {withCompany && (
        <Field
          label={type === "cpf" ? "Nome do seu negócio" : companyLabel}
          name={companyName}
          defaultValue={defaults?.company}
          autoComplete="organization"
          required
          maxLength={120}
          placeholder={
            type === "cpf"
              ? "Ex.: Ana Doces, Studio Ana"
              : "Ex.: Clínica Vida Ltda."
          }
        />
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-fg">
          Você vende como
        </legend>
        <input type="hidden" name="docType" value={type} />
        <div
          role="radiogroup"
          aria-label="Tipo de documento"
          className="grid grid-cols-2 gap-1 rounded-sm bg-surface p-1 shadow-[inset_0_0_0_1px_var(--border)]"
        >
          {(
            [
              ["cpf", "Pessoa física (CPF)"],
              ["cnpj", "Empresa (CNPJ)"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={type === v}
              onClick={() => {
                setType(v);
                setDoc((d) => maskDoc(v, d));
              }}
              className={cn(
                "h-9 rounded-[6px] text-sm font-medium transition-[background-color,box-shadow,color] duration-fast ease-out",
                type === v
                  ? "bg-bg text-fg shadow-[0_1px_2px_rgba(14,26,58,.12),0_0_0_1px_var(--border)]"
                  : "text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <Field
        label={type === "cpf" ? "CPF" : "CNPJ"}
        name="document"
        inputMode="numeric"
        autoComplete="off"
        value={doc}
        onChange={(e) => setDoc(maskDoc(type, e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder={type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
        error={
          bad
            ? `${type === "cpf" ? "CPF" : "CNPJ"} inválido: confira os números.`
            : undefined
        }
        hint="Usado na nota fiscal. O teste grátis vale uma vez por documento."
        required
      />
      <Field
        label="WhatsApp (opcional)"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(maskPhone(e.target.value))}
        placeholder="(11) 98888-1234"
      />
    </>
  );
}
