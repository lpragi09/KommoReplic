import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/data/session";
import { platform } from "@/data/platform";
import type { PlatformWorkspace } from "@/data/platform/types";
import { platformAdmins } from "@/lib/platform";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { NetzerMark } from "@/components/brand/logo";
import { InstantLink, LinkGroup } from "@/components/ui/instant-link";
import { AlertTriangle, ArrowLeft, Building2, ChartColumn, Coins, Sparkle, TrendingUp, Users } from "@/components/ui/icons";
import { DemoCreator, DemoList, UsersTable, WorkspacesTable } from "@/components/platform/tables";
import { PLAN_NAME, statusOf } from "@/components/platform/status";

export const metadata: Metadata = { title: "Central", robots: { index: false } };

export const instant = false; // tela atrás de login: bloqueia no servidor

const TABS = [
  { v: "visao", label: "Visão geral" },
  { v: "empresas", label: "Empresas" },
  { v: "usuarios", label: "Usuários" },
  { v: "demos", label: "Demonstrações" },
  { v: "registro", label: "Registro" },
] as const;

const PRICE = { trial: 0, basic: 59, advanced: 99, pro: 159 } as const;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const DAY = 864e5;

/** números do topo e o gráfico de cadastros (fora do componente: usa a hora atual) */
function summary(ws: PlatformWorkspace[]) {
  const real = ws.filter((w) => !w.isDemo);
  const now = Date.now();
  const by = (k: string) => real.filter((w) => statusOf(w, now).key === k);
  const paying = by("paying");
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * DAY).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    return { d, n: real.filter((w) => new Date(w.createdAt).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) === d).length };
  });
  return {
    total: real.length,
    week: real.filter((w) => now - Date.parse(w.createdAt) < 7 * DAY).length,
    trial: by("trial"),
    ending: by("trial").filter((w) => w.trialEndsAt && Date.parse(w.trialEndsAt) - now < 3 * DAY),
    paying,
    free: by("free"),
    paused: by("paused"),
    mrr: paying.reduce((a, w) => a + PRICE[w.plan] * w.seats, 0),
    days,
    now,
    weekAgo: now - 7 * DAY,
    active: [...real].sort((a, b) => b.messages30d - a.messages30d || b.leads - a.leads).slice(0, 6),
  };
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const me = await requirePlatformAdmin();
  const sp = (await searchParams) as { aba?: string };
  const tab = TABS.find((t) => t.v === sp.aba)?.v ?? "visao";
  const appHost = (process.env.APP_URL ? new URL(process.env.APP_URL).host : (await headers()).get("host")) ?? "";
  const [workspaces, users, audit] = await Promise.all([platform.listWorkspaces(), platform.listUsers(), platform.listAudit(150)]);
  const s = summary(workspaces);
  const max = Math.max(1, ...s.days.map((d) => d.n));

  return (
    <div className="min-h-dvh bg-surface">
      <header className="fx-aurora relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-6 pt-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <NetzerMark className="h-8 w-auto text-brand-on-night" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-on-night-muted">{BRAND.name} · só para os donos</p>
              <h1 className="text-2xl font-semibold tracking-tight text-on-night">Central da plataforma</h1>
            </div>
            <span className="hidden text-sm text-on-night-muted sm:block">{me.email}</span>
            <Link href="/app" className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-[color-mix(in_srgb,var(--on-night)_12%,transparent)] px-3.5 text-sm font-medium text-on-night hover:bg-[color-mix(in_srgb,var(--on-night)_18%,transparent)]">
              <ArrowLeft className="size-4" aria-hidden /> Voltar ao painel
            </Link>
          </div>
          <LinkGroup label="Seções da central" className="mt-6 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <InstantLink
                key={t.v}
                href={t.v === "visao" ? "/admin" : `/admin?aba=${t.v}`}
                active={t.v === tab}
                className="whitespace-nowrap rounded-pill px-4 py-2 text-sm font-medium transition-colors duration-fast"
                activeClassName="bg-on-night text-night"
                inactiveClassName="text-on-night-muted hover:bg-[color-mix(in_srgb,var(--on-night)_10%,transparent)] hover:text-on-night"
              >
                {t.label}
                {t.v === "empresas" && <span className="ml-1.5 text-xs tabular-nums opacity-70">{workspaces.length}</span>}
                {t.v === "usuarios" && <span className="ml-1.5 text-xs tabular-nums opacity-70">{users.length}</span>}
              </InstantLink>
            ))}
          </LinkGroup>
        </div>
      </header>

      <main id="conteudo" className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {tab === "visao" && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon={Building2} label="Empresas" value={String(s.total)} sub={`+${s.week} nos últimos 7 dias`} />
              <Kpi icon={Users} label="Usuários" value={String(users.length)} sub={`${users.filter((u) => u.lastSignInAt && Date.parse(u.lastSignInAt) > s.weekAgo).length} entraram na semana`} />
              <Kpi icon={Coins} label="Receita mensal" value={brl(s.mrr)} sub={`${s.paying.length} ${s.paying.length === 1 ? "empresa pagante" : "empresas pagantes"}`} tone="success" />
              <Kpi icon={TrendingUp} label="Em teste" value={String(s.trial.length)} sub={`${s.ending.length} terminam em até 3 dias`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section aria-label="Cadastros por dia" className="rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border)]">
                <header className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-fg">Novas empresas por dia</h2>
                  <span className="text-xs text-muted">últimos 30 dias · {s.days.reduce((a, d) => a + d.n, 0)} no total</span>
                </header>
                <div className="flex h-40 items-end gap-1" role="img" aria-label={`Cadastros nos últimos 30 dias: ${s.days.map((d) => d.n).join(", ")}`}>
                  {s.days.map((d) => (
                    <div key={d.d} className="group relative flex h-full flex-1 flex-col justify-end">
                      <div className={cn("w-full rounded-t-sm transition-colors", d.n ? "bg-[linear-gradient(180deg,var(--stage-4),var(--accent))] group-hover:brightness-110" : "bg-surface")} style={{ height: `${Math.max(4, (d.n / max) * 100)}%` }} />
                      <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-inverse-bg px-1.5 py-0.5 text-[11px] text-on-inverse group-hover:block">
                        {d.d.slice(8, 10)}/{d.d.slice(5, 7)}: {d.n}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section aria-label="Situação das empresas" className="rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border)]">
                <h2 className="mb-4 text-sm font-semibold text-fg">Situação das empresas</h2>
                <ul className="flex flex-col gap-3">
                  {[
                    { label: "Pagantes", n: s.paying.length, cls: "bg-success" },
                    { label: "Em teste", n: s.trial.length, cls: "bg-accent" },
                    { label: "Cortesia", n: s.free.length, cls: "bg-stage-4" },
                    { label: "Pausadas", n: s.paused.length, cls: "bg-danger" },
                  ].map((x) => (
                    <li key={x.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-fg">{x.label}</span>
                        <span className="font-medium tabular-nums text-fg">{x.n}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-pill bg-surface">
                        <div className={cn("h-full rounded-pill", x.cls)} style={{ width: `${s.total ? Math.max(2, (x.n / s.total) * 100) : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section aria-label="Teste acabando" className="rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border)]">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
                  <AlertTriangle className="size-4 text-warning" aria-hidden /> Teste acabando
                </h2>
                <p className="mb-3 text-xs text-muted">Bom momento para chamar no WhatsApp e oferecer ajuda.</p>
                {s.ending.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum teste termina nos próximos 3 dias.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {s.ending.map((w) => (
                      <li key={w.id} className="flex items-center gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-fg">{w.name}</span>
                          <span className="block truncate text-xs text-muted">{w.ownerEmail}</span>
                        </span>
                        <span className="text-xs text-warning" suppressHydrationWarning>
                          {w.trialEndsAt ? `termina ${new Date(w.trialEndsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section aria-label="Mais ativas" className="rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border)]">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
                  <ChartColumn className="size-4 text-accent" aria-hidden /> Mais ativas
                </h2>
                <p className="mb-3 text-xs text-muted">Por mensagens nos últimos 30 dias.</p>
                <ul className="divide-y divide-border">
                  {s.active.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium text-fg">{w.name}</span>
                      <span className="text-xs text-muted">{w.plan === "trial" ? "teste" : PLAN_NAME[w.plan]}</span>
                      <span className="w-20 text-right tabular-nums text-fg">{w.messages30d.toLocaleString("pt-BR")} msgs</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}

        {tab === "empresas" && <WorkspacesTable rows={workspaces} appHost={appHost} now={s.now} />}
        {tab === "usuarios" && <UsersTable rows={users} admins={platformAdmins()} />}

        {tab === "demos" && (
          <>
            <section aria-label="Nova demonstração" className="rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border)]">
              <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
                <Sparkle className="size-4 text-accent" weight="fill" aria-hidden /> Nova conta de demonstração
              </h2>
              <p className="mb-4 mt-0.5 text-sm text-muted">Para mostrar o netzer funcionando numa reunião com cliente, sem expor dados reais.</p>
              <DemoCreator />
            </section>
            <section aria-label="Demonstrações" className="rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border)]">
              <h2 className="mb-1 text-base font-semibold text-fg">Suas demonstrações</h2>
              <p className="mb-4 text-sm text-muted">Depois de mostrar, use “Restaurar dados” para voltar ao começo.</p>
              <DemoList rows={workspaces.filter((w) => w.isDemo)} appHost={appHost} />
            </section>
          </>
        )}

        {tab === "registro" && (
          <section aria-label="Registro da central" className="rounded-xl bg-bg shadow-[0_0_0_1px_var(--border)]">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-fg">O que a central fez</h2>
            {audit.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Nenhuma ação ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 px-5 py-2.5 text-sm">
                    <span className="font-medium text-fg">{a.actor}</span>
                    <span className="text-muted">{a.action}</span>
                    <span className="text-fg">{a.target}</span>
                    {Object.keys(a.detail).length > 0 && (
                      <span className="text-xs text-muted">
                        {Object.entries(a.detail)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" · ")}
                      </span>
                    )}
                    <time className="ml-auto text-xs text-muted" suppressHydrationWarning>
                      {new Date(a.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Building2; label: string; value: string; sub: string; tone?: "success" }) {
  return (
    <div className="rounded-xl bg-bg p-4 shadow-[0_0_0_1px_var(--border)]">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className={cn("grid size-8 place-items-center rounded-md", tone === "success" ? "bg-success-soft text-success" : "bg-accent-soft text-accent-text")} aria-hidden>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
    </div>
  );
}
