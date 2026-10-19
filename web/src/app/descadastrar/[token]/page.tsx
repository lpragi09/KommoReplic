import { Suspense } from "react";
import { redirect } from "next/navigation";
import { optOutContact } from "@/data";
import { readUnsubscribeToken } from "@/lib/unsubscribe";

export const metadata = { title: "Descadastrar", robots: { index: false } };

/* Link do rodapé dos emails. Pede um clique de confirmação: antivírus de email abrem os links sozinhos,
   e sem isso descadastrariam gente que não pediu. */
async function confirm(token: string) {
  "use server";
  const id = readUnsubscribeToken(token);
  if (id) await optOutContact(id);
  redirect(`/descadastrar/${token}?ok=1`);
}

async function Body({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { token } = await params;
  const { ok } = await searchParams;
  const valid = !!readUnsubscribeToken(token);
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center bg-surface p-4">
      <div className="w-full max-w-md rounded-xl bg-bg p-8 text-center shadow-[0_0_0_1px_var(--border),0_12px_30px_-18px_rgba(20,28,24,.35)]">
        {!valid ? (
          <>
            <h1 className="text-xl font-semibold text-fg">Link inválido</h1>
            <p className="mt-2 text-sm text-muted">Este link de descadastro não confere. Use o link do email mais recente.</p>
          </>
        ) : ok ? (
          <>
            <h1 className="text-xl font-semibold text-fg">Pronto, você foi descadastrado</h1>
            <p className="mt-2 text-sm text-muted">Você não vai mais receber emails desta empresa por aqui.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-fg">Parar de receber emails?</h1>
            <p className="mt-2 text-sm text-muted">Confirme para não receber mais emails desta empresa.</p>
            <form action={confirm.bind(null, token)} className="mt-6">
              <button type="submit" className="h-11 rounded-md bg-accent px-5 font-medium text-on-accent hover:bg-accent-hover">
                Confirmar descadastro
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function UnsubscribePage({ params, searchParams }: PageProps<"/descadastrar/[token]">) {
  return (
    <Suspense fallback={null}>
      <Body params={params as Promise<{ token: string }>} searchParams={searchParams as Promise<{ ok?: string }>} />
    </Suspense>
  );
}
