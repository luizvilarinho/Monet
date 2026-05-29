import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Document } from '../../types'
import type { ChatFolder } from '../../hooks/useChat'
import { useKnowledgeBase } from '../../hooks/useDocuments'
import styles from './FolderSystemPromptModal.module.css'
import docStyles from './FolderDocumentSelectorModal.module.css'

export interface FolderDocumentSelectorModalProps {
  open: boolean
  folder: ChatFolder | null
  onConfirm: (folderId: string, visibleDocumentIds: string[]) => void
  onClose: () => void
}

interface FolderItemProps {
  folder: Document
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onToggle: () => void
}

function FolderItem({ folder, checked, indeterminate, disabled, onToggle }: FolderItemProps) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <li
      className={`${docStyles.item} ${docStyles.itemFolder} ${disabled ? docStyles.itemDisabled : ''}`}
      onClick={disabled ? undefined : onToggle}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`toggle folder ${folder.name}`}
        title={disabled ? 'No available files in this folder' : undefined}
      />
      <span className={docStyles.docName} title={folder.originalPath ?? folder.name}>
        {folder.name}
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
  onConfirm,
  onClose,
}: FolderDocumentSelectorModalProps) {
  const { documents, loading } = useKnowledgeBase()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Sync selected IDs from folder when opening
  useEffect(() => {
    if (!open || !folder) return
    setSelectedIds(new Set(folder.visibleDocumentIds))
  }, [open, folder])

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
  const folderId = folder.id

  const kbFolders = documents.filter((d) => d.docType === 'folder')
  const standaloneFiles = documents.filter((d) => d.docType === 'file' && !d.parentFolderId)

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
    if (children.length === 0) return
    const allSelected = children.every((c) => selectedIds.has(c.id))
    const next = !allSelected
    setSelectedIds((prev) => {
      const updated = new Set(prev)
      for (const c of children) {
        if (next) updated.add(c.id)
        else updated.delete(c.id)
      }
      return updated
    })
  }

  function handleConfirm() {
    onConfirm(folderId, Array.from(selectedIds))
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
              {kbFolders.map((kbFolder) => {
                const children = documents.filter(
                  (d) => d.parentFolderId === kbFolder.id && d.docType === 'file' && d.status === 'available',
                )
                const allSelected = children.length > 0 && children.every((c) => selectedIds.has(c.id))
                const someSelected = children.some((c) => selectedIds.has(c.id))
                const indeterminate = someSelected && !allSelected
                return (
                  <FolderItem
                    key={kbFolder.id}
                    folder={kbFolder}
                    checked={allSelected}
                    indeterminate={indeterminate}
                    disabled={children.length === 0}
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
