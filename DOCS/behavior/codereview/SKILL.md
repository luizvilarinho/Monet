---
name: codereview
description: Revisão de código guiada por tarefas. Use esta skill SEMPRE que o usuário pedir para revisar código, encontrar bugs, verificar segurança, checar inconsistências ou quando mencionar "code review", "revisar o código", "olhar o código", "checar bugs" ou similar. Ative também quando o usuário mencionar TASKS.md junto com qualquer arquivo de código.
---

# Code Review

## Objetivo

Fazer uma revisão completa do código do projeto, guiada pelas tarefas passadas pelo coordenador humano, buscando bugs, inconsistências e problemas de segurança.

---

## Passo 1 — Ler o TASKS.md

O Coordenador irá fornecer os arquivos relevantes que vc deve ler para entender o contexto do projeto e as funcionalidades que estão sendo implementadas.

Use o conteúdo para entender:
- Quais funcionalidades estão sendo implementadas
- O escopo atual do projeto
- Tarefas em andamento ou pendentes (contexto para priorizar a revisão)

---

## Passo 2 — Mapear os arquivos relevantes

Liste os arquivos do projeto para entender a estrutura:

```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" \) \
  | grep -v node_modules | grep -v .git | grep -v dist | grep -v build
```

Leia os arquivos mais relevantes para as tarefas identificadas no TASKS.md.

---

## Passo 3 — Revisar o código

Analise cada arquivo relevante procurando os três tipos de problema abaixo.

### 🐛 Bugs
- Lógica incorreta ou incompleta
- Condições de borda não tratadas (null, undefined, lista vazia, etc.)
- Erros de tipagem ou cast incorreto
- Funções assíncronas sem await ou tratamento de erro
- Loops ou recursões que podem causar problemas

### ⚠️ Inconsistências
- Convenções de nomenclatura misturadas
- Funções que fazem coisas diferentes do que o nome sugere
- Duplicação de lógica que deveria ser centralizada
- Partes do código que contradizem o que está descrito no TASKS.md
- Imports não utilizados ou dependências circulares

### 🔒 Segurança
- Dados sensíveis expostos (tokens, senhas, chaves de API em código ou logs)
- Falta de validação de inputs do usuário
- SQL/NoSQL injection, XSS, ou CSRF
- Autenticação ou autorização frágil
- Dependências com vulnerabilidades conhecidas

---

## Passo 4 — OUTPUT em Formato de relatório markdown
- faça um relatório contendo os problemas encontrados e grave no path /AI/historico/codereview
- O relatório deve ser escrito em linguagem clara e simples para ser entendido facilmente pelo coordenador.

Apresente os problemas encontrados neste formato:

---

### 🐛 Bugs

**`arquivo.ts`, linha X** — Descrição curta do problema  
> Explicação do impacto e sugestão de correção.

---

### ⚠️ Inconsistências

**`arquivo.ts`, linha X** — Descrição curta  
> Explicação.

---

### 🔒 Segurança

**`arquivo.ts`, linha X** — Descrição curta  
> Explicação do risco e como mitigar.

---

Se não houver problemas em alguma categoria, escreva: _Nenhum problema encontrado nesta categoria._

Finalize com um resumo de **quantos problemas** foram encontrados por categoria e uma avaliação geral do estado do código (🟢 bom / 🟡 atenção / 🔴 crítico).