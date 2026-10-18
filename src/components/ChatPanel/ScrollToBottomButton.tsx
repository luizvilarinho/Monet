import styles from './ScrollToBottomButton.module.css'

interface ScrollToBottomButtonProps {
  // Posição (bottom/right) no painel que o usa.
  className?: string
  onClick: () => void
}

// Botão "voltar ao fim" do histórico do chat (Chat e Assistant).
export function ScrollToBottomButton({ className, onClick }: ScrollToBottomButtonProps) {
  return (
    <button
      type="button"
      className={className ? `${styles.btn} ${className}` : styles.btn}
      aria-label="Scroll to bottom"
      onClick={onClick}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="4,6 8,10 12,6" />
      </svg>
    </button>
  )
}
