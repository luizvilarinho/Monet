import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'
import type { Book } from '../../types'
import { storage } from '../../storage'
import { booksReadFile } from '../../lib/books'
import { openPdf, TextLayer, type PDFDocumentProxy } from '../../lib/pdf'
import styles from './Reader.module.css'

export interface ReaderProps {
  book: Book
  onBack: () => void
  onBookChange: (book: Book) => void
  // Chamado quando o documento não pôde ser carregado (arquivo ausente/ilegível).
  onLoadError?: () => void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25
const SAVE_DEBOUNCE_MS = 500

function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, page), total)
}

export function Reader({ book, onBack, onBookChange, onLoadError }: ReaderProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(book.lastPage)
  const [scale, setScale] = useState(1)
  const [pageInput, setPageInput] = useState(String(book.lastPage))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const textLayerTaskRef = useRef<TextLayer | null>(null)
  const prevPageRef = useRef<PDFPageProxy | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPageRef = useRef<number | null>(null)

  // Refs para usar os valores atuais dentro de effects de montagem sem
  // reexecutá-los quando o pai propaga um book atualizado (mesmo id).
  const bookRef = useRef(book)
  bookRef.current = book
  const onBookChangeRef = useRef(onBookChange)
  onBookChangeRef.current = onBookChange
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  // Carga do documento (uma vez por livro) + last_opened_at.
  useEffect(() => {
    let cancelled = false
    let loadedDoc: PDFDocumentProxy | null = null

    const opened = { ...bookRef.current, lastOpenedAt: Date.now() }
    // Propaga ANTES do save resolver: um flush de last_page que rode nesse
    // meio-tempo reconstrói o book a partir do prop e não pode partir de um
    // last_opened_at defasado.
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

  // Renderização sob demanda: apenas a página atual (canvas + text layer).
  useEffect(() => {
    if (!doc) return
    let cancelled = false

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
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const task = page.render({
          canvas,
          viewport,
          // Escala física × devicePixelRatio para nitidez em telas HiDPI.
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
        renderTaskRef.current = task
        await task.promise
        renderTaskRef.current = null
        if (cancelled) return

        // Text layer: falha (ex. PDF escaneado, sem texto) é silenciosa —
        // o canvas continua visível.
        textContainer.innerHTML = ''
        textContainer.style.setProperty(
          '--total-scale-factor',
          String(viewport.scale),
        )
        textContainer.style.width = `${Math.floor(viewport.width)}px`
        textContainer.style.height = `${Math.floor(viewport.height)}px`
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
        // Navegação rápida: se o effect foi cancelado durante o render do text
        // layer, não tocar em prevPageRef (senão limparíamos a página atual).
        if (cancelled) return

        // Libera recursos da página anterior (gestão de memória em PDFs grandes).
        if (prevPageRef.current && prevPageRef.current !== page) {
          prevPageRef.current.cleanup()
        }
        prevPageRef.current = page
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
      // Interrompe o streaming de spans da execução antiga — sem isso, ela
      // continuaria despejando texto no container já reutilizado pela nova.
      textLayerTaskRef.current?.cancel()
      textLayerTaskRef.current = null
    }
  }, [doc, pageNum, scale])

  // Persistência de last_page: debounce por troca de página + flush no unmount
  // (salva na troca de página, não só ao sair — cobre fechamento do app).
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
      // Voltou à página já persistida dentro da janela do debounce: descarta
      // o save pendente (senão o flush gravaria a página abandonada).
      pendingPageRef.current = null
      return
    }
    pendingPageRef.current = pageNum
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      flushPendingPage()
    }, SAVE_DEBOUNCE_MS)
  }, [doc, pageNum, flushPendingPage])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      flushPendingPage()
    }
  }, [flushPendingPage])

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
    // Se o clamp mantiver o mesmo pageNum, ressincroniza o input.
    if (doc) setPageInput(String(clampPage(parsed, doc.numPages)))
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

      <div className={styles.pageArea}>
        {loading ? (
          <p className={styles.loadingText}>Loading book…</p>
        ) : (
          <div className={styles.pageWrap}>
            <canvas ref={canvasRef} className={styles.canvas} />
            <div ref={textLayerRef} className={styles.textLayer} />
          </div>
        )}
      </div>
    </div>
  )
}
