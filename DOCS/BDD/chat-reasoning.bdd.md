# BDD - Visualizacao do Raciocinio da IA

## Historias de usuario

### HU-01 - Acompanhar o raciocinio em andamento durante a resposta
Prioridade: Media

Como usuario do Monet
Quero saber quando o modelo esta elaborando uma resposta
Para entender que o sistema esta processando e nao travado

### HU-02 - Expandir o bloco de raciocinio de uma resposta
Prioridade: Media

Como usuario do Monet
Quero poder ver o raciocinio usado pelo modelo para chegar a uma resposta
Para entender a logica por tras da conclusao apresentada

### HU-03 - Manter o raciocinio acessivel apos a resposta ser concluida
Prioridade: Baixa

Como usuario do Monet
Quero que o raciocinio fique disponivel para consulta mesmo depois que a resposta for concluida
Para revisitar o processo de raciocinio do modelo sem precisar refazer a pergunta

### HU-04 - Nao ver elementos extras quando o modelo nao produce raciocinio
Prioridade: Alta

Como usuario do Monet
Quero que respostas sem raciocinio sejam exibidas sem elementos adicionais
Para nao ter a interface poluida com controles vazios ou irrelevantes

## Cenarios BDD

```gherkin
Feature: Visualizacao do Raciocinio da IA
  Como usuario do Monet
  Quero acompanhar e explorar o raciocinio produzido pelo modelo
  Para entender como a IA chegou a uma resposta

  # --- Indicador de raciocinio em andamento ---

  Scenario: Exibir indicador visual enquanto o modelo esta raciocinando
    Given que o usuario enviou uma mensagem no chat
    And que o modelo selecionado e capaz de produzir raciocinio
    When o modelo comecar a elaborar o raciocinio antes de responder
    Then o painel IA deve exibir um indicador generico de processamento
    And o indicador nao deve revelar o conteudo parcial do raciocinio
    And o indicador deve ser apresentado antes da resposta final comecar a aparecer
    And o usuario deve conseguir distinguir esse estado do estado de resposta em andamento

  Scenario: Ocultar indicador de raciocinio quando a resposta final comecar
    Given que o modelo esta exibindo o indicador generico de processamento de raciocinio
    When o modelo comecar a produzir a resposta final
    Then o indicador de raciocinio em andamento deve ser substituido pelo conteudo da resposta
    And o usuario nao deve ver o indicador de raciocinio ativo ao mesmo tempo que a resposta final

  # --- Bloco de raciocinio colapsavel ---

  Scenario: Exibir bloco de raciocinio colapsado ao final do streaming
    Given que o usuario enviou uma mensagem para um modelo que produziu raciocinio
    When o streaming da resposta for concluido
    Then o card de resposta deve exibir um toggle de raciocinio com o label "Thinking"
    And o toggle deve estar colapsado por padrao
    And a resposta final deve ser apresentada diretamente ao usuario sem exigir interacao

  Scenario: Expandir o bloco de raciocinio de uma mensagem concluida
    Given que o card de resposta exibe um toggle de raciocinio colapsado com o label "Thinking"
    When o usuario clicar no toggle para expandir o bloco de raciocinio
    Then o conteudo do raciocinio deve ser exibido em texto simples acima ou antes da resposta final
    And o conteudo deve ser apresentado dentro do elemento toggle expandido
    And a resposta final deve continuar visivel sem ser substituida pelo raciocinio

  Scenario: Limitar altura do raciocinio expandido com scroll interno
    Given que o usuario expandiu o bloco de raciocinio de uma resposta
    When o conteudo do raciocinio exceder 500px de altura
    Then o bloco de raciocinio deve limitar sua altura a 500px
    And um scroll interno deve ser exibido para acessar o restante do conteudo

  Scenario: Selecionar texto do raciocinio expandido
    Given que o usuario expandiu o bloco de raciocinio de uma resposta
    When o usuario selecionar um trecho do texto do raciocinio
    Then o texto deve ficar iluminado/selecionado normalmente
    And o usuario deve conseguir copiar o trecho manualmente via acao do sistema operacional
    And nenhum botao de clipboard ou facilitador adicional de copia deve ser exibido

  Scenario: Colapsar o bloco de raciocinio apos expansao
    Given que o usuario expandiu o bloco de raciocinio de uma resposta
    When o usuario clicar para colapsar o toggle de raciocinio
    Then o conteudo do raciocinio deve ser ocultado novamente
    And a resposta final deve continuar visivel normalmente

  Scenario: Raciocinio deve persistir no card apos o streaming terminar
    Given que uma resposta foi concluida com raciocinio produzido pelo modelo
    When o usuario fechar e reabrir o painel IA
    Then o card de resposta deve continuar exibindo o toggle "Thinking" colapsado
    And ao expandir, o conteudo do raciocinio deve ser o mesmo produzido originalmente

  # --- Modelos sem raciocinio ---

  Scenario: Nao exibir elemento de raciocinio para modelos que nao o produzem
    Given que o usuario selecionou um modelo que nao produz raciocinio
    When a resposta for concluida
    Then o card de resposta nao deve exibir nenhum toggle, bloco ou controle de raciocinio
    And a resposta deve ser apresentada de forma identica a uma resposta comum

  Scenario: Nao exibir indicador de raciocinio para modelos que nao o produzem
    Given que o usuario enviou uma mensagem para um modelo que nao produz raciocinio
    When o streaming estiver em andamento
    Then o painel IA nao deve exibir o indicador visual de raciocinio
    And apenas o indicador de resposta em andamento deve ser apresentado

  # --- Raciocinio durante o streaming ---

  Scenario: Exibir indicador generico enquanto o raciocinio esta sendo produzido
    Given que o usuario enviou uma mensagem para um modelo que produz raciocinio
    When o modelo estiver produzindo o raciocinio antes da resposta final
    Then o usuario deve ver o indicador generico de processamento
    And o conteudo parcial do raciocinio nao deve ser exibido em tempo real
    And o indicador nao deve ser confundido com a resposta final

  Scenario: Transicao do raciocinio para a resposta final durante o streaming
    Given que o modelo concluiu o raciocinio e comecar a produzir a resposta final
    When a resposta final comecar a aparecer no painel IA
    Then o raciocinio deve ser movido para o toggle "Thinking" colapsado
    And a resposta final deve comecar a ser exibida progressivamente no lugar do indicador

  # --- Resposta interrompida com raciocinio parcial ---

  Scenario: Preservar raciocinio parcial quando o streaming for interrompido
    Given que o modelo estava produzindo raciocinio e o streaming foi interrompido antes da resposta final
    When a interrupcao ocorrer
    Then o painel IA deve preservar o raciocinio parcial ja recebido no toggle "Thinking" colapsado
    And o painel IA deve indicar que a resposta foi interrompida antes de ser concluida
    And o usuario deve conseguir consultar o raciocinio parcial expandindo o toggle
```

## Criterios de aceitacao

1. Enquanto o modelo estiver produzindo raciocinio, o painel IA deve exibir um indicador generico de processamento — sem revelar o conteudo parcial do raciocinio em tempo real.
2. Ao iniciar a resposta final, o indicador de raciocinio em andamento deve ser substituido pelo conteudo da resposta.
3. Ao final do streaming, se houver raciocinio produzido, o card de resposta deve exibir um toggle com o label "Thinking", colapsado por padrao.
4. Se o modelo nao produzir raciocinio, o toggle "Thinking" nao deve aparecer na interface.
5. O toggle deve estar sempre colapsado por padrao, independentemente de sessoes anteriores.
6. Ao expandir o toggle, o conteudo do raciocinio deve ser exibido em texto simples dentro do elemento toggle, acima ou antes da resposta final.
7. Quando o conteudo do raciocinio expandido exceder 500px de altura, o bloco deve exibir scroll interno limitado a essa altura.
8. O usuario pode selecionar e copiar manualmente trechos do raciocinio expandido; nenhum botao de clipboard ou facilitador adicional de copia deve ser fornecido.
9. Ao colapsar o toggle, o raciocinio deve ser ocultado e a resposta final deve continuar integra e visivel.
10. O raciocinio deve persistir no card mesmo apos o usuario fechar e reabrir o painel IA.
11. Para modelos que nao produzem raciocinio, nenhum toggle, bloco, controle ou indicador de raciocinio deve aparecer na interface.
12. Raciocinio parcial produzido antes de uma interrupcao deve ser preservado e acessivel no toggle "Thinking" colapsado.
13. O usuario deve sempre conseguir distinguir visualmente o conteudo do raciocinio da resposta final.

## Glossario do dominio

- Monet: aplicacao desktop de notas com painel de IA para apoio ao estudo.
- Painel IA: area lateral da interface onde o usuario acompanha respostas da assistente.
- Modelo: opcao de IA disponibilizada pela OpenRouter, como Claude, GPT ou Gemini.
- Raciocinio: bloco de elaboracao interna produzido por alguns modelos avancados antes de formular a resposta final, que representa o processo de pensamento do modelo.
- Toggle de raciocinio: elemento visual interativo no card de resposta, implementado no padrao `<details><summary>`, com o label fixo "Thinking", que permite ao usuario expandir ou colapsar o conteudo do raciocinio.
- Bloco colapsado: estado padrao do toggle de raciocinio, no qual o conteudo esta oculto e somente o label "Thinking" esta visivel.
- Bloco expandido: estado do toggle de raciocinio no qual o conteudo em texto simples esta visivel ao usuario, limitado a 500px de altura com scroll interno quando necessario.
- Indicador generico de processamento: elemento visual exibido enquanto o modelo esta elaborando seu raciocinio durante o streaming, sem revelar o conteudo parcial do raciocinio.
- Resposta final: conteudo principal entregue ao usuario como resposta a sua mensagem, distinto do raciocinio.
- Card de resposta: unidade visual exibida no painel IA para representar uma resposta gerada.
- Streaming: envio progressivo da resposta em partes, permitindo exibicao em tempo real.
- Resposta interrompida: resposta cujo streaming foi encerrado antes da conclusao, seja por falha ou por acao do usuario.
- Modelo com raciocinio: modelo que, alem da resposta final, produz um bloco de elaboracao interna visivel ao usuario.
- Modelo sem raciocinio: modelo que produz apenas a resposta final, sem bloco de elaboracao interna.

## Ambiguidades e decisoes pendentes

Nao ha ambiguidades pendentes. Todas as decisoes de produto foram incorporadas nos cenarios e criterios de aceitacao acima.
