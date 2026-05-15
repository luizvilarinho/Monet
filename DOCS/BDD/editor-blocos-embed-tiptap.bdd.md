# BDD — Blocos de Resposta IA Embutidos no Editor WYSIWYG (Migração para TipTap)

**Produto:** Monet
**Domínio:** Editor de Anotações
**Versão:** 1.0
**Data:** 2026-05-15

---

## Contexto do produto

Quando o usuário executa um `/comando`, a resposta da IA aparece no Painel IA.
Por meio do botão `↓ inserir`, o usuário pode incorporar essa resposta na nota
como um **bloco toggle colapsável**, posicionado logo abaixo da linha do
`/comando`. Esse comportamento está descrito no BDD
`inserir-resposta-na-nota.bdd.md`.

Este BDD descreve **o que precisa permanecer válido após a migração do editor
para WYSIWYG**, e adapta os comportamentos específicos do **Bloco Embed** ao
novo motor de edição. O Bloco Embed é o ponto identificado como **risco
crítico** pela análise de impacto do explorer
(`DOCS/explorer/explorer20260515.md`).

---

## Glossário do domínio

| Termo | Definição |
|---|---|
| **Editor WYSIWYG** | Editor de notas no novo modo, com renderização inline de markdown (ver `editor-wysiwyg-tiptap.bdd.md`) |
| **Linha de /comando** | Linha do editor onde o `/comando` foi digitado e executado (ver `editor-comandos-tiptap.bdd.md`) |
| **Painel IA** | Coluna lateral onde a resposta da IA é exibida como card |
| **Card de resposta** | Unidade visual do Painel IA que representa a resposta da IA para um `/comando` |
| **Bloco Embed** | Elemento visual inserido no editor logo abaixo da linha do `/comando`, contendo a resposta da IA em formato toggle (expandido/colapsado) |
| **Estado colapsado** | Bloco Embed exibindo apenas o título (ex: "Resumo gerado pela IA") |
| **Estado expandido** | Bloco Embed exibindo o título + o conteúdo completo da resposta |
| **Botão `↓ inserir`** | Botão na linha do /comando que cria o Bloco Embed correspondente |
| **Botão `↑ remover`** | Botão na linha do /comando que remove o Bloco Embed existente, mantendo a linha do /comando |
| **Botão `×`** | Botão na linha do /comando que remove a linha + o Bloco Embed (se existir) + o card no Painel IA |
| **Vínculo /comando ↔ Bloco Embed** | Relação que garante que cada Bloco Embed pertence a uma linha de /comando específica e sobrevive a recarregamentos da nota |

---

## Histórias de usuário

### HU-01 — Inserir resposta da IA na nota
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** incorporar a resposta da IA na nota como um bloco colapsável
**Para** manter o resultado relevante junto ao /comando que o gerou, organizado e ocultável

### HU-02 — Editar a nota ao redor do bloco
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** continuar digitando texto, listas, títulos antes ou depois do Bloco Embed
**Para** complementar a resposta da IA com minhas próprias anotações

### HU-03 — Expandir/colapsar para focar na nota
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** colapsar Blocos Embed que já li
**Para** manter a nota visualmente limpa enquanto continuo estudando

### HU-04 — Persistir o conteúdo entre sessões
**Prioridade:** Alta

**Como** usuário do Monet
**Quero** que os Blocos Embed sobrevivam ao fechar e reabrir a nota
**Para** não perder o resultado consolidado dos /comandos executados

---

## Cenários BDD

### Feature 1: Inserir Bloco Embed a partir do Painel IA

```gherkin
Feature: Inserir Bloco Embed na nota a partir do Painel IA
  Como usuário do Monet
  Quero inserir a resposta da IA logo abaixo do /comando no editor
  Para consolidar o resultado dentro da nota

  Scenario: Inserir Bloco Embed (caminho feliz)
    Given um /comando "/resumir" foi executado e sua resposta aparece no Painel IA
    And o Bloco Embed ainda não foi inserido
    When o usuário clica no botão "↓ inserir" na linha do /comando
    Then um Bloco Embed é criado imediatamente abaixo da linha do /comando no editor
    And o Bloco Embed inicia no estado colapsado, exibindo apenas o título (ex: "Resumo gerado pela IA")
    And o botão "↓ inserir" na linha do /comando é substituído por "↑ remover"
    And o conteúdo do Bloco Embed, quando expandido, é idêntico à resposta exibida no Painel IA

  Scenario: Botão "↓ inserir" não aparece em respostas em streaming
    Given um /comando está sendo executado e a resposta da IA está em streaming
    When o usuário visualiza a linha desse /comando
    Then o botão "↓ inserir" NÃO está visível
    And o botão volta a aparecer somente quando o status da resposta passar para concluído

  Scenario: Botão "↓ inserir" não aparece em respostas com erro
    Given um /comando resultou em erro
    Then o botão "↓ inserir" NÃO aparece na linha desse /comando

  Scenario: Botão "↓ inserir" não aparece em respostas interrompidas
    Given a geração da resposta foi interrompida pelo usuário
    Then o botão "↓ inserir" NÃO aparece na linha desse /comando

  Scenario: Um mesmo /comando não pode gerar dois Blocos Embed
    Given um Bloco Embed já foi inserido para a linha "/resumir"
    Then o botão "↓ inserir" não está mais disponível para essa linha
    And o botão visível é "↑ remover"
```

### Feature 2: Expandir e colapsar Bloco Embed

```gherkin
Feature: Expandir e colapsar Bloco Embed
  Como usuário do Monet
  Quero alternar entre ver/ocultar o conteúdo do Bloco Embed
  Para manter o editor visualmente limpo quando já li a resposta

  Scenario: Expandir Bloco Embed colapsado
    Given existe um Bloco Embed no estado colapsado
    When o usuário clica no título do Bloco Embed (ou no ícone de toggle)
    Then o conteúdo da resposta é exibido abaixo do título
    And o Bloco Embed passa ao estado expandido

  Scenario: Colapsar Bloco Embed expandido
    Given existe um Bloco Embed no estado expandido
    When o usuário clica no título do Bloco Embed (ou no ícone de toggle)
    Then o conteúdo é ocultado e apenas o título permanece visível
    And o Bloco Embed passa ao estado colapsado

  Scenario: Estado expandido/colapsado é independente entre Blocos Embed
    Given existem múltiplos Blocos Embed na nota
    When o usuário expande um deles
    Then os demais permanecem no estado em que estavam (expandido ou colapsado)
```

### Feature 3: Remover Bloco Embed e/ou linha de /comando

```gherkin
Feature: Remoção de Blocos Embed e linhas de /comando
  Como usuário do Monet
  Quero remover Blocos Embed ou /comandos com clareza sobre o efeito
  Para limpar a nota sem surpresas

  Scenario: Remover Bloco Embed sem remover o /comando
    Given existe um Bloco Embed inserido para a linha "/resumir"
    When o usuário clica no botão "↑ remover" na linha do /comando
    Then o Bloco Embed é removido do editor
    And o botão volta para o estado "↓ inserir"
    And a linha do /comando permanece no editor com sua marcação de executado
    And o card de resposta no Painel IA permanece intacto

  Scenario: Remover linha de /comando com Bloco Embed inserido (botão ×)
    Given existe um Bloco Embed inserido logo abaixo da linha do /comando
    When o usuário clica no botão "×" na linha do /comando
    Then a linha do /comando é removida do editor
    And o Bloco Embed logo abaixo também é removido
    And o card de resposta no Painel IA é removido
    And nenhum resíduo do /comando ou do Bloco Embed permanece na nota

  Scenario: Remover linha de /comando sem Bloco Embed inserido (botão ×)
    Given o usuário nunca clicou em "↓ inserir" para essa linha
    When o usuário clica no botão "×" na linha do /comando
    Then a linha do /comando é removida do editor
    And o card de resposta no Painel IA é removido
    And nenhuma outra alteração ocorre na nota
```

### Feature 4: Edição da nota ao redor do Bloco Embed

```gherkin
Feature: Edição da nota com Blocos Embed presentes
  Como usuário do Monet
  Quero continuar editando texto comum acima, abaixo e entre Blocos Embed
  Para complementar as respostas da IA com minhas próprias anotações

  Scenario: Digitar texto abaixo do Bloco Embed
    Given existe um Bloco Embed na nota
    And o cursor está em uma linha vazia logo abaixo do Bloco Embed
    When o usuário digita texto
    Then o texto é inserido como conteúdo normal, fora do Bloco Embed
    And o Bloco Embed não é alterado

  Scenario: Pressionar Enter logo abaixo do Bloco Embed
    Given o cursor está imediatamente após o final do Bloco Embed
    When o usuário pressiona Enter e digita
    Then uma nova linha de texto comum é criada
    And o conteúdo digitado não entra dentro do Bloco Embed

  Scenario: Apagar com Backspace na linha imediatamente após o Bloco Embed
    Given o cursor está no início de uma linha vazia logo abaixo do Bloco Embed
    When o usuário pressiona Backspace
    Then o cursor se move para o final do Bloco Embed (ou para a linha imediatamente anterior, conforme comportamento padrão de Backspace)
    And o Bloco Embed NÃO é apagado por essa ação

  Scenario: Bloco Embed não pode ser editado diretamente como texto
    Given existe um Bloco Embed expandido
    When o usuário tenta posicionar o cursor dentro do conteúdo do Bloco Embed e digitar
    Then o conteúdo do Bloco Embed permanece imutável
    And nenhum caractere é inserido no conteúdo da resposta

  Scenario: Selecionar texto que inclui um Bloco Embed
    Given o usuário tem texto antes e depois de um Bloco Embed
    When o usuário seleciona um trecho que abrange o Bloco Embed inteiro
    Then a Régua de Formatação não exibe ações que se aplicariam ao Bloco Embed
    And ações aplicáveis (ex: copiar a seleção) tratam o Bloco Embed como uma unidade indivisível
```

### Feature 5: Persistência dos Blocos Embed

```gherkin
Feature: Persistência dos Blocos Embed entre sessões
  Como usuário do Monet
  Quero que Blocos Embed sobrevivam ao fechar e reabrir a nota
  Para não perder o resultado consolidado dos /comandos

  Scenario: Bloco Embed é preservado ao fechar e reabrir a nota
    Given uma nota contém uma linha de /comando executado e um Bloco Embed inserido
    When o usuário fecha o aplicativo e reabre a nota
    Then a linha do /comando aparece com a marcação de executado
    And o Bloco Embed aparece logo abaixo, com o mesmo conteúdo de antes
    And o card de resposta correspondente continua disponível no Painel IA

  Scenario: Estado expandido/colapsado é preservado entre sessões
    Given um Bloco Embed estava no estado colapsado quando a nota foi fechada
    When o usuário reabre a nota
    Then o Bloco Embed aparece no estado colapsado

  Scenario: Trocar de nota e voltar preserva os Blocos Embed
    Given a Nota A tem múltiplos Blocos Embed
    When o usuário seleciona a Nota B
    And volta para a Nota A
    Then todos os Blocos Embed da Nota A aparecem no estado correto

  Scenario: Vínculo /comando ↔ Bloco Embed sobrevive a recarregamento
    Given uma nota tem um /comando executado com Bloco Embed inserido
    When a nota é recarregada
    Then a linha do /comando exibe o botão "↑ remover" (não "↓ inserir")
    And clicar em "↑ remover" remove corretamente o Bloco Embed associado
```

### Feature 6: Múltiplos Blocos Embed na mesma nota

```gherkin
Feature: Múltiplos Blocos Embed em uma nota
  Como usuário do Monet
  Quero ter vários /comandos com Blocos Embed na mesma nota
  Para consolidar diferentes resultados da IA em uma única anotação

  Scenario: Inserir múltiplos Blocos Embed
    Given a nota contém dois /comandos executados
    When o usuário clica em "↓ inserir" em cada um deles
    Then dois Blocos Embed distintos são criados, cada um abaixo de seu /comando
    And cada Bloco Embed exibe o conteúdo do seu próprio /comando

  Scenario: Remover um Bloco Embed não afeta os outros
    Given a nota tem três Blocos Embed
    When o usuário clica em "↑ remover" no segundo deles
    Then apenas o segundo Bloco Embed é removido
    And os demais permanecem intactos com seus estados de expansão preservados

  Scenario: Ordem dos Blocos Embed segue a ordem dos /comandos no editor
    Given a nota tem /comandos em diferentes posições
    Then cada Bloco Embed aparece logo abaixo do /comando correspondente
    And reordenar texto não afeta o vínculo entre cada /comando e seu Bloco Embed
```

---

## Critérios de aceitação

### Inserção
- [ ] Botão `↓ inserir` aparece apenas em /comandos com status concluído
- [ ] Botões `↓ inserir` / `↑ remover` / `×` permanecem na linha do /comando no novo editor (mesmo lugar, mesma semântica)
- [ ] Bloco Embed é criado **imediatamente abaixo** da linha do /comando
- [ ] Bloco Embed inicia colapsado
- [ ] Após inserção, botão muda para `↑ remover`

### Estado expandido/colapsado
- [ ] Clique no título alterna entre expandido e colapsado
- [ ] Estado expandido/colapsado é independente entre Blocos Embed
- [ ] Estado é persistido entre sessões

### Remoção
- [ ] `↑ remover` remove apenas o Bloco Embed, mantendo /comando + card IA
- [ ] `×` remove linha do /comando + Bloco Embed (se existir) + card IA, sem confirmação
- [ ] Remoção é instantânea, sem resíduos visuais ou de dados

### Edição
- [ ] Bloco Embed é **atômico**: usuário não consegue alterar o conteúdo da resposta dentro do bloco
- [ ] Bloco Embed comporta-se como unidade indivisível na seleção, cópia e deleção
- [ ] Backspace logo após o bloco NÃO apaga o bloco em um único toque (requer interação explícita via botão `↑ remover` ou `×`)
- [ ] Edição de texto ao redor do Bloco Embed (acima e abaixo) funciona como em qualquer outra parte da nota

### Persistência
- [ ] Conteúdo do Bloco Embed sobrevive ao fechar/reabrir o app
- [ ] Estado expandido/colapsado sobrevive ao fechar/reabrir o app
- [ ] Vínculo /comando ↔ Bloco Embed é restabelecido corretamente ao recarregar a nota
- [ ] Múltiplos Blocos Embed em uma mesma nota não interferem entre si

---

## Decisões registradas

| # | Decisão | Resolução |
|---|---|---|
| 1 | **Notas existentes** | Não é necessário preservar notas antigas: o projeto está em fase de testes sem usuários ativos. **Blocos Embed armazenados em formato legado podem ser descartados.** |
| 2 | **Bloco Embed é atômico** | O conteúdo do Bloco Embed não é editável pelo usuário. Quem quiser modificar usa `↑ remover` e digita por conta própria. |
| 3 | **Botões mantidos** | Os três botões `↓ inserir`, `↑ remover`, `×` mantêm exatamente a mesma semântica do BDD `inserir-resposta-na-nota.bdd.md`. |
| 4 | **Posição** | Bloco Embed sempre aparece logo abaixo da linha do /comando. |
| 5 | **Múltiplos blocos** | Permitido. Cada /comando gera no máximo um Bloco Embed. |

---

## Ambiguidades e decisões pendentes

1. **Formato de armazenamento da nota**
   A análise de impacto sugere manter armazenamento em **markdown** com marcadores HTML para os Blocos Embed. Como notas antigas podem ser descartadas, há liberdade para escolher um formato diferente (ex: JSON nativo do motor de edição). Decidir antes de implementar — afeta exportação, busca textual e integração com /comandos como `/resumir` que consomem o conteúdo da nota.

2. **Conteúdo dentro do Bloco Embed quando colapsado**
   Quando o Bloco Embed está colapsado, o conteúdo está oculto visualmente. Esse conteúdo deve continuar sendo considerado parte da nota para fins de:
   - Busca textual dentro da nota?
   - Contexto de /comandos como `/resumir` que consomem o conteúdo da nota atual?
   - Exportação para outros formatos?
   Decidir o comportamento explicitamente.

3. **Copiar/colar de Bloco Embed**
   Se o usuário copiar uma seleção contendo um Bloco Embed, o que vai para o clipboard?
   - O texto bruto da resposta (sem formatação de bloco)?
   - Uma representação serializável que recrie o bloco se colada em outro Monet?
   - Nada (apenas o texto fora do bloco)?

4. **Vínculo após edição manual da linha do /comando**
   Se o usuário editar a linha do `/comando` após a inserção (ex: muda `/resumir` para `/explicar X`), o que acontece com o Bloco Embed existente? Permanece associado? É removido automaticamente? Hoje (CM6) o vínculo é por ID HTML — o novo editor precisa de regra equivalente.

5. **Bloco Embed em modo apenas-leitura**
   Existem cenários futuros (compartilhar nota, exportar) em que a nota é exibida em modo somente-leitura. Nesse caso o Bloco Embed deve continuar expansível/colapsável? Marcar como fora de escopo ou cobrir aqui?
