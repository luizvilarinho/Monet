# Review Report — R3: Tasks, App e cadernos — 20261018135755

## Escopo
- **Base:** `git diff develop` (branch `feature/rag-assistant`, sem commit).
- **Arquivos:**
  - `src/components/TasksView/TaskEditorModal.tsx` e `TaskEditorModal.module.css` (novos, lidos inteiros);
  - `TaskCard.tsx`, `TaskCard.module.css`, `TasksView.module.css` e `TasksHeader.module.css`;
  - `src/lib/tasks.ts`;
  - `src/App.tsx` (diff inteiro);
  - `src/components/NotebookList/NotebookList.tsx`;
  - `src/storage/index.ts`, `tauri.ts` e `browser.ts`.
- **Lido como contexto, sem revisar:**
  - `useChat.ts`: `deleteNotebookChatFolder`, `moveNotebookChatFolder` e `countNotebookChatConversations`;
  - `useNotebooks.ts`, `assistantNoteBridge.ts`, `imageOcr.ts`, `MetadataManagerModal.tsx`, `ConfirmModal.tsx` e `useTaskKeyboard.ts`;
  - os comandos de visibilidade em `documents.rs`.
- **Verificação:** `npx tsc --noEmit` passou (exit 0). O app não foi aberto.

## Veredicto
**APROVADO COM RESSALVAS.** Nenhum bloqueio no caminho normal. Antes do merge, falta tratar quatro pontos:
- a ponte de notas não é idempotente: um "Try again" depois do timeout duplica;
- quando o `removeNotebook` falha, a exclusão segue e apaga as conversas;
- um Esc no "Manage properties" provavelmente fecha os dois modais;
- o `create-note` da ponte informa sucesso mesmo quando a gravação falha.

---

## [importante]

### 1. Ponte de notas sem idempotência: "Try again" depois do timeout duplica a gravação
- **Onde:** `src/App.tsx:1954-1983` (handler da main) e `src/lib/assistantNoteBridge.ts:36-62` (`requestMain`).
- **Problema:**
  - Cada tentativa gera um `requestId` novo (`nanoid()`), e a main não guarda os pedidos que já atendeu.
  - Se a main responde depois dos 10 s, a gravação acontece, mas o modal mostra erro. O "Try again" faz um segundo `append`, e o bloco entra duas vezes na nota.
  - O mesmo vale para `create-note` (duas notas iguais) e `create-notebook` (dois cadernos).
  - O Execution Report já registra o risco do `append`. O de `create-*` não está registrado.
- **Sugestão:**
  - Assistant: gerar o `requestId` uma vez por ação do usuário e reaproveitá-lo no "Try again". Por exemplo, o `SaveToNoteModal`/`AssistantPanel` passa uma chave estável.
  - Main: manter um `Map<requestId, Promise<AssistantNoteResult>>` (com descarte por tempo ou tamanho) e devolver o mesmo resultado para um `requestId` repetido.
  - Alternativa mínima: no timeout, trocar a mensagem por algo como "The main window did not respond. The note may have been saved; check it before trying again."

### 2. Falha no `removeNotebook` não interrompe a exclusão: as conversas são apagadas e o caderno volta
- **Onde:**
  - `src/App.tsx:1581-1590` (`handleDeleteNotebook`);
  - `src/App.tsx:1880-1889` (`handleMoveNotebook`);
  - `src/hooks/useNotebooks.ts:63-78` (`remove`).
- **Problema:**
  - `remove` captura o erro do `storage.deleteNotebook`, mostra `saveError` e retorna normalmente. O `await removeNotebook(id)` nunca falha.
  - **Exclusão:** se o banco falha, `deleteNotebookChatFolder` e `deleteChatWebFolder` rodam mesmo assim. A pasta, as conversas e as fontes web são apagadas sem volta, enquanto o caderno continua no SQLite e reaparece no próximo load.
  - **Movimentação:** a fusão da pasta de chat também roda. Esse caso é menos grave, porque as notas já foram regravadas no destino.
  - O `removeNote` dos filhos que vem logo depois tem o mesmo defeito, mas ele já existia.
- **Sugestão:** fazer `remove` retornar `boolean`, como o `saveNote`. Nos dois handlers, encerrar com `if (!(await removeNotebook(id))) return` antes de mexer no chat e nas notas.

### 3. Esc no "Manage properties" aberto de dentro do modal provavelmente fecha os dois modais
- **Onde:**
  - `src/components/TasksView/TaskEditorModal.tsx:27-36` (listener no `document`);
  - `src/components/TasksView/MetadataManagerModal.tsx:90-92`.
- **Problema:**
  - O `MetadataManagerModal` fecha no `onKeyDown` do React, que roda no listener do portal em `document.body`, e não chama `preventDefault`/`stopPropagation`.
  - No React 19, a atualização síncrona é aplicada num microtask. Esse microtask roda entre o listener do `body` e o do `document`.
  - Quando o listener do `TaskEditorModal` roda, o manager já saiu do DOM, e o último `[aria-modal="true"]` passa a ser o card da task. O guarda "outro modal por cima" não pega o caso, e o modal da task fecha junto.
  - Isto foi deduzido da ordem de eventos e não foi testado no app.
- **Sugestão:**
  - No `MetadataManagerModal` (e no `StatusManagerModal:110`, pelo mesmo padrão), chamar `e.stopPropagation()` ou `e.preventDefault()` ao tratar o Esc. O `TaskEditorModal` já ignora `defaultPrevented`.
  - Incluir o caso no roteiro de teste: abrir a task no Kanban → Manage properties → Esc. Só o manager deve fechar.

### 4. `create-note` pela ponte informa sucesso mesmo com a gravação falhando
- **Onde:** `src/App.tsx:1919-1936` (`handleCreateNoteFromChat`, linha 1928) e o uso dele em `App.tsx:1960-1964`.
- **Problema:**
  - `await saveNote(filled)` ignora o `boolean` de retorno, e a ponte responde `ok: true` com a nota.
  - A Assistant mostra sucesso, enquanto o conteúdo ficou só no estado da main e some no próximo load.
  - O aviso "Failed to save note" aparece na main, que costuma estar oculta na bandeja.
  - O `append` já trata esse caso (linha 1976), mas o `create-note` não.
- **Sugestão:** `if (!(await saveNote(filled))) throw new Error('Failed to save note.')`. Isso vale também para o Chat principal, que usa o mesmo handler.

---

## [nit]

### 5. Filtro Today com `plannedDay`: a partição dos chips e a coerência com Week mudaram
- **Onde:** `src/lib/tasks.ts:376-377`.
- **Problema:**
  - Antes, `today` excluía as atrasadas, e os chips formavam uma partição.
  - Agora, uma task marcada com o sol e atrasada conta em Overdue e em Today ao mesmo tempo. Isso foi uma decisão explícita, só registro aqui.
  - Além disso, uma task marcada com o sol sem data, ou com plano numa data futura, entra em Today, mas não em Week nem no `weekTotal`. Today deixa de ser um subconjunto de Week.
  - A seção "Today" do agrupamento por data da List também não a mostra. A List coloca a task na seção da data dela, então o chip e a seção mostram números diferentes.
  - O `applyTaskPatch` grava o `rescheduleCount` normalmente: o upsert em `tauri.ts:870` usa `reschedule_count = excluded.reschedule_count`.
- **Sugestão:** decidir se Week deve incluir `plannedDay === hoje`, para manter Today ⊂ Week. Senão, registrar a assimetria.

### 6. Reset do Postponed zera também os adiamentos do Do date
- **Onde:** `src/lib/tasks.ts:150-151`.
- **Problema:** o contador é compartilhado com o Do date. Limpar o Deadline apaga também os adiamentos do Do date. É coerente com a decisão (recomeço), mas o usuário pode estranhar.
- **Sugestão:** nenhuma mudança de código; só deixar registrado no roteiro de teste.

### 7. Sem guarda do Calendar no `handleDeleteNotebook`
- **Onde:** `src/App.tsx:1575`.
- **Problema:** a proteção existe só na UI. O `NotebookList` renderiza o Calendar à parte, sem botão de excluir. O `handleMoveNotebook` já tem a guarda.
- **Sugestão:** `if (id === INBOX_NOTEBOOK_ID || id === CALENDAR_NOTEBOOK_ID) return`, como defesa.

### 8. Seleções que apontavam para as notas da origem se perdem na movimentação
- **Onde:** `src/App.tsx:1866-1878`.
- **Problema:**
  - A união cobre só origem ∪ destino.
  - Um terceiro caderno, ou uma pasta de chat manual, que tinha `notes-folder:<origem>` na seleção perde essa visibilidade depois da movimentação: a pasta de notas da origem some no diff do `useNotesIndexSync`. Ela não é trocada por `notes-folder:<destino>`.
  - A perda é silenciosa, mas o usuário recupera reselecionando.
- **Sugestão:** decisão do Orquestrador: reapontar (exige ler a tabela inteira de visibilidade e as pastas do localStorage) ou aceitar.

### 9. Texto do confirm de exclusão
- **Onde:** `src/components/NotebookList/NotebookList.tsx:420-424`.
- **Problema:**
  - Com a pasta vazia, a frase vira "Its chat (0 conversations)…".
  - "the web sources saved by it" aparece mesmo quando não existe pasta web.
  - A contagem lê o localStorage, então uma conversa recém-criada ainda não gravada pelo save-effect não entra.
- **Sugestão:** omitir a frase quando `chatCount === 0`, ou trocar por "Its chat folder will also be deleted."

### 10. Esc fecha o modal junto com outros usos do Esc dentro do Editor
- **Onde:** `src/components/TasksView/TaskEditorModal.tsx:27-36`.
- **Problema:**
  - `FormattingToolbar.tsx:84` esconde a toolbar e não chama `preventDefault`. Com um texto selecionado, o Esc esconde a toolbar e fecha o modal.
  - O mesmo vale para o cancelamento do arraste em `CommandExtension.ts:461` e `650`.
  - Não há perda de dados (tudo já foi gravado), só o fechamento inesperado.
- **Sugestão:** chamar `preventDefault` nesses handlers quando eles consomem o Esc.

### 11. O modal não prende o foco (sem focus trap)
- **Onde:** `src/components/TasksView/TaskEditorModal.tsx`.
- **Problema:**
  - O Tab pode sair do modal e chegar ao container do quadro, atrás do backdrop.
  - Lá, os atalhos do `useTaskKeyboard` agem sobre o cursor: `x` conclui, `Delete` marca como dropped (com confirmação) e `z` adia.
- **Sugestão:** um trap simples (Tab/Shift+Tab presos ao card) ou `inert` no `#root` enquanto o modal está aberto.

### 12. "Ask AI" no modal abre o painel lateral atrás do backdrop
- **Onde:** `src/App.tsx:2048-2055` (`handleAskAi`, passado ao `noteEditor`).
- **Problema:** com o modal aberto, o painel abre atrás do backdrop, e o usuário não vê nada até fechar o modal.
- **Sugestão:** no `onAskAi`, fechar o modal (`setTaskModalId(null)`), ou abrir o painel por cima.

### 13. Os controles do cabeçalho ainda se deslocam um pouco
- **Onde:** `src/components/TasksView/TasksHeader.module.css:9-14` e `ViewMenu.module.css:6-21`.
- **Problema:** com `flex-start`, a engrenagem e o seletor de projeto ficam logo depois do trigger do ViewMenu, que não tem largura fixa. O rótulo muda ("List", "Kanban", "My Day", "Projects", "Review"), então os controles ainda andam alguns px entre as visões.
- **Sugestão:** `min-width` fixa no `.trigger`, ou o ViewMenu como último item da linha.

### 14. Linha da List: fio duplo nos metadados e paradas de Tab
- **Onde:** `src/components/TasksView/TaskCard.module.css:240-251` e `349-359`.
- **Problema:**
  - Com metadados, a linha mostra o `border-top` do `.kv` e o `border-bottom` da `.listRow`: dois fios.
  - As ações agora ficam sempre no layout (`display: inline-flex`). Isso acrescenta 3 paradas de Tab por linha. Antes, elas só existiam com o hover ou o foco no card.
  - O layout dos ícones fixos está correto: o botão de 24 px com `margin-block: -4px` ocupa 16 px, dentro dos 16,5 px da linha de 11 px. A altura não muda entre os estados.
- **Sugestão:** `.listRow .kv { border-top: none; padding-top: 0 }`. Para o Tab, `tabIndex={-1}` nas ações da List, já que o teclado do quadro cobre essas ações.

### 15. Janela de corrida com dois `append` seguidos na mesma nota
- **Onde:** `src/App.tsx:1967-1976`.
- **Problema:**
  - Dois pedidos quase simultâneos (dois "Save to note" rápidos) leem o mesmo `notesRef.current`, antes do render do primeiro `setNotes`.
  - O `storage.getNote` do segundo pode rodar antes de o primeiro gravar no banco. Nesse caso, o segundo bloco sobrescreve o primeiro.
  - A chance é baixa, porque o fluxo do modal exige vários cliques.
- **Sugestão:** serializar os pedidos `append` numa fila (`let chain = Promise.resolve()`) ou guardar o conteúdo pós-append num ref local.

### 16. OCR no contexto efêmero dos comandos
- **Onde:** `src/App.tsx:1363-1371`.
- **Problema:**
  - As imagens de notas vinculadas, resolvidas por `resolveLinkedNoteContent`, não passam pelo OCR, porque o `ocrTextsForContent` recebe só `contextContents`.
  - O OCR das imagens fora do cache roda em série antes de o comando começar. Na primeira vez, numa nota com muitas imagens, o comando atrasa.
  - Não há risco de quebra: os erros são engolidos.
- **Sugestão:** aceitar e registrar, ou incluir o conteúdo das notas vinculadas na varredura.

---

## Verificado sem problema
- **Exclusão do caderno:**
  - Ordem: tasks vão para o Inbox → `removeNotebook` (o caderno sai do estado) → `deleteNotebookChatFolder` → pasta web → notas filhas.
  - A pasta não é recriada: o `deleteNotebookChatFolder` roda na mesma continuação síncrona depois do `await`, antes de qualquer render.
  - A visibilidade da origem é limpa por `useNotebooks.remove`.
  - As pastas de livro e do Reader não são tocadas: o vínculo é só `notebook → folder`.
  - O Inbox está protegido nos dois handlers. O Calendar está protegido na movimentação (origem pela guarda, destino pelo filtro do `NotebookList:491`).
- **Movimentação:**
  - Notas regravadas no destino → união da visibilidade (antes do `removeNotebook`, que apaga a da origem) → `moveNotebookChatFolder`.
  - As pastas de notas implícitas (`notes-folder:*`) não são gravadas na tabela. Confirmado em `documents_get_notebook_visible_ids` e no `setFolderVisibleDocuments`, então filtrá-las está correto.
- **`noteEditor` em dois lugares:** as duas condições se excluem (`tasksBoardOpen ? null : noteEditor` × `tasksBoardOpen && … && noteEditor`). Não há montagem dupla do Tiptap. A troca de quadro para List remonta o Editor, que já grava a cada tecla (`onUpdate` → `updateActive` → `saveNote`), então nada se perde.
- **`taskModalId`:**
  - O efeito limpa o id ao sair do quadro.
  - Wikilink e RelatedContent fecham a TasksView pelo efeito de navegação, então não fica estado preso.
  - O modal é renderizado na raiz do App, fora do container do quadro, e os eventos dele não chegam ao `onKeyDown` do `useTaskKeyboard` pela árvore do React.
- **Clique × arraste:** o `useCardDrag` não mudou. O fechamento por `onMouseDown` no backdrop não fecha numa seleção de texto que termina fora do card.
- **ConfirmModal sobre o modal:** é aberto depois, por portal no `body`, com o mesmo z-index e posição posterior no DOM, então fica por cima. Ele não trata Esc, então o modal da task não fecha por baixo.
- **CSS:**
  - Nenhuma classe órfã ou faltando em `TaskCard`, `TasksView`, `TasksHeader` e `TaskEditorModal` (checado por script).
  - `.blockFixed` foi removida.
  - Todos os valores novos estão na escala (`--space-*`, `--control-*`, `--pad-modal`, `--radius-xl`, `--lh-row`).
  - `TasksView.module.css` só é usado pela List, então tirar o gap de `.group`/`.subgroup` não afeta as outras visões.
- **Storage:**
  - `getNotesByDateRange`: o SQL do título `dd/mm/yyyy` bate com `CALENDAR_TITLE_RE`, e o `parseCalendarTitle` filtra as datas inválidas.
  - `getNoteSummaries` seleciona só os metadados.
  - `BrowserStorage` lança erro, seguindo o padrão do arquivo.
- **Código morto:** os três `onOpenTask` inline foram removidos. O `openTask` continua em uso (Calendar, DueTodayBlock, keep). O import de `unlinkNotebookFromChatFolder` saiu do App.
- **Strings de UI:** todas em inglês ("Edit task", "Close", frase do confirm, erros da ponte).

## Bugs extras
- Nenhum além do nit 15 e do defeito anterior citado no item 2 (`removeNote` dos filhos depois de uma falha do `removeNotebook`).
