import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { findParentNodeClosestToPos, type Editor } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import styles from './FormattingToolbar.module.css'
import {
  FORMATTING_GROUPS,
  TABLE_GROUPS,
  isActive,
  runAction,
  type ButtonDef,
} from './formattingActions'
import { findEligibleTaskItems } from './TaskStatus'
import { HighlightPicker } from './HighlightPicker'

interface Props {
  editor: Editor
  // Container de scroll do editor (.body): a barra se reposiciona no scroll dele.
  scrollEl: HTMLElement | null
  // "Ask AI": envia o trecho selecionado para o chat do caderno.
  onAskAi?: (text: string) => void
  // "Add to Tasks": promove os itens de checklist selecionados a tasks.
  onAddToTasks?: () => void
}

const PLUGIN_KEY = 'monetFormattingMenu'

// Com o cursor numa tabela, a barra ancora no <table> inteiro (acima dele) em
// vez do cursor, para não cobrir as células. Fora de tabela retorna null e o
// BubbleMenu usa a seleção como âncora (comportamento padrão).
function tableAnchor(editor: Editor) {
  if (!editor.isActive('table')) return null
  const found = findParentNodeClosestToPos(
    editor.state.selection.$anchor,
    (node) => node.type.name === 'table'
  )
  if (!found) return null
  const dom = editor.view.nodeDOM(found.pos)
  if (!(dom instanceof HTMLElement)) return null
  // Com resizable: true o nodeDOM é o div.tableWrapper do TableView.
  const table = dom.tagName === 'TABLE' ? dom : dom.querySelector('table')
  if (!table) return null
  return {
    getBoundingClientRect: () => table.getBoundingClientRect(),
    getClientRects: () => [table.getBoundingClientRect()],
  }
}

function renderGroups(
  editor: Editor,
  groups: ButtonDef[][],
  startKey: string
) {
  return groups.map((group, gi) => (
    <div key={`${startKey}-${gi}`} className={styles.group}>
      {gi > 0 && <div className={styles.sep} />}
      {group.map(({ id, label, title, cls }) => (
        <button
          key={id}
          className={[
            styles.btn,
            isActive(editor, id) ? styles.active : '',
            cls === 'bold' ? styles.bold : '',
            cls === 'italic' ? styles.italic : '',
            cls === 'strike' ? styles.strike : '',
          ].join(' ')}
          title={title}
          onMouseDown={(e) => {
            e.preventDefault()
            runAction(editor, id)
          }}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  ))
}

export function FormattingToolbar({ editor, scrollEl, onAskAi, onAddToTasks }: Props) {
  const [hiddenByEscape, setHiddenByEscape] = useState(false)
  const hiddenByEscapeRef = useRef(hiddenByEscape)
  hiddenByEscapeRef.current = hiddenByEscape

  // Em captura: com a barra visível, o Esc é dela e chega já tratado
  // (defaultPrevented) a quem escuta no document, como o modal da task.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const { from, to } = editor.state.selection
        const visible =
          !hiddenByEscapeRef.current &&
          editor.isFocused &&
          !editor.isActive('linkedNoteBlock') &&
          (from !== to || editor.isActive('table'))
        if (visible) e.preventDefault()
        setHiddenByEscape(true)
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [editor])

  useEffect(() => {
    if (!hiddenByEscape) return
    const reset = () => setHiddenByEscape(false)
    editor.on('selectionUpdate', reset)
    return () => {
      editor.off('selectionUpdate', reset)
    }
  }, [editor, hiddenByEscape])

  const { inTable, hasSelection, eligibleCount } = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const { from, to } = ed.state.selection
      return {
        inTable: ed.isActive('table'),
        hasSelection: from !== to,
        eligibleCount: from !== to ? findEligibleTaskItems(ed.state).length : 0,
      }
    },
  })

  // Ao entrar/sair da tabela o plugin já posicionou a barra (cursor sem
  // seleção atualiza na hora) com as options antigas; o BubbleMenu (filho)
  // aplica as novas no effect dele, que roda antes deste — reposiciona aqui.
  useEffect(() => {
    if (editor.isDestroyed) return
    editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, 'updatePosition'))
  }, [editor, inTable])

  const showAddToTasks = Boolean(onAddToTasks) && eligibleCount > 0

  const formattingGroups = inTable
    ? FORMATTING_GROUPS.map((g) => g.filter((b) => b.id !== 'table'))
    : FORMATTING_GROUPS

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={PLUGIN_KEY}
      shouldShow={({ editor: ed, from: f, to: t }) => {
        if (hiddenByEscape) return false
        if (ed.isActive('linkedNoteBlock')) return false
        const sel = f !== t
        const tbl = ed.isActive('table')
        return sel || tbl
      }}
      getReferencedVirtualElement={() => tableAnchor(editor)}
      options={
        inTable
          ? {
              placement: 'top-start',
              offset: 6,
              flip: false,
              shift: { crossAxis: true, padding: 4 },
              // Esconde a barra quando a tabela sai inteira da área visível
              // (o shift crossAxis a prenderia sobre outro conteúdo).
              hide: true,
              scrollTarget: scrollEl ?? undefined,
            }
          : // flip/shift/hide explícitos: o plugin mescla as options, então os
            // valores do modo tabela persistiriam ao sair dela.
            { placement: 'top', offset: 8, flip: {}, shift: {}, hide: false, scrollTarget: scrollEl ?? undefined }
      }
    >
      <div
        className={styles.toolbar}
        onMouseDown={(e) => e.preventDefault()}
      >
        {hasSelection && renderGroups(editor, formattingGroups, 'fmt')}
        {inTable && hasSelection && <div className={styles.sep} />}
        {inTable && renderGroups(editor, TABLE_GROUPS, 'tbl')}
        {hasSelection && (
          <div className={styles.group}>
            <div className={styles.sep} />
            <HighlightPicker
              editor={editor}
              className={styles.btn}
              activeClassName={styles.active}
            />
            {(onAskAi || showAddToTasks) && <div className={styles.sep} />}
            {showAddToTasks && (
              <button
                className={`${styles.btn} ${styles.addTask}`}
                title="Add the selected checklist items to Tasks"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onAddToTasks?.()
                }}
                type="button"
              >
                Add to Tasks
              </button>
            )}
            {onAskAi && (
              <button
                className={`${styles.btn} ${styles.askAi}`}
                title="Ask AI about the selection"
                onMouseDown={(e) => {
                  e.preventDefault()
                  const { from, to } = editor.state.selection
                  onAskAi(editor.state.doc.textBetween(from, to, '\n'))
                }}
                type="button"
              >
                Ask AI
              </button>
            )}
          </div>
        )}
      </div>
    </BubbleMenu>
  )
}
