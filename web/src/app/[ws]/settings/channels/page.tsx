import { headers } from "next/headers";
import { listChannels, listPipelines } from "@/data";
import { requireWorkspace } from "@/data/session";
import { igAccounts, igLoginOn, listPages, metaLoginOn, readPick } from "@/lib/meta-login";
import { PageHeader } from "@/components/shell/page-header";
import { ChannelsManager, type MetaPickOptions } from "@/components/settings/channels";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Canais" };

const META_ERRORS: Record<string, string> = {
  config: "O login com Facebook ainda não foi configurado no servidor (META_APP_ID, META_APP_SECRET e APP_URL).",
  admin: "Só administradores conectam canais.",
  sessao: "O login da Meta expirou ou veio de outra sessão. Tente de novo.",
  cancelado: "Login da Meta cancelado. Nada foi conectado.",
  troca: "A Meta não confirmou o login. Tente de novo em instantes.",
};

/** volta do login da Meta: lista as páginas autorizadas para a pessoa escolher qual conectar */
async function pickOptions(slug: string, userId: string, kind: string | undefined): Promise<MetaPickOptions | { error: string } | null> {
  if (kind !== "instagram" && kind !== "messenger" && kind !== "ig") return null;
  const pick = await readPick(slug, userId);
  if (!pick || pick.kind !== kind) return { error: META_ERRORS.sessao };
  try {
    if (kind === "ig") {
      const accounts = await igAccounts(pick.token);
      return { kind: "instagram", pages: accounts.map((a) => ({ id: a.id, name: "", ig: a.username })) };
    }
    const pages = await listPages(pick.token);
    return { kind, pages: pages.map((p) => ({ id: p.id, name: p.name, ig: p.ig?.username ?? null })) };
  } catch {
    return { error: META_ERRORS.troca };
  }
}

export default async function ChannelsPage({ params, searchParams }: PageProps<"/[ws]/settings/channels">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as { escolher?: string; meta_erro?: string };
  const { user, ws } = await requireWorkspace(slug);
  const [channels, pipelines, pick] = await Promise.all([listChannels(ws.id), listPipelines(ws.id), pickOptions(slug, user.id, sp.escolher)]);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const notice = (sp.meta_erro && META_ERRORS[sp.meta_erro]) || (pick && "error" in pick ? pick.error : null);
  return (
    <>
      <PageHeader title="Canais" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <ChannelsManager
        slug={slug}
        channels={channels}
        pipelines={pipelines}
        webhookUrl={`${origin}/api/webhooks/meta`}
        chatBase={origin}
        metaLogin={metaLoginOn()}
        igLogin={igLoginOn()}
        pick={pick && !("error" in pick) ? pick : null}
        notice={notice}
      />
    </>
  );
}
