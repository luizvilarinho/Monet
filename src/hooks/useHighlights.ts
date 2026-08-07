import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BookHighlight } from '../types'
import { storage } from '../storage'

// CRUD de grifos de um livro. Reaproveitável entre formatos: nada aqui olha
// para `rects` nem para a página renderizada — o posicionamento visual do
// grifo continua sendo responsabilidade de cada leitor.
//
// O contrato que este hook assume é que `page` é um ordinal de leitura
// crescente (1..N): é por ele que `orderedHighlights` ordena. No PDF é o
// número da página; no EPUB será o índice de location. Se esse contrato
// mudar, o comparador muda junto.
export function useHighlights(bookId: string) {
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [colorFilter, setColorFilter] = useState<string | null>(null)

  // Carga dos grifos ao abrir; limpa ao trocar de livro (id diferente não
  // ocorre no leitor de PDF — ele é desmontado/remontado pelo Library — mas a
  // limpeza protege contra casos de borda como React.StrictMode em dev).
  useEffect(() => {
    let cancelled = false
    setHighlights([])
    setColorFilter(null)
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
  }, [])

  const removeHighlight = useCallback(async (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    try {
      await storage.deleteHighlight(id)
    } catch (err) {
      console.error('failed to delete highlight', err)
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

  const filteredHighlights = useMemo(
    () => (colorFilter ? orderedHighlights.filter((h) => h.color === colorFilter) : orderedHighlights),
    [orderedHighlights, colorFilter],
  )

  return {
    highlights,
    orderedHighlights,
    filteredHighlights,
    colorFilter,
    setColorFilter,
    persistHighlight,
    removeHighlight,
    changeColor,
  }
}
