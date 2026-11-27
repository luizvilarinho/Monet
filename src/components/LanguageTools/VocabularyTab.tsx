import { CheckCircle, Eye, EyeSlash, Notebook, PencilLine, Playlist, SpeakerHigh, Trash } from '@phosphor-icons/react'
import type { VocabularyItem } from '../../types'
import { getUserLocale } from '../../lib/languageSettings'
import { formatVocabularyDate, splitAtTerm, splitBySent } from '../../lib/vocabulary'
import type { PlacementAnchor } from '../Reader/toolbarPlacement'
import styles from './VocabularyTab.module.css'

export interface VocabularyTabProps {
  items: VocabularyItem[]
  hideSenses: boolean
  onToggleHideSenses: () => void
  // "Mark in text": o pontilhado das palavras guardadas, neste livro e nos outros da
  // mesma língua.
  marksOn: boolean
  onToggleMarks: () => void
  selectedIds: ReadonlySet<string>
  onToggleSelected: (id: string) => void
  // Leva à página (ou ao trecho) onde o item foi guardado.
  onOpenItem: (item: VocabularyItem) => void
  onListenItem: (item: VocabularyItem) => void
  // O anchor é o botão "Translate" da linha: o popover abre ao lado dele.
  onTranslateItem: (item: VocabularyItem, anchor: PlacementAnchor) => void
  onRemoveItem: (item: VocabularyItem) => void
  // O chip "Sent to notebook": abre a nota.
  onOpenSent: (item: VocabularyItem) => void
  sendLabel: string
  canSend: boolean
  onSend: () => void
  // "Notebook · Note" do destino lembrado; null enquanto não há (a escolha vem no primeiro envio).
  destinationLabel: string | null
  onChangeDestination: () => void
  onListenToList: () => void
  // "Retell": só com palavras ou expressões a usar (os marcados, ou os novos).
  canRetell: boolean
  onRetell: () => void
}

function Item({
  item,
  hideSenses,
  checked,
  locale,
  onToggleSelected,
  onOpenItem,
  onListenItem,
  onTranslateItem,
  onRemoveItem,
  onOpenSent,
}: {
  item: VocabularyItem
  hideSenses: boolean
  checked: boolean
  locale: string
  onToggleSelected: VocabularyTabProps['onToggleSelected']
  onOpenItem: VocabularyTabProps['onOpenItem']
  onListenItem: VocabularyTabProps['onListenItem']
  onTranslateItem: VocabularyTabProps['onTranslateItem']
  onRemoveItem: VocabularyTabProps['onRemoveItem']
  onOpenSent: VocabularyTabProps['onOpenSent']
}) {
  const isSentence = item.kind === 'sentence'
  const parts = isSentence ? null : splitAtTerm(item.sentence, item.text)
  const date = formatVocabularyDate(item.createdAt, locale)
  return (
    <li
      className={styles.item}
      tabIndex={0}
      // Clicar no corpo leva à página; os controles de dentro não propagam.
      onClick={() => onOpenItem(item)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') onOpenItem(item)
      }}
      title="Go to this place in the book"
    >
      <input
        type="checkbox"
        className={styles.check}
        checked={checked}
        onChange={() => onToggleSelected(item.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${item.text}`}
      />
      <span className={`${styles.term} ${isSentence ? styles.termSentence : ''}`}>{item.text}</span>
      {item.sense && !hideSenses && (
        <span className={`${styles.sense} ${isSentence ? styles.senseSentence : ''}`}>{item.sense}</span>
      )}
      {!item.sense && (
        <span className={styles.noSense}>
          No translation ·{' '}
          <button
            type="button"
            className={styles.inlineButton}
            onClick={(e) => {
              e.stopPropagation()
              const box = e.currentTarget.getBoundingClientRect()
              onTranslateItem(item, { x: box.left, y: box.top, w: box.width, h: box.height })
            }}
          >
            Translate
          </button>
        </span>
      )}
      {!isSentence && (
        <span className={styles.source}>
          {parts ? (
            <>
              {parts.before}
              <strong>{parts.match}</strong>
              {parts.after}
            </>
          ) : (
            item.sentence
          )}
        </span>
      )}
      <span className={styles.meta}>
        {item.positionLabel}
        {date && ` · ${date}`}
        {item.sentAt && (
          <button
            type="button"
            className={styles.sentChip}
            onClick={(e) => {
              e.stopPropagation()
              onOpenSent(item)
            }}
            title="Open the note this was sent to"
          >
            <CheckCircle size={11} weight="fill" aria-hidden />
            Sent to notebook
          </button>
        )}
      </span>
      <span className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={(e) => {
            e.stopPropagation()
            onListenItem(item)
          }}
          aria-label={`Listen to ${item.text}`}
          title="Listen to the sentence"
        >
          <SpeakerHigh size={13} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.actionDanger}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemoveItem(item)
          }}
          aria-label={`Remove ${item.text} from vocabulary`}
          title="Remove from vocabulary"
        >
          <Trash size={13} aria-hidden />
        </button>
      </span>
    </li>
  )
}

// Aba "Vocabulary" da coluna de navegação dos leitores (PDF e EPUB): o que o
// usuário guardou do livro, e o envio ao caderno. Sem contador e sem estado de
// palavra: a lista é para reencontrar e usar.
export function VocabularyTab({
  items,
  hideSenses,
  onToggleHideSenses,
  marksOn,
  onToggleMarks,
  selectedIds,
  onToggleSelected,
  onOpenItem,
  onListenItem,
  onTranslateItem,
  onRemoveItem,
  onOpenSent,
  sendLabel,
  canSend,
  onSend,
  destinationLabel,
  onChangeDestination,
  onListenToList,
  canRetell,
  onRetell,
}: VocabularyTabProps) {
  const { fresh, sent } = splitBySent(items)
  const locale = getUserLocale()
  const renderItem = (item: VocabularyItem) => (
    <Item
      key={item.id}
      item={item}
      hideSenses={hideSenses}
      checked={selectedIds.has(item.id)}
      locale={locale}
      onToggleSelected={onToggleSelected}
      onOpenItem={onOpenItem}
      onListenItem={onListenItem}
      onTranslateItem={onTranslateItem}
      onRemoveItem={onRemoveItem}
      onOpenSent={onOpenSent}
    />
  )
  return (
    <div className={styles.tab}>
      <div className={styles.head}>
        <label
          className={styles.marksToggle}
          title="Dotted underline on the saved words, in this book and in the other books in this language"
        >
          <input type="checkbox" checked={marksOn} onChange={onToggleMarks} />
          Mark in text
        </label>
        {items.length > 0 && (
          <button type="button" className={styles.mini} onClick={onToggleHideSenses}>
            {hideSenses ? <Eye size={12} aria-hidden /> : <EyeSlash size={12} aria-hidden />}
            {hideSenses ? 'Show meanings' : 'Hide meanings'}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>
          Nothing saved yet. Select a word and choose Add to vocabulary (V).
        </p>
      ) : (
        <ul className={styles.list}>
          {fresh.length > 0 && <li className={styles.section}>New</li>}
          {fresh.map(renderItem)}
          {sent.length > 0 && <li className={styles.section}>Sent to notebook</li>}
          {sent.map(renderItem)}
        </ul>
      )}
      <div className={styles.foot}>
        <button type="button" className={styles.send} onClick={onSend} disabled={!canSend}>
          <Notebook size={13} aria-hidden />
          {sendLabel}
        </button>
        {destinationLabel && (
          <div className={styles.dest}>
            <span title={destinationLabel}>To: {destinationLabel}</span>
            <button type="button" className={styles.destChange} onClick={onChangeDestination}>
              Change
            </button>
          </div>
        )}
        <div className={styles.footRow}>
          <button type="button" className={styles.mini} onClick={onListenToList} disabled={items.length === 0}>
            <Playlist size={12} aria-hidden />
            Listen to list
          </button>
          <button
            type="button"
            className={styles.mini}
            onClick={onRetell}
            disabled={!canRetell}
            title={
              canRetell
                ? "Write the passage in your own words, in the book's note"
                : 'Tick the words you want to use, or save new ones first'
            }
          >
            <PencilLine size={12} aria-hidden />
            Retell
          </button>
        </div>
      </div>
    </div>
  )
}
