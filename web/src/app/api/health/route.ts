/* Para o monitor de uptime: responde rápido, sem tocar no banco. */
export function GET() {
  return Response.json({ ok: true, backend: process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase" ? "supabase" : "memória" });
}
