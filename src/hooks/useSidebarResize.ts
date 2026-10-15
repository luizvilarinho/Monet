import { useCallback, useEffect, useRef } from 'react'

const MIN_WIDTH = 160
const MAX_WIDTH = 400
// Com a coluna de cadernos oculta a coluna pode crescer mais, com largura
// própria (a largura normal não é afetada).
export const WIDE_MAX_WIDTH = 640
export const SIDEBAR_WIDTH_KEY = 'monet:sidebar-width'
export const SIDEBAR_WIDE_WIDTH_KEY = 'monet:sidebar-width-wide'

// Arrasto da borda direita da coluna da Sidebar (largura compartilhada por
// Sidebar, CalendarView e TasksView, persistida em localStorage). `wide` =
// cadernos ocultos: teto maior e chave de persistência própria.
export function useSidebarResize(
  width: number,
  onWidthChange?: (w: number) => void,
  wide = false
) {
  const maxWidth = wide ? WIDE_MAX_WIDTH : MAX_WIDTH
  const storageKey = wide ? SIDEBAR_WIDE_WIDTH_KEY : SIDEBAR_WIDTH_KEY
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth.current + delta))
      currentWidthRef.current = next
      onWidthChange?.(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(storageKey, String(currentWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWidthChange, maxWidth, storageKey])

  return onMouseDown
}
