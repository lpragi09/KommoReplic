import { listContacts } from "@/data";
import { requireWorkspace } from "@/data/session";
import { csvName, csvResponse, toCsv } from "@/lib/csv";
import { phone } from "@/lib/format";

/* Exporta todos os contatos da empresa em planilha (LGPD: a pessoa leva os próprios dados).
   Vale mesmo com o teste vencido; cada um só exporta o que o RLS deixa ver. */
export async function GET(_req: Request, { params }: { params: Promise<{ ws: string }> }) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const contacts = await listContacts(ws.id, "", true);
  const first = (c: (typeof contacts)[number], kinds: string[]) => c.identities.find((i) => kinds.includes(i.kind))?.value ?? "";
  const body = toCsv(
    ["Nome", "Telefone", "Email", "Instagram", "Empresa", "Responsável", "Negócios", "Criado em"],
    contacts.map((c) => [
      c.name,
      phone(first(c, ["phone", "whatsapp"])), // (11) 98888-1234: o Excel não vira número nem fórmula
      first(c, ["email"]),
      first(c, ["instagram"]),
      c.company?.name ?? "",
      c.owner ?? "",
      c.leadCount,
      c.createdAt.slice(0, 10),
    ]),
  );
  return csvResponse(body, csvName("contatos", slug));
}
