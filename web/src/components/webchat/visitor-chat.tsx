"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Send } from "@/components/ui/icons";
import { visitorSendAction, visitorThreadAction, visitorUploadAction } from "@/app/actions";
import { MAX_ATTACHMENT, kindOf } from "@/lib/attachments";
import { AttachMenu } from "@/components/chat/attach-menu";
import { fromSearch } from "@/lib/utm";
import { timeOnly } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { AttachmentView } from "@/components/chat/attachment";
import { EmojiButton, insertAt } from "@/components/chat/emoji";

type M = { id: string; direction: "in" | "out"; body: string; sentAt: string; kind?: string; file?: { name: string; mime: string; size: number; url: string | null } | null };

let cachedVisitor: string | null = null;
/** UTMs da URL do chat (vindas do anúncio ou do script do site), lidas uma vez no navegador */
function pageOrigin(): Record<string, string> | undefined {
  if (typeof window === "undefined") return undefined;
  const q = new URLSearchParams(window.location.search);
  const o: Record<string, string> = { ...fromSearch(q) };
  const landing = q.get("landing");
  const ref = q.get("ref") || document.referrer;
  if (landing) o.landing = landing.slice(0, 300);
  if (ref) o.referrer = ref.slice(0, 300);
  if (q.get("via") === "site") o.via = "site";
  return Object.keys(o).length ? o : undefined;
}

function visitorId() {
  if (cachedVisitor) return cachedVisitor;
  try {
    const k = "crm-visitor";
    cachedVisitor = localStorage.getItem(k);
    if (!cachedVisitor) {
      cachedVisitor = `v-${crypto.randomUUID()}`;
      localStorage.setItem(k, cachedVisitor);
    }
  } catch {
    cachedVisitor ??= `v-${crypto.randomUUID()}`; // sem storage: a conversa vale só nesta aba
  }
  return cachedVisitor;
}
const noSubscribe = () => () => {};

export function VisitorChat({ publicKey, workspaceName }: { publicKey: string; workspaceName: string }) {
  const vid = useSyncExternalStore(noSubscribe, visitorId, () => null);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const end = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!vid) return;
    let alive = true;
    const load = () => visitorThreadAction(publicKey, vid).then((m) => alive && setMsgs(m as M[]));
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [vid, publicKey]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  function send() {
    if (!vid || !text.trim()) return;
    setError(undefined);
    const body = text;
    start(async () => {
      const r = await visitorSendAction({ publicKey, visitorId: vid, name, body, messageId: crypto.randomUUID(), attribution: pageOrigin() });
      if (!r.ok) return setError(r.error);
      setText("");
      setMsgs((await visitorThreadAction(publicKey, vid)) as M[]);
    });
  }

  /** arquivo vai na hora, com o texto digitado como legenda */
  function upload(f: File | undefined) {
    if (!vid || !f) return;
    setError(undefined);
    if (f.size > MAX_ATTACHMENT) return setError("Arquivo grande demais: o limite é 4 MB.");
    if (!kindOf(f.type)) return setError("Esse tipo de arquivo não é aceito. Mande foto, áudio, vídeo ou PDF.");
    const fd = new FormData();
    fd.set("publicKey", publicKey);
    fd.set("visitorId", vid);
    fd.set("name", name);
    fd.set("messageId", crypto.randomUUID());
    fd.set("caption", text);
    fd.set("file", f);
    start(async () => {
      const r = await visitorUploadAction(fd);
      if (!r.ok) return setError(r.error);
      setText("");
      setMsgs((await visitorThreadAction(publicKey, vid)) as M[]);
    });
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col border-x border-border bg-bg">
      <header className="fx-aurora flex items-center gap-3 px-4 py-4">
        <span className="fx-glow grid size-9 place-items-center rounded-pill bg-accent text-sm font-bold text-on-accent" aria-hidden>
          {workspaceName[0]}
        </span>
        <div>
          <h1 className="text-md">{workspaceName}</h1>
          <p className="text-xs text-on-night-muted">Respondemos por aqui mesmo</p>
        </div>
      </header>
      <ol className="flex flex-1 flex-col gap-2 overflow-y-auto bg-surface p-4" aria-live="polite">
        {msgs.length === 0 && <li className="py-10 text-center text-sm text-muted">Mande sua dúvida. Alguém da equipe responde em instantes.</li>}
        {msgs.map((m) => {
          const mine = m.direction === "in";
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-lg px-3 py-2", mine ? "rounded-br-xs bg-accent text-on-accent" : "rounded-bl-xs border border-border bg-bg text-fg")}>
                {m.file && (
                  <div className={cn(m.body && "mb-1.5")}>
                    <AttachmentView file={m.file} kind={m.kind} tone={mine ? "accent" : "light"} />
                  </div>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words text-base">{m.body}</p>}
                <p className={cn("mt-0.5 text-right text-xs", mine ? "text-on-accent/80" : "text-muted")} suppressHydrationWarning>
                  {timeOnly(m.sentAt)}
                </p>
              </div>
            </li>
          );
        })}
        <li ref={end} aria-hidden className="list-none" />
      </ol>
      <form
        className="flex flex-col gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {msgs.length === 0 && (
          <>
            <label htmlFor="vname" className="sr-only">
              Seu nome (opcional)
            </label>
            <input id="vname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Seu nome (opcional)…" className="h-9 rounded-sm border border-border-input px-2 text-base outline-none focus:border-focus" />
          </>
        )}
        <div className="flex gap-2">
          <AttachMenu className="size-10" disabled={!vid || pending} onFile={upload} label="Mandar foto ou arquivo" />
          <label htmlFor="vmsg" className="sr-only">
            Mensagem
          </label>
          <EmojiButton className="size-10" onPick={(e) => setText((t) => insertAt(textRef.current, t, e))} />
          <input ref={textRef} id="vmsg" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Escreva sua mensagem…" className="h-10 flex-1 rounded-sm border border-border-input px-3 text-base outline-none focus:border-focus" autoComplete="off" />
          <Button type="submit" size="lg" loading={pending} disabled={!text.trim() || !vid} aria-label="Enviar mensagem">
            <Send className="size-4" aria-hidden />
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
