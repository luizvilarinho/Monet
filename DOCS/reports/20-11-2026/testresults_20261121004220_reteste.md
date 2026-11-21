# Resultado do reteste dirigido — correções do Radar, Papers, menu de agentes, "+" do Calendar e Settings

Branch `feat/radar-trackers`, sem commit. Executado em 2026-11-21, da 00:25 às 00:45, no app de dev dirigido por CDP (porta 9333), com o OpenRouter e o Tavily reais do Coordenador e o OpenAlex sem chave. Base: `testresults_20261120235817_radar-papers.md` (o que falhou) e a última sessão de `codeAgent` do `executionreport_20261120115512.md` (o que foi corrigido).

Capturas e textos em `C:\Users\User\AppData\Local\Temp\claude\da5ad64cd5786c71\a098a092-11a2-4361-a2cb-5e2fe4c17de2\scratchpad\cdp\shots3\` (o nome começa pelo código do item). Os `.txt` das respostas trazem o texto completo, a linha do app, as consultas e os itens do payload. Scripts em `...\scratchpad\cdp\t3\`.

## Resumo

| Resultado | Itens |
|---|---|
| passou | R1, R2, R3, R4, R5, R7, R8, R9, R10 |
| falhou | R6 (no app como estava rodando; **causa: cache velho do servidor Vite, não o código do disco**; com o contorno descrito, o comportamento esperado aparece) |
| não feito | nenhum |

**Achado mais importante, fora da lista:** o servidor de dev (Vite) está servindo uma versão **velha** de `src/components/ChatPanel/ChatMessageBubble.tsx`, sem o `export const STOPPED_BEFORE_REPLY`. Efeitos medidos: (1) o Stop no Radar derruba a janela principal na tela "Something went wrong — STOPPED_BEFORE_REPLY is not defined"; (2) **uma carga nova do app (botão Reload da tela de erro, ou reabrir a janela) falharia na importação de `NotesChatPanel.tsx`** ("does not provide an export named 'STOPPED_BEFORE_REPLY'"). A página que testei foi carregada às 22:35 de 20/11, antes das correções, e recebeu as mudanças por HMR. Detalhes na seção "R6" e em "Achados fora da lista". Eu não reiniciei o servidor nem toquei em arquivo do projeto, como pedido.

## Tabela de itens

| Item | Resultado | O que observei de fato | Captura / arquivo |
|---|---|---|---|
| R1 | **passou** | Caderno "ZZ teste RAG" com 5 notas e a pasta "Notebook - ZZ teste RAG" (criada junto com o caderno e já ligada a ele). Três consultas do Radar nesse escopo (Enter vazio; "again"; conversa nova). Nenhuma das 18 consultas "searched:" trouxe Prompt Engineering, RLHF ou arquitetura de software; a linha do app **não** disse "radar profile" em nenhuma (`search.profile` = false nas três). Reparos: (a) "LLM" aparece como qualificador de assuntos de RAG ("RAG LLM evaluation metrics", "hallucination detection in LLMs"), nunca como assunto solto; (b) na conversa nova saiu **"Dante Divine Comedy analysis"**, vinda de "Books in progress" (o livro "A Divina Comédia" da Library do Coordenador, que a spec §3 manda entrar no mapa), fora do assunto do caderno, mas não do perfil; (c) os itens das duas primeiras consultas são todos de RAG; a 3ª, na conversa nova, deu 0 itens ("Nothing new since 21/11/2026."), então "os itens são do assunto do caderno" não tem o que julgar nela. Linhas do app abaixo. | R1-1-enter-vazio, R2-1-again, R1-3-nova-conversa (.png e .txt) |
| R2 | **passou** | Mesma conversa do R1, depois da 1ª resposta. "again": lista nova (3 News, 1 Release, 4 papers), sem pergunta de confirmação, sem retratação. "since 01/11": lista nova (1 News, 2 Releases, 5 papers), linha "since 01/11/2026 (asked in your message)", sem retratação. Nenhuma das duas disse que respostas anteriores estavam erradas, inventadas ou fora dos candidatos, nem pediu para desconsiderá-las (busca por "disregard", "correct", "earlier answer", "not in the candidates" etc.: só apareceram palavras dentro de títulos de artigos). **Limite:** nesta ordem (R2 antes do R3) não havia pergunta de assunto anterior na conversa, então "o since trata do escopo inteiro e não do assunto de uma pergunta anterior" não foi exercitado de verdade; as consultas do "since 01/11" foram todas do caderno. | R2-1-again, R2-2-since (.png e .txt) |
| R3 | **passou** | "what's new about reranking models?": 3 consultas, `reranking models LLM`, `reranking models libraries`, `reranking models RAG`; nenhuma cola "Prompt Engineering" nem "software architecture". Reparo: "LLM" no fim da 1ª consulta (reranker de LLM), um dos termos do perfil do Coordenador, mas ligado a reranking, não solto. 5 itens (2 Releases, 3 papers), todos de reranking. Linha: "since 01/11/2026 (asked in an earlier message)". | R3-reranking |
| R4 | **passou** | Papers no caderno de RAG: Enter vazio (6 artigos), "Add to reading list" no 1º ("Evaluation of RAG Metrics for Question Answering in the Telecom Domain", DOI 10.48550/arxiv.2407.12873; modal e "Paper added"), depois "again": lista nova de 6 artigos (disjunta da 1ª), **sem retratar, sem pedir confirmação**; o artigo adicionado **não voltou** (0 ocorrências do DOI no payload e no texto). Primeiro e último parágrafo abaixo. | R4-1-papers-enter-vazio, R4-2-modal, R4-2-sucesso, R4-2-papers-again |
| R5 | **passou** | Caderno "ZZ teste vazio" (0 notas) com a pasta ligada. Radar com Enter vazio: recusa ("ZZ teste vazio" has no notes yet, so there is nothing to search against. Add some notes…), **sem buscar** (o status de busca não acendeu em nenhuma leitura, sem payload, sem linha de busca, sem linha nova em `radar_scope_state`), sem nada do perfil. Depois "what's new about rust async": status de busca aceso, 1 consulta (`Rust async`), **lista 4 itens** (1 News, 3 Releases) em vez de "Nothing new"; cada um marcado "rust async (the subject you asked about)". Reparo de qualidade: um dos itens aparece só com o título "Medium". | R5-1-vazio-enter, R5-2-rust-async (.png e .txt) |
| R6 | **falhou** (no app como estava rodando) / **passou** com o contorno | Ver a seção própria abaixo. Resumo: no Chat principal, com o Radar na pasta do caderno de RAG, cliquei em Stop 385 ms depois do envio (status "Searching news, releases and papers…" aceso). **1ª tentativa: a janela caiu na tela de erro "Something went wrong / STOPPED_BEFORE_REPLY is not defined / Reload".** Causa: o Vite serve uma versão velha de `ChatMessageBubble.tsx` (o disco tem a constante, o servidor não). Recuperei a janela sem recarregar (resetei o ErrorBoundary pelo React) e defini no navegador a constante que o módulo correto traria (`window.STOPPED_BEFORE_REPLY`). **2ª tentativa:** Stop 360 ms depois do envio; a conversa ficou com o balão "Radar · Stopped before the response started" e o botão **Retry**; mensagem gravada com `interrupted: "stopped"` e o modelo (`anthropic/claude-haiku-5.5`); nenhuma lista; sem linha em `radar_scope_state`. Conversa nova (mesmo caderno): linha "since 22/10/2026 (first check: last 30 days)", ou seja, a janela **não** avançou por causa do Stop. | R6-apos-stop (erro), R6b-apos-stop (balão com Retry), R6-nova-conversa, R6-stop.txt, R6b-stop.txt |
| R7 | **passou** | Notebook > painel Chat das Anotações, seletor de agentes (7 entradas). **Largura padrão (painel 618 px):** menu 320×440, left 1311, right 1631 de 1920. **Painel no mínimo (`monet:ai-width` 300; painel de 299 px):** menu **283×440**, left 1629, **right 1912** (8 px dentro de `innerWidth` 1920; antes eram 29 px fora); rola (scrollHeight 482 > 438). **Janela assistant (480×560):** menu 320×336, left 16, right 336. Painel devolvido a 618 (passou por 619 numa tentativa de volta; reajustei e conferi `monet:ai-width` = 618). | R7-1-menu-618, R7-2-menu-300, R7-3-menu-assistant |
| R8 | **passou** | Hoje = sáb 21/11. Os dois trackers do Coordenador não tinham marca hoje (Violão marcado só em 20/11), então criei "ZZ teste A" a "ZZ teste D" e marquei os 4 hoje. Célula "Sat 21 Nov": **3 pontos e o "+"**. Retângulos relativos à célula (28 px de altura): pontos top 23,5 e bottom 27,5; **"+" top 23, bottom 28,0** (= a base da célula, não passa); "+" de 5×5 px, left 29,3, right 34,3. **Altura da linha da grade não mudou:** células de 28 px e `gridH` 200,5 antes de criar, com 1, 2, 3 e 4 marcas. | R8-3-calendario-4-marcas, R8-zoom-hoje-4-marcas, R8-medidas.txt |
| R9 | **passou** | Settings > Web Search (só leitura, campos de chave removidos da cópia do texto): "Used by Web search, Deep research, /search, /profile, /expand, /since, the Radar and Add to KB to query the internet before responding." O rodapé também cita o Add to KB. | R9-settings-web-search, R9-settings-websearch-texto |
| R10 | **passou** | Nas respostas do Radar com itens (R1-1, R2 again, R2 since, R3, R5-2, R6 nova; 7, 8, 8, 5, 4 e 8 itens) e na resposta do R1-3 (0 itens), nenhum item tem fonte "google.com" nem URL `google.com/url?…` (busca por "google" nos textos do Radar: 0 ocorrências). **Limite:** nenhuma consulta desta rodada trouxe um redirecionamento do Google, então a conversão em si (`resolveResultUrl`) não foi exercitada; só se vê a ausência. | R1-1, R2-1, R2-2, R3, R1-3, R5-2, R6-nova (.txt) |

## Linhas do app (copiadas inteiras)

**R1, R2 e R3 (caderno "ZZ teste RAG"):**

- R1, consulta 1 (Enter vazio, conversa 1):
  `Notebook "ZZ teste RAG" · since 22/10/2026 (first check: last 30 days) · searched: RAG evaluation metrics, LLM-as-a-judge RAG, hybrid search reranking, RAG framework, RAG hallucination detection, chunking strategies retrieval`
- R1 e R2, consulta 2 ("again", conversa 1):
  `Notebook "ZZ teste RAG" · since 22/10/2026 (first check: last 30 days) · searched: RAG hallucination detection, hybrid search reranking, LLM-as-a-judge RAG evaluation, RAG framework updates, RAG evaluation metrics, chunking strategies retrieval`
- R2 ("since 01/11", conversa 1):
  `Notebook "ZZ teste RAG" · since 01/11/2026 (asked in your message) · searched: RAG hallucination detection, hybrid search reranking, RAG tools updates, chunking strategies retrieval, RAG evaluation metrics, LLM-as-a-judge RAG`
- R3 ("what's new about reranking models?", conversa 1):
  `Notebook "ZZ teste RAG" · since 01/11/2026 (asked in an earlier message) · searched: reranking models LLM, reranking models libraries, reranking models RAG`
- R1, consulta 3 (Enter vazio, **conversa nova**; 0 itens, resposta "Nothing new since 21/11/2026."):
  `Notebook "ZZ teste RAG" · since 21/11/2026 (last check) · searched: RAG LLM evaluation metrics, hybrid search reranking, Dante Divine Comedy analysis, RAG framework updates, retrieval-augmented generation optimization, hallucination detection in LLMs`

**R5 (caderno "ZZ teste vazio"):**

- Enter vazio: resposta de recusa, **sem linha do app** (não houve busca).
- "what's new about rust async":
  `Notebook "ZZ teste vazio" · since 22/10/2026 (first check: last 30 days) · searched: Rust async`

**R6 (conversa nova depois do Stop):**
  `Notebook "ZZ teste RAG" · since 22/10/2026 (first check: last 30 days) · searched: RAG advancements LLM retrieval, RAG framework updates, hybrid search libraries, RAG metrics question answering evaluation, hallucination detection RAG LLM, hybrid search reranking retrieval`

**R4 (Papers, sem janela):**

- Enter vazio: `Notebook "ZZ teste RAG" · searched: RAG evaluation metrics, retrieval augmented generation chunking strategies`
- "again": `Notebook "ZZ teste RAG" · searched: RAG evaluation metrics question answering, hybrid search reranking retrieval augmented generation`

## Primeiro e último parágrafo (R2 e R4)

As respostas do Radar e do Papers são só listas (sem texto de abertura nem de fechamento): o "primeiro parágrafo" é o primeiro bloco e o "último" é o último bloco. Nenhuma tem frase fora da lista. (Em todas, o Radar anexou também o bloco "Radar profile" de proposta só na 1ª consulta de um escopo, ver "Achados fora da lista", item 2.)

**R2 "again" — primeiro bloco:**

> **News**
> - **[The evolution of GraphRAG: Advancing systems and evaluation together - Microsoft Research](https://www.microsoft.com/en-us/research/story/the-evolution-of-graphrag-advancing-systems-and-evaluation-together)** (microsoft.com, 17/11/2026): Microsoft Research sets out GraphRAG evaluation on comprehensiveness, diversity and empowerment, alongside the system changes. Touches: ZZ teste RAG, "RAG evaluation metrics"
> - **[Evals All the Way Down: Fault Localization in Compound AI Systems](https://medium.com/@adnanmasood/evals-all-the-way-down-fault-localization-in-compound-ai-systems-9967129f51a8)** (medium.com, 05/11/2026): Argues that flat end-to-end scores can't show whether the chunker, parser or reranker caused a failure. Touches: "Chunking strategies for retrieval", "Hybrid search and reranking"
> - **[Air Canada's Nathanael Weill says agents you can't grade are agents you can't improve — BigGo Finance](https://finance.biggo.com/news/11bb371727fec2d5)** (finance.biggo.com, 22/10/2026): Describes an evaluation method that generates questions from source pages and compares what the agent retrieves. Touches: "LLM-as-a-judge for RAG answers"

**R2 "again" — último bloco ("New papers", 4 itens; o último deles):**

> - **[RAG-X: Systematic Diagnosis of Retrieval-Augmented Generation for Medical Question Answering](https://doi.org/10.1145/3799682.3839903)** (Sivakumar, Sugumaran, Qiang, 2026 · 10 citations · Open access): Diagnoses RAG errors in medical QA with metrics that aim to show where an error originates. Touches: "RAG evaluation metrics"

(bloco inteiro em `R2-1-again.txt`)

**R2 "since 01/11" — primeiro bloco (inteiro):**

> **News**
> - **[Learnbay on Facebook: "Your RAG system cites a real document. Why is the answer still wrong? Often it's chunking. If a chun…"](https://www.facebook.com/learnbay/posts/your-rag-system-cites-a-real-document-why-is-the-answer-still-wrongoften-its-chu/1723516489789534)** (facebook.com, 16/11/2026): A practitioner post says RAG answers can be wrong because of chunking, and covers semantic chunking and testing chunks by retrieval quality. — "Chunking strategies for retrieval"

**R2 "since 01/11" — último bloco ("New papers", 5 itens; o último deles):**

> - **[RAG-X: Systematic Diagnosis of Retrieval-Augmented Generation for Medical Question Answering](https://doi.org/10.1145/3799682.3839903)** (Sivakumar, Sugumaran, Qiang, 2026 · 10 citations · Open access): A diagnostic study of RAG for medical QA proposes metrics that aim to locate where an error originates. — "RAG evaluation metrics"

(bloco inteiro em `R2-2-since.txt`)

**R4, 1ª resposta (Enter vazio) — primeiro bloco** ("Foundational", 1º item): **Evaluation of RAG Metrics for Question Answering in the Telecom Domain** (Roychowdhury, Soman, Ranjani et al., 2024 · 67 citations · Open access): Compares RAG metrics such as RAGAS for QA, which bears directly on your "RAG evaluation metrics" note and on how much to trust LLM-judged scores.
**Último bloco** ("Recent", último item): **Evaluating RAG Metrics in Applied Contexts: An Experiment, Its Findings and Its Limitations** (Brabant, 2026 · 0 citations · Open access): An empirical test of Ragas, DeepEval, RAGChecker and Opik against human scores, useful for checking which metrics to rely on in "LLM-as-a-judge for RAG answers."

**R4, "again" — primeiro bloco** ("Foundational", 1º item): **Enhancing Financial Report Question-Answering: A Retrieval-Augmented Generation System with Reranking Analysis** (Cheng, Lai, Liu et al., 2026 · 42 citations · Open access): Hybrid full-text and semantic retrieval with cross-encoder reranking, which connects directly to your "Hybrid search and reranking" note.
**Último bloco** ("Recent", último item): **Evaluating RAG approaches for Question Answering** (Agosti, D'Errico, Fantozzi et al., 2026 · 0 citations · Open access): A comparison of six RAG architectures for QA, which helps situate the "RAG evaluation metrics" note within the architecture choices.
(A resposta inteira, 6 itens em "Foundational" e "Recent", está em `R4-2-papers-again.txt`.) Nenhuma frase de retratação, pergunta ou aviso.

## Falhas

### R6 — Stop durante o planejamento (como o app estava rodando)

- **Esperado:** a conversa fica com um balão do agente "Stopped before the response started" e Retry; a janela de datas não avança.
- **Apareceu na 1ª tentativa:** a janela principal inteira trocou para a tela do `ErrorBoundary`: "Something went wrong — STOPPED_BEFORE_REPLY is not defined — Reload" (captura `R6-apos-stop`). A mensagem do assistente foi gravada vazia e sem `interrupted` (`R6-stop.txt`); depois do reset do boundary, o balão apareceu como "Responding in another window…".
- **Causa (verificada; é de ambiente, não do código do disco):**
  - `src/components/ChatPanel/ChatMessageBubble.tsx` no disco (mtime 00:19:23) tem `export const STOPPED_BEFORE_REPLY = 'Stopped before the response started'` na linha 58 e a usa na linha 255.
  - O módulo que o Vite serve em `/src/components/ChatPanel/ChatMessageBubble.tsx` **não tem a definição** (só o uso; 579 linhas, sem `STOPPED_BEFORE_REPLY` exportado). O mesmo arquivo pedido com um parâmetro novo (`?zz=1`, que força uma transformação nova) **tem** a constante (580 linhas). Ou seja, o cache de transformação do servidor guarda um estado intermediário do arquivo (o último evento de gravação, 38 ms depois do anterior, parece ter se perdido; o `?t=1795231163243` do import em `NotesChatPanel.tsx` é anterior ao mtime do arquivo).
  - Comparei o servido com a transformação nova nos **86 arquivos `.ts/.tsx/.css` alterados** da árvore: só `ChatMessageBubble.tsx` difere.
  - A página do app foi carregada às 22:35 de 20/11 (antes das correções) e recebeu os módulos novos por HMR; por isso o resto das correções estava ativo (R1 a R5 e R7 a R9 só podem ter o resultado que tiveram com o código novo; no R7 só dá para ver o efeito do CSS).
  - Consequência pior: um `import()` de `NotesChatPanel.tsx` (que importa `STOPPED_BEFORE_REPLY`) falha com "The requested module '/src/components/ChatPanel/ChatMessageBubble.tsx?t=… does not provide an export named 'STOPPED_BEFORE_REPLY'". **Uma carga nova do app (inclusive o botão Reload da tela de erro) quebraria a janela até o servidor reler o arquivo.**
- **Contorno que usei (só no navegador, nada no disco):** (1) defini `window.STOPPED_BEFORE_REPLY = 'Stopped before the response started'`, que é o valor do módulo correto; (2) resetei o `ErrorBoundary` pelo estado do componente React em vez de recarregar a página. Com isso o comportamento esperado apareceu inteiro (2ª tentativa na tabela). O contorno é **só da página** e some num reload.
- **Passos para repetir sem o contorno:** com o servidor nesse estado, Chat principal, pasta do caderno de RAG, nova conversa, `/radar` + Enter, Enter vazio e, com o status "Searching news, releases and papers…" aceso, clicar em Stop (cliques entre ~300 e ~500 ms depois do envio).
- **O que resolve (para o Coordenador; não fiz):** reiniciar `npm run tauri:dev`, ou salvar `ChatMessageBubble.tsx` de novo para o observador reler o arquivo. Depois, vale repetir o R6 (e abrir o app de novo) sem contorno.

## Quantas execuções de cada agente

| Agente | Execuções |
|---|---|
| Radar, consultas completas com busca (Tavily + planejador + até 3 no OpenAlex) | **7**: R1-1 (Enter vazio), "again", "since 01/11", "what's new about reranking models?", R1-3 (conversa nova), R5 "rust async", conversa nova do R6 |
| Radar, recusa sem busca | 1 (R5, caderno vazio, Enter vazio) |
| Radar, parado no planejamento (só a chamada do planejador) | 2 (R6: a que travou a janela e a repetida com o contorno) |
| Papers, consultas com busca (até 4 chamadas ao OpenAlex cada) | 2 (R4: Enter vazio e "again") |
| Outras | nenhuma (sem Mincer, Add to KB, `/since`, chat comum). Podem ter ocorrido as chamadas automáticas de "Folder memory updated" depois dos turnos nas pastas novas |

O erro de orçamento esgotado do OpenAlex não apareceu em nenhuma consulta.

## Achados fora da lista (para o Coordenador decidir)

1. **Cache velho do Vite (acima).** É o que mais importa agora: antes de fechar a rodada, reiniciar o servidor de dev e repetir pelo menos R6 e R7 (Anotações), que dependem de `ChatMessageBubble.tsx` e `NotesChatPanel.tsx`.
2. **O Radar passou a propor "Save radar profile" na 1ª consulta de cada escopo de caderno, mesmo com o perfil do Coordenador salvo.** Aconteceu em 3 de 3 primeiras consultas (R1-1, R5 "rust async", R6 nova): a resposta termina com o bloco "Radar profile / Follow: … / Sources: any / Ignore: nothing yet" e o botão "Save radar profile" (confirmado no DOM da resposta do R6; **não cliquei**). Causa provável: no escopo estreito o contexto agora não leva nenhuma linha do perfil (só Sources e Ignore, e o perfil dele só tem "any" e "nothing yet"), e também não diz "Radar profile: none."; o modelo propõe mesmo assim, porque o contexto diz "First check of this scope: yes". Se o Coordenador salvar, a nota nova (a spec diz que vale a editada por último) passaria a mandar no lugar do perfil dele, em todo escopo "tudo". Nas consultas que não eram a 1ª do escopo não houve proposta.
3. **Consulta fora do assunto vinda de "Books in progress":** "Dante Divine Comedy analysis" na consulta do R1-3 (a spec §3 manda os livros em andamento entrarem no mapa do caderno). Uma das 6 buscas do Tavily daquela rodada foi gasta com isso.
4. **"+" do Calendar:** a base do "+" coincide exatamente com a base da célula (28,0 de 28), então o traço inferior encosta na borda da célula (visível no zoom `R8-zoom-hoje-4-marcas`). Conforme o pedido ("não passa da base"), passou; só registro que não há folga.
5. **Menu de agentes a 300 px:** com a coluna estreita o menu fica com 283 px (cabe com 8 px de folga) e a altura de rolagem sobe de 466 para 482 px porque os textos quebram.
6. **Título "Medium"** em um item do R5 (a página só tem esse título), como já tinha aparecido no teste anterior.
7. **O "again" num caderno sem notas** recusa em vez de repetir o assunto (o codeAgent já deixou isso registrado em "Left behind (b)"); não testei.

## Limpeza

Tudo o que criei foi apagado pela interface, exceto o que está em "Não consegui limpar" abaixo.

| O que criei | Feito |
|---|---|
| Cadernos "ZZ teste RAG" (6 notas: 5 de RAG e 1 Paper) e "ZZ teste vazio" (0 notas) | apagados pelo botão "Delete notebook" (o diálogo disse que apaga também o chat: 6 conversas e 1 conversa) |
| Pastas de chat "Notebook - ZZ teste RAG" e "Notebook - ZZ teste vazio" e as 7 conversas (incluída a que travou no Stop) | apagadas junto com os cadernos; `monet:chat-conversations` voltou a 62 e `monet:chat-folders` a 23, **idênticos ao início** |
| Nota Paper "Evaluation of RAG Metrics for Question Answering in the Telecom Domain" | apagada com o caderno |
| Trackers "ZZ teste A", "B", "C" e "D" e as 4 marcas de hoje | apagados pelo "Delete" do Manage (o diálogo confirmou cada um: "removes it and its 1 marked day"); `trackers` e `tracker_marks` **idênticos ao início** (Violão, Academia e a marca de 20/11) |
| Linhas de `radar_scope_state` dos meus dois cadernos | apagadas com `DELETE` (a tabela é do app e o pedido mandava restaurar) |
| Largura do painel de IA | 618 (passou por 300 e 619), `monet:ai-width` igual ao início |
| Conversa ativa do Chat (`monet:chat-active-id`) | reaberta pela barra lateral: "me passa a lista de aulas ao vivo que que eu ja pe…" (pasta MBA), igual ao início |
| Modo e nota da main | Notebook, vista Calendar, nota 20/11/2026 aberta (`monet:last-location` igual ao início), lista de cadernos recolhida (`monet:notebook-collapsed` = 1), aba Chat do painel direito |
| `monet:agent-note-by-message`, `monet:chat-save-last-notebook-id`, `monet:note-order`, `monet:open-notes` | restaurados ao valor inicial por escrita direta no `localStorage` (o app mexeu neles quando salvei o Paper, abri notas e passei pelo Calendar) |

### `radar_scope_state` (antes e depois)

| | Conteúdo |
|---|---|
| Antes (guardado no início) | `[{"scope_key":"notebook:rfKlUBDHjK0znqV62Ybn-","last_run_date":"2026-11-20","updated_at":1795224218166}]` (1 linha, do Coordenador) |
| Durante o teste | + `notebook:q6vuULo0jI5WCq2CzDlJJ` (RAG, `2026-11-21`) e + `notebook:t6wJy91wgPeFU4zRJg3sn` (vazio, `2026-11-21`). A linha do RAG foi apagada por mim no meio do R6 e voltou na consulta da conversa nova. A linha do Coordenador **não mudou** (nenhuma consulta rodou no caderno dele) |
| Depois (restaurado) | `[{"scope_key":"notebook:rfKlUBDHjK0znqV62Ybn-","last_run_date":"2026-11-20","updated_at":1795224218166}]`, **idêntico ao início** (comparado por JSON) |

No R6, para a janela de datas poder mostrar "first check" outra vez, apaguei por `DELETE` a linha do **meu** caderno de RAG antes do Stop (o escopo já tinha "last check" de hoje por causa das consultas anteriores). Depois do Stop a tabela continuou sem a linha do RAG, e a conversa nova mostrou "first check: last 30 days".

### Contagens antes e depois

`notes` 213 → 213 (conjunto de linhas, `updated_at` e `created_at` idênticos aos do início); `notebooks` 11 → 11; `books` 7 → 7; `ai_responses` 105 → 105; `note_types` 10 → 10; `trackers` 2 → 2; `tracker_marks` 1 → 1; conversas 62 → 62; pastas de chat 23 → 23. Nenhuma linha com "ZZ teste" no banco (notas, cadernos, trackers) nem no `localStorage`. As notas de RAG do caderno de teste não levam o prefixo "ZZ teste" no título (só o caderno leva), porque os títulos descritivos são o material do teste; foram apagadas com o caderno.

### Não consegui limpar ou restaurar

1. **`window.STOPPED_BEFORE_REPLY` na página principal** (o contorno do R6): fica na memória da página até um reload. Deixei de propósito, porque sem ele um novo Stop no Radar derruba a janela de novo enquanto o servidor tiver o módulo velho. Não grava nada em disco nem em `localStorage`.
2. **Destaque do dia no Calendar:** no início, a vista mostrava o dia 21 (hoje) como selecionado com a nota de 20/11 aberta (estado herdado da virada de dia); agora a nota de 20/11 está aberta e o destaque de seleção está no dia 20, com o 21 só como "hoje". Por isso a coluna esquerda do Calendar mostra "Edited this day" no lugar da caixa "Overdue" da captura inicial. O `monet:last-location` é idêntico ao do início, e não dá para reproduzir a combinação original sem editar uma nota.
3. **`monet:update-last-check`:** mudou de 1795144684311 para 1795231936935; é a verificação automática de atualização do próprio app (≈00:32), não é minha.
4. **O histórico "Opened today" em memória** pode ainda listar notas que abri (o `localStorage` voltou ao valor inicial; sem recarregar a página não há como o app reler).
5. **Cliques em "Open"/links:** nenhum nesta rodada (nenhuma página externa aberta).
6. Os scripts e imagens do teste ficam só no scratchpad; nada foi gravado no projeto além deste relatório.
