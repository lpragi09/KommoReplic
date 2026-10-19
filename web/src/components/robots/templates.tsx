"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { Template } from "@/data/types";
import { deleteTemplateAction, saveTemplateAction } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/bits";
import { ArrowUpRight, ChatText, Check, Copy, Globe, InstagramLogo, MessengerLogo, Pencil, Plus, Search, Trash2, TriangleAlert, WhatsappLogo, X, type LucideIcon } from "@/components/ui/icons";
import { VARIABLES } from "@/lib/robot-meta";
import { RULES, WA_CATEGORIES, checkTemplate, type Network, type TemplateButton, type WaCategory } from "@/lib/template-rules";
import { cn } from "@/lib/cn";
import { TemplatePreview } from "./template-preview";

type Draft = {
  id: string | null;
  name: string;
  shortcut: string;
  network: Network;
  category: WaCategory | null;
  header: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
};
const empty: Draft = { id: null, name: "", shortcut: "", network: "whatsapp", category: null, header: "", body: "", footer: "", buttons: [] };

function TikTokMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid place-items-center text-[11px] font-black leading-none", className)} aria-hidden>
      ♪
    </span>
  );
}

const NETWORKS: { id: Network; icon: LucideIcon | typeof TikTokMark; tint: string }[] = [
  { id: "whatsapp", icon: WhatsappLogo, tint: "text-[#128c4a] bg-[#25d366]/12" },
  { id: "instagram", icon: InstagramLogo, tint: "text-[#c13584] bg-[#c13584]/10" },
  { id: "messenger", icon: MessengerLogo, tint: "text-[#0866ff] bg-[#0866ff]/10" },
  { id: "tiktok", icon: TikTokMark, tint: "text-[#161823] bg-[#25f4ee]/25" },
  { id: "webchat", icon: Globe, tint: "text-accent-text bg-accent-soft" },
];
const netIcon = (n: Network) => NETWORKS.find((x) => x.id === n)!;

/** Respostas prontas por rede: a equipe copia na conversa e os robôs usam no passo "Enviar mensagem". */
export function TemplatesManager({ slug, company, templates }: { slug: string; company: string; templates: Template[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = templates.filter((t) => {
    const s = q.trim().toLowerCase();
    return !s || t.name.toLowerCase().includes(s) || t.body.toLowerCase().includes(s) || (t.shortcut ?? "").includes(s.replace(/^\//, ""));
  });

  const save = () =>
    start(async () => {
      if (!draft) return;
      const res = await saveTemplateAction(slug, draft.id, {
        name: draft.name,
        shortcut: draft.shortcut,
        body: draft.body,
        network: draft.network,
        category: draft.network === "whatsapp" ? draft.category : null,
        header: RULES[draft.network].header !== null ? draft.header : null,
        footer: RULES[draft.network].footer !== null ? draft.footer : null,
        buttons: draft.buttons,
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      setDraft(null);
    });
  const remove = (t: Template) =>
    start(async () => {
      const res = await deleteTemplateAction(slug, t.id);
      if (!res.ok) setError(res.error);
    });
  const copy = async (t: Template) => {
    try {
      await navigator.clipboard.writeText(t.body);
      setCopied(t.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Não deu para copiar. Selecione o texto e copie à mão.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar modelo" hideLabel placeholder="Buscar por nome, texto ou /atalho" value={q} onChange={(e) => setQ(e.target.value)} adornment={<Search className="size-4" aria-hidden />} className="min-w-56 flex-1" />
          <Button
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => {
              setError(null);
              setDraft(empty);
            }}
          >
            Novo modelo
          </Button>
        </div>
        {error && !draft && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {templates.length === 0 ? (
          <EmptyState icon={ChatText} title="Nenhum modelo ainda" text="Crie respostas prontas para cada rede: boas-vindas no WhatsApp, resposta de Direct no Instagram, confirmação de pedido…" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((t) => {
              const n = netIcon(t.network);
              return (
                <li key={t.id} className="flex flex-col gap-2 rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] transition-shadow duration-fast hover:shadow-[0_0_0_1px_var(--border-input),0_8px_20px_-12px_rgba(31,122,85,.35)]">
                  <div className="flex items-center gap-2">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", n.tint)} aria-hidden>
                      <n.icon className="size-4" weight="fill" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold text-fg">{t.name}</h2>
                      <p className="text-xs text-muted">
                        {RULES[t.network].label}
                        {t.category && ` · ${WA_CATEGORIES[t.category].label}`}
                        {t.network === "whatsapp" && t.waStatus === "draft" && " · aguarda aprovação da Meta"}
                      </p>
                    </div>
                    {t.shortcut && <code className="rounded-xs bg-accent-soft px-1.5 py-0.5 text-xs text-accent-text">/{t.shortcut}</code>}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted">{t.body}</p>
                  {t.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.buttons.map((b, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-xs text-fg shadow-[inset_0_0_0_1px_var(--border)]">
                          {b.kind === "url" && <ArrowUpRight className="size-3" aria-hidden />}
                          {b.text}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-end gap-1 pt-1">
                    <IconButton label={copied === t.id ? "Copiado" : `Copiar ${t.name}`} onClick={() => copy(t)} tone={copied === t.id ? "success" : "default"}>
                      <Copy className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Editar ${t.name}`}
                      onClick={() => {
                        setError(null);
                        setDraft({ id: t.id, name: t.name, shortcut: t.shortcut ?? "", network: t.network, category: t.category, header: t.header ?? "", body: t.body, footer: t.footer ?? "", buttons: t.buttons });
                      }}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton label={`Apagar ${t.name}`} tone="danger" onClick={() => remove(t)} disabled={pending}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
            {shown.length === 0 && <li className="text-sm text-muted">Nada encontrado para “{q}”.</li>}
          </ul>
        )}
      </div>

      <Dialog
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        icon={<ChatText className="size-5" />}
        title={draft?.id ? "Editar modelo" : "Novo modelo de mensagem"}
        description="Escolha a rede: limites, botões e prévia seguem as regras de cada uma."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              {draft?.network === "whatsapp" ? "Salvar e enviar para aprovação" : "Salvar modelo"}
            </Button>
          </>
        }
      >
        {draft && <Editor draft={draft} setDraft={setDraft} company={company} error={error} />}
      </Dialog>
    </div>
  );
}

function Section({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-lg bg-surface/60 p-4 shadow-[inset_0_0_0_1px_var(--border)]">
      <header className="mb-3 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-pill bg-accent text-xs font-semibold text-on-accent">{n}</span>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {aside && <span className="ml-auto">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cn("text-xs tabular-nums", value > max ? "font-semibold text-danger" : value > max * 0.9 ? "text-warning" : "text-muted")}>{value}/{max}</span>;
}

function Editor({ draft, setDraft, company, error }: { draft: Draft; setDraft: (d: Draft) => void; company: string; error: string | null }) {
  const rules = RULES[draft.network];
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const problems = checkTemplate(draft.network, { body: draft.body, header: draft.header, footer: draft.footer, buttons: draft.buttons, category: draft.category });
  const replies = draft.buttons.filter((b) => b.kind === "reply").length;
  const links = draft.buttons.filter((b) => b.kind === "url").length;
  const maxBody = draft.network === "messenger" && links ? 640 : rules.maxBody;
  const insert = (k: string) => set({ body: `${draft.body}{{${k}}}` });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Section n={1} title="Para qual rede é este modelo?">
          <div role="radiogroup" aria-label="Rede" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {NETWORKS.map((n) => {
              const on = draft.network === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    // trocar de rede descarta botões que a nova rede não aceita
                    const r = RULES[n.id];
                    set({
                      network: n.id,
                      buttons: draft.buttons.filter((b) => (b.kind === "reply" ? r.quickReplies : r.linkButtons)),
                      category: n.id === "whatsapp" ? draft.category : null,
                      header: r.header === null ? "" : draft.header,
                      footer: r.footer === null ? "" : draft.footer,
                    });
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md bg-bg px-2 py-3 text-xs font-medium transition-[box-shadow,transform] duration-fast ease-out active:scale-[0.98]",
                    on ? "text-fg shadow-[0_0_0_2px_var(--accent),0_6px_16px_-8px_rgba(31,122,85,.5)]" : "text-muted shadow-[0_0_0_1px_var(--border)] hover:shadow-[0_0_0_1px_var(--border-input)]",
                  )}
                >
                  <span className={cn("grid size-9 place-items-center rounded-md", n.tint)}>
                    <n.icon className="size-5" weight="fill" />
                  </span>
                  {RULES[n.id].label.replace("Facebook ", "")}
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-md bg-bg p-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--border)]">
            <p>
              <strong className="text-fg">Janela de resposta:</strong> {rules.window}
            </p>
            <ul className="mt-1 list-disc pl-4">
              {rules.notes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            {rules.approximate && <p className="mt-1 text-warning">Regras aproximadas: a TikTok não publica um guia aberto. Confirmamos ao conectar o canal.</p>}
          </div>
        </Section>

        {draft.network === "whatsapp" && (
          <Section n={2} title="Categoria no WhatsApp" aside={<span className="text-xs text-muted">a Meta cobra por categoria</span>}>
            <div role="radiogroup" aria-label="Categoria do WhatsApp" className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(WA_CATEGORIES) as WaCategory[]).map((c) => {
                const on = draft.category === c;
                const info = WA_CATEGORIES[c];
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ category: c })}
                    className={cn(
                      "flex flex-col gap-1 rounded-md bg-bg p-3 text-left transition-shadow duration-fast",
                      on ? "shadow-[0_0_0_2px_var(--accent)]" : "shadow-[0_0_0_1px_var(--border)] hover:shadow-[0_0_0_1px_var(--border-input)]",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                      {on && <Check className="size-3.5 text-accent" aria-hidden />}
                      {info.label}
                    </span>
                    <span className="text-xs text-muted">{info.text}</span>
                    <span className={cn("mt-auto text-xs font-medium", c === "marketing" ? "text-warning" : "text-success")}>{info.cost}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        <Section n={draft.network === "whatsapp" ? 3 : 2} title="Conteúdo">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome do modelo" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="Ex.: Boas-vindas" />
              <Field label="Atalho (opcional)" value={draft.shortcut} onChange={(e) => set({ shortcut: e.target.value })} maxLength={31} placeholder="boasvindas" adornment="/" />
            </div>
            {rules.header !== null && (
              <Field
                label="Título (opcional)"
                value={draft.header}
                onChange={(e) => set({ header: e.target.value })}
                placeholder="Ex.: Seu pedido saiu!"
                hint={`${draft.header.length}/${rules.header} caracteres`}
                error={draft.header.length > rules.header ? `Máximo de ${rules.header} caracteres.` : undefined}
              />
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label htmlFor="tpl-body" className="text-sm font-medium text-fg">
                  Mensagem
                </label>
                <Counter value={draft.body.length} max={maxBody} />
              </div>
              <textarea
                id="tpl-body"
                rows={5}
                value={draft.body}
                onChange={(e) => set({ body: e.target.value })}
                placeholder="Oi, {{nome}}! Aqui é da {{empresa}}…"
                className="resize-y rounded-md border border-border bg-bg px-3 py-2.5 text-base text-fg shadow-[inset_0_1px_2px_rgba(20,28,24,.06)] transition-[border-color,box-shadow] duration-fast hover:border-border-input focus:border-focus focus:outline-none focus:shadow-[0_0_0_4px_rgba(31,122,85,.15)]"
              />
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-xs text-muted">Inserir:</span>
                {VARIABLES.map((v) => (
                  <button key={v.key} type="button" onClick={() => insert(v.key)} className="rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_20%,var(--bg))]">
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {rules.footer !== null && (
              <Field
                label="Rodapé (opcional)"
                value={draft.footer}
                onChange={(e) => set({ footer: e.target.value })}
                placeholder="Ex.: Responda SAIR para não receber mais"
                hint={`${draft.footer.length}/${rules.footer} caracteres`}
                error={draft.footer.length > rules.footer ? `Máximo de ${rules.footer} caracteres.` : undefined}
              />
            )}
          </div>
        </Section>

        {(rules.quickReplies || rules.linkButtons) && (
          <Section
            n={draft.network === "whatsapp" ? 4 : 3}
            title="Botões (opcional)"
            aside={
              <span className="text-xs text-muted">
                {rules.quickReplies && `${replies}/${rules.quickReplies.max} respostas`}
                {rules.quickReplies && rules.linkButtons && " · "}
                {rules.linkButtons && `${links}/${rules.linkButtons.max} links`}
              </span>
            }
          >
            <ul className="flex flex-col gap-2">
              {draft.buttons.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={cn("mt-2 shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium", b.kind === "url" ? "bg-accent-soft text-accent-text" : "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)]")}>{b.kind === "url" ? "Link" : "Resposta"}</span>
                  <Field label="Texto do botão" hideLabel value={b.text} placeholder="Texto do botão" className="flex-1" onChange={(e) => set({ buttons: draft.buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                  {b.kind === "url" && <Field label="Endereço do link" hideLabel value={b.url ?? ""} placeholder="https://" className="flex-1" onChange={(e) => set({ buttons: draft.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />}
                  <IconButton label="Remover botão" tone="danger" className="mt-1" onClick={() => set({ buttons: draft.buttons.filter((_, j) => j !== i) })}>
                    <X className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {rules.quickReplies && (
                <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden />} disabled={replies >= rules.quickReplies.max} onClick={() => set({ buttons: [...draft.buttons, { kind: "reply", text: "" }] })}>
                  Resposta rápida
                </Button>
              )}
              {rules.linkButtons && (
                <Button size="sm" variant="secondary" icon={<ArrowUpRight className="size-4" aria-hidden />} disabled={links >= rules.linkButtons.max} onClick={() => set({ buttons: [...draft.buttons, { kind: "url", text: "", url: "https://" }] })}>
                  Botão de link
                </Button>
              )}
            </div>
          </Section>
        )}

        {(problems.length > 0 || error) && (
          <div role="alert" className="flex gap-2 rounded-md bg-[color-mix(in_srgb,var(--warning)_10%,var(--bg))] p-3 text-sm shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--warning)_35%,transparent)]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <ul className="flex flex-col gap-0.5 text-fg">
              {error && <li className="font-medium text-danger">{error}</li>}
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-0 lg:self-start" aria-label="Prévia">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-muted">Prévia no {rules.label}</p>
        <TemplatePreview network={draft.network} company={company} header={draft.header} body={draft.body} footer={draft.footer} buttons={draft.buttons} />
      </aside>
    </div>
  );
}
