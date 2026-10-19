import Link from "next/link";
import { headers } from "next/headers";
import { UserCircle, ChevronRight, Columns3, CreditCard, Link2, ListPlus, MessageSquare, Sparkle, Users, type LucideIcon } from "@/components/ui/icons";
import { getAccess, getAgent, listChannels, listFields, listMembers, listPipelines, listTrackingLinks } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { PhotoPicker } from "@/components/settings/photo";
import { cn } from "@/lib/cn";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Configurações" };

const tzLabel: Record<string, string> = {
  "America/Sao_Paulo": "Brasília (GMT-3)",
  "America/Manaus": "Manaus (GMT-4)",
  "America/Fortaleza": "Fortaleza (GMT-3)",
  "America/Noronha": "Fernando de Noronha (GMT-2)",
  "America/Rio_Branco": "Rio Branco (GMT-5)",
};
const curLabel: Record<string, string> = { BRL: "Real (R$)", USD: "Dólar (US$)", EUR: "Euro (€)" };

export default async function SettingsPage({ params }: PageProps<"/[ws]/settings">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const [channels, team, fields, links, pipelines, access, agent] = await Promise.all([
    listChannels(ws.id),
    listMembers(ws.id),
    listFields(ws.id),
    listTrackingLinks(ws.id),
    listPipelines(ws.id),
    getAccess(ws.id),
    getAgent(ws.id),
  ]);
  const connected = channels.filter((c) => c.status === "connected").length;
  // endereço real do painel (domínio próprio, prévia da Vercel ou localhost), não um fixo
  const appHost = (process.env.APP_URL ? new URL(process.env.APP_URL).host : (await headers()).get("host")) ?? "";
  const plan =
    access.state === "trial" ? `Teste grátis · ${access.daysLeft ?? 14} ${access.daysLeft === 1 ? "dia" : "dias"}` : access.state === "active" ? "Plano ativo" : "Plano pausado";

  const items: { href: string; icon: LucideIcon; title: string; text: string; stat: string; tone: string }[] = [
    { href: "channels", icon: MessageSquare, title: "Canais", text: "Chat do site, WhatsApp, Instagram e Messenger", stat: `${connected} ${connected === 1 ? "conectado" : "conectados"}`, tone: "from-[#25d366] to-[#128c4a]" },
    { href: "profile", icon: UserCircle, title: "Meu perfil e foto", text: "Sua foto aparece para a equipe no lugar das iniciais", stat: "Você", tone: "from-[#f472b6] to-[#db2777]" },
    { href: "ai", icon: Sparkle, title: "Agente de IA", text: "Responde os clientes com a sua base de conhecimento e chama a equipe", stat: agent.enabled ? "Ligado" : "Desligado", tone: "from-[#3fbf86] to-[var(--accent)]" },
    { href: "pipelines", icon: Columns3, title: "Funis e etapas", text: "Nomes, ordem e cores das etapas", stat: `${pipelines.length} ${pipelines.length === 1 ? "funil" : "funis"}`, tone: "from-[var(--stage-4)] to-[var(--stage-7)]" },
    { href: "users", icon: Users, title: "Equipe e permissões", text: "Pessoas, papéis e o que cada uma vê", stat: `${team.members.length} ${team.members.length === 1 ? "pessoa" : "pessoas"}`, tone: "from-[var(--aurora-2)] to-[var(--aurora-1)]" },
    { href: "fields", icon: ListPlus, title: "Campos personalizados", text: "Dados extras no cartão de cada lead", stat: `${fields.length} ${fields.length === 1 ? "campo" : "campos"}`, tone: "from-[#a78bfa] to-[#6d28d9]" },
    { href: "tracking", icon: Link2, title: "Rastreamento e UTMs", text: "Links de WhatsApp rastreáveis, script do site e origem dos leads", stat: `${links.length} ${links.length === 1 ? "link" : "links"}`, tone: "from-[#fbbf24] to-[#d97706]" },
    { href: "billing", icon: CreditCard, title: "Plano e cobrança", text: "Assinatura, usuários e forma de pagamento", stat: plan, tone: "from-[var(--accent)] to-[var(--stage-7)]" },
  ];

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
          {/* empresa */}
          <section aria-label="Sua empresa" className="fx-aurora overflow-hidden rounded-xl p-6 sm:p-8">
            <div className="relative z-10 flex flex-wrap items-center gap-5">
              <PhotoPicker
                slug={slug}
                kind="logo"
                current={ws.logo ?? null}
                label="Trocar o logo da empresa"
                className="fx-glow size-16 rounded-lg bg-accent"
                fallback={<span className="text-2xl font-bold text-on-accent">{ws.name.slice(0, 1).toUpperCase()}</span>}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-night-muted">Sua empresa</p>
                <h2 className="truncate text-2xl font-semibold tracking-tight text-on-night">{ws.name}</h2>
                <p className="text-sm text-on-night-muted">{appHost}/{ws.slug}</p>
              </div>
              <Link
                href={`/${slug}/settings/billing`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-medium",
                  access.state === "locked" ? "bg-danger text-on-accent" : "bg-[color-mix(in_srgb,var(--on-night)_12%,transparent)] text-on-night hover:bg-[color-mix(in_srgb,var(--on-night)_18%,transparent)]",
                )}
              >
                <Sparkle className="size-3.5" weight="fill" aria-hidden /> {plan}
              </Link>
            </div>
            <dl className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Endereço", `/${ws.slug}`],
                ["Fuso horário", tzLabel[ws.timezone] ?? ws.timezone],
                ["Moeda", curLabel[ws.currency] ?? ws.currency],
                ["Equipe", `${team.members.length} ${team.members.length === 1 ? "pessoa" : "pessoas"}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-[color-mix(in_srgb,var(--on-night)_6%,transparent)] px-4 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-night)_10%,transparent)]">
                  <dt className="text-xs text-on-night-muted">{k}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-on-night">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* seções */}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <li key={i.href}>
                <Link
                  href={`/${slug}/settings/${i.href}`}
                  className="group flex h-full flex-col gap-4 rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)] transition-[box-shadow,transform] duration-fast ease-out hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--border-input),0_14px_30px_-16px_rgba(31,122,85,.45)]"
                >
                  <div className="flex items-start justify-between">
                    <span className={cn("grid size-11 place-items-center rounded-lg bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_18px_-8px_rgba(20,28,24,.45)]", i.tone)} aria-hidden>
                      <i.icon className="size-5" weight="fill" />
                    </span>
                    <span className="rounded-pill bg-surface px-2.5 py-0.5 text-xs font-medium text-muted shadow-[inset_0_0_0_1px_var(--border)]">{i.stat}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-fg">{i.title}</h3>
                    <p className="mt-1 text-sm text-muted">{i.text}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-text">
                    Abrir <ChevronRight className="size-4 transition-transform duration-fast ease-out group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
