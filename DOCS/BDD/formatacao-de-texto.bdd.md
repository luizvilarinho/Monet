# BDD — Formatação de Texto no Editor

**Produto:** Monet  
**Domínio:** Editor de Anotações  
**Versão:** 1.1  
**Data:** 2026-04-23  

---

## Glossário do Domínio

| Termo | Definição |
|---|---|
| **Editor** | Componente CodeMirror 6 onde o usuário escreve anotações em markdown |
| **Seleção** | Trecho de texto destacado pelo usuário com o cursor |
| **Régua de Formatação** | Barra de ações flutuante que aparece acima da seleção ativa |
| **Formatação** | Marcação markdown aplicada a um trecho de texto (ex: `**negrito**`) |
| **Toggle de Formatação** | Ação que aplica uma formatação se ausente, ou a remove se já presente |
| **Título (H1)** | Linha de maior hierarquia, prefixada com `# ` no markdown |
| **Subtítulo (H2)** | Linha de segundo nível, prefixada com `## ` no markdown |
| **Subtítulo menor (H3)** | Linha de terceiro nível, prefixada com `### ` no markdown |
| **Negrito** | Texto envolvido por `**` no markdown, ex: `**texto**` |
| **Itálico** | Texto envolvido por `*` no markdown, ex: `*texto*` |
| **Lista Não-numerada** | Bloco de itens prefixados com `- ` no markdown |
| **Lista Numerada** | Bloco de itens prefixados com `1.`, `2.`, etc. no markdown |
| **Item TODO** | Linha de lista com checkbox vazio: `- [ ] texto` |
| **Item TODO Concluído** | Linha de lista com checkbox marcado: `- [x] texto` |
| **Checkbox** | Elemento visual `[ ]` ou `[x]` que representa o estado do TODO |

---

## Feature 1: Títulos e Subtítulos

```
Feature: Formatação de Títulos e Subtítulos
  Como usuário do Monet
  Quero formatar linhas como títulos ou subtítulos
  Para organizar hierarquicamente o conteúdo das minhas anotações
```

### Scenarios

```gherkin
Scenario: Aplicar título H1 em uma linha de texto simples
  Given o usuário tem uma anotação aberta no editor
  And há uma linha com texto simples "Introdução ao tema"
  And o usuário seleciona o texto "Introdução ao tema"
  When o usuário clica no botão "H1" na Régua de Formatação
  Then a linha é transformada em "# Introdução ao tema"
  And o texto é renderizado visualmente como título principal

Scenario: Aplicar subtítulo H2 em uma linha de texto simples
  Given o usuário tem uma anotação aberta no editor
  And há uma linha com texto simples "Conceitos básicos"
  And o usuário seleciona o texto "Conceitos básicos"
  When o usuário clica no botão "H2" na Régua de Formatação
  Then a linha é transformada em "## Conceitos básicos"
  And o texto é renderizado visualmente como subtítulo

Scenario: Aplicar subtítulo H3 em uma linha de texto simples
  Given o usuário tem uma anotação aberta no editor
  And há uma linha com texto simples "Exemplo prático"
  And o usuário seleciona o texto "Exemplo prático"
  When o usuário clica no botão "H3" na Régua de Formatação
  Then a linha é transformada em "### Exemplo prático"
  And o texto é renderizado visualmente como subtítulo menor

Scenario: Trocar nível de título já existente
  Given o usuário tem uma linha com "## Subtítulo"
  And o usuário seleciona o texto nessa linha
  When o usuário clica no botão "H1" na Régua de Formatação
  Then a linha é atualizada para "# Subtítulo"
  And o prefixo "##" é substituído por "#"

Scenario: Remover formatação de título (toggle)
  Given o usuário tem uma linha com "# Meu Título"
  And o usuário seleciona o texto nessa linha
  When o usuário clica no botão "H1" na Régua de Formatação (que está ativo)
  Then o prefixo "# " é removido
  And a linha volta a ser texto simples "Meu Título"
```

### Critérios de Aceitação — Títulos

- [ ] A formatação de título é aplicada na linha inteira, independentemente de qual parte do texto está selecionada
- [ ] Aplicar H1 em uma linha com H2 substitui `##` por `#` (não acumula prefixos)
- [ ] O botão de nível ativo na Régua deve ter estado visual diferenciado (destacado)
- [ ] Ao remover o título, nenhum espaço residual permanece no início da linha

---

## Feature 2: Negrito e Itálico

```
Feature: Formatação Inline de Negrito e Itálico
  Como usuário do Monet
  Quero marcar trechos de texto como negrito ou itálico
  Para enfatizar informações importantes nas minhas anotações
```

### Scenarios

```gherkin
Scenario: Aplicar negrito em uma seleção de texto
  Given o usuário tem uma linha com "O conceito central é importante"
  And o usuário seleciona o trecho "importante"
  When o usuário clica no botão "Negrito" na Régua de Formatação
  Then o texto é transformado em "O conceito central é **importante**"

Scenario: Aplicar itálico em uma seleção de texto
  Given o usuário tem uma linha com "Veja a definição formal do termo"
  And o usuário seleciona o trecho "definição formal"
  When o usuário clica no botão "Itálico" na Régua de Formatação
  Then o texto é transformado em "Veja a *definição formal* do termo"

Scenario: Remover negrito de texto já formatado (toggle)
  Given o usuário tem a linha "O conceito central é **importante**"
  And o usuário seleciona o trecho "**importante**" (ou apenas "importante")
  When o usuário clica no botão "Negrito" na Régua de Formatação (que está ativo)
  Then as marcações `**` são removidas
  And o texto volta a ser "O conceito central é importante"

Scenario: Remover itálico de texto já formatado (toggle)
  Given o usuário tem a linha "Veja a *definição formal* do termo"
  And o usuário seleciona o trecho "*definição formal*" (ou apenas "definição formal")
  When o usuário clica no botão "Itálico" na Régua de Formatação (que está ativo)
  Then as marcações `*` são removidas
  And o texto volta a ser "Veja a definição formal do termo"

Scenario: Aplicar negrito e itálico simultaneamente
  Given o usuário tem uma linha com texto simples "atenção máxima"
  And o usuário seleciona o trecho "atenção máxima"
  When o usuário clica no botão "Negrito" na Régua de Formatação
  And o usuário clica no botão "Itálico" na Régua de Formatação
  Then o texto é transformado em "***atenção máxima***"

Scenario: Aplicar negrito com seleção parcial dentro de uma palavra
  Given o usuário tem uma linha com texto simples "conceito fundamental"
  And o usuário seleciona apenas parte da palavra, ex: "fund" dentro de "fundamental"
  When o usuário clica no botão "Negrito" na Régua de Formatação
  Then a formatação é expandida para cobrir a palavra inteira "fundamental"
  And o resultado é "conceito **fundamental**"

Scenario: Aplicar itálico com seleção parcial dentro de uma palavra
  Given o usuário tem uma linha com texto simples "termo técnico"
  And o usuário seleciona apenas parte da palavra, ex: "écni" dentro de "técnico"
  When o usuário clica no botão "Itálico" na Régua de Formatação
  Then a formatação é expandida para cobrir a palavra inteira "técnico"
  And o resultado é "termo *técnico*"
```

### Critérios de Aceitação — Negrito e Itálico

- [ ] Quando a seleção cobre apenas parte de uma palavra, a formatação é aplicada na palavra inteira (expansão automática da seleção)
- [ ] Quando a seleção cobre múltiplas palavras, a formatação respeita exatamente os limites da seleção
- [ ] O estado ativo dos botões (Negrito/Itálico) deve refletir a formatação presente na seleção atual
- [ ] Seleção com formatação mista (parte em negrito, parte sem) deve aplicar negrito em toda a palavra ou trecho selecionado

---

## Feature 3: Listas Numeradas e Não-numeradas

```
Feature: Criação de Listas no Editor
  Como usuário do Monet
  Quero criar listas numeradas e não-numeradas no editor
  Para estruturar sequências de itens ou enumerações nas minhas anotações
```

### Scenarios

```gherkin
Scenario: Aplicar lista não-numerada em uma linha de texto simples
  Given o usuário tem uma linha com texto "Primeiro ponto"
  And o usuário seleciona o texto "Primeiro ponto"
  When o usuário clica no botão "Lista" na Régua de Formatação
  Then a linha é transformada em "- Primeiro ponto"

Scenario: Aplicar lista não-numerada em múltiplas linhas selecionadas
  Given o usuário tem as linhas:
    """
    Ponto A
    Ponto B
    Ponto C
    """
  And o usuário seleciona as três linhas
  When o usuário clica no botão "Lista" na Régua de Formatação
  Then cada linha recebe o prefixo "- ":
    """
    - Ponto A
    - Ponto B
    - Ponto C
    """

Scenario: Aplicar lista numerada em uma linha de texto simples
  Given o usuário tem uma linha com texto "Primeiro passo"
  And o usuário seleciona o texto "Primeiro passo"
  When o usuário clica no botão "Lista Numerada" na Régua de Formatação
  Then a linha é transformada em "1. Primeiro passo"

Scenario: Aplicar lista numerada em múltiplas linhas selecionadas
  Given o usuário tem as linhas:
    """
    Instalar dependências
    Configurar banco
    Iniciar servidor
    """
  And o usuário seleciona as três linhas
  When o usuário clica no botão "Lista Numerada" na Régua de Formatação
  Then as linhas são numeradas sequencialmente:
    """
    1. Instalar dependências
    2. Configurar banco
    3. Iniciar servidor
    """

Scenario: Remover formatação de lista não-numerada (toggle)
  Given o usuário tem a linha "- Um item de lista"
  And o usuário seleciona a linha
  When o usuário clica no botão "Lista" na Régua de Formatação (que está ativo)
  Then o prefixo "- " é removido
  And a linha volta a ser texto simples "Um item de lista"

Scenario: Converter lista não-numerada em numerada
  Given o usuário tem as linhas:
    """
    - Item A
    - Item B
    """
  And o usuário seleciona as duas linhas
  When o usuário clica no botão "Lista Numerada" na Régua de Formatação
  Then as linhas são convertidas para:
    """
    1. Item A
    2. Item B
    """
```

### Critérios de Aceitação — Listas

- [ ] Ao aplicar lista em múltiplas linhas, todas as linhas da seleção recebem o prefixo
- [ ] A numeração da lista numerada começa sempre em 1 quando aplicada via régua
- [ ] Linhas em branco dentro da seleção não devem receber prefixo de lista
- [ ] Converter de lista não-numerada para numerada substitui o prefixo sem duplicar

---

## Feature 4: Itens TODO (Checklist)

```
Feature: Criação e Gerenciamento de Itens TODO
  Como usuário do Monet
  Quero marcar textos como tarefas pendentes com checkbox
  Para acompanhar ações identificadas durante minhas anotações
```

### Scenarios

```gherkin
Scenario: Aplicar marcação TODO em uma linha de texto
  Given o usuário tem uma linha com texto "Revisar o capítulo 3"
  And o usuário seleciona o texto "Revisar o capítulo 3"
  When o usuário clica no botão "TODO" na Régua de Formatação
  Then a linha é transformada em "- [ ] Revisar o capítulo 3"
  And o checkbox é exibido visualmente como desmarcado

Scenario: Aplicar marcação TODO em múltiplas linhas
  Given o usuário tem as linhas:
    """
    Comprar o livro indicado
    Assistir a palestra complementar
    """
  And o usuário seleciona as duas linhas
  When o usuário clica no botão "TODO" na Régua de Formatação
  Then as linhas são transformadas em:
    """
    - [ ] Comprar o livro indicado
    - [ ] Assistir a palestra complementar
    """

Scenario: Marcar um item TODO como concluído
  Given o usuário tem a linha "- [ ] Revisar o capítulo 3"
  And o checkbox está exibido como desmarcado
  When o usuário clica no checkbox do item
  Then a linha é atualizada para "- [x] Revisar o capítulo 3"
  And o checkbox é exibido visualmente como marcado (com X)

Scenario: Desmarcar um item TODO já concluído
  Given o usuário tem a linha "- [x] Revisar o capítulo 3"
  And o checkbox está exibido como marcado
  When o usuário clica no checkbox do item
  Then a linha é atualizada para "- [ ] Revisar o capítulo 3"
  And o checkbox volta a ser exibido como desmarcado

Scenario: Remover formatação TODO de um item (toggle)
  Given o usuário tem a linha "- [ ] Uma tarefa"
  And o usuário seleciona a linha
  When o usuário clica no botão "TODO" na Régua de Formatação (que está ativo)
  Then o prefixo "- [ ] " é removido
  And a linha volta a ser texto simples "Uma tarefa"
```

### Critérios de Aceitação — TODO

- [ ] O checkbox clicável deve ser visualmente distinto do texto da tarefa
- [ ] O clique no checkbox aciona save imediato da nota, sem aguardar auto-save
- [ ] Itens `- [x]` devem exibir o texto com riscado **e** cor diferente (muted) simultaneamente
- [ ] O clique no checkbox não deve mover o foco do cursor dentro do editor

---

## Feature 5: Régua de Formatação Flutuante

```
Feature: Régua de Formatação Flutuante (Inline Toolbar)
  Como usuário do Monet
  Quero ver as opções de formatação ao selecionar texto
  Para acessar ações de formatação sem sair do fluxo de escrita
```

### Scenarios

```gherkin
Scenario: Exibir a régua ao selecionar texto
  Given o usuário tem uma anotação aberta no editor
  And o editor está em foco
  When o usuário seleciona um trecho de texto com o cursor
  Then a Régua de Formatação aparece acima da seleção
  And a régua exibe os botões: H1, H2, H3, Negrito, Itálico, Lista, Lista Numerada, TODO

Scenario: Ocultar a régua ao desfazer a seleção
  Given a Régua de Formatação está visível sobre uma seleção
  When o usuário clica fora da seleção (desfaz o highlight)
  Then a Régua de Formatação desaparece

Scenario: Ocultar a régua ao pressionar Escape
  Given a Régua de Formatação está visível sobre uma seleção
  When o usuário pressiona a tecla Escape
  Then a Régua de Formatação desaparece
  And a seleção é mantida ou removida conforme comportamento padrão do editor

Scenario: Régua permanece visível ao interagir com seus botões
  Given a Régua de Formatação está visível sobre uma seleção
  When o usuário clica em um botão da régua (ex: "Negrito")
  Then a formatação é aplicada
  And a Régua de Formatação permanece visível enquanto houver seleção ativa

Scenario: Régua posicionada acima da seleção sem sair da viewport
  Given o usuário seleciona texto próximo ao topo do editor
  When a Régua de Formatação é exibida
  Then a régua é posicionada sem ultrapassar os limites visíveis da janela
  And a régua não cobre o texto selecionado

Scenario: Botão ativo reflete o estado da seleção atual
  Given o usuário tem a linha "## Subtítulo"
  When o usuário seleciona texto nessa linha
  Then o botão "H2" na Régua aparece com estado visual ativo (destacado)
  And os demais botões de título (H1, H3) aparecem inativos

Scenario: Régua não exibida para seleção vazia (apenas cursor)
  Given o usuário clica em um ponto do editor (sem arrastar)
  And nenhum texto está selecionado
  Then a Régua de Formatação não é exibida
```

### Critérios de Aceitação — Régua Flutuante

- [ ] A régua deve aparecer em até 200ms após o usuário completar a seleção
- [ ] A régua não deve ser exibida quando a seleção ocorre fora do editor (ex: seleção na sidebar)
- [ ] A posição da régua deve ser recalculada se a janela for redimensionada com seleção ativa
- [ ] Não haverá atalhos de teclado para formatação (ex: Ctrl+B, Ctrl+I) — a régua é o único caminho
- [ ] A régua deve ter contraste suficiente com o fundo do editor para ser legível no tema escuro
- [ ] A régua deve funcionar da mesma forma no webapp (fase 3), reaproveitando o mesmo componente React

---

## Decisões Registradas

| # | Decisão | Resolução |
|---|---|---|
| 1 | **Limite de níveis de título** | Suporta apenas H1, H2 e H3. Botões H4–H6 não serão exibidos na régua. |
| 2 | **Seleção parcial com formatação mista** | A formatação é expandida para cobrir a **palavra inteira** onde a seleção toca. |
| 3 | **Persistência do checkbox** | O clique no checkbox aciona **save imediato**, sem aguardar auto-save. |
| 4 | **Atalhos de teclado** | Não haverá atalhos no MVP. A régua flutuante é o único caminho de formatação. |
| 5 | **Linhas em branco em seleção de lista** | Linhas em branco dentro da seleção são **ignoradas** e não recebem prefixo de lista. |
| 6 | **Aparência visual de TODO concluído** | Item `[x]` exibe **texto riscado e cor muted simultaneamente**. |
| 7 | **Régua no webapp futuro (fase 3)** | A régua deve funcionar da mesma forma no webapp, reaproveitando o mesmo componente React. |
