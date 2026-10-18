# Execution Report

## Documents
- Task report: `DOCS/reports/17-10-2026/taskreport_20261017235032.md`
- Execution report: `DOCS/reports/18-10-2026/executionreport_20261018000019.md`
- Explorer report: não gerado
- Plan report: `DOCS/reports/18-10-2026/planreport_20261018001246.md`
- Review report: R1 `DOCS/reports/18-10-2026/reviewreport_20261018135656_r1-backend.md` · R2 `DOCS/reports/18-10-2026/reviewreport_20261018135827_r2-chat.md` · R3 `DOCS/reports/18-10-2026/reviewreport_20261018135755_r3-tasks-app.md` · print `DOCS/reports/18-10-2026/reviewreport_20261018144547_screenshot.md`
- Test script: `DOCS/reports/18-10-2026/testscript_20261018065500.md`

## Sessions
### Orchestrator — abertura — 20261018000019
- Summary: Task Report aprovado pelo Coordenador (seção "Decisões do Coordenador (2026-10-17)": só OCR local, golden set aprovado, escopo único dividido em etapas pelo planner). Execução iniciada.
- Inputs:
  - `DOCS/reports/17-10-2026/taskreport_20261017235032.md`
  - `DOCS/features/central_informacao_study.md`
  - `DOCS/features/decisoes_study.md`
- Decision: Sem `explorerAgent` — o Task Report já traz o contexto verificado (paths, linhas e fatos do banco de produção). `plannerAgent` direto, para dividir as 18 entregas em etapas independentes e testáveis. Depois, um `codeAgent` por etapa, com os reports como memória entre etapas, e teste do Coordenador nos pontos que o plano indicar.
- Next step: `plannerAgent`

### PlannerAgent — 20261018001246
- Summary: Os 18 requisitos foram divididos em 17 etapas sequenciais (um `codeAgent` por etapa), com 5 checkpoints do Coordenador (CP-A a CP-E).
  - Arquitetura: a recuperação passa para `src-tauri/src/rag.rs`. O golden set vira um cargo example (`rag_eval`) que roda o mesmo código do app sobre o perfil DEV, somente leitura, com os arquivos em `%APPDATA%\com.monet.app.dev\rag-eval\`, fora do repositório.
  - Os metadados ficam no `monet-vec.db`, sem `ALTER` na tabela `documents`.
  - Uma única reindexação (E8), depois da higiene (E5), dos cabeçalhos (E6), do OCR (E7) e dos apelidos (E2). O FTS5 (E9) é preenchido localmente depois.
  - A extração dos componentes compartilhados do Chat (E4) vem antes das features do Assistant (E14–E16). O `designer` entra na E17.
  - As E2–E4 podem rodar enquanto o Coordenador marca os gabaritos do CP-A.
  - Ficaram 4 decisões para o Coordenador (D1 clone prod→dev, D2 livro × documento, D3 toggle das tools de notas por data, D4 persistência de fontes e trace) e uma lista de decisões tomadas sem perguntar.
- Output: `DOCS/reports/18-10-2026/planreport_20261018001246.md`

### Orchestrator — decisão — 20261018003000
- Summary: Plano recebido (17 etapas, checkpoints CP-A a CP-E). Coordenador decidiu D1–D4 com as opções recomendadas.
- Inputs:
  - `DOCS/reports/18-10-2026/planreport_20261018001246.md`
- Decision:
  - D1 = A: clone completo prod→dev, com reescrita de caminhos e backup do dev.
  - D2 = A: tudo como `document`, com página nos PDFs.
  - D3 = A: toggle novo "Daily notes", desligado por padrão.
  - D4 = A: fontes compactas gravadas na mensagem; trace do inspetor só em memória.
  - Branch de trabalho: `feature/rag-assistant` (criada a partir de `develop`).
  - As 10 decisões que o planner tomou sozinho seguem como estão, salvo objeção do Coordenador.
- Next step: `codeAgent` — Etapa E1.

### CodeAgent — implementação inicial (Etapa E1) — 20261018003821
- Summary: Módulo `rag.rs` criado (KNN movido de `documents_search_by_ids`, `ChunkResult` público, `resolve_scope` em Rust, `embed_query`, `open_vec_db_readonly`, `retrieve_baseline`). Comentário desatualizado do filtro do sqlite-vec trocado (o filtro é pré-aplicado; a sobre-amostragem serve só ao filtro de vizinhos). Novo comando `documents_resolve_searchable_ids`; `resolveSearchableIds` (TS) virou wrapper `invoke` e o código de expansão antigo e `noteDocId` (sem uso) saíram. `embed_text` passou a usar `rag::embed_query`. Examples `rag_eval` (`init`, `candidates`, `run --pipeline baseline`) e `clone_prod_to_dev` (`--confirm`) criados.
  - Verificado: `cargo check` e `cargo build --examples` sem warnings; `npx tsc --noEmit` ok; `rag_eval init` cria o modelo no dev e a 2ª execução não sobrescreve; `run` com o modelo sai com 0; `run` e `candidates` testados com escopo real do dev (depois restaurei o modelo e apaguei os artefatos de teste). A SQL de reescrita e as duas verificações do clone foram validadas numa cópia do `monet.db` de produção no scratchpad (267 caminhos em `documents`, 5 em `books`, 0 restantes; varredura de todas as colunas = 0).
  - Não executado (por instrução): `clone_prod_to_dev -- --confirm` e o app. Um teste do clone num APPDATA falso foi bloqueado pelo classificador de permissões (exigia desligar a checagem de `monet.exe`), então o fluxo de cópia/rollback do clone não foi exercitado de ponta a ponta.
- Files changed:
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/vec_db.rs`
  - `src/lib/documents.ts`
- Files created:
  - `src-tauri/src/rag.rs`
  - `src-tauri/examples/rag_eval.rs`
  - `src-tauri/examples/clone_prod_to_dev.rs`
- Files removed:
  - nenhum
- Left behind:
  - Teste manual no app dev de que o Chat e o `/docs` seguem respondendo com RAG (o app não foi aberto).
  - Timestamps dos examples (`results\<ts>-<label>.json` e `com.monet.app.dev.bak-<ts>`) em UTC, sem crate de datas.
  - Pequenos acréscimos ao plano: o clone também recoloca `rag-eval\` do backup do dev (para não perder o golden set marcado num re-clone) e faz uma 2ª verificação genérica (nenhuma coluna de nenhuma tabela do `monet.db` começa com o caminho de produção); o `candidates` embute histórico + pergunta (para achar gabaritos de follow-up), enquanto o `run` baseline embute só a pergunta, como o chat.

### CodeAgent — implementação inicial (Etapa E2) — 20261018004441
- Summary: Apelidos de pastas indexadas (R15).
  - Schema: `CREATE TABLE IF NOT EXISTS folder_aliases (folder_id TEXT PRIMARY KEY, alias TEXT NOT NULL)` em `open_doc_db` (monet.db), sem migration e sem transação manual.
  - `documents_list_global` faz `LEFT JOIN folder_aliases` e devolve `alias`. `Document.alias?: string` no TS, mapeado em `documentsListGlobal`.
  - Comando novo `documents_set_folder_alias(folder_id, alias)`: vazio/`None` apaga, senão `INSERT OR REPLACE` (com `trim`); recusa `origin='notes'`. Wrapper `documentsSetFolderAlias`. `remove_folder_rows` também apaga o apelido da pasta removida.
  - `KnowledgeBaseModal`: a pasta mostra `alias ?? name`; lápis (aparece no hover da linha) abre input inline (Enter salva, Esc ou blur cancela, vazio remove); tooltip da célula segue com o caminho completo; campo "Filter by name, alias or path…" acima da tabela, com "No matches."; refresh do `useKnowledgeBase` após salvar.
  - `FolderDocumentSelectorModal`: pastas mostram `alias ?? name` (tooltip com o caminho) e o mesmo campo de filtro, aplicado a pastas, arquivos soltos e à pasta de notas implícita.
  - Filtro compartilhado `documentMatchesFilter` em `src/lib/documents.ts` (nome, apelido ou caminho; sem caixa e sem acentos, reusando `normalizeName` de `src/lib/tasks.ts`).
  - Texto e metadados dos chunks não mudaram (o cabeçalho com apelido e a marcação de "desatualizado" ficam na E6).
  - Verificado: `cargo check` sem warnings, `npx tsc --noEmit` ok, SQL do listing validada em SQLite em memória. App não executado (por instrução).
- Files changed:
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/lib.rs`
  - `src/lib/documents.ts`
  - `src/types/index.ts`
  - `src/components/KnowledgeBaseModal/KnowledgeBaseModal.tsx`
  - `src/components/KnowledgeBaseModal/KnowledgeBaseModal.module.css`
  - `src/components/ChatPanel/FolderDocumentSelectorModal.tsx`
  - `src/components/ChatPanel/FolderDocumentSelectorModal.module.css`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - Teste no app dev (persistência após reiniciar, remoção, tooltip e filtro nos dois modais).
  - O placeholder do filtro do KB é "Filter by name, alias or path…" (o plano dizia "Filter folders…"), porque ele também filtra os arquivos soltos da tabela.
  - O `DocumentsModal` (visibilidade por caderno) ainda mostra `folder.name`; o plano não o incluía na E2.
  - O comando não confere se o id é de uma pasta (`type='folder'`): só recusa as de notas. Um id inexistente grava uma linha inofensiva.

### Orchestrator — decisão — 20261018004500
- Summary: E1 concluída. Clone prod→dev executado com o Monet fechado (`cargo run --example clone_prod_to_dev -- --confirm`). Resultado:
  - dev agora com 485 documentos (19 pastas), 4.786 chunks, 153 notas e 5 livros;
  - 267 + 5 caminhos reescritos, nenhum caminho de produção restante;
  - backup do dev anterior em `%APPDATA%\com.monet.app.dev.bak-20261018034207`.
- Decision:
  - E2 (apelidos) rodando em paralelo: não toca o índice.
  - Agente de dados preparando o `goldenset.json` (30–50 perguntas, `confirmed: false`) e o `REVIEW.md` em `%APPDATA%\com.monet.app.dev\rag-eval\`, fora do repositório.
  - Base atual tem 4.786 chunks, contra 3.530 citados no Task Report.
- Next step: Coordenador revisa o golden set (CP-A) → baseline.

### CodeAgent — implementação inicial (Etapa E3) — 20261018004912
- Summary: Conjuntos de documentos / presets de RAG (R13).
  - Schema: `CREATE TABLE IF NOT EXISTS document_sets (id, name, document_ids JSON, created_at, updated_at)` em `open_doc_db` (monet.db), sem migration e sem transação manual.
  - Comandos novos em `documents.rs`, registrados no handler: `document_sets_list` (ordem por nome, sem caixa), `document_sets_save(id?, name, document_ids) -> id` (cria ou regrava; nome com `trim`, vazio recusado), `document_sets_rename` e `document_sets_delete`. Wrappers TS e tipo `DocumentSet` em `src/lib/documents.ts`.
  - `FolderDocumentSelectorModal` ganhou a faixa "Sets", acima do filtro:
    - um chip por conjunto. Clicar aplica: os ids que ainda existem viram a seleção e `onConfirm` é chamado na hora (persiste pela via de sempre, inclusive `setFolderVisibleDocuments` para pasta vinculada a caderno). O modal fica aberto. O tooltip lista os itens pelo apelido (`alias ?? name`) e a contagem de faltantes;
    - "Save selection as…": input inline (Enter salva, Esc ou blur cancela), desabilitado com seleção vazia. O id implícito (pasta de notas do caderno) nunca entra no conjunto;
    - menu `⋯` do chip com Rename (input inline) e Delete (`useConfirm`);
    - aviso "N item(s) in this set no longer exist" com "Update set" (regrava só os existentes) depois de aplicar um conjunto com itens apagados.
  - A lista é recarregada a cada abertura do modal, então um conjunto criado na janela main aparece no Assistant.
  - Extra aprovado: o `DocumentsModal` (visibilidade por caderno) mostra o apelido da pasta (`alias ?? name`); o tooltip com o caminho já existia.
  - Verificado: `cargo check` sem warnings e `npx tsc --noEmit` ok. App não executado (por instrução).
- Files changed:
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/lib.rs`
  - `src/lib/documents.ts`
  - `src/components/ChatPanel/FolderDocumentSelectorModal.tsx`
  - `src/components/ChatPanel/FolderDocumentSelectorModal.module.css`
  - `src/components/DocumentsModal/DocumentsModal.tsx`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - Teste no app dev: salvar, aplicar, renomear, excluir; conjunto criado na main visível no Assistant; aviso com item apagado (entra no CP-D).
  - O aviso de itens apagados aparece só depois de aplicar o conjunto, não no chip. Os ids apagados não são limpos sozinhos: só pelo "Update set".
  - Esc com o `ConfirmModal` de Delete aberto também fecha o seletor (mesmo comportamento dos outros modais que usam `useConfirm`).

### CodeAgent — implementação inicial (Etapa E4) — 20261018005435
- Summary: Extração de componentes compartilhados do Chat, sem mudar o comportamento (pré-requisito de R17/R18).
  - `useStickToBottom({ messages, isStreaming, activeId })` → `{ historyRef, atBottom, onScroll, scrollToBottom }`: rolagem suave ao enviar na mesma conversa, "segue o streaming só se já estiver no fim" (48px) e `atBottom` (32px), código movido sem alteração.
  - `ChatMessageBubble`: o antigo `ChatBubble`, movido sem alteração, com `onSaveToNote` opcional (ausente esconde "Save to note") e `footer?: ReactNode` renderizado depois das ações (slot da E12; ninguém passa ainda).
  - `ChatComposer`: o `<footer>` inteiro, com o estado do rascunho, `handlePickFile`/`resolveFileType`, colar imagem, Enter para enviar, indicadores (deep research, web search, memória, fontes salvas), avisos e os botões Deep Research, Thinking, Anexar, `ChatToolsMenu` e Stop/Send. Props do plano; `activeFolder` vem com `setFolderMemoryEnabled`/`setFolderWebResearchEnabled`. O rascunho é limpo quando `resetKey` (o `activeId`) muda, como antes.
  - `ChatPanel` passou a usar os três. Os toasts, o foco inicial (via `inputRef`), o `streamingMessageId`, o `SaveToNoteModal` e o botão "voltar ao fim" (`scrollBtn`) ficaram no `ChatPanel`.
  - CSS: as regras foram movidas sem alteração para `ChatMessageBubble.module.css` e `ChatComposer.module.css` e removidas de `ChatPanel.module.css`, que só perdeu linhas. Conferido por script: toda classe de cada `.module.css` é usada no `.tsx` correspondente e vice-versa.
  - O `@keyframes chatPulse` existe nos dois módulos novos: CSS Modules escopa keyframes por arquivo, e ele é usado pelos pontinhos de streaming (bubble) e pelos indicadores (composer).
  - Única diferença de lógica: `canSend` usa `!!selectedModel` no lugar de `!!model && models.length > 0`. Só difere enquanto o id do modelo não está na lista, estado que o efeito de modelo padrão do `ChatPanel` corrige no render seguinte.
  - `AssistantPanel`, `NotesChatPanel` e `ReaderChatPanel` não mudaram.
  - Verificado: `npx tsc --noEmit` ok; diff do código movido contra o `HEAD` (só renome, props novas, `rows`, `onStop` e `onSend`). App não executado (por instrução).
- Files changed:
  - `src/components/ChatPanel/ChatPanel.tsx`
  - `src/components/ChatPanel/ChatPanel.module.css`
- Files created:
  - `src/components/ChatPanel/ChatMessageBubble.tsx`
  - `src/components/ChatPanel/ChatMessageBubble.module.css`
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/ChatPanel/ChatComposer.module.css`
  - `src/hooks/useStickToBottom.ts`
- Files removed:
  - nenhum
- Left behind:
  - Teste leve do Coordenador no app dev (item 5 do CP-A): enviar, anexar PDF/MD, colar imagem, Thinking, Deep Research, Stop, salvar em nota, copiar, rolagem durante o streaming e botão de voltar ao fim.
  - As regras movidas mantêm os valores fora da escala de espaçamento (10px, 14px etc.): trocar por tokens mudaria o visual, e isso é da E17 (`designer`).
  - `NotesChatBubble` e `ReaderChatBubble` continuam com bubbles próprias. O plano não os migra (a E12 pluga as fontes neles diretamente).

### Orchestrator — decisão — 20261018013000
- Summary:
  - E2, E3 e E4 concluídas (ver sessões dos codeAgents).
  - Golden set preparado: 47 perguntas, todas com `confirmed: false`.
    - Por classe: document 11, follow-up 9, exact-term 8, temporal 8, image 6, sweep 5.
    - Origem: 20 do histórico real de chat e 27 derivadas do conteúdo.
    - Confiança: 5 baixas, 19 médias e 23 altas.
  - O KNN atual reproduz a falha "Especificação": em q01 e q02, a nota fica fora do top 15.
- Inputs:
  - `%APPDATA%\com.monet.app.dev\rag-eval\goldenset.json`
  - `%APPDATA%\com.monet.app.dev\rag-eval\REVIEW.md`
- Decision:
  - Aguardar o Coordenador revisar e confirmar os gabaritos (CP-A).
  - Sinalizado ao Coordenador: uma nota com credenciais em texto puro está indexada no RAG (fora do escopo; decisão dele).
- Next step: Coordenador revisa o `REVIEW.md` → baseline → E5.

### Orchestrator — decisão — 20261018041000
- Summary: CP-A concluído.
  - **Gabaritos:** o Coordenador confirmou as 47 perguntas.
  - **q01/q02:** na conversa real, o modelo não trouxe a resposta, mas também não inventou uma. Esse comportamento deve ser preservado e foi anotado no `comment` das duas perguntas.
  - **Baseline medido** (`results\20261018040840-baseline.json`):

| classe | n | recall@5 | hit@5 | MRR |
|---|---|---|---|---|
| follow-up | 9 | 0.500 | 0.556 | 0.556 |
| exact-term | 8 | 0.812 | 0.875 | 0.719 |
| document | 11 | 0.818 | 0.818 | 0.773 |
| temporal | 8 | 0.500 | 0.500 | 0.354 |
| sweep | 5 | 0.379 | 0.800 | 0.517 |
| image | 6 | 0.667 | 0.667 | 0.583 |
| **overall** | 47 | **0.636** | **0.702** | **0.599** |

- Decision:
  - E5 liberada: o baseline está registrado, e a reindexação/reconciliação das etapas seguintes já não o invalida.
  - O teste leve do Chat (E4) fica com o Coordenador, em paralelo.
- Next step: `codeAgent` — E5.

### CodeAgent — implementação inicial (Etapa E5) — 20261018041528
- Summary: Higiene da KB (R10).
  - **Causa dos 4 erros confirmada** no banco dev clonado (leitura somente): os 4 são páginas web (`origin='ai'`) com `error_message` "Embedding generation failed" e linhas sem quebra de 40.725 a 640.499 chars. Um deles tem só 82 KB, então a causa é a linha gigante, não o tamanho.
  - **Chunking:** em `chunk_text`, cada linha de um parágrafo maior que o chunk passa por `split_by_chars` em pedaços de `LONG_LINE_PIECE_CHARS` (4000 − 400 − 2), para caber junto com o overlap. Pedaços da mesma linha não ganham `\n` entre si. O resto do algoritmo não mudou. Testes `#[cfg(test)]`: linha de 20.000 chars (com `é`) gera chunks de até 4.000; `truncate_chars` respeita a fronteira de char.
  - Conferido com um teste temporário (já removido) sobre os 4 arquivos reais: 25 a 43 chunks cada, todos com no máximo 4.000 chars.
  - **Teto web:** `MAX_WEB_SOURCE_CHARS = 150_000`. Em `run_indexing`, `is_web_source` (pasta-pai `origin='ai'`, via `with_doc_db`) e `truncate_chars` cortam o texto lido. Em `librarian.ts`, o `rawContent` é cortado antes de `documentsWriteAiSourceFile`.
  - **Órfãs no `KnowledgeBaseModal`:**
    - helper `listChatFolderIds()` em `useChat.ts` (lê `FOLDERS_KEY` sem efeito colateral);
    - helper `webFolderChatFolderId(doc)` em `documents.ts` (último componente do `originalPath` de uma pasta `origin='ai'`);
    - selo "Orphan" (tooltip explicando) na linha da pasta;
    - botão "Remove orphan web folders (n)" no rodapé, só com n > 0. O `useConfirm` lista os nomes das pastas, e cada uma é apagada com `documentsDeleteWatchedFolder`, seguido de um `refresh`.
    - **Nada é removido automaticamente.**
  - **Apagar pasta de chat** (`ChatSidebar.handleDeleteFolder`): depois do 1º confirm e da exclusão, se existir pasta web da pasta de chat, um 2º confirm pergunta "Also delete the N web sources saved for this folder?" (delete / keep). "delete" chama `documentsDeleteWatchedFolder`; "keep" mantém a pasta na KB, que passa a aparecer como "Orphan".
  - Os caminhos sem confirmação (`commitFolderEdit`/`cancelFolderEdit`) não foram alterados: eles só apagam pastas recém-criadas e nunca nomeadas, que não podem ter web sources.
  - **Docs em erro:** pelo plano, quem os reprocessa é a E8 (`status='error'` entra na reindexação). Nesta etapa não houve reprocessamento.
  - O comentário de `documents.rs:1079` já tinha sido atualizado na E1.
  - Verificado: `cargo check`, `cargo check --examples`, `cargo test --lib` (2 testes) e `npx tsc --noEmit` ok. O app não foi aberto e nenhuma pasta foi removida.
- Files changed:
  - `src-tauri/src/documents.rs`
  - `src/lib/librarian.ts`
  - `src/lib/documents.ts`
  - `src/hooks/useChat.ts`
  - `src/components/KnowledgeBaseModal/KnowledgeBaseModal.tsx`
  - `src/components/KnowledgeBaseModal/KnowledgeBaseModal.module.css`
  - `src/components/ChatPanel/ChatSidebar.tsx`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - Teste no app dev (CP-B): ver o selo "Orphan"; testar a oferta ao apagar uma pasta de chat **criada para o teste**. **Não** usar "Remove orphan web folders" no dev, porque no perfil clonado todas as 7 pastas web aparecem como órfãs (o localStorage de chat não foi clonado).
  - Os 4 documentos em erro continuam em erro até a E8. O "rescan" não reindexa um arquivo que não mudou. Para testar antes da E8, é preciso alterar o mtime do arquivo no perfil dev e clicar em "rescan" na pasta.
  - O apagar livro do Library (`deleteChatFolderById`) não oferece apagar a pasta web do Reader (fora do plano). A pasta web fica com o selo "Orphan" e pode ser removida pelo botão.
  - Se a pasta web estiver visível em outra pasta de chat ou caderno, ela é apagada mesmo assim: o 2º confirm não avisa.
  - Sem proteção para o caso de o localStorage de chat estar vazio. Nesse caso, todas as pastas web aparecem como órfãs, mas a remoção continua exigindo o clique no botão e a confirmação com a lista.

### CodeAgent — implementação inicial (Etapa E6) — 20261018043000
- Summary: Cabeçalho determinístico por chunk e estado de índice (R3, backend).
  - **Schema** (`vec_db::init`, monet-vec.db): colunas novas em `chunks_meta` (`header`, `kind`, `title`, `doc_date`, `folder_label`, `section`, `page`, `source_url`), com `ALTER` guardado por `PRAGMA table_info`; tabela `doc_index_state (document_id, index_version, meta_sig)` via `CREATE TABLE IF NOT EXISTS`; `CURRENT_INDEX_VERSION = 2`. Nenhum `ALTER` em `documents`.
  - **Metadados** (`rag.rs`):
    - `doc_meta(doc_conn, document_id, file_text)` para arquivos da KB. Regras do plano: web (pasta `origin='ai'` ou cabeçalho `# / Source: / Retrieved:`), reunião (pasta `dd-mm-yyyy_hh-mm-ss`), demais = `document` (D2). Apelido da E2 > nome da pasta-pai. A data do arquivo sai do SQLite (`date(... 'unixepoch', 'localtime')`), sem crate de datas.
    - `note_meta(title, folder, note_date)` para as notas: os dados vêm do próprio upsert, sem ler o banco (o nome da linha da nota ainda é o antigo no momento do "unchanged").
    - `build_header` (`[título · tipo · data · pasta · seção · p. N]`, sem partes vazias) e `meta_sig` (cabeçalho sem seção e página). Título e seção cortados em 200 chars.
  - **Chunking** (`documents.rs`): `chunk_text` virou `chunk_segments(&[(texto, página)]) -> Vec<ChunkPiece>`, com o mesmo algoritmo (parágrafos, overlap, fatiamento da E5). Página e seção são as do 1º trecho novo do chunk (o overlap é do anterior). `prepare_chunks` omite a seção igual ao título e monta o cabeçalho. PDFs via `extract_text_by_pages`. O teto web passou a valer sobre o total dos segmentos (`truncate_segments`).
  - **Gravação:** texto embutido = `header + "\n" + trecho`. `chunks_meta.content` guarda só o trecho, então `ChunkResult.snippet` não mudou.
    - `replace_chunks` (transação rusqlite no vec db) troca os chunks e grava `doc_index_state` na mesma transação. `run_indexing` passou a usá-lo; `store_chunks` saiu.
    - As pré-deleções de `documents_reindex` e do scan de arquivo modificado foram removidas. Uma falha antes da troca mantém os chunks antigos.
    - `delete_chunks_for_document` apaga também a linha de `doc_index_state`.
  - **Notas:** `notes_index_upsert(..., note_date)`. "unchanged" exige o mesmo conteúdo, o mesmo caderno e `doc_index_state = (2, meta_sig)`. O atalho "moved" saiu (mover reembute), e `'moved'` saiu do tipo TS. O TS manda `noteDate` (`noteDate(note)` cortado em `YYYY-MM-DD`, ou o dia de `createdAt`; `null` no resumo de tasks). Caderno renomeado enfileira todas as notas do caderno (o `break` saiu).
  - **Apelido:** `documents_set_folder_alias` apaga de `doc_index_state` as linhas dos filhos da pasta quando o apelido muda de fato (salvar o mesmo valor não marca nada).
  - **Verificado:**
    - `cargo check` e `cargo check --examples` sem warnings; `cargo test --lib` com 8 testes (reunião, `Source:`/`Retrieved:`, título/data de documento, cabeçalho omitindo vazios, página e seção, linha gigante, cortes); `npx tsc --noEmit` ok.
    - `doc_meta` rodado com um teste temporário (já removido) contra o `monet.db` dev, somente leitura: 332 arquivos → 90 web, 34 reuniões e 208 documentos, todos com data; só os 5 uploads soltos ficam sem pasta.
    - `rag_eval -- run --pipeline baseline` roda e repete o baseline (0.636 / 0.702 / 0.599), porque o índice não mudou. O JSON dessa verificação foi apagado.
    - O app não foi aberto e nada foi reindexado.
- Files changed:
  - `src-tauri/src/vec_db.rs`
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/rag.rs`
  - `src/lib/documents.ts`
  - `src/hooks/useNotesIndexSync.ts`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **Para a E8 (decisão):** documento com `status` `error` ou `indexing` fica fora do escopo (`resolve_scope` só aceita `available`). Os chunks antigos sobrevivem a uma falha, mas não são pesquisáveis enquanto o status for `error`. O critério da E8 ("os que falham ficam com o índice antigo, pesquisável") pede uma de duas saídas: (a) voltar a `available` quando a reindexação falha e já existem chunks, mantendo o `error_message` e a linha antiga de `doc_index_state` (continua pendente); ou (b) o escopo passar a aceitar `error`/`indexing`, o que muda a regra espelhada do `resolveSearchableIds`. Não decidi.
  - Ao abrir o app (CP-B), a reconciliação reembute todas as notas e os resumos de tasks (versão ausente). Os arquivos só mudam pela E8, por um rescan com arquivo alterado ou por um retry. Até lá o índice é misto: chunks legados com `header=''` e `kind='document'` (default).
  - Os headings markdown são detectados em qualquer tipo de arquivo, inclusive em `.txt`/PDF (uma linha `# comentário` vira seção).
  - O texto de PDF agora é lido por página: parágrafos que cruzam a quebra de página viram dois, e o número de chunks dos 4 PDFs pode mudar na reindexação.
  - Pequenos desvios do plano: a regra das notas ficou em `note_meta`, e não dentro de `doc_meta` (as notas nunca passam por `run_indexing`); o teste de `chunk_segments` ficou em `documents.rs`, junto do chunker.

### Orchestrator — decisão — 20261018050000
- Summary: E5 e E6 concluídas. O status no plano foi atualizado para FEITO (E1–E6).
- Decision:
  - **Pendência 1 da E6, opção (a).** Quando a reindexação de um documento falha e ele já tem chunks, ele volta a `available`, guarda o `error_message` e continua pendente em `doc_index_state`.
    - A regra de escopo do `resolve_scope` (só `available`) não muda.
    - Motivo: cumpre o edge case "se falhar no meio, o índice antigo segue utilizável" sem abrir o escopo para documentos `indexing`/`error` sem chunks.
    - Implementar na E8.
  - O teste leve do Chat da E4 passa para o CP-B, junto com o resto. Motivo: a partir da E6, abrir o app reembute as notas.
- Next step: `codeAgent` — E7 (OCR).

### CodeAgent — implementação inicial (Etapa E7) — parada antes de codar — 20261018012912
- Summary: Execução parada antes de qualquer alteração de código. A E7 exige dependência nova em `Cargo.toml`, e o behavior do `codeAgent` lista "Dependências" em "Não toque em" (pare e consulte). Seguindo a instrução do Orquestrador, a parada é reportada antes de adicionar.
  - **Levantamento feito (somente leitura):**
    - `windows 0.61.3` já está no `Cargo.lock` como dependência transitiva (tauri, tao, wry, webview2-com, tauri-winrt-notification) e já está no registry local. As sub-crates (`windows-core 0.61.2`, `windows-future`, `windows-collections`, `windows-numerics`, `windows-link`) também já estão no lock. Declarar a dependência direta não baixa nem adiciona crate nova; só liga features.
    - As features `Media_Ocr`, `Graphics_Imaging`, `Storage_Streams`, `Foundation` e `Security_Cryptography` existem na 0.61.3.
    - `base64 0.22.1` também está no lock (transitivo).
    - OCR nesta máquina: `OcrEngine.AvailableRecognizerLanguages` = **pt-BR** (só esse idioma).
  - **Proposta mínima (para aprovação):**
    - Só `windows = { version = "0.61", features = ["Media_Ocr", "Graphics_Imaging", "Storage_Streams", "Security_Cryptography"] }`.
    - Sem `base64`: o data URL é decodificado por `CryptographicBuffer::DecodeFromBase64String`, que já devolve o `IBuffer` que o stream precisa.
    - Sem `Win32_System_WinRT`: o `windows-core` já trata a falta de apartment (`CO_E_NOTINITIALIZED`) ao ativar a factory. Qualquer outra falha de WinRT vira `Ok(None)` silencioso.
    - Sem `Globalization`, se o `TryCreateFromUserProfileLanguages` compilar sem ela; se não, entra só essa feature.
- Files changed:
  - nenhum (só este report)
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind: toda a E7. Aguarda a aprovação da dependência `windows` (com as features acima) para seguir o plano.

### CodeAgent — implementação inicial (Etapa E7) — 20261018014001
- Summary: OCR local (WinRT) das imagens base64 das notas, só no texto do índice. A nota não muda.
  - **Aprovação:** o Coordenador aprovou a dependência `windows` (via Orquestrador), conforme a proposta da sessão anterior: só `windows = { version = "0.61", features = ["Media_Ocr", "Graphics_Imaging", "Storage_Streams", "Security_Cryptography"] }`, sem `base64`. `Globalization` não foi necessária (`TryCreateFromUserProfileLanguages` não depende dela). No `Cargo.lock`, só entrou a linha `"windows"` nas dependências do `monet`; nenhuma crate nova.
  - **`src-tauri/src/ocr.rs` (novo):**
    - `ocr_base64`: `CryptographicBuffer::DecodeFromBase64String` → `InMemoryRandomAccessStream` → `BitmapDecoder` → `GetSoftwareBitmapConvertedAsync(Bgra8)` → `OcrEngine::RecognizeAsync().Text()`.
    - Sem engine (sem idioma de OCR ou falha ao ativar o WinRT) devolve `Ok(None)` sem erro. A thread do `spawn_blocking` não precisa de `RoInitialize`: o `windows-core` cai no MTA implícito (`CoIncrementMTAUsage`).
    - Imagem maior que `OcrEngine::MaxImageDimension` (10.000 px nesta máquina) vira texto vazio, que fica no cache.
    - Comandos `ocr_cached(hashes)` e `ocr_image(hash, dataUrl)`. O `ocr_image` roda o OCR em `spawn_blocking` e grava no cache com `Some` (inclusive vazio). Com `None` não grava. Erro de decodificação vira `Err`, sem gravar.
  - **Schema:** `CREATE TABLE IF NOT EXISTS image_ocr_cache (hash, text, created_at)` em `open_doc_db`. `with_doc_db` e `now_ms` passaram a `pub(crate)` para o `ocr.rs`.
  - **`src/lib/imageOcr.ts` (novo):** `ocrTextsForContent(content)`.
    - Extrai os data URLs `image/*` (sem SVG) com o `DATA_URL_RE`, agora exportado de `noteFileText.ts`.
    - Calcula o SHA-256 com `crypto.subtle`, consulta `ocr_cached` e chama `ocr_image` em série só para as faltantes.
    - Na sessão: sem engine, não tenta de novo; imagem que falhou também não. Pedidos simultâneos da mesma imagem (debounce + fila) são deduplicados.
  - **`noteFileText.ts`:**
    - opção `resolveImageText` em `cleanNoteContentForAi` e 5º parâmetro em `buildNoteFileText`;
    - nas 3 regex e no ramo `IMG` do walker, sai `[image: <texto>]` (espaços colapsados, até 2.000 chars), ou `[image]` sem texto;
    - o texto entra por um marcador (`n`) trocado só no fim, porque um OCR com `<div` quebraria a contagem de `<div>` dos toggles;
    - sem o resolver, a saída é a mesma de antes, então os outros chamadores não mudam.
  - **`useNotesIndexSync.fileTextFor`:** chama `ocrTextsForContent` e passa o resolver. Só o RAG usa o OCR.
  - **Verificado:**
    - `cargo check` e `cargo check --examples` sem warnings; `npx tsc --noEmit` ok.
    - `cargo test --lib`: 9 testes ok e 1 ignorado. O teste novo garante que uma entrada que não é imagem não entra em pânico.
    - **OCR real:** `cargo test --lib ocr -- --ignored --nocapture`. A imagem PNG é gerada pelo próprio teste (System.Drawing via PowerShell, texto fixo, sem dados de trabalho, nada gravado em disco). Resultado exato: `Especificação da migração 9.0.1`. Idioma disponível nesta máquina: só **pt-BR**.
    - O app não foi aberto. Nenhum commit.
- Files changed:
  - `src-tauri/Cargo.toml`
  - `src-tauri/Cargo.lock`
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/documents.rs`
  - `src/lib/noteFileText.ts`
  - `src/hooks/useNotesIndexSync.ts`
- Files created:
  - `src-tauri/src/ocr.rs`
  - `src/lib/imageOcr.ts`
- Files removed:
  - nenhum
- Left behind:
  - O critério "no app dev, o espelho `.md` da nota contém `[image: …]`, o editor não trava e a nota não muda" fica para o CP-B (o app não pôde ser aberto).
  - Na 1ª abertura do app, a reconciliação passa todas as imagens das notas pelo OCR, em série, uma vez. Depois tudo sai do cache. Cada imagem nova cruza o IPC como data URL (vários MB numa só mensagem). O OCR roda fora da thread da UI.
  - Imagens acima de 10.000 px ficam sem texto (não há redução de escala). Imagens por URL (não base64) não passam pelo OCR.
  - O cache não tem limpeza: hashes de imagens apagadas ficam na tabela (só texto, pequeno).
  - O teste de OCR real é `#[ignore]`, porque depende do PowerShell e do idioma instalado.

### CodeAgent — implementação inicial (Etapa E8) — 20261018014800
- Summary: Rotina "Update index" com progresso e retomada (R3, rollout).
  - **Pendentes** (`pending_documents`, `documents.rs`): arquivos `type='file'` sem linha em `doc_index_state`, com `index_version < CURRENT_INDEX_VERSION` ou com `status='error'`. Uma consulta no `monet.db` e outra no `monet-vec.db`, cruzadas em Rust.
  - **`documents_index_outdated_count() -> {files, notes}`**: separa por `origin='notes'`.
  - **`documents_reindex_outdated()`**:
    - recusa sem chave OpenRouter ("OpenRouter key not configured"), antes de mexer em qualquer documento;
    - single-flight com `AtomicBool` estático e um guard `Drop` (libera em erro ou pânico). Uma 2ª chamada com a rotina rodando volta `Ok` sem fazer nada;
    - roda em segundo plano (`spawn`) e volta na hora. Percorre os pendentes não-nota um por vez (`ORDER BY created_at`): `claim_for_reindex` (`UPDATE ... SET status='indexing' WHERE id=? AND status!='indexing'`, sem transação manual) e depois `run_indexing`. Um documento apagado ou já em indexação por outro caminho (scan, retry) é pulado e não conta como falha;
    - emite `documents://reindex-progress {done, total, failed, currentName, finished}` antes de cada documento e no fim (`finished: true`). Falha num documento não interrompe;
    - **retomável por construção:** cada documento concluído grava a versão atual, então uma nova rodada só pega o que falta. Embeddings em lote (`EMBED_BATCH_SIZE = 32`), com o modelo atual.
  - **Decisão do Orquestrador (pendência 1 da E6, opção a)**, em `status_after_index_failure` + `mark_index_failed`:
    - se a (re)indexação falha e o documento já tem chunks, ele fica `available`, guarda o `error_message` e **perde a linha de `doc_index_state`**, então continua pendente. Sem chunks, vira `error`, como antes. O `resolve_scope` não mudou;
    - apagar a linha (e não só "manter a antiga") cobre o documento que já estava na versão 2 e falhou num rescan de arquivo modificado. Sem isso, ele ficaria `available` com chunks velhos e fora da lista de pendentes;
    - aplicado em todas as falhas de `run_indexing` (upload, retry, scan, Update index), nas 2 falhas de `notes_index_upsert` (sem `emit`, como antes) e no `cleanup_stuck_indexing`;
    - nas notas, apagar a linha também é o que impede o "unchanged" de pular uma nota cujo reembed falhou: o espelho `.md` já foi regravado antes do embedding;
    - `cleanup_stuck_indexing` passou de um `UPDATE` único para "listar os `indexing` e decidir um por um". Um documento interrompido ao fechar o app volta pesquisável com o índice antigo, em vez de cair para `error`.
  - `run_indexing` passou a devolver `bool` (sucesso). Os chamadores antigos ignoram o retorno.
  - **TS** (`src/lib/documents.ts`): `documentsIndexOutdatedCount`, `documentsReindexOutdated`, `onReindexProgress` e os tipos `IndexOutdatedCount` e `ReindexProgressEvent`.
  - **`KnowledgeBaseModal`:**
    - banner no topo do corpo: "Search index needs an update: N documents (M notes update automatically)." (N = arquivos + notas). O botão "Update index" só aparece com arquivos pendentes, porque as notas não dependem dele;
    - durante a rotina: "Updating search index: done/total (F failed)", nome do documento atual e barra de progresso;
    - no fim: "Index updated." ou "Index updated (F failed)." e recontagem;
    - recontagem ao abrir e a cada 5 s, enquanto houver pendentes (a contagem de notas cai com a fila do `useNotesIndexSync`);
    - o listener de progresso vive com o componente (sempre montado em `App.tsx`), então o progresso segue com o modal fechado;
    - o tooltip do selo de status mostra o `error_message` também em documentos `available` (falha com índice antigo).
  - **Verificado:**
    - `cargo check`, `cargo check --examples` (o `rag_eval` compila sem mudança), `cargo test --lib` (9 ok, 1 ignorado) e `npx tsc --noEmit` ok;
    - leitura somente leitura do banco dev, com o app fechado: a `doc_index_state` ainda não existe (o app não abriu desde a E6). A contagem esperada na 1ª abertura é **332 arquivos + 156 notas**. Os 4 em `error` são os 4 web da E5, sem chunks;
    - o app não foi aberto, nada foi reindexado e não houve commit.
- Files changed:
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/lib.rs`
  - `src/lib/documents.ts`
  - `src/components/KnowledgeBaseModal/KnowledgeBaseModal.tsx`
  - `src/components/KnowledgeBaseModal/KnowledgeBaseModal.module.css`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - Teste no app dev (CP-B): progresso, interrupção e retomada, 4 web em erro indexando e `rag_eval after-reindex`.
  - Um documento que sempre falha (ex.: PDF escaneado, "no extractable text") fica pendente para sempre, e o banner nunca some. A UI só informa "(F failed)".
  - Sem retomada automática: depois de reabrir o app, é preciso clicar em "Update index" de novo (o plano pede o botão).
  - Durante a própria reindexação, o documento fica `indexing` e sai do escopo por alguns segundos.
  - O pendente é calculado no início da rodada. Se um scan reindexar o mesmo arquivo nesse meio tempo, ele é embutido de novo (custo duplicado, raro).
  - Corrida antiga e agora um pouco maior no startup: o `cleanup_stuck_indexing` pode pegar um arquivo que o scan de startup acabou de marcar como `indexing`. O pior caso é esse arquivo voltar a ficar pendente.
  - Fechar a janela só a esconde no tray, e a rotina continua. Para interromper de verdade: "Quit" no tray, ou Ctrl+C no terminal do `tauri:dev`.

### Orchestrator — decisão — 20261018060000
- Summary: E7 (OCR, dependência `windows 0.61` aprovada pelo Coordenador) e E8 (Update index) concluídas. Status FEITO no plano de E1 a E8.
- Decision:
  - CP-B aberto. O Coordenador testa no app dev, em um único roteiro: E2–E5, OCR (E7), reindexação com interrupção e retomada (E8) e o teste leve do Chat (E4).
  - A E9 só começa depois do CP-B, porque o `tauri dev` recompila e reinicia o app quando o Rust muda, o que atrapalharia o teste.
- Next step: Coordenador executa o CP-B → Orquestrador roda `rag_eval --label after-reindex`.

### Orchestrator — decisão — 20261018061000
- Summary: o Coordenador fez a reindexação no dev (CP-B). Medição `after-reindex` (`results\20261018050556-after-reindex.json`), mesmo pipeline baseline (KNN top-5), com cabeçalhos, OCR e chunking corrigido:

| classe | baseline MRR | after-reindex MRR | recall@5 base → after |
|---|---|---|---|
| follow-up | 0.556 | 0.593 | 0.500 → 0.611 |
| exact-term | 0.719 | 0.688 | 0.812 → 0.875 |
| document | 0.773 | 0.909 | 0.818 → 0.955 |
| temporal | 0.354 | 0.365 | 0.500 → 0.625 |
| sweep | 0.517 | 0.267 | 0.379 → 0.280 |
| image | 0.583 | 1.000 | 0.667 → 1.000 |
| **overall** | **0.599** | **0.661** | **0.636 → 0.753** |

- Por pergunta:
  - 8 subiram e 6 caíram.
  - Caso-guia: **q01 e q02 saíram de fora do top 15 para as posições 2 e 3.**
  - Quedas leves (1→2, 2→3, 3→4) em q24, q26, q32 e q36.
  - Sweep: q38 e q39 caíram para fora do top 5. Varredura segue fora do escopo e é a classe esperada como fraca.
- Decision: aguardar o retorno do Coordenador sobre o restante do roteiro do CP-B. A E9 (FTS5 + híbrida) começa depois, com o app dev fechado.
- Next step: Coordenador → resto do CP-B.

### Orchestrator — decisão — 20261018062000
- Summary: o Coordenador perguntou pelo Assistant. As mudanças de UI dele são as E14–E17. Foi oferecido antecipá-las, e o Coordenador respondeu "ok pode seguir".
- Decision:
  - Manter a ordem do plano: E9 → E17.
  - CP-B considerado aprovado pelo Coordenador, que reindexou e liberou a continuação. Não houve retorno item a item do roteiro.
  - Os itens não confirmados (retomada, apelidos, conjuntos, órfãs, OCR no editor e teste leve do Chat) voltam a ser conferidos no CP-C/CP-D.
- Next step: `codeAgent` — E9.

### CodeAgent — implementação inicial (Etapa E9) — 20261018022655
- Summary: FTS5 + busca híbrida com RRF (R6).
  - **Schema** (`vec_db::init` → `ensure_fts`, monet-vec.db): `chunks_fts USING fts5(header, content, tokenize = 'unicode61 remove_diacritics 2')`, com rowid = `chunks_meta.rowid`.
    - **Backfill local, sem API:** refaz o índice a partir de `chunks_meta` (`DELETE` + `INSERT ... SELECT`, numa transação rusqlite) quando ele diverge. A checagem é mais estrita que a do plano: contagens iguais **e** nenhum rowid de `chunks_meta` faltando no FTS. Só contar não pegaria um chunk trocado por uma versão do app sem FTS, com o mesmo total.
    - Idempotente: devolve `true` só quando refaz. A 2ª chamada não refaz (há teste).
  - **Sincronização nas escritas** (`documents.rs`): `insert_chunks_tx` grava também em `chunks_fts`. `replace_chunks` e `delete_chunks_for_document` apagam do FTS antes de `chunks_meta`, na mesma transação. São os únicos caminhos que escrevem chunks (upload, retry, scan, Update index, notas, exclusões).
  - **`rag.rs`:**
    - `fts_query(terms)`: cada termo vira frase entre aspas, com `"` escapado como `""`. Operadores, `*`, `:`, `-`, `^` e parênteses viram texto. Saem termos com menos de 2 chars ou sem letra/dígito; duplicados saem sem diferenciar caixa; no máximo 12 termos, unidos por ` OR `.
    - `message_terms(msg)`: termos tirados da mensagem quando não há keywords. Corta por espaço, tira a pontuação das pontas (o ponto interno de "9.0.0.1" fica), passa para minúsculas, exige 3+ chars e remove uma lista curta de stopwords pt/en.
    - `fts_search(conn, doc_ids, expr, k)`: ordena por `bm25(chunks_fts)` e usa o mesmo filtro de escopo `rowid IN (SELECT rowid FROM chunks_meta WHERE document_id IN (...))`.
    - `hybrid_search(conn, doc_ids, emb, terms, k_each, pool)`:
      - KNN top 40 sem filtro de vizinhos (`knn_rowids`) + FTS top 40;
      - RRF com k = 60; no empate, o melhor no vetor primeiro, depois o rowid;
      - filtro de vizinhos (±1, com fallback) depois da fusão;
      - devolve `Candidate` com as colunas de `chunks_meta`, `vec_rank`, `vec_distance`, `fts_rank`, `bm25` e `rrf`;
      - sem termos pesquisáveis, fica só o KNN.
    - Constantes `HYBRID_K_EACH = HYBRID_POOL = 40`. O `knn_search` (baseline e `/docs`) não mudou.
  - **`rag_eval`:** `--pipeline hybrid` embute a pergunta inteira (igual ao baseline), usa `message_terms(pergunta)` e `hybrid_search(40, 40)`, e mede o top 5 por documento. Continua somente leitura. Sem `chunks_fts`, aborta com uma mensagem; com contagem divergente, só avisa. O plano não previa este pipeline, que foi adicionado para medir a E9. Na E10, `full --no-rewrite --no-rerank` deve cobrir o mesmo papel.
  - **Edge cases:**
    - "especificacao" encontra "Especificação" (e o contrário);
    - "9.0.0.1" casa como frase (`9 0 0 1`) e não casa com "9.0.1.0";
    - título e caderno ficam no `header` indexado, então a nota só com título é encontrada pelo título e pelo caderno;
    - `excludeNoteId` continua respeitado (o escopo vem do `resolve_scope`, intacto, e os dois lados filtram por ele);
    - aspas e operadores não quebram o MATCH.
  - **Como foi desenvolvido:**
    - O `tauri dev` estava rodando e recompila e reinicia a cada mudança no Rust. Por isso, codei e testei numa cópia de `src-tauri` no scratchpad e copiei os 4 arquivos para o repo de uma vez.
    - Isso causou **um único** rebuild e restart do app dev, às 02:25. O app não foi aberto por mim.
    - O startup com o código novo fez o backfill no `monet-vec.db` dev, pelo próprio código do app.
    - O eval confirmou: `chunks_fts` existe e tem o mesmo total de `chunks_meta`.
    - Não houve trava de banco. A produção não foi tocada.
  - **Verificado:**
    - `cargo check` e `cargo check --examples`, sem warnings;
    - `cargo test --lib`: 16 ok e 1 ignorado. Os 7 testes novos cobrem `fts_query` com aspas e teto, `message_terms`, acentos e caixa, versão com pontos, sintaxe FTS nos termos, backfill único com ressincronização e fusão híbrida com escopo e vizinhos;
    - `npx tsc --noEmit` ok (não houve mudança em TS);
    - `rag_eval -- run --label hybrid --pipeline hybrid` (`results\20261018052637-hybrid.json`), comparado com `after-reindex` no mesmo índice:

| classe | n | recall@5 after → hybrid | hit@5 after → hybrid | MRR after → hybrid |
|---|---|---|---|---|
| follow-up | 9 | 0.611 → 0.611 | 0.667 → 0.667 | 0.593 → 0.667 |
| exact-term | 8 | 0.875 → 0.938 | 0.875 → 1.000 | 0.688 → 0.938 |
| document | 11 | 0.955 → 0.909 | 1.000 → 0.909 | 0.909 → 0.848 |
| temporal | 8 | 0.625 → 0.750 | 0.625 → 0.750 | 0.365 → 0.448 |
| sweep | 5 | 0.280 → 0.280 | 0.400 → 0.400 | 0.267 → 0.267 |
| image | 6 | 1.000 → 1.000 | 1.000 → 1.000 | 1.000 → 1.000 |
| **overall** | 47 | **0.753 → 0.774** | **0.787 → 0.809** | **0.661 → 0.718** |

  - Por pergunta: 9 subiram e 5 caíram.
    - **Caso-guia:** q01 e q02 sobem para a **posição 1** (estavam na 2 e na 3).
    - Também subiram: q23 (fora → 1), q24, q25, q30, q33, q35 e q36.
    - Caíram: q04 (1 → fora), q06 (2 → 3), q27 (recall 1 → 0.5), q29 e q32 (3 → fora).
- Files changed:
  - `src-tauri/src/vec_db.rs`
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/rag.rs`
  - `src-tauri/examples/rag_eval.rs`
- Files created:
  - nenhum (no repo)
- Files removed:
  - nenhum
- Left behind:
  - As quedas (q04, q29, q32, q27 e q06) parecem vir do FTS com `OR` sobre todos os termos da pergunta: termos comuns trazem chunks lexicalmente parecidos, que empatam na RRF com os do vetor. A E10 trata isso (keywords da reescrita e rerank). Não ajustei pesos nem o `k` da RRF para não sobreajustar ao golden set antes do rerank.
  - O `bm25` usa pesos iguais para `header` e `content`, como no plano. Um peso maior no cabeçalho é uma alavanca possível, se a E10 não bastar.
  - `Candidate` não deriva `Serialize`/`Clone`: ninguém precisa disso ainda. A E10 adiciona ao montar o `RagCandidate`.
  - O app dev ficou rodando com o código da E9, reiniciado pelo `tauri dev`.
- Next step: Orquestrador → E10.

### CodeAgent — ajuste final (ajuste E7 — contexto efêmero) — 20261018022859
- Summary: O texto do OCR passou a entrar também no contexto efêmero da nota aberta. Antes, só o RAG usava o OCR, e a nota aberta fica fora do RAG por `excludeNoteId`. Por isso o modelo via só `[image]`.
  - **`notesContext.ts`** continua puro: ganhou o campo opcional `resolveImageText` no `NotesContextInput` e o repassa ao `cleanNoteContentForAi`.
  - **`NotesChatPanel.handleSend`:** antes de montar o contexto, chama `ocrTextsForContent(note.content)` (depois do `loadEmbedResponses`) e passa `resolveImageText: (u) => imageTexts.get(u)`.
  - **`App.tsx` (comandos do painel de IA, `/docs` e afins):** o mesmo para todo conteúdo passado ao `toAiText`, ou seja, a nota aberta e as notas de `/week` e as datadas do Calendar. Um único `ocrTextsForContent` roda sobre os conteúdos unidos.
  - **Sem mudança de comportamento no erro:** `ocrTextsForContent` não lança exceção. Sem engine, ou se o OCR falhar, o mapa fica vazio e a imagem continua `[image]`, sem bloquear o envio. Imagem sem cache passa pelo OCR antes do envio. Imagem já indexada sai do cache (`ocr_cached`).
  - A nota não é alterada: o texto só entra na string enviada à IA.
  - **Outros chamadores verificados:** o Reader (`readerContext.ts`) não manda conteúdo de nota, e o Assistant (`AssistantPanel`) envia sem contexto efêmero. Nenhum dos dois precisou de mudança. O `cleanContent` de `scoreNotes.ts` (Related Content) não vai para a IA.
  - Comentários atualizados em `noteFileText.ts` e `imageOcr.ts`, que diziam "só o RAG".
  - **Verificado:** `npx tsc --noEmit` ok. O app não foi aberto, `src-tauri/` não foi tocado e não houve commit.
- Files changed:
  - `src/components/NotesChat/notesContext.ts`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `src/App.tsx`
  - `src/lib/noteFileText.ts` (só o comentário de `resolveImageText`)
  - `src/lib/imageOcr.ts` (só o comentário do topo)
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - As imagens de **notas linkadas** expandidas no contexto continuam `[image]`, porque a recursão de `cleanNoteContentForAi` não repassa o `resolveImageText` e o mapa só cobre a nota aberta. Cobrir esse caso exigiria rodar o OCR também no conteúdo das linkadas. Isso não foi pedido.
  - Na 1ª vez que uma imagem nova (sem cache) é enviada, o envio espera o OCR, que pode levar alguns segundos com imagem grande. O rascunho já foi limpo, mas o spinner de streaming só aparece depois.

### Orchestrator — decisão — 20261018063000
- Summary: ajuste da E7 (contexto efêmero com OCR) concluído. O Coordenador pediu para testar tudo só no final.
- Decision:
  - CP-C e CP-D viram um único teste final, junto com o CP-E, depois da E17.
  - Até lá, as etapas seguem em sequência, validadas por build, testes e `rag_eval`.
  - Decisões técnicas dentro do escopo ficam com o Orquestrador. Mudança de escopo ou decisão de produto ainda param o fluxo.
- Next step: E10 em andamento → E11 … E17 → roteiro único de teste para o Coordenador.

### CodeAgent — implementação inicial (Etapa E10) — 20261018025642
- Summary: reescrita da consulta, rerank, peso por fonte e o comando `rag_retrieve` (R2 reescrita, R7). A integração no `useChat` fica para a E11.
  - **`rag.rs`:**
    - **`rewrite_query(key, model, history, message, current_date) -> Option<Rewrite { query, keywords, date_range }>`**
      - Chamada: OpenRouter chat/completions com `response_format` `json_schema` estrito, `max_tokens` 300, `temperature` 0 e timeout de 4 s.
      - Entrada: as últimas 6 mensagens, cada uma cortada em 1.500 chars, e a mensagem atual cortada em 2.000 chars, num único texto "Conversation so far / Latest user message", para o modelo não responder à conversa.
      - O prompt tem a data com o dia da semana.
      - Validação da saída:
        - consulta vazia conta como falha; a consulta é cortada em 300 chars;
        - no máximo 8 keywords;
        - `dateRange` só com duas datas ISO, trocadas se vierem invertidas.
      - Erro, timeout ou JSON inválido devolvem `None` (log no stderr).
    - **`rerank(key, model, query, docs, top_n) -> Vec<(índice, relevance_score)>`:** o corpo saiu de `deep_research_rerank`. O comando continua com a mesma assinatura (só os índices), e o `deepResearch.ts` não mudou.
    - **`retrieve(&Mutex<Connection>, key, &RagRequest) -> Result<RagResponse>`:**
      - Consulta efetiva: a reescrita ou, em fallback, os primeiros 1.000 chars da mensagem.
      - FTS: as **keywords da reescrita** substituem o OR sobre a mensagem inteira. Sem keywords, ou se a reescrita falhar, entram os `message_terms` da consulta efetiva.
      - Busca: `hybrid_search(40, 40)`, ou só KNN com `use_fts=false`.
      - Período (`date_range`): sai o candidato datado fora do período; os sem data ficam.
      - Rerank `cohere/rerank-4-fast` sobre os candidatos (cabeçalho + trecho, cortados em 4.000 chars), com timeout de 8 s.
      - Pesos: `note` e `meeting` 1.0, `document` 0.9, `web` 0.7. `final = rerank × peso`.
      - Seleção: rerank >= limiar, ordenado por `final`, no máximo 8.
      - Rerank falhou: os 6 primeiros da RRF, com `rerank_failed`.
      - Limiar descartou tudo (ou a busca no escopo não achou nada): `selected = []` e `nothing_relevant = true`.
      - Só embedding e busca devolvem erro. O lock do vec db não atravessa nenhum `await`.
    - **`get_chunks(rowids)`:** devolve os chunks na ordem pedida e ignora os rowids que sumiram. O `chunk_rows` saiu do `hybrid_search` e passou a ser compartilhado pelos dois.
    - **`local_today` (SQLite `date('now','localtime')`)** e `weekday`, sem crate de datas.
    - Comandos `rag_retrieve(scope, message, history, rewriteModel)` e `rag_get_chunks(rowids)`, registrados em `lib.rs`.
      - O `rag_retrieve` resolve o escopo com `resolve_scope` e lê a data de hoje no mesmo acesso ao `monet.db`.
      - O modelo padrão é `openai/gpt-4.1-mini` quando `rewriteModel` vem vazio.
  - **`src/lib/rag.ts` (novo):** `ragRetrieve` e `ragGetChunks`, com os tipos espelhados em camelCase.
  - **`rag_eval`:**
    - `--pipeline full` chama `rag::retrieve` (o mesmo código do comando), com as flags `--no-rewrite`, `--no-fts`, `--no-rerank` e `--threshold <f>`. O label padrão inclui as flags.
    - Por pergunta, o JSON grava só números e ids: flags do trace, nº de candidatos e selecionados, maior rerank, posição e rerank de cada esperado no conjunto de candidatos, e latência.
    - Campo opcional `currentDate` por pergunta. Foi preenchido só na q29 ("o que eu tenho pra fazer hoje?") com `2026-10-15`, a data de referência que já estava no `comment` dela. Backup em `rag-eval\goldenset.pre-e10.json`.
  - **Desvios do plano (pequenos):**
    - o rerank pede `top_n` = todos os candidatos, e não 8: o custo é o mesmo (1 search unit), o inspetor ganha o rerank de cada candidato e a seleção continua cortando em 8;
    - o filtro de período só vale se algum candidato **datado** cair no período, para que um período resolvido errado (por exemplo, com o ano trocado) não descarte todas as fontes datadas;
    - `RagFilters` não foi criado (seria um placeholder; entra na E13);
    - timeout de 8 s no rerank do RAG, para que um rerank lento não trave o chat (cai na RRF). O rerank do Deep Research não ganhou timeout.
  - **Como foi desenvolvido:**
    - codado e testado na cópia `src-tauri` do scratchpad (a da E9). Os 3 arquivos Rust foram copiados para o repo de uma vez, com **um único** rebuild e restart do app dev (02:56);
    - o app não foi aberto por mim;
    - o eval só leu o perfil dev; a produção não foi tocada.
  - **Medição** (dev, 47 perguntas, k = 5, MRR):

| classe | n | after-reindex | hybrid (E9) | **full** | full `--no-rewrite` | full `--no-fts` | full `--no-rerank` |
|---|---|---|---|---|---|---|---|
| follow-up | 9 | 0.593 | 0.667 | **0.889** | 0.593 | 0.843 | 0.759 |
| exact-term | 8 | 0.688 | 0.938 | **1.000** | 1.000 | 1.000 | 1.000 |
| document | 11 | 0.909 | 0.848 | **1.000** | 0.909 | 0.955 | 0.848 |
| temporal | 8 | 0.365 | 0.448 | **0.875** | 0.812 | 0.875 | 0.688 |
| sweep | 5 | 0.267 | 0.267 | **0.767** | 0.667 | 0.767 | 0.433 |
| image | 6 | 1.000 | 1.000 | **0.833** | 0.833 | 0.833 | 1.000 |
| **overall** | 47 | **0.661** | **0.718** | **0.911** | **0.812** | **0.892** | **0.805** |

  - Recall@5 overall: after-reindex 0.753, hybrid 0.774, **full 0.894**, `--no-rewrite` 0.840, `--no-fts` 0.894, `--no-rerank` 0.850. Hit@5 overall: 0.787, 0.809, **0.957**, 0.894, 0.957, 0.915.
  - "full" = `results\20261018055517-full-final.json`, com as constantes finais (limiar 0,25). As ablações (`20261018054313`, `…054518`, `…054659`) e o 1º full (`20261018054129-full.json`, MRR 0.897) rodaram com o limiar 0,2. O limiar só corta a cauda, então a comparação vale.
  - **Ruído:** a reescrita varia um pouco entre rodadas mesmo com temperature 0. Entre as 3 rodadas full, só a q06 e a q40 mudaram (±0,015 no MRR geral). Diferenças dessa ordem são ruído.
  - **Leitura da ablação:**
    - a **reescrita** é o que mais pesa nos follow-ups (0.593 → 0.889);
    - o **rerank** pesa em document, temporal e sweep;
    - o **FTS** quase não muda o resultado quando reescrita e rerank estão ligados (0.892 × 0.911). Ele foi mantido: é local e barato, e o `--no-fts` piora a q17 e a q02.
  - **Regressões da E9:** a q04 (fora → 1), a q06 (3 → 1), a q27 (recall 0.5 → 1) e a q32 (fora → 1) foram resolvidas. A q29 ("hoje") continua fora em todas as variantes: o esperado está na posição 16 do conjunto de candidatos, com rerank 0,50. É caso para o `get_day` da E13.
  - **Caso-guia:** a q01 e a q02 estão na posição 1. Nenhuma pergunta do golden set deu `nothing_relevant`, falha de reescrita ou falha de rerank.
  - **Nova queda:** a q47 (image) sai do top 5 com rerank. O esperado é o 1º da RRF, mas tem rerank 0,43, e outros candidatos ficaram acima. Por isso a classe image cai de 1.000 para 0.833.
  - **Custo** (medido pelo `usage` da chave OpenRouter antes e depois): uma rodada full de 47 perguntas custou de **US$ 0,115 a 0,15**, cerca de **US$ 0,0025–0,003 por consulta**.
    - O rerank custa US$ 0,002 fixo por consulta (1 search unit, lido na resposta da API), cerca de 75% do total.
    - A reescrita custa cerca de US$ 0,0008 em média, mais nas perguntas com histórico longo.
    - O embedding é desprezível.
    - Todas as rodadas desta sessão (7 evals + sonda) somaram US$ 0,70.
  - **Latência média:** 3,0 s por consulta antes do streaming. Pelas ablações, a reescrita custa ~1,1 s e o rerank ~0,9 s; o resto é embedding e busca. Sem reescrita, 1,9 s.
  - **Limiar ajustado de 0,2 para 0,25, com justificativa fora do golden set:**
    - Sonda só no scratchpad, que não foi para o repo: 6 perguntas fora da base, de assunto genérico e sem dados de trabalho, em 3 escopos do golden set.
    - Resultado da sonda: o melhor rerank dessas perguntas ficou entre 0,09 e 0,30 (mediana ~0,17). Com 0,2, 3 das 18 deixariam passar trechos; com 0,25, só 1 (receita de bolo no escopo de alimentação, possivelmente relacionada de fato).
    - No golden set, o pior esperado primário tem 0,43, e um esperado secundário real (q19) tem 0,27. Por isso o limiar não subiu para 0,3.
    - As métricas do golden set não mudaram com o ajuste.
  - **Pesos, k da RRF, 40 candidatos e 8 selecionados:** sem mudança, porque não houve evidência para ajustar.
  - **Verificado:**
    - `cargo check` e `cargo check --examples` sem warnings, também no repo;
    - `cargo test --lib`: 22 ok e 1 ignorado. Os 6 testes novos cobrem a validação da saída da reescrita, os cortes de histórico e de mensagem longa, o dia da semana, o filtro de período, o limiar com pesos e teto, e o `get_chunks` na ordem pedida;
    - `npx tsc --noEmit` ok.
    - O Deep Research segue compilando com o rerank via `rag::rerank`, mas não foi testado no app.
- Files changed:
  - `src-tauri/src/rag.rs`
  - `src-tauri/src/lib.rs`
  - `src-tauri/examples/rag_eval.rs`
- Files created:
  - `src/lib/rag.ts`
- Files removed:
  - nenhum
- Left behind:
  - **E11:** integrar o `ragRetrieve` e o `ragGetChunks` no `useChat` (gating, citações e `nothingRelevant` → aviso). Hoje ninguém chama os comandos novos.
  - **Latência de cerca de 3 s antes do 1º token** em toda mensagem com RAG. A E11 deve mostrar um indicador de "searching…". Uma otimização possível, não feita: embutir a mensagem original em paralelo com a reescrita.
  - **O "nada relevante" não está no golden set:** ele só tem perguntas com resposta. A sonda negativa ficou no scratchpad; se o Coordenador quiser medir isso sempre, cabem 3–5 perguntas "sem resposta" no golden set, com uma métrica própria.
  - A q29 ("hoje") depende do `get_day` (E13). A q47 é uma perda pontual do rerank.
  - **Trace:** os candidatos tirados pelo filtro de período não aparecem no trace (`candidates` vem depois do filtro). O conteúdo dos 40 candidatos atravessa o IPC (até cerca de 160 KB), mas só em memória.
  - O plano previa 0,0003 + 0,001–0,002 por consulta; o medido foi cerca de US$ 0,0025–0,003, ainda na faixa de "centavos".

### CodeAgent — implementação inicial (Etapa E11) — 20261018030513
- Summary: o `useChat.send()` passou a usar o `ragRetrieve` (R2, gating; R3, citações). Como Chat, Anotações, Reader e Assistant enviam pelo mesmo `send()`, a troca vale para os quatro. A UI de "Sources (n)" e o inspetor ficam para a E12.
  - **`src/lib/rag.ts`:**
    - `ragGate(message)`: normaliza o texto (minúsculas, sem acento, sem pontuação e emoji) e exige até 40 chars.
      - `skip`: só frases de agradecimento ou confirmação, inclusive combinadas ("ok, perfeito"), ou só emoji/pontuação ("👍").
      - `reuse`: só continue, tenta de novo, more etc.
      - `search`: o resto.
      - As listas são as do plano, mais "obrigada" e "brigada".
    - `buildRagContext(chunks, hasOtherContext)`: agrupa por `documentId` na ordem do 1º aparecimento e numera `[n]` por documento. Devolve a mensagem de sistema no formato do plano e as `RagSource` compactas `{n, documentId, title, kind, date?, folder?, page?, url?, rowids}`, sem o conteúdo dos trechos.
    - `ragNothingFoundMessage(hasOtherContext)`: o texto do plano.
    - `ragHistory(messages)`: as últimas 6 mensagens não vazias, só texto, com até 1.500 chars cada.
    - `ragMessage(text)`: os primeiros 2.000 chars.
      - São os mesmos cortes que o backend aplica. Uma mensagem colada enorme atravessa o IPC com no máximo 2.000 chars e não volta inteira no `originalQuery` do trace.
    - Chaves `RAG_REWRITE_MODEL_KEY` (`monet:rag-rewrite-model`) e `RAG_DETAILED_KEY` (`monet:rag-detailed`).
  - **`useChat.ts`:**
    - `ChatMessage` ganhou `ragSources?` e `ragNothingFound?: true`. O parse do localStorage já preserva campos extras.
    - O bloco antigo de RAG (embed + `documentsSearchByIds` top 5) saiu. O escopo é resolvido como antes: um caderno vinculado lê a tabela do caderno; os outros usam `visibleDocumentIds`. A expansão das pastas fica no `rag_retrieve`, com `notebookId`, `excludeNoteId` e `includeAiFolders`.
      - **`skip`:** não faz busca.
      - **`reuse`:** pega os `rowids` da última mensagem assistant com `ragSources` e chama `ragGetChunks`, tirando a nota aberta se ela agora é contexto efêmero. Se nada voltar (sem fontes antes, ou rowids que sumiram numa reindexação), cai para `search`.
      - **`search`:** chama `ragRetrieve(scope, ragMessage(trimmed), ragHistory(currentConv.messages), localStorage[rag-rewrite-model])`.
    - Com trechos, a mensagem de sistema vai com as citações `[n]`, e as `ragSources` são gravadas no placeholder do assistant **antes** do streaming. Com `nothingRelevant`, vai a instrução de dizer que não achou nada nos documentos, e a mensagem recebe `ragNothingFound: true`. A mensagem de sistema entra nas duas rodadas (inicial e depois da tool call), como antes.
    - **Contexto efêmero:** quando há um (nota aberta nas Anotações, página no Reader), as duas mensagens ganham a frase "This applies only to the knowledge base search: the other context provided in this conversation (such as the open note or the current page) can still be used." **Motivo:** a nota aberta fica fora do RAG (`excludeNoteId`). Sem essa frase, uma pergunta sobre a própria nota daria "nada relevante", e o modelo diria que não achou mesmo tendo a nota no contexto.
    - Os erros do RAG continuam silenciosos (`console.warn`). Em DEV, há os logs `[useChat] RAG reuse: n/m chunks…` e `[useChat] RAG retrieve:` (com o trace).
    - **Trace do inspetor:** `ragTraces: Record<assistantId, RagResponse>`, só em memória e só quando `localStorage['monet:rag-detailed'] === '1'`, exposto no `UseChatResult` (para a E12). O `reuse` não gera trace.
    - **`ragSearching`** (exposto) fica ligado durante a recuperação.
    - **Stop durante a busca:** antes, se o usuário clicasse em Stop durante a busca pré-turno, o stream começava depois mesmo assim, porque ainda não havia stream para cancelar. Com os ~3 s do RAG em toda mensagem, isso ficaria comum. Agora, depois da busca, se `toolCancelledRef` estiver marcado, o turno termina: o placeholder vazio sai e `isStreaming` volta a `false`.
    - **`CHAT_SYSTEM_PROMPT`:** "Never place web links or web citation markers in the middle of the text." e a frase nova "Knowledge base excerpts are cited inline as [n]."
    - Saíram os imports `documentsSearchByIds`, `embedText` e `resolveSearchableIds`, que continuam sendo usados pelo `/docs` no `App.tsx`.
  - **Indicador:** componente novo `RagSearchStatus` ("Searching knowledge base...", com o mesmo visual do "Searching the web..." e tokens do `App.css`).
    - No Chat principal, ele entra pelo `ChatComposer` (E4, prop `ragSearching`). O Assistant herda na E15.
    - Por enquanto, entra também direto no composer do NotesChat, do Reader e do Assistant (uma linha cada).
  - **Settings:** campo "Retrieval model (query rewrite)" na seção OpenRouter, com placeholder `openai/gpt-4.1-mini`. Grava em `monet:rag-rewrite-model` a cada digitação; vazio remove a chave (o backend usa o padrão).
  - **Verificado:**
    - `npx tsc --noEmit` ok;
    - `ragGate`, `buildRagContext`, `ragHistory` e `ragMessage` testados no Node (bundle esbuild no scratchpad) com 24 frases pt/en e a numeração por documento.
    - O Rust não foi tocado (sem `cargo check`). O app não foi aberto e não houve commit.
- Files changed:
  - `src/lib/rag.ts`
  - `src/hooks/useChat.ts`
  - `src/components/Settings/SettingsModal.tsx`
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/ChatPanel/ChatPanel.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `src/components/Reader/ReaderChatPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
- Files created:
  - `src/components/ChatPanel/RagSearchStatus.tsx`
  - `src/components/ChatPanel/RagSearchStatus.module.css`
- Files removed:
  - nenhum
- Left behind:
  - Os critérios do plano no app dev (`ragSources` no localStorage, "valeu" sem `rag_retrieve`, "continue" reaproveitando e respostas com `[n]`) não foram conferidos no app. Entram no teste final.
  - **Risco a observar no teste:** numa pasta com documentos, uma pergunta de conhecimento geral ("o que é quicksort?") pode dar `nothingRelevant`, e o modelo é instruído a dizer que não achou nos documentos. É o comportamento pedido, mas pode soar restritivo no Chat de estudo. Se incomodar, a alavanca é o texto da instrução (permitir responder com conhecimento geral avisando que não veio da base).
  - **"ok, continue"** é tratado como `search`, não `reuse`: as frases de confirmação e de continuação não se combinam. A reescrita com histórico resolve a consulta, mas custa uma busca.
  - Com Stop durante a busca, o botão continua visível até a busca terminar (até ~3 s, ou ~8 s no pior caso do rerank). Só então o turno é descartado.
  - O `ragTraces` não é limpo ao apagar uma conversa. Fica só em memória, enquanto a janela existir.
  - Na E15, a linha do `RagSearchStatus` no composer próprio do Assistant sai junto com esse composer.
  - O status da E11 no plano não foi alterado (fica com o Orquestrador).

### CodeAgent — implementação inicial (Etapa E12) — 20261018031145
- Summary: UI "Sources (n)" e inspetor do RAG por resposta nos 4 chats (R4, R5).
  - **`MessageSources` (novo, compartilhado pelos 4 chats):**
    - Linha recolhida "Sources (n)" abaixo da resposta que tem `ragSources`. Clicar expande a lista `[n] título · kind · data · pasta · p. X`.
    - Com `ragNothingFound`: "No relevant sources found in your documents".
    - Cada item é um botão que chama `openRagSource`. O tooltip mostra "Open note", a URL ou "Open file". O resumo `note:tasks-…` fica desabilitado.
    - Ele também renderiza o `RagInspector` quando o modo detalhado está ligado e existe trace em memória para a mensagem. Por isso cada chat pluga um único componente: `<MessageSources message={m} trace={ragTraces[m.id]} />`.
  - **`RagInspector` (novo):** `<details>` recolhido "Retrieval details". Mostra:
    - a consulta original, a reescrita, as keywords e o período;
    - as flags `rewriteFailed`, `rerankFailed` e `nothingRelevant`, em selos;
    - "N of M candidates sent to the model";
    - a tabela dos candidatos, na ordem da RRF, com: #, fonte (título · seção · p.), kind, vetor (#posição e distância), BM25 (#posição e score), RRF, rerank, peso, final e "Sent" (#ordem no envio, com a linha destacada). O tooltip da fonte mostra o cabeçalho e os primeiros 400 chars do trecho. A tabela rola na horizontal nos painéis estreitos.
  - **`openRagSource(source)` e `isRagSourceOpenable` em `src/lib/rag.ts`:**
    - `note:<id>` → `open_note_in_main`, que já mostra a janela main e abre a nota. Vale também a partir da janela `assistant`.
    - Com `url` → `openUrl`.
    - Demais → comando novo `documents_open_file(document_id)`.
    - Erros só vão para o `console.warn`.
  - **Rust:** `documents_open_file` em `documents.rs`, registrado em `lib.rs`. Lê `original_path` (só `type='file'`), confere se o arquivo existe e abre com `OpenerExt::opener().open_path`. Não precisou de capability nova.
  - **Toggle "Retrieval details"** no `ChatToolsMenu`: item fixo, independente do modelo, que vale nos 4 chats. Ele não entra no contador do botão, porque não é tool da IA.
    - Hook novo `useRagDetailed()`: lê e grava `monet:rag-detailed` e sincroniza por evento na mesma janela e por `storage` entre as janelas.
    - O `useChat` continua lendo a chave no envio (E11). Por isso o toggle vale para as **próximas** respostas, como diz a descrição do item.
  - **Onde foi plugado:**
    - **Chat:** no `footer` do `ChatMessageBubble`, que não mudou.
    - **Anotações:** no fim do `assistantBlock` da `NotesChatBubble`.
    - **Reader e Assistant:** a bubble própria passou a devolver um fragmento com a resposta e o `MessageSources` logo abaixo. No Assistant, foi o mínimo; a migração para o `ChatMessageBubble` é da E15.
    - Nos quatro, as fontes não aparecem enquanto a resposta ainda é o placeholder (pontinhos).
  - **D4:** o trace segue só em memória. Depois de recarregar, a mensagem mostra só "Sources (n)", sem inspetor e sem erro.
  - **Citações `[n]` como link:** não foram feitas, porque o plano não as inclui.
  - CSS novo só com os tokens do `App.css` (`--space-*`, `--radius-*`, `--lh-ui`, `--accent-warn`), sem valores fora da escala.
  - **Como foi desenvolvido:** o Rust foi codado e checado na cópia `src-tauri` do scratchpad (a das E9/E10, conferida idêntica ao repo antes). Os 2 arquivos foram copiados de uma vez, o que causa **um único** rebuild e restart do app dev.
  - **Verificado:**
    - `cargo check` e `cargo check --examples` sem warnings, na cópia;
    - `npx tsc --noEmit` ok.
    - O app não foi aberto e não houve commit.
- Files changed:
  - `src/lib/rag.ts`
  - `src/components/ChatPanel/ChatToolsMenu.tsx`
  - `src/components/ChatPanel/ChatPanel.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `src/components/Reader/ReaderChatPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/lib.rs`
- Files created:
  - `src/components/ChatPanel/MessageSources.tsx`
  - `src/components/ChatPanel/MessageSources.module.css`
  - `src/components/ChatPanel/RagInspector.tsx`
  - `src/components/ChatPanel/RagInspector.module.css`
  - `src/hooks/useRagDetailed.ts`
- Files removed:
  - nenhum
- Left behind:
  - **Teste no app dev** (entra no teste final):
    - "Sources (n)" nos 4 chats;
    - abrir uma nota (inclusive pelo Assistant, que deve trazer a main), um arquivo da KB e uma fonte web;
    - "nada relevante";
    - toggle e inspetor;
    - reload sem inspetor.
  - As respostas do `reuse` ("continue") não têm trace (E11), então mostram só as fontes, mesmo no modo detalhado.
  - Os candidatos tirados pelo filtro de período não aparecem no inspetor: o trace da E10 já vem filtrado.
  - **Reader e Assistant:** as fontes são irmãs da bubble no histórico, então ficam com o gap do histórico (12px no Reader, 10px no Assistant) em vez de coladas na resposta. O Assistant se resolve na E15. No Reader, ficou como está.
  - **Clique numa nota pelo chat do Reader**, na janela main: a nota abre e o Reader é trocado pelo caderno. É o comportamento do `open-note`.
  - Se o arquivo de origem sumiu, o clique só gera `console.warn`, sem aviso visível.
  - O status da E12 no plano não foi alterado (fica com o Orquestrador).

### CodeAgent — implementação inicial (Etapa E13) — 20261018032605
- Summary: roteamento (R8). Tools `get_day`, `notes_by_date` e `search_knowledge_base` no `send()`, junto do `query_tasks`, no mesmo modelo de rodada única (a tool roda, e a 2ª rodada vai sem tools). O RAG automático do 1º turno não mudou.
  - **Toggle "Daily notes" (D3)** no `ChatToolsMenu`, desligado por padrão (`ChatTools.dailyNotes`, gravado em `monet:chat-tools`), desabilitado quando o modelo não aceita tools e contado no badge.
    - Aparece nos 4 chats (Chat via `ChatComposer`, Anotações, Reader e Assistant). Motivo: o estado das tools é compartilhado entre os chats, e as duas tools funcionam em qualquer janela (`storage`/plugin-sql). Sem a linha num chat, a tool ficaria ativa lá sem o usuário ver.
  - **`get_day({date})` e `notes_by_date({from, to, notebook?})`** (só com o toggle):
    - `storage.getNotesByDateRange(from, to)` (novo, em `index`/`tauri`/`browser`): as notas com `date` no período, mais as do Calendar cujo título `dd/mm/yyyy` cai no período. A comparação é feita em SQL, e o `parseCalendarTitle` descarta títulos inválidos. Conferido somente leitura no banco dev: o dia 15/10, a semana 12–18/10 e uma nota datada de 13/08.
    - `storage.getNoteSummaries()` (novo, sem `content`): resolve os títulos das notas linkadas. Também é o que a E16 usa.
    - Ficam de fora os cadernos com a indexação de IA desligada (`notesIndexGetDisabledNotebooks`, como no `query_tasks`). O filtro `notebook` casa por trecho do nome, sem diferenciar caixa nem acentos.
    - Formato: `[n] [título · note · data (dia da semana) · Notes — caderno]` e o texto de `cleanNoteContentForAi`, com as respostas de IA embutidas e o OCR (cache). A ordem é por data, com a nota diária primeiro no mesmo dia.
    - Orçamento de 24.000 chars: cada nota leva uma parte (mínimo de 1.500), com "[truncated]"; quando o total estoura, as notas restantes viram "(N more note(s) omitted…)".
  - **`search_knowledge_base({query, kind?, dateFrom?, dateTo?, notebook?})`:** oferecida quando a pasta da conversa tem escopo de RAG não vazio. A descrição pede para usá-la só quando os trechos automáticos faltam ou quando o usuário pede tipo, período ou caderno.
    - Chama `rag_retrieve` com o **mesmo escopo** do RAG automático (que agora é calculado antes do gating e reaproveitado), sem histórico, com a `query` do modelo e os `filters`.
    - **`RagFilters { kinds, dateFrom, dateTo, folderLabelContains }` em `rag.rs`:** `filter_doc_ids` reduz o escopo em SQL sobre `chunks_meta` (`kind IN`, `doc_date >=/<=`), **antes** da reescrita, da busca e do rerank. O caderno ou pasta casa por trecho de `folder_label`, sem caixa e sem acentos (feito em Rust).
      - Fonte sem data fica fora quando há período.
      - Datas que não estão em ISO são ignoradas, e um período invertido é trocado.
      - Se nada passa no filtro, `nothing_relevant = true`, e a tool responde "nothing relevant found".
    - O comando `rag_retrieve` ganhou o parâmetro opcional `filters`. O RAG automático manda `null`. No `RagRequest`, `filters: None` no `rag_eval`.
  - **Fontes e numeração:**
    - `citeSource`/`ragChunkBlocks` em `rag.ts`: um documento já citado na resposta mantém o seu `[n]` e ganha os rowids novos; um documento novo continua a numeração. O `buildRagContext` passou a usá-los, com a mesma saída de antes (conferido no Node).
    - Os trechos do `search_knowledge_base` e as notas do `get_day`/`notes_by_date` viram `[n]`. As fontes são gravadas em `ragSources` da mensagem antes da 2ª rodada e aparecem em "Sources (n)", clicáveis.
    - As fontes de nota das tools têm `rowids: []`, então o "continue" não as reaproveita e cai em busca nova.
    - Se o RAG automático deu "nada relevante" e a tool achou trechos, o aviso sai da 2ª rodada, e `ragNothingFound` é limpo.
  - **Datas no fuso local:** o `currentDate` do `send()` era UTC (`toISOString`). Depois das 21h no Brasil, "hoje" virava amanhã. Agora é a data local (`dateKeyFromMs`), e a mensagem de sistema diz `Current date: YYYY-MM-DD (Weekday)`. As descrições das tools mandam resolver as datas relativas por ela (semana começa na segunda). A mesma data local vale para o roteamento web e o Deep Research, que já a recebiam. A reescrita no Rust já usava `date('now','localtime')`.
  - "Searching knowledge base..." aparece também durante o `search_knowledge_base`. Em DEV, há o log `[useChat] search_knowledge_base:` com os filtros e o trace.
  - **Como foi desenvolvido:** o Rust foi feito na cópia `src-tauri` do scratchpad (a das E9–E12), conferida idêntica ao repo antes. `rag.rs` e `examples/rag_eval.rs` foram copiados de uma vez, o que causa um único rebuild e restart do app dev.
  - **Verificado:**
    - `cargo check --examples` sem warnings, na cópia;
    - `cargo test --lib`: 23 ok e 1 ignorado. O teste novo `filters_narrow_scope_by_kind_date_and_folder` cobre tipo, período invertido, sem data, caderno sem acento, data inválida e escopo;
    - `npx tsc --noEmit` ok;
    - o SQL do Calendar foi conferido no banco dev (somente leitura);
    - o app não foi aberto e não houve commit.
  - **`rag_eval`:** o plano não define medição de roteamento, que depende do modelo de chat. Não houve mudança além de `filters: None`.
- Files changed:
  - `src-tauri/src/rag.rs`
  - `src-tauri/examples/rag_eval.rs`
  - `src/lib/rag.ts`
  - `src/hooks/useChat.ts`
  - `src/storage/index.ts`
  - `src/storage/tauri.ts`
  - `src/storage/browser.ts`
  - `src/types/index.ts` (tipo `NoteSummary`)
  - `src/components/ChatPanel/ChatToolsMenu.tsx`
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `src/components/Reader/ReaderChatPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **q29 do golden set:** o gabarito dela é a nota diária de **05/10** (com data de referência 15/10 e a nota de 15/10 aberta e excluída). O `get_day("hoje")` traz a nota de 15/10 e as notas datadas desse dia, não a de 05/10. Ou seja, a tool responde "o que tenho hoje" pelo dia, mas não "pontua" a q29 do jeito que o gabarito foi marcado. Vale o Coordenador rever esse gabarito, ou entender que a resposta esperada é "o que ficou pendente" (o que pede `notes_by_date` num período, ou o `query_tasks`).
  - O **inspetor** ("Retrieval details") continua mostrando só o trace do RAG automático. As buscas do `search_knowledge_base` só aparecem no log DEV.
  - `search_knowledge_base` passa a ser oferecida em todo turno de pasta com documentos, para modelos com tools. Com isso, esses turnos deixam de ser stream único sempre que o modelo decide chamar a tool (latência de ~3 s + 2ª rodada). Observar no teste se o modelo chama a tool à toa. A alavanca é a descrição da tool.
  - A reescrita da consulta continua ligada na chamada da tool (sem histórico). Ela custa ~1 s e ~US$ 0,0008, mas traz as keywords do FTS. Desligá-la exigiria um parâmetro novo no comando.
  - Os filtros por data das notas usam `doc_date` do chunk. Na nota, é a `date` ou, na falta, a data de criação; nos arquivos, a modificação. Para documentos, "outubro" significa "modificado em outubro".
  - Teste no app dev (vai para o teste final): "o que tenho hoje?" chama `get_day`; "notas da semana passada" chama `notes_by_date`; "procure só nas reuniões de outubro" chama `search_knowledge_base` com `kind=meeting` e o período; as fontes aparecem em "Sources (n)" com a numeração das citações.
  - O status da E13 no plano não foi alterado (fica com o Orquestrador).

### CodeAgent — implementação inicial (Etapa E14) — 20261018033213
- Summary: ícones do cabeçalho do Assistant iguais aos da `ChatSidebar` (R11) e seletor de pasta (R12).
  - **Ícones (R11):** `FileText` (documentos), `SystemPromptIcon` (prompt) e `Brain` (memória), nessa ordem, com 12px como na sidebar.
    - `aria-label`, `title` e regra de "ativo" copiados da `ChatSidebar`: documentos com contagem > 0 (`getFolderVisibleDocumentIds`, que lê a tabela do caderno nas pastas vinculadas), prompt não vazio, memória não vazia.
    - Classe nova `.iconBtnActive` (cor `--accent-ai`, como `.folderSysPromptBtnActive`). Saíram os imports `Sliders` e `Files`.
  - **Seletor (R12):** `<select>` ao lado do título "Assistant", no padrão do `convSelect` do NotesChat, listando todas as pastas de chat na ordem de `folders` (inclui as vinculadas a caderno e livro).
    - A escolha fica em `localStorage['monet:assistant-folder-id']`. Escolher a pasta `assistant` remove a chave (padrão).
    - **Pasta efetiva** = a escolhida, se existir em `folders`; senão a `assistant` (por nome). Os 3 modais (prompt, documentos e memória) e o toggle de memória do `ChatToolsMenu` passaram a operar sobre ela. O modal de documentos recebe `implicitDocumentId = notesFolderDocId(notebookId)` nas pastas vinculadas a caderno, como no `ChatPanel`, e grava por `setFolderVisibleDocuments` (que já escreve na tabela do caderno).
    - `startAssistantConversation(pastaEfetiva)` no mount e em cada `assistant-shown` (via ref, para o listener não ficar com o valor antigo).
    - **Trocar de pasta** abre um rascunho novo na pasta escolhida, com ou sem mensagens na conversa atual (decisão 4 do planner). O rascunho vazio anterior é só memória e some; uma conversa já iniciada fica na pasta dela. O select fica desabilitado durante o streaming, para não trocar a conversa ativa com um stream em andamento.
    - **Pasta escolhida apagada na main:** um efeito detecta que ela sumiu de `folders`, volta ao padrão (state e chave) e, se a conversa ativa é rascunho ou sumiu com a pasta (o `deleteFolder` apaga as conversas dela), abre um rascunho novo na `assistant`. Uma conversa existente não é tocada.
    - RAG, prompt, memória e web research já saem do `folderId` da conversa no `send()` (`containingFolder`), então não houve mudança ali. As conversas aparecem sob a pasta no Chat principal pelo `folderId` + `reconcileOrders`.
  - **`useChat.send()`, materialização no modo assistant:** se `draft.folderId` existe em `foldersRef.current`, a conversa vai para essa pasta. Senão, vale a resolução antiga por nome (`assistant`, criada se faltar).
  - **Como o `folderId` atômico e o eco da janela oculta foram preservados:**
    - O seletor **nunca** chama `setFolders` nem `setConversations`. Ele só muda estado local do `AssistantPanel`, a chave `monet:assistant-folder-id` (fora das 3 chaves que o handler de `storage` do `useChat` hidrata, então nenhuma outra janela reage a ela) e o rascunho, que vive só em memória.
    - A vinculação continua sendo gravada uma única vez, na materialização, **junto com a conversa** (`{...draft, folderId}` no mesmo `setConversations`). A lista de ordem da pasta segue cosmética e reparável pelo `reconcileOrders`.
    - A materialização só usa o `draft.folderId` se a pasta existe no estado desta janela. Se ela sumiu (apagada ou ainda não sincronizada), cai para a `assistant`: o rascunho nunca gera conversa com `folderId` pendurado por causa do seletor.
    - O efeito de "pasta apagada" não reescreve `folderId` de nenhuma conversa (regra da memória do projeto: ausência pode ser defasagem). Se a ausência for transitória, o pior caso é o seletor voltar ao padrão; nenhuma conversa muda de pasta.
    - O caminho do eco (`mergeRemoteConversations`, `lastKnownValues`, hidratação por `e.newValue`) não foi tocado.
  - **Verificado:** `npx tsc --noEmit` ok. Sem Rust (sem `cargo check`). O app não foi aberto e não houve commit.
- Files changed:
  - `src/components/AssistantPanel/AssistantPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.module.css`
  - `src/hooks/useChat.ts`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **Teste no app dev** (CP-D), incluindo o roteiro do eco entre janelas (no retorno ao Orquestrador).
  - Corrida estreita, igual à que já existe no Reader: se a pasta for apagada na main e o Assistant enviar antes de o evento `storage` chegar, a conversa nasce com o `folderId` da pasta apagada e aparece como solta na main (o vínculo não é reescrito, por regra). Não gera perda de dados.
  - Se o Assistant estiver com uma conversa iniciada numa pasta que não é apagada, trocar de pasta tira essa conversa da tela do Assistant (ela continua no Chat principal). É a decisão 4 do planner.
  - O toggle de web research da pasta no menu de tools fica para a E15 (composer), como no plano. O web research da pasta efetiva já vale no `send()`.
  - O status da E14 no plano não foi alterado (fica com o Orquestrador).

### CodeAgent — implementação inicial (Etapa E15) — 20261018033820
- Summary: o Assistant passou a usar os componentes compartilhados do Chat (R17, R18), sem código próprio de composer, bubble ou rolagem.
  - **Composer:** `ChatComposer` abaixo do histórico, com `rows={2}`. Recebe as mesmas props do `ChatPanel`:
    - `thinkingEnabled`/`toggleThinking`, `deepResearchPhase`, `webSearchActive`, `ragSearching` e `selectedModel` (visão e tools);
    - os toasts de memória e de fontes web salvas, com a mesma lógica do `ChatPanel` (`folderMemoryUpdatedAt`/`webSourcesSaved`, 4 s);
    - `activeFolder` = a pasta efetiva da E14, o que traz os toggles de memória e de **web research da pasta** (pendência da E14);
    - `resetKey = activeId`.
    - Anexos (PDF/MD/TXT/imagem), colar imagem, Deep Research, Thinking, menu de tools e Stop vêm com o composer. O `ChatToolsMenu` saiu do cabeçalho.
  - **Bubble:** `ChatMessageBubble` com `MessageSources` no `footer`. Traz tokens/s, o thinking, o copiar, as fontes e o inspetor iguais aos do Chat. Sem `onSaveToNote`: o "Save to note" fica oculto até a E16.
  - **Rolagem:** `useStickToBottom({ messages, isStreaming, activeId })`. Durante o streaming, a tela só acompanha se já estiver no fim (48px). O botão "voltar ao fim" tem o mesmo markup do `ChatPanel`, dentro de um wrapper novo (`.historyWrap`, `position: relative`) para ficar ancorado ao histórico, acima do composer.
  - **Tool Tasks no Assistant:**
    - `useChat` aceita `getTasksSnapshot?: () => TasksSnapshot | Promise<TasksSnapshot>`.
    - O Assistant passa `loadTasksSnapshot()`: `storage.getTasks()`, `getNotebooks()` e `getTaskStatuses()` em paralelo; o checklist via `storage.getNote(noteId)`, só das tasks com nota-corpo; `todayKey` = data local (`dateKeyFromMs`).
    - O item "Tasks" do menu já vinha no `ChatComposer`.
    - **Diferença em relação ao plano:** o enum de status da tool precisa dos status (inclusive os custom) já na definição das tools, antes de o modelo decidir chamar. Por isso, o snapshot é lido **uma vez por envio**, quando a tool está ligada e o modelo aceita tools, e o mesmo snapshot responde à chamada. Ele não é lido só no momento da chamada. No Chat e nas Anotações (snapshot síncrono) nada muda. Uma falha do loader só gera `console.warn` e tira a tool daquele envio. O fallback `BUILTIN_STATUS_DEFS` saiu, porque `statuses` é obrigatório no snapshot (import removido).
  - **E14 preservada:** seletor de pasta, ícones, `folderId` atômico, `startAssistantConversation(pastaEfetiva)` no mount e no `assistant-shown` (o foco usa o `inputRef` do composer) e o efeito de pasta apagada. Nenhum caminho novo grava em pastas ou conversas, e o eco da janela oculta não foi tocado.
  - **Deep Research:** fica no Assistant, por paridade. O plano não o exclui.
  - **Removido do `AssistantPanel`:**
    - `AssistantBubble`, o composer próprio (`draft`, `canSend`, `handleSend`), a rolagem incondicional por `messages` e o `ChatToolsMenu` do cabeçalho;
    - as linhas provisórias de `RagSearchStatus` (E11) e de `MessageSources` como irmã da bubble (E12);
    - os imports `openUrl`, `Stop`, `renderMarkdown`, `ChatMessage`, `ChatToolsMenu`, `RagSearchStatus` e `RagResponse`.
  - **CSS:**
    - saíram `.toolsMenu` (inversão do popover), `.bubbleUser`, `.bubbleAssistant` (+ `a`), `.streamingDots` (+ `@keyframes blink`), `.composer`, `.input`, `.actions`, `.sendBtn` e `.stopBtn`;
    - entraram `.historyWrap` e `.scrollBtn` (+ `:hover`), com tokens;
    - em `.history`, que foi tocada (`min-height: 0`), `padding` e `gap` passaram a `var(--space-3)` (o gap ia de 10px, fora da escala, a 12px).
    - Conferido por script: toda classe de `AssistantPanel.module.css` é usada no `.tsx` e vice-versa. O mesmo vale para `ChatPanel`, `ChatComposer` e `ChatMessageBubble`, que não mudaram.
  - **Verificado:** `npx tsc --noEmit` ok. Sem Rust (sem `cargo check`). O app não foi aberto e não houve commit.
- Files changed:
  - `src/components/AssistantPanel/AssistantPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.module.css`
  - `src/hooks/useChat.ts`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **Teste no app dev** (CP-D):
    - anexar PDF/MD, colar imagem, Thinking, Deep Research, Web Search, web research e memória da pasta, Tasks ("o que vence esta semana?"), Daily notes e Stop;
    - subir a tela durante o streaming: ela não volta sozinha, e o botão aparece;
    - tokens/s, thinking, copiar e "Sources (n)";
    - o "Save to note" não aparece;
    - o seletor de pasta e o `assistant-shown` continuam como na E14.
  - **Mudança de comportamento:** com `resetKey = activeId`, o texto digitado (e os anexos) é limpo quando uma conversa nova começa: ao reabrir com o Ctrl+M e ao trocar de pasta. Antes, o rascunho do Assistant sobrevivia a essas trocas. É o comportamento do Chat principal.
  - Os toasts de memória e de fontes (2 efeitos) e o efeito de modelo padrão ficaram iguais nos dois painéis. O plano pede a mesma lógica, e extrair isso não estava no escopo.
  - O CSS de `.scrollBtn` foi repetido no módulo do Assistant (CSS Modules não compartilham classe), com tokens no lugar de `bottom: 80px`/`32px`.
  - Na janela estreita, a linha de ações do composer (Deep Research, Thinking, Anexar, Tools e Send) pode ficar apertada. Isso, o gap do histórico e os espaçamentos herdados ficam para a E17.
  - O status da E15 no plano não foi alterado (fica com o Orquestrador).

### CodeAgent — implementação inicial (Etapa E16) — 20261018034357
- Summary: "Save to note" por resposta no Assistant (R14), reusando o `SaveToNoteModal`. Quem grava é sempre a janela main, por uma ponte de eventos Tauri, para a lista de notas e o Editor refletirem a mudança sem perder a edição em curso.
  - **`SaveToNoteModal`:** prop opcional `onAppendToNote(note, block)`. Quando presente, o `appendToExistingNote` a usa no lugar de compor `note.content + block` e chamar `onSaveNote`. Sem a prop, o Chat principal e a Library seguem como antes.
  - **Ponte (`src/lib/assistantNoteBridge.ts`, novo):**
    - Assistant: `createNotebookViaMain`, `createNoteViaMain` e `appendToNoteViaMain`. Cada uma registra o listener de `assistant-note-response` **antes** de `emitTo('main', 'assistant-note-request', { requestId, request })`, espera a resposta com o mesmo `requestId` e falha em 10 s ("The main window did not respond. Try again."). O erro aparece na tela de erro do modal, com "Try again".
    - Main: `onAssistantNoteRequest(handle)` atende o pedido e responde com `emitTo('assistant', …, { requestId, ok, note?, notebook?, error? })`. Devolve o cleanup síncrono (padrão do `tasksEvents.ts`).
    - Kinds: `create-notebook {name}`, `create-note {notebookId, title, content}` e `append {noteId, block}`. O payload leva o pedido em `request` (e não espalhado ao lado do `requestId`), para o TS estreitar a união pelo `kind`.
    - Sem Rust: `core:default` já inclui `emit_to`/`listen` para as 3 janelas.
  - **`App.tsx` (main):** um efeito com `onAssistantNoteRequest`:
    - `create-notebook` → `handleCreateNotebookFromChat`; `create-note` → `handleCreateNoteFromChat` (a nota nova entra no estado e no topo da ordem, então aparece na lista);
    - `append` → a versão mais recente entre `notesRef.current` e `storage.getNote(id)` (padrão do weekly review), `appendToggleToContent(current.content, block)` e `saveNote`. Se o `saveNote` falha, o erro volta ao modal. Depois emite `calendar-note-updated`, para a keep recarregar se for a nota aberta nela (mesmo motivo do weekly review).
    - **Nota aberta e em edição na main:** cada tecla do Editor já grava no estado (`updateActive` → `saveNote`), então `notesRef.current` tem o texto digitado. O append parte dele, e o `Editor` reaplica o `value` novo (`setContent`, sem `emitUpdate`). A edição feita fica, e o bloco entra no fim.
  - **`AssistantPanel`:**
    - `onSaveToNote` passado ao `ChatMessageBubble` (o copiar já existia). O clique carrega `storage.getNotebooks()` e `storage.getNoteSummaries()` (E13) e só então abre o modal, para não piscar "You have no notebooks yet". As notas viram `Note` com `content: ''` e `tags: []`; as do Calendar com título inválido ficam de fora, como no `getNotes` da main.
    - `onCreateNotebook`/`onCreateNote`/`onAppendToNote` pela ponte. O caderno criado entra na lista local do modal, para o nome aparecer no passo seguinte e no sucesso.
    - `onSaveNote` lança "Saving a whole note is not supported in the Assistant." (nunca é chamado com `onAppendToNote` presente).
    - `onNavigateToNote` ("Go to note") → `invoke('open_note_in_main', { noteId })`.
  - **Tese do produto:** só o clique do usuário no modal dispara um pedido; nada no `send()` ou nas tools grava em nota.
  - **Verificado:** `npx tsc --noEmit` ok. Sem Rust (sem `cargo check`). O app não foi aberto e não houve commit.
- Files changed:
  - `src/components/ChatPanel/SaveToNoteModal.tsx`
  - `src/App.tsx`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
- Files created:
  - `src/lib/assistantNoteBridge.ts`
- Files removed:
  - nenhum
- Left behind:
  - **Teste no app dev** (CP-D): salvar numa nota nova, numa existente e criando caderno; a nota nova na lista da main; nota aberta e em edição na main; "Go to note"; main fechada para a bandeja.
  - **Cursor no Editor:** o `setContent` troca o documento inteiro, então, se a nota alvo está aberta na main, o cursor vai para o fim da nota (onde entra o bloco) e o append entra no histórico de desfazer (Ctrl+Z na main o desfaz). Preservar a posição exigiria mexer no `Editor.tsx`, fora do plano.
  - **Janela estreita de corrida:** uma tecla na main entre o `saveNote` do append e o efeito do Editor que reaplica o valor poderia gravar o texto sem o bloco. Na prática, o usuário está clicando na janela do Assistant nesse momento.
  - **Timeout:** se a main responder depois dos 10 s, o modal mostra erro, mas a gravação acontece. Um "Try again" nesse caso duplica o bloco.
  - A ordem dos cadernos no modal do Assistant é a do banco (`updated_at`), não a ordem manual da main. O último caderno usado continua no topo.
  - O status da E16 no plano não foi alterado (fica com o Orquestrador).

### Designer — revisão de espaçamento (Etapa E17) — 20261018035028
- Summary: espaçamentos do Assistant (Ctrl+M) no padrão do Chat e na escala `--space-*` (R16). Só CSS/layout, sem mudança de comportamento.
  - **Cabeçalho** (`AssistantPanel`):
    - os 3 ícones da pasta (documentos, prompt, memória) saíram do grupo da direita e foram para **ao lado do seletor de pasta** (wrapper novo `.folderTools`). Eles configuram a pasta escolhida no seletor, então ficam junto dela, como na linha da pasta da `ChatSidebar`. Na direita ficam só o modelo e o fechar. É uma mudança de posição no JSX; handlers, `title`, `aria-label` e regra de "ativo" não mudaram;
    - `.iconBtn` com área clicável de 24×24 (`--control-sm`; antes 24×20) e glifo de 12px;
    - titlebar com 16px nas laterais (`--space-4`, antes 12px), no mesmo eixo do histórico e do composer;
    - o grupo da esquerda encolhe primeiro (o seletor trunca) e os controles da direita não encolhem. O título "Assistant" não trunca mais.
  - **Histórico** (`AssistantPanel`): `padding` de 16px nas laterais e no topo e 24px embaixo; gap de 20px entre mensagens (`--space-5`, igual ao Chat; antes 12px). `.empty`, `.errorRow` e `.keyBanner` passaram ao eixo de 16px, com tokens. O botão de voltar ao fim já estava em tokens e alinha com a borda de 16px.
  - **Composer** (`ChatComposer`, compartilhado com o Chat):
    - a linha de ações quebra para a linha de baixo só como último recurso (`flex-wrap`);
    - antes disso, com o composer abaixo de 360px de conteúdo (janela do Assistant com menos de ~392px), o botão Deep Research vira só ícone. É uma regra `@container` no `.composer`; o rótulo continua para o leitor de tela e o `title` fica. O rótulo ganhou um `<span className={styles.deepResearchLabel}>` no `.tsx`, só para isso;
    - valores trocados por tokens: `padding` do textarea (10/12 → 8/12), Send e Stop (`0 16px`, altura `--control-xl`; antes 10/18), Deep Research (gap 5 → 6, padding 10 → 12), indicadores de deep research e web search e avisos (5/10 e 5/8 → 4/8), além de alturas e raios (`--control-lg`, `--radius-md`, `--radius-lg`, `--radius-sm`).
  - **Bubble** (`ChatMessageBubble`, compartilhada com o Chat): bolha do usuário 10/14 → 12/16; `pre` 10/12 → 12; thinking 10 → 12 (margem e recuo); copiar e Save to note com raio de 6px e Save to note com 4/8 (antes 5/10); chip de documento anexado 2/7 → 2/6; imagem bloqueada 6/10 → 6/8. O canto de 3px da bolha do usuário ficou, com comentário (é o "rabicho", um nudge óptico).
  - **`MessageSources` e `RagInspector`:** sem mudança. Eles já usavam só tokens (E12) e, dentro da bubble, ficam a 4px das ações da resposta.
  - **O que muda no Chat principal** (efeito dos componentes compartilhados; cada item fica entre 1 e 4px):
    - bolha do usuário 2px maior em cada lado;
    - textarea 4px mais baixo (rows=3: ≈80 → ≈76px);
    - Send e Stop 4px mais estreitos;
    - Deep Research 3px mais largo;
    - indicadores e avisos acima do textarea 2px mais baixos;
    - thinking com 2px a mais de recuo e de margem;
    - Save to note 2px mais baixo e 4px mais estreito.
    - A regra de largura estreita nunca dispara no Chat, porque o histórico tem `min-width: 350px` e o composer fica mais largo que 360px.
  - **Verificado:**
    - `npx tsc --noEmit` ok;
    - script: toda classe de `AssistantPanel`, `ChatComposer` e `ChatMessageBubble` (`.module.css`) é usada no `.tsx` correspondente e vice-versa;
    - nas regras tocadas não sobrou valor fora da escala, só bordas de 1px, `font-size` e o canto de 3px comentado.
    - O app não foi aberto e não houve commit.
- Files changed:
  - `src/components/AssistantPanel/AssistantPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.module.css`
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/ChatPanel/ChatComposer.module.css`
  - `src/components/ChatPanel/ChatMessageBubble.module.css`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **Conferência visual no CP-E:**
    - cabeçalho: seletor, ícones e modelo na largura padrão (480px) e estreitando a janela;
    - composer: label do Deep Research some abaixo de ~392px e a linha só quebra bem mais estreita;
    - histórico e bubbles;
    - o Chat principal, pelos itens acima.
  - **Modelo com nome longo no Assistant:** o botão do `ModelSelector` (`AiPanel.module.css`, compartilhado com 4 painéis) não encolhe (rótulo até 160px). Em janela estreita, quem cede é o seletor de pasta, que trunca (no pior caso, ≈50px na janela de 480px). Resolver pede `min-width: 0` no `.selectorButton` compartilhado, fora do escopo.
  - **Alturas na linha de ações:** Deep Research, Thinking e Anexar têm 32px; o botão do `ChatToolsMenu` tem 36px e raio de 8px; Send tem 40px. Já era assim no Chat. Alinhar pede mexer no `ChatToolsMenu.module.css`, usado também nas Anotações e no Reader.
  - O status da E17 no plano não foi alterado (fica com o Orquestrador).

### Orchestrator — decisão — 20261018065500
- Summary: E1–E17 concluídas, com status FEITO nas 17 etapas do plano.
  - Verificação integral feita pelo Orquestrador:
    - `npx tsc --noEmit` ok;
    - `cargo check --examples` ok;
    - `cargo test --lib`: 23 ok, 1 ignorado.
  - Medição final (`results\20261018065417-final.json`, pipeline full com o código final):

| classe | n | recall@5 | hit@5 | MRR | MRR baseline |
|---|---|---|---|---|---|
| follow-up | 9 | 0.944 | 1.000 | 0.889 | 0.556 |
| exact-term | 8 | 1.000 | 1.000 | 1.000 | 0.719 |
| document | 11 | 0.955 | 1.000 | 0.955 | 0.773 |
| temporal | 8 | 0.875 | 0.875 | 0.875 | 0.354 |
| sweep | 5 | 0.605 | 1.000 | 0.733 | 0.517 |
| image | 6 | 0.833 | 0.833 | 0.833 | 0.583 |
| **overall** | 47 | **0.894** | **0.957** | **0.897** | **0.599** |

  - Sem falhas de reescrita ou rerank. Latência média de 3,1 s e 6,8 trechos por consulta.
- Inputs:
  - `DOCS/reports/18-10-2026/testscript_20261018065500.md`, o roteiro único dos CP-C, CP-D e CP-E.
- Decision: Etapa 1 encerrada. O Coordenador faz o teste final pelo roteiro; depois vem a Etapa 2 (`codereviewAgent` → passada final do `codeAgent`).
- Pendências para o Coordenador decidir:
  - q29 do golden set: o gabarito (nota de 05/10) não bate com o `get_day` de 15/10;
  - uma nota com credenciais em texto puro está indexada.
- Next step: Coordenador testa.

### Explorer — pastas de chat de cadernos — 20261018124928
- Summary: análise (somente leitura) do pedido do Coordenador, que está fora do Task Report: apagar a pasta de chat junto com o caderno e fazer as pastas acompanharem as conversões caderno ↔ subject.
  - **Hoje:**
    - A pasta "Notebook - <nome>" é criada sob demanda, quando a aba Chat das Anotações fica visível com o caderno (`NotesChatPanel.tsx:189-221` → `ensureScopedFolder`, `useChat.ts:1571-1629`). O vínculo fica em `localStorage['monet:notes-notebook-folder-link']` (`useChat.ts:188`, `624-692`). Subject não tem pasta de chat.
    - Ao apagar ou mover o caderno, só o vínculo é desfeito (`App.tsx:1562` e `1839`; decisão de 11-10). A pasta continua existindo, mas a `ChatSidebar` a agrupa pelo mapa de vínculos (`ChatSidebar.tsx:228-240`), então ela vai para as pastas manuais. Junto com o vínculo, ela perde o escopo do caderno (`useChat.ts:2547-2550`).
    - Os outros dados já são tratados: o RAG das notas é removido pelo diff de cadernos (`useNotesIndexSync.ts:529-553`). As linhas de `notebook_document_visibility` do caderno ficam órfãs (inofensivas).
  - **Proposta:**
    - **(a) Apagar o caderno:** apagar também a pasta e as conversas, com a contagem no confirm e a oferta da pasta web (E5) feita antes de apagar. É o mesmo precedente do livro (`Library.tsx:131-138`).
    - **(b) Caderno → subject:** levar as conversas para a pasta do caderno pai. Se o pai ainda não tem pasta, basta reapontar o vínculo e renomear. A memória é anexada; a pasta web é oferecida para apagar.
    - **(c) Subject → caderno:** nada a fazer. Não há como saber quais conversas são do subject, e a pasta nova nasce sob demanda.
    - **Apagar subject:** os chats não são afetados (correto).
  - **Riscos principais:**
    - O `useChat` do `NotesChatPanel` está montado na janela main quando o caderno é apagado. Por isso a exclusão precisa passar pela instância, e não pelo `deleteChatFolderById`, que causaria ressurreição por save-effect defasado.
    - A ordem importa: apagar a pasta antes de o caderno sair do estado faz o `NotesChatPanel` recriá-la (`NotesChatPanel.tsx:223-234`).
    - `deleteFolder` e `deleteChatFolderById` usam `folder.conversationIds` e não `conversation.folderId`.
    - O eco da janela assistant oculta, entre as gravações de conversas e de pastas, já existe hoje no "Delete folder" do Chat.
  - **Dificuldade:** Média. Cerca de 5 arquivos (`useChat.ts`, `App.tsx`, `NotebookList.tsx`, `ChatSidebar.tsx`, `documents.ts`), sem Rust obrigatório. Cabe num único `codeAgent`.
- Output: análise completa devolvida ao Orquestrador (sem report separado, por instrução).

### Orchestrator — decisão — 20261018073000
- Summary: ajuste pedido pelo Coordenador durante o teste final. A pasta de chat do caderno passa a acompanhar o ciclo de vida do caderno. Base: a sessão "Explorer — pastas de chat de cadernos".
- Decision:
  - **Coordenador, exclusão (a).** Excluir o caderno apaga a pasta de chat e as conversas.
    - Sem confirmação extra: só adaptar a frase do modal que já existe, dizendo que as conversas também serão apagadas.
    - Decisão do Orquestrador, coerente com "sem mais confirmações": a pasta web da pasta de chat (fontes web salvas por aqueles chats) é apagada junto, e a frase do modal menciona isso.
  - **Coordenador, caderno → subject (b1).** A pasta é fundida na do caderno pai e as seleções de documentos visíveis são UNIDAS (origem ∪ pai).
    - Pai sem pasta: o vínculo passa a apontar para a pasta da origem, que é renomeada.
    - Pai com pasta:
      - as conversas vão para o pai (`folderId` atômico);
      - a memória da origem é anexada com título;
      - o system prompt do pai é mantido;
      - `webResearchEnabled` = OU dos dois;
      - a pasta da origem é apagada;
      - a pasta web da origem é reatribuída ao pai, se for viável sem Rust. Senão, é apagada junto. Ver o codeAgent.
  - **Subject → caderno (c):** sem mudança.
- Next step: `codeAgent` — ajuste "pastas de chat de cadernos".

### CodeAgent — ajuste final (ajuste — pastas de chat de cadernos) — 20261018130301
- Summary: a pasta de chat do caderno passa a acompanhar o ciclo de vida dele (decisão 20261018073000).
  - **Registro de instâncias (`useChat.ts`):** `mountedChats`, em nível de módulo. Cada `useChat` montado se registra com `hasFolder`, `deleteFolder`, `mergeFolderInto` e `renameFolder`. `deleteFolder` e `mergeFolderInto` cancelam antes o turno em andamento numa conversa da pasta: a conversa do stream ou, antes do stream começar, a conversa ativa. As operações vindas de fora do chat passam por **todas** as instâncias montadas na janela. Sem instância montada, o localStorage é editado direto: `deleteChatFolderById`, ou fusão e renomeação por `loadFolders`/`saveFolders`. `deleteChatFolderById` não é chamado com uma instância montada.
  - **Novas funções exportadas:**
    - `deleteNotebookChatFolder(notebookId)`: apaga a pasta e desfaz o vínculo. Devolve o id da pasta, para a pasta web.
    - `moveNotebookChatFolder(src, dest, destName)`: destino sem pasta (ou com vínculo para uma pasta que não existe mais) → `linkNotebookToChatFolder(dest, srcFolder)` e renomeia para "Notebook - <pai>". Destino com pasta → `mergeFolderInto`. Nos dois casos, desfaz o vínculo da origem por último. Devolve o id da pasta de origem quando ela foi apagada.
    - `countNotebookChatConversations(notebookId)`.
    - `folderConversationIds(folder, conversations)`: escolhe por `folderId` **ou** por `conversationIds`, na ordem da pasta. Usado em `deleteFolder`, `deleteChatFolderById`, na fusão e na contagem do confirm da `ChatSidebar` e do `NotebookList`.
    - O nome "Notebook - <título>" saiu para `notebookChatFolderName`, compartilhado com `ensureScopedFolder`.
  - **Fusão (`mergeFolderList`):**
    - as conversas da origem vão para o topo do destino;
    - o `folderId` é trocado na mesma gravação da conversa e nunca vai para null;
    - a memória da origem é anexada sob `## Merged from "<nome da pasta de origem>"`;
    - o system prompt e o `memoryEnabled` do destino são mantidos;
    - `webResearchEnabled` = OU dos dois;
    - a origem sai da lista.
  - **Eco da janela assistant oculta:** `deleteFolder`, `mergeFolderInto` e `deleteChatFolderById` gravam `FOLDERS_KEY` **antes** de `CONVERSATIONS_KEY` (pré-gravação síncrona; o save-effect depois não regrava). Na ordem antiga, a outra janela reconciliava as conversas novas com as pastas antigas e ecoava de volta a pasta apagada. Na fusão, a outra janela recebe o destino já listando as conversas e as re-adota pelo `reconcileOrders` (sempre para o destino, nunca para null). Isso corrige também o eco do "Delete folder" do Chat, que já existia.
  - **`deleteFolder` em instância detached** agora deixa o `activeId` em null, em vez de pular para uma conversa alheia (mesmo padrão do `deleteConversation`). Sem isso, o NotesChat ficaria mostrando uma conversa qualquer depois de o caderno ser apagado.
  - **`App.tsx`:**
    - `handleDeleteNotebook`: `await removeNotebook` → `deleteNotebookChatFolder` → `deleteChatWebFolder`. As linhas de `notebook_document_visibility` do caderno já eram limpas pelo `useNotebooks.remove` (`replaceNotebookVisibility(id, [])`), então não houve mudança ali.
    - `handleMoveNotebook`: guarda para o Calendar como origem e para o destino inexistente. A união das seleções (origem ∪ destino, sem as pastas de notas implícitas `notes-folder:<origem|destino>`) é gravada no destino **antes** do `removeNotebook`, que apaga a seleção da origem. Depois vem `moveNotebookChatFolder`, e então `deleteChatWebFolder` da pasta de origem, se ela foi fundida.
  - **Pasta web da origem na fusão:** **não** foi reatribuída. O dono da pasta web é o caminho `web-research/<chatFolderId>` (`documents_ensure_ai_folder` e o bibliotecário resolvem por ele). Mudar o dono exigiria Rust (mover a pasta ou trocar o `original_path`). Por isso ela é apagada junto. O `documents_delete_watched_folder` já remove as linhas de visibilidade dela, inclusive as que a união levou para o destino. Quando o destino não tem pasta, a pasta de chat da origem continua viva e a pasta web vai junto, sem perda.
  - `documents.ts`: `deleteChatWebFolder(chatFolderId)`.
  - `NotebookList`: o confirm de exclusão acrescenta "Its chat (N conversations) and the web sources saved by it will also be deleted." quando o caderno tem pasta de chat. Sem confirmação extra.
  - `ChatSidebar`: a contagem do confirm do "Delete folder" usa `folderConversationIds`.
  - **Fora do escopo, sem mudança:** pastas de livro e do Reader, pastas manuais, Calendar, Inbox (já protegido nos dois handlers) e subject → caderno.
  - Verificado: `npx tsc --noEmit` ok. O app não foi aberto e não houve commit.
- Files changed:
  - `src/hooks/useChat.ts`
  - `src/App.tsx`
  - `src/lib/documents.ts`
  - `src/components/NotebookList/NotebookList.tsx`
  - `src/components/ChatPanel/ChatSidebar.tsx`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - Teste no app dev com a assistant viva (roteiro no retorno ao Orquestrador).
  - A pasta web da origem é apagada na fusão; a reatribuição exigiria Rust.
  - Um turno em andamento **na janela assistant** numa conversa da pasta apagada não é cancelado: o cancelamento só alcança as instâncias da janela main. A conversa some da assistant pelo `storage`. Se o bibliotecário rodar no fim desse turno, pode criar uma pasta web órfã, que aparece com o selo "Orphan".
  - Mover o caderno **ativo** com a aba Chat visível: durante os `await`, a nota ativa já está no destino, e o NotesChat pode criar a pasta do destino antes da fusão. O resultado é a fusão numa pasta nova e vazia (o mesmo conteúdo, com a memória sob o título "Merged from").
  - Depois da fusão, o espelho de visibilidade do `useChat` (badge de documentos) pode contar a pasta web apagada até o próximo `focus`, porque o delete em Rust não dispara o evento de visibilidade. O `send()` relê a tabela a cada envio.

### Orchestrator — decisão — 20261018133000
- Summary: ajustes de Tasks pedidos pelo Coordenador, fora do escopo do Task Report e registrados aqui como ajuste extra desta branch:
  1. Nas visões de Tasks que não são List (Kanban, Week etc.), clicar numa task abre um modal de edição, em vez de trocar para a visão de lista.
  2. Na visão List, remover o card de cada task, que não está dando boa visualização.
  3. Na visão List, o status passa para baixo do nome da task.
- Decision: um único `codeAgent`, reusando o editor/detalhe de task que já existe dentro do modal, sem duplicar. Os ajustes entram no roteiro de teste final.
- Next step: `codeAgent` — ajuste de Tasks.

### CodeAgent — ajuste — Tasks: modal e List sem card — 20261018133500
- Summary:
  - **Modal nas visões que não são List** (Week, Kanban, Projects, Groups, My Day, Review):
    - `TaskEditorModal` novo: portal com backdrop, botão de fechar (X), clique fora fecha, Esc fecha.
    - O Esc vem de um listener no `document`, porque um input que trata Esc e se desfoca deixa o foco no body. Ele não fecha quando o Esc é de um campo (`input/textarea/select`), quando o evento já foi tratado (`defaultPrevented`, ex.: autocomplete do editor) ou quando há outro `aria-modal` por cima (confirmação, Manage properties).
    - Ao abrir, o foco vai para o card do modal, para as teclas do quadro (`useTaskKeyboard`) não agirem na task de trás.
    - Sem duplicar o editor: o JSX do `Editor` com a `TaskPropertiesBar` (topSlot) saiu do layout para a constante `noteEditor` no `App.tsx`, renderizada no slot ao lado da List ou dentro do modal. As alterações persistem pelo mesmo caminho da List.
    - `App.tsx`: estado `taskModalId` + `openTaskModal(task)` (marca o id e chama o `selectTask` de sempre). O modal aparece com `tasksBoardOpen && activeTask?.id === taskModalId`. Um efeito limpa o id quando sai do quadro (List, foco, navegação), para o modal não reaparecer sozinho.
    - Código morto removido: os três `onOpenTask` inline que faziam `setTasksMainView('list')` + `selectTask` (boardProps, WeekBoard, WeeklyReview). O `openTask` continua: é usado por Calendar, DueTodayBlock e pelo evento `open-task` da keep, que não vêm de um quadro.
    - Clique ≠ arraste: já era garantido pelo `useCardDrag` (limiar de 4px e o click após o drag é engolido). Checkbox e ações já param a propagação. Nada mudou ali.
  - **List sem card:** a aparência vinha do `.card` do `TaskCard.module.css`, compartilhado por todas as visões. Só a List mudou, com a classe nova `.listRow` (aplicada quando `list`):
    - sem fundo, sem borda e raio 0, com fio `--hair` embaixo;
    - padding vertical `--space-2`;
    - hover `--surface-1`;
    - seleção = fundo do hover + filete laranja de 2px à esquerda (`::before`);
    - anel do cursor de teclado por dentro (`inset`).
    - Em `TasksView.module.css`, as linhas ficam encostadas (sem gap em `.group`/`.subgroup`) e o gap entre seções foi para `--space-4`.
  - **Status embaixo do título (List):** na List, a faixa `.top` não é renderizada. O status vira `.statusTag` (o mesmo bloco sólido, na altura da linha) no início da linha de metadados, antes de "Projeto | group". O deadline fica à direita da linha do título (o título tem `flex: 1` e `line-height: var(--lh-row)`). `.blockFixed` saiu (sem uso). Status, ações e deadline viraram constantes no `TaskCard`, reusadas nas duas posições.
  - **Ações fixas na List (novo pedido do Coordenador):** os ícones Sun, Snooze e Delete saíram da linha do título e ficam no fim da linha de metadados (status | projeto | group), à direita.
    - Estão sempre no layout (`.listRow .action` com `display: inline-flex`), com opacidade 0.45 fora do hover e 1 no hover/foco; o Sun de "planejada para hoje" fica sempre com opacidade 1.
    - A margem vertical de -4px faz o botão de 24px ocupar 16px no fluxo, dentro da linha de metadados de 11px. Assim a altura da linha e a largura do título não mudam em nenhum estado (hover, seleção, cursor).
    - Kanban, Week e as outras visões não mudam (as regras só valem com `.listRow`).
  - Verificado: `npx tsc --noEmit` ok; nenhuma classe órfã ou faltando em `TaskCard`, `TasksView` e `TaskEditorModal`. O app não foi aberto e não houve commit.
- Files changed:
  - `src/App.tsx`
  - `src/components/TasksView/TaskCard.tsx`
  - `src/components/TasksView/TaskCard.module.css`
  - `src/components/TasksView/TasksView.module.css`
- Files created:
  - `src/components/TasksView/TaskEditorModal.tsx`
  - `src/components/TasksView/TaskEditorModal.module.css`
- Files removed:
  - nenhum
- Left behind:
  - Validação visual no app dev (roteiro no retorno ao Orquestrador).
  - Esc com o foco no título da nota (input) não fecha o modal; fecha com o clique fora, com o X ou com Esc depois de sair do campo.
  - Ao fechar o modal, o foco não volta ao card do quadro (para navegar pelo teclado, clique no quadro).
  - Depois de fechar, a nota da task continua como nota ativa; ao trocar para List, ela aparece selecionada.

### Orchestrator — decisão — 20261018140000
- Summary: ajuste de Tasks pedido pelo Coordenador: as tasks marcadas com o sol ("Add to today", `plannedDay` = hoje) passam a aparecer também no filtro Today (chip de resumo).
- Decision:
  - Mudança de 1 linha, feita pelo próprio Orquestrador, sem codeAgent, em `summaryMatches('today')` (`src/lib/tasks.ts`).
  - O filtro passa a ser: aberta E (`plannedDay` = hoje OU (não atrasada E plano = hoje)).
  - As marcadas entram mesmo atrasadas, porque foi escolha explícita do usuário.
  - A contagem do chip acompanha, via `computeTaskSummary`.
  - A seção "Today" do agrupamento por data na List não foi alterada (não foi pedido).
  - `npx tsc --noEmit` ok.
- Next step: Coordenador testa.

### Orchestrator — decisão — 20261018141500
- Summary: ajuste de Tasks pedido pelo Coordenador: "Clear" no Deadline zera a contagem "Postponed N×". Uso típico: recomeçar depois de pôr uma data errada.
- Decision:
  - Feito pelo Orquestrador em `applyTaskPatch` (`src/lib/tasks.ts`): `dueDate` de um valor para `null` deixa `rescheduleCount = 0`.
  - O contador é compartilhado com o adiamento do Do date. Limpar o Do date continua sem zerar, porque não foi pedido.
  - `npx tsc --noEmit` ok.
- Next step: Coordenador testa.

### Orchestrator — decisão — 20261018143000
- Summary: ajuste de Tasks pedido pelo Coordenador: os controles do cabeçalho (seletor de view, engrenagem, seletor de projeto) mudavam de posição ao trocar de visão, porque a largura muda (List × Kanban).
- Decision: `.titleRow` em `TasksHeader.module.css` passou de `justify-content: space-between` para `flex-start`. Os controles ficam colados à esquerda, na mesma posição em todas as visões. Feito pelo Orquestrador (só CSS).
- Next step: Coordenador testa.

### Orchestrator — decisão — 20261018150000
- Summary: o Coordenador pediu a review de todas as atividades. Isso encerra a Etapa 1 (desenvolvimento) e abre a Etapa 2 (revisão).
- Decision:
  - O diff é grande (~60 arquivos, mais de 3.700 linhas alteradas e módulos novos). Por isso a revisão foi dividida em 3 `codereviewAgent` paralelos, por área, cada um com o seu report:
    - **R1, backend RAG/Rust:** `rag.rs`, `documents.rs`, `vec_db.rs`, `ocr.rs`, `lib.rs`, examples, Cargo.
    - **R2, Chat/Assistant/RAG no frontend:** `useChat`, os componentes do ChatPanel, AssistantPanel, NotesChat, Reader, KB modal, `lib/rag.ts`, `imageOcr`, `noteFileText`, `assistantNoteBridge`, Settings, e o ajuste das pastas de chat de cadernos.
    - **R3, Tasks e App:** TasksView (modal, List sem card, ícones, header, filtro Today, reset do postponed), `App.tsx` (exclusão e movimentação de cadernos, ponte de notas), `NotebookList`, `storage`.
  - Depois, um único `codeAgent` lê os 3 reports e faz a passada final.
- Next step: R1, R2 e R3 em paralelo.

### CodeReviewAgent — R1 backend RAG/Rust — 20261018135656
- Summary: review do backend Rust do RAG: `rag.rs`, `ocr.rs`, `documents.rs`, `vec_db.rs`, `lib.rs`, Cargo e os 2 examples.
  - `cargo check --examples` sem warnings. `cargo test --lib`: 23 ok e 1 ignorado.
  - Sem crítico.
  - 4 importantes:
    - I1: o embedding da consulta não tem timeout, e o backoff de 429 trava o chat por mais de 60 s;
    - I2: o `rag_get_chunks` ("continue") ignora o escopo, e os rowids de `chunks_meta` são reaproveitáveis;
    - I3: corrida entre `cleanup_stuck_indexing` e o scan de startup, que pode apagar o `doc_index_state` de um documento recém-indexado;
    - I4: o `run_indexing` grava os chunks de um documento apagado durante o embedding (órfãos).
  - 15 nits: reqwest client por chamada, FTS sem fallback, limites e diagnóstico do OCR, `ocr_cached` síncrono, ramo morto, duplicações e testes de integridade.
  - Conferidos sem problema: troca atômica dos chunks + FTS + `doc_index_state`; sanitização do MATCH; `documents_open_file` só por id; `clone_prod_to_dev` nunca escreve na produção; nenhuma chave em log; nenhum lock atravessa `await`.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/18-10-2026/reviewreport_20261018135656_r1-backend.md`

### CodeReviewAgent — R3 Tasks, App e cadernos — 20261018135755
- Summary: revisão de TasksView (modal, List sem card, ícones fixos, cabeçalho), `lib/tasks.ts` (filtro Today, reset do Postponed), `App.tsx` (exclusão e movimentação de cadernos, `noteEditor`/`taskModalId`, ponte de notas, OCR no contexto efêmero), `NotebookList` e `storage`. `npx tsc --noEmit` ok. Sem montagem dupla do Editor, sem classe órfã e com a ordem de exclusão e movimentação correta no caminho normal.
  - **4 [importante]:**
    - a ponte de notas não é idempotente: um "Try again" depois do timeout duplica o append, a nota ou o caderno;
    - quando o `removeNotebook` falha (ele engole o erro), a exclusão segue e apaga a pasta de chat e as conversas;
    - um Esc no Manage properties aberto de dentro do modal provavelmente fecha os dois modais;
    - o `create-note` da ponte informa sucesso mesmo quando o `saveNote` falha.
  - **12 [nit].**
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/18-10-2026/reviewreport_20261018135755_r3-tasks-app.md`

### CodeReviewAgent — R2 (Chat, Assistant e RAG no frontend) — 20261018135827
- Summary: revisão do frontend de Chat, Assistant e RAG. Nenhum crítico. A arquitetura está correta: `folderId` atômico, pastas gravadas antes das conversas, fontes compactas e trace em memória. Quatro importantes:
  - I1: depois de apagar na main a pasta escolhida no Assistant, a próxima mensagem nasce solta, porque o `activeId` fica `null` e o `send()` cria uma conversa solta;
  - I2: o aviso "nada relevante" continua na 2ª rodada quando quem acha conteúdo são `get_day`/`notes_by_date`;
  - I3: o Stop entre a checagem pós-RAG e o início do stream é ignorado (`hasTavilyKey` e o snapshot de tasks do Assistant);
  - I4: a duplicação que sobrou entre `AssistantPanel` e `ChatPanel` (efeito de modelo, toasts, `streamingMessageId` e o botão/CSS de voltar ao fim).

  Onze nits, entre eles: ponte de notas com `listen` global e sem validação do pedido, retry da ponte duplicando o bloco, esquema da URL em `openRagSource`, renumeração no "continue" e `folderConversationIds` aceitando a lista de ordem. `npx tsc --noEmit` ok; sem classes CSS órfãs.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/18-10-2026/reviewreport_20261018135827_r2-chat.md`

### Orchestrator — decisão — 20261018143500
- Summary: os 3 reviews concluíram "APROVADO COM RESSALVAS", sem críticos: R1 com 4 importantes e 15 nits, R2 com 4 e 11, R3 com 4 e 12.
- Decision:
  - **Passada final em 2 `codeAgent`, sequenciais**, para não haver edição concorrente em `useChat.ts`:
    - **F1, backend:** importantes do R1. O I2 (`rag_get_chunks` com escopo) inclui ajustar a única chamada no frontend. Os nits ficam a critério do agente.
    - **F2, frontend:** importantes do R2 e do R3, mais nits a critério.
  - **Ficam fora** (registrar como pendência):
    - `/docs` na busca antiga: não fazia parte do R4;
    - Today × Week para tasks do sol sem data ou com data futura;
    - visibilidade de terceiros ao mover caderno;
    - a migração do `useChat.ts` para módulos (N9).
- Next step: F1 → F2 → encerramento.

### CodeAgent — ajuste final (F1, backend pós-review R1) — 20261018141659
- Summary: os 4 importantes do R1 resolvidos, mais os nits de robustez e de limpeza simples. Feito na cópia `src-tauri` do scratchpad (conferida idêntica ao repo antes). Os 4 `.rs` foram copiados de uma vez, o que causa um único rebuild do app dev. O app não foi aberto e não houve commit.
  - **I1, embedding da consulta:**
    - o `embed_query` tem timeout de 10 s (`EMBED_QUERY_TIMEOUT`) e no máximo 1 retry num 429;
    - o `embed_batch` recebe o teto de retries como parâmetro: a indexação continua com 5 (`INDEX_RATE_LIMIT_RETRIES`);
    - vale para o chat, para o `/docs` (`embed_text`) e para o `rag_eval`;
    - num timeout, o `retrieve` devolve `Err`, e o frontend já segue sem RAG.
  - **N1, cliente HTTP:** `documents::http_client()` (`OnceLock`, `connect_timeout` de 10 s e `timeout` de 60 s), usado pelo embedding, pela reescrita e pelo rerank. Os streams do chat em `lib.rs` não usam esse cliente, porque o timeout total cortaria a resposta. Com isso, o rerank do Deep Research (bug extra do R1) também fica com um teto de 60 s.
  - **I2, "continue" com escopo:**
    - `rag_get_chunks(scope, rowids)` resolve o escopo com o mesmo `resolve_scope` do `rag_retrieve` (`RagScope::resolve`, sem duplicar a chamada);
    - o `get_chunks` descarta os chunks de documentos fora do escopo. Isso cobre a visibilidade que mudou, as pastas `ai` com o web research desligado, o rowid reaproveitado vindo de outro escopo e a nota aberta (`excludeNoteId`);
    - **frontend (única mudança):** `ragGetChunks(scope, rowids)` em `src/lib/rag.ts`, e a chamada em `useChat.ts` passa o `ragScope`. O filtro local da nota aberta saiu, porque o backend já a exclui.
  - **I3, cleanup × scan:**
    - em `lib.rs`, uma única task roda o `cleanup_stuck_indexing` e só depois o `scan_all_watched_folders_on_startup`;
    - no cleanup, `release_stuck` faz `UPDATE ... WHERE id = ? AND status = 'indexing'`, e só quando mudou (com chunks) o `doc_index_state` é apagado;
    - **N9:** `status_after_index_failure` foi separado em `has_chunks` + `mark_outdated` (sobre `&Connection`), mais os wrappers `status_for_failed_index` e `mark_outdated_logged`. O comportamento das outras falhas não mudou.
  - **I4, órfãos:**
    - antes do `replace_chunks`, o `run_indexing` confere `document_exists` no `monet.db`;
    - se o documento sumiu, sai sem gravar e devolve `true`, porque no Update index um apagado não é falha, como no `claim_for_reindex`;
    - **sem** comparar o `original_path`: nenhum fluxo do app troca o caminho, e um caminho diferente com a linha presente deixaria o documento preso em `indexing`.
  - **Nits:**
    - **N2:** se o FTS falhar, o `hybrid_search` segue só com o KNN e registra um `eprintln!`;
    - **N3:** o OCR tem teto de 20 MB de base64 e de 25 MP. Acima disso, devolve texto vazio, que vai para o cache, como já acontecia acima do `MaxImageDimension`. A falha do engine agora gera log com o `HRESULT`;
    - **N4:** `ocr_cached` virou `async`;
    - **N6:** `documents_open_file` recusa `origin = 'notes'`;
    - **N7:** `PendingDoc.original_path` virou `String`, e o ramo morto "File path missing" saiu;
    - **N8:** a `truncate_chars` do `rag.rs` virou `trim_to_chars`;
    - **N9 (scan):** o reindex de arquivo modificado tem a guarda `AND status != 'indexing'`. Se o documento já estiver indexando, o scan não dispara um 2º `run_indexing`, e o próximo scan pega a mudança;
    - **N13 (parte simples):** o `knn_search` usa o helper `placeholders()`.
  - **N15, testes novos (6):**
    - `replace_and_delete_keep_vectors_fts_and_state_in_sync`: `vec_chunks`, `chunks_fts`, `chunks_meta` e `doc_index_state`, com o `ensure_fts` sem refazer depois de cada escrita. Para isso, extraí `replace_chunks_conn` e `delete_chunks_conn`;
    - `failed_index_with_chunks_stays_searchable_and_pending`;
    - `indexing_result_is_dropped_for_deleted_documents`;
    - `release_stuck_only_touches_documents_still_indexing`;
    - `get_chunks_drops_rowids_outside_the_scope`;
    - `hybrid_search_falls_back_to_knn_when_fts_fails`.
  - **Verificado:**
    - `cargo check --examples` sem warnings;
    - `cargo test --lib`: 29 ok e 1 ignorado. O OCR real (`-- --ignored`) também passa;
    - `npx tsc --noEmit` ok.
  - **`rag_eval -- run --label post-review --pipeline full`** (somente leitura, `results\20261018171240-post-review.json`):

| classe | n | recall@5 | hit@5 | MRR |
|---|---|---|---|---|
| follow-up | 9 | 0.778 | 0.778 | 0.722 |
| exact-term | 8 | 0.938 | 1.000 | 1.000 |
| document | 11 | 0.773 | 0.818 | 0.773 |
| temporal | 8 | 0.875 | 0.875 | 0.875 |
| sweep | 5 | 0.605 | 1.000 | 0.733 |
| image | 6 | 0.833 | 0.833 | 0.833 |
| **overall** | 47 | **0.809** | **0.872** | **0.823** |

  - **Comparação com `20261018065417-final`** (MRR 0.897, hit 0.957, recall 0.894):
    - a queda vem da **base dev, que mudou** desde a medição final, e não do código;
    - q06 e q07 agora têm escopo vazio: as pastas e os documentos esperados não existem mais no `monet.db` dev. A q19 também avisa escopo vazio;
    - para isolar, rodei o **código anterior** (cópia do repo antes desta passada) sobre a mesma base: `results\20261018171627-baseline-precheck.json` dá MRR 0.821, hit 0.872 e recall 0.805;
    - código novo × anterior na mesma base: MRR +0.002, hit igual e recall +0.004, dentro do ruído. **Sem regressão.**
- Files changed:
  - `src-tauri/src/documents.rs`
  - `src-tauri/src/rag.rs`
  - `src-tauri/src/ocr.rs`
  - `src-tauri/src/lib.rs`
  - `src/lib/rag.ts`
  - `src/hooks/useChat.ts` (só a chamada de `ragGetChunks`)
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **N5:** o cache do OCR continua sem idioma nem versão. Guardar o idioma exige uma coluna nova em `image_ocr_cache` (schema). Fica aceito: instalar um idioma depois não reprocessa as imagens já lidas.
  - **N10:** a limitação do `ensure_fts` (o mesmo rowid com conteúdo divergente só aparece num downgrade) foi aceita, sem mudança.
  - **N11:** o `include_trace` no `rag_retrieve` mexe no frontend (o inspetor), que é do F2.
  - **N12:** a duplicação nos examples (`utc_timestamp`, `ensure_dev` e o pipeline `hybrid`) e o `retrieve_baseline` na lib ficaram como estão. Não há risco, e o `hybrid` serve de histórico de medição.
  - **N13 (resto):** unificar `knn_search` com `knn_rowids`, unificar o filtro de vizinhos e `Candidate`/`RagCandidate` é uma refatoração maior, e o `/docs` usa o `knn_search`.
  - **N14:** `cfg(windows)` mexe no `Cargo.toml` (dependências). Só faz sentido se outra plataforma for adiante.
  - **I4 (opcional do review):** a varredura de órfãos no startup ficou de fora. Há uma janela residual entre o `document_exists` e o `replace_chunks`, porque o `documents_delete` apaga os chunks antes da linha. Os órfãos que restarem nunca entram no escopo.
  - **Bug extra do R1:** o status preso em `indexing` quando falha o `update_document_status` final do `run_indexing` é anterior à task e não foi mexido.
  - **Golden set:** q06 e q07 (e q19) apontam para documentos que não existem mais na base dev. Para o eval voltar a ser comparável com o `final`, o gabarito precisa ser revisto ou a base precisa ser reclonada.
  - No scratchpad (fora do repo) ficaram a cópia `f1base/src-tauri`, usada só para a medição de controle, e os scripts `f1_*.py`.

### Orchestrator — decisão — 20261018180000
- Summary: decisões do Coordenador sobre os nits do R3.
- Decision:
  - **Today × Week:** as tasks marcadas com o sol (`plannedDay` = hoje) passam a aparecer nos dois filtros.
    - `summaryMatches('week')` em `src/lib/tasks.ts` inclui `plannedDay === todayKey`.
    - O `weekTotal` (denominador da barra da semana) conta essas tasks sem duplicar.
    - Feito pelo Orquestrador; `npx tsc --noEmit` ok.
  - **Cabeçalho de Tasks andando alguns px** (o rótulo do seletor de view muda de largura): aceito pelo Coordenador, sem mudança.
- Next step: aguardar o F2.

### CodeAgent — ajuste final (F2, frontend pós-review R2/R3) — 20261018143043
- Summary: os 4 importantes do R2 e os 4 do R3 resolvidos, mais os nits priorizados pelo Orquestrador. Sem Rust (o N11 do R1 ficou de fora). `npx tsc --noEmit` ok; nenhuma classe CSS órfã ou faltando nos `.module.css` tocados (script). O app não foi aberto e não houve commit.
  - **R2-I1, Assistant sem conversa solta:** efeito novo no `AssistantPanel`: com `activeId` null (mount, ou a conversa exibida/da pasta escolhida apagada na main), abre um rascunho na pasta efetiva (`startAssistantConversation(folderIdRef.current)`). Não grava nada. O mount deixou de criar o rascunho por conta própria (só o `ensureAssistantFolder`); o efeito "pasta escolhida apagada" continua cobrindo o rascunho na pasta X. `folderId` atômico e a ordem pastas→conversas não foram tocados.
  - **R2-I2:** `kbFound` saiu; `toolFound = sources.length > turnRagSources.length` decide a gravação das fontes na mensagem (com `ragNothingFound: undefined`) e a exclusão do aviso "nada relevante" da 2ª rodada. Vale para `search_knowledge_base`, `get_day` e `notes_by_date`.
  - **R2-I3:**
    - o `activeStreamRef` já era preenchido antes do `hasTavilyKey`/snapshot, então um Stop nesse intervalo limpava o turno, mas o stream começava assim mesmo (e o handler de tool era re-registrado). Agora, logo antes do registro do handler e do stream: `if (activeStreamRef.current?.requestId !== requestId) return` — cobre o Stop e um envio novo que tenha assumido;
    - `TasksSnapshot.checklist` aceita um loader (`() => Promise<Map>`), lido só na chamada de `query_tasks`. O Assistant passa o loader (N+1 `getNote` só quando a tool é chamada); Chat e Anotações continuam com o `Map` em memória.
  - **R2-I4:** `ScrollToBottomButton` (`ChatPanel/`, com CSS próprio; a posição fica no `.scrollBtn` de cada painel) e `useChatPanelState` (`src/hooks/`): modelo padrão, `selectedModel`, `streamingMessageId` e os 2 toasts. `ChatPanel` e `AssistantPanel` usam os dois.
  - **R3-I1 + R2-N2, ponte idempotente:**
    - `SaveToNoteModal` gera um `requestId` por ação e o "Try again" reenvia o mesmo, com o mesmo bloco (antes o timestamp do bloco também mudava). Na criação de caderno, repetir o mesmo nome depois de uma falha reaproveita o id;
    - os callbacks do modal ganharam o `requestId` como último parâmetro (o Chat principal ignora);
    - `createNotebookViaMain`/`createNoteViaMain`/`appendToNoteViaMain` recebem o `requestId`;
    - main: `Map<requestId, Promise<resultado>>` no módulo (sobrevive a re-registro do listener), limite de 50; id repetido recebe o resultado do 1º (ou espera por ele); pedido que falhou sai do mapa e pode ser refeito.
  - **R3-I2:** `useNotebooks.remove` devolve `boolean`; `handleDeleteNotebook` e `handleMoveNotebook` param se falhar (sem apagar/mover a pasta de chat, conversas, fontes web nem notas).
  - **R3-I3:** `MetadataManagerModal` e `StatusManagerModal` chamam `preventDefault` no Esc; o `TaskEditorModal` já ignora `defaultPrevented`.
  - **R3-I4:** `handleCreateNoteFromChat` lança "Failed to save note." quando o `saveNote` falha (ponte e Chat principal).
  - **Nits feitos:**
    - **R2-N1 (parte):** a main valida o pedido (`kind` conhecido e campos `string`) e ignora o inválido. O `listen` por janela **não** foi feito: no Tauri 2.10 um `emit` global chega a todos os listeners, qualquer que seja o alvo (`manager/mod.rs`: `emit` sem filtro), então não restringiria nada;
    - **R2-N3:** `openRagSource` só abre `^https?://`; outra `url` cai no `documents_open_file`;
    - **R2-N5:** `folderConversationIds(folder, conversations, folders)`: da lista de ordem só entram conversas com `folderId` undefined ou de pasta inexistente (como no `reconcileOrders`). Os 6 chamadores passam as pastas (inclui `ChatSidebar`);
    - **R2-N6:** `useRagDetailed` só reage a `storage` da chave do modo (ou `key` null);
    - **R2-N7:** `ChatMessageBubble` não mostra o footer (Sources/inspetor) em resposta "Error: …";
    - **R2-N11:** `listChatFolderIds()` devolve `null` se a lista gravada não puder ser lida; o KB não marca nenhuma órfã nesse caso. O `useMemo` não se aplica: o cálculo fica depois do `if (!open) return null`, então só roda com o modal aberto;
    - **R3-7:** guarda do Calendar no `handleDeleteNotebook`;
    - **R3-9:** confirm sem "0 conversations" ("Its chat folder and any web sources saved from it…") e com "any web sources" no lugar de afirmar que existem;
    - **R3-10:** `FormattingToolbar` escuta o Esc em captura e chama `preventDefault` só com a barra visível (editor focado, com seleção ou em tabela, fora de `linkedNoteBlock`); o cancelamento do arraste em `CommandExtension` (2 lugares) também em captura, com `preventDefault` só durante o arraste. Captura porque esses listeners podem ser registrados depois do listener do modal no `document`.
- Files changed:
  - `src/hooks/useChat.ts`
  - `src/hooks/useRagDetailed.ts`
  - `src/hooks/useNotebooks.ts`
  - `src/lib/rag.ts`
  - `src/lib/assistantNoteBridge.ts`
  - `src/App.tsx`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.module.css`
  - `src/components/ChatPanel/ChatPanel.tsx`
  - `src/components/ChatPanel/ChatPanel.module.css`
  - `src/components/ChatPanel/ChatSidebar.tsx`
  - `src/components/ChatPanel/ChatMessageBubble.tsx`
  - `src/components/ChatPanel/SaveToNoteModal.tsx`
  - `src/components/KnowledgeBaseModal/KnowledgeBaseModal.tsx`
  - `src/components/NotebookList/NotebookList.tsx`
  - `src/components/TasksView/MetadataManagerModal.tsx`
  - `src/components/TasksView/StatusManagerModal.tsx`
  - `src/components/Editor/FormattingToolbar.tsx`
  - `src/components/Editor/CommandExtension.ts`
- Files created:
  - `src/hooks/useChatPanelState.ts`
  - `src/components/ChatPanel/ScrollToBottomButton.tsx`
  - `src/components/ChatPanel/ScrollToBottomButton.module.css`
- Files removed:
  - nenhum
- Left behind:
  - **Fora do escopo (decisão do Orquestrador):** `/docs` na busca antiga, visibilidade de terceiros ao mover caderno, quebra do `useChat.ts` (R2-N9).
  - **R1-N11 (`include_trace`):** não feito. É desempenho de IPC local (~160 KB por mensagem), exige Rust + frontend e não tem efeito visível.
  - **R2-N4** (renumeração no "continue"; o filtro de escopo já veio com o F1), **R2-N8** (3 normalizadores), **R2-N10** (OCR sem feedback): não feitos; só se o teste mostrar problema.
  - **R3-11** (focus trap), **R3-12** ("Ask AI" atrás do backdrop), **R3-14** (fio duplo/paradas de Tab na List), **R3-15** (dois `append` seguidos), **R3-16** (OCR das notas vinculadas): não feitos.
  - **R3-I2, resíduo:** com a falha do banco, o caderno sai do estado (otimista) e volta no próximo load, como antes; o handler só não apaga mais o resto.
  - **Main sem ponte:** um "Try again" no Chat principal depois de o `createNote` gravar e o `saveNote` falhar cria outra nota (o `createNote` já persistiu a vazia). Sem mudança.

### Orchestrator — decisão — 20261018183000
- Summary:
  - F2 concluída; verificação integral do Orquestrador: `tsc` ok, `cargo check --examples` ok, `cargo test --lib` com 29 ok e 1 ignorado.
  - O Coordenador apontou uma funcionalidade pedida antes e que não chegou ao Task Report: um botão de print de tela no Assistant. Ela não está em nenhum documento da task; foi falha de registro do Orquestrador.
- Decision: implementar, por pedido explícito do Coordenador.
  - Botão no canto inferior esquerdo do composer, **só no Assistant**. O clique anexa ao chat um print da **tela inteira, sem a janela do Assistant**. O usuário escreve a pergunta e envia.
  - **Técnica:**
    - `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` na janela assistant (sem flicker);
    - fallback: esconder a janela, capturar e mostrar de novo;
    - captura GDI do monitor onde está o Assistant (decisão do Orquestrador para multimonitor);
    - encode via `Graphics_Imaging` (WinRT), que já está no projeto.
  - **Dependências:** só features extras na crate `windows` já aprovada; nenhuma crate nova.
- Next step: `codeAgent` — print de tela no Assistant.

### CodeAgent — implementação inicial (print de tela no Assistant) — 20261018143844
- Summary: botão "Attach screenshot" no composer, só no Assistant. Ele anexa um print do monitor onde está o Assistant, sem a janela dele, como imagem colada. Nada é enviado sozinho.
  - **`src-tauri/src/screenshot.rs` (novo), comando `capture_screen_without_assistant`** (`spawn_blocking`):
    - `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` na thread da janela (`run_on_main_thread`). A exclusão vale **só durante a captura**: espera 100 ms, captura e volta a `WDA_NONE`. Não foi aplicada na criação da janela, para o Assistant continuar aparecendo em compartilhamento de tela, gravações e na Ferramenta de Captura;
    - fallback (a chamada falha, ex.: Windows anterior ao 10 2004): `hide`, espera 150 ms, captura, `show` e `set_focus`;
    - captura GDI do monitor da janela (`MonitorFromWindow` + `GetMonitorInfoW`, coordenadas físicas): `GetDC`, `StretchBlt` (`HALFTONE`) e `GetDIBits` em BGRA. O `StretchBlt` faz a cópia e a redução de uma vez: lado maior até 2000 px, na proporção;
    - encode JPEG via WinRT: `BitmapEncoder.SetPixelData(Bgra8, Ignore)`. O base64 sai de `CryptographicBuffer::EncodeToBase64String`, sem crate nova. Devolve `data:image/jpeg;base64,…`;
    - erros em inglês, curtos ("Could not read the screen.", etc.).
  - **Dependências:** só as features `Win32_Foundation`, `Win32_Graphics_Gdi` e `Win32_UI_WindowsAndMessaging` na `windows` já aprovada. O `Cargo.lock` ficou idêntico, byte a byte (o diff do lock no repo é só a linha `"windows"` da E7).
  - **Capabilities:** nada muda. Comandos do app não pedem permissão neste projeto (`build.rs` padrão, igual a `ocr_image`).
  - **Frontend:**
    - `ChatComposer` ganhou a prop opcional `onCaptureScreen?: () => Promise<string>`. Com ela, aparece o botão (`Monitor` do Phosphor), o 1º da linha de ações, com `margin-right: auto` (canto inferior esquerdo);
    - durante a captura: `disabled`, `aria-busy`, pulso (`pdfPulse`) e title "Capturing screen...";
    - o resultado vai para o `draftImage`, o mesmo estado do paste. Valem o preview, o remover e o aviso de modelo sem visão. Depois, o foco volta ao textarea;
    - erro: `imageError`, que já existia e nunca era preenchido, e aparece como o aviso discreto do composer.
    - `AssistantPanel` passa `onCaptureScreen={() => invoke<string>('capture_screen_without_assistant')}`. O Chat principal não passa, então lá nada muda.
    - CSS: `.captureBtn` (+ `:hover`, `:disabled` e `[aria-busy='true']`), com tokens.
  - **Verificado:**
    - na cópia do scratchpad (igual ao repo antes da cópia): `cargo check --examples` e `cargo check --lib --tests` sem warnings; `cargo test --lib`: 29 ok e 3 ignorados;
    - `npx tsc --noEmit` ok;
    - nenhuma classe órfã ou faltando em `ChatComposer` e `AssistantPanel` (script);
    - todos os arquivos com LF.
  - **Captura real** (`cargo test --lib screenshot -- --ignored --nocapture --test-threads=1`, nada gravado em disco), 4 rodadas ok:
    - `captures_primary_monitor`: monitor 1920x1080, captura 1920x1080, JPEG de ~531 KB em base64 (começa com `/9j/`). Uma área de 4000x2000 sai em 2000x1000;
    - `excluded_window_is_not_captured`: uma janela Win32 vermelha (300x300, ~1 s na tela) aparece no print. Com `WDA_EXCLUDEFROMCAPTURE`, ela some do print em 10–16 ms (1 frame), bem abaixo dos 100 ms de espera. Com `WDA_NONE`, ela volta.
  - O app não foi aberto. Nenhum commit.
- Files changed:
  - `src-tauri/Cargo.toml`
  - `src-tauri/src/lib.rs`
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/ChatPanel/ChatComposer.module.css`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
- Files created:
  - `src-tauri/src/screenshot.rs`
- Files removed:
  - nenhum
- Left behind:
  - **Teste no app dev:**
    - o print sai sem o Assistant, inclusive o conteúdo do WebView2. O teste usou uma janela Win32 comum, não a janela do Tauri;
    - multimonitor: com o Assistant no 2º monitor, o print é desse monitor;
    - o fallback (hide/show) não foi exercitado: o Windows 11 aceita a exclusão.
  - O cursor do mouse não entra no print (GDI sem `CAPTUREBLT`/cursor).
  - Se a conversa trocar durante a captura (~0,2 s), a imagem cai no rascunho da nova conversa.
  - Um JPEG de ~0,5 MB por print vai para o histórico do chat (localStorage), como uma imagem colada. Não há aviso de cota (já conhecido).

### CodeReviewAgent — print de tela no Assistant — 20261018144547
- Summary: captura GDI correta e sem vazamento de handles. Liberação em todos os caminhos, stride/BGRA certos, DPI físico (o tao aplica Per-Monitor V2 ao processo), coordenadas negativas ok. A restauração de `WDA_NONE` e o show/focus do fallback rodam em todos os caminhos de erro.
  - **[importante]** O fallback hide/show nunca roda no Windows antigo. Antes do Windows 10 2004, `WDA_EXCLUDEFROMCAPTURE` não falha: aplica `WDA_MONITOR`, e o print sai com um retângulo preto no lugar do Assistant. O MSIX aceita o 17763 (1809/LTSC 2019). Saída: checar o build ou subir o `MinVersion` para 19041 e remover o fallback.
  - **[importante]** O aviso `imageError` fica preso ao trocar de conversa, colar imagem ou enviar.
  - **[nit]** guard RAII para o `WDA_NONE`; trava no backend contra captura concorrente; descartar o print se a conversa mudou durante a captura; `hwnd()` buscado 3 vezes; `unsafe` sem `SAFETY`; os testes `#[ignore]` não cobrem DPI ≠ 100%; HDR.
  - `cargo check --examples` ok, sem warnings. `cargo test --lib`: 29 ok, 3 ignorados. `npx tsc --noEmit` ok.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/18-10-2026/reviewreport_20261018144547_screenshot.md`

### Orchestrator — decisão — 20261018190000
- Summary:
  - O Coordenador aprovou o print de tela ("ficou ótimo, rápido e prático") e pediu a review só dessa funcionalidade.
  - Resultado: APROVADO COM RESSALVAS (2 importantes, 7 nits).
- Decision:
  - **Importante 1:** checar o build do Windows. Com build ≥ 19041 usa `WDA_EXCLUDEFROMCAPTURE`; abaixo disso usa o fallback de esconder e mostrar. O `MinVersion` do MSIX não muda e a matriz de suporte se mantém, por isso a decisão é técnica e não precisou do Coordenador.
  - **Importante 2:** limpar o `imageError` ao trocar de conversa, colar ou enviar.
  - **Nits:**
    - guard RAII para o `WDA_NONE`, com log;
    - comentários `// SAFETY:`;
    - descartar o print se a conversa mudou durante a captura;
    - passar o HWND uma vez só.
  - **Limitação registrada:** com HDR ligado, as cores saem lavadas.
- Next step: `codeAgent` — ajuste final do print.

### CodeAgent — ajuste final (print de tela, pós-review) — 20261018145107
- Summary:
  - **Build do Windows** (`screenshot.rs`):
    - `windows_build()` lê `AnalyticsInfo.VersionInfo().DeviceFamilyVersion()` (WinRT, sem `unsafe`) e guarda o resultado em `OnceLock`. Se a leitura falhar, devolve 0, e o fluxo vai ao fallback;
    - com build ≥ 19041 (`EXCLUDE_MIN_BUILD`), usa `WDA_EXCLUDEFROMCAPTURE`. Com build menor, ou se a chamada falhar, vai direto ao fallback de esconder e mostrar. O comentário do topo foi corrigido: antes do 2004, a chamada não falha, ela aplica `WDA_MONITOR`;
    - não usei `RtlGetVersion`: ele pede `Wdk_System_SystemServices` (módulo de ~22 mil linhas) + `Win32_System_SystemInformation`. `System_Profile` é uma feature só e pequena, e segue o padrão WinRT do projeto. O `Cargo.lock` ficou idêntico, byte a byte (md5 igual).
  - **Guard RAII** `ExcludedFromCapture`: aplica a exclusão no `new` e, no `Drop`, sempre volta a `WDA_NONE`, inclusive em erro ou panic. Se a restauração falhar, loga com `eprintln!`.
  - **HWND:** é obtido uma vez em `capture_without_window` e repassado como `isize` para `set_display_affinity`.
  - **`// SAFETY:`** nos 3 blocos `unsafe` do código de produção: `GetMonitorInfoW`, o bloco GDI e `SetWindowDisplayAffinity`.
  - **Teste novo, não ignorado:** `reads_windows_build` confere build ≥ 10240. Nesta máquina, ele leu 26300, igual ao SO.
  - **`ChatComposer.tsx`:**
    - `imageError` é limpo no efeito de `resetKey`, no `onPaste` (quando há imagem) e no `handleSend`;
    - `resetKeyRef` guarda a conversa no início da captura. Se a conversa mudou, o print e o erro são descartados.
  - **Não feito:**
    - a trava de captura concorrente no backend (opcional; o frontend já protege com `isCapturing`/`disabled`);
    - limpar o `docError` no efeito de `resetKey`. O review sugeriu, mas a decisão pediu só o `imageError`. O `docError` preso ao trocar de conversa já existia antes desta feature.
  - **Verificado** (na cópia do scratchpad, igual ao repo antes da cópia; os 2 arquivos Rust foram copiados de uma vez):
    - `cargo check --examples` e `cargo check --lib --tests` sem warnings;
    - `cargo test --lib`: 30 ok e 3 ignorados;
    - `cargo test --lib screenshot -- --ignored --test-threads=1`: 2 ok. Monitor 1920x1080, JPEG de 428 KB em base64; a exclusão leva 16 ms;
    - `npx tsc --noEmit` ok;
    - todos os arquivos com LF.
  - O app não foi aberto. Nenhum commit.
- Files changed:
  - `src-tauri/Cargo.toml` (feature `System_Profile`)
  - `src-tauri/src/screenshot.rs`
  - `src/components/ChatPanel/ChatComposer.tsx`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **Limitação HDR:** com HDR ligado no monitor, a captura GDI sai com as cores lavadas ou estouradas. É limitação da técnica; resolver exigiria Windows.Graphics.Capture/DXGI com tone mapping. Sem ação agora.
  - O cursor do mouse continua fora do print.
  - **Teste no app dev** (pendente desde a implementação):
    - o print sem o WebView2 do Assistant;
    - escala ≠ 100%;
    - multimonitor.
  - O fallback de esconder e mostrar só roda em Windows < 19041. Nesta máquina (26300), ele não foi exercitado.
  - Trava de captura concorrente no backend: não feita (opcional).

### Orchestrator — encerramento — 20261018193000
- Summary: task concluída.
  - As 17 etapas do plano estão feitas e passaram por review (R1/R2/R3) com passada final (F1/F2).
  - Também foram feitos os ajustes pedidos pelo Coordenador durante o teste:
    - OCR no contexto efêmero;
    - pastas de chat acompanham o ciclo de vida do caderno;
    - Tasks: modal nas visões que não são List, List sem card, ícones fixos, status sob o título, sol em Today/Week, reset do Postponed, cabeçalho fixo;
    - print de tela no Assistant, com review e passada final.
  - Verificação final do Orquestrador: `cargo check --examples` ok e `npx tsc --noEmit` ok.
  - `rag_eval`: MRR do baseline 0.599 → 0.897 com o código final (base de 18/10 às 06:54). Depois disso a base dev mudou nos testes do Coordenador (q06, q07 e q19 sem documentos).
- Pendências (fora do escopo ou aceitas):
  - **Busca e golden set:**
    - `/docs` ainda usa a busca antiga (KNN top 5);
    - golden set: rever q06, q07, q19 e q29, ou reclonar a base dev;
    - classe sweep fraca (pede map-reduce);
    - "nada relevante" sem métrica no golden set.
  - **Código:**
    - `useChat.ts` grande (~3.400 linhas);
    - unificar `knn_search` com `knn_rowids` e `Candidate` com `RagCandidate`;
    - `include_trace` (IPC);
    - cache do OCR sem o idioma.
  - **Tasks e cadernos:**
    - visibilidade de terceiros ao mover caderno;
    - foco preso no modal de tasks;
    - "Ask AI" atrás do backdrop;
    - fio duplo e paradas de Tab na List.
  - **Print de tela:**
    - HDR com cores lavadas;
    - sem cursor;
    - fallback sem teste em Windows antigo.
  - **Sem commit:** as mudanças estão na branch `feature/rag-assistant` e o commit fica a critério do Coordenador.
  - **Fora da task:** uma nota com credenciais em texto puro continua indexada.
- Next step: concluído.
