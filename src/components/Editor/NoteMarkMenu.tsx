import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { CaretDown, Plus } from '@phosphor-icons/react'
import {
  noteMarkElement,
  noteMarkRunAt,
  noteMarkRunIndex,
  noteMarkRunText,
  removeNoteMarkRun,
  setNoteMarkLabel,
  type NoteMarkRun,
} from './NoteMark'
import { MarkLabelPopover } from './MarkLabelPopover'
import styles from './FormattingToolbar.module.css'

interface Props {
  editor: Editor
  // Container de scroll do editor (.body), como na FormattingToolbar.
  scrollEl: HTMLElement | null
  // Rótulos de marca já usados (troca de rótulo).
  labels: string[]
  // "Ask AI": envia o texto da marca para o chat do caderno.
  onAskAi?: (text: string) => void
  // "List": abre a lista de marcas nesta marca (índice na nota + rótulo).
  onShowInList?: (index: number, label: string | null) => void
}

const PLUGIN_KEY = 'monetNoteMarkMenu'
// Quanto o pedido do clique espera a seleção chegar na marca.
const PENDING_MS = 500

// Meta de transação que abre o menu na marca sob o cursor (o Editor manda ao
// revelar uma marca vinda da lista, do Ctrl+P ou do chat).
export const NOTE_MARK_MENU_OPEN = 'noteMarkMenuOpen'

function runAtCaret(state: EditorState): NoteMarkRun | null {
  const { empty, from } = state.selection
  return empty ? noteMarkRunAt(state, from) : null
}

// Menu da marca: abre no CLIQUE numa marca (não ao passar o cursor por ela
// digitando ou com as setas) e some ao editar, ao sair da marca ou com Esc. A
// régua de formatação é a dona do caso com seleção — aqui ela nunca aparece.
export function NoteMarkMenu({ editor, scrollEl, labels, onAskAi, onShowInList }: Props) {
  // Pedido de abertura (instante do clique; 0 = nenhum): zera quando o menu
  // deve sumir.
  const requestedRef = useRef(0)
  const [labelPopover, setLabelPopover] = useState<{ top: number; left: number; run: NoteMarkRun } | null>(null)
  const [copied, setCopied] = useState(false)
  const labelBtnRef = useRef<HTMLButtonElement>(null)

  // Run sob o cursor (re-render quando muda: o rótulo do botão acompanha).
  const runKey = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const run = runAtCaret(ed.state)
      return run ? `${run.from}:${run.to}:${run.label ?? ''}` : ''
    },
  })
  const run = runKey ? runAtCaret(editor.state) : null

  // Pede o menu. Com o cursor ainda fora da marca (1º clique no editor sem
  // foco: o ProseMirror lê a seleção depois do evento de clique e o foco já
  // reavalia o menu antes dela), o pedido fica pendente e o shouldShow o
  // atende quando a seleção chegar. O 'show' do plugin não posiciona (só
  // depois de visível): 'updatePosition' em seguida.
  const show = useCallback(() => {
    requestedRef.current = performance.now()
    if (editor.isDestroyed || !runAtCaret(editor.state)) return
    editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, 'show'))
    editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, 'updatePosition'))
  }, [editor])

  const hide = useCallback(() => {
    requestedRef.current = 0
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, 'hide'))
  }, [editor])

  // Clique simples numa marca abre o menu (Ctrl+clique é do Editor: abre a
  // lista de marcas).
  useEffect(() => {
    const dom = editor.view.dom
    const onClick = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
      if (!(e.target as Element).closest?.('mark[data-mark]')) return
      show()
    }
    dom.addEventListener('click', onClick)
    return () => dom.removeEventListener('click', onClick)
  }, [editor, show])

  // Pedido de abertura por transação (revelação de uma marca). Fora do
  // dispatch em curso: o show também despacha.
  useEffect(() => {
    const onTransaction = ({ transaction }: { transaction: { getMeta(key: string): unknown } }) => {
      if (transaction.getMeta(NOTE_MARK_MENU_OPEN)) setTimeout(show, 0)
    }
    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor, show])

  // Esc fecha o menu (em captura, antes do Esc das outras barras).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !requestedRef.current || !editor.isFocused) return
      e.preventDefault()
      hide()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [editor, hide])

  useEffect(() => setCopied(false), [runKey])

  const shouldShow = useCallback(
    ({ state, oldState }: { state: EditorState; oldState?: EditorState }) => {
      if (!requestedRef.current) return false
      if (oldState && !oldState.doc.eq(state.doc)) {
        requestedRef.current = 0
        return false
      }
      if (!runAtCaret(state)) {
        // Fora da marca: pedido recente ainda espera a seleção do clique.
        if (performance.now() - requestedRef.current > PENDING_MS) requestedRef.current = 0
        return false
      }
      return true
    },
    []
  )

  const anchor = useCallback(() => {
    const current = runAtCaret(editor.state)
    const el = current ? noteMarkElement(editor.view, current) : null
    if (!el) return null
    // Primeira linha da marca: o menu não pula quando o clique muda de linha.
    const rects = Array.from(el.getClientRects())
    const first = rects[0] ?? el.getBoundingClientRect()
    return { getBoundingClientRect: () => first, getClientRects: () => rects }
  }, [editor])

  // Estável: o BubbleMenu reenvia as opções ao plugin quando o objeto muda.
  const options = useMemo(
    () => ({ placement: 'top' as const, offset: 8, flip: {}, shift: {}, scrollTarget: scrollEl ?? undefined }),
    [scrollEl]
  )

  const textOf = (r: NoteMarkRun) => noteMarkRunText(editor.state.doc, r)

  return (
    <>
      <BubbleMenu
        editor={editor}
        pluginKey={PLUGIN_KEY}
        shouldShow={shouldShow}
        getReferencedVirtualElement={anchor}
        options={options}
      >
        <div className={styles.toolbar} onMouseDown={(e) => e.preventDefault()}>
          {run && (
            <>
              <button
                ref={labelBtnRef}
                className={`${styles.btn} ${styles.markLabelBtn}`}
                title={run.label ? 'Change label' : 'Add a label (e.g. Research, Review)'}
                aria-expanded={labelPopover !== null}
                onMouseDown={(e) => {
                  e.preventDefault()
                  const rect = labelBtnRef.current?.getBoundingClientRect()
                  if (!rect) return
                  setLabelPopover({ top: rect.bottom + 6, left: rect.left, run })
                }}
                type="button"
              >
                {run.label ? (
                  <>
                    <span className={styles.markLabelText}>{run.label}</span>
                    <CaretDown size={10} weight="bold" aria-hidden />
                  </>
                ) : (
                  <>
                    <Plus size={11} weight="bold" aria-hidden />
                    Label
                  </>
                )}
              </button>
              <div className={styles.sep} />
              {onAskAi && (
                <button
                  className={`${styles.btn} ${styles.askAi}`}
                  title="Ask AI about the marked passage"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onAskAi(textOf(run))
                  }}
                  type="button"
                >
                  Ask AI
                </button>
              )}
              <button
                className={styles.btn}
                title="Copy the marked passage"
                onMouseDown={(e) => {
                  e.preventDefault()
                  void navigator.clipboard.writeText(textOf(run)).then(() => setCopied(true))
                }}
                type="button"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              {onShowInList && (
                <button
                  className={styles.btn}
                  title={
                    run.label
                      ? `Show the "${run.label}" marks in the Marks list (Ctrl+click)`
                      : 'Show in the Marks list (Ctrl+click)'
                  }
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const index = noteMarkRunIndex(editor.state.doc, run)
                    hide()
                    onShowInList(Math.max(index, 0), run.label)
                  }}
                  type="button"
                >
                  List
                </button>
              )}
              <div className={styles.sep} />
              <button
                className={styles.btn}
                title="Remove the mark (keeps the text)"
                onMouseDown={(e) => {
                  e.preventDefault()
                  removeNoteMarkRun(editor, run, editor.state.selection.from)
                }}
                type="button"
              >
                Remove mark
              </button>
            </>
          )}
        </div>
      </BubbleMenu>
      {labelPopover && (
        <MarkLabelPopover
          position={labelPopover}
          labels={labels}
          current={labelPopover.run.label}
          onPick={(label) => {
            const target = labelPopover.run
            setLabelPopover(null)
            const caret = Math.min(Math.max(editor.state.selection.from, target.from), target.to)
            setNoteMarkLabel(editor, target, label, caret)
            show()
          }}
          onClose={(reason) => {
            setLabelPopover(null)
            if (reason === 'escape') {
              editor.commands.focus()
              show()
            }
          }}
        />
      )}
    </>
  )
}
