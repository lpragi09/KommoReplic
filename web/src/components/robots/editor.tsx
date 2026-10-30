"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChannelKind, CustomField, Pipeline, Robot, RobotInput, RobotRun, RobotStep, RobotTrigger, Template, User } from "@/data/types";
import { deleteRobotAction, saveRobotAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import { CheckCheck, CircleCheck, Clock, Trash2, XCircle } from "@/components/ui/icons";
import { CHANNELS, TRIGGERS, humanMinutes } from "@/lib/robot-meta";

const EDITOR_TRIGGERS: RobotTrigger[] = ["stage_enter", "lead_created", "message_in", "new_contact", "responsible_changed"];
import { cn } from "@/lib/cn";
import { Switch, channelIcon } from "./parts";
import { FlowCanvas, normalizeFlow, type Start } from "./canvas";

type Run = RobotRun & { leadName: string | null };

const selectCls =
  "h-10 w-full rounded-sm border border-border bg-bg px-2 text-base text-fg shadow-[inset_0_1px_2px_rgba(20,28,24,.06)] hover:border-border-input focus:border-focus focus:outline-none focus:shadow-[0_0_0_4px_rgba(31,122,85,.15)]";

export function RobotEditor({
  slug,
  robotId,
  initial,
  pipelines,
  users,
  templates,
  runs,
  connected,
  fields,
  robots,
}: {
  slug: string;
  robotId: string | null;
  initial: RobotInput;
  pipelines: Pipeline[];
  users: User[];
  templates: Template[];
  runs: Run[];
  connected: ChannelKind[];
  fields: CustomField[];
  robots: Pick<Robot, "id" | "name">[];
}) {
  const router = useRouter();
  const [r, setR] = useState<RobotInput>(() => {
    const n = normalizeFlow(initial.steps, initial.start);
    return { ...initial, steps: n.steps, start: n.start };
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<RobotInput>) => {
    setSaved(false);
    setR((cur) => ({ ...cur, ...patch }));
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
      case "responsible_changed":
        return st ? `Responsável muda (lead em “${st.name}”)` : "Responsável do lead muda";
      default:
        return `${TRIGGERS[r.trigger].label}${st ? ` (lead em “${st.name}”)` : ""}`;
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
            {// os gatilhos novos (etiqueta, campo, sem resposta, diário) se configuram pelo funil digital
            (Object.keys(TRIGGERS) as RobotTrigger[]).filter((t) => EDITOR_TRIGGERS.includes(t) || t === r.trigger).map((t) => (
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
            <span className="text-xs text-muted">Aparecem as etapas de todos os seus funis, separadas por funil. Etapa ou funil novo entra aqui sozinho.</span>
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
          <legend className="mb-1 text-sm font-medium text-fg">Filtrar por anúncio (opcional)</legend>
          <p className="mb-2 text-xs text-muted">Para o robô rodar só com quem veio de um anúncio ou campanha. A origem vem dos links rastreáveis e das UTMs (Configurações → Rastreamento).</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-fg">
            <span>Rodar para</span>
            <select
              aria-label="Campo da UTM"
              value={r.conditions?.utmField ?? ""}
              onChange={(e) => set({ conditions: { ...r.conditions, utmField: (e.target.value || undefined) as NonNullable<RobotInput["conditions"]>["utmField"] } })}
              className={cn(selectCls, "w-auto min-w-[11rem] flex-none")}
            >
              <option value="">todos os leads</option>
              <option value="utm_campaign">quem veio da campanha</option>
              <option value="utm_source">quem veio da fonte</option>
              <option value="utm_medium">quem veio da mídia</option>
              <option value="utm_content">quem veio do anúncio</option>
              <option value="utm_term">quem buscou o termo</option>
            </select>
            {r.conditions?.utmField && (
              <Field
                label="Contém"
                hideLabel
                className="min-w-[9rem] flex-1"
                placeholder="ex.: black-friday"
                value={r.conditions?.utmContains ?? ""}
                onChange={(e) => set({ conditions: { ...r.conditions, utmContains: e.target.value } })}
              />
            )}
          </div>
          {r.conditions?.utmField && (
            <p className="mt-1.5 text-xs text-muted">Basta conter o texto; maiúscula não importa. Ex.: “black” pega “black-friday” e “Black Novembro”.</p>
          )}
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

      {/* ---------- quadro do fluxo ---------- */}
      <div className="flex min-h-[560px] min-w-0 flex-1 flex-col">
        <FlowCanvas
          steps={r.steps}
          start={r.start as Start}
          onChange={(steps, st) => set({ steps, start: st })}
          triggerText={triggerText}
          ctx={{ users, templates, fields, robots: robots.filter((x) => x.id !== robotId), stageOptions: stageOptions((k) => k !== "lost") }}
        />

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
              icon={<Trash2 className="size-5" />}
              tone="danger"
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
              className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-md rounded-br-xs bg-accent px-3 py-2 text-sm text-on-accent shadow-[0_4px_12px_-6px_rgba(31,122,85,.6)]"
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
