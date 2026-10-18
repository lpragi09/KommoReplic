import { listLeads, listLossReasons, listPipelines, listUsers } from "@/data";
import { requireWorkspace } from "@/data/session";
import { csvName, csvResponse, toCsv } from "@/lib/csv";
import { phone } from "@/lib/format";

/* Exporta os leads em planilha: do funil escolhido (?pipeline=) ou de todos. Valor em reais, com vírgula. */
export async function GET(req: Request, { params }: { params: Promise<{ ws: string }> }) {
  const { ws: slug } = await params;
  const { ws } = await requireWorkspace(slug);
  const pipelineId = new URL(req.url).searchParams.get("pipeline") || undefined;
  const [leads, pipelines, users, reasons] = await Promise.all([listLeads(ws.id, { pipelineId }), listPipelines(ws.id), listUsers(ws.id), listLossReasons(ws.id)]);
  const pipeName = new Map(pipelines.map((p) => [p.id, p.name]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const reasonName = new Map(reasons.map((r) => [r.id, r.name]));
  const ident = (l: (typeof leads)[number], kinds: string[]) => l.mainContact?.identities.find((i) => kinds.includes(i.kind))?.value ?? "";
  const body = toCsv(
    ["Número", "Negócio", "Funil", "Etapa", "Valor (R$)", "Responsável", "Etiquetas", "Contato", "Telefone", "Email", "Origem", "Campanha", "Motivo da perda", "Criado em", "Fechado em"],
    leads.map((l) => [
      l.number,
      l.name,
      pipeName.get(l.pipelineId) ?? "",
      l.stage?.name ?? "",
      (l.priceCents / 100).toFixed(2).replace(".", ","),
      l.responsibleUserId ? (userName.get(l.responsibleUserId) ?? "") : "",
      l.tags.join(", "),
      l.mainContact?.name ?? "",
      phone(ident(l, ["phone", "whatsapp"])),
      ident(l, ["email"]),
      l.attribution?.utm_source ?? "",
      l.attribution?.utm_campaign ?? "",
      l.lossReasonId ? (reasonName.get(l.lossReasonId) ?? "") : "",
      l.createdAt.slice(0, 10),
      l.closedAt?.slice(0, 10) ?? "",
    ]),
  );
  return csvResponse(body, csvName("leads", slug));
}
