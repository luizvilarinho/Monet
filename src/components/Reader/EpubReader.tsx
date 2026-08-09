import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUUpLeft,
  CaretLeft,
  CaretRight,
  Highlighter,
  ListBullets,
  Quotes,
  SidebarSimple,
  Sparkle,
} from '@phosphor-icons/react'
import type {
  Book,
  BookHighlight,
  EpubBook,
  Note,
  Notebook,
} from '../../types'
import { storage } from '../../storage'
import { booksReadFile } from '../../lib/books'
import {
  clearEpubSelection,
  displayEpubAt,
  drawEpubHighlight,
  ensureEpubLocations,
  epubCfiPercentage,
  epubHighlightScreenRect,
  epubLocationOrdinal,
  getEpubLocationText,
  loadEpubToc,
  onEpubHighlightClick,
  onEpubSelection,
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
import { useConfirm } from '../../hooks/useConfirm'
import { useHighlights } from '../../hooks/useHighlights'
import { QuoteToNoteModal } from './QuoteToNoteModal'
import { ReaderChatPanel } from './ReaderChatPanel'
import { ReaderNotesPanel } from './ReaderNotesPanel'
import styles from './EpubReader.module.css'

export interface EpubReaderProps {
  // Este é o leitor de EPUB: o tipo impede que um PDF chegue aqui por engano.
  book: EpubBook
  onBack: () => void
  onBookChange: (book: Book) => void
  // Chamado quando o documento não pôde ser carregado (arquivo ausente/ilegível).
  onLoadError?: () => void
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (
    notebookId: string,
    title: string,
    content: string,
  ) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
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
const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0]

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

type SidePanelTab = 'contents' | 'highlights'
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
  onLoadError,
  notebooks,
  notes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
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

  const {
    highlights,
    orderedHighlights,
    filteredHighlights,
    colorFilter,
    setColorFilter,
    persistHighlight,
    removeHighlight,
    changeColor,
  } = useHighlights(book.id)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_HIGHLIGHT_COLOR)
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
  const {
    copyCitationAbout,
    modal: quoteModal,
    toast: saveToast,
  } = useBookQuotes({
    bookId: book.id,
    bookTitle: book.title,
    notes,
    notebooks,
    onSaveNote,
  })
  const { confirm, modal: confirmModal } = useConfirm()

  const viewerRef = useRef<HTMLDivElement>(null)
  const pageAreaRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
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

  // ─── Navegação ──────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    void renditionRef.current?.next().catch(() => {})
  }, [])

  const goPrevious = useCallback(() => {
    void renditionRef.current?.prev().catch(() => {})
  }, [])

  const handleArrowKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'ArrowLeft') goPrevious()
      else if (e.key === 'ArrowRight') goNext()
    },
    [goNext, goPrevious],
  )
  // O listener dentro do iframe é registrado uma vez, na carga; a ref mantém
  // o handler atual sem precisar reregistrar.
  const handleArrowKeyRef = useRef(handleArrowKey)
  handleArrowKeyRef.current = handleArrowKey

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      handleArrowKeyRef.current(e)
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
          schedulePositionSave(start.cfi, page)
        })
        // O texto do livro vive num iframe: sem isto, as setas param de
        // funcionar assim que o foco entra nele.
        rendition.on('keydown', handleArrowKeyRef.current)

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
      setSelection(null)
      setRemovalCandidate(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function clearIframeSelection() {
    const rendition = renditionRef.current
    if (rendition) clearEpubSelection(rendition)
  }

  // Navegação "de citação" (item do sumário ou grifo do painel): marca a
  // posição atual como ponto de retorno antes de saltar. ‹›/setas não mexem
  // no marcador — paridade com o `jumpToPage` do leitor de PDF.
  function jumpToCfi(target: string) {
    const rendition = renditionRef.current
    if (!rendition) return
    const current = currentCfiRef.current
    if (current && current !== target) {
      setJumpBack({ cfi: current, percent })
    }
    void displayEpubAt(rendition, target).catch((err) => {
      console.error('failed to navigate', err)
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

  function handleCopyCitation() {
    if (!selection) return
    const { text, cfiRange } = selection
    const page = pageOfCfi(cfiRange)
    setSelection(null)
    clearIframeSelection()
    void citationLabelFor(cfiRange).then((label) =>
      copyCitationAbout(text, page, label),
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

  // ─── Popover do grifo ──────────────────────────────────────────────────
  // Trocar a cor fecha o popover antes de qualquer coisa; o efeito de
  // sincronização redesenha a marca com a cor nova.
  function handleChangeHighlightColor(h: BookHighlight, color: string) {
    setRemovalCandidate(null)
    changeColor(h, color)
  }

  async function handleConfirmRemove(h: BookHighlight) {
    const ok = await confirm(
      'Remove this highlight? The text in the book is not affected.',
      { title: 'Remove highlight', confirmLabel: 'Remove', cancelLabel: 'Cancel' },
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
    const ok = await confirm('Delete this highlight?', {
      title: 'Delete highlight',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
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
  // A fatia da location corrente (~1600 chars), nunca o item de spine
  // inteiro — ver getEpubLocationText em lib/epub.ts.
  const getPageText = useCallback(
    async (n: number): Promise<string | null> => {
      const handle = bookHandleRef.current
      if (!handle) return null
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
  // Mesmas regras do leitor de PDF: toolbar acima da seleção, popover abaixo
  // da marca — os anchors já vêm traduzidos para coordenadas da .pageArea.
  function toolbarStyle(): React.CSSProperties {
    if (!selection) return { display: 'none' }
    const { anchor } = selection
    return {
      left: `${Math.max(8, anchor.x)}px`,
      top: `${Math.max(8, anchor.y - 40)}px`,
    }
  }

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

  if (error) {
    return (
      <div className={styles.reader}>
        <div className={styles.errorState}>
          <p className={styles.errorMessage}>{error}</p>
          <button type="button" className={styles.primary} onClick={onBack}>
            Back to Library
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.reader}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Library
        </button>

        <div className={styles.pageControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={goPrevious}
            disabled={loading || atStart}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className={styles.pageIndicator}>
            {loading ? 'Loading…' : `${percent}%`}
          </span>
          <button
            type="button"
            className={styles.navButton}
            onClick={goNext}
            disabled={loading || atEnd}
            aria-label="Next page"
          >
            ›
          </button>
        </div>

        <div className={styles.fontControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeFontScale(fontScale - FONT_SCALE_STEP)}
            disabled={fontScale <= MIN_FONT_SCALE}
            aria-label="Decrease text size"
          >
            −
          </button>
          <span className={styles.fontLabel}>{fontSizeCss(fontScale)}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeFontScale(fontScale + FONT_SCALE_STEP)}
            disabled={fontScale >= MAX_FONT_SCALE}
            aria-label="Increase text size"
          >
            +
          </button>
        </div>

        <div className={styles.fontControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeMargin(marginPx - MARGIN_STEP_PX)}
            disabled={marginPx <= MIN_MARGIN_PX}
            aria-label="Decrease margin"
          >
            −
          </button>
          <span className={styles.fontLabel}>{marginPx}px</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeMargin(marginPx + MARGIN_STEP_PX)}
            disabled={marginPx >= MAX_MARGIN_PX}
            aria-label="Increase margin"
          >
            +
          </button>
        </div>

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
              : SIDE_PANEL_WIDTH,
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
            </div>
          ) : (
            <>
              <div className={styles.sidePanelTabs}>
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
                    sidePanelTab === 'contents' ? styles.sidePanelTabActive : ''
                  }`}
                  onClick={() => setSidePanelTab('contents')}
                >
                  Contents
                </button>
                <button
                  type="button"
                  className={`${styles.sidePanelTab} ${
                    sidePanelTab === 'highlights'
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
              </div>

              {sidePanelTab === 'contents' ? (
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
              ) : (
                <>
                  {orderedHighlights.length === 0 ? (
                    <p className={styles.highlightsPanelEmpty}>
                      No highlights yet
                    </p>
                  ) : filteredHighlights.length === 0 ? (
                    <p className={styles.highlightsPanelEmpty}>
                      No highlights match this color
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
                                  copyCitationAbout(h.text, h.page, label),
                                )
                              }}
                              aria-label="Copy citation"
                              title="Copy citation"
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
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 4h10" />
                                <path d="M5.5 4V2.5h5V4" />
                                <path d="M4.5 4l.6 9a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-9" />
                                <path d="M7 7v5" />
                                <path d="M9 7v5" />
                              </svg>
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
          {selection && (
            <div
              ref={toolbarRef}
              className={styles.highlightToolbar}
              style={toolbarStyle()}
              onMouseDown={(e) => e.stopPropagation()}
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
                    setActiveColor(c)
                    void handleHighlight(c)
                  }}
                  aria-label={`Highlight with ${c}`}
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
                onClick={handleCopyCitation}
              >
                Copy citation
              </button>
              <button
                type="button"
                className={styles.highlightToolbarButton}
                onClick={handleAskAi}
              >
                Ask AI
              </button>
            </div>
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
                      copyCitationAbout(h.text, h.page, label),
                    )
                  }}
                >
                  <Quotes size={13} aria-hidden />
                  Copy citation
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
                  Remove
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
          open={sideOpen && sideTab === 'chat'}
          onClose={() => setSideOpen(false)}
          pendingQuote={pendingQuote}
          onPendingQuoteConsumed={() => setPendingQuote(null)}
        />
        <ReaderNotesPanel
          book={book}
          notebooks={notebooks}
          notes={notes}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          open={sideOpen && sideTab === 'notes'}
          onClose={() => setSideOpen(false)}
        />
      </div>

      {quoteModal && (
        <QuoteToNoteModal
          open={quoteModal.open}
          notebooks={notebooks}
          notes={notes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          quoteText={quoteModal.quoteText}
          bookTitle={book.title}
          page={quoteModal.page}
          positionLabel={quoteModal.positionLabel}
          bookId={book.id}
          onSaved={quoteModal.onSaved}
          onClose={quoteModal.onClose}
        />
      )}

      {saveToast && (
        <div className={styles.saveToast} role="status">
          {saveToast}
        </div>
      )}

      {confirmModal}
    </div>
  )
}
