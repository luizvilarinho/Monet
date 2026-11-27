# Execution Report

## Documents
- Task report: `DOCS/reports/26-11-2026/taskreport_20261126233242.md`
- Execution report: `DOCS/reports/26-11-2026/executionreport_20261126233242.md`
- Explorer report: `DOCS/reports/26-11-2026/explorerreport_20261126153600_code.md` (código), `DOCS/reports/26-11-2026/explorerreport_20261126153959_voice.md` (voz e tradução), `DOCS/reports/26-11-2026/explorerreport_20261126153738_usage.md` (uso real) e `DOCS/reports/26-11-2026/explorerreport_20261126153738_market.md` (mercado e método), gerados na task de estudo
- UX report: `DOCS/reports/26-11-2026/uxreport_20261126173030.md` (da task de estudo) e `DOCS/reports/26-11-2026/uxreport_20261127115849.md` (janela de tradução, rodada 2 de ajustes do teste)
- Estudo e mockups: `DOCS/features/language_study.md`, `DOCS/features/language_study/` (`index.html`, `translate.html`, `listen.html`, `vocabulary.html`, `practice.html`, `settings.html`)
- Task e Execution Report do estudo: `DOCS/reports/26-11-2026/taskreport_20261126134217.md`, `DOCS/reports/26-11-2026/executionreport_20261126134217.md`
- Plan report: `DOCS/reports/26-11-2026/planreport_20261127000656.md`
- Spec: `DOCS/specs/languagestudy.md`
- Roteiro de teste do Coordenador: no fim deste arquivo (seção "Roteiro de teste do Coordenador", 120 passos: 78 do desenvolvimento, 14 novos da passada final, no item 8, 23 da rodada 2 da janela de tradução, no item 9, e 5 das regras por língua, no item 10)
- Review report: três, um por área: `DOCS/reports/26-11-2026/reviewreport_20261127100629_voice.md` (voz e player), `DOCS/reports/26-11-2026/reviewreport_20261127100918_reader.md` (língua por livro, Translate e leitores) e `DOCS/reports/26-11-2026/reviewreport_20261127101149_vocab.md` (vocabulário e prática)

## Sessions
### Orchestrator — abertura — 20261126235630
- Summary: Task Report de implementação do Library para estudo de línguas aprovado pelo Coordenador em 2026-11-26, com os padrões dos cinco pontos a confirmar: fases 0 a 3 em sequência com o teste dele no fim; fase 0 só com as provas técnicas; seletor de modelo de voz com a lista lida do catálogo do OpenRouter (padrão Gemini 3.8 Flash TTS), no Settings e no menu do player; agentes sem leitura da chave e sem chamada paga; tradução padrão em `openai/gpt-4.1-mini`. Branch `feat/language-study` criada a partir de `feat/mincer` (`43a9ae8`); os arquivos do estudo, sem commit, seguem na árvore de trabalho.
- Inputs:
  - `DOCS/reports/26-11-2026/taskreport_20261126233242.md`
- Decision: sem `explorerAgent` (o levantamento de código, de voz e de uso já existe). `plannerAgent` (Opus 5.5) planeja as fases 0 a 3; depois `codeAgent` (Sonnet 5.5) por fase, em sequência; o Coordenador testa; `codereviewAgent` (Opus 5.5); passada final do `codeAgent`. Sem commit. O Orquestrador roda `npx tsc --noEmit`, `npm test` e `npm run test:rust` ao fim de cada fase antes de liberar a seguinte.
- Next step: plannerAgent

### PlannerAgent — 20261127000656
- Summary: O plano das fases 0 a 3 tem 33 etapas em quatro entregas, uma por `codeAgent`. A **0+1A** (etapas 1-11) traz as provas F0.1 e F0.2 num harness com Edge headless e, depois, a língua por livro, a regra de exibição, a barra em duas linhas, o Translate, a base do Settings › Language e a tecla `T`. A **1B** (12-19) traz o `speech.rs`, o catálogo e o seletor, o player, Listen, "Listen to page", a faixa cinza, os atalhos e o custo. A **2** (20-25) traz `book_vocabulary`, a tecla `V`, a aba, o envio com toggle e o Undo, e o Listen to list. A **3** (26-33) traz a marca no texto, o popover "onde você guardou", o perfil, o professor, o Retell, a spec e o roteiro T3. As decisões técnicas principais:
  - detecção de língua por heurística própria, sem dependência;
  - `sha2` no Cargo, que já está no lockfile;
  - formato de áudio escolhido pelo catálogo (mp3 > wav > pcm), com PCM embrulhado em WAV e cache mp3 pelo ffmpeg do Mincer;
  - uso contado pelo Rust em `appData/tts/usage.json`;
  - marcas pela CSS Custom Highlight API, com a reserva escrita só se a F0.1 reprovar;
  - língua nativa em chave própria.

  Oito padrões adotados aguardam o "aprovado" do Coordenador (Apêndice F do plano).
- Output: `DOCS/reports/26-11-2026/planreport_20261127000656.md`

### Orchestrator — decisão — 20261127002312
- Summary: Plano conferido (escopo, regras, etapas 1 a 11 e apêndices A a F lidos por inteiro). Os oito pontos do Apêndice F foram aceitos como detalhe de execução, sem mudança de escopo, e serão informados ao Coordenador na entrega para teste: (1) pontilhado em cinza neutro, pela regra do Task Report; (3) PCM sem taxa no cabeçalho tratado como 24 kHz; (4) língua nativa em chave própria, sem mexer na língua das respostas do resto do app; (5) "Ask for feedback" no cabeçalho da aba Notes do leitor; (6) Remove do popover "onde você guardou" só apaga os itens do livro atual; (7) custo do livro no menu do player é o já gerado; (8) coluna de 300 px e abas de 8 px só quando as ferramentas de língua aparecem, para o livro na língua nativa ficar idêntico ao de hoje (F1.2).
- Inputs:
  - `DOCS/reports/26-11-2026/planreport_20261127000656.md`
- Decision: seguir para a execução, um `codeAgent` (Sonnet 5.5) por entrega, em sequência (0+1A, 1B, 2, 3). Um ajuste do Orquestrador no ponto (2), para a entrega 1B: a regra de plausibilidade da duração do áudio (Apêndice A.1, passo 8) fica mais folgada, porque número escrito em algarismo vira muitas sílabas faladas e uma frase cheia de números seria recusada à toa. Passa a ser: recusa por áudio longo demais só com `secs > chars/4 + 5`; recusa por áudio curto demais só com `chars ≥ 20` e `secs < chars/40`. O resto do ponto (2) fica como no plano (não toca, não vai ao cache, "Try again" e "Skip", uso contado). O Orquestrador roda `npx tsc --noEmit`, `npm test` e `npm run test:rust` ao fim de cada entrega antes de liberar a seguinte.
- Next step: codeAgent, entrega 0+1A (etapas 1 a 11)

### F0.1 — provas técnicas (codeAgent, entrega 0+1A, Etapa 1) — 20261127002836
- Ambiente: harness fora do Tauri (Vite em `localhost:5199` com o `pdfjs-dist` e o `@likecoin/epubjs` do projeto; Edge headless 158 pelo CDP, o mesmo motor da WebView2). Material inventado do Apêndice E: PDF de uma página (Helvetica, WinAnsi, três linhas), EPUB descompactado (`<dc:language>fr</dc:language>`) e WAV de 440 Hz. Range de "entrebâillée" (palavra) e da frase "La porte … tâtonnant." (três linhas no PDF, três no EPUB). Nenhum arquivo do repositório foi tocado.
- **Suporte:** `typeof CSS.highlights !== 'undefined'` deu `true` na janela principal e em `contents.window` (iframe do epubjs), e o `<style>` do Apêndice C injetado por `rendition.hooks.content.register` valeu no iframe.
- **Pixels** (screenshot do retângulo do Range + 4 px, com e sem o registro `CSS.highlights`; pixel mudado = soma de |ΔR|+|ΔG|+|ΔB| > 24):

| Marca | Leitor | Critério | Medido | Resultado |
| --- | --- | --- | --- | --- |
| Faixa cinza (frase) | PDF (camada de texto transparente) | ≥ 30% mudam e canais sem matiz (dif. ≤ 10) | 37,6% de 585×106 px; ΔR/ΔG/ΔB médios 25,9 / 26,0 / 25,7 (dif. 0,3); dentro das caixas das linhas, 99,2% | passou |
| Faixa cinza (frase) | EPUB (iframe) | idem | 41,9% de 443×108 px; ΔR/ΔG/ΔB médios 26,6 / 26,8 / 26,5 (dif. 0,2); dentro das caixas das linhas, 86,9% | passou |
| Pontilhado (palavra) | PDF | ≥ 15 px no terço de baixo, < 3% nos 2/3 de cima, ≥ 3 trechos separados na linha do sublinhado | 116 px no terço de baixo; 0,00% nos 2/3 de cima; 29 trechos na linha do sublinhado | passou |
| Pontilhado (palavra) | EPUB | idem | 114 px no terço de baixo; 0,00% nos 2/3 de cima; 29 trechos na linha do sublinhado | passou |

  Conferido também a olho nos PNG: a faixa cobre só o trecho da frase e o pontilhado fica sob a palavra, em cinza, nos dois leitores.
- **Áudio** (`<audio>` com `blob:` de WAV 24 kHz mono 16 bits, seno de 440 Hz, 3 s; `playbackRate = 0.75`, `preservesPitch = true`; `AudioContext` → `AnalyserNode` fftSize 8192, 48 kHz, passo de 5,86 Hz por bin): o `AudioContext` rodou no headless (estado `running`), então o tom **foi medido**. Pico em **439,45 Hz** (esperado 440 ± 5%: passou). `currentTime` andou **1,5075 s em 2,0166 s de relógio** (esperado 1,5 ± 0,15 s: passou). Controle com `preservesPitch = false`: pico em 328,1 Hz (= 0,75 × 440), o que mostra que a medida distingue tom preservado de tom abaixado. Não há "pitch not measured headless" a transferir para o roteiro T3 (a escuta real da voz continua nos passos 1.1 e 1.5).
- Nota do harness: o `load()` do elemento devolve `playbackRate` a 1. A primeira rodada media a 1× por isso; a velocidade passa a ser aplicada depois do `canplaythrough` e antes do `play()`. **O player da 1B deve aplicar `playbackRate` depois de trocar o `src` (e a cada nova frase), nunca antes.**
- **Decisão (F0.2): `PAGE_MARKS_MODE = 'highlight'`** (CSS Custom Highlight API, Apêndice C). As quatro marcas passaram no PDF e no EPUB, então a reserva (camada de retângulos, `annotations.underline`) não é escrita. Vale para os dois leitores e as duas marcas.
- Encerramento: Edge (PID 115592 e filhos) e Vite (PID 119644 e filhos) finalizados com `taskkill /T /F`; `tasklist` sem `msedge.exe` e sem `node.exe` do harness; portas 5199 e 9334 livres. A junction foi removida com `cmd /c rmdir` e o `node_modules` do projeto está intacto.

### CodeAgent — implementação inicial (entrega 0+1A, etapas 1 a 11) — 20261127005504
- Summary: Entrega 0+1A feita, sem commit e sem subir o app. Por etapa:
  - **1** F0.1/F0.2: provas no harness fora do Tauri (seção acima); `PAGE_MARKS_MODE = 'highlight'`; harness, junction e processos removidos.
  - **2** `books.language` (`BookBase.language: string | null`), `BOOKS_EXTRA_COLUMNS` + `ensureBooksColumns` (padrão `ensureNotesColumns`), `BOOK_COLUMNS` no `getBooks` (sem `SELECT *`), `saveBook` grava a língua só no INSERT, `setBookLanguage` nos dois adaptadores e na interface.
  - **3** `language.ts`, `languageSettings.ts` (chaves `monet:native-language`, `monet:language-tools`, `monet:translate-model`; não escreve em `monet:user-language`), `useLanguageSettings`, `languageDetect.ts` (heurística própria, 7 línguas, sem dependência) e testes.
  - **4** Detecção no import (EPUB: metadado, senão amostra do texto; PDF: amostra a partir da 3ª página) e na primeira abertura dos dois leitores; coluna Language, edição por `<select>` e faixa do import (Change/Choose, X, 12 s) no Library; prop `onBookLanguageChange` nos leitores.
  - **5** `pdfText.ts` (linhas, cabeçalho/rodapé/número de página, hífen, parágrafo, seleção) e `sentences.ts` (abreviações, inicial, minúscula/dígito, « », teto de 400, `findContextSentence`) com testes.
  - **6** Funções da camada de texto movidas, sem mudar comportamento, para `Reader/pdfTextLayer.ts` (+ `rangeToJoinedOffsets`, `PdfTextAnchor`, teste com happy-dom).
  - **7** `translate.ts`: classificação, prompt (Apêndice D.1), `parseTranslation`, cache de sessão, `requestTranslation` pelo `openrouter_stream_chat` (ouvintes antes do invoke, abort, `TranslateError`); testes com os comandos simulados.
  - **8** `placeFloatingPanel` (+ testes) e `LanguageTools/TranslatePopover` (portal, `fixed`, z-index 1100, estados carregando/erro/sem chave/acima do limite, rodapé com Change).
  - **9** `LanguageBar` (só Translate), barra em duas linhas atrás de `toolsOn` nos dois leitores, Translate com frase de contexto (PDF: texto limpo da página; EPUB: bloco da seleção), `T`, Esc em dois passos, click-outside, faixa do PDF sem texto com "translation".
  - **10** Settings › Language (`LanguageSettings.tsx`: língua do usuário, quando mostrar, modelo de tradução com validação `provedor/nome`); `handleOpenMincerSettings` virou `handleOpenSettingsSection` e chega aos leitores por `Library`.
  - **11** Grupo "In a book (Library)" com `T` na lista de atalhos; verificação final.
- Verificação: `npx tsc --noEmit` sem erros; `npm test` 37 arquivos e 1012 testes passando; `npm run test:rust` 93 passando, 0 falhas, 3 ignorados (já eram ignorados; nada de Rust foi alterado). O popover foi exercitado ainda por um teste de componente temporário (8 casos: carregando, erro com Try again, sem chave, acima do limite, passagem, Esc e Change, abort ao fechar, LanguageBar), removido em seguida.
- Desvios do plano, com motivo:
  - `getPageCleanText` (Etapa 6, item 3) foi escrito na Etapa 9: o `noUnusedLocals` do tsconfig recusa um callback sem uso entre as duas etapas. O cache por página guarda as linhas e a altura; `skipHeaders` e a língua entram no cálculo, que é puro.
  - `EpubInfo.language` é `string` (nunca `null`): a detecção por amostra roda dentro do `readEpubInfo`, com o livro aberto. `sampleEpubText` e `samplePdfText` ficaram privados; saem `detectEpubLanguage` e `detectPdfLanguage` (esta em `lib/books.ts`, como o plano pede).
  - `baseLanguage` converte o ISO 639-2 ("eng", "fra"...) das 16 línguas: EPUB do Calibre traz `eng`, e sem isso um livro em inglês ligaria as ferramentas para quem tem o inglês como língua.
  - O inglês do Apêndice E tem 33 palavras (< 40): o teste de `en` usa o parágrafo duas vezes, e o parágrafo único é o caso "texto curto dá null".
  - `sentences.ts`: o `Intl.Segmenter` não corta antes do travessão de diálogo na mesma linha ("Elle sursauta. — Je cherchais…"; o travessão é `SContinue` nas regras do Unicode). Acrescentei o corte antes de `—`/`–` depois de `. ! ? …`. O tipo do `Intl.Segmenter` (ES2022) não vem no `lib` ES2020 do projeto: tipo local por cast, sem mexer no tsconfig.
  - `TranslatePopover` ganhou a prop `rootRef` (o "ref no elemento raiz do portal" do plano). No PDF o anchor acompanha a rolagem da área da página (Range clonado), como pede o UX report 4.1.
  - Barra de seleção: o contêiner das cores e botões de sempre ganhou um `div` que é `display: contents` sem as ferramentas (leitor igual ao de hoje) e a linha normal com as ferramentas. `LanguageBar` impede o `mousedown` para o clique não mexer na seleção que o Translate lê.
  - Etiqueta de língua do Library em cinza neutro (o mockup tinge as de estudo); texto de ajuda do Settings da 1A sem citar voz nem vocabulário, para não prometer botão que não existe.
- Files changed:
  - DOCS/reports/26-11-2026/planreport_20261127000656.md (status das etapas 1 a 11)
  - DOCS/reports/26-11-2026/executionreport_20261126233242.md
  - src/App.tsx
  - src/components/Library/Library.module.css
  - src/components/Library/Library.tsx
  - src/components/Reader/EpubReader.module.css
  - src/components/Reader/EpubReader.tsx
  - src/components/Reader/Reader.module.css
  - src/components/Reader/Reader.tsx
  - src/components/Reader/toolbarPlacement.ts
  - src/components/Reader/toolbarPlacement.test.ts
  - src/components/Settings/SettingsModal.tsx
  - src/components/ShortcutsOverlay/ShortcutsOverlay.tsx
  - src/lib/books.ts
  - src/lib/epub.ts
  - src/lib/bookList.test.ts
  - src/lib/focusMap.test.ts
  - src/storage/browser.ts
  - src/storage/index.ts
  - src/storage/tauri.ts
  - src/types/index.ts
- Files created:
  - src/components/LanguageTools/LanguageBar.tsx
  - src/components/LanguageTools/LanguageBar.module.css
  - src/components/LanguageTools/TranslatePopover.tsx
  - src/components/LanguageTools/TranslatePopover.module.css
  - src/components/Reader/pdfTextLayer.ts
  - src/components/Reader/pdfTextLayer.test.ts
  - src/components/Settings/LanguageSettings.tsx
  - src/hooks/useLanguageSettings.ts
  - src/lib/language.ts
  - src/lib/language.test.ts
  - src/lib/languageDetect.ts
  - src/lib/languageDetect.test.ts
  - src/lib/languageSettings.ts
  - src/lib/pdfText.ts
  - src/lib/pdfText.test.ts
  - src/lib/sentences.ts
  - src/lib/sentences.test.ts
  - src/lib/translate.ts
  - src/lib/translate.test.ts
- Files removed:
  - nenhum (as funções da camada de texto saíram do `Reader.tsx` para `pdfTextLayer.ts`; o harness da Etapa 1 ficou só no scratchpad e foi apagado)
- Left behind:
  - **Sem chamador em produção na 1A, como o plano manda** (a 1B e a fase 3 usam): `rangeToJoinedOffsets` e `PdfTextAnchor` (`pdfTextLayer.ts`), o caminho `skipHeaders: true` do `cleanPdfPage`, e as props `onListen`/`onAddToVocabulary` (sempre `null`) do `LanguageBar` e do `TranslatePopover`.
  - **Não verificável sem o app real** (entram no passo 2 do roteiro T3): a barra em duas linhas e a altura medida; abrir e fechar o popover sem perder a seleção, click-outside, `Esc` em dois passos e a rolagem do PDF com o popover aberto; no EPUB, a virada de página, o `selected` atrasado (250 ms) e a tecla `T` dentro do iframe; a faixa do import e a coluna Language (larguras 22/15/10/7/9/9,5/9,5/18); a detecção na primeira abertura de PDF e de EPUB reais (incluindo o `section.unload()` da amostra antes do `renderTo`); a qualidade do corte de frases e da limpeza de texto em PDFs reais; a tradução em si (nenhuma chamada paga foi feita).
  - Sem teste de componente no repositório: o do popover era temporário.
  - Nada de voz, vocabulário, marca no texto ou professor (entregas 1B, 2 e 3).

### Orchestrator — decisão — 20261127005716
- Summary: Entrega 0+1A conferida. O Orquestrador rodou de novo `npx tsc --noEmit` (sem erros) e `npm test` (37 arquivos, 1012 testes, todos passando). Nenhum arquivo de Rust mudou nesta entrega, então `npm run test:rust` ficou com o resultado relatado pelo `codeAgent` (93 passando, 3 ignorados) e roda de novo depois da 1B. A branch segue `feat/language-study`, sem commit; não sobrou processo do Edge nem do Vite do harness. A mudança no banco foi lida no diff: `books.language` entra por `addMissingColumns` num `ensureBooksColumns`, o `getBooks` lista as colunas e o `saveBook` só grava a língua no INSERT. As provas da F0.1 passaram nos dois leitores, então as marcas usam a CSS Custom Highlight API (`PAGE_MARKS_MODE = 'highlight'`) e a reserva não é escrita.
- Inputs:
  - sessões "F0.1 — provas técnicas" e "CodeAgent — implementação inicial (entrega 0+1A)" deste arquivo
- Decision: os desvios relatados pelo `codeAgent` foram aceitos como detalhe de execução (o `getPageCleanText` escrito na Etapa 9; `EpubInfo.language` sempre texto; `baseLanguage` aceitando ISO 639-2; corte de frase antes do travessão de diálogo; prop `rootRef` no popover; etiqueta de língua em cinza no Library). Seguir para a entrega 1B, com dois avisos ao `codeAgent`: aplicar `playbackRate` depois de trocar o `src` do `<audio>`, a cada frase (o `load()` devolve a velocidade a 1); e a regra de duração mais folgada da decisão anterior.
- Next step: codeAgent, entrega 1B (etapas 12 a 19)

### CodeAgent — implementação inicial (entrega 1B, etapas 12 a 19) — 20261127055903
- Summary: Entrega 1B feita, sem commit, sem subir o app, sem chave e sem chamada paga. A execução foi interrompida uma vez por erro de autenticação da API e retomada: o `speech.rs` estava inteiro, e o registro no `lib.rs` e no `Cargo.toml` foi feito na retomada. Por etapa:
  - **12** `speech.rs`: tipos (`TtsModel`, `TtsError`, `TtsCacheSize`, `TtsUsage`, `SpeechRequests`), `parse_catalog` (une os dois GET públicos pelo id: preço do primeiro; vozes, formatos e faixa de velocidade do segundo; vozes do primeiro como reserva), `choose_format` (mp3 > wav > pcm; vazio dá pcm), `normalize_text`, `cache_key` (SHA-256, com vetor fixo no teste), `build_speech_body` (sem `speed`), `pcm_rate_from_content_type` (24 kHz por padrão), `wav_from_pcm`, `audio_duration_secs` (WAV por `hound`, MP3 por soma de frames), `duration_plausible` com a regra folgada do Orquestrador, `speech_error`, `network_speech_error`, `valid_book_id`, `record_usage`, `fetch_catalog` (sem `Authorization`) e cache de 10 min em memória e em `appData/tts/catalog.json`. `sha2 = "0.10"` no Cargo (o `Cargo.lock` só ganhou a linha `"sha2"` em `monet`); `sidecar` do Mincer e `is_valid_model_id` passaram a `pub(crate)`.
  - **13** Comandos `tts_catalog`, `tts_speak`, `tts_cancel`, `tts_clear_book`, `tts_clear_all`, `tts_cache_size`, `tts_usage`, registrados em `lib.rs` com `.manage(SpeechRequests)`. `tts_speak` na ordem do Apêndice A.1 (validação, cache, chave por `read_key`, formato do catálogo, POST com 3 tentativas e cancelamento, PCM em WAV, duração, uso, gravação em segundo plano por mp3 direto ou ffmpeg do Mincer a 64 kbps, retorno por `tauri::ipc::Response`); aviso `tts://warning` uma vez por execução. 31 testes Rust no módulo, sem rede (inclui cache em diretório temporário, `tts_cache_size` e limpeza).
  - **14** `lib/speech.ts` (invoke, `sniffAudioMime`, `isTtsError`, eventos), chaves de voz em `languageSettings.ts` (`monet:tts-model`, `-voices`, `-speed`, `-show-text`, `-skip-headers`; o único id de modelo escrito no código é `google/gemini-3.8-flash-tts`), `useLanguageSettings` com os campos novos, `lib/ttsCost.ts` (A.2) e `hooks/useTtsCatalog.ts` (uma busca por sessão; `enabled` para livro sem ferramentas não buscar nada).
  - **15** `lib/listenQueue.ts` (`planPrefetch`) e `hooks/useListenPlayer.ts`: o motor (`createListenEngine`) é a máquina de estados fora do React e o hook só liga estado e efeitos. Uma frase por chamada, a atual e duas à frente, no máximo duas em voo; `playbackRate` aplicado depois de trocar o `src`, a cada frase (e de novo em `loadedmetadata`); modelo e voz lidos a cada pedido; bloqueio do Mincer (inclusive começando a gravar com áudio tocando) e "Play anyway"; confirmação acima de 5.000 caracteres; erro, `retry`, `skip`; `pause('away' | 'translate' | 'user')`; `speakOnce` num segundo elemento de áudio; unmount cancela, para o som e revoga os blobs.
  - **16** `VoiceModelPicker` (modelo e voz, "<id> (saved)" fora do catálogo, versão `compact` de 248 px) e `MiniPlayer` (controles, origem, progresso em segmentos, velocidade, menu ⋯ com seletor, chaves, custo do livro e "Language settings…", e os estados do Apêndice D.4).
  - **17** `lib/pageMarks.ts` (só a CSS Custom Highlight API), Listen da seleção com faixa cinza (PDF por offsets no texto juntado, reaplicada depois de cada `textLayer.render()`; EPUB por `cfiRange`, reaplicada em `relocated` e `rendered`), "Listen to page" nos dois leitores (PDF com cabeçalho e número de página fora e aviso de 5 s; EPUB com o trecho visível), pausa ao trocar de página e "Back to", Translate pausa o áudio, toast que sobe com o player (`--reader-toast-offset`), faixa do PDF sem texto com "audio", Library apaga o áudio do livro (`ttsClearBook`) e cita isso na confirmação.
  - **18** `L`, `Espaço`, `R` e `Shift+←/→` nos dois leitores (e dentro do iframe do EPUB), com o ramo novo antes das setas; com o player fechado nada muda; no `ShortcutsOverlay`, os quatro itens novos.
  - **19** Settings › Language: "Reading aloud" com seletor, "Test voice" (frase inventada na língua do livro aberto por último que não é a nativa; erro com a frase e o botão do caso), "Default speed" e a caixa de custo (página, hora, mês por modelo, áudio guardado, "Clear saved audio").
- Contrato dos comandos Tauri de voz: igual ao Apêndice A.1. Diferenças só de detalhe: o `tts_cancel` é um comando síncrono; o canal de cancelamento do `request_id` é registrado já na entrada do `tts_speak` (um cancelamento que chega durante a leitura do cache ou do catálogo vale no pedido) e a consulta do catálogo para o formato roda dentro do mesmo `select!`; WAV com tamanhos provisórios no cabeçalho (0 ou 0xFFFFFFFF, comum em fluxo) é corrigido antes de medir e de tocar.
- Verificação (saída real): `npx tsc --noEmit` sem erros; `npm test` 43 arquivos e 1098 testes passando (antes: 37 e 1012; 6 arquivos novos); `npm run test:rust` 124 passando, 0 falhas, 3 ignorados (os 3 já eram ignorados; antes 93 passando, +31 do `speech`); `cargo check --manifest-path src-tauri/Cargo.toml` sem avisos. Um teste de componente temporário (24 casos: MiniPlayer em todos os estados, seletor, bloco de custo e Test voice do Settings) passou e foi removido (no repositório não há teste de componente e ele importava o pacote inteiro de ícones, cerca de 40 s).
- Provas no Edge headless (scratchpad, encerradas e apagadas): um filho `position: absolute` de um contêiner com `overflow: auto` **anda com a rolagem** (topo 240 antes, −60 depois de rolar 300), então o mini-player não pode ser filho absoluto de `.pageArea` (é isso que os botões ‹ › flutuantes já fazem hoje, ao contrário do que o comentário do CSS diz). Um filho absoluto de `.pageWrap` com `top: 100%` aumenta a rolagem (scrollHeight 948 para 1032) sem mexer na posição da página nem no `clientHeight`; um `fixed` fica parado.
- Desvios do plano, com motivo:
  - **Mini-player `position: fixed`, em portal no `body`** e medido pela área da página (`hooks/useColumnBox`), em vez de `absolute` dentro de `pageArea`: pelo teste acima o `absolute` rolaria junto. Props: `column` (centro, base e largura úteis) no lugar de `columnWidth`; `onOpenSettingsSection(section)` no lugar de `onOpenLanguageSettings` (o mesmo atalho abre também a seção da chave nos erros de chave e de crédito); `bookId` no lugar de `bookChars` (o menu lê `ttsUsage()` ao abrir e soma, por modelo, caracteres × preço do próprio modelo, como pede o A.2, e não um número só vezes o preço do modelo atual).
  - **Margem de rolagem**: um filho absoluto do `.pageWrap` (`top: 100%`, altura do player + 32), no lugar de um irmão do `pageWrap`, que numa linha flex ficaria ao lado da página e não daria espaço embaixo. No EPUB não há margem: a área não rola (o texto é paginado no iframe) e o player cobre as últimas linhas da página; fechar o player ou virar a página resolve. Está na lista do que testar.
  - `PAGE_MARKS_MODE` não é constante no código (só existe o caminho `highlight`); `ensurePageMarkStyles` é chamado dentro de `setPageMarks`, para cada janela, e não no `rendition.hooks.content.register` (mesmo efeito, um ponto só). O tipo `vocab` e o CSS do pontilhado já estão em `pageMarks.ts` como pede o plano, mas nada os usa na 1B (entram na fase 3).
  - O estado "Choose a voice model in Settings › Language" (D.4) não foi escrito: o padrão `google/gemini-3.8-flash-tts` existe sempre, então o estado é inalcançável.
  - `speakOnce(text, language?)` ganhou o segundo parâmetro opcional (corte de frases do texto longo) e rejeita com `kind: "blocked"` se o Mincer está gravando. O Listen do popover do Translate acima do limite de 1.500 caracteres passa pelo player (com a confirmação de trecho longo), e abaixo dele usa `speakOnce`.
  - `showToast` recebe objeto (`{ message, tone }`), não texto; o aviso `tts://warning` mostra só a frase (o detalhe fica depois da linha em branco). A tabela das ações por tipo de erro (`ttsErrorActions`) mora em `lib/speech.ts` porque o player e o Test voice a usam.
  - "Listen to page" do EPUB fica depois dos controles de margem (o leitor de EPUB não tem Search); o player fecha sozinho quando as ferramentas de língua se desligam; o Settings ganhou `LanguageSettings.module.css` e a prop `onOpenSection`; `lib/voiceTest.ts` traz a frase de teste de cada língua oferecida (inventadas, no estilo do Apêndice E) e a escolha da língua do teste.
- Files changed:
  - DOCS/reports/26-11-2026/planreport_20261127000656.md (status das etapas 12 a 19)
  - DOCS/reports/26-11-2026/executionreport_20261126233242.md
  - src-tauri/Cargo.toml
  - src-tauri/Cargo.lock
  - src-tauri/src/lib.rs
  - src-tauri/src/mincer/mod.rs
  - src/App.tsx
  - src/components/Library/Library.tsx
  - src/components/Reader/Reader.tsx
  - src/components/Reader/EpubReader.tsx
  - src/components/Reader/Reader.module.css
  - src/components/Reader/EpubReader.module.css
  - src/components/Reader/ReaderToast.module.css
  - src/components/Settings/LanguageSettings.tsx
  - src/components/Settings/SettingsModal.tsx
  - src/components/ShortcutsOverlay/ShortcutsOverlay.tsx
  - src/hooks/useLanguageSettings.ts
  - src/lib/languageSettings.ts
  - src/lib/pdfText.ts
  - src/lib/pdfText.test.ts
  - src/lib/epub.ts
- Files created:
  - src-tauri/src/speech.rs
  - src/lib/speech.ts
  - src/lib/speech.test.ts
  - src/lib/ttsCost.ts
  - src/lib/ttsCost.test.ts
  - src/lib/listenQueue.ts
  - src/lib/listenQueue.test.ts
  - src/lib/pageMarks.ts
  - src/lib/pageMarks.test.ts
  - src/lib/voiceTest.ts
  - src/lib/voiceTest.test.ts
  - src/hooks/useTtsCatalog.ts
  - src/hooks/useListenPlayer.ts
  - src/hooks/useListenPlayer.test.ts
  - src/hooks/useColumnBox.ts
  - src/components/LanguageTools/VoiceModelPicker.tsx
  - src/components/LanguageTools/VoiceModelPicker.module.css
  - src/components/LanguageTools/MiniPlayer.tsx
  - src/components/LanguageTools/MiniPlayer.module.css
  - src/components/Settings/LanguageSettings.module.css
- Files removed:
  - nenhum (o teste de componente temporário e os scripts das provas ficaram só no scratchpad e foram apagados)
- Left behind:
  - **Nada de voz foi exercitado de verdade** (sem chave, sem chamada paga, sem app): a conversa com o `POST /audio/speech`, o ouvido (voz em francês, emenda entre frases, tempo até o primeiro som, velocidade a 0,75× com o tom preservado) e o ffmpeg real. Tudo isso é o passo 1 do roteiro T3. O que do `POST /audio/speech` é **suposição**, sem conferência contra uma resposta real: (1) a resposta 2xx é o áudio cru, com `Content-Type` de áudio (JSON ou texto num 2xx é tratado como erro do servidor); (2) PCM é 16 bits little-endian mono, a 24 kHz quando o `Content-Type` não traz `rate=` (um modelo só com PCM em outra taxa, como o HeyGen a 44,1 kHz, tocaria na velocidade errada e a checagem de duração tende a recusar); (3) o WAV em fluxo pode vir com tamanhos provisórios no cabeçalho (tratado, mas é suposição); (4) o corpo `{ model, input, response_format, voice }` é aceito por todos os modelos do catálogo, e voz vazia ou ausente vira a voz padrão do modelo; (5) o erro vem como `{ error: { code, message } }`; (6) o catálogo público tem a estrutura conferida em 2026-11-26 (o JSON dos testes segue esse formato).
  - **Não verificável sem o app real**: o visual do mini-player na WebView2 (posição `fixed` com colunas laterais abertas e fechadas, z-index contra o popover e os modais, coluna abaixo de 576 px e mais estreita, menu ⋯ abrindo para cima), o `Espaço`, o `R` e o `Shift+←/→` dentro do iframe do EPUB, os eventos `relocated` e `rendered` do epubjs reaplicando a faixa cinza, o ponto vermelho do Mincer, o toast subindo com o player, a rolagem até a última linha com o player aberto e o "Fit page" igual com ele aberto, o áudio por `blob:` sob o CSP real, e o texto limpo e o corte de frases em PDFs reais.
  - O player cobre as últimas linhas da página no EPUB (sem margem de rolagem, pelo motivo acima).
  - Sem teste de componente no repositório: os estados do MiniPlayer, do seletor e do Settings foram conferidos por um teste temporário já removido; o motor do player tem teste permanente (`useListenPlayer.test.ts`, com `Audio` e `ttsSpeak` simulados).
  - "Clear saved audio" apaga todas as pastas de áudio (livros e o cache compartilhado do Test voice); o uso contado (`usage.json`) e o catálogo guardado ficam.

### Orchestrator — decisão — 20261127060221
- Summary: Entrega 1B conferida. A primeira execução do `codeAgent` foi interrompida por um erro de autenticação da API (token expirado), com o `speech.rs` já escrito e ainda sem registro; o mesmo agente foi retomado e concluiu as etapas 12 a 19. O Orquestrador rodou de novo `npx tsc --noEmit` (sem erros), `npm test` (43 arquivos, 1098 testes, todos passando) e `npm run test:rust` (124 passando, 3 ignorados). Conferido no diff: o CSP não mudou; a única dependência nova é a `sha2`; o único id de modelo de voz fora dos testes é o padrão `google/gemini-3.8-flash-tts` (`DEFAULT_TTS_MODEL`); a branch segue `feat/language-study`, sem commit.
- Inputs:
  - sessão do `codeAgent` da entrega 1B neste arquivo
- Decision: os desvios relatados foram aceitos como detalhe de execução (mini-player `position: fixed` em portal, medido pela área da página; margem de rolagem do PDF como filho do `.pageWrap`; `speakOnce` com língua opcional; "Listen to page" do EPUB depois dos controles de margem). Dois pontos vão para o roteiro de teste do Coordenador, porque só o app real mostra: no EPUB a área não rola, então o player cobre as últimas linhas da página; e tudo o que o módulo de voz supõe sobre a resposta do `POST /audio/speech` (áudio cru no 2xx, PCM de 16 bits mono a 24 kHz sem taxa no cabeçalho, WAV com tamanho provisório, corpo aceito por todos os modelos, formato do erro), já que nenhuma chamada paga foi feita.
- Next step: codeAgent, entrega 2 (etapas 20 a 25)

### CodeAgent — implementação inicial (entrega 2, etapas 20 a 25) — 20261127063000
- Summary: Entrega 2 feita, sem commit, sem subir o app, sem chave, sem chamada paga e sem rede. Por etapa:
  - **20** Tabela `book_vocabulary` por `ensureVocabularyTable` (memoizado, `serialDdl`, no molde do `ensureTrackersTables`; sem migration, sem `BEGIN`/`COMMIT`), `VOCABULARY_COLUMNS` (sem `SELECT *`), `rowToVocabularyItem` (âncora ilegível: item ignorado e registrado), os cinco métodos nos dois adaptadores e na interface, `deleteBook` apaga o vocabulário do livro (depois dos grifos e das citações) e o texto da confirmação do Library cita o vocabulário e o áudio (Apêndice D.5). Tipos `VocabularyKind`, `VocabularyAnchor` e `VocabularyItem` em `types/index.ts`.
  - **21** `lib/vocabulary.ts` (duplicata, item novo, âncora, bloco da nota, rótulo do botão, marca de enviado e agrupamento para o Undo, fonte do "Listen to list") e `lib/vocabularyDestination.ts` (destino por livro em `monet:vocab-destinations`, `resolveDestination`, título da nota), com 40 testes (`vocabulary.test.ts`, `vocabularyDestination.test.ts`). As chaves `monet:vocab-hide-senses` e `monet:vocab-send-translation` entraram em `languageSettings.ts` (com `getUserLocale`) e `vocabHideSenses` no `useLanguageSettings`.
  - **22** `hooks/useBookVocabulary.ts`; `LanguageBar` e `TranslatePopover` com Add to vocabulary nos dois leitores (pela barra, sem sentido e sem IA; pelo popover, com `sense` e `baseForm`), tecla `V` (só com `toolsOn`, seleção, sem modificadores e sem o Translate aberto, com o guarda de foco) e a linha no `ShortcutsOverlay`. Avisos "Added to vocabulary" e "Already in your vocabulary", sem Undo.
  - **23** `LanguageTools/VocabularyTab` (+ CSS): seções New e Sent to notebook, item com caixa, termo, sentido, frase com o termo em negrito, posição e data, ouvir, remover (com Undo), "No translation · Translate", chip "Sent to notebook", "Hide/Show meanings" lembrado, lista vazia, sem contador. Nos dois leitores a aba, o botão da coluna recolhida, a coluna de 300 px e as abas com 8 px de lado só existem com `toolsOn` (sem ele, coluna e abas idênticas às de hoje); "ir à página" e o aviso "This item's place in the book wasn't found."; "Translate" de item sem sentido abre o `TranslatePopover` ao lado do botão e grava `sense` e `baseForm` no mesmo item.
  - **24** `QuoteToNoteModal` ganhou o modo destino (`onPickDestination`: mesmos dois passos, nada escrito, fecha sem a tela de sucesso, sem o "Send future quotes…"); `LanguageTools/SendVocabularyModal` (520 × 584, z-index 1100) e `hooks/useVocabularySend.ts` (destino lembrado, envio direto, modal na primeira vez, na nota apagada e no "Change", marca de enviado, Open e Undo).
  - **25** "Listen to list" (fonte `kind: 'list'`, `page: null`, sem faixa cinza e sem pausa por troca de página), ouvir um item por `speakOnce(item.sentence)` e o fecho.
- Esquema final da tabela:
  ```sql
  CREATE TABLE IF NOT EXISTS book_vocabulary (
    id TEXT PRIMARY KEY, book_id TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL,
    sentence TEXT NOT NULL, sense TEXT, base_form TEXT, language TEXT NOT NULL,
    page INTEGER NOT NULL, position_label TEXT NOT NULL, anchor_json TEXT NOT NULL,
    created_at TEXT NOT NULL, sent_at TEXT, sent_notebook_id TEXT, sent_note_id TEXT)
  CREATE INDEX IF NOT EXISTS idx_book_vocabulary_book ON book_vocabulary(book_id)
  CREATE INDEX IF NOT EXISTS idx_book_vocabulary_language ON book_vocabulary(language)
  ```
  Métodos (interface, `TauriStorage` e `BrowserStorage` "not implemented"): `getBookVocabulary(bookId)` e `getVocabularyByLanguage(language)` (ambos `ORDER BY created_at ASC, id ASC`), `saveVocabularyItem(item)` (`INSERT … ON CONFLICT(id) DO UPDATE` de todos os campos), `deleteVocabularyItem(id)` e `setVocabularySent(ids, sent | null)` (`UPDATE … WHERE id IN ($4, …)`). Todos com `ensureVocabularyTable` antes e `scheduleCheckpoint()` depois. O SQL (tabela, índices, upsert, leituras e o `IN`) foi extraído do código e executado num SQLite em memória descartável (Python): passou.
- O bloco na nota (formato do Apêndice D.6, com o desvio do cabeçalho abaixo): um único bloco por envio, `### From *<livro>* · <data>`, e por item o termo em negrito (forma base entre parênteses só quando difere), `> frase`, `— *<livro>*, p. 42` e, só nos itens com sentido e com a chave ligada, `<div data-type="toggle-block" data-title="Translation" data-collapsed="true">` + linha em branco + tradução + linha em branco + `</div>` (a forma que o `ToggleBlock.ts` serializa). Frase guardada vai só como citação. O bloco entra por `appendBlockToNote` (nota existente) ou como conteúdo da nota nova `Vocabulary — <título>`. O aviso sai por `announceAppendedBlock` (agora com `message` e `onUndone` opcionais). O Undo roda `undoAppendedBlock` (tira a última ocorrência do bloco da versão atual da nota) e, só quando o bloco saiu, devolve a cada item a marca de enviado de antes, agrupando os itens pela marca anterior (`groupBySentMark` sobre o retrato tirado no envio, o que cobre o reenvio); se a nota foi editada, a marca de enviado fica e o aviso é "Couldn't undo: the note was edited.". O ponto 14 do UX report foi conferido no editor real (as extensões do Editor, em happy-dom): o bloco abre como dois toggles "Translation" recolhidos e é regravado idêntico.
- Verificação (saída real): `npx tsc --noEmit` sem erros; `npm test` 45 arquivos e 1138 testes passando (antes: 43 e 1098; +2 arquivos e +40 testes); `npm run test:rust` 124 passando, 0 falhas, 3 ignorados (nada de Rust mudou). Um harness no Edge headless (Vite no scratchpad, junction de `node_modules`, perfil fora da raiz; encerrado, junction removida com `cmd /c rmdir` e a pasta apagada) renderizou `VocabularyTab`, `SendVocabularyModal` e o `TranslatePopover` do item com o CSS real e a fonte do Windows: a faixa de abas com 300 px mede 299 px (Contents 65, Highlights 100, Vocabulary 77, mais o botão de recolher, de 41 px na coluna real; 283 px no total, como no UX report) e sem as ferramentas, as duas abas de hoje (com os 12 px de lado) e o botão de recolher ocupam 222 px dos 280 px.
- Desvios do plano, com motivo:
  - **Cabeçalho do bloco em `###`, não `####` (Apêndice D.6).** O editor só tem H1 a H3 (`heading: { levels: [1, 2, 3] }`) e regrava o H4 como parágrafo: o teste com o editor real mostrou `#### From …` virando `From …` ao salvar. Com isso o bloco mudaria assim que a nota fosse aberta e regravada (por exemplo com a aba Notes aberta nela) e o Undo, que procura o bloco no texto, não o acharia mais. Com `###` o bloco inteiro é ponto fixo do editor (o toggle já era). Efeito colateral bom para a fase 3: o `### Retell ·` do D.9 e este cabeçalho se separam pelo "próximo cabeçalho" do `extractLastRetell`. O Orquestrador deve avisar o Coordenador: a data do cabeçalho segue o locale do usuário (`monet:user-language`), como as outras datas do app.
  - **Sem `headerExtra` e `footerExtra` no `VocabularyTab` e sem `refresh` no `useBookVocabulary`** (Etapas 22 e 23): nada os usa nesta entrega e a regra é código morto sai. A entrega 3 os acrescenta junto com o "Mark in text", o Retell e o `useVocabularyMarks`. O hook ganhou `update` (mesmo upsert do `restore`), para gravar o sentido de um item.
  - `onTranslateItem(item, anchor)` leva o retângulo do botão (o plano só dizia `onTranslateItem(item)`), e o `VocabularyTab` ganhou `canSend` (o botão desabilitado "sem itens a enviar").
  - **`TranslatePopover` ganhou `savedItem`** (popover de um item da aba): o botão vira "Save translation", só aparece com a tradução pronta (sem ela o clique não teria o que gravar) e o popover fecha sozinho com Esc e clique fora, porque não há seleção do leitor para fechá-lo. Add to note e Ask AI desse popover agem sobre o texto do item.
  - **"Change" com nada a enviar:** o modal abre mesmo assim e o botão vira "Save destination" (como no mockup): sem isso, com tudo já enviado, não haveria como trocar o destino. Escolher "nota nova" nesse caso cria a nota vazia. O rótulo do botão principal sem itens novos é "Nothing new to send".
  - **Modo destino do `QuoteToNoteModal`:** as props viraram uma união (modo citação × modo destino) em vez de campos opcionais, e o modo destino não grava o "último caderno usado" (essa chave é das citações). `loadLastNotebookId` passou a exportado, para o modal de envio partir dele. O `SendVocabularyModal` some enquanto o seletor de nota está aberto (o seletor tem z-index 1000 e o modal 1100) e volta com o estado que tinha.
  - **"Open" e o chip "Sent to notebook"** abrem a nota por `openNote` do `useBookQuotes`, como o plano manda: isso vincula a nota de vocabulário ao livro (a aba Notes passa a mostrá-la e as próximas citações vão para ela), o mesmo efeito do "Open" do chat. Nota apagada: aviso "That note no longer exists.".
  - **Botão de Vocabulary também na coluna recolhida** (ícone `BookmarkSimple`, só com `toolsOn`), no padrão dos outros dois botões do trilho (o plano só falava das abas).
  - **Código morto das entregas anteriores removido:** com os dois leitores passando `onListen` e `onAddToVocabulary`, os ramos `null` do `LanguageBar` e do `TranslatePopover` e os comentários "chega na entrega…" saíram.
  - O `getVocabularyByLanguage` (Etapa 20) não tem chamador nesta entrega: o plano o manda para a fase 3 (`useVocabularyMarks`).
- Files changed:
  - DOCS/reports/26-11-2026/planreport_20261127000656.md (status das etapas 20 a 25)
  - DOCS/reports/26-11-2026/executionreport_20261126233242.md
  - src/types/index.ts
  - src/storage/tauri.ts
  - src/storage/index.ts
  - src/storage/browser.ts
  - src/lib/languageSettings.ts
  - src/hooks/useLanguageSettings.ts
  - src/hooks/useBookQuotes.ts
  - src/components/Library/Library.tsx
  - src/components/Reader/Reader.tsx
  - src/components/Reader/EpubReader.tsx
  - src/components/Reader/Reader.module.css
  - src/components/Reader/EpubReader.module.css
  - src/components/Reader/QuoteToNoteModal.tsx
  - src/components/LanguageTools/LanguageBar.tsx
  - src/components/LanguageTools/TranslatePopover.tsx
  - src/components/ShortcutsOverlay/ShortcutsOverlay.tsx
- Files created:
  - src/lib/vocabulary.ts
  - src/lib/vocabulary.test.ts
  - src/lib/vocabularyDestination.ts
  - src/lib/vocabularyDestination.test.ts
  - src/hooks/useBookVocabulary.ts
  - src/hooks/useVocabularySend.ts
  - src/components/LanguageTools/VocabularyTab.tsx
  - src/components/LanguageTools/VocabularyTab.module.css
  - src/components/LanguageTools/SendVocabularyModal.tsx
  - src/components/LanguageTools/SendVocabularyModal.module.css
- Files removed:
  - nenhum (o harness e os scripts ficaram só no scratchpad e foram apagados)
- Left behind:
  - **Não verificável sem o app real** (entram no passo 4 do roteiro T3): o `V` e os cliques dentro do iframe do EPUB; o "ir à página" de um item de EPUB (`displayEpubAt` com um CFI de intervalo; se o epubjs não rejeitar um CFI que não resolve mais, o aviso "place wasn't found" não aparece e o leitor não se move); o `anchor.start/end` do PDF e os retângulos de uma seleção real (item sem offsets aponta só a página); a coluna de 300 px e as abas com 8 px com a fonte do app dentro do leitor (o harness mediu 283 px de abas com o Segoe UI, mas fora do leitor); o toggle "Translation" renderizado na tela do editor (o markdown abre e regrava idêntico no editor real, mas ninguém viu o toggle recolhido); o Undo depois de editar a nota; a gravação do SQL pelo `tauri-plugin-sql` (o SQL foi validado num SQLite em memória, não no plugin); o `onCreateNote` do App criando a nota de vocabulário no caderno escolhido; o seletor "Choose notebook and note…" abrindo por cima do modal de envio e voltando com a nota escolhida; o "Listen to list" com áudio de verdade.
  - **Sem teste de componente ou de hook no repositório:** as peças com React (`VocabularyTab`, `SendVocabularyModal`, `useBookVocabulary`, `useVocabularySend`, os dois leitores) foram conferidas pelo compilador, pelo harness visual (só os componentes, sem os leitores) e pelos testes das funções puras; a lógica de envio e Undo mora em `lib/vocabulary.ts` e `announceAppendedBlock`, mas o `deliver` do hook não tem teste.
  - Sem teste para as linhas do SQL de `tauri.ts` (`TauriStorage` não roda fora do Tauri); a ordem da lista é `created_at` crescente (a mais antiga primeiro, que é a ordem do bloco na nota e do "Listen to list").
  - "Listen to list" lê uma frase por item, mesmo quando vários itens vieram da mesma frase (a frase se repete).
  - A entrega 3 ainda precisa de: `headerExtra`/`footerExtra` no `VocabularyTab`, o `useVocabularyMarks` e a chave "Mark in text", o Retell, o popover "onde você guardou" e o professor.

### Orchestrator — decisão — 20261127063202
- Summary: Entrega 2 conferida. O Orquestrador rodou de novo `npx tsc --noEmit` (sem erros) e `npm test` (45 arquivos, 1138 testes, todos passando). Nenhum arquivo de Rust mudou nesta entrega (o diff de `src-tauri` é o mesmo da 1B), então vale o resultado de `npm run test:rust` relatado pelo `codeAgent` (124 passando, 3 ignorados). A branch segue `feat/language-study`, sem commit.
- Inputs:
  - sessão do `codeAgent` da entrega 2 neste arquivo
  - `src/hooks/useBookQuotes.ts` (`openNote`, `linkNote`) e `src/components/Reader/ReaderNotesPanel.tsx`, lidos para conferir o efeito do "Open"
- Decision: os desvios foram aceitos como detalhe de execução. Dois deles vão explicados ao Coordenador na entrega para teste: (1) o cabeçalho do bloco de vocabulário na nota é `###`, e não `####`, porque o editor só tem H1 a H3 e regravaria o H4 como parágrafo, o que quebraria o Undo; (2) o "Open" do aviso de envio e a marca "Sent to notebook" mostram a nota de vocabulário na aba Notes do leitor pelo `openNote`, que troca a nota vinculada ao livro, como já acontece com o "Open" de uma citação. Conferido no código: a aba Notes sempre mostra a nota vinculada e tem o seletor para voltar, mas enquanto a nota de vocabulário estiver vinculada, o "Add to note" das citações e o Retell da fase 3 vão para ela. Mostrar a nota sem trocar o vínculo exigiria mudar o modelo da aba Notes, fora do Task Report: fica como decisão do Coordenador depois do teste.
- Next step: codeAgent, entrega 3 (etapas 26 a 33)

### CodeAgent — implementação inicial (entrega 3, etapas 26 a 33) — 20261127070500
- Summary: Entrega 3 feita, sem commit, sem subir o app, sem chave e sem chamada paga. Por etapa:
  - **26** `lib/vocabMatch.ts`: `buildMatchTerms` (palavra e expressão, uma entrada por forma normalizada, com todos os itens que a têm), `findTermOccurrences` (palavra inteira por fronteira Unicode, caixa ignorada, espaço flexível nas expressões, apóstrofo tipográfico, **uma regex por lote de 200 formas**, mais longa vence na sobreposição) e as âncoras das frases guardadas (`pdfSentenceAnchors`, `epubSentenceAnchors`). 21 testes, incluindo "malle" em "mallette", forma base, item sem base, quebra de linha, apóstrofo e 500 termos em 5.000 caracteres.
  - **27** Pontilhado nos dois leitores pela CSS Custom Highlight API (cinza neutro, sem preenchimento; `PAGE_MARKS_MODE = 'highlight'`, sem reserva). `getVocabMarks`/`setVocabMarks` (`monet:vocab-marks`, padrão ligado) em `useLanguageSettings`; `useVocabularyMarks` (itens deste livro pela lista viva e dos outros livros da mesma língua por `getVocabularyByLanguage`, lido uma vez por livro aberto); chave "Mark in text" no topo da aba e em Settings › Language › Vocabulary. PDF: sobre o texto juntado da camada de texto, refeito depois de cada `textLayer.render()`; EPUB: `buildJoinedNodeText`/`rangeFromNodeOffsets` em `pageMarks.ts` (quebra entre blocos e em `<br>`), refeito em `rendered` e `relocated`, com as ocorrências de cada documento guardadas até a lista de formas mudar. Frases guardadas só no lugar de origem.
  - **28** Clique na palavra marcada: `SavedWordPopover` (portal, `z-index` 1100, 340 px) com as frases, a posição, o sentido e, nos itens de outro livro, "Saved in another book" e o título; Listen, Translate here (abre o `TranslatePopover` com a frase de agora), Add this sentence, Find in book (só no PDF) e Remove (só os itens deste livro, com Undo). O grifo tem prioridade nos dois leitores. Sem "I know this".
  - **29** `lib/languageProfile.ts` (tag `language profile` com alias, `findLanguageProfile`, `readProfileLevel`, `readProfileLine`, template) e, em Settings › Language, as seções "Vocabulary" e "Language profile" com "Open the note" (abre a nota ou cria no primeiro caderno e abre; `handleOpenLanguageProfile` no App).
  - **30** `lib/teacherContext.ts` (`buildTeacherBlock`, `teacherChipLabel`), `teacherBlock` opcional no `buildReaderContext` (ao fim; sem ele a saída é a de sempre, com teste), interruptor "Language teacher" na linha do Send e chip "AI sees" como botão com a prévia do bloco no `ReaderChatPanel`, lembrado por livro (`monet:reader-teacher`, desligado por padrão), e o hook `useReaderTeacher` nos dois leitores.
  - **31** `lib/retell.ts` (palavras, rótulo do trecho, bloco, `extractLastRetell`, `hasRetell`, `buildFeedbackMessage`), botão Retell na aba Vocabulary (`useRetell`: nota vinculada ou modo destino do `QuoteToNoteModal`, abre a aba Notes), "Ask for feedback" no cabeçalho da aba Notes e `pendingSend` no `ReaderChatPanel`.
  - **32** `DOCS/specs/languagestudy.md`, a spec na tabela "Especificações" e a entrada do estudo (implementado em 2026-11-27) em `DOCS/docs.menu.md`, e o item do Library no inventário de `DOCS/specs/PRD.md`.
  - **33** O roteiro T3, no fim deste arquivo (seção "Roteiro de teste do Coordenador").
- Como a marca casa palavra e forma base: cada item de palavra ou expressão entra com a forma guardada e, quando existe (só se foi traduzido pelo popover, que devolve a forma base), a forma base, ambas normalizadas (NFC, minúsculas, aspas retas). Uma forma que dois itens têm leva os dois ids. O texto da página é percorrido com uma regex por lote de 200 formas (as mais longas primeiro), com fronteira `(?<![\p{L}\p{M}\p{N}])…(?![\p{L}\p{M}\p{N}])`. Com **centenas de itens** são poucas passadas por página (500 termos em 5.000 caracteres: um teste mede 400 ms de teto, o alvo de 50 ms); no EPUB o capítulo inteiro é casado uma vez e as virações de página dentro dele reusam o resultado até a lista mudar. O que o harness mediu no Edge: 4 formas em um parágrafo, 6 ms para casar e montar os ranges nos dois documentos.
- O bloco do professor como vai ao chat: `buildReaderContext` acrescenta, depois do que já mandava (livro, posição, texto da página, grifos), uma linha em branco e o bloco `Language teacher (on)` com: a língua do livro, a do usuário e o nível ("Level in French: B1", só com nível); "Answer in <nativa>. Quote examples in <livro> from the page."; "When the reader writes in <livro>, comment on what to fix and why. Don't rewrite the whole text."; as linhas "Explain:" e "Avoid:" da nota de perfil, quando existem; e "Words the reader saved on this page: entrebâillée (entreaberta); malle; …" (só com itens, até 20, sentido cortado em 60 caracteres, só deste livro e da página atual). Vai só no contexto efêmero, nunca na conversa gravada. Desligado, ou sem as ferramentas de língua, o `teacherBlock` não é passado e a saída é byte a byte a de antes (`readerContext.test.ts` compara).
- Verificação (saída real): `npx tsc --noEmit` sem erros; `npm test` **50 arquivos e 1223 testes passando** (antes: 45 e 1138; +5 arquivos novos: `vocabMatch`, `languageProfile`, `teacherContext`, `retell`, `readerContext`; mais testes em `pageMarks` e `pdfTextLayer`); `npm run test:rust` **124 passando, 0 falhas, 3 ignorados** (nada de Rust mudou; os 3 já eram ignorados). Dois harnesses no Edge headless (scratchpad, Vite com junction de `node_modules`, perfil fora da raiz; processos encerrados com `taskkill /T /F`, junction removida com `cmd /c rmdir`, `node_modules` do projeto intacto, pastas apagadas, nenhum `msedge.exe` nem `node.exe` do harness restante): (1) os módulos reais `vocabMatch.ts`, `pageMarks.ts` e `pdfTextLayer.ts` sobre uma camada de texto transparente no documento principal e sobre um documento num iframe (com `<em>`, `<br>` e títulos): o pontilhado cinza saiu sob as palavras certas, as frases guardadas e as palavras de expressão, e **não** sob "mallette"; `markEntryAtPoint` achou a marca no centro de cada uma (PDF e iframe) e devolveu null fora delas, com os retângulos reais do motor; (2) `VocabularyTab` (300 px, com itens e vazia), `SavedWordPopover` (palavra com item de outro livro, e frase) e o CSS do interruptor, do chip com prévia e do botão "Ask for feedback" do cabeçalho das Notes (340 px): tudo coube, sem corte, popovers com `z-index` 1100.
- Desvios do plano, com motivo:
  - **`MatchTerm` é `{ form, itemIds }`**, uma entrada por forma, e não `{ itemIds, forms }`: com várias formas por entrada, uma ocorrência da forma base devolveria os itens de outras formas.
  - **`sentenceAnchorsForPage(items, page)` virou duas funções** (`pdfSentenceAnchors(items, bookId, page)` e `epubSentenceAnchors(items, bookId)`) e filtra o livro: a âncora de uma frase de outro livro aponta para páginas dele.
  - **O acerto do clique é pelos retângulos do Range** (`markEntryAtPoint`, com `getClientRects`) e não por `caret` + `isPointInRange`: o caret devolve a posição mais próxima mesmo num clique no espaço entre palavras. No EPUB o clique vem de `rendition.on('click')` (helper `onEpubViewClick` em `epub.ts`, que já repassa o documento do iframe) e não de um listener em `hooks.content.register`; o `markClicked` do grifo chega na mesma rodada do evento, então o clique espera um `setTimeout(0)` e só abre o popover se nenhum `markClicked` veio no meio (`highlightClickSeqRef`). Seleção em curso também não abre.
  - **`useVocabularyMarks({ book, enabled, bookItems })`**, sem `refresh`: os itens deste livro vêm da lista viva do `useBookVocabulary` (o `refresh` tinha saído na entrega 2 como código morto), então adicionar e remover remarca na hora; só os dos outros livros são lidos do banco.
  - **`VocabularyTab` com props explícitas** (`marksOn`/`onToggleMarks`, `canRetell`/`onRetell`) no lugar dos `headerExtra`/`footerExtra` de `ReactNode`. O Retell desabilitado explica no `title` ("Tick the words you want to use, or save new ones first").
  - **`TranslatePopover` ganhou `standalone`** (fecha sozinho com Esc e clique fora, mas guarda como "Add to vocabulary"), para o "Translate here" de uma palavra marcada, que não tem seleção do leitor.
  - **Três hooks compartilhados** para não duplicar nos dois leitores: `useVocabularyRemoval` (substitui o `removeVocabularyItem` de cada leitor, agora com vários itens e um Undo só), `useReaderTeacher` e `useRetell`. `SavedWordPopover` mostra "Find in book" só se recebe `onFind` (o EPUB não passa).
  - **O popover de uma frase guardada mostra só Listen e Remove** (não há palavra a traduzir nem frase a juntar). Quando uma palavra e uma frase guardada contêm o ponto do clique, vale a palavra.
  - **Prop nova `disabledNotebookIds`** (App → Library → leitores) para o perfil de língua respeitar os cadernos de IA desligada, como o Radar. `SettingsModal` ganhou `onOpenLanguageProfile` e o App o `handleOpenLanguageProfile`.
  - **Template da nota de perfil com uma linha por parágrafo** (`\n\n`): o editor junta linhas seguidas num parágrafo só, e o `Save radar profile` já faz igual. O alias "perfil de língua" vale pela forma sem acento ("perfil de lingua"), que é o que `tagKey` compara.
  - **O bloco do Retell termina na linha "Words:"**, sem linha em branco sobrando: o editor já deixa um parágrafo vazio no fim da nota (TrailingNode), onde o usuário escreve. Se o `models` do chat não carregou, o "Ask for feedback" põe o reconto no campo do chat em vez de perdê-lo.
  - **Fora do plano, só por causa da regra de duplicata de código**: `epubRangeScreenRect(range)` em `epub.ts` (o `liveScreenRect` passou a usá-lo) e `epubContentsDocuments`/`epubCfiFromRange`.
- Files changed:
  - DOCS/docs.menu.md
  - DOCS/specs/PRD.md
  - DOCS/reports/26-11-2026/planreport_20261127000656.md (status das etapas 26 a 33)
  - DOCS/reports/26-11-2026/executionreport_20261126233242.md
  - src/App.tsx
  - src/components/Library/Library.tsx
  - src/components/Reader/Reader.tsx
  - src/components/Reader/EpubReader.tsx
  - src/components/Reader/ReaderChatPanel.tsx
  - src/components/Reader/ReaderChatPanel.module.css
  - src/components/Reader/ReaderNotesPanel.tsx
  - src/components/Reader/ReaderNotesPanel.module.css
  - src/components/Reader/readerContext.ts
  - src/components/Reader/pdfTextLayer.test.ts
  - src/components/LanguageTools/VocabularyTab.tsx
  - src/components/LanguageTools/VocabularyTab.module.css
  - src/components/LanguageTools/TranslatePopover.tsx
  - src/components/Settings/LanguageSettings.tsx
  - src/components/Settings/LanguageSettings.module.css
  - src/components/Settings/SettingsModal.tsx
  - src/hooks/useLanguageSettings.ts
  - src/lib/languageSettings.ts
  - src/lib/pageMarks.ts
  - src/lib/pageMarks.test.ts
  - src/lib/epub.ts
- Files created:
  - DOCS/specs/languagestudy.md
  - src/lib/vocabMatch.ts
  - src/lib/vocabMatch.test.ts
  - src/lib/languageProfile.ts
  - src/lib/languageProfile.test.ts
  - src/lib/teacherContext.ts
  - src/lib/teacherContext.test.ts
  - src/lib/retell.ts
  - src/lib/retell.test.ts
  - src/components/Reader/readerContext.test.ts
  - src/components/LanguageTools/SavedWordPopover.tsx
  - src/components/LanguageTools/SavedWordPopover.module.css
  - src/hooks/useVocabularyMarks.ts
  - src/hooks/useVocabularyRemoval.ts
  - src/hooks/useReaderTeacher.ts
  - src/hooks/useRetell.tsx
- Files removed:
  - nenhum (o `removeVocabularyItem` de cada leitor saiu para o `useVocabularyRemoval`; os dois harnesses ficaram só no scratchpad e foram apagados)
- Left behind:
  - **Não verificável sem o app real** (entra no roteiro): o pontilhado e o clique com o `Reader` e o `EpubReader` de verdade (os harnesses usaram os módulos e documentos de teste, não o pdf.js nem o epubjs); o `rendition.on('click')` e o `markClicked` do mesmo clique, e a ordem entre eles; o desempenho com centenas de itens num capítulo de EPUB grande; o Retell com o editor real (a nota abre no topo, o usuário rola até o fim); o `pendingSend` do "Ask for feedback" com o chat real (esperar chave, modelos e conversa ativa); "Open the note" criando a nota no primeiro caderno e levando para ela (o Settings fecha e o livro aberto sai da tela); a resposta do professor em si (nenhuma chamada paga foi feita).
  - **Sem teste de componente ou de hook no repositório**: `SavedWordPopover`, `useVocabularyMarks`, `useVocabularyRemoval`, `useReaderTeacher`, `useRetell`, o `ReaderChatPanel` com o professor e os dois leitores foram conferidos pelo compilador, pelos harnesses e pelos testes das funções puras (casamento, âncoras, nós de texto, ponto no retângulo, perfil, bloco do professor, contexto, Retell, mensagem de feedback).
  - O Retell fica desabilitado quando todos os itens já foram enviados e nenhum está marcado (a regra do Task Report é "os marcados, ou os novos"): marque os itens para recontar. É decisão do Coordenador depois do teste.
  - O "Open" do aviso de envio e o chip "Sent to notebook" ainda vinculam a nota de vocabulário ao livro (decisão do Orquestrador, entrega 2): o Retell escreve na nota vinculada, então vai para a de vocabulário nesse caso. Está no roteiro.
  - Nenhum código sem chamador sobrou: `getVocabularyByLanguage` (sem chamador na entrega 2) agora é usado pelo `useVocabularyMarks`; o `onTranslateItem`, o `LanguageBar` e os demais já tinham chamador.

### Orchestrator — decisão — 20261127070257
- Summary: Entrega 3 conferida, e com ela as 33 etapas do plano estão `FEITO`. O Orquestrador rodou de novo `npx tsc --noEmit` (sem erros), `npm test` (50 arquivos, 1223 testes, todos passando) e `npm run test:rust` (124 passando, 3 ignorados). Conferido na árvore: o CSP e o `package.json` não mudaram; a única dependência nova é a `sha2`; o único id de modelo de voz fora dos testes é o padrão `google/gemini-3.8-flash-tts`; não há flashcards, "I know this", "Recall first" nem contador; a spec `DOCS/specs/languagestudy.md` existe e está no menu; não sobrou processo do Edge dos harnesses. A branch segue `feat/language-study` (base `43a9ae8`), sem commit.
- Inputs:
  - sessão do `codeAgent` da entrega 3 e o roteiro de teste no fim deste arquivo
- Decision: os desvios da entrega 3 foram aceitos como detalhe de execução e estão na seção 7 do roteiro, junto dos oito padrões do Apêndice F do plano. Desenvolvimento entregue ao Coordenador para teste. O que nenhum agente pôde verificar, por não subir o app e não fazer chamada paga: o áudio e a tradução reais (o primeiro "Test voice" é o primeiro áudio real), os dois leitores de verdade com o pdf.js e o epubjs, e o desempenho das marcas com centenas de itens num EPUB grande.
- Next step: aguardando o Coordenador testar pelo roteiro e confirmar; só então o `codereviewAgent` (Opus 5.5) e a passada final do `codeAgent`. Sem commit até ele decidir.

### Orchestrator — decisão — 20261127095740
- Summary: o Coordenador respondeu à entrega do desenvolvimento com "pode revisar, eu vou testar no final". Ele inverteu a ordem das duas etapas por decisão própria: a revisão de código roda agora, sobre código ainda não testado no app, e o teste dele pelo roteiro de 78 passos fica para depois da passada final.
- Inputs:
  - `DOCS/reports/26-11-2026/taskreport_20261126233242.md`
  - `DOCS/reports/26-11-2026/planreport_20261127000656.md`
  - `DOCS/specs/languagestudy.md`
- Decision: seguir para a Etapa 2 com `codereviewAgent` (Opus 5.5) e depois uma única passada final do `codeAgent` (Sonnet 5.5), como aprovado no Task Report. Como nada foi exercitado no app, a revisão é avisada disso e olha com mais cuidado o que os testes automáticos não cobrem (módulo de voz contra a resposta real do OpenRouter, integração com o pdf.js e o epubjs, estado do player). As restrições seguem as mesmas: agentes sem leitura da chave e sem chamada paga, app não é executado, sem commit.
- Next step: `codereviewAgent`; depois a passada final do `codeAgent`; depois o teste do Coordenador.

### CodeReviewAgent (voz e player) — 20261127100629
- Summary: Revisão da voz e do player (`speech.rs`, front de voz, Settings › Language, ligação de Listen nos dois leitores), conferida contra a documentação oficial do OpenRouter e a resposta real dos dois catálogos públicos, sem chave. Confirmados: o corpo do pedido, o áudio cru no 2xx, o Content-Type por formato, o formato do erro e dos catálogos; o padrão Gemini vai em wav. Achados: (I1) quatro ids do catálogo sem formato conhecido (dois `:free` e dois MiniMax) e o HeyGen caem em PCM lido a 24 kHz, então o áudio sai lento, passa na checagem de duração e fica no cache (a premissa da decisão F.3 não se sustenta); (I2) a voz padrão é a primeira da lista, que no MAI é tcheca e no Deepgram e no Kokoro é inglesa; (I3) o Listen de item ou de palavra guardada toca por cima do player; (I4) Next/Back para uma frase não pronta não cala a frase atual; (I5) faltam testes do fluxo de `tts_speak` e desses casos. Mais 9 nits. Continuam suposição até a primeira chamada real: o `rate=` no Content-Type do PCM, o cabeçalho do WAV do Gemini, os bytes do mp3, o custo do Gemini por token de áudio e a cobrança de pedido cancelado.
- Verdict: APROVADO COM RESSALVAS (0 críticos, 5 importantes, 9 nits)
- Output: `DOCS/reports/26-11-2026/reviewreport_20261127100629_voice.md`

### CodeReviewAgent (leitores e tradução) — 20261127100918
- Summary: Revisão da língua por livro, do Translate, dos leitores PDF e EPUB (leitura integral de `Reader.tsx` e `EpubReader.tsx`) e da casca do app, por leitura de código. Com livro na língua do usuário e as ferramentas desligadas, o leitor fica igual ao de antes, conferido item a item, desde que a língua seja reconhecida. Achados: (1) metadado `und`/`mul`/`zxx` de EPUB é aceito como língua e liga as ferramentas num livro nativo; (2) no PDF, clicar no rótulo do rodapé do Translate fecha o popover; (3) no EPUB, a pausa ao virar a página depende do ordinal da location e falha com fonte grande ou seleção na location seguinte; (4) seta esquerda/direita num `<select>` também vira a página; (5) a detecção de língua não tem teste para pt, es, it, de, nl nem para a confusão pt × es. Mais 8 nits.
- Verdict: APROVADO COM RESSALVAS (0 críticos, 5 importantes, 8 nits)
- Output: `DOCS/reports/26-11-2026/reviewreport_20261127100918_reader.md`

### CodeReviewAgent (vocabulário e prática) — 20261127101149
- Summary: Revisão das entregas 2 e 3 (vocabulário, `book_vocabulary`, envio e Undo, marcas e popover da palavra, perfil, professor e Retell). Rodou os 7 arquivos de teste da área (113 testes passando) e um benchmark do casamento das marcas (600 formas em 80.000 caracteres em 2 a 6 ms). Achados: (I1) o "Open" e o chip "Sent to notebook" trocam o vínculo livro → nota, e com isso a nota Paper perde o livro e o "Save to note" do chat muda de destino (discordância com decisão aceita, com uma correção pequena descrita); (I2) a língua do item não acompanha a correção da língua do livro; (I3) no PDF, a frase do item é a primeira da página que contém o termo (duplicata falsa, frase errada na nota); (I4) o caderno padrão da nota nova de vocabulário e da nota de perfil é o primeiro da lista, em geral o Calendar. Mais 12 nits. Com o professor desligado, o contexto do chat é byte a byte o de antes.
- Verdict: APROVADO COM RESSALVAS (0 críticos, 4 importantes, 12 nits)
- Output: `DOCS/reports/26-11-2026/reviewreport_20261127101149_vocab.md`

### Orchestrator — decisão — 20261127101530
- Summary: a revisão foi feita por três `codereviewAgent` (Opus 5.5) em paralelo, um por área, porque a mudança soma cerca de 14,6 mil linhas (3.204 em arquivos rastreados e 11.439 em arquivos novos) e não cabia numa leitura só; cada um gravou o seu review e o Orquestrador registrou as três sessões acima. Os três veredictos são APROVADO COM RESSALVAS: 0 críticos, 14 importantes e 29 nits no total.
- Inputs:
  - `DOCS/reports/26-11-2026/reviewreport_20261127100629_voice.md`
  - `DOCS/reports/26-11-2026/reviewreport_20261127100918_reader.md`
  - `DOCS/reports/26-11-2026/reviewreport_20261127101149_vocab.md`
- Decision: uma única passada final do `codeAgent` (Sonnet 5.5) sobre os três reviews, com esta triagem do Orquestrador:
  - Corrigir os 14 importantes, com os testes que os cobrem (voz I1 a I5; leitores 1 a 5; vocabulário I1 a I4).
  - Duas decisões de detalhe aceitas antes são revistas pelo que a revisão mostrou. A F.3 (PCM sem taxa declarada lido a 24 kHz) supunha que a checagem de duração recusaria o áudio errado, e a conta do revisor mostra que não recusa. O "Open" que troca o vínculo livro → nota, que estava como decisão em aberto para o Coordenador, atinge também a nota Paper e o "Save to note" do chat; passa a abrir a nota de vocabulário sem trocar o vínculo. As duas ficam marcadas para o Coordenador conferir no teste.
  - Nits a critério do `codeAgent`, com preferência para os que são regra da casa (z-index do menu do player, código morto) e os que mexem em dado ou em texto visível (voz N1, N2, N9; leitores 6, 7, 8, 9, 13; vocabulário N2, N3, N6, N7, N8, N9, N10).
  - Fica para o Coordenador decidir, sem mudança agora: o "Ask for feedback" deixar o professor ligado naquele livro (vocabulário N1). O que o `codeAgent` não ajustar volta listado com o motivo.
- Next step: passada final do `codeAgent`; depois `tsc`, `npm test` e `npm run test:rust` pelo Orquestrador; depois o teste do Coordenador.

### CodeAgent — ajuste final — 20261127104628
- Summary: Passada final sobre os três reviews, sem commit, sem subir o app, sem chave e sem chamada paga (o catálogo público do OpenRouter não foi consultado de novo: o revisor de voz já tinha conferido). Os 14 importantes foram corrigidos, cada um com teste; dos nits, os da triagem e mais alguns. Em resumo:
  - **Voz (Rust e player).** Modelo sem formato conhecido herda os formatos do id sem o sufixo `:…` e, sem achar, pede `mp3` (nunca PCM às cegas); a única exceção por provedor é o PCM do HeyGen a 44,1 kHz quando o `Content-Type` não traz a taxa (comentada no código e na spec; a decisão F.3 está revista). Voz padrão pela língua do livro e lembrada por modelo e por língua (formato antigo de `monet:tts-voices` continua lido). `speakOnce` e o player nunca tocam juntos. Next/Back/Repeat para frase em geração ou em erro cala a frase atual. Preço por segundo e rótulo "Free". Pedido sem voz leva a primeira do modelo no Rust. "Clear saved audio" no meio de uma conversão não gasta o aviso. Menu ⋯ do player acima dos popovers. Código morto fora (`speedRange`, `PdfTextItem.x`).
  - **Leitores.** `und`/`mul`/`zxx`/`mis`/`x-…`/`i-…` não são língua (EPUB cai na amostra do texto). Teclas: `ownsKeyboard` (campo, `<select>`, texto editável e modal) vale para as setas também. Rótulo do rodapé do Translate no PDF e o `<select>` não fecham mais o popover. EPUB identifica a tela pelo CFI (início e fim do último `relocated`), não pelo ordinal da location. Teste de detecção por língua e dos pares pt × es (a heurística acertou, sem mudar).
  - **Vocabulário.** `showNote` (aba Notes mostra a nota de vocabulário sem trocar o vínculo, com a linha "Not linked to this book · Back to the book's note" e a proteção dos efeitos C e D). `setBookLanguage` corrige a língua dos itens, e o hook acompanha em memória. Frase da ocorrência selecionada (PDF pelo texto juntado, EPUB pelo bloco). Caderno padrão nunca o Calendar (e o do perfil nunca com a IA desligada); "Change" abre em "Current destination".
- Achados dos reviews, um a um (feito / não feito e por quê):
  - **Voz I1** feito (`request_format`, `formats_for`, `pcm_rate`; testes: `choose_format` sobre `parse_catalog` com ids sem formato, HeyGen 44,1 kHz, e a conta que mostra que a checagem de duração não pega a taxa errada). Um ponto diferente da triagem: com o catálogo **inteiro** desconhecido (sem rede e sem cópia em disco) o pedido sai em `pcm`, o padrão do endpoint, e não em `mp3`, porque `mp3` faria o padrão do projeto (o Gemini, que só aceita pcm e wav) falhar justo nesse caso; com o catálogo conhecido e o modelo sem formato, é `mp3`.
  - **Voz I2** feito (`voiceFor` e `voicesByLanguage` por nome de voz: o código da língua ou o nome inglês dela como palavra inteira do nome; o seletor lista as da língua primeiro; `getTtsVoice`/`setTtsVoice` com chave `modelo|língua`, lendo o formato antigo). Não escrevi a regra do prefixo do Kokoro (`ff_`, `af_`): é uma regra por provedor, e a triagem só deixa uma exceção por provedor no código (o HeyGen). Modelos assim caem na primeira voz da lista.
  - **Voz I3** feito no motor (vale para os dois leitores e para o Settings): `speakOnce` pausa o player; `play` e qualquer retomada do player param o `speakOnce`.
  - **Voz I4** feito (`startCurrent` pausa o áudio nos ramos "preparing" e "error").
  - **Voz I5** feito: 5 testes novos no Rust (129 passando; antes 124) e testes do player (I2, I3, I4, `clearAway`, `play()` recusado com `NotAllowedError`).
  - **Voz N1** feito (por segundo, "Free" só em id `:free`; nos outros, "Price not published"). **N2** feito no Rust (`default_voice`; não fiz a nova tentativa do hook). **N5** feito (junto do leitores 4). **N6** feito (o player sobe a 1100 com o menu aberto). **N7** feito: `speedRange` saiu do Rust e do front, `formats` fica no Rust (usado ali) com comentário de que o front não o lê, `PdfTextItem.x` saiu. **N8** feito (mesmo achado do leitores 3). **N9** feito (contador `CLEARS`, subido antes de apagar; uma falha de gravação depois dele não avisa).
  - **Voz N3** (pedido cancelado) e **N4** (cabeçalho e rodapé do PDF) não feitos, por pedido da triagem: esperam o teste com um livro real.
  - **Leitores 1** feito (`baseLanguage`; testes de `und` em `baseLanguage`, `languageToolsOn` e `detectEpubLanguage` com um livro falso). **2** feito (`preventDefault` só fora de `select`, `input` e `textarea`, e `onMouseUp` do popover sem subir; vale para o `<select>` também; não rodei no app). **3** feito (`epubViewKey`, `epubCfiInView` e o efeito por tela; `handleListenPage` usa a mesma chave). **4** feito (`ownsKeyboard`, com teste). **5** feito (um caso positivo por língua, dois pares pt × es).
  - **Leitores 6** feito (o clique no iframe fecha o Translate de item e de palavra marcada e o menu ⋯, por um `mousedown` do corpo do documento, que é o que eles já escutam). **7** feito (`clearAway`, nos dois leitores). **8** feito (`wrap.contains` no começo de `handlePageClick`). **9** feito (o diálogo de excluir fala de novo das citações e do vocabulário já enviado). **12** feito (= voz N6). **13** feito (= leitores 4).
  - **Leitores 10** (selecionar e copiar o texto da tradução) e **11** (a detecção da primeira abertura antes da primeira página) não feitos: ficaram fora da lista da triagem e o 10 reabre o risco do 2; cada um é pequeno e pode entrar depois do teste.
  - **Vocabulário I1** feito (`showNote`/`viewRequest` no `useBookQuotes`, `viewing`/`viewingUnlinked`/`showLinked` no `ReaderNotesPanel`; sem pedido, a aba é a de antes, e 12 testes de componente comparam as duas coisas). **I2** feito (SQL no `setBookLanguage`, e o hook acompanha o estado). **I3** feito (`contextSentenceAt`, `countTermBefore`, `epubSelectionOccurrence`; PDF e EPUB). **I4** feito (`defaultNotebooks`).
  - **Vocabulário N2** feito (texto neutro no modo destino). **N3** feito (o chip conta o que o bloco leva). **N6** feito (o "Add" espera a carga da lista; a carga não derruba o item novo). **N7** feito (o aviso diz que o envio não foi marcado). **N8** feito (o Undo restaura um item de cada vez). **N9** feito ("Current destination"). **N10** feito (negrito na palavra inteira, também no Translate).
  - **Vocabulário N1** não feito, por decisão do Coordenador (o "Ask for feedback" deixa o professor ligado no livro). **N4**, **N5**, **N11** e **N12** não feitos: fora da lista da triagem e sem risco de dado (N12 é só organização).
- Testes novos que são os primeiros de componente do repositório, mantidos de propósito: `ReaderNotesPanel.test.tsx` (a aba Notes com e sem `showNote`, a parte que está validada em uso real) e `useBookVocabulary.test.tsx`. Usam `react-dom/client` e `act`, com o Editor e os ícones simulados.
- Verificação (saída real): `npx tsc --noEmit` sem erros; `npm test` **56 arquivos e 1297 testes passando** (antes: 50 e 1223); `npm run test:rust` **129 passando, 0 falhas, 3 ignorados** (antes: 124); `cargo check` sem avisos. `package.json`, `Cargo.toml` e a CSP não mudaram; nenhum comando novo no Rust nem tabela nova no banco (`setBookLanguage` ganhou um `UPDATE` em `book_vocabulary`, sem `BEGIN`/`COMMIT`).
- Files changed:
  - DOCS/specs/languagestudy.md
  - DOCS/reports/26-11-2026/executionreport_20261126233242.md
  - src-tauri/src/speech.rs
  - src/App.tsx
  - src/storage/tauri.ts
  - src/storage/index.ts
  - src/lib/language.ts
  - src/lib/language.test.ts
  - src/lib/languageDetect.test.ts
  - src/lib/languageSettings.ts
  - src/lib/epub.ts
  - src/lib/speech.ts
  - src/lib/ttsCost.ts
  - src/lib/ttsCost.test.ts
  - src/lib/pdfText.ts
  - src/lib/pdfText.test.ts
  - src/lib/vocabMatch.ts
  - src/lib/vocabMatch.test.ts
  - src/lib/vocabulary.ts
  - src/lib/vocabulary.test.ts
  - src/lib/vocabularyDestination.ts
  - src/lib/vocabularyDestination.test.ts
  - src/lib/teacherContext.ts
  - src/lib/teacherContext.test.ts
  - src/hooks/useListenPlayer.ts
  - src/hooks/useListenPlayer.test.ts
  - src/hooks/useLanguageSettings.ts
  - src/hooks/useBookQuotes.ts
  - src/hooks/useBookVocabulary.ts
  - src/hooks/useVocabularySend.ts
  - src/hooks/useVocabularyRemoval.ts
  - src/hooks/useReaderTeacher.ts
  - src/components/Reader/Reader.tsx
  - src/components/Reader/EpubReader.tsx
  - src/components/Reader/ReaderNotesPanel.tsx
  - src/components/Reader/ReaderNotesPanel.module.css
  - src/components/Reader/QuoteToNoteModal.tsx
  - src/components/Library/Library.tsx
  - src/components/LanguageTools/MiniPlayer.tsx
  - src/components/LanguageTools/MiniPlayer.module.css
  - src/components/LanguageTools/VoiceModelPicker.tsx
  - src/components/LanguageTools/TranslatePopover.tsx
  - src/components/LanguageTools/SendVocabularyModal.tsx
  - src/components/Settings/LanguageSettings.tsx
- Files created:
  - src/lib/keyboardTarget.ts
  - src/lib/keyboardTarget.test.ts
  - src/lib/languageSettings.test.ts
  - src/lib/epubLanguage.test.ts
  - src/lib/epubView.test.ts
  - src/components/Reader/ReaderNotesPanel.test.tsx
  - src/hooks/useBookVocabulary.test.tsx
- Files removed:
  - nenhum
- Left behind:
  - **Não verificável sem o app real** (entra no item 8 do roteiro): tudo o que depende do pdf.js, do epubjs e da WebView2: o clique no rótulo e no `<select>` do Translate no PDF, a pausa por CFI com fonte grande no EPUB, o `mousedown` sintético do iframe fechando os popovers, o menu ⋯ acima do aviso, a aba Notes com o "Open" (testada com o Editor simulado, não com o editor real), a voz escolhida por língua com um catálogo de verdade e o formato dos modelos `:free`. Nenhum áudio nem tradução reais foram gerados.
  - O que continua **suposição** sobre o `POST /audio/speech` (o revisor de voz listou): o `rate=` no `Content-Type` do PCM, o cabeçalho do WAV do Gemini, os bytes do mp3, o custo do Gemini por token de áudio e a cobrança de pedido cancelado.
  - A voz por nome só reconhece língua que está escrita no nome (`fr-FR-…`, `…-fr`, `fr_…`, "French"). Kokoro (`ff_`, `af_`) e vozes com nome próprio sem sinal de língua caem na primeira da lista.
  - Se o catálogo falha também no Rust (sem rede e sem cópia em disco), o primeiro pedido do Gemini ainda sai sem voz e o Gemini o recusa (voz N2); o hook do front não tenta de novo ao abrir o menu ⋯.
  - No EPUB a "frase" do item é uma frase do bloco; a ocorrência é contada no bloco, então um termo repetido dentro da mesma frase ainda dá a mesma frase (e "Already in your vocabulary" na segunda). Hifenização no PDF pode deslocar a contagem de ocorrências; sem achar, vale a regra antiga (a primeira frase que contém o termo).
  - O Retell e o "Save to note" do chat seguem a nota vinculada; o `showNote` não muda isso (era o objetivo), mas quem usa só a nota de vocabulário como destino precisa vinculá-la pelos seletores da aba.

### Orchestrator — encerramento — 20261127104951
- Summary: pipeline concluído na ordem que o Coordenador escolheu (revisão antes do teste). A passada final do `codeAgent` corrigiu os 14 importantes dos três reviews, com teste para cada um, e a maior parte dos nits. O Orquestrador rodou depois da passada: `npx tsc --noEmit` limpo; `npm test` com 56 arquivos e 1297 testes; `npm run test:rust` com 129 passando e 3 ignorados. `package.json` e a CSP seguem sem mudança, e o `Cargo.toml` só tem o `sha2` da entrega 1B. Conferido por leitura: a guarda de teclado nova (`ownsKeyboard`) mantém o que o leitor já ignorava antes da task (campo e texto editável) e acrescenta `<select>` e modal; a aba Notes, sem pedido de "só mostrar", segue os mesmos efeitos de antes.
- Inputs:
  - `DOCS/reports/26-11-2026/reviewreport_20261127100629_voice.md`
  - `DOCS/reports/26-11-2026/reviewreport_20261127100918_reader.md`
  - `DOCS/reports/26-11-2026/reviewreport_20261127101149_vocab.md`
- Decision: aceitos os quatro pontos em que o `codeAgent` decidiu diferente da triagem (pedido em `pcm` quando o catálogo inteiro é desconhecido, para não quebrar o Gemini; primeiros testes de componente do repositório, para a aba Notes e a carga do vocabulário; teclas com o foco dentro de modal ficam com o modal, setas inclusive; `mousedown` sintético no documento pai para o clique no iframe do EPUB fechar popovers e o menu do player). Ficou para trás, com o motivo na sessão do `codeAgent`: voz N3 e N4 (esperam um livro real) e a nova tentativa do catálogo no front (N2); leitores 10 (copiar a tradução) e 11 (detecção antes da primeira página do EPUB); vocabulário N1 (o "Ask for feedback" deixa o professor ligado, decisão do Coordenador), N4, N5, N11 e N12; a voz padrão do Kokoro, cujos prefixos de língua são próprios do provedor; e a palavra repetida dentro da mesma frase no EPUB.
- Next step: aguardando o teste do Coordenador pelo roteiro (92 passos; a seção 8 traz os 14 novos, um por mudança de comportamento da passada final). O app nunca foi executado com este código e nenhum áudio ou tradução reais foram gerados. Sem commit até ele decidir.

### Orchestrator — decisão — 20261127115441
- Summary: a rodada 1 foi commitada pelo Coordenador (`8ce293c`) e ele começou o teste. Do teste vieram três pedidos sobre a janela de tradução (o popover de Translate de uma passagem), com um print da janela aberta sobre um parágrafo:
  1. Deixar a janela com tamanho ajustável (clicar e arrastar) e gravar a última posição e o último tamanho, para ela abrir sempre na última posição.
  2. Enviar um `uxAgent` para rever os espaçamentos da janela: os botões estão perto demais do texto.
  3. A tradução está lenta demais: ver a causa (hipótese dele: um system prompt maior do que deveria).
- Inputs:
  - `src/components/LanguageTools/TranslatePopover.tsx`, `src/components/LanguageTools/TranslatePopover.module.css` (folha compartilhada com `SavedWordPopover.tsx`)
  - `src/lib/translate.ts`, `src/components/Reader/toolbarPlacement.ts`
  - `src-tauri/src/lib.rs` (`openrouter_stream_chat`, `run_openrouter_stream`)
- Decision:
  - Entendimento do pedido 1: "última posição" só existe se a janela puder ser movida, então ela passa a ser movida (arrastando o cabeçalho) e redimensionada (arrastando borda ou canto), com posição e tamanho gravados no `localStorage`; sem nada gravado, abre ancorada na seleção como hoje.
  - Pedido 3, diagnóstico por leitura de código (os agentes não fazem chamada paga, então não há medida de tempo): o system prompt não é a causa. Ele tem uma linha e a mensagem do usuário tem cerca de 60 palavras além do texto selecionado; o comando do Rust manda só `model`, `stream` e `messages`, sem reasoning, sem tools e sem nada do chat. A causa é a janela esperar a resposta inteira: a IA responde em JSON (`translation` + até duas notas de gramática), o Rust já entrega em pedaços, mas `requestTranslation` junta tudo e só mostra depois do fim. Num parágrafo, a espera é a geração completa da tradução e das notas com o esqueleto na tela. Correção: mostrar o texto da tradução enquanto ele chega (extraindo o campo `translation` do JSON parcial), só no front, sem mudar o Rust. Ressalva: o comando não desliga o raciocínio de modelos que raciocinam por padrão; se o "Translation model" de Settings não for o padrão (`openai/gpt-4.1-mini`), isso soma segundos antes do primeiro texto.
  - Ordem: `uxAgent` primeiro (só relatório, sem editar código, para não haver dois agentes escrevendo nos mesmos arquivos); depois um `codeAgent` com os três pontos e a triagem do relatório de UX. Sem novo Task Report: são ajustes pedidos no teste (Passo 4, Etapa 1, item 3).
- Next step: `uxAgent`.

### UxAgent — espaçamentos da janela de tradução — 20261127115849
- Summary: a queixa procede e a causa é estrutural. O respiro entre o texto e os botões é o `padding-bottom` do `.body`, que rola junto, e o `.actions` tem `padding-top: 0`. Com um parágrafo que passa de 460 px (o caso do print), sobra 0 px visível e nenhuma linha entre o texto cortado e os botões. Além disso, o "Ask AI" quebra sozinho para a 2ª linha (~403 px de botões em 356 px úteis), e o rodapé tem borda própria: a parte de baixo ocupa ~104 px dos ~457 da janela. Propostas, com regra, valor de hoje e valor proposto em tokens:
  - A1 a A4 (Agora), respondem à queixa: ações como barra fixa (`padding: var(--space-2) var(--space-3)`, `border-top`, `flex-shrink: 0`); a linha de línguas dentro da barra (`.actions + .footer` sem borda); a passagem com 440 px e o gap ícone↔rótulo em `--space-1`, para os quatro botões caberem numa linha; barra de rolagem fina com `scrollbar-gutter: stable`.
  - B1 a B3, melhorias a mais: altura explícita do botão em `--control-md`; 12 px entre a tradução e as notas; esqueleto no ritmo do texto.
  - C1 a C9, mover e redimensionar: cabeçalho como alça; oito alças invisíveis; mínimo 300 × 220 px; uma geometria por variante (`monet:translate-window:passage`/`:word`); duplo clique para voltar ao padrão; ajuste para dentro da janela sem regravar; gravar só no `pointerup`.
  - D1 a D7, streaming: altura reservada pela estimativa do texto de origem e a janela parada enquanto o texto chega; barra de ações desde o loading, com "Add to vocabulary" desativado até o fim; "Translating…"; sem rolagem automática; esqueleto das notas; texto parcial mantido no erro.
  - Decisão para o Coordenador: C5, se a janela da palavra lembra também a posição ou só o tamanho.
  - Sem app rodando: medidas do print (1:1) e do CSS. Nenhum código alterado.
- Inputs:
  - pedido 2 da sessão `Orchestrator — decisão — 20261127115441` e o print do Coordenador
  - `src/components/LanguageTools/TranslatePopover.tsx`, `TranslatePopover.module.css`, `SavedWordPopover.tsx`, `src/components/Reader/toolbarPlacement.ts`, tokens em `src/App.css`
  - `DOCS/features/language_study/translate.html`, `DOCS/reports/26-11-2026/uxreport_20261126173030.md`
- Output: `DOCS/reports/26-11-2026/uxreport_20261127115849.md`
- Next step: triagem do Orquestrador; depois o `codeAgent` com os três pedidos.

### Orchestrator — decisão — 20261127120235
- Summary: triagem do relatório de UX da janela de tradução. A queixa procede e a causa é estrutural: o respiro entre o texto e os botões é o `padding-bottom` da área que rola, então com um parágrafo que passa da altura máxima sobra 0 px visível entre o texto cortado e os botões.
- Inputs:
  - `DOCS/reports/26-11-2026/uxreport_20261127115849.md`
- Decision: um único `codeAgent` (Sonnet 5.5) com os três pedidos do Coordenador e esta triagem:
  - Entram agora, do relatório: A1 a A4 (barra de ações fixa com borda, linha de línguas dentro da barra, passagem a 440 px por padrão, barra de rolagem fina com calha estável); B1 e B2; C1 a C4 e C6 a C9 (cabeçalho arrasta, oito alças invisíveis, mínimo 300 × 220, máximo 640 de largura, uma geometria gravada por variante, duplo clique volta ao padrão, posição fora da janela é ajustada sem regravar, grava só ao soltar); D1, D2, D4, D5 e D7 (janela que não se mexe enquanto o texto chega, ações desde o loading com "Add to vocabulary" desativado até o fim, sem rolagem automática, erro no meio mantém o texto parcial).
  - A critério do `codeAgent`, se couberem sem risco: D3, D6 e B3.
  - C5 fica para o Coordenador conferir no teste: a janela da palavra também lembra a posição (segue o pedido como foi feito); a alternativa é ela lembrar só o tamanho e continuar abrindo junto da palavra.
  - Pedido 3: a tradução da passagem aparece enquanto chega (campo `translation` extraído do JSON parcial), só no front. A palavra continua como está (resposta curta). Nenhuma mudança no Rust, para o `tauri dev` do Coordenador não reiniciar no meio do teste.
  - O `SavedWordPopover` recebe os espaçamentos pela folha compartilhada e continua ancorado.
- Next step: `codeAgent`; depois `tsc` e `npm test` pelo Orquestrador.

### CodeAgent — janela de tradução (rodada 2 do teste) — 20261127122012
- Summary: os três pedidos do Coordenador e a triagem do relatório de UX, só no front (nada em `src-tauri/`, nada de `package.json`, sem commit, sem subir o app, sem chave e sem chamada paga; testes só com texto inventado). Resolvido dentro do `TranslatePopover` e de duas libs; nenhum dos seis usos nos leitores mudou.
  - **1. Mover, redimensionar e lembrar.** O cabeçalho (menos o X) arrasta a janela; oito alças invisíveis, filhas da raiz do popover, redimensionam (bordas de 6 px centradas na borda, cantos de 12 × 12 px). Pointer events com `setPointerCapture`, sem `preventDefault` no `pointerdown` (o `mousedown` compatível continua passando pelo `preventDefault` da raiz, que mantém a seleção do livro) e o `onMouseUp` da raiz continua parando a propagação (a captura leva o `mouseup` para o elemento capturado, que é filho da raiz). Mínimo 300 × 220; máximo `min(640, vw − 16)` × `vh − 16`; a borda que se move não passa de 8 px da janela do app. Uma geometria por variante em `monet:translate-window:passage` e `:word` (o `too_long` usa a da passagem; `savedItem` e `standalone` seguem o tipo), gravada só no `pointerup` de um gesto que moveu a janela (e só depois do limiar de arrasto, ver o ajuste abaixo). Com geometria gravada a janela abre nela, com tamanho fixo (inline `width`, `height` e `maxHeight` iguais à geometria: o teto de 460 px não vale e o PDF não a faz seguir a rolagem); sem ela, tudo como antes. Duplo clique no cabeçalho (fora do X) apaga a chave da variante e reancora na hora. Fora da janela do app (ao abrir e no `resize` com o popover aberto): tamanho limitado e posição empurrada para dentro, sem regravar (a chave guarda o que o usuário escolheu, e a janela volta ao lugar quando voltar a caber). Cancelamento do gesto (`pointercancel`) devolve a janela ao que era e não grava. C5 como pedido: a palavra também lembra a posição.
  - **2. Espaçamentos (A1 a A4, B1, B2).** Folha `TranslatePopover.module.css`: barra de ações fixa (`padding: var(--space-2) var(--space-3)`, `border-top`, `flex-shrink: 0`); a linha de línguas dentro da barra (`.actions + .footer` sem borda); a passagem a 440 px e o gap ícone↔rótulo em `--space-1`; barra de rolagem fina com `scrollbar-gutter: stable` e `padding-right: var(--space-1)` no corpo; botão com `min-height: var(--control-md)` e `padding: 0 var(--space-2)`, com `:disabled` (opacidade 0,5, sem realce no hover); 4 px a mais entre a tradução e as notas (`margin-top` do `.grammar`, 12 px no total). O `.body` ganhou `flex: 1 1 auto` para a barra ficar no fundo quando o usuário faz a janela mais alta que o texto. O `SavedWordPopover` recebe tudo isso pela folha compartilhada e continua ancorado; um teste de componente confere que ele renderiza e não ganhou cabeçalho de arrasto nem alças.
  - **3. Lentidão.** `requestTranslation` ganhou o callback opcional `onPartial`, chamado a cada pedaço que muda o texto (só `sentence`). `extractPartialTranslation` (função pura, em `translate.ts`) acha `"translation": "` no JSON incompleto, decodifica a string até onde há texto e devolve `{ text, closed }`; trata `\`, `\u` e `\uXXXX` cortados, a primeira metade de um par substituto, escape inválido (vale o caractere), chave que ainda não chegou, cerca ``` (mesmo sem a quebra de linha) e texto puro sem JSON (o parcial é o texto cru, como o `parseTranslation` faz no fim). O resultado final continua vindo do `parseTranslation` e do cache; consulta em cache não tem parcial; abortado, não avisa mais. A palavra e a expressão seguem sem streaming. No popover: D1 (sem geometria gravada, a altura é reservada na abertura por `estimatePassageHeight` e o layout effect **não** depende do texto parcial, então a janela não se reposiciona por pedaço; no fim, um único `reflowHeight`, com a borda do lado da seleção parada), D2 (o primeiro pedaço substitui o esqueleto inteiro), D3 ("Translating…" no cabeçalho e `aria-busy` no corpo), D4 (barra desde o loading nas duas variantes; "Add to vocabulary" e "Save translation" desativados até o fim, com o `title` proposto), D5 (sem rolagem automática; `scrollTop = 0` a cada pedido novo), D6 (barra no lugar das notas quando a string `translation` fechou e o resto não chegou) e D7 (erro no meio mantém o texto, acrescenta "The translation stopped before the end." e põe "Try again" primeiro) e B3 (uma barra por linha estimada, de 3 a 8).
  - **Ajuste pedido pelo Coordenador depois da entrega: limiar de arrasto.** Um clique no cabeçalho ou numa alça com 1 px de tremor do mouse preenchia `gesture.last` e o `pointerup` gravava a geometria daquele instante (a janela deixava de seguir a seleção e ficava com a altura fixa, sem arrasto nenhum). Agora o gesto só começa quando o ponteiro anda 4 px em relação ao `pointerdown`, em qualquer direção (`DRAG_THRESHOLD_PX` e `exceedsDragThreshold`, em `translateWindow.ts`, distância euclidiana, `>= 4`). Abaixo do limiar nada se move, nada é redimensionado e nada é gravado; passado o limiar, o gesto vale com o delta inteiro desde o `pointerdown` (sem pular os 4 px) e segue valendo mesmo que o ponteiro volte para perto da origem (`Gesture.active`). Vale para mover e para as oito alças. O `data-gesture` (cursor `grabbing`) continua entrando no `pointerdown` e saindo ao soltar, com ou sem arrasto. Duplo clique com tremor volta ao padrão e não deixa chave gravada (os dois cliques não gravam nada e o `dblclick` apaga a chave).
  - **Decisões minhas para o Coordenador conferir:** (a) no estado de **erro** a barra é "Try again, Listen, Add to note, Ask AI", **sem** Add to vocabulary (antes só havia Try again; o Add só vale com a tradução inteira, e desativado para sempre num erro enganaria); (b) o esqueleto da passagem usa barra de 12 px e vão de 8 px (ritmo de 20 px, com tokens da escala), e não 10 + 10 como no relatório, porque 10 px está fora da escala da casa; (c) o ajuste final de altura também **cresce** a janela quando o conteúdo passa da altura reservada (a borda do lado da seleção fica parada e a outra se move, até a borda da janela do app e 460 px); o relatório só falava de encolher; (d) **mover a janela também grava a altura do momento** (a geometria tem os quatro campos): arrastar uma janela de palavra ainda no esqueleto grava uma altura baixa, e a janela passa a abrir com ela (mínimo de 220 px) e rolar por dentro; "duplo clique" volta ao padrão; (e) a alça da direita cobre 2 px da barra de rolagem fina (o relatório aceita); (f) a estimativa de altura (64 caracteres por linha, 20 px por linha, 110 px de notas, 128 px de cabeçalho, barra e rodapé) é cálculo de CSS, não medida no app; com ela o piso de 220 px do relatório nunca é alcançado (a menor estimativa é 258) e por isso a função só tem o teto de 460.
- Testes novos: `translateWindow.test.ts` (chaves, validação, o limiar de arrasto, limite à janela do app, mover e redimensionar por direção com mínimo, máximo e margem, estimativa de altura, `reflowHeight`); `translate.test.ts` (`extractPartialTranslation` com os casos do pedido, a propriedade "o parcial é sempre prefixo do resultado final" a cada corte possível de uma resposta com escapes, e o `onPartial` de `requestTranslation` pedaço a pedaço, texto puro, palavra sem parcial, cache sem parcial, erro no meio e abortada); `TranslatePopover.test.tsx` (barra desde o loading, texto chegando, erro no meio, janela que não se reposiciona por pedaço, geometria gravada por variante, ajuste ao abrir e no `resize` sem regravar, duplo clique, mover e redimensionar com gravação única no `pointerup`, `pointercancel`, X sem arrasto, alças dentro da raiz, `mousedown` e `mouseup` com a mutação conferida; e o limiar de arrasto: clique com 2 px de tremor no cabeçalho e nas alças não muda o estilo nem grava, arrasto e redimensionamento de 5 px gravam com o delta inteiro, o gesto segue valendo ao voltar perto da origem, duplo clique com tremor volta ao padrão sem chave; a mutação "limiar sempre vence" derruba três desses testes); `SavedWordPopover.test.tsx` (renderiza, ancorado, sem alças). Nota para quem testar no happy-dom: um `vi.spyOn(Storage.prototype, …)` não intercepta depois da primeira chamada a `localStorage`; os testes novos espiam `localStorage` direto.
- Verificação (saída real): `npx tsc --noEmit` sem erros; `npm test` **59 arquivos e 1387 testes passando** (antes: 56 e 1297; 1377 antes do ajuste do limiar). Não rodei `npm run test:rust` nem nada que suba o app.
- Files changed:
  - src/components/LanguageTools/TranslatePopover.tsx
  - src/components/LanguageTools/TranslatePopover.module.css
  - src/lib/translate.ts
  - src/lib/translate.test.ts
  - DOCS/specs/languagestudy.md
  - DOCS/reports/26-11-2026/executionreport_20261126233242.md
- Files created:
  - src/lib/translateWindow.ts
  - src/lib/translateWindow.test.ts
  - src/components/LanguageTools/TranslatePopover.test.tsx
  - src/components/LanguageTools/SavedWordPopover.test.tsx
- Files removed:
  - nenhum
- Left behind:
  - **Não verificável sem o app real** (entra no item 9 do roteiro): a captura do ponteiro sobre o iframe do EPUB e sobre a camada de texto do PDF (os testes de componente simulam o `setPointerCapture`), o cursor de cada alça, o tempo até o primeiro texto e o ritmo dos pedaços de verdade, os quatro botões numa linha a 440 px com a fonte de produção, a largura da barra de rolagem fina e os 12 px de margem da direita, o quanto a estimativa de altura acerta, o `title` do botão desativado na WebView2 e o duplo clique no cabeçalho.
  - **Não toquei no Rust, como pedido.** O comando `openrouter_stream_chat` manda só `model`, `stream` e `messages` e não desliga o raciocínio de modelos que raciocinam por padrão: se o "Translation model" do Settings for um deles, isso soma segundos antes do primeiro texto, e o streaming não resolve essa parte. Fica anotado na spec.
  - O prop `onAddToVocabulary(translation: Translation | null)` e o comentário do `null` ("a tradução ainda não chegou") ficaram como estavam: o botão agora só funciona com a tradução pronta, então o `null` não chega mais a quem chama (já não chegava antes, porque o estado de carregamento não tinha botões). Tirar o `null` do tipo mexeria nos seis usos dos leitores, fora do que foi pedido.
  - O texto da tradução continua sem poder ser selecionado e copiado dentro do popover (achado 10 do review dos leitores, fora desta rodada).

### Orchestrator — encerramento — 20261127122750
- Summary: rodada 2 de ajustes do teste concluída na janela de tradução, sem commit. Os três pedidos do Coordenador entraram: (1) a janela é movida pelo cabeçalho e redimensionada por borda ou canto, e a posição e o tamanho são gravados por variante (passagem e palavra) ao soltar, com duplo clique no cabeçalho para voltar ao padrão; (2) os botões viraram barra fixa com borda e 8 px de respiro, com a linha de línguas dentro dela, a passagem abre com 440 px e a barra de rolagem é fina; (3) a tradução da passagem aparece enquanto chega. Conferido pelo Orquestrador: `npx tsc --noEmit` sem erros, `npm test` com 59 arquivos e 1387 testes passando, nenhuma mudança em `src-tauri/` nem em `package.json`.
- Inputs:
  - `DOCS/reports/26-11-2026/uxreport_20261127115849.md`
  - sessão `CodeAgent — janela de tradução (rodada 2 do teste) — 20261127122012`
- Decision:
  - Na leitura do código o Orquestrador achou um ponto frágil e devolveu ao mesmo `codeAgent` para um ajuste: qualquer movimento de 1 px no cabeçalho ou numa alça já gravava a geometria e prendia a janela. Entrou um limiar de 4 px antes de o gesto valer.
  - Aceitas as decisões do `codeAgent` listadas na sessão dele: no erro a barra fica "Try again, Listen, Add to note, Ask AI"; o ajuste de altura no fim da tradução também cresce a janela; mover grava também a altura do momento (a partir daí a janela tem tamanho fixo e rola por dentro, até o duplo clique no cabeçalho).
  - Para o Coordenador conferir no teste: a C5 (a janela da palavra lembra a posição, em vez de continuar abrindo junto da palavra) e os quatro botões numa linha a 440 px com a fonte real.
  - Fica anotado, sem mudança: o comando de chat não desliga o raciocínio de modelos que raciocinam por padrão; com um "Translation model" assim, o texto demora a começar mesmo com o streaming. Corrigir pede mudança no Rust.
- Next step: aguardando o teste do Coordenador (seção 9 do roteiro, 23 passos). Nada desta rodada foi executado no app pelos agentes: a captura do ponteiro sobre o livro, o tempo até o primeiro texto e as medidas de layout só se confirmam no teste. Sem commit até ele decidir.

### Orchestrator — decisão — 20261127141825
- Summary: o Coordenador viu a rodada 2 no app ("ficou bem interessante", "boas funcionalidades para estudar línguas") e pediu duas coisas: ver o que ficou de fora e descrever o que o interruptor "Language teacher" faz na prática. Levantamento feito por leitura dos três reviews, das sessões deste arquivo e do código; nenhum código mudou nesta sessão.
- Inputs:
  - `DOCS/reports/26-11-2026/reviewreport_20261127100629_voice.md`, `reviewreport_20261127100918_reader.md`, `reviewreport_20261127101149_vocab.md`
  - `src/lib/teacherContext.ts`, `src/hooks/useReaderTeacher.ts`, `src/components/Reader/ReaderChatPanel.tsx`
  - `src/components/Reader/Reader.tsx` (`handleTranslate`, `handleListen`, `handleAddToVocabulary`), `src-tauri/src/lib.rs` (`run_openrouter_stream`)
- Decision: nada entra sem a escolha do Coordenador, porque cada item que sobrou tem uma decisão dele embutida. A lista, com a recomendação do Orquestrador:
  - **Copiar a tradução (leitores 10).** Deixar o texto selecionável dentro da janela desfaz a seleção do livro, e no PDF três ações leem a seleção viva (`handleTranslate`, `handleListen`, `handleAddToVocabulary`, este último também pela tecla V): com a seleção dentro da janela, o item de vocabulário sairia com a frase e a âncora erradas. Recomendado: um botão "Copy" que copia a tradução inteira, sem mexer na seleção. A escolha é entre o botão e o texto selecionável (com a guarda nas três ações).
  - **Raciocínio dos modelos na tradução (Rust).** Só muda algo se o "Translation model" for um modelo que raciocina por padrão; com o padrão (`openai/gpt-4.1-mini`) não muda nada. Desligar o raciocínio num modelo em que ele é obrigatório pode fazer o provedor recusar o pedido, e isso não se confere sem chamada paga. Recomendado: não fazer, a menos que ele use um modelo assim.
  - **Janela da palavra (C5):** lembra a posição (como está) ou continua abrindo junto da palavra e lembra só o tamanho.
  - **"Ask for feedback" e o professor (vocabulário N1):** hoje o botão liga o interruptor e ele fica ligado naquele livro; a alternativa é mandar o bloco do professor só naquela mensagem.
  - **Retell com tudo já enviado:** hoje o botão fica desabilitado até marcar itens.
  - **Dependem de um livro real, e ele agora tem um:** voz N4 (o "Listen to page" pular ou ler cabeçalho, rodapé e número de página por engano) e voz N3 (áudio cancelado no meio é jogado fora e pedido de novo depois).
  - **Pequenos, sem decisão, para um ajuste só se ele quiser:** vocabulário N4 (no EPUB, "saved on this page" olha só o começo da tela), N5 (texto em NFD não recebe marca), N11 (sobras no `localStorage` ao apagar o livro), N12 (organização de tipos); leitores 11 (a primeira abertura de um EPUB sem metadado de língua atrasa a primeira página); voz N2 (o front não tenta o catálogo de novo); a voz padrão do Kokoro; a palavra repetida na mesma frase no EPUB; o `| null` do `onAddToVocabulary`.
- Next step: aguardando o Coordenador escolher o que entra. O que entrar vai num único `codeAgent`, com sessão nova aqui e passos novos no roteiro. Sem commit até ele decidir.

### Orchestrator — decisão — 20261127142936
- Summary: depois de ler a descrição do "Language teacher" (com o exemplo em francês), o Coordenador perguntou se o texto está específico para francês e pediu para deixar mais genérico, porque pode estudar outra língua no futuro. Conferido por leitura do código: o bloco do professor, o chip "AI sees", o prompt da tradução, a nota de perfil e os rótulos da interface já são montados com a língua de cada livro e a língua do usuário (`languageName`), nas 16 línguas de `LANGUAGE_CODES`; o francês do exemplo veio do livro dele. Ajuste de teste, sem novo Task Report.
- Inputs:
  - `src/lib/teacherContext.ts`, `src/lib/translate.ts`, `src/lib/language.ts`, `src/lib/languageProfile.ts`
  - `src/lib/voiceTest.ts`, `src/lib/sentences.ts`, `src/lib/pdfText.ts`, `src/lib/languageDetect.ts`
  - `src/components/Settings/LanguageSettings.tsx`
- Decision: o que está preso ao francês (ou só tem regra para francês e inglês) fica por baixo, em quatro pontos. Três entram agora, num único `codeAgent` (Sonnet 5.5), só no front:
  - **Padrão francês sem livro de outra língua** (`voiceTest.ts`): o "Test voice" fala em francês e a nota de perfil nasce com a linha "French: B1". Passa a ser: o teste de voz na língua do usuário (inglês só como último recurso de frase), e a nota de perfil sem linha de nível quando não há livro de outra língua, com o formato explicado no texto do Settings.
  - **Abreviações na divisão em frases** (`sentences.ts`): só francês e inglês têm lista; nas outras línguas a frase quebra em "Sr.", "Dr." e parecidas (afeta o Listen, a frase de contexto do Translate e a frase do item de vocabulário). Entram listas para as 16 línguas oferecidas.
  - **Hífen de fim de linha no PDF** (`pdfText.ts`): só francês e inglês têm lista do hífen que é de verdade. Entram só os casos sem ambiguidade, o hífen suspenso antes de conjunção nas línguas germânicas ("Ein- und Ausgang"). Os pronomes com hífen das línguas românicas ("disse-me") ficam de fora: confundem-se com a quebra de sílaba comum ("par-te") e a regra faria mais estrago do que conserto; fica como limite conhecido na spec.
  - **Fica como está:** a detecção automática da língua de um PDF cobre 7 línguas (fr, en, pt, es, it, de, nl); nas outras 9 o Coordenador escolhe a língua no "Change". Acrescentar línguas mexe nas margens entre línguas parecidas, que estão testadas e em uso.
- Next step: `codeAgent`; depois `tsc` e `npm test` pelo Orquestrador.

### CodeAgent — regras por língua — 20261127144054
- Summary: os três pontos da sessão `Orchestrator — decisão — 20261127142936`, só em funções puras de `src/lib/` e num texto do Settings (nada em `src-tauri/`, nada de `package.json`, nada nos leitores nem no `TranslatePopover`, nada em `languageDetect.ts`; sem commit, sem subir o app, sem chave e sem chamada paga; testes e documentos só com texto inventado).
  - **1. Sem padrão francês.** `pickStudyLanguage(books, nativeLanguage)` (nova, em `voiceTest.ts`) devolve a língua do livro aberto por último que não é a nativa, ou `null`. `pickTestLanguage` passou a ser "essa língua, senão a nativa (código base), senão `'en'`" e o `FALLBACK_LANGUAGE` agora é `'en'`; `testSentenceFor` usa a frase em inglês para língua sem frase própria. No `LanguageSettings`, o "Test voice" e a voz do seletor seguem `pickTestLanguage`, e `handleOpenProfile` passa `pickStudyLanguage` como `bookLanguage`, que virou `string | null` em `LanguageSettings`, `SettingsModal` e `App.tsx` (`handleOpenLanguageProfile`). `buildLanguageProfileTemplate(native, studyLanguage: string | null)` omite a linha do nível sem língua (com livro continua `French: B1`, por exemplo). O parágrafo de ajuda de Settings › Language › Language profile ganhou no fim: "Write one line per language you study: the language's name in English, a colon and your level (A1 to C2)."
  - **2. Abreviações nas 16 línguas.** `ABBREVIATIONS` em `sentences.ts` ganhou lista para pt, es, it, de, nl, ca, ro, pl, sv, da, no, fi, cs e tr; as de fr e en e o código que as usa não mudaram. Antes de escrever as listas rodei o `Intl.Segmenter` de verdade (Node 24) sobre mais de uma centena de frases inventadas: ele corta depois da abreviação só quando a palavra seguinte começa com maiúscula (nome, numeral romano, substantivo alemão); antes de minúscula ele não corta, e antes de dígito o `shouldMerge` já junta. Por isso as listas são de tratamentos e títulos antes de nome, abreviações de livro e de exemplo antes de numeral romano ou de nome, e o equivalente do "etc". "z. B." sai do Segmenter como `z. ` + `B. ` + `Äpfel…`, e a lista só precisa de `z` (o `B` já é a inicial maiúscula); "d. h.", "u. a." pedem `d`/`h` e `u`/`a`; "z.B." sem espaço é o token `z.B`; com espaço inseparável (U+00A0) ou fino (U+202F) o corte e o resultado são os mesmos (conferido no teste). "p. ej." (es) é cortado só depois de "ej.", então a lista leva `ej`. `hasOpenFrenchQuote` virou `hasOpenGuillemet` (mesmo corpo).
  - **3. Hífen suspenso.** `HYPHEN_SUSPENDED` (de: und, oder, bzw; nl: en, of; sv: och, eller; da e no: og, eller) e `joinAtHyphen(head, next, language)` no lugar de `keepsHyphen`: conjunção suspensa dá `Ein- und` (hífen e espaço), parte de composto da lista de fr/en dá `peut-être` (colado, como antes) e o resto é quebra de sílaba (o hífen sai, como antes). Vale para a linha seguinte (`cleanPdfPage`) e para a seleção (`cleanPdfSelectionText`, cuja expressão passou a capturar a letra e o hífen juntos). O "Ein- und" no meio da linha, que na seleção era indistinguível da quebra, também deixa de virar "Einund". Os pronomes com hífen das línguas românicas ficaram de fora, como decidido; entram na spec como limite conhecido.
- Testes novos e ajustados (73 a mais; mesmos 59 arquivos): `voiceTest.test.ts` (`pickStudyLanguage` com `null`; `pickTestLanguage` com livro, sem livro, com a nativa `pt-BR`, sem nativa e "nunca francês"; frase em inglês para língua desconhecida e vazia), `languageProfile.test.ts` (sem língua de estudo e com língua vazia dão o mesmo texto, sem linha de nível e sem "French"; língua alemã e japonesa no nome da linha; o que o template escreve lê de volta), `sentences.test.ts` (31 casos, dois por língua nas 14 línguas novas, cinco no alemão, cada um com a prova de que sem a lista o texto é cortado; uma checagem de que toda língua de `LANGUAGE_CODES` além de fr e en tem caso; "z. B." com U+00A0 e U+202F; o equivalente do "etc"; o ponto que fecha continua cortando; região no código; a lista de uma língua não vale em outra; 10 casos com a saída da versão anterior para fr e en, incluindo títulos e conjunções das outras línguas; aspas « » em es e pt), `pdfText.test.ts` (11 casos de hífen suspenso por língua e conjunção, nos dois caminhos, página e seleção; região; palavra que só começa com a conjunção; quebra de sílaba nas cinco línguas; pt e es sem a regra; saídas da versão anterior em fr e en na página e na seleção, calculadas com o código antigo antes da mudança).
- Verificação (saída real): `npx tsc --noEmit` sem erros (exit 0); `npm test` **59 arquivos e 1460 testes passando** (antes: 59 e 1387). Não rodei `npm run test:rust` nem nada que suba o app; o Test voice, a nota de perfil e o texto do Settings não foram vistos na tela.
- Decisões minhas para o Coordenador conferir:
  - **Nativa sem frase própria.** Se a língua nativa não é uma das 16 (o app aceita a do sistema, por exemplo `ja`) e não há livro de outra língua, o Test voice usa a voz dessa língua com a frase em inglês. Segui a regra pedida; a alternativa seria cair para `'en'` também na voz.
  - **Listas das 14 línguas novas** (são palpites de revisão, uma por língua; a spec e os testes só fixam os casos acima): letras soltas em minúscula só no alemão (`z d h u a i v n`, para "z. B.", "d. h.", "u. a.", "i. A.", "v. Chr."); formas em minúscula dos tratamentos onde a ortografia as pede no meio da frase (it, nl, ro, pl, sv, da, no, fi, cs); o equivalente do "etc" entrou em todas (de `usw`, nl `enz`, sv e da e no `osv`, fi `jne`, cs `atd`, tr `vb` e `vs`, pl `itd`, it `ecc`, as demais `etc`), então, como em fr e en, "…, usw. Dann ging er." fica numa frase só.
  - **Fora das listas, de propósito:** "n.º" (o token acaba em "º", nunca em ".", e o Segmenter não corta ali; a entrada seria letra morta), "dl" no holandês (também é decilitro: "2 dl. Daarna" juntaria duas frases), "Chr.", "ca.", "Mio." e as que costumam fechar a frase.
  - **A conjunção conta como palavra inteira, mas a quebra de sílaba que cai exatamente numa delas se confunde** (uma linha que termina em hífen e a seguinte que começa com "en", "of", "og" ou "und" sozinhos): é o limite aceito na decisão; a palavra maior que só começa com a conjunção ("ver-" + "enigd") continua sem hífen e tem teste.
  - **Aspas » … « e » … »** (alemão e línguas nórdicas) continuam sem tratamento no `hasOpenGuillemet`, que só conta « e » na ordem francesa; não mudei o que a função faz, e isso entrou na spec.
- Files changed:
  - src/lib/voiceTest.ts
  - src/lib/voiceTest.test.ts
  - src/lib/languageProfile.ts
  - src/lib/languageProfile.test.ts
  - src/lib/sentences.ts
  - src/lib/sentences.test.ts
  - src/lib/pdfText.ts
  - src/lib/pdfText.test.ts
  - src/components/Settings/LanguageSettings.tsx
  - src/components/Settings/SettingsModal.tsx
  - src/App.tsx
  - DOCS/specs/languagestudy.md
  - DOCS/reports/26-11-2026/executionreport_20261126233242.md
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **Não verificável sem o app real** (entra no passo 10 do roteiro): o texto novo do Settings, o Test voice sem livro de outra língua e a nota de perfil sem a linha do nível. As abreviações foram conferidas só com o `Intl.Segmenter` do Node; o WebView2 deveria usar as mesmas regras do Unicode, mas essa equivalência não foi medida.
  - **Pronomes com hífen das línguas românicas** ("disse-me", "dă-mi") no PDF: sem lista, o hífen se perde na quebra de linha. Decisão tomada, anotada na spec.
  - **Detecção automática da língua de um PDF** continua com 7 línguas (fr, en, pt, es, it, de, nl); nas outras 9 o Coordenador escolhe a língua no "Change". Fora do escopo, como decidido.
  - **`LanguageSettings` não tem teste de componente** (nunca teve): as duas chamadas novas (`pickStudyLanguage` e o texto da ajuda) ficam cobertas por `tsc` e pelos testes das funções puras.

### Orchestrator — encerramento — 20261127144508
- Summary: ajuste "regras por língua" concluído, sem commit. O que o Coordenador vê (bloco do professor, janela de tradução, nota de perfil, rótulos) já era montado com a língua de cada livro; o ajuste tirou o padrão francês e levou as regras de texto às outras línguas. Conferido pelo Orquestrador: `npx tsc --noEmit` sem erros, `npm test` com 59 arquivos e 1460 testes passando (eram 1387), nenhuma mudança em `src-tauri/` nem em `package.json`, e o diff das quatro libs lido (as listas de `fr` e `en` e o resultado delas não mudaram).
- Inputs:
  - sessão `CodeAgent — regras por língua — 20261127144054`
- Decision: aceitas as decisões do `codeAgent`: o equivalente de "etc" entra em todas as línguas (como já era em `fr` e `en`, uma frase que termina nele fica junto da seguinte); letras soltas em minúscula só no alemão ("z. B.", "d. h.", "u. a.", "v. Chr.") e no polonês ("t."); com língua nativa fora das 16 e sem livro de outra língua, o "Test voice" usa a voz da língua nativa com a frase em inglês. Limites que ficam, registrados na spec: uma quebra de sílaba que deixa "en", "of", "og" ou "und" sozinhos no começo da linha sai como hífen suspenso (raro; no holandês atinge plurais como os de trema); os pronomes com hífen das línguas românicas no PDF; as aspas » … « do alemão; a detecção automática de PDF em 7 línguas.
- Next step: aguardando o teste do Coordenador (seção 10 do roteiro, 5 passos; para ele, com um livro em francês aberto por último, nada muda no "Test voice" nem na nota de perfil). As abreviações foram conferidas com o `Intl.Segmenter` do Node, não no WebView2. Seguem abertas as escolhas da sessão `20261127141825`. Sem commit até ele decidir.

## Roteiro de teste do Coordenador

Roteiro de T3, na estrutura do Apêndice E.2 do plano, ajustado ao que foi entregue. Cada passo traz o resultado esperado numa linha e um espaço "Resultado:" para você preencher. "Ponto N" é o número do ponto da seção 9 do UX report (`DOCS/reports/26-11-2026/uxreport_20261126173030.md`); os 16 pontos aparecem pelo menos uma vez, cada um no passo que o testa. Tudo no app de desenvolvimento (`npm run tauri:dev`), nunca no de produção.

**Antes de começar.** Nenhuma chamada paga de voz ou de tradução foi feita durante o desenvolvimento: o primeiro áudio e a primeira tradução reais são os seus. Se algo falhar, anote a **mensagem exata** do erro (a frase do player e o detalhe depois da linha em branco). O modo das marcas na página é a CSS Custom Highlight API (decidido na prova F0.1, que passou no PDF e no EPUB; não há camada de reserva).

### 0. Preparação

- **0.1** Fechar o app de produção (os dois disputam os atalhos globais) e rodar `npm run tauri:dev`.
  - Esperado: o app dev abre, com o banco `com.monet.app.dev`.
  - Resultado:
- **0.2** Settings › OpenRouter Integration: colar a chave no app dev.
  - Esperado: a chave fica salva e o aviso de chave some do chat do leitor.
  - Resultado:
- **0.3** Separar o material: um PDF e um EPUB em francês seus, um PDF em inglês e um livro em português. Importar os quatro no Library.
  - Esperado: cada import mostra a faixa "Imported … Language detected: …" (ver 2.1).
  - Resultado:

### 1. F0.3, primeiro, de ouvido (a voz e o texto do PDF real)

- **1.1** Settings › Language › Reading aloud: com o Gemini 3.8 Flash TTS (o padrão), clicar "Test voice". **É o primeiro áudio real.**
  - Esperado: toca uma frase em francês em poucos segundos, com voz francesa (ponto 16). Anote o tempo até o som. Se falhar, anote a mensagem exata e o `kind` (`no_key`, `auth`, `no_credit`, `model`, `server`, `network`, `duration`…).
  - Resultado:
  - O que o módulo **supõe** sobre a resposta de `POST /audio/speech`, sem nenhuma conferência contra uma resposta real (se algo estranho acontecer, é por aqui): (1) a resposta 2xx é o áudio cru, com `Content-Type` de áudio (JSON ou texto num 2xx é tratado como erro do servidor); (2) PCM é 16 bits little-endian mono, a 24 kHz quando o `Content-Type` não traz `rate=`, com uma única exceção escrita no código, o HeyGen a 44,1 kHz (pela documentação; a checagem de duração **não** pega a taxa errada, e a revisão mostrou a conta), e um modelo sem formato conhecido no catálogo é pedido em `mp3`; (3) um WAV em fluxo pode vir com tamanhos provisórios no cabeçalho (tratado); (4) o corpo `{ model, input, response_format, voice }` é aceito por todos os modelos do catálogo, e voz ausente vira a voz padrão do modelo; (5) o erro vem como `{ error: { code, message } }`; (6) o catálogo público tem a estrutura conferida em 2026-11-26.
- **1.2** Trocar para dois outros modelos do seletor (um que entregue mp3, como o ElevenLabs, e um que só entregue pcm ou wav), testar a voz de cada e voltar ao Gemini.
  - Esperado: a lista veio do catálogo, com o preço de cada modelo ("~$0.10/page" nos de preço por caractere); a voz escolhida fica lembrada por modelo e por língua do livro; as vozes são as do modelo, com as da língua do livro primeiro; o som é bom nos três (ponto 16).
  - Resultado:
- **1.3** No PDF francês real, "Listen to page" em três a cinco páginas, de livros diferentes se puder.
  - Esperado: cabeçalho e número de página não são lidos (aviso de 5 s "Not read: …"); o hífen de fim de linha é desfeito ("entrebâil-" + "lée" lê "entrebâillée"); anote o que acontece com nota de rodapé, duas colunas e número de verso (pontos 2 e 4).
  - Resultado:
- **1.4** Ouvir a última frase de uma página que continua na seguinte, e depois a primeira da página seguinte.
  - Esperado: a frase sai em duas metades (fim da página, começo da seguinte). Diga se isso incomoda (ponto 3).
  - Resultado:
- **1.5** Cronometrar o tempo até o primeiro som: uma seleção de uma frase e uma página inteira. Ouvir as emendas entre frases.
  - Esperado: o primeiro som vem em poucos segundos (a frase 0 é pedida sozinha); a voz e o ritmo se mantêm de uma frase para a outra (ponto 5).
  - Resultado:
- **1.6** Escolher a velocidade 0,75× (botão do mini-player) numa frase.
  - Esperado: fala mais lenta com o **tom preservado**, sem voz grave (ponto 6; no Edge o pico de 440 Hz foi medido em 439,45 Hz a 0,75×).
  - Resultado:
- **1.7** Ouvir trechos com abreviações ("M.", "Mme"), números ("3,5 %", "21 h 30") e diálogo com travessão e aspas francesas.
  - Esperado: a frase não é cortada na abreviação nem no número, e o diálogo com travessão vira frases separadas (ponto 4).
  - Resultado:

### 2. Entrega 1A (língua, barra e Translate)

- **2.1** Importar um EPUB em francês.
  - Esperado: faixa no topo da lista com "Imported <título>. Language detected: French." e o botão "Change"; fecha no `X`, em outro import ou em 12 s.
  - Resultado:
- **2.2** Importar um PDF cuja língua o app não reconhece (um PDF só de imagem serve) e clicar "Choose".
  - Esperado: faixa "Language not detected."; "Choose" abre a edição da linha com o foco no seletor de língua.
  - Resultado:
- **2.3** Na lista, conferir a coluna Language e editar a língua de um livro pelo botão Edit da linha (junto de título e autor).
  - Esperado: etiqueta "FR", "EN", "—"; salvar troca a etiqueta e liga ou desliga as ferramentas ao abrir o livro.
  - Resultado:
- **2.4** Abrir pela primeira vez um livro importado antes desta feature (sem língua).
  - Esperado: a língua é detectada na abertura, a etiqueta aparece e o EPUB abre normalmente (a amostra de texto descarrega as seções antes do `renderTo`).
  - Resultado:
- **2.5** Abrir o livro em português.
  - Esperado: o leitor é **idêntico ao de antes**: barra de seleção em uma linha (cores, Copy, Add to note, Ask AI), sem "Listen to page", sem aba Vocabulary, coluna de 280 px com as abas de sempre, e `T`, `L` e `V` não fazem nada; `Espaço` continua rolando o PDF.
  - Resultado:
- **2.6** Settings › Language › Show language tools: "In every book" (livro em português ganha as ferramentas), "Never" (livro em francês as perde) e de volta a "In books in another language".
  - Esperado: as ferramentas aparecem e somem na hora, com o leitor aberto, sem recarregar.
  - Resultado:
- **2.7** Selecionar texto no PDF francês.
  - Esperado: barra em duas linhas (Translate, Listen, Add to vocabulary acima; cores, Copy, Add to note, Ask AI abaixo) com a mesma largura de antes, sem cobrir a seleção.
  - Resultado:
- **2.8** Traduzir uma palavra, uma expressão de três palavras e um parágrafo (botão e tecla `T`).
  - Esperado: palavra e expressão mostram o sentido nesta frase na sua língua, "forma base · classe · gênero", a frase com o termo em negrito e a posição; o parágrafo mostra a tradução e até duas notas de gramática.
  - Resultado:
- **2.9** Selecionar mais de 1.500 caracteres e traduzir.
  - Esperado: o popover diz quantos caracteres a seleção tem e o limite, sem chamar a IA, e oferece Listen e Ask AI.
  - Resultado:
- **2.10** Traduzir sem rede, e depois sem chave (apague a chave no dev e volte a colocar).
  - Esperado: "Couldn't translate." com "Try again"; "Add your OpenRouter key in Settings." com "Open Settings", que abre a seção do OpenRouter.
  - Resultado:
- **2.11** No rodapé do popover, "Change" para trocar a língua do livro e a de destino.
  - Esperado: a tradução é refeita na nova língua; trocar o livro para a sua língua nativa fecha o popover e a barra volta a ter uma linha.
  - Resultado:
- **2.12** No PDF, com o popover aberto: clicar dentro dele, rolar a página, apertar `Esc` duas vezes, clicar fora (ponto 7).
  - Esperado: clicar no popover não perde a seleção; ele acompanha a rolagem; o primeiro `Esc` fecha o popover e devolve a barra, o segundo limpa a seleção; clicar fora fecha tudo.
  - Resultado:
- **2.13** No EPUB: abrir o popover e virar a página; abrir o popover logo depois de selecionar (ponto 7).
  - Esperado: virar a página fecha seleção e popover; o evento de seleção que chega 250 ms depois não fecha o popover aberto.
  - Resultado:
- **2.14** Com o foco no campo do chat e no editor da aba Notes, apertar `T`, `V`, `L`, `R` e `Espaço` (ponto 9).
  - Esperado: nada age (as letras são digitadas e o `Espaço` é espaço).
  - Resultado:
- **2.15** Abrir uma página escaneada de um PDF francês (sem camada de texto).
  - Esperado: a faixa de aviso cita "translation, audio"; "Listen to page" fica desligado e não há seleção.
  - Resultado:

### 3. Entrega 1B (voz e player)

- **3.1** Selecionar uma frase e clicar Listen, no PDF e depois no EPUB.
  - Esperado: o mini-player aparece embaixo, centralizado entre os botões de página, e o trecho inteiro fica em **faixa cinza** na página, mesmo depois de a seleção sumir (ponto 1, a parte da faixa). Anote se a faixa fica certa no EPUB depois de virar a página e voltar.
  - Resultado:
- **3.2** "Listen to page" no EPUB, com a página aberta no meio de um capítulo (ponto 8).
  - Esperado: lê o trecho visível (as duas colunas, no spread); anote se começa e termina no lugar certo e o que acontece quando o intervalo da tela não resolve (a reserva de cerca de 1.600 caracteres).
  - Resultado:
- **3.3** Usar os controles: voltar e avançar frase, Repeat, a velocidade, o menu ⋯ com a troca de modelo e de voz com o áudio tocando.
  - Esperado: cada controle age; a troca de modelo vale a partir da próxima frase gerada; o que já foi gerado continua tocando.
  - Resultado:
- **3.4** Trocar de página com o áudio tocando, e depois clicar "Back to p. N".
  - Esperado: o áudio pausa e o player diz "Paused: this audio is from p. N." com "Back to p. N"; voltar à página tira o aviso, mas não retoma sozinho; o botão leva à página de origem.
  - Resultado:
- **3.5** Abrir o Translate com o áudio tocando e depois apertar `Espaço`.
  - Esperado: o áudio pausa durante a consulta; `Espaço` retoma do começo da frase (ponto 9, com o player aberto).
  - Resultado:
- **3.6** Dois Listen seguidos, e um Listen do popover do Translate com o player tocando.
  - Esperado: o segundo Listen substitui o primeiro; o Listen do popover fala só o termo e **pausa o player** (os dois nunca soam juntos); `Espaço` retoma o player do começo da frase (ver também 8.3).
  - Resultado:
- **3.7** Mincer gravando: iniciar uma gravação, pedir um áudio; depois iniciar a gravação com um áudio já tocando.
  - Esperado: "Listen to page" ganha um ponto vermelho; o pedido é bloqueado com "Mincer is recording…" e "Play anyway" e "Cancel"; começar a gravar com áudio tocando pausa e bloqueia.
  - Resultado:
- **3.8** Selecionar um trecho com mais de 5.000 caracteres e clicar Listen.
  - Esperado: confirmação "Long passage: about N min of audio, around ~$x…" com "Listen" e "Cancel", sem gerar nada antes.
  - Resultado:
- **3.9** Arrastar o chat para deixar a coluna da página abaixo de 576 px, e depois bem mais estreita.
  - Esperado: abaixo de 576 px o player esconde a origem e o progresso. A versão mais estreita (abaixo de 440 px) não foi desenhada: anote como ficou.
  - Resultado:
- **3.10** Com o player aberto, fazer uma ação que mostra aviso (por exemplo "Add to note") (ponto 11).
  - Esperado: o aviso sobe e fica acima do player, sem esconder nem ser escondido por ele.
  - Resultado:
- **3.11** No PDF, "Fit page" ligado, abrir e fechar o player (ponto 12).
  - Esperado: o zoom **não muda**; com o player aberto dá para rolar a página até a última linha ficar acima do player.
  - Resultado:
- **3.12** **No EPUB**, com o player aberto, olhar as últimas linhas da página.
  - Esperado: o mini-player **cobre as últimas linhas da página** (a área não rola: o texto é paginado no iframe e não há margem). Fechar o player ou virar a página resolve. Diga se incomoda.
  - Resultado:
- **3.13** Com o player fechado, `Espaço` e `Shift+←/→`; com o player aberto, `Espaço`, `R`, `Shift+←/→` e `L` (ponto 9).
  - Esperado: fechado, o `Espaço` rola o PDF e `Shift+seta` vira a página; aberto, `Espaço` toca e pausa, `R` repete, `Shift+←/→` mudam de frase sem virar a página; `L` com seleção lê a seleção e sem seleção lê a página. No EPUB as mesmas teclas valem com o foco dentro do iframe.
  - Resultado:
- **3.14** Fechar o livro com áudio tocando, e depois trocar de modo com `Ctrl+2`.
  - Esperado: o áudio para na hora, sem som residual ao voltar ao Library.
  - Resultado:
- **3.15** Repetir uma frase já ouvida e olhar Settings › Language › "Cost of audio with this voice".
  - Esperado: a repetição é instantânea e não aumenta o uso do mês; a caixa mostra página, hora, o mês e o áudio guardado com "~" (estimativa).
  - Resultado:
- **3.16** "Clear saved audio" com um áudio tocando.
  - Esperado: o que está tocando continua; as próximas frases são geradas de novo; o tamanho guardado volta a zero.
  - Resultado:
- **3.17** Renomear o sidecar `ffmpeg` de `src-tauri/target/debug` por um momento (sem `git clean`) e ouvir uma frase; depois devolver o nome.
  - Esperado: o áudio toca, o aviso "Audio can't be saved on this device…" sai **uma vez** e a frase não vai ao cache.
  - Resultado:
- **3.18** Menu ⋯ › "This book so far" depois de ouvir algumas páginas.
  - Esperado: o custo do livro é o já gerado (soma por modelo), sempre com "~" e "(estimate)".
  - Resultado:

### 4. Entrega 2 (vocabulário)

- **4.1** Selecionar uma palavra e apertar `V`; depois clicar "Add to vocabulary" na barra e no popover do Translate (ponto 10).
  - Esperado: "Added to vocabulary" nas três formas; pela barra o item entra sem tradução e **sem chamada à IA**; pelo popover entra com o sentido. `V` não colide com nenhum outro atalho.
  - Resultado:
- **4.2** Guardar o mesmo texto na mesma frase de novo, e a mesma palavra em outra frase.
  - Esperado: o primeiro dá "Already in your vocabulary" e não duplica; o segundo é um item novo.
  - Resultado:
- **4.3** Abrir a aba Vocabulary, com as três abas e com o contador de grifos em três dígitos se tiver como (ponto 13).
  - Esperado: Contents, Highlights e Vocabulary cabem na coluna de 300 px com a fonte real, sem corte; sem contador na aba Vocabulary.
  - Resultado:
- **4.4** Num item sem tradução, clicar "Translate" e depois "Save translation".
  - Esperado: o popover abre ao lado do botão; "Save translation" grava o sentido e a forma base no próprio item.
  - Resultado:
- **4.5** Marcar alguns itens e clicar o botão de envio pela primeira vez.
  - Esperado: abre "Send vocabulary to a note" com as três opções (nota nova, a nota do livro, "Choose notebook and note…"), a chave da tradução e a prévia; o botão diz "Send 2 selected" (ou "Send N new to notebook").
  - Resultado:
- **4.6** Enviar de novo (envio direto), clicar "Open" no aviso e depois "Undo" em outro envio.
  - Esperado: o envio direto não abre o modal e mostra Open e Undo; o Undo tira o bloco da nota e devolve a marca dos itens.
  - Resultado:
- **4.7** **Depois de clicar em "Open" (ou no chip "Sent to notebook"), a nota de vocabulário aparece na aba Notes SEM virar a nota vinculada ao livro** (mudança da passada final; o passo 8.1 confere o desenho todo). Conferir para onde vai o próximo "Add to note" de uma citação e, na entrega 3, o Retell.
  - Esperado: a aba Notes mostra a nota de vocabulário com a linha "Not linked to this book" e "Back to the book's note"; as próximas citações e o Retell continuam indo para a nota do livro (o "Open" do chat, esse sim, vincula). Diga se o desenho serve.
  - Resultado:
- **4.8** Editar a nota enviada e clicar "Undo" no aviso do envio.
  - Esperado: "Couldn't undo: the note was edited." e a marca de enviado dos itens fica.
  - Resultado:
- **4.9** Reenviar um item já enviado (marcar a caixa).
  - Esperado: o botão diz "Send 1 selected again"; o bloco é acrescentado de novo na nota e a data de envio muda.
  - Resultado:
- **4.10** Apagar a nota de destino e enviar de novo.
  - Esperado: o envio pede o destino de novo, pelo modal.
  - Resultado:
- **4.11** Abrir a nota enviada no editor (ponto 14).
  - Esperado: o cabeçalho `From <livro> · <data>` aparece como título de nível 3; cada item mostra a palavra em negrito, a frase como citação e a linha "— <livro>, p. 42"; a tradução vem num bloco "Translation" **recolhido**, que abre com um clique; ao editar a nota o bloco não muda.
  - Resultado:
- **4.12** "Listen to list" com itens marcados e sem nenhum marcado.
  - Esperado: toca a frase de origem de cada item no mesmo player, com o texto da frase; sem faixa cinza na página e sem pausa por trocar de página.
  - Resultado:
- **4.13** Clicar num item cujo lugar o app não acha (um PDF trocado por outra edição serve).
  - Esperado: "This item's place in the book wasn't found." e o leitor não se move.
  - Resultado:
- **4.14** Apagar um livro que tem vocabulário e áudio guardado.
  - Esperado: a confirmação cita "Its vocabulary list and saved audio are deleted too." e diz que as citações já salvas nas notas e o vocabulário já enviado ficam; a pasta de áudio some (Settings mostra o tamanho menor); a nota que já recebeu o vocabulário continua com o bloco.
  - Resultado:

### 5. Entrega 3 (marca no texto, professor e Retell)

- **5.1** No PDF francês, guardar duas ou três palavras e uma frase; virar a página e voltar, mudar o zoom (ponto 1, a parte do pontilhado).
  - Esperado: cada ocorrência da palavra guardada na página aparece com **sublinhado pontilhado cinza, sem fundo**, legível sobre a página branca; a frase guardada tem o pontilhado só no lugar de origem; as marcas voltam depois de virar a página e de mudar o zoom.
  - Resultado:
- **5.2** O mesmo no EPUB, mudando também o tamanho da fonte e virando para outro capítulo (ponto 1).
  - Esperado: o pontilhado aparece nas ocorrências da palavra e da frase guardada, dentro do iframe, e se refaz no capítulo novo.
  - Resultado:
- **5.3** Guardar uma palavra num livro francês e abrir **outro** livro em francês que a tenha.
  - Esperado: a palavra aparece marcada no outro livro também.
  - Resultado:
- **5.4** Abrir o PDF em inglês e o livro em português (com "In every book" no segundo, se quiser).
  - Esperado: nenhuma marca da palavra guardada em francês aparece em livro de outra língua.
  - Resultado:
- **5.5** Guardar uma forma flexionada sem traduzir ("tâtonnant"), olhar o texto, e depois traduzir o item pela aba e olhar de novo (ponto 15).
  - Esperado: sem tradução só a forma exata é marcada ("tâtonner" e "tâtonnait" não); depois da tradução a forma base vem junto e passa a marcar também as outras ocorrências da base.
  - Resultado:
- **5.6** Guardar uma palavra que também está dentro de um grifo e clicar nela.
  - Esperado: abre o popover do **grifo**, como sempre, e não o "onde você guardou"; fora do grifo, o clique na mesma palavra abre o "onde você guardou".
  - Resultado:
- **5.7** Clicar numa palavra marcada fora de grifo.
  - Esperado: o popover mostra o termo e, para cada item, a frase com o termo em negrito, a posição, a data e o sentido; as ações são Listen, Translate here, Add this sentence, Find in book (só no PDF) e Remove; `Esc`, clique fora, virar a página e rolar fecham.
  - Resultado:
- **5.8** Nesse popover: "Translate here" (e "Add to vocabulary" dele), "Add this sentence", "Find in book", "Remove".
  - Esperado: "Translate here" traduz com a frase **de agora**; "Add this sentence" cria um item novo (ou "Already in your vocabulary"); "Find in book" abre a busca com o termo preenchido; "Remove" apaga e mostra aviso com Undo.
  - Resultado:
- **5.9** Clicar numa palavra guardada também em **outro livro**.
  - Esperado: o item do outro livro aparece com "Saved in another book" e o título; o botão diz "Remove from this book" e só apaga os itens deste livro.
  - Resultado:
- **5.10** Clicar numa frase guardada (não numa palavra marcada dentro dela).
  - Esperado: o popover mostra a frase, a posição e a tradução, só com Listen e Remove.
  - Resultado:
- **5.11** Desligar e ligar "Mark in text" no topo da aba e em Settings › Language › Vocabulary.
  - Esperado: as marcas somem e voltam na hora, com o leitor aberto; as duas chaves são a mesma.
  - Resultado:
- **5.12** Guardar uns cem itens da mesma língua (ou usar o que já tiver) e virar páginas no PDF e num EPUB de capítulo grande.
  - Esperado: sem engasgo ao virar a página; o pontilhado aparece logo depois da página. Anote qualquer lentidão.
  - Resultado:
- **5.13** No chat do leitor, ligar e desligar "Language teacher" (linha do Send); fechar e reabrir o livro.
  - Esperado: desligado por padrão; o chip vira um botão "AI sees: p. 42 · … · French teacher · N saved" com o interruptor ligado, e clicar nele abre e fecha uma prévia do bloco acrescentado; o estado fica lembrado **por livro**; desligado, o chip é texto como sempre e a pergunta vai idêntica à de antes.
  - Resultado:
- **5.14** Perguntar algo sobre a página com o professor ligado, sem nota de perfil.
  - Esperado: a resposta vem na sua língua, com exemplos em francês da página; funciona sem nível ("French teacher", sem parênteses).
  - Resultado:
- **5.15** Settings › Language › Language profile › "Open the note" (sem a nota existir), e depois preencher "French: B1".
  - Esperado: cria a nota "Language profile" (tag `language profile`) no primeiro caderno que não é o Calendar nem tem a IA desligada, com o template, e abre; **o Settings fecha e o app sai do livro aberto**; depois de preencher, o chip do professor mostra "(B1)". Diga se prefere que a nota abra sem sair do livro.
  - Resultado:
- **5.16** Pôr na nota de perfil um nível só de outra língua ("Spanish: B2") e abrir o livro em francês; depois uma página sem vocabulário guardado.
  - Esperado: sem a linha de francês, o professor fica sem nível; numa página sem itens o chip não traz "· N saved".
  - Resultado:
- **5.17** Com nota vinculada ao livro, guardar três ou quatro palavras e clicar "Retell" na aba Vocabulary.
  - Esperado: o bloco `Retell · p. 42–43 · <data>` com "Words: …" (os marcados, ou os novos) é acrescentado à nota e a coluna da direita troca para a aba Notes. A nota abre no topo: role até o fim e escreva abaixo da linha "Words:". Diga se prefere que ela role e foque sozinha.
  - Resultado:
- **5.18** "Retell" num livro sem nota vinculada.
  - Esperado: abre o seletor de caderno e nota (os dois passos do modal de citação); a nota escolhida passa a ser a vinculada ao livro e recebe o bloco.
  - Resultado:
- **5.19** Enviar todos os itens ao caderno e olhar o botão Retell sem marcar nada.
  - Esperado: o Retell fica desabilitado, com a dica "Tick the words you want to use, or save new ones first"; marcando itens ele volta a valer.
  - Resultado:
- **5.20** Na aba Notes, com a nota que tem um Retell, clicar "Ask for feedback" com o espaço vazio e depois com o reconto escrito.
  - Esperado: o botão aparece no cabeçalho da aba, só nessa nota; vazio, dá "Write your retelling below the word list first."; escrito, liga o professor, abre o chat e envia o reconto como citação com "Comment on my retelling. Don't rewrite it."; a IA comenta e **não reescreve**.
  - Resultado:
- **5.21** "Ask for feedback" sem chave do OpenRouter.
  - Esperado: o chat mostra o aviso de chave de sempre; nada é enviado.
  - Resultado:

### 6. Fora desta entrega (não testar)

A leitura contínua, a frase marcada na página, "Pause after each sentence", "Recall first", a busca no EPUB, a coluna muito estreita redesenhada, flashcards, "I know this", contador na aba e o visto em cada palavra usada no Retell.

### 7. Decisões de detalhe para você conferir

Os oito padrões do Apêndice F do plano, aceitos pelo Orquestrador como detalhe de execução; diga se algum deve mudar:
1. **Cor do pontilhado:** cinza neutro, pela regra "cinza sem matiz" do Task Report, e não o azul-petróleo do mockup.
2. **Áudio com duração incompatível** com o texto: não toca, não vai ao cache e mostra "Try again" e "Skip"; o uso é contado, porque foi cobrado. A alternativa é tocar e só não guardar. (A regra ficou mais folgada por decisão do Orquestrador: recusa só acima de `caracteres/4 + 5` segundos ou, com 20 caracteres ou mais, abaixo de `caracteres/40`.)
3. **PCM sem taxa no cabeçalho** é tratado como 24 kHz, **menos o do HeyGen, que é 44,1 kHz** (pela documentação do OpenRouter): é a única exceção por provedor no código. A premissa de antes (a checagem de duração recusaria o áudio na taxa errada) não se sustentava (100 caracteres a 15 por segundo medem 12,3 s lidos a 24 kHz contra um teto de 30 s), e o áudio lento iria ao cache. Revista na passada final (voz I1). Um modelo sem formato conhecido é pedido em `mp3`; o PCM só sai com o catálogo inteiro desconhecido (o padrão do endpoint).
4. **Língua nativa em chave própria** (`monet:native-language`): trocar a língua em Settings › Language não muda a língua das respostas do resto do app.
5. **"Ask for feedback"** fica no cabeçalho da aba Notes do leitor, e não dentro da nota como no mockup, porque o editor não tem botão no conteúdo.
6. **Remove no popover "onde você guardou"** apaga só os itens deste livro; os de outros livros aparecem como "Saved in another book".
7. **Custo do livro no menu ⋯:** o que já foi gerado, não a projeção do livro inteiro.
8. **Coluna de navegação com 300 px e abas com 8 px só com as ferramentas de língua:** em livro na língua nativa a coluna continua com 280 px, como pede a F1.2.

Outros detalhes desta entrega, para o mesmo olhar:
- O **"Open" do aviso de envio e o chip "Sent to notebook"** mostram a nota de vocabulário na aba Notes **sem trocar o vínculo** (passos 4.7 e 8.1; revisto na passada final, porque o vínculo também liga a nota Paper ao PDF e leva o "Save to note" do chat): o Retell e as próximas citações seguem para a nota do livro.
- O **Retell fica desabilitado** quando todos os itens já foram enviados e nada está marcado (regra do Task Report: os marcados, ou os novos).
- **"Open the note"** do Settings leva à nota de perfil e fecha o Settings, saindo do livro aberto; o **Retell** não rola a nota até o fim.
- O popover de uma **frase guardada** só tem Listen e Remove; quando uma palavra e uma frase guardada contêm o ponto do clique, abre a palavra.
- A **tradução do Translate** usa `openai/gpt-4.1-mini` por padrão; o modelo se troca em Settings › Language.

### 8. Passos novos depois da revisão

Cada passo confere uma mudança de comportamento da passada final do `codeAgent` (os achados dos três reviews). Mesmas regras de antes: app de desenvolvimento, anote a mensagem exata de qualquer erro.

- **8.1** Abrir a nota de vocabulário **sem trocar o vínculo**. Num livro com nota vinculada (a aba Notes mostrando a nota do livro), envie vocabulário a uma nota de vocabulário, clique "Open" no aviso e depois no chip "Sent to notebook" de um item. Se tiver, faça o mesmo num PDF aberto pela nota Paper.
  - Esperado: a aba Notes mostra a nota de vocabulário com a linha "Not linked to this book" e o botão "Back to the book's note"; "Add to note" de uma citação, o Retell e o "Save to note" do chat continuam indo para a nota do livro; "Back to the book's note" volta a ela e a linha some; apagar a nota de vocabulário enquanto ela é vista volta à nota do livro, sem tirar o vínculo; escolher caderno e nota pelos seletores vincula de propósito (a linha some); a nota Paper segue ligada ao livro. **Sem usar o "Open"**, a aba Notes se comporta como sempre (trocar de caderno e de nota, criar nota, reabrir o livro): ela estava validada em uso real, confira que nada mudou.
  - Resultado:
- **8.2** Voz padrão pela língua do livro. No menu ⋯ do player (ou em Settings › Language), escolha um modelo sem voz salva cujas vozes tragam a língua no nome (por exemplo o MAI, o Deepgram Aura 2 ou o Voxtral) e ouça num livro em francês; depois num livro em inglês, no mesmo modelo.
  - Esperado: a voz proposta é uma francesa (`fr-FR-…`, `…-fr`, `fr_…`), não a primeira da lista; no seletor as vozes francesas vêm primeiro; no livro em inglês a proposta é inglesa e a escolha do livro em francês **não** muda (a voz é lembrada por modelo e por língua). No Gemini (vozes sem língua no nome) vale a primeira, como antes. Troque a voz num livro e confira que o outro não a herda.
  - Resultado:
- **8.3** Listen de um item com o player tocando. Com "Listen to page" tocando, clique o alto-falante de um item da aba Vocabulary, depois o Listen de uma palavra marcada no texto e o Listen do popover do Translate. Depois o contrário: com um item falando, clique Listen (ou `L`).
  - Esperado: o player pausa e só a frase do item soa; ao terminar, o player fica pausado e `Espaço` o retoma do começo da frase; no contrário, o item para e o player toca. As duas vozes nunca soam juntas.
  - Resultado:
- **8.4** Next para uma frase ainda não gerada. Com "Listen to page" tocando uma página longa, logo no começo, aperte `Shift+→` (ou o botão Next) duas ou três vezes seguidas, mais depressa que a geração.
  - Esperado: a frase que tocava cala na hora; o player mostra "Preparing audio…" sem som por baixo e toca a frase de destino quando ela chega. O mesmo com uma frase que falhou (a mensagem de erro aparece sem som).
  - Resultado:
- **8.5** Rótulo do rodapé do Translate no PDF. Selecione uma frase, `T`, "Change"; clique no **texto** "Book language" e no de "Translate into" (não na caixa), depois no próprio seletor e troque a língua.
  - Esperado: o popover não fecha nem perde a seleção em nenhum desses cliques, e a tradução é refeita ao trocar a língua. Com o popover aberto sobre um trecho já grifado, clicar no corpo dele não abre o "Remove highlight".
  - Resultado:
- **8.6** Setas e Espaço em seletor e em modal. Com o menu ⋯ do player aberto e o foco no seletor de voz, e com o rodapé do Translate em "Change" e o foco num seletor, aperte `←` e `→` e as letras. Depois, com o player aberto, abra "Language settings…" pelo menu ⋯, ponha o foco no botão "Test voice" e aperte `Espaço`.
  - Esperado: as setas trocam a opção do seletor e **não** viram a página; `Espaço` aciona o botão do Settings e **não** alterna o player; com o modal fechado e o foco fora de campos, as setas viram a página como antes.
  - Resultado:
- **8.7** Virar a página do EPUB com fonte grande. No EPUB, aumente a fonte até uma tela mostrar só um pedaço do que era uma "página" (a location tem cerca de 1.600 caracteres); ouça uma seleção e depois "Listen to page"; vire para a tela seguinte do mesmo trecho. Abra e feche também uma coluna lateral (repagina) com o texto lido ainda na tela.
  - Esperado: o áudio pausa ao sair da tela do texto lido, mesmo sem trocar de location, com o "Back to …"; com a seleção no fim da tela, virar a página também pausa; voltar à tela do áudio tira o aviso (sem retomar); abrir ou fechar a coluna com o texto lido ainda na tela **não** pausa. Clicar no texto do livro com o menu ⋯ do player aberto, ou com o Translate de um item ou de uma palavra marcada aberto, fecha os dois.
  - Resultado:
- **8.8** Corrigir a língua de um livro que já tem vocabulário. Com palavras guardadas num livro de língua detectada errada, corrija a língua (Library › Edit, ou o "Change" do Translate); abra outro livro na língua certa que tenha essas palavras no texto.
  - Esperado: o outro livro marca as palavras, e o popover mostra "Saved in another book"; o livro de língua errada de antes não as marca mais. Guardar o sentido de um item depois da correção (aba Vocabulary, "Translate" e "Save translation") não desfaz a correção.
  - Resultado:
- **8.9** A mesma palavra em duas frases da mesma página (PDF), de preferência com uma palavra mais longa que a contém antes dela ("malle" e "mallette"). Guarde a palavra na 1ª ocorrência (`V`); selecione a 2ª e aperte `V`; clique a 2ª já marcada e use "Add this sentence"; abra o Translate na 2ª.
  - Esperado: a 2ª entra como item novo, com a frase **dela** (não "Already in your vocabulary"); o Translate mostra a frase da ocorrência selecionada; na aba e nos popovers o negrito cai na palavra inteira, não em "mallette"; o chip do professor ("N saved") conta a palavra uma vez. No EPUB vale entre parágrafos (dentro da mesma frase a segunda ainda repete a frase).
  - Resultado:
- **8.10** EPUB com `<dc:language>` `und` (o que o Calibre grava sem preencher; se não tiver um, pule). Importe um EPUB em português assim.
  - Esperado: a Library mostra "PT" (detectado pelo texto), nunca "UND", e o livro abre **sem** as ferramentas de língua, idêntico ao de antes.
  - Resultado:
- **8.11** Caderno padrão. Com o Calendar como primeiro caderno da ordem: envie vocabulário pela primeira vez a uma nota nova num livro sem nota vinculada; depois do primeiro envio, clique "Change"; e, sem a nota de perfil, "Open the note" do Settings.
  - Esperado: o Calendar não aparece na lista de cadernos da nota nova nem é o padrão; o "Change" abre com "Current destination: …" marcado (Send ou "Save destination" não cria outra nota de vocabulário); a nota de perfil nasce num caderno que não é o Calendar nem tem a IA desligada.
  - Resultado:
- **8.12** Preço no seletor de modelo. Abra o seletor e procure um modelo `:free` e o Seed Audio (cobrado por segundo).
  - Esperado: o `:free` mostra "Free" (e a caixa de custo "~ $0.00"); o por segundo mostra "$0.0025 / second" e uma página em torno de US$ 0,36, não "$2500.00 / 1M audio tokens".
  - Resultado:
- **8.13** Menu ⋯ do player por cima. Abra o menu ⋯ com um aviso na tela (logo depois de "Add to note") e com o Translate aberto.
  - Esperado: o menu aparece acima do aviso e do popover, não por baixo.
  - Resultado:
- **8.14** Modelo sem formato conhecido (se puder escolher um `:free` ou um MiniMax; o HeyGen só entrega PCM). "Test voice" e um Listen com esse modelo.
  - Esperado: soa na velocidade normal, nunca lento e grave (o pedido sai em `mp3`, ou em PCM a 44,1 kHz no HeyGen); se falhar, anote a mensagem exata e o `kind`.
  - Resultado:

### 9. Rodada 2: janela de tradução

Passos da rodada de ajustes pedida no teste (os três pedidos sobre a janela do Translate: mover, redimensionar e lembrar; espaçamentos; lentidão). Mesmas regras de antes: app de desenvolvimento (`npm run tauri:dev`), anote a **mensagem exata** de qualquer erro. O app em teste recebe as mudanças por HMR; se algo estiver estranho, feche e reabra o app antes de concluir. Os passos que trazem **"Anote"** pedem um número ou uma opinião sua. Material: o PDF e o EPUB em francês, com um parágrafo de uns 600 a 1.000 caracteres e uma frase curta em cada um.

- **9.1** Parágrafo longo no PDF (espaçamento e botões). Selecione um parágrafo inteiro (uns 700 caracteres) e aperte `T`; espere a tradução terminar.
  - Esperado: o texto da tradução termina numa linha de borda, com 8 px de respiro entre ela e a fileira de botões; os **quatro** botões (Listen, Add to vocabulary, Add to note, Ask AI) ficam numa linha só (a janela da passagem tem 440 px); "French → Portuguese · Change" fica dentro da mesma barra, sem borda própria; a barra de rolagem é fina e discreta (não há faixa clara de uns 17 px) e a margem da direita do texto parece igual à da esquerda; a tradução e as notas de gramática têm 12 px entre si. **Anote** se algum botão quebrou para a segunda linha (a folga é de uns 19 px e depende da fonte) e se a margem da direita ficou torta.
  - Resultado:
- **9.2** Palavra (espaçamento). Selecione uma palavra e aperte `T`.
  - Esperado: os botões ficam em 2 × 2 dentro da barra com borda em cima; a altura dos botões é a de sempre (28 px); a linha de línguas fica dentro da barra.
  - Resultado:
- **9.3** A tradução aparece enquanto chega (a lentidão). Selecione um parágrafo longo e aperte `T`. **Anote** o tempo até aparecer o primeiro texto e o tempo até a tradução terminar, e compare com a sensação de antes (a janela esperava a resposta inteira).
  - Esperado: logo depois de `T` a janela abre com a barra de ações já no lugar e um esqueleto com uma barra por linha estimada; o cabeçalho diz "Translating…". O primeiro pedaço de texto troca o esqueleto inteiro, e o texto cresce. Enquanto ele chega, a janela **não muda de lugar nem de altura** e o corpo **não rola sozinho** (se o texto passar da janela, aparece a barra de rolagem fina e você rola à mão). "Listen", "Add to note" e "Ask AI" funcionam desde o começo; "Add to vocabulary" está apagado, e o passar do mouse mostra "Available when the translation is complete". Quando o texto fecha e as notas ainda não vieram, uma barra de esqueleto ocupa o lugar delas. No fim, o cabeçalho volta a "Translation", as notas aparecem, "Add to vocabulary" acende, e a janela faz **um único ajuste** de altura (encolhe se sobrou espaço). Se o primeiro texto demorar muito, veja qual é o "Translation model" em Settings › Language: um modelo que raciocina por padrão soma segundos antes do primeiro texto (o app não desliga o raciocínio; ver a sessão do `codeAgent` desta rodada).
  - Resultado:
- **9.4** O ajuste final com a janela acima da seleção. Selecione um parágrafo bem embaixo na página, de modo que a janela abra **acima** dele, e traduza.
  - Esperado: durante o texto a janela fica parada; no fim, se ela encolhe, a **base** fica onde estava (a janela continua colada na seleção, sem se afastar dela) e o topo é que se move. Com a janela abaixo da seleção (9.3), é o **topo** que fica parado.
  - Resultado:
- **9.5** Texto curto. Selecione uma frase curta (uns 80 caracteres) e traduza.
  - Esperado: o esqueleto tem poucas barras, a janela é menor que a do parágrafo, e no fim ela se ajusta ao conteúdo, sem pular de lugar.
  - Resultado:
- **9.6** Erro no meio da tradução. Num parágrafo longo, assim que o texto começar a aparecer, corte a rede (desligue o Wi-Fi). Se não conseguir cortar a tempo, pule.
  - Esperado: o texto que já chegou **continua na tela**, com o aviso "The translation stopped before the end."; a barra mostra "Try again" como primeiro botão, depois Listen, Add to note e Ask AI (sem Add to vocabulary). Com a rede de volta, "Try again" refaz do zero: o texto antigo e o aviso saem, o corpo volta ao topo e o texto chega de novo.
  - Resultado:
- **9.7** Erro sem texto e sem chave. Desligue a rede **antes** de apertar `T`; depois (se quiser) tire a chave do OpenRouter.
  - Esperado: sem texto parcial, o aviso é "Couldn’t translate." com "Try again" na barra; sem chave, "Add your OpenRouter key in Settings." com "Open Settings" como único botão e sem a linha de línguas.
  - Resultado:
- **9.8** A palavra não chega aos poucos. Traduza uma palavra e uma expressão de três palavras.
  - Esperado: o esqueleto de duas barras e a barra de ações desde o primeiro quadro (com "Add to vocabulary" apagado); o sentido chega de uma vez e a barra **não pula** nem muda de lugar quando ele chega.
  - Resultado:
- **9.9** Consulta repetida. Traduza o mesmo parágrafo duas vezes seguidas (feche com `Esc` e abra de novo).
  - Esperado: na segunda vez o texto, as notas e o botão "Add to vocabulary" já aparecem de uma vez, sem esqueleto demorado e sem chamada nova.
  - Resultado:
- **9.10** Mover a janela. Abra uma tradução e arraste o **cabeçalho** (a palavra "Translation" ou o termo, a faixa de cima) para outro ponto da tela.
  - Esperado: o cursor vira mão aberta e depois mão fechada; a janela segue o ponteiro; ela **não passa** da borda da janela do app (fica a 8 px); a seleção do livro continua marcada e a janela **não fecha** ao soltar. Clicar no X continua fechando a janela; apertar e arrastar a partir do X não move nada.
  - Resultado:
- **9.11** Redimensionar. Arraste as quatro bordas e os quatro cantos (os cursores mudam: setas verticais, horizontais e diagonais).
  - Esperado: a borda ou o canto acompanha o ponteiro e o lado oposto fica parado; o mínimo é 300 × 220 px; a largura vai até 640 px e a altura vai **além de 460 px**, até 16 px a menos que a janela do app; a seleção continua marcada e a janela não fecha. Com a janela mais alta que o texto, a barra de ações fica **no fundo** e o espaço sobra entre o texto e ela. Com a janela mais baixa que o texto, o corpo rola por dentro e a barra continua visível.
  - Resultado:
- **9.12** Lembrar posição e tamanho. Depois de mover e redimensionar a janela da passagem, feche com `Esc`, traduza **outro** parágrafo, em outra parte da página e depois em outra página. Em seguida feche o app e abra de novo.
  - Esperado: a janela abre **no mesmo lugar e do mesmo tamanho**, sem ir para perto da seleção, e não se mexe com a rolagem do PDF; o tamanho é fixo (não muda enquanto o texto chega, nem no fim; o corpo rola por dentro) e não há teto de 460 px; reabrindo o app, continua assim. Mover ou redimensionar **não** grava nada durante o gesto, só ao soltar (soltar fora da janela do app conta).
  - Resultado:
- **9.13** Uma geometria por variante. Com a passagem gravada, abra a tradução de uma **palavra**, mova e redimensione essa janela; depois abra uma passagem, uma palavra e um texto com mais de 1.500 caracteres (o aviso de texto longo).
  - Esperado: a palavra abre na geometria da palavra e a passagem na da passagem, sem uma mexer na outra; o aviso de texto longo abre na da **passagem**, com Listen e Ask AI. As chaves são `monet:translate-window:passage` e `monet:translate-window:word` (dá para conferir no DevTools, se quiser).
  - Resultado:
- **9.14** Voltar ao padrão. Com a janela da passagem gravada, dê **duplo clique no cabeçalho**; depois faça o mesmo na janela da palavra, e dê um duplo clique no X.
  - Esperado: a janela volta na hora para o lado da seleção, com o tamanho de sempre (440 ou 340 px) e a altura pelo conteúdo; só a variante em que você clicou volta (a outra continua gravada); fechada e aberta de novo, abre ancorada na seleção. O duplo clique no X só fecha, não restaura nada.
  - Resultado:
- **9.15** Posição que não cabe. Arraste a janela para o canto de baixo à direita e redimensione-a grande; feche o app, **diminua** a janela do app (ou ponha-a noutro monitor menor) e abra de novo; depois aumente a janela do app com a tradução aberta. Faça também o contrário: com a tradução aberta, diminua a janela do app.
  - Esperado: ao abrir, a janela aparece **inteira** dentro da janela do app, a 8 px das bordas, com o tamanho limitado ao que cabe (nunca fora da tela); diminuir a janela do app com a tradução aberta a empurra para dentro na hora; ao aumentar de novo, ela **volta ao lugar que você escolheu** (o ajuste não regrava a posição).
  - Resultado:
- **9.16** O EPUB: arrastar passando por cima do livro. No EPUB em francês, selecione uma frase, aperte `T`, e arraste o cabeçalho e depois uma alça (um canto) **passando sobre o texto do livro** (o iframe), soltando tanto sobre o livro como fora dele.
  - Esperado: a janela segue o ponteiro sem travar ao passar sobre o texto do livro; a seleção do livro **não** se desfaz e a janela não fecha, nem ao soltar sobre o livro; clicar fora (num ponto vazio do livro) fecha a janela como antes; virar a página também fecha.
  - Resultado:
- **9.17** O PDF: arrastar sobre a camada de texto. Repita o passo anterior no PDF, passando sobre o texto da página e soltando sobre ele.
  - Esperado: o mesmo: a janela segue o ponteiro, a seleção continua marcada, soltar sobre o texto não a limpa nem abre o "Remove highlight" de um grifo que estiver embaixo.
  - Resultado:
- **9.18** O "Translate" de um item da aba Vocabulary (`savedItem`). Num item sem sentido, clique "Translate"; mova e redimensione a janela; depois clique "Save translation" quando ela terminar.
  - Esperado: "Save translation" fica apagado até o fim e depois grava o sentido; a janela abre na geometria da variante (palavra ou passagem, pelo tipo do item); arrastar o cabeçalho ou uma alça **não** a fecha (o clique fora é o que fecha, e as alças contam como dentro); `Esc` fecha.
  - Resultado:
- **9.19** O "Translate here" de uma palavra marcada (`standalone`). Clique numa palavra marcada no texto, "Translate here"; mova a janela e use "Add to vocabulary" no fim.
  - Esperado: o mesmo do passo anterior: arrastar não fecha, o clique fora e `Esc` fecham, e o "Add to vocabulary" cria um item novo (só habilita no fim).
  - Resultado:
- **9.20** O popover "onde você guardou" (`SavedWordPopover`). Clique numa palavra marcada no texto (sem abrir o Translate).
  - Esperado: abre **ancorado** na palavra, como sempre, e **não** se move nem se redimensiona (o cursor no cabeçalho é o normal, sem alças); recebe os espaçamentos novos: barra de ações com borda em cima e 8 px de respiro, com os botões quebrando em duas linhas dentro dela; a lista de frases, se rolar, usa a barra de rolagem fina; `Esc` e o clique fora fecham; o "Translate here" dele abre a janela de tradução na geometria gravada da palavra.
  - Resultado:
- **9.21** C5, a palavra lembra a posição. Use a tradução de palavra algumas vezes seguidas, em pontos diferentes da página, depois de a ter movido uma vez.
  - Esperado: ela abre sempre no lugar gravado, mesmo quando a palavra selecionada está longe. **Decida e anote**: isso atrapalha (o olho tem que viajar até o canto)? Se sim, a alternativa é a palavra lembrar **só o tamanho** e continuar abrindo junto da palavra; me diga qual você prefere.
  - Resultado:
- **9.22** Troca de língua com a janela aberta. Com a janela de uma passagem aberta, clique em "Change", troque a língua de destino ("Translate into") e depois a do livro.
  - Esperado: cada troca refaz a tradução; o corpo volta ao topo, o esqueleto e o texto chegam de novo, e a janela se reajusta uma vez ao fim (sem geometria gravada) ou não muda (com geometria gravada); os dois seletores continuam funcionando e o clique neles não fecha a janela.
  - Resultado:
- **9.23** Clique sem arrastar não prende a janela (limiar de 4 px). Com **nenhuma** geometria gravada (apague as chaves com o duplo clique no cabeçalho, ou no DevTools), abra uma tradução e **clique** no cabeçalho, no meio dele e com a mão um pouco trêmula (1 ou 2 px de movimento), e faça o mesmo numa borda e num canto (as alças são invisíveis: o cursor muda de forma sobre elas). Depois feche a janela com `Esc` e traduza **outro** parágrafo, em outro ponto da página.
  - Esperado: nada se move, a janela não é redimensionada e **nada é gravado** (no DevTools, `monet:translate-window:passage` e `:word` continuam sem valor); a nova janela abre **junto da seleção**, com a altura pelo conteúdo, e não no lugar do clique. Um arrasto de uns 5 px ou mais **começa**: a janela anda por inteiro com o ponteiro (sem um "pulo" de 4 px no começo), segue valendo se o ponteiro voltar para perto de onde começou, e só então a geometria é gravada ao soltar. Um duplo clique no cabeçalho, mesmo com a mão trêmula, volta ao padrão e não deixa chave gravada.
  - Resultado:

### 10. Outras línguas

Passos do ajuste que tira o francês de dentro do app (o "Test voice", a nota de perfil, as abreviações da divisão em frases e o hífen do fim da linha no PDF passaram a valer para as 16 línguas oferecidas). Com o que você tem, o app continua falando francês, porque o livro aberto por último é francês: o que se confere é que **nada mudou** nele e que, com um livro em outra língua, a língua do livro aparece onde antes só havia o francês. Mesmas regras de antes: app de desenvolvimento, anote a **mensagem exata** de qualquer erro. Nenhum passo exige chamada paga.

- **10.1** O "Test voice" e o seletor de voz seguem o livro aberto por último. Em Settings › Language, olhe o seletor de voz de "Reading aloud" sem apertar "Test voice".
  - Esperado: as vozes francesas vêm primeiro (a língua é a do livro francês que você abriu por último). Se apertar "Test voice", é a frase francesa "Élise monte au grenier à 21 h 30." (custa o preço de uma frase; é opcional).
  - Resultado:
- **10.2** A nota de perfil sem supor o francês. Só se você **ainda não tem** a nota com a tag `language profile`: em Settings › Language › Language profile, "Open the note". Se já tem, ela só abre; pule este passo.
  - Esperado: a nota nasce com quatro linhas (a língua nativa, "French: B1", "Explain" e "Don't"), porque o livro aberto por último é francês. Sem nenhum livro de outra língua ela nasceria **sem** a linha do nível; isso só se vê numa biblioteca sem livros em outra língua e está coberto por teste.
  - Resultado:
- **10.3** O texto de ajuda do perfil. Em Settings › Language › Language profile, leia o parágrafo acima do botão.
  - Esperado: termina com "Write one line per language you study: the language's name in English, a colon and your level (A1 to C2).", sem citar língua nenhuma, depois do resto de antes ("A note tagged language profile tells the AI…").
  - Resultado:
- **10.4** Um livro em outra língua (se tiver um que não seja francês nem a sua língua; senão, pule). Abra-o, selecione uma frase, aperte `T` e ligue o "Language teacher" na linha do Send do chat do livro.
  - Esperado: o rodapé do Translate mostra o nome da língua desse livro, não "French" ("English → Portuguese", por exemplo); o chip do chat diz "AI sees: p. N · <língua> teacher"; ao voltar a Settings › Language, o seletor de voz traz as vozes **dessa** língua primeiro (ele é o livro aberto por último). Se o livro tiver um tratamento com ponto antes de um nome ("Sr.", "Dr.", "Hr."), "Listen" e a frase do Translate não cortam depois dele.
  - Resultado:
- **10.5** O francês continua igual. No livro em francês, ouça (ou traduza) uma frase com "M.", "Mme" ou "p." antes de um nome ou número, e, num PDF, selecione um trecho que termine uma linha em "peut-" + "être".
  - Esperado: a frase não é cortada depois da abreviação, e a seleção do PDF mantém "peut-être", como antes deste ajuste.
  - Resultado:
