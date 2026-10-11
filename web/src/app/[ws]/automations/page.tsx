import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Automações" };

export default function Page() {
  return <StubPage title="Automações" screen="S20" text="Ações automáticas por etapa do funil: criar tarefa, mudar responsável, mover etapa, enviar webhook." />;
}
