"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AlarmClock, CalendarCheck, Check, GripVertical, Link2, Mail, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Tag } from "@/components/ui/bits";
import { IconButton } from "@/components/ui/button";

export type Stage = { id: string; name: string; color: StageColor; kind?: "open" | "won" | "lost" };
export type StageColor = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "won" | "lost";
export type Lead = {
  id: string;
  stageId: string;
  name: string;
  contact: string;
  priceCents: number;
  tags: string[];
  owner: string;
  task: { label: string; state: "ok" | "late" } | null;
  unread?: boolean;
  channel?: "whatsapp" | "instagram" | "webchat";
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/* Tailwind precisa ver as classes inteiras no código */
const stageBar: Record<StageColor, string> = {
  "1": "bg-stage-1", "2": "bg-stage-2", "3": "bg-stage-3", "4": "bg-stage-4", "5": "bg-stage-5",
  "6": "bg-stage-6", "7": "bg-stage-7", "8": "bg-stage-8", won: "bg-stage-won", lost: "bg-stage-lost",
};

export function Kanban({ stages, initialLeads, leading }: { stages: Stage[]; initialLeads: Lead[]; leading?: ReactNode }) {
  const [leads, setLeads] = useState(initialLeads);
  const [dragging, setDragging] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const stageName = (id?: string | number) => stages.find((s) => s.id === id)?.name ?? "";
  const leadName = (id: string | number) => leads.find((l) => l.id === id)?.name ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Lead ${leadName(active.id)} pego.`,
    onDragOver: ({ active, over }) => (over ? `${leadName(active.id)} sobre ${stageName(over.id)}.` : `${leadName(active.id)} fora das etapas.`),
    onDragEnd: ({ active, over }) => (over ? `${leadName(active.id)} movido para ${stageName(over.id)}.` : `${leadName(active.id)} solto sem mudar de etapa.`),
    onDragCancel: ({ active }) => `Movimento de ${leadName(active.id)} cancelado.`,
  };

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over) return;
    const to = String(e.over.id);
    setLeads((ls) => ls.map((l) => (l.id === e.active.id ? { ...l, stageId: to } : l)));
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: "Espaço para pegar o lead, setas para mover entre etapas, espaço para soltar, Esc para cancelar." },
      }}
      onDragStart={(e) => setDragging(leads.find((l) => l.id === e.active.id) ?? null)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full gap-2 overflow-x-auto bg-canvas p-3">
        {leading}
        {stages.map((s) => (
          <Column key={s.id} stage={s} leads={leads.filter((l) => l.stageId === s.id)} />
        ))}
      </div>
      <DragOverlay>{dragging && <LeadCard lead={dragging} overlay />}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, leads }: { stage: Stage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = leads.reduce((s, l) => s + l.priceCents, 0);
  return (
    <section aria-label={`${stage.name}, ${leads.length} leads`} className="flex w-[var(--kanban-column)] shrink-0 flex-col">
      <header className="mb-2 overflow-hidden rounded-md bg-bg">
        <div className={cn("h-1", stageBar[stage.color])} aria-hidden />
        <div className="flex items-center justify-between px-3 py-2">
          <div>
            <h3 className="text-caps uppercase text-fg">{stage.name}</h3>
            <p className="text-xs text-muted">
              {leads.length} {leads.length === 1 ? "lead" : "leads"} · {brl.format(total / 100)}
            </p>
          </div>
          {stage.kind !== "won" && stage.kind !== "lost" && (
            <IconButton label={`Adicionar rápido em ${stage.name}`} size={28}>
              <Plus className="size-4" />
            </IconButton>
          )}
        </div>
      </header>
      <div
        ref={setNodeRef}
        role="list"
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-md transition-colors duration-fast",
          isOver && "bg-accent-soft outline-2 outline-dashed outline-accent",
        )}
      >
        {leads.map((l) => (
          <DraggableCard key={l.id} lead={l} />
        ))}
        {leads.length === 0 && (
          <p className="rounded-md border border-dashed border-border-input px-3 py-6 text-center text-sm text-muted">
            Arraste leads para cá
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ lead }: { lead: Lead }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: lead.id });
  return (
    <div role="listitem" ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <LeadCard lead={lead} handle={{ ...attributes, ...listeners }} />
    </div>
  );
}

const channelIcon = { whatsapp: MessageCircle, instagram: MessageCircle, webchat: MessageCircle };

export function LeadCard({ lead, overlay, handle }: { lead: Lead; overlay?: boolean; handle?: Record<string, unknown> }) {
  const ChannelIcon = lead.channel ? channelIcon[lead.channel] : null;
  return (
    <article
      className={cn(
        "group relative rounded-md border border-border bg-bg p-3 shadow-card transition-colors duration-fast hover:border-border-input",
        overlay && "rotate-[1.5deg] shadow-drag",
      )}
    >
      <div className="flex items-start gap-2">
        <a href="#" className="min-w-0 flex-1 after:absolute after:inset-0">
          <h4 className={cn("line-clamp-2 text-base text-fg", lead.unread ? "font-semibold" : "font-medium")}>
            {lead.unread && <span className="mr-1.5 inline-block size-2 rounded-pill bg-accent align-middle" aria-label="Mensagem não lida" />}
            {lead.name}
          </h4>
        </a>
        {ChannelIcon && <ChannelIcon className="size-4 shrink-0 text-muted" aria-label={`Canal: ${lead.channel}`} />}
        {handle && (
          <button
            type="button"
            aria-label={`Mover ${lead.name}`}
            className="relative z-10 -mr-1 cursor-grab rounded-xs p-0.5 text-muted opacity-0 hover:bg-surface focus-visible:opacity-100 group-hover:opacity-100"
            {...handle}
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-0.5 truncate text-sm text-muted">{lead.contact}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-fg">{brl.format(lead.priceCents / 100)}</span>
        {lead.tags.slice(0, 2).map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        {lead.tags.length > 2 && <span className="text-xs text-muted">+{lead.tags.length - 2}</span>}
      </div>
      <footer className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
        {lead.task ? (
          <span className={cn("flex items-center gap-1", lead.task.state === "late" ? "text-danger" : "text-muted")}>
            {lead.task.state === "late" ? <AlarmClock className="size-3.5" aria-hidden /> : <CalendarCheck className="size-3.5" aria-hidden />}
            {lead.task.state === "late" && <span className="sr-only">Atrasada:</span>}
            {lead.task.label}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-warning">
            <AlarmClock className="size-3.5" aria-hidden /> Sem tarefa
          </span>
        )}
        <Avatar name={lead.owner} size={20} />
      </footer>
    </article>
  );
}

export type Incoming = { id: string; kind: "chat" | "call" | "email" | "form"; who: string; preview: string; at: string };
const kindIcon = { chat: MessageCircle, call: Phone, email: Mail, form: CalendarCheck };
const kindLabel = { chat: "Mensagem", call: "Chamada", email: "Email", form: "Formulário" };

export function IncomingColumn({ items }: { items: Incoming[] }) {
  const counts = items.reduce<Record<string, number>>((a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a), {});
  return (
    <section aria-label={`Leads de entrada, ${items.length}`} className="flex w-[var(--kanban-column)] shrink-0 flex-col">
      <header className="mb-2 rounded-md border border-dashed border-border-input bg-surface px-3 py-2">
        <h3 className="text-caps uppercase text-fg">Leads de entrada</h3>
        <div className="mt-1 flex gap-3 text-xs text-muted">
          {(Object.keys(kindIcon) as Incoming["kind"][]).map((k) => {
            const Icon = kindIcon[k];
            return (
              <span key={k} className="flex items-center gap-1" title={kindLabel[k]}>
                <Icon className="size-3.5" aria-hidden />
                <span className="sr-only">{kindLabel[k]}:</span>
                {counts[k] ?? 0}
              </span>
            );
          })}
        </div>
      </header>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <IncomingCard key={i.id} item={i} />
        ))}
      </ul>
    </section>
  );
}

function IncomingCard({ item }: { item: Incoming }) {
  const Icon = kindIcon[item.kind];
  return (
    <li className="group rounded-md border border-border bg-bg p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-accent" aria-label={kindLabel[item.kind]} />
        <span className="flex-1 truncate text-base font-medium text-fg">{item.who}</span>
        <time className="text-xs text-muted">{item.at}</time>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{item.preview}</p>
      {/* sempre visível no foco e em telas de toque; no desktop aparece no hover */}
      <div className="mt-2 flex justify-end gap-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        <IconButton label={`Aceitar ${item.who}`} tone="success" size={28}>
          <Check className="size-4" />
        </IconButton>
        <IconButton label={`Vincular ${item.who} a um lead existente`} tone="accent" size={28}>
          <Link2 className="size-4" />
        </IconButton>
        <IconButton label={`Excluir ${item.who}`} tone="danger" size={28}>
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </li>
  );
}
