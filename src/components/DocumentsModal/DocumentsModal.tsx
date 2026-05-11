import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Document } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { useDocuments } from '../../hooks/useDocuments'
import { pickDocumentFile } from '../../lib/documents'
import styles from './DocumentsModal.module.css'

export interface DocumentsModalProps {
  open: boolean
  notebookId: string | null
  notebookName: string
  onClose: () => void
}

function statusLabel(status: Document['status']): string {
  if (status === 'available') return 'disponível'
  if (status === 'indexing') return 'indexando'
  return 'erro'
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
      title={doc.status === 'error' ? doc.errorMessage ?? 'erro' : undefined}
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
}: DocumentsModalProps) {
  const { documents, loading, error, upload, reindex, remove } =
    useDocuments(open ? notebookId : null)
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

  if (!open || !notebookId) return null

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
      `Apagar "${doc.name}"? Os trechos indexados serão removidos.`,
      { title: 'Apagar documento' },
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

  return createPortal(
    <>
      {confirmModal}
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-label={`Documentos do caderno ${notebookName}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className={styles.modal}>
          <header className={styles.header}>
            <h2 className={styles.title}>
              Documentos · <span className={styles.notebookName}>{notebookName}</span>
            </h2>
            <button
              className={styles.close}
              type="button"
              onClick={onClose}
              aria-label="fechar"
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
                <p className={styles.emptyTitle}>Nenhum documento ainda</p>
                <p className={styles.emptyHelp}>
                  Documentos são usados como contexto da IA neste caderno.
                </p>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? 'enviando…' : '+ adicionar documento'}
                </button>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.colName}>nome</th>
                    <th className={styles.colStatus}>status</th>
                    <th className={styles.colActions}>ações</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
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
                      <td className={styles.cellActions}>
                        {doc.status === 'error' && (
                          <button
                            className={styles.secondary}
                            type="button"
                            onClick={() => handleReindex(doc)}
                          >
                            retentar
                          </button>
                        )}
                        <button
                          className={styles.danger}
                          type="button"
                          onClick={() => handleRemove(doc)}
                          aria-label={`remover ${doc.name}`}
                        >
                          remover
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
              Indexação requer conexão com internet.
            </p>
            {documents.length > 0 && (
              <button
                className={styles.primary}
                type="button"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'enviando…' : '+ adicionar documento'}
              </button>
            )}
          </footer>
        </div>
      </div>
    </>,
    document.body,
  )
}
