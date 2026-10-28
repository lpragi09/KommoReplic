"use client";

import { useMemo, useState, useTransition } from "react";
import type { MessageCode, TrackingLink } from "@/data/types";
import { deleteMessageCodeAction, deleteTrackingLinkAction, saveMessageCodeAction, saveTrackingLinkAction } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { Copy, Globe, Link2, Pencil, Plus, Trash2, WhatsappLogo, Hash } from "@/components/ui/icons";
import { maskPhone } from "@/lib/document";

const UTM_FIELDS = [
  ["utm_source", "Fonte", "instagram, google, facebook"],
  ["utm_medium", "Mídia", "cpc, bio, stories, email"],
  ["utm_campaign", "Campanha", "black-friday, lancamento-out"],
  ["utm_content", "Conteúdo", "video-1, banner-azul"],
  ["utm_term", "Termo", "palavra-chave do Google"],
] as const;

type Draft = { id: string | null; name: string; phone: string; message: string; defaults: Record<string, string> };

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* sem permissão: o texto está visível para copiar à mão */
    }
  };
  return { copied, copy };
}

export function TrackingManager({
  slug,
  origin,
  links,
  chatKey,
  stats = {},
  codes = [],
}: {
  slug: string;
  origin: string;
  links: TrackingLink[];
  chatKey: string | null;
  /** por link: leads que vieram por ele, vendas ganhas e quanto faturaram */
  stats?: Record<string, { leads: number; won: number; cents: number }>;
  /** códigos no texto pronto dos anúncios */
  codes?: MessageCode[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { copied, copy } = useCopy();
  const [chatUtm, setChatUtm] = useState<Record<string, string>>({ utm_source: "", utm_medium: "", utm_campaign: "" });

  const save = () =>
    start(async () => {
      if (!draft) return;
      const res = await saveTrackingLinkAction(slug, draft.id, { name: draft.name, phone: draft.phone, message: draft.message, defaults: draft.defaults });
      if (!res.ok) return setError(res.error);
      setError(null);
      setDraft(null);
    });
  const remove = (l: TrackingLink) =>
    start(async () => {
      const res = await deleteTrackingLinkAction(slug, l.id);
      if (!res.ok) setError(res.error);
    });

  const script = `<script src="${origin}/t.js" data-link="${links[0]?.code ?? "CODIGO-DO-LINK"}" async></script>`;
  const chatUrl = useMemo(() => {
    if (!chatKey) return null;
    const p = new URLSearchParams(Object.entries(chatUtm).filter(([, v]) => v.trim()) as [string, string][]);
    return `${origin}/chat/${chatKey}${p.size ? `?${p}` : ""}`;
  }, [origin, chatKey, chatUtm]);

  const card = "rounded-lg bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]";
  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:p-6">
        <p className="text-sm text-muted">
          Descubra de qual anúncio, post ou campanha veio cada lead, sem montar robô. A origem aparece no cartão do lead, nos filtros dos robôs e em <strong className="text-fg">Relatórios → Campanhas</strong>.
        </p>

        {/* 1. links rastreáveis */}
        <section className={card} aria-labelledby="links-t">
          <div className="flex flex-wrap items-start gap-3">
            <span className="fx-tile size-10 shrink-0" aria-hidden>
              <WhatsappLogo className="size-5" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="links-t" className="font-semibold text-fg">
                1. Link rastreável de WhatsApp
              </h2>
              <p className="text-sm text-muted">Use no anúncio, na bio ou no botão do site. Cada clique guarda as UTMs e manda um código curto na mensagem; quando o cliente escreve, o sistema liga a conversa à campanha.</p>
            </div>
            <Button
              size="sm"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => {
                setError(null);
                setDraft({ id: null, name: "", phone: "", message: "Olá! Quero saber mais.", defaults: {} });
              }}
            >
              Novo link
            </Button>
          </div>
          {error && !draft && (
            <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {links.length === 0 ? (
            <p className="mt-4 rounded-md bg-surface p-4 text-sm text-muted">Nenhum link ainda. Crie um por campanha (ex.: “Instagram outubro”, “Google pesquisa”).</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {links.map((l) => {
                const url = `${origin}/w/${l.code}`;
                return (
                  <li key={l.id} className="rounded-md p-3 shadow-[inset_0_0_0_1px_var(--border)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-medium text-fg">{l.name}</p>
                      <LinkFunnel clicks={l.clicks} talks={l.matched} s={stats[l.id]} />
                      <IconButton label={`Editar ${l.name}`} size={28} onClick={() => setDraft({ id: l.id, name: l.name, phone: maskPhone(l.phone.replace(/^55/, "")), message: l.message, defaults: { ...(l.defaults as Record<string, string>) } })}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label={`Apagar ${l.name}`} size={28} tone="danger" onClick={() => remove(l)} disabled={pending}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-sm">{url}</code>
                      <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => copy(l.id, url)}>
                        {copied === l.id ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      Dica: adicione UTMs no fim para usar o mesmo link em vários lugares, ex.: <code>?utm_source=instagram&amp;utm_campaign=outubro</code>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 2. script do site */}
        <section className={card} aria-labelledby="script-t">
          <div className="flex items-start gap-3">
            <span className="fx-tile size-10 shrink-0" aria-hidden>
              <Globe className="size-5" weight="fill" />
            </span>
            <div>
              <h2 id="script-t" className="font-semibold text-fg">
                2. Script do seu site
              </h2>
              <p className="text-sm text-muted">
                Cole antes do <code>&lt;/body&gt;</code> do seu site. Ele guarda as UTMs de quem chega pelo anúncio (por 30 dias) e transforma todos os botões de WhatsApp da página no seu link rastreável.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded-sm bg-inverse-bg px-3 py-2 text-xs text-on-inverse">{script}</code>
            <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => copy("script", script)} disabled={!links.length}>
              {copied === "script" ? "Copiado" : "Copiar"}
            </Button>
          </div>
          {!links.length && <p className="mt-2 text-xs text-warning">Crie um link rastreável primeiro: o script usa o código dele.</p>}
        </section>

        {/* 3. chat do site com UTM */}
        <section className={card} aria-labelledby="chat-t">
          <div className="flex items-start gap-3">
            <span className="fx-tile size-10 shrink-0" aria-hidden>
              <Link2 className="size-5" />
            </span>
            <div>
              <h2 id="chat-t" className="font-semibold text-fg">
                3. Chat do site com UTM
              </h2>
              <p className="text-sm text-muted">O chat do site já lê as UTMs da página. Para links diretos (bio, email), monte aqui:</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {UTM_FIELDS.slice(0, 3).map(([k, label, ph]) => (
              <Field key={k} label={label} value={chatUtm[k] ?? ""} placeholder={ph.split(",")[0]} onChange={(e) => setChatUtm({ ...chatUtm, [k]: e.target.value })} />
            ))}
          </div>
          {chatUrl && (
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-sm">{chatUrl}</code>
              <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => copy("chat", chatUrl)}>
                {copied === "chat" ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}
        </section>

        {/* códigos na mensagem (anúncio com texto pronto) */}
        <MessageCodes slug={slug} codes={codes} />

        {/* 3½. link de página com UTM */}
        <PageLinkBuilder />

        {/* 4. anúncios da Meta */}
        <section className={card} aria-labelledby="meta-t">
          <h2 id="meta-t" className="font-semibold text-fg">
            4. Anúncios “clique para WhatsApp” da Meta
          </h2>
          <p className="mt-1 text-sm text-muted">
            Quando o WhatsApp oficial estiver conectado, a Meta avisa de qual anúncio veio cada conversa (id, título e o clique). O sistema grava sozinho — sem link, sem script e sem robô. Para isso, a conta de anúncios e o WhatsApp precisam estar no mesmo Gerenciador de Negócios.
          </p>
        </section>
      </div>

      <Dialog
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        icon={<Link2 className="size-5" />}
        title={draft?.id ? "Editar link rastreável" : "Novo link rastreável"}
        description="As UTMs abaixo valem para todo clique; UTMs na própria URL do link têm prioridade."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              Salvar link
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3">
            <Field label="Nome do link" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} placeholder="Ex.: Anúncio Instagram outubro" autoFocus />
            <Field
              label="Seu WhatsApp"
              value={draft.phone}
              inputMode="tel"
              onChange={(e) => setDraft({ ...draft, phone: maskPhone(e.target.value) })}
              placeholder="(11) 98888-1234"
              hint="Número que vai receber as conversas. Colocamos o 55 do Brasil."
            />
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Mensagem que já vem escrita
              <textarea
                rows={2}
                value={draft.message}
                maxLength={500}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                className="resize-y rounded-sm border border-border bg-bg px-3 py-2 text-base font-normal text-fg hover:border-border-input focus:border-focus focus:outline-none"
              />
              <span className="text-xs font-normal text-muted">No fim entra “Código do atendimento: K7Q2M”. Se o cliente apagar, a conversa chega sem a campanha.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {UTM_FIELDS.map(([k, label, ph]) => (
                <Field key={k} label={`${label} (${k})`} value={draft.defaults[k] ?? ""} placeholder={ph} onChange={(e) => setDraft({ ...draft, defaults: { ...draft.defaults, [k]: e.target.value } })} />
              ))}
            </div>
            {error && (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** do clique até a venda, em uma linha: cliques → conversas → leads → vendas (R$) */
function LinkFunnel({ clicks, talks, s }: { clicks: number; talks: number; s?: { leads: number; won: number; cents: number } }) {
  const steps = [
    { n: clicks, label: clicks === 1 ? "clique" : "cliques" },
    { n: talks, label: talks === 1 ? "conversa" : "conversas" },
    { n: s?.leads ?? 0, label: (s?.leads ?? 0) === 1 ? "lead" : "leads" },
    { n: s?.won ?? 0, label: (s?.won ?? 0) === 1 ? "venda" : "vendas" },
  ];
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs tabular-nums text-muted">
      {steps.map((x, i) => (
        <span key={x.label} className="inline-flex items-center gap-1">
          {i > 0 && <span aria-hidden>→</span>}
          <strong className={i === 3 && x.n ? "text-success" : "text-fg"}>{x.n}</strong> {x.label}
        </span>
      ))}
      {!!s?.cents && <span className="ml-1 rounded-pill bg-success-soft px-2 py-0.5 font-medium text-success">{brl(s.cents)}</span>}
    </span>
  );
}

/** monta o endereço de uma página com as UTMs, para usar em anúncios, posts e emails */
function PageLinkBuilder() {
  const [url, setUrl] = useState("");
  const [utm, setUtm] = useState<Record<string, string>>({ utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "" });
  const { copied, copy } = useCopy();
  const built = useMemo(() => {
    const raw = url.trim();
    if (!raw) return null;
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      for (const [k, v] of Object.entries(utm)) {
        const t = v.trim().toLowerCase().replace(/\s+/g, "-");
        if (t) u.searchParams.set(k, t);
        else u.searchParams.delete(k);
      }
      return u.toString();
    } catch {
      return "";
    }
  }, [url, utm]);
  return (
    <section className="rounded-lg bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]" aria-labelledby="pagina-t">
      <div className="flex items-start gap-3">
        <span className="fx-tile size-10 shrink-0" aria-hidden>
          <Link2 className="size-5" weight="fill" />
        </span>
        <div>
          <h2 id="pagina-t" className="font-semibold text-fg">
            Link de página com UTM
          </h2>
          <p className="text-sm text-muted">Para anúncios e posts que levam ao seu site. Com o script do site instalado, a campanha vai junto quando a pessoa chamar no WhatsApp ou no chat.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Endereço da página" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="seusite.com.br/promocao" inputMode="url" spellCheck={false} />
        </div>
        {UTM_FIELDS.filter(([k]) => k !== "utm_term").map(([k, label, ph]) => (
          <Field key={k} label={`${label} da página (${k})`} value={utm[k] ?? ""} placeholder={ph} onChange={(e) => setUtm({ ...utm, [k]: e.target.value })} />
        ))}
      </div>
      {built === "" && <p className="mt-3 text-sm text-danger">Esse endereço não parece válido.</p>}
      {built && (
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-sm">{built}</code>
          <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => copy("pagina", built)}>
            {copied === "pagina" ? "Copiado" : "Copiar"}
          </Button>
        </div>
      )}
    </section>
  );
}

type CodeDraft = { id: string | null; code: string; name: string; defaults: Record<string, string> };

/** "se a mensagem tiver G-01-34 → fonte, mídia, campanha e conteúdo", sem montar robô */
function MessageCodes({ slug, codes }: { slug: string; codes: MessageCode[] }) {
  const [draft, setDraft] = useState<CodeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      if (!draft) return;
      const r = await saveMessageCodeAction(slug, draft.id, { code: draft.code, name: draft.name, defaults: draft.defaults });
      if (!r.ok) return setError(r.error);
      setError(null);
      setDraft(null);
    });
  const remove = (c: MessageCode) =>
    start(async () => {
      const r = await deleteMessageCodeAction(slug, c.id);
      if (!r.ok) setError(r.error);
    });
  const summary = (d: Record<string, string>) =>
    UTM_FIELDS.filter(([k]) => d[k])
      .map(([k]) => d[k])
      .join(" · ");
  return (
    <section className="rounded-lg bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]" aria-labelledby="codigos-t">
      <div className="flex flex-wrap items-start gap-3">
        <span className="fx-tile size-10 shrink-0" aria-hidden>
          <Hash className="size-5" weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="codigos-t" className="font-semibold text-fg">
            Código na mensagem do anúncio
          </h2>
          <p className="text-sm text-muted">Para anúncios com texto pronto, tipo “Quero agendar uma revisão. G-01-34”. Quando a mensagem chega com o código, a origem é preenchida sozinha, sem robô.</p>
        </div>
        <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => (setError(null), setDraft({ id: null, code: "", name: "", defaults: {} }))}>
          Novo código
        </Button>
      </div>
      {error && !draft && (
        <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {codes.length === 0 ? (
        <p className="mt-4 rounded-md bg-surface p-4 text-sm text-muted">Nenhum código ainda. Coloque um código diferente no fim do texto de cada anúncio e cadastre aqui.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-md p-3 shadow-[inset_0_0_0_1px_var(--border)]">
              <code className="rounded-sm bg-accent-soft px-2 py-1 text-sm font-semibold text-accent-text">{c.code}</code>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{c.name}</span>
                <span className="block truncate text-xs text-muted">{summary(c.defaults as Record<string, string>) || "sem UTMs"}</span>
              </span>
              <span className="text-xs tabular-nums text-muted">
                <strong className="text-fg">{c.matched}</strong> {c.matched === 1 ? "conversa" : "conversas"}
              </span>
              <IconButton label={`Editar ${c.code}`} size={28} onClick={() => setDraft({ id: c.id, code: c.code, name: c.name, defaults: { ...(c.defaults as Record<string, string>) } })}>
                <Pencil className="size-4" />
              </IconButton>
              <IconButton label={`Apagar ${c.code}`} size={28} tone="danger" onClick={() => remove(c)} disabled={pending}>
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Editar código" : "Novo código"}
        description="Quando a mensagem do cliente tiver este código, a conversa e o lead ganham estas UTMs."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              Salvar código
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Field label="Código" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.replace(/\s/g, "") })} maxLength={30} placeholder="G-01-34" spellCheck={false} autoFocus />
              <Field label="Nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} placeholder="Anúncio revisão (imagem)" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {UTM_FIELDS.map(([k, label, ph]) => (
                <Field key={k} label={`${label} do código (${k})`} value={draft.defaults[k] ?? ""} placeholder={ph} onChange={(e) => setDraft({ ...draft, defaults: { ...draft.defaults, [k]: e.target.value } })} />
              ))}
            </div>
            {error && (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
}
