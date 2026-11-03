# Estudo: organização da coluna de cadernos (R9)

> Autor: uxAgent · 2026-11-03 · Task: `DOCS/reports/03-11-2026/taskreport_20261103121310.md` (R9, com R7 e R8 como insumo)
> Mockups: `DOCS/features/notebook_column_study/index.html` (abre direto no navegador; uma página por opção, mais "Hoje").
> Escopo: só a coluna "Notebooks" (`src/components/NotebookList/NotebookList.tsx` + `NotebookList.module.css`). Nada foi alterado em `src/` nem em `src-tauri/`.

## 1. Resumo

A coluna confunde porque **uma única lista sob o título "Notebooks" mistura quatro tipos de coisa** (visão agregada, visões fixas, um caderno fixo e os cadernos do usuário) e porque **caderno e subject têm quase o mesmo peso visual**. As quatro opções separam as visões fixas dos cadernos. Elas diferem em como mostram os subjects e onde ficam Tags e Marks.

**Recomendação: opção B (views fixas + árvore de cadernos), em duas etapas.** A primeira etapa é a opção A (seções, Quick Notes fixo, subject com cara de subnível, subject "Tasks" fora, Tags e Marks recolhíveis), que já resolve as duas reclamações com pouco código. A segunda adiciona a árvore com seta em qualquer caderno e o trilho útil na coluna recolhida.

## 2. Diagnóstico do estado atual (conferido no código)

| # | Observação | Evidência |
|---|---|---|
| 1 | Sob o cabeçalho "Notebooks" estão, na mesma `<ul>`: "all notes", Calendar, Tasks, os boards (ou "Set up a board…") e, depois, a lista ordenável de cadernos. O título promete cadernos e entrega quatro tipos de item. | `NotebookList.tsx:555-727` (cabeçalho em 557; all notes 574-579; Calendar 581-605; Tasks 607-615; boards 617-648; cadernos 650-726) |
| 2 | Visões fixas e cadernos usam a mesma linha (`.row`, 13px, `--text-secondary`). A única diferença é o ícone colorido das views; os cadernos não têm ícone. | `.list li` e `.row` em `NotebookList.module.css:105-126`; ícones em `.calendarIcon`, `.tasksIcon`, `.boardIcon` (284-337) |
| 3 | O Inbox é um caderno comum dentro da lista ordenável: arrasta e renomeia (duplo clique), só não move nem exclui. | `isInbox` em `NotebookList.tsx:91` e 158; lista ordenável em 654-725; `ensureInbox` cria com nome "Inbox" (`App.tsx:711-718`) |
| 4 | Caderno e subject quase iguais: caderno 13px/400 `--text-secondary`; subject 12px/400 `--text-secondary`. Recuo de 8px (`margin-left`) + 12px (`padding-left`); linha-guia de 2px em `--border` (`#2e2f2cb3`), quase invisível sobre `--bg-panel`. | `.subjectContainer` (392-409), `.subjectList` (422-430), `.subjectRow` (433-446) |
| 5 | O rótulo "Subjects" (12px, 500, `--text-muted`, opacidade .6) é estilizado como cabeçalho de seção, igual a "Notebooks", "Tags" e "Marks". Lê-se como uma seção nova, não como "dentro deste caderno". | `NotebookList.tsx:680-691`; `.subjectHeaderLabel` (530-537) vs `.header` (46-54) |
| 6 | O subject "Tasks" aparece em todo caderno com tasks, com o mesmo ícone laranja (`ListChecks`, `--accent-task`) da view Tasks. O `NotebookList` recebe `subjects` sem filtro; só a coluna Notes filtra. | `SortableSubjectItem` (`NotebookList.tsx:227, 254-256`); `subjects={subjects}` em `App.tsx:3492` vs `effectiveSubjects.filter((s) => !isTasksSubject(s))` em `App.tsx:3695` |
| 7 | Com um subject selecionado, o caderno e o subject ficam os dois com fundo ativo (`--surface-2`): dois itens "selecionados" ao mesmo tempo. | `isActive={!viewActive && nb.id === activeId}` (663) e `isActive={subject.id === activeSubjectId}` (703) |
| 8 | Subjects só existem para o caderno ativo: o `useSubjects` lê do banco só os subjects de `activeNotebookId`. Não há como ver a estrutura de outro caderno sem trocar de caderno. | `useSubjects(activeNotebookId)` (`App.tsx:~410-419`), `src/hooks/useSubjects.ts:6-19` |
| 9 | As ações de hover (documentos, mover, excluir) ocupam largura mesmo invisíveis (`opacity: 0`), e o mesmo vale para a alça de arraste. Na largura padrão (180px) nomes como "Arquitetura de Software" e "MBA - FullCycle" são cortados sempre, não só no hover. | `.rowDelete, .rowDocs` (166-184), `.rowMove` (217-234), `.dragHandle` (128-138); largura padrão 180 em `App.tsx:494-497` |
| 10 | Tags e Marks são listas sem limite, sempre abertas, abaixo dos cadernos; empurram o rodapé e alongam a rolagem. | `NotebookList.tsx:732-794` |
| 11 | Recolhida (48px), a coluna mostra só o botão de expandir, Knowledge Base e Settings. Não dá para trocar de caderno nem abrir Calendar/Tasks; e a coluna Notes diz só "Notes", sem o nome do caderno. | `NotebookList.tsx:541-552`; `COLLAPSED_PANEL_WIDTH = 48` (`App.tsx:250`); cabeçalho "Notes" em `Sidebar.tsx:~440` |

O que já funciona e deve ser mantido: linhas densas de 34px com ritmo consistente; progresso de tasks por caderno (`2/5`, vermelho com atraso); ícone de documentos aceso quando o caderno tem documentos; confirmação ao excluir caderno e subject; "Turn into notebook" no subject; TagView e MarksView já têm chips para trocar de tag e rótulo (`TagView.tsx:139-151`, `MarksView.tsx:77-84`), o que libera a coluna de listar tudo.

## 3. Princípios

1. **Um tipo de coisa por seção.** Lugares fixos do app (views) e conteúdo do usuário (cadernos) não dividem a mesma lista nem o mesmo título.
2. **Cada nível com uma linguagem visual.** View = ícone colorido. Caderno = nome em peso 500. Subject = menor, mais apagado, recuado sob uma linha-guia visível, com ícone de pasta. A diferença não pode depender de um só atributo.
3. **Um item selecionado por vez.** Só o item aberto tem fundo; o caderno que contém o subject aberto fica só com o texto claro.
4. **Posições fixas para o que é fixo.** Quick Notes, Calendar e Tasks não se arrastam nem se renomeiam e ficam sempre no mesmo lugar (memória espacial).
5. **O conteúdo do usuário ocupa o espaço.** A persona do PRD estuda temas longos por cadernos; a lista de cadernos é o centro da coluna, e o resto (Tags, Marks, boards) não pode empurrá-la.
6. **Transitório parece transitório.** Quick Notes mostra quanto tem e há quanto tempo, sem alarme.
7. **Recolhida ainda navega.** Coluna recolhida não pode virar beco sem saída.
8. **Mudança proporcional.** Preferir o que reaproveita `NotebookList`, os tokens de `App.css` e os handlers existentes.

## 4. O que vale para todas as opções

- **Quick Notes (R7):** sai da lista ordenável (filtrar `INBOX_NOTEBOOK_ID` como já se faz com `calendarNotebookId` em `NotebookList.tsx:650-659`) e vira a **primeira view**, com ícone Phosphor `Lightning` (cor `--accent-late`), sem arrastar, renomear, mover nem excluir. Mostra a contagem de notas (sem notas-corpo de task e sem arquivadas) e um **selo de idade** (ex.: `12d`) quando a nota mais antiga passa de 7 dias. No hover, "+" com o tooltip "New quick note (Ctrl+N)", o que ajuda a descobrir o atalho. O botão de documentos continua acessível (hoje o Inbox tem).
- **Apoio à revisão do Quick Notes** (proposta; toca a coluna Notes, não o `NotebookList`): com Quick Notes aberto, a coluna Notes ordena da mais antiga para a mais nova, mostra a idade de cada nota e um botão "Move to…" no hover, que reaproveita o `onMoveNote` + `NotebookPickerModal` que a nota já tem (`Sidebar.tsx:152-155`). Mockup no 3º quadro da opção B.
- **Subject "Tasks" (R8):** filtrado da lista de subjects da coluna (`subjects.filter((s) => !isTasksSubject(s))`), continua no banco como contêiner das notas-corpo. As tasks do caderno continuam no `NotebookTasksSection` da coluna Notes, e a view Tasks continua filtrando por caderno.
- **Sem o rótulo "Subjects":** a criação de subject vira "New subject" (linha no fim da lista ou "+" no hover do caderno).
- **Um fundo de seleção só:** o caderno pai do subject aberto fica com texto `--text-primary`, sem fundo.
- **Ações de hover só ocupam espaço no hover** (`display: none` → `inline-flex`), em vez de `opacity: 0` com a largura reservada. Os nomes deixam de ser cortados em repouso. O ícone de documentos aceso continua sempre visível.
- **"All notes"** fica no topo da seção Notebooks (é a soma dos cadernos), com o rótulo em maiúscula como as outras entradas.
- **Caminho no cabeçalho da coluna Notes** (proposta, fora do `NotebookList`): trocar "Notes" por "Caderno › Subject" (ícone `CaretRight` como separador). Ajuda sempre e é essencial com a coluna recolhida.

## 5. Opções

Mockups: `index.html` (comparação), `current.html` (hoje), `option-a.html` … `option-d.html`, todos em `DOCS/features/notebook_column_study/`.

### Opção A: seções separadas (menor mudança)

**Como fica.** Seção **Views** no topo (Quick Notes, Calendar, Tasks, boards), com o botão de recolher no cabeçalho. Seção **Notebooks** só com os cadernos do usuário (ícone `Notebook` de 14px + nome em peso 500), "+" de novo caderno no cabeçalho. Subjects **só no caderno ativo**, sem o rótulo "Subjects": 12px, peso 400, `--text-muted`, ícone `FolderSimple` de 12px, sob linha-guia de 1px em `--hair` alinhada ao ícone do caderno; "New subject" como última linha. **Tags** e **Marks** viram seções recolhíveis com o total no cabeçalho (estado lembrado). **Recolhida:** trilho de ícones das views, um botão "Notebooks" que abre um menu flutuante com os cadernos, e ícones de Tags (`Hash`) e Marks (`Highlighter`).

- **Prós:** mudança pequena e de baixo risco; resolve a mistura de tipos e o peso parecido; quem já usa encontra tudo quase no mesmo lugar.
- **Contras:** a estrutura dos outros cadernos continua invisível até abri-los; três ações no hover do caderno seguem apertadas a 180px; com Tags aberta a coluna continua longa.
- **Impacto no código:** `NotebookList.tsx` reorganiza o JSX em duas seções e filtra o Inbox da lista ordenável; remove o cabeçalho "Subjects" (680-691) e põe a linha "New subject"; filtra `isTasksSubject`; Tags/Marks com estado recolhido em `localStorage`; ramo `collapsed` (541-552) ganha o trilho e um menu de cadernos. Novas props: dados do Quick Notes (contagem, idade da mais antiga) e callback de nova nota. CSS: estilos novos de subject, guia e trilho. **Esforço: pequeno.**

### Opção B: views fixas + árvore de cadernos (recomendada)

**Como fica.** Views como na A. Cadernos viram uma **árvore**: seta (`CaretRight`, gira 90°) nos cadernos que têm subjects. O caderno ativo abre sozinho e **qualquer outro pode ser aberto pela seta sem trocar de caderno**; clicar num subject de outro caderno troca caderno e subject, como o Ctrl+P já faz. O caderno fica sem ícone (seta + nome em 500); o subject fica em 12px, `--text-muted`, com pasta de 12px, recuado sob a seta, com linha-guia `--hair` e a **contagem de notas**. No hover do caderno: "+" (New subject), documentos e um menu `DotsThree` (rename, move into…, delete). Excluir passa a ficar a um clique a mais, o que é bom para uma ação destrutiva. O arraste passa a ser pela linha inteira, sem a alça (o `PointerSensor` já exige 5px de movimento). **Tags** e **Marks** em acordeão **fechado por padrão** no fim, com o total no cabeçalho. **Recolhida:** trilho com as views, as **iniciais** dos cadernos (2 letras, nome no tooltip, ativo destacado) e Tags/Marks.

- **Prós:** árvore é o padrão mais reconhecido para "pasta dentro de pasta" (VS Code, Obsidian, OneNote); mostra a estrutura sem navegar; coluna curta por padrão; trilho recolhido útil.
- **Contras:** precisa dos subjects de todos os cadernos e de lembrar quais estão abertos; com tudo aberto, a árvore fica longa; iniciais podem colidir (Monet × Migração: "Mo"/"Mi"), o que a cor do caderno (`notebooks.color`, já usada nas visões de Tasks) pode atenuar.
- **Impacto no código:** tudo da A, mais:
  - carregar subjects de todos os cadernos: método novo de storage (uma consulta em `subjects`, ao lado de `getSubjects` em `src/storage/tauri.ts:750`) ou um hook `useAllSubjects`, com refresh após criar, renomear, excluir, reordenar e mover; prop `subjectsByNotebook`;
  - `handleSelectSubject` (`App.tsx:2353`) passa a receber o `notebookId` (hoje usa o `activeNotebookId`);
  - estado de abertos (`Set` em `localStorage`, ex.: `monet:notebook-expanded`);
  - um `DndContext` de subjects por caderno aberto (hoje há um só);
  - menu de mais ações do caderno com os handlers existentes;
  - contagem de notas por subject a partir de `notes` em `App.tsx`;
  - iniciais e cor no trilho.

  **Esforço: médio.**

### Opção C: lançador de views + árvore só de cadernos (contra decisão das specs)

**Como fica.** As views viram uma **grade de 6 botões com rótulo** (Quick Notes, Calendar, Tasks, Boards, Tags, Marks), com selos (contagem do Quick Notes, âmbar quando há nota velha; total de marcas). Boards abre um menu com os boards e "Set up a board…" (com um board só, abre direto). Tags e Marks **deixam de ser seções**: o botão abre a TagView/MarksView na coluna Notes, que já têm chips. O resto da coluna é **só a árvore de cadernos** da B. **Recolhida:** os mesmos 6 ícones na mesma ordem, seguidos das iniciais.

> **Contra decisão já tomada:** `DOCS/specs/tags.md` (seção "Tags" com contagem na coluna) e `DOCS/specs/notemark.md` (seção "Marks" na coluna); `DOCS/specs/noteboard.md` põe os boards como linhas abaixo de Tasks.

- **Prós:** separação máxima (views não são linhas, não há como confundir com caderno); altura fixa das views por mais boards, tags e marcas que existam; aberta e recolhida mostram exatamente as mesmas entradas; coluna dedicada ao conteúdo do usuário, alinhada à tese do PRD.
- **Contras:** perde a visão das tags e rótulos com contagem sem clicar; rótulos de 11px em botões de ~60px cortam nomes ("Quick Notes" quebra em duas linhas a 220px); o nome do tipo de cada board some atrás de "Boards"; Boards e Tags custam um clique a mais; maior mudança visual.
- **Impacto no código:** tudo da B, mais a grade, o menu de boards e o estado inicial da TagView sem tag escolhida (hoje ela abre com uma tag). Ajustar as três specs. **Esforço: médio a grande.**

### Opção D: caderno em foco, navegação em dois níveis (contra decisão das specs)

**Como fica.** Views fixas no topo, incluindo **Tags** e **Marks** como uma linha cada (com o total). Na raiz, a seção Notebooks lista só cadernos, cada um com seta para entrar. Ao entrar, a seção troca para o conteúdo do caderno: link "Notebooks" com seta de voltar (Esc também volta), o nome do caderno como título (14px, 600, com documentos e menu), "All in <caderno>" e os subjects como linhas de 13px com pasta, mais "New subject". Caderno e subject **nunca aparecem juntos**. **Recolhida:** views em ícone e só o caderno atual, que abre um menu de troca.

> **Contra decisão já tomada:** Tags e Marks como seções com lista (specs de tags e marks).

- **Prós:** distinção total caderno × subject sem depender de recuo ou fonte; escala para muitos cadernos e muitos subjects; subjects ganham linhas confortáveis.
- **Contras:** trocar de caderno de dentro de outro custa um clique a mais; some a visão geral enquanto se está dentro de um caderno; estado novo de navegação (raiz × dentro) que precisa conversar com Ctrl+P, links de nota, Calendar e a navegação por tasks (`handleNavigateToNote`).
- **Impacto no código:** estado "dentro de caderno" no `NotebookList` (ou no App), sincronizado com `activeNotebookId`; duas renderizações da seção; Tags/Marks como linhas; menu de troca no trilho. **Esforço: médio a grande.**

### Comparação

| Critério | A | B | C | D |
|---|---|---|---|---|
| Views × cadernos | Seções | Seções | Grade de botões | Seções |
| Caderno × subject | Bom (ícone, peso, guia) | Muito bom (seta, peso, guia, contagem) | Igual à B | Total (nunca juntos) |
| Subjects de outros cadernos | Não | Sim, pela seta | Sim, pela seta | Não |
| Tags e Marks | Recolhíveis | Acordeão fechado | Fora da coluna (botões) | Linhas em Views |
| Altura da coluna | Média | Curta por padrão | Curta | Curta |
| Recolhida | Ícones + menu | Ícones + iniciais | Ícones + iniciais | Ícones + caderno atual |
| Respeita specs atuais | Sim | Sim | Não | Não |
| Esforço | Pequeno | Médio | Médio a grande | Médio a grande |

## 6. Recomendação

**Opção B, entregue em duas etapas:**

1. **Etapa 1 = opção A** (com R7 e R8): seções Views/Notebooks, Quick Notes fixo com contagem, idade e Ctrl+N, subject "Tasks" fora, subject com cara de subnível, um fundo de seleção só, ações que só ocupam espaço no hover, Tags/Marks recolhíveis. Resolve as duas queixas do Coordenador e já pode ser validada no uso real.
2. **Etapa 2 = árvore e trilho**: setas em qualquer caderno, contagem por subject, menu de mais ações, arraste pela linha e trilho com iniciais na coluna recolhida.

Por quê: B é a única opção que deixa a hierarquia explícita **e** mostra a estrutura dos cadernos sem esconder nada nem mudar decisões já aprovadas. A etapa 1 é barata e reversível. C e D são boas no que prometem, mas tiram Tags e Marks da coluna contra as specs (C) ou criam um modo de navegação novo com custo de clique (D). Ficam como alternativa se, depois da etapa 1, a coluna continuar longa demais.

Junto da etapa 1, vale fazer as duas propostas fora do `NotebookList`: o caminho "Caderno › Subject" no cabeçalho da coluna Notes e a revisão do Quick Notes (mais antigas primeiro, idade e "Move to…").

## 7. Decisões pendentes para o Coordenador

1. **D1. Opção:** B em duas etapas (recomendado), só A, C ou D? Pode misturar (ex.: B com Tags/Marks como na D).
2. **D2. Nome do bloco fixo:** "Views" (mockups), "Pinned", ou sem rótulo, só com o divisor?
3. **D3. Ícone e cor do Quick Notes:** `Lightning` em `--accent-late` (mockups), `NotePencil` ou `Tray`?
4. **D4. Idade no Quick Notes:** mostrar o selo? A partir de quantos dias (proposta: 7)? A revisão na coluna Notes (mais antigas primeiro, idade, "Move to…") entra nesta task ou fica para depois?
5. **D5. "All notes":** no topo de Notebooks (proposta) ou em Views?
6. **D6. Subjects de outros cadernos (B/C):** abrir pela seta sem trocar de caderno? O ativo abre sozinho? Lembrar quais ficaram abertos entre sessões?
7. **D7. Ações do caderno no hover:** manter documentos, mover e excluir como hoje, ou "+" (New subject), documentos e menu (rename, move into…, delete)? E as ações só ocupando espaço no hover?
8. **D8. Arraste:** pela linha inteira (sem alça) ou manter a alça `DotsSixVertical`?
9. **D9. Tags e Marks:** recolhíveis abertas (A), acordeão fechado (B), ou fora da coluna (C/D, exige mudar as specs `tags.md` e `notemark.md`)?
10. **D10. Coluna recolhida:** trilho já na etapa 1 ou só na 2? Iniciais dos cadernos ou menu "Notebooks"?
11. **D11. Cabeçalho da coluna Notes com "Caderno › Subject":** entra no R9 (toca `Sidebar.tsx`)?
12. **D12. Contagem de notas por subject:** mostrar (B/C/D) ou não?
13. **D13. "Set up a board…":** manter a linha fixa quando não há board (ocupa uma linha para sempre) ou mostrar só no menu de tipos e no Settings?

## 8. Premissas e limites

- Mockups estáticos em HTML; o comportamento (hover, setas, acordeão) foi simulado. Medidas e cores copiadas de `NotebookList.module.css` e `src/App.css`, renderizadas a 220px (o padrão do app é 180px, ajustável de 140 a 320). Não foi possível validar no app rodando.
- Dados dos mockups são de exemplo (nomes de cadernos, subjects e boards dados pelo Coordenador; contagens inventadas).
- Referências de mercado citadas de memória e só como padrão de leitura: árvore com seta (VS Code, Obsidian, OneNote); pasta fixa de notas rápidas no topo (Apple Notes, "Quick Notes"); caixa de entrada fixa acima das listas (Things).
- Validar depois da etapa 1: se o Coordenador passa a abrir subjects de outros cadernos sem trocar (indica valor da etapa 2); com que frequência o Quick Notes é esvaziado (idade média das notas); se Tags/Marks fechados por padrão escondem algo que era usado.
- Caso de borda para R7: se já existir um caderno chamado "Quick Notes", a view fixa (id `inbox`) e o caderno do usuário vão aparecer com o mesmo nome em seções diferentes. A seção deixa claro qual é qual, mas vale renomear ou fundir na migração.
