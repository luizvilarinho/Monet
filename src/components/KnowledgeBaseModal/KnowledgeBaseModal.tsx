import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PencilSimple } from '@phosphor-icons/react'
import type { Document } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { useKnowledgeBase } from '../../hooks/useDocuments'
import { listChatFolderIds } from '../../hooks/useChat'
import {
  documentMatchesFilter,
  documentsDeleteWatchedFolder,
  documentsIndexOutdatedCount,
  documentsReindexOutdated,
  documentsSetFolderAlias,
  onReindexProgress,
  pickDocumentFile,
  pickDocumentFolder,
  webFolderChatFolderId,
  type IndexOutdatedCount,
  type ReindexProgressEvent,
} from '../../lib/documents'
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
      title={doc.errorMessage ?? (doc.status === 'error' ? 'error' : undefined)}
    >
      {statusLabel(doc.status)}
    </span>
  )
}

function outdatedLabel({ files, notes }: IndexOutdatedCount): string {
  const total = files + notes
  const docs = `${total} document${total === 1 ? '' : 's'}`
  if (notes === 0) return `Search index needs an update: ${docs}.`
  const auto = `${notes} note${notes === 1 ? '' : 's'} update${notes === 1 ? 's' : ''} automatically`
  return `Search index needs an update: ${docs} (${auto}).`
}

export function KnowledgeBaseModal({ open, onClose }: KnowledgeBaseModalProps) {
  const { documents, loading, error, refresh, upload, reindex, remove, addFolder, rescanFolder, removeFolder } = useKnowledgeBase()
  const { confirm, modal: confirmModal } = useConfirm()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null)
  const [aliasDraft, setAliasDraft] = useState('')
  const [outdated, setOutdated] = useState<IndexOutdatedCount | null>(null)
  const [reindexProgress, setReindexProgress] = useState<ReindexProgressEvent | null>(null)
  const [indexNotice, setIndexNotice] = useState<string | null>(null)

  const recountOutdated = useCallback(() => {
    documentsIndexOutdatedCount()
      .then(setOutdated)
      .catch((e) => console.warn('documents_index_outdated_count failed', e))
  }, [])

  // Ouvido também com o modal fechado: a rotina segue em segundo plano.
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false
    onReindexProgress((p) => {
      if (p.finished) {
        setReindexProgress(null)
        setIndexNotice(p.failed > 0 ? `Index updated (${p.failed} failed).` : 'Index updated.')
        recountOutdated()
      } else {
        setReindexProgress(p)
      }
    })
      .then((un) => {
        if (cancelled) un()
        else unlisten = un
      })
      .catch((e) => console.error('failed to listen documents://reindex-progress', e))
    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [recountOutdated])

  // Recontagem periódica enquanto há pendentes: as notas saem da contagem à
  // medida que a fila do useNotesIndexSync avança.
  const hasOutdated = !!outdated && outdated.files + outdated.notes > 0
  useEffect(() => {
    if (!open) return
    recountOutdated()
    if (!hasOutdated) return
    const id = window.setInterval(recountOutdated, 5000)
    return () => window.clearInterval(id)
  }, [open, hasOutdated, recountOutdated])

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
      setFilter('')
      setEditingAliasId(null)
      setIndexNotice(null)
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

  async function handleUpdateIndex() {
    setUploadError(null)
    setIndexNotice(null)
    try {
      await documentsReindexOutdated()
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
    setUploadError(null)
    try {
      await rescanFolder(folder.id)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  function startEditAlias(folder: Document) {
    setEditingAliasId(folder.id)
    setAliasDraft(folder.alias ?? '')
  }

  async function handleSaveAlias(folder: Document) {
    setEditingAliasId(null)
    try {
      await documentsSetFolderAlias(folder.id, aliasDraft.trim() || null)
      await refresh()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleRemoveFolder(folder: Document) {
    const label = folder.alias ?? folder.name
    const message =
      folder.origin === 'ai'
        ? `Remove folder "${label}"? This folder was created automatically by the AI and its files will be permanently deleted from disk.`
        : `Remove folder "${label}"? All indexed files from this folder will be removed from all notebooks.`
    const ok = await confirm(message, { title: 'Remove folder' })
    if (!ok) return
    try {
      await removeFolder(folder.id)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleRemoveOrphans() {
    const n = orphanFolders.length
    const names = orphanFolders.map((f) => `"${f.alias ?? f.name}"`).join(', ')
    const ok = await confirm(
      `Remove ${n} orphan web folder${n === 1 ? '' : 's'}? The chat folders that saved them no longer exist, and their saved pages will be permanently deleted from disk: ${names}.`,
      { title: 'Remove orphan web folders' },
    )
    if (!ok) return
    for (const folder of orphanFolders) {
      try {
        await documentsDeleteWatchedFolder(folder.id)
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : String(e))
      }
    }
    await refresh()
  }

  // Pasta web cuja pasta de chat dona foi apagada: nenhum escopo a enxerga.
  // Sem a lista de pastas legível, nenhuma é marcada.
  const chatFolderIds = listChatFolderIds()
  const orphanFolders = chatFolderIds
    ? documents.filter((d) => {
        const chatFolderId = webFolderChatFolderId(d)
        return chatFolderId !== null && !chatFolderIds.includes(chatFolderId)
      })
    : []
  const orphanIds = new Set(orphanFolders.map((d) => d.id))
  const folders = documents.filter((d) => d.docType === 'folder' && documentMatchesFilter(d, filter))
  const standaloneFiles = documents.filter(
    (d) => d.docType === 'file' && !d.parentFolderId && documentMatchesFilter(d, filter),
  )

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
            {reindexProgress ? (
              <div className={styles.indexBanner} role="status">
                <div className={styles.indexBannerRow}>
                  <span>
                    Updating search index: {reindexProgress.done}/{reindexProgress.total}
                    {reindexProgress.failed > 0 && ` (${reindexProgress.failed} failed)`}
                  </span>
                  {reindexProgress.currentName && (
                    <span className={styles.indexCurrent} title={reindexProgress.currentName}>
                      {reindexProgress.currentName}
                    </span>
                  )}
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${reindexProgress.total > 0 ? (reindexProgress.done / reindexProgress.total) * 100 : 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              (indexNotice || (hasOutdated && outdated)) && (
                <div className={styles.indexBanner} role="status">
                  {indexNotice && <span>{indexNotice}</span>}
                  {hasOutdated && outdated && (
                    <div className={styles.indexBannerRow}>
                      <span>{outdatedLabel(outdated)}</span>
                      {outdated.files > 0 && (
                        <button className={styles.primary} type="button" onClick={handleUpdateIndex}>
                          Update index
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
            {documents.length > 0 && !error && (
              <input
                className={styles.filterInput}
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name, alias or path…"
                aria-label="Filter documents"
              />
            )}
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
            ) : folders.length === 0 && standaloneFiles.length === 0 ? (
              <p className={styles.muted}>No matches.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.colName}>Name</th>
                    <th className={styles.colStatus}>Status</th>
                    <th className={styles.colCount}>Files</th>
                    <th className={styles.colActions}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder) => {
                    const childCount = documents.filter((d) => d.parentFolderId === folder.id).length
                    return (
                      <tr key={folder.id} className={styles.folderRow}>
                        <td className={styles.cellName} title={folder.originalPath ?? folder.name}>
                          <div className={styles.nameWrap}>
                            {editingAliasId === folder.id ? (
                              <input
                                className={styles.aliasInput}
                                autoFocus
                                value={aliasDraft}
                                onChange={(e) => setAliasDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleSaveAlias(folder)
                                  if (e.key === 'Escape') {
                                    e.stopPropagation()
                                    setEditingAliasId(null)
                                  }
                                }}
                                onBlur={() => setEditingAliasId(null)}
                                placeholder={folder.name}
                                aria-label={`alias for folder ${folder.name}`}
                              />
                            ) : (
                              <>
                                <span className={styles.nameText}>{folder.alias ?? folder.name}</span>
                                {folder.origin !== 'notes' && (
                                  <button
                                    className={styles.aliasEdit}
                                    type="button"
                                    onClick={() => startEditAlias(folder)}
                                    title="Edit alias"
                                    aria-label={`edit alias of folder ${folder.name}`}
                                  >
                                    <PencilSimple size={12} aria-hidden />
                                  </button>
                                )}
                              </>
                            )}
                            {folder.origin === 'ai' && <span className={styles.aiBadge}>AI-generated</span>}
                            {orphanIds.has(folder.id) && (
                              <span
                                className={styles.orphanBadge}
                                title="The chat folder that saved these web sources no longer exists."
                              >
                                Orphan
                              </span>
                            )}
                            {folder.origin === 'notes' && <span className={styles.notesBadge}>Notes</span>}
                          </div>
                        </td>
                        <td>
                          <StatusPill doc={folder} />
                          {folder.status === 'error' && folder.errorMessage && (
                            <span className={styles.errorMsg}>{folder.errorMessage}</span>
                          )}
                        </td>
                        <td className={styles.cellCount}>{childCount}</td>
                        <td className={styles.cellActions}>
                          {folder.origin !== 'notes' && (
                            <>
                              <button
                                className={styles.secondary}
                                type="button"
                                onClick={() => handleRescanFolder(folder)}
                                disabled={folder.status === 'indexing'}
                              >
                                {folder.status === 'indexing' ? 'scanning…' : 'rescan'}
                              </button>
                              <button
                                className={styles.danger}
                                type="button"
                                onClick={() => handleRemoveFolder(folder)}
                                aria-label={`remove folder ${folder.alias ?? folder.name}`}
                              >
                                remove
                              </button>
                            </>
                          )}
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
                {orphanFolders.length > 0 && (
                  <button className={styles.secondary} type="button" onClick={handleRemoveOrphans}>
                    Remove orphan web folders ({orphanFolders.length})
                  </button>
                )}
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
