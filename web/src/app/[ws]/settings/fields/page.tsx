import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Campos personalizados" };

export default function Page() {
  return <StubPage title="Campos personalizados" screen="S26" text="Campos extras para leads, contatos e empresas." />;
}
