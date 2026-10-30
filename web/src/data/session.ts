import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { DomainError } from "./types";
import { userBySessionToken, workspaceForUser } from ".";

export const SESSION_COOKIE = "crm_session";

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userBySessionToken(token);
}

/** Usuário logado e membro do workspace da URL, ou redireciona / 404. */
export async function requireWorkspace(slug: string) {
  // sessão do Supabase usa o relógio: tela atrás de login sempre renderiza na hora do pedido
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login");
  try {
    const ws = await workspaceForUser(slug, user.id);
    return { user, ws };
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
}

/** Central da plataforma: só os donos do netzer (PLATFORM_ADMINS). Para os outros a página nem existe (404). */
export async function requirePlatformAdmin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { isPlatformAdmin } = await import("@/lib/platform");
  if (!isPlatformAdmin(user.email)) notFound();
  return user;
}
