# KommoReplic

CRM conversacional (funil Kanban + caixa de entrada + chat do site) em Next.js 16, React e TypeScript, com Supabase pronto para ligar. Nome do produto: **Recadi** (provisório, ver `replica/brand.md`).

## Rodar

```bash
cd web
npm install
npm run dev
```

Abre em http://localhost:3000. Sem configurar nada, roda com dados de exemplo em memória (somem ao reiniciar). Conta de exemplo: ver `web/src/data/fake/store.ts` (`SEED_LOGIN`).

Para o banco real: `replica/backend.md`. Banco novo: rode `web/supabase/setup.sql` no SQL Editor. Banco que já existia: rode os `web/supabase/atualizacao-*.sql` que faltam, na ordem escrita no topo de cada um (todos podem rodar de novo). As variáveis estão explicadas em `web/.env.example`.

## Testes

```bash
cd web
npx playwright install chromium
npx playwright test
```

## Pastas

- `web/`: o app (Next.js). Deploy na Vercel com **Root Directory = `web`**.
- `replica/`: pesquisa, arquitetura, design, testes, paridade, marca, lançamento e deploy.
