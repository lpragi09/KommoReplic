import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import { listChannels } from "@/data";
import { requireWorkspace } from "@/data/session";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/page-header";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

const statusLabel = { connecting: "Conectando", connected: "Conectado", error: "Com erro", disconnected: "Desconectado" };

export default async function ChannelsPage({ params }: PageProps<"/[ws]/settings/channels">) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const channels = await listChannels(ws.id);
  const webchat = channels.filter((c) => c.kind === "webchat");
  return (
    <>
      <PageHeader title="Canais" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
          {webchat.map((c) => (
            <section key={c.id} className="rounded-md border border-border p-4" aria-labelledby={`ch-${c.id}`}>
              <div className="flex items-center gap-3">
                <MessageCircle className="size-6 text-accent" aria-hidden />
                <div className="flex-1">
                  <h2 id={`ch-${c.id}`} className="font-medium text-fg">
                    {c.name}
                  </h2>
                  <p className={cn("text-sm", c.status === "connected" ? "text-success" : "text-warning")}>{statusLabel[c.status]}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted">Quem escrever por este link cai como lead de entrada no seu funil. Coloque o link no site, na bio ou no email.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-sm">/chat/{c.publicKey}</code>
                <Link href={`/chat/${c.publicKey}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-accent px-4 text-base font-medium text-on-accent hover:bg-accent-hover">
                  Abrir chat <ExternalLink className="size-4" aria-hidden />
                  <span className="sr-only">(abre em nova aba)</span>
                </Link>
              </div>
            </section>
          ))}
          {[
            { name: "WhatsApp", text: "API oficial da Meta. Precisa de conta Business verificada." },
            { name: "Instagram", text: "Mensagens diretas da sua conta profissional." },
            { name: "Messenger", text: "Mensagens da sua página do Facebook." },
          ].map((c) => (
            <section key={c.name} className="flex items-center gap-3 rounded-md border border-dashed border-border-input p-4">
              <MessageCircle className="size-6 text-muted" aria-hidden />
              <div className="flex-1">
                <h2 className="font-medium text-fg">{c.name}</h2>
                <p className="text-sm text-muted">{c.text}</p>
              </div>
              <span className="text-xs font-medium text-muted">Em breve</span>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
