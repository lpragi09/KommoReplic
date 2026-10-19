"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { AgentConfig, AgentTone, ChannelKind } from "@/data/types";
import { saveAgentAction, testAgentAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Switch } from "@/components/robots/parts";
import { Globe, InstagramLogo, MessengerLogo, Send, Sparkle, WhatsappLogo, type LucideIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const TONES: { v: AgentTone; label: string; sample: string }[] = [
  { v: "amigavel", label: "Amigável", sample: "Oi! Tudo bem? Temos sim, posso te mandar as opções? 😊" },
  { v: "formal", label: "Formal", sample: "Olá, bom dia. Temos o produto disponível. Deseja conhecer as opções?" },
  { v: "direto", label: "Direto", sample: "Temos. São 3 opções, de R$ 90 a R$ 150. Quer ver?" },
];

const CHANNELS: { v: ChannelKind; label: string; icon: LucideIcon }[] = [
  { v: "webchat", label: "Chat do site", icon: Globe },
  { v: "whatsapp", label: "WhatsApp", icon: WhatsappLogo },
  { v: "instagram", label: "Instagram", icon: InstagramLogo },
  { v: "messenger", label: "Messenger", icon: MessengerLogo },
];

const KNOWLEDGE_TIP = `Exemplo do que colar aqui:

Horário: segunda a sexta, 9h às 18h. Sábado, 9h às 13h.
Endereço: Rua das Flores, 120, Centro, Campinas/SP.
Entrega: grátis acima de R$ 200 em Campinas; demais cidades pelos Correios (3 a 7 dias úteis).
Pagamento: Pix, cartão em até 6x sem juros, boleto.

Produtos:
- Kit Básico: R$ 149. Inclui...
- Kit Completo: R$ 249. Inclui...

Perguntas frequentes:
- Tem garantia? Sim, 90 dias contra defeito de fabricação.
- Faz troca? Em até 7 dias, com a embalagem original.`;

type Turn = { role: "cliente" | "empresa"; text: string; handoff?: string | null };

export function AgentSettings({ slug, company, agent, hasKey, blockedPlan }: { slug: string; company: string; agent: AgentConfig; hasKey: boolean; blockedPlan: string | null }) {
  const [cfg, setCfg] = useState(agent);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setSaved(false);
  };
  const input = () => ({ enabled: cfg.enabled, name: cfg.name, tone: cfg.tone, instructions: cfg.instructions, knowledge: cfg.knowledge, channels: cfg.channels, handoffMessage: cfg.handoffMessage });

  const save = () =>
    start(async () => {
      const res = await saveAgentAction(slug, input());
      if (!res.ok) return setError(res.error);
      setError(null);
      setSaved(true);
    });

  const card = "rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]";
  const area = "w-full rounded-md px-3 py-2.5 text-sm";

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* topo: liga e desliga */}
          <section aria-label="Agente de IA" className="fx-aurora overflow-hidden rounded-xl p-6">
            <div className="relative z-10 flex flex-wrap items-center gap-4">
              <span className="fx-glow grid size-14 shrink-0 place-items-center rounded-lg bg-accent text-on-accent" aria-hidden>
                <Sparkle className="size-7" weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-night-muted">Atendimento automático</p>
                <h2 className="text-xl font-semibold tracking-tight text-on-night">{cfg.name || "Assistente"} responde seus clientes 24h</h2>
                <p className="mt-1 text-sm text-on-night-muted">Responde dúvidas com o que você escrever abaixo e chama a equipe quando o cliente quer comprar, negociar ou falar com alguém.</p>
              </div>
              <label className="flex items-center gap-3 rounded-pill bg-[color-mix(in_srgb,var(--on-night)_10%,transparent)] px-4 py-2 text-sm font-medium text-on-night">
                {cfg.enabled ? "Ligado" : "Desligado"}
                <Switch checked={cfg.enabled} onChange={(v) => set("enabled", v)} label="Ligar o agente de IA" disabled={!!blockedPlan} />
              </label>
            </div>
          </section>

          {blockedPlan && (
            <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-fg">
              O agente de IA está no plano <strong>{blockedPlan}</strong>.{" "}
              <Link href={`/${slug}/settings/billing`} className="font-medium text-accent-text underline">
                Ver planos
              </Link>
            </p>
          )}
          {!hasKey && (
            <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-fg">
              Para a IA funcionar, falta colocar a chave da Anthropic na Vercel: variável <code className="font-semibold">ANTHROPIC_API_KEY</code> (crie em console.anthropic.com → API Keys). Dá para preencher tudo agora e ligar depois.
            </p>
          )}

          {/* identidade */}
          <section className={card} aria-labelledby="ag-id">
            <h3 id="ag-id" className="font-semibold text-fg">
              Como ele se apresenta
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
              <Field label="Nome do agente" value={cfg.name} maxLength={40} onChange={(e) => set("name", e.target.value)} hint="Ex.: Bia, Assistente da loja" />
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-fg">Jeito de falar</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TONES.map((t) => (
                    <label
                      key={t.v}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1 rounded-lg p-3 text-sm shadow-[inset_0_0_0_1px_var(--border)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                        cfg.tone === t.v && "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]",
                      )}
                    >
                      <input type="radio" name="tone" value={t.v} checked={cfg.tone === t.v} onChange={() => set("tone", t.v)} className="sr-only" />
                      <span className="font-medium text-fg">{t.label}</span>
                      <span className="text-xs text-muted">“{t.sample}”</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          {/* base de conhecimento */}
          <section className={card} aria-labelledby="ag-kb">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="ag-kb" className="font-semibold text-fg">
                Base de conhecimento
              </h3>
              <span className={cn("text-xs", cfg.knowledge.length > 30000 ? "text-danger" : "text-muted")}>{cfg.knowledge.length.toLocaleString("pt-BR")} / 30.000</span>
            </div>
            <p className="mt-1 text-sm text-muted">Tudo o que a IA pode responder: produtos, preços, horários, entrega, pagamento e perguntas frequentes. O que não estiver aqui, ela passa para a equipe.</p>
            <label htmlFor="ag-knowledge" className="sr-only">
              Base de conhecimento
            </label>
            <textarea id="ag-knowledge" rows={14} value={cfg.knowledge} placeholder={KNOWLEDGE_TIP} onChange={(e) => set("knowledge", e.target.value)} className={cn(area, "mt-3 font-mono leading-relaxed")} />
          </section>

          {/* regras extras */}
          <section className={card} aria-labelledby="ag-rules">
            <h3 id="ag-rules" className="font-semibold text-fg">
              Regras da empresa <span className="font-normal text-muted">(opcional)</span>
            </h3>
            <p className="mt-1 text-sm text-muted">Ex.: “Sempre pergunte a cidade antes de falar de frete.” “Não ofereça desconto.” “Ofereça agendar uma visita.”</p>
            <label htmlFor="ag-instructions" className="sr-only">
              Regras da empresa
            </label>
            <textarea id="ag-instructions" rows={4} value={cfg.instructions} maxLength={4000} onChange={(e) => set("instructions", e.target.value)} className={cn(area, "mt-3")} />
          </section>

          {/* canais e passagem */}
          <section className={card} aria-labelledby="ag-ch">
            <h3 id="ag-ch" className="font-semibold text-fg">
              Onde ele atende
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {CHANNELS.map((c) => {
                const on = cfg.channels.includes(c.v);
                return (
                  <button
                    key={c.v}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("channels", on ? cfg.channels.filter((x) => x !== c.v) : [...cfg.channels, c.v])}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-pill px-3.5 text-sm font-medium transition-colors duration-fast",
                      on ? "bg-accent text-on-accent" : "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--border)] hover:text-fg",
                    )}
                  >
                    <c.icon className="size-4" weight="fill" aria-hidden /> {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted">
              Quando alguém da equipe responde uma conversa, a IA para naquela conversa. Na caixa de entrada dá para devolver para ela. Se um robô estiver no meio de um fluxo, a IA espera ele terminar.
            </p>
            <div className="mt-4">
              <Field label="Mensagem quando passa para a equipe" value={cfg.handoffMessage} maxLength={300} onChange={(e) => set("handoffMessage", e.target.value)} />
            </div>
          </section>

          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 rounded-xl bg-bg/95 px-4 py-3 shadow-[0_0_0_1px_var(--border),0_-8px_24px_-16px_rgba(20,28,24,.35)]">
            <Button onClick={save} loading={pending}>
              Salvar agente
            </Button>
            {saved && <span className="text-sm text-success">Salvo.</span>}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>

        <TestChat slug={slug} company={company} cfg={input()} hasKey={hasKey} />
      </div>
    </div>
  );
}

function TestChat({ slug, company, cfg, hasKey }: { slug: string; company: string; cfg: Parameters<typeof testAgentAction>[1]; hasKey: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns, pending]);

  const send = () => {
    const t = text.trim();
    if (!t || pending) return;
    const next: Turn[] = [...turns, { role: "cliente", text: t }];
    setTurns(next);
    setText("");
    start(async () => {
      const res = await testAgentAction(
        slug,
        cfg,
        next.map(({ role, text }) => ({ role, text })),
      );
      if (!res.ok) return setError(res.error);
      setError(null);
      if (res.data.reply || res.data.handoff) setTurns((x) => [...x, { role: "empresa", text: res.data.reply, handoff: res.data.handoff }]);
    });
  };

  return (
    <aside aria-label="Testar o agente" className="lg:sticky lg:top-6 lg:self-start">
      <div className="overflow-hidden rounded-[28px] bg-[#0b120e] p-2 shadow-[0_30px_60px_-30px_rgba(20,28,24,.6)]">
        <div className="flex h-[560px] flex-col overflow-hidden rounded-[22px] bg-bg">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="grid size-9 place-items-center rounded-pill bg-accent text-on-accent" aria-hidden>
              <Sparkle className="size-4" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{company}</p>
              <p className="text-xs text-muted">Teste · {cfg.name || "Assistente"}</p>
            </div>
            {turns.length > 0 && (
              <button type="button" onClick={() => setTurns([])} className="text-xs font-medium text-accent-text underline">
                Recomeçar
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-surface p-3" aria-live="polite">
            {turns.length === 0 && (
              <p className="mx-auto mt-10 max-w-[240px] text-center text-sm text-muted">
                Escreva como se fosse um cliente. O teste usa o que está na tela, mesmo sem salvar.
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className={cn("flex flex-col", t.role === "cliente" ? "items-end" : "items-start")}>
                {t.text && (
                  <p className={cn("max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm text-fg", t.role === "cliente" ? "rounded-br-xs bg-bubble-out" : "rounded-bl-xs border border-border bg-bubble-in")}>
                    {t.text}
                  </p>
                )}
                {t.handoff && <p className="mt-1 rounded-pill bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-fg">Passou para a equipe: {t.handoff}</p>}
              </div>
            ))}
            {pending && <p className="text-xs text-muted">{cfg.name || "Assistente"} está escrevendo…</p>}
            {error && (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}
            <div ref={end} />
          </div>
          <form
            className="flex items-center gap-2 border-t border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="ag-test" className="sr-only">
              Mensagem de teste
            </label>
            <input
              id="ag-test"
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              placeholder={hasKey ? "Ex.: vocês entregam em Campinas?" : "Falta a chave da Anthropic"}
              disabled={!hasKey}
              className="h-10 min-w-0 flex-1 rounded-pill bg-surface px-4 text-sm"
            />
            <Button type="submit" size="sm" disabled={!hasKey || !text.trim()} loading={pending} icon={<Send className="size-4" aria-hidden />}>
              <span className="sr-only">Enviar</span>
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
