"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { setLogoAction, setMyAvatarAction } from "@/app/actions";
import { Pencil, Trash2 } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** recorta o centro em quadrado e reduz para 160px (webp; jpeg se o navegador não fizer webp) */
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 160, 160);
  const webp = c.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", 0.85);
}

/** quadrado clicável que troca a foto. kind: "me" (minha foto) ou "logo" (empresa) */
export function PhotoPicker({ slug, kind, current, fallback, className, label }: { slug: string; kind: "me" | "logo"; current: string | null; fallback: ReactNode; className?: string; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (v: string | null) =>
    start(async () => {
      const r = kind === "me" ? await setMyAvatarAction(slug, v) : await setLogoAction(slug, v);
      if (!r.ok) return setError(r.error);
      setError(null);
      setPhoto(v);
    });
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        title={label}
        className={cn("group relative grid shrink-0 place-items-center overflow-hidden", className, pending && "opacity-60")}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL pequena
          <img src={photo} alt="" className="size-full object-cover" />
        ) : (
          fallback
        )}
        <span className="absolute inset-0 grid place-items-center bg-[rgba(10,10,11,.55)] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Pencil className="size-5" aria-hidden />
        </span>
        <span className="sr-only">{label}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) return setError("Imagem grande demais (máximo 8 MB).");
          try {
            save(await shrink(f));
          } catch {
            setError("Não deu para ler essa imagem. Tente uma JPG ou PNG.");
          }
        }}
      />
      {photo && (
        <button type="button" onClick={() => save(null)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-danger">
          <Trash2 className="size-3.5" aria-hidden /> Remover
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
