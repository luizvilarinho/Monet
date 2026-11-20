import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Alarm, Check } from '@phosphor-icons/react'
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
      <Alarm size={12} aria-hidden /> {time}
      {fired && <Check size={12} weight="bold" className={styles.check} aria-label="Reminder fired" />}
    </NodeViewWrapper>
  )
}
