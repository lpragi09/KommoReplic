"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { deleteRoiReportAction, saveGoalsAction, saveRoiReportAction } from "@/app/actions";
import type { RoiReport, SalesGoal, StageColor } from "@/data/types";
import { moneyInput, when } from "@/lib/format";
import { stageBar } from "@/lib/stage-colors";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog, DialogClose } from "@/components/ui/overlay";
import { Funnel, Pencil, Plus, Search, Trash2 } from "@/components/ui/icons";

/* Partes com clique das estatísticas: busca no registro, metas e relatórios de ROI. */

type Cell = { text: string; stage?: { name: string; color: StageColor; pipeline: string } | null };
export type LogRow = { id: string; at: string; who: string; robot: boolean; type: string; object: string; href: string | null; what: string; before?: Cell; after?: Cell };

function CellView({ c }: { c?: Cell }) {
  if (!c) return <span className="text-muted">—</span>;
  if (c.stage)
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-pill bg-surface px-2 py-0.5 text-xs text-fg shadow-[inset_0_0_0_1px_var(--border)]" title={`${c.stage.pipeline} · ${c.stage.name}`}>
        <span className={cn("size-2 shrink-0 rounded-pill", stageBar[c.stage.color])} aria-hidden />
        <span className="truncate">{c.stage.name}</span>
      </span>
    );
  return <span className="line-clamp-2 text-fg">{c.text || "—"}</span>;
}

const TYPES = ["Todos", "Lead", "Nota", "Tarefa"] as const;

export function ActivityLogTable({ rows }: { rows: LogRow[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("Todos");
  const [who, setWho] = useState("Todos");
  const [show, setShow] = useState(100);
  const people = useMemo(() => ["Todos", ...new Set(rows.map((r) => r.who))], [rows]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (type === "Todos" || r.type === type) &&
        (who === "Todos" || r.who === who) &&
        (!s || [r.who, r.object, r.what, r.before?.text, r.after?.text].some((x) => x?.toLowerCase().includes(s))),
    );
  }, [rows, q, type, who]);
  const sel = "h-9 rounded-sm border border-border-input bg-bg px-2 text-sm";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-sm bg-surface px-3 shadow-[inset_0_0_0_1px_var(--border)] focus-within:shadow-[inset_0_0_0_1px_var(--focus)]">
          <Search className="size-4 text-muted" aria-hidden />
          <span className="sr-only">Filtrar atividades</span>
          <input value={q} onChange={(e) => (setQ(e.target.value), setShow(100))} placeholder="Filtrar por lead, pessoa, etapa…" className="h-full flex-1 bg-transparent text-sm outline-none" />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <Funnel className="size-4" aria-hidden />
          <span className="sr-only">Tipo</span>
          <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} className={sel}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          <span className="sr-only">Quem</span>
          <select value={who} onChange={(e) => setWho(e.target.value)} className={cn(sel, "max-w-56")}>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-xs tabular-nums text-muted">{list.length.toLocaleString("pt-BR")} atividades</span>
      </div>
      {list.length === 0 ? (
        <p className="rounded-md bg-surface px-3 py-6 text-center text-sm text-muted">Nada encontrado com esse filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">Registro de atividade</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                {["Data", "Quem", "Tipo", "Objeto", "Atividade", "Antes", "Depois"].map((h) => (
                  <th key={h} scope="col" className="px-2 pb-2 font-medium first:pl-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.slice(0, show).map((r) => (
                <tr key={r.id} className="align-top hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
                  <td className="whitespace-nowrap py-2.5 pr-2 tabular-nums text-muted" suppressHydrationWarning>
                    {when(r.at)}
                  </td>
                  <td className={cn("max-w-40 truncate px-2 py-2.5", r.robot ? "text-accent-text" : "text-fg")}>{r.who}</td>
                  <td className="px-2 py-2.5 text-muted">{r.type}</td>
                  <td className="max-w-44 truncate px-2 py-2.5">
                    {r.href ? (
                      <Link href={r.href} className="text-accent-text hover:underline">
                        {r.object}
                      </Link>
                    ) : (
                      <span className="text-muted">{r.object}</span>
                    )}
                  </td>
                  <td className="max-w-56 px-2 py-2.5 text-fg">
                    <span className="line-clamp-2">{r.what}</span>
                  </td>
                  <td className="max-w-44 px-2 py-2.5">
                    <CellView c={r.before} />
                  </td>
                  <td className="max-w-56 py-2.5 pl-2">
                    <CellView c={r.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > show && (
        <Button variant="secondary" className="self-center" onClick={() => setShow((n) => n + 200)}>
          Mostrar mais ({(list.length - show).toLocaleString("pt-BR")})
        </Button>
      )}
    </div>
  );
}

/* ---------- metas ---------- */
const toCents = (s: string) => {
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

export function GoalsEditor({ slug, month, users, goals }: { slug: string; month: string; users: { id: string; name: string }[]; goals: SalesGoal[] }) {
  const init = () => Object.fromEntries(users.map((u) => [u.id, { cents: moneyInput(goals.find((g) => g.userId === u.id)?.cents ?? 0), count: String(goals.find((g) => g.userId === u.id)?.count || "") }]));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(init);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveGoalsAction(
        slug,
        month,
        users.map((u) => ({ userId: u.id, cents: toCents(form[u.id]?.cents ?? ""), count: Math.max(0, Math.round(Number(form[u.id]?.count) || 0)) })),
      );
      if (!r.ok) return setError(r.error);
      setOpen(false);
    });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (setOpen(o), o && (setForm(init()), setError(null)))}
      size="lg"
      title="Definir metas do mês"
      description="Valor em vendas ganhas e/ou quantidade de vendas, por pessoa. Deixe vazio quem não tem meta."
      trigger={<Button size="sm">Definir metas</Button>}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>
            Salvar metas
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <li key={u.id} className="grid items-end gap-2 sm:grid-cols-[1fr_10rem_8rem]">
            <span className="truncate pb-2 text-sm font-medium text-fg">{u.name}</span>
            <Field label={`Meta em R$ de ${u.name}`} value={form[u.id]?.cents ?? ""} onChange={(e) => setForm({ ...form, [u.id]: { ...form[u.id], cents: e.target.value } })} inputMode="decimal" placeholder="10.000,00" />
            <Field label={`Vendas de ${u.name}`} value={form[u.id]?.count ?? ""} onChange={(e) => setForm({ ...form, [u.id]: { ...form[u.id], count: e.target.value.replace(/\D/g, "") } })} inputMode="numeric" placeholder="5" />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/* ---------- ROI ---------- */
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const monthAgo = () => new Date(Date.now() - 30 * 864e5).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export function RoiEditor({ slug, report }: { slug: string; report?: RoiReport }) {
  const init = () => ({
    name: report?.name ?? "",
    investment: report ? moneyInput(report.investmentCents) : "",
    utmSource: report?.utmSource ?? "",
    utmCampaign: report?.utmCampaign ?? "",
    from: report?.from ?? monthAgo(),
    to: report?.to ?? today(),
  });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(init);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveRoiReportAction(slug, report?.id ?? null, f);
      if (!r.ok) return setError(r.error);
      setOpen(false);
    });
  const remove = () =>
    start(async () => {
      if (!report) return;
      const r = await deleteRoiReportAction(slug, report.id);
      if (!r.ok) return setError(r.error);
      setOpen(false);
    });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (setOpen(o), o && (setF(init()), setError(null)))}
      size="lg"
      title={report ? `Editar “${report.name}”` : "Novo relatório de ROI"}
      description="Quanto investiu e em qual origem. Contamos os leads que chegaram por ela no período e o que viraram venda."
      trigger={
        report ? (
          <IconButton label={`Editar ${report.name}`} size={28}>
            <Pencil className="size-4" />
          </IconButton>
        ) : (
          <Button size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Novo relatório
          </Button>
        )
      }
      footer={
        <>
          {report && (
            <Button variant="secondary" className="mr-auto text-danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={remove} disabled={pending}>
              Apagar
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>
            {report ? "Salvar" : "Criar relatório"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} placeholder="Instagram outubro" />
        <Field label="Investimento (R$)" value={f.investment} onChange={(e) => setF({ ...f, investment: e.target.value })} inputMode="decimal" placeholder="1.500,00" />
        <Field label="Fonte (utm_source) contém" value={f.utmSource} onChange={(e) => setF({ ...f, utmSource: e.target.value })} maxLength={80} placeholder="instagram" hint="Vazio = qualquer fonte." />
        <Field label="Campanha (utm_campaign) contém" value={f.utmCampaign} onChange={(e) => setF({ ...f, utmCampaign: e.target.value })} maxLength={120} placeholder="black-friday" hint="Vazio = qualquer campanha." />
        <Field label="De" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <Field label="Até" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
