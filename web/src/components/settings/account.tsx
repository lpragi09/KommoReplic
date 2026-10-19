"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { changeMyEmailAction, changeMyPasswordAction, updateMyNameAction, updateWorkspaceAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/* Configurações de conta: meus dados (nome, email, senha) e dados da empresa. Cada bloco salva sozinho. */

type Msg = { ok: boolean; text: string } | null;

function Card({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-bg p-6 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {text && <p className="mt-0.5 text-sm text-muted">{text}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={cn("rounded-sm px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      {msg.text}
    </p>
  );
}

export function ProfileForms({ slug, name, email }: { slug: string; name: string; email: string }) {
  const [n, setN] = useState(name);
  const [e, setE] = useState(email);
  const [pwd, setPwd] = useState({ current: "", next: "", again: "" });
  const [msg, setMsg] = useState<{ name: Msg; email: Msg; pwd: Msg }>({ name: null, email: null, pwd: null });
  const [pending, start] = useTransition();

  const saveName = (ev: FormEvent) => {
    ev.preventDefault();
    start(async () => {
      const r = await updateMyNameAction(slug, n);
      setMsg((m) => ({ ...m, name: r.ok ? { ok: true, text: "Nome atualizado." } : { ok: false, text: r.error } }));
    });
  };
  const saveEmail = (ev: FormEvent) => {
    ev.preventDefault();
    start(async () => {
      const r = await changeMyEmailAction(slug, e);
      setMsg((m) => ({
        ...m,
        email: r.ok ? { ok: true, text: r.data.pending ? `Mandamos um link de confirmação para ${e}. O email muda quando você clicar nele.` : "Email atualizado." } : { ok: false, text: r.error },
      }));
    });
  };
  const savePwd = (ev: FormEvent) => {
    ev.preventDefault();
    if (pwd.next !== pwd.again) return setMsg((m) => ({ ...m, pwd: { ok: false, text: "A senha nova e a confirmação não são iguais." } }));
    start(async () => {
      const r = await changeMyPasswordAction(slug, pwd.current, pwd.next);
      setMsg((m) => ({ ...m, pwd: r.ok ? { ok: true, text: "Senha trocada." } : { ok: false, text: r.error } }));
      if (r.ok) setPwd({ current: "", next: "", again: "" });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="Seu nome" text="Aparece para a equipe e nas mensagens com {{responsavel}}.">
        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Nome" value={n} onChange={(x) => setN(x.target.value)} maxLength={120} autoComplete="name" />
          </div>
          <Button type="submit" loading={pending} disabled={!n.trim() || n.trim() === name}>
            Salvar nome
          </Button>
        </form>
        <div className="mt-3">
          <Status msg={msg.name} />
        </div>
      </Card>

      <Card title="Email de acesso" text="É com ele que você entra. Para trocar, confirmamos o email novo.">
        <form onSubmit={saveEmail} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Email" type="email" value={e} onChange={(x) => setE(x.target.value)} maxLength={200} autoComplete="email" spellCheck={false} />
          </div>
          <Button type="submit" loading={pending} disabled={!e.trim() || e.trim().toLowerCase() === email.toLowerCase()}>
            Trocar email
          </Button>
        </form>
        <div className="mt-3">
          <Status msg={msg.email} />
        </div>
      </Card>

      <Card title="Senha">
        <form onSubmit={savePwd} className="grid gap-3 sm:grid-cols-3">
          <Field label="Senha atual" type="password" value={pwd.current} onChange={(x) => setPwd({ ...pwd, current: x.target.value })} autoComplete="current-password" />
          <Field label="Senha nova" type="password" value={pwd.next} onChange={(x) => setPwd({ ...pwd, next: x.target.value })} autoComplete="new-password" hint="Pelo menos 8 caracteres." />
          <Field label="Repita a senha nova" type="password" value={pwd.again} onChange={(x) => setPwd({ ...pwd, again: x.target.value })} autoComplete="new-password" />
          <div className="sm:col-span-3">
            <Button type="submit" loading={pending} disabled={!pwd.current || pwd.next.length < 8 || !pwd.again}>
              Trocar senha
            </Button>
          </div>
        </form>
        <div className="mt-3">
          <Status msg={msg.pwd} />
        </div>
      </Card>
    </div>
  );
}

const TZ: [string, string][] = [
  ["America/Sao_Paulo", "Brasília (GMT-3)"],
  ["America/Fortaleza", "Fortaleza (GMT-3)"],
  ["America/Manaus", "Manaus (GMT-4)"],
  ["America/Rio_Branco", "Rio Branco (GMT-5)"],
  ["America/Noronha", "Fernando de Noronha (GMT-2)"],
];
const CUR: [string, string][] = [
  ["BRL", "Real (R$)"],
  ["USD", "Dólar (US$)"],
  ["EUR", "Euro (€)"],
];
const fmtPhone = (d: string) => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d);

export function CompanyForm({
  slug,
  ws,
  canEdit,
}: {
  slug: string;
  ws: { name: string; phone: string | null; timezone: string; currency: string; slug: string };
  canEdit: boolean;
}) {
  const [f, setF] = useState({ name: ws.name, phone: ws.phone ? fmtPhone(ws.phone) : "", timezone: ws.timezone, currency: ws.currency });
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const select = "h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal disabled:bg-surface";

  const save = (ev: FormEvent) => {
    ev.preventDefault();
    start(async () => {
      const r = await updateWorkspaceAction(slug, { ...f, timezone: f.timezone as "America/Sao_Paulo", currency: f.currency as "BRL" });
      setMsg(r.ok ? { ok: true, text: "Dados da empresa salvos." } : { ok: false, text: r.error });
    });
  };

  return (
    <Card title="Dados da empresa" text={canEdit ? "Nome, WhatsApp, fuso e moeda usados no painel, nos relatórios e nas mensagens com {{empresa}}." : "Só administradores mudam estes dados."}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome da empresa" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} maxLength={120} disabled={!canEdit} />
        <Field label="WhatsApp da empresa" value={f.phone} onChange={(x) => setF({ ...f, phone: x.target.value })} maxLength={20} inputMode="tel" placeholder="(11) 98888-1234" disabled={!canEdit} />
        <label className="flex flex-col gap-1 text-sm font-medium text-fg">
          Fuso horário
          <select value={f.timezone} onChange={(x) => setF({ ...f, timezone: x.target.value })} className={select} disabled={!canEdit}>
            {TZ.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-fg">
          Moeda
          <select value={f.currency} onChange={(x) => setF({ ...f, currency: x.target.value })} className={select} disabled={!canEdit}>
            {CUR.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted sm:col-span-2">
          Endereço do painel: <code>/{ws.slug}</code>. Ele não muda, para não quebrar links já enviados (convites, chat do site, links rastreáveis).
        </p>
        {canEdit && (
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending} disabled={!f.name.trim()}>
              Salvar dados da empresa
            </Button>
          </div>
        )}
      </form>
      <div className="mt-3">
        <Status msg={msg} />
      </div>
    </Card>
  );
}
