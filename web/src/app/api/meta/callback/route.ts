import { cookies } from "next/headers";
import { META_PICK_COOKIE, META_STATE_COOKIE, exchangeCode } from "@/lib/meta-login";
import { open, seal } from "@/lib/secret-box";
import { currentUser } from "@/data/session";

/* Volta do login da Meta: confere o state, troca o código por um token de longa duração e manda para a tela de
   canais escolher a página. O token fica só num cookie cifrado de 30 minutos, lido pelo servidor. */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get(META_STATE_COOKIE)?.value;
  jar.delete({ name: META_STATE_COOKIE, path: "/api/meta" });
  let saved: { state: string; slug: string; kind: string; user: string; exp: number } | null = null;
  try {
    saved = raw ? JSON.parse(open(raw)) : null;
  } catch {}
  const user = await currentUser();
  if (!saved || saved.exp < Date.now() || saved.state !== url.searchParams.get("state") || !user || user.id !== saved.user)
    return Response.redirect(new URL(saved ? `/${saved.slug}/settings/channels?meta_erro=sessao` : "/login", url), 303);

  const back = `/${saved.slug}/settings/channels`;
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(new URL(`${back}?meta_erro=cancelado`, url), 303); // pessoa fechou ou negou
  try {
    const token = await exchangeCode(code);
    jar.set(META_PICK_COOKIE, seal(JSON.stringify({ token, slug: saved.slug, kind: saved.kind, user: user.id, exp: Date.now() + 30 * 60_000 })), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 1800,
    });
    return Response.redirect(new URL(`${back}?escolher=${saved.kind}`, url), 303);
  } catch (e) {
    console.error("[meta] login", e instanceof Error ? e.message : e);
    return Response.redirect(new URL(`${back}?meta_erro=troca`, url), 303);
  }
}
