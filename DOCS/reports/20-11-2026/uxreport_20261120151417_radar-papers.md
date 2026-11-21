# UX Report — Radar, `/since`, Papers e fila de leitura (fatia 2)

> `uxAgent`, 2026-11-20, branch `feat/radar-trackers`, código sem commit das fases D e E. Análise feita só no código, no CSS e nos textos: o app não foi aberto, nenhum modelo foi chamado e nenhuma requisição de rede foi feita. Base: `taskreport_20261120115512.md` (com a troca para o OpenAlex registrada no Execution Report), `executionreport_20261120115512.md` (sessões D e E), `planreport_20261120131834_d-e.md`, `DOCS/specs/radar.md` e os critérios de `uxtriage_20261120133108.md`. A fatia 1 (trackers, Log e constância) ficou fora.

## 1. Resumo executivo

Em parte. A arquitetura é boa para o usuário: o app busca, filtra e desenha título, link, data e DOI, e o modelo só escolhe. Por isso o Radar e o Papers não inventam fontes. Toda ação roda só no clique, e o `/since` cabe no padrão do bloco de IA. A primeira consulta do Radar e a do Papers devem funcionar bem. Os problemas aparecem do segundo turno em diante:
- **Pergunta de seguimento na mesma conversa refaz a busca com a janela que acabou de avançar.** Para "me fala mais do 2º item", o app busca só o que saiu hoje, gasta até 9 buscas e tende a responder "Nothing new since 20/11/2026".
- **Escopo, janela e consultas ficam invisíveis.** Só o modelo os lê, e nem ele vê o texto das consultas. O usuário não sabe "desde quando", "em qual caderno", nem como voltar a ver mais.
- **Quando o planejador de consultas falha, a busca cai em termos genéricos** (nome de caderno, inclusive "Quick Notes"), e a data da consulta avança mesmo assim. O período se perde.
- **No chat das Anotações, o Radar sem chave do Tavily, numa conversa vazia, apaga o que o usuário digitou e não mostra nada.**
- **A fila de leitura não leva ao PDF depois que o chat some.** O "Open in Library" só existe no balão (efêmero), e a nota Paper não guarda o link do PDF.

## 2. Contexto do app

- **Proposta de valor:** companheiro de quem se aprofunda num tema. O trabalho do usuário (notas, leituras, cadernos) fica no centro, e a IA é meio, silenciosa até ser chamada (`productVision.md`).
- **Usuário-alvo:** quem estuda e trabalha com cadernos por assunto, Library de PDFs e agentes no chat (inferido dos fluxos do PRD). Ele quer saber o que mudou nos assuntos que acompanha e o que vale ler, sem virar leitor de feed.
- **Onde a task entra:** no Chat (main, janela Assistant e o chat das Anotações), com dois agentes novos e uma lista de ações por item. No editor, pelo `/since`. Nos tipos de nota, pelo tipo "Paper" com board. Na Library, pelo "Open in Library". E em Settings, pela chave do OpenAlex.

## 3. O que a task entrega

- **Radar** (`/radar`): novidades desde a última consulta do escopo (caderno, tag, board ou tudo). A 1ª consulta cobre 30 dias e o teto é de 90. As seções são News, Releases & changes e Papers, com até 8 itens, cada um com o motivo e o que ele toca no mapa de foco. Sem perfil, a resposta propõe um "Radar profile", que o botão "Save radar profile" salva.
- **Papers** (`/papers`): até 6 artigos do OpenAlex, nas seções Foundational (os mais citados entre os relevantes) e Recent (3 anos). O que já está na fila de leitura fica de fora.
- **Lista de itens sob a resposta:**
  - web: Open, Send to Mincer e Add to KB;
  - artigo: Open, Add to reading list (que vira In reading list), Open in Library e o estado do PDF, com o link DOI.
- **Fila de leitura:** nota do tipo Paper (Status, Year, Authors, DOI) com board por Status, dedupe por DOI ou id do OpenAlex e "Open in Library", que baixa o PDF de acesso aberto e liga o livro à nota.
- **`/since`:** bloco de IA com o que mudou no assunto da nota desde a data dela, da instrução ou do dia de criação.
- **Settings:** bloco "OpenAlex (optional)".

## 4. Análise de usabilidade

### O que funciona bem
- **Nada inventado:** o marcador `[W3]`/`[P4]` é expandido pelo app (`agentItems.ts`), e a linha com marcador desconhecido some na finalização. O usuário pode confiar no link e na data. É o melhor desenho possível para "o que saiu de novo".
- **Silêncio respeitado:** não há background, agendamento nem notificação. Todas as escritas (nota, KB, Mincer, Library) pedem clique, e o perfil do Radar é uma nota comum, que o usuário edita.
- **Privacidade das buscas:** `cleanQueries` barra consulta que copia 6 palavras ou mais do mapa de foco ou da nota, e o `/since` não tem reserva pelo texto da nota (`radar.ts:259-283`).
- **Erros legíveis:**
  - OpenAlex: orçamento, limite por segundo, rede e HTTP (`openalex.ts`);
  - PDF: "The link did not return a PDF (the publisher may require a browser). Open the DOI link instead.";
  - `/since`: card de "The note has no text to compare yet…".
- **Estados das ações:** "Sending…/Queued in Mincer" e "Adding…/In KB" têm ícone e rótulo. O erro aparece numa linha sob o item, com `role="alert"`, e a lista some em resposta parada ou com erro (`hasAgentItems`).
- **Dedupe da fila entre janelas:** o botão relê a fila antes de abrir o modal (`AgentItemsList.tsx:199-207`), e a nota arquivada conta. Um artigo lido não volta como novo.
- **Composer:** o Radar com aviso de chave e "Open Settings" sem "Turn off", que não faria sentido ali. Enter com o rascunho vazio já roda, e o texto do estado vazio diz "only what is new since your last check".

### Problemas encontrados — defeitos de comportamento (enganam o usuário ou põem trabalho em risco)

| # | Problema | Evidência | Severidade | Impacto no usuário | Recomendação | Custo |
|---|----------|-----------|------------|--------------------|--------------|-------|
| D1 | Toda mensagem de uma conversa do Radar refaz a busca, e a janela já encolheu para "hoje" | `useChat.ts:3854-3896` (`buildContext` a cada mensagem); `radar.ts:117-119` e `205-211` (a data vira hoje no fim do 1º turno); `lib/radar.ts:31-42` (`since = lastRun`); prompt `radar.ts:229` ("Nothing relevant: answer only 'Nothing new since…'") | Alta | Depois da 1ª resposta, "me fala mais do 2º", "resume em português" ou "obrigado" disparam o planejador, até 6 buscas no Tavily e 3 no OpenAlex. Os candidatos novos são só os de hoje, e o prompt empurra a resposta para "Nothing new since 20/11/2026.", o que contradiz a resposta de cima. O Papers tem o mesmo custo: 4 chamadas ao OpenAlex por mensagem, de um orçamento de ~100 por dia sem chave (≈ 25 mensagens) | (a) **A janela é da conversa.** A 1ª resposta do Radar grava o `since` no `AgentItemsPayload`, e as mensagens seguintes da mesma conversa e do mesmo escopo reusam esse `since`, sem encolher. (b) **Seguimento não busca de novo.** Com `ragGate(trimmed)` em `skip`/`reuse` (`rag.ts:225`), ou com uma mensagem que não muda escopo nem assunto, o turno reusa o texto do contexto do turno anterior, guardado em memória, sem pipeline. (c) Uma linha no prompt: "When the user asks about an item already shown, answer from the conversation." | M |
| D2 | Escopo, janela e consultas só chegam ao modelo, e o escopo volta à pasta na mensagem seguinte sem aviso | `radar.ts:186-197` (Window, Scope e "Scope changed" no contexto efêmero); `radar.ts:177-184` e `papers.ts:160-162` (só a contagem de consultas, sem o texto); `scope.ts:184-189` (o explícito vale só na mensagem mais nova; depois vence a pasta); prompt do Papers `papers.ts:189` ("suggest a narrower topic") | Alta | O usuário não sabe se o Radar olhou "tudo" ou o caderno, desde quando, nem o que buscou. No chat do caderno X, "what's new in #llm" funciona, mas a mensagem seguinte ("e lançamentos?") volta para o caderno X e avança a data dele. O Papers deve "sugerir um assunto mais estreito" sem saber qual assunto buscou. Sem isso, o usuário não entende por que os resultados são esses, nem como corrigir | **Uma linha montada pelo app** (não pelo modelo) acima da lista de itens, também quando não há item: `Notebook "ML" · since 13/11/2026 (last check) · searched: graph neural networks, message passing`. No Radar: `· 5 web, 2 paper searches`; com perfil, `· radar profile` clicável, abrindo a nota. Os campos `scopeLabel`, `since`, `windowNote` e `queries` vão no `AgentItemsPayload` (persistidos com a mensagem). O texto das consultas também entra no contexto do modelo (são só termos, que já foram ao Tavily e ao OpenAlex) | P–M |
| D3 | Falha do planejador de consultas vira busca por nomes de caderno, e a data avança mesmo assim | `radar.ts:123-130` (`.catch(() => [])` e reserva por `focus.terms`); `focusMap.ts:249-266` (no `all`, os termos são os nomes dos cadernos ativos, o que inclui Quick Notes); `radar.ts:201` (`anySearchOk` basta para avançar) | Média | Num erro do OpenRouter ou num JSON inválido, o Radar busca "Quick Notes", "Trabalho" e "todo" no Tavily. Os candidatos viram ruído, o modelo responde "Nothing new since…", e a janela do escopo avança: as novidades reais do período não voltam mais | (a) A reserva usa só os itens "Follow" do perfil e as tags do escopo, nunca nomes de caderno no `all` e nunca o Quick Notes. No escopo de caderno, o nome entra só se tiver 2 palavras ou mais. (b) Consulta vinda da reserva não avança a data (`onDone` só com plano do modelo). (c) Sem plano e sem reserva útil, o contexto diz "Search not done: could not plan the searches. Try again." | P |
| D4 | O perfil do Radar, que é global, vaza para o escopo de caderno e para o Papers | Planejador `lib.rs:828` ("first those the radar profile says to follow"); `focusMap.ts:259` (o Follow vem antes do nome do escopo); `papers.ts:81` (o Papers lê o perfil do Radar) | Média (a confirmar com um modelo) | Um Radar no caderno "Violão" pode trazer notícias de "LLM evaluation" porque o perfil segue LLM. Um Papers num caderno novo e quase vazio busca o assunto do perfil, e não o do caderno. O usuário escolheu um escopo e recebe outro | Prompt do `radar_plan_queries`: "When the scope is a notebook, a tag or a board, search only its subjects; use the profile's Follow list only for subjects that match the scope (or when the scope is all notebooks). Always apply Sources and Ignore." Nos `terms`, o nome do escopo vem antes do Follow. O Papers usa do perfil só o "Ignore" | P |
| D5 | Chat das Anotações: Radar sem chave do Tavily numa conversa vazia apaga o rascunho e não mostra nada | `NotesChatPanel.tsx:562` (`setDraft('')` antes do envio); `useChat.ts:3563-3572` (o erro é posto antes de inserir a mensagem); `NotesChatPanel.tsx:811` (`error && messages.length > 0`) | Alta | É o primeiro uso típico: o usuário escolhe Radar no caderno, digita "what's new in #rust" e aperta Enter. O texto some, não aparece balão e não aparece erro. Parece travado | Mostrar a linha de erro com a conversa vazia também (tirar o `messages.length > 0`, ou pôr o erro no lugar do estado vazio), com "Open Settings". Melhor ainda: conferir a chave no `handleSend` antes de limpar o rascunho, com o aviso no composer, como no Chat | P |
| D6 | Chat das Anotações: o menu de tools não sabe do agente | `NotesChatPanel.tsx:665-685` (`ChatToolsMenu` sem `agent`); o Chat e a Assistant passam (`ChatComposer.tsx:559`) | Média | Com o Radar, a linha Web Search mostra o toggle do usuário (pode estar "off") enquanto o app busca no Tavily e gasta créditos. Com o Papers e o Coach, mostra "on" para algo que está desligado. Lá também não há "Searching the web…": durante o pipeline, só os três pontos | Passar `agent={findChatAgent(activeAgentId)}` ao `ChatToolsMenu` e mostrar a linha de status do pipeline (D8) no composer das Anotações | P |
| D7 | A confirmação do "Add to KB" esconde o efeito colateral de ligar "Save web sources" | `AgentItemsList.tsx:173-180`; o bibliotecário grava fontes quando `webResearchEnabled` (`useChat.ts:3784-3791` e `4553-4557`); a descrição do toggle (`ChatToolsMenu.tsx:325-327`) | Média | O usuário quer guardar uma página. O clique também faz a IA passar a salvar sozinha, na KB da pasta, as páginas das buscas web do General daquela pasta. É contra "nada entra sem clique", e a mensagem fala só de ler | Texto: `"Save web sources" is off in this folder. Turning it on lets the chat read saved pages and also lets the AI save the pages it finds in web searches here. Turn it on and add this page?` Na próxima rodada, separar "ler as páginas salvas" de "salvar automaticamente" (M) | P |
| D8 | "Searching the web…" aceso no Papers (só OpenAlex, com o menu dizendo "Off for Papers") e durante o planejamento | `useChat.ts:3856-3859`; `ChatComposer.tsx:384-389` | Baixa | O composer diz que busca na web e o menu diz que a web está desligada. Isso não engana sobre dado, mas abala a confiança no resto dos rótulos | Campo `webPipeline.status` por agente: Radar "Searching news, releases and papers…", Papers "Searching OpenAlex…" | P |
| D9 | "/radar" + Enter roda a consulta padrão em vez de só trocar de agente | `ChatComposer.tsx:188-199` (com `defaultMessage`, o atalho sozinho envia); `chat.ts:135` | Média | Quem quer trocar para o Radar e depois dizer "#llm" dispara uma consulta no escopo da pasta (ou em "tudo"). Ela gasta as buscas e avança a data daquele escopo, que o usuário não pediu. No Coach e no Plan week isso é barato; aqui a janela se perde | Nos agentes com `webPipeline`, o atalho sozinho só seleciona. O Enter com o rascunho vazio (agente já selecionado) envia a mensagem padrão | P |
| D10 | "In reading list" também para a nota arquivada | `papers.ts:172-187` (ativa e arquivada no mesmo mapa, sem marca); `AgentItemsList.tsx:237-246` | Baixa | Quem leu e arquivou o artigo vê "In reading list". Abrir a nota arquivada é correto (ela mostra o selo "Archived" e "Unarchive", `App.tsx:4376-4380`); o rótulo é que está errado | `readingListMatch` devolve `archived`. O rótulo vira "Archived (read)", com o title "Archived Paper note · click to open" | P |
| D11 | Conflito no tipo Paper só no console: o modal diz "Paper added" com propriedades faltando | `App.tsx:3678-3679`; `papers.ts:84-92` | Baixa | Quem já tinha um tipo "Paper" com Year em texto recebe a nota sem Year, sem saber por quê. Se o conflito for no DOI, o dedupe passa a depender só da linha `Source:` | `onCreate` devolve os avisos, e o estágio de sucesso mostra uma linha: "Saved without Year: your Paper type has Year as Text. Change it in Note types." | P |
| D12 | "Save a copy" no "already saved" do Paper cria duplicata | `SaveAgentNoteModal.tsx:279-308` | Baixa | Quase inalcançável, porque a lista relê a fila antes. Mas, quando aparece (nota sem tipo ou sem DOI e sem `Source:`), cria uma 2ª nota do mesmo artigo, contra o dedupe | Esconder "Save a copy" quando `draft.kind === 'paper'`. Deixar só "Go to note" | P |

### Problemas encontrados — melhorias

| # | Problema | Evidência | Severidade | Recomendação | Custo |
|---|----------|-----------|------------|--------------|-------|
| M1 | A fila de leitura não leva ao PDF depois que o chat some | `paperNoteContent` (`papers.ts:222-243`, só o link do DOI); "Open in Library" só na `AgentItemsList` (`AgentItemsList.tsx:261-274`); o chat é efêmero (localStorage) | Alta | (a) Gravar `PDF: <url>` na nota quando há `paperPdfLink` (P). (b) "Open in Library" na nota Paper (barra de propriedades ou o card do board), com o mesmo `openPaperInLibrary` lido da nota (M). Fila de leitura é "ler depois", e o depois acontece sem o balão | P + M |
| M2 | Não há como pedir uma janela maior ("desde 01/11", "últimos 30 dias") | `radarWindow` só usa `lastRun` (`lib/radar.ts:31-42`); `parseDateInText` já existe (`lib/radar.ts`, `/since`) | Média | A data na mensagem, ou "last N days", sobrepõe a janela, com teto de 90 dias e sem gravar data menor. Texto do estado vazio: "…since your last check. To look further back, say 'since 01/11'." | P |
| M3 | Lista densa nas colunas de 220 a 300 px, com títulos repetidos e um link que duplica o Open | `AgentItemsList.module.css:21-33` (`flex: 1 1 160px`, ações quebram); `AgentItemsList.tsx:91-94` (meta repete a resposta); `AgentItemsList.tsx:280-290` ("DOI" abre `https://doi.org/<doi>`, o mesmo `item.url` do Open, `openalex.ts` `parseWorks`) | Média | Estimativa sem tela: em ~190 px úteis, um artigo ocupa 4 a 5 linhas ([Open], [Add to reading list], selo + DOI), ou seja, 6 artigos ≈ 700 px abaixo de uma resposta que já tem as 6 linhas longas. (a) Tirar o "DOI" quando o Open já é o DOI (P). (b) Com container query < 320 px, esconder a linha de meta e encurtar o selo ("PDF available"/"No PDF", texto completo no `title`) (P). (c) Lista recolhível "Actions for 6 items" nas colunas estreitas, aberta por padrão na coluna larga (M) | P + M |
| M4 | Sete agentes: lê-se bem na coluna larga, mas o menu pode cortar e os nomes se cruzam | `AgentPicker.module.css:47-61` (320 px fixos, abre para cima, sem `max-height`); 7 itens de ~64 px ≈ 450 px; seção "**Papers**" dentro do Radar (`radar.ts:226`) | Baixa | `max-height: min(60vh, 440px); overflow-y: auto` e alinhamento à direita quando a coluna é estreita (a conferir na tela, Anotações e Assistant). Separadores finos entre os grupos: General │ Plan week · Planner · Coach │ Tutor · Papers │ Radar. Renomear a seção do Radar para "New papers" e a descrição do Papers para "Foundational and recent papers on a topic (not only new ones), for your reading list" | P |
| M5 | Onde fica a "reading list"? O botão fala em "reading list" e a coluna mostra o board "Paper" | `SaveAgentNoteModal.tsx:80-88` (o resumo não diz onde ver); sucesso só com "Go to note" (`:411-436`) | Média | No sucesso, um botão "Open reading list" que abre o board do tipo Paper. Na 1ª criação, a frase "Your reading list is the Paper board in the notebook column." | P–M |
| M6 | A nota Paper não reserva lugar para o trabalho do usuário, e o abstract cortado não avisa | `papers.ts:238-243` (abstract até 1200 caracteres com "…"; a linha técnica `Source:` no meio) | Baixa | "## Abstract (excerpt)" quando cortado, e um "## My notes" vazio no fim, depois da sugestão da IA. Manter o `Source:`, que é a chave do dedupe sem DOI; o title do link pode explicar | P |
| M7 | O perfil do Radar é proposto em toda conversa nova até ser salvo, e o modal não diz que ele é global | Prompt `radar.ts:233-239` ("not proposed earlier in this conversation"); `SaveAgentNoteModal.tsx:71-79`; `findRadarProfile` pega a nota mais recente de qualquer caderno | Baixa | Propor só na 1ª consulta do escopo (quando o `radarWindow` é "first check") ou uma vez por janela (flag em localStorage). No modal: "It applies to every Radar check, in any notebook. With more than one, the most recently edited wins." O "Perfil do radar" segue aceito; pedir os rótulos Follow, Sources e Ignore sem tradução, para o `extractRadarProfileDraft` não perder o bloco | P |
| M8 | O bloco do `/since` não mostra a data de corte, e a 2ª execução volta à data de criação | Título por `getToggleTitle` (`commandParser.ts:27-32`, sem query = "Since"); `sinceCutoff` (`lib/radar.ts:291-308`) | Média | Sem instrução, o título do bloco leva a data: "Since · 01/03/2026 (note created)". O corte padrão passa a ser a data do último bloco `/since` da nota, quando houver, antes da data da nota ou de criação. É o "desde a última consulta" do Radar, aplicado à nota | P–M |
| M9 | O Settings não fala do Radar, do `/since` nem do Add to KB no Tavily, e o OpenAlex fala em "midnight UTC" | `SettingsModal.tsx:665` e `680-682`; `openalex.ts` (texto do `budget`) | Baixa | Footnote: "…/search, /profile, /expand, /since, Radar and Add to KB query the internet." Na confirmação de remover a chave, citar o Radar. No erro de orçamento, a hora local ("resets at 21:00 your time") | P |
| M10 | A data do item web parece de publicação, mas pode ser de atualização | `AgentItemsList.tsx:91-94` e o prefixo expandido | Baixa | `title` no meta: "Date reported by the search; it can be the page's last update." (o limite já está na spec §12) | P |
| M11 | Estados sem continuação: "Queued in Mincer" não leva ao Mincer, e o selo "Open-access PDF" não diz como abrir | `AgentItemsList.tsx:316-331` e `276` | Baixa | "Queued in Mincer" clicável, abrindo o Mincer no item. No selo, o title: "Add it to your reading list to read it in the Library." | P |
| M12 | Caderno de nome com 2 caracteres ("ML", "AI", "Go") nunca vira escopo | `scope.ts:71` e `113` (`key.length < 3`) | Baixa | Aceitar 2 caracteres quando o nome vem entre aspas ou junto de "notebook"/"caderno" | P |

### Cenários de borda não cobertos
- **Caderno novo, sem notas, e "/papers transformers attention":** o Papers recusa ("This scope has no notes yet…", `papers.ts:91-99`), embora o usuário tenha dado o assunto. Começar um tema é justamente o momento de procurar os fundamentais. Proposta: com escopo vazio e mensagem com assunto (mais que a mensagem padrão), buscar pelo assunto da mensagem (P). O mesmo vale para o Radar.
- **Dois Radars no mesmo dia, no mesmo escopo:** a 2ª consulta só vê o dia de hoje (M2 e D1 resolvem).
- **Sobreposição entre consultas:** a janela começa no dia da última consulta (inclusive), e um item daquele dia pode voltar. Ver O4.
- **Releases:** changelogs e páginas de release costumam vir sem `published_date`, e o `filter_by_published_date` os tira. A seção "Releases & changes" pode vir quase sempre vazia. Só dá para saber com o Tavily real.
- **Marcador fora de lista** ("veja [W3] e [W5]"): vira um prefixo com ":" no meio da frase. É feio, mas não engana.
- **Assistant:** a nota Paper é criada pela main. O botão vira "In reading list" pelo evento da própria janela depois do `onCreate`. Se a ponte responder antes de a main gravar as propriedades, a releitura não acha o DOI, e só a linha `Source:` garante o dedupe. Vale conferir no teste.

## 5. Avaliação frente aos objetivos do usuário

**"O que saiu de novo sobre o que eu estudo?"**
- **1º uso, com notas, sem perfil e sem chave do OpenAlex.** No Chat, o aviso do Tavily é claro. Com a chave, Enter roda: 30 dias, itens com link e data confiáveis, e uma proposta de perfil no fim. Bom. No chat das Anotações sem chave, falha em silêncio (D5).
- **Uso recorrente.** Numa conversa nova, no dia seguinte, a janela "desde a última consulta" funciona, mas o usuário não a vê (D2), não consegue alargá-la (M2), e na mesma conversa a pergunta de seguimento quebra (D1). O valor sobe muito com a linha do app (D2) e com a janela por conversa (D1).
- **Esforço:** 1 tecla para consultar e 1 clique por ação. A densidade em coluna estreita pesa (M3).

**"Quais artigos eu deveria conhecer?"**
- **Fundamentais e recentes, sem inventar:** bom. O usuário não vê o assunto buscado (D2), e num caderno recém-criado o Papers recusa (borda).
- **Fila de leitura.** 2 cliques criam a nota com o tipo e o board. O dedupe funciona, e o artigo já na fila nem volta como candidato. O caminho até a fila (M5) e até o PDF depois de limpar o chat (M1) estão incompletos.
- **Ler.** "Open in Library" num artigo de acesso aberto, já na fila, faz o melhor fluxo da task: o livro abre ligado à nota, e o chat do Reader funciona. Ele só existe enquanto o balão existe (M1).

**"O que mudou desde que escrevi esta nota?" (`/since`)**
- O fluxo é bom e respeita a nota (bloco não editável, "Possibly outdated" só com contradição explícita). Falta mostrar a data usada (M8). Repetir o comando no mês seguinte devolve o período inteiro de novo.

## 6. Oportunidades: funcionalidades relacionadas

| Sugestão | Problema que resolve | Impacto | Esforço | Prioridade |
|----------|---------------------|---------|---------|------------|
| O1 "Open in Library" e o link do PDF a partir da nota Paper e do card do board (M1) | A fila de leitura sobrevive ao chat efêmero | Alto | Médio | Agora |
| O2 "Add to note" por item: anexa a linha do item (título, link, data, motivo) à nota que ele toca ou à nota aberta | O Radar diz "toca na nota X", e o usuário quer guardar a novidade junto do seu material. Hoje só há "Save to note" da resposta inteira | Alto | Médio | Próximo |
| O3 Títulos de nota citados no "— toca em…" viram link para a nota, como as marcas já fazem (`linkNoteMarks`) | Leva da novidade ao trabalho do usuário em 1 clique | Médio | Médio | Próximo |
| O4 O Radar não repete o que já mostrou: guarda os hashes das URLs citadas por escopo (90 dias, na `radar_scope_state` ou numa tabela irmã) | Sobreposição entre consultas e repetição de páginas "atualizadas" | Médio | Médio | Depois |
| O5 `/since` desde o último `/since` da nota (M8) | Repetir o comando no mês seguinte traz o período inteiro de novo | Médio | Baixo | Próximo |
| O6 "Show the rest": os candidatos que o modelo não escolheu ficam acessíveis (lista recolhida, sem o modelo) | A data avança e os não escolhidos somem para sempre | Baixo | Médio | Depois |

**As mais promissoras:**
- **O1:** a fila de leitura é a parte durável desta task (é nota), e o PDF é o que transforma a fila em leitura. Com o link gravado na nota (P), a perda já some. O botão na nota completa o ciclo "descobrir → enfileirar → ler → anotar" dentro do Monet, que é a tese do produto.
- **O2:** é o ponto em que o Radar deixa de ser um feed e alimenta o caderno. O clique é do usuário, a IA não escreve sozinha, e a novidade vai para o lugar que ela "toca".
- **O3:** custa pouco perto do ganho, porque o modelo já nomeia a nota. Basta casar os títulos citados com as notas do mapa de foco.

## 7. Próximos passos recomendados

1. D5 (Anotações sem chave apaga o rascunho) e D6 (menu de tools sem o agente): P, alto ganho no 1º uso.
2. D1 (janela por conversa e seguimento sem nova busca) e D2 (a linha do app com escopo, janela e consultas): o centro do uso recorrente.
3. D3 (reserva de consultas e data) e D4 (perfil global vazando no escopo): P, prompts e ordem dos termos.
4. D7, D9, D8, D10, D11 e D12: textos e condições, todos P.
5. M1(a) (link do PDF na nota), M2 (janela pela mensagem), M3(a,b) (densidade), M5 (abrir a fila), M8 (data do `/since`).
6. Oportunidades O1 → O2 → O3.

### Opinião sobre os pontos em aberto
- **Sete agentes no seletor:** ainda se lê bem, porque cada item tem nome, descrição e comando. Radar e Papers se distinguem pelo nome e pelo composer ("only what is new since your last check" contra "foundational and recent papers"). A confusão vem da seção "Papers" dentro do Radar. Ver M4: "New papers", separadores e `max-height`.
- **Aviso de conflito do tipo Paper só no console:** levar ao estágio de sucesso do modal (D11).
- **"In reading list" de nota arquivada:** abrir a nota arquivada está certo; o rótulo, não (D10).
- **"Save a copy" no Paper:** esconder (D12).
- **Menu de tools das Anotações:** passar o agente (D6).
- **Indicador de busca no Papers:** rótulo por agente (D8).
- **"Só o que é posterior à última consulta" e como ver mais:** hoje o usuário não entende nem tem como ver mais. Isso pede D2 (a linha do app), M2 (data na mensagem) e D1 (a janela não encolhe dentro da conversa).
- **Limites (cobertura do OpenAlex, orçamento sem chave, data que pode ser de atualização):** o orçamento está bem explicado no erro e no Settings. A data pede o tooltip (M10). A cobertura de conferências não aparece em lugar nenhum da UI. Basta uma frase no estado vazio do Papers ("from OpenAlex; conference papers may be missing") e o assunto buscado na linha do app (D2), para o usuário reformular.

## 8. Premissas e limites da análise

- **Sem tela:**
  - a densidade real da `AgentItemsList` em 220–300 px (as estimativas de M3 são de largura de texto, não medidas);
  - o menu de 7 agentes de 320 px na coluna das Anotações e na janela Assistant (corte lateral e no topo);
  - a linha travada "Always on for Radar…" no popover;
  - o bloco do OpenAlex no Settings;
  - o modal do Paper com muitos cadernos;
  - a nota Paper renderizada no Tiptap (link, `Source:` e a citação "AI suggestion");
  - o board por Status.
- **Sem modelo:**
  - se o modelo respeita os marcadores, o teto e "Nothing new since";
  - o que ele faz no seguimento (D1 é inferido do código e do prompt);
  - se o planejador dá prioridade ao perfil em escopo de caderno (D4);
  - o formato do bloco "Radar profile" em português;
  - a qualidade das consultas do Radar, do Papers e do `/since`.
- **Sem rede:**
  - o formato do `published_date` do Tavily e quantas Releases sobrevivem ao filtro;
  - a relevância das duas passadas do OpenAlex e o orçamento real sem chave;
  - o download de PDFs de editoras;
  - o "Add to KB" com o extract do Tavily.
- **Tempo do pipeline:** o planejador, as buscas paralelas e a leitura da KB acontecem antes do 1º token, e não medi quanto demoram. Se passar de ~10 s, a linha "Searching…" sozinha pode não bastar, e etapas ("Planning searches…", "Searching…") ajudariam.
- **Validação sugerida:** usar o Radar por duas semanas em 2–3 cadernos reais, contando quantas respostas viram "Nothing new", quantos itens recebem clique (Open, Mincer, KB) e quantas mensagens de seguimento aparecem por conversa. No Papers, contar quantos artigos entram na fila e quantos chegam a "Reading" ou "Read", e quantas vezes o "Open in Library" falha por editora.
