import { notFound } from "next/navigation";
import { getLead, getLeadCustom, listFields, listLossReasons, listTaskTypes, listUsers, windowClosed } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle } from "@/lib/format";
import { LeadPanel } from "@/components/lead/panel";
import { Feed } from "@/components/lead/feed";
import { Composer } from "@/components/lead/composer";
import { MarkRead } from "@/components/lead/mark-read";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const channelName = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", webchat: "Chat do site" };

export default async function LeadPage({ params }: PageProps<"/[ws]/leads/[id]">) {
  const { ws: slug, id } = await params;
  const { user, ws } = await requireWorkspace(slug);
  const [d, users, lossReasons, taskTypes, fields, custom] = await Promise.all([
    getLead(ws.id, id).catch(() => null),
    listUsers(ws.id),
    listLossReasons(ws.id),
    listTaskTypes(ws.id),
    listFields(ws.id),
    getLeadCustom(ws.id, id).catch(() => ({})),
  ]);
  if (!d) notFound();
  const { lead, pipeline, contacts, company, conversation, channel, feed } = d;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <title>{`${leadTitle(lead)} · Funil`}</title>
      <LeadPanel
        slug={slug}
        lead={lead}
        stages={[...pipeline.stages].sort((a, b) => a.sort - b.sort)}
        contacts={contacts}
        company={company}
        users={users}
        lossReasons={lossReasons}
        lossReasonName={lossReasons.find((r) => r.id === lead.lossReasonId)?.name ?? null}
        fields={fields}
        custom={custom}
      />
      <section aria-label="Histórico e conversa" className="flex min-h-[70dvh] min-w-0 flex-1 flex-col lg:min-h-0">
        <Feed slug={slug} items={feed} contactName={contacts[0]?.name ?? "Cliente"} />
        <Composer
          slug={slug}
          leadId={lead.id}
          conversationId={conversation?.id ?? null}
          channelName={channel ? channelName[channel.kind] : undefined}
          windowClosed={conversation && channel ? windowClosed(conversation, channel.kind) : false}
          taskTypes={taskTypes}
          users={users}
          me={user.id}
        />
        {conversation && <MarkRead slug={slug} conversationId={conversation.id} unread={conversation.unreadCount} />}
      </section>
    </div>
  );
}
