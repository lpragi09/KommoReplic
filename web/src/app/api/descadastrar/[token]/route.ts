import { optOutContact } from "@/data";
import { readUnsubscribeToken } from "@/lib/unsubscribe";

/* Descadastro em um clique (cabeçalho List-Unsubscribe-Post do Gmail/Outlook): POST sem confirmação. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = readUnsubscribeToken((await params).token);
  if (!id) return new Response("link inválido", { status: 400 });
  await optOutContact(id);
  return new Response("ok", { status: 200 });
}
