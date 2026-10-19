import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/data/session";

/* Sessão vencida: o proxy manda "/" para /app sempre que vê um cookie de sessão, mesmo inválido,
   e a landing nunca aparecia. /app manda para cá quando não acha o usuário: limpa os cookies e volta ao início. */
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  for (const c of req.cookies.getAll()) {
    if (c.name === SESSION_COOKIE || (c.name.startsWith("sb-") && c.name.includes("auth-token"))) res.cookies.delete(c.name);
  }
  return res;
}
