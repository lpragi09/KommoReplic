import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name} (veja web/.env.example)`);
  return v;
}

/** Cliente com a sessão do usuário (cookies). O RLS do banco decide o que ele vê. */
export async function userClient(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // chamado de um Server Component: o proxy/ação seguinte renova o cookie
        }
      },
    },
  });
}

/** Cliente com a chave secreta: ignora o RLS. Só para webhooks, chat público e jobs — sempre filtrando por workspace. */
let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  admin ??= createAdmin(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
