"use client";

import {
  Fragment,
  useId,
  useOptimistic,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  CardPointerSensor,
  CardTouchSensor,
  markDragEnd,
  swallowClickAfterDrag,
} from "@/components/ui/dnd";
import { AlarmClock, CalendarCheck, Check, GripVertical, Inbox, Link2, Mail, MessageCircle, Phone, Plus, FileText, Trash2, X, XCircle } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { leadTitle, money, when } from "@/lib/format";
import type {
  IncomingLead,
  LeadCard as LeadCardT,
  LossReason,
  Stage,
} from "@/data/types";
import {
  acceptIncomingAction,
  createLeadAction,
  declineIncomingAction,
  linkIncomingAction,
  moveLeadAction,
} from "@/app/actions";
import { Avatar, Tag } from "@/components/ui/bits";
import { useToast } from "@/components/ui/interactive";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { AddStageColumn, StageMenu } from "./manage";
import { HScroll } from "@/components/ui/hscroll";

import { stageBar } from "@/lib/stage-colors";
export { stageBar };

type Column = {
  stage: Stage;
  leads: LeadCardT[];
  count: number;
  totalCents: number;
};

/** Setas ←/→ levam o card para a coluna vizinha (o padrão do dnd-kit anda só 25px). */
const jumpBetweenColumns: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft")
    return undefined;
  event.preventDefault();
  const cols = [...context.droppableRects.entries()].sort(
    (a, b) => a[1].left - b[1].left,
  );
  if (!cols.length) return undefined;
  const x = currentCoordinates.x;
  const idx = context.over
    ? cols.findIndex(([id]) => id === context.over!.id)
    : cols.findIndex(([, r]) => x >= r.left && x < r.left + r.width);
  const next =
    cols[
      Math.min(
        cols.length - 1,
        Math.max(
          0,
          (idx < 0 ? 0 : idx) + (event.code === "ArrowRight" ? 1 : -1),
        ),
      )
    ];
  return { x: next[1].left + 8, y: next[1].top + 8 };
};
type Move = { leadId: string; stageId: string };

export function Board({
  slug,
  pipelineId,
  columns,
  incoming,
  lossReasons,
  users,
  linkTargets,
}: {
  slug: string;
  pipelineId: string;
  columns: Column[];
  incoming: IncomingLead[];
  lossReasons: LossReason[];
  users: { id: string; name: string }[];
  linkTargets: { id: string; title: string }[];
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [optimistic, applyMove] = useOptimistic(
    columns,
    (cols: Column[], m: Move) => {
      const lead = cols.flatMap((c) => c.leads).find((l) => l.id === m.leadId);
      if (!lead) return cols;
      return cols.map((c) => {
        const without = c.leads.filter((l) => l.id !== m.leadId);
        const leads =
          c.stage.id === m.stageId
            ? [{ ...lead, stageId: m.stageId }, ...without]
            : without;
        return {
          ...c,
          leads,
          count: leads.length,
          totalCents: leads.reduce((s, l) => s + l.priceCents, 0),
        };
      });
    },
  );
  const dndId = useId(); // ids de acessibilidade iguais no servidor e no cliente
  const [dragging, setDragging] = useState<LeadCardT | null>(null);
  const [lost, setLost] = useState<Move | null>(null);
  const sensors = useSensors(
    // o cartão inteiro arrasta (não só a alça); toque precisa segurar 0,2s para não brigar com a rolagem
    useSensor(CardPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(CardTouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: jumpBetweenColumns }),
  );
  const owner = (id: string | null) =>
    users.find((u) => u.id === id)?.name ?? "Sem responsável";

  const all = optimistic.flatMap((c) => c.leads);
  const name = (id: string | number) => {
    const l = all.find((x) => x.id === id);
    return l ? leadTitle(l) : "";
  };
  const stageName = (id?: string | number) =>
    optimistic.find((c) => c.stage.id === id)?.stage.name ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${name(active.id)} pego.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} sobre ${stageName(over.id)}.`
        : `${name(active.id)} fora das etapas.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} solto em ${stageName(over.id)}.`
        : `${name(active.id)} solto sem mudar de etapa.`,
    onDragCancel: ({ active }) => `Movimento de ${name(active.id)} cancelado.`,
  };

  function commit(m: Move, lossReasonId?: string) {
    start(async () => {
      applyMove(m);
      const r = await moveLeadAction(slug, m.leadId, m.stageId, lossReasonId);
      if (!r.ok) toast.show({ text: r.error, tone: "error" });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    markDragEnd();
    if (!e.over) return;
    const m = { leadId: String(e.active.id), stageId: String(e.over.id) };
    const from = all.find((l) => l.id === m.leadId)?.stageId;
    if (from === m.stageId) return;
    const target = optimistic.find((c) => c.stage.id === m.stageId)?.stage;
    if (target?.kind === "lost") return setLost(m);
    commit(m);
  }

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Espaço para pegar o lead, setas para mover entre etapas, espaço para soltar, Esc para cancelar.",
          },
        }}
        onDragStart={(e) =>
          setDragging(all.find((l) => l.id === e.active.id) ?? null)
        }
        onDragCancel={() => {
          setDragging(null);
          markDragEnd();
        }}
        onDragEnd={onDragEnd}
      >
        <HScroll className="bg-surface">
        <div className="flex min-h-0 w-max min-w-full snap-x gap-3 p-4">
          <IncomingColumn
            slug={slug}
            items={incoming}
            linkTargets={linkTargets}
            onError={(t) => toast.show({ text: t, tone: "error" })}
          />
          {optimistic.map((c, i) => (
            <Fragment key={c.stage.id}>
              <ColumnView
                slug={slug}
                pipelineId={pipelineId}
                col={c}
                siblings={optimistic.map((x) => x.stage)}
                owner={owner}
                onError={(t) => toast.show({ text: t, tone: "error" })}
              />
              {/* "+ Nova etapa" depois da última etapa aberta (antes de Ganho/Perdido) */}
              {c.stage.kind === "open" && optimistic[i + 1]?.stage.kind !== "open" && (
                <AddStageColumn slug={slug} pipelineId={pipelineId} onError={(t) => toast.show({ text: t, tone: "error" })} />
              )}
            </Fragment>
          ))}
        </div>
        </HScroll>
        <DragOverlay>
          {dragging && (
            <LeadCard
              lead={dragging}
              owner={owner(dragging.responsibleUserId)}
              slug={slug}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <LostDialog
        open={!!lost}
        reasons={lossReasons}
        onCancel={() => setLost(null)}
        onConfirm={(reason) => {
          if (lost) commit(lost, reason);
          setLost(null);
        }}
      />
      {toast.node}
    </>
  );
}

export function LostDialog({
  open,
  reasons,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  reasons: LossReason[];
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  const [reason, setReason] = useState(reasons[0]?.id ?? "");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      size="sm"
      icon={<XCircle className="size-5" />}
      tone="danger"
      title="Por que este negócio foi perdido?"
      description="O motivo entra no relatório de perdas."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={!reason}
            onClick={() => onConfirm(reason)}
          >
            Marcar como perdido
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">Motivo</legend>
        {reasons.map((r) => (
          <label
            key={r.id}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-base hover:bg-surface"
          >
            <input
              type="radio"
              name="loss"
              value={r.id}
              checked={reason === r.id}
              onChange={() => setReason(r.id)}
              className="size-4 accent-[var(--accent)]"
            />
            {r.name}
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}

function ColumnView({
  slug,
  pipelineId,
  col,
  siblings,
  owner,
  onError,
}: {
  slug: string;
  pipelineId: string;
  col: Column;
  siblings: Stage[];
  owner: (id: string | null) => string;
  onError: (t: string) => void;
}) {
  const { stage, leads } = col;
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const [adding, setAdding] = useState(false);
  const closed = stage.kind !== "open";
  return (
    <section
      aria-label={`${stage.name}, ${col.count} leads`}
      className="flex w-[var(--kanban-column)] shrink-0 snap-start flex-col rounded-lg bg-[color-mix(in_srgb,var(--canvas)_60%,var(--bg))] p-1.5 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <header className="mb-1.5 px-2 pb-1 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-pill ring-2 ring-bg",
                  stageBar[stage.color],
                )}
                aria-hidden
              />
              <h2 className="truncate text-base font-semibold text-fg">
                {stage.name}
              </h2>
              <span className="rounded-xs bg-bg px-1.5 text-xs font-medium tabular-nums text-muted shadow-[inset_0_0_0_1px_var(--border)]">
                {col.count}
              </span>
            </div>
            <p className="mt-0.5 pl-[18px] text-xs tabular-nums text-muted">
              {money(col.totalCents)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {!closed && (
              <IconButton
                label={`Adicionar lead em ${stage.name}`}
                size={28}
                aria-expanded={adding}
                onClick={() => setAdding((v) => !v)}
              >
                <Plus className="size-4" />
              </IconButton>
            )}
            <StageMenu slug={slug} stage={stage} siblings={siblings} count={col.count} onError={onError} />
          </div>
        </div>
      </header>
      {adding && (
        <QuickAdd
          slug={slug}
          pipelineId={pipelineId}
          stageId={stage.id}
          onDone={() => setAdding(false)}
          onError={onError}
        />
      )}
      <ul
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-md pb-2 transition-colors duration-fast",
          isOver && "bg-accent-soft outline-2 outline-dashed outline-accent",
        )}
      >
        {leads.map((l, i) => (
          <DraggableCard
            key={l.id}
            lead={l}
            slug={slug}
            owner={owner(l.responsibleUserId)}
            index={i}
          />
        ))}
        {leads.length === 0 && !adding && (
          <li className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted">
            {closed ? "Nenhum negócio aqui ainda" : "Arraste leads para cá"}
          </li>
        )}
      </ul>
    </section>
  );
}

function QuickAdd({
  slug,
  pipelineId,
  stageId,
  onDone,
  onError,
}: {
  slug: string;
  pipelineId: string;
  stageId: string;
  onDone: () => void;
  onError: (t: string) => void;
}) {
  const [pending, start] = useTransition();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const r = await createLeadAction(slug, {
        pipelineId,
        stageId,
        name: String(f.get("name") ?? ""),
        price: String(f.get("price") ?? ""),
        contactName: String(f.get("contactName") ?? ""),
        contactPhone: String(f.get("contactPhone") ?? ""),
      });
      if (r.ok) onDone();
      else onError(r.error);
    });
  }
  return (
    <form
      onSubmit={submit}
      data-editing
      className="mb-2 flex flex-col gap-2 rounded-md border border-accent bg-bg p-3 shadow-card"
      aria-label="Adicionar lead"
    >
      <Field
        label="Nome do negócio"
        name="name"
        placeholder="Vazio vira “Lead #número”…"
        autoFocus
      />
      <Field
        label="Valor"
        name="price"
        adornment="R$"
        inputMode="decimal"
        placeholder="0,00"
      />
      <Field label="Contato" name="contactName" placeholder="Nome…" />
      <Field
        label="Telefone"
        name="contactPhone"
        type="tel"
        placeholder="+55 11 90000-0000"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          Adicionar
        </Button>
      </div>
    </form>
  );
}

function DraggableCard({
  lead,
  slug,
  owner,
  index,
}: {
  lead: LeadCardT;
  slug: string;
  owner: string;
  index: number;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: lead.id,
  });
  // mouse e toque: o cartão todo. Teclado: a alça (botão focável), para não aninhar controles.
  const { onKeyDown, ...pointer } = listeners ?? {};
  return (
    // entra em sequência só na 1ª pintura; o refresh de dados não reanima (o React mantém o nó)
    <li
      ref={setNodeRef}
      {...pointer}
      onClickCapture={swallowClickAfterDrag}
      className={cn(
        "fx-rise cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      style={{ "--d": Math.min(index, 8) } as CSSProperties}
    >
      <LeadCard
        lead={lead}
        slug={slug}
        owner={owner}
        handle={{ ...attributes, onKeyDown, "data-drag-handle": "" }}
      />
    </li>
  );
}

const channelLabel = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  webchat: "Chat do site",
};

export function LeadCard({
  lead,
  slug,
  owner,
  overlay,
  handle,
}: {
  lead: LeadCardT;
  slug: string;
  owner: string;
  overlay?: boolean;
  handle?: Record<string, unknown>;
}) {
  const title = leadTitle(lead);
  return (
    <article
      className={cn(
        "fx-lift group relative rounded-md bg-bg p-3 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.05)] hover:shadow-[0_0_0_1px_var(--border-input),0_8px_20px_-8px_rgba(14,26,58,.25)]",
        overlay && "rotate-[1.5deg] shadow-drag",
      )}
    >
      <div className="flex items-start gap-2">
        <h3
          className={cn(
            "min-w-0 flex-1 break-words text-base text-fg",
            lead.hasUnread ? "font-semibold" : "font-medium",
          )}
        >
          <Link
            href={`/${slug}/leads/${lead.id}`}
            draggable={false}
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-focus"
          >
            {lead.hasUnread && (
              <span
                className="mr-1.5 inline-block size-2 rounded-pill bg-accent align-middle"
                aria-hidden
              />
            )}
            {lead.hasUnread && (
              <span className="sr-only">Mensagem não lida: </span>
            )}
            {title}
          </Link>
        </h3>
        {lead.channelKind && (
          <MessageCircle
            className="size-4 shrink-0 text-muted"
            aria-label={`Canal: ${channelLabel[lead.channelKind]}`}
          />
        )}
        {handle && (
          <button
            type="button"
            aria-label={`Mover ${title} para outra etapa`}
            className="relative z-10 -mr-1 cursor-grab touch-none rounded-xs p-0.5 text-muted hover:bg-surface [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            {...handle}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {lead.mainContact && (
        <p className="mt-0.5 truncate text-sm text-muted">
          {lead.mainContact.name}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-fg">
          {money(lead.priceCents)}
        </span>
        {lead.tags.slice(0, 2).map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        {lead.tags.length > 2 && (
          <span className="text-xs text-muted">+{lead.tags.length - 2}</span>
        )}
      </div>
      <footer className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
        {lead.taskState === "none" ? (
          <span className="flex items-center gap-1 text-warning">
            <AlarmClock className="size-3.5" aria-hidden /> Sem tarefa
          </span>
        ) : (
          <span
            className={cn(
              "flex items-center gap-1",
              lead.taskState === "late" ? "text-danger" : "text-muted",
            )}
          >
            {lead.taskState === "late" ? (
              <AlarmClock className="size-3.5" aria-hidden />
            ) : (
              <CalendarCheck className="size-3.5" aria-hidden />
            )}
            {lead.taskState === "late" && (
              <span className="sr-only">Tarefa atrasada:</span>
            )}
            <time suppressHydrationWarning>{when(lead.closestTaskAt!)}</time>
          </span>
        )}
        <Avatar name={owner} size={20} />
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// leads de entrada
// ---------------------------------------------------------------------------
const kindIcon = {
  chat: MessageCircle,
  call: Phone,
  email: Mail,
  form: FileText,
};
const kindLabel = {
  chat: "Mensagens",
  call: "Chamadas",
  email: "Emails",
  form: "Formulários",
};

function IncomingColumn({
  slug,
  items,
  linkTargets,
  onError,
}: {
  slug: string;
  items: IncomingLead[];
  linkTargets: { id: string; title: string }[];
  onError: (t: string) => void;
}) {
  const [filter, setFilter] = useState<IncomingLead["kind"] | null>(null);
  const counts = items.reduce<Record<string, number>>(
    (a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a),
    {},
  );
  const shown = filter ? items.filter((i) => i.kind === filter) : items;
  return (
    <section
      aria-label={`Leads de entrada, ${items.length}`}
      className="flex w-[var(--kanban-column)] shrink-0 snap-start flex-col rounded-lg border border-dashed border-border-input bg-bg p-1.5"
    >
      <header className="mb-1.5 px-2 pb-1 pt-1.5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <Inbox className="size-4 text-accent" aria-hidden /> Leads de entrada
          <span className="rounded-xs bg-accent-soft px-1.5 text-xs font-medium tabular-nums text-accent-text">
            {items.length}
          </span>
        </h2>
        <div
          className="mt-1 flex gap-1"
          role="group"
          aria-label="Filtrar por tipo"
        >
          {(Object.keys(kindIcon) as IncomingLead["kind"][]).map((k) => {
            const Icon = kindIcon[k];
            const on = filter === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(on ? null : k)}
                title={kindLabel[k]}
                className={cn(
                  "flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs",
                  on
                    ? "bg-accent-soft text-accent-text"
                    : "text-muted hover:bg-bg",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="sr-only">{kindLabel[k]}:</span>
                {counts[k] ?? 0}
              </button>
            );
          })}
        </div>
      </header>
      <ul className="flex flex-col gap-2 overflow-y-auto pb-2">
        {shown.map((i) => (
          <IncomingCard
            key={i.id}
            slug={slug}
            item={i}
            linkTargets={linkTargets}
            onError={onError}
          />
        ))}
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted">
            Nada novo por aqui. Mensagens de pessoas desconhecidas aparecem
            nesta coluna.
          </li>
        )}
      </ul>
    </section>
  );
}

function IncomingCard({
  slug,
  item,
  linkTargets,
  onError,
}: {
  slug: string;
  item: IncomingLead;
  linkTargets: { id: string; title: string }[];
  onError: (t: string) => void;
}) {
  const Icon = kindIcon[item.kind];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [linking, setLinking] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [q, setQ] = useState("");
  const act = (
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
    after?: (d: unknown) => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) onError(r.error ?? "Erro");
      else after?.(r.data);
    });
  const matches = linkTargets
    .filter((t) => t.title.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);
  return (
    <li
      className={cn(
        "group rounded-md border border-border bg-bg p-3",
        pending && "opacity-60",
      )}
      aria-busy={pending || undefined}
    >
      <div className="flex items-center gap-2">
        <Icon
          className="size-4 shrink-0 text-accent"
          aria-label={kindLabel[item.kind]}
        />
        <span className="min-w-0 flex-1 truncate text-base font-medium text-fg">
          {item.who}
        </span>
        <time className="text-xs text-muted" suppressHydrationWarning>
          {when(item.createdAt)}
        </time>
      </div>
      <p className="mt-1 line-clamp-2 break-words text-sm text-muted">
        {item.preview}
      </p>
      <div className="mt-2 flex justify-end gap-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        <IconButton
          label={`Aceitar ${item.who} como lead`}
          tone="success"
          size={28}
          disabled={pending}
          onClick={() =>
            act(
              () => acceptIncomingAction(slug, item.id),
              (d) =>
                router.push(
                  `/${slug}/leads/${(d as { leadId: string }).leadId}`,
                ),
            )
          }
        >
          <Check className="size-4" />
        </IconButton>
        <IconButton
          label={`Vincular ${item.who} a um lead existente`}
          tone="accent"
          size={28}
          disabled={pending}
          aria-expanded={linking}
          onClick={() => setLinking((v) => !v)}
        >
          <Link2 className="size-4" />
        </IconButton>
        <IconButton
          label={`Recusar ${item.who}`}
          tone="danger"
          size={28}
          disabled={pending}
          aria-pressed={confirmDecline}
          onClick={() => setConfirmDecline((v) => !v)}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </div>
      {confirmDecline && (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-sm bg-danger-soft px-2 py-1.5 text-sm text-danger"
          role="alert"
        >
          Recusar e fechar a conversa?
          <span className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDecline(false)}
            >
              Não
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={pending}
              onClick={() => act(() => declineIncomingAction(slug, item.id))}
            >
              Recusar
            </Button>
          </span>
        </div>
      )}
      {linking && (
        <div className="mt-2 border-t border-border pt-2" data-editing>
          <div className="flex items-end gap-1">
            <Field
              label="Buscar lead"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome ou #número…"
              autoFocus
              className="flex-1"
            />
            <IconButton
              label="Fechar busca"
              size={36}
              onClick={() => setLinking(false)}
            >
              <X className="size-4" />
            </IconButton>
          </div>
          <ul className="mt-1 flex flex-col">
            {matches.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() =>
                    act(() => linkIncomingAction(slug, item.id, t.id))
                  }
                  className="w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-fg hover:bg-accent-soft"
                >
                  {t.title}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-muted">
                Nenhum lead encontrado
              </li>
            )}
          </ul>
        </div>
      )}
    </li>
  );
}
