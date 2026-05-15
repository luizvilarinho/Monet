# BDD — Editor WYSIWYG (Migração para TipTap)

**Produto:** Monet
**Domínio:** Editor de Anotações
**Versão:** 1.0
**Data:** 2026-05-15

---

## Contexto do produto

Hoje o editor do Monet exibe markdown como texto bruto (`**negrito**`, `## Título`,
`- [ ] tarefa`). Para ver o resultado formatado, o usuário precisa acionar um
botão "preview" separado. Essa fricção interrompe o fluxo de estudo.

Este BDD descreve o comportamento esperado do editor após a migração para um
modo **WYSIWYG** (What You See Is What You Get): a marcação markdown é
substituída visualmente em tempo real pelo resultado formatado, e o botão
preview deixa de existir.

Este BDD cobre apenas o editor base e a formatação inline. Os comportamentos
relacionados a `/comandos` e a blocos embutidos de resposta da IA estão em BDDs
separados — ver [Decisões registradas](#decisões-registradas).

---

## Glossário do domínio

| Termo | Definição |
|---|---|
| **Editor** | Componente onde o usuário escreve e edita o conteúdo da nota |
| **Modo WYSIWYG** | Modo de edição em que a formatação aparece renderizada em tempo real enquanto o usuário digita, sem necessidade de modo preview |
| **Marcação markdown** | Sintaxe textual que define formatação (ex: `**texto**` para negrito) |
| **Símbolos de marcação** | Caracteres da sintaxe markdown que sinalizam formatação (`**`, `*`, `#`, `-`, `[ ]`, etc.) |
| **Cursor na linha** | Estado em que o cursor de edição está posicionado dentro de uma linha específica |
| **Régua de Formatação** | Barra de ações flutuante que aparece acima da seleção de texto |
| **Título (H1, H2, H3)** | Linhas com hierarquia visual de cabeçalho |
| **Item TODO** | Linha de lista com checkbox: vazio ou marcado |
| **Checkbox** | Elemento visual clicável que representa o estado de um Item TODO |
| **Modo preview (legado)** | Modo de visualização separado do editor atual; será **removido** com a migração |

---

## Histórias de usuário

### HU-01 — Ver formatação em tempo real
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** que a formatação (negrito, títulos, listas) apareça já renderizada enquanto escrevo
**Para** revisar minhas anotações sem precisar acionar um modo preview separado

### HU-02 — Eliminar o botão preview
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** que o editor seja o único modo de visualização da nota
**Para** não ter que alternar entre "edição" e "preview" no meu fluxo de estudo

### HU-03 — Interagir diretamente com checkboxes
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** clicar diretamente no checkbox de um Item TODO no editor
**Para** marcar tarefas como concluídas sem editar `[ ]` para `[x]` manualmente

### HU-04 — Manter a régua de formatação
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** continuar usando a régua flutuante para aplicar formatação a uma seleção
**Para** preservar o fluxo de uso que já conheço

### HU-05 — Preservar o conteúdo ao recarregar
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** que minha nota seja salva e carregada sem perda de informação
**Para** confiar que o que vejo no editor é exatamente o que está persistido

---

## Cenários BDD

### Feature 1: Renderização WYSIWYG em tempo real

```gherkin
Feature: Renderização WYSIWYG da marcação markdown
  Como usuário do Monet
  Quero ver a formatação aparecer enquanto digito
  Para não depender de um modo preview separado

  Scenario: Negrito aparece renderizado enquanto o usuário digita
    Given o editor está aberto com uma nota vazia
    When o usuário digita "**importante**"
    Then o texto "importante" é exibido em negrito
    And os símbolos de marcação `**` não aparecem como texto visível quando o cursor sai da palavra

  Scenario: Itálico aparece renderizado enquanto o usuário digita
    Given o editor está aberto com uma nota vazia
    When o usuário digita "*atenção*"
    Then o texto "atenção" é exibido em itálico
    And os símbolos de marcação `*` não aparecem como texto visível quando o cursor sai da palavra

  Scenario: Título aparece com hierarquia visual em tempo real
    Given o editor está aberto com uma nota vazia
    When o usuário digita "# Introdução"
    Then a linha "Introdução" é exibida com o estilo visual de Título H1
    And o símbolo `#` não aparece como texto visível quando o cursor sai da linha

  Scenario: Lista não-numerada aparece com marcadores visuais
    Given o editor está aberto com uma nota vazia
    When o usuário digita "- Primeiro item" e pressiona Enter
    And digita "Segundo item"
    Then as duas linhas são exibidas como itens de lista com marcadores visuais
    And os hífens `-` não aparecem como texto visível

  Scenario: Lista numerada aparece com numeração automática
    Given o editor está aberto com uma nota vazia
    When o usuário digita "1. Passo um" e pressiona Enter
    And digita "Passo dois"
    Then as duas linhas são exibidas como lista numerada visualmente
    And a segunda linha exibe o número "2" automaticamente

  Scenario: Item TODO aparece com checkbox clicável
    Given o editor está aberto com uma nota vazia
    When o usuário digita "- [ ] Revisar capítulo 3"
    Then a linha é exibida como Item TODO com um checkbox desmarcado clicável
    And o texto "[ ]" não aparece como texto visível
```

### Feature 2: Edição inline da marcação

```gherkin
Feature: Edição inline de texto com formatação
  Como usuário do Monet
  Quero editar o texto formatado diretamente sem manipular símbolos markdown
  Para focar no conteúdo, não na sintaxe

  Scenario: Editar texto dentro de negrito
    Given a linha tem o trecho "importante" exibido em negrito
    When o usuário posiciona o cursor no meio da palavra "importante"
    And digita caracteres novos
    Then o texto editado permanece em negrito
    And os caracteres digitados são inseridos sem aparecer símbolos `**` à vista do usuário

  Scenario: Remover formatação ao apagar dentro de um trecho formatado
    Given a linha tem o trecho "importante" exibido em negrito
    When o usuário seleciona o trecho e clica em "Negrito" na Régua de Formatação (ativo)
    Then a formatação de negrito é removida
    And o texto "importante" volta a ser exibido como texto simples

  Scenario: Continuar lista ao pressionar Enter
    Given o cursor está ao final de um item de lista não-numerada
    When o usuário pressiona Enter
    Then uma nova linha é criada já com marcador de lista
    And o usuário pode digitar o próximo item sem digitar "- "

  Scenario: Encerrar lista ao pressionar Enter em item vazio
    Given o cursor está em um item de lista vazio (sem texto após o marcador)
    When o usuário pressiona Enter
    Then o item de lista vazio é convertido em parágrafo simples
    And o usuário pode continuar escrevendo fora da lista

  Scenario: Continuar lista numerada com numeração contínua
    Given o cursor está ao final do item "2. Passo dois" em uma lista numerada
    When o usuário pressiona Enter e digita "Passo três"
    Then o terceiro item aparece com o número "3" automaticamente

  Scenario: Continuar Itens TODO ao pressionar Enter
    Given o cursor está ao final de um Item TODO
    When o usuário pressiona Enter
    Then uma nova linha é criada já com checkbox vazio
    And o usuário pode digitar a próxima tarefa diretamente
```

### Feature 3: Checkboxes interativos

```gherkin
Feature: Interação direta com checkboxes
  Como usuário do Monet
  Quero clicar nos checkboxes para marcar/desmarcar tarefas
  Para acompanhar o progresso das ações que registrei

  Scenario: Marcar item TODO como concluído
    Given existe um Item TODO desmarcado no editor
    When o usuário clica no checkbox desse item
    Then o checkbox passa a exibir o estado marcado
    And o texto do item recebe estilo visual de tarefa concluída (riscado e cor muted)
    And o estado da nota é persistido imediatamente

  Scenario: Desmarcar item TODO concluído
    Given existe um Item TODO marcado no editor
    When o usuário clica no checkbox desse item
    Then o checkbox passa a exibir o estado desmarcado
    And o texto perde o estilo visual de tarefa concluída
    And o estado da nota é persistido imediatamente

  Scenario: Clicar no checkbox não move o cursor de edição
    Given o usuário está editando uma linha em algum lugar da nota
    When o usuário clica no checkbox de um Item TODO em outra linha
    Then o estado do checkbox é alterado
    And o cursor de edição permanece na linha onde estava antes
```

### Feature 4: Régua de Formatação no editor WYSIWYG

```gherkin
Feature: Régua de Formatação flutuante no editor WYSIWYG
  Como usuário do Monet
  Quero acessar opções de formatação ao selecionar texto
  Para aplicar negrito, itálico, títulos, listas e TODO mantendo o fluxo de escrita

  Scenario: Régua aparece ao selecionar texto
    Given o usuário tem uma nota aberta com texto
    When o usuário seleciona um trecho de texto
    Then a Régua de Formatação aparece próxima à seleção
    And a régua exibe os botões: H1, H2, H3, Negrito, Itálico, Lista, Lista Numerada, TODO

  Scenario: Aplicar negrito via régua em texto simples
    Given o usuário selecionou o trecho "importante" em uma linha
    When o usuário clica no botão "Negrito" na Régua
    Then o trecho selecionado passa a ser exibido em negrito

  Scenario: Remover negrito via régua em texto já formatado
    Given o usuário selecionou um trecho exibido em negrito
    And o botão "Negrito" da Régua aparece com estado ativo
    When o usuário clica no botão "Negrito"
    Then a formatação é removida
    And o trecho volta a ser texto simples

  Scenario: Aplicar Título H1 via régua
    Given o usuário selecionou texto em uma linha simples "Introdução"
    When o usuário clica no botão "H1" na Régua
    Then a linha passa a ser exibida com estilo de Título H1
    And o botão "H1" passa a aparecer com estado ativo

  Scenario: Trocar nível de título via régua
    Given a linha atual está formatada como H2
    And o cursor está na linha
    When o usuário clica no botão "H1" na Régua
    Then a linha passa a ser exibida como H1
    And o botão "H2" deixa de estar ativo

  Scenario: Converter linha em Item TODO via régua
    Given o usuário selecionou a linha "Revisar capítulo 3"
    When o usuário clica no botão "TODO" na Régua
    Then a linha passa a ser exibida como Item TODO com checkbox desmarcado

  Scenario: Régua reflete o estado da formatação atual
    Given o cursor está em uma linha formatada como H2 com trecho selecionado em negrito
    Then o botão "H2" aparece ativo na Régua
    And o botão "Negrito" aparece ativo na Régua
    And os demais botões aparecem inativos

  Scenario: Régua não aparece sem seleção
    Given o usuário clica em um ponto do editor sem arrastar
    Then a Régua de Formatação não é exibida

  Scenario: Régua desaparece ao pressionar Escape
    Given a Régua de Formatação está visível
    When o usuário pressiona a tecla Escape
    Then a Régua é ocultada
```

### Feature 5: Eliminação do modo preview

```gherkin
Feature: Eliminação do modo preview legado
  Como usuário do Monet
  Quero que o editor seja o único modo de visualização da nota
  Para não precisar alternar entre edição e preview

  Scenario: Botão "preview" não existe mais na interface
    Given o usuário tem uma nota aberta no editor WYSIWYG
    Then nenhum botão de "preview" ou "alternar modo" é exibido na interface
    And nenhuma combinação de teclas alterna para um modo de visualização separado

  Scenario: Toda a formatação suportada aparece renderizada no editor
    Given o usuário tem uma nota contendo títulos, listas, negrito, itálico, Itens TODO e links
    When o usuário abre a nota
    Then todos esses elementos aparecem visualmente formatados no editor
    And nenhum elemento exige um modo de visualização separado para ser renderizado
```

### Feature 6: Persistência do conteúdo

```gherkin
Feature: Salvamento e carregamento da nota no editor WYSIWYG
  Como usuário do Monet
  Quero que a nota seja persistida e recarregada sem perda de informação
  Para confiar no que vejo no editor

  Scenario: Fechar e reabrir a nota preserva a formatação
    Given o usuário formatou uma nota com títulos, negrito, listas e Itens TODO
    And a nota foi salva (auto-save)
    When o usuário fecha o aplicativo e reabre essa nota
    Then todos os elementos formatados aparecem exatamente como antes

  Scenario: Estado dos checkboxes é preservado entre sessões
    Given o usuário tem uma nota com Itens TODO marcados e desmarcados
    When o usuário fecha o aplicativo e reabre essa nota
    Then cada checkbox aparece no estado que estava antes (marcado ou desmarcado)

  Scenario: Trocar de nota e voltar preserva o conteúdo
    Given o usuário tem várias notas no caderno
    And está editando a Nota A
    When o usuário seleciona a Nota B
    And volta para a Nota A
    Then a Nota A aparece exatamente como estava (texto, formatação e cursor preservados conforme comportamento atual)
```

---

## Critérios de aceitação

### Renderização WYSIWYG
- [ ] Negrito, itálico, títulos (H1–H3), listas numeradas/não-numeradas e Itens TODO aparecem renderizados em tempo real, sem necessidade de preview
- [ ] Símbolos de marcação (`**`, `*`, `#`, `- `, `[ ]`) não aparecem como texto visível quando o cursor está fora do trecho formatado
- [ ] A renderização não introduz delay perceptível ao usuário (digitação fluida)

### Interação
- [ ] Cliques em checkboxes alteram o estado e disparam save imediato (sem aguardar auto-save)
- [ ] Pressionar Enter dentro de listas continua a lista; pressionar Enter em item vazio encerra a lista
- [ ] A numeração de listas numeradas é recalculada automaticamente quando itens são adicionados, removidos ou reordenados

### Régua de Formatação
- [ ] A Régua aparece em até 200ms após o usuário completar uma seleção
- [ ] Todos os 8 botões do BDD `formatacao-de-texto` continuam disponíveis: H1, H2, H3, Negrito, Itálico, Lista, Lista Numerada, TODO
- [ ] Botões da Régua refletem corretamente o estado da formatação na seleção/cursor atual

### Eliminação do preview
- [ ] Nenhum botão, atalho ou menu permite acessar um modo de visualização separado
- [ ] O componente `MarkdownPreview` deixa de ser acionado pela interface

### Persistência
- [ ] Toda a formatação visível no editor é preservada entre sessões
- [ ] Salvar/carregar uma nota não corrompe títulos, listas, checkboxes nem trechos formatados
- [ ] O estado marcado/desmarcado de cada Item TODO é persistido individualmente

---

## Decisões registradas

| # | Decisão | Resolução |
|---|---|---|
| 1 | **Notas existentes** | O projeto está em fase de testes sem usuários ativos. **Notas antigas podem ser descartadas**. Não é necessário implementar estratégia de migração de conteúdo legado. |
| 2 | **Modo preview** | Será **completamente removido**. O editor WYSIWYG é o único modo de visualização. |
| 3 | **Botões da Régua** | Os mesmos 8 botões da versão atual continuam (ver BDD `formatacao-de-texto`). Nenhum botão novo neste BDD. |
| 4 | **Save imediato em checkbox** | Mantido: clicar no checkbox dispara save imediato, não aguarda auto-save (consistente com BDD `formatacao-de-texto`). |
| 5 | **Escopo deste BDD** | Apenas editor base + formatação inline + checkboxes + régua. /comandos e blocos embed estão nos BDDs `editor-comandos-tiptap` e `editor-blocos-embed-tiptap`. |

---

## Ambiguidades e decisões pendentes

1. **Atalhos de teclado nativos**
   O BDD `formatacao-de-texto` versão 1.1 declara: *"Não haverá atalhos de teclado para formatação — a régua é o único caminho"*. A nova plataforma de edição oferece atalhos como Ctrl+B (negrito), Ctrl+I (itálico) e Ctrl+Shift+1..3 (títulos) prontos.
   **Pergunta:** manter a restrição "só régua" desativando esses atalhos, ou aceitar os atalhos padrão como caminho adicional?

2. **Exibição do markdown bruto sob o cursor**
   Algumas implementações WYSIWYG exibem os símbolos de marcação (`**`, `#`) apenas quando o cursor está dentro do trecho formatado, e os ocultam quando o cursor sai. Outras nunca exibem os símbolos.
   **Pergunta:** o usuário deve ver `**` ao posicionar o cursor dentro de um trecho em negrito, ou os símbolos ficam sempre invisíveis?

3. **Comportamento de colar texto markdown**
   Se o usuário colar texto contendo `**negrito**` vindo de outro aplicativo, esse texto deve ser **interpretado** (aparece em negrito) ou **inserido literalmente** (aparecem os asteriscos)?

4. **Outros elementos de formatação fora do escopo atual**
   Links, código inline, blocos de código, citações (`>`), separadores horizontais (`---`) aparecem no projeto hoje. Eles passam a ser WYSIWYG também ou ficam para um BDD futuro? Este BDD cobre apenas o conjunto já listado nos botões da Régua.
