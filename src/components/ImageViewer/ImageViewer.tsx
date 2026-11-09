import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ArrowSquareOut, X } from '@phosphor-icons/react'
import styles from './ImageViewer.module.css'

interface ImageViewerProps {
  src: string
  // Legenda (alt da imagem); vazio = sem legenda.
  alt?: string
  onClose: () => void
}

// Imagem ampliada sobre o app (chat e notas): cabe na tela, fecha com Esc,
// clique fora ou X. Imagem maior que a tela alterna entre caber (Fit) e o
// tamanho real com rolagem (100%), pelo botão ou clicando nela. Imagem da web
// abre também no navegador. `aria-modal` segura os atalhos globais (Alt+←).
function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  const [broken, setBroken] = useState(false)
  const [actualSize, setActualSize] = useState(false)
  // A imagem não cabe na área (Fit reduz): só aí o 100% muda alguma coisa.
  const [scaled, setScaled] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // Foco no X enquanto aberto; ao fechar, volta para quem tinha.
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    // Captura na window: nenhuma tecla chega a quem está por trás (setas do
    // Reader, Ctrl+P, Esc da busca na nota). Só o Esc tem o padrão cortado;
    // Tab e Enter nos botões daqui seguem funcionando.
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [onClose])

  const measure = useCallback(() => {
    const img = imgRef.current
    if (!img || !img.naturalWidth) return
    setScaled(img.naturalWidth > img.clientWidth + 1 || img.naturalHeight > img.clientHeight + 1)
  }, [])

  // Mede de novo ao voltar ao Fit: a janela pode ter mudado no 100%.
  useEffect(() => {
    if (actualSize) return
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [actualSize, measure])

  const isWeb = /^https?:\/\//i.test(src)
  const canToggle = !broken && (scaled || actualSize)

  return createPortal(
    <div
      className={`${styles.backdrop} ${actualSize ? styles.backdropActual : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image'}
      onMouseDown={(e) => {
        // A barra de rolagem do 100% também é o fundo: arrastá-la não fecha.
        const el = e.currentTarget
        const onScrollbar = e.nativeEvent.offsetX >= el.clientWidth || e.nativeEvent.offsetY >= el.clientHeight
        if (e.target === el && !onScrollbar) onClose()
      }}
    >
      <div className={styles.toolbar}>
        {canToggle && (
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setActualSize((v) => !v)}
            title={actualSize ? 'Fit to the window' : 'Show at actual size'}
          >
            {actualSize ? 'Fit' : '100%'}
          </button>
        )}
        {isWeb && (
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => void openUrl(src).catch((err) => console.warn('failed to open image', err))}
          >
            <ArrowSquareOut size={14} aria-hidden />
            Open in browser
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          className={styles.toolButton}
          onClick={onClose}
          aria-label="Close image"
          title="Close (Esc)"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      {broken ? (
        <p className={styles.broken}>This image could not be loaded.</p>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ''}
          className={`${styles.image} ${actualSize ? styles.imageActual : canToggle ? styles.imageZoomable : ''}`}
          onLoad={measure}
          onError={() => setBroken(true)}
          onClick={() => {
            if (canToggle) setActualSize((v) => !v)
          }}
        />
      )}
      {alt && !broken && <p className={styles.caption}>{alt}</p>}
    </div>,
    document.body
  )
}

// Imagem clicada fora de link (o link continua abrindo o endereço).
export function clickedImage(e: ReactMouseEvent | MouseEvent): HTMLImageElement | null {
  const target = e.target instanceof Element ? e.target : null
  const img = target?.closest('img')
  if (!img || img.closest('a') || !img.getAttribute('src')) return null
  return img
}

// Imagem numa nota (editor da main e da keep): o 1º clique seleciona a
// imagem (arrastar, apagar), o clique na imagem JÁ selecionada abre — o duplo
// clique também cai aí. A seleção é lida no mousedown, antes do ProseMirror
// selecionar. Devolve o cleanup.
export function attachNoteImageOpener(dom: HTMLElement, open: (src: string, alt: string) => void): () => void {
  let pressedSelected: HTMLImageElement | null = null
  const onMouseDown = (e: MouseEvent) => {
    // Só o clique simples: com modificador é seleção (Shift/Ctrl) do editor.
    const plain = e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey
    const img = plain ? clickedImage(e) : null
    pressedSelected = img && img.classList.contains('ProseMirror-selectednode') ? img : null
  }
  const onClick = (e: MouseEvent) => {
    const img = clickedImage(e)
    if (!img || img !== pressedSelected || !dom.contains(img)) return
    pressedSelected = null
    e.preventDefault()
    open(img.src, img.alt)
  }
  dom.addEventListener('mousedown', onMouseDown, true)
  dom.addEventListener('click', onClick)
  return () => {
    dom.removeEventListener('mousedown', onMouseDown, true)
    dom.removeEventListener('click', onClick)
  }
}

// Estado do visualizador num componente: `open` com a imagem, `viewer` é o
// elemento a renderizar (null fechado).
export function useImageViewer() {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null)
  const open = useCallback((src: string, alt = '') => setImage({ src, alt }), [])
  const close = useCallback(() => setImage(null), [])
  const viewer = image ? <ImageViewer src={image.src} alt={image.alt} onClose={close} /> : null
  return { open, viewer }
}
