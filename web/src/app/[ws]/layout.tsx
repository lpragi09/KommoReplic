import { Suspense } from "react";
import { MobileNav, NavRail } from "@/components/shell/nav-rail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { requireWorkspace } from "@/data/session";
import { getBoard, listConversations } from "@/data";

async function Nav({ params, mobile }: { params: Promise<{ ws: string }>; mobile?: boolean }) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  if (mobile) return <MobileNav slug={slug} />;
  const [convs, board] = await Promise.all([listConversations(ws.id, user.id, "unread"), getBoard(ws.id, undefined)]);
  return (
    <NavRail
      slug={slug}
      userName={user.name}
      workspaceName={ws.name}
      unread={convs.length}
      incoming={board.incoming.length}
    />
  );
}

export default function WorkspaceLayout({ children, params }: LayoutProps<"/[ws]">) {
  const p = params as Promise<{ ws: string }>;
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Suspense fallback={<div className="hidden w-[var(--nav-collapsed)] shrink-0 bg-nav-bg md:block" />}>
        <Nav params={p} />
      </Suspense>
      <main id="conteudo" className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </main>
      <Suspense fallback={<div className="h-14 bg-nav-bg md:hidden" />}>
        <Nav params={p} mobile />
      </Suspense>
      <LiveRefresh />
    </div>
  );
}
