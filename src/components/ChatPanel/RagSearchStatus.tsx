import styles from './RagSearchStatus.module.css'

// Indicador da recuperação do RAG (~3 s antes do 1º token), nos 4 chats.
export function RagSearchStatus() {
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      Searching knowledge base...
    </div>
  )
}
