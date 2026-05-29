import { useEffect, useRef } from 'react'
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

interface FolderRowProps {
  folder: Document
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onToggle: () => void
}

function FolderRow({ folder, checked, indeterminate, disabled, onToggle }: FolderRowProps) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <tr>
      <td className={styles.cellName} title={folder.name}>
        {folder.name}
      </td>
      <td>
        <StatusPill doc={folder} />
      </td>
      <td className={styles.cellVisible}>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          aria-label={`toggle visibility for folder ${folder.name}`}
          title={disabled ? 'No available files in this folder' : undefined}
        />
      </td>
    </tr>
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

  const folders = documents.filter((d) => d.docType === 'folder')
  const standaloneFiles = documents.filter((d) => d.docType === 'file' && !d.parentFolderId)

  async function handleToggleFile(doc: Document) {
    if (doc.status !== 'available') return
    const next = !isVisible(doc.id)
    try {
      await toggle(doc.id, next)
    } catch (e) {
      console.error('failed to toggle document visibility', e)
    }
  }

  async function handleToggleFolder(folder: Document) {
    const children = documents.filter(
      (d) => d.parentFolderId === folder.id && d.docType === 'file' && d.status === 'available',
    )
    if (children.length === 0) return
    const allVisible = children.every((c) => isVisible(c.id))
    const next = !allVisible
    try {
      await Promise.all(children.map((c) => toggle(c.id, next)))
    } catch (e) {
      console.error('failed to toggle folder visibility', e)
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
                {folders.map((folder) => {
                  const children = documents.filter(
                    (d) => d.parentFolderId === folder.id && d.docType === 'file' && d.status === 'available',
                  )
                  const allVisible = children.length > 0 && children.every((c) => isVisible(c.id))
                  const someVisible = children.some((c) => isVisible(c.id))
                  const indeterminate = someVisible && !allVisible
                  return (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      checked={allVisible}
                      indeterminate={indeterminate}
                      disabled={children.length === 0}
                      onToggle={() => handleToggleFolder(folder)}
                    />
                  )
                })}
                {standaloneFiles.map((doc) => {
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
                          onChange={() => handleToggleFile(doc)}
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
