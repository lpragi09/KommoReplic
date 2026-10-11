# Preço

## O mercado (lido em 2026-10-11)

| produto | planos (por usuário/mês) | contrato | teste | fonte |
| --- | --- | --- | --- | --- |
| Kommo | Básico R$ 100 · Avançado R$ 150 · Pro R$ 225 · Empresarial sob consulta | **só 6, 9, 12 ou 24 meses** (com opção de parcelar); não há mensal | 14 dias, sem cartão | https://www.kommo.com/br/precos/compare-planos/ |
| RD Station CRM | Free (até 4 usuários) · Basic R$ 73 · Pro R$ 131 (mín. 4 usuários) · Advanced sob consulta | mensal ou anual (anual −10%) | plano grátis | https://www.rdstation.com/planos/crm/ (lido por resumo automático; conferir) |
| Pipedrive | Lite US$ 14 · Growth US$ 24 · Premium US$ 49 · Ultimate US$ 69 | mensal ou anual (−26% no anual) | 14 dias, sem cartão | https://www.pipedrive.com/pt/pricing (lido por resumo automático; conferir — os valores mensal × anual do resumo parecem misturados) |

Os preços mudam. Reler as páginas no dia do lançamento.

## O que os usuários dizem sobre preço e cobrança (`feedback.md`)

- **Preço alto:** 7 avaliações, 3 fontes, média 2,6★. Exemplo: "Não vale o preço e mesmo que não funcione eles não estornam o valor pago" ([App Store BR](https://apps.apple.com/br/app/kommo/id6443626329?see-all=reviews#review-13690489804)).
- **Cobrança, cancelamento e reembolso:** 4 avaliações, 3 fontes, média 1,5★. Inclui "Fui cobrado antecipadamente por 6 meses de serviço" e falha no próprio fluxo de cancelamento ([Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/reclamacao-sobre-kommo-crm-suporte-ineficiente-problemas-de-integracao-com-whatsapp-cobranca-indevida-e-falha-no-cancelamento_Sg-N74Uv0JqdJ_Xk/)).
- **Pedido (fino, 1):** teste por uso em vez de por dias.

## Modelo

- **Por usuário, mensal, sem fidelidade.** É o contrário do contrato mínimo de 6 meses do original e responde direto à reclamação.
- **Anual opcional** com 2 meses grátis (paga 10, usa 12). **Cancelou o anual, recebe o proporcional de volta**, automaticamente.
- **Teste de 14 dias sem cartão.** O pedido de teste por uso é fino demais para virar regra; fica como experimento.
- **Mensagens do WhatsApp:** a Meta cobra conversas iniciadas pela empresa. Repassamos a preço de custo, com o valor visível na fatura. Nada de pacote escondido.

## Planos (3, nomeados por quem usa)

| plano | para quem | mensal | anual (por mês) | inclui |
| --- | --- | --- | --- | --- |
| **Autônomo** | 1 a 2 pessoas | R$ 59 | R$ 49 | 1 funil, caixa de entrada (chat do site + 1 WhatsApp), tarefas, painel |
| **Equipe** | o time de vendas | R$ 99 | R$ 82 | funis ilimitados, 3 canais, papéis (todos/equipe/só os meus), automações por etapa, transmissão com opt-in, rastro de entrega |
| **Operação** | várias filiais ou alto volume | R$ 159 | R$ 132 | canais ilimitados, relatórios, webhooks/API, histórico de auditoria, suporte com prazo de resposta |

Por que esses números: abaixo do Básico (R$ 100) e do Avançado (R$ 150) do Kommo **sem exigir contrato longo**, e na mesma faixa do RD Station. É um ponto de partida; validar com os 10 primeiros clientes (`launch-plan.md`).

## O que corrigir no produto (não só no preço)

- [ ] Cancelar em 1 clique, dentro de Configurações → Plano. Sem ligação nem formulário.
- [ ] Email 7 dias antes de cada renovação anual, com o valor e o botão de cancelar.
- [ ] Aumentar o número de usuários cobra proporcional no dia; reduzir vale no próximo ciclo. Sem saltos surpresa.
- [ ] Fatura com o custo da Meta separado.

## Stripe: produtos e preços a criar (você cria, em modo de teste primeiro)

| produto | preço (lookup_key) | valor | recorrência | quantidade |
| --- | --- | --- | --- | --- |
| Recadi Autônomo | `autonomo_mensal` | BRL 59,00 | mensal | por usuário |
| | `autonomo_anual` | BRL 588,00 | anual | por usuário |
| Recadi Equipe | `equipe_mensal` | BRL 99,00 | mensal | por usuário |
| | `equipe_anual` | BRL 984,00 | anual | por usuário |
| Recadi Operação | `operacao_mensal` | BRL 159,00 | mensal | por usuário |
| | `operacao_anual` | BRL 1.584,00 | anual | por usuário |

Formas de pagamento: cartão e Pix (boleto opcional no anual). No Customer Portal: cancelar ativado, `proration_behavior=create_prorations` para aumento de usuários. Reembolso proporcional do anual: via webhook `customer.subscription.deleted`, em `/replica-backend`.
