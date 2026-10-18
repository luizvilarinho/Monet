# Decidir com agentes: explicar, isolar a tangente e registrar

*Pesquisa de mercado para um problema específico. Um desenvolvedor programa com agentes de IA (Claude Code e um pipeline próprio orquestrador → explorer → planner → code → review, que grava relatórios `.md` e pede aprovação humana). Ele precisa entender planos e opções para aprovar, não quer poluir o contexto do agente com dúvidas, e hoje nada do que aprende vira registro. Estado em 2026-10-17. É insumo da série `DOCS/features/mercado_2026-10/`.*

*Marcadores: **[V]** página primária lida em 2026-10-17; **[S]** fonte secundária ou resumo de busca; **[I]** inferência minha; **[não verificado]** não confirmado. Datas em AAAA-MM-DD. Nomes de produtos e recursos ficam no original. Estudos irmãos: `market_03_ia_em_notas.md` (quem escreve o registro) e `../central_informacao_study.md` (propostas I9, I10 e I14).*

---

## (a) Resumo executivo

**O problema.** O agente entrega planos e opções cheios de termos e trade-offs e pede aprovação. O gargalo é o humano entender o bastante para decidir. Tirar a dúvida no próprio agente polui o contexto da tarefa. Tirar no chat do Monet funciona, mas a resposta morre no chat. O `central_informacao_study.md` mediu o vazamento: 659 mensagens de chat e só **6** usos do "Anotar". E "decisões de arquitetura" já aparecem entre os usos de trabalho do chat.

**O que o mercado mostra.**

1. **Isolar a tangente está resolvido.** O `/btw` do Claude Code vê toda a conversa, não entra no histórico e não tem ferramentas. Também some quando você sai [V]. O ChatGPT ramifica conversas desde 2025-09-04 [S], e o "Ask mode" só leitura existe no Cursor, no Copilot e no Windsurf/Devin Desktop [V]. **Mas quase ninguém guarda o que se aprendeu:** a tangente é descartada ou vira outra conversa. As exceções são Heptabase e Tana, que promovem trechos a cards ou nós tipados [V].
2. **Já existe um formato padrão para transformar ambiguidade em pergunta.** É o `/speckit.clarify` do GitHub Spec Kit. Ele faz uma pergunta por vez, no máximo 5, cada uma com "Why it matters", recomendação com motivo e tabela de 2–5 opções. Você responde com uma letra, e a resposta vira a linha `Q → A` numa sessão datada [V]. O `AskUserQuestion` do Claude Code faz o mesmo de forma mais solta [V]. **Mas tudo isso acontece dentro do agente e no vocabulário dele.**
3. **O registro de decisão tem campos maduros e agora é gerado por agentes com aprovação humana.** Os formatos são Nygard (2011), MADR 4.0 (2024) e Y-statement. O `adr-author` da Microsoft usa Y-statement para decisões reversíveis e MADR para as significativas, exige confirmação do usuário a cada fase e **rejeita ADR sem desvantagem documentada** [V]. **Mas esses registros vivem no repositório, sem glossário e sem o hábito de revisitar.**
4. **Glossário pessoal com estado de domínio existe em leitura e idiomas** (Kindle Vocabulary Builder, Readwise Ghostreader, LingQ), **não em engenharia** [V/S].
5. **A evidência de 2025–2026 apoia a tese "a IA explica e provoca, o usuário decide".**
   - No RCT da Anthropic (2026-01-29), quem fez perguntas conceituais ou gerou código e depois perguntou para checar o entendimento preservou o aprendizado. Quem delegou perdeu [V].
   - O ExtendAI da Microsoft Research pede o raciocínio do usuário antes da crítica da IA e produziu reflexão mais profunda que a recomendação direta [V].
   - Addy Osmani chama o custo de aprovar o que não se entende de "comprehension debt" [V].

**Leitura.** A lacuna é a combinação de quatro coisas: um canal lateral que vê o contexto, explica no nível do usuário, registra a decisão com a assinatura dele e lembra de revisitar. **O Monet é o candidato natural: é o `/btw` que lembra.** E já tem a maior parte da tubulação [I]:

- O chat da coluna direita das Anotações monta o contexto efêmero no envio, com a nota aberta e a seleção do editor (`src/components/NotesChat/NotesChatPanel.tsx`). É o mesmo padrão do Reader, validado em uso real ("é como ter um professor te acompanhando na leitura").
- Pastas de chat com system prompt, memória e documentos da KB. Specs e reuniões já entram pela pasta monitorada.
- Promoção de resposta: "Anotar", e "Insert selection" para um trecho da resposta.
- O Assistant global (Ctrl+M, `src-tauri/src/lib.rs:1671`), com pasta própria que já aceita system prompt, documentos e memória (`src/components/AssistantPanel/AssistantPanel.tsx`).
- O Calendar como caderno especial (precedente para Glossário e Decisões), além de lembretes e da Weekly Review (precedente para revisitar).

**Os 12 padrões mais úteis, por impacto no problema:**

1. **Cartão de decisão** (Spec Kit `/clarify`, `AskUserQuestion`). O cartão segue a ordem pergunta → por que importa → opções A–C em tabela → recomendação com motivo → sua resposta (letra + uma frase) → linha `Q → A` datada.
   **Adaptar:** extrair as decisões pendentes do plano colado e mostrar um cartão por vez. **M.**
2. **Você raciocina primeiro, a IA critica depois.** Exemplos: ExtendAI × RecommendAI (Microsoft Research, CHI 2025), "AI should challenge, not obey" e as dicas sem resposta do MarginNote.
   **Adaptar:** "esconder a recomendação até eu escolher", ligado por padrão nas decisões irreversíveis. **P.**
3. **O relatório do agente lido como um livro.** Exemplos: o padrão validado do Reader, o Markdown Review do Kiro e o Plannotator.
   **Adaptar:** abrir o `.md` do pipeline como nota (ou pela pasta monitorada) e perguntar no chat da coluna direita, com a seleção como contexto. **P–M.**
4. **Explicação ancorada na frase e no projeto.** O Ghostreader define o termo "as used in the following sentence" e o Kindle mostra a frase original.
   **Adaptar:** responder "o que X quer dizer *aqui*" com a frase + specs e reuniões da pasta. **P.**
5. **Promoção tipada, da resposta ou do trecho.** Exemplos: o "New card" do Heptabase; o Insert e as supertags em partes da resposta, no Tana.
   **Adaptar:** "Salvar como termo / decisão / nota". **P–M.**
6. **Glossário com estados de domínio.** Exemplos: o "Mastered" do Kindle; os status 1–4 + Known do LingQ.
   **Adaptar:** os termos que você pediu viram entradas, e o explicador lê o status para dosar a profundidade. **M.**
7. **Registro proporcional à reversibilidade.** Exemplos: os Tipos 1 e 2 de Bezos ("one-way/two-way doors"); o `adr-author`.
   **Adaptar:** porta de mão dupla → Y-statement de uma frase; mão única → ADR curto + pre-mortem. **P.**
8. **Campos mínimos, com desvantagem obrigatória** (Nygard, MADR, Farnam Street, `adr-author`).
   **Adaptar:** pergunta, opções, escolha + porquê, "aceito que…", confiança, "revisar em", status. **P–M.**
9. **A IA rascunha, você assina.** Exemplos: o preto/cinza do Granola, o Authorship do iA Writer, os "drafts" do MarginNote e as skills de ADR que só gravam com aprovação.
   **Adaptar:** a IA pode pré-preencher, mas o rascunho só vira registro quando você confirma ou edita. **M.**
10. **Provocações sob demanda.** Exemplos: a Advanced Elicitation do BMAD (pre-mortem, red team, primeiros princípios, inversão), o pre-mortem de Klein e o revisor adversarial do Claude Code.
    **Adaptar:** chips no cartão, com no máximo 3 achados que afetam a correção. **P.**
11. **Revisitar com data marcada.** Fontes: "review each ADR one month later"; o diário de decisão contra o viés retrospectivo; separar a qualidade da decisão do resultado.
    **Adaptar:** "revisar em" → lembrete + bloco na Weekly Review. **P–M.**
12. **Entrada sem atrito e volta ao agente.**
    - Entrada: Click to Do, PowerToys Advanced Paste, `@selected-text` do Raycast.
    - Volta: `decisionLog.md` do Memory Bank, export de ADR, MCP só leitura.
    - **Adaptar:** atalho global que abre o Assistant com o clipboard; botão "Resposta para o agente"; export da decisão como `.md` no repo.
    - **Esforço:** **P** (atalho, export) a **G** (MCP, hook).

**Ordem sugerida [I]:**

1. **Explicador pronto (P, ~2–3 dias):** pasta "Decisões técnicas" (ou a pasta do Assistant) com prompt de explicador e chips, mais o atalho do clipboard.
2. **Cadernos especiais (M, ~1 semana):** Glossário e Decisões, com "Salvar como…".
3. **Cartão de decisão (M):** a partir do relatório aberto, com "Resposta para o agente".
4. **Revisão e export (P–M):** "revisar em" na Weekly Review e export de ADR para o repo.
5. **Só se o uso pegar (G):** destaque de termos nas respostas, MCP só leitura (I14) e hook de plano estilo Plannotator.

**Riscos.**

1. **Atrito.** Provocação constante frustra, e provocação demais é ignorada (Tools for Thought; Sarkar). Tudo é convocado por botão ou chip, nada automático.
2. **Ancoragem.** Mostrar a recomendação antes enviesa a escolha (ExtendAI × RecommendAI).
3. **Escopo.** "Dev que decide com agentes" é uma persona diferente da do PRD (autodidata em aprofundamento). Mas é o uso real medido, e cabe na tese: o glossário é um fichamento de conceitos.
4. **Durabilidade.** Glossário e decisões precisam ser notas no SQLite, nunca chat em localStorage.

**Decisões para o Coordenador.**

- **D1:** Glossário e Decisões como cadernos especiais (M) ou como cadernos comuns com template (P)?
- **D2:** Recomendação escondida por padrão nas decisões de mão única?
- **D3:** Exportar decisões para o repositório do projeto? Em qual pasta e formato (Nygard ou MADR minimal)?
- **D4:** Abrir o Monet ao Claude Code (hook de plano, MCP) só depois do I14?

---

## (b) Os seis temas

### 1. "Explique isto" em qualquer lugar (Windows)

**O que é.** Recursos que transformam "selecionar ou copiar → atalho → resposta" num gesto de sistema. No Windows de 2026 há três camadas:

- o próprio sistema: Click to Do e o app Copilot;
- utilitários: PowerToys e Raycast;
- apps de chat com janela flutuante (ChatGPT, Claude) ou barra lateral no navegador (Edge Copilot, Sider, Monica).

| Produto | Gatilho | O que faz com o texto | Contexto | Onde processa | Estado e fonte |
|---|---|---|---|---|---|
| **Click to Do** (Copilot+ PC) | Win + clique; Win + Q; deslizar da direita; menu do Snipping Tool | Copy, Open with, Search the web e **Ask Copilot**. Ações "inteligentes": Summarize, Create a bulleted list, Rewrite (Casual/Formal/Refine), Draft with Copilot in Word, Reading Coach, Immersive Reader. **Não há "Explain"** | o que está na tela (OCR) | Análise da tela, OCR e ações inteligentes rodam **localmente** (Phi Silica na NPU). A nuvem só entra quando você escolhe Ask Copilot ou a busca | Exige NPU de 40 TOPS, 16 GB de RAM, 8 núcleos lógicos e 256 GB. As ações inteligentes exigem **Windows em inglês**, pelo menos 10 palavras e conta Microsoft/Entra. Ask Copilot não existe no EEE [V]. O preview KB5067036 (2025-10-28) acrescenta uma caixa de prompt com sugestões geradas localmente [S] |
| **PowerToys Advanced Paste** | Win + Shift + V; atalho próprio por ação | "Paste with AI", desligado por padrão. **Custom actions** com nome, descrição, prompt, modelo e atalho próprios. **Coaching mode**: prévia que explica o que mudou e por quê. **Custom format preview**: prévia antes de colar | O clipboard. Com **"Use selected text for all hotkeys"**, tenta copiar a seleção antes de rodar o atalho | OpenAI, Azure OpenAI, Gemini, Mistral, Azure AI Inference. Locais: Foundry Local, Ollama, Phi Silica | doc atualizada em 2026-08-25 [V] |
| **App Copilot (Vision)** | botão de óculos; compartilha 1–2 apps ou a área de trabalho | Conversa sobre o que vê. Com **Highlights**, "show me how" marca onde clicar (só com 1 app). Vê, mas não controla | a tela compartilhada | nuvem | Highlights e 2 apps no Insider em 2025-05-12. Desktop Share a partir da v1.25071.125. Texto em vez de voz na v1.25103.107, em outubro de 2025 [S] |
| **ChatGPT para Windows** | Alt + Space abre a companion window, que guarda a posição; atalho configurável | Chat comum e captura de tela pelo Snipping Tool (janela, tela ou região) | o que você colar ou capturar | nuvem | Captura de tela desde 2024-11. O "Work with apps" (ler IDE e terminal) está documentado só para macOS; não achei confirmação no Windows [S]. O help center bloqueou a leitura direta (403) |
| **Claude desktop** | Mac: toque duplo em Option. Windows: popup de uma linha ao clicar no ícone da barra de tarefas | No Mac, arrastar captura a tela, clicar numa janela anexa o conteúdo dela e há ditado (Caps Lock) | Mac: tela e janela | nuvem | Help center (2026-03-16): "Quick entry is currently only available for macOS users" [V]. O issue #22420 (2026-02-01, Windows 1.1.1520) descreve o popup de uma linha no Windows; lá só o atalho é configurável [V] |
| **Raycast para Windows** | atalho do Raycast; Quick AI | **AI Chat** desde a v0.65 (2026-06-18). **AI Extensions** `@selected-text`, `@file-explorer` e `@terminal`. MCP. **Custom AI commands** que abrem o resultado no Raycast ou **substituem a seleção** | seleção, arquivos, terminal | Nuvem. O AI Chat passou ao plano Pro na 2.0 | v0.65 e 2.0, que saiu do beta (página datada de 2026-08-25) [V]. No Mac há o AI Command "Explain This in Simple Terms" e o placeholder `{selection}` [S] |
| **Edge Copilot, Sider, Monica** | barra lateral; menu de contexto; barra flutuante sobre a seleção | explain, translate, summarize e rewrite do trecho; perguntas sobre a página | página, abas, histórico (configurável) | nuvem | O Copilot Mode foi anunciado em 2025-07-28 (experimental e opt-in). "Ask Copilot" no menu de contexto apareceu no Canary [S]. Sider e Monica, por reviews de 2026 [S] |

Há um precedente pequeno e revelador. Em 2024, o **Bloco de Notas** ganhou "Explain with Copilot" no menu de contexto (v11.2401.25.0, só Dev/Canary). Mas a resposta abria na janela do Copilot, fora do documento [S].

**O padrão de UX.**

1. **Captura por gesto do sistema:** seleção ou clipboard + atalho (Win+Q, Win+Shift+V, Alt+Space). O PowerToys pega a seleção de qualquer app simulando a cópia antes do atalho.
2. **Janela pequena que não tira você do app:** overlay perto do cursor ou companion window, com **chips de ações salvas** e uma caixa de prompt livre.
3. **Prévia antes de aplicar e explicação do que mudou:** o "Custom format preview" e o "Coaching mode" do Advanced Paste.
4. **Escada até o chat completo:** o "Ask Copilot" abre o app com o conteúdo; no Raycast, você escolhe entre abrir o resultado e substituir a seleção.
5. **Local quando dá:** mandar para a nuvem é um ato explícito (Click to Do).

**Lacunas.**

- Nenhum guarda o que foi explicado. A explicação evapora; no máximo fica no histórico do chat.
- "Explain" raramente é ação de primeira classe. O Click to Do nem tem, e as ações inteligentes dele **exigem Windows em inglês**, o que deixa o usuário pt-BR de fora.
- Nenhum conhece o **projeto** do usuário (specs, reuniões, decisões anteriores). Eles explicam o termo em geral, não o que ele quer dizer ali.

**O que adaptar ao Monet** [I]:

- **"Explicar o que copiei" (P).** Um segundo atalho global (por exemplo Ctrl+Shift+M, configurável) abre o **Assistant** com o clipboard anexado como **bloco de contexto**, não como mensagem.
  - Chips: *Explicar termos*, *Comparar opções*, *Dá pra fazer?*, *Riscos*, *Me pergunte antes*.
  - A pasta do Assistant já aceita system prompt, documentos da KB e memória. Basta configurá-la como "explicador de decisões" e ligar os documentos do projeto.
  - Falta o plugin de clipboard do Tauri: o projeto ainda não o usa (nem `package.json` nem `Cargo.toml`).
- **Pegar a seleção sem Ctrl+C (M).** Estilo "Use selected text for all hotkeys": simular a cópia via SendInput antes de ler o clipboard, sem sobrescrever o clipboard do usuário.
- **A escada:** "Abrir no Chat" (pasta do projeto) e "Salvar como termo / decisão" (seções 3 e 5).
- **Não fazer agora (G):** OCR de tela e Vision. O Click to Do e o Copilot cobrem isso, e a privacidade piora.

---

### 2. Conversas paralelas e ramificações para tangentes

**O que é.** Mecanismos para tirar uma dúvida lateral sem estragar a linha principal. Duas perguntas separam as soluções: ela **isola** a linha principal? E **guarda** o que se aprendeu?

| Produto | Mecanismo | Isola? | Guarda o aprendido? | Fonte |
|---|---|---|---|---|
| **Claude Code `/btw`** | Pergunta lateral que vê toda a conversa: mensagens, respostas e resultados de ferramentas. Roda enquanto o agente trabalha, **sem ferramentas**, com uma resposta só. Cada nova pergunta reenvia as 20 trocas laterais mais recentes, e as 5 últimas aparecem esmaecidas | Sim: "The question and answer never enter the conversation history" | **Não.** No terminal, "it's gone when you exit Claude Code". A tecla `c` copia a resposta em Markdown e `f` a transforma num subagente com ferramentas. No VS Code, o painel sobrevive a recarregar a janela | docs [V] |
| **Claude Code `/branch`, `--fork-session`, `/rewind`** | `/branch` copia a conversa até ali e troca para a cópia. "Summarize from here" e "Summarize up to here" condensam parte do histórico | sim (outra sessão) | Só no transcript: JSONL local, com retenção de 30 dias por padrão | docs [V]. O `/fork` como subagente em segundo plano vem desde a v2.1.161 [S] |
| **ChatGPT "Branch in new chat"** | nova conversa a partir de qualquer mensagem, com o histórico até ela | sim | não; não há "merge" de volta | web em 2025-09-04; iOS/Android em 2025-12-15 [S] |
| **Claude.ai** | editar ou refazer uma mensagem cria ramos, navegáveis por setas; só um caminho fica visível | parcial | não; extensões de terceiros desenham a árvore | [S] |
| **LibreChat** | Fork com 3 opções: *Visible messages only*, *Include related branches* e *Include all to/from here* (padrão). Também *Start fork here* e *Remember* | sim | não | docs [V] |
| **TypingMind** | fork a partir de qualquer mensagem; threads dentro da conversa ainda não existem | sim | não | docs [S] |
| **Rabbitholes AI** | Canvas em que cada chat é um nó que ramifica e o contexto é escolhido nó a nó. Roda localmente e exporta para JSON e Markdown | sim | parcial: o canvas é o registro | diretórios de apps [S] |
| **Heptabase** | Chat no whiteboard, com contexto por @ ou "+". Depois de editar e anotar, a mensagem vira **card** ("New card") ou é arrastada ao whiteboard | sim | **Sim, por promoção:** o card leva um link para a conversa | wiki [V] |
| **Tana** | Chats salvos num nó "AI chats" da Library; @ referencia nós. **Insert** põe a resposta no nó de origem, e dá para **aplicar supertags a partes da resposta** | sim | **sim, por promoção tipada** | docs [V] |
| **Ask × Agent** (Cursor, GitHub Copilot, Windsurf/Devin Desktop) | Modo só leitura para perguntas. No Windsurf: "Search tools only", "cannot make any changes". No Copilot: "optimized for answering questions about your codebase, coding, and general technology concepts". O Plan do Cursor faz perguntas de esclarecimento e salva o plano em arquivo | sim | não; fica no histórico do chat | Docs [V]. No fórum do Cursor há queixa de que o Plan às vezes passa sozinho para Agent quando você só queria esclarecer [S] |
| **Claudian** (Obsidian) | Claude Code ou Codex no vault, com **side chat** (`/side` ou `/btw`) e edição inline com diff por palavra | sim | depende do usuário salvar | página do plugin: 2,4 mi de downloads [V] |

**Como evitam poluir a linha principal.** Por três técnicas:

1. um **canal que não escreve no histórico** (`/btw`);
2. uma **cópia** da conversa (branch ou fork);
3. um **modo sem ferramentas de escrita** (Ask).

O guia do Claude Code dá nome ao problema: "kitchen sink session". E recomenda o `/btw` para "questions that don't need to stay in context" [V].

**Como guardam o que foi aprendido.** Quase nunca. Branches e `/btw` são descartáveis por desenho. Só Heptabase e Tana têm **promoção**: o usuário escolhe o trecho e o tipo (card, supertag) e leva para a base.

**O que adaptar ao Monet** [I]:

- **Posicionamento: o Monet é o `/btw` que lembra.** Ele vê o contexto que você trouxe (o plano colado, mais specs e reuniões pela KB), não polui o agente e guarda o que importa. O chat efêmero + "Anotar" já é a arquitetura certa: é o `/btw` com promoção. Falta a promoção ser **tipada e barata**.
- **"Salvar como termo / decisão / nota" (P–M).** Vale para a resposta inteira ou para o trecho selecionado; o "Insert selection" do `NotesChatPanel` já captura trechos. Converge com a proposta I9 do `central_informacao_study.md`.
- **"Resposta para o agente" (P).** Depois que você decide, a IA formata um parágrafo curto (escolha, motivo, restrições) para colar no Claude Code, por exemplo na linha "Other" do `AskUserQuestion`. Você revisa antes de copiar. O ciclo fecha sem encher o contexto do agente com a tangente.
- **Ponte com o `/btw`.** No Claude Code, a tecla `c` copia a resposta lateral em Markdown. O atalho da seção 1 a recebe no Monet, onde ela pode virar termo. Não custa nada além do atalho.
- **"Ramificar daqui" no chat do Monet (M).** Estilo LibreChat. É útil, mas tem **baixa prioridade**: em relação ao agente, o Monet já é o ramo.

---

### 3. Glossário e vocabulário pessoal

**O que é.** Ferramentas de leitura e de idiomas transformam "consultei uma palavra" numa **entrada revisável, com contexto e estado de domínio**. Em engenharia isso não existe como produto, só como glossário de projeto. O próprio guia do Claude Code sugere pedir "a glossary of project-specific terms" [V].

| Produto | Captura | Contexto guardado | Estado de domínio | Revisão | Fonte |
|---|---|---|---|---|---|
| **Kindle Vocabulary Builder** | automática ao consultar o dicionário, até por toque acidental | a frase do livro em que a palavra apareceu | Learning → **Mastered**: a palavra sai da lista ativa, mas não é apagada | flashcards com a frase; "See Definition" | [S]. Limitação: só guarda o contexto daquele livro |
| **Readwise Ghostreader** | convocada: seleção de 1–3 palavras → prompt | **Dictionary definition** define o termo "as used in the following sentence"; **Internal x-ray** usa o documento | pela tag `vocab` | prompt "Vocab Flashcard" (Q&A) + Themed Review | prompts padrão [V]; fluxo de vocabulário [S] |
| **LingQ** | clique na palavra | o texto da lição | azul (nova) → amarelo (LingQ: 1 New, 2 Recognized, 3 Familiar, 4 Learned) → **Known**. Há um contador de "known words" | SRS: quanto menor o status, mais revisão; Known sai da revisão | suporte oficial [S] |
| **RemNote** | formatação na nota vira card; a IA gera cards de PDF e de aula | a nota de origem | agenda da repetição espaçada | SRS | [S] |
| **SuperMemo/Anki** (método) | manual | o que você escrever | intervalos | Regras de Wozniak (1999): **informação mínima**, cloze, evitar listas | [S] |
| **Mapas conceituais** (Novak & Cañas) | manual | Proposições "conceito → palavra de ligação → conceito", guiadas por uma **pergunta foco** | n/a | n/a | IHMC, 2006/2008 [S] |
| **MarginNote 4** | IA convocada sobre o trecho | o livro e o mapa mental | cards de IA são **rascunhos** até você aceitar | No Recall, a IA dá **dicas, não respostas**: "The moment AI tells you the answer, the testing effect disappears." | [V] |
| **Claude Code: estilos Explanatory e Learning** | estilo de saída da sessão | o código | n/a | Blocos `Insight`. No Learning, a IA deixa `TODO(human)` nas decisões de design para você escrever | [V] |

Também seguram a resposta e perguntam primeiro: o Study Mode do ChatGPT (2025-07-29) e os modos de aprendizagem do Claude (abertos a todos em 2025-08-14) [S]. Na Heptabase, um usuário pediu em 2024-11 um tutor capaz de "understand my current level of knowledge". O AI Tutor saiu em 2026-03-31 (v1.88.0), sem documentação pública de como mede o nível [V roadmap; S descrição].

**A ideia aplicada ao problema.** Os termos que você pede para explicar ("o que é idempotente?", "o que é WAL?", "o que é backpressure?") viram **entradas revisáveis**. O explicador passa a falar no seu nível: não reexplica o que você já domina e glosa o que ainda é novo.

Exemplo de entrada (ilustrativo):

```markdown
# Idempotente
Status: 3 · familiar   (1 novo → 2 reconhecido → 3 familiar → 4 domino)
Em uma frase (minhas palavras): rodar duas vezes dá o mesmo resultado que rodar uma.
Onde apareceu:
- "…tornar a reindexação idempotente…" (relatório do planner, 2026-10-11)
- "…migration idempotente…" (reunião, 2026-10-14)
No meu código: CREATE TABLE IF NOT EXISTS em open_doc_db
Relacionados: [[migration]] [[retry]] · Não confundir com: [[determinístico]]
```

**O que adaptar ao Monet** [I]:

- **Caderno especial "Glossário" (M; P se for um caderno comum com template).** Uma nota por termo, com o template acima. O Calendar é o precedente de caderno especial. As notas do caderno já entram no RAG, então o chat passa a "ler" o glossário sem infraestrutura nova.
- **"Salvar como termo" (P–M).** Funciona na resposta ou no trecho e abre um rascunho com termo, frase de origem, fonte e data já preenchidos.
  - **"Em uma frase" fica para você escrever**, ou para editar a sugestão (padrão 9).
  - Se o termo já existe, o botão oferece **"adicionar este contexto"**. Isso corrige a limitação do Kindle, que guarda um contexto só.
- **Explicar no seu nível (P–M).** O system prompt do explicador recebe só uma lista compacta: "domino: …; aprendendo: …". Termos no status 4 são usados sem explicação; termos em 1–2 ganham uma glosa curta e o link.
  - **O status só muda por ação sua, nunca pela IA.** A memória de pasta, que a IA escreve, não serve para isso.
- **Revisão leve (P para a lista; G para SRS).** Na Weekly Review, "3 termos para revisar" em forma de pergunta (cloze ou "explique com suas palavras"), seguindo o princípio da informação mínima. O SRS completo fica para depois; a lacuna já está no inventário.
- **Destaque dos termos do glossário nas respostas (M–G).** Estilo LingQ/X-ray, com hover mostrando a *sua* frase. Reforça muito o aprendizado, mas exige marcação no render do chat.
- **Evitar:**
  - capturar automaticamente todo termo que a IA cita (o Kindle registra até toque acidental, e a lista vira ruído);
  - mapa conceitual dedicado (os links "Relacionados", via notas vinculadas, bastam).

---

### 4. Revisão de saída de agentes e spec-driven development

**O que é.** Métodos e ferramentas que estruturam o trabalho do agente em artefatos revisáveis (spec, plano, tarefas) e criam **portões de aprovação humana**. A pergunta aqui tem duas partes: quais ajudam o **humano** a entender e aprovar, e quais transformam ambiguidade em **pergunta estruturada, com opções e recomendação**.

**GitHub Spec Kit** [V] (141,7 mil estrelas).

- **O fluxo:** `/speckit.constitution` → `specify` → `clarify` (opcional) → `plan` → `checklist` (opcional) → `tasks` → `analyze` (opcional) → `implement` → `converge`. O README atual expõe os mesmos passos como skills `/speckit-*`. Há também uma extensão `assess` que termina em **go / needs-clarification / kill**.
- **`/clarify` é o formato mais útil para o problema.** O que o template ([`clarify.md`](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md)) faz:
  - Varre o spec em 10 categorias e marca cada uma como Clear, Partial ou Missing. As categorias: escopo, dados, UX, requisitos não funcionais, integrações, casos de borda, restrições e trade-offs, **terminologia**, critérios de pronto e placeholders vagos.
  - Faz **no máximo 5 perguntas por sessão, uma de cada vez**, ordenadas por impacto × incerteza, sem revelar a fila.
  - Cada pergunta começa com "**Question:**" e traz uma frase "**Why it matters**".
  - Nas perguntas de múltipla escolha, vem a **recomendação com o motivo** e uma tabela de 2–5 opções. Você responde com a letra, com "yes" ou "recommended", ou com uma resposta curta (até 5 palavras).
  - Grava em `## Clarifications` → `### Session AAAA-MM-DD` → `- Q: <pergunta> → A: <resposta>`. Depois aplica a resposta na seção certa do spec e substitui o texto contraditório, em vez de duplicá-lo.
- **`/analyze` é só leitura.** Checa a consistência entre spec, plan e tasks e manda corrigir no artefato dono do erro.
- **`/checklist`:** são "unit tests for your requirements". Checam se o requisito está completo e claro, não se o código funciona.

**AWS Kiro** [V] (página atualizada em 2026-10-15).

- **Artefatos:** cada spec gera `requirements.md` (ou `bugfix.md`), `design.md` e `tasks.md`, nas variantes Requirements-First e Design-First. O **Quick Spec** gera tudo de uma vez, "without approval gates".
- **Para o humano:**
  - O botão **Review** abre o **Markdown Review**, em que você comenta trechos específicos e envia todos os comentários de uma vez.
  - O **Analyze Requirements** aponta inconsistências, ambiguidades e lacunas antes do design.
- **Memória e automação:**
  - **Steering** dá memória do projeto: `product.md`, `tech.md` e `structure.md`, com os modos always, fileMatch, manual e auto. Também lê AGENTS.md.
  - **Hooks** (PostFileSave, Pre/PostToolUse, Stop) rodam um comando ou injetam um prompt.

**Tessl** [S]. O registry de specs entrou em beta aberto em 2025-09-16 e foi reposicionado como registry de skills em 2026-01-29. O framework "spec-as-source" segue em beta fechado; para reviews de 2026, ainda é "mostly a thesis". Pouco a adaptar.

**BMAD Method** [V]. Agentes com papéis: Mary (analista), John (PM), Sofia (PO), Winston (arquiteto), Amelia (dev) e Sally (UX).

- O que interessa é a **Advanced Elicitation**, uma "segunda passada" sobre o que o modelo acabou de produzir:
  1. Você escolhe um método de raciocínio. A skill sugere 5 entre dezenas: **pre-mortem**, primeiros princípios, inversão, red team × blue team, socrático.
  2. Vê as melhorias propostas.
  3. **Aceita, descarta ou repete.**
- A doc recomenda o pre-mortem como primeira escolha para specs e planos.

**Agent OS** [S]. Três camadas: standards, product e specs. Na v3 (janeiro de 2026), a escrita do spec passou ao plan mode do agente. O `/shape-spec` faz perguntas direcionadas, considerando seus padrões e a missão do produto, e salva o plano na pasta de specs.

**"Memory Bank" do Cline e do Roo** [V]. Arquivos Markdown que o agente lê no início e atualiza.

- **Cline:** `projectbrief → productContext/systemPatterns/techContext → activeContext → progress`. O `activeContext.md` tem as seções "Active decisions and considerations" e "Learnings and project insights".
- **Roo:** o `decisionLog.md` registra "architectural choices and their rationale".
- **ConPort**, o sucessor, guarda decisões em SQLite por workspace. O `log_decision` grava resumo, justificativa, detalhes e tags; há busca full-text, links entre itens e export para Markdown.
- **Para o humano, ajudam pouco:** são memória do agente, escrita pelo agente.

**Claude Code** [V].

- **Plan mode** (Shift+Tab ou `/plan`): lê e explora sem editar.
  - Ao terminar, oferece três saídas: "Yes, and use auto mode", "Yes, manually approve edits" e "**No, keep planning**".
  - **Ctrl+G** abre o plano no seu editor para editar antes de aprovar.
  - Os planos ficam em `~/.claude/plans/`.
- **`AskUserQuestion`:** Claude faz perguntas de múltipla escolha "when it needs a decision or a clarification". Dá para responder pela linha **Other** ou pelo campo de notas.
- **Boas práticas:**
  - **"Let Claude interview you"** com `AskUserQuestion` antes de features grandes, gravar um `SPEC.md` e implementar numa sessão nova.
  - Usar um **revisor adversarial** em subagente, com um alerta: "a reviewer prompted to find gaps will usually report some". Por isso, peça só as lacunas que afetam a correção.

**Walkthroughs de PR.**

- **CodeRabbit** [V]:
  - resumo dos arquivos alterados, por grupo;
  - **diagramas de sequência em Mermaid** quando o PR muda interações;
  - **esforço estimado de 1 (trivial) a 5 (muito complexo)**;
  - issues e PRs relacionados, avaliação da issue vinculada e revisores sugeridos;
  - um poema, opcional.
- **Resumo de PR do GitHub Copilot** [S]: visão geral em prosa + lista das mudanças com os arquivos afetados. Ignora o que já está escrito na descrição, não existe no plano Free, e a doc pede para revisar antes de publicar.
- **Graphite Agent** [S]: revisor e chat unificados em outubro de 2025; o chat na página do PR atende perguntas de esclarecimento.
- **Qodo** [V]: "For each finding, Qodo explains" **o que precisa de atenção, por que importa e como seguir**, com severidade High/Medium/Low.

**Plannotator** [V]. É um hook `PermissionRequest` no `ExitPlanMode` do Claude Code.

- O plano abre numa interface de revisão no navegador, onde você comenta e edita.
- "Send Feedback returns your annotations and direct edits to Claude for another revision."
- No Windows, usa o fluxo bloqueante do hook. A doc foi verificada contra a v0.25.1 em 2026-07-31 e contra a v0.28.0 em 2026-10-04.
- Prova que dá para **interceptar o plano e revisá-lo fora do agente**.

**Por que isso importa agora: a evidência.**

- **Comprehension debt** (Addy Osmani, 2026-03-14) [V]: "the growing gap between how much code exists in your system and how much of it any human being genuinely understands". E também: "Making code cheap to generate doesn't make understanding cheap to skip."
- **RCT da Anthropic** (2026-01-29, n = 52) [V]: com IA, a nota no quiz caiu para 50%, contra 67% de quem programou à mão.
  - **Preservaram o aprendizado (≥ 65%):** perguntas conceituais, pedir código com explicação, e gerar código e depois perguntar para checar o entendimento.
  - **Derrubaram (< 40%):** delegar tudo, dependência progressiva e deixar a IA depurar.
  - **Copiar a saída do agente e perguntar "o que é X?" no Monet é justamente o padrão "geração → compreensão".**

| Ferramenta | Ajuda o humano a entender? | Ambiguidade vira pergunta com opções? | Recomenda? | Registra a resposta? |
|---|---|---|---|---|
| Spec Kit `/clarify` | sim ("Why it matters") | **sim:** 2–5 opções, uma pergunta por vez, no máximo 5 | **sim, com motivo** | **sim:** `Q → A` por sessão datada, dentro do spec |
| Claude Code `AskUserQuestion` | parcial | sim: múltipla escolha + Other | depende do agente | só no transcript |
| Kiro (Review, Analyze Requirements) | sim, com comentário ancorado no trecho | aponta ambiguidades; formato de opções não documentado | não documentado | o spec é o registro |
| BMAD Advanced Elicitation | sim, pelo método escolhido | não; propõe melhorias | sim | você aceita ou descarta no artefato |
| Agent OS `/shape-spec`; Plan do Cursor e do Windsurf | sim | perguntas de esclarecimento | variável | plano em `.md` |
| CodeRabbit, Copilot, Qodo | **sim:** resumo, diagrama, esforço; o quê, por quê e como | não | sugestões de correção | comentários no PR |
| Plannotator | sim, anotando o plano | não | não | o feedback volta ao agente |
| Memory Bank, ConPort | não: é memória do agente | não | não | sim, pelo agente |

**Lacuna.** Tudo acontece **dentro do agente e no vocabulário dele**. Nenhuma ferramenta explica os termos no nível de quem aprova. Só o Spec Kit guarda "por que escolhi" de forma consultável, e só para aquele spec.

**O que adaptar ao Monet** [I]:

- **Ler o relatório do agente como um livro (P–M).**
  - **Como:** abrir o `.md` do pipeline como nota e perguntar no chat da coluna direita. Para chegar ao arquivo, apontar a pasta monitorada para o `DOCS/reports/` do projeto.
  - **Por que funciona:** esse chat **já envia a nota aberta + a seleção como contexto efêmero** (`NotesChatPanel.tsx`), que é o padrão validado do Reader.
  - **Esforço:** **P** com a pasta monitorada, que já existe; **M** para um botão "Abrir relatório como nota".
- **Cartão de decisão (M).** Segue o formato do `/clarify`, com uma inversão: a recomendação da IA vem depois da sua inclinação (padrão 2). O chip *Extrair decisões pendentes* lê o relatório e mostra até 5 cartões, **um de cada vez**. A ordem de cada cartão:
  1. Pergunta.
  2. Por que importa.
  3. Opções A–C: o que é, bom porque, ruim porque, é reversível?
  4. **"Para qual você tende, e por quê?"**
  5. Só então, a recomendação da IA com o motivo.
  6. A sua resposta vira `- Q: … → A: …` datado (rascunho até você salvar).
- **Resumo de revisão com triagem (P–M).** No estilo CodeRabbit/Qodo: *Precisa da sua decisão*, *Vale verificar* e *Informativo*, com esforço de 1 a 5 e, se quiser, um diagrama Mermaid do fluxo. É prompt; o Mermaid depende do render do chat.
- **Provocações sob demanda (P).** No estilo BMAD: chips *Pre-mortem*, *Red team*, *Inversão* e *Por que não fazer?* (o "Drawbacks" do RFC do Rust). No máximo 3 achados, todos que afetem a correção.
- **Hook de plano estilo Plannotator (G).** Claude Code → Monet → feedback de volta. É forte, mas exige deep link ou servidor local, e a sua decisão de abrir o Monet a agentes. Vem depois do I14 do `central_informacao_study.md`.

Exemplo de cartão (ilustrativo):

```text
Decisão 1 de 3 · Onde guardar o estado "visto" das tasks?
Por que importa: define se o estado sobrevive a uma reinstalação e quanto custa migrar depois.

  A) coluna nova em tasks (SQLite)  · durável, consultável   · exige migration     · volta difícil
  B) localStorage                   · zero migração          · some se limpar o WebView · volta fácil
  C) campo no metadata JSON         · sem migration          · consulta mais lenta · volta média

Para qual você tende, e por quê?  (a recomendação aparece depois da sua resposta)
[Explicar termos] [Pre-mortem] [Red team] [Mostrar recomendação]

→ Resposta para o agente (você revisa antes de copiar):
  "Decisão: A. Motivo: precisa sobreviver a reinstalação. Restrição: migration idempotente
   (CREATE TABLE IF NOT EXISTS/ALTER), sem BEGIN/COMMIT manual no plugin SQL."
```

---

### 5. Registro de decisões

**O que é.** Formatos e hábitos para guardar **o que foi decidido, por quê e a que custo**, e para voltar a isso depois.

**ADR de Michael Nygard** [V] (2011-11-15).

- **Seções:** Título, Contexto, Decisão, Status e Consequências.
- **Tamanho:** "one or two pages long".
- **Numeração:** sequencial, e um número nunca é reutilizado.
- **Reversão:** a decisão revertida fica no histórico, marcada como **superseded**.
- **Por quê:** sem a justificativa, quem chega depois só pode aceitar ou reverter às cegas. "It's better to avoid either blind acceptance or blind reversal."

**MADR** [V] (4.0.0, de 2024-09-17).

- **Seções:**
  - Context and Problem Statement;
  - Decision Drivers;
  - **Considered Options**;
  - Decision Outcome, com **Consequences** no formato "Good, because… / Bad, because…";
  - **Confirmation**: como verificar que a decisão foi seguida;
  - Pros and Cons of the Options;
  - More Information, que inclui as **condições para revisitar**.
- **Metadados opcionais:** status, date, decision-makers, consulted e informed.
- **Variantes:** "bare" e "minimal".

**Y-statement** [S]. Criado por Olaf Zimmermann, publicado por Zdun et al. na IEEE Software em 2013 e retomado num post de 2020-05-07.

- **Formato:** uma frase só. *"In the context of <caso>, facing <preocupação>, we decided for <opção> and neglected <outras>, to achieve <qualidade>, accepting <desvantagem>"*, com um "because <justificativa>" opcional.
- **Em português:** *"No contexto de …, diante de …, decidi por … e não por …, para obter …, aceitando que …"*.

**Ferramentas** [S].

- O `adr-tools` é uma CLI. O **log4brains** registra pelo IDE e publica um site estático com timeline e busca.
- Um plugin de ADR para Claude Code aponta uma falha comum aos dois: ao substituir um ADR, só o par antigo/novo é atualizado, e outras referências ficam desatualizadas.

**ADRs gerados ou mantidos por agentes.**

- **`hve-core/adr-author`, da Microsoft** [V]:
  - Fases Frame → Decide → Govern.
  - **Y-statement para decisões de baixo risco ou reversíveis** e **MADR 4.0 para as arquiteturalmente significativas**.
  - "The user must confirm the Frame summary before advancing", e o mesmo vale para o Decide.
  - Só a fase Govern grava em disco, em `docs/planning/adrs/NNNN-slug.md`.
  - "**an ADR with no documented downside is rejected**".
- **`architecture-decision-records`** (affaan-m/everything-claude-code) [V]:
  - Detecta momentos de decisão como "let's go with X instead of Y" e pergunta se você quer registrar.
  - Segundo a página da skill, "It won't auto-create files without your approval".
  - Formato Nygard, em `docs/adr/`.
- **`adr-drafting`** [S]: lê as convenções de ADR do repositório e só grava depois da sua aprovação.
- **ConPort e Memory Bank** (seção 4): decisões como memória do agente.

**Diários de decisão.**

- **Farnam Street** [V] (2014-02-20, revisto em 2025-02-13). Campos:
  - situação e enquadramento do problema;
  - variáveis e complicações;
  - **alternativas consideradas, e por que não foram escolhidas**;
  - faixa de resultados possíveis;
  - **o que você espera que aconteça, com probabilidades**;
  - como você está física e mentalmente, e a hora do dia.

  "The degree of confidence matters, a lot." O diário guarda "what you knew and what you thought at the time", contra o viés retrospectivo.
- **Annie Duke** [S]: "resulting" é julgar a decisão pelo resultado. Como a sorte pesa, avalie a qualidade da decisão separada do resultado e use o resultado como feedback. ("Kill criteria", do livro *Quit*, de 2022 [não verificado].)

**Portas de mão única e de mão dupla** [S] (carta de Bezos aos acionistas, 2015).

- **Tipo 1:** "consequential and irreversible or nearly irreversible". Pede deliberação.
- **Tipo 2:** reversível; "can and should be made quickly by high judgment individuals or small groups".
- **O risco:** usar o processo pesado do Tipo 1 em decisões do Tipo 2.

**Pre-mortem** [S] (Gary Klein, HBR, setembro de 2007). Assuma que o projeto já fracassou e explique por quê. Segundo Mitchell, Russo e Pennington (1989), a "prospective hindsight" aumenta em 30% a capacidade de identificar as razões de resultados futuros. Várias fontes atribuem esse número ao próprio Klein, o que é erro.

**RFCs.**

- O template do Rust [V] obriga quatro seções: **Drawbacks** ("Why should we *not* do this?"), **Rationale and alternatives**, **Prior art** e **Unresolved questions**.
- A Oxide [S] (RFD 1, 2020-07-24) usa os estados prediscussion → ideation → discussion → published → committed ou abandoned.

**O hábito de revisitar.**

- **Joel Parker Henderson** [V]:
  - É "typical for teams to review each ADR one month later" e comparar o registro com o mundo real.
  - Revisar pelo menos uma vez por ano, e quando algo relevante mudar (fornecedor, preço, licença).
  - O ADR é "imutável em princípio". Na prática, notas datadas o transformam num "living document".
- **Spotify** [V] (2020-04-14): escreva ADR "Almost always!". Isso inclui **registrar retroativamente** padrões nunca documentados e **decisões pequenas cujo impacto se acumula**.

**Campos mínimos que funcionam (síntese).**

| Campo | Por que | De onde vem |
|---|---|---|
| Título com verbo + objeto | para achar depois | Nygard |
| Status (proposta, aceita, substituída por #N, revertida) e data | nunca apagar; saber o que vale hoje | Nygard, MADR, Oxide |
| Pergunta, em uma frase | separa o problema da solução | "Problem Statement" do MADR; "Question" do Spec Kit |
| Opções consideradas (2–4), com "bom porque / ruim porque" | evita aceitar ou reverter às cegas | MADR, Farnam Street |
| Decisão e porquê **nas suas palavras** | preserva a elaboração | tese do Monet; ExtendAI |
| **"Aceito que…"** (desvantagem obrigatória) | honestidade sobre o custo | Y-statement, `adr-author` |
| Porta: mão dupla ou mão única | define o peso do registro | Bezos, `adr-author` |
| Confiança + o que espero que aconteça | permite julgar depois sem cair no "resulting" | Farnam Street, Duke |
| "Revisar em" (data) ou gatilho | cria o hábito de revisitar | Henderson; "More Information" do MADR |
| Origem (link para o relatório do agente) e termos | rastreabilidade e glossário | Kiro, Spec Kit; seção 3 |

Template proposto, com um exemplo ilustrativo. A base é a decisão real "chat = rascunho", de junho de 2026; as datas e os números são ilustrativos.

```markdown
# D-0007 · Manter o chat em localStorage
Status: aceita · 2026-06-24 · Pasta: Monet · Porta: mão dupla
Origem: [relatório do planner] · Termos: [[localStorage]] [[cota]]

Pergunta: onde persistir as conversas do chat?
Forças: perda silenciosa por cota; chat é rascunho pela tese; custo de migrar.

| Opção                         | Bom, porque                 | Ruim, porque                    |
|-------------------------------|-----------------------------|---------------------------------|
| A. localStorage + aviso       | zero migração; mantém a tese| limite de 5–10 MiB [não verif.] |
| B. SQLite                     | durável e consultável       | migração; o chat vira registro  |
| C. IndexedDB                  | cota maior                  | outra API, mesmo WebView        |

Decisão (minhas palavras): A, com aviso de cota e export .md por pasta.
Aceito que: conversas antigas podem exigir export manual.        ← obrigatório
Confiança: alta · Espero que: nenhum chat se perca sem aviso.
Revisar em: 2026-07-24, ou se o chat passar de 4 MB.

Y-statement (a IA monta a partir dos campos acima): No contexto do chat do Monet,
diante do limite de cota, decidi por localStorage com aviso e não por SQLite ou
IndexedDB, para manter o chat como rascunho, aceitando export manual.

Registro da sessão: - Q: Onde persistir o chat? → A: A (localStorage + aviso) · 2026-06-24
```

**O que adaptar ao Monet** [I]:

- **Caderno especial "Decisões" (M).** Usa o template acima e a numeração `D-0001…`. A decisão é nota (durável, no RAG), nunca chat.
  - **Atalho para o MVP (P):** um projeto "Decisões" no Tasks, com status customizados (proposta, aceita, substituída) e o template na nota-corpo da task. Reaproveita status, "do date" e lembretes, mas mistura tarefa com decisão.
- **Peso proporcional à porta (P).**
  - **Mão dupla:** só o Y-statement, que a IA monta a partir dos campos que você preencheu, e "revisar em" opcional.
  - **Mão única:** template completo, chip de pre-mortem e recomendação escondida até você escolher.
- **Revisitar (P–M).** O "revisar em" cria um lembrete e põe a decisão num bloco da Weekly Review, com duas perguntas: *O que aconteceu?* e *Com o que eu sabia, decidiria igual?* (separa a qualidade da decisão do resultado). Para mão única, o padrão é 1 mês.
- **Substituir sem apagar (P).** "Substituir por nova decisão" cria a `D-00NN` ligada à anterior e muda o status das duas.
- **Exportar como ADR (P–M).** Por ação sua, gravar no repositório (`docs/decisions/NNNN-slug.md`, formato Nygard ou MADR minimal). O agente lê na próxima tarefa. O guia do Claude Code põe "architectural decisions specific to your project" entre o que deve ir no CLAUDE.md.

---

### 6. Notas e PKM como "thinking partner" que não decide

**Tools for Thought, da Microsoft Research** [V]. A pergunta do programa: "What would you rather have: a tool that thinks for you, or a tool that makes you think?". Os princípios:

- a IA deve **desafiar em vez de obedecer**: expor raciocínio frágil, fazer perguntas, oferecer alternativas;
- **provocações** curtas, presas às sugestões ("microboundaries");
- **atrito calibrado**: "Too much friction will frustrate users, while too little will be ignored";
- apoio metacognitivo e curadoria humana.

Os resultados:

- **Survey com 319 profissionais** (CHI 2025, post de 2025-04-18): "higher confidence in AI was associated with less critical thinking". Quem tinha mais confiança em si mesmo pensou de forma mais crítica.
- **ExtendAI × RecommendAI:** o ExtendAI pede que você **escreva seu raciocínio primeiro** e só então dá feedback. Levou a reflexão mais profunda e a carteiras mais diversificadas (N = 21). O RecommendAI pareceu "black box".
- "Provocations drive diverse AI shortlisting decisions" (n = 24).
- **Sarkar, "AI Should Challenge, Not Obey"** (CACM, outubro de 2024): "A provocateur does not complete your report. It does not draft your email. It does not write your code." E: "Let's transform our robot secretaries into Socratic gadflies."

**MarginNote 4** [V].

- O lema: "Led by *You*, Elevated by *AI*".
- Todo card gerado é rascunho e exige confirmação; cada saída pode ser aceita ou rejeitada.
- No Recall, dicas em vez de respostas.
- "AI isn't in everything we do": o Title Link usa casamento local, não IA.

Ver também o arquétipo C em `market_03`.

**Heptabase** [V]. Chat com whiteboards, cards e PDFs como contexto; você edita e anota a resposta e a salva como card ou a arrasta ao whiteboard. Mas o rumo é o oposto da tese: o AI Tutor (2026-03-31, v1.88.0) e o **Agent Mode**, que "can edit existing cards, create new cards" (newsletter de 2026-05-29). É o concorrente mais direto da persona, na direção contrária (ver `central_informacao_study.md`).

**Obsidian + Claude Code** [V/S].

- O plugin **Claudian** (2,4 mi de downloads, v2.3.23) faz do vault o diretório de trabalho do agente. Tem edição inline com diff por palavra e side chat (`/side` ou `/btw`).
- Vault Sidekick, Claude Panel, Blackglass e AI Sidebar (este com modo só leitura) somam poucos downloads [S].
- O usuário avançado quer o próprio agente sobre as próprias notas. O que falta é a camada de curadoria.

**Autoria visível** [S].

- **Granola:** o que você digitou fica em preto e o que a IA acrescentou, em cinza. Editar um trecho cinza o torna preto, e uma lupa mostra a fonte.
- **iA Writer:** o recurso Authorship marca o texto de IA (esmaecido ou em gradiente, conforme a versão) e oferece "Paste As → ChatGPT".

**Queixas de usuários sobre IA que decide ou escreve por eles.**

- **Fórum do Obsidian** (2024-11 a 2025-01) [V]:
  - "I will keep composing my own work, and not rely on a hallucinating buddy sitting next to me and peeking over my shoulder."
  - "What I want is a note-taking app that enables ME to structure, find and chat with my notes myself the way I need and want."
- **"Your Brain on ChatGPT"** (MIT Media Lab, 2025-06-10, preprint, n = 54) [V]: o grupo com LLM teve **a menor sensação de autoria** e "struggled to accurately quote their own work". Ressalva: é preprint, com amostra pequena e crítica formal (ver `market_03`).
- **Agentes de código:**
  - o Plan do Cursor às vezes passa sozinho para Agent quando o usuário só queria esclarecer [S];
  - o "comprehension debt" descreve aprovar o que não se entende [V].
- **Notion:** a queixa nº 1 é o agente que edita sozinho (ver `central_informacao_study.md` e `market_03`).

**O que adaptar ao Monet** [I]:

- **"Me pergunte antes" (P).** É o comportamento padrão do explicador nas decisões de mão única. Ele pede sua inclinação e o porquê, critica, e só então mostra a recomendação.
- **Provocação curta presa à resposta (P).** Uma linha "Para pensar: …" ao fim da explicação, desligável por pasta. É o atrito calibrado.
- **Autoria visível (M).** O que a IA pré-preencher num termo ou numa decisão aparece como rascunho, em cinza ou marcado. Só vira registro quando você confirma ou edita. O EmbedBlock de resposta de IA já é um precedente.
- **Não seguir** Heptabase e Notion no agente que edita cards: é exatamente o que a tese proíbe.

---

## (c) Padrão × exemplos × o que adaptar × esforço

Legenda de esforço [I]: **P** = até ~2 dias. **M** = ~3–7 dias. **G** = mais de 1 semana, ou depende de integração externa (hooks, MCP, API do Windows).

| # | Padrão | Exemplos | O que adaptar ao Monet | Esforço |
|---|---|---|---|---|
| 1 | Atalho global → explicação do que foi copiado | Click to Do; Advanced Paste (Win+Shift+V); `@selected-text` do Raycast; Alt+Space do ChatGPT; quick entry do Claude (Mac) | Ctrl+Shift+M abre o Assistant com o clipboard como bloco de contexto, mais os chips | **P** (clipboard) / **M** (seleção via cópia simulada) |
| 2 | Chips de ações salvas | custom actions do Advanced Paste; AI Commands do Raycast; prompts do Ghostreader; métodos do BMAD | Chips editáveis por pasta: Explicar termos, Comparar opções, Dá pra fazer?, Riscos, Me pergunte antes | **P** |
| 3 | Canal lateral que não polui o agente | `/btw`; Ask mode; branch do ChatGPT; fork do LibreChat | Posicionar o Monet como esse canal; "Resposta para o agente" (parágrafo revisado para colar no Claude Code) | **P** |
| 4 | Promoção tipada, da resposta ou do trecho | "New card" do Heptabase; Insert e supertags no Tana; "Anotar" e "Insert selection" do Monet | "Salvar como termo / decisão / nota", com destino padrão e link para a conversa (I9) | **P–M** |
| 5 | Relatório do agente lido como livro | Reader validado; Markdown Review do Kiro; Plannotator | Pasta monitorada em `DOCS/reports/` + "Abrir relatório como nota"; perguntar no chat da coluna direita, com a seleção | **P–M** |
| 6 | Cartão de decisão estruturado | `/clarify` do Spec Kit; `AskUserQuestion`; `/shape-spec` do Agent OS; Plan do Cursor e do Windsurf | Chip "Extrair decisões pendentes": até 5 cartões, um por vez; a resposta vira `Q → A` datado (rascunho) | **M** |
| 7 | Você raciocina primeiro | ExtendAI × RecommendAI; Sarkar; dicas do MarginNote; Study e Learning modes | "Esconder a recomendação até eu escolher", ligado por padrão na porta de mão única | **P** |
| 8 | Provocações sob demanda | Advanced Elicitation do BMAD; pre-mortem de Klein; revisor adversarial do Claude Code; "Drawbacks" do RFC | Chips Pre-mortem, Red team, Inversão, Por que não fazer?; no máximo 3 achados que afetam a correção | **P** |
| 9 | Triagem para o humano | CodeRabbit (esforço 1–5, diagramas); Qodo (o quê, por quê, como); resumo de PR do Copilot | "Resumo de revisão": Precisa de você / Vale verificar / Informativo, mais esforço e Mermaid opcional | **P–M** |
| 10 | Explicação ancorada na frase e no projeto | Dictionary do Ghostreader ("as used in the following sentence"); Kindle; X-ray | "Explicar termo" usa a frase + o RAG da pasta (specs, reuniões) para dizer o que X quer dizer ali | **P** |
| 11 | Glossário com estados de domínio | Vocabulary Builder do Kindle; status 1–4 + Known do LingQ; vocab do Readwise | Caderno especial Glossário; status novo → domino só por ação sua; o explicador ajusta o nível | **M** |
| 12 | Destaque dos termos conhecidos | azul/amarelo do LingQ; X-ray | Sublinhar termos do glossário nas respostas, com hover mostrando a sua definição | **M–G** |
| 13 | Revisão leve do vocabulário | Mastered do Kindle; SRS do LingQ; regras de Wozniak | "3 termos para revisar" na Weekly Review; SRS completo depois | **P** / **G** |
| 14 | Registro proporcional à reversibilidade | Tipos 1 e 2 de Bezos; `adr-author` (Y-statement × MADR) | Campo "porta"; mão dupla → Y-statement; mão única → ADR curto + pre-mortem | **P** |
| 15 | Campos mínimos com desvantagem obrigatória | Nygard; MADR; Farnam Street; `adr-author` | Template de decisão: pergunta, opções, escolha e porquê, "aceito que…", confiança, "revisar em", status | **P–M** |
| 16 | A IA rascunha, você assina | Granola; iA Writer; MarginNote; skills ECC e `adr-drafting` | A IA pré-preenche termo ou decisão como rascunho marcado; vira registro só ao confirmar ou editar | **M** |
| 17 | Revisitar com data marcada | Henderson (1 mês, anual); Farnam Street; Duke | "Revisar em" → lembrete + bloco na Weekly Review: resultado × qualidade da decisão | **P–M** |
| 18 | Status e substituição, nunca apagar | superseded de Nygard; status do MADR; estados das RFDs da Oxide | Proposta / aceita / substituída por #N, com link entre decisões | **P** |
| 19 | Fechar o ciclo com o agente | `decisionLog.md` do Memory Bank; ConPort; steering do Kiro; CLAUDE.md; MCP | Exportar a decisão como `docs/decisions/NNNN-slug.md`, por ação sua; MCP só leitura (I14) | **P–M** (export) / **G** (MCP) |
| 20 | Interceptar o plano no agente | Plannotator (hook no `ExitPlanMode`) | Hook que manda o plano ao Monet (deep link ou pasta) e devolve o feedback | **G** |
| 21 | Ramificar a conversa | branch do ChatGPT; fork do LibreChat; `/branch` do Claude Code | "Ramificar daqui" no chat do Monet | **M** (baixa prioridade) |
| 22 | Autoria e controle explícitos | MarginNote ("AI isn't in everything we do"); queixas no fórum do Obsidian | Nada automático: toda IA por chip ou botão; provocação desligável por pasta | **P** (regra de design) |

---

## (d) Fontes

As datas entre parênteses são da fonte. Sem data na página, vale "lido em 2026-10-17".

**1. "Explique isto" no Windows**
- Microsoft Support, *Click to Do: do more with what's on your screen* (sem data; lido em 2026-10-17) [V]: https://support.microsoft.com/en-US/Windows/Ai/Ai-Features/click-to-do-do-more-with-what-s-on-your-screen
- Microsoft Support, *KB5067036* (2025-10-28) [S]: https://support.microsoft.com/en-us/help/5067036
- Windows Latest, Notepad "Explain with Copilot" (2024-02-09) [S]: https://www.windowslatest.com/2024/02/09/hands-on-microsoft-is-bringing-copilot-ai-to-notepad-for-windows-11/
- Microsoft Learn, *Advanced Paste* (atualizado em 2026-08-25) [V]: https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste
- Pureinfotech, Phi Silica no Advanced Paste (2026) [S]: https://pureinfotech.com/powertoys-phi-silica-ai-advanced-paste/
- Windows Insider Blog, Vision com 2 apps e Highlights (2025-05-12) [S]: https://blogs.windows.com/windows-insider/2025/05/12/copilot-on-windows-windows-insiders-can-now-use-vision-with-2-apps-and-new-highlights-feature-with-1-app/
- Thurrott, Vision Desktop Share (2025) [S]: https://www.thurrott.com/a-i/microsoft-copilot-a-i/323372/microsoft-begins-rolling-out-vision-desktop-share-across-all-insider-channels
- Neowin, Copilot Vision com entrada de texto (2025-10) [S]: https://www.neowin.net/news/you-can-now-use-copilot-vision-on-windows-with-text-input/
- OpenAI Help, *Using the ChatGPT Windows app* (403 em 2026-10-17) [S]: https://help.openai.com/en/articles/9982051-using-the-chatgpt-windows-app
- OpenAI Help, *Windows app release notes* [S]: https://help.openai.com/en/articles/10003026-windows-app-release-notes
- Claude Help Center, *Use quick entry with Claude Desktop on Mac* (2026-03-16) [V]: https://support.claude.com/en/articles/12626668
- GitHub, anthropics/claude-code #22420 (2026-02-01) [V]: https://github.com/anthropics/claude-code/issues/22420
- Raycast, changelog Windows v0.65 (2026-06-18) [V]: https://www.raycast.com/changelog/windows/0-65
- Raycast, changelog Windows v2.0 (2026-08-25) [V]: https://www.raycast.com/changelog/windows/2-0
- Raycast, changelog Windows v0.24 (2025-06-20) [S]: https://www.raycast.com/changelog/windows/0-24
- Raycast Manual, *AI Commands* [S]: https://manual.raycast.com/ai/ai-commands
- Microsoft Support, *Getting started with Copilot in Microsoft Edge* [S]: https://support.microsoft.com/en-us/Microsoft-Copilot/getting-started-with-copilot-in-microsoft-edge
- Gigazine, Copilot Mode no Edge (2025-07-29) [S]: https://gigazine.net/gsc_news/en/20250729-microsoft-edge-copilot-mode
- Windows Report, "Ask Copilot" no menu de contexto do Edge [S]: https://windowsreport.com/tired-of-multiple-prompts-edges-new-ask-copilot-feature-solves-that/
- AI Toolbox, extensões de barra lateral comparadas (2026) [S]: https://www.ai-toolbox.co/chatgpt-management-and-productivity/chatgpt-sidebar-extensions-compared-2026

**2. Conversas paralelas e ramificações**
- Claude Code Docs, *Interactive mode: Side questions with /btw* [V]: https://code.claude.com/docs/en/interactive-mode
- Claude Code Docs, *Manage sessions* (branch, fork, transcripts) [V]: https://code.claude.com/docs/en/sessions
- Claude Code Docs, *Best practices* ("kitchen sink session", `/btw`, interview) [V]: https://code.claude.com/docs/en/best-practices
- Vincent Qiao, *Claude Code /btw* (2026-03-25) [S]: https://blog.vincentqiao.com/en/posts/claude-code-btw/
- wmedia.es, `/fork` × `/branch` [S]: https://wmedia.es/en/tips/claude-code-fork-vs-branch-en
- Vistazo, branch no ChatGPT (2025-09-08) [S]: https://www.vistazo.com/amp/estilo-de-vida/tecnologia/2025-09-08-chatgpt-nueva-actualizacion-ramificacion-conversaciones-ejemplos-ia-GG10074389
- TechRadar, branches no iOS e Android (2025-12) [S]: https://www.techradar.com/ai-platforms-assistants/chatgpt/the-chatgpt-app-just-got-a-big-upgrade-on-ios-and-android-to-stop-your-chats-spiraling-out-of-control
- Nodea, ramos ocultos no Claude.ai [S]: https://www.nodea.ai/blog/branching-ai-chat-guide
- LibreChat, *Forking* [V]: https://www.librechat.ai/docs/features/fork
- TypingMind, *Fork chats* [S]: https://docs.typingmind.com/chat-management/fork-chats
- AlternativeTo, Rabbitholes AI [S]: https://alternativeto.net/software/rabbitholes-ai/about
- Heptabase, *Work with AI* [V]: https://wiki.heptabase.com/work-with-ai
- Heptabase, newsletter "Chat with your whiteboards" (2025-07-23) [S]: https://wiki.heptabase.com/newsletters/2025-07-23
- Tana, *AI chat* (lista de modelos atualizada em 2025-11-21) [V]: https://outliner.tana.inc/docs/ai-chat
- Cursor Docs, *Modes / Plan Mode* [V]: https://cursor.com/docs/agent/modes
- Fórum do Cursor, Plan muda para Agent sozinho [S]: https://forum.cursor.com/t/plan-mode-how-to-prevent-cursor-from-switching-to-agent-mode-automatically/151214
- GitHub Docs, *Chat in IDE* (Agent, Plan, Ask) [V]: https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-ide
- Devin Desktop (ex-Windsurf), *Cascade modes* [V]: https://docs.devin.ai/desktop/cascade/modes
- Obsidian, plugin Claudian [V]: https://community.obsidian.md/plugins/realclaudian

**3. Glossário e vocabulário**
- Dummies, *Vocabulary Builder on your Kindle Paperwhite* [S]: https://www.dummies.com/article/technology/electronics/tablets-e-readers/kindles/how-to-use-vocabulary-builder-on-your-kindle-paperwhite-156833/
- Nerdschalk, Kindle Vocabulary Builder [S]: https://nerdschalk.com/how-to-enable-and-use-kindle-vocabulary-builder/
- Readwise Docs, *Ghostreader default prompts* [V]: https://docs.readwise.io/reader/guides/ghostreader/default-prompts
- Readwise Docs, *Prompt library* (Vocab Flashcard) [S]: https://docs.readwise.io/reader/guides/ghostreader/prompt-library
- Readwise Docs, *Custom prompts* [S]: https://docs.readwise.io/reader/guides/ghostreader/custom-prompts
- LingQ Support, *Can you explain a LingQ's status* [S]: https://lingq-support.groovehq.com/help/can-you-explain-a-lingqs-status
- LingQ Support, *How do I increase my known words* [S]: https://lingq-support.groovehq.com/help/how-do-i-increase-my-known-words
- RemNote, *AI Flashcards* [S]: https://www.remnote.com/feature/ai-flashcards
- SuperMemo Guru, *20 rules of knowledge formulation* (Wozniak, 1999) [S]: https://supermemo.guru/wiki/20_rules_of_knowledge_formulation
- Novak & Cañas, *The Theory Underlying Concept Maps…* (IHMC, 2006; rev. 2008) [S]: https://users.cs.northwestern.edu/~paritosh/papers/sketch-to-models/Novak-Canas-TheoryUnderlyingConceptMapsHQ.pdf
- MarginNote, *AI* [V]: https://www.marginnote.com/en/features/ai/
- Claude Code Docs, *Output styles* (Explanatory, Learning) [V]: https://code.claude.com/docs/en/output-styles
- AlternativeTo, ChatGPT Study Mode (2025-07) [S]: https://alternativeto.net/news/2025/7/chatgpt-launches-study-mode-to-foster-student-learning-and-critical-thinking
- Tom's Guide, modos de aprendizagem do Claude (2025-08) [S]: https://www.tomsguide.com/ai/claudes-new-learning-modes-take-on-chatgpts-study-mode-heres-what-they-do
- Heptabase, AMA de 2024-11 (pedido de tutor que entenda o nível) [S]: https://wiki.heptabase.com/ama-2024-11

**4. Revisão de saída de agentes e SDD**
- GitHub, *github/spec-kit* [V]: https://github.com/github/spec-kit
- Spec Kit, *Command reference* [V]: https://github.github.io/spec-kit/reference/agentic-sdd.html
- Spec Kit, `templates/commands/clarify.md` [V]: https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md
- Kiro Docs, *Specs* (atualizado em 2026-10-15) [V]: https://kiro.dev/docs/specs/
- Kiro Docs, *Steering* [V]: https://kiro.dev/docs/steering/
- Kiro Docs, *Hooks* [V]: https://kiro.dev/docs/hooks/
- CodeMySpec, *Tessl Review (2026)* [S]: https://codemyspec.com/blog/tessl-review
- BMAD Docs, *Skills and agents* (Advanced Elicitation) [V]: https://docs.bmad-method.org/reference/skills-and-agents/
- Agent OS, releases [S]: https://github.com/buildermethods/agent-os/releases
- Agent OS, *Concepts* [S]: https://buildermethods.com/agent-os/concepts
- Cline Docs, *Memory Bank* [V]: https://docs.cline.bot/best-practices/memory-bank
- GreatScottyMac, *roo-code-memory-bank* [V]: https://github.com/GreatScottyMac/roo-code-memory-bank
- GreatScottyMac, *context-portal* (ConPort v0.2.4) [V]: https://github.com/GreatScottyMac/context-portal
- Claude Code Docs, *Permission modes* (plan mode) [V]: https://code.claude.com/docs/en/permission-modes
- Claude Code Docs, *Tools reference* (`AskUserQuestion`) [V]: https://code.claude.com/docs/en/tools-reference
- CodeRabbit Docs, *Walkthroughs* [V]: https://docs.coderabbit.ai/pr-reviews/walkthroughs
- GitHub Docs, *Creating a pull request summary with GitHub Copilot* [S]: https://docs.github.com/en/copilot/how-tos/copilot-on-github/copilot-for-github-tasks/create-a-pr-summary
- Graphite, *Introducing Graphite Agent* (2025-10) [S]: https://graphite.com/blog/introducing-graphite-agent-and-pricing
- Qodo Docs, *Code review overview* [V]: https://docs.qodo.ai/code-review/overview
- Plannotator Docs, *Claude Code* (verificado em 2026-07-31 e 2026-10-04) [V]: https://docs.plannotator.ai/open-source/agents/claude-code
- Addy Osmani, *Comprehension Debt* (2026-03-14) [V]: https://addyosmani.com/blog/comprehension-debt/
- Anthropic, *AI assistance and coding skills* (2026-01-29) [V]: https://www.anthropic.com/research/AI-assistance-coding-skills

**5. Registro de decisões**
- Michael Nygard, *Documenting Architecture Decisions* (2011-11-15) [V]: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- MADR (4.0.0, 2024-09-17) [V]: https://adr.github.io/madr/
- Olaf Zimmermann, *Y-Statements* (Medium, 2020-05-07; 403 em 2026-10-17) [S]: https://medium.com/@docsoc/y-statements-10eb07b5a177
- Wikipedia, *Architectural decision* (Zdun et al., IEEE Software, 2013) [V]: https://en.wikipedia.org/wiki/Architectural_decision
- log4brains [S]: https://github.com/thomvaill/log4brains/
- Lullabot, ADR "Use Log4brains to manage the ADRs" (2021-07-05; compara com adr-tools) [S]: https://architecture.lullabot.com/adr/20210705-use-log4brains-to-manage-the-adrs
- Joel Parker Henderson, *architecture-decision-record* [V]: https://github.com/joelparkerhenderson/architecture-decision-record
- Spotify Engineering, *When Should I Write an Architecture Decision Record* (2020-04-14) [V]: https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record
- Microsoft hve-core, skill `adr-author` (listagem skills.cat; repo github.com/microsoft/hve-core) [V]: https://skills.cat/skills/microsoft/hve-core/adr-author
- affaan-m/everything-claude-code, skill `architecture-decision-records` [V]: https://claudemarketplaces.com/skills/affaan-m/everything-claude-code/architecture-decision-records
- giuseppe-trisciuoglio/developer-kit, skill `adr-drafting` [S]: https://claudemarketplaces.com/skills/giuseppe-trisciuoglio/developer-kit/adr-drafting
- Farnam Street, *Decision Journal* (2014-02-20; mod. 2025-02-13) [V]: https://fs.blog/2014/02/decision-journal/
- WisdomTree, Annie Duke e "resulting" [S]: https://www.wisdomtree.com/us/insights/blog/thinking-in-bets-how-to-improve-decision-making-with-annie-duke
- Amazon, carta aos acionistas de 2015 (PDF sem texto extraível; citações via reproduções) [S]: https://s2.q4cdn.com/299287126/files/doc_financials/annual/2015-Letter-to-Shareholders.PDF
- Gary Klein, *Performing a Project Premortem* (HBR, 2007-09) [S]: https://hbr.org/2007/09/performing-a-project-premortem
- Rust RFCs, `0000-template.md` [V]: https://github.com/rust-lang/rfcs/blob/master/0000-template.md
- Oxide, *RFD 1: Requests for Discussion* (2020-07-24) [S]: https://oxide.computer/blog/rfd-1-requests-for-discussion

**6. Thinking partner sem decidir pelo usuário**
- Microsoft Research, *Tools for Thought* (palestra TEDAI de 2025-09-26) [V]: https://www.microsoft.com/en-us/research/project/tools-for-thought/
- Microsoft Research Blog, *The Future of AI in Knowledge Work: Tools for Thought at CHI 2025* (2025-04-18) [V]: https://www.microsoft.com/en-us/research/?p=1136647
- Advait Sarkar, *AI Should Challenge, Not Obey* (CACM 67(10), 2024-10; arXiv 2411.02263) [V]: https://arxiv.org/html/2411.02263v1
- MarginNote, *AI* [V]: https://www.marginnote.com/en/features/ai/
- Heptabase, *Public Roadmap* (AI Tutor em 2026-03-31; Agent em 2026) [V]: https://wiki.heptabase.com/roadmap
- Heptabase, newsletter "AI Agent Mode, Heptabase CLI" (2026-05-29) [V]: https://wiki.heptabase.com/newsletters/2026-05-29
- Fórum do Obsidian, *Shaping Obsidian's Tomorrow* (2024-11 a 2025-01) [V]: https://forum.obsidian.md/t/shaping-obsidian-s-tomorrow-how-obsidian-can-embrace-ai-and-stay-true-to-its-roots/92220
- Obsidian, plugins Vault Sidekick, Claude Panel e AI Sidebar [S]: https://community.obsidian.md/plugins/vault-sidekick · https://community.obsidian.md/plugins/claude-panel-ryukyuhub · https://community.obsidian.md/plugins/ai-sidebar
- Granola Docs, *Editing your enhanced notes* [S]: https://www.granola.ai/docs/docs/101/afteryourmeeting/editing-your-enhanced-notes
- iA Writer, *Track authors and AI* [S]: https://ia.net/writer/how-to/track-authors-and-ai
- MIT Media Lab, *Your Brain on ChatGPT* (2025-06-10; arXiv 2506.08872) [V]: https://www.media.mit.edu/publications/your-brain-on-chatgpt/

**Internas (Monet, lidas em 2026-10-17, sem alteração)**
- `DOCS/features/central_informacao_study.md`: uso medido (659 mensagens, 6 "Anotar") e propostas I9, I10 e I14.
- `DOCS/features/mercado_2026-10/market_03_ia_em_notas.md`: arquétipos de quem escreve o registro.
- `src/components/NotesChat/NotesChatPanel.tsx`: contexto efêmero da nota e da seleção no envio; "Insert selection".
- `src/components/AssistantPanel/AssistantPanel.tsx`: pasta do Assistant com system prompt, documentos e memória.
- `src-tauri/src/lib.rs:1671`: atalhos globais Ctrl+M e Ctrl+K. `package.json` e `src-tauri/Cargo.toml`: sem plugin de clipboard.
