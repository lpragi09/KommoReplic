"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/cn";
import { Moon, Sun, Monitor } from "@/components/ui/icons";

/* Escolha do tema (Meu perfil) e troca rápida (menu da conta). */

const EVENT = "netzer-tema";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "escuro" || v === "auto" ? v : "claro";
  } catch {
    return "claro";
  }
}

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* navegador sem armazenamento: vale só nesta aba */
  }
  const dark = pref === "escuro" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readPref() === "auto") applyTheme("auto");
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  mq.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
    mq.removeEventListener("change", onSystem);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "claro" as ThemePref);
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  return { pref, dark };
}

const OPTIONS: { v: ThemePref; label: string; icon: typeof Sun }[] = [
  { v: "claro", label: "Claro", icon: Sun },
  { v: "escuro", label: "Escuro", icon: Moon },
  { v: "auto", label: "Igual ao sistema", icon: Monitor },
];

export function ThemeChoice() {
  const { pref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        const on = pref === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => applyTheme(o.v)}
            className={cn(
              "flex items-center gap-3 rounded-md px-4 py-3 text-left text-sm transition-[box-shadow,background-color] duration-fast",
              on ? "bg-accent-soft font-medium text-accent-text shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-input)]",
            )}
          >
            <o.icon className="size-5" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
