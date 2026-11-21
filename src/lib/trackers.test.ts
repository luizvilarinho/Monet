import { describe, expect, it } from 'vitest'
import type { Note, Tracker, TrackerMark } from '../types'
import { addDaysKey } from './tasks'
import {
  autoTrackerColor,
  buildTrackerDays,
  deleteTrackerText,
  deleteTypeTrackersNote,
  focusWeekStart,
  formatMonthLine,
  formatTrackersForAi,
  formatTrackersForPlanWeek,
  formatTrackersWeekForAi,
  linkHint,
  markSaveError,
  monthStats,
  monthWeekStarts,
  noteDayKey,
  noteOnlyDayCount,
  queryTrackersText,
  shortDayLabel,
  trackerDays,
  trackerDayTitle,
  trackerMonthLine,
  trackerMonthTitle,
  typeNotesLabel,
  unlinkConfirmText,
  weekCountsLine,
  weekCountTitle,
  weekHeaderLabel,
  weekRangeLabel,
  weekResult,
} from './trackers'

// Regras da Fase A (Trackers): dias manuais e vindos de nota, semana pela
// quinta-feira, total do mês, semanas na meta, semana em foco e tooltip. A
// Fase C acrescenta o resumo para a IA (Coach, Plan week, /week-review) e a
// tool query_trackers.

// Sexta-feira; a semana vai de seg 2026-11-16 a dom 2026-11-22.
const TODAY = '2026-11-20'

// Meio-dia local do dia (evita borda de fuso no dateKeyFromMs).
function at(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

let seq = 0
function tracker(patch: Partial<Tracker> = {}): Tracker {
  seq++
  return {
    id: `tr_${seq}`,
    name: `Tracker ${seq}`,
    weeklyTarget: 3,
    color: '#5b9cf0',
    icon: 'target',
    sortOrder: seq,
    linkedTypeId: null,
    archivedAt: null,
    createdAt: at('2026-09-01'),
    updatedAt: 0,
    ...patch,
  }
}

function mark(trackerId: string, day: string): TrackerMark {
  return { trackerId, day, createdAt: 0 }
}

function note(patch: Partial<Note> = {}): Note {
  seq++
  return {
    id: `n${seq}`,
    notebookId: 'nb1',
    subjectId: null,
    title: `Note ${seq}`,
    content: '',
    tags: [],
    date: null,
    createdAt: at('2026-11-10'),
    updatedAt: at('2026-11-10'),
    typeId: null,
    properties: {},
    archivedAt: null,
    ...patch,
  }
}

// Dias de `t` só com marcas manuais.
function manualDays(t: Tracker, days: string[]) {
  return trackerDays(
    t,
    days.map((d) => mark(t.id, d)),
    [],
    TODAY
  )
}

describe('noteDayKey', () => {
  it('usa a date da nota quando é uma data ISO', () => {
    expect(noteDayKey(note({ date: '2026-11-05', createdAt: at('2026-11-18') }))).toBe('2026-11-05')
  })

  it('sem date, usa o dia da criação', () => {
    expect(noteDayKey(note({ createdAt: at('2026-11-18') }))).toBe('2026-11-18')
  })

  it('date inválida cai no dia da criação', () => {
    expect(noteDayKey(note({ date: 'abc', createdAt: at('2026-11-18') }))).toBe('2026-11-18')
  })
})

describe('trackerDays', () => {
  it('marca manual vira um dia feito', () => {
    const t = tracker()
    const days = trackerDays(t, [mark(t.id, '2026-11-18'), mark('outro', '2026-11-19')], [], TODAY)
    expect([...days.keys()]).toEqual(['2026-11-18'])
    expect(days.get('2026-11-18')).toEqual({ manual: true, fromNote: false })
  })

  it('marca em dia futuro é ignorada', () => {
    const t = tracker()
    expect(trackerDays(t, [mark(t.id, '2026-11-21')], [], TODAY).size).toBe(0)
    expect(trackerDays(t, [mark(t.id, TODAY)], [], TODAY).size).toBe(1)
  })

  it('nota do tipo vinculado conta, pelo dia da nota', () => {
    const t = tracker({ linkedTypeId: 'nt_practice' })
    const n = note({ typeId: 'nt_practice', date: '2026-11-17' })
    const days = trackerDays(t, [], [n], TODAY)
    expect(days.get('2026-11-17')).toEqual({ manual: false, fromNote: true, noteId: n.id })
  })

  it('com várias notas no dia, a nota do dia é a mais recente (editada por último, depois criada por último)', () => {
    const t = tracker({ linkedTypeId: 'nt_practice' })
    const base = { typeId: 'nt_practice', date: '2026-11-17' }
    const older = note({ ...base, updatedAt: at('2026-11-17') })
    const newer = note({ ...base, updatedAt: at('2026-11-18') })
    expect(trackerDays(t, [], [older, newer], TODAY).get('2026-11-17')?.noteId).toBe(newer.id)
    expect(trackerDays(t, [], [newer, older], TODAY).get('2026-11-17')?.noteId).toBe(newer.id)
    const a = note({ ...base, createdAt: at('2026-11-10') })
    const b = note({ ...base, createdAt: at('2026-11-11') })
    expect(trackerDays(t, [], [a, b], TODAY).get('2026-11-17')?.noteId).toBe(b.id)
  })

  it('a nota arquivada não é a nota do dia', () => {
    const t = tracker({ linkedTypeId: 'nt_practice' })
    const base = { typeId: 'nt_practice', date: '2026-11-17' }
    const kept = note({ ...base, updatedAt: at('2026-11-12') })
    const archived = note({ ...base, updatedAt: at('2026-11-18'), archivedAt: 1 })
    expect(trackerDays(t, [], [kept, archived], TODAY).get('2026-11-17')?.noteId).toBe(kept.id)
  })

  it('nota arquivada, do Calendar ou de outro tipo não conta', () => {
    const t = tracker({ linkedTypeId: 'nt_practice' })
    const notes = [
      note({ typeId: 'nt_practice', date: '2026-11-16', archivedAt: 1 }),
      note({ typeId: 'nt_practice', date: '2026-11-17', notebookId: 'calendar' }),
      note({ typeId: 'nt_other', date: '2026-11-18' }),
    ]
    expect(trackerDays(t, [], notes, TODAY).size).toBe(0)
  })

  it('sem tipo vinculado, as notas do tipo não contam', () => {
    const t = tracker()
    expect(trackerDays(t, [], [note({ typeId: 'nt_practice', date: '2026-11-17' })], TODAY).size).toBe(0)
  })

  it('nota com date futura é ignorada', () => {
    const t = tracker({ linkedTypeId: 'nt_practice' })
    const notes = [note({ typeId: 'nt_practice', date: '2026-11-25' })]
    expect(trackerDays(t, [], notes, TODAY).size).toBe(0)
  })

  it('marca e nota no mesmo dia são um dia só, com as duas flags', () => {
    const t = tracker({ linkedTypeId: 'nt_practice' })
    const notes = [
      note({ typeId: 'nt_practice', date: '2026-11-17' }),
      note({ typeId: 'nt_practice', date: '2026-11-17' }),
    ]
    const days = trackerDays(t, [mark(t.id, '2026-11-17')], notes, TODAY)
    expect(days.size).toBe(1)
    expect(days.get('2026-11-17')).toEqual({ manual: true, fromNote: true, noteId: notes[0].id })
  })

  it('noteOnlyDayCount conta só os dias que dependem do vínculo (sem marca manual)', () => {
    const t = tracker({ linkedTypeId: 'nt_practice' })
    const notes = [
      note({ typeId: 'nt_practice', date: '2026-11-16' }),
      note({ typeId: 'nt_practice', date: '2026-11-17' }),
      note({ typeId: 'nt_practice', date: '2026-11-18' }),
    ]
    const days = trackerDays(t, [mark(t.id, '2026-11-17'), mark(t.id, '2026-11-19')], notes, TODAY)
    expect(days.size).toBe(4)
    expect(noteOnlyDayCount(days)).toBe(2)
    expect(noteOnlyDayCount(new Map())).toBe(0)
  })

  it('buildTrackerDays indexa por id do tracker', () => {
    const a = tracker()
    const b = tracker()
    const built = buildTrackerDays([a, b], [mark(a.id, '2026-11-18')], [], TODAY)
    expect(built.get(a.id)?.size).toBe(1)
    expect(built.get(b.id)?.size).toBe(0)
  })
})

describe('monthWeekStarts', () => {
  it('novembro de 2026 começa em 2026-11-02 e vai até a semana de 23/11', () => {
    expect(monthWeekStarts(2026, 10)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'])
  })

  it('a semana de 26/10 a 01/11 é de outubro (quinta 29/10)', () => {
    const october = monthWeekStarts(2026, 9)
    expect(october).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(monthWeekStarts(2026, 10)).not.toContain('2026-10-26')
  })
})

// A semana que cruza 31/12 e a regra da quinta-feira: ela pertence ao ano (e ao
// mês) em que cai a quinta-feira dela.
describe('virada de ano', () => {
  it('2026: 31/12 é quinta, então a semana de 28/12 é de dezembro e janeiro de 2027 começa em 04/01', () => {
    expect(monthWeekStarts(2026, 11).slice(-1)).toEqual(['2026-12-28'])
    expect(monthWeekStarts(2027, 0)[0]).toBe('2027-01-04')
    expect(monthWeekStarts(2027, 0)).not.toContain('2026-12-28')
  })

  it('2025: 01/01/2026 é quinta, então a semana de 29/12/2025 é de janeiro de 2026', () => {
    expect(monthWeekStarts(2025, 11)).toEqual(['2025-12-01', '2025-12-08', '2025-12-15', '2025-12-22'])
    expect(monthWeekStarts(2026, 0)).toEqual(['2025-12-29', '2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'])
  })

  // Meta 2, criado em 01/12/2025 (segunda); marcas em 30/12 (terça) e 02/01 (sexta),
  // as duas na semana de 29/12/2025 a 04/01/2026; hoje é 15/01/2026.
  const NEW_YEAR_TODAY = '2026-01-15'
  function newYear() {
    const t = tracker({ name: 'Guitar', weeklyTarget: 2, createdAt: at('2025-12-01') })
    const marks = ['2025-12-30', '2026-01-02'].map((d) => mark(t.id, d))
    const days = trackerDays(t, marks, [], NEW_YEAR_TODAY)
    return { t, days, all: new Map([[t.id, days]]) }
  }

  it('o total de cada mês conta só os dias dele; a semana que cruza conta em janeiro', () => {
    const { t, days } = newYear()
    // Janeiro: 1 dia (02/01); a semana de 29/12 bateu a meta (2/2), a de 05/01 ficou
    // em 0/2 e a de 12/01 ainda está em andamento (fora).
    expect(monthStats(t, days, 2026, 0, NEW_YEAR_TODAY)).toEqual({ total: 1, weeksOnTarget: 1, weeksCounted: 2 })
    // Dezembro: 1 dia (30/12); a semana de início (01/12, 0/2) fica fora e as de 08, 15 e 22/12 contam.
    // A de 29/12 não é de dezembro, então a meta batida nela não entra aqui.
    expect(monthStats(t, days, 2025, 11, NEW_YEAR_TODAY)).toEqual({ total: 1, weeksOnTarget: 0, weeksCounted: 3 })
  })

  it('o resumo do Coach em janeiro: a semana de 29/12 aparece inteira e o mês anterior é dezembro', () => {
    const { t, all } = newYear()
    const out = formatTrackersForAi([t], all, NEW_YEAR_TODAY, TYPES)!
    expect(out).toContain(
      'Last 4 weeks: 05/01–11/01 0/2 below target; 29/12–04/01 2/2 on target; 22/12–28/12 0/2 below target; 15/12–21/12 0/2 below target.'
    )
    expect(out).toContain('This month (January 2026): 1 day, 1 of 2 weeks on target.')
    expect(out).toContain('Last month (December 2025): 1 day, 0 of 3 weeks on target.')
  })
})

describe('weekResult', () => {
  // Criado numa segunda-feira, meta 2.
  const t = tracker({ weeklyTarget: 2, createdAt: at('2026-11-02') })

  it('future: semana que ainda não começou', () => {
    const r = weekResult(t, manualDays(t, []), '2026-11-23', TODAY)
    expect(r.status).toBe('future')
  })

  it('beforeStart: a semana terminou antes do início do tracker', () => {
    expect(weekResult(t, manualDays(t, []), '2026-10-26', TODAY).status).toBe('beforeStart')
  })

  it('onTarget: bateu a meta, inclusive na semana atual', () => {
    const past = weekResult(t, manualDays(t, ['2026-11-03', '2026-11-05']), '2026-11-02', TODAY)
    expect(past).toMatchObject({ done: 2, target: 2, status: 'onTarget', end: '2026-11-08' })
    const current = weekResult(t, manualDays(t, ['2026-11-16', '2026-11-18']), '2026-11-16', TODAY)
    expect(current.status).toBe('onTarget')
  })

  it('inProgress: semana atual abaixo da meta', () => {
    const r = weekResult(t, manualDays(t, ['2026-11-17']), '2026-11-16', TODAY)
    expect(r).toMatchObject({ done: 1, status: 'inProgress' })
  })

  it('below: semana terminada abaixo da meta', () => {
    const r = weekResult(t, manualDays(t, ['2026-11-10']), '2026-11-09', TODAY)
    expect(r).toMatchObject({ done: 1, status: 'below' })
  })

  it('a meta alterada vale para as semanas passadas', () => {
    // Criado antes: a semana de 02/11 não é a de início.
    const early = { ...t, createdAt: at('2026-10-01') }
    const days = manualDays(early, ['2026-11-03', '2026-11-05'])
    expect(weekResult(early, days, '2026-11-02', TODAY).status).toBe('onTarget')
    expect(weekResult({ ...early, weeklyTarget: 3 }, days, '2026-11-02', TODAY).status).toBe('below')
  })

  it('startBelow: a semana de início terminada abaixo da meta não é uma semana perdida', () => {
    // Criado numa quarta-feira (11/11, semana de 09/11), meta 2, só um dia feito.
    const mid = tracker({ weeklyTarget: 2, createdAt: at('2026-11-11') })
    const r = weekResult(mid, manualDays(mid, ['2026-11-12']), '2026-11-09', TODAY)
    expect(r).toMatchObject({ done: 1, target: 2, status: 'startBelow' })
    // A semana seguinte, abaixo da meta, já conta como perdida.
    expect(weekResult(mid, manualDays(mid, ['2026-11-12']), '2026-11-16', '2026-11-30').status).toBe('below')
  })

  it('a semana de início que bateu a meta é onTarget, como qualquer outra', () => {
    const mid = tracker({ weeklyTarget: 2, createdAt: at('2026-11-11') })
    const days = manualDays(mid, ['2026-11-11', '2026-11-12'])
    expect(weekResult(mid, days, '2026-11-09', TODAY).status).toBe('onTarget')
  })

  it('a semana de início ainda em andamento segue inProgress', () => {
    const fresh = tracker({ weeklyTarget: 3, createdAt: at('2026-11-18') })
    expect(weekResult(fresh, manualDays(fresh, []), '2026-11-16', TODAY).status).toBe('inProgress')
  })

  it('uma marca retroativa recua o início, e a semana dela passa a ser a de início', () => {
    const t2 = tracker({ weeklyTarget: 3, createdAt: at('2026-11-10') })
    const days = manualDays(t2, ['2026-11-03'])
    expect(weekResult(t2, days, '2026-11-02', TODAY).status).toBe('startBelow')
    expect(weekResult(t2, days, '2026-11-09', TODAY).status).toBe('below')
  })
})

describe('monthStats', () => {
  it('o total conta só os dias do mês numa semana que cruza o mês', () => {
    const t = tracker()
    const days = manualDays(t, ['2026-10-29', '2026-10-30', '2026-11-01', '2026-11-03'])
    expect(monthStats(t, days, 2026, 10, TODAY).total).toBe(2)
    const october = monthStats(t, days, 2026, 9, TODAY)
    expect(october.total).toBe(2)
    // A semana de 26/10 (quinta 29/10) é de outubro e leva o domingo 01/11: 3 feitos.
    expect(october.weeksOnTarget).toBe(1)
    expect(october.weeksCounted).toBe(5)
  })

  it('a semana atual abaixo da meta fica fora do denominador e entra quando bateu', () => {
    const t = tracker({ weeklyTarget: 2, createdAt: at('2026-11-02') })
    const base = ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-17']
    expect(monthStats(t, manualDays(t, base), 2026, 10, TODAY)).toEqual({
      total: 4,
      weeksOnTarget: 1,
      weeksCounted: 2,
    })
    expect(monthStats(t, manualDays(t, [...base, '2026-11-18']), 2026, 10, TODAY)).toEqual({
      total: 5,
      weeksOnTarget: 2,
      weeksCounted: 3,
    })
  })

  it('as semanas antes do início do tracker ficam de fora, e a de início abaixo da meta também', () => {
    // Criado numa terça (10/11): a semana de 02/11 é anterior; a de 09/11 é a de início.
    const t = tracker({ createdAt: at('2026-11-10') })
    expect(monthStats(t, manualDays(t, []), 2026, 10, TODAY)).toEqual({
      total: 0,
      weeksOnTarget: 0,
      weeksCounted: 0,
    })
  })

  it('a semana de início só entra quando bateu a meta', () => {
    const t = tracker({ createdAt: at('2026-11-10') })
    expect(monthStats(t, manualDays(t, ['2026-11-10', '2026-11-11', '2026-11-12']), 2026, 10, TODAY)).toEqual({
      total: 3,
      weeksOnTarget: 1,
      weeksCounted: 1,
    })
  })

  it('criado no domingo, a semana que acabou de terminar não vira "0 de 3" na segunda', () => {
    // Domingo 22/11; na segunda 23/11 a semana de 16/11 já terminou, com 0/3.
    const t = tracker({ createdAt: at('2026-11-22') })
    expect(monthStats(t, manualDays(t, []), 2026, 10, '2026-11-23')).toEqual({
      total: 0,
      weeksOnTarget: 0,
      weeksCounted: 0,
    })
  })

  it('uma marca retroativa antes da criação recua o início até ela', () => {
    // O início vai para 03/11: a semana de 02/11 vira a de início (abaixo da meta, fora);
    // a de 09/11 já conta como perdida.
    const t = tracker({ createdAt: at('2026-11-10') })
    expect(monthStats(t, manualDays(t, ['2026-11-03']), 2026, 10, TODAY)).toEqual({
      total: 1,
      weeksOnTarget: 0,
      weeksCounted: 1,
    })
  })

  it('a meta alterada reavalia as semanas passadas', () => {
    const t = tracker({ weeklyTarget: 2, createdAt: at('2026-11-02') })
    const days = manualDays(t, ['2026-11-03', '2026-11-05'])
    expect(monthStats(t, days, 2026, 10, TODAY).weeksOnTarget).toBe(1)
    expect(monthStats({ ...t, weeklyTarget: 3 }, days, 2026, 10, TODAY).weeksOnTarget).toBe(0)
  })
})

describe('focusWeekStart', () => {
  it('o dia selecionado no mês exibido: a semana dele', () => {
    expect(focusWeekStart('2026-11-04', 2026, 10, TODAY)).toBe('2026-11-02')
    // Domingo 01/11 está em novembro, mas a semana dele começa em outubro.
    expect(focusWeekStart('2026-11-01', 2026, 10, TODAY)).toBe('2026-10-26')
  })

  it('sem dia no mês exibido, a semana de hoje quando hoje está no mês', () => {
    expect(focusWeekStart(null, 2026, 10, TODAY)).toBe('2026-11-16')
    expect(focusWeekStart('2026-10-30', 2026, 10, TODAY)).toBe('2026-11-16')
  })

  it('nem um nem outro: a semana do último dia do mês exibido', () => {
    // 31/10/2026 é sábado; a semana começa em 26/10.
    expect(focusWeekStart(null, 2026, 9, TODAY)).toBe('2026-10-26')
    expect(focusWeekStart('2026-11-04', 2026, 9, TODAY)).toBe('2026-10-26')
  })
})

describe('formatMonthLine', () => {
  it('com semanas contadas, com a unidade e sem o nome do mês', () => {
    expect(formatMonthLine({ total: 13, weeksOnTarget: 3, weeksCounted: 4 })).toBe(
      '13 days · 3 of 4 weeks on target'
    )
  })

  it('com uma semana contada, no singular', () => {
    expect(formatMonthLine({ total: 2, weeksOnTarget: 1, weeksCounted: 1 })).toBe('2 days · 1 of 1 week on target')
    expect(formatMonthLine({ total: 1, weeksOnTarget: 1, weeksCounted: 1 })).toBe('1 day · 1 of 1 week on target')
  })

  it('sem semana contada, só o total', () => {
    expect(formatMonthLine({ total: 5, weeksOnTarget: 0, weeksCounted: 0 })).toBe('5 days')
    expect(formatMonthLine({ total: 0, weeksOnTarget: 0, weeksCounted: 0 })).toBe('0 days')
  })
})

describe('trackerMonthLine', () => {
  it('no mês de hoje: os dias com a unidade e as semanas na meta', () => {
    const t = tracker({ weeklyTarget: 2, createdAt: at('2026-11-02') })
    const days = manualDays(t, ['2026-11-03', '2026-11-05', '2026-11-10'])
    expect(trackerMonthLine(t, days, 2026, 10, TODAY)).toBe('3 days · 1 of 2 weeks on target')
  })

  it('mês que terminou antes do início do tracker: "Started 20 Nov"', () => {
    const t = tracker({ createdAt: at('2026-11-20') })
    const days = manualDays(t, [])
    expect(trackerMonthLine(t, days, 2026, 9, TODAY)).toBe('Started 20 Nov')
    expect(trackerMonthLine(t, days, 2026, 0, TODAY)).toBe('Started 20 Nov')
  })

  it('o ano aparece quando o início é de outro ano que o do mês exibido', () => {
    const t = tracker({ createdAt: at('2026-11-20') })
    expect(trackerMonthLine(t, manualDays(t, []), 2025, 9, TODAY)).toBe('Started 20 Nov 2026')
  })

  it('o início recua até uma marca retroativa', () => {
    const t = tracker({ createdAt: at('2026-11-20') })
    const days = manualDays(t, ['2026-10-05'])
    expect(trackerMonthLine(t, days, 2026, 8, TODAY)).toBe('Started 5 Oct')
    // A semana de 05/10 é a de início (1/3, fora); as outras três contam.
    expect(trackerMonthLine(t, days, 2026, 9, TODAY)).toBe('1 day · 0 of 3 weeks on target')
  })

  it('a semana de início abaixo da meta fica fora da linha; batida, entra', () => {
    const t = tracker({ createdAt: at('2026-11-10') })
    expect(trackerMonthLine(t, manualDays(t, ['2026-11-10']), 2026, 10, TODAY)).toBe('1 day')
    expect(trackerMonthLine(t, manualDays(t, ['2026-11-10', '2026-11-11', '2026-11-12']), 2026, 10, TODAY)).toBe(
      '3 days · 1 of 1 week on target'
    )
  })

  it('o mês do início já conta, mesmo sem marca', () => {
    const t = tracker({ createdAt: at('2026-11-20') })
    expect(trackerMonthLine(t, manualDays(t, []), 2026, 10, TODAY)).toBe('0 days')
  })

  it('mês futuro: nada', () => {
    const t = tracker()
    expect(trackerMonthLine(t, manualDays(t, []), 2026, 11, TODAY)).toBeNull()
    expect(trackerMonthLine(t, manualDays(t, []), 2027, 0, TODAY)).toBeNull()
  })
})

describe('trackerMonthTitle', () => {
  it('lista o resultado de cada semana do mês, com a atual em andamento', () => {
    const t = tracker({ createdAt: at('2026-10-01') })
    const days = manualDays(t, ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-10', '2026-11-17'])
    // Novembro: semanas de 02/11, 09/11, 16/11 (a de 23/11 é futura e a de 26/10 é de outubro).
    expect(trackerMonthTitle(t, days, 2026, 10, TODAY)).toBe('2–8 Nov 3/3 · 9–15 Nov 1/3 · 16–22 Nov 1/3 (in progress)')
  })

  it('a semana que cruza o mês usa os dois meses no intervalo', () => {
    const t = tracker({ createdAt: at('2026-10-01') })
    const title = trackerMonthTitle(t, manualDays(t, ['2026-10-29']), 2026, 9, TODAY)
    expect(title).toContain('26 Oct–1 Nov 1/3')
  })

  it('semanas antes do início do tracker e a de início abaixo da meta ficam de fora', () => {
    // A semana de 02/11 é anterior ao início e a de 09/11 é a de início, com 0/3.
    const t = tracker({ createdAt: at('2026-11-10') })
    expect(trackerMonthTitle(t, manualDays(t, []), 2026, 10, TODAY)).toBe('16–22 Nov 0/3 (in progress)')
  })

  it('a semana de início que bateu a meta aparece', () => {
    const t = tracker({ createdAt: at('2026-11-10') })
    const days = manualDays(t, ['2026-11-10', '2026-11-11', '2026-11-12'])
    expect(trackerMonthTitle(t, days, 2026, 10, TODAY)).toBe('9–15 Nov 3/3 · 16–22 Nov 0/3 (in progress)')
  })

  it('sem semana a mostrar: undefined', () => {
    const t = tracker({ createdAt: at('2026-11-20') })
    expect(trackerMonthTitle(t, manualDays(t, []), 2026, 9, TODAY)).toBeUndefined()
    expect(trackerMonthTitle(t, manualDays(t, []), 2026, 11, TODAY)).toBeUndefined()
  })
})

describe('textos da semana em foco', () => {
  it('weekRangeLabel: no mesmo mês e entre meses', () => {
    expect(weekRangeLabel('2026-11-16')).toBe('16–22 Nov')
    expect(weekRangeLabel('2026-10-26')).toBe('26 Oct–1 Nov')
  })

  it('weekHeaderLabel: "This week" só quando a semana contém hoje', () => {
    expect(weekHeaderLabel('2026-11-16', TODAY)).toBe('This week · 16–22 Nov')
    // Os dois extremos da semana de hoje.
    expect(weekHeaderLabel('2026-11-16', '2026-11-16')).toBe('This week · 16–22 Nov')
    expect(weekHeaderLabel('2026-11-16', '2026-11-22')).toBe('This week · 16–22 Nov')
    expect(weekHeaderLabel('2026-11-09', TODAY)).toBe('9–15 Nov')
    expect(weekHeaderLabel('2026-11-23', TODAY)).toBe('23–29 Nov')
  })

  it('weekCountTitle: "this week" só na semana de hoje, senão o intervalo', () => {
    expect(weekCountTitle(1, 3, '2026-11-16', TODAY)).toBe('1 of 3 this week')
    expect(weekCountTitle(1, 3, '2026-10-05', TODAY)).toBe('1 of 3 in 5–11 Oct')
    expect(weekCountTitle(2, 3, '2026-10-26', TODAY)).toBe('2 of 3 in 26 Oct–1 Nov')
  })

  it('weekCountsLine: o n/meta de cada tracker na semana em foco', () => {
    const a = tracker({ weeklyTarget: 3 })
    const b = tracker({ weeklyTarget: 4 })
    const days = buildTrackerDays(
      [a, b],
      [...marksOn(a, ['2026-11-16', '2026-11-18']), ...marksOn(b, ['2026-11-17', '2026-11-09'])],
      [],
      TODAY
    )
    expect(weekCountsLine([a, b], days, '2026-11-16')).toBe('2/3 · 1/4')
    expect(weekCountsLine([a, b], days, '2026-11-09')).toBe('0/3 · 1/4')
    expect(weekCountsLine([a], new Map(), '2026-11-16')).toBe('0/3')
  })
})

describe('autoTrackerColor', () => {
  it('gira pela paleta sem o cinza, sem a cor do ponto de nota e sem a da barra de task', () => {
    const cycle = [0, 1, 2, 3, 4].map(autoTrackerColor)
    expect(cycle).toEqual(['#5b9cf0', '#5cc185', '#f26b55', '#e6c449', '#5dcaa5'])
    expect(cycle).not.toContain('#9a9aae')
    expect(cycle).not.toContain('#7b6ed4')
    expect(cycle).not.toContain('#ef9f27')
  })

  it('volta ao começo depois da última', () => {
    expect(autoTrackerColor(5)).toBe(autoTrackerColor(0))
    expect(autoTrackerColor(7)).toBe(autoTrackerColor(2))
  })
})

describe('markSaveError', () => {
  it('diz o tracker e o dia e manda tentar de novo', () => {
    expect(markSaveError('Guitar', '2026-11-20')).toBe("Couldn't save Guitar · Fri 20/11. Try again.")
  })
})

describe('textos do vínculo com o tipo de nota', () => {
  it('rótulo e dica do tipo vinculado', () => {
    expect(typeNotesLabel('Practice')).toBe('Practice notes')
    expect(linkHint('Practice')).toBe('Days with a Practice note count as done.')
  })

  it('a confirmação de trocar o vínculo diz a contagem e que as notas ficam', () => {
    expect(unlinkConfirmText('Guitar', 'Practice', 23)).toBe(
      'Guitar counts 23 days from Practice notes. They stop counting if you change this. The notes are kept.'
    )
    expect(unlinkConfirmText('Guitar', 'Practice', 1)).toBe(
      'Guitar counts 1 day from Practice notes. It stops counting if you change this. The notes are kept.'
    )
  })

  it('a confirmação de excluir o tracker diz que as notas do tipo ficam, só com vínculo', () => {
    expect(deleteTrackerText('Guitar', 12, null)).toBe(
      'Delete "Guitar"? This removes it and its 12 marked days. This can\'t be undone.'
    )
    expect(deleteTrackerText('Guitar', 1, 'Practice')).toBe(
      'Delete "Guitar"? This removes it and its 1 marked day. This can\'t be undone. Your Practice notes are kept.'
    )
  })

  it('a confirmação de apagar o tipo cita os trackers vinculados', () => {
    expect(deleteTypeTrackersNote([])).toBeNull()
    expect(deleteTypeTrackersNote(['Guitar'])).toBe('The tracker "Guitar" will stop counting days from its notes.')
    expect(deleteTypeTrackersNote(['Guitar', 'Piano'])).toBe(
      'The trackers "Guitar" and "Piano" will stop counting days from its notes.'
    )
    expect(deleteTypeTrackersNote(['A', 'B', 'C'])).toBe('The trackers "A", "B" and "C" will stop counting days from its notes.')
  })
})

describe('shortDayLabel', () => {
  it('dia da semana e dd/mm', () => {
    expect(shortDayLabel('2026-11-20')).toBe('Fri 20/11')
    expect(shortDayLabel('2026-11-01')).toBe('Sun 01/11')
  })
})

describe('trackerDayTitle', () => {
  const t = tracker({ name: 'Guitar' })

  it('dia futuro não pode ser marcado', () => {
    expect(trackerDayTitle(t, undefined, '2026-11-21', TODAY, null)).toBe(
      "Guitar · Sat 21/11 · future days can't be marked"
    )
  })

  it('dia vindo de nota diz a origem, que o clique abre a nota e como desfazer', () => {
    const day = { manual: false, fromNote: true, noteId: 'n1' }
    expect(trackerDayTitle(t, day, '2026-11-18', TODAY, 'Practice')).toBe(
      'Guitar · Wed 18/11 · Done from a Practice note · click to open it. To undo, archive the note or change its date.'
    )
    expect(trackerDayTitle(t, day, '2026-11-18', TODAY, null)).toContain('Done from a linked type note')
  })

  it('dia com marca manual e nota: o clique abre a nota, e arquivá-la não basta para desfazer', () => {
    const day = { manual: true, fromNote: true, noteId: 'n1' }
    const title = trackerDayTitle(t, day, '2026-11-18', TODAY, 'Practice')
    expect(title).toBe(
      'Guitar · Wed 18/11 · Done (marked, and from a Practice note) · click to open the note. To undo, archive the note or change its date, then click the day again to unmark it.'
    )
    expect(trackerDayTitle(t, day, '2026-11-18', TODAY, null)).toContain('from a linked type note')
  })

  it('dia manual pode ser desmarcado', () => {
    expect(trackerDayTitle(t, { manual: true, fromNote: false }, '2026-11-18', TODAY, null)).toBe(
      'Guitar · Wed 18/11 · done (click to unmark)'
    )
  })

  it('dia vazio pode ser marcado', () => {
    expect(trackerDayTitle(t, undefined, '2026-11-18', TODAY, null)).toBe(
      'Guitar · Wed 18/11 · not done (click to mark)'
    )
  })
})

// ─── Fase C: resumo para a IA ───────────────────────────────────────────────

const TYPES = new Map([['nt_practice', 'Practice']])

function marksOn(t: Tracker, days: string[]): TrackerMark[] {
  return days.map((d) => mark(t.id, d))
}

describe('formatTrackersForAi', () => {
  // O exemplo do contrato: Guitar 3 por semana, criado em 05/10, vinculado a "Practice".
  function guitar() {
    const t = tracker({ name: 'Guitar', createdAt: at('2026-10-05'), linkedTypeId: 'nt_practice' })
    const marks = marksOn(t, [
      // outubro: 5 + 5 + 3 = 13 dias; semanas 05/10 e 12/10 na meta, 19/10 abaixo, 26/10 na meta
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09',
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16',
      '2026-10-26', '2026-10-27', '2026-10-28',
      // novembro: 02/11 abaixo (2/3), 09/11 na meta (3/3), esta semana 1/3
      '2026-11-02', '2026-11-03',
      '2026-11-09', '2026-11-10', '2026-11-11',
      '2026-11-16',
    ])
    return { t, days: buildTrackerDays([t], marks, [], TODAY) }
  }

  it('segue o texto do contrato', () => {
    const { t, days } = guitar()
    expect(formatTrackersForAi([t], days, TODAY, TYPES)).toBe(
      [
        'Trackers (habits the user marks in the Calendar; counts computed by the app — use them as given, never estimate). Weeks run Monday to Sunday.',
        '',
        '[Tracker "Guitar"] target 3 per week · also counts days with a "Practice" note',
        'This week (2026-11-16 to 2026-11-22): 1 of 3 done (Mon 16/11) · 2 to go · open days left including today: Fri 20/11, Sat 21/11, Sun 22/11.',
        'Last 4 weeks: 09/11–15/11 3/3 on target; 02/11–08/11 2/3 below target; 26/10–01/11 3/3 on target; 19/10–25/10 0/3 below target.',
        'This month (November 2026): 6 days, 1 of 2 weeks on target. Last month (October 2026): 13 days, 3 of 4 weeks on target.',
      ].join('\n')
    )
  })

  it('sem tracker ativo devolve null', () => {
    expect(formatTrackersForAi([], new Map(), TODAY, TYPES)).toBeNull()
    const old = tracker({ archivedAt: 1 })
    expect(formatTrackersForAi([old], buildTrackerDays([old], [], [], TODAY), TODAY, TYPES)).toBeNull()
  })

  it('o tracker arquivado fica de fora e a ordem recebida é mantida', () => {
    const a = tracker({ name: 'Alpha' })
    const old = tracker({ name: 'Old', archivedAt: 1 })
    const b = tracker({ name: 'Beta' })
    const out = formatTrackersForAi([b, old, a], buildTrackerDays([b, old, a], [], [], TODAY), TODAY, TYPES)!
    expect(out).not.toContain('Old')
    expect(out.indexOf('Beta')).toBeLessThan(out.indexOf('Alpha'))
  })

  it('meta batida troca "to go" por "target reached"', () => {
    const t = tracker({ name: 'Guitar', weeklyTarget: 2 })
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-16', '2026-11-18']), [], TODAY)
    const out = formatTrackersForAi([t], days, TODAY, TYPES)!
    expect(out).toContain('This week (2026-11-16 to 2026-11-22): 2 of 2 done (Mon 16/11, Wed 18/11) · target reached.')
    expect(out).not.toContain('to go')
    expect(out).not.toContain('open days')
  })

  it('sem dia aberto até domingo', () => {
    const sunday = '2026-11-22'
    const t = tracker({ name: 'Guitar' })
    const days = buildTrackerDays([t], marksOn(t, [sunday]), [], sunday)
    expect(formatTrackersForAi([t], days, sunday, TYPES)).toContain(
      'This week (2026-11-16 to 2026-11-22): 1 of 3 done (Sun 22/11) · 2 to go · no open days left.'
    )
  })

  it('as últimas 4 semanas deixam de fora as anteriores ao início e a de início abaixo da meta', () => {
    // Criado numa terça (03/11): a semana de 02/11 é a de início (0/3, fora) e a de 09/11 conta.
    const t = tracker({ name: 'Guitar', createdAt: at('2026-11-03') })
    const days = buildTrackerDays([t], [], [], TODAY)
    expect(formatTrackersForAi([t], days, TODAY, TYPES)).toContain('Last 4 weeks: 09/11–15/11 0/3 below target.')
  })

  it('a semana de início que bateu a meta entra nas últimas 4 semanas', () => {
    const t = tracker({ name: 'Guitar', createdAt: at('2026-11-03') })
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-03', '2026-11-04', '2026-11-05']), [], TODAY)
    expect(formatTrackersForAi([t], days, TODAY, TYPES)).toContain(
      'Last 4 weeks: 09/11–15/11 0/3 below target; 02/11–08/11 3/3 on target.'
    )
  })

  it('tracker criado nesta semana: nenhuma semana anterior', () => {
    const t = tracker({ name: 'Guitar', createdAt: at('2026-11-17') })
    const days = buildTrackerDays([t], [], [], TODAY)
    expect(formatTrackersForAi([t], days, TODAY, TYPES)).toContain(
      'Last 4 weeks: none yet (the tracker is new; its first week counts only when it reaches the target).'
    )
  })

  it('tracker criado na semana passada e abaixo da meta: nenhuma semana conta ainda, e o mês também não', () => {
    // Domingo 15/11; segunda 16/11 a semana de 09/11 já terminou com 0/3.
    const t = tracker({ name: 'Guitar', createdAt: at('2026-11-15') })
    const days = buildTrackerDays([t], [], [], '2026-11-16')
    const out = formatTrackersForAi([t], days, '2026-11-16', TYPES)!
    expect(out).toContain('Last 4 weeks: none yet')
    expect(out).toContain('This month (November 2026): 0 days.')
    expect(out).not.toContain('below target')
  })

  it('mês anterior sem existência do tracker não entra; "1 week" no singular', () => {
    const t = tracker({ name: 'Guitar', createdAt: at('2026-11-17') })
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-17', '2026-11-18', '2026-11-19']), [], TODAY)
    const out = formatTrackersForAi([t], days, TODAY, TYPES)!
    expect(out).toContain('This month (November 2026): 3 days, 1 of 1 week on target.')
    expect(out).not.toContain('Last month')
  })

  it('só o tipo vinculado que existe aparece na frase', () => {
    const linked = tracker({ name: 'Guitar', linkedTypeId: 'nt_practice' })
    const gone = tracker({ name: 'Piano', linkedTypeId: 'nt_deleted' })
    const plain = tracker({ name: 'Run' })
    const out = formatTrackersForAi(
      [linked, gone, plain],
      buildTrackerDays([linked, gone, plain], [], [], TODAY),
      TODAY,
      TYPES
    )!
    expect(out).toContain('[Tracker "Guitar"] target 3 per week · also counts days with a "Practice" note')
    expect(out).toContain('[Tracker "Piano"] target 3 per week\n')
    expect(out).toContain('[Tracker "Run"] target 3 per week\n')
  })

  it('dias vindos de nota entram na contagem', () => {
    const t = tracker({ name: 'Guitar', linkedTypeId: 'nt_practice' })
    const notes = [note({ typeId: 'nt_practice', date: '2026-11-18' })]
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-16']), notes, TODAY)
    expect(formatTrackersForAi([t], days, TODAY, TYPES)).toContain('2 of 3 done (Mon 16/11, Wed 18/11)')
  })
})

describe('formatTrackersForPlanWeek', () => {
  const t = tracker({ name: 'Guitar' })
  const days = buildTrackerDays([t], marksOn(t, ['2026-11-16']), [], TODAY)
  const HEADER =
    "Trackers (habits; counts computed by the app). Sessions have no hours: they do not use capacity and do not count toward the 4 items per day. Suggest days only from each line's candidate days (any day, weekends included)."
  const THIS_WEEK =
    '- "Guitar" (target 3 per week) this week: 1 of 3 done → 2 to go; candidate days: Fri 20/11, Sat 21/11, Sun 22/11.'
  const NEXT_WEEK =
    '- "Guitar" next week (23/11–29/11): 3 to go; candidate days: Mon 23/11, Tue 24/11, Wed 25/11, Thu 26/11, Fri 27/11, Sat 28/11, Sun 29/11.'

  it('só esta semana', () => {
    expect(formatTrackersForPlanWeek([t], days, TODAY, { thisWeek: true, nextWeek: false })).toBe(
      `${HEADER}\n${THIS_WEEK}`
    )
  })

  it('só a próxima semana: a meta inteira e os sete dias', () => {
    expect(formatTrackersForPlanWeek([t], days, TODAY, { thisWeek: false, nextWeek: true })).toBe(
      `${HEADER}\n${NEXT_WEEK}`
    )
  })

  it('as duas semanas, por tracker', () => {
    const b = tracker({ name: 'Run', weeklyTarget: 2 })
    const out = formatTrackersForPlanWeek([t, b], buildTrackerDays([t, b], marksOn(t, ['2026-11-16']), [], TODAY), TODAY, {
      thisWeek: true,
      nextWeek: true,
    })!
    const lines = out.split('\n').slice(1)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe(THIS_WEEK)
    expect(lines[1]).toBe(NEXT_WEEK)
    expect(lines[2]).toContain('"Run" (target 2 per week) this week: 0 of 2 done → 2 to go')
    expect(lines[3]).toContain('"Run" next week (23/11–29/11): 2 to go')
  })

  it('o dia de hoje já feito não é candidato', () => {
    const d = buildTrackerDays([t], marksOn(t, [TODAY]), [], TODAY)
    expect(formatTrackersForPlanWeek([t], d, TODAY, { thisWeek: true, nextWeek: false })).toContain(
      '1 of 3 done → 2 to go; candidate days: Sat 21/11, Sun 22/11.'
    )
  })

  it('meta batida: sem dias candidatos', () => {
    const d = buildTrackerDays([t], marksOn(t, ['2026-11-16', '2026-11-17', '2026-11-18']), [], TODAY)
    const out = formatTrackersForPlanWeek([t], d, TODAY, { thisWeek: true, nextWeek: false })!
    expect(out).toContain('- "Guitar" (target 3 per week) this week: 3 of 3 done → target reached.')
    expect(out).not.toContain('candidate days: ')
  })

  it('sem tracker ativo devolve null', () => {
    expect(formatTrackersForPlanWeek([], new Map(), TODAY, { thisWeek: true, nextWeek: true })).toBeNull()
    const old = tracker({ archivedAt: 1 })
    expect(
      formatTrackersForPlanWeek([old], buildTrackerDays([old], [], [], TODAY), TODAY, { thisWeek: true, nextWeek: true })
    ).toBeNull()
  })
})

describe('formatTrackersWeekForAi', () => {
  const t = tracker({ name: 'Guitar' })

  it('semana passada abaixo da meta, com os dias feitos', () => {
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-10', '2026-11-12']), [], TODAY)
    expect(formatTrackersWeekForAi([t], days, '2026-11-09', TODAY)).toBe(
      [
        'Trackers in this week (2026-11-09 to 2026-11-15; counts computed by the app — use them as given):',
        '- "Guitar": 2 of 3 done (Tue 10/11, Thu 12/11) · below target',
      ].join('\n')
    )
  })

  it('semana passada na meta', () => {
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-09', '2026-11-10', '2026-11-11']), [], TODAY)
    expect(formatTrackersWeekForAi([t], days, '2026-11-09', TODAY)).toContain('3 of 3 done (Mon 09/11, Tue 10/11, Wed 11/11) · on target')
  })

  it('semana atual em andamento diz quantos dias faltam, contando hoje', () => {
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-16']), [], TODAY)
    expect(formatTrackersWeekForAi([t], days, '2026-11-16', TODAY)).toContain(
      '- "Guitar": 1 of 3 done (Mon 16/11) · in progress, 3 days left including today'
    )
    const sunday = '2026-11-22'
    expect(formatTrackersWeekForAi([t], buildTrackerDays([t], [], [], sunday), '2026-11-16', sunday)).toContain(
      'in progress, 1 day left including today'
    )
  })

  it('semana futura', () => {
    const days = buildTrackerDays([t], [], [], TODAY)
    expect(formatTrackersWeekForAi([t], days, '2026-11-23', TODAY)).toContain(
      '- "Guitar": 0 of 3 done · the week has not started'
    )
  })

  it('semana de início abaixo da meta: o bloco não a diz perdida', () => {
    const fresh = tracker({ name: 'Fresh', createdAt: at('2026-11-11') })
    const days = buildTrackerDays([fresh], marksOn(fresh, ['2026-11-12']), [], TODAY)
    expect(formatTrackersWeekForAi([fresh], days, '2026-11-09', TODAY)).toContain(
      '- "Fresh": 1 of 3 done (Thu 12/11) · the tracker started that week; not counted as below target'
    )
  })

  it('tracker criado depois da semana fica de fora', () => {
    const late = tracker({ name: 'Late', createdAt: at('2026-11-17') })
    const days = buildTrackerDays([t, late], [], [], TODAY)
    const out = formatTrackersWeekForAi([t, late], days, '2026-11-09', TODAY)!
    expect(out).toContain('"Guitar"')
    expect(out).not.toContain('"Late"')
    expect(formatTrackersWeekForAi([late], buildTrackerDays([late], [], [], TODAY), '2026-11-09', TODAY)).toBeNull()
  })

  it('sem tracker ativo devolve null', () => {
    expect(formatTrackersWeekForAi([], new Map(), '2026-11-16', TODAY)).toBeNull()
    const old = tracker({ archivedAt: 1 })
    expect(formatTrackersWeekForAi([old], buildTrackerDays([old], [], [], TODAY), '2026-11-16', TODAY)).toBeNull()
  })
})

describe('queryTrackersText', () => {
  function guitar(patch: Partial<Tracker> = {}) {
    return tracker({ name: 'Guitar', weeklyTarget: 2, linkedTypeId: 'nt_practice', ...patch })
  }

  it('outubro: total, semanas e a origem de cada dia', () => {
    const t = guitar()
    const notes = [
      note({ typeId: 'nt_practice', date: '2026-10-03' }),
      note({ typeId: 'nt_practice', date: '2026-10-04' }),
      note({ typeId: 'nt_practice', date: '2026-11-25' }), // futuro: ignorada
    ]
    const days = buildTrackerDays([t], marksOn(t, ['2026-10-01', '2026-10-04']), notes, TODAY)
    expect(queryTrackersText([t], days, { from: '2026-10-01', to: '2026-10-31' }, TODAY, TYPES)).toBe(
      [
        'Period 2026-10-01 (Thursday) to 2026-10-31 (Saturday); today is 2026-11-20. Days after today are not counted.',
        '',
        '[Tracker "Guitar"] target 2 per week · also counts days with a "Practice" note',
        'Total in the period: 3 days.',
        'Weeks (Monday to Sunday; days in the period / weekly result): ' +
          '28/09–04/10: 3 in the period (week 3/2, on target); ' +
          '05/10–11/10: 0 (week 0/2, below target); ' +
          '12/10–18/10: 0 (week 0/2, below target); ' +
          '19/10–25/10: 0 (week 0/2, below target); ' +
          '26/10–01/11: 0 (week 0/2, below target)',
        'Days: 2026-10-01 (manual), 2026-10-03 (note), 2026-10-04 (manual and note)',
      ].join('\n')
    )
  })

  it('filtra o tracker por parte do nome, sem caixa nem acento', () => {
    const a = tracker({ name: 'Guitarra' })
    const b = tracker({ name: 'Gym' })
    const days = buildTrackerDays([a, b], [], [], TODAY)
    const out = queryTrackersText([a, b], days, { tracker: ' GUITAR ', from: '2026-11-01', to: '2026-11-30' }, TODAY, TYPES)
    expect(out).toContain('[Tracker "Guitarra"]')
    expect(out).not.toContain('Gym')
    expect(queryTrackersText([a, b], days, { from: '2026-11-01', to: '2026-11-30' }, TODAY, TYPES)).toContain('[Tracker "Gym"]')
  })

  it('nome que não casa lista os trackers ativos', () => {
    const a = tracker({ name: 'Guitar' })
    const b = tracker({ name: 'Gym' })
    const days = buildTrackerDays([a, b], [], [], TODAY)
    expect(
      queryTrackersText([a, b], days, { tracker: 'piano', from: '2026-11-01', to: '2026-11-30' }, TODAY, TYPES)
    ).toBe('No active tracker matches "piano". Active trackers: "Guitar", "Gym".')
  })

  it('datas inválidas', () => {
    const t = guitar()
    const days = buildTrackerDays([t], [], [], TODAY)
    const invalid = 'Invalid period: use YYYY-MM-DD for from and to.'
    expect(queryTrackersText([t], days, { from: 'october', to: '2026-10-31' }, TODAY, TYPES)).toBe(invalid)
    expect(queryTrackersText([t], days, { from: '2026-10-01', to: '2026-02-31' }, TODAY, TYPES)).toBe(invalid)
    expect(queryTrackersText([t], days, { from: '', to: '' }, TODAY, TYPES)).toBe(invalid)
  })

  it('período invertido troca from e to', () => {
    const t = guitar()
    const days = buildTrackerDays([t], marksOn(t, ['2026-10-01']), [], TODAY)
    expect(queryTrackersText([t], days, { from: '2026-10-31', to: '2026-10-01' }, TODAY, TYPES)).toBe(
      queryTrackersText([t], days, { from: '2026-10-01', to: '2026-10-31' }, TODAY, TYPES)
    )
  })

  it('período maior que 366 dias', () => {
    const t = guitar()
    const days = buildTrackerDays([t], [], [], TODAY)
    const tooLong = 'Period too long: ask for at most 366 days.'
    expect(queryTrackersText([t], days, { from: '2025-11-19', to: '2026-11-20' }, TODAY, TYPES)).toBe(tooLong)
    expect(queryTrackersText([t], days, { from: '2025-11-20', to: '2026-11-20' }, TODAY, TYPES)).not.toBe(tooLong)
  })

  it('dias depois de hoje não contam', () => {
    const t = guitar({ linkedTypeId: null })
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-16', '2026-11-25']), [], TODAY)
    const out = queryTrackersText([t], days, { from: '2026-11-16', to: '2026-11-30' }, TODAY, TYPES)
    expect(out).toContain('Total in the period: 1 day.')
    expect(out).toContain('16/11–22/11: 1 in the period (week 1/2, in progress); 23/11–29/11: 0 (week 0/2, not started); 30/11–06/12: 0 (week 0/2, not started)')
    expect(out).toContain('Days: 2026-11-16 (manual)')
    expect(out).not.toContain('2026-11-25')
  })

  it('semana antes do início do tracker', () => {
    const t = guitar({ linkedTypeId: null, createdAt: at('2026-11-10') })
    const days = buildTrackerDays([t], [], [], TODAY)
    const out = queryTrackersText([t], days, { from: '2026-11-02', to: '2026-11-08' }, TODAY, TYPES)
    expect(out).toContain('02/11–08/11: 0 in the period (week 0/2, before the tracker started)')
    expect(out).toContain('Days: none')
  })

  it('semana de início abaixo da meta: traz o motivo, sem dizer abaixo da meta', () => {
    const t = guitar({ linkedTypeId: null, createdAt: at('2026-11-11') })
    const days = buildTrackerDays([t], marksOn(t, ['2026-11-12']), [], TODAY)
    const out = queryTrackersText([t], days, { from: '2026-11-02', to: '2026-11-15' }, TODAY, TYPES)
    expect(out).toContain(
      '02/11–08/11: 0 in the period (week 0/2, before the tracker started); ' +
        '09/11–15/11: 1 (week 1/2, the tracker started that week; not counted as below target)'
    )
  })

  it('o tracker arquivado fica de fora', () => {
    const old = tracker({ name: 'Old', archivedAt: 1 })
    const days = buildTrackerDays([old], [], [], TODAY)
    expect(queryTrackersText([old], days, { from: '2026-11-01', to: '2026-11-30' }, TODAY, TYPES)).toBe(
      'The user has no active trackers.'
    )
    const a = tracker({ name: 'Guitar' })
    const both = buildTrackerDays([old, a], [], [], TODAY)
    const out = queryTrackersText([old, a], both, { from: '2026-11-01', to: '2026-11-30' }, TODAY, TYPES)
    expect(out).toContain('"Guitar"')
    expect(out).not.toContain('Old')
  })

  it('a lista de dias tem teto de 120 e depois "+N more"', () => {
    const t = tracker({ name: 'Guitar', createdAt: at('2026-01-01') })
    const everyDay: string[] = []
    for (let d = '2026-01-01'; d <= '2026-06-30'; d = addDaysKey(d, 1)) everyDay.push(d)
    const days = buildTrackerDays([t], marksOn(t, everyDay), [], TODAY)
    const out = queryTrackersText([t], days, { from: '2026-01-01', to: '2026-06-30' }, TODAY, TYPES)
    expect(out).toContain('Total in the period: 181 days.')
    const daysLine = out.split('\n').find((l) => l.startsWith('Days: '))!
    expect(daysLine.endsWith(', +61 more')).toBe(true)
    expect(daysLine.split(', ')).toHaveLength(121)
  })
})
