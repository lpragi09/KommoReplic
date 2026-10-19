"use client";

import { Fragment, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { Bell, Bot, CalendarDays, ChartColumn, ChevronsLeft, ChevronsRight, Columns3, Contact, House, LogOut, MessageSquare, Search, Settings, type LucideIcon, UserCircle, Moon, Sun, Sparkle } from "@/components/ui/icons";
import { applyTheme, useTheme } from "@/components/theme/theme";
import { NotificationBell } from "@/components/shell/notify";
import type { NotificationItem } from "@/data/notifications";
import { cn } from "@/lib/cn";
import { Avatar, Badge } from "@/components/ui/bits";
import { signOutAction } from "@/app/actions";
import { BRAND } from "@/lib/brand";
import { NetzerMark } from "@/components/brand/logo";

/* preferência de menu aberto/fechado: só conveniência local, sem servidor */
const NAV_KEY = "nav-expanded";
let navMemory = false;
const navListeners = new Set<() => void>();
function readNav() {
  try {
    return localStorage.getItem(NAV_KEY) === "1";
  } catch {
    return navMemory;
  }
}
function writeNav(v: boolean) {
  navMemory = v;
  try {
    localStorage.setItem(NAV_KEY, v ? "1" : "0");
  } catch {}
  navListeners.forEach((l) => l());
}
function subscribeNav(l: () => void) {
  navListeners.add(l);
  return () => navListeners.delete(l);
}

type Item = { href: string; label: string; icon: LucideIcon; badge?: number; match?: string[] };

const friendly = (n: string) => (n.includes("@") ? n.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : n);

export function NavRail({
  slug,
  userName,
  userAvatar,
  workspaceName,
  unread = 0,
  incoming = 0,
  notifications = 0,
  notificationItems = [],
}: {
  slug: string;
  userName: string;
  userAvatar?: string | null;
  workspaceName: string;
  unread?: number;
  incoming?: number;
  /** notificações que a pessoa ainda não viu */
  notifications?: number;
  /** últimas notificações para a prévia do sino */
  notificationItems?: NotificationItem[];
}) {
  const path = usePathname();
  const expanded = useSyncExternalStore(subscribeNav, readNav, () => false);
  const toggle = () => writeNav(!expanded);

  const base = `/${slug}`;
  const items: Item[] = [
    { href: `${base}/home`, label: "Início", icon: House },
    { href: `${base}/inbox`, label: "Caixa de entrada", icon: MessageSquare, badge: unread, match: [`${base}/team-chat`] },
    { href: `${base}/leads`, label: "Funis", icon: Columns3, badge: incoming },
    { href: `${base}/calendar`, label: "Calendário", icon: CalendarDays },
    { href: `${base}/contacts`, label: "Contatos e empresas", icon: Contact, match: [`${base}/companies`] },
    { href: `${base}/automations`, label: "Automações", icon: Bot, match: [`${base}/templates`, `${base}/broadcasts`] },
    { href: `${base}/settings/ai`, label: "Agente de IA", icon: Sparkle },
    { href: `${base}/reports`, label: "Estatísticas", icon: ChartColumn },
  ];
  // o Agente de IA mora dentro de Configurações, mas acende só o próprio item
  const isOn = (it: Item) =>
    [it.href, ...(it.match ?? [])].some((h) => path === h || path.startsWith(h + "/")) && !(it.href === `${base}/settings` && path.startsWith(`${base}/settings/ai`));
  const footer: Item[] = [
    { href: `${base}/search`, label: "Buscar", icon: Search },
    { href: `${base}/settings`, label: "Configurações", icon: Settings },
  ];

  const link = (it: Item) => {
    const on = isOn(it);
    return (
      <li key={it.href}>
        <Link
          href={it.href}
          aria-current={on ? "page" : undefined}
          title={expanded ? undefined : it.label}
          className={cn(
            "relative flex h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-fast",
            on ? "bg-nav-active/15 text-nav-text shadow-[inset_0_0_0_1px_rgba(91,138,246,.25)]" : "text-nav-muted hover:bg-nav-hover hover:text-nav-text",
          )}
        >
          {on && <span className="fx-glow absolute -left-2 top-2.5 h-6 w-[3px] rounded-r-xs bg-nav-active" aria-hidden />}
          <it.icon className={cn("size-5 shrink-0", on && "text-stage-3")} weight={on ? "fill" : "regular"} aria-hidden />
          <span className={cn(!expanded && "sr-only")}>{it.label}</span>
          {!!it.badge &&
            (expanded ? (
              <Badge className="ml-auto">{it.badge}</Badge>
            ) : (
              <>
                <Badge tone="dot" className="absolute right-2 top-2" />
                <span className="sr-only">({it.badge} novos)</span>
              </>
            ))}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Principal"
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-nav-hover bg-[linear-gradient(180deg,var(--nav-bg)_0%,var(--night-raised)_100%)] py-3 text-nav-text transition-[width] duration-base ease-out md:flex",
        expanded ? "w-[var(--nav-expanded)]" : "w-[var(--nav-collapsed)]",
      )}
    >
      <div className="mb-4 flex h-8 items-center gap-2 overflow-hidden px-4">
        <span className="grid size-8 shrink-0 place-items-center" title={BRAND.name}>
          <NetzerMark className="h-7 w-auto text-brand-on-night" />
        </span>
        <span className={cn("truncate text-md font-semibold", !expanded && "sr-only")}>{workspaceName}</span>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 px-2">
        {items.map((it, i) => (
          <Fragment key={it.href}>
            {/* divisórias finas entre os grupos: início | trabalho do dia | configurar e analisar */}
            {(i === 1 || i === 5) && <li aria-hidden className="mx-3 my-2 h-px bg-nav-hover" />}
            {link(it)}
          </Fragment>
        ))}
      </ul>

      <ul className="flex flex-col gap-0.5 px-2">
        {footer.slice(0, 1).map(link)}
        <li>
          <NotificationBell slug={slug} items={notificationItems} unseen={notifications} expanded={expanded} active={path.startsWith(`${base}/notifications`)} />
        </li>
        {footer.slice(1).map(link)}
        <li>
          <ThemeButton expanded={expanded} />
        </li>
        <li>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="flex h-11 w-full items-center gap-3 rounded-sm px-3 text-sm text-nav-muted hover:bg-nav-hover hover:text-nav-text"
          >
            {expanded ? <ChevronsLeft className="size-5" aria-hidden /> : <ChevronsRight className="size-5" aria-hidden />}
            <span className={cn(!expanded && "sr-only")}>{expanded ? "Recolher menu" : "Expandir menu"}</span>
          </button>
        </li>
        <li>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="mt-1 flex w-full items-center gap-3 rounded-sm px-2 py-1 text-left hover:bg-nav-hover" aria-label={`Conta de ${userName}`}>
              <Avatar name={friendly(userName)} size={32} src={userAvatar} />
              <span className={cn("min-w-0 flex-col text-left", expanded ? "flex" : "sr-only")}>
                <span className="truncate text-sm text-nav-text">{friendly(userName)}</span>
                {userName.includes("@") && <span className="truncate text-xs text-nav-muted">{userName}</span>}
              </span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="end" sideOffset={8} className="z-50 min-w-48 rounded-md border border-border bg-bg p-1 shadow-pop">
                <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted">{userName}</DropdownMenu.Label>
                <DropdownMenu.Item asChild>
                  <Link href={`${base}/settings/profile`} className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-fg outline-none data-[highlighted]:bg-surface">
                    <UserCircle className="size-4" aria-hidden /> Meu perfil e foto
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link href={`${base}/settings`} className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-fg outline-none data-[highlighted]:bg-surface">
                    <Settings className="size-4" aria-hidden /> Configurações
                  </Link>
                </DropdownMenu.Item>
                <ThemeMenuItem />
                <DropdownMenu.Item
                  onSelect={() => signOutAction()}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                >
                  <LogOut className="size-4" aria-hidden /> Sair
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </li>
      </ul>
    </nav>
  );
}

/** botão claro/escuro à vista no menu lateral */
function ThemeButton({ expanded }: { expanded: boolean }) {
  const { dark } = useTheme();
  return (
    <button
      type="button"
      onClick={() => applyTheme(dark ? "claro" : "escuro")}
      aria-pressed={dark}
      className="flex h-11 w-full items-center gap-3 rounded-sm px-3 text-sm text-nav-muted hover:bg-nav-hover hover:text-nav-text"
    >
      {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      <span className={cn(!expanded && "sr-only")}>Modo escuro</span>
    </button>
  );
}

/** troca rápida claro/escuro no menu da conta (a escolha completa, com "igual ao sistema", fica em Meu perfil) */
function ThemeMenuItem() {
  const { dark } = useTheme();
  return (
    <DropdownMenu.Item
      onSelect={(e) => {
        e.preventDefault();
        applyTheme(dark ? "claro" : "escuro");
      }}
      className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-fg outline-none data-[highlighted]:bg-surface"
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />} {dark ? "Modo claro" : "Modo escuro"}
    </DropdownMenu.Item>
  );
}

/** Barra inferior no celular (< 768px): as 4 seções mais usadas + mais. */
export function MobileNav({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/${slug}`;
  const items = [
    { href: `${base}/leads`, label: "Funis", icon: Columns3 },
    { href: `${base}/inbox`, label: "Conversas", icon: MessageSquare },
    { href: `${base}/calendar`, label: "Agenda", icon: CalendarDays },
    { href: `${base}/contacts`, label: "Contatos", icon: Contact },
    { href: `${base}/search`, label: "Buscar", icon: Search },
  ];
  return (
    <nav aria-label="Principal" className="flex h-14 shrink-0 border-t border-nav-hover bg-nav-bg md:hidden">
      {items.map((it) => {
        const on = path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 text-xs", on ? "text-nav-text" : "text-nav-muted")}
          >
            <it.icon className={cn("size-5", on && "text-stage-3")} weight={on ? "fill" : "regular"} aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
