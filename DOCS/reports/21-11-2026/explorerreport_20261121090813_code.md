# Explorer Report (código) — visão Projeto × entrega e visão do mês em Tasks

Task Report: `DOCS/reports/21-11-2026/taskreport_20261121085551.md` (R4 e insumos para os mockups).
Somente leitura do código. O app não foi executado: as alturas e larguras abaixo foram calculadas pelo CSS, não medidas na tela.

## Resumo

**Problema.** Tasks tem 7 visões, cada uma com um eixo só. O Coordenador pede duas novas: uma matriz Projeto × Deadline e um mês com arrasto que muda o do date. A pergunta deste relatório é o que o código já entrega para as duas e o que precisa ser escrito.

**Veredito.** As duas são viáveis sem mexer no banco, no Rust nem no modelo de `Task`.

| Visão | Dificuldade | Mínimo viável | Com os extras |
| --- | --- | --- | --- |
| Month | **Média** | M | G |
| Projeto × entrega | **Média** (Baixa se for só leitura) | P–M (leitura) / M (arrasto de deadline) | M–G |

**O que se reaproveita sem mudança:** `TasksHeader` inteira, `useTaskKeyboard` (cursor, seleção, atalhos), `useTaskActions` (`reschedule` com "Move deadline too", Undo), `TaskBatchBar`, `useCardDrag` (um card, chave de drop livre), o modal da task, visões salvas, a persistência da visão ativa e quase todas as regras de data de `lib/tasks.ts`.

**O que é novo:** dois componentes de visão (a casca `BoardView` não serve, ver item 1), uma **linha compacta de task** (nenhum card atual serve, ver item 4), 6 a 8 funções puras em `lib/tasks.ts` com testes e, na matriz, uma ação de "mudar o deadline" que hoje não existe em lote nem por arrasto.

**Três pontos em que discordo da hipótese inicial ou que mudam o desenho:**
1. **Mês de calendário desperdiça a tela.** Pelas regras do Week, dia passado só mostra task concluída e não aceita drop (item 5). Novembro de 2026 ocupa 6 linhas numa grade seg–dom (o dia 1 cai num domingo e o 30 numa segunda); hoje, 21/11, três estão inteiras no passado e a quarta quase toda. Uma janela de semanas a partir da semana atual (4 a 5 semanas) usa melhor o espaço. Fica para o uxAgent decidir.
2. **Falta altura.** A `TasksHeader` ocupa cerca de 190px. Na janela padrão (1280×800) sobram cerca de 480px para a grade: 2 linhas de task por dia num mês de 6 semanas (item 8).
3. **Na matriz, o arrasto deve mudar só o deadline, não o projeto.** Mudar de projeto move a nota-corpo e é assíncrono (item 7); num arrasto em diagonal isso acontece sem querer.

---

## 1. Entrada de uma visão nova

| Ponto | Onde | O que fazer |
| --- | --- | --- |
| Registro | `src/components/TasksView/views.ts:10-18` | Uma entrada por visão (`id`, `label`, `title`). |
| Menu | `ViewMenu.tsx:72-87` | Nada: lista `TASK_VIEWS`. O rótulo do botão também sai de lá (`ViewMenu.tsx:26`). O botão tem `max-width: 140px` (`ViewMenu.module.css:10`). |
| Montagem | `src/App.tsx:4800-4848` | Um ramo novo por visão, **antes** do `tasksBoardOpen ? <WeekBoard …>` da linha 4830. Esse ramo é o resto da cadeia: um id novo sem ramo próprio abre o Week, sem erro. |
| Área cheia | `App.tsx:1179`, `1199`, `5026` | Nada: qualquer visão diferente de `list` ocupa a área da lista e do editor, e a task abre em modal (`openTaskModal`, `App.tsx:1126-1132`). No modo foco o board não aparece. |
| Visão ativa | `App.tsx:642-659` | Nada: `localStorage['monet:tasks-main-view']`, validado por `resolveMainView` (`views.ts:27-30`). Build antigo lendo um id novo cai em List. |
| Visões salvas | `types/index.ts:67-73`, `App.tsx:4225-4244`, `4261-4271`, `storage/tauri.ts:429-447` | Nada: `base` é string livre e passa por `resolveMainView`. |
| `EPHEMERAL_VIEW` | `views.ts:23` | Nada: só `review` não é lembrada. |
| Atalhos | `TaskShortcuts.tsx:12-32` | Só se entrarem teclas novas (lista estática). |

**Estado próprio da visão não entra na visão salva.** `TaskViewConfig` tem 5 campos (`base`, `project`, `summary`, `text`, `groupBy`) e a visão salva "ativa" é a que coincide nesses 5 (`App.tsx:4236-4244`). O Week guarda a semana em estado local (`WeekBoard.tsx:121`, volta para a semana atual ao abrir) e o "Hide weekends" em `localStorage` (`WeekBoard.tsx:58`, `93-101`). O mês exibido e opções como "linhas por TODOS" seguiriam o mesmo caminho. Para salvar essas opções seria preciso estender `TaskViewConfig`, o `rowToTaskView` (que reconstrói a config só com os 5 campos e descarta o resto) e a comparação. A coluna `task_views.config` é JSON (`storage/tauri.ts:570-575`), então não há migração.

**Controles próprios no topo: sim.** O Week monta `TasksHeader` + `weekNav` dentro de `styles.top` (`WeekBoard.tsx:313-370`). Já a `BoardView` não tem slot para isso e o conteúdo dela é fixo em `BoardColumns` (`BoardView.tsx:105-150`). As duas visões novas não são "colunas de cards", então **cada uma é um componente próprio no molde do `WeekBoard`** (443 linhas), reaproveitando as classes `.board`, `.top`, `.weekNav`, `.navBtn`, `.thisWeek` de `WeekBoard.module.css` (a `BoardView` já importa esse CSS, `BoardView.tsx:17-18`).

**O que a `TasksHeader` dá de graça** (`TasksHeader.tsx:85-102`): menu de visão, engrenagem de status, filtro de projeto, chips de resumo com a barra da semana, busca (`/` e Ctrl+F focam `[data-tasks-search]`), quick add com tokens e seletor de projeto, aviso "Added … Open" e o diálogo de atalhos. A visão só precisa repetir três `useMemo` (`WeekBoard.tsx:154-162`): `filterTasksForView` → `computeTaskSummary` → filtro do chip com `summaryMatches`.

Dois cuidados:
- Os chips de resumo são pelo **plano** (`summaryMatches`, `lib/tasks.ts:481-512`). Na matriz por deadline, uma coluna "Overdue" (deadline estourado) não bate com o número do chip Overdue (que soma Overdue e Slipped pelo plano e tira os replanejados).
- O quick add não tem "criar neste dia": a data vem do token digitado. Clicar num dia para criar seria novo (o Calendar tem o "+ Task" do dia, `CalendarView.tsx:681-723`).

---

## 2. Teclado e ações

**API de reagendar** (`useTaskActions.ts:54-83`, `useTaskKeyboard.ts:118-123`):

| Chamada | Uso |
| --- | --- |
| `kb.actions.reschedule([{ id, date }], verb)` | Uma ou várias tasks, cada uma com a sua data (`null` limpa o do date). É o que o arrasto do Week chama (`WeekBoard.tsx:261`). |
| `kb.schedule(key, ids?)` | Mesma data para a seleção ou para os ids dados (`TasksView.tsx:279`, "Move all to today"). |
| `kb.actions.update(changes, verb)` | Patch livre em várias tasks, com Undo. |
| `kb.actions.track(verb, ids, run)` | Ação própria com Undo (é como os boards registram o drop, `BoardView.tsx:125`). |

**"Move deadline too / Keep deadline":** uma pergunta só para o conjunto, e só para tasks cujo deadline **já passou** e que vão para hoje ou depois (`deadlinePassedFor`, `lib/tasks.ts:212-214`). A escolha vale para todas; Cancel não muda nada. Com várias tasks a mensagem é "N of these tasks have a deadline that has already passed…" (`useTaskActions.ts:63-66`).

**Undo:** um nível, 6 segundos (`useTaskActions.ts:11`, `35-39`). Restaura status, do date, deadline, My Day, TODOS, important, contagem de adiamentos (`UNDO_FIELDS`, `lib/tasks.ts:188-199`), devolve a task ao projeto anterior e apaga a ocorrência gerada de uma recorrente (`useTaskActions.ts:86-105`).

**`TaskBatchBar`** (`TaskBatchBar.tsx:23-62`): Today, Tomorrow, Next week, Pick date…, Done, Drop, Delete permanently…, Clear. Todas as datas gravam o **do date**.

**O que não existe:**
- **Mudar o deadline em lote ou por atalho.** Só pelo campo "Deadline" da task aberta (`TaskFields.tsx:105-117`). Dá para fazer com `kb.actions.update(ids.map(id => ({ id, patch: { dueDate } })), 'deadline moved')`, e o Undo já cobre `dueDate`. O popover de data do lote está preso ao do date (`TaskBatchBar.tsx:66-75`, `130`); precisa de um parâmetro.
- **Mudar o projeto em lote.** `onMoveTaskToProject(taskId, notebookId)` é uma task por vez (`TasksEnv.tsx:28`, `App.tsx:4280`).

**Dois efeitos das regras atuais que pesam nas visões novas:**
- **Mudar o deadline conta como adiamento em qualquer direção.** `applyTaskPatch` soma 1 em `rescheduleCount` sempre que um deadline vira outro, mesmo **antecipando** (`lib/tasks.ts:157-163`); no do date só conta quando vai para depois (`166-173`). Na matriz, cada arrasto de deadline somaria "Postponed N×", e o chip fica vermelho a partir de 3 (`TaskCard.tsx:333-341`). Mudar a regra afeta todas as visões. É decisão do Coordenador.
- **Do date depois de um deadline futuro não pergunta nada.** É "permitido, só sinalizado" (`scheduledAfterDeadline`, `lib/tasks.ts:319-322`), e o aviso "After deadline" só aparece nos campos da task aberta (`TaskFields.tsx:102`), não nos cards. No mês, soltar depois do deadline será muito mais comum que no Week. A linha compacta precisa desse sinal.

**Navegação.** `orderedIds` é uma lista achatada (`useTaskKeyboard.ts:35-36`); ↑/↓ andam por ela e ←/→ **não são tratadas** (`useTaskKeyboard.ts:192-196`). No Week a lista é coluna a coluna (`WeekBoard.tsx:240-247`), então ↓ no fim da segunda cai na terça. Numa grade 2D isso funciona sem mudança, só que sem geometria. Para um 2D de verdade faltam:
- uma opção nova no hook, por exemplo `navigate(id, tecla) => id | null`, com o comportamento atual como padrão (o hook serve 6 visões: List, Week e os 4 boards);
- uma função pura de vizinhança (célula ao lado, célula de baixo) em `lib/tasks.ts`;
- a linha compacta precisa de `data-task-id` e `tabIndex={0}`: o cursor acha e foca a linha por esse atributo (`useTaskKeyboard.ts:80-81`, `173-175`).

Shift+clique seleciona o intervalo pela ordem linear (`useTaskKeyboard.ts:258-265`); numa grade seguiria assim. `Alt` está livre: o handler sai cedo com `e.altKey` (`useTaskKeyboard.ts:179`).

**Atalhos atuais** (`TaskShortcuts.tsx:12-32`): ↑/↓ cursor (Shift estende) · Enter abre · Esc limpa a seleção · `x` concluir/reabrir · `s` próximo status · `t` do date hoje · `d` escolher do date · `p` My Day · `z` adia 1 dia · `Shift+z` adia 1 semana · Delete descarta · `/` ou Ctrl+F busca · `?` lista. Ctrl+clique soma à seleção, Shift+clique seleciona o intervalo. Todos funcionam nas visões novas sem código; `z` e `Shift+z` já movem a task de célula no mês.

---

## 3. Arrasto (`useCardDrag.ts`, 102 linhas)

O hook devolve `{ draggingId, overKey, onCardMouseDown }` e chama `onDrop(id, dropKey)` (`useCardDrag.ts:9`, `73`). Consumidores: Week, os 4 boards via `BoardColumns` e o board de notas (`NoteBoard.tsx:397`).

| Necessidade | O que falta | Mudança | Esforço |
| --- | --- | --- | --- |
| (i) Arrastar várias selecionadas | A lógica cabe na visão, sem tocar no hook: no `onDrop`, se o id arrastado está em `kb.selectedIds`, aplicar a todas (`reschedule` já aceita N). A seleção sobrevive ao arrasto porque o clique depois do drop é engolido (`useCardDrag.ts:69-72`). Falta só o visual: o fantasma é o clone de um card (`useCardDrag.ts:41-52`) e `draggingId` é um id só. | Opção no hook para um selo "3 tasks" no fantasma (~15 linhas, compatível) + esmaecer as selecionadas na visão. | **P** |
| (ii) Auto-scroll | Não há. O `onMove` só roda no `mousemove` (`useCardDrag.ts:35-62`). Precisa de um laço por `requestAnimationFrame` perto da borda do container rolável e de recalcular o alvo com o ponteiro parado. | ~50 linhas no hook, opt-in. Mexe numa peça de 6 consumidores. | **M** |
| (iii) Trocar de mês no arrasto | Nada no hook. É o mesmo padrão do "peek" do fim de semana: o botão de navegação ganha `data-drop-key="nav:next"` e um efeito troca o mês após ~400ms com o card em cima (`WeekBoard.tsx:264-269`; o trilho do fim de semana é um `button` com drop key, `386-398`). O arrasto sobrevive ao card de origem sair da tela: o fantasma fica no `body` e os listeners no `document`. A visão ignora o drop em `nav:*`, como já faz com `WEEKEND` (`WeekBoard.tsx:260`). Para repetir a troca segurando, o mês entra nas dependências do efeito. | ~25 linhas na visão. | **P** |
| (iv) Chave composta `projeto\|semana` | Nada. A chave é texto livre e o alvo é o `data-drop-key` mais interno (`useCardDrag.ts:30-33`). O board de notas já usa `coluna::seção` (`NoteBoard.tsx:57-58`, `204`, `223`). | Zero. | **—** |

Outros limites do hook: só mouse; o drop é no container, sem posição (não há ordem manual em nenhuma visão: a ordem é important → doing → `sortOrder`, `WeekBoard.tsx:75-81`); `mousedown` em `input, button, select, textarea` não inicia arrasto (`useCardDrag.ts:21`), então checkbox e botões da linha compacta ficam clicáveis.

**Recomendação:** se a grade do mês couber na tela sem rolar (dias cheios com "+N more"), o auto-scroll não é necessário. É o caminho mais barato e o que não toca na peça comum.

---

## 4. Card compacto

**Nenhum componente atual serve como linha de 22–26px.** Alturas calculadas pelo CSS:

| Componente | Onde é usado | Altura mínima | Típica | Por que não serve |
| --- | --- | --- | --- | --- |
| `TaskCard` (board) | Week, Kanban, Projects, TODOS, My Day | ~59px (sem linha de projeto) | **~80px** (1 linha de título + projeto); ~102px com chips; +19,5px por linha extra de título (até 3) | Bloco de status no topo + título + contexto + rodapé (`TaskCard.module.css:4-17`, `69-95`, `147-176`). |
| `TaskCard list` | List | **~58px** | ~80px com chips | Sempre duas faixas: título (20px) e a linha de contexto com as ações (`TaskCard.tsx:255-287`, `TaskCard.module.css:25-31`, `179-183`). |
| `TaskLine` | bloco `/tasks`, `NotebookTasksSection` | ~30px (só título) | **~48px** com a linha de metadados; ~66px com a TODOS acima | Título em até 2 linhas, checkbox nativo, sem cursor/seleção, projeto só como texto (`TaskLine.module.css:1-10`, `64-73`, `80-88`). |
| Card de task do Calendar | `CalendarView` | ~33px | ~51px (2 linhas) | Título 12px em 2 linhas, barra de 3px à direita (`CalendarView.module.css:497-537`). |
| Item do "Due today" | nota diária | **~23px** | | É o mais próximo: uma linha de 13px com 2px de padding (`DueTodayBlock.module.css:17-25`). Mas é marcação solta dentro do `DueTodayBlock.tsx:49-76`, sem status, cor de projeto, seleção nem arrasto. |

Fontes reais: título de task **13px** em todos (`TaskCard.module.css:168`, `TaskLine.module.css:65`), com line-height 1.5 no board, 20px na List (`--lh-row`) e 1.35 na `TaskLine`; metadados e chips **11px**; título no card do Calendar **12px**. Espaço entre cards nos boards: 12px (`--gap-cards`).

**Proposta de base para a linha nova** (um componente, usado pelas duas visões): altura **24px** (`--control-sm`), título 13px/20px (`--lh-row`) ou 12px se a densidade pedir, uma linha com reticências e `title=` com o texto inteiro. Peças que já existem para compor: quadrado de status de 7×7 com a cor `--st` (`.stSquare`, `TaskCard.module.css:126-130`), `statusColor()` (`lib/tasks.ts:90-94`), cores de atraso (`.late` vermelho, `.latePlan` amarelo), estilos de cursor e seleção (`TaskCard.module.css:39-46`).

**Cuidado de cor:** status e projeto usam a **mesma paleta** (`TASK_COLOR_PALETTE`, `lib/tasks.ts:77-87`). Azul de projeto e azul de Doing são o mesmo `#5b9cf0`. No card atual não confunde porque o status tem texto. Numa linha sem texto, dois quadradinhos coloridos confundem: usar formas e posições diferentes (ex.: status = quadrado de 7px; projeto = filete de 3px na borda esquerda, ou o ponto redondo de 8px dos cabeçalhos, `BoardColumns.module.css:50-55`).

---

## 5. Calendário mensal existente (`CalendarView.tsx`, 765 linhas)

- **É uma coluna estreita, não uma área.** Fica no lugar da lista de notas, com 220px de padrão (`CalendarView.tsx:120`, `484`). Cada célula tem **28px de altura** (`CalendarView.module.css:210-221`) e cerca de 25px de largura.
- **A grade é montada dentro do componente** (`CalendarView.tsx:312-331`): 42 células `{ day, current }`, sempre 6 linhas, semana na segunda. **Não há helper reaproveitável**, e os dias do mês vizinho não têm chave de data (`563`), não são clicáveis e ficam com 40% de opacidade (`CalendarView.module.css:232-256`).
- **Task na célula:** um traço laranja de 10×2px ("há task no período") ou de 14×2px ("há deadline") (`CalendarView.tsx:250-267`, `610-615`; CSS `286-299`). Um dia marca "ativo" quando cai dentro do **período** da task, do do date até o deadline (`taskSpan`, `lib/tasks.ts:335-349`).
- **Abaixo da grade:** bloco "Overdue" com borda vermelha, só com hoje selecionado (`291-295`, `668-680`), e os cards das tasks do dia, com barra à direita laranja, vermelha (deadline estourado) ou amarela (do date passou) (`452-481`, `725-737`).
- Clicar numa task do Calendar leva para a List de Tasks (`App.tsx:4954`, `1110-1121`).

**Risco de confusão.** Seriam dois "meses" com regras diferentes: no Calendar a task aparece em **todos os dias do período**; no Month de Tasks apareceria em **um dia só**, o do plano, como no Week. Seriam também dois blocos "Overdue". Como o Calendar é o caderno das notas diárias e mostra a task só como marcador, a diferença se sustenta se o nome e o lugar deixarem claro (o Month fica dentro de Tasks, no menu de visões).

**O que dá para compartilhar:** as regras de data de `lib/tasks.ts` e uma função pura nova de grade do mês. `lib/trackers.ts` já tem duas peças úteis: `monthWeekStarts(year, month0)` (`trackers.ts:127-138`), que devolve as segundas das semanas do mês com a semana pertencendo ao mês em que cai a **quinta-feira** (sempre 4 ou 5 semanas, nunca 6, e nenhuma semana repetida entre dois meses), e `weekRangeLabel` ("16–22 Nov", `trackers.ts:239-245`), pronta para os cabeçalhos de semana da matriz. Exemplo: novembro de 2026 tem 6 linhas na grade de calendário e **4** pela regra da quinta-feira (2–8, 9–15, 16–22, 23–29); o dia 1 fica na última semana de outubro e o dia 30 na primeira de dezembro.

**Recomendação:** não refatorar o `CalendarView` nesta entrega. Ele também roda na janela Keep (`CalendarView.tsx:79-81`, `106-109`) e a troca não traz ganho visível.

**Consequência das regras do Week para o mês** (`columnOf`, `WeekBoard.tsx:85-89`; `isOverdue`, `lib/tasks.ts:327-331`): toda task aberta com plano antes de hoje é "atrasada" e vai para a coluna Overdue. Logo, **dia passado só mostra concluídas** (pelo dia da conclusão, `WeekBoard.tsx:184-186`) e não aceita drop (`222`). Num mês de calendário, tudo antes de hoje é área morta para planejar. Daí a sugestão da janela de semanas a partir da semana atual.

---

## 6. `lib/tasks.ts`: funções puras novas

Já existem e servem como estão: `planDate`, `isOverdue`, `overdueKind`, `scheduledAfterDeadline`, `reschedulePatch`, `deadlinePassedFor`, `startOfWeekKey`, `weekDayKeys`, `addDaysKey`, `endOfWeekKey`, `compareTasks`, `byTodosId` (`lib/tasks.ts:902-917`), `filterTasksForView`, `computeTaskSummary`, `formatDueShort`, `nextOccurrenceDate` (`1084-1089`).

| Função nova | Para quê | Observação |
| --- | --- | --- |
| Semanas da grade (`monthWeeks` ou `weeksFrom(início, n)`) | Linhas do mês: lista de semanas, cada uma com 7 chaves de dia | Monta com `startOfWeekKey` + `weekDayKeys`. Avaliar reutilizar `monthWeekStarts` de `lib/trackers.ts`. |
| Célula de uma task (`planCellOf`) | Dia, `overdue` ou `nodate` | **Já existe como `columnOf`, local no `WeekBoard.tsx:85-89`.** Promover para a lib e usar nos dois. |
| Ordem dentro da célula | important → doing → `sortOrder` | Idem: `byBoardOrder`, local no `WeekBoard.tsx:75-81`. |
| Deadlines abertos por dia | Marcador "N due" do dia | Hoje é um `useMemo` no `WeekBoard.tsx:165-172`. |
| Início e rótulo do mês, somar meses | Navegação e título ("November 2026") | Não existe na lib; o Calendar usa `year`/`month` soltos e `MONTH_NAMES` local (`CalendarView.tsx:48-51`). |
| Faixa de deadline (`deadlineBucket`) | Coluna da matriz: `overdue`, segunda da semana, `later`, `none` | "Overdue" aqui é `dueDate < hoje` (= `overdueKind === 'deadline'`), **não** `isOverdue`, que tira os replanejados. |
| Colunas de semana (`weekColumns(hoje, n)`) | Cabeçalho da matriz | Rótulo com `weekRangeLabel`. |
| Linhas da matriz | Projetos na ordem dos cadernos, com TODOS opcional como sublinha | A ordem e o agrupamento já estão em `groupTasksBy` modo `project` (`lib/tasks.ts:868-890`) e em `ProjectsBoard.tsx:38-76`. |
| Data ao soltar numa semana | Novo deadline quando o alvo é uma semana, não um dia | Regra a decidir: manter o dia da semana, ou o último dia de trabalho (`lib/workCapacity.ts`). |
| Vizinho na grade | Teclado 2D | Só se o extra entrar. |

**Padrão dos testes** (`src/lib/tasks.test.ts`, 301 linhas, Vitest, `npm test`): `describe`/`it` com frases em português; fábrica `task(patch)` com todos os campos (`27-53`); hoje fixo `TODAY = '2026-11-19'`, uma quinta, semana de 16 a 22 (`24-25`); `at(key)` devolve o meio-dia local do dia para fugir de borda de fuso (`55-59`). Há 9 blocos `describe` hoje. O precedente de "lógica do board em função pura" é `lib/noteBoard.ts` (`buildBoardColumns`, `columnKeyOf`).

---

## 7. Projeto e TODOS

**Mover de projeto** (`onMoveTaskToProject` → `moveProjectTask` → `relocateTask`, `App.tsx:4280`, `1048-1056`, `1035-1046`):
- garante o subject "Tasks" do caderno de destino (lê os subjects no banco);
- regrava a **nota-corpo** no caderno e no subject novos;
- só então grava `notebookId` na task.

São 2 a 3 gravações em sequência, assíncronas, e o resultado é ignorado por quem chama (`void`): se a nota falhar, a task não muda e não há aviso na visão. O Undo desfaz movendo de volta (`useTaskActions.ts:97`, `103`). A TODOS da task **não muda** ao trocar de projeto: a task fica ligada a uma TODOS de outro caderno, o que o app aceita (a visão TODOS e o Group by TODOS cruzam projetos, `lib/tasks.ts:844-866`).

Para um drop que muda projeto **e** deadline juntos, seriam dois caminhos de gravação em paralelo sobre a mesma task (`onUpdateTasks` regrava a linha inteira, `useTasks.ts:128-171`). O jeito limpo é um caminho só (o `relocateTask` aceitar um patch extra): mudança pequena no `App.tsx`. Em lote, cada task dispara a sua cadeia.

**Trocar a TODOS:** barato. É um campo: `onUpdateTasks([{ id, patch: { parentNoteId } }])` (`TodosBoard.tsx:62-70`), com Undo. A pill dentro da nota TODOS não é movida; a nota mostra a task em "Linked outside this checklist" (`App.tsx:2165-2171`).

**Propriedade "Entrega" da TODOS:**
- Não é campo fixo. É uma propriedade de data **criada pelo usuário** no tipo TODOS: a definição fica em `metadata_defs` (`scope: 'note'`, `noteTypeId: 'todos'`, `type: 'date'`; `types/index.ts:135-148`) e o valor em `notes.properties`, pela chave do id da definição (`types/index.ts:33-35`). O tipo TODOS nasce sem nenhuma propriedade (`storage/tauri.ts:1254-1259`).
- **As visões de Tasks não a leem.** `TodosInfo` tem só `id`, `title`, `notebookId`, `archived` (`lib/tasks.ts:240-246`; montado em `App.tsx:795-804`). `todosProgressByNote` devolve feitas/total, `overdue` e `nextDeadline`, que é o **menor deadline das tasks abertas** da TODOS, e não a Entrega (`lib/tasks.ts:722-752`).
- Quem lê as datas da nota é só a agenda da IA (`noteDateFields`, `lib/agenda.ts:43-64`), que trata todas as propriedades de data do tipo por igual, sem saber qual é "a Entrega".

Para a matriz mostrar a Entrega como marco: estender `TodosInfo` e a chave `todosKey` (esforço P) e **decidir qual propriedade vale** (pelo nome? a primeira de data? uma configuração?). O `nextDeadline` já está pronto e não pede decisão.

---

## 8. Layout

**O que fica na tela numa visão de board** (`App.tsx:4711-4848`, `5026-5035`): a coluna de cadernos, o board ocupando o resto e, se estiver aberto, o painel da direita (IA/Chat). **A lista de tasks e o editor não aparecem.**

| Peça | Largura | Fonte |
| --- | --- | --- |
| Janela | 1280×800 padrão, mínimo 960×600 | `src-tauri/tauri.conf.json:17-20` |
| Toolbar | 44px de altura | `Toolbar.module.css:8` |
| Coluna de cadernos | 180 padrão, 140 a 320; 48 recolhida | `App.tsx:601-604`, `282`; `NotebookList.tsx:51-52` |
| Board | o resto (`flex: 1`), padding 16px | `WeekBoard.module.css:1-12` |
| Painel da direita | 300 a 720, se aberto | `AiPanel.tsx:27-28` |

O painel da direita **não** se recolhe nos boards de Tasks; só o board de notas faz isso (`App.tsx:1229-1243`). É um efeito de 10 linhas, fácil de repetir para o Month.

**Largura útil do board** (janela − cadernos − 32 de padding):

| Janela | Painel fechado | Painel aberto (300) |
| --- | --- | --- |
| 1280 | ~1068px | ~768px |
| 1920 | ~1708px | ~1408px |
| 960 (mínimo) | ~748px | ~448px |

Com uma bandeja de 220px + 12 de gap, a 1280: 7 colunas de dia com **~116px** cada (cabem ~15 caracteres de título), 5 colunas (fim de semana oculto) com **~164px** (~23 caracteres). Com o painel aberto: ~73px por dia, inviável. A 1920: ~207px por dia (~30 caracteres). Na matriz, com 160px para o nome do projeto e 7 colunas de tempo: ~125px por coluna a 1280.

**Altura útil.** A `TasksHeader` nos boards tem cerca de **190px** (título e filtro 28 + chips e barra da semana ~42 + busca ~26 + quick add e seletor de projeto ~58 + 3 gaps de 12; `TasksHeader.module.css:1-5`, `22-34`, `117-121`). Com uma barra de navegação (~26 + 12) o topo chega a ~228px.

| Janela | Sobra para a grade | 6 semanas | 5 semanas | 4 semanas |
| --- | --- | --- | --- | --- |
| 800 de altura | ~480px | ~76px por linha → **2 tasks** | ~92px → 2 | ~115px → 3 |
| ~1009 (1080p maximizado) | ~689px | ~111px → 3 | ~134px → 4 | ~167px → 5 |

(Conta: linha de 24px + 2 de gap, 18px para o número do dia, 20px para o cabeçalho dos dias da semana, sem o padding da célula. O "+N more" ocupa uma dessas linhas quando o dia transborda.)

Cruzando com o relatório de uso real (`explorerreport_20261121090550_usage.md`, pelo resumo no Execution Report): o pico é de 4 tasks num dia pelo plano. Isso cabe em 5 semanas a 1080p; na janela padrão pede "+N more" ou menos semanas na tela.

Saídas, para o uxAgent pesar: cabeçalho mais baixo no Month; menos semanas na tela; "+N more" por dia; recolher o painel da direita; ocultar o fim de semana por padrão (o Week já parte dos dias de trabalho do Settings, `WeekBoard.tsx:93-101`).

Os tokens visuais estão na seção final.

---

## 9. Desempenho

- **Como chegam as tasks:** todas as visões recebem o array `tasks` inteiro (abertas, concluídas e descartadas de todo o histórico; `getTasks` lê a tabela sem filtro, `storage/tauri.ts:1329-1336`) do `useTasks` (`App.tsx:724-737`, `4288-4306`). Cada visão filtra em `useMemo` encadeados: projeto + busca → resumo → chip → colunas (`BoardView.tsx:81-90`, `WeekBoard.tsx:154-237`). É uma passada linear por etapa.
- **Sem virtualização** em nenhuma visão de Tasks. Cada coluna rola por dentro (`WeekBoard.module.css:190-197`).
- **Sem `React.memo`** em `TaskCard`, `TaskLine` ou nas colunas. `boardProps` é um objeto novo a cada render do `App`, com handlers novos (`App.tsx:4288-4306`), então qualquer mudança de estado do `App` redesenha o board inteiro.
- **No arrasto:** cada `mousemove` faz um `elementFromPoint` e só muda estado quando o alvo muda (`useCardDrag.ts:57-61`); a visão redesenha a cada troca de célula.

**Uma grade de 42 células com dezenas de linhas não preocupa**, desde que a célula use a linha compacta. O volume real também é pequeno (54 tasks no total e 8 abertas, segundo o relatório de uso). O `TaskCard` é pesado (estado próprio do menu de snooze, metadados, `useTasksEnv`); a linha compacta é um `div` com 3 ou 4 filhos. Se o arrasto engasgar, `React.memo` na célula resolve, porque só duas células mudam por movimento. O que pode crescer são as **concluídas**: o Week mostra as concluídas no dia da conclusão; num mês inteiro isso pode dobrar as linhas. Sugiro mostrar só a contagem.

---

## 10. Esforço e riscos

### Month

| Parte | Esforço | Reaproveita | Novo |
| --- | --- | --- | --- |
| **Mínimo viável** | **M** | `TasksHeader`, `useTaskKeyboard`, `TaskBatchBar`, `useCardDrag` como está, `reschedule` (Move deadline too + Undo), regras de data, Hide weekends, modal da task | `MonthBoard.tsx` + CSS (porte do `WeekBoard`), linha compacta, bandeja Overdue / No date, funções puras + testes, "+N more", entrada em `views.ts` e ramo no `App.tsx` |
| Arrastar várias | P | `reschedule` com N itens | selo no fantasma |
| Trocar de mês no arrasto | P | padrão do "peek" | efeito na visão |
| Teclado 2D | M | — | opção no `useTaskKeyboard` + função de vizinhança |
| Auto-scroll | M | — | laço no `useCardDrag` (evitável) |
| Próximas ocorrências de recorrentes | M | `nextOccurrenceDate` | linhas "fantasma" não arrastáveis |
| Criar task clicando no dia | P–M | `onCreateTask` | campo na célula |

### Projeto × entrega

| Parte | Esforço | Reaproveita | Novo |
| --- | --- | --- | --- |
| **Mínimo viável, só leitura** | **P–M** | Tudo do topo, linha compacta do Month, `byTodosId`, ordem dos projetos | componente da matriz + CSS (cabeçalho e 1ª coluna fixos), `deadlineBucket`, colunas de semana, linhas + testes |
| Arrasto muda o deadline (na mesma linha) | M | `actions.update` + Undo, chave composta | regra da data ao soltar numa semana; o que fazer com o do date que fica depois do deadline; decisão sobre `rescheduleCount` |
| "Set deadline…" no lote | P | `actions.update` | botão + popover parametrizado |
| Arrasto muda o projeto | P–M | `onMoveTaskToProject` + Undo | caminho único de gravação; risco de mover sem querer |
| TODOS como sublinha | P | `byTodosId` | — |
| Marco pela Entrega da TODOS | P + decisão | `noteDateFields` | estender `TodosInfo` |

### Fases sugeridas

1. **Base comum (P):** linha compacta, funções puras com testes, promover `columnOf` e `byBoardOrder` para a lib. Nada visível muda.
2. **Month mínimo (M):** grade, bandeja, arrasto de uma task, "+N more".
3. **Matriz só leitura (P–M):** já responde "o que cada projeto entrega em cada semana".
4. **Matriz com arrasto de deadline + "Set deadline…" no lote (M).**
5. **Extras, por demanda:** arrastar várias (P), trocar de mês no arrasto (P), teclado 2D (M).

A matriz só leitura pode vir antes do Month se a prioridade for ver, e não planejar: é a entrega mais barata.

### Riscos

1. **Espaço na tela (o maior).** ~480px de altura e ~116px por dia na janela padrão, e as semanas passadas do mês são área morta. Sem decidir cabeçalho, número de semanas e painel da direita, o Month nasce apertado e o "título com o máximo de espaço" não se cumpre.
2. **Regressão em peças comuns.** `useCardDrag` serve 6 lugares (Week, os 4 boards e o board de notas) e `useTaskKeyboard` serve 6 visões. Tudo que entrar neles deve ser opt-in. Promover `columnOf` mexe no Week (mudança pequena, coberta por teste). Mudar a regra de `rescheduleCount` em `applyTaskPatch` afeta todas as visões e o chip "Postponed".
3. **Regras parecidas com resultados diferentes.** Calendar (período) × Month (um dia); chip "Overdue" (pelo plano) × coluna Overdue da matriz (pelo deadline); arrasto de deadline somando adiamento em qualquer direção; arrasto de do date para depois de um deadline futuro sem aviso no card.
4. **Mover de projeto por arrasto** grava nota e task em sequência, sem retorno de erro para a visão.
5. **Ramo esquecido no `App.tsx`:** id novo sem ramo abre o Week sem avisar (`App.tsx:4830`).
6. **Cor:** status e projeto na mesma paleta, lado a lado numa linha sem texto.

---

## Tokens para mockup

Fonte: `src/App.css:1-93`. **Só existe tema escuro** (`color-scheme: dark`, `App.css:91`; não há tema claro nem `prefers-color-scheme`).

Os mockups de `DOCS/features/notebook_column_study/*.html` são o precedente de formato, mas os valores de `--text-secondary` e `--text-muted` de lá estão **desatualizados**. Use os de baixo.

Fonte de texto: o `index.html:8` pede Inter ao Google Fonts, mas a CSP do app não libera esse endereço (`tauri.conf.json:46`), e o `App.css:66-69` registra que a fonte de produção é **Segoe UI**. Para o mockup ficar igual ao app no Windows, use a pilha abaixo **sem** carregar Inter.

```css
:root {
  /* Fundos e superfícies */
  --bg-app: #1f1f2f;        /* fundo do board e do card de task */
  --bg-panel: #161625;      /* coluna de cadernos, toolbar; texto sobre bloco de status */
  --surface-1: #1d1d34;     /* coluna de board, inputs, hover de card */
  --surface-2: #292959;     /* coluna sob o arrasto, menus, popovers, barra de lote */
  --surface-3: #2e2e36;     /* hover de item de menu */
  /* Texto */
  --text-primary: #ddddf1;
  --text-secondary: #a2a2ae;
  --text-muted: #9494ad;
  /* Acentos */
  --accent: #7b6ed4;        /* roxo: notas, TODOS na List */
  --accent-ai: #5dcaa5;
  --accent-warn: #ef9f27;
  --accent-task: #ef9f27;   /* laranja das tasks: hoje, seleção, foco, drop */
  --accent-danger: #e05555; /* deadline estourado */
  --accent-late: #e6c449;   /* do date passou (Slipped) */
  /* Status */
  --status-todo: #9a9aae;
  --status-doing: #5b9cf0;
  --status-done: #5cc185;
  --status-dropped: #f26b55;
  /* Linhas */
  --border: #2e2f2cb3;      /* borda de input, menu, painel (com alfa) */
  --hair: #34344f;          /* borda de card, fio entre linhas */
  /* Espaço (escala de 4px) */
  --space-0: 2px; --space-1: 4px; --space-1h: 6px; --space-2: 8px;
  --space-3: 12px; --space-4: 16px; --space-5: 20px; --space-6: 24px;
  --space-8: 32px; --space-10: 40px; --space-12: 48px;
  --pad-panel: 16px; --pad-card: 12px; --gap-cards: 12px;
  --gap-section: 24px; --pad-modal: 24px;
  /* Raio (0 nos blocos de status, de propósito) */
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 10px;
  /* Controles */
  --control-sm: 24px; --control-md: 28px; --control-lg: 32px; --control-xl: 40px;
  /* Ritmo */
  --lh-tight: 1.25; --lh-ui: 1.45; --lh-body: 1.65; --lh-row: 20px;
  color-scheme: dark;
}
body {
  margin: 0;
  background: var(--bg-app);
  color: var(--text-primary);
  font: 14px/1.45 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
```

**Paleta de projetos e de status custom** (`TASK_COLOR_PALETTE`, `lib/tasks.ts:78-87`; projeto sem cor = contorno de 1px em `--text-muted`):
`#9a9aae` · `#5b9cf0` · `#5cc185` · `#f26b55` · `#ef9f27` · `#e6c449` · `#7b6ed4` · `#5dcaa5`

**Tamanhos de texto:** título de task 13px · rótulos, botões de navegação, cabeçalho de coluna, busca, menus 12px · chips, metadados, contagens, "N due" 11px · rótulo dos dias da semana do Calendar 10px maiúsculo. Pesos: 400, 500 (cabeçalhos de coluna e de seção), 600 (bloco de status, contagens em destaque, atraso).

**Estrutura do board** (`WeekBoard.module.css`):
- board: padding 16px, gap 16px entre o topo e as colunas; topo com gap 12px;
- coluna: fundo `--surface-1`, raio 6px, padding 12px, gap 12px, borda 1px transparente;
- coluna de hoje: borda `--accent-task` e cabeçalho em `--accent-task`; cabeçalho de Overdue em `--accent-danger`;
- cabeçalho de coluna: 12px/500 `--text-secondary`, contagem em `--text-muted`, "N due" 11px `--text-muted` com o ícone Target de 11px à direita;
- coluna vazia recolhida (Overdue, No date) e trilho do fim de semana: 36px de largura, texto na vertical; o trilho tem borda tracejada `--hair`;
- colunas de dia: `minmax(150px, 1fr)` no Week; 240px de mínimo nos outros boards (`BoardColumns.module.css:11-13`);
- botões de navegação: borda 1px `--border`, raio 4px, padding 4px 6px, 12px `--text-secondary`; o ativo ("This week") com borda `--accent-task`.

**Estados do arrasto:** card de origem com opacidade 0.35 · fantasma com opacidade 0.9 e sombra `0 6px 18px rgba(0,0,0,.35)` · alvo com fundo `--surface-2` e borda **tracejada** `--accent-task` · colunas que não aceitam drop com opacidade 0.45 · concluídas com opacidade 0.55.

**Card de task atual** (`TaskCard.module.css`), para comparar no mockup:
- fundo `--bg-app`, borda 1px `--hair`, raio `0 4px 4px 4px` (canto superior esquerdo quadrado), hover `--surface-1`;
- bloco de status: fundo na cor do status, texto `--bg-panel` 11px/600, padding 3px 12px, **raio 0**;
- quadrado de status compacto e amostra de projeto: **7×7px**, sem raio;
- deadline: ícone Target 11px + data relativa 11px `--text-secondary`; estourado em `--accent-danger` 600;
- cursor do teclado: `box-shadow: 0 0 0 1px` laranja a 55%; em seleção: fundo laranja a 14% sobre `--bg-app`; aberta: borda `--accent-task`.

**Barra de lote e Undo** (`TaskBatchBar.module.css`): presa ao rodapé, fundo `--surface-2`, borda `--border`, raio 6px, padding 6px 8px, 12px; botões com borda `--border`, raio 4px, padding 2px 8px.

**Menus e popovers:** fundo `--surface-2`, borda `--border`, raio 8px, padding 4px, sombra `0 6px 18px rgba(0,0,0,.35)`; item 12px com padding 6px 8px e hover `--surface-3`.

**Chips de resumo do cabeçalho** (`TasksHeader.module.css:53-90`): fundo `--surface-1`, borda `--border`, raio 10px, padding 2px 8px, 11px; ativo com borda `--accent-task`; Overdue em `--accent-danger` ou `--accent-late`.

**Ícones** (Phosphor, sempre; nunca emoji): Target (deadline) · CalendarBlank (do date) · Flag preenchido (important, em `--accent-task`) · Repeat (recorrente) · ArrowClockwise (adiada N×) · Checks (TODOS) · Sun (My Day) · Clock (snooze) · Trash · CaretLeft / CaretRight em negrito, 13px (navegação) · Eye / EyeSlash (fim de semana) · CaretDown 10px (menu de visão) · GearSix · MagnifyingGlass · Plus · ArrowCounterClockwise (Undo) · X · Warning. Tamanhos: 11px dentro de chips, 13px em ações e navegação.

**Medidas para dimensionar o mockup:** janela 1280×800 · toolbar 44px · coluna de cadernos 180px, fundo `--bg-panel` · `TasksHeader` ~190px de altura · barra de navegação ~26px · área da grade ~1068×480px com o painel da direita fechado.
