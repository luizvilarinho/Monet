# Explorer Report — código — Library para estudo de línguas

> Task Report: `DOCS/reports/26-11-2026/taskreport_20261126134217.md` (parte de código do R1 e o R7). Branch lida: `feat/mincer` (43a9ae8). Nenhum código foi alterado, o app não foi executado e o banco de produção não foi lido. O que depende de rodar o app está marcado como **a conferir**.

## 1. O problema

O usuário abre no Library um livro numa língua que está aprendendo e quer ouvir o texto, traduzir o que selecionou, guardar palavras e praticar. Hoje o leitor grifa, cita e conversa com a IA sobre a página, mas não toca áudio, não traduz e não guarda vocabulário. A pergunta deste relatório é o que o código atual já entrega para isso, o que é novo e o que atrapalha.

**Dificuldade geral: Média.** Traduzir, ouvir a seleção, idioma por livro e o modo professor no chat são baratos. O item caro é a leitura contínua com frase marcada **no PDF**.

## 2. O que muda o desenho da proposta

1. **O texto do PDF é o ponto fraco, o do EPUB é limpo.** No PDF a seleção vem com quebras de linha e palavras hifenizadas, o texto da página ignora o fim de linha, não há filtro de cabeçalho, rodapé nem nota de rodapé, e só uma página existe na tela por vez. No EPUB o capítulo inteiro está no DOM, com parágrafos de verdade. A leitura contínua deve sair primeiro no EPUB; no PDF ela é outra entrega, mais cara e com resultado pior em PDFs de layout complexo.
2. **Áudio por frase, não por parágrafo.** A frase é a unidade da marca no texto, do "repetir" e do cache. Com um áudio por frase, o início e o fim de cada áudio já dizem qual frase marcar, sem depender de o provedor devolver tempos por palavra. No PDF nem existe parágrafo no text layer (só fragmentos de linha).
3. **Translate não precisa de Rust novo.** O comando `openrouter_stream_chat` (`src-tauri/src/lib.rs:1155`) já recebe modelo, system prompt e mensagem e devolve em streaming. Só o TTS pede um módulo novo no Rust.
4. **TTS pelo Rust não mexe no CSP.** O CSP só vale para pedidos da WebView. O `<audio>` com `blob:` já passa pelo `default-src 'self' blob:` (`src-tauri/tauri.conf.json:46`). Um provedor direto de voz pede só a chave nova e a seção no Settings.
5. **Tabela e coluna novas não entram por migration.** A versão mais alta é a 18 (`src-tauri/src/lib.rs:1837`) e as migrations não rodam no banco de produção (`src/storage/tauri.ts:585-588` e `1150-1155`). O padrão em uso é `ensure…` no `storage/tauri.ts`.
6. **O chat do leitor não aceita agentes** por regra (`src/hooks/useChat.ts:984-990`). O professor de língua entra como um bloco a mais no contexto efêmero, que é o padrão já validado, e não como `ChatAgentDef`.
7. **O áudio para sozinho ao trocar de modo.** O Library só fica montado no modo Library (`src/App.tsx:4662-4694`); Ctrl+1…4 desmonta o leitor. Ouvir o livro enquanto escreve no caderno exigiria subir o player para o `App`, o que fica fora do começo.
8. **A gravação do Mincer captura o TTS.** O loopback grava a saída padrão do Windows (`src-tauri/src/mincer/record.rs:479-490`), sem excluir o próprio app.
9. **O leitor de EPUB não tem busca no livro** (Ctrl+F existe só no PDF, `Reader.tsx:1271-1283`). Isso pesa no "reencontrar a palavra no contexto".

## 3. Diagnóstico por leitor

### 3.1 PDF (`src/components/Reader/Reader.tsx`, 2.367 linhas)

**De onde vem o texto**
- Só a página atual é renderizada (canvas + text layer), sem rolagem contínua: `Reader.tsx:747-1009`. Trocar de página volta o scroll ao topo (`1091-1093`) e fecha seleção, popover e destaques de busca (`1211-1215`).
- `getPageText(n)` usa `page.getTextContent()`, junta os `str` com espaço e colapsa os espaços (`693-716`). Serve qualquer página **sem renderizar**, com cache por página. Ignora o `hasEOL` de cada item, então "exem-" + "plo" vira "exem- plo".
- A seleção usa `window.getSelection().toString().trim()` sobre o text layer (`1390-1441`). O pdf.js põe um `<br>` a cada fim de linha (`node_modules/pdfjs-dist/build/pdf.mjs:14514-14518`), então o texto selecionado traz quebras de linha no meio da frase e o hífen de fim de linha. Os retângulos vêm de `range.getClientRects()` normalizados de 0 a 1 pela caixa do text layer (`1417-1427`), por isso sobrevivem ao zoom.
- Página sem texto (PDF escaneado) vira `null` e mostra a faixa de aviso (`1144-1153`, `1874-1879`).

**Como os destaques são desenhados**
- Três camadas sobre o canvas (`Reader.module.css:413-448`): `highlightLayer` (grifos, z 1), `searchMatchLayer` (busca, z 2) e `textLayer` (z 2, texto transparente). Todas com retângulos absolutos em porcentagem (`Reader.tsx:2113-2151`).
- A busca reconstrói o texto pelos `<span>` do text layer (`getPageSpans`, `buildJoinedPageText`, `353-379`), acha os offsets e monta um `Range` que pode atravessar vários spans (`buildRangeFromOffsets`, `381-409`; `findAllOccurrenceRanges`, `416-433`). `computeSearchMatchRects` transforma os ranges em retângulos (`1350-1377`).

**Dá para marcar a frase que está sendo lida?** Sim. O caminho offset → `Range` → retângulos já existe e é o mesmo que a frase precisa. Falta só uma quarta camada (ou o CSS Custom Highlight, ver §5). O pdf.js também expõe `textDivs` e `textContentItemsStr` na `TextLayer` (`node_modules/pdfjs-dist/types/src/display/text_layer.d.ts:83-89`), que ligam cada item do `getTextContent` ao seu span.

**O que atrapalha áudio e tradução**

| Problema | Situação no código | O que seria preciso |
| --- | --- | --- |
| Hifenização de fim de linha | Não tratada (`693-716`, `1405`) | Função pura que junta "-" + fim de linha + minúscula, com mapa de offsets para a marca continuar no lugar. Hífen real ("peut-être") em fim de linha vira falso positivo. |
| Cabeçalho, rodapé, número de página | Entram no texto da página | Heurística: linha que se repete no topo ou na base em páginas vizinhas, e número isolado. Pede a posição do item (`transform`), que hoje não é lida. |
| Nota de rodapé | Entra onde estiver no arquivo | Heurística por tamanho de fonte e posição. Não há solução geral. |
| Duas colunas | A ordem é a do arquivo PDF | Em geral vem coluna por coluna, mas não é garantido. Sem análise de layout. |
| Frase que continua na página seguinte | Só uma página na tela | `getPageText(n+1)` dá o começo da próxima sem renderizar; a frase pode ser falada inteira com a página N na tela e só então virar. É código novo e delicado. |

### 3.2 EPUB (`src/components/Reader/EpubReader.tsx`, 1.771 linhas; `src/lib/epub.ts`)

- O texto vive num iframe do epubjs, um item de spine (capítulo) por vez, paginado em colunas. Todo acesso à lib passa por `src/lib/epub.ts`.
- **Trecho visível:** o evento `relocated` entrega o CFI de início e de fim da tela, guardados em `visibleRangeRef` (`EpubReader.tsx:562-590`). `getEpubRangeText` devolve o texto entre os dois (`epub.ts:596-616`); a reserva é a fatia da location, cerca de 1.600 caracteres (`572-590`).
- **Seleção:** o evento `selected` do epubjs dispara 250 ms depois de a seleção parar e traz o CFI; o texto vem de `rendition.getRange(cfi).toString()` e o retângulo é traduzido para coordenadas da janela (`epub.ts:384-442`). O estado é `{ cfiRange, text, anchor }` (`EpubReader.tsx:148-152`).
- **Grifos:** `rendition.annotations.highlight(cfi, …)` desenha um SVG sobre o iframe (`epub.ts:478-506`); o efeito de sincronização desenha, redesenha e remove só o que mudou (`EpubReader.tsx:797-828`). A chave da anotação é `cfi + tipo` (`node_modules/@likecoin/epubjs/src/annotations.js:35`).
- **Marcar a frase atual:** o documento vivo está em `rendition.getContents()` (já usado em `epub.ts:447-458`). Dá para percorrer os nós de texto do capítulo, segmentar em frases, criar um `Range` por frase e convertê-lo com `contents.cfiFromRange` (`node_modules/@likecoin/epubjs/types/contents.d.ts:37`). A marca pode ser `annotations.underline` (tipo diferente do grifo, para não colidir) ou o CSS Custom Highlight dentro do iframe.
- **Virar a página com o áudio:** comparar o início da frase com o fim visível e chamar `rendition.next()` (`EpubReader.tsx:434-436`). Como o capítulo inteiro está no DOM, a frase que atravessa a "página" não é problema; só a troca de capítulo precisa esperar o próximo `relocated`.
- **Cuidados já documentados no código:** o `display` do epubjs pode parar uma página antes (`epub.ts:302-350`, por isso `displayEpubAt` e `resumeEpubAt`); o `relocated` fecha seleção e popover a cada virada (`EpubReader.tsx:583-588`), então um popover de tradução aberto some se a página virar sozinha; cliques dentro do iframe só chegam ao app pelos eventos repassados (`631-635`); há livros que são um único XHTML de 1 MB (`epub.ts:567-571`).
- Qualidade do texto: boa. Sem hifenização artificial, sem cabeçalho e rodapé. Chamada de nota (`<sup>`) é lida como número.

### 3.3 DocsReader (`src/components/Library/DocsReader.tsx`, 766 linhas)

- Renderiza markdown como HTML no documento principal (`748-754`). **Não tem** barra de seleção, grifo, chat, notas nem registro em `books`: a pasta é um item de `localStorage` (`src/lib/docsFolder.ts:54`).
- Levar Translate e Listen para ele custa pouco **depois** que o popover e o player existirem como componentes comuns: falta uma barra de seleção (o `placeSelectionToolbar` serve) e é o DOM mais simples dos três. Sem `book_id`, vocabulário e idioma por livro não se aplicam.
- Recomendação: fica fora das primeiras fases.

### 3.4 Jornada (o que existe e o que falta)

| Passo | PDF | EPUB | Docs |
| --- | --- | --- | --- |
| Importar | Sim, até 50 MB (`books.rs:15`, `src/lib/books.ts:41-128`) | Sim, sem DRM | Pasta local |
| Idioma do livro | Não existe | Não existe (o OPF tem, não é lido) | Não |
| Ler, zoom, sumário | Sim | Sim | Sim |
| Buscar no livro | Sim (Ctrl+F) | **Não** | Não |
| Selecionar: grifar, copiar, citar, Ask AI | Sim (`Reader.tsx:2153-2199`) | Sim (`EpubReader.tsx:1571-1617`) | Não |
| Traduzir, ouvir | Não | Não | Não |
| Guardar palavra | Não | Não | Não |
| Rever depois | Só os grifos do livro. O glossário do `/define` (`src/lib/agents/define.ts`) existe apenas nas notas do caderno; o editor da aba Notes do leitor não tem slash | Idem | Não |

## 4. Respostas às perguntas

**4. Barra de seleção e popover**
- Os botões entram depois do "Ask AI" nas duas barras (`Reader.tsx:2191-2197`, `EpubReader.tsx:1609-1615`). Hoje a barra só tem texto, sem ícone.
- A posição da barra já é comum: `placeSelectionToolbar(anchor, size, bounds)` (`src/components/Reader/toolbarPlacement.ts:22-37`), genérica o bastante para um popover maior.
- O popover de grifo (`removalCandidate`) é `position: absolute` dentro do container da página, com `left/top` simples e sem limite à direita nem embaixo (`Reader.tsx:1646-1653`, `EpubReader.tsx:1076-1083`). z-index local: barra 3 e popover 4 no PDF (`Reader.module.css:453`, `511`); 6 e 7 no EPUB (`EpubReader.module.css:510`, `568`). No PDF os dois são filhos do `.pageWrap`, dentro do `.pageArea` com `overflow: auto`; no EPUB, do `.pageArea` com `overflow: hidden`. **Um popover de tradução nesse padrão seria cortado na borda.** O certo é `position: fixed` em portal, acima de 1000 (o `ReaderToast` usa 1100 e o `QuoteToNoteModal` 1000).
- Os "clique fora fecha" conhecem só a barra e o popover atuais (`Reader.tsx:1444-1456`, `EpubReader.tsx:832-843`): o popover novo precisa entrar neles. As ações atuais limpam a seleção ao clicar (`Reader.tsx:1521-1526`); o Translate deve mantê-la.
- **Compartilhado hoje:** `useHighlights`, `useBookQuotes`, `ReaderChatPanel`, `ReaderNotesPanel`, `QuoteToNoteModal`, `ReaderToast`, `toolbarPlacement`, `readerContext`. **Duplicado de propósito:** a barra, o popover, o painel de grifos (cerca de 110 linhas em cada leitor) e o CSS.
- **Lugar natural:** `src/components/Reader/` para `TranslatePopover`, `ReadAloudPlayer` (mini-player) e `VocabularyPanel`; `src/hooks/` para `useReadAloud` e `useVocabulary`; `src/lib/` para as funções puras. Cada leitor entrega só um adaptador pequeno ("me dê as frases a partir daqui, marque a frase i, vá para a próxima página").

**5. Áudio na WebView**
- Bytes do Rust para o front: `books_read_file` devolve `tauri::ipc::Response::new(bytes)` (`src-tauri/src/books.rs:249-272`) e o front recebe `ArrayBuffer` (`src/lib/books.ts:22-25`). É o caminho para o áudio: `Blob` → `URL.createObjectURL` → `<audio>`.
- CSP (`tauri.conf.json:46`): sem `media-src`, vale o `default-src 'self' blob:`. `blob:` passa; `data:` não. O asset protocol não está ligado (sem `assetProtocol` e sem `asset:` no CSP) e não é necessário.
- Streaming: o chat usa eventos globais com `request_id` (`app.emit("openrouter://chunk")`, `lib.rs:1429-1436`; `src/lib/openrouter.ts:115-147`) e cancelamento por `RequestRegistry` (`lib.rs:1196-1205`). Não há `Channel` no projeto. Para o áudio, uma chamada por frase com 2 ou 3 frases geradas à frente dispensa streaming de bytes.
- Não existe hoje `<audio>`, `speechSynthesis`, `createObjectURL`, `getUserMedia` nem `MediaRecorder` em `src/` (busca sem resultado).
- Velocidade: `playbackRate` com `preservesPitch` (padrão ligado no Chromium, base da WebView2). **A conferir de ouvido** abaixo de 0,75×.
- Vozes do sistema pelo Rust: o crate `windows` já é dependência (`Cargo.toml:41`); a voz do WinRT sairia como bytes pelo mesmo caminho. A qualidade fica com o relatório de voz.

**6. Rust**
- Chave: arquivo em `app_config_dir`, lido por `read_key(app, "openrouter_key")` (`lib.rs:182-200`). Uma chave de outro provedor segue o trio `save/has/clear` do Tavily e do OpenAlex (`lib.rs:236-275`).
- Chamada sem streaming com JSON: `deep_research_generate_sub_queries` (`lib.rs:541-643`). Cabeçalhos fixos `HTTP-Referer` e `X-Title`.
- Erro legível: `api_error(status, body, model)` do Mincer (`src-tauri/src/mincer/mod.rs:358-378`), frase acionável + linha em branco + detalhe. As frases dizem "then Resume", próprias do Mincer: o TTS precisa da sua versão. `key_check_error` (`lib.rs:304-312`) é a forma neutra.
- Retry: `transcribe_with_retry`, 3 tentativas com espera de 1 s e 2 s, só para 429, 5xx e rede (`mincer/transcribe.rs:205-235`).
- Onde morariam: um módulo novo (`src-tauri/src/speech.rs`) com `tts_speak` (devolve bytes, grava e lê o cache) e `tts_clear_book`. `translate` não precisa de comando.
- Cache em disco: `appData/books/` (`books.rs:26-34`) e `appData/mincer/<id>/` (`mincer/mod.rs:315-326`). Sugestão: `appData/tts/<bookId>/<hash>.mp3`, com o hash de texto + voz + modelo (a velocidade fica no `playbackRate`, fora da chave).
- Ao apagar um livro (`Library.tsx:176-220`): hoje sai o arquivo, `book_highlights`, `book_quotes`, `books`, a pasta de chat e o vínculo com a nota. Teria de sair também a pasta de áudio (`fs::remove_dir_all`, como `mincer/jobs.rs:355`) e as linhas de vocabulário (ou ficar, por decisão, como as citações já salvas em notas).
- Atenção: Mincer, trackers e Log por tipo só existem na linha do `feat/mincer`; o `develop` (3c7d7f2) não tem a pasta `mincer/`. A feature nasce desta branch.

**7. Banco**
- `books`, `book_highlights` e `book_quotes` são do frontend (tauri-plugin-sql); o Rust só mexe nos arquivos (`lib.rs:1700-1702`, `books.rs:1-4`). Regra de dono único por tabela.
- Tabela nova: `CREATE TABLE IF NOT EXISTS` num `ensure…` memoizado, no molde do `ensureTrackersTables` (`tauri.ts:1272-1305`). Coluna nova: `addMissingColumns` (`tauri.ts:642-657`). Sem `BEGIN/COMMIT`. Os métodos novos entram no `StorageAdapter` e nos dois adaptadores (`src/storage/tauri.ts` e `browser.ts`).
- **Idioma em `books`:** `language TEXT` via `addMissingColumns`. O `getBooks` usa `SELECT *` (`tauri.ts:1784`) e precisa passar a listar as colunas, pelo pânico do sqlx já documentado em `tauri.ts:1546-1548`. Preenchimento no import: no EPUB, `packaging.metadata.language` (hoje `readEpubInfo` lê só título e autor, `epub.ts:157-165`); no PDF, o metadado quase nunca traz a língua, então fica a detecção por amostra de texto ou a escolha manual. A edição cabe na linha do livro, junto de título e autor (`Library.tsx:150-173`).

| Casa do vocabulário | O que dá | O que custa |
| --- | --- | --- |
| **(a) Tabela `book_vocabulary`** | Campos certos (termo, forma base, frase, tradução, livro, página ou CFI, língua, data). Lista por livro e visão geral são uma consulta. Casar com o texto é barato. Export CSV direto. | Tudo de UI é novo (aba, visão geral, editar, apagar). Não aparece no Ctrl+P nem no RAG. Limpeza no `deleteBook`. |
| **(b) Tipo de nota "Vocabulary"** | Propriedades, board, Log, Ctrl+P, tags, RAG das notas, tracker vinculado ao tipo e o Editor para escrever com a palavra. Há precedente de tipo criado pelo app (`src/lib/paperSetup.ts:24-33`). | Uma nota por palavra: enche a lista do caderno e o array de notas em memória, e cada nota gera um envio ao índice do RAG (`src/hooks/useNotesIndexSync.ts`). Posição no livro (retângulos, CFI) não cabe em propriedade. Precisa de um caderno. Casar com o texto exige ler e interpretar notas. |
| **(c) Estender `book_highlights`** | Âncora, desenho no texto, clique com popover, painel e exclusão em cascata já prontos (`useHighlights`). | Todo consumidor de grifo passa a filtrar: o contexto do chat manda os 10 grifos mais recentes (`readerContext.ts:68-80`), o contador da aba, o "furthest highlight" do tutor e do coach (`src/lib/planNotes.ts:186-213`). Visão geral entre livros é nova de qualquer jeito. |

Recomendação: **(a)**, com a ação "Add to note" na palavra (o caminho de `appendBlockToNote`, `src/lib/bookQuotes.ts:109-117`, já grava na nota vinculada ao livro com Undo). A tabela é o índice para reencontrar; a nota é onde o usuário usa a palavra.

**8. Settings e configuração**
- Modelos do Mincer: seção própria no `SettingsModal` (`src/components/Settings/SettingsModal.tsx:63`, `833-945`), valores em `localStorage` (`src/lib/mincer.ts:97-102`), lista por modalidade em `GET /models?input_modalities=audio&output_modalities=transcription` (`mincer/transcribe.rs:237-263`). Uma seção "Language" (voz, modelo de voz, modelo de tradução, língua nativa) segue o mesmo molde, com `initialSection` para abrir direto nela.
- Locale: `navigator.language` gravado em `monet:user-language` (`src/App.tsx:271-277`), lido no chat e no calendário. Não há tela para trocar. É o padrão natural da língua de destino.
- Nota de configuração: o perfil de estudo é **por caderno**, achado pela tag `study profile` (`src/lib/studyProfile.ts:23-30`); o do Radar é **global**, tag `radar profile` (`src/lib/radarProfile.ts:20-28`), com leitura de campos "Rótulo: valor" (`46-54`). Um perfil de língua global (língua nativa, nível por língua, objetivo) serve bem nesse padrão, e o leitor já recebe `notes` por props.

**9. Chat do leitor como professor**
- "Ask AI" põe o trecho como citação no composer, cortado em 600 caracteres, sem enviar (`ReaderChatPanel.tsx:55`, `343-353`).
- A cada envio, `buildReaderContext` monta o bloco efêmero (livro, posição, texto da página até 6.000 caracteres, 10 grifos) (`readerContext.ts:8-10`, `46-83`; `ReaderChatPanel.tsx:400-421`).
- O painel não tem seletor de agente e `agentsAllowed` devolve `false` no modo `reader`. A pasta de chat do livro tem system prompt próprio (botão "System prompt", `ReaderChatPanel.tsx:433-441`).
- Custo de um modo professor: **baixo**. Um bloco a mais no `buildReaderContext` (língua do livro, língua nativa, nível, palavras guardadas desta página, instruções de professor) ligado por um toggle no cabeçalho do chat. É função pura, testável. Hoje o usuário já consegue algo parecido colando um prompt no system prompt da pasta.

**10. Prática sem memorização**
- Tracker vinculado a um tipo de nota conta o dia quando existe uma nota do tipo; o Log soma uma propriedade Number e agrupa por Text ou Select (`DOCS/specs/trackers.md` §6 e §7). Um tipo "Reading session" (Minutes, Book, Language, New words) daria constância e totais do mês sem código de gráfico, no molde do `setUpPracticeType` (`src/lib/practiceSetup.ts:13-22`). O leitor sabe medir minutos ouvidos e páginas e pode criar a nota (`onCreateNote` com `typeId` + `storage.setNoteProperties`, `tauri.ts:1624`). A ideia de "sessão de leitura no calendário" já estava na fase 4 do leitor e nunca foi feita (`DOCS/specs/Feature ebook-reader.md:26`).
- O tutor só recebe título, total de páginas, grifo mais distante e última página (`ReaderBookInfo`, `planNotes.ts:186-213`) e diz no contexto que não tem o texto do livro (`src/lib/agents/tutor.ts:157-163`). A tool `query_trackers` nunca vai ao chat do leitor (spec §8).
- Microfone: a gravação do Mincer é toda no Rust (WASAPI, `mincer/record.rs:220-275`), feita para gravação longa: uma por vez, sistema + microfone, vira item da fila de transcrição e a pasta some no fim. Para o usuário gravar a própria voz e ouvir, não se reaproveita como está. Dois caminhos: uma captura curta só de microfone no Rust (o `capture_stream` serve de base) ou `getUserMedia` + `MediaRecorder` na WebView (sem Rust, mas nunca usado no app; o pedido de permissão da WebView2 fica **a conferir**).
- Marcar no texto as palavras já guardadas, em qualquer livro: viável e barato. No PDF, `findAllOccurrenceRanges` já devolve os ranges de um termo na página; no EPUB, um percurso pelos nós de texto do capítulo. `Intl.Segmenter` separa palavras. O limite real é a **forma flexionada**: sem lematizador, só casam as formas já vistas (dá para guardar a forma base que o modelo devolve na tradução e casar as duas).

**11. Conflitos**
- Mincer: o TTS tocando entra na faixa de sistema de uma gravação em curso e conta como "áudio", o que adia a parada por silêncio. O estado da gravação já chega ao front (`onMincerRecord`, `src/lib/mincer.ts:315`): dá para avisar ou bloquear o Listen enquanto grava.
- Atalhos em uso nos leitores: ← e → (página), Esc (fecha barra e popover), H (grifa), Ctrl+F (busca, só PDF) (`Reader.tsx:1231-1283`, `EpubReader.tsx:447-474`). No app: Ctrl+P, Ctrl+N, Ctrl+1…4, Ctrl+Espaço, Alt+←, `?` e Ctrl+/ (`App.tsx:1481-1527`). Globais: Ctrl+M, Ctrl+K e Ctrl+Alt+R durante a gravação.
- Livres: Espaço (play/pause; no PDF ele rola a página, então precisa de `preventDefault` com o player ativo), T (traduzir), L (ouvir), R (repetir a frase), Shift+← e Shift+→ (frase anterior e próxima). No EPUB as teclas dentro do iframe já são repassadas (`EpubReader.tsx:593`). A lista de atalhos (`?`) não tem seção do leitor hoje.

**12. Testes**
- Vitest com happy-dom, `src/**/*.test.ts(x)` (`vitest.config.ts`), 31 arquivos ao lado do código. No leitor só existe `toolbarPlacement.test.ts`; `readerContext.ts` é puro e não tem teste.
- Rust: `npm run test:rust`, testes no próprio arquivo (`books.rs:290`), cerca de 100 no total.
- Onde ficariam: `src/lib/sentences.ts` (segmentação: abreviações, números, travessão de diálogo), `src/lib/pdfText.ts` (hífen, fim de linha, cabeçalho e rodapé, mapa de offsets), `src/lib/vocabulary.ts` (casar palavras, CSV), `readerContext.test.ts`; no Rust, chave de cache e frases de erro. `Intl.Segmenter` existe no Node e na WebView2, então a segmentação roda nos testes.

## 5. Viabilidade por funcionalidade

| Funcionalidade | Dificuldade | Reaproveita | Novo | Risco principal |
| --- | --- | --- | --- | --- |
| Ouvir a seleção (PDF e EPUB) | Baixa a Média | Texto da seleção, barras, bytes pelo `invoke`, `read_key`, padrão de cache | Módulo Rust de TTS com cache, `useReadAloud`, botão Listen nas duas barras, limpeza do texto do PDF, seção no Settings | Texto do PDF com hífen e quebra de linha; teto de tamanho da seleção (custo) |
| Leitura contínua com frase marcada — **EPUB** | Média | Capítulo inteiro no DOM, `cfiFromRange`, `relocated` com início e fim da tela, `rendition.next()` | Segmentação de frases, fila com frases à frente, marca da frase, virar página, troca de capítulo, mini-player | Imprecisão conhecida do `display`; `relocated` fecha popovers; capítulo de 1 MB |
| Leitura contínua com frase marcada — **PDF** | **Alta** | `getTextContent` de qualquer página, offset → Range → retângulos da busca, `goToPage` | Texto limpo com mapa de offsets, cabeçalho e rodapé, frase entre páginas, marca na página | Layout complexo lido fora de ordem ou com rodapé no meio; sem solução geral |
| Translate em popover | Baixa a Média | `openrouter_stream_chat`, `placeSelectionToolbar`, `renderMarkdown` | `TranslatePopover` comum (fixed, portal), prompts por tamanho, frase de contexto, cache, ajuste do "clique fora" | Popover cortado se seguir o padrão atual; frase de contexto ruim no PDF |
| Vocabulário: guardar | Baixa a Média | Molde do `useHighlights`, padrão `ensure…` | Tabela, tipos, métodos nos dois adaptadores, botão no popover | Escolha da casa; palavra repetida e formas flexionadas |
| Vocabulário: lista por livro | Baixa a Média | Coluna de navegação com abas, `jumpToPage` e `jumpToCfi` | Terceira aba como componente comum | Terceira cópia de JSX se não virar componente |
| Vocabulário: visão geral | Média | Tabela do Library, filtros de `bookList.ts` | Tela nova, export CSV e para nota | Onde mora na navegação do Library |
| Vocabulário: marcar palavra guardada no texto | Média | `findAllOccurrenceRanges` (PDF), DOM do iframe (EPUB) | Casamento por palavra inteira, marca visual, clique que abre o cartão | Forma flexionada não casa sem a forma base |
| Idioma por livro | Baixa | Metadado do EPUB, edição inline do Library | Coluna `language`, detecção no PDF, seletor | `SELECT *` em `books`; língua errada no PDF |
| Tradução paralela de parágrafo | Média (EPUB), Alta (PDF) | Parágrafos `<p>` do EPUB | Painel lado a lado, cache por parágrafo | No PDF não existe parágrafo; encosta em "a IA lê pelo usuário" |
| Modo professor de língua no chat | Baixa | Contexto efêmero, system prompt da pasta do livro | Bloco de língua no `buildReaderContext`, toggle, perfil de língua | Baixo |
| Ditado (ouvir e escrever) | Baixa a Média, depois do TTS | Player, frases | Campo de texto e comparação (função pura) | Baixo |
| Shadowing com gravação da voz | Média a Alta | `capture_stream` do Mincer como base, `audio/transcriptions` | Captura curta de microfone, tocar a gravação, comparar | Permissão de microfone na WebView2; uma gravação por vez |
| Exportar mp3 de capítulo | Média | Cache por frase, sidecar ffmpeg, fila do Mincer como modelo | Job longo com progresso, junção, diálogo de salvar | Custo de um capítulo inteiro; ffmpeg fora do git |
| OCR de PDF escaneado | Média (só texto), Alta (texto selecionável) | `ocr.rs` (OCR do Windows), canvas da página | Motor na língua do livro, camada de texto a partir das caixas | O motor usa as línguas do perfil do Windows (`ocr.rs:28`); o pacote da língua do livro precisa estar instalado |
| Texto colado ou página web como "livro" | Média | Leitor de EPUB inteiro, `fetch_article` do Mincer, JSZip (já vem com o epubjs) | Gerar um EPUB mínimo, comando para gravar bytes em `books/` | Terceiro formato se não for por EPUB |
| Translate e Listen no DocsReader | Baixa a Média, depois dos componentes comuns | Popover, player, `placeSelectionToolbar` | Barra de seleção | Sem livro: sem vocabulário e sem idioma |

## 6. Recomendações e mudanças de escopo

1. **Separar EPUB e PDF na leitura contínua.** Não prometer paridade. EPUB primeiro; no PDF, começar por "ouvir a seleção" e "ouvir esta página", e deixar a frase que atravessa a página para depois.
2. **Áudio por frase** (troca "por parágrafo" da direção inicial), com 2 ou 3 frases geradas à frente e cache por frase. Se o relatório de voz mostrar que o provedor devolve tempos por frase ou palavra, o parágrafo volta a ser opção no EPUB.
3. **Marcas transitórias com CSS Custom Highlight API** (`::highlight()`), para a frase atual e as palavras guardadas, nos três leitores. Não altera o DOM, não mexe nas camadas de retângulo nem nos CFIs e aceita centenas de ranges. O `::selection` do text layer do PDF já prova que o fundo pinta alinhado sobre o texto transparente (`Reader.module.css:400-404`). **A conferir num teste curto** no iframe do epubjs. Reserva: camada de retângulos no PDF e `annotations.underline` no EPUB.
4. **Vocabulário em tabela própria**, como na direção inicial, com "Add to note" para a elaboração. Os estados (nova, aprendendo, conhecida) só fazem sentido como um interruptor "known", que tira a marca do texto; uma fila de estados puxa para a memorização que o Coordenador excluiu.
5. **Translate sem comando novo**, com popover `fixed` em portal. Frase de contexto: no EPUB, o bloco pai da seleção; no PDF, a frase achada no texto limpo da página.
6. **Professor de língua como bloco do contexto efêmero**, não como agente. Mantém a regra atual e o padrão validado.
7. **Player dentro do leitor** no começo. O áudio para ao trocar de modo ou fechar o livro; o cleanup pausa e libera os Blob URLs.
8. **Avisar ou bloquear o Listen durante uma gravação do Mincer.**
9. **Busca no livro para o EPUB** entra como dívida ligada ao vocabulário (reencontrar a palavra), fora do caminho crítico.
10. **Fora das primeiras fases:** DocsReader, OCR, mp3 de capítulo, tradução paralela, shadowing gravado. "Texto colado como livro" vale a pena só pelo caminho do EPUB gerado.
11. **Sessão de leitura como tipo de nota** (com tracker e Log) é o caminho mais barato para a constância, e retoma uma ideia antiga do leitor.

## 7. Fases possíveis

| Fase | Entra | Dificuldade |
| --- | --- | --- |
| 0. Teste curto (sem UI final) | Tocar bytes do Rust num `<audio>` com `blob:` no app empacotado; `preservesPitch` em 0,7×; CSS Custom Highlight no text layer e no iframe; medir o texto de 3 a 5 PDFs reais (hífen, cabeçalho) | Baixa |
| 1. Traduzir e ouvir a seleção | Idioma por livro; Translate em popover; Listen na seleção (PDF e EPUB) com cache; seção Language no Settings; professor de língua no chat | Média |
| 2. Vocabulário | Tabela; guardar pelo popover; aba no leitor; marcar no texto; visão geral; export CSV e "Add to note" | Média |
| 3. Leitura contínua no EPUB | Frase marcada, virar página, repetir frase, velocidade, mini-player, atalhos | Média |
| 4. Leitura contínua no PDF | Limpeza do texto; por página primeiro; frase entre páginas depois | Alta |
| 5. Prática | Perfil de língua (nota); sessão de leitura (tipo de nota, tracker, Log); ditado | Baixa a Média |
| Depois | Shadowing gravado, mp3 de capítulo, texto colado como EPUB, OCR, tradução paralela, DocsReader, busca no EPUB | — |

## 8. Tokens visuais para os mockups

**Variáveis globais** (`src/App.css:1-93`)
- Fundos: `--bg-app #1f1f2f`, `--bg-panel #161625`, `--surface-1 #1d1d34`, `--surface-2 #292959`, `--surface-3 #2e2e36`.
- Texto: `--text-primary #ddddf1`, `--text-secondary #a2a2ae`, `--text-muted #9494ad`.
- Acentos: `--accent #7b6ed4` (roxo, foco e hover), `--accent-ai #5dcaa5` (verde, ações de IA e botão primário), `--accent-warn #ef9f27`, `--accent-danger #e05555`, `--nm #eeb54a` (marca de atenção).
- Linhas: `--border #2e2f2cb3`, `--hair #34344f`.
- Espaço: `--space-0` 2, `-1` 4, `-1h` 6, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24 px.
- Raio: `--radius-sm` 4, `-md` 6, `-lg` 8 (popovers e menus), `-xl` 10 px (modais).
- Controles: `--control-sm` 24, `-md` 28, `-lg` 32, `-xl` 40 px.
- Fonte: Inter (cai em Segoe UI no Windows), base 14 px, `--lh-ui` 1.45. Ícones Phosphor: 12 a 14 px em botões, 16 no trilho, 18 nos botões flutuantes.

**Leitor** (`Reader.module.css`, `EpubReader.module.css`)
- Toolbar do topo: fundo `--bg-panel`, borda inferior 1 px `--border`, padding 8 × 16, gap 8 × 12, quebra em linhas. Botões com borda 1 px, raio 6, texto 12 px, altura 28; hover com texto `--text-primary` e borda `--accent`; ativo com fundo `rgba(123,110,212,.12)`.
- Área da página: padding 24. PDF: folha branca (`#fff`) com sombra `0 8px 24px rgba(0,0,0,.35)`. EPUB: superfície branca, largura máxima 860, padding 8 × 20, texto preto do próprio livro.
- Botões flutuantes de página: 40 × 40, círculo, `bottom: 20px`, `left` e `right` 20, opacidade .55 (1 no hover), z 5. O mini-player disputa essa faixa de baixo.
- Coluna de navegação (esquerda): 280 px aberta, 48 recolhida, fundo `--bg-panel`. Abas de 12 px, peso 500, borda inferior de 2 px `--accent` na ativa; contador em pílula `--accent` com texto `#0e0e10`, 10 px.
- Item de lista (grifo): fundo `--surface-1`, raio 6, padding 8 × 12, texto 12 px com line-height 1.5 e no máximo 3 linhas; meta de 11 px `--text-muted`; ações de 20 × 20 no canto, visíveis sempre.
- Coluna direita (Chat e Notes): 340 px (260 a 560, arrastável), cabeçalho com padding 12 e título 12 px peso 500; chip de contexto de 11 px `--text-muted` ("AI sees: p. 12 · 3 highlights"); campo com raio 8 e foco `--accent-ai`; Send verde com texto `#0e0e10`.
- Faixa de aviso: fundo `rgba(239,159,39,.08)`, borda `rgba(239,159,39,.3)`, texto `--accent-warn`, 12 px.

**Barra de seleção** (`.highlightToolbar`)
- Fundo `--bg-panel`, borda 1 px `--border`, raio 8, padding 6 × 8, gap 6, sombra `0 6px 18px rgba(0,0,0,.45)`, sem quebra de linha.
- Cores de grifo: `#FFEB3B`, `#A5D6A7`, `#90CAF9`, `#F48FB1`, círculos de 18 px com borda `rgba(0,0,0,.35)`; ativa com anel de 2 px `--accent`. Opacidade do grifo no texto: 0,35.
- Divisor: 1 × 18 px `--border`.
- Botões: só texto, 11 px, peso 500, padding 4 × 8, raio 4, hover `rgba(123,110,212,.18)`. Rótulos em inglês: Copy, Add to note, Ask AI.
- Posição: 8 px acima da seleção (abaixo quando não cabe), 8 px de margem das bordas.

**Popover de grifo** (`.removalPopover`, modelo para o cartão de tradução)
- Fundo `--bg-panel`, borda 1 px `--border`, raio 8, padding 10 × 12, gap 8, largura mínima 200, sombra `0 8px 22px rgba(0,0,0,.5)`, 8 px abaixo do trecho.
- Data em 11 px `--text-muted`; botões de ação com ícone de 13 px + rótulo, 12 px, borda 1 px, raio 5, padding 5 × 10; destrutivo em `--accent-warn` com texto `#0e0e10`.

**Outros**
- Seleção de texto no PDF: `rgba(123,110,212,.35)`. Busca: `rgba(255,165,0,.35)`; ocorrência ativa `rgba(255,140,0,.6)` com contorno `rgba(255,111,0,.9)`. A frase em leitura precisa de uma cor que não se confunda com essas nem com os quatro grifos.
- z-index: camadas da página 1 e 2; barra 3 e popover 4 (PDF), 6 e 7 (EPUB); botões flutuantes 5; alça das colunas 10; modais 1000; toast 1100. Popover novo: acima de 1000.
- Toast: fixo embaixo ao centro, fundo `--accent-ai`, texto `#0e0e10`, 12 px peso 500, raio 6; erro em `--accent-danger`.
