# Estudo: painel de cards para notas com tipo (Board por tipo)

> Data: 2026-10-29 · Só leitura: nenhum código, schema ou dado alterado · Base: branch `develop`, commit `dc00e73`
> Pedido do Coordenador: criar uma visualização em cards das notas que têm tipo, parecida com o board de Tasks, com as colunas definidas pelas propriedades do próprio tipo. O caso concreto é um radar tecnológico no estilo ThoughtWorks. A regra é **genérico ou nada**: qualquer tipo, atual ou futuro, ganha o painel só por configuração. A preferência do Coordenador é ligar o painel no próprio modal de tipos.
> Task Report: `DOCS/reports/29-10-2026/taskreport_20261029122720.md`. Estudo de base: `note_types_study.md`.
> Dados de uso: vêm de uma **cópia** do `monet.db` de produção (`%APPDATA%\com.monet.app\`, com `-wal`/`-shm`), lida no scratchpad em 2026-10-29 12:2x. O original não foi aberto e não existe instalação MSIX nesta máquina.
> Privacidade: o repositório é público. Aqui aparecem só nomes de tipo, de propriedade e de opção, além de contagens. Títulos e conteúdo de notas ficam de fora.

---

## 1. TL;DR

- **Veredito: o genérico é viável.** Todas as peças que o board precisa já são genéricas. O tipo tem propriedades `select` com opções ordenadas e coloridas. Os valores ficam em `notes.properties` (JSON `{defId: optionId}`) e têm um setter próprio (`setNoteProperties`), que não sofre interferência do `saveNote`. O arrasto do board de Tasks (`useCardDrag`) já trabalha só com ids. Nada no desenho depende do radar.
- **Regra de elegibilidade:** um tipo pode ter board se tiver **pelo menos uma propriedade `select`**. As opções viram as colunas, na ordem em que estão definidas, e uma coluna "No value" junta as notas sem valor. Arrastar o card grava o id da opção na nota. Um tipo sem `select` não tem board. O modal mostra o motivo e não inventa um agrupamento padrão.
- **Configuração no modal de tipos (opção do Coordenador, recomendada):** uma seção "Board" no detalhe do tipo, guardada em JSON numa coluna nova, `note_types.board`. Ela define a propriedade das colunas, um segundo eixo opcional (subseções dentro da coluna), até 3 campos no card e se a coluna "No value" aparece.
- **Não precisa de flag por nota.** Para tirar uma nota do board, basta deixar a propriedade da coluna vazia (com "No value" oculta) ou arquivar a nota. Quem quiser um "mostrar no board" explícito cria uma propriedade checkbox no tipo e a usa como filtro. Continua genérico e não muda o schema das notas.
- **Produção hoje:** são 9 tipos e 38 notas tipadas de 192 (20%). Só **2 tipos têm `select`**:
  - **Radar:** `Category` e `Classification`, 4 opções cada, 2 notas, criado hoje;
  - **TODOS:** `Status`, 5 opções, 12 notas, 8 delas sem valor.

  Os outros 7 tipos não teriam board. O caso concreto ainda tem **2 notas**, então o ganho é potencial, não medido.
- **Reaproveitamento:**
  - Sem mudança: `useCardDrag`, o padrão `columnsFor`/`onDrop`, as `sections` das colunas, a coluna de valor órfão do Kanban e o modal de edição sobre o board.
  - Precisam ser trocados: `TaskCard`, a casca `BoardView` (header, resumo, teclado e lote de tasks) e o tipo `Task` fixo no `BoardColumns`.
- **O radar circular fica fora.** Com colunas = anel e subseções = quadrante, o board mostra a mesma informação. Como saída visual, um **export CSV** genérico (título + propriedades) alimenta o "Build your own Radar" da ThoughtWorks.
- **Esforço:** fase 1 entre 4 e 5 dias (M). A fase 2 é opcional, de 2 a 3 dias.

---

## 2. Inventário (o que existe hoje)

### 2.1 Tipos, propriedades e valores

| Peça | Onde | Situação para o board |
| --- | --- | --- |
| Tipo de nota | `src/types/index.ts:145-156` (`NoteType`: id, name, icon, color, template, sortOrder, builtin) | Ainda não guarda configuração de visão. Recebe um campo `board` |
| Tabela `note_types` | `src/storage/tauri.ts:962-990` (`ensureNoteTypesTable`: `CREATE TABLE IF NOT EXISTS` + seed do TODOS) | Coluna nova pelo padrão `addMissingColumns` (`tauri.ts:557-569` mostra o padrão aplicado a `metadata_defs` e `notes`) |
| Gravar tipo | `saveNoteType` (`tauri.ts:1215-1231`): UPSERT de name/icon/color/template/sort_order | Basta incluir `board` no UPSERT. Só o `useNoteTypes` monta `NoteType`, sempre a partir da memória (`useNoteTypes.ts:105-119`) |
| Tipos de dado | `MetadataType` = text, number, date, checkbox, **select** (`types/index.ts:115`); para notas, `NOTE_PROPERTY_TYPES` (`src/lib/metadata.ts:18`) | O `select` é o único de valores fechados. O checkbox tem 2 valores |
| Opções do select | `SelectOption {id, name, color}` (`types/index.ts:121-125`); `MetadataDef.options` (`:139`), coluna `metadata_defs.options` JSON (`tauri.ts:557-562`) | A ordem é a do array e as cores já existem. **Ainda não dá para reordenar opções** no modal (§2.4) |
| Dono da propriedade | `MetadataDef.noteTypeId` + `scope 'note'` (`types/index.ts:129-142`); `typeDefs()` (`src/lib/noteTypes.ts:24-29`) | Por tipo, o que permite configurar o board a partir das defs do tipo |
| Valores na nota | `Note.properties: Record<defId, MetadataValue>`; o select guarda o **id da opção** (`types/index.ts:33-35`, `:117-119`) | Renomear uma opção não quebra nada |
| Setter de valor | `setNoteProperties` = `UPDATE notes SET properties` com o JSON inteiro (`tauri.ts:1267-1275`); `useNotes.setProperties`, otimista (`src/hooks/useNotes.ts:108-117`); o editor usa `handleNotePropertyChange` (`src/App.tsx:2131-2135`) | É o mesmo caminho que o drop do card vai usar |
| Proteção contra o `saveNote` | `useNotes.save` copia `typeId`/`properties`/`archivedAt` da memória (`useNotes.ts:37-46`); o setter não mexe em `updated_at` (`tauri.ts:1257-1259`) | Mover um card com a nota aberta no editor é seguro (§6) |
| Opção apagada | O modal só filtra o array (`NoteTypesModal.tsx:289`); `formatMetadataValue` devolve `''` para id desconhecido (`metadata.ts:38-45`) | As notas ficam com um id órfão. O board precisa tratar isso (§4.3) |
| Apagar propriedade ou tipo | `removeDef` → `deleteMetadataDef` + `json_remove` (`useNoteTypes.ts:205-212`, `tauri.ts:1180-1204`); `deleteNoteType` (`tauri.ts:1236-1255`) | Precisa limpar as referências na config do board (§4.2) |
| Quais notas têm tipo | `canHaveType`: notas de caderno, fora Calendar e nota-corpo de task (`noteTypes.ts:34-40`) | O board herda a regra; as notas arquivadas têm `archivedAt` (`types/index.ts:36-38`) |
| Valores em lista e IA | `listPropertyValues` (até 3, `MAX_LIST_PROPERTIES`, `noteTypes.ts:11`, `:78-92`); `propertiesForAi` (`:96-111`) | O card reaproveita a lista. O RAG já leva as propriedades, então o chat responde "o que está em Adopt" sem nada novo |

### 2.2 Board de Tasks: o que é específico e o que dá para reaproveitar

| Peça | Onde | Específico de task? | Uso no board de notas |
| --- | --- | --- | --- |
| Arrasto manual | `useCardDrag.ts:9-102` (`onDrop(id, dropKey)`, `data-drop-key`, limiar de 4px, Esc cancela, engole o clique) | **Não** | Reaproveita sem mudança |
| Colunas | `BoardColumns.tsx:8-24` (`BoardColumn`: key, title, color, count, faded, `sections`, `headerExtra`); render `:33-97` | Só no tipo: `tasks: Task[]` (`:18-19`) e `renderCard(task: Task)` (`:30`). WIP e "Clear done" são opcionais | Tornar genérico (`<T extends {id: string}>`). É uma troca de tipos, sem mudança de comportamento |
| Subseções | `sections` (`BoardColumns.tsx:19`, `:78-90`), usadas pelo Projects (`ProjectsBoard.tsx:20`, `:57-64`) | Não | É o **segundo eixo** (quadrante dentro do anel) |
| Montagem de colunas | `columnsFor` + `onDrop` por visão: Kanban (`KanbanBoard.tsx:26-85`), TODOS (`TodosBoard.tsx:29-70`) | Lógica por visão | O mesmo padrão: colunas = opções do select, drop = `setNoteProperties` |
| Valor fora do registro | O Kanban abre uma coluna para status órfão (`KanbanBoard.tsx:37-44`); o TODOS tem a coluna "No TODOS" (`TodosBoard.tsx:19`, `:36`) | Não | Modelo para "No value" e "Unknown option" |
| Casca do board | `BoardView.tsx:23-147`: `TasksHeader`, resumo da semana, `filterTasksForView`, `useTaskKeyboard`, `TaskBatchBar`, snooze e plano do dia | **Sim** | Casca nova, menor: header com nome do tipo, filtro de caderno, busca e chips do 2º eixo |
| Card | `TaskCard.tsx` (336 linhas: status, datas, checklist, snooze, projeto) | **Sim** | `NoteCard` novo: título, até 3 propriedades e tags (§4.4) |
| Registro de visões | `TASK_VIEWS` (`TasksView/views.ts`) | Sim (área de Tasks) | Não entra: o board de nota não é visão de task (§4.6) |
| Abrir item em modal | O board esconde o editor (`App.tsx:3540`) e abre o editor principal num modal (`App.tsx:3671-3672`, `TaskEditorModal`) | Não (o modal recebe `children`) | O card abre a nota no mesmo modal |

### 2.3 Navegação e lista de notas

| O quê | Onde |
| --- | --- |
| Visões que dividem a coluna de notas | `sideView` marks/tag (`App.tsx:449-451`) → `MarksView` / `TagView` (`App.tsx:3425-3454`) |
| Boards de Tasks ocupam a área inteira | `tasksBoardOpen` (`App.tsx:987`), roteamento das visões (`App.tsx:3342-3396`) |
| Entradas da coluna de cadernos | `NotebookList` recebe Tasks, Tags e Marks (`App.tsx:3282-3341`) |
| Tipo na lista de notas | Ícone + nome acima do título (`Sidebar.tsx:109-114`) e até 3 valores (`listPropertyValues`); ordenação "By type" (`src/lib/noteOrder.ts:40-44`); chip `type:` no Ctrl+P (`src/lib/noteSearch.ts:295`) |

### 2.4 Modal de tipos (`src/components/NoteTypes/NoteTypesModal.tsx`)

- O detalhe do tipo (`renderDetail`, `:316-495`) tem Name, Icon, Color, **Properties** (`:394-478`, com "In list" em `:426-437`) e **Template** (`:480-492`). A seção "Board" entra entre Properties e Template.
- As opções do select (`renderOptions`, `:258-314`) só podem ser renomeadas, coloridas, criadas e apagadas. **Não há como reordenar** (as propriedades e os tipos já têm drag com dnd-kit, `:66-95`). No board a ordem das opções vira a ordem das colunas (Adopt → Trial → Assess → Hold), então reordenar opções passa a ser pré-requisito.

---

## 3. Exemplo de produção (só estrutura)

Fonte: cópia do `monet.db` de produção em 2026-10-29. São 192 notas: 154 sem tipo e 38 tipadas.

### 3.1 Radar (criado em 2026-10-29)

| Propriedade | Tipo | Opções (na ordem) | Cores | Na lista | Notas com valor |
| --- | --- | --- | --- | --- | --- |
| `Category` | select | Techniques · Plattaform · tools · language and frameworks | todas cinza | sim | 2/2 (Techniques 1, language and frameworks 1) |
| `Classification` | select | Adopt · Trial · Assess · Hold | verde · azul · amarelo · vermelho | sim | 2/2 (Adopt 1, Assess 1) |

- **2 notas**, as duas no mesmo caderno e na mesma matéria, com corpo vazio, criadas hoje, sem tags e nenhuma arquivada.
- O tipo não tem ícone (cai no padrão) nem template.
- Leitura: o Coordenador montou o radar como **dois selects**, os quadrantes (`Category`) e os anéis (`Classification`), exatamente o modelo da ThoughtWorks. As opções de `Classification` já estão na ordem certa dos anéis e com cores de semáforo. Há grafias inconsistentes (`Plattaform`, `tools` minúsculo), mas isso é dado e não afeta o desenho.

### 3.2 Os demais tipos

| Tipo | Notas (arquivadas) | Propriedades | `select`? | Board possível? |
| --- | --- | --- | --- | --- |
| TODOS (embutido) | 12 (6) | `Entrega` date 6/12 · `Onda` number 5/12 · `Branch` text 7/12 · **`Status` select** (Backlog · Next · Inprogress · Waiting · Finish) 4/12 | Sim | Sim. Entre as 6 ativas: 3 sem Status, 2 Waiting, 1 Inprogress. Entre as arquivadas: 1 Finish e 5 vazias |
| Spec | 6 (0) | `Note` text 1/6 | Não | Não |
| Arquivo | 5 (0) | nenhuma | Não | Não |
| Plan | 4 (0) | `Início` date 1/4 · `Fim` date 1/4 | Não | Não |
| Note | 3 (0) | nenhuma | Não | Não |
| Study | 3 (0) | nenhuma | Não | Não |
| Summary | 2 (0) | `Capítulo` number 2/2 | Não | Não |
| Anexo | 1 (0) | `Tema` text 1/1 | Não | Não |

Também há 3 defs de **task** (`scope 'task'`: Publicado, Notas, Onda), que não entram no board de notas.

**O que os dados dizem**
1. **A demanda genérica já existe sem o board.** Antes de qualquer feature, o Coordenador criou por conta própria um `Status` em formato de kanban no TODOS e dois selects no Radar. São dois tipos, com propósitos diferentes, que o mesmo mecanismo atende.
2. **Campo vazio é o caso comum.** No TODOS, 8 de 12 notas estão sem Status. A coluna "No value" precisa ser tratada como cidadã de primeira classe, e escondê-la tem de ser uma opção.
3. **Volume baixo.** O Radar tem 2 notas, e o maior tipo tem 12. O desempenho não é risco. O risco é **fazer antes do uso** (D10).

---

## 4. Proposta

### 4.1 Regra genérica

| Pergunta do Task Report | Resposta |
| --- | --- |
| Qual propriedade vira coluna? | Uma **`select`** do tipo, escolhida na config. As colunas são as opções, na ordem da def, com a cor da opção. No fim (ou no início, D) vem **"No value"**, para notas sem valor ou com id de opção que não existe mais |
| Precisa ser de valores fechados e ordenados? | Sim. O `select` já existe (D3 do estudo de tipos) e guarda a ordem no array. Falta só **reordenar opções** no modal |
| Arrastar grava na nota? | Sim: `setNoteProperties(note.id, {...props, [colDefId]: optionId})`. Soltar em "No value" remove a chave, como o editor já faz (`App.tsx:2131-2135`). Mesmo caminho otimista do editor |
| O que o card mostra | Título (ou "Untitled"), ícone e cor do tipo, até **3 propriedades** escolhidas (padrão: as que têm "In list"), tags opcionais e o caderno, quando o board cruza cadernos |
| Segundo eixo | **Subseções dentro da coluna** (`BoardColumn.sections`, já implementado, como os sub-groups do Notion), mais **chips de filtro** no header com as opções da mesma propriedade. Swimlanes em grade ficam para depois (D4) |
| Tipo sem `select` | Board indisponível. No modal, a seção Board mostra "Add a Select property to show this type as a board", sem um agrupamento padrão inventado |
| Checkbox como coluna | Possível (2 colunas, Yes/No), mas fora do MVP (D3). O checkbox serve melhor como **filtro** (§4.5) |

### 4.2 Configuração no modal de tipos (recomendada) e schema

**Na UI**, uma seção nova "Board" em `renderDetail`, entre Properties e Template. Mock (ícones Phosphor):

```
Board                                         [Kanban]
  [x] Show as board
  Columns       [ Classification     v ]   (só selects do tipo)
  Sections      [ Category           v ]   (outro select, ou "None")
  Card fields   [x] Category  [ ] ...      (até 3; padrão = "In list")
  [x] Show tags on cards
  [ ] Hide "No value" column
  Only notes where  [ none          v ]    (checkbox do tipo = true; opcional)
```

Com o tipo sem `select`, o toggle fica desabilitado e aparece a dica. Nenhuma outra opção entra aqui: sem WIP, sem "done", sem ordenação manual.

**No schema**, uma coluna nova `note_types.board TEXT` com JSON e `NULL` = sem board. Ela entra pelo padrão `addMissingColumns` dentro de `ensureNoteTypesTable`, e o `rowToNoteType` lê o campo.

```json
{
  "columnDefId": "md_…",
  "sectionDefId": "md_… | null",
  "cardDefIds": ["md_…"],
  "showTags": true,
  "hideEmpty": false,
  "filterDefId": "md_… | null"
}
```

| Escolha | Por quê |
| --- | --- |
| JSON numa coluna do tipo, e não colunas soltas | A config é lida inteira e gravada por um único dono (o modal). Pode crescer (fase 2) sem novo DDL. É o mesmo padrão de `metadata_defs.options` e `task_views.config` |
| No `note_types`, e não em `metadata_defs` (ex.: flag `board_role` na def) | A config cruza propriedades (coluna + seção + campos). Espalhar por defs complica a validação e a limpeza |
| Gravar pelo `saveNoteType` (UPSERT ganha `board = excluded.board`) | `NoteType` só é montado a partir da memória do `useNoteTypes`, então não há quem grave um `NoteType` sem `board` |

**Integridade**
- `removeDef`: se a def apagada for a `columnDefId`, o board vira `NULL`. Se for `sectionDefId` ou `filterDefId`, só ela vira `null`. Também sai de `cardDefIds`.
- `deleteNoteType`: já apaga o tipo, e a config vai junto.
- Leitura defensiva: uma `columnDefId` que não existe ou deixou de ser `select` é tratada como "sem board", porque outra janela pode ter apagado a def.

### 4.3 Casos de borda

| Caso | Comportamento |
| --- | --- |
| Valor vazio | Coluna "No value" (oculta se `hideEmpty`) |
| Opção apagada com notas usando o id | As notas vão para "No value". Na coluna, um aviso discreto ("2 with a deleted option") sinaliza o caso. Quando o card é solto em outra coluna, o valor é corrigido. O modal já poderia avisar ao apagar a opção ("N notes use this option"), como faz com propriedade (`NoteTypesModal.tsx:229-240`) |
| Opção renomeada | Nada muda (o valor é o id) |
| Opções reordenadas | As colunas seguem a nova ordem (exige o reorder no modal, §2.4) |
| Nota muda de tipo ou perde o tipo | Sai do board na hora (o filtro é `typeId`). Os valores ficam guardados (`migrateProperties`, `noteTypes.ts:51-75`) |
| Nota arquivada | Fica fora do board. Arquivar é a forma de "aposentar" um item sem apagar a nota |
| Nota-corpo de task e Calendar | Não podem ter tipo (`canHaveType`), então nunca aparecem |
| Caderno oculto do RAG (`notebook_notes_index_disabled`) | Aparece normalmente: o board é visão, não RAG |
| Ordem dentro da coluna | Sem ordem manual no MVP (D11). Ordena por título, com "mexidas por último" como opção. O Kanban de tasks também não tem ordem manual |
| Volume (centenas de notas) | As notas já estão em memória e o board é filtro e agrupamento em JS. O `BoardColumns` renderiza tudo, o que basta para centenas. Virtualizar só se passar de ~1000 |
| Card movido com a nota aberta | Seguro: o setter é pontual e o `saveNote` não toca em `properties` (`useNotes.ts:37-46`). O `NotePropertiesBar` lê da mesma memória e mostra o novo valor |

### 4.4 Card (`NoteCard`)

```
┌──────────────────────────────────────┐
│ [Target] Radar · Caderno X           │  ícone/cor do tipo; caderno só se o board cruza cadernos
│ Título da nota                       │
│ ● Techniques   ⚑ —                   │  até 3 propriedades (o select com a cor da opção)
│ #tag1 #tag2                          │  se showTags
└──────────────────────────────────────┘
```

- O clique abre a nota no modal de edição sobre o board (como o board de Tasks). Um botão `ArrowSquareOut` abre a nota no caderno, saindo do board.
- Sem ações de task (snooze, check, plano do dia) e sem seleção múltipla no MVP.
- O ícone de exemplo é `Target`, um Phosphor que já existe. O tipo usa o ícone escolhido pelo Coordenador (`TypeIcon`).

### 4.5 Como o Coordenador "sinaliza" o que entra

| Opção | Como funciona | Prós | Contras | Veredito |
| --- | --- | --- | --- | --- |
| **A. Board por tipo, no modal de tipos** (preferida pelo Coordenador) | O tipo liga o board, e todas as notas ativas do tipo entram. Para tirar uma nota: deixar a propriedade da coluna vazia com "No value" oculta, ou arquivar. Filtro opcional por checkbox do tipo | Uma config por tipo, num lugar só. Genérico por definição, sem mudança em `notes` | Um único board por tipo | **Recomendada** |
| B. Flag por nota ("mostrar no board") | Coluna nova `notes.on_board` + setter + controle no cabeçalho da nota | Controle fino | Não diz **como** organizar (continua precisando da config por tipo). É mais um campo de nota e mais um setter, e duplica o que o checkbox do tipo já faz | Não fazer. O checkbox-filtro de A resolve o mesmo caso quando o tipo precisar |
| C. Visão salva com filtro (como `task_views`) | Tabela `note_board_views {id, name, config}` com tipo, coluna, seção e filtros (caderno, tag, propriedade) | Vários boards por tipo, filtros cruzados | Mais UI (criar, renomear, listar visões) e um segundo lugar de configuração. YAGNI com 2 notas no Radar | Fase futura, se surgir a necessidade de dois boards do mesmo tipo. A config de A vira a "visão padrão" |

**Ainda falta algo por nota?** Não, para o MVP. As três necessidades de "por nota" são cobertas sem schema novo em `notes`:
- **excluir:** valor vazio com "No value" oculta, ou arquivar;
- **incluir só algumas:** checkbox do tipo como filtro;
- **posição:** a própria propriedade.

### 4.6 Onde mora na navegação

| Opção | Avaliação |
| --- | --- |
| **Seção "Boards" na coluna de cadernos** (como Tasks, Tags e Marks), uma linha por tipo com board (ícone + nome + contagem). O clique abre o board na **área inteira**, como os boards de Tasks (`tasksBoardOpen`) | **Recomendada.** Fica no mesmo lugar dos outros atalhos transversais. O tipo é global, então o board também é |
| Atalho "Open board" no menu do tipo da nota (eyebrow / `NoteTypePicker`) e no modal de tipos | Complemento barato |
| Item no menu principal (Toolbar: notebook/chat/library) | Não. É peso demais para uma visão de notas |
| Dentro da área de Tasks (`TASK_VIEWS`) | Não. Misturaria notas com tasks e reforçaria o viés de PM |

O header do board leva o nome do tipo, o filtro de caderno ("All notebooks" ou um caderno, igual ao filtro de projeto das Tasks), a busca por título e os chips do segundo eixo. O estado (caderno filtrado, chips) fica em `localStorage` por tipo, já que é conveniência do visualizador.

### 4.7 Radar circular

- O visual da ThoughtWorks são 4 quadrantes × 4 anéis, com blips marcados como "novo" ou "moveu".
- A versão genérica seria uma "visão radial" para qualquer tipo com dois selects (setores × anéis). É viável (SVG), mas custa M, e o ganho com 2 notas é visual, não funcional.
- O "moveu desde a última edição" exige **histórico** de valores, que o Monet não guarda.
- **Recomendação: fora.** Board com colunas = `Classification` e seções = `Category` dá a mesma leitura.
- Se o Coordenador quiser o desenho: **export CSV** do board (título + valores das propriedades, fase 2, P) para o [Build your own Radar](https://radar.thoughtworks.com/), que aceita CSV/JSON/Google Sheet. O export é genérico (serve para qualquer tipo) e terceiriza o desenho.

---

## 5. Mercado

| Produto | Como faz board por propriedade | O que serve ao Monet |
| --- | --- | --- |
| **Notion** | Board view agrupada por uma propriedade (select, status, pessoa…). Arrastar muda o valor. **Sub-groups** dividem cada coluna por uma segunda propriedade sem mexer nas colunas, com toggle para esconder cada uma; grupo vazio "No …" ([Board view](https://www.notion.com/help/boards), [Notion 2.13, groups & sub-groups](https://www.notion.com/releases/2021-10-19)) | Coluna = propriedade e 2º eixo como sub-grupo: é o desenho proposto (§4.1). Relations, rollups, fórmulas e várias views ficam fora |
| **Capacities** | Group by por qualquer propriedade (e por tipo) dentro do tipo ou de uma query. Visão kanban no menu de visões. Se não há propriedade para agrupar, "crie uma propriedade" ([Group by](https://docs.capacities.io/reference/group-by), [Release 53](https://capacities.io/whats-new/release-53)) | O agrupamento nasce **no tipo**, como a opção A. Sem propriedade, sem board: a mesma regra do §4.1 |
| **Obsidian Bases** | Kanban view oficial (early access, 1.14): Group by em uma propriedade, notas sem valor na coluna **"None"**; só move cards se a coluna for propriedade comum, nunca fórmula ([Kanban view](https://obsidian.md/help/bases/views/kanban)). Plugins da comunidade acrescentam **swimlanes** por uma segunda propriedade ([Kanban Bases View](https://community.obsidian.md/plugins/kanban-bases-view)) | Coluna "None" para vazio e swimlane como extra. Confirma que o 2º eixo é opcional |
| **Tana** | Campos de supertag agrupam resultados em list/card view. Há pedidos abertos por "default view por supertag" e por agrupamento em vários níveis ([Ideas: default views for tags](https://ideas.tana.inc/posts/465-default-views-for-tags), [multi-level grouping](https://ideas.tana.inc/posts/596-multi-level-dimension-grouping-via-multiple-fields-supertags-or-hierarchical-relationships-within-single-supertags)). Board por campo não foi confirmado nas fontes | Usuários pedem a visão padrão **por tipo**: reforça a opção A |
| **ThoughtWorks Radar** | Blips por **quadrante** (tipo de coisa) e **anel** (Adopt, Trial, Assess, e o último anel renomeado de Hold para Caution). Blips novos aparecem diferentes e a mudança comum é trocar de anel. O BYOR gera o radar a partir de CSV/JSON/Sheet ([Radar FAQ](https://www.thoughtworks.com/radar/faq), [Build your own Radar](https://radar.thoughtworks.com/)) | Dois selects resolvem a estrutura. "Moveu" exige histórico (fora). O export CSV é a ponte barata |

---

## 6. Propostas numeradas

Esforço: P (até 1 dia), M (2 a 4 dias), G (1 semana ou mais).

| # | Proposta | Valor | Esforço | Riscos | Visão / PRD |
| --- | --- | --- | --- | --- | --- |
| B1 | **Reordenar opções do select** no modal (dnd-kit, igual às propriedades) | Pré-requisito (ordem das colunas) | P | — | Neutro |
| B2 | **`note_types.board` (JSON)** + `rowToNoteType`/`saveNoteType` + limpeza em `removeDef` | Base | P | UPSERT esquecer o campo (teste de ida e volta) | Neutro |
| B3 | **Seção "Board" no modal de tipos** (§4.2) | Alto | P–M | Modal mais alto. Seção recolhível quando desligada | Estrutura definida pelo usuário (③) |
| B4 | **`BoardColumns` genérico** (`<T extends {id}>`), sem mudar comportamento nas tasks | Base | P | Regressão nos 4 boards de Tasks: conferir Kanban, Projects, TODOS e My Day | — |
| B5 | **`NoteBoard`** (colunas = opções, "No value", seções, drop = `setNoteProperties`) + **`NoteCard`** + header (caderno, busca, chips) | Alto | M | Id de opção órfão (§4.3) | ①② (o material do usuário no centro) |
| B6 | **Navegação**: seção "Boards" na coluna de cadernos + "Open board" no tipo; card abre a nota no modal | Alto | P–M | Conflito com `tasksBoardOpen`/`sideView`: um estado de "área principal" só | — |
| B7 | Soltar numa **seção** grava também o 2º eixo (`data-drop-key = coluna::seção`) | Médio | P | Arrasto acidental de quadrante: só quando a seção tem rótulo | — |
| B8 | **Filtro por checkbox** do tipo ("Only notes where …") | Médio | P | — | — |
| B9 | **Export CSV** do board (título + propriedades), compatível com o BYOR | Baixo–médio | P | O BYOR exige no máximo 4 quadrantes e anéis e quebra com quadrante vazio: o export avisa, não valida | — |
| B10 | Visões salvas de board (opção C) | Baixo hoje | M | Duas formas de configurar | Só com demanda |
| B11 | Visão radial (SVG) para tipos com 2 selects | Baixo hoje | M | Layout de blips e rótulos; sem histórico de movimento | Só com demanda |

**Não recomendado:**
- WIP, "done this week", datas e prazos no board de notas, porque isso é PM (PRD, `DOCS/specs/PRD.md:132`);
- ordem manual dos cards;
- flag por nota;
- a IA movendo cards ou preenchendo a propriedade da coluna;
- board para tipo sem `select` com agrupamento inventado;
- múltipla seleção e ações em lote.

---

## 7. Riscos

| Risco | Mitigação |
| --- | --- |
| Virar gerenciador de projetos (o board do TODOS por `Status` se sobrepõe ao Kanban de tasks) | O board de notas não tem WIP, prazos, "done", lote nem automação. É só "onde está esta nota na classificação que eu defini" |
| Feature antes do uso (o Radar tem 2 notas, criadas hoje) | D10: fazer a fase 1 só quando o Radar ou outro tipo tiver volume, ou aceitar o custo (M) como aposta |
| Opção apagada deixar notas com valor órfão | "No value" com aviso e correção ao soltar o card. Aviso de uso ao apagar a opção |
| Config apontando para def apagada (inclusive em outra janela) | Limpeza em `removeDef` + leitura defensiva (§4.2) |
| `setNoteProperties` grava o JSON inteiro a partir da memória | O board usa a mesma memória do editor (`useNotes`). Outras janelas não editam propriedades hoje. Se passarem a editar, trocar por `json_set` pontual |
| Regressão nos boards de Tasks ao generalizar o `BoardColumns` | B4 é só troca de tipos. Conferir os 4 boards no app dev |
| Dois "estados de área principal" (tasks board × note board × sideView) | Unificar num estado só (`mainArea`) na implementação, em vez de mais um booleano |

---

## 8. Esforço por fase

| Fase | Conteúdo | Estimativa | Resultado |
| --- | --- | --- | --- |
| **0: Decisões** | D1–D11 | sem código | Escopo fechado |
| **1: Board por tipo** | B1, B2, B3, B4, B5, B6 | ~4–5 dias (M) | Qualquer tipo com `select` ganha o board pelo modal. O Radar e o TODOS são os dois primeiros |
| **2: Refinos** (opcional) | B7, B8, B9 | ~2–3 dias | 2º eixo arrastável, filtro por checkbox e export para o BYOR |
| Condicional | B10, B11 | M cada | Só com uso real que justifique |

---

## 9. Veredito

**Genérico viável.** Nenhuma parte do desenho conhece o radar:
- a coluna é "uma propriedade `select` do tipo";
- o segundo eixo é "outra `select` do tipo";
- o card mostra "propriedades escolhidas do tipo";
- a configuração mora no tipo.

Um tipo criado amanhã com um `select` ganha o board só marcando "Show as board" no modal. A única condição é ter um `select`. Sem `select` não há board, e o modal explica por quê.

A dúvida não é técnica. É de **momento** (D10): o caso concreto tem 2 notas.

---

## 10. Decisões necessárias do Coordenador

1. **D1. Onde configurar:** no modal de tipos, uma config por tipo (A, recomendado)? Ou visões salvas (C) desde já?
2. **D2. Inclusão e exclusão por nota:** sem flag por nota. Exclusão por valor vazio com "No value" oculta, ou por arquivamento, e filtro opcional por checkbox do tipo (recomendado). Ou criar `notes.on_board`?
3. **D3. Propriedade de coluna:** só `select` (recomendado) ou também checkbox (Yes/No)?
4. **D4. Segundo eixo:** subseções dentro da coluna + chips de filtro (recomendado)? Ou swimlanes em grade? Ou só filtro?
5. **D5. Navegação:** seção "Boards" na coluna de cadernos + "Open board" no tipo (recomendado)? Ou outro lugar?
6. **D6. Abrir a nota pelo card:** modal sobre o board, como em Tasks (recomendado), ou ir para o caderno?
7. **D7. Escopo de cadernos:** board do tipo em todos os cadernos com filtro no header (recomendado), ou caderno fixo na config?
8. **D8. Radar circular:** fora (recomendado)? Export CSV para o BYOR na fase 2? Ou visão radial própria (B11)?
9. **D9. TODOS:** o tipo embutido também pode ligar o board pelo `Status` (recomendado, por ser genérico)? Atenção ao nome: já existe "TODOS board" em Tasks (colunas por TODOS), então o rótulo do novo board deve ser "TODOS · Board by Status" ou parecido.
10. **D10. Momento:** fazer a fase 1 agora, ou esperar o Radar (ou outro tipo) ter volume, por exemplo 15 notas ou mais? Recomendação do explorer: esperar volume, a não ser que o Coordenador vá alimentar o radar logo. O custo é M e não há dívida em adiar.
11. **D11. Ordem dos cards:** sem ordem manual, por título ou "mexidas por último" (recomendado)? Ou persistir uma ordem manual por coluna?
