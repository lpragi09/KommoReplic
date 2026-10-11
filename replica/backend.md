# Backend

Data: 2026-10-11 · Stack: Supabase (Postgres, Auth, Realtime, Storage) + Stripe + Meta Cloud API

## Como ligar

1. Crie um projeto Supabase de **desenvolvimento** (região São Paulo). Você cria a conta e o projeto.
2. `cp web/.env.example web/.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `NEXT_PUBLIC_DATA_BACKEND=supabase`.
3. Rode as migrações: `supabase link` e depois `supabase db push` (a pasta é `web/supabase/migrations`).
4. Dados de exemplo: `SEED_EMAIL=... SEED_PASSWORD=... node --env-file=.env.local scripts/seed.mjs`.
5. Em Auth → Providers: email ligado; Google com o OAuth app de vocês (redirect `https://SEU_PROJETO.supabase.co/auth/v1/callback`).

Sem `NEXT_PUBLIC_DATA_BACKEND=supabase`, o app continua no repositório falso em memória (é assim que os testes rodam).

## O que foi feito

| peça | onde | verificado |
| --- | --- | --- |
| Schema, RLS, triggers, Realtime, Storage | `supabase/migrations/…0001_init.sql` | PGlite: RLS por papel, aceitar com corrida, histórico, tarefas |
| RPCs: criar empresa, recusar/vincular entrada, receber mensagem, linha do visitante; perdido exige motivo; envio com trigger | `…0002_rpcs.sql` | PGlite: 15 checagens, 0 falhas (idempotência, intruso bloqueado, usuário comum não chama função de webhook) |
| Email no perfil, FKs para a API embutir nomes, empresa sobrevive à exclusão de quem criou | `…0003_profile_email.sql` | PGlite: aplica limpo |
| Repositório real com as **mesmas 46 funções** do falso | `src/data/supabase/repo.ts` | **só por tipos** (o TypeScript recusa se divergir). **Não rodou contra um Supabase real**: precisa das suas chaves |
| Seletor de backend | `src/data/index.ts` | e2e no modo falso: 25/25 |
| Sessão renovada a cada pedido | `src/proxy.ts` | não testado sem Supabase |
| Tempo real: canal privado `ws:{workspace}` | `components/shell/live-refresh.tsx` | não testado sem Supabase |
| Webhook Stripe (assinatura, dedup, assinatura no banco) | `app/api/webhooks/stripe` | não testado sem Stripe |
| Webhook Meta (handshake, HMAC, mensagens de texto) | `app/api/webhooks/meta` | não testado sem app da Meta |
| Checkout e portal do Stripe (cancelar em 1 clique) | `actions.ts`, S30 | e2e: sem chave, avisa sem quebrar |
| Exclusão de conta | `actions.ts`, S30 | e2e: apaga e o login deixa de funcionar |
| Limite de tentativas: login, cadastro, chat do site | `lib/rate-limit.ts` | e2e indireto (o limite derrubou a suíte até ser afrouxado em dev) |
| `/api/health` | `app/api/health` | — |

## Integrações

| integração | API oficial | permissões | revisão | limites |
| --- | --- | --- | --- | --- |
| WhatsApp | Cloud API (Graph) | `whatsapp_business_messaging`, `whatsapp_business_management` | App Review + verificação do Business + Tech Provider: **semanas, começar já** | por número e nível de qualidade; janela de 24h |
| Instagram / Messenger | Graph API | `instagram_manage_messages`, `pages_messaging` | App Review | por página |
| Stripe | Checkout + Billing + Portal | chaves de teste primeiro | — | — |
| Email | Resend | domínio verificado (SPF/DKIM) | — | plano grátis: 100/dia |

## Checklist de segurança

- [x] segredos só em variáveis de ambiente; `.env*` no `.gitignore` (só `.env.example` versionado, sem valores)
- [x] entrada validada no servidor (zod) em toda action
- [x] autorização em toda leitura e escrita: RLS, testado com segundo usuário no PGlite e no e2e (F01-E4)
- [x] limite de tentativas em login, cadastro e chat público — **em memória; trocar por Upstash em produção**
- [x] webhooks verificam assinatura (Stripe `constructEvent`, Meta HMAC-SHA256 com comparação em tempo constante)
- [x] uploads: bucket privado, limite de 100 MB, caminho por workspace (policy no schema). A UI de upload ainda não existe.
- [x] nenhum dado de usuário em URL ou log (o log do webhook da Meta só registra a mensagem de erro)
- [x] `npm audit --omit=dev`: 0 vulnerabilidades
- [ ] política de privacidade listando processadores (Supabase, Vercel, Stripe, Resend, Meta) — não existe ainda

## Falta

- Rodar tudo contra um Supabase real (suas chaves) e repetir a suíte e2e com `NEXT_PUBLIC_DATA_BACKEND=supabase`.
- Envio de saída pelo WhatsApp (job), mídia (download para o Storage), status de entrega pelo webhook.
- Emails (Resend): convite, aviso de pagamento falho, aviso 7 dias antes da renovação anual.
- Reembolso proporcional automático no cancelamento do anual (TODO no webhook do Stripe).
- Jobs (Inngest): lembrete de tarefa, limpeza de lixeira e de webhooks antigos.
