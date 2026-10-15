"use client";

import { useEffect, useState, useTransition } from "react";
import type { Broadcast, BroadcastFilter, ChannelKind, Pipeline, Template } from "@/data/types";
import { previewBroadcastAction, sendBroadcastAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import { Megaphone, Send } from "@/components/ui/icons";
import { CHANNELS, VARIABLES } from "@/lib/robot-meta";
import { when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { channelIcon } from "@/components/robots/parts";

/** Disparo: uma mensagem para vários leads de uma vez, cada um no canal da própria conversa. */
export function Broadcasts({ slug, pipelines, templates, history }: { slug: string; pipelines: Pipeline[]; templates: Template[]; history: Broadcast[] }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<BroadcastFilter>({ pipelineId: pipelines[0]?.id ?? null, stageIds: [], tag: null, channels: [] });
  const [count, setCount] = useState<{ leads: number; reachable: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pipeline = pipelines.find((p) => p.id === filter.pipelineId);
  const stages = pipeline ? [...pipeline.stages].sort((a, b) => a.sort - b.sort) : [];

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      previewBroadcastAction(slug, filter)
        .then((c) => alive && setCount(c))
        .catch(() => alive && setCount(null));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [slug, filter]);

  const send = () =>
    start(async () => {
      const res = await sendBroadcastAction(slug, { name, body, filter });
      if (!res.ok) {
        setResult(null);
        return setError(res.error);
      }
      setError(null);
      setResult(`Enviado para ${res.data.sent} de ${res.data.total}${res.data.failed ? ` · ${res.data.failed} sem conversa aberta ou fora da janela do WhatsApp` : ""}.`);
      setBody("");
      setName("");
    });

  const toggleStage = (id: string) => setFilter((f) => ({ ...f, stageIds: f.stageIds.includes(id) ? f.stageIds.filter((x) => x !== id) : [...f.stageIds, id] }));
  const toggleChannel = (k: ChannelKind) => setFilter((f) => ({ ...f, channels: f.channels.includes(k) ? f.channels.filter((x) => x !== k) : [...f.channels, k] }));

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="novo-disparo" className="flex flex-col gap-4 rounded-lg bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]">
          <h2 id="novo-disparo" className="text-base font-semibold text-fg">
            Novo disparo
          </h2>
          <Field label="Nome (só para você)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Promoção de outubro" />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-fg">Para quem</legend>
            {pipelines.length > 1 && (
              <select
                aria-label="Funil"
                value={filter.pipelineId ?? ""}
                onChange={(e) => setFilter((f) => ({ ...f, pipelineId: e.target.value || null, stageIds: [] }))}
                className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base text-fg"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Etapas">
              {stages.map((s) => {
                const on = filter.stageIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleStage(s.id)}
                    className={cn("h-8 rounded-pill px-3 text-sm transition-colors duration-fast", on ? "bg-inverse-bg text-on-inverse" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-input)]")}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">Nenhuma etapa marcada = todas.</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Canais">
              {CHANNELS.map((c) => {
                const on = filter.channels.includes(c.kind);
                const I = channelIcon[c.kind];
                return (
                  <button
                    key={c.kind}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleChannel(c.kind)}
                    className={cn("inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm transition-colors duration-fast", on ? "bg-accent text-on-accent" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)]")}
                  >
                    <I className="size-4" aria-hidden /> {c.label}
                  </button>
                );
              })}
            </div>
            <Field label="Só com a etiqueta (opcional)" value={filter.tag ?? ""} onChange={(e) => setFilter((f) => ({ ...f, tag: e.target.value.trim() || null }))} maxLength={40} placeholder="Ex.: cliente-vip" />
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bc-body" className="text-sm font-medium text-fg">
              Mensagem
            </label>
            <textarea
              id="bc-body"
              rows={5}
              value={body}
              maxLength={2000}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Oi, {{nome}}! Temos novidade na {{empresa}}…"
              className="resize-y rounded-sm border border-border bg-bg px-3 py-2 text-base text-fg shadow-[inset_0_1px_2px_rgba(14,26,58,.06)] hover:border-border-input focus:border-focus focus:outline-none focus:shadow-[0_0_0_4px_rgba(37,99,235,.15)]"
            />
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted">Inserir:</span>
              {VARIABLES.map((v) => (
                <button key={v.key} type="button" onClick={() => setBody((b) => `${b}{{${v.key}}}`)} className="rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
                  {v.label}
                </button>
              ))}
              {templates.length > 0 && (
                <select aria-label="Usar um modelo de mensagem" value="" onChange={(e) => setBody(templates.find((t) => t.id === e.target.value)?.body ?? body)} className="ml-auto h-7 rounded-sm border border-border bg-bg px-1.5 text-xs text-fg">
                  <option value="">Usar modelo…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <p className="mr-auto text-sm text-muted" aria-live="polite">
              {count ? (
                <>
                  <strong className="font-semibold text-fg">{count.reachable}</strong> de {count.leads} leads têm conversa para receber
                </>
              ) : (
                "Calculando…"
              )}
            </p>
            <Dialog
              title="Enviar disparo?"
              description={`A mensagem vai para ${count?.reachable ?? 0} conversas. Não dá para desfazer.`}
              size="sm"
              trigger={
                <Button icon={<Send className="size-4" aria-hidden />} disabled={!body.trim() || !name.trim() || !count?.reachable}>
                  Enviar
                </Button>
              }
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancelar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={send} loading={pending}>
                      Enviar agora
                    </Button>
                  </DialogClose>
                </>
              }
            />
          </div>
          {error && (
            <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {result && (
            <p role="status" className="rounded-sm bg-success-soft px-3 py-2 text-sm text-success">
              {result}
            </p>
          )}
          <p className="text-xs text-muted">
            WhatsApp só deixa mandar texto livre para quem falou com você nas últimas 24h; os demais ficam de fora. Disparos para muita gente fria pedem modelos aprovados pela Meta.
          </p>
        </section>

        <section aria-labelledby="historico-disparos" className="flex flex-col gap-2">
          <h2 id="historico-disparos" className="text-sm font-semibold text-fg">
            Disparos anteriores
          </h2>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg bg-bg p-6 text-center shadow-[0_0_0_1px_var(--border)]">
              <Megaphone className="size-6 text-muted" aria-hidden />
              <p className="text-sm text-muted">Nenhum disparo ainda.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((b) => (
                <li key={b.id} className="rounded-md bg-bg p-3 shadow-[0_0_0_1px_var(--border)]">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{b.name}</p>
                    <time className="text-xs text-muted" dateTime={b.createdAt} suppressHydrationWarning>
                      {when(b.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{b.body}</p>
                  <p className="mt-1.5 text-xs tabular-nums text-fg">
                    <span className="text-success">{b.sent} enviados</span>
                    {b.failed > 0 && <span className="text-muted"> · {b.failed} de fora</span>}
                    {b.createdBy && <span className="text-muted"> · por {b.createdBy}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
