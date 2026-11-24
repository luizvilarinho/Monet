import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  groupNotesByType,
  isGroupCollapsed,
  isNearGroup,
  loadGroupByType,
  loadGroupCollapsed,
  loadNoteSort,
  NO_TYPE_GROUP,
  parseGroupByType,
  parseGroupCollapsed,
  parseNoteSort,
  reorderWithinGroup,
  saveGroupByType,
  saveGroupCollapsed,
  saveNoteSort,
  setGroupCollapsed,
  setGroupsCollapsed,
  sortNotes,
} from './noteOrder'

// Agrupamento da lista de notas por tipo (R1, R4, R8, R9, R10): montagem dos
// grupos, ordem dentro deles, estado aberto/fechado e migração da ordem "By
// type" (`type`) salva por versões anteriores.

interface N {
  id: string
  title: string
  typeId?: string | null
}

const note = (id: string, typeId: string | null = null, title = id): N => ({ id, title, typeId })

describe('parseNoteSort', () => {
  it('lê as ordens que existem', () => {
    expect(parseNoteSort('manual')).toBe('manual')
    expect(parseNoteSort('alpha')).toBe('alpha')
  })

  it('lê o antigo "type" como alpha (o agrupamento nasce ligado)', () => {
    expect(parseNoteSort('type')).toBe('alpha')
    expect(parseGroupByType(null)).toBe(true)
  })

  it('valor ausente ou inválido volta para manual', () => {
    expect(parseNoteSort(null)).toBe('manual')
    expect(parseNoteSort('')).toBe('manual')
    expect(parseNoteSort('qualquer coisa')).toBe('manual')
  })
})

describe('parseGroupByType', () => {
  it('liga por padrão: só "0" desliga', () => {
    expect(parseGroupByType(null)).toBe(true)
    expect(parseGroupByType('1')).toBe(true)
    expect(parseGroupByType('lixo')).toBe(true)
    expect(parseGroupByType('0')).toBe(false)
  })
})

describe('sortNotes', () => {
  const notes = [note('1', null, 'banana'), note('2', null, 'Ábaco'), note('3', null, ''), note('4', null, 'cereja')]

  it('manual devolve a lista como veio', () => {
    expect(sortNotes(notes, 'manual')).toBe(notes)
  })

  it('alpha ordena A–Z sem caixa nem acento, sem título como "untitled"', () => {
    expect(sortNotes(notes, 'alpha').map((n) => n.id)).toEqual(['2', '1', '4', '3'])
  })

  it('alpha não altera a lista original', () => {
    sortNotes(notes, 'alpha')
    expect(notes.map((n) => n.id)).toEqual(['1', '2', '3', '4'])
  })
})

describe('groupNotesByType', () => {
  const typeOrder = ['todos', 'paper', 'idea']

  it('um grupo por tipo presente, na ordem dos tipos, e "sem tipo" por último', () => {
    const groups = groupNotesByType(
      [note('a', 'idea'), note('b'), note('c', 'todos'), note('d', 'idea'), note('e', 'paper')],
      typeOrder
    )
    expect(groups?.map((g) => g.key)).toEqual(['todos', 'paper', 'idea', NO_TYPE_GROUP])
    expect(groups?.map((g) => g.typeId)).toEqual(['todos', 'paper', 'idea', null])
  })

  it('mantém a ordem recebida dentro de cada grupo', () => {
    const groups = groupNotesByType(
      [note('a', 'idea'), note('b', 'todos'), note('c', 'idea'), note('d', 'todos'), note('e')],
      typeOrder
    )
    expect(groups?.find((g) => g.key === 'idea')?.notes.map((n) => n.id)).toEqual(['a', 'c'])
    expect(groups?.find((g) => g.key === 'todos')?.notes.map((n) => n.id)).toEqual(['b', 'd'])
  })

  it('tipo apagado (fora de typeOrder) vai para "sem tipo"', () => {
    const groups = groupNotesByType([note('a', 'todos'), note('b', 'apagado')], typeOrder)
    expect(groups?.map((g) => g.key)).toEqual(['todos', NO_TYPE_GROUP])
    expect(groups?.[1].notes.map((n) => n.id)).toEqual(['b'])
  })

  it('um único tipo e nenhuma nota sem tipo: um grupo só', () => {
    const groups = groupNotesByType([note('a', 'paper'), note('b', 'paper')], typeOrder)
    expect(groups).toHaveLength(1)
    expect(groups?.[0].key).toBe('paper')
  })

  it('sem nota "sem tipo", não cria o grupo "sem tipo"', () => {
    const groups = groupNotesByType([note('a', 'paper')], typeOrder)
    expect(groups?.some((g) => g.key === NO_TYPE_GROUP)).toBe(false)
  })

  it('devolve null (lista plana) sem nenhuma nota de tipo existente', () => {
    expect(groupNotesByType([note('a'), note('b', null)], typeOrder)).toBeNull()
    expect(groupNotesByType([note('a', 'apagado')], typeOrder)).toBeNull()
    expect(groupNotesByType([], typeOrder)).toBeNull()
    expect(groupNotesByType([note('a', 'todos')], [])).toBeNull()
  })
})

// Arrasto na ordem Manual (R10): reordena só dentro do grupo da nota arrastada.
describe('reorderWithinGroup', () => {
  const typeOrder = ['todos', 'idea']
  // Lista visível agrupada: A = idea [a1, a2, a3], B = todos [b1, b2].
  const visible = [note('a1', 'idea'), note('a2', 'idea'), note('a3', 'idea'), note('b1', 'todos'), note('b2', 'todos')]
  const sections = groupNotesByType(visible, typeOrder) ?? []
  const visibleIds = visible.map((n) => n.id)

  it('dentro do grupo: a nota ocupa o lugar do alvo e o outro grupo não se mexe', () => {
    expect(reorderWithinGroup(sections, visibleIds, 'a1', 'a3')).toEqual(['a2', 'a3', 'a1', 'b1', 'b2'])
    expect(reorderWithinGroup(sections, visibleIds, 'a3', 'a1')).toEqual(['a3', 'a1', 'a2', 'b1', 'b2'])
    expect(reorderWithinGroup(sections, visibleIds, 'b2', 'b1')).toEqual(['a1', 'a2', 'a3', 'b2', 'b1'])
  })

  it('alvo de outro grupo: não faz nada (null)', () => {
    expect(reorderWithinGroup(sections, visibleIds, 'a1', 'b2')).toBeNull()
    expect(reorderWithinGroup(sections, visibleIds, 'b1', 'a2')).toBeNull()
  })

  it('mesma nota, nota arrastada fora da lista ou alvo desconhecido: null', () => {
    expect(reorderWithinGroup(sections, visibleIds, 'a1', 'a1')).toBeNull()
    expect(reorderWithinGroup(sections, visibleIds, 'fantasma', 'a1')).toBeNull()
    expect(reorderWithinGroup(sections, visibleIds, 'a1', 'fantasma')).toBeNull()
  })

  it('lista plana (uma seção só): qualquer nota vai para o lugar de qualquer outra', () => {
    const flat = [{ notes: visible }]
    expect(reorderWithinGroup(flat, visibleIds, 'a1', 'b2')).toEqual(['a2', 'a3', 'b1', 'b2', 'a1'])
    expect(reorderWithinGroup(flat, visibleIds, 'b2', 'a1')).toEqual(['b2', 'a1', 'a2', 'a3', 'b1'])
  })

  it('grupo fechado no meio: as notas dele e as de fora mantêm a posição', () => {
    // Ordem manual com tipos intercalados; o grupo "todos" (t1) está fechado na
    // tela, mas continua na lista visível, e uma nota sem tipo fica no meio.
    const mixed = [note('a1', 'idea'), note('t1', 'todos'), note('a2', 'idea'), note('x'), note('a3', 'idea')]
    const groups = groupNotesByType(mixed, typeOrder) ?? []
    expect(groups.map((g) => g.key)).toEqual(['todos', 'idea', NO_TYPE_GROUP])
    // a3 solta no lugar de a1: só os lugares do grupo idea trocam de dono.
    expect(reorderWithinGroup(groups, mixed.map((n) => n.id), 'a3', 'a1')).toEqual(['a3', 't1', 'a1', 'x', 'a2'])
  })
})

// Arrasto na ordem Manual: "grudar" perto do grupo, sem alvo no meio de outro.
describe('isNearGroup', () => {
  // Itens de 34px empilhados: a1 0–34, a2 34–68, a3 68–102 (extensão do grupo
  // 0–102); o outro grupo vem logo abaixo (b1 106–140). Tolerância: uma linha (34).
  const rect = (top: number, bottom: number) => ({ top, bottom })
  const rects = new Map([
    ['a1', rect(0, 34)],
    ['a2', rect(34, 68)],
    ['a3', rect(68, 102)],
    ['b1', rect(106, 140)],
    ['b2', rect(140, 174)],
  ])
  const group = ['a1', 'a2', 'a3']

  it('ponto dentro do grupo: perto', () => {
    expect(isNearGroup(group, rects, 50, 34)).toBe(true)
    expect(isNearGroup(group, rects, 0, 34)).toBe(true)
    expect(isNearGroup(group, rects, 102, 34)).toBe(true)
  })

  it('ponto dentro da tolerância, abaixo e acima do grupo: perto (as bordas contam)', () => {
    expect(isNearGroup(group, rects, 120, 34)).toBe(true)
    expect(isNearGroup(group, rects, 136, 34)).toBe(true)
    expect(isNearGroup(group, rects, -20, 34)).toBe(true)
    expect(isNearGroup(group, rects, -34, 34)).toBe(true)
  })

  it('ponto além da tolerância, no meio do outro grupo: longe', () => {
    expect(isNearGroup(group, rects, 137, 34)).toBe(false)
    expect(isNearGroup(group, rects, 160, 34)).toBe(false)
    expect(isNearGroup(group, rects, -35, 34)).toBe(false)
    // O grupo de baixo, medido do mesmo jeito, vê o ponto 50 como longe.
    expect(isNearGroup(['b1', 'b2'], rects, 50, 34)).toBe(false)
    expect(isNearGroup(['b1', 'b2'], rects, 160, 34)).toBe(true)
  })

  it('a tolerância é a que vem de fora', () => {
    expect(isNearGroup(group, rects, 160, 34)).toBe(false)
    expect(isNearGroup(group, rects, 160, 60)).toBe(true)
    expect(isNearGroup(group, rects, 120, 0)).toBe(false)
  })

  it('lado aberto (ponta da lista): sem limite só daquele lado', () => {
    // Primeiro grupo: acima dele não há outro grupo; abaixo, a tolerância vale.
    expect(isNearGroup(group, rects, -500, 34, { above: true })).toBe(true)
    expect(isNearGroup(group, rects, 160, 34, { above: true })).toBe(false)
    // Último grupo: abaixo dele não há outro grupo; acima, a tolerância vale.
    expect(isNearGroup(['b1', 'b2'], rects, 900, 34, { below: true })).toBe(true)
    expect(isNearGroup(['b1', 'b2'], rects, 50, 34, { below: true })).toBe(false)
  })

  it('retângulo faltando ou grupo vazio: perto (cai no grupo, nunca em "sem alvo")', () => {
    const missing = new Map(rects)
    missing.delete('a2')
    expect(isNearGroup(group, missing, 500, 34)).toBe(true)
    expect(isNearGroup(group, new Map(), 500, 34)).toBe(true)
    expect(isNearGroup([], rects, 500, 34)).toBe(true)
  })
})

describe('estado aberto/fechado dos grupos', () => {
  it('parse: ausente, JSON inválido ou forma errada dão estado vazio', () => {
    expect(parseGroupCollapsed(null)).toEqual({})
    expect(parseGroupCollapsed('')).toEqual({})
    expect(parseGroupCollapsed('{não é json')).toEqual({})
    expect(parseGroupCollapsed('[1,2]')).toEqual({})
    expect(parseGroupCollapsed('"texto"')).toEqual({})
    expect(parseGroupCollapsed('null')).toEqual({})
  })

  it('parse: ignora escopos que não são lista e entradas que não são texto', () => {
    expect(parseGroupCollapsed('{"nb1":["todos",3,null,"idea"],"nb2":"x","nb3":{"a":1}}')).toEqual({
      nb1: ['todos', 'idea'],
    })
  })

  it('grupo fora da lista está aberto (grupo novo nasce aberto)', () => {
    expect(isGroupCollapsed({}, 'nb1', 'todos')).toBe(false)
    expect(isGroupCollapsed({ nb1: ['idea'] }, 'nb1', 'todos')).toBe(false)
  })

  it('fecha e abre sem alterar o estado anterior', () => {
    const start = { nb1: ['idea'] }
    const closed = setGroupCollapsed(start, 'nb1', 'todos', true)
    expect(closed).toEqual({ nb1: ['idea', 'todos'] })
    expect(start).toEqual({ nb1: ['idea'] })
    expect(isGroupCollapsed(closed, 'nb1', 'todos')).toBe(true)
    const reopened = setGroupCollapsed(closed, 'nb1', 'todos', false)
    expect(reopened).toEqual({ nb1: ['idea'] })
  })

  it('fechar duas vezes não duplica; abrir o último tira o escopo', () => {
    const once = setGroupCollapsed({}, 'nb1', 'todos', true)
    expect(setGroupCollapsed(once, 'nb1', 'todos', true)).toEqual({ nb1: ['todos'] })
    expect(setGroupCollapsed(once, 'nb1', 'todos', false)).toEqual({})
  })

  it('fechar todos: fecha as chaves dadas, sem duplicar as que já estavam fechadas', () => {
    const start = { nb1: ['idea'] }
    const closed = setGroupsCollapsed(start, 'nb1', ['todos', 'idea', 'paper'], true)
    expect([...(closed.nb1 ?? [])].sort()).toEqual(['idea', 'paper', 'todos'])
    expect(start).toEqual({ nb1: ['idea'] })
    for (const key of ['todos', 'idea', 'paper']) expect(isGroupCollapsed(closed, 'nb1', key)).toBe(true)
  })

  it('abrir todos: abre as chaves dadas e tira o escopo quando nada fica fechado', () => {
    const start = { nb1: ['todos', 'idea'], nb2: ['todos'] }
    const opened = setGroupsCollapsed(start, 'nb1', ['todos', 'idea', 'paper'], false)
    expect(opened).toEqual({ nb2: ['todos'] })
    expect(start.nb1).toEqual(['todos', 'idea'])
  })

  it('fechar e abrir todos só valem para as chaves dadas e para o escopo dado', () => {
    // "paper" está fechado mas não está na lista de agora (outro filtro): fica como está.
    const state = { nb1: ['paper'], nb2: ['todos'], 'all-notes': ['idea'] }
    const closed = setGroupsCollapsed(state, 'nb1', ['todos', 'idea'], true)
    expect([...(closed.nb1 ?? [])].sort()).toEqual(['idea', 'paper', 'todos'])
    expect(closed.nb2).toEqual(['todos'])
    expect(closed['all-notes']).toEqual(['idea'])
    const opened = setGroupsCollapsed(closed, 'nb1', ['todos', 'idea'], false)
    expect(opened.nb1).toEqual(['paper'])
    expect(opened.nb2).toEqual(['todos'])
  })

  it('sem chaves, o estado não muda', () => {
    const state = { nb1: ['todos'] }
    expect(setGroupsCollapsed(state, 'nb1', [], true)).toEqual(state)
    expect(setGroupsCollapsed(state, 'nb1', [], false)).toEqual(state)
    expect(setGroupsCollapsed({}, 'nb1', [], true)).toEqual({})
  })

  it('cada caderno tem o seu estado, e "All notes" o dele', () => {
    const state = setGroupCollapsed(setGroupCollapsed({}, 'nb1', 'todos', true), 'all-notes', 'idea', true)
    expect(isGroupCollapsed(state, 'nb1', 'todos')).toBe(true)
    expect(isGroupCollapsed(state, 'nb2', 'todos')).toBe(false)
    expect(isGroupCollapsed(state, 'all-notes', 'todos')).toBe(false)
    expect(isGroupCollapsed(state, 'all-notes', 'idea')).toBe(true)
  })

  it('entradas órfãs (tipo ou caderno apagado) não quebram nada', () => {
    const state = parseGroupCollapsed('{"nb-apagado":["tipo-apagado"],"nb1":["tipo-apagado","todos"]}')
    expect(isGroupCollapsed(state, 'nb1', 'todos')).toBe(true)
    expect(isGroupCollapsed(state, 'nb1', 'paper')).toBe(false)
    expect(setGroupCollapsed(state, 'nb1', 'todos', false).nb1).toEqual(['tipo-apagado'])
  })
})

describe('persistência em localStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('o estado dos grupos sobrevive à releitura', () => {
    const state = setGroupCollapsed({}, 'nb1', 'todos', true)
    saveGroupCollapsed(state)
    expect(loadGroupCollapsed()).toEqual(state)
  })

  it('o agrupamento e a ordem sobrevivem à releitura', () => {
    saveGroupByType(false)
    saveNoteSort('alpha')
    expect(loadGroupByType()).toBe(false)
    expect(loadNoteSort()).toBe('alpha')
    saveGroupByType(true)
    expect(loadGroupByType()).toBe(true)
  })

  it('o antigo "type" salvo vale alpha com o agrupamento ligado', () => {
    localStorage.setItem('monet:note-sort', 'type')
    expect(loadNoteSort()).toBe('alpha')
    expect(loadGroupByType()).toBe(true)
  })

  it('localStorage com valor inválido: tudo aberto, agrupamento ligado, sem erro', () => {
    localStorage.setItem('monet:note-groups-collapsed', '{lixo')
    localStorage.setItem('monet:note-group-by-type', 'talvez')
    localStorage.setItem('monet:note-sort', 'xyz')
    expect(loadGroupCollapsed()).toEqual({})
    expect(loadGroupByType()).toBe(true)
    expect(loadNoteSort()).toBe('manual')
  })

  it('localStorage indisponível: leituras voltam ao padrão e gravações não lançam', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('indisponível')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('indisponível')
    })
    expect(loadGroupCollapsed()).toEqual({})
    expect(loadGroupByType()).toBe(true)
    expect(loadNoteSort()).toBe('manual')
    expect(() => saveGroupCollapsed({ nb1: ['todos'] })).not.toThrow()
    expect(() => saveGroupByType(false)).not.toThrow()
    expect(() => saveNoteSort('alpha')).not.toThrow()
  })
})
