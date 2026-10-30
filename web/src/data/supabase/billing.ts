import "server-only";
import { adminClient, userClient } from "@/lib/supabase/clients";
import { DomainError, type BillingProfile, type CheckoutPayment, type ID } from "../types";

/* Dados de cobrança da empresa — Supabase (RLS: só administradores leem e alteram). */

export async function getBillingProfile(wsId: ID): Promise<BillingProfile | null> {
  const sb = await userClient();
  const { data, error } = await sb.from("billing_profiles").select("*").eq("workspace_id", wsId).maybeSingle();
  if (error || !data) return null; // banco sem a atualização ou ainda sem dados: o formulário abre vazio
  return { person: data.person, doc: data.doc, name: data.name, email: data.email, phone: data.phone, address: data.address };
}

export async function saveBillingProfile(wsId: ID, p: BillingProfile) {
  const sb = await userClient();
  const { error } = await sb
    .from("billing_profiles")
    .upsert({ workspace_id: wsId, person: p.person, doc: p.doc, name: p.name, email: p.email, phone: p.phone, address: p.address, updated_at: new Date().toISOString() });
  if (error?.code === "42P01") throw new DomainError("invalid", "Rode a atualização do banco (atualizacao-checkout.sql) para salvar os dados de cobrança.");
  if (error) throw new DomainError("forbidden", "Só administradores mudam os dados de cobrança.");
}

export async function listCheckoutPayments(wsId: ID): Promise<CheckoutPayment[]> {
  const sb = await userClient();
  const { data, error } = await sb.from("checkout_payments").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(20);
  if (error) return []; // banco sem a atualização ou quem vê não é admin: a lista fica vazia
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    cents: r.amount_cents,
    method: r.method,
    status: r.status,
    pix: r.pix_code ? { code: r.pix_code, image: r.pix_image } : null,
    boleto: r.boleto_url ? { url: r.boleto_url, barcode: r.boleto_barcode } : null,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

/** grava o pagamento recém-criado no checkout (o servidor já conferiu a empresa; chave secreta) */
export async function saveCheckoutPayment(wsId: ID, p: CheckoutPayment) {
  const { error } = await adminClient()
    .from("checkout_payments")
    .upsert({
      id: p.id,
      workspace_id: wsId,
      title: p.title,
      amount_cents: p.cents,
      method: p.method,
      status: p.status,
      pix_code: p.pix?.code ?? null,
      pix_image: p.pix?.image ?? null,
      boleto_url: p.boleto?.url ?? null,
      boleto_barcode: p.boleto?.barcode ?? null,
      expires_at: p.expiresAt,
    });
  if (error) console.error("[pagamentos] gravar", error.message); // sem a tabela o pagamento segue; só não aparece no histórico
}

/** situação nova vinda do Mercado Pago (webhook ou consulta) */
export async function setCheckoutPaymentStatus(id: string, status: string) {
  await adminClient().from("checkout_payments").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
}
