"use client";

import { useState, type ReactNode } from "react";
import { Filter, Inbox, Plus, Search, TrendingDown, TrendingUp } from "lucide-react";
import { Composer, ConversationList, MessageBubble, type Conv, type Msg } from "@/components/chat/chat";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Avatar, Badge, EmptyState, Skeleton, Tag } from "@/components/ui/bits";
import { SegmentedControl, useToast } from "@/components/ui/interactive";
import { Dialog, DialogClose, Tabs } from "@/components/ui/overlay";

/* Galeria do design system. Dados fictícios, só para ver os estados. */

const conversations: Conv[] = [
  { id: "c1", name: "Marina Alves", channel: "WhatsApp", preview: "Vocês atendem sábado?", at: "14:02", unread: 2, waiting: "12 min" },
  { id: "c2", name: "Carlos Reis", channel: "Instagram", preview: "Perfeito, pode mandar a proposta", at: "13:40", unread: 0 },
  { id: "c3", name: "Visitante 8812", channel: "Chat do site", preview: "Quanto custa o plano básico?", at: "12:15", unread: 1 },
];

const messages: Msg[] = [
  { id: "m0", kind: "system", text: "Lead movido para Qualificado por Ana", at: "13:58" },
  { id: "m1", kind: "in", text: "Oi! Vocês atendem sábado?", at: "14:01" },
  { id: "m2", kind: "out", text: "Olá, Marina! Atendemos sim, das 8h às 12h.", at: "14:02", status: "read" },
  { id: "m3", kind: "note", text: "@Bruno ela quer orçamento para 2 implantes", at: "14:03", author: "Ana" },
  { id: "m4", kind: "out", text: "Posso te mandar os horários livres?", at: "14:04", status: "failed" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-caps uppercase text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const toast = useToast();

  return (
    <div className="flex h-screen">

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-[var(--topbar)] shrink-0 items-center gap-4 border-b border-border bg-bg px-4">
          <h1 className="text-lg text-fg">Vendas</h1>
          <SegmentedControl
            label="Visão"
            value={view}
            onChange={setView}
            options={[
              { value: "kanban", label: "Kanban" },
              { value: "list", label: "Lista" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <Field label="Buscar leads" hideLabel placeholder="Buscar" adornment={<Search className="size-4" />} className="w-56" />
            <Button variant="secondary" icon={<Filter className="size-4" aria-hidden />}>
              Filtros <Badge tone="neutral">2</Badge>
            </Button>
            <Button icon={<Plus className="size-4" aria-hidden />}>Novo lead</Button>
          </div>
        </header>

        <p className="border-b border-border bg-surface px-6 py-3 text-sm text-muted">Quadro Kanban, cartão do lead e inbox de verdade: entre em /login com a conta de exemplo.</p>

        <div className="grid gap-10 p-6 lg:grid-cols-2">
          <Section title="Botões">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primário</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Excluir</Button>
              <Button variant="inverse">Inverso</Button>
              <Button loading>Salvando</Button>
              <Button disabled>Desabilitado</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
              <IconButton label="Adicionar">
                <Plus className="size-4" />
              </IconButton>
              <IconButton label="Filtro ativo" aria-pressed>
                <Filter className="size-4" />
              </IconButton>
            </div>
          </Section>

          <Section title="Campos">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome do lead" placeholder="Ex.: Clínica Vida" />
              <Field label="Valor" adornment="R$" inputMode="decimal" defaultValue="12.500,00" />
              <Field label="Telefone" error="Número inválido — use DDD + número" defaultValue="11 9999" />
              <Field label="Email" hint="Usado para convites" disabled defaultValue="ana@empresa.com.br" />
            </div>
          </Section>

          <Section title="Tags, avatares, badges">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>indicação</Tag>
              <Tag tone={1}>varejo</Tag>
              <Tag tone={2}>SP</Tag>
              <Tag tone={3} onRemove={() => {}}>
                anual
              </Tag>
              <Avatar name="Ana Souza" size={24} />
              <Avatar name="Bruno Lima" size={32} />
              <Avatar name="Carlos Reis" size={40} />
              <Badge>4</Badge>
              <Badge tone="neutral">12</Badge>
              <Badge tone="dot" />
            </div>
          </Section>

          <Section title="Cores das etapas">
            <div className="flex flex-wrap gap-1.5">
              {(["1", "2", "3", "4", "5", "6", "7", "8", "won", "lost"] as const).map((c) => (
                <span
                  key={c}
                  className={
                    {
                      "1": "bg-stage-1 text-fg", "2": "bg-stage-2 text-fg", "3": "bg-stage-3 text-fg", "4": "bg-stage-4 text-fg",
                      "5": "bg-stage-5 text-on-accent", "6": "bg-stage-6 text-on-accent", "7": "bg-stage-7 text-on-accent",
                      "8": "bg-stage-8 text-on-accent", won: "bg-stage-won text-on-accent", lost: "bg-stage-lost text-on-accent",
                    }[c] + " grid h-10 w-16 place-items-center rounded-sm text-xs font-semibold"
                  }
                >
                  {c === "won" ? "Ganho" : c === "lost" ? "Perdido" : `Azul ${c}`}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Caixa de entrada">
            <div className="flex h-[420px] overflow-hidden rounded-md border border-border">
              <ConversationList items={conversations} activeId="c1" />
              <div className="flex min-w-0 flex-1 flex-col bg-surface">
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                  {messages.map((m) => (
                    <MessageBubble key={m.id} m={m} onRetry={() => toast.show({ text: "Reenviando…", tone: "info" })} />
                  ))}
                </div>
                <div className="p-2">
                  <Composer />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Compositor fora da janela de 24h">
            <Composer windowClosed />
            <Tabs
              tabs={[
                { value: "main", label: "Principal", content: <p className="text-sm text-muted">Campos principais do lead.</p> },
                { value: "stats", label: "Estatísticas", content: <p className="text-sm text-muted">Tempo em cada etapa.</p> },
                { value: "cfg", label: "Configurar", content: <p className="text-sm text-muted">Campos personalizados.</p> },
              ]}
            />
          </Section>

          <Section title="Diálogo e avisos">
            <div className="flex flex-wrap gap-2">
              <Dialog
                title="Marcar como perdido"
                description="Escolha o motivo. Ele aparece nos relatórios de perda."
                size="sm"
                trigger={<Button variant="secondary">Abrir diálogo</Button>}
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="danger">Marcar como perdido</Button>
                    </DialogClose>
                  </>
                }
              >
                <Field label="Motivo" placeholder="Ex.: Preço" />
              </Dialog>
              <Button variant="secondary" onClick={() => toast.show({ text: "Lead excluído", tone: "info", action: "Desfazer" })}>
                Aviso com desfazer
              </Button>
              <Button variant="secondary" onClick={() => toast.show({ text: "Não foi possível enviar a mensagem", tone: "error" })}>
                Aviso de erro
              </Button>
            </div>
          </Section>

          <Section title="Painel, vazio, carregando">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border p-4">
                <p className="text-caps uppercase text-muted">Leads ganhos</p>
                <p className="text-display text-fg">38</p>
                <p className="flex items-center gap-1 text-xs text-success">
                  <TrendingUp className="size-3.5" aria-hidden /> +12% vs. semana passada
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-caps uppercase text-muted">Sem resposta</p>
                <p className="text-display text-fg">7</p>
                <p className="flex items-center gap-1 text-xs text-danger">
                  <TrendingDown className="size-3.5" aria-hidden /> +3 vs. ontem
                </p>
              </div>
              <div className="rounded-md border border-border">
                <EmptyState icon={Inbox} title="Nenhuma conversa" text="Conecte um canal para começar a receber mensagens." action={<Button size="sm">Conectar canal</Button>} />
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-border p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </Section>
        </div>
      </main>
      {toast.node}
    </div>
  );
}
