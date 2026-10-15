"use client";

import { useState, useTransition } from "react";
import type { Template } from "@/data/types";
import { deleteTemplateAction, saveTemplateAction } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/bits";
import { ChatText, Copy, Pencil, Plus, Search, Trash2 } from "@/components/ui/icons";

type Draft = { id: string | null; name: string; shortcut: string; body: string };
const empty: Draft = { id: null, name: "", shortcut: "", body: "" };

/** Respostas prontas: a equipe copia na conversa e os robôs usam no passo "Enviar mensagem". */
export function TemplatesManager({ slug, templates }: { slug: string; templates: Template[] }) {
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
      const res = await saveTemplateAction(slug, draft.id, { name: draft.name, shortcut: draft.shortcut, body: draft.body });
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
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar modelo" hideLabel placeholder="Buscar por nome, texto ou /atalho" value={q} onChange={(e) => setQ(e.target.value)} adornment={<Search className="size-4" aria-hidden />} className="min-w-56 flex-1" />
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => { setError(null); setDraft(empty); }}>
            Novo modelo
          </Button>
        </div>
        {error && !draft && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {templates.length === 0 ? (
          <EmptyState icon={ChatText} title="Nenhum modelo ainda" text="Crie respostas prontas para as perguntas que mais chegam: preço, horário, endereço." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-md bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)]">
                <div className="flex items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate font-semibold text-fg">{t.name}</h2>
                  {t.shortcut && <code className="rounded-xs bg-accent-soft px-1.5 py-0.5 text-xs text-accent-text">/{t.shortcut}</code>}
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted">{t.body}</p>
                <div className="mt-auto flex items-center justify-end gap-1 pt-1">
                  <IconButton label={copied === t.id ? "Copiado" : `Copiar ${t.name}`} onClick={() => copy(t)} tone={copied === t.id ? "success" : "default"}>
                    <Copy className="size-4" />
                  </IconButton>
                  <IconButton label={`Editar ${t.name}`} onClick={() => { setError(null); setDraft({ id: t.id, name: t.name, shortcut: t.shortcut ?? "", body: t.body }); }}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label={`Apagar ${t.name}`} tone="danger" onClick={() => remove(t)} disabled={pending}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </li>
            ))}
            {shown.length === 0 && <li className="text-sm text-muted">Nada encontrado para “{q}”.</li>}
          </ul>
        )}
      </div>

      <Dialog
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Editar modelo" : "Novo modelo"}
        description="Aceita {{nome}}, {{empresa}} e {{responsavel}} quando usado por um robô."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              Salvar modelo
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3">
            <Field label="Nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} placeholder="Ex.: Horário de atendimento" autoFocus />
            <Field label="Atalho (opcional)" value={draft.shortcut} onChange={(e) => setDraft({ ...draft, shortcut: e.target.value })} maxLength={31} placeholder="horario" adornment="/" hint="Letras minúsculas, números ou hífen." />
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Texto
              <textarea
                rows={5}
                value={draft.body}
                maxLength={2000}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                className="resize-y rounded-sm border border-border bg-bg px-3 py-2 text-base font-normal text-fg shadow-[inset_0_1px_2px_rgba(14,26,58,.06)] hover:border-border-input focus:border-focus focus:outline-none focus:shadow-[0_0_0_4px_rgba(37,99,235,.15)]"
              />
            </label>
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
