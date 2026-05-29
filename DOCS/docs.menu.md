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
| `DOCS/specs/systemSpecification.md` | Stack tecnológica e decisões de arquitetura do projeto. Consulte para entender restrições técnicas ou verificar versões de dependências. |

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
