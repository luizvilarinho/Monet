# Review Report — R2: frontend de Chat, Assistant e RAG

- Task Report: `DOCS/reports/17-10-2026/taskreport_20261017235032.md`
- Plano: `DOCS/reports/18-10-2026/planreport_20261018001246.md`
- Execution Report: `DOCS/reports/18-10-2026/executionreport_20261018000019.md` (sessões E2–E4, E7 + ajuste do contexto efêmero, E11–E17, "Explorer — pastas de chat de cadernos" e o ajuste correspondente)
- Base do diff: `git diff develop` (mudanças não commitadas na `feature/rag-assistant`)

## Escopo revisado

- **Hooks:** `src/hooks/useChat.ts` (diff), `useNotesIndexSync.ts` (diff), `useStickToBottom.ts` (novo), `useRagDetailed.ts` (novo).
- **Lib:**
  - `src/lib/rag.ts`, `imageOcr.ts` e `assistantNoteBridge.ts` (novos);
  - `noteFileText.ts`, `documents.ts` e `librarian.ts` (diff).
- **ChatPanel:**
  - novos: `ChatComposer`, `ChatMessageBubble`, `MessageSources`, `RagInspector` e `RagSearchStatus` (com os `.module.css`);
  - diff: `ChatPanel`, `ChatSidebar`, `ChatToolsMenu`, `FolderDocumentSelectorModal` e `SaveToNoteModal`.
- **Outros componentes (diff):** `AssistantPanel` (tsx e css), `NotesChatPanel`, `notesContext.ts`, `ReaderChatPanel`, `KnowledgeBaseModal`, `DocumentsModal` e `SettingsModal`.
- **Tipos:** `src/types/index.ts`.
- **Consultado sem revisar (R3):** `src/App.tsx`, no handler `onAssistantNoteRequest` e nas chamadas a `deleteNotebookChatFolder`/`moveNotebookChatFolder`.

**Verificações:**
- `npx tsc --noEmit` passou (exit 0).
- Script de classes CSS: nenhuma classe órfã ou faltando em `AssistantPanel`, `ChatPanel`, `ChatComposer`, `ChatMessageBubble`, `MessageSources`, `RagInspector`, `RagSearchStatus`, `FolderDocumentSelectorModal` e `KnowledgeBaseModal`.
- O app não foi aberto.

## Veredicto

**APROVADO COM RESSALVAS.** A arquitetura está correta: o `folderId` é atômico na materialização, as pastas são gravadas antes das conversas, as fontes são compactas e o trace fica só em memória. Faltam corrigir antes do merge:
- um caso de borda do seletor de pasta do Assistant, que gera uma conversa solta;
- uma instrução contraditória ao modelo, quando as tools de notas acham conteúdo e o RAG automático não achou;
- uma janela em que o Stop não cancela o turno;
- a duplicação que sobrou entre `AssistantPanel` e `ChatPanel`.

---

## Achados

### [crítico]

Nenhum.

### [importante]

**I1. Assistant: depois de apagar na main a pasta escolhida, a próxima mensagem vira uma conversa solta**
- **Onde:**
  - `src/components/AssistantPanel/AssistantPanel.tsx:206-213` (efeito "pasta escolhida apagada");
  - `src/hooks/useChat.ts:1518-1529` (fallback do `activeId`) e `:2436-2442` (`send()` sem conversa ativa).
- **O que acontece:**
  1. O `deleteFolder` da main agora grava `FOLDERS_KEY` **antes** de `CONVERSATIONS_KEY`. Isso está certo para o eco, mas a assistant recebe primeiro a lista de pastas sem a pasta X.
  2. O efeito do `AssistantPanel` roda nesse momento: volta o seletor ao padrão e só abre um rascunho novo se a conversa ativa já tiver sumido. Ela ainda está em `conversations`, porque o evento das conversas chega depois. Então nenhum rascunho é criado.
  3. Quando o evento das conversas chega, a conversa some. O fallback do `useChat` (instância detached) deixa o `activeId` em `null`, e o efeito do painel não roda de novo, porque `chosenFolderId` já é `null`.
  4. Na próxima mensagem, o `send()` cai em `else if (!convId)`: `makeNewConversation()` e `setLooseOrder`. A conversa nasce **solta** (`folderId: null`), fora da `assistant`.
- **Impacto:** viola o edge case do Task Report ("pasta excluída na janela principal… voltar ao padrão") e reintroduz o sintoma de "chat fora da pasta" de que o Coordenador pediu para fugir. O mesmo acontece, num caso que já existia antes desta branch, quando a conversa exibida no Assistant é apagada na main.
- **Sugestão (uma das duas):**
  - **(a)** No `AssistantPanel`, um efeito que reabre o rascunho sempre que a instância fica sem conversa: `if (!activeId) startAssistantConversation(folderIdRef.current)`. Isso cobre os dois casos e não grava nada.
  - **(b)** No `send()`, no modo `assistant` e sem `convId`, materializar na pasta dedicada (o mesmo caminho do rascunho), em vez de criar a conversa solta.

**I2. As tools de notas achando conteúdo não tiram o aviso "nada relevante" do RAG automático**
- **Onde:** `src/hooks/useChat.ts:3239`, com o `kbFound` de `:3050`.
- **O que acontece:**
  - O aviso `ragNothingFoundMessage` ("Tell the user you did not find it in their documents instead of guessing") só sai da 2ª rodada quando `search_knowledge_base` acha trechos (`kbFound`).
  - Se quem achou foi `get_day`/`notes_by_date`, o modelo recebe ao mesmo tempo "não achei nada, diga isso" e "Answer from these notes only… Cite them as [n]".
  - Ao mesmo tempo, `:3227-3232` limpa `ragNothingFound` da mensagem, porque `sources.length > 0`. A UI mostra "Sources (n)", mas o modelo pode responder que não encontrou.
- **Sugestão:** trocar o critério por "as tools acrescentaram fontes", por exemplo `const toolFound = sources.length > turnRagSources.length`, e usá-lo nos dois pontos: na exclusão da mensagem e no `ragNothingFound: undefined`. Assim o `kbFound` deixa de ser necessário.

**I3. O Stop entre a checagem pós-RAG e o início do stream é ignorado**
- **Onde:** a checagem do cancelamento está em `src/hooks/useChat.ts:2802`. Depois dela ainda vêm dois `await`:
  - `hasTavilyKey()` (`:2866`);
  - `getTasksSnapshotRef.current()` (`:2919`). No Assistant, esse loader faz N+1 consultas SQL (`AssistantPanel.tsx:43-59`, uma `getNote` por task com nota-corpo).
- **O que acontece:**
  - Um Stop nesse intervalo só marca `toolCancelledRef`, porque ainda não há stream, e o stream começa assim mesmo.
  - Se o modelo chamar uma tool, o handler vê `toolCancelledRef` (`:3201`) e retorna sem zerar `isStreaming`/`activeStreamRef`. O turno fica com o placeholder vazio até um novo Stop.
- **Sugestão:**
  - mover (ou repetir) o bloco de cancelamento de `:2802` para logo antes do `startOpenRouterStreamMessages` (`:3277`);
  - no Assistant, ler o checklist só na chamada da tool. O enum precisa só dos `statuses`, então dá para carregar só as tasks e os status por envio.

**I4. Duplicação que sobrou entre `AssistantPanel` e `ChatPanel` depois da extração (E4/E15)**
- **Onde:** o mesmo código está nos dois arquivos:

  | Trecho | `AssistantPanel.tsx` | `ChatPanel.tsx` |
  |---|---|---|
  | Efeito de modelo padrão | `:227-235` | `:131-141` |
  | 2 efeitos de toast (memória e fontes web) | `:241-253` | `:171-183` |
  | `streamingMessageId` | `:266-272` | `:145-154` |
  | Markup do botão "voltar ao fim" | `:397-408` | `:275-286` |

  O CSS `.scrollBtn` também está repetido nos dois `.module.css`.
- **Por quê:** a restrição do Task Report é explícita ("Código morto sai na revisão, incluindo o que ficar duplicado entre `AssistantPanel` e `ChatPanel` depois da extração"). O codeAgent da E15 registrou isso como pendente.
- **Sugestão:**
  - um componente `ScrollToBottomButton` em `ChatPanel/`, com o seu CSS;
  - um hook pequeno (ex.: `useChatPanelState(models, {model, setModel, messages, isStreaming, folderMemoryUpdatedAt, webSourcesSaved})`) que devolva `selectedModel`, `streamingMessageId`, `memoryToastVisible` e `webSourcesToast`.

  O `NotesChatPanel` e o `ReaderChatPanel` podem adotar depois.

### [nit]

**N1. Ponte de notas sem restrição de origem** (`src/lib/assistantNoteBridge.ts:42` e `:93`)
- A main escuta `assistant-note-request` com o `listen` global (alvo *Any*), então um `emit` global de qualquer janela também é atendido. A assistant também escuta a resposta com o `listen` global. O payload não é validado: um `kind` desconhecido cai no ramo `append`.
- **Risco real baixo:** as 3 janelas (`main`, `assistant`, `keep`) têm a mesma capability, inclusive `sql:allow-execute`. Quem conseguisse emitir já gravaria direto no banco.
- **Sugestão:**
  - escutar pela janela: `getCurrentWebviewWindow().listen(...)`, que só recebe eventos dirigidos a ela;
  - validar o pedido (`kind` conhecido e campos `string`) antes de `handle`.

**N2. Timeout da ponte e "Try again" duplicam o bloco** (`assistantNoteBridge.ts:36-62`)
- Se a main responder depois de 10 s, a gravação acontece, e o "Try again" grava de novo, porque cada tentativa usa um `requestId` novo.
- **Sugestão:** manter o `requestId` entre as tentativas do mesmo clique e guardar na main um `Set` dos ids já atendidos (devolvendo o resultado anterior).

**N3. `openRagSource` abre a `url` da fonte sem checar o esquema** (`src/lib/rag.ts:255-256`)
- A `url` vem da linha `Source:` do cabeçalho de qualquer arquivo que comece com `# título / Source: / Retrieved:`, não só das páginas web salvas pelo bibliotecário (`rag.rs:627-640`).
- O escopo padrão do `opener:default` já barra esquemas fora de http(s)/mailto/tel.
- **Sugestão:** por defesa em profundidade e coerência com a bubble (`href.startsWith('http')`), abrir só `^https?://`.

**N4. "continue" pode renumerar as citações** (`src/hooks/useChat.ts:2745-2756`)
- O `reuse` remonta o contexto só com os rowids. As fontes de nota das tools têm `rowids: []`, e documentos apagados somem. Com isso, a numeração `[n]` do turno novo pode deslocar em relação à resposta anterior, que está no histórico (ex.: `[2]` vira `[1]`).
- O reuse também ignora mudanças de escopo feitas depois: um documento desmarcado na pasta volta no "continue".
- **Sugestão:** no reuse, preservar o `n` original, passando as fontes anteriores como semente para o `citeSource`, e filtrar os chunks pelo escopo atual.

**N5. `folderConversationIds` trata a lista de ordem como fonte de pertencimento** (`src/hooks/useChat.ts:697-705`)
- Uma conversa listada em `folder.conversationIds` mas com `folderId` de **outra** pasta (lista defasada, possível no caminho direto do localStorage, sem reconciliação) seria apagada ou movida junto.
- Isso contradiz a regra "`folderId` é a fonte de verdade".
- **Sugestão:** da lista de ordem, aceitar só as conversas com `folderId` `undefined` (legado) ou apontando para pasta inexistente.

**N6. `useRagDetailed` relê a chave em todo evento `storage`** (`src/hooks/useRagDetailed.ts:23`)
- Cada `MessageSources` e cada `ChatToolsMenu` montado reage a toda gravação de chat da outra janela, uma por chunk de streaming.
- **Sugestão:** filtrar `e.key === RAG_DETAILED_KEY` (e usar `e.newValue`).

**N7. "Sources (n)" aparece abaixo de uma resposta "Error: …"** (`ChatMessageBubble.tsx:165`)
- As `ragSources` são gravadas antes do stream e ficam se ele falhar.
- Manter os rowids é útil para o "tenta de novo". Esconder a lista nas mensagens de erro (`isErrorMessage`) evita sugerir que houve resposta baseada nelas.

**N8. Três normalizadores de texto equivalentes**
- `foldText` (`useChat.ts:1198`), `normalizeForGate` (`rag.ts:148`) e `normalizeName` (`tasks.ts`, agora importado por `lib/documents.ts`, que passou a depender de `lib/tasks`).
- **Sugestão:** um único utilitário (ex.: `lib/text.ts`).

**N9. `useChat.ts` cresceu para 3.414 linhas**
- `notesByDateText`, as definições das tools novas e o registro `mountedChats` poderiam ir para módulos em `lib/` (ex.: `lib/chatTools.ts`).
- Não é bloqueante. Facilita a passada final e a próxima revisão.

**N10. OCR antes do envio sem feedback** (`NotesChatPanel.tsx`, `handleSend`, e `useChat.ts` `notesByDateText`)
- Imagens ainda sem cache passam pelo OCR em série antes de a mensagem aparecer, sem indicador.
- Normalmente o `useNotesIndexSync` já preencheu o cache. Se o roteiro de teste mostrar atraso, mostrar o `RagSearchStatus` ou um "Reading images…".

**N11. Órfãs do KB calculadas a cada render** (`KnowledgeBaseModal.tsx`, `listChatFolderIds()` no corpo do componente)
- O modal fica sempre montado.
- Se o JSON de pastas falhar no `parseFolders` (que devolve `[]`), **todas** as pastas web aparecem como "Orphan", e o botão oferece apagá-las.
- **Sugestão:** `useMemo` e não marcar órfãs quando a leitura vier vazia por erro de parse.

---

## Pontos verificados sem problema

- **`folderId` atômico no seletor de pasta (E14):**
  - o seletor nunca chama `setFolders`/`setConversations`;
  - a chave `monet:assistant-folder-id` fica fora das 3 chaves hidratadas pelo handler de `storage`;
  - a materialização usa `draft.folderId` só se a pasta existir em `foldersRef` e grava a conversa já com o `folderId`;
  - o caminho do eco (`mergeRemoteConversations`, `lastKnownValues`) não foi tocado.
- **Pastas antes das conversas (`deleteFolder`, `mergeFolderInto`, `deleteChatFolderById`):**
  - a análise do eco confere. Na ordem nova, a assistant oculta recebe a lista sem a pasta e não a ressuscita: o reconcile só mexe na ordem solta, que converge;
  - na fusão, a outra janela re-adota as conversas para o destino, nunca para `null`.
- **`mountedChats`:**
  - registro e remoção no efeito de mount;
  - `cancelIfStreamingIn` usa os valores do render corrente;
  - sem instância montada, o localStorage é editado direto, na mesma ordem.
- **Gating (`rag.ts:130-168`):**
  - listas e regex batem com o plano;
  - "valeu" e "👍" dão `skip`, "continue" dá `reuse`, "mais detalhes" dá `search`.
  - o reuse cai para `search` sem fontes ou com rowids que sumiram;
  - `rag_get_chunks` preserva a ordem pedida (teste `get_chunks_keeps_requested_order`).
- **Numeração `[n]` entre RAG automático e tools:** a cópia de `turnRagSources` e o `citeSource` mantêm o número de um documento já citado e continuam a sequência.
- **Cota do localStorage:**
  - `RagSource` sem conteúdo dos trechos;
  - `ragTraces` só em memória e só com o modo detalhado;
  - `imageDataUrl` continua fora da gravação.
- **Stop durante a busca:**
  - `cancel()` sem stream não zera `isStreaming`, então não abre corrida com um `send()` novo;
  - a checagem pós-RAG descarta o placeholder.
- **XSS:**
  - o markdown passa por `rehype-sanitize` (`lib/markdown.ts`);
  - fontes e inspetor renderizam texto puro via React (títulos, `title=` com trecho);
  - links da bubble só abrem `http*`.
- **Tese do produto:**
  - nenhuma tool ou envio grava em nota;
  - o "Save to note" do Assistant só dispara pelo clique no modal;
  - o OCR só alimenta o texto do índice e o contexto efêmero.
- **Strings de UI em inglês** em todos os componentes novos e alterados (comentários em português seguem o padrão do projeto).
- **E4/E15, sem regressão de comportamento:**
  - `ChatComposer`, `ChatMessageBubble` e `useStickToBottom` reproduzem a lógica anterior do `ChatPanel`;
  - o `canSend` com `!!selectedModel` é equivalente na prática;
  - a limpeza do rascunho do Assistant ao trocar de conversa é mudança documentada.

## Bugs extras (fora do escopo, no código lido)

- **Já existia antes desta branch:** apagar na main a conversa exibida no Assistant leva ao mesmo caminho do I1 (`activeId` null → próxima mensagem solta). A correção (a) do I1 resolve os dois.
- **`/docs`** (`App.tsx`) continua no caminho antigo (`resolveSearchableIds` + `embedText` + `documentsSearchByIds`, top 5 KNN). Ele não ganha a busca híbrida, o rerank nem os cabeçalhos com citação. O plano não incluía, mas é a única chamada que mantém esses wrappers vivos.
