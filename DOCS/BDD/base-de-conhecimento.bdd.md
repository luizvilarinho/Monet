# BDD - Base de Conhecimento (RAG Global)

## Historias de usuario

### Modulo 1: Base de Conhecimento — Gerenciamento Global

#### HU-01 - Abrir o modal da Base de Conhecimento
Prioridade: Alta

Como usuario do Monet
Quero clicar em um botao fixo na interface que abre o modal da Base de Conhecimento
Para gerenciar meus documentos de referencia globais em qualquer momento

#### HU-02 - Fazer upload de documento na Base de Conhecimento
Prioridade: Alta

Como usuario do Monet
Quero fazer upload de um PDF, arquivo de texto ou Markdown na Base de Conhecimento
Para que o documento fique disponivel como contexto selecionavel em Cadernos e Pastas de Chat

#### HU-03 - Acompanhar o processamento de um documento da Base
Prioridade: Alta

Como usuario do Monet
Quero ver o estado de processamento de um documento recem enviado para a Base de Conhecimento
Para saber quando ele estara disponivel para selecao em Cadernos e Pastas

#### HU-04 - Listar documentos da Base de Conhecimento
Prioridade: Alta

Como usuario do Monet
Quero ver todos os documentos que fazem parte da minha Base de Conhecimento
Para ter visibilidade do acervo global e decidir o que usar em cada contexto

#### HU-05 - Excluir documento da Base de Conhecimento
Prioridade: Alta

Como usuario do Monet
Quero excluir um documento da Base de Conhecimento
Para remover fontes desatualizadas ou enviadas por engano

---

### Modulo 2: Visibilidade de Documentos no Caderno

#### HU-06 - Abrir o seletor de documentos de um Caderno
Prioridade: Alta

Como usuario do Monet
Quero acessar uma interface que lista os documentos da Base de Conhecimento com opcao de ativa-los para o Caderno atual
Para escolher quais fontes a IA deve consultar ao responder /comandos nesse Caderno

#### HU-07 - Marcar documento como visivel em um Caderno
Prioridade: Alta

Como usuario do Monet
Quero marcar um documento da Base como visivel para o Caderno atual
Para que a IA possa usar esse documento como contexto ao executar /comandos nesse Caderno

#### HU-08 - Desmarcar documento visivel em um Caderno
Prioridade: Alta

Como usuario do Monet
Quero desmarcar um documento que estava visivel para o Caderno atual
Para retirar aquela fonte do contexto da IA sem excluir o documento da Base

#### HU-09 - IA usa documentos visiveis ao executar /comandos no Caderno
Prioridade: Alta

Como usuario do Monet
Quero que a IA use apenas os documentos marcados como visiveis no Caderno ao responder /comandos
Para receber respostas embasadas nas fontes que escolhi para esse Caderno especificamente

---

### Modulo 3: Visibilidade de Documentos em Pastas de Chat

#### HU-10 - Abrir o seletor de documentos de uma Pasta
Prioridade: Alta

Como usuario do Monet
Quero acessar uma interface que lista os documentos da Base de Conhecimento com opcao de ativa-los para uma Pasta de Chat
Para escolher quais fontes a IA deve consultar ao responder no Chat dentro daquela Pasta

#### HU-11 - Marcar documento como visivel em uma Pasta de Chat
Prioridade: Alta

Como usuario do Monet
Quero marcar um documento da Base como visivel para uma Pasta de Chat
Para que a IA possa usar esse documento como contexto nas conversas dentro daquela Pasta

#### HU-12 - Desmarcar documento visivel em uma Pasta de Chat
Prioridade: Alta

Como usuario do Monet
Quero desmarcar um documento que estava visivel para uma Pasta de Chat
Para retirar aquela fonte do contexto da IA nas conversas daquela Pasta sem excluir o documento da Base

#### HU-13 - IA usa documentos visiveis ao responder em conversas dentro de Pasta
Prioridade: Alta

Como usuario do Monet
Quero que a IA use apenas os documentos marcados como visiveis na Pasta ao responder mensagens no Chat
Para receber respostas embasadas nas fontes que escolhi para aquele contexto especifico

#### HU-14 - Conversas fora de Pastas nao tem acesso a documentos RAG
Prioridade: Alta

Como usuario do Monet
Quero que conversas na lista solta do Chat nao usem documentos como contexto
Para garantir que o comportamento da IA fora de Pastas seja previsivel e baseado apenas na mensagem e no historico da conversa

---

## Decisoes tecnicas

| Decisao | Escolha | Motivo |
|---|---|---|
| Armazenamento de documentos | Arquivo fisico unico por documento armazenado no sistema local; metadados e embeddings no SQLite/sqlite-vec | Evita duplicacao: um mesmo documento indexado uma unica vez serve a todos os Cadernos e Pastas que o selecionam |
| Relacao documento-contexto | Tabela de associacao (N:M) entre documento e Caderno; tabela de associacao (N:M) entre documento e Pasta | Um documento pode ser visivel em multiplos Cadernos e Pastas simultaneamente sem reprocessamento |
| Impacto da exclusao de documento | Exclusao do documento remove o arquivo, seus chunks e embeddings, e todas as associacoes com Cadernos e Pastas | Garante consistencia: nao existem referencias orfas apos exclusao |
| Impacto da exclusao de Caderno | Exclusao do Caderno remove automaticamente em cascata todas as associacoes de visibilidade de documentos com aquele Caderno | Consistencia: nenhuma associacao orfa permanece apos exclusao do contexto |
| Impacto da exclusao de Pasta | Exclusao da Pasta remove automaticamente em cascata todas as associacoes de visibilidade de documentos com aquela Pasta, alem das conversas | Consistencia: mesma logica da exclusao de Caderno aplicada ao contexto de Chat |
| Documentos fora de Pastas | Conversas na lista solta do Chat nao tem acesso a nenhum documento RAG | Decisao de simplicidade: RAG requer escopo definido; lista solta e um contexto sem escopo |
| Processamento assincrono | Indexacao ocorre em background via Tauri command em thread separada | Permite envio de documentos grandes sem bloquear a UI |
| Botao da Base de Conhecimento | Fixo na interface, nao vinculado a Caderno nem a Pasta | Gerenciamento global unico; evita confusao com os contextos especificos de cada Caderno/Pasta |
| Selecao de visibilidade | Apenas documentos com estado disponivel podem ser selecionados como visiveis | Documentos em processamento ou com erro nao podem ser usados como contexto |

---

## Cenarios BDD

```gherkin
Feature: Base de Conhecimento — Gerenciamento Global de Documentos
  Como usuario do Monet
  Quero gerenciar uma Base de Conhecimento de documentos globais
  Para selecionar quais fontes cada Caderno ou Pasta de Chat pode usar como contexto da IA

  # =============================================================
  # Modulo 1: Base de Conhecimento — Gerenciamento Global
  # =============================================================

  # --- Acesso ao modal ---

  Scenario: Abrir o modal da Base de Conhecimento
    Given que o usuario esta em qualquer parte do app (Modo Caderno ou Modo Chat)
    When o usuario clicar no botao fixo da Base de Conhecimento na interface
    Then o modal da Base de Conhecimento deve ser exibido
    And o modal deve listar todos os documentos da Base com seus estados
    And o modal deve exibir uma acao para adicionar novo documento

  Scenario: Modal exibe estado vazio quando a Base nao tem documentos
    Given que o usuario nao enviou nenhum documento para a Base de Conhecimento
    When o usuario abrir o modal da Base de Conhecimento
    Then o modal deve exibir uma mensagem informando que nenhum documento foi adicionado
    And a mensagem deve explicar que documentos da Base podem ser selecionados em Cadernos e Pastas
    And o modal deve exibir o botao de adicionar documento em destaque

  Scenario: Fechar modal da Base de Conhecimento
    Given que o modal da Base de Conhecimento esta aberto
    When o usuario fechar o modal
    Then o modal deve ser fechado
    And o estado da lista de documentos deve ser preservado

  # --- Upload de documentos ---

  Scenario: Fazer upload de um PDF na Base de Conhecimento
    Given que o modal da Base de Conhecimento esta aberto
    When o usuario clicar no botao de adicionar documento
    And selecionar um arquivo PDF valido no seletor nativo do sistema operacional
    Then o documento deve aparecer na lista com o nome do arquivo
    And o sistema deve indicar que o documento esta sendo processado
    And o modal deve permanecer aberto durante o processamento

  Scenario: Fazer upload de um arquivo de texto simples na Base
    Given que o modal da Base de Conhecimento esta aberto
    When o usuario clicar no botao de adicionar documento
    And selecionar um arquivo .txt valido no seletor nativo do sistema operacional
    Then o documento deve aparecer na lista com o nome do arquivo
    And o sistema deve indicar que o documento esta sendo processado

  Scenario: Fazer upload de um arquivo Markdown na Base
    Given que o modal da Base de Conhecimento esta aberto
    When o usuario clicar no botao de adicionar documento
    And selecionar um arquivo .md valido no seletor nativo do sistema operacional
    Then o documento deve aparecer na lista com o nome do arquivo
    And o sistema deve indicar que o documento esta sendo processado

  Scenario: Tentar fazer upload de formato nao suportado na Base
    Given que o modal da Base de Conhecimento esta aberto
    When o usuario tentar selecionar um arquivo com formato nao suportado
    Then o sistema deve recusar o arquivo antes do envio
    And o sistema deve informar quais formatos sao aceitos
    And nenhum documento invalido deve aparecer na lista

  Scenario: Processamento concluido com sucesso na Base
    Given que o usuario fez upload de um documento valido para a Base
    And que o sistema terminou de extrair e indexar o conteudo
    When o processamento for concluido
    Then o documento deve exibir estado disponivel na lista
    And o documento deve passar a ser elegivel para selecao em Cadernos e Pastas

  Scenario: Falha no processamento de documento da Base
    Given que o usuario fez upload de um documento para a Base
    And que o processamento encontrou um erro
    When a falha for detectada
    Then o documento deve exibir estado de erro na lista
    And o sistema deve informar que o documento nao esta disponivel para selecao
    And o usuario deve ter a opcao de retentar o processamento sem novo upload

  Scenario: Falha na API de embedding durante o processamento na Base
    Given que o usuario fez upload de um documento valido para a Base
    And que a extracao de texto foi concluida com sucesso
    And que a API de embedding retornou erro durante a indexacao
    When a falha for detectada
    Then o documento deve exibir estado de erro na lista
    And o sistema deve informar que a indexacao falhou e pode ser tentada novamente
    And nenhum chunk parcialmente indexado deve ser usado como contexto

  Scenario: Tentar indexar documento da Base sem conexao com internet
    Given que o usuario fez upload de um documento para a Base
    And que nao ha conexao com internet disponivel no momento
    When o sistema tentar gerar os embeddings via API externa
    Then o documento deve exibir estado de erro na lista
    And o sistema deve informar que a indexacao requer conexao com internet
    And o usuario deve ter a opcao de retentar quando a conexao for restaurada

  Scenario: Exibir progresso durante o processamento de documento da Base
    Given que um documento esta sendo processado na Base de Conhecimento
    When o usuario visualizar o modal da Base de Conhecimento
    Then o sistema deve exibir o estado atual de processamento desse documento
    And o usuario deve conseguir distinguir documentos prontos de documentos em processamento

  # --- Listagem de documentos ---

  Scenario: Listar documentos da Base de Conhecimento
    Given que o usuario tem documentos na Base de Conhecimento
    When o usuario abrir o modal da Base de Conhecimento
    Then o sistema deve exibir todos os documentos da Base
    And cada documento deve exibir seu nome e estado atual

  Scenario: Status disponivel exibido na tabela da Base
    Given que o modal da Base de Conhecimento esta aberto
    And que um documento foi indexado com sucesso
    When o usuario visualizar a linha desse documento
    Then o status deve exibir indicador visual de disponivel
    And a cor do indicador deve ser distinta dos estados indexando e erro

  Scenario: Status indexando exibido na tabela da Base com animacao
    Given que o modal da Base de Conhecimento esta aberto
    And que um documento ainda esta sendo processado
    When o usuario visualizar a linha desse documento
    Then o status deve exibir indicador visual de indexando em andamento
    And o indicador deve ter animacao que comunique processamento continuo
    And o botao de exclusao desse documento deve permanecer disponivel

  Scenario: Status de erro exibido na tabela da Base com opcao de retentar
    Given que o modal da Base de Conhecimento esta aberto
    And que um documento falhou na indexacao
    When o usuario visualizar a linha desse documento
    Then o status deve exibir indicador visual de erro
    And a linha deve exibir um botao de retentar a indexacao
    And ao clicar em retentar o reprocessamento deve iniciar imediatamente sem exigir confirmacao adicional nem novo upload do arquivo

  Scenario: Documento concluido no seletor sem necessidade de reabrir
    Given que o seletor de documentos de um Caderno ou Pasta esta aberto
    And que um documento estava em estado de processamento quando o seletor foi aberto
    When o processamento desse documento for concluido com sucesso
    Then o documento deve automaticamente passar a estar disponivel para selecao dentro do seletor aberto
    And o usuario nao deve precisar fechar e reabrir o seletor para ver o documento como selecionavel

  # --- Exclusao de documentos ---

  Scenario: Excluir um documento da Base de Conhecimento
    Given que o modal da Base de Conhecimento esta aberto
    And que existe ao menos um documento na lista
    When o usuario clicar no botao de exclusao de um documento e confirmar a acao
    Then o documento deve ser removido da lista da Base
    And seus dados indexados (chunks e embeddings) devem ser excluidos
    And o documento deve deixar de aparecer como opcao selecionavel em qualquer Caderno ou Pasta

  Scenario: Excluir documento visivel em um ou mais Cadernos
    Given que um documento da Base esta marcado como visivel em ao menos um Caderno
    When o usuario excluir esse documento da Base de Conhecimento e confirmar
    Then o documento deve ser removido da Base
    And o documento deve deixar de estar visivel em todos os Cadernos onde estava selecionado
    And nenhum Caderno deve usar esse documento como contexto em /comandos futuros

  Scenario: Excluir documento visivel em uma ou mais Pastas de Chat
    Given que um documento da Base esta marcado como visivel em ao menos uma Pasta de Chat
    When o usuario excluir esse documento da Base de Conhecimento e confirmar
    Then o documento deve ser removido da Base
    And o documento deve deixar de estar visivel em todas as Pastas onde estava selecionado
    And nenhuma Pasta deve usar esse documento como contexto em mensagens futuras do Chat

  Scenario: Cancelar exclusao de documento da Base
    Given que o usuario acionou a exclusao de um documento da Base
    When o usuario cancelar a confirmacao
    Then o documento deve permanecer na lista sem alteracao
    And suas associacoes com Cadernos e Pastas devem ser preservadas

  Scenario: Fechar modal da Base com documentos em processamento
    Given que o modal da Base de Conhecimento esta aberto com documentos em processamento
    When o usuario fechar o modal
    Then o modal deve ser fechado
    And o processamento em andamento deve continuar em background
    And ao reabrir o modal o estado atualizado dos documentos deve ser exibido


  # =============================================================
  # Modulo 2: Visibilidade de Documentos no Caderno
  # =============================================================

  # --- Acesso ao seletor de documentos do Caderno ---

  Scenario: Abrir seletor de documentos de um Caderno sem documentos disponiveis na Base
    Given que o usuario esta no Modo Caderno com um Caderno selecionado
    And que a Base de Conhecimento nao possui nenhum documento com estado disponivel
    When o usuario clicar no icone do Caderno na coluna do caderno
    Then o modal seletor de documentos do Caderno deve ser exibido
    And o seletor deve informar que nenhum documento esta disponivel na Base de Conhecimento
    And o seletor deve oferecer um atalho para abrir o modal da Base de Conhecimento
    And ao clicar no atalho o seletor atual deve ser fechado e o modal da Base de Conhecimento deve abrir
    And os dois modais nunca devem estar abertos simultaneamente

  Scenario: Abrir seletor de documentos de um Caderno com documentos disponiveis na Base
    Given que o usuario esta no Modo Caderno com um Caderno selecionado
    And que a Base de Conhecimento possui ao menos um documento com estado disponivel
    When o usuario clicar no icone do Caderno na coluna do caderno
    Then o modal seletor de documentos do Caderno deve ser exibido
    And o seletor deve exibir uma tabela com todos os documentos da Base de Conhecimento
    And cada documento deve exibir seu nome
    And cada documento deve exibir um controle (checkbox ou toggle) indicando se esta visivel ou nao para esse Caderno
    And documentos em processamento ou com erro devem ser listados mas nao selecionaveis
    And os documentos devem ser exibidos na ordem em que vieram do banco de dados

  # --- Indicador visual no Caderno ---

  Scenario: Icone do Caderno em estado padrao sem documentos visiveis
    Given que o Caderno atual nao possui nenhum documento marcado como visivel
    When o usuario visualizar a coluna do caderno
    Then o icone do Caderno deve estar no estado padrao (nao verde)

  Scenario: Icone do Caderno fica verde ao marcar ao menos um documento visivel
    Given que o usuario marcou ao menos um documento como visivel no Caderno atual
    When o usuario visualizar a coluna do caderno
    Then o icone do Caderno deve estar verde
    And o indicador verde deve sinalizar que aquele Caderno possui documentos da Base selecionados

  Scenario: Icone do Caderno volta ao estado padrao ao desmarcar todos os documentos visiveis
    Given que o Caderno atual possui exatamente um documento visivel e seu icone esta verde
    When o usuario desmarcar esse documento no seletor
    Then o icone do Caderno deve voltar ao estado padrao (nao verde)

  # --- Marcar e desmarcar visibilidade no Caderno ---

  Scenario: Marcar documento como visivel em um Caderno
    Given que o seletor de documentos de um Caderno esta aberto
    And que um documento disponivel da Base nao esta visivel para esse Caderno
    When o usuario marcar esse documento como visivel
    Then o documento deve aparecer como visivel no seletor desse Caderno
    And esse documento deve passar a ser usado como contexto em /comandos executados nesse Caderno

  Scenario: Desmarcar documento visivel em um Caderno
    Given que o seletor de documentos de um Caderno esta aberto
    And que um documento disponivel esta visivel para esse Caderno
    When o usuario desmarcar esse documento
    Then o documento deve aparecer como nao visivel no seletor desse Caderno
    And esse documento nao deve mais ser usado como contexto em /comandos executados nesse Caderno
    And o documento deve permanecer na Base de Conhecimento sem alteracao

  Scenario: Documento marcado como visivel em um Caderno nao afeta outros Cadernos
    Given que o usuario marcou um documento como visivel no Caderno A
    When o usuario abrir o seletor de documentos do Caderno B
    Then o documento deve aparecer como nao visivel para o Caderno B
    And a visibilidade do Caderno A nao deve ter sido alterada

  Scenario: Um mesmo documento pode estar visivel em multiplos Cadernos simultaneamente
    Given que um documento da Base esta visivel no Caderno A
    When o usuario marcar esse mesmo documento como visivel no Caderno B
    Then o documento deve estar visivel tanto no Caderno A quanto no Caderno B
    And ambos os Cadernos devem usar esse documento como contexto em /comandos

  # --- Comportamento da IA com documentos visiveis no Caderno ---

  Scenario: IA usa documentos visiveis do Caderno ao processar /comando
    Given que o Caderno atual tem ao menos um documento com estado disponivel marcado como visivel
    And que o usuario esta editando uma nota dentro desse Caderno
    When o usuario executar um /comando valido na nota
    Then o sistema deve recuperar trechos relevantes apenas dos documentos visiveis desse Caderno
    And os trechos recuperados devem ser incluidos no contexto enviado ao modelo
    And a resposta da IA deve poder referenciar informacoes presentes nos documentos visiveis

  Scenario: IA responde sem documentos visiveis no Caderno
    Given que o Caderno atual nao possui nenhum documento marcado como visivel
    And que o usuario esta editando uma nota dentro desse Caderno
    When o usuario executar um /comando valido na nota
    Then o sistema deve processar o /comando normalmente sem contexto de documentos
    And a resposta nao deve ser bloqueada pela ausencia de documentos visiveis
    And o usuario nao deve receber nenhum erro relacionado ao RAG

  Scenario: /comando executado enquanto documento visivel ainda esta em processamento
    Given que o Caderno atual tem um documento marcado como visivel mas ainda em processamento
    And que o usuario esta editando uma nota dentro desse Caderno
    When o usuario executar um /comando valido na nota
    Then o sistema deve processar o /comando sem incluir o documento ainda nao disponivel
    And o usuario nao deve receber erro causado pelo documento em processamento

  Scenario: Documentos visiveis de um Caderno nao influenciam outro
    Given que o Caderno A tem o documento "Manual de Biologia" marcado como visivel
    And que o Caderno B nao tem nenhum documento visivel
    And que o usuario esta com uma nota do Caderno B selecionada
    When o usuario executar um /comando
    Then o sistema deve processar o /comando sem contexto de documentos
    And o documento "Manual de Biologia" do Caderno A nao deve ser incluido como contexto

  Scenario: Indicar fontes usadas na resposta da IA no Caderno
    Given que a IA usou trechos de ao menos um documento visivel para gerar a resposta
    When a resposta for exibida no Painel IA
    Then o card da resposta deve indicar o trecho especifico recuperado e o nome do documento de origem
    And o usuario deve conseguir identificar a origem sem precisar sair do Painel IA

  Scenario: Resposta gerada sem uso de documentos no Caderno
    Given que o /comando foi processado sem recuperar trechos de documentos
    When a resposta for exibida no Painel IA
    Then o card da resposta nao deve exibir indicacao de uso de documentos
    And o usuario deve conseguir distinguir respostas com e sem contexto de documentos

  # --- Documento excluido da Base com Caderno usando-o ---

  Scenario: Caderno perde acesso a documento excluido da Base
    Given que um documento esta visivel no Caderno A
    When o usuario excluir esse documento da Base de Conhecimento
    Then o documento nao deve mais aparecer no seletor de documentos do Caderno A
    And /comandos futuros no Caderno A nao devem incluir esse documento como contexto


  # =============================================================
  # Modulo 3: Visibilidade de Documentos em Pastas de Chat
  # =============================================================

  # --- Acesso ao seletor de documentos da Pasta ---

  Scenario: Abrir seletor de documentos de uma Pasta de Chat sem documentos disponiveis na Base
    Given que o usuario esta no Modo Chat
    And que a Base de Conhecimento nao possui nenhum documento com estado disponivel
    When o usuario abrir o seletor de documentos de uma Pasta de Chat
    Then o modal seletor de documentos da Pasta deve ser exibido
    And o seletor deve informar que nenhum documento esta disponivel na Base de Conhecimento
    And o seletor deve oferecer um atalho para abrir o modal da Base de Conhecimento
    And ao clicar no atalho o seletor atual deve ser fechado e o modal da Base de Conhecimento deve abrir
    And os dois modais nunca devem estar abertos simultaneamente

  Scenario: Abrir seletor de documentos de uma Pasta de Chat com documentos disponiveis
    Given que o usuario esta no Modo Chat com uma Pasta selecionada na sidebar
    And que a Base de Conhecimento possui ao menos um documento com estado disponivel
    When o usuario abrir o seletor de documentos dessa Pasta
    Then o modal seletor de documentos da Pasta deve ser exibido
    And o seletor deve exibir uma tabela com todos os documentos da Base de Conhecimento
    And cada documento deve exibir seu nome
    And cada documento deve exibir um controle (checkbox ou toggle) indicando se esta visivel ou nao para essa Pasta
    And documentos em processamento ou com erro devem ser listados mas nao selecionaveis
    And os documentos devem ser exibidos na ordem em que vieram do banco de dados

  # --- Indicador visual na Pasta ---

  Scenario: Icone da Pasta em estado padrao sem documentos visiveis
    Given que uma Pasta de Chat nao possui nenhum documento marcado como visivel
    When o usuario visualizar essa Pasta na sidebar
    Then o icone de documentos da Pasta deve estar no estado padrao (nao verde)

  Scenario: Icone da Pasta fica verde ao marcar ao menos um documento visivel
    Given que o usuario marcou ao menos um documento como visivel em uma Pasta de Chat
    When o usuario visualizar essa Pasta na sidebar
    Then o icone de documentos da Pasta deve estar verde
    And o indicador verde deve sinalizar que aquela Pasta possui documentos da Base selecionados

  Scenario: Icone da Pasta volta ao estado padrao ao desmarcar todos os documentos visiveis
    Given que uma Pasta de Chat possui exatamente um documento visivel e seu icone esta verde
    When o usuario desmarcar esse documento no seletor
    Then o icone de documentos da Pasta deve voltar ao estado padrao (nao verde)

  # --- Marcar e desmarcar visibilidade na Pasta ---

  Scenario: Marcar documento como visivel em uma Pasta de Chat
    Given que o seletor de documentos de uma Pasta esta aberto
    And que um documento disponivel da Base nao esta visivel para essa Pasta
    When o usuario marcar esse documento como visivel
    Then o documento deve aparecer como visivel no seletor dessa Pasta
    And esse documento deve passar a ser usado como contexto nas conversas dentro dessa Pasta

  Scenario: Desmarcar documento visivel em uma Pasta de Chat
    Given que o seletor de documentos de uma Pasta esta aberto
    And que um documento disponivel esta visivel para essa Pasta
    When o usuario desmarcar esse documento
    Then o documento deve aparecer como nao visivel no seletor dessa Pasta
    And esse documento nao deve mais ser usado como contexto nas conversas dentro dessa Pasta
    And o documento deve permanecer na Base de Conhecimento sem alteracao

  Scenario: Documento visivel em uma Pasta nao afeta outras Pastas
    Given que o usuario marcou um documento como visivel na Pasta "Biologia"
    When o usuario abrir o seletor de documentos da Pasta "Historico"
    Then o documento deve aparecer como nao visivel para a Pasta "Historico"
    And a visibilidade da Pasta "Biologia" nao deve ter sido alterada

  Scenario: Um mesmo documento pode estar visivel em multiplas Pastas simultaneamente
    Given que um documento da Base esta visivel na Pasta "Biologia"
    When o usuario marcar esse mesmo documento como visivel na Pasta "Historico"
    Then o documento deve estar visivel tanto em "Biologia" quanto em "Historico"
    And ambas as Pastas devem usar esse documento como contexto nas conversas

  # --- Comportamento da IA com documentos visiveis na Pasta ---

  Scenario: IA usa documentos visiveis da Pasta ao responder mensagem no Chat
    Given que o usuario esta em uma conversa dentro de uma Pasta que tem ao menos um documento visivel disponivel
    When o usuario enviar uma mensagem no Chat
    Then o sistema deve recuperar trechos relevantes apenas dos documentos visiveis dessa Pasta
    And os trechos recuperados devem ser incluidos no contexto enviado ao modelo
    And a resposta da IA deve poder referenciar informacoes presentes nos documentos visiveis

  Scenario: IA responde sem documentos visiveis na Pasta
    Given que o usuario esta em uma conversa dentro de uma Pasta que nao possui nenhum documento visivel
    When o usuario enviar uma mensagem no Chat
    Then o sistema deve processar a mensagem normalmente sem contexto de documentos
    And a resposta nao deve ser bloqueada pela ausencia de documentos visiveis
    And o usuario nao deve receber nenhum erro relacionado ao RAG

  Scenario: Conversa fora de Pasta nao tem acesso a documentos RAG
    Given que o usuario esta em uma conversa na lista solta do Chat (fora de qualquer Pasta)
    When o usuario enviar uma mensagem no Chat
    Then o sistema deve processar a mensagem sem recuperar trechos de nenhum documento da Base
    And a resposta deve ser gerada sem contexto de documentos RAG
    And o usuario nao deve receber nenhum erro relacionado ao RAG

  Scenario: Documentos visiveis de uma Pasta nao influenciam outra
    Given que a Pasta "Biologia" tem o documento "Atlas de Botanica" marcado como visivel
    And que o usuario esta em uma conversa dentro da Pasta "Historico" sem documentos visiveis
    When o usuario enviar uma mensagem no Chat
    Then o sistema deve processar a mensagem sem contexto de documentos
    And o documento "Atlas de Botanica" da Pasta "Biologia" nao deve ser incluido como contexto

  Scenario: Conversa movida para Pasta com documentos visiveis passa a usa-los em mensagens futuras
    Given que existe uma conversa na lista solta do Chat
    And existe uma Pasta "Biologia" com o documento "Atlas de Botanica" visivel
    When o usuario mover essa conversa para a Pasta "Biologia"
    And o usuario enviar uma nova mensagem nessa conversa
    Then o sistema deve recuperar trechos do documento "Atlas de Botanica" como contexto
    And a resposta deve poder referenciar informacoes presentes nesse documento

  Scenario: Conversa retirada de Pasta deixa de usar documentos visiveis da Pasta em mensagens futuras
    Given que existe uma conversa dentro da Pasta "Biologia" que tem documentos visiveis
    When o usuario retirar essa conversa da Pasta e ela ir para a lista solta
    And o usuario enviar uma nova mensagem nessa conversa
    Then o sistema deve processar a mensagem sem contexto de documentos RAG
    And os documentos da Pasta "Biologia" nao devem ser incluidos como contexto

  Scenario: Indicar fontes usadas na resposta da IA no Chat
    Given que a IA usou trechos de ao menos um documento visivel para gerar a resposta no Chat
    When a resposta for exibida na conversa
    Then a resposta deve indicar o trecho especifico recuperado e o nome do documento de origem
    And o usuario deve conseguir identificar a origem sem sair da conversa
    And o indicador de contexto ativo deve estar verde igual ao comportamento do indicador no Caderno

  Scenario: Resposta gerada sem uso de documentos no Chat
    Given que a mensagem foi processada sem recuperar trechos de documentos
    When a resposta for exibida na conversa
    Then a resposta nao deve exibir indicacao de uso de documentos
    And o usuario deve conseguir distinguir respostas com e sem contexto de documentos

  # --- Documento excluido da Base com Pasta usando-o ---

  Scenario: Pasta perde acesso a documento excluido da Base
    Given que um documento esta visivel na Pasta "Biologia"
    When o usuario excluir esse documento da Base de Conhecimento
    Then o documento nao deve mais aparecer no seletor de documentos da Pasta "Biologia"
    And mensagens futuras dentro dessa Pasta nao devem incluir esse documento como contexto

  # --- Persistencia da visibilidade ---

  Scenario: Visibilidade de documentos em Cadernos persiste entre sessoes
    Given que o usuario marcou documentos como visiveis em um Caderno
    When o usuario fechar e reabrir o app
    Then os documentos marcados devem continuar visiveis nesse Caderno
    And os documentos nao marcados devem continuar nao visiveis

  Scenario: Visibilidade de documentos em Pastas persiste entre sessoes
    Given que o usuario marcou documentos como visiveis em uma Pasta de Chat
    When o usuario fechar e reabrir o app
    Then os documentos marcados devem continuar visiveis nessa Pasta
    And os documentos nao marcados devem continuar nao visiveis
```

---

## Criterios de aceitacao

### Modulo 1: Base de Conhecimento — Gerenciamento Global

1. O botao da Base de Conhecimento deve estar fixo na interface ao lado do botao de settings, na coluna do caderno, parte inferior da interface, acessivel a partir de qualquer modo do app (Caderno ou Chat).
2. O usuario deve conseguir fazer upload de arquivos PDF, TXT e MD (Markdown) na Base de Conhecimento a partir do modal.
3. O sistema deve recusar formatos nao suportados antes do envio e informar quais formatos sao aceitos.
4. Apos o upload, o documento deve aparecer na lista da Base com estado de processamento visivel.
5. Ao final do processamento bem-sucedido, o documento deve exibir estado disponivel e passar a ser elegivel para selecao em Cadernos e Pastas.
6. Em falha de processamento (incluindo falha de API ou ausencia de internet), o documento deve exibir estado de erro com mensagem clara e opcao de retentar sem novo upload e sem confirmacao adicional — o reprocessamento inicia imediatamente ao clicar.
7. Chunks parcialmente indexados em caso de falha nao devem ser usados como contexto da IA.
8. O usuario deve conseguir excluir um documento da Base com confirmacao previa.
9. Ao excluir um documento, seus dados indexados (chunks e embeddings) devem ser removidos e todas as associacoes com Cadernos e Pastas devem ser desfeitas automaticamente em cascata.
10. O modal deve exibir o estado atualizado dos documentos ao ser reaberto, inclusive de processamentos que ocorreram com o modal fechado.
11. Nao ha limite de tamanho de arquivo nem limite de quantidade de documentos na Base.
12. A estrategia de chunking e o numero de chunks recuperados por consulta (top-k) seguem os valores ja implementados no projeto.

### Modulo 2: Visibilidade de Documentos no Caderno

13. O seletor de documentos do Caderno e um modal que abre ao clicar no icone do Caderno na coluna do caderno; o mesmo icone ja utilizado hoje para envio de arquivo RAG no Caderno.
14. O modal seletor deve exibir uma tabela com todos os documentos da Base de Conhecimento, com um controle por linha para selecionar ou deselecionar a visibilidade daquele documento no Caderno atual.
15. Os documentos na tabela do seletor devem ser exibidos na ordem em que vierem do banco de dados, sem ordenacao adicional.
16. Documentos em processamento ou com erro devem aparecer no seletor mas nao devem ser selecionaveis.
17. Ao concluir o processamento de um documento, ele deve ficar automaticamente disponivel para selecao no seletor sem o usuario precisar fecha-lo e reabri-lo.
18. O usuario deve conseguir marcar e desmarcar documentos como visiveis; a selecao deve ser persistida entre sessoes.
19. O icone do Caderno deve ficar verde quando o Caderno possuir ao menos um documento visivel; deve voltar ao estado padrao quando nenhum documento estiver visivel.
20. Ao executar um /comando em uma nota, o sistema deve recuperar trechos apenas dos documentos marcados como visiveis nesse Caderno e com estado disponivel.
21. A resposta da IA deve indicar o trecho especifico recuperado e o nome do documento de origem.
22. Se nenhum documento estiver visivel no Caderno, o /comando deve ser processado normalmente sem erro.
23. A visibilidade de um documento em um Caderno nao deve afetar sua visibilidade em outros Cadernos.
24. Ao excluir um documento da Base, as associacoes com Cadernos devem ser removidas automaticamente em cascata e o documento nao deve ser incluido como contexto em /comandos futuros.
25. Ao excluir um Caderno, as associacoes de visibilidade de documentos com aquele Caderno devem ser removidas automaticamente em cascata.
26. O seletor vazio deve oferecer um atalho para abrir o modal da Base de Conhecimento; ao clicar, o seletor fecha e o modal da Base abre — nunca dois modais sobrepostos.

### Modulo 3: Visibilidade de Documentos em Pastas de Chat

27. O seletor de documentos da Pasta de Chat e um modal com a mesma aparencia e comportamento do seletor do Caderno: tabela com todos os documentos da Base e controle de selecao/deseleção por linha.
28. Os documentos na tabela do seletor devem ser exibidos na ordem em que vierem do banco de dados, sem ordenacao adicional.
29. Documentos em processamento ou com erro devem aparecer no seletor mas nao devem ser selecionaveis.
30. Ao concluir o processamento de um documento, ele deve ficar automaticamente disponivel para selecao no seletor sem o usuario precisar fecha-lo e reabri-lo.
31. O usuario deve conseguir marcar e desmarcar documentos como visiveis em uma Pasta; a selecao deve ser persistida entre sessoes.
32. O icone de documentos da Pasta deve ficar verde quando a Pasta possuir ao menos um documento visivel; deve voltar ao estado padrao quando nenhum documento estiver visivel — comportamento identico ao do Caderno.
33. Ao enviar uma mensagem em conversa dentro de uma Pasta, o sistema deve recuperar trechos apenas dos documentos marcados como visiveis nessa Pasta e com estado disponivel.
34. A resposta da IA deve indicar o trecho especifico recuperado e o nome do documento de origem; o indicador de contexto deve estar verde, igual ao comportamento no Caderno.
35. Se nenhum documento estiver visivel na Pasta, a mensagem deve ser processada normalmente sem erro.
36. Conversas na lista solta (fora de qualquer Pasta) nao devem ter acesso a nenhum documento RAG.
37. A visibilidade de um documento em uma Pasta nao deve afetar sua visibilidade em outras Pastas ou Cadernos.
38. Ao mover uma conversa para uma Pasta, mensagens futuras devem usar os documentos visiveis da Pasta de destino; ao retirar de uma Pasta, mensagens futuras nao devem usar documentos RAG.
39. Ao excluir um documento da Base, as associacoes com Pastas devem ser removidas automaticamente em cascata e o documento nao deve ser incluido como contexto em mensagens futuras.
40. Ao excluir uma Pasta, as associacoes de visibilidade de documentos com aquela Pasta devem ser removidas automaticamente em cascata.
41. O seletor vazio deve oferecer um atalho para abrir o modal da Base de Conhecimento; ao clicar, o seletor fecha e o modal da Base abre — nunca dois modais sobrepostos.

---

## Glossario do dominio

- **Base de Conhecimento:** repositorio global de documentos do usuario no Monet; nao esta vinculada a nenhum Caderno ou Pasta especifica; todo documento enviado pertence a Base antes de ser selecionado para uso em um contexto.
- **Documento:** arquivo enviado pelo usuario (PDF, TXT ou MD) para a Base de Conhecimento; pode ser selecionado como visivel em um ou mais Cadernos ou Pastas simultaneamente.
- **Upload:** acao de selecionar e enviar um arquivo do dispositivo para a Base de Conhecimento via modal.
- **Processamento:** etapa pos-upload em que o sistema extrai texto, divide em chunks e gera embeddings para indexacao; enquanto em processamento, o documento nao esta disponivel para selecao.
- **Chunk:** trecho de texto extraido de um documento, usado como unidade de recuperacao pelo RAG.
- **Embedding:** representacao vetorial de um chunk gerada via API externa; usada para busca por similaridade semantica.
- **API de embedding:** servico externo responsavel por gerar os vetores a partir do texto; requer conexao com internet no momento da indexacao.
- **Indexacao:** processo de armazenar embeddings no banco vetorial para permitir busca eficiente por similaridade.
- **Estado disponivel:** condicao de um documento cujos chunks foram indexados com sucesso; documento pode ser selecionado como visivel e usado como contexto.
- **Estado de processamento (indexando):** condicao temporaria de um documento enquanto sua indexacao ainda nao foi concluida; nao pode ser selecionado como visivel.
- **Estado de erro:** condicao de um documento cuja indexacao falhou; nao pode ser selecionado como visivel; oferece opcao de retentar que inicia o reprocessamento imediatamente ao clicar.
- **Botao da Base de Conhecimento:** elemento fixo na interface do Monet localizado ao lado do botao de settings na coluna do caderno, parte inferior da interface; abre o modal de gerenciamento global de documentos.
- **Modal da Base de Conhecimento:** janela centralizada que exibe a lista de todos os documentos da Base com seus estados, alem das acoes de upload e exclusao.
- **Visibilidade:** relacao entre um documento e um Caderno (ou Pasta) que determina se esse documento sera usado como contexto da IA naquele escopo; um documento visivel em um contexto pode nao ser visivel em outro.
- **Seletor de documentos do Caderno:** modal acessivel ao clicar no icone do Caderno na coluna do caderno; exibe uma tabela com todos os documentos da Base e controles de selecao/deseleção de visibilidade para o Caderno atual; atualiza automaticamente quando um documento conclui o processamento.
- **Seletor de documentos da Pasta:** modal identico em aparencia e comportamento ao seletor do Caderno, mas acessivel a partir de uma Pasta de Chat; exibe uma tabela com todos os documentos da Base e controles de selecao/deseleção de visibilidade para aquela Pasta.
- **Icone verde (Caderno):** indicador visual no icone do Caderno que sinaliza que aquele Caderno possui ao menos um documento da Base marcado como visivel; volta ao estado padrao quando nenhum documento estiver visivel.
- **Icone verde (Pasta):** indicador visual no icone de documentos da Pasta de Chat que sinaliza que aquela Pasta possui ao menos um documento da Base marcado como visivel; comportamento identico ao do Caderno; segue o mesmo padrao visual ja implementado para system prompt personalizado por pasta.
- **RAG (Retrieval-Augmented Generation):** tecnica que recupera trechos relevantes de documentos indexados e os inclui no contexto enviado ao modelo de IA, permitindo respostas embasadas em material especifico.
- **Recuperacao:** busca por chunks semanticamente proximos ao /comando ou mensagem do usuario, realizada antes de enviar o contexto ao modelo; restrita aos documentos visiveis no escopo atual; usa a estrategia de chunking e o top-k ja implementados no projeto.
- **Contexto:** conjunto de informacoes enviadas ao modelo junto com o /comando ou mensagem, incluindo trechos de documentos recuperados.
- **Indicacao de fonte:** informacao exibida na resposta da IA que identifica o trecho especifico recuperado e o nome do documento de origem; presente tanto no Painel IA (Caderno) quanto na conversa (Chat).
- **Escopo:** delimitacao que define quais documentos podem ser usados como contexto; no Caderno, o escopo e o proprio Caderno; no Chat, o escopo e a Pasta; na lista solta do Chat, nao ha escopo RAG.
- **Caderno:** unidade de organizacao principal do Monet no Modo Caderno; agrega notas e define quais documentos da Base sao visiveis para uso como contexto nos /comandos das notas.
- **Pasta de Chat:** agrupador de conversas no Modo Chat; define quais documentos da Base sao visiveis para uso como contexto nas conversas contidas nela.
- **Conversa:** sequencia de mensagens trocadas entre o usuario e a IA no Modo Chat; pode estar dentro de uma Pasta ou na lista solta.
- **Lista solta:** conjunto de conversas no Modo Chat que nao estao associadas a nenhuma Pasta; conversas na lista solta nao tem acesso a documentos RAG.
- **Modo Caderno:** modo principal do Monet onde o usuario escreve notas e executa /comandos; documentos visiveis no Caderno sao usados como contexto nesses /comandos.
- **Modo Chat:** modo de interacao direta com a IA no Monet; conversas podem ser organizadas em Pastas; documentos visiveis na Pasta sao usados como contexto nas mensagens.
- **/comando:** acao digitada em uma nota no Modo Caderno que instrui a IA a executar uma tarefa; o sistema recupera trechos dos documentos visiveis do Caderno antes de enviar o contexto ao modelo.
- **Associacao:** vinculo persistido entre um documento da Base e um Caderno ou Pasta que indica que o documento esta visivel naquele contexto; uma associacao pode ser criada ou removida sem afetar o documento na Base; removida em cascata ao excluir o Caderno, a Pasta ou o proprio documento.
- **Retentar:** acao disponivel em documentos com estado de erro que reinicia o processamento imediatamente ao clicar, sem confirmacao adicional nem novo upload do arquivo original.
- **Card de resposta:** unidade visual no Painel IA (Modo Caderno) ou na conversa (Modo Chat) que exibe uma resposta gerada; quando documentos foram usados como contexto, indica o trecho especifico e o nome do documento de origem.

---

## Decisoes tomadas

| # | Decisao |
|---|---|
| 1 | Formatos suportados: PDF, TXT e MD (Markdown) |
| 2 | Sem limite de tamanho de arquivo |
| 3 | Sem limite de quantidade de documentos na Base |
| 4 | Estrategia de chunking: usar a mesma ja implementada no projeto |
| 5 | Numero de chunks recuperados por consulta (top-k): usar o valor ja implementado no projeto |
| 6 | Indicacao de fonte na resposta: exibir o trecho especifico recuperado E o nome do documento |
| 7 | Posicao do botao da Base de Conhecimento: ao lado do botao de settings, na coluna do caderno, parte inferior da interface |
| 8 | Seletor do Caderno: modal que abre ao clicar no icone do Caderno (mesmo icone usado hoje para envio de arquivo RAG); exibe tabela com todos os documentos da Base e controle de selecao/deseleção por linha |
| 9 | Seletor da Pasta de Chat: identico ao seletor do Caderno (modal com tabela da Base e controle de selecao/deseleção por pasta) |
| 10 | Ordenacao dos documentos no seletor: sem ordenacao definida — exibir na ordem em que vier do banco |
| 11 | Indicador visual de documentos visiveis: icone verde no Caderno e na Pasta quando houver ao menos um documento visivel selecionado; referencia de implementacao: sistema de icone verde ja existente para system prompt personalizado por pasta |
| 12 | Excluir Pasta com documentos visiveis: associacoes de visibilidade removidas automaticamente em cascata |
| 13 | Excluir Caderno com documentos visiveis: associacoes de visibilidade removidas automaticamente em cascata |
| 14 | Documento concluindo processamento no seletor aberto: fica automaticamente disponivel para selecao sem o usuario precisar reabrir o seletor |
| 15 | Comportamento de retentar: reprocessamento inicia imediatamente ao clicar, sem confirmacao adicional |
| 16 | Indicacao de contexto no Chat: icone verde igual ao comportamento do Caderno |
| 17 | Atalho para Base no seletor vazio: ao clicar, o seletor atual fecha e o modal da Base abre — nunca dois modais sobrepostos |

---

## Ambiguidades e decisoes pendentes

Nenhuma pendencia. Todas as ambiguidades foram resolvidas.
