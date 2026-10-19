"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import type { ActiveHours, Pipeline, Robot, RobotInput, RobotStep, Stage, StageTriggerAction } from "@/data/types";
import { applyStageTriggerAction, deleteRobotAction, saveRobotAction } from "@/app/actions";
import { ArrowLeft, ArrowRightLeft, Bot, CalendarCheck, CircleCheck, Globe, ListPlus, Mail, MessageCircle, Plus, Search, Sparkle, StickyNote, TagIcon, Textbox, UserGear, XCircle } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { TRIGGERS, humanMinutes } from "@/lib/robot-meta";
import { cn } from "@/lib/cn";
import { StepBadge } from "./parts";

/* "Adicionar" de uma etapa do funil digital, como no Kommo: primeiro a lista do que pode acontecer
   (rodar um robô seu, mandar mensagem, criar tarefa...), depois a regra de execução (criado, movido,
   responsável mudou), o atraso, as condições e o horário de atividade.
   Por baixo, cada gatilho é um robô pequeno marcado como gatilho de etapa: [esperar] → ação. */

type Option = { action: StageTriggerAction; label: string; text: string; icon: ReactNode };
const OPTIONS: Option[] = [
  { action: "robot", label: "Robô", text: "Roda um robô que você criou: conversa, perguntas, botões e caminhos.", icon: <Bot className="size-5" /> },
  { action: "message", label: "Enviar mensagem", text: "Uma mensagem no canal do cliente (WhatsApp, Instagram, Messenger ou chat do site).", icon: <MessageCircle className="size-5" /> },
  { action: "email", label: "Enviar email", text: "Email para o contato principal do lead, com link de descadastro.", icon: <Mail className="size-5" /> },
  { action: "task", label: "Adicionar tarefa", text: "Cria uma tarefa para o responsável, com prazo.", icon: <CalendarCheck className="size-5" /> },
  { action: "tag", label: "Editar etiquetas", text: "Coloca ou tira uma etiqueta do lead.", icon: <TagIcon className="size-5" /> },
  { action: "stage", label: "Mudar etapa do lead", text: "Leva o lead para outra etapa, inclusive de outro funil.", icon: <ArrowRightLeft className="size-5" /> },
  { action: "responsible", label: "Mudar responsável", text: "Passa o lead para outra pessoa da equipe.", icon: <UserGear className="size-5" /> },
  { action: "note", label: "Nota interna", text: "Deixa um aviso no histórico do lead, só para a equipe.", icon: <StickyNote className="size-5" /> },
  { action: "webhook", label: "Enviar webhook", text: "Avisa outro sistema (planilha, ERP, Make, Zapier) com os dados do lead.", icon: <Globe className="size-5" /> },
  { action: "ai_on", label: "Ligar agente de IA", text: "A IA passa a responder a conversa deste lead.", icon: <Sparkle className="size-5" /> },
  { action: "ai_off", label: "Parar agente de IA", text: "A IA para nesta conversa e a equipe assume.", icon: <XCircle className="size-5" /> },
  { action: "complete_tasks", label: "Concluir tarefas", text: "Marca como feitas as tarefas abertas do lead.", icon: <CircleCheck className="size-5" /> },
  { action: "field", label: "Alterar campo", text: "Grava um valor no valor da venda ou num campo personalizado.", icon: <Textbox className="size-5" /> },
  { action: "create_lead", label: "Criar lead", text: "Abre um lead novo para o mesmo contato, em outra etapa ou funil (ex.: pós-venda).", icon: <ListPlus className="size-5" /> },
];
/** nome curto do gatilho no card: "Tarefa: Ligar para o cliente" */
const SHORT: Record<StageTriggerAction, string> = {
  robot: "Robô",
  message: "Mensagem",
  email: "Email",
  task: "Tarefa",
  tag: "Etiqueta",
  stage: "Mudar etapa",
  responsible: "Responsável",
  note: "Nota",
  webhook: "Webhook",
  ai_on: "Ligar IA",
  ai_off: "Parar IA",
  complete_tasks: "Concluir tarefas",
  field: "Alterar campo",
  create_lead: "Criar lead",
};
const SOON = [{ label: "Gerar formulário", icon: <StickyNote className="size-5" /> }];

type When = "created" | "moved" | "both" | "owner" | "tag" | "field" | "daily" | "message" | "no_reply";
/** como no Kommo, em grupos: do funil, programados e de conversa. Tudo vale para leads desta etapa. */
const WHEN_GROUPS: { label: string; items: { v: When; label: string }[] }[] = [
  {
    label: "Gatilhos do funil",
    items: [
      { v: "both", label: "Quando criado ou movido para esta etapa" },
      { v: "moved", label: "Quando movido para esta etapa" },
      { v: "created", label: "Quando criado nesta etapa" },
      { v: "owner", label: "Quando o responsável muda" },
      { v: "tag", label: "Quando uma etiqueta é adicionada" },
      { v: "field", label: "Quando um campo do lead muda" },
    ],
  },
  { label: "Gatilhos programados", items: [{ v: "daily", label: "Todo dia, num horário" }] },
  {
    label: "Gatilhos de conversa",
    items: [
      { v: "message", label: "Quando o cliente manda mensagem" },
      { v: "no_reply", label: "Quando o cliente fica um tempo sem responder" },
    ],
  },
];
const TRIGGER_OF: Record<When, RobotInput["trigger"]> = {
  both: "stage_enter",
  moved: "stage_enter",
  created: "stage_enter",
  owner: "responsible_changed",
  tag: "tag_added",
  field: "field_changed",
  daily: "schedule_daily",
  message: "message_in",
  no_reply: "no_reply",
};
const SILENCE = [60, 180, 1440, 2880, 4320];
const DELAYS = [0, 5, 10, 60, 1440];
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DUE = [
  { v: 0, label: "Na hora" },
  { v: 60, label: "Em 1 hora" },
  { v: 1440, label: "Em 1 dia" },
  { v: 2880, label: "Em 2 dias" },
  { v: 10080, label: "Em 1 semana" },
];

export const isStageTrigger = (r: Robot) => r.conditions?.origin === "stage_trigger";

type Form = {
  action: StageTriggerAction;
  when: When;
  delay: number;
  robotId: string;
  text: string;
  subject: string;
  dueMinutes: number;
  tag: string;
  removeTag: boolean;
  targetStage: string;
  userId: string;
  url: string;
  tags: string;
  ownerId: string;
  limitHours: boolean;
  hours: ActiveHours;
  once: boolean;
  applyExisting: boolean;
  /** gatilhos novos */
  tagTrigger: string;
  fieldTrigger: string;
  dailyAt: string;
  keywords: string;
  silence: number;
  stayInStage: boolean;
  /** ações novas */
  fieldId: string;
  fieldValue: string;
  newStage: string;
  newName: string;
};

const blank = (action: StageTriggerAction): Form => ({
  action,
  when: "both",
  delay: 0,
  robotId: "",
  text: "",
  subject: "",
  dueMinutes: 1440,
  tag: "",
  removeTag: false,
  targetStage: "",
  userId: "",
  url: "",
  tags: "",
  ownerId: "",
  limitHours: false,
  hours: { from: "08:00", to: "18:00", days: [1, 2, 3, 4, 5] },
  once: true,
  applyExisting: false,
  tagTrigger: "",
  fieldTrigger: "",
  dailyAt: "09:00",
  keywords: "",
  silence: 1440,
  stayInStage: true,
  fieldId: "",
  fieldValue: "",
  newStage: "",
  newName: "{{lead}}",
});

/** gatilho salvo → formulário */
function fromRobot(r: Robot): Form {
  const c = r.conditions ?? {};
  const f = blank(c.action ?? "robot");
  const first = r.steps[0];
  const act = r.steps[r.steps.length - 1];
  const byTrigger: Partial<Record<RobotInput["trigger"], When>> = { responsible_changed: "owner", tag_added: "tag", field_changed: "field", schedule_daily: "daily", message_in: "message", no_reply: "no_reply" };
  f.when = byTrigger[r.trigger] ?? c.when ?? "both";
  f.delay = first?.type === "wait" ? first.minutes : 0;
  if (f.when === "no_reply") {
    f.silence = f.delay || 1440;
    f.delay = 0;
  }
  f.tagTrigger = c.tagTrigger ?? "";
  f.fieldTrigger = c.fieldTrigger ?? "";
  f.dailyAt = c.dailyAt ?? "09:00";
  f.keywords = r.keywords.join(", ");
  f.stayInStage = c.stayInStage ?? false;
  f.tags = (c.tags ?? []).join(", ");
  f.ownerId = c.ownerId ?? "";
  if (c.hours) {
    f.limitHours = true;
    f.hours = c.hours;
  }
  f.once = r.once;
  switch (act?.type) {
    case "start_robot":
      f.robotId = act.robotId;
      break;
    case "message":
    case "note":
      f.text = act.text;
      break;
    case "email":
      f.subject = act.subject;
      f.text = act.text;
      break;
    case "task":
      f.text = act.text;
      f.dueMinutes = act.dueMinutes;
      break;
    case "tag":
      f.tag = act.tag;
      f.removeTag = !!act.remove;
      break;
    case "stage":
      f.targetStage = act.stageId;
      break;
    case "responsible":
      f.userId = act.userId;
      break;
    case "webhook":
      f.url = act.url;
      break;
    case "set_field":
      f.fieldId = act.fieldId;
      f.fieldValue = act.value;
      break;
    case "create_lead":
      f.newStage = act.stageId;
      f.newName = act.name;
      break;
  }
  return f;
}

const sid = () => crypto.randomUUID().slice(0, 12);

export function StageTriggerDialog({
  slug,
  pipeline,
  stage,
  pipelines,
  robots,
  users,
  existing,
  open,
  onOpenChange,
  leadsInStage,
  fields = [],
}: {
  slug: string;
  pipeline: Pipeline;
  stage: Stage;
  pipelines: Pipeline[];
  robots: Robot[];
  users: { id: string; name: string }[];
  existing?: Robot | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadsInStage?: number;
  /** campos personalizados do lead (para "quando um campo muda" e "alterar campo") */
  fields?: { id: string; name: string }[];
}) {
  const fieldOptions = [{ id: "price", name: "Valor da venda" }, ...fields];
  const [form, setForm] = useState<Form | null>(existing ? fromRobot(existing) : null);
  const [q, setQ] = useState("");
  const [customDelay, setCustomDelay] = useState(existing ? !DELAYS.includes(fromRobot(existing).delay) : false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const myRobots = useMemo(() => robots.filter((r) => !isStageTrigger(r)), [robots]);
  const found = myRobots.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const opt = form && OPTIONS.find((o) => o.action === form.action);

  function reset(o: boolean) {
    onOpenChange(o);
    if (o) {
      setForm(existing ? fromRobot(existing) : null);
      setCustomDelay(existing ? !DELAYS.includes(fromRobot(existing).delay) : false);
      setQ("");
      setError(null);
    }
  }

  /** formulário → robô (gatilho) */
  function build(f: Form): RobotInput | string {
    let step: RobotStep;
    let detail: string;
    switch (f.action) {
      case "robot": {
        const r = myRobots.find((x) => x.id === f.robotId);
        if (!r) return "Escolha o robô que vai rodar.";
        step = { id: sid(), type: "start_robot", robotId: r.id };
        detail = r.name;
        break;
      }
      case "message":
        if (!f.text.trim()) return "Escreva a mensagem.";
        step = { id: sid(), type: "message", text: f.text.trim() };
        detail = f.text.trim().slice(0, 40);
        break;
      case "email":
        if (!f.subject.trim()) return "Escreva o assunto do email.";
        if (!f.text.trim()) return "Escreva o texto do email.";
        step = { id: sid(), type: "email", subject: f.subject.trim(), text: f.text.trim() };
        detail = f.subject.trim().slice(0, 40);
        break;
      case "task":
        if (!f.text.trim()) return "Escreva o texto da tarefa.";
        step = { id: sid(), type: "task", text: f.text.trim(), dueMinutes: f.dueMinutes };
        detail = f.text.trim().slice(0, 40);
        break;
      case "tag":
        if (!f.tag.trim()) return "Escreva a etiqueta.";
        step = { id: sid(), type: "tag", tag: f.tag.trim(), remove: f.removeTag || undefined };
        detail = `${f.removeTag ? "tirar" : "colocar"} “${f.tag.trim()}”`;
        break;
      case "stage": {
        const st = pipelines.flatMap((p) => p.stages).find((s) => s.id === f.targetStage);
        if (!st) return "Escolha a etapa de destino.";
        step = { id: sid(), type: "stage", stageId: st.id };
        detail = `para ${st.name}`;
        break;
      }
      case "responsible": {
        const u = users.find((x) => x.id === f.userId);
        if (!u) return "Escolha o novo responsável.";
        step = { id: sid(), type: "responsible", userId: u.id };
        detail = u.name;
        break;
      }
      case "note":
        if (!f.text.trim()) return "Escreva a nota.";
        step = { id: sid(), type: "note", text: f.text.trim() };
        detail = f.text.trim().slice(0, 40);
        break;
      case "webhook":
        if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(f.url.trim())) return "O webhook precisa de um endereço https:// válido.";
        step = { id: sid(), type: "webhook", url: f.url.trim() };
        detail = new URL(f.url.trim()).hostname;
        break;
      case "ai_on":
      case "ai_off":
        step = { id: sid(), type: "ai", on: f.action === "ai_on" };
        detail = "";
        break;
      case "complete_tasks":
        step = { id: sid(), type: "complete_tasks" };
        detail = "";
        break;
      case "field": {
        const fd = fieldOptions.find((x) => x.id === f.fieldId);
        if (!fd) return "Escolha o campo.";
        step = { id: sid(), type: "set_field", fieldId: fd.id, value: f.fieldValue.trim() };
        detail = `${fd.name} = ${f.fieldValue.trim() || "vazio"}`.slice(0, 40);
        break;
      }
      case "create_lead": {
        const st = pipelines.flatMap((p) => p.stages).find((s) => s.id === f.newStage);
        if (!st) return "Escolha a etapa do lead novo.";
        step = { id: sid(), type: "create_lead", stageId: st.id, name: f.newName.trim() };
        detail = `em ${st.name}`;
        break;
      }
    }
    if (f.when === "daily" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.dailyAt)) return "Escolha o horário do gatilho diário.";
    if (f.when === "no_reply" && f.silence < 1) return "Escolha depois de quanto tempo sem resposta.";
    if (f.limitHours && (!f.hours.days.length || f.hours.from === f.hours.to)) return "Confira o horário de atividade: escolha os dias e um início diferente do fim.";
    const tags = f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
    // "sem responder": a espera é o próprio silêncio do cliente; se ele escrever antes, o motor cancela
    const wait = f.when === "no_reply" ? f.silence : f.delay;
    const steps: RobotStep[] = wait > 0 ? [{ id: sid(), type: "wait", minutes: wait }, step] : [step];
    const stageWhen = f.when === "both" || f.when === "moved" || f.when === "created";
    const keywords = f.when === "message" ? f.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 20) : [];
    return {
      name: (detail ? `${SHORT[f.action]}: ${detail}` : SHORT[f.action]).slice(0, 80),
      active: existing ? existing.active : true,
      trigger: TRIGGER_OF[f.when],
      pipelineId: pipeline.id,
      stageId: stage.id,
      channels: [],
      keywords,
      once: f.when === "no_reply" || f.when === "message" || f.when === "daily" ? false : f.once,
      steps,
      conditions: {
        origin: "stage_trigger",
        action: f.action,
        ...(stageWhen ? { when: f.when as "both" | "moved" | "created" } : {}),
        ...(f.when === "tag" && f.tagTrigger.trim() ? { tagTrigger: f.tagTrigger.trim() } : {}),
        ...(f.when === "field" && f.fieldTrigger ? { fieldTrigger: f.fieldTrigger } : {}),
        ...(f.when === "daily" ? { dailyAt: f.dailyAt, ...(existing?.conditions?.dailyDone ? { dailyDone: existing.conditions.dailyDone } : {}) } : {}),
        ...(f.delay > 0 && f.when !== "no_reply" && f.stayInStage ? { stayInStage: true } : {}),
        ...(tags.length ? { tags } : {}),
        ...(f.ownerId ? { ownerId: f.ownerId } : {}),
        ...(f.limitHours ? { hours: f.hours } : {}),
      },
    };
  }

  function save() {
    if (!form) return;
    const input = build(form);
    if (typeof input === "string") return setError(input);
    setError(null);
    start(async () => {
      const r = await saveRobotAction(slug, existing?.id ?? null, input);
      if (!r.ok) return setError(r.error);
      if (form.applyExisting) {
        const a = await applyStageTriggerAction(slug, r.data.id);
        if (!a.ok) return setError(a.error);
      }
      onOpenChange(false);
    });
  }

  function remove() {
    if (!existing) return;
    start(async () => {
      const r = await deleteRobotAction(slug, existing.id);
      if (!r.ok) return setError(r.error);
      onOpenChange(false);
    });
  }

  const title = existing ? `Gatilho em “${stage.name}”` : form ? `${opt?.label} em “${stage.name}”` : `Adicionar à etapa “${stage.name}”`;
  return (
    <Dialog
      open={open}
      onOpenChange={reset}
      size="xl"
      icon={opt?.icon ?? <Plus className="size-5" />}
      title={title}
      description={form ? "Quando ele roda, para quais leads e em que horário." : "Escolha o que acontece com os leads desta etapa."}
      footer={
        form ? (
          <>
            {existing && (
              <Button variant="secondary" className="mr-auto text-danger" onClick={remove} disabled={pending}>
                Excluir gatilho
              </Button>
            )}
            {!existing && (
              <Button variant="secondary" className="mr-auto" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setForm(null)}>
                Voltar
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              {existing ? "Salvar gatilho" : "Adicionar gatilho"}
            </Button>
          </>
        ) : undefined
      }
    >
      {!form ? (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="O que pode acontecer">
          {OPTIONS.map((o) => (
            <li key={o.action}>
              <button
                type="button"
                onClick={() => {
                  setForm(blank(o.action));
                  setCustomDelay(false);
                }}
                className="flex h-full w-full items-start gap-3 rounded-md bg-bg p-3 text-left shadow-[0_0_0_1px_var(--border)] transition-[box-shadow,transform] duration-fast ease-out hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--accent),0_8px_20px_-12px_rgba(31,122,85,.5)]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent" aria-hidden>
                  {o.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-fg">{o.label}</span>
                  <span className="block text-sm text-muted">{o.text}</span>
                </span>
              </button>
            </li>
          ))}
          {SOON.map((o) => (
            <li key={o.label}>
              <div className="flex h-full items-center gap-3 rounded-md border border-dashed border-border p-3 text-muted" aria-disabled>
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface" aria-hidden>
                  {o.icon}
                </span>
                <span className="font-medium">{o.label}</span>
                <span className="ml-auto rounded-pill bg-surface px-2 py-0.5 text-xs">em breve</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ---------- o que faz ---------- */}
          {form.action === "robot" && (
            <section aria-labelledby="t-robo" className="flex flex-col gap-2">
              <h3 id="t-robo" className="text-sm font-semibold text-fg">
                Qual robô roda
              </h3>
              <div className="flex items-center gap-2 rounded-md bg-surface px-3 shadow-[inset_0_0_0_1px_var(--border)] focus-within:shadow-[inset_0_0_0_1px_var(--focus)]">
                <Search className="size-4 text-muted" aria-hidden />
                <label htmlFor="t-busca" className="sr-only">
                  Buscar robô pelo nome
                </label>
                <input id="t-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome…" className="h-9 flex-1 bg-transparent text-sm outline-none" autoComplete="off" />
              </div>
              {myRobots.length === 0 ? (
                <p className="rounded-md bg-surface px-3 py-3 text-sm text-muted">
                  Você ainda não criou nenhum robô.{" "}
                  <Link href={`/${slug}/automations/new`} className="font-medium text-accent-text underline">
                    Criar o primeiro
                  </Link>
                </p>
              ) : (
                <div role="radiogroup" aria-label="Robôs" className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {found.map((r) => {
                    const on = form.robotId === r.id;
                    return (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set({ robotId: r.id })}
                          className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", on ? "bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent)]" : "hover:bg-surface")}
                        >
                          <span className={cn("size-4 shrink-0 rounded-pill border-2", on ? "border-accent bg-accent shadow-[inset_0_0_0_2px_var(--bg)]" : "border-border-input")} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {TRIGGERS[r.trigger].label}
                              {!r.active && " · desligado: não roda sozinho, só quando chamado aqui"}
                            </span>
                          </span>
                          <span className="hidden gap-1 sm:flex">
                            {r.steps.slice(0, 4).map((s) => (
                              <StepBadge key={s.id} type={s.type} size="sm" />
                            ))}
                          </span>
                        </button>
                    );
                  })}
                  {found.length === 0 && <p className="px-3 py-2 text-sm text-muted">Nenhum robô com esse nome.</p>}
                </div>
              )}
{(() => {
                const sel = myRobots.find((r) => r.id === form.robotId);
                return sel?.active ? (
                  <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                    “{sel.name}” também está ligado no próprio gatilho ({TRIGGERS[sel.trigger].label.toLowerCase()}). Para ele rodar só por aqui, desligue-o na lista de robôs.
                  </p>
                ) : null;
              })()}
              <Link href={`/${slug}/automations/new`} className="w-fit text-sm font-medium text-accent-text hover:underline">
                + Criar um robô novo
              </Link>
            </section>
          )}
          {(form.action === "message" || form.action === "note") && (
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              {form.action === "message" ? "Mensagem para o cliente" : "Texto da nota"}
              <textarea
                value={form.text}
                onChange={(e) => set({ text: e.target.value })}
                rows={3}
                maxLength={2000}
                className="rounded-md border border-border-input bg-bg px-3 py-2 text-base font-normal outline-none focus:border-focus"
                placeholder={form.action === "message" ? "Oi, {{nome}}! Vi que você…" : "Ligar antes das 18h"}
              />
              {form.action === "message" && <span className="text-xs font-normal text-muted">Use {"{{nome}}"}, {"{{empresa}}"} e {"{{responsavel}}"}.</span>}
            </label>
          )}
          {form.action === "email" && (
            <div className="flex flex-col gap-3">
              <Field label="Assunto" value={form.subject} onChange={(e) => set({ subject: e.target.value })} maxLength={200} placeholder="{{nome}}, recebemos seu contato" />
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Texto do email
                <textarea
                  value={form.text}
                  onChange={(e) => set({ text: e.target.value })}
                  rows={6}
                  maxLength={5000}
                  className="rounded-md border border-border-input bg-bg px-3 py-2 text-base font-normal outline-none focus:border-focus"
                  placeholder={"Olá, {{nome}}!\n\nObrigado pelo contato…"}
                />
                <span className="text-xs font-normal text-muted">
                  Vai para o email do contato principal, com link de descadastro no rodapé. Use {"{{nome}}"}, {"{{empresa}}"} e {"{{responsavel}}"}. Leads sem email são pulados.
                </span>
              </label>
            </div>
          )}
          {form.action === "task" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Field label="Tarefa" value={form.text} onChange={(e) => set({ text: e.target.value })} maxLength={500} placeholder="Ligar para o cliente" />
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Prazo
                <select value={form.dueMinutes} onChange={(e) => set({ dueMinutes: Number(e.target.value) })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                  {DUE.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {form.action === "tag" && (
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Ação
                <select value={form.removeTag ? "remove" : "add"} onChange={(e) => set({ removeTag: e.target.value === "remove" })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                  <option value="add">Colocar</option>
                  <option value="remove">Tirar</option>
                </select>
              </label>
              <Field label="Etiqueta" value={form.tag} onChange={(e) => set({ tag: e.target.value })} maxLength={40} placeholder="vip" />
            </div>
          )}
          {form.action === "stage" && (
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Levar para
              <select value={form.targetStage} onChange={(e) => set({ targetStage: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                <option value="">Escolha a etapa…</option>
                {pipelines.map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    {[...p.stages]
                      .sort((a, b) => a.sort - b.sort)
                      .filter((s) => s.id !== stage.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          {form.action === "responsible" && (
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Novo responsável
              <select value={form.userId} onChange={(e) => set({ userId: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                <option value="">Escolha a pessoa…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.action === "webhook" && <Field label="Endereço (https://)" value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://hook.make.com/…" inputMode="url" />}
          {(form.action === "ai_on" || form.action === "ai_off") && (
            <p className="rounded-md bg-surface px-3 py-2 text-sm text-muted">
              {form.action === "ai_on"
                ? "A IA volta a responder a conversa deste lead (precisa do agente ligado em Configurações → Agente de IA). Bom para leads que esfriaram."
                : "A IA para nesta conversa e ela aparece como sem resposta para a equipe. Bom para etapas de negociação e fechamento."}
            </p>
          )}
          {form.action === "complete_tasks" && <p className="rounded-md bg-surface px-3 py-2 text-sm text-muted">Todas as tarefas abertas do lead são marcadas como feitas (ex.: ao chegar em Ganho).</p>}
          {form.action === "field" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Campo
                <select value={form.fieldId} onChange={(e) => set({ fieldId: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                  <option value="">Escolha o campo…</option>
                  {fieldOptions.map((fd) => (
                    <option key={fd.id} value={fd.id}>
                      {fd.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Novo valor" value={form.fieldValue} onChange={(e) => set({ fieldValue: e.target.value })} maxLength={500} placeholder={form.fieldId === "price" ? "1500,00" : "Aceita {{utm_campaign}}, {{nome}}…"} />
            </div>
          )}
          {form.action === "create_lead" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Etapa do lead novo
                <select value={form.newStage} onChange={(e) => set({ newStage: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                  <option value="">Escolha a etapa…</option>
                  {pipelines.map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {[...p.stages]
                        .sort((a, b) => a.sort - b.sort)
                        .filter((s) => s.kind === "open")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <Field label="Nome do lead novo" value={form.newName} onChange={(e) => set({ newName: e.target.value })} maxLength={200} placeholder="{{lead}} (pós-venda)" />
            </div>
          )}

          {/* ---------- executar ---------- */}
          <section aria-labelledby="t-exec" className="grid gap-3 rounded-md bg-surface p-3 shadow-[inset_0_0_0_1px_var(--border)] sm:grid-cols-2">
            <h3 id="t-exec" className="text-sm font-semibold text-fg sm:col-span-2">
              Executar
            </h3>
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Quando
              <select value={form.when} onChange={(e) => set({ when: e.target.value as When })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                {WHEN_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((w) => (
                      <option key={w.v} value={w.v}>
                        {w.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="text-xs font-normal text-muted">Vale para os leads que estão em “{stage.name}”.</span>
            </label>
            {form.when === "tag" && <Field label="Etiqueta que dispara" value={form.tagTrigger} onChange={(e) => set({ tagTrigger: e.target.value })} maxLength={40} placeholder="Vazio = qualquer etiqueta" />}
            {form.when === "field" && (
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Campo que dispara
                <select value={form.fieldTrigger} onChange={(e) => set({ fieldTrigger: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                  <option value="">Qualquer campo</option>
                  {fieldOptions.map((fd) => (
                    <option key={fd.id} value={fd.id}>
                      {fd.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.when === "daily" && (
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Horário (Brasília)
                <input type="time" value={form.dailyAt} onChange={(e) => set({ dailyAt: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal" />
                <span className="text-xs font-normal text-muted">Roda uma vez por dia para cada lead que estiver na etapa.</span>
              </label>
            )}
            {form.when === "message" && <Field label="Só com estas palavras (opcional)" value={form.keywords} onChange={(e) => set({ keywords: e.target.value })} placeholder="preço, orçamento" hint="Separe por vírgula. Vazio = qualquer mensagem." />}
            {form.when === "no_reply" && (
              <label className="flex flex-col gap-1 text-sm font-medium text-fg">
                Depois de
                <select value={form.silence} onChange={(e) => set({ silence: Number(e.target.value) })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                  {SILENCE.map((m) => (
                    <option key={m} value={m}>
                      {humanMinutes(m)} sem o cliente escrever
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-muted">Se ele escrever antes, o gatilho é cancelado e o relógio recomeça.</span>
              </label>
            )}
            {form.when !== "no_reply" && (
            <div className="flex flex-col gap-1 text-sm font-medium text-fg">
              <span id="t-atraso">Atraso</span>
              <div role="radiogroup" aria-labelledby="t-atraso" className="flex flex-wrap gap-1">
                {DELAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={!customDelay && form.delay === d}
                    onClick={() => {
                      setCustomDelay(false);
                      set({ delay: d });
                    }}
                    className={cn("h-9 rounded-pill px-3 text-sm font-normal", !customDelay && form.delay === d ? "bg-accent text-on-accent" : "bg-bg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-input)]")}
                  >
                    {d === 0 ? "Na hora" : humanMinutes(d)}
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={customDelay}
                  onClick={() => setCustomDelay(true)}
                  className={cn("h-9 rounded-pill px-3 text-sm font-normal", customDelay ? "bg-accent text-on-accent" : "bg-bg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-input)]")}
                >
                  Outro
                </button>
              </div>
              {customDelay && (
                <label className="mt-1 flex items-center gap-2 text-sm font-normal text-fg">
                  Esperar
                  <input
                    type="number"
                    min={1}
                    max={43200}
                    value={form.delay || ""}
                    onChange={(e) => set({ delay: Math.max(0, Math.min(43200, Math.round(Number(e.target.value) || 0))) })}
                    className="h-9 w-24 rounded-sm border border-border-input bg-bg px-2"
                    aria-label="Minutos de espera"
                  />
                  minutos {form.delay > 0 && <span className="text-muted">({humanMinutes(form.delay)})</span>}
                </label>
              )}
              {form.delay > 0 && (
                <label className="mt-1 flex items-center gap-2 text-sm font-normal text-fg">
                  <input type="checkbox" checked={form.stayInStage} onChange={(e) => set({ stayInStage: e.target.checked })} /> Só se o lead ainda estiver nesta etapa
                </label>
              )}
            </div>
            )}
          </section>

          {/* ---------- para quais leads ---------- */}
          <section aria-labelledby="t-cond" className="grid gap-3 sm:grid-cols-2">
            <h3 id="t-cond" className="text-sm font-semibold text-fg sm:col-span-2">
              Para leads com <span className="font-normal text-muted">(opcional)</span>
            </h3>
            <Field label="Etiquetas (separe por vírgula)" value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="vip, indicação" hint="Roda se o lead tiver alguma delas." />
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Responsável
              <select value={form.ownerId} onChange={(e) => set({ ownerId: e.target.value })} className="h-10 rounded-sm border border-border-input bg-bg px-2 text-base font-normal">
                <option value="">Qualquer pessoa</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* ---------- horário ---------- */}
          <section aria-labelledby="t-hora" className="flex flex-col gap-2">
            <h3 id="t-hora" className="text-sm font-semibold text-fg">
              Horário de atividade
            </h3>
            <div role="radiogroup" aria-labelledby="t-hora" className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="t-hora" checked={!form.limitHours} onChange={() => set({ limitHours: false })} /> Sempre (24h)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="t-hora" checked={form.limitHours} onChange={() => set({ limitHours: true })} /> Só em alguns horários
              </label>
            </div>
            {form.limitHours && (
              <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface p-3 text-sm shadow-[inset_0_0_0_1px_var(--border)]">
                <label className="flex items-center gap-2">
                  Das
                  <input type="time" value={form.hours.from} onChange={(e) => set({ hours: { ...form.hours, from: e.target.value } })} className="h-9 rounded-sm border border-border-input bg-bg px-2" />
                </label>
                <label className="flex items-center gap-2">
                  às
                  <input type="time" value={form.hours.to} onChange={(e) => set({ hours: { ...form.hours, to: e.target.value } })} className="h-9 rounded-sm border border-border-input bg-bg px-2" />
                </label>
                <fieldset className="flex flex-wrap gap-1">
                  <legend className="sr-only">Dias da semana</legend>
                  {DAYS.map((d, i) => {
                    const on = form.hours.days.includes(i);
                    return (
                      <label key={d} className={cn("cursor-pointer rounded-pill px-2.5 py-1", on ? "bg-accent text-on-accent" : "bg-bg shadow-[inset_0_0_0_1px_var(--border)]")}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => set({ hours: { ...form.hours, days: on ? form.hours.days.filter((x) => x !== i) : [...form.hours.days, i].sort() } })}
                        />
                        {d}
                      </label>
                    );
                  })}
                </fieldset>
                <p className="w-full text-xs text-muted">Horário de Brasília. Fora dele o gatilho não roda.</p>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-2 text-sm">
            {form.when !== "no_reply" && form.when !== "message" && form.when !== "daily" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.once} onChange={(e) => set({ once: e.target.checked })} /> Rodar só uma vez por lead
              </label>
            )}
            {(["both", "moved", "created", "owner", "daily"] as When[]).includes(form.when) && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.applyExisting} onChange={(e) => set({ applyExisting: e.target.checked })} />
                {form.when === "daily" ? "Rodar agora também" : "Aplicar também aos leads que já estão nesta etapa"}
                {typeof leadsInStage === "number" ? ` (${leadsInStage})` : ""}
              </label>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
