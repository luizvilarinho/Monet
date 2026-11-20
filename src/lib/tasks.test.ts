import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { selectAgenda } from './agenda'
import {
  BUILTIN_STATUS_DEFS,
  computeTaskSummary,
  filterTasksForBlock,
  formatRelativeDay,
  groupTasksBy,
  isInProgress,
  isOverdue,
  reschedulePatch,
  splitDoneWindow,
  summaryMatches,
  taskBucket,
  uncheckChecklist,
  undoPatch,
} from './tasks'

// Regras da Fatia 4 (Tasks): Overdue × Slipped (U1/U7), My Day no Today (U4),
// janela de 14 dias do Done (U2), datas relativas (U15) e o Undo (U5).

// Quinta-feira; a semana vai de seg 16 a dom 22.
const TODAY = '2026-11-19'

let seq = 0
function task(patch: Partial<Task>): Task {
  seq++
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    status: 'todo',
    notebookId: 'nb1',
    noteId: null,
    dueDate: null,
    scheduledDate: null,
    parentNoteId: null,
    important: false,
    recurrence: null,
    recurrenceNextId: null,
    createdAt: 0,
    updatedAt: 0,
    completedAt: null,
    sourceNoteId: null,
    rescheduleCount: 0,
    sortOrder: seq,
    doingSince: null,
    plannedDay: null,
    metadata: {},
    ...patch,
  }
}

// Meio-dia local do dia (evita borda de fuso no dateKeyFromMs).
function at(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

describe('Overdue × Slipped', () => {
  it('deadline estourado sem plano novo fica em Overdue', () => {
    const t = task({ dueDate: '2026-11-17' })
    expect(isOverdue(t, TODAY)).toBe(true)
    expect(taskBucket(t, TODAY)).toBe('overdue')
  })

  it('só o do date passou: Slipped', () => {
    const t = task({ scheduledDate: '2026-11-17', dueDate: '2026-11-25' })
    expect(isOverdue(t, TODAY)).toBe(true)
    expect(taskBucket(t, TODAY)).toBe('slipped')
  })

  it('deadline estourado e do date de hoje em diante: sai de Overdue e vai para o plano', () => {
    const tomorrow = task({ dueDate: '2026-11-17', scheduledDate: '2026-11-20' })
    expect(isOverdue(tomorrow, TODAY)).toBe(false)
    expect(taskBucket(tomorrow, TODAY)).toBe('thisWeek')
    const today = task({ dueDate: '2026-11-17', scheduledDate: TODAY })
    expect(taskBucket(today, TODAY)).toBe('today')
  })

  it('deadline estourado com do date também no passado continua Overdue', () => {
    const t = task({ dueDate: '2026-11-17', scheduledDate: '2026-11-18' })
    expect(taskBucket(t, TODAY)).toBe('overdue')
  })

  it('o chip Overdue conta Overdue e Slipped; o deadline vermelho só com prazo estourado', () => {
    const tasks = [task({ dueDate: '2026-11-17' }), task({ scheduledDate: '2026-11-18' })]
    const summary = computeTaskSummary(tasks, TODAY)
    expect(summary.overdue).toBe(2)
    expect(summary.overdueHasDeadline).toBe(true)
    expect(computeTaskSummary([tasks[1]], TODAY).overdueHasDeadline).toBe(false)
  })

  it('a List mostra a seção Slipped depois de Overdue', () => {
    const tasks = [task({ dueDate: '2026-11-17' }), task({ scheduledDate: '2026-11-18' })]
    const keys = groupTasksBy('date', tasks, TODAY, [], BUILTIN_STATUS_DEFS, new Map()).map((s) => s.key)
    expect(keys).toEqual(['overdue', 'slipped'])
  })
})

describe('My Day no grupo Today', () => {
  it('planejada para hoje entra em Today, mesmo atrasada', () => {
    const later = task({ scheduledDate: '2026-11-30', plannedDay: TODAY })
    const late = task({ scheduledDate: '2026-11-10', plannedDay: TODAY })
    expect(taskBucket(later, TODAY)).toBe('today')
    expect(taskBucket(late, TODAY)).toBe('today')
    expect(summaryMatches('today', late, TODAY)).toBe(true)
    expect(summaryMatches('overdue', late, TODAY)).toBe(false)
  })

  it('o chip Today conta igual ao grupo (em andamento fica de fora)', () => {
    const tasks = [
      task({ scheduledDate: TODAY }),
      task({ plannedDay: TODAY }),
      task({ scheduledDate: TODAY, status: 'doing' }),
    ]
    const today = groupTasksBy('date', tasks, TODAY, [], BUILTIN_STATUS_DEFS, new Map()).find(
      (s) => s.key === 'today'
    )
    expect(today?.tasks).toHaveLength(2)
    expect(computeTaskSummary(tasks, TODAY).today).toBe(2)
  })

  it('status custom (ex.: Waiting) não conta como andamento', () => {
    const waiting = task({ status: 'st_waiting', scheduledDate: TODAY })
    expect(taskBucket(waiting, TODAY)).toBe('today')
    expect(summaryMatches('doing', waiting, TODAY)).toBe(false)
  })
})

describe('Waiting sem data na agenda da IA e no bloco "this week"', () => {
  const waiting = task({ status: 'st_waiting' })
  const doing = task({ status: 'doing' })
  const todo = task({})

  it('fica fora de In progress nas Tasks', () => {
    expect(isInProgress(waiting)).toBe(false)
    expect(taskBucket(waiting, TODAY)).toBe('noDate')
  })

  it('entra no bloco "this week" das notas, como Doing; To do sem data não', () => {
    const ids = filterTasksForBlock([waiting, doing, todo], { period: 'this week', notebookId: null }, TODAY).map(
      (t) => t.id
    )
    expect(ids).toContain(waiting.id)
    expect(ids).toContain(doing.id)
    expect(ids).not.toContain(todo.id)
  })

  it('entra nas tasks abertas da agenda (/week, /planner, /today)', () => {
    const { openTasks } = selectAgenda({
      from: '2026-11-16',
      to: '2026-11-22',
      today: TODAY,
      done: null,
      tasks: [waiting, doing, todo],
      notes: [],
      notebooks: [],
      defs: [],
      statuses: BUILTIN_STATUS_DEFS,
      checklist: new Map(),
      disabledNotebookIds: new Set(),
    })
    const ids = openTasks.map((t) => t.id)
    expect(ids).toContain(waiting.id)
    expect(ids).toContain(doing.id)
    expect(ids).not.toContain(todo.id)
  })
})

describe('Weekly bar', () => {
  it('atrasada planejada antes desta semana sai do denominador', () => {
    const tasks = [
      task({ scheduledDate: '2026-11-10' }),
      task({ scheduledDate: '2026-11-17' }),
      task({ scheduledDate: '2026-11-20' }),
      task({ status: 'done', scheduledDate: '2026-11-18', completedAt: at('2026-11-18') }),
    ]
    const summary = computeTaskSummary(tasks, TODAY)
    expect(summary.doneThisWeek).toBe(1)
    expect(summary.weekTotal).toBe(3)
  })
})

describe('janela de 14 dias do Done', () => {
  it('separa as concluídas nos últimos 14 dias das mais antigas', () => {
    const recent = task({ status: 'done', completedAt: at('2026-11-06') })
    const older = task({ status: 'done', completedAt: at('2026-11-05') })
    const newest = task({ status: 'done', completedAt: at(TODAY) })
    const { recent: r, older: o } = splitDoneWindow([older, recent, newest], TODAY)
    expect(r.map((t) => t.id)).toEqual([newest.id, recent.id])
    expect(o.map((t) => t.id)).toEqual([older.id])
  })

  it('a seção Done não corta em 50 e guarda as antigas em `older`', () => {
    const many = Array.from({ length: 60 }, () => task({ status: 'done', completedAt: at('2026-11-18') }))
    const old = task({ status: 'done', completedAt: at('2026-10-01') })
    const done = groupTasksBy('date', [...many, old], TODAY, [], BUILTIN_STATUS_DEFS, new Map()).find(
      (s) => s.key === 'done'
    )
    expect(done?.tasks).toHaveLength(60)
    expect(done?.older?.map((t) => t.id)).toEqual([old.id])
  })

  it('só concluídas antigas: a seção Done continua (para o "Show older")', () => {
    const old = task({ status: 'done', completedAt: at('2026-10-01') })
    const sections = groupTasksBy('date', [old], TODAY, [], BUILTIN_STATUS_DEFS, new Map())
    expect(sections.map((s) => s.key)).toEqual(['done'])
    expect(sections[0].tasks).toHaveLength(0)
  })
})

describe('datas relativas', () => {
  it.each([
    [TODAY, 'Today'],
    ['2026-11-20', 'Tomorrow'],
    ['2026-11-18', 'Yesterday'],
    ['2026-11-22', 'In 3 days'],
    ['2026-11-25', 'In 6 days'],
    ['2026-11-17', '2 days ago'],
    ['2026-11-13', '6 days ago'],
  ])('%s → %s', (key, label) => {
    expect(formatRelativeDay(key, TODAY)).toBe(label)
  })

  it('a partir de 7 dias, a data absoluta', () => {
    expect(formatRelativeDay('2026-11-26', TODAY)).toBe('Nov 26')
    expect(formatRelativeDay('2026-11-12', TODAY)).toBe('Nov 12')
  })
})

describe('reagendar e desfazer', () => {
  it('reagendar grava o do date e tira do My Day de hoje', () => {
    const t = task({ scheduledDate: TODAY, plannedDay: TODAY })
    expect(reschedulePatch(t, '2026-11-20', TODAY)).toEqual({ scheduledDate: '2026-11-20', plannedDay: null })
    expect(reschedulePatch(t, TODAY, TODAY)).toBeNull()
  })

  it('"Move deadline too" leva o deadline para a mesma data', () => {
    const t = task({ dueDate: '2026-11-17', scheduledDate: '2026-11-17' })
    expect(reschedulePatch(t, '2026-11-20', TODAY, true)).toEqual({
      scheduledDate: '2026-11-20',
      dueDate: '2026-11-20',
    })
    expect(reschedulePatch(t, '2026-11-20', TODAY, false)).toEqual({ scheduledDate: '2026-11-20' })
  })

  it('undoPatch devolve só os campos que mudaram', () => {
    const before = task({ scheduledDate: '2026-11-17', rescheduleCount: 1 })
    const after = { ...before, scheduledDate: '2026-11-20', rescheduleCount: 2, status: 'done', completedAt: 5 }
    expect(undoPatch(before, after)).toEqual({
      status: 'todo',
      scheduledDate: '2026-11-17',
      rescheduleCount: 1,
      completedAt: null,
    })
    expect(undoPatch(before, before)).toBeNull()
  })
})

describe('cópia do corpo da recorrente', () => {
  it('desmarca o checklist e preserva as tasks vinculadas', () => {
    const md = ['- [x] one', '  - [X] nested', '- [ ] two', '- [x] <task-ref id="a">linked</task-ref>', 'text [x]'].join(
      '\n'
    )
    expect(uncheckChecklist(md)).toBe(
      ['- [ ] one', '  - [ ] nested', '- [ ] two', '- [x] <task-ref id="a">linked</task-ref>', 'text [x]'].join('\n')
    )
  })
})
