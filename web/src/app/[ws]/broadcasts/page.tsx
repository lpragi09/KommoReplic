import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Transmissões" };

export default function Page() {
  return <StubPage title="Transmissões" screen="S23" text="Envio em massa para um público filtrado, com agendamento." />;
}
