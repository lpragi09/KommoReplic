# Checklist de deploy: Recadi

> **Atualização de 18/10/2026.** Do preflight abaixo já existem: Termos e Privacidade (`/termos`, `/privacidade`), exclusão de conta (Configurações → Plano e cobrança), favicon e imagem social. O que ainda trava é ligar o Supabase de produção (`NEXT_PUBLIC_DATA_BACKEND=supabase` e as chaves de `web/.env.example`): sem isso o app roda com dados em memória, em que qualquer email entra na conta de demonstração.

Data: 2026-10-11 · Commit: branch `build` · Go do usuário: **ainda não pedido, e o preflight não passou**

## Veredito: **parado no preflight. Nada foi publicado.**

O app ainda roda com dados falsos em memória: reiniciar o servidor apaga tudo. Os pontos que travam estão abaixo. O `/replica-backend` (próxima etapa) resolve o maior deles.

## Preflight

| check | resultado | passa? |
| --- | --- | --- |
| e2e (`npx playwright test`) | 23 de 23 passando | ✅ |
| bugs S1/S2 abertos | 0 (`bugs.md`) | ✅ |
| paridade: todos os essenciais | **20 de 36**, nota 52,8 (`parity.md`) | ❌ |
| varredura de marca (`sweep.py`) | limpa, exit 0 | ✅ |
| listing das lojas (`listing.py`) | 0 erros, 0 avisos (o produto é web; loja depois) | ✅ |
| build de produção (`npm run build`) | passa (Next 16.4; rotas logadas em prerender parcial) | ✅ |
| Termos e Privacidade no ar, com processadores | não existem ("em preparação" no rodapé) | ❌ |
| exclusão de conta funciona | não existe | ❌ |
| favicon, títulos, imagem social, emails, ícone | títulos ✅ (`· Recadi`); favicon ainda é o padrão do Next ❌; sem imagem social ❌; sem emails | ❌ |
| **dados persistentes** | **não: repositório falso em memória** | ❌ |

## Produção: preparado, não executado

Você cria as contas e cola as chaves; eu não entro em conta, não compro domínio e não colo chave de produção.

| item | o que fazer | quem |
| --- | --- | --- |
| Banco | Projeto Supabase **separado** para produção, região São Paulo (sa-east-1), backups diários ligados, migrações rodadas pelo deploy (`supabase db push` no CI) | você cria; o script fica no repositório |
| Variáveis | as mesmas de `web/.env.example` (gerado no `/replica-backend`), cadastradas na Vercel em *Production* | você |
| Stripe | modo live, recriar produtos e preços de `launch/pricing.md`, webhook `https://SEU_DOMINIO/api/webhooks/stripe` + segredo, uma compra real e o reembolso dela | você |
| Login Google | domínio de produção em *Authorized redirect URIs* e *JavaScript origins* | você |
| Meta (WhatsApp) | app da Meta com o domínio de produção, webhook `https://SEU_DOMINIO/api/webhooks/meta`, revisão aprovada | você (pedir já) |
| Email | domínio verificado no Resend | você |

## Hospedagem e domínio (quando houver go)

Vercel ligada ao repositório: `main` publica; cada PR ganha uma URL de prévia. Região da função: `gru1` (São Paulo).

Depois que você comprar o domínio (ex.: recadi.com.br, se a checagem do `brand.md` confirmar):

| registro | nome | valor |
| --- | --- | --- |
| A | @ | IP do apex mostrado em Vercel → Domains |
| CNAME | www | `cname.vercel-dns.com` |
| TXT | (se a Vercel pedir) | valor de verificação mostrado |
| TXT (SPF) | @ ou `send` | o que o Resend mostrar (ex.: `v=spf1 include:amazonses.com ~all`) |
| CNAME/TXT (DKIM) | os nomes que o Resend mostrar | os valores do Resend |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@SEU_DOMINIO` → depois `p=quarantine` |

Host canônico: apex (`recadi.com.br`); `www` redireciona. HTTPS automático na Vercel; conferir o cadeado.

## Monitoramento (a ligar junto)

- Sentry (erros do Next, servidor e cliente)
- Uptime: `/` e `/api/health` a cada 1 min (Better Stack ou UptimeRobot), alerta por email/telefone
- Página de status pública (fix 3 do `fixes.md`)
- Analytics sem cookie (Plausible/Umami), o que dispensa banner de cookies
- Depois do go: fazer o fluxo principal no site ao vivo, no computador e no seu celular

## O que destrava o deploy, em ordem

1. `/replica-backend`: Supabase + Auth + Realtime trocando o repositório falso
2. Termos e Privacidade, e exclusão de conta
3. Favicon, imagem social e logo (`brand.md` → briefing)
4. Essenciais que faltam (`parity.md`), começando por convites, configuração de etapas e anexos
