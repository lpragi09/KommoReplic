import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, MessageCircle, Phone } from "@/components/ui/icons";
import { getContact } from "@/data";
import { requireWorkspace } from "@/data/session";
import { leadTitle, money, phone } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/bits";
import { stageBar } from "@/lib/stage-colors";

export const metadata = { title: "Contato" };

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const icon = { phone: Phone, email: Mail, whatsapp: MessageCircle, instagram: MessageCircle, webchat: MessageCircle };
const label = { phone: "Telefone", email: "Email", whatsapp: "WhatsApp", instagram: "Instagram", webchat: "Chat do site" };

export default async function ContactPage({ params }: PageProps<"/[ws]/contacts/[id]">) {
  const { ws: slug, id } = await params;
  const { ws } = await requireWorkspace(slug);
  const d = await getContact(ws.id, id).catch(() => null);
  if (!d) notFound();
  const { contact, company, leads } = d;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Link href={`/${slug}/contacts`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Contatos
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={contact.name} src={contact.avatarUrl} size={40} />
          <h1 className="min-w-0 break-words text-xl text-fg">{contact.name}</h1>
        </div>
        <section aria-labelledby="ct" className="mt-6 rounded-md border border-border p-4">
          <h2 id="ct" className="text-caps uppercase text-muted">
            Como falar
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {contact.identities.length === 0 && <li className="text-sm text-muted">Sem telefone ou email.</li>}
            {contact.identities.map((i) => {
              const I = icon[i.kind];
              return (
                <li key={i.kind + i.value} className="flex items-center gap-2 text-sm">
                  <I className="size-4 text-muted" aria-hidden />
                  <span className="w-24 text-muted">{label[i.kind]}</span>
                  {i.kind === "phone" ? (
                    <a href={`tel:${i.value}`} className="text-accent-text hover:underline">
                      {phone(i.value)}
                    </a>
                  ) : i.kind === "email" ? (
                    <a href={`mailto:${i.value}`} className="text-accent-text hover:underline">
                      {i.value}
                    </a>
                  ) : (
                    <span className="text-fg">conectado</span>
                  )}
                </li>
              );
            })}
          </ul>
          {company && (
            <Link href={`/${slug}/companies/${company.id}`} className="mt-3 inline-flex items-center gap-2 text-sm text-fg hover:underline">
              <Building2 className="size-4 text-muted" aria-hidden /> {company.name}
            </Link>
          )}
        </section>
        <section aria-labelledby="lt" className="mt-4">
          <h2 id="lt" className="text-caps uppercase text-muted">
            Negócios ({leads.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {leads.length === 0 && <li className="text-sm text-muted">Nenhum negócio com este contato.</li>}
            {leads.map((l) => (
              <li key={l.id}>
                <Link href={`/${slug}/leads/${l.id}`} className="flex items-center gap-3 rounded-md border border-border p-3 hover:border-border-input">
                  <span className={cn("size-2.5 shrink-0 rounded-pill", stageBar[l.stage.color])} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">{leadTitle(l)}</span>
                  <span className="hidden text-sm text-muted sm:inline">{l.stage.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{money(l.priceCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
