# Board de notas por tipo — cards em colunas por propriedade

> Spec de feature (2026-10-29, branch `feat/board-view`; melhorias de UX em `feat/melhorias-ux`, a partir de `DOCS/reports/29-10-2026/uxreport_20261029143802.md`). Base: `DOCS/features/note_board_study.md` (decisões D1–D11) e o plano `DOCS/reports/29-10-2026/planreport_20261029132316.md` (P1–P13). Caso de origem: o radar tecnológico, que vira um uso do board genérico, sem código específico.

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
- **Apagar uma opção pede confirmação** com a contagem de notas que a usam ("Delete option "Hold"? 2 notes use it; they will have no Classification."), como a exclusão de propriedade. Recriar a opção gera outro id, então a classificação não volta sozinha.
- **"Board settings"** (header do board, estados vazios) e **"Set up a board…"** (coluna de cadernos, sem boards) abrem o modal de tipos já rolado até a seção Board (`focusBoard`).

## 3. Colunas

- **Select**: uma coluna por opção, na ordem da propriedade e com a cor da opção, mais **"No value"** no fim. "No value" junta a nota sem valor e a nota com **id de opção apagada**; o cabeçalho avisa "N with a deleted option".
- **Hide "No value"** esconde essa coluna, **a não ser que tenha nota com opção apagada**: aí ela aparece, para nada sumir em silêncio.
- **Checkbox**: duas colunas, **Yes** e **No**; nota sem valor cai em No. Soltar em Yes grava `true`, soltar em No grava `false`.
- Notas do board: do tipo, não arquivadas e de caderno (fora Calendar e nota-corpo de task), **de todos os cadernos**. Dentro da coluna e da seção, ordem por título.

## 4. Seções e chips

- Com **Sections**, cada coluna se divide pelas opções do segundo `select`, na ordem, mais **"No <Seção>"** no fim (ex.: "No Category"; o rótulo não repete o "No value" da coluna).
- Toda seção aparece sempre, com a contagem. A **vazia** é uma faixa compacta de altura fixa (rótulo + "0"); **durante um arrasto** ela só ganha a borda tracejada, sem mudar de altura, então nada se mexe embaixo do cursor.
- O header mostra **chips** das opções da seção mais "No <Seção>", em multisseleção (nenhum ativo = todos). Os chips filtram os cards e as seções.

## 5. Card

- Linha de cima: o nome do caderno (só com "All notebooks"); à direita, **"Open in notebook"** (`ArrowSquareOut`). O ícone do tipo fica só no header.
- Título (ou "Untitled"), até 3 campos (vazios pulados; select = ponto na cor + nome; checkbox = caixa + nome da propriedade; demais = nome em cinza + valor), o **progresso das tasks** da nota ("2/6 tasks": tasks com `parentNoteId` = a nota, feitas/total, sem as descartadas; só quando há tasks; genérico, sem nada de TODOS) e as tags `#tag` em cinza, não clicáveis, se "Show tags on cards".
- Clique ou Enter abre a nota num modal **"Edit note"** sobre o board, com o editor completo; Esc fecha e o board fica.
- Rodapé do modal: **Previous / Next** (também **Alt+↑ / Alt+↓**, ignorado com o foco num `select` ou `input`, como a barra de propriedades e o título, porque Alt+↓ abre a lista do select e o seletor de data; no corpo da nota funciona) com "N of M", e **"Open in notebook"** com rótulo. A ordem é a dos cards visíveis quando o card foi aberto (coluna a coluna, seção a seção, filtros aplicados); a nota reclassificada no modal mantém o lugar (mesmo se saiu do board, ex.: desmarcou a caixa do filtro), e as outras que saíram do board (apagadas, arquivadas, outro tipo) são puladas. A nota criada pelo "New" abre sem posição (Previous/Next desabilitados).

## 6. Header e o que é lembrado

- Título **"<Tipo> notes · by <Propriedade>"**, contagem "N notes" (mais "· M with no <Prop> hidden" quando "Hide No value" esconde notas), o texto fixo "Only notes where <Prop> is checked" quando há filtro, select de caderno ("All notebooks" + cadernos com notas do tipo), **Clear filters** (só com caderno ou chip ativo; limpa caderno, chips e busca), **Export CSV**, **Board settings**, busca por título (Esc limpa) e os chips da seção.
- Estados vazios (as colunas continuam na tela, para o "New"):
  - sem notas do tipo: "No <Tipo> notes yet. Use “New” on a column, or give a note the type <Tipo>.";
  - tudo escondido pelo "Hide No value": o texto com a contagem e o botão **Board settings**;
  - filtros zeraram: "No notes match the filters." com **Clear filters** (ou **Board settings**, quando o que zera é o filtro por checkbox do tipo).
- O `localStorage` guarda por tipo, em `monet:note-board:<typeId>`, o **caderno**, os **chips** e o **caderno do último "New"**. A **busca não é lembrada**. Caderno ou chip que não existe mais é ignorado na leitura.
- Em área estreita (painel de IA aberto), os controles do header descem de linha.

## 7. Navegação

- O board abre na **área inteira**, como os boards de Tasks, por três caminhos:
  - as linhas de board **logo abaixo de Tasks** na coluna de cadernos (`<Tipo> · <Prop>` com a contagem; clicar no ativo fecha; sem boards, "Set up a board…", que abre o modal de tipos na seção Board);
  - **"Open board"** no modal de tipos;
  - **"Open board"** no menu do tipo, na barra de propriedades da nota.
- Um estado único de área principal (`mainArea` no `App.tsx`: notes, tasks, marks, tag ou noteBoard) garante uma área por vez. Navegar por fora (caderno, Ctrl+P, link, outra janela) fecha o board.
- "Open in notebook" sai do board e abre a nota no caderno.
- **Painel de IA:** o board de notas na tela recolhe o painel; sair do board o reabre se ele estava aberto antes. No modo foco o board não aparece, então o painel não recolhe (entrar no foco com o board aberto conta como saída). O usuário pode reabri-lo com o board aberto. Os boards de Tasks não mexem no painel.

## 7a. Criar pelo board

- **"New"** (`Plus` + rótulo) no cabeçalho de cada coluna e, no hover, em cada seção. Cria a nota do tipo (com o template do tipo, pelo mesmo caminho do "New <tipo>" da lista) e grava os valores da coluna e da seção pelo `setNoteProperties` (os mesmos que soltar o card ali gravaria; "No value" não grava nada, checkbox No grava `false`) e, com **filtro por checkbox**, a caixa do filtro **marcada** (senão a nota não entraria no board). A nota abre no modal "Edit note" sobre o board, com o título em foco quando o tipo não tem template.
- **A nota nova não some pelos filtros da tela:** o "New" limpa a busca e, com chips ativos, liga o chip da seção da nota (no "New" da coluna, "No <Seção>"). O caderno já é o do filtro, e o "New" só existe nas colunas e seções visíveis.
- **Caderno:** o do filtro do header. Com "All notebooks": o caderno do último "New" deste board (se ainda existe), senão o caderno com mais notas do tipo, senão o **Inbox**. O tooltip do botão diz qual será.
- Se o tipo some, o board é desligado ou a coluna é apagada (até por outra janela), o board fecha e volta para as notas.

## 8. Drop

- Soltar no **cabeçalho ou no corpo da coluna** grava só a propriedade da coluna.
- Soltar numa **seção** grava a coluna e a seção **numa única gravação** (`setNoteProperties`). Soltar na seção "No value" remove o valor da seção.
- Valor igual não grava; a nota com opção apagada solta em "No value" também não.
- Toda gravação passa por `setNoteProperties`, com a mesma regra da barra de propriedades: valor vazio remove a chave.

## 9. Filtro por checkbox

- Com **Only notes where <checkbox> is checked**, só entram no board as notas com a caixa marcada (`true`). A contagem da linha do board (abaixo de Tasks) segue o filtro.
- Filtro apontando para uma propriedade apagada é ignorado: todas as notas entram.

## 10. Export CSV

- **Export CSV** salva os cards **visíveis** (com caderno, busca e chips aplicados) num arquivo `<Tipo>-board.csv`, pelo diálogo nativo (comando Rust `export_csv`, que divide o helper `save_text_with_dialog` com o `export_markdown`).
- Formato do **Build your own Radar** (Thoughtworks): cabeçalho `name,ring,quadrant,isNew,description`, seguido das demais propriedades do tipo (nome da propriedade, na ordem do tipo, menos coluna, seção e a "Description"). Propriedade cujo nome repete uma coluna do BYOR (name, ring, quadrant, isNew, description; sem caixa e sem espaços nas pontas) ganha o sufixo " (property)" no cabeçalho.
  - `name` = título; `ring` = valor da coluna (`Yes`/`No` no checkbox, vazio em "No value"); `quadrant` = opção da seção (vazio sem seção ou sem valor); `isNew` = `FALSE`.
  - `description` = o valor da propriedade chamada **"Description"** (sem caixa; nunca a coluna nem a seção). Sem essa propriedade, **ou com ela vazia na nota**, o **1º parágrafo de texto da nota** (`noteFirstParagraph`, `src/lib/noteSearch.ts`): limpo como a busca (sem Markdown, HTML, imagens base64 nem blocos internos), pulando título, lista/checklist, tabela (em pipe ou HTML), código (o bloco entre cercas inteiro, mesmo com linha em branco dentro) e divisória, e cortado em 300 caracteres com "…" (sem partir um emoji).
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
- O board de notas se chama sempre "<Tipo> notes · by <Propriedade>" (ex.: "TODOS notes · by Status") e fica em outro lugar da navegação (linhas de board abaixo de Tasks, fora do seletor de visões de Tasks), o que separa os dois.

## 13. Fora de escopo / depois

- Limite WIP, prazos, coluna "done", ações em lote e ordem manual dos cards.
- Flag por nota para entrar no board e visões salvas do board.
- Radar circular (radial) dentro do Monet: o caminho é o export CSV para o BYOR.
- IA criando ou movendo cards.
