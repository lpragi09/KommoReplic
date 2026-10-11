# Arquitetura: [nome a definir] — reconstrução das funcionalidades centrais do Kommo

Base: `replica/recon.md` (30 telas, 15 fluxos) e `replica/features.csv` (36 must, 20 should, 13 could, 7 skip).
Stack escolhida pelo usuário: Next.js, React, TypeScript, Supabase.

## Stack

| camada | escolha | por quê |
| --- | --- | --- |
| web | Next.js 15 (App Router) + React + TypeScript | pedido do usuário; Server Components para listas, Server Actions para mutações, Route Handlers para webhooks |
| UI | Tailwind + shadcn/ui (Radix) + Lucide | primitivos acessíveis prontos; tokens do replica-design entram no tema do Tailwind |
| Kanban | @dnd-kit | arrastar acessível por teclado, funciona em touch |
| tabelas | TanStack Table | ordenação, seleção e virtualização na lista de leads |
| estado no cliente | TanStack Query | cache + invalidação quando chega aviso do Realtime (inbox e Kanban) |
| banco | Postgres no Supabase (região sa-east-1, São Paulo) | pedido do usuário; RLS, Realtime, Storage, Vault no mesmo lugar; latência baixa no Brasil |
| acesso a dados | supabase-js + tipos gerados (`supabase gen types`) + SQL em migrações | sem ORM: as regras moram no banco (RLS, triggers) e o SQL fica legível |
| auth | Supabase Auth (email + senha, magic link, Google) | já incluso; `auth.uid()` alimenta o RLS |
| tempo real | Supabase Realtime, canais privados de broadcast `ws:{workspace_id}` | triggers enviam "mudou X"; cliente refaz a consulta com RLS. Escala melhor que postgres_changes com RLS |
| arquivos | Supabase Storage, bucket privado `attachments` | mídia do WhatsApp e anexos; política por workspace no caminho |
| segredos | Supabase Vault | tokens da Meta e segredos de webhook nunca ficam em texto puro em tabela |
| jobs | Inngest | atrasos de automação, retentativas com backoff, idempotência por chave, fan-out de transmissão; plano grátis no início |
| email transacional | Resend | convites, redefinição de senha, avisos de tarefa |
| pagamentos | Stripe Billing (assinatura por assento, BRL, cartão + Pix/boleto) | cobrança por usuário como o original; Customer Portal pronto |
| canais | WhatsApp Business Cloud API (Meta), Instagram e Messenger (Meta Graph API), widget de chat próprio | só APIs oficiais, com o app Meta do próprio produto e a conta de cada cliente |
| hospedagem | Vercel (região gru1) | deploy do Next sem configuração, preview por PR, cron se precisar |
| erros / logs | Sentry + logs da Vercel | grátis no começo |

Um banco, um app Next. Sem microsserviços.

## Schema

Tabelas: **36** (ver `replica/schema.sql`, que é a primeira migração). Acesso: **Row Level Security** em todas as tabelas.

- Multi-tenant: `workspace_id` em toda tabela de cliente. `private.is_member(ws)` e `private.is_admin(ws)` (security definer) evitam recursão de RLS.
- Permissões por papel: `roles.rights` em JSON, por entidade e ação, com escopo `all | team | own | none` — igual à matriz do original. `private.in_scope()` aplica isso em leads, contatos, empresas e tarefas. Tabelas filhas (notas, eventos, tags, mensagens) herdam a visibilidade do pai por subconsulta.
- Dinheiro: `price_cents bigint` + `currency`. Horários: `timestamptz` (UTC); o fuso fica em `workspaces.timezone`.
- Garantias no banco, não na UI:
  - uma etapa de ganho e uma de perda por funil (índices únicos parciais);
  - a etapa precisa pertencer ao funil do lead (trigger);
  - `closed_at`, `stage_entered_at` e o histórico em `events` são gravados por trigger, não pelo app;
  - `closest_task_at` sempre igual à tarefa aberta mais próxima (trigger em `tasks`);
  - um único lead de entrada pendente por conversa;
  - aceitar um lead de entrada é atômico: só um vencedor numa corrida (`accept_incoming_lead`);
  - dedup de mensagens por `(channel_id, external_id)` e por `client_id` (duplo clique);
  - dedup de webhooks recebidos por `(provider, external_id)`;
  - idempotência de automação por `(automation_id, trigger_event_id)` e trava de loop `depth <= 5`.

Verificado no PGlite (Postgres 17 em WASM) com stubs de `auth`, `realtime` e `storage`: o schema aplica limpo; vendedor com escopo `own` só vê os próprios leads; ganho preenche `closed_at`; histórico registra criação e mudança de etapa; aceitar duas vezes falha com `already_resolved`; quem não é membro recebe `not_found`; o vendedor que aceita passa a ver a conversa e o contato; triggers de Realtime disparam.

Ainda falta: as RPCs `decline_incoming_lead`, `link_incoming_lead`, `move_leads_bulk` e `create_workspace` (mesmo padrão do `accept_incoming_lead`); papéis padrão (Admin, Gerente = team, Vendedor = own) semeados por `create_workspace`.

## API

Mutações do usuário são **Server Actions** (`app/**/actions.ts`), validadas com Zod e executadas com o cliente Supabase do usuário (RLS vale). Rotas `/api/*` apenas para webhooks, widget público e downloads. Service role só em webhooks e jobs.

### F01 Cadastro e primeiro funil
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| Supabase Auth `signUp` / OAuth Google | cria usuário; trigger cria `profiles` | anônimo | email, senha, nome | sessão | F01 |
| action `createWorkspace` | RPC `create_workspace`: workspace, papéis padrão, membership admin, funil modelo com etapas, tipos de tarefa, motivos de perda, assinatura trial de 14 dias | logado sem workspace | nome, slug, fuso, moeda, modelo de funil | workspace_id | F01 |
| GET `/[ws]/leads` (RSC) | carrega funil padrão | membro | — | página S04 | F01 |

### F02 Conectar WhatsApp
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| action `startWhatsAppSignup` | devolve config do Embedded Signup da Meta (app_id, config_id, state assinado) | admin | — | config | F02 |
| action `finishWhatsAppSignup` | troca o `code` pelo token de negócio, grava no Vault, registra o número, assina o webhook do WABA, cria `channels` | admin | code, waba_id, phone_number_id, state | channel | F02 |
| action `disconnectChannel` | revoga/assinatura off, status `disconnected` | admin | channel_id | ok | F02 |
| action `createWebchatChannel` | cria canal webchat com `public_key` e snippet de instalação | admin | nome, funil padrão | snippet | F02 |

### F03 / F13 Leads de entrada
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| POST `/api/webhooks/meta` | valida assinatura `X-Hub-Signature-256`, grava em `inbound_webhooks` (dedup), responde 200 em < 1s, envia evento Inngest | Meta | payload | 200 | F03 |
| GET `/api/webhooks/meta` | handshake `hub.challenge` | Meta | verify_token | challenge | F02 |
| job `meta.inbound.process` | acha/cria contato por identidade, conversa, mensagem; baixa mídia para o Storage; se a conversa não tem lead → cria `incoming_leads` pendente; senão atualiza `leads.last_activity_at`, `unread_count`, notifica | sistema | id do webhook | — | F03 |
| rpc `accept_incoming_lead` | cria lead na 1ª etapa, liga contato e conversa, quem aceita vira responsável | membro com `leads.add` | incoming_id, stage_id? | lead_id | F03 |
| rpc `decline_incoming_lead` | marca recusado, fecha conversa, opcionalmente bloqueia o número | membro | incoming_id, block? | ok | F03 |
| rpc `link_incoming_lead` | mescla contato desconhecido no existente (identidades, conversas), liga conversa ao lead escolhido | membro | incoming_id, lead_id \| contact_id | lead_id | F13 |

### F04 Responder cliente
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| action `sendMessage` | checa janela de 24h (`last_inbound_at`), insere mensagem `queued` com `client_id`, dispara job | membro que vê a conversa | conversation_id, client_id, texto \| file_id \| template_id + variáveis | message | F04 |
| job `message.outbound.send` | chama a API do canal, grava `external_id` e `status`; retenta erro transitório; marca `failed` com motivo | sistema | message_id | — | F04 |
| action `uploadAttachment` | URL assinada de upload no Storage + linha em `files` | membro | nome, mime, tamanho | file_id, url | F04 |
| action `markConversationRead` | zera `unread_count` | membro | conversation_id | ok | F04 |
| action `assignConversation` / `closeConversation` | atribui / fecha | membro | conversation_id, user_id | ok | F04 |
| POST `/api/webchat/[publicKey]/messages` | visitante do site envia mensagem (rate limit por IP + visitante) | anônimo | visitor_id, texto | ok | F03 |
| GET `/api/webchat/[publicKey]/stream` | respostas para o widget (SSE ou canal Realtime público por visitante com token curto) | anônimo com token | visitor token | eventos | F04 |
| webhook status Meta (mesmo endpoint) | atualiza `sent/delivered/read/failed` | Meta | statuses[] | — | F04 |

### F05 / F06 / F12 Funil e leads
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET `/[ws]/leads?pipeline=&view=kanban\|list&filter=` (RSC) | colunas com contagem, soma e primeiras 50 por etapa | membro | filtros | S04/S05 | F05 |
| action `loadStagePage` | paginação por coluna (cursor em `last_activity_at, id`) | membro | stage_id, cursor | leads | F05 |
| action `createLead` | cria lead (nome vazio → "Lead #n" na UI), contato opcional (sugere existente por telefone/email) | `leads.add` | pipeline, stage, nome, preço, contato | lead | F06 |
| action `updateLead` | edição inline (nome, preço, responsável, campos, etapa) | `leads.edit` no escopo | lead_id, patch | lead | F05 |
| action `moveLead` | muda etapa; se `lost`, exige motivo | `leads.edit` | lead_id, stage_id, loss_reason_id? | lead | F05 |
| action `bulkLeads` | ≤ 500 síncrono; acima disso, job Inngest com progresso | `leads.edit` / `delete` | ids \| filtro, operação | contagem / job_id | F12 |
| action `setLeadTags`, `linkContact`, `unlinkContact`, `subscribe` | — | `leads.edit` | — | — | F05 |
| action `deleteLead` / `restoreLead` | soft delete (`deleted_at`) | `leads.delete` | lead_id | ok | F12 |
| GET `/[ws]/leads/[id]` (RSC) | cartão do lead: dados + feed paginado (mensagens, notas, tarefas, eventos mesclados por data) | membro com escopo | — | S06 | F05 |
| action `addNote` / `pinNote` | — | membro | lead_id, texto | note | F05 |

### F07 Tarefas
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| action `createTask` | — | membro | entidade, tipo, prazo (no fuso do usuário → UTC), responsável, texto | task | F07 |
| action `completeTask` | grava resultado; evento `task_completed` no feed | responsável ou escopo | task_id, resultado | task | F07 |
| GET `/[ws]/calendar?view=list\|day\|week\|month` (RSC) | tarefas por intervalo | membro | intervalo, filtros | S16 | F07 |

### F08 / F09 Configurar funil e automações
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| action `savePipeline` | cria/renomeia/arquiva funil; etapas em lote (ordem, cor, nome) | admin | pipeline + stages[] | pipeline | F08 |
| action `deleteStage` | exige etapa destino para os leads existentes | admin | stage_id, move_to | ok | F08 |
| action `saveAutomation` / `toggleAutomation` / `deleteAutomation` | — | admin | stage_id, kind, run_on, delay, condições, params, aplicar a leads atuais? | automation | F09 |
| job `automation.on-event` | para cada evento `lead_created`/`stage_changed`, acha automações ativas da etapa, grava `automation_runs` (unique = idempotente), agenda `run_at` | sistema | event_id | — | F09 |
| job `automation.run` | reconfere condições no momento da execução (lead ainda na etapa?), executa ação, `depth + 1` se gerar novo evento | sistema | run_id | — | F09 |

### F10 Equipe
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| action `inviteUser` | checa assentos da assinatura, cria convite (hash do token), envia email via Resend | admin | email, papel, equipe | ok | F10 |
| GET `/invite/[token]` | aceita convite → cria membership; pede login/cadastro se preciso | convidado | token | redireciona | F10 |
| action `saveRole` / `setMemberRole` / `deactivateMember` | matriz de permissões | admin | — | — | F10 |

### F11 Painel
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| rpc `dashboard_stats` | conversas abertas / sem resposta, tempo médio e máximo de 1ª resposta, leads ganhos/ativos/perdidos/sem tarefa, mensagens por canal, fontes, tarefas — respeitando RLS | membro | período, user_id? | json | F11 |

### Busca, notificações, cobrança
| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| rpc `global_search` | trigram em leads, contatos (nome + identidades), empresas; top 5 de cada | membro | q | grupos | S28 |
| action `markNotificationsRead` | — | dono | ids | ok | S27 |
| action `createCheckout` / `openBillingPortal` | Stripe Checkout por assento / Customer Portal | admin | plano, assentos | url | S30 |
| POST `/api/webhooks/stripe` | assinatura verificada; dedup em `inbound_webhooks`; atualiza `subscriptions` | Stripe | evento | 200 | S30 |

Webhooks recebidos: Meta (mensagens, status, mudanças de template e de conta), Stripe (`checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`), Telegram (could).
Webhooks enviados: `webhook_endpoints` do cliente — eventos `lead.created`, `lead.stage_changed`, `message.received`; assinados com HMAC-SHA256, retentativa exponencial via Inngest por 24h.

Jobs:
| job | quando | faz |
| --- | --- | --- |
| `meta.inbound.process` | por webhook | processa mensagens recebidas (acima) |
| `message.outbound.send` | por mensagem | envia e retenta |
| `automation.on-event` / `automation.run` | por evento / no `run_at` | motor do funil digital |
| `tasks.due-reminders` | a cada 5 min | notificação + email de tarefa vencendo |
| `templates.sync` | a cada hora | status de aprovação de modelos WhatsApp |
| `channels.health` | a cada hora | testa token; marca `error` e avisa admin |
| `webhooks.cleanup` | diário | apaga `inbound_webhooks` processados > 30 dias |
| `trash.purge` | diário | exclui de vez leads/contatos com `deleted_at` > 30 dias |

## As partes que mordem

- **Fusos horários:** prazos de tarefa são digitados no fuso do usuário e gravados em UTC; a visão "Hoje/Semana" do painel e do calendário é calculada no fuso do workspace (`date_trunc` com `at time zone`). Brasil não tem horário de verão hoje, mas clientes em outros fusos e a possível volta do horário de verão exigem nunca somar 24h na mão.
- **Idempotência:** a Meta reenvia webhooks; dedup por `(provider, external_id)` e por `messages(channel_id, external_id)`. Envio do vendedor deduplicado por `client_id`. Automações: unique `(automation_id, trigger_event_id)`. Stripe: id do evento.
- **Corridas:** dois vendedores aceitando o mesmo lead de entrada → `update ... where status = 'pending' returning` (um vencedor). Dois movendo o mesmo card → última escrita vence, mas o Realtime atualiza o outro em < 1s e o feed mostra os dois eventos. Duas mensagens recebidas ao mesmo tempo do mesmo número novo → `unique (channel_id, external_thread_id)` em conversas e `on conflict do nothing` + releitura.
- **Janela de 24h do WhatsApp:** fora dela só modelos aprovados; a UI bloqueia o campo de texto e oferece modelos (`last_inbound_at`).
- **Limites de taxa:** Meta Cloud API tem limites por número e por nível de qualidade; a fila de saída (Inngest) limita por canal. Transmissão em massa respeita o tier de mensagens do número.
- **Aprovação da Meta:** para atender outros negócios o app precisa de verificação do Business, App Review das permissões `whatsapp_business_management`, `whatsapp_business_messaging`, `instagram_manage_messages`, `pages_messaging`, e de se tornar Tech Provider. Leva semanas — começar no dia 1. O widget de chat do site é o canal do vertical slice justamente por não depender disso.
- **Arquivos:** limite de 100 MB por arquivo (bucket e check); mídia da Meta tem URL temporária — baixar no job, nunca linkar direto.
- **Busca:** pg_trgm em nomes e identidades; telefone normalizado em E.164 (libphonenumber-js) antes de gravar e de buscar.
- **Tempo real:** broadcast privado por workspace; o cliente invalida a consulta (TanStack Query) em vez de confiar no payload — assim o RLS sempre decide o que aparece. Contadores de não lidas vêm do banco.
- **Multi-tenancy:** todo acesso passa pelo RLS; service role só em webhooks/jobs, e esses sempre filtram por `workspace_id` resolvido a partir do canal. Teste automatizado: usuário de outro workspace nunca vê nada.
- **Campos personalizados:** valores em `custom jsonb` com índice GIN; filtro por campo usa `custom @> '{"<field_id>": ...}'`. Validação de tipo no app (Zod gerado a partir de `custom_fields`).
- **LGPD:** exportar e excluir dados de um contato a pedido (apaga identidades, mensagens, arquivos no Storage); exclusão do workspace apaga tudo em cascata + bucket. Registro de consentimento para transmissões (opt-in) antes de liberar F14.
- **Entregabilidade de email:** Resend com domínio próprio, SPF/DKIM/DMARC configurados no deploy.

## Ordem de construção

1. **Vertical slice (1–2 semanas)** — cadastro → workspace → funil → um visitante manda mensagem pelo widget do site → aparece como lead de entrada → aceitar → responder do cartão do lead → arrastar até Ganho.
   - Telas: S01, S02 (mínimo), S03, S04, S06, S08, S10.
   - Tabelas: workspaces, profiles, roles, memberships, pipelines, stages, loss_reasons, contacts, contact_identities, leads, lead_contacts, events, channels, conversations, messages, incoming_leads.
   - Rotas: `createWorkspace`, `/[ws]/leads`, `/[ws]/leads/[id]`, `moveLead`, `createWebchatChannel`, `/api/webchat/*`, `accept_incoming_lead`, `sendMessage`, Realtime.
2. **Must-haves (4–6 semanas), por área:**
   - Funil: S05, S07, S19, filtros, múltiplos funis, motivo de perda, tags, `updateLead` inline.
   - Inbox: S09, anexos (Storage), status de mensagem, `decline`/`link` de entrada, notificações (S27).
   - Canais: WhatsApp Cloud API (F02, `/api/webhooks/meta`, jobs de entrada/saída). **Pedir a revisão da Meta já na semana 1.**
   - Listas: S12–S15. Tarefas: S16, F07. Equipe: S24, convites, papéis. Busca: S28.
3. **Should-haves:** Instagram e Messenger, modelos (S22) e regra da janela de 24h, menções e notas internas, campos personalizados (S26), ações em massa, painel (S17), automações por etapa (S20, Inngest), distribuição de leads, importação CSV, email inbox, Stripe (S30) e trial.
4. **Could-haves:** Salesbot visual (S21), transmissão (S23), relatórios (S18), chat de equipe (S11), Telegram, formulários, scoring, log de atividade, agendamento, IA com chave própria.
5. **Correções do replica-entrepreneur:** entram aqui depois que ele rodar.
