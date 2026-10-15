import Link from "next/link";
import { Inbox, MessageSquare, Users } from "@/components/ui/icons";
import { getConversation, getLead, listConversations, listTaskTypes, listUsers, windowClosed, type ConvFilter } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, money, when } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar, Badge, EmptyState } from "@/components/ui/bits";
import { Feed } from "@/components/lead/feed";
import { Composer } from "@/components/lead/composer";
import { MarkRead } from "@/components/lead/mark-read";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const filters: { v: ConvFilter; label: string }[] = [
  { v: "all", label: "Todas" },
  { v: "unread", label: "Não lidas" },
  { v: "unanswered", label: "Sem resposta" },
  { v: "mine", label: "Minhas" },
];
const channelName = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", webchat: "Chat do site" };

export default async function InboxPage({ params, searchParams }: PageProps<"/[ws]/inbox">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { c?: string; f?: ConvFilter };
  const f = filters.some((x) => x.v === sp.f) ? sp.f! : "all";
  const { user, ws } = await requireWorkspace(slug);
  const [convs, users, taskTypes] = await Promise.all([listConversations(ws.id, user.id, f), listUsers(ws.id), listTaskTypes(ws.id)]);
  const activeId = sp.c ?? null;
  const active = activeId ? await getConversation(ws.id, activeId).catch(() => null) : null;
  const leadData = active?.lead ? await getLead(ws.id, active.lead.id) : null;
  const href = (p: { c?: string | null; f?: string }) => {
    const q = new URLSearchParams();
    const ff = p.f ?? f;
    if (ff !== "all") q.set("f", ff);
    const c = p.c === undefined ? activeId : p.c;
    if (c) q.set("c", c);
    return `/${slug}/inbox${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Caixa de entrada"
        actions={
          <Link href={`/${slug}/team-chat`} className="inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm text-fg hover:bg-surface">
            <Users className="size-4" aria-hidden /> Chat da equipe
          </Link>
        }
      >
        <nav aria-label="Filtrar conversas" className="flex gap-1">
          {filters.map((x) => (
            <Link
              key={x.v}
              href={href({ f: x.v, c: null })}
              aria-current={x.v === f ? "page" : undefined}
              className={cn("h-8 rounded-pill px-3 text-sm leading-8", x.v === f ? "bg-inverse-bg text-on-inverse" : "text-muted hover:bg-surface hover:text-fg")}
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <div className="flex min-h-0 flex-1">
        <ul
          aria-label="Conversas"
          className={cn("w-full shrink-0 divide-y divide-border overflow-y-auto border-r border-border bg-bg md:w-[var(--inbox-list)]", active && "hidden md:block")}
        >
          {convs.length === 0 && (
            <li>
              <EmptyState icon={Inbox} title="Nenhuma conversa aqui" text={f === "all" ? "Quando alguém mandar mensagem por um canal conectado, aparece nesta lista." : "Nada com este filtro agora."} />
            </li>
          )}
          {convs.map((c) => {
            const on = c.id === activeId;
            return (
              <li key={c.id}>
                <Link
                  href={href({ c: c.id })}
                  aria-current={on ? "true" : undefined}
                  className={cn("relative flex gap-3 px-4 py-3 hover:bg-surface", on && "bg-accent-soft hover:bg-accent-soft")}
                >
                  {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden />}
                  <Avatar name={c.contact.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-base text-fg", c.unreadCount ? "font-semibold" : "font-medium")}>{c.contact.name}</span>
                      {c.lastMessageAt && (
                        <time className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                          {when(c.lastMessageAt)}
                        </time>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted">{c.lastMessagePreview}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="whitespace-nowrap rounded-xs bg-canvas px-1.5 py-0.5 text-muted">{channelName[c.channel.kind]}</span>
                      {!c.lead && <span className="whitespace-nowrap rounded-xs bg-accent-soft px-1.5 py-0.5 font-medium text-accent-text">Novo</span>}
                      {c.isUnanswered && <span className="whitespace-nowrap rounded-xs bg-warning-soft px-1.5 py-0.5 font-medium text-warning">Sem resposta</span>}
                      {c.unreadCount > 0 && (
                        <Badge className="ml-auto">
                          {c.unreadCount}
                          <span className="sr-only"> não lidas</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {active ? (
          <section aria-label={`Conversa com ${active.contact.name}`} className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-bg px-4 py-2">
              <Link href={href({ c: null })} className="text-sm text-accent-text underline md:hidden">
                Voltar
              </Link>
              <Avatar name={active.contact.name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{active.contact.name}</p>
                <p className="text-xs text-muted">{channelName[active.channel.kind]}</p>
              </div>
              {active.lead ? (
                <Link href={`/${slug}/leads/${active.lead.id}`} className="rounded-sm border border-border px-3 py-1.5 text-sm hover:border-border-input">
                  <span className="text-muted">Lead:</span> <span className="font-medium text-fg">{leadTitle(active.lead)}</span>{" "}
                  <span className="text-muted">· {money(active.lead.priceCents)}</span>
                </Link>
              ) : (
                <Link href={`/${slug}/leads`} className="text-sm font-medium text-accent-text underline">
                  Aceitar na etapa de entrada
                </Link>
              )}
            </div>
            <Feed
              slug={slug}
              items={
                leadData?.feed ??
                active.messages.map((m) => ({ type: "message" as const, at: m.sentAt, message: m, channelKind: active.channel.kind }))
              }
              contactName={active.contact.name}
            />
            <Composer
              slug={slug}
              leadId={active.lead?.id ?? null}
              conversationId={active.conversation.id}
              channelName={channelName[active.channel.kind]}
              windowClosed={windowClosed(active.conversation, active.channel.kind)}
              taskTypes={taskTypes}
              users={users}
              me={user.id}
            />
            <MarkRead slug={slug} conversationId={active.conversation.id} unread={active.conversation.unreadCount} />
          </section>
        ) : (
          <div className="hidden flex-1 place-items-center bg-surface md:grid">
            <EmptyState icon={MessageSquare} title="Escolha uma conversa" text="As mensagens de todos os canais chegam aqui, ligadas ao lead de cada cliente." />
          </div>
        )}
      </div>
    </>
  );
}
