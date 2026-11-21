import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { selectAgenda } from './agenda'
import {
  applyTaskPatch,
  BUILTIN_STATUS_DEFS,
  byBoardOrder,
  computeTaskSummary,
  deadlineAlongPatch,
  deadlineBand,
  deadlineDropDate,
  deadlineMarkOn,
  filterTasksForBlock,
  fitDayRows,
  formatDeadlineDay,
  formatRelativeDay,
  groupTasksBy,
  isInProgress,
  isOverdue,
  openDeadlinesByDay,
  planCellOf,
  reschedulePatch,
  splitDoneWindow,
  summaryMatches,
  taskBucket,
  uncheckChecklist,
  undoPatch,
  uniqueName,
  weekWindow,
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

describe('uniqueName', () => {
  const others = [
    { id: 'a', name: 'Guitarra' },
    { id: 'b', name: 'Corrida' },
  ]

  it('apara, corta no máximo e devolve o nome', () => {
    expect(uniqueName('  Piano  ', 32, others, null)).toEqual({ name: 'Piano', clash: null })
    expect(uniqueName('abcdefgh', 5, others, null).name).toBe('abcde')
  })

  it('nome vazio ou só espaços: name vazio, sem colisão', () => {
    expect(uniqueName('   ', 32, others, null)).toEqual({ name: '', clash: null })
  })

  it('a colisão ignora caixa e acento e devolve o item que já usa o nome', () => {
    expect(uniqueName('GUITARRA', 32, others, null).clash).toBe(others[0])
    expect(uniqueName('córrida', 32, others, null).clash).toBe(others[1])
  })

  it('o item excluído (edição do próprio nome) não colide consigo mesmo', () => {
    expect(uniqueName('guitarra', 32, others, 'a').clash).toBeNull()
    expect(uniqueName('guitarra', 32, others, 'b').clash).toBe(others[0])
  })

  it('a colisão vale para o nome já cortado', () => {
    expect(uniqueName('Guitarra extra', 8, others, null).clash).toBe(others[0])
  })
})

// Regra do chip "Postponed" (F1.3): só conta deadline adiado ou do date adiado.
describe('Postponed (F1.3)', () => {
  it('adiar o deadline existente soma 1', () => {
    const t = task({ dueDate: '2026-11-23', rescheduleCount: 1 })
    expect(applyTaskPatch(t, { dueDate: '2026-11-25' }, 1).rescheduleCount).toBe(2)
  })

  it('antecipar o deadline (ou repetir a data) não soma', () => {
    const t = task({ dueDate: '2026-11-23', rescheduleCount: 1 })
    expect(applyTaskPatch(t, { dueDate: '2026-11-20' }, 1).rescheduleCount).toBe(1)
    expect(applyTaskPatch(t, { dueDate: '2026-11-23' }, 1).rescheduleCount).toBe(1)
  })

  it('limpar o deadline zera', () => {
    const t = task({ dueDate: '2026-11-23', rescheduleCount: 3 })
    expect(applyTaskPatch(t, { dueDate: null }, 1).rescheduleCount).toBe(0)
  })

  it('definir o primeiro deadline não soma', () => {
    const t = task({ dueDate: null, rescheduleCount: 0 })
    expect(applyTaskPatch(t, { dueDate: '2026-11-25' }, 1).rescheduleCount).toBe(0)
  })

  it('adiar o do date existente soma 1', () => {
    const t = task({ scheduledDate: '2026-11-20' })
    expect(applyTaskPatch(t, { scheduledDate: '2026-11-24' }, 1).rescheduleCount).toBe(1)
  })

  it('antecipar o do date, definir o primeiro ou limpar não soma', () => {
    const t = task({ scheduledDate: '2026-11-24' })
    expect(applyTaskPatch(t, { scheduledDate: '2026-11-20' }, 1).rescheduleCount).toBe(0)
    expect(applyTaskPatch(t, { scheduledDate: null }, 1).rescheduleCount).toBe(0)
    expect(applyTaskPatch(task({}), { scheduledDate: '2026-11-20' }, 1).rescheduleCount).toBe(0)
  })

  it('antecipar o deadline e adiar o do date no mesmo patch soma 1', () => {
    const t = task({ dueDate: '2026-11-23', scheduledDate: '2026-11-20' })
    const patch = { dueDate: '2026-11-21', scheduledDate: '2026-11-22' }
    expect(applyTaskPatch(t, patch, 1).rescheduleCount).toBe(1)
  })

  it('o rescheduleCount explícito no patch (Undo) prevalece', () => {
    const t = task({ dueDate: '2026-11-23', rescheduleCount: 2 })
    expect(applyTaskPatch(t, { dueDate: '2026-11-25', rescheduleCount: 0 }, 1).rescheduleCount).toBe(0)
  })

  it('desfazer uma antecipação do deadline não soma adiamento', () => {
    const before = task({ dueDate: '2026-11-27', rescheduleCount: 1 })
    const after = applyTaskPatch(before, { dueDate: '2026-11-24' }, 1)
    expect(after.rescheduleCount).toBe(1)
    const undo = undoPatch(before, after)
    expect(undo).toEqual({ dueDate: '2026-11-27', rescheduleCount: 1 })
    expect(applyTaskPatch(after, undo!, 2)).toMatchObject({ dueDate: '2026-11-27', rescheduleCount: 1 })
  })

  it('desfazer uma antecipação do do date não soma adiamento', () => {
    const before = task({ scheduledDate: '2026-11-24', rescheduleCount: 1 })
    const after = applyTaskPatch(before, { scheduledDate: '2026-11-20' }, 1)
    expect(after.rescheduleCount).toBe(1)
    const undo = undoPatch(before, after)
    expect(undo).toEqual({ scheduledDate: '2026-11-24', rescheduleCount: 1 })
    expect(applyTaskPatch(after, undo!, 2)).toMatchObject({ scheduledDate: '2026-11-24', rescheduleCount: 1 })
  })
})

describe('célula do plano e ordem', () => {
  it('My Day de hoje fica em hoje, mesmo com o do date em outro dia', () => {
    expect(planCellOf(task({ plannedDay: TODAY, scheduledDate: '2026-11-25' }), TODAY)).toBe(TODAY)
  })

  it('deadline estourado sem plano novo vai para overdue', () => {
    expect(planCellOf(task({ dueDate: '2026-11-17' }), TODAY)).toBe('overdue')
  })

  it('deadline estourado com do date de hoje em diante vai para o dia do plano', () => {
    expect(planCellOf(task({ dueDate: '2026-11-17', scheduledDate: '2026-11-20' }), TODAY)).toBe('2026-11-20')
  })

  it('só deadline futuro: o dia do deadline; sem data: nodate', () => {
    expect(planCellOf(task({ dueDate: '2026-11-27' }), TODAY)).toBe('2026-11-27')
    expect(planCellOf(task({}), TODAY)).toBe('nodate')
  })

  it('byBoardOrder: important, depois doing, depois a ordem manual', () => {
    const manual = task({ sortOrder: 1 })
    const later = task({ sortOrder: 2 })
    const doing = task({ sortOrder: 3, status: 'doing' })
    const important = task({ sortOrder: 4, important: true })
    expect([later, important, doing, manual].sort(byBoardOrder)).toEqual([important, doing, manual, later])
  })

  it('openDeadlinesByDay ignora concluída e descartada e agrupa pelo deadline', () => {
    const a = task({ dueDate: '2026-11-27' })
    const b = task({ dueDate: '2026-11-27' })
    const c = task({ dueDate: '2026-11-30' })
    const done = task({ dueDate: '2026-11-27', status: 'done' })
    const dropped = task({ dueDate: '2026-11-27', status: 'dropped' })
    const none = task({})
    const map = openDeadlinesByDay([a, b, c, done, dropped, none])
    expect(map.get('2026-11-27')).toEqual([a, b])
    expect(map.get('2026-11-30')).toEqual([c])
    expect(map.size).toBe(2)
  })
})

describe('janela de semanas', () => {
  it('5 semanas de 7 dias a partir da segunda da semana', () => {
    const weeks = weekWindow(TODAY, 5)
    expect(weeks).toHaveLength(5)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0][0]).toBe('2026-11-16')
    expect(weeks[4][6]).toBe('2026-12-20')
  })

  it('começar num domingo ainda começa na segunda da semana', () => {
    expect(weekWindow('2026-11-22', 5)[0][0]).toBe('2026-11-16')
  })
})

describe('faixa do deadline', () => {
  it('sem deadline: none', () => {
    expect(deadlineBand(task({}), TODAY)).toBe('none')
  })

  it('antes de hoje: missed, mesmo com do date novo', () => {
    expect(deadlineBand(task({ dueDate: '2026-11-17' }), TODAY)).toBe('missed')
    expect(deadlineBand(task({ dueDate: '2026-11-17', scheduledDate: '2026-11-20' }), TODAY)).toBe('missed')
  })

  it('dentro da janela: a segunda da semana do deadline', () => {
    expect(deadlineBand(task({ dueDate: TODAY }), TODAY)).toBe('2026-11-16')
    expect(deadlineBand(task({ dueDate: '2026-12-20' }), TODAY)).toBe('2026-12-14')
  })

  it('depois da 5ª semana: later', () => {
    expect(deadlineBand(task({ dueDate: '2026-12-21' }), TODAY)).toBe('later')
  })

  it('o horizonte vem do parâmetro de semanas', () => {
    // 1 semana: vai até dom 22; 2 semanas: até dom 29.
    expect(deadlineBand(task({ dueDate: '2026-11-22' }), TODAY, 1)).toBe('2026-11-16')
    expect(deadlineBand(task({ dueDate: '2026-11-23' }), TODAY, 1)).toBe('later')
    expect(deadlineBand(task({ dueDate: '2026-11-29' }), TODAY, 2)).toBe('2026-11-23')
    expect(deadlineBand(task({ dueDate: '2026-11-30' }), TODAY, 2)).toBe('later')
  })
})

describe('data ao soltar numa semana (F3.6)', () => {
  const WORK = [1, 2, 3, 4, 5]

  it('mantém o dia da semana do deadline atual', () => {
    expect(deadlineDropDate(task({ dueDate: '2026-11-27' }), '2026-12-07', TODAY, WORK)).toBe('2026-12-11')
    expect(deadlineDropDate(task({ dueDate: '2026-11-25' }), '2026-12-07', TODAY, WORK)).toBe('2026-12-09')
  })

  it('sem deadline: o último dia de trabalho da semana', () => {
    expect(deadlineDropDate(task({}), '2026-12-07', TODAY, WORK)).toBe('2026-12-11')
    expect(deadlineDropDate(task({}), '2026-12-07', TODAY, [1, 2, 3, 4, 5, 6])).toBe('2026-12-12')
  })

  it('dia da semana que já passou em This week: o último dia de trabalho', () => {
    expect(deadlineDropDate(task({ dueDate: '2026-11-16' }), '2026-11-16', TODAY, WORK)).toBe('2026-11-20')
  })

  it('se o último dia de trabalho também passou: hoje', () => {
    expect(deadlineDropDate(task({ dueDate: '2026-11-17' }), '2026-11-16', '2026-11-21', WORK)).toBe('2026-11-21')
  })

  it('sem dias de trabalho configurados: o último dia útil é a sexta', () => {
    expect(deadlineDropDate(task({}), '2026-12-07', TODAY, [])).toBe('2026-12-11')
    expect(deadlineDropDate(task({ dueDate: '2026-11-17' }), '2026-12-07', TODAY, [])).toBe('2026-12-08')
    expect(deadlineDropDate(task({ dueDate: '2026-11-16' }), '2026-11-16', TODAY, [])).toBe('2026-11-20')
  })

  it('nunca devolve data antes de hoje', () => {
    for (const today of [TODAY, '2026-11-21', '2026-11-22']) {
      for (const due of [null, '2026-11-16', '2026-11-18', '2026-11-22']) {
        for (const days of [WORK, [1, 2, 3, 4, 5, 6], [0], []]) {
          const date = deadlineDropDate(task({ dueDate: due }), '2026-11-16', today, days)
          expect(date >= today).toBe(true)
        }
      }
    }
  })
})

describe('datas do Deadlines', () => {
  it('dentro da janela de 5 semanas: dia da semana e número', () => {
    expect(formatDeadlineDay('2026-11-27', TODAY)).toBe('Fri 27')
    expect(formatDeadlineDay('2026-11-17', TODAY)).toBe('Tue 17')
  })

  it('fora da janela: mês e dia', () => {
    expect(formatDeadlineDay('2026-11-10', TODAY)).toBe('Nov 10')
    expect(formatDeadlineDay('2027-04-30', TODAY)).toBe('Apr 30')
  })

  it('as bordas da janela: a segunda da 1ª semana e o domingo da 5ª entram', () => {
    expect(formatDeadlineDay('2026-11-15', TODAY)).toBe('Nov 15')
    expect(formatDeadlineDay('2026-11-16', TODAY)).toBe('Mon 16')
    expect(formatDeadlineDay('2026-12-20', TODAY)).toBe('Sun 20')
    expect(formatDeadlineDay('2026-12-21', TODAY)).toBe('Dec 21')
  })

  it('a janela vem do parâmetro de semanas', () => {
    expect(formatDeadlineDay('2026-11-22', TODAY, 1)).toBe('Sun 22')
    expect(formatDeadlineDay('2026-11-23', TODAY, 1)).toBe('Nov 23')
  })
})

describe('deadline na linha do Month', () => {
  it('no dia do deadline: due', () => {
    expect(deadlineMarkOn(task({ dueDate: '2026-11-27' }), '2026-11-27', TODAY)).toEqual({ kind: 'due' })
  })

  it('dias depois do deadline: after com a distância', () => {
    expect(deadlineMarkOn(task({ dueDate: '2026-11-27' }), '2026-11-30', TODAY)).toEqual({
      kind: 'after',
      days: 3,
    })
  })

  it('deadline estourado: missed', () => {
    expect(deadlineMarkOn(task({ dueDate: '2026-11-17' }), '2026-11-20', TODAY)).toEqual({ kind: 'missed' })
  })

  it('dia antes do deadline ou sem deadline: nada', () => {
    expect(deadlineMarkOn(task({ dueDate: '2026-11-27' }), '2026-11-25', TODAY)).toBeNull()
    expect(deadlineMarkOn(task({}), '2026-11-25', TODAY)).toBeNull()
  })
})

describe('linhas por célula', () => {
  it('cabe tudo: títulos longos ganham a 2ª linha de cima para baixo', () => {
    expect(fitDayRows(3, [false, true])).toEqual({ shown: 2, more: 0, wrap: [false, true] })
    expect(fitDayRows(4, [true, true])).toEqual({ shown: 2, more: 0, wrap: [true, true] })
    expect(fitDayRows(3, [true, true])).toEqual({ shown: 2, more: 0, wrap: [true, false] })
  })

  it('sem sobra, ninguém ganha a 2ª linha', () => {
    expect(fitDayRows(3, [true, true, true])).toEqual({ shown: 3, more: 0, wrap: [false, false, false] })
  })

  it('não cabe: o último lugar vira "+N more"', () => {
    expect(fitDayRows(2, [false, false, false])).toEqual({ shown: 1, more: 2, wrap: [false, false, false] })
    expect(fitDayRows(1, [false, false])).toEqual({ shown: 0, more: 2, wrap: [false, false] })
  })

  it('capacidade 0 conta como 1 linha', () => {
    expect(fitDayRows(0, [false, false])).toEqual({ shown: 0, more: 2, wrap: [false, false] })
    expect(fitDayRows(0, [true])).toEqual({ shown: 1, more: 0, wrap: [false] })
    expect(fitDayRows(0, [])).toEqual({ shown: 0, more: 0, wrap: [] })
  })
})

describe('Move deadline too na barra de Undo', () => {
  it('o patch leva o deadline e fica com um adiamento só', () => {
    const t = task({ scheduledDate: '2026-11-20', dueDate: '2026-11-23' })
    expect(deadlineAlongPatch(t, '2026-11-25', TODAY)).toEqual({ dueDate: '2026-11-25', rescheduleCount: 1 })
  })

  it('arrasto + Move deadline too termina com rescheduleCount 1 (e não 2)', () => {
    const t = task({ scheduledDate: '2026-11-20', dueDate: '2026-11-23' })
    const dragged = applyTaskPatch(t, reschedulePatch(t, '2026-11-25', TODAY)!, 1)
    expect(dragged.rescheduleCount).toBe(1)
    const moved = applyTaskPatch(dragged, deadlineAlongPatch(t, '2026-11-25', TODAY), 2)
    expect(moved.dueDate).toBe('2026-11-25')
    expect(moved.rescheduleCount).toBe(1)
  })

  it('task só com deadline: +1 só pelo deadline adiado', () => {
    const t = task({ dueDate: '2026-11-27' })
    expect(deadlineAlongPatch(t, '2026-11-30', TODAY)).toEqual({ dueDate: '2026-11-30', rescheduleCount: 1 })
  })

  it('Undo depois do arrasto e do Move deadline too restaura do date, deadline e adiamentos', () => {
    const before = task({ scheduledDate: '2026-11-20', dueDate: '2026-11-23', rescheduleCount: 2 })
    const dragged = applyTaskPatch(before, reschedulePatch(before, '2026-11-25', TODAY)!, 1)
    const moved = applyTaskPatch(dragged, deadlineAlongPatch(before, '2026-11-25', TODAY), 2)
    expect(moved).toMatchObject({ scheduledDate: '2026-11-25', dueDate: '2026-11-25', rescheduleCount: 3 })
    const undo = undoPatch(before, moved)
    expect(undo).toEqual({ scheduledDate: '2026-11-20', dueDate: '2026-11-23', rescheduleCount: 2 })
    expect(applyTaskPatch(moved, undo!, 3)).toMatchObject({
      scheduledDate: '2026-11-20',
      dueDate: '2026-11-23',
      rescheduleCount: 2,
    })
  })
})
