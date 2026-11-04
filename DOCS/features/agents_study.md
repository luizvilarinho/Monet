# Estudo: agentes especializados (slash e chat)

> Autor: Orquestrador · 2026-11-03 · Task: `DOCS/reports/03-11-2026/taskreport_20261103230105.md`
> Base: `DOCS/reports/03-11-2026/explorerreport_20261103231208.md` (código mapeado com `arquivo:linha`) e uma cópia somente leitura do banco de PRD.
> Escopo: o comportamento de 11 agentes, a arquitetura comum, a política de perguntas e o contrato planner → coach. Nada foi alterado em `src/` nem em `src-tauri/`. A redação dos prompts e os testes ficam para a fase 2 (seção 10).

## 1. Resumo

Hoje os slash commands são **variações de um mesmo assistente**. Eles dividem um system prompt (`src/App.tsx:235-272`) e um mesmo contexto: a nota, até 5 trechos do RAG do caderno e, às vezes, web. O chat é um assistente geral com tools. A proposta é transformar os dois em **agentes**: cada um com um trabalho só, os dados que domina montados pelo app, um formato de saída e um rótulo.

O que decide a superfície é **a relação que o usuário terá com o texto**:

- **Slash: a IA complementa ou julga a nota.** A resposta fica na nota como bloco de IA, marcada e não editável. A autoria fica rastreável. São eles: `/define`, `/critique`, `/docs`, `/expand`, `/week-review` e `/today`.
- **Chat: a IA dá insumo que o usuário apropria.** Ele conversa, filtra e reescreve com as próprias palavras, e perder a marca de IA aí é desejável. São eles: **planner** (absorvendo o studying-plan), **tutor**, **coach** e **plan-week**.

Três achados do mapeamento pesam no desenho:

1. **O contexto pesa tanto quanto o prompt.** O RAG do caderno entra em **todo** slash sem instrução de uso (`App.tsx:2158-2223`). É por isso que o `/define` sai longo e "complementando a nota". Cada agente precisa de uma **política de contexto**, não só de um prompt.
2. **Os dados que planner e coach precisam ainda não existem estruturados.** Faltam capacidade (h/dia), objetivo do estudo e vínculo entre plano e livro. O `last_page` do Reader não mede progresso, e o sumário do livro não é persistido. A fonte confiável de progresso é o **checklist do Plan**.
3. **O chat não tem conceito de agente e faz uma rodada só de tools** (`useChat.ts:3594`). Os agentes de chat precisam de um seletor por conversa e de **contexto pré-calculado pelo app**, em vez de depender de o modelo encadear tools.

**Recomendação de ordem:** primeiro os slash (infra de agente + 6 agentes, dificuldade média), depois o plan-week, o planner com o contrato do Plan, o coach e o tutor (dificuldade média-alta).

## 2. Uso real (PRD, 2026-11-03)

- **93 blocos de IA desde 12/05.** O `/docs` é o mais usado (20, documentação técnica do trabalho). Desde agosto, o `/define` lidera (9 de 40), sempre com jargão de arquitetura. Os demais usos: `/action` e `/table` transformam texto, `/opinion` julga (Radar, SDD) e `/week` faz retrospectiva ("o que escorregou", "trazer as não concluídas").
- **O estudo tem estrutura:**
  - um plano de leitura de 20 dias em checklist ("Dia N: Cap. X"), num Plan com Início 25/10 e Fim 17/11. Hoje seria o Dia 10, mas só 3 itens estão marcados;
  - 5 fichamentos do tipo Summary com Capítulo 1–5;
  - livros no Reader com destaques;
  - notas "Temas a ser estudado", "Sugestão de artigos" e "Lista de livros 2026".
- **O `/planner` rodado hoje** veio coerente, mas difícil de ler. A complexidade vinha das regras do prompt: estimativa marcada e fonte citada em cada item, além de explicar a capacidade usada.

## 3. Arquitetura comum

### 3.1 O que é um agente

Um agente é um registro com cinco partes:

| Parte | O que define | Hoje |
| --- | --- | --- |
| **Prompt** | Núcleo comum + comportamento do agente | Um template para todos (`App.tsx:235`) |
| **Política de contexto** | Quais blocos entram (nota, RAG, web, agenda, plano, glossário) e com qual limite | `if (cmd === ...)` espalhados em `handleCommand` |
| **Formato de saída** | Estrutura e tamanho máximo | Uma linha por comando dentro do prompt |
| **Rótulo** | O nome que aparece no bloco ou no chat ("Glossário", "Crítica"...) | `getToggleTitle` (`commandParser.ts:22-40`) |
| **Superfície** | Slash, slash só no Calendar, ou chat | `calendarOnly` em `commands.ts` |

Lugar proposto: `src/lib/agents/`, com um arquivo por agente e um `core.ts`. Esse módulo passa a ser a fonte da verdade para `commands.ts`, para a seção "Command behavior" e para o `getToggleTitle`.

O **núcleo comum** fica pequeno: idioma do usuário, datas relativas a partir de hoje (semana começa na segunda), não inventar fatos e Markdown sem saudação. As regras de "complementar a nota" deixam de ser gerais e passam para os agentes que de fato complementam (`/expand`).

O transporte não muda: `useAi.start` já recebe o system prompt como parâmetro (`useAi.ts:19`). O modelo por agente fica para a fase 2.

### 3.2 Slash: o bloco é o produto

- O bloco de IA já é atômico e não editável (`EmbedBlock.ts:15`, `EmbedBlockView.tsx:49`). Ele pode ser removido, copiado ou levado ao chat (`AiCard.tsx:171-229`). Isso já cumpre a restrição do Task Report.
- Proposta: o bloco mostra **o nome do agente** ("Glossário · acoplamento", "Crítica"), não só "generated by AI".
- O slash não conversa. Quando falta informação, o agente **assume e declara a suposição** numa linha do bloco ("Considerei a nota como resumo do cap. 4").
- O bloco continua indo para `ai_responses`, e essa tabela vira a **memória dos agentes** (seção 3.5).

### 3.3 Chat: seletor por conversa

| Opção | Prós | Contras |
| --- | --- | --- |
| Pasta com prompt (já existe) | Zero código | Mistura tema e papel: uma pasta "Arquitetura" não pode ser tutor e coach ao mesmo tempo; sem contexto pré-calculado nem tools forçadas |
| **Seletor de agente na conversa** | Separa papel (agente) de tema (pasta, documentos, memória); permite contexto pré-calculado e tools forçadas | Campo novo em `ChatConversation` (`useChat.ts:275-289`), UI, regra de precedência |
| `/agente` digitado no chat | Rápido, combina com o hábito do slash | Precisa de parser no composer e de um chip visível depois de enviado |

**Recomendação:** o seletor é o mecanismo, e `/tutor`, `/coach` etc. digitados no composer são **atalhos que só ligam o seletor**, com um chip na conversa.

**Precedência:**
- o prompt do agente substitui o `CHAT_SYSTEM_PROMPT`;
- o prompt da pasta entra como `append` (contexto do tema), mesmo numa pasta em `replace`;
- a memória da pasta e a data continuam como hoje (`useChat.ts:3162-3193`);
- exceção: o chat do Reader, que já tem papel próprio, não oferece agentes na primeira versão.

Não há conflito de nomes: os agentes de chat não existem como slash de nota (o `/planner` da nota sai, seção 8).

**Contexto pré-calculado.** O chat faz uma rodada só de tools. Então o app monta, antes de chamar o modelo, o contexto de que o agente precisa (plano, progresso, agenda) e envia como `ephemeralContext` (`useChat.ts:3201-3204`, já existe). As tools continuam para consultas pontuais, e o agente liga as tools de que depende (o plan-week liga "Tasks", que hoje nasce desligada).

### 3.4 Política de perguntas

Um agente de chat não pergunta porque "sente falta". Ele tem uma **lista curta de informações necessárias**, e cada informação tem uma regra:

| Situação | Comportamento |
| --- | --- |
| O app consegue checar (existe Plan? tem Fim? quanto do checklist está feito?) | O app checa e diz ao modelo o resultado ("não há plano ativo"). O modelo não adivinha. |
| Falta e **bloqueia** a resposta (sem prazo, não dá para planejar) | **Uma** pergunta focada, com uma sugestão de resposta ("Até quando? Se for o fim do mês, 30/11"). |
| Falta e **não bloqueia** (capacidade, nível) | Responde com uma suposição declarada ("considerei 1h/dia") e diz onde corrigir. |
| A resposta do usuário é durável | O agente diz **onde ela vai ficar guardada**, para não perguntar de novo (seção 3.5). |

Nunca uma lista de perguntas. No slash a pergunta vira suposição declarada (seção 3.2). A fase 2 testa se o modelo segue a política. Os modelos flash tendem a nunca perguntar ou a perguntar demais.

### 3.5 Onde vivem os dados que não existem hoje

| Dado | Proposta | Por quê |
| --- | --- | --- |
| **Capacidade de estudo (h/dia)** | Propriedade "Capacidade" (number) no tipo **Plan** | É do plano, é durável e o coach lê |
| **Livro do plano** | Propriedade "Livro" (text, título igual ao do Reader) no Plan | Não há tipo "relação" nas propriedades; o casamento por título é suficiente para começar |
| **Capacidade de trabalho (h/dia, dias úteis)** | Settings › Agenda (novo) | Vale para todas as entregas, não para um plano. Substitui a constante de 6h (`agenda.ts:115`) |
| **Objetivo e nível do estudo (tutor)** | Nota de perfil do estudo no caderno, criada pelo usuário (o tutor sugere o texto) | Durável, editável e encontrável. A memória da pasta é texto livre em localStorage, reescrito pelo modelo, e pode perder o dado |
| **Glossário** | Os blocos `/define` (e `/definir`) de `ai_responses` | Já existe. Basta consultar por comando (não há índice em `command`, mas são 93 linhas) |
| **Recomendações já feitas** | Notas de lista do usuário ("Sugestão de artigos", "Lista de livros") | O tutor não recomenda o que já está lá |

## 4. Agentes de slash

### 4.1 `/define`: glossarista

- **Objetivo:** tornar um termo técnico compreensível em poucas linhas, no sentido do domínio da nota.
- **Fronteira:** não explica o tema (isso é tutor ou chat) e não complementa a nota (isso é `/expand`).
- **Contexto:** o termo, o nome do caderno, um trecho curto da nota em volta do termo (para o sentido) e, se o termo já tiver sido definido antes, a definição anterior. **Sem RAG e sem web.**
- **Saída:** no máximo cerca de 60 palavras:
  - uma definição em uma frase;
  - opcionalmente uma linha "Na nota:" ligando o termo ao contexto, ou um exemplo curto.
  
  Sem títulos e sem tabela.
- **Casos:**
  - **Dois termos** ("arquitetura de software e design de software"): duas definições curtas e uma linha de diferença.
  - **Pedido de explicação** ("os graus de desenvolvimento com IA com exemplos"): continua curto. Define o conceito em uma frase e lista os itens em uma linha cada. O botão "continuar no chat" do bloco já existe para quem quiser mais.
  - **Termo já definido:** reaproveita a definição para manter a consistência e diz "definido também em <nota>, <data>".
- **Reaproveita:** os termos do Related content (`src/lib/relatedTerms.ts`), que são candidatos naturais a `/define`.

### 4.2 `/critique`: revisor da nota (novo)

- **Objetivo:** dizer se a nota tem a profundidade certa e cobre os pontos mais importantes do assunto. Aceita uma instrução pontual ("confira se cobri o cap. 4", "está bom para apresentar?").
- **Fronteira com o tutor:** julga **esta nota**, numa passada. Não indica leituras nem traça caminho de estudo, o que é papel do tutor. Pode dizer "isso costuma ser tratado no cap. X".
- **Contexto:**
  - o **texto do usuário**, com os blocos de IA separados e marcados como "já complementado", para não julgar o que a IA escreveu;
  - o tipo e as propriedades da nota (um Summary com Capítulo 4 é o resumo de um capítulo);
  - o nome do caderno;
  - a instrução;
  - opcionalmente os documentos do caderno via RAG, só para checar cobertura.
- **Saída:**
  - um veredito em uma linha (adequada, rasa em pontos, superficial);
  - **Faltando:** até 3 pontos importantes ausentes, cada um com o motivo em uma linha;
  - **Raso:** até 3 pontos presentes que pedem mais profundidade;
  - **Impreciso:** só se houver erro, com a correção.
  
  Não reescreve a nota.
- **Nota quase vazia:** o app mede o texto antes de chamar o modelo e responde sem gastar chamada ("A nota tem pouco texto para avaliar").

### 4.3 `/docs`: resposta pelas fontes

- **Objetivo:** responder só com as fontes do caderno, citando cada uma.
- **Achado:** o "documentos" de hoje inclui a **pasta de notas do caderno**, que entra implícita (`rag.rs:55-87`). Sem documentos, o `/docs` responde a partir das outras notas, e o erro "No documents visible" só aparece num caderno sem nada indexado. Além disso, o slash usa **busca só vetorial**, e o comando mais usado roda na busca mais fraca do app.
- **Proposta:**
  - usar o mesmo `ragRetrieve` do chat (reescrita + busca híbrida + rerank);
  - citar a fonte com o tipo, "(doc: X)" ou "(nota: Y)", para o usuário saber se a resposta veio do manual ou das próprias anotações;
  - a frase fixa de "não encontrei" continua.
- **Saída:** resposta direta, com a citação ao fim de cada afirmação. Sem introdução.

### 4.4 `/expand`: dados novos

- **Objetivo:** acrescentar à nota o que ela não tem: contexto, exemplos, implicações, exceções, riscos e contrapontos.
- **Achado:** o `/expand` hoje **não tem web** (`commands.ts:10`). Os "dados novos" vêm da memória do modelo.
- **Contexto:** a nota (o texto do usuário) e a instrução opcional. **Proposta (D5):** web search ligada quando houver instrução, com as fontes listadas no fim. O RAG do caderno sai, ou entra só como "não repita o que já está nestas notas".
- **Saída:** de 3 a 6 itens, cada um com um dado novo e o porquê de importar. Sem resumir a nota. Fontes no fim, quando houver web.

### 4.5 `/week-review`: a semana no Calendar

- **Objetivo:** registrar o que foi feito e o que está pendente na semana, na nota diária. Substitui o `/week`.
- **Contexto:** a agenda de hoje (`selectAgenda`):
  - tasks concluídas;
  - tasks abertas e atrasadas, com "adiada Nx" (`reschedule_count`);
  - TODOS com progresso;
  - Plans em andamento com progresso do checklist;
  - notas diárias com conteúdo.
- **Proposta (D6):** a semana do calendário da nota (segunda a domingo) em vez da janela móvel de 7 + 7 dias. "Pendente" = o que vencia na semana e não foi feito, mais o que está atrasado.
- **Saída:** três blocos curtos:
  - **Feito**;
  - **Pendente**, ordenado por prazo, com os atrasados marcados;
  - **Escorregou**, com as tasks adiadas e o plano atrasado.
  
  Uma linha por item. Sem estimativa de horas e sem distribuição por dia.
- **Risco no dado:** 17 dias do Calendar têm duas notas diárias com o mesmo título. `selectAgenda` ignora as notas diárias vazias (`agenda.ts:217`), então só o dia 03/10, em que as duas têm conteúdo, chega duplicado à IA (seção 11).

### 4.6 `/today`: o dia no Calendar

- **Objetivo:** dizer o que fazer no dia da nota, o que vence e o que está parado. Fica como bloco porque, na nota diária, ele vira um **registro datado** do que foi sugerido naquele dia.
- **Fronteira:** o `/today` olha um dia e não estima horas. O plan-week (chat) distribui a semana, e o coach cobra o plano.
- **Contexto:**
  - `selectAgenda` com o dia da nota;
  - **o `plannedDay` (My Day)**, que hoje fica de fora da agenda e da linha das tasks (`types/index.ts:110`) e precisa entrar;
  - tasks em `doing`;
  - atrasadas;
  - o que vence no dia;
  - o item do dia de cada Plan ativo ("Plano de leitura: Dia 10 — Cap. 9");
  - o texto da própria nota diária (compromissos já escritos).
- **"Parado" (D7):** não existe status "bloqueado" built-in. Proposta: o app passa os status personalizados pelo nome e o agente agrupa as tasks que não estão em todo, doing ou done como "Em <status>" (hoje, "Waiting").
- **Saída:**
  - **Hoje:** de 3 a 5 itens, na ordem sugerida;
  - **Vence hoje / atrasado**;
  - **Parado:** uma linha por item, com desde quando.
  
  No máximo cerca de 10 linhas.
- **Dia da nota diferente de hoje:**
  - num dia futuro, o `/today` é uma prévia daquele dia;
  - num dia passado, vira "o que foi feito e o que ficou" daquele dia.
  
  É a mesma regra de divisão do `/week` atual (`App.tsx:2093-2098`).

## 5. Agentes de chat

### 5.1 planner (absorve o studying-plan)

- **Proposta (D8):** um agente só. A diferença do studying-plan era aceitar atividades que não são leitura, e o planner faz isso por desenho.
- **Objetivo:** traçar um plano com prazo para um objetivo: ler um livro, assistir a um curso, uma trilha de vídeos ou uma entrega com etapas.
- **Fronteira:** o planner **cria e refaz** o plano de um objetivo. O plan-week aloca a semana considerando todos os objetivos e tasks.
- **Informações necessárias:**
  - **objetivo e material:** livro, curso ou lista;
  - **prazo:** bloqueia se faltar, e então ele pergunta;
  - **ritmo:** h/dia e dias da semana, com uma suposição declarada se faltar;
  - **o que já foi feito:** quando for replanejamento.
- **Contexto:**
  - se o material é um livro do Reader, o app envia o título, o total de páginas, o maior número de página com destaque (progresso aproximado) e o sumário, **quando o livro estiver aberto**, porque o sumário de PDF/EPUB é lido só na UI e não é persistido (`Reader.tsx:159-218`, `epub.ts:273-285`). Persistir o sumário fica como melhoria (D16);
  - para replanejar, o Plan existente com o seu checklist.
- **Saída:** o plano no **formato do contrato** (seção 6), pronto para virar uma nota Plan, com as propriedades sugeridas (Início, Fim, Capacidade, Livro). Antes do checklist, no máximo duas linhas de premissas.
- **Apropriação (D14):** o usuário copia para uma nota Plan. Opcional: um botão "Salvar como nota Plan" na mensagem, que cria a nota com o tipo e as propriedades. O texto passa a ser do usuário, e é intencional que perca a marca de IA.

### 5.2 coach

- **Objetivo:** ver se as atividades planejadas estão no prazo e cobrar o ritmo necessário para cumprir o objetivo.
- **Fronteira:**
  - o coach **lê** planos e não os cria: quando o atraso não cabe mais no prazo, ele propõe replanejar e entrega o caso ao planner;
  - cobre Plans (objetivos), não as entregas de tasks, que são do plan-week. A alternativa fica em D13.
- **Contexto pré-calculado pelo app (sem tools encadeadas)**, para cada Plan ativo (Início ≤ hoje ≤ Fim, ou vencido com itens abertos):
  - itens feitos / total (`checklistProgress`, `tasks.ts:1023`);
  - **itens esperados até hoje**: pela data de cada item ou, em planos antigos "Dia N" sem data, por Início + N − 1;
  - diferença (atrasado ou adiantado N itens);
  - próximos itens;
  - a Capacidade;
  - o sinal auxiliar do Reader, quando houver Livro.
  
  O plano real de hoje dá Dia 10 esperado e 3 feitos, só com aritmética.
- **Informações necessárias:** um Plan ativo. Se não houver, ele pergunta qual objetivo acompanhar e oferece o planner. A capacidade, se faltar, vira suposição declarada e a sugestão de preencher a propriedade.
- **Saída:**
  - para cada plano, uma linha de status ("atrasado 7 dias");
  - **o que fazer** para recuperar, concreto e com data ("hoje Dia 4 e 5, amanhã Dia 6, ~2h/dia");
  - uma cobrança direta, sem sermão.
  
  Se não houver recuperação possível, uma linha propondo replanejar.
- **O Reader não é a fonte de progresso.** O `last_page` é a última posição aberta, não a mais avançada (a Odisseia está em 318, com destaques até a p. 729). Vídeo e curso não têm fonte própria. Por isso o checklist do Plan é a fonte única, e o Reader é só um sinal auxiliar.

### 5.3 tutor

- **Objetivo:** analisar o que foi estudado num tema, julgar a profundidade, alertar pontos fracos, expor o essencial do tema, indicar livros e artigos e propor atividades complementares.
- **Fronteira:**
  - com o `/critique`: o tutor olha **o tema e o caminho**, várias notas e o progresso, não uma nota;
  - com o chat geral: o `CHAT_SYSTEM_PROMPT` já é meio-tutor (`useChat.ts:65-138`), e o tutor torna isso explícito e com contexto de progresso.
- **Contexto pré-calculado:**
  - a nota de perfil do estudo (objetivo e nível);
  - o índice do que foi feito: fichamentos (Summary com Capítulo, título e tamanho), Plans e progresso, marcas abertas (`search_marks`);
  - o glossário do caderno (`/define` em `ai_responses`);
  - as notas de lista (para não recomendar o que já está lá).
  
  O conteúdo das notas vem por tool (`get_note`, `search_knowledge_base`) quando o modelo precisar. Para checar se um livro ou artigo existe, usa web search.
- **Informações necessárias:** objetivo e nível. Se não houver nota de perfil, a primeira resposta faz **uma** pergunta (o objetivo) e propõe o texto da nota de perfil para o usuário salvar.
- **Saída:** curta e em seções, no máximo 3 itens cada:
  - **Sólido**;
  - **Fraco** (com o porquê);
  - **Essencial que falta**;
  - **Leituras** (só títulos que existem, com o motivo);
  - **Atividade** (um exercício, kata ou pergunta de revisão).

### 5.4 plan-week

- **Objetivo:** planejar a semana de entregas a partir das tasks. É o `/planner` de hoje, levado para o chat e com escopo menor.
- **Fronteira:** aloca a semana. Não cria plano de objetivo (planner) nem cobra (coach). O `/today` é o recorte de um dia.
- **Contexto pré-calculado:**
  - a agenda do `/planner` atual (`selectAgenda` de hoje até o fim da semana e os próximos prazos);
  - **com `plannedDay`**;
  - **os itens com data dos Plans ativos**, como compromissos que já ocupam a capacidade;
  - a capacidade de trabalho (Settings, D11);
  - a tool "Tasks" ligada por padrão para esse agente.
- **Informações necessárias:** capacidade. Se não estiver em Settings, vale a suposição declarada de 6h e a sugestão de configurar.
- **Saída (o ponto da reclamação original):**
  - dia a dia, no máximo 4 itens por dia, com as horas **só no total do dia**;
  - sem a fonte em cada item e sem o rótulo "estimativa da IA" repetido (vira uma linha no rodapé);
  - **Parados** e **Riscos** com no máximo 2 linhas cada.
  
  A redação exata fica para a fase 2.
- **Futuro:** uma ação para aplicar o plano (gravar o `scheduled_date` das tasks com confirmação). Fica fora deste estudo.

## 6. Contrato planner → coach

O plano é o documento que liga os dois. O planner escreve, o usuário apropria numa nota Plan e o coach lê. Para o coach medir sem adivinhar:

```markdown
- [ ] **25/10 (sáb) · Dia 1:** Cap. 1 e 2 (p. 1–40)
- [ ] **26/10 (dom) · Dia 2:** Cap. 3, parte 1 (p. 41–62)
- [ ] **27/10 (seg) · Assistir:** aula 3 do módulo SDD (50 min)
```

- **Um item = uma linha de checklist**, começando por uma **data dd/mm** em negrito. A data por item torna o atraso exato e permite pular dias de folga.
- O conteúdo é livre: capítulo, páginas, vídeo, exercício. As páginas, quando houver, deixam o Reader servir de sinal auxiliar.
- **Propriedades do Plan:** Início, Fim, **Capacidade** (nova) e **Livro** (nova, opcional).
- **Compatibilidade:** planos antigos "Dia N" sem data continuam legíveis. O coach assume dias corridos a partir do Início e avisa que essa foi a regra usada.
- **O parser fica no app** (por exemplo em `src/lib/plan.ts`), não no prompt: o app calcula esperado × feito e entrega os números ao coach.

O ciclo completo:

```text
planner (cria/refaz) ──▶ nota Plan ──▶ plan-week (aloca na semana)
                              │                 │
                              ▼                 ▼
                     coach (cobra o ritmo)   /today (o dia)
                              │
                              ▼
                     /week-review (registra a semana)
```

## 7. Sobreposições resolvidas

| Par | Fronteira proposta |
| --- | --- |
| studying-plan × planner | Um agente só (D8) |
| `/critique` × tutor | Escopo: esta nota, numa passada (bloco) × o tema e o caminho, em conversa |
| `/define` × `/expand` | Um termo, curto × o que falta na nota inteira |
| `/today` × plan-week | Um dia, sem horas, como registro na nota diária × a semana com capacidade, no chat |
| coach × plan-week | Objetivos (Plans) × entregas (tasks). O plan-week considera os itens dos Plans como compromisso |
| coach × planner | Lê e cobra × cria e refaz. O coach entrega o caso ao planner quando o prazo não fecha |

## 8. Destino dos comandos atuais

| Atual | Destino |
| --- | --- |
| `/week` | Vira `/week-review` (prompt próprio, semana do calendário) |
| `/planner` (slash) | Sai da nota. O papel se divide entre plan-week (semana) e planner (objetivo), os dois no chat |
| `/define`, `/docs`, `/expand` | Continuam com prompt e contexto próprios (seção 4) |
| `/ask`, `/search`, `/summarize`, `/opinion`, `/table`, `/mindmap`, `/action`, `/profile`, `/explain`, `/guide` | **Fora deste estudo.** Continuam como estão, mas passam a usar o núcleo comum no lugar do prompt único. A decisão sobre eles fica para depois (o uso real mostra `/action` e `/table` ativos como transformadores de texto). |

## 9. Fases sugeridas

1. **Infra de agente nos slash:**
   - `src/lib/agents/` com núcleo, prompt, política de contexto e rótulo;
   - `/define`, `/expand` e `/docs` (com `ragRetrieve`);
   - `/critique`;
   - `/week` → `/week-review`;
   - `/today` (com `plannedDay`);
   - saída do `/planner` slash;
   - nome do agente no bloco.
2. **Agentes de chat, primeira leva:**
   - seletor por conversa e atalho `/agente`;
   - montador de `ephemeralContext`;
   - capacidade de trabalho em Settings;
   - **plan-week** (todos os dados já existem).
3. **Planos:**
   - Capacidade e Livro no Plan;
   - parser do contrato (`plan.ts`);
   - **planner** e **coach**.
4. **tutor:** nota de perfil, índice de fichamentos e glossário.
5. **Fase 2 de qualidade** (seção 10), começando pelos agentes já entregues.

## 10. Pendências para a fase 2 (qualidade das respostas)

- A redação final de cada prompt, com limites de tamanho testados.
- Um **harness de prompts**: N variantes × M modelos sobre cenários congelados, como a agenda desta semana, uma semana vazia, uma semana sobrecarregada, uma nota curta e uma nota de capítulo, comparados lado a lado e às cegas pelo Coordenador. O `rag_eval.rs` serve de modelo de método.
- O modelo por agente, e se thinking vale para algum (hoje os slash rodam sem).
- Se os agentes de chat seguem a política de perguntas (seção 3.4), com os modelos realmente usados.

## 11. Achados laterais (fora do escopo)

- **17 dias do Calendar com nota diária duplicada.** Em 16 deles, uma das duas está vazia. Só em 03/10 as duas têm conteúdo, quase igual.
  - **Causa provável:** a janela keep (Ctrl+K) cria a nota do dia direto no banco (`KeepPanel.tsx:165-185`), inclusive só por navegar até um dia. A janela principal procura a nota do dia no estado em memória (`ensureCalendarNote`, `App.tsx:2636-2655`), que só é relido quando a janela ganha foco com uma nota diária aberta (`App.tsx:1802-1815`). Fora disso, clicar no dia no Calendar cria uma segunda nota.
  - **Impacto:** baixo. A lista vem por `updated_at DESC`, então a nota com conteúdo é a que abre. A agenda ignora as vazias.
- **`deleteNote` não apaga as `ai_responses`:** 49 de 93 respostas estão órfãs (`src/storage/tauri.ts:893-897`). Afeta o glossário. Decidir se as órfãs contam (o termo foi aprendido mesmo com a nota apagada) e apagar o resto.
- **Nomes antigos em PT** (`/definir`, `/resumir`, `/documentos`...) em `ai_responses` precisam ser mapeados se a tabela virar memória.

## 12. Decisões

> **Aprovadas pelo Coordenador em 2026-11-03:** todas as recomendações abaixo valem como decisão. No D13, ficou o coach só sobre Plans.

| # | Decisão | Decidido |
| --- | --- | --- |
| D1 | Critério de superfície: slash complementa ou julga a nota; chat dá insumo apropriado | Já decidido |
| D2 | Agente = prompt + política de contexto + formato + rótulo, em `src/lib/agents/` | Sim |
| D3 | `/define` sem RAG e sem web, com a definição anterior do mesmo termo | Sim |
| D4 | `/docs` com `ragRetrieve` (híbrida + rerank) e citação por tipo (doc / nota) | Sim |
| D5 | `/expand` com web search quando houver instrução | Sim |
| D6 | `/week-review` na semana do calendário (seg–dom) em vez de 7 + 7 dias | Semana do calendário |
| D7 | "Parado" no `/today` = status personalizados por nome (hoje "Waiting") | Sim, sem status novo por enquanto |
| D8 | Juntar studying-plan e planner | Sim |
| D9 | Agente no chat: seletor por conversa, com `/agente` como atalho; prompt da pasta como `append` | Sim |
| D10 | Contrato do plano: item com data dd/mm; Plan ganha Capacidade e Livro; parser no app | Sim |
| D11 | Capacidade de trabalho em Settings › Agenda | Sim |
| D12 | Objetivo do tutor numa nota de perfil do estudo (não na memória da pasta) | Sim |
| D13 | Coach só sobre Plans (objetivos), com as entregas de tasks no plan-week | Sim. Alternativa: coach também cobra TODOS com prazo |
| D14 | Botão "Salvar como nota Plan" na resposta do planner | Sim, na fase 3 |
| D15 | Nome do agente no bloco de IA | Sim |
| D16 | Persistir o sumário dos livros do Reader | Depois. Planner e coach funcionam sem ele (sumário só com o livro aberto) |
| D17 | Slash fora da lista continuam como estão, com o núcleo comum | Sim |

## 13. Premissas e limites

- Os números de uso vêm de uma cópia somente leitura do banco de PRD em 2026-11-03. Conteúdo pessoal só aparece como título ou contagem.
- Os formatos de saída aqui são de estrutura e tamanho, não o texto dos prompts.
- O estudo não mede qualidade de resposta. Isso é a fase 2.
- As referências `arquivo:linha` são do explorer report e valem para o estado da branch `feat/mincer` em 2026-11-03.
