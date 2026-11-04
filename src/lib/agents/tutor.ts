import { GraduationCap } from '@phosphor-icons/react'
import type { Note, Notebook } from '../../types'
import { storage } from '../../storage'
import { withWeekday } from '../agenda'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs } from '../calendar'
import { cleanNoteContentForAi } from '../noteFileText'
import { extractNoteMarks } from '../noteMarks'
import { propertiesForAi, typeDefs } from '../noteTypes'
import { nameKey } from '../plan'
import { bookKey, collectPlans, matchBook, type PlanEntry, type ReaderBookInfo } from '../planNotes'
import { findStudyProfile } from '../studyProfile'
import { isTaskBodyNote } from '../tasks'
import { bookLine, loadPlanData } from './agentData'
import type { AgentContext, AgentContextInput, ChatAgentDef } from './chat'
import { DEFINE_COMMANDS } from './define'

// Agente tutor (chat): julga o estudo de um tema (o caderno em escopo), aponta
// lacunas, indica leituras e propõe uma atividade. O contexto é um índice
// pré-calculado; o conteúdo das notas vem por get_note/search_knowledge_base.

// Tipo com propriedade number com nome de capítulo = nota de resumo.
const CHAPTER_NAMES = ['capitulo', 'chapter', 'cap', 'ch', 'chap', 'aula', 'lesson', 'licao', 'modulo', 'module',
  'unidade', 'unit', 'parte', 'part']

const SUGGESTED_NOTEBOOKS_MAX = 30
const PROFILE_MAX = 1500
const SUMMARIES_MAX = 40
const PLANS_MAX = 5
const MARKS_MAX = 15
const MARK_TEXT_MAX = 80
const GLOSSARY_MAX = 40
const GLOSSARY_CHARS = 3000
const GLOSSARY_LINE_MAX = 120
const OTHER_NOTES_MAX = 120
const OTHER_NOTES_CHARS = 6000

type ScopeSource = 'folder' | 'folderName' | 'message'

const SOURCE_TEXT: Record<ScopeSource, string> = {
  folder: 'from the chat folder',
  folderName: 'from the folder name',
  message: 'from your message',
}

const FOLDER_NAME_RE = /^Notebook - (.+)$/

// Item cujo nome aparece no texto como palavras inteiras (chave com 3+
// caracteres); com vários, o nome mais longo ganha.
function namedIn<T>(text: string, items: T[], name: (item: T) => string): T | null {
  const haystack = ` ${bookKey(text)} `
  let best: { item: T; key: string } | null = null
  for (const item of items) {
    const key = bookKey(name(item))
    if (key.length < 3 || !haystack.includes(` ${key} `)) continue
    if (!best || key.length > best.key.length) best = { item, key }
  }
  return best?.item ?? null
}

// Texto entre aspas (retas, curvas ou angulares).
const QUOTED_RE = /["“”'‘’«»]([^"“”'‘’«»\n]{3,90})["“”'‘’«»]/g
// Palavras que, antes do nome, marcam o caderno ("caderno de X", "notebook X").
const NOTEBOOK_WORDS = ['caderno', 'caderno de', 'caderno do', 'caderno da', 'notebook']

// Caderno citado de forma explícita: o nome entre aspas ou junto de
// "caderno"/"notebook". Com vários, o nome mais longo ganha.
function explicitNotebookIn(text: string, notebooks: Notebook[]): Notebook | null {
  const quoted = new Set([...text.matchAll(QUOTED_RE)].map((m) => bookKey(m[1])))
  const haystack = ` ${bookKey(text)} `
  let best: { notebook: Notebook; key: string } | null = null
  for (const notebook of notebooks) {
    const key = bookKey(notebook.name)
    if (key.length < 3) continue
    const near =
      NOTEBOOK_WORDS.some((w) => haystack.includes(` ${w} ${key} `)) || haystack.includes(` ${key} notebook `)
    if (!quoted.has(key) && !near) continue
    if (!best || key.length > best.key.length) best = { notebook, key }
  }
  return best?.notebook ?? null
}

// Caderno em escopo, recalculado a cada mensagem. A mensagem deste turno que
// cita outro caderno de forma explícita (entre aspas ou junto de
// "caderno"/"notebook") vence a pasta (a pergunta mudou de tema); senão,
// vínculo da pasta, depois o nome "Notebook - X", depois o caderno citado nas
// mensagens (da mais nova para a mais antiga). O Calendar fica fora.
function resolveTutorNotebook(
  input: AgentContextInput,
  notebooks: Notebook[]
): { notebook: Notebook; source: ScopeSource } | null {
  const candidates = notebooks.filter((nb) => nb.id !== CALENDAR_NOTEBOOK_ID)
  const latest = input.userMessages[0] ? explicitNotebookIn(input.userMessages[0], candidates) : null

  let fromFolder: { notebook: Notebook; source: ScopeSource } | null = null
  const linked = input.notebookId ? candidates.find((nb) => nb.id === input.notebookId) : undefined
  if (linked) {
    fromFolder = { notebook: linked, source: 'folder' }
  } else {
    const folder = input.folderName?.match(FOLDER_NAME_RE)
    if (folder) {
      const key = nameKey(folder[1])
      const named = candidates.find((nb) => nameKey(nb.name.trim().slice(0, 90)) === key)
      if (named) fromFolder = { notebook: named, source: 'folderName' }
    }
  }
  if (latest && latest.id !== fromFolder?.notebook.id) return { notebook: latest, source: 'message' }
  if (fromFolder) return fromFolder

  for (const message of input.userMessages) {
    const named = namedIn(message, candidates, (nb) => nb.name)
    if (named) return { notebook: named, source: 'message' }
  }
  return null
}

// Livro do Reader citado na conversa (a mensagem mais nova primeiro).
function bookInQuestion(input: AgentContextInput, books: ReaderBookInfo[]): ReaderBookInfo | null {
  for (const message of input.userMessages) {
    const named = namedIn(message, books, (b) => b.book.title)
    if (named) return named
  }
  return null
}

// Plano sobre o livro: propriedade Livro casando com o título, ou o título do
// livro no título do plano.
function planIsAbout(e: PlanEntry, book: ReaderBookInfo): boolean {
  if (e.info.book && matchBook(e.info.book, [book.book])) return true
  return namedIn(e.note.title, [book], (b) => b.book.title) !== null
}

// '~2.7k chars' | '840 chars' | '(empty)'
function sizeText(n: number): string {
  if (n === 0) return '(empty)'
  return n < 1000 ? `${n} chars` : `~${(n / 1000).toFixed(1)}k chars`
}

function clip(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

function planLine(e: PlanEntry): string {
  const parts = [`"${e.note.title.trim() || 'Untitled'}"`, e.state]
  const p = e.progress
  if (!p) {
    parts.push('no checklist')
  } else {
    parts.push(`${p.done}/${p.total} done`)
    const diff = p.diffItems ?? 0
    // Atrasado com itens futuros feitos fora de ordem: diff >= 0, só os dias.
    if (p.status === 'behind') parts.push(`behind${diff < 0 ? ` by ${-diff} items` : ''} (${p.lateDays} days late)`)
    else if (p.status === 'ahead') parts.push(`${diff} items ahead`)
    else if (p.status === 'onTrack') parts.push('on track')
    else if (p.status === 'overdue') parts.push(`past its End with ${p.total - p.done} open items`)
    else if (p.status === 'noDates') parts.push('no dates')
  }
  return `- ${parts.join(' · ')}`
}

// 1ª frase da definição, sem ênfase markdown.
function firstSentence(text: string): string {
  const plain = text.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim()
  const m = plain.match(/^(.+?[.!?])(?:\s|$)/)
  return clip(m ? m[1] : plain, GLOSSARY_LINE_MAX)
}

async function buildTutorContext(input: AgentContextInput): Promise<AgentContext> {
  const data = await loadPlanData()
  const header = 'Tutor context (rebuilt by the app for this message; it replaces any earlier one).'
  const scope = resolveTutorNotebook(input, data.notebooks)

  if (!scope) {
    const names = data.notebooks
      .filter((nb) => nb.id !== CALENDAR_NOTEBOOK_ID && !data.disabledNotebookIds.has(nb.id))
      .slice(0, SUGGESTED_NOTEBOOKS_MAX)
      .map((nb) => nb.name.trim())
    return {
      text: [header, `No notebook in scope. Notebooks: ${names.length > 0 ? names.join(', ') : '(none)'}.`].join('\n'),
    }
  }

  const { notebook, source } = scope
  // Escopo vindo da mensagem (outro caderno que o da pasta, ou chat sem
  // pasta): o RAG do turno busca nele, não na pasta. Com a IA do caderno
  // desligada, sem RAG.
  const disabled = data.disabledNotebookIds.has(notebook.id)
  const ragNotebookId = source === 'message' ? (disabled ? null : notebook.id) : undefined
  // Escopo da mensagem anterior (o mesmo cálculo sem a mensagem deste turno):
  // o caderno é dito na 1ª resposta e quando o escopo muda.
  const previous =
    input.userMessages.length > 1
      ? resolveTutorNotebook({ ...input, userMessages: input.userMessages.slice(1) }, data.notebooks)
      : null
  const scopeChanged = input.userMessages.length > 1 && previous?.notebook.id !== notebook.id
  if (disabled) {
    return {
      text: [
        header,
        `Notebook in scope: "${notebook.name}" — its AI access is disabled (notes index off). ` +
          'Say so and ask the user to enable it or choose another notebook.',
      ].join('\n'),
      ragNotebookId,
    }
  }

  // Falha do glossário não bloqueia o tutor (sai "(none)").
  const defineRows = await storage.getCompletedResponsesByCommands(DEFINE_COMMANDS).catch((err) => {
    console.warn('tutor glossary failed:', err)
    return []
  })

  const typeName = new Map(data.types.map((t) => [t.id, t.name]))
  // Subjects do caderno (seções que dão o tema de cada nota); falha = sem subject.
  const subjectName = new Map(
    (await storage.getSubjects(notebook.id).catch(() => [])).map((s) => [s.id, s.name])
  )
  const subjectOf = (note: Note) => {
    const name = note.subjectId ? subjectName.get(note.subjectId) : undefined
    return name ? ` · subject: ${name}` : ''
  }
  const nbNotes = data.notes
    .filter((n) => n.notebookId === notebook.id && !n.archivedAt && !isTaskBodyNote(n))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const profile = findStudyProfile(nbNotes, notebook.id)

  const book = bookInQuestion(input, data.books)
  const out = [
    header,
    `Today: ${withWeekday(input.todayKey)} · Notebook in scope: "${notebook.name}" (${SOURCE_TEXT[source]}). ` +
      (scopeChanged
        ? `The scope changed${previous ? ` (it was "${previous.notebook.name}")` : ''}: say in your first line which notebook you are using now.`
        : 'Say which notebook you are using in one short first line only in your first reply of the conversation (check your earlier replies); do not repeat it later.'),
  ]
  if (book) {
    out.push(
      `Book in question (Reader): ${bookLine(book)}. ` +
        'A position the user states (chapter, page) wins over these numbers; otherwise treat the last opened page as where the user is. ' +
        'You do not have the book text.'
    )
  }
  out.push('')

  // Perfil
  if (profile) {
    let text = cleanNoteContentForAi(profile.content, {
      resolveNoteTitle: (id) => data.notes.find((n) => n.id === id)?.title,
    }).trim()
    if (text.length > PROFILE_MAX) text = `${text.slice(0, PROFILE_MAX)} [truncated]`
    out.push(
      `Study profile: "${profile.title.trim() || 'Untitled'}" (updated ${dateKeyFromMs(profile.updatedAt)}):`,
      text || '(empty)'
    )
  } else {
    out.push(
      'Study profile: none in this notebook. (Identified by the tag "study profile" or a note titled "Study profile".)'
    )
  }

  // Resumos por capítulo
  const summaries: Array<{ note: Note; chapter: number }> = []
  const others: Note[] = []
  for (const note of nbNotes) {
    if (note === profile) continue
    const chapterDef = typeDefs(data.defs, note.typeId).find(
      (d) => d.type === 'number' && CHAPTER_NAMES.includes(nameKey(d.name))
    )
    const value = chapterDef ? note.properties?.[chapterDef.id] : undefined
    const chapter = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    if (chapterDef && Number.isFinite(chapter)) summaries.push({ note, chapter })
    else others.push(note)
  }
  summaries.sort((a, b) => a.chapter - b.chapter || a.note.title.localeCompare(b.note.title))
  out.push('', 'Chapter summaries (notes whose type has a chapter number):')
  if (summaries.length === 0) out.push('(none)')
  for (const { note, chapter } of summaries.slice(0, SUMMARIES_MAX)) {
    const type = note.typeId ? typeName.get(note.typeId) : undefined
    out.push(
      `- Ch. ${chapter} · "${note.title.trim() || 'Untitled'}"${type ? ` · ${type}` : ''}${subjectOf(note)} · ${sizeText(note.content.trim().length)}`
    )
  }
  if (summaries.length > SUMMARIES_MAX) out.push(`(${summaries.length - SUMMARIES_MAX} more)`)

  // Planos do caderno (com datas)
  const plans = collectPlans({
    notes: data.notes,
    defs: data.defs,
    types: data.types,
    todayKey: input.todayKey,
    disabledNotebookIds: data.disabledNotebookIds,
    notebookId: notebook.id,
  }).filter((e) => e.state !== 'undated' && (!book || planIsAbout(e, book)))
  out.push('', book ? `Plans in this notebook about "${book.book.title}":` : 'Plans in this notebook:')
  out.push(...(plans.length > 0 ? plans.slice(0, PLANS_MAX).map(planLine) : ['(none)']))

  // Marcas abertas
  const marks = nbNotes.flatMap((note) =>
    note.content.includes('data-mark') ? extractNoteMarks(note.content).map((m) => ({ note, mark: m })) : []
  )
  out.push('', `Open marks (passages the user marked to review): ${marks.length}`)
  for (const { note, mark } of marks.slice(0, MARKS_MAX)) {
    out.push(
      `- "${clip(mark.text, MARK_TEXT_MAX)}"${mark.label ? ` [${mark.label}]` : ''} — "${note.title.trim() || 'Untitled'}"`
    )
  }

  // Glossário do /define nas notas do caderno (mais novo primeiro, sem repetir o termo)
  const nbNoteIds = new Set(nbNotes.map((n) => n.id))
  const seenTerms = new Set<string>()
  const glossary: string[] = []
  for (const r of defineRows) {
    if (!r.noteId || !nbNoteIds.has(r.noteId) || !r.query.trim() || !r.response.trim()) continue
    const key = nameKey(r.query)
    if (seenTerms.has(key)) continue
    seenTerms.add(key)
    glossary.push(`- ${clip(r.query, 60)} (${dateKeyFromMs(r.createdAt)}): ${firstSentence(r.response)}`)
  }
  out.push('', `Glossary (/define in this notebook): ${glossary.length} terms`)
  if (glossary.length === 0) out.push('(none)')
  let glossaryChars = 0
  let glossaryShown = 0
  for (const line of glossary.slice(0, GLOSSARY_MAX)) {
    if (glossaryChars + line.length > GLOSSARY_CHARS) break
    out.push(line)
    glossaryChars += line.length + 1
    glossaryShown++
  }
  if (glossaryShown < glossary.length) out.push(`(${glossary.length - glossaryShown} more)`)

  // Demais notas
  out.push('', 'Other notes in this notebook (title · type · subject · properties), newest first:')
  if (others.length === 0) out.push('(none)')
  let otherChars = 0
  let otherShown = 0
  for (const note of others.slice(0, OTHER_NOTES_MAX)) {
    const type = note.typeId ? typeName.get(note.typeId) : undefined
    const props = propertiesForAi(note, data.defs)
    const line =
      `- "${note.title.trim() || 'Untitled'}"` +
      (type ? ` · ${type}` : '') +
      subjectOf(note) +
      (props.length > 0 ? ` · ${props.map((p) => `${p.name}: ${p.value}`).join('; ')}` : '')
    if (otherChars + line.length > OTHER_NOTES_CHARS) break
    out.push(line)
    otherChars += line.length + 1
    otherShown++
  }
  if (otherShown < others.length) out.push(`(${others.length - otherShown} more)`)

  out.push(
    '',
    `Reader books: ${data.books.length > 0 ? data.books.map((b) => `"${b.book.title}"`).join(', ') : '(none)'}`
  )
  return { text: out.join('\n'), ragNotebookId }
}

function tutorPrompt(language: string): string {
  return `You are Monet's tutor for one study topic: the notebook in scope. You judge what the user has studied (depth and gaps), point out weak spots, lay out what is essential in the topic, recommend readings and propose one activity. You do not rewrite notes and you do not make schedules (that is /planner).

Respond in the language of the user's latest message (if unclear: ${language}). Short Markdown, no greetings or filler. Section titles (Solid, Weak, Reading, What to note...) in the user's language too.

Data:
- The "Tutor context" system block is rebuilt by the app for every message: whether knowledge base search is available, the notebook in scope, the study profile (goal and level), chapter summaries, plans and their progress, open marks, the notebook glossary (/define terms), the other note titles and the Reader books. Ignore older versions of it.
- Read note contents with get_note (by title, with the notebook name) when you need them, or with search_knowledge_base only when the block says "Knowledge base search: available"; read the summaries you judge. Never judge a note you have not read: say "by title only" when you could not read it.
- Web search, when it is available, is only to check that a book or article you recommend exists.
- Plans: mention a plan only when it is about what the user is asking (the same book or topic); otherwise ignore the plans.

Content questions and empty notes — when the user asks about the content itself (what happens, what something means) instead of a review, or the note they are working on is empty or almost empty, there is nothing to judge yet. Then, instead of the review sections and without asking for the study profile:
- One line saying there are no notes on this yet to review.
- Orient the point where the user is: 2 to 4 short bullets on what to pay attention to and why it matters. Never reveal anything past the user's position (a "Book in question" line or the position the user states). Leave out any detail you are not sure of (chapter numbers, who says or does what) instead of guessing.
- **What to note** — at most 3 bullets on what to write down about this part.
- **Activity** — one question or exercise about this part.
- When the answer depends on the exact text, suggest asking in the Reader's side chat, which reads the book page.

Questions — at most one per reply:
- No notebook in scope: ask which notebook or topic to review, suggesting up to 5 notebook names from the block. Review nothing in that reply. If the user names a topic that is not a notebook, work from the conversation and say the notes were not used.
- No study profile: ask one question (the goal of this study) and, in the same reply, propose the profile in this block, so the user can save it with "Save study profile" (the header may be in the user's language, e.g. "Perfil de estudo"):
  **Study profile — <notebook name>**
  Goal: <the goal, or what the notes suggest followed by "(to confirm)">
  Level: <beginner, intermediate or advanced, inferred from the notes>
  Focus: <one line>
  You may add a short provisional review in the same reply.
- When the user answers, repeat the profile block with the answer, then review.

Output (with a profile):
**Solid** — at most 3 items.
**Weak** — at most 3 items, each with why.
**Essential missing** — at most 3 items.
**Reading** — at most 3 real books or articles (title and author), each with the reason. Never recommend what is already in the notebook's notes, the glossary or the Reader list; leave out any title you are not sure exists.
**Activity** — one exercise, kata or review question, tied to a weak point.
One line per item. When the block says something is missing (no summaries, no glossary), say it in one line at the end.`
}

export const tutorAgent: ChatAgentDef = {
  id: 'tutor',
  command: '/tutor',
  label: 'Tutor',
  description: 'Review your study of a topic and suggest next steps',
  icon: GraduationCap,
  prompt: tutorPrompt,
  buildContext: buildTutorContext,
  forceTasksTool: false,
  forceNotesTool: true,
  context: { rag: true, web: true, deepResearch: false },
}
