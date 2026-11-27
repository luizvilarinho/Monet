# Estudo: vídeo do YouTube com transcrição sincronizada no Library

> Data: 2026-11-27 · Só leitura: nenhum código, schema ou dado alterado · Base: branch `feat/language-study` (commit `8ce293c` mais o trabalho sem commit das rodadas de teste)
> Pedido do Coordenador: "Uma funcionalidade que eu gostaria muito para esse estudo de línguas. No YouTube tem muito material de qualidade. Veja se é possível extrair o texto de um vídeo do YouTube (transcrição, pode ser usado o Mincer nessa etapa) e a transcrição ser aberta no Library para estudo textual, mas com o vídeo rodando junto, sincronizado com o texto (acredito que essa é a parte mais difícil). Então o final ficaria uma página no Library que em cima ficará o vídeo (embed do YouTube) e embaixo ficará a transcrição do texto para estudo no Library, com os recursos de tradução e tudo mais."
> Task Report: `DOCS/reports/27-11-2026/taskreport_20261127153603.md`. Insumos, na mesma pasta: `explorerreport_20261127154846_code.md` (código), `explorerreport_20261127155225_transcript.md` (transcrição com tempo, termos e mercado), `explorerreport_20261127161430_player.md` (player embutido e sincronização) e `uxreport_20261127162656.md` (proposta detalhada, medidas e alternativas).
> Mockups interativos: `DOCS/features/youtube_study/index.html` (a página do vídeo) e `entry.html` (colar o link e acompanhar). Abrir num navegador (Edge ou Chrome), com a pasta inteira.
> Privacidade: o repositório é público. Os mockups e os exemplos usam títulos, canais, links e textos inventados. Os vídeos das provas não estão identificados em nenhum documento.

---

## 1. TL;DR

- **Dá para fazer.** Dificuldade geral Média-Alta. A única peça de dificuldade Alta é o player embutido, pela incerteza e não pelo volume de trabalho.
- **A sincronização não é a parte difícil.** A legenda automática do YouTube traz o tempo de cada palavra, e o player informa a posição a cada 0,27 s, sem deriva. Marcar a frase que toca e saltar para uma frase clicada sai disso.
- **O player funciona dentro do app, com certeza alta (cerca de 85%), mas ainda sem prova no app.** Numa prova com o Edge sem janela ele carregou e tocou a partir da mesma origem que o app usa no Windows. O WebView2 do app, num build de produção, é a primeira coisa a provar.
- **A mudança na política de segurança do app é pequena:** liberar um domínio do YouTube para o quadro do vídeo. O controle (saltar, pausar, velocidade) funciona só com mensagens para o player, sem carregar script remoto.
- **A transcrição sai de graça e em segundos na maioria dos casos**, pelas legendas do próprio YouTube, baixadas pelo `yt-dlp` que o Mincer já usa. O problema real é a pontuação: a legenda automática vem ora pontuada, ora sem pontuação nenhuma, e sem pontuação não há frases. A saída é um passe de pontuação por um modelo barato (estimado em US$ 0,01 a 0,05 por hora de vídeo), que ainda precisa de prova.
- **O áudio pelo Mincer fica como terceiro degrau**, para vídeo sem legenda, e só por clique. Hoje o Mincer guarda só o texto; se a transcrição pelo OpenRouter devolve o tempo é o ponto que só uma chamada paga de centavos confirma.
- **O vídeo vira um formato novo no Library**, com um leitor próprio de texto corrido. Os recursos de língua (tradução, vocabulário, marcas, professor, Retell) são reaproveitados inteiros; o trabalho é religá-los no leitor novo.
- **"Listen" num vídeo passa a ser "tocar esta frase" no próprio player.** Tocar o áudio baixado, fora do player, vai contra as políticas do YouTube e sai da proposta.
- **O maior risco não é técnico.** Baixar legendas pelo `yt-dlp` é acesso automatizado, fora dos meios oficiais do YouTube. O player embutido é o meio oficial de assistir. Vale para o build pessoal, na linha do Mincer; para a versão da Store, não.
- **Ficam 13 decisões para o Coordenador** (seção 10).

---

## 2. O que cada pedido virou

| Pedido | Onde está no estudo |
| --- | --- |
| Extrair o texto de um vídeo do YouTube, podendo usar o Mincer | Seção 3 |
| Abrir a transcrição no Library para estudo textual | Seção 5 |
| O vídeo rodando junto, sincronizado com o texto | Seções 4 e 6.2 |
| Página com o vídeo em cima e a transcrição embaixo | Seção 6.1 |
| Recursos de tradução "e tudo mais" sobre a transcrição | Seção 6.3 |
| É possível realizar? | Seções 1, 8 e 9 |

---

## 3. De onde vem a transcrição com tempo

Detalhe, medições e fontes em `explorerreport_20261127155225_transcript.md`.

### 3.1 O que o Mincer faz hoje

O caminho do YouTube no Mincer baixa o áudio com o `yt-dlp`, converte em mp3, parte em pedaços de 20 minutos e manda cada pedaço ao endpoint de transcrição do OpenRouter. O pedido leva só o modelo e o áudio, e a resposta é lida só como texto: qualquer tempo que o provedor mande é descartado. Depois de salvar o texto, o áudio é apagado. Para sincronizar falta o tempo de cada frase.

### 3.2 A prova com as legendas

O `yt-dlp` do repositório (versão 2026.03.17) rodou em vídeos públicos em francês, só para listar e baixar legendas, sem áudio. Cada comando levou cerca de 3 segundos.

- A **legenda automática** traz o **tempo de cada palavra**.
- A **legenda do autor** traz o tempo por bloco (uma ou duas linhas), sem tempo por palavra.
- A **pontuação da automática varia por vídeo**: num dos vídeos da prova veio completa, no outro não veio nenhuma. O que decide isso não ficou esclarecido.
- Um dos formatos de legenda repete as linhas; o formato a usar é o que traz as palavras com tempo, sem repetição.

### 3.3 Os três degraus

| Degrau | Custo por hora de vídeo | Espera | Observação |
| --- | --- | --- | --- |
| 1. Legenda do autor | US$ 0 | 3 a 4 s (medido) | É minoria dos vídeos. Tempo por bloco: a frase tem margem de uns 0,35 s |
| 2. Legenda automática na língua original | US$ 0; com passe de pontuação, US$ 0,01 a 0,05 (estimado) | 3 a 4 s; com o passe, mais 20 a 90 s (estimado) | Tempo por palavra. Sem pontuação, um modelo barato só pontua e o resultado é conferido palavra a palavra |
| 3. Áudio pelo Mincer | US$ 0,012 a 0,04 na classe mais barata; até US$ 0,36 no modelo mais caro | 2 a 6 min (estimado, não medido) | Só sem legenda, ou a pedido. Depende de a transcrição devolver tempo |

O custo não decide: cabe em centavos por hora em qualquer degrau. Decidem a espera, a pontuação e a exposição aos termos do YouTube (legenda é texto; áudio é mídia).

Em amostra de fornecedor (fonte fraca), de 12 a 13% dos vídeos não têm faixa de legenda nenhuma.

### 3.4 De legenda a frases

A legenda vem em linhas curtas, não em frases. A divisão em frases usa o `splitSentences` do app (o mesmo dos livros, já com as 16 línguas) e depois mapeia cada frase de volta ao tempo das palavras. Cortar só pelas pausas da fala não dá frases: na prova, um em cada dez trechos passou de 43 palavras.

### 3.5 O que ainda não está confirmado

- **Tempo na transcrição pelo OpenRouter.** A documentação aceita pedir tempo por trecho e por palavra, só em provedores compatíveis com o formato da OpenAI. Quais modelos devolvem de fato não se sabe sem uma chamada paga de poucos segundos de áudio.
- **O passe de pontuação.** O alinhamento palavra a palavra funcionou num teste (92,6% de acerto direto), mas a fidelidade e o custo reais do passe por modelo não foram medidos.
- **A pontuação da automática fora do francês** e a qualidade dela contra a transcrição por áudio em cada língua. As ferramentas de mercado não confiam só na automática: duas das maiores passaram a rodar reconhecimento de fala próprio por causa da pontuação e das quebras de frase.

---

## 4. O player embutido

Detalhe, medições e fontes em `explorerreport_20261127161430_player.md`.

### 4.1 Funciona dentro do app?

**Sim no Windows, com certeza alta (cerca de 85%).** Desde 2025 o YouTube exige que o pedido do player informe a página de origem; sem ela o player mostra o erro 153. Na prova (Edge 158 sem janela, perfil temporário), o player carregou e tocou a partir de `http://tauri.localhost`, que é a origem do app no Windows, e de `http://localhost:<porta>`, a do modo de desenvolvimento. Uma página aberta como arquivo local deu o erro 153. Há relato de falha no Tauri em macOS e Linux, e nenhum no Windows.

A prova foi no Edge, não no WebView2 do app. Só um build de produção confirma, porque o modo de desenvolvimento provavelmente não aplica a política de segurança.

### 4.2 A mudança de política de segurança

Hoje o CSP do app tem `frame-src 'self' blob:`. A menor mudança é acrescentar um domínio do YouTube a essa diretiva:

```
frame-src 'self' blob: https://www.youtube-nocookie.com
```

Com isso o player carrega e é controlado só por mensagens (`postMessage`). Na prova, saltar, tocar, pausar e mudar a velocidade responderam. Esse protocolo de mensagens não é documentado pelo YouTube; os comandos que ele aciona são os documentados.

A alternativa documentada é carregar o script oficial do player, o que pede liberar também `script-src https://www.youtube.com`. Isso põe script remoto na janela que tem acesso aos comandos do app e esbarra numa política da Store. Fica como plano B, se o protocolo de mensagens mudar.

Pela configuração atual, a página do YouTube dentro do quadro não alcança os comandos do app. Isso não foi testado e entra na fase 0.

### 4.3 Precisão

| Medida | Resultado na prova |
| --- | --- |
| Frequência da posição | A cada 266 ms (250 a 278) |
| Atraso da mensagem | 2 ms (mediana) |
| Deriva em 10 s | Nenhuma |
| Retomada depois de um salto | 0,2 a 0,8 s |
| Pausa no fim da frase, com temporizador local | Erra de 10 a 20 ms |
| Pausa no fim da frase, só reagindo à posição | Passa de 0,1 a 0,3 s |

### 4.4 O que as políticas do YouTube pedem

- O player tem no mínimo 200×200 px; para 16:9, o recomendado é 480×270.
- Nada pode cobrir, alterar ou esconder o player. Botões de controle fora da área do vídeo são aceitos.
- O áudio não pode ser separado do vídeo, e nada toca em segundo plano.
- O conteúdo audiovisual não pode ser baixado nem guardado.
- Não há regra achada sobre mostrar uma transcrição ao lado do player.

Disso saem três consequências para a proposta: o "Listen" toca a frase no próprio player; "esconder o vídeo e só ouvir" fica fora; e a alternativa de tocar localmente o áudio que o Mincer baixa está descartada.

### 4.5 Limites

- **Vídeo que proíbe embed, com restrição de idade, privado ou removido:** o player devolve códigos de erro ambíguos. A saída é uma mensagem única com as causas possíveis e o botão "Open on YouTube"; o texto continua legível.
- **Link inválido:** o player não devolve evento nenhum, então é preciso um tempo limite.
- **Ao vivo e Shorts:** fora da primeira versão.
- **Anúncios:** o player embutido mostra anúncios, e a conta Premium não vale dentro do app. O que a posição devolve durante um anúncio não foi observado.
- **Teclado:** depois de um clique no player, o app deixa de receber as teclas. Devolver o foco à página resolveu na prova.
- **Dados:** assistir pelo player embutido envia dados básicos ao YouTube. O app deve dizer isso.

---

## 5. Como o vídeo vira um item do Library

Detalhe em `explorerreport_20261127154846_code.md`.

**Recomendado: um formato novo, `video`, com leitor próprio de texto corrido.**

- A coluna `format` da tabela de livros é texto livre: o formato novo cabe sem mudar a tabela. Faltam duas colunas (posição de retomada e id do vídeo, para não adicionar o mesmo vídeo duas vezes), que entram pelo mecanismo de colunas que o app já usa.
- A transcrição com tempos fica num arquivo ao lado dos livros. O texto fica no app e funciona sem internet; o vídeo é do YouTube e pede conexão.
- O leitor novo é mais simples que os de PDF e de EPUB (estimado em 1.000 a 1.300 linhas, contra 2.700 e 3.300), porque o texto é HTML do próprio app.
- **Todos os componentes e hooks de língua são independentes do leitor.** O que está preso dentro de cada leitor é a ligação entre eles (cerca de 770 linhas no leitor de EPUB). O leitor de vídeo precisa religar de 600 a 800 linhas.
- A posição de um grifo ou de um item de vocabulário passa a ser o trecho, os offsets e o tempo, mostrada como "12:34".
- O trabalho de buscar a legenda roda na fila do Mincer, em segundo plano, com um tipo de item próprio que não exige modelo de transcrição nem chave quando a legenda basta.

**Risco de código a vigiar:** o Library e o armazenamento tratam como PDF tudo que não é EPUB. Um `video` sem ramo próprio abriria no leitor de PDF.

### Alternativas descartadas

- **Converter a transcrição em EPUB e abrir no leitor de EPUB:** reaproveitaria tudo, mas esse leitor é paginado, a área não rola, não há lugar para o vídeo em cima e a posição tem imprecisão já medida.
- **Usar o leitor de pasta de markdown (`DocsReader`) como base:** não tem seleção, âncora nem recursos de língua.
- **Deixar o vídeo só no Mincer:** o Mincer resume; o estudo acontece no Library.

---

## 6. A proposta

Detalhe, medidas e as 22 decisões de desenho em `uxreport_20261127162656.md`. Os mockups mostram tudo o que está aqui.

### 6.1 A página

De cima para baixo, na coluna do meio do leitor:

1. **O vídeo**, intocado, em 16:9.
2. **Uma faixa de controles de estudo**, fora da área do vídeo: frase anterior, repetir a frase, tocar e pausar, frase seguinte, tempo, Pause at end, Loop e velocidade.
3. **Uma divisória arrastável.**
4. **A transcrição**, numa folha branca como a dos livros, com rolagem contínua, parágrafos cortados nas pausas longas e o tempo de cada parágrafo na margem.

As colunas laterais são as dos livros: Contents (capítulos do vídeo, ou uma entrada a cada 5 minutos) e Vocabulary à esquerda; Chat e Notes à direita.

**O aperto é a altura, não a largura.** O vídeo nasce com 42% da altura útil, nunca abaixo de 200 px, e a transcrição nunca fica com menos de 160 px.

| Janela | Vídeo | Transcrição |
| --- | --- | --- |
| 1280×800 | 532×299 | 343 px (cerca de 11 linhas) |
| 960×600, a mínima do app, com o chat aberto | 382×215 | 227 px (cerca de 7 linhas) |

Na janela mínima o vídeo fica acima do mínimo do YouTube (200) e abaixo do recomendado (270).

### 6.2 Sincronização

- **A frase que toca fica marcada** e à vista. A marca não desfaz a seleção de texto do usuário.
- **Clicar numa frase** leva o vídeo a ela e toca. Clicar no tempo de um parágrafo faz o mesmo.
- **Acompanhar** vem ligado. Rolar, selecionar texto ou abrir a tradução desliga; o botão "Follow", a tecla F ou um clique numa frase religa.
- A rolagem só anda quando a frase sai da faixa central da tela, para a página não ficar pulando.

### 6.3 O que cada recurso de língua vira num vídeo

| Recurso | No vídeo |
| --- | --- |
| Barra de seleção | A mesma, sem as cores de grifo |
| Translate | Igual ao dos livros. Pausa o vídeo; o Espaço retoma do começo da frase. Sem seleção, traduz a frase que toca |
| Listen | Toca o trecho no próprio vídeo e para no fim. Não há voz sintetizada nesta página |
| Vocabulário | Igual ao dos livros, com a posição em tempo ("01:00"). Clicar no item leva o vídeo e o texto à frase |
| Marcas das palavras guardadas | Iguais às dos livros |
| Professor de língua | O mesmo interruptor. O contexto é o trecho visível da transcrição |
| Retell | Igual, sobre o trecho visível |
| Notes | Igual; a citação leva o tempo |

### 6.4 Funções de estudo próprias de vídeo

| Função | Veredito | Motivo |
| --- | --- | --- |
| Frase anterior e seguinte | Entra | Substitui o "volta 5 segundos", que corta a frase no meio |
| Repetir a frase | Entra | É o gesto mais comum de quem estuda por vídeo |
| Pausa automática no fim de cada frase | Entra | Serve ao ditado e a repetir em voz alta. Barata depois que "tocar esta frase" existe |
| Loop da frase | Entra | Mesma mecânica da pausa |
| Velocidade | Entra | 0,5×, 0,75×, 1× e 1,25×; padrão 1× |
| Esconder o texto para ouvir antes | Entra | Borra a transcrição; o vídeo continua à vista |
| Tradução ao lado do original | Fora | Tornaria a tradução o caminho padrão. A tradução por frase, sob pedido, cobre a necessidade |
| Gravar a própria voz e comparar | Depois | Pede microfone e uma tela nova |
| Esconder o vídeo e só ouvir | Fora | Proibido pelas políticas do YouTube |

Sem flashcards, repetição espaçada, estados de palavra ou contadores.

### 6.5 A entrada

- **No Library**, um botão "Add video" abre um painel no próprio Library, sem modal, com o campo do link. A linha aparece na tabela na hora, com a etapa escrita ("Getting captions…"). Nada abre sozinho: um aviso com "Open" diz quando está pronto.
- **No Mincer**, um atalho "Study in Library" na aba YouTube e nos itens de YouTube já prontos.
- **Sem legenda:** a linha diz que não há legenda e oferece transcrever o áudio, com o tempo e o custo à vista. Nunca automático.
- **Legenda automática sem pontuação:** com chave, o passe de pontuação roda sozinho e a origem fica escrita na página; sem chave, o texto entra com as linhas quebradas por pausa e um aviso.
- **Vídeo que não deixa embutir:** entra como "só transcrição", com "Open on YouTube".
- **Ao vivo, link de playlist, vídeo repetido e link inválido** têm mensagem própria.

### 6.6 Nada sobre o player

A barra de seleção, as janelas de tradução e os menus calculam a posição fora do retângulo do vídeo e da faixa de controles. Um modal de verdade pausa o vídeo antes de abrir. Trocar de modo no menu desmonta o Library: o vídeo para e o tempo fica guardado. Ao reabrir, o vídeo fica parado perto do ponto salvo, sem tocar sozinho.

---

## 7. Riscos

- **O player no app de verdade.** A prova foi no Edge. Falta o WebView2 num build de produção e nos instaladores.
- **A regra de origem do YouTube pode endurecer.** A origem do app passa hoje, mas não é o formato que a página oficial pede (endereço HTTPS com o id do app). Planos B: definir a origem pelo WebView2, em Rust, ou uma página intermediária hospedada.
- **Termos do YouTube.** Os Termos proíbem baixar fora do que o serviço autoriza e o acesso automatizado; o trecho lido não cita legendas. O player embutido é o meio oficial de assistir. É uma decisão de risco do Coordenador para o build pessoal. Para um app distribuído, a política da Store pede conteúdo licenciado ou permitido; o backlog do Mincer já prevê esconder o YouTube nesse build. Este estudo relata o que os textos dizem e não é opinião jurídica.
- **O `yt-dlp` envelhece.** O do app tem 8 meses, a versão estável é de 2026-11-23 e os clientes que ele usa mudaram nas versões recentes. As legendas ainda baixaram hoje, sem garantia. O atualizador, que já estava no backlog, vira requisito.
- **Pontuação.** Sem ela não há frases, e o passe por modelo ainda não foi provado.
- **Protocolo de mensagens não documentado.** Pode mudar. O leitor deve falar com o player por uma interface própria, que permita trocar para o script oficial.
- **Anúncios.** O comportamento do player e da posição durante um anúncio não foi observado.
- **Teclado.** A devolução do foco funcionou no Edge; falta o WebView2.
- **Dependência do Mincer**, que está fora das releases. A funcionalidade herda isso.
- **Três leitores para manter**, com a ligação de língua repetida em cada um. Extrair uma ligação comum fica para depois que o leitor novo provar o padrão.
- **Vídeo removido ou tornado privado depois.** O texto fica; o vídeo não.
- **Línguas sem espaço entre palavras e escrita da direita para a esquerda** ficam fora, como no resto da feature de línguas.

---

## 8. Viabilidade

| Peça | Reaproveita | Novo | Dificuldade |
| --- | --- | --- | --- |
| Legendas pelo `yt-dlp` | Sidecar, fila, cancelamento e retomada do Mincer | Etapa de legendas e leitura do formato com tempo | Média |
| Frases com tempo | `splitSentences` | Mapear frases ao tempo das palavras; passe de pontuação com conferência | Média |
| Tipo de item e dados | Colunas e arquivos pelo mecanismo atual | Tipo próprio na fila; arquivo da transcrição; duas colunas | Baixa a Média |
| Formato `video` no Library | Tabela, apagar, abrir | Ramo próprio em lista, abrir, agentes e armazenamento | Média |
| Leitor de vídeo | Referência visual dos leitores | 1.000 a 1.300 linhas | Média |
| Player embutido | Nada | Quadro, origem, foco, erros, CSP | **Alta, pela incerteza** |
| Sincronização | Nada | Frase atual, salto, rolagem, Follow | Média |
| Recursos de língua | Todos os componentes e hooks | Religar de 600 a 800 linhas | Média a Baixa |
| Controles de estudo | A casca do mini-player de voz | Tocar a frase, pausa no fim, loop | Média |
| Áudio com tempo pelo Mincer | Fila, cache por pedaço | Tempo na resposta, soma dos deslocamentos | Média, com o risco do modelo |

---

## 9. Fases

| Fase | Entra | Dificuldade |
| --- | --- | --- |
| 0. Provas, sem tela final | O player num build de produção (carrega, responde às mensagens, devolve o teclado, não alcança os comandos do app); legendas com o `yt-dlp` atualizado e com as opções que o app usa; o passe de pontuação em três trechos (centavos, rodado pelo Coordenador no app) | Baixa |
| 1. Vídeo e texto sincronizados | "Add video" no Library; legendas (degraus 1 e 2) com o passe de pontuação; formato `video`; leitor com o player, a transcrição, a frase marcada, clique na frase, Follow e a faixa de controles; posição guardada; erros do player; `yt-dlp` atualizado | Média-Alta |
| 2. Recursos de língua | Barra de seleção, Translate, vocabulário com tempo, marcas, Chat com o professor, Notes, Retell, Hide text | Média |
| 3. Áudio e Mincer | "Transcribe audio" para vídeo sem legenda (com a prova paga do tempo); atalho "Study in Library" no Mincer; atualizador do `yt-dlp` | Média |
| Depois | Grifos no vídeo; gravar a própria voz; legenda em segunda língua como apoio; ligação de língua comum aos três leitores | — |

A fase 0 decide se o resto acontece: se o player não carregar no app, sobram os planos B da seção 7, que são mais caros.

---

## 10. Decisões necessárias do Coordenador

| # | Decisão | Recomendação | Alternativa |
| --- | --- | --- | --- |
| D1 | Termos do YouTube e alcance | Seguir no build pessoal, na linha do Mincer, com a legenda como caminho padrão e sem guardar áudio. Fora da versão da Store | Não fazer; ou só para vídeo com legenda do autor |
| D2 | Política de segurança do app | Liberar só `https://www.youtube-nocookie.com` para o quadro do vídeo e controlar o player por mensagens | Liberar também o script oficial do YouTube |
| D3 | Origem do app perante o YouTube | Aceitar a origem atual, que passa hoje e não é o formato oficial; planos B guardados | Pagar já o custo de definir a origem pelo WebView2 |
| D4 | Transcrição | Três degraus: legenda do autor, legenda automática, áudio. O áudio sempre por clique e só na fase 3 | Áudio automático quando não há legenda |
| D5 | Passe de pontuação | Automático quando há chave, com a origem escrita na página, se a prova da fase 0 passar | Pedir sempre; ou usar o texto sem pontuação |
| D6 | Onde se cola o link | No Library ("Add video"), com atalho no Mincer na fase 3 | Só no Mincer |
| D7 | Tamanho do vídeo | 42% da altura, mínimo de 200 px, divisória arrastável. Na janela mínima fica em 382×215, abaixo do recomendado pelo YouTube | Começar no recomendado (270), com cerca de 5 linhas de texto na janela mínima |
| D8 | Translate e o vídeo | Pausa o vídeo; o Espaço retoma do começo da frase | Não pausar |
| D9 | Áudio na página do vídeo | Só o original, pelo player. Sem voz sintetizada | Manter a voz sintetizada como opção |
| D10 | Funções de estudo | Anterior e seguinte, repetir, Pause at end, Loop e velocidade na fase 1; Hide text na fase 2 | Só tocar e velocidade na primeira versão |
| D11 | Tradução ao lado do original | Fora | Como opção desligada por padrão |
| D12 | Assistir enquanto a transcrição prepara | **Não na fase 1.** O `uxAgent` recomenda permitir; o Orquestrador recomenda deixar para a fase 3, porque com legenda a espera é de segundos e o estado só importa no caminho do áudio | Permitir desde a fase 1 |
| D13 | Ordem | Fase 0 antes de qualquer tela; depois as fases 1 a 3 | Começar direto pela fase 1 |

**Padrões adotados sem pedir decisão** (conferíveis nos mockups; o Coordenador pode reverter qualquer um):

- Transcrição em folha branca, como os livros.
- Clicar numa frase leva o vídeo a ela e toca; duplo clique numa palavra só seleciona.
- Rolar, selecionar ou abrir a tradução desliga o acompanhar; Follow, F ou um clique religam.
- Nada flutua sobre o player; um modal pausa o vídeo antes de abrir.
- Coluna do meio com no mínimo 400 px; a coluna lateral aberta por último vence.
- Abas da esquerda: Contents e Vocabulary. Grifos no vídeo ficam para depois.
- O chat vê o trecho visível da transcrição, não o vídeo inteiro.
- Vídeo indisponível ou sem internet vira uma faixa estreita, e o texto ganha a altura.
- Linha do vídeo na tabela com selo próprio, canal como autor, duração e progresso pelo tempo.
- Com o Mincer gravando o som do sistema, o Play do app pergunta antes de tocar.
- Ao reabrir, o vídeo fica parado perto do ponto salvo.
- Teclas: Espaço, setas de frase, R, P, S, F, T, V, L e as de velocidade.

---

## 11. Mercado, em resumo

Detalhe e fontes em `explorerreport_20261127155225_transcript.md`.

- **Transcrição sincronizada com vídeo é padrão conhecido** nas ferramentas de estudo de línguas. Os recursos que se repetem são clicar na frase para ir ao ponto, pausa automática por frase, repetir a frase, legenda dupla e esconder o texto. Todos, menos a legenda dupla, estão na proposta.
- **Nenhuma confia só na legenda automática do YouTube.** Duas das maiores passaram a rodar reconhecimento de fala próprio, por pontuação e quebra de frase.
- **Uma delas obtém o texto raspando a página do YouTube**, e o próprio autor chama isso de frágil.
- **Quase todas terminam em cartões.** O Monet não.
- **Limites da pesquisa:** parte das páginas oficiais não abriu para leitura automática, e as reclamações de usuários vêm de terceiros.

---

## 12. Como foi conferido, premissas e limites

- **Código:** lido na branch `feat/language-study`. O app não foi executado. O Orquestrador conferiu três pontos em que o estudo se apoia: o pedido de transcrição do Mincer manda só o modelo e o áudio e lê só o texto da resposta; o app não tem configuração que dê acesso aos comandos internos a páginas remotas, nem troca o esquema da origem; e o Library abre no leitor de PDF tudo que não é EPUB.
- **Legendas:** prova com o `yt-dlp` do repositório em vídeos públicos, só legendas, sem áudio nem vídeo, com a saída fora do repositório.
- **Player:** prova no Edge 158 sem janela, com perfil temporário e sem login; servidor e navegador encerrados e arquivos apagados no fim. Não foi no WebView2 do app.
- **Nenhuma chamada paga** e nenhuma leitura da chave.
- **Mockups:** conferidos pelo `uxAgent` no navegador do app em duas larguras, sem erro de script. O Orquestrador abriu os dois de novo e conferiu que os arquivos não têm chamada de rede.
- **Não confirmado:** o player no WebView2 real; o tempo na transcrição pelo OpenRouter; a fidelidade e o custo do passe de pontuação; a pontuação da legenda automática fora do francês; anúncios; um vídeo que proíbe embed de fato; a duração real do caminho do áudio; a parcela real de vídeos com legenda.
- **Termos e políticas** foram lidos por resumo automático das páginas oficiais em 2026-11-27, não literalmente, e mudam.
- **Preços** são de 2026-11-27 e mudam.
