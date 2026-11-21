import { describe, expect, it } from 'vitest'
import type { MetadataDef, MetadataValue, Note, NoteLogConfig, NoteType } from '../types'
import { CALENDAR_NOTEBOOK_ID } from './calendar'
import {
  LOG_NO_VALUE_KEY,
  LOG_PERIODS,
  logEntries,
  logNewNoteNotebookId,
  logPeriodRange,
  logTotalsLabel,
  parseLogConfig,
  practiceSaveChanges,
  practiceSetupMessage,
  resolveLog,
  sessionsLabel,
  stripDefFromLog,
  summarizeLog,
  type LogEntry,
  type ResolvedLog,
} from './noteLog'

// Regras da Fase B (Log por tipo de nota): config, resolução defensiva,
// período (mês de calendário e janela móvel), entradas, agregação, totais e
// gravação do tipo "Practice".

// Sexta-feira.
const TODAY = '2026-11-20'
const TYPE_ID = 'nt_log'

// Meio-dia local do dia (evita borda de fuso no dateKeyFromMs).
function at(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

let seq = 0
function noteType(patch: Partial<NoteType> = {}): NoteType {
  seq++
  return {
    id: `nt${seq}`,
    name: `Type ${seq}`,
    icon: null,
    color: null,
    template: null,
    sortOrder: seq,
    builtin: false,
    createdAt: 0,
    board: null,
    log: null,
    ...patch,
  }
}

function def(patch: Partial<MetadataDef> = {}): MetadataDef {
  seq++
  return {
    id: `md${seq}`,
    name: `Prop ${seq}`,
    type: 'text',
    sortOrder: seq,
    createdAt: 0,
    scope: 'note',
    noteTypeId: TYPE_ID,
    options: null,
    showInList: false,
    ...patch,
  }
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
    typeId: TYPE_ID,
    properties: {},
    archivedAt: null,
    ...patch,
  }
}

// Entrada de uma nota do tipo no dia `day` com as propriedades dadas.
function entry(day: string, properties: Record<string, MetadataValue> = {}, patch: Partial<Note> = {}): LogEntry {
  return { note: note({ date: day, properties, ...patch }), day }
}

function resolved(patch: Partial<ResolvedLog> = {}): ResolvedLog {
  return { config: { sumDefId: null, trendDefId: null, groupDefId: null }, sum: null, trend: null, group: null, ...patch }
}

const LOG_ALL_NULL: NoteLogConfig = { sumDefId: null, trendDefId: null, groupDefId: null }

describe('parseLogConfig', () => {
  it('devolve null para nulo, vazio, JSON inválido ou valor que não é objeto', () => {
    expect(parseLogConfig(null)).toBeNull()
    expect(parseLogConfig('')).toBeNull()
    expect(parseLogConfig('{not json')).toBeNull()
    expect(parseLogConfig('[]')).toBeNull()
    expect(parseLogConfig('"x"')).toBeNull()
    expect(parseLogConfig('42')).toBeNull()
    expect(parseLogConfig('null')).toBeNull()
  })

  it('{} vale como Log ligado sem propriedade', () => {
    expect(parseLogConfig('{}')).toEqual(LOG_ALL_NULL)
  })

  it('lê os três campos e troca por null o que não é string', () => {
    expect(parseLogConfig('{"sumDefId":"a","trendDefId":"b","groupDefId":"c"}')).toEqual({
      sumDefId: 'a',
      trendDefId: 'b',
      groupDefId: 'c',
    })
    expect(parseLogConfig('{"sumDefId":3,"trendDefId":null,"groupDefId":"c"}')).toEqual({
      sumDefId: null,
      trendDefId: null,
      groupDefId: 'c',
    })
  })
})

describe('resolveLog', () => {
  it('sem config o Log está desligado', () => {
    expect(resolveLog(noteType({ id: TYPE_ID, log: null }), [])).toBeNull()
  })

  it('resolve as referências válidas', () => {
    const minutes = def({ type: 'number' })
    const bpm = def({ type: 'number' })
    const piece = def({ type: 'text' })
    const type = noteType({
      id: TYPE_ID,
      log: { sumDefId: minutes.id, trendDefId: bpm.id, groupDefId: piece.id },
    })
    const r = resolveLog(type, [minutes, bpm, piece])
    expect(r?.sum).toBe(minutes)
    expect(r?.trend).toBe(bpm)
    expect(r?.group).toBe(piece)
  })

  it('ignora referência apagada, de outro tipo ou de tipo de dado errado e mantém o Log ligado', () => {
    const otherTypeNumber = def({ type: 'number', noteTypeId: 'outro' })
    const textDef = def({ type: 'text' })
    const numberDef = def({ type: 'number' })
    const type = noteType({
      id: TYPE_ID,
      // soma = de outro tipo; tendência = text (tipo errado); grupo = number (tipo errado).
      log: { sumDefId: otherTypeNumber.id, trendDefId: textDef.id, groupDefId: numberDef.id },
    })
    const r = resolveLog(type, [otherTypeNumber, textDef, numberDef])
    expect(r).not.toBeNull()
    expect(r?.sum).toBeNull()
    expect(r?.trend).toBeNull()
    expect(r?.group).toBeNull()
    expect(resolveLog(noteType({ id: TYPE_ID, log: { ...LOG_ALL_NULL, sumDefId: 'apagada' } }), [])).not.toBeNull()
  })

  it('aceita select como agrupamento', () => {
    const select = def({ type: 'select', options: [{ id: 'o1', name: 'Bach', color: null }] })
    const r = resolveLog(noteType({ id: TYPE_ID, log: { ...LOG_ALL_NULL, groupDefId: select.id } }), [select])
    expect(r?.group).toBe(select)
  })
})

describe('stripDefFromLog', () => {
  const log: NoteLogConfig = { sumDefId: 'a', trendDefId: 'b', groupDefId: 'c' }

  it('devolve o mesmo objeto quando nada muda', () => {
    expect(stripDefFromLog(log, 'zzz')).toBe(log)
    expect(stripDefFromLog(LOG_ALL_NULL, 'a')).toBe(LOG_ALL_NULL)
  })

  it('zera só a referência apagada', () => {
    expect(stripDefFromLog(log, 'a')).toEqual({ sumDefId: null, trendDefId: 'b', groupDefId: 'c' })
    expect(stripDefFromLog(log, 'b')).toEqual({ sumDefId: 'a', trendDefId: null, groupDefId: 'c' })
    expect(stripDefFromLog(log, 'c')).toEqual({ sumDefId: 'a', trendDefId: 'b', groupDefId: null })
  })
})

describe('LOG_PERIODS', () => {
  it('This month, Last month, 90 days e 12 months, nessa ordem', () => {
    expect(LOG_PERIODS.map((p) => [p.id, p.label])).toEqual([
      ['month', 'This month'],
      ['lastMonth', 'Last month'],
      ['90d', '90 days'],
      ['12m', '12 months'],
    ])
  })
})

describe('logPeriodRange', () => {
  it('This month vai do dia 1 até hoje', () => {
    expect(logPeriodRange('month', TODAY)).toEqual({ from: '2026-11-01', to: TODAY })
    // Dia 1: só o próprio dia.
    expect(logPeriodRange('month', '2026-11-01')).toEqual({ from: '2026-11-01', to: '2026-11-01' })
  })

  it('Last month é o mês de calendário anterior inteiro', () => {
    expect(logPeriodRange('lastMonth', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    // Mês anterior mais curto, com ano bissexto.
    expect(logPeriodRange('lastMonth', '2028-03-05')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(logPeriodRange('lastMonth', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    // Virada de ano.
    expect(logPeriodRange('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('90 days e 12 months são janelas móveis terminando hoje, hoje incluído', () => {
    expect(logPeriodRange('90d', TODAY)).toEqual({ from: '2026-08-23', to: TODAY })
    expect(logPeriodRange('12m', TODAY)).toEqual({ from: '2025-11-21', to: TODAY })
  })

  it('o fim do Last month deixa de fora as notas do mês atual', () => {
    const lastDay = note({ date: '2026-10-31' })
    const firstOfThisMonth = note({ date: '2026-11-01' })
    const firstDay = note({ date: '2026-10-01' })
    const before = note({ date: '2026-09-30' })
    const { from, to } = logPeriodRange('lastMonth', TODAY)
    const entries = logEntries([lastDay, firstOfThisMonth, firstDay, before], TYPE_ID, from, to)
    expect(entries.map((e) => e.note.id).sort()).toEqual([lastDay.id, firstDay.id].sort())
  })
})

describe('logNewNoteNotebookId', () => {
  it('devolve o caderno da nota mais recente do tipo, por criação', () => {
    const older = note({ notebookId: 'nbA', createdAt: at('2026-11-01') })
    const newest = note({ notebookId: 'nbB', createdAt: at('2026-11-15'), date: '2026-10-02' })
    const middle = note({ notebookId: 'nbA', createdAt: at('2026-11-10') })
    expect(logNewNoteNotebookId([older, newest, middle], TYPE_ID)).toBe('nbB')
  })

  it('ignora nota arquivada, do Calendar, de outro tipo e sem caderno', () => {
    const ok = note({ notebookId: 'nbA', createdAt: at('2026-11-01') })
    const archived = note({ notebookId: 'nbB', createdAt: at('2026-11-18'), archivedAt: at('2026-11-19') })
    const calendar = note({ notebookId: CALENDAR_NOTEBOOK_ID, createdAt: at('2026-11-18') })
    const otherType = note({ notebookId: 'nbC', createdAt: at('2026-11-18'), typeId: 'outro' })
    const noNotebook = note({ notebookId: null, createdAt: at('2026-11-18') })
    expect(logNewNoteNotebookId([ok, archived, calendar, otherType, noNotebook], TYPE_ID)).toBe('nbA')
  })

  it('sem nenhuma nota do tipo devolve null', () => {
    expect(logNewNoteNotebookId([], TYPE_ID)).toBeNull()
    expect(logNewNoteNotebookId([note({ typeId: 'outro' })], TYPE_ID)).toBeNull()
  })
})

describe('logTotalsLabel', () => {
  it('sessões e dias distintos', () => {
    expect(logTotalsLabel(14, 12)).toBe('14 sessions on 12 days')
    expect(logTotalsLabel(1, 1)).toBe('1 session on 1 day')
    expect(logTotalsLabel(2, 1)).toBe('2 sessions on 1 day')
  })

  it('sem sessão, só "0 sessions"', () => {
    expect(logTotalsLabel(0, 0)).toBe('0 sessions')
  })

  it('sessionsLabel respeita o singular', () => {
    expect(sessionsLabel(1)).toBe('1 session')
    expect(sessionsLabel(3)).toBe('3 sessions')
  })
})

describe('logEntries', () => {
  const from = '2026-11-01'

  it('usa a date da nota, ou o dia da criação sem ela', () => {
    const dated = note({ date: '2026-11-18', createdAt: at('2026-11-02') })
    const undated = note({ date: null, createdAt: at('2026-11-12') })
    const days = logEntries([dated, undated], TYPE_ID, from, TODAY).map((e) => e.day)
    expect(days).toEqual(['2026-11-18', '2026-11-12'])
  })

  it('deixa de fora arquivada, do Calendar, de outro tipo e sem caderno', () => {
    const ok = note({ date: '2026-11-18' })
    const archived = note({ date: '2026-11-18', archivedAt: at('2026-11-19') })
    const calendar = note({ date: '2026-11-18', notebookId: CALENDAR_NOTEBOOK_ID })
    const otherType = note({ date: '2026-11-18', typeId: 'outro' })
    const noType = note({ date: '2026-11-18', typeId: null })
    const noNotebook = note({ date: '2026-11-18', notebookId: null })
    const entries = logEntries([ok, archived, calendar, otherType, noType, noNotebook], TYPE_ID, from, TODAY)
    expect(entries.map((e) => e.note.id)).toEqual([ok.id])
  })

  it('só inclui os dias dentro da janela (extremos inclusive)', () => {
    const before = note({ date: '2026-10-31' })
    const first = note({ date: '2026-11-01' })
    const last = note({ date: TODAY })
    const future = note({ date: '2026-11-21' })
    const entries = logEntries([before, first, last, future], TYPE_ID, from, TODAY)
    expect(entries.map((e) => e.note.id).sort()).toEqual([first.id, last.id].sort())
  })

  it('ordena do dia mais recente para o mais antigo, e por updatedAt no mesmo dia', () => {
    const old = note({ date: '2026-11-05' })
    const newer = note({ date: '2026-11-18', updatedAt: at('2026-11-18') })
    const sameDayLater = note({ date: '2026-11-18', updatedAt: at('2026-11-19') })
    const entries = logEntries([old, newer, sameDayLater], TYPE_ID, from, TODAY)
    expect(entries.map((e) => e.note.id)).toEqual([sameDayLater.id, newer.id, old.id])
  })
})

describe('summarizeLog', () => {
  it('conta sessões e soma, ignorando valor não numérico', () => {
    const minutes = def({ type: 'number' })
    const entries = [
      entry('2026-11-18', { [minutes.id]: 30 }),
      entry('2026-11-17', { [minutes.id]: 45 }),
      entry('2026-11-16', { [minutes.id]: 'abc' }),
      entry('2026-11-15', { [minutes.id]: NaN }),
      entry('2026-11-14', {}),
    ]
    const s = summarizeLog(entries, resolved({ sum: minutes }))
    expect(s.sessions).toBe(5)
    expect(s.sum).toBe(75)
    expect(s.groups).toEqual([])
  })

  it('conta os dias distintos: duas sessões no mesmo dia são um dia', () => {
    const entries = [
      entry('2026-11-18'),
      entry('2026-11-18'),
      entry('2026-11-17'),
      entry('2026-11-10'),
      entry('2026-11-10'),
      entry('2026-11-10'),
    ]
    const s = summarizeLog(entries, resolved())
    expect(s.sessions).toBe(6)
    expect(s.days).toBe(3)
    expect(summarizeLog([], resolved())).toMatchObject({ sessions: 0, days: 0 })
  })

  it('sem propriedade de soma a soma é null; sem valor a tendência é null', () => {
    const bpm = def({ type: 'number' })
    const s = summarizeLog([entry('2026-11-18'), entry('2026-11-17')], resolved({ trend: bpm }))
    expect(s.sessions).toBe(2)
    expect(s.sum).toBeNull()
    expect(s.trend).toBeNull()
    expect(summarizeLog([entry('2026-11-18', { [bpm.id]: 80 })], resolved()).trend).toBeNull()
  })

  it('tendência vai do primeiro ao último valor em ordem cronológica', () => {
    const bpm = def({ type: 'number' })
    // Entradas na ordem de logEntries (mais recente primeiro).
    const entries = [
      entry('2026-11-18', { [bpm.id]: 100 }),
      entry('2026-11-14', {}),
      entry('2026-11-10', { [bpm.id]: 90 }),
      entry('2026-11-02', { [bpm.id]: 70 }),
    ]
    const s = summarizeLog(entries, resolved({ trend: bpm }))
    expect(s.trend).toEqual({ first: 70, last: 100, points: [70, 90, 100] })
  })

  it('agrupa por select, e opção apagada ou vazio vai para "No value"', () => {
    const piece = def({
      type: 'select',
      options: [
        { id: 'o1', name: 'Bach', color: null },
        { id: 'o2', name: 'Chopin', color: null },
      ],
    })
    const minutes = def({ type: 'number' })
    const entries = [
      entry('2026-11-18', { [piece.id]: 'o1', [minutes.id]: 20 }),
      entry('2026-11-17', { [piece.id]: 'o1', [minutes.id]: 30 }),
      entry('2026-11-16', { [piece.id]: 'o2', [minutes.id]: 10 }),
      entry('2026-11-15', { [piece.id]: 'apagada', [minutes.id]: 5 }),
      entry('2026-11-14', {}),
    ]
    const s = summarizeLog(entries, resolved({ group: piece, sum: minutes }))
    expect(s.groups.map((g) => [g.key, g.label, g.sessions, g.sum])).toEqual([
      ['o1', 'Bach', 2, 50],
      [LOG_NO_VALUE_KEY, 'No value', 2, 5],
      ['o2', 'Chopin', 1, 10],
    ])
  })

  it('agrupa por text sem caixa e sem espaços nas pontas, mas separa os acentos', () => {
    const piece = def({ type: 'text' })
    const entries = [
      entry('2026-11-18', { [piece.id]: 'bach' }),
      entry('2026-11-17', { [piece.id]: 'Bách' }),
      entry('2026-11-10', { [piece.id]: '  Bach ' }),
      entry('2026-11-12', { [piece.id]: '   ' }),
    ]
    const s = summarizeLog(entries, resolved({ group: piece }))
    // O rótulo é o texto aparado da 1ª ocorrência cronológica ("  Bach " em 11-10);
    // empate de sessões desempata pelo rótulo.
    expect(s.groups.map((g) => [g.key, g.label, g.sessions])).toEqual([
      ['bach', 'Bach', 2],
      ['bách', 'Bách', 1],
      [LOG_NO_VALUE_KEY, 'No value', 1],
    ])
  })

  it('soma e tendência por grupo usam só as entradas do grupo', () => {
    const piece = def({ type: 'text' })
    const minutes = def({ type: 'number' })
    const bpm = def({ type: 'number' })
    const entries = [
      entry('2026-11-18', { [piece.id]: 'Bach', [minutes.id]: 20, [bpm.id]: 90 }),
      entry('2026-11-10', { [piece.id]: 'Bach', [minutes.id]: 10, [bpm.id]: 70 }),
      entry('2026-11-12', { [piece.id]: 'Chopin', [minutes.id]: 5, [bpm.id]: 60 }),
    ]
    const s = summarizeLog(entries, resolved({ group: piece, sum: minutes, trend: bpm }))
    expect(s.sum).toBe(35)
    expect(s.trend).toEqual({ first: 70, last: 90, points: [70, 60, 90] })
    const bach = s.groups.find((g) => g.label === 'Bach')
    expect(bach?.sum).toBe(30)
    expect(bach?.trend).toEqual({ first: 70, last: 90, points: [70, 90] })
    const chopin = s.groups.find((g) => g.label === 'Chopin')
    expect(chopin?.trend).toEqual({ first: 60, last: 60, points: [60] })
  })
})

describe('practiceSaveChanges', () => {
  // Aplica o plano ao estado, como quem grava e relê.
  function apply(types: NoteType[], defs: MetadataDef[], plan: ReturnType<typeof practiceSaveChanges>) {
    return {
      types: [...types.filter((t) => t.id !== plan.type.id), plan.type],
      defs: [...defs, ...plan.newDefs],
    }
  }

  it('cria o tipo com as quatro propriedades e o Log ligado', () => {
    const others = [noteType({ sortOrder: 4 }), noteType({ sortOrder: 7 })]
    const plan = practiceSaveChanges(others, [])
    expect(plan.newType).toBe(true)
    expect(plan.typeChanged).toBe(true)
    expect(plan.warnings).toEqual([])
    expect(plan.type).toMatchObject({ name: 'Practice', icon: 'music', builtin: false, sortOrder: 8, board: null })
    expect(plan.newDefs.map((d) => [d.name, d.type, d.showInList, d.noteTypeId, d.scope])).toEqual([
      ['Piece', 'text', true, plan.type.id, 'note'],
      ['Minutes', 'number', true, plan.type.id, 'note'],
      ['BPM', 'number', true, plan.type.id, 'note'],
      ['Focus', 'text', false, plan.type.id, 'note'],
    ])
    const [piece, minutes, bpm] = plan.newDefs
    expect(plan.type.log).toEqual({ sumDefId: minutes.id, trendDefId: bpm.id, groupDefId: piece.id })
    expect(plan.newDefs.map((d) => d.sortOrder)).toEqual([1, 2, 3, 4])
  })

  it('reaproveita o tipo existente e só acrescenta o que falta', () => {
    const type = noteType({ id: TYPE_ID, name: ' practice ', sortOrder: 2 })
    // Mesmo nome sem caixa; Minutes já existe.
    const minutes = def({ name: 'minutes', type: 'number', sortOrder: 5, showInList: true })
    const plan = practiceSaveChanges([type], [minutes])
    expect(plan.newType).toBe(false)
    expect(plan.typeChanged).toBe(true)
    expect(plan.type.id).toBe(TYPE_ID)
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Piece', 'BPM', 'Focus'])
    expect(plan.newDefs.map((d) => d.sortOrder)).toEqual([6, 7, 8])
    // Com Minutes já listada, Piece e BPM completam as três.
    expect(plan.newDefs.map((d) => d.showInList)).toEqual([true, true, false])
    expect(plan.type.log?.sumDefId).toBe(minutes.id)
  })

  it('respeita o limite de propriedades na lista', () => {
    const type = noteType({ id: TYPE_ID, name: 'Practice' })
    const listed = [def({ showInList: true }), def({ showInList: true })]
    const plan = practiceSaveChanges([type], listed)
    expect(plan.newDefs.map((d) => [d.name, d.showInList])).toEqual([
      ['Piece', true],
      ['Minutes', false],
      ['BPM', false],
      ['Focus', false],
    ])
  })

  it('Minutes existente como text: não recria, o Log fica sem soma e há um aviso', () => {
    const type = noteType({ id: TYPE_ID, name: 'Practice' })
    const minutes = def({ name: 'Minutes', type: 'text' })
    const plan = practiceSaveChanges([type], [minutes])
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Piece', 'BPM', 'Focus'])
    expect(plan.type.log?.sumDefId).toBeNull()
    expect(plan.type.log?.trendDefId).not.toBeNull()
    expect(plan.warnings).toEqual([
      'The "Practice" type already has "Minutes" as Text, so the log can\'t use it. Change it in Note types.',
    ])
  })

  it('Piece existente como select serve de grupo', () => {
    const type = noteType({ id: TYPE_ID, name: 'Practice' })
    const piece = def({ name: 'Piece', type: 'select', options: [] })
    const plan = practiceSaveChanges([type], [piece])
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Minutes', 'BPM', 'Focus'])
    expect(plan.type.log?.groupDefId).toBe(piece.id)
    expect(plan.warnings).toEqual([])
  })

  it('preserva o Log que o tipo já tem', () => {
    const log: NoteLogConfig = { sumDefId: 'x', trendDefId: null, groupDefId: null }
    const type = noteType({ id: TYPE_ID, name: 'Practice', log })
    const plan = practiceSaveChanges([type], [])
    expect(plan.typeChanged).toBe(false)
    expect(plan.type).toBe(type)
    expect(plan.type.log).toBe(log)
    // As propriedades que faltam continuam sendo criadas.
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Piece', 'Minutes', 'BPM', 'Focus'])
  })

  it('ignora tipo embutido chamado Practice', () => {
    const builtin = noteType({ id: 'embutido', name: 'Practice', builtin: true })
    const plan = practiceSaveChanges([builtin], [])
    expect(plan.newType).toBe(true)
    expect(plan.type.id).not.toBe('embutido')
  })

  it('é idempotente: a 2ª chamada sobre o resultado da 1ª não cria nem muda nada', () => {
    const first = practiceSaveChanges([noteType()], [])
    const state = apply([], [], first)
    const second = practiceSaveChanges(state.types, state.defs)
    expect(second.newType).toBe(false)
    expect(second.typeChanged).toBe(false)
    expect(second.newDefs).toEqual([])
    expect(second.warnings).toEqual([])
    expect(second.type).toBe(first.type)
  })
})

describe('practiceSetupMessage', () => {
  it('tipo novo: diz o que foi criado, com as propriedades e o Log', () => {
    expect(practiceSetupMessage(practiceSaveChanges([], []))).toBe(
      'Created the Practice type (Piece, Minutes, BPM, Focus) with a log.'
    )
  })

  it('tipo novo sem propriedade criada: omite os parênteses', () => {
    expect(practiceSetupMessage({ newType: true, typeChanged: true, newDefs: [] })).toBe(
      'Created the Practice type with a log.'
    )
  })

  it('tipo existente: diz o que foi acrescentado e que o Log foi ligado', () => {
    const type = noteType({ id: TYPE_ID, name: 'Practice' })
    const minutes = def({ name: 'Minutes', type: 'number' })
    expect(practiceSetupMessage(practiceSaveChanges([type], [minutes]))).toBe(
      'Updated the Practice type: added Piece, BPM, Focus; turned on its log.'
    )
  })

  it('tipo existente com o Log: só as propriedades que faltavam', () => {
    const log: NoteLogConfig = { sumDefId: 'x', trendDefId: null, groupDefId: null }
    const type = noteType({ id: TYPE_ID, name: 'Practice', log })
    expect(practiceSetupMessage(practiceSaveChanges([type], []))).toBe(
      'Updated the Practice type: added Piece, Minutes, BPM, Focus.'
    )
  })

  it('nada a fazer: diz que o tipo já estava pronto', () => {
    const first = practiceSaveChanges([], [])
    const second = practiceSaveChanges([first.type], first.newDefs)
    expect(practiceSetupMessage(second)).toBe('The Practice type was already set up.')
  })
})
