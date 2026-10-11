import "server-only";

/* Limite simples por chave (janela deslizante em memória).
   Serve para desenvolvimento e um único servidor. Na Vercel cada instância tem a própria memória:
   em produção trocar por Upstash Ratelimit (mesma assinatura). */
const hits = new Map<string, number[]>();

// em desenvolvimento os testes criam dezenas de contas do mesmo IP; em produção vale o limite real
const SLACK = process.env.NODE_ENV === "production" ? 1 : 20;

export function rateLimit(key: string, max: number, windowMs: number) {
  max *= SLACK;
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
