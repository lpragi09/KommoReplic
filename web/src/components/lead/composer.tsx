"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { AlertTriangle, FileText, Paperclip, Send, X } from "@/components/ui/icons";
import { addNoteAction, createTaskAction, sendAttachmentAction, sendMessageAction } from "@/app/actions";
import { MAX_ATTACHMENT, kindOf, sizeText } from "@/lib/attachments";
import { AttachMenu } from "@/components/chat/attach-menu";
import { EmojiButton, insertAt } from "@/components/chat/emoji";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";

type Mode = "chat" | "note" | "task";

/** amanhã às 10h, no formato do input datetime-local */
function defaultDue() {
  const d = new Date(Date.now() + 864e5);
  d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Compositor do cartão do lead e da inbox. Sem conversa ligada, o modo Chat fica indisponível. */
export function Composer({
  slug,
  leadId,
  conversationId,
  channelName,
  windowClosed,
  taskTypes,
  users,
  me,
}: {
  slug: string;
  leadId: string | null;
  conversationId: string | null;
  channelName?: string;
  windowClosed?: boolean;
  taskTypes: { id: string; name: string }[];
  users: { id: string; name: string }[];
  me: string;
}) {
  const [mode, setMode] = useState<Mode>(conversationId ? "chat" : "note");
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  // id estável por mensagem: o mesmo em reenvios, novo depois de um envio que deu certo
  const clientId = useRef<string | null>(null);
  const due = useRef<HTMLInputElement>(null);
  const [taskType, setTaskType] = useState(taskTypes[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [owner, setOwner] = useState(me);

  const modes: { v: Mode; label: string; off?: boolean }[] = [
    { v: "chat", label: "Mensagem", off: !conversationId },
    { v: "note", label: "Nota", off: !leadId },
    { v: "task", label: "Tarefa", off: !leadId },
  ];
  const blocked = mode === "chat" && windowClosed;
  const canSend = mode === "task" ? true : !!text.trim() || (mode === "chat" && !!file);

  function pickFile(f: File | undefined) {
    setError(undefined);
    if (!f) return;
    if (f.size > MAX_ATTACHMENT) return setError("Arquivo grande demais: o limite é 4 MB.");
    if (!kindOf(f.type)) return setError("Esse tipo de arquivo não é aceito. Use foto, áudio, vídeo, PDF ou documento do Office.");
    setFile(f);
  }

  function submit() {
    if (pending || blocked || !canSend) return;
    setError(undefined);
    start(async () => {
      let r;
      if (mode === "chat" && file) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("caption", text);
        fd.set("clientId", (clientId.current ??= crypto.randomUUID()));
        r = await sendAttachmentAction(slug, conversationId!, fd);
      } else if (mode === "chat") r = await sendMessageAction(slug, conversationId!, text, (clientId.current ??= crypto.randomUUID()));
      else if (mode === "note") r = await addNoteAction(slug, leadId!, text);
      else {
        const v = due.current?.value;
        if (!v) return setError("Escolha o prazo da tarefa.");
        r = await createTaskAction(slug, { leadId, text, dueAt: new Date(v).toISOString(), taskTypeId: taskType || null, responsibleUserId: owner });
      }
      if (!r.ok) return setError(r.error);
      setText("");
      setFile(null);
      clientId.current = null;
    });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  }


  return (
    <div className="shrink-0 border-t border-border bg-bg p-3" data-editing={text || file ? "" : undefined}>
      <div className="rounded-md border border-border-input focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/30">
        <div role="tablist" aria-label="O que registrar" className="flex gap-4 border-b border-border px-3">
          {modes.map((m) => (
            <button
              key={m.v}
              role="tab"
              type="button"
              aria-selected={mode === m.v}
              disabled={m.off}
              onClick={() => setMode(m.v)}
              className={cn(
                "-mb-px h-9 border-b-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40",
                mode === m.v ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {m.label}
            </button>
          ))}
          {mode === "chat" && channelName && <span className="ml-auto self-center truncate text-xs text-muted">via {channelName}</span>}
        </div>

        {blocked && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-warning-soft px-3 py-2 text-sm text-warning">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-4" aria-hidden /> Passaram 24h desde a última mensagem do cliente. Só modelos aprovados.
            </span>
            <Button size="sm" variant="secondary" icon={<FileText className="size-4" aria-hidden />} disabled title="Modelos chegam com o WhatsApp">
              Escolher modelo
            </Button>
          </div>
        )}

        {mode === "task" && (
          <div className="grid gap-2 px-3 pt-2 sm:grid-cols-3">
            <Field ref={due} label="Prazo" type="datetime-local" defaultValue={defaultDue()} />
            <div className="flex flex-col gap-1">
              <label htmlFor="task-type" className="text-sm font-medium text-fg">
                Tipo
              </label>
              <select id="task-type" value={taskType} onChange={(e) => setTaskType(e.target.value)} className="h-9 rounded-sm border border-border-input bg-bg px-2 text-base">
                {taskTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="task-owner" className="text-sm font-medium text-fg">
                Para
              </label>
              <select id="task-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 rounded-sm border border-border-input bg-bg px-2 text-base">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {mode === "chat" && file && (
          <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 text-sm">
            <Paperclip className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-fg">{file.name}</span>
            <span className="shrink-0 text-xs text-muted">{sizeText(file.size)}</span>
            <button type="button" aria-label="Tirar o anexo" onClick={() => setFile(null)} className="grid size-6 place-items-center rounded-pill text-muted hover:bg-canvas hover:text-fg">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )}

        <label htmlFor="composer-text" className="sr-only">
          {mode === "chat" ? "Mensagem para o cliente" : mode === "note" ? "Nota interna" : "Descrição da tarefa"}
        </label>
        <textarea
          ref={textRef}
          id="composer-text"
          rows={2}
          value={text}
          disabled={blocked}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={
            mode === "chat" ? (file ? "Legenda (opcional)" : "Escreva para o cliente…") : mode === "note" ? "Só a equipe vê esta nota" : "O que precisa ser feito? (opcional)"
          }
          className={cn("block max-h-48 w-full resize-y bg-transparent px-3 py-2 text-base text-fg outline-none placeholder:text-muted disabled:bg-surface", mode === "note" && "bg-bubble-note")}
        />
        <div className="flex items-center gap-2 px-3 pb-2">
          {mode === "chat" && <AttachMenu disabled={blocked || pending} onFile={pickFile} label="Anexar foto ou arquivo" />}
          <EmojiButton disabled={blocked} onPick={(e) => setText((t) => insertAt(textRef.current, t, e))} />
          <span className="hidden text-xs text-muted sm:inline">Ctrl + Enter envia</span>
          {error && (
            <span role="alert" className="text-sm text-danger">
              {error}
            </span>
          )}
          <Button size="sm" className="ml-auto" onClick={submit} loading={pending} disabled={!canSend || blocked} icon={<Send className="size-4" aria-hidden />}>
            {mode === "chat" ? "Enviar" : mode === "note" ? "Salvar nota" : "Criar tarefa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
