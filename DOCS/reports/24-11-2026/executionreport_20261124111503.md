# Execution Report

## Documents
- Task report: DOCS/reports/24-11-2026/taskreport_20261124111503.md
- Execution report: DOCS/reports/24-11-2026/executionreport_20261124111503.md
- Explorer report: não gerado
- Plan report: não gerado
- UX report: DOCS/reports/24-11-2026/uxreport_20261124113215.md
- Review report: DOCS/reports/24-11-2026/reviewreport_20261124114651.md

## Sessions
### Orchestrator — abertura — 20261124111503
- Summary: Task Report aprovado pelo Coordenador em 2026-11-24 ("Aprovado, siga"), sem ajustes. Branch `feat/notes-grouping` criada a partir de `feat/mincer` (`fadc94f`), árvore limpa.
- Inputs:
  - DOCS/reports/24-11-2026/taskreport_20261124111503.md
- Decision: sem `explorerAgent` e sem `plannerAgent` (levantamento no Task Report, mudança de uma etapa). Pipeline: `codeAgent` → `uxAgent` → triagem do relatório de UX pelo Orquestrador e `codeAgent` para o que for pertinente → `codereviewAgent` → passada final do `codeAgent`. Sem parada para teste do Coordenador entre o desenvolvimento e a revisão (pedido dele: testa só no final). Modelos: `codeAgent` e `uxAgent` em Sonnet 5.5, `codereviewAgent` em Opus 5.5.
- Next step: `codeAgent` implementa R1–R11 e T1–T3.

### CodeAgent — implementação inicial — 20261124112652
- Summary: R1–R11 e T1–T3 implementados na `Sidebar`. As notas do mesmo tipo viram seções com cabeçalho que abre e fecha (seta, ícone e nome na cor do tipo, contagem), na ordem dos tipos, com "No type" por último; a lista sem nota de tipo existente fica plana. Dentro do grupo a linha da nota perde o nome do tipo. Estado aberto/fechado em `localStorage` por caderno (escopo próprio em "All notes"), com o cabeçalho destacado quando o grupo fechado contém a nota aberta e, com o filtro de texto ativo, todos os grupos abertos e sem seta. "Group by type" entrou no menu de ordem (item marcável, ligado por padrão); "By type" saiu e o `type` salvo é lido como Alphabetical + agrupamento ligado. O arrasto na ordem Manual vale dentro do grupo (soltar sobre nota de outro grupo não faz nada) e entra nas posições do grupo na ordem global, sem mexer nas notas dos outros grupos. `npx tsc --noEmit` limpo; `npm test`: 31 arquivos, 922 testes passando (26 novos em `noteOrder.test.ts`). O app não foi subido: o visual não foi conferido.
- Decisions (margem do Task Report):
  - Agrupamento montado na `Sidebar` sobre a lista que o `App` já entrega (`visibleNotes`, em ordem manual ou A–Z), e não no `App`: a ordem dentro do grupo é a ordem da lista. `sortNotes` perdeu o ramo `type` e o parâmetro `typeOrder`.
  - Estado do agrupamento no `App` (`groupByType`, chave `monet:note-group-by-type`; só `0` desliga, ausente ou inválido liga). Estado dos grupos na `Sidebar`, chave `monet:note-groups-collapsed`, formato `{ escopo: [chaves dos grupos fechados] }`: grupo ausente = aberto, então grupo novo nasce aberto e ids órfãos de tipo ou caderno são ignorados. A `Sidebar` recebe `groupScope` (id do caderno, ou `ALL_NOTES_SCOPE` em "All notes").
  - Cabeçalho = `<li>` com um `<button aria-expanded>`, como no `NotebookTasksSection` (12px/500, seta 10px, 24px de altura), sem recuo nas linhas de baixo. Sem filtro de texto o botão vira `<div>` sem seta. Destaque de R5: fundo `--surface-2` a 60% e texto `--text-secondary`, mais `aria-current` no botão.
  - Um `DndContext` com um `SortableContext` por grupo (grupo fechado não monta o seu). `handleDragEnd` acha o grupo da nota arrastada; se o alvo é de outro grupo, não faz nada; senão reordena o grupo e usa `mergeOrder` sobre a lista visível. A coleta de colisão continua `closestCenter`, sem filtro por grupo.
  - Menu de ordem: "Group by type" (`menuitemcheckbox`) abre a divisória; "Reorder types…" vem logo abaixo, sem divisória própria (a borda que ele tinha passou para o item novo).
  - Dica do modal de tipos ("Reorder types…") dizia "order of “By type”"; agora diz "order of the type groups".
  - `PRD.md` não citava "By type" nem a coluna de anotações; acrescentei um item no inventário de Anotações descrevendo o agrupamento.
- Files changed:
  - src/lib/noteOrder.ts
  - src/App.tsx
  - src/components/Sidebar/Sidebar.tsx
  - src/components/Sidebar/Sidebar.module.css
  - src/components/NoteTypes/NoteTypesModal.tsx
  - DOCS/specs/PRD.md
  - DOCS/reports/24-11-2026/executionreport_20261124111503.md
- Files created:
  - src/lib/noteOrder.test.ts
- Files removed:
  - nenhum (o ramo `type` de `sortNotes` e a opção "By type" saíram dos arquivos acima; nenhuma classe de CSS sobrou: `.rowEyebrow` segue valendo na lista plana)
- Left behind: comportamento visual e de arrasto não conferidos em tela (sem subir o app). Soltar sobre nota de outro grupo é descartado como pede R10, mas perto da fronteira entre grupos o `closestCenter` pode escolher a nota do grupo vizinho e o arrasto não surte efeito; filtrar a colisão pelo grupo seria uma melhoria possível, fora do Task Report. `note_board_study.md` (estudo histórico) ainda cita a ordem "By type"; não alterado.

### Orchestrator — decisão — 20261124113438
- Summary: implementação inicial conferida (diff lido; `npx tsc --noEmit` limpo e os 26 testes de `noteOrder.test.ts` passando, rodados pelo Orquestrador). `uxAgent` concluiu: funcionalidade boa e fiel ao Task Report, com ajustes. Triagem do relatório de UX abaixo.
- Inputs:
  - DOCS/reports/24-11-2026/uxreport_20261124113215.md
- Decision:
  - **Entra agora (`codeAgent`):**
    - U1 (#2 e #9): cabeçalho fechado com a nota aberta ganha um ponto de 6px em `--accent`, `title` "Contains the open note: <título>" e `aria-label` com nome, contagem ("N notes") e "contains the open note".
    - U2 (#3): colisão do arrasto filtrada pelo grupo da nota arrastada; a guarda de alvo fora do grupo fica como rede de segurança.
    - U3 (S1): "Collapse all groups" e "Expand all groups" no menu de ordem, só com a lista agrupada e sem filtro travando; função pura com teste. Sem o Alt+clique.
    - U4 (#1): margem entre grupos de `--space-2` para `--space-1`.
    - U5 (#4): `title`/`aria-label` do botão de ordem dizem ordem e agrupamento; "Group by type" só aparece quando há tipos; dica do modal de tipos cita a lista e o menu "New".
    - U6 (#5): fundo de hover no cabeçalho que é botão.
    - U7 (#6): "No type" reserva o espaço do ícone para alinhar os nomes dos cabeçalhos.
    - U8 (#8): com o filtro por tipo do select ativo, o grupo aparece aberto e travado, como no filtro de texto. Não contraria R7 (o agrupamento segue valendo; o cabeçalho continua lá) e segue a razão de R6: nenhum resultado de filtro fica escondido.
  - **Para o Coordenador decidir no encerramento (contrariam o Task Report):** S2 (mostrar a nota ativa sob o grupo fechado, ou abrir o grupo quando a nota ativa muda por fora; contraria R5) e estado aberto/fechado global por tipo em vez de por caderno (contraria R4).
  - **Fica para depois (backlog):** S3 (cabeçalho fixo ao rolar), S4 (sinal de overdue no cabeçalho fechado), S5 (arrastar para outro grupo troca o tipo; fora do escopo no Task Report), S6 (posição do "No type"), e o recuo fino do nome do cabeçalho em relação ao título (#6, depende de ver em tela).
- Next step: `codeAgent` implementa U1–U8; depois `codereviewAgent`.

### CodeAgent — ajuste de UX (U1–U8) — 20261124113953
- Summary: U1–U8 implementados na `Sidebar`, sem mudar as decisões do Task Report. Cabeçalho do grupo fechado com a nota aberta ganhou ponto de acento de 6px, `title` "Contains the open note: <título>" e `aria-label` "<nome>, <N> note(s)[, contains the open note]" (em todo cabeçalho que é botão). Colisão do arrasto filtrada pelo grupo da nota arrastada (`CollisionDetection` sobre `closestCenter`, com `droppableContainers` filtrados). Menu de ordem com "Collapse all groups" e "Expand all groups" (função pura `setGroupsCollapsed` + 4 testes). Margem entre grupos 4px, hover com fundo no cabeçalho-botão, "No type" reserva os 12px do ícone, filtro por tipo trava os cabeçalhos, botão de ordem com rótulo "Sort and group", "Group by type" só com tipos e dica do modal de tipos citando a lista e o menu "New". `npx tsc --noEmit` limpo; `npm test`: 31 arquivos, 926 testes passando (4 novos). O app não foi subido: o visual e o arrasto não foram conferidos em tela.
- Decisions (margem do pedido):
  - **U1.** O `title` do nome do tipo (para reticências) passou do `<span>` do nome para o cabeçalho inteiro (botão, ou `<div>` quando travado): um `title` no `<span>` esconderia o do botão justo onde o mouse para (sobre o nome). Efeito: no cabeçalho com a nota aberta o tooltip é o da nota; o nome completo continua no `aria-label`. `aria-current` mantido. O `GroupHeader` recebe `activeTitle` (título da nota aberta, 'untitled' se vazio, `null` fora do caso) no lugar do booleano `hasActive`. Sem `aria-label` no `<div>` travado (não é botão).
  - **U2.** `groupCollision` na `Sidebar` (a API do `@dnd-kit/core` 6.3.1 confere: `CollisionDetection` recebe `droppableContainers` e devolve `Collision[]`). Lista plana = um grupo com todas as notas, então o filtro mantém todos os alvos e o resultado é o do `closestCenter` puro. A guarda `newIndex === -1` em `handleDragEnd` ficou como rede de segurança.
  - **U3.** Escolha: os dois itens ficam **sempre visíveis** quando a lista está agrupada e sem filtro travando, e o que não tem efeito fica **desabilitado** (esmaecido): "Expand all groups" com todos abertos, "Collapse all groups" com todos fechados. Motivo: esconder faria o menu mudar de tamanho e os itens de lugar a cada abertura; desabilitado também diz ao usuário o estado atual. Valem só para os grupos presentes na lista (com filtro de subject, os visíveis) e para o escopo atual; chaves de outros grupos do escopo ficam como estão. Sem Alt+clique. `toggleGroup` virou `setGroups(keys, collapsed)`, usado pelo cabeçalho (uma chave) e pelo menu (todas), sobre `setGroupsCollapsed` (usa `setGroupCollapsed`).
  - **U4.** `margin-top` do 2º grupo em diante: `var(--space-2)` → `var(--space-1)`; comentário do CSS atualizado.
  - **U5.** Redação: `title` "Sort and group: Manual, grouped by type" e `aria-label` "sort and group notes: Manual, grouped by type" (o `aria-label` mantém a caixa baixa e o "notes" que ele já tinha); sem agrupamento ou sem tipos: "Sort: Manual" e "sort notes: Manual". O rótulo segue a preferência (`groupByType && noteTypes.length > 0`), não o fato de a lista de agora ter nota tipada. "Group by type" só renderiza com `noteTypes.length > 0`. Como o item agora pode sumir, a divisória do menu deixou de ficar na classe `.sortDivided` (removida) e passou a um seletor de irmão (`[role='menuitemradio'] + .sortItem:not([role='menuitemradio'])`), que põe a borda no primeiro item depois das ordens, seja qual for. Conferido no código que a ordem dos tipos define os dois: `groupNotesByType` usa `noteTypes.map(t => t.id)` e o menu "New" usa `noteTypes.map`, ambos de `noteTypes.types`, ordenado por `sortOrder`, que o "Reorder types…" grava. Dica agora: "…to set the order of the type groups in the notes list and of the types in the “New” menu."
  - **U6.** `button.groupHeader:hover` com `--surface-1` (o fundo do hover das linhas). O cabeçalho destacado mantém o fundo ativo no hover (regra `button.groupHeaderActive, button.groupHeaderActive:hover`), senão o hover o deixaria mais escuro que o estado ativo. `<div>` travado sem hover.
  - **U7.** O `<span>` do ícone é renderizado sempre (vazio em "No type") com `width: 12px`. Recuo do cabeçalho em relação ao título da nota não alterado.
  - **U8.** `groupsLocked = filterActive || typeFilter !== null` (o `typeFilter` que o `App` passa já é o validado, `activeTypeFilter`). Trava = aberto, sem seta, sem clique, sem hover; o estado guardado não muda. Os itens de fechar/abrir todos também somem nesse caso (como no filtro de texto). Filtro de subject não trava.
  - **PRD.** O item da lista de anotações agora cita o ponto e a dica do grupo fechado, o travamento por filtro de texto ou de tipo, "Collapse all groups" / "Expand all groups", "Group by type" só com tipos e o arrasto que não passa para outro grupo.
- Files changed:
  - src/lib/noteOrder.ts
  - src/lib/noteOrder.test.ts
  - src/components/Sidebar/Sidebar.tsx
  - src/components/Sidebar/Sidebar.module.css
  - src/components/NoteTypes/NoteTypesModal.tsx
  - DOCS/specs/PRD.md
  - DOCS/reports/24-11-2026/executionreport_20261124111503.md
- Files created:
  - nenhum
- Files removed:
  - nenhum (saíram a classe `.sortDivided`, a função `toggleGroup` e a prop `hasActive` do `GroupHeader`, trocadas pelo seletor de irmão, por `setGroups` e por `activeTitle`)
- Left behind: nada visual ou de arrasto foi conferido em tela (sem subir o app): ponto de 6px, hover, alinhamento do nome em "No type", altura da lista e "grudar" do arrasto na ponta do grupo ficam para o teste do Coordenador. Não entram, por decisão do Orquestrador: S2 (mostrar a nota ativa sob o grupo fechado ou abrir o grupo), estado global por tipo em vez de por caderno, e S3–S6 e o recuo fino do nome (backlog). "Reorder types…" continua no menu mesmo sem tipos criados (não estava no pedido). Com o tooltip do cabeçalho destacado, o nome completo de um tipo muito longo só aparece no leitor de tela (`aria-label`).

### CodeReviewAgent — 20261124114651
- Summary: R1–R11 e U1–U8 conferidos no código. `npx tsc --noEmit` limpo e `npm test` com 926 testes passando. Nenhum bug que quebre algo. Ficam 6 nits: (1) soltar sobre nota de outro grupo agora reordena o próprio grupo, contra o texto de R10, a confirmar com o Coordenador; (2) cabeçalho travado lido como "Practice 5"; (3) anúncio triplo e nome longo fora do tooltip no cabeçalho com a nota aberta; (4) `disabled` nativo em item de menu; (5) arrasto por grupo sem teste; (6) `collapsed` sombreia a prop.
- Verdict: APROVADO COM RESSALVAS
- Output: DOCS/reports/24-11-2026/reviewreport_20261124114651.md

### Orchestrator — decisão — 20261124114841
- Summary: ajustes U1–U8 conferidos (`npx tsc --noEmit` limpo e `npm test` com 926 testes passando, rodados pelo Orquestrador). `codereviewAgent`: aprovado com ressalvas, seis achados `[nit]`, nenhum bug.
- Inputs:
  - DOCS/reports/24-11-2026/reviewreport_20261124114651.md
- Decision: passada final do `codeAgent`, que decide achado por achado. Orientação do Orquestrador só para o achado 1, por tocar uma decisão do Task Report: o U2 fez o soltar sobre outro grupo reordenar o próprio grupo, e R10 diz que não faz nada. Fica o meio-termo que o review sugere: a nota "gruda" na ponta do grupo só perto da fronteira (tolerância de uma altura de linha além do grupo); mais longe que isso, dentro de outro grupo, não há alvo e soltar não faz nada, como R10 pede. A geometria vira função pura com teste, junto com a extração do achado 5.
- Next step: `codeAgent` faz a passada final; depois encerramento.

### CodeAgent — ajuste final — 20261124115425
- Summary: passada final sobre os seis achados `[nit]` do review: os seis foram ajustados, sem mudar as outras decisões do Task Report. `npx tsc --noEmit` limpo; `npm test`: 31 arquivos, 935 testes passando (9 a mais que antes: 10 novos, 1 migrado). O app não foi subido: o arrasto, o visual e o leitor de tela não foram conferidos em tela.
- Decisions (achado por achado):
  - **1. Arrasto fora do grupo (R10).** Ajustado com o meio-termo do Orquestrador. A colisão (`groupCollision`, na `Sidebar`) agora tem três caminhos: (a) lista plana ou uma seção só (um tipo e nenhuma nota sem tipo): `closestCenter` puro, como antes da task, sem a regra da tolerância (não há outro grupo onde soltar, e soltar bem abaixo da última nota continua indo para o fim); (b) com 2 ou mais seções e o centro do retângulo arrastado perto do grupo da nota: `closestCenter` filtrado pelo grupo (a nota "gruda" na ponta, o que o U2 resolveu); (c) longe: `[]`, o `over` fica nulo e soltar não faz nada. "Perto" = `isNearGroup` (função pura em `noteOrder.ts`): o centro (`collisionRect.top + height/2`) dentro da extensão vertical do grupo (menor topo e maior fundo dos retângulos dos itens em `droppableRects`, o mesmo que "do primeiro ao último" numa lista vertical), com uma altura de linha (`collisionRect.height`) de folga acima e abaixo; as bordas contam. Falta o retângulo de algum item, grupo vazio ou grupo não achado: cai no filtro pelo grupo (ou no `closestCenter`), nunca em "sem alvo". Conferido em `@dnd-kit/sortable` 10.0.0 que `over` nulo não desloca nenhum item (`isValidIndex(overIndex)` falso), então no caso (c) a lista não se mexe durante o arrasto e a nota volta ao lugar ao soltar.
  - **2. Cabeçalho travado lido como "Practice 5".** Ajustado. O projeto não tinha classe visualmente oculta; criei `.srOnly` no `Sidebar.module.css` (módulo local, 8 linhas) e o `<div>` travado ganha `<span className={styles.srOnly}> notes</span>` depois do número (lido "Practice 5 notes"; "note" no singular). Escolha: um texto oculto é o que os leitores de tela anunciam de forma confiável; `aria-label` num `<div>` sem papel não, e dar papel (`heading`, `group`) inventaria uma estrutura que a lista não tem. O botão segue com o `aria-label`.
  - **3. Anúncio triplo e nome longo fora do tooltip.** Ajustado. Saiu o `aria-current` do botão (o `aria-label` já diz "contains the open note", e `aria-current` nomeia a linha da nota) e o `title` passou a `<nome> · Contains the open note: <título>`, o que devolve o nome completo do tipo ao tooltip. O `aria-label` ficou como o U1 definiu; o `title` vira descrição acessível e repete "Contains the open note", mas agora com o título da nota, que o `aria-label` não traz.
  - **4. `disabled` nativo nos itens do menu.** Ajustado. "Collapse all groups" e "Expand all groups" usam `aria-disabled` (em vez de `disabled`) e o `onClick` ignora o clique quando não há efeito (o menu não fecha, como antes). O item continua na ordem do Tab e visível ao leitor de tela. O CSS esmaecido passou de `button:disabled` para `button[aria-disabled='true']` (mesma especificidade do `:hover`, declarado depois, então vence).
  - **5. Arrasto por grupo sem teste.** Ajustado. Em `noteOrder.ts`: `findGroupOf` (acha a seção da nota), `reorderWithinGroup(sections, visibleIds, activeId, overId): string[] | null` (guarda de mesma nota, nota fora da lista e alvo de outro grupo; `arrayMove` no grupo; `mergeOrder` sobre a lista visível) e `isNearGroup`. O `handleDragEnd` da `Sidebar` ficou em quatro linhas e o `groupCollision` só compõe as funções puras. `arrayMove` e `mergeOrder` saíram dos imports da `Sidebar`. O teste antigo "arrastar dentro do grupo preserva…" (que montava o `mergeOrder` à mão) foi migrado para `reorderWithinGroup`. Casos: arrasto dentro do grupo, alvo de outro grupo, mesma nota/nota ou alvo desconhecido, lista plana, grupo fechado no meio; e `isNearGroup`: ponto dentro do grupo, dentro da tolerância (abaixo e acima, com as bordas), além da tolerância, tolerância vinda de fora, retângulo faltando e grupo vazio.
  - **6. `collapsed` sombreando a prop.** Ajustado: `groupCollapsed` no `map` das seções e `collapse` no parâmetro de `setGroups`. A prop `collapsed` do `GroupHeader` fica (é um componente à parte, sem a outra variável no escopo).
  - **Fora desta task, não tocado:** os `div`s de acessibilidade do `DndContext` dentro do `<ul>` (anotado pelo review como anterior à entrega).
  - **PRD.** A frase do arrasto agora diz que perto da fronteira a nota vai para a ponta do próprio grupo e que soltá-la no meio de outro grupo não faz nada.
  - **Roteiro (T3).** Itens 4, 5, 8 e 10 atualizados para o comportamento final.
- Files changed:
  - src/lib/noteOrder.ts
  - src/lib/noteOrder.test.ts
  - src/components/Sidebar/Sidebar.tsx
  - src/components/Sidebar/Sidebar.module.css
  - DOCS/specs/PRD.md
  - DOCS/reports/24-11-2026/executionreport_20261124111503.md
- Files created:
  - nenhum
- Files removed:
  - nenhum (saíram os imports `arrayMove` e `mergeOrder` da `Sidebar` e o `aria-current` do cabeçalho; o `disabled` virou `aria-disabled`)
- Left behind:
  - Nada do arrasto, do visual nem do leitor de tela foi conferido em tela (sem subir o app): onde exatamente o "gruda" vira "não faz nada" (uma altura de linha além da ponta do grupo) fica para o roteiro, item 8.
  - Consequência da regra literal "perto = extensão do grupo ± uma linha": com 2 ou mais grupos, soltar bem além da ponta da lista (acima do primeiro grupo ou abaixo do último, a mais de uma linha) também não faz nada, porque está longe do grupo. Antes (U2) a nota ia para a ponta. Não é "dentro de outro grupo", mas a regra não distingue. Se incomodar no uso, o ajuste é não aplicar a tolerância na borda externa da lista (decisão do Orquestrador/Coordenador).
  - Com um grupo fechado entre dois abertos, o cabeçalho fechado (24px, sem retângulo) e o seguinte ficam na zona de tolerância ou logo além; o corte depende da altura da nota arrastada. Visual, para o teste.
  - Com um único tipo e nenhuma nota sem tipo (uma seção com cabeçalho), o arrasto é o de sempre, sem a regra: não existe outro grupo onde soltar.
  - Os `div`s de acessibilidade do `DndContext` dentro do `<ul>` (HTML inválido, já existia) seguem como estão.

### Orchestrator — encerramento — 20261124115645
- Summary: passada final do `codeAgent` conferida; os seis achados do review foram ajustados. O Orquestrador fez um ajuste a mais, pequeno, para fechar a lacuna que a própria orientação do achado 1 abriu (o "Left behind" da sessão acima sobre a ponta da lista): `isNearGroup` ganhou o parâmetro `open`, e a `Sidebar` deixa sem limite o lado de cima do primeiro grupo e o de baixo do último, então soltar além da ponta da lista leva a nota para a ponta do próprio grupo, como antes. Um teste novo cobre isso. Estado final: `npx tsc --noEmit` limpo e `npm test` com 31 arquivos e 936 testes passando. Sem commit e sem push. O app não foi subido em nenhuma etapa: visual e arrasto real ficam para o teste do Coordenador (roteiro abaixo).
- Inputs:
  - DOCS/reports/24-11-2026/reviewreport_20261124114651.md
  - DOCS/reports/24-11-2026/uxreport_20261124113215.md
- Decision: task encerrada do lado do pipeline. Mudanças em relação ao Task Report, para o Coordenador conferir no teste:
  - R10: soltar sobre outro grupo continua sem efeito no meio do outro grupo, mas perto da fronteira (até uma altura de linha) e além da ponta da lista a nota vai para a ponta do próprio grupo.
  - R7: com o filtro por tipo ativo, o grupo aparece aberto e travado (U8), como no filtro de texto.
  - Extras que vieram do relatório de UX: "Collapse all groups" e "Expand all groups" no menu de ordem; ponto e dica no grupo fechado com a nota aberta; "Group by type" só aparece quando há tipos.
- Pendências registradas em `DOCS/backlog.md` (Ideias): duas decisões do Coordenador (S2, mostrar a nota aberta sob o grupo fechado; estado global por tipo em vez de por caderno) e as sugestões S3–S6, mais o recuo fino do cabeçalho. O ponto antigo dos `div`s do `DndContext` dentro do `<ul>` também foi para o backlog.
- Next step: aguardando o teste do Coordenador.

## Roteiro de teste (T3)
Para o Coordenador, no app dev (`npm run tauri:dev`). Mantenha esta seção no fim do relatório.

1. **Grupos.** Abra um caderno com notas de dois ou mais tipos e algumas sem tipo. Esperado: uma seção por tipo na ordem de "Reorder types…", "No type" por último, contagem em cada cabeçalho e nenhuma linha de tipo acima dos títulos. O nome de "No type" começa na mesma coluna dos nomes dos outros cabeçalhos (o espaço do ícone é reservado), e o respiro entre um grupo e o seguinte é pequeno (4px). Passe o mouse num cabeçalho: ele ganha o mesmo fundo de hover das linhas de nota. Caderno só com notas sem tipo: lista plana, sem cabeçalho. Caderno com um tipo só: um cabeçalho.
2. **Abrir e fechar.** Clique no cabeçalho, ou use Tab e Enter/Espaço: a seta troca e as notas somem ou voltam. Feche o app e abra de novo: o estado se mantém. Outro caderno e "All notes" têm cada um o seu estado.
3. **Fechar e abrir todos.** No menu de ordem (ícone ArrowsDownUp), logo abaixo de "Group by type", há "Collapse all groups" e "Expand all groups". "Collapse all groups" fecha todos os grupos da lista; "Expand all groups" abre todos. Com tudo aberto, "Expand all groups" fica esmaecido e sem clique; com tudo fechado, é "Collapse all groups" que fica assim. Vale só para o caderno aberto (outro caderno não muda; "All notes" tem o seu estado) e o estado se mantém ao reiniciar. Com um subject escolhido no select, vale para os grupos que estão na lista. Os dois itens não aparecem com a lista plana nem com filtro (texto ou tipo) travando os cabeçalhos.
4. **Nota aberta num grupo fechado.** Feche o grupo da nota aberta: o cabeçalho ganha o destaque discreto **e um ponto roxo de 6px entre o nome e a contagem**, e o grupo continua fechado. Passe o mouse: o destaque não some e o tooltip diz "<Tipo> · Contains the open note: <título>" ("untitled" se a nota não tem título). Com leitor de tela, o botão é lido como "<Tipo>, N notes, contains the open note". Crie uma nota nesse grupo: segue fechado, a contagem sobe e o ponto aparece. Abra uma nota de outro grupo: o ponto sai do cabeçalho anterior.
5. **Filtros.** Texto: digite na busca da Toolbar e todos os grupos abrem, sem seta, sem clique e sem hover, com a contagem seguindo os resultados; limpe o filtro e voltam ao estado guardado. Tipo: escolha um tipo no select do cabeçalho: o grupo aparece aberto e travado (sem seta, clique ou hover), mesmo que estivesse fechado; volte para "All" e o estado guardado volta. Subject: escolha um subject: os grupos continuam com seta e clique (o filtro de subject não trava). Com leitor de tela, o cabeçalho travado é lido com "notes" depois do número ("<Tipo> 5 notes").
6. **Menu de ordem.** Esperado: Manual, Alphabetical (A–Z), "Group by type" marcado, "Collapse all groups", "Expand all groups" e "Reorder types…", com uma divisória depois das duas ordens. Não existe "By type". Passe o mouse no ícone do menu: "Sort and group: Manual, grouped by type". Desmarque "Group by type": lista plana como antes, com o tipo acima do título, os dois itens de fechar/abrir somem e o tooltip vira "Sort: Manual". Marque de novo. Opcional, num app dev sem nenhum tipo criado: "Group by type" não aparece no menu.
7. **Alphabetical.** Notas A–Z dentro de cada grupo, sem alça de arrastar.
8. **Arrasto (Manual).** Arraste uma nota dentro do grupo: funciona. **Perto da fronteira, a nota gruda na ponta do próprio grupo:** arraste a última nota de um grupo para baixo, só um pouco além do fim do grupo (o centro da nota a até uma altura de linha da última nota, na prática sobre o cabeçalho do grupo seguinte e o topo da primeira nota dele) e solte: ela fica na última posição do próprio grupo (não volta ao lugar sem efeito), o grupo vizinho não se mexe e o tipo não muda. Faça o mesmo para cima com a primeira nota de um grupo. **Longe da fronteira, no meio de outro grupo, não faz nada:** arraste a mesma nota bem mais fundo, sobre as notas do grupo seguinte, e solte: a nota volta ao lugar, a ordem não muda, o tipo não muda, e as notas do outro grupo não se deslocam durante o arrasto. **Além da ponta da lista, a nota vai para a ponta:** arraste uma nota do último grupo bem para baixo do fim da lista (ou uma do primeiro grupo bem para cima do começo) e solte: ela fica na última (ou na primeira) posição do próprio grupo. Com um grupo fechado no meio, arraste outra nota, desligue "Group by type" e confira que as notas escondidas mantiveram a posição relativa. Com "Group by type" desligado (lista plana) e com um tipo só na lista (sem outro grupo), o arrasto é o de sempre, entre quaisquer notas, mesmo soltando bem além da última.
9. **Tipos.** Troque o tipo de uma nota: ela muda de grupo na hora e o grupo que esvazia some. Renomeie, recolora e reordene um tipo no modal ("Reorder types…"): cabeçalhos e ordem dos grupos acompanham. A dica do modal diz que a ordem vale para os grupos da lista de notas e para o menu "New"; confira que o menu "New" (seta ao lado do "+") segue a mesma ordem. Apague um tipo em uso: as notas vão para "No type".
10. **Detalhes.** Nome de tipo longo: reticências e tooltip com o nome (também no cabeçalho com a nota aberta, que mostra "<Tipo> · Contains the open note: …"). Todos os grupos fechados: a seção Tasks e o rodapé "Archived · N" ficam no lugar. Coluna recolhida e coluna larga (cadernos ocultos): sem mudança.
