/* Ponto único de acesso a dados. Hoje: repositório falso em memória.
   Quando o replica-backend rodar, troque esta linha por "./supabase/repo" — nenhuma tela muda. */
export * from "./fake/repo";
