import type { ChannelKind, RobotStepType } from "@/data/types";
import {
  ArrowRightLeft,
  Globe,
  Hourglass,
  InstagramLogo,
  ListPlus,
  MessageCircle,
  MessengerLogo,
  StickyNote,
  TagIcon,
  UserPlus,
  WhatsappLogo,
  type LucideIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Peças pequenas dos robôs, sem estado: servem tanto ao servidor quanto ao cliente. */

export const channelIcon: Record<ChannelKind, LucideIcon> = {
  whatsapp: WhatsappLogo,
  instagram: InstagramLogo,
  messenger: MessengerLogo,
  webchat: Globe,
};

export const stepIcon: Record<RobotStepType, LucideIcon> = {
  message: MessageCircle,
  wait: Hourglass,
  task: ListPlus,
  tag: TagIcon,
  responsible: UserPlus,
  stage: ArrowRightLeft,
  note: StickyNote,
};

/* cada tipo de passo com um tom próprio (todos dentro da paleta azul/preto + verde/âmbar de estado) */
export const stepTone: Record<RobotStepType, string> = {
  message: "bg-accent text-on-accent",
  wait: "bg-[color-mix(in_srgb,var(--warning)_18%,var(--bg))] text-warning",
  task: "bg-accent-soft text-accent-text",
  tag: "bg-accent-soft text-accent-text",
  responsible: "bg-accent-soft text-accent-text",
  stage: "bg-inverse-bg text-on-inverse",
  note: "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)]",
};

export function StepBadge({ type, size = "md" }: { type: RobotStepType; size?: "sm" | "md" }) {
  const Icon = stepIcon[type];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-sm", stepTone[type], size === "sm" ? "size-6" : "size-9")} aria-hidden>
      <Icon className={size === "sm" ? "size-3.5" : "size-[18px]"} weight={type === "message" ? "fill" : "regular"} />
    </span>
  );
}

/** Interruptor liga/desliga acessível (role="switch"). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill transition-colors duration-fast ease-out disabled:opacity-50",
        checked ? "bg-accent" : "bg-border-input",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0.5 size-5 rounded-pill bg-bg shadow-[0_1px_3px_rgba(14,26,58,.3)] transition-transform duration-fast ease-out",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
