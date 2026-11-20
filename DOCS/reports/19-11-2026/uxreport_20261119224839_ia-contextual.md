# UX Report — Fatia 6: IA contextual e janelas auxiliares

> uxAgent · 2026-11-19 · branch `fix/divida-tecnica` (com a Fase A aplicada, sem commit)
> Plano: `DOCS/reports/19-11-2026/uxplan_20261119214504.md`
> Escopo: `AiPanel/` (cards dos slash), `NotesChat/` (chat do caderno), `AssistantPanel/` (Ctrl+M), `KeepPanel/` (Ctrl+K), `lib/commands.ts` e `lib/agents/`.
> Análise só pelo código, pelas specs e pelo único print de `DOCS/prints/`, que não mostra esta fatia. O app não foi aberto.

---

## 1. Resumo executivo

**Em parte.** A camada de agentes está boa e segue a tese. Cada agente tem papel, política de contexto e formato próprios. O app calcula os números (plano, agenda) em vez de deixar o modelo contar, e a IA só escreve na nota por clique.

As superfícies em volta desses agentes têm problemas que o usuário sente:

- **O slash, principal diferencial do PRD, não dá retorno no texto.** Entre o Enter e o card passam alguns segundos sem sinal. Erros só aparecem na aba AI e somem se a coluna estiver fechada. A linha fica verde de "executado" mesmo quando o comando falha.
- **As pontes entre IA e nota não fecham.**
  - O "Chat" do card tira o usuário da nota e abre uma conversa solta, sem o caderno e sem a nota.
  - Apagar o card apaga, sem confirmação, o conteúdo do bloco de IA já inserido na nota.
  - A keep não desenha os blocos `/today` e `/week-review`, que vivem justamente na nota do dia.
- **Há falhas que pegam o usuário novo:**
  - 5 dos 14 comandos de IA exigem a chave do Tavily, e nada avisa antes;
  - dois botões "Settings" não fazem nada;
  - as janelas Assistant e keep só abrem por atalho global fixo, que nenhuma tela explica.

---

## 2. Contexto do app

- **Proposta de valor:** companheiro de aprofundamento num tema ao longo do tempo. O trabalho do usuário (notas, leituras, o caderno do tema) fica no centro, e a IA é meio, convocada e nunca proativa (`productVision.md`, `PRD.md` §1 e §3).
- **Usuário-alvo:** o autodidata em estudo de longo prazo, com fichamento de livro e acompanhamento de curso (`PRD.md` §2). No uso real, o Coordenador também documenta o trabalho: o `/docs` é o comando mais usado e o `/define` vem logo atrás (`agents_study.md` §2).
- **Jobs desta fatia:**
  1. Destravar um ponto da nota sem sair dela: slash `/define`, `/critique`, `/docs`, `/expand`.
  2. Conversar sobre o caderno ao lado da nota e trazer só o que vale para ela (aba Chat).
  3. Planejar e sustentar o ritmo: agentes Planner, Coach, Plan week e Tutor no chat; `/today` e `/week-review` na nota do dia.
  4. Capturar ou perguntar rápido sem abrir a janela principal (keep com Ctrl+K e Assistant com Ctrl+M).
- **Onde a fatia entra nos fluxos:** é a "IA à mão" do módulo Anotações (PRD §4, "Anotações" e "Comandos disponíveis") e as duas janelas auxiliares, que ficam sempre por cima.

---

## 3. O que a fatia entrega (estado atual)

- **Slash no editor:** 14 agentes de IA mais 2 comandos locais (`/tasks`, `/diagram`), e mais 2 só no Calendar (`lib/agents/index.ts:22-39`, `lib/commands.ts:4-10`). Com Enter, a linha fica verde e o card aparece na aba **AI** da coluna direita. Quando a resposta termina, a linha ganha os botões "↓ inserir" e "×" (`CommandExtension.ts:298-341`). "Inserir" põe um bloco de IA recolhido e não editável abaixo da linha.
- **Aba AI** (`AiPanel.tsx`): cards por nota, com arrastar para reordenar, expandir tudo, Copy, "Chat" (vai ao modo Chat), fontes e modelo.
- **Aba Chat** (`NotesChatPanel.tsx`): uma pasta de chat por caderno, com a nota aberta e a seleção como contexto efêmero (chips removíveis), as tasks do caderno, RAG do caderno, seletor de agente, ações "Insert at cursor", "Append to note" e "Save as Plan note"/"Save study profile", e "Insert selection" ao selecionar um trecho da resposta.
- **Assistant** (`AssistantPanel.tsx`): janela de 480×560 sempre por cima. Começa uma conversa nova a cada exibição, com seletor de pasta, ícones da pasta, captura de tela e "Save to note" pela main.
- **Keep** (`KeepPanel.tsx`): janela de 760×600 sempre por cima, com o calendário e a nota do dia. Tem lembrete com "@", `/tasks` vivo, aviso de erro de gravação com Retry e recarga no foco (Fase A).

---

## 4. Análise de usabilidade

### O que funciona bem

- **Agentes com política de contexto explícita** (`lib/agents/core.ts:24-41`). O `/define` sem RAG e o `/critique` julgando só o texto do usuário (`critique.ts:20-37`) põem o "complementar, não substituir" em prática.
- **Números calculados pelo app e não pelo modelo** no Coach, no Planner, no `/today` e no `/week-review` (`coach.ts:13-50`, `today.ts:47-49`). Isso evita a classe de erro mais comum dos LLMs com datas.
- **Política de perguntas boa:** no máximo uma pergunta, com suposição declarada (`planner.ts:76-80`).
- **Chips de contexto no chat do caderno** (`NotesChatPanel.tsx:695-744`). O usuário vê e controla o que vai para a IA: a nota e a seleção.
- **"Insert selection"** (`NotesChatPanel.tsx:361-407, 656-681`): traz só o trecho que interessa. É a ponte granular que o PRD descreve.
- **`/critique` com nota curta não gasta chamada** (`App.tsx:2333-2336`, `critique.ts:7`).
- **Keep robusta na gravação:** recarga sem pisar na edição local, erro visível com Retry (`KeepPanel.tsx:82-117, 520-528`).
- **"Ask AI" pré-preenche sem enviar** (`NotesChatPanel.tsx:348-359`). A IA fica à mão sem se impor.

### Problemas encontrados (resumo para a triagem)

| # | Problema | Evidência principal | Severidade | Custo |
|---|---|---|---|---|
| IA-01 | O slash não dá retorno no texto: card só depois do preparo, erro invisível com a coluna fechada, linha verde mesmo com falha | `App.tsx:2207-2546`, `useAi.ts:135-163`, `CommandExtension.ts:137-145, 289-296`, `Editor.tsx:472-480` | Alta | M |
| IA-02 | Apagar um card na aba AI apaga o conteúdo do bloco de IA já inserido na nota, sem confirmação | `App.tsx:4392-4395`, `useAi.ts:272-286`, `EmbedBlockView.tsx:13-19, 68-70` | Alta | P–M |
| IA-03 | "Chat" do card sai da nota e abre conversa solta (sem caderno, sem RAG, sem a nota) | `AiCard.tsx:214-228`, `App.tsx:3316-3332`, `useChat.ts:1138-1165` | Alta | M |
| IA-04 | `/ask`, `/explain`, `/guide`, `/search` e `/profile` exigem a chave do Tavily, e nada avisa antes | `legacy.ts:26, 34, 66, 74, 90`, `App.tsx:2230-2240` | Alta (1º uso) | P |
| IA-05 | A keep não desenha os blocos de IA: `/today` e `/week-review` aparecem como "Resposta gerada pela IA / Response not available" | `KeepPanel.tsx:577-581`, `EditorResponsesContext.tsx:8`, `EmbedBlockView.tsx:18, 69` | Alta | P |
| IA-06 | Os botões "Settings" do chat do caderno e do Assistant não fazem nada | `NotesChatPanel.tsx:576`, `AssistantPanel.tsx:405`, `ModelSelector.tsx:54-67` | Média-alta | P |
| IA-07 | Trocar de nota cancela o slash em andamento; sem texto parcial, o card some | `useAi.ts:206-247` | Média-alta | M |
| IA-08 | Ctrl+K e Ctrl+M são globais, fixos e escondidos: tomam o atalho de outros apps e nenhuma tela os ensina | `lib.rs:1760-1774, 1699-1703` | Média-alta | M |
| IA-09 | Botões do slash no editor em português e com glifos ("↓ inserir", "↑ remover", "×", "respondendo") | `CommandExtension.ts:289-341`, `EmbedBlockView.tsx:18` | Média | P |
| IA-10 | Autocomplete do slash: 16–18 itens numa lista plana, só por prefixo, sem exemplo, os mais usados abaixo da dobra e sem dizer qual usa web | `CommandAutocomplete.tsx:43-60`, `commandParser.ts:82-90`, `agents/index.ts:22-39` | Média | M |
| IA-11 | Comando inválido ou incompleto fica vermelho sem dizer o porquê; `/planner`, `/coach` e `/tutor` no editor não indicam que estão no Chat | `commandParser.ts:71-80`, `Editor.module.css:559-566` | Média | M |
| IA-12 | O Assistant zera a conversa a cada exibição e ao trocar de pasta: perde o rascunho e não dá como voltar à conversa anterior | `AssistantPanel.tsx:226-246, 271-278`, `ChatComposer.tsx:89-94` | Média | M |
| IA-13 | Cards de erro não mostram o botão de apagar, e os erros não têm ação (Settings, Retry) | `AiPanel.module.css:415-430`, `AiCard.tsx:145-184`, `useAi.ts:249-270` | Média | P |
| IA-14 | Cabeçalho do chat do caderno sobrecarregado numa coluna de 300 px; o nome do caderno é o primeiro a sumir | `NotesChatPanel.tsx:496-578`, `NotesChatPanel.module.css:16-41` | Média | M |
| IA-15 | Quatro vocabulários para a mesma ponte IA → nota | `CommandExtension.ts:303`, `AiCard.tsx:214-227`, `NotesChatPanel.tsx:981-996`, `ChatMessageBubble.tsx:217` | Média | P–M |
| IA-16 | `/action` promete editar o texto, mas entrega um bloco de IA não editável | `legacy.ts:93-99` | Média | M |
| IA-17 | A nota longa entra cortada em 8 mil caracteres sem aviso ao usuário | `notesContext.ts:12, 50-53, 85-87` | Média | P |
| IA-18 | Rodar um slash troca a coluna direita para a aba AI e esconde a nota lateral ou a conversa | `App.tsx:2207-2208` | Média-baixa | P |
| IA-19 | `/coach` (ou outro agente) sozinho + Enter não roda nada; placeholder e estado vazio não mudam com o agente | `NotesChatPanel.tsx:433-438, 635-639, 762-766` | Média-baixa | P |
| IA-20 | A keep cria nota no banco só por navegar até um dia | `KeepPanel.tsx:226-249, 537` | Média-baixa | M |
| IA-21 | "Open Monet" da keep abre a nota de hoje, não a do dia exibido | `KeepPanel.tsx:497-506`, `lib.rs:74-78` | Baixa | P |
| IA-22 | "@" na keep sempre abre o seletor de horário (e-mail, "@fulano") | `KeepPanel.tsx:177-184` | Baixa | P |
| IA-23 | Glifos e SVG próprios no lugar de Phosphor nas superfícies da fatia | ver detalhe | Baixa-média | P |
| IA-24 | Popovers abaixo de z-index 1000 (ModelSelector 20; autocomplete do slash em 1000, não acima) | `AiPanel.module.css:215`, `CommandAutocomplete.module.css:3` | Baixa | P |
| IA-25 | Card da aba AI com `{ __html }` não memoizado: a seleção de texto no card se perde quando o painel re-renderiza | `AiCard.tsx:193` | Baixa | P |
| IA-26 | ModelSelector sem Escape nem setas; reordenar cards só com o mouse | `ModelSelector.tsx:44-52, 105-157`, `AiPanel.tsx:195-197` | Baixa | P |
| IA-27 | Estado vazio do Assistant ("Ask anything") vende chatbot genérico, que o PRD lista como não-meta | `AssistantPanel.tsx:430` | Baixa | P |

### Detalhe dos achados

#### Slash e aba AI

**IA-01. O slash não dá retorno no texto** (Alta, M)
- Evidência:
  - O `handleCommand` faz o preparo inteiro antes de criar o card. Entram as chaves, a agenda, os blocos embutidos, o OCR das imagens, a definição anterior, a busca web (Tavily) e o RAG (embedding, ou reescrita + híbrida + rerank no `/docs`) (`App.tsx:2209-2546`). Só depois o `start` cria o card em `streaming` (`useAi.ts:146-163`).
  - O índice que liga a linha à resposta só casa respostas `completed`, ou uma resposta com bloco já inserido (`CommandExtension.ts:137-145, 160-180`). Os "..." de streaming (`CommandExtension.ts:289-296`) nunca aparecem para um comando novo.
  - A linha recebe a marca `executed` (verde, estilo de sucesso) no Enter, antes de qualquer validação (`Editor.tsx:472-480`, `Editor.module.css:550-557`). Um erro de preparo vira card de erro (`App.tsx:2212-2240, 2258-2265, 2443-2493`), mas a linha continua verde.
  - Card e erro ficam só na aba AI. O `setRightTab('ai')` não abre a coluna (`App.tsx:2208`); só o `setAiOpen` abriria, e ele não é chamado. A coluna começa fechada no board e pode estar fechada pelo usuário (`App.tsx:1104-1112`).
- Problema para o usuário: ele digita `/docs quais empresas…` e aperta Enter. A linha fica verde e nada acontece por 2 a 10 s (reescrita, busca e rerank). Com a coluna fechada, nada acontece mesmo. Se faltar a chave ou não houver documentos, o comando "deu certo" (verde) e o erro fica num lugar que ele não está vendo. É o fluxo que o PRD aponta como diferencial ("sem trocar de janela para uma dúvida pontual").
- Proposta:
  1. Criar o card no Enter, com status de preparo ("Searching notebook sources…", "Searching the web…", "Reading images…"), e só então fazer streaming. O `useAi` ganha um status `preparing`.
  2. Feedback na própria linha. O índice passa a casar respostas `preparing`/`streaming`/`error` pelo `commandId` (já guardado na resposta): um indicador com o status curto, e em erro a linha muda para o estilo de erro com "Why?" ou "Open card".
  3. Com a coluna fechada, abrir a coluna na aba AI só no erro, ou mostrar um ponto no botão da IA na Toolbar.
- Alternativa maior (G, revê a decisão do PRD de "Inserir" explícito): o bloco nasce na nota já no Enter, como "pending", recolhido e marcado como IA, e o usuário remove se não quiser. Resolve o feedback de vez, mas inverte o padrão de inserção.

**IA-02. Apagar o card apaga o bloco já inserido na nota** (Alta, P–M)
- Evidência:
  - O "×" do card chama `removeResponse` e `unlinkResponseFromChat` (`App.tsx:4392-4395`), que apaga a linha em `ai_responses` (`useAi.ts:272-286`).
  - O bloco de IA da nota não guarda texto: busca a resposta pelo `commandId` (`EmbedBlockView.tsx:13-19`).
  - Sem a resposta, o bloco mostra "Resposta gerada pela IA" e, aberto, "Response not available." (`EmbedBlockView.tsx:18, 68-70`).
  - Não há confirmação nem desfazer. O "×" da linha no editor apaga linha, bloco e card juntos (`CommandExtension.ts:324-341`), o que é coerente. O do card apaga só a fonte do bloco.
- Problema: o bloco inserido é parte da nota, que o PRD trata como perene ("apagar uma anotação exige confirmação"). Limpar a aba AI, gesto de arrumação, destrói conteúdo da nota sem aviso. O dano aparece depois, e o usuário não sabe por quê.
- Proposta:
  - (P) Se a resposta estiver inserida na nota aberta, o "×" do card só tira o card do painel (flag `hiddenInPanel` ou lista de ocultos por nota), sem apagar a resposta.
  - (M, alternativa) Confirmar: "This response is inserted in the note. Delete the block too?", com "Hide card" e "Delete both".
  - Em qualquer caso, o card mostra um selo "In note" (ver O1).

**IA-03. "Chat" do card sai da nota e perde o contexto** (Alta, M)
- Evidência:
  - O botão "Chat" (`AiCard.tsx:214-228`) chama `handleOpenResponseInChat`, que cria a conversa e faz `setActiveMode('chat')` (`App.tsx:3316-3332`).
  - A conversa nasce solta, com `folderId: null` (`useChat.ts:1138-1165`): sem a pasta do caderno, sem os documentos e a memória da pasta, e sem a nota. A pergunta gravada é só a linha `"/define RAG"`.
- Problema: o PRD diz que o "Chat" serve para "fazer perguntas paralelas sobre o tema sem poluir a nota". Hoje o usuário perde a nota da tela e ganha uma conversa que não sabe de que nota ou caderno veio. A próxima pergunta sai do material dele, contra o item 2 da visão. Desde que a aba Chat do caderno existe na mesma coluna, há um caminho melhor.
- Proposta: "Continue in chat" abre a aba **Chat** da mesma coluna, na pasta do caderno, numa conversa nova pré-carregada com a pergunta e a resposta do card. A nota segue anexada pelo chip como sempre. O vínculo card → conversa (`linkResponseToChatConversation`) continua.

**IA-04. Cinco comandos exigem a chave do Tavily, e nada avisa antes** (Alta no primeiro uso, P)
- Evidência:
  - `/search`, `/profile`, `/explain`, `/guide` e `/ask` usam `legacyContext('required')` (`legacy.ts:26, 34, 66, 74, 90`).
  - Sem chave, viram card de erro "Web search not configured…" (`App.tsx:2230-2240`).
  - O autocomplete não mostra quem usa web (`CommandAutocomplete.tsx:58-59`).
- Problema: um usuário só com a chave do OpenRouter, o caso do primeiro uso, vê falhar justamente os comandos de nome mais óbvio (`/ask`, `/explain`). `/explain` e `/guide` também não precisam de web para cumprir o papel. E quem tem a chave paga uma busca e alguns segundos em todo `/explain`.
- Proposta:
  - `/ask`, `/explain` e `/guide` passam à política `withQuery` (como o `/expand`): buscam se houver chave e seguem sem web, com uma linha de aviso, se não houver.
  - Ficam `required` só `/search` e `/profile`, que são busca por natureza.
  - No autocomplete, um selo "web" nesses dois, e "needs Tavily key" quando a chave faltar.

**IA-07. Trocar de nota cancela o slash em andamento** (Média-alta, M)
- Evidência:
  - O efeito de troca de nota chama `cancelForNote(prev)` (`useAi.ts:240-247`), que cancela os streams da nota anterior.
  - Sem texto parcial, o card é removido e não é gravado (`useAi.ts:224-228`).
  - Durante o preparo a troca não cancela, porque o `start` usa o `activeId` capturado. O comportamento muda conforme a fase.
- Problema: o usuário dispara `/expand` (web) ou `/docs` (rerank) e vai olhar outra nota enquanto espera, o que é natural num pedido de 10 s. Ao voltar, a resposta não está lá e não há aviso. Paga-se a chamada e perde-se o resultado.
- Proposta:
  - Deixar o stream terminar em segundo plano. O `useAi` já guarda as respostas por nota (`byNote`) e o `noteId` de cada stream; basta não cancelar na troca.
  - Cancelar só no "×" do card ou da linha, ou num botão "Stop" no card em streaming, que hoje não existe.
  - Se a nota de origem for apagada, aí sim cancelar.

**IA-09. Botões do slash no editor em português e com glifos** (Média, P; arquivos da fatia 2, superfície desta)
- Evidência:
  - `"↓ inserir"`, `"↑ remover"`, títulos `"remover bloco da nota"` e `"inserir bloco com a resposta na nota"` (`CommandExtension.ts:303-306`);
  - `"×"` com o título `"remover linha do /comando, bloco e card no painel IA"` (`CommandExtension.ts:328-329`);
  - `aria-label="respondendo"` e `"..."` (`CommandExtension.ts:292-293`);
  - título reserva do bloco `"Resposta gerada pela IA"` (`EmbedBlockView.tsx:18`).
- Problema: a UI é em inglês (migração de 2026-05-17), e estes são os únicos botões do fluxo principal de IA. Para leitor de tela, "respondendo" fica fora do idioma da interface.
- Proposta: "Insert" (Phosphor `ArrowLineDown`), "Remove block" (`ArrowLineUp`) e "Delete" (`Trash`, com rótulo ou tooltip "Delete command, block and card"), `aria-label="Responding"`, e o título reserva "AI response". Os rótulos da linha ficam com texto, porque são ações importantes.

**IA-10. Autocomplete do slash difícil de varrer** (Média, M)
- Evidência:
  - Uma lista plana na ordem do registro: `/search`, `/profile`, `/define`, `/critique`, `/summarize`, `/opinion`, `/table`, `/expand`, `/explain`, `/guide`, `/mindmap`, `/ask`, `/docs`, `/action`… (`agents/index.ts:22-39`);
  - altura máxima de 280 px, cerca de 7 itens visíveis (`CommandAutocomplete.module.css:16-19`);
  - filtro só por prefixo (`commandParser.ts:89`);
  - o campo `example` de cada comando nunca aparece (`CommandAutocomplete.tsx:58-59`, sem uso de `.example` na UI).
- Problema: o comando mais usado (`/docs`) é o 13º, abaixo da dobra. "/rev" não acha `/week-review`. Sem exemplo, o usuário não sabe se o comando pede termo, pergunta ou nada. Com 14 agentes de IA, a escolha pesa (carga cognitiva), e a fronteira entre `/ask`, `/explain`, `/search`, `/expand` e `/opinion` não se vê na lista.
- Proposta:
  - grupos com cabeçalho: **Understand** (`/define`, `/explain`, `/docs`, `/ask`), **Review** (`/critique`, `/expand`, `/opinion`), **Transform** (`/summarize`, `/table`, `/mindmap`, `/action`), **Web** (`/search`, `/profile`), **Calendar** (`/today`, `/week-review`), **Blocks** (`/tasks`, `/diagram`);
  - ordem dentro do grupo por uso, contado em `ai_responses`;
  - filtro por substring do nome e da descrição;
  - o item destacado mostra o `example` numa segunda linha e o selo "web" quando houver.

**IA-11. Comando vermelho sem explicação, e os agentes do chat sem ponte no editor** (Média, M)
- Evidência:
  - `getCommandLineStatus` devolve `invalid` (desconhecido ou só no Calendar) e `incomplete` (falta a query) (`commandParser.ts:71-80`). A linha só fica vermelha (`Editor.module.css:559-566`).
  - `/planner` saiu do slash (`agents_study.md` §8), mas o hábito ficou. Os atalhos `/planner`, `/coach`, `/tutor` e `/plan-week` só existem no composer do chat (`agents/chat.ts:76-82`).
- Problema: "/today" numa nota comum, "/docs" sem pergunta e "/planner" ficam todos vermelhos do mesmo jeito. O usuário não sabe se errou a grafia, se faltou algo ou se o comando mudou de lugar.
- Proposta:
  - Uma dica curta na linha (decoração inline, cinza): "Add a question after /docs", "/today works in Calendar notes", "Unknown command".
  - Para `/planner`, `/coach`, `/tutor` e `/plan-week`: "Planner is a chat agent — Open in Chat". O clique abre a aba Chat com o agente ligado e o resto da linha como mensagem, que o usuário confirma com Enter.
  - Opcional: esses quatro no autocomplete do editor, num grupo **Chat agents**, com o mesmo comportamento.

**IA-13. Cards de erro sem botão visível de apagar e sem ação** (Média, P)
- Evidência:
  - O "×" do card tem `opacity: 0` e só aparece no hover de `.cardHeaderClickable` (`AiPanel.module.css:415-430`).
  - O cabeçalho só é clicável quando o card tem corpo (`AiCard.tsx:131-147`), e o card de erro não tem.
  - O botão continua clicável, invisível. Não há `:focus-visible`, então quem usa teclado também não o vê.
  - O erro é gravado no banco (`useAi.ts:265-267`) e se acumula.
  - O texto vira "Failed to get response: API key not configured. Add your OpenRouter key in Settings…" (`AiCard.tsx:181-184`): prefixo duplicado e nenhum botão.
- Proposta:
  - "×" sempre visível nos cards de erro, e `:focus-visible` com opacidade 1 em todos.
  - Ações no erro: "Open Settings" (chave do OpenRouter ou do Tavily), "Choose documents" (`/docs` sem fontes, abrindo o `DocumentsModal` do caderno) e "Retry" (repete o mesmo comando e a mesma query).
  - Tirar o prefixo quando a mensagem já explica.

**IA-16. `/action` promete editar e entrega bloco não editável** (Média, M)
- Evidência: a descrição diz "Perform an action on the current note text (edit, rewrite, organize, transform)", e o exemplo é "rewrite this section more concisely" (`legacy.ts:93-99`). O resultado vira bloco de IA fechado, como qualquer slash.
- Problema: quem pede "reescreva esta seção" espera texto que possa usar. Hoje é preciso copiar o card e colar. O uso real mostra `/action` e `/table` ativos como transformadores de texto (`agents_study.md` §2 e §8).
- Proposta (respeita "a IA só entra na nota por clique"): nos cards de `/action` e `/table`, um botão "Insert as text". Ele insere o markdown como texto do usuário, como o chat do caderno já faz. A descrição do `/action` passa a dizer o que entrega: "Rewrites or transforms text; insert the result as text".

**IA-18. Rodar um slash troca a aba e esconde o que estava aberto** (Média-baixa, P)
- Evidência: `setRightTab('ai')` em todo slash (`App.tsx:2207-2208`).
- Problema: o usuário escreve com uma nota de referência aberta na aba **Open** (a nota lateral) ou no meio de uma conversa na aba **Chat**. Ao rodar `/define`, a referência some.
- Proposta: com o feedback na linha (IA-01), não trocar de aba. Pôr um contador na aba AI ("AI · 1") até ela ser vista. Trocar só se a coluna estiver na aba AI ou vazia.

**IA-25. `{ __html }` não memoizado no card** (Baixa, P)
- Evidência: `dangerouslySetInnerHTML={{ __html: renderedHtml }}` (`AiCard.tsx:193`). O mesmo erro já quebrou a seleção nos chats (memória do projeto, React 19).
- Problema (inferido): enquanto outro card faz streaming, ou quando o App re-renderiza, o React reescreve o HTML do card, e a seleção de um trecho para copiar se perde.
- Proposta: `useMemo(() => ({ __html: renderedHtml }), [renderedHtml])`, como em `EmbedBlockView.tsx:23`.

#### Chat do caderno (aba Chat)

> Os componentes que este chat divide com o Chat principal (ChatToolsMenu, Clear/Clear all, MessageSources, AgentPicker) foram avaliados na fatia 5 (`uxreport_20261119224531_chat.md`). O achado 4 de lá, "toggles mostram ligado e o agente ignora", vale igual aqui.

**IA-06. "Settings" que não faz nada** (Média-alta, P)
- Evidência:
  - Sem chave, o `ModelSelector` mostra "No API key" e um botão "Settings" (`ModelSelector.tsx:54-67`).
  - No chat do caderno e no Assistant, o `onOpenSettings` é `() => {}` (`NotesChatPanel.tsx:576`, `AssistantPanel.tsx:405`).
  - A faixa do chat do caderno diz "Add your OpenRouter key in Settings" sem botão (`NotesChatPanel.tsx:627-631`).
- Problema: o usuário novo segue a instrução, clica e nada acontece. Para ele, o app está quebrado.
- Proposta:
  - Chat do caderno: receber `onOpenSettings` do App (o `handleOpenSettings` já existe) e pôr o botão "Open Settings" na faixa.
  - Assistant: mostrar a main e abrir Settings (evento `open-settings` para a main, como o `open_main_window`).

**IA-14. Cabeçalho sobrecarregado** (Média, M)
- Evidência: numa linha cabem o nome do caderno, Documents, System prompt, Memory, "Clear all" (com rótulo), Tools e o seletor de modelo, que chega a 200 px (`NotesChatPanel.tsx:496-578`, `AiPanel.module.css:173`). A coluna tem 300 px no mínimo (`AiPanel.tsx:23`). Na linha de baixo vêm a conversa, "New chat" e "Clear" (`NotesChatPanel.tsx:581-625`). Ícones de 12 px.
- Problema (inferido pelo CSS): numa coluna estreita, o nome do caderno, que é o único lugar onde o usuário confirma "de que caderno a IA está falando", é o primeiro a sumir. Três ajustes da pasta ficam só em ícone, com o nome em tooltip. "Clear all" (pasta) e "Clear" (conversa) ficam em linhas diferentes, perto de "New chat".
- Proposta:
  - Linha 1: o nome do caderno (sempre visível, com prioridade) e um menu "Notebook chat settings" (Phosphor `GearSix`) com itens rotulados: Documents (n), Instructions, Memory, Clear all chats.
  - Linha 2: a conversa, "New chat", "Clear", o modelo e Tools.

**IA-15. Quatro vocabulários para a mesma ponte** (Média, P–M)
- Evidência:
  - editor: "↓ inserir" (`CommandExtension.ts:303`);
  - card: "Copy" e "Chat" (`AiCard.tsx:211-227`), sem inserir;
  - chat do caderno: "Insert at cursor" e "Append to note" em toda resposta e de novo em cada bloco `note`, mais "Copy" só no bloco (`NotesChatPanel.tsx:981-996, 1084-1107`);
  - Chat e Assistant: "Save to note" (`ChatMessageBubble.tsx:217`);
  - PRD: "Anotar".
- Problema: o usuário aprende a ponte num lugar e não a reconhece no outro. Uma resposta com um bloco `note` mostra cinco botões. Não há "Copy" para a resposta inteira, embora o PRD diga que cada resposta tem copiar.
- Proposta:
  - Um verbo só, "Insert": um botão "Insert" (no cursor) com uma seta de menu para "Append to end", e "Copy" ao lado.
  - Nos blocos `note`, o mesmo par.
  - No Chat e no Assistant, "Save to note" pode ficar, porque lá não há nota aberta. A dica do PRD ("Anotar") vira "Save to note" no PRD.

**IA-17. Nota longa cortada sem aviso** (Média, P)
- Evidência: `NOTE_TEXT_BUDGET = 8000` e `truncateWithMarker` (`notesContext.ts:12, 50-53, 85-87`). O chip mostra só o título (`NotesChatPanel.tsx:697-712`).
- Problema: um fichamento de capítulo passa fácil de 8 mil caracteres. A IA responde "isso não está na nota" sobre o fim da nota, e o usuário não sabe que ela só viu o começo.
- Proposta:
  - O chip diz "Note · first 8k chars" quando a nota passar do limite, com tooltip explicando.
  - Opcional (M): mandar a parte em volta da seleção quando houver, ou o fim junto com o começo.

**IA-19. Atalho de agente sem efeito visível** (Média-baixa, P)
- Evidência:
  - `/coach` + Enter só liga o agente e limpa o rascunho (`NotesChatPanel.tsx:433-438`).
  - O placeholder continua "Ask about your notes..." (`:762-766`).
  - O estado vazio continua "the AI sees … the notebook's indexed notes" (`:635-639`). Com Coach, Planner e Plan week, o RAG está desligado (`coach.ts:82`, `planner.ts:111`).
- Problema: Coach e Plan week não pedem pergunta, porque o contexto é calculado pelo app. O usuário digita `/coach`, aperta Enter e acha que não funcionou.
- Proposta:
  - Placeholder e estado vazio por agente ("Coach: press Enter to check your plans", "Planner: what do you want to plan, and until when?"), a partir da `description` do agente.
  - Para Coach e Plan week, Enter com o rascunho vazio envia uma mensagem padrão ("Check my plans" / "Plan my week").

#### Assistant (Ctrl+M)

**IA-12. Conversa zerada a cada exibição** (Média, M)
- Evidência:
  - Cada `assistant-shown` chama `startAssistantConversation` (`AssistantPanel.tsx:226-246`).
  - Trocar a pasta abre um rascunho novo (`:271-278`).
  - O composer limpa o rascunho e a imagem quando o `resetKey` muda (`ChatComposer.tsx:89-94`).
  - Não há lista de conversas na janela.
- Problema:
  - Esconder a janela sem querer (Ctrl+M, "×", ou Ctrl+M de novo para olhar algo atrás) perde o fio. A conversa existe, mas só no modo Chat da main.
  - Trocar a pasta depois de digitar apaga o que foi digitado, inclusive um print anexado.
- Proposta:
  - Reabrir na mesma conversa se a última atividade tiver menos de 15 minutos. Senão, conversa nova, com um chip "Continue last conversation" no estado vazio.
  - Trocar de pasta preserva o rascunho do composer.
  - Opcional: menu "Recent" (as 5 últimas da pasta) no título.

**IA-27. "Ask anything"** (Baixa, P)
- Evidência: o estado vazio é "Ask anything — press Enter to send." (`AssistantPanel.tsx:430`).
- Problema: o PRD (§9) diz que o Monet não é chatbot de propósito geral. O Assistant tem pasta, documentos e captura de tela, e o texto não diz nada disso.
- Proposta: "Ask about your notes, a document of this folder, or what is on your screen (camera button). Enter sends." Na pasta `assistant`, sem documentos, um link "Choose documents". (A fatia 5 apontou o mesmo no Chat principal, achado 5.)

#### Keep (Ctrl+K)

**IA-05. A keep não desenha os blocos de IA** (Alta, P)
- Evidência:
  - A keep monta o `EmbedBlock` (`extensions.ts:176`), mas não fornece o `EditorResponsesProvider` (`KeepPanel.tsx:577-581`).
  - O contexto cai no padrão `{ responses: [] }` (`EditorResponsesContext.tsx:8`), e o `EmbedBlockView` mostra "Resposta gerada pela IA" e, aberto, "Response not available." (`EmbedBlockView.tsx:18, 69`).
- Problema: `/today` e `/week-review` só rodam no Calendar (`today.ts:38`, `weekReview.ts:34`). A resposta deles fica na nota do dia, que é exatamente o que a keep mostra. O usuário gera o "Today" de manhã na main, abre a keep durante o dia e vê um bloco "não disponível", em português. Parece que a resposta se perdeu. O conteúdo está no banco, e o autosave da keep preserva o bloco.
- Proposta: a keep carrega `storage.getResponses(note.id)` a cada carga ou recarga da nota e envolve o editor com `EditorResponsesProvider`. O texto reserva vira "AI response" (IA-09).

**IA-08. Atalhos globais fixos e escondidos** (Média-alta, M)
- Evidência:
  - `Ctrl+M` e `Ctrl+K` registrados como atalhos globais do sistema (`lib.rs:1760-1774`);
  - não aparecem em Settings, no Onboarding nem no menu da bandeja (bandeja: "Open", "Stop recording and process", "Quit", `lib.rs:1699-1703`);
  - a única menção são os tooltips dos botões de fechar das próprias janelas (`KeepPanel.tsx:511`, `AssistantPanel.tsx:411`).
- Problema:
  - Com o Monet na bandeja, Ctrl+K deixa de funcionar nos outros apps: inserir link no Word e no Outlook, busca no Chrome e no Edge, troca rápida no Slack, Teams e Discord, acorde do VS Code. O usuário não liga a falha ao Monet.
  - Quem não sabe dos atalhos nunca descobre as duas janelas.
  - Se o registro falhar (atalho já em uso), só o console fica sabendo (`lib.rs:1765-1773`).
- Proposta:
  - (P) "Quick note (Ctrl+K)" e "Assistant (Ctrl+M)" no menu da bandeja.
  - (P) Linha nos Settings mostrando os atalhos e se o registro falhou.
  - (M) Atalhos configuráveis em Settings, com padrão sugerido menos disputado (Ctrl+Alt+K / Ctrl+Alt+M, ou Win+Alt) para instalações novas, e a opção de desligar cada um.

**IA-20. Navegar por dias cria nota** (Média-baixa, M)
- Evidência: `doLoadOrCreateDayNote` grava a nota do dia se não existir (`KeepPanel.tsx:226-249`), também no clique de um dia (`:537`). É a causa provável das notas diárias duplicadas (`agents_study.md` §11).
- Problema: clicar em dias para olhar cria notas vazias. A main, que procura no estado em memória, pode criar uma segunda nota para o mesmo dia. Hoje o dano é baixo, porque nota vazia não ganha ponto no calendário (`CalendarView.tsx:113-116`). Mas a duplicata com conteúdo divide o registro do dia, e o `/week-review` lê as duas.
- Proposta: criar a nota só no primeiro `onUpdate` (rascunho em memória até a primeira tecla), como a main faz com conversas no chat.

**IA-21. "Open Monet" abre hoje, não o dia exibido** (Baixa, P)
- Evidência: o botão chama `open_main_window` (`KeepPanel.tsx:497-506`), que emite `open-today-note` (`lib.rs:74-78`).
- Proposta: o rótulo vira "Open in Monet" e o botão abre a nota exibida (`open_note_in_main` com `note.id`, já usado nos cards, `KeepPanel.tsx:538-541`).

**IA-22. "@" sempre abre o seletor de horário** (Baixa, P)
- Evidência: qualquer "@" abre o `TimePicker`, e cancelar reinsere o "@" (`KeepPanel.tsx:177-184, 442-448`).
- Problema: e-mails e menções numa anotação rápida abrem um popover a cada "@".
- Proposta: disparar só no início de palavra (início da linha ou depois de espaço). Fica igual ao editor da main, se ele tiver a mesma regra (fatia 2).

#### Transversais

**IA-23. Glifos e SVG próprios no lugar de Phosphor** (Baixa-média, P)
- `×` no fechar da keep e do Assistant (`KeepPanel.tsx:516`, `AssistantPanel.tsx:416`).
- `×` e `+` nos chips de contexto (`NotesChatPanel.tsx:710, 724, 739`).
- `×` no card (`AiCard.tsx:174`).
- `−`/`+` no "expand all" (`AiPanel.tsx:359`), sem rótulo: trocar por `ArrowsInSimple`/`ArrowsOutSimple` com "Collapse all"/"Expand all".
- `›` como chevron (`AiCard.tsx:151`, `EmbedBlockView.tsx:58`): `CaretRight`.
- SVG próprio no lugar de Phosphor: alça de arrastar (`AiPanel.tsx:74-81` → `DotsSixVertical`), Copy/Check/Chat/Source (`AiCard.tsx:6-11, 61-78` → `Copy`, `Check`, `ChatCircle`, `FileText`).
- Fora da regra, mas caixa inconsistente: "open Settings" em minúsculas (`AiPanel.tsx:345`) e os status "responding..."/"completed" (`AiCard.tsx:80-85`). O "completed" em todo card é ruído: mostrar só os status que pedem atenção.

**IA-24. Popovers abaixo de 1000** (Baixa, P)
- `ModelSelector` com z-index 20 (`AiPanel.module.css:215`), usado no cabeçalho da aba AI, do chat do caderno e do Assistant.
- Autocomplete do slash com exatamente 1000 (`CommandAutocomplete.module.css:3`). A regra pede acima de 1000.
- Proposta: 1100, como o `AgentPicker` (`AgentPicker.module.css:51`).

**IA-26. Teclado** (Baixa, P)
- `ModelSelector` sem Escape para fechar nem setas na lista (`ModelSelector.tsx:44-52, 105-157`).
- Cards reordenáveis só com o mouse (só `PointerSensor`, `AiPanel.tsx:195-197`). A alça recebe foco (atributos do dnd-kit) mas não reage ao teclado.
- Proposta: Escape e ↑/↓/Enter no seletor (o `AgentPicker` já tem o padrão) e `KeyboardSensor` com `sortableKeyboardCoordinates`.

### Cenários de borda não cobertos

- **Coluna da IA fechada** (board, foco, ou fechada pelo usuário): o slash roda sem nenhum sinal (IA-01).
- **Primeiro uso, só com a chave do OpenRouter:** cinco comandos falham (IA-04), e os "Settings" do chat e do Assistant não fazem nada (IA-06).
- **Nota longa** (fichamento): o chat vê só os primeiros 8 mil caracteres, sem aviso (IA-17).
- **Resposta inserida e card apagado:** bloco quebrado na nota (IA-02).
- **Bloco de IA visto na keep:** "não disponível" (IA-05). Vale conferir o mesmo no `ReaderNotesPanel` (fatia 7), se ele usar o editor base sem o provider.
- **Slash longo e troca de nota:** resposta perdida (IA-07).
- **Muitos cards na nota:** sem filtro nem limpeza; os cards de erro se acumulam e não mostram como apagar (IA-13).
- **Ctrl+K já registrado por outro app:** a keep não abre, e só o console registra (IA-08).
- **Assistant escondido no meio da conversa:** volta zerado, e o rascunho se perde (IA-12).

---

## 5. Avaliação frente aos objetivos do usuário

| Objetivo | Consegue? | Esforço | O que atrapalha |
|---|---|---|---|
| Destravar um ponto da nota com um slash | Sim, quando a coluna está aberta e as chaves estão certas | 1 linha + Enter + "inserir" | Espera sem sinal, erro escondido e linha verde falsa (IA-01); comando difícil de achar (IA-10); vermelho sem motivo (IA-11); comandos que exigem Tavily (IA-04) |
| Aprofundar a resposta de um slash em conversa | Parcial | 1 clique, mas sai da nota | Conversa solta, sem caderno nem nota (IA-03) |
| Conversar sobre o caderno ao lado da nota e trazer só o útil | Sim, é a superfície mais madura | Baixo | Cabeçalho cheio (IA-14), nota longa cortada (IA-17), botões redundantes e sem "Copy" da resposta (IA-15) |
| Planejar e cobrar ritmo (Planner, Coach, Plan week) | Sim | Escolher o agente + uma mensagem | Atalho sozinho sem efeito (IA-19); da cobrança ao replanejamento é preciso trocar de agente à mão (O4) |
| Registrar o dia (`/today`, `/week-review`) e revê-lo na keep | Parcial | Gera na main | A keep mostra o bloco como indisponível (IA-05) |
| Capturar rápido (keep) e perguntar rápido (Assistant) | Sim, para quem conhece os atalhos | Ctrl+K / Ctrl+M | Atalhos escondidos e em conflito (IA-08); Assistant zera a conversa (IA-12); a keep cria notas ao navegar (IA-20) |
| Manter a nota perene e íntegra | Em risco | — | Apagar um card destrói o conteúdo de um bloco da nota (IA-02) |

---

## 6. Oportunidades: funcionalidades relacionadas

| Sugestão | Problema que resolve | Impacto | Esforço | Prioridade |
|---|---|---|---|---|
| O1. Card que sabe se está na nota: selo "In note", botões "Insert into note" e "Show in note" | Hoje inserir só existe na linha do editor e o card não diz se já foi inserido; com o selo, o IA-02 vira óbvio | Alto | Baixo–médio | Agora |
| O2. Retry e Stop no card | Erro e interrupção sem saída; um slash errado não para (IA-07, IA-13) | Médio | Baixo | Agora |
| O3. Ponte do editor para os agentes do chat ("Planner is a chat agent — Open in Chat") | Hábito do `/planner` antigo; agentes só descobertos no composer (IA-11) | Médio | Médio | Próximo |
| O4. "Replan with Planner" na resposta do Coach | Quando o Coach propõe replanejar (`coach.ts:64`), o usuário troca de agente e redigita | Médio | Médio | Próximo |
| O5. Uso por comando (de `ai_responses`) na ordem do autocomplete e para decidir os legados | 14 agentes de IA com fronteiras confusas (IA-10); D17 deixou os legados "para depois" | Médio | Baixo | Próximo |
| O6. "Today" na keep: rodar o `/today` da nota do dia pela keep, por clique | O agente mais útil da nota do dia não existe na janela da nota do dia | Médio | Médio | Depois |
| O7. "Recent" no Assistant | Voltar à conversa de minutos atrás sem ir à main (IA-12) | Baixo–médio | Baixo | Depois |

**O1 em detalhe.** O card vira a central da resposta: "Insert into note" faz o mesmo que o "↓ inserir" da linha, e "Show in note" rola até o bloco e o destaca. O selo "In note" sai do documento aberto, procurando um `embedBlock` com o `commandId`. Junto com IA-02 (o "×" só oculta quando há bloco), resolve o risco de perda e a ação escondida. Também prepara o terreno para tirar os botões da linha, se o Coordenador quiser o texto da nota mais limpo.

**O4 em detalhe.** O Coach já identifica o caso "não cabe mais no prazo" pelos números do app. Um botão "Replan with Planner" na resposta liga o agente Planner na mesma conversa e pré-preenche "Redo <título do plano>". O usuário confere e envia. A IA continua só convocada, e o ciclo planner → coach → planner do estudo (`agents_study.md` §6) fecha sem fricção.

**O5, proposta livre contra decisões.** Com a contagem por comando, duas perguntas aparecem:
- **`/summarize`:** ele contraria o item 3 da visão ("resumir tudo... contraria a tese"). Uma troca possível é `/recall`, que gera 3 a 5 perguntas de revisão sobre a nota, para o usuário responder com as próprias palavras.
- **`/profile` e `/mindmap`:** se o uso for perto de zero, saem do autocomplete. Continuam acessíveis por nome e continuam rotulando os blocos antigos.

A mesma tensão aparece na instrução do chat do caderno, que pede para pôr no bloco `note` "a rewritten passage" (`notesContext.ts:119-122`). Isso incentiva a IA a reescrever a nota pelo usuário. Proposta: trocar o exemplo por "a list, a table or a short definition", sem "rewritten passage".

---

## 7. Próximos passos recomendados

1. **Integridade e falhas silenciosas (P):** IA-02 (o "×" do card só oculta quando há bloco), IA-05 (provider na keep), IA-06 ("Settings" funcionando), IA-13 ("×" visível e ações no erro), IA-04 (`/ask`, `/explain` e `/guide` sem exigir o Tavily).
2. **Feedback do slash (M):** IA-01 (card no Enter com status de preparo, sinal na linha, estilo de erro), IA-07 (não cancelar na troca de nota) e IA-18 (contador em vez de trocar de aba).
3. **Pontes coerentes (M):** IA-03 ("Continue in chat" na aba Chat do caderno), O1 (card que sabe se está na nota), IA-15 (um verbo, "Insert").
4. **Idioma e regra de ícones (P):** IA-09, IA-23, IA-24.
5. **Descoberta (M):** IA-10 (autocomplete em grupos, com exemplo), IA-11 (dica no comando vermelho e ponte para os agentes), IA-08 (bandeja, Settings e atalhos configuráveis).
6. **Janelas auxiliares:** IA-12, IA-20, IA-21, IA-22.
7. **Oportunidades:** O2, O4, O5, depois O3, O6 e O7.

---

## 8. Premissas e limites da análise

- **Sem execução.** Tudo vem da leitura do código na branch `fix/divida-tecnica` com a Fase A aplicada. O app não foi aberto, porque outros agentes trabalham na mesma árvore. Os achados marcados "(inferido)" dependem de layout ou de re-render: IA-14 (corte do nome do caderno) e IA-25 (seleção perdida).
- **Fronteira de fatias.** IA-01, IA-09, IA-10 e IA-11 tocam arquivos da fatia 2 (`Editor/CommandExtension.ts`, `CommandAutocomplete.tsx`, `commandParser.ts`, `EmbedBlockView.tsx`, `Editor.tsx`), e IA-08 toca `src-tauri/src/lib.rs`. Entraram aqui porque são a superfície dos slash e das janelas desta fatia. Na triagem, vale cruzar com o relatório da fatia 2 para não implementar duas vezes. O mesmo vale para os componentes de chat compartilhados com a fatia 5.
- **Print.** O único arquivo de `DOCS/prints/` (2026-10-29) mostra o modal de tipos de nota e não serve para esta fatia.
- **Validações que ajudariam:**
  - **teste de tarefa** "rode um `/docs` com a coluna da IA fechada" e "rode `/explain` sem chave do Tavily", para medir IA-01 e IA-04;
  - **métricas** (locais, do `ai_responses`): quantos cards de erro por comando; quantas respostas `completed` nunca inseridas (o card é lido ou ignorado?); quantos cards apagados com bloco na nota;
  - **uso por comando** para O5 e para a ordem do autocomplete;
  - **conflito de atalho:** perguntar ao Coordenador se já perdeu o Ctrl+K em outro app sem saber por quê.
