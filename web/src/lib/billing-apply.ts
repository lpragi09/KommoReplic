import "server-only";
import { adminClient } from "@/lib/supabase/clients";
import { decodeRef, type MpPayment } from "@/lib/mercadopago";
import { AI_PACKS, PLAN_PRICES, dailyCents, planCharge } from "@/lib/plans";

/* Pagamento aprovado → libera o que foi comprado. Chamado pelo webhook e pela própria tela de checkout
   (cartão aprovado na hora, Pix conferido enquanto a pessoa espera). Aplica uma vez por pagamento:
   apply_plan_payment / add_ai_credits ignoram o repetido. */

export async function applyPayment(pay: MpPayment) {
  if (pay.status !== "approved") return false;
  const ref = decodeRef(pay.external_reference);
  if (!ref) return false;
  const id = String(pay.id);
  const paidCents = Math.round(Number(pay.transaction_amount) * 100);
  const db = adminClient();

  if (ref.kind === "credits") {
    const p = AI_PACKS.find((x) => x.key === ref.pack)!;
    if (paidCents < p.cents) throw new Error(`valor ${paidCents} abaixo de ${p.cents}`);
    const { error } = await db.rpc("add_ai_credits", { p_session: `mp:${id}`, p_ws: ref.ws, p_credits: p.credits });
    if (error) throw new Error(error.message);
    return true;
  }

  const { cents, months } = planCharge(ref.key, ref.period, ref.seats);
  if (paidCents < cents) throw new Error(`valor ${paidCents} abaixo de ${cents}`);
  const plan = PLAN_PRICES[ref.key].plan;
  const { data: cur } = await db.from("subscriptions").select("plan, status, seats, current_period_end").eq("workspace_id", ref.ws).maybeSingle();
  const now = Date.now();
  const curEnd = cur?.current_period_end ? Date.parse(cur.current_period_end) : 0;
  const running = cur && (cur.status === "active" || cur.status === "past_due") && curEnd > now;
  // mesmo plano e usuários: soma no fim do período. Trocou: o que sobrou do anterior vira dias do novo, pelo valor.
  let start = now;
  if (running && cur.plan === plan && cur.seats === ref.seats) start = curEnd;
  else if (running) start = now + ((curEnd - now) * dailyCents(cur.plan, cur.seats)) / dailyCents(plan, ref.seats);
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);

  const { error } = await db.rpc("apply_plan_payment", {
    p_payment: `mp:${id}`,
    p_ws: ref.ws,
    p_plan: plan,
    p_seats: ref.seats,
    p_months: months,
    p_amount: paidCents,
    p_period_end: end.toISOString(),
  });
  if (error) throw new Error(error.message);
  return true;
}
