"use client";

import { useRef, type ReactNode } from "react";
import type { CustomField, Robot, RobotStep, Template, User } from "@/data/types";
import { Field } from "@/components/ui/input";
import { IconButton } from "@/components/ui/button";
import { Plus, X } from "@/components/ui/icons";
import { VARIABLES, newBranch } from "@/lib/robot-meta";
import { cn } from "@/lib/cn";

/* Campos de cada tipo de passo do robô (usados dentro das caixas do quadro). */

const UNITS = [
  { v: 1, label: "minutos" },
  { v: 60, label: "horas" },
  { v: 1440, label: "dias" },
] as const;
const splitMinutes = (m: number) => {
  const u = m >= 1440 && m % 1440 === 0 ? 1440 : m >= 60 && m % 60 === 0 ? 60 : 1;
  return { n: m / u, u };
};

export const selectCls = "h-10 w-full rounded-md border border-border px-2 text-sm text-fg";

export type StepCtx = { users: User[]; templates: Template[]; fields: CustomField[]; robots: Pick<Robot, "id" | "name">[]; stageOptions: ReactNode };

export function MinutesInput({ label, value, onChange, allowZero }: { label: string; value: number; onChange: (m: number) => void; allowZero?: boolean }) {
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
        onChange={(e) => onChange(Math.max(allowZero ? 0 : 1, Math.round(Number(e.target.value) || 0)) * u)}
        className="w-24"
      />
      <select aria-label={`${label}: unidade`} value={u} onChange={(e) => onChange(n * Number(e.target.value))} className={cn(selectCls, "w-32")}>
        {UNITS.map((x) => (
          <option key={x.v} value={x.v}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextWithVars({ label, value, onChange, rows = 3, templates }: { label: string; value: string; onChange: (v: string) => void; rows?: number; templates?: Template[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (t: string) => {
    const el = ref.current;
    const at = el?.selectionStart ?? value.length;
    onChange(value.slice(0, at) + t + value.slice(el?.selectionEnd ?? at));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + t.length, at + t.length);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-fg">
        {label}
        <textarea ref={ref} rows={rows} value={value} maxLength={2000} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full resize-y border border-border text-sm font-normal text-fg" />
      </label>
      <div className="flex flex-wrap items-center gap-1">
        {VARIABLES.slice(0, 5).map((v) => (
          <button key={v.key} type="button" onClick={() => insert(`{{${v.key}}}`)} className="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-text hover:bg-[color-mix(in_srgb,var(--accent)_20%,var(--bg))]">
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
            className="ml-auto h-7 rounded-sm border border-border px-1.5 text-xs text-fg"
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

/** Lista de saídas com rótulo (botões, regras). A porta de cada saída fica no quadro, na mesma linha. */
function BranchList({
  items,
  onChange,
  placeholder,
  addLabel,
  max,
  port,
  prefix,
}: {
  items: { id: string; label: string }[];
  onChange: (items: { id: string; label: string }[]) => void;
  placeholder: string;
  addLabel: string;
  max: number;
  port: (handle: string) => ReactNode;
  prefix?: (i: number) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((b, i) => (
        <div key={b.id} className="relative flex items-center gap-1.5">
          {prefix?.(i)}
          <Field label={`${placeholder} ${i + 1}`} hideLabel value={b.label} placeholder={placeholder} maxLength={60} className="flex-1" onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <IconButton label="Remover" size={28} tone="danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="size-3.5" />
          </IconButton>
          {port(b.id)}
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, newBranch()])} className="inline-flex w-fit items-center gap-1 rounded-pill px-2 py-1 text-xs font-medium text-accent-text hover:bg-accent-soft">
          <Plus className="size-3.5" aria-hidden /> {addLabel}
        </button>
      )}
    </div>
  );
}

/** Saída fixa com rótulo (senão, sem resposta, inválida). */
function ExitRow({ label, port }: { label: string; port: ReactNode }) {
  return (
    <div className="relative flex h-8 items-center justify-end rounded-md bg-surface px-3 text-xs text-muted">
      {label}
      {port}
    </div>
  );
}

export function StepBody({ step, onChange, ctx, port }: { step: RobotStep; onChange: (s: RobotStep) => void; ctx: StepCtx; port: (handle: string) => ReactNode }) {
  switch (step.type) {
    case "message":
      return (
        <div className="flex flex-col gap-3">
          <TextWithVars label="Mensagem" value={step.text} onChange={(text) => onChange({ ...step, text })} rows={3} templates={ctx.templates} />
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Botões de resposta (cada um leva a um caminho)</p>
            <BranchList
              items={step.buttons ?? []}
              onChange={(buttons) => onChange({ ...step, buttons: buttons.map((b) => ({ next: null, ...(step.buttons ?? []).find((x) => x.id === b.id), ...b })) })}
              placeholder="Texto do botão"
              addLabel="Adicionar botão"
              max={10}
              port={port}
              prefix={(i) => <span className="w-4 text-center text-xs tabular-nums text-muted">{i + 1}</span>}
            />
            {(step.buttons?.length ?? 0) > 0 && <div className="mt-1.5"><ExitRow label="Respondeu outra coisa / não respondeu em 24h" port={port("else")} /></div>}
          </div>
        </div>
      );
    case "wait":
      return <MinutesInput label="Esperar" value={step.minutes} onChange={(minutes) => onChange({ ...step, minutes })} />;
    case "wait_reply":
      return (
        <div className="flex flex-col gap-2">
          <MinutesInput label="Esperar até" value={step.minutes} onChange={(minutes) => onChange({ ...step, minutes })} />
          <p className="text-xs text-muted">Respondeu: segue pela saída principal (embaixo).</p>
          <ExitRow label="Não respondeu no prazo" port={port("timeout")} />
        </div>
      );
    case "validate":
      return (
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1 text-sm font-medium text-fg">
            O que conferir
            <select value={step.kind} onChange={(e) => onChange({ ...step, kind: e.target.value as typeof step.kind })} className={cn(selectCls, "font-normal")}>
              <option value="email">Email</option>
              <option value="phone">Telefone</option>
              <option value="cpf">CPF</option>
              <option value="number">Número</option>
              <option value="any">Qualquer resposta</option>
            </select>
          </label>
          <TextWithVars label="Pergunta" value={step.question} onChange={(question) => onChange({ ...step, question })} rows={2} />
          <Field label="Se a resposta for inválida, dizer" value={step.retryText} onChange={(e) => onChange({ ...step, retryText: e.target.value })} maxLength={500} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tentativas" type="number" min={1} max={5} value={step.tries} onChange={(e) => onChange({ ...step, tries: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
            <label className="flex flex-col gap-1 text-sm font-medium text-fg">
              Guardar em
              <select value={step.saveFieldId ?? ""} onChange={(e) => onChange({ ...step, saveFieldId: e.target.value || undefined })} className={cn(selectCls, "font-normal")}>
                <option value="">Nota no lead</option>
                {ctx.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    Campo: {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ExitRow label="Errou todas as tentativas" port={port("fail")} />
        </div>
      );
    case "condition":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-fg">
            Olhar para
            <select value={step.source} onChange={(e) => onChange({ ...step, source: e.target.value as typeof step.source })} className={cn(selectCls, "font-normal")}>
              <option value="message">Última mensagem do cliente</option>
              <option value="utm_campaign">Campanha (UTM)</option>
              <option value="utm_source">Fonte (UTM)</option>
              <option value="tag">Etiquetas do lead</option>
              <option value="channel">Canal (whatsapp, instagram…)</option>
            </select>
          </label>
          <div className="flex flex-col gap-1.5">
            {step.rules.map((rule, i) => (
              <div key={rule.id} className="relative flex items-center gap-1.5">
                <select
                  aria-label={`Regra ${i + 1}: comparação`}
                  value={rule.op}
                  onChange={(e) => onChange({ ...step, rules: step.rules.map((x, j) => (j === i ? { ...x, op: e.target.value as typeof rule.op } : x)) })}
                  className="h-8 w-28 rounded-sm border border-border px-1.5 text-xs text-fg"
                >
                  <option value="contains">contém</option>
                  <option value="equals">é igual a</option>
                  <option value="not_contains">não contém</option>
                </select>
                <Field label={`Regra ${i + 1}: valor`} hideLabel value={rule.label} placeholder="valor" maxLength={60} className="flex-1" onChange={(e) => onChange({ ...step, rules: step.rules.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <IconButton label="Remover regra" size={28} tone="danger" disabled={step.rules.length === 1} onClick={() => onChange({ ...step, rules: step.rules.filter((_, j) => j !== i) })}>
                  <X className="size-3.5" />
                </IconButton>
                {port(rule.id)}
              </div>
            ))}
            {step.rules.length < 10 && (
              <button type="button" onClick={() => onChange({ ...step, rules: [...step.rules, { ...newBranch(), op: "contains" }] })} className="inline-flex w-fit items-center gap-1 rounded-pill px-2 py-1 text-xs font-medium text-accent-text hover:bg-accent-soft">
                <Plus className="size-3.5" aria-hidden /> Adicionar regra
              </button>
            )}
          </div>
          <ExitRow label="Senão (nenhuma regra bateu)" port={port("else")} />
        </div>
      );
    case "round_robin":
      return (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Vendedores no rodízio</legend>
          <div className="flex flex-col gap-1">
            {ctx.users.map((u) => {
              const on = step.userIds.includes(u.id);
              return (
                <label key={u.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", on ? "bg-accent-soft text-fg" : "hover:bg-surface")}>
                  <input type="checkbox" checked={on} onChange={() => onChange({ ...step, userIds: on ? step.userIds.filter((x) => x !== u.id) : [...step.userIds, u.id] })} className="size-4 accent-[var(--accent)]" />
                  {u.name || u.email}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">Cada lead novo vai para o próximo da lista, em sequência.</p>
        </fieldset>
      );
    case "internal":
      return <TextWithVars label="Aviso no chat da equipe" value={step.text} onChange={(text) => onChange({ ...step, text })} rows={2} />;
    case "task":
      return (
        <div className="flex flex-col gap-2.5">
          <Field label="Tarefa" value={step.text} onChange={(e) => onChange({ ...step, text: e.target.value })} maxLength={500} hint="Vai para o responsável do lead. Aceita {{nome}}." />
          <MinutesInput label="Prazo em" value={step.dueMinutes} onChange={(dueMinutes) => onChange({ ...step, dueMinutes })} allowZero />
        </div>
      );
    case "tag":
      return (
        <div className="flex items-end gap-2">
          <select aria-label="Adicionar ou remover" value={step.remove ? "remove" : "add"} onChange={(e) => onChange({ ...step, remove: e.target.value === "remove" })} className={cn(selectCls, "w-32")}>
            <option value="add">Adicionar</option>
            <option value="remove">Remover</option>
          </select>
          <Field label="Etiqueta" hideLabel value={step.tag} onChange={(e) => onChange({ ...step, tag: e.target.value })} maxLength={40} placeholder="Ex.: quente" className="flex-1" />
        </div>
      );
    case "responsible":
      return (
        <label className="flex flex-col gap-1 text-sm font-medium text-fg">
          Novo responsável
          <select value={step.userId} onChange={(e) => onChange({ ...step, userId: e.target.value })} className={cn(selectCls, "font-normal")}>
            <option value="">Escolha…</option>
            {ctx.users.map((u) => (
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
          <select value={step.stageId} onChange={(e) => onChange({ ...step, stageId: e.target.value })} className={cn(selectCls, "font-normal")}>
            <option value="">Escolha a etapa…</option>
            {ctx.stageOptions}
          </select>
          <span className="text-xs font-normal text-muted">Robôs da etapa de destino também rodam.</span>
        </label>
      );
    case "note":
      return <TextWithVars label="Nota interna" value={step.text} onChange={(text) => onChange({ ...step, text })} rows={2} />;
    case "set_field":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-fg">
            Campo
            <select value={step.fieldId} onChange={(e) => onChange({ ...step, fieldId: e.target.value })} className={cn(selectCls, "font-normal")}>
              <option value="">Escolha o campo…</option>
              {ctx.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Valor" value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value })} maxLength={500} placeholder="Aceita {{utm_campaign}}, {{nome}}…" />
          {!ctx.fields.length && <p className="text-xs text-warning">Crie campos em Configurações → Campos personalizados.</p>}
        </div>
      );
    case "email":
      return (
        <div className="flex flex-col gap-2">
          <Field label="Assunto" value={step.subject} onChange={(e) => onChange({ ...step, subject: e.target.value })} maxLength={200} placeholder="{{nome}}, sua proposta chegou" />
          <TextWithVars label="Texto do email" value={step.text} onChange={(text) => onChange({ ...step, text })} rows={5} />
          <span className="text-xs text-muted">Vai para o email do contato principal, com link de descadastro no rodapé. Precisa do Resend configurado.</span>
        </div>
      );
    case "webhook":
      return <Field label="Endereço (https)" value={step.url} onChange={(e) => onChange({ ...step, url: e.target.value })} maxLength={500} hint="Recebe um POST com o lead, o contato e a origem (UTM). Funciona com Zapier e Make." />;
    case "start_robot":
      return (
        <label className="flex flex-col gap-1 text-sm font-medium text-fg">
          Robô
          <select value={step.robotId} onChange={(e) => onChange({ ...step, robotId: e.target.value })} className={cn(selectCls, "font-normal")}>
            <option value="">Escolha o robô…</option>
            {ctx.robots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      );
    case "close":
      return <p className="text-sm text-muted">Fecha a conversa (sai de “abertas” na caixa de entrada).</p>;
    case "ai":
      return (
        <label className="flex flex-col gap-1 text-sm font-medium text-fg">
          Agente de IA
          <select value={step.on ? "on" : "off"} onChange={(e) => onChange({ ...step, on: e.target.value === "on" })} className={cn(selectCls, "font-normal")}>
            <option value="on">Ligar nesta conversa</option>
            <option value="off">Parar nesta conversa (a equipe assume)</option>
          </select>
          <span className="text-xs font-normal text-muted">Precisa do agente ligado em Configurações → Agente de IA.</span>
        </label>
      );
    case "complete_tasks":
      return <p className="text-sm text-muted">Marca como feitas todas as tarefas abertas do lead.</p>;
    case "create_lead":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-fg">
            Etapa do lead novo
            <select value={step.stageId} onChange={(e) => onChange({ ...step, stageId: e.target.value })} className={cn(selectCls, "font-normal")}>
              <option value="">Escolha a etapa…</option>
              {ctx.stageOptions}
            </select>
          </label>
          <Field label="Nome do lead novo" value={step.name} onChange={(e) => onChange({ ...step, name: e.target.value })} maxLength={200} placeholder="{{lead}} (pós-venda)" />
        </div>
      );
    case "stop":
      return <p className="text-sm text-muted">O robô termina aqui.</p>;
  }
}
