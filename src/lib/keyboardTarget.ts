// De quem é a tecla: quem tem o foco num campo (`input`, `textarea`, `select`,
// texto editável) ou dentro de um modal fica com ela. Os atalhos do leitor (setas,
// Espaço, R, L, T, V, H, Esc) só valem com o foco fora disso: Espaço num botão de
// modal aciona o botão, e a seta num seletor troca a opção, não a página.
export function ownsKeyboard(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.closest !== 'function') return false
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (element.isContentEditable) return true
  return element.closest('[contenteditable=""], [contenteditable="true"], [aria-modal="true"]') !== null
}
