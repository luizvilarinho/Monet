# BDD - Sistema de Comandos

## Historias de usuario

### HU-01 - Detectar comandos no editor
Prioridade: Alta

Como usuario do Monet
Quero que o editor reconheca linhas iniciadas por /
Para usar comandos de IA sem sair do fluxo de escrita

### HU-02 - Receber ajuda ao digitar comandos
Prioridade: Alta

Como usuario do Monet
Quero ver autocomplete ao digitar /
Para descobrir rapidamente quais comandos posso executar

### HU-03 - Executar comandos diretamente no editor
Prioridade: Alta

Como usuario do Monet
Quero executar um comando ao pressionar Enter
Para acionar a IA sem depender de controles externos

### HU-04 - Acompanhar a resposta no painel IA
Prioridade: Alta

Como usuario do Monet
Quero ver a resposta do comando em streaming no painel IA
Para acompanhar o resultado em tempo real enquanto continuo estudando

### HU-05 - Usar diferentes tipos de comando
Prioridade: Alta

Como usuario do Monet
Quero contar com comandos especificos para diferentes intencoes
Para obter respostas adequadas ao tipo de ajuda que preciso

## Cenarios BDD

```gherkin
Feature: Sistema de comandos no editor
  Como usuario do Monet
  Quero acionar comandos de IA diretamente no editor
  Para obter respostas em streaming no painel IA sem interromper minha escrita

  Scenario: Detectar linha de comando ao iniciar com barra
    Given que o usuario esta editando uma nota no editor
    When ele iniciar uma linha com /
    Then o sistema deve reconhecer essa linha como uma linha de comando em potencial

  Scenario: Reconhecer comando apenas em linha isolada
    Given que o usuario esta editando uma nota no editor
    When ele digitar um texto iniciado por / no meio de um paragrafo
    Then o sistema nao deve tratar esse texto como comando

  Scenario: Tratar a linha inteira como comando
    Given que o usuario esta editando uma nota no editor
    When ele digitar um /comando em uma linha isolada
    Then a linha inteira deve ser interpretada como o comando informado

  Scenario: Nao tratar texto comum como comando
    Given que o usuario esta editando uma nota no editor
    When ele digitar uma linha que nao comeca com /
    Then o sistema nao deve tratar essa linha como comando

  Scenario: Exibir autocomplete ao digitar barra
    Given que o usuario esta editando uma nota no editor
    When ele digitar /
    Then o sistema deve exibir autocomplete com os comandos disponiveis
    And a lista deve conter /pesquisa, /quem, /definir, /resumir, /opiniao e /tabela

  Scenario: Filtrar autocomplete conforme digitacao
    Given que o autocomplete de comandos esta visivel
    When o usuario continuar digitando apos a barra
    Then a lista de sugestoes deve ser filtrada de acordo com o texto informado

  Scenario: Aceitar sugestao do autocomplete com Tab
    Given que o autocomplete de comandos esta visivel
    And que existe uma sugestao selecionada no autocomplete
    When o usuario pressionar Tab
    Then o sistema deve aceitar a sugestao selecionada
    And a linha do editor deve ser preenchida com o /comando escolhido

  Scenario: Executar comando valido ao pressionar Enter
    Given que o usuario digitou uma linha com um comando valido
    When ele pressionar Enter nessa linha
    Then o sistema deve iniciar uma solicitacao para a IA
    And a solicitacao deve usar o /comando informado na nota atual
    And a resposta deve ser enviada para exibicao no painel IA da nota atual
    And o sistema deve criar uma nova linha abaixo da linha do /comando
    And o cursor deve ser movido para a nova linha
    And a linha do /comando deve permanecer na nota com marcacao visual de comando executado

  Scenario: Nao executar comando invalido ao pressionar Enter
    Given que o usuario digitou uma linha iniciada por / com um comando nao reconhecido
    When ele pressionar Enter nessa linha
    Then o sistema nao deve iniciar nenhuma solicitacao para a IA
    And a linha deve ficar marcada com cor vermelha
    And o usuario deve conseguir perceber que o comando informado nao e valido

  Scenario: Executar comando com termo obrigatorio
    Given que o usuario digitou um comando que depende de um termo complementar
    When ele pressionar Enter com o comando preenchido corretamente
    Then o sistema deve iniciar uma solicitacao para a IA com base no termo informado

  Scenario: Manter linha do comando marcada apos execucao
    Given que o usuario executou um /comando valido em uma linha isolada
    When a execucao do comando for iniciada
    Then a linha do /comando deve permanecer visivel na nota
    And a linha deve ficar marcada com cor diferente para indicar que o comando foi executado

  Scenario: Informar comando incompleto quando faltar termo obrigatorio
    Given que o usuario digitou um comando que depende de um termo complementar
    And que o termo obrigatorio nao foi informado
    When ele pressionar Enter
    Then o sistema nao deve iniciar nenhuma solicitacao para a IA
    And a linha deve ficar marcada com cor vermelha
    And o usuario deve conseguir perceber que o comando esta incompleto

  Scenario: Manter comando invalido sem acao
    Given que o usuario digitou um comando invalido em uma linha isolada
    When o sistema identificar que o comando nao e suportado
    Then a linha deve permanecer na nota sem acionar nenhuma solicitacao para a IA
    And a linha deve ficar marcada com cor vermelha

  Scenario: Executar comando /pesquisa
    Given que o usuario digitou /pesquisa seguido de um termo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitacao para a IA usando o /comando /pesquisa
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /quem
    Given que o usuario digitou /quem seguido de um nome
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitacao para a IA usando o /comando /quem
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /definir
    Given que o usuario digitou /definir seguido de um termo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitacao para a IA usando o /comando /definir
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /resumir
    Given que o usuario digitou /resumir em uma nota com conteudo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitacao para a IA usando o /comando /resumir
    And a solicitacao deve usar o contexto da nota atual
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /opiniao
    Given que o usuario digitou /opiniao seguido de um tema
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitacao para a IA usando o /comando /opiniao
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /tabela
    Given que o usuario digitou /tabela seguido de um tema
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitacao para a IA usando o /comando /tabela
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Exibir resposta em streaming para comando executado
    Given que o usuario executou um comando valido
    And que a IA iniciou o retorno da resposta em partes
    When o streaming estiver em andamento
    Then o painel IA deve atualizar o conteudo progressivamente
    And o usuario deve conseguir acompanhar a resposta antes da conclusao total
    And o estado visual deve indicar que a resposta ainda nao foi concluida

  Scenario: Finalizar exibicao da resposta apos streaming completo
    Given que o painel IA esta exibindo uma resposta em streaming
    When o streaming for concluido com sucesso
    Then a resposta final deve permanecer visivel no painel IA como card de resposta da nota atual

  Scenario: Associar a resposta a nota onde o comando foi executado
    Given que o usuario executou um comando em uma nota especifica
    When a resposta for exibida no painel IA
    Then a resposta deve ficar associada a essa mesma nota
    And nao deve ser exibida como resultado de outra nota

  Scenario: Interromper streaming ao trocar de nota durante execucao de /comando
    Given que existe uma resposta em streaming em andamento para a nota atual
    When o usuario selecionar outra nota
    Then o streaming em andamento deve ser interrompido
    And o painel IA da nova nota deve exibir apenas os cards de resposta e informacoes associados a ela
    And nenhuma resposta em andamento da nota anterior deve continuar aparecendo na nota recem-selecionada

  Scenario: Exibir apenas o contexto da nota atual no painel IA
    Given que existem multiplas notas com anotacoes e respostas de IA diferentes
    When o usuario clicar em uma nota especifica
    Then ele deve ver as informacoes que anotou nessa nota
    And ele deve ver todos os cards de resposta gerados pela IA para essa mesma nota
    And ele nao deve ver conteudos ou respostas de IA pertencentes a outras notas
```

## Criterios de aceitacao

1. O editor deve detectar como comando toda linha isolada iniciada por `/`.
2. Linhas que nao comecam com `/` nao devem ser tratadas como comandos.
3. Texto iniciado por `/` no meio de um paragrafo nao deve ser tratado como comando.
4. Quando houver um /comando em linha isolada, a linha inteira deve ser interpretada como esse comando.
5. Ao digitar `/`, o sistema deve exibir autocomplete com todos os comandos disponiveis.
6. O autocomplete deve incluir `/pesquisa`, `/quem`, `/definir`, `/resumir`, `/opiniao` e `/tabela`.
7. O autocomplete deve filtrar as sugestoes conforme o usuario continua digitando.
8. Pressionar `Tab` com uma sugestao selecionada no autocomplete deve aceitar essa sugestao.
9. Pressionar `Enter` em uma linha com /comando valido deve iniciar uma solicitacao para a IA usando o /comando informado na nota atual.
10. Ao pressionar `Enter` em um /comando valido, o sistema deve criar uma nova linha abaixo e mover o cursor para ela.
11. A linha do /comando executado deve permanecer na nota com marcacao visual em cor diferente.
12. Pressionar `Enter` em uma linha com comando invalido nao deve iniciar nenhuma solicitacao para a IA.
13. Comando invalido deve permanecer na nota com cor vermelha e sem nenhuma acao associada.
14. Comandos que exigem termo complementar nao devem iniciar solicitacao para a IA sem esse termo.
15. Comando incompleto deve permanecer na nota com cor vermelha e sem nenhuma acao associada.
16. O comando `/resumir` deve usar o contexto da nota atual.
17. A resposta de um /comando executado deve ser exibida em streaming no painel IA da nota atual.
18. Durante o streaming, o conteudo deve ser atualizado progressivamente.
19. Durante o streaming, o usuario deve conseguir distinguir visualmente que a resposta ainda esta em andamento.
20. Ao fim do streaming, a resposta deve permanecer visivel como card de resposta da nota atual.
21. Cada resposta gerada por /comando deve ficar associada a nota em que o /comando foi executado.
22. Ao trocar de nota durante um streaming, a resposta em andamento da nota anterior deve ser interrompida.
23. Ao selecionar uma nota, o painel IA deve exibir apenas as anotacoes e os cards de resposta associados a essa nota.

## Glossario do dominio

- Monet: aplicacao desktop de notas com IA para apoio ao estudo.
- Editor: area principal onde o usuario escreve e edita o conteudo da nota.
- Linha de comando: linha do editor iniciada por `/` e interpretada como intencao de acionar a IA.
- Linha isolada: linha independente do editor cujo conteudo inteiro corresponde ao /comando digitado pelo usuario.
- Parser de comandos: comportamento do sistema que detecta e interpreta linhas de comando no editor.
- Autocomplete: lista de sugestoes exibida enquanto o usuario digita um comando.
- Sugestao selecionada: item atualmente destacado no autocomplete e elegivel para aceite por Tab.
- Comando valido: comando reconhecido entre as opcoes suportadas pelo sistema.
- Comando invalido: texto iniciado por `/` que nao corresponde a um comando suportado.
- Comando incompleto: comando reconhecido, mas sem os dados obrigatorios para execucao.
- /pesquisa: comando usado para solicitar uma busca rapida sobre um termo.
- /quem: comando usado para solicitar o perfil profissional de uma pessoa.
- /definir: comando usado para solicitar uma definicao tecnica concisa.
- /resumir: comando usado para resumir o conteudo da nota atual.
- /opiniao: comando usado para solicitar uma resposta opinativa sobre um tema.
- /tabela: comando usado para solicitar uma resposta formatada como tabela markdown.
- Painel IA: area lateral onde as respostas da IA sao exibidas.
- Nota atual: nota atualmente selecionada pelo usuario, cujo contexto e usado na execucao do /comando e na exibicao do painel IA.
- Streaming de resposta: envio progressivo da resposta em partes para exibicao em tempo real.
- Card de resposta: unidade visual exibida no painel IA para representar uma resposta gerada e associada a uma nota especifica.
- /comando: comando textual iniciado por `/` dentro da nota que aciona uma solicitacao de IA para a nota atual.
- Marcacao visual de comando executado: destaque em cor diferente aplicado a linha do /comando apos sua execucao.
- Marcacao visual de comando invalido: destaque em cor vermelha aplicado a linha cujo /comando nao e suportado.
- Marcacao visual de comando incompleto: destaque em cor vermelha aplicado a linha cujo /comando esta sem os dados obrigatorios para execucao.

## Ambiguidades e decisoes pendentes
