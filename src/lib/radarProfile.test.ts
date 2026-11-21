import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { tasksSubjectId } from './tasks'
import {
  extractRadarProfileDraft,
  findRadarProfile,
  isRadarProfileNote,
  radarFollowTerms,
  radarIgnoreText,
  radarSourcesText,
  RADAR_PROFILE_TAG,
} from './radarProfile'

let seq = 0
function note(patch: Partial<Note> = {}): Note {
  seq++
  return {
    id: `n${seq}`,
    notebookId: 'nb1',
    title: `Note ${seq}`,
    content: '',
    tags: [],
    createdAt: 0,
    updatedAt: seq,
    ...patch,
  }
}

describe('isRadarProfileNote', () => {
  it('reconhece a tag, em inglês e em português, sem caixa nem acento', () => {
    expect(isRadarProfileNote(note({ tags: [RADAR_PROFILE_TAG] }))).toBe(true)
    expect(isRadarProfileNote(note({ tags: ['Perfil do Radar'] }))).toBe(true)
    expect(isRadarProfileNote(note({ tags: ['PERFIL DE RADAR'] }))).toBe(true)
  })

  it('reconhece o título', () => {
    expect(isRadarProfileNote(note({ title: 'Radar profile' }))).toBe(true)
    expect(isRadarProfileNote(note({ title: '  Perfil do Radar: ' }))).toBe(true)
  })

  it('outras notas não são perfil', () => {
    expect(isRadarProfileNote(note({ title: 'Radar notes', tags: ['radar'] }))).toBe(false)
    expect(isRadarProfileNote(note({ title: 'Study profile', tags: ['study profile'] }))).toBe(false)
  })
})

describe('findRadarProfile', () => {
  const none = new Set<string>()

  it('acha por tag ou por título', () => {
    const byTag = note({ tags: ['radar profile'] })
    expect(findRadarProfile([note(), byTag], none)).toBe(byTag)
    const byTitle = note({ title: 'Perfil do radar' })
    expect(findRadarProfile([note(), byTitle], none)).toBe(byTitle)
  })

  it('a mais recente ganha', () => {
    const old = note({ tags: ['radar profile'], updatedAt: 10 })
    const recent = note({ tags: ['radar profile'], updatedAt: 99 })
    expect(findRadarProfile([recent, old], none)).toBe(recent)
    expect(findRadarProfile([old, recent], none)).toBe(recent)
  })

  it('arquivada fica fora', () => {
    const archived = note({ tags: ['radar profile'], archivedAt: 5, updatedAt: 99 })
    const active = note({ tags: ['radar profile'], updatedAt: 1 })
    expect(findRadarProfile([archived, active], none)).toBe(active)
    expect(findRadarProfile([archived], none)).toBeNull()
  })

  it('caderno com a IA desligada fica fora', () => {
    const off = note({ tags: ['radar profile'], notebookId: 'off', updatedAt: 99 })
    const on = note({ tags: ['radar profile'], updatedAt: 1 })
    expect(findRadarProfile([off, on], new Set(['off']))).toBe(on)
    expect(findRadarProfile([off], new Set(['off']))).toBeNull()
  })

  it('a nota-corpo de task fica fora', () => {
    const body = note({ tags: ['radar profile'], subjectId: tasksSubjectId('nb1') })
    expect(findRadarProfile([body], none)).toBeNull()
  })

  it('sem perfil, devolve null', () => {
    expect(findRadarProfile([note(), note()], none)).toBeNull()
  })
})

describe('extractRadarProfileDraft', () => {
  it('cabeçalho em inglês, com as linhas Follow, Sources e Ignore', () => {
    const draft = extractRadarProfileDraft(
      ['Here is a proposal:', '**Radar profile**', 'Follow: Rust, WebAssembly', 'Sources: lwn.net, github.com', 'Ignore: crypto'].join('\n')
    )
    expect(draft).toEqual({
      title: 'Radar profile',
      body: 'Follow: Rust, WebAssembly\nSources: lwn.net, github.com\nIgnore: crypto',
    })
  })

  it('cabeçalho em português com os rótulos em português, como escritos', () => {
    const draft = extractRadarProfileDraft('**Perfil do Radar**\nSeguir: IA, Rust\nFontes: arxiv.org\nIgnorar: futebol')
    expect(draft).toEqual({ title: 'Perfil do Radar', body: 'Seguir: IA, Rust\nFontes: arxiv.org\nIgnorar: futebol' })
  })

  it('aceita ":" dentro ou fora do negrito do cabeçalho', () => {
    expect(extractRadarProfileDraft('**Radar profile:**\nFollow: a')?.title).toBe('Radar profile')
    expect(extractRadarProfileDraft('**Perfil de radar**:\nFollow: a')?.title).toBe('Perfil de radar')
  })

  it('linhas com e sem "- " e com negrito', () => {
    const draft = extractRadarProfileDraft(
      ['**Radar profile**', '- Follow: Rust', '* **Sources**: lwn.net', '**Ignore:** crypto'].join('\n')
    )
    expect(draft?.body).toBe('Follow: Rust\nSources: lwn.net\nIgnore: crypto')
  })

  it('o negrito do valor fica no valor', () => {
    const draft = extractRadarProfileDraft('**Radar profile**\nFollow: **Rust**, Go')
    expect(draft?.body).toBe('Follow: **Rust**, Go')
  })

  it('o cabeçalho sem a linha Follow devolve null', () => {
    expect(extractRadarProfileDraft('**Radar profile**\nSources: lwn.net\nIgnore: crypto')).toBeNull()
  })

  it('a linha Follow sem texto não conta', () => {
    expect(extractRadarProfileDraft('**Radar profile**\nFollow:\nSources: lwn.net')).toBeNull()
  })

  it('para na primeira linha vazia depois de uma linha válida', () => {
    const draft = extractRadarProfileDraft('**Radar profile**\nFollow: a\n\nSources: b')
    expect(draft?.body).toBe('Follow: a')
  })

  it('linhas vazias antes da primeira linha válida são puladas', () => {
    expect(extractRadarProfileDraft('**Radar profile**\n\nFollow: a')?.body).toBe('Follow: a')
  })

  it('sem cabeçalho, devolve null', () => {
    expect(extractRadarProfileDraft('Follow: a\nSources: b')).toBeNull()
    expect(extractRadarProfileDraft('Radar profile\nFollow: a')).toBeNull()
  })
})

describe('radarFollowTerms', () => {
  it('lê a linha Follow, separada por vírgula ou ponto e vírgula', () => {
    expect(radarFollowTerms('Follow: Rust, WebAssembly; Node.js\nSources: lwn.net\nIgnore: crypto')).toEqual([
      'Rust',
      'WebAssembly',
      'Node.js',
    ])
  })

  it('lê a linha Seguir, com marcador, negrito e aspas nas pontas', () => {
    expect(radarFollowTerms(`- **Seguir:** "IA", #rust, O'Reilly`)).toEqual(['IA', 'rust', "O'Reilly"])
  })

  it('sem linha Follow, devolve vazio', () => {
    expect(radarFollowTerms('Sources: lwn.net\nIgnore: crypto')).toEqual([])
    expect(radarFollowTerms('')).toEqual([])
  })
})

describe('radarIgnoreText', () => {
  it('lê a linha Ignore (ou Ignorar), com ou sem negrito e lista', () => {
    expect(radarIgnoreText('Follow: Rust\nSources: lwn.net\nIgnore: crypto, sports')).toBe('crypto, sports')
    expect(radarIgnoreText('- **Ignorar**: futebol')).toBe('futebol')
    expect(radarIgnoreText('**Ignore:** crypto')).toBe('crypto')
  })

  it('junta várias linhas Ignore', () => {
    expect(radarIgnoreText('Ignore: crypto\nIgnore:   sports  news')).toBe('crypto; sports news')
  })

  it('sem a linha, ou com o "nothing yet" da proposta do Radar, devolve vazio', () => {
    expect(radarIgnoreText('Follow: Rust')).toBe('')
    expect(radarIgnoreText('Follow: Rust\nIgnore: nothing yet')).toBe('')
    expect(radarIgnoreText('Ignore: none.')).toBe('')
    expect(radarIgnoreText('Ignore: nada ainda')).toBe('')
    expect(radarIgnoreText('')).toBe('')
  })

  it('o que ignorar que só começa com "none" ainda conta', () => {
    expect(radarIgnoreText('Ignore: nonexistent-tool')).toBe('nonexistent-tool')
  })
})

describe('radarSourcesText', () => {
  it('lê a linha Sources (ou Fontes), com ou sem negrito e lista, e junta várias', () => {
    expect(radarSourcesText('Follow: Rust\nSources: lwn.net, arxiv.org\nIgnore: crypto')).toBe('lwn.net, arxiv.org')
    expect(radarSourcesText('- **Fontes**: lwn.net')).toBe('lwn.net')
    expect(radarSourcesText('**Sources:** lwn.net')).toBe('lwn.net')
    expect(radarSourcesText('Sources: lwn.net\nSources:   arxiv   org')).toBe('lwn.net; arxiv org')
  })

  it('sem a linha, ou com o "any" da proposta do Radar, devolve vazio', () => {
    expect(radarSourcesText('Follow: Rust')).toBe('')
    expect(radarSourcesText('Sources: any')).toBe('')
    expect(radarSourcesText('Sources: Any.')).toBe('')
    expect(radarSourcesText('Fontes: qualquer')).toBe('')
    expect(radarSourcesText('Sources: nada ainda')).toBe('')
    expect(radarSourcesText('')).toBe('')
  })

  it('a fonte que só começa com "any" ainda conta', () => {
    expect(radarSourcesText('Sources: anything-goes.dev')).toBe('anything-goes.dev')
  })
})
