import { FileText } from "@/components/ui/icons";
import { sizeText } from "@/lib/attachments";
import { cn } from "@/lib/cn";

type File = { name: string; mime: string; size: number; url: string | null };

/** anexo dentro do balão: foto (abre em nova aba), áudio e vídeo com player, documento para baixar */
export function AttachmentView({ file, kind, tone = "light" }: { file: File; kind?: string; tone?: "light" | "accent" }) {
  if (!file.url)
    return <p className="text-sm italic text-muted">Arquivo indisponível ({file.name})</p>;
  if (kind === "image")
    return (
      <a href={file.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md">
        {/* link assinado e temporário do storage: next/image não ajuda aqui */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.url} alt={file.name} className="max-h-72 w-auto max-w-full object-contain" loading="lazy" />
        <span className="sr-only">(abre a imagem em nova aba)</span>
      </a>
    );
  if (kind === "audio")
    return (
      <audio controls preload="none" src={file.url} className="w-64 max-w-full">
        <a href={file.url}>Baixar áudio</a>
      </audio>
    );
  if (kind === "video")
    return (
      <video controls preload="metadata" src={file.url} className="max-h-72 w-auto max-w-full rounded-md">
        <a href={file.url}>Baixar vídeo</a>
      </video>
    );
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      download={file.name}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm",
        tone === "accent" ? "bg-[color-mix(in_srgb,white_18%,transparent)] text-on-accent" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-canvas",
      )}
    >
      <FileText className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{file.name}</span>
        <span className={cn("text-xs", tone === "accent" ? "text-on-accent/80" : "text-muted")}>{sizeText(file.size)}</span>
      </span>
    </a>
  );
}
