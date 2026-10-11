import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Relatórios" };

export default function Page() {
  return <StubPage title="Relatórios" screen="S18" text="Funil por etapa, ganhos e perdas por motivo, atividade por pessoa." />;
}
