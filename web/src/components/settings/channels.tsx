"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Channel, Pipeline } from "@/data/types";
import { connectChannelAction, connectMetaPageAction, disconnectChannelAction, startZapQrAction, zapQrStatusAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { Check, Copy, ExternalLink, FacebookLogo, Globe, InstagramLogo, WhatsappLogo, type LucideIcon, MessageSquare } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

type Social = "whatsapp" | "instagram" | "messenger";

/** páginas que voltaram do login da Meta, para escolher qual conectar */
export type MetaPickOptions = { kind: "instagram" | "messenger"; pages: { id: string; name: string; ig: string | null }[] };

const widgetTag = (base: string, key: string | null) => `<script src="${base}/widget.js" data-chat="${key ?? ""}" async></script>`;

const NETS: Record<Social, { label: string; icon: LucideIcon; tint: string; idLabel: string; idHint: string; steps: string[]; needsPage?: boolean }> = {
  whatsapp: {
    label: "WhatsApp",
    icon: WhatsappLogo,
    tint: "from-[#25d366] to-[#128c4a]",
    idLabel: "ID do número de telefone (Phone number ID)",
    idHint: "Meta for Developers → seu app → WhatsApp → Configuração da API.",
    steps: [
      "Crie uma conta no Meta Business (business.facebook.com) e verifique a empresa.",
      "Em developers.facebook.com, crie um app do tipo Empresa e adicione o produto WhatsApp.",
      "Cadastre e verifique o número da empresa (não pode estar em uso no WhatsApp do celular).",
      "Gere um token permanente: Configurações do negócio → Usuários do sistema → Gerar token (permissões whatsapp_business_messaging e whatsapp_business_management).",
      "Em WhatsApp → Configuração, coloque a URL do webhook e o token de verificação abaixo e assine o campo “messages”.",
    ],
  },
  instagram: {
    label: "Instagram",
    icon: InstagramLogo,
    tint: "from-[#f58529] via-[#dd2a7b] to-[#8134af]",
    idLabel: "ID da conta do Instagram (Instagram account ID)",
    idHint: "A conta precisa ser profissional e ligada a uma página do Facebook.",
    needsPage: true,
    steps: [
      "Deixe o Instagram como conta profissional e ligue a uma página do Facebook.",
      "No app da Meta, adicione o produto Messenger/Instagram e peça as permissões instagram_manage_messages e pages_messaging.",
      "Gere o token de acesso da página (permanente, por usuário do sistema).",
      "Em Webhooks, assine o objeto “instagram” (campo messages) com a URL e o token de verificação abaixo.",
    ],
  },
  messenger: {
    label: "Facebook",
    icon: FacebookLogo,
    tint: "from-[#1877f2] to-[#0a4fb8]",
    idLabel: "ID da página do Facebook (Page ID)",
    idHint: "Página → Sobre → Transparência da página, ou no Gerenciador de Negócios.",
    steps: [
      "No app da Meta, adicione o produto Messenger e conecte a sua página.",
      "Peça a permissão pages_messaging e gere o token de acesso da página (permanente).",
      "Em Webhooks, assine o objeto “page” (campo messages) com a URL e o token de verificação abaixo.",
    ],
  },
};

export function ChannelsManager({
  slug,
  channels,
  pipelines,
  webhookUrl,
  chatBase,
  metaLogin,
  igLogin,
  zapQr,
  pick,
  notice,
}: {
  slug: string;
  channels: Channel[];
  pipelines: Pipeline[];
  webhookUrl: string;
  chatBase: string;
  /** login com Facebook configurado no servidor (Instagram e Messenger em 1 clique) */
  metaLogin: boolean;
  /** login direto pelo Instagram configurado (conta profissional, sem página do Facebook) */
  igLogin: boolean;
  /** ponte do WhatsApp por QR code ligada no servidor */
  zapQr: boolean;
  pick: MetaPickOptions | null;
  notice: string | null;
}) {
  const [open, setOpen] = useState<Social | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [form, setForm] = useState({ externalId: "", pageId: "", token: "", appSecret: "", pipelineId: pipelines[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (k: string, t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(k);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const connect = () =>
    start(async () => {
      if (!open) return;
      const res = await connectChannelAction(slug, { kind: open, externalId: form.externalId, pageId: form.pageId, token: form.token, appSecret: form.appSecret, pipelineId: form.pipelineId || null });
      if (!res.ok) return setError(res.error);
      setError(null);
      setOpen(null);
      setForm({ ...form, externalId: "", pageId: "", token: "", appSecret: "" });
    });
  const disconnect = (c: Channel) =>
    start(async () => {
      const res = await disconnectChannelAction(slug, c.id);
      if (!res.ok) setError(res.error);
    });

  const webchat = channels.filter((c) => c.kind === "webchat");
  const card = "rounded-xl bg-bg p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(20,28,24,.06)]";

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        {(error || notice) && !open && (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
            {error ?? notice}
          </p>
        )}
        {pick && <PagePicker slug={slug} pick={pick} pipelines={pipelines} />}
        {qrOpen && <QrDialog slug={slug} pipelines={pipelines} onClose={() => setQrOpen(false)} />}
        {webchat.map((c) => (
          <section key={c.id} className={card} aria-labelledby={`ch-${c.id}`}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg bg-gradient-to-br from-[var(--aurora-2)] to-[var(--aurora-1)] text-white" aria-hidden>
                <Globe className="size-5" weight="fill" />
              </span>
              <div className="flex-1">
                <h2 id={`ch-${c.id}`} className="font-semibold text-fg">
                  {c.name}
                </h2>
                <p className="text-sm text-success">● Conectado</p>
              </div>
              <Link href={`/chat/${c.publicKey}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">
                Abrir chat <ExternalLink className="size-4" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-sm">{`${chatBase}/chat/${c.publicKey}`}</code>
              <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => copy(c.id, `${chatBase}/chat/${c.publicKey}`)}>
                {copied === c.id ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted">Quem escrever por este link cai como lead de entrada no seu funil. Coloque no site, na bio ou no email.</p>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-medium text-fg">Botão de chat no seu site</p>
              <p className="mt-0.5 text-sm text-muted">Cole antes de &lt;/body&gt;: aparece um botão no canto que abre este chat, levando a campanha (UTM) da visita.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-sm">{widgetTag(chatBase, c.publicKey)}</code>
                <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => copy(`w-${c.id}`, widgetTag(chatBase, c.publicKey))}>
                  {copied === `w-${c.id}` ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </section>
        ))}

        {(Object.keys(NETS) as Social[]).map((k) => {
          const n = NETS[k];
          const mine = channels.filter((c) => c.kind === k);
          const on = mine.find((c) => c.status === "connected");
          return (
            <section key={k} className={card} aria-labelledby={`net-${k}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn("grid size-11 place-items-center rounded-lg bg-gradient-to-br text-white", n.tint)} aria-hidden>
                  <n.icon className="size-5" weight="fill" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id={`net-${k}`} className="font-semibold text-fg">
                    {n.label}
                  </h2>
                  <p className={cn("text-sm", on ? "text-success" : "text-muted")}>
                    {on ? `● Conectado · ${on.name}` : k === "messenger" ? "Mensagens da sua página (Messenger)" : k === "instagram" ? "Direct da conta profissional" : "Não conectado"}
                  </p>
                </div>
                {on ? (
                  <Button variant="secondary" size="sm" onClick={() => disconnect(on)} disabled={pending}>
                    Desconectar
                  </Button>
                ) : k === "whatsapp" && zapQr ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
                      onClick={() => {
                        setError(null);
                        setOpen(k);
                      }}
                    >
                      API oficial
                    </button>
                    <Button size="sm" onClick={() => setQrOpen(true)}>
                      Conectar por QR code
                    </Button>
                  </div>
                ) : (k === "instagram" ? igLogin || metaLogin : k === "messenger" && metaLogin) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
                      onClick={() => {
                        setError(null);
                        setOpen(k);
                      }}
                    >
                      Conectar manualmente
                    </button>
                    {k === "instagram" && igLogin ? (
                      <a
                        href={`/api/meta/connect?ws=${encodeURIComponent(slug)}&kind=ig`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-[linear-gradient(90deg,#f58529,#dd2a7b_55%,#8134af)] px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-[filter] duration-fast hover:brightness-110"
                      >
                        <InstagramLogo className="size-4" weight="fill" aria-hidden /> Conectar com Instagram
                      </a>
                    ) : (
                      <a
                        href={`/api/meta/connect?ws=${encodeURIComponent(slug)}&kind=${k}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-[#1877f2] px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-[filter] duration-fast hover:brightness-110"
                      >
                        <FacebookLogo className="size-4" weight="fill" aria-hidden /> Conectar com Facebook
                      </a>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setOpen(k);
                    }}
                  >
                    Conectar
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        icon={<MessageSquare className="size-5" />}
        title={open ? `Conectar ${NETS[open].label}` : ""}
        description="Pela API oficial da Meta. Você cola os dados da sua conta e o sistema confere com a Meta antes de salvar."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={connect} loading={pending}>
              Conferir e conectar
            </Button>
          </>
        }
      >
        {open && (
          <div className="flex flex-col gap-5">
            <ol className="flex flex-col gap-2">
              {NETS[open].steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-sm text-fg">
                  <span className="grid size-6 shrink-0 place-items-center rounded-pill bg-accent-soft text-xs font-semibold text-accent-text">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="grid gap-3 rounded-lg bg-surface p-4 shadow-[inset_0_0_0_1px_var(--border)] sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted">URL do webhook</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-sm bg-bg px-2 py-1.5 text-sm">{webhookUrl}</code>
                  <Button size="sm" variant="secondary" icon={copied === "wh" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} onClick={() => copy("wh", webhookUrl)}>
                    {copied === "wh" ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                Token de verificação: o valor da variável <code>META_VERIFY_TOKEN</code> na Vercel (você escolhe, ex.: uma frase longa). Cada aviso da Meta vem assinado: se o app é o da netzer, vale a <code>META_APP_SECRET</code>; se o app é da sua empresa, cole a chave secreta dele abaixo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={NETS[open].idLabel} value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} inputMode="numeric" hint={NETS[open].idHint} />
              {NETS[open].needsPage && <Field label="ID da página do Facebook ligada" value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} inputMode="numeric" />}
              <div className="sm:col-span-2">
                <Field label="Token de acesso permanente" type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} hint="Fica guardado criptografado. Ninguém da equipe consegue ver depois." />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Chave secreta do app (se o app da Meta é da sua empresa)"
                  type="password"
                  autoComplete="off"
                  value={form.appSecret}
                  onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                  hint="Configurações do app → Básico → Chave secreta do app. Sem ela, os avisos do seu app são recusados. Também fica criptografada."
                />
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-fg sm:col-span-2">
                Funil onde os contatos novos caem
                <select value={form.pipelineId} onChange={(e) => setForm({ ...form, pipelineId: e.target.value })} className="h-10 rounded-md border border-border px-2 text-sm font-normal">
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

/** volta do login da Meta: escolhe a página (e o funil) e conecta sem copiar ID nem token */
function PagePicker({ slug, pick, pipelines }: { slug: string; pick: MetaPickOptions; pipelines: Pipeline[] }) {
  const router = useRouter();
  const usable = pick.kind === "messenger" ? pick.pages : pick.pages.filter((p) => p.ig);
  const [pageId, setPageId] = useState(usable[0]?.id ?? "");
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = NETS[pick.kind];
  const close = () => router.replace(`/${slug}/settings/channels`);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      icon={<n.icon className="size-5" weight="fill" />}
      title={pick.kind === "instagram" ? "Qual Instagram conectar?" : "Qual página conectar?"}
      description="Você entrou na Meta. Escolha a conta e o funil onde os contatos novos caem."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={!pageId}
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await connectMetaPageAction(slug, pageId, pipelineId || null);
                if (!res.ok) return setError(res.error);
                close();
              })
            }
          >
            Conectar {n.label}
          </Button>
        </>
      }
    >
      {usable.length === 0 ? (
        <p className="text-sm text-muted">
          {pick.kind === "instagram"
            ? "Nenhuma página autorizada tem um Instagram profissional ligado. Ligue o Instagram à página do Facebook e entre de novo, marcando a página."
            : "Nenhuma página foi autorizada. Entre de novo e marque a página da empresa."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-fg">{pick.kind === "instagram" ? "Conta do Instagram" : "Página do Facebook"}</legend>
            {usable.map((p) => (
              <label
                key={p.id}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 shadow-[0_0_0_1px_var(--border)]", pageId === p.id && "shadow-[0_0_0_2px_var(--accent)]")}
              >
                <input type="radio" name="meta-page" value={p.id} checked={pageId === p.id} onChange={() => setPageId(p.id)} className="accent-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{pick.kind === "instagram" ? `@${p.ig}` : p.name}</span>
                  {pick.kind === "instagram" && p.name && <span className="block truncate text-xs text-muted">página {p.name}</span>}
                </span>
              </label>
            ))}
          </fieldset>
          <Select label="Funil onde os contatos novos caem" value={pipelineId} onValueChange={setPipelineId} options={pipelines.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/** WhatsApp por QR code: pede o QR à ponte e mostra até lerem no celular (consulta a cada 3 s) */
function QrDialog({ slug, pipelines, onClose }: { slug: string; pipelines: Pipeline[]; onClose: () => void }) {
  const router = useRouter();
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!channelId) return;
    let stop = false;
    const tick = async () => {
      const r = await zapQrStatusAction(slug, channelId);
      if (stop) return;
      if (!r.ok) return setError(r.error);
      if (r.data.status === "open") {
        router.refresh();
        return onClose();
      }
      setQr(r.data.qr);
    };
    void tick();
    const t = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [slug, channelId, router, onClose]);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon={<WhatsappLogo className="size-5" weight="fill" />}
      title="Conectar WhatsApp por QR code"
      description="Igual ao WhatsApp Web: o celular continua com o WhatsApp normal e as conversas também caem no netzer."
      footer={
        <Button variant="secondary" onClick={onClose}>
          {channelId ? "Fechar" : "Cancelar"}
        </Button>
      }
    >
      {!channelId ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-fg">
            Não é a API oficial da Meta. Para não arriscar bloqueio do número, use para atender quem chama, sem disparos em massa.
          </p>
          <Select label="Funil onde os contatos novos caem" value={pipelineId} onValueChange={setPipelineId} options={pipelines.map((p) => ({ value: p.id, label: p.name }))} />
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await startZapQrAction(slug, pipelineId || null);
                if (!r.ok) return setError(r.error);
                setChannelId(r.data.channelId);
              })
            }
          >
            Gerar QR code
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR em base64 vindo da ponte
            <img src={qr} alt="QR code para conectar o WhatsApp" className="size-64 rounded-lg bg-white p-2 shadow-[0_0_0_1px_var(--border)]" />
          ) : (
            <div className="grid size-64 place-items-center rounded-lg bg-surface text-sm text-muted">Gerando o QR code…</div>
          )}
          <ol className="text-left text-sm text-muted">
            <li>1. No celular, abra o WhatsApp → Configurações → Aparelhos conectados.</li>
            <li>2. Toque em “Conectar um aparelho” e aponte para este QR code.</li>
            <li>3. Pronto: esta janela fecha sozinha quando conectar.</li>
          </ol>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
