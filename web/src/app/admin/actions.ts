"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/data/session";
import { platform } from "@/data/platform";
import { DomainError } from "@/data/types";

/* Ações da Central da plataforma. Cada uma confere que quem pede é dono do netzer e fica no registro. */

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(action: string, target: string, detail: Record<string, unknown>, fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const me = await requirePlatformAdmin();
    const data = await fn();
    await platform.audit(me.email, action, target, detail).catch(() => undefined);
    refresh();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dados inválidos." };
    if (e instanceof DomainError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect/notFound do Next
    console.error("[central]", e);
    return { ok: false, error: "Não deu certo agora. Tente de novo." };
  }
}

const id = z.string().min(1).max(64);
const plan = z.enum(["trial", "basic", "advanced", "pro"]);

export async function extendTrialAction(wsId: string, label: string, days: number) {
  const d = z.number().int().min(1).max(90).parse(days);
  return run("estendeu o teste", label, { dias: d }, () => platform.extendTrial(id.parse(wsId), d));
}

export async function setPlanAction(wsId: string, label: string, p: string) {
  const v = plan.parse(p);
  return run(v === "trial" ? "voltou para o teste" : "liberou plano", label, { plano: v }, () => platform.setPlan(id.parse(wsId), v));
}

export async function setBlockedAction(wsId: string, label: string, blocked: boolean) {
  return run(blocked ? "pausou a empresa" : "reativou a empresa", label, {}, () => platform.setBlocked(id.parse(wsId), z.boolean().parse(blocked)));
}

export async function setUserBannedAction(userId: string, label: string, banned: boolean) {
  return run(banned ? "bloqueou o acesso" : "liberou o acesso", label, {}, () => platform.setUserBanned(id.parse(userId), z.boolean().parse(banned)));
}

export async function setUserPasswordAction(userId: string, label: string, password: string) {
  const pw = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(72).parse(password);
  return run("trocou a senha", label, {}, () => platform.setUserPassword(id.parse(userId), pw));
}

const demo = z.object({
  name: z.string().trim().min(2, "Dê um nome para a empresa de demonstração.").max(80),
  email: z.string().trim().email("Email inválido.").max(200),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(72),
});

export async function createDemoAction(input: z.input<typeof demo>) {
  const v = demo.parse(input);
  return run("criou demonstração", v.name, { email: v.email }, async () => {
    const me = await requirePlatformAdmin();
    return platform.createDemo({ ...v, owner: me.email });
  });
}

export async function resetDemoAction(wsId: string, label: string) {
  return run("restaurou a demonstração", label, {}, () => platform.resetDemo(id.parse(wsId)));
}
