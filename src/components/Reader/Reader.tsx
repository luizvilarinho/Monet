import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'
import type {
  Book,
  BookHighlight,
  BookHighlightRect,
  BookQuote,
  Note,
  Notebook,
} from '../../types'
import { storage } from '../../storage'
import { booksReadFile } from '../../lib/books'
import { openPdf, TextLayer, type PDFDocumentProxy } from '../../lib/pdf'
import { useConfirm } from '../../hooks/useConfirm'
import { QuoteToNoteModal } from './QuoteToNoteModal'
import styles from './Reader.module.css'

export interface ReaderProps {
  book: Book
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
  onNavigateToNote: (notebookId: string, noteId: string) => void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25
const SAVE_DEBOUNCE_MS = 500
const HIGHLIGHT_OPACITY = 0.35

const HIGHLIGHT_COLORS = ['#FFEB3B', '#A5D6A7', '#90CAF9', '#F48FB1']
const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0]
const SAVE_TOAST_MS = 2500

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

interface CaretPoint {
  node: Node
  offset: number
}

function getCaretFromPoint(x: number, y: number): CaretPoint | null {
  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => {
      offsetNode: Node
      offset: number
    } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof docAny.caretPositionFromPoint === 'function') {
    const pos = docAny.caretPositionFromPoint(x, y)
    if (pos) return { node: pos.offsetNode, offset: pos.offset }
  } else if (typeof docAny.caretRangeFromPoint === 'function') {
    const range = docAny.caretRangeFromPoint(x, y)
    if (range) return { node: range.startContainer, offset: range.startOffset }
  }
  return null
}

export function Reader({
  book,
  onBack,
  onBookChange,
  onLoadError,
  notebooks,
  notes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
}: ReaderProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(book.lastPage)
  // Inicializa o zoom a partir do livro persistido. O Reader é remontado
  // pelo Library a cada troca de livro, então `book.zoom` reflete o valor
  // atual do storage. Livros antigos (sem coluna `zoom`) caem no default
  // 1.0 (clamp aplicado no `rowToBook` do storage).
  const [scale, setScale] = useState(() => clampScale(book.zoom))
  const [pageInput, setPageInput] = useState(String(book.lastPage))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_HIGHLIGHT_COLOR)
  const [removalCandidate, setRemovalCandidate] = useState<RemovalCandidate | null>(
    null,
  )
  const [highlightsPanelOpen, setHighlightsPanelOpen] = useState(false)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteContext, setQuoteContext] = useState<{ text: string } | null>(null)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const highlightLayerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
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
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError
  const notebooksRef = useRef(notebooks)
  notebooksRef.current = notebooks
  const notesRef = useRef(notes)
  notesRef.current = notes

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

  // Carga de grifos do livro ao abrir; limpa ao trocar de livro (id diferente
  // não ocorre aqui — o Reader é desmontado/remontado pelo Library — mas a
  // limpeza protege contra casos de borda como React.StrictMode em dev).
  useEffect(() => {
    let cancelled = false
    setHighlights([])
    setSelection(null)
    setRemovalCandidate(null)
    void storage
      .getHighlights(book.id)
      .then((list) => {
        if (!cancelled) setHighlights(list)
      })
      .catch((err) => console.error('failed to load highlights', err))
    return () => {
      cancelled = true
    }
  }, [book.id])

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

  const goToPage = useCallback(
    (page: number) => {
      if (!doc) return
      setPageNum(clampPage(page, doc.numPages))
    },
    [doc],
  )

  // Fechar toolbar/popover em troca de página, zoom, resize.
  useEffect(() => {
    setSelection(null)
    setRemovalCandidate(null)
  }, [pageNum, scale])

  useEffect(() => {
    function onResize() {
      setSelection(null)
      setRemovalCandidate(null)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Atalhos ←/→ (ignorando inputs/textarea/contenteditable).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'ArrowLeft') {
        setPageNum((p) => Math.max(1, p - 1))
      } else if (e.key === 'ArrowRight' && doc) {
        setPageNum((p) => Math.min(doc.numPages, p + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc])

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

  const orderedHighlights = useMemo(() => {
    // Ordem fixa: página asc, depois mais recente primeiro dentro da página.
    return [...highlights].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page
      return b.createdAt - a.createdAt
    })
  }, [highlights])

  // ─── Helpers de persistência de grifos ─────────────────────────────────
  async function persistHighlight(h: BookHighlight) {
    setHighlights((prev) => {
      const i = prev.findIndex((x) => x.id === h.id)
      if (i >= 0) {
        const next = prev.slice()
        next[i] = h
        return next
      }
      return [...prev, h]
    })
    try {
      await storage.saveHighlight(h)
    } catch (err) {
      console.error('failed to save highlight', err)
    }
  }

  async function removeHighlight(id: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    try {
      await storage.deleteHighlight(id)
    } catch (err) {
      console.error('failed to delete highlight', err)
    }
  }

  function showSaveToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setSaveToast(message)
    toastTimerRef.current = setTimeout(() => {
      setSaveToast(null)
      toastTimerRef.current = null
    }, SAVE_TOAST_MS)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

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
      if (highlightLayerRef.current && highlightLayerRef.current.contains(target)) return
      setSelection(null)
      setRemovalCandidate(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  // ─── Ações da toolbar ─────────────────────────────────────────────────
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
    try {
      await navigator.clipboard.writeText(selection.text)
    } catch (err) {
      console.error('clipboard write failed', err)
    }
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  function handleCopyCitation() {
    if (!selection) return
    setQuoteContext({ text: selection.text })
    setQuoteModalOpen(true)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
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
    const hit = findHighlightAtPoint(e.clientX, e.clientY)
    if (!hit) return
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
      'Remove this highlight? The text in the PDF is not affected.',
      { title: 'Remove highlight', confirmLabel: 'Remove', cancelLabel: 'Cancel' },
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
    const ok = await confirm('Delete this highlight?', {
      title: 'Delete highlight',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    })
    if (!ok) return
    await removeHighlight(h.id)
  }

  // ─── Citação salva ────────────────────────────────────────────────────
  async function handleSavedQuote(quote: BookQuote) {
    try {
      await storage.saveQuote(quote)
    } catch (err) {
      console.error('failed to save quote', err)
    }
    const note = notesRef.current.find((n) => n.id === quote.targetNoteId)
    const notebookId = note?.notebookId ?? null
    if (notebookId) {
      const notebook = notebooksRef.current.find((x) => x.id === notebookId)
      const noteTitle = note?.title.trim() || 'note'
      const nbName = notebook?.name ?? 'notebook'
      showSaveToast(`Saved to ${nbName} / ${noteTitle}`)
    }
  }

  function handleCloseQuoteModal() {
    setQuoteModalOpen(false)
    setQuoteContext(null)
  }

  // ─── Posicionamento da toolbar e popover ──────────────────────────────
  function toolbarStyle(): React.CSSProperties {
    if (!selection) return { display: 'none' }
    const { anchor } = selection
    // Acima da seleção, alinhado ao canto esquerdo. Se não couber, fica abaixo.
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

  if (error) {
    return (
      <div className={styles.reader}>
        <div className={styles.errorState}>
          <p className={styles.errorMessage}>{error}</p>
          <button type="button" className={styles.primary} onClick={onBack}>
            Back to Library
          </button>
        </div>
        {confirmModal}
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
            onClick={() => goToPage(pageNum - 1)}
            disabled={!doc || pageNum <= 1}
            aria-label="Previous page"
          >
            ‹
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
          >
            ›
          </button>
        </div>

        <button
          type="button"
          className={styles.highlightsToggle}
          onClick={() => setHighlightsPanelOpen((v) => !v)}
          aria-pressed={highlightsPanelOpen}
          aria-label="Toggle highlights panel"
        >
          Highlights
          {highlights.length > 0 && (
            <span className={styles.highlightsToggleBadge}>{highlights.length}</span>
          )}
        </button>

        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.readerBody}>
        <div className={styles.pageArea}>
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
              <div ref={textLayerRef} className={styles.textLayer} />
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
          )}
        </div>

        {highlightsPanelOpen && (
          <aside className={styles.highlightsPanel} aria-label="Book highlights">
            <div className={styles.highlightsPanelHeader}>
              <h3 className={styles.highlightsPanelTitle}>Highlights</h3>
              <button
                type="button"
                className={styles.highlightsPanelClose}
                onClick={() => setHighlightsPanelOpen(false)}
                aria-label="Close highlights panel"
              >
                ×
              </button>
            </div>
            {orderedHighlights.length === 0 ? (
              <p className={styles.highlightsPanelEmpty}>No highlights yet</p>
            ) : (
              <ul className={styles.highlightsPanelList}>
                {orderedHighlights.map((h) => (
                  <li key={h.id} className={styles.highlightsPanelItemWrap}>
                    <button
                      type="button"
                      className={styles.highlightsPanelItem}
                      onClick={() => {
                        // O painel PERMANECE aberto ao navegar — o
                        // usuário pode clicar em vários grifos sem
                        // precisar reabrir o painel. O fechamento
                        // continua sendo responsabilidade do toggle
                        // "Highlights" na toolbar ou do X no header.
                        goToPage(h.page)
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
                    <button
                      type="button"
                      className={styles.highlightsPanelItemDelete}
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
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {quoteContext && quoteModalOpen && (
        <QuoteToNoteModal
          open={quoteModalOpen}
          notebooks={notebooks}
          notes={notes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          quoteText={quoteContext.text}
          bookTitle={book.title}
          page={pageNum}
          bookId={book.id}
          onSaved={handleSavedQuote}
          onClose={handleCloseQuoteModal}
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
