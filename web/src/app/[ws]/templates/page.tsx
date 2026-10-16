import { listTemplates } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { TemplatesManager } from "@/components/robots/templates";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Modelos de mensagem" };

export default async function TemplatesPage({ params }: PageProps<"/[ws]/templates">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const templates = await listTemplates(ws.id);
  return (
    <>
      <PageHeader title="Modelos de mensagem" crumbs={[{ label: "Automações", href: `/${slug}/automations` }]} />
      <TemplatesManager slug={slug} company={ws.name} templates={templates} />
    </>
  );
}
