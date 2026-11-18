import { useLayoutEffect, useRef, type RefObject } from 'react'
import { fitDiagram, renderMermaid, type MermaidResult } from '../../lib/mermaid'
import styles from './MermaidDiagram.module.css'

// Estado do <pre> já tratado: desenho no lugar dele ou erro acima dele.
const DONE_ATTR = 'data-mermaid'

// Texto depois do bloco dentro do contêiner. No streaming, só um bloco com
// texto depois está fechado: uma cerca aberta engole o resto da resposta.
function hasTextAfter(root: HTMLElement, pre: HTMLElement): boolean {
  const range = document.createRange()
  range.setStartAfter(pre)
  range.setEnd(root, root.childNodes.length)
  return range.toString().trim().length > 0
}

function showDiagram(pre: HTMLElement, svg: string) {
  const box = document.createElement('div')
  box.className = styles.diagram
  box.innerHTML = svg
  fitDiagram(box)
  pre.before(box)
  // Escondido, não removido: a posição de cada bloco na lista não muda.
  pre.style.display = 'none'
  pre.setAttribute(DONE_ATTR, 'drawn')
}

function showError(pre: HTMLElement, message: string) {
  const note = document.createElement('div')
  note.className = styles.error
  note.textContent = `Diagram error: ${message}`
  pre.before(note)
  pre.setAttribute(DONE_ATTR, 'error')
}

// Troca cada `<pre><code class="language-mermaid">` de um HTML já renderizado
// (respostas do chat, preview de nota linkada) pelo desenho. Mexe só no DOM do
// contêiner depois que o React grava o innerHTML: o objeto { __html } do
// chamador continua o mesmo e a seleção de texto não se perde.
// `pending` (resposta em streaming): desenha só os blocos já fechados e guarda
// os erros para quando a resposta terminar.
export function useMermaidDiagrams(
  ref: RefObject<HTMLElement | null>,
  html: string,
  pending = false
): void {
  // Desenhos deste contêiner por posição + código. No streaming o innerHTML é
  // regravado a cada pedaço; o desenho pronto volta antes da pintura, sem
  // piscar, e o mesmo bloco não é desenhado duas vezes.
  const results = useRef(new Map<string, Promise<MermaidResult>>())

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !html.includes('language-mermaid')) return
    let cancelled = false
    root.querySelectorAll<HTMLElement>('pre > code.language-mermaid').forEach((codeEl, i) => {
      const pre = codeEl.parentElement
      if (!pre || pre.hasAttribute(DONE_ATTR)) return
      if (pending && !hasTextAfter(root, pre)) return
      const code = codeEl.textContent ?? ''
      const key = `${i}\n${code}`
      let result = results.current.get(key)
      if (!result) {
        result = renderMermaid(code)
        results.current.set(key, result)
      }
      void result.then((r) => {
        if (cancelled || !pre.isConnected || pre.hasAttribute(DONE_ATTR)) return
        if ('svg' in r) showDiagram(pre, r.svg)
        else if (!pending) showError(pre, r.error)
      })
    })
    return () => {
      cancelled = true
    }
  }, [ref, html, pending])
}
