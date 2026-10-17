import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Document } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { useKnowledgeBase, useNotebookVisibility } from '../../hooks/useDocuments'
import { notesFolderDocId } from '../../lib/documents'
import styles from './DocumentsModal.module.css'

export interface DocumentsModalProps {
  open: boolean
  notebookId: string | null
  notebookName: string
  onClose: () => void
  onOpenKnowledgeBase: () => void
  notesIndexEnabled: boolean
  onToggleNotesIndex: (enabled: boolean) => Promise<void>
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
  disabled: boolean
  alwaysOn?: boolean
  onToggle: () => void
}

function FolderRow({ folder, checked, disabled, alwaysOn, onToggle }: FolderRowProps) {
  return (
    <tr>
      <td className={styles.cellName} title={folder.originalPath ?? folder.name}>
        {folder.name}
        {alwaysOn && <span className={styles.alwaysOn}> (always on)</span>}
      </td>
      <td>📁 Folder</td>
      <td>
        <StatusPill doc={folder} />
      </td>
      <td className={styles.cellVisible}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          aria-label={`toggle visibility for folder ${folder.name}`}
          title={
            alwaysOn
              ? "This notebook's notes are always searched"
              : disabled ? 'No available files in this folder' : undefined
          }
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
  notesIndexEnabled,
  onToggleNotesIndex,
}: DocumentsModalProps) {
  const { documents: allDocuments, loading, error } = useKnowledgeBase()
  const { isVisible, toggle } = useNotebookVisibility(open ? notebookId : null)
  const { confirm, modal: confirmModal } = useConfirm()
  const [notesIndexPending, setNotesIndexPending] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !notebookId) return null

  // A pasta de notas do próprio caderno é incluída implicitamente na busca:
  // aparece no topo como "always on" (não alternável) quando a indexação está ligada.
  const ownNotesFolderId = notesFolderDocId(notebookId)
  const ownNotesFolder = notesIndexEnabled
    ? allDocuments.find((d) => d.id === ownNotesFolderId) ?? null
    : null
  const documents = allDocuments.filter((d) => d.id !== ownNotesFolderId)

  async function handleToggleNotesIndex() {
    const next = !notesIndexEnabled
    if (!next) {
      const ok = await confirm(
        "Turn off note indexing for this notebook? Its indexed copies will be deleted (your notes are not affected).",
        { title: 'Turn off note indexing' },
      )
      if (!ok) return
    }
    setNotesIndexPending(true)
    try {
      await onToggleNotesIndex(next)
    } catch (e) {
      console.error('failed to toggle notes indexing', e)
    } finally {
      setNotesIndexPending(false)
    }
  }

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
    try {
      await toggle(folder.id, !isVisible(folder.id))
    } catch (e) {
      console.error('failed to toggle folder visibility', e)
    }
  }

  return createPortal(
    <>
    {confirmModal}
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
          <label className={styles.notesIndexRow}>
            <input
              type="checkbox"
              checked={notesIndexEnabled}
              disabled={notesIndexPending}
              onChange={handleToggleNotesIndex}
            />
            <span className={styles.notesIndexText}>
              <span className={styles.notesIndexTitle}>Index this notebook&apos;s notes for AI</span>
              <span className={styles.notesIndexHelp}>
                Notes are saved as Markdown in a hidden app folder and indexed for chat and /commands.
              </span>
            </span>
          </label>
          {loading && documents.length === 0 && !ownNotesFolder ? (
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
          ) : documents.length === 0 && !ownNotesFolder ? (
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
                  <th className={styles.colName}>Name</th>
                  <th className={styles.colType}>Type</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={styles.colVisible}>Visible</th>
                </tr>
              </thead>
              <tbody>
                {ownNotesFolder && (
                  <FolderRow
                    folder={ownNotesFolder}
                    checked
                    disabled
                    alwaysOn
                    onToggle={() => {}}
                  />
                )}
                {folders.map((folder) => {
                  const hasAvailableChildren = documents.some(
                    (d) => d.parentFolderId === folder.id && d.docType === 'file' && d.status === 'available',
                  )
                  const checked = isVisible(folder.id)
                  return (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      checked={checked}
                      disabled={!hasAvailableChildren && !checked}
                      onToggle={() => handleToggleFolder(folder)}
                    />
                  )
                })}
                {standaloneFiles.map((doc) => {
                  const canToggle = doc.status === 'available'
                  const visible = isVisible(doc.id)
                  return (
                    <tr key={doc.id}>
                      <td className={styles.cellName} title={doc.originalPath ?? doc.name}>
                        {doc.name}
                      </td>
                      <td>📄 File</td>
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
    </div>
    </>,
    document.body,
  )
}
