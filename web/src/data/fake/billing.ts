import "server-only";
import { connection } from "next/server";
import type { BillingProfile, CheckoutPayment, ID } from "../types";

/* Dados de cobrança da empresa — banco em memória. */

const g = globalThis as unknown as { __crmBilling?: Map<string, BillingProfile>; __crmPayments?: (CheckoutPayment & { workspaceId: string })[] };
const profiles = (g.__crmBilling ??= new Map());
const payments = (g.__crmPayments ??= []);

export async function getBillingProfile(wsId: ID): Promise<BillingProfile | null> {
  await connection();
  return profiles.get(wsId) ?? null;
}

export async function saveBillingProfile(wsId: ID, p: BillingProfile) {
  profiles.set(wsId, p);
}

export async function listCheckoutPayments(wsId: ID): Promise<CheckoutPayment[]> {
  await connection();
  return payments.filter((p) => p.workspaceId === wsId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map(({ workspaceId: _w, ...p }) => p);
}

/** grava o pagamento recém-criado no checkout (o servidor já conferiu a empresa) */
export async function saveCheckoutPayment(wsId: ID, p: CheckoutPayment) {
  const i = payments.findIndex((x) => x.id === p.id);
  if (i >= 0) payments[i] = { ...p, workspaceId: wsId };
  else payments.push({ ...p, workspaceId: wsId });
}

/** situação nova vinda do Mercado Pago (webhook ou consulta) */
export async function setCheckoutPaymentStatus(id: string, status: string) {
  const p = payments.find((x) => x.id === id);
  if (p) p.status = status;
}
