import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Modelos de mensagem" };

export default function Page() {
  return <StubPage title="Modelos de mensagem" screen="S22" text="Respostas prontas com atalho / e modelos aprovados do WhatsApp." />;
}
