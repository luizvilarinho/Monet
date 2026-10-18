# Apps de notas entregam a caneta à IA

*Contexto de mercado: IA em ferramentas de notas e de "pensar com IA". Estado em 2026-10-17. É insumo para o estudo de mercado do Monet. Nomes de produtos e recursos ficam no original. [não verificado] marca o que não se confirmou em fonte primária. Datas no formato AAAA-MM-DD. "Verificado em 2026-10-17" quer dizer que a página foi lida ao vivo nesse dia.*

## (a) Resumo executivo: a IA escreve, e a curadoria virou opção

Em outubro de 2026, no centro do mercado está a IA que **produz ou organiza o artefato no lugar do usuário**. O NotebookLM foi **renomeado Gemini Notebook em 2026-07-16** e virou uma fábrica de saídas prontas: áudio, vídeo, slides, relatórios e flashcards. Também ganhou um agente que roda código e busca fontes ([9to5Google, 2026-07-16](https://9to5google.com/2026/07/16/notebooklm-gemini-notebook/)). O Notion virou uma plataforma de agentes, e a própria documentação diz que "Notion AI writes directly on the page" ([Notion Help](https://www.notion.com/help/guides/notion-ai-for-docs)). Mem 2.0, Evernote v11, Keep Live, Recall, Fabric e o agente do Heptabase vão na mesma direção. Ao mesmo tempo, **a curadoria explícita virou convenção de UX, mas quase sempre como opção ou recurso isolado**. O Copilot do OneNote só insere texto via "Add to doc". O Capacities pede aprovação por padrão, o Tana mostra diffs e o Notion ganhou "suggest edits" opt-in. O Gemini Notebook só grava uma resposta na nota com "Save to note".

Por isso a afirmação do PRD do Monet se divide em duas:

- **"Notion AI e NotebookLM usam a IA para definir a informação": se sustenta, com ajuste de redação.**
- **"Nenhum app usa a IA como mecanismo de aprofundamento mantendo a curadoria com o usuário": não se sustenta como afirmação absoluta.** MarginNote 4 e Readwise Reader/Ghostreader já juntam IA convocada, ancoragem no material, curadoria resposta a resposta e foco em estudo ou leitura. O Heptabase mira o aprendizado de forma explícita.

O que continua sem equivalente entre os produtos verificados é a **combinação** do Monet:

- desktop Windows;
- local-first, sem conta;
- BYOK com OpenRouter;
- fichamento como artefato central;
- leitor PDF/EPUB com chat contextual;
- a regra "a IA nunca escreve no permanente", aplicada ao app inteiro, com chat descartável.

**A ciência mais recente apoia a tese, com ressalvas.** Num RCT de 2025 com 405 adolescentes, anotar sozinho ou anotar com um LLM ao lado venceu "só LLM" em retenção e compreensão três dias depois. Mas os alunos **preferiram** o LLM ([Microsoft Research](https://www.microsoft.com/en-us/research/?p=1143413)). A evidência também mostra que IA "convocada" não basta quando o comando entrega o produto pronto.

**Seis fatos de 2025–2026 mudam o quadro.**

**1. O Gemini Notebook virou agente e passou a cobrar por computação.** O produto tem mais de 30 milhões de usuários e 600 mil organizações. Ganhou Gemini 3.5 + Antigravity, com um "secure cloud computer" por notebook e exportação em DOCX, XLSX e PPTX ([9to5Google, 2026-06-08](https://9to5google.com/2026/06/08/notebooklm-gemini-3-5-antigravity/)). Desde 2026-09-02 os limites são **por computação**, com janela de 5 horas ([blog.google, 2026-08-28](https://blog.google/innovation-and-ai/products/gemini-notebook/new-flexible-usage-limits/)).

**2. Os apps indie de IA se mostraram frágeis.**

- **Reor (local, open source) foi arquivado em 2026-03-07** ([GitHub](https://github.com/reorproject/reor)).
- **A Limitless foi comprada pela Meta.** O Rewind desligou a captura em 2025-12-19, e o serviço acabou em várias regiões, **inclusive no Brasil**, com cerca de duas semanas para exportar os dados ([limitless.ai](https://www.limitless.ai/)).
- **O protótipo desktop do Napkin saiu do ar em 2026-06-30** ([napkin.one](https://napkin.one/)).

**3. Reflect e Mem tomaram direções opostas.** O Reflect relançou como **Reflect Open** em 2026-07-14: licença MIT, notas em Markdown local, BYOK com OpenAI, Anthropic, Google ou **OpenRouter**, desktop Mac grátis e build experimental para Windows ([Reflect](https://reflect.app/blog/reflect-open)). É o concorrente com arquitetura mais parecida com a do Monet. O Mem 2.0 (2025-10-01) é o oposto: "Chat can create, edit, and organize notes for you." ([Mem](https://get.mem.ai/blog/introducing-mem-2-0)).

**4. O padrão "o usuário escreve, a IA aumenta" provou que vende, e "pergunte ao livro" virou recurso de massa.**

- O Granola levantou US$ 125 milhões em 2026-03-25 ([Granola blog](https://www.granola.ai/blog)).
- O Kindle lançou o "Ask this Book" em 2025-12-11 ([Authors Guild](https://authorsguild.org/news/statement-on-amazon-kindle-ask-this-book-ai-feature/)).

**5. BYOK entrou e saiu de produtos.** O Craft ganhou BYOK em 2026-06-05 ([Craft](https://www.craft.do/blog/craft-update-3-4-4)). O Capacities **encerrou** o seu em 2026-08-17 ([Capacities](https://capacities.io/whats-new/release-69)). O Heptabase passou a aceitar OpenRouter ([roadmap](https://wiki.heptabase.com/roadmap)).

**6. Nos assistentes gerais, memória virou padrão e a proatividade cresce.** A memória do Claude vem ligada por padrão em Free, Pro e Max ([Claude release notes](https://support.claude.com/en/articles/12138966-release-notes)). O ChatGPT lançou o Pulse, que trabalha sem ser chamado ([TechCrunch](https://techcrunch.com/2025/09/25/openai-launches-chatgpt-pulse-to-proactively-write-you-morning-briefs/)).

**Na ciência, há dois cuidados.** O estudo mais citado contra a IA ("Your Brain on ChatGPT", do MIT) **ainda é preprint** e recebeu crítica formal ([arXiv](https://arxiv.org/abs/2601.00856)). A meta-análise mais otimista a favor do ChatGPT **foi retratada em 2026-04-22** ([Nature](https://www.nature.com/articles/s41599-026-07310-z)). O que fica de pé é mais estreito e mais útil para o Monet:

- **Usar a IA para produzir a solução melhora o desempenho na hora e piora o aprendizado quando a IA sai de cena.** Num estudo, o grupo com ChatGPT sem salvaguardas tirou nota 17% menor na prova sem IA ([Wharton](https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/)). Num RCT da Anthropic, a maestria caiu para 50% contra 67% ([Anthropic](https://www.anthropic.com/research/AI-assistance-coding-skills)).
- **Aprender por resumo de LLM gera conhecimento mais raso que buscar por conta própria** (7 experimentos, n = 10.462; [PsyPost](https://www.psypost.org/learning-from-ai-summaries-leads-to-shallower-knowledge-than-web-search/)).
- **O fator decisivo é quem faz o trabalho de geração.**

Para o Monet, a consequência prática tem três partes:

- **Paridade, não diferencial:** chat com pastas e memória, "pergunte ao livro", citações e BYOK com OpenRouter.
- **Diferencial defensável:** a regra de curadoria aplicada ao produto inteiro, o fichamento como artefato e o local-first no Windows.
- **Lacunas que o mercado já normalizou:** flashcards e revisão espaçada, citações clicáveis até o trecho, MCP e mobile.

A tabela abaixo organiza os produtos por quem escreve o registro. É uma leitura analítica, não uma categoria oficial.

| Arquétipo | Quem escreve o registro | Exemplos (detalhes na seção b) |
|---|---|---|
| A. A IA produz ou organiza o artefato | a IA, com o usuário revisando depois | Gemini Notebook (Studio, agente), Recall, Mymind, Mem 2.0, Fabric, Keep Live, Notion Agent e Custom Agents, Evernote AI Assistant, agente e AI Tutor do Heptabase, Craft (Execute), Copilot for Obsidian V4 (modo Auto) |
| B. A IA aumenta a nota do usuário | o usuário escreve o esqueleto e a IA gera a versão final | Granola (abas "My notes" e "Enhanced") |
| C. IA convocada, com curadoria resposta a resposta | o usuário, por clique ou aprovação | Readwise Ghostreader, MarginNote 4, Reflect (paleta), chat do Gemini Notebook ("Save to note"), OneNote + Copilot ("Add to doc"), Capacities, Tana (diffs), Craft (Explore), Notion inline e "suggest edits", Keep ("Insert"), Agent Client e Copilot (Safe/Plan) no Obsidian, plugin GPT do Logseq |
| D. Assistente geral como "segundo cérebro" | o chat e a memória são o registro | ChatGPT, Claude, Gemini, Perplexity |
| E. Agentes externos escrevem via MCP | um agente fora da interface de curadoria do app | Reflect (agentes de código), Notion MCP, conectores do Capacities, MCP do Heptabase com escrita, conector do Microsoft 365 com write tools no Claude |

O Monet se encaixa no arquétipo C. A diferença é que nele a curadoria é regra de arquitetura, e não um recurso, e o chat é descartável por desenho.

## (b) Produtos: o que cada IA faz, quem escreve o registro e quanto custa

Cada ficha segue os nove itens do briefing:

1. o que a IA faz;
2. padrão de interação;
3. quem escreve o artefato permanente;
4. ancoragem;
5. memória;
6. modelos, BYOK, modelos locais e privacidade;
7. preço da IA;
8. novidades de 2025–2026;
9. críticas.

Quando um item não tem dado, ele aparece com [não verificado]. Os preços estão em USD e trazem a data da verificação. A seção (e) consolida tudo numa tabela.

### b.1 AI-native de notas e conhecimento: a maioria automatiza o registro

#### Gemini Notebook (ex-NotebookLM), do Google

O Google **renomeou o NotebookLM para Gemini Notebook em 2026-07-16**. Segundo a empresa, ele segue como "standalone product focused on being your premier research tool", com mais de 30 milhões de usuários e mais de 600 mil organizações ([9to5Google, 2026-07-16](https://9to5google.com/2026/07/16/notebooklm-gemini-notebook/)). O endereço `notebooklm.google` redireciona para `notebook.google`, que se apresenta como "AI Research Tool & Thinking Partner" ([notebook.google](https://notebook.google/)).

- **1. O que a IA faz.**
  - **Chat ancorado nas fontes do usuário**, com citações. As fontes podem ser PDF, Docs, Slides, Sheets, Word, ePub, web, YouTube, áudio, ebooks do Play Books e chats do Gemini. Cada fonte aceita até 500 mil palavras ou 200 MB, e o plano gratuito permite até 50 fontes ([ajuda: fontes](https://support.google.com/gemininotebook/answer/16215270?hl=en)).
  - **Studio**, que gera artefatos com um clique:
    - **Audio Overviews** nos formatos Deep Dive, Brief, Critique e Debate, em mais de 80 idiomas, inclusive "Portuguese (Brazil)". Há um modo interativo "Join", só em inglês ([ajuda: áudio](https://support.google.com/gemininotebook/answer/16212820?hl=en)).
    - **Video Overviews** nos formatos Cinematic, Explainer e Short ([ajuda: vídeo](https://support.google.com/gemininotebook/answer/16454555?hl=en)).
    - **Mind Maps**, desde 2025-03-27 ([9to5Google](https://9to5google.com/2025/03/27/notebooklm-mind-map/)).
    - **Reports** ([ajuda: reports](https://support.google.com/gemininotebook/answer/18323649?hl=en)).
    - **Flashcards e Quizzes**, com opção "explain" e citações ([9to5Google, 2025-09-08](https://9to5google.com/2025/09/08/notebooklm-flashcards-quizzes/)).
    - **Infographics e Slide Decks**, com exportação em PPTX ([9to5Google, 2026-02-20](https://9to5google.com/2026/02/20/notebooklm-slide-prompts/)).
    - **Data Tables** ([9to5Google, 2025-12-19](https://9to5google.com/2025/12/19/notebooklm-gemini-3-data-tables/)).
  - **Discover sources.** O Fast Research busca e o usuário escolhe o que importar. O Deep Research "can automatically browse up to hundreds of websites on your behalf" ([ajuda: fontes](https://support.google.com/gemininotebook/answer/16215270?hl=en)).
  - **Agente (desde jun/2026, com Gemini 3.5 + Antigravity).** Cada notebook ganha um "secure cloud computer" que escreve e roda código, com "more than 100 curated software skills". Ele exporta DOCX, XLSX e PPTX e pode buscar fontes na web e adicioná-las ao notebook ([9to5Google, 2026-06-08](https://9to5google.com/2026/06/08/notebooklm-gemini-3-5-antigravity/)).
  - **Learning Guide**, um estilo de chat socrático que "encourages participation with probing, open-ended questions" ([9to5Google, 2025-09-08](https://9to5google.com/2025/09/08/notebooklm-flashcards-quizzes/)).
- **2. Padrão de interação.**
  - Três painéis, Sources, Chat e Studio, desde 2024-12-13 ([9to5Google](https://9to5google.com/2024/12/13/notebooklm-redesign-plus-tier/)).
  - Chat separado, com voz no mobile.
  - Botões de geração no Studio.
  - Agente: Deep Research, Antigravity e "Connected apps". Sobre estes, a ajuda diz: "If an app is connected and enabled, Gemini Notebook automatically uses it." ([ajuda: connected apps](https://support.google.com/gemininotebook/answer/18784282?hl=en)).
  - Proatividade leve: perguntas sugeridas no chat (fev/2026), Reports que "dynamically suggest options based on the theme" e auto-rotulagem de fontes a partir de cinco fontes.
  - **Não há comando inline nem slash dentro das notas.**
- **3. Quem escreve o permanente.**
  - **Nas notas, nada entra sem ação do usuário.** Uma resposta do chat só vira nota com **"Save to note"** ([ajuda: chat](https://support.google.com/gemininotebook/answer/16179559?hl=en)). Uma nota só vira fonte com "Convert". No Deep Research, é o usuário quem escolhe o que importar.
  - **Os artefatos do Studio e os arquivos do agente são escritos inteiramente pela IA.**
  - **As notas são o elo fraco do produto.**
    - "Saved response notes are editable once citations are removed."
    - "The Gemini Notebook mobile app does not support note editing at this time." ([ajuda: notas](https://support.google.com/gemininotebook/answer/16262519?hl=en))
    - "there's currently no way to recover deleted notes" ([FAQ](https://support.google.com/gemininotebook/answer/16269187?hl=en))
  - Desde set/2026, as notas ficam "alongside sources" ([blog.google, 2026-09-15](https://blog.google/innovation-and-ai/products/gemini-notebook/new-study-tools-september-2026/)).
  - Não se sabe se o agente pode criar ou editar notas, ou adicionar fontes da web sem confirmação [não verificado].
- **4. Ancoragem.** É forte. A ajuda diz: "uses direct quotes, text, and images from your sources as citations", e clicar numa citação leva ao trecho no contexto ([ajuda: chat](https://support.google.com/gemininotebook/answer/16179559?hl=en)). Mas a documentação se contradiz:
  - A mesma página afirma que "Chat responses in Gemini Notebook only use data from your sources".
  - Ela também diz que o chat funciona "with or without sources" e lista ações agênticas como "searching the web, running code".
  - O FAQ promete: "If the answer isn't in the source material, it won't provide a response."
- **5. Memória.**
  - O histórico de chat é salvo automaticamente desde o anúncio de 2025-10-29 ([blog.google](https://blog.google/technology/google-labs/notebooklm-custom-personas-engine-upgrade/)).
  - Cada notebook monta uma "knowledge base" com "the files you add, the outputs you generate, and your chat history" ([ajuda: privacidade](https://support.google.com/gemininotebook/answer/17004255?hl=en)).
  - As instruções personalizadas de cada notebook valem também no app Gemini e no AI Mode ([ajuda: notebooks no Gemini](https://support.google.com/gemininotebook/answer/17003757?hl=en)).
  - **O chat é persistente, não descartável.**
- **6. Modelos, BYOK, local e privacidade.**
  - **Modelos:** só Gemini hospedado. A sequência foi 2.5 Flash (mai/2025), Gemini 3 (dez/2025), 3.1 Pro para pagantes (fev/2026) e 3.5 (jun/2026). Para mídia, usa Nano Banana e Veo 3.
  - **Não há BYOK nem modelo local.**
  - **Contas pessoais:** o conteúdo "will not be used to directly train our foundational AI models". Se o usuário enviar feedback, vão junto o conteúdo e "any Gemini chats included in your notebook context, even if your Gemini Apps Activity is turned off". Esse material passa por revisão humana e fica retido por até 3 anos ([ajuda: privacidade](https://support.google.com/gemininotebook/answer/17004255?hl=en)).
  - **Workspace e Education:** sem revisão humana e sem treino.
- **7. Preço da IA.** A IA vem embutida.
  - O plano grátis "Standard" dá 100 notebooks e 50 fontes por notebook ([ajuda: planos](https://support.google.com/gemininotebook/answer/16213268?hl=en)).
  - Limites maiores vêm com os planos Google AI. Nos EUA, verificados em 2026-10-17 ([gemini.google](https://gemini.google/us/subscriptions/?hl=en)):
    - Plus: US$ 4,99/mês, preço em vigor desde 2026-06-08 ([9to5Google](https://9to5google.com/2026/06/08/google-ai-plus-price-drop/));
    - Pro: US$ 19,99/mês;
    - Ultra: US$ 99,99/mês (5× o Pro) ou US$ 199,99/mês (20× o Pro). O antigo plano de US$ 249,99 passou a custar US$ 200 em 2026-05-19 ([9to5Google](https://9to5google.com/2026/05/19/google-ai-ultra-100/)).
  - Desde 2026-09-02 vale o limite por computação, renovado a cada 5 horas, com teto semanal ([ajuda: limites](https://support.google.com/gemininotebook/answer/17670842?hl=en)). O Google não publica números absolutos.
  - Universitários dos EUA ganham 1 ano de AI Pro, e estudantes de mais de 140 mercados ganham 1 ano de AI Plus, com resgate até 2026-12-31.
- **8. Novidades de 2025–2026.**
  - 2025:
    - 03-27: Mind Maps.
    - 04-02: Discover sources.
    - 05-19: apps mobile.
    - 07-29: Video Overviews.
    - 09-08: Flashcards, Quizzes e Learning Guide.
    - 10-29: chat com 1 milhão de tokens e personas.
    - 11-13: Deep Research.
    - 12-19: Gemini 3 e Data Tables.
  - 2026:
    - 03-04: Cinematic Video Overviews.
    - 04-08: notebooks no app Gemini, liberados para usuários grátis em 04-17 ([blog.google](https://blog.google/innovation-and-ai/products/gemini-app/notebooks-gemini-notebooklm/)).
    - 06-08: Antigravity.
    - 07-16: rename para Gemini Notebook.
    - 08-27: ebooks do Play Books como fonte, via "Expert Intelligence" ([9to5Google](https://9to5google.com/2026/08/27/gemini-notebook-play-books/)).
    - 09-02: limites por computação.
    - 09-15: conversa por voz, gravador de aulas, notas ao lado das fontes e novos formatos de quiz ([blog.google](https://blog.google/innovation-and-ai/products/gemini-notebook/new-study-tools-september-2026/)).
- **9. Críticas.**
  - **Trustpilot:** nota 2,5/5, mas com **só 11 avaliações** ([Trustpilot](https://www.trustpilot.com/review/notebooklm.google)). Exemplos:
    - "NotebookLM constantly introduces information from external sources that were never uploaded or selected by the user." (2026-09-28)
    - "NotebookLM was really good Gemini ruined it" (título, 2026-08-25)
    - Contraponto de 5★: "the best educational tool available" (2025-10-23)
  - **Crítica acadêmica:** Jill Walker Rettberg, na *Media, Culture & Society*, argumenta que os Audio Overviews seguem um template fixo e convertem contextos culturais a um padrão americano ([arXiv:2511.08654](https://arxiv.org/abs/2511.08654)).
  - **Processo:** o jornalista David Greene teria processado o Google, alegando que os Audio Overviews imitam sua voz (Washington Post, 2026-02-15) [não verificado: 403].
  - **Avisos do próprio Google:** "Gemini Notebook can make mistakes and do unexpected things."
- **Leitura para o Monet.**
  - O "Save to note" equivale ao "Anotar".
  - O Learning Guide e os quizzes são IA de aprofundamento.
  - Mas o produto gira em torno de artefatos feitos pela IA e de um chat persistente que alimenta a base. A nota do usuário é secundária.

#### Mem (Mem 2.0)

- **1. O que a IA faz.**
  - Em 2025-10-01 o Mem 2.0 se reposicionou como "AI thought partner": "Chat can create, edit, and organize notes for you." / "It's not just conversation—it's actual action." ([Mem](https://get.mem.ai/blog/introducing-mem-2-0)).
  - Tem Heads Up ("Notes automatically resurface at exactly the right moment"), modo de voz, deep search e funciona offline-first.
  - Em 2026 se vende como **"Your AI chief of staff"**. O Mem Agent "builds a living picture of your tasks, projects, and goals" e manda nudges proativos ("No schedules or prompt-tuning required"). Há também Custom Routines, Connections e Push-to-Remember em Mac e Windows ([get.mem.ai](https://get.mem.ai/)).
- **2. Interação.** A lógica é capturar primeiro. O agente trabalha em segundo plano e "decide when to reach out". Há chat flutuante, voz e canais externos (WhatsApp, e-mail).
- **3. Quem escreve o permanente.** **A IA, direto.** O post de 2025-11-19 descreve merges semânticos e arquivamento e exclusão em lote ("gives you the confidence to delete them without manually checking every single one"; "You set the strategy; the AI does the heavy lifting.") ([Mem blog](https://get.mem.ai/blog/ai-knowledge-base-refactoring)). Etapa de aprovação ou undo: [não verificado].
- **4. Ancoragem.** Notas, reuniões, páginas salvas e apps conectados.
- **5. Memória.** O próprio produto é a memória, com "Connections it maintains for you".
- **6. Modelos e privacidade.** Os modelos não são divulgados [não verificado]. Tem SOC 2 Type II. Não há BYOK nem modelo local conhecidos.
- **7. Preço (verificado em 2026-10-17, mensal)** ([pricing](https://get.mem.ai/pricing)):
  - Free: 25 mensagens/mês, 25 notas novas e 3 h de voz;
  - Plus: US$ 9;
  - Pro: US$ 29 (100 mensagens, 1 routine, 1 connection, 25 h de voz);
  - versões ampliadas do Pro: 2× US$ 49, 5× US$ 99, 10× US$ 149 e 20× US$ 199;
  - unidade extra: US$ 50.
- **8. Novidades.**
  - Mem 2.0 (2025-10-01);
  - refatoração da base por IA (2025-11-19);
  - Claude Connector e "Your favorite LLMs can now use your second brain as context" (sem data) ([Mem blog](https://get.mem.ai/blog));
  - reposicionamento como "chief of staff" (2026, data exata não verificada).
- **9. Críticas.** [não verificado: sem acesso a Reddit e reviews].
- **Leitura.** É o oposto explícito da tese do Monet: IA proativa que escreve e organiza a base.

#### Reflect (Reflect Classic → Reflect Open)

- **1. O que a IA faz.** Tem ([reflect.app](https://reflect.app/)):
  - "Ask your notes" (⌘J), com respostas que "cite source notes";
  - resumir e melhorar a escrita;
  - prompts customizados salvos, com editor desde 2025-07-08;
  - transcrição de voz;
  - resumos de links salvos, desde 2025-09-23.
- **2. Interação.** Paleta de IA convocada. O mockup oficial mostra as ações "Custom", "Re-run", "Insert", "Copy" e "Replace". Há também o chat "Ask your notes". Nada é proativo.
- **3. Quem escreve o permanente.**
  - **Na paleta, o usuário escolhe Insert, Replace ou Copy.** É curadoria por resposta, muito próxima do "Inserir" do Monet.
  - **Mas, desde 2026-04-28, agentes externos via MCP (Claude Code, Cursor, Codex) podem editar notas.** Eles inserem, substituem linhas, apagam intervalos, renomeiam notas e marcam tasks. O post não descreve aprovação, diff nem undo ([Reflect blog](https://reflect.app/blog/edit-notes-with-coding-agents)).
- **4. Ancoragem.** Notas do usuário, com citação da nota-fonte. Notas marcadas com `private: true` nunca são enviadas à IA, e isso é garantido no código ([privacy.md](https://github.com/team-reflect/reflect-open/blob/master/docs/privacy.md)).
- **5. Memória.** [não verificado].
- **6. Modelos, BYOK e local.** O **Reflect Open** foi anunciado em 2026-07-14 pelo CEO Alex MacCaw ([Reflect](https://reflect.app/blog/reflect-open); [GitHub](https://github.com/team-reflect/reflect-open)):
  - licença MIT e arquitetura local-first;
  - notas em Markdown numa pasta escolhida, com índice SQLite em `.reflect/`;
  - sem conta e sem servidor da Reflect;
  - BYOK com "OpenAI, Anthropic, Google, or OpenRouter". Nas palavras da empresa, "Reflect proxies nothing";
  - embeddings calculados no dispositivo (opcional) e chaves guardadas no keychain do sistema;
  - sync por iCloud Drive ou git;
  - plataformas: Mac (beta), iOS (TestFlight), extensão Chrome e **builds experimentais não assinados para Windows** e Linux.

  A versão 0.15.0 (2026-10-13) traz "Claude Sonnet 5.5 and GPT-6.1 Sol" ([releases](https://github.com/team-reflect/reflect-open/releases)).
- **7. Preço.** "Free on Mac. No subscription required." O app mobile deve ser pago no futuro. "AI usage is billed separately by your provider." O Reflect Classic (E2EE, sync proprietário) continua mantido. O valor histórico de cerca de US$ 10/mês não foi reverificado.
- **8. Novidades.**
  - editor de prompts (2025-07-08);
  - resumos de links (2025-09-23);
  - MCP para coding agents (2026-03-10);
  - edição de notas por agentes (2026-04-28);
  - Reflect Open (2026-07-14).

  A justificativa oficial: o formato antigo atrapalhava a evolução "as Markdown became the common language for both people and AI".
- **9. Críticas.** [não verificado].
- **Leitura.** É o concorrente com arquitetura mais parecida com a do Monet. Não tem leitor de livros nem foco em estudo, e abre as notas para agentes externos escreverem.

#### Saner.AI

- **1. O que a IA faz.** O assistente "Skai" ([saner.ai](https://www.saner.ai/)):
  - organiza notas, conecta ideias e lembra o que importa;
  - transforma e-mails em tasks e brain dumps em planos;
  - sugere tags e pastas;
  - oferece Smart Inbox, chat sobre notas, e-mails e calendário ("We use your notes, emails, calendar as data to give you the most relevant answers") e Reasoning Mode.
- **2. Interação.** É proativo ("automatically reminds you of what's important"). A versão 1.5 (nov/2025) trouxe "Proactive planning, Outlook connector, and more!".
- **3. Quem escreve o permanente.** As sugestões de tags e pastas são proativas. Se a IA edita sem ação do usuário: [não verificado].
- **4. Ancoragem.** Notas, e-mails, calendário, Google Drive e Slack.
- **5. Memória.** [não verificado].
- **6. Modelos e privacidade.** "Access to External AIs" (GPT, Claude, Gemini) é cobrado por token ou feito com chave própria (BYOK opcional). A empresa declara: "We do not train, sell, or share your data".
- **7. Preço (verificado em 2026-10-17)** ([pricing](https://www.saner.ai/pricing)):
  - Free: 30 mensagens/mês e 100 notas;
  - Starter: US$ 8/mês (30 mensagens/dia);
  - Standard: US$ 16/mês ("Unlimited*", 100 requisições/dia);
  - plano anual com 20% de desconto.

  Público declarado: "AI Personal Assistant for ADHDers".
- **8. Novidades.** v1.5 (nov/2025). O produto ainda era "beta" em 2026-10-17.
- **9. Críticas.** [não verificado].

#### Recall (getrecall.ai → recall.it)

- **1. O que a IA faz.** ([recall.it](https://www.recall.it/pricing)):
  - resume páginas, vídeos, podcasts e PDFs salvos;
  - faz auto-tagging e conexões automáticas num knowledge graph;
  - tem chat sobre a base, sobre a internet ou sobre os dois;
  - "Augmented Browsing", que mostra conteúdo salvo relacionado enquanto o usuário navega;
  - **quizzes com spaced repetition**;
  - Listen Mode;
  - no plano Max, ações em lote sobre até 100 itens.
- **2. Interação.** Quase tudo é automático: resumo ao salvar, tags e links. A isso se somam o chat convocado e os quizzes.
- **3. Quem escreve o permanente.** **A IA.** O resumo gerado vira o card salvo, e tags e links também são automáticos. Edição ou aprovação: [não verificado].
- **4. Ancoragem.** A base do usuário e, opcionalmente, a web.
- **5. Memória.** A própria base funciona como memória de longo prazo.
- **6. Modelos.** A escolha de modelo (ChatGPT, Claude, Gemini) só existe no Max. API e MCP estão em todos os planos, inclusive o grátis. BYOK não é mencionado.
- **7. Preço (verificado em 2026-10-17, cobrança anual).**
  - Free: 10 resumos/mês;
  - Plus: US$ 10/mês;
  - Max: US$ 38/mês.
- **8. Novidades.** O domínio mudou para recall.it [data não verificada]. MCP em todos os planos.
- **9. Críticas.** [não verificado].
- **Leitura.** É o caso mais claro de "a IA define a informação" no nicho de aprendizado: o resumo da IA é o registro. Ao mesmo tempo, mostra que há demanda por revisão espaçada.

#### Fabric (fabric.so)

- **1. O que a IA faz.** ([fabric.so](https://fabric.so/)):
  - é um "AI workspace" em que tudo o que se salva é "automatically extracted and enriched by Fabric's intelligence" ("No tagging. No manual organization.");
  - tem o Fabric Memory Engine;
  - busca semântica, visual e dentro de transcrições;
  - agentes com nome, personalidade e agenda, cada um com caixa de e-mail própria;
  - ações em apps conectados e mais de 50 integrações.
- **2. Interação.** Automática e proativa, com agentes agendados, chat dentro do documento, canvas e CLI.
- **3. Quem escreve o permanente.** Os agentes "read notes, draft replies, update roadmaps". Mecanismo de aprovação: [não verificado].
- **4. Ancoragem.** Arquivos do usuário e apps conectados (Drive, Figma, Notion, Dropbox).
- **5. Memória.** Fabric Memory Engine.
- **6. Modelos.** Uma assinatura dá acesso a Gemini, OpenAI, Claude, DeepSeek, xAI, Kimi, Qwen e outros. A empresa declara criptografia AES-256 em repouso.
- **7. Preço.** [não verificado]. A página de preços não renderizou, e a home diz "Try for $0".
- **8. Novidades.** Mudança de "self-organizing workspace" para workspace com agentes [datas não verificadas].
- **9. Críticas.** [não verificado].

#### Khoj

- **1. O que a IA faz.** "Your AI second brain. Self-hostable." ([GitHub](https://github.com/khoj-ai/khoj)):
  - chat com modelos locais ou online;
  - respostas a partir da internet e dos arquivos do usuário (PDF, Markdown, Notion, Word, org-mode);
  - agentes, deep research, automações agendadas, busca semântica e voz.
- **2. Interação.** Chat separado, agentes e automações. Funciona no navegador, no Obsidian, no Emacs, no desktop, no celular e no WhatsApp.
- **3. Quem escreve o permanente.** Lê os arquivos. A escrita nas notas não é descrita [não verificado].
- **4. Ancoragem.** Arquivos do usuário e web.
- **5. Memória.** [não verificado].
- **6. Local e BYOK.** Licença AGPL-3.0, "Khoj is open-source, self-hostable. Always." Tem nuvem em app.khoj.dev e cerca de 37,7 mil estrelas. O plugin para Obsidian soma 54.765 downloads ([estatísticas do Obsidian](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json)).
- **7. Preço da nuvem.** [não verificado].
- **8. Novidades.** A empresa agora destaca outros produtos: Pipali (Beta), "Your AI co-worker", e Open Paper ("Your research workbench") ([khoj.dev](https://khoj.dev/)) [datas não verificadas].
- **9. Críticas.** [não verificado].

#### Reor

- **1. O que a IA faz.** Notas em Markdown locais. Usa LLMs locais (Ollama) ou APIs compatíveis com OpenAI, liga notas relacionadas por similaridade e oferece Q&A com RAG e busca semântica ([GitHub](https://github.com/reorproject/reor)).
- **2. Interação.** Sidebar proativa de notas relacionadas e chat com RAG.
- **3. Quem escreve o permanente.** [não verificado].
- **4. Ancoragem.** Notas locais.
- **5. Memória.** [não verificado].
- **6. Local.** Totalmente local ("Everything is stored locally"). AGPL-3.0, cerca de 8,5 mil estrelas.
- **7. Preço.** Grátis (open source).
- **8. Status.** **Arquivado:** "This repository was archived by the owner on Mar 7, 2026. It is now read-only."
- **9. Críticas.** [não verificado].
- **Leitura.** O projeto mais próximo de "notas locais com IA local" morreu sem modelo de negócio.

#### Napkin (napkin.one) e o homônimo napkin.ai

- **1. O que a IA faz.** Organiza ideias em tópicos: "just collect good ideas and Napkin will sort them around topics"; "your personal AI understands your ideas deeply, and suggests topics you're interested in" ([napkin.one](https://napkin.one/)).
- **2. Interação.** O usuário captura (compartilhando, escaneando um livro, ditando ou digitando). A IA organiza, e um feed propõe "short moments of reflection".
- **3. Quem escreve o permanente.** O usuário captura e a IA só organiza: "Is Napkin a writing tool? It isn't."
- **4 a 6.** [não verificado].
- **7. Preço.** A home só diz "Start your free trial today" [não verificado].
- **8. Status.** Existe só no iPhone. O protótipo desktop saiu do ar: "On June 30th 2026 we had to switch it off." Não há Android.
- **9. Críticas.** [não verificado].
- **O napkin.ai é outro produto.** É uma "visual communication platform" que transforma texto em diagramas e mind maps ([napkin.ai](https://www.napkin.ai/pricing)):
  - Free: 500 créditos/semana;
  - Plus: US$ 9/pessoa/mês (10.000 créditos);
  - Pro: US$ 22/pessoa/mês (30.000 créditos);
  - "approximately 1 credit charged per word selected for generation".

  Serve de referência para o /mindmap do Monet.

#### Mymind

- **1. O que a IA faz.** Classifica automaticamente o que é salvo ("Just save it. Artificial Intelligence takes care of the rest."). Também ([mymind.com](https://mymind.com/)):
  - resume e enriquece o conteúdo;
  - busca por associação (cor, marca, data);
  - cria Smart Spaces que se organizam sozinhos;
  - tem Serendipity, que traz de volta itens esquecidos;
  - marca imagens e faz OCR.
- **2. Interação.** Totalmente automática: "Remember everything. Organize nothing."
- **3. Quem escreve o permanente.** As tags e os resumos da IA são anexados ao item automaticamente, sem etapa de aprovação descrita. Não é uma ferramenta de escrita.
- **4. Ancoragem.** O próprio acervo.
- **5. Memória.** O próprio acervo [detalhes não verificados].
- **6. Privacidade.** A empresa diz "We put privacy first". O processamento de IA não é detalhado [não verificado].
- **7. Preço (verificado em 2026-10-17)** ([pricing](https://access.mymind.com/pricing)):
  - Student of Life: US$ 7,99/mês ou US$ 79/ano;
  - Mastermind: US$ 12,99/mês ou US$ 129/ano ("Advanced AI", AI Summaries, PDF Analyzer);
  - The Bookmarker: US$ 4,99, sem IA.
- **8 e 9.** [não verificado].

#### Elephas

- **1. O que a IA faz.** Cria "Private Brains" a partir dos documentos do usuário, com respostas que citam as fontes ([pricing](https://elephas.app/pricing)). Os recursos históricos Super Brain e Smart Write não aparecem na página atual.
- **2. Interação.** Assistente de sistema no Mac [não verificado].
- **3. Quem escreve o permanente.** [não verificado].
- **4. Ancoragem.** Documentos do usuário, com fontes.
- **5. Memória.** [não verificado].
- **6. BYOK, local e privacidade.** "Your own API key or an on-computer model". "Personal details hidden before cloud AI". Sync E2EE opcional.
- **7. Preço (verificado em 2026-10-17).**
  - Personal: US$ 19/mês (US$ 15/mês no anual);
  - Professional: US$ 29/mês (US$ 24 no anual);
  - Team: US$ 29/pessoa/mês.

  Os planos incluem uma cota mensal de "Elephas AI" não quantificada. Só existe para Mac, com "Windows coming soon".
- **8 e 9.** [não verificado].

#### Rewind e Limitless

O site informa: "Limitless has been acquired by Meta" ([limitless.ai](https://www.limitless.ai/)).

- **1. O que a IA fazia.** Seguia o modelo "grave tudo e a IA lembra por você", com captura de tela e áudio no Rewind e o Pendant da Limitless [descrição funcional não reverificada nesta pesquisa].
- **2 a 6.** Não se aplicam mais.
- **7. Preço.** Clientes existentes têm plano Unlimited grátis durante 2026.
- **8. Status.**
  - As vendas do Pendant acabaram em 2025-12-05. O suporte continua "throughout 2026".
  - Desktop e web não gravam mais.
  - Rewind: "The latest update disables all screen and audio capture starting December 19, 2025."
  - O serviço foi encerrado em 2025-12-05 em várias regiões, **incluindo Brasil**, UE e Reino Unido. O prazo para exportar foi até 2025-12-19. Depois disso, "account and all associated information will be permanently deleted".
- **9. Críticas.** [não verificado].
- **Leitura.** É o argumento mais forte para local-first: usuários de várias regiões perderam acesso com duas semanas de prazo.

#### Granola

O Granola é a referência de "a IA aumenta a nota do usuário".

- **1. O que a IA faz.** Se define como "AI notepad for back-to-back meetings" ([granola.ai](https://www.granola.ai/); [blog](https://www.granola.ai/blog)):
  - transcreve o áudio do computador sem bot ("doesn't invite a bot");
  - o usuário escreve durante a reunião e depois aciona "Generate notes", que gera as abas "My notes" e "Enhanced";
  - Briefs pré-reunião (2026-05-20);
  - Granola Chat ("Perfect meeting memory"), reconstruído como agente com citações inline em 2026-04-21;
  - Recipes, prompts salvos (2025-09-30);
  - Spaces de equipe.
- **2. Interação.** O usuário escreve, e a IA é convocada depois da reunião. Há chat sobre reuniões e pastas, e os Briefs são proativos.
- **3. Quem escreve o permanente.** A IA gera a versão "Enhanced" a partir das notas brutas e da transcrição, e a versão "My notes" fica separada. A ajuda atual, verificada em 2026-10-17, diz ([ajuda](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes)):
  - "If you took raw notes, they will be highlighted in black";
  - "Use the magnifying glass beside each note to see where in the transcript or raw notes the note came from";
  - dá para editar a versão Enhanced direto ou editar as notas brutas e regenerar ("will take your edits into consideration").

  Uma versão anterior da ajuda, recuperada por busca, descrevia o texto da IA em cinza e o do usuário em preto. A página atual não menciona o cinza. Não se confirmou se regenerar sobrescreve edições manuais [não verificado].
- **4. Ancoragem.** Transcrição e notas do usuário. O chat tem citações inline desde 2026-04.
- **5. Memória.** Histórico de reuniões: 30 dias no Basic, ilimitado nos planos pagos.
- **6. Modelos e privacidade.** "Standard models" no Basic. O Business tem "advanced AI thinking models" e seleção de modelo no chat. Há opt-out de treino por usuário e retenção configurável. Não há BYOK.
- **7. Preço (verificado em 2026-10-17)** ([pricing](https://www.granola.ai/pricing)):
  - Basic: US$ 0 (30 dias de histórico; o MCP só acessa notas pessoais desse período);
  - Business: US$ 14/usuário/mês;
  - Enterprise: US$ 35/usuário/mês.
- **8. Novidades.**
  - 2025-05-14: Series B de US$ 43 milhões, com valuation de US$ 250 milhões, e Granola 2.0 ([TechCrunch](https://techcrunch.com/2025/05/14/ai-note-taking-app-granola-raises-43m-at-250m-valuation-launches-collaborative-features/));
  - 2025-09-30: Recipes;
  - 2026-02-04: MCP;
  - 2026-03-25: rodada de US$ 125 milhões;
  - 2026-04-21: chat agêntico;
  - 2026-05-20: Briefs, em Mac e Windows;
  - 2026-07-01: Android;
  - 2026-07-28: Apple Watch.
- **9. Críticas.** [não verificado].
- **Leitura.** O Granola prova que o padrão "a nota do usuário é o esqueleto" vende. Mas a IA ainda produz a versão final. A curadoria aqui é editar depois, não escolher resposta por resposta.


### b.2 IA dentro dos grandes e dos PKM: agentes que escrevem, com freios opcionais

#### Notion AI

Em outubro de 2026, a Notion AI é uma **plataforma de agentes**, não mais um assistente de escrita. Para usar tudo, é preciso o plano Business (US$ 20/membro/mês) ou o Enterprise.

- **1. O que a IA faz.**
  - **Notion Agent** (Notion 3.0, 2025-09-18). A promessa é "anything you can do in Notion, your Agent can do for you". Ele é "capable of over 20 minutes of multi‑step actions", "updating or creating hundreds of pages at once" ([release 2025-09-18](https://www.notion.com/releases/2025-09-18)).
    - Faz: cria e edita páginas, views e propriedades; lê comentários, histórico de versões e arquivos (PDF, CSV, XLSX, DOCX, PPTX, ZIP); age em Gmail, Calendar, Slack e servidores MCP.
    - Não faz: criar automações, fórmulas ou botões, nem mudar permissões ([ajuda: Agent](https://www.notion.com/help/notion-agent)).
  - **Custom Agents** (3.3, 2026-02-24). São "completely autonomous (no manual prompting)" e disparam por agenda ou por eventos: página adicionada a uma database, mudança de propriedade, comentário, "An AI Meeting Note is finished", mensagem no Slack ([release 2026-02-24](https://www.notion.com/releases/2026-02-24); [ajuda: Custom Agents](https://www.notion.com/help/custom-agents)).
  - **Enterprise Search** busca no workspace, nos apps conectados e na web ([ajuda](https://www.notion.com/help/enterprise-search)).
  - **Research mode** (2025-05-13) "analyzes all of your sources (your workspace plus your connected tools)" e a web para redigir documentos. Na página de preços aparece como "Beta" ([release 2025-05-13](https://www.notion.com/releases/2025-05-13)).
  - **AI Meeting Notes** (bloco `/meet`): transcreve, resume e lista "key points and action items", com citações da transcrição ([ajuda](https://www.notion.com/help/ai-meeting-notes)).
  - **AI Autofill** em databases ([ajuda](https://www.notion.com/help/autofill)):
    - Basic: resumo, tradução e tags; "does not browse the web";
    - Custom Agent Autofill: instruções em várias etapas e busca na web.
  - **Outros recursos:**
    - imagens (2026-03-09) e skills reutilizáveis (2026-03-20);
    - dashboards criados por descrição;
    - Plan Mode (2026-05-07);
    - no 3.6 (2026-07-01): blocos HTML interativos "such as calculators and quizzes" e External Agents, que permitem a Claude e Cursor receber tarefas ([releases, p. 2](https://www.notion.com/releases/page/2); [p. 4](https://www.notion.com/releases/page/4); [p. 5](https://www.notion.com/releases/page/5)).
  - **Não há flashcards nem quizzes nativos para estudo.**
- **2. Padrão de interação.**
  - **Inline:** "press the `space` key on a new line and enter a prompt", ou "highlight the text and select `Edit with AI`". Também há o `/AI Block` ([guia](https://www.notion.com/help/guides/notion-ai-for-docs); [FAQ](https://www.notion.com/help/notion-ai-faqs)).
  - **Chat** lateral ou flutuante ("Find the friendly face at the bottom of Notion"), com histórico.
  - **Skills com `/` (desde 2026-09-15):** o Agent pode "build skills from a prompt, suggest them from your work, and run them with `/`" ([releases](https://www.notion.com/releases)). Entre os grandes, é o padrão mais próximo dos /comandos do Monet.
  - **Agentes autônomos** em segundo plano.
  - **Automatismos:** o Autofill roda "manually, on page create, or on page edits" ou por agenda, e o resumo de reunião "will automatically start generating".
- **3. Quem escreve o permanente.**
  - **Inline.** "Notion AI writes directly on the page". Depois, o usuário pode "accept, discard, or ask it to try again" ([guia](https://www.notion.com/help/guides/notion-ai-for-docs)).
  - **Agent: edita direto, por padrão** ("You can ask your Agent to edit pages, update databases").
    - A única confirmação descrita é para exclusões: "It'll confirm any page deletions if you want to remove something" ([guia do Agent](https://www.notion.com/help/guides/get-started-with-your-personal-agent-in-notion)).
    - No Gmail, "Write actions (like sending) will ask you to confirm". No Slack, o agente "acts as you".
  - **"Suggest edits" (2026-08-28, opt-in).** "Your agents can now propose changes instead of making them directly." O usuário aprova as mudanças "top to bottom". A página não diz que isso virou o padrão ([release 2026-08-28](https://www.notion.com/releases/2026-08-28)).
  - **Plan Mode (2026-05-07).** O agente faz perguntas e monta um plano "before making large changes".
  - **Histórico de versões com atribuição a agentes (3.8, 2026-10-13).** "Review what changed, see who changed it, and restore prior versions with a quick click" ([release 2026-10-13](https://www.notion.com/releases/2026-10-13)).
  - **Custom Agents.** "changes are visible and reversible", mas a ajuda "doesn't describe an approval step for agent actions".
  - **Autofill** escreve direto nas propriedades, com a opção "Only fill this property if it is empty".
  - **Não há regra de produto separando um chat descartável do registro.**
- **4. Ancoragem.**
  - O Enterprise Search "will always cite its sources" e, por padrão, busca em todas as fontes, web incluída ([ajuda](https://www.notion.com/help/enterprise-search)).
  - O Agent usa como contexto a página atual, o que for chamado com `@` e "All sources".
  - Quando não acha a resposta no workspace, recorre a conhecimento geral (paráfrase da ajuda) ([guia geral](https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai)).
  - Os embeddings são gerados "using zero-retention LLMs" e guardados no Turbopuffer ([segurança](https://www.notion.com/help/notion-ai-security-practices)).
- **5. Memória.**
  - Uma página de Instructions ("My Notion AI") é usada "in every chat".
  - Desde o 3.0, "it remembers over time, so you don't have to keep repeating yourself".
  - A página de Instructions não descreve escrita automática de memória pelo agente ([ajuda](https://www.notion.com/help/instructions-for-notion-agent)).
- **6. Modelos, BYOK e privacidade.**
  - **Vários modelos, atualizados quase todo mês.**
    - Claude Sonnet 4 e GPT-5 no 3.0.
    - Gemini 3 Pro (2025-11-19).
    - MiniMax M2.5, open-weight, nos Custom Agents (2026-03-03).
    - Em 2026-10-13: "Seven new models all added, including GPT 6.1-Sol, GPT-6 Luna, Opus 5.5, and Sonnet 5.5" ([release 2026-10-13](https://www.notion.com/releases/2026-10-13)).
  - **Créditos.** Modelos premium gastam créditos "at each provider's published rates, with no markup" ([ajuda](https://www.notion.com/help/manage-ai-models-and-member-credit-spend)).
  - **Quase-BYOK (2026-10-13).** "If you have ChatGPT Plus or Pro, your subscription can now cover your AI usage in Notion" ([ajuda](https://www.notion.com/help/use-your-chatgpt-plan-with-notion-agent)). As condições:
    - só nos planos Business e Enterprise;
    - por login, não por chave de API;
    - só com modelos GPT;
    - não vale para Custom Agents.
  - **Chave de API própria ou modelo local:** sem evidência.
  - **Privacidade.** "By default, your customer data is not used to train models". O provedor retém os dados por "30 days or fewer" em Free, Plus e Business. No Enterprise, a maioria dos modelos tem zero retention ([segurança](https://www.notion.com/help/notion-ai-security-practices)).
- **7. Preço (verificado em 2026-10-17).**
  - **Planos:** Free US$ 0; Plus US$ 10/membro/mês; Business US$ 20/membro/mês; Enterprise sob consulta ([pricing](https://www.notion.com/pricing)). A página não deixa claro se os valores são da cobrança anual. O rastreador PricingSaaS indica "billed annually" ([PricingSaaS](https://pricingsaas.com/companies/notion)). Valores mensais: [não verificado].
  - **IA por plano.**
    - Free e Plus só têm "Limited Trial" do Agent, do Meeting Notes, do Enterprise Search e do Research mode. A FAQ diz: "Notion AI is available on Business and Enterprise Plans" ([FAQ](https://www.notion.com/help/notion-ai-faqs)).
    - Desde 2025-05-13, Business e Enterprise incluem "unlimited usage of Notion AI" ([release](https://www.notion.com/releases/2025-05-13)).
  - **Custom Agents:** "Free to try, then $10 per 1,000 monthly Notion credits", cobrados desde 2026-05-04 ([release 2026-04-14](https://www.notion.com/releases/2026-04-14)). Controles de gasto existem desde 2026-05-05.
  - Cobrança dos Workers: [estado atual não verificado].
- **8. Novidades de 2025–2026.**
  - **2025**
    - 05-13: Meeting Notes, Enterprise Search, Research mode e IA no Business.
    - 08-19: modo offline e MCP para ChatGPT, Claude e Cursor.
    - 09-18: Notion 3.0, com Agents.
  - **2026**
    - 01-20: IA no mobile.
    - 02-24: Custom Agents.
    - 05-04: começam os créditos.
    - 05-13: Developer Platform, com Workers, External Agents API, Agent SDK e CLI ([TechCrunch](https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/)).
    - 06-25: anúncio do fim do Notion Mail "amid agent takeover", com encerramento em 2026-09-22 ([TechCrunch](https://techcrunch.com/2026/06/25/notion-mail-shuts-down-amid-agent-takeover/)).
    - 07-01: Notion 3.6.
    - 08-28: "suggest edits".
    - 09-15: Notion 3.7, com skills.
    - 10-13: Notion 3.8, com histórico de versões com atribuição, pagamento pelo plano do ChatGPT e MCP com "150+ MCP tools".
- **9. Críticas.**
  - **Segurança.** Simon Willison resumiu uma pesquisa em que texto branco escondido num PDF fazia o agente montar uma URL com dados de clientes e enviá-la pela busca web. Para ele, o 3.0 "introduces new prompt injection data exfiltration vulnerabilities thanks to enabling lethal trifecta attacks" ([Willison, 2025-09-19](https://simonwillison.net/2025/Sep/19/notion-lethal-trifecta/)).
  - **Hacker News (set/2025)** ([HN](https://news.ycombinator.com/item?id=45304816)):
    - "how do I even know if it has hallucinated if it can do anything anywhere in the workspace?"
    - "Note taking is supposed to be a map of my brain."
    - "why would I want my team generating/reading AI slop in our Wiki??"
  - **Trustpilot: 2,2/5 em 439 avaliações** ([Trustpilot](https://www.trustpilot.com/review/notion.so)):
    - "you need to buy extra credits after one smarter AI prompt." (2026-10-03)
    - A IA "struggles to create simplicity." (2026-07-21)
  - **Dependência de terceiros.** Em 2026-06-07, a Notion desligou todos os modelos da Anthropic por cerca de 12 h ([TechCrunch](https://techcrunch.com/2026/06/07/notion-restores-access-to-anthropic-after-service-disruption/)).
  - Reação à retirada da IA do Plus em mai/2025: [não verificado; Reddit inacessível].
- **Leitura.** O Notion confirma o PRD no comportamento padrão: o Agent age e escreve. A curadoria chega depois, em camadas opcionais (accept/discard inline, suggest edits, Plan Mode, histórico). O produto é feito para empresas e equipes. O autodidata fica no Free ou no Plus, só com trial.

#### Microsoft OneNote + Copilot

- **1. O que a IA faz.**
  - **Resume páginas** e "cites the sources for its response" ([resumo](https://support.microsoft.com/en-us/OneNote/copilot-pages/summarize-your-onenote-notes-with-microsoft-365-copilot)).
  - **Extrai to-dos** ([to-do](https://support.microsoft.com/en-us/OneNote/copilot-pages/create-a-to-do-list-and-tasks-in-onenote-with-copilot)).
  - **Reescreve** com "Rewrite page" ou "Rewrite this" ([reescrita](https://support.microsoft.com/en-us/OneNote/copilot-pages/rewrite-text-with-copilot-in-onenote)).
  - **Monta planos de projeto.**
  - **Copilot Notebooks** ("an AI-powered workspace for a project or topic") também chegaram ao OneNote. As novidades de out/2026 ([Notebooks, out/2026](https://techcommunity.microsoft.com/blog/microsoft-copilot-blog/whats-new-in-notebooks--october-2026/4559105)) são:
    - criar um notebook a partir de um objetivo;
    - tarefas que criam e editam arquivos Word, Excel e PowerPoint;
    - automações agendadas e escolha de modelo;
    - Audio Overviews no formato "Critique and Debate", a partir de páginas do OneNote e do Loop;
    - "suggested artifacts".

    Parte disso só existe no programa Frontier.
- **2. Padrão de interação.**
  - **Painel lateral** ("The Copilot pane opens on the right side of OneNote") e **menu de clique direito**.
  - Slash na página: [não verificado].
  - Proatividade: só os "suggested artifacts" dos Notebooks.
  - Em 2026-09-01, a Microsoft publicou "Text predictions off by default in Word and Outlook". Só o título foi lido ([Insider Blog](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/text-predictions-off-by-default-in-word-and-outlook/4549085)).
- **3. Quem escreve o permanente.** **Com aprovação.**
  - O resumo fica no painel ("places the summary in the Copilot pane").
  - O to-do tem só o botão "Copy".
  - A reescrita só entra na página com **"Add to doc"**, no ponto do cursor ([reescrita](https://support.microsoft.com/en-us/OneNote/copilot-pages/rewrite-text-with-copilot-in-onenote)).
  - A posição oficial é dar ao usuário "a chance to review the generated AI rather than fully automating these tasks" ([Learn: privacidade](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-privacy)).
  - Exceção: nos Notebooks, o Copilot cria e edita arquivos do Office.
- **4. Ancoragem.**
  - Usa o Microsoft Graph e "only surfaces organizational data to which individual users have at least view permissions". Na web, consulta o Bing.
  - No OneNote, a documentação cobre só a página. Seção ou caderno inteiro: [não verificado].
- **5. Memória.**
  - O histórico de atividade fica salvo e pode ser apagado.
  - Os Notebooks são persistentes, um por projeto.
  - Custom instructions: [não verificado].
- **6. Modelos e privacidade.**
  - Usa modelos de terceiros (Anthropic, OpenAI), conforme o admin escolher.
  - Em set/2026, os títulos do blog anunciam Claude Opus 5.5, GPT-6 Sol, GPT-6.1 Sol e Sonnet 5.5 ([blog](https://techcommunity.microsoft.com/category/microsoft365copilot/blog/microsoft365copilotblog)).
  - Nas empresas, prompts e respostas "aren't used to train foundation LLMs". Os modelos da Anthropic ficam fora do EU Data Boundary.
  - No consumidor: [não verificado].
  - Não há BYOK nem modelo local.
- **7. Preço (verificado em 2026-10-17).**
  - **Consumidor** ([comparação](https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products)):
    - Microsoft 365 Personal: US$ 9,99/mês ou US$ 99,99/ano. Inclui "Copilot in Word, Excel, PowerPoint, Outlook, and OneNote desktop apps".
    - Family: US$ 12,99/mês ou US$ 129,99/ano.
    - Premium: US$ 19,99/mês ou US$ 199,99/ano.
  - **Limites** só aparecem em faixas (Standard, More, Extensive, Highest) ([uso de IA](https://support.microsoft.com/topic/68530f1a-4459-4d02-9818-8233c1f673b8)).
  - **Microsoft 365 Pro:** preço [não verificado].
  - **Empresas:** Copilot Enterprise a US$ 30 e Copilot Business a US$ 23,50 por usuário/mês, cobrança anual ([Copilot](https://www.microsoft.com/en-us/microsoft-365-copilot)).
  - **Copilot Credits:** em 2026-09-25, a Microsoft anunciou créditos para "advanced AI". Detalhes: [não verificado] ([post](https://techcommunity.microsoft.com/blog/microsoft-copilot-blog/evolution-of-the-copilot-pricing-model/4559416)).
- **8. Novidades.**
  - 2025-01-16: Copilot entra no Personal e no Family, com aumento de US$ 3/mês e planos "Classic" ([blog](https://www.microsoft.com/en-us/microsoft-365/blog/2025/01/16/copilot-is-now-included-in-microsoft-365-personal-and-family/)).
  - 2025-10-01: lançado o Microsoft 365 Premium; o Copilot Pro sai de linha ([blog](https://www.microsoft.com/en-us/microsoft-365/blog/2025/10/01/meet-microsoft-365-premium-your-ai-and-productivity-powerhouse/)).
  - 2025-10-14: o OneNote for Windows 10 fica somente leitura ([suporte](https://support.microsoft.com/en-us/office/what-is-happening-to-onenote-for-windows-10-2b453bfe-66bc-4ab2-9118-01e7eb54d2d6)).
  - Set/2026: renomeação para "Microsoft Copilot" ([Learn](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-licensing)).
  - 2026-10-09: nova experiência dos Notebooks no OneNote.
- **9. Críticas.**
  - **Processo da ACCC na Austrália (2025).** A ACCC processou a Microsoft alegando que cerca de 2,7 milhões de assinantes foram enganados ([CRN Australia](https://www.crn.com.au/news/2025/software/microsoft-accc-m365-court-battle)):
    - os planos Classic, sem Copilot, só teriam aparecido no fluxo de cancelamento;
    - o Personal teria subido de A$ 109 para A$ 159.
  - **Pedido de desculpas e reembolsos:** [não verificado diretamente] ([Business News Australia](https://direct.businessnewsaustralia.com/articles/microsoft-apologises-and-offers-refunds-after-accc-copilot-action.html)).
  - Qualidade e alucinação no OneNote: [não verificado].
- **Leitura.** É a referência honesta para o gesto "Inserir" do Monet, e dentro do app de notas padrão do Windows. Faltam o foco em aprofundamento, BYOK e IA local.

#### Apple Intelligence no Apple Notes

- **1. O que a IA faz.**
  - **Writing Tools** (Rewrite, Proofread e Summarize), desde o iOS 18.1 (2024-10-28).
  - **Áudio:** grava, transcreve e resume ([Newsroom, 2024-10-28](https://www.apple.com/newsroom/2024/10/apple-intelligence-is-available-today-on-iphone-ipad-and-mac/)).
  - **Image Wand:** "Transform rough sketches into images in virtually any style right in Notes" ([Apple Intelligence](https://www.apple.com/apple-intelligence/)).
  - **WWDC25:** ChatGPT integrado ao Writing Tools e à Siri, e resumos de áudio automáticos (paráfrase) ([Newsroom, 2025-06-09](https://www.apple.com/newsroom/2025/06/apple-intelligence-gets-even-more-powerful-with-new-capabilities-across-apple-devices/)).
  - **iOS 27 (2026-09-14):**
    - "Write with Siri virtually anywhere you type", que gera rascunhos ou comenta o texto ([iOS](https://www.apple.com/ios/));
    - "Proofread as you type";
    - Siri AI com contexto pessoal e ações em apps ("add a recipe to the Notes app") ([Newsroom: Siri AI](https://www.apple.com/newsroom/2026/06/apple-introduces-siri-ai-a-profoundly-more-capable-and-personal-assistant/)).
  - **Não há chat nem perguntas sobre as notas dentro do Notes, nem flashcards.**
- **2. Padrão de interação.** Três modos:
  - sob demanda, sobre o texto selecionado;
  - automático: resumo de transcrição e revisão contínua;
  - assistente de sistema (Siri AI).
- **3. Quem escreve o permanente.**
  - As Writing Tools agem sobre o texto do usuário. Se a interface substitui ou copia, e se há undo: [não verificado].
  - O Image Wand gera a imagem na nota.
  - O resumo de áudio é automático.
  - A Siri pode criar ou acrescentar conteúdo por comando.
- **4. Ancoragem.**
  - Texto selecionado, índice Spotlight no aparelho e web.
  - Citações: não documentadas.
- **5. Memória.**
  - Usa o contexto pessoal guardado no aparelho.
  - A Siri ganhou um app para rever conversas, fora da UE ([Newsroom: DMA](https://www.apple.com/newsroom/2026/06/due-to-dma-siri-ai-delayed-in-eu-for-ios-27-and-ipados-27/)).
  - Não há memória de IA no Notes.
- **6. Modelos e privacidade.**
  - **Modelos:** Apple Foundation Models, no aparelho e no Private Cloud Compute.
  - **Parceria com o Google** desde 2026-01-12 ([declaração conjunta](https://blog.google/company-news/inside-google/company-announcements/joint-statement-google-apple/)). O release de 2026-06-08 fala em modelos "custom-built in collaboration with Google and its Gemini models" ([Newsroom](https://www.apple.com/newsroom/2026/06/apple-intelligence-brings-powerful-ai-capabilities-into-everyday-experiences/)).
    - Conflito: a Wikipedia atribui a Craig Federighi a afirmação de que a nova Siri não usa os modelos nem a infraestrutura do Gemini ([Wikipedia](https://en.wikipedia.org/wiki/Apple_Intelligence)).
  - **Private Cloud Compute:** "personal data is not stored nor made accessible to Apple or anyone else".
  - **Escolha do usuário:** não há BYOK; o ChatGPT é opcional.
- **7. Preço.**
  - Grátis em aparelhos compatíveis.
  - Recursos que rodam em servidor têm "daily usage limits". "Increased access is available with most iCloud+ subscription plans" ([Newsroom, 2026-06-08](https://www.apple.com/newsroom/2026/06/apple-intelligence-brings-powerful-ai-capabilities-into-everyday-experiences/)).
  - "Expanded access to such features will be available for a fee in the future" ([suporte](https://support.apple.com/en-us/121115)).
  - Preço do iCloud+ para isso: [não verificado].
  - Idioma: português do Brasil suportado. A Siri AI está em beta, só em inglês.
- **8. Novidades.**
  - 2025-01-27 (iOS 18.3): resumos de notícias desativados.
  - 2025-06-09: WWDC25.
  - 2026-01-12: parceria com o Google.
  - 2026-06-08: WWDC26.
  - 2026-09-14: lançamento do iOS 27.
- **9. Críticas.**
  - **Resumos de notificação errados** em 2024–2025. A BBC reclamou de um resumo falso sobre Luigi Mangione (via Wikipedia).
  - **John Gruber (2025-03-12):** "That level is called vaporware" ([Daring Fireball](https://daringfireball.net/2025/03/something_is_rotten_in_the_state_of_cupertino)).
  - **Ação coletiva *Landsheft v. Apple*,** com acordo em princípio em 2025-12-18 (via Wikipedia).
  - **Siri AI fora da UE** por causa do DMA.
  - Críticas à IA dentro do Notes: [não verificado].

#### Google Keep + Gemini

- **1. O que a IA faz.**
  - **"Help me create a list"** e **"Generate title"** ([ajuda: lista](https://support.google.com/keep/answer/15222789?hl=en); [ajuda: título](https://support.google.com/keep/answer/14626262?hl=en)).
  - **Keep Live (2026):** "automatically organizes your spoken input into new notes or updates existing ones" ([ajuda: Keep Live](https://support.google.com/keep/answer/17499364?hl=en)).
  - **Conector do app Gemini:** "Create and get your notes and lists from Google Keep" ([ajuda Gemini](https://support.google.com/gemini/answer/15229592?hl=en)).
- **2. Padrão de interação.**
  - Botões dentro do editor.
  - Um botão flutuante abre o Keep Live, uma experiência de voz em tela cheia.
  - Chat separado no app Gemini.
  - Não há painel lateral. Em 2026-01-03, um editor do 9to5Google escreveu: "I don't think we'll ever see the Gemini side panel come to Google Keep." ([9to5Google](https://9to5google.com/2026/01/03/recap-google-keep-2025/)).
- **3. Quem escreve o permanente.** Depende do recurso.
  - **Lista: com aprovação.** O usuário toca **"Insert"**.
  - **Título:** é gerado sem etapa de aceite descrita.
  - **Keep Live: sim.** A IA cria notas ou atualiza as existentes ("Keep will just add bananas to your existing list.") ([9to5Google, 2026-09-03](https://9to5google.com/2026/09/03/gmail-docs-keep-live/)). O usuário revisa, edita por voz e toca "Done".
  - **App Gemini:** salva no Keep sem confirmação descrita.
- **4. Ancoragem.** O que o usuário digita ou fala. Sem citações.
- **5. Memória.** O Keep não tem memória própria. A integração com o Gemini exige a Keep Activity ligada.
- **6. Modelos e privacidade.**
  - Usa "the underlying Gemini model". Não há BYOK nem modelo local.
  - O Keep não aparece pelo nome entre os apps cobertos pelos compromissos de não treinar dos planos Google AI ([ajuda](https://support.google.com/keep/answer/14615114?hl=en)).
  - No app Gemini, em contas pessoais, a atividade pode ser usada para "training generative AI models". A retenção padrão é de 18 meses ([Privacy Hub](https://support.google.com/gemini/answer/13594961?hl=en)).
- **7. Preço.**
  - O Keep é grátis. A IA exige um plano Google AI ou um Pixel, e as fontes divergem sobre qual:
    - a ajuda da lista diz "with a Google AI plan";
    - outra página diz "Google AI Pro and Google AI Ultra, or a Pixel mobile device";
    - para o Keep Live, a ajuda diz Pro/Ultra, e o 9to5Google diz Plus, Pro ou Ultra.
  - Preços dos planos: Plus US$ 4,99, Pro US$ 19,99 e Ultra a partir de US$ 99,99 (2026-10-17).
- **8. Novidades.**
  - Em 2025 não houve recursos Gemini novos no Keep ([9to5Google](https://9to5google.com/2026/01/03/recap-google-keep-2025/)).
  - 2026-05-19: IA de voz anunciada no I/O ([9to5Google](https://9to5google.com/2026/05/19/google-keep-docs-live-pics/)).
  - 2026-09-03: o Keep Live começa a chegar, só no Android.
- **9. Críticas.** Comentários mais votados no 9to5Google ([9to5Google](https://9to5google.com/2026/06/04/google-keep-large-fab/)):
  - "Stop writing about putting AI into everything." (2026-01)
  - "Google assistant used to create notes to Google Keep without a subscription." (2026-06)

#### Evernote (v11, Bending Spoons)

- **1. O que a IA faz.**
  - **AI Assistant:** "Search, organize, and enrich your notes, all from a dedicated chat"; "Generate new content, organize notes, add tags, and more". Também usa a web ([recursos de IA](https://evernote.com/en-us/features/ai-features)).
  - **v11 (2026-01-19):** o Assistant cria, move e tagueia notas e pode "generate text in new or existing notes" ([v11](https://evernote.com/blog/introducing-v11)).
  - **Semantic Search.**
  - **AI Meeting Notes/Transcribe:** até 2 h, ao vivo, com chat durante a gravação.
  - **Primeiro semestre de 2026:** AI Prompts, AI Memory, ações em lote, diagramas Mermaid e MCP ([115+ melhorias](https://evernote.com/blog/115-improvements-since-v11)).
  - **AI Edit e AI Cleanup** (este só no mobile).
  - **Não tem flashcards.**
- **2. Padrão de interação.**
  - **Chat dedicado.** Prompts salvos são chamados com `/` dentro do chat ([11.35.6](https://evernote.com/en-us/release-notes/11.35.6)).
  - Cada recurso de IA pode ser ligado ou desligado nas configurações.
- **3. Quem escreve o permanente.**
  - **Sim:** o Assistant cria, escreve, move e tagueia.
  - Etapa geral de aprovação: [não verificado].
  - **Exceção documentada:** a versão 11.38.5 deixa o usuário "review the change before it is applied" ao renomear anexos e gravações ([release notes](https://evernote.com/release-notes)).
  - Termos de uso: "the AI Feature may generate incorrect information" ([termos](https://evernote.com/legal/supplemental-terms)).
- **4. Ancoragem.**
  - Notas e web. A Evernote indexou "3.2 billion notes" ([retrospectiva 2025](https://evernote.com/blog/2025-recap)).
  - Citações inline: [não verificado].
- **5. Memória.** AI Memory: "tell AI Assistant what matters once and it remembers".
- **6. Modelos e privacidade.**
  - "Developed in close collaboration with OpenAI". Os modelos não são nomeados.
  - "Your content is protected and never used to train AI models—by Evernote or anyone else".
  - Não há BYOK nem modelo local.
- **7. Preço.** Valores de um aviso da Evernote reproduzido no TidBITS (2026-07-11) e confirmados pelo UseCarly (2026-07-15), ambas fontes secundárias ([TidBITS](https://talk.tidbits.com/t/evernote-2026-price-tiers-floored-me/33792); [UseCarly](https://www.usecarly.com/blog/evernote-pricing/)):
  - Starter: US$ 99/ano ou US$ 14,99/mês;
  - Advanced: US$ 249,99/ano ou US$ 24,99/mês.

  O armazenamento do Starter diverge entre as fontes: 1 GB ou 5 GB. A IA vem em todos os planos, com "Monthly and per-chat usage limits"; os números estão numa FAQ inacessível.
- **8. Novidades.**
  - 2025: prévias no v10.
  - 2026-01-01: termos de IA.
  - 2026-01-19: v11.
  - Primeiro semestre de 2026: AI Prompts, AI Memory e MCP.
  - Jul/2026: migração de planos.
- **9. Críticas.**
  - **Trustpilot: 3,6 em 3.727 avaliações** ([Trustpilot](https://www.trustpilot.com/review/evernote.com)):
    - "Evernote keeps adding AI features I don't want or need and then taking away the features that are actually useful." (2026-10-10)
    - "Doubling, yes doubling their pricing." (2026-10-12)
    - "stop trying to add fancy features and silly AI gimmicks" (2026-09-28)
  - **TidBITS:** um usuário chamou a busca por IA de "useless and irrelevant". Outro acredita que o aumento "is going toward paying AI data credits".

#### Craft

- **1. O que a IA faz.**
  - O **Craft Assistant** se apresenta como "your thinking partner inside Craft". Responde sobre o Space, resume e navega. No modo Execute, edita, cria páginas e reorganiza ([ajuda](https://craft-support.mintlify.site/en/ai-assistant)).
  - Em 2026-03-09, passou a "edit your documents directly" e "continue working in the background" ([blog 3.3.10](https://www.craft.do/blog/craft-update-3-3-10)).
  - A página de marketing diz: "built to assist without taking over" ([craft.do/write](https://www.craft.do/write)).
- **2. Padrão de interação.**
  - Painel do Assistant, no documento ou no Space, com sessões paralelas em segundo plano.
  - Custom prompts e Preferences.
  - Gatilho inline ou slash: [não verificado]. Proatividade: nenhuma encontrada.
- **3. Quem escreve o permanente.** **Com aprovação no modo Explore e direto no Execute.**
  - **Explore** propõe e espera aprovação.
  - **Execute** aplica direto, só em macOS e iOS; Windows e Web estão como "coming later". ⌘Z desfaz a última ação inteira.
  - Só os modelos Fast e Max editam ([ajuda](https://craft-support.mintlify.site/en/ai-assistant/using)).
  - Qual modo é o padrão: [não verificado].
  - As sessões não viram documentos e ficam 30 dias no histórico.
- **4. Ancoragem.**
  - Documento, Space e Collections.
  - Citações e web: [não verificado].
- **5. Memória.**
  - **Preferences**, grátis desde 2026-06-05.
  - Sessões guardadas por 30 dias.
- **6. Modelos, BYOK e local.**
  - **Modelos:**
    - Core: só leitura;
    - Fast e Max: editam;
    - Local: Apple Foundation Model e Llama 3.2, sempre grátis e só leitura.
  - **IA no aparelho:** desde 2025-01-31, "none of your data is sent over the internet" ([blog](https://www.craft.do/blog/deepseek-r1-in-craft-assistant)).
  - **BYOK** desde 2026-06-05: OpenAI ("Sign in with ChatGPT" ou chave de API) e Anthropic, "even without a subscription" ([blog 3.4.4](https://www.craft.do/blog/craft-update-3-4-4)).
  - **Privacidade:** "We do not use your content to train AI models."
- **7. Preço.**
  - **Plus:** US$ 8/usuário/mês, cobrança anual. O valor vem do schema da homepage, porque a página de preços exibe BRL ([craft.do](https://www.craft.do/)).
  - **Créditos:** Free tem 15, vitalícios. Plus tem 50/mês.
  - **Top-ups:** US$ 10, US$ 40 e US$ 100 ([uso e limites](https://craft-support.mintlify.site/en/ai-assistant/usage)).
  - **BYOK** não consome a cota.
- **8. Novidades.**
  - 2025-11-27: camada de IA com API e MCP. O CEO diz que o Craft é "not an AI factory incentivized to push you to use more tokens" e que "Human first versus systems first is one of our strongest guiding principles." ([blog](https://www.craft.do/blog/your-content-is-yours)).
  - 2026-02-03: Craft Agents ([blog](https://www.craft.do/blog/introducing-craft-agents)).
  - 2026-06-05: BYOK e MCP v2.
  - 2026-06-27: a Polymarket compra o Craft Agents, e "Craft Docs continues to operate independently" ([Pragmatic Engineer](https://newsletter.pragmaticengineer.com/i/185980265/4-new-way-to-build-software)).
  - A data de abertura do Craft Agents diverge: 19/jan ou 03/fev.
- **9. Críticas.** Nenhuma verificável encontrada.

#### Capacities

- **1. O que a IA faz.**
  - Chat com contexto por `@`.
  - **AI Panel** para traduzir, reescrever ou resumir o texto selecionado.
  - Slash commands no chat (Summarize, Fix grammar).
  - Auto-tag que só escolhe tags já existentes.
  - Auto-fill de propriedades, acionado por botão ([docs](https://docs.capacities.io/reference/ai-assistant)).
  - Desde 2026-09-18, "AI chats that can edit and act" ([Release 71](https://capacities.io/whats-new/release-71)).
- **2. Padrão de interação.** Chat lateral, AI Panel sobre a seleção, slash no chat e botões. Nada roda sozinho em segundo plano.
- **3. Quem escreve o permanente.** **Com aprovação, por padrão.**
  - O AI Panel só insere o que o usuário escolher: copy, replace ou append.
  - No chat, "By default, you approve those changes before they land in your space." O Auto-approve é opcional. O undo usa o histórico de versões ([docs](https://docs.capacities.io/reference/ai-assistant)).
  - "approval previews appear for create and update actions" ([Release 69](https://capacities.io/whats-new/release-69)).
  - Diff: [não verificado].
  - Os chats ficam salvos como objetos do Space.
  - **Conectores externos (MCP)** têm "read and write access" sem aprovação por ação dentro do app ([conectores](https://docs.capacities.io/reference/ai-chat-connectors)).
- **4. Ancoragem.**
  - Contexto escolhido, backlinks, busca e web. As fontes da web podem virar objetos Weblink.
  - Citações inline: [não verificado].
- **5. Memória.** Os chats são persistentes, guardados como objetos. "Memory" global não é descrita.
- **6. Modelos e privacidade.**
  - **Modelos:** OpenAI, Anthropic, Gemini, xAI, Mistral, Deepseek e Moonshot, com modo "Auto".
  - **BYOK foi descontinuado em 2026-08-17.** O MCP é a alternativa sugerida ([Release 69](https://capacities.io/whats-new/release-69)).
  - **Privacidade:** "your content is not used to train models". A retenção é de até 30 dias. A IA é ligada por Space ([privacidade](https://docs.capacities.io/more/ai-privacy)).
- **7. Preço (verificado em 2026-10-17)** ([pricing](https://capacities.io/pricing)):
  - **Basic:** grátis, sem IA.
  - **Pro:** US$ 9,99/mês na página. O schema traz US$ 11,99/mês ou US$ 119,88/ano. Inclui um "Light monthly budget".
  - **Believer:** a partir de US$ 12,49/mês.
  - **Add-on Plus:** US$ 8,33/mês, cobrança anual. O budget equivale a "roughly what you pay for Plus, minus transaction fees". Top-ups exigem o Plus.
- **8. Novidades.**
  - 2026-04-14: Connectors em beta ([Release 62](https://capacities.io/whats-new/release-62)).
  - 2026-06-24: Connectors 2.0, com escrita ([Release 66](https://capacities.io/whats-new/release-66)).
  - 2026-08-17: add-on Plus e fim do BYOK.
  - 2026-09-18: chats que editam.
  - Marcos de 2025: [não verificado].
- **9. Críticas.** As reviews do Product Hunt são antigas e não falam de IA ([Product Hunt](https://www.producthunt.com/products/capacities/reviews)). Reação ao fim do BYOK: [não verificado].

#### Tana (Tana e Tana Outliner)

- **1. O que a IA faz.** A marca virou dois produtos.
  - **Tana (tana.inc)** agora é "an agentic meeting platform": "Work gets done in the meeting, not after." ([tana.inc](https://tana.inc/)).
    - Agentes criam documentos, abrem issues e atualizam um "context graph".
    - Há chat por documento e sugestões ao vivo ("During a meeting, Tana suggests what to do with what was just said").
    - Há briefs, voice agent e DM diária ([changelog](https://tana.inc/changelog)).
  - **Tana Outliner** é o outliner original ([outliner.tana.inc](https://outliner.tana.inc/)).
    - AI chat.
    - **AI command nodes** que "write the result back into Tana Outliner".
    - AI fields que se preenchem sozinhos.
    - Notetaker sem bot.
- **2. Padrão de interação.**
  - Tana: voz, chat no documento e proatividade explícita.
  - Outliner: chats, command nodes e campos automáticos.
- **3. Quem escreve o permanente.**
  - **Tana: com aprovação.** As propostas mostram diff, e a empresa afirma: "AI never changes anything without approval." Em 2026-08-21: "Reviewing what the AI proposed and correcting it are the same screen now."
  - **Outliner: sim.** Os command nodes escrevem direto. O Prompt Workbench deixa "preview exactly what gets sent and test results before running commands on real data".
- **4. Ancoragem.**
  - Tana: a reunião e o context graph. O resumo de fechamento "only quotes what was said in the meeting it is summarising".
  - Outliner: notas citadas com `@`.
- **5. Memória.** Tana: context graph persistente. Outliner: [não verificado].
- **6. Modelos e privacidade.**
  - Acesso aos "latest Claude, Gemini, and OpenAI models". Sem BYOK mencionado.
  - "No LLM training on your data".
  - O SOC 2 cobre o Tana, e "Tana Outliner is not in scope" ([pricing](https://tana.inc/pricing)).
- **7. Preço (verificado em 2026-10-17).**
  - **Tana:**
    - Free: "50 AI queries".
    - Pro: "$20 early bird", exibido ao lado de "$30 per user/month".
  - **Outliner** ([pricing do Outliner](https://outliner.tana.inc/pricing)):
    - Free: 500 créditos/mês.
    - Plus: US$ 8/mês, 2.000 créditos.
    - Pro: US$ 14/mês, 5.000 créditos.
    - Anual: "Save 22%". Há desconto educacional.
- **8. Novidades.**
  - Cisão da marca: "These are distinct products that share a brand name". Data: [não verificada].
  - Changelog do Tana com entradas de 2026-08-21 a 2026-10-08.
- **9. Críticas.**
  - **Product Hunt (~fim de 2025)** ([Product Hunt](https://www.producthunt.com/products/tana/reviews)):
    - "The ai integration is a real gamechanger."
    - "The only caveat is the learning curve and some missing QoL features."
  - **Sinal de migração** (fórum do Logseq, 2026-03-16): um usuário pensa em voltar do Tana para o Logseq porque o Claude lê seus arquivos Markdown ([fórum](https://discuss.logseq.com/t/logseq-md-or-logseq-db-mcp-for-claude/34881)).

#### Heptabase

O Heptabase é o concorrente com o posicionamento mais próximo do Monet no **aprofundamento**.

- **1. O que a IA faz.**
  - **Posicionamento.** A homepage diz: "an intelligent, visual knowledge base built for students, researchers, and lifelong learners." e "Ask AI to explain any sources, take notes, and organize your knowledge base for you." ([heptabase.com](https://heptabase.com/)).
  - **Chat com contexto escolhido** ([roadmap](https://wiki.heptabase.com/roadmap)):
    - cards, whiteboards, PDFs e seções, desde 2025;
    - a base inteira, desde 2025-11-24;
    - respostas com "reference links".
  - **AI actions sobre cards:** traduzir, resumir, criar mind map, "Study Guide".
  - **AI Agent (2026):**
    - edita cards, journal, tags, propriedades e whiteboards;
    - "Organize knowledge base" e "Personalized Instruction" (2026-07-23);
    - AI Skills de leitura (2026-08-14);
    - "LLM Wiki" em teste interno.
  - **AI Tutor** (v1.88.0, 2026-03-31): "An AI agent that guides you toward your goals through structured, personalized learning sessions." ([AI Tutor](https://heptabase.com/ai-tutor)).
  - **Leitura de PDF:** OCR, outline, highlights, Web card e Zotero.
  - **Livros longos:** a skill **`/break-down-book`** "creates whiteboard content backed by citations". O usuário revisa cada seção antes de seguir ([ajuda: livro longo](https://support.heptabase.com/en/articles/16762580-how-do-i-use-a-whole-book-or-long-pdf-with-heptabase-ai)).
- **2. Padrão de interação.**
  - Chat com seletor de contexto e de intervalo de páginas.
  - Ações ao passar o mouse sobre um card.
  - **Skills chamadas por slash.**
  - Perguntas sugeridas, opt-in, desde 2026-01-22. A justificativa: "Starting a conversation with AI can sometimes feel like staring at a blank page."
  - Proatividade: "AI suggestions for related cards" (2025-10-29). O agente pode "proactively search your current Space".
- **3. Quem escreve o permanente.** **Sim**, por agente e Tutor.
  - **Agent Mode** "can edit existing cards, create new cards". Nem aprovação, nem diff, nem undo são descritos ([newsletter 2026-05-29](https://wiki.heptabase.com/newsletters)).
  - **O Tutor escreve as notas das lições** no whiteboard.
  - A ajuda chega a sugerir um prompt de contenção: "Do not create or edit any cards, and do not continue beyond these pages". Aprovação dentro do app: [não verificado].
  - No `/break-down-book`, a revisão é seção a seção.
  - **MCP e plugins:** a escrita é opcional, conforme as permissões aprovadas na conexão ([ajuda: Claude](https://support.heptabase.com/en/articles/17574823-use-heptabase-with-claude-and-claude-code)).
  - **Custo:** ler é barato; editar consome créditos ou uso sob demanda.
- **4. Ancoragem.**
  - Fontes do usuário, com intervalo de páginas, reference links e conteúdo "backed by citations".
  - Busca semântica no Turbopuffer.
- **5. Memória.**
  - "Personalized Instruction" desde 2026-07-23.
  - O Tutor se adapta ao nível do usuário.
  - Memória gerida pela IA: [não verificado].
- **6. Modelos, BYOK e privacidade.**
  - **Modelos por plano.** O Pro tem "AI agent (Gemini models only)". O Premium tem GPT, Claude e Gemini ([pricing](https://heptabase.com/pricing)).
  - **BYOK** ([ajuda: BYOK](https://support.heptabase.com/en/articles/10505755-use-your-own-ai-api-keys)):
    - aceita OpenAI, Anthropic, Gemini, **OpenRouter** (sem as variantes `:free`; no agente desde 2026-07-24), endpoint HTTPS compatível e Vertex;
    - **não vale para o AI Tutor nem para o Voice Note**;
    - endpoints locais provavelmente não funcionam, porque o app exige URL HTTPS pública [inferência].
  - **Privacidade** ([ajuda: dados](https://support.heptabase.com/en/articles/10448141-is-my-data-safe-in-heptabase)):
    - não é E2EE, e os dados ficam na AWS;
    - "does not make a blanket promise of zero retention, no training, or one processing region across all providers.";
    - não há como excluir um card específico do alcance da IA.
- **7. Preço.** Página de ajuda "Plans and pricing", atualizada na semana de 2026-10-17 ([ajuda: planos](https://support.heptabase.com/en/articles/12990121-plans-and-pricing)).
  - **Planos (mensal / anual):**
    - **Pro:** US$ 11,99/mês ou US$ 107,88/ano. 100 créditos/mês, só Gemini.
    - **Premium:** US$ 23,99/mês ou US$ 215,88/ano. 1.800 créditos/mês.
    - **Premium+:** US$ 71,99/mês ou US$ 647,88/ano. 8.100 créditos/mês.
  - **O que os créditos cobrem:** Agent, Tutor, transcrições e voz.
  - **Depois dos créditos:** uso sob demanda.
  - **PDF:** o parsing não gasta créditos.
  - **Plataformas:** macOS, Windows, Linux, iOS e Android ([download](https://heptabase.com/download)).
- **8. Novidades.**
  - **2025**
    - 12-05: "Free AI usage for all users" e plano Premium.
    - 12-11: MCP.
  - **2026**
    - 03-24: Premium+.
    - 03-31: AI Tutor.
    - 04-22: CLI.
    - Maio: Agent Mode.
    - Julho: OpenRouter, edição de whiteboards e "Organize knowledge base".
    - 08-14: AI Skills.
    - 09-23: plugin para o ChatGPT.
    - 10-09: plugin para o Claude.
- **9. Críticas.**
  - **Product Hunt (antigo):** "Whiteboards with 100s of cards and pdf highlights are slow and laggy" ([Product Hunt](https://www.producthunt.com/products/heptabase/reviews)).
  - Críticas a créditos ou ao agente: [não verificado]. Não há fórum público.
- **Falas oficiais sobre IA e aprendizagem.**
  - **AMA de nov/2024:** o recurso dos sonhos seria "an AI tutor that can immediately understand my current level of knowledge and explain truly complex concepts." ([AMA](https://wiki.heptabase.com/ama-2024-11)).
  - **Newsletter de 2026-05-29:** a meta é "a Heptabase agent that understands what you're learning, what you might want to learn next, and where you're getting stuck".
  - **Ensaio do wiki:** "Only after going through this process does the knowledge truly become your own." ([wiki](https://wiki.heptabase.com/the-best-way-to-acquire-knowledge-from-readings)).
- **Leitura.** É o concorrente mais direto para a persona do Monet, com leitura, aprendizado, slash, BYOK com OpenRouter e app Windows. Há uma tensão interna: o ensaio diz que o entendimento vem de "deconstructing, reassembling", mas o agente faz isso pelo usuário [inferência].

#### Obsidian (sem IA embutida) e seus plugins

- **1. O que a IA faz.**
  - **O Obsidian não tem IA embutida.** Ele toca no assunto por três portas oficiais:
    - o **Interpreter** do Web Clipper, com BYOK que inclui Ollama e OpenRouter. "Obsidian does not gather or store any data about your requests" ([ajuda: Interpreter](https://obsidian.md/help/web-clipper/interpreter));
    - o **Obsidian CLI** (fev/2026): "Give agentic tools the ability to interact with your vault." ([CLI](https://obsidian.md/cli));
    - as **obsidian-skills** do CEO, com cerca de 49,7 mil estrelas ([GitHub](https://github.com/kepano/obsidian-skills)).
  - **Plugins de IA mais baixados em 2026-10-17** ([estatísticas](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json)):

    | Plugin | Downloads |
    |---|---|
    | **Copilot** | 2.656.647 |
    | **Claudian** | 2.437.193 |
    | **Smart Connections** | 1.240.654 |
    | Local REST API with MCP | 794.782 |
    | Text Generator | 588.909 |
    | Agent Client | 303.246 |
    | Smart Composer | 176.566 |
    | "Karpathy LLM Wiki" | 63.297 |

- **2. Padrão de interação.** Depende do plugin.
  - **Copilot V4** (2026-08-11): agentes Claude Code, Codex e opencode no painel, que "write results back to your notes" ([release 4.0.0](https://github.com/logancyang/obsidian-copilot/releases/tag/4.0.0)). Também traz "Live Relevant Notes", que é proativo ([4.0.6](https://github.com/logancyang/obsidian-copilot/releases/tag/4.0.6)).
  - **Claudian:** o vault vira o diretório de trabalho do agente.
  - **Smart Connections:** mostra notas relacionadas enquanto o usuário escreve.
  - **Text Generator:** trabalha com templates.
- **3. Quem escreve o permanente.** **Os agentes escrevem direto nos arquivos .md, com permissões e diffs.**
  - **Copilot V4** ([docs](https://docs.obsidiancopilot.com/agent-mode-and-tools/)):
    - tem os modos Safe, Plan e Auto;
    - mostra um card "Permission required" e depois um card "Files changed", com antes e depois;
    - undo não é documentado;
    - o vault é "the agent's working directory, not a security sandbox".
  - **Agent Client:** "Note edits show up as word-level diffs in the chat". O auto-allow vem desligado ([README](https://github.com/RAIT-09/obsidian-agent-client)).
  - **Claudian:** "word-level diff preview" ([README](https://github.com/YishenTu/claudian)).
  - **Smart Composer:** aplica sugestões "with a single click".
- **4. Ancoragem.** O vault, com busca semântica. O Copilot tem Inline Citations desde a 3.0.3 e o Miyo local.
- **5. Memória.** No Copilot, os Projects guardam "instructions, context, and chat history", e o `AGENTS.md` dá orientação duradoura.
- **6. BYOK e local.**
  - O Copilot grátis diz: "BYOK works without an account or license key". Modelos locais rodam via opencode, com Ollama ou LM Studio ([pricing](https://www.obsidiancopilot.com/en/pricing)).
  - Smart Connections e Local GPT são local-first.
  - O Smart Composer avisou sobre a restrição da Anthropic a OAuth de terceiros (jan/2026): "Use at your own risk." ([README](https://github.com/glowingjade/obsidian-smart-composer)).
- **7. Preço.**
  - O Obsidian é grátis.
  - **Copilot:**
    - Plus: US$ 14,99/mês ou US$ 139,99/ano;
    - Supporter: US$ 349,99, pagamento único, "Subject to 5-hour and weekly included usage limits".
  - **Smart Connections Pro:** [preço não verificado].
- **8. Novidades.**
  - Agent Client: 2025-09/11.
  - Smart Connections Pro: 2025-12-09.
  - obsidian-skills: 2026-01-02.
  - CLI: fev/2026.
  - Claudian 2.0: 2026-04-06.
  - Copilot V4: 2026-08-11.
- **9. Críticas.**
  - **Paywall do Smart Connections:** "paywalling free features, especially free local ollama-based processing, is bad practice (put lightly)." ([issue #1269](https://github.com/brianpetro/obsidian-smart-connections/issues/1269)).
  - **Fórum oficial:** um usuário pediu "NO AI ANYWHERE", e um moderador sugeriu "use the previous version before they added the AI cruft." ([fórum](https://forum.obsidian.md/t/ai-less-editing-toolbar/114217)).
  - **Bugs do Copilot V4:** "vanished chat histories" ([4.0.1](https://github.com/logancyang/obsidian-copilot/releases/tag/4.0.1)).
  - **O CEO, sobre a própria rotina:** "People have asked me if this could be automated with language models but I do not care to do so." ([stephango.com](https://stephango.com/vault)).

#### Logseq e seus plugins

- **1. O que a IA faz.**
  - **O Logseq não tem IA embutida.** A versão DB expõe um MCP server (desktop e CLI), um CLI headless e uma HTTP API ([anúncio 2026-04-24](https://logseq.io/p/e3YDyX5AYr); [fórum](https://discuss.logseq.com/t/how-is-logseq-s-official-development-aligning-with-the-emerging-agentic-ai-trend/34823)).
  - **Versões:**
    - Logseq 2.0 Beta (2026-07-13);
    - 2.0.2 (2026-10-07) ([releases](https://github.com/logseq/logseq/releases));
    - a versão Markdown virou "Logseq OG" e só recebe atualizações de segurança.
- **2. Padrão de interação.** Plugins.
  - **gpt3-openai:** popup `cmd+g` ou slash `gpt`.
  - **ollama-logseq:** comandos locais ("Summarize Block", "Make a flash card").
- **3. Quem escreve o permanente.** **Com aprovação no popup do gpt3-openai** (Insert, Replace ou Regenerate). **Direto** nos comandos `gpt-block` e `gpt-page`, que acrescentam a resposta automaticamente ([README](https://github.com/briansunter/logseq-plugin-gpt3-openai)).
- **4. Ancoragem.** O bloco ou a página.
- **5. Memória.** [não verificado].
- **6. BYOK e local.**
  - BYOK com OpenAI ou endpoint compatível. Ollama local.
  - A equipe diz: "Logseq DB is still Local First and Privacy first."
- **7. Preço.** O app e os plugins são grátis. Os convites de sync vão para quem apoia o projeto no Open Collective (US$ 15/mês).
- **8. Novidades.**
  - **Downloads** ([stats](https://raw.githubusercontent.com/logseq/marketplace/master/stats.json)):
    - gpt3-openai: 84.893, com último push em 2024-10-09;
    - ollama-logseq: 11.114;
    - os demais: menos de 13 mil cada.
  - **Markdown Mirror** (mai/2026).
- **9. Críticas.**
  - **Sem IA no núcleo:** "I personally hope the core app has no specific AI features whatsoever." (2026-02-26, 21 likes).
  - **Ética:** usuários objetam ao código gerado por LLM no próprio Logseq ([fórum](https://discuss.logseq.com/t/last-version-before-any-llm-generated-code-was-merged/35262)).
  - **De segunda mão:** circula a fala de que LLMs geram "80 percent of the code" [não verificado na fonte primária].



### b.3 Assistentes gerais com espaço de trabalho persistente: o chat virou o registro

Limitação: openai.com, chatgpt.com e help.openai.com bloquearam o acesso (403), então o ChatGPT foi verificado por TechCrunch, Wikipedia e cobertura de imprensa. As páginas da Perplexity não renderizaram; os dados vêm da Wikipedia e de guias de terceiros.

#### ChatGPT (OpenAI)

- **1. O que a IA faz.** Projects (arquivos e instruções por projeto) [datas não verificadas nesta sessão]; Canvas (documento ou código lado a lado) [não verificado nesta sessão]; deep research; Study Mode; Pulse; apps e conectores com MCP; e, desde jul/2026, o **ChatGPT Work**, um agente que monta apresentações, planilhas e documentos a partir de apps e arquivos conectados ([Wikipedia](https://en.wikipedia.org/wiki/ChatGPT)).
- **2. Padrão de interação.** Chat, canvas e agente. O **Pulse** (2025-09-25) é proativo: gera de 5 a 10 briefs durante a noite, em cards, a partir da memória e de conectores como Gmail e Google Calendar. Saiu primeiro para o Pro. A TechCrunch descreve a guinada para produtos "designed to work for users asynchronously instead of responding to questions", e Fidji Simo diz: "ChatGPT Pulse is the first step in that direction" ([TechCrunch](https://techcrunch.com/2025/09/25/openai-launches-chatgpt-pulse-to-proactively-write-you-morning-briefs/)).
- **3. Quem escreve o permanente.** Não há separação entre exploração e registro: o chat e a memória são o registro. No Canvas a IA edita o documento [não verificado nesta sessão].
- **4. Ancoragem.** Arquivos do projeto, web e conectores. Suporte a MCP em apps desde set/2025, no modo desenvolvedor ([Wikipedia](https://en.wikipedia.org/wiki/ChatGPT)).
- **5. Memória.** Desde 2025-04-10, além das "saved memories", o ChatGPT consulta o histórico de conversas (Plus e Pro primeiro; fora de Reino Unido, UE, EEE e Suíça no lançamento). O usuário pode desligar, gerenciar memórias, perguntar o que foi lembrado ou usar o Temporary Chat. Quem já tinha memória ligada recebeu o recurso ligado. Objetivo declarado: "you won't have to repeat information you've already shared with ChatGPT" ([TechCrunch](https://techcrunch.com/2025/04/10/openai-updates-chatgpt-to-reference-your-other-chats/)).
- **6. Modelos e privacidade.** Modelos próprios: GPT-5.3 a GPT-5.6 no 1º semestre de 2026; GPT-6 e GPT-6.1 em set/2026 (Wikipedia). Sem BYOK.
- **7. Preço.** Em 2026-01-16 o **ChatGPT Go** chegou aos EUA por US$ 8/mês, abaixo do Plus (US$ 20) e do Pro (US$ 200). No mesmo anúncio a OpenAI disse que testaria anúncios no Free e no Go ([Daring Fireball, 2026-01-16](https://daringfireball.net/linked/2026/01/16/chatgpt-go); [Constellation Research](https://www.constellationr.com/insights/news/openai-launches-chatgpt-go-ad-tests)). Preços de jan/2026, não reverificados em out/2026.
- **8. Novidades.**
  - 2025-04-10: memória com histórico;
  - 2025-07-29: Study Mode;
  - set/2025: MCP em apps;
  - 2025-09-25: Pulse;
  - out/2025: navegador Atlas;
  - 2026-01-07: ChatGPT Health;
  - 2026-01-17: anúncio de publicidade no Free, visível desde mar/2026 (US$ 1 bilhão em receita de anúncios reportado em ago/2026);
  - jul/2026: apps renomeados para "plugins" e lançamento do ChatGPT Work;
  - set/2026: GPT-6 (todos via [Wikipedia](https://en.wikipedia.org/wiki/ChatGPT)).
- **9. Críticas.** Anúncios baseados em conversas (CNN, 2026-01-16) e a revista Nature (2026-01-22) relatando "two years of academic work vanishing with a single click", ambos citados pela Wikipedia [não verificados na fonte primária]. O segundo caso reforça o argumento de que o chat não é lugar de conhecimento durável.
- **Aprendizado.** O **Study Mode** faz perguntas para testar a compreensão e, "in some cases", recusa a resposta direta até o aluno engajar. O aluno "can easily switch into the regular mode of ChatGPT" ([TechCrunch](https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt/)).

#### Claude (Anthropic)

- **1. O que a IA faz.**
  - Projects com conhecimento e instruções (até 5 no Free; compartilhamento em Team e Enterprise desde 2025-08-01);
  - Artifacts (embeddable desde 2025-08-21; artifacts de design, deck e documento em qualquer conversa e em todos os planos desde 2026-09-16);
  - criação e edição de Excel, PowerPoint, documentos e PDFs (2025-09-09);
  - Research (Pro em diante), connectors, Skills e o agente **Cowork** (marketplace de plugins em 2026-02-24) ([release notes](https://support.claude.com/en/articles/12138966-release-notes)).
- **2. Padrão de interação.** Chat, artifacts e agentes (Cowork, Claude in Chrome).
- **3. Quem escreve o permanente.** O artifact é gerado ou reescrito pela IA. Desde 2026-06-12 o usuário pode editar in-place os rascunhos do Claude no chat e no Cowork. Diff: [não verificado].
- **4. Ancoragem.** Arquivos do projeto, web e connectors. O diretório tinha 973 conectores em 2026-10-17 ([claude.com/connectors](https://claude.com/connectors)). O conector do Microsoft 365 ganhou write tools em 2026-07-07.
- **5. Memória.** Pelas release notes oficiais:
  - Team em 2025-09-11, com incognito chats excluídos da memória;
  - Enterprise em 2025-09-18;
  - Max em 2025-10-23 e Pro nas duas semanas seguintes;
  - **memória do histórico para todos, inclusive o Free, em 2026-03-02**;
  - entradas individuais e categorizadas em 2026-07-10;
  - memória entre chat e Cowork, com Topics editáveis e configuração de tópicos sensíveis, em 2026-08-25: "Memory is on by default for Free, Pro, and Max plans" ([release notes](https://support.claude.com/en/articles/12138966-release-notes)).
- **6. Modelos e privacidade.** Modelos próprios. Sem BYOK.
- **7. Preço (verificado em 2026-10-17)** ([pricing](https://claude.com/pricing)):
  - Free: US$ 0, com memória, connectors, artifacts e até 5 projetos;
  - Pro: US$ 20/mês ou US$ 17/mês no anual;
  - Max: a partir de US$ 100/mês (5× ou 20× o Pro);
  - Team Standard: US$ 25 por assento/mês (US$ 20 no anual); Team Premium: US$ 125 (US$ 100 no anual).
- **8. Novidades.** As da memória acima, mais Claude in Chrome (beta para todos os planos pagos em 2025-12-18) e Skills (2025-12-18 em diante).
- **9. Críticas.** [não verificado nesta sessão].
- **Aprendizado.** O **learning mode** começou no Claude for Education em 2025-04-02 ("guides students' reasoning process rather than providing answers") e virou a opção "Learning" para todos em ago/2025. O Claude Code ganhou os estilos "Explanatory" e "Learning" ([Anthropic](https://www.anthropic.com/news/introducing-claude-for-education); [Engadget](https://engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html)).

#### Gemini (app do Google)

- **1. O que a IA faz.** Gems (personas e instruções salvas; grátis para mais usuários em 2025-03-13; compartilháveis em 2025-09-18; **substituídos por Skills a partir de 2026-09-30**, com migração); Canvas (2025-03-18); Deep Research (aceita os arquivos do usuário como fonte desde 2025-05-20); Guided Learning; notebooks sincronizados com o Gemini Notebook (2026-04-08) ([release notes](https://gemini.google/release-notes/); [blog.google](https://blog.google/innovation-and-ai/products/gemini-app/notebooks-gemini-notebooklm/)).
- **2. Padrão de interação.** Chat, canvas e modos. "Personalizar" conecta mais de 40 apps (2026-10-13).
- **3. Quem escreve o permanente.** O chat e o Canvas são o registro [edição não verificada]. Pelo conector do Workspace, o Gemini salva notas no Keep a partir do chat, sem confirmação descrita (ver Keep).
- **4. Ancoragem.** Arquivos, apps Google (extensão do Keep em todos os idiomas desde 2025-03-03), notebooks e web.
- **5. Memória.** Consulta a conversas anteriores (2025-02-12); "lembre-se" de preferências em mais idiomas e personalização com histórico de busca (2025-03-13); conversas temporárias (2025-08-13); importação de memória e histórico de outros apps de IA (2026-03-26) ([release notes](https://gemini.google/release-notes/)).
- **6. Modelos e privacidade.** A página de planos dos EUA cita "Gemini 4 Argon", Pro e Flash; o Free usa Flash-Lite. Sem BYOK. Em contas pessoais, a atividade pode ser usada para treinar modelos, com retenção padrão de 18 meses (ver Keep).
- **7. Preço (EUA, verificado em 2026-10-17)** ([gemini.google](https://gemini.google/us/subscriptions/?hl=en)):
  - Free: US$ 0;
  - Google AI Plus: US$ 4,99/mês;
  - Google AI Pro: US$ 19,99/mês (4× os limites do Free, 1M de tokens de contexto, 5× mais Audio Overviews no Gemini Notebook);
  - Google AI Ultra: US$ 99,99/mês (5× o Pro) ou US$ 199,99/mês (20× o Pro).
  - No Brasil: Plus R$ 24,99, Pro R$ 96,99 e Ultra a partir de R$ 779,90 ([gemini.google](https://gemini.google/subscriptions/)).
- **8. Novidades.** Gems → Skills (2026-09-30); study notebooks no desktop (jun/2026) e no mobile (2026-08-19); importação de memória (2026-03-26).
- **9. Críticas.** [não verificado nesta sessão].
- **Aprendizado.** O **Guided Learning** (2025-08-06), sobre o LearnLM, faz perguntas abertas, divide em passos e usa imagens, vídeos e quizzes: "true understanding goes deeper than a single answer" ([blog.google](https://blog.google/outreach-initiatives/education/guided-learning/)).

#### Perplexity

- **1. O que a IA faz.** Busca com citações (o núcleo), Spaces, Pages e Labs [detalhes atuais não verificados]; o navegador Comet (jul/2025, grátis desde out/2025); o agente **Perplexity Computer** (fev/2026) ([Wikipedia](https://en.wikipedia.org/wiki/Perplexity_AI)).
- **2. Padrão de interação.** Busca e chat; agente.
- **3. Quem escreve o permanente.** As Pages são geradas pela IA [não verificado].
- **4. Ancoragem.** Web com citações; arquivos em Spaces (até 50 por space no Pro, segundo guias de terceiros) [não verificado em fonte oficial].
- **5. Memória.** [não verificado].
- **6. Modelos.** No Pro o usuário escolhe entre GPT-5.4, Claude 4.6 e Gemini 3.1 Pro (Wikipedia). Sem BYOK.
- **7. Preço.** Guias de terceiros de 2026 listam Pro a US$ 20/mês, Max a US$ 200/mês, Enterprise Pro a US$ 40 e Enterprise Max a US$ 325 por assento ([Finout](https://www.finout.io/blog/perplexity-pricing-in-2026)) [não verificado em fonte oficial]. Em fev/2026 a empresa abandonou os anúncios e passou a "subscription-first".
- **8. Novidades.** Comet grátis (out/2025); Perplexity Computer (fev/2026); fim dos anúncios (fev/2026).
- **9. Críticas.** Processos e acusações de scraping e de violação de direitos autorais (Forbes, Dow Jones/NY Post, Wired, NYT, BBC, Cloudflare, Yomiuri/Asahi/Nikkei e Reddit em out/2025), inclusive a alegação de citações alucinadas atribuídas a veículos ([Wikipedia](https://en.wikipedia.org/wiki/Perplexity_AI)).

**Leitura do bloco.** Os quatro convergiram para "projetos ou espaços + memória persistente + documento lado a lado + agentes + conectores". A memória virou padrão e, no Claude, vem ligada para consumidores. A proatividade cresce (Pulse, Daily Brief do Google). Os modos de estudo são toggles dentro do chat. Nenhum separa a exploração descartável do registro perene. Para o Monet, chat com pastas, system prompt e memória por pasta é **paridade** com Projects e Gems; o diferencial possível está no vínculo com notas perenes locais e na regra de curadoria.

### b.4 Análogos de leitura e estudo: onde a curadoria já existe

Estes produtos não estavam na lista do briefing. Entraram porque são os mais próximos da tese do Monet e decidem a avaliação da seção (f).

#### Readwise Reader / Ghostreader

- **1. O que a IA faz.** Prompts padrão para resumir o documento, consultar palavras, termos, personagens e lugares, explicar conceitos novos e traduzir; prompts customizáveis e Prompt Library; Quick Lookup para seleções de 1 a 3 palavras; chat sobre o documento. O **Global Ghostreader** (web e desktop) busca na biblioteca inteira com "per-passage citations" e tem skills reutilizáveis (Research Topic, Tag Documents, Triage Inbox/Feed, Find Similar) ([visão geral](https://docs.readwise.io/reader/guides/ghostreader/overview); [Global](https://docs.readwise.io/reader/guides/ghostreader/global)).
- **2. Padrão de interação.** Convocada: selecionar o texto e escolher "Chat about this" ou apertar `G`; `Shift+G` no nível do documento. "Responses appear in the chat, so you can ask follow-up questions in the same place."
- **3. Quem escreve o permanente.** **Nada é salvo automaticamente.** "To save a response to the document note, click or tap the notebook icon below the response." Para a nota de um grifo, o usuário copia e cola ([Chat](https://docs.readwise.io/reader/guides/ghostreader/chat)). No Global Ghostreader, as write tools (salvar e mover documentos, editar metadados e tags, criar grifos, editar notas de grifo) vêm em **"Confirm each time"**: a IA "pauses and shows a confirmation card right in the chat", com Approve/Deny e a opção Remember. Cada tool pode ficar em Always allow, Confirm each time ou Disabled.
- **4. Ancoragem.** O documento aberto, mais a biblioteca e os grifos do usuário (Global, com citação por trecho; o hover mostra a linha citada e o clique leva ao trecho).
- **5. Memória.** [não verificado].
- **6. Modelos.** O chat traz dois modelos inclusos, "Fast" e "Thinking". BYOK não aparece nas páginas consultadas.
- **7. Preço (verificado em 2026-10-17).** Readwise Full a US$ 9,99/mês no anual (US$ 119,88/ano) ou US$ 12,99 mensal, com o Reader incluído. Readwise Lite, sem o Reader, a US$ 5,59/mês no anual ([pricing](https://readwise.io/pricing)).
- **8. Novidades.** MCP server e CLI oficiais ([docs](https://docs.readwise.io/tools)) [datas não verificadas].
- **9. Críticas.** [não verificado].
- **Leitura.** O Ghostreader faz quase o mesmo que o Reader do Monet: IA convocada sobre o trecho, ancorada no documento, chat lateral e resposta salva na nota só por clique. Ainda acrescenta permissões por ferramenta.

#### MarginNote 4 (Mac e iPad)

- **1. O que a IA faz** (desde a versão 4.2): "AI 拆书" estrutura artigos e livros-texto num mind map guiado por perguntas, com cada nó ligado ao parágrafo-fonte; gera quizzes e cloze cards a partir dos excerpts do usuário; reorganiza o mind map; reescreve títulos; tem a janela Ask sobre o trecho selecionado, um chat em **"Guide Mode"**, AI Hint no modo Recall e OCR para Markdown ([MarginNote AI](https://www.marginnote.com/features/ai/index.html)).
- **2. Padrão de interação.** Convocada: clique direito, botão lateral, Ask depois de selecionar e "Talk to AI" nos cards.
- **3. Quem escreve o permanente.** **Com aprovação, como princípio declarado.** A home diz que "every suggestion can be accepted, edited, or rejected before it enters your knowledge graph" e "You stay the author." ([marginnote.com](https://www.marginnote.com/)). A página de IA diz "每个 AI 建议都需要你确认" (toda sugestão precisa da sua confirmação) e trata o conteúdo da IA como rascunho. No chat, cada saída pode ser aceita ou rejeitada.
- **4. Ancoragem.** O documento e os excerpts do usuário, com link ao parágrafo-fonte.
- **5. Memória.** [não verificado].
- **6. Modelos e privacidade.** O AI Hint pode rodar no aparelho, via Apple Intelligence ("笔记内容不离开设备", sem gastar créditos; exige iOS 26+), ou num LLM na nuvem. **Sem BYOK** ("当前没有官方 BYOK 入口").
- **7. Preço (App Store, verificado em 2026-10-17)** ([pricing](https://www.marginnote.com/pricing/index.html)):
  - Pro vitalício: US$ 12,99, só iPhone/iPad, com 500 créditos únicos;
  - Max anual: US$ 16,99, com 500 créditos/mês;
  - Max vitalício: US$ 51,99, com 500 créditos/mês por 3 anos;
  - pacotes: 500 créditos por US$ 1,39; 3.000 por US$ 7,49; 20.000 por US$ 44,99.
- **8. Novidades.** IA introduzida na 4.2 [data não verificada].
- **9. Críticas.** [não verificado].
- **Leitura.** É a declaração mais explícita da tese do Monet encontrada no mercado. Os limites: só Apple, sem Windows, sem BYOK e com créditos.

#### RemNote

- **1. O que a IA faz.** AI Cards a partir de texto, PDF e PPT; "Learn PDF: AI Flashcards, Quizzes, and Summaries"; AI Tutor Chat; AI Grading; explicações de flashcards; AI Tab Completion; transcrição de áudio ([pricing](https://www.remnote.com/pricing)).
- **2. Padrão de interação.** Convocada, sobre o material de estudo.
- **3. Quem escreve o permanente.** A IA gera os cards. Se há revisão antes de entrarem no baralho: [não verificado].
- **4. Ancoragem.** Notas e PDFs do usuário.
- **5. Memória.** [não verificado].
- **6. Modelos.** [não verificado].
- **7. Preço (verificado em 2026-10-17):** Free (250 créditos/mês, 5 AI Cards); Pro a US$ 8/mês ou US$ 96/ano (1.000 créditos); Pro with AI a US$ 18/mês ou US$ 216/ano (20.000 créditos). Cada execução custa cerca de 2 créditos.
- **8. Novidades.** [não verificado].
- **9. Críticas.** [não verificado].
- **Leitura.** Mostra a direção dominante dos apps de estudo: a IA gera o material de estudo. É também uma lacuna do Monet, que não tem flashcards nem revisão espaçada.

#### Amazon Kindle: "Ask this Book"

- **1. O que a IA faz.** O leitor grifa um trecho e toca "Ask" para a IA explicar, ou digita uma pergunta sobre o livro comprado ou emprestado. Segundo a Amazon e a Authors Guild, as respostas vêm só do texto do livro. A imprensa relata respostas sem spoiler, limitadas às páginas já lidas [não confirmado na fonte primária].
- **2. Padrão de interação.** Convocada sobre a seleção, dentro do leitor. É o mesmo gesto do chat lateral do Reader do Monet.
- **3. Quem escreve o permanente.** A resposta é efêmera. Registro em notas: [não verificado].
- **4. Ancoragem.** Só o texto do livro.
- **5. Memória.** [não verificado].
- **6. Privacidade.** Segundo a Amazon, "The feature only uses content from the book as a prompt which is not retained or used to train the underlying AI model"; usa uma instância "standalone" do modelo e se define como "a natural language expansion of the search functionality".
- **7. Preço.** Sem custo adicional [não verificado].
- **8. Novidades.** Disponível desde 2025-12-11 em alguns Kindles e no app iOS (EUA), ainda não para todos os ebooks; expansão prevista para 2026.
- **9. Críticas.** Autores e editoras não podem excluir seus livros ("no way for publishers or authors to opt their books out of the feature"). A Authors Guild vê um possível uso derivado não licenciado ("possibly creating a derivate use, not a mere search function") e pede um modelo licenciado e remunerado ([Authors Guild, 2025-12-23, atualizado em 2026-01-07](https://authorsguild.org/news/statement-on-amazon-kindle-ask-this-book-ai-feature/)).
- **Leitura.** A maior plataforma de leitura adotou "pergunte ao livro sobre o trecho grifado". O chat contextual do Reader do Monet virou expectativa de mercado, não diferencial. O que o Kindle não faz é transformar a resposta em fichamento perene e curado.

#### LiquidText

A home atual não menciona recursos de IA. O app roda em iPadOS, Windows 10 e macOS ([liquidtext.net](https://www.liquidtext.net/)). Itens 1 a 9: [não verificado].

### b.5 Integrações via MCP: as notas se abrem para agentes que escrevem

| App | Servidor MCP ou conector | Oficial? | Leitura / escrita | Local / remoto | Data | Fonte |
|---|---|---|---|---|---|---|
| **Notion** | Notion MCP; conector "Anthropic verified" no Claude | Oficial | Lê e escreve: "read from and write to your Notion pages in real-time"; "act with your full Notion permissions" | Remoto, OAuth; limitar clientes exige Enterprise | Suporte MCP em 2025-08-19 (2.53); "150+ MCP tools" e gestão por admin em 2026-10-13 (3.8) | [developers.notion.com](https://developers.notion.com/docs/mcp); [releases](https://www.notion.com/releases) |
| **Evernote** | Conexão MCP | Oficial | [escopo não verificado] | [não verificado] | 1º semestre de 2026 | [Evernote blog, 2026-07-21](https://evernote.com/blog/115-improvements-since-v11) |
| **Craft** | API + MCP; MCP v2 | Oficial | [escopo não verificado] | [não verificado] | 2025-11-27; v2 em 2026-06-05 | [Craft blog](https://www.craft.do/blog/your-content-is-yours); [3.4.4](https://www.craft.do/blog/craft-update-3-4-4) |
| **Capacities** | AI chat connectors (MCP) | Oficial | Leitura e escrita, sem aprovação por ação dentro do app | Remoto | Beta em 2026-04-14; escrita em 2026-06-24 | [docs](https://docs.capacities.io/reference/ai-chat-connectors) |
| **Tana Outliner** | MCP local no app desktop + MCP hospedado; Input API | Oficial | "search, read, and modify your workspace"; a Input API é "write-only" | Local e remoto | [não verificado] | [outliner.tana.inc](https://outliner.tana.inc/) |
| **Heptabase** | MCP; plugin para Claude e Claude Code | Oficial | A escrita é opcional, conforme as permissões aprovadas na conexão | Remoto | MCP em 2025-12-11; plugin Claude em 2026-10-09 | [ajuda](https://support.heptabase.com/en/articles/17574823-use-heptabase-with-claude-and-claude-code); [roadmap](https://wiki.heptabase.com/roadmap) |
| **Obsidian** | Sem MCP oficial; Obsidian CLI (fev/2026) para agentes; plugins da comunidade ("Local REST API with MCP", 794.782 downloads) | CLI oficial; MCP da comunidade | Leitura e escrita nos .md | Local | CLI em fev/2026 | [community-plugin-stats](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json) |
| **Logseq (versão DB)** | MCP server (desktop e CLI), CLI headless, HTTP API | Oficial | [permissões de escrita não verificadas] | Local | Anúncio em 2026-04-24 | [logseq.io](https://logseq.io/p/e3YDyX5AYr) |
| **Reflect** | MCP para coding agents | Oficial | Leitura (2026-03-10), depois **edição de notas** (2026-04-28) por Claude Code, Cursor e Codex, sem aprovação descrita | Local (app) + CLI | 2026-03-10 e 2026-04-28 | [Reflect blog](https://reflect.app/blog/edit-notes-with-coding-agents) |
| **Granola** | Granola MCP | Oficial | Notas de reunião para Claude, ChatGPT e Cursor; o escopo varia por plano | Remoto | 2026-02-04 | [blog](https://www.granola.ai/blog); [pricing](https://www.granola.ai/pricing) |
| **Recall** | API + MCP | Oficial | Acesso à base, em todos os planos | Remoto | [não verificado] | [pricing](https://www.recall.it/pricing) |
| **Readwise / Reader** | MCP server + CLI | Oficial | Buscar, ler e organizar grifos, notas e artigos | [não verificado] | [não verificado] | [docs](https://docs.readwise.io/tools) |
| **Mem** | Claude Connector | Oficial | [não verificado] | Remoto | [sem data] | [blog](https://get.mem.ai/blog) |
| **Microsoft 365 / OneNote** | Conector "Anthropic verified" no Claude (SharePoint, OneDrive, Outlook, Teams) | Verificado pela Anthropic | Write tools desde 2026-07-07; OneNote não aparece pelo nome | Remoto | 2026-07-07 | [claude.com/connectors](https://claude.com/connectors); [release notes](https://support.claude.com/en/articles/12138966-release-notes) |
| **Google (Keep, Drive)** | Conector do Workspace no app Gemini ("Create and get your notes and lists from Google Keep"); Google Drive verificado no Claude | Oficial | Keep: criar e consultar; Drive: buscar, ler e enviar | Remoto | [não verificado] | [ajuda Gemini](https://support.google.com/gemini/answer/15229592?hl=en) |
| **Gemini Notebook** | "Connected apps", usados automaticamente quando ligados | Oficial (cliente) | [ações não documentadas] | Remoto | [não verificado] | [ajuda](https://support.google.com/gemininotebook/answer/18784282?hl=en) |
| **Khoj** | Integrações próprias (Obsidian, Emacs) | Open source | Lê os arquivos | Local / self-host | — | [GitHub](https://github.com/khoj-ai/khoj) |

**O que muda.**

- Em 2026 os apps de notas passaram a se abrir para **agentes externos que escrevem** (Reflect, Notion, Capacities, Tana Outliner, Heptabase, Microsoft 365). Isso cria um caminho pelo qual a IA grava no registro permanente sem passar pela interface de curadoria do app.
- No Capacities, os conectores externos têm "read and write access" sem aprovação por ação. No Notion, as ferramentas "act with your full Notion permissions".
- O risco de prompt injection é real: em 2025-09-19, Simon Willison resumiu uma pesquisa em que texto escondido num PDF fazia o agente do Notion vazar dados pela busca web (ver Notion).
- Alguns apps também atuam como **clientes** MCP: o Notion Agent e os Custom Agents conectam-se a servidores externos, e o Copilot for Obsidian V4 roda agentes de código dentro do vault.
- O Monet não tem MCP nem API. Um MCP **só de leitura** seria coerente com a tese; um MCP com escrita só seria coerente se passasse por uma fila de aprovação.


## (c) Evidência científica e debate: cognitive offloading e aprendizado com IA

### c.1 O que a evidência diz, em seis linhas

1. **Usar a IA para produzir o artefato** (ensaio, código, solução) melhora o desempenho na hora e tende a piorar a retenção e a maestria quando a IA sai de cena (Bastani 2025; Anthropic 2026; sinal do MIT 2025).
2. **IA desenhada como tutor** (não entrega a resposta, dá scaffolding, usa material curado por especialistas) pode igualar ou superar boas práticas humanas no curto prazo (Kestin 2025; Banco Mundial 2025).
3. **O fator decisivo é quem faz o trabalho de geração.** Perguntar conceitos e executar sozinho preserva o aprendizado; delegar não (Anthropic 2026). Isso converge com o generation effect e as desirable difficulties.
4. **Anotar continua valendo, inclusive ao lado de um LLM.** Anotar sozinho ou anotar + LLM venceu "só LLM" em retenção e compreensão (Cambridge/Microsoft 2025).
5. **Aprender por síntese de LLM gera conhecimento mais raso** que buscar e sintetizar por conta própria (Melumad & Yun 2025).
6. **Os dois estudos mais citados nos extremos são frágeis:** o "Your Brain on ChatGPT" segue preprint com crítica formal, e a meta-análise mais otimista foi retratada em 2026-04-22.

### c.2 Estudos centrais

**MIT Media Lab: "Your Brain on ChatGPT" (preprint).**

- Citação: Kosmyna, N.; Hauptmann, E.; Yuan, Y. T.; Situ, J.; Liao, X.-H.; Beresnitzky, A. V.; Braunstein, I.; Maes, P. "Your Brain on ChatGPT: Accumulation of Cognitive Debt when Using an AI Assistant for Essay Writing Task". arXiv:2506.08872; v1 em 2025-06-10, v2 em 2025-12-31. Sem journal reference em 2026-10-17 ([arXiv](https://arxiv.org/abs/2506.08872)).
- Desenho: 54 universitários em três grupos (LLM, buscador, só cérebro), com EEG, análise dos textos e entrevistas, em 3 sessões; na 4ª sessão, 18 participantes trocaram de condição. Quatro meses no total.
- Achados: conectividade mais forte no grupo só cérebro e mais fraca no LLM; menor sensação de autoria e dificuldade de citar o próprio ensaio no grupo LLM. Frase do abstract: "Over four months, LLM users consistently underperformed at neural, linguistic, and behavioral levels."
- Ressalvas dos autores: "it has not yet been peer-reviewed, thus all the conclusions are to be treated with caution and as preliminary"; amostra pequena e de uma só região; só ChatGPT; "Our findings are context-dependent and are focused on writing an essay in an educational setting" ([brainonllm.com](https://www.brainonllm.com/)).
- Crítica formal: Stanković, Hirche, Kollatzsch e Doetsch (arXiv:2601.00856, 2025-12-29) apontam "the limited sample size", problemas de reprodutibilidade e de análise do EEG, inconsistências no reporte, e dizem que alguns resultados "could be interpreted more conservatively" ([arXiv](https://arxiv.org/abs/2601.00856)).
- Leitura para o Monet: é um sinal, não uma prova. O achado mais útil é a perda de autoria e de memória do próprio texto quando o LLM escreve, que conversa com a regra de a IA não escrever na nota.

**Microsoft Research + Carnegie Mellon: pensamento crítico de knowledge workers (CHI 2025, revisado por pares).**

- Citação: Lee, H.-P.; Sarkar, A.; Tankelevitch, L.; Drosos, I.; Rintel, S.; Banks, R.; Wilson, N. "The Impact of Generative AI on Critical Thinking: Self-Reported Reductions in Cognitive Effort and Confidence Effects From a Survey of Knowledge Workers". CHI '25, artigo 1121, abr/2025 ([Microsoft Research](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/)).
- Desenho: survey com 319 profissionais e 936 exemplos reais. Autorrelato, correlacional.
- Achados: "higher confidence in GenAI is associated with less critical thinking"; "higher self-confidence is associated with more critical thinking"; "GenAI shifts the nature of critical thinking toward information verification, response integration, and task stewardship".
- Leitura: o risco não é "IA = menos pensamento" em geral, e sim a confiança na IA substituir o julgamento. Integrar a resposta à nota, como ato do usuário, é exatamente esse trabalho de integração.

**Bastani et al.: IA sem salvaguardas prejudica o aprendizado.**

- Citação: versão SSRN de 2024 ("Generative AI Can Harm Learning") e versão em PNAS de 2025 ("Generative AI without guardrails can harm learning: Evidence from high school mathematics", DOI 10.1073/pnas.2422633122). A página da PNAS bloqueou o acesso (403); título e DOI da versão PNAS não foram reverificados nesta sessão.
- Desenho: cerca de 1.000 alunos de ensino médio na Turquia, em matemática; GPT Base (tipo ChatGPT-4), GPT Tutor (dicas em vez de respostas, com input de professores) e controle.
- Resultados: na prática com IA, GPT Base +48% e GPT Tutor +127% sobre o controle; na prova sem IA, **GPT Base −17%** e GPT Tutor igual ao controle. Os alunos com IA superestimaram o próprio aprendizado ([Knowledge at Wharton, 2024-08-27](https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/)).
- Leitura: desempenho com a muleta não é aprendizado. O tutor neutralizou o dano, mas não gerou ganho na prova.

**Gerlich (2025): offloading e pensamento crítico (Societies).**

- Citação: Gerlich, M. "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking". Societies 15(1):6, 2025, DOI 10.3390/soc15010006. A página da MDPI bloqueou (403); dados via [Phys.org (2025-01-13)](https://phys.org/news/2025-01-ai-linked-eroding-critical-skills.html).
- Desenho: 666 participantes no Reino Unido, mais 50 entrevistas. Transversal, autorrelato.
- Achados: correlação negativa entre uso de IA e pensamento crítico (r = −0,68); offloading correlaciona com uso de IA (r = +0,72) e negativamente com pensamento crítico (r = −0,75), com mediação parcial; jovens de 17 a 25 anos são mais dependentes.
- Limitação: causalidade não estabelecida.

**Anthropic: RCT sobre IA e formação de habilidade (2026-01-29).**

- Citação: Shen, J. H.; Tamkin, A. "How AI assistance impacts the formation of coding skills", arXiv:2601.20245 ([Anthropic](https://www.anthropic.com/research/AI-assistance-coding-skills)).
- Desenho: RCT com 52 engenheiros, a maioria júnior, aprendendo a biblioteca Python Trio; o grupo IA tinha um assistente lateral que via o código e o gerava sob pedido.
- Resultados: quiz com 50% (IA) contra 67% (sem IA), d de Cohen = 0,738, p = 0,01; ganho de velocidade não significativo; maior diferença em debugging.
- Padrões de uso: notas baixas em "AI delegation" e "progressive AI reliance"; notas altas em "conceptual inquiry" (perguntar só conceitos e executar sozinho) e "generation-then-comprehension". Frase: "Cognitive effort—and even getting painfully stuck—is likely important for fostering mastery."
- Ressalvas dos autores: amostra pequena, padrões qualitativos e não causais, medida de curto prazo.
- Leitura: é a evidência experimental mais direta a favor do padrão "a IA explica, o usuário elabora".

**Cambridge University Press & Assessment + Microsoft Research: LLM × anotação (Computers & Education, nov/2025). É o estudo mais próximo de um teste da tese do Monet.**

- Citação: Kreijkes, P.; Kewenig, V.; Kuvalja, M.; Lee, M.; Hofman, J.; Vitello, S.; Sellen, A.; Rintel, S.; Goldstein, D. G.; Rothschild, D.; Tankelevitch, L.; Oates, T. "Effects of LLM Use and Note-Taking On Reading Comprehension and Memory: A Randomised Experiment in Secondary Schools". Computers & Education, artigo 105514, DOI 10.1016/j.compedu.2025.105514. Pré-registrado ([Microsoft Research](https://www.microsoft.com/en-us/research/?p=1143413)).
- Desenho: 405 alunos de 14 e 15 anos na Inglaterra; dois textos de história; condições só LLM, só anotação, e anotação + LLM; teste de compreensão e retenção três dias depois.
- Resultados: anotar sozinho e anotar + LLM tiveram "significant positive effects" sobre retenção e compreensão em comparação com só LLM. "Yet, most students preferred using the LLM over note-taking, and perceived it as more helpful." Para os autores, "LLMs may facilitate initial understanding and student interest"; as duas práticas são complementares. A página não traz tamanhos de efeito.
- Leitura: a condição "anotação + LLM" não perdeu para "só anotação", e as duas venceram "só LLM". Ao mesmo tempo, o usuário prefere a condição que aprende menos.

**Melumad & Yun: resumo de LLM × busca na web (PNAS Nexus, out/2025).**

- Citação: Melumad, S.; Yun, J. H. "Experimental Evidence of the Effects of Large Language Models versus Web Search on Depth of Learning". PNAS Nexus, out/2025. Sete experimentos, n = 10.462 ([Stanford SCALE](https://scale.stanford.edu/ai/repository/experimental-evidence-effects-large-language-models-versus-web-search-depth-learning)).
- Resultados: quem aprendeu com sínteses de LLM gastou menos tempo, aprendeu menos coisas novas, investiu menos esforço, sentiu menos autoria e escreveu conselhos mais curtos, genéricos e menos originais, que leitores tenderam menos a adotar. O efeito persistiu com links em tempo real. Frase: "learning from LLM syntheses (vs. web links) can, at times, limit the development of deeper, more original knowledge" ([PsyPost, 2026-01-17](https://www.psypost.org/learning-from-ai-summaries-leads-to-shallower-knowledge-than-web-search/)).
- Limitações: cenários hipotéticos nos primeiros experimentos; participantes pagos.
- Leitura: é o argumento empírico contra o /summarize como substituto da leitura, e a favor de a síntese ficar com o usuário.

**A favor da IA bem desenhada como tutor.**

- **Kestin et al. (Harvard), Scientific Reports, 2025-06-03.** "AI tutoring outperforms in-class active learning: an RCT introducing a novel research-based design in an authentic educational setting". 194 alunos de física introdutória; RCT crossover; tutor com prompt pedagógico, orientação passo a passo e soluções escritas por especialistas. Mediana pós-teste 4,5 contra 3,5 (pré-teste 2,75), efeito de 0,63 a 1,3 DP, em menos tempo (49 contra 60 min) e com mais engajamento. Frase: "students learn significantly more in less time when using the AI tutor" ([Nature](https://www.nature.com/articles/s41598-025-97652-6)). Mede só o curto prazo.
- **Banco Mundial, Nigéria (2025-01-09).** Piloto de seis semanas de tutoria com IA generativa e apoio de professores, com avaliação randomizada: cerca de 0,3 DP em inglês, "nearly two years of typical learning in just six weeks" ([blog](https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria)). O blog não nomeia o modelo.

**Anthropic Education Report (2025-04-08).** De 574.740 conversas acadêmicas analisadas, cerca de 47% foram "Direct" (pedir a resposta com pouca interação). As respostas do Claude se concentraram em tarefas de ordem superior: Creating 39,8% e Analyzing 30,2%. A própria empresa alerta: "This raises questions about ensuring students don't offload critical cognitive tasks to AI systems" e "An inverted pyramid, after all, can topple over." ([Anthropic](https://www.anthropic.com/news/anthropic-education-report-how-university-students-use-claude)).

**Meta-análise retratada (não usar).** Wang, J.; Fan, W. "The effect of ChatGPT on students' learning performance, learning perception, and higher-order thinking: insights from a meta-analysis". Humanities and Social Sciences Communications 12, 621 (2025-05-06): 51 estudos, g = 0,867 para desempenho. **Retratada em 2026-04-22:** "The Editor has decided to retract this article due to concerns relating to discrepancies in the meta‑analysis." ([nota de retratação](https://www.nature.com/articles/s41599-026-07310-z)).

### c.3 Ciência clássica de aprendizagem que sustenta a tese

Referências consolidadas da literatura; os números não foram reverificados nesta sessão.

- **Generation effect.** Slamecka & Graf (1978): o que o aprendiz gera é mais bem lembrado do que o que ele só lê. Meta-análise de Bertsch, Pesta, Wiscott & McDaniel (2007, Memory & Cognition 35(2):201–210), com efeito médio em torno de d ≈ 0,40 [não reverificado].
- **Desirable difficulties.** Bjork (1994); Bjork & Bjork (2011): dificuldades que atrasam o desempenho imediato (gerar, espaçar, intercalar, testar) melhoram retenção e transferência.
- **Retrieval practice / testing effect.** Roediger & Karpicke (2006), "Test-enhanced learning", Psychological Science.
- **Cognitive offloading.** Risko & Gilbert (2016), Trends in Cognitive Sciences 20(9): descarregar demanda cognitiva em ferramentas libera recursos, mas pode reduzir a memória do conteúdo descarregado.
- **"Google effect".** Sparrow, Liu & Wegner (2011), Science, foi um dos 21 estudos replicados no Social Sciences Replication Project (Camerer et al., 2018, Nature Human Behaviour), em que 13 de 21 (62%) replicaram. O resultado específico de Sparrow não foi confirmado nesta sessão; relatos secundários indicam falha de replicação [não verificado].
- **Anotar à mão × no laptop.** Mueller & Oppenheimer (2014) não foi confirmado de forma robusta pelas replicações (Morehead, Dunlosky & Rawson, 2019; Urry et al., 2021). O mecanismo plausível é o processamento generativo (parafrasear em vez de transcrever), não a caneta [não reverificado].
- **Leitura:** o argumento mais forte para o Monet não é "a IA faz mal". É o generation effect somado às desirable difficulties: o valor do fichamento está em o próprio usuário reformular. Uma IA que escreve a nota remove justamente a etapa geradora.

### c.4 Como os produtos se posicionaram

- **ChatGPT Study Mode (2025-07-29).** Faz perguntas para testar a compreensão e, "in some cases", recusa a resposta direta até o aluno engajar. Lançado para Free, Plus, Pro e Team, com Edu depois. O aluno "can easily switch into the regular mode of ChatGPT", e não havia trava para pais ou escolas no lançamento ([TechCrunch](https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt/)).
- **Claude learning mode.** Começou em 2025-04-02 no Claude for Education: "A new Claude experience that guides students' reasoning process rather than providing answers, helping develop critical thinking skills", com perguntas socráticas ("What evidence supports your conclusion?") ([Anthropic](https://www.anthropic.com/news/introducing-claude-for-education)). Em ago/2025 virou a opção "Learning" para todos no Claude.ai, e o Claude Code ganhou os estilos "Explanatory" e "Learning", este com marcadores #TODO para o usuário escrever trechos ([Engadget](https://engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html); [Tom's Guide](https://www.tomsguide.com/ai/claudes-new-learning-modes-take-on-chatgpts-study-mode-heres-what-they-do)).
- **Gemini Guided Learning (2025-08-06).** Perguntas abertas, passos, imagens, vídeos e quizzes, sobre o LearnLM. Frases: "true understanding goes deeper than a single answer"; "real learning is an active, constructive process"; "simply improving prompting wasn't enough to create a meaningful learning tool" ([blog.google](https://blog.google/outreach-initiatives/education/guided-learning/)).
- **Gemini Notebook (ex-NotebookLM).** Learning Guide desde set/2025, com "probing, open-ended questions"; flashcards e quizzes com "explain" e citações. A comunicação de set/2026, porém, destaca formatos e conveniência (gravar aulas, vídeos de 60 segundos) e não usa o vocabulário de "active learning". A Google Research mediu o experimento Learn Your Way: 11% a mais na retenção 3 a 5 dias depois (78% contra 67%, n = 60) ([research.google](https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/)).
- **MarginNote 4.** O chat em "Guide Mode" faz perguntas, dá dicas ou quebra em passos em vez de dar a resposta completa ([MarginNote AI](https://www.marginnote.com/features/ai/index.html)).
- **Microsoft Research, Tools for Thought.** Propõe uma IA que "challenge[s], not obey[s]", com apoio à metacognição e "humans in curation". Advait Sarkar resume: terceirizar o raciocínio nos transforma em "middle managers for our own thoughts" ([projeto](https://www.microsoft.com/en-us/research/project/tools-for-thought/); [TED, set/2025](https://www.ted.com/talks/advait_sarkar_how_to_stop_ai_from_killing_your_critical_thinking)).
- **Padrão comum e crítica.** Os três grandes lançaram "modos de estudo" entre abril e agosto de 2025, todos como um toggle dentro do chat, sem mudar o produto-padrão, que continua entregando respostas. A crítica recorrente é que se desligam com um clique (TechCrunch registra o toggle livre). Nenhum foi acompanhado de estudo de eficácia publicado nas fontes lidas.

### c.5 Síntese para a tese do Monet

**O que a evidência sustenta:**

- preservar o trabalho gerador do usuário (escrever, reformular, sintetizar) protege retenção, compreensão e autoria;
- a IA ao lado da anotação não atrapalha e pode ajudar a compreensão inicial (Cambridge/Microsoft);
- usar a IA para tirar dúvidas conceituais e explicar, e não para produzir a solução, é o padrão associado à maestria (Anthropic 2026);
- citações e verificação deslocam o pensamento crítico para "verification, response integration, and task stewardship" (CHI 2025).

**O que não sustenta, ou ainda não testou:**

- "a IA emburrece" em geral: os estudos são pequenos, curtos, muitas vezes preprints ou autorrelato;
- que "convocada" basta: um /summarize ou /expand convocado que entrega o texto pronto é offloading (Melumad & Yun; Bastani);
- não há estudo, até onde se verificou, com adultos autodidatas, prazo longo, ou comparando "a IA escreve a nota" com "o usuário escreve com a IA ao lado" dentro de um app de notas;
- que o chat descartável ajude o aprendizado: é uma escolha de produto coerente com a tese, mas não foi testada.

**Implicação:** a tese do Monet é consistente com a melhor evidência disponível. O fator crítico, porém, é o desenho da interação: perguntar, explicar, dar scaffolding e devolver o trabalho ao usuário. A IA ser silenciosa e convocada é necessário, mas não suficiente.


## (d) Padrões de UX de IA que viraram convenção, e como se cobra a IA

### d.1 Convenções de UX (com exemplos verificados)

1. **"Ask AI" sobre o acervo, com citações até o trecho.** É o padrão mais consolidado.
   - Gemini Notebook: a citação mostra o trecho no hover e leva ao contexto no clique ([ajuda](https://support.google.com/gemininotebook/answer/16179559?hl=en)).
   - Readwise Global Ghostreader: "per-passage citations" ([docs](https://docs.readwise.io/reader/guides/ghostreader/global)).
   - Notion Enterprise Search: "will always cite its sources" ([ajuda](https://www.notion.com/help/enterprise-search)).
   - Reflect ("Answers cite source notes"), Heptabase ("backed by citations"), Copilot for Obsidian (Inline Citations) e Granola Chat (citações inline desde 2026-04-21).
2. **IA sobre a seleção, por menu, atalho ou slash.**
   - Ghostreader: `G` ou "Chat about this". Reflect: ⌘J. MarginNote: clique direito e Ask. Notion: espaço, "Edit with AI" e `/AI Block`. Logseq: `cmd+g` ou `gpt`.
   - **Slash commands de IA saíram do nicho.** O Notion roda skills com `/` desde 2026-09-15 ([releases](https://www.notion.com/releases)); o Heptabase tem skills por slash como `/break-down-book`; o Evernote chama prompts salvos com `/` dentro do chat; o Capacities aceita slash no chat.
3. **Inserir, substituir ou descartar por escolha do usuário.**
   - Reflect: Insert / Replace / Copy / Re-run.
   - Capacities: copy / replace / append.
   - Notion inline: "accept, discard, or ask it to try again".
   - OneNote: "Add to doc".
   - Keep: "Insert".
   - Logseq: Insert / Replace / Regenerate.
4. **Ponte do chat para a nota, resposta por resposta.** "Save to note" (Gemini Notebook); ícone de caderno que salva na nota do documento (Ghostreader); "Add to doc" (OneNote). É o equivalente direto do botão "Anotar" do Monet e já não é exclusivo dele.
5. **Agentes com permissão, plano e aprovação antes de aplicar.**
   - Capacities: "By default, you approve those changes before they land in your space"; Auto-approve é opcional ([docs](https://docs.capacities.io/reference/ai-assistant)).
   - Tana: propostas com diff; "AI never changes anything without approval".
   - Craft: modo Explore propõe e espera; Execute aplica; ⌘Z desfaz a ação inteira.
   - Notion: Plan Mode (2026-05-07) e "suggest edits" opt-in (2026-08-28).
   - Copilot for Obsidian V4: modos Safe, Plan e Auto; cards "Permission required" e "Files changed" ([docs](https://docs.obsidiancopilot.com/agent-mode-and-tools/)). Agent Client: diff por palavra no chat, com auto-allow desligado.
   - Ghostreader Global: write tools em "Confirm each time", com Approve/Deny no chat.
6. **Histórico de versões com atribuição à IA.** O Notion 3.8 (2026-10-13) mostra quem mudou o quê, inclusive agentes, e restaura com um clique ([release](https://www.notion.com/releases/2026-10-13)). O Capacities usa o histórico de versões como undo.
7. **Marcação visual do que é da IA.** Granola: abas "My notes" e "Enhanced", texto do usuário em preto e lupa para conferir a origem de cada linha na transcrição ([ajuda](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes)). MarginNote trata a saída da IA como rascunho até a confirmação.
8. **Modos guia ou socráticos.** MarginNote "Guide Mode", ChatGPT Study Mode, Claude learning mode, Gemini Guided Learning e o Learning Guide do Gemini Notebook. Em todos, é um modo opcional, não o padrão.
9. **Proatividade crescente, com controles.** Proativos: Mem (Heads Up, nudges), Recall (Augmented Browsing), Mymind (auto-tag, Serendipity), Fabric (agentes agendados), Saner (proactive planning), ChatGPT Pulse, Keep Live, Autofill do Notion, sugestões de cards relacionados no Heptabase (2025-10-29). Controles: o Evernote liga e desliga cada recurso de IA; o Capacities liga a IA por Space; a Microsoft publicou "Text predictions off by default in Word and Outlook" (2026-09-01, só o título foi lido).
10. **Exclusão de conteúdo e memória editável.** Reflect: `private: true` nunca é enviado a serviço externo, com garantia em código ([privacidade](https://github.com/team-reflect/reflect-open/blob/master/docs/privacy.md)). Claude: Topics editáveis e configuração de tópicos sensíveis (2026-08-25). ChatGPT: gerenciar memórias e Temporary Chat. Gemini: chats temporários e importação de memória.

**Referências de design.**

- **The Shape of AI** (Emily Campbell, © 2025) agrupa padrões em Wayfinders, Prompt actions, Tuners, **Governors**, Trust builders e Identifiers. Os relevantes aqui: Inline action, Citations, **Verification** ("confirm AI decisions and actions before the AI proceeds"), Action plan, Draft mode, Controls, Memory e **Disclosure** ("Clearly marks content and interactions that AI guided or produced") ([shapeof.ai](https://www.shapeof.ai/)).
- **Microsoft HAX, Guidelines for Human-AI Interaction** (CHI 2019): 18 diretrizes em quatro fases. As mais ligadas ao Monet são G7 "Support efficient invocation", G8 "Support efficient dismissal", G9 "Support efficient correction" e G17 "Provide global controls" (nomes conforme o paper de 2019, não reverificados na página) ([HAX](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)).
- **Microsoft Research, Tools for Thought:** IA que desafia em vez de obedecer, apoio à metacognição, "keep humans in curation", e o aprendiz ativo em vez de receber resumos ([projeto](https://www.microsoft.com/en-us/research/project/tools-for-thought/)).
- **Maggie Appleton, "Language Model Sketchbook" (c. 2023):** os "Daemons" sugerem, criticam ou pedem para defender uma afirmação; "You can always ignore them if you like and the suggestion will fade." O chat é a interface "lazy" ([maggieappleton.com](https://maggieappleton.com/lm-sketchbook)).
- **Andy Matuschak, "How Might We Learn?" (2024-05-08):** IA embutida no projeto real do aprendiz, com prática espaçada; "Chatbot tutors aren't interested in what I'm trying to do" ([andymatuschak.org](https://andymatuschak.org/hmwl/)).

**Leitura para o Monet.** As convenções 1 a 5 já cobrem o "Anotar/Inserir" e o chat ancorado. O que o mercado tem e o Monet não tem: citação clicável até o trecho [a verificar no Monet], aprovação com diff para edições amplas (o /action edita texto da nota), marcação visual do que veio da IA e um modo socrático explícito. O que o Monet tem e quase ninguém tem: a ausência de modos proativos e de escrita por agente como regra, e não como configuração.

### d.2 Modelos de cobrança de IA em apps de notas

| Modelo | Exemplos (preço em USD, verificado em 2026-10-17 salvo indicação) |
|---|---|
| **IA inclusa no plano pago** | Notion Business US$20/membro/mês, com "unlimited usage of Notion AI" desde 2025-05-13 (Free e Plus só têm trial); Readwise Full US$9,99/mês no anual; Granola Business US$14/usuário/mês; Recall Plus US$10/mês; Mymind Mastermind US$12,99/mês; Microsoft 365 Personal US$9,99, Family US$12,99 e Premium US$19,99/mês com Copilot e limites por faixa; Evernote Starter US$99/ano (fonte secundária); Google AI Pro US$19,99/mês, que amplia o Gemini Notebook e a IA do Keep |
| **Freemium com limites** | Gemini Notebook Free (100 notebooks, 50 fontes, limites por computação); Claude Free (memória e connectors); Granola Basic (30 dias de histórico); Recall Free (10 resumos/mês); Saner Free (30 mensagens/mês); Mem Free (25 mensagens/mês); RemNote Free (250 créditos/mês); Tana (50 AI queries) |
| **Créditos ou uso medido** | Notion Custom Agents (US$10 por 1.000 créditos desde 2026-05-04); Heptabase (Pro 100, Premium 1.800 e Premium+ 8.100 créditos, depois uso sob demanda); Craft (15 créditos no Free, 50/mês no Plus, top-ups de US$10 a US$100); Tana Outliner (Plus US$8 com 2.000 créditos, Pro US$14 com 5.000); MarginNote (500 créditos/mês no Max; pacotes de US$1,39 a US$44,99); RemNote (Pro with AI com 20.000 créditos); napkin.ai (créditos por palavra); Mem (mensagens e notas por plano, de US$9 a US$199); Gemini Notebook (orçamento por computação com janela de 5 h desde 2026-09-02); Microsoft "Copilot Credits" para "advanced AI" (anunciados em 2026-09-25, detalhes [não verificado]) |
| **Add-on de IA** | Capacities Plus (US$8,33/mês no anual) sobre o Pro; RemNote Pro with AI (US$18 contra US$8 do Pro); o antigo add-on do Notion, extinto em mai/2025 |
| **BYOK** | Reflect Open (OpenAI, Anthropic, Google, OpenRouter; "AI usage is billed separately by your provider"); Heptabase (OpenAI, Anthropic, Gemini, OpenRouter, HTTPS, Vertex; não vale para o Tutor); Craft (OpenAI e Anthropic desde 2026-06-05, "even without a subscription"); Elephas; Saner (modelos externos); plugins do Obsidian (o Copilot grátis diz que "BYOK works without an account or license key"); plugins do Logseq. **Na contramão:** o Capacities **encerrou** o BYOK em 2026-08-17. **Quase-BYOK:** o Notion aceita o plano ChatGPT Plus/Pro como pagamento desde 2026-10-13, por login e só com modelos GPT |
| **Local / no aparelho** | Apple Intelligence (no aparelho + Private Cloud Compute; grátis, com limites diários e "fee in the future"); MarginNote AI Hint via Apple Intelligence (sem créditos); Craft Local (Apple Foundation Model e Llama 3.2, só leitura, grátis); Elephas (modelo no computador); Reflect Open (embeddings no aparelho); plugins do Obsidian e do Logseq com Ollama ou LM Studio; Khoj self-host; Reor (arquivado) |
| **Grátis, financiado por outra coisa** | Reflect Open (desktop grátis, mobile pago no futuro); Gemini Notebook Free (ecossistema Google); ChatGPT Free com anúncios desde 2026; Kindle "Ask this Book" (sem custo adicional [não verificado]) |

**Tendências (2025–2026).**

- **Do add-on ao pacote.** O Notion levou a IA para dentro do Business em 2025-05-13, e um rastreador de terceiros indica que o Business subiu cerca de 33%, de ≈US$15 para US$20 [fonte secundária]. A Microsoft embutiu o Copilot no Microsoft 365 de consumo com aumento de preço; a ACCC, da Austrália, processou a empresa (2,7 milhões de assinantes; o Personal foi de A$109 para A$159, e o plano sem Copilot só aparecia no cancelamento, segundo a acusação) [ver ficha do OneNote].
- **Do pacote aos créditos, para agentes.** Custom Agents do Notion, créditos do Heptabase, do Craft e do Tana Outliner, Copilot Credits e o orçamento por computação do Gemini Notebook. O escalonamento "2× / 5× / 20×" virou padrão (Mem, Claude Max, Google AI Ultra).
- **BYOK em vaivém.** Indies adotam BYOK como argumento de privacidade e para não carregar o custo de inferência (Reflect Open, Heptabase com OpenRouter, Craft). O Capacities saiu, oferecendo MCP no lugar. O BYOK com OpenRouter deixou de ser exclusividade do Monet, mas segue raro em apps de leitura e estudo (o MarginNote declara não ter; o Readwise não oferece nas páginas consultadas).
- **Publicidade.** Entrou no ChatGPT Free em 2026; a Perplexity saiu dela em fev/2026.
- **Reação de usuários ao preço.** Evernote: "doubling" e IA que usuários "don't want or need" (Trustpilot); Notion: reclamações de pagar créditos (Trustpilot 2,2/5); Keep: "Google assistant used to create notes to Google Keep without a subscription." (comentário no 9to5Google, 2026-06-04).


## (e) Tabela comparativa

Leitura da coluna "IA escreve direto no permanente?": **sim** = a IA grava na nota/página/base sem um passo de aceite por resposta; **não** = a saída fica fora do registro até o usuário copiar/salvar; **com aprovação** = há aceite explícito (Insert, Add to doc, Approve, diff) antes de gravar. Quando o produto mistura modos, a célula diz qual recurso faz o quê. Preços em USD, com a data da verificação; detalhes e fontes nas fichas da seção (b).

| Produto | Padrão de interação | IA escreve direto no permanente? | Ancoragem nas fontes do usuário | Memória | BYOK / local | Preço da IA |
|---|---|---|---|---|---|---|
| **Gemini Notebook (ex-NotebookLM)** | Painel de chat ao lado das fontes; botões do Studio; agente (Deep Research, Antigravity); sugestões leves (perguntas, auto-rótulo de fontes) | **Não** no chat (só via "Save to note"); **sim** nos artefatos do Studio, escritos inteiros pela IA | Forte: citações inline até o trecho; também web e agente ("with or without sources") | Chat salvo, alimenta a "knowledge base"; instruções por notebook | Não / não | Free (100 notebooks, 50 fontes); incluso em Google AI Plus US$4,99, Pro US$19,99, Ultra US$99,99 ou US$199,99/mês; limites por computação desde 2026-09-02 (2026-10-17) |
| **Mem 2.0** | Chat flutuante, voz, agente proativo (Heads Up, nudges, routines) | **Sim**: o chat cria, edita e organiza notas; refatoração em lote | Notas, reuniões, páginas salvas, apps conectados | O produto é a memória (Mem Agent) | Não / não | Free (25 mensagens/mês); Plus US$9; Pro US$29; até Pro 20× US$199/mês (2026-10-17) |
| **Reflect Open** | Paleta convocada (⌘J), "Ask your notes", prompts salvos | **Com aprovação** na paleta (Insert/Replace/Copy); **sim** para agentes externos via MCP (sem aprovação descrita) | Sim, com citação da nota-fonte; notas `private: true` nunca saem | [não verificado] | **BYOK** (OpenAI, Anthropic, Google, OpenRouter); embeddings no dispositivo | App Mac grátis; IA paga direto ao provedor (2026-10-17) |
| **Saner.AI** | Assistente Skai proativo, chat, sugestões | Sugere tags/pastas; escrita automática [não verificado] | Notas, e-mails, calendário, Drive, Slack | [não verificado] | BYOK opcional para modelos externos | Free (30 mensagens/mês); Starter US$8; Standard US$16/mês (2026-10-17) |
| **Recall** | Automático (resumo ao salvar, auto-tag, auto-link, Augmented Browsing), chat, quizzes | **Sim**: o resumo da IA vira o card salvo | Sim (base do usuário, web opcional) | A base é a memória | Não (modelo selecionável só no Max) | Free (10 resumos/mês); Plus US$10; Max US$38/mês, cobrança anual (2026-10-17) |
| **Fabric** | Automático ("No tagging. No manual organization."), agentes agendados, chat no documento | **Sim** (agentes atualizam e rascunham); aprovação [não verificado] | Arquivos e apps conectados | "Memory Engine" | Não (multimodelo incluso) | [não verificado] |
| **Khoj** | Chat separado, agentes, automações agendadas | **Não** descrito (lê os arquivos) [não verificado] | Sim (documentos do usuário + web) | [não verificado] | **Open source, self-host, modelos locais** | Self-host grátis; cloud [não verificado] |
| **Reor** | Barra de notas relacionadas (proativa), chat RAG | [não verificado] | Sim (RAG local) | [não verificado] | **Local total** (Ollama) | Grátis; repositório arquivado em 2026-03-07 |
| **Napkin (napkin.one)** | Organização automática de ideias, feed de reflexão | **Não** (a IA só organiza e sugere tópicos) | O próprio acervo | [não verificado] | [não verificado] | [não verificado]; desktop desligado em 2026-06-30 |
| **napkin.ai** (homônimo) | Texto → visuais, sob demanda | Gera o visual (não é app de notas) | Texto selecionado | — | Não | Free; Plus US$9; Pro US$22/pessoa/mês, por créditos (2026-10-17) |
| **Mymind** | Totalmente automático (auto-tag, resumo, Serendipity) | **Sim**: tags e resumos anexados sem aceite | O próprio acervo | — | [não verificado] | Student US$7,99/mês; Mastermind US$12,99/mês (2026-10-17) |
| **Elephas** | Assistente de sistema no Mac, "Private Brains" | [não verificado] | Sim, com fontes | [não verificado] | **BYOK ou modelo no computador** | Personal US$19/mês (US$15 no anual); Professional US$29 (2026-10-17) |
| **Rewind / Limitless** | Gravação contínua + busca (encerrado) | n/a (captura desligada em 2025-12-19) | Gravações do usuário | — | — | Pendant fora de venda desde 2025-12-05; serviço encerrado no Brasil e na UE |
| **Granola** | O usuário escreve; IA gera "Enhanced" depois da reunião; chat; Briefs proativos | **Sim** (versão Enhanced gerada pela IA), com "My notes" separada e texto do usuário em preto | Sim (transcrição + notas; chat com citações) | Histórico de reuniões (30 dias no Basic) | Não / não | Basic US$0; Business US$14; Enterprise US$35/usuário/mês (2026-10-17) |
| **Notion AI** | Inline (espaço, "Edit with AI", `/AI Block`), chat, Agent, Custom Agents autônomos, Autofill automático, skills com `/` | **Sim**: "writes directly on the page" (com accept/discard no inline); Agent edita por padrão; "suggest edits" opt-in desde 2026-08-28; histórico com atribuição desde 2026-10-13 | Workspace + conectores; Enterprise Search cita fontes; recorre a conhecimento geral | Página de Instructions; "remembers over time" | Não (desde 2026-10-13 aceita o plano ChatGPT Plus/Pro, sem chave) | Business US$20/membro/mês com IA "unlimited"; Free/Plus só trial; Custom Agents US$10 por 1.000 créditos (2026-10-17) |
| **OneNote + Copilot** | Painel lateral e clique direito; Copilot Notebooks | **Com aprovação**: resumo e to-do ficam no painel; reescrita só com "Add to doc" | Página (Graph no M365; Bing na web) | Histórico; Notebooks persistentes | Não / não | Microsoft 365 Personal US$9,99/mês; Family US$12,99; Premium US$19,99; Copilot Business US$23,50 e Enterprise US$30/usuário/mês (2026-10-17) |
| **Apple Notes + Apple Intelligence** | Writing Tools sobre a seleção; resumo automático de áudio; Siri | Misto: Writing Tools agem sobre o texto [aceite não verificado]; resumo de áudio automático | Texto selecionado e dados do aparelho; sem citações | Contexto pessoal no aparelho; nada no Notes | **On-device + Private Cloud Compute**; sem BYOK | Grátis em aparelhos compatíveis, com limites diários e "fee in the future" (2026-06 a 2026-10) |
| **Google Keep + Gemini** | Botões no editor; Keep Live por voz; app Gemini | Misto: lista com **"Insert"**; Keep Live **cria e atualiza notas** (revisão + Done); app Gemini salva sem confirmação descrita | O que o usuário digita ou fala; sem citações | Nenhuma no Keep | Não / não | Keep grátis; IA via Google AI Plus US$4,99 / Pro US$19,99 ou Pixel (fontes divergem) (2026-10-17) |
| **Evernote v11** | Chat dedicado (AI Assistant), prompts com `/`, recursos ligáveis | **Sim** (cria, escreve, move, tagueia); revisão só ao renomear anexos e gravações | Notas + web; citações [não verificado] | AI Memory (2026) | Não / não | Starter US$99/ano ou US$14,99/mês; Advanced US$249,99/ano (fontes secundárias, 2026-07) |
| **Craft** | Painel do Assistant, sessões paralelas | **Com aprovação** no Explore; **sim** no Execute (macOS/iOS); ⌘Z | Documento, Space, Collections | Preferences; sessões por 30 dias | **BYOK** (OpenAI, Anthropic) desde 2026-06-05; modelos locais só leitura | Plus US$8/usuário/mês (anual; via schema); créditos 15 (Free) e 50/mês (Plus); top-ups US$10–100 (2026-10-17) |
| **Capacities** | Chat lateral, AI Panel sobre a seleção, slash no chat; nada em segundo plano | **Com aprovação por padrão** (Auto-approve opcional); conectores MCP externos escrevem sem aprovação por ação | Contexto escolhido, backlinks, web | Chats salvos como objetos | BYOK **encerrado** em 2026-08-17 | Pro US$9,99/mês (anual) com "light budget"; add-on Plus US$8,33/mês (anual) (2026-10-17) |
| **Tana / Tana Outliner** | Tana: voz, chat, agentes em reuniões, proativo. Outliner: command nodes, campos automáticos | Tana: **com aprovação** (diff; "AI never changes anything without approval"). Outliner: **sim** (command nodes) | Reunião e context graph; Outliner: notas com `@` | Context graph | Não / não | Tana Pro US$20 (early bird) a US$30/usuário/mês; Outliner Plus US$8 (2.000 créditos) e Pro US$14 (5.000) (2026-10-17) |
| **Heptabase** | Chat com seletor de contexto e de páginas; skills por slash (`/break-down-book`); AI Tutor; Agent Mode; sugestões | **Sim** (Agent Mode cria/edita cards; o Tutor escreve as notas da lição); aprovação in-app [não verificado]; `/break-down-book` revisado seção a seção | Sim (fontes do usuário com intervalo de páginas e citações) | Personalized Instruction; Tutor adaptativo | **BYOK** (OpenAI, Anthropic, Gemini, OpenRouter, HTTPS, Vertex), exceto Tutor; sem local | Pro US$11,99/mês (100 créditos); Premium US$23,99 (1.800); Premium+ US$71,99 (8.100) (2026-10-17) |
| **Obsidian + plugins** | Sem IA embutida; plugins: agentes no painel (Copilot V4, Claudian, Agent Client), notas relacionadas (Smart Connections), templates (Text Generator) | Depende do plugin: agentes **escrevem nos .md com permissões e diffs**; Smart Composer aplica com um clique | O vault (busca semântica; citações inline no Copilot) | Projects do Copilot; `AGENTS.md` | **BYOK e local** (Ollama, LM Studio) | Obsidian grátis; Copilot Plus US$14,99/mês ou US$139,99/ano (2026-10-17) |
| **Logseq + plugins** | Sem IA embutida; popup `cmd+g` ou slash `gpt`; versão DB com MCP, CLI e API | Misto: popup com **Insert/Replace**; `gpt-block`/`gpt-page` escrevem direto | Bloco ou página | [não verificado] | **BYOK e local** (Ollama) | Grátis |
| **ChatGPT** | Chat, Projects, Canvas, agente (ChatGPT Work); Pulse proativo; Study Mode opcional | O chat é o registro; no Canvas a IA edita o documento [não verificado] | Arquivos do projeto, web, conectores/MCP | Memórias salvas + histórico (desde 2025-04-10); memória de projeto | Não / não | Free (com anúncios desde 2026); Go US$8; Plus US$20; Pro US$200/mês (preços de 2026-01; não reverificados) |
| **Claude** | Chat, Projects, Artifacts, Cowork; learning mode opcional | O chat/Artifact é o registro; o usuário edita in-place desde 2026-06-12 | Projetos, web, connectors (973 no diretório) | Memória do histórico para todos (2026-03-02); ligada por padrão em Free/Pro/Max (2026-08-25); incognito | Não / não | Free; Pro US$20 (US$17 no anual); Max a partir de US$100/mês (2026-10-17) |
| **Gemini (app)** | Chat, Gems → Skills (2026-09-30), Canvas, Guided Learning, notebooks | O chat/Canvas é o registro [edição não verificada] | Arquivos, apps Google, notebooks, web | Memória e contexto pessoal; chats temporários; import de memória (2026-03-26) | Não / não | Free; AI Plus US$4,99; Pro US$19,99; Ultra US$99,99 ou US$199,99/mês (2026-10-17) |
| **Perplexity** | Busca com citações; Spaces; Pages; Comet; Computer | Pages geradas pela IA [não verificado] | Web com citações; arquivos em Spaces | [não verificado] | Não / não | Pro US$20; Max US$200/mês (fontes secundárias de 2026) |
| **Readwise Reader / Ghostreader** | Seleção → "Chat about this" ou `G`; Quick Lookup; chat lateral; Global Ghostreader com skills | **Não**: nada é salvo automaticamente; salvar na nota do documento é um clique; write tools com **"Confirm each time"** | Sim (documento; biblioteca com citação por trecho) | [não verificado] | Não (modelos "Fast" e "Thinking" inclusos) | Incluso no Readwise Full: US$9,99/mês no anual ou US$12,99 mensal (2026-10-17) |
| **MarginNote 4** | Clique direito, Ask sobre a seleção, chat em "Guide Mode", AI Hint | **Com aprovação**: "every suggestion can be accepted, edited, or rejected before it enters your knowledge graph" | Sim (excerpts com link ao parágrafo-fonte) | [não verificado] | Sem BYOK; AI Hint on-device via Apple Intelligence | Pro vitalício US$12,99 (500 créditos únicos); Max US$16,99/ano (500/mês) ou US$51,99 vitalício (2026-10-17) |
| **RemNote** | Geração de cards/quizzes/resumos a partir de PDF; AI Tutor Chat; tab completion | A IA gera os cards; revisão antes de entrar no baralho [não verificado] | Notas e PDFs do usuário | [não verificado] | Não / não | Free (250 créditos/mês); Pro US$8/mês; Pro with AI US$18/mês (2026-10-17) |
| **Kindle "Ask this Book"** | Grifar → "Ask" ou pergunta digitada, no leitor | **Não** (resposta efêmera; registro em notas [não verificado]) | Só o texto do livro comprado/emprestado | — | Não (instância "standalone"; perguntas não retidas, segundo a Amazon) | Sem custo adicional [não verificado]; EUA, iOS e alguns Kindles desde 2025-12-11 |
| **LiquidText** | [recursos de IA não verificados: a home atual não os menciona] | [não verificado] | [não verificado] | [não verificado] | [não verificado] | [não verificado] |
| *Monet (referência, do inventário interno)* | /comandos inline; chat com pastas; chat lateral no leitor | **Não**: só via "Anotar"/"Inserir", resposta por resposta | RAG por pasta/caderno (docs, notas, pastas monitoradas); página e grifos no leitor | Memória por pasta gerida pela IA; chat descartável | **BYOK** (OpenRouter + Tavily); sem modelo local | App grátis; IA paga direto ao provedor |


## (f) A afirmação do PRD se sustenta? Veredito e quem chega mais perto

### f.1 O que foi testado

O PRD faz duas afirmações:

1. Notion AI e NotebookLM "usam a IA para definir a informação";
2. "nenhum app usa a IA como mecanismo de aprofundamento mantendo a curadoria com o usuário".

Para a segunda, cada produto foi checado contra quatro critérios, todos exigidos ao mesmo tempo:

- **(a) IA convocada**, e não proativa;
- **(b) ancoragem no material do próprio usuário** (livro, PDF, grifos, notas);
- **(c) registro permanente curado pelo usuário**: a saída da IA só entra na nota por ação explícita;
- **(d) intenção declarada de aprofundamento ou aprendizado.**

### f.2 Afirmação 1: se sustenta, com ajuste de redação

**Notion: sim.**

- A documentação diz que "Notion AI writes directly on the page", embora o inline peça accept/discard ([Notion Help](https://www.notion.com/help/guides/notion-ai-for-docs)).
- O Agent "edit[s] pages, update[s] databases" por padrão, e a única confirmação descrita é para exclusões ([guia do Agent](https://www.notion.com/help/guides/get-started-with-your-personal-agent-in-notion)).
- Os Custom Agents (2026-02-24) rodam sozinhos por gatilho ou agenda, e o Autofill escreve em propriedades a cada criação ou edição de página.
- O Notion Mail foi encerrado "amid agent takeover" ([TechCrunch, 2026-06-25](https://techcrunch.com/2026/06/25/notion-mail-shuts-down-amid-agent-takeover/)).
- Os freios existem, mas são opcionais: "suggest edits" é opt-in desde 2026-08-28 ([release](https://www.notion.com/releases/2026-08-28)); o histórico de versões passou a atribuir edições a agentes em 2026-10-13 ([release](https://www.notion.com/releases/2026-10-13)).

**NotebookLM / Gemini Notebook: sim, no centro de gravidade do produto; não no chat.**

- O que confirma: o produto promete "Transform your sources into approachable formats" ([ajuda](https://support.google.com/gemininotebook/answer/16164461?hl=en)). Os Reports "dynamically suggest options based on the theme" das fontes ([9to5Google, 2025-09-08](https://9to5google.com/2025/09/08/notebooklm-flashcards-quizzes/)). No Cinematic, o Gemini é o "creative director" e toma "hundreds of structural and stylistic decisions" ([9to5Google, 2026-03-04](https://9to5google.com/2026/03/04/notebooklm-cinematic-video-overviews-ai-mode/)). O agente com "secure cloud computer" busca fontes e produz arquivos prontos ([9to5Google, 2026-06-08](https://9to5google.com/2026/06/08/notebooklm-gemini-3-5-antigravity/)). A crítica acadêmica aponta template fixo e padronização cultural dos Audio Overviews ([arXiv:2511.08654](https://arxiv.org/abs/2511.08654)).
- As notas do usuário são o elo fraco: não são editáveis no mobile, a resposta salva com citações não é editável e nota apagada não se recupera ([ajuda: notas](https://support.google.com/gemininotebook/answer/16262519?hl=en); [FAQ](https://support.google.com/gemininotebook/answer/16269187?hl=en)).
- O que contradiz: o chat **não** escreve na nota sozinho. A passagem é por "Save to note", resposta por resposta ([ajuda: chat](https://support.google.com/gemininotebook/answer/16179559?hl=en)). E o Learning Guide faz "probing, open-ended questions".

**Redação mais defensável:** "No Notion e no Gemini Notebook, o centro de gravidade é a IA produzir ou reorganizar o artefato; a escrita do próprio usuário é periférica ou opcional".

### f.3 Afirmação 2: não se sustenta na forma absoluta

Há contraexemplos verificados. A curadoria resposta a resposta deixou de ser exclusiva e virou padrão de UX em vários apps:

| Produto | (a) convocada | (b) ancorada no material | (c) curadoria do registro | (d) aprofundamento/estudo | Observação |
|---|---|---|---|---|---|
| **MarginNote 4** | Sim (clique direito, Ask) | Sim (excerpts com link ao parágrafo) | **Sim, explícita**: "every suggestion can be accepted, edited, or rejected before it enters your knowledge graph"; "You stay the author." | **Sim**: estudo, mind maps, quizzes, chat em "Guide Mode" | Atende os quatro critérios; só Mac/iPad, sem BYOK, créditos |
| **Readwise Reader / Ghostreader** | Sim (seleção, `G`) | Sim (documento e biblioteca, com citações) | **Sim**: "nada é salvo automaticamente"; ícone de caderno salva na nota; write tools com "Confirm each time" | Parcial: compreensão de leitura | Nuvem; não tem fichamento como artefato central |
| **Heptabase** | Sim (skills por slash, chat) | Sim (intervalo de páginas, citações) | **Misto**: `/break-down-book` revisado seção a seção; mas Agent Mode e Tutor escrevem cards e notas (aprovação [não verificada]) | **Sim, explícito**: AI Tutor (2026-03-31), "understands what you're learning… where you're getting stuck" | Mesmo público; BYOK com OpenRouter; app Windows |
| **Gemini Notebook (chat)** | Sim | Sim (citações até o trecho) | Sim ("Save to note") | Sim (Learning Guide, quizzes com "explain") | Mas o produto empurra os artefatos do Studio |
| **Reflect (paleta)** | Sim | Sim (cita notas) | Sim (Insert/Replace) | Não (produtividade, notas diárias) | Agentes MCP editam sem aprovação descrita |
| **OneNote + Copilot** | Sim | Sim (página) | Sim ("Add to doc") | Não | O gesto do "Inserir" no app de notas padrão do Windows |
| **Capacities, Tana, Craft (Explore)** | Sim | Sim | Sim (aprovação por padrão / diff / Explore) | Não | PKM generalistas |

**Conclusão:** a frase "nenhum app" é falsa como está. MarginNote 4 cumpre os quatro critérios; Readwise Reader e Heptabase cumprem três e meio. Pesquisadores também defendem esse desenho de forma explícita: o programa Tools for Thought, da Microsoft Research, pergunta "What would you rather have: a tool that thinks for you, or a tool that makes you think?" e propõe "keep humans in curation" ([Microsoft Research](https://www.microsoft.com/en-us/research/project/tools-for-thought/)).

### f.4 Quem chega mais perto do Monet (ranking)

1. **MarginNote 4.** Tese quase idêntica: IA como rascunho até a confirmação, "You stay the author", chat que guia em vez de responder, tudo ancorado no parágrafo do livro. **Diferenças:** só Apple (sem Windows), sem BYOK (créditos), interface complexa voltada a estudo pesado; o Monet tem chat com pastas e memória, deep research e local-first no Windows. ([MarginNote AI](https://www.marginnote.com/features/ai/index.html))
2. **Heptabase.** Mesma persona (aprender e pesquisar a fundo), leitura de PDF com skills por slash e citações, AI Tutor, BYOK com OpenRouter e app Windows. **Diferenças:** conta e sync em nuvem, sem E2EE, créditos; o agente e o Tutor escrevem no workspace, e a home promete que a IA vai "take notes, and organize your knowledge base for you". É o **concorrente mais direto** para a persona do Monet. ([Heptabase](https://heptabase.com/); [ajuda: planos](https://support.heptabase.com/en/articles/12990121-plans-and-pricing))
3. **Readwise Reader / Ghostreader.** O ciclo leitura → pergunta sobre o trecho → salvar a resposta na nota por clique é o mesmo do Reader do Monet, e ainda há permissões por ferramenta com Approve/Deny. **Diferenças:** é leitor (não caderno de fichamento), roda na nuvem e não tem BYOK nas páginas consultadas. ([Ghostreader Chat](https://docs.readwise.io/reader/guides/ghostreader/chat))
4. **Reflect Open.** A arquitetura mais parecida: local-first em Markdown, BYOK com OpenRouter, desktop grátis, IA convocada com Insert/Replace e citações; build Windows experimental. **Diferenças:** foco em notas diárias, sem leitor nem foco em estudo, e abre as notas para agentes externos editarem. ([Reflect Open](https://reflect.app/blog/reflect-open))
5. **Gemini Notebook.** Chat ancorado com citações, Learning Guide e "Save to note". **Diferenças:** nuvem Google, chat persistente que vira "knowledge base", notas secundárias e marketing centrado em artefatos prontos.
6. **OneNote + Copilot**, por ser o app padrão do Windows com o gesto "Add to doc". **Diferenças:** sem foco em aprofundamento, sem BYOK, preso ao Microsoft 365.

### f.5 O que continua distintivo, e o que já é paridade

**Sem equivalente entre os produtos verificados** (a combinação, não cada peça):

- desktop **Windows**, **local-first**, **sem conta**;
- **BYOK** com OpenRouter + Tavily;
- **fichamento/caderno** como artefato central, com leitor PDF/EPUB e chat contextual da página e dos grifos;
- chat com pastas, system prompt e memória por pasta;
- a regra "**a IA nunca escreve no permanente**", aplicada ao app inteiro como arquitetura, e não a um recurso;
- **chat explicitamente descartável**, enquanto o mercado trata o histórico como base de conhecimento (Gemini Notebook, Capacities, Claude, ChatGPT).

**Já é paridade:** "pergunte ao livro" (Kindle "Ask this Book", Ghostreader, Gemini Notebook com ebooks do Play Books); chat com projetos e memória (ChatGPT, Claude, Gemini, Perplexity); citações inline; slash commands de IA (Heptabase; Notion com skills por `/` desde 2026-09-15; prompts com `/` no Evernote); BYOK com OpenRouter (Reflect Open, Heptabase).

### f.6 Ressalvas que o PRD deveria incorporar

1. **"Convocada" não basta.** Um /summarize convocado continua sendo offloading. A evidência associa perda de aprendizado a deixar a IA fazer o trabalho gerador, não à proatividade em si (Melumad & Yun; Bastani; Anthropic 2026; ver seção c). O que protege o aprendizado é o usuário elaborar.
2. **Os usuários preferem a condição que aprende menos.** No RCT Cambridge/Microsoft, os alunos preferiram o LLM e o acharam mais útil, embora anotar tenha rendido mais ([Microsoft Research](https://www.microsoft.com/en-us/research/?p=1143413)). A tese pode estar certa e ser impopular.
3. **O próprio uso do Monet aponta para o chat.** O inventário registra que os /comandos geram pouco valor e que o chat com RAG é muito útil (2026-10-11). Isso combina com a convenção de mercado (chat ancorado com citações) e com o resultado "anotar + LLM ao lado".
4. **A escrita por agentes externos via MCP é a nova porta dos fundos.** Reflect, Notion, Capacities, Heptabase e o conector Microsoft 365 já deixam um agente fora da interface gravar no registro. Se o Monet expuser MCP, a regra de curadoria precisa valer também ali (por exemplo, só leitura ou fila de aprovação).

### f.7 Redação sugerida para o PRD

> "Os líderes (Notion, Gemini Notebook, Evernote) e vários AI-native (Mem, Recall, Mymind) concentram a IA em produzir ou reorganizar o artefato. Alguns apps já oferecem a curadoria resposta a resposta como recurso (OneNote, Capacities, Tana, Readwise Ghostreader, Reflect), e poucos a combinam com foco em estudo (MarginNote 4, Heptabase). Entre os produtos verificados até 2026-10, nenhum faz da curadoria uma regra de arquitetura do app inteiro, com chat descartável, fichamento local-first, leitor integrado e BYOK no Windows."

### Limitações da pesquisa

- A cota de WebSearch da sessão (200 buscas compartilhadas por todos os agentes) esgotou cedo. Quase tudo foi verificado por WebFetch em páginas oficiais, help centers, changelogs, GitHub e imprensa.
- Reddit, The Verge, Ars Technica, openai.com/chatgpt.com/help.openai.com, PNAS, MDPI e SSRN bloquearam o acesso em vários momentos. O sentimento de usuários é a parte mais fraca: Trustpilot, Product Hunt, Hacker News, fóruns oficiais (Obsidian, Logseq, TidBITS) e comentários de imprensa substituíram o Reddit, e vários apps menores (Mem, Recall, Fabric, Saner, Reflect) ficaram sem críticas verificadas.
- Preços de fontes secundárias: ChatGPT (cobertura de jan/2026), Perplexity (guias de 2026), Evernote (aviso reproduzido no TidBITS), Craft (schema da homepage), preços US do Google One (9to5Google e página do Gemini). Fabric e Napkin estão sem preço.
- Páginas de help center raramente mostram data de atualização; nesses casos vale a data de acesso, 2026-10-17.

## (g) Fontes

Fontes citadas no relatório, agrupadas por produto ou seção e sem duplicatas (cada URL aparece no primeiro grupo em que é usada). A data entre parênteses é a de publicação ou atualização quando ela aparece no próprio link ou na URL; "página viva" indica página sem data visível. Todas foram acessadas em 2026-10-17. As notas de pesquisa (pasta `research_notes/IA em ferramentas de notas/` no scratchpad) trazem fontes adicionais consultadas e não citadas aqui.

#### b.1 — Gemini Notebook (ex-NotebookLM), do Google

- 9to5Google, 2026-07-16: <https://9to5google.com/2026/07/16/notebooklm-gemini-notebook/> (2026-07-16)
- notebook.google: <https://notebook.google/> (página viva)
- ajuda: fontes: <https://support.google.com/gemininotebook/answer/16215270?hl=en> (página viva)
- ajuda: áudio: <https://support.google.com/gemininotebook/answer/16212820?hl=en> (página viva)
- ajuda: vídeo: <https://support.google.com/gemininotebook/answer/16454555?hl=en> (página viva)
- 9to5Google: <https://9to5google.com/2025/03/27/notebooklm-mind-map/> (2025-03-27)
- ajuda: reports: <https://support.google.com/gemininotebook/answer/18323649?hl=en> (página viva)
- 9to5Google, 2025-09-08: <https://9to5google.com/2025/09/08/notebooklm-flashcards-quizzes/> (2025-09-08)
- 9to5Google, 2026-02-20: <https://9to5google.com/2026/02/20/notebooklm-slide-prompts/> (2026-02-20)
- 9to5Google, 2025-12-19: <https://9to5google.com/2025/12/19/notebooklm-gemini-3-data-tables/> (2025-12-19)
- 9to5Google, 2026-06-08: <https://9to5google.com/2026/06/08/notebooklm-gemini-3-5-antigravity/> (2026-06-08)
- 9to5Google: <https://9to5google.com/2024/12/13/notebooklm-redesign-plus-tier/> (2024-12-13)
- ajuda: connected apps: <https://support.google.com/gemininotebook/answer/18784282?hl=en> (página viva)
- ajuda: chat: <https://support.google.com/gemininotebook/answer/16179559?hl=en> (página viva)
- ajuda: notas: <https://support.google.com/gemininotebook/answer/16262519?hl=en> (página viva)
- FAQ: <https://support.google.com/gemininotebook/answer/16269187?hl=en> (página viva)
- blog.google, 2026-09-15: <https://blog.google/innovation-and-ai/products/gemini-notebook/new-study-tools-september-2026/> (2026-09-15)
- blog.google: <https://blog.google/technology/google-labs/notebooklm-custom-personas-engine-upgrade/> (2025-10-29)
- ajuda: privacidade: <https://support.google.com/gemininotebook/answer/17004255?hl=en> (página viva)
- ajuda: notebooks no Gemini: <https://support.google.com/gemininotebook/answer/17003757?hl=en> (página viva)
- ajuda: planos: <https://support.google.com/gemininotebook/answer/16213268?hl=en> (página viva)
- gemini.google: <https://gemini.google/us/subscriptions/?hl=en> (página viva)
- 9to5Google: <https://9to5google.com/2026/06/08/google-ai-plus-price-drop/> (2026-06-08)
- 9to5Google: <https://9to5google.com/2026/05/19/google-ai-ultra-100/> (2026-05-19)
- ajuda: limites: <https://support.google.com/gemininotebook/answer/17670842?hl=en> (página viva)
- blog.google: <https://blog.google/innovation-and-ai/products/gemini-app/notebooks-gemini-notebooklm/> (2026-04-08)
- 9to5Google: <https://9to5google.com/2026/08/27/gemini-notebook-play-books/> (2026-08-27)
- Trustpilot: <https://www.trustpilot.com/review/notebooklm.google> (página viva)
- arXiv:2511.08654: <https://arxiv.org/abs/2511.08654> (v1 2025-11-11; v2 2026-05-23)

#### b.1 — Mem (Mem 2.0)

- Mem: <https://get.mem.ai/blog/introducing-mem-2-0> (2025-10-01)
- get.mem.ai: <https://get.mem.ai/> (página viva)
- Mem blog: <https://get.mem.ai/blog/ai-knowledge-base-refactoring> (2025-11-19)
- pricing: <https://get.mem.ai/pricing> (página viva)
- Mem blog: <https://get.mem.ai/blog> (página viva)

#### b.1 — Reflect (Reflect Classic → Reflect Open)

- reflect.app: <https://reflect.app/> (página viva)
- Reflect blog: <https://reflect.app/blog/edit-notes-with-coding-agents> (2026-04-28)
- privacy.md: <https://github.com/team-reflect/reflect-open/blob/master/docs/privacy.md> (página viva)
- Reflect: <https://reflect.app/blog/reflect-open> (2026-07-14)
- GitHub: <https://github.com/team-reflect/reflect-open> (página viva)
- releases: <https://github.com/team-reflect/reflect-open/releases> (0.15.0 em 2026-10-13)

#### b.1 — Saner.AI

- saner.ai: <https://www.saner.ai/> (página viva)
- pricing: <https://www.saner.ai/pricing> (página viva)

#### b.1 — Recall (getrecall.ai → recall.it)

- recall.it: <https://www.recall.it/pricing> (página viva)

#### b.1 — Fabric (fabric.so)

- fabric.so: <https://fabric.so/> (página viva)

#### b.1 — Khoj

- GitHub: <https://github.com/khoj-ai/khoj> (página viva)
- estatísticas do Obsidian: <https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json> (página viva)
- khoj.dev: <https://khoj.dev/> (página viva)

#### b.1 — Reor

- GitHub: <https://github.com/reorproject/reor> (arquivado em 2026-03-07)

#### b.1 — Napkin (napkin.one) e o homônimo napkin.ai

- napkin.one: <https://napkin.one/> (aviso de desligamento em 2026-06-30)
- napkin.ai: <https://www.napkin.ai/pricing> (página viva)

#### b.1 — Mymind

- mymind.com: <https://mymind.com/> (página viva)
- pricing: <https://access.mymind.com/pricing> (página viva)

#### b.1 — Elephas

- pricing: <https://elephas.app/pricing> (página viva)

#### b.1 — Rewind e Limitless

- limitless.ai: <https://www.limitless.ai/> (avisos de 2025-12-05 e 2025-12-19)

#### b.1 — Granola

- granola.ai: <https://www.granola.ai/> (página viva)
- blog: <https://www.granola.ai/blog> (lista de posts de 2024-10-23 a 2026-07-28)
- ajuda: <https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes> (página viva)
- pricing: <https://www.granola.ai/pricing> (página viva)
- TechCrunch: <https://techcrunch.com/2025/05/14/ai-note-taking-app-granola-raises-43m-at-250m-valuation-launches-collaborative-features/> (2025-05-14)

#### b.2 — Notion AI

- release 2025-09-18: <https://www.notion.com/releases/2025-09-18> (2025-09-18)
- ajuda: Agent: <https://www.notion.com/help/notion-agent> (página viva)
- release 2026-02-24: <https://www.notion.com/releases/2026-02-24> (2026-02-24)
- ajuda: Custom Agents: <https://www.notion.com/help/custom-agents> (página viva)
- ajuda: <https://www.notion.com/help/enterprise-search> (página viva)
- release 2025-05-13: <https://www.notion.com/releases/2025-05-13> (2025-05-13)
- ajuda: <https://www.notion.com/help/ai-meeting-notes> (página viva)
- ajuda: <https://www.notion.com/help/autofill> (página viva)
- releases, p. 2: <https://www.notion.com/releases/page/2> (página viva)
- p. 4: <https://www.notion.com/releases/page/4> (página viva)
- p. 5: <https://www.notion.com/releases/page/5> (página viva)
- guia: <https://www.notion.com/help/guides/notion-ai-for-docs> (página viva)
- FAQ: <https://www.notion.com/help/notion-ai-faqs> (página viva)
- releases: <https://www.notion.com/releases> (página viva)
- guia do Agent: <https://www.notion.com/help/guides/get-started-with-your-personal-agent-in-notion> (página viva)
- release 2026-08-28: <https://www.notion.com/releases/2026-08-28> (2026-08-28)
- release 2026-10-13: <https://www.notion.com/releases/2026-10-13> (2026-10-13)
- guia geral: <https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai> (página viva)
- segurança: <https://www.notion.com/help/notion-ai-security-practices> (página viva)
- ajuda: <https://www.notion.com/help/instructions-for-notion-agent> (página viva)
- ajuda: <https://www.notion.com/help/manage-ai-models-and-member-credit-spend> (página viva)
- ajuda: <https://www.notion.com/help/use-your-chatgpt-plan-with-notion-agent> (página viva)
- pricing: <https://www.notion.com/pricing> (página viva)
- PricingSaaS: <https://pricingsaas.com/companies/notion> (página viva)
- release 2026-04-14: <https://www.notion.com/releases/2026-04-14> (2026-04-14)
- TechCrunch: <https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/> (2026-05-13)
- TechCrunch: <https://techcrunch.com/2026/06/25/notion-mail-shuts-down-amid-agent-takeover/> (2026-06-25)
- Willison, 2025-09-19: <https://simonwillison.net/2025/Sep/19/notion-lethal-trifecta/> (2025-09-19)
- HN: <https://news.ycombinator.com/item?id=45304816> (página viva)
- Trustpilot: <https://www.trustpilot.com/review/notion.so> (página viva)
- TechCrunch: <https://techcrunch.com/2026/06/07/notion-restores-access-to-anthropic-after-service-disruption/> (2026-06-07)

#### b.2 — Microsoft OneNote + Copilot

- resumo: <https://support.microsoft.com/en-us/OneNote/copilot-pages/summarize-your-onenote-notes-with-microsoft-365-copilot> (página viva)
- to-do: <https://support.microsoft.com/en-us/OneNote/copilot-pages/create-a-to-do-list-and-tasks-in-onenote-with-copilot> (página viva)
- reescrita: <https://support.microsoft.com/en-us/OneNote/copilot-pages/rewrite-text-with-copilot-in-onenote> (página viva)
- Notebooks, out/2026: <https://techcommunity.microsoft.com/blog/microsoft-copilot-blog/whats-new-in-notebooks--october-2026/4559105> (página viva)
- Insider Blog: <https://techcommunity.microsoft.com/blog/microsoft365insiderblog/text-predictions-off-by-default-in-word-and-outlook/4549085> (página viva)
- Learn: privacidade: <https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-privacy> (página viva)
- blog: <https://techcommunity.microsoft.com/category/microsoft365copilot/blog/microsoft365copilotblog> (página viva)
- comparação: <https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products> (página viva)
- uso de IA: <https://support.microsoft.com/topic/68530f1a-4459-4d02-9818-8233c1f673b8> (página viva)
- Copilot: <https://www.microsoft.com/en-us/microsoft-365-copilot> (página viva)
- post: <https://techcommunity.microsoft.com/blog/microsoft-copilot-blog/evolution-of-the-copilot-pricing-model/4559416> (2026-09-25)
- blog: <https://www.microsoft.com/en-us/microsoft-365/blog/2025/01/16/copilot-is-now-included-in-microsoft-365-personal-and-family/> (2025-01-16)
- blog: <https://www.microsoft.com/en-us/microsoft-365/blog/2025/10/01/meet-microsoft-365-premium-your-ai-and-productivity-powerhouse/> (2025-10-01)
- suporte: <https://support.microsoft.com/en-us/office/what-is-happening-to-onenote-for-windows-10-2b453bfe-66bc-4ab2-9118-01e7eb54d2d6> (página viva)
- Learn: <https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-licensing> (página viva)
- CRN Australia: <https://www.crn.com.au/news/2025/software/microsoft-accc-m365-court-battle> (página viva)
- Business News Australia: <https://direct.businessnewsaustralia.com/articles/microsoft-apologises-and-offers-refunds-after-accc-copilot-action.html> (página viva)

#### b.2 — Apple Intelligence no Apple Notes

- Newsroom, 2024-10-28: <https://www.apple.com/newsroom/2024/10/apple-intelligence-is-available-today-on-iphone-ipad-and-mac/> (2024-10-28)
- Apple Intelligence: <https://www.apple.com/apple-intelligence/> (página viva)
- Newsroom, 2025-06-09: <https://www.apple.com/newsroom/2025/06/apple-intelligence-gets-even-more-powerful-with-new-capabilities-across-apple-devices/> (2025-06-09)
- iOS: <https://www.apple.com/ios/> (página viva)
- Newsroom: Siri AI: <https://www.apple.com/newsroom/2026/06/apple-introduces-siri-ai-a-profoundly-more-capable-and-personal-assistant/> (2026-06)
- Newsroom: DMA: <https://www.apple.com/newsroom/2026/06/due-to-dma-siri-ai-delayed-in-eu-for-ios-27-and-ipados-27/> (2026-06)
- declaração conjunta: <https://blog.google/company-news/inside-google/company-announcements/joint-statement-google-apple/> (2026-01-12)
- Newsroom: <https://www.apple.com/newsroom/2026/06/apple-intelligence-brings-powerful-ai-capabilities-into-everyday-experiences/> (2026-06)
- Wikipedia: <https://en.wikipedia.org/wiki/Apple_Intelligence> (página viva)
- suporte: <https://support.apple.com/en-us/121115> (página viva)
- Daring Fireball: <https://daringfireball.net/2025/03/something_is_rotten_in_the_state_of_cupertino> (2025-03)

#### b.2 — Google Keep + Gemini

- ajuda: lista: <https://support.google.com/keep/answer/15222789?hl=en> (página viva)
- ajuda: título: <https://support.google.com/keep/answer/14626262?hl=en> (página viva)
- ajuda: Keep Live: <https://support.google.com/keep/answer/17499364?hl=en> (página viva)
- ajuda Gemini: <https://support.google.com/gemini/answer/15229592?hl=en> (página viva)
- 9to5Google: <https://9to5google.com/2026/01/03/recap-google-keep-2025/> (2026-01-03)
- 9to5Google, 2026-09-03: <https://9to5google.com/2026/09/03/gmail-docs-keep-live/> (2026-09-03)
- ajuda: <https://support.google.com/keep/answer/14615114?hl=en> (página viva)
- Privacy Hub: <https://support.google.com/gemini/answer/13594961?hl=en> (página viva)
- 9to5Google: <https://9to5google.com/2026/05/19/google-keep-docs-live-pics/> (2026-05-19)
- 9to5Google: <https://9to5google.com/2026/06/04/google-keep-large-fab/> (2026-06-04)

#### b.2 — Evernote (v11, Bending Spoons)

- recursos de IA: <https://evernote.com/en-us/features/ai-features> (página viva)
- v11: <https://evernote.com/blog/introducing-v11> (página viva)
- 115+ melhorias: <https://evernote.com/blog/115-improvements-since-v11> (2026-07-21)
- 11.35.6: <https://evernote.com/en-us/release-notes/11.35.6> (página viva)
- release notes: <https://evernote.com/release-notes> (página viva)
- termos: <https://evernote.com/legal/supplemental-terms> (página viva)
- retrospectiva 2025: <https://evernote.com/blog/2025-recap> (página viva)
- TidBITS: <https://talk.tidbits.com/t/evernote-2026-price-tiers-floored-me/33792> (página viva)
- UseCarly: <https://www.usecarly.com/blog/evernote-pricing/> (página viva)
- Trustpilot: <https://www.trustpilot.com/review/evernote.com> (página viva)

#### b.2 — Craft

- ajuda: <https://craft-support.mintlify.site/en/ai-assistant> (página viva)
- blog 3.3.10: <https://www.craft.do/blog/craft-update-3-3-10> (página viva)
- craft.do/write: <https://www.craft.do/write> (página viva)
- ajuda: <https://craft-support.mintlify.site/en/ai-assistant/using> (página viva)
- blog: <https://www.craft.do/blog/deepseek-r1-in-craft-assistant> (página viva)
- blog 3.4.4: <https://www.craft.do/blog/craft-update-3-4-4> (2026-06-05)
- craft.do: <https://www.craft.do/> (página viva)
- uso e limites: <https://craft-support.mintlify.site/en/ai-assistant/usage> (página viva)
- blog: <https://www.craft.do/blog/your-content-is-yours> (2025-11-27)
- blog: <https://www.craft.do/blog/introducing-craft-agents> (página viva)
- Pragmatic Engineer: <https://newsletter.pragmaticengineer.com/i/185980265/4-new-way-to-build-software> (página viva)

#### b.2 — Capacities

- docs: <https://docs.capacities.io/reference/ai-assistant> (página viva)
- Release 71: <https://capacities.io/whats-new/release-71> (página viva)
- Release 69: <https://capacities.io/whats-new/release-69> (2026-08)
- conectores: <https://docs.capacities.io/reference/ai-chat-connectors> (página viva)
- privacidade: <https://docs.capacities.io/more/ai-privacy> (página viva)
- pricing: <https://capacities.io/pricing> (página viva)
- Release 62: <https://capacities.io/whats-new/release-62> (página viva)
- Release 66: <https://capacities.io/whats-new/release-66> (página viva)
- Product Hunt: <https://www.producthunt.com/products/capacities/reviews> (página viva)

#### b.2 — Tana (Tana e Tana Outliner)

- tana.inc: <https://tana.inc/> (página viva)
- changelog: <https://tana.inc/changelog> (página viva)
- outliner.tana.inc: <https://outliner.tana.inc/> (página viva)
- pricing: <https://tana.inc/pricing> (página viva)
- pricing do Outliner: <https://outliner.tana.inc/pricing> (página viva)
- Product Hunt: <https://www.producthunt.com/products/tana/reviews> (página viva)
- fórum: <https://discuss.logseq.com/t/logseq-md-or-logseq-db-mcp-for-claude/34881> (página viva)

#### b.2 — Heptabase

- heptabase.com: <https://heptabase.com/> (página viva)
- roadmap: <https://wiki.heptabase.com/roadmap> (página viva)
- AI Tutor: <https://heptabase.com/ai-tutor> (página viva)
- ajuda: livro longo: <https://support.heptabase.com/en/articles/16762580-how-do-i-use-a-whole-book-or-long-pdf-with-heptabase-ai> (página viva)
- newsletter 2026-05-29: <https://wiki.heptabase.com/newsletters> (2026-05-29)
- ajuda: Claude: <https://support.heptabase.com/en/articles/17574823-use-heptabase-with-claude-and-claude-code> (página viva)
- pricing: <https://heptabase.com/pricing> (página viva)
- ajuda: BYOK: <https://support.heptabase.com/en/articles/10505755-use-your-own-ai-api-keys> (página viva)
- ajuda: dados: <https://support.heptabase.com/en/articles/10448141-is-my-data-safe-in-heptabase> (página viva)
- ajuda: planos: <https://support.heptabase.com/en/articles/12990121-plans-and-pricing> (atualizada na semana de 2026-10-17)
- download: <https://heptabase.com/download> (página viva)
- Product Hunt: <https://www.producthunt.com/products/heptabase/reviews> (página viva)
- AMA: <https://wiki.heptabase.com/ama-2024-11> (página viva)
- wiki: <https://wiki.heptabase.com/the-best-way-to-acquire-knowledge-from-readings> (página viva)

#### b.2 — Obsidian (sem IA embutida) e seus plugins

- ajuda: Interpreter: <https://obsidian.md/help/web-clipper/interpreter> (página viva)
- CLI: <https://obsidian.md/cli> (página viva)
- GitHub: <https://github.com/kepano/obsidian-skills> (página viva)
- release 4.0.0: <https://github.com/logancyang/obsidian-copilot/releases/tag/4.0.0> (página viva)
- 4.0.6: <https://github.com/logancyang/obsidian-copilot/releases/tag/4.0.6> (página viva)
- docs: <https://docs.obsidiancopilot.com/agent-mode-and-tools/> (página viva)
- README: <https://github.com/RAIT-09/obsidian-agent-client> (página viva)
- README: <https://github.com/YishenTu/claudian> (página viva)
- pricing: <https://www.obsidiancopilot.com/en/pricing> (página viva)
- README: <https://github.com/glowingjade/obsidian-smart-composer> (página viva)
- issue #1269: <https://github.com/brianpetro/obsidian-smart-connections/issues/1269> (página viva)
- fórum: <https://forum.obsidian.md/t/ai-less-editing-toolbar/114217> (página viva)
- 4.0.1: <https://github.com/logancyang/obsidian-copilot/releases/tag/4.0.1> (página viva)
- stephango.com: <https://stephango.com/vault> (página viva)

#### b.2 — Logseq e seus plugins

- anúncio 2026-04-24: <https://logseq.io/p/e3YDyX5AYr> (2026-04-24)
- fórum: <https://discuss.logseq.com/t/how-is-logseq-s-official-development-aligning-with-the-emerging-agentic-ai-trend/34823> (página viva)
- releases: <https://github.com/logseq/logseq/releases> (página viva)
- README: <https://github.com/briansunter/logseq-plugin-gpt3-openai> (página viva)
- stats: <https://raw.githubusercontent.com/logseq/marketplace/master/stats.json> (página viva)
- fórum: <https://discuss.logseq.com/t/last-version-before-any-llm-generated-code-was-merged/35262> (página viva)

#### b.3 — ChatGPT (OpenAI)

- Wikipedia: <https://en.wikipedia.org/wiki/ChatGPT> (página viva)
- TechCrunch: <https://techcrunch.com/2025/09/25/openai-launches-chatgpt-pulse-to-proactively-write-you-morning-briefs/> (2025-09-25)
- TechCrunch: <https://techcrunch.com/2025/04/10/openai-updates-chatgpt-to-reference-your-other-chats/> (2025-04-10)
- Daring Fireball, 2026-01-16: <https://daringfireball.net/linked/2026/01/16/chatgpt-go> (2026-01-16)
- Constellation Research: <https://www.constellationr.com/insights/news/openai-launches-chatgpt-go-ad-tests> (jan/2026)
- TechCrunch: <https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt/> (2025-07-29)

#### b.3 — Claude (Anthropic)

- release notes: <https://support.claude.com/en/articles/12138966-release-notes> (página viva)
- claude.com/connectors: <https://claude.com/connectors> (página viva)
- pricing: <https://claude.com/pricing> (página viva)
- Anthropic: <https://www.anthropic.com/news/introducing-claude-for-education> (2025-04-02)
- Engadget: <https://engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html> (ago/2025)

#### b.3 — Gemini (app do Google)

- release notes: <https://gemini.google/release-notes/> (página viva)
- gemini.google: <https://gemini.google/subscriptions/> (página viva)
- blog.google: <https://blog.google/outreach-initiatives/education/guided-learning/> (2025-08-06)

#### b.3 — Perplexity

- Wikipedia: <https://en.wikipedia.org/wiki/Perplexity_AI> (página viva)
- Finout: <https://www.finout.io/blog/perplexity-pricing-in-2026> (2026, data exata n/d)

#### b.4 — Readwise Reader / Ghostreader

- visão geral: <https://docs.readwise.io/reader/guides/ghostreader/overview> (página viva)
- Global: <https://docs.readwise.io/reader/guides/ghostreader/global> (página viva)
- Chat: <https://docs.readwise.io/reader/guides/ghostreader/chat> (página viva)
- pricing: <https://readwise.io/pricing> (página viva)
- docs: <https://docs.readwise.io/tools> (página viva)

#### b.4 — MarginNote 4 (Mac e iPad)

- MarginNote AI: <https://www.marginnote.com/features/ai/index.html> (página viva)
- marginnote.com: <https://www.marginnote.com/> (página viva)
- pricing: <https://www.marginnote.com/pricing/index.html> (página viva)

#### b.4 — RemNote

- pricing: <https://www.remnote.com/pricing> (página viva)

#### b.4 — Amazon Kindle: "Ask this Book"

- Authors Guild, 2025-12-23, atualizado em 2026-01-07: <https://authorsguild.org/news/statement-on-amazon-kindle-ask-this-book-ai-feature/> (2025-12-23; atualizado 2026-01-07)

#### b.4 — LiquidText

- liquidtext.net: <https://www.liquidtext.net/> (página viva)

#### b.5 Integrações via MCP

- developers.notion.com: <https://developers.notion.com/docs/mcp> (página viva)

#### (c) Evidência científica e debate: cognitive offloading e aprendizado com IA

- arXiv: <https://arxiv.org/abs/2506.08872> (v1 2025-06-10; v2 2025-12-31)
- brainonllm.com: <https://www.brainonllm.com/> (página viva)
- arXiv: <https://arxiv.org/abs/2601.00856> (2025-12-29)
- Microsoft Research: <https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/> (CHI 2025, abr/2025)
- Knowledge at Wharton, 2024-08-27: <https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/> (2024-08-27)
- Phys.org (2025-01-13): <https://phys.org/news/2025-01-ai-linked-eroding-critical-skills.html> (2025-01-13)
- Anthropic: <https://www.anthropic.com/research/AI-assistance-coding-skills> (2026-01-29)
- Microsoft Research: <https://www.microsoft.com/en-us/research/?p=1143413> (Computers & Education, nov/2025)
- Stanford SCALE: <https://scale.stanford.edu/ai/repository/experimental-evidence-effects-large-language-models-versus-web-search-depth-learning> (estudo de out/2025)
- PsyPost, 2026-01-17: <https://www.psypost.org/learning-from-ai-summaries-leads-to-shallower-knowledge-than-web-search/> (2026-01-17)
- Nature: <https://www.nature.com/articles/s41598-025-97652-6> (2025-06-03)
- blog: <https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria> (2025-01-09)
- Anthropic: <https://www.anthropic.com/news/anthropic-education-report-how-university-students-use-claude> (2025-04-08)
- nota de retratação: <https://www.nature.com/articles/s41599-026-07310-z> (2026-04-22)
- Tom's Guide: <https://www.tomsguide.com/ai/claudes-new-learning-modes-take-on-chatgpts-study-mode-heres-what-they-do> (ago/2025)
- research.google: <https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/> (2025-09-16)
- projeto: <https://www.microsoft.com/en-us/research/project/tools-for-thought/> (página viva)
- TED, set/2025: <https://www.ted.com/talks/advait_sarkar_how_to_stop_ai_from_killing_your_critical_thinking> (TEDAI Vienna, 2025-09-26)

#### (d) Padrões de UX de IA que viraram convenção, e como se cobra a IA

- shapeof.ai: <https://www.shapeof.ai/> (página viva)
- HAX: <https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/> (página viva)
- maggieappleton.com: <https://maggieappleton.com/lm-sketchbook> (c. 2023)
- andymatuschak.org: <https://andymatuschak.org/hmwl/> (2024-05-08)

#### (f) Avaliação do PRD (fontes não repetidas em outras seções)

- ajuda: <https://support.google.com/gemininotebook/answer/16164461?hl=en> (página viva)
- 9to5Google, 2026-03-04: <https://9to5google.com/2026/03/04/notebooklm-cinematic-video-overviews-ai-mode/> (2026-03-04)

#### (a) Resumo executivo (fontes não repetidas em outras seções)

- blog.google, 2026-08-28: <https://blog.google/innovation-and-ai/products/gemini-notebook/new-flexible-usage-limits/> (2026-08-28)

*Total: 252 URLs únicas.*
