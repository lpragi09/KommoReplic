import { getPayment, mpOn } from "@/lib/mercadopago";
import { applyPayment } from "@/lib/billing-apply";

/* Webhook do Mercado Pago.
   O aviso só traz o id do pagamento; relemos o pagamento na API com o nosso token (aviso falso não libera nada)
   e aplicamos uma vez só (o Mercado Pago reenvia). Pix e boleto se confirmam por aqui, minutos ou dias depois. */

export async function POST(req: Request) {
  if (!mpOn()) return new Response("mercado pago não configurado", { status: 503 });
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  // outros avisos (pedido, chargeback etc.) não mudam nada aqui
  if (type !== "payment" || !/^\d{1,30}$/.test(id)) return new Response("ok (ignorado)", { status: 200 });

  try {
    await applyPayment(await getPayment(id));
  } catch (e) {
    console.error("[mercadopago] aviso", id, e instanceof Error ? e.message : e);
    return new Response("erro ao processar", { status: 500 }); // o Mercado Pago tenta de novo
  }
  return new Response("ok", { status: 200 });
}
