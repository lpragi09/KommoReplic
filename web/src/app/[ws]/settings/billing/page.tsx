import { StubPage } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Plano e cobrança" };

export default function Page() {
  return <StubPage title="Plano e cobrança" screen="S30" text="Assinatura por usuário com cartão, Pix ou boleto." />;
}
