"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { createWorkspaceAction, signInAction, signUpAction, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_480px]">
      <div className="hidden flex-col justify-between bg-nav-bg p-10 text-nav-text lg:flex">
        <span className="grid size-10 place-items-center rounded-md bg-accent text-lg font-bold text-on-accent" aria-hidden>
          C
        </span>
        <div className="max-w-md">
          <p className="text-display text-on-inverse">Toda conversa vira venda organizada.</p>
          <p className="mt-3 text-md text-nav-muted">Chat do site, WhatsApp e Instagram caindo direto no seu funil — com histórico, tarefas e equipe no mesmo lugar.</p>
        </div>
        <p className="text-xs text-nav-muted">Versão de desenvolvimento</p>
      </div>
      <main className="flex flex-col justify-center px-4 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-xl text-fg">{title}</h1>
          <p className="mt-1 text-base text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

function FormError({ state }: { state: FormState }) {
  return state.error ? (
    <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
      {state.error}
    </p>
  ) : null;
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, {});
  return (
    <AuthShell
      title="Entrar"
      subtitle="Bem-vindo de volta."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/signup" className="font-medium text-accent-text underline">
            Criar conta grátis
          </Link>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required autoFocus />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" size="lg" loading={pending}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, {});
  return (
    <AuthShell
      title="Criar conta"
      subtitle="14 dias grátis, sem cartão."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-accent-text underline">
            Entrar
          </Link>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <Field label="Seu nome" name="name" autoComplete="name" defaultValue={state.values?.name} required autoFocus />
        <Field label="Email de trabalho" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
        <Field label="Senha" name="password" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres" required minLength={8} />
        <Button type="submit" size="lg" loading={pending}>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, {});
  const [name, setName] = useState(state.values?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [touched, setTouched] = useState(false);
  return (
    <AuthShell title="Sua empresa" subtitle="Passo 1 de 1 · dá para mudar tudo depois.">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <Field
          label="Nome da empresa"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setSlug(slugify(e.target.value));
          }}
          required
          autoFocus
        />
        <Field
          label="Endereço"
          name="slug"
          value={slug}
          onChange={(e) => {
            setTouched(true);
            setSlug(slugify(e.target.value));
          }}
          hint={slug ? `Seu funil fica em /${slug}` : "Letras minúsculas, números e hífen"}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="tz" className="text-sm font-medium text-fg">
              Fuso horário
            </label>
            <select id="tz" name="timezone" defaultValue="America/Sao_Paulo" className="h-9 rounded-sm border border-border-input bg-bg px-2 text-base">
              <option value="America/Sao_Paulo">Brasília</option>
              <option value="America/Manaus">Manaus</option>
              <option value="America/Fortaleza">Fortaleza</option>
              <option value="America/Noronha">Fernando de Noronha</option>
              <option value="America/Rio_Branco">Rio Branco</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cur" className="text-sm font-medium text-fg">
              Moeda
            </label>
            <select id="cur" name="currency" defaultValue="BRL" className="h-9 rounded-sm border border-border-input bg-bg px-2 text-base">
              <option value="BRL">Real (R$)</option>
              <option value="USD">Dólar (US$)</option>
              <option value="EUR">Euro (€)</option>
            </select>
          </div>
        </div>
        <p className="text-sm text-muted">Criamos um funil “Vendas” com 4 etapas, Ganho e Perdido, e o chat do site pronto para instalar.</p>
        <Button type="submit" size="lg" loading={pending}>
          Abrir meu funil
        </Button>
      </form>
    </AuthShell>
  );
}
