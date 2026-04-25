---
name: securityreview
description: >
  Revisão geral de código com foco em performance, segurança, boas práticas e organização.
  Use esta skill SEMPRE que o usuário pedir para revisar, auditar, analisar ou dar feedback
  sobre um trecho de código — independente da linguagem (JavaScript, TypeScript, Java, Python,
  etc.). Ative também quando o usuário disser "o que você acha desse código?", "tem algo errado
  aqui?", "pode melhorar isso?", "revisa pra mim", "securityreview", ou quando colar um bloco de
  código sem instrução explícita esperando avaliação. Se há código no contexto e o usuário quer
  uma opinião sobre ele, esta skill deve ser ativada.
---

# Code Review Skill

Revisão estruturada de código com quatro eixos de análise: **Performance**, **Segurança**,
**Boas Práticas** e **Organização**. O objetivo é entregar feedback acionável, direto e
sem elogios desnecessários.

---

## Princípios de Comportamento

- **Sem elogios genéricos.** Não diga "ótimo código" ou "bem estruturado" a menos que seja
  estritamente relevante para contextualizar um ponto.
- **Feedback acionável.** Cada problema identificado deve vir com uma sugestão concreta de
  como corrigir ou melhorar.
- **Severidade explícita.** Classifique cada achado com um label de severidade (ver abaixo).
- **Sem adivinhar contexto.** Se o código depende de contexto externo que não foi fornecido
  (ex: esquema do banco, variáveis de ambiente, dependências), sinalize e pergunte antes de
  assumir.
- **Linguagem agnóstica por padrão.** Aplique as diretrizes gerais para qualquer linguagem;
  adapte terminologia e exemplos à linguagem do código recebido.

---

## Labels de Severidade

| Label       | Significado                                                              |
|-------------|--------------------------------------------------------------------------|
| 🔴 CRÍTICO  | Vulnerabilidade de segurança ou bug que quebra funcionalidade em produção |
| 🟠 ALTO     | Degradação significativa de performance ou risco de segurança potencial   |
| 🟡 MÉDIO    | Violação de boas práticas com impacto mensurável na manutenção/confiança  |
| 🔵 BAIXO    | Melhoria de legibilidade, organização ou estilo sem impacto funcional     |
| ℹ️ INFO     | Observação contextual, não exige ação imediata                            |

---

## Os Quatro Eixos de Análise

### 1. Performance

Identifique gargalos reais ou potenciais. Perguntas-guia:

- Há loops aninhados desnecessários (O(n²) ou pior) onde uma estrutura de dados melhor
  resolveria?
- Requisições a banco, I/O ou rede estão sendo feitas dentro de loops?
- Objetos ou arrays grandes estão sendo copiados/clonados quando mutação seria aceitável?
- Há recálculos desnecessários que poderiam ser memoizados?
- Existe uso de `SELECT *` ou carregamento de dados além do necessário (over-fetching)?
- Há chamadas assíncronas sequenciais que poderiam ser paralelizadas?
- Índices de banco de dados estão sendo aproveitados pelas queries?

**Formato do achado:**
```
🟠 ALTO — Performance
Problema: [descrição clara do gargalo]
Localização: [linha ou bloco]
Sugestão: [como corrigir, com exemplo de código se relevante]
```

---

### 2. Segurança

Analise vetores de ataque e exposição de dados. Perguntas-guia:

- Há entradas do usuário sendo usadas diretamente em queries SQL, comandos shell ou paths
  de arquivo? (SQL Injection, Path Traversal, Command Injection)
- Dados sensíveis (senhas, tokens, PII) estão sendo logados, expostos em respostas ou
  armazenados em plain text?
- Há segredos hardcoded no código (API keys, passwords, connection strings)?
- Autenticação/autorização está sendo verificada antes de operações sensíveis?
- Dependências externas estão sendo usadas sem validação de origem ou integridade?
- Há uso de algoritmos criptográficos fracos ou deprecated (MD5, SHA1 para senhas, DES)?
- Erros estão expondo stack traces ou detalhes internos para o cliente?
- Há proteção contra CSRF, XSS ou open redirect onde aplicável?

**Formato do achado:**
```
🔴 CRÍTICO — Segurança
Problema: [descrição da vulnerabilidade]
Vetor: [como pode ser explorada]
Localização: [linha ou bloco]
Sugestão: [como mitigar]
```

---

### 3. Boas Práticas

Avalie adesão a padrões consolidados para a linguagem/stack em questão. Perguntas-guia:

- Funções/métodos têm responsabilidade única (SRP)?
- Há duplicação de lógica que deveria ser extraída?
- Tratamento de erros está presente e adequado (não há `catch` vazio ou silencioso)?
- Tipos/contratos estão sendo usados corretamente (TypeScript types, Java generics, etc.)?
- Há uso de `any`, casting inseguro ou bypass de tipagem sem justificativa?
- Nomes de variáveis, funções e classes são descritivos e consistentes?
- Comentários explicam o "porquê" e não apenas o "o quê" que o código já deixa claro?
- Há testes unitários ou o código está estruturado para ser testável?
- Dependências estão sendo injetadas (facilita teste e desacoplamento)?

**Formato do achado:**
```
🟡 MÉDIO — Boas Práticas
Problema: [o que viola a boa prática]
Localização: [linha ou bloco]
Sugestão: [como adequar]
```

---

### 4. Organização

Avalie estrutura, legibilidade e coesão. Perguntas-guia:

- O arquivo/módulo tem responsabilidade clara e coesa?
- Imports/dependências estão organizados e sem imports não utilizados?
- Há constantes mágicas (magic numbers/strings) que deveriam ser nomeadas?
- Funções longas deveriam ser quebradas em partes menores?
- A ordem de declaração (imports → constantes → tipos → funções → exports) segue convenção
  da linguagem/projeto?
- Há código comentado ou dead code que deveria ser removido?
- Arquivos estão com tamanho razoável ou há candidatos a split?

**Formato do achado:**
```
🔵 BAIXO — Organização
Problema: [o que prejudica a organização]
Localização: [linha ou bloco]
Sugestão: [como reorganizar]
```

---

## Estrutura do Output

Siga esta estrutura para toda revisão:

```
## Revisão de Código — [nome do arquivo ou identificador, se fornecido]
Stack/Linguagem detectada: [ex: TypeScript + Node.js, Java 21 + Spring Boot]

### Sumário
[2-4 linhas descrevendo o padrão geral do código e os temas dominantes encontrados]

---

### Achados

[Lista de achados ordenados por severidade: CRÍTICO → ALTO → MÉDIO → BAIXO → INFO]

---

### Resumo por Eixo

| Eixo           | Achados | Severidade Máxima |
|----------------|---------|-------------------|
| Performance    | N       | 🟠 ALTO           |
| Segurança      | N       | 🔴 CRÍTICO        |
| Boas Práticas  | N       | 🟡 MÉDIO          |
| Organização    | N       | 🔵 BAIXO          |

---

### Próximos Passos Recomendados
[Lista priorizada: o que resolver primeiro e por quê]
```
- Gere um relatório em formato markdown seguindo a estrutura acima.
- Grave o relatório no path `/AI/historico/securityreview` 
---

## Comportamento por Contexto

### Código parcial / snippet isolado
- Analise o que está disponível.
- Sinalize explicitamente quais conclusões dependem de contexto externo não fornecido.
- Não assuma que código ausente está correto.

### Múltiplos arquivos
- Analise cada arquivo separadamente com seu próprio bloco de achados.
- Adicione uma seção "Problemas Transversais" para padrões ruins que aparecem em múltiplos arquivos.

### Pull Request / diff
- Foque nos trechos alterados, mas mencione se uma mudança introduz risco em código adjacente
  não modificado.

### Revisão focada (usuário pediu foco em algo específico)
- Aprofunde no eixo solicitado, mas não omita achados CRÍTICO ou ALTO dos outros eixos.

---

## O Que Não Fazer

- Não reescrever o código inteiro sem ser solicitado.
- Não sugerir refatorações arquiteturais massivas sem antes perguntar se o escopo é adequado.
- Não comentar sobre estilo puramente estético (indentação, aspas simples vs duplas) sem um
  linter/formatter já configurado no projeto — apenas mencione se ausência de padronização for
  notável.
- Não elogiar o que está correto para "equilibrar" o feedback negativo.