# Board de notas por tipo — cards em colunas por propriedade

> Spec de feature (2026-10-29, branch `feat/board-view`). Base: `DOCS/features/note_board_study.md` (decisões D1–D11) e o plano `DOCS/reports/29-10-2026/planreport_20261029132316.md` (P1–P13). Caso de origem: o radar tecnológico, que vira um uso do board genérico, sem código específico.

## 1. Conceito

Qualquer **tipo de nota** com uma propriedade `select` ou `checkbox` pode ser visto como **board**: as colunas são os valores dessa propriedade e cada nota do tipo vira um card. Arrastar o card de coluna grava o valor da propriedade na nota. Não existe flag por nota: entra no board toda nota do tipo. O board é genérico e o código não tem nenhum caso especial por tipo (nem Radar, nem TODOS).

## 2. Configuração (modal de tipos)

- Seção **"Board"** no detalhe do tipo, entre Properties e Template (`src/components/NoteTypes/NoteTypeBoardSection.tsx`).
- **"Show as board"** liga com uma config padrão: coluna = 1º `select` do tipo (senão o 1º `checkbox`), sem seção, campos do card = as propriedades "show in list" (até 3), tags ligadas, "No value" visível, sem filtro. Sem `select`/`checkbox` no tipo, o controle fica desabilitado com o texto "Add a Select or Checkbox property to show this type as a board."
- Ligado, mostra:
  - **Columns**: `select` ou `checkbox` do tipo;
  - **Sections**: "None" ou um `select` do tipo diferente da coluna;
  - **Card fields**: até 3 propriedades do tipo, menos a da coluna;
  - **Show tags on cards**;
  - **Hide "No value" column**, desabilitado quando a coluna é `checkbox`;
  - **Only notes where … is checked**: "None" ou um `checkbox` do tipo diferente da coluna;
  - **Open board**.
- A config fica em `note_types.board` (JSON, `NoteBoardConfig` em `src/types/index.ts`). **Desligar grava `NULL`** e descarta a config.
- As opções do `select` podem ser **reordenadas por arrasto** no modal; a ordem das colunas e das seções segue a ordem das opções.

## 3. Colunas

- **Select**: uma coluna por opção, na ordem da propriedade e com a cor da opção, mais **"No value"** no fim. "No value" junta a nota sem valor e a nota com **id de opção apagada**; o cabeçalho avisa "N with a deleted option".
- **Hide "No value"** esconde essa coluna, **a não ser que tenha nota com opção apagada**: aí ela aparece, para nada sumir em silêncio.
- **Checkbox**: duas colunas, **Yes** e **No**; nota sem valor cai em No. Soltar em Yes grava `true`, soltar em No grava `false`.
- Notas do board: do tipo, não arquivadas e de caderno (fora Calendar e nota-corpo de task), **de todos os cadernos**. Dentro da coluna e da seção, ordem por título.

## 4. Seções e chips

- Com **Sections**, cada coluna se divide pelas opções do segundo `select`, na ordem, mais "No value" no fim.
- Parado, só aparecem as seções com cards. **Durante um arrasto**, aparecem também as vazias, com borda tracejada, como alvo de drop.
- O header mostra **chips** das opções da seção mais "No value", em multisseleção (nenhum ativo = todos). Os chips filtram os cards e as seções.

## 5. Card

- Linha de cima: ícone do tipo na cor do tipo e o nome do caderno (só com "All notebooks"); à direita, **"Open in notebook"** (`ArrowSquareOut`).
- Título (ou "Untitled"), até 3 campos (vazios pulados; select = ponto na cor + nome; checkbox = caixa + nome da propriedade; demais = nome em cinza + valor) e as tags `#tag` em cinza, não clicáveis, se "Show tags on cards".
- Clique ou Enter abre a nota num modal **"Edit note"** sobre o board, com o editor completo; Esc fecha e o board fica.

## 6. Header e o que é lembrado

- Título **"<Tipo> notes · by <Propriedade>"**, contagem "N notes" (mais "· M with no <Prop> hidden" quando "Hide No value" esconde notas; se esconde todas, o estado vazio diz isso em vez de "No notes match the filters."), o texto fixo "Only notes where <Prop> is checked" quando há filtro, select de caderno ("All notebooks" + cadernos com notas do tipo), **Export CSV**, busca por título (Esc limpa) e os chips da seção.
- O `localStorage` guarda por tipo, em `monet:note-board:<typeId>`, o **caderno** e os **chips**. A **busca não é lembrada**. Caderno ou chip que não existe mais é ignorado na leitura.
- Em área estreita (painel de IA aberto), os controles do header descem de linha.

## 7. Navegação

- O board abre na **área inteira**, como os boards de Tasks, por três caminhos:
  - a seção **"Boards"** da coluna de cadernos (`<Tipo> · <Prop>` com a contagem; clicar no ativo fecha; sem boards, "no boards");
  - **"Open board"** no modal de tipos;
  - **"Open board"** no menu do tipo, na barra de propriedades da nota.
- Um estado único de área principal (`mainArea` no `App.tsx`: notes, tasks, marks, tag ou noteBoard) garante uma área por vez. Navegar por fora (caderno, Ctrl+P, link, outra janela) fecha o board.
- "Open in notebook" sai do board e abre a nota no caderno.
- Se o tipo some, o board é desligado ou a coluna é apagada (até por outra janela), o board fecha e volta para as notas.

## 8. Drop

- Soltar no **cabeçalho ou no corpo da coluna** grava só a propriedade da coluna.
- Soltar numa **seção** grava a coluna e a seção **numa única gravação** (`setNoteProperties`). Soltar na seção "No value" remove o valor da seção.
- Valor igual não grava; a nota com opção apagada solta em "No value" também não.
- Toda gravação passa por `setNoteProperties`, com a mesma regra da barra de propriedades: valor vazio remove a chave.

## 9. Filtro por checkbox

- Com **Only notes where <checkbox> is checked**, só entram no board as notas com a caixa marcada (`true`). A contagem da seção "Boards" segue o filtro.
- Filtro apontando para uma propriedade apagada é ignorado: todas as notas entram.

## 10. Export CSV

- **Export CSV** salva os cards **visíveis** (com caderno, busca e chips aplicados) num arquivo `<Tipo>-board.csv`, pelo diálogo nativo (comando Rust `export_csv`, que divide o helper `save_text_with_dialog` com o `export_markdown`).
- Formato do **Build your own Radar** (Thoughtworks): cabeçalho `name,ring,quadrant,isNew,description`, seguido das demais propriedades do tipo (nome da propriedade, na ordem do tipo, menos coluna e seção).
  - `name` = título; `ring` = valor da coluna (`Yes`/`No` no checkbox, vazio em "No value"); `quadrant` = opção da seção (vazio sem seção ou sem valor); `isNew` = `FALSE`; `description` vazia.
  - Extras: select = nome da opção, checkbox = `yes`/`no`, demais = texto; vazio = vazio.
  - Linhas na ordem coluna → seção → título. Escape RFC 4180, linhas com CRLF, sem BOM.
  - Contra injeção de fórmula, campo de dado que começa com `=`, `+`, `-` ou `@` ganha o prefixo `'` (vira texto no Excel/Sheets), a não ser que seja um número (ex.: `-3`). O cabeçalho não muda, para o BYOR achar as colunas.
- Depois de salvar, o header mostra "Exported N notes." Com mais de 4 anéis ou 4 quadrantes distintos, acrescenta o aviso "Build your own Radar accepts at most 4 rings and 4 quadrants; this export has R rings and Q quadrants." O aviso não bloqueia. Cancelar não mostra nada; erro mostra "Export failed."
- O BYOR lê de URL (Google Sheet ou CSV publicado): o arquivo ainda precisa ser subido pelo usuário.

## 11. Integridade

- Apagar uma propriedade (`removeDef` em `src/hooks/useNoteTypes.ts`) limpa a config: sendo a coluna, o board é desligado; sendo seção, filtro ou campo do card, só a referência sai.
- A leitura é defensiva (`resolveBoard` em `src/lib/noteBoard.ts`): coluna inválida = sem board; seção, filtro ou campo inválido é ignorado. Isso cobre config gravada por outra janela.
- Opção apagada não some com a nota: ela vai para "No value" com o aviso no cabeçalho.
- Lógica pura em `src/lib/noteBoard.ts`; UI em `src/components/NoteBoard/` e colunas em `src/components/TasksView/BoardColumns.tsx`, o mesmo componente dos boards de Tasks.

## 12. Nomenclatura (TODOS)

- A visão "TODOS" de Tasks mantém o rótulo, porque o id `todos` está no localStorage e nas visões salvas. O tooltip dela é "Task columns by TODOS note".
- O board de notas se chama sempre "<Tipo> notes · by <Propriedade>" (ex.: "TODOS notes · by Status") e fica em outro lugar da navegação (seção "Boards"), o que separa os dois.

## 13. Fora de escopo / depois

- Limite WIP, prazos, coluna "done", ações em lote e ordem manual dos cards.
- Flag por nota para entrar no board e visões salvas do board.
- Radar circular (radial) dentro do Monet: o caminho é o export CSV para o BYOR.
- IA criando ou movendo cards.
