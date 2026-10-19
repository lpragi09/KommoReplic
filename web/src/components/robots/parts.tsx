import type { ChannelKind, RobotStepType } from "@/data/types";
import { ArrowRightLeft, Bot, ChatText, CheckCheck, Link2, Mail, MessageSquare, Textbox, Users, Workflow, X, XCircle, Globe, Hourglass, InstagramLogo, ListPlus, MessageCircle, MessengerLogo, StickyNote, TagIcon, UserPlus, WhatsappLogo, type LucideIcon, Sparkle, CircleCheck, Plus } from "@/components/ui/icons";
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
  wait_reply: ChatText,
  validate: CheckCheck,
  condition: Workflow,
  round_robin: Users,
  internal: MessageSquare,
  set_field: Textbox,
  close: XCircle,
  webhook: Link2,
  email: Mail,
  start_robot: Bot,
  stop: X,
  ai: Sparkle,
  complete_tasks: CircleCheck,
  create_lead: Plus,
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
  wait_reply: "bg-accent text-on-accent",
  validate: "bg-accent text-on-accent",
  condition: "bg-[linear-gradient(140deg,var(--stage-4),var(--stage-7))] text-white",
  round_robin: "bg-[color-mix(in_srgb,var(--success)_15%,var(--bg))] text-success",
  internal: "bg-accent-soft text-accent-text",
  set_field: "bg-accent-soft text-accent-text",
  close: "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)]",
  webhook: "bg-inverse-bg text-on-inverse",
  email: "bg-accent-soft text-accent-text",
  start_robot: "bg-inverse-bg text-on-inverse",
  stop: "bg-danger-soft text-danger",
  ai: "bg-[linear-gradient(135deg,var(--accent),var(--stage-4))] text-on-accent",
  complete_tasks: "bg-[color-mix(in_srgb,var(--success)_15%,var(--bg))] text-success",
  create_lead: "bg-accent-soft text-accent-text",
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
          "absolute left-0.5 size-5 rounded-pill bg-bg shadow-[0_1px_3px_rgba(20,28,24,.3)] transition-transform duration-fast ease-out",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
