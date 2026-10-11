# Execution Report

## Documents
- Task report: DOCS/reports/11-10-2026/taskreport_20261011111752.md
- Execution report: DOCS/reports/11-10-2026/executionreport_20261011112538.md
- Explorer report: DOCS/reports/11-10-2026/explorerreport_20261011112948.md
- Plan report: DOCS/reports/11-10-2026/planreport_20261011114322.md
- Review report: DOCS/reports/11-10-2026/reviewreport_20261011122335.md

## Sessions
### Orchestrator — abertura — 20261011112538
- Summary: Task Report aprovado pelo Coordenador, com um ajuste no edge case de notas sem caderno (pela regra de produto toda nota pertence a um caderno; o explorer deve verificar fluxos legados).
- Inputs:
  - DOCS/reports/11-10-2026/taskreport_20261011111752.md
- Decision: Fluxo definido pelo Coordenador, que difere do padrão: explorerAgent → plannerAgent dividindo em etapas sequenciais (pasta de notas/RAG → unificação de visibilidade → chat nas Anotações) → codeAgent por etapa, uma na sequência da outra → codereviewAgent sobre tudo → codeAgent na passada final → só então o Coordenador testa. Não há teste do Coordenador entre o desenvolvimento e a review.
- Next step: spawn explorerAgent

### ExplorerAgent — 20261011112948
- Summary: Viável, dificuldade Alta. A Parte 1 reaproveita `run_indexing`/`write_bytes_atomic`/`delete_folder_child` com comandos dedicados `notes_index_*`, IDs determinísticos (`note:<noteId>`), guard de concorrência por documento (hoje não existe) e exclusão de `origin='notes'` do scan de startup/rescan/delete. O sync recomendado é por diff do array `notes` na janela main, só depois de `loaded`. É obrigatório remover base64 e tags customizadas (8 notas em prod têm `data:image`, a maior com 3,8 MB), e `cleanContent` não serve como está. A Parte 3 tem duas semânticas de visibilidade (tabela por arquivo × chat por pasta): a tabela passa a aceitar ids de pasta, com um helper de expansão compartilhado por chat e slash commands. A resolução da pasta de chat vinculada a caderno precisa morar no `useChat`, porque a pasta também aparece no ChatPanel principal. A Parte 2 generaliza o escopo do modo reader (rebind por caderno sem remontar), com o shell de abas fora do `return null` do AiPanel, Ask AI no `FormattingToolbar` e o editor exposto via prop. Não existem notas com notebook_id nulo (0 em prod e em dev); endurecer `useNotes.create` é seguro, mas o schema NOT NULL não. Schema novo vai via `CREATE TABLE IF NOT EXISTS` em `open_doc_db` (sem número de migration). O ID do Calendar é a constante `'calendar'`. Ajustes de escopo e decisões estão listados na seção 9 do relatório.
- Output: DOCS/reports/11-10-2026/explorerreport_20261011112948.md

### Orchestrator — decisão — 20261011114019
- Summary: O Coordenador aprovou todas as recomendações da seção 9 do explorer report.
- Inputs:
  - DOCS/reports/11-10-2026/explorerreport_20261011112948.md
- Decision:
  1. A resolução da visibilidade da pasta de chat vinculada a caderno mora no `useChat`. ChatPanel, ChatSidebar e FolderDocumentSelectorModal entram no escopo.
  2. A tabela `notebook_document_visibility` passa a aceitar ids de pasta, e os slash commands expandem as pastas com o helper compartilhado.
  3. A nota atual também é excluída do RAG nos slash commands, além do chat.
  4. Ao apagar ou mover um caderno, desfazer o vínculo caderno→pasta de chat e manter as conversas, que viram uma pasta comum.
  5. Limitação aceita: trocar de modo do app (Chat/Library) cancela o stream, como já acontece no Reader. Trocar de aba da coluna ou de nota não cancela.
  6. Endurecer `useNotes.create(notebookId: string)` só no TypeScript, sem alterar o schema.
  - Correção do Task Report acatada: o ID do Calendar é a constante `'calendar'`.
- Next step: spawn plannerAgent para dividir em etapas sequenciais

### PlannerAgent — 20261011114322
- Summary: Plano em 6 etapas sequenciais e autocontidas, mantendo a ordem do Coordenador (Parte 1 → Parte 3 → Parte 2). Cada etapa deixa o app compilando e funcional.
  - **1A — backend Rust:** comandos `notes_index_*` com ids determinísticos; `replace_chunks` atômico e revalidação antes de gravar; tabela do toggle em `open_doc_db`; pastas `origin='notes'` protegidas no scan, rescan e delete.
  - **1B — front da Parte 1:**
    - `noteFileText.ts`, um limpador que preserva quebras de linha e remove base64 e tags customizadas;
    - `useNotesIndexSync`, com fila serial, debounce de 10 s e reconciliação no boot e ao salvar a chave;
    - toggle no DocumentsModal e KB somente leitura.
  - **2A — visibilidade unificada no backend e nos slash commands:**
    - a tabela passa a aceitar ids de pasta e as linhas por arquivo são convertidas de forma idempotente;
    - `resolveSearchableIds` passa a ser usado pelos slash commands, que excluem a nota atual;
    - a propagação por irmãos é removida e o DocumentsModal grava o id da pasta.
  - **2B — visibilidade unificada no chat:**
    - vínculo `notebookId → chatFolderId` no `useChat`;
    - pasta vinculada lê e grava a tabela no send, no setter, no badge do ChatSidebar e no seletor (`initialSelectedIds`/`implicitDocumentId`);
    - `send` aceita `excludeNoteId` e a expansão inline sai.
  - **3A — escopo no `useChat`:** `ensureScopedFolder` (livro e caderno) e modo `'notes'`; o vínculo é desfeito ao apagar ou mover um caderno.
  - **3B — UI:**
    - abas AI/Chat no AiPanel, sempre montado;
    - `NotesChatPanel` com contexto efêmero;
    - "Ask AI" no FormattingToolbar e inserção na nota via `onEditorReady`.
- Output: DOCS/reports/11-10-2026/planreport_20261011114322.md

### CodeAgent — implementação inicial (Etapa 1A) — 20261011120500
- Summary: Backend Rust da indexação de notas conforme a Etapa 1A do plano.
  - Tabela `notebook_notes_index_disabled` criada em `open_doc_db` (`CREATE TABLE IF NOT EXISTS`, erro propagado).
  - Helpers: `safe_path_component` (agora também usado por `documents_ensure_ai_folder`, que mantém a mensagem "Invalid chat folder id" via `map_err`), `notes_folder_dir`, `notes_folder_doc_id`, `note_doc_id`.
  - Refatorações sem mudança externa: `embed_chunks` (usado por `run_indexing`), `insert_chunks_tx` (usado por `store_chunks`), `replace_chunks` (DELETE + INSERT numa transação do vec db) e `remove_folder_rows` (usado por `documents_delete_watched_folder`, que mantém o `remove_dir_all` só para `origin='ai'`).
  - Seis comandos novos, registrados em `lib.rs`: `notes_index_upsert`, `notes_index_delete`, `notes_index_remove_notebook`, `notes_index_set_notebook_enabled`, `notes_index_get_disabled_notebooks` e `notes_index_list_state`.
  - Proteção somente leitura: o scan de startup ignora `origin='notes'`. `documents_scan_watched_folder`, `documents_delete_watched_folder`, `documents_delete` e `documents_reindex` retornam `Err("Notes folders are managed by the app")` para `origin='notes'`.
  - `cargo check` passa sem warnings e `npm run build` passa (front não alterado).
- Desvios em relação ao plano (pequenos, sem impacto nos contratos):
  - Helpers internos extras para evitar duplicação: `reject_notes_origin(conn, id)` (guarda das 4 rotas genéricas), `delete_note_doc` (compartilhado por `upsert` e `notes_index_delete`), `remove_notes_folder` (compartilhado por `remove_notebook` e `set_enabled(false)`) e `is_notes_index_disabled`.
  - `notes_index_delete` não sanitiza `note_id`, porque não monta path a partir dele: só usa o `original_path` gravado no banco.
  - `notes_index_remove_notebook` recebe `_state` sem uso (assinatura mantida como no plano). As funções internas usam `app.state()`, no mesmo padrão de `delete_folder_child`.
  - Renomear a pasta (`UPDATE name`) não emite `documents://status`. Só a criação da pasta emite.
- Para a próxima etapa (1B):
  - Argumentos do invoke em camelCase: `notebookId`, `notebookName`, `noteId`, `title`, `fileText`, `enabled`.
  - `notes_index_upsert` retorna uma das strings `"disabled" | "removed" | "no_key" | "unchanged" | "moved" | "indexed"`. Retorna `Err` em falha de embedding, e nesse caso a linha fica com `status='error'`. Também retorna `Err` com ids inválidos, ou seja, que não sejam um único componente de path.
  - `"unchanged"` e `"moved"` exigem `status == 'available'` e conteúdo do arquivo idêntico a `fileText`. Por isso, notas em `error`/`indexing` são reindexadas na reconciliação.
  - `notes_index_list_state` retorna `{ notebookIds: string[], notes: { noteId, notebookId, status }[] }`.
  - `remove_notebook` e `set_enabled(false)` não emitem evento: o front precisa dar refresh no KB por conta própria (`monet:notes-index-changed`).
- Files changed:
  - src-tauri/src/documents.rs
  - src-tauri/src/lib.rs
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind: nenhum. O smoke manual com `npm run tauri:dev` não foi executado, porque nada ainda chama os comandos novos. O comportamento só será exercitado a partir da 1B.

### CodeAgent — implementação inicial (Etapa 1B) — 20261011115907
- Summary: Front da Parte 1 conforme a Etapa 1B do plano.
  - `src/lib/noteFileText.ts`: `COMMAND_LINE_RE`, `EMBED_BLOCK_RE` e `MARKER_RE` movidos para cá e importados por `scoreNotes.ts` (`cleanContent` inalterado). `cleanNoteContentForAi` preserva quebras de linha, troca base64 (markdown, `<img>` e `data:` soltos) por `[image]` e converte `linked-note`, `reminder-chip`, `toggle-block` e `<br>`. `buildNoteFileText` monta `# Título` + `Date: YYYY-MM-DD (Weekday)` (de `note.date` ou `parseCalendarTitle`) + `Tags:` + corpo, e retorna `''` quando título e corpo estão vazios. Testado com um script esbuild avulso (fora do repo).
  - `src/lib/documents.ts`: `notesFolderDocId`, `noteDocId`, os seis wrappers `notesIndex*`, os tipos `NotesIndexUpsertResult`/`NotesIndexState` e a constante `NOTES_INDEX_CHANGED_EVENT` (`'monet:notes-index-changed'`).
  - `src/hooks/useNotesIndexSync.ts`: fila serial (concorrência 1) com coalescência de upsert/delete pendentes por nota; o job lê a nota no momento da execução. Reconciliação depois de `notesLoaded` + `notebooksLoaded` + toggles carregados + chave; diff incremental de notas (move imediato, edição com debounce de 10 s, sumiço → delete); diff de cadernos (apagado → `removeNotebook`, renomeado → um upsert para renomear a pasta); flush ao trocar de nota.
  - `useKnowledgeBase` escuta `monet:notes-index-changed` e dá `refresh()`, disparado por `removeNotebook` e `setEnabled`.
  - `App.tsx` monta o hook fora do switch de modos e passa o toggle ao `DocumentsModal`. O modal ganhou o checkbox "Index this notebook's notes for AI", com confirmação ao desligar, e oculta a pasta de notas do próprio caderno e os filhos dela.
  - `KnowledgeBaseModal`: pastas `origin='notes'` mostram o badge "Notes" e não têm rescan nem remove.
  - `useNotes.create(notebookId: string)`: nenhum chamador precisou mudar. `Document.origin` inclui `'notes'`.
  - `npm run build` e `cargo check` passam.
- Falha de embedding (ponto de atenção da 1A): **tratada só no front, sem mudança no backend.** O job falho vira `console.warn` e a fila segue. O filho em `status='error'` não aparece em lugar nenhum da UI: a KB e os seletores só exibem o status da **pasta**, que fica sempre `available`. A nota é reenviada na próxima edição ou na reconciliação, já que `"unchanged"` exige `available`.
- Desvios em relação ao plano:
  - `onToggleNotesIndex` retorna `Promise<void>`, para o checkbox ficar desabilitado enquanto o toggle aplica.
  - O job `setEnabled` entra no **início** da fila, para responder mesmo durante a carga inicial. Os upserts já enfileirados daquele caderno recebem `"disabled"` do backend.
  - Em `'no_key'` só os upserts pendentes são descartados (deletes, remoções e toggles continuam) e os debounces são cancelados.
  - Upsert de nota cujo caderno não existe em `notebooks` vira delete.
  - `NOTES_INDEX_CHANGED_EVENT` ficou em `src/lib/documents.ts`, e não no hook, para não criar import hook→hook.
- Limitações conhecidas (não tratadas, por simplicidade):
  - Se `storage.getNotes()` falhar no boot, `useNotes` marca `loaded=true` com `notes=[]`, e a reconciliação apaga todas as cópias indexadas. As notas não são afetadas e o índice se refaz no próximo boot.
  - Se o backend responder `'no_key'` com `hasApiKey` ainda `true` (estado divergente), a reconciliação só volta a rodar quando `hasApiKey` mudar.
  - Não há flush ao sair pelo Quit da bandeja. A reconciliação no boot cobre esse caso.
  - Toda reconciliação manda um upsert por nota, e o backend lê o arquivo e responde `"unchanged"`.
- Para a próxima etapa (2A):
  - A pasta de notas do próprio caderno está **oculta** no `DocumentsModal` (filtro por `notesFolderDocId(notebookId)` e pelos filhos dela). A 2A deve trocar isso pela linha "always on".
  - As pastas de notas de **outros** cadernos aparecem no `DocumentsModal` e são marcadas por filhos, pelo mecanismo atual.
  - O hook expõe `disabledNotebookIds` (`Set`) em `App.tsx`.
  - `cleanNoteContentForAi(content, resolveNoteTitle)` está pronto para o contexto efêmero da 3B.
- Files changed:
  - src/types/index.ts
  - src/lib/documents.ts
  - src/components/RelatedContent/scoreNotes.ts
  - src/hooks/useNotes.ts
  - src/hooks/useDocuments.ts
  - src/App.tsx
  - src/components/DocumentsModal/DocumentsModal.tsx
  - src/components/DocumentsModal/DocumentsModal.module.css
  - src/components/KnowledgeBaseModal/KnowledgeBaseModal.tsx
  - src/components/KnowledgeBaseModal/KnowledgeBaseModal.module.css
- Files created:
  - src/lib/noteFileText.ts
  - src/hooks/useNotesIndexSync.ts
- Files removed:
  - nenhum
- Left behind: o smoke manual com `npm run tauri:dev` (arquivos em appData, move, toggle e integridade de `notes`) não foi executado e fica para o teste do Coordenador.

### CodeAgent — implementação inicial (Etapa 2A) — 20261011123000
- Summary: Visibilidade unificada nos slash commands e no DocumentsModal, conforme a Etapa 2A, mais a correção da 1B pedida pelo Orquestrador.
  - Rust (`documents.rs`): a propagação de visibilidade por irmãos saiu de `scan_watched_folder_async` (dead code). No fim de `open_doc_db` há um upgrade idempotente (erros ignorados) que converte as linhas por arquivo-filho em linhas da pasta-pai. Comando novo `documents_replace_notebook_visibility` (DELETE + INSERT OR IGNORE numa transação), registrado em `lib.rs`.
  - `src/lib/documents.ts`: `replaceNotebookVisibility`, constante `NOTEBOOK_VISIBILITY_CHANGED_EVENT` (`'monet:notebook-visibility-changed'`, `detail.notebookId`), disparada depois de `setNotebookDocumentVisibility` e de `replaceNotebookVisibility`. `resolveSearchableIds(rawIds, { notebookId, excludeNoteId, includeAiFolders })` implementado como no plano: ignora ids órfãos, só inclui arquivos `available` e inclui a pasta de notas do caderno se ela existir.
  - `useNotebookVisibility` recarrega quando recebe o evento com o mesmo `notebookId`.
  - `DocumentsModal`: o checkbox da pasta grava o **id da pasta** (o estado `indeterminate` e o ref foram removidos). A pasta de notas do próprio caderno aparece no topo, marcada, desabilitada e com "(always on)", quando `notesIndexEnabled` e o documento existe. As pastas de notas de outros cadernos são pastas normais.
  - `App.tsx` (slash commands): `getNotebookVisibleDocumentIds` → `resolveSearchableIds(rawIds, { notebookId, excludeNoteId: activeNote?.id ?? null, includeAiFolders: true })`, no mesmo `try`. O check de `/docs` vazio usa os ids resolvidos e a mensagem não mudou.
  - **Correção da 1B (falha na carga das notas):** `useNotes` e `useNotebooks` expõem `loadFailed` (true quando `storage.getNotes()`/`getNotebooks()` rejeita). `useNotesIndexSync` recebe `loadFailed` (App passa `notesLoadFailed || notebooksLoadFailed`) e, nesse caso, a reconciliação **não roda**. Como o diff incremental e o diff de cadernos dependem de `reconciledRef`, o sync fica inerte pelo resto da sessão: nada é apagado nem reindexado, e o próximo boot bem-sucedido reconcilia normalmente.
  - `npm run build` e `cargo check` passam, sem warnings novos no Rust.
- Desvios em relação ao plano:
  - Uma pasta **já marcada** que fica sem filhos `available` continua desmarcável (`disabled = !hasAvailableChildren && !checked`). O plano mandava desabilitar sempre, mas com visibilidade por id de pasta o usuário ficaria preso a uma marcação que não consegue desfazer.
  - O nome do evento ficou numa constante exportada (`NOTEBOOK_VISIBILITY_CHANGED_EVENT`), no mesmo padrão de `NOTES_INDEX_CHANGED_EVENT`.
  - `src/hooks/useNotebooks.ts` entrou no diff por causa da correção da 1B: uma falha na carga dos cadernos também faria a reconciliação remover todas as pastas de notas.
- Para a próxima etapa (2B):
  - Use `resolveSearchableIds` e `replaceNotebookVisibility` de `src/lib/documents.ts`. Escute `NOTEBOOK_VISIBILITY_CHANGED_EVENT`.
  - `setNotebookDocumentVisibility` já dispara o evento: o bibliotecário em pasta vinculada não precisa disparar outro.
  - `replaceNotebookVisibility` grava exatamente os ids recebidos. Quem chama precisa filtrar `notesFolderDocId(nb)`, como já prevê o plano.
  - O helper chama `documentsListGlobal()` a cada uso, igual à expansão inline atual do `useChat`.
- Files changed:
  - src-tauri/src/documents.rs
  - src-tauri/src/lib.rs
  - src/lib/documents.ts
  - src/hooks/useDocuments.ts
  - src/hooks/useNotes.ts
  - src/hooks/useNotebooks.ts
  - src/hooks/useNotesIndexSync.ts
  - src/components/DocumentsModal/DocumentsModal.tsx
  - src/components/DocumentsModal/DocumentsModal.module.css
  - src/App.tsx
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind: o smoke manual com `npm run tauri:dev` não foi executado. Fica para o Coordenador conferir a conversão das linhas antigas no `monet.db` de dev, o `/docs` usando as notas do caderno sem a nota atual e a linha "(always on)".

### CodeAgent — implementação inicial (Etapa 2B) — 20261011130000
- Summary: Visibilidade unificada no chat, conforme a Etapa 2B.
  - `useChat.ts`, vínculo caderno → pasta de chat (`monet:notes-notebook-folder-link`, mesmo padrão do Reader): `getNotebookChatFolderId`, `getNotebookIdForChatFolder` (busca reversa, relê o localStorage a cada chamada), `linkNotebookToChatFolder` (exportado, ainda sem uso; será usado na 3A) e `unlinkNotebookFromChatFolder`.
  - `useChat`, estado `linkedVisibility` (chatFolderId → ids da tabela):
    - **Carga:** carrega quando o conjunto de pares vinculados presentes em `folders` muda. A chave é comparada por JSON para não chamar o SQLite a cada update de `folders`.
    - **Recarga:** em `NOTEBOOK_VISIBILITY_CHANGED_EVENT` (só o caderno afetado), em `focus` e em `storage` da chave do vínculo. O `focus` e o `storage` cobrem o sync entre janelas, inclusive a assistant oculta, já que o evento só dispara na janela que gravou.
    - **Corrida:** a carga completa usa uma sequência e a mais recente vence. A carga parcial mescla.
  - `UseChatResult`:
    - novos `getFolderVisibleDocumentIds` e `getFolderNotebookId`;
    - em pasta vinculada, `setFolderVisibleDocuments` grava `replaceNotebookVisibility(nb, ids sem notesFolderDocId(nb))` com update otimista (em falha, recarrega a tabela). Não toca em `visibleDocumentIds`;
    - o bibliotecário, em pasta vinculada, chama `setNotebookDocumentVisibility(nb, aiFolderId, true)`.
  - `send`: aceita `opts.excludeNoteId`. O bloco RAG lê a tabela do caderno quando a pasta é vinculada (senão usa `visibleDocumentIds`) e resolve com `resolveSearchableIds({ notebookId, excludeNoteId, includeAiFolders: webResearchEnabled })`. A expansão inline e o `import()` dinâmico saíram. A busca e a formatação não mudaram.
  - `FolderDocumentSelectorModal`:
    - props `initialSelectedIds`, agora a única origem da seleção, e `implicitDocumentId`;
    - o item implícito aparece no topo, marcado, desabilitado e com "(always on)", e é filtrado do `onConfirm`;
    - a seleção é ressincronizada quando o conteúdo de `initialSelectedIds` muda (chave por `join`), cobrindo a carga assíncrona da tabela.
  - `ChatPanel`, `AssistantPanel` e `ReaderChatPanel` passam `initialSelectedIds` e `implicitDocumentId`. `ChatSidebar` ganhou `getFolderVisibleDocumentCount`, repassado ao `SortableFolder` como `visibleDocumentCount` para o badge e o `title`.
  - `npm run build` e `cargo check` passam.
- Desvios em relação ao plano:
  - `documents.ts` passou a ter import estático no `useChat`, no lugar do `import()` dinâmico do bloco RAG. O módulo já era importado estaticamente pelo `App`, então o bundle não muda.
  - Há uma recarga extra em `storage` da chave do vínculo, além do `focus`.
  - Em arquivo avulso, o helper exige `status === 'available'`. A expansão inline antiga aceitava qualquer status, mas o backend só tem chunks de arquivos indexados, então a diferença é irrelevante.
- Para a próxima etapa (3A):
  - Ao criar a pasta em `ensureScopedFolder({ kind: 'notebook' })`, chame `linkNotebookToChatFolder(nb, folder.id)`. O efeito da carga detecta o par novo quando a pasta entra em `folders`.
  - Depois de `unlinkNotebookFromChatFolder`, a pasta volta a usar `visibleDocumentIds` imediatamente (a busca reversa é feita ao vivo). A entrada órfã em `linkedVisibility` fica sem uso até a próxima carga completa, e isso é inofensivo.
  - O `send` sempre relê a tabela, então o RAG nunca fica defasado, mesmo em outra janela.
- Files changed:
  - src/hooks/useChat.ts
  - src/components/ChatPanel/FolderDocumentSelectorModal.tsx
  - src/components/ChatPanel/FolderDocumentSelectorModal.module.css
  - src/components/ChatPanel/ChatPanel.tsx
  - src/components/ChatPanel/ChatSidebar.tsx
  - src/components/AssistantPanel/AssistantPanel.tsx
  - src/components/Reader/ReaderChatPanel.tsx
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - O smoke manual do caminho vinculado (gravar o vínculo no devtools) não foi executado.
  - A prop `indeterminate` de `FolderItem` no seletor é sempre `false`. É dead code preexistente, fora do escopo da 2B, e ficou para a review.

### CodeAgent — implementação inicial (Etapa 3A) — 20261011133000
- Summary: Escopo generalizado no `useChat`, modo `'notes'` e ciclo de vida do vínculo, conforme a Etapa 3A.
  - `useChat.ts`:
    - `options.mode` aceita `'notes'`; `isScopedMode = mode === 'reader' || mode === 'notes'`; `isDetached` continua `mode !== 'main'`.
    - `readerFolderIdRef` → `scopedFolderIdRef`; `pendingBookFolderIds` → `pendingScopedFolderIds` (chave `${kind}:${id}`). O efeito de limpeza do ref e o fallback de materialização no `send` testam `isScopedMode`.
    - `ensureReaderBookFolder` substituído por `ensureScopedFolder(scope: ChatFolderScope): string` (tipo exportado `ChatFolderScope = { kind: 'book' | 'notebook'; id: string; title: string }`), com os mesmos guards. `book`: vínculo do Reader, nome `Library - <title>`, prompt do leitor em `replace` (idêntico ao anterior). `notebook`: vínculo `getNotebookChatFolderId`/`linkNotebookToChatFolder`, nome `Notebook - <title>` (truncado em 90, fallback `Untitled notebook`), `systemPrompt=''`.
    - Comentários de `dedupeAssistantFolders`, do prompt do leitor e do rascunho atualizados para "pastas por escopo (livro/caderno)".
  - `ReaderChatPanel.tsx`: as chamadas viraram `ensureScopedFolder({ kind: 'book', id: book.id, title: book.title })`. Nenhuma outra mudança.
  - `App.tsx`: `handleDeleteNotebook` e `handleMoveNotebook` chamam `unlinkNotebookFromChatFolder(id/sourceId)` depois de `removeNotebook`. As conversas não são apagadas (sem `deleteChatFolderById`).
  - `npm run build` e `cargo check` passam.
- Desvios em relação ao plano:
  - O Reader tinha **cinco** chamadas a `ensureReaderBookFolder` (o plano citava quatro); todas foram trocadas.
  - Nos guards de criação pendente (`pendingId` e `pendingFallback`), o ensure agora também **reaponta `scopedFolderIdRef`** para o id pendente antes de retornar. Antes ele só retornava o id. Isso é necessário para o rebind por troca de caderno (A → B → A com a criação de A ainda não commitada deixaria o ref apontando para B). No Reader, o comportamento observável não muda: o ref já era desse mesmo livro.
  - O ramo `pendingId === linkedId` foi fundido com `if (pendingId)`, porque os dois agora fazem a mesma coisa.
- Contrato para a 3B:
  - `useChat(models, { mode: 'notes' })`: instância detached (não lê nem grava `ACTIVE_ID_KEY`; `activeId` começa `null`).
  - `ensureScopedFolder({ kind: 'notebook', id: notebook.id, title: notebook.name }): string`: idempotente, síncrono, retorna o `folderId`. Chame a cada troca de caderno e antes de cada `send`. Ele só reaponta o ref interno e não cancela stream nem troca a conversa ativa. Na primeira vez, cria a pasta (o `setFolders` é assíncrono, então ela pode ainda não estar em `folders` no mesmo render) e grava o vínculo em `monet:notes-notebook-folder-link`.
  - `startAssistantConversation(folderId)`: rascunho com `folderId` fixo, materializado no primeiro `send` com `ChatConversation.folderId` atômico. Se a pasta sumir antes do envio, o `send` cai no `folderId` do último `ensureScopedFolder`.
  - `selectConversation(id)` retoma uma conversa da pasta (`folders.find(f => f.id === folderId)?.conversationIds`).
  - `send(text, undefined, undefined, { ephemeralContext, excludeNoteId })`.
  - Seletor de documentos: `getFolderVisibleDocumentIds(folderId)`, `getFolderNotebookId(folderId)` e `setFolderVisibleDocuments(folderId, ids)` (da 2B; em pasta vinculada gravam na tabela do caderno).
  - Apagar ou mover o caderno remove a entrada do vínculo. Depois disso, `ensureScopedFolder` para o mesmo id criaria uma pasta nova, então a 3B só deve chamá-lo para cadernos existentes. Com o caderno apagado, o painel vai para o estado vazio (`notebook === null`).
- Files changed:
  - src/hooks/useChat.ts
  - src/components/Reader/ReaderChatPanel.tsx
  - src/App.tsx
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind: o smoke manual (Reader sem pastas duplicadas em StrictMode, "Ask AI" do Reader, remoção do vínculo ao apagar ou mover um caderno) não foi executado. O caminho `'notes'` só é exercitado a partir da 3B.

### CodeAgent — implementação inicial (Etapa 3B) — 20261011140000
- Summary: UI do chat nas Anotações, conforme a Etapa 3B.
  - `src/components/NotesChat/notesContext.ts`: `buildNotesContext({ notebookName, note, selectionText, resolveNoteTitle })`, espelho de `readerContext.ts`. Orçamentos de 8000 (nota) e 2000 (seleção), conteúdo limpo por `cleanNoteContentForAi` e `Date:` pela mesma regra da 1B (`noteDate`, agora exportado de `noteFileText.ts`).
  - `src/components/NotesChat/NotesChatPanel.tsx` + `.module.css`: no padrão do `ReaderChatPanel` (`useChat(models, { mode: 'notes' })`, modais de pasta, tools, `ModelSelector`, seletor de conversas, Stop). Bind por caderno via `boundNotebookIdRef`, sem `key` e sem remontar. Os efeitos de recuperação são os do Reader. O envio monta o contexto efêmero e passa `excludeNoteId`. O seletor de documentos usa `getFolderVisibleDocumentIds` e `implicitDocumentId = notesFolderDocId(notebook.id)`. "Ask AI" pré-preenche o composer sem enviar. Respostas da IA têm "Insert at cursor" e "Append to note", desabilitados sem nota/editor, em preview ou na mensagem em streaming. Sem caderno: estado vazio "Open a notebook to chat about its notes.".
  - `AiPanel`: o `return null` saiu e o `<aside>` fica sempre renderizado (`panelHidden` quando fechado). O header virou abas "AI | Chat" (`aria-pressed`). `ModelSelector`, banner da chave e cards só na aba AI. O contêiner do chat é sempre renderizado (`chatTab`/`chatTabHidden`). A classe `.title` ("IA") saiu como dead code.
  - `FormattingToolbar`: botão "Ask AI" (prop `onAskAi`) quando há seleção. `Editor`: props `onAskAi` e `onEditorReady` (instância ou `null` no cleanup).
  - `App.tsx`: `rightTab` persistido em `monet:notes-right-tab` (try/catch), `pendingNotesQuote`, `notesEditorRef`/`hasEditor`, `handleAskAi`, `getNotesSelectionText`, `handleInsertIntoNote` e `canInsertIntoNote = !!activeNote && hasEditor && !previewMode`.
  - `npm run build` e `cargo check` passam.
- Validações pedidas:
  - **`tiptap-markdown` 0.9 no `insertContentAt`:** converte. A extensão sobrescreve `setContent` e `insertContentAt` (`addCommands`) e passa o conteúdo por `parser.parse(content, { inline: true })` (markdown-it → HTML). É o mesmo mecanismo do `setContent` que o app já usa para carregar as notas em markdown. O fallback via `renderMarkdown` não foi necessário.
  - **Prefixo invisível contra slash command:** basta. O `CommandExtension` só considera parágrafos de nível 1 e testa `isPotentialCommandLine(textContent.trim())` (`/^\s*\//`). U+200B (categoria Cf) não é removido por `trim()` nem casa `\s`, e o markdown-it o preserva no parágrafo (testado com node: `'​/x'.trim()` mantém o caractere e `isPotentialCommandLine` retorna false; `markdown-it` renderiza `<p>​/summary…</p>`). A sanitização prefixa U+200B nas linhas em que `isPotentialCommandLine(line)` é verdadeiro, **fora de blocos de código cercados** (``` / ~~~), para não corromper código.
- Desvios em relação ao plano:
  - **Caderno do chat:** `notebooks.find(id === (activeNote?.notebookId ?? activeNotebookId))`, e não só o caderno ativo. Em "All Notes" (`activeNotebookId === null`) com nota aberta, o chat usa o caderno da nota. Sem nota, usa o caderno ativo. Como vem de `notebooks`, o `ensureScopedFolder` nunca é chamado para caderno apagado. O Calendar está em `notebooks` (id `'calendar'`) e tem chat normalmente.
  - **Bind só com a aba visível:** o bind (e, portanto, a criação da pasta "Notebook - …") só acontece com `visible` (coluna aberta e aba Chat). Sem isso, como o painel fica sempre montado, só navegar pelos cadernos criaria uma pasta vazia por caderno no ChatPanel principal. A recuperação por `activeId === null` também só age no caderno já vinculado. A pasta é criada ao abrir a aba Chat num caderno (não só no primeiro envio), igual ao Reader, que cria ao abrir o livro.
  - `notesContext` recebe `note: Note | null` (e não um objeto reduzido), para reaproveitar `noteDate` da 1B, que agora é exportado.
  - O painel não tem botão de fechar: a coluna fecha pelo toggle de IA da Toolbar, como antes. O header interno mostra o nome do caderno e as ações.
- Limitações conhecidas:
  - Com um stream ativo e troca de caderno, a conversa exibida passa a ser a do novo caderno, mas `isStreaming` é por instância. Os pontos de streaming e o desabilitar de "Insert" podem aparecer na última resposta da conversa exibida até o stream terminar (cosmético). O stream conclui na conversa original.
  - O rascunho digitado no composer não é por caderno: permanece ao trocar de caderno.
  - O prefixo U+200B fica gravado (invisível) na nota inserida.
- Files changed:
  - src/App.tsx
  - src/components/AiPanel/AiPanel.tsx
  - src/components/AiPanel/AiPanel.module.css
  - src/components/Editor/Editor.tsx
  - src/components/Editor/FormattingToolbar.tsx
  - src/components/Editor/FormattingToolbar.module.css
  - src/lib/noteFileText.ts
- Files created:
  - src/components/NotesChat/NotesChatPanel.tsx
  - src/components/NotesChat/NotesChatPanel.module.css
  - src/components/NotesChat/notesContext.ts
- Files removed:
  - nenhum
- Left behind: o smoke manual com `npm run tauri:dev` não foi executado (abas, stream preservado ao trocar aba/nota/caderno, Ask AI, inserir na nota, apagar o caderno aberto, Reader sem regressão). Fica para o Coordenador.

### CodeReviewAgent — 20261011122335
- Summary: Nenhum bug crítico. Os pontos de atenção do Orquestrador foram verificados e estão OK: perda de dados, reconciliação no boot com falha de carga, concorrência e chunks, movimentos com toggles diferentes, arquitetura do chat e Reader, migrations, paths e Calendar. Três ressalvas [importante]:
  - (I1) o `FolderDocumentSelectorModal` não deixa desmarcar uma pasta marcada sem arquivos disponíveis, enquanto o `DocumentsModal` deixa. Os dois gravam a mesma tabela;
  - (I2) dead code: `TauriStorage.updateDocumentStatus` (com a interface e o stub do browser) e a prop `indeterminate` do `FolderItem`;
  - (I3) `fileTextFor` roda sobre a nota inteira a cada tecla no diff do `useNotesIndexSync`, o que pesa em notas com base64.
  - Mais 5 nits e 1 bug extra (linhas órfãs na visibilidade e no toggle ao apagar um caderno).
- Verdict: APROVADO COM RESSALVAS
- Output: DOCS/reports/11-10-2026/reviewreport_20261011122335.md

### CodeAgent — ajuste final — 2026-10-11
- Summary: Passada final após a review.
  - I1: o seletor de documentos do chat (`FolderDocumentSelectorModal`) agora segue a mesma regra do `DocumentsModal`. Uma pasta já marcada sem arquivos disponíveis pode ser desmarcada (`disabled = children.length === 0 && !checked`), e `toggleKbFolder` só retorna cedo quando a pasta ainda não está marcada.
  - I2: removi o dead code. Saíram `updateDocumentStatus` (assinatura em `storage/index.ts`, stub em `browser.ts` e implementação em `tauri.ts`) e os imports `DocumentStatus` que ficaram sem uso. Também saiu a prop `indeterminate` de `FolderItem`, com o `ref`, o `useEffect` e o import `useRef`.
  - I3: a comparação `fileText === lastSynced` saiu do diff por tecla e foi para o callback do debounce, onde roda uma vez por debounce. O move entre cadernos continua imediato.
  - Órfãos ao apagar caderno: `useNotebooks.remove`, depois de `storage.deleteNotebook`, chama `replaceNotebookVisibility(id, [])` e `notesIndexSetNotebookEnabled(id, true)` em modo best-effort (só registra um aviso se falhar). Assim as tabelas continuam geridas só pelo backend. A limpeza também vale para o caderno de origem no "mover caderno".
  - N1: `handleCommand` passa para a aba AI (`setRightTab('ai')`) quando o comando é aceito, antes de criar o card ou o card de erro.
  - N2: removi o cálculo de `getFolderNotebookId`/`implicitDocumentId` no `ReaderChatPanel` e no `AssistantPanel`, que sempre dava `null`.
  - N3: comentário em `open_doc_db` explicitando a invariante da conversão legada, que roda a cada abertura.
  - `npm run build` e `cargo check` passam.
- Files changed:
  - src/components/ChatPanel/FolderDocumentSelectorModal.tsx
  - src/storage/index.ts
  - src/storage/browser.ts
  - src/storage/tauri.ts
  - src/hooks/useNotesIndexSync.ts
  - src/hooks/useNotebooks.ts
  - src/App.tsx
  - src/components/Reader/ReaderChatPanel.tsx
  - src/components/AssistantPanel/AssistantPanel.tsx
  - src-tauri/src/documents.rs
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - N1 (segunda parte): o estado local dos cards (expandido ou recolhido) ainda se perde ao trocar de aba, porque a aba AI continua sendo desmontada. Escondê-la via CSS mudaria o ciclo de vida dos cards, o que foge de um ajuste final.
  - N4: a ordem das verificações em `notes_index_upsert` (keyring antes de "unchanged") não mudou. É só custo no boot e não altera o resultado. Com o I3, as edições não geram mais upserts redundantes.
  - N5: a KB aberta pode mostrar o nome ou a contagem da pasta "Notes — <Caderno>" desatualizados. É cosmético e se corrige no próximo refresh.

### Orchestrator — encerramento — 20261011122750
- Summary: As 6 etapas (1A, 1B, 2A, 2B, 3A, 3B), a review e a passada final estão concluídas, sem commit. `npm run build` e `cargo check` passam. Nenhum smoke manual foi feito pelos agentes.
- Inputs:
  - DOCS/reports/11-10-2026/reviewreport_20261011122335.md
- Decision: Os achados importantes da review (I1, I2, I3), os órfãos ao apagar caderno, N1 parcial, N2 e N3 foram corrigidos. Ficam pendentes: o estado expandido dos cards se perde ao trocar de aba; N4, que é só custo no boot; N5, a KB com o nome e a contagem da pasta de notas desatualizados até o próximo refresh.
- Next step: aguardando teste do Coordenador
