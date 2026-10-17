"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { At, Building2, Contact, Phone, Plus, Search, UserCircle, UserPlus } from "@/components/ui/icons";
import { createCompanyAction, createContactAction } from "@/app/actions";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";

export function ListsTabs({ slug, active, counts }: { slug: string; active: "contacts" | "companies"; counts?: { contacts: number; companies: number } }) {
  const tabs = [
    { v: "contacts", label: "Pessoas", icon: Contact, href: `/${slug}/contacts`, n: counts?.contacts },
    { v: "companies", label: "Empresas", icon: Building2, href: `/${slug}/companies`, n: counts?.companies },
  ] as const;
  return (
    <nav aria-label="Listas" className="inline-flex h-10 items-center gap-0.5 rounded-pill bg-surface p-1 shadow-[inset_0_0_0_1px_var(--border)]">
      {tabs.map((t) => {
        const on = t.v === active;
        return (
          <Link
            key={t.v}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-pill px-3.5 text-sm font-medium transition-colors",
              on ? "bg-bg text-fg shadow-[0_0_0_1px_var(--border),0_2px_6px_-2px_rgba(14,26,58,.25)]" : "text-muted hover:text-fg",
            )}
          >
            <t.icon className={cn("size-4", on && "text-accent")} aria-hidden />
            {t.label}
            {t.n !== undefined && <span className="rounded-pill bg-surface px-1.5 text-xs tabular-nums text-muted">{t.n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** busca que envia pelo endereço (?q=), no mesmo desenho da busca do funil */
export function SearchPill({ id, placeholder, defaultValue }: { id: string; placeholder: string; defaultValue: string }) {
  return (
    <form role="search" className="group flex h-10 w-full items-center gap-2 rounded-pill bg-surface px-3.5 shadow-[inset_0_0_0_1px_var(--border)] transition-[box-shadow,background-color] duration-fast focus-within:bg-bg focus-within:shadow-[inset_0_0_0_1px_var(--focus),0_0_0_4px_rgba(37,99,235,.15)] sm:w-72">
      <Search className="size-4 shrink-0 text-muted group-focus-within:text-accent" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input id={id} name="q" defaultValue={defaultValue} autoComplete="off" placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
    </form>
  );
}

export function NewContactButton({ slug, companies = [], defaultCompany = "", label = "Novo contato" }: { slug: string; companies?: string[]; defaultCompany?: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [company, setCompany] = useState(defaultCompany);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const r = await createContactAction(slug, { name, phone: String(f.get("phone") ?? ""), email: String(f.get("email") ?? ""), companyName: company });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.push(`/${slug}/contacts/${r.data.id}`);
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setError(undefined);
          setName("");
          setCompany(defaultCompany);
        }
      }}
      icon={<UserPlus className="size-5" />}
      title="Novo contato"
      description="Uma pessoa com quem você conversa ou vende."
      size="md"
      trigger={<Button icon={<Plus className="size-4" aria-hidden />}>{label}</Button>}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-contact" loading={pending}>
            Salvar contato
          </Button>
        </>
      }
    >
      <form id="new-contact" onSubmit={submit} className="flex flex-col gap-4" data-editing>
        <div className="flex items-center gap-4 rounded-lg bg-surface p-3 shadow-[inset_0_0_0_1px_var(--border)]">
          <Avatar name={name.trim() || "?"} size={40} />
          <div className="min-w-0">
            <p className={cn("truncate font-semibold", name.trim() ? "text-fg" : "text-muted")}>{name.trim() || "Nome do contato"}</p>
            <p className="truncate text-sm text-muted">{company.trim() || "Sem empresa"}</p>
          </div>
        </div>
        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={120} adornment={<UserCircle className="size-4" aria-hidden />} placeholder="Ana Paula Souza" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone" name="phone" type="tel" placeholder="+55 11 90000-0000" maxLength={30} adornment={<Phone className="size-4" aria-hidden />} />
          <Field label="Email" name="email" type="email" maxLength={200} spellCheck={false} autoComplete="off" adornment={<At className="size-4" aria-hidden />} placeholder="ana@empresa.com" />
        </div>
        <Field
          label="Empresa (opcional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          list="companies-list"
          maxLength={160}
          adornment={<Building2 className="size-4" aria-hidden />}
          placeholder="Escolha uma existente ou digite uma nova"
          hint="Se a empresa ainda não existe, ela é criada junto."
        />
        <datalist id="companies-list">
          {companies.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export function NewCompanyButton({ slug, label = "Nova empresa", variant = "primary" }: { slug: string; label?: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName("");
          setError(undefined);
        }
      }}
      icon={<Building2 className="size-5" />}
      title="Nova empresa"
      description="Agrupe as pessoas e os negócios de um mesmo cliente."
      size="sm"
      trigger={
        <Button variant={variant} icon={<Plus className="size-4" aria-hidden />}>
          {label}
        </Button>
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-company" loading={pending}>
            Criar empresa
          </Button>
        </>
      }
    >
      <form
        id="new-company"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createCompanyAction(slug, name);
            if (!r.ok) return setError(r.error);
            setOpen(false);
            router.push(`/${slug}/companies/${r.data.id}`);
          });
        }}
        data-editing
      >
        <Field label="Nome da empresa" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={160} adornment={<Building2 className="size-4" aria-hidden />} placeholder="Clínica Vida" error={error} />
      </form>
    </Dialog>
  );
}
