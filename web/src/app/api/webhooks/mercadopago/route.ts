import { adminClient } from "@/lib/supabase/clients";
import { decodeRef, getPayment, mpOn } from "@/lib/mercadopago";
import { AI_PACKS, PLAN_PRICES, dailyCents, planCharge } from "@/lib/plans";

/* Webhook do Mercado Pago.
   1. o aviso só traz o id do pagamento; relemos o pagamento na API com o nosso token (aviso falso não libera nada)
   2. só pagamento aprovado e com o valor certo conta
   3. aplica uma vez por pagamento (apply_plan_payment / add_ai_credits ignoram o repetido) — o Mercado Pago reenvia */

export async function POST(req: Request) {
  if (!mpOn()) return new Response("mercado pago não configurado", { status: 503 });
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  // outros avisos (pedido, estorno de chargeback etc.) não mudam nada aqui
  if (type !== "payment" || !/^\d{1,30}$/.test(id)) return new Response("ok (ignorado)", { status: 200 });

  try {
    const pay = await getPayment(id);
    if (pay.status !== "approved") return new Response("ok (não aprovado)", { status: 200 });
    const ref = decodeRef(pay.external_reference);
    if (!ref) return new Response("ok (não é nosso)", { status: 200 });
    const paidCents = Math.round(Number(pay.transaction_amount) * 100);
    const db = adminClient();

    if (ref.kind === "credits") {
      const p = AI_PACKS.find((x) => x.key === ref.pack)!;
      if (paidCents < p.cents) throw new Error(`valor ${paidCents} abaixo de ${p.cents}`);
      const { error } = await db.rpc("add_ai_credits", { p_session: `mp:${id}`, p_ws: ref.ws, p_credits: p.credits });
      if (error) throw new Error(error.message);
      return new Response("ok", { status: 200 });
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
  } catch (e) {
    console.error("[mercadopago] aviso", id, e instanceof Error ? e.message : e);
    return new Response("erro ao processar", { status: 500 }); // o Mercado Pago tenta de novo
  }
  return new Response("ok", { status: 200 });
}
