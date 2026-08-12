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

interface Props {
  editor: Editor
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

export function FormattingToolbar({ editor }: Props) {
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

  const { inTable, hasSelection } = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const { from, to } = ed.state.selection
      return {
        inTable: ed.isActive('table'),
        hasSelection: from !== to,
      }
    },
  })

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
      </div>
    </BubbleMenu>
  )
}
