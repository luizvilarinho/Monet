# Review Report — R1: backend Rust do RAG

- Task: `DOCS/reports/17-10-2026/taskreport_20261017235032.md`
- Plano: `DOCS/reports/18-10-2026/planreport_20261018001246.md`
- Execution: `DOCS/reports/18-10-2026/executionreport_20261018000019.md` (E1, E5–E10, E12, E13)
- Escopo revisado:
  - `src-tauri/src/rag.rs` (novo) e `src-tauri/src/ocr.rs` (novo);
  - `src-tauri/src/documents.rs`, `src-tauri/src/vec_db.rs` e `src-tauri/src/lib.rs` (diff contra `develop`);
  - `src-tauri/Cargo.toml` e `src-tauri/Cargo.lock`;
  - `src-tauri/examples/rag_eval.rs` e `src-tauri/examples/clone_prod_to_dev.rs` (novos).
- Verificação (rodada a partir de `src-tauri`):
  - `cargo check --examples`: ok, sem warnings.
  - `cargo test --lib`: 23 testes passaram e 1 ficou ignorado (o OCR real).

## Veredicto

**APROVADO COM RESSALVAS**

Não achei nada crítico. Há 4 pontos importantes, todos com correção pequena:
- a busca do chat pode travar sem timeout no embedding;
- o "continue" reaproveita trechos sem conferir o escopo;
- a limpeza do startup corre em paralelo com o scan;
- uma indexação pode gravar chunks de um documento já apagado.

---

## O que foi conferido e está correto

- **Troca atômica dos chunks:** `replace_chunks` e `delete_chunks_for_document` (`documents.rs:618-756`) fazem tudo numa transação rusqlite do vec db: `vec_chunks`, `chunks_fts`, `chunks_meta` e `doc_index_state`. O FTS é apagado antes de `chunks_meta`, porque o subselect depende dela. `insert_chunks_tx` grava o FTS com o mesmo rowid e o mesmo texto (cabeçalho + trecho). Não há outro caminho que escreva chunks.
- **Regra "falhou com chunks → available + pendente":**
  - aplicada em todas as falhas de `run_indexing`, nas 2 de `notes_index_upsert` e no `cleanup_stuck_indexing`;
  - sem chunks, o documento continua como `error`;
  - o "unchanged" das notas exige a linha de `doc_index_state` (versão e assinatura), então uma nota que falhou é reembutida.
- **Retomada do Update index:**
  - cada documento concluído grava a versão;
  - um documento interrompido volta pelo `cleanup_stuck_indexing`, sem a linha de estado, e continua pendente;
  - o single-flight usa `AtomicBool` com um guard `Drop`.
- **Locks:** nenhum `Mutex` atravessa um `await`. Conferi `retrieve`, `rag_retrieve`, `ocr_image`, `notes_index_upsert` e `documents_set_folder_alias`. Não há lock aninhado DocDb × VecDb: os acessos são sequenciais.
- **MATCH do FTS5** (`rag.rs:297-312`):
  - todo termo vira uma frase entre aspas, com `"` escapado como `""`;
  - operadores, `*`, `:`, `NEAR(`, `^` e aspas desbalanceadas viram texto;
  - o teste `fts_survives_query_syntax_in_terms` cobre esses casos;
  - as keywords da reescrita (LLM) passam pelo mesmo caminho.
- **`documents_open_file`** (`documents.rs:1381`):
  - recebe **só o id do documento**; o caminho vem do banco (`type='file'`), e não do frontend;
  - só existem arquivos pdf, txt e md na KB (`detect_mime`);
  - não exige a capability `opener:allow-open-path`.
- **`clone_prod_to_dev` nunca escreve na produção:**
  - toda escrita passa por `ensure_dev_target`, que compara componente a componente (`Path::starts_with`). Por isso, `com.monet.app` não casa com `com.monet.app.dev`;
  - os bancos de produção só são copiados (`fs::copy`), nunca abertos;
  - a reescrita de caminhos tem 2 verificações e rollback;
  - o clone recusa rodar com `monet.exe` aberto;
  - as chaves de produção não são copiadas: o dev fica com as próprias.
- **Chaves de API em log:** nenhuma.
  - Os `eprintln!` imprimem o status e o corpo de erro do OpenRouter, ou o `Display` do erro do reqwest (URL, sem headers).
  - O `rag_eval` imprime só o caminho do arquivo da chave.
- **Reescrita e rerank:** têm timeout (4 s e 8 s) e fallback silencioso (mensagem original e ordem da RRF). A saída da reescrita é validada (teto da consulta e das keywords, datas ISO).
- **Comandos Tauri novos:**
  - `documents_index_outdated_count`, `documents_reindex_outdated`, `documents_open_file`, `documents_set_folder_alias`, `document_sets_*`, `ocr_cached`, `ocr_image`, `documents_resolve_searchable_ids`, `rag_retrieve` e `rag_get_chunks`;
  - todos usam SQL parametrizado;
  - o único que ignora o escopo é o `rag_get_chunks` (ver I2).
- **Cargo:**
  - `windows 0.61` é a mesma versão transitiva do tauri; no lock só entra a linha `"windows"` nas dependências do `monet`, sem crate nova;
  - o app é só Windows (`nsis`/`msi`), então a dependência incondicional funciona (ver N14).

---

## Achados

### [importante] I1 — A busca do chat não tem timeout no embedding e pode esperar mais de 1 min num 429

- **Onde:** `rag.rs:1372` (`embed_query` dentro de `retrieve`), que chama `documents.rs:518-608` (`embed_batch`).
- **Problema:**
  - a reescrita e o rerank têm timeout, mas o embedding da consulta não;
  - o `reqwest::Client::new()` não define timeout, então uma conexão pendurada deixa o turno preso em "Searching knowledge base..." **sem fim**;
  - o Stop não ajuda: a E11 registrou que o turno só termina quando a busca volta;
  - num 429, o `embed_batch` faz até 5 retries com backoff de 2+4+8+16+32 s, ou seja, mais de 62 s antes do 1º token.
- **O backoff de 429** serve à indexação, não ao chat.
- **Sugestão:**
  - em `retrieve`, envolver a chamada: `tokio::time::timeout(EMBED_QUERY_TIMEOUT /* ~10 s */, embed_query(...))`. No timeout, devolver `Err`: o frontend já segue sem RAG;
  - dar ao `embed_query` uma variante sem backoff longo (ex.: `max_attempts` como parâmetro do `embed_batch`, com 1 retry no chat);
  - opcional: `reqwest::Client::builder().connect_timeout(..).timeout(..)` no `embed_batch` também, para a indexação não pendurar o Update index.

### [importante] I2 — O "continue" (`rag_get_chunks`) devolve trechos fora do escopo da conversa

- **Onde:** `rag.rs:1491-1498` (`rag_get_chunks`) e `rag.rs:1424` (`get_chunks`); uso em `useChat.ts:2752`.
- **Problema:**
  - o comando recebe rowids gravados no `localStorage` (`ragSources.rowids`) e devolve os chunks sem passar pelo `resolve_scope`;
  - o frontend só tira a nota aberta.
- **Casos que vazam:**
  - **visibilidade mudou:** o documento saiu da pasta, ou o web research foi desligado e as pastas `ai` saíram do escopo. O "continue" ainda manda os trechos dele ao modelo;
  - **rowid reaproveitado:** `chunks_meta` usa `rowid INTEGER PRIMARY KEY`, sem `AUTOINCREMENT` (`vec_db.rs:104-111`).
    - O SQLite usa `max(rowid)+1`. Ao apagar o documento que tem os maiores rowids, o próximo documento indexado (uma nota editada, por exemplo) **herda os mesmos números**.
    - O "continue" de uma conversa que citava o documento apagado traz o trecho de outro documento, possivelmente de outro caderno.
- **Por que é importante:** a citação não fica errada (o `documentId` vem do chunk), mas o conteúdo fora do escopo vai para o modelo. Isso quebra a promessa da pasta e do filtro de web research.
- **Sugestão:**
  - `rag_get_chunks(scope: RagScope, rowids)`: resolver o escopo com `resolve_scope`, como o `rag_retrieve`, e filtrar com `document_id IN (scope)` no `chunk_rows`;
  - alternativa mais simples: receber pares `(rowid, documentId)` e descartar os que não casam (isso cobre o rowid reaproveitado, mas não a visibilidade).

### [importante] I3 — `cleanup_stuck_indexing` corre em paralelo com o scan do startup e pode "rebaixar" um documento recém-indexado

- **Onde:**
  - `lib.rs:1622-1630`: os dois são `spawn` independentes, e os dois só esperam o arquivo do banco existir;
  - `documents.rs:2736-2780`: snapshot dos `indexing` e depois `UPDATE` incondicional, um por um;
  - `documents.rs:810-832`: `status_after_index_failure` apaga a linha de `doc_index_state`.
- **Problema:**
  - entre o snapshot e o loop, o scan (ou a reconciliação das notas) pode marcar `indexing` e **concluir** a indexação do mesmo documento;
  - o loop então apaga a linha de `doc_index_state` recém-gravada e grava "Indexing interrupted (app closed)" num documento saudável;
  - resultado: falso pendente no banner, reembutir à toa e um tooltip de erro enganoso.
- **Antes e agora:** antes, o efeito da corrida era cair para `error`. A troca melhorou o pior caso, mas a corrida continua, e a correção é trivial.
- **Sugestão:**
  - rodar os dois em sequência numa única task: `cleanup_stuck_indexing(h.clone()).await; scan_all_watched_folders_on_startup(h).await;`;
  - no cleanup, fazer o `UPDATE ... WHERE id = ?1 AND status = 'indexing'` primeiro e só apagar `doc_index_state` se `changed > 0`;
  - para isso, separar o "tem chunks?" da exclusão do estado (ver N9).

### [importante] I4 — `run_indexing` grava os chunks de um documento apagado durante o embedding

- **Onde:** `documents.rs:991` (`replace_chunks` em `run_indexing`). Compare com a revalidação que já existe em `notes_index_upsert` (`documents.rs:2542-2559`).
- **Problema:**
  - o embedding de um arquivo grande leva segundos, e o Update index percorre centenas de arquivos durante minutos;
  - se o usuário apaga o documento ou a pasta monitorada nesse meio tempo, o `delete_chunks_for_document` roda **antes** da gravação, e depois o `replace_chunks` grava chunks, FTS e `doc_index_state` de um id que já não existe no `monet.db`;
  - nada limpa esses órfãos: eles nunca entram no escopo, mas ocupam o vec db e o FTS, e o `ensure_fts` os mantém;
  - o padrão já existia (`store_chunks`), mas a rotina longa da E8 torna o caso comum.
- **Sugestão:**
  - antes do `replace_chunks`, conferir no `monet.db` que a linha existe (e que o `original_path` é o mesmo); se não existir, sair sem gravar;
  - opcional: uma varredura no startup que apague de `chunks_meta`, `vec_chunks`, `chunks_fts` e `doc_index_state` os `document_id` ausentes de `documents`, cruzando os dois bancos em Rust, como o `pending_documents` já faz.

### [nit] N1 — Um `reqwest::Client` novo por chamada

- **Onde:** `rag.rs:967` (reescrita), `rag.rs:1034` (rerank) e `documents.rs:527` (embedding).
- **Problema:** sem reuso de conexão, cada consulta faz 3 handshakes TLS com o OpenRouter. Isso pesa nos ~3 s medidos antes do 1º token.
- **Sugestão:** um `static CLIENT: OnceLock<reqwest::Client>` com `connect_timeout`, compartilhado pelos três (combina com o I1).

### [nit] N2 — Um erro no FTS derruba a recuperação inteira

- **Onde:** `rag.rs:466-469`: `fts_search(...)?` dentro de `hybrid_search`.
- **Problema:** um erro de MATCH faz o `retrieve` devolver `Err`, e o chat segue sem RAG. Pode vir de um caractere que escape da sanitização (ex.: NUL no meio de um termo) ou de uma `chunks_fts` corrompida.
- **Sugestão:** no erro, usar só o KNN, com `eprintln!` (é o mesmo princípio do fallback da reescrita e do rerank).

### [nit] N3 — OCR sem teto de tamanho e com falha de engine sem diagnóstico

- **Onde:** `ocr.rs:21-43`.
- **Problemas e sugestões:**
  - **Memória:** o único limite é `MaxImageDimension` (10.000 px por lado). Uma imagem de 10.000×10.000 vira um `SoftwareBitmap` Bgra8 de ~400 MB, e o `HSTRING::from(b64)` duplica o data URL em UTF-16. Sugestão: recusar acima de N MB de base64 e acima de ~25 MP, ou reduzir a escala com `BitmapTransform`.
  - **Diagnóstico:** `TryCreateFromUserProfileLanguages` com `Err(_) => Ok(None)` (`ocr.rs:22-25`) é o comportamento pedido (pular sem erro), mas sem nenhum log. Uma falha de ativação do WinRT (ex.: edições N do Windows) fica indistinguível de "sem idioma". Sugestão: um `eprintln!` com o `HRESULT`.
  - **Bloqueio:** os `.get()` bloqueiam sem timeout, mas rodam em `spawn_blocking`, em série. Aceitável.

### [nit] N4 — `ocr_cached` é comando síncrono e roda na main thread

- **Onde:** `ocr.rs:45-46` (`pub fn`).
- **Problema:** no Tauri v2, um comando sem `async` roda na main thread. Se o `monet.db` estiver travado pelo plugin-sql, o `busy_timeout` de 5 s (`documents.rs:195`) congela a UI. Os outros comandos do módulo são `async`.
- **Sugestão:** `pub async fn ocr_cached`.

### [nit] N5 — O cache do OCR não guarda idioma nem versão

- **Onde:** `image_ocr_cache` (`documents.rs`, em `open_doc_db`) e `ocr.rs:86-92`.
- **Problema:** o texto fica para sempre, inclusive o vazio (imagem grande demais) e o lido com o idioma errado. Instalar um pacote de idioma depois não reprocessa nada.
- **Sugestão:** gravar o idioma do engine (`RecognizerLanguage().LanguageTag()`) e ignorar o cache quando ele muda. Ou aceitar e documentar.

### [nit] N6 — `documents_open_file` também abre os espelhos `.md` das notas

- **Onde:** `documents.rs:1381-1407`.
- **Problema:** as notas são `type='file'` com `origin='notes'`. Hoje o frontend as manda para `open_note_in_main`, mas o comando aceitaria o `note:<id>` e abriria o espelho interno do appData num editor externo, onde a edição não volta para a nota.
- **Sugestão:** `AND origin != 'notes'` no `SELECT`.

### [nit] N7 — Ramo morto "File path missing"

- **Onde:** `documents.rs:1148` (`original_path: Option<String>`) e `documents.rs:1313`.
- **Problema:** `documents.original_path` é `NOT NULL` no schema (`lib.rs:1318`), então o ramo `None` nunca roda.
- **Sugestão:** usar `String` e remover o ramo.

### [nit] N8 — Duas funções `truncate_chars` com semânticas diferentes

- **Onde:** `rag.rs:808` (faz `trim` e recebe `&str`) e `documents.rs:905` (sem `trim`, recebe `String`).
- **Problema:** o mesmo nome com comportamento diferente confunde quem reaproveitar uma delas.
- **Sugestão:** renomear a do `rag.rs` (ex.: `trim_to_chars`) ou unificar.

### [nit] N9 — `status_after_index_failure` tem efeito colateral escondido, e o scan não respeita o claim

- **Onde:** `documents.rs:810-832` e `documents.rs:2168-2176`.
- **Problemas:**
  - o nome sugere uma consulta, mas a função apaga a linha de `doc_index_state`. Separar em `has_chunks()` + `mark_outdated()` deixa o I3 simples de corrigir;
  - o `UPDATE ... status = 'indexing'` do scan para arquivo modificado não tem o `AND status != 'indexing'` do `claim_for_reindex`. Com o Update index rodando, um rescan dispara um 2º `run_indexing` simultâneo do mesmo documento. O resultado é custo dobrado e, se um dos dois falhar depois do outro ter gravado, um falso pendente. A E8 já registrou isso.
- **Sugestão:** usar a mesma guarda do `claim_for_reindex` no scan.

### [nit] N10 — `ensure_fts` não detecta conteúdo divergente com o mesmo rowid

- **Onde:** `vec_db.rs:165-198`.
- **Problema:** a checagem pega contagem e rowids faltando, mas não um chunk regravado com o **mesmo** rowid por uma build sem FTS (rowid reaproveitado, ver I2). Só ocorre num downgrade para uma build antiga sobre o mesmo banco.
- **Sugestão:** aceitar e deixar a limitação num comentário.

### [nit] N11 — O `rag_retrieve` manda os 40 candidatos com conteúdo mesmo sem o modo detalhado

- **Onde:** `rag.rs:1418` (`response.candidates = candidates`).
- **Problema:** cada mensagem cruza até ~160 KB de IPC, que o frontend descarta quando o inspetor está desligado. A E10 já registrou isso.
- **Sugestão:** um parâmetro `include_trace`. Quando falso, mandar só os `selected` e os candidatos sem `content`.

### [nit] N12 — Duplicações nos examples

- **`utc_timestamp`:** idêntica nos dois examples (`rag_eval.rs:215-241` e `clone_prod_to_dev.rs:91-117`). Sugestão: `examples/common/mod.rs` com `#[path]`, ou aceitar.
- **`ensure_dev` do `rag_eval`:** usa `contains(DEV_PROFILE)` (`rag_eval.rs:101-109`), mais fraco que o `starts_with` do clone. Sem risco real hoje, porque todos os caminhos derivam do diretório validado em `resolve()`.
- **Pipeline `hybrid` do `rag_eval`:** a própria E9 disse que o `full --no-rewrite --no-rerank` cobriria o papel dele.
  - Não são idênticos: o `full` corta em 6 chunks, e o `hybrid` olha os 40.
  - Decidir se ele fica como histórico de medição ou sai.
- **`retrieve_baseline` e `BASELINE_TOP_K`** (`rag.rs:19`, `rag.rs:755-767`): estão na lib do app, mas só o `rag_eval` os usa. Poderiam morar no example.

### [nit] N13 — Duplicação dentro do `rag.rs`

- **Onde:** `rag.rs:132-236`, `rag.rs:365-405`, `rag.rs:512-532`, `rag.rs:267` e `rag.rs:1077`.
- **`knn_search` (movido da E1) e `knn_rowids`:** são a mesma consulta vec0. O filtro de vizinhos (±1 + fallback) está copiado em `knn_search` e em `hybrid_search`.
- **`Candidate` e `RagCandidate`:** têm os mesmos campos, mais 3.
- **`knn_search`** ainda monta os placeholders à mão, embora exista o helper `placeholders()`.
- **Sugestão:** `knn_search` = `knn_rowids` + `chunk_rows` + um `dedupe_neighbors` compartilhado; e `hybrid_search` devolvendo `RagCandidate` direto.

### [nit] N14 — A dependência `windows` é incondicional

- **Onde:** `Cargo.toml:41`; `ocr.rs` sem `#[cfg(windows)]`.
- **Situação:** funciona porque o app é só Windows.
- **Sugestão:** se a exploração web/PWA ou outra plataforma for adiante, usar `[target.'cfg(windows)'.dependencies]` e `#[cfg(windows)] mod ocr`, com um stub que devolve `Ok(None)`.

### [nit] N15 — Os caminhos de integridade não têm teste

- **Situação:**
  - os testes cobrem bem as funções puras (FTS, RRF, reescrita, filtros, chunking, metadados);
  - não cobrem a regra "falhou com chunks", o `pending_documents`, o `cleanup_stuck_indexing` nem a sincronização `chunks_fts` × `chunks_meta` no `replace_chunks` e no `delete_chunks_for_document`, porque todos recebem `AppHandle`.
- **Sugestão:** extrair o miolo para funções sobre `&Connection` / `&Transaction` (ex.: `replace_chunks_tx`, `has_chunks`) e testar com o mesmo banco em memória do `rag.rs` (`test_db`).

---

## Bugs extras (código lido para a review, fora do escopo; não entram no veredicto)

- **Status preso em `indexing`:** `documents.rs:~1001-1004`. Se o `update_document_status(..., "available")` final do `run_indexing` falhar, o evento emitido é `error`, mas o banco fica `indexing` até o próximo startup. Código anterior à task.
- **Deep Research sem timeout:** `deep_research_rerank` (`lib.rs:~681-693`) agora usa `rag::rerank`, mas, diferente do RAG, segue sem timeout. Já registrado na E10.
- **Backoff de 429 do `embed_batch`:** é anterior à task. Só pesa no chat por causa do I1.
