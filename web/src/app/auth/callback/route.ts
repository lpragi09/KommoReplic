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
    return NextResponse.redirect(new URL("/login?erro=google", req.url));
  }
  return NextResponse.redirect(new URL("/app", req.url));
}
