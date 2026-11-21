# Resultado do teste manual — constância nos agentes, Radar, `/since`, Papers e Settings

Roteiro: `DOCS/reports/20-11-2026/testscript_20261120205725.md` (partes 4, 5, 6, 7 e 8, menos os itens excluídos no pedido). Branch `feat/radar-trackers`, sem commit. Executado em 2026-11-20, das 23:15 às 23:58, no app de dev dirigido por CDP (porta 9333), com o OpenRouter e o Tavily reais do Coordenador e o OpenAlex sem chave.

Capturas e textos das respostas dos agentes em `C:\Users\User\AppData\Local\Temp\claude\da5ad64cd5786c71\a098a092-11a2-4361-a2cb-5e2fe4c17de2\scratchpad\cdp\shots2\` (o nome começa pelo número do item). Os textos completos (resposta, linha do app, consultas e itens do payload) estão nos `.txt` da mesma pasta. Aviso: `5.24-notes-chat.txt` é um despejo da conversa errada (o chat das Anotações não usa o `monet:chat-active-id`); a resposta certa do item é `5.24-notes-chat-resposta.txt`.

## Contagem

| Parte | passou | falhou | não feito |
|---|---|---|---|
| 4 (constância nos agentes) | 6 | 0 | 1 (4.6) |
| 5 (Radar) | 22 | 2 (5.21, 5.26) | 7 (5.7, 5.11, 5.20a, 5.23, 5.27, 5.28, 5.29) |
| 6 (`/since`) | 7 | 1 (6.4) | 0 |
| 7 (Papers e fila de leitura) | 22 | 0 | 0 |
| 8 (Settings) | 2 | 1 (8.2) | 0 |
| **Total** | **59** | **4** | **8** |

São 71 linhas na tabela: o 5.20 foi dividido em 5.20a (recusa do escopo vazio, não testável com o perfil do Coordenador) e 5.20b (busca pelo assunto da mensagem). Dos 8 "não feito", 5 são por instrução do pedido (4.6, 5.23, 5.27, 5.28, 5.29) e 3 por limite do ambiente (5.7, 5.11, 5.20a: o perfil global do Coordenador existe).

## Antes de ler: fatos do ambiente e dois deslizes do meu script

1. **Perfil do Radar global do Coordenador existe** (nota "Radar profile", caderno "Livros"; segue Prompt Engineering, RLHF, LLMs e arquitetura de software). Como o perfil é global, ele entrou em **todas** as consultas do Radar (a linha do app diz "radar profile" em todas). Isso impediu o 5.7 e o 5.11 (não há proposta de perfil), impediu a recusa do 5.20 (escopo vazio com perfil não é "vazio") e é a base do 5.21.
2. **Tipo "Paper" já existia** (board por Status, uma nota do Coordenador): a frase "Your reading list is the Paper board…" do 7.5 não podia aparecer, e não apareceu.
3. **Não existia chave do OpenAlex** (`has_openalex_key` = false): fiz o 8.1 e removi a chave `zz-test-key` logo em seguida, antes de qualquer outra consulta (conferido: `has_openalex_key` de novo false).
4. **Deslize 1 (meu script, não é falha do app):** no 5.1 digitei `/radar` e apertei Enter duas vezes seguidas. O 1º Enter só selecionou o agente; o 2º, com o agente já selecionado, enviou "What's new?" e abriu a 1ª consulta (que virou o 5.3; a conversa ficou com uma única mensagem de usuário, "What's new?", então o 1º Enter não enviou nada). Repeti o 5.1 numa conversa nova (captura 5.01-radar-estado-vazio): rascunho vazio, agente Radar, 0 mensagens, e li o estado vazio.
5. **Deslize 2 (meu script):** na Assistant deixei o modal "Paper added" aberto e meus cliques de mouse em "Open in Library" caíram no modal. Fechei o modal e refiz o clique real: funcionou (7.19).
6. **A data passou de 23:15 a 23:58 durante o teste:** tudo rodou ainda em 20/11. Nenhum item cruzou a meia-noite.

## Tabela de itens

### Parte 4 — constância nos agentes

| Item | Resultado | O que observei de fato | Captura / arquivo |
|---|---|---|---|
| 4.1 | passou | Coach, Enter com rascunho vazio: a mensagem enviada foi "Check my plans". A resposta trouxe "**Violão** — 1/3 this week · 2 sessions to go, open days Sat 21/11 and Sun 22/11" e "**Academia** — 0/4 this week · 4 sessions to go, only 3 open days left (Fri 20/11, Sat 21/11, Sun 22/11); the target can't be reached this week". A faixa do Calendar mostrava Violão 1/3 e Academia 0/4. | 4.01-coach-resposta (.png e .txt) |
| 4.2 | passou | Menu de tools com o Coach: linha "Trackers" com ícone de alvo, texto "On for Coach", switch ligado e desabilitado (`aria-checked=true`, `disabled`). Web Search "Off for Coach". | 4.02-coach-tools |
| 4.3 | passou | Plan week: dias (Fri 20/11 ~4h com 2 itens; Mon 23/11 ~3h com 1 item; Tue a Fri free) e depois a seção "Trackers" com uma linha por tracker e semana ("Violão: 2 sessions — Sat 21/11, Sun 22/11"; "Academia: 4 sessions — Fri 20/11, Sat 21/11, Sun 22/11 (only 3 candidate days left this week)"; "Violão: 3 sessions — Mon 23/11, Wed 25/11, Fri 27/11"; "Academia: 4 sessions — Mon 23/11, Tue 24/11, Thu 26/11, Sat 28/11"). Sem horas nas linhas de tracker; os dias ficaram com no máximo 2 itens. | 4.03-planweek-resposta |
| 4.4 | passou | `/week-review` na nota diária de 22/11 (criada por mim, mesma semana 16–22): "## Trackers — Violão: 1/3 (sex 20/11) · em andamento, 3 dias restantes incluindo hoje; Academia: 0/4 · em andamento, 3 dias restantes incluindo hoje". A resposta saiu em português (idioma do usuário). Precisei de dois Enter: o 1º completa o comando no autocomplete, o 2º executa. | 4.04-weekreview-resposta |
| 4.5 | passou | Perguntei "How many times did I do **Violão** in October 2026?" (troquei "Guitar" por "Violão", o nome que o tracker do Coordenador tem). Resposta: "You recorded **0 days** of Violão in October 2026… weekly results for October are also marked as 'before the tracker started'". Bate com a linha do mês de outubro ("Started 20 Nov") e com o banco (única marca em 2026-11-20). Switch "Trackers" estava ligado (padrão). | 4.05-general-resposta |
| 4.6 | não feito | Instrução do pedido: não arquivar os trackers do Coordenador. | — |
| 4.7 | passou | Chat do Reader (livro que eu baixei no 7.13): o menu de tools lista Web Search, Daily notes, Notes, Folder memory e Retrieval details; **sem** "Trackers" (e sem Tasks). O chat respondeu a uma pergunta curta. | 4.07-reader-tools |

### Parte 5 — Radar

| Item | Resultado | O que observei de fato | Captura / arquivo |
|---|---|---|---|
| 5.1 | passou | Pasta "Notebook - ZZ teste RAG" (vinculada ao caderno). `/radar` + um Enter: rascunho vazio, agente "Radar", 0 mensagens enviadas. Estado vazio: "Radar searches the news, releases and papers about what you study and shows only what is new since your last check. To look further back, say 'since 01/11'. Press Enter to start, or name a notebook, a #tag, a board or everything." Quando o rascunho é só `/radar` completo, a lista de sugestões não aparece e o Enter já aplica o atalho. | 5.01-radar-estado-vazio, 5.01-estado-vazio.txt |
| 5.2 | passou | Menu de tools: Web Search com switch ligado e desabilitado, texto "Always on for Radar: the app runs the searches" (também no `title`). | 5.02-radar-tools |
| 5.3 | passou | Enter com rascunho vazio enviou "What's new?"; o composer mostrou "Searching news, releases and papers…" (~0,4 s a ~5 s). | 5.03-radar-resposta |
| 5.4 | passou | 7 itens: News (3) e New papers (4); sem "Releases & changes" nesta consulta. Cada linha: título em link, fonte (ou autores), data (ou ano e citações) e o que toca ("— RAG evaluation metrics, LLM-as-a-judge for RAG answers"). Nenhum marcador cru `[W3]`/`[P1]` em nenhum dos 11 textos de Radar (conferido por busca). | 5.03-radar-resposta.txt |
| 5.5 | passou | Linha do app: `Notebook "ZZ teste RAG" · since 21/10/2026 (first check: last 30 days) · radar profile · searched: Prompt Engineering LLMs, RLHF LLMs, RAG evaluation metrics, LLM-as-a-judge RAG, Hybrid search reranking, Chunking strategies retrieval`. (A data bate: 30 dias antes de 20/11.) | 5.03-radar-resposta |
| 5.6 | passou | Cliquei em "Open" em dois itens (News: microsoft.com; paper): os botões respondem, mas o navegador do sistema não é visível para mim, então conferi as páginas por fora. Paper Zenodo "FAITHFULNESS EVALUATION OF AN UZBEK-LANGUAGE RAG SYSTEM…": título, autor e data (10/11/2026) batem com o item (data 2026-11-10 no payload; o app mostra só "2026"). Página da Microsoft Research ("The evolution of GraphRAG…"): título e assunto batem, mas **a página não mostra data** (só dá para inferir novembro de 2026 pelas URLs de imagem; o app diz 17/11/2026). A página do artigo da ACM respondeu 403 ao meu leitor. O link do payload do paper é `https://doi.org/<doi>`. | 5.03-radar-resposta.txt |
| 5.7 | não feito | O perfil global do Coordenador existe, então a resposta não traz o bloco "Radar profile" nem o botão "Save radar profile". Visto: nenhum dos 11 textos de Radar tem o bloco. | — |
| 5.8 | passou | "Send to Mincer" no item da Microsoft: "Sending…" e logo "Queued in Mincer" (0,25 s). O item apareceu na lista do Mincer ("The evolution of GraphRAG…", 23:25) e terminou com resumo (status `done`). Apaguei o item pelo botão Delete do Mincer. | 5.08-queued, 5.08-mincer-item |
| 5.9 | passou | "Add to KB" com "Save web sources" desligado na pasta: confirmação "'Save web sources' is off in this folder. Turning it on lets the chat read saved pages and also lets the AI save the pages it finds in web searches here. Turn it on and add this page?" (botões Cancel / Turn on and add). Confirmado: "Adding…" e "In KB" em 0,5 s; `webResearchEnabled` da pasta passou a true e o switch do menu de tools ficou ligado. Gravou um `.md` de 18,5 KB na pasta "Save web sources — Notebook - ZZ teste RAG". | 5.09-confirmacao, 5.09-in-kb, 5.09-dialogo.txt |
| 5.10 | passou | Conversa sem pasta (`folderId` nulo), Radar no escopo da tag: 8 itens, 4 botões "Send to Mincer" e **0** "Add to KB". | 5.18-tag |
| 5.11 | não feito | Mesmo motivo do 5.7 (sem proposta, sem botão). | — |
| 5.12 | passou | "tell me more about the second one": nenhum status de busca acendeu, nenhuma lista nova, sem payload na mensagem. Respondeu pelo item certo (o 2º: "AI Metrics for Mere Mortals, Part 2…") e disse "I only have that summary, so I can't say more about its specific methods". Não inventou item. | 5.12-seguimento |
| 5.13 | passou | "obrigado": resposta "De nada!", sem busca. | 5.13-obrigado |
| 5.14 | passou | "again": rodou a busca (status acendeu) e a linha do app manteve a janela da 1ª consulta: `since 21/10/2026 (first check: last 30 days)`, não "desde hoje". **Mas a resposta foi uma pergunta ("Quer que eu faça uma nova verificação…?"), sem itens** (ver qualidade). | 5.14-again |
| 5.15 | passou | "what's new about reranking models?": buscou (status acendeu); 6 consultas, todas começando por "reranking models …"; 7 itens (1 News, 3 Releases, 3 papers). | 5.15-assunto |
| 5.16 | passou | "since 01/11": linha do app `since 01/11/2026 (asked in your message)`. 1 item. O texto da resposta tem um problema (ver qualidade). A data gravada do escopo não recuou (o 5.17 mostrou "last check: 20/11/2026"). | 5.16-since |
| 5.17 | passou | Conversa nova na mesma pasta, Enter: `since 20/11/2026 (last check)`. A linha do app aparece; a resposta trouxe 1 item (post do Instagram), não "Nothing new since…". | 5.17-nova-conversa |
| 5.18 | passou | Conversa sem pasta, "/radar what's new in #zzteste": linha `Tag #zzteste · since 21/10/2026 (first check: last 30 days) · radar profile · searched: …` (6 consultas, todas sobre RAG). 8 itens. | 5.18-tag |
| 5.19 | passou | "what's new in board "Paper"": linha `Board "Paper" · since 21/10/2026 (first check: last 30 days) · radar profile · searched: …`. 3 itens. Rodei uma vez; a linha de estado do escopo foi apagada na limpeza. | 5.19-board |
| 5.20a | não feito | Caderno novo e vazio ("ZZ teste vazio"), Enter: **não recusou**; buscou pelos assuntos do perfil do Coordenador (6 consultas: Prompt Engineering RLHF LLMs, Software Architecture Design Decisions, …) e trouxe 7 itens "(Follow)". Pela spec §3, escopo sem notas **e sem perfil** é o "vazio"; com perfil o escopo não é vazio, então a recusa não podia acontecer. Não dá para testar a recusa com o perfil do Coordenador no banco. | 5.20a-vazio-enter |
| 5.20b | passou | "what's new about rust async" no mesmo caderno: 1 consulta, `searched: Rust async` (busca pelo assunto da mensagem). O app achou 3 itens, mas a resposta foi "Nothing new since 21/10/2026" e disse que nenhum toca o foco (ver qualidade). | 5.20b-rust-async |
| 5.21 | **falhou** | Perfil do Coordenador (assunto A: Prompt Engineering, RLHF, LLMs, arquitetura) e caderno de RAG (assunto B). Esperado: resultados de B. Observado: os **resultados** da 1ª consulta foram todos de B, mas o planejador de consultas colocou assuntos do perfil em quase todas as consultas do caderno (5.3: "Prompt Engineering LLMs", "RLHF LLMs"; 5.14: as mesmas; 5.15: "reranking models Prompt Engineering", "reranking models software architecture", "reranking models RLHF Prompt Engineering"; 5.16: "Prompt Engineering LLMs", "RLHF software architecture", "Prompt Engineering frameworks"; 5.17 e 5.24 e 5.25: idem), e na consulta da Assistant (5.25) **2 dos 6 itens** vieram do perfil ("— Follow: RLHF": post do Instagram sobre Nemotron e vídeo "RLHF Is a Map…") num caderno que não trata de RLHF. No escopo de tag (5.18) o planejador obedeceu e as 6 consultas foram só de RAG. Repetir: abrir o Radar na pasta do caderno "ZZ teste RAG" com o perfil do Coordenador salvo, 3 consultas seguidas. Causa provável: a regra "nunca acrescente um Follow que o escopo não toca" existe só no texto do prompt (`src-tauri/src/lib.rs:828-831`) e no do chat (`src/lib/agents/radar.ts:310`); nada no app impede (o `cleanQueries` não filtra por escopo). Como "LLMs" casa com "LLM-as-a-judge", o modelo do planejador lê o Follow inteiro como pertinente. É o risco de obediência ao prompt que o próprio roteiro sinaliza. | 5.03, 5.14, 5.15, 5.16, 5.17, 5.24, 5.25 (.txt) |
| 5.22 | passou | Conversa sem pasta, "/radar what's new in #zzteste", Stop clicado 534 ms depois do envio (durante "Searching…"): o turno parou; a conversa ficou só com a mensagem do usuário (sem balão do assistente, sem "Stopped", sem Retry) e **sem lista de itens**; `radar_scope_state` sem linha da tag. Segunda conversa nova, mesma mensagem: `since 21/10/2026 (first check: last 30 days)`, ou seja, a janela continuou a anterior (o Stop não avançou a data). Como a conversa é sem pasta, repeti a mensagem em vez de Enter vazio. | 5.22-searching, 5.22-apos-stop, 5.18-tag |
| 5.23 | não feito | Instrução do pedido (mexe na chave do Tavily). | — |
| 5.24 | passou | Chat das Anotações do caderno: `/radar` + Enter seleciona; menu de tools "Always on for Radar: the app runs the searches"; o Enter vazio rodou a busca com o status "Searching news, releases and papers…"; 2 itens. Coluna estreita: arrastei o painel para 300 px (mínimo); a lista ficou com 260 px e a linha de fonte e data ficou `display: none`. Os selos de PDF dos artigos encurtaram na rodada do 7.22 (mesmo painel a 300 px): "PDF available" e "No PDF", texto completo no tooltip. Observação fora do item: com o painel a 300 px o cabeçalho do chat sobrepõe os botões (o seletor de modelo cobre o botão de tools). | 5.24-notes-chat, 5.24-coluna-estreita, 7.22-coluna-estreita |
| 5.25 | passou | Janela Assistant (escondida; dirigida por CDP): `/radar` + Enter, Enter vazio; status acendeu; 6 itens (3 News, 3 Releases); botões Open, Send to Mincer e Add to KB (a pasta da conversa tem pasta). O "In reading list" e "Open in Library" abrem na janela principal (7.19). | 5.25-assistant-radar |
| 5.26 | **falhou** | Menu de agentes com 7 entradas. **Assistant:** menu de 320×336 px dentro da janela de 480×560 (top 120, bottom 456, left 16, right 336), rola (scrollHeight 466 > 334), sem corte. **Anotações com o painel na largura padrão (618 px):** menu 320×440, left 1312, right 1632, bottom 967 de 1009; rola (466 > 438); sem corte. **Anotações com o painel no mínimo (300 px):** menu 320×440 com left 1629 e **right 1949, 29 px além da janela de 1920 px**: os comandos `/general`, `/plan-week`… ficam cortados na borda direita (captura). Causa provável: o menu é ancorado à esquerda do botão (`left: 0`) e tem largura fixa de 320 px (`src/components/ChatPanel/AgentPicker.module.css:47-52`, `.menu`), sem teste de borda direita; só a altura tem teto (`max-height: min(60vh, 440px)`). Repetir: Notebook → painel Chat → arrastar a borda do painel até o mínimo → abrir o seletor de agentes. | 5.26-assistant-menu-agentes, 5.26-notes-chat-menu-618, 5.26-notes-chat-menu-agentes |
| 5.27 | não feito | Instrução do pedido (o Coordenador já testou). | — |
| 5.28 | não feito | Idem. | — |
| 5.29 | não feito | Instrução do pedido (mexe na chave do Tavily). | — |
| 5.30 | passou | Um item de página comum (arXiv HTML "AutoRAGBench…", enviado pela Assistant): o item do Mincer foi direto para `stage: summarizing` com o texto extraído, sem erro, terminou `done` com resumo. Não houve mensagem de Tavily. Apaguei o item. (Obs.: o item do 5.8, microsoft.com, também foi uma página comum que funcionou direto.) | 5.30-mincer |

### Parte 6 — `/since`

| Item | Resultado | O que observei de fato | Captura / arquivo |
|---|---|---|---|
| 6.1 | passou | Digitar `/` numa nota: grupo REVIEW com `/critique`, `/expand` (web), **`/since` (web)** "What changed since you wrote this note (web search from its date)", depois `/opinion`. O selo "web" aparece. | 6.01-autocomplete |
| 6.2 | passou | `/since` na nota "RAG evaluation metrics" (criada hoje, sem `date`): bloco "/since  20/11/2026 (note created)" (no embed inserido: "Since · 20/11/2026 (note created)"). 5 itens datados 20/11/2026 com fonte, em português. Todos com a mesma data, então "do mais novo ao mais antigo" não dá para conferir aqui (ver 6.5). | 6.02-since-resposta (.png, .txt), 6.04-inserido |
| 6.3 | passou | Troquei de nota e voltei: o parágrafo `/since` continua com a classe `monetCmdExecuted`. | 6.03-reabre-executado |
| 6.4 | **falhou** | Segui o roteiro ao pé da letra (rodar `/since` de novo, sem inserir o bloco): a resposta foi "Nenhum resultado relevante publicado desde 20/11/2026." mas o título saiu **"(note created)"** de novo, não "(last /since)". Depois de clicar **Insert** no bloco anterior e rodar outra vez, o título saiu `20/11/2026 (last /since)`, como esperado (resposta com 4 itens de 20/11). Esperado pelo roteiro: "(last /since)" sem passo extra. Causa: `lastSinceDay` só enxerga os blocos **embutidos na nota** (`loadEmbedResponses(contextContents…)`, `src/App.tsx:2564` e `:2682`; `src/lib/radar.ts:540`), o que a spec §8 descreve ("embutido na nota"), mas o texto da spec ("Rodar o `/since` duas vezes no mesmo dia dá corte de hoje") e o roteiro não dizem que o Insert é pré-requisito. Quem roda duas vezes sem inserir recebe de novo o corte da criação. Decisão para o Coordenador: ajustar o roteiro e a spec, ou fazer o corte olhar também os blocos não inseridos. (Na tentativa intermediária digitei por cima da linha executada: "/since /since" virou instrução "/since"; foi erro meu, não conta.) | 6.04b-since-apos-insert, 6.04-since-de-novo |
| 6.5 | passou | `/since 01/03/2026` na nota "Chunking strategies for retrieval": título do bloco "/since 01/03/2026" (a data que escrevi). 6 itens, do mais novo ao mais antigo: 02/10, 14/09, 10/08, 25/06, 13/04, 07/03/2026; fontes YouTube, Splunk, substack, prodinit, redis.io, arXiv. | 6.05-since-instrucao |
| 6.6 | passou | Nota "ZZ teste curta" com "Short note about RAG.": card "Failed · The note has no text to compare yet. Write what you know about the subject, then run /since." (sem busca). | 6.06-nota-curta |
| 6.7 | passou | `/since 01/01/2030`: card "Failed · The cutoff date is in the future." (status `error`, sem busca). | 6.07-futuro |
| 6.8 | passou | Criei a task "ZZ teste task slash" (com nota-corpo), rodei `/define latency` no corpo e abri a task no modal "Edit task" do Kanban: a linha `/define latency` continua `monetCmdExecuted` com Insert/Delete. **Limite:** não exercitei o `TaskModalEditor` (modal de uma task aberta de dentro de uma nota, `App.tsx:5222`), só o modal "Edit task" do Kanban. | 6.08-kanban-modal |

### Parte 7 — Papers e fila de leitura

| Item | Resultado | O que observei de fato | Captura / arquivo |
|---|---|---|---|
| 7.1 | passou | `/papers` + Enter só seleciona (0 mensagens). Estado vazio: "Papers finds the foundational and recent papers on what you study and adds the ones you choose to your reading list. It searches OpenAlex, where conference papers may be missing. Press Enter to start, or name a notebook, a #tag or everything." Web Search "Off for Papers" (desabilitado, desligado). | 7.01-papers-selecionado, 7.01-estado-vazio.txt |
| 7.2 | passou | Enter vazio enviou "Find essential papers"; status "Searching OpenAlex…" (0,4 a 3,8 s). | 7.02-papers-resposta |
| 7.3 | passou | 6 artigos: Foundational (3: LettuceDetect 2025 · 62 citações; RAG-HAT 2024 · 100; Evaluation of RAG Metrics … Telecom 2024 · 67) e Recent (3, todos 2026, 0 a 3 citações). Cada linha com título em link, autores, ano, citações, "Open access" e motivo ligado a uma nota do caderno. Linha do app: `Notebook "ZZ teste RAG" · searched: RAG evaluation metrics, hallucination detection RAG` (sem janela, sem "radar profile"). Qualidade na seção própria. | 7.02-papers-resposta.txt |
| 7.4 | passou | "tell me more about the first one": sem status de busca, sem lista nova; respondeu só com o que havia (título, autores, ano, 62 citações) e disse não ter o método. | 7.04-seguimento |
| 7.5 | passou | "Add to reading list" no 1º artigo: modal com o caderno "ZZ teste RAG" selecionado e o resumo "Creates a Paper note (Status: To read) with the DOI link, the PDF link when there is one, authors, year, abstract, the reason and an empty 'My notes' section. The Paper type is created on first use, with a board by Status." Confirmado: "Paper added · Saved as paper in ZZ teste RAG / …", botões Close, "Open reading list" e "Go to note". A frase "Your reading list is the Paper board…" **não apareceu** (tipo já existia). | 7.05-modal, 7.05-sucesso |
| 7.6 | passou | "Open reading list" abriu o board "Paper notes · by Status" com a nota na coluna "To read" (Year e Authors no card). Observação: o card mostra **"Year 2,025"** (e o card do Coordenador "2,006"): o número sai com separador de milhar. A lista de notas também mostra "Year: 2,025". | 7.06-board |
| 7.7 | passou | Conteúdo, na ordem: link do DOI; "Kovács, Ádám, Gábor Recski · 2025 · preprint · 62 citations · Open access"; `Source: https://openalex.org/W4414848608`; `PDF: https://arxiv.org/pdf/2502.17125`; "## Abstract" (inteiro, sem "(excerpt)"); "> **AI suggestion** (Papers, 20/11/2026): …"; "## My notes" vazio. Propriedades Status (To read), Year 2025, Authors e DOI preenchidas. A nota de um item do Radar (7.21) diz "AI suggestion (Radar, 20/11/2026)". | 7.07-conteudo-nota-paper.txt, 7.09-nota-paper-aberta |
| 7.8 | passou | No chat, o botão do mesmo artigo virou "In reading list" (abre a nota) e apareceu "Open in Library". | 7.08-in-reading-list |
| 7.9 | passou | Arquivei a nota: no chat o botão diz "Archived" (tooltip "Archived Paper note · click to open") e o clique abre a nota. Desarquivei (botão Unarchive; `archived_at` voltou a nulo). | 7.09-archived-btn, 7.09-abriu-arquivada |
| 7.10 | passou | "again": o artigo na fila (LettuceDetect) **não voltou** como candidato nem nos itens. Mas a resposta tem um problema grave de texto (ver qualidade): disse que a lista anterior "was not one of the papers the app found", e não gerou lista. | 7.10-papers-again |
| 7.11 | passou | Arrastei o card para "Reading" (mouse real): o card foi para "Reading (1)" e a propriedade Status da nota mudou de opção. | 7.11-board-antes, 7.11-board-depois |
| 7.12 | passou | Fora da fila, os artigos com PDF mostram só o selo "Open-access PDF" (ou "PDF available"); depois do "Add to reading list" aparece o botão "Open in Library". | 7.08-in-reading-list |
| 7.13 | passou | "Open in Library" (arXiv 2502.17125): "Downloading…", em 1,9 s a Library abriu o livro "LettuceDetect…" ("Page 1 of 8"), registrado com título e autores do artigo, ligado à nota Paper. A aba Notes do Reader abriu na nota Paper; o chat do Reader respondeu a uma pergunta. | 7.13-library, 7.13-reader-chat |
| 7.14 | passou | Apaguei a conversa do chat. Na nota Paper (livro ligado): barra "Open in Library \| Unlink" acima do conteúdo; o clique abriu o livro em ~0,35 s, **sem "Downloading…" e sem livro novo** (books 8 → 8). | 7.14-barra-com-livro, 7.14-abriu-livro |
| 7.15 | passou | 2º artigo (Radar, arXiv 2610.40742) adicionado à fila; sem usar o botão do chat, na nota: barra "Open in Library \| Link a Library book…"; o clique mostrou "Downloading…" e em 4,9 s abriu a Library ("Page 1 of 15"). **Não testei o caso do sublinhado (`_`) no caminho**: nenhum PDF dos candidatos tinha `_` (todos arXiv, ACM ou ACL). | 7.15-biblioteca |
| 7.16 | passou | Artigo da ACM (`dl.acm.org/doi/pdf/10.1145/3858063.3858878?download=true`, vindo do Radar): "Downloading…" e depois o erro **"Download failed: HTTP 403 Forbidden"** (212 ms). A nota Paper ficou, nenhum livro entrou (books 9 → 9). A mensagem "The link did not return a PDF (the publisher may require a browser)…" do roteiro é a de quando o servidor responde 200 com HTML; a spec §11 também lista o 403, que foi o caso. | 7.16-erro-editora |
| 7.17 | passou | Iniciei o download da nota da ACM e, 80 ms depois, cliquei em outra nota Paper: a outra nota não mostrou o erro (nenhum alerta, texto "403" ausente) e o app continuou no modo Notebook. **Limite:** só o caminho de erro (o download falha em ~210 ms, e eu só podia baixar 2 PDFs); o caminho de sucesso (livro + salto para a Library) não foi exercitado. | 7.17-outra-nota |
| 7.18 | passou | Um artigo sem acesso aberto não apareceu em nenhuma lista minha (todos eram OA). Conferi, só lendo, numa conversa antiga do Coordenador (pasta MBA, sem clicar nada): selo "No open-access PDF" (curto: "No PDF"). O `url` do item é `https://doi.org/10.1109/wicsa.2005.61` (ou a página do OpenAlex quando não há DOI). Não cliquei em "Open". | 7.18-sem-acesso-aberto |
| 7.19 | passou | Papers na Assistant: 6 artigos. "Add to reading list" abriu o modal; o sucesso mostra só "Close \| Go to note" (**sem "Open reading list"**); a nota foi criada pela main. Com o item "In reading list \| Open in Library" (vinculei antes meu livro à nota para não baixar um 3º PDF), o clique real na Assistant levou a main à Library com o livro ("Page 1 of 15"). | 7.19-assistant-sucesso, 7.19-main-livro-via-assistant |
| 7.20 | passou | Abri o modal do mesmo artigo ("ReDeEP…") na Assistant e na main; confirmei na main (nota criada) e depois na Assistant: o modal da Assistant mostrou "Paper added … Go to note" e o banco ficou com **uma** nota. | 7.20-modal-main, 7.20-modal-assistant, 7.20-assistant-apos |
| 7.21 | passou | Item da seção "New papers" do Radar (4 itens) tem "Add to reading list": adicionei dois ("Prevented is Not Protected…", "Faithfulness Under Pressure…") e as notas foram criadas. | 7.21-modal-radar, 7.21-sucesso |
| 7.22 | passou | Caderno novo e vazio ("ZZ teste vazio"), Anotações: "/papers find papers on retrieval augmented generation": consultas `retrieval augmented generation` e `RAG hallucination detection` (pelo assunto da mensagem); 6 artigos (Lewis et al. 2020 · 19.221 citações; Gao 2023 · 8.714; …); abre com "The scope has no notes yet, so these picks match the subject…". | 7.22-vazio-papers |

### Parte 8 — Settings

| Item | Resultado | O que observei de fato | Captura / arquivo |
|---|---|---|---|
| 8.1 | passou | Settings > Web Search, bloco "OpenAlex (optional)" abaixo do Tavily. Salvei `zz-test-key`: "Key saved. Key configured: OpenAlex searches use your own budget." (`has_openalex_key` true). Remover: confirmação "Remove the key? OpenAlex searches go back to the shared free budget." (Remove key / Cancel); depois "Key removed. No key: OpenAlex searches use the shared free budget." (`has_openalex_key` false). Nenhuma consulta entre salvar e remover. | 8.01-salvo, 8.01-confirmar-remocao, 8.01-removido |
| 8.2 | **falhou** | Texto de ajuda do Tavily: "Used by Web search, Deep research, /search, /profile, /expand, /since and the Radar to query the internet before responding." **Não cita o Add to KB.** A nota de rodapé está completa: "Web search is on: Web search, Deep research, /search, /profile, /expand, /since, the Radar and Add to KB query the internet." Esperado (roteiro e spec §9): os dois textos citam `/since`, o Radar e o Add to KB. Causa: `src/components/Settings/SettingsModal.tsx:618-619` (falta "Add to KB" no `formHelp`). Não abri a confirmação de remover a chave do Tavily (não toquei na chave). | 8.02-web-search, 8.02-settings-websearch-texto.txt |
| 8.3 | passou | Desliguei "Index this notebook's notes for AI" do caderno "ZZ teste RAG" (diálogo "Notebook Documents", confirmação "Turn off note indexing for this notebook? Its indexed copies are deleted. Your notes are not changed."). Radar na pasta do caderno: sem status de busca, sem payload, resposta de uma linha: "AI is turned off for the notebook "ZZ teste RAG" in Settings, so the Radar can't read it. Pick another notebook, or turn AI on for this one, and I'll check what's new." A data do escopo não mudou. Religuei (checkbox marcado; tabela de desligados vazia). Observação: o interruptor não fica em Settings, e sim no botão "documents for notebook …" da coluna de cadernos. | 8.03-radar-ia-desligada, 8.03-docs-modal |

## Falhas

**5.21 — o perfil do Radar vaza para o escopo de caderno.** Esperado: com o perfil seguindo A, o Radar num caderno de B devolve resultados de B. Apareceu: o planejador de consultas pôs assuntos do perfil em todas as 7 consultas do Radar no caderno de RAG (5.3, 5.14, 5.15, 5.16, 5.17, 5.24, 5.25; 2 a 3 das 6 consultas de cada) e na do board, e a escolha do modelo do chat deixou passar 2 itens "Follow: RLHF" num caderno de RAG (5.25). Só a 1ª consulta e o escopo de tag ficaram limpos de itens fora do assunto. Passos: pasta ligada ao caderno de RAG, perfil do Coordenador salvo, Radar com Enter vazio, ler a linha do app. Causa provável: a restrição só existe no texto dos dois prompts (`lib.rs:828-831` e `radar.ts:310`) e o `cleanQueries` não olha o escopo. Custo extra: 2 das 6 buscas do Tavily de cada consulta foram gastas com assuntos de fora.

**5.26 — menu de agentes cortado no mínimo da coluna das Anotações.** Esperado: o menu rola e não corta. Apareceu: a 618 px (padrão) e na Assistant está certo; a 300 px (mínimo do painel) o menu de 320 px sai 29 px da janela pela direita. Passos: Notebook, painel Chat, arrastar a borda até o mínimo, abrir o seletor. Causa provável: `AgentPicker.module.css` ancora o menu à esquerda do botão com largura fixa.

**6.4 — "(last /since)" só vale com o bloco inserido na nota.** Ver a linha do item. Passos: nota com texto, `/since`, esperar, `/since` de novo (sem Insert): título "(note created)". Com Insert: "(last /since)".

**8.2 — a ajuda do Tavily não cita o Add to KB.** Ver a linha do item (`SettingsModal.tsx:618-619`).

## Qualidade das respostas (separada de passa ou falha)

### Radar (11 consultas completas e 1 interrompida)

| Consulta | Janela (linha do app) | Itens | Observação |
|---|---|---|---|
| 5.3 "What's new?" (caderno RAG) | 21/10/2026 (first check) | 7: 3 News, 4 papers | Todos de RAG. 2 das 6 consultas eram do perfil. |
| 5.14 "again" | 21/10/2026 (first check, mesma janela) | 0 | Pergunta de volta em vez de lista. 7 consultas, 2 do perfil. |
| 5.15 "what's new about reranking models?" | 21/10/2026 | 7: 1 News, 3 Releases, 3 papers | As 6 consultas colam "reranking models" a assuntos do perfil ("… Prompt Engineering", "… software architecture"); 1 item cita "software architecture" como o que toca. |
| 5.16 "since 01/11" | 01/11/2026 (asked in your message) | 1 paper | O texto abre com "I did not find anything new about reranking models" (carregou o assunto da mensagem anterior) e termina "I also need to correct my earlier answers… were not in the candidates the app found, so please disregard them" (falso: os itens anteriores vieram dos candidatos). |
| 5.17 conversa nova | 20/11/2026 (last check) | 1 News | Post do Instagram sobre Nemotron/RLHF, ligado a "como você avalia respostas RAG" por um elo fraco. |
| 5.18 tag #zzteste | 21/10/2026 (first check) | 8: 3 News, 1 Release, 4 papers | Todas as 6 consultas de RAG; resposta boa; 2 itens repetiram os da consulta do caderno. |
| 5.19 board "Paper" | 21/10/2026 (first check) | 3 | Consultas e itens do perfil e do livro "Prompt Engineering for LLMs" (o board tem 1 card de arquitetura de software). |
| 5.20a caderno vazio, Enter | 21/10/2026 | 7 | Só assuntos do perfil ("(Follow)"). Um item é um link de redirecionamento `google.com/url?…` (fonte "google.com"). |
| 5.20b "rust async" | 21/10/2026 | 0 | A consulta foi "Rust async" (certo), mas o modelo descartou os 3 itens achados ("none touches this notebook's focus") e respondeu "Nothing new since 21/10/2026". O usuário nomeou o assunto e ficou sem resposta útil. |
| 5.24 Anotações | 20/11/2026 (last check) | 2 Releases | Dois blogs de 20/11, ambos ligados à nota "Hybrid search and reranking". |
| 5.25 Assistant | 20/11/2026 (last check) | 6: 3 News, 3 Releases | 2 do perfil (RLHF); 1 título só "Medium"; 1 item é "Integrated Framework Connects… EMS logs" (RAG clínico, fora do eixo do caderno). |

- **Fontes e datas.** Web: microsoft.com, medium.com, explainx.ai, unite.ai, dev.to, siliconflow.com, fde.academy, monterail.com, arxiv.org, youtube.com, instagram.com, bioengineer.org e um redirecionamento do google.com. Artigos: Zenodo, arXiv, ACM, ACL, Preprints.org. Datas web conferidas: Zenodo (10/11/2026) bate; a página da Microsoft não mostra data (só dá para inferir novembro); a ACM bloqueou meu leitor. Muitas datas do dia 20/11/2026 (itens do 5.17, 5.24, 5.25 e de todos os `/since`) são provavelmente a data de coleta ou de atualização da página: o app já avisa isso no tooltip, e o modelo pulou poucos candidatos por esse motivo.
- **Item inventado ou fora do assunto.** Nenhum item inventado: todos os links e títulos vieram do payload do app (conferi os itens citados contra os candidatos nas consultas 5.3, 5.18, 7.2, 7.19). Fora do assunto: os itens "Follow: RLHF" do 5.25, o do Instagram (5.17), o post de EMS (5.25) e, em menor grau, os do 5.19 e 5.20a (assuntos do perfil em escopo que não os toca). Fontes fracas: Instagram, YouTube, título "Medium", redirecionamento do Google, e artigos de blog tratados como "Releases & changes" (dev.to, fde.academy).
- **"again" e repetição na mesma conversa (problema de desenho).** Em 3 de 3 buscas repetidas numa conversa que já tinha uma resposta com itens (5.14, 5.16, 7.10), o modelo não produziu lista boa: pediu confirmação (5.14) ou disse que as respostas anteriores "não estavam nos candidatos" (5.16 e 7.10). A causa está no prompt: o bloco "Radar context" só traz os candidatos desta consulta ("Ignore older versions of it") e a regra "você só escolhe entre os candidatos"; os itens das respostas anteriores já não estão nesse bloco (no Papers, o app ainda tira de propósito o que já foi para a fila), então o modelo conclui que os itens anteriores eram inventados e "corrige" o usuário. O usuário vê uma retratação falsa. Vale um ajuste no prompt ("itens de respostas anteriores vieram de consultas anteriores do app").
- **Seguimento.** O 5.12 ("tell me more about the second one"), o 5.13 e o 7.4 responderam pela conversa, pelo item certo, sem acender a busca e sem lista nova, admitindo o que não sabem. Não inventaram item.
- **Escopo sem notas com perfil global.** Um caderno novo e vazio devolve resultados do perfil do Coordenador (5.20a). Coerente com a spec (o perfil torna o escopo "não vazio"), mas para quem tem perfil o Radar nunca recusa um caderno vazio, e quando o usuário nomeia um assunto que o perfil não cobre (5.20b), o modelo o descarta.

### Papers (4 consultas)

- **7.2 (caderno RAG, main):** 6 artigos relevantes e bem motivados (LettuceDetect, RAG-HAT, avaliação de métricas RAG; recentes: Brabant 2026, framework de avaliação, Retromorphic Testing). Fundamentais com 62 a 100 citações: o OpenAlex devolveu pouca coisa de peso para o recorte "RAG evaluation" ordenando por citações dentro das 40 por relevância.
- **7.19 (Assistant):** melhor lista: RAGAs (1.904 citações), ReDeEP, MIRAGE, RLSeek, "When Does Claim Decomposition Help?", Chen et al. 2026. Não repetiu os 3 já na fila, e um dos motivos cita uma nota Paper minha ("Faithfulness Under Pressure…") como parte do foco.
- **7.22 (caderno vazio, por assunto):** Lewis 2020 (19.221 citações), Gao 2023 (8.714), Chen 2024, Yan 2026, Yu 2025, Salemi 2024: seleção sólida. O primeiro item não tem DOI nem "Open access" na linha (link do OpenAlex). Os motivos citam "your in-progress RAG books" (meus dois livros da Library, que entram no mapa de foco como "livros em andamento").
- **7.10 ("again"):** o artigo da fila foi excluído como candidato (certo), mas a resposta retratou a lista anterior e não trouxe itens.
- **Cobertura de conferências:** nesta amostra, ACL/EMNLP/AAAI/NAACL apareceram (RAGAs, RAG-HAT, MIRAGE, RLSeek), ou seja, a cobertura foi melhor que o aviso sugere para este assunto.
- **Autores.** A linha do chat mostrou "Ádám, Recski" e a propriedade da nota "Kovács, Ádám, Gábor Recski": o OpenAlex parece devolver o autor na forma "Sobrenome, Nome" e o app pega o último token como sobrenome. Fora do roteiro; baixa prioridade.

### `/since` (5 consultas com busca; 2 cards de erro sem busca)

- **6.2** (corte hoje, "note created"): 5 itens, todos de 20/11/2026, sobre RAG (AutoRAGBench, STAIR da IBM, matriz de 17 metodologias, kappa de Cohen para juiz LLM, Instagram). Sem item inventado. Tudo do dia, então a ordem não se confere aqui.
- **6.4 (sem Insert)** "Nenhum resultado relevante publicado desde 20/11/2026"; **6.4b (com Insert, "(last /since)")**: 4 itens de 20/11; o que já estava no bloco inserido não se repetiu inteiro, mas 2 itens reapareceram.
- **6.5** (`/since 01/03/2026`): a melhor: 6 itens de março a outubro, do mais novo ao mais antigo, fontes variadas (Splunk, redis.io, arXiv), todos sobre chunking (o assunto da nota). Sem "Possibly outdated" (a nota não é contradita).
- A resposta sai em português mesmo com a nota em inglês (idioma do usuário).

### Coach, Plan week e `/week-review` contra a faixa de trackers

- **Coach:** os números batem com a faixa (Violão 1/3, Academia 0/4), com os dias abertos (Sab e Dom para o Violão, porque sexta já está marcada; Sex, Sab e Dom para a Academia) e com o aviso de que 4 sessões não cabem em 3 dias. Não trouxe as 4 últimas semanas nem o mês (o prompt só pede uma linha). Também falou de um plano do Coordenador (atrasado), certo.
- **Plan week:** a seção "Trackers" respeita a regra (sem horas, fora do teto de 4 itens). Uma inconsistência: "Academia: 4 sessions — Fri 20/11, Sat 21/11, Sun 22/11 (only 3 candidate days left)": 4 sessões em 3 dias, só com ressalva entre parênteses. As linhas de "next week" seguem a meta (3 e 4).
- **`/week-review`:** os números da seção Trackers batem com a faixa (1/3 e 0/4, "em andamento, 3 dias restantes incluindo hoje"). "3 dias restantes incluindo hoje" conta sexta como aberta para a Academia (certo) e também para o Violão, que já está marcado na sexta (o rótulo "incluindo hoje" é do app, e o número não muda a conclusão).

## Pontos marcados com "Atenção" no roteiro, com o veredito

| Item | Veredito |
|---|---|
| 4.5 (estimar ou dizer que não sabe; conferir o switch) | Passou: o modelo usou a tool (switch ligado) e respondeu 0, igual ao banco e à linha de outubro. |
| 5.4 (Releases pode vir vazia) | Veio vazia na 1ª consulta (3 News + 4 papers); veio com 3 itens em outras (5.15, 5.18, 5.20a, 5.25). Sem problema. |
| 5.12 (pode inventar item no seguimento) | Não inventou em 3 de 3 seguimentos (5.12, 5.13, 7.4). O risco real é o contrário, a retratação falsa em repetições (qualidade). |
| 5.21 (obediência do modelo que gera consultas) | **Falhou** (ver Falhas): o planejador desobedece a restrição na maioria das consultas de caderno. |
| 5.24 (coluna estreita <320 px: some a linha de fonte e data, selos encurtam) | Confirmado a 260 px de lista: meta `display: none` e selos "PDF available"/"No PDF". Mais um defeito visual fora do roteiro: cabeçalho do chat sobreposto a 300 px. |
| 7.3 (qualidade e cobertura de conferências no OpenAlex) | Boa nas 4 consultas; apareceram artigos de ACL/EMNLP/AAAI/NAACL. |
| 7.14 (a fila continua útil sem a conversa) | Passou: a nota abre o livro sem baixar de novo, com a conversa apagada. |
| 7.15 (URL do PDF passa pelo editor; `_` no caminho) | O caminho de leitura e download funcionou para URLs de arXiv. **O caso do sublinhado não foi exercitado** (nenhum candidato tinha `_`). |
| 7.24 e 5.26 (lista sobre o modal / menu sem corte) | O 7.24 foi do outro testador. O 5.26 falhou no mínimo da coluna. |

## Execuções de cada agente (custo)

| Agente | Execuções |
|---|---|
| Coach | 1 |
| Plan week | 1 |
| `/week-review` | 1 |
| General (chat, tools de trackers) | 1 |
| Radar, consultas com busca (Tavily + planejador + até 3 no OpenAlex) | 11 (5.3, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19, 5.20a, 5.20b, 5.24, 5.25) |
| Radar, interrompida no planejador (Stop, 5.22) | 1 (só a chamada do planejador) |
| Radar, sem busca (seguimento, agradecimento, IA desligada) | 3 (5.12, 5.13, 8.3) |
| Papers, consultas com busca (até 4 chamadas ao OpenAlex cada) | 4 (7.2, 7.10, 7.19, 7.22) |
| Papers, seguimento sem busca | 1 (7.4) |
| `/since` com busca | 5 (6.2, a tentativa "/since /since", 6.4 sem Insert, 6.4b, 6.5) + 2 cards de erro sem busca |
| `/define` (6.8) | 1 |
| Chat do Reader | 1 |
| Mincer (resumo por página) | 2 (microsoft.com, arxiv.org) |
| "Add to KB" (Tavily extract) | 1 |
| Resumos e atualizações de memória de pasta ("Folder memory updated") | automáticos, após turnos nas pastas com memória ligada (uma chamada extra por turno em pastas minhas) |

Teto de consumo estimado: Tavily até ~85 buscas (11 consultas do Radar × até 6, 5 `/since` × até 3, 1 extract); OpenAlex até ~50 buscas (11 do Radar × até 3, 4 do Papers × até 4). Não apareceu o erro de orçamento do OpenAlex em nenhuma consulta.

## O que não deu para testar, e por quê

- **4.6:** não arquivei os trackers do Coordenador (instrução).
- **5.7 e 5.11:** o perfil global do Coordenador existe; não há proposta nem botão "Save radar profile".
- **5.20a (recusa do escopo vazio):** o perfil do Coordenador faz o escopo não ser vazio.
- **5.23, 5.29:** mexem na chave do Tavily (instrução). **5.27, 5.28:** já testados pelo Coordenador.
- **7.5 (frase da primeira vez):** o tipo "Paper" já existia.
- **7.15 (sublinhado no caminho do PDF):** nenhum PDF candidato tinha `_`.
- **7.17 (caminho de sucesso):** só testei o caminho de erro, porque a regra de no máximo 2 PDFs já estava gasta (7.13 e 7.15) e o 7.16 falha em ~210 ms.
- **7.18 (item meu sem acesso aberto):** só consegui ver o selo numa conversa antiga do Coordenador (leitura, sem clicar).
- **5.6:** não consigo ver a janela do navegador aberta pelo "Open"; conferi por fora as páginas (Zenodo ok, Microsoft sem data na página, ACM 403).
- **6.8:** modal "Edit task" do Kanban testado; o `TaskModalEditor` (task aberta de dentro de uma nota) não.
- **Sobre a Assistant e a keep:** as janelas estão escondidas (`is_visible` false): cliques, capturas e `eval` funcionaram, mas "trazer a janela para frente" só pude inferir pelo estado da main (a main já era visível).
- **O spy de `invoke`:** tentei espionar o `openUrl` e o `emitTo` trocando `window.__TAURI_INTERNALS__.invoke`; a troca não pegou (objeto não gravável), então não afirmo nada pelo spy (o `emit_to` manual funcionou e comprovou o canal Assistant → main).

## Limpeza

Tudo que criei foi apagado pela interface do app, exceto o que está listado em "Não consegui limpar". Conferi no fim lendo o banco e o `localStorage`.

| O que criei | Feito |
|---|---|
| Cadernos "ZZ teste RAG" e "ZZ teste vazio" (11 notas no de RAG: 5 notas de RAG, "ZZ teste curta" e 5 notas Paper; o de "vazio" não tinha notas) | apagados pelo botão "Delete notebook" (a confirmação diz que apaga também o chat e as fontes da web daquele caderno) |
| Pastas de chat "Notebook - ZZ teste RAG" e "Notebook - ZZ teste vazio", suas 10 conversas e a fonte salva pelo "Add to KB" (`Save web sources — Notebook - ZZ teste RAG`, 1 arquivo de 18,5 KB) | apagadas junto com os cadernos; `documents` sem a pasta, pasta em disco `web-research\KqsunCH…` sumiu |
| 3 conversas soltas ("what's new in #zzteste" ×2 e "…board "Paper"") | apagadas pelo botão de cada conversa; `monet:chat-conversations` ficou **idêntico** ao do início (62 conversas, mesmo JSON) |
| Task "ZZ teste task slash" (e a nota-corpo, com a resposta do `/define` apagada antes) | apagada ("Delete task … and its note"); `notebook_tasks` sem "ZZ teste" |
| Livros "LettuceDetect…" e "Prevented is Not Protected…" (2 PDFs) e o chat do Reader | apagados pela Library; `books` = 7 (os do Coordenador); pasta `books` sem arquivos novos; `monet:reader-book-note-link` e `monet:reader-book-folder-link` iguais aos do início |
| Itens do Mincer (2) | apagados; `mincer_items` = 0 |
| Chave do OpenAlex de teste | removida logo após o 8.1 (`has_openalex_key` = false) |
| IA do caderno "ZZ teste RAG" | desligada no 8.3 e religada (depois o caderno foi apagado) |
| "Save web sources" da pasta | a pasta foi apagada; o estado do Coordenador não mudou |
| Agente do chat | o seletor da main e da Assistant ficaram em General; o chat das Anotações do Calendar manteve "Plan week" (o que o Coordenador tinha) |
| Layout | painel de IA a 618 px (era 618; passou por 300), colunas inalteradas; Tasks na visão "List" (`monet:tasks-main-view` = list) |
| Modo e nota da main | Notebook, Calendar, nota de hoje (20/11/2026), notebooks recolhidos, aba Chat do painel direito (igual à captura inicial); `monet:last-location`, `monet:notebook-collapsed`, `monet:notes-right-tab`, `monet:chat-active-id` (voltou à conversa do Coordenador "me passa a lista de aulas…" da pasta MBA), `monet:chat-group-collapsed` ({"library":true}), `monet:reader-open-book`, `monet:reader-side-tab`, `monet:chat-save-last-notebook-id`, `monet:agent-note-by-message`, `monet:note-order` e `monet:open-notes` restaurados ao valor inicial |

### `radar_scope_state` (antes e depois)

| | Conteúdo |
|---|---|
| Antes (guardado no início) | `[{"scope_key":"notebook:rfKlUBDHjK0znqV62Ybn-","last_run_date":"2026-11-20","updated_at":1795224218166}]` (1 linha, do Coordenador) |
| Durante o teste | + `notebook:AVg1Taa09VN_yAjtKJeHB` (RAG), + `tag:zzteste`, + `board:nt_Qbk8hUX7` (Paper), + `notebook:L2fEAqlmjlCbfQVan8B6I` (vazio); a linha do Coordenador **não mudou** (nenhuma consulta rodou no caderno dele) |
| Depois (restaurado) | as 4 linhas minhas apagadas por `DELETE`; tabela **idêntica** ao início (conferido por comparação do JSON) |

### Contagens antes e depois

`notes` 212 → 213 (a diferença é a nota diária vazia "22/11/2026", abaixo); `notebooks` 11 → 11; `books` 7 → 7; `ai_responses` 105 → 105 (sem órfãs: apaguei as respostas dos cartões antes de apagar as notas do Calendar e da task); `note_types` 10 → 10; `metadata_defs` 18 → 18; `trackers` 2 → 2; `tracker_marks` 1 → 1; `mincer_items` 0 → 0; conversas 62 → 62; pastas de chat 23 → 23. Nenhuma linha com "ZZ teste" nem com os ids dos meus cadernos no banco e no `localStorage`.

### Não consegui limpar ou restaurar

1. **Nota diária vazia "22/11/2026"** (id `tAF5u6eTWXCFz_FSmktAe`, caderno Calendar, conteúdo vazio). Criei ao abrir o dia 22/11 para rodar o `/week-review` (4.4). Apaguei a resposta e o texto do comando, mas não há caminho pela interface para apagar uma nota diária (não aparece em "All notes" e a lista da barra lateral não a mostra). Ela é igual às outras notas diárias vazias já existentes (18/11, 19/11, 21/11, 23/11).
2. **`monet:chat-cleared`** (sinal transitório do `localStorage`): ficou com o id de uma conversa minha apagada. É só o último evento de limpeza do chat.
3. **Cliques reais em "Open" (5.6):** abriram duas páginas no navegador padrão do Coordenador (uma de microsoft.com e um DOI); não tenho como fechá-las.
4. **Efeitos colaterais de leitura nas notas do Coordenador:** abri, só para leitura, as notas diárias de 18/11 e de hoje e uma conversa antiga da pasta MBA (7.18); conferi que nenhum `updated_at` de nota mudou (`notes` sem diferença de `updated_at`). O histórico "Opened today" foi restaurado.
5. **Os scripts e imagens do teste** ficam só no scratchpad (`...\scratchpad\cdp\t2\` e `...\shots2\`); nada foi gravado no projeto além deste relatório.

## Observações fora dos itens (para o Coordenador decidir)

- **"Year 2,025":** o card do board e a linha da lista de notas formatam a propriedade numérica Year com separador de milhar (o editor de propriedades mostra "2025"). O card do Coordenador mostra "2,006".
- **Stop durante o planejador:** a conversa fica só com a mensagem do usuário, sem balão, sem "Stopped" e sem Retry (5.22).
- **Cabeçalho do chat das Anotações a 300 px:** o seletor de modelo cobre o botão de tools e seu contador.
- **O "Send to Mincer" e o "Add to KB" voltam ao rótulo original ao trocar de modo e voltar** (a spec já diz que o estado não persiste).
- **"Folder memory updated"** aparece depois de turnos em pastas com memória ligada (as pastas dos cadernos nascem com memória ligada) e é uma chamada de modelo a mais.
- **O roteiro, 4.5:** o roteiro pede "Guitar"; os trackers do banco do Coordenador se chamam "Violão" e "Academia".
