import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'
import {
  ArrowLeft,
  ArrowUUpLeft,
  BookmarkSimple,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Highlighter,
  ListBullets,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Quotes,
  SidebarSimple,
  Sparkle,
  SpeakerHigh,
  Trash,
  X,
} from '@phosphor-icons/react'
import type {
  Book,
  BookHighlight,
  BookHighlightRect,
  Note,
  Notebook,
  NoteType,
  PdfBook,
  VocabularyAnchor,
  VocabularyItem,
} from '../../types'
import { storage } from '../../storage'
import { booksReadFile, detectPdfLanguage } from '../../lib/books'
import { openPdf, TextLayer, type PDFDocumentProxy } from '../../lib/pdf'
import { useBookQuotes } from '../../hooks/useBookQuotes'
import { useBookVocabulary } from '../../hooks/useBookVocabulary'
import { useConfirm } from '../../hooks/useConfirm'
import { useColumnBox } from '../../hooks/useColumnBox'
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
import {
  getTtsSkipHeaders,
  setNativeLanguage,
  setVocabHideSenses,
  setVocabMarks,
} from '../../lib/languageSettings'
import { clearPageMarks, markEntryAtPoint, setPageMarks, type MarkEntry } from '../../lib/pageMarks'
import {
  cleanPdfPage,
  cleanPdfSelectionText,
  pdfItemsToLines,
  skippedNotice,
  type CleanPageResult,
  type PdfLine,
  type PdfTextItem,
} from '../../lib/pdfText'
import { buildFeedbackMessage } from '../../lib/retell'
import { splitSentences } from '../../lib/sentences'
import { isTtsError, ttsErrorSentence } from '../../lib/speech'
import { TRANSLATE_CHAR_LIMIT, classifySelection, type Translation } from '../../lib/translate'
import { buildListenSource, translationFields, type VocabularyDraft } from '../../lib/vocabulary'
import { contextSentenceAt, countTermBefore, findTermOccurrences, pdfSentenceAnchors } from '../../lib/vocabMatch'
import { LanguageBar } from '../LanguageTools/LanguageBar'
import { MiniPlayer } from '../LanguageTools/MiniPlayer'
import { SavedWordPopover } from '../LanguageTools/SavedWordPopover'
import { SendVocabularyModal } from '../LanguageTools/SendVocabularyModal'
import { TranslatePopover } from '../LanguageTools/TranslatePopover'
import { VocabularyTab } from '../LanguageTools/VocabularyTab'
import type { SettingsSection } from '../Settings/SettingsModal'
import {
  buildJoinedPageText,
  buildRangeFromOffsets,
  findAllOccurrenceRanges,
  getCaretFromPoint,
  getPageSpans,
  rangeToJoinedOffsets,
  type PdfTextAnchor,
} from './pdfTextLayer'
import { QuoteToNoteModal } from './QuoteToNoteModal'
import { ReaderChatPanel } from './ReaderChatPanel'
import { ReaderNotesPanel } from './ReaderNotesPanel'
import { useReaderToast } from './ReaderToast'
import { placeSelectionToolbar, type PlacementAnchor } from './toolbarPlacement'
import styles from './Reader.module.css'

export interface ReaderProps {
  // Este é o leitor de PDF: o tipo impede que um EPUB chegue aqui por engano.
  book: PdfBook
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

// Estado do Translate aberto: o que a seleção era no momento do clique (o
// popover mantém o texto mesmo que a seleção do navegador mude) e o Range
// clonado, de onde sai o retângulo que acompanha a rolagem da página.
interface TranslateState {
  text: string
  sentence: string
  page: number
  range: Range
  anchor: PlacementAnchor
}

function rangeAnchor(range: Range): PlacementAnchor {
  const box = range.getBoundingClientRect()
  return { x: box.left, y: box.top, w: box.width, h: box.height }
}

// Rótulo de posição da citação no PDF. Fica aqui porque cada formato monta o
// seu — o leitor de EPUB usará capítulo + porcentagem.
function pdfPositionLabel(page: number): string {
  return `p. ${page}`
}

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25
const SAVE_DEBOUNCE_MS = 500
const HIGHLIGHT_OPACITY = 0.35

const HIGHLIGHT_COLORS = ['#FFEB3B', '#A5D6A7', '#90CAF9', '#F48FB1']
// Nomes legíveis para os swatches de cor, usados em aria-label (leitores de
// tela não conseguem distinguir botões por um hex cru).
const HIGHLIGHT_COLOR_NAMES: Record<string, string> = {
  '#FFEB3B': 'yellow',
  '#A5D6A7': 'green',
  '#90CAF9': 'blue',
  '#F48FB1': 'pink',
}

// Estado do toggle da coluna lateral (Chat/Notes), persistido entre sessões.
// Mesma chave/valor de antes (CHAT_OPEN_KEY) — preserva a preferência já
// salva de usuários existentes, agora representando "coluna aberta" em vez
// de "chat aberto" especificamente.
const SIDE_OPEN_KEY = 'monet:reader-chat-open'
const SIDE_TAB_KEY = 'monet:reader-side-tab'

// Estado retrátil da coluna de navegação (Summary/Highlights), persistido
// entre sessões — mesmo padrão do NotebookList (ícones apenas quando
// recolhida, largura fixa quando expandida).
const SIDE_PANEL_COLLAPSED_KEY = 'monet:reader-sidepanel-collapsed'
const SIDE_PANEL_WIDTH = 280
// Com as ferramentas de língua a coluna ganha a aba Vocabulary e fica mais larga.
const SIDE_PANEL_WIDTH_WITH_TOOLS = 300
const SIDE_PANEL_COLLAPSED_WIDTH = 48

// Acima disso o painel de grifos ganha o campo de busca.
const HIGHLIGHT_SEARCH_MIN = 15

// "Fit width" / "Fit page", por livro. Enquanto um deles está ativo, o zoom
// acompanha o tamanho da área da página; − e + voltam ao zoom manual.
type FitMode = 'width' | 'page'
const FIT_MODE_KEY = 'monet:reader-fit-mode'

function readFitModes(): Record<string, FitMode> {
  try {
    const raw = localStorage.getItem(FIT_MODE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, FitMode>) : {}
  } catch {
    return {}
  }
}

function loadFitMode(bookId: string): FitMode | null {
  const mode = readFitModes()[bookId]
  return mode === 'width' || mode === 'page' ? mode : null
}

function saveFitMode(bookId: string, mode: FitMode | null): void {
  try {
    const modes = readFitModes()
    if (mode) modes[bookId] = mode
    else delete modes[bookId]
    localStorage.setItem(FIT_MODE_KEY, JSON.stringify(modes))
  } catch (err) {
    console.error('failed to persist reader fit mode', err)
  }
}

type SidePanelTab = 'summary' | 'highlights' | 'vocabulary'
type SideTab = 'chat' | 'notes'

interface PagePoint {
  x: number
  y: number
  w: number
  h: number
}

interface SelectionState {
  rects: BookHighlightRect[]
  text: string
  anchor: PagePoint
}

interface RemovalCandidate {
  highlight: BookHighlight
  anchor: PagePoint
}

interface SearchMatch {
  page: number
  occurrenceIndexOnPage: number
}

interface PageMatchCount {
  page: number
  count: number
}

function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, page), total)
}

function clampScale(s: number): number {
  if (!Number.isFinite(s)) return 1
  return Math.min(Math.max(MIN_SCALE, s), MAX_SCALE)
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

// ─── Sumário do PDF (tab "Summary") ─────────────────────────────────────
// pdf.js expõe o outline/bookmarks nativo do arquivo (getOutline), quando o
// PDF os inclui — nem todo PDF tem. Cada nó traz um `dest` que precisa ser
// resolvido para um número de página: destino nomeado (string) primeiro via
// getDestination, depois o ref da página (1º item do array) via
// getPageIndex. Resolvido uma vez no carregamento do doc e cacheado em
// estado — a navegação por clique fica então síncrona.
interface RawOutlineNode {
  title: string
  dest: string | unknown[] | null
  items: RawOutlineNode[]
}

interface OutlineEntry {
  title: string
  page: number | null
  items: OutlineEntry[]
}

// pdfjs-dist não reexporta o tipo `RefProxy` (usado por getPageIndex) do seu
// entrypoint público — derivamos o tipo do próprio método em vez de importar
// de um caminho interno do pacote.
type PageRef = Parameters<PDFDocumentProxy['getPageIndex']>[0]

async function resolveOutlineDestPage(
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> {
  if (!dest) return null
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    if (!Array.isArray(explicit) || explicit.length === 0) return null
    const index = await doc.getPageIndex(explicit[0] as PageRef)
    return index + 1
  } catch {
    return null
  }
}

async function resolveOutlineNode(
  doc: PDFDocumentProxy,
  node: RawOutlineNode,
): Promise<OutlineEntry> {
  const [page, items] = await Promise.all([
    resolveOutlineDestPage(doc, node.dest),
    Promise.all((node.items ?? []).map((child) => resolveOutlineNode(doc, child))),
  ])
  return { title: node.title, page, items }
}

async function loadOutline(doc: PDFDocumentProxy): Promise<OutlineEntry[] | null> {
  try {
    const raw = (await doc.getOutline()) as RawOutlineNode[] | null
    if (!raw || raw.length === 0) return null
    return await Promise.all(raw.map((node) => resolveOutlineNode(doc, node)))
  } catch {
    return null
  }
}

interface OutlineListProps {
  items: OutlineEntry[]
  depth: number
  onNavigate: (page: number) => void
}

function OutlineList({ items, depth, onNavigate }: OutlineListProps) {
  return (
    <ul className={styles.outlineList} data-depth={depth}>
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            className={styles.outlineItem}
            disabled={item.page == null}
            title={item.title}
            onClick={() => item.page != null && onNavigate(item.page)}
          >
            <span className={styles.outlineItemTitle}>{item.title}</span>
            {item.page != null && (
              <span className={styles.outlineItemPage}>{item.page}</span>
            )}
          </button>
          {item.items.length > 0 && (
            <OutlineList items={item.items} depth={depth + 1} onNavigate={onNavigate} />
          )}
        </li>
      ))}
    </ul>
  )
}

// ─── Controlador de seleção manual ─────────────────────────────────────
// O text layer do pdfjs é composto de <span>s absolutamente posicionados
// por fragmento de texto do PDF. A região horizontal à direita da última
// span de uma linha (e entre a última span de uma linha e a primeira da
// próxima) é "vazio" para o hit-test nativo do browser. Quando o usuário
// arrasta a seleção para essa região, o browser faz snap para a text
// node mais próxima — podendo pular várias linhas. Para eliminar esse
// salto involuntário, instalamos listeners que, em `selectionchange`
// (que dispara DEPOIS do browser atualizar a seleção no `mousemove`),
// detectam se o foco está "longe" do cursor do mouse (distância Y >
// 1.5× lineHeight) e, em caso afirmativo, sobrescrevem a seleção
// usando `document.caretPositionFromPoint(mouseX, mouseY)` para cravar
// o foco no texto mais próximo do cursor. Isso garante que o foco
// nunca fica a várias linhas de distância do mouse e preserva a
// seleção multi-linha voluntária (quando o mouse está de facto em uma
// linha inferior, a correção define o foco nessa mesma linha — igual
// ao que o browser faria).

function findSpanElement(node: Node | null): HTMLElement | null {
  let n: Node | null = node
  while (n) {
    if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'SPAN') {
      return n as HTMLElement
    }
    n = n.parentNode
  }
  return null
}

export function Reader({
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
}: ReaderProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(book.lastPage)
  // Inicializa o zoom a partir do livro persistido. O Reader é remontado
  // pelo Library a cada troca de livro, então `book.zoom` reflete o valor
  // atual do storage. Livros antigos (sem coluna `zoom`) caem no default
  // 1.0 (clamp aplicado no `rowToBook` do storage).
  const [scale, setScale] = useState(() => clampScale(book.zoom))
  const [fitMode, setFitMode] = useState<FitMode | null>(() => loadFitMode(book.id))
  // Página sem texto extraível (PDF escaneado): mostra a faixa de aviso.
  const [pageHasNoText, setPageHasNoText] = useState(false)
  const [pageInput, setPageInput] = useState(String(book.lastPage))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const [removalCandidate, setRemovalCandidate] = useState<RemovalCandidate | null>(
    null,
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIndexReady, setSearchIndexReady] = useState(false)
  const [searchIndexProgress, setSearchIndexProgress] = useState(0)
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const [pageMatchRects, setPageMatchRects] = useState<BookHighlightRect[][]>([])
  const searchIndexingRef = useRef(false)
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(
    () => localStorage.getItem(SIDE_PANEL_COLLAPSED_KEY) !== '0',
  )
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('highlights')
  const [outline, setOutline] = useState<OutlineEntry[] | null | undefined>(undefined)
  // Página de onde o usuário saiu ao seguir um grifo/item do sumário — permite
  // voltar com um clique. Só é marcada em navegação "de citação" (painel de
  // grifos, sumário), nunca em ‹›/input de página, e some sozinha quando o
  // usuário chega de volta nela por qualquer meio (ver effect abaixo).
  const [jumpBackPage, setJumpBackPage] = useState<number | null>(null)
  const [sideOpen, setSideOpen] = useState(
    () => localStorage.getItem(SIDE_OPEN_KEY) === '1',
  )
  const [sideTab, setSideTab] = useState<SideTab>(
    () => (localStorage.getItem(SIDE_TAB_KEY) === 'notes' ? 'notes' : 'chat'),
  )
  const [pendingQuote, setPendingQuote] = useState<{
    text: string
    page: number
  } | null>(null)
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

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const pageAreaRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const highlightLayerRef = useRef<HTMLDivElement>(null)
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
    format: 'pdf',
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
    text: string
    sentence: string
    page: number
    anchor: PlacementAnchor
    vocabAnchor: VocabularyAnchor
  } | null>(null)
  const herePopoverRef = useRef<HTMLDivElement>(null)
  // Onde está a seleção que o player lê (offsets no texto juntado da página), para
  // a faixa cinza voltar depois de cada nova renderização da camada de texto.
  const listenAnchorRef = useRef<PdfTextAnchor | null>(null)
  const pageNumRef = useRef(pageNum)
  pageNumRef.current = pageNum
  const renderTaskRef = useRef<RenderTask | null>(null)
  const textLayerTaskRef = useRef<TextLayer | null>(null)
  const prevPageRef = useRef<PDFPageProxy | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPageRef = useRef<number | null>(null)
  // Debounce independente para o zoom, análogo ao de `last_page`. Os dois
  // coexistem: cada um salva a sua própria fatia do livro (page vs. zoom)
  // e, se houver sobreposição, o segundo saveBook apenas re-escreve o
  // mesmo registro (idempotente). Mantemos refs separados para que o
  // flush de um não dependa do outro.
  const saveZoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingZoomRef = useRef<number | null>(null)
  // Cache de texto extraído por página (contexto do chat). Preenchido sob
  // demanda (só no envio de mensagem) para não travar a navegação de páginas.
  // `null` cacheado = página sem texto extraível (PDF escaneado).
  const pageTextCacheRef = useRef<Map<number, string | null>>(new Map())
  // Linhas de cada página (com a altura dela), de onde sai o texto limpo do
  // Translate. Cache por página; zera com o documento.
  const pageLinesCacheRef = useRef<Map<number, { lines: PdfLine[]; height: number }>>(new Map())
  // Refs do controlador de seleção manual. Nada disso vai em state — não
  // queremos re-render por arrasto. `isDraggingRef` é true entre o
  // `mousedown` na text layer e o `mouseup` correspondente. `anchorRef`
  // guarda a posição exata do caret no mousedown (obtida via
  // caretPositionFromPoint). `lastMousePosRef` é atualizada no
  // `mousemove` e lida em `selectionchange` para detectar salto.
  // `isClampingRef` é a guarda de re-entrância: quando sobrescrevemos
  // a seleção via setBaseAndExtent, o selectionchange que isso dispara
  // deve ser ignorado (mas o próximo genuíno, do browser no próximo
  // mousemove, volta a ser processado). `lineHeightRef` é a altura
  // típica de uma linha visual — usada como limiar para "foco longe
  // do mouse".
  const isDraggingRef = useRef<boolean>(false)
  const anchorRef = useRef<{ node: Text; offset: number } | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const isClampingRef = useRef<boolean>(false)
  const lineHeightRef = useRef<number>(20)
  const { confirm, modal: confirmModal } = useConfirm()

  // Refs para usar os valores atuais dentro de effects de montagem sem
  // reexecutá-los quando o pai propaga um book atualizado (mesmo id).
  const bookRef = useRef(book)
  bookRef.current = book
  const onBookChangeRef = useRef(onBookChange)
  onBookChangeRef.current = onBookChange
  const onBookLanguageChangeRef = useRef(onBookLanguageChange)
  onBookLanguageChangeRef.current = onBookLanguageChange
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  // Carga do documento (uma vez por livro) + last_opened_at.
  useEffect(() => {
    let cancelled = false
    let loadedDoc: PDFDocumentProxy | null = null

    const opened = { ...bookRef.current, lastOpenedAt: Date.now() }
    onBookChangeRef.current(opened)
    void storage
      .saveBook(opened)
      .catch((err) => console.error('failed to save last_opened_at', err))

    void (async () => {
      try {
        const data = await booksReadFile(opened.filePath)
        const d = await openPdf(data)
        if (cancelled) {
          void d.destroy()
          return
        }
        loadedDoc = d
        setPageNum(clampPage(opened.lastPage, d.numPages))
        setDoc(d)
        setLoading(false)
        // Primeira abertura de um livro sem língua verificada (importado antes
        // desta feature): detecta pela amostra do texto, com o documento aberto.
        if (opened.language === null) {
          const language = await detectPdfLanguage(d)
          if (cancelled) return
          void storage
            .setBookLanguage(opened.id, language)
            .catch((err) => console.error('failed to save book language', err))
          onBookLanguageChangeRef.current(language)
        }
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
      renderTaskRef.current?.cancel()
      if (loadedDoc) void loadedDoc.destroy()
    }
  }, [])

  // Estado de leitura específico do PDF, zerado ao trocar de livro. A carga
  // dos grifos e a limpeza de `colorFilter` ficam no useHighlights, que roda
  // no mesmo `book.id` (id diferente não ocorre aqui — o Reader é
  // desmontado/remontado pelo Library — mas a limpeza protege contra casos de
  // borda como React.StrictMode em dev).
  useEffect(() => {
    setSelection(null)
    setRemovalCandidate(null)
    setSearchOpen(false)
    setSearchQuery('')
    setActiveMatchIndex(-1)
  }, [book.id])

  // Persistência do toggle e da aba ativa da coluna lateral.
  useEffect(() => {
    try {
      localStorage.setItem(SIDE_OPEN_KEY, sideOpen ? '1' : '0')
    } catch (err) {
      console.error('failed to persist reader side panel toggle', err)
    }
  }, [sideOpen])

  useEffect(() => {
    try {
      localStorage.setItem(SIDE_TAB_KEY, sideTab)
    } catch (err) {
      console.error('failed to persist reader side tab', err)
    }
  }, [sideTab])

  // Persistência do colapso da coluna de navegação (Summary/Highlights).
  useEffect(() => {
    try {
      localStorage.setItem(SIDE_PANEL_COLLAPSED_KEY, sidePanelCollapsed ? '1' : '0')
    } catch (err) {
      console.error('failed to persist reader side panel toggle', err)
    }
  }, [sidePanelCollapsed])

  // Carrega o sumário (outline nativo do PDF) uma vez por documento. `undefined`
  // = carregando, `null` = PDF sem sumário embutido.
  useEffect(() => {
    if (!doc) {
      setOutline(undefined)
      return
    }
    let cancelled = false
    setOutline(undefined)
    void loadOutline(doc).then((result) => {
      if (!cancelled) setOutline(result)
    })
    return () => {
      cancelled = true
    }
  }, [doc])

  // Cache de texto por página é do documento atual; zera ao (re)carregar.
  useEffect(() => {
    pageTextCacheRef.current = new Map()
    pageLinesCacheRef.current = new Map()
  }, [doc])

  useEffect(() => {
    setSearchIndexReady(false)
    setSearchIndexProgress(0)
  }, [doc])

  // Extração de texto da página sob demanda (contexto do chat), com cache.
  // Não usa a TextLayer visual: `getTextContent` é rápido e o pdfjs cacheia
  // os page proxies internamente.
  const getPageText = useCallback(
    async (n: number): Promise<string | null> => {
      const cache = pageTextCacheRef.current
      const cached = cache.get(n)
      if (cached !== undefined) return cached
      if (!doc) return null
      try {
        const page = await doc.getPage(n)
        const tc = await page.getTextContent()
        const text = tc.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        const value = text.length > 0 ? text : null
        cache.set(n, value)
        return value
      } catch (err) {
        console.error('failed to extract page text', err)
        return null
      }
    },
    [doc],
  )

  // Texto limpo da página (linhas juntadas, hífen de quebra desfeito, e com
  // `skipHeaders` sem cabeçalho, rodapé e número de página). O getPageText
  // acima, do chat e da busca, não muda.
  const getPageCleanText = useCallback(
    async (n: number, skipHeaders: boolean): Promise<CleanPageResult> => {
      if (!doc) return { text: '', skipped: [] }
      let entry = pageLinesCacheRef.current.get(n)
      if (!entry) {
        try {
          const page = await doc.getPage(n)
          const content = await page.getTextContent()
          const items: PdfTextItem[] = []
          for (const item of content.items) {
            if (!('str' in item)) continue
            items.push({
              str: item.str,
              hasEOL: item.hasEOL,
              y: item.transform[5],
              height: item.height,
            })
          }
          entry = { lines: pdfItemsToLines(items), height: page.getViewport({ scale: 1 }).height }
          pageLinesCacheRef.current.set(n, entry)
        } catch (err) {
          console.error('failed to extract clean page text', err)
          return { text: '', skipped: [] }
        }
      }
      return cleanPdfPage(entry.lines, entry.height, {
        skipHeaders,
        language: book.language ?? '',
      })
    },
    [doc, book.language],
  )

  // Indexação full-document em background: dispara quando a busca é
  // aberta pela primeira vez neste documento, varre TODAS as páginas via
  // getPageText (que já cacheia em pageTextCacheRef) e cede a thread a
  // cada página (setTimeout 0) para nunca travar a UI/render da página
  // atual. Fechar a busca antes de terminar cancela o loop (cleanup),
  // mas reabrir retoma quase instantaneamente pelas páginas já
  // cacheadas — não é necessário persistir um ponteiro de progresso à
  // parte.
  useEffect(() => {
    if (!searchOpen || !doc) return
    if (searchIndexReady || searchIndexingRef.current) return
    searchIndexingRef.current = true
    let cancelled = false
    void (async () => {
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return
        await getPageText(n)
        if (cancelled) return
        setSearchIndexProgress(n)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (!cancelled) setSearchIndexReady(true)
    })()
    return () => {
      cancelled = true
      searchIndexingRef.current = false
    }
  }, [searchOpen, doc, searchIndexReady, getPageText])

  // Renderização sob demanda: apenas a página atual (canvas + text layer).
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    let effectCleanup: (() => void) | null = null

    void (async () => {
      try {
        const page = await doc.getPage(pageNum)
        if (cancelled) return
        const canvas = canvasRef.current
        const textContainer = textLayerRef.current
        if (!canvas || !textContainer) return

        renderTaskRef.current?.cancel()

        const viewport = page.getViewport({ scale })
        const dpr = window.devicePixelRatio || 1
        // Buffer de pixels do dispositivo (pode ter fração de pixel —
        // Math.floor evita subpixel no canvas backing store).
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        // Tamanho CSS EXATO (sem Math.floor): o text layer container é
        // dimensionado pela TextLayer como calc(var(--total-scale-factor) *
        // pageWidth) = viewport.width. Se a style do canvas for
        // truncada com Math.floor, o canvas fica até ~1px mais estreito
        // que a text layer e o texto visível fica desalinhado dos spans
        // (causa de seleção imprecisa perto das bordas).
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        const task = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
        renderTaskRef.current = task
        await task.promise
        renderTaskRef.current = null
        if (cancelled) return

        textContainer.innerHTML = ''
        textContainer.style.setProperty(
          '--total-scale-factor',
          String(viewport.scale),
        )
        // A TextLayer.setLayerDimensions define width/height do container
        // via calc(var(--total-scale-factor) * pageWidth/Height) =
        // viewport.width/height (exato). Não setamos style.width/height
        // aqui para não criar um valor intermediário incorreto: o
        // container com `inset: 0` já se dimensiona ao pageWrap (que tem
        // o tamanho do canvas) antes da TextLayer sobrescrever.
        try {
          const textLayer = new TextLayer({
            textContentSource: page.streamTextContent(),
            container: textContainer,
            viewport,
          })
          textLayerTaskRef.current = textLayer
          await textLayer.render()
        } catch {
          // sem text layer — segue só com o canvas
        }
        if (cancelled) return

        computeSearchMatchRectsRef.current()
        applyListenMarkRef.current(pageNum)
        applyVocabMarksRef.current(pageNum)

        // Instala os listeners do controlador de seleção manual. Limpa
        // qualquer estado de drag anterior cujos nodes podem ter sido
        // detached pelo re-render (troca de página/zoom).
        isDraggingRef.current = false
        anchorRef.current = null
        lastMousePosRef.current = null
        isClampingRef.current = false

        // Calcula a altura típica de uma linha visual a partir dos
        // spans recém-renderizados. Usamos o range de `top`s
        // consecutivos como heurística (a diferença de top entre dois
        // spans de linhas diferentes = line height). Fallback de 20px
        // se a text layer estiver vazia / escaneada.
        const allSpans = Array.from(
          textContainer.querySelectorAll<HTMLElement>('span'),
        ).filter(
          (s) =>
            s.getBoundingClientRect().width > 0 &&
            s.getBoundingClientRect().height > 0 &&
            (s.textContent ?? '').length > 0,
        )
        if (allSpans.length >= 2) {
          const tops = allSpans
            .map((s) => s.getBoundingClientRect().top)
            .sort((a, b) => a - b)
          const diffs: number[] = []
          for (let i = 1; i < tops.length; i++) {
            const d = tops[i] - tops[i - 1]
            if (d > 1) diffs.push(d)
          }
          if (diffs.length > 0) {
            diffs.sort((a, b) => a - b)
            lineHeightRef.current = diffs[Math.floor(diffs.length / 2)]
          } else {
            const h = allSpans[0].getBoundingClientRect().height
            if (h > 0) lineHeightRef.current = h
          }
        } else if (allSpans.length === 1) {
          const h = allSpans[0].getBoundingClientRect().height
          if (h > 0) lineHeightRef.current = h
        }

        const onTextLayerMouseDown = (e: MouseEvent) => {
          if (e.button !== 0) {
            isDraggingRef.current = false
            anchorRef.current = null
            lastMousePosRef.current = null
            return
          }
          const caret = getCaretFromPoint(e.clientX, e.clientY)
          if (!caret) {
            isDraggingRef.current = false
            anchorRef.current = null
            lastMousePosRef.current = null
            return
          }
          const offsetNode = caret.node as Node
          if (offsetNode.nodeType !== Node.TEXT_NODE) {
            isDraggingRef.current = false
            anchorRef.current = null
            lastMousePosRef.current = null
            return
          }
          if (!textContainer.contains(offsetNode)) {
            isDraggingRef.current = false
            anchorRef.current = null
            lastMousePosRef.current = null
            return
          }
          const textNode = offsetNode as Text
          anchorRef.current = { node: textNode, offset: caret.offset }
          lastMousePosRef.current = { x: e.clientX, y: e.clientY }
          isDraggingRef.current = true
          // Força o anchor EXATO no ponto do clique, sobrescrevendo o
          // anchor nativo do browser. Isso garante precisão de
          // caractere no início do drag (complementar à correção de
          // CSS dos spans).
          try {
            const sel = window.getSelection()
            if (sel && typeof sel.setBaseAndExtent === 'function') {
              isClampingRef.current = true
              sel.setBaseAndExtent(textNode, caret.offset, textNode, caret.offset)
              queueMicrotask(() => {
                isClampingRef.current = false
              })
            }
          } catch {
            // node pode ter sido detached entre o check e o set;
            // descarta e deixa o browser seguir.
          }
        }

        const onWindowMouseMove = (e: MouseEvent) => {
          lastMousePosRef.current = { x: e.clientX, y: e.clientY }
          // A correção do foco acontece em `selectionchange` (mais
          // confiável, após o browser atualizar a seleção).
        }

        const onWindowMouseUp = () => {
          isDraggingRef.current = false
          anchorRef.current = null
          lastMousePosRef.current = null
        }

        const onSelectionChange = () => {
          if (!isDraggingRef.current) return
          if (isClampingRef.current) return
          const anchor = anchorRef.current
          const mouse = lastMousePosRef.current
          if (!anchor || !mouse) return
          if (!anchor.node.isConnected) {
            // A text layer re-renderizou mid-drag (troca de página /
            // zoom). Limpa o anchor e deixa a seleção seguir o
            // browser.
            isDraggingRef.current = false
            anchorRef.current = null
            lastMousePosRef.current = null
            return
          }
          const sel = window.getSelection()
          if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
          const focusNode = sel.focusNode
          if (!focusNode) return
          const focusSpan = findSpanElement(focusNode)
          if (!focusSpan) return
          if (!textContainer.contains(focusSpan)) return
          const focusRect = focusSpan.getBoundingClientRect()
          if (focusRect.width === 0 || focusRect.height === 0) return
          const centerY = focusRect.top + focusRect.height / 2
          const distY = Math.abs(centerY - mouse.y)
          const threshold = 1.5 * lineHeightRef.current
          if (distY <= threshold) return
          // Salto detectado: o foco está claramente a várias linhas do
          // cursor. Sobrescreve a seleção com a posição do caret mais
          // próximo do mouse, mantendo o anchor original.
          const caret = getCaretFromPoint(mouse.x, mouse.y)
          if (!caret) return
          const endNode = caret.node
          if (endNode.nodeType !== Node.TEXT_NODE) return
          if (!textContainer.contains(endNode)) return
          try {
            isClampingRef.current = true
            sel.setBaseAndExtent(
              anchor.node,
              anchor.offset,
              endNode as Text,
              caret.offset,
            )
          } catch {
            // nodes podem ter sido detached entre o check e o set;
            // descarta o clamp e segue.
          } finally {
            queueMicrotask(() => {
              isClampingRef.current = false
            })
          }
        }

        textContainer.addEventListener('mousedown', onTextLayerMouseDown)
        window.addEventListener('mousemove', onWindowMouseMove)
        window.addEventListener('mouseup', onWindowMouseUp)
        document.addEventListener('selectionchange', onSelectionChange)

        const removeListeners = () => {
          textContainer.removeEventListener('mousedown', onTextLayerMouseDown)
          window.removeEventListener('mousemove', onWindowMouseMove)
          window.removeEventListener('mouseup', onWindowMouseUp)
          document.removeEventListener('selectionchange', onSelectionChange)
        }

        if (prevPageRef.current && prevPageRef.current !== page) {
          prevPageRef.current.cleanup()
        }
        prevPageRef.current = page
        // Anexa o cleanup dos listeners ao cancelamento: se o effect
        // re-rodar (troca de página/zoom/doc), os listeners são
        // removidos antes dos novos serem instalados.
        effectCleanup = removeListeners
      } catch (err) {
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          return
        }
        if (!cancelled) {
          console.error('failed to render page', err)
        }
      }
    })()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      textLayerTaskRef.current?.cancel()
      textLayerTaskRef.current = null
      if (effectCleanup) effectCleanup()
    }
  }, [doc, pageNum, scale])

  // Persistência de last_page: debounce por troca de página + flush no unmount.
  const flushPendingPage = useCallback(() => {
    const page = pendingPageRef.current
    if (page == null) return
    pendingPageRef.current = null
    const updated = { ...bookRef.current, lastPage: page }
    void storage
      .saveBook(updated)
      .catch((err) => console.error('failed to save last_page', err))
    onBookChangeRef.current(updated)
  }, [])

  useEffect(() => {
    if (!doc) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (pageNum === bookRef.current.lastPage) {
      pendingPageRef.current = null
      return
    }
    pendingPageRef.current = pageNum
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      flushPendingPage()
    }, SAVE_DEBOUNCE_MS)
  }, [doc, pageNum, flushPendingPage])

  // Persistência de zoom: debounce + flush no unmount. Análogo ao de
  // `last_page`, mas com um timer próprio para que um save de página
  // não impeça o flush de zoom e vice-versa.
  const flushPendingZoom = useCallback(() => {
    const z = pendingZoomRef.current
    if (z == null) return
    pendingZoomRef.current = null
    const updated = { ...bookRef.current, zoom: z }
    void storage
      .saveBook(updated)
      .catch((err) => console.error('failed to save zoom', err))
    onBookChangeRef.current(updated)
  }, [])

  useEffect(() => {
    if (!doc) return
    if (saveZoomTimerRef.current) {
      clearTimeout(saveZoomTimerRef.current)
      saveZoomTimerRef.current = null
    }
    const persisted = bookRef.current.zoom
    if (scale === persisted) {
      pendingZoomRef.current = null
      return
    }
    pendingZoomRef.current = scale
    saveZoomTimerRef.current = setTimeout(() => {
      saveZoomTimerRef.current = null
      flushPendingZoom()
    }, SAVE_DEBOUNCE_MS)
  }, [doc, scale, flushPendingZoom])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      flushPendingPage()
    }
  }, [flushPendingPage])

  useEffect(() => {
    return () => {
      if (saveZoomTimerRef.current) clearTimeout(saveZoomTimerRef.current)
      flushPendingZoom()
    }
  }, [flushPendingZoom])

  useEffect(() => {
    setPageInput(String(pageNum))
  }, [pageNum])

  // A página nova começa no topo, como ao virar a folha.
  useEffect(() => {
    pageAreaRef.current?.scrollTo({ top: 0 })
  }, [pageNum])

  // Fit width / Fit page: recalcula o zoom pela área da página ao trocar de
  // página e quando a área muda de tamanho (janela, colunas laterais).
  useEffect(() => {
    const area = pageAreaRef.current
    if (!doc || !fitMode || !area) return
    let cancelled = false
    const fit = async () => {
      try {
        const page = await doc.getPage(pageNum)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const cs = getComputedStyle(area)
        const availW =
          area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        const availH =
          area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        if (availW <= 0 || availH <= 0) return
        const byWidth = availW / base.width
        const next = fitMode === 'width' ? byWidth : Math.min(byWidth, availH / base.height)
        setScale(clampScale(Math.floor(next * 100) / 100))
      } catch (err) {
        console.error('failed to fit page to the reading area', err)
      }
    }
    void fit()
    const observer = new ResizeObserver(() => void fit())
    observer.observe(area)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [doc, pageNum, fitMode])

  function chooseFitMode(mode: FitMode) {
    setFitMode(mode)
    saveFitMode(book.id, mode)
  }

  // − e + voltam ao zoom manual.
  function zoomBy(delta: number) {
    if (fitMode) {
      setFitMode(null)
      saveFitMode(book.id, null)
    }
    setScale((s) => clampScale(s + delta))
  }

  // Página sem text layer (PDF escaneado): a faixa avisa que grifo, busca e
  // o contexto da IA não funcionam nela.
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    void getPageText(pageNum).then((text) => {
      if (!cancelled) setPageHasNoText(text === null)
    })
    return () => {
      cancelled = true
    }
  }, [doc, pageNum, getPageText])

  const goToPage = useCallback(
    (page: number) => {
      if (!doc) return
      setPageNum(clampPage(page, doc.numPages))
    },
    [doc],
  )

  // Navegação "de citação" (clique num grifo ou item do sumário): marca a
  // página atual como ponto de retorno antes de saltar, para o botão "Back
  // to p. N" da toolbar. Chamadas de ‹›/input de página usam goToPage
  // diretamente e não mexem no marcador.
  function jumpToPage(page: number) {
    if (page === pageNum) return
    setJumpBackPage(pageNum)
    goToPage(page)
  }

  // O marcador some sozinho assim que o usuário chega de volta na página de
  // origem — por qualquer meio, não só pelo botão "Back".
  useEffect(() => {
    setJumpBackPage((prev) => (prev === pageNum ? null : prev))
  }, [pageNum])

  // ─── Navegação entre ocorrências de busca ─────────────────────────────
  // Não usa jumpToPage aqui: jumpToPage sempre sobrescreve jumpBackPage com a
  // página atual, o que faria o marcador "andar" junto com cada Next/Previous.
  // Em vez disso, o marcador só é setado na primeira vez que a busca sai da
  // página de origem (jumpBackPage ainda null) e é preservado nos saltos
  // seguintes, até o useEffect acima limpá-lo ao retornar à página marcada.
  function goToMatch(index: number) {
    const m = flatMatches[index]
    if (!m) return
    setActiveMatchIndex(index)
    if (m.page !== pageNum) {
      setJumpBackPage((prev) => (prev === null ? pageNum : prev))
    }
    goToPage(m.page)
  }

  function goToNextMatch() {
    if (flatMatches.length === 0) return
    const next = activeMatchIndex < 0 ? 0 : (activeMatchIndex + 1) % flatMatches.length
    goToMatch(next)
  }

  function goToPreviousMatch() {
    if (flatMatches.length === 0) return
    const prev =
      activeMatchIndex < 0
        ? flatMatches.length - 1
        : (activeMatchIndex - 1 + flatMatches.length) % flatMatches.length
    goToMatch(prev)
  }

  // Fechar toolbar/popover em troca de página, zoom, resize.
  useEffect(() => {
    setSelection(null)
    setRemovalCandidate(null)
    setPageMatchRects([])
    setSavedWord(null)
    setHereTranslate(null)
  }, [pageNum, scale])

  useEffect(() => {
    function onResize() {
      setSelection(null)
      setRemovalCandidate(null)
      setSavedWord(null)
      setHereTranslate(null)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // O Translate só vive com a seleção e com as ferramentas ligadas: fechar a
  // seleção (clique fora, troca de página, zoom, resize) ou desligar as
  // ferramentas (Settings, "Change" do popover) fecha o popover.
  useEffect(() => {
    if (translate && (!selection || !toolsOn)) setTranslate(null)
  }, [translate, selection, toolsOn])

  useEffect(() => {
    if (!toolsOn) {
      setItemTranslate(null)
      setHereTranslate(null)
    }
  }, [toolsOn])

  // A palavra marcada some com a marca (a chave "Mark in text", as ferramentas de
  // língua) e quando a página rola por baixo dela.
  const savedWordOpen = savedWord !== null || hereTranslate !== null
  useEffect(() => {
    if (!marksEnabled) setSavedWord(null)
  }, [marksEnabled])
  useEffect(() => {
    const area = pageAreaRef.current
    if (!savedWordOpen || !area) return
    const close = () => {
      setSavedWord(null)
      setHereTranslate(null)
    }
    area.addEventListener('scroll', close, { passive: true })
    return () => area.removeEventListener('scroll', close)
  }, [savedWordOpen])

  // A página rola por dentro da área: o popover acompanha o texto selecionado.
  const translateOpen = translate !== null
  useEffect(() => {
    const area = pageAreaRef.current
    if (!translateOpen || !area) return
    const follow = () => setTranslate((t) => (t ? { ...t, anchor: rangeAnchor(t.range) } : t))
    area.addEventListener('scroll', follow, { passive: true })
    return () => area.removeEventListener('scroll', follow)
  }, [translateOpen])

  // Sem player aberto não há faixa cinza, e ao fechar o leitor ela sai do registro
  // da janela (que é de todos os leitores).
  useEffect(() => {
    if (!player.open) {
      listenAnchorRef.current = null
      clearPageMarks('listen')
    }
  }, [player.open])
  useEffect(() => () => clearPageMarks('listen'), [])

  // Desligar as ferramentas de língua (Settings, "Change" do Translate) fecha o
  // player junto.
  useEffect(() => {
    if (!toolsOn && player.open) player.close()
  }, [toolsOn, player])

  // Trocar de página com áudio de outra página: pausa e o player oferece "Back to
  // p. N". Voltar à página não retoma sozinho.
  useEffect(() => {
    const source = player.state.source
    if (!source || source.page === null) return
    if (source.page !== pageNum) player.pause('away')
    else if (player.state.awayFromPage !== null) player.clearAway()
    // Só a troca de página dispara; o player lido é o do render dela.
  }, [pageNum])

  // Atalhos do leitor (ignorando inputs/textarea/contenteditable): ←/→ trocam
  // de página, Esc fecha a toolbar de seleção e o popover do grifo, H grifa a
  // seleção com a última cor, T traduz e V guarda a seleção no vocabulário. Com o
  // player aberto: Espaço toca e pausa, R repete e Shift+←/→ pulam de frase (sem
  // virar a página). L lê a seleção, ou a página.
  // O handler é trocado a cada render (ref) para ver a seleção atual.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandlerRef.current = (e: KeyboardEvent) => {
    // Campo, <select> (o do menu do player, o do Translate) e modal ficam com as
    // teclas deles, setas inclusive.
    if (ownsKeyboard(e.target)) return
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
    if (e.key === 'ArrowLeft') {
      setPageNum((p) => Math.max(1, p - 1))
    } else if (e.key === 'ArrowRight' && doc) {
      const total = doc.numPages
      setPageNum((p) => Math.min(total, p + 1))
    } else if (e.key === 'Escape' && translate) {
      // Fecha o popover e devolve a barra; o Esc seguinte limpa a seleção.
      setTranslate(null)
    } else if (e.key === 'Escape' && (selection || removalCandidate)) {
      setSelection(null)
      setRemovalCandidate(null)
      window.getSelection()?.removeAllRanges()
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
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Ctrl+F abre (ou foca) a busca no livro. Fica na captura para passar à
  // frente do Ctrl+F do editor, exceto com o foco na nota da aba Notes ou num
  // modal, que têm a busca deles.
  useEffect(() => {
    function onFind(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return
      if (document.activeElement?.closest('[data-note-editor], [aria-modal="true"]')) return
      e.preventDefault()
      e.stopPropagation()
      setSearchOpen(true)
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    window.addEventListener('keydown', onFind, true)
    return () => window.removeEventListener('keydown', onFind, true)
  }, [])

  function commitPageInput() {
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(pageNum))
      return
    }
    goToPage(parsed)
    if (doc) setPageInput(String(clampPage(parsed, doc.numPages)))
  }

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === pageNum),
    [highlights, pageNum],
  )

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const matchesByPage = useMemo<PageMatchCount[]>(() => {
    if (!normalizedQuery) return []
    const result: PageMatchCount[] = []
    for (let n = 1; n <= searchIndexProgress; n++) {
      const text = pageTextCacheRef.current.get(n)
      if (!text) continue
      const lower = text.toLowerCase()
      let count = 0
      let idx = lower.indexOf(normalizedQuery)
      while (idx !== -1) {
        count++
        idx = lower.indexOf(normalizedQuery, idx + normalizedQuery.length)
      }
      if (count > 0) result.push({ page: n, count })
    }
    return result
  }, [normalizedQuery, searchIndexProgress])

  const flatMatches = useMemo<SearchMatch[]>(() => {
    const flat: SearchMatch[] = []
    for (const pm of matchesByPage) {
      for (let i = 0; i < pm.count; i++) {
        flat.push({ page: pm.page, occurrenceIndexOnPage: i })
      }
    }
    return flat
  }, [matchesByPage])

  const currentMatch = activeMatchIndex >= 0 ? (flatMatches[activeMatchIndex] ?? null) : null

  useEffect(() => {
    setActiveMatchIndex(-1)
  }, [normalizedQuery])

  useEffect(() => {
    if (!currentMatch || currentMatch.page !== pageNum) return
    const el = pageWrapRef.current?.querySelector<HTMLElement>('[data-match-active="true"]')
    el?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }, [currentMatch, pageMatchRects, pageNum])

  // Trocar a cor pelo popover fecha o popover antes de qualquer coisa —
  // inclusive quando a cor clicada é a que o grifo já tem.
  function handleChangeHighlightColor(h: BookHighlight, color: string) {
    setRemovalCandidate(null)
    changeColor(h, color)
  }

  // ─── Retângulos de destaque das ocorrências de busca ──────────────────
  const computeSearchMatchRects = useCallback(() => {
    const textContainer = textLayerRef.current
    if (!textContainer || !searchOpen || !normalizedQuery) {
      setPageMatchRects([])
      return
    }
    const textRect = textContainer.getBoundingClientRect()
    if (textRect.width === 0 || textRect.height === 0) {
      setPageMatchRects([])
      return
    }
    const ranges = findAllOccurrenceRanges(textContainer, normalizedQuery)
    const rectsPerMatch: BookHighlightRect[][] = ranges.map((range) => {
      const domRects = Array.from(range.getClientRects())
      const rects: BookHighlightRect[] = []
      for (const r of domRects) {
        if (r.width === 0 || r.height === 0) continue
        rects.push({
          x: (r.left - textRect.left) / textRect.width,
          y: (r.top - textRect.top) / textRect.height,
          w: r.width / textRect.width,
          h: r.height / textRect.height,
        })
      }
      return rects
    })
    setPageMatchRects(rectsPerMatch)
  }, [searchOpen, normalizedQuery])

  const computeSearchMatchRectsRef = useRef(computeSearchMatchRects)
  computeSearchMatchRectsRef.current = computeSearchMatchRects

  // Faixa cinza do trecho em leitura. O Range sai dos offsets guardados, porque a
  // camada de texto é refeita a cada página e a cada zoom; só vale na página de
  // origem do áudio.
  function applyListenMark(page: number) {
    const anchor = listenAnchorRef.current
    const container = textLayerRef.current
    if (!anchor || anchor.page !== page || !container) {
      clearPageMarks('listen')
      return
    }
    const { spanRanges } = buildJoinedPageText(getPageSpans(container))
    const range = buildRangeFromOffsets(spanRanges, anchor.start, anchor.end)
    if (range) setPageMarks('listen', [range])
    else clearPageMarks('listen')
  }
  const applyListenMarkRef = useRef(applyListenMark)
  applyListenMarkRef.current = applyListenMark

  // Pontilhado das palavras guardadas na página: todas as ocorrências da forma
  // guardada e da base, por palavra inteira, e as frases guardadas nesta página no
  // lugar de origem. As palavras vêm antes das frases na lista (o clique vale a
  // primeira que contém o ponto). Refeito a cada renderização da camada de texto.
  function applyVocabMarks(page: number) {
    const container = textLayerRef.current
    if (!marksEnabled || !container) {
      markEntriesRef.current = []
      clearPageMarks('vocab')
      return
    }
    const { text, spanRanges } = buildJoinedPageText(getPageSpans(container))
    const entries: MarkEntry[] = []
    for (const occurrence of findTermOccurrences(text, marks.terms)) {
      const range = buildRangeFromOffsets(spanRanges, occurrence.start, occurrence.end)
      if (range) entries.push({ range, itemIds: occurrence.itemIds })
    }
    for (const anchor of pdfSentenceAnchors(marks.items, book.id, page)) {
      const range = buildRangeFromOffsets(spanRanges, anchor.start, anchor.end)
      if (range) entries.push({ range, itemIds: [anchor.itemId] })
    }
    markEntriesRef.current = entries
    if (entries.length > 0) setPageMarks('vocab', entries.map((entry) => entry.range))
    else clearPageMarks('vocab')
  }
  const applyVocabMarksRef = useRef(applyVocabMarks)
  applyVocabMarksRef.current = applyVocabMarks

  // A lista de itens mudou (guardar, remover, a chave "Mark in text", as
  // ferramentas de língua): refaz as marcas da página que está na tela.
  useEffect(() => {
    applyVocabMarksRef.current(pageNumRef.current)
  }, [marksEnabled, marks.terms, marks.items])
  useEffect(() => () => clearPageMarks('vocab'), [])

  // Recalcula os retângulos de destaque quando o usuário digita/abre/fecha a
  // busca sem trocar de página (a troca de página já é coberta pela chamada
  // via computeSearchMatchRectsRef dentro do effect de renderização).
  useEffect(() => {
    computeSearchMatchRects()
  }, [searchOpen, normalizedQuery, pageNum, computeSearchMatchRects])

  // ─── Seleção → toolbar flutuante ──────────────────────────────────────
  function handleTextMouseUp() {
    const wrap = pageWrapRef.current
    const textContainer = textLayerRef.current
    if (!wrap || !textContainer) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelection(null)
      return
    }
    const range = sel.getRangeAt(0)
    // Garante que a seleção está dentro da text layer da página atual.
    if (!textContainer.contains(range.commonAncestorContainer)) {
      setSelection(null)
      return
    }
    const text = sel.toString().trim()
    if (!text) {
      setSelection(null)
      return
    }
    const wrapRect = wrap.getBoundingClientRect()
    const textRect = textContainer.getBoundingClientRect()
    if (textRect.width === 0 || textRect.height === 0) {
      // PDF escaneado ou text layer não montada — sem retângulos.
      setSelection(null)
      return
    }
    const domRects = Array.from(range.getClientRects())
    const rects: BookHighlightRect[] = []
    for (const r of domRects) {
      if (r.width === 0 || r.height === 0) continue
      rects.push({
        x: (r.left - textRect.left) / textRect.width,
        y: (r.top - textRect.top) / textRect.height,
        w: r.width / textRect.width,
        h: r.height / textRect.height,
      })
    }
    if (rects.length === 0) {
      setSelection(null)
      return
    }
    const bbox = range.getBoundingClientRect()
    const anchor: PagePoint = {
      x: bbox.left - wrapRect.left,
      y: bbox.top - wrapRect.top,
      w: bbox.width,
      h: bbox.height,
    }
    setSelection({ rects, text, anchor })
    setRemovalCandidate(null)
  }

  // Click fora fecha a toolbar/popover.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (toolbarRef.current && toolbarRef.current.contains(target)) return
      if (popoverRef.current && popoverRef.current.contains(target)) return
      if (translatePopoverRef.current && translatePopoverRef.current.contains(target)) return
      if (highlightLayerRef.current && highlightLayerRef.current.contains(target)) return
      setSelection(null)
      setRemovalCandidate(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  // ─── Ações da toolbar ─────────────────────────────────────────────────
  function chooseColor(color: string) {
    setActiveColor(color)
    saveHighlightColor(color)
  }

  async function handleHighlight(color: string) {
    if (!selection) return
    const highlight: BookHighlight = {
      id: crypto.randomUUID(),
      bookId: book.id,
      page: pageNum,
      text: selection.text,
      color,
      rects: selection.rects,
      createdAt: Date.now(),
    }
    setSelection(null)
    window.getSelection()?.removeAllRanges()
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
    window.getSelection()?.removeAllRanges()
  }

  // Ações compartilhadas entre a toolbar de seleção, o popover de grifo e os
  // itens do painel de grifos — cada chamador resolve seu próprio
  // texto/página (seleção atual ou grifo específico) e delega aqui.
  function askAiAbout(text: string, page: number) {
    setPendingQuote({ text, page })
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

  // Alterna a coluna lateral: clicar na aba já ativa (com a coluna aberta)
  // fecha a coluna; clicar em outra aba troca e garante a coluna aberta.
  function selectSideTab(tab: SideTab) {
    if (sideOpen && sideTab === tab) {
      setSideOpen(false)
    } else {
      setSideTab(tab)
      setSideOpen(true)
    }
  }

  function handleAddToNote() {
    if (!selection) return
    addQuoteToNote(selection.text, pageNum, pdfPositionLabel(pageNum))
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  // "Ask AI": abre o chat (se fechado) e envia o trecho selecionado para o
  // composer como citação — o usuário complementa e envia.
  function handleAskAi() {
    if (!selection) return
    askAiAbout(selection.text, pageNum)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  // ─── Translate ────────────────────────────────────────────────────────
  // A seleção continua marcada: o popover guarda o texto (limpo: sem quebra de
  // linha nem hífen de fim de linha), a frase de contexto achada no texto limpo
  // da página e o Range, de onde sai o retângulo ancorado.
  async function handleTranslate() {
    if (!selection || translate) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0).cloneRange()
    const page = pageNum
    const language = book.language ?? ''
    const text = cleanPdfSelectionText(selection.text, language)
    const occurrence = occurrenceOfRange(range, text)
    // Acima do limite não há chamada: nem a frase de contexto é preciso achar.
    const sentence =
      text.length > TRANSLATE_CHAR_LIMIT
        ? text
        : contextSentenceAt((await getPageCleanText(page, false)).text, text, language, occurrence)
    setTranslate({ text, sentence, page, range, anchor: rangeAnchor(range) })
    // Abrir o Translate pausa o áudio durante a consulta.
    player.pause('translate')
  }

  // ─── Listen ───────────────────────────────────────────────────────────
  // A seleção vira frases (texto limpo) e o trecho inteiro fica em cinza na
  // página, mesmo depois de a seleção sumir.
  function handleListen() {
    if (!selection) return
    const language = book.language ?? ''
    const text = cleanPdfSelectionText(selection.text, language)
    const sentences = splitSentences(text, language)
    if (sentences.length === 0) return
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
    const container = textLayerRef.current
    const offsets =
      range && container ? rangeToJoinedOffsets(buildJoinedPageText(getPageSpans(container)).spanRanges, range) : null
    const page = pageNum
    listenAnchorRef.current = offsets ? { page, ...offsets } : null
    player.play({
      id: crypto.randomUUID(),
      kind: 'selection',
      originLabel: `Selection · ${pdfPositionLabel(page)}`,
      endLabel: 'End of the selection',
      sentences,
      chars: sentences.reduce((total, sentence) => total + sentence.length, 0),
      page,
      backLabel: pdfPositionLabel(page),
      notice: null,
    })
    applyListenMark(page)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  // A página inteira, sem cabeçalho, rodapé e número de página (se o menu ⋯ do
  // player mandar). Sem faixa cinza: a página toda é o trecho.
  async function handleListenPage() {
    if (!doc || pageHasNoText) return
    const page = pageNum
    const { text, skipped } = await getPageCleanText(page, getTtsSkipHeaders())
    if (pageNumRef.current !== page) return
    const sentences = splitSentences(text, book.language ?? '')
    if (sentences.length === 0) {
      showToast({ message: 'Nothing to read on this page.' })
      return
    }
    listenAnchorRef.current = null
    clearPageMarks('listen')
    player.play({
      id: crypto.randomUUID(),
      kind: 'page',
      originLabel: `Page ${page}`,
      endLabel: `End of page ${page}`,
      sentences,
      chars: sentences.reduce((total, sentence) => total + sentence.length, 0),
      page,
      backLabel: pdfPositionLabel(page),
      notice: skippedNotice(skipped),
    })
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
  // O lugar da seleção: offsets no texto juntado da página (a camada de texto é
  // refeita a cada página e zoom) e os mesmos retângulos que o grifo guarda. Sem
  // offsets (seleção que vazou da camada de texto) o item aponta só a página.
  function vocabularyAnchor(
    page: number,
    range: Range,
    rects: BookHighlightRect[],
  ): VocabularyAnchor {
    const container = textLayerRef.current
    const offsets = container
      ? rangeToJoinedOffsets(buildJoinedPageText(getPageSpans(container)).spanRanges, range)
      : null
    return { format: 'pdf', page, start: offsets?.start ?? 0, end: offsets?.end ?? 0, rects }
  }

  // Qual ocorrência do termo (a 1ª, a 2ª…) o trecho é na página, contada no texto
  // juntado da camada de texto: com o termo repetido, é ela que dá a frase certa.
  function occurrenceOfRange(range: Range, term: string): number {
    const container = textLayerRef.current
    if (!container) return 0
    const { text, spanRanges } = buildJoinedPageText(getPageSpans(container))
    const offsets = rangeToJoinedOffsets(spanRanges, range)
    return offsets ? countTermBefore(text, term, offsets.start) : 0
  }

  function vocabularyDraft(
    text: string,
    sentence: string,
    page: number,
    anchor: VocabularyAnchor,
    translation: Translation | null,
  ): VocabularyDraft {
    return {
      text,
      sentence,
      kind: classifySelection(text, sentence),
      ...translationFields(translation),
      page,
      positionLabel: pdfPositionLabel(page),
      anchor,
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
    if (!selection) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0).cloneRange()
    const page = pageNum
    const language = book.language ?? ''
    const text = cleanPdfSelectionText(selection.text, language)
    const anchor = vocabularyAnchor(page, range, selection.rects)
    const occurrence = occurrenceOfRange(range, text)
    setSelection(null)
    sel.removeAllRanges()
    const sentence =
      text.length > TRANSLATE_CHAR_LIMIT
        ? text
        : contextSentenceAt((await getPageCleanText(page, false)).text, text, language, occurrence)
    await saveToVocabulary(vocabularyDraft(text, sentence, page, anchor, null))
  }

  // "Add to vocabulary" do popover do Translate: o item entra com o sentido que
  // estava na tela.
  async function handleAddFromPopover(translation: Translation | null) {
    if (!translate || !selection) return
    const { text, sentence, page, range } = translate
    const anchor = vocabularyAnchor(page, range, selection.rects)
    setTranslate(null)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
    await saveToVocabulary(vocabularyDraft(text, sentence, page, anchor, translation))
  }

  function openVocabularyItem(item: VocabularyItem) {
    if (!doc || item.anchor.format !== 'pdf' || item.page < 1 || item.page > doc.numPages) {
      showToast({ message: "This item's place in the book wasn't found.", tone: 'error' })
      return
    }
    jumpToPage(item.page)
  }

  // Os retângulos de um trecho, de 0 a 1 pela caixa da camada de texto: o que o
  // grifo e o vocabulário guardam.
  function pdfRangeRects(range: Range): BookHighlightRect[] {
    const textRect = textLayerRef.current?.getBoundingClientRect()
    if (!textRect || textRect.width === 0 || textRect.height === 0) return []
    const rects: BookHighlightRect[] = []
    for (const r of Array.from(range.getClientRects())) {
      if (r.width === 0 || r.height === 0) continue
      rects.push({
        x: (r.left - textRect.left) / textRect.width,
        y: (r.top - textRect.top) / textRect.height,
        w: r.width / textRect.width,
        h: r.height / textRect.height,
      })
    }
    return rects
  }

  // ─── Palavra marcada no texto ─────────────────────────────────────────
  function openSavedWord(entry: MarkEntry) {
    const term = entry.range.toString().replace(/\s+/g, ' ').trim()
    if (!term) return
    setSelection(null)
    setRemovalCandidate(null)
    setSavedWord({ itemIds: entry.itemIds, term, range: entry.range, anchor: rangeAnchor(entry.range) })
  }

  // Os itens que a marca clicada mostra, na lista viva (remover um tira da lista).
  const savedWordItems = useMemo(() => {
    if (!savedWord) return []
    const wanted = new Set(savedWord.itemIds)
    return marks.items.filter((item) => wanted.has(item.id))
  }, [savedWord, marks.items])
  useEffect(() => {
    if (savedWord && savedWordItems.length === 0) setSavedWord(null)
  }, [savedWord, savedWordItems.length])

  // A palavra clicada com a frase de AGORA, onde o usuário a achou: a frase é achada
  // no texto limpo da página, e o lugar é o do trecho marcado.
  async function savedWordContext(): Promise<{
    term: string
    sentence: string
    page: number
    anchor: PlacementAnchor
    vocabAnchor: VocabularyAnchor
  } | null> {
    if (!savedWord) return null
    const { term, range, anchor } = savedWord
    const page = pageNum
    const vocabAnchor = vocabularyAnchor(page, range, pdfRangeRects(range))
    const occurrence = occurrenceOfRange(range, term)
    const sentence = contextSentenceAt(
      (await getPageCleanText(page, false)).text,
      term,
      book.language ?? '',
      occurrence,
    )
    return { term, sentence, page, anchor, vocabAnchor }
  }

  async function handleSavedWordTranslateHere() {
    const context = await savedWordContext()
    if (!context) return
    setSavedWord(null)
    setHereTranslate({
      text: context.term,
      sentence: context.sentence,
      page: context.page,
      anchor: context.anchor,
      vocabAnchor: context.vocabAnchor,
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
      vocabularyDraft(context.term, context.sentence, context.page, context.vocabAnchor, null),
    )
  }

  // "Find in book": a busca do livro com a palavra preenchida.
  function handleSavedWordFind() {
    if (!savedWord) return
    setSearchQuery(savedWord.term)
    setSearchOpen(true)
    setSavedWord(null)
    searchInputRef.current?.focus()
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
    listenAnchorRef.current = null
    clearPageMarks('listen')
    player.play(source)
  }

  // ─── Clicar em grifo → popover de remoção ─────────────────────────────
  // Os retângulos em .highlightLayer são pointer-events: none para que o
  // arrasto de seleção atravesse os grifos. A detecção de "clique em grifo"
  // é feita aqui, a partir do onClick do .pageWrap: se a seleção do browser
  // está vazia (clique, não arrasto) e o ponto cai dentro de algum rect
  // normalizado, abre o popover de remoção posicionado sobre o rect.
  function findHighlightAtPoint(
    clientX: number,
    clientY: number,
  ): { highlight: BookHighlight; rect: BookHighlightRect } | null {
    const textContainer = textLayerRef.current
    if (!textContainer) return null
    const textRect = textContainer.getBoundingClientRect()
    if (textRect.width === 0 || textRect.height === 0) return null
    const nx = (clientX - textRect.left) / textRect.width
    const ny = (clientY - textRect.top) / textRect.height
    // Itera do fim para o início: os highlights renderizados por último no
    // .highlightLayer ficam no topo do stack visual (último irmão = maior
    // z-order), então devem ser checados primeiro para que grifos sobrepostos
    // removam o que o usuário realmente vê/clica.
    for (let i = pageHighlights.length - 1; i >= 0; i--) {
      const h = pageHighlights[i]
      for (const r of h.rects) {
        if (
          nx >= r.x &&
          nx <= r.x + r.w &&
          ny >= r.y &&
          ny <= r.y + r.h
        ) {
          return { highlight: h, rect: r }
        }
      }
    }
    return null
  }

  function handlePageClick(e: React.MouseEvent) {
    const sel = window.getSelection()
    const selectedText = sel?.toString().trim() ?? ''
    if (selectedText) return // arrasto de seleção — não abrir popover
    const wrap = pageWrapRef.current
    const textContainer = textLayerRef.current
    if (!wrap || !textContainer) return
    // O clique num popover ou no player (portal, que borbulha até aqui pela árvore
    // do React) não é um clique na página: nem grifo por baixo, nem palavra marcada.
    if (!wrap.contains(e.target as Node)) return
    const hit = findHighlightAtPoint(e.clientX, e.clientY)
    if (!hit) {
      // Fora de um grifo (o grifo tem prioridade): uma palavra ou frase guardada
      // abre o "onde você guardou".
      if (marksEnabled) {
        const entry = markEntryAtPoint(markEntriesRef.current, e.clientX, e.clientY)
        if (entry) openSavedWord(entry)
      }
      return
    }
    const wrapRect = wrap.getBoundingClientRect()
    const textRect = textContainer.getBoundingClientRect()
    const anchor: PagePoint = {
      x: textRect.left - wrapRect.left + hit.rect.x * textRect.width,
      y: textRect.top - wrapRect.top + hit.rect.y * textRect.height,
      w: hit.rect.w * textRect.width,
      h: hit.rect.h * textRect.height,
    }
    setRemovalCandidate({ highlight: hit.highlight, anchor })
    setSelection(null)
  }

  async function handleConfirmRemove(h: BookHighlight) {
    const ok = await confirm(
      'Delete this highlight? The text in the PDF is not affected.',
      {
        title: 'Delete highlight',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
      },
    )
    if (!ok) return
    setRemovalCandidate(null)
    window.getSelection()?.removeAllRanges()
    await removeHighlight(h.id)
  }

  // Remoção de grifo a partir do painel lateral. Reaproveita o mesmo
  // `removeHighlight` do popover na página e o mesmo `useConfirm` para a
  // confirmação destrutiva (paridade de UX). O `e.stopPropagation` no
  // botão de lixeira garante que o `onClick` do item (que navega até a
  // página) NÃO dispara ao deletar.
  async function handleDeleteFromPanel(
    e: React.MouseEvent,
    h: BookHighlight,
  ) {
    e.stopPropagation()
    const ok = await confirm('Delete this highlight? The text in the PDF is not affected.', {
      title: 'Delete highlight',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await removeHighlight(h.id)
  }

  // ─── Posicionamento da toolbar e popover ──────────────────────────────
  // Toolbar de seleção: acima da seleção, ou abaixo quando não cabe, e sempre
  // dentro da parte visível da área da página. Medida depois de montada e
  // antes da pintura; as coordenadas são as do .pageWrap.
  useLayoutEffect(() => {
    const el = toolbarRef.current
    const wrap = pageWrapRef.current
    const area = pageAreaRef.current
    if (!selection || !el || !wrap || !area) return
    const wrapRect = wrap.getBoundingClientRect()
    const areaRect = area.getBoundingClientRect()
    const { left, top } = placeSelectionToolbar(
      selection.anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      {
        left: areaRect.left - wrapRect.left,
        top: areaRect.top - wrapRect.top,
        right: areaRect.left + area.clientWidth - wrapRect.left,
        bottom: areaRect.top + area.clientHeight - wrapRect.top,
      },
    )
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    // A barra é remontada quando o Translate fecha, e ganha a linha de língua
    // quando as ferramentas ligam: mede de novo nos dois casos.
  }, [selection, translateOpen, toolsOn])

  function popoverStyle(): React.CSSProperties {
    if (!removalCandidate) return { display: 'none' }
    const { anchor } = removalCandidate
    return {
      left: `${Math.max(8, anchor.x)}px`,
      top: `${Math.max(8, anchor.y + anchor.h + 8)}px`,
    }
  }

  // A aba Vocabulary só existe com as ferramentas de língua (e com elas a coluna
  // é mais larga): sem elas, a aba aberta volta ao sumário.
  const activeSideTab: SidePanelTab =
    sidePanelTab === 'vocabulary' && !toolsOn ? 'summary' : sidePanelTab
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
        {confirmModal}
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
            onClick={() => goToPage(pageNum - 1)}
            disabled={!doc || pageNum <= 1}
            aria-label="Previous page"
            title="Previous page"
          >
            <CaretLeft size={14} aria-hidden />
          </button>
          <input
            className={styles.pageInput}
            type="number"
            min={1}
            max={doc?.numPages ?? 1}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPageInput()
            }}
            aria-label="Go to page"
          />
          <span className={styles.pageIndicator}>
            {doc ? `Page ${pageNum} of ${doc.numPages}` : 'Loading…'}
          </span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => goToPage(pageNum + 1)}
            disabled={!doc || pageNum >= (doc?.numPages ?? 1)}
            aria-label="Next page"
            title="Next page"
          >
            <CaretRight size={14} aria-hidden />
          </button>
        </div>

        {!searchOpen ? (
          <button
            type="button"
            className={styles.highlightsToggle}
            onClick={() => setSearchOpen(true)}
            aria-label="Search in book"
            title="Search in book (Ctrl+F)"
          >
            <MagnifyingGlass size={14} aria-hidden />
            Search
          </button>
        ) : (
          <div className={styles.searchBar}>
            <input
              ref={searchInputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search in book…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.shiftKey) goToPreviousMatch()
                  else goToNextMatch()
                } else if (e.key === 'Escape') {
                  setSearchOpen(false)
                }
              }}
              aria-label="Search query"
              autoFocus
            />
            <span className={styles.searchCount}>
              {!normalizedQuery
                ? ''
                : flatMatches.length === 0
                  ? searchIndexReady
                    ? 'No results'
                    : 'Searching…'
                  : activeMatchIndex < 0
                    ? `${flatMatches.length} result${flatMatches.length === 1 ? '' : 's'}`
                    : `${activeMatchIndex + 1} of ${flatMatches.length}`}
            </span>
            <button
              type="button"
              className={`${styles.navButton} ${styles.navButtonIcon}`}
              onClick={goToPreviousMatch}
              disabled={flatMatches.length === 0}
              aria-label="Previous match"
            >
              <CaretUp size={12} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${styles.navButtonIcon}`}
              onClick={goToNextMatch}
              disabled={flatMatches.length === 0}
              aria-label="Next match"
            >
              <CaretDown size={12} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${styles.navButtonIcon}`}
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        )}

        {toolsOn && (
          <button
            type="button"
            className={`${styles.highlightsToggle} ${mincerRecording ? styles.listenRecording : ''}`}
            onClick={(e) => {
              // Sem o foco no botão, o Espaço do player não o aciona de novo.
              e.currentTarget.blur()
              void handleListenPage()
            }}
            disabled={!doc || pageHasNoText}
            aria-label="Listen to page"
            title={mincerRecording ? 'Mincer is recording' : 'Listen to the page (L)'}
          >
            <SpeakerHigh size={14} aria-hidden />
            Listen to page
          </button>
        )}

        {jumpBackPage !== null && (
          <button
            type="button"
            className={styles.jumpBackButton}
            onClick={() => goToPage(jumpBackPage)}
            title={`Back to page ${jumpBackPage}`}
          >
            <ArrowUUpLeft size={13} aria-hidden />
            Back to p. {jumpBackPage}
          </button>
        )}

        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => zoomBy(-SCALE_STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <MagnifyingGlassMinus size={14} aria-hidden />
          </button>
          <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => zoomBy(SCALE_STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <MagnifyingGlassPlus size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={`${styles.fitButton} ${fitMode === 'width' ? styles.fitButtonActive : ''}`}
            onClick={() => chooseFitMode('width')}
            aria-pressed={fitMode === 'width'}
            title="Zoom to the width of the reading area"
          >
            Fit width
          </button>
          <button
            type="button"
            className={`${styles.fitButton} ${fitMode === 'page' ? styles.fitButtonActive : ''}`}
            onClick={() => chooseFitMode('page')}
            aria-pressed={fitMode === 'page'}
            title="Zoom to show the whole page"
          >
            Fit page
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

      {doc && pageHasNoText && (
        <p className={styles.noTextBanner} role="status">
          This page has no selectable text (scanned PDF). Highlights, search
          {toolsOn ? ', translation, audio' : ''} and page context for the AI don&apos;t
          work here.
        </p>
      )}

      <div className={styles.readerBody}>
        <aside
          className={`${styles.sidePanel} ${
            sidePanelCollapsed ? styles.sidePanelCollapsed : ''
          }`}
          style={{
            width: sidePanelCollapsed ? SIDE_PANEL_COLLAPSED_WIDTH : sidePanelWidth,
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
                  setSidePanelTab('summary')
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
                  <span className={styles.sidePanelRailBadge}>{highlights.length}</span>
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
                    activeSideTab === 'summary' ? styles.sidePanelTabActive : ''
                  }`}
                  onClick={() => setSidePanelTab('summary')}
                >
                  Contents
                </button>
                <button
                  type="button"
                  className={`${styles.sidePanelTab} ${
                    activeSideTab === 'highlights' ? styles.sidePanelTabActive : ''
                  }`}
                  onClick={() => setSidePanelTab('highlights')}
                >
                  Highlights
                  {highlights.length > 0 && (
                    <span className={styles.sidePanelTabBadge}>{highlights.length}</span>
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

              {activeSideTab === 'summary' ? (
                <div className={styles.summaryPanel}>
                  {outline === undefined ? (
                    <p className={styles.highlightsPanelEmpty}>Loading…</p>
                  ) : outline === null || outline.length === 0 ? (
                    <p className={styles.highlightsPanelEmpty}>
                      This PDF has no table of contents.
                    </p>
                  ) : (
                    <OutlineList items={outline} depth={0} onNavigate={jumpToPage} />
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
                      Select text on the page to highlight it.
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
                        <li key={h.id} className={styles.highlightsPanelItemWrap}>
                          <button
                            type="button"
                            className={styles.highlightsPanelItem}
                            onClick={() => {
                              // O painel PERMANECE aberto ao navegar — o
                              // usuário pode clicar em vários grifos sem
                              // precisar reabrir o painel.
                              jumpToPage(h.page)
                            }}
                          >
                            <div className={styles.highlightsPanelItemTop}>
                              <span
                                className={styles.highlightsPanelSwatch}
                                style={{ background: h.color }}
                                aria-hidden="true"
                              />
                              <span className={styles.highlightsPanelPage}>
                                p. {h.page}
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
                                askAiAbout(h.text, h.page)
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
                                addQuoteToNote(
                                  h.text,
                                  h.page,
                                  pdfPositionLabel(h.page),
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
                          onClick={() => setColorFilter((prev) => (prev === c ? null : c))}
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
          {loading ? (
            <p className={styles.loadingText}>Loading book…</p>
          ) : (
            <div
              className={styles.pageWrap}
              ref={pageWrapRef}
              onMouseUp={handleTextMouseUp}
              onClick={handlePageClick}
            >
              <canvas ref={canvasRef} className={styles.canvas} />
              <div
                ref={highlightLayerRef}
                className={styles.highlightLayer}
                aria-hidden="true"
              >
                {pageHighlights.flatMap((h) =>
                  h.rects.map((r, i) => (
                    <div
                      key={`${h.id}-${i}`}
                      className={styles.highlightRect}
                      style={{
                        left: `${r.x * 100}%`,
                        top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`,
                        height: `${r.h * 100}%`,
                        background: h.color,
                        opacity: HIGHLIGHT_OPACITY,
                      }}
                      title={truncateText(h.text, 120)}
                    />
                  )),
                )}
              </div>
              <div className={styles.searchMatchLayer} aria-hidden="true">
                {searchOpen &&
                  normalizedQuery &&
                  pageMatchRects.map((rects, occIdx) => {
                    const isActive =
                      currentMatch?.page === pageNum && currentMatch.occurrenceIndexOnPage === occIdx
                    return rects.map((r, i) => (
                      <div
                        key={`match-${occIdx}-${i}`}
                        data-match-active={isActive ? 'true' : undefined}
                        className={`${styles.searchMatchRect} ${isActive ? styles.searchMatchRectActive : ''}`}
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                          width: `${r.w * 100}%`,
                          height: `${r.h * 100}%`,
                        }}
                      />
                    ))
                  })}
              </div>
              <div ref={textLayerRef} className={styles.textLayer} />
              {player.open && (
                // Margem de rolagem embaixo da página, para a última linha subir acima
                // do mini-player. Absoluto e fora do fluxo: não muda o tamanho da área
                // (base do "Fit page") nem a posição da página.
                <div
                  className={styles.playerSpacer}
                  style={{ height: playerHeight + 32 }}
                  aria-hidden="true"
                />
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
                    className={
                      toolsOn ? styles.highlightToolbarRow : styles.highlightToolbarContents
                    }
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
                  positionLabel={pdfPositionLabel(translate.page)}
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
                        askAiAbout(
                          removalCandidate.highlight.text,
                          removalCandidate.highlight.page,
                        )
                        setRemovalCandidate(null)
                      }}
                    >
                      <Sparkle size={13} aria-hidden />
                      Ask AI
                    </button>
                    <button
                      type="button"
                      className={styles.removalPopoverQuickButton}
                      onClick={() => {
                        addQuoteToNote(
                          removalCandidate.highlight.text,
                          removalCandidate.highlight.page,
                          pdfPositionLabel(removalCandidate.highlight.page),
                        )
                        setRemovalCandidate(null)
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
                          c === removalCandidate.highlight.color ? styles.highlightSwatchActive : ''
                        }`}
                        style={{ background: c }}
                        onClick={() => handleChangeHighlightColor(removalCandidate.highlight, c)}
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
          )}
          {doc && (
            <>
              <button
                type="button"
                className={`${styles.floatingNavButton} ${styles.floatingNavButtonLeft}`}
                onClick={() => goToPage(pageNum - 1)}
                disabled={pageNum <= 1}
                aria-label="Previous page"
              >
                <CaretLeft size={18} aria-hidden />
              </button>
              <button
                type="button"
                className={`${styles.floatingNavButton} ${styles.floatingNavButtonRight}`}
                onClick={() => goToPage(pageNum + 1)}
                disabled={pageNum >= doc.numPages}
                aria-label="Next page"
              >
                <CaretRight size={18} aria-hidden />
              </button>
            </>
          )}
          {player.open && columnBox && (
            <MiniPlayer
              player={player}
              column={columnBox}
              models={catalog.models}
              modelsLoading={catalog.loading}
              bookId={book.id}
              language={book.language ?? ''}
              onBackToPage={goToPage}
              onOpenSettingsSection={onOpenSettingsSection}
              onHeightChange={setPlayerHeight}
            />
          )}
        </div>

        {/* SEMPRE montados (fora do ternário de loading): fechar o toggle só
            esconde via CSS — desmontar o ReaderChatPanel cancelaria o
            useChat e um stream ativo, e desmontar o ReaderNotesPanel
            perderia o estado de seleção Notebook/Nota da aba. Abrir/fechar
            também não recarrega o PDF (o effect de render depende só de
            doc/pageNum/scale). */}
        <ReaderChatPanel
          book={book}
          pageNum={pageNum}
          totalPages={doc?.numPages ?? book.totalPages}
          highlights={highlights}
          getPageText={getPageText}
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
            askAiAbout(item.text, item.page)
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
          onFind={handleSavedWordFind}
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
          positionLabel={pdfPositionLabel(hereTranslate.page)}
          sourceLanguage={book.language ?? ''}
          targetLanguage={languageSettings.nativeLanguage}
          model={languageSettings.translateModel}
          onListen={speakOnce}
          onAddToVocabulary={(t) => {
            const here = hereTranslate
            setHereTranslate(null)
            void saveToVocabulary(vocabularyDraft(here.text, here.sentence, here.page, here.vocabAnchor, t))
          }}
          onAddToNote={() => {
            const here = hereTranslate
            setHereTranslate(null)
            addQuoteToNote(here.text, here.page, pdfPositionLabel(here.page))
          }}
          onAskAi={() => {
            const here = hereTranslate
            setHereTranslate(null)
            askAiAbout(here.text, here.page)
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
