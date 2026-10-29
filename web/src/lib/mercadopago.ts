import "server-only";
import { AI_PACKS, PLAN_PRICES, type AiPackKey, type Period, type PriceKey } from "@/lib/plans";

/* Mercado Pago pela API REST (sem SDK no servidor): o checkout é no nosso site.
   Cada pagamento cobre um período (mês ou ano): Pix, boleto ou cartão (até 12x no anual). Sem renovação automática:
   perto do vencimento a tela de planos pede para renovar.
   O que foi comprado vai no external_reference, montado aqui no servidor; o webhook relê o pagamento na API
   com o nosso token, então um aviso falso não libera nada. Precisa de MP_ACCESS_TOKEN (e MP_PUBLIC_KEY para cartão). */

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

export type Payer = {
  email: string;
  first_name: string;
  last_name: string;
  identification: { type: "CPF" | "CNPJ"; number: string };
  address: { zip_code: string; street_name: string; street_number: string; neighborhood: string; city: string; federal_unit: string };
};

export type PayMethod = { kind: "pix" } | { kind: "boleto" } | { kind: "card"; token: string; paymentMethodId: string; issuerId?: string; installments: number };

/** cria o pagamento direto na API (checkout no nosso site). Cartão chega já tokenizado pelo script do Mercado Pago:
    o número do cartão nunca passa pelo nosso servidor. */
export async function createPayment(o: { purchase: Purchase; title: string; cents: number; payer: Payer; method: PayMethod; idempotencyKey: string }) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const base = {
    transaction_amount: o.cents / 100,
    description: o.title,
    external_reference: encodeRef(o.purchase),
    statement_descriptor: "NETZER",
    ...(appUrl ? { notification_url: `${appUrl}/api/webhooks/mercadopago` } : {}),
  };
  const m = o.method;
  const body =
    m.kind === "pix"
      ? { ...base, payment_method_id: "pix", payer: { email: o.payer.email, first_name: o.payer.first_name, last_name: o.payer.last_name, identification: o.payer.identification } }
      : m.kind === "boleto"
        ? { ...base, payment_method_id: "bolbradesco", date_of_expiration: new Date(Date.now() + 3 * 864e5).toISOString(), payer: o.payer }
        : {
            ...base,
            token: m.token,
            payment_method_id: m.paymentMethodId,
            ...(m.issuerId ? { issuer_id: m.issuerId } : {}),
            installments: m.installments,
            payer: { email: o.payer.email, identification: o.payer.identification },
          };
  return mp<MpPayment>("/v1/payments", { method: "POST", body: JSON.stringify(body), headers: { "x-idempotency-key": o.idempotencyKey } });
}

export type MpPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number | string;
  date_approved: string | null;
  date_of_expiration?: string | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
  transaction_details?: { external_resource_url?: string };
  barcode?: { content?: string };
};

export const getPayment = (id: string) => mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);
