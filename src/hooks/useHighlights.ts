import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookHighlight } from '../types'
import { storage } from '../storage'

// Última cor usada para grifar, comum aos dois leitores (o atalho `H` grifa
// com ela).
const LAST_COLOR_KEY = 'monet:reader-highlight-color'

export function loadHighlightColor(palette: string[]): string {
  try {
    const saved = localStorage.getItem(LAST_COLOR_KEY)
    if (saved && palette.includes(saved)) return saved
  } catch {
    /* ignore */
  }
  return palette[0]
}

export function saveHighlightColor(color: string): void {
  try {
    localStorage.setItem(LAST_COLOR_KEY, color)
  } catch (err) {
    console.error('failed to persist highlight color', err)
  }
}

// Busca nos grifos sem caixa e sem acento.
function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// CRUD de grifos de um livro. Reaproveitável entre formatos: nada aqui olha
// para `rects` nem para a página renderizada — o posicionamento visual do
// grifo continua sendo responsabilidade de cada leitor.
//
// O contrato que este hook assume é que `page` é um ordinal de leitura
// crescente (1..N): é por ele que `orderedHighlights` ordena. No PDF é o
// número da página; no EPUB será o índice de location. Se esse contrato
// mudar, o comparador muda junto.
//
// Gravar e apagar são otimistas: na falha, o estado volta ao que era e
// `onError` recebe a mensagem para o usuário.
export function useHighlights(bookId: string, onError?: (message: string) => void) {
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [textFilter, setTextFilter] = useState('')
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // Carga dos grifos ao abrir; limpa ao trocar de livro (id diferente não
  // ocorre no leitor de PDF — ele é desmontado/remontado pelo Library — mas a
  // limpeza protege contra casos de borda como React.StrictMode em dev).
  useEffect(() => {
    let cancelled = false
    setHighlights([])
    setColorFilter(null)
    setTextFilter('')
    void storage
      .getHighlights(bookId)
      .then((list) => {
        if (!cancelled) setHighlights(list)
      })
      .catch((err) => console.error('failed to load highlights', err))
    return () => {
      cancelled = true
    }
  }, [bookId])

  const persistHighlight = useCallback(async (h: BookHighlight) => {
    const previous = highlightsRef.current.find((x) => x.id === h.id)
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
      // Grifo novo sai da tela; troca de cor volta à cor anterior.
      setHighlights((prev) =>
        previous
          ? prev.map((x) => (x.id === h.id ? previous : x))
          : prev.filter((x) => x.id !== h.id),
      )
      onErrorRef.current?.("Couldn't save this highlight. Try again.")
    }
  }, [])

  const removeHighlight = useCallback(async (id: string) => {
    const removed = highlightsRef.current.find((h) => h.id === id)
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    try {
      await storage.deleteHighlight(id)
    } catch (err) {
      console.error('failed to delete highlight', err)
      if (removed) {
        setHighlights((prev) => (prev.some((h) => h.id === id) ? prev : [...prev, removed]))
      }
      onErrorRef.current?.("Couldn't delete this highlight. Try again.")
    }
  }, [])

  const changeColor = useCallback(
    (h: BookHighlight, color: string) => {
      if (color === h.color) return
      void persistHighlight({ ...h, color })
    },
    [persistHighlight],
  )

  const orderedHighlights = useMemo(() => {
    // Ordem fixa: página asc, depois mais recente primeiro dentro da página.
    return [...highlights].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page
      return b.createdAt - a.createdAt
    })
  }, [highlights])

  const filteredHighlights = useMemo(() => {
    const query = foldText(textFilter.trim())
    return orderedHighlights.filter(
      (h) =>
        (!colorFilter || h.color === colorFilter) &&
        (!query || foldText(h.text).includes(query)),
    )
  }, [orderedHighlights, colorFilter, textFilter])

  return {
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
  }
}
