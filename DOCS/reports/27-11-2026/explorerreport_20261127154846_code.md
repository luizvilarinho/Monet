# Explorer (código) — vídeo do YouTube com transcrição sincronizada no Library

> Exploração só de leitura, branch `feat/language-study` (nada alterado fora deste arquivo). Cobre R3, R4 e R8 do Task Report `taskreport_20261127153603.md` e o que R1 e R2 pedem do código. A pesquisa externa (de onde vem a transcrição com tempo; regras do player embutido) está nas outras duas explorações.
> Convenção: **Lido** = visto no código ou na configuração, com arquivo e linha. **Suponho** = inferência minha, a provar. Nada de título, canal ou link real de vídeo aparece aqui.

## 0. Resumo

**Dá para fazer pelo lado do código.** Nada no Mincer, no banco nem nos componentes de língua impede. O que o código não responde sozinho são dois pontos externos: o endpoint de transcrição devolver tempo, e o player do YouTube carregar dentro do WebView2 em produção.

- **Dificuldade geral: Média-Alta.** Trabalho grande, mas sem peça nova de arquitetura. O único ponto Alto é o player embutido, pela incerteza e não pelo volume.
- **Opção favorecida pelo código: (a), formato novo `video` com leitor próprio de texto corrido.** O EPUB (b) briga com o modelo do EpubReader (paginado, sem rolagem, sem lugar para um painel em cima, posicionamento por CFI impreciso). A ligação de língua (~770 das 2.714 linhas do EpubReader) se repete no leitor novo, mas o texto fica no mesmo documento da página, sem iframe nem pdf.js, o que simplifica seleção, marcas e âncora.
- **Ordem de tentativa** (código): legendas pelo `yt-dlp` primeiro, áudio + transcrição com tempo como reserva. Os dois guardam o mesmo modelo de dados (lista de trechos com início e fim).

## 1. O caminho do YouTube no Mincer

### 1.1 O que existe (Lido)

Arquivos: `src-tauri/src/mincer/{mod,jobs,youtube,transcribe,sidecar,db,summarize}.rs`; front em `src/components/Mincer/*`, `src/lib/mincer.ts`, `src/hooks/useMincerJob.ts`; spec `DOCS/specs/mincer.md`.

Etapas de um item `youtube` (`jobs.rs:254-266`, `run_item` em `289-321`):

1. **Ao enfileirar** (`mod.rs:480-485`): valida a URL (`youtube.rs:14-47`: só host YouTube, id de 11 caracteres; aceita `youtu.be/<id>`, `watch?v=`, `/shorts/<id>`; **não** aceita `/live/<id>` nem `/embed/<id>`, porque exige `v=`), exige modelo de transcrição e, como todo kind que não é `web_capture`, **exige opções de resumo e chave do OpenRouter** (`mod.rs:496-499`). O título nasce "YouTube video".
2. **`fetch_title`** (`youtube.rs:49-68`): uma chamada própria do yt-dlp, `--skip-download --print %(title)s`. A falha é ignorada e o título fica "YouTube video".
3. **`download_audio`** (`youtube.rs:77-128`): `--format bestaudio*`, `--no-playlist`, `-o <pasta>/yt_audio.%(ext)s`, URL depois de `--`; o progresso vem de `[download] NN%` por `run_with_lines`; marcador `yt_audio.done`.
4. **`transcribe_media`** (`transcribe.rs:114-147`): o ffmpeg extrai mp3 mono 16 kHz 64 kbps (`75-81`); até 18 MiB (`CHUNK_SIZE_LIMIT`, linha 14, cerca de 39 min) vai num pedaço só; acima disso `-f segment -segment_time 1200` re-codificando em `libmp3lame` (`95-101`), **sem sobreposição**.
5. **Pedido por pedaço** (`transcribe.rs:162-165`): `POST /audio/transcriptions` com só `{ model, input_audio: { data (base64), format: "mp3" } }`. Três tentativas com espera de 1 s e 2 s (`205-235`). **A resposta é lida num struct com um único campo, `text`** (`188-196`).
6. **Cache por pedaço**: `chunk_NNN.txt` na pasta do item (`135-143`); texto final = pedaços unidos por `"\n\n"` (`146`).
7. **`set_transcript` e apagar a pasta** (`jobs.rs:294-300`): o áudio e os pedaços somem assim que o texto entra no banco. Depois, o resumo.

Como o yt-dlp é chamado: `sidecar::command` (`sidecar.rs:49-57`: sem janela, prioridade abaixo do normal, `kill_on_drop`), dentro de um **Job Object** com `KILL_ON_JOB_CLOSE` (`63-95`) que mata o processo e os filhos no cancelamento ou no quit. Sempre com `--extractor-args youtube:player_client=android,mweb` (`youtube.rs:9`, comentário: "contornam o PO Token"). O binário fixado em `src-tauri/binaries/` é o **yt-dlp 2026.03.17** (rodei só `--version`; cerca de 8 meses antes de hoje), com SHA-256 pinado em `scripts/fetch-sidecars.ps1:15` e **sem atualizador** (backlog: `DOCS/backlog.md:76`, spec §10).

### 1.2 A resposta já tem tempo que hoje é descartado?

**Não dá para saber pelo código.** O pedido não manda formato nem granularidade (`transcribe.rs:162-165`) e a resposta só é desserializada em `text` (`188-196`); se o provedor devolver `segments`, o serde os ignora. Se o endpoint devolve tempo, e em quais modelos, é da exploração de transcrição (Suponho: depende do modelo).

### 1.3 O que mudar para guardar o tempo (Suponho, desenho)

| Mudança | Onde | Observação |
|---|---|---|
| `transcribe_once` devolve `{ text, segments: Vec<{start,end,text}> }`; o corpo pede a granularidade | `transcribe.rs:149-203` | o nome do parâmetro depende da outra exploração |
| Cache do pedaço com tempo | `transcribe.rs:42-60, 135-143` | manter `chunk_NNN.txt` e gravar ao lado `chunk_NNN.seg.json`. Pedaço com `.txt` e sem `.seg.json` (item de antes da mudança) é reenviado. Trocar a extensão obrigaria a mexer em `count_chunks` e `remove_chunk_files`, que só conhecem `.mp3` e `.txt` |
| Soma dos deslocamentos | `transcribe_media` | pedaço *i* começa em `i × 1200 s` (a constante `SEGMENT_SECONDS`, linha 15); pedaço único começa em 0. Erro esperado menor que 0,1 s por pedaço (Suponho: o quadro mp3 a 16 kHz tem cerca de 36 ms). Mais exato: `-segment_list` do ffmpeg (CSV com os tempos reais), que hoje não é usado |
| Retomada e cache | idem | o tempo do pedaço é relativo e o deslocamento sai do **índice**, não de estado em memória; por isso sobrevive a Resume, quit limpo e crash sem lógica nova |
| Emenda sem sobreposição | idem | hoje uma frase cortada na emenda vira texto com `"\n\n"` no meio (`146`). Com tempo dá para unir os trechos da emenda; uma palavra cortada no meio pelo corte não tem remédio sem sobreposição (Suponho) |
| `extract_text` devolve `{ text, segments? }` em vez de `String` | `jobs.rs:220-287` (7 braços) | |
| Gravar texto e trechos no mesmo UPDATE, **antes** do `remove_item_dir` | `jobs.rs:294-300`, `db.rs:239-245` | senão uma falha no meio perde a retomada |
| Coluna nova (`timed_json TEXT`: dados do vídeo + trechos) | `documents.rs:330-351` | o ALTER guardado já existe (lista `("unseen", …)`). `mincer_list` não lê a coluna (lista leve, `db.rs:160-191`); só `get_item` (`123-158`) |
| Se o modelo não devolver tempo | — | sem tempo por trecho não há sincronização por frase. Interpolar por caracteres dentro de um pedaço de 20 min deriva em dezenas de segundos com pausas (Suponho): serviria no máximo para parágrafo, não para frase. O item ficaria só texto, sem vídeo sincronizado |

Tamanho do dado (Suponho): uma hora de fala dá 700 a 1.000 trechos, na ordem de 60 a 120 KB de JSON. Cabe numa coluna.

### 1.4 Onde entra "baixar legendas do YouTube antes do áudio"

No braço `"youtube"` de `extract_text` (`jobs.rs:254-266`), antes de `download_audio`:

1. `youtube::fetch_info`: uma chamada (`--skip-download --dump-single-json` ou vários `--print`) que devolve título, id, duração, canal, idioma e a lista de faixas (`subtitles`, `automatic_captions`). Substitui o `fetch_title` e já traz o que o Library precisa.
2. Com faixa utilizável: `yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs <…> -o <pasta>/yt_subs.%(ext)s`, pelo mesmo `sidecar::run` (mesmo Job Object e cancelamento); marcador `yt_subs.done` como o `yt_audio.done` (`youtube.rs:83`).
3. Parser novo em Rust (json3 ou vtt para trechos; vtt de legenda automática repete linhas, então json3 é mais limpo; Suponho). Sem crate nova: `serde_json` serve para json3.
4. Sem faixa, ou parser falhou: cai no caminho do áudio de hoje.

Dois cuidados: (i) o item de estudo precisa de **kind próprio** (`youtube_study`, no molde de `web_capture`: sem resumo e sem chave do OpenRouter quando a legenda basta), senão `mod.rs:483, 496-499` exige modelo e chave; mexe em cerca de 8 pontos (`mod.rs:480`, `jobs.rs:254`, `MincerKind`/`KIND_LABELS`/`STAGE_LABELS` em `mincer.ts`, `MincerHistory.tsx:138`, `MincerNew.tsx`, `MincerItemView.tsx`). (ii) **Se o `EXTRACTOR_ARGS` (android, mweb) devolve legendas é ponto aberto** (não li; a outra exploração prova): se não devolver, a chamada de legendas teria de usar outros clientes, e `fetch_title` e `download_audio` não mudam.

### 1.5 Cancelamento e retomada (Lido)

- Cancel mata a árvore do processo (Job Object) e marca `cancelled` (`jobs.rs:114-120, 323-339`). A pasta `appData/mincer/<id>/` fica; Resume recomeça `run_item`, e como `transcript` ainda está vazio, `extract_text` roda de novo: o áudio e os pedaços cacheados são reaproveitados (`yt_audio.done`, `chunks.done`, `chunk_NNN`).
- Quit limpo: o item volta à frente da fila e retoma no boot (`jobs.rs:489-519`). Crash: vira `interrupted` e espera o Resume (`jobs.rs:428-431`).
- A etapa de legendas precisa só do marcador. Se faltar, repete uma chamada de poucos segundos.

## 2. Como um vídeo viraria um item do Library

### 2.1 A tabela `books` e o ciclo de vida (Lido)

`books`: `id, title, author, file_path NOT NULL, total_pages NOT NULL, last_page, added_at, last_opened_at, zoom, format DEFAULT 'pdf', cfi, locations_json, language` (`lib.rs:1705-1714, 1763, 1793-1795`; `tauri.ts:682`). A tabela é **do frontend** (comentário em `lib.rs:1702-1703`); `format` não tem CHECK, então `'video'` cabe sem DDL.

| Operação | Hoje | O que o formato `video` exige |
|---|---|---|
| Importar | `importBook` → diálogo com filtro pdf/epub, 50 MB (`books.rs:36-83`) → `registerBookFile` valida com pdf.js/epubjs e grava (`books.ts:76-143`) | Não passa pelo diálogo. Novo `registerVideoBook(...)` no frontend. O texto vai num arquivo `books/<uuid>.video.json` (modelo igual ao do PDF: `file_path` aponta para ele). `books_read_file` e `books_delete_file` já são genéricos dentro de `books/` (`books.rs:248-285`); falta um `books_write_file` (cerca de 30 a 40 linhas, Rust) |
| Listar | `Library.tsx:682-846`; colunas Pages (`format==='epub' ? '—' : totalPages`, linha 776) e Progress (`lastPage/totalPages`, 82-85, 786) | `totalPages` = minutos, `lastPage` = minuto atual: a % sai de graça. Badge `{book.format}` (722-724) mostra "video". Ajustar a coluna Pages |
| Abrir | ramos por `openBook?.format === 'epub'` (404) e **o resto cai no `Reader` do PDF** (430) | ramo próprio antes do fallback. Hoje o `else` é o PDF; sem isso, um `video` abre no leitor de PDF e quebra |
| Progresso | `saveBook` atualiza `last_page`, `zoom`, `cfi` (`tauri.ts:1919-1929`); o EPUB guarda a posição exata no `cfi` | o tempo em segundos precisa de coluna (`resume_sec REAL`, pelo `BOOKS_EXTRA_COLUMNS` + `addMissingColumns`, `tauri.ts:682, 704-719`) ou reuso feio do `cfi`. Recomendo coluna nova, mais `video_id TEXT` (dedupe do "mesmo vídeo duas vezes", que o Mincer não faz: `mod.rs:501-510`; e "Open on YouTube") |
| Apagar | `handleDelete` (`Library.tsx:236-282`): arquivo, áudio TTS, `deleteBook` (grifos, citações, vocabulário, linha: `tauri.ts:1965-1980`), pasta de chat do livro, vínculo da nota | tudo é por `book.id` e `filePath`: serve ao vídeo sem mudar |
| Outros que leem `format` | — | `retell.ts:32`, `agents/agentData.ts:66`, `focusMap.ts:102`, `planNotes.ts:205`, `useRetell.tsx:12`, `vocabMatch.ts:110,128`, `vocabulary.ts:103-125`, `tauri.ts:285-295` (**`rowToBook` trata qualquer valor diferente de `'epub'` como PDF**) |

Os pontos de `format === 'epub'` nos agentes (Coach, plan-week, mapa de foco) fariam um vídeo aparecer como "N pages (PDF)" em silêncio: é o risco do "default que esconde o terceiro formato". A união discriminada (`types/index.ts:272`) só protege onde o código usa `switch` exaustivo.

### 2.2 Existe um leitor de texto corrido que sirva de base?

**O `DocsReader` não serve como base de lógica.** Ele lê `.md` de uma pasta do disco (árvore, watcher), renderiza com `renderMarkdown` num `dangerouslySetInnerHTML` memoizado (`DocsReader.tsx:294-296, 753`), e não tem seleção com âncora, ferramentas de língua nem colunas de Chat/Notes (spec languagestudy §17: "Translate e Listen no DocsReader" fora de escopo). Serve só de **referência visual** (cabeçalho, escala de fonte e margens: `49-57`).

Por isso o leitor de vídeo deve renderizar o texto com **elementos React** (um `<p>` por parágrafo, `<span data-i>` por frase), não com `innerHTML`. Isso evita o problema do React 19 reescrever o `innerHTML` quando o objeto muda (os trechos marcados e a seleção se perderiam). Texto que não muda não troca os nós, então as marcas por Range continuam válidas (Suponho).

### 2.3 Como o Library e o Mincer se falariam

- Hoje não se falam: nada no Mincer cita o Library. O padrão que já existe para artigos (Paper) é "Rust grava o arquivo, o frontend registra o livro" (`books.rs:85+`, `paperPdf.ts:3-45`), e o `openBookInLibrary(bookId)` já existe no `App` (`App.tsx:2299-2303`) e é passado ao Chat.
- **Recomendado**: item `done` do Mincer ganha o botão **"Open in Library"** (explícito, como Send to notebook; spec §1: nada entra sem clique). O botão lê `mincerGet(id)`, grava o arquivo, chama `registerVideoBook` e `onOpenBook`. O Library guarda **cópia** do texto: apagar o item do Mincer não afeta o vídeo no Library. O escritor de `books` continua o frontend, como no resto.
- **Onde o link é colado**: na aba **YouTube do Mincer**, que já existe (`MincerNew.tsx:39-45, 607-612, 738-742`), com uma opção "Study video". Atalho opcional no Library (o cabeçalho tem "Add docs folder" e "Import book", `Library.tsx:464-480`): um campo de link que chama `mincerStart`. O Library não acompanha o job (só recebe `mincerRecording`, `Library.tsx:54`); o acompanhamento é o do Mincer: botão da Toolbar com spinner e toast nativo ao terminar (spec §3). Isso respeita "nunca interromper".

## 3. Reaproveitamento dos recursos de língua

### 3.1 Independentes do leitor (Lido: nenhum importa pdf.js, epubjs ou `Reader.tsx`)

- **Componentes** (`src/components/LanguageTools/`): `LanguageBar` (36 linhas, 3 callbacks), `TranslatePopover` (650), `SavedWordPopover` (182), `VocabularyTab` (271), `SendVocabularyModal` (305), `MiniPlayer` (402; recebe `player: ListenPlayer`), `VoiceModelPicker`. Só tocam `Reader/toolbarPlacement` e `Reader/QuoteToNoteModal`, que são compartilhados.
- **Hooks**: `useBookVocabulary(book, enabled)`, `useVocabularySend`, `useVocabularyMarks`, `useVocabularyRemoval`, `useReaderTeacher` (lê `pageItems` da "página" atual), `useRetell` (só pede `format: 'pdf'|'epub'`), `useBookQuotes`, `useListenPlayer` (TTS), `useLanguageSettings`, `useTtsCatalog`, `useColumnBox`.
- **Regras puras** (`src/lib/`): `sentences` (`splitSentences(text, language)`), `translate`, `vocabulary`, `vocabMatch`, `pageMarks` (`buildJoinedNodeText(root: Node)`, `rangeFromNodeOffsets`, `setPageMarks`: servem a qualquer elemento do documento), `teacherContext`, `retell`, `languageProfile`.
- **Colunas**: `ReaderChatPanel` e `ReaderNotesPanel` têm props genéricas (`book`, `getPageText(pageNum)`, `positionLabel`, `highlightLabel`, `contextChipLabel`: `ReaderChatPanel.tsx:87-127`). O contexto efêmero (`readerContext.ts:62-69`) diz "Current page text"; para vídeo, uma janela da transcrição (Suponho: cerca de 5.000 caracteres, ~5 min de fala) cabe no teto de 6.000 (`PAGE_TEXT_BUDGET`, linha 8).
- **Marcas entre formatos**: `useVocabularyMarks` casa por texto e língua, então palavras guardadas num PDF ou EPUB da mesma língua **também marcam a transcrição** sem trabalho extra.

### 3.2 Ligadas dentro de `Reader.tsx` e `EpubReader.tsx`

O `EpubReader` (2.714 linhas) faz a ligação; estimo **~770 linhas (cerca de 28%)** por intervalos de linha que li: imports (67-102), estado e hooks (351-518), marcas no texto (617-672), teclas (690-763), handlers de Translate/Listen/vocabulário/palavra marcada/feedback (1341-1680), JSX da barra, popovers, aba Vocabulary e modais (2152-2203, 2364-2460, 2595-2687). Cada formato "entrega só um adaptador" (spec §1), mas o adaptador é grande.

O que um leitor HTML próprio teria de ligar, e quanto custa (Suponho):

| Ligação | Tamanho | Observação |
|---|---|---|
| `toolsOn`, `useLanguageSettings`, catálogo TTS, `useListenPlayer` | ~40 linhas | cópia direta |
| Seleção → `selection` (texto, Range, retângulo) e posição da barra (`placeSelectionToolbar`) | ~120 | mais simples que no EPUB: `window.getSelection()` no documento principal, sem iframe nem CFI |
| Barra de língua + Translate (frase de contexto, ocorrência da seleção) | ~150 | `contextSentenceAt` + `countTermBefore` já existem; só muda de onde vem o texto |
| Vocabulário: rascunho com âncora de vídeo, Add, aba, abrir item (saltar o vídeo), "Listen to list", remoção | ~150 | |
| Marcas no texto (`findTermOccurrences` sobre `buildJoinedNodeText(container)`) e clique em palavra marcada | ~100 | os Ranges ficam no mesmo documento |
| Professor, Retell, "Ask for feedback", Chat e Notes | ~80 | |
| Teclas (guarda `ownsKeyboard`) | ~50 | ver seção 5 |
| **Total TSX da ligação** | **~600 a 800 linhas** | **~300 se antes se extrair um hook comum**, o que não existe e que o código chama de "duplicação deliberada" (`EpubReader.tsx:168-169`, `DocsReader.tsx:47-48`) |

### 3.3 Comparação das opções do R3

| Critério | (a) Formato `video` com leitor próprio | (b) Transcrição em EPUB com âncoras de tempo, no `EpubReader` | (c) Outras |
|---|---|---|---|
| Reaproveitamento | todos os componentes e hooks de língua; religar ~600-800 linhas | o máximo: religação zero, tudo já está no `EpubReader` | (c1) igual a (a) depois de extrair o hook comum; (c2) tela no Mincer, sem Library: perde Vocabulary, Chat e Notes por livro; (c3) `DocsReader`: sem ferramentas |
| Âncora de grifo e de vocabulário | tipo novo `{ format:'video', t, seg, start, end }` (ver 3.4) | **CFI, grátis**; o tempo se acha no `[data-t]` mais próximo do CFI | |
| Sincronização e UX | rolagem normal, frase atual por classe no `<span>`, "voltar à frase atual" | o leitor é **paginado e a área não rola** (spec languagestudy §8; `.pageArea` com `overflow: hidden`). Manter a frase à vista exige `display(cfi)`, que o próprio código marca como "operação imprecisa" (`EpubReader.tsx:988-996`, "14 de 40 páginas em spread"). O usuário não rola livremente | |
| Painel de vídeo em cima | layout novo, sem restrição | não há lugar: seria enxertar slot e sincronia num arquivo de 2.714 linhas | |
| Custo de manter | três leitores (o novo é o menor: sem pdf.js, epubjs nem iframe) | sem leitor novo, mas o `EpubReader` passa a conhecer vídeo; os dois ficam emaranhados | |
| Dados e infra | formato novo em ~8 pontos (2.1); arquivo `.video.json` | exige gerar um EPUB válido (zip). O `jszip` só existe como dependência transitiva do epubjs (não está no `package.json`); `Cargo.toml` não tem crate de zip | |
| Risco | médio (volume) | alto (UX da sincronia, epubjs, imprecisão do reposicionamento) | (c1) mexe nos dois leitores atuais, que têm trabalho sem commit |

**O código favorece (a).** (b) parece barato pela religação zero, mas o custo aparece no que importa ao pedido: a frase acompanhando o vídeo numa área paginada. **(c1) é boa evolução**, mas só depois de o leitor novo existir e provar o padrão; fazer antes é refatorar dois leitores recém-entregues e sem commit, sem necessidade.

### 3.4 A âncora de vídeo

Proposta (Suponho): `VocabularyAnchor` ganha `{ format: 'video'; seg: number; start: number; end: number; t: number }`, com `seg` o índice do trecho da transcrição, `start`/`end` os offsets de caracteres dentro do texto do trecho e `t` o início do trecho em segundos (para saltar o vídeo sem depender do texto). `page` do item = minuto + 1 (então o professor, que filtra por `item.page === pageNum`, recebe "o que foi guardado neste minuto") e `positionLabel` = "12:34". A transcrição não é editável (spec Mincer §10), então os offsets são estáveis como os do PDF. Um "Regenerar a transcrição" quebraria as âncoras: o `t` serve de reserva.

Pontos a mudar: `types/index.ts:308-310`, `parseVocabularyAnchor` (`vocabulary.ts:103-125`), `vocabMatch.ts` (frases guardadas → Ranges), `retell.ts:32` (rótulo "12:34–15:02"), o abrir-item do leitor. **Grifos** (`book_highlights`: `page`, `rects_json NOT NULL`, `cfi`; `lib.rs:1729-1737, 1796`) pedem coluna nova de âncora; sugiro **fora da primeira fase**. O ensure de coluna (`addMissingColumns`) evita migration, que o projeto já evita por causa do histórico de checksum (`documents.rs`, bloco que reconcilia a v11).

## 4. CSP e configuração do Tauri

**Lido:**

- **CSP atual** (`tauri.conf.json:46`): `default-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' blob:; img-src 'self' data: https: blob:; font-src 'self' data: blob:; frame-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost https://openrouter.ai https://api.tavily.com`.
- **Origem da página**: dev = `http://localhost:1420` (`devUrl`, linha 8; `vite.config.ts` fixa a porta). Produção = `http://tauri.localhost`: **não há `useHttpsScheme`** no `tauri.conf.json`, e a documentação do Tauri 2 diz que no Windows o padrão é `http://tauri.localhost`. Dois relatórios antigos do projeto já registram isso (`explorerreport_20260706013718.md:26`, `reviewreport_20260807221203.md:189`).
- **Iframe que já existe**: só os do EPUB, criados pelo epubjs com `sandbox="allow-same-origin"` e conteúdo **local** em `srcdoc` (`node_modules/@likecoin/epubjs/src/managers/views/iframe.js:94, 403-404`); sem `allow-scripts`. **Não há nenhum iframe para domínio remoto.** O YouTube seria o primeiro.
- **CSP no dev**: com `devUrl`, a página vem do Vite, e a doc do Tauri mostra que o CSP injetado é o dos assets do protocolo custom (`csp_header: None` no ramo de dev). **Suponho que o dev não aplica o CSP**, então um embed que funciona em `tauri dev` pode falhar no build. A prova tem de ser num build de produção.

**O que um iframe do YouTube pede (menor mudança possível):**

| Variante | `frame-src` | `script-src` | `connect-src` / `img-src` / `media-src` |
|---|---|---|---|
| Só iframe, controlado por `postMessage` (sem script remoto) | `+ https://www.youtube-nocookie.com` (ou `www.youtube.com`) | **intocado** | nada: o vídeo toca dentro do documento do iframe, com o CSP dele; `img-src` já tem `https:` |
| Com o script oficial da IFrame API | idem | `+ https://www.youtube.com` (o script oficial carrega outro script do mesmo host) | nada |

A primeira mantém a postura documentada de não abrir `script-src` (`taskreport_20260807211648.md:37`). Se o `postMessage` é suportado de forma estável e quais domínios o script oficial usa é da exploração do player (não li).

**Acesso ao IPC pela página remota (resposta: não, confirmado na configuração e na doc):** `capabilities/default.json` vale para as janelas `main`, `assistant` e `keep`, e **não tem bloco `remote`**. A doc do Tauri 2 diz que "por padrão a API só é acessível ao código empacotado" e que fontes remotas só entram por `remote.urls`; a ressalva da doc sobre não distinguir iframe da janela é para **Linux e Android**, e o app só empacota NSIS e MSI (`tauri.conf.json:59`). Também não há `withGlobalTauri`. Além disso a página do YouTube é de outra origem e não alcança o `window` do pai. O listener de `postMessage` do app deve checar `event.origin` e `event.source`. Não testei (Suponho para o WebView2; a doc é a base).

**Não trocar `useHttpsScheme` para "resolver" a origem do YouTube.** Mudar o esquema muda a origem, e a doc de migração do Tauri diz que localStorage, IndexedDB e cookies **são zerados**. O chat e as preferências do app vivem em `localStorage` (`useChat.ts:248-252`, chaves `monet:*`).

## 5. Tela

### 5.1 Estrutura do leitor (Lido, `EpubReader.tsx`)

`.reader` (coluna) → `.toolbar` (voltar ao Library, páginas, fonte, margem, Listen to page, abas Chat/Notes: `1860-2043`) → `.readerBody` (linha, `CSS:112`) com **três colunas**:

1. **`aside` "Book navigation"** à esquerda: abas **Contents, Highlights e Vocabulary** (`2115-2162`; largura 48 recolhido por padrão, 280, ou 300 com as ferramentas de língua: `162-166, 334`).
2. **`.pageArea`** no meio (`2334-2543`): `flex: 1`, `overflow: hidden`, `padding: 24px`, folha `.viewerSurface` branca de até 860 px.
3. **Chat e Notes** à direita (`ReaderChatPanel` e `ReaderNotesPanel`, sempre montados, só escondidos: `2549-2592`; largura 260 a 560, padrão 340, fechado por padrão: `ReaderChatPanel.tsx:70-72`, `EpubReader.tsx:370`).

Observação: o Task Report diz que o Vocabulary está na coluna da direita. **No código ele é a terceira aba da coluna da esquerda**; a direita só tem Chat e Notes (`SideTab = 'chat' | 'notes'`, linha 198).

### 5.2 Onde cabe o vídeo

Dentro da coluna do meio, que vira coluna flex: **vídeo fixo em cima, transcrição rolável embaixo**. As abas da esquerda se adaptam: "Contents" vira capítulos do vídeo (o yt-dlp traz `chapters`; Suponho), "Highlights" fica fora da fase 1.

Orçamento de largura (Lido: janela mínima 960 × 600, `tauri.conf.json:19-20`): com a navegação recolhida e o chat aberto sobra **960 − 48 − 340 = 572 px** para o meio; um 16:9 nessa largura tem 322 px de altura, mais da metade da janela de 600. O painel de vídeo precisa de **teto por altura (cerca de 40% da coluna) e divisória ajustável**, lembrada em `localStorage` como as outras preferências. Com a navegação expandida e o chat aberto o meio cai a ~320 px: o vídeo fica pequeno e a divisória é obrigatória.

### 5.3 Trocar de modo

O `App` troca o modo por ternário (`App.tsx:~4705-4730`; atalhos `Ctrl+1…4`, linha 475): **o `Library` desmonta**, o iframe sai do DOM e o vídeo para. É o mesmo comportamento já aceito para o áudio do Listen (spec languagestudy §8). O leitor de vídeo deve gravar a posição no unmount, no padrão do `flushPendingPosition` (`EpubReader.tsx:1049-1055`). Ao voltar ao Library, `OPEN_BOOK_KEY` (`Library.tsx:141-147`) reabre o mesmo item e retoma do tempo salvo.

### 5.4 Teclas

- Os atalhos do leitor são um `keydown` no `window` (`EpubReader.tsx:765-771`) com a guarda `ownsKeyboard` (`keyboardTarget.ts:5-12`): setas e Shift+setas, Espaço (com o player aberto), R, L, T, V, H, Esc.
- **O EPUB já resolve o "foco dentro do iframe" repassando o keydown do epubjs** (`EpubReader.tsx:905-907`). Com o iframe do YouTube isso é **impossível**: é outra origem, o pai não recebe nenhuma tecla enquanto o foco está nele. Nada dispara em dobro; o efeito é uma **zona morta**: depois de clicar no vídeo, nem os atalhos do leitor nem os globais do app (`Ctrl+1…4`, Ctrl+P) funcionam até o usuário clicar fora.
- Sobreposição de teclas do YouTube com o foco no player (Suponho, pelo comportamento conhecido do player): Espaço/K (tocar), ←/→ (±5 s), J/L (∓/±10 s), M, F, C, 0 a 9, `<`/`>` (velocidade). **L colide com "Listen"** do leitor e o Espaço com o do player de voz; no leitor de vídeo o Espaço deve controlar o vídeo.
- Mitigações a provar na fase 0: devolver o foco ao documento depois de uma interação (`iframe.blur()`), `disablekb=1`, ou controles próprios com `controls=0` e botões nossos.

## 6. Viabilidade, fases e riscos

### 6.1 Tabela por peça

| Peça | Reaproveita / novo | Dificuldade | Observação |
|---|---|---|---|
| Legendas pelo yt-dlp (`fetch_info`, download, parser json3/vtt) | reaproveita sidecar, Job Object, cancelamento, marcador; novo parser | Média | `EXTRACTOR_ARGS` com legendas é ponto aberto; yt-dlp pinado de março, sem atualizador |
| Tempo no áudio + transcrição | reaproveita fila, cache por pedaço, retomada; novo: tempo na resposta, `.seg.json`, deslocamento | Média | depende de o endpoint devolver tempo (não lido); sem sobreposição |
| Coluna `timed_json` + kind `youtube_study` | reaproveita o ALTER guardado e o molde de `web_capture` | Baixa-Média | ~8 pontos de kind; não exigir chave quando a legenda basta |
| Ponte Mincer → Library ("Open in Library", `registerVideoBook`, `books_write_file`) | reaproveita `openBookInLibrary`, `books_read_file`/`delete_file` | Baixa-Média | o frontend registra o livro, como no Paper |
| Formato `video` em tipos, storage, Library (lista, abrir, apagar) e agentes | reaproveita `books`, `deleteBook`, `handleDelete` | Média | muitos pontos pequenos; risco do fallback para PDF (2.1) |
| Coluna `resume_sec` e `video_id` | reaproveita `addMissingColumns` | Baixa | |
| Leitor `VideoReader` (toolbar, colunas, texto, seleção) | referência visual do DocsReader; resto novo | Média | ~1.000 a 1.300 linhas TSX + CSS, contra 2.714 e 3.260 dos outros |
| Player embutido (wrapper, origem, foco, CSP) | novo | **Alta (incerteza)** | prova obrigatória em build de produção |
| Sincronização (tempo → frase atual, frase → salto, rolagem, "voltar à atual") | novo; `splitSentences` reaproveitado para virar frases | Média | trechos de legenda são curtos: frase = união de trechos, com o início do tempo do trecho que a abre. Cuidado com o re-render a cada tick |
| Barra, Translate, SavedWord, Vocabulary, Send, Retell, professor, marcas | reaproveita 100% dos componentes e hooks | Média-Baixa | religar ~600-800 linhas |
| Âncora de vídeo e rótulos | novo, pequeno | Baixa | 3.4 |
| Chat e Notes | reaproveita `ReaderChatPanel` e `ReaderNotesPanel` | Baixa | `getPageText` = janela da transcrição; ajustar o rótulo "Current page text" |
| Controles de estudo (repetir frase, voltar, velocidade) e Listen no áudio original | novo; `MiniPlayer` reaproveitável só na casca (voltar, avançar, repetir, velocidade, progresso) | Média-Alta | o `MiniPlayer` leva menu de voz e custo, que não se aplicam; parar no fim da frase depende da precisão do tempo do player |
| Grifos no vídeo | novo (coluna de âncora) | Média | sugerido fora da fase 1 |
| CSP e Settings | novo, mínimo | Baixa | a decisão é do Coordenador |

### 6.2 Fases sugeridas

- **Fase 0, provas (sem produto):** (1) **embed no WebView2 em build de produção**, origem `http://tauri.localhost`, com a única mudança de `frame-src`: erros do player, controle por `postMessage`, foco e teclas, `iframe.blur()`, o iframe saindo do DOM ao trocar de modo; (2) legendas pelo yt-dlp **com os `EXTRACTOR_ARGS` do app**, em 1 ou 2 vídeos públicos; (3) tempo na resposta do endpoint de transcrição com ~1 min de áudio (chamada paga mínima, exige OK do Coordenador); (4) o IPC não alcançável pelo iframe remoto; (5) `currentTime` do player a que frequência e com que precisão.
- **Fase 1, fatia vertical sem língua:** kind `youtube_study` com legendas, coluna `timed_json`, "Open in Library", formato `video`, `VideoReader` com vídeo + transcrição sincronizada, posição guardada, apagar.
- **Fase 2, língua:** Translate, vocabulário com âncora de vídeo, marcas, SavedWord, Chat e Notes, professor, Retell.
- **Fase 3, reserva e estudo:** áudio + transcrição com tempo; repetir frase, pausa ao fim, velocidade; Listen no áudio original.
- **Fase 4, acabamento:** "Add video" no Library, dedupe por `video_id`, grifos, extração do hook comum de ligação (c1).

### 6.3 Riscos que o código mostra

1. **CSP no dev não vale como prova.** Só um build de produção diz se o embed carrega.
2. **O fallback para PDF.** `Library.tsx:430` e `tauri.ts:285-295` tratam o que não é EPUB como PDF; agentes usam `=== 'epub'`. Um `video` sem ramo abriria no leitor errado ou entraria como "pages (PDF)" nos agentes.
3. **Dois escritores no mesmo `monet.db`** (Rust: `mincer_items`; frontend: `books`). Manter a ponte no frontend, como o Paper, evita quebrar o dono de cada tabela.
4. **O yt-dlp envelhece.** O binário é de 2026.03.17, sem atualizador, e os clientes `android,mweb` estão fixos em `youtube.rs:9`; legendas e áudio quebram juntos quando o YouTube mudar. O `fetch_title` já engole a falha e deixa "YouTube video" no título.
5. **Foco do iframe.** Zona morta de teclado depois de clicar no vídeo, sem como repassar as teclas (ao contrário do EPUB).
6. **Tempo ausente ou impreciso** no endpoint: sem ele, só há texto, sem sincronia por frase.
7. **Custo de manter três leitores** com ~770 linhas de ligação repetidas.
8. **Dependência do Mincer**, que está apartado das releases (spec Mincer; backlog de MSIX, `DOCS/backlog.md:73`): a funcionalidade herda isso.
9. **Mincer gravando som do sistema** captura o áudio do vídeo. O `Library` já recebe `mincerRecording` (`Library.tsx:54`) e o Listen já avisa; o vídeo deve avisar do mesmo jeito.
10. **Línguas sem espaço e escrita da direita para a esquerda ficam fora**: o casamento de palavras usa fronteira de letra (`vocabMatch.ts:65-93`), que não separa palavras em escrita sem espaço, e o player não foi testado nelas (spec §17).
11. **Vídeo removido ou privado depois**: o texto fica no arquivo do Library; só o player falha (Suponho: o app precisa de um estado "vídeo indisponível" no painel).

## 7. Sem resposta (para as outras explorações e a fase 0)

- O endpoint devolve tempo, em quais modelos e em que granularidade (Seção 1.2).
- Os `EXTRACTOR_ARGS` do app (`android,mweb`) devolvem legendas; formato e tempo delas.
- O embed carrega em `http://tauri.localhost`, quais erros dá, e se o `postMessage` sem script remoto basta.
- O dev realmente não aplica o CSP (só a doc e o código do Tauri como base, não testei).
- O WebView2 bloqueia o IPC para o iframe remoto (a base é a doc do Tauri e a configuração; não testei).
- Precisão e frequência do `currentTime` do player (define o "pausar ao fim da frase").
- Tamanho real do JSON de uma hora de transcrição, e custo por hora (R7, das outras explorações).
- Chaves de preferência novas (`monet:video-*`) e o nome do kind: decisão de desenho para o plano.

## 8. Nível de dificuldade e recomendação

**Média-Alta no total**, Alta só no player embutido. Recomendo: **(a) formato `video` com leitor próprio**, **legendas primeiro e áudio como reserva**, ponte pelo botão "Open in Library" no Mincer, **fase 0 de provas antes de qualquer código**, grifos fora da primeira entrega, e a extração de um hook comum de ligação de língua só depois que o leitor novo provar o padrão. A única mudança de CSP é `frame-src` (variante só com iframe e `postMessage`), decisão do Coordenador.
