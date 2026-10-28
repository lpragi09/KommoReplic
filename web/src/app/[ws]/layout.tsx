import { Suspense } from "react";

import { MobileNav, NavRail } from "@/components/shell/nav-rail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { NavTracker } from "@/components/shell/back-button";
import { requireWorkspace } from "@/data/session";
import { getAccess, listUsers } from "@/data";
import { loadNotifications } from "@/data/notifications";
import { AvatarSeed } from "@/components/ui/avatar";
import { AccessGate } from "@/components/shell/access-gate";
import { BrowserAlerts } from "@/components/shell/notify";
import { isPlatformAdmin } from "@/lib/platform";

// Telas atrás de login leem a sessão a cada pedido: a navegação bloqueia no servidor de propósito.
// Revisitar com "use cache: private" quando os dados vierem do Supabase.
export const instant = false;

async function Nav({ params, mobile }: { params: Promise<{ ws: string }>; mobile?: boolean }) {
  const { ws: slug } = await params;
  const { user, ws } = await requireWorkspace(slug);
  if (mobile) return <MobileNav slug={slug} />;
  const [{ unread: convs, board, unseen, items }, people] = await Promise.all([loadNotifications(slug, ws.id, user.id), listUsers(ws.id)]);
  return (
    <>
      <AvatarSeed people={people} />
      <NavRail slug={slug} userName={user.name} userAvatar={people.find((p) => p.id === user.id)?.avatar ?? null} workspaceName={ws.name} unread={convs.length} incoming={board.incoming.length} notifications={unseen} notificationItems={items.slice(0, 20)} platformAdmin={isPlatformAdmin(user.email)} />
      <BrowserAlerts unseen={unseen} latest={items.find((n) => n.kind !== "today") ?? null} />
      <LiveRefresh wsId={ws.id} slug={ws.slug} />
      <NavTracker />
    </>
  );
}

/** Teste grátis / plano: decide se a tela abre ou mostra o aviso para ativar. */
async function Gate({ params, children }: { params: Promise<{ ws: string }>; children: React.ReactNode }) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  return (
    <AccessGate slug={slug} access={await getAccess(ws.id)}>
      {children}
    </AccessGate>
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
        <Suspense fallback={null}>
          <Gate params={p}>{children}</Gate>
        </Suspense>
      </main>
      <Suspense fallback={<div className="h-14 bg-nav-bg md:hidden" />}>
        <Nav params={p} mobile />
      </Suspense>
    </div>
  );
}
