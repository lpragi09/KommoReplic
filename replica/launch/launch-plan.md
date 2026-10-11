# Plano de lançamento

Regra: nada de avaliações falsas, contas falsas ou o nome do original em anúncio, loja ou palavra-chave.

## Antes (4 a 6 semanas)

1. **Lista de espera** na landing: trocar o CTA por "Entrar na lista" até o backend real estar no ar.
2. **Pedido de revisão da Meta** (WhatsApp Business, Tech Provider) **na semana 1**, porque leva semanas.
3. **Analytics sem cookie** (Plausible ou Umami) e **erros** (Sentry) ligados antes do primeiro usuário.
4. **Termos e Privacidade** publicados, listando todos os processadores (Supabase, Vercel, Stripe, Resend, Meta, Sentry).
5. **Página de status** (fix 3) no ar desde o dia 1. Ela é parte da promessa.

## Onde estão os insatisfeitos

Ler e participar como pessoa, sem spam:
- Reclame Aqui, página do Kommo: tema recorrente de instabilidade e cobrança. **Não responder reclamações deles oferecendo o nosso produto**: além de antiético, fere as regras do site.
- Grupos e comunidades de quem vende pelo WhatsApp (afiliados, clínicas, imobiliárias, escolas), onde já se discute "CRM de WhatsApp".
- Buscas "alternativa ao Kommo", "CRM WhatsApp sem fidelidade": conteúdo próprio (artigo honesto sobre como escolher CRM), sem citar concorrente em anúncio pago.

## Dia do lançamento

- **Product Hunt / Hacker News (Show HN):** liderar com a correção, não com a cópia. "Mostra o caminho de cada mensagem do WhatsApp e avisa quando o canal cai." Com demonstração real.
- **Post no LinkedIn e no Instagram** do fundador com o vídeo do fluxo em 30s: mensagem chega → aceita → responde → ganho.

## Os 10 primeiros clientes (à mão)

1. 3 clínicas ou consultórios (posicionamento B, para testar o nicho).
2. 3 pequenas lojas que vendem por WhatsApp com anúncio rodando (posicionamento A).
3. 2 escritórios de serviços (advocacia, contabilidade).
4. 2 equipes de 5+ vendedores (para validar o plano Equipe e as permissões).

Para cada um: onboarding por vídeo de 30 min, ouvir o que faria cancelar, ajustar o preço com base nisso (`pricing.md` é ponto de partida).

## Métricas da 1ª semana

- Cadastro → 1º canal conectado (alvo: 60%)
- 1ª mensagem respondida em menos de 10 min
- Mensagens com falha de entrega (alvo: < 0,5%)
- Cancelamentos e o motivo de cada um

## Lojas

`listing.json` validado (`listing.py`: 0 erros, 0 avisos). Hoje o produto é web; app nativo só depois. Para a loja: capturas nos tamanhos atuais exigidos, rótulos de privacidade, URL de privacidade e suporte, e conta demo para o revisor (`demo@exemplo.com` só em ambiente de teste, nunca em produção).
