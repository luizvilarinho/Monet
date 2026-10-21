# Estudo — Tipos de nota, TODOS (entregável) e busca Ctrl+P

> Data: 2026-10-20 · Somente leitura (nenhum código alterado) · Base: `study/note-types` = develop 878dbf9 (v1.4.10)
> Pedido do Coordenador: dar tipo opcional às notas, com propriedades próprias; o primeiro tipo é o **TODOS** (nota-entregável cujas tasks são as subtasks), que **substitui o `group`** das tasks; melhorar a busca Ctrl+P, que "não acha as coisas"; e um botão "+" no handle de bloco do editor.
> Task Report: `DOCS/reports/20-10-2026/taskreport_20261020004156.md`. Estudos relacionados: `tags_study.md`, `tasks_study.md`, `tasks_entregas_study.md`, `central_informacao_study.md`.
> Dados de uso: os números vêm dos estudos de 15–17/out (cópia do banco de produção). Não houve nova leitura do banco nesta sessão (acesso negado pela permissão de dados), então a migração prevê um relatório de *dry-run* antes de gravar qualquer coisa (§6.2).
> Privacidade: o repositório é público. Nomes de groups e notas de trabalho não aparecem aqui, exceto o exemplo que o próprio Coordenador levou ao print.

---

## 1. TL;DR

- **Tipos de nota cabem sem trocar o eixo caderno → matéria.** O tipo é global e opcional e funciona como um "formulário" por cima da nota. A infraestrutura de propriedades já existe e quase não é usada: `metadata_defs`, os controles do `TaskPropertiesBar` e o JSON `metadata`. Basta generalizá-la para notas, com colunas novas no padrão idempotente (`PRAGMA table_info`). As propriedades ficam **fora do Markdown**, então não há risco com o `tiptap-markdown`.
- **O TODOS resolve o que o `group` fazia mal.** O group é texto livre (91% das tasks têm um) e não tem lugar para contexto. A nota TODOS é o "sistema/frente" com corpo: status, decisões, links e o checklist de tasks. Proposta:
  - vínculo explícito `notebook_tasks.parent_note_id` (não reaproveitar o `source_note_id`);
  - migração de cada par (caderno, group) para uma nota TODOS, com relatório antes de executar;
  - em List, Kanban, Week, Groups, visões salvas, chat e RAG, "Group" vira "TODOS".
- **O chip da task na nota é pobre e ambíguo.** Hoje mostra só `planDate`, que é o do date **ou**, na falta dele, o deadline, sem dizer qual (`TaskRefView.tsx:31`). A proposta é status (cor do registro), do date, deadline (⚑), ↻ e atraso, compactos, com o resto no tooltip.
- **Lista de notas:** ícone do tipo, até 2 propriedades e, para TODOS, o progresso **derivado** das tasks (`1/4`, próximo prazo, atraso). Filtro por tipo no cabeçalho da coluna. Atenção: a lista de notas é `Sidebar.tsx`, e não `NotebookList.tsx`, que lista os cadernos.
- **Por que o Ctrl+P falha** (casos concretos no §6.1):
  - `LIKE` com `LOWER()` do SQLite, que só converte ASCII, sem normalizar acentos;
  - nenhuma separação por palavras;
  - o conteúdo varrido é Markdown cru, com **~6,4 MB de imagens base64**, então buscas de 3 letras "acham" as notas com imagem;
  - um ranking que favorece o nome do caderno;
  - nenhum limite de resultados nem trecho do match.

  **Recomendação:** busca no cliente, normalizada e ranqueada (as notas já estão em memória; o texto real tem ~125 K chars). Depois vêm filtros por tipo e caderno e, sob demanda, "buscar por significado" via RAG. O **FTS5 está disponível** (SQLite 3.45.0 embutido, `SQLITE_ENABLE_FTS5`, tokenizer `trigram` com `remove_diacritics`, e já em produção no `monet-vec.db`), mas fica como plano B enquanto o volume for este.
- **"+" no handle:** hoje **não existe handle genérico de bloco**. O ⋮⋮ só aparece em itens de checklist e em linhas de `/comando` (`CommandExtension.ts:546`, `:360`). A proposta é um *gutter* flutuante único com "+" (Shift = acima) e regras por tipo de bloco. Em checklist, o "+" cria **item comum, nunca task**.
- **Escopo contido:** sem relações entre objetos, fórmulas, visões em tabela, multi-select, tipos por caderno ou IA classificando sozinha.

---

## 2. Inventário (o que existe hoje)

### 2.1 Nota, propriedades e lista

| Camada | Onde | Situação |
| --- | --- | --- |
| Modelo da nota | `src/types/index.ts:19-29` | `id, notebookId, subjectId, title, content (Markdown), tags[], date, createdAt, updatedAt`. Sem tipo nem propriedades |
| Tabela `notes` | `src-tauri/src/lib.rs:1222` (v1); `date` na v8 (`:1342`), `subject_id` na v9 (`:1359`) | Migrations **não rodam no DB de produção** (checksum v11). Coluna nova = padrão `ensure*` + `PRAGMA table_info` (ex.: `ensureNotebookColorColumn`, `src/storage/tauri.ts:784-801`) |
| Gravação | `saveNote` (`tauri.ts:716-742`): UPSERT de **todas** as colunas | Há 24 chamadas a `saveNote(` no `src/`, várias montando `Note` do zero (`App.tsx:594`, `useNotes.ts:73`, `KeepPanel.tsx:150`). Um campo novo no UPSERT seria sobrescrito por quem não o conhece; as propriedades precisam de *setter* próprio (§5.1) |
| Definições de propriedade | `metadata_defs` (`tauri.ts:465-471`), `MetadataDef` (`types/index.ts:107-114`, comentário: "global, não exclusiva de tasks"), `MetadataType` = text/number/date/checkbox (`:101`) | Feito para ser reaproveitado. **0 definições criadas** em produção (estudo de entregas, §3) |
| Valores | `notebook_tasks.metadata` (JSON `{defId: valor}`, `TASKS_EXTRA_COLUMNS`, `tauri.ts:478-487`); exclusão de def com `json_remove` sem BEGIN/COMMIT (`tauri.ts:971-984`) | Modelo "anexar por item" (tipo Notion), não esquema por tipo |
| Controles | `TaskPropertiesBar.tsx` (`renderMetadataControl` ~l.273), `MetadataManagerModal.tsx`, `useMetadataDefs.ts`, `lib/metadata.ts` | Reaproveitáveis quase sem mudança para notas |
| Cabeçalho da nota | `Editor.tsx:822-907`: caderno \| matéria, título, `topSlot` (barra da task), linha data + "+ tag" | É ali que entram o seletor de tipo e a barra de propriedades |
| Lista de notas | `src/components/Sidebar/Sidebar.tsx:46-145` (`SortableNoteItem`): **só o título** + ações no hover | Filtro atual: `visibleNotes` (`App.tsx:1085-1097`): busca local e `activeTag`. Notas-corpo de task ficam fora (`App.tsx:1058-1067`) |
| Texto no RAG | `buildNoteFileText` (`src/lib/noteFileText.ts:248-274`): `# título`, metadados da task (se nota-corpo), `Date:`, `Tags:` | Ponto único para incluir tipo e propriedades |

### 2.2 Tasks, checklist e `group`

| Camada | Onde | Situação |
| --- | --- | --- |
| Checklist → task | "Add to Tasks" no menu de contexto → `AddTaskPopover` (deadline + projeto) → `onCreateTasks` (`Editor.tsx:661-732`) → `createProjectTasks` com `sourceNoteId: activeNote.id` (`App.tsx:2280-2290`) | A pill `<task-ref data-id>` é inserida no item (`TaskRef.ts`). O checkbox do item reflete o status da task (`LinkedTaskItem.ts`). **A tabela nunca escreve na nota** |
| Sync de título | `App.tsx:827-848`: o texto do item na nota de **origem** renomeia a task; cópias em outras notas não | Remove o prefixo "group \| " (`stripGroupPrefix`) |
| Chip na nota | `TaskRefView.tsx:6-34`: `formatDueShort(planDate)` ou "task"; classes overdue/late/closed | Não mostra status. "Oct 26" pode ser do date ou deadline (`planDate = scheduledDate ?? dueDate`, `lib/tasks.ts:223`) |
| Origem | `TaskPropertiesBar` "abrir nota de origem" (`App.tsx:2299-2305`); nota de origem apagada = botão some (`sourceNoteExists`) | Apagar a nota não toca nas tasks |
| `group` | Coluna `task_group` (`tauri.ts:480`), `Task.group` (`types:81`), `normalizeGroup` (`lib/tasks.ts:133`) | Texto livre, sem entidade |
| Onde o group aparece | `TaskCard.tsx:87,252`; `TaskLine.tsx:80,138`; `DueTodayBlock.tsx:45`; `GroupsBoard.tsx` (colunas por group, **mesmo nome em cadernos diferentes vira uma coluna só**; arrastar muda o group); `ProjectsBoard.tsx:25` e `subgroupsByGroup` (`lib/tasks.ts:665`); Group by `'group'` (`lib/tasks.ts:521,593-631`; persistido em `App.tsx:448`, visões salvas `App.tsx:2188`) | 7 componentes e 1 modo de agrupamento |
| Entrada do group | Campo "Group" com sugestões do caderno (`TaskPropertiesBar.tsx:115-123`, `groupsOfNotebook`); conversão em lote "sistema \| ação" (`TasksHeader.tsx:102-121`, `App.tsx:652-670`) | **O quick add não tem token de group** (`taskQuickAdd.ts:12-18`) |
| IA e RAG | `taskLineForAi` (`lib/tasks.ts:983`, "projeto / group"); `taskMetadataLines` `Group:` (`noteFileText.ts:231`); hash de reindexação (`useNotesIndexSync.ts:83`); busca de tasks (`matchesSearch`, `lib/tasks.ts:181-185`); recorrência copia o group (`:844`); texto do bloco `/tasks` (`:761`) | 6 pontos de texto |
| Weekly Review | `WeeklyReview.tsx`: **não usa group** | Ganha agrupamento por TODOS de graça (ligação com a T6 do estudo de entregas) |

### 2.3 Handle de bloco no editor

| O quê | Onde | Situação |
| --- | --- | --- |
| ⋮⋮ de checklist | `makeTaskDragHandle` (`CommandExtension.ts:546-667`), widget por `taskItem` (`:738-751`) | Arrasta só dentro da mesma `taskList` (`computeTaskDropTarget`). Arraste manual com mousedown/mousemove/mouseup (HTML5 nativo não funciona em widget dentro de contenteditable, decisão registrada) |
| ⋮⋮ de `/comando` | `makeDragHandle` (`:360-474`) | Move linha + bloco de resposta juntos (`findCommandRange`, `:338-358`) |
| Outros blocos | Parágrafo, título, listas, tabela, toggle, embed, `/tasks`, nota linkada, imagem | **Sem handle**. Os nodes custom são `draggable: false` (`EmbedBlock.ts:17`, `ToggleBlock.ts:11`, `TasksQueryBlock.ts:29`, `LinkedNoteBlock.ts:17`) |
| Linha em branco | `ParagraphWithBlankLines` (`extensions.ts:52-90`): parágrafo vazio interior vira `<br>` no Markdown | Um "+" que deixa a linha vazia persiste uma linha em branco (igual ao Enter) |

### 2.4 Busca Ctrl+P

| O quê | Onde |
| --- | --- |
| Atalho | `App.tsx:911-914` (captura no `document`, funciona dentro do editor) |
| UI | `SearchPalette.tsx`: debounce 150 ms; cadernos filtrados por `includes` em JS; notas por `storage.searchNotes`; `sortResults` (`:27-36`); preview = 80 primeiros chars do conteúdo (`stripMarkdown`, `:18-25`) |
| Consulta | `tauri.ts:750-762`: `LOWER(title) LIKE %q% OR LOWER(content) LIKE %q% OR LOWER(tags) LIKE %q% ORDER BY updated_at DESC`, **sem LIMIT**, `SELECT *` |
| Base | 151 notas em 9 cadernos; 6,6 M chars, dos quais **98% são imagens base64** (9 notas); texto real ≈ 125 K chars (`central_informacao_study.md` §2) |
| FTS no projeto | `monet-vec.db`: `chunks_fts` FTS5 `unicode61 remove_diacritics 2` (`src-tauri/src/vec_db.rs:161-196`); busca híbrida KNN + FTS + RRF + rerank (`src-tauri/src/rag.rs:243-330, 459, 765-1300`) |
| SQLite | `libsqlite3-sys 0.28.0` *bundled*, SQLite **3.45.0**, compilado com `-DSQLITE_ENABLE_FTS5` e FTS3/JSON1/RTREE. `sqlx-sqlite 0.8.0` (`tauri-plugin-sql 2.4.0`) e `rusqlite 0.31` compartilham a mesma lib. O tokenizer `trigram` aceita `remove_diacritics` nesta versão (verificado no `sqlite3.c` do crate) |

---

## 3. Mercado: somente Capacities

Escopo restrito por instrução do Coordenador.

| Tema | Como o Capacities faz | Fonte |
| --- | --- | --- |
| Objeto e tipo | "Você não decide onde a nota mora; decide **que tipo de coisa ela é** e com o que se conecta." Tipo = estrutura compartilhada via propriedades | [Object types vs folders](https://docs.capacities.io/tutorials/object-types-vs-folders) |
| Propriedades | Por tipo: criar no tipo aplica a todos os objetos dele. Default em todos: Title, Aliases, Description, Icon, Created at, Tags. Tipos de dado: Text, Number, Checkbox, Datetime (com hora/intervalo), **Label (single/multi-select)**, Object Select (relação), Content, Cover Image. Sem tipo URL | [Properties](https://docs.capacities.io/reference/properties), [Object properties](https://docs.capacities.io/reference/object-properties) |
| Quando criar tipo | Teste em 3 perguntas: (1) é um grupo distinto? (2) tem propriedades distintas? (3) query/visibilidade resolveria? Tema que cruza tipos = **tag**, não tipo | [When to create a new object type](https://docs.capacities.io/tutorials/when-to-create-new-object-type) |
| Trocar tipo / propriedade | Conversão de tipo com **mapeamento** de propriedades ("senão a informação se perde"); trocar o tipo de dado cria propriedade nova e mantém a antiga para revisão; links não migram | [Release 11](https://capacities.io/whats-new/release-11), [Mobile](https://docs.capacities.io/reference/mobile), [Release 60](https://capacities.io/whats-new/release-60) |
| Templates | Por tipo; um template padrão (estrela) aplicado na criação; não compartilhado entre tipos | [Templates](https://docs.capacities.io/reference/templates) |
| Visões | Tabela, galeria, wall, lista, embed, kanban; agrupamento e cálculos | [Views](https://docs.capacities.io/reference/views) |
| Tasks dentro de objetos | Task é tipo **embutido**, com status, data, deadline, prioridade e **Context** (o objeto onde foi criada, ligado automaticamente). O objeto ganha uma aba **Tasks** (All/Open/Kanban/Scheduled) com **anel de progresso**. Sem subtask: checkbox ou task aninhada | [Task management](https://docs.capacities.io/reference/task-management), [capacities.io/task-management](https://capacities.io/task-management) |
| Limites declarados | "Não é possível adicionar propriedades custom à Task, e **não está planejado**"; tasks fora de coleções; sem lembretes nem sync de calendário | [Task management](https://docs.capacities.io/reference/task-management) |
| Filosofia de tasks | Task é "a menor unidade de ação", curta; "não são projetos complexos abertos por muito tempo"; "não deveriam precisar de vários níveis de organização"; contexto reduz sobrecarga | [Blog: task management philosophy](https://capacities.io/blog/task-management-philosophy) |
| Busca | Ctrl+P = full-text em conteúdo + **valores** de propriedades; filtro por tipo digitando o nome do tipo; aspas = frase; `^` = começa com; títulos ranqueiam acima de blocos; recentes desempatam. **Search 2.0** roda no dispositivo, offline, trocou fuzzy por match exato com ranking melhor. Busca estendida (Ctrl+Shift+P) agrupa por tipo; modo **semântico** opcional nas queries | [Search](https://docs.capacities.io/reference/search), [Release 58](https://capacities.io/whats-new/release-58) |

**O que se aplica ao Monet**
1. **Tipo como formulário opcional** com propriedades por tipo, template por tipo e conversão com regra clara. É o núcleo do pedido.
2. **Task com contexto** e progresso no objeto-pai. É exatamente o TODOS: a task ganha o entregável como contexto, e a nota mostra o anel/`1/4`.
3. **Não pôr propriedades custom na task.** O Capacities decidiu isso de propósito, e o uso do Coordenador confirma (0 definições). A propriedade mora no entregável.
4. **Label single-select** é o tipo de dado que mais dá retorno em lista e filtro (fase, situação).
5. **Busca local, rápida e exata**, com títulos acima de conteúdo, filtro por tipo e semântica **opcional**.

**O que contraria a `productVision.md` ou o escopo**
- **Organização por classificação no lugar de lugar** ("não decida onde a nota mora"): no Monet o eixo é **caderno → matéria** (o tema de aprofundamento). O tipo é ortogonal e nunca substitui o caderno.
- **Object Select / relações bidirecionais, tabelas, galerias, cálculos:** viram mini-Notion e empurram o trabalho para administrar estrutura, em vez de estudar. Ficam fora.
- **AI autofill de propriedades/descrição:** a IA preenchendo por você contraria o critério 3 (esforço de elaboração). Só sob demanda, se um dia.
- **Task como tipo separado do resto:** no Monet a task já é entidade própria (`notebook_tasks`) e a nota-corpo existe. O TODOS é **nota**, não task.

---

## 4. Proposta — tipos de nota

### 4.1 Modelo de dados

| Peça | Proposta | Por quê |
| --- | --- | --- |
| `note_types` (tabela nova, `CREATE TABLE IF NOT EXISTS` no padrão `ensure*`) | `id, name, icon, color, template TEXT, sort_order, builtin INTEGER, created_at` | Global (decisão do Coordenador). `builtin = 1` só para o TODOS (id fixo `todos`, como `inbox`/`calendar`) |
| `notes.type_id TEXT` | Coluna nova (`ensureNotesColumns` com `PRAGMA table_info(notes)`; "duplicate column" = sucesso, como `ensureNotebookColorColumn`) | `NULL` = nota sem tipo, continua válida |
| `notes.properties TEXT` | JSON `{defId: valor}`, mesmo formato e parser de `notebook_tasks.metadata` (`parseMetadata`) | Reaproveita `MetadataValue`, `formatMetadataValue`, `hasMetadataValue` |
| `metadata_defs` generalizado | Colunas novas: `note_type_id TEXT` (dono da propriedade), `options TEXT` (JSON do select), `show_in_list INTEGER` | A def já é "global". Cada propriedade pertence a **um** tipo (como no Capacities). Sem compartilhar entre tipos no MVP |
| Gravação | Métodos próprios: `setNoteType(noteId, typeId)` e `setNoteProperties(noteId, json)` com `UPDATE` pontual. **Não** entram no UPSERT do `saveNote` | Evita que as 24 chamadas de `saveNote` (keep, merge, mover nota, AssistantPanel) apaguem tipo/propriedades com um `Note` montado sem eles. Mesmo motivo do `setNotebookColor` |
| Leitura | `rowToNote` lê `type_id`/`properties` quando existirem (`SELECT *` já traz) | Sem DDL no cold start de leitura |

Sem BEGIN/COMMIT: cada operação composta (apagar tipo, apagar propriedade) é uma sequência de `execute` idempotentes, como `deleteMetadataDef`.

### 4.2 Editor de tipos

- Modal **"Note types"** (irmão do `StatusManagerModal`/`MetadataManagerModal`): lista de tipos e, por tipo, nome, ícone e cor (paleta `TASK_COLOR_PALETTE`), propriedades (nome, tipo de dado, ordem, "mostrar na lista") e **template**.
- Tipos de dado no MVP: os 4 atuais (text, number, date, checkbox) **+ select single** (recomendado, D3). Fora: multi-select (as tags cumprem), relação, fórmula, URL (text cobre).
- Limite sugerido: até 2 propriedades com "mostrar na lista", para a lista não virar tabela.

### 4.3 Na nota

- **Seletor de tipo** na linha de data/tag (`Editor.tsx:840`): chip "＋ type" → menu com os tipos e "Sem tipo"; ao lado do título aparece o rótulo colorido do tipo (como o rótulo de tipo do Capacities, acima do título).
- **Barra de propriedades** no `topSlot`, com os controles do `TaskPropertiesBar` (extrair `renderMetadataControl` para um componente comum). Mostra todas as propriedades do tipo, vazias ou não. Sem "+ Add property" avulso: a propriedade se cria no tipo.
- **Template:** aplicado ao escolher o tipo **numa nota vazia** ou em "New <tipo>" (menu do "+" da lista de notas). Em nota com conteúdo, nunca sobrescreve; oferece "Inserir template no fim".

### 4.4 Na lista de notas (`Sidebar.tsx`)

- Linha: ícone/cor do tipo antes do título; à direita, até 2 valores com `show_in_list` (ex.: select "Fase: HML", data "12/11"). TODOS: progresso e prazo (§5.5).
- **Filtro por tipo** no cabeçalho "Notes": chip/dropdown "All · TODOS · …", só com tipos presentes no caderno. Entra em `visibleNotes` como o `activeTag` (`App.tsx:1088`).

### 4.5 Trocar o tipo, apagar propriedade, apagar tipo

| Evento | Regra |
| --- | --- |
| Trocar o tipo da nota | Propriedades com o **mesmo nome e tipo de dado** são migradas para as defs do novo tipo; as demais ficam **guardadas** no JSON (não aparecem e não vão ao RAG) e voltam se o tipo voltar. Confirmação lista o que fica oculto. Inspirado no mapeamento do Capacities, sem tela de mapeamento |
| Tirar o tipo | `type_id = NULL`; valores guardados (mesma regra) |
| TODOS → outro tipo | Se houver tasks vinculadas: confirmação "N tasks deixam de pertencer a esta TODOS (não são apagadas)" e `parent_note_id = NULL` nelas |
| Apagar propriedade | `json_remove` em `notes.properties` + `DELETE` da def (padrão `deleteMetadataDef`) |
| Apagar tipo | Confirmação com contagem; `type_id = NULL` nas notas; defs do tipo apagadas; valores removidos. O TODOS (`builtin`) não pode ser apagado |
| Trocar o tipo de dado de uma propriedade | Fora do MVP (apagar e recriar). Se entrar: criar nova e manter a antiga até revisão, como o Capacities |

### 4.6 RAG e chat

- `buildNoteFileText` ganha `Type: <nome>` e uma linha por propriedade com valor (`Fase: HML`), entre `Date:` e `Tags:`. O hash do `useNotesIndexSync` inclui `type_id` e `properties`.
- Para TODOS: `Tasks: 1/4 done · next deadline 2026-10-26`. Só muda quando o progresso muda; a reindexação é barata (texto real ~125 K chars).
- `taskMetadataLines`: `Group:` vira `TODOS: <título da nota>`; `taskLineForAi` idem.

### 4.7 Quais notas podem ter tipo

| Nota | Recomendação | Motivo |
| --- | --- | --- |
| Notas comuns, inclusive as do **Reader/Library** | Sim | São notas normais de um caderno, ligadas ao livro só por `localStorage` (`readerNoteLink.ts`). Um tipo "Fichamento" com Autor/Páginas faz sentido |
| **Notas diárias do Calendar** | Não no MVP | Já são um "tipo" implícito (título `dd/mm/yyyy`, regras próprias em `getNotesByDateRange`). Tipar abre conflito de template |
| **Nota-corpo de task** | Não | Ela é o corpo de uma task. Tipá-la (ex.: TODOS) criaria task-dentro-de-task (subtask de subtask) e duplicaria as propriedades que a task já tem |

---

## 5. Proposta — TODOS (entregável)

### 5.1 O que é

Um tipo **embutido** (`todos`) cuja nota representa uma entrega ou frente, o que hoje é o group ("sistema | ação"). As tasks criadas no checklist dela são as subtasks e continuam tasks completas (status, Kanban, Week, deadline, do date, recorrência, nota-corpo).

O print de 20/10 já mostra o uso: caderno "Migração", nota com nome de sistema, tag `#Task` fazendo papel de tipo, seções "Status" e "TODO" e 4 tasks com chip "Oct 26". O template padrão do TODOS copia isso: `## Status` + `## TODO` + `- [ ] `.

Propriedades: **derivadas** (não editáveis), calculadas das tasks vinculadas:
- progresso `done/total` (dropped fora do total);
- próximo prazo;
- atraso.

Nenhuma propriedade obrigatória. O usuário pode acrescentar as suas ao TODOS (ex.: select "Fase").

### 5.2 Vínculo task → TODOS: coluna nova `parent_note_id`

| Opção | Prós | Contras |
| --- | --- | --- |
| **A. `parent_note_id` novo** (em `TASKS_EXTRA_COLUMNS`) — **recomendado** | Pai editável (picker, arrastar no board, quick add) sem mexer na semântica de origem; task criada na nota diária pode pertencer a uma TODOS; task do quick add pode ser vinculada sem linha no checklist | Um campo a mais; pai e origem coincidem quase sempre |
| B. Reaproveitar `source_note_id` | Zero coluna | A origem governa o sync de título e o "abrir nota de origem". Mudar o pai mudaria a origem; tasks de nota diária (3 hoje) não poderiam ir para uma TODOS sem perder o vínculo com o dia |

Regras:
- "Add to Tasks" numa nota TODOS grava `source_note_id` **e** `parent_note_id` = a nota.
- Em nota sem tipo TODOS, só a origem, como hoje.
- O progresso vem de `tasks.filter(t => t.parentNoteId === note.id)`, e **não** do Markdown. A nota não precisa ter a pill para a task contar.

### 5.3 Substituição do `group` (impacto por superfície)

| Superfície | Hoje | Com TODOS |
| --- | --- | --- |
| Card/linha (`TaskCard`, `TaskLine`, `DueTodayBlock`) | Chip com o texto do group | Chip com o **título da TODOS** (ícone do tipo), clicável → abre a nota |
| Detalhe (`TaskPropertiesBar`) | Campo "Group" com sugestões | Campo **"TODOS"**: picker das TODOS (do caderno primeiro, depois as demais), "＋ Nova TODOS…", botão abrir. "Abrir nota de origem" continua |
| List — Group by | `'group'` | `'todos'`: seção = TODOS (subtítulo = projeto, como hoje); "Sem TODOS" no fim |
| Projects board / subgrupos | Subgrupo por group | Subgrupo por TODOS |
| **Groups board** | Coluna por texto (mesmo nome em cadernos diferentes = 1 coluna) | **TODOS board**: coluna por nota (sem fusão por nome; título + caderno no cabeçalho); arrastar define `parent_note_id` |
| Kanban / Week / My Day | Chip de group no card | Chip da TODOS (mesma posição) |
| Visões salvas | `config.groupBy = 'group'` (`task_views`, localStorage `App.tsx:448`) | Ler `'group'` como `'todos'` no `rowToTaskView` e no restore (sem regravar) |
| Busca de tasks | `matchesSearch` casa título ou group | Título ou título da TODOS |
| Conversão "sistema \| ação" (`TasksHeader`) | Vira group | Vira **vínculo** com a TODOS "sistema" do caderno (cria com confirmação, como `#Projeto` novo) |
| Quick add | Sem group | Opcional (D8): token `>Nome` com autocomplete e confirmação para criar. No "+ task" da seção de tasks do caderno (`NotebookTasksSection`) com uma TODOS aberta, o pai vem preenchido |
| Weekly Review | Sem group | Concluídas e escorregadas agrupadas por TODOS (base da T6, relatório de status) |
| Chat / RAG | "projeto / group", `Group:` | "projeto / TODOS título", `TODOS:`; `query_tasks` aceita filtro `todos` ("o que falta no X?") |
| Recorrência | Copia o group | Copia o `parent_note_id` |
| Coluna `task_group` | Fonte | **Dormente** (backup) após a migração; código de leitura removido; a coluna sai numa limpeza posterior (D11) |

### 5.4 Chip da task na nota (`TaskRefView`)

Hoje: `Oct 26` em laranja (ambíguo). Proposta, da esquerda para a direita, só o que tiver valor:

`● Doing  Oct 24 → ⚑ Oct 26  ↻2  ★`

- `●` = cor do status do registro (`statusColor`), com o nome no tooltip. Clique no ponto cicla o status (mesmo `nextStatus` do atalho `s`); clique no resto abre a task (como hoje).
- **do date** sem ícone; **deadline** com ⚑. Se só houver um, aparece só ele, com o ícone certo. Fim da ambiguidade.
- Atraso: vermelho (deadline) ou amarelo (do date), regras atuais (`overdueKind`).
- Concluída: chip esmaecido (classe `closed` atual).
- Tooltip: projeto, TODOS (se o item estiver fora da sua TODOS), checklist da nota-corpo `3/5`.
- Sem metadados custom no chip.

### 5.5 Progresso na lista e na nota

- Lista (`Sidebar.tsx`): `TODOS · 1/4 · ⚑ 26/10`, vermelho se houver deadline estourado, verde-esmaecido quando 4/4. Função pura `todosProgress(tasks, noteId)` em `lib/tasks.ts`.
- Na nota TODOS, barra fina abaixo do título com o mesmo resumo, mais um bloco **"Vinculadas fora deste checklist"** (tasks com `parent_note_id` = nota e sem pill no conteúdo). Cada uma tem a ação "Inserir no checklist", feita por clique e nunca automática.

### 5.6 Migração dos groups

Números conhecidos: 23 tasks, **91% com group**, 3 projetos (estudo de entregas, 12–16/out). O volume é pequeno, mas são dados reais do Coordenador.

1. **Pré-requisitos:** `note_types` + `notes.type_id` + `parent_note_id` no ar.
2. **Dry-run (modal, nada gravado):** agrupa por (caderno, `normalizeName(group)`) e lista, por linha:
   - quantas tasks (abertas/fechadas);
   - grafias fundidas ("Sistema"/"sistema", vence a mais frequente);
   - **nota existente com o mesmo título no caderno** (fora de nota-corpo/Calendar), como a "autofrotawkflwweb" do print, com a ação "converter em TODOS";
   - ou "criar nova TODOS".

   O Coordenador revisa e confirma.
3. **Execução (sem BEGIN/COMMIT, idempotente):**
   - nota nova com **id determinístico** (`todos-<hash(caderno + group normalizado)>`), tipo `todos`, template + checklist com as tasks (`- [ ] título <task-ref data-id=…>`; fechadas como `- [x]`);
   - nota existente: `setNoteType` + seção `## Tasks (migradas)` no fim, só com as tasks que ainda não têm pill ali;
   - `UPDATE notebook_tasks SET parent_note_id = $nota WHERE id IN (…) AND parent_note_id IS NULL`;
   - task sem origem (`source_note_id IS NULL`) recebe a TODOS como origem, para o sync de título e o "abrir origem" funcionarem.

   Reexecutar não duplica: o id é determinístico e o `WHERE` ignora tasks já vinculadas.
4. **Depois:** flag de migração concluída. O `task_group` não é apagado.

| Edge case | Tratamento |
| --- | --- |
| Group sem nota correspondente | Cria a TODOS (é o caso comum) |
| Task sem group (~9%) | Fica sem pai ("Sem TODOS"); válido |
| Mesmo group em cadernos diferentes | Uma TODOS **por caderno** (o Groups board atual fundia; o TODOS board separa e mostra o caderno). O Coordenador pode juntar depois, movendo tasks |
| Group que só tem tasks concluídas | Cria a TODOS com tudo marcado (histórico); o dry-run permite desmarcar "criar" para ela |
| Nota TODOS já aberta durante a migração | Rodar com a nota fechada; nota nova não tem esse risco |

### 5.7 Edge cases do uso contínuo

| Caso | Comportamento proposto |
| --- | --- |
| Task criada fora de nota (quick add, Kanban, NotebookTasksSection) | Sem pai, ou pai pelo token/contexto (§5.3). Vincular depois: picker no detalhe ou arrastar no TODOS board. Aparece no bloco "Vinculadas fora deste checklist" |
| Item removido do checklist da TODOS | A task **continua** vinculada (a nota nunca apaga task, regra atual) e passa ao bloco "fora deste checklist". Desvincular é ação explícita |
| Nota TODOS apagada | Confirmação: "N tasks ficarão sem TODOS (não serão apagadas)"; `parent_note_id = NULL` nelas. Nota apagada por fora (outra janela): pai inexistente é tratado como nulo na leitura, como o `sourceNoteExists` |
| Task movida para outro caderno | **Permitido** e o vínculo se mantém (TODOS pode cruzar projetos; o board mostra o caderno). Não move a nota junto. Alternativa em D10 |
| TODOS movida para outro caderno | As tasks ficam onde estão; o vínculo segue (é por id) |
| Pill copiada para outra nota | Continua mostrando a task; não muda o pai (o mesmo princípio de "cópias não sobrescrevem") |
| Tipo trocado de TODOS para outro | §4.5 (desvincula com confirmação) |
| "todos" em português = "all" | Risco de ambiguidade: o `STOPWORDS` do RAG **remove "todos"** dos termos FTS (`rag.rs:262`), e o roteador e o LLM podem ler "todos" como "all". Mitigação: na UI, sempre **TODOS** em maiúsculas; no texto para a IA, "TODOS note (deliverable)"; filtros explícitos (`type:TODOS`, `todos` como parâmetro de tool), nunca a palavra solta |

---

## 6. Proposta — busca Ctrl+P

### 6.1 Diagnóstico com casos concretos

| # | Caso | Por que falha (código) |
| --- | --- | --- |
| B1 | Buscar **"migracao"** não acha "Migração" | Sem normalização de acentos. O `normalizeName` existe (`lib/tasks.ts:679`), mas só nas tasks |
| B2 | Buscar **"MIGRAÇÃO"** ou "Ção" pode falhar contra título "MIGRAÇÃO" | `LOWER()` do SQLite só converte ASCII: `LOWER('MIGRAÇÃO') = 'migraÇÃo'`, e o JS envia `'%migração%'` |
| B3 | **"rag híbrido"** não acha "RAG e busca híbrida" nem "híbrido… RAG" | A consulta inteira é **uma** substring contígua; não há tokens nem AND entre palavras |
| B4 | Consultas curtas (**3–4 letras**, ex.: "rag", "api", "hml") trazem as notas com imagem coladas | O `LIKE` varre o Markdown cru, que inclui **~6,4 MB de base64**. Estimativa: uma sequência de 3 letras aparece ~200 vezes por acaso nesse volume; de 4 letras, ~6 vezes |
| B5 | **"task"**, "embed", "data", "br" casam com notas sem essas palavras no texto | Tags e comentários internos no conteúdo: `<task-ref data-id>`, `<!--monet-embed:…-->`, `<linked-note>`, `<br>`. Respostas de IA embutidas também entram como se fossem texto do usuário |
| B6 | Nota com o termo **no título** aparece abaixo de notas que só o têm no corpo | `sortResults` dá score 0 a notas do **caderno** cujo nome contém o termo (antes do título!); dentro do score, vale `updated_at`. Sem bônus para título exato ou prefixo |
| B7 | Lentidão e lista enorme em termos comuns | Sem `LIMIT`; `SELECT *` devolve o conteúdo completo (inclusive base64) via IPC a cada tecla (debounce 150 ms); todos os resultados são renderizados |
| B8 | Preview inútil | Mostra os 80 primeiros chars da nota, não o trecho do match; `stripMarkdown` não remove HTML/pills |
| B9 | Palette vazia ao abrir | Sem "recentes" com consulta vazia: não serve como troca rápida de nota |
| B10 | Títulos vazios | Todas viram "Untitled", indistinguíveis (o preview do B8 não ajuda) |
| B11 | Erros de digitação ("autofrotawkflweb") | Sem tolerância |
| B12 | Resultados misturados | Notas-corpo de task e notas diárias aparecem sem rótulo; tasks, livros e grifos não aparecem |

### 6.2 Abordagens

| Abordagem | Resolve | Custo | Contras | Veredito |
| --- | --- | --- | --- | --- |
| **S-A. Busca no cliente** sobre as notas já em memória (`notes` do `App`): texto limpo por nota (reusar `cleanNoteContentForAi`, sem base64 e sem tags), normalizado (`NFD` sem diacríticos, minúsculas), memoizado por `updatedAt`; tokens com **AND**; ranking título exato > prefixo > palavra do título > substring do título > conteúdo, desempate por recência; snippet em volta do 1º match com destaque; limite 30; recentes com consulta vazia; rótulo "Daily"/"Task" | B1–B10 | P–M | Escala até alguns milhares de notas (hoje: 151 notas, ~125 K chars de texto) | **Fazer agora** |
| S-A + **fuzzy leve** (distância 1 para termos ≥ 5 letras, só em título) | B11 | P | Falso positivo em termo curto | Junto, limitado a títulos |
| **S-B. FTS5 em `monet.db`**: `notes_fts(title, body)` com `tokenize='trigram remove_diacritics 1'` (substring em qualquer posição, ≥ 3 chars) ou `unicode61 remove_diacritics 2` + prefixo; `bm25()` e `snippet()`; o frontend grava o texto limpo após o `saveNote`; backfill no `ensure*` (como `ensure_fts` do `vec_db.rs`) | B1–B8 em escala | M | Segunda escrita sem transação (pode divergir; precisa de reconciliação no startup); a keep window também grava; trigram ~3× o texto; *triggers* SQL indexariam o base64 | **Plano B** se passar de ~2–3 mil notas ou a S-A ficar lenta |
| **S-C. Híbrida via RAG** (`hybrid_search`: KNN + `chunks_fts` + RRF) | Busca por significado ("aquela nota sobre retenção") | M | Precisa de chave e rede (embedding da consulta), 0,3–1 s+, depende de a nota já estar indexada, devolve **trechos** e mistura KB/livros | **Sob demanda:** linha "Buscar por significado…" no fim da lista (Enter ou clique). A IA fica à mão, sem se impor |
| **S-D. Filtros** | Achar por tipo, caderno ou propriedade | P–M | — | `#Caderno` (mesmo parser de projeto), `type:TODOS` ou chip de tipo, `prop:valor` depois; seção **Tasks** na palette (título + TODOS) |

Encaixe com o estudo irmão: a I12 do `central_informacao_study.md` ("Busca única": notas, KB, grifos, tasks; FTS5 + semântica) é o destino. S-A + S-D é a primeira fatia dela, sem depender do I4.

---

## 7. Proposta — "+" no handle de bloco

**Comportamento:** ao passar o mouse numa linha ou bloco, aparece à esquerda `+ ⋮⋮`. Clique no "+" insere uma linha **abaixo**; **Shift+clique**, **acima**. O cursor vai para a linha nova. É o padrão Notion/Capacities.

**Implementação sugerida:**
- Um **gutter flutuante único**, fora do contenteditable (absoluto no `bodyWrap`), posicionado no `mousemove` com `view.posAtCoords` e resolvido para a "unidade de bloco" mais próxima.
- **Não** criar um widget por bloco, como o ⋮⋮ de checklist faz hoje (`key: taskdrag-${pos}`, recriado a cada transação): seria custo e ruído de DOM.
- Eventos de mouse manuais (a decisão já registrada sobre HTML5 drag vale também para o futuro arrastar genérico).
- Escondido em PreviewMode e em células de tabela.
- Mantém os ⋮⋮ atuais no MVP; unificar o arrastar de qualquer bloco é a fase 2.

| Bloco sob o mouse | "+" (Shift = acima) |
| --- | --- |
| Parágrafo, título, citação, código | Parágrafo vazio depois/antes (título não gera título) |
| **Item de checklist** | Novo `taskItem` irmão, mesmo nível, desmarcado, **sem task**. Criar task segue explícito ("Add to Tasks"), regra atual e coerente com "nada vira task sem ação". Na TODOS, ver D9 |
| Item de lista (bullet/numerada) | Novo item irmão no mesmo nível |
| Tabela | Parágrafo depois/antes da **tabela** (linhas e colunas pelo menu da tabela); sem gutter dentro das células |
| Toggle | Sobre o cabeçalho: depois/antes do toggle inteiro. Sobre um bloco dentro do toggle aberto: dentro do corpo |
| Embed de resposta, bloco `/tasks`, nota linkada, imagem | Parágrafo depois/antes do bloco (são atômicos) |
| Linha de `/comando` com resposta embutida | Trata linha + embed como unidade (`findCommandRange`): o "+" abaixo insere **depois do embed**, sem separar o par |
| Parágrafo vazio final | Sem "+" (o Enter já cobre) |

---

## 8. Propostas priorizadas

Esforço: P (até 1 dia), M (2–4 dias), G (1+ semana).

Visão (`productVision.md`): ① sustenta a permanência no tema · ② mantém o material do usuário no centro · ③ preserva o esforço de elaboração · ④ IA à mão sem se impor. ✓ = reforça, – = neutro, ✗ = contraria.

### Bloco 1 — Busca (independente; ganho imediato)

| # | Proposta | Valor | Esforço | Riscos | Conflito / Visão |
| --- | --- | --- | --- | --- | --- |
| S1 | **Ctrl+P no cliente** normalizado, por tokens e ranqueado, com snippet, limite, recentes e rótulos (S-A + fuzzy em título) | **Alto** (dor relatada) | P–M | Texto limpo por nota precisa de memo (base64 pesa na limpeza) | Nenhum · ①✓ ②✓ ③– ④– |
| S2 | **Filtros** `#Caderno`, `type:`, seção Tasks na palette | Médio-alto | P–M | Sintaxe demais: mostrar chips clicáveis, não só texto | Nenhum · ①✓ ②✓ ③– ④– |
| S3 | **"Buscar por significado…"** sob demanda (RAG híbrido) | Médio | M | Sem chave/rede: a linha some | Nenhum · ②✓ ④✓ |
| S4 | FTS5 `notes_fts` em `monet.db` (plano B) | Baixo hoje | M | Duas escritas sem transação | Nenhum · ②✓ |

### Bloco 2 — Editor (independente)

| # | Proposta | Valor | Esforço | Riscos | Conflito / Visão |
| --- | --- | --- | --- | --- | --- |
| E1 | **"+" no gutter** (Shift = acima), regras do §7 | Médio | M (P se só blocos de topo + checklist) | `posAtCoords` com NodeViews React; flicker no hover; não separar `/comando` + embed | Nenhum · ③– (ergonomia) |
| E2 | Arrastar qualquer bloco pelo mesmo gutter (generalizar `computeDropTarget`) | Médio | M | Mesmo da E1; listas e toggles aninhados | Nenhum |

### Bloco 3 — Tipos de nota

| # | Proposta | Valor | Esforço | Riscos | Conflito / Visão |
| --- | --- | --- | --- | --- | --- |
| N1 | **Modelo**: `note_types`, `notes.type_id`, `notes.properties`, `metadata_defs` generalizado, setters próprios (§4.1) | Base | M | Sobrescrita por `saveNote` → setters separados | Nenhum · ①✓ |
| N2 | **Editor de tipos** (modal) com propriedades e template | Alto | M | Virar mini-Notion: travas do §4.2 | Nenhum · ③✓ (estrutura que o usuário define) |
| N3 | **Seletor de tipo + barra de propriedades** na nota | Alto | P–M | Cabeçalho mais alto: barra recolhível | Nenhum · ②✓ |
| N4 | **Lista com tipo, 2 propriedades e filtro por tipo** | Alto | P–M | Linha poluída: limite de 2 | Nenhum · ①✓ |
| N5 | **Template por tipo** (só em nota vazia) | Médio | P | — | Nenhum · ③✓ (template estrutura, não escreve por você) |
| N6 | **`select` single** com opções coloridas | Médio-alto | P–M | — | Nenhum |
| N7 | **Tipo e propriedades no RAG** | Médio | P | Reindexação única das notas tipadas | Nenhum · ②✓ ④✓ |

### Bloco 4 — TODOS

| # | Proposta | Valor | Esforço | Riscos | Conflito / Visão |
| --- | --- | --- | --- | --- | --- |
| T1 | **Tipo `todos` embutido + `parent_note_id`** + "Add to Tasks" na TODOS vincula + campo TODOS no detalhe | **Alto** | M | Dois vínculos (origem × pai) confundirem: na UI só aparece "TODOS" e "abrir origem" | Nenhum · ①✓ ②✓ |
| T2 | **Migração group → TODOS** com dry-run e execução idempotente (§5.6) | **Alto** (dados reais) | M | Nota de mesmo título com conteúdo: só anexa seção no fim | Nenhum |
| T3 | **Trocar group por TODOS** em todas as superfícies (§5.3) | Alto | M | Superfícies esquecidas: usar a lista do §2.2 como checklist | Nenhum · PRD "não é PM": ok, é 1 nível só |
| T4 | **Chip rico** na nota (§5.4) | Alto | P–M | Linha longa: ocultar partes vazias | Nenhum · ①✓ |
| T5 | **Progresso derivado** na lista e na nota + bloco "fora deste checklist" | Alto | P | — | Nenhum · ①✓ |
| T6 | **IA e RAG**: `TODOS:` nos textos, filtro `todos` no `query_tasks`, cuidado com a palavra "todos" | Médio | P | Stopword "todos" | Nenhum · ④✓ |

**Não recomendado (agora):** relações entre notas (Object Select), fórmulas, visões em tabela ou galeria por tipo, multi-select, tipos por caderno, IA classificando o tipo ou preenchendo propriedades sozinha, tipo em nota diária e em nota-corpo, propriedades custom em task (§9, D2).

---

## 9. Destino das tags e dos metadados custom de task

- **Tags.** O único uso visível no print é `#Task` fazendo papel de **tipo**. Tipos absorvem o "que tipo de coisa é". Às tags resta o "tema que cruza tipos" (o próprio teste do Capacities), que o caderno já cobre em boa parte.
  - Recomendação: na migração, oferecer **converter tags com o nome de um tipo** (`#Task`, `#TODOS`) em tipo.
  - Manter o critério de corte do `tags_study.md`: sem uso do filtro transversal até ~12/11, **remover tags** (linha do editor, bloco da sidebar, `Tags:` no RAG, peso no Related).
- **Metadados custom de task.** Eles têm 0 definições e o Capacities recusa isso de propósito.
  - Recomendação: **tirar o "+ Add property" da task** (e o `visibleMetadata` do card) e fazer de `metadata_defs` só propriedades de tipo de nota.
  - A coluna `notebook_tasks.metadata` fica dormente e sai na mesma limpeza do `task_group`.
  - Isso confirma a leitura do Orquestrador: a task é pequena demais para propriedades; o entregável (TODOS) é o lugar delas.

---

## 10. Fases

| Fase | Conteúdo | Resultado |
| --- | --- | --- |
| **0 — Decisões** (sem código) | D1–D11 abaixo | Escopo fechado |
| **1 — Ganhos rápidos** (~3–4 dias) | S1 busca no cliente; E1 "+" no gutter | O Ctrl+P passa a achar; editor mais fluido. Independentes do resto |
| **2 — Tipos de nota** (~1 semana) | N1, N2, N3, N5, N6 (se D3), N7; regras §4.5 | Tipos com propriedades e template; nada muda para nota sem tipo |
| **3 — TODOS e fim do group** (~1–1,5 semana, **um release só**) | T1, T2 (dry-run → confirmação → execução), T3, T4, T5, T6, N4 | O group some da UI no mesmo release em que os dados migram; nunca há dois conceitos convivendo |
| **4 — Busca por tipo e semântica** (~3–4 dias) | S2 filtros; S3 sob demanda; E2 se a E1 pegar | Busca única começando pelas notas (I12) |
| **5 — Limpeza** (4 semanas após a fase 3) | Remover `task_group` e metadados de task do código; decidir tags (critério do `tags_study`) | Menos superfície |
| Condicional | S4 FTS5 | Só se o volume justificar |

---

## 11. Riscos

| Risco | Mitigação |
| --- | --- |
| `saveNote` (UPSERT de todas as colunas) apagar tipo/propriedades vindo de outra janela ou de código que monta `Note` do zero | Tipo e propriedades **fora** do `saveNote`, com `UPDATE` pontual (§4.1) |
| Eco defasado entre janelas (main/keep/assistant), já visto no chat | Setters pontuais, mais releitura por id após gravar |
| Migração parcial (sem transação) | Passos idempotentes, ids determinísticos, `WHERE parent_note_id IS NULL`, `task_group` preservado |
| Editor de tipos crescer para mini-Notion | Lista "não recomendado" (§8) como trava; sem relação, fórmula ou tabela |
| Ambiguidade de "todos" (PT "all") | §5.7 |
| `tiptap-markdown` sem manutenção | Propriedades em coluna, não no Markdown; a migração só gera Markdown já suportado (checklist + `<task-ref>`) |
| Reindexação do RAG | Uma vez por nota tipada; texto pequeno |

---

## 12. Decisões necessárias do Coordenador

1. **D1 — Tags:** converter `#Task`/`#TODOS` (e tags com nome de tipo) em tipo na migração e manter o critério de corte do `tags_study` (remover se o filtro transversal não pegar até ~12/11)? Ou remover as tags já junto com a fase 3?
2. **D2 — Metadados custom de task:** remover o "+ Add property" da task e reservar `metadata_defs` para propriedades de tipo de nota (recomendado)? Ou manter escondido em "avançado" (T12 do estudo de entregas)?
3. **D3 — `select` no MVP:** entra o single-select (recomendado; é o que mais rende em lista e filtro)? Multi-select fica fora?
4. **D4 — Quais notas podem ter tipo:** Reader/Library sim; notas diárias do Calendar não (no MVP); nota-corpo de task nunca. De acordo?
5. **D5 — Busca:**
   - fazer a S1 (cliente) agora e deixar o FTS5 como plano B por volume?
   - incluir a linha "Buscar por significado…" (RAG, sob demanda) na fase 4?
   - incluir tasks como resultados do Ctrl+P?
6. **D6 — Vínculo:** coluna nova `parent_note_id` (recomendado) ou reaproveitar `source_note_id`?
7. **D7 — Migração:**
   - (a) converter nota existente de mesmo título (como a do print) em vez de criar outra?
   - (b) groups com tasks só concluídas também viram TODOS?
   - (c) mesmo nome em cadernos diferentes = TODOS separadas (recomendado)?
8. **D8 — Quick add:** criar o token `>Nome` para vincular à TODOS, ou só pelo picker, pelo board e pelo contexto da nota aberta?
9. **D9 — "+" e Enter no checklist de uma TODOS:** item comum (recomendado; vira task só com "Add to Tasks")? Ou, só dentro de TODOS, o item novo já nasce como task?
10. **D10 — Task em outro caderno que a TODOS:** permitir e manter o vínculo (recomendado), ou mover junto ou impedir?
11. **D11 — Limpeza:** remover `task_group` e `notebook_tasks.metadata` do código 4 semanas após a fase 3?

---

## 13. Decisões do Coordenador (2026-10-20)

| # | Decisão | Consequência para o escopo |
| --- | --- | --- |
| **D1** | Tags **não** são removidas por enquanto | Sem conversão automática de tags em tipo; tags seguem como estão. O corte do `tags_study` fica em aberto |
| **D2** | Metadados custom de task **ficam** | Conflito a evitar: hoje o picker da task lista **todas** as `metadata_defs` e apagar uma def limpa as tasks (`stripMetadata`). Com tipos reaproveitando a mesma tabela, as propriedades de nota (ex.: "Professor") apareceriam na task. Solução: coluna `scope` (`'task'` \| `'note'`) em `metadata_defs`, padrão `ensure*`; defs atuais = `'task'`; cada picker filtra pelo seu escopo. `notebook_tasks.metadata` **não** sai na limpeza |
| **D3** | `select` de **seleção única** no MVP; multi-select fora | — |
| **D4** | **Só notas de caderno** podem ter tipo | Fora: notas do Reader/Library, notas diárias do Calendar e nota-corpo de task |
| **D5** | Recomendação aceita | S1 (busca no cliente) agora; FTS5 como plano B por volume; "Buscar por significado" (RAG, sob demanda) na fase 4; tasks nos resultados do Ctrl+P |
| **D6** | Coluna nova `parent_note_id` | `source_note_id` segue como origem |
| **D7** | (a) a nota do print era teste e será apagada pelo Coordenador — sem conversão de nota existente | (b) e (c) seguem o desenho do §5: group só com concluídas vira TODOS com opção de desmarcar no dry-run; mesmo nome em cadernos diferentes = TODOS separadas |
| **D8** | Token `>Nome` no quick add | — |
| **D9** | "+"/Enter no checklist de uma TODOS cria **item comum** | Vira task só com "Add to Tasks" |
| **D10** | Task em outro caderno mantém o vínculo com a TODOS | — |
| **D11** | Remover o **group** (`task_group`) do código 4 semanas após a fase 3 | Por D2, `notebook_tasks.metadata` permanece |
