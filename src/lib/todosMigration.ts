import type { Note, Notebook, Task } from '../types'
import { compareTasks, isDone, isOpen, normalizeName, TASK_REF_TAG, taskRefIds } from './tasks'

// Migração group → TODOS (D7), puro (sem storage): o App lê o `task_group`
// dormente, mostra o plano (dry-run) e só grava depois da confirmação.
// Reexecutar não duplica: o id da nota é determinístico e as tasks já
// vinculadas ficam de fora do plano.

export interface LegacyTaskGroup {
  taskId: string
  notebookId: string
  group: string
}

// Uma TODOS a criar: um group normalizado dentro de um caderno.
export interface MigrationRow {
  key: string
  noteId: string
  notebookId: string
  notebookName: string
  // Grafia mais frequente (empate: a primeira em ordem alfabética).
  title: string
  // Grafias fundidas ("Sistema" / "sistema"), da mais frequente à menos.
  spellings: string[]
  taskIds: string[]
  open: number
  closed: number
  onlyClosed: boolean
  // A nota já existe (reexecução depois de uma falha no meio).
  noteExists: boolean
}

function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

function hex8(n: number): string {
  return n.toString(16).padStart(8, '0')
}

// `todos-<16 hex>`: dois FNV-1a de 32 bits (seeds diferentes) sobre
// caderno + group normalizado.
export function todosMigrationNoteId(notebookId: string, normalizedGroup: string): string {
  const s = `${notebookId}\u0000${normalizedGroup}`
  return `todos-${hex8(fnv1a(s, 0x811c9dc5))}${hex8(fnv1a(s, 0x9e3779b9))}`
}

// Linhas do dry-run: só tasks existentes e ainda sem TODOS; mesmo group em
// cadernos diferentes = linhas separadas (D7c). Não procura nota existente de
// mesmo título (D7a). Ordem: caderno, título.
export function planTodosMigration(
  legacy: LegacyTaskGroup[],
  tasks: Task[],
  notes: Note[],
  notebooks: Notebook[]
): MigrationRow[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const noteIds = new Set(notes.map((n) => n.id))
  const nameById = new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed']))
  const groups = new Map<string, { notebookId: string; normalized: string; counts: Map<string, number>; tasks: Task[] }>()
  for (const row of legacy) {
    const task = taskById.get(row.taskId)
    const spelling = row.group.trim()
    if (!task || task.parentNoteId !== null || !spelling) continue
    const normalized = normalizeName(spelling)
    const key = `${task.notebookId}\u0000${normalized}`
    let g = groups.get(key)
    if (!g) {
      g = { notebookId: task.notebookId, normalized, counts: new Map(), tasks: [] }
      groups.set(key, g)
    }
    g.counts.set(spelling, (g.counts.get(spelling) ?? 0) + 1)
    g.tasks.push(task)
  }
  const rows: MigrationRow[] = []
  for (const [key, g] of groups) {
    const spellings = [...g.counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([s]) => s)
    const open = g.tasks.filter(isOpen).length
    const noteId = todosMigrationNoteId(g.notebookId, g.normalized)
    rows.push({
      key,
      noteId,
      notebookId: g.notebookId,
      notebookName: nameById.get(g.notebookId) ?? 'unnamed',
      title: spellings[0],
      spellings,
      taskIds: g.tasks.map((t) => t.id),
      open,
      closed: g.tasks.length - open,
      onlyClosed: open === 0,
      noteExists: noteIds.has(noteId),
    })
  }
  return rows.sort((a, b) => a.notebookName.localeCompare(b.notebookName) || a.title.localeCompare(b.title))
}

// Título escrito como o editor grava o texto do item (tiptap-markdown troca
// `<`/`>` por entidades; prosemirror-markdown `esc` com início de bloco). Sem
// isso a 1ª edição da nota regrava a linha e o sync de título dispara.
function escapeItemText(title: string): string {
  const s = title.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return s
    .replace(/[`*\\~[\]_]/g, (m, i: number) =>
      m === '_' && i > 0 && i + 1 < s.length && /\w/.test(s[i - 1]) && /\w/.test(s[i + 1]) ? m : '\\' + m
    )
    .replace(/^(\+[ ]|[-*>])/, '\\$&')
    .replace(/^(\s*)(#{1,6})(\s|$)/, '$1\\$2$3')
    .replace(/^(\s*\d+)\.\s/, '$1\\. ')
}

// Item de checklist com a pill da task (formato do TaskRef). Concluída sai
// marcada.
function pillLine(t: Task): string {
  return `- [${isDone(t) ? 'x' : ' '}] ${escapeItemText(t.title)} <${TASK_REF_TAG} data-id="${t.id}"></${TASK_REF_TAG}>`
}

// Abertas primeiro, depois as fechadas.
function pillLines(tasks: Task[]): string[] {
  const open = tasks.filter(isOpen).sort(compareTasks)
  const closed = tasks.filter((t) => !isOpen(t)).sort(compareTasks)
  return [...open, ...closed].map(pillLine)
}

// Conteúdo da TODOS nova: o template sem o item vazio do fim + uma linha por
// task.
export function buildTodosContent(template: string, tasks: Task[]): string {
  const base = template.replace(/(^|\n)[ \t]*- \[ \][ \t]*$/, '').trimEnd()
  const lines = pillLines(tasks).join('\n')
  return base ? `${base}\n\n${lines}` : lines
}

// Linhas só das tasks que ainda não têm pill no conteúdo (nota já existente).
export function missingPillLines(content: string, tasks: Task[]): string[] {
  const present = taskRefIds(content)
  return pillLines(tasks.filter((t) => !present.has(t.id)))
}
