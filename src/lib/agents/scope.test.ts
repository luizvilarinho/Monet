import { describe, expect, it } from 'vitest'
import type { Notebook, NoteType } from '../../types'
import {
  explicitBoardIn,
  explicitScopeIn,
  explicitTagIn,
  mentionsAll,
  resolveAgentScope,
  resolveNotebookScope,
  scopeKey,
  scopeLabel,
  type AgentScope,
  type ScopeContext,
} from './scope'

// Resolução de escopo dos agentes. A parte do caderno veio do tutor e não pode
// mudar de comportamento (paridade); tag, board e "tudo" são novos.

function notebook(id: string, name: string): Notebook {
  return { id, name, createdAt: 0, updatedAt: 0 }
}

function boardType(id: string, name: string): NoteType {
  return {
    id,
    name,
    icon: null,
    color: null,
    template: null,
    sortOrder: 0,
    builtin: false,
    createdAt: 0,
    board: { columnDefId: 'd1', sectionDefId: null, cardDefIds: [], showTags: true, hideEmpty: false, filterDefId: null },
    log: null,
  }
}

const PHYSICS = notebook('nb1', 'Physics')
const ML = notebook('nb2', 'Machine Learning')
const CALENDAR = notebook('calendar', 'Calendar')
const NOTEBOOKS = [PHYSICS, ML, CALENDAR]

const PAPER = boardType('t1', 'Paper')
const PROJECTS = boardType('t2', 'Project Ideas')

const CTX: ScopeContext = { notebooks: NOTEBOOKS, tags: ['Rust', 'machine learning', 'Física'], boardTypes: [PAPER, PROJECTS] }

function input(over: { notebookId?: string | null; folderName?: string | null; messages?: string[] } = {}) {
  return { notebookId: over.notebookId ?? null, folderName: over.folderName ?? null, userMessages: over.messages ?? [''] }
}

describe('resolveNotebookScope (paridade do tutor)', () => {
  it('usa o caderno vinculado à pasta', () => {
    const r = resolveNotebookScope(input({ notebookId: 'nb1', messages: ['how am I doing?'] }), NOTEBOOKS)
    expect(r).toEqual({ notebook: PHYSICS, source: 'folder' })
  })

  it('usa o nome "Notebook - X" quando não há vínculo', () => {
    const r = resolveNotebookScope(input({ folderName: 'Notebook - Machine Learning', messages: ['hi'] }), NOTEBOOKS)
    expect(r).toEqual({ notebook: ML, source: 'folderName' })
  })

  it('o vínculo vence o nome da pasta', () => {
    const r = resolveNotebookScope(input({ notebookId: 'nb1', folderName: 'Notebook - Machine Learning' }), NOTEBOOKS)
    expect(r?.notebook.id).toBe('nb1')
  })

  it('caderno explícito na última mensagem vence a pasta', () => {
    const r = resolveNotebookScope(
      input({ notebookId: 'nb1', messages: ['now review the notebook "Machine Learning"'] }),
      NOTEBOOKS
    )
    expect(r).toEqual({ notebook: ML, source: 'message' })
  })

  it('o explícito igual ao da pasta continua "folder"', () => {
    const r = resolveNotebookScope(input({ notebookId: 'nb1', messages: ['review caderno Physics'] }), NOTEBOOKS)
    expect(r).toEqual({ notebook: PHYSICS, source: 'folder' })
  })

  it('citação solta do nome numa mensagem não vence a pasta', () => {
    const r = resolveNotebookScope(input({ notebookId: 'nb1', messages: ['compare with machine learning'] }), NOTEBOOKS)
    expect(r?.notebook.id).toBe('nb1')
  })

  it('namedIn numa mensagem antiga define o caderno quando não há pasta', () => {
    const r = resolveNotebookScope(input({ messages: ['and the next topic?', 'how is my physics study going'] }), NOTEBOOKS)
    expect(r).toEqual({ notebook: PHYSICS, source: 'message' })
  })

  it('o nome mais longo ganha', () => {
    const long = notebook('nb3', 'Physics Lab')
    const r = resolveNotebookScope(input({ messages: ['review physics lab'] }), [PHYSICS, long])
    expect(r?.notebook.id).toBe('nb3')
  })

  it('o Calendar fica fora, também pelo vínculo', () => {
    expect(resolveNotebookScope(input({ messages: ['review calendar'] }), NOTEBOOKS)).toBeNull()
    expect(resolveNotebookScope(input({ notebookId: 'calendar', messages: ['hi'] }), NOTEBOOKS)).toBeNull()
  })

  it('sem nada, devolve null', () => {
    expect(resolveNotebookScope(input({ messages: ['hello'] }), NOTEBOOKS)).toBeNull()
  })
})

describe('explicitTagIn', () => {
  const tags = CTX.tags

  it('#tag no texto, no fim ou antes de pontuação', () => {
    expect(explicitTagIn('news about #rust', tags)).toBe('Rust')
    expect(explicitTagIn('news about #Rust?', tags)).toBe('Rust')
    expect(explicitTagIn('#rust, please', tags)).toBe('Rust')
  })

  it('#tag não casa com um prefixo de outra palavra', () => {
    expect(explicitTagIn('news about #rustacean', tags)).toBeNull()
  })

  it('ignora acento e caixa', () => {
    expect(explicitTagIn('what about #fisica', tags)).toBe('Física')
    expect(explicitTagIn('the tag FISICA', tags)).toBe('Física')
  })

  it('"tag X" com as palavras de tag', () => {
    expect(explicitTagIn('everything on tag rust', tags)).toBe('Rust')
    expect(explicitTagIn('notes com a tag rust', tags)).toBe('Rust')
    expect(explicitTagIn('in the tag machine learning', tags)).toBe('machine learning')
  })

  it('tag entre aspas', () => {
    expect(explicitTagIn('news on "rust"', tags)).toBe('Rust')
  })

  it('o nome solto, sem # nem "tag", não conta', () => {
    expect(explicitTagIn('news about rust', tags)).toBeNull()
  })

  it('com várias, a de nome mais longo ganha', () => {
    expect(explicitTagIn('#rust and #rust web', ['rust', 'rust web'])).toBe('rust web')
  })
})

describe('explicitBoardIn', () => {
  const types = CTX.boardTypes

  it('"board X" e "o board X"', () => {
    expect(explicitBoardIn('what is new on the board paper', types)).toBe(PAPER)
    expect(explicitBoardIn('o board project ideas', types)).toBe(PROJECTS)
  })

  it('"X board" e o nome entre aspas', () => {
    expect(explicitBoardIn('the paper board', types)).toBe(PAPER)
    expect(explicitBoardIn('news for "Paper"', types)).toBe(PAPER)
  })

  it('o nome solto não conta', () => {
    expect(explicitBoardIn('find a paper about graphs', types)).toBeNull()
  })
})

describe('mentionsAll', () => {
  it('reconhece as palavras de "tudo" em inglês e em português', () => {
    expect(mentionsAll('what is new in everything I follow')).toBe(true)
    expect(mentionsAll('novidades de tudo')).toBe(true)
    expect(mentionsAll('todos os cadernos')).toBe(true)
    expect(mentionsAll('across all my notebooks')).toBe(true)
  })

  it('só palavras inteiras', () => {
    expect(mentionsAll('tudoo')).toBe(false)
    expect(mentionsAll('what is new in rust')).toBe(false)
  })
})

describe('explicitScopeIn', () => {
  it('precedência: caderno, board, tag e tudo', () => {
    const all = 'notebook "Physics" board Paper #rust everything'
    expect(explicitScopeIn(all, CTX)).toMatchObject({ kind: 'notebook', source: 'message' })
    expect(explicitScopeIn('board Paper #rust everything', CTX)).toEqual({ kind: 'board', type: PAPER })
    expect(explicitScopeIn('#rust everything', CTX)).toEqual({ kind: 'tag', tag: 'Rust' })
    expect(explicitScopeIn('everything', CTX)).toEqual({ kind: 'all', source: 'message' })
  })

  it('devolve null quando a mensagem não diz o escopo', () => {
    expect(explicitScopeIn('what is new?', CTX)).toBeNull()
  })

  it('o Calendar não é caderno de escopo', () => {
    expect(explicitScopeIn('notebook "Calendar"', CTX)).toBeNull()
  })
})

describe('resolveAgentScope', () => {
  it('sem pasta nem citação, o padrão é tudo', () => {
    expect(resolveAgentScope(input({ messages: ['what is new?'] }), CTX)).toEqual({ kind: 'all', source: 'default' })
  })

  it('o caderno da pasta é o escopo', () => {
    expect(resolveAgentScope(input({ notebookId: 'nb1', messages: ['what is new?'] }), CTX)).toEqual({
      kind: 'notebook',
      notebook: PHYSICS,
      source: 'folder',
    })
    expect(
      resolveAgentScope(input({ folderName: 'Notebook - Machine Learning', messages: ['what is new?'] }), CTX)
    ).toMatchObject({ kind: 'notebook', source: 'folderName' })
  })

  it('o escopo explícito da mensagem mais nova vence a pasta', () => {
    const folder = { notebookId: 'nb1' }
    expect(resolveAgentScope(input({ ...folder, messages: ['news about #rust'] }), CTX)).toEqual({ kind: 'tag', tag: 'Rust' })
    expect(resolveAgentScope(input({ ...folder, messages: ['the board Paper'] }), CTX)).toEqual({ kind: 'board', type: PAPER })
    expect(resolveAgentScope(input({ ...folder, messages: ['notebook "Machine Learning"'] }), CTX)).toEqual({
      kind: 'notebook',
      notebook: ML,
      source: 'message',
    })
    expect(resolveAgentScope(input({ ...folder, messages: ['everything'] }), CTX)).toEqual({ kind: 'all', source: 'message' })
  })

  it('o caderno explícito igual ao da pasta continua "folder"', () => {
    expect(resolveAgentScope(input({ notebookId: 'nb1', messages: ['notebook Physics'] }), CTX)).toMatchObject({
      kind: 'notebook',
      source: 'folder',
    })
  })

  it('escopo explícito numa mensagem antiga não vence a pasta', () => {
    const r = resolveAgentScope(input({ notebookId: 'nb1', messages: ['and now?', 'news about #rust'] }), CTX)
    expect(r).toMatchObject({ kind: 'notebook', source: 'folder' })
  })

  it('sem pasta, vale o escopo explícito de uma mensagem antiga', () => {
    expect(resolveAgentScope(input({ messages: ['and now?', 'news about #rust'] }), CTX)).toEqual({ kind: 'tag', tag: 'Rust' })
  })

  it('sem pasta, o caderno citado de forma solta numa mensagem antiga serve', () => {
    expect(resolveAgentScope(input({ messages: ['and now?', 'how is my physics study'] }), CTX)).toEqual({
      kind: 'notebook',
      notebook: PHYSICS,
      source: 'message',
    })
  })

  it('o Calendar fica fora do escopo', () => {
    expect(resolveAgentScope(input({ notebookId: 'calendar', messages: ['hi'] }), CTX)).toEqual({ kind: 'all', source: 'default' })
  })

  it('sem tipos com board (Papers), "board X" não vira escopo', () => {
    const ctx = { ...CTX, boardTypes: [] }
    expect(resolveAgentScope(input({ messages: ['the board Paper'] }), ctx)).toEqual({ kind: 'all', source: 'default' })
  })
})

describe('scopeKey e scopeLabel', () => {
  const scopes: Array<[AgentScope, string, string]> = [
    [{ kind: 'notebook', notebook: PHYSICS, source: 'folder' }, 'notebook:nb1', 'notebook "Physics"'],
    [{ kind: 'tag', tag: 'Física' }, 'tag:fisica', 'tag #Física'],
    [{ kind: 'board', type: PAPER }, 'board:t1', 'board "Paper"'],
    [{ kind: 'all', source: 'default' }, 'all', 'all notebooks'],
  ]

  it.each(scopes)('%j', (scope, key, label) => {
    expect(scopeKey(scope)).toBe(key)
    expect(scopeLabel(scope)).toBe(label)
  })

  it('a chave da tag ignora caixa, acento e espaço repetido', () => {
    expect(scopeKey({ kind: 'tag', tag: 'Machine   Learning' })).toBe(scopeKey({ kind: 'tag', tag: 'machine learning' }))
  })

  it('"tudo" explícito e padrão têm a mesma chave', () => {
    expect(scopeKey({ kind: 'all', source: 'message' })).toBe(scopeKey({ kind: 'all', source: 'default' }))
  })
})
