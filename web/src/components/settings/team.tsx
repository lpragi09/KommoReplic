"use client";

import { useState, useTransition } from "react";
import type { Member, Role } from "@/data/types";
import { addMemberAction, removeMemberAction, setMemberRoleAction } from "@/app/actions";
import { Avatar } from "@/components/ui/bits";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import { Trash2, UserPlus } from "@/components/ui/icons";

const roleHelp: Record<string, string> = {
  Admin: "Vê e altera tudo, inclusive equipe, robôs e cobrança.",
  Gerente: "Vê todos os leads e contatos; não mexe em configurações.",
  Vendedor: "Vê e edita só os próprios leads e contatos.",
};

export function TeamManager({ slug, roles, members, meId, canManage }: { slug: string; roles: Role[]; members: Member[]; meId: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: roles.find((r) => r.name === "Vendedor")?.id ?? roles[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const res = await addMemberAction(slug, form);
      if (!res.ok) return setError(res.error);
      setError(null);
      setOpen(false);
      setForm({ ...form, name: "", email: "", password: "" });
    });
  const changeRole = (m: Member, roleId: string) =>
    start(async () => {
      const res = await setMemberRoleAction(slug, m.userId, roleId);
      setRowError(res.ok ? null : res.error);
    });
  const remove = (m: Member) =>
    start(async () => {
      const res = await removeMemberAction(slug, m.userId);
      setRowError(res.ok ? null : res.error);
    });

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted">
            {members.length} {members.length === 1 ? "pessoa" : "pessoas"} na equipe.
          </p>
          {canManage && (
            <Button
              icon={<UserPlus className="size-4" aria-hidden />}
              onClick={() => {
                setError(null);
                setOpen(true);
              }}
            >
              Adicionar pessoa
            </Button>
          )}
        </div>
        {rowError && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {rowError}
          </p>
        )}
        <ul className="divide-y divide-border overflow-hidden rounded-lg bg-bg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={m.name || m.email} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">
                  {m.name || m.email} {m.userId === meId && <span className="text-xs font-normal text-muted">(você)</span>}
                </p>
                <p className="truncate text-sm text-muted">{m.email}</p>
              </div>
              {canManage && m.userId !== meId ? (
                <>
                  <select
                    aria-label={`Papel de ${m.name || m.email}`}
                    value={m.roleId}
                    disabled={pending}
                    onChange={(e) => changeRole(m, e.target.value)}
                    className="h-9 rounded-sm border border-border-input bg-bg px-2 text-sm text-fg"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <Dialog
                    title={`Remover ${m.name || m.email}?`}
                    description="A pessoa perde o acesso a esta empresa. Os leads dela continuam aqui."
                    size="sm"
                    trigger={
                      <IconButton label={`Remover ${m.name || m.email}`} tone="danger">
                        <Trash2 className="size-4" />
                      </IconButton>
                    }
                    footer={
                      <>
                        <DialogClose asChild>
                          <Button variant="secondary">Cancelar</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button variant="danger" onClick={() => remove(m)}>
                            Remover
                          </Button>
                        </DialogClose>
                      </>
                    }
                  />
                </>
              ) : (
                <span className={m.isAdmin ? "rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-text" : "rounded-pill bg-surface px-2.5 py-0.5 text-xs text-muted"}>{m.roleName}</span>
              )}
            </li>
          ))}
        </ul>

        <section aria-labelledby="papeis" className="rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border)]">
          <h2 id="papeis" className="mb-2 text-sm font-semibold text-fg">
            O que cada papel pode fazer
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            {roles.map((r) => (
              <div key={r.id} className="rounded-md bg-surface p-3">
                <dt className="font-medium text-fg">{r.name}</dt>
                <dd className="text-muted">{roleHelp[r.name] ?? "Papel personalizado."}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Adicionar pessoa"
        description="Crie o acesso e passe o email e a senha inicial para a pessoa."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={add} loading={pending}>
              Adicionar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" autoFocus />
          <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          <Field label="Senha inicial" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" hint="Mínimo 8 caracteres." />
          <label className="flex flex-col gap-1 text-sm font-medium text-fg">
            Papel
            <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal text-fg">
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-muted">{roleHelp[roles.find((r) => r.id === form.roleId)?.name ?? ""] ?? ""}</span>
          </label>
          {error && (
            <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
