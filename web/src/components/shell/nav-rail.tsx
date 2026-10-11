"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import {
  Bell,
  Bot,
  CalendarDays,
  ChartColumn,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Contact,
  House,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Badge } from "@/components/ui/bits";
import { signOutAction } from "@/app/actions";
import { BRAND } from "@/lib/brand";

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

export function NavRail({
  slug,
  userName,
  workspaceName,
  unread = 0,
  incoming = 0,
}: {
  slug: string;
  userName: string;
  workspaceName: string;
  unread?: number;
  incoming?: number;
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
    { href: `${base}/reports`, label: "Relatórios", icon: ChartColumn },
  ];
  const isOn = (it: Item) => [it.href, ...(it.match ?? [])].some((h) => path === h || path.startsWith(h + "/"));
  const footer: Item[] = [
    { href: `${base}/search`, label: "Buscar", icon: Search },
    { href: `${base}/notifications`, label: "Notificações", icon: Bell },
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
            "relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-fast",
            on ? "bg-nav-hover text-nav-text" : "text-nav-muted hover:bg-nav-hover hover:text-nav-text",
          )}
        >
          {on && <span className="fx-glow absolute left-0 top-2 h-6 w-[3px] rounded-r-xs bg-nav-active" aria-hidden />}
          <it.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
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
        "hidden h-full shrink-0 flex-col bg-nav-bg py-3 text-nav-text transition-[width] duration-base ease-out md:flex",
        expanded ? "w-[var(--nav-expanded)]" : "w-[var(--nav-collapsed)]",
      )}
    >
      <div className="mb-4 flex h-8 items-center gap-2 overflow-hidden px-4">
        {/* marca provisória: troca no replica-brand */}
        <span className="fx-glow grid size-8 shrink-0 place-items-center rounded-sm bg-accent text-sm font-bold text-on-accent" aria-hidden>
          {BRAND.initial}
        </span>
        <span className={cn("truncate text-md font-semibold", !expanded && "sr-only")}>{workspaceName}</span>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 px-2">{items.map(link)}</ul>

      <ul className="flex flex-col gap-0.5 px-2">
        {footer.map(link)}
        <li>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="flex h-10 w-full items-center gap-3 rounded-sm px-3 text-sm text-nav-muted hover:bg-nav-hover hover:text-nav-text"
          >
            {expanded ? <ChevronsLeft className="size-5" aria-hidden /> : <ChevronsRight className="size-5" aria-hidden />}
            <span className={cn(!expanded && "sr-only")}>{expanded ? "Recolher menu" : "Expandir menu"}</span>
          </button>
        </li>
        <li>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="mt-1 flex w-full items-center gap-3 rounded-sm px-2 py-1 text-left hover:bg-nav-hover" aria-label={`Conta de ${userName}`}>
              <Avatar name={userName} size={32} />
              <span className={cn("truncate text-sm", !expanded && "sr-only")}>{userName}</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="end" sideOffset={8} className="z-50 min-w-48 rounded-md border border-border bg-bg p-1 shadow-pop">
                <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted">{userName}</DropdownMenu.Label>
                <DropdownMenu.Item asChild>
                  <Link href={`${base}/settings`} className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-fg outline-none data-[highlighted]:bg-surface">
                    <Settings className="size-4" aria-hidden /> Configurações
                  </Link>
                </DropdownMenu.Item>
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
            <it.icon className={cn("size-5", on && "text-stage-3")} strokeWidth={1.75} aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
