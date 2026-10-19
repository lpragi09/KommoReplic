/* Anexos na conversa: o que aceitamos e como chamar cada tipo.
   Limite de 4 MB por arquivo (a Vercel aceita até 4,5 MB por requisição). */

export type AttachmentKind = "image" | "audio" | "video" | "file";

export const MAX_ATTACHMENT = 4 * 1024 * 1024;

const ALLOWED: Record<string, AttachmentKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "audio/aac": "audio",
  "audio/amr": "audio",
  "audio/webm": "audio",
  "video/mp4": "video",
  "video/3gpp": "video",
  "application/pdf": "file",
  "text/plain": "file",
  "text/csv": "file",
  "application/msword": "file",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "file",
  "application/vnd.ms-excel": "file",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "file",
  "application/vnd.ms-powerpoint": "file",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "file",
};

/** tipo do anexo pelo mime (sem parâmetros como "; codecs=opus"); null = não aceito */
export function kindOf(mime: string): AttachmentKind | null {
  return ALLOWED[mime.split(";")[0].trim().toLowerCase()] ?? null;
}

export const ACCEPT_ATTR = Object.keys(ALLOWED).join(",");

/** nome seguro para o caminho no storage (sem barras, acentos ou espaços estranhos) */
export function safeName(name: string) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "arquivo").slice(-80);
}

export function sizeText(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
