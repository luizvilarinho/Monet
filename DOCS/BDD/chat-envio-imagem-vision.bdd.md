# BDD - Envio de Imagens para Modelos com Vision

## Historias de usuario

### HU-01 - Anexar uma imagem ao campo de mensagem antes de enviar
Prioridade: Alta

Como usuario do Monet
Quero poder anexar uma imagem ao campo de mensagem do chat
Para incluir conteudo visual na minha pergunta ao modelo

### HU-02 - Enviar imagem junto com texto para um modelo com suporte a vision
Prioridade: Alta

Como usuario do Monet
Quero enviar uma mensagem contendo texto e imagem para um modelo que suporta vision
Para que o modelo analise o conteudo visual e responda com base nele

### HU-03 - Ser informado quando o modelo nao suporta vision
Prioridade: Alta

Como usuario do Monet
Quero ser avisado quando o modelo selecionado nao suportar analise de imagens
Para nao enviar a mensagem com uma imagem que sera ignorada ou causara erro

### HU-04 - Remover uma imagem anexada antes do envio
Prioridade: Media

Como usuario do Monet
Quero poder remover uma imagem que anexei antes de enviar a mensagem
Para corrigir minha selecao sem precisar cancelar a mensagem inteira

### HU-05 - Consultar imagens enviadas no historico do chat
Prioridade: Media

Como usuario do Monet
Quero que as imagens enviadas no chat sejam exibidas no historico da conversa
Para ter contexto visual completo ao reler a troca de mensagens

---

## Cenarios BDD

```gherkin
Feature: Envio de Imagens para Modelos com Vision
  Como usuario do Monet
  Quero poder enviar imagens no chat junto com minhas mensagens
  Para que modelos com suporte a vision analisem o conteudo visual

  # --- Anexar imagem ao campo de mensagem ---

  Scenario: Anexar imagem via botao de anexo
    Given que o usuario esta no painel de chat com um modelo selecionado
    When o usuario clicar no botao de anexar imagem no campo de mensagem
    Then um seletor de arquivo do sistema operacional deve ser aberto
    And o seletor deve aceitar qualquer arquivo de imagem sem restricao de formato

  Scenario: Exibir preview da imagem apos selecao
    Given que o usuario abriu o seletor de arquivo
    When o usuario selecionar um arquivo de imagem valido com ate 5MB
    Then o seletor de arquivo deve ser fechado
    And um preview em miniatura da imagem deve ser exibido no campo de mensagem
    And o usuario deve poder digitar texto normalmente junto com a imagem anexada

  Scenario: Rejeitar imagem que excede 5MB
    Given que o usuario abriu o seletor de arquivo
    When o usuario selecionar uma imagem com tamanho superior a 5MB
    Then nenhuma imagem deve ser anexada ao campo de mensagem
    And uma mensagem de erro deve informar que a imagem excede o limite de 5MB

  Scenario: Remover imagem anexada antes do envio
    Given que o usuario tem uma imagem anexada no campo de mensagem
    When o usuario clicar no botao de remover a imagem
    Then a imagem deve ser removida do campo de mensagem
    And o campo de mensagem deve retornar ao estado sem anexo
    And qualquer texto ja digitado deve ser preservado

  # --- Interacao com o modelo selecionado ---

  Scenario: Habilitar envio com imagem quando o modelo suporta vision
    Given que o usuario selecionou um modelo com suporte a vision
    And que o usuario anexou uma imagem ao campo de mensagem
    When o usuario visualizar o campo de mensagem
    Then o botao de envio deve estar habilitado normalmente
    And nenhum aviso sobre vision deve ser exibido

  Scenario: Exibir aviso quando o modelo nao suporta vision e ha imagem anexada
    Given que o usuario selecionou um modelo sem suporte a vision
    When o usuario anexar uma imagem ao campo de mensagem
    Then o sistema deve exibir um aviso indicando que o modelo selecionado nao suporta imagens
    And o botao de envio deve ser desabilitado ou a imagem deve ser bloqueada para envio
    And o aviso deve sugerir ao usuario trocar para um modelo com suporte a vision

  Scenario: Remover aviso de vision ao trocar para um modelo compativel
    Given que o usuario ve um aviso de modelo sem suporte a vision com imagem anexada
    When o usuario trocar para um modelo que suporta vision
    Then o aviso deve desaparecer
    And o botao de envio deve ser reabilitado
    And a imagem deve continuar anexada ao campo de mensagem

  Scenario: Remover aviso de vision ao remover a imagem com modelo incompativel
    Given que o usuario ve um aviso de modelo sem suporte a vision
    When o usuario remover a imagem anexada
    Then o aviso deve desaparecer
    And o campo de mensagem deve voltar ao estado normal sem imagem

  Scenario: Tratar modelo como sem suporte a vision quando metadados nao estao disponiveis
    Given que o sistema nao conseguiu carregar os metadados do modelo selecionado da API do OpenRouter
    And que o usuario anexou uma imagem ao campo de mensagem
    When o usuario visualizar o campo de mensagem
    Then o sistema deve tratar o modelo como sem suporte a vision
    And deve exibir o aviso de incompatibilidade de vision
    And o botao de envio deve ser desabilitado para o envio com imagem

  # --- Envio da mensagem com imagem ---

  Scenario: Enviar mensagem com texto e imagem para modelo com vision
    Given que o usuario selecionou um modelo com suporte a vision
    And que o usuario anexou uma imagem ao campo de mensagem
    And que o usuario digitou um texto no campo de mensagem
    When o usuario clicar no botao de envio
    Then a mensagem deve ser enviada contendo o texto e a imagem
    And o campo de mensagem deve ser limpo apos o envio
    And o preview da imagem no campo de mensagem deve ser removido

  Scenario: Enviar mensagem apenas com imagem sem texto
    Given que o usuario selecionou um modelo com suporte a vision
    And que o usuario anexou uma imagem ao campo de mensagem
    And que o usuario nao digitou nenhum texto
    When o usuario clicar no botao de envio
    Then a mensagem deve ser enviada contendo apenas a imagem
    And o campo de mensagem deve ser limpo apos o envio

  Scenario: Nao enviar mensagem com modelo sem suporte a vision
    Given que o usuario selecionou um modelo sem suporte a vision
    And que o usuario anexou uma imagem ao campo de mensagem (bloqueada)
    When o usuario clicar no botao de envio
    Then a mensagem nao deve ser enviada
    And o aviso de incompatibilidade de vision deve permanecer visivel

  # --- Tratamento de erros de envio ---

  Scenario: Exibir mensagem de erro quando o envio com imagem falha
    Given que o usuario selecionou um modelo com suporte a vision
    And que o usuario enviou uma mensagem contendo uma imagem
    When a API retornar um erro durante o envio
    Then uma mensagem de erro deve ser exibida na UI do chat informando o problema

  Scenario: Retornar ao estado anterior quando o modelo nao suporta vision e falha no envio
    Given que o usuario selecionou um modelo sem suporte a vision
    And que o usuario digitou um texto no campo de mensagem
    And que a mensagem foi enviada mesmo assim (edge case de contorno de validacao)
    When a API retornar erro indicando que o modelo nao aceita imagens
    Then a mensagem enviada deve ser deletada do historico do chat
    And o texto original da mensagem deve ser restaurado no campo de input do usuario
    And uma mensagem de erro deve ser exibida na UI informando que o modelo nao suporta vision

  # --- Exibicao no historico do chat ---

  Scenario: Exibir imagem enviada como miniatura no historico da conversa
    Given que o usuario enviou uma mensagem contendo uma imagem
    When o chat exibir o historico da conversa
    Then a mensagem do usuario deve exibir a imagem como miniatura visivel no historico
    And o texto que acompanha a imagem, se houver, deve ser exibido junto

  Scenario: Miniatura da imagem no historico nao e clicavel
    Given que o usuario enviou uma mensagem contendo uma imagem
    And a mensagem esta visivel no historico do chat como miniatura
    When o usuario clicar na miniatura da imagem no historico
    Then nenhuma acao deve ocorrer
    And nenhum lightbox ou visualizacao expandida deve ser aberto

  Scenario: Nao persistir a imagem no historico apos fechar o painel
    Given que o usuario enviou uma mensagem contendo uma imagem
    When o usuario fechar e reabrir o painel de chat para a mesma nota
    Then o historico deve exibir o texto da mensagem normalmente
    And a imagem pode nao ser exibida no historico (nao e persistida entre sessoes)

  # --- Limite de imagens por mensagem ---

  Scenario: Permitir apenas uma imagem por mensagem
    Given que o usuario ja tem uma imagem anexada ao campo de mensagem
    When o usuario tentar anexar uma segunda imagem
    Then a segunda imagem deve substituir a primeira
    And o preview deve ser atualizado para mostrar a nova imagem

```

---

## Criterios de aceitacao

1. O campo de mensagem do chat deve exibir um botao de anexar imagem sempre visivel.
2. Ao clicar no botao de anexar, um seletor de arquivo do sistema operacional deve abrir aceitando qualquer arquivo de imagem, sem restricao de formato.
3. Imagens com tamanho superior a 5MB devem ser rejeitadas antes do upload, com mensagem de erro explicativa exibida ao usuario.
4. Apos a selecao de uma imagem valida (ate 5MB), um preview em miniatura deve ser exibido no campo de mensagem antes do envio.
5. O usuario deve conseguir remover a imagem anexada antes do envio sem perder o texto digitado.
6. Apenas um arquivo de imagem pode ser anexado por mensagem; ao selecionar uma nova imagem, ela substitui a anterior.
7. Quando o modelo selecionado nao suporta vision e ha uma imagem anexada, o sistema deve exibir aviso claro e desabilitar o envio da mensagem com imagem.
8. O aviso de incompatibilidade de vision deve desaparecer automaticamente ao trocar para um modelo compativel ou ao remover a imagem.
9. Ao enviar, a mensagem deve incluir texto e imagem juntos; o campo de mensagem deve ser limpo completamente apos o envio.
10. Quando o envio falhar por qualquer motivo de API, uma mensagem de erro deve ser exibida na UI do chat.
11. Quando o modelo nao suportar vision e ocorrer erro no envio: a mensagem enviada deve ser deletada do historico e o texto original deve ser restaurado no campo de input, permitindo que o usuario revise e reenvie.
12. Imagens enviadas sao exibidas como miniatura no historico durante a sessao corrente, mas nao sao persistidas entre sessoes (localStorage tem limite de capacidade que inviabiliza a persistencia de imagens; apenas o texto das mensagens e gravado).
13. A miniatura de imagem exibida no historico do chat nao e clicavel; nenhum comportamento de lightbox ou visualizacao expandida deve ser implementado.
14. O suporte a vision de um modelo e determinado dinamicamente pelo campo `architecture.input_modalities` retornado pela API de listagem de modelos do OpenRouter: se o array incluir `"image"`, o modelo suporta vision. Nenhuma lista estatica de modelos deve ser mantida no codigo.
15. Quando os metadados do modelo nao puderem ser carregados da API do OpenRouter, o sistema deve adotar postura conservadora e tratar o modelo como sem suporte a vision, exibindo o aviso e bloqueando o envio de imagens.

---

## Glossario do dominio

- Monet: aplicacao desktop de notas com painel de IA para apoio ao estudo.
- Chat: modulo do Monet que permite ao usuario trocar mensagens livres com um modelo de IA.
- Painel de chat: area do Monet onde o historico de mensagens e o campo de entrada sao exibidos.
- Campo de mensagem / prompt field: area de digitacao onde o usuario escreve e prepara a mensagem antes de enviar.
- Botao de anexar imagem: controle no campo de mensagem que abre o seletor de arquivo do sistema operacional.
- Modelo: opcao de IA disponibilizada pela OpenRouter, como Claude, GPT-4 ou Gemini.
- Vision: capacidade de um modelo de IA de processar e interpretar conteudo visual (imagens) enviado junto com a mensagem.
- Modelo com suporte a vision: modelo cujo campo `architecture.input_modalities` retornado pela API do OpenRouter inclui o valor `"image"`.
- Modelo sem suporte a vision: modelo cujo campo `architecture.input_modalities` nao inclui `"image"`, ou cujos metadados nao puderam ser carregados.
- Imagem anexada: arquivo de imagem selecionado pelo usuario e vinculado ao campo de mensagem, aguardando envio.
- Preview de imagem: exibicao em miniatura da imagem anexada dentro do campo de mensagem, antes do envio.
- Historico do chat: sequencia de mensagens trocadas entre o usuario e o modelo, exibida no painel de chat.
- Miniatura no historico: representacao visual reduzida da imagem enviada dentro do card de mensagem no historico. Nao e clicavel e nao expande para lightbox.
- Tamanho maximo de imagem: 5MB — limite definido pelo sistema para imagens aceitas como anexo.
- Rollback de mensagem: acao de remover uma mensagem do historico do chat e restaurar seu conteudo textual no campo de input apos erro de envio.
- `architecture.input_modalities`: campo retornado pela API de listagem de modelos do OpenRouter que descreve os tipos de entrada suportados pelo modelo (ex: `["text", "image"]`). E a fonte de verdade para determinar suporte a vision.
- Postura conservadora de vision: comportamento do sistema ao tratar um modelo como sem suporte a vision quando seus metadados nao estao disponiveis, evitando enviar imagens a APIs que possam rejeita-las com erro.

---

## Ambiguidades e decisoes pendentes

1. (RESOLVIDO) Tamanho maximo de imagem: **5MB**.
2. (RESOLVIDO) Formatos suportados: **qualquer formato de imagem e aceito**, sem restricao.
3. (RESOLVIDO) Comportamento em erro de envio: **exibir a mensagem de erro ao usuario na UI do chat**.
4. (RESOLVIDO) Modelo sem suporte a vision com erro no envio: **deletar a mensagem enviada do historico e restaurar o texto original no campo de input** para que o usuario possa revisar e reenviar.
5. (RESOLVIDO) Persistencia de imagens: **imagens nao sao persistidas entre sessoes**. O localStorage tem limite de ~5-10MB, o que inviabiliza o armazenamento de imagens. Apenas o texto das mensagens e gravado no historico persistido.
6. (RESOLVIDO) Clique na miniatura no historico: **nenhuma acao ocorre** — a miniatura nao e clicavel e o comportamento de lightbox nao sera implementado.
7. (RESOLVIDO) Fonte de verdade para classificar modelos com vision: **API do OpenRouter**. O campo `architecture.input_modalities` retornado na listagem de modelos inclui `"image"` quando o modelo suporta vision. O sistema usa esse campo de forma dinamica, sem lista estatica hardcoded no codigo. Quando os metadados nao estiverem disponiveis, o modelo deve ser tratado como sem suporte a vision (postura conservadora).
