"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { acceptInviteAction, acceptInviteNewAccountAction } from "@/app/actions";
import type { InviteInfo } from "@/data/types";
import { AuthShell } from "./forms";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";

/* Página do convite: quem recebeu o link entra na equipe — com a conta que já tem ou criando a senha aqui. */
export function InviteScreen({ token, invite, me }: { token: string; invite: InviteInfo | null; me: { email: string } | null }) {
  if (!invite || invite.state !== "ok")
    return (
      <AuthShell title="Convite indisponível" subtitle={!invite ? "Este link não existe." : invite.state === "accepted" ? "Este convite já foi usado." : "Este convite venceu (valem 7 dias)."}>
        <p className="text-sm text-muted">Peça um link novo para quem te convidou{invite ? ` em ${invite.workspaceName}` : ""}.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-accent-text underline">
          Ir para o login
        </Link>
      </AuthShell>
    );

  const title = `Entrar em ${invite.workspaceName}`;
  const subtitle = `Você foi convidado como ${invite.roleName} para ${invite.email}.`;
  if (me) return <AcceptExisting token={token} invite={invite} me={me} title={title} subtitle={subtitle} />;
  return <NewAccount token={token} invite={invite} title={title} subtitle={subtitle} />;
}

function AcceptExisting({ token, invite, me, title, subtitle }: { token: string; invite: InviteInfo; me: { email: string }; title: string; subtitle: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const sameEmail = me.email.toLowerCase() === invite.email.toLowerCase();
  return (
    <AuthShell title={title} subtitle={subtitle}>
      {sameEmail ? (
        <div className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await acceptInviteAction(token);
                if (r?.error) setError(r.error);
              })
            }
          >
            Aceitar e entrar
          </Button>
        </div>
      ) : (
        <p className="rounded-md bg-surface px-3 py-2 text-sm text-fg">
          Você está conectado como <strong>{me.email}</strong>, mas o convite é para <strong>{invite.email}</strong>.{" "}
          <Link href="/sair" prefetch={false} className="font-medium text-accent-text underline">
            Sair
          </Link>{" "}
          e abra o link de novo com a conta certa.
        </p>
      )}
    </AuthShell>
  );
}

function NewAccount({ token, invite, title, subtitle }: { token: string; invite: InviteInfo; title: string; subtitle: string }) {
  const [state, action, pending] = useActionState(acceptInviteNewAccountAction.bind(null, token), {});
  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      footer={
        <>
          Já tem conta com esse email?{" "}
          <Link href={`/login?next=/convite/${token}`} className="font-medium text-accent-text underline">
            Entrar e aceitar
          </Link>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        {state.error && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        <Field label="Email" value={invite.email} readOnly disabled />
        <Field label="Seu nome" name="name" autoComplete="name" defaultValue={state.values?.name} required autoFocus maxLength={120} />
        <Field label="Crie uma senha" name="password" type="password" autoComplete="new-password" required minLength={8} hint="Pelo menos 8 caracteres." />
        <Button type="submit" size="lg" loading={pending}>
          Criar acesso e entrar
        </Button>
      </form>
    </AuthShell>
  );
}
