# Explorer Report (código) — Ctrl+K, cards de tasks, Week, metadados, pastas do Chat

Task Report: `DOCS/reports/17-10-2026/taskreport_20261017023427.md` (requisitos 1 a 5; o 6 está com outro agente).

## Resumo e dificuldade

| Req. | Tema | Dificuldade | Viável? |
|---|---|---|---|
| 1 | Bug Ctrl+K | Baixa | Sim |
| 2 | Tasks em cards | Média | Sim, com um ajuste de escopo (abaixo) |
| 3 | Week mais larga + ocultar fim de semana | Baixa | Sim |
| 4 | Metadados personalizados (MVP só tasks) | Média | Sim |
| 5 | Grupos Library/Notebook no Chat | Média | Sim |

**Dificuldade geral: Média.** Nenhum impedimento. Há uma mudança de escopo recomendada no item 2 e um alerta de schema no item 4.

---

## 1. Bug Ctrl+K — causa raiz provável

Como funciona hoje:
- `src-tauri/src/lib.rs:51-64` `toggle_keep_window`: esconde a janela se ela estiver visível **e** focada; senão faz `show` + `set_focus` e emite `keep-shown`.
- A janela keep (`tauri.conf.json:31-41`) é `alwaysOnTop` e **não se esconde ao perder o foco**: não existe handler de blur/foco para ela no Rust (só a main tem `on_window_event`, `lib.rs:1634`). Ao clicar fora, ela continua na tela, sem foco.
- `KeepPanel.tsx:158-163`: no `keep-shown` chama `loadOrCreateTodayNote()` (assíncrono) e, logo em seguida, `editor.commands.focus()`.
- `App.tsx:1104-1129` só recarrega as notas da **main** quando ela ganha foco. Não tem relação com o bug da keep.

**Hipótese A (principal, alta confiança): com a nota vazia, a área que dá para clicar e editar é só a primeira linha.**
- `KeepPanel.module.css:79-84`: `.proseEditor { min-height: 100% }`. Esse 100% não tem efeito, porque o wrapper do `<EditorContent>` (`KeepPanel.tsx:298`) não tem altura definida. O ProseMirror fica com a altura do conteúdo, e sem texto isso é **uma linha** (o placeholder).
- Ao voltar clicando na janela, quase todo clique cai no `.body` (`KeepPanel.module.css` `.body`, com padding), que não é focável. O mousedown num elemento não focável **tira o foco** do contenteditable, e a digitação não vai para lugar nenhum.
- Quando a nota tem texto, o usuário naturalmente clica sobre o texto, e por isso o bug "só acontece sem digitar".

**Hipótese B (Ctrl+K como forma de voltar): o `focus()` do Tiptap pode não fazer nada.**
- Tiptap 3.23 `commands/focus.ts`: `if (view.hasFocus() && position === null) return true`. Se o usuário saiu para outro app, o `document.activeElement` continua sendo o ProseMirror (o blur do SO não muda o `activeElement`). O `focus()` entende que já tem foco e não chama `view.focus()`.
- Ao mesmo tempo, o `set_focus` do Windows ativa a janela nativa, mas o WebView2 nem sempre devolve o foco de teclado ao conteúdo (problema conhecido de Tauri/WebView2 com janelas sem decoração). Resultado: o DOM "acha" que tem foco, mas as teclas não chegam.
- Além disso, o `focus()` roda **antes** do `setContent` da recarga (que vem depois de um `await`). A recarga substitui o documento inteiro depois do foco.

**Correção sugerida (causa raiz, não só forçar foco):**
1. Fazer o editor ocupar o corpo inteiro: a cadeia `.body > div(EditorContent) > .ProseMirror` deve preencher a altura (flex/`height:100%` no wrapper, ou `min-height` em px/`calc` no `.ProseMirror`).
2. Mousedown em área vazia do `.body` (fora do ProseMirror) chama `editor.commands.focus('end')`.
3. No `keep-shown`, focar **depois** de terminar a carga (dentro da `loadChainRef`), com posição explícita: `focus('end')`, que ignora o atalho do `hasFocus()`. Também convém tratar `getCurrentWindow().onFocusChanged(true)` na keep: se o foco não estiver no editor, focar.
4. Testar no Windows os casos de borda do Task Report: abrir e fechar várias vezes, abrir já com texto, perder o foco para a main ou para outro app.

Não é possível reproduzir só lendo o código. Recomendo que o codeAgent valide A e B em dev (`npm run tauri:dev`) antes de fechar.

---

## 2. Tasks em cards

**Situação atual:** já existe **um único componente de linha** para todas as visões, o `TaskLine.tsx` (checkbox + título + `TaskMeta` com chips). Quem usa:

| Visão | Arquivo | Moldura do card / drag |
|---|---|---|
| List e saved views | `TasksView.tsx:128-157` | sem drag |
| Kanban, Projects, Groups, My Day (Today) | `BoardView.tsx:110-143` → `BoardColumns.tsx:36-48` (`.card` com `onCardMouseDown`) | `useCardDrag` |
| Week | `WeekBoard.tsx:187-219` (`.card` próprio) | `useCardDrag` |
| Review | `WeeklyReview.tsx:146-157` | sem drag, sem teclado |
| **Fora de Tasks** | `Editor/TasksQueryBlockView.tsx:93` (bloco `/tasks` na nota) e `Sidebar/NotebookTasksSection.tsx:210` | — |

**O que dá para unificar:** criar um `TaskCard` (título em destaque + linha de status + grade de metadados) que substitui o `TaskLine` nas visões de Tasks. A moldura arrastável (`.card` + `onCardMouseDown`) está duplicada em `BoardColumns.module.css` e `WeekBoard.module.css`. Ela pode virar parte do `TaskCard` (prop `onDragMouseDown`/`dragging`) ou ficar como está.

**Mudança de escopo recomendada:** **não** trocar o `TaskLine` no bloco `/tasks` do editor nem na sidebar do caderno. São listas embutidas e densas, que não estão no pedido ("todas as visões" de Tasks). Opções: manter o `TaskLine` para esses dois lugares, ou criar `TaskCard` com `variant="compact"`. Sugiro manter o `TaskLine` e mover o `TaskMeta` para um módulo compartilhado pelos dois.

**O que precisa ser preservado (contrato atual do TaskLine):**
- `data-task-id` no elemento raiz (usado pelo teclado/scroll de `useTaskKeyboard`).
- `onSelect(e)` com modificadores Ctrl/Shift → `kb.handleClick`, e as classes `cursor`/`inSelection`/`selected`.
- Botões Plan today (Sun), Snooze (menu) e Delete, com `onMouseDown stopPropagation` para não iniciar o drag. O `useCardDrag` também ignora `input, button, select, textarea` (`useCardDrag.ts:21`).
- `TaskBatchBar` depende só do `kb`, não muda.
- `lines` (2 ou 3), cor do projeto na borda esquerda, `showDate=false` no Week, `showGroup`/`showDoing` condicionais.

**Status em destaque:** hoje só aparece um chip quando a task está em andamento (`isInProgress`). Todo e Done são indicados apenas pelo checkbox. O card deve mostrar um badge para **todo** status com `statusName`/`statusColor(task.status, statuses)` (`lib/tasks.ts`), com fallback quando a cor do status custom é nula, e `border-radius: 0` no badge (requisito: cantos quadrados).

**Riscos:**
- List e Week são densas. A coluna da List é estreita, ao lado do editor, então o card precisa de altura contida: o título em 2 ou 3 linhas e os metadados com `flex-wrap` limitado a 2 linhas e `+N`.
- O ghost do drag clona o card, então um card mais alto deixa o ghost maior. Não é problema funcional.

---

## 3. Week

- A largura vem do inline style em `WeekBoard.tsx:263-269`: `gridTemplateColumns` = `36px` para trilhos vazios (Overdue e No date) e `minmax(168px, 1fr)` para os demais. São 9 colunas (Overdue | Sun..Sat | No date). O CSS `.columns` (`WeekBoard.module.css`) já tem `overflow-x: auto`.
- Para alargar: subir o mínimo (ex.: `minmax(220px, 1fr)`, próximo dos 240px do `BoardColumns`). O scroll horizontal já existe.
- A semana começa no **domingo** (`lib/tasks.ts:269` `startOfWeekKey` usa `getDay()`). Ocultar o fim de semana significa remover o **primeiro** e o **último** dia de `weekDayKeys`. Basta filtrar no `useMemo` de `columns` (`WeekBoard.tsx:108-161`). Com 7 colunas, o `1fr` distribui o espaço liberado automaticamente.
- Tasks de sábado e domingo: mostrar a contagem no botão (ex.: "Weekend (3)") e/ou um aviso. Atenção: `orderedIds` (teclado) é derivado de `columns`, então tasks ocultas saem da navegação por teclado. Isso é coerente.
- **Persistência:** seguir o padrão de preferências de UI em `localStorage` com chave `monet:` e try/catch (`App.tsx:412-446`, ex.: `monet:tasks-main-view`). Ex.: `monet:tasks-week-hide-weekend`. O estado pode ficar local no `WeekBoard` (useState lazy + setItem), sem passar pelo App.

---

## 4. Metadados personalizados (MVP só tasks)

**Alerta de schema:** as migrations do `lib.rs` **não rodam no banco de produção** (checksum v11; comentário em `lib.rs:1586-1588` e `storage/tauri.ts:426-429`). Colunas e tabelas novas de tasks entram em `storage/tauri.ts`: `TASKS_TABLES_SQL` (CREATE IF NOT EXISTS) e `TASKS_EXTRA_COLUMNS` (ALTER idempotente via PRAGMA, no `ensureTasksTables`, linhas 724-762). **Não criar migration nova no `lib.rs`.**

**Modelo proposto** (definições globais + valores na própria task, extensível a notas):
- Tabela `metadata_defs (id TEXT PK, name TEXT NOT NULL, type TEXT NOT NULL /* text|number|date|checkbox */, sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`, em `TASKS_TABLES_SQL`. É global e não é exclusiva de tasks.
- Coluna `metadata TEXT` (JSON `{ [defId]: string|number|boolean }`) em `TASKS_EXTRA_COLUMNS`. Date é guardada como `YYYY-MM-DD`. Segue o mesmo padrão de `recurrence` (JSON em coluna).
- Na fase de notas: a mesma coluna `metadata TEXT` na tabela `notes` (ALTER idempotente análogo ao `ensureNotebookColorColumn`, `tauri.ts:702`), usando as mesmas definições. Não exige migração destrutiva.
- Tipos: `MetadataDef` e `Task.metadata: Record<string, MetadataValue>` em `src/types/index.ts`. `TaskRow`/`rowToTask`/`saveTask` em `tauri.ts:370-820` (o INSERT/UPSERT lista as colunas explicitamente, então é preciso incluir `metadata`). Também o `TaskPatch` em `lib/tasks.ts:~121`.

**Por que JSON na task e não uma tabela EAV (`metadata_values`):**
- Recorrência: basta copiar `metadata: { ...task.metadata }` em `buildNextOccurrence` (`lib/tasks.ts:807-842`). Ela é chamada em `useTasks.ts:118-129` quando a task recorrente vira done.
- Exclusão da task (`useTasks.ts:145`, `tauri.ts:822`) e da task do caderno (`App.tsx:1082`): os valores somem junto com a linha, sem órfãos.
- Contras: excluir uma definição exige limpar o JSON de cada task. Pode ser feito em JS (iterar as tasks em memória e chamar `updateTasks` em lote, que já é sequencial e sem BEGIN/COMMIT) ou com `json_remove` do SQLite. A contagem para o confirm sai do array em memória. Renomear a definição não toca nos valores, porque eles são indexados por `defId`.
- Alerta de concorrência: o `saveTask` grava a linha inteira. A janela keep (`KeepPanel` usa `useTasks`) pode, em tese, gravar uma task com `metadata` defasado (last-write-wins). Esse risco **já existe** para todos os campos e é mitigado pelo `tasks-changed` (`lib/tasksEvents.ts`). Não é novo.

**Onde editar e exibir:**
- Edição: `TaskPropertiesBar.tsx`, que é declarativa (`TASK_PROPERTIES` + `renderControl`; o cabeçalho do arquivo, linhas 1-10, documenta como adicionar propriedade). Fica no `topSlot` do editor da nota-corpo (`App.tsx:2422`). Metadados personalizados são uma lista dinâmica, então o melhor é uma seção abaixo das propriedades fixas: uma linha por valor (label = nome da definição, controle por tipo, botão remover) e um "+ Add property" com lista das definições existentes e opção "New…" (nome + tipo).
- Gestão global (renomear, excluir com contagem via `useConfirm`): pode seguir o padrão do `StatusManagerModal.tsx`.
- Hook novo `useMetadataDefs`, no padrão de `useTaskStatuses`, com sync entre janelas no mesmo esquema de eventos.
- Exibição nos cards: chips no `TaskCard` (item 2). Checkbox mostra o nome com ✓; Date usa `formatDueShort`; Text é truncado.
- Validação: Number vazio ou não numérico significa "sem valor" (remove a chave). Date no padrão de chave local.
- RAG: valores numa coluna separada não entram no `content` da nota. Hoje o RAG não é afetado (só na fase de notas, se se decidir indexar).

---

## 5. Chat: grupos Library e Notebook

**Identificação (segura, sem heurística de nome):**
- As pastas automáticas são criadas em `useChat.ts:1438-1496` (`ensureScopedFolder`) com nomes `Library - <título>` / `Notebook - <título>`. **O nome não é confiável**: o usuário pode renomear, e uma pasta de caderno excluído vira "pasta comum" de propósito (`App.tsx:1513-1515`, `1791-1792`).
- O marcador confiável são os mapas de vínculo em localStorage: `monet:reader-book-folder-link` (bookId → folderId) e `monet:notes-notebook-folder-link` (notebookId → folderId) (`useChat.ts:168-169`, helpers em `540-650`). Para o caderno já existe a busca reversa `getNotebookIdForChatFolder`. Para livro falta uma reversa: criar `getBookIdForChatFolder` ou um helper que devolva o `Set` dos folderIds vinculados.
- A pasta `assistant` e as criadas manualmente continuam como hoje.
- O `ChatFolder` (`useChat.ts:205`) e o `ChatConversation.folderId` **não mudam**.

**Agrupamento visual em `ChatSidebar.tsx`:**
- Hoje há um único `SortableContext id="__folders__"` (`ChatSidebar.tsx:456-500`) com dnd-kit, e o reorder chama `onReorderFolders(ordemCompleta)` (`:310-317`).
- Proposta: particionar `folders` em manual, library e notebook. Renderizar as manuais como hoje, depois um header-grupo "Library" e um "Notebook" (retráteis), cada um com o próprio `SortableContext`. Grupos vazios não aparecem.
- Reorder dentro de um grupo: recompor a ordem global substituindo só as posições do subconjunto antes de chamar `onReorderFolders`. Bloquear a soltura de uma pasta em outro grupo.
- O drop de **conversa** num header de pasta dentro do grupo continua funcionando (ids `folder:`/`folder-body:`).
- Estado colapsado: localStorage (ex.: `monet:chat-group-collapsed` = `{library: bool, notebook: bool}`).
- Ao selecionar uma conversa ativa dentro de um grupo colapsado (ex.: vindo do Reader ou das Anotações), expandir o grupo: efeito sobre `activeId`, verificando se a pasta da conversa pertence a um grupo.
- Os mapas de vínculo são lidos do localStorage. Para refletir vínculos criados por outra janela ou no mesmo tick, derivar o conjunto num `useMemo([folders])`, porque a criação de pasta sempre altera `folders`.

---

## Recomendações finais
1. Item 2: limitar a troca para `TaskCard` às visões de Tasks e manter `TaskLine` no bloco `/tasks` e na sidebar do caderno (**mudança de escopo, confirmar com o Coordenador**).
2. Item 4: schema só via `ensureTasksTables` (`storage/tauri.ts`), metadados como JSON na task e tabela global `metadata_defs`.
3. Item 1: validar as hipóteses A e B em dev no Windows antes de fechar o fix.
