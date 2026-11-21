# Review Report — fases D–E, frente 1: pipeline e lógica do Radar e do `/since`

- Task report: `DOCS/reports/20-11-2026/taskreport_20261120115512.md`
- Execution report: `DOCS/reports/20-11-2026/executionreport_20261120115512.md`
- Plano: `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md`
- Triagem: `DOCS/reports/20-11-2026/uxtriage_20261120133108.md` (fatia 2, blocos α, β e γ)
- Spec: `DOCS/specs/radar.md`

## Escopo revisado
`src/lib/agents/chat.ts`, `src/lib/agentItems.ts` (+teste), `src/lib/agents/scope.ts` (+teste), `src/lib/agents/tutor.ts`, `src/lib/radarProfile.ts`, `src/lib/focusMap.ts`, `src/lib/search.ts` (+teste), `src/lib/openalex.ts`, `src/lib/radar.ts` (+teste), `src/lib/agents/radar.ts` (+teste), `src/lib/agents/since.ts`, `src/lib/agents/core.ts`, `src/lib/agents/index.ts`, `src/hooks/useChat.ts` (só a parte do pipeline), `radar_scope_state` em `src/storage/*`, `findAiFolder`/`loadKbSourceFilenames`/`addUrlToKb` em `src/lib/librarian.ts`, `emitMincerChanged` em `src/lib/mincer.ts`, o ramo `'since'` do `handleCommand` em `src/App.tsx`, `commandParser.ts` (+teste), `CommandExtension.ts`, `CommandAutocomplete.tsx`, `TaskModalEditor.tsx`, e em `src-tauri/src/lib.rs` o `radar_plan_queries` e os comandos da chave do OpenAlex.

Fora da frente: Papers, fila de leitura, Library e a interface do chat (`AgentItemsList`, balões, modais, composer, menu de tools, Settings). Li o `AgentItemsList` e o `ChatMessageBubble` só para confirmar o que a lista mostra.

Verificações: `npx tsc --noEmit` limpo; `npm test` com 24 arquivos e 682 testes passando. Conferi na documentação pública do Tavily (`docs.tavily.com`, endpoint search, lida em 20-11-2026) que `start_date`, `filter_by_published_date`, `include_published_date` e `topic` existem e que `published_date` vem com `include_published_date`. Nenhuma requisição levou dado do usuário ou do projeto. `cargo check` não foi rodado por mim.

---

## Defeitos confirmados

### 1. [importante] Turno que termina pela tool de memória não finaliza os itens e mostra todos os candidatos
- **Onde:** `src/hooks/useChat.ts:4709-4718` (ramo `keptText && memoryOnly` do handler de tool), em conjunto com `src/hooks/useChat.ts:3215-3245` (`onOpenRouterDone`, o único ponto que chama `finalizeAgentItems` e o `onDone`).
- **O que está errado:** o Rust não emite `openrouter://done` quando a rodada termina em tool call (`StreamError::ToolCall`, `lib.rs:1135`). Quando a única tool é `update_folder_memory`, o handler encerra o turno ali mesmo (zera `activeStreamRef` e `isStreaming`), sem passar pelo done. Nesse caminho, a mensagem nunca é finalizada: o conteúdo guarda os marcadores crus e `agentItems` guarda o payload inteiro. Como a mensagem não está `failed` nem `interrupted`, `hasAgentPayload` é verdadeiro e o `AgentItemsList` desenha `payload.items` inteiro (`AgentItemsList.tsx:319`).
- **Cenário:** conversa do Radar numa pasta de chat com memória ligada e um modelo com tools. O modelo escreve a resposta e chama só `update_folder_memory` (por exemplo, depois de "lembre que prefiro fontes oficiais"). Resultado:
  - a lista abaixo da resposta mostra até 20 candidatos web e 10 artigos que o modelo não escolheu, acima do teto de 8;
  - o payload de cerca de 30 KB fica no localStorage;
  - a data do escopo não avança, e o `agentDoneRef` fica preso até o próximo `send()`.
- **Mesmo defeito, caso mais raro:** o ramo "tool call sem handler" (`useChat.ts:3313-3328`) troca o conteúdo vazio por `NO_RESPONSE_MESSAGE` e também não poda o payload. A lista inteira aparece sob "No response".
- **Correção sugerida:** extrair do `onOpenRouterDone` uma função `finishAgentTurn(convId, assistantId, roundText)`, que finaliza os marcadores, poda o payload e roda o `onDone` quando há texto. Chamá-la também no ramo `memoryOnly`. No ramo sem handler, chamar só a poda, sem o `onDone`.

### 2. [importante] Resposta parada ou com erro guarda todos os candidatos e deixa marcadores crus no histórico enviado ao modelo
- **Onde:** `markTurnFailed` (`src/hooks/useChat.ts:3110-3129`), `cancel` (`useChat.ts:4943-4954`) e a marca de corte na desmontagem (`useChat.ts:4879-4883`).
- **O que está errado:** só o done poda `agentItems`. Nos outros finais, a mensagem guarda o payload inteiro, até 20 itens web com trecho de 300 caracteres e 10 artigos com abstract de até 1200. Isso dá cerca de 30 KB de JSON por turno, o dobro em UTF-16 no localStorage. A lista fica escondida (`hasAgentPayload`), mas o dado continua gravado. Além disso, o conteúdo parcial guarda os marcadores `[W3]` sem expandir, e o `historyForApi` (`useChat.ts:3504-3526`) manda esse texto ao modelo nos turnos seguintes. No turno novo, `[W3]` é outro candidato, e o modelo pode ligar o comentário antigo ao item errado.
- **É um problema real?** Sim, mas limitado. Cada Stop ou erro no Radar custa cerca de 60 KB da cota, o chat no localStorage ainda não tem aviso de cota (memória do projeto), e uma gravação que falha por cota perde estado do chat. Uns 80 turnos parados bastam para encher 5 MB sozinhos.
- **Correção pequena:** nos três pontos, quando a mensagem tem `agentItems`, aplicar `finalizeAgentItems(m.content, m.agentItems)` e gravar o `content` e o `payload` que ele devolve (no máximo 8 itens citados e sem trecho; os marcadores viram links). Quando o conteúdo está vazio e o balão vira erro, apagar o `agentItems`. A mesma função do achado 1 pode servir aqui, sem o `onDone`.

### 3. [importante] Voltar a um escopo já consultado na mesma conversa e no mesmo dia encolhe a janela para "hoje"
- **Onde:** `previousAgentRun` (`src/lib/agentItems.ts:82-92`) e `keptWindow` (`src/lib/radar.ts:85-93`), chamados em `buildRadarContext` (`src/lib/agents/radar.ts:164`).
- **O que está errado:** `previousAgentRun` devolve só a última consulta concluída da conversa. `keptWindow` só reaproveita a janela dela quando o escopo é igual. Se o escopo mudou no meio, a consulta anterior ao escopo atual é ignorada. A janela volta então para `radarWindow(lastRun)`, e `lastRun` já foi gravado como hoje no fim da 1ª consulta.
- **Cenário:** conversa numa pasta ligada ao caderno "ML".
  1. "What's new?": janela de 30 dias; a data de `notebook:ML` vai para 20/11.
  2. "and #rust?": escopo de tag, com a janela da tag.
  3. "What's new?": o escopo volta à pasta, mas a consulta anterior é a da tag, então `keptWindow` dá null e a janela fica "since 20/11/2026 (last check)". O resultado provável é "Nothing new since 20/11/2026", que é o D1 da triagem voltando na troca de escopo.
- **Correção sugerida:** passar ao agente todas as consultas concluídas do agente na conversa (`previousRuns: AgentRun[]`) e, no `keptWindow`, usar a mais recente do mesmo `scopeKey` e do mesmo dia. O seguimento (`isFollowUp` e `followUpContext`) continua usando a última.

### 4. [nit] O indicador de busca acende em mensagens que não buscam
- **Onde:** `src/hooks/useChat.ts:3858-3889`.
- **O que está errado:** `setWebSearchActive(true)` liga para qualquer agente com `webPipeline` antes do `buildContext`, e só a lógica dentro dele decide se busca.
- **Cenário:** "thanks" depois de uma consulta (seguimento), caderno com a IA desligada ou escopo sem notas. O composer mostra "Searching news, releases and papers…" pelo tempo do `loadPlanData`, sem nenhuma busca.
- **Vale corrigir?** Sim, porque é pequeno e a mensagem promete o que não acontece. Acrescentar ao `AgentContextInput` um `onSearchStart?: () => void`, chamado pelo Radar logo antes do `invoke('radar_plan_queries')`, para cobrir também o planejador. O `useChat` liga o indicador por esse callback e mantém o `finally` que desliga.

### 5. [nit] O Stop não cancela a chamada do planejador de consultas
- **Onde:** `src/lib/agents/radar.ts:171-177`.
- **O que está errado:** o `invoke('radar_plan_queries')` não tem cancelamento, e a requisição ao modelo continua no Rust depois do Stop. O `signal.throwIfAborted()` da linha 179 impede as buscas (Tavily e OpenAlex), então só essa chamada fica solta, e o resultado é descartado.
- **Correção:** aceitável como está; registrar na spec. Para cancelar de verdade seria preciso um id de requisição no comando Rust, como o `cancelOpenRouterStream`, o que não compensa.

### 6. [nit] `/since` com busca feita e nenhum resultado na janela: o modelo não recebe a linha de busca
- **Onde:** `src/App.tsx:2694-2697`.
- **O que está errado:** quando há consultas, nem todas falharam e `formatDatedResults` devolve `''`, o contexto não tem nem "Web search results" nem uma linha "Web search: …". O prompt cobre o caso ("Nothing relevant published since…"), mas o modelo fica sem saber se buscou.
- **Correção:** acrescentar ao `extraContext` uma linha como `Web search: no results published since dd/mm/yyyy.`

### 7. [nit] O `/since` deixou cerca de 25 linhas de lógica no `handleCommand` do `App.tsx`
- **Onde:** `src/App.tsx:2677-2702`.
- **O que está errado:** a escolha do corte, o título, as linhas do contexto e a interpretação de `queries` e `failed` ficaram no `App.tsx`, que deve ter só fiação. Segue o padrão do ramo `withQuery` do `/expand`, que também mora ali, mas é bem maior.
- **Correção:** mover para uma função em `src/lib/agents/since.ts`, por exemplo `prepareSinceContext({ query, note, calendarKey, embeds, userText, todayKey })`, que devolve `{ error }` ou `{ startQuery, extraContext, searchContext }`. Ela ficaria testável (hoje o `/since` de ponta a ponta não tem teste).

---

## Suspeitas e limites (não confirmados como defeito)

- **S1. Pergunta sobre um item já mostrado refaz o pipeline inteiro.** "tell me more about the second one" passa pelo `ragGate` como `search`, então não é seguimento: roda o planejador, até 6 buscas no Tavily e 3 no OpenAlex, e grava a data de novo. É o desenho aprovado na triagem (seguimento = o que o `ragGate` classifica), e há um teste que fixa esse comportamento (`radar.test.ts:538`). O custo de até 9 buscas por pergunta e a latência antes do 1º token, porém, contrariam o espírito do D1. Se o modelo obedecer ao prompt e não escrever marcador, a lista some e só a linha "searched: …" do app fica acima de uma resposta que não usou a busca. Sugestão para decidir: tratar como seguimento também a mensagem curta, sem escopo explícito, sem data e sem "again/refresh", que aponta um item ("the second one", "o 2º", "[W3]", "this one").
- **S2. A janela mantida herda o rótulo "asked in your message".** Depois de "since 01/08", a mensagem seguinte no mesmo escopo e no mesmo dia ("What's new?") reaproveita a janela pedida, e a linha do app e o contexto dizem "(asked in your message; same window…)", embora essa mensagem não tenha pedido. Pode ser o efeito desejado (a janela não encolhe), mas o rótulo engana.
- **S3. Cabeçalhos de seção órfãos.** O `finalizeAgentItems` tira as linhas de lista com marcador desconhecido ou acima do teto, mas deixa o cabeçalho (`**News**`) quando todas as linhas da seção saem. Fica só na exibição.
- **S4. Artigo com data futura no Radar.** A busca do OpenAlex usa `from_publication_date` sem `to_publication_date`. Obras com `publication_date` futura (número de revista do ano seguinte) entram como "New papers", enquanto o filtro web descarta data depois de hoje.
- **S5. Limite de 300 tokens do `librarian_decide`.** Com o `deepseek/deepseek-chat` (sem raciocínio), 9 consultas de até 8 termos com prefixo cabem em cerca de 150 a 200 tokens, e JSON indentado reduz a margem. Se o modelo for trocado por um que raciocina, a resposta corta, o parse falha e o Radar cai na reserva, sem avançar a data (falha segura). Não precisa mudar agora; subir para 400 é barato.

---

## O que foi conferido e está correto

**Fim do turno e data do escopo:**
- `onDone` só existe com busca bem-sucedida vinda do plano (`searched.length === 0` e `reserve` ficam sem `onDone`);
- o gancho só roda no done final, com texto finalizado não vazio;
- `failOnAssistant`, `onOpenRouterError`, `cancel`, o tool call sem handler e o início de cada `send()` zeram o `agentDoneRef`, e o Stop durante o `buildContext` sai antes de gravá-lo;
- não achei corrida que grave data errada: todas as escritas são `max(registrada lida, hoje)`, e entre janelas o pior caso é duas escritas do mesmo dia;
- a exceção são os achados 1 e 2.

**Seguimento:**
- `isFollowUp` exclui a mensagem padrão e os pedidos de refazer, e só aceita `skip`/`reuse` sem escopo explícito e sem janela pedida;
- `previousAgentRun` ignora respostas com falha ou paradas e as de outro agente;
- a regra do mesmo dia está no `keptWindow`;
- `requestedWindow` limita a janela a 90 dias e `recordedDate` nunca recua.

**Tetos e cancelamento:**
- até 3 consultas por tipo no Radar (6 no Tavily e 3 no OpenAlex, também na reserva), até 3 no `/since` e no máximo 8 itens no `finalizeAgentItems`;
- o `signal` chega ao `fetch` do Tavily e do OpenAlex, com `throwIfAborted` depois do planejador e depois das buscas;
- o `/since` não recebe `signal`, como os outros comandos de slash, que não têm cancelamento no preparo.

**Privacidade:**
- as buscas só recebem consultas que passaram por `cleanQueries`;
- o mapa de foco e a nota do `/since` vão só ao modelo;
- a reserva usa nome do escopo, tags e Follow;
- `messageSubject` usa só a mensagem;
- o `/since` não tem consulta de reserva.

**Itens sem invenção:**
- a lista e os prefixos vêm do payload;
- marcador desconhecido some (`mapMarkers`);
- o payload é podado aos citados e sem trecho no done.

**Regressão:**
- `responseCommandText` é idêntico à fórmula antiga para todo comando que não é o `/since` (os quatro pontos que montavam a chave usam a função, e não sobrou outro). Notas antigas não mudam de marca;
- `webSearch` sem `opts` envia o mesmo body (coberto em `search.test.ts`);
- o Tutor manteve a lógica byte a byte;
- `findAiFolder` e `registerAiSourcesFolder` são extrações sem mudança;
- só o Radar e o Papers têm `webPipeline`. O retorno antecipado depois do `buildContext` com Stop vale para todos os agentes de chat, mas só antecipa um retorno que já acontecia na linha 4433.

**Storage:** `ensureRadarStateTable` com `CREATE TABLE IF NOT EXISTS` dentro de `serialDdl` (sem `ensure*` aninhado), memoizado com nova tentativa, UPSERT sem `BEGIN`/`COMMIT`, colunas explícitas e stub no `BrowserStorage`.

**Rust:**
- os prompts `radar`, `papers` e `since` pedem só termos, sem texto de nota nem datas;
- `kind` desconhecido devolve lista vazia;
- falha de rede ou de parse devolve lista vazia;
- os comandos da chave seguem o padrão do Tavily (arquivo `openalex_key` por `save_key`/`read_key`/`clear_key`, `get_*` como o `get_tavily_key`).

**Regras do projeto:** textos novos em inglês, sem emoji; nada roda em background; não achei código morto na frente.

**Testes:**
- nenhum teste faz rede (`fetch` e `invoke` simulados);
- a lógica pura está bem coberta (janela, seguimento, reserva, cópia do mapa de foco, tetos, Stop no pipeline, data que não recua, `responseCommandText`);
- **não há teste** do fim de turno no `useChat` (done, Stop, erro, ramo `memoryOnly`, finalização) nem do ramo `'since'` do `handleCommand`, justamente onde estão os achados 1 e 2.

---

## Veredicto
Veredicto: APROVADO COM RESSALVAS

A lógica pura do Radar e do `/since` está correta e bem testada. Antes do merge, dois finais de turno precisam passar pela mesma finalização do done: o turno que termina pela tool de memória (hoje mostra candidatos não escolhidos) e a resposta parada ou com erro (hoje guarda todos os candidatos). Também precisa ser corrigida a janela que encolhe ao voltar a um escopo já consultado na mesma conversa.

---

## Bugs extras
Nenhum no código lido para esta revisão.
