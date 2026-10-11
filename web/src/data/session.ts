import "server-only";
import { cookies } from "next/headers";
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
