"use client";

import { useActionState, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { createWorkspaceAction, signInAction, signUpAction, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { ArrowLeft } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fx-aurora grid min-h-dvh lg:grid-cols-[1fr_480px]">
      {/* palavra gigante ao fundo, quase da cor do fundo */}
      <span aria-hidden className="fx-backword -bottom-4 -left-6 hidden sm:block">
        vendas
      </span>
      <div className="relative z-10 flex flex-col justify-between gap-10 px-6 pt-8 sm:px-10 lg:py-10">
        <Link
          href="/"
          className="fx-rise group inline-flex w-fit items-center gap-3 rounded-pill py-1 pl-1 pr-4 text-sm text-on-night-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-night)_12%,transparent)] transition-colors duration-fast ease-out hover:text-on-night"
        >
          <span className="grid size-8 place-items-center rounded-pill bg-[color-mix(in_srgb,var(--on-night)_8%,transparent)] transition-transform duration-fast ease-out group-hover:-translate-x-0.5" aria-hidden>
            <ArrowLeft className="size-4" />
          </span>
          Voltar ao início
        </Link>
        <div className="hidden max-w-xl lg:block">
          <p className="fx-rise text-caps uppercase text-on-night-muted" style={{ "--d": 1 } as CSSProperties}>
            CRM para quem vende pelo WhatsApp
          </p>
          <p className="fx-rise fx-gradient-text mt-3 text-hero" style={{ "--d": 2 } as CSSProperties}>
            Toda conversa vira venda organizada.
          </p>
          <p className="fx-rise mt-4 text-md text-on-night-muted" style={{ "--d": 3 } as CSSProperties}>
            Chat do site, WhatsApp e Instagram caindo direto no seu funil — com histórico, tarefas e equipe no mesmo lugar.
          </p>
        </div>
        <p className="fx-rise hidden text-xs text-on-night-muted lg:block" style={{ "--d": 4 } as CSSProperties}>
          {BRAND.name} · versão de desenvolvimento
        </p>
      </div>
      <main id="conteudo" className="relative z-10 flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="fx-rise fx-glow mx-auto w-full max-w-sm rounded-lg bg-bg p-6 text-fg sm:p-8" style={{ "--d": 2 } as CSSProperties}>
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
      subtitle="Que bom te ver de novo."
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
        <Field label="Email" name="email" type="email" autoComplete="email" spellCheck={false} defaultValue={state.values?.email} required autoFocus />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" size="lg" loading={pending} className="fx-shine">
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
        <Field label="Email de trabalho" name="email" type="email" autoComplete="email" spellCheck={false} defaultValue={state.values?.email} required />
        <Field label="Senha" name="password" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres" required minLength={8} />
        <Button type="submit" size="lg" loading={pending} className="fx-shine">
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
        <Button type="submit" size="lg" loading={pending} className="fx-shine">
          Abrir meu funil
        </Button>
      </form>
    </AuthShell>
  );
}
