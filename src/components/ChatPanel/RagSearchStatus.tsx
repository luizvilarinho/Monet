import styles from './RagSearchStatus.module.css'

// Indicador da recuperação do RAG (~3 s antes do 1º token), nos 4 chats. Com
// `label`, o texto de outra etapa (o status do pipeline do Radar e do Papers, no
// chat das Anotações), no mesmo visual.
export function RagSearchStatus({ label = 'Searching knowledge base...' }: { label?: string }) {
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </div>
  )
}
