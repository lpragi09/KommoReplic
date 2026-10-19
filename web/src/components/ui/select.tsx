"use client";

import { useId, useState, type ReactNode } from "react";
import { Select as S } from "radix-ui";
import { CaretUpDown, Check } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Seletor com a lista desenhada por nós (a do sistema é cinza e diferente em cada navegador).
   Teclado: setas, Enter, Esc e digitar a letra inicial. Valor vazio ("") vale como opção "todos". */

export type SelectOption = { value: string; label: string; icon?: ReactNode; hint?: string };

const EMPTY = "__vazio";

export function Select({
  label,
  hideLabel,
  value,
  defaultValue,
  onValueChange,
  options,
  name,
  icon,
  size = "md",
  className,
  triggerClassName,
  placeholder,
}: {
  label: string;
  hideLabel?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  options: SelectOption[];
  /** para enviar junto com um <form> */
  name?: string;
  /** ícone fixo à esquerda do valor */
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const selected = options.find((o) => o.value === (current ?? ""));
  const enc = (v: string | undefined) => (v === undefined ? undefined : v === "" ? EMPTY : v);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      <S.Root value={enc(value)} defaultValue={enc(defaultValue)} onValueChange={(v) => {
          const out = v === EMPTY ? "" : v;
          setInner(out);
          onValueChange?.(out);
        }} name={name}>
        <S.Trigger
          id={id}
          className={cn(
            "group inline-flex w-full items-center gap-2 rounded-md border border-border bg-[color-mix(in_srgb,var(--surface)_55%,var(--bg))] text-left text-fg shadow-[inset_0_1px_2px_rgba(20,28,24,.05)] outline-none transition-[border-color,box-shadow,background-color] duration-fast ease-out",
            "hover:border-border-input hover:bg-bg focus-visible:border-focus focus-visible:bg-bg focus-visible:shadow-[0_0_0_4px_rgba(31,122,85,.15)] data-[state=open]:border-focus data-[state=open]:bg-bg data-[state=open]:shadow-[0_0_0_4px_rgba(31,122,85,.15)]",
            size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-3.5 text-base",
            triggerClassName,
          )}
        >
          {icon && <span className="shrink-0 text-muted">{icon}</span>}
          <span className="min-w-0 flex-1 truncate">
            <S.Value placeholder={placeholder}>{selected?.label}</S.Value>
          </span>
          <CaretUpDown className="size-4 shrink-0 text-muted transition-colors group-hover:text-fg" aria-hidden />
        </S.Trigger>
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg bg-bg p-1.5 shadow-[0_0_0_1px_var(--border),0_18px_40px_-14px_rgba(20,28,24,.4)] data-[state=open]:animate-[fx-pop_.14s_ease-out]"
          >
            <S.Viewport className="flex flex-col gap-0.5">
              {options.map((o) => (
                <S.Item
                  key={o.value || EMPTY}
                  value={o.value || EMPTY}
                  className="relative flex cursor-pointer select-none items-center gap-2.5 rounded-md py-2 pl-2.5 pr-8 text-sm text-fg outline-none data-[highlighted]:bg-accent-soft data-[state=checked]:font-semibold data-[state=checked]:text-accent-text"
                >
                  {o.icon && <span className="grid shrink-0 place-items-center">{o.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <S.ItemText>{o.label}</S.ItemText>
                    {o.hint && <span className="block text-xs font-normal text-muted">{o.hint}</span>}
                  </span>
                  <S.ItemIndicator className="absolute right-2.5">
                    <Check className="size-4 text-accent" aria-hidden />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </div>
  );
}
