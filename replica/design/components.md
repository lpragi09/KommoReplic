# Componentes

Fonte: lista de componentes em `replica/recon.md`. Tokens: `tokens.json` → `tokens.css`.
Base: shadcn/ui (Radix) + Lucide. Classes sempre por papel (`bg-surface`, `text-muted`, `border-border`), nunca hex.
Padrão: azul (`accent`) para ação e seleção, preto (`nav-bg`, `fg`) para estrutura e texto. Vermelho e verde só para perigo, erro, ganho e perda — cor com significado, nunca decoração.

O que é nosso e não do original: ícones Lucide, fonte Inter, textos escritos do zero, paleta azul/preto, sem ilustrações deles. O que segue o original: os padrões (Kanban por etapa, cartão com painel + feed, inbox em três colunas), que são convenção de CRM e o que o usuário espera.

---

```
Button
  variants  primary (bg accent, text on-accent), secondary (bg bg, border border, text fg),
            ghost (transparente, text fg, hover bg surface), danger (bg danger, text on-accent),
            inverse (bg inverse-bg, text on-inverse — CTA em fundo claro)
  sizes     sm 28px (text-sm), md 36px (text-base), lg 44px (text-md)  — UI densa de CRM
  states    default, hover (primary → accent-hover), active (translateY 1px), focus-visible (2px ring focus,
            offset 2), disabled (opacity .5, sem pointer), loading (spinner no lugar do ícone, label mantido)
  tokens    radius sm, font weight 500, padding x 12/16/20
  a11y      <button> real; loading → aria-busy, label continua no DOM; ícone sozinho exige aria-label
  used on   todas
```

```
IconButton
  sizes     28, 32, 36 quadrado
  states    iguais ao Button; "pressed" (aria-pressed) com bg accent-soft, text accent-text
  a11y      aria-label obrigatório; tooltip com o mesmo texto
  used on   S03, S04 topbar, S06 compositor, S09
```

```
Input / Textarea
  variants  text, number, money (prefixo "R$", máscara pt-BR, grava centavos), phone (E.164 + máscara BR),
            email, search (ícone + limpar), date
  size      36px; textarea cresce até 8 linhas
  states    default (border border-input), hover, focus (border focus + ring 2px focus/30%),
            error (border danger + mensagem text-xs danger abaixo, aria-invalid), disabled (bg surface)
  tokens    radius sm, text base, padding x 10
  a11y      <label> sempre (pode ser visualmente oculto na busca); erro ligado por aria-describedby
  used on   S01, S02, S06, S07, S19–S29
```

```
InlineField  (campos do painel do lead — editar no lugar)
  states    leitura (texto, hover mostra bg surface + ícone lápis), editando (vira Input/Select),
            salvando (spinner pequeno), erro (volta valor + toast)
  behavior  Enter salva, Esc cancela, blur salva; valor vazio mostra "—" text-muted
  a11y      botão com aria-label "Editar <campo>"; foco volta ao botão após salvar
  used on   S06, S13, S15
```

```
Select / Combobox
  variants  simples, multi (chips), com busca, usuário (avatar + nome), etapa (pinta a cor da etapa)
  states    fechado, aberto, carregando, vazio ("Nada encontrado"), desabilitado
  tokens    popover bg bg, shadow pop, radius md; item ativo bg accent-soft text accent-text
  a11y      Radix Select/Popover + cmdk; setas, Enter, Esc, digitar para buscar
  used on   S04 (seletor de funil), S06, S16, S20, S24
```

```
NavRail  (barra lateral do app)
  variants  recolhida 64px (só ícones + tooltip), expandida 240px (ícone + rótulo + grupos), mobile (drawer)
  parts     logo nosso no topo, grupos: Início, Comunicação, Funis, Calendário, Listas, Automações, Insights;
            rodapé: busca, notificações (badge), ajuda, avatar
  states    item default (nav-muted), hover (bg nav-hover, nav-text), ativo (barra 3px nav-active à esquerda +
            ícone nav-text + bg nav-hover), badge (bg accent, on-accent, text-xs)
  tokens    bg nav-bg; ícones 20px Lucide stroke 1.75
  a11y      <nav aria-label="Principal">, aria-current="page" no ativo; recolher por botão com aria-expanded;
            preferência salva por usuário
  used on   S03 (todas as telas logadas)
```

```
Topbar  (cabeçalho da seção)
  height    56px, bg bg, border-bottom border
  parts     título / seletor de funil, busca, botão filtro (com contador de filtros ativos),
            SegmentedControl de visão, ação primária à direita ("+ Novo lead")
  used on   S04, S05, S09, S12, S14, S16, S17
```

```
SegmentedControl
  e.g.      KANBAN | LISTA, DIA | SEMANA | MÊS
  tokens    text caps (11px, 600, tracking .06em, caixa alta), item ativo text accent-text + sublinhado 2px accent,
            inativo text-muted
  a11y      role="tablist"/"tab" ou radiogroup; setas trocam
  used on   S04, S16, S17
```

```
KanbanColumn
  width     272px, gap 8px, scroll horizontal no quadro (bg canvas)
  header    faixa 4px no topo com a cor da etapa (stage-1..8, won, lost); nome em text caps;
            linha 2: "12 leads · R$ 48.300" text-xs muted
  variants  normal, entrada (cabeçalho tracejado, fundo surface, filtros por tipo com contadores),
            ganho, perdido (recolhidas por padrão, mostram só totais)
  states    vazia ("Arraste leads para cá" text-muted + contorno tracejado ao arrastar por cima),
            arrastando-sobre (bg accent-soft, borda 2px tracejada accent), carregando mais (skeleton de 2 cards),
            "Adicionar rápido" aberto no topo
  a11y      role="list" com aria-label "<etapa>, N leads"; dnd-kit com anúncios ao vivo
            ("Lead X movido para Proposta")
  used on   S04, S08
```

```
LeadCard  (card do Kanban)
  size      largura da coluna, padding 12, radius md, bg bg, border border, shadow card
  content   linha 1: nome (text base 500, 2 linhas máx) + ícone do canal;
            linha 2: contato principal text-sm muted;
            linha 3: valor (text-sm 600) · tags (até 2 + "+n");
            rodapé: tarefa (ícone + "Hoje 14:00" ou "Sem tarefa" em warning) · avatar do responsável · tempo
  variants  padrão, tarefa atrasada (texto da tarefa em danger), sem tarefa (warning), mensagem não lida
            (ponto accent + nome em 600), selecionado (borda 2px accent)
  states    hover (border border-input), arrastando (shadow drag, rotação 1.5°, opacity .95), fantasma no lugar (bg canvas tracejado)
  a11y      é um link para /leads/[id] + handle de arrasto focável; espaço pega/solta, setas movem entre colunas
  used on   S04
```

```
IncomingCard  (lead de entrada)
  content   ícone do tipo (mensagem/chamada/email/formulário), nome ou telefone, prévia de 2 linhas, horário
  actions   aceitar (IconButton, ícone check, success), vincular (link-2, accent), excluir (trash-2, danger) —
            visíveis no hover e SEMPRE visíveis no foco e no touch
  states    pendente, processando (botões desabilitados), resolvido por outro ("Aceito por Ana" e some em 2s)
  used on   S08
```

```
DataTable
  row       44px, zebra não; hover bg surface; selecionada bg accent-soft
  parts     checkbox de seleção, cabeçalho ordenável (ícone de seta), colunas configuráveis, paginação ou scroll infinito virtualizado
  states    vazio (EmptyState), carregando (skeleton de 8 linhas), erro (linha com tentar de novo)
  a11y      <table> real; aria-sort no cabeçalho; checkbox "selecionar todos" com estado misto
  used on   S05, S12, S14, S24
```

```
BulkBar
  posição   fixa no rodapé da tabela, bg inverse-bg (preto), text on-inverse
  content   "23 selecionados" · Mudar etapa · Responsável · Tags · Excluir (danger) · ×
  a11y      role="toolbar"; aparece com anúncio aria-live
  used on   S05, S12, S14
```

```
EntityPanel  (painel esquerdo do cartão)
  width     360px, bg bg, border-right border, scroll próprio
  parts     cabeçalho: nome (text xl, InlineField), "#123", menu ⋯; barra de etapas do funil (StagePicker);
            valor; responsável; Tabs (Principal, campos por grupo, Estatísticas, Configurar);
            seção Contatos (cards de contato com telefone/email clicáveis, + vincular); Empresa; Tags
  states    novo (foco no nome), ganho (faixa success-soft no topo), perdido (faixa danger-soft + motivo),
            somente leitura (campos sem lápis)
  used on   S06, S13, S15
```

```
StagePicker
  look      barra segmentada horizontal com a cor de cada etapa; etapa atual preenchida, anteriores em tom claro;
            botões "Ganho" e "Perdido" no fim
  behavior  clicar muda etapa; Perdido abre Dialog de motivo
  a11y      radiogroup com nomes das etapas
  used on   S06
```

```
Feed  (timeline)
  items     mensagem recebida (MessageBubble in), enviada (out), nota (fundo bubble-note, ícone de nota),
            tarefa (card com checkbox, prazo, resultado), mudança de etapa / responsável / valor (linha de sistema
            text-xs muted com ícone), chamada, arquivo
  grouping  separador de dia ("Hoje", "Ontem", "12 de outubro")
  parts     filtro do feed (ícone olho: Tudo, Mensagens, Notas, Tarefas, Sistema); anexar no topo
  states    carregando mais acima (spinner), vazio ("Nenhuma atividade ainda"), nova mensagem chegando (aria-live polite)
  used on   S06, S09, S13, S15
```

```
MessageBubble
  variants  in (bg bubble-in, border border, à esquerda), out (bg bubble-out, à direita), note interna
            (bg bubble-note, largura total, rótulo "Nota interna"), sistema (centrado, text-xs muted)
  kinds     texto (links clicáveis), imagem (thumb 240px, abre lightbox), áudio (player), vídeo, arquivo (ícone + nome + tamanho), modelo (rótulo "Modelo" + botões)
  meta      horário text-xs muted + status de saída: relógio (enviando), ✓ (enviada), ✓✓ (entregue), ✓✓ accent (lida),
            ⚠ danger + "Tentar de novo" (falhou)
  tokens    radius lg, canto do lado do remetente radius xs; max-width 72%
  a11y      status com texto oculto ("lida"), não só ícone
  used on   S06, S09, S11
```

```
Composer
  modes     Chat · Nota · Tarefa · Email (abas pequenas acima do campo; seta ↑ alterna)
  parts     seletor de canal/destinatário, textarea, emoji, anexo, gravar áudio, enviar (primary, Ctrl/⌘+Enter)
  shortcuts "/" abre modelos e bots, "@" menciona colega (vira nota interna), "[" insere campo dinâmico
  states    vazio (enviar desabilitado), digitando, enviando, erro, bloqueado pela janela de 24h (faixa warning-soft:
            "Fora da janela de 24h — só modelos aprovados" + botão "Escolher modelo")
  a11y      aria-label por modo; popovers de "/" "@" "[" como combobox com aria-activedescendant
  used on   S06, S09, S10
```

```
ConversationList
  width     320px
  item      avatar do contato com ícone do canal no canto, nome (600 se não lido), prévia 1 linha, horário,
            badge de não lidas (bg accent), etiqueta "Sem resposta há 2h" (warning)
  filters   Todas · Não lidas · Sem resposta · Minhas; canal; responsável
  states    ativo (bg accent-soft + barra accent à esquerda), vazio, carregando
  a11y      listbox; setas navegam, Enter abre
  used on   S09, S11
```

```
Tag / Chip
  look      altura 20, text-xs 500, radius pill, bg accent-soft text accent-text (padrão) ou tons stage-1..4
  states    removível (× com aria-label "Remover tag X")
  used on   S04, S05, S06
```

```
Avatar
  sizes     20, 24, 32, 40
  fallback  iniciais em bg canvas text fg; canal: ícone 14px sobreposto (WhatsApp/Instagram desenhados por nós, monocromáticos)
  used on   várias
```

```
Badge / Counter
  variants  number (bg accent, on-accent, text-xs 600, min 18px), dot (8px accent), neutral (bg canvas, fg)
  used on   S03, S08, S09
```

```
Dialog / Modal
  sizes     sm 400, md 560, lg 720
  parts     título text lg, corpo, rodapé com ações à direita (secundário, primário)
  tokens    bg bg, radius lg, shadow pop, overlay preto 50%
  a11y      Radix Dialog: foco preso, Esc fecha, foco volta ao gatilho; confirmação destrutiva com botão danger e
            texto do que será apagado
  used on   S05, S06 (motivo de perda), S19, S20, S24
```

```
Drawer
  side      direita, 480px (cartão do lead dentro da inbox); bottom sheet no mobile
  a11y      igual ao Dialog
  used on   S09
```

```
Popover / DropdownMenu
  tokens    bg bg, border border, radius md, shadow pop; item 32px; destrutivo em danger
  a11y      Radix
  used on   várias
```

```
Toast
  variants  sucesso (ícone success), erro (ícone danger + ação "Tentar de novo"), info, desfazer ("Lead excluído · Desfazer")
  look      bg inverse-bg, text on-inverse, radius md, canto inferior direito, 5s (erro fica até fechar)
  a11y      role="status" (info/sucesso), role="alert" (erro)
  used on   todas
```

```
Tabs
  look      text sm 500, ativo text fg + sublinhado 2px accent, inativo text-muted
  a11y      Radix Tabs
  used on   S06, S13, S15, S29
```

```
FilterPanel
  parts     painel lateral 320px: filtros rápidos (Meus leads, Abertos, Ganhos, Perdidos, Sem tarefa, Atrasados),
            campos (etapa, responsável, tags, datas, campos personalizados), filtros salvos, Aplicar / Limpar
  states    contagem de filtros ativos no botão da Topbar
  used on   S04, S05, S09, S12
```

```
DateRangePicker
  presets   Hoje, Ontem, Esta semana, Este mês, Personalizado
  calendar  semana começa no domingo (pt-BR); dia selecionado bg accent on-accent; hoje com contorno accent
  a11y      grade com setas; datas como texto acessível
  used on   S07, S16, S17
```

```
StatWidget
  variants  número grande (text display), lista, barras
  parts     título text caps muted, valor, comparação com período anterior (success/danger + seta e texto, não só cor)
  states    carregando (skeleton), vazio ("Sem dados no período"), clicável (leva à lista filtrada)
  used on   S17
```

```
Chart
  lib       Recharts; série principal accent, secundárias stage-3, stage-7, stage-8; won/lost para ganhos e perdas
  a11y      tabela de dados alternativa (botão "Ver como tabela")
  used on   S17, S18
```

```
Calendar
  views     dia, semana (colunas por dia), mês (grade), por pessoa (colunas por responsável)
  event     bloco bg accent-soft, borda esquerda 3px accent, text-sm; atrasada em danger-soft/danger
  used on   S16
```

```
ColorSwatchPicker
  options   stage-1..8 (azuis → preto); won e lost fixos
  a11y      radiogroup com nome da cor ("Azul 3")
  used on   S19
```

```
EmptyState
  parts     ícone Lucide 32px muted (nada de ilustração copiada), título text md, texto curto, ação primária
  used on   todas as listas
```

```
Skeleton
  look      bg canvas com shimmer suave (desliga em prefers-reduced-motion)
  variants  linha, card, tabela, bolha de mensagem
  used on   todas
```
