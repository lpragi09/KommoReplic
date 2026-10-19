import Stripe from "stripe";
import { adminClient } from "@/lib/supabase/clients";

/* Webhook do Stripe.
   1. verifica a assinatura (sem assinatura válida: 400)
   2. grava o evento em inbound_webhooks (unique provider+id) — o Stripe reenvia, e o 2º envio é ignorado
   3. atualiza subscriptions; o app só lê de lá, nunca confia no cliente */

const PLAN_BY_LOOKUP: Record<string, "basic" | "advanced" | "pro"> = {
  autonomo_mensal: "basic",
  autonomo_anual: "basic",
  equipe_mensal: "advanced",
  equipe_anual: "advanced",
  operacao_mensal: "pro",
  operacao_anual: "pro",
};

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return new Response("stripe não configurado", { status: 503 });
  const stripe = new Stripe(key);

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("assinatura inválida", { status: 400 });
  }

  const db = adminClient();
  const { error: dup } = await db.from("inbound_webhooks").insert({ provider: "stripe", external_id: event.id, payload: event as unknown as object });
  if (dup) {
    // já recebido: só ignora se terminou; se a tentativa anterior falhou, processa de novo
    const { data: prev } = await db.from("inbound_webhooks").select("processed_at").eq("provider", "stripe").eq("external_id", event.id).maybeSingle();
    if (!prev || prev.processed_at) return new Response("ok (repetido)", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object;
        const ws = s.client_reference_id;
        // créditos de IA avulsos: soma uma vez por sessão (Pix/boleto confirmam depois, no async_payment_succeeded)
        if (ws && s.mode === "payment" && s.metadata?.kind === "ai_credits") {
          const credits = Number(s.metadata.credits);
          if (s.payment_status === "paid" && Number.isInteger(credits) && credits > 0) {
            const { error } = await db.rpc("add_ai_credits", { p_session: s.id, p_ws: ws, p_credits: credits });
            if (error) throw new Error(error.message);
          }
          break;
        }
        if (ws && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(s.subscription));
          await upsertSubscription(ws, sub, String(s.customer));
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const ws = sub.metadata?.workspace_id;
        if (ws) await upsertSubscription(ws, sub, String(sub.customer));
        // TODO(fix 4): no "deleted" de plano anual, reembolso proporcional automático (stripe.refunds.create)
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        await db.from("subscriptions").update({ status: "past_due" }).eq("stripe_customer_id", String(inv.customer));
        // TODO: email avisando (Resend) com link do portal
        break;
      }
    }
    await db.from("inbound_webhooks").update({ processed_at: new Date().toISOString() }).eq("provider", "stripe").eq("external_id", event.id);
  } catch (e) {
    await db.from("inbound_webhooks").update({ error: String(e) }).eq("provider", "stripe").eq("external_id", event.id);
    return new Response("erro ao processar", { status: 500 }); // o Stripe tenta de novo
  }
  return new Response("ok", { status: 200 });
}

async function upsertSubscription(workspaceId: string, sub: Stripe.Subscription, customer: string) {
  const item = sub.items.data[0];
  const lookup = item?.price.lookup_key ?? "";
  const status = (["trialing", "active", "past_due", "canceled", "unpaid"] as const).find((s) => s === sub.status) ?? "unpaid";
  await adminClient()
    .from("subscriptions")
    .upsert({
      workspace_id: workspaceId,
      plan: PLAN_BY_LOOKUP[lookup] ?? "basic",
      status,
      seats: item?.quantity ?? 1,
      stripe_customer_id: customer,
      stripe_subscription_id: sub.id,
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    });
}
