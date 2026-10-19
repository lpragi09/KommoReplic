"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import type { Pipeline, Robot, Stage } from "@/data/types";
import { deleteRobotAction, setRobotActiveAction } from "@/app/actions";
import { Bot, ChevronRight, Lightning, MessageCircle, Plus, Sparkle, Trash2 } from "@/components/ui/icons";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/bits";
import { PRESETS, TRIGGERS, channelLabel, humanMinutes } from "@/lib/robot-meta";
import { cn } from "@/lib/cn";
import { StepBadge, Switch, channelIcon } from "./parts";
import { StageTriggerDialog, isStageTrigger } from "./stage-trigger";

const dot: Record<Stage["color"], string> = {
  "1": "bg-stage-1", "2": "bg-stage-2", "3": "bg-stage-3", "4": "bg-stage-4", "5": "bg-stage-5",
  "6": "bg-stage-6", "7": "bg-stage-7", "8": "bg-stage-8", won: "bg-stage-won", lost: "bg-stage-lost",
};

type View = "funil" | "lista" | "prontos";

/** Painel de robôs: funil digital (robôs por etapa), lista completa e modelos prontos. */
export function RobotsBoard({ slug, pipelines, robots, users = [] }: { slug: string; pipelines: Pipeline[]; robots: Robot[]; users?: { id: string; name: string }[] }) {
  // "Adicionar" de uma etapa: janela de gatilhos (como no funil digital do Kommo)
  const [trigger, setTrigger] = useState<{ stage: Stage; existing: Robot | null } | null>(null);
  const [view, setView] = useState<View>(robots.length ? "funil" : "prontos");
  const [pid, setPid] = useState(pipelines[0]?.id ?? "");
  const [, start] = useTransition();
  const [active, setActive] = useOptimistic(robots, (cur, p: { id: string; active: boolean }) => cur.map((r) => (r.id === p.id ? { ...r, active: p.active } : r)));
  const [error, setError] = useState<string | null>(null);

  // lixeira do card: gatilho de etapa sai da etapa (o robô chamado continua); robô normal é excluído
  const [gone, setGone] = useOptimistic(robots, (cur, id: string) => cur.filter((r) => r.id !== id));
  const list = active.filter((r) => gone.some((g) => g.id === r.id));
  const remove = (r: Robot) =>
    start(async () => {
      setGone(r.id);
      const res = await deleteRobotAction(slug, r.id);
      setError(res.ok ? null : res.error);
    });
  const toggle = (r: Robot, active: boolean) =>
    start(async () => {
      setActive({ id: r.id, active });
      const res = await setRobotActiveAction(slug, r.id, active);
      setError(res.ok ? null : res.error);
    });

  const pipeline = pipelines.find((p) => p.id === pid) ?? pipelines[0];
  const stages = pipeline ? [...pipeline.stages].sort((a, b) => a.sort - b.sort) : [];
  const allStages = new Map(pipelines.flatMap((p) => p.stages).map((s) => [s.id, s]));
  const inbound = list.filter((r) => r.trigger === "message_in" || r.trigger === "new_contact");
  const onlyRobots = list.filter((r) => !isStageTrigger(r)); // a lista mostra robôs; gatilhos de etapa ficam no funil
  const created = list.filter((r) => r.trigger === "lead_created" && (!r.pipelineId || r.pipelineId === pipeline?.id));
  const base = `/${slug}/automations`;

  const tabs: { v: View; label: string; count?: number }[] = [
    { v: "funil", label: "Funil digital" },
    { v: "lista", label: "Todos os robôs", count: onlyRobots.length },
    { v: "prontos", label: "Modelos prontos" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-bg px-4 py-2">
        <div role="tablist" aria-label="Visão" className="flex rounded-sm bg-surface p-0.5 shadow-[inset_0_0_0_1px_var(--border)]">
          {tabs.map((t) => (
            <button
              key={t.v}
              role="tab"
              type="button"
              aria-selected={view === t.v}
              onClick={() => setView(t.v)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-fast ease-out",
                view === t.v ? "bg-bg text-fg shadow-[0_1px_2px_rgba(20,28,24,.12),0_0_0_1px_var(--border)]" : "text-muted hover:text-fg",
              )}
            >
              {t.label}
              {t.count !== undefined && <span className="rounded-pill bg-canvas px-1.5 text-xs tabular-nums text-muted">{t.count}</span>}
            </button>
          ))}
        </div>
        {view === "funil" && pipelines.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Funil
            <select value={pid} onChange={(e) => setPid(e.target.value)} className="h-8 rounded-sm border border-border-input bg-bg px-2 text-sm text-fg">
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {view === "funil" && (
        <div className="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto bg-surface p-4">
          <Rail
            title="Mensagens recebidas"
            sub="WhatsApp, Instagram, Messenger e chat do site"
            head={<MessageCircle className="size-4 text-accent" weight="fill" aria-hidden />}
            accent
            robots={inbound}
            onRemove={remove}
            addHref={`${base}/new?trigger=message_in`}
            onToggle={toggle}
            base={base}
            stages={allStages}
          />
          {created.length > 0 && (
            <Rail
              title="Lead novo no funil"
              head={<Lightning className="size-4 text-accent" weight="fill" aria-hidden />}
              robots={created}
              addHref={`${base}/new?trigger=lead_created&pipeline=${pipeline?.id ?? ""}`}
              onToggle={toggle}
              base={base}
              stages={allStages}
            />
          )}
          {stages.map((s) => (
            <Rail
              key={s.id}
              title={s.name}
              head={<span className={cn("size-2.5 rounded-pill", dot[s.color])} aria-hidden />}
              robots={list.filter((r) => (r.trigger === "stage_enter" || r.trigger === "responsible_changed") && r.stageId === s.id)}
              addHref={`${base}/new?trigger=stage_enter&stage=${s.id}`}
              onAdd={() => setTrigger({ stage: s, existing: null })}
              onRemove={remove}
              onEdit={(r) => setTrigger({ stage: s, existing: r })}
              onToggle={toggle}
              base={base}
              stages={allStages}
            />
          ))}
        </div>
      )}

      {view === "lista" && (
        <div className="flex-1 overflow-y-auto bg-surface p-4">
          {onlyRobots.length === 0 ? (
            <EmptyState icon={Bot} title="Nenhum robô ainda" text="Comece por um modelo pronto ou crie do zero." action={<Link href={`${base}/new`} className="text-sm font-medium text-accent-text hover:underline">Criar robô</Link>} />
          ) : (
            <ul className="mx-auto flex max-w-4xl flex-col gap-2">
              {onlyRobots.map((r) => (
                <li key={r.id}>
                  <RobotRow robot={r} href={`${base}/${r.id}`} onToggle={toggle} stages={allStages} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === "prontos" && (
        <div className="flex-1 overflow-y-auto bg-surface p-4">
          <div className="mx-auto max-w-4xl">
            <p className="mb-4 max-w-[60ch] text-sm text-muted">
              Robôs prontos para usar. Escolha um, ajuste o texto do seu jeito e salve. Eles respondem no mesmo canal em que o cliente falou: WhatsApp, Instagram, Messenger ou chat do site.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <li key={p.key}>
                  <Link
                    href={`${base}/new?preset=${p.key}`}
                    className="group flex h-full flex-col gap-3 rounded-md bg-bg p-4 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] transition-[box-shadow,transform] duration-fast ease-out hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--border-input),0_8px_20px_-10px_rgba(31,122,85,.35)]"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkle className="size-4 text-accent" weight="fill" aria-hidden />
                      <h3 className="font-semibold text-fg">{p.title}</h3>
                      <span className="ml-auto text-xs text-muted">{TRIGGERS[p.robot.trigger].label}</span>
                    </div>
                    <p className="text-sm text-muted">{p.text}</p>
                    <div className="mt-auto flex items-center gap-1">
                      {p.robot.steps.map((s) => (
                        <StepBadge key={s.id} type={s.type} size="sm" />
                      ))}
                      <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-accent-text">
                        Usar <ChevronRight className="size-3.5 transition-transform duration-fast ease-out group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {trigger && pipeline && (
        <StageTriggerDialog
          key={(trigger.existing?.id ?? "novo") + trigger.stage.id}
          open
          onOpenChange={(o) => !o && setTrigger(null)}
          slug={slug}
          pipeline={pipelines.find((p) => p.stages.some((s) => s.id === trigger.stage.id)) ?? pipeline}
          stage={trigger.stage}
          pipelines={pipelines}
          robots={list}
          users={users}
          existing={trigger.existing}
        />
      )}
    </div>
  );
}

function Rail({
  title,
  sub,
  head,
  accent,
  robots,
  addHref,
  onToggle,
  base,
  stages,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string;
  sub?: string;
  head: React.ReactNode;
  accent?: boolean;
  robots: Robot[];
  addHref: string;
  onToggle: (r: Robot, v: boolean) => void;
  base: string;
  stages: Map<string, Stage>;
  /** etapa do funil: abre a janela de gatilhos em vez de ir para o editor */
  onAdd?: () => void;
  onEdit?: (r: Robot) => void;
  onRemove?: (r: Robot) => void;
}) {
  const addCls =
    "mt-1.5 flex h-10 items-center justify-center gap-1.5 rounded-md border border-dashed border-border-input text-sm text-muted transition-colors duration-fast ease-out hover:border-accent hover:bg-bg hover:text-accent-text";
  return (
    <section
      aria-label={`${title}: ${robots.length} robôs`}
      className={cn(
        "flex w-[var(--kanban-column)] shrink-0 snap-start flex-col rounded-lg p-1.5",
        accent ? "bg-[color-mix(in_srgb,var(--accent)_6%,var(--bg))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : "bg-[color-mix(in_srgb,var(--canvas)_60%,var(--bg))] shadow-[inset_0_0_0_1px_var(--border)]",
      )}
    >
      <header className="px-2 pb-2 pt-1.5">
        <div className="flex items-center gap-2">
          {head}
          <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
          <span className="ml-auto rounded-pill bg-bg px-1.5 text-xs tabular-nums text-muted shadow-[inset_0_0_0_1px_var(--border)]">{robots.length}</span>
        </div>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </header>
      <ul className="flex flex-col gap-1.5 overflow-y-auto">
        {robots.map((r) => (
          <li key={r.id}>
            <RobotCard robot={r} href={`${base}/${r.id}`} onToggle={onToggle} stages={stages} onEdit={onEdit && isStageTrigger(r) ? () => onEdit(r) : undefined} onRemove={onRemove ? () => onRemove(r) : undefined} stageName={title} />
          </li>
        ))}
      </ul>
      {onAdd ? (
        <button type="button" onClick={onAdd} className={addCls} aria-label={`Adicionar gatilho em ${title}`}>
          <Plus className="size-4" aria-hidden /> Adicionar
        </button>
      ) : (
        <Link href={addHref} className={addCls}>
          <Plus className="size-4" aria-hidden /> Adicionar robô
        </Link>
      )}
    </section>
  );
}

const WHEN_TEXT = { created: "quando criado aqui", moved: "quando movido para cá", both: "quando criado ou movido" } as const;
const DAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function summary(r: Robot, stages: Map<string, Stage>) {
  const first = r.steps[0];
  const delay = first?.type === "wait" ? `depois de ${humanMinutes(first.minutes)}` : "na hora";
  if (isStageTrigger(r)) {
    const c = r.conditions ?? {};
    const parts = [r.trigger === "responsible_changed" ? "quando o responsável muda" : WHEN_TEXT[c.when ?? "both"], delay];
    if (c.tags?.length) parts.push(`etiqueta ${c.tags.join(" ou ")}`);
    if (c.hours) parts.push(`${c.hours.days.map((d) => DAY[d]).join(", ")} ${c.hours.from}–${c.hours.to}`);
    return parts.join(" · ");
  }
  switch (r.trigger) {
    case "stage_enter":
      return `Entrou em ${stages.get(r.stageId ?? "")?.name ?? "—"} · ${delay}`;
    case "lead_created":
      return `Lead novo · ${delay}`;
    case "message_in":
      return r.keywords.length ? `Mensagem com “${r.keywords.slice(0, 2).join("”, “")}”${r.keywords.length > 2 ? "…" : ""}` : "Qualquer mensagem recebida";
    case "new_contact":
      return "Primeira mensagem de alguém novo";
    case "responsible_changed":
      return `Responsável muda · ${delay}`;
  }
}

function Channels({ robot }: { robot: Robot }) {
  if (!robot.channels.length) return <span className="text-xs text-muted">Todos os canais</span>;
  return (
    <span className="flex items-center gap-1" aria-label={robot.channels.map(channelLabel).join(", ")}>
      {robot.channels.map((k) => {
        const I = channelIcon[k];
        return <I key={k} className="size-3.5 text-muted" aria-hidden />;
      })}
    </span>
  );
}

function RobotCard({
  robot: r,
  href,
  onToggle,
  stages,
  onEdit,
  onRemove,
  stageName,
}: {
  robot: Robot;
  href: string;
  onToggle: (r: Robot, v: boolean) => void;
  stages: Map<string, Stage>;
  onEdit?: () => void;
  onRemove?: () => void;
  stageName?: string;
}) {
  const trigger = isStageTrigger(r);
  return (
    <div
      className={cn(
        "relative rounded-md bg-bg p-3 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] transition-[box-shadow,transform,opacity] duration-fast ease-out hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--border-input),0_6px_16px_-8px_rgba(31,122,85,.35)]",
        !r.active && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        {onEdit ? (
          <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']">
            <h3 className="truncate text-sm font-semibold text-fg">{r.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">{summary(r, stages)}</p>
          </button>
        ) : (
          <Link href={href} className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']">
            <h3 className="truncate text-sm font-semibold text-fg">{r.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">{summary(r, stages)}</p>
          </Link>
        )}
        <span className="relative z-10 flex items-center gap-1">
          {onRemove && (
            <Dialog
              icon={<Trash2 className="size-5" />}
              tone="danger"
              size="sm"
              title={trigger ? `Tirar da etapa “${stageName}”?` : `Excluir o robô “${r.name}”?`}
              description={trigger ? "O gatilho sai desta etapa. O robô que ele chamava continua salvo em Todos os robôs." : "O robô é apagado e para de rodar. Não dá para desfazer."}
              trigger={
                <IconButton label={trigger ? `Tirar ${r.name} da etapa` : `Excluir ${r.name}`} tone="danger" size={28}>
                  <Trash2 className="size-4" />
                </IconButton>
              }
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancelar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger" onClick={onRemove}>
                      {trigger ? "Tirar da etapa" : "Excluir robô"}
                    </Button>
                  </DialogClose>
                </>
              }
            />
          )}
          <Switch checked={r.active} onChange={(v) => onToggle(r, v)} label={r.active ? `Desligar ${r.name}` : `Ligar ${r.name}`} />
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-1">
        {r.steps.slice(0, 6).map((s) => (
          <StepBadge key={s.id} type={s.type} size="sm" />
        ))}
        {r.steps.length > 6 && <span className="text-xs text-muted">+{r.steps.length - 6}</span>}
        <span className="ml-auto">
          <Channels robot={r} />
        </span>
      </div>
      <p className="mt-2 text-xs tabular-nums text-muted">{r.runCount ? `Rodou ${r.runCount}×` : "Ainda não rodou"}</p>
    </div>
  );
}

function RobotRow({ robot: r, href, onToggle, stages }: { robot: Robot; href: string; onToggle: (r: Robot, v: boolean) => void; stages: Map<string, Stage> }) {
  return (
    <div className={cn("relative flex items-center gap-3 rounded-md bg-bg px-4 py-3 shadow-[0_0_0_1px_var(--border)] transition-shadow duration-fast hover:shadow-[0_0_0_1px_var(--border-input),0_4px_12px_-6px_rgba(31,122,85,.3)]", !r.active && "opacity-60")}>
      <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-accent-soft text-accent-text" aria-hidden>
        <Bot className="size-5" />
      </span>
      <Link href={href} className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']">
        <h3 className="truncate text-sm font-semibold text-fg">{r.name}</h3>
        <p className="truncate text-xs text-muted">
          {TRIGGERS[r.trigger].label} · {summary(r, stages)}
        </p>
      </Link>
      <span className="hidden items-center gap-1 sm:flex">
        {r.steps.slice(0, 5).map((s) => (
          <StepBadge key={s.id} type={s.type} size="sm" />
        ))}
      </span>
      <span className="hidden w-24 text-right md:block">
        <Channels robot={r} />
      </span>
      <span className="hidden w-24 text-right text-xs tabular-nums text-muted md:block">{r.runCount ? `${r.runCount} execuções` : "—"}</span>
      <span className="relative z-10">
        <Switch checked={r.active} onChange={(v) => onToggle(r, v)} label={r.active ? `Desligar ${r.name}` : `Ligar ${r.name}`} />
      </span>
    </div>
  );
}
