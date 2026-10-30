import Link from "next/link";
import { LegalContact, LegalPage } from "@/components/marketing/legal";
import { BRAND } from "@/lib/brand";
import { LEGAL, LEGAL_UPDATED } from "@/lib/legal";

export const metadata = { title: "Termos de uso" };

export default function Termos() {
  return (
    <LegalPage title="Termos de uso" updated={LEGAL_UPDATED}>
      <section>
        <h2>Resumo</h2>
        <ul>
          <li>Teste grátis de 14 dias, sem cartão. Depois, você paga por período: não há cobrança automática nem fidelidade.</li>
          <li>Você pode desistir de uma compra em até 7 dias e receber o valor de volta.</li>
          <li>O agente de IA não vem no plano: ele usa créditos comprados à parte ou a sua própria chave da Anthropic.</li>
          <li>O WhatsApp por QR code não é a API oficial da Meta, e o número pode ser bloqueado pelo WhatsApp.</li>
          <li>Você responde pelos dados dos seus clientes e pelas mensagens que envia a eles.</li>
        </ul>
      </section>
      <section>
        <h2>1. Quem somos e o que é o serviço</h2>
        <p>O {BRAND.name} é um sistema online para organizar vendas e atendimento: funil, conversas, robôs, agente de IA, tarefas, relatórios e equipe. Ao criar uma conta, você aceita estes termos. Para usar, é preciso ter 18 anos ou mais e poder representar a empresa cadastrada.</p>
        <LegalContact />
      </section>
      <section>
        <h2>2. Conta e segurança</h2>
        <p>Mantenha seus dados corretos e sua senha em sigilo. Os administradores da empresa decidem quem entra na conta e o que cada pessoa vê. Avise-nos se suspeitar de acesso indevido.</p>
      </section>
      <section>
        <h2>3. Planos, preços e pagamento</h2>
        <ul>
          <li>Os preços valem por empresa e estão na página inicial e na tela de pagamento, que mostra o total antes de você confirmar. Cada plano inclui um número de usuários; usuários a mais têm o valor indicado.</li>
          <li>O pagamento é feito pelo Mercado Pago, por Pix, cartão ou boleto. O acesso é liberado quando o pagamento é confirmado.</li>
          <li>O plano mensal cobre 1 mês. O anual cobre 12 meses pelo preço de 10, pago de uma vez.</li>
          <li>Não há renovação automática. Sem novo pagamento, o painel pausa ao fim do período. Um aumento de preço vale só para pagamentos futuros.</li>
          <li>Cobranças da Meta por mensagens de WhatsApp pela API oficial são feitas pela própria Meta, direto na conta da sua empresa.</li>
        </ul>
      </section>
      <section>
        <h2>4. Desistência e cancelamento</h2>
        <ul>
          <li><strong>Arrependimento:</strong> você pode desistir de qualquer compra em até 7 dias, contados do pagamento confirmado, e recebe de volta todo o valor pago, corrigido, pelo mesmo meio de pagamento (art. 49 do Código de Defesa do Consumidor). Basta escrever para {LEGAL.email || "o email indicado acima"}. Confirmamos o recebimento na hora e pedimos o estorno ao Mercado Pago.</li>
          <li><strong>Depois de 7 dias:</strong> basta não renovar. O acesso continua até o fim do período já pago.</li>
          <li><strong>Plano anual:</strong> se quiser sair antes do fim, devolvemos a diferença entre o valor pago e os meses já usados, calculados pelo preço mensal.</li>
          <li><strong>Falha nossa:</strong> se o serviço não funcionar como oferecido e não conseguirmos resolver, você pode pedir a correção, o abatimento ou a devolução, nos termos da lei.</li>
          <li>Respondemos a dúvidas, reclamações e pedidos de cancelamento em até 5 dias.</li>
        </ul>
      </section>
      <section>
        <h2>5. Agente de IA e créditos</h2>
        <ul>
          <li>Cada resposta do agente gasta 1 crédito, inclusive as do chat de teste. Os créditos não vencem e valem só para a empresa que comprou. O preço inclui o custo da IA e a nossa margem pelo serviço.</li>
          <li>Sem crédito, o agente passa a conversa para a sua equipe. Com a sua própria chave, a cobrança é feita pela Anthropic, e não gastamos créditos.</li>
          <li>Depois dos 7 dias de arrependimento, os créditos comprados não são devolvidos em dinheiro, salvo falha nossa.</li>
          <li>A IA pode errar. Ela responde com base no que você escreveu, e você é responsável por conferir essas informações e acompanhar o atendimento. Ela não deve fingir ser uma pessoa.</li>
        </ul>
      </section>
      <section>
        <h2>6. Canais conectados</h2>
        <ul>
          <li><strong>Meta (WhatsApp, Instagram e Messenger):</strong> ao conectar, você também segue as regras da Meta, que podem mudar ou interromper esses recursos.</li>
          <li><strong>WhatsApp por QR code:</strong> é uma conexão não oficial, parecida com o WhatsApp Web, e pode ser derrubada ou levar ao bloqueio do número pelo WhatsApp. Use por sua conta e risco, para atender quem chama, sem disparos em massa. Ao conectar, o histórico recente de conversas e os nomes dos contatos do celular podem ser importados para o painel.</li>
        </ul>
      </section>
      <section>
        <h2>7. Uso permitido</h2>
        <p>Não use o {BRAND.name} para enviar mensagens a quem não autorizou o contato, fraudar, enganar, assediar, violar direitos de terceiros, distribuir conteúdo ilegal, atacar o sistema ou burlar limites. Podemos suspender a conta em caso de violação, avisando o motivo sempre que a lei permitir.</p>
      </section>
      <section>
        <h2>8. Dados dos seus clientes</h2>
        <p>Sua empresa é a controladora dos dados de leads e contatos que coloca ou recebe no {BRAND.name}, e nós os tratamos como operadores, seguindo as suas instruções e a <Link href="/privacidade" className="underline">política de privacidade</Link>. Cabe a você ter base legal para esses dados, informar seus clientes (inclusive sobre o rastreamento de origem e o uso de IA) e atender aos pedidos deles. Ajudamos no que depender do sistema. Se houver um incidente com esses dados, avisamos você sem demora.</p>
      </section>
      <section>
        <h2>9. Disponibilidade e suporte</h2>
        <p>Trabalhamos para manter o serviço estável, mas podem ocorrer manutenções e falhas, inclusive em serviços de terceiros como Meta, WhatsApp, Anthropic e Mercado Pago. Não prometemos resultado de vendas nem funcionamento sem nenhuma interrupção.</p>
      </section>
      <section>
        <h2>10. Responsabilidade</h2>
        <p>Cada parte responde pelos danos que causar, nos limites da lei. Nada aqui retira direitos que o Código de Defesa do Consumidor garante a você. Quando o contrato for entre empresas e não houver relação de consumo, não respondemos por lucros cessantes, e a indenização fica limitada ao que foi pago nos últimos 12 meses, salvo dolo ou culpa grave.</p>
      </section>
      <section>
        <h2>11. Propriedade</h2>
        <p>Os dados são seus: você pode exportá-los e apagá-los. O sistema, a marca e o código são nossos. Você recebe o direito de usá-los enquanto a conta estiver ativa, sem poder copiar, revender ou desmontar o sistema.</p>
      </section>
      <section>
        <h2>12. Fim da conta</h2>
        <p>Você pode excluir a conta em Configurações → Plano e cobrança. Conta pausada mantém os dados guardados por até 12 meses. Depois disso, podemos apagá-los, avisando por email com 30 dias de antecedência.</p>
      </section>
      <section>
        <h2>13. Mudanças nestes termos</h2>
        <p>Se mudarmos algo importante, avisamos com pelo menos 30 dias de antecedência, por email ou no painel. Se não concordar, você pode sair antes de a mudança valer. O período já pago segue nas condições da compra.</p>
      </section>
      <section>
        <h2>14. Lei e foro</h2>
        <p>Vale a lei brasileira. Consumidores podem acionar a Justiça no próprio domicílio. Entre empresas, fica eleito o foro de {LEGAL.city || "da sede do responsável pelo serviço"}. Você também pode procurar o Procon ou o consumidor.gov.br.</p>
      </section>
    </LegalPage>
  );
}
