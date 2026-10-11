# Landing page

Construída em `web/src/components/marketing/landing.tsx`, servida em `/` para quem não está logado. Só HTML e CSS, nenhum JS de cliente além do Next. Testada: `e2e/landing.spec.ts` (axe sem violações, 390px sem rolagem horizontal, CTA → cadastro).

| seção | conteúdo | de onde vem |
| --- | --- | --- |
| Hero | "Nenhum cliente perdido no caminho." + linha de apoio + "Testar 14 dias grátis" + captura real do funil | ângulo A (`fixes.md`) |
| Problema | (1) sistema fora do ar sem aviso; (2) mensagem atrasada ou no lead errado | ódios 1 e 3/7, parafraseados, sem citar ninguém |
| Como funciona | o cliente escreve → você aceita e responde → arrasta até o Ganho | fluxo F03–F05 |
| Recursos | 6 cards; os de correção (rastro de entrega, vínculo à prova de troca, aviso de canal, WhatsApp guiado) marcados **"em breve"**; os prontos marcados "pronto" | `fixes.md` 1, 2, 3, 5 |
| Preços | 3 planos de `pricing.md`, mensal, anual com 2 meses grátis, nota do custo da Meta | `pricing.md` |
| Perguntas | fidelidade, cartão, WhatsApp (dizendo que ainda não está pronto), custo das mensagens, importação | objeções reais da pesquisa |
| Chamada final | "Comece hoje. Se não servir, cancela em um clique." | fix 4 |

Prova social: **nenhuma**, de propósito. Sem depoimentos, números de clientes ou logos. Entra quando houver clientes beta reais, com autorização.

Contraste: todas as cores vêm dos tokens (`contrast.py`: 0 falhas AA).

Pendente antes de publicar: páginas de Termos e Privacidade (o rodapé diz "em preparação"), favicon e imagem social com o logo real.
