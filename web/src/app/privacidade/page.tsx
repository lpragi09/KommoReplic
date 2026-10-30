import { LegalContact, LegalPage } from "@/components/marketing/legal";
import { BRAND } from "@/lib/brand";
import { LEGAL, LEGAL_UPDATED } from "@/lib/legal";

export const metadata = { title: "Privacidade" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade" updated={LEGAL_UPDATED}>
      <section>
        <h2>Quem cuida dos seus dados</h2>
        <p>Esta política segue a Lei Geral de Proteção de Dados (LGPD) e o Marco Civil da Internet. Nosso papel muda conforme o dado:</p>
        <ul>
          <li><strong>Controladores:</strong> somos nós, para os dados de quem cria conta e paga pelo {BRAND.name}.</li>
          <li><strong>Operadores:</strong> somos nós, para os dados de leads e clientes das empresas que usam o sistema. Nesse caso, quem decide o uso é a empresa com quem a pessoa falou. Procure essa empresa primeiro. Se o pedido chegar a nós, encaminhamos a ela.</li>
        </ul>
        <LegalContact />
        <p>Canal do encarregado de dados: {LEGAL.email || "em preenchimento"}.</p>
      </section>
      <section>
        <h2>Dados que tratamos, para quê e com qual base legal</h2>
        <ul>
          <li><strong>Conta:</strong> nome, email, senha (guardada cifrada pelo provedor de login), empresa e equipe. Para criar e proteger o acesso. Base: execução do contrato.</li>
          <li><strong>Cobrança:</strong> CPF ou CNPJ, nome, email, telefone, endereço e histórico de pagamentos. Para cobrar e cumprir deveres fiscais. Base: execução do contrato e obrigação legal. O número do cartão é digitado no formulário do Mercado Pago e não passa pelo nosso servidor.</li>
          <li><strong>Uso e segurança:</strong> endereço IP, data e hora de acesso e dados técnicos do navegador. Para evitar fraude, limitar tentativas e corrigir erros. Base: obrigação legal e legítimo interesse.</li>
          <li><strong>Dados inseridos pelas empresas (como operadores):</strong> contatos, mensagens, arquivos, notas, fotos e nomes de perfil, e a origem do contato (como campanha e página de entrada). A base legal é definida pela empresa responsável.</li>
          <li><strong>WhatsApp por QR code (como operadores):</strong> quando a empresa conecta o próprio número, importamos mensagens recentes, nomes da agenda e do perfil e fotos dos contatos, para mostrar as conversas no painel. A sessão fica guardada no servidor enquanto o canal estiver conectado.</li>
        </ul>
      </section>
      <section>
        <h2>Agente de IA</h2>
        <p>Se a empresa ligar o agente, as mensagens da conversa e a base de conhecimento dela são enviadas à Anthropic para gerar cada resposta. O agente se apresenta como assistente virtual se perguntarem e chama a equipe quando precisa. Ele responde mensagens e não toma decisões que afetem direitos da pessoa. Se quiser, peça para falar com alguém da equipe. Não usamos as conversas para publicidade.</p>
      </section>
      <section>
        <h2>Com quem compartilhamos</h2>
        <p>Não vendemos dados. Compartilhamos só com quem é necessário para o serviço:</p>
        <ul>
          <li>Supabase: banco de dados, login e arquivos.</li>
          <li>Vercel: hospedagem do site e do aplicativo.</li>
          <li>Oracle: servidor da conexão do WhatsApp por QR code.</li>
          <li>Mercado Pago: pagamentos.</li>
          <li>Anthropic: respostas do agente de IA, se a empresa o ligar.</li>
          <li>Meta e WhatsApp: mensagens dos canais conectados.</li>
          <li>Resend: emails do sistema, como convites e avisos.</li>
          <li>Autoridades: quando a lei ou uma ordem judicial exigir.</li>
        </ul>
      </section>
      <section>
        <h2>Transferência para outros países</h2>
        <p>Alguns desses fornecedores processam dados fora do Brasil, principalmente nos Estados Unidos, como Vercel, Anthropic, Meta e Resend. Isso acontece para prestar o serviço que você contratou (art. 33 da LGPD) e dentro dos compromissos de proteção assumidos por eles.</p>
      </section>
      <section>
        <h2>Por quanto tempo guardamos</h2>
        <ul>
          <li>Conta e dados de trabalho: enquanto a conta existir. Conta pausada: até 12 meses, com aviso 30 dias antes de apagar.</li>
          <li>Ao excluir a conta: login, empresas em que você é a única pessoa, com leads, conversas e arquivos, são apagados na hora. Se houver outras pessoas na empresa, os dados dela continuam com elas.</li>
          <li>Pagamentos: comprovantes podem ser mantidos pelo prazo exigido pela lei fiscal, inclusive pelo Mercado Pago.</li>
          <li>Registros de acesso: pelo prazo da lei ou de uma ordem de autoridade.</li>
          <li>Cópias de segurança são substituídas em ciclos e deixam de conter os dados apagados.</li>
        </ul>
      </section>
      <section>
        <h2>Cookies e armazenamento no navegador</h2>
        <p>Usamos só o necessário para o sistema funcionar: login, tema e, no chat do site, um identificador para continuar a conversa. O script de origem que uma empresa instala no próprio site guarda a campanha de onde o visitante veio, e essa empresa é quem deve informar isso aos visitantes dela. Não usamos cookies de publicidade no {BRAND.name}.</p>
      </section>
      <section>
        <h2>Segurança</h2>
        <p>Usamos conexão cifrada, separação de acesso por empresa, chaves e tokens guardados com criptografia e limite de tentativas. Nenhum sistema é 100% imune. Se um incidente puder causar risco ou dano relevante, avisamos as pessoas afetadas e a Autoridade Nacional de Proteção de Dados, como manda o art. 48 da LGPD.</p>
      </section>
      <section>
        <h2>Seus direitos</h2>
        <p>A qualquer momento e sem custo, você pode pedir (art. 18 da LGPD):</p>
        <ul>
          <li>confirmação de que tratamos seus dados, e acesso a eles;</li>
          <li>correção de dados incompletos ou errados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>portabilidade para outro fornecedor;</li>
          <li>informação sobre com quem compartilhamos;</li>
          <li>eliminação de dados tratados com consentimento, e revogação desse consentimento;</li>
          <li>oposição a um tratamento que descumpra a lei.</li>
        </ul>
        <p>Muita coisa você faz sozinho no painel: corrigir, exportar contatos e leads em planilha e excluir a conta. Para o resto, escreva para {LEGAL.email || "o email indicado acima"}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados ou a um órgão de defesa do consumidor.</p>
      </section>
      <section>
        <h2>Menores de idade</h2>
        <p>O {BRAND.name} é para maiores de 18 anos. As empresas que atendem crianças ou adolescentes devem seguir as regras próprias da LGPD para esses dados.</p>
      </section>
      <section>
        <h2>Mudanças</h2>
        <p>Se esta política mudar de forma importante, avisamos por email ou no painel, e a data no topo será atualizada.</p>
      </section>
    </LegalPage>
  );
}
