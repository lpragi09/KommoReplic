"use client";

import { useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu as M } from "radix-ui";
import type { Stage, StageColor } from "@/data/types";
import { addStageAction, createPipelineAction, deletePipelineAction, deleteStageAction, renamePipelineAction, updateStageAction } from "@/app/actions";
import { Check, Download, Funnel, MoreHorizontal, Pencil, Plus, Trash2 } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/interactive";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { stageBar } from "./kanban";

const COLORS: StageColor[] = ["1", "2", "3", "4", "5", "6", "7", "8"];

const menuBox = "z-50 min-w-52 rounded-lg bg-bg p-1.5 shadow-[0_0_0_1px_var(--border),0_18px_40px_-14px_rgba(14,26,58,.4)] data-[state=open]:animate-[fx-pop_.14s_ease-out]";
const menuItem = "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg outline-none data-[highlighted]:bg-accent-soft";
const menuDanger = "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft";

/** janela com um campo de nome (criar/renomear) */
function NameDialog({
  open,
  onOpenChange,
  title,
  label,
  initial,
  submit,
  icon,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  label: string;
  initial: string;
  submit: string;
  icon: ReactNode;
  onSubmit: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setName(initial);
          setError(null);
        }
      }}
      title={title}
      size="sm"
      icon={icon}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="name-dialog" loading={pending}>
            {submit}
          </Button>
        </>
      }
    >
      <form
        id="name-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const err = await onSubmit(name);
            if (err) setError(err);
            else onOpenChange(false);
          });
        }}
      >
        <Field label={label} value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} error={error ?? undefined} />
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// menu do funil (ao lado do seletor)
// ---------------------------------------------------------------------------
export function PipelineMenu({ slug, pipeline }: { slug: string; pipeline: { id: string; name: string } }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [dialog, setDialog] = useState<"new" | "rename" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const go = (id: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set("pipeline", id);
    else next.delete("pipeline");
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  return (
    <>
      <M.Root>
        <M.Trigger asChild>
          <button type="button" aria-label="Opções do funil" title="Novo funil, renomear ou excluir" className="grid size-10 place-items-center rounded-pill bg-bg text-fg shadow-[inset_0_0_0_1px_var(--border)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--border-input)] data-[state=open]:shadow-[inset_0_0_0_1px_var(--focus)]">
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        </M.Trigger>
        <M.Portal>
          <M.Content align="start" sideOffset={6} className={menuBox}>
            <M.Item className={menuItem} onSelect={() => setDialog("new")}>
              <Plus className="size-4 text-accent" aria-hidden /> Novo funil
            </M.Item>
            <M.Item className={menuItem} onSelect={() => setDialog("rename")}>
              <Pencil className="size-4 text-muted" aria-hidden /> Renomear “{pipeline.name}”
            </M.Item>
            <M.Item asChild className={menuItem}>
              <a href={`/${slug}/leads/export?pipeline=${pipeline.id}`} download>
                <Download className="size-4 text-muted" aria-hidden /> Exportar leads (planilha)
              </a>
            </M.Item>
            <M.Separator className="my-1 h-px bg-border" />
            <M.Item className={menuDanger} onSelect={() => setDialog("delete")}>
              <Trash2 className="size-4" aria-hidden /> Excluir funil
            </M.Item>
          </M.Content>
        </M.Portal>
      </M.Root>

      <NameDialog
        open={dialog === "new"}
        onOpenChange={(o) => setDialog(o ? "new" : null)}
        title="Novo funil"
        label="Nome do funil"
        initial=""
        submit="Criar funil"
        icon={<Funnel className="size-5" />}
        onSubmit={async (name) => {
          const r = await createPipelineAction(slug, name);
          if (!r.ok) return r.error;
          go(r.data.id);
          return null;
        }}
      />
      <NameDialog
        open={dialog === "rename"}
        onOpenChange={(o) => setDialog(o ? "rename" : null)}
        title="Renomear funil"
        label="Nome do funil"
        initial={pipeline.name}
        submit="Salvar"
        icon={<Pencil className="size-5" />}
        onSubmit={async (name) => {
          const r = await renamePipelineAction(slug, pipeline.id, name);
          return r.ok ? null : r.error;
        }}
      />
      <Dialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={`Excluir “${pipeline.name}”?`}
        description="O funil e as etapas dele somem. Só dá para excluir um funil sem leads."
        size="sm"
        icon={<Trash2 className="size-5" />}
        tone="danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await deletePipelineAction(slug, pipeline.id);
                  setDialog(null);
                  if (!r.ok) return toast.show({ text: r.error, tone: "error" });
                  go(null);
                })
              }
            >
              Excluir funil
            </Button>
          </>
        }
      />
      {toast.node}
    </>
  );
}

// ---------------------------------------------------------------------------
// menu de cada etapa (no topo da coluna)
// ---------------------------------------------------------------------------
export function StageMenu({ slug, stage, siblings, count, onError }: { slug: string; stage: Stage; siblings: Stage[]; count: number; onError: (t: string) => void }) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const others = siblings.filter((s) => s.kind === "open" && s.id !== stage.id);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
  const [pending, start] = useTransition();
  const open = stage.kind === "open";
  const paint = (color: StageColor) =>
    start(async () => {
      const r = await updateStageAction(slug, stage.id, { color });
      if (!r.ok) onError(r.error);
    });
  return (
    <>
      <M.Root>
        <M.Trigger asChild>
          <button type="button" aria-label={`Opções da etapa ${stage.name}`} className="grid size-7 place-items-center rounded-pill text-muted transition-colors hover:bg-bg hover:text-fg data-[state=open]:bg-bg data-[state=open]:text-fg">
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </M.Trigger>
        <M.Portal>
          <M.Content align="end" sideOffset={6} className={menuBox}>
            <M.Item className={menuItem} onSelect={() => setDialog("rename")}>
              <Pencil className="size-4 text-muted" aria-hidden /> Renomear etapa
            </M.Item>
            {open && (
              <>
                <M.Label className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted">Cor</M.Label>
                <div className="flex gap-1.5 px-2.5 pb-2">
                  {COLORS.map((c) => (
                    <M.Item key={c} onSelect={() => paint(c)} aria-label={`Cor ${c}`} className={cn("grid size-6 cursor-pointer place-items-center rounded-pill outline-none ring-offset-2 data-[highlighted]:ring-2 data-[highlighted]:ring-focus", stageBar[c])}>
                      {stage.color === c && <Check className="size-3.5 text-white" weight="bold" aria-hidden />}
                    </M.Item>
                  ))}
                </div>
                <M.Separator className="my-1 h-px bg-border" />
                <M.Item className={menuDanger} disabled={!others.length} onSelect={() => setDialog("delete")}>
                  <Trash2 className="size-4" aria-hidden /> Excluir etapa
                </M.Item>
              </>
            )}
          </M.Content>
        </M.Portal>
      </M.Root>

      <NameDialog
        open={dialog === "rename"}
        onOpenChange={(o) => setDialog(o ? "rename" : null)}
        title="Renomear etapa"
        label="Nome da etapa"
        initial={stage.name}
        submit="Salvar"
        icon={<Pencil className="size-5" />}
        onSubmit={async (name) => {
          const r = await updateStageAction(slug, stage.id, { name });
          return r.ok ? null : r.error;
        }}
      />
      <Dialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={`Excluir “${stage.name}”?`}
        description={count ? `Os ${count} ${count === 1 ? "lead desta etapa vai" : "leads desta etapa vão"} para a etapa que você escolher.` : "A etapa está vazia."}
        size="sm"
        icon={<Trash2 className="size-5" />}
        tone="danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteStageAction(slug, stage.id, moveTo || null);
                  setDialog(null);
                  if (!r.ok) onError(r.error);
                })
              }
            >
              Excluir etapa
            </Button>
          </>
        }
      >
        {count > 0 && (
          <Select
            label="Mover os leads para"
            value={moveTo}
            onValueChange={setMoveTo}
            options={others.map((s) => ({ value: s.id, label: s.name, icon: <span className={cn("size-2.5 rounded-pill", stageBar[s.color])} /> }))}
          />
        )}
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// coluna "+ Nova etapa" no fim das etapas abertas
// ---------------------------------------------------------------------------
export function AddStageColumn({ slug, pipelineId, onError }: { slug: string; pipelineId: string; onError: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      if (!name.trim()) return setEditing(false);
      const r = await addStageAction(slug, pipelineId, name);
      if (!r.ok) return onError(r.error);
      setName("");
      setEditing(false);
    });
  return (
    <div className="flex w-[var(--kanban-column)] shrink-0 snap-start flex-col">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-2 rounded-lg bg-bg p-3 shadow-[0_0_0_1px_var(--border),0_10px_24px_-14px_rgba(14,26,58,.4)]"
        >
          <label htmlFor="new-stage" className="text-sm font-medium text-fg">
            Nome da nova etapa
          </label>
          <input
            id="new-stage"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            placeholder="Ex.: Visita agendada"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-focus focus:bg-bg"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Adicionar
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-text"
        >
          <Plus className="size-5" aria-hidden /> Nova etapa
        </button>
      )}
    </div>
  );
}
