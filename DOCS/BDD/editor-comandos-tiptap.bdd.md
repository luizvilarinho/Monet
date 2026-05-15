# BDD — /Comandos no Editor WYSIWYG (Migração para TipTap)

**Produto:** Monet
**Domínio:** Editor de Anotações
**Versão:** 1.0
**Data:** 2026-05-15

---

## Contexto do produto

O Monet permite que o usuário acione a IA digitando `/comandos` (ex: `/resumir`,
`/explicar`, `/pesquisa`) diretamente em uma linha do editor. Esse comportamento
já está descrito em detalhes no BDD `sistema-de-comandos.bdd.md`.

Este BDD descreve **o que precisa permanecer válido após a migração do editor
para o modo WYSIWYG**. O foco é garantir que a experiência do usuário com
`/comandos` (detecção, autocomplete, execução, marcações visuais) não regrida
ao trocar o motor de edição.

Para detalhes funcionais de cada `/comando` em si (intenção, prompts, painel
IA, streaming), o BDD `sistema-de-comandos` continua sendo a fonte de verdade.
Este BDD foca apenas nas adaptações ao novo editor.

---

## Glossário do domínio

| Termo | Definição |
|---|---|
| **Editor WYSIWYG** | Editor de notas no novo modo, com renderização inline de markdown (ver `editor-wysiwyg-tiptap.bdd.md`) |
| **Linha de comando** | Linha do editor cujo conteúdo, isolado, começa com `/` e representa intenção de acionar a IA |
| **Linha isolada** | Linha do editor cujo conteúdo inteiro corresponde ao `/comando` digitado, sem texto adicional |
| **/comando válido** | Texto que começa com `/` e cujo nome corresponde a um dos comandos suportados pelo sistema |
| **/comando inválido** | Texto iniciado por `/` cujo nome não corresponde a nenhum comando suportado |
| **/comando incompleto** | `/comando` reconhecido mas sem o argumento/termo obrigatório |
| **Autocomplete de comandos** | Lista de sugestões exibida enquanto o usuário digita após `/` |
| **Marcação visual de comando executado** | Estilo aplicado à linha do `/comando` após sua execução (cor de comando concluído) |
| **Marcação visual de comando inválido/incompleto** | Estilo aplicado à linha com `/comando` que não é executável (cor vermelha) |
| **Painel IA** | Área lateral onde a resposta gerada por um `/comando` é exibida |
| **Comandos suportados** | `/pesquisa`, `/quem`, `/definir`, `/resumir`, `/opiniao`, `/tabela`, `/aprofundar`, `/explicar`, `/guia`, `/mapa-mental`, `/perguntar` |

---

## Histórias de usuário

### HU-01 — Continuar usando /comandos no editor WYSIWYG
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** que `/comandos` continuem sendo detectados, autocompletados e executados no novo editor
**Para** não perder a fluência de acionar a IA sem sair do fluxo de escrita

### HU-02 — Ver marcação visual coerente
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** que linhas com `/comandos` continuem com indicação visual de status (executado, inválido, incompleto)
**Para** identificar rapidamente o resultado de cada comando

### HU-03 — Receber autocomplete adequado ao novo editor
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** que o autocomplete dos `/comandos` apareça naturalmente no novo editor
**Para** descobrir comandos sem precisar lembrar o nome exato

---

## Cenários BDD

### Feature 1: Detecção de /comandos no Editor WYSIWYG

```gherkin
Feature: Detecção de /comandos no Editor WYSIWYG
  Como usuário do Monet
  Quero que o editor reconheça linhas iniciadas por / como /comandos
  Para acionar a IA sem sair do fluxo de escrita

  Scenario: Reconhecer /comando em linha isolada
    Given o usuário está editando uma nota no Editor WYSIWYG
    When o usuário digita "/resumir" em uma linha vazia
    Then o editor reconhece essa linha como linha de comando em potencial
    And a linha recebe marcação visual diferenciada (sinalizando intenção de /comando)

  Scenario: Não reconhecer / no meio de um parágrafo
    Given o usuário está editando um parágrafo com texto
    When o usuário digita "/teste" após outras palavras na mesma linha
    Then o editor NÃO trata esse texto como linha de comando
    And nenhuma marcação visual de /comando é aplicada

  Scenario: Não reconhecer linha que não começa com /
    Given o usuário está editando uma nota
    When o usuário digita uma linha que começa com texto comum
    Then o editor NÃO trata essa linha como linha de comando

  Scenario: Reconhecer /comando após apagar e redigitar
    Given uma linha contém o texto "abc"
    When o usuário apaga o conteúdo da linha
    And digita "/explicar" em seguida
    Then o editor reconhece a linha como linha de comando
```

### Feature 2: Autocomplete de /comandos

```gherkin
Feature: Autocomplete de /comandos no Editor WYSIWYG
  Como usuário do Monet
  Quero ver autocomplete ao digitar / em uma linha
  Para descobrir e acionar /comandos sem decorar nomes

  Scenario: Exibir autocomplete ao iniciar /comando
    Given o usuário está editando uma nota
    When o usuário digita "/" em uma linha vazia
    Then o autocomplete é exibido próximo à posição do cursor
    And a lista contém /pesquisa, /quem, /definir, /resumir, /opiniao, /tabela, /aprofundar, /explicar, /guia, /mapa-mental e /perguntar

  Scenario: Filtrar autocomplete conforme digitação
    Given o autocomplete está visível
    When o usuário continua digitando após o "/"
    Then a lista de sugestões é filtrada de acordo com o texto digitado
    And apenas comandos cujo nome corresponde ao filtro permanecem visíveis

  Scenario: Aceitar sugestão com Tab
    Given o autocomplete está visível
    And existe uma sugestão selecionada
    When o usuário pressiona Tab
    Then a sugestão selecionada substitui o texto parcial na linha
    And a linha do editor passa a conter o /comando completo
    And o autocomplete é ocultado

  Scenario: Aceitar sugestão com Enter (apenas quando autocomplete está visível)
    Given o autocomplete está visível com sugestões filtradas
    And existe uma sugestão selecionada
    When o usuário pressiona Enter
    Then a sugestão selecionada substitui o texto parcial
    And o autocomplete é ocultado
    And a tecla Enter NÃO executa o /comando neste momento

  Scenario: Navegar entre sugestões com setas
    Given o autocomplete está visível com múltiplas sugestões
    When o usuário pressiona seta para baixo
    Then a próxima sugestão na lista é destacada
    When o usuário pressiona seta para cima
    Then a sugestão anterior é destacada

  Scenario: Fechar autocomplete com Escape
    Given o autocomplete está visível
    When o usuário pressiona Escape
    Then o autocomplete é ocultado
    And o texto digitado pelo usuário permanece na linha sem alteração

  Scenario: Fechar autocomplete ao perder foco da linha
    Given o autocomplete está visível
    When o usuário clica em outra linha ou fora do editor
    Then o autocomplete é ocultado

  Scenario: Não exibir autocomplete para / no meio de um parágrafo
    Given o usuário está digitando em uma linha que já tem texto
    When o usuário digita "/" após uma palavra na mesma linha
    Then o autocomplete NÃO é exibido
```

### Feature 3: Execução de /comandos

```gherkin
Feature: Execução de /comandos no Editor WYSIWYG
  Como usuário do Monet
  Quero executar um /comando ao pressionar Enter
  Para acionar a IA sem depender de controles externos

  Scenario: Executar /comando válido ao pressionar Enter
    Given o usuário digitou "/resumir" em uma linha isolada
    And o autocomplete está fechado
    When o usuário pressiona Enter
    Then o sistema inicia uma solicitação para a IA usando o /comando informado na nota atual
    And a resposta é enviada para exibição no Painel IA da nota atual
    And uma nova linha é criada abaixo da linha do /comando
    And o cursor é movido para a nova linha
    And a linha do /comando permanece visível com marcação visual de comando executado

  Scenario: Executar /comando com termo complementar
    Given o usuário digitou "/pesquisa Rust" em uma linha isolada
    And o autocomplete está fechado
    When o usuário pressiona Enter
    Then o sistema inicia uma solicitação para a IA usando o /comando informado com o termo "Rust"
    And a resposta é exibida no Painel IA da nota atual

  Scenario: Não executar /comando inválido
    Given o usuário digitou "/inexistente" em uma linha isolada
    When o usuário pressiona Enter
    Then o sistema NÃO inicia nenhuma solicitação para a IA
    And a linha recebe marcação visual de comando inválido (cor vermelha)
    And uma nova linha é criada abaixo (comportamento padrão de Enter)

  Scenario: Não executar /comando incompleto
    Given o usuário digitou "/pesquisa" em uma linha isolada (sem o termo obrigatório)
    When o usuário pressiona Enter
    Then o sistema NÃO inicia nenhuma solicitação para a IA
    And a linha recebe marcação visual de comando incompleto (cor vermelha)

  Scenario: Não executar /comando se a linha não estiver isolada
    Given a linha contém "texto antes /resumir texto depois"
    When o usuário pressiona Enter ao final da linha
    Then o sistema NÃO inicia nenhuma solicitação para a IA
    And a linha não recebe marcação visual de comando
```

### Feature 4: Marcação visual nas linhas de /comando

```gherkin
Feature: Marcação visual das linhas de /comando
  Como usuário do Monet
  Quero ver o status de cada /comando refletido visualmente na linha
  Para identificar rapidamente quais foram executados, inválidos ou incompletos

  Scenario: Marcação inicial (em digitação)
    Given o usuário está digitando "/resumir" em uma linha isolada
    Then a linha recebe marcação visual indicando que é uma linha de /comando reconhecido
    And o estilo é distinto de texto comum

  Scenario: Marcação após execução de /comando válido
    Given o usuário executou "/resumir" com Enter
    Then a linha do /comando passa a ter marcação visual de comando executado
    And essa marcação persiste até que o usuário apague ou modifique a linha

  Scenario: Marcação de /comando inválido
    Given o usuário pressionou Enter em uma linha com /comando inválido
    Then a linha recebe marcação visual de comando inválido em cor vermelha
    And essa marcação persiste até que a linha seja editada

  Scenario: Marcação de /comando incompleto
    Given o usuário pressionou Enter em uma linha com /comando que exige termo, sem o termo
    Then a linha recebe marcação visual de comando incompleto em cor vermelha

  Scenario: Marcação some ao apagar a linha
    Given a linha tem marcação visual de /comando (executado, inválido ou incompleto)
    When o usuário apaga o conteúdo da linha
    Then a marcação é removida
```

### Feature 5: Persistência do estado de /comandos

```gherkin
Feature: Persistência das linhas de /comando entre sessões
  Como usuário do Monet
  Quero que linhas de /comando executado permaneçam marcadas após fechar e reabrir
  Para reconhecer o histórico de /comandos da nota

  Scenario: Linha de /comando executado é preservada ao reabrir a nota
    Given uma nota contém uma linha "/resumir" com status executado
    When o usuário fecha o aplicativo e reabre essa nota
    Then a linha "/resumir" continua exibida com marcação de comando executado
    And o card de resposta correspondente continua disponível no Painel IA da nota

  Scenario: Trocar de nota com /comando em execução
    Given uma resposta de /comando está sendo gerada em streaming na Nota A
    When o usuário seleciona a Nota B
    Then o streaming da Nota A é interrompido (conforme `sistema-de-comandos.bdd.md`)
    And o Painel IA passa a exibir apenas o contexto da Nota B
```

---

## Critérios de aceitação

### Detecção
- [ ] `/comando` é reconhecido apenas em linhas isoladas (todo o conteúdo da linha é o `/comando`)
- [ ] Texto iniciado por `/` no meio de um parágrafo NÃO é tratado como /comando
- [ ] A detecção opera em tempo real durante a digitação, sem delay perceptível

### Autocomplete
- [ ] Autocomplete aparece ao digitar `/` em linha isolada e oferece todos os 11 comandos suportados
- [ ] A lista é filtrada conforme o usuário continua digitando
- [ ] Tab aceita a sugestão selecionada e substitui o texto da linha
- [ ] Enter, **quando o autocomplete está visível**, também aceita a sugestão e NÃO dispara execução do /comando
- [ ] Setas para cima/baixo navegam pelas sugestões
- [ ] Escape fecha o autocomplete preservando o texto já digitado

### Execução
- [ ] Enter em /comando válido inicia solicitação à IA e move cursor para a próxima linha
- [ ] Enter em /comando inválido NÃO inicia solicitação; aplica marcação vermelha
- [ ] Enter em /comando incompleto NÃO inicia solicitação; aplica marcação vermelha
- [ ] Linha permanece visível após execução com marcação de comando executado

### Marcação visual
- [ ] As três marcações coexistem visualmente: linha de comando (em digitação), comando executado, comando inválido/incompleto
- [ ] As cores são consistentes com o BDD `sistema-de-comandos.bdd.md`
- [ ] Apagar a linha remove a marcação imediatamente

### Persistência
- [ ] Status de /comando executado é preservado ao fechar/reabrir a nota
- [ ] Cards de resposta no Painel IA permanecem associados aos `/comandos` originais

---

## Decisões registradas

| # | Decisão | Resolução |
|---|---|---|
| 1 | **Fonte de verdade funcional** | O comportamento dos /comandos em si (intenção, prompts, painel IA, streaming) continua governado pelo BDD `sistema-de-comandos.bdd.md`. Este BDD trata apenas das adaptações ao novo editor. |
| 2 | **Lista de comandos** | Sem mudanças. Os 11 comandos atuais são preservados. |
| 3 | **Tab e Enter no autocomplete** | Quando o autocomplete está visível, ambos aceitam a sugestão. A execução do /comando exige Enter **com autocomplete fechado**. |
| 4 | **commandParser.ts** | Pode ser reutilizado conforme indicado na análise do explorer (funções puras, sem dependência do motor de edição atual). |

---

## Ambiguidades e decisões pendentes

1. **Comportamento de Tab versus Enter no autocomplete**
   No editor atual, Tab aceita a sugestão. Devemos manter Enter também como atalho de aceite quando o autocomplete está visível? A descrição acima assume **sim**, mas isso pode ser inconsistente com a expectativa de "Enter executa".

2. **Posicionamento do autocomplete**
   O autocomplete deve aparecer **abaixo** da linha do cursor (como hoje), ou flutuar de forma mais próxima ao cursor (popover ancorado no `/`)? Em telas pequenas, isso pode mudar a usabilidade.

3. **Recuperação de /comando deletado**
   Se o usuário apagar acidentalmente uma linha de `/comando` executado, o card no Painel IA deve ser removido junto (comportamento atual) ou apenas perder o vínculo? Decidir se o BDD precisa cobrir esse cenário explicitamente.

4. **Atalho para reabrir autocomplete**
   Se o usuário fechou o autocomplete com Escape e quer reabri-lo sem apagar o `/`, existe atalho? Hoje a única forma é apagar e redigitar.
