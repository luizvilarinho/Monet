# Mincer — processador de grandes volumes

> Spec de feature (2026-10-31, branch `feat/mincer`). Porte do VOLP (`C:\Users\User\Documents\projetos\Minuta\minuta`) para dentro do Monet. Base: Task Report `DOCS/reports/31-10-2026/taskreport_20261031005051.md`, explorer `DOCS/reports/31-10-2026/explorerreport_20261031005653.md` e plano `DOCS/reports/31-10-2026/planreport_20261031010550.md`. Contrato de saída: estudo `DOCS/features/central_informacao_study.md` (I13, D6).

## 1. Conceito

O Monet lida bem com pouca informação por vez. O **Mincer** cobre os grandes volumes: transcreve reuniões e gravações, resume vídeos do YouTube e artigos da web, captura o texto de páginas e processa arquivos e texto colado. É o 4º modo do menu principal (Notebook, Chat, Library, **Mincer**).

O resultado fica num histórico próprio e entra no fluxo do Monet só por ação explícita do usuário: **Send to notebook** (vira nota) e **Send to Chat** (vira conversa com o conteúdo como contexto). Nada vai para um caderno sem clique (PRD, não-metas).

## 2. Entradas

Abas da tela "New item" (`src/components/Mincer/MincerNew.tsx`). Sem nenhum item no histórico, uma linha sob o título explica o Mincer. O rascunho (aba, arquivos, texto colado, URLs, Summarize/Capture) fica num objeto do módulo e sobrevive à troca de modo do menu, não a reiniciar o app.

| Aba | Kind | O que faz |
|---|---|---|
| File | `file` | Áudio/vídeo (`mp4 mp3 m4a wav ogg opus webm flac aac mkv mov avi`, até 500 MB): extrai o áudio, transcreve e resume. `.txt`/`.md` (até 20 MB): lê o texto e resume. `.pdf` (até 100 MB): o worker extrai o texto com `pdf_extract` (o mesmo `pdf_text_from_mem` do anexo de PDF no Chat, estágio `reading_pdf`) e resume; PDF escaneado, sem texto, dá erro. "Choose files" aceita vários arquivos, e arquivos soltos na janela (drag-drop do Tauri, `onDragDropEvent`, com a tela New aberta) entram na seleção sem iniciar. Durante a gravação, o drop só troca a seleção e a tela fica na aba Record (Stop e Discard à vista). Pasta solta dá "Folders aren't supported — drop files.". O Start enfileira um item por arquivo, na ordem; os que falham continuam selecionados, com o erro de cada um, e o histórico recarrega para mostrar os que entraram na fila. |
| Paste | `paste` | Resume o texto colado. O título é a 1ª linha (80 chars). |
| Record | `record` | Grava o áudio do sistema e o microfone (§8); ao parar ("Stop and process"), o item entra na fila para mixar, transcrever e resumir. "Discard" (com confirmação) apaga a gravação sem criar item. |
| YouTube | `youtube` | Pega o título, baixa o áudio (yt-dlp), transcreve e resume. Só aceita link http(s) de host do YouTube com id válido; a URL vai ao yt-dlp depois de `--`. |
| Web page › Summarize | `web_summary` | Lê o texto legível da página (`dom_smoothie`; só HTML/texto, até 10 MB), usa o título do artigo e resume. |
| Web page › Capture text | `web_capture` | Só captura o texto da página, sem resumo e sem chave do OpenRouter. |

## 3. Fila e job

- **O Mincer nunca interrompe o uso do Monet.** Não há modal bloqueante nem botão travado por job ativo: o usuário enfileira quantos itens quiser, a qualquer momento, e pode sair da tela.
- **Fila FIFO no SQLite**: a fila é a própria tabela `mincer_items` (`status='queued'`, ordem por `queued_at`). Um worker no Rust (`src-tauri/src/mincer/jobs.rs`) processa um item por vez. Start, Resume, Regenerate e o fim da gravação só enfileiram e chamam `start_next`, que nunca bloqueia.
- **Fora da thread do webview**: rede, ffmpeg e yt-dlp (com `BELOW_NORMAL_PRIORITY_CLASS` e sem janela), leitura e base64 dos pedaços em `spawn_blocking`. As escritas no `monet.db` são curtas e nunca seguram o lock durante rede ou processo.
- **Stages**: `mixing`, `downloading`, `extracting`, `splitting`, `transcribing`, `fetching`, `summarizing`.
- **Eventos**: `mincer://progress {itemId, stage, current, total}`, `mincer://done {itemId}`, `mincer://error {itemId, message, cancelled}`, `mincer://record {active}`, `mincer://level {system, mic}` (§8). O hook `useMincerJob` (montado no `App`) guarda só o item ativo, a gravação (`recording`, `recordingStartedAt`) e a contagem de itens novos (`unseenCount`, relida no done/error e por `refreshUnseen`), e alimenta o botão Mincer na Toolbar. O progresso fica em `useMincerProgress`, assinado só pela tela do item, e o nível de áudio só pela tela New, para não re-renderizar o `App` a cada evento. O relógio da gravação na Toolbar é um componente próprio (`RecordingClock`), que re-renderiza só a si mesmo.
- **Botão Mincer na Toolbar**: gravando, ponto vermelho pulsante + tempo (`mm:ss`), e o clique abre o Mincer já na tela New, aba Record (Stop e Discard); processando, spinner; com itens novos, ponto na cor de destaque.
- **Processos filhos**: cada ffmpeg/yt-dlp entra num Job Object com `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (`sidecar.rs`, `ProcessJob`). Derrubar o job mata o processo e os filhos dele (o yt-dlp é PyInstaller onefile e baixa num processo filho). Se o Monet morrer (crash, saída pelo updater), o Windows fecha o handle e mata a árvore.
- **Cancelamento**: Cancel no item ativo mata a árvore do ffmpeg/yt-dlp (Job Object) e marca `cancelled`. "Remove from queue" num item enfileirado o marca `cancelled` sem rodar.
- **Retomada**: a pasta `appData/mincer/<id>/` guarda o áudio extraído, os pedaços (`chunk_NNN.mp3`) com o cache de cada transcrição (`chunk_NNN.txt`) e os marcadores `chunks.done`/`yt_audio.done`. Resume continua de onde parou e usa os modelos atuais do Settings (os vazios mantêm os do item). Um Regenerate que falhou ou foi cancelado continua pendente no Resume (`force_summary` só zera no `done`). A pasta é apagada assim que a transcrição/o texto é salvo no banco, quando o item termina `done` ou é deletado; pastas órfãs são limpas no boot (exceto com gravação em curso).
- **Crash**: no boot, o item que estava `running` vira `interrupted` e não é retomado sozinho (evita loop num item que derruba o app); fica com Resume.
- **Quit limpo** (bandeja › Quit, `RunEvent::Exit`): o item ativo volta à frente da fila (mantém o `queued_at`) e a árvore de processos é morta pelo Job Object antes de acordar a task; a gravação em curso vira item na fila. No boot seguinte a fila continua sozinha, em ordem. O X da janela só esconde: o job segue rodando.
- **Erros da API legíveis**: `api_error` (`mincer/mod.rs`) traduz 401 (chave), 402 (créditos), 429 (limite), contexto longo, modelo inválido e 5xx numa frase acionável ("…, then Resume"); falha de rede vira "Could not reach OpenRouter…". O detalhe técnico (status e corpo, até 500 chars) vem depois de uma linha em branco: o banner do item mostra a frase e recolhe o detalhe em "Technical details" (`splitMincerError`). Depois das 3 tentativas de um erro transiente, "(after 3 attempts)" entra na frase. Falha do ffmpeg/yt-dlp segue o mesmo formato (`JobError::context`, `sidecar.rs`): a frase é a etapa ("Could not download the YouTube audio.") ou, quando o stderr tem uma linha `ERROR:` (yt-dlp), a etapa com o motivo ("Could not download the YouTube audio: Video unavailable"); o fim do stderr (800 chars, a partir de uma linha inteira) fica no detalhe. Cancelled usa banner neutro, não o vermelho de erro.
- **Toast nativo do Windows** ao terminar cada item (disparado pelo Rust via `tauri-plugin-notification`, funciona com a janela escondida na bandeja): "Mincer: <title> is ready" / "Summary is ready." (ou "Text captured."), e "Mincer: <title> failed" com a frase do erro, sem o detalhe técnico (180 chars). **Sem toast** em cancelamento, item `interrupted` no boot e item devolvido à fila no Quit. **Sem navegação no clique**: o plugin 2.3.3 não expõe callback de clique no Windows desktop (ver backlog).

## 4. Histórico

Tabela `mincer_items`, criada em `open_doc_db` (`src-tauri/src/documents.rs`) e acessada **só por comandos Rust** (`src-tauri/src/mincer/db.rs`), sem BEGIN/COMMIT manual. Colunas: `id, kind, title, source, status (queued|running|done|error|cancelled|interrupted), stage, progress_current, progress_total, error, preset, summary_prompt, transcription_model, summary_model, transcript, summary, queued_at, force_summary, created_at, updated_at, unseen, sent_to_notebook_at`. As duas últimas entram por `ALTER TABLE ADD COLUMN` guardado por `PRAGMA table_info` (idempotente): `unseen` vira 1 quando o item termina `done` ou `error` e 0 quando é aberto (`mincer_mark_seen`); `sent_to_notebook_at` é gravado depois de um Send to notebook bem-sucedido (`mincer_mark_sent_to_notebook`). Os dois sobrevivem a reiniciar o app. A lista (`mincer_list`) lê só as colunas leves; a transcrição é lida só para o item aberto (`mincer_get`).

Na tela: histórico à esquerda (ícone por kind, data, "· Sent to notebook" quando enviado, estado: spinner, Queued, Error, Cancelled, Interrupted ou "New" num item `done` ainda não aberto), item à direita com abas Summary e Transcript/Text, renomear inline e Delete com confirmação (apaga também a pasta de chat do item). Abrir o item (inclusive quando ele termina já aberto) tira a marca de novo.

## 5. Resumo

- Automático, numa chamada `chat/completions` sem streaming, logo depois do texto.
- Presets copiados do VOLP: **Meeting**, **Class**, **News**, **Scientific** (`src/components/Mincer/presets.ts`). Meeting, Class e Scientific pedem o resumo no idioma do texto; News já fazia isso. O Meeting pede "Action Items / Next Steps" como checklist Markdown (`- [ ] item (responsável)`): na nota, o `tiptap-markdown` (plugin `markdown-it-task-lists`) converte cada linha em `taskItem`, que o usuário pode transformar em task com o "Add to Tasks" (nenhuma task é criada pela IA).
- **Additional instructions**: Append (preset + instruções) ou Replace (só as instruções). Instruções salvas com nome (Save/Update/Delete) em `monet:mincer-saved-prompts`.
- **Regenerate** refaz o resumo com outro preset/instruções sem retranscrever. O painel abre com as opções que geraram o resumo atual (`summarySettingsFromItem`, reconstruídas do `preset` e do `summary_prompt` do item) e mostra "Current summary: Meeting" (ou "+ instructions"/"Custom instructions"). O resumo anterior fica até o novo ficar pronto. As opções novas (preset, instruções, modelo) ficam pendentes em `appData/mincer/<id>/regenerate.json` e só vão para o item junto com o novo resumo; assim um Regenerate que falha ou é cancelado não muda a linha de origem, o "Current summary" nem o `preset` do Save .md. O Resume de um Regenerate pendente troca o modelo nas opções pendentes.
- A transcrição não envia `language`: o idioma é detectado pelo modelo.

## 6. Modelos e chave

- A chave é a do OpenRouter do Monet (`read_key`), sem configuração duplicada. Sem chave, a tela New bloqueia o Start (exceto Web page › Capture text) com "Add your OpenRouter key in Settings." e "Open Settings", que abre o Settings na seção OpenRouter Integration; se ainda assim chegar ao Rust, `OPENROUTER_KEY_MISSING` vira a mesma frase.
- **Settings › Mincer**: *Transcription model* (select carregado de `GET /models?input_modalities=audio&output_modalities=transcription`) e *Summary model* (texto livre). Chaves `monet:mincer-transcription-model` e `monet:mincer-summary-model`.
- O modelo de resumo vazio usa `monet:chat-model` e, sem ele, `lastModelId`. Sem modelo de transcrição, File de mídia, Record e YouTube ficam bloqueados com "Open Settings". "Open Settings" (modelo faltando) e "Change in Settings" abrem o Settings direto na seção Mincer (`initialSection` do `SettingsModal`). Não há modelo pré-selecionado (não há id seguro para fixar).

## 7. Saídas

- **Save .md**: cria `<pasta>/dd-mm-yyyy_hh-mm-ss/` com `summary.md` e `transcript.md`, cada um com front-matter (`title`, `date` RFC 3339, `source`, `kind`, `preset`) — contrato I13/D6. A última pasta fica em `monet:mincer-save-folder`; "Change folder" escolhe outra e "Open folder" abre no Explorer.
- **Send to notebook**: reaproveita o `SaveToNoteModal` com `plain` (sem o cabeçalho "Chat Response"; textos "Saved"/"Save to a note"/"this content" em vez de "response") e o título do item. A nota começa com uma linha de origem em itálico: `Source: <url ou nome do arquivo> · Mincer summary (<preset>, <modelo>) · <data>` (sem resumo: "Captured by Mincer" ou "Transcript/Text from Mincer"). O conteúdo é o resumo; com "Include transcript in note" (colado ao botão), acrescenta `## Transcript` com "*Transcribed by Mincer (<modelo>)*", ou `## Original text` nos kinds de texto. Em `web_capture`, o texto capturado. Depois do envio o item mostra "Sent to notebook" (evita nota duplicada). Trata o caso sem cadernos (cria um). `==texto==` vira texto simples (`stripMarkCitations`): a IA nunca cria marcas.
- **Send to Chat**: grupo **Mincer** na sidebar do Chat, uma pasta por item, com o título do item como nome (vínculo `monet:mincer-item-folder-link`, itemId → folderId), com system prompt próprio (`append`). A conversa nasce com o resumo como 1ª mensagem do assistant; se a pasta já tem conversas, abre a mais recente ("Open in Chat", só enquanto a pasta existe). A cada envio numa pasta do Mincer, o `ChatPanel` lê o item do SQLite e anexa `buildMincerContext` como `ephemeralContext`: resumo até 12k chars (omitido quando já está numa mensagem da conversa) e transcrição até 60k chars, com aviso de corte ao modelo. Quando a transcrição passa de 60k, o usuário também vê um aviso acima do composer ("This transcript is long: the AI only sees its first N% …", `mincerTruncationNotice`). A transcrição nunca é gravada na conversa.
- Limitação aceita: a janela Assistant (Ctrl+M) mostra essas conversas sem o contexto do Mincer.

## 8. Gravação

- WASAPI: loopback do dispositivo de saída padrão (estéreo) e microfone padrão (mono), capturados em float32 a 48 kHz e gravados em WAV **PCM 16-bit** (~1 GB/h) em `appData/mincer/recording/`, junto de `options.json` com as opções de resumo.
- Ao parar, os WAVs utilizáveis (> 1 KB) vão para a pasta do item e o item entra na fila; a mixagem (`amix`) roda dentro do job e é cancelável.
- Erros de cada faixa sobem para a UI ("System audio: …", "Microphone: …"); com erro de microfone, a tela sugere Windows Settings › Privacy & security › Microphone. Sem nenhuma faixa utilizável: "No audio was captured.".
- **Nível por faixa**: cada thread de captura guarda o pico do bloco num `AtomicU32` (bits de f32, `fetch_max`); a thread da gravação lê e zera os dois a cada 250 ms e emite `mincer://level {system, mic}` (mic `null` sem microfone), sem tocar no banco. A tela New mostra dois medidores (System, Mic; escala de -60 a 0 dB), o que expõe na hora uma faixa muda (ex.: loopback em silêncio).
- **Indicador fora da tela**: ponto vermelho + tempo no botão Mincer da Toolbar (§3).
- **Discard** (`mincer_record_discard`): para a gravação e apaga os WAVs e o `options.json`, sem criar item.
- **Parada automática** (Settings › Mincer, `monet:mincer-silence-stop-min` e `monet:mincer-max-record-hours`, enviados no `mincer_record_start` como `limits`). A thread da gravação avalia a cada leitura de nível (`AutoStopWatch` em `record.rs`):
  - **Silêncio** (padrão 10 min; Off desliga): conta como áudio um pico acima de ~-44 dBFS (`SILENCE_PEAK`) em qualquer faixa. Aviso nativo 5 min antes de parar (na metade, em prazos de até 10 min), rearmado quando o áudio volta. Ao atingir o prazo, para e enfileira com `keep_secs.txt` = último áudio + 30 s, e a mixagem corta o fim com `-t` (não se paga transcrição do silêncio). Sem nenhum áudio desde o início, descarta e avisa que nada foi salvo.
  - **Teto** (padrão 3 h; 1–8 h): aviso 5 min antes ("Mincer: recording stops in 5 min … open Mincer and click +30 min") e, ao atingir, para e enfileira inteiro. O botão **+30 min** na tela de gravação (`mincer_record_extend`) estende o teto da gravação em curso, quantas vezes for preciso; o teto fica num `AtomicU32` lido pela thread a cada leitura de nível, e cada extensão rearma o aviso de 5 min. `mincer_record_status` devolve as regras da gravação em curso (`silenceStopMinutes`, `maxMinutes` já com as extensões), que a tela mostra na linha de ajuda.
  - A parada roda numa task (`auto_stop`), nunca na própria thread da gravação (o `stop_handle` faz join dela), e confere o `started_at` para não encerrar uma gravação nova. Cada parada automática dá um toast "Mincer: recording stopped".
- **Parar de fora do Mincer**: item "Stop recording and process" no menu do tray (habilitado só durante a gravação; tooltip "Monet — Mincer recording since HH:MM — Ctrl+Alt+R stops") e atalho global **Ctrl+Alt+R**, registrado só enquanto grava (fora disso não rouba a combinação de outros apps). Os dois dão toast de confirmação, porque a janela costuma estar escondida. Discard não entra no tray (sem confirmação ali, seria fácil perder uma reunião). Botão, tray, atalho e parada automática passam pelo mesmo `stop_recording` em `mod.rs`.
- Depois da transcrição salva, o áudio (WAVs, MP3 mixado, pedaços) é apagado com a pasta do item; o Monet não guarda o áudio da gravação.
- Gravação perdida num crash é recuperada no boot seguinte e entra na fila.

## 9. Sidecars

- `ffmpeg` (build "essentials" 8.1.1 do gyan.dev, **GPLv3**) e `yt-dlp`, declarados em `bundle.externalBin` (`src-tauri/tauri.conf.json`; o `tauri.conf.dev.json` herda).
- **Fora do git, dentro do workspace**: `src-tauri/binaries/` está no `.gitignore`, mas os binários ficam nessa pasta do Monet (sem depender do projeto VOLP/Minuta). `npm run sidecars` (`scripts/fetch-sidecars.ps1`) confere os dois pelo SHA-256 fixado no script; `npm run sidecars -- -Source <pasta>` copia de outra pasta, também conferindo o hash. Sem eles, o `tauri-build` falha. Pendência no backlog: baixar das fontes oficiais.
- Resolvedor (`src-tauri/src/mincer/sidecar.rs`): `current_exe().parent()/<name>.exe` (onde o `tauri-build` copia em dev e o NSIS instala); fallback para `src-tauri/binaries/<name>-x86_64-pc-windows-msvc.exe` só em debug. Sem PATH, CapCut ou meetily. Ausente: "<name> was not found next to Monet. Reinstall the app (dev: run npm run sidecars).".

## 10. Fora de escopo / fase 2

- RAG das transcrições longas (pasta gerenciada da KB na pasta Mincer do Chat): passo seguinte ao aviso de transcrição cortada no Chat.
- Busca dentro da transcrição; duração e custo estimado antes do Start; aviso no Assistant para pastas do Mincer (ver backlog).
- Card no Calendar (I13).
- Legendas do YouTube antes do áudio.
- ffmpeg mínimo só de áudio (LGPL) e atualizador do yt-dlp (cópia em appData).
- Flag de build para esconder o YouTube no MSIX; mudanças no `build-msix.ps1` (microfone no AppxManifest, sidecars no staging).
- Clique no toast abrindo o item.
- Editar a transcrição.
