import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import {
  LANGUAGE_PROFILE_TAG,
  buildLanguageProfileTemplate,
  findLanguageProfile,
  isLanguageProfileNote,
  readProfileLevel,
  readProfileLine,
} from './languageProfile'
import { tasksSubjectId } from './tasks'

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

// O perfil inventado do Apêndice E do plano.
const PROFILE = [
  'Native language: Portuguese',
  'French: B1, rusty.',
  'Explain: grammar in Portuguese, short, with one example from the page.',
  "Don't: translate whole pages for me.",
].join('\n')

describe('isLanguageProfileNote', () => {
  it('knows the tag, in English and in Portuguese, without case or accent', () => {
    expect(isLanguageProfileNote(note({ tags: [LANGUAGE_PROFILE_TAG] }))).toBe(true)
    expect(isLanguageProfileNote(note({ tags: ['Language Profile'] }))).toBe(true)
    expect(isLanguageProfileNote(note({ tags: ['perfil de língua'] }))).toBe(true)
    expect(isLanguageProfileNote(note({ tags: ['PERFIL DE LINGUA'] }))).toBe(true)
  })

  it('knows the title', () => {
    expect(isLanguageProfileNote(note({ title: 'Language profile' }))).toBe(true)
    expect(isLanguageProfileNote(note({ title: 'Perfil de língua:' }))).toBe(true)
  })

  it('other notes are not a profile', () => {
    expect(isLanguageProfileNote(note({ title: 'Language notes', tags: ['language'] }))).toBe(false)
    expect(isLanguageProfileNote(note({ tags: ['radar profile', 'study profile'] }))).toBe(false)
  })
})

describe('findLanguageProfile', () => {
  const none = new Set<string>()

  it('finds it by the tag', () => {
    const profile = note({ tags: ['language profile'], content: PROFILE })
    expect(findLanguageProfile([note(), profile], none)).toBe(profile)
  })

  it('the most recent wins', () => {
    const old = note({ tags: ['language profile'], updatedAt: 10 })
    const recent = note({ tags: ['language profile'], updatedAt: 99 })
    expect(findLanguageProfile([recent, old], none)).toBe(recent)
    expect(findLanguageProfile([old, recent], none)).toBe(recent)
  })

  it('an archived note, a notebook with the AI off and a task body note stay out', () => {
    const archived = note({ tags: ['language profile'], archivedAt: 5, updatedAt: 99 })
    const off = note({ tags: ['language profile'], notebookId: 'off', updatedAt: 98 })
    const body = note({ tags: ['language profile'], subjectId: tasksSubjectId('nb1'), updatedAt: 97 })
    const active = note({ tags: ['language profile'], updatedAt: 1 })
    expect(findLanguageProfile([archived, off, body, active], new Set(['off']))).toBe(active)
    expect(findLanguageProfile([archived, off, body], new Set(['off']))).toBeNull()
  })
})

describe('readProfileLevel', () => {
  it('reads the level by the English name of the language', () => {
    expect(readProfileLevel(PROFILE, 'fr')).toBe('B1')
  })

  it('reads the level by the language code, in any case', () => {
    expect(readProfileLevel('FR: c1', 'fr')).toBe('C1')
    expect(readProfileLevel('fr: A2 — slow', 'fr')).toBe('A2')
  })

  it('reads it with a list dash and with bold', () => {
    expect(readProfileLevel('- French: B2', 'fr')).toBe('B2')
    expect(readProfileLevel('**French**: B1', 'fr')).toBe('B1')
    expect(readProfileLevel('**French:** B1', 'fr')).toBe('B1')
    expect(readProfileLevel('* French: C2', 'fr')).toBe('C2')
  })

  it('without a CEFR token, the first letters of the value', () => {
    expect(readProfileLevel('French: rusty, learning for fun', 'fr')).toBe('rusty, learning for fun')
    const long = 'French: ' + 'x'.repeat(80)
    expect(readProfileLevel(long, 'fr')).toBe('x'.repeat(40))
  })

  it('a level for another language gives null', () => {
    expect(readProfileLevel(PROFILE, 'es')).toBeNull()
    expect(readProfileLevel('Spanish: B1', 'fr')).toBeNull()
  })

  it('no language or no line gives null', () => {
    expect(readProfileLevel(PROFILE, '')).toBeNull()
    expect(readProfileLevel('', 'fr')).toBeNull()
    expect(readProfileLevel('French:', 'fr')).toBeNull()
  })
})

describe('readProfileLine', () => {
  it('reads the Explain and the Don’t lines', () => {
    expect(readProfileLine(PROFILE, ['Explain'])).toBe('grammar in Portuguese, short, with one example from the page.')
    expect(readProfileLine(PROFILE, ["Don't", 'Avoid'])).toBe('translate whole pages for me.')
  })

  it('the typographic apostrophe is the same as the straight one', () => {
    expect(readProfileLine('Don’t: use English', ["Don't"])).toBe('use English')
  })

  it('no such line gives null', () => {
    expect(readProfileLine('French: B1', ['Explain'])).toBeNull()
  })
})

describe('buildLanguageProfileTemplate', () => {
  it('has the native language, the level of the book language, how to explain and what to avoid', () => {
    const template = buildLanguageProfileTemplate('pt', 'fr')
    expect(template.split('\n\n')).toEqual([
      'Native language: Portuguese',
      'French: B1',
      'Explain: grammar in Portuguese, short, with one example from the page.',
      "Don't: translate whole pages for me. Don't rewrite what I write; point at what to fix.",
    ])
  })

  it('what it writes reads back', () => {
    const template = buildLanguageProfileTemplate('pt', 'fr')
    expect(readProfileLevel(template, 'fr')).toBe('B1')
    expect(readProfileLine(template, ['Explain'])).toContain('Portuguese')
    expect(readProfileLine(template, ["Don't"])).toContain('translate whole pages')
  })
})
