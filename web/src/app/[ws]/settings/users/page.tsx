import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Equipe e permissões" };

export default function Page() {
  return <StubPage title="Equipe e permissões" screen="S24" text="Convidar pessoas e definir o que cada papel vê: tudo, a equipe ou só os próprios." />;
}
