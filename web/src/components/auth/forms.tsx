"use client";

import {
  useActionState,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  createWorkspaceAction,
  googleSignInAction,
  requestResetAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from "@/app/actions";
import type { SignupInfo } from "@/data/types";
import { CompanyFields } from "./company-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { ArrowLeft, GoogleLogo } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";
import { NetzerLogo } from "@/components/brand/logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fx-aurora grid min-h-dvh lg:grid-cols-[1fr_480px]">
      {/* palavra gigante ao fundo, quase da cor do fundo */}
      <span
        aria-hidden
        className="fx-backword -bottom-4 -left-6 hidden sm:block"
      >
        vendas
      </span>
      <div className="relative z-10 flex flex-col justify-between gap-10 px-6 pt-8 sm:px-10 lg:py-10">
        <Link
          href="/"
          className="fx-rise group inline-flex w-fit items-center gap-3 rounded-pill py-1 pl-1 pr-4 text-sm text-on-night-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-night)_12%,transparent)] transition-colors duration-fast ease-out hover:text-on-night"
        >
          <span
            className="grid size-8 place-items-center rounded-pill bg-[color-mix(in_srgb,var(--on-night)_8%,transparent)] transition-transform duration-fast ease-out group-hover:-translate-x-0.5"
            aria-hidden
          >
            <ArrowLeft className="size-4" />
          </span>
          Voltar ao início
        </Link>
        <div className="hidden max-w-xl lg:block">
          <NetzerLogo className="fx-rise mb-8 text-2xl text-brand-on-night" markClassName="h-10" />
          <p
            className="fx-rise text-caps uppercase text-on-night-muted"
            style={{ "--d": 1 } as CSSProperties}
          >
            CRM para quem vende pelo WhatsApp
          </p>
          <p
            className="fx-rise fx-gradient-text mt-3 text-hero"
            style={{ "--d": 2 } as CSSProperties}
          >
            Toda conversa vira venda organizada.
          </p>
          <p
            className="fx-rise mt-4 text-md text-on-night-muted"
            style={{ "--d": 3 } as CSSProperties}
          >
            Chat do site, WhatsApp e Instagram caindo direto no seu funil — com
            histórico, tarefas e equipe no mesmo lugar.
          </p>
        </div>
        <p
          className="fx-rise hidden text-xs text-on-night-muted lg:block"
          style={{ "--d": 4 } as CSSProperties}
        >
          uma marca {BRAND.parent} · {BRAND.parentTagline}
        </p>
      </div>
      <main
        id="conteudo"
        className="relative z-10 flex flex-col justify-center px-4 py-10 sm:px-10"
      >
        <div
          className="fx-rise fx-glow mx-auto w-full max-w-sm rounded-lg bg-bg p-6 text-fg sm:p-8"
          style={{ "--d": 2 } as CSSProperties}
        >
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
    <p
      role="alert"
      className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {state.error}
    </p>
  ) : null;
}

const noSubscribe = () => () => {};
/** ?next= da URL (ex.: voltar para um convite depois de entrar); o servidor só aceita caminho de convite */
const readNext = () => new URLSearchParams(window.location.search).get("next") ?? "";

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, {});
  const next = useSyncExternalStore(noSubscribe, readNext, () => "");
  return (
    <AuthShell
      title="Entrar"
      subtitle="Que bom te ver de novo."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link
            href="/signup"
            className="font-medium text-accent-text underline"
          >
            Criar conta grátis
          </Link>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <input type="hidden" name="next" value={next} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          defaultValue={state.values?.email}
          required
          autoFocus
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Link href="/esqueci" className="-mt-2 w-fit self-end text-sm font-medium text-accent-text hover:underline">
          Esqueci minha senha
        </Link>
        <Button type="submit" size="lg" loading={pending} className="fx-shine">
          Entrar
        </Button>
      </form>
      <GoogleButton />
    </AuthShell>
  );
}

/* "Continuar com Google": só aparece com NEXT_PUBLIC_GOOGLE_LOGIN=1 (provedor ligado no Supabase).
   Conta nova pelo Google cai no onboarding, que pede empresa e CPF/CNPJ. */
const GOOGLE_ON = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

function GoogleButton() {
  const [state, action, pending] = useActionState(googleSignInAction, {});
  if (!GOOGLE_ON) return null;
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <p className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </p>
      <FormError state={state} />
      <Button type="submit" variant="secondary" size="lg" loading={pending} icon={<GoogleLogo className="size-5" aria-hidden />}>
        Continuar com Google
      </Button>
    </form>
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
          <Link
            href="/login"
            className="font-medium text-accent-text underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <Field
          label="Seu nome"
          name="name"
          autoComplete="name"
          defaultValue={state.values?.name}
          required
          autoFocus
        />
        <Field
          label="Email de trabalho"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          defaultValue={state.values?.email}
          required
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Pelo menos 8 caracteres"
          required
          minLength={8}
        />
        <div className="mt-1 flex flex-col gap-4 border-t border-border pt-4">
          <CompanyFields defaults={state.values} />
        </div>
        <Button type="submit" size="lg" loading={pending} className="fx-shine">
          Criar conta
        </Button>
      </form>
      <GoogleButton />
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

export function OnboardingForm({ info }: { info: SignupInfo | null }) {
  const [state, action, pending] = useActionState(createWorkspaceAction, {});
  const [name, setName] = useState(state.values?.name ?? info?.company ?? "");
  const [slug, setSlug] = useState(
    state.values?.slug ?? slugify(info?.company ?? ""),
  );
  const [touched, setTouched] = useState(false);
  return (
    <AuthShell
      title="Sua empresa"
      subtitle="Passo 1 de 1 · dá para mudar tudo depois."
    >
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
          hint={
            slug
              ? `Seu funil fica em /${slug}`
              : "Letras minúsculas, números e hífen"
          }
          required
        />
        {/* documento: já vem do cadastro; quem entrou por convite ou criou o login antes preenche aqui */}
        <CompanyOnboarding info={info} values={state.values} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="tz" className="text-sm font-medium text-fg">
              Fuso horário
            </label>
            <select
              id="tz"
              name="timezone"
              defaultValue="America/Sao_Paulo"
              className="h-9 rounded-sm border border-border-input bg-bg px-2 text-base"
            >
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
            <select
              id="cur"
              name="currency"
              defaultValue="BRL"
              className="h-9 rounded-sm border border-border-input bg-bg px-2 text-base"
            >
              <option value="BRL">Real (R$)</option>
              <option value="USD">Dólar (US$)</option>
              <option value="EUR">Euro (€)</option>
            </select>
          </div>
        </div>
        <p className="text-sm text-muted">
          Criamos um funil “Vendas” com 4 etapas, Ganho e Perdido, e o chat do
          site pronto para instalar.
        </p>
        <Button type="submit" size="lg" loading={pending} className="fx-shine">
          Continuar para os planos
        </Button>
      </form>
    </AuthShell>
  );
}

/** Na criação da empresa o nome já está no campo de cima: aqui só documento e WhatsApp. */
function CompanyOnboarding({
  info,
  values,
}: {
  info: SignupInfo | null;
  values?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <CompanyFields
        withCompany={false}
        defaults={{
          company: info?.company,
          docType: values?.docType ?? info?.docType,
          document: values?.document ?? info?.document,
          phone: values?.phone ?? info?.phone,
        }}
      />
    </div>
  );
}

const readParam = (k: string) => () => new URLSearchParams(window.location.search).get(k) ?? "";

/** "Esqueci minha senha": pede o email e manda o link (a resposta não diz se a conta existe) */
export function ForgotForm() {
  const [state, action, pending] = useActionState(requestResetAction, {});
  const expired = useSyncExternalStore(noSubscribe, readParam("expirado"), () => "");
  return (
    <AuthShell
      title="Esqueci minha senha"
      subtitle="Mandamos um link para você criar uma senha nova."
      footer={
        <>
          Lembrou?{" "}
          <Link href="/login" className="font-medium text-accent-text underline">
            Voltar para o login
          </Link>
        </>
      }
    >
      {state.sent ? (
        <div role="status" className="flex flex-col gap-3 rounded-md bg-success-soft px-4 py-4 text-sm text-success">
          <p className="font-semibold">Pronto! Confira seu email.</p>
          <p>
            Se existir uma conta com <strong>{state.values?.email}</strong>, o link chega em instantes. Ele vale por 1 hora. Olhe também a caixa de spam.
          </p>
          {state.devLink && (
            <Link href={state.devLink} className="font-medium underline">
              Abrir o link (modo de desenvolvimento, sem email)
            </Link>
          )}
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          {expired && <p className="rounded-sm bg-warning-soft px-3 py-2 text-sm text-warning">O link anterior expirou ou já foi usado. Peça um novo.</p>}
          <FormError state={state} />
          <Field label="Email da conta" name="email" type="email" autoComplete="email" spellCheck={false} defaultValue={state.values?.email} required autoFocus />
          <Button type="submit" size="lg" loading={pending} className="fx-shine">
            Mandar link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

/** chegou pelo link do email: escolhe a senha nova e já entra */
export function NewPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  const token = useSyncExternalStore(noSubscribe, readParam("token"), () => "");
  return (
    <AuthShell title="Senha nova" subtitle="Escolha uma senha com pelo menos 8 caracteres.">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <input type="hidden" name="token" value={token} />
        <Field label="Senha nova" name="password" type="password" autoComplete="new-password" required autoFocus />
        <Field label="Repita a senha nova" name="again" type="password" autoComplete="new-password" required />
        <Button type="submit" size="lg" loading={pending} className="fx-shine">
          Salvar e entrar
        </Button>
        <Link href="/esqueci" className="w-fit text-sm text-muted hover:text-fg hover:underline">
          Pedir outro link
        </Link>
      </form>
    </AuthShell>
  );
}
