import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import styles from './FormattingToolbar.module.css'
import {
  FORMATTING_GROUPS,
  TABLE_GROUPS,
  isActive,
  runAction,
  type ButtonDef,
} from './formattingActions'
import { findEligibleTaskItems } from './TaskStatus'

interface Props {
  editor: Editor
  // "Ask AI": envia o trecho selecionado para o chat do caderno.
  onAskAi?: (text: string) => void
  // "Add to Tasks": promove os itens de checklist selecionados a tasks.
  onAddToTasks?: () => void
}

const PLUGIN_KEY = 'monetFormattingMenu'

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

export function FormattingToolbar({ editor, onAskAi, onAddToTasks }: Props) {
  const [hiddenByEscape, setHiddenByEscape] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHiddenByEscape(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

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
      options={{ placement: 'top', offset: 8 }}
    >
      <div
        className={styles.toolbar}
        onMouseDown={(e) => e.preventDefault()}
      >
        {hasSelection && renderGroups(editor, formattingGroups, 'fmt')}
        {inTable && hasSelection && <div className={styles.sep} />}
        {inTable && renderGroups(editor, TABLE_GROUPS, 'tbl')}
        {hasSelection && (onAskAi || showAddToTasks) && (
          <div className={styles.group}>
            <div className={styles.sep} />
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
