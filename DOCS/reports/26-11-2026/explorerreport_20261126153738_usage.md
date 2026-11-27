# Explorer Report — uso real do Library em produção (estudo de línguas)

Task Report: `DOCS/reports/26-11-2026/taskreport_20261126134217.md` (item "Uso real em produção" do R1).

## O problema

O estudo de "Library para estudo de línguas" (ouvir, traduzir a seleção, guardar vocabulário) precisa saber como o Library é usado hoje: tamanho dos livros, língua, como o grifo é usado, se já existe prática de língua registrada no app. Este relatório traz só números agregados, porque o repositório é público.

## De onde veio o dado

- **Banco de produção** `%APPDATA%\com.monet.app\monet.db` (com `-wal` e `-shm`), copiado em **2026-11-26 às 15:28** para o scratchpad. Todas as consultas foram na cópia (`quick_check` ok). O app de produção estava aberto na hora.
- **Arquivos dos livros** (pasta `books` do appData), abertos só para leitura: `pypdf` 6.19 nos PDFs e leitura do zip no EPUB. Os 6 arquivos batem com as 6 linhas de `books`.
- **localStorage** do WebView2 (`%LOCALAPPDATA%\com.monet.app\EBWebView\...\Local Storage\leveldb`), copiado às 15:33 e lido com um leitor mínimo de LevelDB em Python. Serviu para o chat do leitor.
- Nada foi escrito em `%APPDATA%`. As cópias foram apagadas no fim.
- A língua de cada livro foi estimada por palavras frequentes em todas as páginas (a classificação de nomes próprios nos grifos curtos foi feita por leitura, é aproximada).

## Resumo

- **6 livros** (5 PDF, 1 EPUB). **4 em português, 2 em inglês, nenhum em francês** nem em outra língua em estudo.
- **Não há prática de língua registrada no app**: 0 cadernos, 0 notas, 0 tipos de nota, 0 trackers e 0 perguntas no chat ligados a estudo de língua.
- **256 grifos**; **30% têm de 1 a 3 palavras**, mas eles marcam **nomes próprios** (personagens e lugares), não vocabulário. Só 10% dos grifos curtos estão em livros de língua estrangeira.
- **Página típica de PDF: cerca de 2.400 caracteres** (1.900 nos livros em inglês). Um livro inteiro vai de **0,55 a 2,2 milhões de caracteres** (10 a 43 horas de áudio, estimadas).
- O texto selecionado no PDF chega **com quebra de linha em 95% dos trechos longos**.
- O Library **perdeu uso**: 77% dos grifos são de julho; em novembro, 0 grifos e 1 livro aberto.

## Números

### 1. Livros

| Medida | Valor |
| --- | --- |
| Total | 6 (5 PDF, 1 EPUB) |
| Abertos pelo menos uma vez | 6 de 6 |
| Páginas, PDF | mediana 422, mínimo 282, máximo 807 (2.558 no total) |
| EPUB | 460 "páginas" (locations), 107 seções |
| Progresso, PDF (última página ÷ total) | 43%, 37%, 36%, 10% e 5% (mediana 36%) |
| Progresso, EPUB | 1% |
| Primeiro e último import | 2026-07-07 e 2026-10-22 (2 em julho, 2 em agosto, 1 em setembro, 1 em outubro) |
| Último acesso | 2026-11-16 |
| Abertos nos últimos 30, 60 e 90 dias | 1, 2 e 4 |
| Tamanho dos arquivos | de 0,9 a 24,6 MB |

- `last_page` guarda a **última posição**, não o ponto mais distante. Num livro ele marca 43%, e os grifos vão da página 318 à 729 de 747 (a leitura começou no meio e chegou a 98%). O progresso real desse livro é maior do que o campo diz.
- Nenhum livro foi lido do começo ao fim dentro do Monet.
- O único EPUB é a mesma obra de um dos PDFs, importado um minuto depois. Ficou em 1%, sem grifos; a leitura seguiu no PDF.

### 2. Língua dos livros

| Língua | Livros | Formato | Tipo |
| --- | --- | --- | --- |
| Português | 4 | 3 PDF, 1 EPUB | clássicos da literatura em tradução |
| Inglês | 2 | 2 PDF | livros técnicos de software |
| Francês ou outra | 0 | | |

- **Língua estrangeira: 2 de 6**, os dois em inglês.
- A detecção por página é estável: de 97,8% a 100% das páginas com texto concordam com a língua do livro. Uma amostra de poucas páginas basta para detectar a língua no import.
- **O metadado do PDF não serve**: nenhum dos 5 PDFs tem o campo de língua (`/Lang`) utilizável (3 sem o campo, 2 com valor ilegível). O EPUB traz `dc:language` correto.

### 3. Grifos e citações

**Por livro**

| | Total | Por livro | Mediana | Máximo |
| --- | --- | --- | --- | --- |
| Grifos | 256 | 0, 3, 17, 26, 40, 170 | 21,5 | 170 |
| Citações (Add to note) | 46 | 0, 0, 0, 3, 16, 27 | 1,5 | 27 |

- 66% dos grifos estão em um só livro. Em livros de língua estrangeira: 43 grifos (17%) e 16 citações (35%).
- Das 46 citações, 37 foram para uma nota. As notas de destino são 6, e **4 já foram apagadas** (24 citações apontam para nota que não existe mais).

**Tamanho do grifo, em palavras**

| Palavras | Grifos | Parcela |
| --- | --- | --- |
| 1 | 58 | 23% |
| 2 a 3 | 20 | 8% |
| 4 a 10 | 70 | 27% |
| 11 a 30 | 78 | 30% |
| 31 a 60 | 20 | 8% |
| 61 a 90 | 10 | 4% |

- Mediana 9 palavras (49 caracteres); p90 36 palavras (197 caracteres); máximo 90 palavras (586 caracteres).
- Citações: mediana 21 palavras (114 caracteres), p90 65, máximo 91.

**Grifos de 1 a 3 palavras: 78 (30% do total)**

| Onde | Grifos curtos | O que marcam |
| --- | --- | --- |
| Livros em português | 70 (90%) | cerca de 60 são nomes próprios (personagens e lugares); cerca de 10 são palavras ou expressões comuns, das quais umas 5 são palavras soltas |
| Livros em inglês | 8 (10%) | termos técnicos e pedaços de frase; nenhum com cara de "palavra que não conheço" |

**Cores**

| Cor | Todos os grifos | Grifos curtos | Parcela de curtos dentro da cor | Livros em inglês |
| --- | --- | --- | --- | --- |
| Amarelo | 151 (59%) | 11 | 7% | 32 |
| Rosa | 83 (32%) | 50 | 60% | 11 |
| Verde | 19 (7%) | 16 | 84% | 0 |
| Azul | 3 (1%) | 1 | 33% | 0 |

- Nos livros em inglês só 2 cores foram usadas (amarelo 74%, rosa 26%).
- A cor já carrega sentido para este usuário: amarelo é trecho, rosa e verde são nome ou termo.

**Ritmo**

- Grifos em 17 dias distintos, de 2026-07-09 a 2026-10-28: julho 198, agosto 35, setembro 20, outubro 3, novembro 0.
- Citações só em julho (37) e agosto (9).

**Qualidade do texto dos grifos** (é o mesmo texto que iria para o áudio e para a tradução)

- 120 de 256 (47%) têm quebra de linha no meio. Entre os de 11 palavras ou mais: **103 de 108 (95%)**.
- 27 (11%), todos num livro de versos numerados, trazem o **número do verso no meio do texto**.
- Hifenização de fim de linha: 1 caso em 256.
- 6 grifos repetidos (mesmo texto, mesmo livro).

### 4. Calibração de custo

Caracteres com espaços, espaços em branco reduzidos a um. Contagem do `pypdf`; o pdf.js do app pode dar uma diferença pequena.

| Livro | Páginas | Caracteres | Palavras | Caracteres por página (mediana / p90) | Áudio estimado |
| --- | --- | --- | --- | --- | --- |
| Inglês, PDF A | 282 | 546.470 | 87.778 | 2.093 / 2.860 | 9,8 h |
| Inglês, PDF B | 422 | 740.361 | 107.983 | 1.799 / 2.768 | 12,0 h |
| Português, PDF 1 | 747 | 1.314.678 | 216.286 | 1.412 / 3.215 | 24,0 h |
| Português, PDF 2 | 300 | 712.550 | 125.244 | 2.487 / 2.764 | 13,9 h |
| Português, PDF 3 | 807 | 2.195.061 | 384.473 | 2.966 / 3.234 | 42,7 h |
| Português, EPUB | 107 seções | 654.704 | 109.537 | 6.413 por seção | 12,2 h |

- **Todas as páginas de PDF (2.558): mediana 2.369 caracteres por página**, p90 3.167. Só nos livros em inglês (704 páginas): mediana 1.889, p90 2.817.
- Páginas sem texto (menos de 50 caracteres): 58 (2%), capas e páginas em branco. **Nenhum PDF é escaneado.**
- "Áudio estimado" é conta, não medição: 150 palavras por minuto, o que dá perto de **54 mil caracteres por hora** (os livros têm cerca de 6 caracteres por palavra, contando o espaço). Uma página típica dá **2 a 3 minutos de áudio**.
- **Volume lido de fato** (da primeira página, ou do primeiro grifo no livro que começou no meio, até o ponto mais distante): cerca de 711 páginas, **1,31 milhão de caracteres**, perto de 24 horas de áudio, em 4 meses e meio. Só nos livros em inglês: 261 mil caracteres (20% do total deles), perto de 4,5 horas. É um teto, porque inclui páginas iniciais que podem não ter sido lidas.

### 5. Notas ligadas a língua

- 12 cadernos, 17 assuntos, 257 notas (18 arquivadas). **Nenhum caderno ou assunto dedicado a uma língua.**
- Palavras-chave em título, texto e tags:

| Termo | Notas | O que são |
| --- | --- | --- |
| francês, french, français | 0 | |
| pronúncia | 0 | |
| gramática, conjugação | 0 | |
| inglês | 4 | falam da edição de um livro técnico, não de estudar a língua |
| vocabulário | 9 | vocabulário técnico de uma área ou nome de campo de API |
| tradução | 4 | nenhuma de estudo de língua |

- Língua das notas com 30 palavras ou mais: 117 em português, 2 em inglês (técnicas), 0 em francês, 18 sem língua definida (tabelas e código). As outras 120 são curtas demais.
- **Notas com cara de lista de vocabulário ("palavra — tradução"): 0.** O filtro automático achou 15 notas com 5 ou mais linhas no formato "termo — texto curto"; conferidas uma a uma, são listas de tarefas, definições de conceitos técnicos e registros.
- **Tipo de nota ligado a vocabulário ou língua: não** (10 tipos, nenhum).
- Frequência: sem notas de língua, não há o que medir. Como referência, o app todo tem mediana de 8 notas criadas por semana ativa (23 semanas).
- Tasks: 0 de 55 com termo de língua.
- O hábito mais próximo de "consultar uma palavra" é o `/define` (com o antigo `/definir`): **18 usos** de maio a novembro, 15 com termo de 1 a 3 palavras, todos termos técnicos.

### 6. Constância

- **Trackers: não.** 0 trackers e 0 registros (as duas tabelas estão vazias).
- **Nota de perfil de estudo: sim, 1** (tipo Config, 76 palavras, num caderno de estudo técnico). **Não fala de estudar uma língua**; só cita que a edição de um livro está em inglês. Há outra nota do tipo Config (36 palavras), sem menção a língua.
- Agente tutor: 3 das 45 conversas guardadas.

### 7. Mincer

| Origem | Itens |
| --- | --- |
| Gravação (sistema + microfone) | 10 |
| Arquivo de áudio ou vídeo, YouTube, texto colado, página web | 0 |

- De 2026-11-05 a 2026-11-24, todos concluídos, todos em português. Preset: 9 de reunião, 1 científico. Transcrições com mediana de 13 mil caracteres (145 mil no total). Nenhum enviado a um caderno.
- O áudio entra no app como gravação de reunião em português. Não há uso de áudio para estudo nem em língua estrangeira.

### 8. Chat do leitor

**O que deu para medir** (lendo a cópia do localStorage):

- App inteiro: 45 conversas e 337 mensagens guardadas, todas de 2026-10-22 para cá.
- **Leitor: 1 conversa** (1 pergunta e 1 resposta), em 2026-10-22, num livro em inglês, com a pergunta em português. Os 6 livros têm pasta de chat vinculada, mas 5 estão vazias.
- Para comparar: chat do caderno 28 conversas e 99 perguntas; chat geral 15 conversas e 67 perguntas; Mincer 1 conversa.
- Nas 168 perguntas do usuário no app inteiro (busca por termos): **0 pedidos de tradução, 0 perguntas "o que significa" ou "como se diz", 0 menções a francês, inglês, pronúncia, gramática ou vocabulário**. Há 2 perguntas do tipo "o que é X", não conferidas, e 1 pergunta escrita em inglês.
- Nota vinculada ao livro (coluna Notes do leitor): 2 de 6 livros. A aba lateral ativa no leitor é Notes.

**O que não dá para medir:**

- O histórico. O chat é efêmero (Clear, Clear all, apagar) e não há log de uso. Não sobra nada de antes de 22/10, que é o período de leitura mais intensa (julho e agosto).
- A pasta do livro é criada quando o livro abre com o painel de chat, então "6 de 6 com pasta" não prova uso.
- Cliques em Ask AI, Copy e Add to note que não viraram mensagem ou citação; tempo de leitura; páginas por sessão.

## Leituras para o estudo

1. **O caso de uso ainda não acontece no Monet.** Não há livro em francês, nota de língua, tracker nem pergunta de tradução. O único contato com língua estrangeira é leitura técnica em inglês, que o usuário faz sem pedir ajuda. O estudo desenha para um uso futuro, não para um hábito medido.
2. **Custo de áudio se mede por página, não por livro.** A página típica tem de 1.900 a 2.400 caracteres (2 a 3 minutos de áudio). O livro inteiro vai de 0,55 a 2,2 milhões de caracteres, e o progresso real é parcial (mediana de 36%). Gerar o áudio sob demanda, por parágrafo ou página e com cache, cobre o uso; gerar o livro inteiro de antemão pagaria por dois terços que não são lidos.
3. **O teto de consumo é baixo.** Tudo o que foi lido em PDF em 4 meses e meio soma cerca de 1,3 milhão de caracteres (perto de 24 horas de áudio). Mesmo ouvindo tudo, é essa a ordem de grandeza para orçar.
4. **O grifo curto já é um gesto natural, mas não é vocabulário.** 30% dos grifos têm de 1 a 3 palavras, e marcam quase sempre nomes para reencontrar depois. Isso confirma o critério do Coordenador (reencontrar no contexto) e mostra o risco: num livro em francês, palavra de vocabulário e nome de personagem cairiam na mesma lista de Highlights.
5. **A cor já está ocupada.** Rosa e verde servem para nomes e termos, amarelo para trechos. Reservar "uma cor para vocabulário" disputaria um uso que existe. Os números favorecem o vocabulário como coisa própria (ação separada do grifo).
6. **O texto da seleção precisa de limpeza antes do áudio e da tradução.** Quebra de linha em 95% dos trechos longos e número de verso no meio em 11% dos grifos. Hifenização quase não aparece (1 em 256) nestes livros.
7. **A tradução precisa atender dois tamanhos.** Uma palavra (23% das seleções grifadas) e frase de 11 a 30 palavras (30%). A seleção mais longa já grifada tem 90 palavras (586 caracteres), o que dá uma referência para o limite de custo.
8. **A língua do livro tem que ser detectada pelo texto.** O metadado do PDF não ajuda em nenhum dos 5; a detecção por amostra de páginas acerta com folga.
9. **Constância parte do zero.** Não há tracker em uso. O perfil de estudo como nota já é um padrão em uso (1 nota) e pode receber língua e nível.
10. **PDF primeiro.** O EPUB tem 1 livro, 1% de progresso e 0 grifos.
11. **O Library precisa de um motivo para voltar a ser aberto.** A leitura longa aconteceu de julho a setembro; desde outubro o uso é pontual. O recurso de língua seria esse motivo, não um complemento de um hábito ativo.

## O que não foi medido

- Tempo de leitura, sessões e páginas por sessão (não existe registro).
- Histórico do chat do leitor antes de 2026-10-22 e uso dos botões da barra de seleção.
- Caracteres pela extração do pdf.js (a medida é do `pypdf`) e hifenização no texto corrido das páginas (só nos grifos).
- Custo em dinheiro e duração real do áudio: dependem do provedor e da voz (outra exploração). As horas daqui são estimativa a 150 palavras por minuto.
- Qualquer número sobre texto em francês: não há livro em francês na biblioteca para calibrar.

## Dificuldade

Não se aplica. É um levantamento de dados, sem implementação.

## Recomendações para o escopo do estudo

- Dizer no estudo que a proposta parte de **uso zero** de língua no app, e propor um teste curto com um livro em francês real (camada de texto, seleção, uma página de áudio) antes de fechar as fases.
- Orçar o áudio **por página e por sessão de leitura**, com o livro inteiro só como teto.
- Tratar a **limpeza do texto** (juntar linhas, tirar número de verso, cabeçalho e rodapé) como pré-requisito de ouvir e traduzir, não como detalhe.
- Manter o vocabulário **separado do grifo e das cores**.
- Como não há telemetria, o próprio registro de vocabulário com data (e um tracker vinculado, se o Coordenador quiser) é a forma de medir depois se o recurso é usado.
