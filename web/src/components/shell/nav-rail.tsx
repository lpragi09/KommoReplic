"use client";

import { useState } from "react";
import {
  Bell,
  Bot,
  CalendarDays,
  ChartColumn,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Columns3,
  Contact,
  House,
  MessageSquare,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Badge } from "@/components/ui/bits";

type Item = { id: string; label: string; icon: LucideIcon; badge?: number };

const groups: { label: string; items: Item[] }[] = [
  { label: "Início", items: [{ id: "home", label: "Início", icon: House }] },
  { label: "Comunicação", items: [{ id: "inbox", label: "Caixa de entrada", icon: MessageSquare, badge: 4 }] },
  { label: "Vendas", items: [{ id: "leads", label: "Funis", icon: Columns3 }] },
  { label: "Agenda", items: [{ id: "calendar", label: "Calendário", icon: CalendarDays }] },
  { label: "Listas", items: [{ id: "lists", label: "Contatos e empresas", icon: Contact }] },
  { label: "Automações", items: [{ id: "automations", label: "Automações", icon: Bot }] },
  { label: "Insights", items: [{ id: "insights", label: "Painel e relatórios", icon: ChartColumn }] },
];

export function NavRail({ active = "leads", defaultExpanded = false }: { active?: string; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <nav
      aria-label="Principal"
      className={cn(
        "flex h-full shrink-0 flex-col bg-nav-bg py-3 text-nav-text transition-[width] duration-base ease-out",
        expanded ? "w-[var(--nav-expanded)]" : "w-[var(--nav-collapsed)]",
      )}
    >
      <div className="mb-4 flex h-8 items-center gap-2 px-4">
        {/* marca provisória: troca no replica-brand */}
        <span className="grid size-8 place-items-center rounded-sm bg-accent text-sm font-bold text-on-accent">C</span>
        {expanded && <span className="text-md font-semibold">CRM</span>}
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 px-2">
        {groups.flatMap((g) => g.items).map((it) => {
          const on = it.id === active;
          return (
            <li key={it.id}>
              <a
                href="#"
                aria-current={on ? "page" : undefined}
                title={expanded ? undefined : it.label}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-fast",
                  on ? "bg-nav-hover text-nav-text" : "text-nav-muted hover:bg-nav-hover hover:text-nav-text",
                )}
              >
                {on && <span className="absolute left-0 top-2 h-6 w-[3px] rounded-r-xs bg-nav-active" aria-hidden />}
                <it.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className={cn(!expanded && "sr-only")}>{it.label}</span>
                {it.badge != null &&
                  (expanded ? (
                    <Badge className="ml-auto">{it.badge}</Badge>
                  ) : (
                    <Badge tone="dot" className="absolute right-2 top-2" />
                  ))}
              </a>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-0.5 px-2">
        {[
          { label: "Buscar", icon: Search },
          { label: "Notificações", icon: Bell },
          { label: "Ajuda", icon: CircleHelp },
        ].map((it) => (
          <button
            key={it.label}
            type="button"
            title={expanded ? undefined : it.label}
            className="flex h-10 items-center gap-3 rounded-sm px-3 text-sm text-nav-muted hover:bg-nav-hover hover:text-nav-text"
          >
            <it.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className={cn(!expanded && "sr-only")}>{it.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex h-10 items-center gap-3 rounded-sm px-3 text-sm text-nav-muted hover:bg-nav-hover hover:text-nav-text"
        >
          {expanded ? <ChevronsLeft className="size-5" aria-hidden /> : <ChevronsRight className="size-5" aria-hidden />}
          <span className={cn(!expanded && "sr-only")}>{expanded ? "Recolher menu" : "Expandir menu"}</span>
        </button>
        <div className="mt-2 flex items-center gap-3 px-2">
          <Avatar name="Ana Souza" size={32} />
          {expanded && <span className="truncate text-sm">Ana Souza</span>}
        </div>
      </div>
    </nav>
  );
}
