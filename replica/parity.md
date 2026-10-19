# Paridade: clone × Kommo (funções centrais)

> **Atualização de 18/10/2026.** Este documento é de 11/10. Desde então ficaram prontos: vários funis (criar, renomear, excluir) e etapas editáveis (S19), criar empresa e ligar ao contato, conexão de WhatsApp, Instagram e Messenger pela API oficial (inclusive com o app da própria empresa), status de entrega, agente de IA, robôs em fluxo livre, links rastreáveis e UTMs, calendário com mês, botão de chat para colar no site (`widget.js`), importar e exportar contatos em planilha e exportar leads. Em 19/10 entraram também: anexos na conversa (foto, áudio, vídeo e documento, nos dois sentidos pela Meta e para o visitante do chat do site), login com Google (falta ligar o provedor no Supabase), convite por link, notificações com "marcar tudo como lido" e reserva de consulta quando o tempo real cai (o tempo real em si já existia no modo Supabase). Continua faltando: o visitante do chat do site mandar arquivo e o convite chegar por email (hoje o admin manda o link). A nota abaixo não foi recalculada.

Data: 2026-10-11 · Build: branch `build` (63ce999) · Ferramentas: `parity.py` (skill replica-diff)

## Veredito: **não pronto para lançar**

16 itens essenciais ainda não estão completos (4 sem nada, 12 parciais). Não há bug S1 ou S2 aberto (`bugs.md`).

| métrica | valor |
| --- | --- |
| Paridade geral | **52,8 / 100** |
| Funcionalidades (peso: essencial 3, desejável 2, opcional 1; parcial vale metade) | 52,8 |
| Essenciais completos | **20 de 36** |
| Itens pontuados | 69 (7 fora de propósito, não contam) |
| Layout por tela | **não medido** — ver abaixo |
| Testes e2e | 21 de 21 passando |

## Layout: por que não há nota

O diff de layout compara capturas do original e do clone **no mesmo estado**. As telas do Kommo ficam atrás de login, e o escopo combinado foi só fontes públicas (sem conta). As imagens do site de marketing são maquetes animadas, em outro estado e tamanho — comparar com elas daria um número falso.

Feito: capturas do clone em `replica/clone-screens/` (S01, S04, S05, S06, S09, S12, S16, S17, S25; 1440×900 e 390×844). Para medir, é preciso capturas do original nos mesmos estados — da sua própria conta, se os termos do Kommo permitirem esse uso (ver recon).

## Por área (mais fraca primeiro)

| área | nota | itens |
| --- | --- | --- |
| automação | 0 | 5 |
| cobrança | 0 | 2 |
| comunicação, calendário, IA | 0 | 1, 1, 2 |
| canais | 10,7 | 7 |
| equipe | 21,4 | 3 |
| auth | 50 | 1 |
| inbox | 50 | 12 |
| listas | 56,2 | 3 |
| insights | 66,7 | 4 |
| funil | 67,7 | 12 |
| lead | 68,2 | 8 |
| shell, tarefas | 83,3 | 3, 3 |
| onboarding | 100 | 2 |

## O que falta, em ordem de construção (essenciais)

1. Conectar WhatsApp pela Cloud API oficial — **depende do `/replica-backend` e da aprovação da Meta**
2. Convidar usuários
3. Criar, renomear, reordenar e colorir etapas (S19)
4. Anexos (imagem, áudio) na conversa
5. Login com Google (parcial)
6. Widget de chat embutível no site (hoje é só a página pública)
7. Permissões por papel aplicadas no app (o RLS do `schema.sql` já existe e foi testado)
8. Filtros por tag e data
9. Criar novo funil
10. Tempo real de verdade (hoje: atualização a cada 4s)
11. Status de entrega reais (dependem de canal real)
12. Cores de tag e tags em contatos
13. Vincular contato ou empresa depois de criado o lead
14. Criar empresa
15. Marcar notificação como lida
16. Grade semana/mês no calendário

Lista completa (desejáveis e opcionais): saída do `parity.py`, reproduzível com `python parity.py replica/features.csv`.

## Diferenças de comportamento

Baseado na central de ajuda pública do Kommo (recon, fontes 4, 5 e 7) e nos testes do clone.

| fluxo | original | clone | decisão |
| --- | --- | --- | --- |
| F03 aceitar lead de entrada e responder | aceitar (✓ no card) deixa o lead na 1ª etapa; responder exige abrir o card ou a inbox | aceitar já abre o cartão do lead com o campo de mensagem pronto: **1 clique a menos** | manter |
| F03 várias mensagens do mesmo desconhecido | um card de entrada | um card por conversa; a prévia mostra a última mensagem | igual |
| F03 duas pessoas aceitando ao mesmo tempo | não documentado | a 2ª recebe "Outra pessoa já tratou este lead" | manter |
| F05 marcar como perdido | pede motivo | pede motivo (lista do workspace) | igual |
| F05 mover pelo teclado | não documentado | Espaço, setas e Espaço, com anúncio para leitor de tela | manter |
| F06 lead sem nome | gera nome automático | "Lead #número" | igual |
| Navegação no celular | app nativo separado | web responsiva com barra inferior; sem app | rever no lançamento |
| Mensagem do cliente "some" e reaparece depois (relato no Reclame Aqui) | — | mensagem gravada antes de qualquer processamento; dedup por id do canal | vantagem a provar com canal real |

## Próximos 5 a construir

1. **Backend real** (`/replica-backend`): Supabase com o `schema.sql`, login, Realtime. Destrava os itens 5, 7, 10 e 11.
2. **WhatsApp Cloud API**: pedir a revisão da Meta já, porque leva semanas.
3. **Configurar etapas (S19)** e criar funil.
4. **Convites e papéis (S24)**.
5. **Anexos na conversa** (Supabase Storage).

Depois disso: `/replica-build` para as lacunas. A pesquisa do `/replica-entrepreneur` já foi feita em paralelo (`fixes.md`).
