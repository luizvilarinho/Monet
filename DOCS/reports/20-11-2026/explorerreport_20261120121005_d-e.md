# Explorer Report — Fases D e E (Radar, `/since`, Papers)

Task: `DOCS/reports/20-11-2026/taskreport_20261120115512.md` · Branch `feat/radar-trackers` · Só leitura.

## Problema
Dois agentes novos no Chat (Radar e Papers) com pipeline próprio (busca web com data, Crossref, Unpaywall), um slash `/since`, ações por item na resposta (Open, Send to Mincer, Add to KB, Add to reading list, Open in Library) e uma data durável da última consulta por escopo.

## Dificuldade
**Alta** no conjunto. O `/since`, o Crossref e a nota Paper são de dificuldade média. O custo está em três pontos: (1) o agente de chat de hoje não tem onde rodar um pipeline com teto, Stop e "commit no fim"; (2) as ações por item passam por **duas** implementações de balão e pela ponte da janela assistant; (3) o "Open in Library" pede comando Rust novo e um jeito de abrir um livro de fora da Library.

## Pontos que pedem decisão de escopo (destaque)

1. **Crossref não cobre bem os "fundamentais" de computação/IA.** Testado ao vivo: `api.crossref.org/works/10.48550/arXiv.1706.03762` dá **404**, porque os DOIs do arXiv são do DataCite, não do Crossref. A busca `query.bibliographic=attention is all you need transformer` não traz o artigo no top 5. Os anais do NeurIPS e de outras conferências da área quase não têm DOI Crossref. Em temas de ML, o E2 (fundamentais e recentes) sai fraco ou vazio, e o Coordenador deixou OpenAlex, Semantic Scholar e arXiv fora de escopo. **Sugestão:** manter o Crossref e dizer no `radar.md` que a cobertura depende da área. Outra saída é abrir a exceção do OpenAlex (gratuito, cobre arXiv, tem `cited_by_count`). A decisão é do Coordenador.
2. **Ordenar por citações no Crossref descarta a relevância.** Testado: `query.bibliographic=graph neural networks&sort=is-referenced-by-count&order=desc` traz em 1º lugar "3D Gaussian Splatting…", que não tem relação com a busca. O `sort` vale para todo o conjunto que casou. **Ajuste no requisito E2:** a passada dos fundamentais busca por relevância (padrão, `rows` 30 a 40, `select` com `score` e `is-referenced-by-count`), e o app reordena localmente por citações entre os mais relevantes. Não usar `sort=is-referenced-by-count` junto com `query`.
3. **"Web search ligado" (D1) não cabe na política atual.** Em `ChatAgentDef.context.web`, `true` quer dizer "segue o toggle do usuário" (`useChat.ts:3499`): com o toggle desligado, o Radar ficaria sem web. Com o toggle ligado, o modelo ganha a tool `web_search` (`useChat.ts:4095-4103`, até 3 queries por chamada, sem teto por turno), e isso fura o limite de 6 buscas do D6. **Recomendação:** o Radar e o Papers rodam o pipeline do app dentro do `buildContext` e usam `context: { rag: false, web: false, deepResearch: false }`, com um campo novo no `ChatAgentDef` (ex.: `webPipeline: true`) para que o composer exija a chave do Tavily (`ChatComposer.tsx:121-122`) e o menu de tools não mostre "web desligada pelo agente" (`ChatToolsMenu.tsx:81`). Para o usuário, o efeito é o pedido: web sempre, RAG e deep research nunca.
4. **"Add to KB" pode gravar sem que o chat leia.** A KB da IA da pasta é a pasta `origin='ai'` ("Save web sources — X", `documents.rs:1996-2044`). O RAG do chat só a expande com `includeAiFolders = webResearchEnabled` da pasta (`useChat.ts:3866`, `rag.rs:117`). Com "Save web sources" desligado, o arquivo entra na KB mas o chat da pasta não o busca; o slash busca, porque usa `includeAiFolders: true` (`App.tsx:2619`). Também não há KB sem pasta de chat (`documentsEnsureAiFolder` exige `chatFolderId`). **Decisão necessária**, com três opções: (a) no chat sem pasta, o botão não aparece; com "Save web sources" desligado, a confirmação avisa e liga o toggle; (b) gravar numa pasta manual separada, com regra própria no `resolve_scope`, o que mexe no Rust do RAG; (c) aceitar o comportamento e só avisar. Eu iria de (a).
5. **Triagem com o bibliotecário não serve como está.** O prompt de `librarian_triage` (`lib.rs:724-734`) manda rejeitar "ephemeral or trivial news", o oposto do Radar. Só o helper `librarian_decide` (`lib.rs:646`, privado) se reaproveita. **Recomendação:** sem chamada extra de triagem. O app filtra (data, duplicados, URL já na KB) e o modelo principal escolhe até 8 itens **por marcador de candidato** (mesmo contrato do E3), o que também impede item inventado no Radar.
6. **Tipos de Crossref do edge case.** "artigo, preprint, capítulo ou livro" deixa de fora `proceedings-article`, o artigo de conferência, que é a fonte principal em computação. Sugiro incluir. A decisão é do Coordenador.

---

## 1. Agentes do Chat

- **Definição:** `ChatAgentDef` em `src/lib/agents/chat.ts:10-23` tem `id`, `command` (`/radar`), `label`, `description`, `icon` (Phosphor), `prompt(language)`, `buildContext(input)`, `forceTasksTool`, `forceNotesTool` e `context {rag, web, deepResearch}`. Os exemplos são `coach.ts:72-83` (sem RAG e sem web) e `tutor.ts:394-405`.
- **Registro:** `CHAT_AGENTS` em `chat.ts:61` define a ordem do seletor e do autocomplete. Daí saem `parseAgentShortcut` (`chat.ts:71`) e `agentSuggestions` (`chat.ts:81`), consumidos por `AgentPicker.tsx:91,129`, `ChatComposer.tsx:178` e `NotesChatPanel.tsx:516`. O placeholder e a mensagem padrão ficam em `COMPOSER_HINTS` (`chat.ts:97`). O Radar pode ter `defaultMessage` ("What's new"). O editor avisa sozinho que `/radar` é um agente de chat (`CommandExtension.ts:71,96`).
- **Política no turno:** `useChat.ts:3496-3499`: `turnAgent` vem de `findChatAgent(agentsAllowed(...) ? turnAgentId : undefined)`, e `useWebSearch`/`useDeepResearch` = toggle **e** política. Para o RAG, `useChat.ts:3843-3872` usa `turnAgent.context.rag`. O `buildContext` roda em `useChat.ts:3804-3825` e o texto vai no system message efêmero (`3883-3888`).
- **Fora do Reader e do Mincer:** `agentsAllowed` (`useChat.ts:969-974`) devolve false no modo `reader` e nas pastas dos grupos `library`/`mincer` (`getAutoFolderGroups`, `947-957`). Um agente novo já herda isso.
- **Escopo do tutor:** `resolveTutorNotebook` (`tutor.ts:87-114`) tenta, nesta ordem: o caderno citado explicitamente na mensagem atual (entre aspas ou junto de "caderno"/"notebook", `explicitNotebookIn`, `67-80`), o vínculo da pasta, o nome "Notebook - X" e, por fim, o nome citado nas mensagens anteriores (`namedIn`, `49-58`). A mudança de escopo é detectada recalculando sem a mensagem atual (`191-195`). Essas funções são **privadas** do `tutor.ts`: mover para um `agents/scope.ts` (refactor sem mudança de comportamento, E7) e acrescentar a tag (match com `tagKey` de `noteTags.ts:8` contra `summarizeTags`) e o board (nome de tipo com `board` resolvido).
- **O que falta para Radar e Papers:**
  - `AgentContextInput` (`chat.ts:26-34`) não tem `signal`. Sem ele, o Stop não cancela as buscas do pipeline. Acrescentar `signal` (o `webSearch` já aceita, `search.ts:53-58`) e checar `signal.aborted` depois do `buildContext`.
  - Não há gancho de "fim do turno". O D5 exige que a data só avance quando a resposta termina. Sugestão: `AgentContext.onDone?: () => Promise<void>`, guardado num ref por `assistantId` e chamado em `onOpenRouterDone` (`useChat.ts` ~3180-3244, onde o bibliotecário já é disparado). É descartado em erro (`3245-3260`), no Stop e no corte.
  - Não há canal para dados do app na mensagem. Para desenhar ações com dados do Crossref/Tavily (e não com o texto do modelo), é preciso um campo novo em `ChatMessage` (`useChat.ts:264-302`), ex.: `agentItems?: RadarItem[]`. Ele é gravado no placeholder do assistant, como `agentId` (`3743-3747`) e `allowedImageUrls`. O chat fica em localStorage, o que serve: a nota Paper é que é durável.
  - Não há status durante o preparo. O balão mostra só os três pontinhos. É opcional reaproveitar `setWebSearchActive` com um `onPhase` no input.

## 2. Contexto calculado pelo app (mapa de foco)

| Peça do D3 | Reaproveitável | Falta |
|---|---|---|
| Notas, tipos, defs, cadernos, IA desligada, livros | `loadPlanData()` (`agentData.ts:37-54`) | — |
| Cadernos ativos nos últimos 30 dias e títulos recentes | `notes[].updatedAt`, filtro de `tutor.ts:222-224` (sem arquivadas, sem `isTaskBodyNote`), excluir `disabledNotebookIds` | Função nova: agrupar por caderno, cortar por 30 dias e por orçamento de caracteres (padrão `OTHER_NOTES_CHARS`, `tutor.ts:330-348`). Decidir sobre o Calendar (títulos são datas: sugiro excluir) |
| Perfis de estudo | `findStudyProfile(notes, notebookId)` (`studyProfile.ts:23`), um por caderno | Laço por caderno ativo, com `PROFILE_MAX` reduzido |
| Planos ativos | `collectPlans` + `formatPlanForAi` (`planNotes.ts:122,241`). `planLine` do tutor (`tutor.ts:143`) é privado | Exportar `planLine` ou usar título e estado |
| Tags mais usadas | `summarizeTags(notes)` (`noteTags.ts:25`), em ordem alfabética | Ordenar por `count` e cortar no top N |
| Livros em andamento | `loadReaderBooks()` + `bookLine()` (`agentData.ts:21,58`); `Book.lastPage/totalPages/lastOpenedAt` | Filtro "em andamento" (aberto e `lastPage < totalPages`) |
| Cards de board | `resolveBoard` + `boardNotes` + `buildBoardColumns` (`noteBoard.ts:68,130,199`), com o título da coluna em `BoardNoteColumn.title` | Montar "card · coluna" |
| Perfil do Radar | Padrão de `isStudyProfileNote` (`studyProfile.ts:17`) | `radarProfile.ts`: tag `radar profile`; perfil global (sugiro procurar em todos os cadernos e usar o mais recente) |

Restrição do Task Report: as queries vão ao Tavily e ao Crossref só com termos. O mapa de foco (títulos e perfis) vai ao modelo de geração de queries (OpenRouter), como já acontece com os títulos no tutor. Validar o tamanho de cada query (ex.: ≤ 10 palavras, ≤ 120 caracteres) antes de mandar.

## 3. Botões de ação sobre a resposta

- **Detecção:** `agentNoteDraft(message, todayKey)` (`agentNotes.ts:35-45`) decide pelo `message.agentId` e por um parser puro: `extractProfileDraft` (`studyProfile.ts:46-68`, cabeçalho `**Study profile — <caderno>**`) e `extractPlanDraft` (`plan.ts:345`).
- **Desenho:** `ChatMessageBubble.tsx:125-128` (memo) e `312-328` (botão em `assistantActions`). O mesmo componente é usado no ChatPanel (`ChatPanel.tsx:494`) e no AssistantPanel (`AssistantPanel.tsx:528`). **O NotesChatPanel tem um balão próprio** (`NotesChatPanel.tsx:942-1078`), e cada ação nova precisa entrar nos dois.
- **Gravação:** o clique abre o `SaveAgentNoteModal` (`SaveAgentNoteModal.tsx`), que monta um `AgentNoteRequest` (`agentNotes.ts:15-28`) → `onCreate`. Na main e no chat das notas, `onCreate` é `handleCreateAgentNoteFromChat` (`App.tsx:3578-3612`). Na janela assistant, passa por `create-agent-note` (`assistantNoteBridge.ts:19,87`) e chega a `App.tsx:3628-3629`. Para não duplicar, o vínculo resposta → nota fica em localStorage (`rememberAgentNote`, `agentNotes.ts:90-119`).
- **"Save radar profile":** seguir o mesmo caminho com `kind: 'radarProfile'` na união. O caderno vem do escopo ou da escolha no modal, e a tag é `radar profile` (como `STUDY_PROFILE_TAG`, `App.tsx:3581-3583`).
- **Ações por item:** são ações locais (Open, Send to Mincer, Add to KB) e de nota (Add to reading list). Recomendo um componente `AgentItemsList` que lê `message.agentItems` e os marcadores citados no texto (`[W3]`, `[P2]`) por um parser puro e testável (`radarContract.ts`). Ele entra como `footer`/prop nos dois balões. Os dados mostrados (título, fonte, data, DOI, citações) vêm do payload, não do texto. Os itens que o modelo não citou não aparecem. O "Save to note" continua como está (`ChatMessageBubble.tsx:329-339`).

## 4. Web search

- **Caminho:** `webSearch(query, maxResults=5, includeRawContent=false, signal)` (`search.ts:53-103`) é um `fetch` direto do frontend para `https://api.tavily.com/search`, com body `{query, max_results, include_raw_content}`. **Não há** `topic`, data nem `search_depth` (o padrão é `basic`). O Rust só guarda a chave (`lib.rs:235-253`) e roteia (`web_search_route`, `lib.rs:798`: gpt-4.1-mini devolve `{needsSearch, intent, queries}`; o fallback é a mensagem cortada em 380 caracteres).
- **Multi-query:** em modelos sem tools, a rota pré-turno roda `route.queries.map(q => webSearch(q, 3, false, signal))` em paralelo com dedupe por URL (`useChat.ts:3677-3711`). Com tools, a tool `web_search` recebe 1 a 3 queries (`4411-4457`). O slash usa `webSearch(query)` com 5 resultados (`App.tsx:2584-2605`).
- **Tavily, documentação atual** (https://docs.tavily.com/documentation/api-reference/endpoint/search, consultada em 2026-11-20):
  - `topic`: `general` | `news` | `finance`, padrão `general`. `news` é voltado a atualidades.
  - `time_range`: `day|week|month|year` (ou `d|w|m|y`), relativo a hoje, pela data de publicação.
  - `start_date` / `end_date`: `YYYY-MM-DD`; devolvem resultados publicados depois ou antes da data.
  - **`days` não existe mais** na especificação atual.
  - `include_published_date` (beta, padrão false; ligado automaticamente com `topic: news`) acrescenta `published_date` em cada resultado. É a "melhor estimativa" do Tavily e **pode ser a data de atualização**, não a de publicação. Vem `null` quando não há data.
  - `filter_by_published_date` (padrão false) remove os resultados fora da janela **e os sem data**, e também liga `include_published_date`.
  - Outros: `max_results` 0–20; `search_depth` `basic` custa 1 crédito, `advanced` 2.
- **Como expor sem mudar as buscas atuais:** acrescentar um 5º parâmetro opcional `opts?: { topic?, startDate?, endDate?, timeRange?, filterByDate? }`, posto no body só quando definido, e `publishedDate?: string` em `SearchResult` (lido de `r.published_date`). As chamadas atuais não passam `opts` e mandam o mesmo body de hoje. Para o Radar: `start_date` = última consulta (ou hoje − 30, no máximo 90), `filter_by_published_date: true` (atende o edge case "sem data fica fora") e um filtro local `publishedDate >= corte` como segunda barreira. Na seção News, `topic: 'news'`; em Releases, `general`. Teto: até 6 chamadas, `max_results` 5.
- **Risco:** como o `published_date` pode ser a data de atualização, páginas antigas atualizadas passam. O prompt deve pedir que o modelo descarte o que não é novidade.

## 5. Crossref e Unpaywall

- **O que existe:** `librarian.ts` faz Crossref e Unpaywall pelo frontend (CORS aberto, `librarian.ts:51-56`). `crossrefSearch` (privado, `76-101`) usa `query.bibliographic`, `rows=8`, `select=DOI,title,published,type,abstract` e `mailto`, sem sort e sem filtro. Não traz autores nem citações. `unpaywallResolve(doi)` (privado, `103-123`) devolve a URL do PDF de acesso aberto ou null. O nome de arquivo sai de `academicFilename` (`139`). Os comandos `librarian_academic_query` (`lib.rs:755`, até 2 queries a partir de uma "pergunta") e `librarian_academic_relevance` (`lib.rs:771`, barra conservadora, máximo de 3, "para salvar na KB") servem à KB. Para o Papers, o E3 pede que o modelo principal escolha por índice, então a relevância do bibliotecário não entra. `librarian_decide` (`lib.rs:646`) é o helper JSON reaproveitável para um comando novo de geração de queries.
- **Reaproveitar:** exportar uma `crossrefWorks({ query, rows, sort?, order?, filter? })` e fazer o `crossrefSearch` atual chamá-la com os mesmos parâmetros (sem mudança no bibliotecário). Exportar `unpaywallResolve`, que hoje só devolve o PDF. Para "acesso aberto", vale também `is_oa` sem PDF direto: mostrar o link OA da landing quando houver `best_oa_location.url`.
- **Crossref, documentação atual:**
  - Endpoint `/works` (https://api.crossref.org/swagger-docs): `query`, `query.bibliographic`, `filter`, `sort`, `order` (`asc|desc`), `rows` (padrão 20, máximo 1000), `select`, `mailto`.
  - Valores de `sort`: `relevance`, `score`, `is-referenced-by-count`, `published`, `issued`, `created`, `deposited`, `indexed`, `updated`, `references-count`, `published-online`, `published-print`.
  - Filtros (https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-filters/): `from-pub-date` / `until-pub-date` (aceitam `2025`, `2025-01` ou `2025-01-05`, inclusivos), `from-online-pub-date`, `from-print-pub-date`, `from-issued-date`, `type:<id>` (ids em https://api.crossref.org/types: `journal-article`, `posted-content`, `book-chapter`, `book`, `monograph`, `proceedings-article`, `edited-book`…) e `has-abstract:1`.
  - **Testado:** repetir `type:` funciona como OU (journal-article sozinho: 1.053.159; com posted-content: 1.116.358).
  - Campos da obra: `author[]` com `given`/`family`/`name`, `published`/`issued` com `date-parts` (o ano é o 1º número), `is-referenced-by-count` (citações **no Crossref**, menores que no Google Scholar), `abstract` (JATS, opcional e frequentemente ausente) e `type`.
- **Montagem sugerida (pura, testável):**
  - Recentes: `query.bibliographic=<q>&filter=from-pub-date:<hoje−3a>,type:...&rows=20&select=DOI,title,author,published,issued,type,abstract,is-referenced-by-count,score`, por relevância.
  - Fundamentais: a mesma query sem filtro de data, `rows=40`, reordenada localmente pelas citações (ver o destaque 2).
  - Radar (D6): `from-pub-date:<corte>`, por relevância.
  - **Risco:** `select` com `author` aumenta bastante a resposta. Com `rows` pequeno não pesa.

## 6. "Última consulta" do Radar, durável

- **Hoje:** não há tabela de chave-valor nem store do Tauri (o `tauri_plugin_store` não aparece no projeto). As configurações pequenas ficam em localStorage. As tabelas novas nascem em runtime com `ensure*Table` memoizado em `src/storage/tauri.ts` (ex.: `ensureReminderStateTable` em `tauri.ts:1104-1112`, `ensureNoteTypesTable` em `1186-1215`, via `serialDdl`), sem migration nova (atende "não editar migration aplicada").
- **Caminho mais simples:** tabela `radar_scope_state (scope_key TEXT PRIMARY KEY, last_run_date TEXT NOT NULL, updated_at INTEGER NOT NULL)` em `monet.db` pelo plugin SQL, criada por `ensureRadarStateTable`, com `getRadarLastRun(scopeKey)` / `setRadarLastRun(scopeKey, dateKey)` na interface `storage` (`storage/index.ts`) e um stub em `browser.ts`. A chave do escopo: `notebook:<id>`, `tag:<tagKey>`, `board:<typeId>` ou `all`. Um INSERT ON CONFLICT por gravação, sem BEGIN/COMMIT. O banco é o mesmo nas três janelas.
- **Gravação:** só no `onDone` do turno (ver §1), com a data local de hoje (`dateKeyFromMs`). Erro, Stop ou corte não gravam (edge case).
- **Coordenação:** a frente A também cria tabelas. É bom usar o mesmo padrão `ensure*` e não colidir nomes.

## 7. Send to Mincer

- **Comando:** `mincer_start({ input: { kind, source, text, options } })` (`mincer/mod.rs:413-513`; wrapper `mincerStart` em `mincer.ts:210`).
  - `kind: 'youtube'` valida a URL (`youtube::validate_youtube_url`) e **exige o modelo de transcrição**.
  - `kind: 'web_summary'` exige modelo e prompt de resumo; `web_capture` não exige nada além de URL http(s).
  - Fora o `web_capture`, exige também a chave do OpenRouter.
  - O item entra em `mincer_items` e chama `jobs::start_next`. **Dá para enfileirar do Chat** sem abrir o modo Mincer: o worker é do Rust e serve qualquer janela.
- **Opções:** `{ transcriptionModel, summaryModel, preset, summaryPrompt }`. Os modelos vêm de `getTranscriptionModel()` e `resolveSummaryModel()` (`mincer.ts:173-180`, localStorage). O preset e o prompt vêm de `loadSummarySettings('web' | 'youtube')` + `resolveSummaryPrompt` (`components/Mincer/presets.ts:186,142`; as abas são `'youtube' | 'web'`, `MincerNew.tsx:39`). O `presets.ts` mora em `components/`, e importá-lo de `lib/` funciona, mas mover para `lib/` seria mais limpo.
- **Detalhe:** `mincer_start` **não emite** `mincer://changed` (só o boot emite, `jobs.rs:465`). Com outro item rodando, o item novo só aparece na lista do Mincer e no ponto da Toolbar (`useMincerJob.ts:94`) no próximo evento. Emitir o evento no comando (uma linha) ou pelo frontend depois do `mincerStart`.
- **Erros legíveis:** já vêm do Rust ("Choose a summary model in Settings."). Usar `splitMincerError` (`mincer.ts:195`). Um toast ou estado no botão: "Queued in Mincer".

## 8. Add to KB

- **Como o RAG automático grava:** `enqueueLibrarian` (`librarian.ts:167`) → `runWebPhase` (`255-335`): triagem → `tavilyExtract(url)` (`search.ts:105`) → julgamento → `documentsEnsureAiFolder(chatFolderId, folderName)` (`documents.ts:254`) → `documentsWriteAiSourceFile(folderId, sha256(url).md, cabeçalho + rawContent)` → `documentsScanWatchedFolder(aiFolderId)` → `onFolderRegistered`. Em pasta ligada a um caderno, o último passo chama `setNotebookDocumentVisibility`; nas outras, atualiza `visibleDocumentIds` da pasta (`useChat.ts:3221-3241`).
- **Para o clique:** criar `addUrlToKb({ chatFolderId, folderName, url, title })` em `librarian.ts`, reaproveitando os mesmos passos **sem** triagem e julgamento: o clique é a curadoria. O dedupe é pelo nome do hash (mesma lógica do `runPipeline`, `187-201`) e por `inFlightUrls`. Para a pasta não ligada a caderno, o `onFolderRegistered` precisa de um callback exposto pelo `useChat` (hoje é um `setFolders` interno).
- **Risco:** ver o destaque 4 (`webResearchEnabled`) e o chat sem pasta.

## 9. Slash `/since`

- **Registro:** um `AgentDef` (`core.ts:43-49`) num arquivo `agents/since.ts`, adicionado a `AGENTS` (`agents/index.ts:22-39`). `COMMANDS` deriva dele (`commands.ts:10`). Pôr no grupo "Review" ou "Web" de `COMMAND_GROUPS` (`commandParser.ts:88-95`). O rótulo do bloco vem de `label` (`agentLabel`, `index.ts:60`; `getToggleTitle`/`getAiBlockTitle`, `commandParser.ts:27-39`).
- **Como o `/expand` usa a web:** `web: 'withQuery'` (`expand.ts:26-34`). Em `handleCommand` (`App.tsx:2380`), a busca roda só se houver instrução (`webSearch(query)`, `App.tsx:2592-2605`); sem chave, entra a linha `EXPAND_NO_TAVILY`. `note: 'userText'` manda o texto do usuário e, à parte, os blocos de IA (`2509-2581`). O bloco não editável e a gravação em `ai_responses` são feitos pelo pipeline comum depois do `buildUserMessage` (`2736`). O `/since` herda isso sem código novo.
- **O que falta:** o `/since` busca **sem** instrução, a partir dos termos da nota, e com data. Nenhum `WebPolicy` faz isso.
  - Sugestão: um campo novo na `ContextPolicy` (ex.: `webSince: true`) e, em `handleCommand`, uma chamada a `sinceSearch(userText, cutoff, signal)` de um `src/lib/radar.ts`. A função gera de 2 a 3 queries com o comando Rust de queries do Radar (o mesmo de D/E) e chama `webSearch(q, 5, false, signal, { startDate: cutoff, filterByDate: true })`. Assim a edição no `App.tsx` (compartilhado) fica pequena, ~15 linhas.
  - Nota vazia: `minUserTextChars` (`core.ts:40`, usado em `App.tsx:2528`) já dá o aviso sem chamar o modelo. Falta só uma mensagem própria (hoje é `CRITIQUE_TOO_SHORT`).
- **Data da nota:** `Note.date` (ISO `YYYY-MM-DD`, validado por `ISO_DATE_RE` em `agenda.ts:45`); senão `dateKeyFromMs(note.createdAt)`. Numa nota do Calendar, a data é o título `DD/MM/YYYY` (`parseCalendarTitle`, `calendar.ts:17`; já calculado em `App.tsx:2438-2440`). Uma data na instrução substitui o corte: parser puro (`dd/mm/yyyy` e `yyyy-mm-dd`). Corte futuro ou inválido: aviso.

## 10. Fila de leitura (tipo "Paper")

- **Padrão do "Save as Plan note":** `planSaveChanges(types, defs)` (`planNotes.ts:344-405`) acha o tipo por nome (`nameKey`) ou cria um novo (`nt_${nanoid(8)}`) e acrescenta **só as propriedades que faltam** (`md_${nanoid(8)}`, `showInList` até `MAX_LIST_PROPERTIES`). A gravação fica em `App.tsx:3585-3605`: `saveNoteType`, `saveMetadataDef` uma por vez, `noteTypes.reload()`, `emitTasksChanged()`, depois `handleCreateNoteFromChat(notebookId, title, content, undefined, typeId, { properties })` (`App.tsx:3532-3569`, que grava o tipo e as propriedades depois do `saveNote`).
- **`paperSaveChanges` (pura e testável):**
  - Tipo "Paper".
  - Propriedades: `Status` select com opções `{id: 'opt_'+nanoid(6), name, color}` (padrão de `useNoteTypes.ts:282`): To read / Reading / Read. `Year` number, `Authors` text, `DOI` text.
  - **Board:** `type.board = { columnDefId: status.id, sectionDefId: null, cardDefIds: [authors.id, year.id], showTags: true, hideEmpty: false, filterDefId: null }` (forma em `types/index.ts:169-176`; `defaultBoardConfig` em `noteBoard.ts:87` faz quase isso). Gravar o tipo **depois** das defs, ou gravar de novo: `resolveBoard` (`noteBoard.ts:68`) ignora coluna inexistente, então a ordem não quebra nada.
  - Tipo já existente com `board` próprio: não sobrescrever. Com `Status` já existente mas não select: não criar um segundo Status; o board só nasce se houver select.
- **Nota:** título do artigo, propriedades (Status = opção "To read"), corpo em markdown com o link do DOI, o abstract quando houver e o motivo num trecho marcado como sugestão da IA. Ex.: uma citação "AI suggestion: …". Evitar `<mark data-mark>`, que é a marca de atenção do usuário.
- **Caderno:** o do escopo; sem escopo, modal de escolha (o `SaveAgentNoteModal` já tem a lista de cadernos, `266-279`). Entra como `kind: 'paper'` na união `AgentNoteRequest`, e a janela assistant herda a ponte.
- **Dedupe por DOI:** função pura `findPaperNoteByDoi(notes, defs, types, doi)`: tipo Paper → def `DOI` por `nameKey` → valor normalizado (minúsculas, sem `https://doi.org/` e sem `doi:`). Ignorar arquivadas? Sugiro contar as ativas e as arquivadas. Notas disponíveis: o ChatPanel e o NotesChatPanel recebem `notes`; o AssistantPanel lê sob demanda (`loadSaveTargets`, `AssistantPanel.tsx:94`). Também alimenta o E2 ("remover o que já está na fila") no `buildContext` via `loadPlanData().notes`.

## 11. Open in Library

- **Onde o bibliotecário grava:** `librarian_fetch_and_save_pdf` (`documents.rs:2110-2178`) grava **na pasta da KB da IA** (`origin='ai'`), não na Library. Baixa com `reqwest` e UA próprio, timeout de 30 s, teto `LIBRARIAN_MAX_PDF_BYTES`, valida `%PDF` e grava de forma atômica. Não serve direto.
- **Como um livro é registrado:** os arquivos ficam em `app_data/books/<uuid>.<ext>` (`books.rs:22-30,72`). O registro é `storage.saveBook(book)` na tabela `books` (de propriedade do frontend, `books.rs:1-4`), depois de validar com pdfjs (`books.ts:35-108`: `booksReadFile` → `openPdf` → `extractPdfInfo` → `saveBook`, com rollback do arquivo).
- **Viabilidade:** sim, a custo **médio**.
  - (1) Comando Rust `books_download_pdf(url) -> BookImportResult` em `books.rs`, espelhando o download e a validação de `librarian_fetch_and_save_pdf` e gravando em `books_dir` com o teto de 50 MB do `books.rs`.
  - (2) Extrair de `importBook` um `registerBookFile(destPath, fallbackTitle)` com a mesma validação e rollback.
  - (3) Ligação com a nota: `setReaderNoteLink(book.id, notebookId, paperNoteId)` (`readerNoteLink.ts:57`) faz a aba Notes do Reader abrir a nota Paper. É o padrão existente, mas fica em localStorage. Para não baixar duas vezes, procurar o livro pelo vínculo inverso (livro cujo link aponta para a nota).
  - (4) **Abrir o livro de fora:** a Library guarda `openBook` em estado interno (`Library.tsx:99`) e o App só a monta (`App.tsx:4503-4516`). É preciso uma prop/evento "abrir este livro" e, na janela assistant, um pedido à main.
- **Riscos:** o `url_for_pdf` do Unpaywall muitas vezes devolve HTML; a checagem `%PDF` dá um erro legível e a nota fica (edge case). O título do PDF costuma vir vazio ou errado no metadado: usar o título do Crossref como fallback ou como título principal.

## 12. Riscos e escopo (além do destaque)

- **Dois balões:** cada ação por item entra no `ChatMessageBubble` e no balão do `NotesChatPanel`. Recomendo um componente único de lista de itens usado pelos dois.
- **`App.tsx` compartilhado:** ficam lá o `/since` (~15 linhas), os novos `kind` no `handleCreateAgentNoteFromChat` e o "abrir livro". O resto vai para `lib/radar.ts`, `lib/papers.ts` e `lib/agents/radar.ts|papers.ts`.
- **Custo por execução:**
  - Radar: 1 chamada barata de queries (deepseek, `LIBRARIAN_MODEL`), até 6 Tavily `basic` (6 créditos), até 3 Crossref (grátis) e o modelo principal.
  - Papers: 1 chamada de queries, até 6 Crossref (2 passadas × 3) e Unpaywall **só para os ≤ 6 escolhidos**, depois da resposta e em paralelo com throttle. Resolver antes, para ~40 candidatos, somaria segundos.
- **Latência:** o pipeline no `buildContext` deixa o balão em "três pontinhos" por 5 a 15 s. Um status ("Searching news…") ajuda.
- **Privacidade:** o e-mail do Crossref/Unpaywall está em código (`librarian.ts:58`); a memória do projeto diz que isso é aceito. As queries não levam texto de nota, desde que geradas por modelo e validadas por tamanho.
- **PRD §9** ("IA ancorada no material do usuário"): o Radar é exceção sob demanda e o Task Report já manda registrar. O Papers fica ancorado no mapa de foco.
- **Conflitos com decisões registradas:** nenhum além do destaque. D1/D9 do `agents_study` (chat dá insumo, seletor por conversa) e D15 (rótulo no bloco) são seguidos. O backlog não tem nada sobre Radar, Papers, Crossref ou Tavily.

## Recomendações de arquivos novos (para o planner)
- `src/lib/agents/radar.ts`, `src/lib/agents/papers.ts`, `src/lib/agents/since.ts`, `src/lib/agents/scope.ts` (resolução de escopo tirada do tutor).
- `src/lib/focusMap.ts` (mapa de foco com orçamento).
- `src/lib/radarContract.ts` (marcadores `[W n]`/`[P n]` → itens; testes vitest).
- `src/lib/papers.ts` (`crossrefWorks`, montagem das queries, ranking local, `paperSaveChanges`, `findPaperNoteByDoi`; testes).
- Rust: um comando de geração de queries (`radar_plan_queries`, com `librarian_decide` ou variante de 2 campos) e `books_download_pdf`.
- `storage`: `radar_scope_state`.
