import "server-only";
import { userClient } from "@/lib/supabase/clients";
import { DomainError, type BillingProfile, type ID } from "../types";

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
