# Explorer Report — voz (TTS), tradução e dicionário: provedor, custo e qualidade

Pesquisa externa (web) para o estudo "Library para estudo de línguas". Cobre o R2 (provedor, custo e qualidade) e a parte de modelo do R3 do Task Report `taskreport_20261126134217.md`. Tudo foi consultado em **2026-11-26**; os números entre colchetes apontam para as fontes no fim. Nenhuma chave de API foi usada.

## Problema

O app quer ler em voz alta livros em língua estrangeira (exemplo: francês) para quem está aprendendo, com pronúncia clara e próxima da humana, e traduzir ou explicar trechos. Hoje só existe a chave do OpenRouter. A pergunta é se o OpenRouter resolve a voz com qualidade ou se é preciso um provedor direto (segunda chave), e quanto isso custa por página, por hora e por livro.

## Resposta curta

- **A hipótese "o OpenRouter resolve" se sustenta.** Existe endpoint dedicado, `POST https://openrouter.ai/api/v1/audio/speech`, compatível com o da OpenAI [1][2]. O catálogo público lista 43 modelos de fala [4], entre eles dois dos três mais bem colocados em francês em arena com votantes nativos (ElevenLabs v4 Turbo e Gemini 3.8 Flash TTS) [20].
- **O que o OpenRouter não entrega: timestamps.** A resposta é só o áudio; não há tempo por palavra nem por frase [2]. Dá para contornar gerando **uma frase por requisição** (cada arquivo é uma frase, então marcar a frase no texto não depende de timestamp). Marcar palavra por palavra exigiria provedor direto (ElevenLabs ou Cartesia).
- **Recomendação**: principal `google/gemini-3.8-flash-tts` pelo OpenRouter (cerca de US$ 0,82 por hora, US$ 8 por livro de 300 páginas; o preço do Google dobra em 2027-01-01). Reserva `elevenlabs/eleven-v4-turbo`, também pelo OpenRouter (US$ 2,40 por hora, US$ 24 por livro). Segunda chave não é necessária agora.
- **Antes de decidir, ouvir.** As arenas medem preferência, não acerto de pronúncia. A seção 8 traz um parágrafo de teste em francês com as armadilhas típicas e o roteiro de comparação.
- **Dificuldade (parte de provedor): Baixa.** É mais uma chamada do mesmo tipo das que o backend já faz. O trabalho está no leitor (segmentar frases, fila, cache, player), que é assunto do relatório de código.

## 1. Premissas de conversão

- 1.000 caracteres ≈ 1 minuto de áudio (a ElevenLabs usa essa equivalência: 5.000 caracteres ≈ 5 min) [10]. Logo: **1 hora ≈ 60 mil caracteres**; **página de 2.000 caracteres ≈ 2 minutos**; **livro de 300 páginas (600 mil caracteres) ≈ 10 horas**.
- Modelos cobrados por token de áudio (Gemini): 25 tokens por segundo de áudio [12], ou 90 mil tokens por hora. Texto de entrada a 4 caracteres por token (estimativa minha).
- OpenAI: 1 token a cada 50 ms de áudio de saída, 1.200 tokens por minuto [9].
- Quem cobra por caractere custa o mesmo em qualquer velocidade. Quem cobra por tempo de áudio (Gemini) fica mais caro se o modelo falar devagar: pedir "fale 20% mais lento" ao modelo aumenta a conta em cerca de 25%. Reduzir a velocidade no player não custa nada.

## 2. OpenRouter para voz, hoje

**Endpoint**: `POST /api/v1/audio/speech`, anunciado em 2026-05-01 [3]. Campos: `model`, `input`, `voice`, `response_format` (`mp3`, `pcm` ou `wav`; o padrão é `pcm`), `speed`, `instructions`, `output_delivery` (`stream`, padrão, ou `url`), `provider` [1][2]. A resposta é um fluxo de bytes de áudio, então o som pode começar antes de terminar a geração. **Não há campo de timestamps** [2]. A própria documentação recomenda dividir textos longos em trechos e concatenar [1].

**Consultas que funcionaram (sem chave)**:
- `GET https://openrouter.ai/api/v1/models?output_modalities=speech` → 43 modelos, com preço e lista de vozes [4].
- `GET https://openrouter.ai/api/v1/audio/speech/models` → 39 modelos com formatos, faixa de `speed` e se aceitam `instructions` [5]. Um modelo só: `GET /api/v1/audio/speech/models/{autor}/{slug}`.
- `output_modalities=tts` devolve erro 400 com os valores válidos: `text, image, embeddings, audio, video, rerank, decisions, speech, transcription, all`.

**Modelos que interessam para francês** (dados de [4] e [5]):

| Modelo no OpenRouter | Preço | Vozes | Formatos | `speed` | Estilo | Limite por requisição |
| --- | --- | --- | --- | --- | --- | --- |
| `google/gemini-3.8-flash-tts` | US$ 0,50/M tokens de texto + US$ 9/M tokens de áudio | 30, sem língua fixa (detecta a língua; 130+ línguas [13]) | pcm, wav (mp3 recusado) | não | `instructions` ("fale devagar") | 8.192 tokens de entrada; 16.384 de saída ≈ 10,9 min de áudio |
| `google/gemini-3.8-flash-lite-tts` | US$ 0,50/M + US$ 6/M | 30 (100+ línguas [13]) | pcm, wav | não | `instructions` | igual |
| `elevenlabs/eleven-v4-turbo` | US$ 40/M caracteres | 21 vozes padrão (george, sarah, alice...); 90+ línguas | mp3, pcm | não | tags no texto, `voice_settings` | não confirmado |
| `elevenlabs/eleven-v4` | US$ 80/M | 21 | mp3, pcm | não | tags | 10.000 caracteres (descrição no OpenRouter; a doc da ElevenLabs diz 100.000 [10]) |
| `elevenlabs/eleven-multilingual-v2` | US$ 80/M | 21; 29 línguas | mp3, pcm | 0,7–1,2 | — | 10.000 caracteres |
| `elevenlabs/eleven-flash-v2.5` | US$ 40/M | 21; 32 línguas | mp3, pcm | 0,7–1,2 | — | 40.000 caracteres |
| `mistralai/voxtral-mini-tts-3-0` | US$ 13/M | 66; francesa nativa `fr_marie_*` (6 emoções) | mp3, pcm | não | voz por emoção | cerca de 2 min de áudio por geração [15] |
| `microsoft/mai-voice-2.1` | US$ 22/M | 97; `fr-FR-Marc`, `fr-FR-Soleil`, `fr-FR-Grant`, `fr-FR-Harper` | mp3, pcm | **0,5–2** | — | não confirmado |
| `microsoft/mai-voice-2.1-flash` | US$ 15/M | as mesmas | mp3, pcm | 0,5–2 | — | não confirmado |
| `hexgrad/kokoro-82m` | US$ 0,99/M | 54; uma francesa (`ff_siwis`) | mp3, pcm | 0,25–4 | — | 4.096 tokens |
| `speechify/simba-3.5` | US$ 11,25/M | 20; 48 línguas | mp3, pcm | 0,5–2 | — | não confirmado |

Também listados, sem peso para a decisão: Seed-TTS 3.0 (US$ 20/M, 4 vozes francesas, entrou em 2026-11-25), Deepgram Aura-2 (US$ 30/M, 2 vozes francesas), Fish Audio, Qwen, MiniMax, HeyGen, AssemblyAI, Grok Voice, Orpheus e Sesame (os dois últimos são de inglês). Há duas variantes gratuitas (`heygen/heygen-voice-1-turbo:free` e `fish-audio/s2.1-pro-free:free`), francês não confirmado.

**Pontos de atenção no OpenRouter**:
- **OpenAI não está no catálogo.** `gpt-4o-mini-tts` foi anunciado lá em maio [3], mas hoje a consulta devolve 404 [5]. Na OpenAI, `gpt-4o-mini-tts`, `tts-1` e `tts-1-hd` têm desligamento marcado para **2027-01-06** [8]. Não vale construir em cima deles.
- **Gemini só sai em PCM ou WAV** pelo OpenRouter [1]. PCM de 24 kHz ocupa cerca de 173 MB por hora; para o cache em disco é preciso comprimir (o ffmpeg já empacotado resolve; em MP3 de 64 kbps, um livro de 10 horas fica perto de 290 MB).
- **ElevenLabs só com as 21 vozes padrão.** O catálogo lista um conjunto fechado; não confirmei se aceita o ID de uma voz francesa da biblioteca da ElevenLabs. As vozes padrão falam francês, mas a ElevenLabs diz que cada voz mantém o sotaque de origem entre línguas [11]. É o que mais precisa ser ouvido.
- **`speed` não é universal**: Gemini, Voxtral e ElevenLabs v4 não aceitam; quem não aceita devolve erro 400 para valor diferente do padrão [1].
- **Preço do Gemini 3.8 TTS dobra em 2027-01-01** na tabela do Google (áudio de US$ 9 para US$ 18 por milhão de tokens; Flash-Lite de US$ 6 para US$ 12) [12]. O OpenRouter repassa o preço do provedor sem acréscimo, então é provável que acompanhe (não confirmado).

**Modelos de chat com saída de áudio** (`modalities: ["text","audio"]`): a consulta `output_modalities=audio` devolve só `openai/gpt-audio`, `openai/gpt-audio-mini` e dois modelos de música [6]. **Não servem para leitura literal.** O áudio é a resposta de um modelo de conversa: nada no contrato garante que ele repita o texto palavra por palavra, sem resumir, pular ou comentar (a OpenAI descreve esse caminho como áudio dentro de um app de chat e aponta o endpoint de fala para narração [7]). Além disso exigem streaming em `pcm16` [6], a saída é limitada a 16.384 tokens (cerca de 13 minutos) e os dois modelos têm desligamento marcado na OpenAI para 2027-01-20 [8]. Custo pela tabela da OpenAI: `gpt-audio-mini` US$ 20/M tokens de áudio ≈ **US$ 0,024 por minuto** (US$ 1,44 por hora); `gpt-audio` US$ 64/M ≈ **US$ 0,077 por minuto** (US$ 4,61 por hora) [7][9]. A API do OpenRouter mostra `audio_output` de US$ 2,40/M para o mini, o que não bate com a OpenAI (não confirmado). Mais caro e menos previsível que o endpoint de fala: descartar.

## 3. Tabela comparativa

Custos calculados com as premissas da seção 1. "Frase" em timestamps quer dizer que dá para marcar a frase gerando uma frase por requisição.

| Provedor / modelo | Onde se acessa | US$ por 1M caracteres | Por hora | Livro de 300 pág. | Francês | Timestamps | Streaming | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gemini 3.8 Flash TTS | **OpenRouter** [4] ou Google direto | ≈ 13,6 (27 em 2027) | 0,82 (1,64) | 8,2 (16,4) | 2º empatado na arena francesa [20]; 7º em inglês [18] | não (frase) | sim | **Principal.** Só PCM/WAV no OpenRouter; sem `speed`; relatos de corte e repetição [24] |
| Gemini 3.8 Flash-Lite TTS | **OpenRouter** [4] | ≈ 9,1 (18 em 2027) | 0,55 (1,10) | 5,5 (11) | 11º em inglês [18]; francês sem dado | não (frase) | sim | Opção econômica da mesma família |
| ElevenLabs v4 Turbo | **OpenRouter** [4] ou direto [10] | 40 | 2,40 | 24 | 1º na arena francesa [20]; 1º em inglês [18] | não no OpenRouter; por caractere no direto [11] | sim | **Reserva.** No OpenRouter só 21 vozes padrão |
| ElevenLabs v4 / Multilingual v2 | **OpenRouter** [4] ou direto | 80 | 4,80 | 48 | v4 2º em inglês [18]; v2 é o "mais estável em texto longo" [10] | idem | sim | Caro para livro inteiro |
| Mistral Voxtral TTS 3 | **OpenRouter** [4] ou Mistral [14] | 13 | 0,78 | 7,8 | voz nativa; 20º em inglês [18]; francês sem dado | não (frase) | sim | Empresa francesa; incluir no teste |
| Microsoft MAI-Voice-2.1 | **OpenRouter** [4] ou Azure | 22 (Flash: 15) | 1,32 (0,90) | 13,2 (9) | vozes nativas; sem dado de arena | não (frase) | sim | Único com `speed` 0,5–2 e MP3; incluir no teste |
| Kokoro 82M | **OpenRouter** [4] ou local | 0,99 | 0,06 | 0,59 | uma voz, nota B- do autor [27] | não (frase) | sim | Quase de graça; qualidade em francês limitada |
| Cartesia Sonic 3.6 | direto (2ª chave) [16] | 39–50 + assinatura | 2,35–3,00 | 23,5–30 | 1º na arena francesa de voz clonada [19]; 2º empatado em [20] | **por palavra** [16] | sim | `speed` 0,6–1,5; planos de US$ 5 a 49 por mês |
| ElevenLabs direto | direto (2ª chave) [10] | 40–80, por assinatura | 2,40–4,80 | 24–48 | igual ao acima, com vozes francesas da biblioteca | **por caractere**, também em streaming [11] | sim | Plano Creator (US$ 22) cobre 550 mil caracteres de v4 Turbo |
| OpenAI `gpt-4o-mini-tts` | direto (2ª chave) [7] | ≈ 14,5 | ≈ 0,87 | ≈ 8,7 | "vozes otimizadas para inglês" [7] | não | sim | **Desligado em 2027-01-06** [8] |
| Azure Speech (Neural / HD) | direto (2ª chave) [17] | 15 / 22 | 0,90 / 1,32 | 9 / 13,2 | muitas vozes fr-FR; sem dado de arena | por palavra, só pelo SDK; em HD a doc se contradiz [17] | sim | 500 mil caracteres grátis por mês [17]; conta Azure |
| Google Cloud Chirp 3 HD | direto (conta Google Cloud) | 30 (fonte secundária [13]) | 1,80 | 18 | não confirmado | não confirmado | sim | Autenticação por conta de serviço; não compensa |
| Inworld Realtime TTS-2 | direto (2ª chave) [16] | 25 (Flash: 15) | 1,50 | 15 | 10º em inglês [18]; francês não confirmado | sim, segundo o site [16] | sim | Não muda a decisão |
| Vozes do Windows (`speechSynthesis`) | local, grátis | 0 | 0 | 0 | vozes antigas (Hortense, Julie, Paul) | eventos de palavra do navegador (não confirmado na WebView2) | — | Só como reserva offline |

## 4. Provedores diretos: o que muda a decisão

- **Preço não muda**: ElevenLabs, Mistral, Google e Microsoft custam no OpenRouter o mesmo que direto [4][10][12][14][17].
- **O que só o direto dá**: (a) timestamps por caractere (ElevenLabs [11]) ou por palavra (Cartesia [16]), para marcar palavra por palavra; (b) vozes francesas nativas da biblioteca da ElevenLabs; (c) o Sonic 3.6 da Cartesia, primeiro em francês na arena de voz clonada da Artificial Analysis (1.349 contra 1.278 do segundo, leitura de setembro, fonte secundária) [19].
- **O que o direto exige**: segunda chave no Settings, mais um cliente no backend e, na ElevenLabs e na Cartesia, assinatura mensal em vez de crédito avulso.
- **Qualidade em francês segundo avaliações independentes**: na Voice Arena (votantes nativos, às cegas), o quadro francês de 2026-10-23 tem Eleven v4 Turbo em 1º (1.065) e Sonic 3.6 e Gemini 3.8 Flash TTS empatados em 2º (1.047). A diferença de 18 pontos equivale a cerca de 52,6% de vitórias: na prática, empate técnico entre os três (fonte secundária; não consegui abrir o quadro original) [20]. No quadro geral da Artificial Analysis, em inglês, lido hoje: v4 Turbo 1.342, v4 1.340, Simba 3.5 1.296, Sonic 3.6 1.295, Gemini 3.8 Flash TTS 1.287, Flash-Lite 1.264, Voxtral 3 1.212 [18].

## 5. Grátis ou local

**(a) `speechSynthesis` na WebView2.** As vozes "Natural" online são do navegador Edge; as vozes naturais do Narrador do Windows 11 não ficam disponíveis para outros programas (o autor do adaptador que tenta expô-las afirma que a Microsoft ainda não liberou e que o contorno pode parar a qualquer atualização) [25]. O levantamento do projeto Readium registra que as vozes naturais do Windows "só aparecem no Edge" e não em outros navegadores Chromium [26]. Não achei fonte primária dizendo o que a WebView2 lista (**não confirmado**; mede-se em dois minutos com `speechSynthesis.getVoices()` no DevTools do app). Nesta máquina, o registro do Windows tem três vozes francesas instaladas, todas da geração antiga: Hortense, Julie e Paul. Servem como reserva offline, não como modelo de pronúncia.

**(b) Modelos locais em CPU.**

| Modelo | Francês | Tamanho | Licença | Como sidecar |
| --- | --- | --- | --- | --- |
| Kokoro 82M | 1 voz (`ff_siwis`), nota B-, menos de 11 h de treino; o autor avisa que o suporte fora do inglês é "fino" [27] | 82M parâmetros; cerca de 80 MB quantizado (ONNX não confirmado) | Apache 2.0; a fonética do francês depende do espeak-ng (GPL) [27] | Viável (ONNX Runtime), mas a versão hospedada custa US$ 0,59 por livro |
| Piper | vozes `siwis`, `upmc`, `tom`; som sintético, abaixo dos modelos de nuvem | 63 MB (média) a 114 MB (alta) por voz [28] | Motor atual é GPL-3.0; o repositório MIT foi arquivado [28] | Viável e leve; a licença pede cuidado |
| Supertonic 3 | incluído entre 31 línguas; normalização de números fraca [29] | 99M parâmetros; cerca de 380 MB em ONNX [29] | Código MIT, pesos OpenRAIL-M [29] | Viável; futuro do projeto incerto (fonte secundária) |
| Chatterbox, Kyutai e similares | não confirmado em CPU | maiores | variadas | Pensados para GPU; fora |

Veredito: o local não compensa. A economia é de centavos por livro e a qualidade em francês fica abaixo do que o aprendiz precisa. Só faria sentido para uso offline.

## 6. Para quem aprende língua

**Erros típicos que atrapalham** (o que as fontes dizem):
- **Liaison**: modelos que leem direto das letras tendem a inserir liaison onde não existe; em teste com ouvintes, a versão guiada por fonemas foi preferida [21].
- **Homógrafos** ("couvent", "fils", "est", "plus"): há estudo dedicado só a desambiguar 34 pares em francês para TTS, sinal de que é erro recorrente [22]. Outro trabalho cita perto de 10% de erros de letra para som em sistemas de ponta a ponta [22].
- **Números, datas e abreviações**: o Flash v2.5 da ElevenLabs vem com normalização de números desligada e pode ler mal datas e valores; o Multilingual v2 lida melhor [10]. O Supertonic lê valores como dígitos soltos [29].
- **Troca de língua no meio do texto**: as vozes multilíngues do Edge não lidam bem com isso [26]. Na ElevenLabs direta existe `language_code` para fixar a língua (não vale para o Multilingual v2) [11]; pelo OpenRouter não confirmei.
- **Corte, repetição e silêncio** nos modelos de voz baseados em LLM: há relatos no fórum do Google de áudio truncado no streaming (3.1) e de o 3.8 Flash TTS repetir o texto quando há parágrafo duplicado, com cobrança [24]. Gerar por frase reduz o risco, e vale conferir se a duração do áudio é compatível com o tamanho do texto.
- Do lado positivo: estudo com alunos de francês mostrou que TTS no celular ajudou a aprender liaison [23].

**Quem erra menos**: não encontrei avaliação independente de **acerto de pronúncia** em francês por modelo (**não confirmado**). As arenas medem naturalidade e preferência. Por isso o teste de ouvido da seção 8 usa frases-armadilha.

**Velocidade no modelo ou no player**:
- No player: `playbackRate` com `preservesPitch` (ligado por padrão) mantém o tom [30]. Funciona com qualquer modelo, com o áudio já em cache, sem custo e com troca instantânea. O Chromium estica o áudio com o algoritmo WSOLA; os artefatos crescem conforme se afasta de 1,0 e são fortes abaixo de 0,5 [30]. Para o aprendiz, 0,75 a 0,9 é a faixa de uso.
- No modelo: o áudio é gerado já lento, com articulação e pausas próprias, sem artefato. Mas nem todo modelo aceita (seção 2), cada velocidade vira um arquivo novo no cache e, no Gemini, custa mais.
- Sugestão: velocidade no player como padrão. Deixar a velocidade do modelo para uma segunda fase, se o teste de ouvido mostrar distorção em 0,8.

## 7. Tradução e dicionário no contexto

Preços do catálogo do OpenRouter hoje [4], por milhão de tokens (entrada / saída). Custo por consulta estimado por mim: palavra no contexto ≈ 300 tokens de entrada e 150 de saída; parágrafo de 2.000 caracteres ≈ 500 de entrada e 550 de saída.

| Modelo | Preço (entrada / saída) | Palavra no contexto | Parágrafo | Nota |
| --- | --- | --- | --- | --- |
| `anthropic/claude-haiku-5.5` | US$ 0,10 / 0,50 | US$ 0,0001 | US$ 0,0003 | Raciocina por padrão; pedir esforço mínimo |
| `openai/gpt-6-luna` | US$ 0,10 / 0,50 | US$ 0,0001 | US$ 0,0003 | Idem |
| `mistralai/mistral-small-2603` | US$ 0,15 / 0,60 | US$ 0,00014 | US$ 0,0004 | Empresa francesa |
| `google/gemini-3.5-flash-lite` | US$ 0,30 / 2,50 | US$ 0,0005 | US$ 0,0015 | |
| `openai/gpt-4.1-mini` | US$ 0,40 / 1,60 | US$ 0,0004 | US$ 0,0011 | Já usado no app; não raciocina, latência previsível |

- **Latência**: a API pública do OpenRouter devolve `latency_last_30m` vazio para todos esses modelos, e os quadros públicos medem com raciocínio no máximo, o que não vale para consulta curta (**não confirmado**; medir no app com raciocínio desligado). Todos os modelos novos da lista raciocinam por padrão, e isso aumenta latência e tokens de saída.
- **Qualidade francês → português**: não achei comparação pública desse par com esses modelos (**não confirmado**). No WMT25 (ranking preliminar, automático), os LLMs de ponta ficaram à frente dos tradutores dedicados, que ficaram no meio da tabela [32]. Os modelos pequenos acima não aparecem lá: testar com dez frases do próprio livro.
- **API de tradução dedicada**: DeepL custa cerca de US$ 27,50 por milhão de caracteres mais mensalidade (plano Growth, US$ 32,50 com 1 milhão incluído; os planos Free e Pro saíram para contas novas em 2026; fonte secundária) [31]. Google Translate custa US$ 20 por milhão, com 500 mil grátis por mês [31]. Um parágrafo de 2.000 caracteres sai por **US$ 0,04 a 0,055**, de 40 a 180 vezes o custo de um LLM barato.
- **O que a API dedicada não faz**: sentido da palavra na frase, forma base, classe e gênero, nota de gramática, níveis de ajuda (dica antes da tradução), resposta na língua e no nível do usuário. É o que o R3 pede. Ela também exigiria outra chave. **Fora.**

## 8. Recomendação

**Voz principal: `google/gemini-3.8-flash-tts` pelo OpenRouter.**
- Empate técnico no topo em francês [20], detecta a língua sozinho (serve para qualquer livro) e é o mais barato do grupo de cima: **US$ 0,027 por página, US$ 0,82 por hora, US$ 8,2 por livro** (US$ 1,64 por hora e US$ 16,4 por livro se o preço dobrar em 2027). Com o Flash-Lite: US$ 0,55 por hora e US$ 5,5 por livro.
- Cuidados: converter PCM para MP3 ou Opus no cache; gerar por frase ou parágrafo curto; conferir a duração do áudio; velocidade pelo player.

**Reserva: `elevenlabs/eleven-v4-turbo` pelo OpenRouter.**
- Primeiro colocado em francês e em inglês [18][20], sai em MP3. **US$ 0,08 por página, US$ 2,40 por hora, US$ 24 por livro.** Entra se o teste de ouvido mostrar que o Gemini erra ou oscila. O ponto a ouvir é o sotaque das 21 vozes padrão em francês.

**Segunda chave**: só se o Coordenador quiser marcação palavra por palavra. Nesse caso, ElevenLabs direto (timestamps por caractere, vozes francesas nativas, mesmo preço por caractere, com assinatura).

**Reserva gratuita**: vozes do Windows via `speechSynthesis`, só para quando não houver internet ou crédito.

**Teste de ouvido antes de decidir** (uns 20 minutos, custo de centavos):
1. Cada modelo de fala tem um Playground na sua página do OpenRouter, com seletor de voz [3]. Não precisa de código.
2. Gerar o mesmo parágrafo em: Gemini 3.8 Flash TTS, Gemini 3.8 Flash-Lite TTS, Eleven v4 Turbo, Voxtral TTS 3 (voz `fr_marie_neutral`), MAI-Voice-2.1 (voz `fr-FR-Soleil` ou `fr-FR-Marc`) e Kokoro (`ff_siwis`, como piso). No Gemini e na ElevenLabs, testar duas vozes.
3. Parágrafo sugerido (liaison obrigatória e proibida, homógrafos, números, abreviações, nome próprio, citação em inglês):

   > Hier, à 21 h 30, M. Dupont et Mme Leroy sont arrivés chez leurs amis avec leurs deux enfants. « Vous êtes en avance ! » s'est écrié Paul. Les poules du couvent couvent, et les fils du tailleur ont perdu leurs fils. En 1998, il y avait 80 élèves ; aujourd'hui, il y en a 291, soit 3,5 % de plus. Il n'en veut plus, mais elle en veut plus. Les héros de ce roman du XIXe siècle habitent à l'est de Reims, où il est né. Comme disait Shakespeare : « To be, or not to be ». Tous sont venus, tous les jours, sans exception.

4. Salvar os arquivos com nomes neutros (A, B, C...) e ouvir sem saber qual é qual. Dar nota de 1 a 5 em clareza, naturalidade e sotaque (soa francês nativo?), e contar os erros: liaisons, "couvent" e "fils" nas duas leituras, "plus", "est", "tous", "Reims", os números e a citação em inglês.
5. Ouvir cada um a 0,8 no player, para ver se continua limpo.
6. Gerar o parágrafo em duas metades separadas e ouvir em sequência: a voz e o ritmo se mantêm de um trecho para o outro? É o que acontece na geração por frase.
7. Para tirar a dúvida da pronúncia, conferir com um falante nativo ou com uma gravação humana.

## 9. O que ficou não confirmado

- Se a WebView2 lista as vozes "Natural" (medir no app).
- Se o OpenRouter aceita IDs de vozes da biblioteca da ElevenLabs e `language_code`.
- Se o preço do Gemini no OpenRouter acompanha o aumento de 2027-01-01.
- Tempo até o primeiro som por modelo (os fabricantes citam cerca de 100 ms para v4 Turbo [10] e 70 ms de latência do modelo para o Voxtral [15]; o Gemini não publica número).
- Quadros de francês das arenas (lidos por fontes secundárias) e ranking de francês do Voxtral e do MAI-Voice.
- Preço atual do Google Cloud Chirp 3 HD e do DeepL (páginas oficiais não abriram por completo).
- Latência e qualidade francês → português dos modelos de texto baratos.

## Fontes (consultadas em 2026-11-26)

1. OpenRouter, guia de TTS — https://openrouter.ai/docs/guides/overview/multimodal/tts
2. OpenRouter, referência do `POST /audio/speech` — https://openrouter.ai/docs/api/api-reference/tts/create-speech
3. OpenRouter, anúncio das APIs de áudio (2026-05-01) — https://openrouter.ai/blog/announcements/announcing-audio-apis/
4. OpenRouter, API pública de modelos — https://openrouter.ai/api/v1/models?output_modalities=speech (fala) e https://openrouter.ai/api/v1/models (texto); preço por provedor em `https://openrouter.ai/api/v1/models/{id}/endpoints`
5. OpenRouter, catálogo de fala com parâmetros — https://openrouter.ai/api/v1/audio/speech/models
6. OpenRouter, áudio no chat — https://openrouter.ai/docs/guides/overview/multimodal/audio e https://openrouter.ai/api/v1/models?output_modalities=audio
7. OpenAI, preços — https://developers.openai.com/api/docs/pricing ; guia de TTS — https://developers.openai.com/api/docs/guides/text-to-speech ; guia de áudio — https://developers.openai.com/api/docs/guides/audio
8. OpenAI, descontinuações — https://developers.openai.com/api/docs/deprecations
9. OpenAI, contagem de tokens de áudio — https://developers.openai.com/api/docs/guides/realtime-costs
10. ElevenLabs, preços da API — https://elevenlabs.io/pricing/api ; modelos — https://elevenlabs.io/docs/overview/models
11. ElevenLabs, timestamps — https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps e https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps ; sotaque das vozes — https://elevenlabs.io/fr/blog/voice-library
12. Google, preços do Gemini — https://aistudio.google.com/docs/pricing
13. Google, geração de fala — https://aistudio.google.com/docs/speech-generation ; Cloud TTS — https://cloud.google.com/text-to-speech/pricing e https://docs.cloud.google.com/text-to-speech/docs/release-notes
14. Mistral, preços — https://docs.mistral.ai/inference/pricing ; modelo — https://docs.mistral.ai/models/voxtral-mini-tts-3-0
15. Mistral, anúncio do Voxtral TTS (2026-03-23) — https://mistral.ai/news/voxtral-tts/
16. Cartesia — https://cartesia.ai/pricing , https://docs.cartesia.ai/examples/tts-sse-with-timestamps , https://docs.cartesia.ai/build-with-cartesia/sonic-3/volume-speed-emotion ; Inworld — https://www.businesswire.com/news/home/20260902226008/en/ e https://inworld.ai/tts-api
17. Azure, lista pública de preços (`serviceName eq 'Foundry Tools'`, região eastus) — https://prices.azure.com/api/retail/prices ; camada grátis — https://azure.microsoft.com/en-us/pricing/details/speech/ ; vozes HD — https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices
18. Artificial Analysis, quadro de TTS — https://artificialanalysis.ai/text-to-speech/leaderboard ; metodologia — https://artificialanalysis.ai/text-to-speech/methodology
19. Artificial Analysis, arena de voz controlada — https://artificialanalysis.ai/text-to-speech/leaderboard/controlled-voice ; leitura por língua em https://alphasignal.ai/news/cartesia-s-sonic-3-6-dominates-eight-of-nine-global-voice-ai-leaderboards (secundária)
20. Voice Arena — https://voicearena.com/ ; quadros por língua (2026-10-23) em https://digg.com/ai/ry37nyey e https://fourweekmba.com/ai-elevenlabs-tops-5-new-voice-boards-google-leads-us-english/ (secundárias)
21. Taylor, Le Maguer e Richmond, liaison em TTS francês (SSW 2021) — https://www.isca-archive.org/ssw_2021/taylor21_ssw.html
22. Hajj et al., homógrafos em francês (2022) — https://hal.archives-ouvertes.fr/hal-03858736 ; Bailly et al. (SSW 2023) — https://www.isca-archive.org/ssw_2023/bailly23_ssw.pdf
23. Liakin, Cardoso e Liakina, TTS e liaison para alunos (2017) — https://informahealthcare.com/doi/abs/10.1080/09588221.2017.1312463
24. Fórum do Google, relatos sobre Gemini TTS — https://discuss.ai.google.dev/t/gemini-3-8-flash-tts-keeps-re-reading-the-text-when-the-input-contains-a-repeated-paragraph-up-to-10-min-of-loops-10-min-of-silence-all-billed/188536 e https://discuss.ai.google.dev/t/gemini-3-1-flash-tts-preview-streamgeneratecontent-truncates-audio-finishreason-other-past-60s-while-generatecontent-non-streaming-works/169063
25. NaturalVoiceSAPIAdapter — https://github.com/gexgd0419/NaturalVoiceSAPIAdapter
26. Readium, SpeechSynthesis em navegadores e sistemas — https://readium.org/speech/docs/WebSpeech.html
27. Kokoro, vozes — https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
28. Piper — https://github.com/OHF-Voice/piper1-gpl e https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/tom/medium
29. Supertonic 3 — https://betterstack.com/community/guides/ai/supertonic-3/ e https://huggingface.co/mlx-community/supertonic-3 (espelho)
30. MDN, `preservesPitch` — https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch ; Chromium, WSOLA — https://cobalt.googlesource.com/cobalt/+/HEAD/media/filters/audio_renderer_algorithm.h
31. DeepL e Google Translate — https://simplelocalize.io/blog/posts/ai-machine-translation-cost-comparison/ (secundária, 2026-06-03) e https://cloud.google.com/translate/pricing
32. WMT25, ranking preliminar — https://arxiv.org/html/2508.14909v2
