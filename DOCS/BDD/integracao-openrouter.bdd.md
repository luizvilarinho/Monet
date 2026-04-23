# BDD - Integracao com OpenRouter

## Historias de usuario

### HU-01 - Selecionar modelo real da IA
Prioridade: Alta

Como usuario do Monet
Quero selecionar um modelo real no painel de IA
Para decidir qual modelo sera usado nas respostas da assistente

### HU-02 - Receber resposta em streaming no painel IA
Prioridade: Alta

Como usuario do Monet
Quero acompanhar a resposta da IA em tempo real no painel IA
Para continuar meu fluxo de estudo sem esperar a resposta completa para comecar a ler

### HU-03 - Proteger a chave de API
Prioridade: Alta

Como usuario do Monet
Quero que minha chave da OpenRouter seja mantida fora do frontend
Para reduzir o risco de exposicao acidental de credenciais

### HU-04 - Ser informado quando a integracao falhar
Prioridade: Alta

Como usuario do Monet
Quero receber feedback claro quando houver erro de configuracao ou comunicacao com a IA
Para entender por que a resposta nao foi concluida e o que precisa ser corrigido

## Cenarios BDD

```gherkin
Feature: Integracao com OpenRouter
  Como usuario do Monet
  Quero usar modelos reais da OpenRouter no painel IA
  Para receber respostas em streaming com seguranca da chave de API

  Scenario: Exibir modelos reais disponiveis no seletor
    Given que o usuario abriu o Monet com o painel IA visivel
    And que existe acesso configurado aos modelos disponiveis para uso
    When o painel IA for carregado
    Then o seletor de modelo deve exibir modelos reais da OpenRouter
    And o seletor deve listar todos os modelos retornados em tempo real pela OpenRouter
    And os modelos exibidos nao devem depender de dados mockados
    And o seletor deve disponibilizar um campo de busca no topo para filtrar os modelos
    And o usuario deve conseguir identificar qual modelo esta selecionado

  Scenario: Filtrar modelos pelo campo de busca
    Given que o seletor de modelo exibe modelos reais retornados pela OpenRouter
    And que o campo de busca do seletor esta visivel
    When o usuario digitar um termo de busca
    Then o seletor deve exibir apenas os modelos compativeis com o filtro informado
    And o usuario deve continuar conseguindo selecionar um modelo entre os resultados filtrados

  Scenario: Usar o modelo selecionado em uma nova solicitacao
    Given que o painel IA exibe mais de um modelo disponivel
    And que o usuario selecionou um modelo especifico no seletor
    When o usuario iniciar uma nova solicitacao para a IA
    Then a solicitacao deve usar o modelo selecionado naquele momento
    And a resposta exibida deve corresponder a essa solicitacao

  Scenario: Exibir resposta em streaming no painel IA
    Given que o usuario iniciou uma solicitacao valida para a IA
    And que a OpenRouter comecou a retornar a resposta em partes
    When o streaming estiver em andamento
    Then o painel IA deve atualizar o conteudo progressivamente
    And o usuario deve conseguir acompanhar a resposta sem esperar a conclusao total
    And a resposta final deve permanecer visivel no painel apos o termino do streaming

  Scenario: Manter o painel IA responsivo durante o streaming
    Given que uma resposta em streaming esta em andamento
    When novos trechos da resposta forem recebidos
    Then o painel IA deve continuar exibindo a evolucao da resposta sem substituir o conteudo ja apresentado
    And o estado visual deve indicar que a resposta ainda nao foi concluida

  Scenario: Informar ausencia de chave de API configurada
    Given que nao existe chave de API valida configurada para a OpenRouter
    When o usuario visualizar o seletor de modelo
    Then o seletor deve exibir um aviso informando que e necessario cadastrar a chave do OpenRouter em Settings
    And o usuario deve conseguir acessar Settings a partir desse aviso

  Scenario: Abrir configuracao da chave de API a partir do aviso
    Given que nao existe chave de API valida configurada para a OpenRouter
    And que o seletor de modelo exibe um aviso para cadastrar a chave em Settings
    When o usuario clicar em Settings no aviso
    Then o sistema deve abrir um modal de Settings
    And o modal deve exibir o submenu Integracao OpenRouter
    And o submenu deve conter um campo para inserir a chave de API

  Scenario: Bloquear solicitacao sem chave de API configurada
    Given que nao existe chave de API valida configurada para a OpenRouter
    When o usuario executar um /comando na nota atual
    Then o sistema nao deve iniciar nenhuma solicitacao para a IA
    And o painel IA deve exibir uma mensagem clara informando que a chave de API nao esta configurada
    And o usuario nao deve receber uma resposta parcial como se a solicitacao tivesse sido processada com sucesso

  Scenario: Nao expor a chave de API no frontend
    Given que a integracao com a OpenRouter esta configurada
    When o frontend iniciar uma solicitacao para a IA
    Then a chave de API nao deve ficar acessivel em codigo de interface, configuracao publica ou variaveis expostas ao frontend
    And o frontend deve apenas acionar uma capacidade autorizada do aplicativo para realizar a solicitacao

  Scenario: Falha ao iniciar o streaming na OpenRouter
    Given que o usuario iniciou uma solicitacao para a IA
    And que ocorreu uma falha antes do recebimento do primeiro trecho da resposta
    When a tentativa de resposta for encerrada com erro
    Then o painel IA deve exibir uma mensagem de erro compreensivel
    And o usuario deve conseguir perceber que a resposta nao foi iniciada
    And nenhum conteudo incompleto deve ser apresentado como resposta final

  Scenario: Interrupcao do streaming apos resposta parcial
    Given que o painel IA ja esta exibindo uma resposta parcial em streaming
    When a conexao com a OpenRouter for interrompida antes da conclusao
    Then o painel IA deve preservar o conteudo parcial ja recebido
    And o painel IA deve informar que a resposta foi interrompida antes de terminar
    And o usuario deve conseguir distinguir uma resposta interrompida de uma resposta concluida com sucesso

  Scenario: Trocar de modelo nao altera resposta ja em andamento
    Given que existe uma resposta em streaming em andamento no painel IA
    When o usuario alterar o modelo selecionado no seletor
    Then a resposta ja iniciada deve continuar associada ao modelo usado no momento do envio
    And a nova selecao deve valer apenas para solicitacoes iniciadas depois da troca

  Scenario: Exibir historico de respostas da nota selecionada
    Given que existe uma nota com respostas de IA ja produzidas anteriormente
    When o usuario selecionar essa nota
    Then o painel IA deve exibir todos os cards de resposta associados a essa nota
    And o usuario nao deve ver no painel IA respostas pertencentes a outra nota

  Scenario: Persistir nova resposta no historico da nota
    Given que o usuario esta com uma nota selecionada
    When uma nova resposta da IA for concluida para essa nota
    Then a resposta deve permanecer visivel no painel IA como um novo card da nota
    And a resposta deve ficar persistida no historico dessa nota

  Scenario: Interromper streaming ao trocar de nota
    Given que existe uma resposta em streaming em andamento para a nota atual
    When o usuario selecionar outra nota
    Then o streaming em andamento deve ser interrompido
    And o painel IA da nova nota deve exibir apenas os cards e informacoes associados a ela
    And nenhuma resposta em andamento da nota anterior deve continuar aparecendo na nota recem-selecionada

  Scenario: Exibir contexto completo da nota selecionada no painel IA
    Given que existem multiplas notas com conteudos e respostas de IA diferentes
    When o usuario clicar em uma nota especifica
    Then ele deve ver as informacoes que anotou nessa nota
    And ele deve ver todos os cards de resposta gerados pela IA para essa mesma nota
    And ele nao deve ver conteudos ou respostas de IA pertencentes a outras notas

  Scenario: Nenhum modelo disponivel para selecao
    Given que o painel IA foi carregado
    And que nenhum modelo utilizavel esta disponivel para o usuario
    When o usuario visualizar o seletor de modelo
    Then o sistema deve informar que nao ha modelos disponiveis
    And o usuario nao deve conseguir iniciar uma solicitacao dependente de modelo ate que exista uma opcao valida
```

## Criterios de aceitacao

1. O seletor de modelo deve ser alimentado por dados reais da OpenRouter, substituindo os mocks atuais.
2. O seletor deve listar todos os modelos retornados em tempo real pela OpenRouter.
3. O seletor deve disponibilizar um campo de busca no topo para filtrar os modelos exibidos.
4. O modelo escolhido pelo usuario deve ser aplicado exatamente na proxima solicitacao iniciada.
5. O painel IA deve exibir a resposta em streaming de forma incremental, sem aguardar a conclusao total.
6. Ao final do streaming bem-sucedido, a resposta completa deve permanecer visivel no painel IA.
7. Durante o streaming, o usuario deve conseguir distinguir visualmente que a resposta ainda esta em andamento.
8. Se nao houver chave de API configurada, o seletor de modelo deve exibir um aviso orientando o cadastro em Settings.
9. Ao clicar em Settings a partir do aviso, o sistema deve abrir um modal com o submenu Integracao OpenRouter e um campo para inserir a chave.
10. Sem chave de API configurada, a execucao de um /comando nao deve iniciar nenhuma solicitacao para a IA e o usuario deve receber feedback claro.
11. A chave de API nao deve ser exposta no frontend, nem em variaveis publicas de configuracao da interface.
12. Em erro antes do primeiro trecho, o painel IA deve mostrar falha sem apresentar resposta como concluida.
13. Em erro apos inicio do streaming, o painel IA deve manter o conteudo parcial e indicar interrupcao.
14. Alterar o modelo durante uma resposta em andamento nao deve mudar retroativamente a resposta ja iniciada.
15. Se nao houver modelos disponiveis, o seletor deve comunicar esse estado e bloquear solicitacoes dependentes de modelo.
16. O painel IA deve exibir o historico de cards de resposta associado exclusivamente a nota atualmente selecionada.
17. Novas respostas geradas para a nota selecionada devem permanecer persistidas e visiveis no historico dessa nota.
18. Ao trocar de nota durante um streaming, a resposta em andamento da nota anterior deve ser interrompida.
19. Ao selecionar uma nota, o usuario deve ver apenas o contexto dessa nota, incluindo suas anotacoes e respostas de IA associadas.

## Glossario do dominio

- Monet: aplicacao desktop de notas com painel de IA para apoio ao estudo.
- Painel IA: area lateral da interface onde o usuario acompanha respostas da assistente.
- Seletor de modelo: controle da interface usado para escolher qual modelo de IA sera utilizado.
- Modelo: opcao de IA disponibilizada pela OpenRouter, como Claude, GPT ou Gemini via identificador de modelo.
- OpenRouter: gateway de IA usado pelo Monet para acessar diferentes modelos por uma unica integracao.
- Streaming de resposta: envio progressivo da resposta em partes, permitindo exibicao em tempo real.
- Chave de API: credencial necessaria para autenticar o acesso a OpenRouter.
- Settings: area de configuracoes do aplicativo acessivel por modal.
- Integracao OpenRouter: submenu de Settings destinado a configuracao da chave da OpenRouter.
- Frontend: camada de interface em React executada no aplicativo.
- Backend Tauri: camada nativa do aplicativo, responsavel por capacidades seguras fora da interface.
- Solicitacao para IA: acao iniciada pelo usuario que pede uma resposta do modelo selecionado.
- Resposta parcial: conteudo recebido antes da conclusao total do streaming.
- Resposta concluida: conteudo final entregue com sucesso ao fim do streaming.
- Card de resposta: unidade visual exibida no painel IA para representar uma resposta gerada.
- Historico da nota: conjunto de cards de resposta IA persistidos e vinculados a uma nota especifica.
- /comando: comando textual iniciado por `/` dentro da nota que aciona uma solicitacao de IA para a nota atual.

## Ambiguidades e decisoes pendentes

3. Nao esta definido qual mensagem exata deve ser exibida para cada tipo de falha, como ausencia de chave, erro de rede, limite excedido ou modelo indisponivel.
4. Nao esta definido se o usuario pode iniciar mais de uma solicitacao simultanea no painel IA.
6. Nao esta definido se a indisponibilidade momentanea da lista de modelos deve permitir uso de ultimo modelo conhecido ou bloquear totalmente a funcionalidade.
