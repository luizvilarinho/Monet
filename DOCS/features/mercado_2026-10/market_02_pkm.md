# PKM / networked thought / tools for thought: contexto de mercado (out/2026)

- **Data da coleta:** 17/10/2026 (todas as fontes acessadas nesta data, salvo indicação).
- **Escopo:** 19 apps pedidos + radar de entrantes com tração em 2025–2026 (Recall, Mem, OpenKnowledge, Thymer). Reflect Open entra dentro da ficha do Reflect.
- **Para que serve:** base factual para o estudo de mercado do Monet (Windows, Tauri, local-first SQLite, sem conta/sync, BYOK OpenRouter + Tavily, IA convocada que nunca escreve direto nas anotações).

## Nota de método e limitações (leia antes)

1. **Fontes priorizadas:** páginas oficiais (pricing, changelog, docs, blog), repositórios GitHub oficiais, fóruns oficiais (forum.obsidian.md, discuss.logseq.com, community.anytype.io, GitHub Issues/Discussions). Agregadores de preço (CostBench, Toolradar, frontdeskreview, aitoolsatlas) só quando a página oficial não estava legível, e sempre sinalizados.
2. **Busca na web limitada:** a cota de WebSearch da sessão, compartilhada com outros agentes, esgotou cedo. A maior parte da coleta foi feita por leitura direta de URLs oficiais.
3. **Reddit bloqueado:** reddit.com e old.reddit.com recusam o fetcher. O sentimento de usuário veio de fóruns oficiais, GitHub, Product Hunt, App Store, Lemmy e reviews. Citações diretas de r/PKMS, r/ObsidianMD e r/logseq ficaram de fora. **Lacuna principal da pesquisa.**
4. **Preços não legíveis na fonte oficial:** Roam e Anytype têm página de preço renderizada só em JS. Amplenote devolve 403. Nesses três casos os valores vêm de agregadores, marcados. A Supernotes mostrou preço apenas em GBP. A extensão Chrome, que serviria para renderizar essas páginas, não estava conectada.
5. **[não verificado]** = não confirmado em fonte nesta rodada. Na maioria dos casos é conhecimento prévio (até jun/2026) que não foi reconferido.
6. Valores em USD, como exibidos na página oficial em 17/10/2026. "anual" = preço mensal equivalente com cobrança anual.

---

## (a) Resumo executivo: padrões que se repetem no segmento

**1. A IA agora entra de fora para dentro: MCP, CLI e "agent skills" viraram padrão em 2026.** O app de notas passa a ser um repositório que agentes externos (Claude Code, Codex, Cursor, ChatGPT) leem e escrevem:
- Obsidian: CLI oficial (1.12, 10/02/2026), Headless Sync (27/02/2026) e o pacote `kepano/obsidian-skills` do CEO, com 49,7 mil estrelas.
- Logseq DB: MCP opcional + CLI.
- Roam: `roam-tools` (MCP + CLI oficial, alpha).
- Heptabase: MCP + CLI + plugins para Claude e ChatGPT.
- Capacities: "AI Chat Connectors".
- Anytype: MCP oficial sobre API local.
- RemNote: Desktop MCP Server (1.28, ago/2026).
- Reflect: MCP (mar/2026) + CLI.
- Também têm MCP: Tana, SiYuan (3.8), Trilium e Recall (no plano grátis).

Quem não expõe os dados a agentes tende a ficar isolado do fluxo dos usuários avançados.

**2. Três modelos de IA embutida.**
- **(i) Créditos ou "budget", com tiers caros:** Heptabase Premium+ US$53,99/mês, RemNote Pro with AI US$18, Tana Pro US$20–30, add-on Capacities Pro+/Believer+, Mem até US$199.
- **(ii) BYOK e/ou modelos locais:** Obsidian (plugins), Roam (extensão Live AI), Amplenote (AmpleAI), SiYuan, Trilium, Reflect Open, AFFiNE (BYOK experimental).
- **(iii) Nenhuma IA no núcleo:** Obsidian core, Logseq.

**Movimento notável:** a Capacities **encerrou o BYOK** em 17/08/2026 para vender orçamento de IA. Com isso, BYOK virou traço de apps locais e indie, e serve como argumento de posicionamento.

**3. O mercado converge para "IA escreve, usuário aprova (ou auto-aprova)".** Exemplos:
- Capacities: preview Generate/Deny/Approve por padrão, com "Auto-approve" opcional.
- Tana: rascunhos que aguardam aprovação.
- Heptabase: AI Agent edita bancos de tags, propriedades e cards de journal.
- Anytype: agente "Bobrik" faz edição em lote.
- Trilium: barra lateral de LLM que edita notas.
- Copilot for Obsidian: Agent Mode.
- OpenKnowledge: modo de auto-aprovação.

O histórico de versões virou rede de segurança para edições da IA (Capacities Release 70). **Quase ninguém promete "a IA nunca toca nas suas notas"**, e esse é um espaço de posicionamento livre para o Monet.

**4. Proatividade crescente nos AI-first, com contramovimento de controle.**
- **Proativos:** Mem (agente que decide quando mandar um "nudge"), Tana (sugestões ao vivo em reuniões, agente de "daily brief" no Slack), Recall ("augmented browsing"), mymind e Napkin (auto-organização e resurfacing), Smart Connections (notas relacionadas na lateral).
- **Contramovimento:** issue do AFFiNE "Disable AI and Telemetry"; o Anytwo da Anytype promete "opção de desligar IA totalmente" e escolha de IA por espaço; IA opt-in na Capacities; Obsidian sem IA no core.

A tese "IA silenciosa e convocada" tem público, mas precisa ser comunicada de forma explícita.

**5. Markdown e arquivos voltaram a ser vantagem, por causa dos agentes.**
- O Reflect abandonou E2EE e formato proprietário e reescreveu o app como **Reflect Open**: Markdown local, MIT, **Tauri + Rust**, BYOK com OpenRouter (14/07/2026).
- O Logseq DB criou um "Markdown Mirror" (mai/2026), por enquanto de mão única.
- O Thymer anuncia um "Markdown Mirror" para agentes.
- O OpenKnowledge (jun/2026) é um "IDE" de Markdown com Git para agentes.

Apps baseados em banco (Logseq DB, Anytype, SiYuan, Capacities, Heptabase) compensam com export, mirror ou MCP.

**6. Reconstruções, pivôs e encerramentos: o PKM "puro" é difícil de monetizar.**
- **Logseq:** 2.0 (DB) beta saiu em 13/07/2026, depois de anos. O app de arquivos virou "Logseq OG", só com manutenção.
- **Anytype:** anunciou o **Anytwo** (11/09/2026): migração "dura", sem retrocompatibilidade, release público previsto para o fim de 2026. Hoje só cerca de 2% dos usuários pagam.
- **Tana:** dividiu-se. O novo Tana é uma "agentic meeting platform"; o PKM clássico virou "Tana Outliner".
- **Encerramentos:** o **Kosmik** fechou em 31/05/2026; o **Napkin** desligou o desktop em 30/06/2026 e ficou só no iPhone.
- **Sinais de desaceleração:** a Scrintal parece parada, com o site promovendo o Gobu.ai [não verificado]; o Roam segue em ritmo lento.

As empresas fogem para "work AI" (Tana, Mem) ou para "aprendizado" (Heptabase "Master anything you learn", RemNote, Recall).

**7. Leitura e estudo estão entrando no PKM.**
- **Anotação de PDF + leitor + IA:** Capacities (Release 70/71, set/2026), Heptabase (highlight cards + AI Tutor), RemNote (Learn PDF), Trilium (leitor de PDF próprio, 0.102), SiYuan (anotação de PDF ligada a blocos), Logseq DB (nós `#PDF Annotation`).
- **SRS com FSRS:** Supernotes 3.2, SiYuan, Logseq DB (`#Card`), RemNote.
- **OCR e transcrição** viraram comuns: Heptabase, Trilium, SiYuan, RemNote, Capacities (áudio).
- **EPUB nativo com grifos continua raro.** O Heptabase depende do Readwise; o Obsidian, de plugins.

**8. Tempo pessoal virou básico.** Calendário, tarefas e revisão diária aparecem em quase todos:
- Workflowy: Google Calendar sync e Timeline.
- Capacities: CalDAV e "daily note review".
- Heptabase: Inbox de lembretes e to-dos.
- Logseq DB: tag `#Task`.
- Obsidian: kanban no Bases e Quick Capture no iOS.

A captura rápida global também se espalhou: Mem Push-to-Remember, tray do Tana, widgets do Heptabase, Quick Add do Workflowy.

**9. Faixas de preço.**
- A entrada paga fica em **US$4–10/mês**.
- A IA puxa tiers de **US$18–54/mês**.
- Apps local-first monetizam o **sync**: Obsidian US$4–8, Anytype US$4–16, SiYuan US$64 (único) ou US$148, Logseq US$5 (backer).
- Monet grátis + BYOK tem o menor custo fixo do segmento: o usuário paga só os tokens.

**10. Windows.** Quase todos suportam. Exceções relevantes:
- Reflect Open: Windows só em build experimental.
- mymind: só web.
- Napkin: só iPhone.
- OpenKnowledge: só CLI no Windows.

A maioria é Electron. Apps Windows leves em Tauri são raros; o Reflect Open é o caso mais próximo do Monet.

### Aberturas e riscos para o Monet (síntese)

- **Combinação sem concorrente pronto:** local-first sem conta + BYOK + leitor PDF/EPUB com grifos que viram citações + chat descartável por pasta (system prompt, memória e RAG) + "IA nunca escreve direto".
- **Concorrentes mais próximos e o que falta em cada um:**
  - **Heptabase:** persona quase idêntica, mas cloud obrigatório e créditos.
  - **Obsidian + plugins:** exige montar tudo à mão.
  - **SiYuan:** BYOK + PDF, mas UX complexa e comunidade sobretudo chinesa.
  - **Trilium:** voltado a power users.
  - **Reflect Open:** mesma arquitetura, mas Mac-first e sem leitor.
- **Riscos frente ao padrão de 2026:**
  - Ausência de MCP/CLI e de espelho Markdown acessível. O Monet já grava um `.md` por nota no appData para o RAG, o que é quase um "Markdown Mirror" pronto.
  - Ausência de modelos locais. Ollama, LM Studio e endpoints OpenAI-compatíveis são comuns em Obsidian, Roam, Amplenote, Trilium e SiYuan.
  - Ausência de OCR, de transcrição e de SRS, que viraram comuns no segmento de estudo.
  - Ausência de sync. Quase todo o segmento oferece algum caminho: pago ou "traga o seu" (iCloud, Git, WebDAV, S3).

---

## (b) Fichas por app

### 1. Obsidian

1. **Posicionamento:** editor Markdown local-first ("file over app"), extensível por plugins. Público amplo: estudantes, pesquisadores, escritores, devs. Grátis inclusive para uso comercial (a licença comercial é opcional).
2. **Organização:**
   - Pastas e arquivos `.md` em um "vault"; `[[wikilinks]]`, backlinks, tags, properties (YAML), Graph view, bookmarks.
   - **Canvas** (core, formato aberto JSON Canvas `.canvas`).
   - **Bases** (core; views sobre properties):
     - Lançado em early access no 1.9.0 (21/05/2025) e publicado no 1.9.10 (18/08/2025).
     - Views table, cards, list e map.
     - **Kanban** e grupos recolhíveis chegaram no 1.14 (02/09/2026).
3. **Editor:**
   - Markdown com Live Preview (quase WYSIWYG) e modo source.
   - Command palette, slash commands (core), Templates (core); Templater é plugin.
   - Callouts, embeds, Footnotes view (1.9).
4. **Estudo e leitura:**
   - Leitor de PDF nativo; anotação avançada via plugins (ex.: PDF++) [não verificado].
   - **Web Clipper oficial** (extensão grátis) com destaques persistentes e "Interpreter": um LLM extrai, resume e traduz a página para variáveis de template, com provedores configuráveis, incluindo **Ollama local**.
   - Readwise (plugin oficial), Zotero Integration e Spaced Repetition são plugins [não verificado em 2026].
5. **Tempo:**
   - Daily notes (core).
   - **Quick Capture nativo no iOS 26** para a nota diária, com templates (1.14, set/2026).
   - Calendário, tasks e lembretes via plugins (Tasks etc.); kanban via Bases.
6. **IA:**
   - **Sem IA no app.** A única IA oficial é o Interpreter do Web Clipper (BYOK/Ollama).
   - **Estratégia oficial "agentes de fora":** CLI (1.12) que controla o app pelo terminal (o app precisa estar aberto); Headless Sync; `kepano/obsidian-skills` (skills de CLI, Markdown, Bases, JSON Canvas e Defuddle para Claude Code, Codex e OpenCode; 49,7 mil estrelas).
   - **Ecossistema:** 9.034 plugins, sendo **1.070 na categoria AI**. Os principais:
     - **Copilot for Obsidian** (2,6 milhões de downloads): chat com o vault, busca semântica, Agent Mode, Project Mode, comandos inline. BYOK + Ollama/LM Studio, ou usa a assinatura ChatGPT/Claude. Plus US$14,99/mês ou US$139,99/ano; Supporter US$349,99 (único).
     - **Smart Connections** (1,2 milhão): notas relacionadas na lateral, com embeddings locais por padrão e sem chave de API. O tier Pro existe; preço [não verificado].
     - **Text Generator** (~589 mil): geração inline com templates.
     - Plugins que embutem Claude Code e Codex na lateral: no fórum, "Claude Code from the Sidebar" tem ~33 mil views e "Agent Client for Claude Code, Codex and Gemini CLI" ~35 mil.
   - **Modo:** quase sempre convocada (o Smart Connections é "proativo passivo"). Agentes e o Agent Mode escrevem direto nos arquivos.
7. **Plataformas e dados:**
   - Windows, Mac, Linux, iOS, Android.
   - Offline total; local-first.
   - Sync opcional com E2EE AES-256.
   - Dados em Markdown aberto + `.canvas` + `.base`; export trivial.
8. **Preço** (obsidian.md/pricing e /sync, 17/10/2026):

   | Item | Anual | Mensal | Limites |
   |---|---|---|---|
   | App | grátis | grátis | — |
   | Sync Standard | US$4/mês | US$5/mês | 1 GB, 1 vault, arquivos até 5 MB, 1 mês de histórico |
   | Sync Plus | US$8/mês | US$10/mês | 10 GB (expansível a 100 GB), 10 vaults, arquivos até 200 MB, 12 meses de histórico |
   | Publish | US$8/mês por site | US$10/mês por site | — |
   | Commercial (opcional) | US$50/usuário/ano | — | — |
   | Catalyst | US$25 (único) | — | — |

   Educação e ONGs têm 40% de desconto em Sync e Publish.
9. **2025–2026:**
   - 1.9.0 e 1.9.10 (Bases).
   - 1.12 (10/02/2026): CLI, backlinks de Canvas.
   - Sync headless (27/02/2026).
   - 1.13 (28/05/2026): configurações em janela própria; segurança (confirmação de URIs, aviso ao sincronizar plugins).
   - 1.14.x (02/09 a 05/10/2026): kanban no Bases, seis cores de destaque, abrir `.md` de fora do vault, Quick Capture no iOS.
10. **Forças e fraquezas:**
    - **Forças:** posse dos dados, velocidade, ecossistema.
    - **Reclamações recorrentes** (fórum oficial, top do ano):
      - "Sync: conflict file generated without edits on multiple devices" (42 respostas, jul/2026).
      - Thread de jul/2026 relatando que o **Sync no iPhone sobrescreveu dados mais novos** (55 respostas, ~2,7 mil views).
      - "Why plugin review takes so long" (40).
      - "Cannot browse or install community plugins" (34).
      - Travamento no Android (49).
      - Pedidos de agrupamento múltiplo no Bases (41).
    - **Reviews:** curva de aprendizado e mobile fraco (Capterra; marlvel.ai, abr/2026, nota 4,2/5 em ~19 mil reviews).
11. **Relevância para o Monet:**
    - Inspira: "IA de fora" via CLI, skills e MCP sem poluir a UI. O Monet poderia expor, somente leitura, os `.md` que já gera por nota.
    - Lacuna: no Obsidian a IA é "faça você mesmo" (plugins, chaves, conflitos). O Monet entrega IA convocada pronta + leitor PDF/EPUB integrado.
    - Evitar: depender de terceiros para o básico (tasks, calendário, SRS), que é a principal fonte de "plugin fatigue".

### 2. Logseq (OG e DB / 2.0)

1. **Posicionamento:** outliner open-source (AGPL), privacy-first, para networked thought em blocos. Em 2026 dividiu-se em **Logseq OG** (arquivos Markdown, só manutenção de segurança e Electron) e **Logseq DB / 2.0** (SQLite, beta).
2. **Organização:**
   - Blocos em outliner, páginas, journals, `[[links]]`, referências de bloco, tags.
   - **No DB:**
     - "Nodes" unificam páginas e blocos.
     - Tags funcionam como classes, com propriedades herdáveis e múltiplos pais.
     - Propriedades tipadas: Text, Number, Date, DateTime, Checkbox, Url, Node.
     - Queries com query builder; views Table, List e Gallery.
     - Grafo refeito (mai/2026).
   - Whiteboards no OG; no DB [não verificado].
3. **Editor:** outliner Markdown; slash commands; templates; no DB, tabelas editáveis como planilha.
4. **Estudo:**
   - **Anotação de PDF embutida:** no DB, cada destaque vira um nó `#PDF Annotation`.
   - **Flashcards nativos:** `#Card`, com algoritmo de SRS novo.
   - Integração com Zotero (OG, blog oficial de 2022).
   - Web clipper oficial [não verificado].
5. **Tempo:**
   - Journal diário por padrão (`#Journal`), datas em linguagem natural.
   - `#Task` com Status, Priority, Deadline, Scheduled, repetição e histórico de status.
   - Calendário e lembretes [não verificado].
6. **IA:**
   - **Sem IA nativa.**
   - O DB traz **servidor MCP opcional** (Streamable HTTP; criações e edições podem ser pré-visualizadas no modo "pretend" e desfeitas; editar páginas, tags e propriedades ainda está pendente).
   - CLI ampliada: queries, tasks, backup, estado do sync; roda sem interface (SSH/CI).
   - Agent skill "logseq-answer-machine" (mai/2026).
   - MCPs de terceiros: `ergut/mcp-logseq` (~257 estrelas) faz busca vetorial com embeddings locais via **Ollama**.
   - Plugins de IA da comunidade (OpenAI/Ollama) [não verificado em 2026].
   - Thread no fórum: "How is Logseq's Official Development Aligning With the Emerging Agentic-AI Trend?" (out/2026).
7. **Plataformas e dados:**
   - Windows, Mac, Linux, web (DB); app mobile novo em alpha (TestFlight no iOS).
   - Local-first.
   - **OG:** `.md`/`.org`.
   - **DB:** SQLite é a fonte canônica; export SQLite/EDN/Markdown; "Markdown Mirror" opt-in só de leitura (mai/2026; bidirecional em desenvolvimento).
   - **Sync (RTC):** pago, só por convite, com grafos criptografados e opção self-host (URL de servidor custom, abr/2026).
8. **Preço:**
   - App grátis.
   - Sync e Publish pagos, **sem preço público**.
   - Acesso antecipado via Open Collective: Backer **US$5/mês** (insider builds; "DB beta e RTC sync liberados para backers mensais ativos"); Sponsor US$15/mês.
9. **2025–2026:**
   - 0.10.x só com correções em 2025 (0.10.14, set/2025, corrigiu RCE no pdf.js).
   - **2.0.1 Beta (DB) em 13/07/2026**; 2.0.2 Beta em 07/10/2026.
   - OG em manutenção.
10. **Forças e fraquezas:**
    - **Forças:** outliner + PDF + flashcards + journal integrados, local, open-source.
    - **Fórum (top do ano):**
      - "Leaving Logseq - Alternative suggestions?" (61 respostas, ago/2026).
      - "Is anyone planning to use OG version indefinitely?" (49, out/2026).
      - "Lost entire graph after clearing cache".
      - "5 unpatched security vulnerabilities".
      - Pedido de "última versão antes de código gerado por LLM".
    - **Blog:** usuário trocou pelo Obsidian em nov/2025 por app e mobile lentos.
    - A documentação do DB avisa que **perda de dados é possível**.
11. **Relevância para o Monet:**
    - Valida **SQLite canônico + espelho Markdown** para conviver com agentes. É o mesmo desenho que o Monet pode adotar.
    - Lição: um rebuild longo congela features e gera êxodo. Vale manter migrações pequenas.
    - Lacuna: o Logseq é outliner-first; quem faz fichamento em texto corrido fica mal servido.

### 3. Roam Research

1. **Posicionamento:** pioneiro do "networked thought" (2019–20); outliner com referências de bloco para pesquisadores e escritores power users. Desenvolvimento lento.
2. **Organização:** páginas + blocos (outliner), `[[links]]`, refs e embeds de bloco, linked e unlinked references, atributos (`attr::`), queries Datalog, grafo, daily notes como home, sidebar.
3. **Editor:** outliner estilo Markdown, comandos `/`, templates [não verificado], extensões via Roam Depot.
4. **Estudo:**
   - SRS embutido (delta) [não verificado em 2026].
   - Destaque de PDF: a Roam mantém um fork de `react-pdf-highlighter-extended` atualizado em set/2025; o recurso exato [não verificado].
   - Readwise exporta para Roam [não verificado].
5. **Tempo:** daily notes por padrão; TODO/DONE; calendário e lembretes via extensões [não verificado].
6. **IA:**
   - **Sem IA nativa confirmada.**
   - **Ecossistema:** a extensão **"Live AI"** (fbgallet, v.36, set/2026):
     - Painel de chat.
     - Agentes: Ask Your Graph, Live Outliner Agent, MCP agent, "LLM Council".
     - ~50 prompts inline; voz.
     - Provedores OpenAI, Anthropic, Google, Grok, Groq, **OpenRouter** e **Ollama**, todos BYOK.
     - **Escreve no grafo por padrão** (respostas entram como blocos filhos).
   - **Oficial:** `roam-tools` (MCP + CLI, **alpha**, 2026):
     - Leitura: busca semântica, Datalog.
     - Escrita: criar, editar, mover e apagar blocos; anexar à daily note.
     - Exige o app desktop e um Local API Token. O README alerta que mudanças podem ser irreversíveis.
7. **Plataformas e dados:** web + desktop Win/Mac/Linux [não verificado]; cloud com opção de grafos offline e criptografados [não verificado]; formato proprietário (Datascript); export JSON/EDN/Markdown.
8. **Preço** (agregadores 2026; página oficial é SPA ilegível):
   - Pro **US$15/mês ou US$165/ano**.
   - Believer US$500 por 5 anos.
   - **Sem plano free** (trial de 31 dias).
   - Scholars Program com desconto.
9. **2025–2026:**
   - Nenhum anúncio público relevante encontrado.
   - O GitHub mostra manutenção: `roam-depot` atualizado em 15/10/2026, `roam-tools` em 05/09/2026.
   - Sem captação divulgada desde 2020.
10. **Forças e fraquezas:**
    - **Forças:** refs de bloco e queries poderosas.
    - **Fraquezas:** preço alto sem free; ritmo lento; comunidade menor que no pico de 2020–21 (comparativo Fabric; review aisotools 2026). Sentimento Reddit [não verificado].
11. **Relevância para o Monet:**
    - Evitar: preço premium sem evolução visível.
    - O Live AI confirma a demanda de power users por **BYOK multi-provedor + OpenRouter + Ollama**. O Monet já cobre OpenRouter; falta modelo local.
    - Transclusão de blocos e citações é o que o Roam tem e o Monet não (o Monet tem "notas vinculadas").

### 4. Anytype

1. **Posicionamento:** "safe haven for digital collaboration". Local-first, P2P, E2EE, baseado em objetos. Público privacy-minded que quer um "Notion sem nuvem". Em 2026 investe em chats, canais e comunidades.
2. **Organização:** objetos com Types e Relations (propriedades), Sets/Collections com views [lista exata não verificada], links e backlinks, grafo, widgets, spaces/canais compartilhados, chats.
3. **Editor:**
   - Blocos estilo Notion, `/`, templates por tipo.
   - O Anytwo promete editor Lexical, synced blocks, fórmulas em tabelas, Markdown instantâneo.
4. **Estudo:** web clipper oficial [não verificado]; sem anotação de PDF nativa nem SRS [não verificado].
5. **Tempo:** tipo Task e objetos de data [não verificado]. Lembretes ainda não existem: post oficial "Why local-first reminders are hard to build on Anytype" (mai/2026).
6. **IA:**
   - **Hoje sem IA embutida.**
   - API local (`localhost:31009`) + **MCP oficial** (`anyproto/anytype-mcp`).
   - **"AI Agent on Anytype — Alpha Demo"** ("Bobrik", 28/05/2026):
     - Agente conversacional que cria, organiza e **edita objetos em lote**.
     - Respeita as permissões de colaborador.
     - No alpha roda com **Claude Sonnet via API da Anthropic na infra da Anytype**, e as conversas são revisadas pela equipe.
     - Plano: modelos locais e provedores privados.
   - **Anytwo** (11/09/2026): "agentic AI" com modelo à escolha e **opção de desligar a IA totalmente**. A ordem proposta é decidir se usa IA, depois em quais espaços, depois com quais modelos.
7. **Plataformas e dados:**
   - Windows, Mac, Linux, iOS, Android.
   - Local-first com sync P2P/backup node, E2EE (só o usuário tem a chave), self-host.
   - Formato proprietário (any-sync); export Markdown e Any-Block (JSON) [parcial]. Any-block v2 está planejado para portabilidade.
   - Se o armazenamento estoura, o sync volta a ser só local.
8. **Preço** (agregador frontdeskreview, conferido em 10/09/2026 contra anytype.io/pricing):

   | Plano | Anual | Mensal | Armazenamento |
   |---|---|---|---|
   | Free | grátis | grátis | 100 MB remotos, 10 canais compartilhados |
   | Plus | US$4/membro/mês | US$5 | 1 GB |
   | Pro | US$8 | US$10 | 10 GB |
   | Ultra | US$16 | US$20 | 100 GB |
   | Business | sob consulta | sob consulta | — |

   Estudantes têm 50% de desconto.
9. **2025–2026:**
   - Desktop 0.51 ("Space Multi-Chats", abr), 0.54 ("Focus & Flow", abr), 0.55 (jun), 0.56 ("It's Fast", 23/07/2026).
   - Post-mortem de bug no modo só-local (fev/2026).
   - Collections 2.0 em protótipo.
   - **Anytwo** (Town Hall de 10/09/2026):
     - Novo app sobre o AnytwoDB, **sem retrocompatibilidade**, com uma "ponte" de migração.
     - Primeiro release público previsto para o fim de 2026, sem paridade de features.
     - O Anytype passa a ser MIT.
     - Business ganha codebase separado.
     - Cerca de 2% dos usuários pagam.
10. **Forças e fraquezas:**
    - **Forças:** privacidade/E2EE, free generoso, objetos.
    - **Fraquezas** (fórum):
      - Curva de aprendizado do modelo de objetos.
      - Sync lento ou inconsistente.
      - Lentidão ("speed is slowing down dramatically since 0.45.3").
      - Busca global quebrada (jun/2026).
      - Risco de perda total se a chave se perder.
    - **Reação ao Anytwo:** entusiasmo ("mind-blowing"), mas também "REALLY bad" pela falta de paridade e medo da migração ("quite scary").
11. **Relevância para o Monet:**
    - Inspira: **IA com desligamento total e escopo por espaço**. O Monet poderia ter um "modo sem IA" e escopo por caderno, o que reforça a tese.
    - Lição: uma "hard migration" corrói confiança.
    - Lacuna: o Anytype não tem leitor de PDF/EPUB nem fluxo de fichamento.

### 5. Capacities

1. **Posicionamento:** "studio for your mind". Notas baseadas em objetos (livros, pessoas, reuniões) para pensadores relacionais, estudantes e criadores. Cloud-first.
2. **Organização:** Object types + properties, tags, coleções, queries, backlinks e menções em abas, grafo, daily notes, calendário, Object Studio (templates de espaço).
3. **Editor:** blocos, `/`, templates, edição de propriedades em lote (Release 71), **histórico de versões** (Release 70: snapshots a cada 15 minutos, até 50 por objeto, guardados por 30 dias, só em planos pagos).
4. **Estudo:**
   - **Anotação de PDF** (destaques coloridos, notas, snapshots de área).
   - "Analyze" (texto completo, resumo, keywords que viram propriedades).
   - **Reader view**.
   - Fluxo: beta para Believer na Release 70, depois Pro e Believer na Release 71 (set/2026).
   - Gravação de áudio e transcrição (early access Believer).
   - Readwise [não verificado em 2026]; share sheet no mobile; sem SRS [não verificado].
5. **Tempo:**
   - Daily note com **"Reviewed"** e seção "Unreviewed" (Release 71).
   - Integração de calendário (Google, Microsoft e, desde a R70, **CalDAV**; Pro).
   - Tasks (Pro) com repetição; kanban; Focus Mode com timer.
6. **IA** (opt-in):
   - **Onde vive:** chat (`Ctrl+J`, painel direito, várias conversas); AI Panel sobre a seleção; **`/Ask AI` inline num bloco**; auto-tag, autopreenchimento de propriedades, geração de queries, `/image`, análise de PDF, imagem e áudio.
   - **Edição:** preview **Generate / Deny / Approve por padrão**, com "Auto-approve" opcional e desfazer.
   - **Modelos:** OpenAI, Anthropic, Gemini, xAI, Mistral, DeepSeek, Moonshot; modo Auto; modelos hospedados na UE marcados no seletor.
   - **BYOK descontinuado** (Release 69, 17/08/2026), substituído por "AI Chat Connectors" (MCP) para ChatGPT, Claude e Cursor.
   - **Sem modelos locais.**
   - Orçamento mensal de IA; add-on Pro+/Believer+ repassa o custo e permite recargas.
7. **Plataformas e dados:**
   - Web, Mac, **Windows**, Linux, iOS, Android.
   - Offline em todos os planos (exceto IA e integrações).
   - **Não é local-first; sem E2EE** (cripto em trânsito e em repouso).
   - Export Markdown, que exige limpeza para levar a outros apps.
8. **Preço** (oficial, 17/10/2026):

   | Plano | Anual | Mensal |
   |---|---|---|
   | Basic | grátis (5 GB de mídia, depois 100 MB/mês) | grátis |
   | Pro | **US$9,99/mês** (US$119,88/ano) | US$11,99 |
   | Believer | a partir de US$12,49/mês (US$149,88/ano) | US$14,99 |
   | Add-on Plus | US$8,33/mês | — |

   Promo de volta às aulas: 40% de desconto no Pro anual para estudantes.
9. **2025–2026:**
   - R69 (17/08): Pro+/Believer+ e fim do BYOK.
   - R70 (01/09): PDF, versões, CalDAV, geração de imagem.
   - R71 (18/09): áudio, redesign do desktop, chats que editam e agem, export em PDF.
   - v1.71.32 (16/10/2026).
10. **Forças e fraquezas:**
    - **Forças:** modelo de objetos, desktop e web polidos, offline que funciona (teste relatado no Lemmy).
    - **Fraquezas:**
      - Mobile atrasado: bugs de edição no iOS (App Store); nota 5,5/10 em review de terceiro.
      - Sem E2EE; sem import em massa.
      - Sync de ~4–5 s (anedota).
      - Thread "Why I was excited about Capacities but stopped using it" (r/capacitiesapp, ~6 mil membros) [conteúdo não verificado].
11. **Relevância para o Monet:**
    - É o modelo mais parecido com "IA convocada + aprovação" (`/Ask AI` + Approve), mas com Auto-approve e cobrança por orçamento. O Monet se diferencia por BYOK e por nunca escrever direto.
    - O fim do BYOK na Capacities abre espaço para "**BYOK como feature**": o usuário controla custo e modelo.
    - Copiar: revisão da nota diária, histórico de versões como rede de segurança, reader view com texto extraído do PDF.

### 6. Tana (novo Tana + Tana Outliner)

1. **Posicionamento:**
   - **Novo Tana** (tana.inc): "agentic meeting platform" com chamadas de vídeo nativas, agente de voz e integrações (Linear, Jira, Slack). Público de times e profissionais.
   - **Tana Outliner** (outliner.tana.inc): o PKM clássico (o "Tana" de 2020–2024), com supertags, para power users.
2. **Organização:**
   - **Outliner:** nós num outliner infinito, **supertags** (templates de campos tipados), fields, live searches e views [lista não verificada], referências, daily pages.
   - **Novo Tana:** Home e Work, páginas de reunião, documentos.
3. **Editor:** outliner; comandos; templates via supertags.
4. **Estudo:** fraco em PDF [não verificado]; o Tana Capture foi descontinuado e substituído pelo Tana Mobile; Readwise [não verificado].
5. **Tempo:** daily pages; sincronização com Google Calendar (Plus); agente de reunião (transcrição de 100, 400 e 1.000 minutos no Outliner).
6. **IA:**
   - **Outliner:**
     - Créditos mensais: 500 (Free), 2.000 (Plus), 5.000 (Pro).
     - Modelos OpenAI, Anthropic e Google.
     - Agentes de chat customizados (Plus); workflows de IA customizados (Pro).
   - **Novo Tana** (changelog de 21/08 a 08/10/2026), **altamente proativo**:
     - Agente de reunião sem bot (Zoom, Teams, Meet) e "Hey Tana" por voz.
     - **Sugestões ao vivo durante reuniões** (tarefa, issue no Linear, mensagem no Slack) que **aguardam aprovação**.
     - Agente de "daily brief" que manda DM no Slack todo dia.
     - Chat com qualquer documento; busca em linguagem natural que vira filtros.
     - **MCP completo**; Remote MCP liga o Outliner ao novo Tana.
   - **BYOK:** não. Só o plano Business é "LLM agnostic".
7. **Plataformas e dados:**
   - Web + desktop Mac, **Windows**, Linux; app para iPhone e iPad (08/10/2026).
   - Desktop do Outliner tem **offline** (a partir da 1.0.49), com limites: sem IA, espaços compartilhados só leitura.
   - Cloud proprietária; export de workspace em JSON ou Markdown.
8. **Preço** (oficial, 17/10/2026):
   - **Novo Tana:**
     - Free: 5 reuniões/mês, 50 consultas de IA.
     - **Pro "early bird": US$20 por usuário/mês, exibido ao lado de US$30.** O agregador aitoolsatlas (mar/2026) lê isso como US$20 no anual e US$30 no mensal.
     - Business sob consulta.
     - Agregadores registraram em 2026 um plano "Max" (US$80/120) que não aparece na página atual.
   - **Outliner:** Free; Plus **US$8/mês**; Pro US$14/mês. O FAQ cita US$5/mês (US$48/ano) e US$9 (US$84/ano), aparentemente com desconto acadêmico/ONG; a página é inconsistente.
9. **2025–2026:**
   - Série A de US$14 milhões (fev/2025; total de US$25 milhões; lista de espera de 160 mil pessoas).
   - Em 2026, separação em dois produtos [data exata não verificada; os snapshots de preço sugerem entre mar e jul/2026].
   - CostBench registra mudanças de preço em fev e jul/2026.
10. **Forças e fraquezas:**
    - **Forças:** supertags, IA integrada, captura de reuniões.
    - **Fraquezas:** curva de aprendizado; cloud; o pivô deixa o PKM clássico como produto secundário (inferência). Sentimento Reddit [não verificado].
11. **Relevância para o Monet:**
    - O Tana é a **anti-tese** do Monet. O blog dele defende que "o conhecimento deve se acumular a partir do seu trabalho", não ser escrito pelo usuário. O contraste é útil para posicionamento.
    - O pivô para "work AI" deixa o nicho do autodidata menos disputado.
    - Supertags inspiram **tipos de nota** para fichamento (livro, curso, autor) com campos.

### 7. Heptabase

1. **Posicionamento:** "intelligent, visual knowledge base — **Master anything you learn**". Público de estudantes, pesquisadores e lifelong learners. É o concorrente mais próximo da persona do Monet.
2. **Organização:** cards (notas) em whiteboards, sections, tags com bancos de propriedades (views table e kanban no mobile desde set/2026), backlinks, Library, Journal, Inbox.
3. **Editor:** blocos com `/` [não verificado]; templates de editor (mobile, mar/2026); espaço visual de whiteboard com minimapa.
4. **Estudo:**
   - PDF vira card. Destaques viram "**Highlight Cards**" arrastáveis para whiteboards ou embutíveis em notas.
   - OCR (set/2025); PDF processado exportável como Markdown (ago/2026).
   - YouTube e podcasts com transcrição e "Insights" ligados ao trecho de origem.
   - **Readwise** (e-books) e **Zotero** (PDFs + anotações); web clipper.
   - **AI Tutor** (31/03/2026): monta um curso a partir de uma meta e dos materiais; cria notas no whiteboard quando o usuário pede.
   - **AI Skills** (14/08/2026): uma delas transforma livro ou capítulo em **whiteboard com citações**.
   - SRS [não verificado].
5. **Tempo:** Journal com calendário; Inbox (captura rápida, lembretes, to-dos; jun/2025); to-dos com data.
6. **IA:**
   - **Onde vive:**
     - Chat por whiteboard (botão Chat). O contexto entra via `@`/`+`: cards, sections, PDFs com intervalo de páginas, journals por período.
     - "Chat with your entire Space" ligado por padrão.
     - Ações de IA ao passar o mouse sobre um card.
     - Arrastar respostas para o whiteboard.
   - **Agente:** o AI Agent **edita bancos de tags, propriedades e cards de journal** (mai–jun/2026). Space Instructions e skills no chat (23/07/2026).
   - **Agentes externos:** MCP (beta em dez/2025; leitura, busca, criação e edição desde ago/2026), CLI (mai–out/2026), plugins para ChatGPT (set/2026) e Claude (out/2026), Codex (jul/2026).
   - **Modelos:** OpenAI, Google, Anthropic. **O Pro só usa Gemini.** Créditos mensais + uso sob demanda.
   - **BYOK:** não mencionado [não verificado].
7. **Plataformas e dados:**
   - Mac, **Windows**, Linux, iOS, Android, web.
   - Offline ("acesse todas as notas sem internet").
   - **Sync na nuvem obrigatório desde a v1.75.8 (21/10/2025)**: não pode mais ser desligado.
   - Colaboração em tempo real grátis.
   - Formato proprietário; export Markdown [parcial].
8. **Preço** (oficial, 17/10/2026; seletor "Yearly – save 25%"):

   | Plano | Preço exibido | Créditos de IA/mês | Destaques |
   |---|---|---|---|
   | Pro | US$8,99/mês | 100 | — |
   | Premium | US$17,99/mês | 1.800 | PDFs ilimitados, OCR, Q&A com modelos básicos sem limite |
   | Premium+ | US$53,99/mês | 8.100 | — |

   Os valores parecem ser da cobrança anual. No mensal, o Pro sairia por cerca de US$11,99 (cálculo próprio, coerente com o agregador subger).
9. **2025–2026:**
   - Premium e IA grátis para todos (05/12/2025).
   - Premium+ e créditos dobrados (05/03/2026).
   - IA sob demanda e AI Tutor (31/03/2026).
   - CLI (mai/2026), AI Agent (jun/2026), AI Skills (ago/2026).
   - Plugins para ChatGPT e Claude (set–out/2026).
   - Suporte a "Gemini 4 Argon" (16/10/2026).
10. **Forças e fraquezas:**
    - **Forças:** pensamento visual, ciclo de leitura PDF → cards, releases quase diárias, time responsivo.
    - **Fraquezas** (Product Hunt, ~2023–24): "Whiteboards with 100s of cards and pdf highlights are slow and laggy"; to-dos "lackluster"; cloud obrigatório. Sentimento de 2026 [não verificado].
11. **Relevância para o Monet:**
    - **Concorrente mais direto** do fluxo leitura → nota → IA tutora.
    - O Monet se diferencia por: local sem conta, BYOK com custo sob controle, IA que não escreve sozinha, **EPUB nativo** e chat descartável.
    - Copiar: grifo como unidade reutilizável, contexto de chat por intervalo de páginas, "livro → mapa com citações" como `/comando` convocado.

### 8. Reflect (Classic → Reflect Open)

1. **Posicionamento:**
   - **Reflect Classic:** notas diárias + backlinks, E2EE, IA e cloud.
   - **Reflect Open** (14/07/2026): reescrita **open-source (MIT), local-first, Markdown**, "AI-native" com BYOK. É um app novo; o Classic continua em manutenção, sem prazo de migração.
2. **Organização:** daily notes + notas, `[[wiki links]]`, backlinks, tags. O "graph" é uma pasta: `daily/`, `notes/`, `assets/`, `audio-memos/`.
3. **Editor:** Markdown com edição rica (editor "meowdown" [não verificado]); seções de Tasks com breadcrumbs; prompts customizados.
4. **Estudo:** o Classic tinha destaques do Kindle e web clipper [não verificado]. O Open tem extensão de captura para Chrome (links, texto, screenshots). Sem anotação de PDF [não verificado].
5. **Tempo:** daily notes são o centro; tasks; o Classic integrava calendário [não verificado].
6. **IA:**
   - **BYOK** OpenAI, Anthropic, Google e **OpenRouter**; chaves no keychain do sistema operacional.
   - "Ask your notes" (`⌘J`) com **citações das notas**; reescrever e resumir.
   - **Busca semântica on-device** (ONNX).
   - Notas com `private: true` **nunca vão para a IA**.
   - CLI (`reflect today`, `search`, `show`) para agentes.
   - No Classic: MCP (10/03/2026) e edição por coding agents (28/04/2026).
   - **Convocada.**
7. **Plataformas e dados:**
   - Mac (stable e beta); iPhone (assinatura na App Store).
   - **Windows e Linux em builds experimentais** (Windows arm64 no 0.15.0, 13/10/2026; Linux no 0.16 beta). O post de julho dizia "Windows indisponível".
   - Pilha **Tauri + Rust**.
   - Sync por iCloud Drive ou Git; **sem E2EE próprio**; Markdown aberto; sem conta, sem analytics.
8. **Preço:**
   - Reflect Open no Mac **grátis**.
   - iPhone e iPad por **assinatura** (preço local na App Store [não verificado]).
   - IA paga direto ao provedor.
   - Assinantes do Classic ganham 1 ano do iOS.
   - Preço atual do Classic [não verificado] (historicamente cerca de US$10/mês no anual).
9. **2025–2026:**
   - Editor de prompts (jul/2025); busca avançada no mobile (ago/2025); resumos de links por IA (set/2025).
   - MCP (mar/2026); agentes editando notas (abr/2026).
   - **Reflect Open** (14/07/2026); 0.15.0 (13/10/2026: merge em três vias, suporte a "Claude Sonnet 5.5" e "GPT-6.1 Sol"); 0.16 beta (Linux).
10. **Forças e fraquezas:**
    - **Forças:** simplicidade, foco em daily notes; dados que sobrevivem à empresa.
    - **Fraquezas:**
      - O Open perde o E2EE próprio.
      - Windows só experimental.
      - Import unidirecional; conversas de IA e histórico não migram.
      - Sentimento [não verificado].
11. **Relevância para o Monet:**
    - **É o mais parecido com o Monet em arquitetura**: Tauri + Rust, local-first, BYOK com OpenRouter, "ask your notes" com citações, CLI para agentes. Vale acompanhar de perto.
    - Lacuna: o Reflect Open é Mac-first. O espaço de "Reflect para Windows + leitor" está aberto.
    - Copiar: flag `private` que tira a nota da IA; chaves no cofre do sistema operacional (o inventário interno registra chaves em texto puro no Monet como risco; status da correção não verificado).

### 9. Amplenote

1. **Posicionamento:** notas + tarefas + calendário integrados (pontuação de tarefas, Jots). Público de produtividade pessoal/GTD.
2. **Organização:** notas com tags hierárquicas, backlinks, grafo (Pro), Jots (daily notes), lista de tarefas, calendário [parcial].
3. **Editor:** rich text estilo Markdown, rich footnotes, plugins em JavaScript [não verificado em 2026].
4. **Estudo:** integração Readwise (plugin oficial `alloy-org/readwise`); web clipper [não verificado]; sem PDF/SRS [não verificado].
5. **Tempo (forte):** tarefas com pontuação e agendamento no calendário; sync com calendários externos (Pro, GetApp); lembretes; Jots diários.
6. **IA:**
   - Via plugins. O plugin oficial **AmpleAI** (`alloy-org/ai-plugin`, atualizado em jan/2026; fork `pro-ai` em fev/2026) traz **OpenAI e Ollama local**, BYOK.
   - Convocada.
   - "Pro AI" nativo [não verificado].
7. **Plataformas e dados:** Win, Mac, Linux, iOS, Android, web [não verificado]; "Vault notes" com E2EE (plano Unlimited, GetApp); cloud; export Markdown [não verificado].
8. **Preço:** **[não verificado]**. amplenote.com devolveu 403. Os agregadores divergem:
   - Toolradar (fev/2026): Pro US$5,84/mês, Unlimited US$10, Founder US$20 (anual).
   - CostBench (jun/2026): US$7, US$12 e US$25.
   - Há plano pessoal grátis e trial de 14 dias.
9. **2025–2026:** [não verificado]. Os repositórios do GitHub mostram atividade (dashboard-plugin em out/2026).
10. **Forças e fraquezas:** [não verificado nesta rodada].
11. **Relevância para o Monet:**
    - Ligação nota ↔ tarefa ↔ calendário com priorização é paralela ao Tasks v3 do Monet.
    - Confirma que **BYOK + Ollama via plugin** é o padrão dos apps pequenos.

### 10. Supernotes

1. **Posicionamento:** notas em "note-cards" curtos, rápidos e colaborativos. Público muito amplo, com forte presença de estudantes.
2. **Organização:** cards com hierarquia (vários pais), links e backlinks, coleções, grafos 2D e 3D, Noteboards, layouts Table e Map (3.2).
3. **Editor:** Markdown em cards, @menções, datas em linguagem natural.
4. **Estudo:**
   - **Flashcards com SRS FSRS** (3.2.0, 08/08/2025): linhas horizontais ou spoilers viram flashcards.
   - Exporta PDF; importa Markdown; web clipper "coming soon".
5. **Tempo:** calendário heatmap; criação de cards por data natural.
6. **IA:**
   - "AI Superpowers" (plano Unlimited): corrige typos e ajuda a organizar.
   - **Vision AI opt-in** sugere propriedades que o usuário **confirma**.
   - Convocada e discreta.
7. **Plataformas e dados:** Mac, **Windows**, Linux, iOS, Android, web (+VR); offline; cloud; export Markdown e PDF; E2EE não mencionado.
8. **Preço** (oficial, exibido em GBP):
   - Starter grátis (100 cards).
   - **Unlimited £6/mês ou £72/ano.**
   - Plano de 4 anos com 50% de desconto; estudantes até 63%.
   - Preço em USD [não verificado].
9. **2025–2026:** 3.2.0 (ago/2025); 3.2.2 (mar/2026, interface em vários idiomas incluindo **português**, em early access); 3.2.4 (abr/2026).
10. **Forças e fraquezas:** rapidez e cards; limite de 100 cards no free. Sentimento [não verificado].
11. **Relevância para o Monet:**
    - Flashcards a partir de uma **marcação simples na própria nota** (spoiler) são uma forma barata de entregar SRS ao autodidata sem virar um "app de flashcards".
    - IA que só sugere para o usuário confirmar está alinhada à tese do Monet.

### 11. AFFiNE

1. **Posicionamento:** "privacy-focused, local-first, open-source alternative for Notion & Miro". Docs + whiteboard ("edgeless") + databases, para indivíduos, times e self-hosters.
2. **Organização:** docs, coleções, tags, databases (**calendar view** no 0.27), links e backlinks, journals, canvas.
3. **Editor:** blocos (BlockSuite), `/`, templates, LaTeX, Mermaid, Typst.
4. **Estudo:** resumo de PDFs e transcrições por IA; importadores de OneNote, Obsidian, Bear e Notion (0.27); anotação de PDF [não verificado]; sem SRS.
5. **Tempo:** journals [não verificado]; calendar view; fila de sync CalDAV (0.27).
6. **IA:**
   - Add-on **AFFiNE AI**: escrever e reescrever, chat (sidebar), "Ask AI" na toolbar inline e no canvas (mind maps, slides beta, imagens, "Make it Real").
   - **Roda via AFFiNE Cloud** (exige login; não funciona em workspace local).
   - **BYOK experimental desde o 0.27** (15/07/2026); Gemma local "planejado"; MCP no cloud.
   - Convocada.
7. **Plataformas e dados:**
   - Web, Win, Mac, Linux, iOS, Android.
   - Workspaces locais ilimitados; CRDT (yjs, y-octo, OctoBase); self-host via Docker.
   - Formato próprio; export Markdown/HTML/PDF [não verificado].
8. **Preço** (oficial):
   - Free.
   - **Pro US$6,75/mês** (o anual "economiza 15%").
   - Team US$10 por seat/mês.
   - Believer US$499,99 vitalício (1 TB).
   - **IA US$8,9/mês** (anual).
   - Self-host FOSS grátis.
9. **2025–2026:** 0.27 (15/07/2026): BYOK, calendar view, importadores, mudanças que quebram compatibilidade entre servidor e cliente. Builds canary até 12/10/2026. Enterprise anunciado.
10. **Forças e fraquezas:**
    - **Forças:** open-source (73,6 mil estrelas), canvas + docs.
    - **Issues mais votadas:** self-host; **"Disable AI and Telemetry"** (#6920); "Run AI locally or through API" (#6872); copiar como Markdown (#12983, fechada em abr/2026).
11. **Relevância para o Monet:**
    - IA presa à nuvem frustra usuários local-first, e o BYOK local do Monet resolve isso.
    - Evitar IA e telemetria impostas; o pedido explícito de desligar a IA reforça a tese do Monet.

### 12. SiYuan

1. **Posicionamento:** open-source (AGPL), local-first, privacy-first, baseado em blocos (b3log, China). Para power users.
2. **Organização:**
   - Notebooks > árvore de documentos > blocos com ID; refs de bloco, backlinks, grafo, tags, atributos.
   - **Databases:** views table, gallery, kanban e calendar; relations, rollups e, no 3.8.7, automations.
3. **Editor:** Markdown WYSIWYG em blocos, `/`, templates, widgets, plugins.
4. **Estudo:** **anotação de PDF ligada a blocos** (link bidirecional entre grifo e bloco); **flashcards FSRS**; "Cloud Inbox"; extensão Chrome/Edge; AI OCR (3.8.7).
5. **Tempo:** daily notes [não verificado]; calendar view em databases.
6. **IA:**
   - Escrita e Q&A via **API OpenAI-compatível** (BYOK, desde 2023).
   - **3.8.0** (12/08, ano inferido 2026): **AI Agent** em linguagem natural, **busca semântica (embeddings + rerank)**, **MCP**.
   - **3.8.7** (14/10/2026): login com **conta ChatGPT** para o agente, compactação de contexto, provedores Gemini, OpenAI e Xiaomi MiMo.
   - Se o agente escreve direto [não verificado; ele gerencia views de banco].
7. **Plataformas e dados:**
   - Win, Mac, Linux, iOS, Android, HarmonyOS, Docker.
   - Local (`.sy` em JSON por documento).
   - Sync oficial **E2EE** incremental (pago); S3 e WebDAV (PRO); sync assistido em LAN.
   - O README desaconselha discos de sync de terceiros.
8. **Preço** (oficial):
   - Free.
   - **PRO Features US$64 (pagamento único, de US$96)**: S3 e WebDAV.
   - Subscription US$148 (de US$296) com 8 GB de nuvem. O card diz "Lifetime", mas o FAQ fala em "anual"; ambíguo.
9. **2025–2026:** views gallery (jun/2025) e kanban (nov/2025); calendar (set/2026); 3.8.x com IA e MCP; releases quase diárias.
10. **Forças e fraquezas:**
    - **Forças:** recursos enormes por preço baixo, local.
    - **Fraquezas:** formato `.sy` não é Markdown; comunidade e documentação majoritariamente chinesas; pedido antigo de whiteboard (#2024, o mais votado) ainda aberto.
11. **Relevância para o Monet:**
    - Prova que grifo de PDF ↔ bloco + SRS + DB cabem num app local barato.
    - O Monet ganha em UX ocidental e foco no fichamento.
    - Inspira: **pagamento único** para recursos PRO como alternativa a assinatura.

### 13. Trilium Notes (TriliumNext)

1. **Posicionamento:** app open-source (AGPL) para bases de conhecimento pessoais grandes e hierárquicas. O autor original (zadam) transferiu o repositório para a comunidade TriliumNext. Para power users e self-hosters.
2. **Organização:** árvore com **clones** (a mesma nota em vários lugares), atributos (labels e relations), scripting, collections (calendar, kanban, table, geomap, dashboard), relation maps, mind maps, planilhas (beta).
3. **Editor:** WYSIWYG + notas de código + notas Markdown (0.103) + blocos recolhíveis.
4. **Estudo:**
   - **Leitor de PDF próprio** com anotações, busca e formulários (0.102, 01/03/2026).
   - OCR (0.103 e 0.106).
   - Web clipper v1.2.0-rc1 (out/2026): extração Defuddle, screenshots, salvar PDF.
5. **Tempo:** notas diárias pelo calendário [não verificado]; collection de calendário refeita (0.105); kanban (0.106).
6. **IA:**
   - O chat com LLM foi **removido no 0.102** e **voltou no 0.103** (13/05/2026), com sidebar que **edita notas**.
   - Provedores: OpenAI, Anthropic, Gemini, **Ollama**, **LM Studio**, DeepSeek, OpenAI-compatível, assinatura do Claude Code (0.104), GitHub Copilot (0.105), Google Antigravity (0.106).
   - Ferramentas de LLM dentro do editor (revisar, resumir; 0.105).
   - MCP com autenticação obrigatória (0.105).
   - BYOK + local; convocada.
7. **Plataformas e dados:**
   - Desktop Win, Mac, Linux; servidor web (Docker).
   - Mobile só por web ou apps de terceiros (Pocket Trilium, TriliumDroid, Clover para iOS).
   - Sync self-host; "protected notes" com criptografia por nota.
   - SQLite [não verificado]; export HTML e Markdown.
8. **Preço:** grátis (sem plano pago).
9. **2025–2026:**
   - 0.102 (mar/2026), 0.103 (mai), 0.104 (jul), 0.105 (ago), 0.106 (25/09/2026).
   - Backups criptografados (0.105).
   - Mudança no protocolo de sync que afeta apps de terceiros (out/2026).
10. **Forças e fraquezas:**
    - **Forças:** poder (scripting, clones), self-host, IA local.
    - **Fraquezas:** sem app mobile oficial ("Official Android mobile app?", 28 respostas); UI de power user; resistência à remoção do layout antigo (out/2026); lentidão com arquivos grandes.
11. **Relevância para o Monet:**
    - Aceitar **endpoint OpenAI-compatível local** (Ollama, LM Studio) além do OpenRouter é barato e virou norma.
    - Remover e reintroduzir a IA em dois meses mostra o custo de manter IA integrada. Escopo enxuto é uma virtude.

### 14. Workflowy

1. **Posicionamento:** outliner minimalista ("Stop organizing your notes. Start organizing your thoughts."), há mais de 14 anos. Para quem pensa em listas.
2. **Organização:** um único outline infinito de nós com zoom, mirrors, tags e @menções, boards, **Tables** (30/06/2026), **Panes** lado a lado (07/09/2026), nó de calendário.
3. **Editor:** outliner; listas numeradas; blocos de código e citação (fev/2026).
4. **Estudo:** fraco; uploads; Email-to-Workflowy (mar/2026); sem PDF/SRS.
5. **Tempo:** Calendar/Today (fev/2026), **sync com Google Calendar** (abr/2026), Timeline + Today Digest (mai/2026), Quick Add no Android e iOS, "Move to Date".
6. **IA:**
   - "Workflowy AI" (termos de 25/03/2025): ferramentas **opcionais** para gerar, editar, resumir e melhorar conteúdo, via OpenAI e Anthropic.
   - Sem BYOK; sem MCP oficial [não verificado].
   - Nenhum post de produto em 2026 fala de IA.
7. **Plataformas e dados:** web, Windows, Mac, Linux, iOS, Android; offline [não verificado]; cloud; export OPML/texto [não verificado].
8. **Preço** (oficial):
   - Basic grátis (100 nós/mês, 100 MB de upload).
   - **Pro US$6,99/mês anual, US$8,99 mensal.**
   - Pro grátis vitalício para educação.
9. **2025–2026:** updates mensais de 2026.02 a 2026.08 (calendário, tabelas, painéis).
10. **Forças e fraquezas:** simplicidade e velocidade; limite de 100 nós/mês no free. Sentimento [não verificado].
11. **Relevância para o Monet:**
    - "Today Digest" e calendário viraram expectativa até num outliner minimalista.
    - Mostra que é possível ter IA sem fazer dela vitrine, o que é coerente com "IA silenciosa".

### 15. RemNote (visão PKM; o lado de estudo fica com outro pesquisador)

1. **Posicionamento:** "The AI note taking tool that actually helps you learn". Notas + flashcards num só app; alega mais de 1 milhão de estudantes.
2. **Organização:** "Rems" hierárquicos (outliner), documentos, tags e propriedades, tabelas, links e backlinks, Infinite Canvas.
3. **Editor:** outliner e documento; manuscrito (handwriting).
4. **Estudo (núcleo):**
   - Flashcards gerados a partir das notas; SRS; agendador de provas.
   - Anotação de PDF e slides; image occlusion.
   - **Learn PDF** por capítulos (1.28); AI Tutor; gravador de aulas.
   - Modo de voz com correção falada (out/2026).
5. **Tempo:** agendador de provas; documentos diários [não verificado].
6. **IA:**
   - Créditos: 250, 1.000 e 20.000 por mês.
   - AI Tutor, geração de cards e quizzes, correção por IA, image-to-text.
   - **Desktop MCP Server** (1.28, 05/08/2026).
   - BYOK [não verificado; não mencionado].
7. **Plataformas e dados:** web, desktop (Win/Mac/Linux), iOS, Android; offline; cloud; export [não verificado].
8. **Preço** (oficial):
   - Free.
   - **Pro US$8/mês (US$96/ano).**
   - Pro with AI US$18/mês (US$216/ano).
   - Plano vitalício existe, sem preço exibido.
9. **2025–2026:** 1.28 (ago/2026: MCP, várias janelas, Learn PDF); betas contínuos de set a out/2026.
10. **Forças e fraquezas:** [fora do escopo desta rodada].
11. **Relevância para o Monet:**
    - Referência de "IA a serviço de aprender". Um `/flashcards` convocado a partir de uma nota atenderia o autodidata sem copiar o RemNote.
    - MCP local virou padrão até em app de estudo.

### 16. Scrintal

1. **Posicionamento:** anotação visual para pesquisa ("Think visually, learn deeply"). Canvas infinito com blocos que viram docs. Alega mais de 10 mil aprendizes e pesquisadores.
2. **Organização:** canvas, blocos → docs, setas e links bidirecionais, templates.
3. **Editor:** docs em blocos.
4. **Estudo:** PDFs no canvas ao lado das notas, vídeos e imagens.
5. **Tempo:** [não verificado].
6. **IA:**
   - "AI Assistant" para tarefas repetitivas [detalhes não verificados].
   - O site promove o **Gobu.ai**: assistente de pesquisa com IA (análise de artigos, revisão de literatura, citações, Q&A em PDFs, add-in para Word, "Made in Stockholm"). Relação societária com a Scrintal [não verificado].
7. **Plataformas e dados:** web + desktop macOS e **Windows** (v0.2.13); offline [não verificado]; cloud.
8. **Preço:** a página mostra "Scrintal Pro …/month, billed annually" **sem o valor** [não verificado].
9. **2025–2026:** site com © 2025, blog com 403 e versão desktop parada em 0.2.13. Indícios de baixa atividade e foco no Gobu [inferência, não verificado].
10. **Forças e fraquezas:** [não verificado].
11. **Relevância para o Monet:**
    - "Canvas para pesquisa" parece ter perdido tração. Cautela antes de investir em canvas.
    - O Gobu aposta em "assistente de leitura acadêmica", a mesma direção da Library do Monet.

### 17. Kosmik (encerrado)

1. **Posicionamento:** "AI moodboard maker" / canvas espacial com browser embutido, para criativos e pesquisa visual.
2. **Organização:** canvas infinito, workspaces/"universes", frames, desenho, modo apresentação.
3. **Editor:** notas no canvas.
4. **Estudo:** browser embutido; "AI Asset Finder"; PDF não mencionado.
5. **Tempo:** n/a.
6. **IA:** auto-tag, busca com IA, asset finder ("pedidos de IA ilimitados" no Pro); MCP previsto para o plano Ambassador ("coming soon"). Ambiente/proativa.
7. **Plataformas e dados:** macOS e **Windows** (x64 e ARM); em 2018 foi pioneiro em armazenamento local via nó IPFS no dispositivo.
8. **Preço** (página ainda no ar): Pro US$11,99/mês anual ou US$14,99 mensal; Ambassador US$16,99/20,99 ("coming soon").
9. **2025–2026:** **"will sunset on May 31st 2026"**, com cadastros fechados. Usuários ainda podem baixar o app para exportar os dados. Motivo [não verificado].
10. **Forças e fraquezas:** n/a.
11. **Relevância para o Monet:**
    - Alerta: canvas visual com IA, sem diferencial sustentado, não para em pé.
    - Boa prática: manter um caminho de export depois do fim.

### 18. Napkin

1. **Posicionamento:** app de iPhone para "colecionar boas ideias e mantê-las em foco". Alternativa calma à mídia de atenção. Não é ferramenta de escrita.
2. **Organização:** sem tags nem pastas manuais; a IA agrupa as ideias em tópicos e sugere conexões.
3. **Editor:** só texto (sem imagens); captura por share sheet, **scan de trecho de livro**, ditado ou digitação.
4. **Estudo:** captura de citações por scan de livro físico.
5. **Tempo:** "Daily Flow" com reflexões.
6. **IA:** **proativa** (tópicos, conexões, resurfacing no Daily Flow); sem BYOK.
7. **Plataformas e dados:** só iPhone (iPad planejado, Android não). **O protótipo desktop foi desligado em 30/06/2026.** Cloud (a empresa guarda backup de ~4,7 milhões de ideias).
8. **Preço:** assinatura com trial; valor não listado no site [não verificado].
9. **2025–2026:** pivô para iPhone e fim do desktop (30/06/2026).
10. **Forças e fraquezas:** [não verificado].
11. **Relevância para o Monet:**
    - **Scan de citação de livro físico** (OCR via câmera) é um recurso útil para fichamento de quem lê em papel.
    - Mostra a fragilidade de PKM indie multiplataforma.

### 19. mymind

1. **Posicionamento:** "extension for your real mind". Salvar tudo (notas, links, imagens, artigos) sem organizar. Manifesto contra redes sociais e anúncios. Público de designers e curadores.
2. **Organização:** "Folders are dead": sem pastas ou tags manuais; auto-tag por IA; **Smart Spaces** (coleções automáticas); busca por cor, marca e data; Top of Mind; links bidirecionais entre itens.
3. **Editor:** notas rápidas + Focus Mode.
4. **Estudo:** reader sem distrações, destaques salvos, backup de artigos, análise de PDF e resumos (Mastermind).
5. **Tempo:** "**Serendipity**" ressurge itens esquecidos.
6. **IA:** **ambiente e proativa**: identifica o tipo de cada item, resume, classifica, faz OCR em imagens. Sem BYOK.
7. **Plataformas e dados:** web, macOS, iOS, Android, extensões para Chrome, Edge e Safari. **Sem app nativo para Windows** (só web). Cloud; cripto não detalhada ("nobody can see what you save").
8. **Preço** (oficial):

   | Plano | Mensal | Anual |
   |---|---|---|
   | The Bookmarker (sem IA) | US$4,99 | — |
   | Student of Life | US$7,99 | US$79 |
   | Mastermind | US$12,99 | US$129 |
   | Newton (indisponível) | — | US$299 |
9. **2025–2026:** nada datado no site (assets de dez/2025).
10. **Forças e fraquezas:** [não verificado].
11. **Relevância para o Monet:**
    - Contraponto: a IA que organiza sozinha é o "anti-Monet".
    - Inspira: reader limpo + destaques, como referência para um futuro clipper da Library.

### 20. Radar: outros com tração em 2025–2026

**Recall (recall.it, antes getrecall.ai)**
1. **Posicionamento:** base de conhecimento com IA para o que você consome (vídeos, podcasts, PDFs, artigos). Alega "700.000+ profissionais".
2. **Organização:** grafo automático e auto-tags.
3. **Editor:** notas próprias.
4. **Estudo:** resumos com pontos-chave por timestamp; **quizzes com repetição espaçada**.
5. **Tempo:** n/a.
6. **IA:** chat com a base (GPT, Claude, Gemini, Grok, DeepSeek); "**augmented browsing**" proativo (mostra conteúdo salvo relacionado enquanto você navega); **API e MCP já no plano grátis**; sem BYOK.
7. **Plataformas e dados:** web, extensões, iOS, Android; navegação "local first", base na nuvem; export Markdown.
8. **Preço:** Free (10 resumos/mês); **Plus US$10/mês anual**; Max US$38/mês anual.
9. **2025–2026:** domínio migrou para recall.it [data não verificada].
10. **Forças e fraquezas:** [não verificado].
11. **Relevância para o Monet:** disputa a mesma persona autodidata pelo lado do consumo de conteúdo; é proativo e na nuvem, o oposto do Monet.

**Mem**
1. **Posicionamento:** "Your AI chief of staff".
2. **Organização:** Workspace de notas e reuniões.
3. **Editor:** n/v.
4. **Estudo:** n/a.
5. **Tempo:** tarefas e projetos inferidos pelo agente.
6. **IA:** **Mem Agent proativo** (decide quando mandar um "nudge"); **Push-to-Remember** por voz; voice mode; busca semântica; reuniões sem bot.
7. **Plataformas e dados:** Push-to-Remember no Mac e **Windows**; outras plataformas [não verificado]; SOC 2; cloud.
8. **Preço** (oficial): Free; Plus US$9/mês; Pro US$29; Pro 2× US$49; Pro 5× US$99; Pro 10× US$149; Pro 20× US$199. Os limites são por mensagens, notas e horas de voz.
9. **2025–2026:** relançamento "Mem 2.0" sugerido por link do Product Hunt [não verificado].
10. **Forças e fraquezas:** [não verificado].
11. **Relevância para o Monet:** proatividade e preço por uso de IA, a antítese do Monet.

**OpenKnowledge (Inkeep, jun/2026)**
- "IDE" open-source (GPL v3) para bases de conhecimento em Markdown/MDX + Git.
- MCP e skills para Claude Code, Cursor, Codex e OpenCode; Composer dentro do editor com auto-aprovação.
- App macOS (Apple Silicon) + CLI (Node 24) para Windows e Linux; sem modelo local por enquanto.
- Show HN com 38 pontos: **tração ainda pequena**, mas sintoma do padrão "PKM para agentes".

**Thymer**
- "The IDE for tasks, notes and planning": outliner + texto longo, databases, plugins em JavaScript.
- **E2EE**, offline, servidor self-host de arquivo único, "**Markdown Mirror**" para agentes.
- Em 17/10/2026 ainda aparece como "Beta coming soon"; preço não divulgado.

---

## (c) Tabela comparativa

| App | Organização | IA (convocada / proativa) | BYOK / local | Offline / local-first | Formato de dados | Windows | Entrada paga (USD) | Destaque |
|---|---|---|---|---|---|---|---|---|
| **Obsidian** | Pastas + .md, links/backlinks, tags, properties, **Bases**, Canvas, grafo | Core sem IA; plugins convocados; agentes externos via CLI/skills | Sim (plugins BYOK, Ollama/LM Studio; Interpreter c/ Ollama) | Sim, total | Markdown + JSON Canvas + .base (abertos) | Sim | Sync US$4/mês (anual) | "File over app"; 9.034 plugins (1.070 de IA) |
| **Logseq (OG / DB 2.0 beta)** | Outliner de blocos/nós, tags-classe, props tipadas, queries, journal | Sem IA nativa; MCP opcional + CLI | Via terceiros (MCP, plugins, Ollama) | Sim | OG: Markdown; DB: SQLite (+ Mirror MD 1-via) | Sim | Backer US$5/mês (Sync pago, só por convite) | PDF + flashcards + journal; rebuild longo |
| **Roam Research** | Outliner, refs de bloco, Datalog, daily notes | Sem nativa; Live AI (convocada, escreve em blocos); MCP oficial alpha | Sim (Live AI: OpenRouter, Ollama…) | Parcial [n/v] | Proprietário; export JSON/EDN/MD | Sim [n/v] | US$15/mês ou US$165/ano [agreg.] | Pioneiro; ritmo lento; sem free |
| **Anytype** | Objetos/tipos/relações, sets, coleções, grafo, canais/chats | Nenhuma ainda; agente "Bobrik" alpha (edita em lote); Anytwo com IA desligável | API local + MCP oficial; modelos locais planejados | Sim, P2P + E2EE | Proprietário (any-sync); export MD/Any-Block | Sim | Plus US$4/mês anual [agreg.] | Privacidade; Anytwo = migração dura |
| **Capacities** | Objetos/tipos, props, tags, coleções, queries, daily notes | Convocada (Ctrl+J, `/Ask AI`, painel) com **aprovação por padrão**; auto-tag | **Não** (BYOK encerrado em 17/08/2026); MCP connectors | Offline sim; cloud-first, sem E2EE | Proprietário; export MD | Sim | Pro US$9,99/mês anual | Leitor e anotação de PDF (set/2026); add-on de IA |
| **Tana (novo) / Tana Outliner** | Outliner + **supertags**/fields; novo: reuniões/docs | **Muito proativa** (agente de reunião, sugestões ao vivo, daily brief) com aprovação de ações | Não (só Business é "LLM agnostic") | Outliner: offline desktop limitado; cloud | Proprietário; export JSON/MD | Sim | Novo: Pro US$20/usuário/mês (early bird); Outliner Plus US$8/mês | Pivô para "agentic meeting platform" |
| **Heptabase** | Cards em whiteboards, tags/DB, Journal, Inbox | Convocada (chat por whiteboard, ações em cards) + Agent que edita + AI Tutor | Não (créditos; Pro só Gemini) | Offline sim; **sync na nuvem obrigatório** desde out/2025 | Proprietário; export MD | Sim | Pro US$8,99/mês (anual) | PDF → highlight cards; concorrente mais próximo da persona |
| **Reflect (Open)** | Daily notes + notas, backlinks, tags | Convocada (Ask your notes com citações) | **Sim** (OpenAI/Anthropic/Google/**OpenRouter**); busca semântica on-device | Sim | Markdown em pasta (iCloud/Git) | Experimental | Mac grátis; iOS assinatura [n/v] | Reescrita em **Tauri** + open-source (jul/2026) |
| **Amplenote** | Notas + tags, backlinks, tarefas, calendário, Jots | Convocada via plugins | Sim (AmpleAI: OpenAI + Ollama) | [n/v]; cloud; Vault E2EE | Proprietário [n/v] | Sim [n/v] | Pro ~US$6–7/mês [agreg., n/v] | Nota ↔ tarefa ↔ calendário com pontuação |
| **Supernotes** | Cards (vários pais), links, coleções, grafos, mapas | Opt-in (Vision sugere, usuário confirma) | Não | Offline sim; cloud | Proprietário; export MD/PDF | Sim | £6/mês (£72/ano) | Flashcards FSRS nos cards |
| **AFFiNE** | Docs + whiteboard + databases | Convocada (sidebar, Ask AI inline/canvas) | BYOK experimental (0.27); local planejado | Workspaces locais (IA exige cloud) | CRDT próprio (yjs); export MD | Sim | Pro US$6,75/mês; IA US$8,9/mês | Open-source Notion + Miro (73,6 mil estrelas) |
| **SiYuan** | Árvore de docs + blocos, refs, DB (4 views), grafo | Convocada + AI Agent (3.8) + MCP | **Sim** (OpenAI-compatível; conta ChatGPT) | Sim; sync E2EE | `.sy` (JSON) local | Sim | US$64 único (PRO) | PDF ↔ bloco + FSRS + DB, barato |
| **Trilium (TriliumNext)** | Árvore com clones, atributos, collections | Convocada (chat + sidebar que edita; LLM no editor) | **Sim** (Ollama, LM Studio, OpenAI-compatível, assinatura Claude Code) | Sim; sync self-host | Local (SQLite [n/v]); export HTML/MD | Sim | Grátis | Leitor de PDF + OCR (2026); self-host |
| **Workflowy** | Outline único, mirrors, boards, tables, panes, calendário | Convocada (ferramentas opcionais via OpenAI/Anthropic) | Não | [n/v]; cloud | Proprietário; OPML [n/v] | Sim | Pro US$6,99/mês anual | Simplicidade + calendário (2026) |
| **RemNote** | Rems (outliner) + docs + flashcards + canvas | Convocada e gerativa no estudo (Tutor, cards, quizzes) | Não; MCP desktop | Offline sim; cloud | Proprietário [n/v] | Sim | Pro US$8/mês (US$96/ano) | Notas = flashcards; Learn PDF |
| **Scrintal** | Canvas + docs + links | AI Assistant [n/v] | [n/v] | [n/v]; cloud | [n/v] | Sim | [n/v] | Aparentemente estagnado; time promove Gobu.ai |
| **Kosmik** | Canvas + browser embutido | Ambiente (auto-tag, busca) | Não | — | — | Sim | **Encerrado** em 31/05/2026 (era US$11,99) | Sunset |
| **Napkin** | Ideias agrupadas por IA | **Proativa** (tópicos, conexões, Daily Flow) | Não | Cloud | Proprietário | **Não** (só iPhone) | Assinatura [n/v] | Desktop desligado em 30/06/2026 |
| **mymind** | Itens sem pastas; Smart Spaces | **Proativa/ambiente** (auto-tag, resumos, Serendipity) | Não | Cloud | Proprietário | **Não** (web) | US$4,99/mês (sem IA); US$7,99 (com IA) | "Folders are dead" |
| **Recall** | Base de conteúdo salvo + grafo automático | **Proativa** (augmented browsing) + chat | Não | Cloud | Proprietário; export MD | Via browser [n/v] | Plus US$10/mês anual | Resumos + quizzes SRS; MCP no free |
| **Mem** | Notas + agente | **Muito proativa** (nudges) | Não | Cloud [n/v] | Proprietário | Sim (Push-to-Remember) | Plus US$9/mês | "AI chief of staff" |
| *Monet (referência interna)* | Cadernos > matérias > notas, notas vinculadas, Related, Calendar, Tasks | Convocada (`/comandos`, chat); **nunca escreve direto** | Sim (OpenRouter + Tavily); sem modelo local | Sim, sem conta | SQLite local (+ `.md` por nota no appData para RAG) | Sim (nativo, Tauri) | Grátis | Library PDF/EPUB com grifos → citações + chat descartável por pasta |

Legenda: [n/v] = não verificado; [agreg.] = preço de agregador (página oficial ilegível ou bloqueada).

---

## (d) Fontes (todas acessadas em 17/10/2026)

**Obsidian**
- https://obsidian.md/pricing
- https://obsidian.md/sync
- https://obsidian.md/help/sync/plans
- https://obsidian.md/changelog/
- https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0/
- https://obsidian.md/changelog/2025-08-18-desktop-v1.9.10/
- https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0
- https://obsidian.md/changelog/2026-02-27-sync
- https://obsidian.md/changelog/2026-05-28-desktop-v1.13.0/
- https://obsidian.md/help/cli
- https://obsidian.md/help/web-clipper/interpreter
- https://obsidian.md/help/bases
- https://community.obsidian.md/ (contagem de plugins e categoria AI)
- https://community.obsidian.md/plugins/copilot
- https://community.obsidian.md/plugins/smart-connections
- https://community.obsidian.md/plugins/obsidian-textgenerator-plugin
- https://www.obsidiancopilot.com/en
- https://www.obsidiancopilot.com/en/pricing
- https://smartconnections.app/
- https://github.com/kepano/obsidian-skills
- https://forum.obsidian.md/top?period=yearly
- https://forum.obsidian.md/tag/mobile
- https://www.capterra.com/p/220063/Obsidian/reviews/
- https://marlvel.ai/apps/md-obsidian
- https://unabyss.com/blog/best-ai-plugins-for-obsidian
- https://anthemcreation.com/en/artificial-intelligence/ai-plugins-obsidian-2026-comparison/

**Logseq**
- https://github.com/logseq/logseq/releases
- https://github.com/logseq/docs/blob/master/db-version.md
- https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020
- https://discuss.logseq.com/t/whats-new-with-logseq-db-april-26-2026/34977
- https://discuss.logseq.com/t/logseq-db-changelog/30013/35
- https://discuss.logseq.com/top?period=yearly
- https://kompozy.io/news/logseq-2-0-db-version-beta
- https://opencollective.com/logseq
- https://blog.logseq.com/
- https://nithinbekal.com/posts/logseq-to-obsidian/
- https://hn.nuxt.dev/item/48896229
- https://www.usecarly.com/blog/logseq-alternatives/
- https://claudemarketplaces.com/mcp/ergut/mcp-logseq

**Roam Research**
- https://github.com/Roam-Research
- https://github.com/Roam-Research/roam-tools
- https://github.com/fbgallet/roam-extension-speech-to-roam
- https://toolradar.com/tools/roam-research
- https://nesslabs.com/?p=10065
- https://frontdeskreview.com/software/note-taking-apps/roam-research.md
- https://developers.fabric.so/comparison/fabric-vs-roam-research
- https://aisotools.com/blog/roam-research-review-2026

**Anytype**
- https://community.anytype.io/c/news-announcements/11
- https://community.anytype.io/t/anytwo-and-the-future-of-anytype/31235
- https://community.anytype.io/t/ai-agent-on-anytype-alpha-demo/30881
- https://community.anytype.io/t/anytype-desktop-0-56-0-its-fast/31082
- https://doc.anytype.io/anytype-docs/memberships/monetization
- https://frontdeskreview.com/software/note-taking-apps/anytype.md
- https://www.getdrio.com/mcp/io-github-anyproto-anytype-mcp/md (repositório oficial: github.com/anyproto/anytype-mcp)
- https://community.anytype.io/tag/Performance
- https://checkthat.ai/brands/anytype/alternatives

**Capacities**
- https://capacities.io/pricing
- https://capacities.io/whats-new
- https://capacities.io/whats-new/release-69
- https://capacities.io/whats-new/release-70
- https://capacities.io/whats-new/release-71
- https://docs.capacities.io/reference/ai-assistant
- https://capacities.io/compare/obsidian
- https://feddit.it/post/10112143
- https://www.saner.ai/blogs/capacities-review
- https://gummysearch.com/r/capacitiesapp
- https://apps.apple.com/us/app/capacities-notes-pkm/id1670188548

**Tana**
- https://tana.inc/pricing
- https://tana.inc/changelog
- https://tana.inc/blog/best-pkm-tools-2026
- https://outliner.tana.inc/
- https://outliner.tana.inc/pricing
- https://outliner.tana.inc/blog/tana-desktop-now-works-offline-your-knowledge-graph-anywhere
- https://outliner.tana.inc/blog/export-data-download-copy-options
- https://aitoolsatlas.ai/tools/tana/pricing
- https://costbench.com/changelog/tana-plan-added-2026-07/
- https://costbench.com/changelog/tana-price-increase-2026-02/
- https://finder.techleap.nl/news/feed/tana-secures-25m-for-ai-workspace

**Heptabase**
- https://heptabase.com/pricing
- https://heptabase.com/
- https://heptabase.com/ai-tutor
- https://wiki.heptabase.com/changelog
- https://wiki.heptabase.com/changelog/2025
- https://wiki.heptabase.com/work-with-ai
- https://wiki.heptabase.com/pdf-annotation
- https://www.producthunt.com/products/heptabase/reviews
- https://subger.com/en/service/heptabase

**Reflect**
- https://reflect.app/
- https://reflect.app/#pricing
- https://reflect.app/blog
- https://reflect.app/blog/reflect-open
- https://github.com/team-reflect/reflect-open
- https://github.com/team-reflect/reflect-open/releases
- https://reflect.academy/

**Amplenote** (amplenote.com/pricing devolveu 403)
- https://github.com/alloy-org
- https://github.com/alloy-org/ai-plugin
- https://github.com/alloy-org/pro-ai
- https://toolradar.com/tools/amplenote/pricing
- https://costbench.com/software/note-taking/amplenote/free-plan/
- https://www.getapp.com/all-software/a/amplenote/

**Supernotes**
- https://supernotes.app/pricing
- https://supernotes.app/changelog
- https://supernotes.app/

**AFFiNE**
- https://affine.pro/pricing
- https://affine.pro/ai
- https://affine.pro/blog
- https://github.com/toeverything/AFFiNE
- https://github.com/toeverything/AFFiNE/releases
- https://github.com/toeverything/AFFiNE/releases/tag/v0.27.0
- https://github.com/toeverything/AFFiNE/issues?q=is%3Aissue+sort%3Areactions-%2B1-desc

**SiYuan**
- https://b3log.org/siyuan/en/pricing.html
- https://b3log.org/siyuan/en/
- https://github.com/siyuan-note/siyuan
- https://github.com/siyuan-note/siyuan/releases
- https://github.com/siyuan-note/siyuan/releases/tag/v3.8.0
- https://github.com/siyuan-note/siyuan/blob/master/app/changelogs/v3.8.0/v3.8.0.md
- https://github.com/siyuan-note/siyuan/issues?q=is%3Aissue+sort%3Areactions-%2B1-desc

**Trilium (TriliumNext)**
- https://github.com/TriliumNext/Trilium
- https://github.com/TriliumNext/Trilium/releases
- https://github.com/TriliumNext/Trilium/discussions

**Workflowy**
- https://workflowy.com/pricing/
- https://workflowy.com/
- https://workflowy.com/ai-terms/
- https://blog.workflowy.com/
- https://blog.workflowy.com/product-update-2026-08-panes-and-more/

**RemNote**
- https://www.remnote.com/pricing
- https://www.remnote.com/
- https://feedback.remnote.com/rss/changelog.xml

**Scrintal**
- https://scrintal.com/pricing
- https://scrintal.com/
- https://gobu.ai/

**Kosmik**
- https://www.kosmik.app/
- https://www.kosmik.app/pricing
- https://www.kosmik.app/blog

**Napkin**
- https://napkin.one/

**mymind**
- https://mymind.com/
- https://access.mymind.com/pricing

**Radar**
- https://www.recall.it/
- https://www.recall.it/pricing
- https://get.mem.ai/
- https://get.mem.ai/pricing
- https://thymer.com/
- https://braindetox.kr/en/posts/openknowledge_obsidian_alternative_2026.html
- https://aiindigo.com/blog/ai-first-knowledge-management-openknowledge-vs-obsidian-and-notion

**Contexto interno do Monet:** `monet_inventario.md` no mesmo scratchpad (inventário montado por outro agente em 17/10/2026), usado apenas para calibrar os bullets de relevância.
