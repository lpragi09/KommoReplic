import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Chat da equipe" };

export default function Page() {
  return <StubPage title="Chat da equipe" screen="S11" text="Conversas internas e menções entre colegas." />;
}
