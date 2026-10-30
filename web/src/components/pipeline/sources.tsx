"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import type { Channel, MessageCode, SourceRule, TrackingLink } from "@/data/types";
import { deleteSourceRuleAction, saveSourceRuleAction, setChannelPipelineAction } from "@/app/actions";
import { MATCH_LABEL } from "@/lib/routing";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronsLeft, ChevronsRight, FacebookLogo, Globe, InstagramLogo, MessageCircle, Plus, Trash2, WhatsappLogo } from "@/components/ui/icons";

/* Fontes do funil, na lateral do quadro: quais canais mandam contato novo para cá e as regras de entrada
   (a mesma rede em outro funil, separando pelo texto, código, link ou anúncio). Fechado, vira uma faixa estreita. */

const ICON = { whatsapp: WhatsappLogo, instagram: InstagramLogo, messenger: FacebookLogo, webchat: Globe } as Record<string, typeof Globe>;
const KIND_LABEL: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Facebook", webchat: "Chat do site", telegram: "Telegram", email: "Email" };
const ChannelIcon = ({ kind, className }: { kind: string; className?: string }) => {
  const I = ICON[kind] ?? MessageCircle;
  return <I className={className} aria-hidden />;
};

const KEY = "netzer-fontes";
const listeners = new Set<() => void>();
const sub = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
const readOpen = () => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
};
const saveOpen = (v: boolean) => {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  listeners.forEach((fn) => fn());
};

type Props = {
  slug: string;
  pipelineId: string;
  pipelines: { id: string; name: string }[];
  channels: Channel[];
  rules: SourceRule[];
  links: TrackingLink[];
  codes: MessageCode[];
  isAdmin: boolean;
};

export function SourcesPanel(props: Props) {
  const open = useSyncExternalStore(sub, readOpen, () => true);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => saveOpen(true)}
        className="flex w-10 shrink-0 flex-col items-center gap-3 rounded-lg border border-border bg-bg py-3 text-muted transition-colors duration-fast hover:text-fg"
        aria-label="Abrir fontes do funil"
      >
        <ChevronsRight className="size-4" aria-hidden />
        <span className="text-xs font-medium [writing-mode:vertical-rl]">Fontes do funil</span>
      </button>
    );
  return <Panel {...props} />;
}

function Panel({ slug, pipelineId, pipelines, channels, rules, links, codes, isAdmin }: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const act = (p: Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await p;
      setError(r.ok ? undefined : r.error);
    });

  const live = channels.filter((c) => c.status !== "disconnected");
  const here = live.filter((c) => c.defaultPipelineId === pipelineId);
  const elsewhere = live.filter((c) => c.defaultPipelineId !== pipelineId);
  const mine = rules.filter((r) => r.pipelineId === pipelineId);
  const pipeName = (id: string | null) => pipelines.find((p) => p.id === id)?.name ?? "nenhum funil";
  const chName = (id: string | null) => (id ? (live.find((c) => c.id === id)?.name ?? "canal removido") : "Qualquer canal");
  const valueText = (r: SourceRule) =>
    r.match === "link" ? (links.find((l) => l.id === r.value)?.name ?? "link apagado") : r.match === "ad" ? "" : `“${r.value}”`;

  return (
    <aside aria-label="Fontes do funil" className="flex w-[var(--kanban-column)] shrink-0 flex-col rounded-lg border border-border bg-bg p-1.5">
      <header className="flex items-center gap-2 px-2 pb-1 pt-1.5">
        <h2 className="mr-auto text-base font-semibold text-fg">Fontes do funil</h2>
        <IconButton label="Fechar fontes do funil" size={28} onClick={() => saveOpen(false)}>
          <ChevronsLeft className="size-4" />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-2">
        <section aria-labelledby="src-ch">
          <h3 id="src-ch" className="text-xs font-medium uppercase tracking-wide text-muted">
            Canais que caem aqui
          </h3>
          {here.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">Nenhum canal manda contato novo direto para este funil.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1">
              {here.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-2 text-sm">
                  <ChannelIcon kind={c.kind} className="size-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-fg">{c.name}</span>
                  <span className={cn("size-2 shrink-0 rounded-full", c.status === "connected" ? "bg-success" : "bg-warning")} title={c.status === "connected" ? "Conectado" : "Com problema"} />
                </li>
              ))}
            </ul>
          )}
          {isAdmin && elsewhere.length > 0 && (
            <Select
              key={elsewhere.map((c) => c.id).join()}
              className="mt-2"
              size="sm"
              label="Trazer canal para cá"
              hideLabel
              placeholder="Trazer outro canal…"
              onValueChange={(v) => v && act(setChannelPipelineAction(slug, v, pipelineId))}
              options={elsewhere.map((c) => ({ value: c.id, label: c.name, hint: `hoje: ${pipeName(c.defaultPipelineId)}`, icon: <ChannelIcon kind={c.kind} className="size-4" /> }))}
            />
          )}
          <Link href={`/${slug}/settings/channels`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
            <Plus className="size-3.5" aria-hidden /> Conectar rede social
          </Link>
        </section>

        <section aria-labelledby="src-rules" className="border-t border-border pt-3">
          <h3 id="src-rules" className="text-xs font-medium uppercase tracking-wide text-muted">
            Separar por assunto
          </h3>
          <p className="mt-1 text-xs text-muted">Ex.: no mesmo WhatsApp, quem fala “orçamento” cai neste funil e o resto continua no funil de sempre.</p>
          {mine.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {mine.map((r) => (
                <li key={r.id} className="flex items-start gap-2 rounded-md bg-surface px-2.5 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-fg">
                    Mensagem {r.channelId ? <>pelo <span className="font-medium">{chName(r.channelId)}</span></> : "de qualquer canal"} que {MATCH_LABEL[r.match]} {valueText(r)}
                    <span className="block text-xs text-muted">
                      {r.matched} {r.matched === 1 ? "contato trazido" : "contatos trazidos"}
                    </span>
                  </span>
                  {isAdmin && (
                    <IconButton label="Apagar regra" size={28} tone="danger" disabled={pending} onClick={() => act(deleteSourceRuleAction(slug, r.id))}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isAdmin ? (
            <NewRule slug={slug} pipelineId={pipelineId} channels={live} links={links} codes={codes} pending={pending} onSave={act} />
          ) : (
            mine.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma regra. Só administradores criam regras.</p>
          )}
          {rules.length > mine.length && <p className="mt-2 text-xs text-muted">Se mais de uma regra bater, vale a criada primeiro (de qualquer funil).</p>}
        </section>
        {error && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}

function NewRule({
  slug,
  pipelineId,
  channels,
  links,
  codes,
  pending,
  onSave,
}: {
  slug: string;
  pipelineId: string;
  channels: Channel[];
  links: TrackingLink[];
  codes: MessageCode[];
  pending: boolean;
  onSave: (p: Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const [channelId, setChannelId] = useState("");
  const [match, setMatch] = useState<SourceRule["match"]>("keyword");
  const [value, setValue] = useState("");
  const [round, setRound] = useState(0); // remonta os seletores de valor para voltarem ao texto de ajuda
  const save = () => {
    onSave(saveSourceRuleAction(slug, { pipelineId, channelId: channelId || null, match, value }));
    setValue("");
    setRound((n) => n + 1);
  };
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-dashed border-border-input p-2.5">
      <p className="text-xs font-medium text-fg">Nova regra: quando chegar mensagem…</p>
      <Select
        size="sm"
        label="Por qual canal"
        value={channelId}
        onValueChange={setChannelId}
        options={[{ value: "", label: "Qualquer canal" }, ...channels.map((c) => ({ value: c.id, label: c.name, hint: KIND_LABEL[c.kind], icon: <ChannelIcon kind={c.kind} className="size-4" /> }))]}
      />
      <Select
        size="sm"
        label="Que"
        value={match}
        onValueChange={(v) => {
          setMatch(v as SourceRule["match"]);
          setValue("");
        }}
        options={(Object.keys(MATCH_LABEL) as SourceRule["match"][]).map((k) => ({ value: k, label: MATCH_LABEL[k] }))}
      />
      {match === "keyword" && <Field label="Palavras" hint="Qualquer uma delas já vale. Separe por vírgula." placeholder="orçamento, preço" value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} />}
      <p className="text-xs text-muted">…o contato novo entra neste funil.</p>
      {match === "code" && (
        <Select
          key={round}
          size="sm"
          label="Código"
          placeholder={codes.length ? "Escolha o código" : "Cadastre códigos em Rastreamento"}
          onValueChange={setValue}
          options={codes.map((c) => ({ value: c.code, label: c.code, hint: c.name }))}
        />
      )}
      {match === "link" && (
        <Select
          key={round}
          size="sm"
          label="Link rastreável"
          placeholder={links.length ? "Escolha o link" : "Crie links em Rastreamento"}
          onValueChange={setValue}
          options={links.map((l) => ({ value: l.id, label: l.name }))}
        />
      )}
      {match === "ad" && <p className="text-xs text-muted">Quem chamar clicando num anúncio “clique para conversar” do Facebook ou Instagram.</p>}
      <Button size="sm" disabled={pending || (match !== "ad" && !value.trim())} loading={pending} onClick={save}>
        Criar regra
      </Button>
    </div>
  );
}
