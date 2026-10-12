"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "@/components/ui/icons";
import { createContactAction } from "@/app/actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";

export function ListsTabs({ slug, active }: { slug: string; active: "contacts" | "companies" }) {
  const tabs = [
    { v: "contacts", label: "Contatos", href: `/${slug}/contacts` },
    { v: "companies", label: "Empresas", href: `/${slug}/companies` },
  ] as const;
  return (
    <nav aria-label="Listas" className="flex gap-4">
      {tabs.map((t) => (
        <Link
          key={t.v}
          href={t.href}
          aria-current={t.v === active ? "page" : undefined}
          className={cn("flex h-10 items-center border-b-2 text-caps uppercase", t.v === active ? "border-accent text-accent-text" : "border-transparent text-muted hover:text-fg")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function NewContactButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const r = await createContactAction(slug, { name: String(f.get("name")), phone: String(f.get("phone") ?? ""), email: String(f.get("email") ?? "") });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.push(`/${slug}/contacts/${r.data.id}`);
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Novo contato" size="sm" trigger={<Button icon={<Plus className="size-4" aria-hidden />}>Novo contato</Button>}>
      <form onSubmit={submit} className="flex flex-col gap-3" data-editing>
        <Field label="Nome" name="name" required autoFocus maxLength={120} />
        <Field label="Telefone" name="phone" type="tel" placeholder="+55 11 90000-0000" maxLength={30} />
        <Field label="Email" name="email" type="email" maxLength={200} spellCheck={false} autoComplete="off" />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
