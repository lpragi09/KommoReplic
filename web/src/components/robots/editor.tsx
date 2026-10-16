"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardPointerSensor, CardTouchSensor } from "@/components/ui/dnd";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import type {
  ChannelKind,
  Pipeline,
  RobotInput,
  RobotRun,
  RobotStep,
  RobotStepType,
  RobotTrigger,
  Template,
  User,
} from "@/data/types";
import { deleteRobotAction, saveRobotAction } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Minus,
  ArrowsOut,
  Lightning,
  Plus,
  Trash2,
  XCircle,
  CircleCheck,
  Clock,
} from "@/components/ui/icons";
import {
  CHANNELS,
  STEP_TYPES,
  TRIGGERS,
  VARIABLES,
  humanMinutes,
  newStep,
} from "@/lib/robot-meta";
import { cn } from "@/lib/cn";
import { StepBadge, Switch, channelIcon } from "./parts";

type Run = RobotRun & { leadName: string | null };

const UNITS = [
  { v: 1, label: "minutos" },
  { v: 60, label: "horas" },
  { v: 1440, label: "dias" },
] as const;
const splitMinutes = (m: number) => {
  const u =
    m >= 1440 && m % 1440 === 0 ? 1440 : m >= 60 && m % 60 === 0 ? 60 : 1;
  return { n: m / u, u };
};

const selectCls =
  "h-10 w-full rounded-sm border border-border bg-bg px-2 text-base text-fg shadow-[inset_0_1px_2px_rgba(14,26,58,.06)] hover:border-border-input focus:border-focus focus:outline-none focus:shadow-[0_0_0_4px_rgba(37,99,235,.15)]";

export function RobotEditor({
  slug,
  robotId,
  initial,
  pipelines,
  users,
  templates,
  runs,
  connected,
}: {
  slug: string;
  robotId: string | null;
  initial: RobotInput;
  pipelines: Pipeline[];
  users: User[];
  templates: Template[];
  runs: Run[];
  connected: ChannelKind[];
}) {
  const router = useRouter();
  const [r, setR] = useState<RobotInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<RobotInput>) => {
    setSaved(false);
    setR((cur) => ({ ...cur, ...patch }));
  };
  const setStep = (i: number, s: RobotStep) =>
    set({ steps: r.steps.map((x, j) => (j === i ? s : x)) });
  const insertStep = (at: number, type: RobotStepType) =>
    set({
      steps: [...r.steps.slice(0, at), newStep(type), ...r.steps.slice(at)],
    });
  const dndId = useId();
  // zoom do quadro: botões, Ctrl + roda do mouse e "Ver tudo"
  const [zoom, setZoomRaw] = useState(1);
  const setZoom = useCallback(
    (z: number) =>
      setZoomRaw(Math.min(1.5, Math.max(0.3, Math.round(z * 100) / 100))),
    [],
  );
  const bump = (d: number) =>
    setZoomRaw((z) =>
      Math.min(1.5, Math.max(0.3, Math.round((z + d) * 100) / 100)),
    );
  const canvas = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomRaw((z) =>
        Math.min(
          1.5,
          Math.max(0.3, Math.round((z - e.deltaY * 0.002) * 100) / 100),
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const fit = () => {
    const c = canvas.current;
    const f = flow.current;
    if (!c || !f) return;
    const natural = f.getBoundingClientRect().height / zoom; // altura sem zoom
    setZoom(Math.min(1, (c.clientHeight - 80) / natural));
    c.scrollTo({ top: 0 });
  };
  const sensors = useSensors(
    // arrasta o cartão de qualquer ponto, menos de dentro dos campos e botões
    useSensor(CardPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(CardTouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = r.steps.findIndex((s) => s.id === active.id);
    const to = r.steps.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) set({ steps: arrayMove(r.steps, from, to) });
  };
  const moveStep = (i: number, d: -1 | 1) => {
    const s = [...r.steps];
    [s[i], s[i + d]] = [s[i + d], s[i]];
    set({ steps: s });
  };

  const allStages = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ ...s, pipelineName: p.name })),
  );
  const stageOptions = (filter?: (k: string) => boolean) =>
    pipelines.map((p) => (
      <optgroup key={p.id} label={p.name}>
        {[...p.stages]
          .sort((a, b) => a.sort - b.sort)
          .filter((s) => !filter || filter(s.kind))
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </optgroup>
    ));

  const save = () =>
    start(async () => {
      const stage = allStages.find((s) => s.id === r.stageId);
      const res = await saveRobotAction(slug, robotId, {
        ...r,
        pipelineId:
          r.trigger === "stage_enter"
            ? (stage?.pipelineId ?? null)
            : r.pipelineId,
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      setSaved(true);
      if (!robotId) router.replace(`/${slug}/automations/${res.data.id}`);
    });

  const remove = () =>
    start(async () => {
      if (!robotId) return;
      const res = await deleteRobotAction(slug, robotId);
      if (!res.ok) return setError(res.error);
      router.push(`/${slug}/automations`);
    });

  const triggerText = (() => {
    const st = allStages.find((s) => s.id === r.stageId);
    switch (r.trigger) {
      case "stage_enter":
        return st ? `Lead entra em “${st.name}”` : "Lead entra na etapa…";
      case "lead_created":
        return "Lead novo no funil";
      case "message_in":
        return r.keywords.length
          ? `Mensagem com: ${r.keywords.join(", ")}`
          : "Qualquer mensagem recebida";
      case "new_contact":
        return "Alguém novo escreve pela 1ª vez";
    }
  })();

  const notConnected = (
    r.channels.length
      ? r.channels
      : (["whatsapp", "instagram", "messenger"] as ChannelKind[])
  ).filter((k) => k !== "webchat" && !connected.includes(k));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* ---------- configurações ---------- */}
      <aside className="flex shrink-0 flex-col gap-5 overflow-y-auto border-b border-border bg-bg p-4 lg:w-[340px] lg:border-b-0 lg:border-r">
        <Field
          label="Nome do robô"
          value={r.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={80}
          placeholder="Ex.: Boas-vindas"
        />

        <div className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--border)]">
          <div>
            <p className="text-sm font-medium text-fg">
              {r.active ? "Robô ligado" : "Robô desligado"}
            </p>
            <p className="text-xs text-muted">
              {r.active
                ? "Roda sozinho quando o gatilho acontecer."
                : "Não roda até você ligar."}
            </p>
          </div>
          <Switch
            checked={r.active}
            onChange={(v) => set({ active: v })}
            label={r.active ? "Desligar robô" : "Ligar robô"}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">
            Quando disparar
          </legend>
          <div className="grid gap-1.5">
            {(Object.keys(TRIGGERS) as RobotTrigger[]).map((t) => (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-md p-3 shadow-[inset_0_0_0_1px_var(--border)] transition-[box-shadow,background-color] duration-fast ease-out hover:shadow-[inset_0_0_0_1px_var(--border-input)]",
                  r.trigger === t &&
                    "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)] hover:shadow-[inset_0_0_0_1.5px_var(--accent)]",
                )}
              >
                <input
                  type="radio"
                  name="trigger"
                  value={t}
                  checked={r.trigger === t}
                  onChange={() => set({ trigger: t })}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-medium text-fg">
                    {TRIGGERS[t].label}
                  </span>
                  <span className="block text-xs text-muted">
                    {TRIGGERS[t].hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {r.trigger === "stage_enter" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-fg">Etapa</span>
            <select
              value={r.stageId ?? ""}
              onChange={(e) => set({ stageId: e.target.value || null })}
              className={selectCls}
            >
              <option value="">Escolha a etapa…</option>
              {stageOptions()}
            </select>
          </label>
        )}
        {r.trigger === "lead_created" && pipelines.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-fg">Funil</span>
            <select
              value={r.pipelineId ?? ""}
              onChange={(e) => set({ pipelineId: e.target.value || null })}
              className={selectCls}
            >
              <option value="">Todos os funis</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {r.trigger === "message_in" && (
          <Field
            label="Só com estas palavras (opcional)"
            hint="Separe por vírgula. Vazio = toda mensagem."
            placeholder="preço, valor, quanto custa"
            defaultValue={r.keywords.join(", ")}
            onChange={(e) =>
              set({
                keywords: e.target.value
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean)
                  .slice(0, 20),
              })
            }
          />
        )}

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-fg">Canais</legend>
          <p className="mb-2 text-xs text-muted">
            Nenhum marcado = todos. Vale para o canal da conversa do lead.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => {
              const on = r.channels.includes(c.kind);
              const I = channelIcon[c.kind];
              return (
                <button
                  key={c.kind}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      channels: on
                        ? r.channels.filter((k) => k !== c.kind)
                        : [...r.channels, c.kind],
                    })
                  }
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm transition-[background-color,box-shadow,color] duration-fast ease-out",
                    on
                      ? "bg-accent text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.2)]"
                      : "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-input)]",
                  )}
                >
                  <I
                    className="size-4"
                    weight={on ? "fill" : "regular"}
                    aria-hidden
                  />{" "}
                  {c.label}
                </button>
              );
            })}
          </div>
          {notConnected.length > 0 && (
            <p className="mt-2 rounded-sm bg-[color-mix(in_srgb,var(--warning)_12%,var(--bg))] px-2.5 py-2 text-xs text-fg">
              {notConnected
                .map((k) => CHANNELS.find((c) => c.kind === k)!.label)
                .join(", ")}{" "}
              ainda não{" "}
              {notConnected.length > 1 ? "estão conectados" : "está conectado"}.
              O robô já fica pronto; as mensagens desses canais saem quando a
              conta da Meta for ligada em Configurações → Canais.
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-fg">Só para uma campanha (opcional)</legend>
          <p className="mb-2 text-xs text-muted">Roda só para leads cuja origem (UTM) tenha o texto. Ex.: Campanha contém “black”.</p>
          <div className="grid grid-cols-[1fr_1.2fr] gap-2">
            <select
              aria-label="Campo da UTM"
              value={r.conditions?.utmField ?? ""}
              onChange={(e) => set({ conditions: { ...r.conditions, utmField: (e.target.value || undefined) as NonNullable<RobotInput["conditions"]>["utmField"] } })}
              className={selectCls}
            >
              <option value="">Qualquer origem</option>
              <option value="utm_campaign">Campanha</option>
              <option value="utm_source">Fonte</option>
              <option value="utm_medium">Mídia</option>
              <option value="utm_content">Conteúdo</option>
              <option value="utm_term">Termo</option>
            </select>
            <Field
              label="Contém"
              hideLabel
              placeholder="contém…"
              disabled={!r.conditions?.utmField}
              value={r.conditions?.utmContains ?? ""}
              onChange={(e) => set({ conditions: { ...r.conditions, utmContains: e.target.value } })}
            />
          </div>
        </fieldset>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={r.once}
            onChange={(e) => set({ once: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium text-fg">Uma vez por lead</span>
            <span className="block text-xs text-muted">
              Não repete se o lead voltar à etapa ou mandar outra mensagem.
            </span>
          </span>
        </label>
      </aside>

      {/* ---------- fluxo ---------- */}
      <div
        ref={canvas}
        className="relative flex min-h-[480px] flex-1 flex-col overflow-auto bg-surface bg-[radial-gradient(circle,var(--border-input)_1px,transparent_1px)] [background-size:20px_20px]"
      >
        {/* controles de zoom */}
        <div
          role="group"
          aria-label="Zoom do quadro"
          className="sticky top-3 z-30 mr-3 flex h-0 items-start justify-end"
        >
          <div className="flex items-center gap-0.5 rounded-pill bg-bg p-1 shadow-[0_0_0_1px_var(--border),0_6px_16px_-8px_rgba(14,26,58,.35)]">
            <IconButton
              label="Diminuir zoom"
              size={28}
              onClick={() => bump(-0.1)}
              disabled={zoom <= 0.3}
            >
              <Minus className="size-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Voltar para 100%"
              className="h-7 min-w-12 rounded-pill px-1 text-xs font-medium tabular-nums text-fg hover:bg-surface"
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconButton
              label="Aumentar zoom"
              size={28}
              onClick={() => bump(0.1)}
              disabled={zoom >= 1.5}
            >
              <Plus className="size-4" />
            </IconButton>
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={fit}
              className="inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-xs font-medium text-fg hover:bg-surface"
            >
              <ArrowsOut className="size-3.5" aria-hidden /> Ver tudo
            </button>
          </div>
        </div>
        <div
          ref={flow}
          style={{ zoom }}
          className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-32 pt-14"
        >
          <div className="flex items-center gap-2 rounded-pill bg-inverse-bg py-2 pl-2 pr-4 text-sm font-medium text-on-inverse shadow-[0_8px_24px_-12px_rgba(14,26,58,.6)]">
            <span
              className="grid size-7 place-items-center rounded-pill bg-accent"
              aria-hidden
            >
              <Lightning className="size-4 text-on-accent" weight="fill" />
            </span>
            {triggerText}
          </div>

          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  "Para mover o passo, aperte espaço, use as setas para cima e para baixo e aperte espaço de novo para soltar.",
              },
              announcements: {
                onDragStart: () => "Passo pego.",
                onDragOver: ({ over }) =>
                  over
                    ? `Sobre o passo ${r.steps.findIndex((x) => x.id === over.id) + 1}.`
                    : "Fora da lista.",
                onDragEnd: ({ over }) =>
                  over
                    ? `Passo solto na posição ${r.steps.findIndex((x) => x.id === over.id) + 1}.`
                    : "Movimento cancelado.",
                onDragCancel: () => "Movimento cancelado.",
              },
            }}
          >
            <SortableContext
              items={r.steps.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="flex w-full flex-col items-center">
                {r.steps.map((s, i) => (
                  <SortableStep key={s.id} id={s.id} index={i} zoom={zoom}>
                    {(grip, dragging, drag) => (
                      <>
                        <Connector>
                          <AddStep
                            onPick={(t) => insertStep(i, t)}
                            label={`Adicionar passo antes do passo ${i + 1}`}
                          />
                        </Connector>
                        <StepCard
                          index={i}
                          step={s}
                          total={r.steps.length}
                          onChange={(n) => setStep(i, n)}
                          onRemove={() =>
                            set({ steps: r.steps.filter((_, j) => j !== i) })
                          }
                          onMove={(d) => moveStep(i, d)}
                          users={users}
                          templates={templates}
                          stageOptions={stageOptions((k) => k !== "lost")}
                          grip={grip}
                          drag={drag}
                          dragging={dragging}
                        />
                      </>
                    )}
                  </SortableStep>
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <Connector />
          <AddStep
            onPick={(t) => insertStep(r.steps.length, t)}
            label="Adicionar passo"
            big
          />
          {r.steps.length === 0 && (
            <p className="mt-3 text-sm text-muted">
              Adicione o primeiro passo: por exemplo, “Enviar mensagem”.
            </p>
          )}
        </div>

        {/* barra de salvar */}
        <div className="sticky bottom-0 mt-auto flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-4 py-3">
          {error ? (
            <p role="alert" className="mr-auto text-sm text-danger">
              {error}
            </p>
          ) : (
            <p role="status" className="mr-auto text-sm text-muted">
              {saved ? (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCheck className="size-4" aria-hidden /> Salvo
                </span>
              ) : (
                `${r.steps.length} ${r.steps.length === 1 ? "passo" : "passos"}`
              )}
            </p>
          )}
          {robotId && (
            <Dialog
              title="Apagar robô?"
              description="O histórico de execuções vai junto. Isso não pode ser desfeito."
              size="sm"
              trigger={
                <Button
                  variant="ghost"
                  icon={<Trash2 className="size-4" aria-hidden />}
                  className="text-danger"
                >
                  Apagar
                </Button>
              }
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancelar</Button>
                  </DialogClose>
                  <Button variant="danger" onClick={remove} loading={pending}>
                    Apagar robô
                  </Button>
                </>
              }
            />
          )}
          <Button onClick={save} loading={pending}>
            {robotId ? "Salvar alterações" : "Criar robô"}
          </Button>
        </div>
      </div>

      {/* ---------- prévia e histórico ---------- */}
      <aside className="flex shrink-0 flex-col gap-4 overflow-y-auto border-t border-border bg-bg p-4 lg:w-[320px] lg:border-l lg:border-t-0">
        <Preview steps={r.steps} />
        {robotId && <History runs={runs} />}
      </aside>
    </div>
  );
}

type DragProps = Record<string, unknown>;

/** Item da lista que se arrasta pelo cartão inteiro (mouse/toque) ou pela alça (teclado). Campos continuam editáveis.
    Com zoom, o deslocamento vem em pixels da tela: divide pelo zoom para acompanhar o mouse. */
function SortableStep({
  id,
  index,
  zoom,
  children,
}: {
  id: string;
  index: number;
  zoom: number;
  children: (grip: ReactNode, dragging: boolean, drag: DragProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(
      transform
        ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
        : null,
    ),
    transition,
  };
  const grip = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      onKeyDown={listeners?.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
      data-drag-handle=""
      aria-label={`Arrastar passo ${index + 1}`}
      title="Arraste para mudar a ordem"
      className="-ml-1.5 grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex w-full flex-col items-center",
        isDragging && "z-20",
      )}
    >
      {children(grip, isDragging, {
        onPointerDown: listeners?.onPointerDown,
        onTouchStart: listeners?.onTouchStart,
      })}
    </li>
  );
}

function Connector({ children }: { children?: ReactNode }) {
  return (
    <div
      className="relative flex h-12 w-full items-center justify-center"
      aria-hidden={!children}
    >
      <span
        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[linear-gradient(var(--accent),color-mix(in_srgb,var(--accent)_40%,transparent))] opacity-60"
        aria-hidden
      />
      {children && <span className="relative">{children}</span>}
    </div>
  );
}

function AddStep({
  onPick,
  label,
  big,
}: {
  onPick: (t: RobotStepType) => void;
  label: string;
  big?: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={label}
        title={label}
        className={cn(
          "place-items-center rounded-pill bg-bg text-accent shadow-[0_0_0_1px_var(--border-input),0_2px_6px_-2px_rgba(14,26,58,.2)] transition-[transform,box-shadow] duration-fast ease-out hover:scale-110 hover:shadow-[0_0_0_1.5px_var(--accent),0_6px_16px_-6px_rgba(29,78,216,.5)] data-[state=open]:scale-110",
          big
            ? "inline-flex h-10 items-center gap-1.5 px-4 text-sm font-medium"
            : "grid size-7",
        )}
      >
        <Plus className={big ? "size-4" : "size-3.5"} aria-hidden />
        {big && "Adicionar passo"}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={6}
          align="center"
          className="z-50 w-72 rounded-md border border-border bg-bg p-1 shadow-pop"
        >
          {(Object.keys(STEP_TYPES) as RobotStepType[]).map((t) => (
            <DropdownMenu.Item
              key={t}
              onSelect={() => onPick(t)}
              className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 outline-none data-[highlighted]:bg-surface"
            >
              <StepBadge type={t} size="sm" />
              <span>
                <span className="block text-sm font-medium text-fg">
                  {STEP_TYPES[t].label}
                </span>
                <span className="block text-xs text-muted">
                  {STEP_TYPES[t].hint}
                </span>
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function StepCard({
  index,
  step,
  total,
  onChange,
  onRemove,
  onMove,
  users,
  templates,
  stageOptions,
  grip,
  dragging,
  drag,
}: {
  drag: DragProps;
  grip: ReactNode;
  dragging: boolean;
  index: number;
  step: RobotStep;
  total: number;
  onChange: (s: RobotStep) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  users: User[];
  templates: Template[];
  stageOptions: ReactNode;
}) {
  const title = `${index + 1}. ${STEP_TYPES[step.type].label}`;
  return (
    <section
      aria-label={title}
      {...drag}
      className={cn(
        "w-full cursor-grab rounded-lg bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_10px_30px_-18px_rgba(14,26,58,.45)] transition-shadow duration-fast active:cursor-grabbing",
        step.type === "wait" && "max-w-sm",
        dragging &&
          "shadow-[0_0_0_2px_var(--accent),0_24px_48px_-16px_rgba(29,78,216,.55)]",
      )}
    >
      <header className="mb-3 flex items-center gap-3">
        {grip}
        <StepBadge type={step.type} />
        <h3 className="flex-1 text-sm font-semibold text-fg">{title}</h3>
        <IconButton
          label="Subir passo"
          size={28}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ChevronUp className="size-4" />
        </IconButton>
        <IconButton
          label="Descer passo"
          size={28}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ChevronDown className="size-4" />
        </IconButton>
        <IconButton
          label="Remover passo"
          size={28}
          tone="danger"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </header>
      <StepBody
        step={step}
        onChange={onChange}
        users={users}
        templates={templates}
        stageOptions={stageOptions}
      />
    </section>
  );
}

function MinutesInput({
  label,
  value,
  onChange,
  allowZero,
}: {
  label: string;
  value: number;
  onChange: (m: number) => void;
  allowZero?: boolean;
}) {
  const { n, u } = splitMinutes(value);
  return (
    <div className="flex items-end gap-2">
      <Field
        label={label}
        type="number"
        inputMode="numeric"
        min={allowZero ? 0 : 1}
        max={u === 1440 ? 30 : u === 60 ? 720 : 43200}
        value={n}
        onChange={(e) =>
          onChange(
            Math.max(
              allowZero ? 0 : 1,
              Math.round(Number(e.target.value) || 0),
            ) * u,
          )
        }
        className="w-28"
      />
      <select
        aria-label={`${label}: unidade`}
        value={u}
        onChange={(e) => onChange(n * Number(e.target.value))}
        className={cn(selectCls, "w-32")}
      >
        {UNITS.map((x) => (
          <option key={x.v} value={x.v}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextWithVars({
  label,
  value,
  onChange,
  rows = 3,
  templates,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  templates?: Template[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (t: string) => {
    const el = ref.current;
    const at = el?.selectionStart ?? value.length;
    const next = value.slice(0, at) + t + value.slice(el?.selectionEnd ?? at);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + t.length, at + t.length);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-fg">
        {label}
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          maxLength={2000}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 block w-full resize-y rounded-sm border border-border bg-bg px-3 py-2 text-base font-normal text-fg shadow-[inset_0_1px_2px_rgba(14,26,58,.06)] hover:border-border-input focus:border-focus focus:outline-none focus:shadow-[0_0_0_4px_rgba(37,99,235,.15)]"
        />
      </label>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-muted">Inserir:</span>
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insert(`{{${v.key}}}`)}
            className="rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text transition-colors duration-fast hover:bg-[color-mix(in_srgb,var(--accent)_20%,var(--bg))]"
          >
            {v.label}
          </button>
        ))}
        {templates && templates.length > 0 && (
          <select
            aria-label="Usar um modelo de mensagem"
            value=""
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) onChange(t.body);
            }}
            className="ml-auto h-7 rounded-sm border border-border bg-bg px-1.5 text-xs text-fg"
          >
            <option value="">Usar modelo…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function StepBody({
  step,
  onChange,
  users,
  templates,
  stageOptions,
}: {
  step: RobotStep;
  onChange: (s: RobotStep) => void;
  users: User[];
  templates: Template[];
  stageOptions: ReactNode;
}) {
  switch (step.type) {
    case "message":
      return (
        <TextWithVars
          label="Mensagem"
          value={step.text}
          onChange={(text) => onChange({ ...step, text })}
          rows={4}
          templates={templates}
        />
      );
    case "wait":
      return (
        <MinutesInput
          label="Esperar"
          value={step.minutes}
          onChange={(minutes) => onChange({ ...step, minutes })}
        />
      );
    case "task":
      return (
        <div className="flex flex-col gap-3">
          <Field
            label="Tarefa"
            value={step.text}
            onChange={(e) => onChange({ ...step, text: e.target.value })}
            maxLength={500}
            hint="Vai para o responsável do lead. Aceita {{nome}}."
          />
          <MinutesInput
            label="Prazo em"
            value={step.dueMinutes}
            onChange={(dueMinutes) => onChange({ ...step, dueMinutes })}
            allowZero
          />
        </div>
      );
    case "tag":
      return (
        <Field
          label="Etiqueta"
          value={step.tag}
          onChange={(e) => onChange({ ...step, tag: e.target.value })}
          maxLength={40}
          placeholder="Ex.: quente"
        />
      );
    case "responsible":
      return (
        <label className="flex flex-col gap-1 text-sm font-medium text-fg">
          Novo responsável
          <select
            value={step.userId}
            onChange={(e) => onChange({ ...step, userId: e.target.value })}
            className={cn(selectCls, "font-normal")}
          >
            <option value="">Escolha…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </label>
      );
    case "stage":
      return (
        <label className="flex flex-col gap-1 text-sm font-medium text-fg">
          Mover para
          <select
            value={step.stageId}
            onChange={(e) => onChange({ ...step, stageId: e.target.value })}
            className={cn(selectCls, "font-normal")}
          >
            <option value="">Escolha a etapa…</option>
            {stageOptions}
          </select>
          <span className="text-xs font-normal text-muted">
            Robôs da etapa de destino também rodam. “Perdido” fica de fora:
            exige motivo.
          </span>
        </label>
      );
    case "note":
      return (
        <TextWithVars
          label="Nota interna"
          value={step.text}
          onChange={(text) => onChange({ ...step, text })}
        />
      );
  }
}

/** Prévia estilo conversa: mostra as mensagens com dados de exemplo. */
function Preview({ steps }: { steps: RobotStep[] }) {
  const sample = (t: string) =>
    t
      .replace(/\{\{\s*nome\s*\}\}/gi, "Marina")
      .replace(/\{\{\s*nome_completo\s*\}\}/gi, "Marina Alves")
      .replace(/\{\{\s*empresa\s*\}\}/gi, "sua empresa")
      .replace(/\{\{\s*responsavel\s*\}\}/gi, "Ana")
      .replace(/\{\{\s*lead\s*\}\}/gi, "Orçamento");
  const items = steps.filter((s) => s.type === "message" || s.type === "wait");
  return (
    <section aria-labelledby="previa">
      <h2 id="previa" className="mb-2 text-sm font-semibold text-fg">
        Prévia para o cliente
      </h2>
      <div className="flex min-h-48 flex-col gap-2 rounded-lg bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_8%,var(--surface)),var(--surface))] p-3 shadow-[inset_0_0_0_1px_var(--border)]">
        {items.length === 0 && (
          <p className="m-auto text-center text-xs text-muted">
            As mensagens do robô aparecem aqui.
          </p>
        )}
        {items.map((s) =>
          s.type === "wait" ? (
            <p
              key={s.id}
              className="mx-auto flex items-center gap-1 rounded-pill bg-bg px-2.5 py-0.5 text-xs text-muted shadow-[0_0_0_1px_var(--border)]"
            >
              <Clock className="size-3" aria-hidden /> {humanMinutes(s.minutes)}{" "}
              depois
            </p>
          ) : (
            <p
              key={s.id}
              className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-md rounded-br-xs bg-accent px-3 py-2 text-sm text-on-accent shadow-[0_4px_12px_-6px_rgba(29,78,216,.6)]"
            >
              {s.type === "message" &&
                (sample(s.text) || (
                  <span className="opacity-70">(mensagem vazia)</span>
                ))}
            </p>
          ),
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Exemplo com a cliente “Marina”. Na hora, entram os dados reais do lead.
      </p>
    </section>
  );
}

function History({ runs }: { runs: Run[] }) {
  const fmt = (s: string) =>
    new Date(s).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <section aria-labelledby="historico">
      <h2 id="historico" className="mb-2 text-sm font-semibold text-fg">
        Últimas execuções
      </h2>
      {runs.length === 0 ? (
        <p className="rounded-md bg-surface p-3 text-xs text-muted">
          Ainda não rodou. Ele roda sozinho quando o gatilho acontecer.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {runs.map((run) => (
            <li
              key={run.id}
              className="rounded-md p-3 shadow-[inset_0_0_0_1px_var(--border)]"
            >
              <div className="flex items-center gap-2">
                {run.status === "done" ? (
                  <CircleCheck
                    className="size-4 text-success"
                    aria-label="Concluído"
                  />
                ) : run.status === "failed" ? (
                  <XCircle
                    className="size-4 text-danger"
                    aria-label="Com falha"
                  />
                ) : (
                  <Clock
                    className="size-4 text-warning"
                    aria-label="Esperando"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                  {run.leadName ?? "Contato"}
                </span>
                <time
                  className="text-xs tabular-nums text-muted"
                  dateTime={run.createdAt}
                >
                  {fmt(run.createdAt)}
                </time>
              </div>
              <ul className="mt-1.5 flex flex-col gap-0.5 pl-6">
                {run.log.slice(-4).map((l, i) => (
                  <li
                    key={i}
                    className={cn(
                      "text-xs",
                      l.ok ? "text-muted" : "text-danger",
                    )}
                  >
                    {l.text}
                  </li>
                ))}
                {run.status === "waiting" && (
                  <li className="text-xs text-warning">
                    Continua em {fmt(run.runAt)}
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
