import type { PlatformWorkspace } from "@/data/platform/types";

/* Situação de cada empresa na Central (usada no servidor e no navegador). */

export const PLAN_NAME = { trial: "Teste", basic: "Autônomo", advanced: "Equipe", pro: "Operação" } as const;

/** situação da empresa em uma palavra, com a cor certa */
export function statusOf(w: Pick<PlatformWorkspace, "status" | "plan" | "trialEndsAt" | "paying" | "isDemo">, now: number) {
  if (w.isDemo) return { key: "demo", label: "Demonstração", tone: "bg-[color-mix(in_srgb,var(--stage-4)_18%,transparent)] text-accent-text" };
  if (w.status === "canceled" || w.status === "unpaid") return { key: "paused", label: "Pausada", tone: "bg-danger-soft text-danger" };
  if (w.status === "past_due") return { key: "late", label: "Pagamento pendente", tone: "bg-warning-soft text-warning" };
  if (w.status === "active") return w.paying ? { key: "paying", label: "Pagante", tone: "bg-success-soft text-success" } : { key: "free", label: "Cortesia", tone: "bg-accent-soft text-accent-text" };
  const over = !!w.trialEndsAt && Date.parse(w.trialEndsAt) <= now;
  return over ? { key: "paused", label: "Teste acabou", tone: "bg-danger-soft text-danger" } : { key: "trial", label: "Em teste", tone: "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)]" };
}
