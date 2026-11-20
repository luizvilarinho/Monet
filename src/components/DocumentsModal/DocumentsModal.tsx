import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Folder, X } from '@phosphor-icons/react'
import type { Document } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { useKnowledgeBase, useNotebookVisibility } from '../../hooks/useDocuments'
import { listChatFolderIds } from '../../hooks/useChat'
import { documentMatchesFilter, notesFolderDocId, webFolderChatFolderId } from '../../lib/documents'
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

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function statusLabel(status: Document['status']): string {
  if (status === 'available') return 'Available'
  if (status === 'indexing') return 'Indexing'
  return 'Error'
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
      title={doc.status === 'error' ? doc.errorMessage ?? 'Error' : undefined}
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
  orphan?: boolean
  onToggle: () => void
}

function FolderRow({ folder, checked, disabled, alwaysOn, orphan, onToggle }: FolderRowProps) {
  const label = folder.alias ?? folder.name
  return (
    <tr>
      <td className={styles.cellName} title={folder.originalPath ?? folder.name}>
        <span className={styles.nameWrap}>
          <span className={styles.nameText}>{label}</span>
          {alwaysOn && <span className={styles.alwaysOn}>(always on)</span>}
          {folder.origin === 'ai' && <span className={styles.aiBadge}>AI-generated</span>}
          {orphan && (
            <span
              className={styles.orphanBadge}
              title="The chat folder that saved these web sources no longer exists."
            >
              Orphan
            </span>
          )}
          {folder.origin === 'notes' && <span className={styles.notesBadge}>Notes</span>}
        </span>
      </td>
      <td>
        <span className={styles.type}>
          <Folder size={14} aria-hidden />
          Folder
        </span>
      </td>
      <td>
        <StatusPill doc={folder} />
      </td>
      <td className={styles.cellVisible}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          aria-label={`Use folder ${label} in AI`}
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
  const { confirm: askConfirm, modal: confirmModal } = useConfirm()
  // O modal fica montado: uma confirmação aberta ao fechar (ou ao trocar de
  // caderno) resolve como cancel e não age sobre o caderno anterior.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const settleConfirmRef = useRef<((ok: boolean) => void) | null>(null)
  const confirm = useCallback(
    (message: string, options: Parameters<typeof askConfirm>[1]) =>
      new Promise<boolean>((resolve) => {
        const settle = (ok: boolean) => {
          if (settleConfirmRef.current !== settle) return
          settleConfirmRef.current = null
          setConfirmOpen(false)
          resolve(ok)
        }
        settleConfirmRef.current = settle
        setConfirmOpen(true)
        void askConfirm(message, options).then(settle)
      }),
    [askConfirm],
  )
  const [notesIndexPending, setNotesIndexPending] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  // Com uma confirmação aberta, o Escape é dela.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !confirmOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, confirmOpen])

  useEffect(() => {
    settleConfirmRef.current?.(false)
    setToggleError(null)
    setFilter('')
  }, [open, notebookId])

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
    setToggleError(null)
    if (!next) {
      const ok = await confirm(
        "Turn off note indexing for this notebook? Its indexed copies are deleted. Your notes are not changed.",
        { title: 'Turn off note indexing', confirmLabel: 'Turn off' },
      )
      if (!ok) return
    }
    setNotesIndexPending(true)
    try {
      await onToggleNotesIndex(next)
    } catch (e) {
      setToggleError(`Could not turn note indexing ${next ? 'on' : 'off'}: ${errorText(e)}`)
    } finally {
      setNotesIndexPending(false)
    }
  }

  async function handleToggle(doc: Document) {
    if (doc.docType === 'file' && doc.status !== 'available') return
    const next = !isVisible(doc.id)
    setToggleError(null)
    try {
      await toggle(doc.id, next)
    } catch (e) {
      setToggleError(`Could not ${next ? 'use' : 'stop using'} "${doc.alias ?? doc.name}": ${errorText(e)}`)
    }
  }

  // Pasta web cuja pasta de chat dona foi apagada (como na KB).
  const chatFolderIds = listChatFolderIds()
  const isOrphan = (d: Document) => {
    const chatFolderId = webFolderChatFolderId(d)
    return !!chatFolderIds && chatFolderId !== null && !chatFolderIds.includes(chatFolderId)
  }

  const matches = documents.filter((d) => documentMatchesFilter(d, filter))
  const folders = matches.filter((d) => d.docType === 'folder')
  const standaloneFiles = matches.filter((d) => d.docType === 'file' && !d.parentFolderId)
  const userFolders = folders.filter((d) => d.origin !== 'notes' && d.origin !== 'ai')
  const otherNotes = folders.filter((d) => d.origin === 'notes')
  const webFolders = folders.filter((d) => d.origin === 'ai')
  const hasRows =
    userFolders.length + standaloneFiles.length + otherNotes.length + webFolders.length > 0 || !!ownNotesFolder

  function renderFolder(folder: Document) {
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
        orphan={isOrphan(folder)}
        onToggle={() => void handleToggle(folder)}
      />
    )
  }

  function groupHeader(label: string) {
    return (
      <tr className={styles.groupRow}>
        <th colSpan={4} scope="colgroup">
          {label}
        </th>
      </tr>
    )
  }

  return createPortal(
    <>
    {confirmOpen && confirmModal}
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
            aria-label="Close"
            title="Close"
          >
            <X size={16} aria-hidden />
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
          <p className={styles.useInAiHelp}>
            Use in AI: checked items are searched by this notebook&apos;s chat and /commands.
          </p>
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
          {toggleError && (
            <p className={styles.errorText} role="alert">
              {toggleError}
            </p>
          )}
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
          ) : !hasRows ? (
            <p className={styles.muted}>No matches.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colName}>Name</th>
                  <th className={styles.colType}>Type</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={styles.colVisible}>Use in AI</th>
                </tr>
              </thead>
              {ownNotesFolder && (
                <tbody>
                  {groupHeader('This notebook’s notes')}
                  <FolderRow
                    folder={ownNotesFolder}
                    checked
                    disabled
                    alwaysOn
                    onToggle={() => {}}
                  />
                </tbody>
              )}
              {userFolders.length + standaloneFiles.length > 0 && (
                <tbody>
                  {groupHeader('Your files and folders')}
                  {userFolders.map(renderFolder)}
                  {standaloneFiles.map((doc) => {
                    const canToggle = doc.status === 'available'
                    const visible = isVisible(doc.id)
                    return (
                      <tr key={doc.id}>
                        <td className={styles.cellName} title={doc.originalPath ?? doc.name}>
                          {doc.name}
                        </td>
                        <td>
                          <span className={styles.type}>
                            <FileText size={14} aria-hidden />
                            File
                          </span>
                        </td>
                        <td>
                          <StatusPill doc={doc} />
                        </td>
                        <td className={styles.cellVisible}>
                          <input
                            type="checkbox"
                            checked={visible}
                            disabled={!canToggle}
                            onChange={() => void handleToggle(doc)}
                            aria-label={`Use ${doc.name} in AI`}
                            title={!canToggle ? `Only available documents can be used (this one is ${statusLabel(doc.status).toLowerCase()})` : undefined}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )}
              {otherNotes.length > 0 && (
                <tbody>
                  {groupHeader('Notes from other notebooks')}
                  {otherNotes.map(renderFolder)}
                </tbody>
              )}
              {webFolders.length > 0 && (
                <tbody>
                  {groupHeader('Web sources')}
                  {webFolders.map(renderFolder)}
                </tbody>
              )}
            </table>
          )}
        </div>

        <footer className={styles.footer}>
          <p className={styles.footerHint}>
            Only available documents can be used in AI.
          </p>
          <button
            className={styles.secondary}
            type="button"
            onClick={() => { onClose(); onOpenKnowledgeBase() }}
          >
            Manage Knowledge Base
          </button>
        </footer>
      </div>
    </div>
    </>,
    document.body,
  )
}
