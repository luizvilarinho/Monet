# Estudo — Entender para decidir: o Monet como companheiro de decisão

> Data: 2026-10-17 · Somente leitura (nenhum código alterado) · Base: develop v1.4.9 + cópia do banco de produção e do histórico de chat · Material de apoio em `DOCS/features/mercado_2026-10/` (`market_09_decisao_ferramentas.md`, `market_10_ciencia_decisao.md`)
> Pergunta do Coordenador: "Uma dificuldade no desenvolvimento com IA é que é preciso tomar muitas decisões, e uma decisão errada pode custar caro. Eu pergunto no chat do Monet (o que é X, qual opção é melhor, dá pra fazer Y), mas essas respostas nunca vão para as notas. Não posso tirar essas dúvidas no Claude Code: o contexto ficaria sujo e as informações da tarefa se perderiam. Essa é minha maior dor hoje. Dá para o Monet facilitar isso?"
> Estudos irmãos: `central_informacao_study.md` (RAG, fontes, MCP I14) e `tasks_entregas_study.md`.
> Privacidade: o repositório é público. Dados de trabalho aparecem agregados.

---

## 1. TL;DR

- **A ideia, numa frase:** o Monet vira **"o `/btw` que lembra"**: um canal ao lado do agente que
  - vê o trecho que você trouxe;
  - explica no **seu** nível, com base nas **suas** fontes (specs, doc técnica, reuniões);
  - monta a decisão sem tomá-la por você;
  - guarda o que você aprendeu e decidiu;
  - devolve ao Claude Code **só a decisão destilada**, em poucas linhas.
- **O princípio: separar dois contextos.**
  - **Execução** (Claude Code): tarefa, código e plano. Precisa ficar limpo.
  - **Entendimento** (Monet): dúvidas, explicações, comparações, glossário e decisões com o porquê.
  - **Entre os dois:** uma ponte estreita nos dois sentidos.
- **A dor é real e medida.** De 331 mensagens que você mandou no chat, **84 (25%)** são para entender, decidir ou checar viabilidade; **41** em pastas de trabalho e de desenvolvimento. **24** trazem conteúdo colado, como "meu explorador me retornou com 3 opções, qual é a melhor?". Você já faz o fluxo, só que à mão e sem registro.
- **O mercado resolveu metade.** Isolar a dúvida existe: o `/btw` oficial do Claude Code, branches do ChatGPT, "Ask mode" das IDEs. **Guardar o que se aprendeu e decidiu, quase ninguém faz.** Há formatos prontos para copiar:
  - o cartão de pergunta do `/clarify` do GitHub Spec Kit;
  - o registro de decisão gerado com aprovação humana (skill `adr-author` da Microsoft, que exige desvantagem documentada);
  - o glossário com estado de domínio do Kindle e do LingQ.
- **Começa sem código, hoje (Fase 0):**
  1. `/btw` para a dúvida de uma linha;
  2. uma pasta **"Decisões técnicas"** no chat, com o system prompt do Anexo A e a sua doc visível;
  3. seu pipeline terminando os relatórios com **"## Decisões necessárias"** no formato de cartão.

  Depois:
  - **Fase 1 (~1 semana):** atalho que leva o texto copiado para o Monet, botões de explicar e decidir, "resposta para o agente".
  - **Fase 2 (~1–2 semanas):** cadernos **Decisões** e **Glossário**.
  - **Fase 3 (conforme o uso):** caixa de revisão alimentada por hooks do Claude Code, export de decisões para o repo, MCP.
- **O cuidado central:** a IA que recomenda antes de você pensar **ancora** a sua escolha e, com o tempo, enfraquece o seu julgamento. A explicação de IA aumenta a aceitação até de recomendações erradas. A fricção, porém, precisa ser seletiva:
  - **decisões baratas e reversíveis:** resposta direta, com 1 risco e 1 alternativa;
  - **decisões caras ou irreversíveis:** sua hipótese primeiro, um **mapa de opções sem veredito** (evidência a favor e contra, com fonte), um contra-argumento específico e a recomendação só quando você pedir.

  A única condição que gerou decisões melhores *e* aprendizado foi explicação sem recomendação (Gajos 2022).
- **Dúvida no meio da execução se estaciona, não se resolve na hora.** Retomar uma tarefa interrompida custa de 10 a 25 minutos (Iqbal & Horvitz 2007). Resposta curta agora; aprofundamento no ponto de pausa (antes de aprovar, no fim da tarefa).

---

## 2. A dor, nos seus dados

| Sinal | Números (produção, mai–out/2026) |
| --- | --- |
| Perguntas para entender, decidir ou checar viabilidade | 84 de 331 mensagens (25%). Por tipo (uma mensagem pode ter mais de um): viabilidade 44 ("é possível…", "dá pra…"), entender 30 ("o que é…", "me explique…"), decidir/opinião 24 ("qual a melhor…", "o que você acha…", "trade-offs") |
| Onde | 41 em pastas de trabalho e desenvolvimento: projeto principal 19, Monet 7, VOLP 7, migração 3, MBA 3 |
| Conteúdo colado (saída de agente, tabelas, planos) | 24 mensagens, como "meu explorador me retornou com 3 opções", "segue o plano" e uma tabela de prós e contras |
| Destino das respostas | Quase nenhum: 6 "Anotar" no app inteiro; nenhuma decisão registrada; nenhum glossário |
| Exemplo desta conversa | Para decidir sobre o RAG, você precisaria saber o que é *golden set* e o que é *OCR*. No Claude Code, isso sujaria a tarefa |

A dor tem três partes:
1. **Entender:** termos, linguagem simples, o que o agente está propondo de fato.
2. **Decidir:** opções, custo de errar, reversibilidade, o que falta saber.
3. **Lembrar:** o que já foi decidido e por quê, e os termos que você já aprendeu.

O mercado cobre a 1, cobre parte da 2 dentro do agente, e quase ninguém cobre a 3.

---

## 3. O princípio: dois contextos e uma ponte estreita

```
CLAUDE CODE  (execução: precisa ficar limpo)          MONET  (entendimento: pode ser bagunçado)

plano / relatório / pergunta do agente
        │
        └──(1) LEVA ─► atalho com o texto copiado, ou caixa de revisão (hooks → pasta)
                              │
                              ├─ explica no seu nível (Glossário + specs + doc técnica + reuniões, com fontes)
                              ├─ cartão de decisão (opções, por que importa, reversível?, custo de errar)
                              ├─ você escolhe (nas irreversíveis, antes de ver a recomendação)
                              └─ registra: Decisões (com o porquê) e Glossário (o que você aprendeu)
        ┌──(2) DEVOLVE ── "resposta para o agente": ≤ 5 linhas (decisão, motivo, restrições, perguntas)
        ▼
o agente recebe a decisão, não a aula
```

Por que isso é coerente com a tese do Monet:
- a IA **explica e provoca**, você **decide e assina**;
- nada vira registro sem o seu clique;
- o Glossário é um **fichamento de conceitos** e o caderno de Decisões é um **fichamento de escolhas**: aprofundamento aplicado ao trabalho.

---

## 4. A ideia em detalhe: um caso completo

Caso real do seu histórico: o explorer do Claude Code volta com 3 bibliotecas de gráfico e uma tabela de prós e contras.

1. **Levar (1 gesto).** Você copia a tabela no terminal e aperta **Ctrl+Shift+M**. A janela do Assistant abre com a faixa "Contexto: trecho copiado (1.240 caracteres) · Pasta: Projeto principal ▾". A pasta traz junto a doc técnica, as specs, as reuniões, a memória e as decisões daquele projeto.
2. **Entender (chips, só quando você clica):**
   - **Termos** lista as palavras técnicas do trecho com uma linha cada, marcando o que você já tem no Glossário ("SVG — no seu Glossário como *sei explicar* desde 03/10"). Cada termo tem *Guardar no Glossário* e *Explicar melhor*.
   - **Em linguagem simples** diz o que o agente está propondo, em 5 linhas.
   - **Que decisões isso me pede?** separa as decisões embutidas no trecho, inclusive as que o agente tomou sem perguntar.
   - **Riscos** faz um pre-mortem curto: "deu errado em 3 meses; por quê?", com no máximo 3 itens.
   - **Perguntas para o agente** lista o que você deveria perguntar ao Claude Code antes de aprovar.
   - **Já decidimos algo parecido?** busca no caderno de Decisões e aponta conflitos.
3. **Decidir (cartão).**
   - **Triagem de 10 segundos.** A IA sugere e você confirma: "reversível em horas · custo de errar médio · não urgente · objetivo: resolver". A triagem define quanto atrito aplicar (matriz no §7).
   - **O cartão,** no formato do `/clarify`:
     - **pergunta** e **por que importa**;
     - **opções** A–C, com pelo menos 2 reais e mais "adiar / não fazer / spike de 2 h";
     - por opção: **evidência a favor e contra, com fonte** (doc técnica, reunião, decisão anterior) ou marcada como inferência;
     - por opção, **se der errado:** o que quebra, quanto custa voltar, o primeiro sinal e o ponto de não retorno;
     - **como checar em 5 minutos** a afirmação que sustenta a decisão.
   - **Quando aparece a recomendação:** nas decisões reversíveis e baratas, vem direto. Nas caras ou irreversíveis, o cartão fica **sem veredito**: antes vem "o que você escolheria e por quê? confiança 0–100%" e um contra-argumento específico. A recomendação aparece só se você pedir, como opinião, com a incerteza e com "o que me faria mudar de ideia".
4. **Registrar (você assina).** Você escolhe ("B, porque o time já usa essa lib") e clica em *Registrar decisão*. O registro é proporcional:
   - mão dupla = uma frase no formato Y-statement;
   - mão única = registro curto com:
     - "aceito que…" (a desvantagem é obrigatória) e a confiança;
     - uma **previsão verificável** ("em 30 dias esperamos…");
     - **sinais de que errei**;
     - um **gatilho de revisão** (data ou evento, ex.: "se o p95 passar de 200 ms").

   O status começa como "proposta" e vira "aceita" quando você confirma. O registro entra no caderno **Decisões** do projeto, no RAG e no dia do Calendar. Antes de gravar, o Monet avisa se há conflito com uma decisão anterior da pasta.
5. **Devolver.** *Resposta para o agente* copia 3–5 linhas: "Decisão: lib B. Motivo: … Restrições: … Pergunta: …". Você cola no Claude Code, e a tarefa recebe a decisão, não a aula.
6. **Revisitar.** Na Weekly Review aparece o bloco "Decisões da semana (3) · 1 para revisar hoje: lib B — como foi?". Um debrief de 5 minutos:
   - compara a previsão com o resultado;
   - classifica no 2×2 decisão boa/ruim × resultado bom/ruim (uma boa decisão pode dar azar);
   - atualiza o Glossário.
7. **Dúvida que surge no meio da execução** (o agente rodando, você no fluxo): no atalho, *Guardar para depois* manda a dúvida, com 1 linha de contexto e um "onde parei", para a fila **"Dúvidas de hoje"**. A resposta imediata é curta; o aprofundamento vem no ponto de pausa.

---

## 5. O que o Claude Code já oferece (doc oficial, out/2026)

| Recurso | O que faz | Serve para | Limite |
| --- | --- | --- | --- |
| **`/btw`** | Pergunta paralela que vê a conversa e **não entra no histórico**; roda enquanto o agente trabalha; `c` copia a resposta em Markdown, `f` abre um fork com ferramentas | Dúvida de uma linha, sem sujar o contexto | Não usa ferramentas nem as suas fontes; **some** ao fechar; não vira registro. O Monet entra justamente onde ele para |
| **Hooks** | `PostToolUse` + `ExitPlanMode` entrega o plano; `PreToolUse` + `AskUserQuestion` entrega as perguntas ao usuário; `Stop` entrega a última resposta; `Notification` (`agent_needs_input`) avisa quando ele precisa de você. Rodam script PowerShell | Mandar automaticamente o que pede decisão para uma pasta que o Monet observa, **sem gastar tokens** | Configuração no seu Claude Code; o Monet precisa observar a pasta (hoje as pastas monitoradas só são relidas no início do app ou no "rescan") |
| **AskUserQuestion / plan mode** | O agente faz perguntas de múltipla escolha; o plan mode planeja sem editar e pede aprovação | Decisões estruturadas dentro do agente | Mesmo vocabulário do agente; sem glossário nem registro; não usar o timeout nas aprovações |
| **Output styles** (Explanatory, próprio) | O estilo Explanatory adiciona blocos "Insight"; um estilo próprio pode "definir termos na 1ª vez" | Explicação leve dentro da sessão | Adiciona tokens ao contexto principal (é o que você quer evitar); não vale para subagentes |
| **Subagent / `/subtask` / `/branch`** | Contexto separado para tangentes | Explicação longa sem sujar a tarefa | O relatório do subagente **volta** ao contexto principal (peça para gravar em arquivo e devolver só o caminho) |
| **Deep link `claude-cli://open?cwd=…&q=…`** | Abre o Claude Code com o prompt preenchido, sem enviar | Monet → Claude Code ao **iniciar** uma tarefa com contexto | Abre sessão nova; para a sessão em curso, colar é melhor |
| **MCP** | `claude mcp add --transport stdio monet …`, com permissão por ferramenta | Claude Code consultando Decisões, Glossário e base do Monet | Exige o servidor do Monet (I14 em `central_informacao_study.md`) |

Fontes oficiais:
- [interactive-mode (`/btw`)](https://code.claude.com/docs/en/interactive-mode#side-questions-with-%2Fbtw)
- [hooks](https://code.claude.com/docs/en/hooks)
- [output-styles](https://code.claude.com/docs/en/output-styles)
- [sub-agents](https://code.claude.com/docs/en/sub-agents)
- [deep-links](https://code.claude.com/docs/en/deep-links)
- [mcp](https://code.claude.com/docs/en/mcp)

---

## 6. Padrões de mercado que valem copiar

Detalhes, exemplos e fontes em `mercado_2026-10/market_09_decisao_ferramentas.md`.

| # | Padrão | Exemplos | No Monet | Esforço |
| --- | --- | --- | --- | --- |
| 1 | **Cartão de decisão:** pergunta → por que importa → opções em tabela → recomendação com motivo → sua resposta → linha `Q → A` datada | GitHub Spec Kit `/clarify`; `AskUserQuestion` | Chip "Que decisões isso me pede?" → um cartão por decisão | M |
| 2 | **Você raciocina primeiro, a IA critica depois** | ExtendAI × RecommendAI (Microsoft Research, CHI 2025); "AI should challenge, not obey" | Mapa sem veredito + sua hipótese primeiro nas decisões caras ou irreversíveis (E7) | P |
| 3 | **Relatório do agente lido como um livro** | Padrão do Reader (validado por você); Markdown Review do Kiro; Plannotator (hook no plano do Claude Code) | Relatórios `.md` abertos com chat ao lado e seleção como contexto | P–M |
| 4 | **Explicação ancorada na frase e no projeto** | Ghostreader ("as used in the following sentence"); Kindle mostra a frase original | "O que X quer dizer *aqui*" = frase + specs e reuniões da pasta | P |
| 5 | **Promoção tipada** da resposta ou do trecho | "New card" do Heptabase; supertags do Tana | "Salvar como termo / decisão / nota" | P–M |
| 6 | **Glossário com estado de domínio** | "Mastered" do Kindle Vocabulary Builder; status 1–4 + Known do LingQ | Estágios *vi → entendo → sei explicar → já apliquei*; o explicador dosa a profundidade pelo estágio (E6) | M |
| 7 | **Registro proporcional à reversibilidade** | Portas de mão única/dupla (Bezos); `adr-author` (Y-statement × MADR) | Mão dupla = 1 frase; mão única = registro curto + pre-mortem | P |
| 8 | **Campos mínimos, com desvantagem obrigatória** | Nygard (2011), MADR 4.0, Farnam Street, `adr-author` | Pergunta, opções, escolha + porquê, "aceito que…", confiança, revisar em, status | P–M |
| 9 | **A IA rascunha, você assina** | Granola (preto = seu, cinza = IA); Authorship do iA Writer; drafts do MarginNote | O rascunho só vira registro quando você confirma ou edita | M |
| 10 | **Provocações sob demanda** (pre-mortem, red team, inversão, primeiros princípios) | Advanced Elicitation do BMAD; pre-mortem de Klein | Chips no cartão, com no máximo 3 achados | P |
| 11 | **Revisitar com data marcada** | "review each ADR one month later"; diário de decisão contra o viés retrospectivo | "Revisar em" → lembrete + bloco na Weekly Review | P–M |
| 12 | **Entrada sem atrito e volta ao agente** | Click to Do, PowerToys Advanced Paste, `@selected-text` do Raycast; `decisionLog.md` do Memory Bank (Cline/Roo) | Atalho com o texto copiado; "resposta para o agente"; export `.md` para o repo | P–G |

---

## 7. O que a ciência diz (e as regras que saem dela)

Detalhes, autores e números em `mercado_2026-10/market_10_ciencia_decisao.md`. Ressalva: a maior parte da evidência vem de laboratório; nenhum estudo testou um "companheiro de decisão" para devs, e as regras combinam evidência adjacente.

### 7.1 Evidência que pesa

**Dependência da IA:**
- **Explicações de IA aumentam a aceitação, inclusive de recomendações erradas** (Bansal 2021).
- Num survey com 319 profissionais, **quem mais confia na IA relata pensar menos criticamente** (Lee 2025, Microsoft).
- Com IA, as pessoas melhoram o desempenho, mas **superestimam o próprio resultado**.

**Desenvolvedores:**
- No RCT da Anthropic (52 devs), o grupo com IA fez **50% no quiz, contra 67% sem IA**, sem ganho de tempo significativo. **Quem só fez perguntas conceituais preservou o aprendizado.**
- No METR, devs experientes ficaram **19% mais lentos** com IA e achavam ter ficado **20% mais rápidos**. A percepção não é confiável: é preciso medir.

**O que funciona:**
- **Decidir antes de ver a IA:** a dependência cai de 0,64 para 0,48 (Buçinca 2021).
- **Incerteza em 1ª pessoa** e **contra-argumentos específicos**.
- **Mapa avaliativo sem veredito:** explicação sem recomendação foi a única condição que gerou decisões melhores *e* aprendizado (Gajos 2022).
- **Verificação barata:** explicações só reduzem a dependência quando barateiam a verificação (Vasconcelos 2023).
- O custo: essas são as intervenções **menos apreciadas**, por isso a fricção precisa ser seletiva.

**Provocar:**
- Ajuda quando é **específica, rara e a decisão importa**; é ignorada quando genérica ou urgente (Drosos 2025).
- Um tutor com salvaguardas evitou a queda de 17% na prova (Bastani, PNAS 2025); um tutor socrático "puro" não melhorou o aprendizado.

**Aprender termos:**
- explicar de volta com as próprias palavras (g = 0,55);
- apresentar os termos-chave antes da explicação (d ≈ 0,75);
- comparar "X vs. Y" (d ≈ 0,50, com mais transferência);
- revisão espaçada (g ≈ 0,50).

Personalizar pelo que você já sabe, não por "estilo de aprendizagem", que não tem evidência.

**Decidir:**
- Considerar várias alternativas está associado a mais sucesso (56% → 70%; Nutt 1999). Isso acontece em menos de 20% das decisões.
- Explicitar o custo de "não fazer nada" muda escolhas.
- O pre-mortem tem evidência escassa, mas positiva.
- ADRs são pouco adotados e sem evidência causal de qualidade; 63% já nascem "aceitos", sem deliberação.
- Não há estudo direto de diário de decisões, mas reflexão escrita (+22,8%) e debriefs (d = 0,67) sustentam a prática.

**Contexto e interrupção:** retomar uma tarefa interrompida custa de 10 a 25 minutos, e 27% das suspensões passam de 2 horas. Dúvidas surgidas na execução devem ser **estacionadas com um ponto de retomada** e aprofundadas nos pontos de pausa.

**"Comprehension debt"** (Addy Osmani): aprovar o que não se entende vira dívida que cobra juros depois.

### 7.2 Quanto atrito aplicar (matriz de fricção)

| Objetivo \ Reversibilidade | Reversível e barata | Cara de reverter | Irreversível |
| --- | --- | --- | --- |
| **Resolver logo** | Resposta direta + 1 risco + 1 alternativa. Sem perguntas | Mapa de 2–3 opções + custo de errar + 1 contra-argumento. Registro curto | Sua hipótese primeiro + mapa sem veredito + pre-mortem + checklist + registro com gatilho de revisão |
| **Quero entender** | Explicação sem veredito + 2–3 termos-chave. Explain-back opcional | O anterior + comparação lado a lado ("X vs. Y") | Tudo acima + explain-back antes de aprovar |

### 7.3 Regras de design

1. **Triagem de 10 segundos:** a IA infere reversibilidade, custo de errar, urgência e objetivo; você confirma ou corrige. Nunca vira formulário.
2. **Sua hipótese primeiro, só quando vale** (caras ou irreversíveis, ou modo "entender"): "o que você escolheria e por quê? confiança 0–100%". "Não sei ainda" vale como resposta.
3. **Mapa avaliativo por padrão:** 2–4 opções × critérios, cada célula com evidência a favor e contra e a origem marcada (fonte ou inferência). Recomendação só quando você pede, rotulada como opinião, com incerteza e "o que me faria mudar de ideia". Nas reversíveis e urgentes, recomendar direto é aceitável.
4. **Pelo menos 2 alternativas reais**, mais "adiar / não fazer / spike de 2 h", com o custo de esperar. A IA gera a **alternativa mais forte contra a opção preferida**, sua ou do agente.
5. **Por opção, se der errado:** o que quebra, quanto custa voltar, o primeiro sinal e o ponto de não retorno.
6. **De 1 a 3 contra-argumentos específicos e acionáveis**, ancorados nas suas fontes (reunião, doc, decisão anterior), em tom de colega. Nunca elogiar uma escolha sem citar o trade-off: os modelos tendem a bajular.
7. **Incerteza honesta e curta:** "não tenho certeza sobre X porque…"; separar fato com fonte, inferência e opinião. Resposta longa infla a confiança sem aumentar o acerto.
8. **Verificação barata:** para cada afirmação que sustenta a decisão, "como checar em 5 min" (doc oficial, issue, comando, teste mínimo), com a marca "verifiquei".
9. **Checklist de aprovação de plano do agente**, só no ponto de pausa (Anexo C). O item "o que eu não sei explicar" alimenta o Glossário.
10. **Explicar a partir do que você sabe:**
    - Glossário com estágios: *vi → entendo → sei explicar → já apliquei*.
    - Termo novo = definição de 1 frase + exemplo no seu projeto + contraste com o vizinho ("X vs. Y") + analogia opcional.
    - O apoio diminui à medida que o estágio sobe.
11. **Consolidar fora do fluxo (opcional):** 3–5 perguntas por semana sobre seus termos e **suas decisões reais** ("por que escolhemos A e não B?"), com tentativa antes da resposta. Reler o glossário tem pouca utilidade; testar funciona.
12. **Explain-back curto e opcional**, depois de um termo-chave e antes de aprovar uma decisão irreversível: "explique em 2–3 frases para um colega". A IA aponta lacunas, sem dar nota. "Pular" sempre disponível.
13. **Estacionamento de dúvidas:**
    - Durante a execução, resposta curta e a dúvida vai para "Dúvidas de hoje" com um ponto de retomada.
    - Aprofundamentos e provocações só nos pontos de pausa.
14. **Registro deliberativo:**
    - A IA rascunha; o porquê e a confiança são seus.
    - O registro tem previsão verificável, sinais de erro e gatilho de revisão.
    - O status começa em "proposta".
15. **Debrief de 5 minutos no gatilho:**
    - comparar a previsão com o resultado e classificar no 2×2 decisão × resultado;
    - a fricção diminui num tema conforme você demonstra domínio, e aumenta em temas novos;
    - **medir autonomia, não só satisfação.**

### 7.4 Como saber se está funcionando (sem confiar na impressão)

- **Autonomia:** % de decisões caras com hipótese sua registrada; explain-backs feitos sem ajuda.
- **Dependência:** quantas vezes você concordou com a IA quando, na revisão, ela estava errada.
- **Calibração:** a confiança registrada contra o resultado nas revisões; deve melhorar ao longo dos meses.
- **Amplitude:** alternativas por decisão (meta: 3 ou mais, contando "não fazer nada").
- **Ciclo fechado:** revisões feitas no prazo. **Retenção:** termos que sobem de estágio.
- **Alarme de burocracia:** o tempo para decidir coisas reversíveis **não pode subir**; muito "pular" indica atrito mal calibrado.

### 7.5 Folclore a evitar no desenho

| Afirmação comum | O que a evidência diz |
| --- | --- |
| "Fadiga de decisão" | Não se sustentou em replicação de 23 laboratórios |
| "Leva 23 min para recuperar o foco" | O número não tem fonte primária clara; os dados variam de ~10 a 25 min |
| "Pre-mortem melhora 30% a detecção de risco" | Distorcido: os +30% eram no número de razões, sem medir qualidade |
| "Estilos de aprendizagem" | Sem evidência |
| "Peça para ir com calma" | +30% de tempo sem ganho de acurácia; o que funciona é estrutura |
| "Explicação resolve a dependência" | No geral, aumenta a aceitação de erros; só ajuda se barateia a verificação |
| "Matriz ponderada é objetiva" | Pseudo-precisão: o ganho vem de avaliar cada opção de forma independente, não dos pesos |

---

## 8. Propostas priorizadas

Esforço: P (até 1 dia), M (2–4 dias), G (1+ semana). Todas são convocadas por você; nada é automático.

### Fase 0 — Hoje, sem código

| # | Proposta | O que fazer |
| --- | --- | --- |
| Z1 | **`/btw` para a dúvida de uma linha** | No Claude Code: `/btw o que é golden set?`. Se valer guardar, `c` copia e você cola no Monet |
| Z2 | **Pasta "Decisões técnicas" no chat do Monet** | System prompt do **Anexo A**; documentos do projeto visíveis (doc técnica, specs, reuniões); memória ligada; um modelo mais forte como padrão dessa pasta (decisões caras merecem o melhor modelo) |
| Z3 | **Convenção no seu pipeline de agentes** | Nos behaviors (`DOCS/agents/orchestratorAgent.md`, `plannerAgent.md`, `explorerAgent.md`): todo relatório termina com **"## Decisões necessárias"**, uma por bloco, no formato do **Anexo B**. As decisões ficam explícitas e o Monet passa a ter o que ler |
| Z4 | **Pasta monitorada nos relatórios** | Adicionar `DOCS/reports` (do Monet e do repo de trabalho, se permitido) como watched folder, visível na pasta Z2. O chat passa a responder sobre os relatórios (com "rescan" manual por enquanto) |
| Z5 | **Checklist ao aprovar** | Ao receber um Task Report ou plano: colar na pasta Z2 e pedir "rode o checklist de aprovação (Anexo C) neste plano". Termos que você não souber explicar viram nota no caderno Glossário (por ora, um caderno comum) |

### Fase 1 — Levar e devolver sem atrito (~1 semana)

| # | Proposta | Valor | Esforço | Riscos |
| --- | --- | --- | --- | --- |
| E1 | **Atalho global "Entender" (Ctrl+Shift+M):** lê a área de transferência **só quando você aperta** e abre o Assistant com o trecho como contexto (o `ephemeralContext` que o chat do Reader já usa) e o seletor de pasta/projeto, que traz RAG, memória e decisões | **Alto** | P–M (plugin de clipboard do Tauri + evento + faixa de contexto) | Colar algo sensível por engano: mostrar o trecho antes de enviar |
| E2 | **Chips de entender e decidir:** Termos, Em linguagem simples, Que decisões isso me pede?, Riscos (pre-mortem), Perguntas para o agente, Já decidimos algo parecido?, Como checar isso? Cada chip segue as regras do §7.3 (triagem, incerteza, no máximo 3 riscos) | **Alto** | P (prompts + botões) | Prompts longos demais: manter respostas curtas |
| E13 | **"Guardar para depois" (estacionamento de dúvidas):** no atalho E1, um botão manda a dúvida, com o trecho, 1 linha de contexto e um "onde parei", para a fila **"Dúvidas de hoje"** (nota do dia ou lista própria). A fila é revista no ponto de pausa | Alto (protege o fluxo) | P–M | Fila que vira cemitério: mostrar a contagem na nota diária |
| E3 | **"Resposta para o agente":** gera e copia 3–5 linhas (decisão, motivo, restrições, perguntas) | Alto | P | — |
| E4 | **Fontes visíveis no chat** ("Fontes (n)" e citações [n]): I3 de `central_informacao_study.md` | Alto (confiança) | P–M | Dependência: sem isso, você não verifica o que a IA disse sobre a doc |

### Fase 2 — Lembrar (~1–2 semanas)

| # | Proposta | Valor | Esforço | Riscos |
| --- | --- | --- | --- | --- |
| E5 | **Caderno "Decisões"** (por projeto). Campos: pergunta; opções consideradas, incluindo não fazer; escolha + porquê (seu); "aceito que…"; confiança; reversível?; se der errado; previsão verificável; sinais de erro; gatilho de revisão (data ou evento); status (proposta → aceita → substituída); fontes e link para o relatório ou chat. A IA pré-preenche a partir da conversa; você edita e assina. Reversível = 1 frase. Antes de gravar, aviso de conflito com decisões anteriores. Entra no RAG e no Calendar | **Alto** | M | Virar burocracia (como os ADRs): só registro de 1 frase nas reversíveis |
| E6 | **Caderno "Glossário".** Campos:<br>• termo e definição **nas suas palavras** (a IA sugere, você ajusta; explicar com as próprias palavras é o que fixa);<br>• exemplo no seu projeto e frase de origem;<br>• contraste com o vizinho ("X vs. Y");<br>• projeto, data e estágio (*vi → entendo → sei explicar → já apliquei*).<br>"Guardar termo" vale a partir de qualquer resposta ou chip. O explicador lê o Glossário para não repetir o que você sabe e reduz o apoio conforme o estágio sobe | **Alto** | M | — |
| E7 | **Mapa sem veredito + "você primeiro"** nas decisões caras ou irreversíveis (matriz do §7.2): a recomendação só aparece se você pedir, depois da sua hipótese. Liga e desliga por pasta | Alto (qualidade e aprendizado) | P | Irritar: nunca nas reversíveis e baratas |
| E8 | **Revisitar:** o gatilho vira lembrete e bloco "Decisões da semana / para revisar" na Weekly Review, com um debrief de 5 minutos (previsão × resultado; 2×2 decisão × resultado) | Médio-alto | P–M | — |
| E14 | **Checklist de aprovação de plano** (Anexo C) como chip ou cartão ao abrir um plano ou relatório do agente. Os 5 itens aparecem só no ponto de aprovação; o checklist completo só se o plano tocar em algo irreversível (schema, dados, API pública, dependência, segurança) | Alto (é o seu ponto de decisão mais frequente) | P | — |

### Fase 3 — Ligar ao agente (conforme o uso das Fases 1–2)

| # | Proposta | Valor | Esforço | Riscos |
| --- | --- | --- | --- | --- |
| E9 | **Caixa de revisão do agente.** Hooks do Claude Code (`ExitPlanMode` = plano, `AskUserQuestion` = perguntas, `Stop` filtrado = última resposta) gravam `.md` numa pasta. O Monet **observa a pasta** (observador de arquivos novo) e mostra "o agente quer sua decisão", com o texto aberto em modo leitura, chat ao lado (padrão do Reader) e os chips E2 | **Alto** | M–G | Hooks mal filtrados enchem a caixa: exportar só plano e perguntas |
| E10 | **Export das decisões como `.md`** (formato Nygard/MADR curto) para uma pasta do repo, opt-in, mais uma linha no `CLAUDE.md`: "antes de planejar, leia `DOCS/decisions/`". O agente lê as suas decisões **sem MCP** | Alto | P–M | Política do repo de trabalho (D3) |
| E11 | **MCP só leitura** (`search_decisions`, `get_glossary`, `search_knowledge`): o Claude Code consulta Decisões, Glossário e a base do Monet ao planejar | Médio-alto | M (I14 do estudo irmão) | Injeção indireta via conteúdo colado: só leitura, desligado por padrão |
| E12 | **Deep link para iniciar tarefa:** "Abrir no Claude Code" monta `claude-cli://open?cwd=<repo>&q=<contexto + decisão>` | Médio | P | Só para sessão nova |
| E15 | **Revisão espaçada semanal (opcional):** 3–5 perguntas sobre seus termos e suas decisões reais ("por que escolhemos A e não B?"), com tentativa antes da resposta. Fica como item da Weekly Review; dá para pular | Médio (retenção) | M | Virar obrigação: sempre opcional |

**Não recomendado:**
- explicação automática de termos em toda resposta (vira ruído);
- a IA registrando decisões ou termos sozinha;
- o Claude Code escrevendo no Monet sem aprovação;
- output style explicativo no Claude Code como solução principal, porque devolve a aula ao contexto que você quer limpo.

---

## 9. Fases (resumo)

| Fase | Conteúdo | Resultado |
| --- | --- | --- |
| **0 — Hoje** | Z1 `/btw`, Z2 pasta "Decisões técnicas", Z3 "## Decisões necessárias" no pipeline, Z4 relatórios na pasta monitorada | Você já separa os contextos e tem um explicador com as suas fontes |
| **1 — Levar e devolver** (~1 semana) | E1 atalho, E2 chips, E3 resposta para o agente, E4 fontes visíveis, E13 guardar para depois, E14 checklist de aprovação | Dúvida do agente → Monet → decisão de volta em 3 gestos, sem quebrar o fluxo |
| **2 — Lembrar** (~1–2 semanas) | E5 Decisões, E6 Glossário, E7 mapa sem veredito + você primeiro, E8 revisitar | O que você aprende e decide fica, e o explicador te conhece |
| **3 — Ligar ao agente** (conforme o uso) | E9 caixa de revisão, E10 export para o repo, E11 MCP, E12 deep link, E15 revisão espaçada | O agente consulta as suas decisões; o que pede decisão chega sozinho ao Monet |

Medir com as métricas do §7.4 (autonomia, calibração, amplitude, ciclo fechado, retenção), não só pela sensação. O estudo do METR mostrou que devs com IA se acharam 20% mais rápidos quando estavam 19% mais lentos.

---

## 10. Riscos

1. **Dependência e ancoragem:** mitigadas por E7 (mapa sem veredito), E4 (fontes visíveis), pela verificação em 5 minutos e pelas métricas do §7.4. Os modelos tendem a bajular; o contraponto precisa estar no desenho.
2. **Atrito:** as intervenções que mais ajudam são as menos apreciadas. Por isso a matriz de fricção: atrito só nas decisões caras e irreversíveis; tudo por botão; respostas curtas; no máximo 3 provocações; "pular" sempre disponível.
3. **Privacidade:** a doc e as reuniões de trabalho já vão para o modelo via OpenRouter quando você pergunta (como hoje). O clipboard só é lido no atalho. Hooks e MCP são locais e só de leitura.
4. **Escopo:** o "dev que decide com agentes" é a persona nova (D1 de `central_informacao_study.md`). Cabe na tese: entender antes de decidir é aprofundamento.
5. **Durabilidade:** Decisões e Glossário são notas no SQLite, não chat no localStorage.

---

## 11. Decisões necessárias do Coordenador

1. **D1 — Cadernos:** Glossário e Decisões como **cadernos comuns com template** (P, começar já) ou **cadernos especiais** com campos e telas próprias (M)? Recomendação: comuns primeiro e especiais se pegar.
2. **D2 — Fricção:** adotar a matriz do §7.2 (resposta direta nas reversíveis e baratas; mapa sem veredito + sua hipótese primeiro nas caras ou irreversíveis), com liga e desliga por pasta?
3. **D3 — Export para o repo:** decisões em `.md` dentro do repositório do projeto? O repo de trabalho permite? Em qual pasta e formato?
4. **D4 — Pipeline:** aplicar a convenção "## Decisões necessárias" (Anexo B) nos seus behaviors de agente agora?
5. **D5 — Hooks:** aceita instalar hooks no seu Claude Code para mandar planos e perguntas a uma pasta do Monet (Fase 3)?
6. **D6 — Modelo:** a pasta "Decisões técnicas" usa por padrão um modelo mais forte que o do chat comum?

---

## Anexo A — System prompt da pasta "Decisões técnicas" (Fase 0, pronto para colar)

```
Você é o explicador e conselheiro de decisões técnicas do usuário. Ele é analista de sistemas e
programa com agentes de IA (Claude Code). Ele traz trechos do que o agente propôs (planos, opções,
relatórios) e precisa ENTENDER para DECIDIR. Você não decide por ele.

Entender:
1. Linguagem simples primeiro. Todo termo técnico ganha uma definição de uma linha na primeira vez,
   no sentido em que aparece no trecho, mais um exemplo no projeto dele e, quando ajudar, o
   contraste com o termo vizinho ("X vs. Y"). Use a memória desta pasta para não repetir o que ele já
   sabe. Se a explicação depender de termos que ele não conhece, apresente esses 2–3 termos antes.
2. Ancore nas fontes da pasta (documentação, specs, reuniões) e diga de onde veio cada afirmação.
   Separe: fato com fonte / inferência / opinião. Incerteza em 1ª pessoa ("não tenho certeza sobre X
   porque…"). Para a afirmação que sustenta a decisão, diga como checar em até 5 minutos.

Decidir:
3. Faça uma triagem de uma linha: reversível? custo de errar? urgente? objetivo: resolver ou entender?
4. Decisão reversível e barata: responda direto, com 1 risco e 1 alternativa. Sem perguntas.
5. Decisão cara ou irreversível: monte um cartão SEM VEREDITO:
   - Decisão (uma linha) e por que importa
   - Opções: pelo menos 2 reais + "adiar / não fazer / spike de 2 h"; para cada uma, evidência a favor
     e contra (com fonte ou marcada como inferência) e "se der errado": o que quebra, quanto custa
     voltar, primeiro sinal, ponto de não retorno
   - A alternativa mais forte contra a opção preferida (dele ou do agente)
   - O que falta saber e um teste barato
   Pergunte: "o que você escolheria e por quê? confiança 0–100%". Só depois que ele responder (ou se
   ele pedir), dê sua opinião, rotulada como opinião, com incerteza e "o que me faria mudar de ideia".
6. Aponte as decisões que o agente tomou sem perguntar.
7. Riscos e contra-argumentos: no máximo 3, específicos e acionáveis. Nunca elogie uma escolha sem
   citar o trade-off.

Devolver:
8. Se ele pedir "resposta para o agente", escreva no máximo 5 linhas:
   Decisão: … / Motivo: … / Restrições: … / Perguntas abertas: …
9. Seja breve. Termine com a pergunta de decisão que cabe a ele.
```

## Anexo B — Bloco "## Decisões necessárias" para os relatórios do pipeline (Fase 0)

```
## Decisões necessárias

### D1 — <pergunta em uma linha>
- Por que importa: <impacto no projeto>
- Opções:
  - A) <opção> — a favor: … · contra: … · se der errado: <o que quebra, custo de voltar>
  - B) <opção> — a favor: … · contra: … · se der errado: …
  - C) Adiar / não fazer / spike — custo de esperar: …
- Reversível: mão dupla | cara de reverter | mão única (ponto de não retorno: …)
- O que falta saber: <informação> · como checar: <doc, comando ou teste de até 5 min>
- Decisões que tomei sem perguntar: <lista, ou "nenhuma">
- Recomendação do agente: <opção> porque <motivo> · o que me faria mudar de ideia: …
- Termos que podem precisar de explicação: <lista curta>
```

## Anexo C — Checklist de aprovação de plano do agente (5 itens, só no ponto de aprovação)

1. Qual problema o plano resolve e qual é o critério de pronto?
2. O que nele é **irreversível ou compartilhado**: schema ou dados, API pública, nova dependência, segurança? Se nada, o checklist termina aqui, recolhido.
3. Quais alternativas o agente descartou, e por quê?
4. Como testar, e como reverter se der errado?
5. **O que no plano eu não sei explicar?** Isso vai para o Glossário, ou vira pergunta ao agente antes de aprovar.
