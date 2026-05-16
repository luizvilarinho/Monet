/**
 * Workaround Windows spellcheck (typo-js falhou). Força reativação periódica
 * do atributo spellcheck no contenteditable para manter o sublinhado do SO.
 */
export function attachSpellCheckEnforcer(element: HTMLElement): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      element.setAttribute('spellcheck', 'false')
      requestAnimationFrame(() => element.setAttribute('spellcheck', 'true'))
    }, 500)
  })
  observer.observe(element, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    if (timer) clearTimeout(timer)
  }
}
