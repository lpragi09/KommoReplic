import Link from "next/link";
import { ChevronRight, Columns3, CreditCard, ListPlus, MessageSquare, Users } from "lucide-react";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";

export default async function SettingsPage({ params }: PageProps<"/[ws]/settings">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const items = [
    { href: "channels", icon: MessageSquare, title: "Canais", text: "Chat do site, WhatsApp, Instagram" },
    { href: "pipelines", icon: Columns3, title: "Funis e etapas", text: "Nomes, ordem e cores das etapas" },
    { href: "users", icon: Users, title: "Equipe e permissões", text: "Convites e papéis" },
    { href: "fields", icon: ListPlus, title: "Campos personalizados", text: "Dados extras de leads e contatos" },
    { href: "billing", icon: CreditCard, title: "Plano e cobrança", text: "Assinatura e usuários" },
  ];
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          <dl className="mb-6 grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-sm">
            <div>
              <dt className="text-muted">Empresa</dt>
              <dd className="text-fg">{ws.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Endereço</dt>
              <dd className="text-fg">/{ws.slug}</dd>
            </div>
            <div>
              <dt className="text-muted">Fuso</dt>
              <dd className="text-fg">{ws.timezone}</dd>
            </div>
            <div>
              <dt className="text-muted">Moeda</dt>
              <dd className="text-fg">{ws.currency}</dd>
            </div>
          </dl>
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={`/${slug}/settings/${i.href}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                  <i.icon className="size-5 text-accent" aria-hidden />
                  <div className="flex-1">
                    <p className="font-medium text-fg">{i.title}</p>
                    <p className="text-sm text-muted">{i.text}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
