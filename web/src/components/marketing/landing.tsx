import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Bot, ChartColumn, Check, Inbox, Lightning, MessageCircle, Sparkle, Trophy } from "@/components/ui/icons";
import { ArtAccept, ArtChart, ArtChat, ArtWin } from "./art";
import { BRAND } from "@/lib/brand";
import { NetzerMark } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import { IslandNav } from "./island-nav";

/* Landing pública, tema escuro. Enxuta de propósito: o que o cliente precisa para decidir
   (o que é, como funciona, 3 motivos, preço, dúvidas) e nada mais.
   Regras: nenhum dado inventado (sem depoimentos, números de clientes ou logos de "quem usa"). Animação só por CSS. */

const d = (n: number) => ({ "--d": n }) as CSSProperties;

const plans = [
  { name: "Autônomo", who: "1 a 2 pessoas", m: 59, a: 49, items: ["1 funil, até 2 pessoas", "Chat do site + 1 rede social", "3 robôs ligados", "IA com créditos avulsos"] },
  {
    name: "Equipe",
    who: "o time de vendas",
    m: 99,
    a: 82,
    items: ["Funis e pessoas ilimitados", "Chat do site + 3 redes sociais", "Agente de IA: 500 respostas/mês", "Robôs, disparos e estatísticas", "Papéis: todos, equipe ou só os meus"],
    highlight: true,
  },
  { name: "Operação", who: "filiais e alto volume", m: 159, a: 132, items: ["Tudo do Equipe", "Redes sociais ilimitadas", "Agente de IA: 2.000 respostas/mês", "Suporte com prazo de resposta"] },
];

const faq = [
  { q: "Preciso de cartão para testar?", a: "Não. São 14 dias com tudo liberado, sem cartão. No fim, você escolhe um plano ou o painel pausa; nada é apagado." },
  { q: "Tem fidelidade?", a: "Não. O plano é mensal e cancela em um clique, dentro do app. No anual (2 meses grátis), se cancelar no meio, devolvemos o proporcional." },
  { q: "Funciona com o meu WhatsApp?", a: "Sim, pela API oficial da Meta, com o número da sua empresa. Instagram Direct e Messenger entram do mesmo jeito, e o chat do site já vem pronto." },
  { q: "A IA responde meus clientes sozinha?", a: "Se você quiser. Ela responde com o que você ensinar (preços, horários, serviços) e passa para a equipe quando precisa. Cada plano inclui respostas por mês; dá para comprar mais ou usar a sua própria chave da Anthropic." },
  { q: "Consigo trazer meus contatos de outra ferramenta?", a: "Sim. Envie uma planilha CSV com nome, telefone e email em Contatos → Importar. Exportar é do mesmo jeito." },
  { q: "Meus dados ficam onde?", a: "Num banco de dados em São Paulo, com acesso separado por empresa. Você exporta tudo em planilha e apaga a conta quando quiser." },
];

const extras = ["Chat da equipe", "Disparos em massa", "Respostas prontas", "Campos personalizados", "Permissões por papel", "Links rastreáveis (UTM)", "Importar e exportar CSV", "Metas e ROI", "Modo escuro"];

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
        light ? "bg-on-night text-night" : "bg-accent text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_14px_40px_-12px_rgba(31,122,85,.8)]",
      )}
    >
      {children}
      <span className={cn("fx-island-dot grid size-9 place-items-center rounded-pill", light ? "bg-night text-on-night" : "bg-[rgba(255,255,255,.16)]")}>
        <ArrowUpRight className="size-4" weight="bold" aria-hidden />
      </span>
    </Link>
  );
}

function SectionHead({ id, eyebrow, title, intro, center }: { id: string; eyebrow: string; title: ReactNode; intro?: string; center?: boolean }) {
  return (
    <div className={cn("fx-reveal max-w-3xl", center && "mx-auto text-center")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={`${id}-t`} className="mt-5 text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-on-night">
        {title}
      </h2>
      {intro && <p className={cn("mt-5 max-w-[54ch] text-md text-on-night-muted", center && "mx-auto")}>{intro}</p>}
    </div>
  );
}

/** um motivo para assinar: texto de um lado, prova visual do outro (alterna o lado) */
function Feature({ icon: Icon, title, text, points, art, flip }: { icon: typeof Inbox; title: string; text: string; points: string[]; art: ReactNode; flip?: boolean }) {
  return (
    <article className="fx-reveal grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={cn(flip && "md:order-2")}>
        <span className="fx-tile size-11" aria-hidden>
          <Icon className="size-5" weight="fill" />
        </span>
        <h3 className="mt-6 text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.02em] text-on-night">{title}</h3>
        <p className="mt-3 max-w-[48ch] text-md text-on-night-muted">{text}</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-base text-on-night">
              <Check className="mt-1 size-4 shrink-0 text-aurora-2" aria-hidden /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(flip && "md:order-1")} aria-hidden>
        {art}
      </div>
    </article>
  );
}

export function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-night text-on-night [color-scheme:dark]">
      <IslandNav />

      {/* ---------- hero ---------- */}
      <header className="fx-aurora relative pb-24 pt-32 md:pb-32 md:pt-40">
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="fx-rise">
              <Eyebrow>CRM para quem vende pelo WhatsApp</Eyebrow>
            </div>
            <h1 className="fx-slide mt-7 text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]" style={d(1)}>
              <span className="block">Nenhum cliente</span> <span className="fx-gradient-text block">perdido no caminho.</span>
            </h1>
            <p className="fx-rise mx-auto mt-7 max-w-[52ch] text-md text-on-night-muted md:text-lg" style={d(2)}>
              WhatsApp, Instagram, Messenger e o chat do seu site caem num funil só. Robôs e IA respondem na hora; você entra para fechar a venda.
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

          {/* tela real do produto */}
          <div className="fx-slide relative mx-auto mt-16 max-w-5xl md:mt-20" style={d(3)}>
            <div className="fx-orb -inset-x-10 -bottom-10 top-10" aria-hidden />
            <div className="fx-tilt relative">
              <div className="fx-bezel">
                <div className="fx-core overflow-hidden">
                  <Image
                    src="/produto-funil.png"
                    alt={`Funil de vendas do ${BRAND.name}: coluna de leads de entrada e etapas com cards de negócios`}
                    width={1440}
                    height={560}
                    priority
                    sizes="(min-width: 1024px) 1000px, 100vw"
                  />
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
              <div className="absolute -left-8 top-[24%] flex items-center gap-2 rounded-pill border border-night-line bg-[color-mix(in_srgb,var(--night-raised)_94%,transparent)] px-4 py-2 text-sm text-on-night shadow-[0_10px_30px_-10px_rgba(0,0,0,.6)]">
                <Inbox className="size-4 text-aurora-2" /> Contato novo na entrada
              </div>
              <div className="absolute -right-8 bottom-[18%] flex items-center gap-2 rounded-pill border border-night-line bg-[color-mix(in_srgb,var(--night-raised)_94%,transparent)] px-4 py-2 text-sm text-on-night shadow-[0_10px_30px_-10px_rgba(0,0,0,.6)]">
                <Sparkle className="size-4 text-aurora-2" weight="fill" /> Respondido pela IA
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="conteudo" className="relative z-10">
        {/* ---------- como funciona ---------- */}
        <section id="como" aria-labelledby="como-t" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-24 sm:px-6 md:py-28">
          <SectionHead id="como" eyebrow="Como funciona" title={<>Da primeira mensagem <span className="fx-gradient-text">ao negócio fechado.</span></>} />
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", icon: MessageCircle, t: "O cliente escreve", x: "Por qualquer canal. Quem é novo aparece na coluna de entrada.", art: <ArtChat /> },
              { n: "02", icon: Lightning, t: "Você aceita e responde", x: "Um clique e o lead abre com a conversa inteira. Um robô pode dar o oi por você.", art: <ArtAccept /> },
              { n: "03", icon: Trophy, t: "Arrasta até o Ganho", x: "Etapas com valor somado, tarefas com prazo e o motivo de cada perda.", art: <ArtWin /> },
            ].map((s) => (
              <li key={s.n} className="fx-reveal fx-lit flex flex-col p-7">
                <div className="flex items-center justify-between">
                  <span className="fx-tile size-11" aria-hidden>
                    <s.icon className="size-5" weight="fill" />
                  </span>
                  <span className="fx-num font-mono text-5xl font-semibold leading-none tracking-tight" aria-hidden>
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-7 text-xl tracking-tight text-on-night">
                  <span className="sr-only">Passo {s.n}: </span>
                  {s.t}
                </h3>
                <p className="mt-2 text-base text-on-night-muted">{s.x}</p>
                <div className="mt-7 flex-1 content-end" aria-hidden>
                  {s.art}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="fx-divider mx-auto max-w-5xl" aria-hidden />

        {/* ---------- 3 motivos ---------- */}
        <section id="recursos" aria-labelledby="recursos-t" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-24 sm:px-6 md:py-28">
          <SectionHead id="recursos" eyebrow="Recursos" title={<>Menos tela aberta. <span className="fx-gradient-text">Mais venda fechada.</span></>} />
          <div className="mt-16 flex flex-col gap-24 md:mt-20 md:gap-32">
            <Feature
              icon={Inbox}
              title="Todas as conversas no lead certo"
              text="Cada mensagem entra no cartão do cliente, com o histórico, as tarefas e a origem. Ninguém da equipe responde no escuro."
              points={["WhatsApp oficial, Instagram, Messenger e chat do site", "Fotos, arquivos e emoji na conversa", "Vendedor vê os dele; gerente vê tudo"]}
              art={
                <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_color-mix(in_srgb,var(--aurora-2)_25%,transparent),0_30px_60px_-30px_rgba(0,0,0,.9)]">
                  <Image src="/produto-lead.png" alt="" width={1440} height={900} sizes="(min-width: 768px) 560px, 100vw" />
                </div>
              }
            />
            <Feature
              flip
              icon={Bot}
              title="Robôs e IA que atendem por você"
              text="Monte gatilhos por etapa, como no funil digital que você já conhece, e deixe a IA tirar as dúvidas de sempre, 24 horas."
              points={["Boas-vindas, follow-up e tarefa sem ninguém lembrar", "Cobra quem parou de responder e cancela se ele voltar", "A IA passa para a equipe quando o cliente quer comprar"]}
              art={
                <div className="fx-lit flex flex-col gap-2.5 p-6 text-sm">
                  <p className="max-w-[80%] self-start rounded-lg rounded-bl-xs bg-[color-mix(in_srgb,var(--on-night)_7%,transparent)] px-3.5 py-2.5 text-on-night">Vocês abrem sábado?</p>
                  <p className="max-w-[85%] self-end rounded-lg rounded-br-xs bg-[color-mix(in_srgb,var(--aurora-2)_22%,transparent)] px-3.5 py-2.5 text-on-night">
                    Abrimos, das 9h às 13h. Quer que eu reserve um horário?
                  </p>
                  <p className="self-end text-xs text-on-night-muted">respondido pela IA</p>
                  <p className="mt-2 max-w-[80%] self-start rounded-lg rounded-bl-xs bg-[color-mix(in_srgb,var(--on-night)_7%,transparent)] px-3.5 py-2.5 text-on-night">Quero sim, pode ser 10h?</p>
                  <p className="mt-1 flex items-center gap-2 self-center rounded-pill border border-night-line px-3 py-1 text-xs text-on-night-muted">
                    <Sparkle className="size-3 text-aurora-2" weight="fill" /> IA passou para a equipe: quer agendar sábado 10h
                  </p>
                </div>
              }
            />
            <Feature
              icon={ChartColumn}
              title="Números que mostram onde vender mais"
              text="Veja em que etapa os negócios travam, quem está batendo a meta e qual campanha realmente vende."
              points={["Análise por etapa com tempo médio e conversão", "Metas do mês por pessoa", "ROI por campanha, pela origem de cada lead"]}
              art={
                <div className="fx-lit p-6">
                  <ArtChart />
                </div>
              }
            />
          </div>

          <div className="fx-reveal mt-24 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-on-night-muted">E ainda</p>
            <ul className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
              {extras.map((t) => (
                <li key={t} className="rounded-pill border border-night-line bg-[color-mix(in_srgb,var(--on-night)_4%,transparent)] px-3.5 py-1.5 text-sm text-on-night-muted">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="fx-divider mx-auto max-w-5xl" aria-hidden />

        {/* ---------- preços ---------- */}
        <section id="precos" aria-labelledby="precos-t" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-24 sm:px-6 md:py-28">
          <SectionHead id="precos" center eyebrow="Preços" title={<>Mensal, sem fidelidade. <span className="text-on-night-muted">14 dias grátis.</span></>} />
          <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:items-stretch">
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
                  <p className="mt-2 text-sm text-on-night-muted">ou R$ {p.a}/mês no anual</p>
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
          <p className="mt-8 text-center text-sm text-on-night-muted">Mensagens do WhatsApp iniciadas pela empresa são cobradas pela Meta, a preço de custo e separadas na fatura.</p>
        </section>

        {/* ---------- perguntas ---------- */}
        <section id="faq" aria-labelledby="faq-t" className="mx-auto max-w-3xl scroll-mt-28 px-4 py-24 sm:px-6 md:py-28">
          <SectionHead id="faq" center eyebrow="Perguntas" title="Antes de assinar." />
          <div className="mt-12 divide-y divide-night-line border-y border-night-line">
            {faq.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-md font-medium text-on-night [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-pill border border-night-line text-on-night-muted transition-transform duration-fast group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[60ch] text-base text-on-night-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- chamada final ---------- */}
        <section aria-labelledby="cta-t" className="relative overflow-hidden px-4 pb-32 pt-12 sm:px-6">
          <div className="fx-orb left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2" aria-hidden />
          <div className="fx-reveal relative z-10 mx-auto max-w-4xl text-center">
            <h2 id="cta-t" className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
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
            <NetzerMark className="h-6 w-auto text-brand-on-night" />© {BRAND.name} · uma marca {BRAND.parent}, {BRAND.parentTagline}
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
