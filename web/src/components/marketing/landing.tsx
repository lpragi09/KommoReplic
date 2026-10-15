import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, CheckCheck, Eye, Fingerprint, Inbox, Lightning, MessageCircle, Radio, Sparkle, Workflow } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { IslandNav } from "./island-nav";

/* Landing pública, tema escuro ("vidro etéreo" em azul e preto).
   Regras: nenhum dado inventado (sem depoimentos, números de clientes ou logos de "quem usa");
   recurso que não existe aparece em "Em construção". Animação só por CSS. */

const d = (n: number) => ({ "--d": n }) as CSSProperties;

const soon = [
  { icon: Eye, title: "O caminho de cada mensagem", text: "Recebida, gravada, entregue, lida — com hora. Se algo falhar, você vê onde e reenvia." },
  { icon: Fingerprint, title: "Cada conversa no contato certo", text: "A mensagem só entra no lead se o remetente bater, com trilha de auditoria para dados sensíveis." },
  { icon: Radio, title: "Aviso quando um canal cai", text: "Página de status pública e faixa no app com o que parou, desde quando e a previsão." },
  { icon: MessageCircle, title: "WhatsApp pela API oficial", text: "Conexão guiada que confere os pré-requisitos da Meta antes de você pagar nada." },
];

const plans = [
  { name: "Autônomo", who: "1 a 2 pessoas", m: 59, a: 49, items: ["1 funil", "Chat do site + 1 WhatsApp", "Tarefas e painel"] },
  { name: "Equipe", who: "o time de vendas", m: 99, a: 82, items: ["Funis ilimitados", "3 canais", "Papéis: todos, equipe ou só os meus", "Automações por etapa"], highlight: true },
  { name: "Operação", who: "filiais e alto volume", m: 159, a: 132, items: ["Canais ilimitados", "Relatórios e webhooks", "Histórico de auditoria", "Suporte com prazo de resposta"] },
];

const faq = [
  { q: "Tem fidelidade?", a: "Não. O plano é mensal e cancela em um clique, dentro do app. No anual (2 meses grátis), se cancelar no meio, devolvemos o proporcional." },
  { q: "Preciso de cartão para testar?", a: "Não. São 14 dias com tudo liberado, sem cartão." },
  { q: "Funciona com o meu WhatsApp?", a: "Vamos usar a API oficial da Meta, com o número da sua empresa. A conexão do WhatsApp ainda está em desenvolvimento; hoje o canal pronto é o chat do site." },
  { q: "Quanto custam as mensagens do WhatsApp?", a: "A Meta cobra as conversas iniciadas pela empresa. Repassamos a preço de custo, separado na fatura." },
  { q: "Consigo trazer meus contatos de outra ferramenta?", a: "A importação por planilha (CSV) está no plano de construção. Até lá, nossa equipe ajuda na migração." },
  { q: "Meus dados ficam onde?", a: "Num banco de dados em São Paulo, com acesso separado por empresa. Você pode exportar ou apagar tudo quando quiser." },
];

const ticker = ["Chat do site", "Funil Kanban", "Leads de entrada", "Tarefas com prazo", "Painel da equipe", "WhatsApp · em breve", "Instagram · em breve", "Messenger · em breve"];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-night-line bg-[color-mix(in_srgb,var(--on-night)_4%,transparent)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-on-night-muted">
      <span className="size-1.5 rounded-pill bg-aurora-2 shadow-[0_0_10px_var(--aurora-2)]" aria-hidden />
      {children}
    </span>
  );
}

function IslandCTA({ href, children, light }: { href: string; children: ReactNode; light?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "fx-island group inline-flex items-center gap-3 rounded-pill py-1.5 pl-6 pr-1.5 text-md font-medium",
        light ? "bg-on-night text-night" : "bg-accent text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_14px_40px_-12px_rgba(29,78,216,.8)]",
      )}
    >
      {children}
      <span className={cn("fx-island-dot grid size-9 place-items-center rounded-pill", light ? "bg-night text-on-night" : "bg-[rgba(255,255,255,.16)]")}>
        <ArrowUpRight className="size-4" weight="bold" aria-hidden />
      </span>
    </Link>
  );
}

function Section({ id, eyebrow, title, intro, children, className }: { id: string; eyebrow: string; title: ReactNode; intro?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className={cn("relative mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-24 sm:px-6 md:py-36", className)}>
      <div className="fx-reveal max-w-3xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={`${id}-t`} className="mt-5 text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-on-night">
          {title}
        </h2>
        {intro && <p className="mt-5 max-w-[56ch] text-md text-on-night-muted">{intro}</p>}
      </div>
      <div className="mt-14 md:mt-20">{children}</div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-night text-on-night [color-scheme:dark]">
      <IslandNav />

      {/* ---------- hero ---------- */}
      <header className="fx-aurora relative min-h-[100dvh] pt-32 md:pt-40">
        <span aria-hidden className="fx-backword bottom-[-3vw] left-1/2 -translate-x-1/2 lowercase opacity-70">
          {BRAND.name}
        </span>
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <div className="fx-rise">
              <Eyebrow>CRM para quem vende pelo WhatsApp</Eyebrow>
            </div>
            <h1 className="fx-slide mt-7 text-[clamp(2.75rem,7.4vw,6rem)] font-semibold leading-[0.95] tracking-[-0.045em]" style={d(1)}>
              <span className="block">Nenhum cliente</span> <span className="fx-gradient-text block">perdido no caminho.</span>
            </h1>
            <p className="fx-rise mx-auto mt-7 max-w-[54ch] text-md text-on-night-muted md:text-lg" style={d(2)}>
              Cada mensagem cai no lead certo, você vê o caminho que ela fez e sabe na hora quando um canal para. Funil, conversa e tarefas no mesmo lugar.
            </p>
            <div className="fx-rise mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={d(3)}>
              <IslandCTA href="/signup">Testar 14 dias grátis</IslandCTA>
              <a href="#como" className="rounded-pill px-5 py-3 text-base text-on-night-muted transition-colors duration-fast ease-out hover:text-on-night">
                Ver como funciona
              </a>
            </div>
            <p className="fx-rise mt-5 text-sm text-on-night-muted" style={d(4)}>
              Sem cartão · mensal · cancela em 1 clique
            </p>
          </div>

          {/* tela real do produto, em moldura dupla e perspectiva */}
          <div className="fx-slide relative mx-auto mt-16 max-w-5xl md:mt-20" style={d(3)}>
            <div className="fx-orb -inset-x-10 -bottom-10 top-10 opacity-70" aria-hidden />
            <div className="fx-tilt relative">
              <div className="fx-bezel">
                <div className="fx-core overflow-hidden">
                  <Image src="/produto-funil.png" alt="Funil de vendas do Recadi: coluna de leads de entrada e etapas com cards de negócios" width={1440} height={560} priority sizes="(min-width: 1024px) 1000px, 100vw" />
                </div>
              </div>
            </div>
            {/* chips de estado: mostram o que a tela faz, não números inventados */}
            <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
              <div className="absolute border border-night-line bg-[color-mix(in_srgb,var(--night-raised)_94%,transparent)] -left-10 top-[22%] flex items-center gap-2 rounded-pill px-4 py-2 text-sm text-on-night shadow-[0_10px_30px_-10px_rgba(0,0,0,.6)]">
                <Inbox className="size-4 text-aurora-2" /> Contato novo na entrada
              </div>
              <div className="absolute border border-night-line bg-[color-mix(in_srgb,var(--night-raised)_94%,transparent)] -right-8 top-[48%] flex items-center gap-2 rounded-pill px-4 py-2 text-sm text-on-night shadow-[0_10px_30px_-10px_rgba(0,0,0,.6)]">
                <CheckCheck className="size-4 text-aurora-2" /> Mensagem entregue · 14:02
              </div>
              <div className="absolute border border-night-line bg-[color-mix(in_srgb,var(--night-raised)_94%,transparent)] bottom-[12%] left-[8%] flex items-center gap-2 rounded-pill px-4 py-2 text-sm text-on-night shadow-[0_10px_30px_-10px_rgba(0,0,0,.6)]">
                <Lightning className="size-4 text-aurora-2" weight="fill" /> Aceito em 1 clique
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="conteudo" className="relative z-10">
        {/* ---------- faixa do que existe ---------- */}
        <div className="overflow-hidden border-y border-night-line py-5" aria-label="O que o Recadi faz">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-3 px-4">
            {ticker.map((t, i) => (
              <span key={i} className="flex items-center gap-10 whitespace-nowrap text-sm uppercase tracking-[0.18em] text-on-night-muted">
                {t}
                <Sparkle className="size-3 text-aurora-2" weight="fill" aria-hidden />
              </span>
            ))}
          </div>
        </div>

        {/* ---------- problema: divisão editorial ---------- */}
        <section aria-labelledby="problema-t" className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 md:grid-cols-2 md:py-36">
          <div className="fx-reveal">
            <Eyebrow>O problema</Eyebrow>
            <h2 id="problema-t" className="mt-5 text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
              Quando o CRM falha, <span className="text-on-night-muted">quem paga é a venda.</span>
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            {[
              { t: "Sistema fora do ar, ninguém avisa", x: "Um dia sem conseguir responder, com anúncio rodando, é dinheiro jogado fora. E você só descobre quando o cliente reclama." },
              { t: "A mensagem chega horas depois — ou no lead errado", x: "Conversas atrasadas, sumidas ou misturadas entre clientes. Para quem atende saúde ou jurídico, vira problema de LGPD." },
            ].map((p, i) => (
              <div key={p.t} className={cn("fx-reveal fx-bezel", i === 1 && "md:ml-12")}>
                <div className="fx-core p-7">
                  <h3 className="text-lg text-on-night">{p.t}</h3>
                  <p className="mt-2 text-base text-on-night-muted">{p.x}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- como funciona: cascata em profundidade ---------- */}
        <Section id="como" eyebrow="Como funciona" title={<>Da primeira mensagem ao negócio fechado.</>} intro="Três passos, sem trocar de tela.">
          <ol className="grid gap-6 md:grid-cols-3 md:gap-0">
            {[
              { n: "01", t: "O cliente escreve", x: "Pelo chat do seu site (e em breve WhatsApp e Instagram). Alguém novo aparece na coluna de entrada.", r: "md:-rotate-2 md:translate-y-6" },
              { n: "02", t: "Você aceita e responde", x: "Um clique e o cartão do lead abre com a conversa, o histórico e o campo de resposta.", r: "md:rotate-1 md:-mx-4 md:z-10" },
              { n: "03", t: "Arrasta até o Ganho", x: "Etapas com valor somado, tarefas com prazo e o motivo quando um negócio é perdido.", r: "md:rotate-3 md:translate-y-10" },
            ].map((s) => (
              <li key={s.n} className={cn("fx-reveal fx-bezel relative transition-transform duration-slow ease-out hover:rotate-0", s.r)}>
                <div className="fx-core flex h-full flex-col p-8">
                  <span className="font-mono text-sm text-aurora-2">{s.n}</span>
                  <h3 className="mt-10 text-xl tracking-tight text-on-night">{s.t}</h3>
                  <p className="mt-3 text-base text-on-night-muted">{s.x}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* ---------- recursos: bento assimétrico ---------- */}
        <Section id="recursos" eyebrow="Recursos" title={<>Feito para não deixar <span className="fx-gradient-text">mensagem para trás.</span></>}>
          <div className="grid gap-5 md:grid-cols-12">
            <article className="fx-reveal fx-bezel md:col-span-8">
              <div className="fx-core h-full overflow-hidden p-8">
                <Inbox className="size-7 text-aurora-2" weight="light" aria-hidden />
                <h3 className="mt-6 text-xl tracking-tight text-on-night">Desconhecido vira lead em 1 clique</h3>
                <p className="mt-2 max-w-[52ch] text-base text-on-night-muted">Quem escreve pela primeira vez cai numa coluna de entrada. Aceite e o cartão do lead já abre com a conversa e o campo de resposta.</p>
                <div className="mt-8 overflow-hidden rounded-lg shadow-[0_0_0_1px_var(--night-line),0_30px_60px_-30px_rgba(0,0,0,.8)]">
                  <Image src="/produto-lead.png" alt="Cartão do lead com a conversa do cliente, tarefa e histórico" width={1440} height={900} sizes="(min-width: 1024px) 700px, 100vw" />
                </div>
              </div>
            </article>
            <article className="fx-reveal fx-bezel md:col-span-4">
              <div className="fx-core flex h-full flex-col p-8">
                <Workflow className="size-7 text-aurora-2" weight="light" aria-hidden />
                <h3 className="mt-6 text-xl tracking-tight text-on-night">Funil que você arrasta</h3>
                <p className="mt-2 text-base text-on-night-muted">Etapas com valor somado, Ganho e Perdido com motivo. Mouse, toque ou teclado.</p>
                {/* mini-quadro ilustrativo, feito em CSS */}
                <div className="mt-auto grid grid-cols-3 gap-2 pt-10" aria-hidden>
                  {[3, 2, 1].map((n, c) => (
                    <div key={c} className="flex flex-col gap-2 rounded-md bg-[color-mix(in_srgb,var(--on-night)_4%,transparent)] p-2">
                      <span className={cn("h-1 rounded-pill", ["bg-stage-3", "bg-stage-5", "bg-stage-won"][c])} />
                      {Array.from({ length: n }).map((_, k) => (
                        <span key={k} className="h-8 rounded-sm bg-[color-mix(in_srgb,var(--on-night)_9%,transparent)]" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </article>
            <div className="fx-reveal md:col-span-12">
              <p className="mb-4 mt-6 flex items-center gap-2 text-sm text-on-night-muted">
                <span className="rounded-xs border border-night-line px-2 py-0.5 text-xs uppercase tracking-[0.16em]">Em construção</span>
                na ordem em que vamos entregar
              </p>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {soon.map((f) => (
                  <li key={f.title} className="rounded-xl border border-dashed border-night-line p-6">
                    <f.icon className="size-6 text-on-night-muted" weight="light" aria-hidden />
                    <h3 className="mt-4 text-base font-semibold text-on-night">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-on-night-muted">{f.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ---------- preços ---------- */}
        <Section id="precos" eyebrow="Preços" title={<>Mensal, sem fidelidade. <span className="text-on-night-muted">Cancela em um clique.</span></>}>
          <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
            {plans.map((p) => (
              <div key={p.name} className={cn("fx-reveal fx-bezel", p.highlight && "is-hot lg:-translate-y-4")}>
                <div className="fx-core flex h-full flex-col p-8">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg text-on-night">{p.name}</h3>
                    {p.highlight && <span className="rounded-xs bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">Mais escolhido</span>}
                  </div>
                  <p className="text-sm text-on-night-muted">Para {p.who}</p>
                  <p className="mt-8 flex items-baseline gap-1">
                    <span className="text-[3rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-on-night">R$ {p.m}</span>
                    <span className="text-sm text-on-night-muted">/usuário/mês</span>
                  </p>
                  <p className="mt-2 text-sm text-on-night-muted">ou R$ {p.a}/mês no anual (2 meses grátis)</p>
                  <ul className="mt-8 flex flex-1 flex-col gap-3 border-t border-night-line pt-6">
                    {p.items.map((i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-on-night">
                        <Check className="mt-0.5 size-4 shrink-0 text-aurora-2" aria-hidden /> {i}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <IslandCTA href="/signup" light={!p.highlight}>
                      Começar teste grátis
                    </IslandCTA>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-on-night-muted">Mensagens do WhatsApp iniciadas pela empresa são cobradas pela Meta; repassamos a preço de custo, separado na fatura.</p>
        </Section>

        {/* ---------- perguntas ---------- */}
        <Section id="faq" eyebrow="Perguntas" title="O que perguntam antes de assinar.">
          <dl className="grid gap-x-16 gap-y-12 md:grid-cols-2">
            {faq.map((f) => (
              <div key={f.q} className="fx-reveal border-t border-night-line pt-6">
                <dt className="text-md font-medium text-on-night">{f.q}</dt>
                <dd className="mt-2 max-w-[60ch] text-base text-on-night-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* ---------- chamada final ---------- */}
        <section aria-labelledby="cta-t" className="relative overflow-hidden px-4 pb-32 pt-12 sm:px-6">
          <div className="fx-orb left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 opacity-60" aria-hidden />
          <div className="fx-reveal relative z-10 mx-auto max-w-4xl text-center">
            <h2 id="cta-t" className="text-[clamp(2.5rem,6.5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
              <span className="block">Comece hoje.</span> <span className="fx-gradient-text block">Se não servir, cancela.</span>
            </h2>
            <div className="mt-10 flex justify-center">
              <IslandCTA href="/signup">Testar 14 dias grátis</IslandCTA>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-night-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-10 text-sm text-on-night-muted sm:px-6">
          <span className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-xs bg-accent text-xs font-bold text-on-accent" aria-hidden>
              {BRAND.initial}
            </span>
            © {BRAND.name} · {BRAND.tagline}
          </span>
          <nav aria-label="Legal" className="ml-auto flex gap-5">
            <Link href="/termos" className="hover:text-on-night">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-on-night">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
