import type { ReactNode } from "react";
import { ArrowUpRight, Globe, InstagramLogo, MessengerLogo, WhatsappLogo } from "@/components/ui/icons";
import type { Network, TemplateButton } from "@/lib/template-rules";
import { cn } from "@/lib/cn";

/* Prévia do modelo no visual de cada rede: cores, formato do balão e botões como o cliente vê.
   Imitação simples do layout para conferir texto e limites, sem logos ou telas copiadas. */

const sample = (t: string) =>
  t
    .replace(/\{\{\s*nome\s*\}\}/gi, "Marina")
    .replace(/\{\{\s*nome_completo\s*\}\}/gi, "Marina Alves")
    .replace(/\{\{\s*empresa\s*\}\}/gi, "sua empresa")
    .replace(/\{\{\s*responsavel\s*\}\}/gi, "Ana")
    .replace(/\{\{\s*lead\s*\}\}/gi, "Orçamento")
    .replace(/\{\{\s*utm_campaign\s*\}\}/gi, "outubro")
    .replace(/\{\{\s*utm_source\s*\}\}/gi, "instagram");

function Phone({ top, bg, children }: { top: ReactNode; bg: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] bg-inverse-bg p-2 shadow-[0_20px_40px_-20px_rgba(20,28,24,.6)]">
      <div className="overflow-hidden rounded-[22px]">
        {top}
        <div className={cn("flex min-h-[340px] flex-col justify-end gap-1.5 p-3", bg)}>{children}</div>
      </div>
    </div>
  );
}

export function TemplatePreview({
  network,
  company,
  header,
  body,
  footer,
  buttons,
}: {
  network: Network;
  company: string;
  header?: string;
  body: string;
  footer?: string;
  buttons: TemplateButton[];
}) {
  const text = sample(body) || "Sua mensagem aparece aqui.";
  const replies = buttons.filter((b) => b.kind === "reply");
  const links = buttons.filter((b) => b.kind === "url");
  const empty = !body.trim();

  if (network === "whatsapp")
    return (
      <Phone
        top={
          <div className="flex items-center gap-2 bg-[#008069] px-3 py-2.5 text-white">
            <span className="grid size-7 place-items-center rounded-pill bg-white/20 text-xs font-semibold">{company.slice(0, 1).toUpperCase()}</span>
            <span className="text-sm font-medium">{company}</span>
            <WhatsappLogo className="ml-auto size-4 opacity-80" weight="fill" aria-hidden />
          </div>
        }
        bg="bg-[#efeae2] bg-[radial-gradient(circle,rgba(0,0,0,.05)_1px,transparent_1px)] [background-size:14px_14px]"
      >
        <div className="max-w-[88%] self-start">
          <div className="rounded-lg rounded-tl-none bg-white px-2.5 pb-1 pt-2 text-[13px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
            {header && <p className="mb-1 font-bold">{sample(header)}</p>}
            <p className={cn("whitespace-pre-wrap break-words", empty && "text-[#667781]")}>{text}</p>
            {footer && <p className="mt-1 text-[11px] text-[#667781]">{footer}</p>}
            <p className="mt-0.5 text-right text-[10px] text-[#667781]">10:42</p>
          </div>
          {buttons.map((b, i) => (
            <div key={i} className="mt-0.5 flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-[13px] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
              {b.kind === "url" && <ArrowUpRight className="size-3.5" aria-hidden />}
              {b.text || "Botão"}
            </div>
          ))}
        </div>
      </Phone>
    );

  if (network === "instagram")
    return (
      <Phone
        top={
          <div className="flex items-center gap-2 border-b border-[#efefef] bg-white px-3 py-2.5 text-[#262626]">
            <span className="size-7 rounded-pill bg-[linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)] p-[2px]">
              <span className="grid size-full place-items-center rounded-pill bg-white text-[10px] font-semibold">{company.slice(0, 1).toUpperCase()}</span>
            </span>
            <span className="text-sm font-semibold">{company.toLowerCase().replace(/\s+/g, "")}</span>
            <InstagramLogo className="ml-auto size-4" aria-hidden />
          </div>
        }
        bg="bg-white"
      >
        <p className={cn("max-w-[80%] self-end whitespace-pre-wrap break-words rounded-[22px] bg-[linear-gradient(135deg,#7638fa,#d300c5_55%,#ff0069)] px-3.5 py-2 text-[13px] text-white", empty && "opacity-70")}>{text}</p>
        {replies.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {replies.map((b, i) => (
              <span key={i} className="rounded-pill border border-[#dbdbdb] px-3 py-1 text-[12px] font-semibold text-[#262626]">
                {b.text || "Resposta"}
              </span>
            ))}
          </div>
        )}
      </Phone>
    );

  if (network === "messenger")
    return (
      <Phone
        top={
          <div className="flex items-center gap-2 border-b border-[#e4e6eb] bg-white px-3 py-2.5 text-[#050505]">
            <span className="grid size-7 place-items-center rounded-pill bg-[#e4e6eb] text-xs font-semibold">{company.slice(0, 1).toUpperCase()}</span>
            <span className="text-sm font-semibold">{company}</span>
            <MessengerLogo className="ml-auto size-4 text-[#0866ff]" weight="fill" aria-hidden />
          </div>
        }
        bg="bg-white"
      >
        {links.length ? (
          <div className="max-w-[85%] self-end overflow-hidden rounded-[18px] border border-[#e4e6eb]">
            <p className="whitespace-pre-wrap break-words bg-[#f0f2f5] px-3 py-2 text-[13px] text-[#050505]">{text}</p>
            {links.map((b, i) => (
              <p key={i} className="border-t border-[#e4e6eb] bg-white py-2 text-center text-[13px] font-semibold text-[#0866ff]">
                {b.text || "Abrir link"}
              </p>
            ))}
          </div>
        ) : (
          <p className={cn("max-w-[80%] self-end whitespace-pre-wrap break-words rounded-[18px] bg-[linear-gradient(180deg,#0a7cff,#a033ff)] px-3 py-2 text-[13px] text-white", empty && "opacity-70")}>{text}</p>
        )}
        {replies.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-end gap-1.5">
            {replies.map((b, i) => (
              <span key={i} className="rounded-pill border border-[#0866ff] px-3 py-1 text-[12px] font-semibold text-[#0866ff]">
                {b.text || "Resposta"}
              </span>
            ))}
          </div>
        )}
      </Phone>
    );

  if (network === "tiktok")
    return (
      <Phone
        top={
          <div className="flex items-center gap-2 border-b border-[#ececec] bg-white px-3 py-2.5 text-[#161823]">
            <span className="grid size-7 place-items-center rounded-pill bg-[#161823] text-xs font-semibold text-white shadow-[2px_0_0_#25f4ee,-2px_0_0_#fe2c55]">{company.slice(0, 1).toUpperCase()}</span>
            <span className="text-sm font-semibold">{company}</span>
            <span className="ml-auto text-xs font-bold tracking-tight text-[#fe2c55]">TikTok</span>
          </div>
        }
        bg="bg-white"
      >
        <p className={cn("max-w-[80%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-[#25f4ee]/25 px-3 py-2 text-[13px] text-[#161823]", empty && "opacity-60")}>{text}</p>
        <p className="mt-1 text-center text-[10px] text-[#8a8b91]">Sem botões no TikTok · resposta em até 48h</p>
      </Phone>
    );

  return (
    <Phone
      top={
        <div className="flex items-center gap-2 bg-accent px-3 py-2.5 text-on-accent">
          <Globe className="size-4" aria-hidden />
          <span className="text-sm font-medium">{company} · chat do site</span>
        </div>
      }
      bg="bg-surface"
    >
      <p className={cn("max-w-[85%] self-start whitespace-pre-wrap break-words rounded-md rounded-bl-xs bg-bg px-3 py-2 text-[13px] text-fg shadow-[0_0_0_1px_var(--border)]", empty && "text-muted")}>{text}</p>
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {buttons.map((b, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent-text">
              {b.kind === "url" && <ArrowUpRight className="size-3" aria-hidden />}
              {b.text || "Botão"}
            </span>
          ))}
        </div>
      )}
    </Phone>
  );
}
