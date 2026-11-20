# Review Report: Fase B — Fatia 7 (Library e Reader) e Fatia 8 (Mincer, Knowledge Base, Docs, Settings)

- Task Report: `DOCS/reports/19-11-2026/taskreport_20261119214343.md` (Fase B)
- Triagem: `DOCS/reports/19-11-2026/uxtriage_20261119224845.md` (seções Fatia 7 e Fatia 8, mais o IA-08 da Fatia 6 e a parte de modal do T1)
- Relatórios UX: `uxreport_20261119224432_reader.md` e `uxreport_20261119224705_mincer-config.md`
- Spec: `DOCS/specs/mincer.md`
- Execution Report: `DOCS/reports/19-11-2026/executionreport_20261119214343.md`, sessões "(Fase B, Fatia 7)" e "(Fase B, Fatia 8)"
- Branch: `fix/divida-tecnica`, sem commit. O diff contra HEAD mistura a Fase A (revisada em `reviewreport_20261119225102.md`); aqui só entra a Fase B destas duas fatias.

## Veredito
**APROVADO COM RESSALVAS**

As duas fatias fazem o que a triagem aceitou, e os comandos Rust novos estão corretos: não seguram lock longo no `monet.db`, não travam a thread async e não devolvem a chave ao frontend. Não há bloqueio. Ficam 6 achados menores para o Orquestrador decidir, e o mais visível é a toolbar de seleção que pode sair da tela (achado 1).

## O que foi conferido
- Li o diff inteiro dos arquivos listados nas duas sessões e os 3 arquivos novos (`ReaderToast.tsx`, `toolbarPlacement.ts` e o CSS do toast). Também li os chamadores e as dependências que cruzam as fatias:
  - `useConfirm` e `ConfirmModal` (fatia 1);
  - `SaveToNoteModal` e `ChatMessageBubble` (fatia 5);
  - `countChatFolderConversations` no `useChat`;
  - `with_doc_db`, `documents_upload_global` e `documents_add_watched_folder`;
  - `jobs::delete`, `db::next_queued` e o `storage.deleteBook`;
  - o `Editor` na aba Notes do leitor.
- O ajuste do Orquestrador no `Library.tsx` está certo. A contagem usa `countReaderBookChatConversations`, e a função local antiga sumiu.
- Rodei de novo:
  - `npx tsc --noEmit`: limpo;
  - `npm test`: 8 arquivos e 87 testes passaram.
- Não rodei `cargo test` nem `cargo check`. O motivo é a memória do projeto: um exe gerado em `target` a partir do sandbox herda o rótulo de integridade Baixo e quebra o app de dev com "readonly database". O codeAgent registrou `cargo check` limpo e `cargo test` com 75 passed e 3 ignored.
- As classes CSS usadas em todos os componentes das duas fatias existem nos módulos. Não sobrou referência a `copyCitationAbout`, `pickDocumentFile`, `saveToast`, `DEFAULT_HIGHLIGHT_COLOR` ou `handleArrowKey`.

## Pontos de atenção do Orquestrador

### Comandos Rust novos
- **`openrouter_key_info`** (`lib.rs:295`):
  - é `async` e usa o `http_client()` (timeout de 60 s);
  - devolve só `last4`, `ok`, `limitRemaining` e a frase de erro, sem a chave;
  - o `limit_remaining` ausente vira `None` (serde, `Option`), e um 401/403/402/429/5xx vira frase legível;
  - correto.
- **`documents_list_visibility`** (`documents.rs:1869`):
  - é um SELECT curto pelo `with_doc_db`, só leitura em WAL, então não pega o lock de escrita;
  - roda síncrono na thread async, como todos os comandos de documentos (padrão do projeto);
  - linhas de caderno ou documento apagado são filtradas no front (`usedInIds`);
  - correto.
- **`documents_pick_files`**: usa `spawn_blocking` com o `rfd`, e o cancelamento devolve vazio. O `documents_pick_file` saiu do handler e do front sem deixar resto. Correto.
- **`mincer_record_set_title`**: segura o mutex da gravação só para trocar o campo. O `stop_recording` tira o handle e calcula o título antes do `spawn_blocking`, e um set depois do stop volta "No recording in progress", que o front ignora. Correto.
- **`mincer_record_devices`**: o COM roda numa thread própria dentro do `spawn_blocking`, e usa o mesmo `get_default_device` da captura, então o nome mostrado é o do dispositivo que vai gravar. Correto.
- **Locks:** o `status` toma o mutex do estado e depois os mutexes dos nomes. As threads de captura tomam só o do nome, uma vez, então não há inversão.
- **Tray e atalhos:** o registro de Ctrl+M e Ctrl+K subiu para antes do tray. As janelas `keep` e `assistant` vêm do `tauri.conf.json` e já existem no `setup`. O rótulo só mostra a tecla quando o registro deu certo, e os itens do menu chamam os mesmos `toggle_*` do atalho.

### Knowledge Base
- **Coluna "Used in":**
  - o popover usa portal com z-index 1100, acima do overlay de 1000;
  - Esc e clique fora fecham o popover, e rolar o corpo do modal também;
  - na pasta de notas, o caderno dono aparece marcado e travado.
  - O estado otimista volta na falha, e o `NOTEBOOK_VISIBILITY_CHANGED_EVENT` relê a tabela. O `useChat` e o `useNotebookVisibility` também escutam esse evento, então o chat do caderno se atualiza.
- **Ligar ao caderno ativo depois do upload:**
  - `upload` e `addFolder` devolvem o id, e cada upload cria um uuid novo (sem dedupe), então o Undo nunca desliga um vínculo que já existia;
  - sem caderno ativo ("All notes"), o aviso aponta para a coluna;
  - ver o achado 5 para o caso de vários arquivos.
- **Confirmações:**
  - o invólucro do `confirm` resolve como cancel ao fechar o modal;
  - o `ConfirmModal` captura o Esc no window com `stopImmediatePropagation`, então a guarda `confirmOpen` do pai é redundante, mas inofensiva;
  - os rótulos por consequência (K2) estão certos, e o `destructive` padrão do `ConfirmModal` (true) põe o foco no Cancel.

### Mincer
- **Título opcional:**
  - vai no Start e no `set_title` com debounce, e o Stop da tela grava o último antes de parar;
  - o shutdown e o tray usam o `handle_title`, e o boot usa a hora de criação dos WAVs;
  - o padrão "Recording AAAA-MM-DD HH:MM" é igual no Rust e no placeholder;
  - o `maxLength` é 200 nos dois lados.
  - Ver os achados 3 e 4.
- **Needs attention:**
  - o `mark_running_interrupted` grava `unseen = 1`, e o `insert_recovered` também;
  - o `attentionCount` conta os `interrupted` não abertos;
  - o `mincer://changed` sai ao fim do `on_startup`, e o hook relê a lista depois de registrar os listeners, o que cobre a corrida do boot.
- **Posição na fila:** o front ordena por `queued_at` e o worker também (`ORDER BY queued_at ASC`). O `requeue_front` mantém o `queued_at` original, então as duas ordens batem.
- **Teto de 6 h:**
  - o Settings oferece 1, 2, 3, 4 e 6 h, e mostra um valor salvo fora das opções (ex.: 5 h);
  - o `getMaxRecordHours` limita 0 e 8 a 6;
  - o Rust limita o `start` e o `extend`;
  - o "+30 min" fica desabilitado em 360 min, e o aviso de 5 min não sugere "+30 min" no máximo.
  - O nit do "+30 min" da revisão da Fase A está resolvido.
- **Preset por aba, drop com item aberto, linha "Recording", Copy, "Save to another folder…" e linha de modelos por aba:** corretos.

### Reader
- **Toasts:**
  - um `ReaderToast` único nos dois leitores e no chat, que fica 6 s quando tem ações;
  - o Undo tira a última ocorrência do bloco da versão atual da nota e avisa quando a nota foi editada;
  - o `Editor` da aba Notes recebe o conteúdo novo pelo `setContent` sem `emitUpdate`, então o bloco anexado não é sobrescrito.
- **Toolbar de seleção:** medida no `useLayoutEffect` e presa às laterais e ao topo visível. Falta o limite de baixo (achado 1).
- **Reuso do `SaveToNoteModal` (fatia 5):**
  - as props batem (o `onCreateNotebook` com um parâmetro a menos é compatível);
  - o modal tem `aria-modal="true"`, então o Ctrl+F do leitor não rouba o foco do campo de busca dele;
  - o "Go to note" vincula a nota ao livro, o mesmo modelo da aba Notes (escolher uma nota lá também vincula).
- **Teclado:**
  - Ctrl+F fica na captura e respeita `[data-note-editor]` e os modais;
  - H e Esc funcionam também dentro do iframe do EPUB;
  - o Library só monta no modo Library, então nenhum desses atalhos vaza para outros modos.
- **Grifos:** o rollback do `useHighlights` volta a cor anterior ou tira o grifo novo, e o EPUB redesenha pelo estado (`drawnRef`), sem grifo fantasma.
- **E1 (EPUB):** o `getEpubRangeText` com CFI de ponto gera um range colapsado em cada ponta, na mesma seção carregada. Se as pontas estão em seções diferentes, cai na location.

### Settings
- **S1:** a verificação roda ao abrir a seção e a cada save (`keyCheckNonce`), com cancelamento no cleanup.
- **S2:** confirmação em linha para remover as duas chaves, e Enter salva a da OpenRouter (o Tavily já salvava).
- **S5:** a seção Knowledge Base recebeu o modelo de reescrita, que saiu da seção OpenRouter.
- **S6 e S7:** corretos.

## Achados

### [crítico]
Nenhum.

### [importante]
Nenhum.

### [menor] 1. A toolbar de seleção pode ficar abaixo da área visível
**Onde:** `src/components/Reader/toolbarPlacement.ts:29`, chamado em `Reader.tsx:1625` e `EpubReader.tsx:1063`.

**Cenário:** no PDF com zoom, o usuário arrasta para selecionar um trecho longo, e a página rola sozinha. A seleção começa acima do topo visível, então o "acima" não cabe. A toolbar vai para `anchor.y + anchor.h + 8`, logo depois do fim da seleção, que está colado na borda de baixo. Ela fica fora da tela até o usuário rolar. A triagem (P6) pede a toolbar "sempre dentro da parte visível", e o Execution Report afirma isso, mas o `PlacementBounds` não tem `bottom`.

**Correção:** passar `bottom` nos bounds (no PDF, `areaRect.top - wrapRect.top + area.clientHeight`; no EPUB, `area.clientHeight`). Depois limitar o `top` a `[bounds.top + 8, bounds.bottom - altura - 8]`, que cobre o caso em que nem acima nem abaixo cabem. É uma função pura, e um teste no vitest cobre o caso.

### [menor] 2. O balão do chat do Reader não segue o contrato novo da fatia 5
**Onde:** `src/components/Reader/ReaderChatPanel.tsx:688-694` (`isStreamingPlaceholder` e `canSaveToNote`).

**Cenários:**
- O usuário pergunta no Reader e sai do modo Library antes do 1º token. O turno é cancelado ao desmontar, como é proposital desde a Fase A. Ao voltar, a resposta vazia mostra os três pontinhos para sempre. No chat principal, a fatia 5 já mostra "No response (interrupted)" nesse caso.
- O C1 detecta erro pelo prefixo `Error:`. A fatia 5 passou a marcar o erro com a flag `message.failed`, e o `ChatMessageBubble` usa a flag. Uma resposta legítima que começa com "Error:" (explicando um log, por exemplo) perde o "Save to note" e o Copy no Reader.

Os pontinhos já existiam antes da Fase B, mas o C1 pedia o mesmo padrão do `ChatMessageBubble`, e a costura com a fatia 5 ficou pela metade.

**Correção:**
- `isStreamingPlaceholder = !isUser && message.content.length === 0 && isStreaming`;
- resposta vazia e parada mostra "No response (interrupted)";
- o `canSaveToNote` usa `!message.failed` no lugar do prefixo.

### [menor] 3. O nome dos dispositivos vira "not found" logo depois do Start
**Onde:** `src/components/Mincer/MincerNew.tsx:306` (`setDevices(s.devices)`), alimentado por `src-tauri/src/mincer/record.rs:227`.

**Cenário:** antes do Start, a linha mostra "System: Speakers (Realtek) · Mic: Headset". O 1º `mincer_record_status` roda na hora em que `job.recording` vira true, quando as threads de captura ainda não abriram os dispositivos. Os slots estão `None`, e a linha passa a "System: no output device found · Mic: no microphone found" por até 2 s, até o próximo poll. Justo na hora em que o usuário confere se vai gravar do lugar certo, a tela diz que não há dispositivo.

**Correção:** basta uma das opções:
- no front, não trocar um nome conhecido por `null` nos primeiros segundos da gravação;
- no Rust, distinguir "ainda abrindo" de "falhou", por exemplo com um `opened: bool` por faixa no status.

### [menor] 4. O título digitado nos últimos 300 ms se perde quando a tela desmonta
**Onde:** `src/components/Mincer/MincerNew.tsx:218-225`.

**Cenário:** durante a gravação, o usuário termina de digitar o título e logo troca de modo, ou clica na linha "Recording" do histórico, que remonta a tela pela `key`. O cleanup do efeito só limpa o timer, então o último trecho não chega ao Rust. Ao remontar, o campo lê do status o título antigo, e o item nasce com ele.

**Correção:** no cleanup, se havia timer pendente e a gravação segue, chamar `mincerRecordSetTitle(recordTitle)` na hora (flush), em vez de só cancelar.

### [menor] 5. Vários arquivos: uma falha no meio deixa o aviso "Use it in" errado
**Onde:** `src/components/KnowledgeBaseModal/KnowledgeBaseModal.tsx:413-437` (`offerActiveNotebook` e `toggleAddedNotice`).

**Cenário:** o usuário adiciona 3 arquivos com um caderno aberto, e a 2ª gravação de visibilidade falha (banco ocupado além do `busy_timeout`). O 1º arquivo fica ligado, os outros não, e o aviso mostra a caixa desmarcada para todos. O mesmo vale para desmarcar a caixa. Como o laço para na 1ª falha, o estado real fica misto e o aviso diz outra coisa.

**Correção:** seguir com os demais ids, juntar os erros e, no fim, reler a tabela (`loadVisibility`). A caixa passa a refletir "todos ligados", e o erro diz quais arquivos falharam.

### [menor] 6. O "Open Settings" da KB não relê os cadernos com documentos
**Onde:** `src/App.tsx:4888`.

**Cenário:** o `onClose` da KB chama `refreshNotebooksWithDocs()`, mas o `onOpenSettings` fecha a KB com `setKbOpen(false)` direto. Se o usuário ligou documentos a cadernos e depois clicou "Open Settings" no banner sem chave, o ícone de documentos na coluna de cadernos fica defasado até a próxima abertura e fechamento de um dos modais.

**Correção:** chamar o mesmo `void refreshNotebooksWithDocs()` no `onOpenSettings`.

### Observação (sem severidade, raro)
O "Fit width" (`Reader.tsx:1101-1121`) recalcula o zoom pelo `ResizeObserver` da `.pageArea`. A barra de rolagem vertical que aparece ou some muda a largura útil. Numa página cujo alto em fit width fica perto do alto da área (página paisagem), o zoom pode alternar entre dois valores. O arredondamento para baixo em centésimos torna isso raro. Se aparecer no teste manual, `scrollbar-gutter: stable` na `.pageArea` resolve sem código.

## Divergências entre a triagem e o que foi feito
Todas registradas no Execution Report com motivo, e nenhuma pede volta:
- **E4:** a toolbar mostra o nome do capítulo, não "Ch. 3". A regra do `epubCitationLabel` é não inventar número de capítulo.
- **H2:** Open e Undo só no caminho direto (nota vinculada). No caminho do modal, o toast continua simples.
- **K1:** o "Used in" conta só cadernos, porque as pastas de chat moram no localStorage do `useChat`.
- **M5:** a Toolbar mostra a atenção só no title, como combinado.
- **P6:** só a toolbar de seleção ganhou o posicionamento novo, e falta o limite de baixo (achado 1).

## Avaliação por fatia

### Fatia 7 — Library e Reader
- **Correção:**
  - os itens L1–L6, P1–P4, P6, P7, E1, E3, E4, H1, H2, H5, H7, H8, C1–C5, N1, G1, G2 e a borda "Remove from Library" fazem o que a triagem pede;
  - a contagem do L1 bate com o que o `deleteBook` apaga (grifos e `book_quotes`) e com a pasta de chat removida;
  - o "Remove from Library" com arquivo ausente funciona, porque o `books_delete_file` aceita o arquivo inexistente.
- **Simplicidade:** o `ReaderToast` e o `placeSelectionToolbar` tiraram a duplicação entre PDF e EPUB. O `announceAppendedBlock` serve à citação e à resposta do chat.
- **Efeitos colaterais:** nenhum fora do recorte. O `Editor` da aba Notes recebe o bloco anexado sem regravar.
- **Padrões:** Phosphor, Sentence case e `{ __html }` memoizado. Ver o achado 2 para o contrato da fatia 5.

### Fatia 8 — Mincer, conhecimento e configurações
- **Correção:** os itens T1–T3, M1, M2 (Copy), M4–M6, M8–M13, K1–K3, K5–K7, D1–D4, S1–S3, S5–S7, as bordas e o IA-08 do tray estão implementados. A spec do Mincer acompanha o código.
- **Segurança:** a chave da OpenRouter não volta ao front. O `openrouter_key_info` só fala com `openrouter.ai`.
- **Efeitos colaterais:** a subida do registro dos atalhos não muda o comportamento.
- **Padrões:** sem BEGIN/COMMIT manual, z-index 1100 no popover, Phosphor, e rótulo escrito nas ações destrutivas.

## Bugs extras (fora do escopo, não entram no veredito)
- **Item apagado do Mincer pode voltar como "Recovered recording".** Fica em `src-tauri/src/mincer/jobs.rs:333-335` (`delete`), somado ao `orphan_action` da Fase A.
  - O `delete` apaga a linha antes da pasta e ignora a falha do `remove_dir_all`. Isso acontece com um arquivo ainda preso logo depois do Cancel, ou com um crash entre os dois passos.
  - A pasta que sobra com `audio.mp3`, um WAV ou um `chunk_000.mp3` volta no boot como item `interrupted`. Ela ganha o título "Recovered recording <data>", o kind `record` (mesmo que fosse um arquivo ou um YouTube) e o "Needs attention" desta fase.
  - Um item que o usuário apagou reaparece pedindo atenção, e o Resume paga a transcrição de novo.
  - **Correção:** apagar a pasta antes da linha. Se a remoção falhar, renomear a pasta para um nome fora do padrão UUID (`<id>.deleted`), que o `orphan_action` não recupera.
