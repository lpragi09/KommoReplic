# Plano de testes: CRM (clone das funções centrais do Kommo)

Build: branch `build`, a partir de 1f35af3 · Data: 2026-10-11 · Ambiente: local, dados falsos em memória, Chromium 1440×900 e 390×844
Specs: `web/e2e/*.spec.ts` (`npx playwright test`). Toda spec falha com erro de console, `pageerror` ou resposta 5xx; telas passam por axe (WCAG 2.1 A/AA).

Resultado: coluna `result` preenchida depois da rodada (ver resumo no fim e `bugs.md`).

| caso | fluxo | tipo | passos | esperado | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | cadastro e 1º funil | feliz | /signup → nome, email, senha → empresa → abrir funil | funil com estado vazio, sem violações de a11y | e2e | pass |
| F01-N1 | | negativo: senha errada | login com senha errada | alerta "Email ou senha incorretos", email preservado | e2e | pass |
| F01-N2 | | negativo: email repetido | cadastro com email existente | alerta "Já existe uma conta" | e2e | pass |
| F01-E1 | | borda: entrada inválida | senha de 3 caracteres | recusada no servidor (zod) com mensagem | e2e | pass |
| F01-E2 | | borda: acentos, emoji, endereço reservado | empresa "Ótica São João 👓", endereço "login" | slug sem acento; "reservado" recusado | e2e | pass |
| F01-E3 | | borda: sessão expirada | apagar cookie, abrir funil | volta para /login | e2e | pass |
| F01-E4 | | borda: dados de outro usuário | usuário novo abre /demo/leads | 404, nada vaza | e2e | pass |
| F01-E5 | | borda: voltar no meio do onboarding | voltar do /onboarding | conta existe; /onboarding de novo funciona | manual | não rodado |
| F02-H1 | conectar WhatsApp | feliz | — | — | fora do escopo desta build (canal não implementado) | n/a |
| F03-H1 | visitante → lead → resposta → ganho | feliz | visitante escreve no chat do site; equipe aceita; responde; marca Ganho | card na entrada, cartão com a conversa, resposta chega ao visitante, lead na coluna Ganho | e2e | pass |
| F03-E1 | | borda: várias mensagens do mesmo visitante | 2 mensagens | 1 card só | e2e | pass |
| F03-E2 | | borda: duas abas | aceitar o mesmo lead em 2 abas | 2ª aba recebe "Outra pessoa já tratou" | e2e | pass |
| F03-E3 | | borda: vazio e longo | enviar vazio; colar 2500 caracteres | botão desabilitado; corta em 2000 | e2e | pass |
| F03-N1 | | negativo: chave inexistente | /chat/naoexiste | 404 | e2e | pass |
| F03-E4 | | borda: visitante sem localStorage | aba anônima com storage bloqueado | conversa funciona só na aba | manual | não rodado |
| F04-H1 | responder cliente | feliz | coberto em F03-H1 | | e2e | pass |
| F04-E1 | | borda: nota vazia | | botão desabilitado; nota com acento salva | e2e | pass |
| F04-E2 | | borda: duplo clique em Enviar | 2 cliques rápidos | 1 mensagem (dedup por client_id) | manual | não rodado |
| F04-E3 | | borda: fora da janela de 24h | — | só WhatsApp; canal ainda não existe | n/a |
| F05-H1 | mover lead | feliz: só teclado | foco no puxador, Espaço, →, Espaço | lead em Qualificado, persiste após recarregar | e2e | pass |
| F05-E1 | | borda: perdido | botão Perdido | exige motivo; faixa e histórico mostram | e2e | pass |
| F05-E2 | | borda: 2 usuários movendo | — | última escrita vence, o outro vê em ≤ 4s | manual | não rodado |
| F06-H1 | criar lead | feliz | novo lead sem nome | "Lead #n" | e2e | pass |
| F06-E1 | | borda: nome 60+, acentos, valor BR | "12.500,50" | nome inteiro, R$ 12.501 no card e na coluna | e2e | pass |
| F07-H1 | tarefa | feliz | tarefa no cartão → agenda → concluir com resultado | aparece em Amanhã; some ao concluir | e2e | pass |
| F07-E1 | | borda: fuso diferente | usuário em outro fuso | — | manual (fuso fixo, ver bugs) | não rodado |
| F08–F10, F13–F15 | configurar funil, automações, equipe, vincular, transmissão, bot | — | telas ainda em construção | | n/a |
| F11-H1 | painel | feliz | abrir /home | heading e sem violações | e2e (varredura) | pass |
| F12-H1 | lista e filtro | feliz | /demo/leads?view=list&task=none | só leads sem tarefa | e2e | pass |
| S-ALL | telas restantes | a11y + console | inbox, contatos, empresas, agenda, painel, canais, notificações, busca, configurações | h1 visível, 0 violações, 0 erros | e2e | pass |
| S-MOB | celular 390px | borda: mobile | funil, cartão, inbox | sem rolagem horizontal na página | e2e | pass |

## Resumo da rodada (2026-10-11)

- Automatizados: 21 testes (20 desktop + 1 celular), **21 passando** após as correções. Primeira rodada: 0 de 21 passando (21 falhas: 2 bugs S1 derrubavam quase tudo, mais ajustes de seletor nos próprios testes).
- Manuais não rodados: F01-E5, F03-E4, F04-E2, F05-E2, F07-E1 — ficam na lista "para verificar" de `bugs.md`.
- Fora desta build: F02 (WhatsApp), F08–F10, F13–F15 (telas em construção).
- Bugs: 7 encontrados (S1: 2, S2: 1, S3: 3, S4: 1), 7 corrigidos, 0 abertos.
