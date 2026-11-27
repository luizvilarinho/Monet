import { BookmarkSimple, SpeakerHigh, Translate } from '@phosphor-icons/react'
import styles from './LanguageBar.module.css'

export interface LanguageBarProps {
  onTranslate: () => void
  onListen: () => void
  onAddToVocabulary: () => void
}

// Linha de língua da barra de seleção, acima da linha de sempre (cores, Copy,
// Add to note, Ask AI). Só aparece em livro de língua que o leitor estuda.
export function LanguageBar({ onTranslate, onListen, onAddToVocabulary }: LanguageBarProps) {
  return (
    // preventDefault no mousedown: o clique não mexe na seleção do texto, que o
    // Translate lê ao abrir.
    <div className={styles.bar} onMouseDown={(e) => e.preventDefault()}>
      <button type="button" className={styles.button} onClick={onTranslate} title="Translate (T)">
        <Translate size={13} aria-hidden />
        Translate
      </button>
      <button type="button" className={styles.button} onClick={onListen}>
        <SpeakerHigh size={13} aria-hidden />
        Listen
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={onAddToVocabulary}
        title="Add to vocabulary (V)"
      >
        <BookmarkSimple size={13} aria-hidden />
        Add to vocabulary
      </button>
    </div>
  )
}
