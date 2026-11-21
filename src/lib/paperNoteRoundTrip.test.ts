import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildBaseExtensions } from '../components/Editor/extensions'
import type { Note, NoteType } from '../types'
import type { PaperItem } from './agentItems'
import { paperNoteContent, paperPdfFromContent, readingListKeys } from './papers'

// A nota Paper passa pelo editor real (o mesmo conjunto de extensões do Editor):
// o editor regrava o markdown com escapes (`_` depois de uma barra, `~`, `[`),
// e a linha `PDF:` e a `Source:` têm de sair daí com a URL que o app escreveu.
// O editor fica desmontado (sem elemento). Sem rede.

let editor: Editor

beforeEach(() => {
  editor = new Editor({ extensions: buildBaseExtensions('') })
})

afterEach(() => {
  editor.destroy()
})

function save(): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

// Abre o markdown no editor e devolve o que ele grava (o que o usuário gera ao
// editar qualquer coisa na nota).
function throughEditor(md: string): string {
  editor.commands.setContent(md)
  return save()
}

function paper(pdfUrl: string): PaperItem {
  return {
    kind: 'paper',
    key: 'P1',
    section: 'foundational',
    id: 'openalex:W123',
    openalexId: 'W123',
    title: 'Graph neural networks',
    authors: ['Ana Smith'],
    authorCount: 1,
    year: 2021,
    date: '2021-03-01',
    doi: null,
    url: 'https://openalex.org/W123',
    citations: 10,
    type: 'article',
    isOa: true,
    pdfUrl,
    oaUrl: null,
    abstract: 'We survey the field.',
  }
}

// [URL de entrada, URL que a nota guarda (parênteses e espaços saem codificados)].
const URLS: Array<[string, string]> = [
  ['https://repo.example.org/files/paper.pdf', 'https://repo.example.org/files/paper.pdf'],
  ['https://x.org/dir/_private/a.pdf', 'https://x.org/dir/_private/a.pdf'],
  ['https://x.org/a.pdf?_ga=1&_gl=2', 'https://x.org/a.pdf?_ga=1&_gl=2'],
  ['https://x.org/a_b_c.pdf', 'https://x.org/a_b_c.pdf'],
  ['https://x.org/a_.pdf', 'https://x.org/a_.pdf'],
  ['https://x.org/_final_.pdf', 'https://x.org/_final_.pdf'],
  ['https://x.org/_a_/b__c__/d.pdf', 'https://x.org/_a_/b__c__/d.pdf'],
  ['https://x.org/~user/a_b.pdf', 'https://x.org/~user/a_b.pdf'],
  ['https://x.org/a.pdf?file=_x&y=*z*&t=~a~b~', 'https://x.org/a.pdf?file=_x&y=*z*&t=~a~b~'],
  ['https://x.org/a*b*c.pdf', 'https://x.org/a*b*c.pdf'],
  ['https://x.org/**a**/b.pdf', 'https://x.org/**a**/b.pdf'],
  ['https://x.org/a.pdf?x=[1]&y=2', 'https://x.org/a.pdf?x=[1]&y=2'],
  ['https://x.org/a#frag_1', 'https://x.org/a#frag_1'],
  ['https://x.org/a.pdf?u=a(b)&v=1&w=2', 'https://x.org/a.pdf?u=a%28b%29&v=1&w=2'],
  ['https://x.org/a (1)_x.pdf?dl=1&k=~v', 'https://x.org/a%20%281%29_x.pdf?dl=1&k=~v'],
]

describe('nota Paper pelo editor: a linha PDF volta com a URL que o app escreveu', () => {
  it.each(URLS)('%s', (url, stored) => {
    const written = paperNoteContent(paper(url), 'Because.', '2026-11-20', 'Papers')
    expect(paperPdfFromContent(written)).toBe(stored)
    const saved = throughEditor(written)
    expect(paperPdfFromContent(saved)).toBe(stored)
    // Abrir e gravar de novo não muda mais nada.
    expect(throughEditor(saved)).toBe(saved)
    expect(paperPdfFromContent(throughEditor(saved))).toBe(stored)
  })

  it('a nota gravada antes do escape (URL crua com `_` depois de uma barra) também volta certa', () => {
    const legacy = ['Source: https://openalex.org/W123', 'PDF: https://x.org/dir/_private/a.pdf?_ga=1&_gl=2'].join('\n\n')
    const saved = throughEditor(legacy)
    expect(saved).toContain('\\_private')
    expect(paperPdfFromContent(saved)).toBe('https://x.org/dir/_private/a.pdf?_ga=1&_gl=2')
  })
})

describe('nota Paper pelo editor: a linha Source continua sendo a chave de dedupe', () => {
  const type: NoteType = {
    id: 'nt_paper',
    name: 'Paper',
    icon: null,
    color: null,
    template: null,
    sortOrder: 1,
    builtin: false,
    createdAt: 0,
    board: null,
    log: null,
  }

  it('depois de duas gravações pelo editor, a chave openalex:W123 está na fila', () => {
    const written = paperNoteContent(paper('https://x.org/dir/_private/a.pdf'), 'Because.', '2026-11-20', 'Papers')
    const saved = throughEditor(throughEditor(written))
    expect(saved).toContain('Source: https://openalex.org/W123')
    const note: Note = {
      id: 'n1',
      notebookId: 'nb1',
      subjectId: null,
      title: 'Graph neural networks',
      content: saved,
      tags: [],
      date: null,
      createdAt: 0,
      updatedAt: 0,
      typeId: type.id,
      properties: {},
      archivedAt: null,
    }
    expect(readingListKeys([note], [type], []).has('openalex:W123')).toBe(true)
  })
})
