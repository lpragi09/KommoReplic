"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

const links = [
  { href: "#como", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#precos", label: "Preços" },
  { href: "#faq", label: "Perguntas" },
];

/** Menu em "ilha": pílula de vidro solta do topo. No celular vira tela cheia com links em cascata. */
export function IslandNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-3xl items-center gap-2 rounded-pill border border-[color-mix(in_srgb,var(--on-night)_10%,transparent)] bg-[color-mix(in_srgb,var(--night)_70%,transparent)] py-1.5 pl-4 pr-1.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur-xl"
      >
        <Link href="/" className="mr-auto flex items-center gap-2 text-base font-semibold text-on-night">
          <span className="grid size-7 place-items-center rounded-sm bg-accent text-sm font-bold text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" aria-hidden>
            {BRAND.initial}
          </span>
          {BRAND.name}
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-pill px-3 py-2 text-sm text-on-night-muted transition-colors duration-fast ease-out hover:text-on-night">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <Link href="/login" className="hidden rounded-pill px-3 py-2 text-sm text-on-night hover:bg-[color-mix(in_srgb,var(--on-night)_8%,transparent)] sm:block">
          Entrar
        </Link>
        <Link href="/signup" className="fx-island hidden rounded-pill bg-on-night px-4 py-2 text-sm font-medium text-night sm:block">
          Testar grátis
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="menu-movel"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
          className="relative grid size-11 place-items-center rounded-pill text-on-night md:hidden"
        >
          <span aria-hidden className={cn("absolute h-px w-5 bg-current transition-transform duration-base ease-out", open ? "rotate-45" : "-translate-y-[4px]")} />
          <span aria-hidden className={cn("absolute h-px w-5 bg-current transition-transform duration-base ease-out", open ? "-rotate-45" : "translate-y-[4px]")} />
        </button>
      </nav>

      <div
        id="menu-movel"
        hidden={!open}
        className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--night)_88%,transparent)] px-6 pt-28 backdrop-blur-2xl md:hidden"
      >
        <ul className="flex flex-col gap-2">
          {[...links, { href: "/login", label: "Entrar" }].map((l, i) => (
            <li key={l.href} className="fx-rise" style={{ "--d": i + 1 } as CSSProperties}>
              <a href={l.href} onClick={() => setOpen(false)} className="block py-3 text-display tracking-tight text-on-night">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <Link
          href="/signup"
          onClick={() => setOpen(false)}
          className="fx-rise mt-8 inline-flex rounded-pill bg-accent px-6 py-3 text-md font-medium text-on-accent"
          style={{ "--d": 6 } as CSSProperties}
        >
          Testar 14 dias grátis
        </Link>
      </div>
    </>
  );
}
