# O que corrigir: pesquisa com usuários do Kommo

Data: 2026-10-11 · Amostra: **119 avaliações reais** (`reviews.csv`), todas com link · Ranking: `feedback.md` (reviews.py com `themes-pt.json`)

| fonte | n | como foi coletado |
| --- | --- | --- |
| App Store (BR 80, MX 19, ES 5, US 5, PT 1) | 110 | feed RSS público oficial da Apple, id 6443626329, mais recentes primeiro |
| Reclame Aqui | 9 | lidas uma a uma no navegador; trechos copiados literalmente |
| Capterra | 0 | página exigiu verificação anti-robô; não contornada |
| G2, Trustpilot, Reddit, Google Play | 0 | não coletadas nesta rodada |
| Hacker News | 0 | API Algolia: nenhuma menção real a Kommo/amoCRM |

Notas: 58 de 110 avaliações da App Store têm 5 estrelas. Datas de 2023-01 a 2026-09.

**Limites desta amostra:**
- Só 2 tipos de fonte; o pedido da skill é 3 ou mais.
- 92% vem do app de celular, então reclamações do app pesam mais que as da versão web.
- O tema "app de celular" está inflado: a palavra "app" aparece em quase toda avaliação da App Store. Tratar como indício, não como ranking.

## 1. O que eles odeiam

| # | problema | avaliações | fontes | citações (literais) |
| --- | --- | --- | --- | --- |
| 1 | **Sistema instável: fora do ar, bugs, trava** | 23 | App Store (5 países) + Reclame Aqui | "Estamos há 48 horas sem conseguir utilizar o CRM Kommo, ferramenta essencial para o funcionamento da nossa operação." — [Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/crm-kommo-indisponivel-por-48-horas-suporte-lento-e-prejuizos-operacionais_3hZG1G6QttSKONui/) · "App crashes all the time" — [App Store US](https://apps.apple.com/us/app/kommo/id6443626329?see-all=reviews#review-12634701548) |
| 2 | **Suporte lento, repetitivo, manda tutorial genérico** | 37 (média 3,8★: parte é elogio a "atendimento") | App Store + Reclame Aqui | "Os atendimentos foram repetitivos, com envio de links genéricos, orientações padronizadas e sem nenhuma atuação técnica resolutiva." — [Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/kommo-crm-suporte-ineficiente-e-falha-tecnica-persistente-ao-conectar-nume_2HXpakJ04GvLGsf2/) · "tiene bugs y cuando se reportan a Soporte nadie sabe dar asistencia sobre la app." — [App Store ES](https://apps.apple.com/es/app/kommo/id6443626329?see-all=reviews#review-14530150161) |
| 3 | **Integração com WhatsApp falha, atrasa ou é difícil de conectar** | 24 | App Store + Reclame Aqui | "O envio com delay de horas (2, 3.4h), isso quando a mensagem chega pro cliente!" — [Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/kommo-crm-nao-caiam-nessa_7IExUsZOW_zny4dx/) |
| 4 | **App de celular: não abre, notificações não chegam** | 5 sobre notificações (o tema amplo, 49, está inflado) | App Store BR + MX | "Notificações nao chegam… imagens ficam demorando pra enviar… isso é rotineiro." — [App Store BR](https://apps.apple.com/br/app/kommo/id6443626329?see-all=reviews#review-14254838154) · "Las notificaciones se pierden." — [App Store MX](https://apps.apple.com/mx/app/kommo/id6443626329?see-all=reviews#review-10886132614) |
| 5 | **Cobrança antecipada e cancelamento/reembolso travado** | 4 | App Store + Reclame Aqui (3 fontes por país) | "Não vale o preço e mesmo que não funcione eles não estornam o valor pago" — [App Store BR](https://apps.apple.com/br/app/kommo/id6443626329?see-all=reviews#review-13690489804) · "Fui cobrado antecipadamente por 6 meses de serviço." — [Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/reclamacao-sobre-kommo-crm-suporte-ineficiente-problemas-de-integracao-com-whatsapp-cobranca-indevida-e-falha-no-cancelamento_Sg-N74Uv0JqdJ_Xk/) |
| 6 | **Vendedor promete o que o produto não faz** | 4 | App Store MX + Reclame Aqui | "Te prometen poder enviar mensajes masivos a clientes nuevos (100% falso)" — [App Store MX](https://apps.apple.com/mx/app/kommo/id6443626329?see-all=reviews#review-11571747669) |
| 7 | **Mensagens que somem ou caem no lead errado** *(fino: 4 avaliações, mas gravíssimo)* | 4 | App Store + Reclame Aqui | "um lead A envia mensagem no WhatsApp e essa conversa aparece vinculada ao lead B (mensagens cruzadas)." — [Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/erro-grave-no-kommo-crm-mensagens-do-whatsapp-vinculadas-a-leads-errados-expondo-dados-sensiveis-e-violando-a-lgpd_9vP4kwqs8akPMxvB/) · "o sistema simplesmente desapareceu com mais de 30 leads que recebemos" — [Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/sistema-de-crm-kommo-com-problemas-e-perda-de-leads_2dDAnJkzTYasxCx9/) |

Fino (1 fonte, 2 avaliações): número bloqueado pela Meta / janela de 24h; difícil de configurar.

## 2. O que falta

| # | pedido | avaliações | fontes | citação |
| --- | --- | --- | --- | --- |
| 1 | **Automação e bot que funcionem de verdade** (e distribuição de atendimentos) | 20 (média 4,5★: quem tem, valoriza; quem não consegue usar, reclama) | 3 | "as automações de mensagens através do / simplesmente NÃO FUNCIONA" — [App Store BR](https://apps.apple.com/br/app/kommo/id6443626329?see-all=reviews#review-10881076833) |
| 2 | **Envio em massa sem precisar contratar terceiro** | 3 | 3 | "Lista de Transmissão e envios em massa, só é possível contratando uma outra empresa pra fazer um API" — [Reclame Aqui](https://www.reclameaqui.com.br/kommo_1411514/kommo-crm-nao-caiam-nessa_7IExUsZOW_zny4dx/) |
| 3 | Teste grátis por uso, não por dias *(fino: 1)* | 1 | 1 | "poderia ter um plano grátis de teste com 1000 ou 500 interações gratuitas ao invés de testar por 7 dias." — [App Store BR](https://apps.apple.com/br/app/kommo/id6443626329?see-all=reviews#review-13148894156) |
| 4 | Versão para iPad *(fino: 1)* | 1 | 1 | "APP BOM - falta versão ipad." — [App Store BR](https://apps.apple.com/br/app/kommo/id6443626329?see-all=reviews#review-9618150001) |
| 5 | Login com Google também no app *(fino: 1)* | 1 | 1 | "minha conta principal foi criada pelo Google e não esta permitindo a conexão aqui no mobile." — [App Store BR](https://apps.apple.com/br/app/kommo/id6443626329?see-all=reviews#review-11076329779) |

## 3. O que ninguém resolve (posicionamento)

1. **Quem atende dados sensíveis pelo WhatsApp** (clínicas, consultórios, escritórios de advocacia). Um médico e um advogado relatam falhas que expõem dados ou travam o número oficial. *Fino: 2 relatos, 1 fonte*, mas o custo do erro é altíssimo (LGPD, sigilo).
2. **Pequenas equipes que não podem ficar um dia sem WhatsApp.** Quedas de 1 a 3 dias com "tráfego pago ativo" aparecem em 4 relatos. Hoje não existe transparência sobre o que caiu nem quando volta.
3. **Quem quer contratar sem medo de ficar preso.** Planos anuais ou semestrais pagos adiantado mais cancelamento travado aparecem em 4 relatos, em 3 países.

## Plano de correções (evidência × custo)

| # | o que construir ou mudar | tamanho | skill | evidência |
| --- | --- | --- | --- | --- |
| 1 | **Rastro de entrega por mensagem**: na bolha, "recebida às 14:02 · gravada · entregue"; tela "onde está minha mensagem?" com o log do canal | M | replica-build + replica-backend | ódio 3 e 7 (28 avaliações) |
| 2 | **Vínculo à prova de troca**: a mensagem só entra no lead se o id do remetente bater; teste automatizado contra "mensagens cruzadas"; trilha "por que esta conversa está neste lead" | S | replica-backend (já há `unique (channel_id, external_thread_id)` no schema) | ódio 7; posicionamento 1 |
| 3 | **Página de status pública e aviso dentro do app** quando um canal cai, com hora de início e previsão | S | replica-deploy | ódio 1 (23) |
| 4 | **Mensal, sem fidelidade, cancela em 1 clique, reembolso proporcional automático** | S | replica-launch (preço) + replica-backend (Stripe portal) | ódio 5 (4) e posicionamento 3 |
| 5 | **Conexão do WhatsApp guiada com checagem automática** (verificação do Business, número, permissões) antes de cobrar, com erro explicado em português | M | replica-backend | ódio 3 (24) |
| 6 | **Suporte dentro do app com o caso inteiro anexado** (canal, últimos erros, ids) para ninguém reexplicar | M | replica-build | ódio 2 (37) |
| 7 | **Notificações confiáveis no celular** (PWA com Web Push e teste "enviar notificação de teste") | M | replica-build | ódio 4 (5) |
| 8 | **Página "o que o produto faz e não faz"** e nada de promessa de envio em massa para quem não deu opt-in | S | replica-launch | ódio 6 (4) |

Todos entraram no `features.csv` como linhas com `original = no`.

## Posicionamento

```
A) Para pequenas empresas que vendem pelo WhatsApp e já perderam cliente porque a mensagem
   atrasou, sumiu ou o sistema caiu, [nome] mostra o caminho de cada mensagem e avisa na hora
   quando um canal para.
   Evidência: instabilidade + WhatsApp + mensagens perdidas, 51 avaliações (com sobreposição), App Store e Reclame Aqui.

B) Para clínicas e escritórios que atendem dados sensíveis pelo WhatsApp, [nome] garante que
   cada conversa cai no paciente/cliente certo, com trilha de auditoria pronta para a LGPD.
   Evidência: mensagens cruzadas e número oficial travado, 2 relatos fortes (fino), 1 fonte.

C) Para quem tem medo de assinar e ficar preso, [nome] é mensal, cancela em um clique e
   devolve o proporcional sozinho.
   Evidência: cobrança e cancelamento, 4 avaliações em 3 países + Reclame Aqui.
```

**Recomendado: A**, com a C como política de preço (custa pouco e responde a uma reclamação real). A tem a maior evidência, cabe no produto que já existe (inbox e lead de entrada) e é verificável: o cliente vê o status. A B é um ótimo nicho para depois, mas hoje a evidência é fina demais para virar o posicionamento principal.

Regras: não usar o nome Kommo no nome do app, em anúncios nem na loja. As citações acima são pesquisa, não depoimento. Página comparativa é assunto para advogado.
