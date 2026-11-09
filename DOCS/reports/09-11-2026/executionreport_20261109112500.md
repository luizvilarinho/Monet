# Execution Report

## Documents
- Task report: DOCS/reports/09-11-2026/taskreport_20261109112500.md
- Execution report: DOCS/reports/09-11-2026/executionreport_20261109112500.md
- Explorer report: DOCS/reports/09-11-2026/explorerreport_20261109110910.md
- Plan report: não gerado
- UX report: DOCS/reports/09-11-2026/uxreport_20261109114510.md
- Review report: DOCS/reports/09-11-2026/reviewreport_20261109121659.md

## Sessions
### Orchestrator — abertura — 20261109112500
- Summary: o Coordenador aprovou a implementação no próprio pedido ("Implemente esse recurso com as recomendações feitas por você") e pediu o fluxo implementação → uxAgent → triagem → code review, testando só no final. Branch `feat/open-notes` criada a partir de `feat/mincer`.
- Inputs:
  - DOCS/reports/09-11-2026/explorerreport_20261109110910.md
- Decision: o Orquestrador implementa direto, porque já tem o mapeamento do explorer. O uxAgent e o codereviewAgent rodam como subagentes. Sem planner: o explorer já decompôs a task.
- Next step: implementação.

### CodeAgent (Orquestrador) — implementação inicial — 20261109121500
- Summary:
  - Aba **Open** na coluna da direita (AI | Chat | Open): cards das notas abertas hoje, a mais recente primeiro (título, caderno, hora, "On the side", "Archived"). O clique abre a nota na área principal, trocando de caderno. O ícone abre na lateral e o X tira da lista. A lista fica em `localStorage` e zera na virada do dia. Ficam fora a nota-corpo de task, a Quick Note em branco e a nota apagada.
  - **Alt+←**: vai para a última nota aberta antes da atual. Repetir alterna entre as duas. Só no modo Notebook, sem modal aberto e com `preventDefault` sempre (no WebView2 a tecla é o "voltar").
  - **Cursor e rolagem por nota** (`viewStateKey` no Editor): gravados a cada mudança de seleção ou rolagem, só em memória. Na montagem, restauram a posição e põem o foco no editor no quadro seguinte (o EditorContent move o DOM na montagem e o foco dado antes se perdia). O foco não é tirado de quem está digitando, e um pedido de marca pendente tem prioridade.
  - **Nota lateral**: editor sem slash, sem handles de bloco e sem Related, como no Reader. Usa as respostas de IA salvas da nota (`useNoteResponses`) e um contexto de tasks com "nota atual" = lateral. Grava sobre a base da memória (`notesRef`). Tem "← Open notes" e "Open in main". A coluna usa uma largura larga própria (padrão 40% da janela, até 60%, redimensionável e salva em `monet:side-note-width`) e volta à largura anterior ao fechar.
  - **Mesma nota nos dois lados**: se a principal vira a nota da lateral (card, Alt+←, lista, link, "Open in main"), a lateral fica com a principal anterior. Se a anterior for uma nota-corpo de task, a lateral fecha. O botão de abrir na lateral some na nota principal.
  - **Ctrl+F**: responde o editor que tem o foco (raiz `.editor` ou modal); sem foco em nenhum, a nota lateral não responde.
- Verificação:
  - `tsc --noEmit` OK.
  - Harness no scratchpad (Vite à parte + Edge headless via CDP, com teclado e mouse reais), montando o Editor, o AiPanel e os componentes novos com a mesma ligação do App. Conferido: ordem dos cards, Alt+← (vai, volta e alterna), rolagem e cursor restaurados com foco (a digitação entra no ponto salvo), abrir na lateral (coluna de 300 → 550 px, foco e rolagem da nota), digitação só na lateral, Ctrl+F só na lateral, "Open in main" troca as notas, a lista principal → nota da lateral troca de volta, e "Open notes" volta à lista e à largura normal.
  - O App inteiro não roda fora do Tauri; a ligação no `App.tsx` foi conferida por leitura.
- Files changed:
  - src/App.tsx
  - src/components/AiPanel/AiPanel.tsx
  - src/components/AiPanel/AiPanel.module.css
  - src/components/Editor/Editor.tsx
- Files created:
  - src/lib/openNotes.ts
  - src/hooks/useOpenNotes.ts
  - src/hooks/useNoteResponses.ts
  - src/components/Editor/editorViewState.ts
  - src/components/OpenNotes/OpenNotesPanel.tsx
  - src/components/OpenNotes/SideNotePanel.tsx
  - src/components/OpenNotes/OpenNotes.module.css
- Files removed: nenhum
- Left behind: abrir na lateral pelo Ctrl+P ou por Ctrl+clique em link (citado no "como funcionaria" do explorer) não entrou; fica para a triagem do uxAgent.

### UxAgent — 20261109114510
- Summary: feature boa, com ressalvas. Os pontos mais pesados: aberturas automáticas (1ª nota do caderno/subject) sujam a lista e o Alt+←; abrir na lateral só pelo card; a IA derruba a lateral ao trocar de aba; a coluna larga aperta a principal na janela de 1280 px.
- Output: DOCS/reports/09-11-2026/uxreport_20261109114510.md

### Orchestrator — triagem do UX report — 20261109124000
- Aplicado:
  - #1 (Alta) aberturas automáticas: a 1ª nota aberta sozinha ao escolher caderno, subject ou o caderno Calendar só entra na lista depois de 3 s na tela ou de um clique/tecla no editor principal. A nota "de passagem" a caminho de outra não entra e o Alt+← não cai nela. Clique na lista de notas, card, Ctrl+P e link registram na hora.
  - #2 (Alta) abrir na lateral pelo Ctrl+P: Alt+Enter (ou Alt+clique) numa nota abre na lateral, com dica no rodapé da palette. A palette sem a prop (fora do modo Notebook ou sem nota principal) não muda.
  - #4 (Média) largura: a coluna larga se limita ao espaço que divide com a nota principal, deixando a principal com pelo menos 480 px (medido no layout e refeito quando a janela muda). Abaixo disso a coluna fica no mínimo de 300 px dela. O arrasto parte da largura mostrada.
  - #5 (Média) links e "Edit linked note" dentro da nota lateral abrem na lateral; a principal só muda por "Swap with main". Link para a nota principal ou para nota-corpo de task segue o caminho normal.
  - #6 (Média) "Side" (ícone + rótulo) sempre visível no card; só o X fica no hover.
  - #7 (Média) foco: abrir na lateral (card ou Ctrl+P) devolve o foco ao cursor da principal, sem rolar; o editor lateral restaura cursor e rolagem sem tomar o foco (`restoreFocus={false}`). Para escrever na lateral, clica nela.
  - #8 estados primeiro no card ("Current · On the side · Archived · caderno · hora").
  - #9 sem X no card da nota atual.
  - #10 rótulos: "Swap with main" e "Close" no cabeçalho da lateral (com tooltip do efeito); dica "Alt+← last note"; tooltip na aba Open citando o atalho.
  - #11 ponto na aba Open quando há nota lateral e outra aba está à vista.
  - Filtro extra: card de nota sem caderno sai da lista (o clique não teria para onde ir).
- Não aplicado (decisão do Orquestrador):
  - #3 a IA continua trocando de aba ao rodar slash ou "Ask AI": a resposta precisa aparecer. A nota lateral não fecha (o `sideNoteId` fica); volta com cursor e rolagem pela aba Open, que ganha o ponto (#11).
  - Recolher cadernos/lista para abrir espaço (#4): fica o limite pela largura; recolher colunas mexe no layout fora da feature.
  - Marca visual do editor ativo e atalho para alternar o foco (oportunidade 3): com o foco voltando à principal, fica para depois do uso real.
  - "Link in main" e citar trecho da lateral (oportunidades 2 e 5): funcionalidades novas, fora do escopo.
- Para o Coordenador (contrariam decisões do Task Report):
  - Pinned (notas fixas que sobrevivem à meia-noite) × decisão #6 (lista zera na virada do dia).
  - Trava de edição na lateral × decisão #3 (segunda nota editável).
  - Lateral como coluna própria × decisões #1/#3 (aba única na coluna da direita).
- Verificação:
  - `tsc --noEmit` OK.
  - Harness (Edge headless via CDP, mouse e teclado reais): nota aberta sozinha e deixada em menos de 3 s não entra na lista e o Alt+← volta à nota anterior; com 3 s de permanência ou clique no editor ela entra; tecla com foco fora do editor não conta. Ctrl+P → "Gamma" → Alt+Enter abre na lateral, fecha a palette, mantém a aba Open e o foco na principal; o texto digitado em seguida entra na principal, no mesmo ponto. "Side" no card idem. "Edit linked note" na lateral troca só a lateral. Aba AI com lateral aberta: coluna volta a 300 px e a aba Open mostra o ponto. Larguras (lista de 400 px no harness): janela 1280 → coluna 400 / principal 480; 1700 → 550 / 750; 1100 → 300 (mínimo) / 400.
- Files changed:
  - src/App.tsx
  - src/components/AiPanel/AiPanel.tsx
  - src/components/AiPanel/AiPanel.module.css
  - src/components/Editor/Editor.tsx
  - src/components/OpenNotes/OpenNotesPanel.tsx
  - src/components/OpenNotes/SideNotePanel.tsx
  - src/components/OpenNotes/OpenNotes.module.css
  - src/components/SearchPalette/SearchPalette.tsx
  - src/components/SearchPalette/SearchPalette.module.css
- Files created: nenhum
- Files removed: nenhum
- Left behind: abrir na lateral pela lista de notas (ícone de hover) não entrou; a lista já tem 5 ícones e o Ctrl+P cobre o caso. Painel da direita recolhido com nota lateral aberta: a lateral continua aberta e invisível (o ponto não aparece com o painel fechado).

### CodeReviewAgent — 20261109121659
- Summary: sem bug crítico; `tsc` OK e sem código morto. Dois pontos importantes. (1) Qualquer tecla no editor principal, inclusive atalhos como Ctrl+P, registra a nota aberta sozinha (App.tsx:1568-1573), e o Alt+← volta a cair nela no fluxo do UX #1. (2) O teto de largura da lateral não é recalculado quando cadernos, lista ou modo foco mudam a largura da principal (AiPanel.tsx:164-179). Mais 8 nits: `lastWidth` compartilhado entre as duas larguras, seletor do Ctrl+F pelo nome do CSS Module, `NodeSelection` restaurada como `TextSelection`, `onOpenTodos` da lateral troca a principal, nota aberta só na lateral não entra na lista, respostas em streaming paradas na lateral, `4px` sem token na palette, `aria-label` em `span`.
- Verdict: APROVADO COM RESSALVAS
- Output: DOCS/reports/09-11-2026/reviewreport_20261109121659.md


### CodeAgent (Orquestrador) — ajustes da review — 20261109123500
- Summary:
  - #1 a nota aberta sozinha não se registra mais por atalho: teclas com Ctrl/Alt/Meta ou só modificador não contam como interação (o Ctrl+P a caminho de outra nota deixava a nota de passagem na lista).
  - #2 o teto da coluna larga é medido também quando a nota principal muda de largura (colunas da esquerda recolhidas ou arrastadas) ou é trocada (`MutationObserver` nos filhos do workspace + `ResizeObserver` na principal).
  - #3 clique na alça sem arrastar não grava largura (corrige também o bug antigo que gravava 300 em `monet:ai-width`).
  - #4 Ctrl+F acha o editor por `[data-note-editor]`, não pela classe gerada do CSS Module.
  - #5 restauração do cursor com `Selection.near` (posição salva de bloco selecionado caía entre blocos).
  - #6 abrir a TODOS a partir da nota lateral navega na lateral.
  - #7 a nota aberta na lateral também entra na aba Open (dá para reabrir depois de fechar a lateral).
  - #9 token no padding do `kbd` da palette; #10 `role="img"` no ponto da aba Open.
  - Não aplicado: #8 (respostas de IA lidas uma vez por nota na lateral). A lateral não roda IA; uma resposta em streaming na principal aparece na lateral ao reabrir a nota. Fica para o uso real.
- Verificação: `tsc --noEmit` OK. Harness via CDP: nota aberta sozinha com cursor salvo + Ctrl+P → outra nota não entra na lista e o Alt+← volta à anterior; nota aberta na lateral sobe na lista; lista do harness com 200 px → coluna 550 / principal 530, com 500 px → coluna 300 / principal 480; clique na alça sem arrasto não grava nada no `localStorage`.
- Files changed:
  - src/App.tsx
  - src/hooks/useOpenNotes.ts
  - src/components/AiPanel/AiPanel.tsx
  - src/components/Editor/Editor.tsx
  - src/components/SearchPalette/SearchPalette.module.css
- Files created: nenhum
- Files removed: nenhum
- Left behind: nada da review além do #8.

### CodeAgent (Orquestrador) — cards no formato do Related content — 20261109124000
- Summary: a pedido do Coordenador, os cards de "Opened today" seguem o card do Related content: tipo da nota (`TypeEyebrow`, na cor do tipo) e caderno, título em negrito, prévia de 2 linhas e tags. Embaixo, uma linha com estado e hora ("Current · On the side · Archived · 12:37") e as ações "Side" e X. A lista virou grade de até 2 colunas (coluna mínima de 200 px): 1 coluna na largura padrão do painel (300 px) e 2 a partir de cerca de 440 px. A prévia é memorizada por nota (digitar na principal com a aba à vista não reprocessa as outras).
- Verificação: `tsc --noEmit` OK. Harness (Edge headless): painel de 300 px → 1 coluna com cards de 275 px; painel de 520 px → 2 colunas de 244 px. Tipo, caderno, prévia, tags e estado conferidos no screenshot.
- Files changed:
  - src/App.tsx
  - src/components/OpenNotes/OpenNotesPanel.tsx
  - src/components/OpenNotes/OpenNotes.module.css
- Files created: nenhum
- Files removed: nenhum
- Left behind: nada.
