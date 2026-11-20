import { CaretDown } from '@phosphor-icons/react'
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
      <CaretDown size={16} weight="bold" aria-hidden />
    </button>
  )
}
