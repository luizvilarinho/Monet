# BDD - Captura de Tela (Screenshot) para o Chat

## Dependencia
Esta feature depende da feature **chat-envio-imagem-vision.bdd.md**. A imagem capturada segue o mesmo fluxo de anexo descrito naquele documento apos ser confirmada pelo usuario.

---

## Historias de usuario

### HU-01 - Acionar a captura de tela diretamente pelo chat
Prioridade: Alta

Como usuario do Monet
Quero iniciar uma captura de tela sem sair do painel de chat
Para capturar conteudo da minha tela e usar como contexto visual na conversa com o modelo

### HU-02 - Escolher o que capturar antes de confirmar
Prioridade: Alta

Como usuario do Monet
Quero poder escolher capturar a tela inteira ou uma janela especifica
Para enviar apenas o conteudo relevante para o modelo

### HU-03 - Visualizar o preview antes de confirmar o envio
Prioridade: Alta

Como usuario do Monet
Quero ver uma previa da captura antes de confirma-la
Para verificar se o conteudo esta correto antes de anexar ao chat

### HU-04 - Descartar a captura e voltar ao chat sem consequencias
Prioridade: Media

Como usuario do Monet
Quero poder cancelar a captura em qualquer etapa do fluxo
Para nao ser forcado a enviar uma imagem que nao quero usar

---

## Cenarios BDD

```gherkin
Feature: Captura de Tela para o Chat
  Como usuario do Monet
  Quero capturar a tela diretamente pelo app e anexar a imagem ao chat
  Para enviar conteudo visual ao modelo sem sair do Monet

  # --- Acionar captura de tela ---

  Scenario: Exibir botao de captura de tela no campo de mensagem
    Given que o usuario esta no painel de chat
    When o usuario visualizar o campo de mensagem
    Then um botao dedicado a captura de tela deve estar visivel no campo de mensagem

  Scenario: Iniciar o fluxo de captura ao clicar no botao
    Given que o usuario esta no painel de chat
    When o usuario clicar no botao de captura de tela
    Then o app deve iniciar o fluxo de captura
    And o usuario deve ser apresentado a opcoes de modo de captura

  # --- Selecao do modo de captura ---

  Scenario: Apresentar opcoes de captura da tela inteira e de janela especifica
    Given que o usuario iniciou o fluxo de captura de tela
    When as opcoes de captura forem exibidas
    Then o usuario deve ver a opcao de capturar a tela inteira
    And o usuario deve ver a opcao de selecionar uma janela especifica

  Scenario: Capturar a tela inteira
    Given que o usuario escolheu a opcao de capturar a tela inteira
    When a captura for realizada
    Then o app deve tirar um print de toda a area visivel do monitor principal
    And o usuario deve ser levado para a tela de preview da captura

  Scenario: Capturar uma janela especifica
    Given que o usuario escolheu a opcao de selecionar uma janela especifica
    When a lista de janelas disponiveis for exibida
    Then o usuario deve ver as janelas abertas no sistema
    And ao selecionar uma janela, o app deve capturar apenas o conteudo daquela janela
    And o usuario deve ser levado para a tela de preview da captura

  Scenario: Cancelar o fluxo durante a selecao do modo de captura
    Given que o usuario esta na tela de selecao de modo de captura
    When o usuario cancelar o fluxo
    Then nenhuma captura deve ser realizada
    And o usuario deve retornar ao campo de mensagem do chat sem alteracoes

  # --- Preview e confirmacao ---

  Scenario: Exibir preview da captura antes da confirmacao
    Given que uma captura foi realizada com sucesso
    When o preview for exibido ao usuario
    Then o usuario deve ver a imagem capturada em tamanho suficiente para revisao
    And o usuario deve ver um botao de confirmar e um botao de cancelar

  Scenario: Confirmar a captura e anexar ao campo de mensagem
    Given que o usuario esta vendo o preview de uma captura
    When o usuario clicar no botao de confirmar
    Then a captura deve ser anexada ao campo de mensagem do chat como imagem
    And o preview deve ser fechado
    And o usuario deve retornar ao campo de mensagem com a imagem ja anexada
    And a partir desse ponto o fluxo segue o comportamento padrao de envio de imagem

  Scenario: Cancelar na tela de preview e descartar a captura
    Given que o usuario esta vendo o preview de uma captura
    When o usuario clicar no botao de cancelar
    Then a captura deve ser descartada
    And nenhuma imagem deve ser anexada ao campo de mensagem
    And o usuario deve retornar ao campo de mensagem do chat sem alteracoes

  # --- Erros durante a captura ---

  Scenario: Falha ao realizar a captura por falta de permissao do sistema operacional
    Given que o usuario iniciou o fluxo de captura
    When o sistema operacional negar a permissao de captura de tela ao app
    Then o fluxo de captura deve ser encerrado
    And o usuario deve ver uma mensagem de erro indicando que a permissao de captura foi negada
    And o usuario deve ser orientado a conceder a permissao nas configuracoes do sistema
    And nenhuma imagem deve ser anexada ao campo de mensagem

  Scenario: Falha ao capturar por razao desconhecida
    Given que o usuario iniciou o fluxo de captura
    When ocorrer um erro inesperado durante a captura
    Then o fluxo de captura deve ser encerrado
    And o usuario deve ver uma mensagem de erro generica
    And nenhuma imagem deve ser anexada ao campo de mensagem
    And o usuario deve retornar ao campo de mensagem do chat sem alteracoes

  # --- Interacao com modelo sem vision ---

  Scenario: Exibir aviso ao confirmar captura com modelo sem suporte a vision
    Given que o usuario selecionou um modelo sem suporte a vision no chat
    When o usuario confirmar uma captura de tela
    Then a imagem deve ser anexada ao campo de mensagem normalmente
    And o aviso de incompatibilidade de vision deve ser exibido conforme definido na feature de envio de imagem
    And o botao de envio deve ser desabilitado conforme essa mesma regra

```

---

## Criterios de aceitacao

1. O campo de mensagem do chat deve exibir um botao de captura de tela separado do botao de anexar arquivo.
2. Ao iniciar o fluxo de captura, o usuario deve poder escolher entre capturar a tela inteira ou uma janela especifica.
3. Antes de confirmar, o usuario deve ver um preview da imagem capturada com opcoes de confirmar ou cancelar.
4. Ao confirmar, a imagem capturada deve ser anexada ao campo de mensagem seguindo as mesmas regras da feature de envio de imagem (preview, validacao de modelo com vision, fluxo de envio).
5. O usuario deve poder cancelar o fluxo em qualquer etapa sem que nenhuma imagem seja anexada ao chat.
6. Em caso de erro (permissao negada, falha inesperada), o usuario deve ver uma mensagem de erro clara e retornar ao chat sem consequencias.
7. A captura de uma janela especifica deve exibir a lista de janelas abertas no sistema para o usuario escolher.
8. Nenhuma captura deve ser salva permanentemente no disco pelo app — ela deve existir apenas em memoria ate ser confirmada ou descartada.

---

## Glossario do dominio

- Monet: aplicacao desktop de notas com painel de IA para apoio ao estudo.
- Chat: modulo do Monet que permite ao usuario trocar mensagens livres com um modelo de IA.
- Campo de mensagem: area de digitacao onde o usuario escreve e prepara a mensagem antes de enviar.
- Botao de captura de tela: controle no campo de mensagem que inicia o fluxo de screenshot sem sair do app.
- Fluxo de captura: sequencia de passos que vai desde o acionamento ate a confirmacao ou cancelamento da captura.
- Captura de tela inteira: screenshot de toda a area visivel do monitor principal do usuario.
- Captura de janela especifica: screenshot de uma unica janela aberta no sistema operacional, selecionada pelo usuario.
- Lista de janelas: relacao de janelas abertas no sistema operacional, exibida ao usuario para escolha da janela a ser capturada.
- Preview de captura: exibicao da imagem capturada ao usuario antes da confirmacao, permitindo revisao visual.
- Confirmacao de captura: acao do usuario que aprova o uso da imagem capturada e a envia para o campo de mensagem como anexo.
- Cancelamento de captura: acao do usuario que descarta a captura em qualquer etapa do fluxo sem consequencias ao estado do chat.
- Imagem anexada: imagem resultante da captura confirmada, vinculada ao campo de mensagem e pronta para envio.
- Permissao de captura: autorizacao concedida pelo sistema operacional ao app para realizar screenshots.
- Vision: capacidade de um modelo de IA de processar e interpretar imagens (ver feature chat-envio-imagem-vision).

---

## Ambiguidades e decisoes pendentes

1. Nao esta definido se o app Monet deve se minimizar ou ocultar durante a captura de tela para nao aparecer no screenshot (comportamento relevante para captura de tela inteira).
2. Nao esta definido se o usuario pode fazer uma captura de uma regiao personalizada (crop livre), alem de tela inteira e janela especifica.
3. Nao esta definido o comportamento em monitores multiplos: qual monitor e capturado na opcao de tela inteira, e se todos os monitores aparecem como opcao.
4. Nao esta definido se ha um tempo limite para o usuario confirmar ou cancelar o preview antes de ele ser descartado automaticamente.
5. Nao esta definido se a captura pode incluir conteudo protegido por DRM (ex: video em streaming). Sistemas operacionais podem bloquear capturas nesses casos — o comportamento esperado pelo app nao foi especificado.
