import { deliverQueued, expireSubscriptions, tickRobots } from "@/data";

/* Rede de segurança dos robôs com "Esperar": a Vercel chama esta rota no horário do vercel.json.
   No dia a dia quem continua os robôs é a própria tela aberta (a cada ~30s) e cada ação no funil. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("forbidden", { status: 403 });
  let total = 0;
  for (let i = 0; i < 8; i++) {
    const n = await tickRobots(null);
    total += n;
    if (n === 0) break;
  }
  const delivered = await deliverQueued(null).catch(() => 0);
  const expired = await expireSubscriptions().catch(() => 0);
  return Response.json({ ok: true, processed: total, delivered, expired });
}
