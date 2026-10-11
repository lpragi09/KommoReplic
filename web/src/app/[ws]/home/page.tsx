import Link from "next/link";
import { getDashboard, listUsers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const periodStart = (days: number) =>
  days === 0 ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : new Date(Date.now() - days * 864e5).toISOString();

const periods = [
  { v: "today", label: "Hoje", days: 0 },
  { v: "week", label: "7 dias", days: 7 },
  { v: "month", label: "30 dias", days: 30 },
] as const;

export default async function HomePage({ params, searchParams }: PageProps<"/[ws]/home">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { p?: string; u?: string };
  const period = periods.find((p) => p.v === sp.p) ?? periods[1];
  const { ws } = await requireWorkspace(slug);
  const from = periodStart(period.days);
  const [d, users] = await Promise.all([getDashboard(ws.id, { from, owner: sp.u }), listUsers(ws.id)]);
  const q = (p: Partial<{ p: string; u: string }>) => {
    const s = new URLSearchParams({ p: period.v, ...(sp.u ? { u: sp.u } : {}), ...p });
    if (p.u === "") s.delete("u");
    return `/${slug}/home?${s}`;
  };
  const max = Math.max(1, ...d.inboundByChannel.map((c) => c.count));
  const leadsHref = (extra: string) => `/${slug}/leads?view=list${sp.u ? `&owner=${sp.u}` : ""}${extra}`;

  return (
    <>
      <PageHeader title="Painel">
        <nav aria-label="Período" className="flex gap-1">
          {periods.map((p) => (
            <Link key={p.v} href={q({ p: p.v })} aria-current={p.v === period.v ? "page" : undefined} className={cn("h-8 rounded-pill px-3 text-sm leading-8", p.v === period.v ? "bg-inverse-bg text-on-inverse" : "text-muted hover:bg-surface hover:text-fg")}>
              {p.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Pessoa" className="flex flex-wrap gap-1">
          <Link href={q({ u: "" })} aria-current={!sp.u ? "page" : undefined} className={cn("h-8 rounded-pill px-3 text-sm leading-8", !sp.u ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface")}>
            Equipe toda
          </Link>
          {users.map((u) => (
            <Link key={u.id} href={q({ u: u.id })} aria-current={sp.u === u.id ? "page" : undefined} className={cn("h-8 rounded-pill px-3 text-sm leading-8", sp.u === u.id ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface")}>
              {u.name.split(" ")[0]}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <div className="flex-1 overflow-y-auto bg-surface p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Conversas abertas" value={d.openConversations} href={`/${slug}/inbox`} />
          <Stat label="Sem resposta" value={d.unanswered} href={`/${slug}/inbox?f=unanswered`} tone={d.unanswered ? "warning" : undefined} />
          <Stat label="Negócios ganhos" value={d.won.length} sub={money(d.won.reduce((s, l) => s + l.priceCents, 0))} tone="success" />
          <Stat label="Negócios perdidos" value={d.lost.length} sub={money(d.lost.reduce((s, l) => s + l.priceCents, 0))} tone={d.lost.length ? "danger" : undefined} />
          <Stat label="Em andamento" value={d.active.length} sub={money(d.active.reduce((s, l) => s + l.priceCents, 0))} href={leadsHref("")} />
          <Stat label="Leads sem tarefa" value={d.withoutTask.length} href={leadsHref("&task=none")} tone={d.withoutTask.length ? "warning" : undefined} />
          <Stat label="Tarefas abertas" value={d.tasksDue} href={`/${slug}/calendar${sp.u ? "?who=all" : ""}`} />
          <section className="rounded-md border border-border bg-bg p-4" aria-labelledby="mc">
            <h2 id="mc" className="text-caps uppercase text-muted">
              Mensagens recebidas por canal
            </h2>
            {d.inboundByChannel.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Sem mensagens no período.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {d.inboundByChannel.map((c) => (
                  <li key={c.name} className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-fg">{c.name}</span>
                      <span className="tabular-nums text-muted">{c.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-pill bg-canvas" aria-hidden>
                      <div className="h-2 rounded-pill bg-accent" style={{ width: `${(c.count / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub, href, tone }: { label: string; value: number; sub?: string; href?: string; tone?: "success" | "danger" | "warning" }) {
  const body = (
    <>
      <p className="text-caps uppercase text-muted">{label}</p>
      <p className={cn("mt-1 text-display tabular-nums", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-fg")}>{value}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </>
  );
  const cls = "fx-rise block rounded-md border border-border bg-bg p-4";
  return href ? (
    <Link href={href} className={cn(cls, "fx-lift hover:border-border-input")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
