import type { MetadataDef, Note, Notebook } from '../types'
import { SCOPE_SOURCE_TEXT, scopeLabel, type AgentScope } from './agents/scope'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs } from './calendar'
import { buildBoardColumns, boardNotes, resolveBoard } from './noteBoard'
import { cleanNoteContentForAi } from './noteFileText'
import { hasTag, summarizeTags, tagKey } from './noteTags'
import type { PlanEntry, ReaderBookInfo } from './planNotes'
import { isRadarProfileNote, radarFollowTerms, radarIgnoreText, radarSourcesText } from './radarProfile'
import { findStudyProfile } from './studyProfile'
import { addDaysKey, INBOX_NOTEBOOK_ID, isTaskBodyNote, QUICK_NOTES_NAME } from './tasks'

// Mapa de foco: o bloco que diz ao modelo (do Radar e do Papers) e ao gerador
// de consultas o que o usuário estuda e acompanha no escopo: perfil do Radar,
// perfil de estudo, planos, tags, livros em andamento, títulos recentes ou
// cards do board. Só títulos, nomes e perfis; o texto das notas não entra. As
// consultas de busca nunca levam este bloco. Módulo puro (sem storage).

export const FOCUS_MAX_CHARS = 6000
export const RADAR_PROFILE_CHARS = 1200
export const STUDY_PROFILE_CHARS = 600
export const STUDY_PROFILE_ALL_CHARS = 300 // por caderno, no escopo `all`
export const RECENT_TITLES_MAX = 40
export const RECENT_TITLES_CHARS = 2500
export const TOP_TAGS_NOTEBOOK = 10
export const TOP_TAGS_ALL = 15
export const PLANS_MAX = 5
export const BOOKS_MAX = 5
export const BOARD_CARDS_MAX = 60
export const ACTIVE_DAYS = 30
export const ACTIVE_NOTEBOOKS_MAX = 12
export const TITLES_PER_NOTEBOOK = 5
const TITLE_MAX = 90
const TERMS_MAX = 6
const TERM_MAX = 60

// Em caderno, tag ou board com uma nota de perfil da qual nenhuma linha entra (só o Follow,
// que o escopo estreito não usa): o contexto ainda diz que o perfil existe, senão o modelo
// conclui que não há perfil e propõe outro.
export const RADAR_PROFILE_SAVED_NOTE =
  'Radar profile: saved. Its Follow line applies only to the "all notebooks" scope, so nothing from it is used here. Do not propose a profile.'

export interface FocusMap {
  text: string // bloco com orçamento (FOCUS_MAX_CHARS)
  // Escopo sem notas. Só no escopo "tudo" o perfil do Radar também o faz não vazio:
  // em caderno, tag ou board (e no modo `profileUse: 'ignore'`), o perfil não ancora a busca.
  empty: boolean
  terms: string[] // até 6 assuntos de reserva (consulta quando o planejador falha): ver a ordem em buildFocusMap
  scopeNotebookId: string | null
  // Alguma linha do perfil do Radar entrou no bloco (em caderno, tag ou board, só Sources
  // e Ignore; no modo 'ignore', só Ignore; sem essas linhas, false).
  profileUsed: boolean
}

export interface FocusMapInput {
  scope: AgentScope
  notes: Note[]
  notebooks: Notebook[]
  defs: MetadataDef[]
  books: ReaderBookInfo[]
  disabledNotebookIds: Set<string>
  radarProfile: Note | null
  // 'all' (padrão): o perfil inteiro no escopo "tudo"; em caderno, tag ou board, só as
  // linhas Sources e Ignore (o perfil é global e o Follow dele não manda num escopo
  // estreito). 'ignore': só a linha Ignore, em qualquer escopo (o Papers busca pelo
  // escopo, não pelo que o perfil manda seguir).
  profileUse?: 'all' | 'ignore'
  todayKey: string
  plans: PlanEntry[] // collectPlans(...) já calculado por quem chama
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

function titleOf(note: Note): string {
  return clip(oneLine(note.title), TITLE_MAX) || 'Untitled'
}

// 'YYYY-MM-DD' → 'dd/mm'
function ddmm(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`
}

function sourceText(scope: AgentScope): string {
  if (scope.kind === 'notebook') return SCOPE_SOURCE_TEXT[scope.source]
  if (scope.kind === 'all' && scope.source === 'default') return 'default: no scope named'
  return SCOPE_SOURCE_TEXT.message
}

// Nome de caderno que serve de assunto de busca: o Quick Notes não, e um nome de
// uma palavra só ("Work", "Notes") também não.
function isSubjectNotebook(nb: Notebook): boolean {
  if (nb.id === INBOX_NOTEBOOK_ID || nb.name.trim().toLowerCase() === QUICK_NOTES_NAME.toLowerCase()) return false
  return oneLine(nb.name).split(' ').length >= 2
}

function readingText({ book }: ReaderBookInfo): string {
  const where = book.format === 'epub' ? 'location' : 'p.'
  return `"${clip(oneLine(book.title), TITLE_MAX)}" (${where} ${book.lastPage} of ${book.totalPages})`
}

// As notas que o mapa de foco (e a lista de tags do escopo) enxerga: ativas, fora
// das notas-corpo de task, do Calendar, dos cadernos com a IA desligada e das
// notas de perfil do Radar.
export function focusEligibleNotes(notes: Note[], disabledNotebookIds: Set<string>): Note[] {
  return notes.filter(
    (n) =>
      !n.archivedAt &&
      !isTaskBodyNote(n) &&
      n.notebookId !== CALENDAR_NOTEBOOK_ID &&
      !(n.notebookId && disabledNotebookIds.has(n.notebookId)) &&
      !isRadarProfileNote(n)
  )
}

export function buildFocusMap(input: FocusMapInput): FocusMap {
  const { scope, notes, notebooks, defs, books, disabledNotebookIds, radarProfile, todayKey, plans } = input
  const notebookName = new Map(notebooks.map((nb) => [nb.id, oneLine(nb.name) || 'Untitled']))
  const titleById = new Map(notes.map((n) => [n.id, n.title]))
  const cleaned = (note: Note) => cleanNoteContentForAi(note.content, { resolveNoteTitle: (id) => titleById.get(id) }).trim()

  const matches = (n: Note): boolean => {
    switch (scope.kind) {
      case 'notebook':
        return n.notebookId === scope.notebook.id
      case 'tag':
        return hasTag(n, scope.tag)
      case 'board':
        return n.typeId === scope.type.id
      default:
        return true
    }
  }
  const inScope = focusEligibleNotes(notes, disabledNotebookIds).filter(matches)
  const newestFirst = [...inScope].sort((a, b) => b.updatedAt - a.updatedAt)

  // Radar profile. O perfil é global: em "tudo" vale inteiro; em caderno, tag ou board o
  // Follow dele não entra (só Sources e Ignore, e o rótulo diz isso); no modo 'ignore'
  // (Papers), só a linha Ignore. Sem as linhas que o modo deixa entrar, nenhuma linha de
  // perfil; sem perfil, "none". Com o perfil e nenhuma linha que o escopo estreito deixe
  // entrar, a linha "saved" diz que ele existe.
  const profileText = radarProfile ? cleaned(radarProfile) : null
  const ignoreOnly = input.profileUse === 'ignore'
  const narrow = !ignoreOnly && scope.kind !== 'all'
  const ignoreText = (ignoreOnly || narrow) && profileText ? radarIgnoreText(profileText) : ''
  const sourcesText = narrow && profileText ? radarSourcesText(profileText) : ''
  const profileLines = ((): string[] => {
    if (ignoreOnly) return ignoreText ? [`Radar profile (ignore only): ${clip(ignoreText, RADAR_PROFILE_CHARS)}`] : []
    if (profileText === null) return ['Radar profile: none.']
    if (!narrow) return ['Radar profile:', clip(profileText, RADAR_PROFILE_CHARS) || '(empty)']
    const lines = [
      ...(sourcesText ? [`Sources: ${clip(sourcesText, RADAR_PROFILE_CHARS)}`] : []),
      ...(ignoreText ? [`Ignore: ${clip(ignoreText, RADAR_PROFILE_CHARS)}`] : []),
    ]
    return lines.length > 0 ? ['Radar profile (sources and ignore only):', ...lines] : [RADAR_PROFILE_SAVED_NOTE]
  })()

  // Study profile (só no caderno; no `all` vai por caderno ativo)
  const study = scope.kind === 'notebook' ? findStudyProfile(inScope, scope.notebook.id) : null
  const studyLine = study
    ? `Study profile: ${clip(oneLine(cleaned(study)), STUDY_PROFILE_CHARS) || '(empty)'}`
    : null

  // Active plans
  const activePlans = plans
    .filter((e) => (e.state === 'active' || e.state === 'overdue') && matches(e.note))
    .slice(0, PLANS_MAX)
  const plansLine =
    activePlans.length > 0
      ? `Active plans: ${activePlans
          .map((e) => `"${titleOf(e.note)}"${e.info.end ? ` (until ${ddmm(e.info.end)})` : ''}`)
          .join(' · ')}`
      : null

  // Top tags
  const topTags = summarizeTags(inScope)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, scope.kind === 'all' ? TOP_TAGS_ALL : TOP_TAGS_NOTEBOOK)
  const tagsLine = topTags.length > 0 ? `Top tags: ${topTags.map((t) => `#${t.tag} (${t.count})`).join(', ')}` : null

  // Books in progress
  const reading = books
    .filter(({ book }) => book.lastOpenedAt != null && book.lastPage < book.totalPages)
    .sort((a, b) => (b.book.lastOpenedAt ?? 0) - (a.book.lastOpenedAt ?? 0))
    .slice(0, BOOKS_MAX)
  const booksLine = reading.length > 0 ? `Books in progress: ${reading.map(readingText).join(' · ')}` : null

  // Recent notes (notebook, tag e board), com orçamento de itens e de caracteres
  const recent: string[] = []
  if (scope.kind !== 'all') {
    let chars = 0
    for (const n of newestFirst) {
      const when = ddmm(dateKeyFromMs(n.updatedAt))
      const nb = scope.kind === 'tag' && n.notebookId ? notebookName.get(n.notebookId) : undefined
      const entry = `"${titleOf(n)}" (${nb ? `${nb}, ` : ''}${when})`
      if (recent.length >= RECENT_TITLES_MAX || chars + entry.length > RECENT_TITLES_CHARS) break
      recent.push(entry)
      chars += entry.length + 2
    }
  }

  // Board: colunas e cards
  const resolved = scope.kind === 'board' ? resolveBoard(scope.type, defs) : null
  const columns =
    scope.kind === 'board' && resolved ? buildBoardColumns(boardNotes(inScope, resolved, scope.type.id), resolved, null) : []
  const cards = columns
    .flatMap((c) => c.notes.map((n) => `"${titleOf(n)}" · ${c.title}`))
    .slice(0, BOARD_CARDS_MAX)

  // `all`: cadernos editados nos últimos 30 dias, com os títulos mais recentes
  const active: Array<{ id: string; name: string; edited: number; latest: number; titles: string[] }> = []
  if (scope.kind === 'all') {
    const since = addDaysKey(todayKey, -ACTIVE_DAYS)
    const byNotebook = new Map<string, Note[]>()
    for (const n of newestFirst) {
      if (!n.notebookId || !notebookName.has(n.notebookId) || dateKeyFromMs(n.updatedAt) < since) continue
      const list = byNotebook.get(n.notebookId)
      if (list) list.push(n)
      else byNotebook.set(n.notebookId, [n])
    }
    for (const [id, ns] of byNotebook) {
      active.push({
        id,
        name: notebookName.get(id)!,
        edited: ns.length,
        latest: ns[0].updatedAt,
        titles: ns.slice(0, TITLES_PER_NOTEBOOK).map((n) => `"${titleOf(n)}"`),
      })
    }
    active.sort((a, b) => b.edited - a.edited || b.latest - a.latest)
    active.splice(ACTIVE_NOTEBOOKS_MAX)
  }
  const studyProfiles = active.flatMap((a) => {
    const p = findStudyProfile(inScope, a.id)
    const body = p ? clip(oneLine(cleaned(p)), STUDY_PROFILE_ALL_CHARS) : ''
    return body ? [`"${a.name}": ${body}`] : []
  })

  const render = (): string => {
    const out = [`Scope: ${scopeLabel(scope)} (${sourceText(scope)})`, ...profileLines]
    if (studyLine) out.push(studyLine)
    if (plansLine) out.push(plansLine)
    if (tagsLine) out.push(tagsLine)
    if (booksLine) out.push(booksLine)
    if (recent.length > 0) out.push(`Recent notes (newest first): ${recent.join(', ')}`)
    if (active.length > 0) {
      out.push(`Active notebooks (last ${ACTIVE_DAYS} days):`)
      for (const a of active) {
        const head = `- "${a.name}" (${a.edited} ${a.edited === 1 ? 'note' : 'notes'} edited)`
        out.push(a.titles.length > 0 ? `${head}: ${a.titles.join(', ')}` : head)
      }
    }
    if (studyProfiles.length > 0) out.push(`Study profiles: ${studyProfiles.join('; ')}`)
    if (scope.kind === 'board' && resolved) {
      out.push(`Board "${scope.type.name}" — columns: ${columns.map((c) => c.title).join(', ')}`)
      if (cards.length > 0) out.push(`Cards: ${cards.join('; ')}`)
    }
    return out.join('\n')
  }

  // Passou do teto: tira títulos do fim das listas de notas e de cards (os
  // perfis e os planos não são cortados além do próprio teto).
  const shrink = (): boolean => {
    for (const list of [recent, cards]) {
      if (list.length > 0) {
        list.pop()
        return true
      }
    }
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].titles.length > 0) {
        active[i].titles.pop()
        return true
      }
    }
    return false
  }
  let text = render()
  while (text.length > FOCUS_MAX_CHARS && shrink()) text = render()

  // Assuntos de reserva: em "tudo", o "Follow" do perfil e as tags; em caderno, tag ou
  // board, o nome do escopo e as tags dele, sem o "Follow" (o perfil é global e não
  // manda no escopo estreito). Nome de caderno só vale com 2+ palavras e nunca no
  // escopo "tudo" nem o do Quick Notes; o nome do tipo do board não é assunto.
  const scopeNames =
    scope.kind === 'notebook' && isSubjectNotebook(scope.notebook)
      ? [scope.notebook.name]
      : scope.kind === 'tag'
        ? [scope.tag]
        : []
  const followTerms = profileText && scope.kind === 'all' && !ignoreOnly ? radarFollowTerms(profileText) : []
  const tagTerms = topTags.map((t) => t.tag)
  const ordered = scope.kind === 'all' ? [...followTerms, ...tagTerms] : [...scopeNames, ...tagTerms]
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of ordered) {
    const term = clip(oneLine(raw), TERM_MAX)
    const key = tagKey(term)
    if (!key || seen.has(key)) continue
    seen.add(key)
    terms.push(term)
    if (terms.length >= TERMS_MAX) break
  }

  return {
    text,
    empty: inScope.length === 0 && (ignoreOnly || narrow || radarProfile === null),
    terms,
    scopeNotebookId: scope.kind === 'notebook' ? scope.notebook.id : null,
    profileUsed: ignoreOnly ? ignoreText !== '' : narrow ? sourcesText !== '' || ignoreText !== '' : radarProfile !== null,
  }
}
