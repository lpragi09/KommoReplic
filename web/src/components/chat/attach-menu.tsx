"use client";

import { useRef, useState } from "react";
import { Popover } from "radix-ui";
import { FileText, ImageIcon, Paperclip } from "@/components/ui/icons";
import { ACCEPT_ATTR } from "@/lib/attachments";
import { cn } from "@/lib/cn";

/* Clipe dos chats: abre um menu com "Foto ou vídeo" (galeria/câmera no celular) e "Arquivo" (PDF, documentos, áudio). */
const MEDIA = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/3gpp";
const FILES = ACCEPT_ATTR.split(",")
  .filter((m) => !m.startsWith("image/") && !m.startsWith("video/"))
  .join(",");

export function AttachMenu({ onFile, disabled, className, label = "Anexar" }: { onFile: (f: File | undefined) => void; disabled?: boolean; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const media = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const pick = (el: HTMLInputElement | null) => {
    setOpen(false);
    el?.click();
  };
  const input = (ref: React.RefObject<HTMLInputElement | null>, accept: string) => (
    <input
      ref={ref}
      type="file"
      accept={accept}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  const item = "flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left text-sm text-fg hover:bg-surface focus-visible:bg-surface focus-visible:outline-none";
  return (
    <>
      {input(media, MEDIA)}
      {input(files, FILES)}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            title={`${label} (até 4 MB)`}
            disabled={disabled}
            className={cn("grid size-8 shrink-0 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg disabled:opacity-40", className)}
          >
            <Paperclip className="size-5" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={8} collisionPadding={12} className="z-50 w-56 rounded-lg bg-bg p-1.5 shadow-[0_0_0_1px_var(--border),0_18px_40px_-16px_rgba(20,28,24,.45)]">
            <button type="button" className={item} onClick={() => pick(media.current)}>
              <span className="grid size-8 place-items-center rounded-md bg-accent-soft text-accent" aria-hidden>
                <ImageIcon className="size-4" />
              </span>
              <span>
                <span className="block font-medium">Foto ou vídeo</span>
                <span className="block text-xs text-muted">Da galeria ou da câmera</span>
              </span>
            </button>
            <button type="button" className={item} onClick={() => pick(files.current)}>
              <span className="grid size-8 place-items-center rounded-md bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)]" aria-hidden>
                <FileText className="size-4" />
              </span>
              <span>
                <span className="block font-medium">Arquivo</span>
                <span className="block text-xs text-muted">PDF, documento, planilha ou áudio</span>
              </span>
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
