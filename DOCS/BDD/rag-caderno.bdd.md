# BDD - RAG por Caderno (Upload de Documentos)

## Historias de usuario

### HU-01 - Fazer upload de documento em um Caderno
Prioridade: Alta

Como usuario do Monet
Quero fazer upload de um PDF ou documento de texto em um Caderno
Para que o conteudo desse documento esteja disponivel como contexto para a IA

### HU-02 - Acompanhar o processamento do documento carregado
Prioridade: Alta

Como usuario do Monet
Quero ver o estado de processamento de um documento que fiz upload
Para saber quando ele estara disponivel para ser usado pela IA

### HU-03 - Listar documentos associados a um Caderno
Prioridade: Alta

Como usuario do Monet
Quero ver quais documentos estao associados ao Caderno atual
Para gerenciar as fontes de contexto da IA disponíveis nesse Caderno

### HU-04 - Remover documento de um Caderno
Prioridade: Media

Como usuario do Monet
Quero remover um documento do Caderno
Para descartar fontes que nao sao mais relevantes ou foram subidos por engano

### HU-05 - IA usa documentos do Caderno como contexto nas respostas
Prioridade: Alta

Como usuario do Monet
Quero que a IA use o conteudo dos documentos do Caderno ao responder /comandos
Para receber respostas embasadas nos materiais que subi, nao apenas no que anotei

### HU-06 - Saber quais trechos de documento embasaram a resposta da IA
Prioridade: Media

Como usuario do Monet
Quero identificar quais documentos ou trechos foram usados pela IA para gerar a resposta
Para avaliar a qualidade da resposta e entender sua origem

### HU-07 - Acessar os documentos de um Caderno de forma rapida
Prioridade: Alta

Como usuario do Monet
Quero acessar a lista de documentos de um Caderno diretamente pela lista de cadernos
Para gerenciar os arquivos sem precisar sair do fluxo de trabalho

---

## Decisoes tecnicas

| Decisao | Escolha | Motivo |
|---|---|---|
| Geracao de embeddings | OpenRouter — `google/gemini-embedding-2-preview` | Reutiliza a chave e infraestrutura ja existente no Monet; qualidade superior (ate 3.072 dimensoes); custo desprezivel (~$0,02 por livro); sem dependencia de modelo local |
| Dimensoes do embedding | 768 | Equilibrio entre qualidade e tamanho de armazenamento; recomendado pelo Google para uso em producao |
| Banco vetorial | `sqlite-vec` (extensao SQLite) | Mantem SQLite como unico banco; adiciona busca KNN com indice e aceleracao SIMD; elimina o O(n) scan da abordagem BLOB crua; sem infraestrutura nova |
| Privacidade | Conteudo indexado trafega para servidores Google via OpenRouter | Decisao consciente para app de estudo pessoal; usuario deve ser informado |
| Indexacao assincrona | Sim — processamento em background (Tauri command em thread separada) | Permite upload de livros completos sem travar a UI; usuario continua usando o app durante a indexacao |

> **Dependencia de internet na indexacao:** a geracao de embeddings via OpenRouter requer conexao ativa no momento do processamento do documento. A busca semantica e as respostas da IA continuam funcionando offline apos a indexacao concluida.

---

## Cenarios BDD

```gherkin
Feature: RAG por Caderno — Upload e Uso de Documentos como Contexto
  Como usuario do Monet
  Quero associar documentos a um Caderno
  Para que a IA use seu conteudo como contexto ao responder /comandos nas notas desse Caderno

  # --- Upload de documentos ---

  Scenario: Acessar a area de documentos de um Caderno
    Given que o usuario selecionou um Caderno
    When o usuario abrir a area de documentos do Caderno
    Then o sistema deve exibir a lista de documentos associados a esse Caderno
    And o sistema deve exibir uma acao para adicionar novo documento

  Scenario: Fazer upload de um PDF em um Caderno
    Given que o usuario esta na area de documentos de um Caderno
    When o usuario selecionar um arquivo PDF valido e confirmar o upload
    Then o documento deve aparecer na lista com o nome do arquivo
    And o sistema deve indicar que o documento esta sendo processado
    And o documento nao deve ser usado como contexto pela IA antes do processamento ser concluido

  Scenario: Fazer upload de um arquivo de texto simples
    Given que o usuario esta na area de documentos de um Caderno
    When o usuario selecionar um arquivo .txt valido e confirmar o upload
    Then o documento deve aparecer na lista com o nome do arquivo
    And o sistema deve indicar que o documento esta sendo processado

  Scenario: Tentar fazer upload de tipo de arquivo nao suportado
    Given que o usuario esta na area de documentos de um Caderno
    When o usuario tentar selecionar um arquivo com formato nao suportado
    Then o sistema deve recusar o arquivo antes do envio
    And o sistema deve informar quais formatos sao aceitos
    And nenhum documento invalido deve aparecer na lista

  Scenario: Processamento concluido com sucesso
    Given que o usuario fez upload de um documento valido
    And que o sistema terminou de extrair e indexar o conteudo
    When o processamento for concluido
    Then o documento deve exibir estado disponivel na lista
    And o documento deve passar a ser elegivel como contexto da IA

  Scenario: Falha no processamento do documento
    Given que o usuario fez upload de um documento
    And que o processamento encontrou um erro
    When a falha for detectada
    Then o documento deve exibir estado de erro na lista
    And o sistema deve informar que o documento nao esta disponivel como contexto
    And o usuario deve ter a opcao de tentar o upload novamente

  Scenario: Falha na API de embedding durante o processamento
    Given que o usuario fez upload de um documento valido
    And que a extracao de texto foi concluida com sucesso
    And que a API de embedding do OpenRouter retornou erro durante a indexacao
    When a falha for detectada
    Then o documento deve exibir estado de erro na lista
    And o sistema deve informar que a indexacao falhou e pode ser tentada novamente
    And nenhum chunk parcialmente indexado deve ser usado como contexto

  Scenario: Tentar indexar documento sem conexao com internet
    Given que o usuario fez upload de um documento
    And que nao ha conexao com internet disponivel no momento
    When o sistema tentar gerar os embeddings via OpenRouter
    Then o documento deve exibir estado de erro na lista
    And o sistema deve informar que a indexacao requer conexao com internet
    And o usuario deve ter a opcao de tentar novamente quando a conexao for restaurada

  Scenario: Exibir progresso durante o processamento
    Given que um documento esta sendo processado
    When o usuario visualizar a area de documentos do Caderno
    Then o sistema deve exibir o estado atual de processamento desse documento
    And o usuario deve conseguir distinguir documentos prontos de documentos em processamento

  # --- Gerenciamento de documentos ---

  Scenario: Listar documentos disponiveis no Caderno
    Given que o usuario tem documentos associados ao Caderno atual
    When o usuario abrir a area de documentos
    Then o sistema deve exibir todos os documentos desse Caderno
    And cada documento deve exibir seu nome e estado atual
    And o usuario nao deve ver documentos de outros Cadernos

  Scenario: Caderno sem documentos associados
    Given que o Caderno atual nao tem nenhum documento associado
    When o usuario abrir a area de documentos
    Then o sistema deve informar que nenhum documento foi adicionado ainda
    And o usuario deve conseguir iniciar o upload a partir dessa tela

  Scenario: Remover um documento do Caderno
    Given que o usuario visualiza um documento disponivel na lista do Caderno
    When o usuario acionar a remocao desse documento e confirmar a acao
    Then o documento deve ser removido da lista
    And seus dados indexados devem ser excluidos
    And o documento nao deve mais ser usado como contexto pela IA nas respostas futuras

  Scenario: Cancelar remocao de documento
    Given que o usuario acionou a remocao de um documento
    When o usuario cancelar a confirmacao
    Then o documento deve permanecer na lista sem alteracao

  # --- Uso do RAG nos /comandos ---

  Scenario: IA usa documentos do Caderno ao processar /comando
    Given que o Caderno atual tem ao menos um documento com estado disponivel
    And que o usuario esta editando uma nota dentro desse Caderno
    When o usuario executar um /comando valido na nota
    Then o sistema deve recuperar trechos relevantes dos documentos do Caderno
    And os trechos recuperados devem ser incluidos no contexto enviado ao modelo
    And a resposta da IA deve poder referenciar informacoes presentes nos documentos

  Scenario: IA responde sem documentos disponíveis no Caderno
    Given que o Caderno atual nao tem documentos com estado disponivel
    And que o usuario esta editando uma nota dentro desse Caderno
    When o usuario executar um /comando valido na nota
    Then o sistema deve processar o /comando normalmente sem contexto de documentos
    And a resposta nao deve ser bloqueada pela ausencia de documentos
    And o usuario nao deve receber nenhum erro relacionado ao RAG

  Scenario: /comando executado enquanto documento ainda esta em processamento
    Given que o Caderno atual tem um documento em processamento
    And que o usuario esta editando uma nota dentro desse Caderno
    When o usuario executar um /comando valido na nota
    Then o sistema deve processar o /comando sem incluir o documento ainda nao disponivel
    And o usuario nao deve receber erro causado pelo documento em processamento

  Scenario: Indicar fontes usadas na resposta da IA
    Given que a IA usou trechos de ao menos um documento para gerar a resposta
    When a resposta for exibida no Painel IA
    Then o card da resposta deve indicar que documentos do Caderno foram utilizados como contexto
    And o usuario deve conseguir identificar a origem sem precisar sair do Painel IA

  Scenario: Resposta gerada sem uso de documentos
    Given que o /comando foi processado sem recuperar trechos de documentos
    When a resposta for exibida no Painel IA
    Then o card da resposta nao deve exibir indicacao de uso de documentos
    And o usuario deve conseguir distinguir respostas com e sem contexto de documentos

  # --- Isolamento entre Cadernos ---

  Scenario: Documentos de um Caderno nao influenciam outro
    Given que existem dois Cadernos com documentos distintos
    And que o usuario esta com uma nota do Caderno A selecionada
    When o usuario executar um /comando
    Then o sistema deve recuperar trechos apenas dos documentos do Caderno A
    And nenhum documento do Caderno B deve ser incluido como contexto

  # --- Interface: icone e modal de documentos ---

  Scenario: Exibir icone de documento no item do Caderno
    Given que o usuario esta visualizando a lista de cadernos
    When o usuario passar o cursor sobre um caderno
    Then um icone de documento deve aparecer no item desse caderno
    And o icone deve estar sempre visivel quando o caderno estiver ativo
    And o icone deve estar oculto em repouso nos cadernos inativos

  Scenario: Abrir modal de documentos pelo icone
    Given que o usuario visualiza a lista de cadernos
    When o usuario clicar no icone de documento de um caderno
    Then esse caderno deve se tornar o caderno ativo
    And um modal centralizado deve ser aberto exibindo os documentos desse caderno

  Scenario: Modal exibe tabela de documentos do Caderno
    Given que o usuario abriu o modal de documentos de um caderno com arquivos associados
    When o modal for exibido
    Then o modal deve exibir o nome do caderno no titulo
    And o modal deve exibir uma tabela com todos os documentos desse caderno
    And cada linha da tabela deve exibir o nome do arquivo, o status atual e um botao de remocao
    And o modal deve exibir um botao para adicionar novo documento

  Scenario: Modal exibe estado vazio quando Caderno nao tem documentos
    Given que o caderno nao possui nenhum documento associado
    When o usuario abrir o modal de documentos desse caderno
    Then o modal deve exibir uma mensagem informando que nenhum documento foi adicionado
    And o modal deve exibir o botao de adicionar documento em destaque
    And a mensagem deve explicar que os documentos sao usados como contexto da IA

  Scenario: Status disponivel exibido na tabela
    Given que o modal de documentos esta aberto
    And que um documento foi indexado com sucesso
    When o usuario visualizar a linha desse documento
    Then o status deve exibir indicador visual de disponivel
    And a cor do indicador deve ser distinta de indexando e erro

  Scenario: Status indexando exibido na tabela com animacao
    Given que o modal de documentos esta aberto
    And que um documento ainda esta sendo processado
    When o usuario visualizar a linha desse documento
    Then o status deve exibir indicador visual de indexando em andamento
    And o indicador deve ter animacao que comunique processamento continuo
    And o botao de remocao desse documento deve permanecer disponivel

  Scenario: Status de erro exibido na tabela com opcao de retentar
    Given que o modal de documentos esta aberto
    And que um documento falhou na indexacao
    When o usuario visualizar a linha desse documento
    Then o status deve exibir indicador visual de erro
    And a linha deve exibir um botao de retentar a indexacao
    And ao clicar em retentar o sistema deve reiniciar o processamento sem exigir novo upload do arquivo

  Scenario: Fazer upload de documento pelo modal
    Given que o modal de documentos esta aberto
    When o usuario clicar no botao de adicionar documento
    Then o sistema deve abrir o seletor de arquivos nativo do sistema operacional
    And apos a selecao de um arquivo valido o documento deve aparecer imediatamente na tabela com status indexando
    And o modal deve permanecer aberto durante o processamento

  Scenario: Remover documento pelo modal
    Given que o modal de documentos esta aberto
    And que existe ao menos um documento na tabela
    When o usuario clicar no botao de remocao de um documento e confirmar a acao
    Then o documento deve ser removido da tabela
    And seus dados indexados devem ser excluidos

  Scenario: Fechar modal sem perder estado
    Given que o modal de documentos esta aberto com documentos em processamento
    When o usuario fechar o modal
    Then o modal deve ser fechado
    And o processamento em andamento deve continuar em background
    And ao reabrir o modal o estado atualizado dos documentos deve ser exibido

  # --- Reaproveitamento para Chat (extensibilidade) ---

  Scenario: Documentos do Caderno ficam disponiveis para uso futuro no modo Chat
    Given que o usuario associou documentos a um Caderno
    And que os documentos estao com estado disponivel
    When o modo Chat for acessado com aquele Caderno selecionado como escopo
    Then o Chat deve conseguir recuperar os mesmos trechos indexados
    And o usuario nao deve precisar fazer novo upload dos documentos para usa-los no Chat
```

---

## Criterios de aceitacao

1. O usuario deve conseguir fazer upload de arquivos PDF e TXT em um Caderno a partir da area de documentos.
2. O sistema deve recusar formatos nao suportados antes do envio e informar quais formatos sao aceitos.
3. Apos o upload, o documento deve aparecer na lista com estado de processamento visivel.
4. Ao final do processamento bem-sucedido, o documento deve exibir estado disponivel e passar a ser elegivel como contexto da IA.
5. Em falha de processamento, o documento deve exibir estado de erro e o usuario deve poder tentar novamente.
6. A lista de documentos de um Caderno deve exibir apenas os documentos associados a esse Caderno, nunca de outros.
7. O usuario deve conseguir remover um documento com confirmacao previa; apos a remocao, seus dados indexados devem ser excluidos.
8. Ao executar um /comando em uma nota, o sistema deve recuperar trechos relevantes apenas dos documentos disponíveis no Caderno da nota.
9. Se nao houver documentos disponiveis no Caderno, o /comando deve ser processado normalmente sem erro.
10. Documentos em processamento nao devem ser incluidos como contexto em /comandos executados durante esse periodo.
11. O card de resposta no Painel IA deve indicar quando documentos do Caderno foram usados como contexto.
12. Os dados indexados dos documentos devem ser armazenados via sqlite-vec de forma que possam ser reutilizados pelo modo Chat sem novo upload.
13. Documentos de um Caderno nao devem influenciar respostas de /comandos executados em notas de outro Caderno.
14. A geracao de embeddings deve usar o modelo `google/gemini-embedding-2-preview` via OpenRouter com 768 dimensoes.
15. Em falha na API de embedding (erro de rede, API indisponivel ou sem internet), o documento deve exibir estado de erro com mensagem clara e possibilidade de retentar.
16. Chunks parcialmente indexados em caso de falha nao devem ser incluidos como contexto da IA.

---

## Glossario do dominio

- **Caderno:** unidade de organizacao principal do Monet; agrega notas e, nesta feature, documentos de referencia.
- **Documento:** arquivo enviado pelo usuario (PDF, TXT) e associado a um Caderno para uso como contexto da IA.
- **Upload:** acao de selecionar e enviar um arquivo do dispositivo para o Monet.
- **Processamento:** etapa pos-upload em que o sistema extrai texto, divide em chunks e gera embeddings para indexacao.
- **Chunk:** trecho de texto extraido de um documento, usado como unidade de recuperacao pelo RAG.
- **Embedding:** representacao vetorial de um chunk, gerada pelo modelo `google/gemini-embedding-2-preview` via OpenRouter com 768 dimensoes, usada para busca por similaridade semantica.
- **API de embedding:** servico externo (OpenRouter) responsavel por gerar os vetores a partir do texto; requer conexao com internet no momento da indexacao.
- **Indexacao:** processo de armazenar embeddings no sqlite-vec para permitir busca KNN eficiente.
- **sqlite-vec:** extensao SQLite que adiciona tabelas virtuais com busca por vizinhos mais proximos (KNN) e aceleracao SIMD; elimina a necessidade de varredura total dos vetores a cada consulta.
- **Estado disponivel:** condicao de um documento cujos chunks foram indexados com sucesso e podem ser usados como contexto.
- **Estado de processamento:** condicao temporaria de um documento enquanto sua indexacao ainda nao foi concluida.
- **Estado de erro:** condicao de um documento cuja indexacao falhou e que nao pode ser usado como contexto.
- **RAG (Retrieval-Augmented Generation):** tecnica que recupera trechos relevantes de documentos indexados e os inclui no contexto enviado ao modelo de IA, permitindo respostas embasadas em material especifico.
- **Recuperacao:** busca por chunks semanticamente proximos ao /comando ou mensagem do usuario, realizada antes de enviar o contexto ao modelo.
- **Contexto:** conjunto de informacoes enviadas ao modelo junto com o /comando, incluindo conteudo da nota e trechos de documentos recuperados.
- **Area de documentos:** secao da interface, acessivel pelo Caderno, onde o usuario gerencia os documentos associados.
- **Modo Chat:** modo de interacao futura do Monet onde o usuario conversa diretamente com a IA; deve poder reutilizar os documentos ja indexados em um Caderno.
- **Escopo do Caderno:** limitacao que garante que apenas documentos do Caderno atual sejam usados como contexto; documentos de outros Cadernos sao ignorados.
- **Card de resposta:** unidade visual no Painel IA que exibe uma resposta gerada, podendo indicar fontes de contexto usadas.
- **Icone de documento:** elemento visual no item de cada caderno na lista de cadernos; aparece no hover e fica sempre visivel no caderno ativo; ao ser clicado abre o Modal de documentos.
- **Modal de documentos:** janela centralizada que exibe a tabela de documentos associados ao caderno selecionado, com acoes de upload e remocao.
- **Tabela de documentos:** componente dentro do Modal de documentos que lista nome, status e acoes de cada arquivo associado ao caderno.
- **Status disponivel:** indicador visual (cor teal) que sinaliza que o documento foi indexado com sucesso e esta elegivel como contexto da IA.
- **Status indexando:** indicador visual animado (cor ambar) que sinaliza que o documento ainda esta sendo processado.
- **Status erro:** indicador visual (cor de alerta) que sinaliza falha na indexacao; acompanhado de botao de retentar.
- **Botao retentar:** acao disponivel em documentos com status erro que reinicia o processamento sem exigir novo upload do arquivo.

---

## Ambiguidades e decisoes pendentes

1. **Formatos suportados:** apenas PDF e TXT foram mencionados. Nao esta definido se DOCX, EPUB, ou outros formatos serao aceitos na fase inicial.
2. **Limite de tamanho de arquivo:** sem limite rigido definido; o processamento assincrono em background permite arquivos grandes como livros completos. A viabilidade pratica depende do rate limit da API de embedding do OpenRouter.
3. **Limite de documentos por Caderno:** nao esta definido se ha um maximo de documentos associaveis a um unico Caderno.
4. **Estrategia de chunking:** nao esta definido o tamanho de chunk (em tokens), sobreposicao (overlap) ou estrategia de divisao (por paragrafo, por tokens, por pagina). O limite de contexto do modelo de embedding e 8.192 tokens por chunk.
5. **Numero de chunks recuperados por /comando:** nao esta definido quantos chunks sao incluidos no contexto de cada solicitacao (top-k da busca KNN).
6. **Detalhamento das fontes exibidas:** nao esta definido se o card de resposta exibe apenas o nome do documento ou tambem o trecho especifico recuperado.
7. **Reprocessamento apos falha:** nao esta definido se o usuario aciona manualmente um novo upload ou se o sistema oferece um botao de retentar sem re-selecionar o arquivo.
8. **Comportamento ao excluir um Caderno com documentos:** nao esta definido se os documentos e seus chunks sao excluidos automaticamente em cascata ou se requerem exclusao manual previa.
9. **Escopo do RAG no modo Chat (futuro):** nao esta definido se o Chat permitira selecionar multiplos Cadernos simultaneamente ou apenas um por vez.
10. **Visibilidade do RAG na resposta:** nao esta definido se a indicacao de fontes e sempre exibida, opcional, ou controlavel pelo usuario por preferencia.
11. **Comportamento offline apos indexacao:** confirmado que a busca semantica funciona offline; porem nao esta definido se o sistema deve informar proativamente ao usuario que a indexacao de novos documentos exige internet.
12. **Visibilidade do icone de documento em cadernos inativos:** nao esta definido se o icone aparece apenas no hover ou se fica sempre visivel em todos os cadernos independente de estado.
13. **Selecao de caderno ao abrir o modal:** nao esta definido se clicar no icone de documento de um caderno inativo deve automaticamente seleciona-lo como caderno ativo ou apenas abrir o modal sem mudar a selecao atual.
14. **Comportamento do botao retentar:** definido que nao exige novo upload; porem nao esta definido se deve retentar imediatamente ou aguardar confirmacao do usuario.
