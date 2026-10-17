"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Foto ou iniciais. As fotos da equipe chegam uma vez pelo menu lateral (AvatarSeed) e ficam num
   cadastro aqui no navegador: qualquer Avatar com o mesmo nome (ou email) mostra a foto. */

let photos: Record<string, string> = {};
const subs = new Set<() => void>();
const keyOf = (s: string) => s.trim().toLowerCase();

export function AvatarSeed({ people }: { people: { name: string; email?: string; avatar?: string | null }[] }) {
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of people) {
      if (!p.avatar) continue;
      if (p.name) next[keyOf(p.name)] = p.avatar;
      if (p.email) next[keyOf(p.email)] = p.avatar;
    }
    photos = next;
    subs.forEach((f) => f());
  }, [people]);
  return null;
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export function Avatar({ name, size = 32, badge, src, round }: { name: string; size?: 20 | 24 | 32 | 40 | 48 | 64 | 96; badge?: ReactNode; src?: string | null; round?: boolean }) {
  const known = useSyncExternalStore(
    subscribe,
    () => photos[keyOf(name)],
    () => undefined,
  );
  const photo = src ?? known;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const dim = { 20: "size-5 text-[9px]", 24: "size-6 text-[10px]", 32: "size-8 text-xs", 40: "size-10 text-sm", 48: "size-12 text-base", 64: "size-16 text-xl", 96: "size-24 text-3xl" }[size];
  return (
    <span className="relative inline-flex shrink-0">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL pequena, sem otimização a fazer
        <img src={photo} alt="" aria-hidden className={cn("object-cover", round ? "rounded-pill" : "rounded-sm", dim)} />
      ) : (
        <span className={cn("inline-flex items-center justify-center bg-canvas font-semibold text-fg", round ? "rounded-pill" : "rounded-sm", dim)} aria-hidden>
          {initials}
        </span>
      )}
      <span className="sr-only">{name}</span>
      {badge && <span className="absolute -bottom-0.5 -right-0.5 rounded-xs bg-bg p-px">{badge}</span>}
    </span>
  );
}
