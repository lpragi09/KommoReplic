import { NextResponse, type NextRequest } from "next/server";
import { finishOAuth } from "@/data";

/* Volta do login com Google: troca o código pela sessão e segue para /app,
   que leva para a empresa da pessoa ou para o onboarding (empresa e CPF/CNPJ) se ela é nova. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", req.url));
  try {
    await finishOAuth(code);
  } catch {
    return NextResponse.redirect(new URL(req.nextUrl.searchParams.get("next") === "/nova-senha" ? "/esqueci?expirado=1" : "/login?erro=google", req.url));
  }
  // link de "esqueci minha senha": entra já logado na tela de senha nova
  const next = req.nextUrl.searchParams.get("next");
  return NextResponse.redirect(new URL(next === "/nova-senha" ? "/nova-senha" : "/app", req.url));
}
