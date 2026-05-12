# BDD - Pastas para Conversas no Modo Chat

## Historias de usuario

### HU-01 - Criar uma pasta para organizar conversas
Prioridade: Alta

Como usuario do Monet
Quero criar pastas no modo Chat
Para agrupar conversas relacionadas ao mesmo tema

### HU-02 - Mover uma conversa para uma pasta
Prioridade: Alta

Como usuario do Monet
Quero mover uma conversa existente para uma pasta
Para organizar meu historico de conversas sem precisar recriar nada

### HU-03 - Navegar por pastas e conversas
Prioridade: Alta

Como usuario do Monet
Quero ver as pastas e suas conversas na sidebar do Chat
Para encontrar rapidamente uma conversa pelo tema

### HU-04 - Renomear uma pasta
Prioridade: Media

Como usuario do Monet
Quero renomear uma pasta existente
Para corrigir o nome ou refletir uma mudanca de escopo das conversas dentro dela

### HU-05 - Remover uma pasta
Prioridade: Media

Como usuario do Monet
Quero remover uma pasta que nao preciso mais
Para manter a sidebar organizada

### HU-06 - Remover uma conversa de uma pasta (sem excluir a conversa)
Prioridade: Baixa

Como usuario do Monet
Quero retirar uma conversa de uma pasta sem exclui-la
Para reorganizar sem perder o historico

### HU-07 - Reordenar pastas e conversas manualmente
Prioridade: Media

Como usuario do Monet
Quero reordenar pastas e conversas arrastando-as na sidebar
Para organizar a sidebar na ordem que faz mais sentido para mim

---

## Cenarios BDD

```gherkin
Feature: Pastas para Conversas no Modo Chat
  Como usuario do Monet
  Quero criar pastas na sidebar do Chat
  Para agrupar e organizar conversas por tema

  # --- Criacao de pastas ---

  Scenario: Criar uma nova pasta
    Given que o usuario esta no modo Chat
    When o usuario acionar a opcao de criar nova pasta
    Then uma nova pasta deve ser criada com nome editavel em foco
    And a pasta deve aparecer na sidebar acima das conversas soltas

  Scenario: Confirmar nome da pasta ao criar
    Given que o usuario esta criando uma nova pasta com o campo de nome em foco
    When o usuario digitar um nome e confirmar
    Then a pasta deve ser salva com o nome informado
    And o campo de edicao deve ser encerrado

  Scenario: Cancelar criacao de pasta sem nome
    Given que o usuario esta criando uma nova pasta com o campo de nome em foco
    When o usuario cancelar a edicao sem digitar nada
    Then nenhuma pasta deve ser criada
    And a sidebar deve permanecer no estado anterior

  Scenario: Criar pasta com nome duplicado
    Given que ja existe uma pasta com o nome "Programacao"
    When o usuario criar uma nova pasta com o mesmo nome "Programacao"
    Then o sistema deve permitir a criacao
    And ambas as pastas devem coexistir na sidebar com o mesmo nome

  # --- Navegacao e visualizacao ---

  Scenario: Sidebar exibe pastas antes das conversas soltas
    Given que o usuario tem pastas criadas e conversas fora de pastas
    When o usuario visualizar a sidebar do Chat
    Then as pastas devem aparecer agrupadas na parte superior
    And as conversas sem pasta devem aparecer abaixo das pastas

  Scenario: Expandir uma pasta para ver suas conversas
    Given que o usuario visualiza uma pasta colapsada na sidebar
    When o usuario clicar na pasta para expandir
    Then as conversas dentro da pasta devem ser exibidas abaixo do nome da pasta
    And a pasta deve exibir indicador visual de expandida

  Scenario: Colapsar uma pasta
    Given que o usuario visualiza uma pasta expandida na sidebar
    When o usuario clicar na pasta para colapsar
    Then as conversas dentro da pasta devem ser ocultadas
    And a pasta deve exibir indicador visual de colapsada

  Scenario: Pasta vazia exibe estado vazio
    Given que o usuario criou uma pasta e nao moveu nenhuma conversa para ela
    When o usuario expandir essa pasta
    Then a pasta deve exibir indicacao de que esta vazia

  Scenario: Conversa ativa dentro de pasta colapsada mantém pasta visível
    Given que a conversa ativa esta dentro de uma pasta
    When o usuario colapsar essa pasta
    Then a pasta deve permanecer visivel na sidebar
    And a conversa ativa deve continuar selecionada mesmo colapsada

  # --- Mover conversas para pastas ---

  Scenario: Mover uma conversa para uma pasta por drag-and-drop
    Given que o usuario tem ao menos uma conversa e uma pasta na sidebar
    When o usuario arrastar a conversa e soltar sobre a pasta destino
    Then a conversa deve desaparecer da posicao original
    And a conversa deve aparecer dentro da pasta de destino
    And a pasta deve ser automaticamente expandida para exibir a conversa

  Scenario: Mover conversa de uma pasta para outra por drag-and-drop
    Given que uma conversa esta dentro da pasta "Programacao"
    When o usuario arrastar essa conversa e soltar sobre a pasta "Estudo"
    Then a conversa deve deixar de aparecer em "Programacao"
    And a conversa deve aparecer em "Estudo"

  Scenario: Retirar conversa de pasta arrastando para a lista solta
    Given que uma conversa esta dentro de uma pasta
    When o usuario arrastar essa conversa e soltar na area de conversas soltas
    Then a conversa deve deixar de aparecer dentro da pasta
    And a conversa deve aparecer na lista solta
    And o historico de mensagens da conversa deve ser preservado integralmente

  Scenario: Tentar mover conversa para a mesma pasta onde ja esta
    Given que uma conversa ja esta dentro da pasta "Programacao"
    When o usuario tentar arrastar essa conversa e soltar sobre "Programacao"
    Then nenhuma alteracao deve ocorrer
    And nenhuma mensagem de erro deve ser exibida

  # --- Retirar conversa de pasta ---

  Scenario: Retirar uma conversa de uma pasta pelo menu de contexto
    Given que uma conversa esta dentro de uma pasta
    When o usuario acionar a opcao de remover a conversa da pasta no menu de contexto
    Then a conversa deve deixar de aparecer dentro da pasta
    And a conversa deve aparecer na lista de conversas soltas
    And o historico de mensagens da conversa deve ser preservado integralmente

  # --- Renomear pasta ---

  Scenario: Renomear uma pasta existente
    Given que o usuario visualiza uma pasta na sidebar
    When o usuario acionar a opcao de renomear a pasta e informar o novo nome
    Then a pasta deve exibir o novo nome na sidebar
    And as conversas dentro da pasta devem permanecer sem alteracao

  Scenario: Renomear pasta com campo em branco
    Given que o usuario esta renomeando uma pasta
    When o usuario limpar o campo e tentar confirmar com nome vazio
    Then o sistema deve cancelar a edicao
    And o nome original da pasta deve ser restaurado

  # --- Excluir pasta ---

  Scenario: Excluir uma pasta vazia exibe confirmacao
    Given que o usuario visualiza uma pasta sem conversas
    When o usuario acionar a exclusao dessa pasta
    Then o sistema deve exibir um modal de confirmacao
    And ao confirmar a pasta deve ser removida da sidebar

  Scenario: Excluir uma pasta com conversas exibe modal de aviso e deleta tudo
    Given que uma pasta contem conversas
    When o usuario acionar a exclusao dessa pasta
    Then o sistema deve exibir um modal de confirmacao alertando que a pasta e todas as conversas serao excluidas permanentemente
    And ao confirmar a pasta deve ser removida da sidebar
    And todas as conversas que estavam na pasta devem ser excluidas permanentemente
    And essas conversas nao devem aparecer na lista solta nem em nenhuma outra parte do app

  Scenario: Cancelar exclusao de pasta
    Given que o usuario acionou a exclusao de uma pasta
    When o usuario cancelar o modal de confirmacao
    Then a pasta deve permanecer na sidebar sem alteracao
    And as conversas dentro dela devem ser preservadas

  # --- Excluir conversa dentro de pasta ---

  Scenario: Excluir uma conversa que esta dentro de uma pasta
    Given que uma pasta contem ao menos uma conversa
    When o usuario excluir essa conversa pelo botao de exclusao da propria conversa
    Then a conversa deve ser removida da lista dentro da pasta
    And a pasta deve permanecer na sidebar

  Scenario: Excluir a ultima conversa de uma pasta
    Given que uma pasta contem exatamente uma conversa
    When o usuario excluir essa conversa
    Then a conversa deve ser removida
    And a pasta deve permanecer na sidebar em estado vazio

  # --- Criar nova conversa em contexto de pasta ---

  Scenario: Nova conversa criada pelo botao da pasta vai para essa pasta
    Given que o usuario visualiza uma pasta na sidebar (expandida ou colapsada)
    When o usuario clicar no botao "+" ao lado do nome dessa pasta
    Then a nova conversa deve ser criada dentro dessa pasta
    And a nova conversa deve se tornar a conversa ativa
    And a pasta deve ser expandida automaticamente para exibir a nova conversa

  Scenario: Nova conversa criada pelo botao geral vai para a lista solta
    Given que o usuario esta no modo Chat
    When o usuario acionar "Nova conversa" pelo botao geral da sidebar
    Then a nova conversa deve ser criada na lista solta fora de qualquer pasta
    And a nova conversa deve se tornar a conversa ativa

  # --- Reordenacao manual ---

  Scenario: Reordenar pastas manualmente por drag-and-drop
    Given que o usuario tem duas ou mais pastas na sidebar
    When o usuario arrastar uma pasta para uma nova posicao na lista de pastas
    Then a pasta deve ocupar a nova posicao na sidebar
    And as demais pastas devem se reposicionar ao redor

  Scenario: Reordenar conversas dentro de uma pasta manualmente
    Given que uma pasta expandida contem duas ou mais conversas
    When o usuario arrastar uma conversa para uma nova posicao dentro da mesma pasta
    Then a conversa deve ocupar a nova posicao dentro da pasta
    And as demais conversas da pasta devem se reposicionar ao redor

  Scenario: Reordenar conversas soltas manualmente
    Given que o usuario tem duas ou mais conversas na lista solta
    When o usuario arrastar uma conversa para uma nova posicao na lista solta
    Then a conversa deve ocupar a nova posicao na lista solta

  # --- Persistencia ---

  Scenario: Pastas, conteudos, ordenacao e estado persistem apos reiniciar o app
    Given que o usuario criou pastas, moveu conversas, reordenou itens e expandiu algumas pastas
    When o usuario fechar e reabrir o app
    Then as pastas devem aparecer na sidebar com seus nomes originais
    And cada pasta deve conter as mesmas conversas de antes do fechamento
    And a ordenacao das pastas e das conversas deve ser a mesma definida pelo usuario
    And o estado expandido ou colapsado de cada pasta deve ser preservado

  Scenario: App reabre na conversa da ultima sessao
    Given que o usuario fechou o app com uma conversa ativa
    When o usuario reabrir o app
    Then a conversa da ultima sessao deve ser automaticamente selecionada
    And se essa conversa estiver dentro de uma pasta colapsada a pasta deve ser expandida automaticamente
```

---

## Criterios de aceitacao

1. O usuario deve conseguir criar uma pasta com nome customizado a partir da sidebar do Chat.
2. A pasta deve aparecer na sidebar acima das conversas soltas.
3. O usuario deve conseguir expandir e colapsar pastas; o estado de expansao deve ser persistido entre sessoes.
4. O usuario deve conseguir mover uma conversa para uma pasta arrastando-a (drag-and-drop) e tambem pode arrastá-la para fora da pasta.
5. Ao mover uma conversa para uma pasta, ela deve desaparecer da posicao original e aparecer dentro da pasta de destino.
6. O usuario deve conseguir retirar uma conversa de uma pasta pelo menu de contexto sem excluir a conversa; ela deve ir para a lista solta.
7. O usuario deve conseguir renomear uma pasta; as conversas dentro dela nao devem ser afetadas.
8. Ao excluir uma pasta, o sistema deve exibir modal de confirmacao; se confirmado, a pasta e todas as conversas dentro dela devem ser permanentemente excluidas (nao migram para a lista solta).
9. O usuario deve conseguir excluir uma conversa dentro de uma pasta; a pasta deve permanecer.
10. O usuario deve conseguir criar uma nova conversa diretamente dentro de uma pasta; se nenhuma pasta estiver selecionada, a conversa vai para a lista solta.
11. O usuario deve conseguir reordenar pastas manualmente por drag-and-drop; a ordenacao deve ser persistida entre sessoes.
12. O usuario deve conseguir reordenar conversas dentro de uma pasta e na lista solta manualmente por drag-and-drop; a ordenacao deve ser persistida.
13. Ao reabrir o app, a conversa da ultima sessao deve ser selecionada automaticamente; se estiver em pasta colapsada, a pasta deve ser expandida.
14. Pastas, nomes, associacoes, ordenacao e estado de expansao devem persistir entre sessoes.
15. Nao deve ser permitido aninhar pastas dentro de pastas (estrutura plana de um nivel).
16. Uma conversa pertence a no maximo uma pasta ao mesmo tempo.
17. Nao ha limite de pastas.

---

## Glossario do dominio

- **Pasta:** agrupador de conversas no modo Chat; identifica um tema ou contexto que une varias conversas; nao pode conter outras pastas (estrutura plana).
- **Conversa:** sequencia de mensagens trocadas entre o usuario e a IA no modo Chat; pode estar dentro de uma pasta ou na lista solta.
- **Lista solta:** conjunto de conversas que nao estao associadas a nenhuma pasta; exibida abaixo das pastas na sidebar.
- **Sidebar do Chat:** painel lateral do modo Chat que lista as pastas e as conversas soltas, alem dos botoes de acao (nova conversa, nova pasta).
- **Estado expandido:** condicao de uma pasta cujas conversas estao visiveis na sidebar.
- **Estado colapsado:** condicao de uma pasta cujas conversas estao ocultas na sidebar.
- **Estado vazio:** condicao de uma pasta que nao contem nenhuma conversa.
- **Mover conversa:** acao de associar uma conversa a uma pasta ou de trocar sua pasta de origem; realizada por drag-and-drop na sidebar.
- **Retirar conversa de pasta:** acao de desassociar uma conversa de sua pasta sem exclui-la; pode ser feita por drag-and-drop para a lista solta ou pelo menu de contexto; a conversa vai para a lista solta.
- **Excluir pasta:** acao de remover permanentemente uma pasta; exige confirmacao em modal; ao confirmar, a pasta e todas as conversas dentro dela sao excluidas permanentemente — as conversas nao migram para a lista solta.
- **Drag-and-drop:** mecanismo de interacao em que o usuario arrasta um item (conversa ou pasta) e o solta em uma nova posicao ou destino na sidebar; usado para mover e reordenar.
- **Ordenacao manual:** ordenacao definida pelo proprio usuario via drag-and-drop; tem precedencia sobre qualquer ordenacao automatica; e persistida entre sessoes.
- **Modal de confirmacao:** janela de dialogo que exige acao explicita do usuario (confirmar ou cancelar) antes de executar operacoes destrutivas como exclusao de pasta com conversas.
- **Menu de contexto:** conjunto de opcoes que aparece ao interagir com uma conversa ou pasta (renomear, excluir, retirar de pasta).

---

## Decisoes tomadas

| # | Decisao |
|---|---|
| 1 | Mover conversa por drag-and-drop; nova conversa pode ser criada diretamente dentro de uma pasta selecionada |
| 2 | Estado expandido/colapsado de cada pasta e persistido entre sessoes |
| 3 | Ordenacao das pastas e manual (drag-and-drop), persistida entre sessoes |
| 4 | Ordenacao das conversas dentro da pasta e manual (drag-and-drop), persistida entre sessoes |
| 5 | Sem limite de pastas |
| 6 | App reabre na conversa da ultima sessao; se estiver em pasta colapsada, a pasta e expandida automaticamente |
| 7 | Pasta nao exibe indicador de quantidade de conversas |
| 8 | Ao excluir pasta: exibe modal de confirmacao; se confirmado, exclui a pasta e todas as conversas permanentemente (nao migra para lista solta) |
| 9 | Exclusao de conversa individual nao exige confirmacao — apenas exclusao de pasta exige modal; racional: pasta representa agrupamento intencional de maior valor, conversa individual tem impacto menor |
| 10 | O mecanismo de criacao de conversa dentro de pasta e o botao "+" ao lado da pasta; o botao geral "Nova conversa" sempre cria na lista solta, independente do estado de expansao das pastas |

---

## Ambiguidades e decisoes pendentes

Nenhuma pendencia. Todas as ambiguidades foram resolvidas.
