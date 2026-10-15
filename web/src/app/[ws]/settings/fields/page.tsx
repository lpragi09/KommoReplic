import { listFields } from "@/data";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { FieldsManager } from "@/components/settings/fields";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Campos personalizados" };

export default async function FieldsPage({ params }: PageProps<"/[ws]/settings/fields">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const fields = await listFields(ws.id);
  return (
    <>
      <PageHeader title="Campos personalizados" crumbs={[{ label: "Configurações", href: `/${slug}/settings` }]} />
      <FieldsManager slug={slug} fields={fields} />
    </>
  );
}
