import { cn } from "@/lib/cn";

/* Marca netzer: o broto (caule com botão no alto, dois pares de folhas e dois grãos na base).
   Desenhado em currentColor: a cor vem de quem usa (verde da netzer no claro, verde mais vivo no escuro). */
export function NetzerMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 80 104" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} fill="currentColor">
      {title && <title>{title}</title>}
      <circle cx="40" cy="8.5" r="5" />
      <rect x="37.6" y="8" width="4.8" height="94" rx="2.4" />
      {/* folhas de cima */}
      <path d="M40 38C34 28.5 24 22 10 20c5 8.5 15.5 15 30 18Z" />
      <path d="M40 38c6-9.5 16-16 30-18-5 8.5-15.5 15-30 18Z" />
      {/* folhas de baixo, maiores */}
      <path d="M40 62C33 50.5 21 42.5 3 40c6 10.5 19 18.5 37 22Z" />
      <path d="M40 62c7-11.5 19-19.5 37-22-6 10.5-19 18.5-37 22Z" />
      {/* grãos */}
      <circle cx="27.5" cy="82" r="5.6" />
      <circle cx="52.5" cy="82" r="5.6" />
    </svg>
  );
}

/** Logo completa: broto + "netzer" (horizontal quando inline, empilhada com o lema quando não) */
export function NetzerLogo({ className, inline = true, markClassName }: { className?: string; inline?: boolean; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center text-brand", inline ? "gap-2" : "flex-col gap-1", className)}>
      <NetzerMark className={cn(inline ? "h-7 w-auto" : "h-12 w-auto", markClassName)} />
      <span className={cn("flex flex-col leading-none", !inline && "items-center")}>
        <span className="font-semibold tracking-tight">netzer</span>
        {!inline && <span className="mt-1.5 text-[0.42em] font-normal tracking-[0.16em] opacity-80">da raiz à rede</span>}
      </span>
    </span>
  );
}
