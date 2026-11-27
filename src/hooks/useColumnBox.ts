import { useLayoutEffect, useState, type RefObject } from 'react'

// Onde fica a coluna da página, em coordenadas da janela: o mini-player é
// `position: fixed` (um filho absoluto da área que rola andaria com a rolagem) e
// se centra nela.
export interface ColumnBox {
  centerX: number
  // Distância da base da área até a base da janela.
  bottom: number
  // Largura útil da área, sem a barra de rolagem.
  width: number
}

// Mede a área enquanto `active` (o player aberto): na criação, ao mudar de
// tamanho (colunas laterais, janela) e ao redimensionar a janela.
export function useColumnBox(ref: RefObject<HTMLElement | null>, active: boolean): ColumnBox | null {
  const [box, setBox] = useState<ColumnBox | null>(null)
  useLayoutEffect(() => {
    const area = ref.current
    if (!active || !area) {
      setBox(null)
      return
    }
    const measure = () => {
      const rect = area.getBoundingClientRect()
      const next = {
        centerX: Math.round(rect.left + area.clientWidth / 2),
        bottom: Math.round(window.innerHeight - rect.bottom),
        width: area.clientWidth,
      }
      setBox((prev) =>
        prev && prev.centerX === next.centerX && prev.bottom === next.bottom && prev.width === next.width
          ? prev
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(area)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, active])
  return box
}
