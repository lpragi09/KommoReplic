import { redirect } from "next/navigation";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

/* Os bots viraram "robôs" dentro de Automações (mesmo editor de passos). */
export default async function Page({ params }: PageProps<"/[ws]/automations/bots">) {
  const { ws } = await params;
  redirect(`/${ws}/automations`);
}
