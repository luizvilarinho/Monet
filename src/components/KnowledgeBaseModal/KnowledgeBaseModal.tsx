import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Document } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { useKnowledgeBase } from '../../hooks/useDocuments'
import { pickDocumentFile, pickDocumentFolder } from '../../lib/documents'
import styles from './KnowledgeBaseModal.module.css'

export interface KnowledgeBaseModalProps {
  open: boolean
  onClose: () => void
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

export function KnowledgeBaseModal({ open, onClose }: KnowledgeBaseModalProps) {
  const { documents, loading, error, upload, reindex, remove, addFolder, rescanFolder, removeFolder } = useKnowledgeBase()
  const { confirm, modal: confirmModal } = useConfirm()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setUploadError(null)
      setUploading(false)
    }
  }, [open])

  if (!open) return null

  async function handleUpload() {
    setUploadError(null)
    let pickedPath: string | null = null
    try {
      pickedPath = await pickDocumentFile()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
      return
    }
    if (!pickedPath) return
    setUploading(true)
    try {
      await upload(pickedPath)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(doc: Document) {
    const ok = await confirm(
      `Delete "${doc.name}"? Indexed excerpts will be removed from all notebooks.`,
      { title: 'Delete document' },
    )
    if (!ok) return
    try {
      await remove(doc.id)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleReindex(doc: Document) {
    try {
      await reindex(doc.id)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleAddFolder() {
    setUploadError(null)
    let pickedPath: string | null = null
    try {
      pickedPath = await pickDocumentFolder()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
      return
    }
    if (!pickedPath) return
    setUploading(true)
    try {
      await addFolder(pickedPath)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleRescanFolder(folder: Document) {
    try {
      await rescanFolder(folder.id)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleRemoveFolder(folder: Document) {
    const ok = await confirm(
      `Remove folder "${folder.name}"? All indexed files from this folder will be removed from all notebooks.`,
      { title: 'Remove folder' },
    )
    if (!ok) return
    try {
      await removeFolder(folder.id)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  const folders = documents.filter((d) => d.docType === 'folder')
  const standaloneFiles = documents.filter((d) => d.docType === 'file' && !d.parentFolderId)

  return createPortal(
    <>
      {confirmModal}
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-label="Knowledge Base"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className={styles.modal}>
          <header className={styles.header}>
            <h2 className={styles.title}>Knowledge Base</h2>
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
                <p className={styles.emptyTitle}>No documents in Knowledge Base yet.</p>
                <p className={styles.emptyHelp}>
                  Add documents to use them as AI context in notebooks and chat folders.
                </p>
                <div className={styles.emptyActions}>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? 'uploading…' : '+ add document'}
                  </button>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleAddFolder}
                    disabled={uploading}
                  >
                    + add folder
                  </button>
                </div>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.colName}>name</th>
                    <th className={styles.colStatus}>status</th>
                    <th className={styles.colCount}>files</th>
                    <th className={styles.colActions}>actions</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder) => {
                    const childCount = documents.filter((d) => d.parentFolderId === folder.id).length
                    return (
                      <tr key={folder.id} className={styles.folderRow}>
                        <td className={styles.cellName} title={folder.name}>
                          {folder.name}
                        </td>
                        <td>
                          <StatusPill doc={folder} />
                          {folder.status === 'error' && folder.errorMessage && (
                            <span className={styles.errorMsg}>{folder.errorMessage}</span>
                          )}
                        </td>
                        <td className={styles.cellCount}>{childCount}</td>
                        <td className={styles.cellActions}>
                          <button
                            className={styles.secondary}
                            type="button"
                            onClick={() => handleRescanFolder(folder)}
                          >
                            rescan
                          </button>
                          <button
                            className={styles.danger}
                            type="button"
                            onClick={() => handleRemoveFolder(folder)}
                            aria-label={`remove folder ${folder.name}`}
                          >
                            remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {standaloneFiles.map((doc) => (
                    <tr key={doc.id}>
                      <td className={styles.cellName} title={doc.name}>
                        {doc.name}
                      </td>
                      <td>
                        <StatusPill doc={doc} />
                        {doc.status === 'error' && doc.errorMessage && (
                          <span className={styles.errorMsg}>{doc.errorMessage}</span>
                        )}
                      </td>
                      <td className={styles.cellCount}>—</td>
                      <td className={styles.cellActions}>
                        {doc.status === 'error' && (
                          <button
                            className={styles.secondary}
                            type="button"
                            onClick={() => handleReindex(doc)}
                          >
                            retry
                          </button>
                        )}
                        <button
                          className={styles.danger}
                          type="button"
                          onClick={() => handleRemove(doc)}
                          aria-label={`remove ${doc.name}`}
                        >
                          remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {uploadError && <p className={styles.errorText}>{uploadError}</p>}
          </div>

          <footer className={styles.footer}>
            <p className={styles.footerHint}>
              Indexing requires an internet connection.
            </p>
            {documents.length > 0 && (
              <div className={styles.footerActions}>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? 'uploading…' : '+ add document'}
                </button>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={handleAddFolder}
                  disabled={uploading}
                >
                  + add folder
                </button>
              </div>
            )}
          </footer>
        </div>
      </div>
    </>,
    document.body,
  )
}
