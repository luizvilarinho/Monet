import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Document } from '../../types'
import { useKnowledgeBase, useNotebookVisibility } from '../../hooks/useDocuments'
import styles from './DocumentsModal.module.css'

export interface DocumentsModalProps {
  open: boolean
  notebookId: string | null
  notebookName: string
  onClose: () => void
  onOpenKnowledgeBase: () => void
}

function statusLabel(status: Document['status']): string {
  if (status === 'available') return 'available'
  if (status === 'indexing') return 'indexing'
  return 'error'
}

function StatusPill({ doc }: { doc: Document }) {
  const cls =
    doc.status === 'available'
      ? styles.pillOk
      : doc.status === 'indexing'
        ? styles.pillIndexing
        : styles.pillError
  return (
    <span
      className={`${styles.pill} ${cls}`}
      title={doc.status === 'error' ? doc.errorMessage ?? 'error' : undefined}
    >
      {statusLabel(doc.status)}
    </span>
  )
}

export function DocumentsModal({
  open,
  notebookId,
  notebookName,
  onClose,
  onOpenKnowledgeBase,
}: DocumentsModalProps) {
  const { documents, loading, error } = useKnowledgeBase()
  const { isVisible, toggle } = useNotebookVisibility(open ? notebookId : null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !notebookId) return null

  async function handleToggle(doc: Document) {
    if (doc.status !== 'available') return
    const next = !isVisible(doc.id)
    try {
      await toggle(doc.id, next)
    } catch (e) {
      console.error('failed to toggle document visibility', e)
    }
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Notebook Documents · ${notebookName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            Notebook Documents · <span className={styles.notebookName}>{notebookName}</span>
          </h2>
          <button
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label="close"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {loading && documents.length === 0 ? (
            <ul className={styles.skeletonList} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className={styles.skeletonRow}>
                  <span className={`${styles.skeletonBar} ${styles.skeletonName}`} />
                  <span className={`${styles.skeletonBar} ${styles.skeletonStatus}`} />
                  <span className={`${styles.skeletonBar} ${styles.skeletonAction}`} />
                </li>
              ))}
            </ul>
          ) : error ? (
            <p className={styles.errorText}>{error}</p>
          ) : documents.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No documents in Knowledge Base.</p>
              <p className={styles.emptyHelp}>
                <button
                  className={styles.linkBtn}
                  type="button"
                  onClick={() => { onClose(); onOpenKnowledgeBase() }}
                >
                  Add documents
                </button>{' '}
                to get started.
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colName}>name</th>
                  <th className={styles.colStatus}>status</th>
                  <th className={styles.colVisible}>visible</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const canToggle = doc.status === 'available'
                  const visible = isVisible(doc.id)
                  return (
                    <tr key={doc.id}>
                      <td className={styles.cellName} title={doc.name}>
                        {doc.name}
                      </td>
                      <td>
                        <StatusPill doc={doc} />
                      </td>
                      <td className={styles.cellVisible}>
                        <input
                          type="checkbox"
                          checked={visible}
                          disabled={!canToggle}
                          onChange={() => handleToggle(doc)}
                          aria-label={`toggle visibility for ${doc.name}`}
                          title={!canToggle ? `Document is ${doc.status} — not toggleable` : undefined}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className={styles.footer}>
          <p className={styles.footerHint}>
            Only &quot;available&quot; documents can be toggled.
          </p>
          <button
            className={styles.secondary}
            type="button"
            onClick={() => { onClose(); onOpenKnowledgeBase() }}
          >
            manage Knowledge Base
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
