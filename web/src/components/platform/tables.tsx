"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { DropdownMenu } from "radix-ui";
import type { PlatformUser, PlatformWorkspace } from "@/data/platform/types";
import { PLAN_NAME, statusOf } from "./status";
import { createDemoAction, extendTrialAction, resetDemoAction, setBlockedAction, setPlanAction, setUserBannedAction, setUserPasswordAction } from "@/app/admin/actions";
import { when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/interactive";
import { MoreHorizontal, Search } from "@/components/ui/icons";

/* Tabelas da Central: empresas, usuários e demonstrações, com busca, filtros e ações de suporte. */

function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-medium", tone)}>{children}</span>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-sm bg-bg px-3 shadow-[inset_0_0_0_1px_var(--border)] focus-within:shadow-[inset_0_0_0_1px_var(--focus)] sm:max-w-80">
      <Search className="size-4 text-muted" aria-hidden />
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-full flex-1 bg-transparent text-sm outline-none" />
    </label>
  );
}

function useAct() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const act = (p: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await p();
      toast.show(r.ok ? { text: done, tone: "info" } : { text: r.error ?? "Não deu certo.", tone: "error" });
    });
  return { act, pending, node: toast.node };
}

const item = "flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-fg outline-none data-[highlighted]:bg-surface";

/* ---------------- empresas ---------------- */
export function WorkspacesTable({ rows, appHost, now }: { rows: PlatformWorkspace[]; appHost: string; now: number }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("todas");
  const { act, pending, node } = useAct();
  const filters = [
    ["todas", "Todas"],
    ["trial", "Em teste"],
    ["paying", "Pagantes"],
    ["free", "Cortesia"],
    ["paused", "Pausadas"],
    ["demo", "Demonstração"],
  ] as const;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((w) => (f === "todas" || statusOf(w, now).key === f) && (!s || [w.name, w.slug, w.ownerEmail, w.ownerName].some((x) => x?.toLowerCase().includes(s))));
  }, [rows, q, f]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar empresa, endereço ou dono…" />
        <div role="group" aria-label="Situação" className="flex flex-wrap gap-1">
          {filters.map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={f === v}
              onClick={() => setF(v)}
              className={cn("h-8 rounded-pill px-3 text-sm transition-colors duration-fast", f === v ? "bg-inverse-bg text-on-inverse" : "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-canvas")}
            >
              {l} <span className="ml-0.5 text-xs tabular-nums opacity-70">{v === "todas" ? rows.length : rows.filter((w) => statusOf(w, now).key === v).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={cn("overflow-x-auto rounded-xl bg-bg shadow-[0_0_0_1px_var(--border)] transition-opacity", pending && "opacity-60")}>
        <table className="w-full min-w-[920px] text-sm">
          <caption className="sr-only">Empresas</caption>
          <thead className="border-b border-border bg-surface text-left text-xs font-medium text-muted">
            <tr className="h-10">
              <th scope="col" className="pl-4 pr-2 font-medium">Empresa</th>
              <th scope="col" className="px-2 font-medium">Dono</th>
              <th scope="col" className="px-2 font-medium">Situação</th>
              <th scope="col" className="px-2 text-right font-medium">Pessoas</th>
              <th scope="col" className="px-2 text-right font-medium">Leads</th>
              <th scope="col" className="px-2 text-right font-medium">Msgs 30d</th>
              <th scope="col" className="px-2 font-medium">Criada</th>
              <th scope="col" className="w-12 pr-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((w) => {
              const st = statusOf(w, now);
              const label = `${w.name} (/${w.slug})`;
              const trialLeft = w.status === "trialing" && w.trialEndsAt ? Math.ceil((Date.parse(w.trialEndsAt) - now) / 864e5) : null;
              return (
                <tr key={w.id} className="hover:bg-[color-mix(in_srgb,var(--accent)_3%,var(--bg))]">
                  <td className="max-w-64 py-2.5 pl-4 pr-2">
                    <span className="block truncate font-semibold text-fg">{w.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {appHost}/{w.slug}
                    </span>
                  </td>
                  <td className="max-w-56 px-2 py-2.5">
                    <span className="block truncate text-fg">{w.ownerName || "—"}</span>
                    <span className="block truncate text-xs text-muted">{w.ownerEmail ?? ""}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="mt-0.5 block text-xs text-muted">
                      {w.plan !== "trial" ? PLAN_NAME[w.plan] : trialLeft !== null && trialLeft > 0 ? `faltam ${trialLeft} ${trialLeft === 1 ? "dia" : "dias"}` : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{w.members}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{w.leads.toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{w.messages30d.toLocaleString("pt-BR")}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-muted" suppressHydrationWarning>
                    {when(w.createdAt)}
                  </td>
                  <td className="pr-3 text-right">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg" aria-label={`Ações de ${w.name}`}>
                        <MoreHorizontal className="size-5" />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content align="end" sideOffset={4} className="fx-pop z-50 min-w-56 rounded-md border border-border bg-bg p-1 shadow-pop">
                          <DropdownMenu.Label className="px-2 py-1 text-xs text-muted">Teste grátis</DropdownMenu.Label>
                          {[7, 14, 30].map((d) => (
                            <DropdownMenu.Item key={d} className={item} onSelect={() => act(() => extendTrialAction(w.id, label, d), `Teste de ${w.name} estendido em ${d} dias.`)}>
                              Estender {d} dias
                            </DropdownMenu.Item>
                          ))}
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Label className="px-2 py-1 text-xs text-muted">Liberar plano (cortesia)</DropdownMenu.Label>
                          {(["basic", "advanced", "pro"] as const).map((p) => (
                            <DropdownMenu.Item key={p} className={item} onSelect={() => act(() => setPlanAction(w.id, label, p), `${w.name} agora está no ${PLAN_NAME[p]}.`)}>
                              {PLAN_NAME[p]}
                              {w.plan === p && w.status === "active" && <span className="ml-auto text-xs text-muted">atual</span>}
                            </DropdownMenu.Item>
                          ))}
                          <DropdownMenu.Item className={item} onSelect={() => act(() => setPlanAction(w.id, label, "trial"), `${w.name} voltou para 14 dias de teste.`)}>
                            Voltar para o teste (14 dias)
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          {w.isDemo && (
                            <DropdownMenu.Item className={item} onSelect={() => act(() => resetDemoAction(w.id, label), `Dados de ${w.name} restaurados.`)}>
                              Restaurar dados da demonstração
                            </DropdownMenu.Item>
                          )}
                          {st.key === "paused" ? (
                            <DropdownMenu.Item className={item} onSelect={() => act(() => setBlockedAction(w.id, label, false), `${w.name} reativada.`)}>
                              Reativar empresa
                            </DropdownMenu.Item>
                          ) : (
                            <DropdownMenu.Item className={cn(item, "text-danger data-[highlighted]:bg-danger-soft")} onSelect={() => act(() => setBlockedAction(w.id, label, true), `${w.name} pausada.`)}>
                              Pausar empresa
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  Nenhuma empresa com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {node}
    </div>
  );
}

/* ---------------- usuários ---------------- */
export function UsersTable({ rows, admins }: { rows: PlatformUser[]; admins: string[] }) {
  const [q, setQ] = useState("");
  const [pwFor, setPwFor] = useState<PlatformUser | null>(null);
  const { act, pending, node } = useAct();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((u) => !s || [u.name, u.email, ...u.workspaces.map((w) => w.name)].some((x) => x.toLowerCase().includes(s)));
  }, [rows, q]);
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={q} onChange={setQ} placeholder="Buscar nome, email ou empresa…" />
      <div className={cn("overflow-x-auto rounded-xl bg-bg shadow-[0_0_0_1px_var(--border)] transition-opacity", pending && "opacity-60")}>
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Usuários</caption>
          <thead className="border-b border-border bg-surface text-left text-xs font-medium text-muted">
            <tr className="h-10">
              <th scope="col" className="pl-4 pr-2 font-medium">Pessoa</th>
              <th scope="col" className="px-2 font-medium">Empresas</th>
              <th scope="col" className="px-2 font-medium">Último acesso</th>
              <th scope="col" className="px-2 font-medium">Criada</th>
              <th scope="col" className="px-2 font-medium">Acesso</th>
              <th scope="col" className="w-12 pr-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((u) => {
              const owner = admins.includes(u.email.toLowerCase());
              return (
                <tr key={u.id} className="hover:bg-[color-mix(in_srgb,var(--accent)_3%,var(--bg))]">
                  <td className="max-w-64 py-2.5 pl-4 pr-2">
                    <span className="flex items-center gap-2 truncate font-semibold text-fg">
                      {u.name || u.email.split("@")[0]}
                      {owner && <Badge tone="bg-accent text-on-accent">Dono</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </td>
                  <td className="max-w-64 px-2 py-2.5 text-muted">
                    <span className="line-clamp-2">{u.workspaces.length ? u.workspaces.map((w) => w.name).join(", ") : "Sem empresa"}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-muted" suppressHydrationWarning>
                    {u.lastSignInAt ? when(u.lastSignInAt) : "nunca"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-muted" suppressHydrationWarning>
                    {when(u.createdAt)}
                  </td>
                  <td className="px-2 py-2.5">{u.banned ? <Badge tone="bg-danger-soft text-danger">Bloqueado</Badge> : <Badge tone="bg-success-soft text-success">Liberado</Badge>}</td>
                  <td className="pr-3 text-right">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg" aria-label={`Ações de ${u.email}`}>
                        <MoreHorizontal className="size-5" />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content align="end" sideOffset={4} className="fx-pop z-50 min-w-52 rounded-md border border-border bg-bg p-1 shadow-pop">
                          <DropdownMenu.Item className={item} onSelect={() => setPwFor(u)}>
                            Definir nova senha
                          </DropdownMenu.Item>
                          {!owner &&
                            (u.banned ? (
                              <DropdownMenu.Item className={item} onSelect={() => act(() => setUserBannedAction(u.id, u.email, false), `Acesso de ${u.email} liberado.`)}>
                                Liberar acesso
                              </DropdownMenu.Item>
                            ) : (
                              <DropdownMenu.Item className={cn(item, "text-danger data-[highlighted]:bg-danger-soft")} onSelect={() => act(() => setUserBannedAction(u.id, u.email, true), `Acesso de ${u.email} bloqueado.`)}>
                                Bloquear acesso
                              </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pwFor && <PasswordDialog user={pwFor} onClose={() => setPwFor(null)} />}
      {node}
    </div>
  );
}

function PasswordDialog({ user, onClose }: { user: PlatformUser; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Nova senha para ${user.email}`}
      description="A pessoa entra com essa senha a partir de agora. Passe para ela por um canal seguro."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await setUserPasswordAction(user.id, user.email, pw);
                if (!r.ok) return setError(r.error);
                onClose();
              })
            }
          >
            Salvar senha
          </Button>
        </>
      }
    >
      <Field label="Nova senha" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" hint="Pelo menos 8 caracteres." />
      {error && (
        <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/* ---------------- demonstrações ---------------- */
export function DemoCreator() {
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [done, setDone] = useState<{ slug: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await createDemoAction(f);
          if (!r.ok) return setError(r.error);
          setDone({ slug: r.data.slug, email: f.email });
          setF({ name: "", email: "", password: "" });
        });
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <Field label="Nome da empresa" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Clínica Sorriso (demo)" maxLength={80} />
      <Field label="Email de acesso" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="demo@suaempresa.com" autoComplete="off" />
      <Field label="Senha da demonstração" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" hint="Pelo menos 8 caracteres." />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" loading={pending} disabled={!f.name.trim() || !f.email.trim() || f.password.length < 8}>
          Criar demonstração
        </Button>
        <p className="text-xs text-muted">Cria o usuário, a empresa no plano Operação (sem cobrança) e 10 negócios de exemplo com conversas e tarefas.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-3">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-sm bg-success-soft px-3 py-2 text-sm text-success sm:col-span-3">
          Pronta! Entre com <strong>{done.email}</strong> e a senha que você definiu. O painel fica em /{done.slug}.
        </p>
      )}
    </form>
  );
}

export function DemoList({ rows, appHost }: { rows: PlatformWorkspace[]; appHost: string }) {
  const { act, pending, node } = useAct();
  if (!rows.length) return <p className="text-sm text-muted">Nenhuma demonstração ainda.</p>;
  return (
    <>
    <ul className={cn("grid gap-3 sm:grid-cols-2", pending && "opacity-60")}>
      {rows.map((w) => (
        <li key={w.id} className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-[inset_0_0_0_1px_var(--border)]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-fg">{w.name}</p>
              <p className="truncate text-xs text-muted">
                {appHost}/{w.slug}
              </p>
            </div>
            <Badge tone="bg-accent-soft text-accent-text">{w.leads} leads</Badge>
          </div>
          <p className="truncate text-sm text-muted">Login: {w.ownerEmail ?? "—"}</p>
          <div className="mt-1 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => act(() => resetDemoAction(w.id, `${w.name} (/${w.slug})`), "Demonstração restaurada.")}>
              Restaurar dados
            </Button>
          </div>
        </li>
      ))}
    </ul>
    {node}
    </>
  );
}
