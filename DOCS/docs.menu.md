# DOCS Menu

Ponto de entrada para a documentação do projeto. Leia este arquivo primeiro para saber onde encontrar cada recurso.

---

## Papéis

| Papel            | Tipo   | Responsabilidade                                                                                                           |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Coordenador**  | Humano | Faz o pedido via user prompt, aprova o Task Report e dá instruções ao Orquestrador                                         |
| **Orquestrador** | IA     | Interpreta a tarefa, decide o pipeline, spawna os agentes e coordena o fluxo até a entrega                                 |
| **Agentes**      | IA     | Executam tarefas específicas delegadas pelo Orquestrador (`explorerAgent`, `plannerAgent`, `codeAgent`, `codereviewAgent`) |

---

## Agentes

| Arquivo                            | Quando usar                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DOCS/agents/orchestratorAgent.md` | Definição de papel, regras e fluxo do agente orquestrador. Leia ao inicializar o orquestrador.             |
| `DOCS/agents/codeAgent.md`         | Comportamento e restrições do agente de código. Passe ao subagente quando a tarefa for implementar código. |
| `DOCS/agents/plannerAgent.md`      | Comportamento do agente planejador. Passe ao subagente quando a tarefa exigir decomposição em etapas.      |
| `DOCS/agents/explorerAgent.md`     | Comportamento do agente explorador. Passe ao subagente quando escopo ou viabilidade forem incertos.        |
| `DOCS/agents/codereviewAgent.md`   | Comportamento do agente revisor. Passe ao subagente após execução de código para revisão de qualidade.     |
| `DOCS/agents/designer.md`          | Comportamento do agente apropriado para realizar mudanças de layout e aprimoramentos visuais do sistema.   |

---

## Especificações

| Arquivo                             | Quando usar                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DOCS/specs/productVision.md`       | Visão de produto: o problema que o Monet resolve e o papel da IA como meio, não fim. Consulte ao avaliar features ou decisões de design. |
| `DOCS/specs/systemSpecification.md` | Stack tecnológica e decisões de arquitetura do projeto. Consulte para entender restrições técnicas ou verificar versões de dependências. |
| `DOCS/specs/PRD.md`                 | PRD: persona, proposta de valor/diferenciação, inventário de funcionalidades atuais, escopo de plataforma e não-metas. Consulte pra entender público-alvo e o que o Monet deliberadamente não faz. |
| `DOCS/specs/notemark.md`           | Spec das marcas de atenção (v2): trecho marcado com rótulo opcional, persistido como `<mark data-mark>` (botão "Mark" na régua, Ctrl+Shift+M, `==texto==`), menu da marca, lista Marks de revisão com Resolve, seção "Marks" na coluna de cadernos, `has:mark`/`mark:` no Ctrl+P, tool `search_marks`, citação clicável no chat. Consulte ao trabalhar no editor, na busca, na IA ou no chat. |
| `DOCS/specs/tags.md`               | Spec das tags de nota como tema transversal: autocomplete no "+ tag", tag clicável na nota, seção "Tags" com contagem e lista das notas da tag (todos os cadernos) na coluna das notas, `tag:` no Ctrl+P. Consulte ao mexer em tags, na coluna de cadernos ou na busca. |

---

## Backlog

| Arquivo | Quando usar |
| --- | --- |
| `DOCS/backlog.md` | Bugs e ideias registrados e ainda sem task (com causa conferida no código quando houver). Consulte ao abrir uma task nova ou ao procurar pendências de entregas anteriores. |

---

## Estudos

| Arquivo | Quando usar |
| --- | --- |
| `DOCS/features/central_informacao_study.md` | Estudo (2026-10-17) do Monet como central de informação: uso real em produção, RAG (o que melhorar e o que não fazer), versão online, planilhas/Sheets, MCP, propostas I1–I18 e decisões D1–D7. |
| `DOCS/features/tasks_entregas_study.md` | Estudo (2026-10-17) de Tasks e entregas: uso real, Google Calendar/ICS/Outlook, planilhas/Sheets, versão online, propostas T1–T14 e decisões D1–D6. |
| `DOCS/features/decisoes_study.md` | Estudo (2026-10-17) "entender para decidir": Monet como companheiro de decisão ao lado do Claude Code (dois contextos, `/btw`, hooks, Glossário, Decisões, mapa sem veredito, checklist de aprovação). Fase 0 sem código: system prompt (Anexo A) e bloco "Decisões necessárias" para o pipeline (Anexo B). |
| `DOCS/features/tasks_study.md` | Estudo de Tasks v2 (2026-10-12): visão "num olhar", do date × deadline, Week board. |
| `DOCS/features/tags_study.md` | Estudo de tags (2026-10-15): dar função ou remover. |
| `DOCS/features/note_types_study.md` | Estudo (2026-10-20) de tipos de nota (globais, opcionais, com propriedades e template), o tipo **TODOS** que substitui o `group` das tasks (migração, chip rico, progresso na lista), diagnóstico e melhoria da busca Ctrl+P (FTS5 verificado) e "+" no handle de bloco do editor. Mercado: só Capacities. Decisões D1–D11. |
| `DOCS/features/mercado_2026-10/` | Pesquisa de mercado bruta (out/2026) que embasa os estudos acima; comece pelo `README.md` da pasta. |

---

## Relatórios

> O `<timestamp>` segue o formato `YYYYMMDDHHmmss` (ex.: `20260526143022`). Para encontrar o relatório mais recente, liste `DOCS/reports/<data-de-hoje>/` e use o arquivo com o maior valor — a ordenação lexicográfica (alfabética) equivale à cronológica.

| Caminho                                                    | Quando usar                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DOCS/reports/<DD-MM-YYYY>/taskreport_<timestamp>.md`      | Task Report gerado pelo Orquestrador logo após receber o `user_prompt`. Deve ser aprovado pelo Coordenador antes de qualquer exploração, planejamento ou execução.           |
| `DOCS/reports/<DD-MM-YYYY>/executionreport_<timestamp>.md` | Arquivo principal de andamento da task. O Orquestrador mantém no topo os paths dos documentos gerados e cada agente adiciona sua própria sessão com resumo do que fez.       |
| `DOCS/reports/<DD-MM-YYYY>/explorerreport_<timestamp>.md`  | Relatórios de viabilidade gerados pelo `explorerAgent`. Consulte para embasar decisões de escopo após a aprovação do Task Report.                                            |
| `DOCS/reports/<DD-MM-YYYY>/planreport_<timestamp>.md`      | Planos gerados pelo `plannerAgent`. Consulte antes de delegar ao `codeAgent` quando um plano foi produzido. Não é diário de execução; o andamento fica no `executionreport`. |
| `DOCS/reports/<DD-MM-YYYY>/reviewreport_<timestamp>.md`    | Relatórios de code review gerados pelo `codereviewAgent`. Consulte para decidir os ajustes finais da alteração.                                                              |
