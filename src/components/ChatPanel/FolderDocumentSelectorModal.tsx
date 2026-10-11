import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Document } from '../../types'
import type { ChatFolder } from '../../hooks/useChat'
import { useKnowledgeBase } from '../../hooks/useDocuments'
import styles from './FolderSystemPromptModal.module.css'
import docStyles from './FolderDocumentSelectorModal.module.css'

export interface FolderDocumentSelectorModalProps {
  open: boolean
  folder: ChatFolder | null
  // Única origem da seleção inicial (pasta vinculada a caderno → tabela do caderno).
  initialSelectedIds: string[]
  // Documento incluído sempre (pasta de notas do caderno vinculado): aparece
  // marcado e desabilitado, e não entra no array do onConfirm.
  implicitDocumentId?: string | null
  onConfirm: (folderId: string, visibleDocumentIds: string[]) => void
  onClose: () => void
}

interface FolderItemProps {
  folder: Document
  checked: boolean
  disabled: boolean
  alwaysOn?: boolean
  onToggle: () => void
}

function FolderItem({ folder, checked, disabled, alwaysOn, onToggle }: FolderItemProps) {
  return (
    <li
      className={`${docStyles.item} ${docStyles.itemFolder} ${disabled ? docStyles.itemDisabled : ''}`}
      onClick={disabled ? undefined : onToggle}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`toggle folder ${folder.name}`}
        title={
          alwaysOn
            ? "This notebook's notes are always searched"
            : disabled ? 'No available files in this folder' : undefined
        }
      />
      <span className={docStyles.docName} title={folder.originalPath ?? folder.name}>
        {folder.name}
        {alwaysOn && <span className={docStyles.alwaysOn}> (always on)</span>}
      </span>
      <span className={docStyles.colType}>📁 Folder</span>
      <span
        className={`${docStyles.pill} ${
          folder.status === 'available'
            ? docStyles.pillOk
            : folder.status === 'indexing'
              ? docStyles.pillIndexing
              : docStyles.pillError
        }`}
      >
        {folder.status}
      </span>
    </li>
  )
}

export function FolderDocumentSelectorModal({
  open,
  folder,
  initialSelectedIds,
  implicitDocumentId,
  onConfirm,
  onClose,
}: FolderDocumentSelectorModalProps) {
  const { documents, loading } = useKnowledgeBase()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Sync selected IDs from the initial selection when opening (or when it changes)
  const initialKey = initialSelectedIds.join('\n')
  const folderId = folder?.id ?? null
  useEffect(() => {
    if (!open || !folderId) return
    setSelectedIds(new Set(initialKey ? initialKey.split('\n') : []))
  }, [open, folderId, initialKey])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !folder) return null
  const targetFolderId = folder.id

  const implicitDoc = implicitDocumentId
    ? documents.find((d) => d.id === implicitDocumentId) ?? null
    : null
  const kbFolders = documents.filter((d) => d.docType === 'folder' && d.id !== implicitDocumentId)
  const standaloneFiles = documents.filter(
    (d) => d.docType === 'file' && !d.parentFolderId && d.id !== implicitDocumentId,
  )

  function toggleDoc(docId: string, available: boolean) {
    if (!available) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }

  function toggleKbFolder(kbFolder: Document) {
    const children = documents.filter(
      (d) => d.parentFolderId === kbFolder.id && d.docType === 'file' && d.status === 'available',
    )
    // Pasta sem arquivos disponíveis ainda pode ser desmarcada (mesma regra do DocumentsModal).
    if (children.length === 0 && !selectedIds.has(kbFolder.id)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(kbFolder.id)) next.delete(kbFolder.id)
      else next.add(kbFolder.id)
      return next
    })
  }

  function handleConfirm() {
    onConfirm(
      targetFolderId,
      Array.from(selectedIds).filter((id) => id !== implicitDocumentId),
    )
    onClose()
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Knowledge Base documents for ${folder.name || 'folder'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            Documents — {folder.name || 'unnamed'}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="close"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.intro}>
            Select which Knowledge Base documents should be available as AI context
            in conversations inside this folder. Only &quot;available&quot; documents can be selected.
          </p>

          {loading && documents.length === 0 ? (
            <p className={docStyles.muted}>Loading documents…</p>
          ) : documents.length === 0 ? (
            <p className={docStyles.muted}>
              No documents in the Knowledge Base yet. Add documents via the Knowledge Base button in the notebook panel.
            </p>
          ) : (
            <ul className={docStyles.list}>
              {implicitDoc && (
                <FolderItem
                  folder={implicitDoc}
                  checked
                  disabled
                  alwaysOn
                  onToggle={() => {}}
                />
              )}
              {kbFolders.map((kbFolder) => {
                const children = documents.filter(
                  (d) => d.parentFolderId === kbFolder.id && d.docType === 'file' && d.status === 'available',
                )
                const checked = selectedIds.has(kbFolder.id)
                return (
                  <FolderItem
                    key={kbFolder.id}
                    folder={kbFolder}
                    checked={checked}
                    disabled={children.length === 0 && !checked}
                    onToggle={() => toggleKbFolder(kbFolder)}
                  />
                )
              })}
              {standaloneFiles.map((doc) => {
                const available = doc.status === 'available'
                const checked = selectedIds.has(doc.id)
                return (
                  <li
                    key={doc.id}
                    className={`${docStyles.item} ${!available ? docStyles.itemDisabled : ''}`}
                    onClick={() => toggleDoc(doc.id, available)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!available}
                      onChange={() => toggleDoc(doc.id, available)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={doc.name}
                    />
                    <span className={docStyles.docName} title={doc.originalPath ?? doc.name}>
                      {doc.name}
                    </span>
                    <span className={docStyles.colType}>📄 File</span>
                    <span
                      className={`${docStyles.pill} ${
                        doc.status === 'available'
                          ? docStyles.pillOk
                          : doc.status === 'indexing'
                            ? docStyles.pillIndexing
                            : docStyles.pillError
                      }`}
                    >
                      {doc.status}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleConfirm}
            >
              save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
