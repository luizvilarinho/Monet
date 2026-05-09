# Mini Navegador por Títulos e Subtítulos

## Prioridade: Alta

---

## História de Usuário

**Como** usuário que faz anotações longas com várias seções
**Quero** navegar rapidamente entre títulos e subtítulos da minha nota
**Para** acessar informações específicas sem precisar rolar manualmente

---

## Cenários BDD

### Funcionalidade Principal

```gherkin
Feature: Navegação por estrutura de títulos
  Como usuário do Monet
  Quero ver e navegar pela hierarquia de títulos da minha nota
  Para ter uma visão geral e acesso rápido ao conteúdo

  Scenario: Mini navegador exibe a lista de títulos
    Given que o usuário abriu uma nota com títulos (ex: # Título, ## Subtítulo)
    When o mini navegador está visível
    Then deve exibir uma lista hierárquica dos títulos e subtítulos
    And os títulos devem estar ordenados conforme aparecem no texto

  Scenario: Clicar em título navega até a seção correspondente
    Given que o mini navegador está exibindo uma lista de títulos
    When o usuário clica em um título da lista
    Then o editor deve rolar até a posição do título clicado
    And o título deve ficar visível no centro da tela

  Scenario: Título atual recebe destaque visual
    Given que o usuário rolou o editor até um título
    When o título está visível na área de visualização do editor
    Then o título correspondente no mini navegador deve ter destaque visual (ex: fundo diferente, negrito)

  Scenario: Mini navegador está posicionado na coluna da anotação
    Given que o usuário abriu qualquer nota
    When a página é renderizada
    Then o mini navegador deve estar visível como componente flutuante
    And deve ficar confinado à coluna do editor (área de anotações)
    And não deve sobrepor ao conteúdo do editor
```

### Atualização em Tempo Real

```gherkin
Feature: Atualização dinâmica do navegador

  Scenario: Novo título adicionado é exibido automaticamente
    Given que o usuário está digitando em uma nota
    When o usuário adiciona um novo título (ex: "## Novo Subtítulo")
    Then o novo título deve aparecer no mini navegador imediatamente
    And a hierarquia deve ser atualizada se necessário

  Scenario: Título removido é removido da lista
    Given que o mini navegador exibe vários títulos
    When o usuário apaga ou modifica um título existente
    Then o título removido deve desaparecer do mini navegador
    And a hierarquia deve ser recalculada

  Scenario: Título modificado atualiza a lista
    Given que o mini navegador exibe "## Subtítulo Antigo"
    When o usuário modifica o título para "## Subtítulo Novo"
    Then o mini navegador deve exibir "## Subtítulo Novo"
    And a ordem na lista deve ser mantida

  Scenario: Nota sem títulos exibe estado vazio
    Given que o usuário abriu uma nota sem nenhum título
    When o mini navegador é renderizado
    Then deve exibir um estado vazio (sem conteúdo)
    And o componente deve continuar visível
```

### Navegação e UX

```gherkin
Feature: Experiência de navegação

  Scenario: Navegação por clique funciona em qualquer nível
    Given que o mini navegador exibe títulos aninhados (h1, h2, h3)
    When o usuário clica em um subtítulo (h3)
    Then deve navegar até a posição exata do subtítulo
    And os títulos pais devem estar visíveis no editor

  Scenario: Títulos com o mesmo texto são diferenciados
    Given que a nota tem dois títulos com o mesmo texto (ex: dois "## Conclusão")
    When o mini navegador exibe ambos
    Then cada título deve ser identificável (ex: pela hierarquia ou número da seção)

  Scenario: Mini navegador mantém estado ao trocar de nota
    Given que o usuário navega para outra nota
    When a nova nota é aberta
    Then o mini navegador deve exibir os títulos da nova nota
    And o estado de rolagem do navegador deve ser resetado

  Scenario: Representação visual compacta com tooltip
    Given que o mini navegador está visível
    When o usuário passa o mouse sobre um indicador de título
    Then deve aparecer um box flutuante com o título original completo
    And o box deve desaparecer ao mover o mouse para fora

  Scenario: Menu ancorado ao clicar no título
    Given que o mini navegador está visível
    When o usuário clica em um título no menu
    Then o menu deve se posicionar (ancorar) na tela
    And o editor deve rolar até a seção correspondente
```

---

## Critérios de Aceitação

### [MUST] - Obrigatórios
- [ ] Mini navegador está visível como componente flutuante na coluna do editor
- [ ] Exibe todos os títulos (h1-h6) da nota atual
- [ ] Mantém hierarquia visual (identação para subtítulos)
- [ ] Clicar em qualquer título rola o editor até a posição do título
- [ ] Título atual recebe destaque visual (ex: background diferente)
- [ ] Atualiza automaticamente quando o conteúdo da nota muda
- [ ] Funciona com markdown padrão (ATX style: #, ##, ###)
- [ ] Títulos longos são representados por traços/indicadores compactos
- [ ] Tooltip com título completo aparece ao hover

### [SHOULD] - Desejáveis
- [ ] Suportar Setext-style headers (===, ---)
- [ ] Numerar os títulos (1, 1.1, 1.2, etc.)
- [ ] Minimizar/maximizar o mini navegador
- [ ] Tooltip com preview do primeiro parágrafo da seção ao hover
- [ ] Teclas de atalho para navegar entre títulos (Ctrl+[ e Ctrl+])

### [COULD] - Opcionais
- [ ] Filtro/Busca dentro dos títulos
- [ ] Drag and drop para reorganizar seções
- [ ] Contador de palavras por seção
- [ ] Colapso/expansão de seções aninhadas

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **Mini navegador** | Componente de navegação flutuante que exibe a estrutura hierárquica de títulos da nota |
| **Título** | Texto precedido por # no markdown (ATX-style), dos níveis h1 (#) a h6 (######) |
| **Subtítulo** | Títulos de nível h2 ou inferior, filhos de um título pai |
| **Hierarquia** | Relação pai-filho entre títulos baseada no nível (h1 > h2 > h3, etc.) |
| **Setext-style** | Formato alternativo de títulos no markdown usando = ou - na linha abaixo |
| **ATX-style** | Formato de títulos no markdown usando # no início da linha |
| **Destaque visual** | Indicador visual (cor, peso da fonte, etc.) que mostra qual título está ativamente visível no editor |
| **Tooltip** | Box flutuante que aparece ao passar o mouse sobre um elemento |

---

## Decisões de Projeto

| ID | Questão | Decisão | Impacto |
|----|---------|---------|--------|
| B1 | O mini navegador deve ser fixo ou flutuante? | **Flutuante, mas confinado à coluna da anotação** | UX - espaço na tela |
| B2 | Como tratar títulos muito longos que não cabem no componente? | **Representar como traços/indicadores compactos, com tooltip do título original ao hover** (referência: Capacities, Obsidian) | Usabilidade |
| B3 | O navegador deve mostrar a contagem de seções/parágrafos? | **Não** | Complexidade visual |
| B4 | Deve suportar âncoras personalizadas (ex: #minha-seção)? | **Não, mas ao clicar no título do menu flutuante, o menu deve se ancorar na tela** | Compatibilidade |
