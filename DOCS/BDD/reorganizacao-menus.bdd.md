# BDD - Reorganizacao dos Menus Principais

## Historias de usuario

### HU-01 - Navegar entre Cadernos e Chat no menu principal
Prioridade: Alta

Como usuario do Monet
Quero ver dois menus principais no canto superior esquerdo: Cadernos e Chat
Para alternar rapidamente entre anotações e conversas com a IA

### HU-02 - Acessar anotações como submenu de Cadernos
Prioridade: Alta

Como usuario do Monet
Quero que a lista de cadernos e anotações fique acessível sob o menu Cadernos
Para manter a organização hierárquica e não perder o fluxo de trabalho atual

### HU-03 - Acessar o chat com a IA como menu independentemente
Prioridade: Alta

Como usuario do Monet
Quero clicar no menu Chat para abri-lo como um painel separado
Para conversar com a IA sem precisar estar em uma nota específica

---

## Cenarios BDD

```gherkin
Feature: Reorganizacao dos menus principais
  Como usuario do Monet
  Quero navegar entre Cadernos e Chat a partir de um menu principal unificado
  Para ter acesso rápido a ambas funcionalidades mantendo a organização visual

  Background:
    Given que o aplicativo Monet esta aberto

  Scenario: Exibir os dois menus principais no canto superior esquerdo
    Given que o usuario abriu o Monet
    When a interface for carregada
    Then o canto superior esquerdo deve exibir dois menus principais lado a lado
    And o primeiro menu deve ser "Cadernos"
    And o segundo menu deve ser "Chat"
    And ambos os menus devem estar visiveis simultaneamente

  Scenario: Menu Cadernos exibe submenus de anotações
    Given que o menu "Cadernos" esta visivel
    When o usuario clicar no menu "Cadernos"
    Then deve abrir um dropdown ou painel lateral com os submenus
    And o submenu deve conter a lista de cadernos (NotebookList)
    And o submenu deve conter a lista de anotações do caderno selecionado (Sidebar)
    And o layout deve ser o mesmo atual do NotebookList e Sidebar

  Scenario: Menu Chat abre painel de conversa
    Given que o menu "Chat" esta visivel
    When o usuario clicar no menu "Chat"
    Then deve abrir um painel de chat com a IA
    And o painel deve conter um campo de input para digitar mensagens
    And o painel deve conter o histórico de mensagens anteriores
    And o painel deve estar posicionado de forma nao obstrutiva

  Scenario: Alternar entre Cadernos e Chat
    Given que o usuario tem o menu Cadernos aberto exibindo anotações
    When o usuario clicar no menu "Chat"
    Then o painel de Cadernos deve permanecer visivel ou ser recolhido conforme configuração
    And o painel de Chat deve abrir
    And o usuario deve conseguir interagir com o Chat independentemente

  Scenario: Menu Cadernos recolhido exibe apenas icone
    Given que o menu "Cadernos" esta configurado para modo recolhido
    When a interface for carregada
    Then o menu "Cadernos" deve exibir apenas um icone
    And o menu "Chat" deve permanecer visivel
    And ao passar o mouse ou clicar, o menu deve expandir

  Scenario: Menu Chat recolhido exibe apenas icone
    Given que o menu "Chat" esta configurado para modo recolhido
    When a interface for carregada
    Then o menu "Chat" deve exibir apenas um icone
    And o menu "Cadernos" deve permanecer visivel
    And ao clicar no icone, o painel de Chat deve abrir

  Scenario: Navegacao por teclado entre menus
    Given que os menus "Cadernos" e "Chat" estao visiveis
    When o usuario usar a tecla Tab para navegar
    Then o foco deve alternar entre os dois menus principais
    And o usuario deve conseguir abrir qualquer menu usando Enter/Space

  Scenario: Persistir estado de abertura dos menus
    Given que o usuario abriu o menu "Cadernos"
    And depois abriu o menu "Chat"
    When o usuario fechar e reabrir o aplicativo
    Then os menus devem manter seu estado anterior (aberto/fechado)
    Or os menus devem reabrir no estado padrao configurado

  Scenario: Chat funciona independentemente de nota selecionada
    Given que o usuario abriu o menu "Chat"
    And nao ha nenhuma nota selecionada
    When o usuario enviar uma mensagem no Chat
    Then o Chat deve processar a mensagem normalmente
    And a conversa deve ser persistida no histórico do Chat
    And a resposta da IA deve aparecer no painel de Chat

  Scenario: Chat mantem contexto da nota ativa quando aplicavel
    Given que o usuario tem uma nota selecionada
    And o usuario abriu o menu "Chat"
    When o usuario enviar uma mensagem no Chat
    Then o Chat pode opcionalmente usar o conteudo da nota como contexto
    And o usuario deve ter opcao de enviar mensagem com ou sem contexto da nota

  Scenario: NotebookList e Sidebar mantem funcionalidade atual
    Given que o menu "Cadernos" foi clicado
    When o usuario interagir com o NotebookList
    Then todas as funcionalidades atuais devem funcionar
    And o usuario deve conseguir criar, renomear e deletar cadernos
    And o usuario deve conseguir selecionar um caderno
    When o usuario interagir com o Sidebar
    Then todas as funcionalidades atuais devem funcionar
    And o usuario deve conseguir criar, reordenar e deletar anotações
    And o usuario deve conseguir selecionar uma anotação para editar

  Scenario: Redimensionamento dos painels de Cadernos
    Given que o menu "Cadernos" esta aberto com NotebookList e Sidebar
    When o usuario arrastar a borda do NotebookList
    Then o NotebookList deve ser redimensionado
    And as preferencias de largura devem ser persistidas
    When o usuario arrastar a borda do Sidebar
    Then o Sidebar deve ser redimensionado
    And as preferencias de largura devem ser persistidas

  Scenario: Redimensionamento do painel de Chat
    Given que o menu "Chat" esta aberto
    When o usuario arrastar a borda do painel de Chat
    Then o painel de Chat deve ser redimensionado
    And as preferencias de largura devem ser persistidas
```

---

## Criterios de aceitacao

### Menu Principal
1. O canto superior esquerdo da interface deve exibir dois menus principais: "Cadernos" e "Chat".
2. Ambos os menus devem ser acessíveis via mouse e teclado.
3. Os menus devem ter estados visuais claros (ativo, hover, inativo).
4. O layout dos menus deve ser responsivo e se adaptar a diferentes tamanhos de tela.

### Menu Cadernos
5. O menu "Cadernos" deve conter como submenus o NotebookList e o Sidebar atual.
6. O NotebookList deve manter todas as suas funcionalidades atuais (criar, renomear, deletar, reordenar cadernos).
7. O Sidebar deve manter todas as suas funcionalidades atuais (criar, reordenar, deletar, selecionar anotações).
8. O comportamento de recolher/expandir do NotebookList deve ser preservado.
9. O comportamento de recolher/expandir do Sidebar deve ser preservado.
10. As preferências de largura de ambos os painéis devem ser persistidas.

### Menu Chat
11. O menu "Chat" deve abrir um painel dedicado para conversas com a IA.
12. O painel de Chat deve conter um campo de input para digitar mensagens.
13. O painel de Chat deve exibir o histórico de mensagens (usuário e assistente).
14. O painel de Chat deve suportar redimensionamento.
15. As preferências de largura do painel de Chat devem ser persistidas.

### Integração com IA existente
16. O Chat deve reutilizar a integração existente com OpenRouter/Anthropic.
17. O Chat deve reutilizar a camada de storage existente (IndexedDB/SQLite) para persistir mensagens.
18. O Chat deve exibir respostas em streaming, semelhante ao AiPanel atual.

### Compatibilidade
19. A reorganização não deve quebrar a funcionalidade existente do AiPanel.
20. A reorganização não deve quebrar a funcionalidade existente do Editor.
21. A reorganização não deve quebrar a funcionalidade existente da Toolbar.

---

## Glossario do dominio

- **Monet**: aplicacao desktop de notas com IA para apoio ao estudo.
- **Menu Principal**: area no canto superior esquerdo contendo os menus Cadernos e Chat.
- **Menu Cadernos**: menu principal que agrupa o NotebookList e Sidebar como submenus.
- **Menu Chat**: menu principal que abre o painel de conversa com a IA.
- **NotebookList**: componente atual que exibe a lista de cadernos (notebooks).
- **Sidebar**: componente atual que exibe a lista de anotações do caderno selecionado.
- **AiPanel**: painel atual que exibe respostas de IA geradas por /comandos nas notas.
- **Painel de Chat**: novo painel para conversas interativas com a IA, independentemente de notas.
- **OpenRouter**: gateway de IA usado pelo Monet para acessar diferentes modelos.
- **Storage**: camada de persistência abstrata (SQLite para desktop, IndexedDB para web).

---

## Ambiguidades e decisoes pendentes

1. **Posicionamento dos menus**: Os menus "Cadernos" e "Chat" devem ser botões lado a lado na horizontal, ou um menu dropdown vertical?
   - *Sugestao: Botões lado a lado na horizontal, similar a abas*.

2. **Comportamento ao clicar**: O menu "Cadernos" deve abrir um dropdown ou deve manter o NotebookList/Sidebar sempre visíveis como painéis laterais?
   - *Sugestao: Manter NotebookList e Sidebar como painéis laterais recolhíveis, similar ao comportamento atual*.

3. **Relação entre Chat e AiPanel**: O novo painel de Chat deve substituir o AiPanel, coexistir com ele, ou ser uma evolução do AiPanel?
   - *Sugestao: Coexistir. AiPanel continua para respostas de /comandos, Chat é para conversas livres*.

4. **Contexto da nota no Chat**: Ao usar o Chat com uma nota selecionada, o Chat deve automaticamente usar o conteúdo da nota como contexto, ou isso deve ser opcional?
   - *Sugestao: Opcional, com um botão ou toggle para incluir/excluir contexto da nota*.

5. **Histórico do Chat**: O histórico de mensagens do Chat deve ser global (um único chat) ou por nota (cada nota tem seu chat)?
   - *Sugestao: Inicialmente global, com possibilidade futura de chat por nota*.

6. **Posição do painel de Chat**: O painel de Chat deve abrir à direita (como o AiPanel), à esquerda, ou em uma posição configurável?
   - *Sugestao: À direita, substituindo ou ao lado do AiPanel*.

7. **Teclas de atalho**: Devem ser criadas teclas de atalho para alternar entre Cadernos e Chat?
   - *Sugestao: Sim, Ctrl+1 para Cadernos, Ctrl+2 para Chat*.

8. **Persistência do estado**: O estado de abertura/fechamento dos menus deve ser persistido entre sessões?
   - *Sugestao: Sim, usar localStorage*.
