# BDD — Inserir Resposta da IA na Nota

## Contexto do produto
Ao executar um `/comando`, a resposta da IA aparece no painel direito (coluna IA).
O usuário pode querer incorporar essa resposta no corpo da nota — como um resumo,
uma tabela gerada, ou qualquer trecho relevante. A inserção acontece logo abaixo
da linha do comando que a gerou, dentro de um bloco toggle colapsável.

---

## Feature: Botão "Inserir" no slash command

### Cenário 1 — Inserir resposta na nota (caminho feliz)

**Dado** que um `/comando` foi executado e sua resposta aparece no painel IA  
**E** o bloco ainda não foi inserido na nota  
**Quando** o usuário clica no botão `↓ inserir` na linha do comando  
**Então** um bloco toggle é criado imediatamente abaixo da linha do comando no editor  
**E** o toggle começa colapsado, exibindo apenas o título (ex: "Resumo gerado pela IA")  
**E** o botão `↓ inserir` é substituído pelo botão `↑ remover` na linha do comando  
**E** o conteúdo dentro do toggle é idêntico à resposta exibida no painel IA  

---

### Cenário 2 — Remover bloco inserido (sem deletar o comando)

**Dado** que um bloco toggle já foi inserido na nota  
**Quando** o usuário clica no botão `↑ remover` na linha do comando  
**Então** o bloco toggle é removido do editor  
**E** o botão volta ao estado `↓ inserir`  
**E** a resposta no painel IA permanece intacta  

---

### Cenário 3 — Deletar o comando com bloco inserido

**Dado** que um bloco toggle já foi inserido na nota  
**Quando** o usuário clica no `×` (delete) na linha do comando  
**Então** a linha do comando é removida do editor  
**E** o bloco toggle inserido logo abaixo também é removido  
**E** o bloco correspondente no painel IA também é removido  
**E** nenhum resíduo do comando ou do bloco permanece na nota  

---

### Cenário 4 — Deletar o comando sem bloco inserido

**Dado** que o usuário nunca clicou em `↓ inserir`  
**Quando** o usuário clica no `×` na linha do comando  
**Então** a linha do comando é removida do editor  
**E** o bloco correspondente no painel IA é removido  
**E** nenhuma outra alteração ocorre na nota  

---

### Cenário 5 — Expandir e colapsar o toggle no editor

**Dado** que um bloco toggle foi inserido na nota  
**Quando** o usuário clica no toggle colapsado  
**Então** o conteúdo da resposta é exibido abaixo do título  
**Quando** o usuário clica novamente  
**Então** o conteúdo é ocultado e apenas o título permanece visível  

---

### Cenário 6 — Comportamento do toggle no modo preview

**Dado** que a nota está em modo preview  
**E** há um ou mais blocos toggle inseridos  
**Quando** o preview é ativado  
**Então** todos os toggles são exibidos expandidos por padrão  
**E** o usuário pode colapsar individualmente se quiser  
**E** os slash commands não aparecem no preview (comportamento já existente)  

---

## Layout da linha do comando

```
Estado inicial (resposta gerada, não inserida):
  /resumir  [↓ inserir]  [×]    concluído

Estado após inserção:
  /resumir  [↑ remover]  [×]    concluído
  ▶ Resumo gerado pela IA         ← toggle colapsado

Toggle expandido:
  /resumir  [↑ remover]  [×]    concluído
  ▼ Resumo gerado pela IA
    Kimi K 2.5: destaque em frontend...
    GLM-5.1: overthinking mas entrega resultados...
    Minimax 2.7: surpreende pelo tamanho...
```

---

## Regras de negócio

- O botão `↓ inserir` só aparece quando o comando está com status `concluído`
- Comandos com status `pendente` ou `erro` não exibem o botão inserir
- O título do toggle é gerado a partir do comando (ex: `/resumir` → "Resumo gerado pela IA", `/tabela` → "Tabela gerada pela IA")
- O `×` sempre remove o comando + painel IA + toggle (se existir) — sem confirmação adicional
- Um mesmo comando não pode gerar dois toggles inseridos (o botão some após inserção)