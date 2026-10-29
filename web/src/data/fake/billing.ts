import "server-only";
import { connection } from "next/server";
import type { BillingProfile, ID } from "../types";

/* Dados de cobrança da empresa — banco em memória. */

const g = globalThis as unknown as { __crmBilling?: Map<string, BillingProfile> };
const profiles = (g.__crmBilling ??= new Map());

export async function getBillingProfile(wsId: ID): Promise<BillingProfile | null> {
  await connection();
  return profiles.get(wsId) ?? null;
}

export async function saveBillingProfile(wsId: ID, p: BillingProfile) {
  profiles.set(wsId, p);
}
