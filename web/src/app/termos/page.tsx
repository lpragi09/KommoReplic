import { LegalPage } from "@/components/marketing/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Termos de uso" };

export default function Termos() {
  return (
    <LegalPage title="Termos de uso" updated="12 de outubro de 2026">
      <section>
        <h2>O serviço</h2>
        <p>O {BRAND.name} é um sistema para organizar vendas: funil, conversas com clientes, tarefas e equipe. Você é responsável pelo que registra e pelas mensagens que envia aos seus clientes.</p>
      </section>
      <section>
        <h2>Teste, planos e cancelamento</h2>
        <ul>
          <li>Teste grátis de 14 dias, sem cartão.</li>
          <li>Planos mensais por usuário, sem fidelidade. Você cancela quando quiser, em um clique, dentro do app.</li>
          <li>No plano anual, se cancelar no meio do período, devolvemos o valor proporcional aos meses não usados.</li>
          <li>Mensagens do WhatsApp iniciadas pela empresa são cobradas pela Meta e repassadas a preço de custo, separadas na fatura.</li>
        </ul>
      </section>
      <section>
        <h2>Uso correto</h2>
        <p>Não é permitido usar o {BRAND.name} para enviar mensagens a quem não pediu (spam), para fraudes, ou em desacordo com as regras dos canais conectados (por exemplo, as políticas do WhatsApp Business).</p>
      </section>
      <section>
        <h2>Disponibilidade</h2>
        <p>Trabalhamos para o serviço ficar no ar o tempo todo e avisamos em uma página de status quando algo parar. Falhas em serviços de terceiros (como a Meta) podem afetar canais conectados.</p>
      </section>
      <section>
        <h2>Seus dados</h2>
        <p>Os dados são seus. Você pode exportá-los ou apagá-los. Veja a política de privacidade.</p>
      </section>
    </LegalPage>
  );
}
