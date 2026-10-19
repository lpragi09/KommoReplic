import "server-only";

/* Limite de tentativas por chave (login, cadastro, chat do site, cliques...).
   Com UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN: contador compartilhado no Redis (janela fixa),
   que vale para todas as instâncias da Vercel. Sem elas, ou se o Redis não responder: memória do servidor
   (serve para desenvolvimento e um servidor só). */
const hits = new Map<string, number[]>();

// em desenvolvimento os testes criam dezenas de contas do mesmo IP; em produção vale o limite real
const SLACK = process.env.NODE_ENV === "production" ? 1 : 20;

function memory(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 50_000) hits.clear(); // não deixa crescer sem limite
  return true;
}

async function redis(key: string, max: number, windowMs: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const k = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", k],
        ["PEXPIRE", k, String(windowMs)],
      ]),
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: number }[];
    const n = Number(out?.[0]?.result);
    return Number.isFinite(n) ? n <= max : null;
  } catch {
    return null; // Redis fora: cai para a memória em vez de travar o login de todo mundo
  }
}

/** true = pode seguir; false = passou do limite na janela */
export async function rateLimit(key: string, max: number, windowMs: number) {
  max *= SLACK;
  return (await redis(key, max, windowMs)) ?? memory(key, max, windowMs);
}
