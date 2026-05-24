# BDD - Cancelar Resposta em Andamento

## Historias de usuario

### HU-01 - Cancelar uma resposta que esta demorando mais do que o esperado
Prioridade: Alta

Como usuario do Monet
Quero poder interromper uma resposta em andamento
Para nao ficar preso aguardando uma resposta longa ou desnecessaria

### HU-02 - Recuperar o controle do chat apos cancelar
Prioridade: Alta

Como usuario do Monet
Quero poder enviar uma nova mensagem imediatamente apos cancelar a resposta
Para reformular minha pergunta sem precisar esperar ou recarregar o painel

### HU-03 - Consultar o conteudo parcial da resposta cancelada
Prioridade: Media

Como usuario do Monet
Quero que o conteudo ja produzido ate o momento do cancelamento fique visivel
Para aproveitar ou avaliar o que foi gerado antes de refazer a solicitacao

## Cenarios BDD

```gherkin
Feature: Cancelar Resposta em Andamento
  Como usuario do Monet
  Quero poder cancelar uma resposta que esta sendo gerada
  Para retomar o controle do chat sem aguardar a conclusao

  # --- Exibicao do botao Stop durante o streaming ---

  Scenario: Transformar botao Send em Stop durante o streaming
    Given que o usuario enviou uma mensagem no chat
    When a resposta comecar a ser gerada
    Then o botao de envio deve ser substituido pelo botao Stop
    And o botao Stop deve exibir o icone de quadrado da biblioteca @phosphor-icons/react
    And o botao Stop deve ter uma cor levemente avermelhada
    And o botao Stop deve ser o unico controle de acao de envio visivel

  Scenario: Restaurar botao Send ao fim do streaming
    Given que uma resposta estava sendo gerada no painel IA
    When a geracao for concluida naturalmente
    Then o botao Stop deve ser substituido pelo botao Send
    And o botao Send deve estar disponivel para nova interacao

  Scenario: Restaurar botao Send apos cancelamento
    Given que o usuario clicou no botao Stop durante o streaming
    When o cancelamento for processado
    Then o botao Stop deve ser substituido pelo botao Send
    And o botao Send deve estar disponivel para nova interacao

  Scenario: Exibir botao Send quando nenhuma resposta esta em andamento
    Given que nenhuma resposta esta sendo gerada no momento
    When o usuario visualizar o campo de envio de mensagem
    Then o botao Stop nao deve estar visivel
    And o botao Send deve estar visivel e disponivel

  # --- Acao de cancelamento ---

  Scenario: Cancelar resposta em andamento pelo botao Stop
    Given que uma resposta esta sendo gerada no painel IA
    And que o botao Stop esta visivel
    When o usuario clicar no botao Stop
    Then a geracao da resposta deve ser interrompida imediatamente
    And o painel IA deve parar de atualizar o conteudo da resposta
    And o botao Stop deve ser substituido pelo botao Send

  Scenario: Cancelamento ocorre sem confirmacao
    Given que uma resposta esta sendo gerada no painel IA
    When o usuario clicar no botao Stop
    Then nenhum dialogo de confirmacao deve ser exibido
    And a geracao deve ser interrompida imediatamente

  Scenario: Preservar conteudo parcial apos o cancelamento
    Given que o usuario cancelou uma resposta que ja havia exibido conteudo parcial
    When o cancelamento for processado
    Then o conteudo parcial ja exibido no card deve permanecer visivel
    And o usuario deve conseguir ler o conteudo parcial normalmente
    And nenhuma marcacao de "cancelado" deve ser exibida no card

  # --- Retomada do chat apos cancelamento ---

  Scenario: Habilitar envio de nova mensagem imediatamente apos cancelar
    Given que o usuario cancelou uma resposta em andamento
    When o cancelamento for concluido
    Then o campo de mensagem deve estar disponivel para digitacao
    And o botao Send deve estar habilitado
    And o usuario deve conseguir enviar uma nova mensagem sem precisar recarregar o painel

  Scenario: Nova mensagem enviada apos cancelamento usa o modelo atualmente selecionado
    Given que o usuario cancelou uma resposta e enviou uma nova mensagem na sequencia
    When a nova solicitacao for iniciada
    Then a nova resposta deve usar o modelo selecionado no momento do envio
    And o cancelamento anterior nao deve influenciar o comportamento da nova resposta

  # --- Cancelamento sem conteudo parcial ---

  Scenario: Cancelar antes de qualquer conteudo ser exibido
    Given que o usuario enviou uma mensagem e a geracao da resposta ainda nao produziu conteudo visivel
    When o usuario clicar no botao Stop
    Then a geracao deve ser interrompida
    And nenhum card de resposta com conteudo vazio deve ser exibido no painel IA
    And o painel IA deve retornar ao estado de pronto para envio

  # --- Historico e persistencia ---

  Scenario: Resposta cancelada com conteudo permanece no historico da nota
    Given que o usuario cancelou uma resposta que ja havia produzido conteudo parcial
    When o usuario fechar e reabrir o painel IA para a mesma nota
    Then o card da resposta deve continuar visivel no historico da nota
    And o conteudo parcial deve continuar integro e legivel

  Scenario: Resposta cancelada sem conteudo nao persiste no historico
    Given que o usuario cancelou uma resposta antes de qualquer conteudo ser produzido
    When o usuario reabrir o painel IA para a mesma nota
    Then nenhum card vazio deve aparecer no historico da nota

  # --- Escopo do cancelamento ---

  Scenario: Cancelamento nao afeta outras funcionalidades do painel IA
    Given que o usuario cancelou uma resposta em andamento
    When o cancelamento for concluido
    Then os botoes de copiar e de inserir anotacao dos cards existentes devem continuar funcionando normalmente
    And apenas a geracao da resposta deve ter sido interrompida

  # --- Interacao com troca de nota ---

  Scenario: Trocar de nota durante o streaming nao interrompe a geracao
    Given que uma resposta esta sendo gerada para a nota atual
    When o usuario selecionar uma nota diferente
    Then a geracao da resposta da nota anterior deve continuar ate ser concluida naturalmente
    And o painel IA da nova nota deve exibir apenas os cards associados a ela
    And ao retornar a nota anterior o usuario deve encontrar a resposta concluida ou em andamento conforme o estado atual da geracao
```

## Criterios de aceitacao

1. Durante a geracao de uma resposta, o botao Send deve ser substituido pelo botao Stop com cor levemente avermelhada e icone de quadrado da biblioteca @phosphor-icons/react.
2. Fora de uma geracao em andamento, o botao Stop nao deve estar visivel e o botao Send deve estar disponivel.
3. Ao clicar no botao Stop, a geracao deve ser interrompida imediatamente sem dialogo de confirmacao.
4. Apos o cancelamento, o botao Stop deve ser substituido pelo botao Send imediatamente.
5. O conteudo parcial ja exibido no card deve ser preservado apos o cancelamento, sem nenhuma marcacao especial de cancelamento.
6. Imediatamente apos o cancelamento, o campo de mensagem e o botao Send devem estar disponiveis para nova interacao.
7. Se o cancelamento ocorrer antes de qualquer conteudo ser exibido, nenhum card vazio deve ser criado no historico da nota.
8. O card de resposta com conteudo parcial deve persistir no historico da nota entre sessoes.
9. O cancelamento afeta exclusivamente a geracao da resposta no Chat; botoes de copiar e de inserir anotacao nao sao afetados.
10. Ao trocar de nota durante um streaming, a geracao continua ate ser concluida naturalmente; o painel IA da nova nota exibe apenas seus proprios cards, e ao retornar a nota anterior o usuario encontra a resposta no estado atual da geracao.
11. Uma nova mensagem enviada apos cancelamento deve se comportar como qualquer outra solicitacao nova, sem herdar estados da resposta cancelada.

## Glossario do dominio

- Monet: aplicacao desktop de notas com painel de IA para apoio ao estudo.
- Painel IA: area lateral da interface onde o usuario acompanha respostas da assistente.
- Streaming: envio progressivo da resposta em partes, permitindo exibicao em tempo real.
- Resposta em andamento: resposta que esta sendo gerada e ainda nao foi concluida ou cancelada.
- Botao Send: controle visivel quando nenhuma geracao esta em andamento, que permite ao usuario enviar uma nova mensagem.
- Botao Stop: versao avermelhada do botao Send, visivel exclusivamente durante uma geracao em andamento, que exibe o icone de quadrado da biblioteca @phosphor-icons/react e permite ao usuario interromper a resposta imediatamente.
- Cancelamento manual: interrupcao da geracao iniciada pelo usuario por meio do botao Stop.
- Conteudo parcial: trecho da resposta ja exibido no painel IA no momento em que o cancelamento ocorreu.
- Card de resposta: unidade visual no painel IA que representa uma resposta, seja concluida ou interrompida.
- Card de resposta concluida: unidade visual que representa uma resposta entregue com sucesso em sua totalidade.
- Historico da nota: conjunto de cards de resposta IA persistidos e vinculados a uma nota especifica.
- Estado de pronto para envio: estado do painel IA no qual nenhuma geracao esta em andamento e o usuario pode enviar uma nova mensagem.
- Campo de mensagem: area de digitacao onde o usuario escreve a mensagem a ser enviada ao modelo.

## Ambiguidades e decisoes pendentes

1. Nao esta definido se o usuario pode cancelar uma resposta que esta sendo gerada para uma nota diferente da que esta atualmente selecionada (cenario de cancelamento remoto).
