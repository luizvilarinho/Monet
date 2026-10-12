import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

// Arrastar cards entre colunas com mouse manual (sem HTML5 DnD). O drag só
// começa após 4px de movimento (abaixo disso é clique). A coluna alvo é o
// ancestral mais próximo com `data-drop-key` sob o cursor; colunas que não
// aceitam drop não têm o atributo. Esc cancela.
const DRAG_THRESHOLD = 4

export function useCardDrag(onDrop: (id: string, dropKey: string) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const onCardMouseDown = useCallback((e: MouseEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('input, button, select, textarea')) return
    const card = e.currentTarget
    const startX = e.clientX
    const startY = e.clientY
    let ghost: HTMLElement | null = null
    let offsetX = 0
    let offsetY = 0
    let dropKey: string | null = null

    function keyAt(x: number, y: number): string | null {
      const el = document.elementFromPoint(x, y)
      return el?.closest('[data-drop-key]')?.getAttribute('data-drop-key') ?? null
    }

    function onMove(ev: globalThis.MouseEvent) {
      if (!ghost) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
        const rect = card.getBoundingClientRect()
        offsetX = startX - rect.left
        offsetY = startY - rect.top
        ghost = card.cloneNode(true) as HTMLElement
        Object.assign(ghost.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          width: `${rect.width}px`,
          pointerEvents: 'none',
          zIndex: '1000',
          opacity: '0.9',
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
        })
        document.body.appendChild(ghost)
        document.body.style.userSelect = 'none'
        setDraggingId(id)
      }
      ghost.style.transform = `translate(${ev.clientX - offsetX}px, ${ev.clientY - offsetY}px)`
      const key = keyAt(ev.clientX, ev.clientY)
      if (key !== dropKey) {
        dropKey = key
        setOverKey(key)
      }
    }

    function onUp() {
      const dragged = ghost !== null
      const key = dropKey
      cleanup()
      if (!dragged) return
      // O click que segue o mouseup não deve abrir o card.
      const swallow = (ev: Event) => ev.stopPropagation()
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
      if (key) onDropRef.current(id, key)
    }

    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') cleanup()
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('keydown', onKey)
      if (ghost) {
        ghost.remove()
        ghost = null
        document.body.style.userSelect = ''
      }
      setDraggingId(null)
      setOverKey(null)
      cleanupRef.current = null
    }

    cleanupRef.current?.()
    cleanupRef.current = cleanup
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('keydown', onKey)
  }, [])

  return { draggingId, overKey, onCardMouseDown }
}
