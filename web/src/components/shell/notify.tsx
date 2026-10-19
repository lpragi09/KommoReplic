"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import type { NotificationItem } from "@/data/notifications";
import { markNotificationsSeenAction } from "@/app/actions";
import { when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AlarmClock, Bell, CalendarCheck, CheckCheck, ChevronRight, MessageSquare, UserPlus } from "@/components/ui/icons";

/* Notificações: sininho com prévia (menu lateral), aviso no navegador com som e a contagem no título da aba. */

export const KIND = {
  incoming: { icon: UserPlus, label: "Contato novo", tone: "bg-accent-soft text-accent-text" },
  message: { icon: MessageSquare, label: "Mensagem", tone: "bg-[color-mix(in_srgb,var(--stage-4)_18%,var(--bg))] text-accent-text" },
  task: { icon: AlarmClock, label: "Tarefa atrasada", tone: "bg-danger-soft text-danger" },
  today: { icon: CalendarCheck, label: "Tarefa de hoje", tone: "bg-warning-soft text-warning" },
} as const;

export function KindIcon({ kind, seen, size = "md" }: { kind: NotificationItem["kind"]; seen?: boolean; size?: "sm" | "md" }) {
  const k = KIND[kind];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-md", size === "sm" ? "size-8" : "size-10", seen ? "bg-surface text-muted" : k.tone)} aria-hidden>
      <k.icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

/** sininho do menu lateral: abre uma prévia das últimas, sem sair da tela */
export function NotificationBell({ slug, items, unseen, expanded, active }: { slug: string; items: NotificationItem[]; unseen: number; expanded: boolean; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const top = items.slice(0, 7);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "relative flex h-11 w-full items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-fast",
          active || open ? "bg-nav-hover text-nav-text" : "text-nav-muted hover:bg-nav-hover hover:text-nav-text",
        )}
        aria-label={unseen ? `Notificações (${unseen} novas)` : "Notificações"}
      >
        <Bell className={cn("size-5 shrink-0", unseen > 0 && "fx-ring")} weight={unseen ? "fill" : "regular"} aria-hidden />
        <span className={cn(!expanded && "sr-only")}>Notificações</span>
        {unseen > 0 &&
          (expanded ? (
            <span className="ml-auto rounded-pill bg-accent px-1.5 text-xs font-semibold tabular-nums text-on-accent">{unseen > 99 ? "99+" : unseen}</span>
          ) : (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-pill bg-accent px-1 text-[10px] font-semibold leading-4 tabular-nums text-on-accent" aria-hidden>
              {unseen > 9 ? "9+" : unseen}
            </span>
          ))}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="right" align="end" sideOffset={10} className="fx-pop z-50 w-[22rem] overflow-hidden rounded-lg border border-border bg-bg shadow-pop">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="flex-1 text-sm font-semibold text-fg">Notificações</h2>
            {unseen > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => void (await markNotificationsSeenAction(slug)))}
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-accent-text hover:bg-accent-soft disabled:opacity-60"
              >
                <CheckCheck className="size-3.5" aria-hidden /> Marcar como lidas
              </button>
            )}
          </div>
          {top.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="grid size-11 place-items-center rounded-pill bg-surface text-muted" aria-hidden>
                <Bell className="size-5" />
              </span>
              <p className="text-sm font-medium text-fg">Tudo em dia</p>
              <p className="text-xs text-muted">Contatos novos, mensagens e tarefas aparecem aqui.</p>
            </div>
          ) : (
            <ul className="max-h-[26rem] overflow-y-auto py-1">
              {top.map((n) => (
                <li key={n.kind + n.id}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-2.5 hover:bg-surface">
                    <KindIcon kind={n.kind} seen={n.seen} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm text-fg", !n.seen && "font-semibold")}>{n.text}</span>
                      <span className="block truncate text-xs text-muted">{n.sub || KIND[n.kind].label}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <time className="text-[11px] text-muted" suppressHydrationWarning>
                        {n.at && n.kind !== "today" && when(n.at)}
                      </time>
                      {!n.seen && n.kind !== "today" && <span className="size-2 rounded-pill bg-accent" aria-label="nova" />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/${slug}/notifications`} onClick={() => setOpen(false)} className="flex items-center justify-center gap-1 border-t border-border px-4 py-2.5 text-sm font-medium text-accent-text hover:bg-surface">
            Ver todas {items.length > top.length && `(${items.length})`} <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---------- aviso no navegador ---------- */
const PREF = "netzer-avisos";
const EV = "netzer-avisos";
const readPref = () => {
  try {
    return localStorage.getItem(PREF) === "1" && typeof Notification !== "undefined" && Notification.permission === "granted";
  } catch {
    return false;
  }
};
const sub = (cb: () => void) => {
  window.addEventListener(EV, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EV, cb);
    window.removeEventListener("storage", cb);
  };
};

/** bipe curto e discreto (sem arquivo de áudio) */
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    o.onended = () => void ctx.close();
  } catch {
    /* sem áudio: só o aviso */
  }
}

/** título da aba com a contagem e, se a pessoa ligou, aviso do sistema + som quando chega algo novo */
export function BrowserAlerts({ unseen, latest }: { unseen: number; latest: NotificationItem | null }) {
  const on = useSyncExternalStore(sub, readPref, () => false);
  const last = useRef<string | null>(null);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unseen > 0 ? `(${unseen > 99 ? "99+" : unseen}) ${base}` : base;
  });

  useEffect(() => {
    const key = latest && !latest.seen ? latest.kind + latest.id + latest.at : null;
    if (last.current === null) {
      last.current = key ?? ""; // primeira carga: não avisa o que já estava lá
      return;
    }
    if (!key || key === last.current) return;
    last.current = key;
    if (!on || !latest) return;
    beep();
    if (document.visibilityState !== "visible") {
      const n = new Notification(latest.text, { body: latest.sub, tag: key, icon: "/icon.svg" });
      n.onclick = () => {
        window.focus();
        window.location.href = latest.href;
      };
    }
  }, [latest, on]);
  return null;
}

/** botão da tela de notificações para ligar/desligar o aviso no navegador */
export function AlertsToggle() {
  const on = useSyncExternalStore(sub, readPref, () => false);
  const [denied, setDenied] = useState(false);
  const toggle = async () => {
    if (typeof Notification === "undefined") return setDenied(true);
    if (on) {
      localStorage.setItem(PREF, "0");
    } else {
      const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (p !== "granted") return setDenied(true);
      localStorage.setItem(PREF, "1");
      beep();
    }
    window.dispatchEvent(new Event(EV));
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => void toggle()}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium shadow-[inset_0_0_0_1px_var(--border)] transition-colors duration-fast",
          on ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_var(--accent)]" : "bg-bg text-fg hover:bg-surface",
        )}
      >
        <Bell className="size-4" weight={on ? "fill" : "regular"} aria-hidden />
        {on ? "Aviso no navegador ligado" : "Avisar no navegador"}
      </button>
      {denied && <p className="text-xs text-danger">O navegador bloqueou os avisos. Libere nas configurações do site (cadeado na barra de endereço).</p>}
    </div>
  );
}
