"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import {
  Building2,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Trash2,
  Trophy,
  XCircle,
} from "@/components/ui/icons";
import type {
  Attribution,
  Company,
  Contact,
  CustomField,
  FieldValue,
  LeadCard,
  LossReason,
  Stage,
} from "@/data/types";
import { CustomFieldInput } from "./custom-field";
import { LeadOrigin } from "./origin";
import {
  deleteLeadAction,
  moveLeadAction,
  updateLeadAction,
} from "@/app/actions";
import { leadTitle, money, moneyInput, phone } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar, Tag } from "@/components/ui/bits";
import { useToast } from "@/components/ui/interactive";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/overlay";
import { LostDialog, stageBar } from "@/components/pipeline/kanban";
import { BackButton } from "@/components/shell/back-button";

type Props = {
  slug: string;
  lead: LeadCard;
  stages: Stage[];
  contacts: Contact[];
  company: Company | null;
  users: { id: string; name: string }[];
  lossReasons: LossReason[];
  lossReasonName: string | null;
  fields?: CustomField[];
  custom?: Record<string, FieldValue>;
  attribution?: Attribution | null;
};

export function LeadPanel({
  slug,
  lead,
  stages,
  contacts,
  company,
  users,
  lossReasons,
  lossReasonName,
  fields = [],
  custom = {},
  attribution = null,
}: Props) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [askLost, setAskLost] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stage = stages.find((s) => s.id === lead.stageId)!;
  const open = stages.filter((s) => s.kind === "open");
  const won = stages.find((s) => s.kind === "won")!;
  const lost = stages.find((s) => s.kind === "lost")!;
  const idx = open.findIndex((s) => s.id === lead.stageId);

  const run = (p: Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await p;
      if (!r.ok) toast.show({ text: r.error ?? "Erro", tone: "error" });
    });
  const move = (stageId: string, reason?: string) =>
    run(moveLeadAction(slug, lead.id, stageId, reason));
  const patch = (p: Parameters<typeof updateLeadAction>[2]) =>
    run(updateLeadAction(slug, lead.id, p));

  return (
    <aside
      aria-label="Dados do lead"
      className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-border bg-bg lg:w-[var(--entity-panel)] lg:border-r"
    >
      {stage.kind !== "open" && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium",
            stage.kind === "won"
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger",
          )}
        >
          {stage.kind === "won" ? (
            <Trophy className="size-4" aria-hidden />
          ) : (
            <XCircle className="size-4" aria-hidden />
          )}
          {stage.kind === "won"
            ? "Negócio ganho"
            : `Negócio perdido${lossReasonName ? ` · ${lossReasonName}` : ""}`}
          <button
            className="ml-auto text-xs underline"
            onClick={() => move(open[0].id)}
            disabled={pending}
          >
            Reabrir
          </button>
        </div>
      )}

      <div className="flex items-start gap-2 px-4 pt-4">
        <BackButton fallback={`/${slug}/leads`} className="-ml-2" />
        <div className="min-w-0 flex-1">
          <InlineText
            label="Nome do lead"
            value={lead.name}
            placeholder={leadTitle(lead)}
            display={leadTitle(lead)}
            onSave={(v) => patch({ name: v })}
            big
          />
          <p className="text-xs text-muted">#{lead.number}</p>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label="Mais ações">
              <MoreHorizontal className="size-4" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-44 rounded-md border border-border bg-bg p-1 shadow-pop"
            >
              <DropdownMenu.Item
                onSelect={() => setConfirmDelete(true)}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
              >
                <Trash2 className="size-4" aria-hidden /> Excluir lead
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* seletor de etapa */}
      <div className="px-4 pt-3">
        <div
          role="radiogroup"
          aria-label="Etapa do funil"
          className="flex gap-0.5"
        >
          {open.map((s, i) => {
            const on = s.id === lead.stageId;
            const passed = stage.kind !== "open" ? true : i <= idx;
            return (
              <button
                key={s.id}
                role="radio"
                aria-checked={on}
                title={s.name}
                disabled={pending}
                onClick={() => move(s.id)}
                className={cn(
                  "h-2 flex-1 rounded-pill transition-opacity first:rounded-l-pill",
                  passed ? stageBar[s.color] : "bg-canvas",
                  !on && "opacity-80 hover:opacity-100",
                )}
              >
                <span className="sr-only">{s.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-sm text-fg">
          <span className="text-muted">Etapa:</span> {stage.name}
        </p>
        {stage.kind === "open" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="text-success"
              icon={<Trophy className="size-4" aria-hidden />}
              onClick={() => move(won.id)}
              disabled={pending}
            >
              Ganho
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-danger"
              icon={<XCircle className="size-4" aria-hidden />}
              onClick={() => setAskLost(true)}
              disabled={pending}
            >
              Perdido
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <Tabs
          tabs={[
            {
              value: "main",
              label: "Principal",
              content: (
                <>
                  <dl className="flex flex-col divide-y divide-border">
                    <Row label="Valor">
                      <InlineText
                        label="Valor"
                        value={moneyInput(lead.priceCents)}
                        display={money(lead.priceCents)}
                        inputMode="decimal"
                        prefix="R$"
                        onSave={(v) => patch({ price: v })}
                      />
                    </Row>
                    <Row label="Responsável">
                      <label className="sr-only" htmlFor="owner">
                        Responsável
                      </label>
                      <select
                        id="owner"
                        value={lead.responsibleUserId ?? ""}
                        onChange={(e) =>
                          patch({ responsibleUserId: e.target.value || null })
                        }
                        className="h-8 w-full rounded-sm border border-transparent bg-transparent px-1 text-base text-fg hover:border-border-input focus:border-focus"
                      >
                        <option value="">Sem responsável</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </Row>
                    <Row label="Tags">
                      <TagEditor
                        tags={lead.tags}
                        onChange={(tags) => patch({ tags })}
                      />
                    </Row>
                    <Row label="Origem">
                      <span className="px-1 text-base text-fg">
                        {(
                          {
                            manual: "Manual",
                            chat: "Chat",
                            form: "Formulário",
                            call: "Ligação",
                            email: "Email",
                          } as Record<string, string>
                        )[lead.source] ?? lead.source}
                      </span>
                    </Row>
                    {fields.map((f) => (
                      <Row key={f.id} label={f.name}>
                        <CustomFieldInput
                          slug={slug}
                          leadId={lead.id}
                          field={f}
                          value={custom[f.id]}
                          onError={(text) =>
                            toast.show({ text, tone: "error" })
                          }
                        />
                      </Row>
                    ))}
                  </dl>
                  <Link
                    href={`/${slug}/settings/fields`}
                    className="mt-1 inline-block py-1 text-xs text-muted hover:text-accent-text hover:underline"
                  >
                    {fields.length
                      ? "Editar campos"
                      : "+ Criar campos personalizados"}
                  </Link>
                </>
              ),
            },
            {
              value: "origin",
              label: "Origem",
              content: (
                <LeadOrigin
                  slug={slug}
                  leadId={lead.id}
                  attribution={attribution}
                />
              ),
            },
            {
              value: "stats",
              label: "Estatísticas",
              content: (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted">Criado em</dt>
                    <dd className="text-fg" suppressHydrationWarning>
                      {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Última atividade</dt>
                    <dd className="text-fg" suppressHydrationWarning>
                      {new Date(lead.lastActivityAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </dd>
                  </div>
                </dl>
              ),
            },
          ]}
        />
      </div>

      <section aria-labelledby="contatos" className="px-4 py-4">
        <h2 id="contatos" className="mb-2 text-caps uppercase text-muted">
          Contatos
        </h2>
        {contacts.length === 0 && (
          <p className="text-sm text-muted">Nenhum contato vinculado.</p>
        )}
        <ul className="flex flex-col gap-2">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Avatar name={c.name} size={32} />
                <Link
                  href={`/${slug}/contacts/${c.id}`}
                  className="min-w-0 truncate font-medium text-fg hover:underline"
                >
                  {c.name}
                </Link>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {c.identities
                  .filter((i) => i.kind === "phone" || i.kind === "email")
                  .map((i) => (
                    <li key={i.kind + i.value}>
                      <a
                        href={
                          i.kind === "phone"
                            ? `tel:${i.value}`
                            : `mailto:${i.value}`
                        }
                        className="inline-flex items-center gap-1.5 text-accent-text hover:underline"
                      >
                        {i.kind === "phone" ? (
                          <Phone className="size-3.5" aria-hidden />
                        ) : (
                          <Mail className="size-3.5" aria-hidden />
                        )}
                        {i.kind === "phone" ? phone(i.value) : i.value}
                      </a>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
        {company && (
          <Link
            href={`/${slug}/companies/${company.id}`}
            className="mt-3 flex items-center gap-2 text-sm text-fg hover:underline"
          >
            <Building2 className="size-4 text-muted" aria-hidden />{" "}
            {company.name}
          </Link>
        )}
      </section>

      <LostDialog
        open={askLost}
        reasons={lossReasons}
        onCancel={() => setAskLost(false)}
        onConfirm={(r) => {
          setAskLost(false);
          move(lost.id, r);
        }}
      />
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        size="sm"
        icon={<Trash2 className="size-5" />}
        tone="danger"
        title="Excluir este lead?"
        description={`“${leadTitle(lead)}” sai do funil com notas e tarefas. Contatos e conversas ficam.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteLeadAction(slug, lead.id);
                  if (r.ok) router.push(`/${slug}/leads`);
                  else toast.show({ text: r.error, tone: "error" });
                })
              }
            >
              Excluir
            </Button>
          </>
        }
      />
      {toast.node}
    </aside>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 py-1.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Campo que se edita no lugar: Enter ou sair do campo salva, Esc cancela. */
function InlineText({
  label,
  value,
  display,
  placeholder,
  onSave,
  big,
  prefix,
  inputMode,
}: {
  label: string;
  value: string;
  display: string;
  placeholder?: string;
  onSave: (v: string) => void;
  big?: boolean;
  prefix?: string;
  inputMode?: "decimal";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const done = (save: boolean) => {
    setEditing(false);
    if (save && draft !== value) onSave(draft);
  };
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={`Editar ${label.toLowerCase()}: ${display}`}
        className={cn(
          "group flex w-full min-w-0 items-center gap-1 rounded-sm px-1 text-left hover:bg-surface",
          big ? "text-xl text-fg" : "h-8 text-base text-fg",
        )}
      >
        <span className="min-w-0 break-words">{display}</span>
        <Pencil
          className="size-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100"
          aria-hidden
        />
      </button>
    );
  }
  return (
    <div
      data-editing
      className="flex items-center gap-1 rounded-sm border border-focus px-1 ring-2 ring-focus/30"
    >
      {prefix && <span className="text-muted">{prefix}</span>}
      <label className="sr-only" htmlFor={`inline-${label}`}>
        {label}
      </label>
      <input
        id={`inline-${label}`}
        autoFocus
        value={draft}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => done(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") done(true);
          if (e.key === "Escape") done(false);
        }}
        className={cn(
          "w-full min-w-0 bg-transparent text-fg outline-none",
          big ? "h-9 text-xl" : "h-8 text-base",
        )}
      />
    </div>
  );
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1 px-1">
      {tags.map((t) => (
        <Tag key={t} onRemove={() => onChange(tags.filter((x) => x !== t))}>
          {t}
        </Tag>
      ))}
      <label htmlFor="new-tag" className="sr-only">
        Nova tag
      </label>
      <input
        id="new-tag"
        value={v}
        maxLength={40}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) {
            e.preventDefault();
            onChange([...tags, v.trim()]);
            setV("");
          }
        }}
        placeholder="+ tag"
        className="h-6 w-20 rounded-sm bg-transparent px-1 text-sm outline-none placeholder:text-muted focus:bg-surface"
      />
    </div>
  );
}
