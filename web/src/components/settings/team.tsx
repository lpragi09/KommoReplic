"use client";

import { useState, useTransition } from "react";
import type { Invite, Member, Role } from "@/data/types";
import { addMemberAction, createInviteAction, removeMemberAction, revokeInviteAction, setMemberRoleAction } from "@/app/actions";
import { Avatar } from "@/components/ui/bits";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import { Check, Copy, Link2, Trash2, UserPlus, WhatsappLogo } from "@/components/ui/icons";
import { when } from "@/lib/format";

const roleHelp: Record<string, string> = {
  Admin: "Vê e altera tudo, inclusive equipe, robôs e cobrança.",
  Gerente: "Vê todos os leads e contatos; não mexe em configurações.",
  Vendedor: "Vê e edita só os próprios leads e contatos.",
};

export function TeamManager({ slug, roles, members, invites = [], meId, canManage }: { slug: string; roles: Role[]; members: Member[]; invites?: Invite[]; meId: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const defaultRole = roles.find((r) => r.name === "Vendedor")?.id ?? roles[0]?.id ?? "";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", roleId: defaultRole });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  const sendInvite = () =>
    start(async () => {
      const res = await createInviteAction(slug, invite);
      if (!res.ok) return setInviteError(res.error);
      setInviteError(null);
      setInviteUrl(res.data.url);
      setEmailed(res.data.emailed);
    });
  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const revoke = (i: Invite) =>
    start(async () => {
      const res = await revokeInviteAction(slug, i.id);
      setRowError(res.ok ? null : res.error);
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
            <>
              <Button
                variant="secondary"
                icon={<UserPlus className="size-4" aria-hidden />}
                onClick={() => {
                  setError(null);
                  setOpen(true);
                }}
              >
                Criar acesso
              </Button>
              <Button
                icon={<Link2 className="size-4" aria-hidden />}
                onClick={() => {
                  setInviteError(null);
                  setInviteUrl(null);
                  setInvite({ email: "", roleId: defaultRole });
                  setInviteOpen(true);
                }}
              >
                Convidar por link
              </Button>
            </>
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
                    icon={<Trash2 className="size-5" />}
                    tone="danger"
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

        {canManage && invites.length > 0 && (
          <section aria-labelledby="convites">
            <h2 id="convites" className="mb-2 text-sm font-semibold text-fg">
              Convites esperando resposta
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg bg-bg shadow-[0_0_0_1px_var(--border)]">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid size-10 place-items-center rounded-pill bg-surface text-muted" aria-hidden>
                    <Link2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{i.email}</p>
                    <p className="text-sm text-muted" suppressHydrationWarning>
                      {i.roleName} · vence {when(i.expiresAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => revoke(i)}>
                    Cancelar convite
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

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
        icon={<UserPlus className="size-5" />}
        title="Criar acesso"
        description="Para quem ainda não tem conta: você define a senha inicial e passa para a pessoa. Quem já tem conta entra por convite."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={add} loading={pending}>
              Criar acesso
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

      <Dialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        icon={<Link2 className="size-5" />}
        title="Convidar por link"
        description="A pessoa abre o link, cria a senha (ou entra com a conta que já tem) e cai direto na empresa. O link vale 7 dias e só serve para o email convidado."
        footer={
          inviteUrl ? (
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={sendInvite} loading={pending}>
                Gerar link
              </Button>
            </>
          )
        }
      >
        {inviteUrl ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg">
              {emailed ? (
                <>
                  Enviamos o convite para <strong>{invite.email}</strong> por email. Se quiser, mande o link também:
                </>
              ) : (
                <>
                  Convite para <strong>{invite.email}</strong> pronto. Mande o link:
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-sm">{inviteUrl}</code>
              <Button size="sm" variant="secondary" icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} onClick={copyInvite}>
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Oi! Te convidei para a equipe no netzer tech: ${inviteUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-fit items-center gap-2 rounded-sm bg-[#0b6b38] px-3 text-sm font-medium text-white hover:brightness-110"
            >
              <WhatsappLogo className="size-4" aria-hidden /> Mandar pelo WhatsApp
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Email da pessoa" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} autoComplete="off" autoFocus />
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Papel
              <select value={invite.roleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal text-fg">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-muted">{roleHelp[roles.find((r) => r.id === invite.roleId)?.name ?? ""] ?? ""}</span>
            </label>
            {inviteError && (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
                {inviteError}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
