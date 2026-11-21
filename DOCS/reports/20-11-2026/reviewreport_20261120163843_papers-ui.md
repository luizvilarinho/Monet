# Code Review: fases D–E, frente 2 (Papers, fila de leitura, Library e interface do chat)

- Task Report: `DOCS/reports/20-11-2026/taskreport_20261120115512.md` (a fonte acadêmica passou a ser o OpenAlex na sessão de decisão 20261120125612 do Execution Report)
- Execution Report: `DOCS/reports/20-11-2026/executionreport_20261120115512.md`
- Plano: `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md`
- Triagem de UX: `DOCS/reports/20-11-2026/uxtriage_20261120133108.md` (itens "Entra" da fatia 2 conferidos no código)
- Spec: `DOCS/specs/radar.md`

## Escopo revisado

- Papers e fila: `src/lib/papers.ts` e o teste, `src/lib/paperSetup.ts` e o teste, `src/lib/agents/papers.ts` e o teste (só o que é do Papers: as duas passadas, a reordenação por citações, a exclusão da fila e os tetos).
- PDF e Library: `src/lib/paperPdf.ts` e o teste, `src/lib/books.ts`, `src/lib/libraryOpen.ts`, `src/lib/readerNoteLink.ts`, `src/components/Library/Library.tsx`, `src/components/NoteTypes/PaperLibraryBar.tsx` e o CSS, `books_download_pdf` em `src-tauri/src/books.rs` e o registro em `src-tauri/src/lib.rs`.
- Pedidos de nota: `src/lib/agentNotes.ts`, `src/lib/assistantNoteBridge.ts`, `src/components/ChatPanel/SaveAgentNoteModal.tsx` e, no `src/App.tsx`, os ramos `radarProfile` e `paper`, `openBookInLibrary`, `libraryNonce`, o listener `assistant-open-book`, `openReadingList` e a fiação do `PaperLibraryBar`.
- Interface do chat: `AgentItemsList.tsx` e o CSS, `ChatMessageBubble.tsx`, o `NotesChatBubble`, `ChatComposer.tsx`, `ChatToolsMenu.tsx` (parte do `webPipeline`), `AgentPicker.module.css`, `RagSearchStatus.tsx`, `ChatPanel.tsx`, `AssistantPanel.tsx`, `NotesChatPanel.tsx`, `SettingsModal.tsx` (bloco do OpenAlex e textos do Tavily). Li também `addUrlToKb` e `emitMincerChanged`, que as ações por item chamam.
- Documentação: `DOCS/specs/radar.md` e os trechos de Radar, Papers e `/since` no `PRD.md` e no `docs.menu.md`.

Fora desta frente, usados só como contrato: `agentItems.ts`, `scope.ts`, `radar.ts`, `focusMap.ts`, `openalex.ts`, `search.ts`, o pipeline do `useChat.ts`, o `/since` e os prompts do Rust.

## Verificações executadas

- `npx tsc --noEmit`: limpo.
- `npm test`: 24 arquivos, 682 testes passando.
- `cargo check` (com `CARGO_TARGET_DIR` no scratchpad): sem erro nem aviso. Nada gravado em `src-tauri\target`.
- **Teste de ida e volta no editor real** (temporário, no scratchpad, já apagado; nenhum arquivo do projeto foi tocado). Rodei o `paperNoteContent` duas vezes pelo `buildBaseExtensions` (o mesmo conjunto de extensões do Editor) e li o resultado com `paperPdfFromContent` e `readingListKeys`. A linha `Source:` e a chave `openalex:W…` sobrevivem. A linha `PDF:` sobrevive com `?`, `&`, `*`, `~`, parênteses codificados e `_` no meio de palavra. **Falha com `_` depois de um caractere que não é letra** (achado 1).

## Defeitos confirmados

### 1. `[importante]` A linha `PDF:` com `/_` ou `?_` fica errada depois de o editor gravar a nota
- **Onde:** `src/lib/papers.ts:232` (`url.replace(/\\(?=[^\w\s])/g, '')`), junto da regex da linha 27.
- **O que está errado:** o serializador de markdown do editor escapa o `_` que não está no meio de uma palavra (`https://x.org/dir/_private/a.pdf` vira `https://x.org/dir/\_private/a.pdf`). O desescape só tira a barra antes de um caractere que não é `\w`, e o `_` é `\w`. Então a barra fica. O `reqwest::Url::parse` lê o `\` como `/` nas URLs http, e o link baixado passa a ser `https://x.org/dir//_private/a.pdf`.
- **Cenário:** um artigo com `pdf_url` `https://repo.example.org/files/_pub/paper.pdf`. O usuário clica em "Add to reading list", abre a nota Paper e edita qualquer coisa (o editor regrava o markdown). Depois clica em "Open in Library" na nota. Resultado: "Download failed: HTTP 404", ou outro arquivo. O mesmo clique no item do chat funciona, porque usa a URL do payload e não a da nota.
- **Correção:** desescapar também o `_`. Por exemplo, `url.replace(/\\(?=[^\w\s]|_)/g, '')`, ou tirar a barra antes de qualquer caractere de pontuação ASCII que o markdown escapa. Vale acrescentar ao `papers.test.ts` o caso `PDF: https://x.org/dir/\_private/a.pdf`, e, melhor ainda, um teste de ida e volta pelo `buildBaseExtensions`, no molde do `markdownRoundTrip.test.ts`.

### 2. `[importante]` `PaperLibraryBar`: trocar de nota no meio do download aplica o resultado à outra nota
- **Onde:** `src/components/NoteTypes/PaperLibraryBar.tsx:31-72`. Em `src/App.tsx:4481`, o componente não tem `key`.
- **O que está errado:** o componente fica montado quando a nota ativa muda de uma Paper para outra Paper. O efeito de `noteId` zera `busy` e `error`, mas a promessa do `open()` da nota anterior continua. Quando ela termina, chama `setHasBook(true)` ou `setError(...)` no estado que agora é da nota nova, e `onOpenBook(bookId)` leva o app para a Library.
- **Cenário:** na nota Paper A, o usuário clica em "Open in Library" ("Downloading…") e abre a nota Paper B antes de o download terminar.
  - Se o download de A falha, o erro de A ("Download failed: HTTP 403…") aparece embaixo do botão de B.
  - Se dá certo, B passa a ter `hasBook = true`. Quando B não tem a linha `PDF:` nem livro, o botão aparece em B (antes ficava escondido), e o clique responde "No open-access PDF". Além disso, o app sai de B e abre o livro de A na Library.
  - Com o botão liberado, um 2º clique em B durante o download de A dispara outro download em paralelo.
- **Correção:** `key={activeNote.id}` no `<PaperLibraryBar>` do `App.tsx`, mais uma guarda no `open()`: um ref com o `noteId` do clique, para não aplicar estado nem chamar `onOpenBook` quando a nota já mudou. Sem a troca de modo, o livro continua registrado e ligado a A, e o próximo clique em A só o abre.

### 3. `[importante]` `books_download_pdf` lê o corpo inteiro na memória antes de conferir o teto de 50 MB
- **Onde:** `src-tauri/src/books.rs:109-113`.
- **O que está errado:** o teto é conferido pelo `Content-Length`, quando existe, e pelos bytes lidos. Só que `resp.bytes().await` junta o corpo inteiro antes da conferência. Sem `Content-Length` (resposta chunked) ou com um `Content-Length` falso, o processo guarda tudo o que chegar nos 60 segundos do tempo limite, e só depois rejeita.
- **Cenário:** um `pdf_url` do OpenAlex, ou uma linha `PDF:` editada pelo usuário, aponta para um servidor que responde chunked sem fim (ou um arquivo de vários GB). O Rust aloca centenas de MB ou mais até o tempo limite, e o app pode travar ou ser encerrado pelo sistema por falta de memória, antes de aparecer "PDF too large".
- **Correção:** ler em pedaços (`resp.chunk().await` em laço, ou `bytes_stream`), somar o tamanho e abortar com `too_large` assim que passar de `MAX_FILE_BYTES`. Dá também para conferir o `%PDF` no 1º pedaço e abortar cedo. O `librarian_fetch_and_save_pdf` (`src-tauri/src/documents.rs:2162`) tem o mesmo padrão. Ele fica fora desta task, mas a mesma correção serve.

### 4. `[nit]` `.tmp` parcial fica no disco quando a escrita falha
- **Onde:** `src-tauri/src/books.rs:128`.
- **O que está errado:** a limpeza do `.tmp` só roda quando o `rename` falha. Se o próprio `fs::write` falha no meio (disco cheio, antivírus), o `?` devolve o erro e o `<uuid>.pdf.tmp` parcial fica na pasta `books/`.
- **Cenário:** disco quase cheio e um PDF de 40 MB. O usuário vê "failed to save file: …", e um arquivo `.tmp` de dezenas de MB fica órfão em `appData/books`.
- **Correção:** tratar o erro do `write` como o do `rename` (`if let Err(e) = fs::write(...) { let _ = fs::remove_file(&tmp_write); return Err(...) }`).

### 5. `[nit]` Vínculo com livro apagado: cada clique baixa de novo e cria outro livro
- **Onde:** `src/lib/paperPdf.ts:19-20` e `:32`. Lido junto com `findBookIdForNote` (`src/lib/readerNoteLink.ts:59`), que devolve o 1º vínculo pela ordem de inserção.
- **O que está errado:** quando o vínculo aponta para um livro que não existe mais, o código baixa e liga o livro novo, mas deixa o vínculo velho. Como o velho vem primeiro no objeto, o próximo `findBookIdForNote` devolve o livro apagado de novo, e o download se repete.
- **Cenário:** um vínculo órfão, porque o `handleDelete` da Library falhou depois do `deleteBook` e antes do `unlinkBookFromReaderNote`, ou por outro caminho que apague o livro sem o unlink. Cada clique em "Open in Library" baixa o PDF de novo e acrescenta mais uma cópia do livro à Library. O teste "o vínculo com um livro que não existe mais baixa de novo" só confere o 1º clique.
- **Correção:** chamar `unlinkBookFromReaderNote(linkedId)` antes de baixar quando o livro não existe, e cobrir o 2º clique no teste. A probabilidade é baixa: hoje o delete da Library já faz o unlink.

### 6. `[nit]` `setUpPaperType` grava as propriedades antes do tipo novo
- **Onde:** `src/lib/paperSetup.ts:16-17`.
- **O que está errado:** é a ordem que o review das fases A–C apontou no Practice, corrigida lá (`practiceSetup.ts`: o tipo sem Log, depois as propriedades, depois o tipo com o Log). O Paper repete a ordem antiga.
- **Cenário:** o 1º "Add to reading list", com falha no `saveNoteType` depois de gravar as quatro propriedades. Fica Status, Year, Authors e DOI com um `noteTypeId` que não existe (o banco não tem FK). O "Try again" gera outro id de tipo e grava mais quatro. As órfãs ficam para sempre.
- **Correção:** a mesma do Practice: o tipo novo sem board, depois as propriedades novas e alteradas, e por último o tipo com o board (`plan.typeChanged`).

### 7. `[nit]` A fila ainda duplica entre janelas com o modal aberto
- **Onde:** `src/components/ChatPanel/AgentItemsList.tsx:211-233` e `src/App.tsx:3692-3708` (ramo `paper`).
- **O que está errado:** a fila é relida no clique, antes de abrir o modal. Isso basta para o caso comum, mas o ramo `paper` do `handleCreateAgentNoteFromChat` grava sem conferir a fila. Toda nota Paper passa por ele, inclusive a da janela assistant, pela ponte.
- **Cenário:** a mesma conversa do Papers aberta na main e na assistant. O usuário abre o modal "Add to reading list" do artigo X nas duas janelas, salva numa e depois salva na outra. Resultado: duas notas Paper do mesmo DOI. O evento `monet:reading-list-changed` só atinge a janela que salvou, e o modal aberto na outra não relê a fila.
- **Correção:** no ramo `paper`, antes de criar a nota, chamar `loadReadingList()` e, se `readingListMatch` achar o artigo, devolver a nota existente (ou lançar "Already in your reading list"). Para isso o pedido `paper` precisa levar o `openalexId` além do `doi`. A main é a única que grava, então essa checagem fecha a corrida na prática.

### 8. `[nit]` Chat e Assistant: `/radar <texto>` com outro agente ativo e sem a chave do Tavily perde o rascunho
- **Onde:** `src/components/ChatPanel/ChatComposer.tsx:125` e `:200-210`.
- **O que está errado:** `needsTavily` olha o agente selecionado, não o do atalho digitado. Com o General ativo, `/radar what's new in X` passa no `canSend`, o rascunho é limpo e o `send()` aborta com a faixa "Radar needs a Tavily key…". É o defeito D5, corrigido só nas Anotações.
- **Cenário:** sem chave do Tavily e com o General selecionado, o usuário digita `/radar novidades de Rust async` e aperta Enter. O texto some.
- **Correção:** no `handleSend`, quando `parsed?.agent.webPipeline?.needsTavily` e o agente atual não exige a chave, conferir `hasTavilyKey()` antes de limpar o rascunho (o mesmo `tavilyNeedMessage` das Anotações), ou só selecionar o agente nesse caso.

### 9. `[nit]` `PaperLibraryBar`: livro apagado com a nota aberta e sem linha `PDF:` dá um erro enganoso
- **Onde:** `src/components/NoteTypes/PaperLibraryBar.tsx:31-53` (a existência do livro só é lida quando `noteId` muda) e `:84`.
- **Cenário:** a nota Paper fica aberta enquanto o livro ligado é apagado na Library (outra janela, ou a main depois de voltar). O botão continua "Open in Library", e o clique responde "No open-access PDF". O certo seria dizer que o livro saiu da Library. Durante a espera, o rótulo diz "Opening…" mesmo quando está baixando.
- **Correção:** quando o `openPdfInLibrary` não acha o livro ligado e não há link, lançar "This paper's book is no longer in the Library." e acertar o `hasBook`.

## Suspeitas (não confirmadas em execução)

### S1. `[importante]` Chat das Anotações: Enter repetido pode disparar a consulta duas vezes
- **Onde:** `src/components/NotesChat/NotesChatPanel.tsx:611-668`.
- **Por quê:** a trava (`tavilyCheckingRef`) cobre só a checagem da chave. Depois de `setDraft('')` (linha 628) vêm três `await` antes do `send()`: `storage.getNote`, `loadEmbedResponses` e `ocrTextsForContent`, e o OCR pode ser lento em nota com imagem. O `isStreaming` só muda dentro do `send()`. Um 2º Enter nesse intervalo vê o rascunho vazio, cai na mensagem padrão ("What's new?" ou "Find essential papers") e segue para outro `send()`, com o `send` do render antigo e `isStreaming` falso. Não confirmei se o `useChat` cancela ou rejeita o 2º turno mais adiante. Se não cancelar, são dois pipelines (até 9 buscas cada), e a data do escopo avança duas vezes. O intervalo já existia para o Coach e o Plan week; o Radar e o Papers o tornam caro.
- **Correção sugerida:** estender a trava (um `sendingRef`) da entrada do `handleSend` até a chamada do `send()`.

### S2. `[nit]` O download aceita destino na rede local
- **Onde:** `src-tauri/src/books.rs:89-99`.
- **Por quê:** só o esquema é conferido. A URL (vinda do OpenAlex ou de uma linha da nota) pode apontar para `http://127.0.0.1:…` ou `http://192.168.x.x/…`, e o `reqwest` segue até 10 redirecionamentos, que podem levar à rede local. O efeito fica limitado a um GET no clique do usuário, porque a resposta só é gravada se começar por `%PDF`. Não vi forma de a URL causar algo além de um download: o caminho do arquivo vem só do `Uuid` e o `file_name` é fixo.
- **Correção sugerida (opcional):** recusar host de loopback ou de rede privada e limitar os redirecionamentos (`redirect::Policy::limited(5)` com checagem do esquema).

### S3. `[nit]` `%PDF` exigido no byte 0
- **Onde:** `src-tauri/src/books.rs:115`.
- **Por quê:** a especificação do PDF aceita o cabeçalho dentro dos primeiros 1024 bytes, e o pdf.js abre esses arquivos. Um PDF válido com bytes antes do `%PDF` recebe "The link did not return a PDF". É o mesmo critério do bibliotecário. A suspeita é rara.

### S4. `[nit]` Uma leitura completa de todas as notas por balão com artigos, a cada nota Paper criada
- **Onde:** `src/components/ChatPanel/AgentItemsList.tsx:130-149`.
- **Por quê:** cada `AgentItemsList` com artigos chama `loadReadingList()` (`getNotes`, `getNoteTypes` e `getMetadataDefs`, com o conteúdo das notas) ao montar e a cada evento. Uma conversa com 10 respostas do Papers faz 10 leituras completas por "Add to reading list". Sem medição. Pode pesar com milhares de notas.

### S5. `[nit]` A main não relê a fila quando a nota Paper vem da janela assistant
- **Onde:** `src/App.tsx:3692-3708`.
- **Por quê:** o evento `monet:reading-list-changed` só sai na janela do modal. As listas da main continuam com "Add to reading list" até o próximo clique, que relê a fila e corrige o botão. Não duplica, mas o estado fica defasado. O ramo `paper` poderia emitir o evento na main também.

## Pontos conferidos sem achado

- **`importBook` depois da extração:** é `booksImportFile` mais `registerBookFile(picked)`. Sem `meta`, o título e o autor do metadado ficam intactos, e a validação, o rollback e as mensagens não mudaram. O comportamento é o mesmo de antes.
- **Dedupe:**
  - a chave é `doi:` normalizado ou `openalex:W…`;
  - a nota ativa vence a arquivada (o laço passa as ativas primeiro);
  - o rótulo "Archived" usa o ícone `Archive`, o tooltip pedido e o clique que abre a nota;
  - o Papers tira a fila antes de reordenar e também no `mergePapers`;
  - a leitura da `Source:` sobrevive ao editor (conferido na ida e volta).
- **Tipo Paper:**
  - não duplica propriedade nem opção do Status;
  - o board só nasce quando não existe e quando o Status é select;
  - o conflito de tipo de dado vira aviso no sucesso do modal;
  - o tipo nasce com `log: null`;
  - a gravação é idempotente.
- **`inspectPaperType`:** roda sobre as mesmas entradas do `setUpPaperType` (`defs` filtradas por `scope === 'note'`). A diferença entre o que o modal mostra e o que foi gravado só aparece se outra janela ou o modal de tipos mudar o tipo Paper entre a leitura e a gravação, um intervalo de milissegundos e com efeito só no texto. Não é defeito.
- **Download (Rust):**
  - só aceita `http` e `https`, com tempo limite de 60 s, User-Agent "Monet" sem e-mail e `%PDF`;
  - grava de forma atômica (`.tmp` e `rename`);
  - o destino é montado só com `Uuid`;
  - as mensagens de erro são legíveis;
  - o registro no `generate_handler!` está feito.
- **Library:**
  - `requestOpenBook` limpa a pasta de documentação aberta;
  - o `<Library key>` remonta e lê o `OPEN_BOOK_KEY`;
  - um livro que já não existe cai na lista e limpa a chave;
  - o pedido da janela assistant mostra a main e abre o livro.
  - A remontagem descarta o estado local da Library (filtro, edição de título, alias pendente), o que é aceitável para um pedido de abrir livro.
- **Lista de itens:**
  - nenhuma ação roda sem clique;
  - a lista e a linha do app somem em streaming (por mensagem: `m.id === streamingMessageId`) e em `failed` ou `interrupted` (`hasAgentPayload`);
  - os estados "Sending…", "Queued in Mincer", "Adding…" e "In KB" estão certos;
  - a confirmação do Add to KB diz o efeito completo e liga o toggle;
  - o Add to KB só aparece em chat com pasta e, na assistant, usa a pasta da conversa aberta;
  - o `{ __html }` do `ChatMessageBubble` continua memoizado, e o `displayContent` está em `useMemo`.
- **Chat das Anotações:**
  - o rascunho fica sem a chave;
  - a faixa de erro aparece com a conversa vazia só para o aviso da chave, com "Open Settings" na seção da busca;
  - o atalho de agente com pipeline só seleciona o agente;
  - o menu de tools recebe o agente;
  - o status do pipeline aparece.
  - Os envios que já existiam seguem o mesmo critério do `send()` (`useChat.ts:3563-3572`). A diferença é que o rascunho agora fica, o que é a melhora pedida.
- **Regressões:**
  - os pedidos `plan` e `profile` mantêm o "Save a copy", que só some no Paper;
  - Coach e Plan week continuam enviando a mensagem padrão no atalho sozinho (a condição só ganhou `|| !!parsed.agent.webPipeline`);
  - no menu de tools, o Papers mostra "Off for Papers" e o Radar "Always on for Radar";
  - os blocos das outras chaves no Settings estão intactos.
- **Regras do projeto:**
  - a UI está em inglês;
  - os ícones são todos Phosphor (`BookOpen`, `BookmarkSimple`, `Archive`, `Books`, `Funnel`, `ArrowSquareOut`, `Check`, `Broadcast`), sem emoji;
  - as ações têm rótulo escrito;
  - nada roda em background;
  - a IA não grava em nota sem clique;
  - o `App.tsx` recebeu só a fiação e o ramo `paper` no molde do `plan`.
- **Código morto:** não encontrei código morto (classes de CSS, imports, exports e textos do `KIND_TEXT` conferidos). O `AGENT_DRAFT_ICON.paper` existe só porque o `Record` por `kind` exige a entrada (desvio aceito).

## Documentação

A spec e o PRD descrevem o que o código faz, inclusive os limites: a cobertura de `conference-paper`, o orçamento sem chave dividido por IP, a data do Tavily, o `per-page` máximo, as editoras que exigem navegador e o indicador aceso no seguimento. Diferenças pequenas:
- `[nit]` A spec §11 cita "Download failed: HTTP 403". O Rust formata o `StatusCode` como "HTTP 403 Forbidden" (o teste do `paperPdf` já usa essa forma).
- `[nit]` A confirmação de remover a chave do Tavily diz "Web search, Deep research and the Radar stop". O `/since` e o Add to KB também param, como a nota de rodapé já diz.
- Quando o achado 1 for corrigido, a frase "A leitura da linha `PDF:` é tolerante" (§11) passa a valer também para o `_` escapado.

## Testes

- Nenhum teste faz requisição de rede: o `invoke`, o `searchWorks`, o storage e o `books` são simulados, e os comentários dos arquivos dizem isso.
- As regras puras estão bem cobertas:
  - o `paperSaveChanges`, inclusive a idempotência, o Status com opções faltando e os conflitos;
  - o dedupe (ativa contra arquivada e as duas chaves);
  - o conteúdo da nota, a leitura da `PDF:` e da `Source:` e as propriedades;
  - no Papers: o teto de 4 buscas, a reordenação, a exclusão da fila, as falhas, o seguimento e o perfil só com o Ignore;
  - o `openPdfInLibrary` (reuso, erro do Rust como `Error`, nota sem caderno).
- Lacunas:
  - não há teste de ida e volta da nota Paper pelo editor real, que pegaria o achado 1;
  - o `openPdfInLibrary` não é testado com o vínculo órfão no 2º clique (achado 5);
  - não há teste de componente para `AgentItemsList`, `PaperLibraryBar`, `SaveAgentNoteModal` (aviso, primeira vez, sem "Save a copy" no Paper) nem para o `handleSend` das Anotações (os testes de fumaça dos `codeAgent` foram apagados);
  - o `books_download_pdf` não tem `cargo test` (teto, `%PDF`, limpeza do `.tmp`);
  - o ramo `paper` do `App.tsx` e o `setUpPaperType` (ordem das gravações) não têm teste.

## O que não foi verificado

- Nada com o app aberto, com rede nem com um modelo:
  - a densidade da lista, o modal e o `PaperLibraryBar` no Tiptap;
  - o download contra editoras reais;
  - o `registerBookFile` com um PDF baixado;
  - a Library remontada e a janela assistant abrindo o livro na main;
  - o compartilhamento do `localStorage` entre as janelas, que o vínculo livro e nota criado na assistant usa.
- Se o `useChat` cancela um 2º turno concorrente (S1).
- A abertura de nota arquivada pelo `handleNavigateToNote` (sem contexto).

## Veredicto final

Veredicto: APROVADO COM RESSALVAS
Não há defeito crítico. Os três defeitos importantes devem ser corrigidos antes do merge: a leitura da linha `PDF:` com `_` escapado pelo editor, o resultado do download aplicado à nota errada no `PaperLibraryBar` e o download do PDF lido inteiro na memória antes do teto. Os demais achados são nits.

## Bugs extras

- `src-tauri/src/documents.rs:2162` (`librarian_fetch_and_save_pdf`): o mesmo `resp.bytes()` sem teto durante a leitura do achado 3. Fica fora desta task.
