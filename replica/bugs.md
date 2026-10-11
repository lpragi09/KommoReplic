# Bugs

Build: branch `build` · Browser: Chromium (Playwright) 1440×900 e Pixel 7 390×844 · Dados falsos em memória
Todos reproduzidos por teste automatizado. Cada correção ficou coberta pelo teste que a pegou.

### BUG-001: funil vazio quebra para toda conta nova
- Severity: S1 (fluxo principal bloqueado)
- Flow / case: F01 / F01-H1 · Screen: S04
- Steps: 1. criar conta 2. criar empresa 3. cair em /{slug}/leads
- Expected: estado vazio "Seu funil está vazio". Actual: erro "Functions cannot be passed directly to Client Components"; página não renderiza.
- Evidence: F01-H1 falhando com `icon={{$$typeof…, render: function Columns3}}`
- Cause: `EmptyState` morava num arquivo `"use client"` e recebia um componente de ícone vindo de componente de servidor.
- Status: fixed — `components/ui/bits.tsx` virou módulo sem diretiva (serve servidor e cliente); `SegmentedControl` e `useToast` foram para `components/ui/interactive.tsx`.

### BUG-004: chat do site (visitante) não abre
- Severity: S1 (fluxo principal bloqueado: nenhum lead entra pelo site)
- Flow / case: F03 / F03-H1, F03-E1, F03-E2, F03-E3 · Screen: /chat/[key]
- Steps: 1. abrir /chat/{chave} num navegador sem sessão
- Expected: janela de chat. Actual: "This page couldn't load"; console: "destroy is not a function".
- Cause: `useEffect(() => end.current?.scrollIntoView(...))` sem chaves. No Chromium atual `scrollIntoView()` devolve uma Promise, que o React tratou como função de limpeza.
- Status: fixed — corpo do efeito entre chaves. O teste agora também observa erros da aba do visitante.

### BUG-003: mover lead pelo teclado não troca de etapa
- Severity: S2 (recurso quebrado para quem usa teclado / leitor de tela; sem alternativa no quadro)
- Flow / case: F05 / F05-H1 · Screen: S04
- Steps: 1. focar o puxador do card 2. Espaço 3. → 4. Espaço
- Expected: card na etapa seguinte. Actual: "solto em Primeiro contato" — a seta andava 25px, nunca chegava à próxima coluna.
- Status: fixed — `coordinateGetter` próprio (`jumpBetweenColumns`) salta coluna a coluna. (Alternativa sempre existiu no cartão do lead: seletor de etapa.)

### BUG-002: aviso de "uncached data" em toda tela logada
- Severity: S3 (console com erro em dev; navegação bloqueia no servidor)
- Flow / case: todos · Screen: S04–S30
- Cause: com Cache Components, ler sessão fora de cache gera validação de navegação instantânea.
- Status: fixed — `export const instant = false` no layout e nas páginas do workspace (bloquear no servidor é o comportamento desejado atrás de login). Revisitar com `"use cache: private"` no Supabase.

### BUG-005: aviso de hidratação no quadro Kanban
- Severity: S3
- Flow / case: F05, F06 · Screen: S04
- Actual: "A tree hydrated but some attributes … didn't match" — ids `DndDescribedBy-*` diferentes no servidor e no cliente.
- Status: fixed — `id={useId()}` no `DndContext`.

### BUG-006: página 404 fora do workspace em inglês
- Severity: S4
- Flow / case: F01-E4, F03-N1
- Status: fixed — `app/not-found.tsx` em português.

### BUG-007: lista com filho inválido (axe `list`)
- Severity: S3 (acessibilidade)
- Screen: chat do visitante, histórico do lead
- Actual: `<ol>` com `<div>` de âncora de rolagem.
- Status: fixed — âncora virou `<li aria-hidden>`.

## Para verificar (não reproduzido)

- 404 por streaming responde HTTP 200 (conteúdo bloqueado e "Não encontramos" na tela). Comportamento conhecido do Next com Suspense; não vaza dados, mas crawlers e monitores veem 200.
- Duplo clique em "Enviar" no cartão: o dedup por `client_id` existe no repositório, mas não há teste disparando dois cliques simultâneos.
- Dois usuários movendo o mesmo card: a última escrita vence; o outro só vê após o refresh de 4s.
- Fuso horário fixo em -03:00 no calendário (`startOfDay`). Errado para workspaces fora de Brasília.
- Painel usa `setHours(0)` no fuso do servidor para "Hoje".

## Contagem

| severidade | encontrados | corrigidos | abertos |
| --- | --- | --- | --- |
| S1 | 2 | 2 | 0 |
| S2 | 1 | 1 | 0 |
| S3 | 3 | 3 | 0 |
| S4 | 1 | 1 | 0 |
