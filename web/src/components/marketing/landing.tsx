import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Eye, Fingerprint, Inbox, MessageCircle, Radio, Workflow } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

/* Landing pública. Só HTML e CSS: nenhum JavaScript de cliente além do Next.
   Regra: nada de prova falsa. Sem depoimentos, números de clientes ou logos de "quem confia".
   Recurso que ainda não existe aparece como "em breve". */

const d = (n: number) => ({ "--d": n }) as CSSProperties;

const features: { icon: typeof Eye; title: string; text: string; status: "pronto" | "em breve" }[] = [
  { icon: Inbox, title: "Desconhecido vira lead em 1 clique", text: "Quem escreve pela primeira vez cai numa coluna de entrada. Aceite e o cartão do lead já abre com a conversa e o campo de resposta.", status: "pronto" },
  { icon: Workflow, title: "Funil que você arrasta", text: "Etapas com valor somado, Ganho e Perdido com motivo, tarefas com prazo. Funciona no mouse, no toque e no teclado.", status: "pronto" },
  { icon: Eye, title: "O caminho de cada mensagem", text: "Recebida, gravada, entregue, lida — com hora. Se algo falhar, você vê onde e pode reenviar.", status: "em breve" },
  { icon: Fingerprint, title: "Cada conversa no contato certo", text: "A mensagem só entra no lead se o remetente bater, com trilha de auditoria. Pensado para quem atende dados sensíveis.", status: "em breve" },
  { icon: Radio, title: "Aviso na hora quando um canal cai", text: "Página de status pública e faixa dentro do app com o que parou, desde quando e a previsão.", status: "em breve" },
  { icon: MessageCircle, title: "WhatsApp pela API oficial", text: "Conexão guiada que confere os pré-requisitos da Meta antes de você pagar nada.", status: "em breve" },
];

const plans = [
  { name: "Autônomo", who: "1 a 2 pessoas", m: 59, a: 49, items: ["1 funil", "Chat do site + 1 WhatsApp", "Tarefas e painel"] },
  { name: "Equipe", who: "o time de vendas", m: 99, a: 82, items: ["Funis ilimitados", "3 canais", "Papéis: todos, equipe ou só os meus", "Automações por etapa"], highlight: true },
  { name: "Operação", who: "filiais e alto volume", m: 159, a: 132, items: ["Canais ilimitados", "Relatórios e webhooks", "Histórico de auditoria", "Suporte com prazo de resposta"] },
];

const faq = [
  { q: "Tem fidelidade?", a: "Não. O plano é mensal e cancela em um clique, dentro do app. Se preferir o anual (2 meses grátis) e cancelar no meio, devolvemos o proporcional." },
  { q: "Preciso de cartão para testar?", a: "Não. São 14 dias com tudo liberado, sem cartão." },
  { q: "Funciona com o meu WhatsApp?", a: "Vamos usar a API oficial da Meta, com o número da sua empresa. A conexão do WhatsApp ainda está em desenvolvimento; hoje o canal pronto é o chat do site." },
  { q: "Quanto custam as mensagens do WhatsApp?", a: "A Meta cobra as conversas iniciadas pela empresa. Repassamos a preço de custo, separado na fatura." },
  { q: "Consigo trazer meus contatos de outra ferramenta?", a: "A importação por planilha (CSV) está no plano de construção. Até lá, nossa equipe ajuda na migração." },
];

function Section({ id, eyebrow, title, children, className }: { id: string; eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className={cn("mx-auto w-full max-w-6xl px-4 py-20 sm:px-6", className)}>
      <p className="flex items-center gap-2 text-sm font-medium text-accent-text">
        <span className="h-px w-6 bg-accent" aria-hidden />
        {eyebrow}
      </p>
      <h2 id={`${id}-t`} className="mt-3 max-w-2xl text-xl tracking-tight text-fg sm:text-display">
        {title}
      </h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg">
      {/* ---------- hero ---------- */}
      <header className="fx-aurora">
        <span aria-hidden className="fx-backword -bottom-6 right-[-4vw] lowercase">
          {BRAND.name}
        </span>
        <nav aria-label="Principal" className="relative z-10 mx-auto flex max-w-6xl items-center gap-6 px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-md font-semibold text-on-night">
            <span className="fx-glow grid size-8 place-items-center rounded-sm bg-accent text-sm font-bold text-on-accent" aria-hidden>
              {BRAND.initial}
            </span>
            {BRAND.name}
          </Link>
          <div className="ml-auto hidden items-center gap-6 text-sm text-on-night-muted sm:flex">
            <a href="#como" className="hover:text-on-night">Como funciona</a>
            <a href="#recursos" className="hover:text-on-night">Recursos</a>
            <a href="#precos" className="hover:text-on-night">Preços</a>
          </div>
          <Link href="/login" className="ml-auto text-sm font-medium text-on-night hover:underline sm:ml-0">
            Entrar
          </Link>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28 lg:pt-16">
          <div>
            <p className="fx-rise text-sm font-medium text-on-night-muted">CRM para quem vende pelo WhatsApp</p>
            <h1 className="fx-rise fx-gradient-text mt-3 text-display sm:text-hero" style={d(1)}>
              Nenhum cliente perdido no caminho.
            </h1>
            <p className="fx-rise mt-5 max-w-lg text-md text-on-night-muted" style={d(2)}>
              Cada mensagem cai no lead certo, você vê o caminho que ela fez e sabe na hora quando um canal para. Funil, conversa e tarefas no mesmo lugar.
            </p>
            <div className="fx-rise mt-8 flex flex-wrap items-center gap-3" style={d(3)}>
              <Link href="/signup" className="fx-shine fx-glow inline-flex h-12 items-center gap-2 rounded-sm bg-accent px-6 text-md font-medium text-on-accent hover:bg-accent-hover">
                Testar 14 dias grátis <ArrowRight className="size-4" aria-hidden />
              </Link>
              <span className="text-sm text-on-night-muted">Sem cartão · mensal · cancela em 1 clique</span>
            </div>
          </div>
          <div className="fx-rise fx-glow overflow-hidden rounded-lg border border-night-line" style={d(4)}>
            <Image src="/produto-funil.png" alt="Tela do funil de vendas do Recadi com colunas de etapas e cards de leads" width={1440} height={900} priority sizes="(min-width: 1024px) 560px, 100vw" />
          </div>
        </div>
      </header>

      <main id="conteudo">
        {/* ---------- problema ---------- */}
        <Section id="problema" eyebrow="O problema" title="Quando o CRM falha, quem paga é a venda.">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { t: "Sistema fora do ar, ninguém avisa", x: "Um dia sem conseguir responder com anúncio rodando é dinheiro jogado fora. E você só descobre quando o cliente reclama." },
              { t: "A mensagem chega horas depois — ou no lead errado", x: "Conversas atrasadas, sumidas ou misturadas entre clientes. Para quem atende saúde ou jurídico, isso vira problema de LGPD." },
            ].map((p, i) => (
              <div key={p.t} className="fx-rise rounded-lg border border-border bg-surface p-6" style={d(i)}>
                <h3 className="text-lg text-fg">{p.t}</h3>
                <p className="mt-2 text-base text-muted">{p.x}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- como funciona ---------- */}
        <div className="bg-surface">
          <Section id="como" eyebrow="Como funciona" title="Da primeira mensagem ao negócio fechado, em três passos.">
            <ol className="relative grid gap-10 md:grid-cols-[repeat(3,minmax(0,1fr))] md:gap-6">
              <span aria-hidden className="absolute left-[19px] top-10 h-[calc(100%-5rem)] w-px bg-border md:left-0 md:top-[19px] md:h-px md:w-full" />
              {[
                { n: "01", t: "O cliente escreve", x: "Pelo chat do seu site (e em breve WhatsApp e Instagram). Se for alguém novo, aparece na coluna de entrada." },
                { n: "02", t: "Você aceita e responde", x: "Um clique e o cartão do lead abre com a conversa, o histórico e o campo de resposta." },
                { n: "03", t: "Arrasta até o Ganho", x: "Etapas com valor somado, tarefas com prazo e o motivo quando um negócio é perdido." },
              ].map((s, i) => (
                <li key={s.n} className={cn("relative flex gap-5 md:block", i === 1 && "md:mt-10", i === 2 && "md:mt-20")}>
                  <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-sm bg-inverse-bg font-mono text-sm font-semibold text-on-inverse" aria-hidden>
                    {s.n}
                  </span>
                  <div className="md:mt-6 md:pr-6">
                    <h3 className="text-lg text-fg">{s.t}</h3>
                    <p className="mt-2 max-w-[38ch] text-base text-muted">{s.x}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        {/* ---------- recursos ---------- */}
        <Section id="recursos" eyebrow="Recursos" title="Feito para não deixar mensagem para trás.">
          <div className="grid gap-4 lg:grid-cols-6">
            {features
              .filter((f) => f.status === "pronto")
              .map((f, i) => (
                <article key={f.title} className={cn("fx-lift relative overflow-hidden rounded-lg bg-surface p-8", i === 0 ? "lg:col-span-4" : "lg:col-span-2")}>
                  <f.icon className="size-7 text-accent" aria-hidden />
                  <h3 className="mt-6 text-lg text-fg">{f.title}</h3>
                  <p className="mt-2 max-w-[52ch] text-base text-muted">{f.text}</p>
                  {i === 0 && (
                    <div className="mt-8 overflow-hidden rounded-md border border-border shadow-pop">
                      <Image src="/produto-lead.png" alt="Cartão do lead com a conversa do cliente, tarefas e histórico" width={1440} height={900} sizes="(min-width: 1024px) 640px, 100vw" />
                    </div>
                  )}
                </article>
              ))}
            <div className="rounded-lg border border-dashed border-border-input p-6 lg:col-span-6">
              <p className="text-sm font-medium text-fg">
                Em construção <span className="font-normal text-muted">— o que vem a seguir, na ordem em que vamos entregar</span>
              </p>
              <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {features
                  .filter((f) => f.status !== "pronto")
                  .map((f) => (
                    <li key={f.title}>
                      <f.icon className="size-5 text-muted" aria-hidden />
                      <h3 className="mt-3 text-base font-semibold text-fg">{f.title}</h3>
                      <p className="mt-1 text-sm text-muted">{f.text}</p>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ---------- preços ---------- */}
        <div className="bg-surface">
          <Section id="precos" eyebrow="Preços" title="Mensal, sem fidelidade. Cancela em um clique.">
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((p) => (
                <div key={p.name} className={cn("flex flex-col rounded-lg border bg-bg p-6", p.highlight ? "fx-glow border-accent" : "border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg text-fg">{p.name}</h3>
                    {p.highlight && <span className="rounded-xs bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">Mais escolhido</span>}
                  </div>
                  <p className="text-sm text-muted">Para {p.who}</p>
                  <p className="mt-4">
                    <span className="text-display tabular-nums tracking-tight text-fg">R$ {p.m}</span>
                    <span className="text-sm text-muted"> por usuário/mês</span>
                  </p>
                  <p className="text-sm text-muted">ou R$ {p.a}/mês no anual (2 meses grátis)</p>
                  <ul className="mt-6 flex flex-1 flex-col gap-2">
                    {p.items.map((i) => (
                      <li key={i} className="flex gap-2 text-sm text-fg">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {i}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className={cn("mt-6 inline-flex h-10 items-center justify-center rounded-sm text-base font-medium", p.highlight ? "fx-shine bg-accent text-on-accent hover:bg-accent-hover" : "border border-border text-fg hover:border-border-input")}>
                    Começar teste grátis
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">Mensagens do WhatsApp iniciadas pela empresa são cobradas pela Meta; repassamos a preço de custo, separado na fatura.</p>
          </Section>
        </div>

        {/* ---------- perguntas ---------- */}
        <Section id="faq" eyebrow="Perguntas" title="O que perguntam antes de assinar.">
          <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {faq.map((f) => (
              <div key={f.q} className="border-t border-border pt-5">
                <dt className="text-md font-medium text-fg">{f.q}</dt>
                <dd className="mt-2 max-w-[60ch] text-base text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* ---------- chamada final ---------- */}
        <section aria-labelledby="cta-t" className="fx-aurora">
          <div className="relative z-10 mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
            <h2 id="cta-t" className="fx-gradient-text text-xl sm:text-display">
              Comece hoje. Se não servir, cancela em um clique.
            </h2>
            <Link href="/signup" className="fx-shine fx-glow mt-8 inline-flex h-12 items-center gap-2 rounded-sm bg-accent px-6 text-md font-medium text-on-accent hover:bg-accent-hover">
              Testar 14 dias grátis <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <span>
            © {BRAND.name} · {BRAND.tagline}
          </span>
          <nav aria-label="Legal" className="ml-auto flex gap-4">
            <Link href="/termos" className="hover:text-fg hover:underline">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-fg hover:underline">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
