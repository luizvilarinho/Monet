import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeSearch } from '../../lib/noteSearch'
import { INBOX_NOTEBOOK_ID } from '../../lib/tasks'
import type { Notebook } from '../../types'
import styles from './NotebookPickerModal.module.css'

interface NotebookPickerModalProps {
  title: string
  // Explicação da consequência (ex.: a fusão do "Merge into another notebook").
  description?: string
  confirmLabel: string
  destructive?: boolean
  notebooks: Notebook[]
  onConfirm: (notebookId: string) => void
  onClose: () => void
}

// Escolha de caderno com busca (foco ao abrir), ↑↓, Enter e duplo clique. O
// Quick Notes fica sempre no topo.
export function NotebookPickerModal({
  title,
  description,
  confirmLabel,
  destructive = false,
  notebooks,
  onConfirm,
  onClose,
}: NotebookPickerModalProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const shown = useMemo(() => {
    const ordered = [
      ...notebooks.filter((nb) => nb.id === INBOX_NOTEBOOK_ID),
      ...notebooks.filter((nb) => nb.id !== INBOX_NOTEBOOK_ID),
    ]
    const q = normalizeSearch(query.trim())
    return q ? ordered.filter((nb) => normalizeSearch(nb.name).includes(q)) : ordered
  }, [notebooks, query])

  // A seleção acompanha o filtro: fora da lista, vai para o primeiro. No modo
  // destrutivo (fusão), só vale a escolha explícita: item clicado ou navegado
  // com as setas, ou o único resultado da busca digitada.
  const onlyMatch = query.trim() && shown.length === 1 ? shown[0].id : null
  const activeId = shown.some((nb) => nb.id === selectedId)
    ? selectedId
    : destructive ? onlyMatch : (shown[0]?.id ?? null)

  useEffect(() => {
    if (!activeId) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  function move(delta: number) {
    if (shown.length === 0) return
    const i = shown.findIndex((nb) => nb.id === activeId)
    const next = Math.min(shown.length - 1, Math.max(0, i + delta))
    setSelectedId(shown[next].id)
  }

  function handleConfirm(id: string | null = activeId) {
    if (!id) return
    onConfirm(id)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        {description && <p className={styles.description}>{description}</p>}
        <input
          className={styles.search}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              move(1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              move(-1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirm()
            }
          }}
          placeholder="Search notebooks…"
          aria-label="Search notebooks"
          role="combobox"
          aria-expanded
          aria-controls="notebook-picker-list"
          aria-activedescendant={activeId ? `notebook-picker-${activeId}` : undefined}
        />
        <ul className={styles.list} ref={listRef} role="listbox" id="notebook-picker-list" aria-label="Notebooks">
          {shown.length === 0 ? (
            <li className={styles.empty}>No notebook matches “{query.trim()}”</li>
          ) : (
            shown.map((nb) => (
              <li
                key={nb.id}
                id={`notebook-picker-${nb.id}`}
                data-id={nb.id}
                role="option"
                aria-selected={activeId === nb.id}
                className={`${styles.item} ${activeId === nb.id ? styles.itemSelected : ''}`}
                onClick={() => setSelectedId(nb.id)}
                onDoubleClick={() => handleConfirm(nb.id)}
              >
                {nb.name || 'unnamed'}
              </li>
            ))
          )}
        </ul>
        <div className={styles.footer}>
          <button className={styles.btnCancel} type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={destructive ? `${styles.btnConfirm} ${styles.btnDanger}` : styles.btnConfirm}
            type="button"
            disabled={!activeId}
            onClick={() => handleConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
