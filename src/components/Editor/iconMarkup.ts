import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Icon } from '@phosphor-icons/react'

// Ícone Phosphor em HTML, para os widgets do ProseMirror (DOM puro, fora do
// React). Chame no carregamento do módulo: fora de um render do React o
// flushSync desenha na hora; dentro de um efeito ele ficaria para depois e o
// HTML sairia vazio.
export function iconMarkup(icon: Icon, size = 12): string {
  const host = document.createElement('span')
  const root = createRoot(host)
  flushSync(() => root.render(createElement(icon, { size, 'aria-hidden': true })))
  const html = host.innerHTML
  root.unmount()
  return html
}
