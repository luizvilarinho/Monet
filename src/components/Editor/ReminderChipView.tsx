import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useReminderState } from './RemindersContext'
import styles from './ReminderChip.module.css'

export function ReminderChipView({ node, selected }: NodeViewProps) {
  const id = (node.attrs.id as string) ?? ''
  const time = (node.attrs.time as string) ?? ''
  const { firedIds } = useReminderState()
  const fired = id !== '' && firedIds.has(id)

  return (
    <NodeViewWrapper
      as="span"
      className={`${styles.chip} ${fired ? styles.fired : ''} ${selected ? styles.selected : ''}`}
      contentEditable={false}
    >
      <span aria-hidden="true">⏰</span> {time}
      {fired && <span className={styles.check} aria-label="fired">✓</span>}
    </NodeViewWrapper>
  )
}
