# Explorer report — de onde vem a transcrição com tempo

Data: 2026-11-27. Task: `taskreport_20261127153603.md` (R1, R6, R7 e R9). Parte do `explorerAgent` que cuida da transcrição, do custo, dos termos e do mercado. Sem código, sem chave, sem chamada paga. Duas provas técnicas (yt-dlp só com legendas; catálogo público do OpenRouter).

Convenção: **[V]** verificado (prova nesta sessão ou documentação/fonte aberta em 2026-11-27); **[E]** estimativa minha; **[?]** não confirmado.

---

## 1. Resposta curta

- **Dá para fazer, dificuldade Média.** O tempo por frase existe de graça nas legendas do YouTube e custa centavos por hora quando se transcreve o áudio.
- **Ordem de tentativa recomendada:**
  1. Faixa do **autor** na língua falada (se existir).
  2. Faixa **automática original** (`<lang>-orig`) + **pontuação por modelo de texto barato** quando ela vier sem pontuação.
  3. **Áudio + transcrição do Mincer** com `verbose_json`, só se não houver legenda, se a legenda for ruim ou se o usuário pedir ("Re-transcribe from audio").
- **Custo por hora de vídeo:** 1) US$ 0. 2) US$ 0,01 a 0,05 [E]. 3) US$ 0,012 a 0,04 com Whisper-class [V no preço, E na conta]; US$ 0,2 a 0,3 com os modelos de outros fornecedores.
- **Espera até abrir:** 1) cerca de 3 a 4 s [V]. 2) mais 20 a 90 s [E]. 3) 2 a 6 min [E].
- **O maior risco não é técnico.** É (a) o `yt-dlp` precisar acompanhar o YouTube e (b) os Termos do YouTube e a Store (seção 8).

---

## 2. Prova técnica 1 — `yt-dlp` do repositório, só legendas

Executável: `src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe`, versão **2026.03.17** [V]. Rodou sem erro de permissão; `--version` em 1,2 s (PyInstaller onefile).

Vídeos públicos usados (sem título, canal nem link, como pedido):
- **V1:** palestra pública em francês, ~16 min, de 2022. Só legenda **automática** (`has no subtitles` para faixa do autor).
- **V2:** vídeo de divulgação em francês, ~11 min, de 2019. Legenda do **autor** em francês **e** automática.
- Listei as faixas de um terceiro vídeo (também francês, só automática) sem baixar nada. Baixei legendas de **dois** vídeos. Nenhum áudio nem vídeo foi gravado (conferi a pasta; o `git status` não mudou).

Comandos usados (todos com `--skip-download`; saída numa pasta fora do repositório): `--list-subs`; `--write-auto-subs --sub-langs fr-orig --sub-format json3|vtt|srv3`; `--write-subs --write-auto-subs --sub-langs fr,fr-orig`.

| O que se viu | Resultado [V] |
|---|---|
| Tempo do comando | `--list-subs`: 2,0 a 2,3 s. Baixar uma faixa: 2,6 a 3,8 s por execução (inclui abrir a página e o JSON do player). Não depende da duração do vídeo |
| Tamanho (V1, 16 min) | json3 388 KB; vtt 184 KB; srv3 142 KB. Em 1 h, cerca de 1,5 MB de json3 |
| **Tempo por palavra, automática** | **Sim**, em json3 e srv3. Cada trecho (`seg`) é uma palavra com `tOffsetMs` (relativo ao evento) e `acAsrConf`. V1: 3.550 trechos com tempo (≈3.653 palavras; alguns trechos trazem duas, como "à tous"): 3.025 com `tOffsetMs` e 525 que abrem um evento (deslocamento 0) |
| Fim de cada palavra | **Não vem.** O fim é o início da próxima. `dDurationMs` dos eventos é tempo de exibição e se sobrepõe ao seguinte (523 de 526 eventos) |
| **Tempo por palavra, autor** | **Não.** Um bloco por fala, um `seg` só, sem `tOffsetMs` |
| VTT automático | Rolagem: cada linha se repete no bloco seguinte e há blocos de 10 ms. Tem tempo por palavra em tags `<c>`. Precisa de deduplicação. **json3 e srv3 não repetem** |
| Pontuação, V1 (automática, 2022) | **Nenhuma**: 0 sinais em 3.653 palavras; 103 maiúsculas em 15.336 letras (0,7%) |
| Pontuação, V2 (automática, 2019) | **Tem**: 296 sinais, 155 finais de frase, nomes próprios com maiúscula ("YouTube"), sem `acAsrConf` |
| Autor, V2 | 155 blocos em 10,8 min; duração mediana 3,9 s, p90 5,3 s, máx 16,6 s (o primeiro). Pontuado. Erros de digitação do autor existem |
| Faixas traduzidas | O V2 listou cerca de 300 linhas de faixas de tradução automática (160+ línguas, "X from French"). Não baixei |
| Exemplo do formato (inventado) | `{"tStartMs":2760,"dDurationMs":3539,"segs":[{"utf8":"alors","acAsrConf":236},{"utf8":" bonjour","tOffsetMs":360,"acAsrConf":236}]}` |

Avisos e ressalvas da execução [V]:
- O `yt-dlp` avisou "No supported JavaScript runtime… YouTube extraction without a JS runtime has been deprecated, and some formats may be missing" (só o Deno vem ligado por padrão) e "older than 90 days". As legendas baixaram mesmo assim, pelo cliente `android_vr`.
- A mesma faixa `fr` e `fr-orig` do V1 (automática) são idênticas em conteúdo.

### Medições feitas em casa sobre as faixas baixadas [V]
- **Autor × automática no mesmo vídeo (V2):** o início do bloco do autor, comparado com a palavra automática equivalente (121 de 155 blocos casados): mediana **+69 ms**, p10 **−271 ms**, p90 **+350 ms**. Exceção grande: o primeiro bloco do autor começa em 0,27 s e a fala começa em ~11,1 s (cerca de 11 s adiantado).
- **Frases no bloco do autor:** 120 de 155 blocos (77%) **terminam no meio de uma frase**; 24 (15%) têm duas ou mais frases. Logo, juntar blocos é obrigatório e, dentro do bloco, o tempo da frase é interpolado.
- **Automática com pontuação (V2):** 154 frases em 10,8 min; mediana 13 palavras e 2,6 s; p90 5,4 s; máx 14,8 s. Boa para estudo.
- **Automática sem pontuação (V1), cortando só por pausa:** pausa entre inícios de palavra: p50 180 ms, p90 600 ms, p99 1.000 ms. Cortando em pausa >= 800 ms saem 197 trechos (mediana 13 palavras, **p90 43, máx 97**); em >= 1.000 ms, 108 trechos de 34 palavras em média. Pausa dá "grupos de respiração", **não frases**.
- **Alinhar texto pontuado ao tempo por palavra:** coloquei o texto do autor (V2) em cima das palavras automáticas do mesmo vídeo por maior subsequência comum. **92,6%** das palavras do autor ganharam tempo direto, mesmo sendo duas transcrições diferentes; o resto se interpola. Um modelo que só insere pontuação e maiúsculas deve chegar perto de 100% [E].

---

## 3. R1 — Legendas do YouTube pelo `yt-dlp`

**Como pedir** [V pela prova + documentação do yt-dlp]:
`--skip-download --write-subs --write-auto-subs --sub-langs "<lang>,<lang>-orig" --sub-format json3`. `--list-subs` mostra se há faixa do autor ("Available subtitles") e as automáticas ("Available automatic captions"). O sufixo **`-orig`** marca a automática na língua original; as outras automáticas são tradução. O campo `language` do vídeo no `yt-dlp` (V1 e V2: `fr`) ajuda a escolher a língua falada.

**Autor × automática**
- Autor: texto revisado, pontuado, por bloco, sem tempo por palavra; tempo do bloco bom (±0,35 s no V2), mas blocos longos e o primeiro pode estar adiantado.
- Automática: tempo por palavra, **pontuação varia por vídeo** (V1 sem nada, V2 com tudo). O que decide isso é **[?]**: só tenho dois pontos (2022 sem; 2019 com). Não achei anúncio do YouTube sobre pontuação (busca em 2026-11-27).
- Fonte aberta (de fornecedor, amostra não aleatória, só inglês): em 264 vídeos, **20% das automáticas não têm um único ponto final** e 32% não têm vírgula [V da fonte, força fraca].
- Pontuação por língua (fr, de, es, it): **só o francês foi medido, e nos dois estados**. Alemão, espanhol e italiano **[?]**. LingQ (staff, 2024) diz que a automática do YouTube vem sem pontuação e por isso usa Whisper.

**Faixas traduzidas automaticamente** [V]: centenas por vídeo. O `yt-dlp` tem o erro **HTTP 429 só nelas** (issue aberta desde 2025-07, comentário fixado de 2026-01-06 dizendo que o YouTube provavelmente apertou o limite); **faixa do autor e automática original não são afetadas**. Para o Monet: nunca baixar faixa traduzida; a tradução é do Translate do app.

**Quantos vídeos têm legenda** (fonte de fornecedor, amostra "o que as pessoas pediram", não aleatória, ago/2026 [V da fonte, força fraca]):
- 12,4% a 13,0% dos vídeos **sem nenhuma faixa**.
- Entre os vídeos de faixa única, a parcela **feita por máquina**: fr 99,1%, de 96,9%, es 99,6%, it 100%, en 97,7%. Ou seja, **legenda do autor é minoria** (menos de 4%). Vídeo com faixa do autor e automática (como o V2) não entra nessa conta.
- Documentação do YouTube (suporte, 2026-11-27) [V]: a automática pode não existir para vídeo longo demais, língua não suportada, áudio ruim, silêncio longo no início, falantes sobrepostos ou duas línguas ao mesmo tempo. Ainda pode demorar após o envio.

**O acesso é oficial?** Não. A API oficial `captions.download` exige permissão de **editar o vídeo** (200 unidades, 403 caso contrário) [V, developers.google.com]. O IFrame Player não expõe o texto da legenda [V]. Qualquer rota para o texto de vídeo alheio é não oficial (`yt-dlp`, `timedtext`, painel de transcrição raspado).

**Quanto quebra** [V, GitHub do yt-dlp e wiki, 2026-11-27]:
- A versão do repositório (2026.03.17) tem **8 meses**; a estável de hoje é **2026.11.23**.
- O padrão de clientes muda de 1 a 3 meses: 2026.08.19 **tirou o `android_vr` dos padrões**; 2026.10.21 pôs o `tv_samsung` como padrão; 2026.11.23 tirou temporariamente o `web`. O binário do app usa o `android_vr` e **ainda baixou legendas hoje**, mas isso depende do comportamento do servidor, sem garantia.
- PO Token: o wiki (editado em 2026-07-12) diz que **legendas exigem token só no cliente `web`**.
- Runtime de JavaScript (EJS): o `yt-dlp` precisa dele para YouTube, Deno 2.3.0 ou superior ligado por padrão. O binário do app não traz Deno e avisa. **[?]** se a rota de legendas continua sem ele; a rota de áudio é a mais exposta.
- "Sign in to confirm you're not a bot": ligado à reputação do IP (nuvem/VPN) segundo fontes secundárias; o remédio é cookies do navegador, que o Monet **não deveria** usar. **[?]** a frequência em casa.
- Como os projetos lidam: Readlang raspa o painel de transcrição desde 2013 e o autor avisa que é frágil [V, fórum Readlang]; LingQ e Language Reactor passaram a rodar o próprio reconhecimento de fala quando a automática serve mal (seção 9); ferramentas de linha de comando contornam o 429 pedindo só `-orig` e ignorando erro.
- Para o Monet: atualizador do `yt-dlp` (já no backlog do Mincer) vira requisito, e **o app deve funcionar quando a legenda falha** (cair para áudio, ou dizer "no captions found").

---

## 4. R1 — Tempo na transcrição pelo OpenRouter

**Documentação oficial** (`/docs/api/api-reference/stt/create-transcription` e `/guides/overview/multimodal/stt`, 2026-11-27) [V]:
- `response_format`: `json` (padrão) ou **`verbose_json`**, que acrescenta idioma, duração e **`segments`** (`start`, `end`, `text`). "Só provedores compatíveis com OpenAI suportam."
- **`timestamp_granularities`**: `segment`, `word` ou ambos, só com `verbose_json`. `word` devolve **`words`** (`word`, `start`, `end`, `confidence` opcional). No multipart, repetir `timestamp_granularities[]`.
- `srt` e `vtt` são recusados (400). `verbose_json` em modelo sem suporte (`openai/gpt-4o-transcribe`, `microsoft/mai-transcribe-1.5`) dá **400**.
- Provedores que "podem" devolver tempo: OpenAI, Groq, Deepgram, Mistral, Azure.
- Limites: multipart até **25 MB** (~26 min de MP3 de 128 kbps); base64 maior só em OpenAI e Groq; `url`/`source_url` sem limite no gateway; **timeout de 60 s por pedido nos provedores**, "dividir gravações longas".
- Resposta traz `usage.cost`, `seconds` etc.

**Catálogo público** (`/api/v1/models?input_modalities=audio&output_modalities=transcription`, 30 modelos, sem chave) [V]. O preço é **por segundo de áudio** (confere: `whisper-1` 0,0001/s = US$ 0,006/min). Preço por **hora**:

| Modelo | US$/h | O que o catálogo diz sobre tempo |
|---|---|---|
| `openai/whisper-large-v3-turbo` | 0,012 (DeepInfra), 0,04 (Groq) | não diz; Whisper em provedor compatível com OpenAI |
| `openai/whisper-large-v3` | 0,027 | idem |
| `qwen/qwen3-asr-1.7b` | 0,027 | não diz |
| `nvidia/parakeet-tdt-0.6b-v3` | 0,06 | não diz |
| `x-ai/grok-stt-2.0` | 0,10 | "tempo por palavra", diarização |
| `mistralai/voxtral-mini-transcribe-3-0` / `small-…-3-0` | 0,21 / 0,24 | "transcrição com timestamps" |
| `elevenlabs/scribe-v2` | 0,22 | tempo por palavra |
| `openai/gpt-transcribe` | 0,27 | não diz |
| `deepgram/nova-3` | 0,26 | (docs citam Deepgram com tempo) |
| `assemblyai/universal-3-5-pro` | 0,30 | tempo por palavra |
| `openai/whisper-1` | 0,36 | — |
| `openai/gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `google/gemini-3.5-transcribe` | por token | gpt-4o: **sem `verbose_json`** (doc); Gemini diz "tempo por palavra" |

- **O que NÃO está confirmado [?]:** quais desses modelos devolvem `words` e `segments` **pelo gateway do OpenRouter**. A descrição do catálogo e a documentação divergem em nível de detalhe e `supported_parameters` vem vazio para todos. Só uma chamada real de poucos segundos de áudio (frações de centavo) responde. É a prova paga da fase 0.
- A precisão do tempo do Whisper **não é boa por natureza**: o artigo do WhisperX diz que os tempos por enunciado do Whisper são "propensos a imprecisões"; o README fala em erro de **vários segundos** no pior caso, e propõe VAD + alinhamento forçado [V da fonte]. Para marcar a frase atual e saltar, ±1 a 2 s é tolerável; para "repetir a frase em laço" não é (pede legenda do YouTube ou alinhamento) [E].
- **Somar os tempos dos pedaços:** o Mincer corta em pedaços de 20 min (`SEGMENT_SECONDS = 1200`) só se o mp3 de 64 kbps passar de 18 MB (~38 min). Fazer `offset_i = soma(duration dos pedaços anteriores)` usando o `duration` do `verbose_json`; a deriva é de milissegundos. Armadilha: o corte pode partir uma palavra no limite; cortar em silêncio (ffmpeg `silencedetect`) ou deixar ~2 s de sobreposição [E].
- **Se nenhum modelo devolver tempo:** (a) alinhar o texto do Whisper às palavras com tempo da legenda automática do YouTube (o teste da seção 2 mostrou 92,6% de acerto direto); só ajuda quando há legenda automática; (b) cortar o áudio em janelas de 20 a 30 s e transcrever cada uma (mesmo custo por segundo, mais pedidos, tempo com precisão de janela e frases partidas no corte); (c) modelo de chat com entrada de áudio, como Gemini 3.8 Flash (US$ 0,825/M tokens de áudio; ~US$ 0,2/h somando saída [E, com 32 tokens de áudio por segundo, número de memória, não conferido]): **tempo escrito por LLM em áudio longo não é confiável [?]**, descartado; (d) provedor direto: o mesmo preço por segundo, sem ganho.

---

## 5. De linhas de legenda a frases com início e fim

Desenho [E, apoiado nas medições da seção 2]:
1. **Entrada normalizada:** lista de palavras com início (`tStartMs + tOffsetMs`); o fim da palavra é o início da próxima; o fim da última é o fim do evento, limitado ao silêncio seguinte. Para legenda do autor, blocos com início e fim e **sem** palavra: tempo interpolado por caracteres dentro do bloco.
2. **Frases:** juntar as palavras em texto e usar o `splitSentences(text, language)` que o app já tem em `src/lib/sentences.ts` (Intl.Segmenter com correções); mapear o início e o fim de cada frase de volta pelos deslocamentos de caractere.
3. **Sem pontuação (V1):** corte por pausa não serve (frases de 43 a 97 palavras no p90 e no máximo). Mandar o texto, em janelas de ~1.500 palavras, a um modelo barato com a regra "**não troque, não apague e não acrescente palavras; só pontue e ponha maiúsculas**", e **conferir**: o texto devolvido, sem pontuação e em minúsculas, tem que ser **igual** à janela de entrada; senão, repetir a janela ou alinhar por diferença (como no teste de 92,6%) e interpolar. O tempo por palavra fica do original. Isso **funciona em princípio e o alinhamento foi provado**, mas a **fidelidade do modelo e o custo real não foram medidos [?]**. Achei ferramentas que fazem a mesma conferência palavra a palavra, e nenhum benchmark do pipeline.
4. **Custo da pontuação por hora de vídeo** [E]: ~13.400 palavras/h (V1: 3.653 palavras em 982 s) ≈ 20–23 mil tokens de entrada e ~22 mil de saída. Preços do catálogo em 2026-11-27 (entrada/saída por milhão): `openai/gpt-4.1-mini` 0,40/1,60 → **~US$ 0,044/h** (o modelo que o Monet já usa no roteamento); `anthropic/claude-haiku-5.5` 0,10/0,50 → ~US$ 0,013/h; `google/gemini-2.5-flash-lite` 0,10/0,40 → ~US$ 0,011/h. Com prompt, retentativas e verificação: **US$ 0,01 a 0,05/h**.

**Armadilhas conhecidas**
- VTT automático com rolagem (duplicado): usar json3 ou srv3 [V].
- Eventos só de quebra de linha (`aAppend`), `seg` com duas palavras ("à tous", que dividem o mesmo início), marcas como "[Music]" (não apareceram nas amostras; filtrar) [V/E].
- Ponto de abreviação, número decimal e reticências contam como fim de frase; o `splitSentences` já trata parte disso.
- Frase que cruza o limite entre blocos do autor (77% dos blocos do V2) e frase mais longa que o bloco.
- Início do primeiro bloco do autor adiantado em ~11 s no V2: se existir faixa automática do mesmo vídeo, corrigir o início com ela; senão, aceitar.
- Línguas sem espaço (ja, zh, th): o json3 também traz trechos com tempo; a segmentação em frase vem do `Intl.Segmenter`. **[?]** não testei. Escrita da direita para a esquerda: o tempo independe da direção; o desenho da tela é com o `uxAgent`.

---

## 6. Qualidade para estudo: automática do YouTube × classe Whisper

| Ponto | Automática do YouTube | Whisper e semelhantes |
|---|---|---|
| Pontuação e maiúsculas | Varia por vídeo (V1 nada; V2 completa); em inglês 20% sem final de frase [fonte fraca] | Já vem: o Whisper é treinado para prever o texto cru da transcrição, com pontuação e maiúsculas (artigo do Whisper, seção 2.1) [V] |
| Palavras erradas | Inglês: **mediana 9,9% de erro de palavras** (264 vídeos, comparando com legendas humanas; fornecedor; amostra não aleatória; autores dizem que o real é provavelmente menor) [V da fonte] | Whisper large-v2 em FLEURS (fala lida e limpa): en 4,2; **fr 8,3**; de 4,5; es 3,0; it 4,0; pt 4,3; ru 5,6; ja 5,3 (CER); zh 14,7 (CER) [V, artigo, Apêndice D.2.4] |
| Comparação direta | Em palestras indianas de inglês (≈9,8 mil vídeos): Whisper com modelo pequeno (`base.en`) teve 84,0% dos vídeos com erro < 20% contra 75,6% da automática do YouTube [V, arXiv 2307.10587] | idem |
| Nomes próprios | Fontes dizem que ambos erram; **nenhuma medição** [?] | idem; `keyterms` e `prompt` ajudam em alguns provedores (doc OpenRouter) |
| Frases inteiras | Só com pontuação | Segmentos do modelo; falhas conhecidas: laços de repetição, alucinação em silêncio ou música, pular início ou fim (artigo do Whisper, seção 6) [V] |
| Precisão do tempo | Por palavra, do próprio reconhecedor (V1/V2: coerente) [V] | Por segmento, ±segundos no pior caso; por palavra depende do provedor [V/?] |

**Força da evidência:** boa para Whisper em FLEURS (artigo revisado, fala lida); **fraca** para o YouTube (fonte de fornecedor, só inglês); **inexistente** para o confronto direto em fr/de/es/it [?]. Fica para a fase 0: 5 vídeos por língua, comparar as duas saídas.

---

## 7. Custo e espera, por hora de vídeo

| Caminho | Custo | Espera até abrir | Observações |
|---|---|---|---|
| **A. Legenda do autor** | US$ 0 | ~3–4 s [V] | Raro (menos de 4% dos vídeos de faixa única [fonte fraca]); sem tempo por palavra |
| **A. Automática `-orig`, com pontuação** | US$ 0 | ~3–4 s [V] | Texto em frases direto |
| **A+. Automática sem pontuação + modelo** | US$ 0,01–0,05 [E] | +20 a 90 s [E]: janelas em paralelo, saída de ~22 mil tokens | Tempo por palavra preservado |
| **C. Áudio + Whisper-class** | US$ 0,012–0,04 (turbo), 0,027 (large-v3), 0,36 (whisper-1) [V preço] | **2 a 6 min [E]**: baixar o áudio (~30 a 60 MB por hora), ffmpeg para mp3 16 kHz mono 64 kbps, 1 a 3 pedidos | **Não medi** (sem download de áudio nem chamada paga). Mincer já faz isso em segundo plano |
| C. Áudio + outros fornecedores | US$ 0,2–0,3 (Voxtral, Scribe, gpt-transcribe, Deepgram, AssemblyAI) | idem | Preço 10 vezes maior sem ganho comprovado para estudo |
| Chat com entrada de áudio | ~US$ 0,2 [E] | idem | Tempo não confiável [?]; descartado |

O custo **não decide**: em todos os caminhos cabe em centavos por hora. Decidem a espera, a exposição aos termos (legenda é texto; áudio é mídia), a pontuação e a qualidade da língua.

---

## 8. Termos do YouTube e distribuição (fatos e onde, sem opinião jurídica)

- **Termos de Serviço**, seção "Permissions and Restrictions" (página em inglês de `youtube.com/t/terms`, "Dated: December 15, 2023", lida em 2026-11-27; as versões regionais variam) [V, resumida por leitor automático, não literal]: proíbe "access, reproduce, download, distribute…" qualquer parte do Serviço ou do Conteúdo **exceto** (a) como o Serviço autoriza expressamente ou (b) com permissão escrita do YouTube e, se for o caso, dos detentores de direitos. Proíbe também "circumvent, disable… any part of the Service" e acessar o Serviço "using any automated means (such as robots, botnets or scrapers)", salvo buscadores públicos conforme o `robots.txt`. **Não achei menção a legendas ou transcrições** no trecho lido; o texto fala em "Service" e "Content". Segundo trecho de busca (não abri), uma versão arquivada de 2017 dizia que não se baixa Conteúdo sem um link "download" do YouTube.
- **Políticas para desenvolvedores das APIs do YouTube** (`developers.google.com/youtube/terms/developer-policies`, lida em 2026-11-27) [V, resumida]: III.E.1 proíbe baixar, copiar em cache ou guardar o conteúdo audiovisual sem aprovação escrita; III.I.7 a III.I.9 proíbem separar áudio de vídeo e tocar em player escondido; III.E.6 e III.I.14 proíbem raspar e obter o conteúdo por meio que não seja a API; III.I.4, III.I.5 e III.I.6 proíbem encobrir ou alterar o player e os anúncios. **Isso importa para o Listen:** tocar a frase **no player** é uma coisa; extrair o áudio e tocá-lo fora do player é a vedação de separar áudio. Cruzar com a exploração do player embutido.
- **Situação do `yt-dlp`:** projeto ativo (versão de 2026-11-23). O precedente de 2020: a RIAA mandou aviso DMCA ao GitHub contra o `youtube-dl`, o projeto foi restaurado depois da defesa da EFF (blog do GitHub, 2020-11-16). Segundo reportagens lidas por busca: um tribunal alemão responsabilizou, em 2024, o hospedeiro do `youtube-dl.org`; a IFPI pediu à UE incluir o `yt-dlp` numa lista de pirataria (inscrições até setembro de 2026, lista prevista para o 2º trimestre de 2027) **[?]**, sem 2ª fonte.
- **Uso pessoal × app distribuído:** os Termos valem para qualquer usuário; não vi exceção de uso pessoal para baixar (a de "uso pessoal e não comercial" que li, na versão do Reino Unido, é para **ver ou ouvir**). Mudança para a versão distribuída: o app passa a **embutir e rodar a ferramenta** em máquina de terceiros.
- **Microsoft Store** (Policies v7.20, 2026-09-14) [V]: 11.1 "todo conteúdo no produto … originalmente criado pelo provedor, licenciado do detentor, usado como o detentor permite ou como a lei permite". A cláusula "permitido pelos termos do serviço de terceiros" que achei (10.1.6) é só para **lojas**; não se aplica. 10.2.2 proíbe baixar script remoto e executá-lo de modo incoerente com a função descrita (relevante para carregar `iframe_api` do YouTube; passar à exploração do player). **Não achei relato de app rejeitado por baixar do YouTube [?].** O backlog do Mincer já tem "flag de build para esconder o YouTube no MSIX".

---

## 9. Referências de mercado

| Ferramenta | De onde vem a transcrição | O que oferece sobre ela | Reclamações |
|---|---|---|---|
| **Language Reactor** (extensão Chrome, YouTube e Netflix) | Legendas do YouTube; histórico de atualizações de 2026 cita reconhecimento de fala próprio em 16 línguas, "com tempo e quebra de frase melhores" [só trecho de busca; duas páginas de ajuda abriram vazias e a de novidades trouxe só uma lista curta, sem datas] | Legenda dupla; clicar na palavra; **pausa automática por frase**; repetir a frase (tecla S); frase anterior/próxima (A/D); borrar a próxima legenda; salvar a frase; velocidade | "Transcrições do YouTube pouco confiáveis"; só palavra solta, não expressão; interface sobrecarregada; sem app móvel; recursos pagos (análise de terceiros) |
| **LingQ** | Importa a legenda do YouTube; sem legenda ou só automática, **roda Whisper** (decisão da equipe: automática sem pontuação, "frase difícil de ver"), segundo o fórum em jan/2024 | Lição com vídeo e texto sincronizado por tempo (também com SRT); clicar na palavra | Transcrição por IA lenta, limite de 90 min, cada clique demora 4 a 6 s nas lições por IA; usuários queriam a legenda do YouTube de volta |
| **Readlang** | **Raspa o painel de transcrição** do YouTube desde 2013; o autor avisa que é frágil | Texto clicável ao lado do vídeo, só YouTube | Quebra quando o YouTube muda a página |
| **Migaku** (extensão) | Legendas do site; interativas | **Navegador de legendas lateral** que salta para a frase; modos "esconder a legenda e pausar a cada frase, depois revelar" e "mostrar só se houver palavra desconhecida"; foco em cartões | Extensão para de funcionar às vezes; versão antiga × nova sem paridade; pago |
| **Lingopie** | Catálogo próprio de séries com **legenda própria** (não é YouTube) | Legenda interativa; clique vira cartão | Reclamação principal é cobrança (teste gratuito que vira pago); catálogo fechado |
| Outras extensões (SubText, EasySubs, "Listen and Repeat") | Legenda do YouTube | Passar o mouse para traduzir; repetir a frase | "A automática junta frases, difícil repetir" (texto da própria extensão) |

Observações: (1) as ferramentas de mercado **não confiam só na automática do YouTube**: LingQ e Language Reactor passaram a rodar o próprio reconhecimento de fala justamente por pontuação e quebra de frase. (2) Os recursos de estudo comuns são **clicar na frase para ir ao ponto, pausa automática por frase, repetir a frase, legenda dupla, esconder o texto**, todos sem relação com cartões; o Monet reaproveita o que serve e deixa o resto. (3) Fontes de reclamação são de terceiros ou de concorrentes (afiliados da Lingopie) e valem como direção, não como medida.

---

## 10. Recomendação, dificuldade e riscos

**Dificuldade (só a parte de transcrição com tempo):** Média. Legenda do YouTube: Baixa (JSON de tempo por palavra, o app já tem o sidecar e o `splitSentences`). Pontuação por modelo com conferência palavra a palavra: Média. Áudio com `verbose_json` e soma de pedaços: Média, com o risco do modelo.

**Proposta:**
1. Caminho principal: legenda do YouTube via `yt-dlp` (json3), autor primeiro, `-orig` depois; nunca faixa traduzida. Guardar o **json3 resumido** (palavras com tempo) ou frases com início e fim, mais a língua, a origem da faixa ("author" / "auto" / "audio") e a data. O que fica no app é texto; o vídeo é do YouTube.
2. Se a automática vier sem pontuação, **passe de pontuação** (gpt-4.1-mini, ou o modelo mais barato que passar no teste), com checagem de palavras. Mostrar ao usuário a origem da faixa ("YouTube auto captions, punctuation added").
3. "Re-transcribe from audio" **sob demanda** (e automático só se não houver nenhuma faixa), com `verbose_json` + `timestamp_granularities` e o modelo escolhido no Settings do Mincer; se o modelo não devolver tempo, avisar e recusar (em vez de gravar sem tempo).
4. Atualizador do `yt-dlp` e mensagem clara quando o YouTube bloquear.

**Descartados:** faixas traduzidas do YouTube (429, tradução ruim); VTT (duplicado); corte só por pausa (não dá frases); `captions.download` oficial (só vídeo próprio); modelo de chat com áudio para tempo (não confiável); cartões e repetição espaçada (fora da proposta do Monet).

**Fase 0 sugerida (provas que faltam, todas baratas):**
1. 10 vídeos por língua (fr, de, es, it): proporção de faixa do autor, automática com e sem pontuação, sem legenda; comparação com a transcrição Whisper. Só listar e baixar legendas.
2. Uma chamada de ~30 s de áudio em 4 ou 5 modelos candidatos com `verbose_json` + `word`: quais devolvem `words` e `segments` pelo OpenRouter (menos de US$ 0,01 no total; exige a chave).
3. Passe de pontuação com checagem em 3 trechos de 1.500 palavras (US$ 0,01).
4. Repetir a prova de legendas com o `yt-dlp` 2026.11.23, para ver o que muda no cliente padrão.

---

## 11. Verificado × não confirmado

**Verificado (prova ou documentação aberta, 2026-11-27):**
- `yt-dlp` 2026.03.17 do repositório roda e baixa legendas (list + json3/vtt/srv3) em ~3 s, sem áudio; json3/srv3 da automática têm **tempo por palavra**, do autor só por bloco; VTT automático repete linhas.
- Automática com e sem pontuação no mesmo idioma, em vídeos diferentes.
- OpenRouter: parâmetros `response_format`, `timestamp_granularities`, formatos de resposta, limites (25 MB, 60 s) e erros; catálogo de 30 modelos e preço por hora.
- `captions.download` só com permissão de edição; IFrame Player sem acesso ao texto.
- Releases do `yt-dlp` até 2026.11.23, remoção do `android_vr` dos padrões e do `web` (temporário); wiki do PO Token e do EJS; issue do 429.
- Termos de Serviço e políticas de desenvolvedor (trechos listados); Políticas da Store v7.20 (11.1, 10.2.2, 10.1.6).

**Não confirmado:**
- Quais modelos do OpenRouter devolvem `words`/`segments` de verdade (exige chamada paga; é a prova 2 da fase 0).
- Pontuação da automática em de, es, it; se depende da data do vídeo ou do canal (tenho 2 pontos em fr).
- Fidelidade e custo reais do passe de pontuação por modelo (só o alinhamento foi provado, 92,6% no texto de outro transcritor).
- Automática do YouTube × Whisper em fr/de/es/it (nenhuma comparação direta encontrada).
- Duração real do caminho de áudio e se um pedaço de 20 min fecha dentro do timeout de 60 s do provedor com `verbose_json`.
- Se a rota de legendas do `yt-dlp` segue funcionando sem runtime de JavaScript e com o cliente `android_vr` fora dos padrões em versões novas; frequência do "Sign in to confirm you're not a bot" em casa.
- Prevalência de legendas: números são de uma amostra de fornecedor, não aleatória.
- Texto exato dos Termos sobre legendas (li por resumidor); relação entre as Políticas de Desenvolvedor e o app embutir o player e ao mesmo tempo baixar legendas por fora (para o Coordenador checar com quem entenda); o caso da IFPI e da Alemanha vêm de reportagens de busca, sem 2ª fonte.
- Recursos do Language Reactor: páginas de ajuda abriram vazias para o leitor automático; usei trechos de busca. Migaku, Readlang e Lingopie: sem documentação oficial lida, só fórum, loja de extensões e análises de terceiros.
- Línguas sem espaço e da direita para a esquerda: não testadas.

---

## Fontes principais (acesso em 2026-11-27)

- OpenRouter: docs `api/api-reference/stt/create-transcription`, `guides/overview/multimodal/stt`, blog "Transcription on OpenRouter", API pública `/api/v1/models` (STT e geral) e `/models/{id}/endpoints`.
- yt-dlp: releases 2026.03.13 a 2026.11.23, issues #16150 e #13831, wiki "PO Token Guide" e "EJS".
- YouTube: Ajuda "Use automatic captioning"; Termos de Serviço; Developer Policies; documentação `captions.download` e IFrame Player.
- Microsoft: Microsoft Store Policies v7.20.
- Artigos: Whisper (arXiv 2212.04356, FLEURS Apêndice D.2.4 e Seção 6), WhisperX (arXiv 2303.00747), NPTEL (arXiv 2307.10587).
- Fornecedor `youtube-transcript.ai` (3 estudos de 2026: precisão, cobertura por língua, vídeos sem legenda): **fonte comercial, amostra não aleatória**.
- Mercado: fórum do LingQ (jan/2024), fórum do Readlang, lojas de extensão, análises de terceiros do Language Reactor, Migaku e Lingopie.
