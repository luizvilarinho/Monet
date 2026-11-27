import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowsOutLineHorizontal,
  ArrowUUpLeft,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  Highlighter,
  ListBullets,
  Minus,
  Plus,
  Quotes,
  SidebarSimple,
  Sparkle,
  SpeakerHigh,
  TextAa,
  Trash,
} from '@phosphor-icons/react'
import type {
  Book,
  BookHighlight,
  EpubBook,
  Note,
  Notebook,
  NoteType,
  VocabularyItem,
} from '../../types'
import { storage } from '../../storage'
import { booksReadFile } from '../../lib/books'
import {
  clearEpubSelection,
  detectEpubLanguage,
  displayEpubAt,
  drawEpubHighlight,
  epubCfiFromRange,
  epubCfiInView,
  epubContentsDocuments,
  epubContextText,
  ensureEpubLocations,
  epubCfiPercentage,
  epubHighlightScreenRect,
  epubLiveRange,
  epubLocationOrdinal,
  epubRangeScreenRect,
  epubSelectionOccurrence,
  epubViewKey,
  getEpubLocationText,
  getEpubRangeText,
  loadEpubToc,
  onEpubHighlightClick,
  onEpubSelection,
  onEpubViewClick,
  onEpubViewMouseDown,
  openEpubForReading,
  removeEpubHighlight,
  resizeEpubRendition,
  resolveEpubChapter,
  resumeEpubAt,
  setEpubSpread,
  type EpubBookHandle,
  type EpubLocation,
  type EpubRendition,
  type EpubSpreadMode,
  type EpubTocEntry,
} from '../../lib/epub'
import { useBookQuotes } from '../../hooks/useBookQuotes'
import { useBookVocabulary } from '../../hooks/useBookVocabulary'
import { useColumnBox } from '../../hooks/useColumnBox'
import { useConfirm } from '../../hooks/useConfirm'
import { loadHighlightColor, saveHighlightColor, useHighlights } from '../../hooks/useHighlights'
import { useLanguageSettings } from '../../hooks/useLanguageSettings'
import { useListenPlayer } from '../../hooks/useListenPlayer'
import { useTtsCatalog } from '../../hooks/useTtsCatalog'
import { useReaderTeacher } from '../../hooks/useReaderTeacher'
import { useRetell } from '../../hooks/useRetell'
import { useVocabularyMarks } from '../../hooks/useVocabularyMarks'
import { useVocabularyRemoval } from '../../hooks/useVocabularyRemoval'
import { useVocabularySend } from '../../hooks/useVocabularySend'
import { ownsKeyboard } from '../../lib/keyboardTarget'
import { languageToolsOn } from '../../lib/language'
import { setNativeLanguage, setVocabHideSenses, setVocabMarks } from '../../lib/languageSettings'
import {
  buildJoinedNodeText,
  clearPageMarks,
  markEntryAtPoint,
  rangeFromNodeOffsets,
  setPageMarks,
  type MarkEntry,
} from '../../lib/pageMarks'
import { buildFeedbackMessage } from '../../lib/retell'
import { splitSentences } from '../../lib/sentences'
import { isTtsError, ttsErrorSentence } from '../../lib/speech'
import { TRANSLATE_CHAR_LIMIT, classifySelection, type Translation } from '../../lib/translate'
import { buildListenSource, translationFields, type VocabularyDraft } from '../../lib/vocabulary'
import { contextSentenceAt, epubSentenceAnchors, findTermOccurrences, type MatchTerm } from '../../lib/vocabMatch'
import { LanguageBar } from '../LanguageTools/LanguageBar'
import { MiniPlayer } from '../LanguageTools/MiniPlayer'
import { SavedWordPopover } from '../LanguageTools/SavedWordPopover'
import { SendVocabularyModal } from '../LanguageTools/SendVocabularyModal'
import { TranslatePopover } from '../LanguageTools/TranslatePopover'
import { VocabularyTab } from '../LanguageTools/VocabularyTab'
import type { SettingsSection } from '../Settings/SettingsModal'
import { QuoteToNoteModal } from './QuoteToNoteModal'
import { ReaderChatPanel } from './ReaderChatPanel'
import { ReaderNotesPanel } from './ReaderNotesPanel'
import { useReaderToast } from './ReaderToast'
import { placeSelectionToolbar, type PlacementAnchor } from './toolbarPlacement'
import styles from './EpubReader.module.css'

export interface EpubReaderProps {
  // Este é o leitor de EPUB: o tipo impede que um PDF chegue aqui por engano.
  book: EpubBook
  onBack: () => void
  onBookChange: (book: Book) => void
  // A língua do livro foi detectada (primeira abertura) ou corrigida: o Library
  // atualiza o `book` que passa ao leitor.
  onBookLanguageChange: (language: string) => void
  // Chamado quando o documento não pôde ser carregado (arquivo ausente/ilegível).
  onLoadError?: () => void
  notebooks: Notebook[]
  notes: Note[]
  // Tipos de nota (vêm da janela principal): o escolhido no painel de notas
  // vale para a próxima nota criada.
  noteTypes: NoteType[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  // `requestId` fica no 4º lugar (mesma assinatura do Chat) e o `typeId` no 5º.
  onCreateNote: (
    notebookId: string,
    title: string,
    content: string,
    requestId?: string,
    typeId?: string | null,
  ) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  // Abre o Settings do app (ModelSelector e faixa sem chave do chat).
  onOpenSettings: () => void
  // Abre o Settings numa seção (o "Open Settings" do Translate sem chave).
  onOpenSettingsSection: (section: SettingsSection) => void
  // O Mincer está gravando: o áudio do Listen entraria na gravação.
  mincerRecording: boolean
  // Cadernos com a IA desligada: a nota de perfil de língua de um deles não vale
  // para o professor de língua.
  disabledNotebookIds: ReadonlySet<string>
  // Tela de livro sem arquivo: tira o livro da Library (com confirmação).
  onRemoveBook?: () => void
}

// Tamanho do texto, não escala de imagem: a faixa do leitor de PDF (0,5–3,0)
// é de zoom de página renderizada e não faz sentido aqui. 80%–200% cobre o uso
// real de leitura e cabe dentro do clamp do storage (0,5–3,0), então a coluna
// `zoom` é reaproveitada sem mudança de schema.
const MIN_FONT_SCALE = 0.8
const MAX_FONT_SCALE = 2
const FONT_SCALE_STEP = 0.1
const SAVE_DEBOUNCE_MS = 500
// Repaginar é caro (limpa e re-renderiza a seção inteira); arrastar a borda da
// janela dispara resize continuamente. O debounce concentra tudo num repaginar
// só, quando o usuário para de arrastar.
const RESIZE_DEBOUNCE_MS = 150

const SIDE_PANEL_COLLAPSED_KEY = 'monet:epub-reader-sidepanel-collapsed'
const SIDE_PANEL_WIDTH = 280
// Com as ferramentas de língua a coluna ganha a aba Vocabulary e fica mais larga.
const SIDE_PANEL_WIDTH_WITH_TOOLS = 300
const SIDE_PANEL_COLLAPSED_WIDTH = 48

// Mesma paleta do leitor de PDF (duplicação deliberada — os leitores são
// independentes por decisão de arquitetura).
const HIGHLIGHT_COLORS = ['#FFEB3B', '#A5D6A7', '#90CAF9', '#F48FB1']
// Nomes legíveis para os swatches de cor, usados em aria-label.
const HIGHLIGHT_COLOR_NAMES: Record<string, string> = {
  '#FFEB3B': 'yellow',
  '#A5D6A7': 'green',
  '#90CAF9': 'blue',
  '#F48FB1': 'pink',
}
// Acima disso o painel de grifos ganha o campo de busca.
const HIGHLIGHT_SEARCH_MIN = 15

// Toggle da coluna lateral (Chat/Notes): mesmas chaves do leitor de PDF — os
// painéis são idênticos nos dois formatos, então a preferência é a mesma.
const SIDE_OPEN_KEY = 'monet:reader-chat-open'
const SIDE_TAB_KEY = 'monet:reader-side-tab'

// Diagramação do texto: 'auto' = 2 colunas acima de 800 px de largura
// (default do epubjs), 'none' = sempre 1 coluna. É preferência global de
// leitura (como a do painel lateral), não estado do livro — por isso
// localStorage e não uma coluna nova no banco.
const SPREAD_MODE_KEY = 'monet:epub-reader-spread'
const MARGIN_KEY = 'monet:epub-reader-margin'
const MIN_MARGIN_PX = 0
const MAX_MARGIN_PX = 160
const MARGIN_STEP_PX = 16
const DEFAULT_MARGIN_PX = 0

type SidePanelTab = 'contents' | 'highlights' | 'vocabulary'
type SideTab = 'chat' | 'notes'

interface PagePoint {
  x: number
  y: number
  w: number
  h: number
}

interface SelectionState {
  cfiRange: string
  text: string
  anchor: PagePoint
}

interface RemovalCandidate {
  highlight: BookHighlight
  anchor: PagePoint
}

// Translate aberto para uma seleção (identificada pelo cfiRange). O anchor é o
// retângulo da seleção em coordenadas da janela: no EPUB a página não rola, e
// a virada de página fecha o popover.
interface TranslateState {
  cfiRange: string
  text: string
  sentence: string
  positionLabel: string
  anchor: PlacementAnchor
}

function formatHighlightDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return ''
  }
}

function formatShortDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString()
  } catch {
    return ''
  }
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max).trimEnd() + '…'
}

// Rótulo da citação no EPUB: nome do capítulo vindo do TOC + porcentagem.
// Sem capítulo resolvível (livro sem TOC, posição antes da primeira entrada)
// cai no fallback "só %" — nunca um número de capítulo gerado por nós.
function epubCitationLabel(chapter: string | null, percent: number): string {
  return chapter ? `${chapter}, ${percent}%` : `${percent}%`
}

// Aceita qualquer valor vindo do banco — inclusive de um livro gravado com a
// faixa de zoom do PDF — sem quebrar a renderização.
function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return 1
  const clamped = Math.min(Math.max(MIN_FONT_SCALE, value), MAX_FONT_SCALE)
  // Arredonda para o passo: evita 0.7999999 vindo de somas de float e mantém
  // o rótulo em porcentagem inteira.
  return Math.round(clamped * 100) / 100
}

function clampMargin(raw: number): number {
  const clamped = Math.min(MAX_MARGIN_PX, Math.max(MIN_MARGIN_PX, raw))
  return Math.round(clamped / MARGIN_STEP_PX) * MARGIN_STEP_PX
}

function fontSizeCss(scale: number): string {
  return `${Math.round(scale * 100)}%`
}

interface TocListProps {
  items: EpubTocEntry[]
  depth: number
  onNavigate: (href: string) => void
}

function TocList({ items, depth, onNavigate }: TocListProps) {
  return (
    <ul className={styles.tocList} data-depth={depth}>
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            className={styles.tocItem}
            disabled={item.href == null}
            title={item.label}
            onClick={() => item.href != null && onNavigate(item.href)}
          >
            <span className={styles.tocItemLabel}>{item.label}</span>
          </button>
          {item.items.length > 0 && (
            <TocList items={item.items} depth={depth + 1} onNavigate={onNavigate} />
          )}
        </li>
      ))}
    </ul>
  )
}

export function EpubReader({
  book,
  onBack,
  onBookChange,
  onBookLanguageChange,
  onLoadError,
  notebooks,
  notes,
  noteTypes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  onOpenSettings,
  onOpenSettingsSection,
  mincerRecording,
  disabledNotebookIds,
  onRemoveBook,
}: EpubReaderProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // `null` = sumário ainda carregando; array vazio = livro sem sumário útil.
  const [toc, setToc] = useState<EpubTocEntry[] | null>(null)
  const [percent, setPercent] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  // Inicializa a partir do livro persistido, como o zoom do leitor de PDF: o
  // componente é remontado pelo Library a cada troca de livro.
  const [fontScale, setFontScale] = useState(() => clampFontScale(book.zoom))
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(
    () => localStorage.getItem(SIDE_PANEL_COLLAPSED_KEY) !== '0',
  )

  const { toast, showToast } = useReaderToast()
  const {
    highlights,
    orderedHighlights,
    filteredHighlights,
    colorFilter,
    setColorFilter,
    textFilter,
    setTextFilter,
    persistHighlight,
    removeHighlight,
    changeColor,
  } = useHighlights(book.id, (message) => showToast({ message, tone: 'error' }))
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const languageSettings = useLanguageSettings()
  // Ferramentas de língua (Translate): só em livro de outra língua, ou como
  // o Settings › Language mandar. Sem elas o leitor fica como sempre foi.
  const toolsOn = languageToolsOn(book.language, languageSettings.nativeLanguage, languageSettings.toolsMode)
  const [translate, setTranslate] = useState<TranslateState | null>(null)
  // Última cor usada (comum aos leitores): é a do atalho H.
  const [activeColor, setActiveColor] = useState<string>(() =>
    loadHighlightColor(HIGHLIGHT_COLORS),
  )
  const [removalCandidate, setRemovalCandidate] =
    useState<RemovalCandidate | null>(null)
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('contents')
  // Posição de onde o usuário saiu ao seguir um grifo/item do sumário —
  // paridade com o `jumpBackPage` do leitor de PDF.
  const [jumpBack, setJumpBack] = useState<{
    cfi: string
    percent: number
  } | null>(null)
  const [sideOpen, setSideOpen] = useState(
    () => localStorage.getItem(SIDE_OPEN_KEY) === '1',
  )
  const [sideTab, setSideTab] = useState<SideTab>(() =>
    localStorage.getItem(SIDE_TAB_KEY) === 'notes' ? 'notes' : 'chat',
  )
  const [pendingQuote, setPendingQuote] = useState<{
    text: string
    page: number
    positionLabel?: string
  } | null>(null)
  const [spreadMode, setSpreadMode] = useState<EpubSpreadMode>(() =>
    localStorage.getItem(SPREAD_MODE_KEY) === 'none' ? 'none' : 'auto',
  )
  const [marginPx, setMarginPx] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(MARGIN_KEY)
      if (raw == null) return DEFAULT_MARGIN_PX
      const n = Number(raw)
      return Number.isFinite(n) ? clampMargin(n) : DEFAULT_MARGIN_PX
    } catch {
      return DEFAULT_MARGIN_PX
    }
  })
  // Ordinal de location 1-based (o "page" do EPUB) e CFI da posição atual —
  // alimentam chat, grifos e o jump-back.
  const [pageNum, setPageNum] = useState(book.lastPage)
  const [positionCfi, setPositionCfi] = useState<string | null>(book.cfi)
  // Capítulo da posição atual (nome do TOC), para o rótulo de posição do chat.
  const [chapter, setChapter] = useState<string | null>(null)
  const showNotesTab = useCallback(() => {
    setSideTab('notes')
    setSideOpen(true)
  }, [])
  const {
    addQuoteToNote,
    addToNoteTitle,
    openNote,
    showNote,
    viewRequest,
    linkVersion,
    modal: quoteModal,
  } = useBookQuotes({
    bookId: book.id,
    bookTitle: book.title,
    notes,
    notebooks,
    onSaveNote,
    showToast,
    onShowNotes: showNotesTab,
  })
  const { confirm, modal: confirmModal } = useConfirm()

  const viewerRef = useRef<HTMLDivElement>(null)
  const pageAreaRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const translatePopoverRef = useRef<HTMLDivElement>(null)
  // Leitura em voz alta (Listen): o player, o catálogo de modelos de voz e a medida
  // da coluna da página, de que o mini-player (`fixed`) se alinha. O catálogo só
  // é buscado com as ferramentas de língua ligadas.
  const catalog = useTtsCatalog(toolsOn)
  const player = useListenPlayer({
    bookId: book.id,
    mincerRecording,
    showToast,
    models: catalog.models,
    language: book.language ?? '',
  })
  const [playerHeight, setPlayerHeight] = useState(0)
  const columnBox = useColumnBox(pageAreaRef, player.open)
  // Vocabulário do livro (aba Vocabulary): só com as ferramentas de língua.
  const vocabulary = useBookVocabulary(book, toolsOn)
  const vocabSend = useVocabularySend({
    book,
    items: vocabulary.items,
    notes,
    notebooks,
    noteTypes,
    onCreateNotebook,
    onCreateNote,
    onSaveNote,
    showToast,
    showNote,
    markSent: vocabulary.markSent,
  })
  // O professor de língua do chat, o "Retell" da aba e o "Ask for feedback" da aba
  // Notes, que manda o reconto ao chat com o professor ligado.
  const pageItems = useMemo(
    () => vocabulary.items.filter((item) => item.page === pageNum),
    [vocabulary.items, pageNum],
  )
  const { teacher, turnOn: turnTeacherOn } = useReaderTeacher({
    book,
    toolsOn,
    nativeLanguage: languageSettings.nativeLanguage,
    notes,
    disabledNotebookIds,
    pageItems,
  })
  const [pendingSend, setPendingSend] = useState<{ text: string } | null>(null)
  const retell = useRetell({
    book,
    format: 'epub',
    items: vocabulary.items,
    selectedIds: vocabSend.selectedIds,
    notes,
    notebooks,
    noteTypes,
    onCreateNotebook,
    onCreateNote,
    onSaveNote,
    showToast,
    openNote,
  })
  // O "Translate" de um item da aba que não tem tradução: o popover abre ao lado
  // do botão, sem depender da seleção do texto.
  const [itemTranslate, setItemTranslate] = useState<{
    item: VocabularyItem
    anchor: PlacementAnchor
  } | null>(null)
  const itemPopoverRef = useRef<HTMLDivElement>(null)
  // Marca no texto: as palavras e frases guardadas neste livro e nos outros da mesma
  // língua. Os ranges de cada marca ficam num ref para o clique achar a palavra.
  const marksEnabled = toolsOn && languageSettings.vocabMarks
  const marks = useVocabularyMarks({ book, enabled: marksEnabled, bookItems: vocabulary.items })
  const markEntriesRef = useRef<MarkEntry[]>([])
  // O capítulo inteiro está no DOM: as ocorrências de um documento só se refazem
  // quando a lista de formas muda, não a cada virada de página.
  const docMarksRef = useRef(new WeakMap<Document, { terms: MatchTerm[]; entries: MarkEntry[] }>())
  const removeVocabularyItems = useVocabularyRemoval({ vocabulary, showToast })
  // O clique numa palavra marcada ("onde você guardou") e o "Translate here" dela.
  const [savedWord, setSavedWord] = useState<{
    itemIds: string[]
    term: string
    range: Range
    anchor: PlacementAnchor
  } | null>(null)
  const savedWordRef = useRef<HTMLDivElement>(null)
  const [hereTranslate, setHereTranslate] = useState<{
    cfiRange: string
    text: string
    sentence: string
    positionLabel: string
    anchor: PlacementAnchor
  } | null>(null)
  const herePopoverRef = useRef<HTMLDivElement>(null)
  // Sobe a cada `markClicked` de um grifo: o clique que um grifo tratou não abre o
  // "onde você guardou" da palavra que está embaixo dele.
  const highlightClickSeqRef = useRef(0)
  // CFI da seleção que o player lê: a faixa cinza se refaz a partir dele a cada
  // virada de página e troca de capítulo (o iframe é outro documento).
  const listenCfiRef = useRef<string | null>(null)
  // O que a tela mostra (início e fim do último `relocated`): muda a cada virada de
  // página e a cada repaginação que mexe no que se vê. É por ela, e não pelo
  // ordinal da location, que o áudio sabe se o texto lido saiu da tela.
  const [viewKey, setViewKey] = useState('')
  const viewKeyRef = useRef('')
  const renditionRef = useRef<EpubRendition | null>(null)
  const bookHandleRef = useRef<EpubBookHandle | null>(null)
  // Marcas desenhadas no marks-pane, por id de grifo — é o que permite à
  // sincronização desenhar/remover só o que mudou.
  const drawnRef = useRef<Map<string, { cfi: string; color: string }>>(
    new Map(),
  )
  // Última posição reportada pelo epubjs. É a âncora usada para reposicionar
  // depois de repaginar (mudança de tamanho de fonte).
  const currentCfiRef = useRef<string | null>(null)
  // Início e fim do que está na tela (as duas colunas, no spread): é o texto
  // que vai no contexto do chat.
  const visibleRangeRef = useRef<{ start: string; end: string } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPositionRef = useRef<{ cfi: string; page: number | null } | null>(
    null,
  )
  // Debounce independente para o tamanho da fonte, análogo ao par
  // page/zoom do leitor de PDF: o flush de um não depende do outro.
  const saveFontTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFontRef = useRef<number | null>(null)
  const fontScaleRef = useRef(fontScale)
  fontScaleRef.current = fontScale

  const bookRef = useRef(book)
  bookRef.current = book
  const onBookChangeRef = useRef(onBookChange)
  onBookChangeRef.current = onBookChange
  const onBookLanguageChangeRef = useRef(onBookLanguageChange)
  onBookLanguageChangeRef.current = onBookLanguageChange
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError
  const tocRef = useRef(toc)
  tocRef.current = toc
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights
  const spreadModeRef = useRef(spreadMode)
  spreadModeRef.current = spreadMode

  // ─── Persistência de posição (cfi + ordinal de location) ────────────────
  const flushPendingPosition = useCallback(() => {
    const pending = pendingPositionRef.current
    if (pending == null) return
    pendingPositionRef.current = null
    const current = bookRef.current
    const updated: EpubBook = {
      ...current,
      cfi: pending.cfi,
      lastPage:
        pending.page == null
          ? current.lastPage
          : Math.min(Math.max(1, pending.page), current.totalPages),
    }
    void storage
      .saveBook(updated)
      .catch((err) => console.error('failed to save epub position', err))
    onBookChangeRef.current(updated)
  }, [])

  const schedulePositionSave = useCallback(
    (cfi: string, page: number | null) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const current = bookRef.current
      if (cfi === current.cfi && (page == null || page === current.lastPage)) {
        pendingPositionRef.current = null
        return
      }
      pendingPositionRef.current = { cfi, page }
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        flushPendingPosition()
      }, SAVE_DEBOUNCE_MS)
    },
    [flushPendingPosition],
  )

  const flushPendingFont = useCallback(() => {
    const scale = pendingFontRef.current
    if (scale == null) return
    pendingFontRef.current = null
    const updated: EpubBook = { ...bookRef.current, zoom: scale }
    void storage
      .saveBook(updated)
      .catch((err) => console.error('failed to save epub font size', err))
    onBookChangeRef.current(updated)
  }, [])

  // Faixa cinza do trecho em leitura: o Range vivo vem do CFI da seleção, no
  // documento da seção exibida. Refeita a cada virada de página e troca de capítulo.
  function applyListenMark() {
    const rendition = renditionRef.current
    const cfi = listenCfiRef.current
    const range = rendition && cfi ? epubLiveRange(rendition, cfi) : null
    if (range) setPageMarks('listen', [range])
    else clearPageMarks('listen')
  }
  const applyListenMarkRef = useRef(applyListenMark)
  applyListenMarkRef.current = applyListenMark

  // Pontilhado das palavras guardadas: todas as ocorrências da forma guardada e da
  // base, por palavra inteira, em cada documento exibido, e as frases guardadas
  // neste livro, no lugar de origem. As palavras vêm antes das frases na lista (o
  // clique vale a primeira que contém o ponto). Refeito a cada virada de página e
  // troca de capítulo.
  function applyVocabMarks() {
    const rendition = renditionRef.current
    if (!rendition || !marksEnabled) {
      markEntriesRef.current = []
      clearPageMarks('vocab')
      return
    }
    const entries: MarkEntry[] = []
    for (const doc of epubContentsDocuments(rendition)) {
      let cached = docMarksRef.current.get(doc)
      if (!cached || cached.terms !== marks.terms) {
        const { text, nodes } = buildJoinedNodeText(doc.body)
        const found: MarkEntry[] = []
        for (const occurrence of findTermOccurrences(text, marks.terms)) {
          const range = rangeFromNodeOffsets(doc, nodes, occurrence.start, occurrence.end)
          if (range) found.push({ range, itemIds: occurrence.itemIds })
        }
        cached = { terms: marks.terms, entries: found }
        docMarksRef.current.set(doc, cached)
      }
      entries.push(...cached.entries)
    }
    for (const anchor of epubSentenceAnchors(marks.items, book.id)) {
      const range = epubLiveRange(rendition, anchor.cfiRange)
      if (range) entries.push({ range, itemIds: [anchor.itemId] })
    }
    markEntriesRef.current = entries
    if (entries.length > 0) setPageMarks('vocab', entries.map((entry) => entry.range))
    else clearPageMarks('vocab')
  }
  const applyVocabMarksRef = useRef(applyVocabMarks)
  applyVocabMarksRef.current = applyVocabMarks

  // A lista de itens mudou (guardar, remover, a chave "Mark in text", as
  // ferramentas de língua): refaz as marcas do que está na tela.
  useEffect(() => {
    applyVocabMarksRef.current()
  }, [marksEnabled, marks.terms, marks.items])
  useEffect(() => () => clearPageMarks('vocab'), [])

  // ─── Navegação ──────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    void renditionRef.current?.next().catch(() => {})
  }, [])

  const goPrevious = useCallback(() => {
    void renditionRef.current?.prev().catch(() => {})
  }, [])

  // Atalhos do leitor (ignorando inputs/textarea/contenteditable): ←/→ trocam
  // de página, Esc fecha a toolbar de seleção e o popover do grifo, H grifa a
  // seleção com a última cor, T traduz e V guarda a seleção no vocabulário. O
  // listener dentro do iframe é registrado uma
  // vez, na carga; a ref, trocada a cada render, mantém o handler atual (e a
  // seleção atual) sem precisar reregistrar.
  const handleKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  handleKeyRef.current = (e: KeyboardEvent) => {
    // Campo, <select> (o do menu do player, o do Translate) e modal ficam com as
    // teclas deles, setas inclusive.
    if (ownsKeyboard(e.target)) return
    // Com o player aberto: Espaço toca e pausa, R repete e Shift+←/→ pulam de
    // frase, sem virar a página. L lê a seleção, ou o trecho visível.
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey
    if (plain && player.open) {
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        if (e.key === 'ArrowLeft') player.prev()
        else player.next()
        return
      }
      if (e.key === ' ') {
        // Com o foco num botão, o Espaço também o acionaria: o preventDefault o impede.
        e.preventDefault()
        if (!e.repeat) player.toggle()
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        player.repeat()
        return
      }
    }
    if (plain && toolsOn && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault()
      if (selection) handleListen()
      else void handleListenPage()
      return
    }
    if (e.key === 'ArrowLeft') goPrevious()
    else if (e.key === 'ArrowRight') goNext()
    else if (e.key === 'Escape' && translate) {
      // Fecha o popover e devolve a barra; o Esc seguinte limpa a seleção.
      setTranslate(null)
    } else if (e.key === 'Escape' && (selection || removalCandidate)) {
      setSelection(null)
      setRemovalCandidate(null)
      clearIframeSelection()
    } else if (
      (e.key === 't' || e.key === 'T') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      toolsOn &&
      selection &&
      !translate
    ) {
      e.preventDefault()
      void handleTranslate()
    } else if (
      (e.key === 'v' || e.key === 'V') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      toolsOn &&
      selection &&
      !translate
    ) {
      e.preventDefault()
      void handleAddToVocabulary()
    } else if (
      (e.key === 'h' || e.key === 'H') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      selection
    ) {
      e.preventDefault()
      void handleHighlight(activeColor)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      handleKeyRef.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── Carga do livro (uma vez por livro) + last_opened_at ────────────────
  useEffect(() => {
    let cancelled = false
    let handle: EpubBookHandle | null = null
    let observer: ResizeObserver | null = null
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let offSelection: (() => void) | null = null
    let offMarkClick: (() => void) | null = null
    let offViewMouseDown: (() => void) | null = null
    let offViewClick: (() => void) | null = null

    const opened: EpubBook = { ...bookRef.current, lastOpenedAt: Date.now() }
    onBookChangeRef.current(opened)
    void storage
      .saveBook(opened)
      .catch((err) => console.error('failed to save last_opened_at', err))

    // Desmontar durante a carga: o cleanup pode ter rodado ANTES de `handle`
    // existir, e aí o book aberto depois ficaria sem dono (iframe e blob URLs
    // vazados). Toda checagem de cancelamento passa por aqui.
    const aborted = () => {
      if (!cancelled) return false
      handle?.destroy()
      handle = null
      return true
    }

    void (async () => {
      try {
        const data = await booksReadFile(opened.filePath)
        if (aborted()) return
        handle = await openEpubForReading(data)
        if (aborted()) return

        const { locationsJson, regenerated } = await ensureEpubLocations(
          handle,
          opened.locationsJson,
        )
        if (aborted()) return
        if (regenerated) {
          // Cache ausente/corrompido: grava o novo para que a próxima abertura
          // não pague a geração de novo, junto com o total recalculado.
          const updated: EpubBook = {
            ...bookRef.current,
            locationsJson,
            totalPages: Math.max(1, handle.locations.length()),
          }
          onBookChangeRef.current(updated)
          void storage
            .saveBook(updated)
            .catch((err) => console.error('failed to save epub locations', err))
        }

        // Primeira abertura de um livro sem língua verificada (importado antes
        // desta feature): metadado do OPF e, sem ele, amostra do texto. Antes do
        // renderTo, porque a amostra descarrega as seções.
        if (opened.language === null) {
          const language = await detectEpubLanguage(handle)
          if (aborted()) return
          void storage
            .setBookLanguage(opened.id, language)
            .catch((err) => console.error('failed to save book language', err))
          onBookLanguageChangeRef.current(language)
        }

        // O sumário carrega em paralelo com o texto: um livro sem navegação
        // utilizável não pode atrasar a primeira página.
        void loadEpubToc(handle).then((entries) => {
          if (!cancelled) setToc(entries)
        })

        const element = viewerRef.current
        if (aborted()) return
        if (!element) {
          handle.destroy()
          handle = null
          return
        }
        // width/height em porcentagem (não em px): é o que faz o epubjs
        // remedir pelo elemento pai a cada repaginação, em vez de congelar um
        // tamanho. Ver resizeEpubRendition. `spread` vem da preferência do
        // usuário ('auto' = 2 colunas acima de 800 px; 'none' = 1 coluna).
        const rendition = handle.renderTo(element, {
          width: '100%',
          height: '100%',
          spread: spreadModeRef.current,
        })
        renditionRef.current = rendition
        bookHandleRef.current = handle
        rendition.themes.fontSize(fontSizeCss(fontScaleRef.current))

        rendition.on('relocated', (location: EpubLocation) => {
          const start = location?.start
          if (cancelled || !start) return
          currentCfiRef.current = start.cfi
          const end = location.end?.cfi
          visibleRangeRef.current = end ? { start: start.cfi, end } : null
          viewKeyRef.current = epubViewKey(start.cfi, end)
          setViewKey(viewKeyRef.current)
          setAtStart(location.atStart === true)
          setAtEnd(location.atEnd === true)
          setPercent(
            typeof start.percentage === 'number'
              ? Math.round(start.percentage * 100)
              : 0,
          )
          setPositionCfi(start.cfi)
          // `location` do epubjs é índice 0-based nas locations; `lastPage` é
          // ordinal 1-based nos dois formatos.
          const page =
            typeof start.location === 'number' && start.location >= 0
              ? start.location + 1
              : null
          if (page != null) setPageNum(page)
          // Navegar/repaginar limpa seleção e popover: os anchors de tela
          // ficam obsoletos no novo layout e a seleção do iframe não pode
          // sobrar (azulada) ao voltar à página.
          setSelection(null)
          setRemovalCandidate(null)
          clearEpubSelection(rendition)
          setSavedWord(null)
          setHereTranslate(null)
          schedulePositionSave(start.cfi, page)
          applyListenMarkRef.current()
          applyVocabMarksRef.current()
        })
        // Capítulo novo = documento novo no iframe: a faixa cinza e o pontilhado se refazem.
        rendition.on('rendered', () => {
          if (cancelled) return
          applyListenMarkRef.current()
          applyVocabMarksRef.current()
        })
        // O texto do livro vive num iframe: sem isto, as setas param de
        // funcionar assim que o foco entra nele.
        rendition.on('keydown', (e: KeyboardEvent) => handleKeyRef.current(e))

        // ─── Seleção e clique em grifo (eventos do epubjs sobre o iframe) ──
        offSelection = onEpubSelection(rendition, (sel) => {
          if (cancelled) return
          const area = pageAreaRef.current?.getBoundingClientRect()
          if (!area) return
          setSelection({
            cfiRange: sel.cfiRange,
            text: sel.text,
            anchor: {
              x: sel.rect.left - area.left,
              y: sel.rect.top - area.top,
              w: sel.rect.width,
              h: sel.rect.height,
            },
          })
          setRemovalCandidate(null)
        })
        offMarkClick = onEpubHighlightClick(rendition, (cfi) => {
          if (cancelled) return
          highlightClickSeqRef.current += 1
          const h = highlightsRef.current.find((x) => x.cfi === cfi)
          const rect = epubHighlightScreenRect(rendition, cfi)
          const area = pageAreaRef.current?.getBoundingClientRect()
          if (!h || !rect || !area) return
          setRemovalCandidate({
            highlight: h,
            anchor: {
              x: rect.left - area.left,
              y: rect.top - area.top,
              w: rect.width,
              h: rect.height,
            },
          })
          setSelection(null)
        })
        // Cliques dentro do iframe não chegam ao documento pai: sem isto a
        // toolbar/popover nunca fechariam ao clicar no texto.
        offViewMouseDown = onEpubViewMouseDown(rendition, () => {
          if (cancelled) return
          setSelection(null)
          setRemovalCandidate(null)
          setSavedWord(null)
          // Os popovers (Translate de um item ou de uma palavra marcada) e o menu ⋯ do
          // player fecham no clique fora, que eles escutam no documento pai: o clique
          // no iframe chega a eles como um mousedown fora de tudo.
          document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        })
        // O clique numa palavra ou frase guardada abre o "onde você guardou". O grifo
        // tem prioridade: o clique que o grifo tratou (o `markClicked` chega na mesma
        // rodada do evento) não abre nada, e uma seleção em curso também não.
        offViewClick = onEpubViewClick(rendition, (event, doc) => {
          if (cancelled || markEntriesRef.current.length === 0) return
          if (doc.defaultView?.getSelection()?.toString().trim()) return
          const clickSeq = highlightClickSeqRef.current
          const { clientX, clientY } = event
          setTimeout(() => {
            if (cancelled || highlightClickSeqRef.current !== clickSeq) return
            const inDoc = markEntriesRef.current.filter(
              (entry) => entry.range.startContainer.ownerDocument === doc,
            )
            const entry = markEntryAtPoint(inDoc, clientX, clientY)
            if (entry) openSavedWordRef.current(entry)
          }, 0)
        })

        try {
          await resumeEpubAt(rendition, opened.cfi ?? undefined)
        } catch {
          // CFI salvo que não resolve mais (arquivo trocado por outra edição
          // com o mesmo nome): cai no início em vez de não abrir.
          await rendition.display()
        }
        if (aborted()) return
        setLoading(false)

        // Repagina quando o CONTAINER muda de tamanho, e não só a janela:
        // recolher/expandir o painel lateral muda a largura sem nenhum resize
        // de window.
        // `observe()` entrega uma notificação inicial mesmo sem mudança de
        // tamanho (é o que a especificação manda). O `resizeEpubRendition` é
        // inofensivo nela — o guard de `_stageSize` do epubjs o torna no-op —,
        // mas o reposicionamento abaixo NÃO tem esse guard. Sem comparar o
        // tamanho, toda abertura de livro chamaria `displayEpubAt` no CFI de
        // início da página atual, que é justamente a operação imprecisa medida
        // na B1 (14 de 40 páginas em spread): o livro abriria no lugar certo e
        // voltaria uma página sozinho ~150 ms depois, e o `relocated` seguinte
        // gravaria a posição errada — fazendo a leitura derivar para trás a
        // cada sessão.
        let lastWidth = element.clientWidth
        let lastHeight = element.clientHeight
        observer = new ResizeObserver(() => {
          if (resizeTimer) clearTimeout(resizeTimer)
          resizeTimer = setTimeout(() => {
            resizeTimer = null
            if (cancelled || !renditionRef.current) return
            const width = element.clientWidth
            const height = element.clientHeight
            if (width === lastWidth && height === lastHeight) return
            lastWidth = width
            lastHeight = height
            const current = renditionRef.current
            const cfi = currentCfiRef.current
            resizeEpubRendition(current)
            // O display interno do epubjs no resize é de passada ÚNICA e pode
            // parar muito antes do alvo quando a repaginação é drástica
            // (medido no harness: −165 locations ao estreitar de 820 para
            // 560 px no fim do livro — o mesmo clamp da B1). Reposicionar no
            // CFI de antes do resize é a correção já validada para a fonte.
            if (cfi) void displayEpubAt(current, cfi).catch(() => {})
          }, RESIZE_DEBOUNCE_MS)
        })
        observer.observe(element)
      } catch {
        if (!cancelled) {
          setError(
            "This book's file could not be found or opened. It may have been moved or deleted.",
          )
          setLoading(false)
          onLoadErrorRef.current?.()
        }
      }
    })()

    return () => {
      cancelled = true
      if (resizeTimer) clearTimeout(resizeTimer)
      observer?.disconnect()
      offSelection?.()
      offMarkClick?.()
      offViewMouseDown?.()
      offViewClick?.()
      renditionRef.current = null
      bookHandleRef.current = null
      // `book.destroy()` já destrói a rendition (e com ela o iframe e o
      // listener de resize do epubjs); destruir os dois causaria dupla
      // destruição do manager.
      handle?.destroy()
    }
  }, [schedulePositionSave])

  // Flush dos dois debounces no unmount, como no leitor de PDF.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      flushPendingPosition()
    }
  }, [flushPendingPosition])

  useEffect(() => {
    return () => {
      if (saveFontTimerRef.current) clearTimeout(saveFontTimerRef.current)
      flushPendingFont()
    }
  }, [flushPendingFont])

  useEffect(() => {
    try {
      localStorage.setItem(
        SIDE_PANEL_COLLAPSED_KEY,
        sidePanelCollapsed ? '1' : '0',
      )
    } catch (err) {
      console.error('failed to persist epub reader side panel toggle', err)
    }
  }, [sidePanelCollapsed])

  // Persistência do toggle/aba da coluna lateral (Chat/Notes) e da
  // diagramação — mesmas chaves do leitor de PDF para os painéis.
  useEffect(() => {
    try {
      localStorage.setItem(SIDE_OPEN_KEY, sideOpen ? '1' : '0')
    } catch (err) {
      console.error('failed to persist epub reader side toggle', err)
    }
  }, [sideOpen])

  useEffect(() => {
    try {
      localStorage.setItem(SIDE_TAB_KEY, sideTab)
    } catch (err) {
      console.error('failed to persist epub reader side tab', err)
    }
  }, [sideTab])

  useEffect(() => {
    try {
      localStorage.setItem(SPREAD_MODE_KEY, spreadMode)
    } catch (err) {
      console.error('failed to persist epub reader spread mode', err)
    }
  }, [spreadMode])

  useEffect(() => {
    try {
      localStorage.setItem(MARGIN_KEY, String(marginPx))
    } catch (err) {
      console.error('failed to persist epub reader margin', err)
    }
  }, [marginPx])

  // Capítulo da posição atual, resolvido a cada mudança de posição ou quando
  // o sumário termina de carregar (a resolução precisa dos dois prontos).
  useEffect(() => {
    const handle = bookHandleRef.current
    if (!handle || !toc || !positionCfi) return
    let cancelled = false
    void resolveEpubChapter(handle, toc, positionCfi)
      .then((label) => {
        if (!cancelled) setChapter(label)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [toc, positionCfi])

  // O marcador de retorno some sozinho assim que o usuário chega de volta na
  // posição de origem — por qualquer meio, não só pelo botão "Back".
  useEffect(() => {
    setJumpBack((prev) => (prev && prev.cfi === positionCfi ? null : prev))
  }, [positionCfi])

  // Sincroniza as marcas do marks-pane com os grifos do estado: desenha os
  // novos, redesenha os que mudaram de cor, remove os apagados. CFI que não
  // resolve mais (arquivo trocado de edição) é pulado pelo drawEpubHighlight
  // — o item do painel continua legível e citável.
  useEffect(() => {
    if (loading) return
    const rendition = renditionRef.current
    const handle = bookHandleRef.current
    if (!rendition || !handle) return
    let cancelled = false
    void (async () => {
      const want = new Map<string, BookHighlight>()
      for (const h of highlights) {
        if (h.cfi) want.set(h.id, h)
      }
      for (const [id, drawn] of drawnRef.current) {
        const h = want.get(id)
        if (!h || h.cfi !== drawn.cfi || h.color !== drawn.color) {
          removeEpubHighlight(rendition, drawn.cfi)
          drawnRef.current.delete(id)
        }
      }
      for (const h of want.values()) {
        if (cancelled) return
        const cfi = h.cfi as string
        const drawn = drawnRef.current.get(h.id)
        if (drawn && drawn.cfi === cfi && drawn.color === h.color) continue
        const ok = await drawEpubHighlight(handle, rendition, cfi, h.color)
        if (cancelled) return
        if (ok) drawnRef.current.set(h.id, { cfi, color: h.color })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [highlights, loading])

  // Clique fora (no documento pai) fecha toolbar/popover — cliques dentro do
  // iframe são cobertos pelo listener repassado do epubjs (ver carga).
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (toolbarRef.current && toolbarRef.current.contains(target)) return
      if (popoverRef.current && popoverRef.current.contains(target)) return
      if (translatePopoverRef.current && translatePopoverRef.current.contains(target)) return
      setSelection(null)
      setRemovalCandidate(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  // O Translate só vive com a seleção em que foi aberto e com as ferramentas
  // ligadas: a virada de página, um clique fora, uma seleção nova (o evento
  // `selected` chega 250 ms depois e com outro cfiRange) ou desligar as
  // ferramentas fecha o popover. Um `selected` repetido do mesmo trecho não.
  useEffect(() => {
    if (translate && (!selection || selection.cfiRange !== translate.cfiRange || !toolsOn)) {
      setTranslate(null)
    }
  }, [translate, selection, toolsOn])

  useEffect(() => {
    if (!toolsOn) {
      setItemTranslate(null)
      setHereTranslate(null)
    }
  }, [toolsOn])

  // Sem player aberto não há faixa cinza, e ao fechar o leitor ela sai do registro
  // da janela (que é de todos os leitores).
  useEffect(() => {
    if (!player.open) {
      listenCfiRef.current = null
      clearPageMarks('listen')
    }
  }, [player.open])
  useEffect(() => () => clearPageMarks('listen'), [])

  // Desligar as ferramentas de língua (Settings, "Change" do Translate) fecha o
  // player junto.
  useEffect(() => {
    if (!toolsOn && player.open) player.close()
  }, [toolsOn, player])

  // Virar a página com o texto do áudio fora da tela: pausa e o player oferece
  // "Back to". Voltar à tela do áudio tira o aviso, mas não retoma sozinho. O
  // texto lido é conferido pelo CFI contra o que a tela mostra (ver `viewKey`).
  useEffect(() => {
    const source = player.state.source
    const view = visibleRangeRef.current
    if (!source?.cfi || !view) return
    if (epubCfiInView(source.cfi, view)) {
      if (player.state.awayFromPage !== null) player.clearAway()
    } else {
      player.pause('away')
    }
    // Só uma tela nova dispara; o player lido é o do render dela.
  }, [viewKey])

  function clearIframeSelection() {
    const rendition = renditionRef.current
    if (rendition) clearEpubSelection(rendition)
  }

  // Navegação "de citação" (item do sumário ou grifo do painel): marca a
  // posição atual como ponto de retorno antes de saltar. ‹›/setas não mexem
  // no marcador — paridade com o `jumpToPage` do leitor de PDF.
  function jumpToCfi(target: string, onFail?: () => void) {
    const rendition = renditionRef.current
    if (!rendition) {
      onFail?.()
      return
    }
    const current = currentCfiRef.current
    if (current && current !== target) {
      setJumpBack({ cfi: current, percent })
    }
    void displayEpubAt(rendition, target).catch((err) => {
      console.error('failed to navigate', err)
      onFail?.()
    })
  }

  function goToHref(href: string) {
    jumpToCfi(href)
  }

  // ─── Diagramação (1 coluna ↔ 2 colunas) ────────────────────────────────
  function changeSpreadMode(mode: EpubSpreadMode) {
    if (mode === spreadMode) return
    setSpreadMode(mode)
    const rendition = renditionRef.current
    if (rendition) {
      setEpubSpread(rendition, mode)
      // Trocar a diagramação repagina o item de spine inteiro — mesmo
      // problema (e mesma solução) da mudança de fonte: reposicionar no CFI.
      const cfi = currentCfiRef.current
      if (cfi) void displayEpubAt(rendition, cfi).catch(() => {})
    }
  }

  // ─── Ações da toolbar de seleção ───────────────────────────────────────
  function chooseColor(color: string) {
    setActiveColor(color)
    saveHighlightColor(color)
  }

  async function handleHighlight(color: string) {
    if (!selection) return
    const handle = bookHandleRef.current
    const page = handle
      ? epubLocationOrdinal(handle, selection.cfiRange)
      : null
    const highlight: BookHighlight = {
      id: crypto.randomUUID(),
      bookId: book.id,
      // Ordinal de location 1-based (mesmo valor de `lastPage`) — contrato do
      // useHighlights. `rects` vai vazio: a âncora visual é o CFI.
      page: page ?? pageNum,
      text: selection.text,
      color,
      rects: [],
      cfi: selection.cfiRange,
      createdAt: Date.now(),
    }
    setSelection(null)
    clearIframeSelection()
    await persistHighlight(highlight)
  }

  async function handleCopyText() {
    if (!selection) return
    const text = selection.text
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('clipboard write failed', err)
    }
    setSelection(null)
    clearIframeSelection()
  }

  // Rótulo "capítulo, N%" (fallback "N%") de um CFI qualquer — usado pelos
  // três caminhos de citação (toolbar, popover e painel).
  async function citationLabelFor(cfi: string): Promise<string> {
    const handle = bookHandleRef.current
    if (!handle) return `${percent}%`
    const [chapterLabel, pct] = await Promise.all([
      resolveEpubChapter(handle, tocRef.current ?? [], cfi).catch(() => null),
      Promise.resolve(epubCfiPercentage(handle, cfi)),
    ])
    return epubCitationLabel(chapterLabel, pct ?? percent)
  }

  function pageOfCfi(cfi: string): number {
    const handle = bookHandleRef.current
    const page = handle ? epubLocationOrdinal(handle, cfi) : null
    return page ?? pageNum
  }

  // Ações compartilhadas entre a toolbar de seleção, o popover de grifo e os
  // itens do painel — cada chamador resolve seu texto/CFI e delega aqui.
  function askAiAbout(text: string, page: number, positionLabel: string) {
    setPendingQuote({ text, page, positionLabel })
    setSideTab('chat')
    setSideOpen(true)
  }

  // "Ask for feedback": o reconto vai ao chat com o professor ligado, e o chat o envia.
  function askFeedback(retelling: string) {
    turnTeacherOn()
    setPendingSend({ text: buildFeedbackMessage(retelling) })
    setSideTab('chat')
    setSideOpen(true)
  }

  function handleAddToNote() {
    if (!selection) return
    const { text, cfiRange } = selection
    const page = pageOfCfi(cfiRange)
    setSelection(null)
    clearIframeSelection()
    void citationLabelFor(cfiRange).then((label) =>
      addQuoteToNote(text, page, label),
    )
  }

  function handleAskAi() {
    if (!selection) return
    const { text, cfiRange } = selection
    const page = pageOfCfi(cfiRange)
    setSelection(null)
    clearIframeSelection()
    void citationLabelFor(cfiRange).then((label) =>
      askAiAbout(text, page, label),
    )
  }

  // ─── Translate ────────────────────────────────────────────────────────
  // A seleção continua marcada. A frase de contexto é a do bloco onde a
  // seleção começa (parágrafo, item, citação…).
  async function handleTranslate() {
    const rendition = renditionRef.current
    if (!selection || translate || !rendition) return
    const { cfiRange } = selection
    const text = selection.text.replace(/\s+/g, ' ').trim()
    const rect = epubHighlightScreenRect(rendition, cfiRange)
    if (!rect) return
    const sentence =
      text.length > TRANSLATE_CHAR_LIMIT
        ? text
        : contextSentenceAt(
            epubContextText(rendition, cfiRange, text) ?? text,
            text,
            book.language ?? '',
            epubSelectionOccurrence(rendition, cfiRange, text),
          )
    const positionLabel = await citationLabelFor(cfiRange)
    setTranslate({
      cfiRange,
      text,
      sentence,
      positionLabel,
      anchor: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    })
    // Abrir o Translate pausa o áudio durante a consulta.
    player.pause('translate')
  }

  // ─── Listen ───────────────────────────────────────────────────────────
  // A seleção vira frases e o trecho inteiro fica em cinza na página, mesmo
  // depois de a seleção sumir.
  function handleListen() {
    if (!selection) return
    const { cfiRange } = selection
    const text = selection.text.replace(/\s+/g, ' ').trim()
    const sentences = splitSentences(text, book.language ?? '')
    if (sentences.length === 0) return
    const page = pageOfCfi(cfiRange)
    setSelection(null)
    clearIframeSelection()
    void citationLabelFor(cfiRange).then((label) => {
      listenCfiRef.current = cfiRange
      player.play({
        id: crypto.randomUUID(),
        kind: 'selection',
        originLabel: `Selection · ${label}`,
        endLabel: 'End of the selection',
        sentences,
        chars: sentences.reduce((total, sentence) => total + sentence.length, 0),
        page,
        cfi: cfiRange,
        backLabel: label,
        notice: null,
      })
      applyListenMark()
    })
  }

  // O trecho visível (as duas colunas, no spread), pelo mesmo texto que vai ao
  // chat: com a reserva da fatia da location (cerca de 1.600 caracteres) quando o
  // intervalo não resolve. Sem faixa cinza: o trecho todo é a página.
  async function handleListenPage() {
    if (loading || !bookHandleRef.current) return
    const page = pageNum
    const view = viewKeyRef.current
    const startCfi = visibleRangeRef.current?.start ?? positionCfi
    const text = await getPageText(page)
    if (viewKeyRef.current !== view) return
    const sentences = text ? splitSentences(text, book.language ?? '') : []
    if (sentences.length === 0) {
      showToast({ message: 'Nothing to read on this page.' })
      return
    }
    const label = startCfi ? await citationLabelFor(startCfi) : `${percent}%`
    if (viewKeyRef.current !== view) return
    listenCfiRef.current = null
    clearPageMarks('listen')
    player.play({
      id: crypto.randomUUID(),
      kind: 'page',
      originLabel: label,
      endLabel: 'End of the visible text',
      sentences,
      chars: sentences.reduce((total, sentence) => total + sentence.length, 0),
      page,
      cfi: startCfi ?? undefined,
      backLabel: label,
      notice: null,
    })
  }

  // "Back to …": volta ao início do trecho que o player lê.
  function handleBackToSource() {
    const cfi = player.state.source?.cfi
    const rendition = renditionRef.current
    if (cfi && rendition) void displayEpubAt(rendition, cfi).catch(() => {})
  }

  // Fala o termo ou o trecho sem mexer no que está no player.
  function speakOnce(text: string) {
    player.speakOnce(text, book.language ?? '').catch((e: unknown) => {
      showToast({ message: isTtsError(e) ? ttsErrorSentence(e) : "Couldn't play the audio.", tone: 'error' })
    })
  }

  // Listen do popover do Translate: o termo ou o trecho, sem mexer no player. Acima
  // do limite do Translate é o trecho da seleção, que passa pelo player (e pela
  // confirmação de trecho longo).
  function handlePopoverListen(text: string) {
    if (text.length > TRANSLATE_CHAR_LIMIT) {
      handleListen()
      return
    }
    speakOnce(text)
  }

  function changeBookLanguage(code: string) {
    void storage
      .setBookLanguage(book.id, code)
      .catch((err) => console.error('failed to save book language', err))
    onBookLanguageChange(code)
  }

  // ─── Vocabulário ──────────────────────────────────────────────────────
  function vocabularyDraft(
    text: string,
    sentence: string,
    cfiRange: string,
    positionLabel: string,
    translation: Translation | null,
  ): VocabularyDraft {
    return {
      text,
      sentence,
      kind: classifySelection(text, sentence),
      ...translationFields(translation),
      page: pageOfCfi(cfiRange),
      positionLabel,
      anchor: { format: 'epub', cfiRange },
    }
  }

  async function saveToVocabulary(draft: VocabularyDraft) {
    try {
      const result = await vocabulary.add(draft)
      showToast({ message: result === 'added' ? 'Added to vocabulary' : 'Already in your vocabulary' })
    } catch (err) {
      console.error('failed to save the vocabulary item', err)
      showToast({ message: "Couldn't save to vocabulary. Try again.", tone: 'error' })
    }
  }

  // "Add to vocabulary" da barra (e a tecla V): o item entra sem tradução, sem
  // chamar a IA. O texto e a frase de origem são os do Translate.
  async function handleAddToVocabulary() {
    const rendition = renditionRef.current
    if (!selection || !rendition) return
    const { cfiRange } = selection
    const text = selection.text.replace(/\s+/g, ' ').trim()
    const sentence =
      text.length > TRANSLATE_CHAR_LIMIT
        ? text
        : contextSentenceAt(
            epubContextText(rendition, cfiRange, text) ?? text,
            text,
            book.language ?? '',
            epubSelectionOccurrence(rendition, cfiRange, text),
          )
    setSelection(null)
    clearIframeSelection()
    const positionLabel = await citationLabelFor(cfiRange)
    await saveToVocabulary(vocabularyDraft(text, sentence, cfiRange, positionLabel, null))
  }

  // "Add to vocabulary" do popover do Translate: o item entra com o sentido que
  // estava na tela.
  async function handleAddFromPopover(translation: Translation | null) {
    if (!translate) return
    const { text, sentence, cfiRange, positionLabel } = translate
    setTranslate(null)
    setSelection(null)
    clearIframeSelection()
    await saveToVocabulary(vocabularyDraft(text, sentence, cfiRange, positionLabel, translation))
  }

  function openVocabularyItem(item: VocabularyItem) {
    const notFound = () =>
      showToast({ message: "This item's place in the book wasn't found.", tone: 'error' })
    if (item.anchor.format !== 'epub') {
      notFound()
      return
    }
    jumpToCfi(item.anchor.cfiRange, notFound)
  }

  // ─── Palavra marcada no texto ─────────────────────────────────────────
  function openSavedWord(entry: MarkEntry) {
    const term = entry.range.toString().replace(/\s+/g, ' ').trim()
    const rect = epubRangeScreenRect(entry.range)
    if (!term || !rect) return
    setSelection(null)
    setRemovalCandidate(null)
    setSavedWord({
      itemIds: entry.itemIds,
      term,
      range: entry.range,
      anchor: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    })
  }
  const openSavedWordRef = useRef(openSavedWord)
  openSavedWordRef.current = openSavedWord

  // Os itens que a marca clicada mostra, na lista viva (remover um tira da lista).
  const savedWordItems = useMemo(() => {
    if (!savedWord) return []
    const wanted = new Set(savedWord.itemIds)
    return marks.items.filter((item) => wanted.has(item.id))
  }, [savedWord, marks.items])
  useEffect(() => {
    if (savedWord && savedWordItems.length === 0) setSavedWord(null)
  }, [savedWord, savedWordItems.length])

  useEffect(() => {
    if (!marksEnabled) setSavedWord(null)
  }, [marksEnabled])

  // A palavra clicada com a frase de AGORA, onde o usuário a achou: o bloco onde ela
  // está, e o lugar é o do trecho marcado.
  async function savedWordContext(): Promise<{
    term: string
    sentence: string
    cfiRange: string
    positionLabel: string
    anchor: PlacementAnchor
  } | null> {
    const rendition = renditionRef.current
    if (!savedWord || !rendition) return null
    const { term, range, anchor } = savedWord
    const cfiRange = epubCfiFromRange(rendition, range)
    if (!cfiRange) return null
    const sentence = contextSentenceAt(
      epubContextText(rendition, cfiRange, term) ?? term,
      term,
      book.language ?? '',
      epubSelectionOccurrence(rendition, cfiRange, term),
    )
    return { term, sentence, cfiRange, positionLabel: await citationLabelFor(cfiRange), anchor }
  }

  async function handleSavedWordTranslateHere() {
    const context = await savedWordContext()
    if (!context) return
    setSavedWord(null)
    setHereTranslate({
      cfiRange: context.cfiRange,
      text: context.term,
      sentence: context.sentence,
      positionLabel: context.positionLabel,
      anchor: context.anchor,
    })
    // Abrir o Translate pausa o áudio durante a consulta.
    player.pause('translate')
  }

  // "Add this sentence": o mesmo termo, com a frase em que ele está agora; a regra
  // de duplicata vale (o mesmo texto na mesma frase não entra duas vezes).
  async function handleSavedWordAddSentence() {
    const context = await savedWordContext()
    if (!context) return
    setSavedWord(null)
    await saveToVocabulary(
      vocabularyDraft(context.term, context.sentence, context.cfiRange, context.positionLabel, null),
    )
  }

  // Remove só o que foi guardado neste livro; o que veio de outro livro fica.
  function handleSavedWordRemove() {
    const own = savedWordItems.filter((item) => item.bookId === book.id)
    setSavedWord(null)
    void removeVocabularyItems(own)
  }

  // O sentido do popover vira o do item (que estava sem tradução).
  function saveItemTranslation(item: VocabularyItem, translation: Translation | null) {
    const current = vocabulary.items.find((i) => i.id === item.id)
    setItemTranslate(null)
    if (!current || !translation) return
    const { sense, baseForm } = translationFields(translation)
    vocabulary
      .update({ ...current, sense, baseForm: baseForm ?? current.baseForm })
      .then(() => showToast({ message: 'Translation saved' }))
      .catch((err) => {
        console.error('failed to save the translation', err)
        showToast({ message: "Couldn't save the translation. Try again.", tone: 'error' })
      })
  }

  // "Listen to list": a frase de origem dos itens marcados (ou dos novos), no
  // mesmo player, sem faixa cinza na página.
  function handleListenToList() {
    const source = buildListenSource(vocabSend.listenItems, book.language ?? '')
    if (!source) return
    listenCfiRef.current = null
    clearPageMarks('listen')
    player.play(source)
  }

  // ─── Popover do grifo ──────────────────────────────────────────────────
  // Trocar a cor fecha o popover antes de qualquer coisa; o efeito de
  // sincronização redesenha a marca com a cor nova.
  function handleChangeHighlightColor(h: BookHighlight, color: string) {
    setRemovalCandidate(null)
    changeColor(h, color)
  }

  async function handleConfirmRemove(h: BookHighlight) {
    const ok = await confirm(
      'Delete this highlight? The text in the book is not affected.',
      {
        title: 'Delete highlight',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
      },
    )
    if (!ok) return
    setRemovalCandidate(null)
    clearIframeSelection()
    await removeHighlight(h.id)
  }

  // Remoção a partir do painel lateral: mesmo removeHighlight do popover e
  // mesmo useConfirm (paridade de UX com o leitor de PDF).
  async function handleDeleteFromPanel(
    e: React.MouseEvent,
    h: BookHighlight,
  ) {
    e.stopPropagation()
    const ok = await confirm('Delete this highlight? The text in the book is not affected.', {
      title: 'Delete highlight',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await removeHighlight(h.id)
  }

  // ─── Toggles da coluna lateral (Chat/Notes) ────────────────────────────
  // Mesma convenção do leitor de PDF: clicar na aba ativa fecha a coluna,
  // clicar na outra troca e garante a coluna aberta.
  function selectSideTab(tab: SideTab) {
    if (sideOpen && sideTab === tab) {
      setSideOpen(false)
    } else {
      setSideTab(tab)
      setSideOpen(true)
    }
  }

  // ─── Texto da "página" para o contexto do chat ─────────────────────────
  // O que está na tela, do início ao fim (as duas colunas no spread); o
  // orçamento do readerContext corta o excesso. Sem o intervalo (tela que
  // cruza duas seções, ou antes do primeiro `relocated`), cai na fatia da
  // location corrente (~1600 chars) — nunca o item de spine inteiro.
  const getPageText = useCallback(
    async (n: number): Promise<string | null> => {
      const handle = bookHandleRef.current
      if (!handle) return null
      const visible = visibleRangeRef.current
      if (visible) {
        const text = await getEpubRangeText(handle, visible.start, visible.end)
        if (text) return text
      }
      return getEpubLocationText(handle, n)
    },
    [],
  )

  // Rótulos de posição por formato para o contexto do chat (ver
  // readerContext.ts). Percentual do grifo deriva das locations; fallback
  // para o ordinal quando o CFI não tem percentual.
  const chatHighlightLabel = useCallback((h: BookHighlight): string => {
    const handle = bookHandleRef.current
    const pct = handle && h.cfi ? epubCfiPercentage(handle, h.cfi) : null
    return pct != null ? `${pct}%` : `location ${h.page}`
  }, [])

  // Chip de posição de um grifo no painel (paridade com o "p. N" do PDF).
  function highlightChip(h: BookHighlight): string {
    return chatHighlightLabel(h)
  }

  // ─── Posicionamento da toolbar e popover ──────────────────────────────
  // Mesmas regras do leitor de PDF: toolbar acima da seleção (abaixo quando
  // não cabe) e dentro da .pageArea, popover abaixo da marca — os anchors já
  // vêm traduzidos para coordenadas da .pageArea. A toolbar é medida depois
  // de montada, antes da pintura.
  useLayoutEffect(() => {
    const el = toolbarRef.current
    const area = pageAreaRef.current
    if (!selection || !el || !area) return
    const { left, top } = placeSelectionToolbar(
      selection.anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      { left: 0, top: 0, right: area.clientWidth, bottom: area.clientHeight },
    )
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    // A barra é remontada quando o Translate fecha, e ganha a linha de língua
    // quando as ferramentas ligam: mede de novo nos dois casos.
  }, [selection, translate, toolsOn])

  function popoverStyle(): React.CSSProperties {
    if (!removalCandidate) return { display: 'none' }
    const { anchor } = removalCandidate
    return {
      left: `${Math.max(8, anchor.x)}px`,
      top: `${Math.max(8, anchor.y + anchor.h + 8)}px`,
    }
  }

  function changeMargin(next: number) {
    const margin = clampMargin(next)
    if (margin === marginPx) return
    setMarginPx(margin)
  }

  // ─── Tamanho da fonte ───────────────────────────────────────────────────
  function changeFontScale(next: number) {
    const scale = clampFontScale(next)
    if (scale === fontScale) return
    setFontScale(scale)

    const rendition = renditionRef.current
    if (rendition) {
      rendition.themes.fontSize(fontSizeCss(scale))
      // Trocar o corpo do texto repagina o item de spine inteiro: o offset
      // atual passa a apontar para outro trecho. Reposicionar no CFI corrente
      // é o que mantém o leitor onde ele estava — é o mesmo problema do
      // resize, mas aqui o epubjs não resolve sozinho (medido: sem isto, subir
      // a fonte para 150% joga o leitor 96 locations para trás, −27% do livro).
      const cfi = currentCfiRef.current
      if (cfi) void displayEpubAt(rendition, cfi).catch(() => {})
    }

    if (saveFontTimerRef.current) clearTimeout(saveFontTimerRef.current)
    pendingFontRef.current = scale
    saveFontTimerRef.current = setTimeout(() => {
      saveFontTimerRef.current = null
      flushPendingFont()
    }, SAVE_DEBOUNCE_MS)
  }

  // A aba Vocabulary só existe com as ferramentas de língua (e com elas a coluna
  // é mais larga): sem elas, a aba aberta volta ao sumário.
  const activeSideTab: SidePanelTab =
    sidePanelTab === 'vocabulary' && !toolsOn ? 'contents' : sidePanelTab
  const sidePanelWidth = toolsOn ? SIDE_PANEL_WIDTH_WITH_TOOLS : SIDE_PANEL_WIDTH

  if (error) {
    return (
      <div className={styles.reader}>
        <div className={styles.errorState}>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.errorActions}>
            <button type="button" className={styles.primary} onClick={onBack}>
              Back to Library
            </button>
            {onRemoveBook && (
              <button type="button" className={styles.secondary} onClick={onRemoveBook}>
                Remove from Library
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={styles.reader}
      // O aviso (toast) sobe com o mini-player: os dois usam a faixa de baixo.
      style={player.open ? ({ '--reader-toast-offset': `${playerHeight + 12}px` } as React.CSSProperties) : undefined}
    >
      <div className={styles.toolbar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <ArrowLeft size={13} aria-hidden />
          Library
        </button>

        <div className={styles.pageControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={goPrevious}
            disabled={loading || atStart}
            aria-label="Previous page"
            title="Previous page"
          >
            <CaretLeft size={14} aria-hidden />
          </button>
          <span
            className={styles.pageIndicator}
            title={!loading && chapter ? `${chapter} · ${percent}%` : undefined}
          >
            {loading ? (
              'Loading…'
            ) : (
              <>
                {chapter && <span className={styles.chapterLabel}>{chapter}</span>}
                {chapter && <span aria-hidden>·</span>}
                <span>{percent}%</span>
              </>
            )}
          </span>
          <button
            type="button"
            className={styles.navButton}
            onClick={goNext}
            disabled={loading || atEnd}
            aria-label="Next page"
            title="Next page"
          >
            <CaretRight size={14} aria-hidden />
          </button>
        </div>

        <div className={styles.fontControls} role="group" aria-label="Text size" title="Text size">
          <TextAa size={16} className={styles.controlIcon} aria-hidden />
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeFontScale(fontScale - FONT_SCALE_STEP)}
            disabled={fontScale <= MIN_FONT_SCALE}
            aria-label="Decrease text size"
            title="Smaller text"
          >
            <Minus size={12} aria-hidden />
          </button>
          <span className={styles.fontLabel}>{fontSizeCss(fontScale)}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeFontScale(fontScale + FONT_SCALE_STEP)}
            disabled={fontScale >= MAX_FONT_SCALE}
            aria-label="Increase text size"
            title="Larger text"
          >
            <Plus size={12} aria-hidden />
          </button>
        </div>

        <div className={styles.fontControls} role="group" aria-label="Page margins" title="Page margins">
          <ArrowsOutLineHorizontal size={16} className={styles.controlIcon} aria-hidden />
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeMargin(marginPx - MARGIN_STEP_PX)}
            disabled={marginPx <= MIN_MARGIN_PX}
            aria-label="Decrease margin"
            title="Narrower margins"
          >
            <Minus size={12} aria-hidden />
          </button>
          <span className={styles.fontLabel}>{marginPx}px</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeMargin(marginPx + MARGIN_STEP_PX)}
            disabled={marginPx >= MAX_MARGIN_PX}
            aria-label="Increase margin"
            title="Wider margins"
          >
            <Plus size={12} aria-hidden />
          </button>
        </div>

        {toolsOn && (
          <button
            type="button"
            className={`${styles.highlightsToggle} ${mincerRecording ? styles.listenRecording : ''}`}
            onClick={(e) => {
              // Sem o foco no botão, o Espaço do player não o aciona de novo.
              e.currentTarget.blur()
              void handleListenPage()
            }}
            disabled={loading}
            aria-label="Listen to page"
            title={mincerRecording ? 'Mincer is recording' : 'Listen to the visible text (L)'}
          >
            <SpeakerHigh size={14} aria-hidden />
            Listen to page
          </button>
        )}

        {jumpBack !== null && (
          <button
            type="button"
            className={styles.jumpBackButton}
            onClick={() => {
              const target = jumpBack
              setJumpBack(null)
              const rendition = renditionRef.current
              // resumeEpubAt (não displayEpubAt): o destino é um CFI de início
              // de página, o mesmo caso da retomada — a checagem de exatidão
              // evita voltar uma página antes.
              if (rendition) void resumeEpubAt(rendition, target.cfi).catch(() => {})
            }}
            title={`Back to ${jumpBack.percent}%`}
          >
            <ArrowUUpLeft size={13} aria-hidden />
            Back to {jumpBack.percent}%
          </button>
        )}

        <div
          className={styles.sideTabGroup}
          role="group"
          aria-label="Text layout"
        >
          <button
            type="button"
            className={`${styles.highlightsToggle} ${
              spreadMode === 'none' ? styles.highlightsToggleActive : ''
            }`}
            onClick={() => changeSpreadMode('none')}
            aria-pressed={spreadMode === 'none'}
            title="Single column"
          >
            1 col
          </button>
          <button
            type="button"
            className={`${styles.highlightsToggle} ${
              spreadMode === 'auto' ? styles.highlightsToggleActive : ''
            }`}
            onClick={() => changeSpreadMode('auto')}
            aria-pressed={spreadMode === 'auto'}
            title="Two columns (when wide enough)"
          >
            2 col
          </button>
        </div>

        <div className={styles.sideTabGroup}>
          <button
            type="button"
            className={`${styles.highlightsToggle} ${
              sideOpen && sideTab === 'chat' ? styles.highlightsToggleActive : ''
            }`}
            onClick={() => selectSideTab('chat')}
            aria-pressed={sideOpen && sideTab === 'chat'}
            aria-label="Toggle chat panel"
          >
            Chat
          </button>
          <button
            type="button"
            className={`${styles.highlightsToggle} ${
              sideOpen && sideTab === 'notes' ? styles.highlightsToggleActive : ''
            }`}
            onClick={() => selectSideTab('notes')}
            aria-pressed={sideOpen && sideTab === 'notes'}
            aria-label="Toggle notes panel"
          >
            Notes
          </button>
        </div>
      </div>

      <div className={styles.readerBody}>
        <aside
          className={`${styles.sidePanel} ${
            sidePanelCollapsed ? styles.sidePanelCollapsed : ''
          }`}
          style={{
            width: sidePanelCollapsed
              ? SIDE_PANEL_COLLAPSED_WIDTH
              : sidePanelWidth,
          }}
          aria-label="Book navigation"
        >
          {sidePanelCollapsed ? (
            <div className={styles.sidePanelRail}>
              <button
                type="button"
                className={styles.sidePanelRailToggle}
                onClick={() => setSidePanelCollapsed(false)}
                aria-label="Expand panel"
                title="Expand"
              >
                <SidebarSimple size={16} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.sidePanelRailButton}
                onClick={() => {
                  setSidePanelTab('contents')
                  setSidePanelCollapsed(false)
                }}
                aria-label="Show contents"
                title="Contents"
              >
                <ListBullets size={16} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.sidePanelRailButton}
                onClick={() => {
                  setSidePanelTab('highlights')
                  setSidePanelCollapsed(false)
                }}
                aria-label="Show highlights"
                title="Highlights"
              >
                <Highlighter size={16} aria-hidden />
                {highlights.length > 0 && (
                  <span className={styles.sidePanelRailBadge}>
                    {highlights.length}
                  </span>
                )}
              </button>
              {toolsOn && (
                <button
                  type="button"
                  className={styles.sidePanelRailButton}
                  onClick={() => {
                    setSidePanelTab('vocabulary')
                    setSidePanelCollapsed(false)
                  }}
                  aria-label="Show vocabulary"
                  title="Vocabulary"
                >
                  <BookmarkSimple size={16} aria-hidden />
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                className={`${styles.sidePanelTabs} ${toolsOn ? styles.sidePanelTabsDense : ''}`}
              >
                <button
                  type="button"
                  className={styles.sidePanelCollapseBtn}
                  onClick={() => setSidePanelCollapsed(true)}
                  aria-label="Collapse panel"
                  title="Collapse"
                >
                  <SidebarSimple size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.sidePanelTab} ${
                    activeSideTab === 'contents' ? styles.sidePanelTabActive : ''
                  }`}
                  onClick={() => setSidePanelTab('contents')}
                >
                  Contents
                </button>
                <button
                  type="button"
                  className={`${styles.sidePanelTab} ${
                    activeSideTab === 'highlights'
                      ? styles.sidePanelTabActive
                      : ''
                  }`}
                  onClick={() => setSidePanelTab('highlights')}
                >
                  Highlights
                  {highlights.length > 0 && (
                    <span className={styles.sidePanelTabBadge}>
                      {highlights.length}
                    </span>
                  )}
                </button>
                {toolsOn && (
                  <button
                    type="button"
                    className={`${styles.sidePanelTab} ${
                      activeSideTab === 'vocabulary' ? styles.sidePanelTabActive : ''
                    }`}
                    onClick={() => setSidePanelTab('vocabulary')}
                  >
                    Vocabulary
                  </button>
                )}
              </div>

              {activeSideTab === 'contents' ? (
                <div className={styles.tocPanel}>
                  {toc === null ? (
                    <p className={styles.tocEmpty}>Loading…</p>
                  ) : toc.length === 0 ? (
                    <p className={styles.tocEmpty}>
                      This EPUB has no table of contents.
                    </p>
                  ) : (
                    <TocList items={toc} depth={0} onNavigate={goToHref} />
                  )}
                </div>
              ) : activeSideTab === 'vocabulary' ? (
                <VocabularyTab
                  items={vocabulary.items}
                  hideSenses={languageSettings.vocabHideSenses}
                  onToggleHideSenses={() => setVocabHideSenses(!languageSettings.vocabHideSenses)}
                  marksOn={languageSettings.vocabMarks}
                  onToggleMarks={() => setVocabMarks(!languageSettings.vocabMarks)}
                  selectedIds={vocabSend.selectedIds}
                  onToggleSelected={vocabSend.toggleSelected}
                  onOpenItem={openVocabularyItem}
                  onListenItem={(item) => speakOnce(item.sentence)}
                  onTranslateItem={(item, anchor) => {
                    setItemTranslate({ item, anchor })
                    // Abrir o Translate pausa o áudio durante a consulta.
                    player.pause('translate')
                  }}
                  onRemoveItem={(item) => void removeVocabularyItems([item])}
                  onOpenSent={vocabSend.openSent}
                  sendLabel={vocabSend.sendLabel}
                  canSend={vocabSend.canSend}
                  onSend={vocabSend.send}
                  destinationLabel={vocabSend.destinationLabel}
                  onChangeDestination={vocabSend.openChange}
                  onListenToList={handleListenToList}
                  canRetell={retell.canRetell}
                  onRetell={retell.retell}
                />
              ) : (
                <>
                  {(orderedHighlights.length > HIGHLIGHT_SEARCH_MIN || textFilter !== '') && (
                    <input
                      type="search"
                      className={styles.highlightsSearch}
                      placeholder="Search highlights…"
                      value={textFilter}
                      onChange={(e) => setTextFilter(e.target.value)}
                      aria-label="Search highlights"
                    />
                  )}
                  {orderedHighlights.length === 0 ? (
                    <p className={styles.highlightsPanelEmpty}>
                      Select text in the book to highlight it.
                    </p>
                  ) : filteredHighlights.length === 0 ? (
                    <p className={styles.highlightsPanelEmpty}>
                      {textFilter.trim()
                        ? 'No highlights match this search'
                        : 'No highlights match this color'}
                    </p>
                  ) : (
                    <ul className={styles.highlightsPanelList}>
                      {filteredHighlights.map((h) => (
                        <li
                          key={h.id}
                          className={styles.highlightsPanelItemWrap}
                        >
                          <button
                            type="button"
                            className={styles.highlightsPanelItem}
                            onClick={() => {
                              // O painel PERMANECE aberto ao navegar — o
                              // usuário pode clicar em vários grifos sem
                              // precisar reabrir o painel. Grifo sem CFI
                              // (não deveria existir em EPUB) não navega.
                              if (h.cfi) jumpToCfi(h.cfi)
                            }}
                          >
                            <div className={styles.highlightsPanelItemTop}>
                              <span
                                className={styles.highlightsPanelSwatch}
                                style={{ background: h.color }}
                                aria-hidden="true"
                              />
                              <span className={styles.highlightsPanelPage}>
                                {highlightChip(h)}
                              </span>
                              <span className={styles.highlightsPanelDate}>
                                {formatShortDate(h.createdAt)}
                              </span>
                            </div>
                            <span className={styles.highlightsPanelText}>
                              {truncateText(h.text, 240)}
                            </span>
                          </button>
                          <div className={styles.highlightsPanelItemActions}>
                            <button
                              type="button"
                              className={styles.highlightsPanelItemAction}
                              onClick={(e) => {
                                e.stopPropagation()
                                const cfi = h.cfi
                                if (!cfi) return
                                void citationLabelFor(cfi).then((label) =>
                                  askAiAbout(h.text, h.page, label),
                                )
                              }}
                              aria-label="Ask AI about this highlight"
                              title="Ask AI"
                            >
                              <Sparkle size={12} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={styles.highlightsPanelItemAction}
                              onClick={(e) => {
                                e.stopPropagation()
                                const cfi = h.cfi
                                if (!cfi) return
                                void citationLabelFor(cfi).then((label) =>
                                  addQuoteToNote(h.text, h.page, label),
                                )
                              }}
                              aria-label="Add to note"
                              title={addToNoteTitle}
                            >
                              <Quotes size={12} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${styles.highlightsPanelItemAction} ${styles.highlightsPanelItemDelete}`}
                              onClick={(e) => void handleDeleteFromPanel(e, h)}
                              aria-label="Delete highlight"
                              title="Delete highlight"
                            >
                              <Trash size={12} aria-hidden />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {orderedHighlights.length > 0 && (
                    <div className={styles.highlightsColorFilter}>
                      {HIGHLIGHT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`${styles.highlightSwatch} ${
                            c === colorFilter ? styles.highlightSwatchActive : ''
                          }`}
                          style={{ background: c }}
                          onClick={() =>
                            setColorFilter((prev) => (prev === c ? null : c))
                          }
                          aria-pressed={c === colorFilter}
                          aria-label={`Filter highlights by ${HIGHLIGHT_COLOR_NAMES[c] ?? c} color`}
                          title="Filter by color"
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </aside>

        <div className={styles.pageArea} ref={pageAreaRef}>
          <div
            className={styles.viewerSurface}
            style={{ paddingLeft: 20 + marginPx, paddingRight: 20 + marginPx }}
          >
            <div ref={viewerRef} className={styles.viewer} />
          </div>
          {loading && <p className={styles.loadingText}>Loading book…</p>}
          {!loading && (
            <>
              <button
                type="button"
                className={`${styles.floatingNavButton} ${styles.floatingNavButtonLeft}`}
                onClick={goPrevious}
                disabled={atStart}
                aria-label="Previous page"
              >
                <CaretLeft size={18} aria-hidden />
              </button>
              <button
                type="button"
                className={`${styles.floatingNavButton} ${styles.floatingNavButtonRight}`}
                onClick={goNext}
                disabled={atEnd}
                aria-label="Next page"
              >
                <CaretRight size={18} aria-hidden />
              </button>
            </>
          )}
          {selection && !translate && (
            <div
              ref={toolbarRef}
              className={`${styles.highlightToolbar} ${
                toolsOn ? styles.highlightToolbarStacked : ''
              }`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {toolsOn && (
                <LanguageBar
                  onTranslate={() => void handleTranslate()}
                  onListen={handleListen}
                  onAddToVocabulary={() => void handleAddToVocabulary()}
                />
              )}
              <div
                className={toolsOn ? styles.highlightToolbarRow : styles.highlightToolbarContents}
              >
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.highlightSwatch} ${
                    c === activeColor ? styles.highlightSwatchActive : ''
                  }`}
                  style={{ background: c }}
                  onClick={() => {
                    chooseColor(c)
                    void handleHighlight(c)
                  }}
                  aria-label={`Highlight with ${HIGHLIGHT_COLOR_NAMES[c] ?? c}`}
                  title={c === activeColor ? 'Highlight (H)' : undefined}
                />
              ))}
              <span className={styles.highlightToolbarDivider} />
              <button
                type="button"
                className={styles.highlightToolbarButton}
                onClick={() => void handleCopyText()}
              >
                Copy
              </button>
              <button
                type="button"
                className={styles.highlightToolbarButton}
                onClick={handleAddToNote}
                title={addToNoteTitle}
              >
                Add to note
              </button>
              <button
                type="button"
                className={styles.highlightToolbarButton}
                onClick={handleAskAi}
              >
                Ask AI
              </button>
              </div>
            </div>
          )}
          {translate && selection && toolsOn && (
            <TranslatePopover
              open
              rootRef={translatePopoverRef}
              anchor={translate.anchor}
              text={translate.text}
              sentence={translate.sentence}
              positionLabel={translate.positionLabel}
              sourceLanguage={book.language ?? ''}
              targetLanguage={languageSettings.nativeLanguage}
              model={languageSettings.translateModel}
              onListen={handlePopoverListen}
              onAddToVocabulary={(t) => void handleAddFromPopover(t)}
              onAddToNote={handleAddToNote}
              onAskAi={handleAskAi}
              onChangeBookLanguage={changeBookLanguage}
              onChangeTargetLanguage={setNativeLanguage}
              onOpenSettings={() => {
                setTranslate(null)
                onOpenSettingsSection('openrouter')
              }}
              onClose={() => setTranslate(null)}
            />
          )}
          {player.open && columnBox && (
            <MiniPlayer
              player={player}
              column={columnBox}
              models={catalog.models}
              modelsLoading={catalog.loading}
              bookId={book.id}
              language={book.language ?? ''}
              onBackToPage={handleBackToSource}
              onOpenSettingsSection={onOpenSettingsSection}
              onHeightChange={setPlayerHeight}
            />
          )}
          {removalCandidate && (
            <div
              ref={popoverRef}
              className={styles.removalPopover}
              style={popoverStyle()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className={styles.removalPopoverDate}>
                {formatHighlightDate(removalCandidate.highlight.createdAt)}
              </p>
              <div className={styles.removalPopoverQuickActions}>
                <button
                  type="button"
                  className={styles.removalPopoverQuickButton}
                  onClick={() => {
                    const h = removalCandidate.highlight
                    setRemovalCandidate(null)
                    if (!h.cfi) return
                    void citationLabelFor(h.cfi).then((label) =>
                      askAiAbout(h.text, h.page, label),
                    )
                  }}
                >
                  <Sparkle size={13} aria-hidden />
                  Ask AI
                </button>
                <button
                  type="button"
                  className={styles.removalPopoverQuickButton}
                  onClick={() => {
                    const h = removalCandidate.highlight
                    setRemovalCandidate(null)
                    if (!h.cfi) return
                    void citationLabelFor(h.cfi).then((label) =>
                      addQuoteToNote(h.text, h.page, label),
                    )
                  }}
                  title={addToNoteTitle}
                >
                  <Quotes size={13} aria-hidden />
                  Add to note
                </button>
              </div>
              <div className={styles.removalPopoverColors}>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.highlightSwatch} ${
                      c === removalCandidate.highlight.color
                        ? styles.highlightSwatchActive
                        : ''
                    }`}
                    style={{ background: c }}
                    onClick={() =>
                      handleChangeHighlightColor(removalCandidate.highlight, c)
                    }
                    aria-label={`Change highlight color to ${HIGHLIGHT_COLOR_NAMES[c] ?? c}`}
                    title="Change color"
                  />
                ))}
              </div>
              <div className={styles.removalPopoverActions}>
                <button
                  type="button"
                  className={styles.removalPopoverButton}
                  onClick={() => setRemovalCandidate(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.removalPopoverButton} ${styles.removalPopoverButtonDanger}`}
                  onClick={() =>
                    void handleConfirmRemove(removalCandidate.highlight)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SEMPRE montados (fora do ternário de loading): fechar o toggle só
            esconde via CSS — desmontar o ReaderChatPanel cancelaria o
            useChat e um stream ativo, e desmontar o ReaderNotesPanel
            perderia o estado de seleção Notebook/Nota da aba. */}
        <ReaderChatPanel
          book={book}
          pageNum={pageNum}
          totalPages={book.totalPages}
          highlights={highlights}
          getPageText={getPageText}
          positionLabel={
            chapter
              ? `${chapter}, ${percent}% (location ${pageNum} of ${book.totalPages})`
              : `${percent}% (location ${pageNum} of ${book.totalPages})`
          }
          highlightLabel={chatHighlightLabel}
          contextChipLabel={`${percent}%`}
          open={sideOpen && sideTab === 'chat'}
          onClose={() => setSideOpen(false)}
          pendingQuote={pendingQuote}
          onPendingQuoteConsumed={() => setPendingQuote(null)}
          notebooks={notebooks}
          notes={notes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          onOpenNote={openNote}
          showToast={showToast}
          onOpenSettings={onOpenSettings}
          teacher={teacher}
          pendingSend={pendingSend}
          onPendingSendConsumed={() => setPendingSend(null)}
        />
        <ReaderNotesPanel
          book={book}
          notebooks={notebooks}
          notes={notes}
          noteTypes={noteTypes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          linkVersion={linkVersion}
          viewRequest={viewRequest}
          open={sideOpen && sideTab === 'notes'}
          onClose={() => setSideOpen(false)}
          onAskFeedback={toolsOn ? askFeedback : undefined}
          showToast={showToast}
        />
      </div>

      {itemTranslate && toolsOn && (
        <TranslatePopover
          open
          savedItem
          rootRef={itemPopoverRef}
          anchor={itemTranslate.anchor}
          text={itemTranslate.item.text}
          sentence={itemTranslate.item.sentence}
          positionLabel={itemTranslate.item.positionLabel}
          sourceLanguage={book.language ?? ''}
          targetLanguage={languageSettings.nativeLanguage}
          model={languageSettings.translateModel}
          onListen={speakOnce}
          onAddToVocabulary={(t) => saveItemTranslation(itemTranslate.item, t)}
          onAddToNote={() => {
            const { item } = itemTranslate
            setItemTranslate(null)
            addQuoteToNote(item.text, item.page, item.positionLabel)
          }}
          onAskAi={() => {
            const { item } = itemTranslate
            setItemTranslate(null)
            askAiAbout(item.text, item.page, item.positionLabel)
          }}
          onChangeBookLanguage={changeBookLanguage}
          onChangeTargetLanguage={setNativeLanguage}
          onOpenSettings={() => {
            setItemTranslate(null)
            onOpenSettingsSection('openrouter')
          }}
          onClose={() => setItemTranslate(null)}
        />
      )}

      {savedWord && marksEnabled && (
        <SavedWordPopover
          rootRef={savedWordRef}
          anchor={savedWord.anchor}
          term={savedWord.term}
          items={savedWordItems}
          bookId={book.id}
          bookTitles={marks.titles}
          onListen={speakOnce}
          onTranslateHere={() => void handleSavedWordTranslateHere()}
          onAddSentence={() => void handleSavedWordAddSentence()}
          onRemove={handleSavedWordRemove}
          onClose={() => setSavedWord(null)}
        />
      )}

      {hereTranslate && toolsOn && (
        <TranslatePopover
          open
          standalone
          rootRef={herePopoverRef}
          anchor={hereTranslate.anchor}
          text={hereTranslate.text}
          sentence={hereTranslate.sentence}
          positionLabel={hereTranslate.positionLabel}
          sourceLanguage={book.language ?? ''}
          targetLanguage={languageSettings.nativeLanguage}
          model={languageSettings.translateModel}
          onListen={speakOnce}
          onAddToVocabulary={(t) => {
            const here = hereTranslate
            setHereTranslate(null)
            void saveToVocabulary(
              vocabularyDraft(here.text, here.sentence, here.cfiRange, here.positionLabel, t),
            )
          }}
          onAddToNote={() => {
            const here = hereTranslate
            setHereTranslate(null)
            addQuoteToNote(here.text, pageOfCfi(here.cfiRange), here.positionLabel)
          }}
          onAskAi={() => {
            const here = hereTranslate
            setHereTranslate(null)
            askAiAbout(here.text, pageOfCfi(here.cfiRange), here.positionLabel)
          }}
          onChangeBookLanguage={changeBookLanguage}
          onChangeTargetLanguage={setNativeLanguage}
          onOpenSettings={() => {
            setHereTranslate(null)
            onOpenSettingsSection('openrouter')
          }}
          onClose={() => setHereTranslate(null)}
        />
      )}

      {vocabSend.modalProps && <SendVocabularyModal {...vocabSend.modalProps} />}

      {retell.modal}

      {quoteModal && (
        <QuoteToNoteModal
          open={quoteModal.open}
          notebooks={notebooks}
          notes={notes}
          noteTypes={noteTypes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          quoteText={quoteModal.quoteText}
          bookTitle={book.title}
          page={quoteModal.page}
          positionLabel={quoteModal.positionLabel}
          bookId={book.id}
          onSaved={quoteModal.onSaved}
          onLinkNote={quoteModal.onLinkNote}
          onClose={quoteModal.onClose}
        />
      )}

      {toast}

      {confirmModal}
    </div>
  )
}
