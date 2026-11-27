# Estudo: Library para estudo de línguas (ouvir, traduzir, vocabulário)

> Data: 2026-11-26 · Só leitura: nenhum código, schema ou dado alterado · Base: branch `feat/mincer`, commit `43a9ae8`
> Pedido do Coordenador: "Eu quero ajustar algumas coisas no Monet para ele ser bom também para o estudo de línguas (treinamento contínuo). A minha ideia é preparar o Library para que ele consiga ler em voz alta os textos em outras línguas (aqui a pronúncia precisa ser clara e mais próxima da humana possível). Um botão traduzir ao selecionar um texto pode ser útil. Imagina que o usuário irá subir um livro ou texto em PDF em francês, por exemplo, e quer ouvir e traduzir o texto para obter e praticar o vocabulário."
> Task Report: `DOCS/reports/26-11-2026/taskreport_20261126134217.md`, com o adendo dos pedidos P1 a P5 feitos durante o estudo. Insumos, na mesma pasta: `explorerreport_20261126153600_code.md` (código), `explorerreport_20261126153738_usage.md` (uso real), `explorerreport_20261126153959_voice.md` (voz e tradução), `explorerreport_20261126153738_market.md` (mercado e método) e `uxreport_20261126173030.md` (proposta detalhada, medidas e alternativas).
> Mockups interativos: `DOCS/features/language_study/index.html`, `translate.html`, `listen.html`, `vocabulary.html`, `practice.html` e `settings.html`. Abrir num navegador (Edge ou Chrome): o painel de preview do Claude mostra a página sem os scripts.
> Dados de uso: cópia do `monet.db` de produção, lida em 2026-11-26 às 15:28. O original não foi aberto para escrita.
> Privacidade: o repositório é público. Aqui só há contagens e categorias genéricas. Os mockups usam um livro, um autor e um texto em francês inventados.

---

## 1. TL;DR

- **O OpenRouter resolve a voz, sem segunda chave.** Existe um endpoint de fala (`POST /api/v1/audio/speech`) com 43 modelos. A recomendação é o Gemini 3.8 Flash TTS como principal (cerca de US$ 0,03 por página) e o ElevenLabs v4 Turbo como reserva (cerca de US$ 0,09 por página). A escolha final depende de ouvir: o relatório de voz traz um parágrafo de teste em francês e o roteiro.
- **Ouvir vale só para o texto selecionado** (pedido do Coordenador). Seleciona um parágrafo ou a página, aciona, o app lê só aquilo e para. Isso sai igual no PDF e no EPUB e tira do caminho o item caro do estudo, que era a leitura contínua no PDF.
- **Traduzir é barato.** Um botão na barra de seleção abre um popover com o sentido da palavra naquela frase, ou a tradução da frase. Reaproveita o comando de chat que já existe, e cada consulta custa cerca de US$ 0,0001.
- **Vocabulário é uma lista separada, por livro** (pedido do Coordenador). O usuário sinaliza uma palavra ou uma frase, ela entra na aba Vocabulary do livro com a frase de origem, e dali vai para uma nota do caderno, onde o trabalho acontece.
- **Sem flashcards, estados de palavra ou contagem** (pedido do Coordenador). A palavra volta de dois jeitos: marcada de leve no texto quando reaparece, e usada pelo usuário ao recontar o trecho na nota.
- **A barra de seleção ganha uma segunda linha** (Translate, Listen, Add to vocabulary) e só em livro de língua diferente da nativa. Em livro em português, o leitor fica como é hoje.
- **O uso de língua ainda não existe no app.** A biblioteca de produção tem 6 livros, nenhum em francês, e nenhuma nota ou pergunta ligada a estudo de língua. O estudo desenha para um uso futuro. Por isso a primeira fase é um teste curto, antes de qualquer tela.
- **Dificuldade geral: Média.** São três fases de implementação depois do teste. Nada mexe no CSP nem exige migração de banco.
- **Ficam 10 decisões para o Coordenador** (seção 12).

---

## 2. O que cada pedido virou

| Pedido | Onde está no estudo |
| --- | --- |
| Ler em voz alta, com pronúncia clara e próxima da humana, pelos modelos do OpenRouter | Seções 5 e 6 |
| Botão de traduzir ao selecionar | Seção 7 |
| Análise completa do Library para quem estuda uma língua | Seções 3 e 4 |
| Obter e praticar vocabulário | Seções 8 e 9 |
| Que outras funcionalidades interessam a esse usuário | Seção 10 |
| P1. Sem flashcards nem conhecimento decorado | Vale para tudo; seções 8 e 9 |
| P2. Ouvir só o texto selecionado, igual no PDF e no EPUB | Seção 6 |
| P3. Listen na barra de seleção que já existe, sem botão direito | Seção 6 |
| P4. "Listen to this page" como atalho | Seção 6 |
| P5. Vocabulário como lista separada por texto, de palavra ou frase, para levar ao notebook | Seção 8 |

---

## 3. Diagnóstico: o Library hoje para quem estuda uma língua

Conferido no código (`src/components/Reader/`, `src/components/Library/`).

| Passo da jornada | PDF | EPUB | Pasta de docs |
| --- | --- | --- | --- |
| Importar | Sim, até 50 MB | Sim, sem DRM | Pasta local |
| Idioma do livro | Não existe | Não existe (o arquivo traz, o app não lê) | Não |
| Ler, zoom, sumário | Sim | Sim | Sim |
| Buscar no livro | Sim (Ctrl+F) | **Não** | Não |
| Selecionar: grifar, copiar, citar, Ask AI | Sim | Sim | Não |
| Traduzir | Não | Não | Não |
| Ouvir | Não | Não | Não |
| Guardar palavra ou frase | Não | Não | Não |
| Rever depois | Só os grifos do livro | Só os grifos do livro | Não |

O que já ajuda esse usuário hoje: o chat ao lado do livro, que recebe a página atual e os grifos a cada pergunta, e a aba Notes, com uma nota vinculada ao livro. O que falta são as três coisas pedidas: ouvir, traduzir e guardar vocabulário.

**O texto dos dois leitores não tem a mesma qualidade.**

- **EPUB:** o capítulo inteiro está disponível, com parágrafos de verdade, sem hifenização artificial e sem cabeçalho ou rodapé.
- **PDF:** só a página atual existe na tela. A seleção vem com quebra de linha no meio da frase e com o hífen de fim de linha. O texto da página inclui cabeçalho, rodapé, número de página e notas de rodapé, sem filtro. PDF escaneado não tem texto nenhum.

Isso importa porque o texto que vai para o áudio e para a tradução é o texto da seleção.

---

## 4. Uso real em produção

Números de 2026-11-26. Detalhe em `explorerreport_20261126153738_usage.md`.

| Medida | Valor |
| --- | --- |
| Livros | 6 (5 PDF, 1 EPUB) |
| Língua | 4 em português, 2 em inglês (técnicos), nenhum em francês |
| Notas, cadernos, trackers ou perguntas de chat sobre estudo de língua | 0 |
| Página típica de PDF | 2.369 caracteres (mediana), 2 a 3 minutos de áudio |
| Livro inteiro | de 0,55 a 2,2 milhões de caracteres |
| Volume lido em PDF em 4 meses e meio | cerca de 1,3 milhão de caracteres |
| Grifos | 256; 30% têm de 1 a 3 palavras |
| Grifos longos com quebra de linha no meio | 95% |
| Grifos por mês | julho 198, agosto 35, setembro 20, outubro 3, novembro 0 |

Cinco leituras que mudaram o desenho:

1. **O caso de uso ainda não acontece.** Não há livro em francês nem prática de língua registrada. O único contato com língua estrangeira é leitura técnica em inglês, feita sem pedir ajuda.
2. **O PDF é o formato real.** O único EPUB ficou em 1% de progresso, sem grifos. Uma proposta que só fique boa no EPUB não atende.
3. **O custo se mede por página e por sessão.** O progresso típico de um livro é parcial (mediana de 36%). Gerar áudio sob demanda cobre o uso; gerar o livro inteiro pagaria por dois terços não lidos.
4. **O grifo curto não é vocabulário.** Os grifos de 1 a 3 palavras marcam nomes de personagens e lugares, e as cores já têm função (rosa e verde para nomes, amarelo para trechos). O vocabulário precisa ser uma coisa própria, fora dos grifos e das cores.
5. **O Library perdeu uso desde julho.** O recurso de língua seria um motivo novo para abri-lo, e não o complemento de um hábito ativo.

---

## 5. Voz: provedor, qualidade e custo

Detalhe, fontes e tabela completa em `explorerreport_20261126153959_voice.md`. Os modelos, os preços e os parâmetros abaixo foram conferidos na lista pública do OpenRouter, sem usar chave.

**A hipótese "o OpenRouter resolve" se sustenta.** O endpoint de fala existe desde maio de 2026 e é do mesmo tipo das chamadas que o backend já faz. Um provedor direto só seria necessário para marcar o texto palavra por palavra, o que este estudo não propõe.

| | Modelo no OpenRouter | Por página (2.369 caracteres) | Por hora de áudio | Tudo o que foi lido em 4 meses e meio |
| --- | --- | --- | --- | --- |
| Principal | `google/gemini-3.8-flash-tts` | US$ 0,03 | US$ 0,82 | cerca de US$ 18 |
| Reserva | `elevenlabs/eleven-v4-turbo` | US$ 0,09 | US$ 2,40 | cerca de US$ 52 |

- **Qualidade em francês.** Numa arena com votantes nativos, os dois aparecem em empate técnico no topo. Esse quadro foi lido por fonte secundária, e arena mede preferência, não acerto de pronúncia. Nenhuma avaliação independente de pronúncia em francês por modelo foi encontrada.
- **O preço do Gemini dobra em 2027-01-01** na tabela do Google. O OpenRouter repassa o preço do provedor, então deve acompanhar (não confirmado).
- **O endpoint só devolve o áudio, sem tempos.** Para saber qual frase está tocando, o app gera uma frase por requisição.
- **Velocidade no player.** Gemini e ElevenLabs v4 não aceitam o parâmetro de velocidade. O player reduz a velocidade preservando o tom, sem custo e com qualquer modelo. A faixa útil para quem aprende é de 0,75× a 1,0×.
- **O Gemini só sai em PCM ou WAV** pelo OpenRouter (cerca de 173 MB por hora). Para guardar o áudio em disco é preciso comprimir; o ffmpeg que o Mincer já empacota resolve. A ElevenLabs sai em MP3.
- **Dois modelos a incluir no teste de ouvido:** Voxtral TTS 3 (US$ 13 por milhão de caracteres) e MAI-Voice-2.1 (US$ 22), ambos com voz francesa nativa. O MAI-Voice é o único que aceita velocidade de 0,5 a 2.
- **A OpenAI não está no catálogo de fala** do OpenRouter e desliga seus modelos de TTS em janeiro de 2027.
- **Grátis ou local não compensa.** As vozes francesas do Windows nesta máquina são da geração antiga, e os modelos locais ficam abaixo em francês. Servem no máximo de reserva sem internet.

**Para a tradução**, um modelo de texto barato do OpenRouter custa cerca de US$ 0,0001 por palavra consultada e US$ 0,0003 a 0,0015 por parágrafo. DeepL e Google Translate custam de 40 a 180 vezes mais e não dão o sentido no contexto nem a gramática.

---

## 6. Proposta: ouvir

Mockup: `listen.html`.

- **Dois gestos, um player.**
  - **Listen** na barra de seleção lê a seleção: uma palavra, um parágrafo, ou a página selecionada com o mouse.
  - **Listen to page**, na barra do topo do leitor, ao lado de Search, equivale a selecionar a página sem arrastar. No EPUB é o trecho visível.
- **Lê só aquilo e para.** Para seguir, o usuário vira a página e aciona de novo. Nada vira a página sozinho.
- **Mini-player** flutuante embaixo, entre os dois botões de página: voltar uma frase, tocar e pausar, avançar uma frase, repetir a frase, velocidade (0,75×, 0,85×, 1,0×) e um menu com a voz e as opções.
- **Por baixo, uma frase por vez.** A seleção é dividida em frases e cada frase vira um áudio. Com isso o som começa rápido, dá para repetir e voltar, e o cache reaproveita o que já foi gerado. O usuário não vê "frases", só os controles.
- **Acompanhar o texto.** Na primeira entrega, o player mostra a frase que está sendo falada e a página marca o trecho inteiro em cinza. É igual nos dois leitores e não depende de mapear frase por frase na página. A frase marcada na própria página fica para depois (decisão D2).
- **Limpeza do texto no PDF.** Antes de falar, o app junta as linhas quebradas, desfaz a hifenização e, no "Listen to page", tira o cabeçalho e o número de página. Como o player mostra exatamente o que está sendo falado, um erro da limpeza fica visível e se pula com "avançar".
- **O que interrompe o áudio:** trocar de página pausa e oferece "Back to p. 42"; abrir o Translate pausa; mudar a seleção não interrompe. Fechar o livro ou sair do modo Library para o áudio.
- **Gravação do Mincer em andamento:** o Listen bloqueia com um aviso e a saída "Play anyway", porque a gravação captura o som do sistema.

### Alternativas descartadas

- **Leitura contínua do livro com virada de página:** é o item caro do PDF (frase que atravessa a página, texto limpo com mapa de posições). A pesquisa de método indica que o ritmo na mão do usuário importa mais. Fica como decisão futura (D10).
- **Menu de botão direito:** os leitores não têm menu de contexto; o padrão é a barra de seleção.
- **Marcar palavra por palavra (karaokê):** exige um provedor direto com tempos por palavra, ou seja, uma segunda chave.
- **Gerar a seleção inteira num áudio só:** o som demora a começar e não dá para repetir uma frase.
- **Mini-player na barra do topo ou como faixa fixa embaixo:** a barra já quebra linha, e a faixa fixa muda a altura útil da página.

---

## 7. Proposta: traduzir

Mockup: `translate.html`.

- **Gesto:** selecionar e clicar **Translate** na barra de seleção. O popover abre junto à seleção, preso à janela, sem ser cortado pela borda da página, e a seleção continua marcada.
- **Palavra ou expressão:** o sentido **naquela frase**, na língua nativa, mostrado na hora; a forma base, a classe e o gênero; a frase com o termo em negrito; uma nota curta quando ajuda.
- **Frase ou parágrafo:** a tradução e até duas notas de gramática. É assim que a tradução "paralela" entra: por trecho, sob pedido, e some ao fechar.
- **Ações no popover:** Listen, Add to vocabulary, Add to note, Ask AI.
- **Não guarda nada sozinho.** Guardar é o Add to vocabulary.
- **Limite de 1.500 caracteres** por consulta, cerca de um parágrafo. O motivo é de produto: a IA não traduz a página pelo usuário.
- **Língua:** a de origem é a do livro; a de destino é a nativa, com padrão pelo sistema. O rodapé do popover mostra o par ("French → Portuguese") e permite corrigir.

**Por que mostrar a tradução na hora.** O Task Report cogitava "tentar antes de revelar". A pesquisa não apoia isso na primeira consulta: uma meta-análise de 42 estudos mostra que o sentido dado à mão, na língua nativa, quase dobra o que se aprende lendo (45% contra 27% das palavras), e que inferir antes de ver não acrescenta e custa tempo. O esforço que rende é usar a palavra depois (seção 9).

### Alternativas descartadas

- **Clique simples em qualquer palavra traduz:** conflita com o clique em grifo e tira o único freio do gesto.
- **Dicionário ao passar o mouse:** ajuda que aparece sem ser pedida.
- **API de tradução dedicada (DeepL, Google):** muito mais cara, exige outra chave e não dá o sentido no contexto.
- **Painel de tradução lado a lado:** fica visível o tempo todo e, no PDF, não existe parágrafo para alinhar.

---

## 8. Proposta: vocabulário

Mockup: `vocabulary.html`.

- **Guardar é um gesto do usuário.** O botão **Add to vocabulary** fica na barra de seleção e no popover do Translate. Pela barra, o item entra sem tradução e sem chamar a IA. Pelo popover, entra com o sentido que estava na tela.
- **O item** pode ser palavra, expressão ou frase inteira. Guarda o texto, a frase de origem, o livro e a posição. Não tem estado.
- **Aba Vocabulary**, a terceira da coluna de navegação do leitor, ao lado de Contents e Highlights, sem contador. Duas seções: os itens novos e os já enviados ao caderno. Cada item mostra o termo, o sentido quando existe, a frase de origem e a posição; clicar leva à página.
- **Levar ao caderno é o fluxo central.**
  - O botão principal envia os itens novos, ou só os marcados.
  - Na primeira vez o usuário escolhe o destino e vê uma prévia; depois o envio é direto, com Open e Undo.
  - **Destino:** uma nota própria de vocabulário do livro, lembrada por livro. As outras opções são a nota vinculada ao livro e a escolha de caderno e nota, como no modal de citação de hoje (decisão D4).
  - **Formato na nota:** o termo em negrito, a frase de origem como citação e a linha com o livro e a página, igual às citações de hoje.
  - **Tradução na nota:** recolhida num bloco de toggle, que o editor já tem. A nota mostra a palavra e a frase; o sentido fica a um clique (decisão D5).
  - **Depois de enviado**, o item fica na lista com a marca "Sent to notebook", como no Mincer, e pode ser reenviado.
- **Marca no texto.** O item guardado aparece com sublinhado pontilhado, sem cor de fundo, neste livro e nos outros da mesma língua, com uma chave para desligar. É o que faz a palavra voltar em contexto sem sessão de revisão. Clicar numa palavra marcada mostra as frases em que ela foi guardada (decisão D6).
- **Onde mora no banco:** tabela própria. Uma nota por palavra encheria o caderno e o índice do RAG, e estender os grifos obrigaria tudo o que lê grifos a filtrar.

### Alternativas descartadas

- **Translate guardar sozinho:** viraria um registro de consultas, e não uma lista escolhida.
- **Vocabulário como cor de grifo:** as cores já têm função para este usuário.
- **Estados de palavra, "I know this" e contador na aba:** fora pelo critério do Coordenador. No fórum do LingQ, gerir a lista vira o objetivo e as contagens enganam.
- **Envio automático ao caderno a cada item:** tira do usuário a escolha de quando e para onde.
- **Visão geral de todo o vocabulário no Library:** a lista é por livro e o trabalho acontece na nota, que já tem busca e tags. Fica para depois.

---

## 9. Proposta: praticar sem decorar

Mockup: `practice.html`.

O critério do Coordenador é que conhecimento decorado não interessa ao Monet. A pesquisa de método aponta o que rende sem drill: reencontrar a palavra em contexto e, principalmente, **usar** a palavra.

- **Recontar.** O botão Retell abre a nota do livro com um bloco para o usuário recontar o trecho com as palavras que guardou. Recontar foi a prática com melhor resultado nos estudos (cerca de 23% a mais de retenção). "Ask for feedback" manda o texto ao chat; a IA comenta e não reescreve. O texto fica na nota, que dura; o comentário fica no chat, que é efêmero de propósito.
- **Professor de língua no chat do leitor.** Um interruptor acrescenta ao contexto da página a língua do livro, a língua nativa, o nível do usuário e o vocabulário guardado naquela página. Fica desligado por padrão, porque o uso real de língua estrangeira hoje é livro técnico em inglês, lido sem ajuda. O padrão do chat por página, já validado, não muda.
- **Ouvir de novo.** "Listen to list" toca a frase de origem de cada item do vocabulário, no mesmo player.
- **Perfil de língua como nota de configuração**, com a tag `language profile`: nível por língua e como o usuário quer as explicações. O Settings guarda só o técnico (modelo, voz, língua nativa).

**O preço do caminho sem drill.** Ler sem apoio rende cerca de 15% das palavras novas de um texto. O caminho é mais lento por palavra e compensa com volume de leitura, tradução à mão e uso. A evidência vem quase toda de alunos de inglês em sala de aula, com textos curtos; leitura de livro inteiro por adulto autodidata é uma extrapolação.

---

## 10. Outras funcionalidades avaliadas

| Funcionalidade | Veredito | Motivo |
| --- | --- | --- |
| Idioma por livro, detectado no import | **Entra** | É o que liga e desliga as ações de língua. O metadado do PDF não serve; a detecção por amostra de texto acerta com folga. |
| Seção Language no Settings | **Entra** | Modelo de voz, voz com teste, modelo de tradução, língua nativa, custo. Mockup em `settings.html`. |
| Professor de língua no chat | **Entra** | Barato, reaproveita o contexto efêmero. |
| Recontar o trecho | **Entra** | Prática com melhor evidência, e mantém o trabalho com o usuário. |
| Marca da palavra guardada no texto | **Entra** | Único mecanismo sem cartão que se repete no mercado (LingQ, Lute, Migaku). |
| Frase atual marcada na página | Depois | Segunda fase do ouvir; mais cara no PDF. |
| Leitura contínua com virada de página | Depois | Viável no EPUB, cara no PDF. Reavaliar depois do uso. |
| Busca no livro para o EPUB | Depois | Hoje só o PDF tem; pesa para reencontrar uma palavra. |
| Visão geral do vocabulário no Library | Depois | O trabalho acontece na nota. |
| Ditado e repetir junto com o áudio (shadowing) | Depois | Evidência fraca para ditado e moderada para shadowing; gravar a própria voz pede captura de microfone nova. |
| Exportar o áudio de um capítulo (mp3) | Depois | Custo de um capítulo inteiro; só faria sentido para trecho já lido. |
| Texto colado ou página web como "livro" | Depois | Só vale pelo caminho de gerar um EPUB. |
| Reescrita simplificada de um trecho | Depois | Evidência mista; se entrar, como paráfrase ao lado do original. |
| Retorno de pronúncia com nota | Fora por ora | Bom para sons isolados, fraco para ritmo e entonação. |
| OCR de PDF escaneado | Fora por ora | Nenhum PDF da biblioteca é escaneado, e o motor depende das línguas instaladas no Windows. |
| Pasta de docs (markdown) | Fora por ora | Não tem seleção, grifo, chat nem registro de livro. |
| Flashcards, repetição espaçada, cartão de lacuna | **Fora** | Decisão do Coordenador. |
| Estados de palavra e contagem como meta | **Fora** | Mesma razão. |
| Tradução paralela fixa da página | **Fora** | A IA leria pelo usuário. |

---

## 11. Viabilidade, fases e riscos

Detalhe por arquivo em `explorerreport_20261126153600_code.md`.

### 11.1 O que se reaproveita

- O texto da seleção nos dois leitores e a posição da barra de seleção.
- O comando de chat em streaming, para o Translate. **O Translate não precisa de Rust novo.**
- O caminho que já entrega bytes do Rust para a tela (usado para abrir o livro), para o áudio.
- A chave do OpenRouter, o padrão de erro legível e de nova tentativa do Mincer, e o ffmpeg empacotado.
- O modal de citação e o caminho que acrescenta um bloco a uma nota, com Undo.
- O contexto efêmero do chat do leitor e o padrão de nota de configuração.

### 11.2 O que é novo

| Peça | Dificuldade | Observação |
| --- | --- | --- |
| Módulo de voz no Rust, com cache em disco | Baixa a Média | Uma chamada por frase; cache em `appData`, apagado junto com o livro. |
| Divisão em frases e limpeza do texto do PDF | Média | Funções puras, com testes. Abreviações, números e diálogos; cabeçalho e rodapé são heurística. |
| Mini-player e botões Listen | Baixa a Média | Um componente para os dois leitores. |
| Popover de Translate | Baixa a Média | Precisa ser preso à janela; o padrão do popover de grifo seria cortado na borda. |
| Idioma por livro | Baixa | Coluna nova em `books` e detecção no import. |
| Tabela de vocabulário, aba e envio ao caderno | Média | A aba vira o terceiro painel da coluna; convém fazer como componente comum. |
| Marca do item guardado no texto | Média | Sem a forma base, só casa a forma exata da palavra. |
| Professor no chat e nota de perfil | Baixa | Um bloco a mais no contexto. |
| Recontar | Baixa a Média | Versão simples: bloco na nota e envio ao chat. O visto em cada palavra usada é a parte mais cara. |
| Seção Language no Settings | Baixa | Segue o molde da seção do Mincer. |

Três pontos de arquitetura que o plano precisa respeitar:

- **Tabela e coluna novas entram pelo padrão `ensure…` do storage, e não por migration.** As migrations não rodam no banco de produção.
- **O CSP não muda.** A chamada de voz sai do Rust, e o áudio toca por `blob:`, que já é permitido.
- **A feature nasce da linha do `feat/mincer`**, onde estão o ffmpeg empacotado e os trackers.

### 11.3 Fases

| Fase | Entra | Dificuldade |
| --- | --- | --- |
| 0. Teste curto, sem tela final | Ouvir as vozes com o parágrafo de teste; importar um PDF em francês real e ver o texto da seleção; tocar um áudio vindo do Rust no app empacotado; velocidade a 0,75×; a marca pontilhada sobre o texto do PDF e dentro do EPUB | Baixa |
| 1. Traduzir e ouvir a seleção | Idioma por livro; segunda linha da barra de seleção; popover de Translate; Listen na seleção e Listen to page com o mini-player; limpeza do texto; Settings › Language. PDF e EPUB juntos | Média |
| 2. Vocabulário | Tabela; Add to vocabulary; aba Vocabulary; envio ao caderno; Listen to list | Média |
| 3. Reencontro e prática | Marca do item guardado no texto e "onde você guardou"; professor no chat; nota de perfil; recontar | Média |
| Depois | Frase marcada na página; leitura contínua; busca no EPUB; o restante da seção 10 | — |

O professor no chat é barato e pode ser puxado para a fase 1, se o Coordenador quiser.

### 11.4 Riscos

- **Texto do PDF.** A limpeza de cabeçalho, rodapé e nota de rodapé é heurística e falha em livros de layout complexo. O player mostrar o que está falando reduz o dano.
- **Emenda entre frases.** A voz e o ritmo podem variar entre frases geradas em separado. É um dos itens do teste de ouvido.
- **Gemini.** Sai só em PCM (precisa converter), tem relatos de corte e de repetição de texto, e o preço dobra em 2027. Gerar por frase e conferir a duração do áudio reduz o risco.
- **ElevenLabs pelo OpenRouter.** Só as 21 vozes padrão, que podem ter sotaque de outra língua em francês.
- **Forma flexionada.** Item guardado sem traduzir não tem forma base e só marca a forma exata.
- **Frase cortada no fim da página do PDF.** No "Listen to page" ela sai em duas metades. Ouvir se incomoda antes de investir em completar.
- **Sem telemetria.** A única forma de saber se o recurso é usado é o próprio vocabulário com data.
- **Uso que ainda não existe.** O maior risco é de produto: construir três fases para um hábito que não começou. A fase 0 e a entrega por fases existem por isso.

---

## 12. Decisões necessárias do Coordenador

| # | Decisão | Recomendação | Alternativa |
| --- | --- | --- | --- |
| D1 | Voz | Fazer o teste de ouvido antes de fixar. Partir do Gemini 3.8 Flash TTS, com o ElevenLabs v4 Turbo de reserva, os dois pelo OpenRouter | Fixar um deles sem o teste; ou uma segunda chave, se quiser marca palavra por palavra |
| D2 | Acompanhar o texto ao ouvir | Na primeira entrega, a frase aparece no player e o trecho fica em cinza na página. A frase marcada na página vem depois | Esperar a frase na página para lançar |
| D3 | Barra de seleção | Duas linhas, a de língua acima da atual, só em livro de língua diferente da nativa | Uma linha só (599px numa coluna de 640px) ou as ações sempre visíveis |
| D4 | Destino do envio do vocabulário | Uma nota própria de vocabulário por livro, escolhida na primeira vez e lembrada | A nota vinculada ao livro; ou escolher a cada envio |
| D5 | Tradução na nota | Recolhida num bloco de toggle | Não vai; ou vai visível |
| D6 | Marca do item guardado no texto | Sim, com chave para desligar, também em outros livros da mesma língua. Entra na fase 3 | Só no livro de origem; ou não marcar |
| D7 | "Lembrar antes de ver o sentido" (ao clicar numa palavra já guardada, mostrar a frase e deixar o sentido a um toque) | **Fora por ora.** O `uxAgent` recomenda entrar como opção desligada; o Orquestrador recomenda não entrar, por ser o ponto mais próximo do que o Coordenador excluiu e por a evidência ser mista | Entrar como opção, desligada por padrão |
| D8 | Prática | Recontar e professor no chat na fase 3, na versão simples | Professor na fase 1; ou prática fora |
| D9 | Limites e custo | Translate até 1.500 caracteres; Listen sem bloqueio na página, com confirmação para trecho muito longo; custo visível só no Settings e no menu do player | Limite duro no Listen; custo a cada Listen |
| D10 | Ordem e alcance | Fase 0 antes de qualquer tela, depois as fases 1 a 3. A leitura contínua fica para reavaliar depois de usar o Listen da seleção | Começar direto pela fase 1 |

**Padrões adotados sem pedir decisão** (conferíveis nos mockups; o Coordenador pode reverter qualquer um):

- Popover de tradução preso à janela, mantendo a seleção. Translate não guarda nada.
- Áudio por frase; velocidade no player; cache em disco.
- Trocar de página pausa o áudio; abrir o Translate pausa; mudar a seleção não.
- Listen bloqueado durante gravação do Mincer, com "Play anyway".
- Vocabulário em tabela própria, sem estados e sem contador. Item reenviado é acrescentado de novo na nota.
- Aba chamada "Vocabulary". Para ela caber, a coluna de navegação passa de 280 para 300px.
- Interruptor do professor na linha do Send, desligado por padrão e lembrado por livro.
- Atalhos `T`, `L`, `V`, `Espaço`, `R` e `Shift+←/→`. O `V` precisa ser conferido no código.
- Custo fora da tela durante a leitura.

---

## 13. Mercado e método, em resumo

Detalhe e fontes em `explorerreport_20261126153738_market.md`.

- **Dois grupos que não se falam.** Os leitores de voz (Speechify, ElevenReader, NaturalReader, Readwise) têm o melhor áudio e nenhum vocabulário. Os leitores de língua (LingQ, Readlang, Migaku) têm vocabulário, áudio fraco, e quase todos terminam em cartões. Só o Lute é sem cartões por desenho, e ele não tem TTS nem tradução automática.
- **Nenhum leitor com IA de 2025–2026 se destacou.** O espaço "leitor sério de livro com língua, sem cartões" está vago.
- **Padrões que entraram na proposta:** sentido no contexto com a frase guardada junto; palavra marcada no texto com chave para desligar; áudio com velocidade lenta e repetir frase; tradução da frase atrás de um botão; limpeza de cabeçalho e rodapé antes de falar.
- **O que evitar, pelas reclamações de usuários:** tradução a um toque como muleta; gestão de listas que vira o objetivo; voz robótica, de língua errada ou fora de sincronia; dica automática sem critério.
- **Limites da pesquisa:** o Reddit não foi acessado; parte dos artigos foi lida só pelo resumo; a evidência é quase toda de sala de aula.

---

## 14. Como foi conferido, premissas e limites

- **Código:** lido na branch `feat/mincer`. O app não foi executado. O que depende de rodar está na lista de testes do `uxreport` (16 pontos) e na fase 0.
- **Uso real:** cópia do banco de produção e dos arquivos dos livros, só leitura. Para medir o chat do leitor, o explorador leu também uma cópia do armazenamento local do app, só para contagens. As cópias foram apagadas.
- **Voz:** fontes públicas, sem chave. O Orquestrador conferiu na API pública do OpenRouter que os 43 modelos de fala existem e que os modelos recomendados têm os preços, os formatos e os parâmetros citados. Nenhum áudio foi gerado nem ouvido.
- **Mockups:** o `uxAgent` conferiu no Edge headless em 1280×800 e 1920×1080, com 45 verificações de interação por CDP. O Orquestrador renderizou os seis arquivos de novo em 1280×800 e conferiu as imagens. Não há chamada de rede nos arquivos.
- **Não confirmado:** a qualidade real das vozes em francês; o tempo até o primeiro som; se o preço do Gemini no OpenRouter acompanha o aumento de 2027; a latência dos modelos de tradução; a marca pontilhada dentro do iframe do EPUB; a velocidade abaixo de 0,75×.
- **Premissa de custo:** 1.000 caracteres equivalem a cerca de 1 minuto de áudio. Os preços são de 2026-11-26 e mudam.
- **Limite não desenhado:** o mini-player em coluna de página com menos de 576px (acontece com o chat muito largo).
