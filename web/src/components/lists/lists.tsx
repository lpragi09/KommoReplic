"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { At, Building2, Contact, Download, Phone, Plus, Search, Upload, UserCircle, UserPlus } from "@/components/ui/icons";
import { createCompanyAction, createContactAction, importContactsAction } from "@/app/actions";
import { parseCsv } from "@/lib/csv";
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
              on ? "bg-bg text-fg shadow-[0_0_0_1px_var(--border),0_2px_6px_-2px_rgba(20,28,24,.25)]" : "text-muted hover:text-fg",
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
    <form role="search" className="group flex h-10 w-full items-center gap-2 rounded-pill bg-surface px-3.5 shadow-[inset_0_0_0_1px_var(--border)] transition-[box-shadow,background-color] duration-fast focus-within:bg-bg focus-within:shadow-[inset_0_0_0_1px_var(--focus),0_0_0_4px_rgba(31,122,85,.15)] sm:w-72">
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

type ImportRow = { name: string; phone?: string; email?: string; companyName?: string };

/* cabeçalho da planilha → campo; sem cabeçalho reconhecido, vale a ordem nome, telefone, email, empresa */
const COLS: [keyof ImportRow, RegExp][] = [
  ["name", /^(nome|name|cliente|contato|nome completo)$/],
  ["phone", /^(telefone|celular|whatsapp|fone|phone|tel|numero|n[uú]mero)$/],
  ["email", /^(e-?mail)$/],
  ["companyName", /^(empresa|company|organiza[cç][aã]o|neg[oó]cio)$/],
];
const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function rowsFromCsv(text: string): ImportRow[] {
  const table = parseCsv(text);
  if (!table.length) return [];
  const head = table[0].map(plain);
  let map = head.map((h) => COLS.find(([, re]) => re.test(h))?.[0] ?? null);
  let body = table.slice(1);
  if (!map.some(Boolean)) {
    map = ["name", "phone", "email", "companyName"];
    body = table;
  }
  return body
    .map((r) => {
      const o: ImportRow = { name: "" };
      map.forEach((k, i) => {
        if (k && r[i]) o[k] = r[i].slice(0, k === "name" ? 120 : 200);
      });
      return o;
    })
    .filter((o) => o.name || o.phone || o.email);
}

/** Importar e exportar contatos em planilha (CSV do Excel ou do Google Planilhas). */
export function ContactsCsvButtons({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [file, setFile] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setMsg(undefined);
    if (!f) return;
    if (f.size > 2_000_000) return setMsg({ ok: false, text: "Arquivo grande demais (máximo 2 MB)." });
    setFile(f.name);
    const list = rowsFromCsv(await f.text());
    setRows(list);
    if (!list.length) setMsg({ ok: false, text: "Não achei contatos nesse arquivo. A 1ª linha deve ter os títulos: nome, telefone, email, empresa." });
  }

  function send() {
    if (!rows?.length) return;
    start(async () => {
      const r = await importContactsAction(slug, rows);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      const { created, skipped } = r.data;
      setMsg({ ok: true, text: `${created} ${created === 1 ? "contato importado" : "contatos importados"}${skipped ? `; ${skipped} pulados (já existiam ou sem nome, telefone e email)` : ""}.` });
      setRows(null);
      router.refresh();
    });
  }

  return (
    <>
      <a
        href={`/${slug}/contacts/export`}
        download
        className="inline-flex h-9 items-center gap-2 rounded-sm bg-bg px-3 text-base text-fg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] transition-shadow hover:bg-surface hover:shadow-[0_0_0_1px_var(--border-input)]"
      >
        <Download className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">Exportar</span>
      </a>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setRows(null);
            setFile("");
            setMsg(undefined);
          }
        }}
        icon={<Upload className="size-5" />}
        title="Importar contatos"
        description="Planilha CSV (Excel: Salvar como → CSV; Google Planilhas: Arquivo → Fazer download → CSV). Quem já existe pelo telefone ou email é pulado."
        size="md"
        trigger={
          <Button variant="secondary" icon={<Upload className="size-4" aria-hidden />}>
            <span className="sr-only sm:not-sr-only">Importar</span>
          </Button>
        }
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {msg?.ok ? "Fechar" : "Cancelar"}
            </Button>
            <Button type="button" onClick={send} loading={pending} disabled={!rows?.length}>
              {rows?.length ? `Importar ${rows.length} ${rows.length === 1 ? "contato" : "contatos"}` : "Importar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-input bg-surface px-4 py-6 text-center hover:bg-canvas">
            <Upload className="size-6 text-accent" aria-hidden />
            <span className="text-sm font-medium text-fg">{file || "Escolher arquivo .csv"}</span>
            <span className="text-xs text-muted">Colunas: nome, telefone, email, empresa (nessa ordem ou com esses títulos)</span>
            <input type="file" accept=".csv,text/csv" onChange={pick} className="sr-only" />
          </label>
          {rows && rows.length > 0 && (
            <div className="overflow-hidden rounded-lg shadow-[0_0_0_1px_var(--border)]">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Prévia dos contatos</caption>
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Telefone</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="max-w-40 truncate px-3 py-2 text-fg">{r.name || "—"}</td>
                      <td className="px-3 py-2 text-fg">{r.phone || "—"}</td>
                      <td className="hidden max-w-48 truncate px-3 py-2 text-fg sm:table-cell">{r.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && <p className="border-t border-border bg-surface px-3 py-2 text-xs text-muted">e mais {rows.length - 5}…</p>}
            </div>
          )}
          {msg && (
            <p role="status" className={cn("rounded-md px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
              {msg.text}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
