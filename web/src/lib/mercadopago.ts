import "server-only";
import { AI_PACKS, PLAN_PRICES, type AiPackKey, type Period, type PriceKey } from "@/lib/plans";

/* Mercado Pago (Checkout Pro), pela API REST: sem SDK.
   Cada pagamento cobre um período (mês ou ano) e o cliente escolhe Pix, cartão (até 12x) ou boleto na página do Mercado Pago.
   Sem renovação automática: perto do vencimento a tela de planos pede para renovar.
   O que foi comprado vai no external_reference, montado aqui no servidor; o webhook relê o pagamento na API
   com o nosso token, então um aviso falso não libera nada. Precisa de MP_ACCESS_TOKEN. */

const API = "https://api.mercadopago.com";

export const mpOn = () => !!process.env.MP_ACCESS_TOKEN;

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

export type Purchase =
  | { kind: "plan"; ws: string; key: PriceKey; period: Period; seats: number }
  | { kind: "credits"; ws: string; pack: AiPackKey };

/** "plan|<ws>|equipe|anual|3" ou "credits|<ws>|ia_500" */
export const encodeRef = (p: Purchase) => (p.kind === "plan" ? ["plan", p.ws, p.key, p.period, p.seats] : ["credits", p.ws, p.pack]).join("|");

export function decodeRef(ref: string | null | undefined): Purchase | null {
  const [kind, ws, a, b, c] = (ref ?? "").split("|");
  if (!ws || !/^[0-9a-f-]{36}$/.test(ws)) return null;
  if (kind === "plan" && Object.hasOwn(PLAN_PRICES, a) && (b === "mensal" || b === "anual") && Number.isInteger(Number(c)) && Number(c) >= 1)
    return { kind, ws, key: a as PriceKey, period: b, seats: Number(c) };
  if (kind === "credits" && AI_PACKS.some((p) => p.key === a)) return { kind, ws, pack: a as AiPackKey };
  return null;
}

/** cria a preferência e devolve o link do checkout */
export async function createCheckout(o: { purchase: Purchase; title: string; cents: number; email: string; backUrl: string; installments: number }) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const pref = await mp<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [{ id: encodeRef(o.purchase).split("|").slice(2).join("_"), title: o.title, quantity: 1, currency_id: "BRL", unit_price: o.cents / 100 }],
      payer: { email: o.email },
      external_reference: encodeRef(o.purchase),
      back_urls: { success: o.backUrl, pending: o.backUrl, failure: o.backUrl },
      auto_return: "approved",
      ...(appUrl ? { notification_url: `${appUrl}/api/webhooks/mercadopago` } : {}),
      payment_methods: { installments: o.installments },
      statement_descriptor: "NETZER",
    }),
  });
  return pref.init_point;
}

export type MpPayment = { id: number; status: string; external_reference: string | null; transaction_amount: number | string; date_approved: string | null };

export const getPayment = (id: string) => mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);
