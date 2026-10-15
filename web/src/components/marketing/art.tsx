import { Bot, Check, CheckCheck, Globe, InstagramLogo, ListPlus, MessageCircle, Send, Trophy, WhatsappLogo } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Mini-telas ilustrativas da landing, só HTML e CSS (nada de imagem nem animação).
   Mostram como o produto funciona, sem números de clientes inventados. */

const glass = "rounded-lg bg-[color-mix(in_srgb,var(--night)_70%,transparent)] p-3 shadow-[inset_0_0_0_1px_var(--night-line)]";
const chip = "bg-[color-mix(in_srgb,var(--on-night)_8%,transparent)]";

export function ArtChat() {
  return (
    <div className={cn(glass, "flex flex-col gap-2")}>
      <div className="flex items-center gap-1.5 text-[11px] text-on-night-muted">
        <WhatsappLogo className="size-3.5 text-[#4ade80]" weight="fill" />
        <InstagramLogo className="size-3.5 text-[#f472b6]" weight="fill" />
        <Globe className="size-3.5 text-aurora-2" weight="fill" />
        <span className="ml-1">chegou agora</span>
      </div>
      <p className={cn("w-fit max-w-[90%] rounded-md rounded-bl-xs px-3 py-2 text-sm text-on-night", chip)}>Oi! Vocês fazem orçamento? 😊</p>
      <p className={cn("w-fit max-w-[70%] rounded-md rounded-bl-xs px-3 py-2 text-sm text-on-night", chip)}>É para 2 implantes</p>
    </div>
  );
}

export function ArtAccept() {
  return (
    <div className={cn(glass, "flex flex-col gap-3")}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-pill bg-[linear-gradient(140deg,var(--aurora-2),var(--aurora-1))] text-xs font-semibold text-white">MA</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-on-night">Marina Alves</p>
          <p className="truncate text-xs text-on-night-muted">“Oi! Vocês fazem orçamento?”</p>
        </div>
      </div>
      <div className="flex gap-2">
        <span className="flex-1 rounded-pill bg-accent py-1.5 text-center text-xs font-medium text-on-accent shadow-[0_6px_16px_-6px_rgba(29,78,216,.8)]">Aceitar</span>
        <span className={cn("flex-1 rounded-pill py-1.5 text-center text-xs text-on-night-muted", chip)}>Vincular</span>
      </div>
      <p className="flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--aurora-1)_25%,transparent)] px-2.5 py-1.5 text-xs text-on-night">
        <Bot className="size-3.5 text-aurora-2" weight="fill" /> Robô: “Oi, Marina! Já te respondemos.”
      </p>
    </div>
  );
}

export function ArtWin() {
  const cols = [
    { name: "Proposta", bar: "bg-stage-4", cards: 2 },
    { name: "Negociação", bar: "bg-stage-6", cards: 1 },
  ];
  return (
    <div className={cn(glass, "grid grid-cols-3 gap-2")}>
      {cols.map((c) => (
        <div key={c.name} className="flex flex-col gap-1.5">
          <span className={cn("h-1 rounded-pill", c.bar)} />
          <span className="truncate text-[10px] text-on-night-muted">{c.name}</span>
          {Array.from({ length: c.cards }).map((_, i) => (
            <span key={i} className={cn("h-7 rounded-sm", chip)} />
          ))}
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <span className="h-1 rounded-pill bg-stage-won" />
        <span className="truncate text-[10px] text-on-night-muted">Ganho</span>
        <span className="flex h-7 items-center justify-center gap-1 rounded-sm bg-[color-mix(in_srgb,#22c55e_22%,transparent)] text-[10px] font-semibold text-[#86efac] shadow-[inset_0_0_0_1px_color-mix(in_srgb,#22c55e_45%,transparent)]">
          <Trophy className="size-3" weight="fill" /> R$ 12.500
        </span>
      </div>
    </div>
  );
}

export function ArtRobot() {
  const steps = [
    { icon: MessageCircle, t: "Lead entra em “Primeiro contato”", hot: true },
    { icon: Send, t: "Envia: “Oi, Marina! 👋”" },
    { icon: ListPlus, t: "Cria tarefa: Responder Marina" },
    { icon: CheckCheck, t: "Espera 2 dias → cobra a proposta" },
  ];
  return (
    <ol className="mt-7 flex flex-1 flex-col justify-end" aria-label="Exemplo de robô">
      {steps.map((s, i) => (
        <li key={s.t} className="flex items-stretch gap-3">
          <div className="flex flex-col items-center">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-pill", s.hot ? "fx-tile" : "bg-[color-mix(in_srgb,var(--aurora-2)_16%,transparent)] text-aurora-2")}>
              <s.icon className="size-4" weight="fill" />
            </span>
            {i < steps.length - 1 && <span className="w-px flex-1 bg-[linear-gradient(var(--aurora-2),transparent)] opacity-60" />}
          </div>
          <p className={cn("mb-3 self-start rounded-md px-3 py-1.5 text-sm", s.hot ? "bg-on-night font-medium text-night" : "text-on-night " + chip)}>{s.t}</p>
        </li>
      ))}
    </ol>
  );
}

export function ArtBoard() {
  return (
    <div className={cn(glass, "grid grid-cols-3 gap-2")}>
      {[3, 2, 1].map((n, c) => (
        <div key={c} className="flex flex-col gap-1.5">
          <span className={cn("h-1 rounded-pill", ["bg-stage-3", "bg-stage-5", "bg-stage-won"][c])} />
          {Array.from({ length: n }).map((_, k) => (
            <span key={k} className={cn("h-6 rounded-sm", c === 1 && k === 0 ? "bg-[color-mix(in_srgb,var(--aurora-2)_30%,transparent)] shadow-[0_6px_14px_-6px_var(--aurora-2)] [transform:rotate(-4deg)]" : chip)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ArtChart() {
  const bars = [38, 55, 46, 72, 64, 90];
  return (
    <div className={cn(glass, "flex h-[92px] items-end gap-2")}>
      {bars.map((h, i) => (
        <span key={i} className={cn("flex-1 rounded-t-sm", i === bars.length - 1 ? "bg-[linear-gradient(180deg,var(--aurora-2),var(--aurora-1))] shadow-[0_0_16px_-4px_var(--aurora-2)]" : "bg-[color-mix(in_srgb,var(--aurora-2)_28%,transparent)]")} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function ArtBroadcast() {
  return (
    <div className={cn(glass, "flex items-center gap-3")}>
      <span className="fx-tile size-9 shrink-0">
        <Send className="size-4" weight="fill" />
      </span>
      <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--aurora-2),transparent)]" />
      <div className="flex -space-x-2">
        {["MA", "CR", "JP", "RT"].map((n, i) => (
          <span key={n} className={cn("grid size-8 place-items-center rounded-pill text-[10px] font-semibold text-white shadow-[0_0_0_2px_var(--night-raised)]", ["bg-stage-4", "bg-stage-5", "bg-stage-6", "bg-aurora-3"][i])}>
            {n}
          </span>
        ))}
        <span className="grid size-8 place-items-center rounded-pill bg-[color-mix(in_srgb,#22c55e_25%,var(--night-raised))] text-[#86efac] shadow-[0_0_0_2px_var(--night-raised)]">
          <Check className="size-3.5" weight="bold" />
        </span>
      </div>
    </div>
  );
}
