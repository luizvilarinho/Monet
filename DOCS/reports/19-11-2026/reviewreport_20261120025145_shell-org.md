# Code Review: Fase B, Fatia 1 (casca e navegação) e Fatia 3 (organização de notas)

- Task report: `DOCS/reports/19-11-2026/taskreport_20261119214343.md`
- Execution report: `DOCS/reports/19-11-2026/executionreport_20261119214343.md` (sessões "Fase B, Fatia 1" e "Fase B, Fatia 3")
- Triagem: `DOCS/reports/19-11-2026/uxtriage_20261119224845.md`
- Relatórios UX: `uxreport_20261119224729_shell.md` e `uxreport_20261119224616_organizacao.md`
- Escopo: os arquivos listados pelas duas sessões do codeAgent, só os trechos da Fase B, mais os três ajustes de integração do Orquestrador (`--text-muted` em `#9494ad`, `--dot-activity` removido, Archive/Unarchive fora do `NoteTypePicker` e as props correspondentes fora do `App.tsx`). Os trechos da Fase A em `App.tsx`, `NotebookList.tsx` e `UpdaterDialog.tsx` não foram revisados de novo.
- Verificação feita: `npx tsc --noEmit` sem erros (o `tsconfig.json` inclui `src` e tem `noUnusedLocals`); `npx vitest run` com 8 arquivos e 87 testes passando. O app não foi rodado.

## Veredicto

**Veredicto: APROVADO COM RESSALVAS**

As duas fatias entregam o que a triagem aceitou, sem quebra de tipo e sem código morto. Três pontos devem ser resolvidos antes do merge: o "Dismiss" do banner pode esconder uma falha de gravação nova; os modais de mesclar executam uma ação irreversível com um Enter logo ao abrir; e a nota TODOS perdeu o "Archive" no editor depois da integração.

## Achados

### [crítico]
Nenhum.

### [importante]

**I1. Depois de um "Dismiss", uma falha de gravação nova pode não aparecer** (`src/App.tsx:4384-4402`, estado em `:918`)
- O que acontece: o `dismissErrorBanner` grava em `dismissedBannerKey` o texto dos erros de gravação, e o banner só volta se a chave mudar. Essa chave nunca é zerada. O `useNotes.save` limpa o `saveError` quando uma gravação dá certo e repõe a mesma frase na próxima falha.
- Cenário de falha: uma nota não grava, e o banner vermelho mostra "Failed to save note. Your changes may be lost.". A pessoa clica em Dismiss. A gravação seguinte dá certo e o erro some. Mais tarde outra gravação falha com a mesma frase: a chave volta a ser igual à dispensada e o banner não aparece. A pessoa perde dado sem aviso, que é justamente o caso que o S19 deixou em vermelho.
- A própria sessão do codeAgent descreve outro comportamento ("esconde os de gravação até mudar o conjunto"). O conjunto muda (fica vazio e volta), mas a comparação só olha a foto do momento do Dismiss.
- Correção sugerida: zerar `dismissedBannerKey` quando `saveErrors` ficar vazio. Por exemplo, um efeito sobre `saveErrors.join('\n')` que chama `setDismissedBannerKey('')` quando a lista está vazia. Outra opção é dispensar por ocorrência, com um contador que os hooks incrementam a cada falha.

**I2. Os modais de mesclar pré-selecionam o 1º item, e um Enter ao abrir executa a fusão** (`src/components/NotebookPickerModal/NotebookPickerModal.tsx:51` e `:89`; `src/components/Sidebar/MergeNoteModal.tsx:34` e `:77`)
- O que mudou: antes, o botão ficava desabilitado até a pessoa escolher um item. Agora `activeId` cai no `shown[0]` quando nada foi escolhido, o campo de busca abre com foco e o Enter nele confirma.
- Cenário de falha 1 ("Merge into another notebook…", S5): o Quick Notes fica sempre no topo, então ele é o destino pré-selecionado. Abrir o modal e apertar Enter funde o caderno inteiro no Quick Notes, e o caderno de origem some. Depois do picker não há confirmação, porque `onConfirm` chama direto o `onMoveNotebook` (`NotebookList.tsx:984-987`).
- Cenário de falha 2 ("Merge into another note…", S7): Enter ao abrir funde a nota na 1ª da lista e apaga a origem. Só há confirmação quando a origem tem tasks de TODOS (`Sidebar.tsx:518-529`).
- Em nenhum dos dois casos o conteúdo some: a nota vira subject, ou o texto vai para o destino. Mas a estrutura muda de forma irreversível com uma tecla, e o S5 e o S8 pedem o contrário (explicar a fusão e evitar o Enter distraído). Para "Move to another notebook…" (S10), a pré-seleção é aceitável, porque mover é reversível e o toast mostra o destino.
- Correção sugerida: no modo `destructive` do `NotebookPickerModal` e no `MergeNoteModal`, não cair no `shown[0]` com a busca vazia. O Enter só vale com seleção explícita (setas ou clique), ou com busca digitada e um resultado único. A pré-seleção continua no modo não destrutivo.

**I3. A nota TODOS perdeu o "Archive" no editor** (`src/App.tsx:4251-4255`; `src/components/NoteTypes/TodosPanel.tsx:37-44`)
- O que mudou: o Orquestrador tirou Archive/Unarchive do `NoteTypePicker`. O botão "Archive" do editor exclui a TODOS (`activeNoteType?.id !== TODOS_TYPE_ID`), com o comentário "a TODOS tem o dela no painel". Só que o "Archive" do `TodosPanel` só aparece com `total > 0 && done === total`.
- Cenário de falha: uma TODOS com tasks abertas, ou sem tasks, não tem mais como ser arquivada pelo editor. Antes dava pelo menu do tipo. O fluxo de `handleSetArchived` para TODOS com tasks abertas ("Archive anyway" / "Mark open as Dropped and archive", `App.tsx:3015-3031`) só é alcançável pelo ícone da linha na lista de notas. O O4 da triagem pede o "Archive" com rótulo no cabeçalho para todas as notas.
- Unarchive: está coberto, porque o `ArchivedBadge` aparece para nota arquivada com ou sem tipo (`App.tsx:4234-4238`).
- Correção sugerida: tirar a exclusão da TODOS no `onArchive` do editor (o `handleSetArchived` já pergunta quando há tasks abertas). O "All done · Archive" do painel pode ficar como atalho.

### [nit]

**N1. O texto de excluir caderno diz "open tasks"** (`src/components/NotebookList/NotebookList.tsx:624`)
- O `relocateNotebookTasks` (`App.tsx:1038-1046`) leva todas as tasks do caderno para o Quick Notes, inclusive as concluídas. Sugestão: "Its tasks move to Quick Notes."

**N2. O `--text-muted` ficou quase igual ao `--text-secondary`** (`src/App.css:11`)
- O contraste vale em todos os fundos (5,48 em bg-app, 6,04 em bg-panel, 5,56 em surface-1, 4,56 em surface-2 e 4,55 em surface-3). Entre muted e secondary, porém, a razão é 1,04:1, e a hierarquia entre os dois tons some: só a matiz muda. O comentário está correto. Fica para o Orquestrador decidir se clareia o secondary ou aceita.

**N3. O `createOption` devolve sucesso quando a gravação falha** (`src/hooks/useNoteTypes.ts:226-234`)
- O `updateDef` aplica a mudança na memória e engole a falha do `persist`, que só liga o banner. O "New option…" da nota aplica na nota um id de opção que não está no banco, e depois de recarregar o valor aparece vazio. O padrão é anterior (`updateDef`), mas o O3 depende dele. Sugestão: o `updateDef` devolver o boolean do `persist`, e o `createOption` lançar `'Failed to save the option.'` quando vier false.

**N4. O "Couldn't undo" do Resolve também aparece quando a gravação falha** (`src/components/MarksView/MarksView.tsx:226`; `src/App.tsx:3769-3779`)
- O `handleUndoResolveMark` devolve false tanto para "a nota mudou" quanto para "o `saveNote` falhou", e a mensagem fala só da primeira. Na falha de gravação, o banner já aparece, mas a linha engana. Sugestão: devolver o motivo (`'changed' | 'failed'`) ou um texto neutro ("Couldn't undo the resolve.").

**N5. O `ConfirmModal` usa ids fixos e uma escuta global de Esc** (`src/components/ConfirmModal/ConfirmModal.tsx:36-46` e `:57-61`)
- Com duas confirmações abertas ao mesmo tempo (dois donos de `useConfirm`, por exemplo um modal pai e o App), os ids `confirm-modal-title` e `confirm-modal-message` se repetem. Além disso, a escuta registrada antes (a de baixo) recebe o Esc primeiro e cancela a confirmação errada. É um caso raro. Sugestão: `useId()` para os ids. Para o Esc, uma pilha simples (só a última confirmação aberta trata a tecla), se o caso aparecer.

**N6. O menu "Assign to subject" não segue a rolagem** (`src/components/Sidebar/Sidebar.tsx:91-102`)
- A posição é fixa e calculada uma vez. Se a lista rolar (roda do mouse) com o menu aberto, ele fica solto da linha. Sugestão: fechar o menu no `scroll` da lista (captura) e no `resize`.

## Conferência com a triagem

- Fatia 1: S1 a S25, S27 a S32, O3 e O26 implementados no recorte aceito. O S3 do editor (`EmptyEditor`) ficou para a sessão da fatia 2, e a fiação em `App.tsx` (`hasNotebooks`, `onCreateNotebook`) está certa. O `?` das Tasks já chama `stopPropagation` e `preventDefault` (`useTaskKeyboard.ts:230-236`), então os dois overlays não abrem juntos. Os atalhos listados no overlay existem no código (Alt+Enter, Alt+↑↓ no board, Ctrl+K, Ctrl+M e Ctrl+Alt+R).
- Fatia 3: O1 a O3, O5, O7 a O11, O13, O14, O16 a O24, as bordas do Calendar e o "Create note" implementados. O O7 segue a proposta do relatório UX à letra: "Delete type" com rótulo, e o ícone Trash igual na propriedade e na opção. O O4 é o I3.
- Integração do Orquestrador: `--dot-activity` não tem mais referência (o Calendar usa `--cal-edited`, definido em `CalendarView.module.css:3`). Nenhum chamador ainda passa `archived` ou `onSetArchived` ao `NoteTypePicker` (tsc limpo). O efeito colateral da remoção é o I3.
- Pontos verificados sem problema:
  - o "Undo" do Resolve aparece no editor, que sincroniza `value` externo (`Editor.tsx:690-703`);
  - `saveNote` preserva `typeId`, `properties` e `archivedAt` da memória, então o "Create note" com `type:` não perde o tipo;
  - o restore do S1 roda uma vez, depois dos dois loads, e não grava a posição antes disso;
  - o `HeadingNavigator` alcança os itens pelo Tab (o painel é irmão no DOM);
  - todos os popovers novos estão com z-index 1100.

## Bugs extras (fora do recorte; não entram no veredicto)

- **Ctrl+P abre sobre um modal** (`src/App.tsx:1430-1433`): diferente do Ctrl+N e do Ctrl+1…4, ele não confere `[aria-modal="true"]`, e o palette pode abrir sobre uma confirmação. O relatório UX da casca apontou isso (seção de bordas); a triagem não listou.
- **Excluir caderno falha em silêncio quando as tasks não mudam de caderno** (`src/App.tsx:2963-2964`): `if (!ok) return` sem banner. O `handleMoveNotebook` ganhou `setStructureError` no mesmo caso.
- **Mesclar notas com falha nas tasks** (`src/App.tsx:3331-3356`): o destino já foi gravado com o conteúdo da origem quando a mudança das tasks falha. A mensagem diz "Both notes were kept" (verdade), mas uma nova tentativa duplica o conteúdo no destino. É a ordem das gravações da Fase A.
- **Respostas de IA ao mesclar nota** (S7, apontado no relatório UX da casca): o `deleteNote` não mexe em `ai_responses`, e os blocos `/comando` que vão para o destino continuam com `note_id` da origem apagada. Se o destino os desenha, não verifiquei (sem contexto). Cai na decisão do autor "respostas de IA órfãs de nota apagada".
