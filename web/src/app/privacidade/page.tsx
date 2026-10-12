import { LegalPage } from "@/components/marketing/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Privacidade" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade" updated="12 de outubro de 2026">
      <section>
        <h2>O que guardamos</h2>
        <ul>
          <li>Da sua conta: nome, email e senha (cifrada pelo provedor de login).</li>
          <li>Do seu trabalho: leads, contatos, empresas, tarefas, notas e conversas que você e sua equipe registram ou recebem pelos canais conectados.</li>
          <li>Técnico: endereço IP e registros de acesso, para segurança e para limitar tentativas de login.</li>
        </ul>
      </section>
      <section>
        <h2>Para que usamos</h2>
        <p>Só para fazer o {BRAND.name} funcionar para você: mostrar seu funil, entregar mensagens, cobrar a assinatura e manter a conta segura. Não vendemos dados e não usamos suas conversas para publicidade.</p>
      </section>
      <section>
        <h2>Com quem compartilhamos (processadores)</h2>
        <ul>
          <li>Supabase — banco de dados, login e arquivos.</li>
          <li>Vercel — hospedagem do site e do app.</li>
          <li>Stripe — pagamentos (nós não vemos os dados do seu cartão).</li>
          <li>Meta — quando você conecta WhatsApp, Instagram ou Messenger, as mensagens passam pela API oficial deles.</li>
          <li>Resend — envio de emails do sistema (convites, avisos de cobrança).</li>
        </ul>
      </section>
      <section>
        <h2>Seus direitos (LGPD)</h2>
        <p>Você pode ver, corrigir, exportar ou apagar seus dados. Para apagar a conta, use Configurações → Plano e cobrança → Excluir minha conta: o login e as empresas em que você é a única pessoa são apagados na hora.</p>
      </section>
      <section>
        <h2>Contato</h2>
        <p>Encarregado de dados (DPO): a definir antes do lançamento.</p>
      </section>
    </LegalPage>
  );
}
