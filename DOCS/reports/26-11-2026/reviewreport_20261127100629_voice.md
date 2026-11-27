# Review Report: voz e player (entrega 1B e Settings › Language)

- Task Report: `DOCS/reports/26-11-2026/taskreport_20261126233242.md`
- Execution Report: `DOCS/reports/26-11-2026/executionreport_20261126233242.md`
- Plano: `DOCS/reports/26-11-2026/planreport_20261127000656.md` (Apêndices A.1, A.2, A.5 e F)
- Branch `feat/language-study`, sem commit, sobre `43a9ae8`
- Área desta revisão: `src-tauri/src/speech.rs`; o diff de `src-tauri/src/lib.rs`, `src-tauri/src/mincer/mod.rs`, `src-tauri/Cargo.toml` e `src-tauri/Cargo.lock`; `src/lib/{speech,ttsCost,voiceTest,listenQueue,sentences,pdfText,languageSettings}.ts`; `src/hooks/{useListenPlayer,useTtsCatalog,useLanguageSettings}.ts`; `src/components/LanguageTools/{MiniPlayer,VoiceModelPicker}` (tsx e css); `src/components/Settings/LanguageSettings` (tsx e css); os trechos de Listen, "Listen to page", mini-player e atalhos de voz em `Reader.tsx` e `EpubReader.tsx`; os testes desses arquivos.
- Não executei o app, não li a chave e não fiz chamada paga. As suítes não foram rodadas de novo (o Orquestrador já tinha conferido `tsc`, `npm test` e `test:rust`).

## 1. Contrato com o OpenRouter: o que confirmei e o que continua suposição

Consultei sem chave, em 2026-11-27, os dois catálogos públicos (resposta real salva no scratchpad) e a documentação oficial: a [referência do `POST /audio/speech`](https://www.openrouter.ai/docs/api/api-reference/tts/create-speech.md) e o [guia de TTS](https://openrouter.ai/docs/guides/overview/multimodal/tts.md).

**Confirmado:**
- Os dois GET respondem 200, `application/json`, sem `Authorization`.
- `GET /api/v1/models?output_modalities=speech` traz 43 modelos com `id`, `name`, `pricing.prompt` e `pricing.completion` em texto, e `supported_voices` como lista de strings. É o que `parse_catalog` lê.
- `GET /api/v1/audio/speech/models` traz 39 modelos com `output_modalities[type=speech].supported_parameters`. Nele, `voice` vem como `{type:"enum", values:[strings]}` ou `{type:"unknown"}`, `response_format` como `{type:"enum", values}` e `speed` como `{type:"range", min, max}`. É o que `speech_params` lê.
- O corpo `{model, input, response_format, voice?}` está correto. `model` e `input` são os obrigatórios, `response_format` aceita `mp3|pcm|wav` (padrão `pcm`), e não mandar `speed` está certo: alguns modelos devolvem 400 com valor diferente do padrão.
- O 2xx vem como áudio cru (`output_delivery` padrão `stream`). O `Content-Type` é `audio/mpeg` para mp3, `audio/pcm` para pcm ("16-bit little-endian") e `audio/wav` para wav.
- O erro vem como `{"error":{"code","message","metadata"}}`, que é o que `error_detail` lê. Os códigos documentados são 400, 401, 402, 403, 404, 413, 429, 500, 502, 503, 524 e 529, os mesmos que `speech_error` mapeia.
- Formatos por modelo, conferidos no catálogo real:
  - Gemini (4 modelos) só aceita `pcm`/`wav`, e a doc confirma que wav é "24 kHz mono". O padrão `google/gemini-3.8-flash-tts` vai em `wav`, o caminho mais seguro.
  - HeyGen só aceita `pcm`.
  - Todos os outros do segundo endereço aceitam `mp3`.
- Voz: a doc diz que só Seed Audio, HeyGen, Fish Audio, AssemblyAI e Speechify aceitam pedido sem `voice`. Fish e Seed Audio são justamente os que vêm com `voice.type = "unknown"`, então mandar sem voz nesses casos está certo.
- O CSP (`default-src 'self' blob:`, sem `media-src`) deixa o `<audio>` tocar `blob:`.

**Não confirmado (continua suposição até a primeira chamada real):**
- Se o `Content-Type` do PCM traz `rate=`. A doc só diz `audio/pcm`. Dá a taxa de dois provedores (HeyGen a 44,1 kHz, MAI a 24 kHz) e não dá a dos outros.
- Se o WAV do Gemini vem com tamanhos provisórios no cabeçalho. O código trata os dois casos.
- O formato real dos bytes do MP3. O medidor de duração foi testado só com frames sintéticos.
- Se o custo do Gemini é mesmo por token de texto mais token de áudio a 25 tokens/s, que é a premissa do `ttsCost`.
- Se um cancelamento no meio do pedido é cobrado.

O que a resposta real mostra **contra** o código está nos achados I1 e I2.

## 2. Achados

### I1 [importante] Modelo sem formato conhecido cai em PCM a 24 kHz: áudio lento e grave que passa na checagem e fica no cache
- **Onde:**
  - `src-tauri/src/speech.rs:177-186` (`choose_format`, que devolve `pcm` quando não há formato);
  - `:615-635` (`model_formats` procura o id exato);
  - `:222-236` (`pcm_rate_from_content_type`, que usa 24 kHz quando não há taxa);
  - `:873-880` (checagem de duração).
- **Cenário:** no catálogo real, quatro ids estão só no primeiro endereço e por isso ficam com `formats` vazio: `heygen/heygen-voice-1-turbo:free`, `fish-audio/s2.1-pro-free:free`, `minimax/speech-2.8-hd` e `minimax/speech-2.8-turbo`. Para eles `choose_format` devolve `pcm`. Os dois HeyGen pagos também só têm `pcm`.
  - O guia diz que o PCM do HeyGen sai a 44,1 kHz. A taxa do Fish e do MiniMax não está documentada.
  - Se o `Content-Type` for só `audio/pcm`, como diz a doc, o WAV montado declara 24 kHz. O áudio toca 1,84 vezes mais lento, com a voz grave.
  - A checagem de duração **não** recusa esse áudio. Uma frase de 100 caracteres a 15 caracteres/s dura cerca de 6,7 s e passa a medir cerca de 12,3 s, enquanto o teto é `100/4 + 5 = 30 s`.
  - O áudio então toca, conta uso e é convertido pelo ffmpeg num mp3 lento que fica no cache para sempre. Só "Clear saved audio" desfaz.
  - Os dois modelos `:free` são os mais prováveis de escolher para um primeiro teste barato.
- **Discordância com decisão aceita:** a parte do HeyGen é o ponto F.3 do plano e o ponto 3 da seção 7 do roteiro. A premissa registrada lá ("a checagem de duração tende a recusar") não se sustenta pela conta acima. Os casos `:free` e MiniMax não estão cobertos pela decisão.
- **Sugestão:**
  - Sem formatos, procurar o id sem o sufixo `:…` (`heygen/heygen-voice-1-turbo` e `fish-audio/s2.1-pro` estão no segundo endereço) e, não achando, usar `mp3`. Pela doc, só Gemini e HeyGen recusam mp3, e os dois estão no catálogo com formatos.
  - Para PCM sem `rate=`, usar uma tabela mínima por provedor (`heygen/` a 44.100 Hz) em vez de 24 kHz para todos.

### I2 [importante] A voz padrão de um modelo é a primeira da lista, que pode ser de outra língua
- **Onde:** `src/lib/ttsCost.ts:66-69` (`voiceFor`), usada por `resolveVoice` no player (`useListenPlayer.ts:215`, `:465`) e por `VoiceModelPicker.tsx:44-49`.
- **Cenário:** com um livro em francês, o usuário troca para `microsoft/mai-voice-2.1-flash`. A primeira voz do catálogo real é `cs-CZ-Grant:MAI-Voice-2.1-Flash`, e o guia diz que no Azure "o locale da voz define a língua". O francês sai lido com a voz e a pronúncia tchecas.
  - Acontece o mesmo com `deepgram/aura-2`, cuja primeira voz é `aura-2-thalia-en` (as francesas são `aura-2-agathe-fr` e `aura-2-hector-fr`).
  - E com `hexgrad/kokoro-82m`, cuja primeira é `af_alloy` (inglês americano), e com `mistralai/voxtral-mini-tts-3-0`, cuja primeira é `voice_3150` (há `fr_marie_*`).
  - A voz é lembrada por modelo, não por língua. Quem lê um livro em francês e outro em inglês com o MAI ouve um dos dois na voz errada.
  - Para uma ferramenta de estudo de língua, é pronúncia errada servida como modelo. O Gemini, que é o padrão, escapa porque as vozes dele não têm língua.
- **Sugestão:** sem voz salva, preferir a voz cujo nome traz a língua do livro (`fr-FR-`, `-fr`, `fr_`, `ff_`), e só então a primeira. No seletor, pôr as vozes da língua do livro primeiro. Ou ao menos lembrar a voz por modelo **e** por língua.

### I3 [importante] Dois áudios tocam juntos: o Listen de um item ou de uma palavra guardada não pausa o player
- **Onde:**
  - `src/hooks/useListenPlayer.ts:455-496` (`speakOnce` usa outro `<audio>` e não toca no player);
  - `Reader.tsx:2674` (`onListenItem` da aba Vocabulary) e o `SavedWordPopover`, ligado em `onListen={speakOnce}` em `Reader.tsx` (bloco das linhas 3125-3190), cuja abertura (`openSavedWord`, `:2046`) não pausa o player;
  - o mesmo em `EpubReader.tsx:2167` e nos `onListen={speakOnce}` das linhas 2585-2635.
- **Cenário:** com o player lendo a página, o usuário clica no alto-falante de um item da aba Vocabulary, ou no Listen do popover de uma palavra marcada no texto. As duas vozes saem ao mesmo tempo. Só o Translate pausa o player (`player.pause('translate')`).
  - O contrário também acontece: um `speakOnce` em curso não para quando o player começa (`play` não chama `stopOnce`).
  - O passo 3.6 do roteiro só olha o popover do Translate, que já pausa, e por isso não pega o caso.
- **Sugestão:** `speakOnce` pausar o player (por exemplo `engine.pause('translate')` no começo) e `play` chamar `stopOnce()`.

### I4 [importante] "Next", "Back" e "Repeat" para uma frase ainda não gerada não calam a frase atual
- **Onde:** `src/hooks/useListenPlayer.ts:255-266` (`startCurrent`), chamado por `goTo` (`:290-296`).
- **Cenário:** a frase 3 está tocando e a 5 ainda está em `loading`. O usuário aperta Next duas vezes, ou Shift+→ duas vezes. `goTo(5)` faz commit de `preparing`, mas não chama `audio.pause()`, e a frase 3 continua tocando até a 5 chegar ou até a 3 acabar. O `ended` é ignorado porque o status já é `preparing`.
  - O mesmo vale para ir a uma frase em `error`: a mensagem de erro aparece com a frase anterior ainda soando.
  - O usuário ouve a frase que pediu para pular com o rótulo "Preparing audio…".
  - O teste "next, prev and repeat jump and play" só cobre frases já prontas.
- **Sugestão:** em `startCurrent`, pausar o elemento nos ramos `preparing` e `error`. Um teste com a frase de destino em `loading` deve exigir `audio().paused === true`.

### I5 [importante] Os testes não pegam o que mais tende a falhar no primeiro uso
- **Rust:** os 31 testes de `speech.rs` são de funções puras. Nenhum exercita a ordem de `tts_speak`:
  - formato pelo catálogo, depois PCM para WAV, depois duração, uso e cache;
  - o 2xx que não é áudio (`request_once`, `:667-678`);
  - o retry com cancelamento;
  - a escolha de formato com `formats` vazio para os ids reais (I1).

  Ao menos `choose_format` junto com `parse_catalog` deveria rodar sobre uma cópia do catálogo real (os quatro ids sem formato). E falta um teste que mostre que um PCM de 44,1 kHz lido a 24 kHz passa em `duration_plausible`, que é exatamente o caso I1.
- **Front:** `useListenPlayer.test.ts` cobre bem a máquina de estados no caminho feliz e nos erros. Ficam de fora:
  - a navegação para uma frase não pronta (I4);
  - o `speakOnce` concorrendo com o player (I3);
  - o `play()` rejeitado com `NotAllowedError`.

  `pdfText.test.ts` usa só linhas sintéticas, e os riscos do N4 não têm caso.

### N1 [nit] Estimativa de custo errada para modelo cobrado por segundo
- **Onde:** `src/lib/ttsCost.ts:16-31`, `:44-48`.
- **Cenário:** `bytedance-seed/seed-audio-1-0` tem `prompt: "0"` e `completion: "0.0025"`. O guia diz que os modelos por segundo põem o preço por segundo em `completion`. O código trata o valor como preço por token de áudio (25 tokens/s): o seletor mostra "$0.00 / 1M text tokens · $2500.00 / 1M audio tokens", e a página sai por cerca de US$ 9,00 em vez de cerca de US$ 0,36, 25 vezes mais.
- **Sugestão:** `promptPrice === 0 && completionPrice > 0` como "por segundo": `chars × 0,06 × completionPrice`, com o rótulo "/ second". Ou "Price not published" nesse caso.
- Os modelos `:free` (os dois preços zerados) aparecem como "Price not published", quando são grátis. Também é nit.

### N2 [nit] Catálogo que falha deixa o primeiro pedido sem voz, e o Gemini recusa
- **Onde:** `useTtsCatalog.ts:42-57` (não tenta de novo enquanto o leitor está aberto) e `ttsCost.ts:73-76` (sem catálogo, a voz salva, que é `null` no primeiro uso).
- **Cenário:** no primeiro uso, um dos dois GET falha de forma passageira e não há `catalog.json`. O player pede ao Gemini sem `voice`, recebe 400 e mostra "This voice model didn't accept the request" com "Change voice model", que também está vazio. A doc diz que o Gemini exige voz.
- **Sugestão:** no Rust, quando `voice` é `None` e o catálogo conhecido tem vozes para o modelo, usar a primeira (com a regra de língua do I2). Ou o hook tentar de novo ao abrir o menu ⋯.

### N3 [nit] Áudio cancelado no meio já foi cobrado, mas é jogado fora e não entra no uso
- **Onde:** `speech.rs:845-855`.
- **Cenário:** "Next" ou "Close" com duas frases em voo. O `select!` derruba a conexão depois de o provedor já ter gerado o áudio, provavelmente cobrado (não confirmado). O áudio não vai ao cache e não entra em `usage.json`, então o custo do mês fica abaixo do real.
- É coerente com o plano A.1, passo 5, por isso está como observação. Deixar o pedido em voo terminar e gravar no cache, ignorando só no front, custa o mesmo e evita pagar duas vezes depois.

### N4 [nit] Riscos da limpeza de cabeçalho e rodapé do "Listen to page"
- **Onde:** `src/lib/pdfText.ts:71`, `:85-111`; `Reader.tsx:825`.
- `PAGE_NUMBER` aceita qualquer palavra feita só de letras de algarismo romano, como "dix", "mid", "civil" ou "vivid". Uma linha curta assim, no topo ou embaixo, sai como "page number".
- O cabeçalho é sempre a primeira linha curta (até 80 caracteres) dos 8% de cima, sem conferir se ela se repete nas páginas vizinhas. Em PDF de margem estreita, ou numa abertura de capítulo, a primeira linha do corpo ou o título saem com o aviso "page header".
- Com o número de página no topo, a última linha do corpo nos 8% de baixo, quando é curta e para no meio da frase, sai como "page footer".
- `pageHeight` vem de `getViewport({scale:1}).height`, que troca altura e largura em página com `/Rotate 90`, enquanto o `transform[5]` fica no espaço sem rotação. Uma `MediaBox` que não começa em 0 desloca as faixas.
- O passo 1 do roteiro (PDF real, de ouvido) deve pegar o caso comum. Fica o registro para quando aparecer.

### N5 [nit] Espaço e R do player capturados enquanto um modal está aberto sobre o leitor
- **Onde:** `Reader.tsx:1438-1455`, `EpubReader.tsx:694-711`.
- **Cenário:** com o player aberto, o usuário abre Settings › Language pelo menu ⋯ ("Language settings…"), põe o foco no botão "Test voice" e aperta Espaço. O `preventDefault` do leitor impede o botão e alterna o player que está atrás.
  - O mesmo acontece com qualquer botão de modal, já que o filtro só exclui `INPUT`, `TEXTAREA`, `SELECT` e `contentEditable`.
  - As setas já tinham esse comportamento antes, então é um padrão antigo. Mas o Espaço numa tecla de botão é novo.

### N6 [nit] O menu ⋯ do mini-player fica efetivamente em z-index 900
- **Onde:** `MiniPlayer.module.css:8` e `:224`.
- O `.menu` declara `z-index: 1100`, mas está dentro do `.player` `fixed` com `z-index: 900`, que cria contexto de empilhamento. Na prática, o menu fica abaixo dos popovers (1100) e do toast (1100). A regra da casa pede popover acima de 1000.
- Hoje o clique fora fecha o menu, então o efeito é pequeno.

### N7 [nit] Código e dados mortos
- `TtsModel.speed_range` / `speedRange` é extraído, serializado e testado no Rust (`speech.rs:45`, `:113-117`), mas nada no front lê: a velocidade é do player. `formats` também vai ao front sem uso lá.
- `PdfTextItem.x` (`pdfText.ts:9`) é preenchido em `Reader.tsx` e nunca lido.
- A regra da casa é remover. Se ficar por contrato (A.1), vale um comentário dizendo que é de propósito.

### N8 [nit] A virada de página no EPUB compara medidas diferentes
- **Onde:** `EpubReader.tsx:1394` (`page = pageOfCfi(cfiRange)`) contra `:878-881` (`pageNum` é a location do início da tela) e o efeito `:1210-1214`.
- **Cenário:** a tela mostra as locations 10 e 11, e a seleção está na 11. Virando a página, o início passa a ser a 11, igual à `source.page`, e o áudio não pausa, mesmo com o trecho fora da tela.
- E um `relocated` por redimensionamento (abrir ou fechar coluna) que mude a location do início pausa o áudio sem virada.

### N9 [nit] "Clear saved audio" durante uma conversão gasta o único aviso
- **Onde:** `speech.rs:723-755`, `:708-719`.
- **Cenário:** `tts_clear_all` apaga a pasta do livro enquanto o ffmpeg converte. O `rename` falha, `warn_once` mostra "Audio can't be saved on this device…", que é falso, e queima o único aviso da execução. Uma falha real depois (ffmpeg ausente) fica sem aviso.

## 3. Avaliação por categoria (só o que não está nos achados)

- **Correção:**
  - `speech.rs` está sólido no caminho padrão (Gemini em `wav`). O que cobre bem:
    - correção do WAV com tamanhos provisórios antes de medir e de converter;
    - leitura do MP3 pulando o ID3 (a saída do ffmpeg começa com ID3, e o `sniffAudioMime` a reconhece);
    - escrita atômica;
    - uso sob lock;
    - cancelamento registrado já na entrada;
    - retry só para 429, 5xx e erro de rede;
    - `CancelGuard` limpando o mapa em qualquer saída.
  - A IPC usa camelCase (`requestId`, `bookId`) contra snake_case no Rust, que o Tauri v2 converte. `tauri::ipc::Response` segue o mesmo caminho de `books.rs`.
  - `planPrefetch` e a máquina de estados estão corretos fora do I3 e do I4.
- **Simplicidade:** nada a reportar além do N7.
- **Efeitos colaterais:** `sidecar` e `is_valid_model_id` passaram a `pub(crate)`, sem mudança de comportamento. O `Cargo.lock` só ganhou a linha `sha2`, que já era transitiva. O CSP não mudou.
- **Padrões:** segue o `mincer` (erro com a frase do leitor mais o detalhe depois de "\n\n", cliente `reqwest` próprio, cabeçalhos `HTTP-Referer`/`X-Title` como no resto do `lib.rs`). Os ícones são Phosphor e o texto de UI está em inglês. Não há banco nem `BEGIN/COMMIT`. Não há flashcards, contadores nem estado de palavra.
- **Segurança:**
  - A chave fica no Rust (`read_key`) e não vai ao front.
  - `book_id` é validado antes de virar pasta (`valid_book_id`), e `model` passa por `is_valid_model_id`.
  - Os GET públicos vão sem `Authorization`.
  - O texto vai ao OpenRouter, como pede a feature.
  - Nada a reportar.
- **Organização:** a separação entre engine e hook (`createListenEngine` fora do React) é boa e testável. `ttsErrorActions` mora em `speech.ts`, compartilhado pelo player e pelo Settings.

## 4. Bugs extras (fora do escopo, em código lido)

Nenhum.

## Veredicto

Veredicto: APROVADO COM RESSALVAS

O caminho padrão (Gemini em wav, cache em mp3 pelo ffmpeg) bate com a documentação e com o catálogo real. Antes do primeiro uso, convém corrigir o I1 (PCM a 24 kHz para modelos sem formato, áudio lento gravado no cache), o I2 (voz padrão de outra língua), o I3 (dois áudios juntos) e o I4 (Next não cala a frase atual).

Contagem: 0 críticos, 5 importantes (I1 a I5), 9 nits (N1 a N9). Uma discordância com decisão aceita está marcada no I1 (F.3 e ponto 3 da seção 7).

---

### Bloco para o Execution Report (registrado pelo Orquestrador)

```md
### CodeReviewAgent (voz e player) — 20261127100629
- Summary: Revisão da voz e do player (speech.rs, front de voz, Settings › Language, ligação de Listen nos dois leitores), conferida contra a documentação oficial do OpenRouter e a resposta real dos dois catálogos públicos, sem chave. Confirmados: o corpo do pedido, o áudio cru no 2xx, o Content-Type por formato, o formato do erro e dos catálogos; o padrão Gemini vai em wav. Achados: (I1) quatro ids do catálogo sem formato conhecido (dois `:free` e dois MiniMax) e o HeyGen caem em PCM lido a 24 kHz, então o áudio sai lento, passa na checagem de duração e fica no cache (a premissa da decisão F.3 não se sustenta); (I2) a voz padrão é a primeira da lista, que no MAI é tcheca e no Deepgram e no Kokoro é inglesa; (I3) o Listen de item ou de palavra guardada toca por cima do player; (I4) Next/Back para uma frase não pronta não cala a frase atual; (I5) faltam testes do fluxo de tts_speak e desses casos. Mais 9 nits.
- Verdict: APROVADO COM RESSALVAS
- Output: DOCS/reports/26-11-2026/reviewreport_20261127100629_voice.md
```
