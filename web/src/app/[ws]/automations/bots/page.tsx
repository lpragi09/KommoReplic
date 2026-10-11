import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Bots" };

export default function Page() {
  return <StubPage title="Bots" screen="S21" text="Editor visual de bots de conversa." />;
}
