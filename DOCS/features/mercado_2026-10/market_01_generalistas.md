# Estudo de mercado: apps de anotações generalistas/mainstream (contexto, outubro de 2026)

**Data de referência:** 2026-10-17

**Uso:** contexto para o estudo de mercado do Monet (app desktop Windows, local-first, IA convocada por /comandos, BYOK OpenRouter + Tavily).

**Escopo:**
- Os 14 apps pedidos: Notion, Evernote, Microsoft OneNote, Apple Notes, Google Keep, Bear, Craft, UpNote, Joplin, Standard Notes, Simplenote, Microsoft Loop, Zoho Notebook e Notesnook.
- Três acrescentados por relevância em 2025–2026: **Gemini Notebook (ex-NotebookLM)**, **Anytype** e **AFFiNE**.
- No fim da seção (b), um radar curto com nomes vizinhos: Obsidian, Capacities, Mem, Reflect, Granola, Goodnotes, Heptabase etc.

**Método e limitações:**
- **Fontes:** pesquisa feita em 2026-10-17, com busca e leitura de páginas web. Dei prioridade a fontes oficiais (páginas de preço, help center, release notes, blogs) e à imprensa de 2025–2026.
- **Reddit:** não pôde ser lido (bloqueado tanto para o buscador quanto para o fetch). O sentimento de usuário vem de Trustpilot, App Store, AlternativeTo, fóruns oficiais (Apple Community, Bear Community, Joplin Discourse, Zoho Community, TidBITS Talk etc.) e reviews da imprensa.
- **Cota de busca:** acabou no meio do trabalho. Daí em diante, as verificações foram feitas por leitura direta de páginas oficiais.
- **Preços:**
  - Algumas páginas são geolocalizadas e vieram em BRL (Craft, Google, Notesnook).
  - Outras carregam os valores via JavaScript e não os mostraram (Evernote, Zoho, Anytype).
  - Nesses casos o valor em USD vem da App Store dos EUA, de blog oficial ou de fonte secundária, sempre indicado.
- **Marcações:**
  - **[não verificado]:** não confirmado em fonte confiável.
  - **[sec.]:** fonte secundária.
  - Datas no formato dd/mm/aaaa.

---

## (a) Resumo executivo

### Padrões que se repetem no segmento

**1. A IA virou critério de plano e justificativa de reajuste, mais do que um add-on.**
- **Notion:**
  - Encerrou o add-on de IA para novos clientes em 13/05/2025.
  - A IA completa (agente, Meeting Notes, Enterprise Search, Research mode) ficou só no Business: US$ 20/membro/mês no anual, cerca de US$ 24 no mensal [sec.].
  - Desde 04/05/2026, os Custom Agents cobram créditos à parte (US$ 10 por 1.000).
- **Microsoft:**
  - Pôs o Copilot no Microsoft 365 Personal/Family em 16/01/2025, com alta de US$ 3/mês. Hoje são US$ 9,99/mês (Personal) e US$ 12,99/mês (Family).
  - Criou o Premium (US$ 19,99/mês) em 01/10/2025.
  - No Loop, o Copilot só existe com licença de trabalho (Copilot Business, US$ 21/usuário/mês no anual).
- **Evernote:** trocou os planos em 2025 (Starter cerca de US$ 99/ano, Advanced cerca de US$ 249,99/ano [sec.]) e lançou a v11 com um AI Assistant "built in close collaboration with OpenAI" (19/01/2026).
- **Zoho:** criou o plano Pro Plus (jul/2026) para empacotar o Notebook AI.
- **Google:** embute a IA do Keep e do Gemini Notebook nos planos Google AI Plus, Pro e Ultra.
- **Add-ons explícitos** sobrevivem nos menores: AFFiNE AI (+US$ 8,90/mês) e Goodnotes AI Pass (+US$ 9,99/mês).
- **Craft, a contracorrente:** créditos incluídos, BYOK e a promessa pública de "not locking AI behind another pricing tier" (27/11/2025).

**2. De assistente a agente: no mainstream, a fronteira é a IA que age sozinha.**
- **Notion:** o Notion 3.0 (18/09/2025) reconstruiu a IA como agentes que criam e editam páginas e databases em lote. Os Custom Agents (GA em 04/05/2026) rodam por gatilho e por agenda.
- **Evernote:** o AI Assistant move notas, cria stacks, tarefas e eventos.
- **Apple Notes e Keep:** a Siri AI do iOS 27 (14/09/2026) cria e edita notas no Apple Notes. O Keep Live (03/09/2026) atualiza notas existentes por voz.
- **Gemini Notebook:** avisa que alguns artefatos podem ser "created automatically".
- **Mem e AFFiNE:** o Mem Agent "checks in when something needs you"; o AFFiNE promete auto-sorting/tagging.
- **Proatividade pontual:** Evernote e Zoho detectam gravações e reuniões sozinhos.
- **Para o Monet:** a IA "silenciosa e convocada" é um **posicionamento contrário** ao rumo dos grandes.

**3. "Revisar antes de aplicar" está virando o básico, então sozinho deixou de ser diferencial.**
- **Contenção no Notion:** o próprio Notion teve de criar "Plan Mode" (07/05/2026) e "Suggest edits" (28/08/2026) para conter edições indesejadas. Um review no Trustpilot (09/04/2026) relata que a IA sugeriu apagar todas as databases.
- **Revisão antes de aplicar já é padrão em:**
  - OneNote: resultado no painel, com "Copy" ou "Add to doc".
  - Zoho: o resultado "is shown for your review first".
  - Loop: o Copilot só insere pelo botão "Insert".
  - Evernote: AI Edit num diálogo, e Edit mode com mudanças destacadas para aceitar ou rejeitar.
  - Craft: modo Explore.
  - Gemini Notebook: "Save to note".
- **Na outra ponta:** o AFFiNE insere "AI blocks" direto no corpo do doc, e o chat do Joplin 3.7 edita a nota direto (com Ctrl+Z).
- **Para o Monet:** o que nenhum concorrente tem é a **combinação** — nota perene + chat descartável como tese explícita + BYOK + contexto por pasta/página + Library.

**4. A IA convocada de dentro do texto virou padrão de interação.**
- **/comandos e prompts salvos:**
  - Evernote: AI Prompts reutilizáveis chamados com "/" no editor (set/2026).
  - Notion: Skills, que são workflows salvos (3.4–3.7).
- **IA sobre a seleção:** Writing Tools da Apple, botão direito > Copilot no OneNote, ícone do Notebook AI no Zoho, "Ask AI" no AFFiNE, ✨AI no Evernote.
- **Para o Monet:** os /comandos estão alinhados com o mercado. O diferencial está no **destino** do resultado (chat descartável vs. nota) e no **controle** (BYOK, escopo).

**5. "Traga sua própria IA" chegou ao mainstream em 2026, de três formas.**
- **Chave própria (BYOK):**
  - Craft: OpenAI/Anthropic e modelos locais (05/06/2026).
  - Joplin 3.7 (31/08/2026): OpenAI, Anthropic, OpenRouter, Ollama/LM Studio, com a IA desligada por padrão.
  - AFFiNE: BYOK experimental na 0.27.
  - Reflect Open: só BYOK.
- **Assinatura que o usuário já tem:** o Notion aceita ChatGPT Plus/Pro para cobrir o uso (3.8, 13/10/2026, só Business/Enterprise). A Craft aceita "Sign in with ChatGPT".
- **Notas expostas a agentes externos via MCP, CLI ou API local:**
  - Evernote MCP (ago/2026).
  - Zoho Notebook MCP (mai/2026, 55 ferramentas).
  - Notion (3.5–3.8).
  - Craft MCP v2.
  - BearCLI e Claude Connector (Bear 2.8, 29/04/2026, com escopo por tags).
  - Simplenote MCP (escrita opt-in, com guardas).
  - Anytype Local API/MCP, AFFiNE MCP, Joplin MCP e Granola MCP.
- **Para o Monet:** **MCP virou item esperado em 2026.** O BYOK via OpenRouter está alinhado. Um MCP local com escopo por caderno ou pasta seria a peça que falta.

**6. Chat com as notas (RAG) é padrão nos planos pagos dos grandes, com escopos diferentes.**
- **Quem tem:**
  - Notion: workspace + apps conectados.
  - Evernote: mostra o contexto usado desde set/2026.
  - Craft: nível do Space.
  - AFFiNE: embedding do workspace.
  - Zoho: "Ask with My Content" [escopo não documentado].
  - Gemini Notebook: é o núcleo do produto, com checkbox de quais fontes entram no contexto e citações clicáveis.
- **Quem restringe ou não tem:**
  - Copilot no OneNote: documentado para a página atual.
  - Loop: o Copilot "cannot be used to ask about the Loop Workspace".
  - Joplin: o painel vê só a nota aberta; a busca semântica é local e só recupera.
  - Apple Notes e Keep: não têm chat sobre o acervo (Keep, segundo a documentação oficial).
- **Modelos:** a **OpenAI é o provedor dominante** por trás do mainstream (declarado pelo Evernote; citado no FAQ do Zoho). Escolha de modelo só existe no Notion (seletor) e nos apps com BYOK.

**7. Privacidade e IA quase não convivem, e há demanda explícita por IA desligável.**
- **Apps de privacidade sem IA:** Standard Notes, Notesnook e UpNote seguem sem IA em out/2026. Não encontrei manifesto de recusa; é só ausência.
- **Joplin concilia os dois:** IA opt-in, provedores remotos bloqueados por padrão, embeddings locais e notas criptografadas fora do alcance da IA.
- **Pesquisas de opinião:**
  - Pew (17/09/2025): 50% dos americanos estão mais preocupados do que animados com a IA no dia a dia; 53% acham que ela vai piorar a capacidade de pensar criativamente; cerca de 6 em 10 querem mais controle sobre como ela é usada.
  - Survey ZDNET-Aberdeen/YouGov (mar/2025, n=2.354) [sec.]: 31% abandonariam um produto se não pudessem desligar a IA, e mais 38% talvez.
- **Reações concretas:**
  - "keeps adding AI features I don't want or need" (Trustpilot do Evernote, 10/10/2026).
  - "random AI notes spawning" (fórum do Zoho).
  - The Register acusando o Notepad do Windows de "enshittification" por causa da IA (22/01/2026).
- **Para o Monet:** "IA como meio, não fim" conversa com uma parcela real e crescente do público.

**8. Local-first e offline continuam raros entre os grandes, e a perenidade virou argumento.**
- **Nuvem obrigatória ou offline parcial:**
  - Notion: offline parcial só desde 19/08/2025 (por página, sem navegador).
  - Loop e Gemini Notebook: online-only.
  - Evernote e Zoho: exigem conta e nuvem.
  - OneNote: só faz cache (notebook local só no desktop Windows).
  - Craft: offline fora da Apple só em beta (fev/2026).
- **Local-first de fato:** Joplin, Anytype, AFFiNE (workspace local), Bear e Apple Notes (banco local + iCloud), além de Obsidian (radar).
- **Risco de plataforma em 2025–2026:**
  - A Meta comprou a Limitless (ex-Rewind) e desligou a captura do app em 19/12/2025.
  - O Simplenote está "no longer in active development" (Automattic, 03/07/2026).
  - O Evernote migrou planos à força, com relatos de reajustes extremos em contas de empresa (jun/2026).
  - O NotebookLM foi renomeado (16/07/2026).
  - A Microsoft embaralha Loop, Copilot Pages e Copilot Notebooks, e encerrou o OneNote for Windows 10 (14/10/2025).

**9. Windows é mal servido pelos apps "de design", e a régua básica do Windows subiu.**
- **Sem app nativo:** Apple Notes (só iCloud.com), Bear (Bear Web em beta, online), Keep (web; o WSA acabou em 05/03/2025), Gemini Notebook (navegador), Loop (web/PWA) e Reflect.
- **Com app, mas com problemas:** Craft (recursos chegam com atraso), Zoho ("Search is completely broken for PC"), Evernote (relatos de crashes e tela branca) e Simplenote (em manutenção).
- **App Windows sólido:** OneNote, Notion (nuvem), Joplin, UpNote, Standard Notes, Notesnook, Anytype e AFFiNE.
- **A régua do próprio Windows subiu:** o **Notepad do Windows 11** ganhou Markdown (jun/2025), tabelas (nov/2025) e Write/Rewrite/Summarize — de graça e local em Copilot+ PCs, ou na nuvem com conta Microsoft. A captura simples "com IA" já vem no sistema.
- **Para o Monet:** o espaço vago é o de um **app Windows nativo, polido, offline e com profundidade de estudo**.

**10. Estudo e leitura são a maior lacuna dos generalistas.**
- **Anotação de PDF existe em:**
  - Evernote: anotação e PDF editor redesenhado (set/2026).
  - Zoho: destaque e comentários, no Pro.
  - OneNote: printout + tinta.
  - Apple Notes: marcação com Pencil.
- **Nenhum dos 17** liga grifos a notas como citações, e nenhum tem leitor EPUB.
- **Gemini Notebook:** aceita EPUB como fonte (mar/2026) e gera flashcards/quizzes com progresso salvo, mas não é um leitor e não tem grifos.
- **Fora dos generalistas:** só o Heptabase (PKM) oferece PDF highlights.
- **Onde vai o investimento:** os grandes estão apostando em **áudio e reuniões** (transcrição ao vivo, meeting notes, identificação de falantes), não em leitura.
- **Para o Monet:** a Library (grifos → citações → notas, com chat lateral sobre a página) não tem equivalente direto no segmento.

**11. Tempo e organização pessoal: o pacote "daily note + tasks + calendário" está sendo priorizado.**
- **Quem está investindo:**
  - Craft: Daily Notes com templates, Tasks com lembretes e Calendar unificado (2026).
  - Evernote: Tasks + Calendar (Google/Outlook); desde set/2026 a IA cria e move eventos.
  - Notion: Calendar + agente que gerencia a agenda (16/07/2026).
  - Anytype: Date Objects como "índice temporal" do dia.
  - AFFiNE: Journals + Google Calendar/CalDAV.
- **No sentido inverso:** o Keep migrou os lembretes para o Google Tasks (desde 28/11/2025).
- **Sem daily notes nem calendário:** Apple Notes, Bear, Simplenote, UpNote, Notesnook e OneNote.

**12. Preços: entrada paga entre US$ 1,99 e cerca de US$ 15/mês, planos grátis cada vez mais estreitos e vitalício raro.**
- **Planos grátis restritos:** Evernote (50 notas, 1 caderno, 1 dispositivo), UpNote (50 notas), Craft (1.500 blocos), Standard Notes (só texto puro).
- **Vitalício:** só UpNote (US$ 39,99) e AFFiNE Believer (US$ 499,99).
- **Custo de nuvem:** o Notesnook acabou com o armazenamento "ilimitado" e subiu os preços (04/10/2025), o que mostra que sync em nuvem custa caro. Sem servidor, o Monet pode ser grátis de forma sustentável.
- **Importadores como aquisição:**
  - Joplin: OneNote (3.2) e Obsidian (3.7).
  - AFFiNE: Notion, Obsidian, Bear e OneNote (0.27).
  - Notesnook: Evernote, OneNote, Zoho, Keep, Obsidian e UpNote.
  - Standard Notes: Evernote, Simplenote, Apple Notes e Keep.
  - Zoho: Evernote e OneNote.
  - Markdown virou a moeda de interoperabilidade: Apple Notes desde o iOS 26, Zoho em jun/2026, Notion com Markdown API.

**13. O capital de 2025–2026 foi para reuniões e captura por voz, não para generalistas.**
- **Rodadas e captura:** Granola levantou US$ 125 mi em Series C (25/03/2026, valuation de US$ 1,5 bi). No hardware de captura, a Plaud lançou novos aparelhos (jan/2026) e a Pocket levantou US$ 11 mi (jun/2026).
- **Bending Spoons** (dona do Evernote) abriu capital em 01/07/2026.
- **Nenhum generalista novo** com tração clara apareceu no período.
- **Escala dos grandes:**
  - Notion: passou de 100 mi de usuários em ago/2024 (blog do CEO).
  - Gemini Notebook: declara mais de 30 mi de usuários (jul/2026).
  - OneNote: mais de 500 mi de downloads no Google Play [sec., Wikipedia].

**14. Reclamações recorrentes (transversais):**
- **Preço e cobrança/renovação:** Evernote, Notion, Standard Notes.
- **Sync e perda de notas:** Apple Notes, Keep, Simplenote, Anytype, Joplin, OneNote.
- **Lentidão em notas ou acervos grandes:** Notion, Apple Notes no iPadOS 26, Bear com sketches, AFFiNE, Zoho.
- **Complexidade e terminologia:** Notion, Anytype.
- **IA "empurrada":** Evernote, Zoho, Notepad, Keep.
- **Lock-in e export fraco:** Apple Notes (nota a nota), OneNote (.one), Evernote (ENEX), Zoho (export em massa só na web).
- **Estratégia confusa:** Loop × Copilot Pages × Copilot Notebooks; rename do NotebookLM.
- **Ausência no Windows:** Apple Notes, Bear, Keep.

### Implicações rápidas para o Monet (para calibrar o estudo seguinte)

- **Onde o Monet já está à frente do segmento:**
  - local-first + Windows nativo + grátis sem limites artificiais;
  - IA convocada com BYOK e sem escrita direta, combinada com chat descartável e contexto por pasta;
  - leitor PDF/EPUB com grifos, citações e chat sobre a página (nenhum generalista tem).
- **Onde o Monet está abaixo do padrão:**
  - sync/mobile (todos os grandes sincronizam);
  - MCP/API local para expor as notas a agentes externos;
  - transcrição de áudio de aula ou curso (Apple Notes, Evernote, Zoho, Joplin mobile);
  - export em lote em formato aberto (Markdown);
  - importadores de Evernote/OneNote;
  - flashcards/quizzes gerados das fontes (Gemini Notebook).
- **O que evitar (a reclamação mais repetida de cada líder):**
  - o agente que edita sozinho (Notion);
  - limites artificiais e IA empurrada (Evernote);
  - superfícies de IA fragmentadas (Microsoft);
  - IA presa a assinatura e plataforma (Keep, Apple);
  - a ansiedade de "app parado" (Simplenote).
- **Mensagem com evidência de demanda:** "suas notas são suas: ficam no seu PC, a IA só entra quando você chama e nunca escreve sem você aceitar". Ela se apoia nos dados do Pew e do ZDNET-Aberdeen e nas reclamações de IA empurrada.

---

## (b) Apps: seções detalhadas

Cada seção segue os 11 itens do briefing. As fontes de cada app estão consolidadas na seção (d). Ordem: os 14 pedidos, depois os 3 acrescentados e por fim o radar.

### 1. Notion

1. **Posicionamento e público-alvo:** "Connected workspace" que, desde o Notion 3.0 (set/2025), se reposiciona como workspace "AI-first" com agentes que executam trabalho. Público principal: equipes e empresas (startups, produto, operações), além de indivíduos e estudantes (Plus grátis para estudantes/educadores com e-mail acadêmico).
2. **Modelo de organização:** Workspace > teamspaces > páginas aninhadas infinitamente > blocos. Databases com propriedades, relations/rollups e múltiplas views (table, board, calendar, timeline, gallery, list, chart, form, feed). Links/@mentions entre páginas e backlinks; synced blocks; templates. Sem grafo nativo e sem canvas/whiteboard nativo [não verificado para 2026].
3. **Editor:** WYSIWYG em blocos com slash commands (`/`), atalhos Markdown, toggles, callouts, colunas, simple tables (merge de células desde 26/05/2026), equações, código, embeds; agentes podem criar "HTML blocks" interativos (calculadoras, quizzes) desde o 3.6 (01/07/2026). Templates e marketplace de templates.
4. **Estudo/leitura:** PDF entra como embed/visualização; não há anotação/grifo nativo de PDF [não verificado — nenhuma fonte oficial encontrada]. Web Clipper oficial (extensão de navegador) salva páginas. Sem flashcards/SRS nativos. Áudio: AI Meeting Notes (transcrição + resumo sem bot, plano Business+), com speaker labels e upload de áudio desde 01/07/2026. Notion AI aceita PDF/imagem anexados no chat (help de terceiros cita limite de 5 MB no Free/Plus [não verificado na página oficial]); há relatos de que a IA não lê bem PDFs apenas embutidos em páginas.
5. **Tempo/organização pessoal:** Sem "daily note" nativa; usa-se database + templates recorrentes. Tasks via databases (template Projects & Tasks), lembretes por `@remind`/datas. Notion Calendar (app separado, lançado em jan/2024) integra eventos e páginas; desde 16/07/2026 o agente vê e gerencia agenda, marca reuniões e acha horários livres (desktop). Notion Mail (15/04/2025) completa a suíte.
6. **IA (2025–2026):**
   - **O que faz:** Notion Agent (personal agent) que executa tarefas multi-etapa (>20 min) — cria/edita páginas e databases em lote, redige docs, pesquisa no workspace, em apps conectados (Slack, Drive, GitHub, Outlook, Salesforce, Box…) e na web; Research mode (relatórios); Enterprise Search; AI Meeting Notes; AI Autofill em databases; Skills (workflows salvos, 3.4/3.7); Custom Agents autônomos com gatilhos/agendamentos (beta 24/02/2026, GA 04/05/2026); Workers (código próprio como ferramenta de agentes); "External Agents" (Claude, Cursor podem receber tarefas e ser @mencionados — 3.6) e conexões MCP com 150+ ferramentas (3.8).
   - **Onde vive:** chat do agente (painel/sidebar e Home/chats no mobile), inline no editor (perguntar à IA sobre seleção/página), propriedades de database (Autofill), bloco de Meeting Notes, Custom Agents rodando em segundo plano, app iOS dedicado "Notion Agents" (08/07/2026).
   - **Proativa vs. convocada:** híbrida. O agente pessoal é convocado; mas Custom Agents rodam sozinhos por gatilho/agenda (inclusive após Meeting Notes — 31/07/2026) e o Autofill atualiza propriedades automaticamente. A direção do produto é claramente agêntica/autônoma.
   - **Chat com as notas (RAG):** sim — busca/QA sobre o workspace inteiro e apps conectados; vector DB declarado: Turbopuffer.
   - **Escreve direto no documento?** Sim, por padrão o agente cria/edita páginas e databases. Contrapesos adicionados em 2026: "Plan Mode" (07/05/2026, pergunta e planeja antes de mudanças grandes) e "Suggest edits" (28/08/2026, propõe mudanças que o usuário aceita uma a uma — precisa ser pedido). Há relato de usuário de que a IA "sugeriu apagar permanentemente todas as databases" (Trustpilot, 09/04/2026).
   - **Modelos:** multi-modelo com seletor (desde 14/08/2026 lista curta + scorecards; admins controlam quais modelos são permitidos — 09/09/2026). Citados oficialmente: Claude Sonnet 4 e GPT-5 (3.0, set/2025); Claude Opus 4.7 (abr/2026); Opus 4.8, Grok 4.3 e o open-weight GLM 5.2 (jul/2026); GPT 6.1-Sol, GPT-6 Luna, Opus 5.5, Sonnet 5.5 (out/2026). Gemini [não verificado].
   - **BYOK ou local:** sem chave de API própria e sem modelos locais. Novidade de 13/10/2026 (3.8): quem tem ChatGPT Plus/Pro pode conectar a assinatura para cobrir o uso de IA no Notion ("We don't add a markup") — só nos planos Business/Enterprise. Dados não usados para treino por padrão; ZDR apenas no Enterprise; demais planos com retenção ≤30 dias no provedor.
   - **Preço do add-on:** desde 13/05/2025 a Notion AI deixou de ser add-on para novos usuários e passou a vir só no Business/Enterprise; Free/Plus têm apenas "Limited Trial". Custom Agents/Workers consomem Notion credits: US$ 10 por 1.000 créditos/mês (só Business/Enterprise; créditos não acumulam).
7. **Plataformas, offline, sync, E2EE, formato/export:** Web, macOS, Windows, iOS, Android (CLI para Windows citada no 3.6). Cloud-first; offline mode só desde a 2.53 (19/08/2025), por dispositivo, nos apps desktop/mobile (não no navegador): Free escolhe páginas para baixar; Plus/Business/Enterprise baixam automaticamente Recents/Favorites; databases salvam só as 50 primeiras linhas por padrão; blocos de IA, embeds e forms não funcionam offline. Sem E2EE (criptografia em trânsito/repouso; dados no servidor). Export: Markdown & CSV, HTML e PDF (PDF com subpáginas só Business/Enterprise); Markdown API (3.5, mai/2026).
8. **Preço (fonte: https://www.notion.com/pricing, acessado em 2026-10-17):**
   - Free: US$ 0 (blocos ilimitados para indivíduo; upload até 5 MB; histórico 7 dias; trial limitado de IA).
   - Plus: US$ 10/membro/mês (valor exibido por padrão; a página tem toggle "Pay yearly — save up to 20%" e não mostra o valor mensal no HTML). Fontes secundárias: US$ 12 no mensal [não verificado na página oficial].
   - Business: US$ 20/membro/mês (idem; US$ 24 no mensal segundo fontes secundárias [não verificado na página oficial]) — único plano não-Enterprise com Notion AI completa (Agent, Meeting Notes, Enterprise Search, Research mode).
   - Enterprise: sob consulta. Add-ons: Notion credits US$ 10/1.000; domínio próprio US$ 8/mês (anual) ou US$ 10 (mensal). Plus grátis para estudantes/educadores (1 membro).
9. **Mudanças e notícias 2025–2026:**
   - 15/04/2025: lançamento do Notion Mail (2.50).
   - 13/05/2025: "Notion AI for Work" — AI Meeting Notes, Enterprise Search, Research mode; IA passa a ser exclusiva de Business/Enterprise (fim do add-on para novos Free/Plus; assinantes antigos mantêm).
   - 19/08/2025: offline mode (2.53), recurso historicamente muito pedido.
   - 18/09/2025: Notion 3.0 — Notion AI reconstruída como Agents (memória via página de instruções, multi-etapa, conectores, MCP).
   - 24/02/2026: Notion 3.3 abre beta de Custom Agents; 14/04/2026: 3.4 (Skills, agentes 35–50% mais baratos de rodar, anúncio de créditos); 04/05/2026: Custom Agents GA com cobrança por créditos.
   - 13/05/2026: 3.5 Developer Platform (Workers, CLI, Markdown API, External Agents API/Agent SDK).
   - 01/07/2026: 3.6 (External Agents Claude/Cursor, leitura/criação de PPTX/XLSX/DOCX/PDF por agentes, Outlook, novos modelos); 08/07/2026: app iOS de Agents.
   - 28/08/2026: Suggest edits; 15/09/2026: 3.7 (biblioteca de skills, sub-agentes, Agent SDK beta); 13/10/2026: 3.8 (MCP para agentes externos, Skills API, assinatura ChatGPT cobrindo uso, version history melhorado, permissões por coluna).
10. **Forças, fraquezas e reclamações:**
    - Forças: flexibilidade (databases + docs), templates, design limpo, ecossistema enorme e integração com apps de trabalho; ritmo de lançamentos muito alto.
    - Reclamações recorrentes no Trustpilot (resumo de 88 reviews recentes): cobrança/renovação automática e reembolsos negados (ex.: "I was charged €406.98 for an annual renewal with no clear advance reminder", 02/07/2026); lentidão/instabilidade ("its often slow or goes down, which makes it frustating to rely on", 13/11/2025); complexidade ("The most inconvenient app I've ever used", 27/04/2026); confiabilidade da IA (sugestão de apagar databases, 09/04/2026). Fonte: https://www.trustpilot.com/review/notion.so?page=2
    - Empacotamento da IA no Business (mai/2025) gerou queixas de usuários Plus que perderam recursos ou ficaram com trial limitado (relato de "20-response trial", Trustpilot) e críticas de que o salto para Business é caro para equipes pequenas (reviews de 2026 em dev.to e aiworthit.com).
    - Offline ainda parcial (por página, sem web, limites em databases); sem E2EE.
11. **Relevância para o Monet:**
    - **Evitar:** a trajetória "agente que edita tudo e roda sozinho" — o próprio Notion precisou adicionar Plan Mode e Suggest edits para conter edições indesejadas. A regra do Monet (IA nunca escreve direto; só via "Anotar/Inserir") é um diferencial claro de confiança para notas perenes.
    - **Lacuna:** IA completa exige Business (US$ 20–24/mês) e é cloud-only; para o autodidata individual não há opção BYOK barata nem offline real. Monet: grátis + BYOK + local-first.
    - **Inspira:** "Skills"/instruções por página como memória do agente (análogo ao system prompt + memória por pasta do Monet) e Meeting Notes/áudio como fonte; Notion conectar assinatura do ChatGPT mostra que "traga sua própria IA" virou demanda mainstream.

### 2. Evernote

1. **Posicionamento e público-alvo:** o veterano da "captura universal" (web clipper, scan, OCR, áudio), hoje da Bending Spoons (aquisição anunciada em nov/2022). Sob o novo dono virou app de produtividade "AI-powered" para profissionais e power users com acervos grandes (muito lock-in de quem usa há anos), reuniões gravadas e pequenas equipes. A v11 (jan/2026) foi a "primeira grande atualização em cinco anos".
2. **Modelo de organização:** Notebooks agrupados em Stacks; Tags; Spaces (colaboração); Shortcuts/pins; links entre notas e @ mentions de notas, cadernos, stacks, spaces e pessoas (2026); Home com widgets; Templates; Tabs de notas (2026). Não tem databases/propriedades, grafo nem canvas. Busca forte: OCR em imagens, PDFs e gravações, mais Semantic Search.
3. **Editor:** WYSIWYG (base Electron desde a v10, de 2020), com Markdown básico. Em 2026 ganhou slash commands e @ mentions (inclusive datas que se atualizam), toolbar inline customizável (jun/2026), callouts e toggles, diagramas Mermaid, sumário flutuante, tabelas com ordenação, filtro e linha/coluna de cabeçalho (out/2026), marcadores pastel e vivos (jul/2026), templates com datas relativas ("@Next Monday", ago/2026) e blocos de Tasks dentro da nota.
4. **Estudo/leitura:** Web Clipper para Chrome, Edge, Firefox e Safari; scan por câmera, com PDF no mobile (2026); anotação de PDF e um PDF editor redesenhado no desktop (set/2026: organizar páginas, combinar/dividir, apagar anotações, redigir). Busca destaca ocorrências dentro de imagens, PDFs e gravações (ago/2026). Áudio forte: AI Transcribe e AI Meeting Notes (resumo e identificação de falantes), transcrição ao vivo em painel flutuante, ditado, transcrição de arquivos enviados de até 2 h, transcrição de vídeo (jul/2026). **Não tem** flashcards/SRS nem leitor de EPUB.
5. **Tempo/organização pessoal:** Tasks com prazo, lembrete e recorrência; Evernote Calendar conectado a Google e Outlook (1 calendário externo no Free, 5 nos pagos); desde set/2026 o AI Assistant cria, move e cancela eventos de dentro da nota. Não achei "daily note" nativa [não verificado]; o caminho é usar templates.
6. **IA (2025–2026):**
   - **O que faz:** *AI Assistant* (chat que busca, resume, extrai ações, gera conteúdo, navega na web e executa ações na conta: move notas, cria stacks, renomeia, fixa, cria tarefas, lembretes e eventos, transcreve gravações). *Semantic Search* (busca por significado). *AI Edit* (escrever, resumir, arrumar e traduzir o texto selecionado). *AI Cleanup* (só mobile). *AI Transcribe/Meeting Notes*. *AI Prompts* (fluxos salvos e reutilizáveis que rodam sobre nota vazia, seleção, transcrição ou gravação; jun/2026). *AI Memory* (guarda preferências do usuário; o help center ainda o marca em parte como "coming soon"). *Evernote MCP* oficial (ago/2026), que deixa Claude, ChatGPT e Cursor buscarem, lerem, criarem e organizarem notas e tarefas.
   - **Onde vive:** o AI Assistant é um painel de chat aberto por um botão no canto inferior direito (desktop e web; no mobile desde jul/2026). O AI Edit fica no botão ✨AI da toolbar e abre um diálogo. Os AI Prompts podem ser chamados com "/" no editor (set/2026).
   - **Proativa vs. convocada:** majoritariamente convocada (botão, seleção ou "/"). Há toques proativos: sugestão de vincular gravação ao evento do calendário e transcrição ao vivo que pode começar sozinha (ago/2026, configurável). Usuários sentem a IA como "empurrada" (ver item 10).
   - **Chat com as notas (RAG):** sim. O Assistant usa notas, tarefas e agenda como contexto e, desde set/2026, mostra no topo do chat qual contexto está usando. A Semantic Search foi desenvolvida internamente (press release, jan/2026).
   - **Escreve direto no documento?** Depende do recurso. O *AI Edit* **não** escreve: o resultado aparece num diálogo para o usuário copiar e colar, e fechar a janela descarta o texto. O *AI Assistant* tem **Ask mode** (só responde, sem tocar na nota) e **Edit mode** (jul/2026 no desktop/web, out/2026 no mobile): ele redige, reescreve e formata dentro da nota, mas cada mudança aparece destacada para o usuário aceitar uma a uma ou todas de vez.
   - **Modelos:** o AI Assistant foi "built in close collaboration with OpenAI" (press release de v11, jan/2026). O Evernote não detalha modelos; cita "trusted AI providers" e diz que o conteúdo não é usado para treinar modelos.
   - **BYOK ou local:** não há. O caminho inverso existe: via MCP, a IA externa do usuário acessa as notas.
   - **Preço do add-on:** não é vendida à parte. O help center diz que Starter e Advanced incluem as "AI tools". O PricingSaaS registra que AI Assistant e Semantic Search foram liberados "em todos os planos" em abr/2026. As cotas por plano não são divulgadas [não verificado na página oficial].
7. **Plataformas, offline, sync, E2EE, formato/export:** Windows (app desktop, inclusive pela Microsoft Store), macOS, iOS, Android e Web. "Offline notes" consta como recurso core, mas o app **não é local-first**: exige conta e nuvem, e o sync é limitado por plano (1, 3 ou ilimitados dispositivos). **Sem E2EE**: só "in-note encryption" (texto selecionado protegido por senha) e 2FA. Export em ENEX (XML proprietário), HTML e PDF [ENEX e HTML: conhecimento prévio, não reverificado nesta sessão; PDF consta na página de planos].
8. **Preço (fonte, data):** a página oficial (evernote.com/compare-plans, acessada em 2026-10-17) lista os planos **Free, Starter, Advanced, Flexible e Unlimited** com limites, mas **não renderiza os valores** (carregados dinamicamente). Os valores abaixo vêm de fontes secundárias convergentes [não verificado na página oficial]:
   - **Free:** US$ 0. Limites: 50 notas, 1 caderno, 1 dispositivo, 1 GB, 20 tags e 200 anexos (limites confirmados na página oficial).
   - **Starter:** US$ 99/ano (≈ US$ 8,25/mês) ou US$ 14,99/mês. Limites: 1.000 notas, 20 cadernos, 3 dispositivos e 5 GB.
   - **Advanced:** US$ 249,99/ano (≈ US$ 20,83/mês) ou US$ 24,99/mês. Tudo ilimitado, sujeito a "safeguard limits".
   - **Flexible:** "a partir de US$ 10/mês", voltado a equipes (PricingSaaS, captura de 06/07/2026). **Unlimited/Enterprise:** sob consulta.
   - **Estudantes universitários:** 40% de desconto no 1º ano do Advanced (página oficial).
   - Fontes: e-mail da Bending Spoons citado no TidBITS Talk (11/07/2026), UseCarly (15/07/2026), Dr. Frank Buck (11/11/2025), Zapier (atualizado em dez/2025) e PricingSaaS.
9. **Mudanças e notícias 2025–2026:**
   - **set–nov/2025:** os planos Personal (~US$ 130/ano) e Professional (~US$ 170/ano) foram substituídos por Starter e Advanced, com migração gradual. Os limites do Starter (1.000 notas, 20 cadernos) empurram acervos antigos para o Advanced. Há relato de migração para Advanced a € 18,99/mês em set/2025.
   - **08/10/2025:** v11 anunciada. **19/01/2026:** disponibilidade geral da v11, com AI Assistant (feito com a OpenAI), Semantic Search e AI Meeting Notes.
   - **abr/2026:** Free sobe para 1 GB e Starter para 5 GB; IA em todos os planos (PricingSaaS).
   - **21/07/2026:** blog oficial resume "115+ melhorias" do 1º semestre (tabs, AI Prompts, AI Memory, transcrição ao vivo, ditado, AI Assistant no mobile).
   - **jul–out/2026:** Ask/Edit modes, MCP oficial (ago), IA criando eventos (set), PDF editor (set), tabelas com sort/filter (out). Versão mais recente: 11.38.5 (out/2026). O ritmo é de releases semanais.
   - **01/07/2026:** IPO da Bending Spoons, que levantou US$ 1,68 bi a US$ 29/ação e anunciou planos de muitas novas aquisições (TechTimes, Forbes).
   - **jun–ago/2026:** relatos de reajustes extremos em contas Teams/Enterprise. Exemplo: migração forçada para "Enterprise Unlimited" a € 17.900/ano para uma empresa que pagava ~€ 140/ano (Borns IT-Blog, 13/06/2026).
10. **Forças, fraquezas e reclamações:**
    - **Forças:** captura e busca maduras ("search inside images and scans is still best in class", web clipper e scanner "remain excellent", segundo Flozic em set/2026); investimento real em produto sob a Bending Spoons, com releases semanais; IA integrada a tarefas, agenda e áudio; MCP oficial.
    - **Preço** (reclamação nº 1): "it makes no sense for me to pay $250 annually" (TidBITS Talk, 11/07/2026; o autor migraria ~12 mil notas para DEVONthink ou Apple Notes). Outro usuário do mesmo fórum só usava transcrição e foi para o UpNote. Um usuário citado do r/Evernote diz se sentir "espremido como um limão" (Borns IT-Blog, 2026).
    - **Plano Free:** a Zapier o chama de "utterly useless" (dez/2025).
    - **Cobrança e lock-in:** cobranças inesperadas por upgrade não solicitado (comentários no Borns IT-Blog, jul/2026); "They definitely don't make cutting ties easy" (Trustpilot, 11/10/2026).
    - **Estabilidade:** o app desktop "constantly crashes or hits a blank screen" e as "continual forced updates" incomodam (Trustpilot, 15/10/2026).
    - **IA empurrada:** "keeps adding AI features I don't want or need" (Trustpilot, 10/10/2026).
    - Nota no Trustpilot: 3,6 com 3.727 avaliações (3.204 nos últimos 12 meses), acessado em 2026-10-17.
11. **Relevância para o Monet:**
    - **Inspira:** o Edit mode com mudanças destacadas e aceitar/rejeitar, e o AI Edit que entrega o resultado num diálogo sem tocar na nota, validam o desenho "IA nunca escreve direto; o usuário escolhe Anotar/Inserir". Os AI Prompts salvos e acionados por "/" validam a tese dos /comandos dentro do texto.
    - **Evitar:** limites artificiais (nº de notas, cadernos, dispositivos), migração forçada de planos e IA "empurrada". O Monet grátis, local-first e sem conta pode se posicionar explicitamente como antídoto ("suas notas não são reféns").
    - **Lacuna:** o Evernote mira reuniões e trabalho. Não tem leitor EPUB, grifos que viram citações, SRS nem BYOK; o autodidata de longo prazo não é o público dele.

### 3. Microsoft OneNote

1. **Posicionamento e público-alvo:** caderno digital gratuito da Microsoft, um "fichário" de formato livre com tinta (caneta), áudio e anexos. Público amplo: estudantes (Class Notebook, escolas no Microsoft 365 Education), profissionais no ecossistema Microsoft 365 e usuários de tablet com caneta (Surface/iPad). Tem mais de 500 milhões de downloads no Google Play (dez/2025, segundo a Wikipedia). É o concorrente "default" de qualquer app de notas no Windows.
2. **Modelo de organização:** Notebooks > Section groups > Sections > Pages > Subpages. Cada página é um canvas livre. Há Note Tags (To Do, Important, Question e personalizadas) com resumo de tags, e links internos para notebook, seção, página ou parágrafo [conhecimento prévio; não reverificado]. Sem backlinks automáticos, sem databases/propriedades, sem grafo.
3. **Editor:** WYSIWYG de canvas livre (contêineres posicionáveis em qualquer lugar da página) com tinta de primeira linha: canetas, marca-texto, ink-to-text e novas canetas Fountain Pen e Brush Pen no Windows (Insider Blog, 2026). Tem Math Assistant e suporte a LaTeX/MathML (2026), tabelas simples, page templates no desktop e controle do idioma de revisão (2026). **Não tem Markdown nativo**. Slash commands [não verificado].
4. **Estudo/leitura:** PDF inserido como "printout" (imagem das páginas) e anotado com tinta; anexos de arquivos. O **OneNote Web Clipper** segue ativo: extensão do Chrome com 1 milhão de usuários, 4,8★ (68,5 mil avaliações), versão 3.11.3 de 23/09/2026; captura página inteira ou parte, PDF, imagem, vídeo do YouTube/Vimeo e bookmark visual. Gravação de áudio e vídeo dentro da página (desktop); o help center mostra o Copilot usando transcrição e anotações manuscritas como fonte [detalhes do recurso de transcrição não verificados]. Immersive Reader e Class Notebook para educação. **Não tem** flashcards/SRS nem leitor EPUB. O recurso "Email to OneNote" foi descontinuado em mar/2025.
5. **Tempo/organização pessoal:** sem daily notes e sem calendário. Tarefas viram Note Tags "To Do" ou tarefas do Outlook; lembretes também dependem do Outlook [conhecimento prévio]. A Microsoft lançou um novo app Sticky Notes no Windows, ligado ao OneNote (Insider Blog) [data não confirmada].
6. **IA (2025–2026):**
   - **O que faz:** o *Copilot in OneNote* resume a página, cria lista de tarefas e planos de projeto, reescreve a página ou um trecho ("Rewrite page"/"Rewrite this", com prompts de estilo), responde perguntas e gera conteúdo. Cita as fontes e aceita transcrição e tinta como insumo.
   - **Onde vive:** painel Copilot à direita (Home > Copilot) e menu de contexto (botão direito > Copilot).
   - **Proativa vs. convocada:** convocada.
   - **Chat com as notas (RAG):** sim, no painel, mas a documentação oficial descreve o escopo da **página atual**; perguntas sobre várias seções ou notebooks não aparecem documentadas no help center [não verificado]. O *Copilot Notebooks* (2025), no app Microsoft 365 Copilot para contas de trabalho, agrupa arquivos e páginas como referência de chat [não verificado nesta sessão: as páginas oficiais deram 404 ou timeout].
   - **Escreve direto no documento?** Não sobrescreve. Resumos e listas ficam no painel e o usuário usa **Copy**; no Rewrite, o usuário posiciona o cursor e clica **Add to doc** para inserir.
   - **Modelos:** a Microsoft não divulga modelos por app [não verificado].
   - **BYOK ou local:** não.
   - **Preço do add-on:** quem usa o OneNote grátis não tem Copilot. Para consumidores, ele vem nos planos Microsoft 365 Personal, Family e Premium (preços no item 8) com limites de uso ("higher usage than free" no Personal/Family, "extensive usage" no Premium); no Family e no Premium, a IA é só do titular. A página atual não informa números de créditos [em jan/2025 a imprensa citou 60 créditos/mês; não verificado nesta sessão]. Para empresas, há o Microsoft 365 Copilot por usuário. A XDA (08/08/2026) cita um "Business Copilot add-on" de US$ 21/usuário e afirma que o Copilot no OneNote exige o Premium; isso conflita com a página oficial, que lista "OneNote with Copilot" também no Personal e no Family.
7. **Plataformas, offline, sync, E2EE, formato/export:**
   - **Plataformas:** Windows (app desktop "OneNote", ex-OneNote 2016; o OneNote for Windows 10 chegou ao fim do suporte em 14/10/2025), macOS, iOS/iPadOS, Android e web, mais visionOS/watchOS.
   - **Offline:** o app mantém uma cópia local para edição offline e faz merge ao reconectar. Notebooks locais (fora da nuvem) só existem no app desktop do Windows.
   - **Sync:** OneDrive ou SharePoint; **não é local-first**.
   - **E2EE:** não há. Seções protegidas por senha no desktop Windows ficam fora da busca e não têm recuperação ("Not even Microsoft Technical Support could unlock your notes").
   - **Formato/export:** formato proprietário `.one` (um arquivo por seção) e pacote `.onepkg` (CAB); a Microsoft publica a especificação MS-ONE. Exporta página ou seção em PDF/Word [conhecimento prévio]; **sem export Markdown**.
8. **Preço (fonte, data):** o **OneNote é grátis** em todas as plataformas, com 5 GB grátis no OneDrive; o Microsoft 365 Basic custa US$ 1,99/mês por 100 GB, sem Copilot (Zapier, dez/2025). Página oficial de comparação (microsoft.com, acessada em 2026-10-17):

   | Plano | Mensal | Anual | Notas |
   |---|---|---|---|
   | Microsoft 365 Personal | US$ 9,99 | US$ 99,99 | 1 pessoa, 1 TB |
   | Microsoft 365 Family | US$ 12,99 | US$ 129,99 | até 6 pessoas; IA só do titular |
   | Microsoft 365 Premium | US$ 19,99 | US$ 199,99 | Family + Copilot com "extensive usage", agentes Researcher/Analyst |
   | Office Home 2024 | — | US$ 179,99 (compra única) | OneNote clássico, sem Copilot avançado |
9. **Mudanças e notícias 2025–2026:**
   - **16/01/2025:** o Copilot passa a vir no Personal e no Family, com alta de US$ 3/mês nos EUA (o primeiro aumento desde o lançamento). Planos "Classic" sem IA ficam disponíveis por tempo limitado para assinantes existentes.
   - **mar/2025:** fim do "Email to OneNote". **abr/2025:** o OneNote for Windows 10 passa a exibir aviso de descontinuação. **14/10/2025:** fim do suporte desse app.
   - **01/10/2025:** lançamento do Microsoft 365 Premium (US$ 19,99/mês). A venda do Copilot Pro é encerrada, e o anúncio promete "higher Voice usage limits in OneNote".
   - **2026:** melhorias incrementais no Insider Blog: canetas novas, idioma de revisão, LaTeX/MathML, escolha de como abrir links de arquivos do Microsoft 365, teclado touch automático [as datas no índice do blog parecem ser de última atualização, não de publicação].
   - **Contexto 2026:** a Microsoft concentra a IA no app Copilot: novo design do Microsoft 365 Copilot (28/05/2026), "Microsoft Scout", um agente pessoal "always-on" (02/06/2026), e "new Copilot with Home, Code and Autopilot" (25/09/2026). Na leitura deste fork, o OneNote recebe poucas novidades de IA próprias.
10. **Forças, fraquezas e reclamações:**
    - **Forças:** grátis e completo, tinta excelente, canvas livre e onipresente em escolas e no Windows. Tem 4,7★ com 1,1 milhão de avaliações na App Store (iPhone) e Web Clipper com 4,8★. A Zapier destaca "a great free plan on every platform" (dez/2025).
    - **Organização:** o canvas livre "delivers mild chaos instead" e vira "an organizational nightmare for your future self" (XDA, 25/10/2025).
    - **Busca:** "can't handle conceptual connections" (mesmo artigo).
    - **Lock-in:** "the proprietary format locks you in"; converter para texto puro "often broke the structure" (XDA, 04/09/2025; o autor migrou para o QOwnNotes, local-first em Markdown).
    - **Sync e mobile:** sync "inconsistent across platforms", "forced OneDrive dependency" e mobile que "strips features and breaks formatting" (XDA, 25/10/2025). Na App Store, reviews antigas relatam modo "read-only" offline e imagens que não sincronizam.
    - Outros: nota 3,8★ na Microsoft Store (323 avaliações, via Wikipedia); "can feel a bit corporate" (Zapier); confusão entre versões (app do Windows 10 vs. desktop).
11. **Relevância para o Monet:**
    - **Inspira:** o modelo mental notebooks > seções > páginas é quase o mesmo de cadernos > matérias > notas do Monet, o que dá onboarding familiar a quem vem do OneNote. Um importador de OneNote (via export .docx/PDF ou Graph API) pode ser alavanca de aquisição no Windows [ideia, não pesquisada]. O Copilot só convocado, num painel à direita, com "Copy"/"Add to doc", segue a mesma ética do "Anotar/Inserir".
    - **Evitar:** canvas livre sem estrutura, formato proprietário e dependência obrigatória de nuvem.
    - **Lacuna:** a IA do OneNote é paga (a partir de US$ 9,99/mês), limitada à página e sem BYOK nem RAG por coleção definida pelo usuário. O Monet oferece BYOK, RAG por pasta, Library com grifos e export aberto.

### 4. Apple Notes

1. **Posicionamento e público-alvo:** app nativo e gratuito do ecossistema Apple (iPhone, iPad, Mac, Apple Watch, Vision Pro). É o app padrão de captura rápida para a base enorme de usuários Apple: listas, rascunhos, escrita à mão, gravações. Não é vendido separadamente: é recurso do sistema operacional.

2. **Modelo de organização:** pastas e subpastas (por conta: iCloud, "No meu iPhone", contas de e-mail); tags com `#`; Smart Folders (filtros por tags, datas, anexos, checklists etc.); links entre notas (digitar `>>`, desde o iOS 17); notas fixadas; pastas e notas compartilhadas com colaboração. No iOS 27 entraram os *section links* (links para um título dentro de uma nota). Não há painel de backlinks, grafo, banco de dados/propriedades nem canvas.

3. **Editor:** WYSIWYG em rich text (não é markdown nativo). Estilos fixos (Title, Heading, Subheading, Body, Monospaced), checklists, tabelas simples, seções colapsáveis e 5 cores de destaque (iOS 18), barra de ferramentas adaptativa que muda conforme o contexto (iOS 26), linha divisória (iOS 27). Markdown: importa e exporta arquivos `.md` pelo share sheet desde o iOS 26 (a sintaxe não é renderizada enquanto se digita). No iOS 27, colar Markdown vira formatação e há "Copy as Markdown". Escrita à mão e desenho com Apple Pencil, Smart Script (iPadOS 18) e desenho no Mac (macOS 27). Não tem slash commands nem templates de verdade.

4. **Estudo/leitura:** scanner de documentos, PDFs inline com marcação via Pencil, anexos de arquivo (iOS 18). Gravação de áudio com transcrição em tempo real e pesquisável dentro da nota (iOS 18; iPhone 12+; no lançamento só em inglês). Gravações de chamadas telefônicas são salvas no Notes com transcrição (desde o iOS 18.1). Math Notes resolve equações escritas e converte unidades. Não há web clipper próprio: a captura é pelo share sheet. No Mac/iPad, Quick Note mais Safari permite destacar trechos de páginas ligados à nota [mecanismo não reverificado nesta sessão]. Não tem flashcards nem SRS.

5. **Tempo/organização pessoal:** não há daily notes nem calendário. Checklists sim, mas datas e lembretes ficam no app Reminders, que é separado. Há um controle de nota rápida na Lock Screen (iOS 18).

6. **IA (2025–2026):**
   - **O que faz:** Writing Tools (Rewrite com ajuste de tom, Proofread com explicação das edições, Summarize em parágrafo, bullets, tabela ou lista); Compose via ChatGPT (extensão opcional); Image Wand e Image Playground (imagens a partir de esboços ou contexto; Image Playground dentro da nota no iOS 27); resumo de transcrições de gravações e chamadas (botão "Summary" na gravação). No iOS 27, a *Siri AI* cria notas com conteúdo gerado (inclusive informação buscada na web), atualiza notas existentes e sugere "Add to Notes" abaixo de conversas no Messages.
   - **Onde vive:** inline, sobre o texto selecionado (menu e painel de Writing Tools); botão Summary na gravação; Siri como agente conversacional (iOS 27).
   - **Proativa vs. convocada:** quase tudo é convocado: o usuário seleciona e pede. Há sugestões contextuais pontuais: o atalho "Add to Notes" da Siri AI no Messages e o Math Notes, que pode sugerir ou inserir resultados automaticamente (configurável).
   - **Chat com as notas (RAG):** não existe chat sobre as notas dentro do app. A Siri AI do iOS 27 "organiza informações com mais contexto"; não confirmei se ela responde perguntas sobre o acervo de notas [não verificado].
   - **Escreve direto no documento?** Sim, quando o usuário pede. Rewrite e Proofread substituem a seleção, com opção de reverter [comportamento de reversão não reverificado nesta sessão]. A Siri AI cria e edita notas por comando de voz ou texto.
   - **Modelos:** Apple Foundation Models (on-device e Private Cloud Compute); ChatGPT/OpenAI como extensão opcional. Para a Siri AI do iOS 27, a imprensa reporta parceria com o Google Gemini, mas as fontes divergem: um relato diz que o Gemini foi usado para treinar o modelo, outro que ele é a base em runtime [não verificado].
   - **BYOK ou local:** sem BYOK. Grande parte roda on-device. É possível logar uma conta ChatGPT na extensão.
   - **Preço do add-on:** não há cobrança à parte, mas exige hardware compatível (iPhone 15 Pro ou mais novo, Mac/iPad com chip M) e idioma suportado. A Apple avisa que o acesso ampliado a recursos de servidor "may cost a fee in the future" (página de ajuda do macOS).

7. **Plataformas, offline, sync, E2EE, formato/export:** iOS, iPadOS, macOS, visionOS e watchOS (o app de Watch chegou no watchOS 26). **No Windows não há app nativo**: o acesso é só pelo iCloud.com no navegador, e o iCloud for Windows não inclui Notes (relatos em fóruns e guias). Em Android, também só pela web. Funciona offline, com dados locais e sync via iCloud (ou contas locais "No meu iPhone", que não aparecem na web). **E2EE só com Advanced Data Protection** (opt-in). Na proteção padrão, Notes fica criptografado "in transit & on server" com chaves da Apple. Com ADP ligado, o acesso via iCloud.com fica desativado por padrão, e metadados como datas de criação e modificação continuam sob a proteção padrão. Notas bloqueadas por senha têm criptografia própria. Formato proprietário. Export em PDF e Markdown (iOS 26), uma nota por vez, segundo relato na comunidade do Bear: não há export em lote nativo.

8. **Preço (fonte, data):** o app é gratuito. O custo indireto é o armazenamento iCloud+ nos EUA, só com cobrança mensal: 50 GB a US$ 0,99; 200 GB a US$ 2,99; 2 TB a US$ 9,99; 6 TB a US$ 29,99; 12 TB a US$ 59,99. A página informa "Published Date: September 16, 2026". Fonte: https://support.apple.com/en-us/108047, acessado em 2026-10-17. A Apple Intelligence não tem cobrança separada.

9. **Mudanças e notícias 2025–2026:**
   - **jun/2025 (WWDC) → 15/set/2025 (iOS 26):** redesign Liquid Glass, toolbar adaptativa, import/export de Markdown, app no Apple Watch, caneta "reed pen" para caligrafia (9to5Mac, 16/out/2025).
   - **jan/2026:** Apple e Google firmam acordo de modelos Gemini para a nova Siri [detalhes do uso divergem; não verificado].
   - **jun/2026 (WWDC, iOS 27 beta):** Siri AI cria e edita notas com conteúdo gerado (iPhone 15 Pro+); colar Markdown e "Copy as Markdown"; "Insert Divider Line"; section links; desenho no Notes do macOS (MacRumors, 17/jun/2026; lista oficial do keynote via 9to5Mac, 12/jun/2026).
   - **14/set/2026:** lançamento do iOS 27 segundo a imprensa. A Siri AI começa em inglês e a disponibilidade na UE no lançamento é contestada [não verificado]. O iGeeksBlog (atualizado em 15/set/2026) confirma divider, Siri AI, Image Playground e Markdown no iOS 27, com Siri AI e Image Playground exigindo Apple Intelligence em inglês e iPhone 15 Pro+.

10. **Forças, fraquezas e reclamações:**
    - **Forças:** velocidade de captura e integração com o sistema (Siri, Lock Screen, share sheet, Quick Note); gratuito; escrita à mão e PDF com Pencil; transcrição de áudio; E2EE opcional; evolução contínua a cada versão do iOS. Uma resenha comparativa diz que, ao lado dele, "everything feels slightly laggy... compared to Apple Notes' instant response", sobre o Notion (toolradar/dupple, 2026).
    - **Fraquezas:** preso ao ecossistema Apple. Um review diz que ele é "limited to Apple devices, which is bad if I ever need to use Windows or Android" (TechJockey). Faltam backlinks, databases, templates e API/automação (roundups de alternativas, 2026). O export em Markdown é nota a nota (Bear Community, 2025).
    - **Reclamações recorrentes:** sync do iCloud que trava (fórum ifun.de, com a "solução" de desligar o Notes e baixar tudo de novo); "Apple Notes is still unreliable" (TidBITS Talk, sem data). Pós-iOS 26, há relatos de lentidão e travamentos em notas grandes com Pencil no iPad (Apple Community, thread 256198439) e de teclado cobrindo o texto digitado (Apple Discussions, thread 256146665).

11. **Relevância para o Monet:**
    - **Inspira:** o modelo de IA de Writing Tools, convocada sobre a seleção e com reversão, valida a tese do Monet de "IA como meio". A transcrição de áudio pesquisável dentro da nota mostra uma demanda real para quem acompanha cursos e aulas.
    - **Evitar:** lock-in e export fraco (Markdown só nota a nota). O Monet deve oferecer export em lote, legível e aberto.
    - **Lacuna:** quem estuda no Windows (ou alterna PC e iPhone) não tem Apple Notes nativo. Também faltam leitor PDF/EPUB com grifos que viram citações, notas vinculadas e chat contextual por pasta.

### 5. Google Keep

1. **Posicionamento e público-alvo:** notas rápidas em estilo post-it (cartões coloridos), listas e lembretes. É gratuito e vem pré-instalado em boa parte dos Android, voltado ao usuário Android/Google e ao Workspace. O uso é de captura e listas, não de base de conhecimento.

2. **Modelo de organização:** grade de cartões com cores, labels (marcadores), pin, arquivo e colaboradores. Ordenação de notas na home desde ago/2025 (Android) e busca. **Não tem pastas/hierarquia, links entre notas, backlinks nem propriedades.**

3. **Editor:** texto com formatação básica (títulos, negrito, itálico, sublinhado; chegou à web em 9/mai/2025), checklists, desenho/escrita à mão, imagens e notas de voz. "Create text notes by default" no Android (abr/2025). "Find in note", a busca dentro da nota, saiu no Android v5.26.331 (ago/2026). Não tem tabelas, markdown, slash commands nem templates.

4. **Estudo/leitura:** extensão do Chrome que salva página ou seleção no Keep (um clipper básico); extração de texto de imagem ("Grab image text") [não reverificado nesta sessão]; gravação de voz com transcrição; painel do Keep dentro do Google Docs para arrastar notas [não reverificado]. Não anota PDF, não tem highlights nem flashcards.

5. **Tempo/organização pessoal:** lembretes por horário e local. **Em 28/nov/2025 o Google começou a migrar os lembretes do Keep para o Google Tasks**, ainda em andamento em jan/2026 (recap do 9to5Google). Não há daily notes nem calendário próprio.

6. **IA (2025–2026):**
   - **O que faz:** (a) "Create a list with Gemini" ("Help me create a list"): a partir de um prompt, o Gemini gera uma lista que o usuário insere na nota, com opção de editar o prompt e regenerar; (b) sugestão de título para nota sem título; (c) extensão/app conectado do Keep no app Gemini, que cria notas e listas a partir do chat (desde 2024); (d) **Keep Live / "Generate notes with your voice"** (set/2026): um "brain dump" falado vira várias notas ou listas, aceita comandos de edição ("Add ingredients for pesto to my grocery list"), atualiza notas existentes e mostra prévia inline.
   - **Onde vive:** inline na nota (prompt da lista), modo de voz no próprio Keep e app Gemini (assistente com ações no Keep).
   - **Proativa vs. convocada:** convocada (prompt ou voz). A sugestão de título é uma sugestão contextual leve.
   - **Chat com as notas (RAG):** não há chat sobre o acervo dentro do Keep na documentação oficial. Blogs de terceiros falam em "busca por significado" e respostas sintetizando várias notas (itechify, 01/set/2026), mas a ajuda oficial não confirma [não verificado].
   - **Escreve direto no documento?** Sim. A lista gerada é inserida na nota após o usuário aceitar. O Keep Live cria e edita notas a partir da fala (há etapa de revisão antes de "Done", segundo a ajuda, mas o objetivo é aplicar as mudanças nas notas).
   - **Modelos:** Gemini. Os recursos "Live" usam "Gemini Audio models" (ARY News, 05/set/2026).
   - **BYOK ou local:** não.
   - **Preço do add-on:** segundo a ajuda oficial, os recursos de Gemini no Keep são para Google AI Pro e Google AI Ultra (ou aparelho Pixel). O Keep Live também chega ao Google AI Plus segundo o 9to5Google (03/set/2026), enquanto a página de ajuda menciona só Pro e Ultra. Tudo é **só Android**, e clientes Workspace recebem "coming soon".

7. **Plataformas, offline, sync, E2EE, formato/export:** Android, iOS, web (keep.google.com) e Wear OS. O app de Apple Watch foi removido em 30/jun/2025. **No Windows, só pela web/extensão do Chrome**: não há app desktop, e o caminho via Windows Subsystem for Android deixou de existir com o fim do WSA na Microsoft Store em 5/mar/2025. Os apps móveis funcionam offline e sincronizam pela conta Google; o offline na web é limitado [não verificado]. **Sem E2EE** [não verificado em documento oficial nesta sessão; não há opção de E2EE para consumidores]. O export é via Google Takeout: texto, listas, anexos (áudio, desenho, imagem), cor, estado (pin/arquivo), colaboradores e labels. O formato não é citado na ajuda; tipicamente HTML + JSON [não verificado]. Também dá para copiar uma nota para o Google Docs.

8. **Preço (fonte, data):** o Keep é gratuito, com 15 GB compartilhados na conta Google. A IA depende de assinatura. As páginas oficiais (one.google.com/about/plans e gemini.google/subscriptions) foram servidas em BRL por geolocalização: Google AI Plus R$ 24,99/mês; Google AI Pro R$ 96,99/mês (5 TB); Google AI Ultra a partir de R$ 779,90/mês; Basic 100 GB R$ 9,99/mês; desconto anual "up to 16%". Acessado em 2026-10-17. **USD:** Google AI Ultra US$ 249,99/mês, confirmado no blog oficial do Google ("available today in the U.S. for $249.99/month", 20/mai/2025). Google AI Pro em torno de US$ 19,99/mês [não verificado na página oficial; valor amplamente reportado desde 2025]. Google AI Plus em USD não confirmado [não verificado]. Atualização [sec.]: segundo o 9to5Google (08/06/2026), o Google AI Plus caiu para US$ 4,99/mês, surgiu um Ultra de US$ 99,99 e o Ultra topo passou a US$ 199,99 (ver seção Gemini Notebook). O valor de US$ 249,99 é o do lançamento, em mai/2025.

9. **Mudanças e notícias 2025–2026:**
   - **05/mar/2025:** fim do Windows Subsystem for Android, sem caminho oficial para rodar o app Android do Keep no Windows (Microsoft Learn).
   - **abr–ago/2025:** texto como padrão (Android), widget Quick capture redesenhado (10/abr), formatação na web (09/mai), remoção do app de Apple Watch (30/jun), ordenação de notas (13/ago), redesign Material 3 Expressive (21/ago); Wear OS M3E (03/out).
   - **28/nov/2025:** início da migração de lembretes para o Google Tasks.
   - **mai/2026 (I/O 2026):** anúncio do Keep Live. **03/set/2026:** rollout no Android para AI Plus, Pro e Ultra (9to5Google); Workspace depois.
   - **ago/2026:** "Find in note" no Android (Android Headlines, citando o 9to5Google).

10. **Forças, fraquezas e reclamações:**
    - **Forças:** grátis, rápido para listas e lembretes, integração com Android, Gmail, Docs e Gemini, colaboração simples. Nota 4,6/5 com cerca de 29 mil avaliações na App Store dos EUA (acessado em 2026-10-17).
    - **Fraquezas:** sem estrutura (pastas, links, tabelas), sem E2EE, sem app desktop, IA atrelada a assinatura e ao Android, ritmo de evolução lento. O próprio 9to5Google celebra que 2025 teve "a lot of updates... compared with the year before".
    - **Reclamações:** reviews da App Store relatam sumiço de notas ("one of my most important notes went missing... it came back blank", 27/06/2022), crash ao adicionar item em lista (2018) e filtro de label que se perde (2021). Os reviews visíveis são antigos. A remoção do app de Watch e a migração dos lembretes para o Tasks mexeram em fluxos estabelecidos [reação de usuários não quantificada; Reddit inacessível]. Há também crítica de imprensa e fórum à IA de voz empurrada nos apps: TechSpot, "Google is adding voice AI to Gmail, Docs, and Keep, whether users like it or not" (set/2026; conteúdo não acessado, 403).

11. **Relevância para o Monet:**
    - **Inspira:** o Keep Live mostra demanda por "despejar por voz e transformar em estrutura". O Monet pode oferecer isso como `/comando` convocado, com resultado em prévia e inserção por "Inserir", o oposto da aplicação automática.
    - **Evitar:** IA que altera notas existentes a partir de um comando ambíguo de voz, IA presa a assinatura de plataforma e retirada de recursos estabelecidos sem alternativa (Watch, lembretes).
    - **Lacuna:** o Keep não serve para estudo profundo: não tem hierarquia, PDF, citações nem links. Quem começa no Keep e precisa organizar um tema de longo prazo no PC Windows não tem um "próximo degrau" no ecossistema Google além do Docs.

### 6. Bear

1. **Posicionamento e público-alvo:** app de notas em Markdown "powerfully simple", da Shiny Frog (Itália), focado em escrita bonita e rápida. É exclusivo do ecossistema Apple (Mac, iPhone, iPad). Atende escritores, devs e usuários Apple que querem Markdown sem fricção e boa estética.

2. **Modelo de organização:** baseado em **tags**, inclusive aninhadas como `#2026/06`, sem pastas por decisão de design. TagCons (ícones de tag, redesenhados no 2.7), pin dentro de tags (2.4). **"Tag as Workspace"** (2.9, jul/2026) transforma qualquer tag num ambiente de trabalho que mostra só aquelas notas e tags relacionadas. Wiki-links entre notas e backlinks no app nativo (o Bear Web ainda não tem backlinks); o mecanismo de backlinks não foi reverificado nesta sessão. Não há databases, grafo nem canvas.

3. **Editor:** Markdown com renderização inline (motor "Panda", que virou o produto Lettera). Tabelas (colar do Excel ou Numbers mantém o layout), to-dos com ordenação automática (2.4), callouts e fórmulas MathJax (2025), diagramas **Mermaid** (2.9.2, jul/2026), sketches, folding, TOC, Read-Only Mode (2025) e Typewriter Mode (3.0.3 beta, 16/out/2026). Slash commands e templates nativos [não verificado].

4. **Estudo/leitura:** PDF inline (preview completo ou bloco compacto), scanner de documentos, **OCR** em PDFs e imagens (Pro). **Web Clipper 2.0** (29/set/2025): Safari embutido mais extensões de Chrome e Firefox, página inteira ou trecho, processamento local ("Nothing leaves your device"). Não anota nem grifa PDF e não tem flashcards. Áudio e transcrição não aparecem nos materiais oficiais lidos.

5. **Tempo/organização pessoal:** sem daily notes, calendário ou lembretes nativos [lembretes não verificados]. O próprio blog sugere tags de data aninhadas (`#2026/06`) para organizar por período. To-dos com ordenação automática. Integração com Shortcuts e, desde o 2.10 (set/2026, Mac), com a Siri AI.

6. **IA (2025–2026):**
   - **O que faz:** **não há IA embutida.** A estratégia é expor as notas às IAs que o usuário já usa: (a) **BearCLI** (2.8, 29/abr/2026), CLI empacotada no app para buscar, ler, criar, editar, anexar, taggear, arquivar e mandar para a lixeira; (b) **Claude Connector** (Help → Advanced → Install Claude Connector, exige o Claude Desktop), para perguntar e editar notas em linguagem natural; (c) **MCP server** (`bearcli mcp-server`) para Claude Code, Cursor e outros. No 2.9 (16/jul/2026) entrou o escopo por tags: "Only tags" e "Exclude tags", por exemplo excluir `private`. No 2.10 para Mac (14/set/2026): suporte à Siri AI (criar e anexar notas, Spotlight avançado, *on-screen awareness*).
   - **Onde vive:** fora do app (Claude Desktop, IDEs, terminal) e na Siri.
   - **Proativa vs. convocada:** convocada e opt-in. "Nothing connects to your notes unless you set it up, and no notes are shared with any tool until you choose to."
   - **Chat com as notas (RAG):** sim, via Claude ou cliente MCP, com acesso por busca: "The assistant only sees the notes a specific query returns."
   - **Escreve direto no documento?** Sim, via CLI e Connector. O Claude pede confirmação antes de alterar; a FAQ recomenda checar o padrão de cada cliente MCP. "Encrypted notes stay encrypted. They can be listed, but never read or modified."
   - **Modelos:** os do cliente externo (Claude etc.) e da Siri AI (Apple).
   - **BYOK ou local:** na prática "bring your own AI". "Everything runs locally. `bearcli` reads and writes your local Bear database on your Mac." O LLM roda onde o cliente escolhido roda.
   - **Preço do add-on:** nenhum. A FAQ não exige Pro, só Bear 2.8 ou superior. É **macOS-only**.

7. **Plataformas, offline, sync, E2EE, formato/export:** macOS, iOS e iPadOS. **Bear Web** está em public beta desde 09/jul/2025: roda no navegador com login Apple ID e é "primarily for situations where you cannot access the native Bear apps". Ainda faltam criptografia, backlinks, TOC, temas, import/export e sketcher, e o Pro será exigido após o beta. **Windows/Android: sem app nativo**, só o Bear Web. A equipe escreveu "We can't wait to see you access Bear on more devices, including Windows and Android!" e disse que um wrapper Electron "Not something we are considering now". Funciona offline com banco local e sync via **iCloud/CloudKit** (Pro). **E2EE** via Advanced Data Protection do iCloud ("only you... can decrypt your data"), mas títulos de notas e nomes de tags não são criptografados. Há também a criptografia de notas individuais (Pro), com novo sistema em 2025 que cobre anexos. No Bear Web, os dados não ficam salvos localmente. Export em lote: grátis em TXT, MD, TextBundle, .bearnote e RTF; com Pro também HTML, DOCX, PDF, JPG e ePub.

8. **Preço (fonte, data):** **Bear Pro US$ 2,99/mês ou US$ 29,99/ano**. O site cita "based on U.S. dollars", com trial de 7 dias; a App Store mostra trial de 14 dias. Fontes: https://bear.app/faq/features-and-price-of-bear-pro/ e https://bear.app/#price, acessados em 2026-10-17; preços iguais na App Store dos EUA. Descontos: educacional de 30% no primeiro ano (nov/2025) e "back to school" de 30% (31/ago a 10/set/2026). O Pro inclui sync, criptografia, export avançado, temas e OCR.

9. **Mudanças e notícias 2025–2026:**
   - **09/jul/2025:** Bear Web Public Beta. **Set/2025:** visual Liquid Glass para os OS 26 e Web Clipper 2.0 (2.6.3).
   - **2025 (ao longo do ano):** Read-Only Mode, nova criptografia com anexos, callouts, fórmulas matemáticas, colagem de tabelas. Foram "20 updates" no ano, segundo o post de 9 anos (02/nov/2025).
   - **19/mar/2026:** 2.7 (TagCons). **29/abr/2026:** 2.8 (BearCLI, Claude Connector, MCP). **18/jun/2026:** Lettera, editor Markdown para Mac em beta (ex-Panda). **16/jul/2026:** 2.9 (Workspace + escopo MCP). **28/jul/2026:** Mermaid.
   - **14/set/2026:** 2.10 no Mac (Siri AI). **22/set/2026:** **Bear 3.0**, só correções de bugs; a versão saltou de 2.10 para 3.0 porque um bug do macOS 27 quebra a UI para versões acima de .9 (notas da Mac App Store). **Out/2026:** 3.0.2 (iOS e Mac) e 3.0.3 beta com Typewriter Mode.

10. **Forças, fraquezas e reclamações:**
    - **Forças:** design e velocidade; Markdown aberto e export amplo; postura de privacidade (clipper local, sem acesso da equipe aos dados, MCP com escopo). Nota 4,7/5 com cerca de 6,9 mil avaliações (App Store EUA, iOS). Reviews de usuários: "This app is a powerhouse" e "the subscription is a no-brainer" (2024).
    - **Fraquezas:** só Apple (Bear Web ainda beta e sem paridade); sync preso ao iCloud; sem pastas. Num review de 15/07/2024: "the lack of folders is annoying. In fact it's a deal breaker". O dev respondeu que pastas não servem para todos. Recursos de estudo limitados (sem anotação de PDF).
    - **Reclamações recentes no fórum oficial (out/2026):** "Performance degradation and crashes on large notes with multiple sketches" (11/out); "Table Cells No Longer Word Wrap Within Fixed Table Width" (13/out); pedidos populares de YAML front matter (cerca de 2,1 mil views), suporte a TextBundle, melhor manejo de imagens e "Read and write attachments (PDFs, images) via bearcli / MCP server" (14/out).

11. **Relevância para o Monet:**
    - **Inspira:** o modelo do Bear (nenhuma IA nativa, notas acessíveis à IA do usuário via MCP/CLI local, escopo por tag, notas criptografadas inacessíveis, confirmação antes de escrever) é a versão "IA como meio" mais próxima da tese do Monet. Um MCP server do Monet com escopo por caderno ou matéria seria um diferencial barato.
    - **Inspira:** "Tag as Workspace" funciona como modo foco por tema, o que encaixa na persona que se aprofunda num assunto por meses (equivalente a "focar num caderno").
    - **Lacuna:** o Bear não existe no Windows (só web beta, sem offline). Usuários que valorizam a estética e o Markdown do Bear e usam PC são público natural para um app Windows local-first.

### 7. Craft

1. **Posicionamento e público-alvo:** "Your space for notes, tasks, and big ideas" — app de documentos/notas com foco em design e acabamento (prêmio "Mac App of the Year"; 4,8/5 com ~6,6 mil avaliações na App Store dos EUA). Público: indivíduos, criativos e pequenas equipes, historicamente centrado no ecossistema Apple, expandindo para Windows/Web/Android.
2. **Modelo de organização:** Spaces > pastas > documentos > blocos (páginas/cards aninhados); tags (inclusive inline, set/2026); links entre documentos [backlinks não verificados nesta pesquisa]; Collections (databases estruturadas com propriedades e relações, views de tabela, gallery (fev/2026) e Kanban (abr/2026)); whiteboards; Daily Notes; Calendar.
3. **Editor:** WYSIWYG em blocos com suporte a Markdown, slash menu (novo no iPhone em out/2026), templates, tabelas, editor de código e de fórmulas, estilos de página (backdrops, capas Unsplash, "washi tapes"); publicação de documentos na web e colaboração em tempo real.
4. **Estudo/leitura:** Web Clipper oficial (Safari macOS/iOS/iPadOS, Chrome, Firefox). PDF como anexo/preview; anotação/grifo de PDF [não verificado — não encontrado na documentação]. Sem flashcards/SRS. Áudio/transcrição [não verificado]. O Assistant responde perguntas sobre o conteúdo do Space.
5. **Tempo/organização pessoal:** forte e em evolução: Daily Notes (templates desde ago/2026; export por intervalo de datas em set/2026), Calendar que junta daily notes, tarefas e eventos de calendários conectados; Tasks com Inbox/Today/Upcoming/All Tasks, deadlines, lembretes (mai/2026), integração com Apple Reminders e multi-seleção (3.5.0, 07/07/2026); Quick Entry; widgets/Shortcuts (3.7, out/2026). Melhorias de tarefas para Web/Windows anunciadas como "coming in a few weeks" em jul/2026.
6. **IA (2025–2026):**
   - **O que faz:** Craft Assistant responde sobre documentos e faz consultas no nível do Space (ex.: "Find all documents about marketing campaigns"), entende Collections, escreve e edita. Integração MCP (v2 em 05/06/2026) para Claude, ChatGPT, Cursor, VS Code etc. lerem/escreverem no Craft; API. Lançou também o "Craft Agents" (03/02/2026), interface open-source (Apache 2.0) para trabalhar com agentes de IA, separada do app de docs.
   - **Onde vive:** painel do Assistant aberto a partir de um documento ou da visão do Space; disponível em Documents, Tasks, Calendar, Collections, Code Editor.
   - **Proativa vs. convocada:** convocada (nenhum recurso proativo encontrado).
   - **Chat com as notas (RAG):** sim, perguntas no nível do Space; o método de recuperação não é documentado.
   - **Escreve direto no documento?** Depende do modo: "Execute" aplica mudanças direto (desfazível com Ctrl/⌘+Z); "Explore" "proposes changes and waits for your approval before modifying anything". No Windows e na Web o Execute mode ainda está "coming later". Modelos Core e Local são somente leitura.
   - **Modelos:** níveis Core (leitura, uso baixo), Fast (perguntas no Space, edição) e Max (raciocínio/edição complexa); Local: Apple Foundation Model e Llama 3.2 ("Always free", read-only). Desde jan/2025 oferecia modelos on-device (DeepSeek R1 1.5B/7B, Llama 3.2 1B/3B) que "will work fully offline". Provedores dos modelos de nuvem não divulgados [não verificado].
   - **BYOK ou local:** sim, ambos. Desde 05/06/2026: OpenAI (Sign in with ChatGPT via OAuth ou chave de API), Anthropic (chave de API) e modelos locais; funciona "even without a subscription" e não consome a cota de IA da Craft. OpenRouter/Ollama não mencionados.
   - **Preço do add-on:** sem add-on; créditos incluídos nos planos (Free: 15 créditos; Plus: 50 créditos/mês, segundo a página de pricing), com top-ups de valor fixo. CEO (27/11/2025): "we are not changing prices, and not locking AI behind another pricing tier"; "you decide how (or whether) to use AI". A Craft afirma não treinar modelos com o conteúdo do usuário.
7. **Plataformas, offline, sync, E2EE, formato/export:** macOS, iOS/iPadOS, visionOS, Windows (Microsoft Store), Web e Android (Play/APK). Site diz "Offline-first with real-time sync"; nos apps Apple o uso offline é histórico [não verificado nesta pesquisa]; para Web, Windows e Android o "Offline Editing" só chegou em beta em 17/02/2026 e precisa ser ativado. Sync pela nuvem da Craft. E2EE: a home lista "end-to-end encryption", mas a página de segurança só fala de criptografia "at rest and in transit" — [não verificado]. Export: Markdown, TextBundle, PDF e CSV (collections), backup do Space inteiro; acesso por API/MCP.
8. **Preço (fontes e data):** A página oficial (https://www.craft.do/pricing, acessada em 2026-10-17) é geolocalizada e exibiu reais: Plus R$ 41,6/mês (mensal) ou R$ 33,3/mês (anual); Family R$ 77,5 ou R$ 62,0/mês; Team R$ 250/mês; Free com 1.500 blocos, 1 GB e 15 créditos de IA. Em USD, App Store EUA (https://apps.apple.com/us/app/craft-docs-and-notes-editor/id1487937127, acessada em 2026-10-17): Plus US$ 9,99/mês ou US$ 95,99/ano; Family US$ 17,99/mês ou US$ 179,99/ano; Team US$ 59,99/mês ou US$ 599/ano; Business US$ 299/mês; Legacy US$ 10,99/mês ou US$ 99,99/ano [preço USD na web não verificado na página oficial]. Education: Plus grátis para estudantes/educadores (help center). 11/10/2026: Plus passa de 5 para 10 Spaces "at the same price".
9. **Mudanças e notícias 2025–2026:** 31/01/2025 IA on-device no Assistant; 27/11/2025 manifesto "Your content is yours"; 03/02/2026 Craft Agents (open source); 17/02/2026 Offline mode (beta Web/Windows/Android) e Gallery View; 09/03/2026 Assistant mais inteligente; 13/04/2026 Kanban; 04/05/2026 lembretes e sidebar customizável; 19/05/2026 melhorias de Collections/Web/Windows; 05/06/2026 BYOK + MCP v2; 07/07/2026 grande update de Tasks, Windows mais estável e Summer Sale (40% "lifetime"); ago–set/2026 Daily Notes templates, inline tags, suporte ao OS 27; 10–11/10/2026 versão 3.7 (Shortcuts, widgets, CJK) e Plus com 10 Spaces.
10. **Forças, fraquezas e reclamações:**
    - Forças: design e fluidez (Mac App of the Year; 4,8 na App Store), IA flexível (BYOK, local, MCP, modo de aprovação), postura explícita de preço estável e "dados são seus", planejamento pessoal integrado (Daily Notes + Tasks + Calendar).
    - Fraquezas: Windows e Web como cidadãos de segunda classe — Execute mode ausente, Gallery View "coming soon to Web and Windows", offline só em beta fora da Apple, update de Windows de jul/2026 focado em estabilidade; E2EE ambíguo; plano Free limitado a 1.500 blocos.
    - Reclamações: as reviews visíveis na App Store são positivas; não foi possível coletar Reddit/Trustpilot nesta rodada (busca indisponível; páginas 404) [não verificado]. Recomenda-se checar r/CraftDocs numa próxima rodada.
11. **Relevância para o Monet:**
    - **Inspira (mais próximo filosoficamente):** "você decide como (ou se) usar IA", BYOK sem assinatura, modelos locais grátis e modo "Explore" que propõe e espera aprovação — muito alinhado à tese do Monet.
    - **Lacuna:** a Craft trata o Windows como plataforma secundária; o Monet pode ser o "Craft para Windows" com IA convocada. A Craft também não tem leitor de PDF/EPUB com grifos → a Library do Monet não tem equivalente aqui.
    - **Atenção:** Daily Notes + Tasks + Calendar integrados é o pacote que a Craft está priorizando em 2026 — referência direta para o Calendar/Tasks do Monet.

### 8. UpNote

1. **Posicionamento e público-alvo:** app de notas "clean and clutter-free" para indivíduos que querem algo simples, rápido e barato, muito citado como o substituto "mais parecido com o Evernote" para quem foge do Evernote (ex.: roundup da Fabric 2026 chama de "the most Evernote-like alternative"). Pequena empresa (UpNote Co., Ltd.), produto de nicho mas bem avaliado (App Store: 4,7/5, ~1,1 mil avaliações, acessado 2026-10-17).
2. **Modelo de organização:** notebooks aninhados + hashtags (tags planas, sem hierarquia), notas fixadas, Quick Access, filtros por palavra-chave e filtro "Untagged" (jul/2025), **Spaces/Workspaces** para separar contextos (lançado na 9.0.0, 2024), links internos entre notas e deep links para seções da sidebar. Não há backlinks, grafo, canvas ou databases/propriedades (nada disso aparece no site nem nas release notes 2025–2026).
3. **Editor:** rich text WYSIWYG com suporte a Markdown (atalhos), listas, to-dos, citações, highlight de texto, fontes, seções colapsáveis, Focus mode, sticky window, templates (arrastar template sobre um notebook cria nota, fev/2025), tabelas (recurso Premium) e code blocks com syntax highlighting ao vivo criados com ``` + linguagem (9.22.4, 2026). Slash commands: [não verificado]. Barra de formatação customizável (jul/2025).
4. **Estudo/leitura:** web clipper para Chrome, Safari e Firefox; **PDF preview** embutido na nota (desde 7.4.0, 2023), mas sem anotação/grifo de PDF; anexos limitados a 20 MB e imagens reduzidas no upload (FAQ). Sem flashcards/SRS, sem transcrição de áudio, sem OCR declarado.
5. **Tempo/organização pessoal:** apenas checklists/to-dos (com opção de mover concluídos para o fim, abr/2026). Sem lembretes, calendário ou daily notes nativos — um usuário que migrou do Evernote lista "Reminders" e "Calendar and events" como faltas (Substack de Scott Nelson, mai/2025).
6. **IA (2025–2026):**
   - O que faz: **não há IA nativa.** O site, a App Store e as release notes de jan/2025 a out/2026 não mencionam IA. O único item relacionado é a integração com o **Apple Writing Tools** do macOS no menu de contexto (9.11.11, jun/2025) — recurso do sistema, não do UpNote.
   - Onde vive / proativa vs. convocada / RAG / escreve no documento / modelos / BYOK / preço: não se aplica.
   - Recusa declarada? Não encontrei declaração pública de recusa; é ausência, não posicionamento [não verificado].
   - Ecossistema: existe um MCP server de terceiros (*upnote-lens-mcp*) que deixa um assistente de IA ler/buscar/resumir notas do UpNote (projeto não oficial).
7. **Plataformas, offline, sync, E2EE, formato/export:** Windows 10/11 (download direto ou Microsoft Store), macOS, Linux (.deb, .rpm, Snap, AppImage), iOS/iPadOS, Android; sem web app. Funciona offline e sincroniza ao voltar. Sync via **Firebase (Google), servidores nos EUA**; criptografia em trânsito (HTTPS) e em repouso, **sem E2EE** ("Not at this time" — FAQ). App lock e lock de notas/notebooks (Premium, Touch ID/Face ID). Export para Text, PDF, HTML e Markdown; backups locais automáticos (padrão passou a ser a cada hora em nov/2025); histórico de versões.
8. **Preço (fonte, data):**
   - Free: até **50 notas**, com sync.
   - Premium: **US$ 1,99/mês** ou **US$ 39,99 vitalício (lifetime)**; **não há plano anual**. Preço pode variar por região/impostos e há promoções (App Store lista também lifetimes de US$ 24,99/29,99/34,99).
   - Compra feita só pelos apps iOS, Android ou Mac — **não é possível assinar pelo Windows/Linux** (o Premium sincroniza para eles).
   - Fonte: https://getupnote.com/ e https://help.getupnote.com/resources/frequently-asked-questions, acessados em 2026-10-17; App Store (id1389634515), acessado em 2026-10-17.
9. **Mudanças e notícias 2025–2026:** ritmo constante de releases pequenas, sem grandes pivôs. Destaques: drag-and-drop de notas/templates na sidebar (jan–fev/2025); Writing Tools do macOS (jun/2025); quick switcher Ctrl+Alt+J e barra de formatação customizável (jul/2025); backup horário por padrão (nov/2025); idiomas holandês/tcheco (fev/2026); navegação entre workspaces e export sem pastas aninhadas (mar/2026); pacotes .deb (abr/2026) e .rpm (jul/2026); verificação de e-mail obrigatória para sync (ago/2026); code blocks com highlighting e page breaks para PDF (9.22.4, 2026); notas grandes mais rápidas (9.22.8, 13/out/2026). Nenhuma IA, web app, backlinks ou grafo no período.
10. **Forças, fraquezas e reclamações:**
    - Forças: interface limpa e rápida; busca rápida; lifetime barato (o migrante do Evernote compara US$ 39,99 vitalício vs. US$ 129,99/ano do Evernote); suporte responsivo com correções rápidas ([Substack, mai/2025](https://scottsnelson1.substack.com/p/upnote-or-evernote-the-journey-and)); App Store 4,7/5.
    - Fraquezas: sem E2EE e "os desenvolvedores podem acessar o conteúdo" (mesmo Substack); sem lembretes/calendário/e-mail para nota; tags sem hierarquia; reorganização trabalhosa após migração.
    - Reclamações citadas: colar texto no iPad remove bullets e reinicia numeração (review App Store, 02/01/2025); undo/redo opera caractere a caractere (review App Store, 04/09/2025); busca considerada fraca e falta de nested notes/gestão de projetos em posts do r/UpNote_App (via mirror, data não confirmada); dúvida recorrente sobre a sustentabilidade do lifetime com armazenamento ilimitado — o próprio dev admitiu em 2021 que "may need to switch to all subscription at some point" ([Outliner Software](https://outlinersoftware.com/topics/viewt/9403)).
11. **Relevância para o Monet:**
    - Prova que existe demanda por app simples, nativo em Windows, barato e "sem firula" — e que o público aceita (e até prefere) o modelo lifetime/baixo custo. O Monet grátis compete bem aqui.
    - Lacuna clara: UpNote não tem IA, nem anotação de PDF, nem recursos de estudo/leitura; o combo Library + citações + chat lateral do Monet é diferencial direto para quem vem do perfil "Evernote simples".
    - Inspirar-se: backup local automático por hora + histórico de versões + export para Markdown/HTML/PDF são o "seguro" que esse público valoriza; evitar a limitação de 50 notas no free (é citada como gatilho de troca) e a dependência de nuvem de terceiros sem E2EE.

### 9. Joplin

1. **Posicionamento e público-alvo:** "an open source note-taking app" focado em privacidade (E2EE), dados em formato aberto e liberdade de sync; público técnico/entusiasta de privacidade, ex-usuários de Evernote/OneNote e quem quer self-hosting. Comunidade em crescimento: r/joplinapp com ~11 mil membros, +37% em 12 meses (GummySearch, atualizado 30/09/2026).
2. **Modelo de organização:** notebooks aninhados + tags (case-insensitive desde 3.5, jan/2026) + links entre notas; multi-select de notebooks (3.5). **Whiteboards** (canvas infinito com notas, arquivos e cards ligados por setas rotuladas) chegaram na 3.7 (ago/2026, desktop). Backlinks/grafo/kanban/calendário dependem de plugins da comunidade [não verificado quais estão ativos em 2026]. Sem databases/propriedades.
3. **Editor:** dois editores — **Markdown** (CodeMirror; desde 3.6, mai/2026, renderiza formatação "as you type", estilo live preview, não WYSIWYG) e **Rich Text** (TinyMCE v6 no desktop desde 3.3; editor rich text em ProseMirror no mobile em beta desde 3.4, set/2025). Editor interativo de tabelas Markdown com menu de contexto (3.7). Matemática, diagramas, notação musical ABC (3.5). Templates e slash commands: via plugins [não verificado].
4. **Estudo/leitura:** web clipper (Chrome e Firefox: página, versão simplificada ou screenshot); PDFs, imagens, áudio e vídeo como anexos com visualização na nota; **OCR** de PNG/JPEG/PDF ligado por padrão (roda no desktop; texto OCR pesquisável também no mobile; não reconhece manuscrito); gravação de áudio e voice typing com Whisper no mobile (beta, 3.3, abr/2025). Sem anotação/grifo nativo de PDF, sem flashcards/SRS nativos [não verificado se há plugins mantidos].
5. **Tempo/organização pessoal:** to-dos com **alarmes/lembretes** sincronizados. Sem calendário ou daily notes nativos (reviews pedem "built-in calendar or task features" — Techjockey); há plugins da comunidade [não verificado].
6. **IA (2025–2026):** IA nativa chegou na **Joplin 3.7 (31/08/2026), em Beta e só no desktop**.
   - O que faz: **AI chat panel** que responde perguntas sobre a nota aberta, resume, reescreve, lê imagens da nota e **faz edições**; **semantic search** (busca por significado misturada à busca normal); **MCP server** para assistentes externos (ex.: Claude) lerem/escreverem notas; API de IA para plugins (`joplin.ai.search`).
   - Onde vive: barra lateral à direita do editor Markdown (Ctrl+Alt+I no Windows); semantic search na sidebar/Go To Anything.
   - Proativa vs. convocada: **convocada e opt-in**. "AI features are disabled by default"; há ainda um switch separado "Allow remote AI providers" desligado por padrão (só modelos em localhost/LAN funcionam até o usuário liberar). Post oficial: "AI should be opt-in, transparent and configurable" (14/09/2026).
   - Chat com as notas (RAG): **não no painel** — ele envia só a nota aberta (ou a seleção) e "never reads or sends other notes"; notas criptografadas não podem ser usadas. A busca semântica é só retrieval; RAG sobre a coleção fica para plugins (ex.: **Jarvis**) ou apps externos via MCP. GSoC 2026 teve propostas de "Chat with your note collection using AI" (não confirmado como entregue).
   - Escreve direto no documento? **Sim**: "requested edits are applied directly to the note", sem etapa de aprovação; reversível com Ctrl+Z; só funciona no editor Markdown. Histórico do chat **não é salvo em disco** (some ao reiniciar). Plugins de terceiros (ex.: *Joplin Aide*) adicionam aprovação de cada create/update/delete.
   - Modelos: Joplin Cloud AI (modelo não divulgado), qualquer endpoint OpenAI-compatible (OpenAI, Ollama, LM Studio, OpenRouter, vLLM) e Anthropic (Claude). Embeddings da busca semântica rodam **localmente** (~140 MB, "no note content is sent to a cloud service"; índice não sincroniza; Windows x64/ARM64 suportado, Mac Intel não).
   - BYOK ou local: **ambos** (BYOK OpenAI/Anthropic/OpenRouter; local via Ollama/LM Studio). Contador de tokens por provedor nas configurações.
   - Preço do add-on: **Joplin Cloud AI (beta) incluído** nos planos Basic, Pro, Pro 100 GB e Teams (não no Server Business); cotas não divulgadas. BYOK/local: grátis no app.
7. **Plataformas, offline, sync, E2EE, formato/export:** Windows, macOS, Linux, Android, iOS e app de terminal; **web app** para assinantes do Joplin Cloud. Offline-first (banco local). Sync com Joplin Cloud, Dropbox, OneDrive e outros alvos (WebDAV/Nextcloud/S3/sistema de arquivos [lista completa não verificada nesta sessão]). **E2EE opcional**; opção beta de criptografia 256-bit (3.2, jan/2025); TLS pós-quântico no desktop (3.7). Formato aberto (Markdown). Import: ENEX, Markdown, OneNote (.onepkg, inclusive Linux/macOS desde 3.6), Obsidian (3.7), .txt. Export: JEX, Markdown, HTML, PDF [não verificado nesta sessão].
8. **Preço (fonte, data) — em EUR:** app grátis e open source; o pago é o **Joplin Cloud**:
   - Basic: **€ 2,99/mês** ou **€ 28,69/ano** (€ 2,40/mês) — 2 GB, nota/anexo até 10 MB.
   - Pro: **€ 5,99/mês** ou **€ 57,48/ano** — 30 GB, até 200 MB; compartilhar notebook e Email to Note.
   - Pro 100 GB: € 9,99/mês ou € 95,88/ano. Teams: € 7,99/usuário/mês ou € 80,28/usuário/ano (mín. 2). Joplin Server Business (self-hosting): € 3,33/usuário/mês ou € 40/usuário/ano (2–10 usuários).
   - Trial de 14 dias. Fonte: https://joplinapp.org/plans/, acessado em 2026-10-17. (Sem preço em USD na página.)
9. **Mudanças e notícias 2025–2026:** 3.2 (14/01/2025): import de OneNote, multi-janela, criptografia 256-bit beta. 3.3 (28/04/2025): TinyMCE v6, gravação de áudio e voice typing Whisper no mobile. 3.4 (22/09/2025): rich text editor beta no mobile, histórico de notas no mobile, desktop ~33% menor. 3.5 (11/01/2026): edição Markdown mais estável, gestão de perfis. Pré-instalado no HMD Terra M (anúncio de 10/02/2026). Warrant Canary (23/02/2026). 3.6 (05/05/2026): Markdown com renderização ao digitar, status de sync. **3.7 (31/08/2026): IA (chat, semantic search, MCP), whiteboards, editor de tabelas, publicação de notebook inteiro, import do Obsidian, Joplin Cloud como opção primária de sync.** Post "Your notes and AI: privacy first" (14/09/2026).
10. **Forças, fraquezas e reclamações:**
    - Forças: grátis/open source, E2EE, escolha do backend de sync, plugins; IA desenhada como opt-in com local/BYOK; reação positiva no fórum à 3.7 ("monumentally impressive", t0dd, 25/06/2026, pré-release; [fórum](https://discourse.joplinapp.org/t/desktop-pre-release-v3-7-is-now-available-updated-14-07-2026/49829)).
    - Fraquezas/reclamações: interface "datada e básica" e conflitos de sync ocasionais (reviews Techjockey, majoritariamente 2024); "can feel a little clunky" (G2, abr/2026); tempo de inicialização (post "Joplin start up time is prohibitive" no r/joplinapp, data não confirmada); sync é o tema nº 1 do subreddit (59 posts) seguido de mobile (GummySearch); instalador da 3.7.3 travando no Windows 11 (fórum, 24/06/2026); IA só no desktop.
11. **Relevância para o Monet:**
    - É o concorrente com filosofia de IA mais próxima do Monet (opt-in, BYOK, modelos locais, contexto restrito à nota aberta, chat efêmero não salvo em disco) — valida a tese. **Diferença a explorar:** no Joplin a IA edita a nota diretamente; no Monet ela nunca escreve sem o botão "Anotar/Inserir" — o argumento de "notas perenes" é diferencial real.
    - Inspirar-se: embeddings locais no dispositivo (sem enviar nota à nuvem) e servidor **MCP** para expor as notas a agentes externos são tendências de 2026 que o Monet pode considerar; o switch "Allow remote AI providers" é um bom padrão de privacidade.
    - Lacuna: Joplin não tem leitura/anotação de PDF/EPUB, grifos nem citação para notas — o módulo Library do Monet ocupa um espaço que o Joplin não cobre; a UX "datada" é o ponto fraco que o Monet pode atacar.

### 10. Standard Notes

1. **Posicionamento e público-alvo:** "A steel vault for your mind" — app de notas com **E2EE auditada e zero-knowledge**, open source, foco em privacidade, longevidade ("Built to Last", 10 anos no ar) e independência de big tech (receita 100% de usuários pagantes, US$ 0 de venture capital). Público: pessoas preocupadas com privacidade; o site cita escritores, profissionais jurídicos e jornalistas e o uso como cofre de dados sensíveis (documentos, saúde, diário). Desde **10/04/2024** faz parte da **Proton AG**, mas mantém marca, roadmap e preços próprios.
2. **Modelo de organização:** tags aninhadas que funcionam como **folders** (drag-and-drop), **Smart Views** (consultas salvas; desde ago/2026 aceitam condição por tag), notas fixadas, arquivo e lixeira; **note types** (cada nota "é" um tipo: Super, Markdown, rich text, plain text, tasks, code, spreadsheets, senhas/tokens, etc.). Links entre itens: [não verificado nesta sessão]. Sem grafo, canvas ou databases. Usuário de 2023 reclamou que esperava pastas e encontrou "nested tag system" (Trustpilot).
3. **Editor:** **Super notes** (plano Productivity) combinam Markdown, rich text, checklists e code snippets; há também planilhas com fórmulas avançadas e editores/plugins alternativos. Free tem só plain text. Command palette (Ctrl/Cmd+Shift+:) no web/desktop (2025); "note from selection" (2025); busca dentro da nota com find-and-replace também em plain notes (ago/2026). Slash commands no Super: [não verificado]. Templates: [não verificado].
4. **Estudo/leitura:** **Web Clipper** (Productivity); anexos de arquivos criptografados com preview (inclusive PDF), 100 GB e acesso offline a arquivos no Professional. Sem anotação/grifo de PDF, sem flashcards, sem transcrição de áudio. Publicação de notas como blog via **Listed** (listed.to). Review de jan/2026 relata que, ao rebaixar do pago para o free, PDFs deixaram de abrir e baixavam vazios (Trustpilot).
5. **Tempo/organização pessoal:** note type de tasks/todos; **Daily Notebooks** (diário, Productivity); **Moments** (Professional) [funcionamento não verificado]. Sem calendário nem lembretes nativos [não verificado].
6. **IA (2025–2026):**
   - O que faz: **nenhuma IA.** Site, planos, help center e posts de 2024–2026 (incluindo o balanço "2025 update", 11/12/2025, e o post de busca de 17/08/2026) não mencionam IA; a busca nova é por palavra-chave/título/tag, não semântica.
   - Onde vive / proativa vs. convocada / RAG / escreve no documento / modelos / BYOK / preço: não se aplica.
   - Recusa declarada? **Não encontrei declaração explícita** de recusa — é ausência coerente com o posicionamento de privacidade/E2EE, não um manifesto [inferência]. Contexto: a controladora Proton tem o assistente **Lumo** (chat com "zero-access encryption", sem logs; Lumo Plus US$ 9,99/mês ou US$ 119,88/ano), que integra com Proton Drive, mas **não há menção a integração com Standard Notes** (proton.me/lumo, acessado 2026-10-17).
7. **Plataformas, offline, sync, E2EE, formato/export:** Windows, macOS (Intel e Apple Silicon), Linux, iOS, Android e web. Funciona offline; sync ilimitado de dispositivos no free; **E2EE em todos os planos**, múltiplas auditorias independentes (Privacy Guides). 2FA, senha por nota, app lock, chave de hardware (Professional). Self-hosting do servidor possível. Backups: e-mail diário criptografado (free), backups em Dropbox/Google Drive/OneDrive, backup de arquivos no computador (Professional). Export: o dataset inteiro em arquivo único de backup (reimportável/convertível); import de Evernote, Simplenote, Apple Notes, Google Keep e texto. Histórico de revisões: só sessão atual (free), 1 ano (Productivity), máximo (Professional).
8. **Preço (fonte, data):** página oficial mostra só **cobrança anual**:
   - Standard: **grátis** (E2EE, sync ilimitado, plain text, tags, export, 2FA, backups por e-mail).
   - Productivity: **US$ 90/ano** (Super notes, planilhas, Daily Notebooks, folders, Web Clipper, 1 ano de histórico).
   - Professional: **US$ 120/ano** (100 GB criptografados, compartilhar assinatura com até 5 contas, Moments, histórico máximo, chave de hardware). App Store lista "Professional Plan" a US$ 119,99.
   - Plano mensal: não exibido na página oficial (AlternativeTo cita faixa de ~US$ 3–10/mês [não verificado]). Descontos recorrentes por volta de novembro (review AlternativeTo, jan/2025).
   - Fonte: https://standardnotes.com/plans, acessado em 2026-10-17.
9. **Mudanças e notícias 2025–2026:**
   - 11/12/2025 — "2025 update": command palette, note from selection, alinhamento de imagens no Super, upgrade de React Native; confirma que Standard Notes **não será fundido numa assinatura Proton** ("It will continue to have its own plan and pricing"); roadmap 2026 com localização e busca universal.
   - 17/08/2026 — "smarter search, tags, and more": painel de busca redesenhado, busca só por título, filtro por tags, tags em Smart Views, find-and-replace em plain notes; tradução da interface liderada pelo time de localização da Proton, prevista para antes do fim de 2026.
   - Releases a cada 1–2 semanas (v3.202.7–3.202.10, set–out/2026), majoritariamente correções/version bumps (GitHub).
   - Contexto 2024: aquisição pela Proton (10/04/2024); post de 13/11/2024 admite que "feature releases slowed" durante endurecimento contra DDoS.
10. **Forças, fraquezas e reclamações:**
    - Forças: E2EE auditada, longevidade, 4,7/5 na App Store (~3,8 mil avaliações); usuário que veio do Anytype elogiou busca universal e flexibilidade de formatação (AlternativeTo, 15/08/2025); recomendado pelo Privacy Guides (página atualizada 15/05/2025).
    - Fraquezas/reclamações: **preço** alto para o que entrega ("seemingly built over a weekend", ~3x o preço de concorrente, setup pior que o do Notesnook — AlternativeTo, 14/01/2026); free muito limitado (só plain text; histórico só da sessão); recursos básicos atrás do paywall historicamente (dark mode pago — App Store, 2019); ritmo de features lento (próprio blog, 2024); importação do Evernote com formatação ruim e sem múltiplas janelas (App Store, 07/08/2024); perda de acesso a PDFs após downgrade (Trustpilot, 15/01/2026).
11. **Relevância para o Monet:**
    - Mostra que existe um público disposto a pagar US$ 90–120/ano por privacidade/longevidade — o Monet (local-first, sem conta, grátis) entrega privacidade "por arquitetura" sem cobrar, mas não oferece sync; deixar isso claro na comunicação.
    - Lição a evitar: travar formatação rica, histórico ou arquivos atrás de paywall gera ressentimento; e o downgrade não pode "sequestrar" anexos.
    - Lacuna: zero IA e zero recursos de estudo/leitura — o segmento "privacidade" ainda não tem uma IA convocada e controlada pelo usuário; o modelo BYOK + "IA nunca escreve sozinha" do Monet pode ser apresentado como IA compatível com quem desconfia de IA.

### 11. Simplenote

1. **Posicionamento e público-alvo:** notas de texto puro, grátis e multiplataforma, da Automattic (WordPress.com): "The simplest way to keep notes". Para quem quer só texto rápido, sincronizado e sem distrações.

2. **Modelo de organização:** lista única de notas com **tags**, pin e busca instantânea. Sem pastas, hierarquia, databases ou grafo. Links internos entre notas existem via "Copy Internal Link" [não verificado nesta sessão].

3. **Editor:** texto puro com **Markdown opcional por nota**, com preview (web, Android, Windows/Linux e iOS). Checklists e histórico de versões por nota. No desktop: command palette Ctrl+K e decorações de sintaxe Markdown (2.26, mai/2026). Protótipo de **editor WYSIWYG Markdown** como pré-release separada (03/jul/2026). Não tem tabelas, imagens/anexos, slash commands nem templates [imagens/anexos: não verificado].

4. **Estudo/leitura:** nada específico: sem PDF, web clipper, áudio, highlights ou flashcards. Tem publicação de nota por link público, com aviso de que qualquer pessoa com o link pode ver.

5. **Tempo/organização pessoal:** nada além de checklists: sem lembretes, calendário ou daily notes.

6. **IA (2025–2026):**
   - **O que faz:** **sem IA embutida.** Desde 2026 há o **Simplenote MCP server** oficial (open source, MIT). Em 15/abr/2026 saiu um beta só para macOS e só leitura. Em 08/mai/2026 ele passou a rodar em macOS, Windows e Linux, com escrita opt-in: criar, atualizar, mandar para a lixeira, restaurar, ver histórico e reverter versões.
   - **Onde vive:** fora do app, no cliente MCP do usuário. O README cita Claude Code, Codex, Claude Desktop, Cursor, VS Code (Copilot), Zed, Cline e Windsurf.
   - **Proativa vs. convocada:** convocada. A escrita é "completely opt-in".
   - **Chat com as notas (RAG):** via cliente externo, com ferramentas de busca e leitura.
   - **Escreve direto no documento?** Só com o modo de escrita ligado. Há guardas: o servidor "won't allow an LLM to completely wipe out the contents of a note", limita encolher drasticamente notas grandes e limita a taxa de escrita. `update_note` substitui o conteúdo inteiro, e a documentação alerta para ler a nota antes.
   - **Modelos:** os do cliente escolhido.
   - **BYOK ou local:** o servidor roda localmente. No Mac com o app instalado ele lê o banco local; nos demais casos usa a API Simperium com token salvo localmente. O LLM é o do usuário.
   - **Preço do add-on:** grátis.

7. **Plataformas, offline, sync, E2EE, formato/export:** iOS, Android, macOS, **Windows** (Electron, também na Microsoft Store), Linux e web (instalável como PWA para uso offline). Os apps funcionam offline e sincronizam ao reconectar. O sync é feito pelo **Simperium** (Automattic), com **conta obrigatória**. **Criptografia:** "always encrypted when they're in transit", mas "**Notes are not encrypted at rest due to server side constraints**". Sem E2EE. Export: .zip com todas as notas (web e desktop) e JSON no Android. Import de JSON, TXT, MD e ENEX (desktop).

8. **Preço (fonte, data):** **grátis**, incluindo apps, backups, sync e compartilhamento. Não há plano pago. Fonte: https://simplenote.com/, acessado em 2026-10-17.

9. **Mudanças e notícias 2025–2026:**
   - **iOS parado:** a última versão na App Store é a 4.55, de **04/nov/2024**, quase 2 anos sem update (acessado em 2026-10-17). No fórum, "Simplenote widget not working on iOS 27 iPhone" (cerca de out/2026).
   - **Android:** 2.39 (05/out, ano não exibido no GitHub; inclui suporte ao predictive back do Android 16) [ano não verificado: 2025 ou 2026].
   - **Desktop (Electron):** 2.25 (21/mai/2026), 2.26 (25/mai/2026, command palette), 2.27.0 (01/jul/2026, React 18 e assinatura Azure Trusted Signing no Windows), 2.27.1 (01/jul/2026). Pré-release WYSIWYG em 03/jul/2026, fruto da "Radical Speed Month" da Automattic.
   - **15/abr e 08/mai/2026:** MCP server.
   - **Status oficial:** em comentário no blog (03/jul/2026), Usiel Riedl (Automattic) respondeu a um usuário que perguntou se o app "would be going away": "**While Simplenote is no longer in active development**, many of us here at Automattic are happy users too". O app fica em modo de manutenção, com melhorias pontuais.

10. **Forças, fraquezas e reclamações:**
    - **Forças:** grátis e sem limites, rápido, estável, com histórico de versões, multiplataforma inclusive Windows e Linux. Nota 4,7/5 com cerca de 4,3 mil avaliações (App Store EUA). Reviews: "I can find almost anything using the full-text search, and get instant results" (26/04/2024); "probably the least buggy app I've ever used" (2018).
    - **Fraquezas:** sem desenvolvimento ativo; sem criptografia em repouso nem E2EE; sem anexos ou rich text; organização limitada a tags; dependência de um serviço de sync próprio. O tópico "Is auth.simperium.com still supported?" (21 respostas) mostra dúvidas sobre a continuidade.
    - **Reclamações no fórum oficial (out/2026):** sync e perda de dados ("Synching erased new notes", "Deleted Files need to be restored"), login ("can't log in, notes missing", em japonês), dificuldade para excluir conta, travamento ao colar texto grande, problemas com Ctrl-V (thread com 60 respostas). No protótipo WYSIWYG houve relatos de notas truncadas: "when I opened a note, it was truncated" (03/jul/2026).

11. **Relevância para o Monet:**
    - **Inspira:** o MCP server com escrita opt-in e guardas (não apagar nota inteira, não encolher notas grandes, rate limit, lixeira reversível) é um bom checklist para qualquer integração IA→notas no Monet, coerente com "a IA nunca escreve sem consentimento".
    - **Evitar:** a ansiedade de "app em modo manutenção" corrói a confiança na perenidade das notas. O Monet deve comunicar durabilidade: local-first, export aberto, formato legível.
    - **Lacuna:** usuários de Simplenote no Windows que querem a mesma leveza com mais estrutura (cadernos, PDF, citações) e sem depender de servidor de terceiros. Uma migração fácil via import de .txt, .md ou JSON do Simplenote é o atrativo.

### 12. Microsoft Loop

1. **Posicionamento e público-alvo:** App de cocriação da Microsoft ("Think, plan, and create together") baseado em componentes "portáteis" que vivem sincronizados dentro de Teams, Outlook, OneNote e Whiteboard. Público: organizações no Microsoft 365 (contas de trabalho/escola); contas pessoais têm acesso ao app web/mobile, mas com recursos reduzidos. Em 2026 o Loop funciona cada vez mais como a "infraestrutura" de Copilot Pages e Copilot Notebooks (mesmo contêiner de armazenamento).
2. **Modelo de organização:** Workspaces (o pessoal "My workspace", que substituiu o antigo "Ideas"; workspaces compartilhados; workspaces de canal do Teams) > páginas (com subpáginas) > Loop components (tabelas, listas de tarefas etc.) que podem ser embutidos e editados ao vivo em outros apps. Arquivos `.loop` (antes `.fluid`) guardados em SharePoint Embedded/OneDrive. Sem tags, backlinks ou grafo como conceitos centrais [não verificado]; canvas fica no Whiteboard (app separado).
3. **Editor:** Blocos com insert menu (`/`), @mentions, emoji e datas; templates de página (contexto de projeto, notas, decisões); tabelas inline, listas de tarefas sincronizáveis com Planner, comentários/reações, rastreio de mudanças ("Recap"). Colaboração em tempo real é o foco. Relato de usuário (AlternativeTo, 09/09/2026): "cannot copy and paste markdown … no version history".
4. **Estudo/leitura:** praticamente inexistente — sem anotação de PDF, sem web clipper, sem flashcards/SRS. Áudio/transcrição vêm do Teams: "collaborative notes" de reunião em que o Copilot gera notas e sugere tarefas (com licença).
5. **Tempo/organização pessoal:** tarefas via task lists/Planner e componentes no novo calendário do Teams; sem daily notes, sem calendário próprio, sem lembretes pessoais nativos [não verificado].
6. **IA (2025–2026):**
   - **O que faz:** Copilot in Loop hoje é reduzido: abre o Copilot Chat para perguntas abertas sobre dados da web ou corporativos (enterprise search), permite resumir as próprias edições da página (Recap) e gera notas/tarefas em reuniões. A Microsoft informa que "recently removed some Copilot integrations from the Loop app" para sincronizar com Copilot Pages porque "the differences were leading to user confusion", e que trabalha para trazer experiências do Copilot Pages de volta ao Loop e atualizar o modelo.
   - **Onde vive:** botão Copilot no canto superior direito da página (painel de chat). Fora do Loop: Copilot Pages (canvas persistente a partir de respostas do Copilot Chat) e Copilot Notebooks, dentro do app Microsoft Copilot (ex-"Microsoft 365 Copilot app").
   - **Proativa vs. convocada:** convocada.
   - **Chat com as notas (RAG):** dentro do Loop, não — a página oficial diz que o Copilot "cannot be used to ask about the Loop Workspace". O grounding em documentos próprios ficou com Copilot Notebooks (licença Microsoft Copilot/Copilot Chat) e com o Copilot corporativo (Microsoft Graph).
   - **Escreve direto no documento?** Não. A resposta só entra na página pelo botão "Insert"; o Copilot "cannot … make updates to the currently-open Page". (Ironia útil: é o mesmo padrão do Monet, mas aqui surgiu por recuo, não por princípio de design.)
   - **Modelos:** os do Microsoft Copilot (a página promete "upgrade the Copilot chat to match the same model used" no Copilot Chat/Pages); modelo específico não divulgado [não verificado].
   - **BYOK ou local:** não.
   - **Preço do add-on:** exige licença Microsoft Copilot (trabalho/escola). Página oficial de preços (acessada em 2026-10-17): Microsoft 365 Copilot Business (add-on) US$ 21/usuário/mês no anual — promocional US$ 18 entre 01/07/2026 e 31/12/2026 — ou US$ 25,20 no mensal; bundles Business Standard + Copilot US$ 23,50 (anual)/US$ 28,20 (mensal) e Business Premium + Copilot US$ 32,00/US$ 38,40. Preço Enterprise não exibido. Contas pessoais: "Copilot isn't available in Loop for personal Microsoft accounts" — nem Microsoft 365 Personal/Family/Premium destravam.
7. **Plataformas, offline, sync, E2EE, formato/export:** Web (loop.cloud.microsoft), iOS e Android; sem app desktop nativo para Windows/macOS (instalável como PWA via Edge, segundo KluczeSoft, mai/2026 — fonte secundária). Online-only, sem modo offline (KluczeSoft "stan na 2026"; GeekChamp, set/2026) [não verificado em fonte oficial]. Armazenamento conta na cota Microsoft (contas pessoais: 5 GB grátis; limite de 5 GB por workspace removido em 2024). Sem E2EE; recursos de compliance corporativo (Purview, eDiscovery, sensitivity). Export de páginas [não verificado]. Componentes Loop no Word para web foram aposentados em 01/09/2025 e no OneNote para web a partir de meados de set/2026 (viram links); seguem completos no OneNote desktop para Windows.
8. **Preço (fontes oficiais, acessadas em 2026-10-17):** Conta pessoal: apps Loop web/iOS/Android grátis ("available to anyone with a personal Microsoft account"), limitados pela cota de armazenamento; Microsoft 365 Personal US$ 9,99/mês ou US$ 99,99/ano e Family US$ 12,99/mês ou US$ 129,99/ano ampliam armazenamento (1–2 TB), mas não liberam Copilot no Loop. Trabalho/escola: Loop workspaces vêm com assinaturas Microsoft 365 elegíveis ("As of February 2026, anyone with access to the Loop app that meets the storage requirements … can create Loop workspaces"); Copilot cobrado à parte (item 6). Fontes: https://support.microsoft.com/en-us/office/loop-access-via-microsoft-365-subscriptions-92915461-4b14-49a4-9cd4-d1c259292afa ; https://www.microsoft.com/en-us/microsoft-365-copilot/pricing ; https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products
9. **Mudanças e notícias 2025–2026:**
   - 01/09/2025: fim da inserção de Loop components no Word para web.
   - Fim de 2025: remoção de integrações de Copilot do app Loop para alinhar com Copilot Pages (página de suporte "Copilot in Loop").
   - Fev/2026: criação de workspaces liberada a todos com acesso ao app e armazenamento adequado.
   - Meados de set/2026: início da aposentadoria dos Loop components no OneNote para web.
   - 2026: app "Microsoft 365 Copilot" renomeado "Microsoft Copilot"; Copilot Pages (`.page`) e Copilot Notebooks (`.pod`) passam a dividir o contêiner do Loop My workspace (Microsoft Learn, atualizado set–out/2026); recycle bin de workspaces no roadmap para jun/2026 (GeekChamp, 24/09/2026).
   - Leitura: o Loop não foi descontinuado (documentação ativa em out/2026), mas está sendo absorvido como camada de páginas/armazenamento do ecossistema Copilot, com recuo em integrações.
10. **Forças, fraquezas e reclamações:**
    - Forças: componentes vivos dentro de Teams/Outlook; integração e governança Microsoft 365; grátis para contas pessoais.
    - Fraquezas: online-only, sem app desktop, IA limitada e em fluxo, recursos para conta pessoal bem menores (componentes não funcionam em Teams/Outlook com conta pessoal), estratégia confusa (Loop × Copilot Pages × Notebooks × OneNote).
    - Reclamações: AlternativeTo mostra nota média 2,0/5 com poucas reviews — "Really buggy, cannot copy and paste markdown, simple functionalities doesn't work, no version history" (dariuszwoniak, 09/09/2026); "It's a little bit buggy" (Nick M, 27/10/2024). Reviews de terceiros listam ausência de app desktop e de offline como contras (Geekflare; KluczeSoft 2026). Sentimento no Reddit não pôde ser coletado (busca indisponível) [não verificado].
11. **Relevância para o Monet:**
    - **Inspira/valida:** o Copilot no Loop só insere conteúdo via botão "Insert" e não altera a página aberta — validação, por uma big tech, do modelo "IA propõe, usuário insere" do Monet.
    - **Evitar:** fragmentar a experiência em várias superfícies de IA/páginas (Loop, Pages, Notebooks, OneNote) — a própria Microsoft admite "user confusion". O Monet deve manter Anotações/Chat/Library como um sistema coeso.
    - **Lacuna:** no Windows, a Microsoft não oferece um app desktop offline de notas com IA para uso pessoal no Loop; o OneNote cobre parte disso (ver parte de OneNote). Espaço para um app Windows nativo, local-first, com IA BYOK.

### 13. Zoho Notebook

1. **Posicionamento e público-alvo:** app de notas "bonito e grátis" da Zoho (suíte SaaS indiana), com cadernos de capas ilustradas e note cards visuais. Discurso: sem anúncios e "we never sell your data". Mira estudantes (Notebook for Students com IA grátis), usuários de Apple (iPad, Apple Watch, Liquid Glass) e, cada vez mais, clientes do ecossistema Zoho (CRM, Cliq, Meeting, Voice), com transcrição automática de chamadas.
2. **Modelo de organização:** Notebooks com capas que contêm **note cards** de vários tipos: Text, Checklist, Audio, Photo, Sketch, File e Smart Cards (receitas, links, vídeos, Flight Card). Tem Collections aninhadas (até 5 níveis, segundo o help center), tags com edição em lote, ordenação customizada, Noteboards (visão kanban em colunas) e Whiteboards no plano Business. Um usuário pergunta no fórum por "nested notebooks", o que sugere que só as collections aninham. Sem backlinks, grafo ou databases [não verificado].
3. **Editor:** rich text WYSIWYG com tabelas, checklists, sketch e imagens; editor web novo em 2026 (há reclamações de barra de rolagem e espaçamento). Import/export em Markdown (jun/2026; mobile em jul/2026). Templates, inclusive "AI-powered meeting templates" (jul/2026). Slash commands [não verificado]. O corretor ortográfico é alvo de reclamações (item 10).
4. **Estudo/leitura:** Web Clipper para Chrome, Firefox, Safari e Edge; anotação de PDF com destaque e comentários no Pro (Android desde mai/2026); OCR e busca por objetos em imagens (Pro). Áudio: Audio Cards de 30 a 180 min conforme o plano. *Smart Transcripts* (mar/2026) trazem resumo, tradução, Q&A sobre a gravação e export do transcript em PDF; há gravação automática de reuniões no Mac sem bot. AI Mind Maps a partir de notas ou transcrições. O pacote para estudantes inclui "study help" [sem detalhe]. Não achei flashcards/SRS nem leitor EPUB [não verificado].
5. **Tempo/organização pessoal:** lembretes (recorrentes e customizados nos planos pagos), checklists e Noteboards para projetos. Sem daily notes, calendário ou módulo de tarefas dedicado [não verificado].
6. **IA (2025–2026):**
   - **O que faz:** o *Notebook AI* (lançado em fev/2025) gera conteúdo (rascunhos, checklists, tabelas, templates), melhora texto (refinar, resumir, gramática, tom, simplificar), traduz, sugere tags, faz **"Ask with My Content"** (perguntas sobre o próprio conteúdo), transcrição em 7 idiomas, mind maps, AI meeting notes e Q&A sobre gravações. Também inclui **Zoho Notebook MCP** (mai/2026, 55 ferramentas), que conecta Claude, ChatGPT, Cursor e VS Code para criar e buscar notas.
   - **Onde vive:** no editor, via ícone do Notebook AI, aplicado à seleção ou à nota inteira. Não é um app separado.
   - **Proativa vs. convocada:** majoritariamente convocada. Há elementos proativos: o app de menubar do Mac detecta reuniões ativas com IA on-device (abr/2026) e a detecção automática de gravações para transcrever (jul/2026). No fórum, um usuário relata "random AI notes spawning" em cadernos errados.
   - **Chat com as notas (RAG):** "Ask with My Content", listado no pacote para estudantes; não há doc detalhada sobre o escopo [não verificado].
   - **Escreve direto no documento?** Não. O resultado "is shown for your review first" e o usuário decide se insere ou substitui (help center, "Enhance your notes"). O app diz que não processa todas as notas automaticamente, só o conteúdo da ação pedida.
   - **Modelos:** a transcrição usa ASR próprio da Zoho, dentro da infraestrutura dela. A geração mistura modelos próprios e externos; o FAQ diz que hoje usa serviços da **OpenAI**, com modelos "dynamically selected". Há IA on-device no iOS (Apple Intelligence) e no Android (abr/2026, funciona offline).
   - **BYOK ou local:** sem BYOK. Há processamento local parcial nos dispositivos móveis.
   - **Preço do add-on:** a IA vem no **Notebook Pro Plus** (jul/2026: Notebook AI + 500 GB + 30 h/mês de transcrição) e no **Business** (100 min de transcrição/usuário/mês e cerca de 60 usos/mês do assistente de escrita). A página de pricing também lista um add-on "Notebook AI" por usuário. Estudantes com e-mail institucional ganham 1 ano grátis com cota "generous" e 5 GB. Valores não renderizados (item 8).
7. **Plataformas, offline, sync, E2EE, formato/export:**
   - **Plataformas:** Web, **Windows**, Mac, Linux (o help center lista downloads para os três desktops), iOS/iPadOS, Android e Apple Watch.
   - **Offline e sync:** sync em nuvem Zoho; **não é local-first**. Os apps têm cache local [comportamento offline não documentado nas páginas lidas].
   - **E2EE:** **não**. Os dados são criptografados em trânsito e em repouso; há notas trancadas com passcode e Face ID/Touch ID.
   - **Export:** ZNote ou HTML (export em massa só no web app, segundo o fórum), Markdown (jun/2026), PDF, imagem e TXT. Importa de Evernote, OneNote, Pocket, Markdown, HTML e TXT.
8. **Preço (fonte, data):** a página oficial (zoho.com/notebook/pricing.html, acessada em 2026-10-17) **não renderizou valores** (campos vazios e localização em pt-BR) e nenhum artigo do help center traz preços. Valores em USD: **[não verificado]**. Estrutura confirmada (help center, "Compare Zoho Notebook Plans"):

   | Plano | Armazenamento | Áudio máx. | IA |
   |---|---|---|---|
   | Essential (grátis, sem anúncios) | 500 MB, arquivos até 10 MB | 30 min | — |
   | Pro Lite | 15 GB | 60 min | — |
   | Pro | 100 GB, arquivos até 1 GB | 60 min | — |
   | Pro Plus | 500 GB | 180 min | Notebook AI, 30 h/mês de transcrição |
   | Business | 1 TB para até 10 usuários + 100 GB/usuário adicional | 180 min | Notebook AI |

   Cobrança mensal, anual ("economize até 16%") ou de 3 anos; compra pela Zoho Store, App Store ou Play Store.

   Referência secundária de valores [sec.; não verificado na página oficial]: **Pro ~US$ 1,99/mês, US$ 19,99/ano ou US$ 49,99 por 3 anos** (review da TechRepublic de 2024, via resultado de busca; AppPricingLab, "Discovered 2026-04-01", com layout ambíguo). Não encontrei valores em USD para Pro Lite, Pro Plus (jul/2026) e Business.
9. **Mudanças e notícias 2025–2026** (página "What's new" e blog oficial):
   - **2025:** fev, Notebook AI; jul, transcrição em 7 idiomas, gravação automática de reuniões no macOS e AI Mind Map; ago, Noteboards no macOS; set, suporte a iOS 26 com transcrição on-device e Apple Intelligence; out, Notebook AI for Students; dez, respostas de IA em streaming.
   - **2026:** mar, Smart Transcripts; abr, IA on-device no Android; mai, MCP com 55 ferramentas, IA sobre PDFs e Bookmark Cards e anotação de PDF no Android; jun, Markdown import/export; jul, plano Pro Plus; ago, compartilhamento com e-mails de grupo e auto-import e transcrição de gravações do Zoho Voice, Cliq e Meeting; 18/09, pronto para iOS/macOS 27.
   - Em 2026 a direção é clara: integração com a suíte Zoho e foco em áudio e reuniões.
10. **Forças, fraquezas e reclamações:** a principal fonte acessível é o fórum oficial da Zoho, já que Reddit e GetApp bloquearam o fetch. Os tópicos não mostram datas.
    - **Forças:** grátis e sem anúncios, visual agradável (capas, cards), multiplataforma de verdade (inclusive Linux e Watch), IA com revisão antes de aplicar, IA grátis para estudantes e export em Markdown.
    - **Windows/PC:** "Search is completely broken for PC" (busca casando letras isoladas); cards criados no Android não abrem no app desktop; login no Windows.
    - **Confiabilidade:** "Switching from Notebook to another product, too unreliable" (lag a cada tecla, spell check ruim); imagens coladas que somem; notas grandes lentas (um usuário com notas de 83 mil caracteres de vocabulário).
    - **Portabilidade:** export em massa só no web app e dificuldade de exportar tudo com metadados (pedido estilo GDPR).
    - **IA indesejada:** "random AI notes spawning".
    - **Pedidos recorrentes:** notação matemática, API pública e notas lado a lado no Mac.
11. **Relevância para o Monet:**
    - **Inspira:** o "Notebook for Students" (IA grátis com cota para e-mail .edu) é um modelo de aquisição para a persona de estudo. Capas e cards dão identidade afetiva aos cadernos, e a IA que "mostra para revisão e o usuário insere/substitui" confirma o padrão de mercado.
    - **Evitar:** app Windows de segunda classe (bugs de busca e compatibilidade) e export capado. O Monet, nativo de Windows e local-first com export aberto, pode explorar exatamente isso.
    - **Lacuna:** como o Evernote, o Zoho investe em áudio e reuniões corporativas. Leitura profunda (PDF/EPUB com grifos que viram notas, chat com contexto da página) e BYOK seguem desatendidos.

### 14. Notesnook

1. **Posicionamento e público-alvo:** alternativa open source (GPLv3), **E2EE e "zero knowledge"** ao Evernote, mantida pela Streetwriters sem investidores, anúncios ou venda de dados; público: usuários que querem privacidade "by design" com UX moderna e sync simples. Recomendado pelo Privacy Guides (ao lado de Standard Notes, Joplin e Cryptee). Posiciona-se contra "privacy by promise" (post de 01/09/2025 sobre funcionários do Evernote poderem ler notas).
2. **Modelo de organização:** notebooks aninhados (desde v3.0), tags, **colors**, shortcuts, notas soltas no topo do notebook; **links entre notas inclusive em nível de bloco, com backlinks** ("Referenced in N notes"); abas (tabs), table of contents, sidebar unificada (3.1, abr/2025), command palette (3.0.27), filtros de busca por campo (beta, 3.3.0). Sem grafo, canvas ou databases. Limites no free: 50 notebooks, 50 tags, 7 cores.
3. **Editor:** editor rich text baseado em **TipTap** (desde v2.0) com suporte a Markdown (inclui colar Markdown), task lists, outline lists, tabelas, callouts, matemática/fórmulas, code blocks, imagens e arquivos; estatísticas de palavras/caracteres (3.3.0); toggle de spellcheck por nota (3.4.0). Slash commands e templates: [não verificado].
4. **Estudo/leitura:** **web clipper** (salva artigos sem anúncios/trackers para leitura offline); preview de anexos (v2.5.0) — PDF especificamente [não verificado]; **Monographs** (publicar nota como página web, opcionalmente com senha, em monogr.ph). Sem anotação/grifo de PDF, flashcards ou transcrição de áudio.
5. **Tempo/organização pessoal:** **reminders** sincronizados e recorrentes (diário/mensal/anual; limite de 10 ativos no free e 50 no Essential); task lists no editor. Sem calendário nem daily notes (ausentes do roadmap, atualizado em 22/04/2025).
6. **IA (2025–2026):**
   - O que faz: **nenhuma IA.** Site, pricing, roadmap e releases de 2025–2026 (até v3.4.x, out/2026) não mencionam IA.
   - Onde vive / proativa vs. convocada / RAG / escreve no documento / modelos / BYOK / preço: não se aplica.
   - Recusa declarada? **Não há manifesto explícito** [não encontrado]; o discurso é de desconfiança de ML/treino sobre conteúdo do usuário — "Privacy by design is far superior to privacy by promise" (01/09/2025). Contato indireto com IA: a parceria Notesnook Circle dá aos pagantes 3 meses do Kagi Professional (que inclui o Kagi Assistant). O **Inbox API** (v3.4.0) permite automações externas que poderiam incluir IA [inferência].
7. **Plataformas, offline, sync, E2EE, formato/export:** Windows, macOS, Linux (inclui Flathub), Android, iOS e web; dispositivos ilimitados inclusive no free. Notas criptografadas no dispositivo antes do sync; criptografia em repouso + app lock (v3.0); Vault com senha secundária; "Full offline mode" (v3.0.14) aparece na tabela de planos, mas a extração não mostrou em quais planos — review de fev/2026 diz que o offline é limitado no free [não verificado]. Algoritmos (ex.: XChaCha20-Poly1305/Argon2): [não verificado nesta sessão]. **Sem auditoria de terceiros ainda** (está como "planned" no roadmap; Privacy Guides "cites no audits"). Sync server open source; self-hosting em andamento. Export em massa HTML, Markdown e PDF — **todos os formatos liberados no free desde out/2025**. Import: Evernote, OneNote, Zoho Notebook, Google Keep, Obsidian, Markdown, ColorNote e UpNote (3.4.0). Inbox API com E2EE (notas enviadas por Zapier/IFTTT/scripts chegam criptografadas).
8. **Preço (fonte, data):** novos planos desde **04/10/2025** (v3.3):
   - Free: notas ilimitadas, 50 MB/mês de upload, arquivo até 10 MB, 100 versões por nota.
   - **Essential: US$ 1,99/mês ou US$ 19,99/ano** (1 GB/mês, arquivos até 100 MB, 500 notebooks/tags).
   - **Pro: US$ 6,99/mês ou US$ 69,99/ano** (10 GB/mês, arquivos até 1 GB, ilimitado); plano de 5 anos pré-pago.
   - **Believer: US$ 8,99/mês ou US$ 89,99/ano** (25 GB/mês, arquivos até 5 GB); plano de 5 anos.
   - Antes: plano único Pro a US$ 4,49/mês com armazenamento "truly unlimited"; assinantes ativos mantiveram o preço. Educação: Pro por US$ 19,99 no primeiro ano. Sem lifetime (só 5 anos pré-pagos). Trial de 14 dias exige meio de pagamento.
   - Fonte USD: https://notesnook.com/blog/introducing-new-pricing-plans (04/10/2025), acessado em 2026-10-17. A página https://notesnook.com/pricing, acessada em 2026-10-17, exibiu preços regionais em **BRL** (Essential R$ 10,07/mês ou R$ 101,20/ano; Pro R$ 35,39/mês ou R$ 253,07/ano em promoção de −29%; Believer R$ 45,51/mês ou R$ 455,57/ano), coerentes com a tabela em USD.
9. **Mudanças e notícias 2025–2026:** v3.1.0 (22/04/2025, sidebar unificada); v3.2.0 (17/06/2025); post "Can Evernote employees read your notes?" (01/09/2025); **novos planos e aumento de preço** + v3.3.0 com filtros de busca (04/10/2025); **Notesnook Circle** com Kagi (21/10/2025), Ente (05/11/2025), Addy.io (08/12/2025) e Tuta (15/12/2025); **v3.4.0 (29/06/2026)**: Inbox API E2EE, deep links `nn://`, desktop isolado/sandboxed, importadores ColorNote/UpNote, slugs para monographs; 3.4.x (jul–out/2026): localização (11 idiomas no mobile), widget de notas fixadas no Android. Roadmap planejado: multi-window, encrypted workspaces, contextual search, Extensions API, backups automáticos na nuvem e **auditoria de segurança de terceiros**.
10. **Forças, fraquezas e reclamações:**
    - Forças: "best opensource E2EE notes app" (AlternativeTo, 15/07/2026); sync fácil e app "minimalistic yet feature-rich", free generoso (AlternativeTo, 10/09/2026); segurança/2FA e app em Android/Windows (21/12/2025); comparado favoravelmente ao Standard Notes em preço e setup (review do Standard Notes, 14/01/2026).
    - Fraquezas/reclamações: bugs/instabilidade ("There is always a bug goiong on..", AlternativeTo, 20/09/2026); offline limitado no free (27/02/2026); publicação (monographs) com design fraco vs. Notion e export pago (2024 — export foi liberado no free em out/2025); fim do armazenamento ilimitado e aumento de preço (o próprio post justifica: "we have to raise our prices in order to keep moving forward") — reação de usuários [não verificada; Reddit inacessível]; ainda sem auditoria independente.
11. **Relevância para o Monet:**
    - Usa **TipTap**, como o Monet: é o benchmark direto de editor (block-level links + backlinks, callouts, outline lists, tabelas, matemática) dentro do mesmo stack.
    - Lição de negócio: "armazenamento ilimitado" na nuvem se mostrou insustentável e forçou planos escalonados; o Monet, local-first e sem servidor, evita esse custo e pode ser grátis de forma sustentável — vale explicitar isso como argumento.
    - Lacuna: zero IA e zero leitura/anotação de PDF; público de privacidade desconfia de IA "por promessa" — a IA BYOK do Monet, convocada e que não escreve sem confirmação, é uma resposta a essa desconfiança (comunicar que nada sai do PC sem ação do usuário, exceto as chamadas que ele mesmo faz ao provedor).

### 15. Gemini Notebook (ex-Google NotebookLM; renomeado em 16/07/2026)

1. **Posicionamento e público-alvo:** "AI-powered research assistant" que conversa com as fontes enviadas pelo usuário e as transforma em outros formatos (guias de estudo, áudio, vídeo, mind maps). O público é de estudantes, pesquisadores e profissionais do conhecimento. É um "caderno de fontes + IA", não um app de notas generalista. Segundo o próprio Google (jul/2026), são "more than 30 million people and over 600,000 organizations". Nasceu como Project Tailwind (I/O 2023). Em 16/07/2026 foi renomeado para **Gemini Notebook**: continua como produto standalone e também passou a existir dentro do app Gemini e (em breve) do AI Mode do Search.
2. **Modelo de organização:** lista plana de **notebooks**. Cada notebook tem três áreas: **Sources** (fontes + notas), **Chat** e **Studio** (artefatos gerados). Os limites de notebooks e de fontes variam por plano (ver item 8). Desde abr/2026, os notebooks também vivem no app Gemini, com sync bidirecional de fontes. Não há pastas, tags, links/backlinks, grafo nem databases [ausência de pastas/tags não verificada em fonte oficial]. Os Mind Maps são gerados a partir das fontes e não são um canvas livre.
3. **Editor:** as notas são simples: "Create note" (escrever ou colar texto) ou "Save to note" a partir de uma resposta do chat. Uma nota salva de uma resposta só pode ser editada depois que as citações são removidas. O app móvel "does not support note editing at this time". A ajuda não documenta rich text, slash commands, templates nem tabelas [não verificado]. As notas podem ser convertidas em fonte ("Convert" / "Convert all notes to source") e exportadas com "Export to Docs", gerando um Google Doc sem sincronia com a nota original.
4. **Estudo/leitura:**
   - **Fontes:** PDFs, sites, vídeos do YouTube, arquivos de áudio, Google Docs/Slides e texto colado. **EPUB** entrou em mar/2026.
   - **Descoberta de fontes:** "Discover sources" e **Deep Research**, que buscam fontes na web e geram relatórios com citações (fim de 2025, data exata não confirmada em fonte oficial).
   - **Studio:** Audio Overviews (80+ idiomas), Video Overviews (Cinematic desde mar/2026, só em inglês e nos planos Pro/Ultra), Mind Maps, Reports/Study guides, Infographics (10 estilos), Slide Decks (export PPTX/PDF) e Data Tables.
   - **Flashcards e Quizzes:** desde mar/2026 o progresso fica salvo entre sessões, com marcação "Got it/Missed it", embaralhar e refazer erros. É um SRS rudimentar, não repetição espaçada de verdade.
   - **O que não tem:** leitor com grifos/anotação de PDF (as citações apenas apontam o trecho da fonte) e web clipper oficial [não verificado; existem extensões de terceiros].
5. **Tempo/organização pessoal:** não tem daily notes, calendário, tasks nem lembretes. O mais próximo disso é o "Generate later", uma fila que gera artefatos pesados quando a cota volta (só na web).
6. **IA (2025–2026):**
   - **O que faz:** Q&A ancorado nas fontes com citações inline e artefatos de Studio. Desde mar/2026 também salva o histórico de chat e permite pedir artefatos direto do chat. Desde 16/07/2026 cada notebook ganhou um "secure cloud computer" que escreve e executa código para análise de dados "grounded in your sources" (primeiro no AI Ultra, depois no Pro). Os **Connected apps** já estão no ar na web: o chat aciona outros apps quando o usuário os menciona, com controle por notebook. A ajuda não lista quais apps são [não verificado].
   - **Onde vive:** o produto inteiro é a IA, nos três painéis (Sources/Chat/Studio), além dos notebooks dentro do app Gemini (abr/2026) e do AI Mode do Search (anunciado, sem data).
   - **Proativa vs. convocada:** predominantemente convocada (o usuário pergunta ou clica para gerar). Há porém traços proativos: a página de planos avisa que "Some users may see a report, flashcards, infographic, slide deck, audio overview, or a video overview created automatically" (esses artefatos não contam no limite).
   - **Chat com as notas (RAG):** sim, é o núcleo do produto. Cada fonte (inclusive nota convertida) tem checkbox para entrar ou sair do contexto, e as respostas trazem "citation chips" que levam ao trecho.
   - **Escreve direto no documento?** Não altera as fontes. Uma resposta só vira nota por ação explícita ("Save to note"), e os artefatos ficam separados no Studio. Recurso de "AI Editing" no editor de notas aparece só em rumores/teardowns e não foi confirmado como lançado [não verificado].
   - **Modelos:** a ajuda fala apenas em "Gemini's advanced reasoning". A Wikipedia cita Gemini 3.5 (jun/2026) e Nano Banana Pro para infográficos/slides [não verificado oficialmente].
   - **BYOK ou local:** não; só nuvem Google.
   - **Preço do add-on:** não existe add-on. A IA vem embutida, e os limites sobem conforme o plano Google AI ou Workspace.
   - **Privacidade:** conteúdo "will not be used to directly train our foundational AI models", exceto quando o usuário dá feedback. Em contas Workspace/Education, uploads, consultas e respostas não treinam modelos nem passam por revisão humana.
7. **Plataformas, offline, sync, E2EE, formato/export:**
   - **Plataformas:** navegador e apps Android/iOS. Não há app nativo para Windows/Mac: a ajuda diz "available in browser", e os clientes Electron que existem são não oficiais.
   - **Offline:** não [download de Audio Overviews para ouvir offline no mobile citado só por fonte secundária].
   - **Sync e E2EE:** sync na nuvem Google; sem E2EE.
   - **Export:** notas para Google Docs; slides para PPTX/PDF. Não encontrei export do notebook inteiro [não verificado].
8. **Preço (fonte, data):**
   - **Na página oficial** (https://gemini.google/subscriptions/, acessada em 2026-10-17), os preços renderizaram em BRL para a região do acesso: Free R$ 0; Google AI Plus R$ 24,99/mês; Google AI Pro R$ 96,99/mês; Google AI Ultra a partir de R$ 779,90/mês (segundo tier R$ 999,90). Na mesma página, empresas: Gemini Enterprise Business US$ 21 por licença/mês e Standard/Plus US$ 30.
   - **USD** [não verificado na página oficial; fonte 9to5Google, 08/06/2026]: Google AI Plus US$ 4,99/mês (antes US$ 7,99; corte em 08/06/2026, junto com o storage dobrado para 400 GB); Google AI Pro US$ 19,99/mês; Google AI Ultra com novo tier de US$ 99,99/mês, criado no I/O 2026, e tier topo de US$ 199,99/mês (antes US$ 249,99). Preço anual não verificado.
   - **Limites oficiais por plano** (support.google.com/gemininotebook/answer/16213268; ver tabela).
   - **Uso medido por compute desde set/2026:** a cota "refreshes every 5 hours until you reach your weekly limit". O Plus tem 2× o padrão, o Pro 4×, e o Ultra 5× ou 20× o Pro (answer/17670842). A data de 02/09/2026 vem de fontes secundárias.

| Tier | Notebooks | Fontes por notebook |
|---|---|---|
| Standard (grátis) | 100 | 50 |
| Plus | 200 | 100 |
| Pro | 500 | 300 |
| Ultra 20 TB | 500 | 500 |
| Ultra 30 TB | 500 | 600 |

9. **Mudanças e notícias 2025–2026:**
   - **10/02/2025:** NotebookLM Plus chega a indivíduos via Google One AI Premium (Wikipedia).
   - **2025:** Video Overviews (anunciado em mai/2025), Deep Research e Discover sources (fim de 2025), Infographics e Slide Decks (nov/2025) e Data Tables (dez/2025). As datas vêm da Wikipedia e de fontes secundárias [não verificado oficialmente].
   - **20/03/2026:** revisão de slides, Cinematic Video Overviews, 10 estilos de infográfico, progresso persistente de flashcards/quizzes, EPUB como fonte, export PPTX, histórico de chat salvo e artefatos pedidos pelo chat (Google Workspace Updates).
   - **08/04/2026:** notebooks no app Gemini com sync de fontes com o NotebookLM, primeiro para assinantes Plus/Pro/Ultra na web (blog.google).
   - **mai–jun/2026:** reestruturação de preços. Novo Ultra de US$ 99,99, Ultra topo cai para US$ 199,99 e AI Plus cai para US$ 4,99 em 08/06 (9to5Google).
   - **16/07/2026:** rename para **Gemini Notebook**, code execution em "secure cloud computer" e integração com o app Gemini e o Search (blog.google; TechCrunch: "Google continues its renaming streak").
   - **jul/2026:** Short Video Overviews de 60 s (Wikipedia) [não verificado].
   - **set/2026:** fim dos limites diários fixos e entrada da cota por compute com reset de 5 h e teto semanal (help oficial; data por fontes secundárias).
   - **2026:** o jornalista David Greene processou o Google alegando que o recurso de podcast reproduziu sua voz; o Google nega (Wikipedia) [não verificado em fonte primária].
10. **Forças, fraquezas e reclamações:**
    - **Força: avaliação e uso para estudo.** No iOS o app tem 4,9★ com 63K avaliações. Exemplos de reviews: "Learning at 37,000 mph" (estuda o tema como podcast, visual ou quiz no dia seguinte) e um homeschooler com TDAH que diz que o app cortou o tempo de anotação "roughly in half" (App Store, 2026).
    - **Força: ancoragem nas fontes.** As citações clicáveis e a geração de material de estudo a partir das fontes são o diferencial.
    - **Fraqueza: notas são cidadãs de segunda classe.** Nota salva só é editável sem citações, não se edita nota no mobile e não há hierarquia (help oficial).
    - **Fraqueza: limites opacos.** Com a cota por compute, o Google não publica números absolutos, o que torna o uso "harder to plan around" (progressiverobot.com, 05/10/2026).
    - **Crítica: Audio Overviews achatam o conteúdo.** Elas impõem um formato padrão, inclusive inserindo referências americanas fora de contexto (Rettberg, 2026, via Wikipedia).
    - **Reclamação: notificações insistentes** pedindo review (App Store, 25/07).
    - **Fraqueza: dependência da nuvem.** Sem offline, sem app desktop e sem E2EE. A troca de nome também gera ruído [observação; TechCrunch fala em "renaming streak"].
    - **Lacuna desta pesquisa:** threads do Reddit (r/notebooklm) não puderam ser lidas.
11. **Relevância para o Monet:**
    - **Inspira:** a IA ancorada em fontes, com citações e checkbox de quais fontes entram no contexto, e o "Save to note" explícito batem com a tese do Monet (IA convocada; nada entra na nota sem o botão "Anotar/Inserir"). Flashcards/quizzes gerados a partir de um capítulo ou de uma pasta seriam um bom /comando no Monet, como saída descartável ou nota aceita pelo usuário.
    - **Evitar:** artefatos "created automatically" (proatividade), notas pobres e dependência total da nuvem.
    - **Lacuna que o Monet ocupa:** o NotebookLM não é leitor (sem grifos coloridos nem anotação de PDF/EPUB), não tem um sistema durável de notas (cadernos > matérias > notas), não tem app Windows nem offline, e não aceita BYOK. O Monet cobre "ler, grifar, fichar e perguntar" num app local.

### 16. Anytype

1. **Posicionamento e público-alvo:** "A safe haven for digital collaboration". É um workspace local-first, com E2EE e código-fonte disponível ("source-available", não open source pela definição OSI, segundo a própria equipe no AlternativeTo), visto como alternativa privada ao Notion. Atende entusiastas de privacidade e PKM e, desde 2025, pequenos grupos (chats/channels). Em jan/2025 a empresa dizia que o protocolo AnySync tinha ~20 mil usuários diários e ~80 mil mensais. A última rodada pública foi de US$ 13,4 mi (ago/2023).
2. **Modelo de organização:**
   - **Estrutura:** **Vault** > **Channels** (a doc diz "also referred to as a Space", o que indica troca de nomenclatura de Space para Channel, sem data confirmada). Cada Channel pode ser Personal ou Group e tem Objects, Types e Properties próprios, criptografados separadamente.
   - **Objetos tipados:** tudo é **Object** com **Type** e **Properties**.
   - **Agrupamento e views:** **Queries** (antigos Sets) e **Collections** com Views (grid, kanban, calendar, gallery etc.), Advanced Filters (AND/OR, fev/2026) e Formulas.
   - **Navegação:** **Graph**, widgets na sidebar, sidebar em árvore "Tree" (v0.57.4, 03/10/2026), links e mentions entre objetos.
   - **Datas:** **Date Objects** funcionam como "temporal index" do dia.
3. **Editor:**
   - **Blocos:** texto, H1–H3, quote, callout, code, toggle, toggled heading, listas, checkbox, table, columns, TOC, divisor e blocos de propriedade.
   - **Referências e embeds:** inline query/collection/chat; LaTeX, Mermaid, Excalidraw, YouTube, Figma, Miro.
   - **Atalhos:** slash menu (/table, /file, /date) e atalhos Markdown.
   - **Templates:** por Type (doc de Templates). Abas (tabs) chegaram em fev/2026 (Desktop 0.54 "Focus & Flow").
4. **Estudo/leitura:**
   - **Arquivos:** viram File Objects. Há bloco de PDF, além de players de áudio e vídeo.
   - **O que a doc não cita:** anotação ou grifo de PDF, transcrição e flashcards/SRS.
   - **Web clipper:** a doc não cita. O AlternativeTo lista "Google Chrome" entre as plataformas [extensão oficial não verificada].
5. **Tempo/organização pessoal:**
   - **Datas e calendário:** Date Objects reúnem tudo que foi criado, modificado ou mencionado no dia, e o usuário pode escrever o diário dentro dele. Não há daily notes dedicadas. Qualquer Query ou Collection com propriedade de data vira Calendar view com drag-and-drop de datas.
   - **Tarefas:** via Type Task/checkbox.
   - **Lembretes:** "block-based reminders" estavam previstos para o release de meados de abr/2026 (blog, fev/2026) [lançamento não verificado].
6. **IA (2025–2026):**
   - **O que faz:** não há assistente de IA embutido. A estratégia declarada (fev/2026) é escolha do usuário: "no AI, local AI, cloud AI, or a hybrid". A integração acontece por **Local API** (desde 0.46.x, 2025), **Anytype MCP Server** (open source; Claude Desktop/Code, Cursor, Windsurf, Raycast, LM Studio) e **Anytype Agents' Skill**, um kit para Claude Code, Cursor, Gemini CLI e GitHub Copilot ler, buscar e modificar Objects via scripts num runtime isolado. Há ainda um protótipo experimental de agente local com chave de API à escolha do usuário (blog, fev/2026). O "import v2" ganhou um "AI provider dropdown" na v0.57.0 (22/09/2026) [função exata não verificada].
   - **Onde vive:** fora do app, em agentes externos.
   - **Proativa vs. convocada:** convocada (o usuário roda o agente).
   - **Chat com as notas (RAG):** só por agentes externos via API/MCP.
   - **Escreve direto no documento?** Sim, se o usuário der chave com permissão: o agente pode criar, editar e até apagar objetos. A doc recomenda revisar scripts e usar chave separada.
   - **Modelos:** os do cliente do usuário.
   - **BYOK ou local:** sim, de fato (cliente/chave do usuário), com IA local planejada.
   - **Preço do add-on:** não há.
7. **Plataformas, offline, sync, E2EE, formato/export:**
   - **Plataformas:** Windows, macOS, Linux (Flatpak), iOS, Android, além de self-host via Docker. Não há editor web [não verificado].
   - **Offline e sync:** local-first, "the app always works without an internet connection". Sync P2P na rede local, backup criptografado na Anytype Network (nós na UE), modo **Local-only** e **self-host**.
   - **E2EE:** sim. As chaves são geradas no dispositivo e "never sent to Anytype". Perder a chave significa perder os dados.
   - **Export:** Markdown, Any-Block, PDF e HTML, em JSON ou Protobuf. Só no desktop, e chats/discussions não exportam. Há import de Notion, Obsidian e Evernote.
8. **Preço (fonte, data):**
   - **Página oficial:** https://anytype.io/pricing não renderizou (conteúdo via JS) em 2026-10-17. A doc oficial confirma "a Free tier plus several paid plans", preços em USD, 50% de desconto para estudantes/docentes e um tier B2B/educacional futuro.
   - **Terceiros** [não verificado na página oficial]: a comparação fahimai.com ("pricing verified January 2026") lista Plus US$ 4/mês, Pro US$ 8/mês e Ultra US$ 16/mês. O AlternativeTo dá a faixa "US$ 4 a 20/mês". A App Store (EUA) lista IAP "Pro US$ 9,99" e "Builder US$ 119,00", sem periodicidade exibida.
   - **Histórico (2024):** Creator/Builder US$ 99/ano (128 GB) e Co-Creator US$ 299/3 anos (doc RU, abr/2024).
   - **Free:** o limite do backup remoto vale só para arquivos ("Objects don't count toward the limit").
9. **Mudanças e notícias 2025–2026:**
   - **08/01/2025:** plano anual com publicação na web (jan), chats/discussions/notificações (a partir de fev), API e integração de IA local em early access (fev) e login por e-mail.
   - **2025:** Local API (0.46.x), MCP server e extensão Raycast.
   - **19/02/2026:** Desktop 0.54 com tabs, filtros avançados e toggled headings. Roadmap em ciclo de ~2 meses e proposta de "Collections 2.0" (objetos sem tipo único).
   - **22/09/2026:** v0.57.0 com busca global entre channels, busca em chats, export AnyBlock v2 (Preview), import v2 e grants de API por espaço.
   - **03/10/2026:** v0.57.4 com sidebar em árvore.
10. **Forças, fraquezas e reclamações:**
    - **Forças:** privacidade e local-first ("Fast, easy to use and privacy-focussed with a local-first approach", AlternativeTo, 11/12/2025). App Store: 4,5★ com 250 avaliações ("similar to Notion or Craft but private", 02/08/2025).
    - **Sync:** um usuário relatou arquivos "untitled" vazios e itens de coleção sem sincronizar entre iPhone, MacBook e iMac e parou de usar (App Store, 26/08/2025).
    - **Edição:** copy-paste entre blocos desajeitado e listas aninhadas lentas (App Store, 06/11/2025).
    - **Curva de aprendizado:** "steep learning curve, confusing terminology" (resumo do AlternativeTo).
    - **Licença e telemetria:** debate "source-available ≠ open source" e telemetria Amplitude obrigatória no beta (AlternativeTo, 2023/2025).
    - **Confusão de conceito:** "could have been the perfect Notion alternative", mas "built around crypto ideas" (1/5, AlternativeTo, 19/02/2026; um usuário rebate que é IPFS/P2P, não cripto).
    - **Lacuna desta pesquisa:** Reddit (r/Anytype) não pôde ser lido.
11. **Relevância para o Monet:**
    - **Inspira:** o Date Object como "índice temporal" (a página do dia lista o que foi criado, modificado ou mencionado). O Calendar do Monet poderia mostrar na nota diária as notas e grifos daquele dia sem IA. A postura "no AI / local / cloud / hybrid, on the user's terms" e a interoperabilidade por Local API + MCP também combinam com BYOK. Expor um MCP local do Monet seria coerente.
    - **Evitar:** abstração e terminologia demais (Types/Relations/Sets→Queries, Spaces→Channels) e bugs de sync, que geram atrito para quem só quer estudar.
    - **Lacuna:** sem leitor PDF/EPUB com grifos e sem IA integrada ao fluxo de leitura e fichamento.

### 17. AFFiNE

1. **Posicionamento e público-alvo:** "Write, Draw, Plan, All at Once. With AI." É uma alternativa open source e local-first a Notion + Miro, juntando docs, whiteboard, databases e IA. Atende indivíduos (uso pessoal grátis) e equipes (cobrança por assento ou self-host). Tem ~73,6 mil estrelas no GitHub (out/2026) e um Discord com "7k+ users". Um review de terceiros (jun/2026) fala em "200K+ Pro users" [não verificado].
2. **Modelo de organização:**
   - **Estrutura:** workspaces (locais ou na nuvem) > docs, com collections, tags e links entre docs.
   - **Dois modos:** cada doc tem **Page** (linear) e **Edgeless** (canvas infinito com shapes, conectores, frames e slides). São duas views do mesmo doc.
   - **Databases:** multi-view, incluindo kanban e, desde a 0.27, Calendar View.
   - **Journals:** existem diários (citados por usuários como "split view and journal", fev/2025) [doc oficial não verificada].
   - **Ícones:** doc icons desde a 0.25.
3. **Editor:**
   - **Base:** blocos (BlockSuite), slash commands, Markdown, code, LaTeX, Mermaid, Typst, HTML block e embeds.
   - **Templates:** Cornell notes, checklists, storyboards etc.
   - **Colaboração:** comentários com menções (0.23) e colaboração em tempo real.
   - **Import:** importadores de Notion, Obsidian, Bear e OneNote (0.27).
4. **Estudo/leitura:**
   - **PDF:** PDFs como anexo com visualizador; a 0.26 melhorou a renderização de arquivos grandes. A IA resume PDFs e vídeos. Grifos e anotação em PDF não foram encontrados [não verificado].
   - **Áudio:** gravação de áudio no Windows (0.23) e "recording stability" (0.27). Transcrição e notas de reunião por IA [não verificado].
   - **Flashcards/SRS:** não. Os posts sobre flashcards no blog são conteúdo de SEO, não recurso do app.
   - **Web clipper:** [não verificado].
5. **Tempo/organização pessoal:**
   - **Diário:** Journals.
   - **Calendário:** integração "Cloud Calendar" com Google Calendar e CalDAV (0.26, 06/02/2026) e Calendar View em databases (0.27).
   - **Tarefas:** via checkboxes, databases e kanban.
   - **Lembretes:** [não verificado].
6. **IA (2025–2026):**
   - **O que faz:** chat, edição inline (tom, ortografia, resumo), geração de mind maps, apresentações (Beta), "Make it Real" (Beta) e imagens. Cronologia:
     - **0.22 (04/06/2025):** "AI workspace embedding" e "AI search & reason".
     - **0.23 (15/07/2025):** painel de chat independente com histórico, ferramenta de busca em docs, "code artifact tool" e "comment-based AI editing tool".
     - **0.24 (11/08/2025):** embedding de anexos, chave "all docs" e MCP server básico.
     - **0.25 (13/10/2025):** MCP para Cursor ler o workspace e **"AI blocks" inseridos direto no corpo do doc**.
     - **Em breve:** "auto-sorting and tagging" ("Coming soon").
   - **Onde vive:** sidebar (chat), inline ("Ask AI" na toolbar de seleção) e canvas Edgeless (menu de elementos ou clique direito).
   - **Proativa vs. convocada:** convocada hoje. O auto-sorting/tagging anunciado seria proativo.
   - **Chat com as notas (RAG):** sim, via workspace embedding com escopo de docs ou de tudo.
   - **Escreve direto no documento?** Sim. Há "Insert" / "New block", AI blocks no texto principal e edição por comentários.
   - **Modelos:** Claude Sonnet 4.5 e Gemini 2.5 Pro selecionáveis desde a 0.25 (out/2025). Os demais não foram confirmados.
   - **BYOK ou local:** "AI BYOK feature" experimental desde a 0.27 (15/07, ano não exibido; provavelmente 2026). A IA ainda exige login no AFFiNE Cloud ("AFFiNE AI currently runs through AFFiNE Cloud"). Há suporte a Gemma planejado para IA local.
   - **Preço do add-on:** AFFiNE AI custa US$ 8,90/mês com cobrança anual, e cada usuário de nuvem tem 10 usos grátis de teste.
   - **Privacidade:** conteúdo relacionado é enviado a "third-party AI vendors" só quando se usa IA. Um usuário reclamou que "Data sent to AI is not anonymized" e que não há opt-out de treino (AlternativeTo, nov/2024; opinião de usuário).
7. **Plataformas, offline, sync, E2EE, formato/export:**
   - **Plataformas:** Windows 10+ (x64 e ARM64), macOS, Linux (AppImage, deb, Flatpak), iOS, Android e web (app.affine.pro). A versão estável era a 0.27.4 em out/2026.
   - **Local-first e sync:** CRDT (y-octo/Yjs). Workspace local no desktop funciona offline, workspace no navegador depende do storage do site, e o sync entre dispositivos exige AFFiNE Cloud ou servidor self-host (Docker; Community Edition MIT).
   - **E2EE:** não documentado no README nem no guia [não verificado].
   - **Export:** Markdown, HTML, Snapshot (reimportação), PDF (pela impressão) e imagem do canvas. O guia avisa que Markdown não captura o canvas.
8. **Preço (fonte, data):** https://affine.pro/pricing, acessado em 2026-10-17. O toggle diz "Billed Annually Saving 15%", e o preço mensal sem desconto não aparece.

| Plano | Preço | Inclui |
|---|---|---|
| Free (Local FOSS + Cloud Basic) | grátis | 10 GB, 3 membros, 7 dias de histórico, arquivo de até 10 MB |
| **Pro** | **US$ 6,75/mês** (cobrança anual) | 100 GB, 10 membros, 30 dias de histórico |
| Team | US$ 10 por assento/mês | 100 GB + 20 GB por assento |
| Believer | US$ 499,99 (vitalício) | 1 TB |
| AFFiNE AI (add-on) | US$ 8,90/mês (cobrança anual) | IA |
| Self-hosted FOSS | grátis | — |
| Self-hosted Team | US$ 10 por assento/mês | — |
| Enterprise | sob consulta | — |

9. **Mudanças e notícias 2025–2026** (as datas do GitHub não exibem o ano; ano inferido pela sequência de versões e pelos modelos citados):
   - **2025:** 0.22 (04/06/2025, IA com embedding do workspace), 0.23 (15/07/2025, painel de IA e comentários), 0.24 (11/08/2025, MCP server) e 0.25 (13/10/2025, Claude Sonnet 4.5/Gemini 2.5 Pro e AI blocks).
   - **2026:** 0.26 (06/02/2026, Google Calendar/CalDAV, indexação local nativa, PDF mais rápido) e 0.27 (15/07/2026 provável, BYOK experimental, Calendar View, importadores). Desde set/2026 as canary usam versionamento por data (2026.10.x). Em 07/10/2026 uma canary corrigiu uma CVE crítica na dependência piscina.
10. **Forças, fraquezas e reclamações:** nota 3,3/5 com 10 avaliações e 129 likes no AlternativeTo.
    - **Força: self-host fácil.** "Easy, open source, easy self hostable" (02/12/2025).
    - **Força: whiteboard e escrita à mão.** Usuários também elogiam o "split view and journal" (28/02/2025).
    - **Fraqueza: desempenho e estabilidade.** "Very slow compared to alternatives" (22/11/2025). Outro usuário relata que o frontend travava a cada ~20 min em self-host (07/03/2026).
    - **Crítica: "open washing".** "Open washing, this isnt FOSS" (22/05/2026). O AlternativeTo classifica o app como "Proprietary and Freemium".
    - **Fraqueza: export limitado** e prévia de anexos fraca.
    - **Fraqueza: sync exige conta ou servidor próprio.**
    - **Lacuna desta pesquisa:** Reddit (r/Affine) não pôde ser lido.
11. **Relevância para o Monet:**
    - **Inspira:** Page/Edgeless como duas views do mesmo conteúdo. Um canvas opcional para mapa de um livro ou curso, ligado às notas, seria um diferencial de estudo. MCP e BYOK chegando ao AFFiNE confirmam a tendência que o Monet já segue.
    - **Evitar:** IA que insere "AI blocks" direto no corpo e auto-tagging proativo (contrário à tese de notas perenes) e escopo inchado (docs + whiteboard + DB + IA), que gera reclamações de lentidão e instabilidade.
    - **Lacuna:** sem leitor com grifos e sem fluxo de fichamento. A IA é cobrada à parte e exige a nuvem deles.

### 18. Radar: outros nomes 2025–2026 (fora do escopo generalista; sem os 11 itens)
- **Obsidian (PKM, local-first, Markdown):** o app é grátis ("Free without limits", sem cadastro). Sync custa US$ 4/mês no anual ou US$ 5 no mensal, Publish US$ 8/US$ 10, e a licença comercial (US$ 50/ano) é opcional ("not required"). Tem Windows. É o padrão-ouro de "dados em arquivos". Fonte: https://obsidian.md/pricing (acessado em 2026-10-17).
- **Capacities (PKM de objetos; tem Windows):** Basic grátis sem IA. Pro US$ 11,99/mês ou US$ 9,99/mês no anual; Believer US$ 14,99 ou US$ 12,49/mês no anual; add-on Plus de US$ 8,33/mês (anual) para mais orçamento de IA. Pro e Believer incluem assistente de IA e "AI Chat Connectors" para ChatGPT, Claude e Cursor. BYOK não é citado. Fonte: https://capacities.io/pricing (acessado em 2026-10-17).
- **Mem (IA-nativo, proativo):** agora são "Mem Workspace" + "Mem Agent", e o agente "Learns what matters from what you save and checks in when something needs you". Detecta tarefas automaticamente e tem Voice Mode e Routines. Planos: Free, Plus US$ 9/mês, Pro US$ 29/mês e tiers de US$ 49 a 199/mês. É o oposto da tese do Monet. Fonte: https://get.mem.ai/pricing (acessado em 2026-10-17).
- **Reflect (pivô para open source):** hoje é **"Reflect Open"**, open source, com Markdown local em pasta escolhida, daily notes e backlinks. A IA é opcional **só com chave própria (BYOK)**, e notas privadas ficam fora da IA. O Mac é grátis, iPhone/iPad são pagos, e não há Windows. Os assinantes "Reflect Classic" ganharam 1 ano do app iOS [data do pivô não verificada]. Fonte: https://reflect.app/ (acessado em 2026-10-17).
- **Granola (notas de reunião, IA):** "The AI notepad for back-to-back meetings", sem bot, para macOS, Windows, iOS e Android, com conector MCP. Captou **US$ 125 mi em Series C liderada pela Index (25/03/2026), com valuation de US$ 1,5 bi**. É o segmento que mais atrai capital, mas não é generalista. Fontes: https://www.machinebrief.com/news/granola-secures-dollar125m-to-bolster-ai-driven-note-taking-o7kq e https://www.granola.ai/ (acessados em 2026-10-17).
- **Goodnotes (manuscrito/estudo):** tem app Windows na Microsoft Store, mas sem o conjunto completo do iPad e ainda sem sync iPad↔Windows; Goodnotes AI está entre os "upcoming" no Windows. Preços anuais: Essential US$ 11,99, Pro US$ 35,99, e **AI Pass +US$ 9,99/mês**. Fontes: https://www.goodnotes.com/windows e https://www.goodnotes.com/pricing (acessados em 2026-10-17).
- **Samsung Notes (mainstream no ecossistema Galaxy):** existe na Microsoft Store como app grátis. A restrição a Galaxy Book e os recursos Galaxy AI não foram verificados [não verificado]. Fonte: https://apps.microsoft.com/detail/9nblggh43vhv (acessado em 2026-10-17).
- **Amplenote (notas + tarefas + calendário):** o site bloqueou o acesso automatizado (HTTP 403), então não foi possível verificar preços nem novidades [não verificado]. Fonte: https://www.amplenote.com/ (tentativa em 2026-10-17).
- **Heptabase (PKM visual voltado a estudo/pesquisa; tem Windows):** Pro US$ 8,99/mês, com **PDF highlights**, transcrições de YouTube, agente de IA só com Gemini e 100 créditos/mês. Premium US$ 17,99/mês (GPT/Claude/Gemini, "AI tutor", 1.800 créditos) e Premium+ US$ 53,99/mês. O anual tem 25% de desconto. É o concorrente mais próximo da persona de estudo do Monet fora dos generalistas. Fonte: https://heptabase.com/pricing (acessado em 2026-10-17).
- **Saner.ai (IA-nativo, "personal AI assistant" com notas e tarefas):** Free, Starter US$ 8/mês e Standard US$ 16/mês. Acesso a IAs externas cobradas à parte ou por chave própria. Funciona em web, mobile e extensão Chrome, sem app Windows citado. Fonte: https://www.saner.ai/pricing (acessado em 2026-10-17).
- **Google AI Edge Foresight (vitrine, não produto):** app Mac de notas de reunião 100% on-device (EmbeddingGemma 2, Apache 2.0), anunciado em 06/10/2026, com modo "Live Assistance" que responde automaticamente. Sinaliza que notas com IA local estão chegando. Fonte: https://9to5google.com/2026/10/06/google-ai-edge-foresight/ (acessado em 2026-10-17).
- **Nenhum generalista novo com tração clara** apareceu nas buscas de 2025–2026. O dinheiro e a imprensa estão em notas de reunião e hardware de captura (Granola; Plaud, jan/2026; Pocket, US$ 11 mi, jun/2026), segundo resultados de busca da sessão principal. Fonte: https://techcrunch.com/2026/06/29/pocket-raises-11m-in-bet-on-rising-demand-for-ai-note-taking-devices/ (via resultado de busca).

---

## (c) Tabela comparativa

Valores em USD, salvo indicação, conferidos em 2026-10-17. "[sec.]" indica fonte secundária. As linhas completas e os detalhes estão nas seções da parte (b).

| App | Organização | IA (convocada/proativa) | Offline / local-first | Windows | E2EE | Preço de entrada pago | Destaque |
|---|---|---|---|---|---|---|---|
| **Notion** | Páginas aninhadas + blocos + databases (views, relations); backlinks | **Híbrida/proativa.** Agente convocado + Custom Agents e Autofill autônomos; edita direto por padrão (Plan Mode e Suggest edits são opcionais) | Cloud-first; offline parcial desde 19/08/2025 (só apps, por página) | Sim (app desktop) | Não | Plus US$ 10/membro/mês (anual; ~US$ 12 mensal [sec.]). IA completa só no Business, US$ 20 (anual) | Agentes multi-modelo + databases + integrações |
| **Evernote** | Cadernos > stacks + tags + Spaces; links/@mentions | **Convocada** (painel, ✨AI, AI Prompts por "/"); Edit mode com aceitar/rejeitar; toques proativos (transcrição, calendário) | Nuvem obrigatória; offline parcial; sync limitado por plano | Sim (desktop + MS Store) | Não (só trecho com senha) | Starter ~US$ 99/ano ou ~US$ 14,99/mês [sec.] | Captura/OCR/áudio + AI Assistant (OpenAI) + MCP; free de 50 notas |
| **Microsoft OneNote** | Notebooks > section groups > sections > pages (canvas livre) + Note Tags | **Convocada** (painel Copilot; "Copy"/"Add to doc"); escopo da página | Cache offline; nuvem OneDrive (notebook local só no desktop Windows) | Sim (desktop; app do Windows 10 encerrado em 14/10/2025) | Não (seções com senha) | Grátis; Copilot via Microsoft 365 Personal US$ 9,99/mês ou US$ 99,99/ano | Tinta e canvas livre, presente em todas as escolas; formato .one fechado |
| **Apple Notes** | Pastas + tags + Smart Folders + links entre notas | **Convocada** (Writing Tools na seleção, resumo de gravações); Siri AI (iOS 27) cria e edita por comando | Sim (dados locais + iCloud) | **Não** (só iCloud.com) | Opcional (Advanced Data Protection) | Grátis; iCloud+ a partir de US$ 0,99/mês | Captura nativa, transcrição de áudio, Pencil/Math Notes |
| **Google Keep** | Cartões + labels + cores (sem pastas/links) | **Convocada** (lista por prompt; Keep Live por voz cria e edita notas); só Android e planos Google AI | Parcial (apps móveis) | **Não** (web/Chrome) | Não | Grátis; IA via Google AI Pro ~US$ 19,99/mês [sec.] (Keep Live também no Plus [sec.]) | Captura, listas e lembretes ultrarrápidos |
| **Bear** | Tags aninhadas + wiki-links/backlinks + Tag as Workspace (sem pastas) | **Sem IA nativa.** IA externa convocada via BearCLI/MCP/Claude Connector (macOS), com escopo por tags | Sim (banco local + iCloud) | **Não** (Bear Web em beta, online) | Via iCloud ADP + criptografia por nota (Pro) | Pro US$ 2,99/mês ou US$ 29,99/ano | Markdown elegante, export aberto, MCP local com escopo |
| **Craft** | Spaces > pastas > docs/blocos + Collections (table/gallery/kanban) + tags; Daily Notes | **Convocada** (modo Explore propõe e espera aprovação; Execute aplica direto); BYOK + modelos locais | Apple: sim [não verificado]; Web/Windows/Android: offline em beta (17/02/2026) | Sim (recursos chegam atrasados) | Ambíguo [não verificado] | Plus US$ 9,99/mês ou US$ 95,99/ano (App Store EUA) | Design premium + BYOK/local/MCP + Daily Notes/Tasks/Calendar |
| **UpNote** | Notebooks aninhados + tags + Spaces | **Sem IA** | Offline, com sync via Firebase | Sim (nativo + MS Store; assinatura não é feita pelo Windows) | Não | US$ 1,99/mês ou US$ 39,99 vitalício | Simplicidade estilo Evernote + vitalício barato |
| **Joplin** | Notebooks aninhados + tags + whiteboards (3.7) | **Convocada, opt-in, desligada por padrão** (beta desktop); BYOK OpenAI/Anthropic/OpenRouter + local (Ollama/LM Studio); edita a nota direto (Ctrl+Z) | **Sim (local-first;** sync opcional) | Sim | Sim (opcional) | Joplin Cloud € 2,99/mês ou € 28,69/ano (app grátis) | Open source + IA BYOK/local + embeddings locais + MCP |
| **Standard Notes** | Tags aninhadas como pastas + Smart Views + note types | **Sem IA** | Sim (offline; sync E2EE) | Sim | **Sim (auditada)** | Productivity US$ 90/ano (só anual exibido) | E2EE auditada e longevidade (Proton) |
| **Simplenote** | Lista + tags + pin (texto puro, Markdown opcional) | **Sem IA nativa;** MCP oficial com escrita opt-in e guardas | Offline nos apps; conta e sync Simperium obrigatórios | Sim (Electron/MS Store) | Não (nem em repouso) | Grátis (não há plano pago) | Simplicidade grátis; "no longer in active development" |
| **Microsoft Loop** | Workspaces > páginas > componentes portáteis (Teams/Outlook/OneNote) | **Convocada** (o Copilot só insere via "Insert" e não lê o workspace) | **Não** (online-only) | Só web/PWA | Não | Grátis (conta pessoal, sem Copilot); Copilot Business US$ 21/usuário/mês (anual) | Componentes vivos dentro do Microsoft 365 |
| **Zoho Notebook** | Notebooks com capas > note cards + Collections + tags + Noteboards | **Convocada** (resultado para revisão: inserir ou substituir); toques proativos (detecção de reuniões e gravações) | Nuvem Zoho (não é local-first) | Sim (também Mac e Linux) | Não | Pro ~US$ 1,99/mês ou US$ 19,99/ano [sec.]; IA só no Pro Plus/Business [valores não verificados] | Grátis sem anúncios, cards visuais, IA grátis para estudantes, MCP |
| **Notesnook** | Notebooks aninhados + tags + cores + links/backlinks de bloco | **Sem IA** | Sim (offline; sync E2EE) [full offline por plano: não verificado] | Sim | Sim (sem auditoria externa) | Essential US$ 1,99/mês ou US$ 19,99/ano | E2EE open source com editor TipTap |
| **Gemini Notebook** (ex-NotebookLM) | Notebooks de fontes (Sources/Chat/Studio) + notas simples | **Convocada** (chat/Studio); alguns artefatos gerados automaticamente; não altera as fontes; "Save to note" explícito | **Não** (nuvem) | **Só navegador** | Não | Google AI Plus ~US$ 4,99/mês [sec.] (plano grátis generoso) | IA ancorada em fontes com citações + Audio/Video Overviews, flashcards |
| **Anytype** | Objetos tipados (Types/Properties) em Channels; Queries/Collections; grafo; Date Objects | **Sem IA embutida;** agentes externos via Local API/MCP (BYOK de fato) | **Sim (local-first,** P2P, local-only, self-host) | Sim | Sim | ~US$ 4/mês [não verificado] | Local-first + E2EE com objetos estilo Notion |
| **AFFiNE** | Workspaces > docs em modo Page + Edgeless (canvas) + databases + journals | **Convocada,** mas insere AI blocks no doc; BYOK experimental | **Sim (local-first CRDT;** nuvem opcional; self-host) | Sim (x64/ARM64) | Não documentado | Pro US$ 6,75/mês (anual); IA +US$ 8,90/mês | Docs + whiteboard open source, com self-host |

**Leitura rápida da tabela:**
- **Windows nativo + local-first + IA nativa convocada com BYOK/local:** só o Joplin 3.7 junta as três, ainda em beta e com a IA editando a nota direto. O AFFiNE tem BYOK experimental, mas a IA ainda passa pela AFFiNE Cloud. O Anytype deixa a IA para agentes externos.
- **Apps centrados em E2EE:** Standard Notes e Notesnook não têm IA.
- **E2EE e IA juntos:** o Joplin tem E2EE opcional e IA com opção local. O Apple Notes combina E2EE opcional (ADP) com IA majoritariamente on-device.
- **Leitor PDF/EPUB com grifos ligados a notas como citações:** nenhum dos 17.

---

## (d) Fontes

Todas acessadas em 2026-10-17, salvo indicação. Quando a página não pôde ser lida, o conteúdo veio do resultado de busca, e isso está indicado. Os comentários de sentimento de usuário foram tirados de Trustpilot, App Store, AlternativeTo e fóruns oficiais, porque o Reddit ficou inacessível.

### Fontes transversais (resumo executivo)
- Pew Research Center — "How Americans View AI and Its Impact on People and Society" (17/09/2025; n=5.023, campo 09–15/06/2025) — https://www.pewresearch.org/science/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/ — acessado em 2026-10-17
- CO/AI (getcoai) — resumo do survey ZDNET-Aberdeen/YouGov (campo 06–10/03/2025, n=2.354), "Most Americans aren't that into AI…" (07/05/2025) — https://getcoai.com/news/most-americans-arent-that-into-ai-but-they-do-like-it-for-photo-editing — acessado em 2026-10-17 [sec.]
- eMarketer — "AI assistants face consumer skepticism, value concerns" (cita o survey ZDNET-Aberdeen) — https://www.emarketer.com/content/ai-assistants-face-consumer-skepticism-value-concerns — via resultado de busca (fetch 403)
- eMarketer — "Consumers unwilling to pay for AI features" (CNET/YouGov 2025: 50% dos donos de smartphone nos EUA não pagariam a mais por IA) — https://www.emarketer.com/content/consumers-unwilling-pay-ai-features-1 — via resultado de busca (fetch 403) [não verificado na fonte primária]
- The Register — "Notepad will now tell you all the ways Microsoft has enshittified it" (22/01/2026) — https://www.theregister.com/2026/01/22/microsoft_notepad_update/ — acessado em 2026-10-17
- BleepingComputer — "Microsoft updates Notepad and Paint with more AI features" (22/01/2026) — https://www.bleepingcomputer.com/news/microsoft/microsoft-updates-notepad-and-paint-with-more-ai-features — acessado em 2026-10-17
- TechRadar — "Windows 11's Notepad gets support for tables and bolstered AI powers – and not everyone's happy" — https://www.techradar.com/computing/windows/windows-11s-notepad-gets-support-for-tables-and-bolstered-ai-powers-and-not-everyones-happy — título via busca (o corpo não renderizou)
- 9to5Mac — "Rewind/Limitless: Meta acquisition" (05/12/2025) — https://9to5mac.com/2025/12/05/rewind-limitless-meta-acquisition/ — via resultado de busca
- PCWorld — "Microsoft follows Google with price bump, forced AI 365 bundles" (jan/2025) — https://www.pcworld.com/article/2581179/microsoft-follows-google-with-price-bump-forced-ai-365-bundles.html — via resultado de busca
- Notion Blog — "100 Million of You" (Ivan Zhao, 03/09/2024) — https://www.notion.com/blog/100-million-of-you — acessado em 2026-10-17
- TechCrunch — "Pocket raises $11M in bet on rising demand for AI note-taking devices" (29/06/2026) — https://techcrunch.com/2026/06/29/pocket-raises-11m-in-bet-on-rising-demand-for-ai-note-taking-devices/ — via resultado de busca
- TechCrunch — "Plaud launches a new AI pin and a desktop meeting notetaker" (04/01/2026) — https://techcrunch.com/2026/01/04/plaud-launches-a-new-ai-pin-and-a-desktop-meeting-notetaker/ — via resultado de busca
- Android Authority — enquete "Obsidian alternatives" (~2.600 votos; Notion 23,7%, Keep 18,9%; amostra autosselecionada) — https://www.androidauthority.com/obisidian-alternatives-poll-results-3583611/ — via resultado de busca (sinal fraco, não usado nas conclusões)

### Fontes por app

#### Notion
- Notion Pricing — https://www.notion.com/pricing — acessado em 2026-10-17
- Notion Releases (jul–out/2026) — https://www.notion.com/releases — acessado em 2026-10-17
- Notion Releases página 2 (mai–jul/2026) — https://www.notion.com/releases/page/2 — acessado em 2026-10-17
- Notion Releases página 3 (abr–mai/2026) — https://www.notion.com/releases/page/3 — acessado em 2026-10-17
- Notion 3.8 "Context for your agents" (13/10/2026) — https://www.notion.com/releases/2026-10-13 — acessado em 2026-10-17
- Suggest edits (28/08/2026) — https://www.notion.com/releases/2026-08-28 — acessado em 2026-10-17
- Notion 3.0 Agents (18/09/2025) — https://www.notion.com/releases/2025-09-18 — acessado em 2026-10-17
- Notion 2.53 Offline (19/08/2025) — https://notion.com/releases/2025-08-19 — acessado em 2026-10-17 (via resultado de busca)
- Notion 2.50 Notion Mail (15/04/2025) — https://notion.com/releases/2025-04-15 — acessado em 2026-10-17 (via resultado de busca)
- Custom Agent pricing (help) — https://www.notion.com/help/custom-agent-pricing — acessado em 2026-10-17
- Notion AI security practices (help) — https://www.notion.com/help/notion-ai-security-practices — acessado em 2026-10-17
- Export your content (help) — https://www.notion.com/help/export-your-content — acessado em 2026-10-17
- 9to5Mac, "Notion offline mode" (20/08/2025) — https://9to5mac.com/2025/08/20/notion-offline-mode/ — acessado em 2026-10-17
- Reworked, "Notion Custom Agents reach general availability" (mai/2026) — https://www.reworked.co/digital-workplace/notion-custom-agents-reach-general-availability/ — acessado em 2026-10-17 (via resultado de busca)
- Trustpilot, Notion reviews p.2 — https://www.trustpilot.com/review/notion.so?page=2 — acessado em 2026-10-17
- Implicator.ai, "Meet the New Notion: More Expensive, But Possibly Smarter" (13/05/2025) — https://www.implicator.ai/meet-the-new-notion-more-expensive-but-possibly-smarter — acessado em 2026-10-17 (números de preço do artigo conflitam com a página oficial; não usados)
- dev.to, "Notion AI Review 2026" — https://dev.to/devforge01/-notion-ai-review-2026-is-the-built-in-ai-worth-upgrading-for-5alg — acessado em 2026-10-17 (via resultado de busca)
- AI Worth It, "Notion AI review" — https://www.aiworthit.com/blog/notion-ai-review/ — acessado em 2026-10-17 (via resultado de busca)

#### Evernote
- Evernote — Compare plans — https://evernote.com/compare-plans — acessado em 2026-10-17
- Evernote — Release notes (11.38.5) — https://evernote.com/release-notes — acessado em 2026-10-17
- Evernote — What's new (entradas de jun–out/2026) — https://evernote.com/whats-new — acessado em 2026-10-17
- Evernote Blog — "115+ improvements since v11" (21/07/2026) — https://evernote.com/blog/115-improvements-since-v11 — acessado em 2026-10-17
- Evernote Release notes 11.27.5 (Ask/Edit modes) — https://evernote.com/release-notes/11.27.5 — acessado em 2026-10-17 (via resultado de busca)
- Evernote Help — AI Assistant — https://help.evernote.com/hc/en-us/articles/46319409880211-AI-Assistant — conteúdo via snippet de busca (fetch retornou 403), acessado em 2026-10-17
- Evernote Help — AI Features Overview — https://help.evernote.com/hc/en-us/articles/46594411188371 — via snippet de busca, acessado em 2026-10-17
- Evernote Help — Evernote MCP — https://help.evernote.com/hc/en-us/articles/51596325640339-Evernote-MCP-Model-Context-Protocol — via snippet de busca, acessado em 2026-10-17
- Evernote Help — novos planos Starter/Advanced — https://help.evernote.com/hc/en-us/articles/46317642175763 — via snippet de busca, acessado em 2026-10-17
- Business Wire — press release Evernote v11 (19/01/2026) — https://www.businesswire.com/news/home/20260119103272/en — via snippet de busca (fetch 403), acessado em 2026-10-17
- AlternativeTo — "Evernote v11 debuts AI Assistant, Semantic Search..." (08/10/2025) — https://alternativeto.net/news/2025/10/evernote-v11-debuts-ai-assistant-semantic-search-and-smarter-meeting-notes — acessado em 2026-10-17
- Releasebot — Evernote updates (jul–out/2026) — https://releasebot.io/updates/evernote — acessado em 2026-10-17
- TidBITS Talk — "Evernote 2026 Price Tiers Floored Me" (11/07/2026) — https://talk.tidbits.com/t/evernote-2026-price-tiers-floored-me/33792 — acessado em 2026-10-17
- Dr. Frank Buck — "Evernote new plans explained" (11/11/2025) — https://drfrankbuck.substack.com/p/evernote-new-plans-explained-pick — acessado em 2026-10-17
- UseCarly — Evernote pricing (15/07/2026) — https://www.usecarly.com/blog/evernote-pricing/ — acessado em 2026-10-17
- PricingSaaS — Evernote (captura 06/07/2026) — https://pricingsaas.com/companies/evernote — acessado em 2026-10-17
- CostBench — changelog "Evernote adds a plan" (29/08/2026) — https://costbench.com/changelog/evernote-plan-added-2026-08/ — acessado em 2026-10-17
- Zapier — "The best note taking apps" (atualizado dez/2025) — https://zapier.com/blog/best-note-taking-apps/ — acessado em 2026-10-17
- Trustpilot — Evernote reviews — https://www.trustpilot.com/review/evernote.com — acessado em 2026-10-17
- Borns IT- und Windows-Blog — "Evernote: Wie sieht es bei euch mit Preiserhöhungen aus?" (13/06/2026) — https://borncity.com/blog/2026/06/13/evernote-wie-sieht-es-bei-euch-mit-preiserhoehungen-aus/ — acessado em 2026-10-17
- Flozic — Evernote Review 2026 (atualizado 16/09/2026) — https://www.flozic.ai/blog/reviews/evernote-review — acessado em 2026-10-17
- TechTimes — Bending Spoons IPO (02/07/2026) — https://www.techtimes.com/articles/319525/20260702/bending-spoons-ipo-raises-168b-evernote-vimeo-owner-plans-1000-more-acquisitions.htm — via snippet de busca, acessado em 2026-10-17
- Wikipedia — Evernote — https://en.wikipedia.org/wiki/Evernote — acessado em 2026-10-17

#### Microsoft OneNote
- Microsoft — Compare all Microsoft 365 products — https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products — acessado em 2026-10-17
- Microsoft 365 Blog — "Copilot is now included in Microsoft 365 Personal and Family" (16/01/2025) — https://www.microsoft.com/en-us/microsoft-365/blog/2025/01/16/copilot-is-now-included-in-microsoft-365-personal-and-family/ — acessado em 2026-10-17
- Microsoft 365 Blog — "Meet Microsoft 365 Premium" (01/10/2025) — https://www.microsoft.com/en-us/microsoft-365/blog/2025/10/01/meet-microsoft-365-premium-your-ai-and-productivity-powerhouse/ — acessado em 2026-10-17
- Microsoft Support — What's the difference between the OneNote versions — https://support.microsoft.com/en-us/office/what-s-the-difference-between-the-onenote-versions-a624e692-b78b-4c09-b07f-46181958118f — acessado em 2026-10-17
- Microsoft Support — Copilot in OneNote (hub) — https://support.microsoft.com/en-us/copilot-onenote — acessado em 2026-10-17
- Microsoft Support — Summarize your OneNote notes with Copilot — https://support.microsoft.com/en-us/OneNote/copilot-pages/summarize-your-onenote-notes-with-microsoft-365-copilot — acessado em 2026-10-17
- Microsoft Support — Rewrite text with Copilot in OneNote — https://support.microsoft.com/en-us/OneNote/copilot-pages/rewrite-text-with-copilot-in-onenote — acessado em 2026-10-17
- Microsoft Support — Create a to-do list and tasks in OneNote with Copilot — https://support.microsoft.com/en-us/OneNote/copilot-pages/create-a-to-do-list-and-tasks-in-onenote-with-copilot — acessado em 2026-10-17
- Microsoft Support — Protect your notes with a password — https://support.microsoft.com/en-us/OneNote/onenote-help-and-learning/protect-your-notes-with-a-password — acessado em 2026-10-17
- Microsoft Support — Sync a notebook in OneNote — https://support.microsoft.com/en-us/OneNote/onenote-help-and-learning/sync-a-notebook-in-onenote — acessado em 2026-10-17
- Microsoft 365 Insider Blog — tag OneNote — https://techcommunity.microsoft.com/tag/OneNote?nodeId=board%3AMicrosoft365InsiderBlog — acessado em 2026-10-17
- Microsoft Copilot Blog — índice de posts 2026 — https://www.microsoft.com/en-us/microsoft-365/blog/ — acessado em 2026-10-17
- Chrome Web Store — OneNote Web Clipper — https://chromewebstore.google.com/detail/onenote-web-clipper/gojbdfnpnhogfdgjbigejoaolejmgdhk — acessado em 2026-10-17
- App Store (EUA) — Microsoft OneNote — https://apps.apple.com/us/app/microsoft-onenote/id410395246 — acessado em 2026-10-17
- Wikipedia — Microsoft OneNote (editado em 07/10/2026) — https://en.wikipedia.org/wiki/Microsoft_OneNote — acessado em 2026-10-17
- XDA — "5 productivity tools that are all better than OneNote" (25/10/2025) — https://www.xda-developers.com/onenote-alternatives/ — acessado em 2026-10-17
- XDA — "I ditched OneNote for this open-source tool..." (04/09/2025) — https://www.xda-developers.com/ditched-onenote-for-open-source-tool/ — acessado em 2026-10-17
- XDA — "This AI note-taking app does something Notion and OneNote can't..." (08/08/2026) — https://www.xda-developers.com/ai-note-taking-app-does-something-notion-and-onenote-cant-ditched-my-subscriptions/ — acessado em 2026-10-17
- Zapier — "The best note taking apps" (atualizado dez/2025) — https://zapier.com/blog/best-note-taking-apps/ — acessado em 2026-10-17

#### Apple Notes
- 9to5Mac — "Here's everything new for Apple Notes in iOS 26" (16/out/2025) — https://9to5mac.com/2025/10/16/heres-everything-new-for-apple-notes-in-ios-26/ — acessado em 2026-10-17
- MacRumors — "iOS 27 Adds Four New Features to Notes App, Including Markdown Copy-and-Paste" (17/jun/2026) — https://www.macrumors.com/2026/06/17/ios-27-apple-notes-app-new-features/ — acessado em 2026-10-17
- iGeeksBlog — "Here's everything new for Apple Notes in iOS 27" (atualizado em 15/set/2026) — https://www.igeeksblog.com/ios-27-apple-notes-features/ — acessado em 2026-10-17
- 9to5Mac — "Here's everything new in iOS 27 and more, per Apple's keynote list" (12/jun/2026) — https://9to5mac.com/2026/06/12/heres-everything-new-in-ios-27-and-more-per-apples-keynote-list/ — acessado em 2026-10-17 (via resultado de busca)
- AI Weekly — "Apple's Siri AI Ships Sept 14 on iOS 27, Trained on Gemini" — https://aiweekly.co/alerts/apples-siri-ai-ships-sept-14-on-ios-27-trained-on-gemini — acessado em 2026-10-17 (via resultado de busca; secundário)
- MacRumors — "iOS 18 Notes App: All the New Features" — https://www.macrumors.com/guide/ios-18-notes-app — acessado em 2026-10-17
- Apple Support — iCloud+ plans and pricing (Published Date: 16/set/2026) — https://support.apple.com/en-us/108047 — acessado em 2026-10-17
- Apple Support — iCloud data security overview (Published Date: 05/jan/2026) — https://support.apple.com/en-us/102651 — acessado em 2026-10-17
- Apple Support — Mac User Guide (Apple Intelligence / Summarize an audio recording in Notes) — https://support.apple.com/guide/mac-help/mchl2102c2ae/mac — acessado em 2026-10-17
- Apple Newsroom — "Apple Intelligence is available today on iPhone, iPad, and Mac" (out/2024) — https://www.apple.com/newsroom/2024/10/apple-intelligence-is-available-today-on-iphone-ipad-and-mac/ — acessado em 2026-10-17 (via resultado de busca)
- Bear Community — "Apple Notes Markdown Export iOS26" — https://community.bear.app/t/apple-notes-markdown-export-ios26/17796 — acessado em 2026-10-17 (via resultado de busca)
- Rambox — "How to get iCloud Notes on Windows" — https://rambox.app/blog/icloud-notes-on-windows/ — acessado em 2026-10-17 (via resultado de busca)
- Apple Discussions — "syncing iphone notes with windows 11" — https://discussions.apple.com/thread/256084179 — acessado em 2026-10-17 (via resultado de busca)
- Apple Discussions — "You can't see what you're typing in the Notes with iOS 26" — https://discussions.apple.com/thread/256146665 — acessado em 2026-10-17 (via resultado de busca)
- Apple Community (pt) — "Bugs/delays/others on app Notes" — https://communities.apple.com/pt/thread/256198439 — acessado em 2026-10-17 (via resultado de busca)
- ifun.de — "Weiterhin Probleme bei der Notizen-Synchronisierung über iCloud" — https://www.ifun.de/weiterhin-probleme-bei-der-notizen-synchronisierung-ueber-icloud-243664/ — acessado em 2026-10-17 (via resultado de busca)
- TidBITS Talk — "Apple Notes Alternative" — https://talk.tidbits.com/t/apple-notes-alternative/22518 — acessado em 2026-10-17 (via resultado de busca)
- TechJockey — Apple Notes reviews — https://www.techjockey.com/us/reviews/apple-notes — acessado em 2026-10-17 (via resultado de busca)
- Toolfinder — "Best Apple Notes Alternatives in 2026" — https://toolfinder.com/alternatives/apple-notes — acessado em 2026-10-17 (via resultado de busca)

#### Google Keep
- 9to5Google — "Recap: Google Keep in 2025" (03/jan/2026) — https://9to5google.com/2026/01/03/recap-google-keep-2025/ — acessado em 2026-10-17
- 9to5Google — Gmail, Docs e Keep "Live" (03/set/2026) — https://9to5google.com/2026/09/03/gmail-docs-keep-live/ — acessado em 2026-10-17
- Google Keep Help — "Use Gemini for notes in Google Keep" — https://support.google.com/keep/answer/14626262?hl=en — acessado em 2026-10-17
- Google Keep Help — "Generate notes with your voice in Google Keep" — https://support.google.com/keep/answer/17499364?hl=en — acessado em 2026-10-17
- Google Keep Help — "Export your data from Google Keep" — https://support.google.com/keep/answer/10017039?hl=en — acessado em 2026-10-17
- Google Keep Help — índice de artigos (Gemini, lembretes, export, plataformas) — https://support.google.com/keep/?hl=en — acessado em 2026-10-17
- Google One — Plans (servido em BRL) — https://one.google.com/about/plans — acessado em 2026-10-17
- Google Gemini — Subscriptions (servido em BRL) — https://gemini.google/subscriptions/ — acessado em 2026-10-17
- Microsoft Learn — Windows Subsystem for Android (fim em 05/mar/2025) — https://learn.microsoft.com/en-us/windows/android/wsa/ — acessado em 2026-10-17
- App Store (EUA) — Google Keep - Notes and Lists — https://apps.apple.com/us/app/google-keep-notes-and-lists/id1029207872 — acessado em 2026-10-17
- Android Headlines — "You can now search within a single note in Google Keep" (ago/2026) — https://www.androidheadlines.com/2026/08/you-can-now-search-within-a-single-note-in-google-keep.html — acessado em 2026-10-17 (via resultado de busca)
- Android Authority — "Google Keep text notes" — https://www.androidauthority.com/google-keep-text-notes-3539591/ — acessado em 2026-10-17 (via resultado de busca)
- ARY News — "Google adds Gemini voice tools to Gmail, Docs, and Keep" (05/set/2026) — https://arynews.tv/google-adds-gemini-voice-tools-to-gmail-docs-and-keep — acessado em 2026-10-17 (via resultado de busca)
- Softonic — "Google Gemini Live comes to Gmail and Keep" (30/jun/2026) — https://en.softonic.com/articles/google-gemini-live-comes-to-gmail-and-keep-voice-chat-starts-in-summer-2026 — acessado em 2026-10-17 (via resultado de busca)
- TechSpot — "Google is adding voice AI to Gmail, Docs, and Keep, whether users like it or not" (set/2026) — https://www.techspot.com/community/topics/google-is-adding-voice-ai-to-gmail-docs-and-keep-whether-users-like-it-or-not.298707/ — título via busca; página retornou 403
- itechify — "Google Keep Gemini integration" (01/set/2026; fonte secundária de baixa confiabilidade) — https://itechify.com/2026/09/01/google-keep-gemini-integration/ — acessado em 2026-10-17
- Wikipedia — Google One (preço do AI Ultra via TechCrunch, 20/mai/2025) — https://en.wikipedia.org/wiki/Google_One — acessado em 2026-10-17
- Google Blog — Google AI Ultra (20/mai/2025; US$ 249,99/mês nos EUA) — https://blog.google/products/google-one/google-ai-ultra/ — acessado em 2026-10-17

#### Bear
- Bear — site oficial (features, export, preço) — https://bear.app/ — acessado em 2026-10-17
- Bear FAQ — Bear Pro (features e preço) — https://bear.app/faq/features-and-price-of-bear-pro/ — acessado em 2026-10-17
- Bear FAQ — Export Notes — https://bear.app/faq/export-your-notes/ — acessado em 2026-10-17
- Bear FAQ — Sync & Privacy — https://bear.app/faq/syncing-privacy/ — acessado em 2026-10-17
- Bear FAQ — CLI for AI and Scripting — https://bear.app/faq/command-line-interface/ — acessado em 2026-10-17
- Bear Blog — "Bear 2.8: BearCLI, Claude Connector, and MCP server" (29/abr/2026) — https://blog.bear.app/2026/04/bear-2-8-bearcli-claude-connector-and-mcp-server/ — acessado em 2026-10-17
- Bear Blog — "Bear 2.9: Use Tag as Workspace" (16/jul/2026) — https://blog.bear.app/2026/07/bear-2-9-use-tag-as-workspace/ — acessado em 2026-10-17
- Bear Blog — "Bear Beyond Text: Working with Images, PDFs, and more" (21/abr/2026) — https://blog.bear.app/2026/04/bear-beyond-text-working-with-images-pdfs-and-more/ — acessado em 2026-10-17
- Bear Blog — "Celebrating 9 years of Bear" (02/nov/2025) — https://blog.bear.app/2025/11/celebrating-9-years-of-bear/ — acessado em 2026-10-17
- Bear Blog — "Introducing Bear Web Clipper 2.0" (29/set/2025) — https://blog.bear.app/2025/09/introducing-bear-web-clipper-2-0-faster-private-and-more-reliable/ — acessado em 2026-10-17
- Bear Blog — listagem (Lettera 18/jun/2026, Mermaid 28/jul/2026, desconto 31/ago/2026) — https://blog.bear.app/ e https://blog.bear.app/page/2/ — acessados em 2026-10-17
- Bear Community — "Bear Web Public Beta - You are invited!" (jul/2025) — https://community.bear.app/t/bear-web-public-beta-you-are-invited/17435 — acessado em 2026-10-17
- Bear Community — categoria Announcement — https://community.bear.app/c/announcement/9 — acessado em 2026-10-17
- Bear Community — "Bear 3.0.3 macOS with Typewriter mode available for testers" (16/out/2026) — https://community.bear.app/t/bear-3-0-3-macos-with-typewriter-mode-available-for-testers/19990 — acessado em 2026-10-17
- Bear Community — tópicos recentes (out/2026) — https://community.bear.app/latest — acessado em 2026-10-17
- App Store (EUA) — Bear Markdown Notes (iOS) — https://apps.apple.com/us/app/bear-markdown-notes/id1016366447 — acessado em 2026-10-17
- Mac App Store (EUA) — Bear (histórico de versões 2.10/3.0/3.0.1/3.0.2) — https://apps.apple.com/us/app/bear-markdown-notes/id1091189122 — acessado em 2026-10-17

#### Craft
- Craft — home — https://www.craft.do/ — acessado em 2026-10-17
- Craft Pricing (exibido em BRL) — https://www.craft.do/pricing — acessado em 2026-10-17
- Craft Download — https://www.craft.do/download — acessado em 2026-10-17
- App Store (EUA), Craft: Notes, Documents, AI — https://apps.apple.com/us/app/craft-docs-and-notes-editor/id1487937127 — acessado em 2026-10-17
- Craft Blog (lista de posts 2025–2026) — https://www.craft.do/blog — acessado em 2026-10-17
- "More Flexible Assistant, Bring Your Own Key, MCP v2" (05/06/2026) — https://www.craft.do/blog/craft-update-3-4-4 — acessado em 2026-10-17
- "Gallery View, Offline mode…" (17/02/2026) — https://www.craft.do/blog/craft-update-3-3-9 — acessado em 2026-10-17
- "Major Tasks update … better Windows app" (07/07/2026) — https://www.craft.do/blog/craft-update-3-5-0 — acessado em 2026-10-17
- "Shortcuts, Widgets, Localization and more powerful Plus tier" (11/10/2026) — https://www.craft.do/blog/craft-update-3-7-0 — acessado em 2026-10-17
- "Introducing Craft Agents" (03/02/2026) — https://www.craft.do/blog/introducing-craft-agents — acessado em 2026-10-17
- "Your content is yours" (27/11/2025) — https://www.craft.do/blog/your-content-is-yours — acessado em 2026-10-17
- "Introducing on-device AI capabilities inside the Craft Assistant" (31/01/2025, atualizado 06/02/2025) — https://www.craft.do/blog/deepseek-r1-in-craft-assistant — acessado em 2026-10-17
- Craft Security — https://www.craft.do/security — acessado em 2026-10-17
- Craft Help: Using Craft Assistant — https://craft-support.mintlify.site/en/ai-assistant/using — acessado em 2026-10-17
- Craft Help: Import and Export — https://craft-support.mintlify.site/en/import-and-export — acessado em 2026-10-17
- Craft Help: Plan and Do — https://craft-support.mintlify.site/en/plan-and-do — acessado em 2026-10-17
- Craft Help: Account and Subscription — https://craft-support.mintlify.site/en/account-and-subscription — acessado em 2026-10-17

#### UpNote
- UpNote — site oficial (features, plataformas, preços) — https://getupnote.com/ — acessado em 2026-10-17
- UpNote Help Center — FAQ (Firebase, E2EE, offline, lifetime) — https://help.getupnote.com/resources/frequently-asked-questions — acessado em 2026-10-17
- UpNote — Release notes Mac/Windows/Linux (9.9.0 a 9.22.8, jan/2025–out/2026) — https://help.getupnote.com/resources/release-notes/mac-windows-and-linux-apps — acessado em 2026-10-17
- App Store — UpNote (avaliações, IAPs, reviews 01/2025 e 09/2025) — https://apps.apple.com/app/id1389634515 — acessado em 2026-10-17
- Scott S. Nelson — "UpNote or Evernote: the journey…" (Substack, 17/05/2025) — https://scottsnelson1.substack.com/p/upnote-or-evernote-the-journey-and — acessado em 2026-10-17
- Outliner Software — thread "UpNote continues to improve" (2021, fala do dev sobre lifetime) — https://outlinersoftware.com/topics/viewt/9403 — acessado em 2026-10-17
- Fabric — "Best Evernote alternative" (2026, concorrente; viés) — https://fabric.so/comparison/best-evernote-alternative — acessado em 2026-10-17
- mcpservers.org — upnote-lens-mcp (MCP de terceiros) — https://mcpservers.org/servers/awesomehye/upnote-lens-mcp — acessado em 2026-10-17

#### Joplin
- Joplin — Plans (Joplin Cloud, preços em EUR, Cloud AI beta) — https://joplinapp.org/plans/ — acessado em 2026-10-17
- Joplin — News (lista de posts 2025–2026) — https://joplinapp.org/news/ — acessado em 2026-10-17
- Joplin — "What's new in Joplin 3.7" (31/08/2026) — https://joplinapp.org/news/20260831-release-3-7/ — acessado em 2026-10-17
- Joplin — "Your notes and AI: privacy first" (14/09/2026) — https://joplinapp.org/news/20260914-ai-privacy/ — acessado em 2026-10-17
- Joplin — "What's new in Joplin 3.6" (05/05/2026) — https://joplinapp.org/news/20260505-release-3-6/ — acessado em 2026-10-17
- Joplin Help — AI chat panel — https://joplinapp.org/help/apps/ai_chat_panel — acessado em 2026-10-17
- Joplin Help — AI chat (provedores, local vs. remoto) — https://joplinapp.org/help/apps/ai_chat — acessado em 2026-10-17
- Joplin Help — Semantic search — https://joplinapp.org/help/apps/ai_semantic_search — acessado em 2026-10-17
- Joplin Help — OCR — https://joplinapp.org/help/apps/ocr — acessado em 2026-10-17
- Joplin — página inicial (features, plataformas) — https://joplinapp.org/ — acessado em 2026-10-17
- Joplin Forum — "Desktop pre-release v3.7 is now available" (mai–jul/2026) — https://discourse.joplinapp.org/t/desktop-pre-release-v3-7-is-now-available-updated-14-07-2026/49829 — acessado em 2026-10-17
- Joplin Forum — GSoC 2026 "Chat with your note collection using AI" (proposta) — https://discourse.joplinapp.org/t/gsoc-2026-proposal-draft-idea-4-chat-with-your-note-collection-using-ai-madhan-s/49168 — acessado em 2026-10-17
- Joplin Plugins — Joplin Aide (aprovação de escrita) — https://joplinapp.org/plugins/plugin/com.github.joplin-aide/ — acessado em 2026-10-17
- Joplin Plugins — Jarvis — https://joplinapp.org/plugins/plugin/joplin.plugin.alondmnt.jarvis/ — acessado em 2026-10-17
- GummySearch — r/joplinapp (stats, atualizado 30/09/2026) — https://gummysearch.com/r/joplinapp — acessado em 2026-10-17
- Techjockey — Joplin reviews — https://www.techjockey.com/reviews/joplin — via busca, 2026-10-17
- G2 — Joplin reviews — https://www.g2.com/products/joplin — via busca, 2026-10-17

#### Standard Notes
- Standard Notes — Plans — https://standardnotes.com/plans — acessado em 2026-10-17
- Standard Notes — página inicial — https://standardnotes.com/ — acessado em 2026-10-17
- Standard Notes — Features — https://standardnotes.com/features — acessado em 2026-10-17
- Standard Notes — Blog (índice) — https://standardnotes.com/blog — acessado em 2026-10-17
- Standard Notes — "2025 update: What's new and what's next" (11/12/2025) — https://standardnotes.com/blog/2025-update — acessado em 2026-10-17
- Standard Notes — "Announcing smarter search, tags, and more" (17/08/2026) — https://standardnotes.com/blog/search-improvements — acessado em 2026-10-17
- Standard Notes — "Standard Notes and Proton's journey so far" (13/11/2024) — https://standardnotes.com/blog/progress-with-proton — acessado em 2026-10-17
- Standard Notes — Help center — https://standardnotes.com/help — acessado em 2026-10-17
- GitHub — standardnotes/app releases (set–out/2026) — https://github.com/standardnotes/app/releases — acessado em 2026-10-17
- App Store — Standard Notes (id1285392450) — https://apps.apple.com/app/id1285392450 — acessado em 2026-10-17
- AlternativeTo — Standard Notes reviews — https://alternativeto.net/software/standard-notes/about/ — acessado em 2026-10-17
- Trustpilot — standardnotes.com — https://www.trustpilot.com/review/standardnotes.com — acessado em 2026-10-17
- Privacy Guides — Notebooks (atualizado 15/05/2025) — https://www.privacyguides.org/en/notebooks/ — acessado em 2026-10-17
- Proton — Lumo — https://proton.me/lumo — acessado em 2026-10-17

#### Simplenote
- Simplenote — site oficial — https://simplenote.com/ — acessado em 2026-10-17
- Simplenote Help — https://simplenote.com/help/ — acessado em 2026-10-17
- Simplenote Blog — listagem — https://simplenote.com/blog/ — acessado em 2026-10-17
- Simplenote Blog — "Simplenote MCP Server" (15/abr/2026) — https://simplenote.com/2026/04/15/simplenote-mcp-server/ — título e data via listagem do blog, acessado em 2026-10-17
- Simplenote Blog — "Even Better Simplenote MCP Server" (08/mai/2026) — https://simplenote.com/2026/05/08/even-better-simplenote-mcp-server/ — acessado em 2026-10-17
- Simplenote Blog — "We Built a New Editor. Want to Try It?" (03/jul/2026, com comentários) — https://simplenote.com/2026/07/03/we-built-a-new-editor-want-to-try-it/ — acessado em 2026-10-17
- GitHub — Automattic/simplenote-mcp (README) — https://github.com/Automattic/simplenote-mcp — acessado em 2026-10-17
- GitHub — simplenote-electron releases — https://github.com/Automattic/simplenote-electron/releases — acessado em 2026-10-17
- GitHub — simplenote-android release 2.39 — https://github.com/Automattic/simplenote-android/releases/tag/2.39 — acessado em 2026-10-17
- GitHub — simplenote-ios releases — https://github.com/Automattic/simplenote-ios/releases — acessado em 2026-10-17
- App Store (EUA) — Simplenote — https://apps.apple.com/us/app/simplenote/id289429962 — acessado em 2026-10-17
- Simplenote Forums — https://forums.simplenote.com/ — acessado em 2026-10-17
- Microsoft Store — Simplenote — https://apps.microsoft.com/detail/9nxqq40ldw3x — acessado em 2026-10-17 (listagem confirma app gratuito para Windows; detalhes não renderizados)

#### Microsoft Loop
- Microsoft Loop (página do produto) — https://www.microsoft.com/en-us/microsoft-loop — acessado em 2026-10-17
- Copilot in Loop (suporte) — https://support.microsoft.com/en-us/copilot-loop — acessado em 2026-10-17
- Loop access via Microsoft 365 subscriptions (suporte) — https://support.microsoft.com/en-us/office/loop-access-via-microsoft-365-subscriptions-92915461-4b14-49a4-9cd4-d1c259292afa — acessado em 2026-10-17
- Requirements for Loop components and Loop workspaces (Microsoft Learn, ms.date 18/08/2026) — https://learn.microsoft.com/en-us/microsoft-365/loop/loop-requirements — acessado em 2026-10-17
- Manage Loop in your organization (Microsoft Learn, atualizado 14/10/2026) — https://learn.microsoft.com/en-us/microsoft-365/loop/loop-workspaces-configuration (canônico: loop-admin-configuration) — acessado em 2026-10-17
- Overview of Loop storage (Microsoft Learn) — https://learn.microsoft.com/en-us/microsoft-365/loop/loop-storage — acessado em 2026-10-17
- Requirements for Copilot Pages and Copilot Notebooks (Microsoft Learn) — https://learn.microsoft.com/en-us/microsoft-365/loop/cpcn-requirements — acessado em 2026-10-17
- Manage Copilot Pages and Copilot Notebooks (Microsoft Learn) — https://learn.microsoft.com/en-us/microsoft-365/loop/cpcn-admin-configuration — acessado em 2026-10-17
- License Options for Microsoft Copilot (Microsoft Learn, ms.date 25/09/2026) — https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-licensing — acessado em 2026-10-17
- Microsoft 365 Copilot pricing — https://www.microsoft.com/en-us/microsoft-365-copilot/pricing — acessado em 2026-10-17
- Compare all Microsoft 365 products (consumer) — https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products — acessado em 2026-10-17
- KluczeSoft, "Microsoft Loop" (publicado 25/05/2026, modificado 15/10/2026) — https://kluczesoft.pl/wiedza/aplikacje/microsoft-loop — acessado em 2026-10-17
- GeekChamp, "Microsoft Loop in 2026: Features, Updates…" (24/09/2026) — https://geekchamp.com/?p=1107829 — acessado em 2026-10-17
- AlternativeTo, Microsoft Loop reviews — https://alternativeto.net/software/microsoft-loop/about/ — acessado em 2026-10-17
- Geekflare, "Microsoft Loop review" (data incerta, pré-lançamento) — https://geekflare.com/microsoft-loop-review/ — acessado em 2026-10-17 (via resultado de busca)

#### Zoho Notebook
- Zoho Notebook — página inicial — https://www.zoho.com/notebook/ — acessado em 2026-10-17
- Zoho Notebook — Pricing — https://www.zoho.com/notebook/pricing.html — acessado em 2026-10-17 (valores não renderizados)
- Zoho Notebook — Notebook AI — https://www.zoho.com/notebook/notebook-ai.html — acessado em 2026-10-17
- Zoho Notebook — Security and privacy — https://www.zoho.com/notebook/security-and-privacy.html — acessado em 2026-10-17
- Zoho Notebook — What's new — https://www.zoho.com/notebook/whats-new.html — acessado em 2026-10-17
- Zoho Blog — Notebook (índice) — https://www.zoho.com/blog/notebook — acessado em 2026-10-17
- Zoho Blog — "A #Recap of Zoho Notebook in 2025" (10/12/2025) — https://www.zoho.com/blog/notebook/year-in-review-2025.html — acessado em 2026-10-17
- Zoho Notebook — Evernote alternative — https://www.zoho.com/notebook/evernote-alternative.html — acessado em 2026-10-17
- Zoho Help — Notebook KB (índice) — https://help.zoho.com/portal/en/kb/zoho-notebook — acessado em 2026-10-17
- Zoho Help — Compare Zoho Notebook Plans — https://help.zoho.com/portal/en/kb/notebook/plans-and-pricing/articles/compare-zoho-notebook-plans — acessado em 2026-10-17
- Zoho Help — Zoho Notebook Pro Plus Plan — https://help.zoho.com/portal/en/kb/notebook/plans-and-pricing/articles/zoho-notebook-pro-plus-plan — acessado em 2026-10-17
- Zoho Help — Zoho Notebook Pro Plan — https://help.zoho.com/portal/en/kb/notebook/plans-and-pricing/articles/zoho-notebook-pro-plan-a-complete-overview — acessado em 2026-10-17
- Zoho Help — Zoho Notebook Pro Lite — https://help.zoho.com/portal/en/kb/notebook/plans-and-pricing/articles/zoho-notebook-pro-lite — acessado em 2026-10-17
- Zoho Help — Notebook for Students — https://help.zoho.com/portal/en/kb/notebook/plans-and-pricing/articles/notebook-for-students-zoho — acessado em 2026-10-17
- Zoho Help — Subscription & Billing Guide — https://help.zoho.com/portal/en/kb/notebook/plans-and-pricing/articles/subscription-billing-guide — acessado em 2026-10-17
- Zoho Help — How AI Works in Zoho Notebook — https://help.zoho.com/portal/en/kb/notebook/notebook-ai/articles/ai-usage-terms-in-zoho-notebook — acessado em 2026-10-17
- Zoho Help — Enhance Your Notes with Notebook AI — https://help.zoho.com/portal/en/kb/notebook/notebook-ai/articles/enhance-your-notes-with-notebook-ai — acessado em 2026-10-17
- Zoho Help — Import, Export & Backup (categoria) — https://help.zoho.com/portal/en/kb/notebook/import-export-backup — acessado em 2026-10-17
- Zoho Community — fórum Zoho Notebook — https://help.zoho.com/portal/en/community/zoho-notebook — acessado em 2026-10-17
- TechRepublic — "Zoho Notebook review" (2024; preços Pro US$ 1,99/mês, US$ 19,99/ano, US$ 49,99/3 anos) — https://www.techrepublic.com/article/zoho-notebook-review/ — via resultado de busca (fetch 403), 2026-10-17
- AppPricingLab — Zoho Notebook pricing ("Discovered 2026-04-01") — https://saas.apppricinglab.com/product/zoho-notebook/ — acessado em 2026-10-17

#### Notesnook
- Notesnook — Pricing (preços regionais em BRL) — https://notesnook.com/pricing — acessado em 2026-10-17
- Notesnook — "Introducing new pricing plans" (04/10/2025) — https://notesnook.com/blog/introducing-new-pricing-plans — acessado em 2026-10-17
- Notesnook — Blog (índice 2025–2026) — https://notesnook.com/blog/ — acessado em 2026-10-17
- Notesnook — "Notesnook v3.4.0" (29/06/2026) — https://notesnook.com/blog/notesnook-v3.4.0 — acessado em 2026-10-17
- Notesnook — "Notesnook v3.3.0" (04/10/2025) — https://notesnook.com/blog/notesnook-v3.3.0 — acessado em 2026-10-17
- Notesnook — "Can Evernote employees read your notes?" (01/09/2025) — https://notesnook.com/blog/can-evernote-employees-read-your-notes — acessado em 2026-10-17
- Notesnook — "Building a united front for privacy: Notesnook & Kagi partnership" (21/10/2025) — https://notesnook.com/blog/introducing-notesnook-circle — acessado em 2026-10-17
- Notesnook — Roadmap (atualizado 22/04/2025) — https://notesnook.com/roadmap — acessado em 2026-10-17
- Notesnook — página inicial (features) — https://notesnook.com/ — acessado em 2026-10-17
- GitHub — streetwriters/notesnook releases — https://github.com/streetwriters/notesnook/releases — acessado em 2026-10-17
- AlternativeTo — Notesnook reviews — https://alternativeto.net/software/notesnook/about/ — acessado em 2026-10-17
- Privacy Guides — Notebooks — https://www.privacyguides.org/en/notebooks/ — acessado em 2026-10-17

#### Gemini Notebook (ex-Google NotebookLM; renomeado em 16/07/2026)
- NotebookLM is now Gemini Notebook (blog.google, 16/07/2026) — https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/ — acessado em 2026-10-17
- Google continues its renaming streak by turning NotebookLM to Gemini Notebook (TechCrunch, 16/07/2026) — https://techcrunch.com/2026/07/16/google-continues-its-renaming-streak-by-turning-notebooklm-to-gemini-notebook/ — acessado em 2026-10-17
- Google Workspace Updates: NotebookLM is now Gemini Notebook (jul/2026) — https://workspaceupdates.googleblog.com/2026/07/notebooklm-now-gemini-notebook.html — acessado em 2026-10-17 (via resultado de busca)
- Try notebooks in Gemini to easily keep track of projects (blog.google, 08/04/2026) — https://blog.google/innovation-and-ai/products/gemini-app/notebooks-gemini-notebooklm/ — acessado em 2026-10-17
- New ways to customize and interact with your content in NotebookLM (Workspace Updates, 20/03/2026) — https://workspaceupdates.googleblog.com/2026/03/new-ways-to-customize-and-interact-with-your-content-in-NotebookLM.html — acessado em 2026-10-17
- Gemini Notebook Help — Plans/limites — https://support.google.com/notebooklm/answer/16213268 — acessado em 2026-10-17
- Gemini Notebook Help — Manage usage limits — https://support.google.com/gemininotebook/answer/17670842 — acessado em 2026-10-17
- Gemini Notebook Help — Create and add notes — https://support.google.com/gemininotebook/answer/16262519?hl=en — acessado em 2026-10-17
- Gemini Notebook Help — Use and manage connected apps — https://support.google.com/gemininotebook/answer/18784282?hl=en — acessado em 2026-10-17
- Gemini Notebook Help — Learn about Gemini Notebook — https://support.google.com/gemininotebook/answer/16164461?hl=en — acessado em 2026-10-17
- Gemini Notebook Help — Privacy and Terms — https://support.google.com/gemininotebook/answer/17004255?hl=en — acessado em 2026-10-17
- Google AI plans (página oficial; renderizou em BRL) — https://gemini.google/subscriptions/ — acessado em 2026-10-17
- Google AI Plus price drop to $4.99 (9to5Google, 08/06/2026) — https://9to5google.com/2026/06/08/google-ai-plus-price-drop/ — acessado em 2026-10-17
- Gemini Notebook Limits (progressiverobot, 05/10/2026) — https://www.progressiverobot.com/2026/10/05/gemini-notebook-limits-five-hour-refresh-background-queue/ — acessado em 2026-10-17
- NotebookLM Daily Limits 2026 (Elephas — concorrente; secundária) — https://elephas.app/blog/notebooklm-daily-limit — acessado em 2026-10-17
- NotebookLM — Wikipedia (com aviso de possível texto gerado por LLM) — https://en.wikipedia.org/wiki/NotebookLM — acessado em 2026-10-17
- Gemini Notebook na App Store (EUA) — https://apps.apple.com/us/app/notebooklm/id6737527615 — acessado em 2026-10-17

#### Anytype
- Anytype Docs — Memberships — https://doc.anytype.io/anytype/resources/memberships.md — acessado em 2026-10-17
- Anytype Docs — Privacy & Encryption — https://doc.anytype.io/anytype/data/privacy-and-encryption.md — acessado em 2026-10-17
- Anytype Docs — Sync & Backup — https://doc.anytype.io/anytype/data/sync-and-backup.md — acessado em 2026-10-17
- Anytype Docs — Channels — https://doc.anytype.io/anytype/basics/channels.md — acessado em 2026-10-17
- Anytype Docs — Chats — https://doc.anytype.io/anytype/collaborate/chats.md — acessado em 2026-10-17
- Anytype Docs — Dates — https://doc.anytype.io/anytype/features/dates.md — acessado em 2026-10-17
- Anytype Docs — Block Types — https://doc.anytype.io/anytype/create/editor/block-types.md — acessado em 2026-10-17
- Anytype Docs — Files & Media — https://doc.anytype.io/anytype/create/files-and-media.md — acessado em 2026-10-17
- Anytype Docs — Import & Export — https://doc.anytype.io/anytype/data/import-and-export.md — acessado em 2026-10-17
- Anytype Docs — Local API — https://doc.anytype.io/anytype/features/integrations/local-api.md — acessado em 2026-10-17
- Anytype Docs — Anytype Agents' Skill — https://doc.anytype.io/anytype/features/integrations/anytype-agents-skill.md — acessado em 2026-10-17
- Anytype Docs (RU) — Monetization (preços de 2024) — https://doc.anytype.io/anytype/russian/podpiski/monetization.md — acessado em 2026-10-17
- anyproto/anytype-mcp (GitHub) — https://github.com/anyproto/anytype-mcp — acessado em 2026-10-17
- anyproto/anytype-ts Releases (GitHub; v0.57.x, set–out/2026) — https://github.com/anyproto/anytype-ts/releases — acessado em 2026-10-17
- The Big Community Update | February 2026 (blog, 19/02/2026) — https://blog.anytype.io/february-community-update-2026/ — acessado em 2026-10-17
- Looking Back, Moving Forward: Our Journey and Plans for 2025 (blog, 08/01/2025) — https://blog.anytype.io/our-journey-and-plans-for-2025/ — acessado em 2026-10-17
- Anytype pricing (não renderizou) — https://anytype.io/pricing — acessado em 2026-10-17
- Anytype vs AFFiNE (fahimai.com; secundária, "pricing verified January 2026") — https://www.fahimai.com/anytype-vs-affine-pro/ — acessado em 2026-10-17
- AlternativeTo — Anytype — https://alternativeto.net/software/anytype/about/ — acessado em 2026-10-17
- Anytype na App Store (EUA) — https://apps.apple.com/us/app/anytype/id6449487029 — acessado em 2026-10-17

#### AFFiNE
- AFFiNE Pricing — https://affine.pro/pricing — acessado em 2026-10-17
- AFFiNE AI — https://affine.pro/ai — acessado em 2026-10-17
- AFFiNE homepage — https://affine.pro/ — acessado em 2026-10-17
- AFFiNE Download (0.27.4) — https://affine.pro/download — acessado em 2026-10-17
- Getting started with AFFiNE (blog, 08/10/2026) — https://affine.pro/blog/getting-started-with-affine — acessado em 2026-10-17
- toeverything/AFFiNE (README) — https://github.com/toeverything/AFFiNE — acessado em 2026-10-17
- Release v0.22.0 — https://github.com/toeverything/AFFiNE/releases/tag/v0.22.0 — acessado em 2026-10-17
- Release v0.23.0 — https://github.com/toeverything/AFFiNE/releases/tag/v0.23.0 — acessado em 2026-10-17
- Release v0.24.0 — https://github.com/toeverything/AFFiNE/releases/tag/v0.24.0 — acessado em 2026-10-17
- Release v0.25.0 — https://github.com/toeverything/AFFiNE/releases/tag/v0.25.0 — acessado em 2026-10-17
- Release v0.26.0 — https://github.com/toeverything/AFFiNE/releases/tag/v0.26.0 — acessado em 2026-10-17
- Release v0.27.0 — https://github.com/toeverything/AFFiNE/releases/tag/v0.27.0 — acessado em 2026-10-17
- AFFiNE Releases (canary set–out/2026) — https://github.com/toeverything/AFFiNE/releases — acessado em 2026-10-17
- AlternativeTo — AFFiNE — https://alternativeto.net/software/affine/about/ — acessado em 2026-10-17
- AFFiNE Review 2026 (Tooliverse; secundária, "200K+ Pro users") — https://tooliverse.ai/tools/affine — acessado em 2026-10-17 (via resultado de busca)
