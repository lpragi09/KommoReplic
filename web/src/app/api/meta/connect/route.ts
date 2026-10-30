import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { requireWorkspace } from "@/data/session";
import { listMembers } from "@/data";
import { META_STATE_COOKIE, igLoginOn, igLoginUrl, loginUrl, metaLoginOn } from "@/lib/meta-login";
import { seal } from "@/lib/secret-box";

/* Início do "Conectar com Facebook": confere quem pediu, guarda o state num cookie cifrado e manda para a Meta. */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("ws") ?? "";
  const kind = url.searchParams.get("kind");
  if (kind !== "instagram" && kind !== "messenger" && kind !== "ig") return new Response("canal inválido", { status: 400 });
  const { user, ws } = await requireWorkspace(slug);
  const back = `/${slug}/settings/channels`;
  if (!(kind === "ig" ? igLoginOn() : metaLoginOn())) return Response.redirect(new URL(`${back}?meta_erro=config`, url), 303);
  if (!(await listMembers(ws.id)).members.find((m) => m.userId === user.id)?.isAdmin) return Response.redirect(new URL(`${back}?meta_erro=admin`, url), 303);

  const state = randomBytes(16).toString("base64url");
  (await cookies()).set(META_STATE_COOKIE, seal(JSON.stringify({ state, slug, kind, user: user.id, exp: Date.now() + 10 * 60_000 })), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/meta",
    maxAge: 600,
  });
  return Response.redirect(kind === "ig" ? igLoginUrl(state) : loginUrl(state, kind), 303);
}
