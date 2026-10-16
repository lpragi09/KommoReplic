import type { Access, Subscription } from "./types";

/** Regra única de acesso: teste em dia, plano pago, ou travado (só a tela de planos abre). */
export function accessOf(status: Subscription["status"], trialEndsAt: string | null, plan: Subscription["plan"] = "trial", now = Date.now()): Access {
  const a = base(status, trialEndsAt, now);
  // plano pago só vale enquanto ativo; no teste, tudo liberado
  return { ...a, plan: a.state === "trial" ? "trial" : plan };
}

function base(status: Subscription["status"], trialEndsAt: string | null, now: number): Omit<Access, "plan"> {
  if (status === "active") return { state: "active", reason: null, trialEndsAt, daysLeft: null };
  if (status === "past_due") return { state: "active", reason: "unpaid", trialEndsAt, daysLeft: null }; // alguns dias para acertar o cartão
  if (status === "unpaid") return { state: "locked", reason: "unpaid", trialEndsAt, daysLeft: 0 };
  if (status === "canceled") return { state: "locked", reason: "canceled", trialEndsAt, daysLeft: 0 };
  if (!trialEndsAt) return { state: "trial", reason: null, trialEndsAt: null, daysLeft: null };
  const ms = Date.parse(trialEndsAt) - now;
  if (ms <= 0) return { state: "locked", reason: "trial_over", trialEndsAt, daysLeft: 0 };
  return { state: "trial", reason: null, trialEndsAt, daysLeft: Math.ceil(ms / 864e5) };
}
