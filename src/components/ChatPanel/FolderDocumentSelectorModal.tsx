import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DotsThree } from '@phosphor-icons/react'
import type { Document } from '../../types'
import type { ChatFolder } from '../../hooks/useChat'
import { useConfirm } from '../../hooks/useConfirm'
import { useKnowledgeBase } from '../../hooks/useDocuments'
import {
  documentMatchesFilter,
  documentSetsDelete,
  documentSetsList,
  documentSetsRename,
  documentSetsSave,
  type DocumentSet,
} from '../../lib/documents'
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
        aria-label={`toggle folder ${folder.alias ?? folder.name}`}
        title={
          alwaysOn
            ? "This notebook's notes are always searched"
            : disabled ? 'No available files in this folder' : undefined
        }
      />
      <span className={docStyles.docName} title={folder.originalPath ?? folder.name}>
        {folder.alias ?? folder.name}
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
  const [filter, setFilter] = useState('')
  const { confirm, modal: confirmModal } = useConfirm()
  const [sets, setSets] = useState<DocumentSet[]>([])
  const [setsError, setSetsError] = useState<string | null>(null)
  // Último conjunto aplicado neste modal (para o aviso de itens apagados).
  const [appliedSetId, setAppliedSetId] = useState<string | null>(null)
  // null = botão "Save selection as…"; string = input do nome aberto.
  const [newSetName, setNewSetName] = useState<string | null>(null)
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [menuSetId, setMenuSetId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Sync selected IDs from the initial selection when opening (or when it changes)
  const initialKey = initialSelectedIds.join('\n')
  const folderId = folder?.id ?? null
  useEffect(() => {
    if (!open || !folderId) return
    setSelectedIds(new Set(initialKey ? initialKey.split('\n') : []))
  }, [open, folderId, initialKey])

  useEffect(() => {
    if (!open) {
      setFilter('')
      setAppliedSetId(null)
      setNewSetName(null)
      setRenamingSetId(null)
      setMenuSetId(null)
      setSetsError(null)
      return
    }
    // Recarrega a cada abertura: conjuntos criados em outra janela aparecem aqui.
    documentSetsList()
      .then(setSets)
      .catch((e) => setSetsError(e instanceof Error ? e.message : String(e)))
  }, [open])

  // Close the set menu on outside click
  useEffect(() => {
    if (!menuSetId) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuSetId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuSetId])

  // Close on Escape (the set menu first, when open)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (menuSetId) setMenuSetId(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, menuSetId])

  if (!open || !folder) return null
  const targetFolderId = folder.id
  const docById = new Map(documents.map((d) => [d.id, d]))
  const selectionIds = Array.from(selectedIds).filter((id) => id !== implicitDocumentId)
  const appliedSet = sets.find((s) => s.id === appliedSetId) ?? null
  const appliedMissing = appliedSet
    ? appliedSet.documentIds.filter((id) => !docById.has(id)).length
    : 0

  async function reloadSets() {
    try {
      setSets(await documentSetsList())
    } catch (e) {
      setSetsError(e instanceof Error ? e.message : String(e))
    }
  }

  function setTooltip(set: DocumentSet): string {
    const labels = set.documentIds
      .map((id) => docById.get(id))
      .filter((d): d is Document => !!d)
      .map((d) => `• ${d.alias ?? d.name}`)
    const missing = set.documentIds.length - labels.length
    return ['Apply this set', ...labels, ...(missing > 0 ? [`(${missing} missing)`] : [])].join('\n')
  }

  // 1 clique aplica e já persiste (mesma via do "save"); o modal fica aberto.
  function applySet(set: DocumentSet) {
    const ids = set.documentIds.filter((id) => docById.has(id) && id !== implicitDocumentId)
    setSelectedIds(new Set(ids))
    setAppliedSetId(set.id)
    setMenuSetId(null)
    onConfirm(targetFolderId, ids)
  }

  async function handleUpdateAppliedSet() {
    if (!appliedSet) return
    setSetsError(null)
    try {
      await documentSetsSave(
        appliedSet.id,
        appliedSet.name,
        appliedSet.documentIds.filter((id) => docById.has(id)),
      )
      await reloadSets()
    } catch (e) {
      setSetsError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleSaveNewSet() {
    const name = (newSetName ?? '').trim()
    setNewSetName(null)
    if (!name || selectionIds.length === 0) return
    setSetsError(null)
    try {
      const id = await documentSetsSave(null, name, selectionIds)
      setAppliedSetId(id)
      await reloadSets()
    } catch (e) {
      setSetsError(e instanceof Error ? e.message : String(e))
    }
  }

  function startRename(set: DocumentSet) {
    setMenuSetId(null)
    setRenamingSetId(set.id)
    setRenameDraft(set.name)
  }

  async function handleRename(set: DocumentSet) {
    const name = renameDraft.trim()
    setRenamingSetId(null)
    if (!name || name === set.name) return
    setSetsError(null)
    try {
      await documentSetsRename(set.id, name)
      await reloadSets()
    } catch (e) {
      setSetsError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDeleteSet(set: DocumentSet) {
    setMenuSetId(null)
    const ok = await confirm(
      `Delete the set "${set.name}"? The documents and the current selection are not affected.`,
      { title: 'Delete set' },
    )
    if (!ok) return
    setSetsError(null)
    try {
      await documentSetsDelete(set.id)
      if (appliedSetId === set.id) setAppliedSetId(null)
      await reloadSets()
    } catch (e) {
      setSetsError(e instanceof Error ? e.message : String(e))
    }
  }

  const implicitDoc = implicitDocumentId
    ? documents.find((d) => d.id === implicitDocumentId && documentMatchesFilter(d, filter)) ?? null
    : null
  const kbFolders = documents.filter(
    (d) => d.docType === 'folder' && d.id !== implicitDocumentId && documentMatchesFilter(d, filter),
  )
  const standaloneFiles = documents.filter(
    (d) =>
      d.docType === 'file' && !d.parentFolderId && d.id !== implicitDocumentId && documentMatchesFilter(d, filter),
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

          {documents.length > 0 && (
            <div className={docStyles.setsBlock}>
              <div className={docStyles.sets}>
                <span className={docStyles.setsLabel}>Sets</span>
                {sets.length === 0 && newSetName === null && (
                  <span className={docStyles.setsEmpty}>No saved sets yet.</span>
                )}
                {sets.map((set) =>
                  renamingSetId === set.id ? (
                    <input
                      key={set.id}
                      className={docStyles.setNameInput}
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename(set)
                        if (e.key === 'Escape') {
                          e.stopPropagation()
                          setRenamingSetId(null)
                        }
                      }}
                      onBlur={() => setRenamingSetId(null)}
                      aria-label={`rename set ${set.name}`}
                    />
                  ) : (
                    <div
                      key={set.id}
                      ref={menuSetId === set.id ? menuRef : undefined}
                      className={`${docStyles.chip} ${appliedSetId === set.id ? docStyles.chipActive : ''}`}
                    >
                      <button
                        type="button"
                        className={docStyles.chipApply}
                        onClick={() => applySet(set)}
                        title={setTooltip(set)}
                      >
                        {set.name}
                      </button>
                      <button
                        type="button"
                        className={docStyles.chipMenuBtn}
                        onClick={() => setMenuSetId(menuSetId === set.id ? null : set.id)}
                        title="Set options"
                        aria-label={`options for set ${set.name}`}
                      >
                        <DotsThree size={12} weight="bold" aria-hidden />
                      </button>
                      {menuSetId === set.id && (
                        <div className={docStyles.chipMenu} role="menu">
                          <button type="button" role="menuitem" onClick={() => startRename(set)}>
                            Rename
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className={docStyles.chipMenuDanger}
                            onClick={() => void handleDeleteSet(set)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                )}
                {newSetName === null ? (
                  <button
                    type="button"
                    className={docStyles.setSaveBtn}
                    onClick={() => setNewSetName('')}
                    disabled={selectionIds.length === 0}
                    title={selectionIds.length === 0 ? 'Select documents first' : 'Save the current selection as a set'}
                  >
                    Save selection as…
                  </button>
                ) : (
                  <input
                    className={docStyles.setNameInput}
                    autoFocus
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveNewSet()
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setNewSetName(null)
                      }
                    }}
                    onBlur={() => setNewSetName(null)}
                    placeholder="Set name, Enter to save"
                    aria-label="new set name"
                  />
                )}
              </div>
              {appliedSet && appliedMissing > 0 && (
                <div className={docStyles.setWarning}>
                  <span>{appliedMissing} item(s) in this set no longer exist</span>
                  <button type="button" className={docStyles.setWarningBtn} onClick={() => void handleUpdateAppliedSet()}>
                    Update set
                  </button>
                </div>
              )}
              {setsError && <p className={docStyles.setError}>{setsError}</p>}
            </div>
          )}

          {documents.length > 0 && (
            <input
              className={docStyles.filterInput}
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name, alias or path…"
              aria-label="Filter documents"
            />
          )}

          {loading && documents.length === 0 ? (
            <p className={docStyles.muted}>Loading documents…</p>
          ) : documents.length === 0 ? (
            <p className={docStyles.muted}>
              No documents in the Knowledge Base yet. Add documents via the Knowledge Base button in the notebook panel.
            </p>
          ) : !implicitDoc && kbFolders.length === 0 && standaloneFiles.length === 0 ? (
            <p className={docStyles.muted}>No matches.</p>
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
      {confirmModal}
    </div>,
    document.body,
  )
}
