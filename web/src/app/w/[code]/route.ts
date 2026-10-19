import { headers } from "next/headers";
import { clickTrackingLink } from "@/data";
import { cleanAttribution, fromSearch } from "@/lib/utm";
import { rateLimit } from "@/lib/rate-limit";

/* Link rastreável de WhatsApp: /w/{código}?utm_source=...
   Grava o clique com as UTMs (do link + da URL) e manda para o WhatsApp com um código curto no fim da mensagem.
   Quando a mensagem chega, o sistema acha o código e liga o clique à conversa — sem robô. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  if (!/^[a-z0-9]{6,12}$/.test(code)) return new Response("link não encontrado", { status: 404 });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const q = fromSearch(url.searchParams);
  // o script do site manda a página de entrada e de onde a pessoa veio
  const attr = cleanAttribution(
    { ...q, landing: url.searchParams.get("landing") ?? undefined, referrer: url.searchParams.get("ref") ?? h.get("referer") ?? undefined },
    url.searchParams.get("via") === "site" ? "site" : "link",
  );

  // cliques em massa do mesmo endereço não viram estatística falsa
  if (!(await rateLimit(`wlink:${ip}`, 30, 60_000))) return new Response("muitos cliques seguidos, tente em um minuto", { status: 429 });
  const hit = await clickTrackingLink(code, attr);
  if (!hit) return new Response("link não encontrado", { status: 404 });

  const text = [hit.message.trim(), `(ref: ${hit.ref})`].filter(Boolean).join("\n\n");
  const phone = hit.phone;
  return new Response(null, {
    status: 302,
    headers: { location: `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`, "cache-control": "no-store" },
  });
}
