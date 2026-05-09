import { ViewPlugin, type EditorView } from '@codemirror/view'

export const spellCheckEnforcer = ViewPlugin.fromClass(
  class {
    private observer: MutationObserver
    private timer: ReturnType<typeof setTimeout> | null = null

    constructor(private view: EditorView) {
      this.observer = new MutationObserver(() => {
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          const el = this.view.contentDOM
          el.setAttribute('spellcheck', 'false')
          requestAnimationFrame(() => el.setAttribute('spellcheck', 'true'))
        }, 500)
      })
      this.observer.observe(view.contentDOM, { childList: true, subtree: true })
    }

    destroy() {
      this.observer.disconnect()
      if (this.timer) clearTimeout(this.timer)
    }
  }
)
