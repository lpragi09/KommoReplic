# Recon map: Kommo (web)

Escopo: funil de vendas Kanban + caixa de entrada unificada (WhatsApp, Instagram, Messenger, chat do site) ligada ao cartão do lead, contatos, empresas, tarefas e painel. Automação por etapa e Salesbot como "should". IA e agendamento online como "could".
Para: produto SaaS — CRM de WhatsApp para PMEs brasileiras (proposta padrão; usuário não contestou).
Fontes: somente públicas. Nenhuma conta foi usada.
Data: 2026-10-11

## Fontes

| # | fonte | URL | notas |
| --- | --- | --- | --- |
| 1 | site de marketing | https://www.kommo.com/br/ | posicionamento, módulos: Funil, Caixa de entrada, Salesbot, IA, Agendamentos, Transmissão |
| 2 | preços / planos | https://support.kommo.com/docs/pt-br/kommo-subscription-plans-overview | 4 planos por usuário (Básico, Avançado, Pro, Empresarial); o que é gated |
| 3 | página de preços | https://www.kommo.com/br/precos/ | retornou HTTP 500 na coleta; valores via fonte 1 (US$ 20/30/45 por usuário/mês) |
| 4 | ajuda: leads, contatos, empresas | https://support.kommo.com/docs/pt-br/manage-leads-in-kommo | layout do funil e do cartão do lead |
| 5 | ajuda: leads de entrada | https://support.kommo.com/docs/pt-br/handle-incoming-leads | etapa cinza, aceitar / excluir / vincular |
| 6 | ajuda: gatilhos do funil digital | https://support.kommo.com/docs/pt-br/set-up-digital-pipeline-triggers | 12 tipos de gatilho por etapa |
| 7 | ajuda: chats | https://support.kommo.com/docs/pt-br/manage-chats-in-kommo | inbox, atalhos "/", "@", "[", chat de equipe |
| 8 | ajuda: painel | https://support.kommo.com/docs/pt-br/manage-your-dashboard | widgets, períodos, filtros por usuário |
| 9 | ajuda: menu esquerdo | https://support.kommo.com/docs/new-left-menu | hubs da navegação |
| 10 | API pública (índice) | https://developers.kommo.com/llms.txt | lista completa de entidades |
| 11 | API: leads | https://developers.kommo.com/reference/leads-list.md | campos do lead, filtros, ordenação |
| 12 | API: conversas | https://developers.kommo.com/reference/get-talks.md | campos e status da conversa |
| 13 | API: tarefas | https://developers.kommo.com/reference/tasks-list.md | campos da tarefa |
| 14 | API: tipos de nota | https://developers.kommo.com/reference/notes-types.md | tipos de item do feed |
| 15 | conceitos | https://support.kommo.com/docs/pt-br/kommo-basics | modelo mental: lead / contato / empresa |

Pendente (ganharia precisão): vídeos públicos de walkthrough no YouTube e screenshots da App Store / Google Play para medir layout em `replica/screens/`. Ainda não há screenshots salvos.

## Core loop

Uma mensagem de cliente chega por qualquer canal, vira um lead no funil, e a equipe conversa, cria tarefas e arrasta o lead pelas etapas até ganho ou perdido — tudo sem sair do cartão do lead.

## Telas

| ID | tela | rota / como chegar | propósito | componentes-chave | estados |
| --- | --- | --- | --- | --- | --- |
| S01 | Login / cadastro | /login, /signup | entrar, criar conta | form, botão Google | vazio, erro, carregando |
| S02 | Onboarding | após cadastro | nomear workspace, escolher modelo de funil, conectar 1º canal | stepper, cards de canal | cada passo, pular |
| S03 | Shell do app | todas as rotas | menu esquerdo por hubs (Início, Comunicação, Funis, Calendário, Listas, Automações, Insights, Configurações), notificações, perfil | sidebar recolhível, itens fixados, badge | expandido, recolhido, mobile |
| S04 | Funil (Kanban) | Funis → nome do funil | ver e mover leads por etapa | colunas com cor, contagem e soma de valor; card de lead; "Adicionar rápido"; filtro; busca; seletor de funil | vazio, cheio, arrastando, filtrado, sem resultados, carregando |
| S05 | Leads em lista | toggle Kanban/Lista em S04, "Todos os leads" | tabela, seleção e ações em massa | tabela, checkbox, barra de ações em massa, paginação | vazio, cheio, selecionados |
| S06 | Cartão do lead | clicar num card em S04/S05/S09 | tudo sobre um negócio | painel esquerdo (nome, valor, etapa, responsável, tags, contatos, empresa, campos em abas); feed à direita (mensagens, notas, tarefas, mudanças de etapa); compositor inferior (Chat / Nota / Tarefa / Email); assinantes; filtro do feed | novo, existente, ganho, perdido (com motivo), somente leitura |
| S07 | Novo lead / adicionar rápido | botão "+ Novo lead" ou topo da coluna | criar lead | form inline no topo da coluna; S06 em modo novo | vazio, validação |
| S08 | Leads de entrada | etapa cinza à esquerda em S04 | triagem de desconhecidos | card com prévia, filtro por tipo (chamada, email, form, mensagem) com contador; ações aceitar / excluir / vincular | vazio, com itens, vinculando (busca) |
| S09 | Caixa de entrada (chats) | Comunicação → Caixa de entrada | responder todos os canais num só lugar | lista de conversas (ícone do canal, prévia, não lidas, tempo), filtros, painel da conversa, cartão do lead lateral | vazio, não lidas, sem resposta, conversa fechada, erro de envio |
| S10 | Compositor de mensagens | rodapé de S06/S09 | enviar texto, anexo, áudio, modelo, nota interna | textarea, "/" para modelos e bots, "@" menção, "[" campo dinâmico, emoji, anexo, troca Chat/Nota/Tarefa | vazio, enviando, falhou, fora da janela de 24h (exige modelo WhatsApp) |
| S11 | Chat de equipe | Comunicação → Chat da equipe | conversa interna e menções | lista de chats, grupos, menções | vazio, cheio |
| S12 | Contatos (lista) | Listas → Contatos | gerenciar contatos | tabela, busca, filtro, importar/exportar | vazio, cheio |
| S13 | Cartão do contato | clicar em contato | dados + leads vinculados + feed | mesmo layout de S06 | novo, existente |
| S14 | Empresas (lista) | Listas → Empresas | gerenciar empresas | tabela | vazio, cheio |
| S15 | Cartão da empresa | clicar em empresa | dados + contatos + leads | mesmo layout de S06 | novo, existente |
| S16 | Calendário / tarefas | Calendário | tarefas por dia/semana/mês e lista | visão lista, dia, semana, mês; filtro por tipo e responsável; atrasadas em destaque | vazio, atrasadas, concluídas |
| S17 | Painel | Insights → Painel | visão geral | widgets: conversas em andamento, sem resposta, tempo médio e máximo de resposta, leads ganhos/ativos/perdidos/sem tarefa, mensagens por canal, fontes, tarefas; período; usuário; arrastar widgets | vazio, carregando, filtrado |
| S18 | Estatísticas / relatórios | Insights → Relatórios | análise do funil, ganhos/perdas, atividade por usuário | gráficos, tabelas, período | vazio, cheio |
| S19 | Configurar funil | menu de opções do funil | criar/renomear/reordenar etapas, cor, ganho/perdido fixos, motivos de perda | lista arrastável, seletor de cor | editando, erro |
| S20 | Automatize (funil digital) | Funil → Automatize | gatilhos por etapa | colunas = etapas, "+" abaixo de cada etapa, cards de gatilho, modal de config (condições, quando executar, ação) | vazio, com gatilhos, desativado |
| S21 | Editor de Salesbot | Automações → Bots | fluxo visual de bot | canvas de blocos (mensagem, pergunta, condição, ação, espera), conexões | vazio, editando, publicado |
| S22 | Modelos | Automações → Modelos | respostas prontas de chat e email; modelos WhatsApp aprovados | lista, editor, status de aprovação | vazio, pendente, aprovado, rejeitado |
| S23 | Transmissão | Automações → Transmissão | envio em massa segmentado | seleção de público, modelo, agendamento, relatório | rascunho, agendado, enviado |
| S24 | Usuários e permissões | Configurações → Usuários | convidar, papéis, permissões por entidade | tabela, matriz de permissões | convite pendente |
| S25 | Canais / integrações | Configurações → Chats / Integrações | conectar WhatsApp, Instagram, Messenger, chat do site, email | cards de canal, status de conexão | desconectado, conectando, conectado, erro |
| S26 | Campos personalizados | aba de configuração no cartão / Configurações | campos por entidade e grupos de campos | lista de campos, tipos | vazio, cheio |
| S27 | Notificações | sino no shell | central de notificações | lista, marcar como lida | vazio, não lidas |
| S28 | Busca global | barra de busca | achar lead, contato, empresa | input, resultados agrupados | vazio, sem resultado |
| S29 | Configurações gerais | Configurações → Workspace | nome, fuso, moeda, idioma | form | salvo, erro |
| S30 | Assinatura / cobrança | Configurações → Cobrança | plano, usuários, pagamento | cards de plano, histórico | trial, ativo, vencido |

Total: 30 telas (excluindo app mobile, IA e marketplace).

## Fluxos

```
F01 Dono cria conta e chega ao primeiro funil
    S01 -> S02 -> S04
    cliques no caminho feliz: 6
    edge: email já usado, abandona onboarding no meio, pula conexão de canal

F02 Admin conecta o WhatsApp
    S03 -> S25 -> (fluxo da Meta / embedded signup) -> S25 conectado
    cliques no caminho feliz: 5 + fluxo da Meta
    edge: número já ligado a outro app, token expirado, conta Business não verificada

F03 Mensagem de desconhecido vira lead
    (mensagem chega) -> S08 card de entrada -> aceitar -> S04 primeira etapa -> S06
    cliques no caminho feliz: 1 (aceitar)
    edge: mesmo número já é contato (deve vincular, não duplicar), spam (excluir), duas pessoas aceitando ao mesmo tempo

F04 Vendedor responde cliente
    S09 -> conversa -> S10 digita / escolhe modelo -> enviar
    cliques no caminho feliz: 3
    edge: fora da janela de 24h do WhatsApp (só modelo aprovado), falha de envio com reenviar, mídia grande, conversa atribuída a outro

F05 Lead avança até ganho ou perdido
    S04 arrastar card entre colunas ... -> soltar em "Ganho" ou "Perdido" -> motivo de perda
    cliques no caminho feliz: 1 arrasto por etapa
    edge: dois usuários movendo o mesmo lead, gatilho dispara na etapa nova, sem permissão de editar

F06 Criar lead manualmente
    S04 -> "Adicionar rápido" -> nome, valor, contato -> enter
    cliques no caminho feliz: 2
    edge: nome vazio (gera "Lead #123"), contato já existe (sugerir)

F07 Tarefa a partir do lead
    S06 -> compositor "Tarefa" -> tipo, prazo, responsável -> salvar -> S16 -> concluir com resultado
    cliques no caminho feliz: 5
    edge: prazo passado, fuso diferente do usuário, tarefa de outro responsável

F08 Configurar etapas do funil
    S04 -> opções -> S19 -> adicionar / renomear / arrastar / cor -> salvar
    edge: excluir etapa com leads (para onde vão?), máximo de etapas

F09 Gatilho automático por etapa
    S04 -> Automatize -> S20 -> "+" na etapa -> tipo -> condições -> salvar
    edge: loop de gatilhos (A move para B, B move para A), gatilho aplicado a leads antigos

F10 Convidar usuário com permissões
    S24 -> convidar -> email + papel -> enviar -> convidado aceita (S01)
    edge: limite de usuários do plano, convite expirado

F11 Gestor olha o painel
    S17 -> período "Semana" -> usuário X -> clicar número -> S05 filtrado
    cliques no caminho feliz: 3

F12 Filtrar e agir em massa
    S05 -> filtro (etapa, responsável, tag, data) -> selecionar todos -> mudar responsável / etapa / tag / excluir
    edge: milhares de leads selecionados (job em background)

F13 Vincular lead de entrada a contato existente
    S08 -> ícone de vínculo -> busca -> escolher lead/contato -> mesclado
    edge: alvo em outro funil (permitido)

F14 Enviar transmissão
    S23 -> público (segmento / filtro) -> modelo -> agendar -> relatório
    edge: contatos sem opt-in, limite de envio da Meta

F15 Criar um Salesbot simples
    S21 -> novo -> blocos -> publicar -> S20 ligar à etapa
    edge: resposta inesperada, bot e humano respondendo juntos
```

Número a bater: aceitar um lead de entrada e responder em ≤ 3 cliques (F03 + F04).

## Componentes

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Botão | primário, secundário, ghost, perigo, ícone | default, hover, foco, desabilitado, carregando | todas |
| Input / textarea | texto, número, moeda, telefone, email, data, busca | default, foco, erro, desabilitado | S01, S06, S07, S19-S29 |
| Select / combobox | simples, multi, com busca, usuário (avatar) | aberto, vazio, carregando | S06, S16, S20, S24 |
| Sidebar de navegação | expandida, recolhida, mobile (drawer) | item ativo, badge, fixado | S03 |
| Topbar da seção | com seletor de funil, busca, filtro, toggle de visão, ação primária | — | S04, S05, S09, S12, S16 |
| Coluna do Kanban | normal, entrada (cinza), ganho, perdido | vazia, arrastando sobre, carregando mais | S04, S08 |
| Card de lead | padrão, com tarefa atrasada, sem tarefa, com mensagem não lida | arrastando, selecionado | S04, S08 |
| Card de lead de entrada | mensagem, chamada, email, formulário | hover com ações | S08 |
| Tabela | ordenável, com seleção | vazia, carregando, selecionada | S05, S12, S14, S24 |
| Barra de ações em massa | — | visível com seleção | S05, S12, S14 |
| Painel de entidade (esquerdo) | lead, contato, empresa | editando inline, salvo | S06, S13, S15 |
| Feed / timeline | itens: mensagem in/out, nota, tarefa, chamada, mudança de etapa, sistema, arquivo | carregando mais, filtrado | S06, S09, S13, S15 |
| Compositor | Chat, Nota, Tarefa, Email | vazio, enviando, erro, bloqueado (janela 24h) | S06, S09, S10 |
| Lista de conversas | item com canal, prévia, não lidas | ativo, não lido, sem resposta | S09, S11 |
| Bolha de mensagem | entrada, saída, nota interna, sistema; texto, imagem, áudio, arquivo | enviando, enviada, entregue, lida, falhou | S06, S09, S11 |
| Tag / chip | cor | removível | S04, S06 |
| Avatar | usuário, contato, ícone de canal | online | várias |
| Badge / contador | número, ponto | — | S03, S08, S09 |
| Modal / dialog | confirmação, formulário, motivo de perda | aberto, carregando | S05, S06, S19, S20 |
| Drawer lateral | cartão do lead na inbox | aberto/fechado | S09 |
| Popover / menu de opções | — | — | várias |
| Toast | sucesso, erro, info | — | todas |
| Abas | — | ativa | S06, S13, S15 |
| Filtro avançado | painel com campos e filtros salvos | — | S04, S05, S09, S12 |
| Date picker / período | dia, intervalo, presets (hoje, ontem, semana, mês) | — | S07, S16, S17 |
| Widget de painel | número, lista, barras | carregando, vazio | S17 |
| Gráfico | barras, funil, linha | — | S17, S18 |
| Calendário | dia, semana, mês | — | S16 |
| Seletor de cor | paleta fixa | — | S19 |
| Estado vazio | por tela | — | todas |
| Skeleton | linha, card, tabela | — | todas |

## Modelo de dados inferido

```
Account (workspace)  id, name, subdomain, timezone, currency, locale, plan, trial_ends_at
                     evidence: fonte 10 (account), S29, S30     confidence: high

User                 id, name, email, avatar, phone, is_active, role_id, group_id(equipe)
                     evidence: fonte 10 (users, roles), S24     confidence: high

Role                 id, account_id, name, rights (json: por entidade view/edit/add/delete/export: all|group|own|none)
                     evidence: fonte 10 (roles), S24             confidence: medium (formato de rights é guess)

Pipeline             id, account_id, name, sort, is_main, is_archived
                     evidence: fonte 10, menu (arquivar)        confidence: high

Stage (status)       id, pipeline_id, name, sort, color, type (incoming | normal | won | lost)
                     evidence: fonte 10 (stages, stage colors), S04, S08   confidence: high

Lead                 id, account_id, name, price, pipeline_id, stage_id, responsible_user_id,
                     loss_reason_id, source_id, score, closed_at, closest_task_at,
                     custom_fields (json), created_by, updated_by, is_deleted
                     evidence: fonte 11                           confidence: high

Contact              id, account_id, name, first_name, last_name, responsible_user_id, phones[], emails[], custom_fields
                     evidence: fonte 10, S12, S13                 confidence: high
Company              id, account_id, name, responsible_user_id, custom_fields
                     evidence: fonte 10                           confidence: high
lead_contacts        lead_id, contact_id, is_main                 confidence: high (fonte 10, "links")
Contact -> Company   n-1                                          confidence: high

LossReason           id, account_id, name                         confidence: high
Tag                  id, account_id, name, color, entity_type     confidence: high
CustomField          id, account_id, entity_type, name, type (text, number, select, multiselect, date, url, checkbox, phone, email...), enums, group_id, sort, is_required
                     evidence: fonte 10                           confidence: high
FieldGroup           id, entity_type, name, sort                  confidence: high

Task                 id, account_id, entity_type, entity_id, responsible_user_id, task_type_id,
                     text, complete_till, duration, is_completed, result_text
                     evidence: fonte 13                           confidence: high
TaskType             id, name, color, icon (ligação, reunião, follow-up + custom)   confidence: medium

Note (item do feed)  id, entity_type, entity_id, note_type (common, call_in, call_out, service_message, attachment...), params (json), is_pinned, created_by
                     evidence: fonte 14                           confidence: high

Event (histórico)    id, entity_type, entity_id, type (stage_changed, responsible_changed, field_changed, ...), value_before, value_after, created_by, created_at
                     evidence: fonte 10 (events), feed S06        confidence: high

Source / Channel     id, account_id, type (whatsapp, instagram, messenger, telegram, site_chat, email, form), external_id, name, pipeline_id(destino), status, credentials(secret)
                     evidence: fonte 10 (sources), S25            confidence: medium

Conversation (talk)  id, account_id, channel_id, contact_id, lead_id, status (in_work | closed), is_read, last_message_at, assigned_user_id
                     evidence: fonte 12                           confidence: high
Message              id, conversation_id, direction (in | out), sender_user_id, kind (text, image, audio, video, file, template, location), body, media_url, external_id, status (sending, sent, delivered, read, failed), created_at
                     evidence: S09, S10                           confidence: medium (API pública não documenta campos)

IncomingLead (unsorted)  id, account_id, pipeline_id, kind (chat, call, email, form), contact_data(json), lead_data(json), source_id, status (pending | accepted | declined | linked)
                     evidence: fonte 5, fonte 10                  confidence: high

Trigger (automação)  id, pipeline_id, stage_id, kind (salesbot, add_task, send_email, webhook, change_stage, tags, complete_tasks, change_user, change_field...), conditions(json), run_on (enter | create | enter_or_create), delay_seconds, params(json), is_active
                     evidence: fonte 6                            confidence: medium (run_on e delay são guess)

Salesbot             id, account_id, name, graph(json), is_active   confidence: medium
Template             id, account_id, kind (chat | email | whatsapp), name, body, buttons, wa_status   confidence: high
Broadcast            id, account_id, template_id, audience_filter(json), scheduled_at, status, stats   confidence: medium
Webhook              id, account_id, url, events[]                confidence: high
Subscription (lead)  lead_id, user_id  (assinantes do cartão)     confidence: high
Notification         id, user_id, kind, entity, is_read           confidence: medium
File                 id, entity_type, entity_id, name, size, mime, storage_path   confidence: medium
```

Relações: Account 1-n User, Pipeline, Contact, Company, Lead, Channel. Pipeline 1-n Stage 1-n Lead. Lead n-n Contact (um principal). Contact n-1 Company. Lead 1-n Task, Note, Event, Conversation. Conversation 1-n Message. Channel 1-n Conversation. Stage 1-n Trigger.

## Matriz de funcionalidades

Veja `features.csv`. Must: 36, should: 20, could: 13, skip: 7.

## Fora do escopo (não pode ou não deve ser clonado)

- Marca, logotipo, ícones, ilustrações, textos e a cor de assinatura do Kommo.
- O marketplace de integrações e os parceiros (rede deles, não produto).
- Acordos de parceria com a Meta (BSP). O clone usa a WhatsApp Business Cloud API oficial com a conta do próprio cliente; não herda status de parceiro.
- Créditos de IA e os modelos do Kommo IA (podemos construir IA própria depois, com nossas chaves).
- Telefonia/VoIP própria e integrações de anúncios (Meta CAPI, TikTok, Google Ads) — exigem acordos/aprovação separados.
- Integração Bling, SSO corporativo, SLA e gerente de conta dedicado (serviço, não software).
- Dados e clientes do Kommo.

## Tamanho

Telas 30, fluxos 15, entidades ~26.
Partes difíceis:
1. **WhatsApp Business Cloud API + Instagram/Messenger (Meta Graph API)**: embedded signup, verificação de app pela Meta, webhooks, janela de 24h, modelos aprovados, mídia.
2. **Tempo real**: inbox e Kanban atualizando para vários usuários (Supabase Realtime), contadores de não lidas.
3. **Permissões multi-tenant**: RLS por workspace + direitos por papel (todos / equipe / só os meus).
4. Motor de automação por etapa (gatilhos com atraso, idempotência, evitar loops) e o editor visual de Salesbot.
5. Campos personalizados com filtro e busca performáticos.

Tamanho: **L (um trimestre)** para must + should. Só os must ≈ M+ (6–8 semanas). Com Salesbot visual, IA e transmissão em escala: XL — fasear.
