# Recon 2: a operação do Kommo, em detalhe (16/10/2026)

Complementa `recon.md` (S01–S30, F01–F15). Foco: tudo que o operador usa no dia a dia.
Só fontes públicas: central de ajuda (support.kommo.com), página de preços, marketplace público e avaliações.
Nada de login em conta de terceiros, código do app ou API privada.

## Fontes desta rodada

| fonte | URL |
| --- | --- |
| Índice da central de ajuda | https://support.kommo.com/llms.txt |
| Gatilhos do funil digital | https://support.kommo.com/docs/set-up-digital-pipeline-triggers |
| Salesbot: passos e ações | https://support.kommo.com/docs/salesbot-overview |
| Salesbot: gatilhos | https://support.kommo.com/docs/salesbot-triggers-overview |
| Interrupções de Salesbot | https://support.kommo.com/docs/manage-salesbot-interruptions |
| Caixa de entrada | https://support.kommo.com/docs/manage-chat-inbox-in-kommo |
| Transmissão | https://support.kommo.com/docs/set-up-and-customize-broadcasts-in-kommo |
| Integrações (categorias) | https://support.kommo.com/docs/integrations |
| Avaliações G2/Capterra | https://www.capterra.com/p/120048/Kommo/reviews/ · https://www.g2.com/compare/kommo-vs-onepagecrm |
| Avaliações App Store + Reclame Aqui | `replica/reviews.csv` (119, todas com link) |

## O que o Kommo tem na operação, e onde o Recadi está

Legenda: ✅ já tem · 🟡 parcial · ❌ falta

### Funil digital (gatilhos por etapa) — 12 tipos no Kommo

| gatilho | Recadi |
| --- | --- |
| Salesbot | ✅ (robôs) |
| Adicionar tarefa | ✅ passo "Criar tarefa" |
| Mudar etapa | ✅ passo "Mover de etapa" |
| Adicionar/remover tags | 🟡 só adicionar |
| Trocar responsável | ✅ |
| Enviar email | ❌ (sem canal de email) |
| Enviar webhook | ❌ |
| Criar lead | ❌ |
| Concluir tarefas | ❌ |
| Alterar campo | ❌ (campos personalizados existem; falta o passo) |
| Gerar formulário | ❌ |
| Apagar arquivos | ❌ (sem anexos) |
| "Aplicar aos leads que já estão na etapa" | ❌ |
| Condições (responsável, tag, campo) | 🟡 só canal e palavra-chave |

### Salesbot — passos (13) e ações (14)

| passo | Recadi |
| --- | --- |
| Mensagem (texto, modelo, **botões de resposta rápida**, botão com link, anexo) | 🟡 só texto |
| Lista (WhatsApp, até 10 opções) | ❌ |
| **Condição** (ramifica por conteúdo da mensagem ou campo) | ❌ — robô é uma linha reta |
| **Pausa** (até o cliente responder, tempo, horário comercial) | 🟡 só tempo |
| **Validação** (igual, contém, tamanho, regex, telefone, email; repete pergunta) | ❌ |
| Mensagem interna para a equipe | ❌ |
| Ir para outro passo / iniciar outro robô | ❌ |
| Rodízio (Round Robin, A/B, até 100 opções) | ❌ |
| Código próprio / widget | fora (risco e custo) |
| Ações: nota, tarefa, etapa, responsável, tag | ✅ |
| Ações: status da conversa (fechar/respondida) | ❌ |
| Ações: concluir tarefa, criar lead, definir campo, webhook, email | ❌ |

### Gatilhos do robô — 4 famílias

| gatilho | Recadi |
| --- | --- |
| Criado/movido para etapa (na hora ou com atraso) | ✅ (atraso via passo Esperar) |
| Responsável mudou | ❌ |
| Agendado: X horas antes/depois de um campo de data; data fixa; recorrente | ❌ |
| Comportamento: formulário enviado, email/ligação recebida, site visitado | ❌ |
| Conversa iniciada; mensagem recebida (com intervalo mínimo) | ✅ |
| Conversa fechada; X horas sem resposta do cliente | ❌ |
| Interrupção: 2 robôs no mesmo lead se atropelam | 🟡 "uma vez por lead" evita repetição |

### Caixa de entrada

| recurso | Recadi |
| --- | --- |
| Lista unificada, filtros prontos, busca | ✅ |
| Reações, áudio, emoji, anexos por arrastar | ❌ |
| Atalhos de modelo com "/" no compositor | ❌ (modelos existem, falta o "/") |
| Marcar colega (@) dentro da conversa → vai ao chat da equipe | ❌ |
| Fechar conversa, atribuir, numeração | 🟡 atribuição automática, sem fechar/atribuir à mão |
| Nota e tarefa sem sair da conversa | ✅ |
| IA: reescrever, sugerir resposta, resumo da conversa | ❌ |

### Transmissão

| recurso | Recadi |
| --- | --- |
| Escolher público por etapa/tag/canal, prévia | ✅ |
| Agendar para depois | ❌ |
| Importar lista de planilha | ❌ |
| Transmissão por robô (várias mensagens) | ❌ |
| Estatística (enviadas, entregues, lidas, respostas) | 🟡 só enviadas/fora |
| Segmentos salvos | ❌ |

### Relatórios

| recurso | Recadi |
| --- | --- |
| Painel com widgets, período, por pessoa | ✅ |
| Ganhos e perdas, por responsável, motivos | ✅ |
| Metas da equipe | ❌ |
| Tempo de resposta (médio/máximo) | ❌ |
| Desempenho do robô (quantos rodaram, convertidos) | 🟡 só contagem |
| Pontuação de leads (lead scoring) | ❌ |
| Log de atividade da conta | ❌ |

### Calendário e agenda

| recurso | Recadi |
| --- | --- |
| Tarefas por dia/semana/mês | ✅ |
| **Agendamento online** (link de reserva, tipos e horários disponíveis) | ❌ |

### Listas e configurações

| recurso | Recadi |
| --- | --- |
| Contatos e empresas | ✅ |
| Importar CSV / exportar | ❌ |
| Mesclar duplicados / controle de duplicidade | ❌ |
| Edição em massa de leads | ❌ |
| Layout do cartão do lead configurável | 🟡 campos personalizados |
| Usuários e papéis | ✅ |

### Integrações (marketplace)

| categoria Kommo | exemplos públicos | Recadi |
| --- | --- | --- |
| Comunicação | WhatsApp, Instagram, Messenger, Telegram, email | 🟡 só chat do site; Meta pronto no backend |
| Automação | Zapier, Make, webhooks | ❌ |
| E-commerce | Shopify, WooCommerce, Bling, Nuvemshop, Mercado Livre | ❌ |
| Agenda | Google Calendar | ❌ |
| Marketing / geração de leads | formulários, Meta Lead Ads | ❌ |

## O que os clientes do Kommo reclamam que falta ou falha (= nossas vantagens)

Fonte: 119 avaliações reais em `reviews.csv` (App Store BR/MX/ES/US/PT + Reclame Aqui) e as páginas de G2/Capterra acima.

1. **Sistema instável e mensagens que somem ou caem no lead errado.** O Recadi já registra cada mensagem por conversa com deduplicação. Vantagem a construir: o rastro de entrega visível ("recebida → gravada → entregue → lida") e a página de status.
2. **Suporte lento e genérico.** Ajuda dentro do app: checklist de primeiros passos e ajuda contextual em cada tela.
3. **Automação que não funciona ou é difícil de montar** (o "/" não funciona; robôs que não dá para pôr em uso). O editor do Recadi já tem modelos prontos e prévia. Falta ramificar (condição, botões, validação) **sem perder a simplicidade**.
4. **Envio em massa exige contratar outra empresa.** O Recadi tem Disparos nativo. Falta agendamento, estatística e modelos aprovados do WhatsApp.
5. **Distribuição de atendimentos entre vendedores que não funciona.** Rodízio de leads de verdade (round robin por vendedor) nativo e simples.
6. **Personalização e relatórios limitados** (G2/Capterra). Relatórios com filtros e exportação.
7. **Filtros limitados e navegação confusa entre lead, contato e empresa** (Capterra). Filtros salvos, trilha de navegação e voltar (já feitos).
8. **Cobrança antecipada e reembolso travado.** Mensal sem fidelidade, cancela em 1 clique, reembolso proporcional no anual. Já é a política do Recadi.
9. **Teste só por dias.** Pedido real: teste por uso. Fica como ideia; hoje são 14 dias com trava anti-abuso.
10. **Teto de contatos e arquivos por plano** (guia de preços de terceiros). Comunicar limites claros na página de preços.

## Ordem de construção proposta (do que mais vende para o que menos)

1. **Robôs com ramificação**: botões de resposta rápida, condição (se/senão), validação, pausa até responder, mensagem interna e "ir para passo". Torna o editor um fluxo de verdade, como o Salesbot.
2. **Rodízio de leads entre vendedores** (passo do robô + configuração por funil).
3. **Gatilhos novos**: X horas sem resposta, conversa fechada, responsável mudou, data de campo (aniversário, vencimento), agendado/recorrente; condições por responsável, tag e campo; aplicar aos leads que já estão na etapa.
4. **Caixa de entrada**: "/" para modelos, fechar/atribuir conversa, @menção à equipe, reações.
5. **Disparos**: agendar, estatística de entrega/leitura, segmentos salvos, importar planilha.
6. **Ações em massa, importação/exportação CSV e mesclar duplicados.**
7. **Webhooks de saída e entrada** (é a base para Zapier/Make sem depender de marketplace).
8. **Agendamento online** (link de reserva).
9. **Relatórios**: tempo de resposta, metas, desempenho de robôs, log de atividade.
10. **Rastro de entrega de cada mensagem e página de status** (a maior reclamação contra o Kommo).

Fora (sem custo-benefício agora): passo de código próprio, widgets de terceiros, telefonia VoIP, ROI de anúncios, agente de IA (fica para depois, com chave e custo de IA definidos).
