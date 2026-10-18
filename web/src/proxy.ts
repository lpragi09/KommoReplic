import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/* Renova a sessão do Supabase a cada pedido (o token expira em ~1h).
   Com o repositório falso não faz nada. Não decide acesso: isso é do RLS e das páginas. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // landing e páginas legais são estáticas: não tocam no banco
  if (pathname === "/" || pathname === "/termos" || pathname === "/privacidade") {
    const logged = request.cookies.getAll().some((c) => c.name === "crm_session" || (c.name.startsWith("sb-") && c.name.includes("auth-token")));
    return pathname === "/" && logged ? NextResponse.redirect(new URL("/app", request.url)) : NextResponse.next();
  }
  if (process.env.NEXT_PUBLIC_DATA_BACKEND !== "supabase") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // tudo menos arquivos estáticos, imagens, scripts do site do cliente e webhooks (que não têm sessão)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|w/|t\\.js|widget\\.js|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
