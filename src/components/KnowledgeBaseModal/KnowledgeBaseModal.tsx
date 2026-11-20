import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PencilSimple, Plus, X } from '@phosphor-icons/react'
import type { Document, Notebook } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { useKnowledgeBase } from '../../hooks/useDocuments'
import { listChatFolderIds } from '../../hooks/useChat'
import {
  NOTEBOOK_VISIBILITY_CHANGED_EVENT,
  documentMatchesFilter,
  documentsDeleteWatchedFolder,
  documentsIndexOutdatedCount,
  documentsLastFoldersCheck,
  documentsListVisibility,
  documentsReindexOutdated,
  documentsRescanAllWatchedFolders,
  documentsSetFolderAlias,
  onReindexProgress,
  onRescanProgress,
  pickDocumentFiles,
  pickDocumentFolder,
  setNotebookDocumentVisibility,
  webFolderChatFolderId,
  type FolderScanReport,
  type IndexOutdatedCount,
  type ReindexProgressEvent,
  type RescanProgressEvent,
  type RescanSummary,
} from '../../lib/documents'
import styles from './KnowledgeBaseModal.module.css'

export interface KnowledgeBaseModalProps {
  open: boolean
  onClose: () => void
  // Pastas monitoradas em erro (raiz ausente ou ilegível), para o ícone da KB.
  onFolderErrorsChange: (count: number) => void
  // Sem a chave da OpenRouter, nada é indexado e o foco não confere as pastas.
  hasApiKey: boolean
  // Abre o Settings na seção da OpenRouter (o banner sem chave).
  onOpenSettings: () => void
  // Coluna "Used in" e o aviso depois de adicionar.
  notebooks: Notebook[]
  activeNotebookId: string | null
}

const NOTES_FOLDER_PREFIX = 'notes-folder:'

// Caderno dono de uma pasta de notas (ela já vale nele); null nas demais.
function notesFolderOwner(doc: Document): string | null {
  return doc.id.startsWith(NOTES_FOLDER_PREFIX) ? doc.id.slice(NOTES_FOLDER_PREFIX.length) : null
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
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
      title={doc.errorMessage ?? (doc.status === 'error' ? 'Error' : undefined)}
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

// O que mudou no índice ("2 new, 1 updated") ou "no changes found".
function changesText({ added, updated, removed }: { added: number; updated: number; removed: number }): string {
  const changes = [
    added > 0 ? `${added} new` : null,
    updated > 0 ? `${updated} updated` : null,
    removed > 0 ? `${removed} removed` : null,
  ].filter(Boolean)
  return changes.length > 0 ? changes.join(', ') : 'no changes found'
}

// Resumo do Rescan all clicado: o que mudou no índice e as pastas que falharam.
function rescanNotice(summary: RescanSummary | null): string {
  if (!summary) return 'Rescan all could not finish.'
  const stillScanning =
    summary.stillScanning > 0
      ? ` ${summary.stillScanning} folder${summary.stillScanning === 1 ? ' was' : 's were'} still being scanned.`
      : ''
  const result = `Folders rescanned: ${changesText(summary)}.${stillScanning}`
  if (summary.failures.length === 0) return result
  return `${result} Failed: ${summary.failures.map((f) => `${f.name} (${f.error})`).join('; ')}.`
}

// Resultado do "Rescan" de uma pasta.
function folderRescanNotice(label: string, report: FolderScanReport): string {
  if (report.queued) return `${label} is already being scanned. It will be checked again right after.`
  if (report.error) return `${label}: ${report.error}.`
  return `${label} rescanned: ${changesText(report)}.`
}

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// O Monet fica dias na bandeja: "5 min ago", "today 14:32", "yesterday 14:32".
function relativeTime(ms: number, now: number): string {
  const diff = now - ms
  if (diff < 60_000) return 'just now'
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (ms >= today.getTime()) return `today ${clockTime(ms)}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (ms >= yesterday.getTime()) return `yesterday ${clockTime(ms)}`
  return `${new Date(ms).toLocaleDateString()} ${clockTime(ms)}`
}

interface UsedInPopoverProps {
  anchor: HTMLElement
  notebooks: Notebook[]
  checkedIds: ReadonlySet<string>
  ownerId: string | null
  onToggle: (notebookId: string, visible: boolean) => void
  onClose: () => void
}

// Caixas por caderno, presas ao botão da coluna "Used in".
function UsedInPopover({ anchor, notebooks, checkedIds, ownerId, onToggle, onClose }: UsedInPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [anchor, onClose])

  const rect = anchor.getBoundingClientRect()
  const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 300))
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 268))
  return createPortal(
    <div ref={ref} className={styles.popover} style={{ top, left }} role="dialog" aria-label="Use in notebooks">
      <p className={styles.popoverTitle}>Use in notebooks</p>
      {notebooks.length === 0 ? (
        <p className={styles.muted}>No notebooks yet.</p>
      ) : (
        <ul className={styles.popoverList}>
          {notebooks.map((nb) => {
            const own = nb.id === ownerId
            return (
              <li key={nb.id}>
                <label className={styles.popoverItem} title={own ? 'These are this notebook’s own notes.' : undefined}>
                  <input
                    type="checkbox"
                    checked={own || checkedIds.has(nb.id)}
                    disabled={own}
                    onChange={(e) => onToggle(nb.id, e.target.checked)}
                  />
                  <span className={styles.popoverName}>{nb.name}</span>
                  {own && <span className={styles.popoverOwn}>its notes</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}
      <p className={styles.popoverHint}>Checked notebooks search it in their chat and /commands.</p>
    </div>,
    document.body,
  )
}

interface AddedDoc {
  id: string
  name: string
}

interface AddedNotice {
  // Só os documentos que a caixa liga e desliga (ver offerActiveNotebook).
  docs: AddedDoc[]
  label: string
  // Caderno ativo, ligado ao adicionar; null sem caderno aberto.
  notebookId: string | null
  checked: boolean
}

export function KnowledgeBaseModal({
  open,
  onClose,
  onFolderErrorsChange,
  hasApiKey,
  onOpenSettings,
  notebooks,
  activeNotebookId,
}: KnowledgeBaseModalProps) {
  const { documents, loading, error, refresh, upload, reindex, remove, addFolder, rescanFolder, removeFolder } = useKnowledgeBase()
  const { confirm: askConfirm, modal: confirmModal } = useConfirm()
  // O modal fica montado com open=false: uma confirmação aberta ao fechar
  // resolve como cancel e não reaparece ao reabrir.
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null)
  const [aliasDraft, setAliasDraft] = useState('')
  // O blur e o Enter/Escape não gravam duas vezes.
  const aliasDoneRef = useRef(false)
  const [outdated, setOutdated] = useState<IndexOutdatedCount | null>(null)
  const [reindexProgress, setReindexProgress] = useState<ReindexProgressEvent | null>(null)
  const [rescanProgress, setRescanProgress] = useState<RescanProgressEvent | null>(null)
  // O aviso de conclusão sai só do Rescan all clicado; o do foco e o do boot
  // são silenciosos.
  const manualRescanRef = useRef(false)
  // Erro do Rescan all, no rodapé ao lado do botão.
  const [rescanError, setRescanError] = useState<string | null>(null)
  // Fim do último Rescan all (clique, foco ou boot).
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // Pastas com "Rescan" clicado ainda em curso: a rodada sem mudança não passa
  // por 'indexing'.
  const [scanningIds, setScanningIds] = useState<ReadonlySet<string>>(() => new Set())
  const [indexNotice, setIndexNotice] = useState<string | null>(null)
  // documento → cadernos que o usam (linhas explícitas de visibilidade).
  const [visibility, setVisibility] = useState<ReadonlyMap<string, ReadonlySet<string>>>(() => new Map())
  const [usedInOpen, setUsedInOpen] = useState<{ docId: string; anchor: HTMLElement } | null>(null)
  const [addedNotice, setAddedNotice] = useState<AddedNotice | null>(null)

  const recountOutdated = useCallback(() => {
    documentsIndexOutdatedCount()
      .then(setOutdated)
      .catch((e) => console.warn('documents_index_outdated_count failed', e))
  }, [])

  const loadVisibility = useCallback(() => {
    documentsListVisibility()
      .then((rows) => {
        const map = new Map<string, Set<string>>()
        for (const row of rows) {
          const set = map.get(row.documentId) ?? new Set<string>()
          set.add(row.notebookId)
          map.set(row.documentId, set)
        }
        setVisibility(map)
      })
      .catch((e) => console.warn('documents_list_visibility failed', e))
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

  // Rescan all (clique, foco ou boot), ouvido também com o modal fechado.
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false
    onRescanProgress((p) => {
      if (p.finished) {
        setRescanProgress(null)
        setLastChecked(Date.now())
        if (manualRescanRef.current) {
          manualRescanRef.current = false
          setIndexNotice(rescanNotice(p.summary))
        }
        recountOutdated()
      } else {
        setRescanProgress(p)
      }
    })
      .then((un) => {
        if (cancelled) un()
        else unlisten = un
      })
      .catch((e) => console.error('failed to listen documents://rescan-progress', e))
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

  // Visibilidade ao abrir e a cada mudança (aqui, no Documents ou no chat).
  useEffect(() => {
    if (!open) return
    loadVisibility()
    window.addEventListener(NOTEBOOK_VISIBILITY_CHANGED_EVENT, loadVisibility)
    return () => window.removeEventListener(NOTEBOOK_VISIBILITY_CHANGED_EVENT, loadVisibility)
  }, [open, loadVisibility])

  // Com uma confirmação aberta, o Escape é dela (o ConfirmModal o consome);
  // com o popover aberto, fecha só o popover.
  const usedInIsOpen = usedInOpen !== null
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || confirmOpen) return
      if (usedInIsOpen) setUsedInOpen(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, confirmOpen, usedInIsOpen])

  useEffect(() => {
    if (!open) {
      settleConfirmRef.current?.(false)
      setUploadError(null)
      setRescanError(null)
      setUploading(false)
      setFilter('')
      setEditingAliasId(null)
      setIndexNotice(null)
      setUsedInOpen(null)
      setAddedNotice(null)
    }
  }, [open])

  // "Last checked" ao abrir; depois, o fim de cada rodada pelo evento.
  useEffect(() => {
    if (!open) return
    documentsLastFoldersCheck()
      .then((ms) => {
        if (ms !== null) setLastChecked(ms)
      })
      .catch((e) => console.warn('documents_last_folders_check failed', e))
  }, [open])

  // O tempo relativo do "Last checked" anda com o modal aberto.
  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [open])

  const watchedFolders = documents.filter((d) => d.docType === 'folder' && d.origin !== 'notes')
  // Pasta monitorada em erro acende o ícone da KB (o aviso de item ilegível
  // não conta: a pasta segue 'available').
  const folderErrorCount = watchedFolders.filter((f) => f.status === 'error').length
  useEffect(() => {
    onFolderErrorsChange(folderErrorCount)
  }, [folderErrorCount, onFolderErrorsChange])

  const closeUsedIn = useCallback(() => setUsedInOpen(null), [])

  if (!open) return null

  const activeNotebook = activeNotebookId ? (notebooks.find((n) => n.id === activeNotebookId) ?? null) : null

  // Liga ou desliga cada documento sem parar na 1ª falha. Devolve os que
  // mudaram; os que falharam vão ao erro, somados aos do upload.
  async function setVisibilityEach(notebookId: string, docs: AddedDoc[], visible: boolean): Promise<AddedDoc[]> {
    const done: AddedDoc[] = []
    const failed: string[] = []
    for (const doc of docs) {
      try {
        await setNotebookDocumentVisibility(notebookId, doc.id, visible)
        done.push(doc)
      } catch (e) {
        failed.push(docs.length > 1 ? `${doc.name}: ${errorText(e)}` : errorText(e))
      }
    }
    if (failed.length > 0) {
      const notebookName = notebooks.find((n) => n.id === notebookId)?.name ?? 'the notebook'
      const head = visible ? `Could not use it in ${notebookName}:` : `Could not stop using it in ${notebookName}:`
      const message = [head, ...failed].join('\n')
      setUploadError((prev) => (prev ? `${prev}\n${message}` : message))
    }
    return done
  }

  // Recém-adicionado vale já no caderno ativo. O aviso cobre só os que foram
  // ligados de fato, então a caixa desfaz só esses; sem nenhum ligado, ela
  // fica desmarcada e tenta de novo com todos.
  async function offerActiveNotebook(docs: AddedDoc[], label: string) {
    if (!activeNotebook) {
      setAddedNotice({ docs, label, notebookId: null, checked: false })
      return
    }
    const linked = await setVisibilityEach(activeNotebook.id, docs, true)
    if (linked.length === 0) {
      setAddedNotice({ docs, label, notebookId: activeNotebook.id, checked: false })
      return
    }
    const missed = docs.length - linked.length
    setAddedNotice({
      docs: linked,
      label: missed > 0 ? `${label} ${missed} could not be linked.` : label,
      notebookId: activeNotebook.id,
      checked: true,
    })
  }

  // A caixa marcada quer dizer "todos ligados": numa falha parcial ela fica
  // desmarcada, e o erro diz quais não mudaram.
  async function toggleAddedNotice(checked: boolean) {
    if (!addedNotice?.notebookId) return
    const { notebookId, docs } = addedNotice
    setAddedNotice({ ...addedNotice, checked })
    const done = await setVisibilityEach(notebookId, docs, checked)
    if (done.length < docs.length) setAddedNotice({ ...addedNotice, checked: false })
  }

  async function handleToggleVisibility(docId: string, notebookId: string, visible: boolean) {
    setUploadError(null)
    const apply = (on: boolean) =>
      setVisibility((prev) => {
        const next = new Map(prev)
        const set = new Set(next.get(docId) ?? [])
        if (on) set.add(notebookId)
        else set.delete(notebookId)
        next.set(docId, set)
        return next
      })
    apply(visible)
    try {
      await setNotebookDocumentVisibility(notebookId, docId, visible)
    } catch (e) {
      apply(!visible)
      setUploadError(errorText(e))
    }
  }

  // Seleção múltipla: um upload por arquivo, na ordem; os que falham vão ao erro.
  async function handleUpload() {
    setUploadError(null)
    setAddedNotice(null)
    let paths: string[]
    try {
      paths = await pickDocumentFiles()
    } catch (e) {
      setUploadError(errorText(e))
      return
    }
    if (paths.length === 0) return
    setUploading(true)
    const added: AddedDoc[] = []
    const errors: string[] = []
    for (const path of paths) {
      try {
        added.push({ id: await upload(path), name: fileName(path) })
      } catch (e) {
        errors.push(paths.length > 1 ? `${fileName(path)}: ${errorText(e)}` : errorText(e))
      }
    }
    setUploading(false)
    if (errors.length > 0) setUploadError(errors.join('\n'))
    if (added.length > 0) {
      await offerActiveNotebook(added, added.length === 1 ? 'Added.' : `Added ${added.length} documents.`)
    }
  }

  async function handleRemove(doc: Document) {
    const ok = await confirm(
      `Remove "${doc.name}" from the Knowledge Base? Notebooks and chat folders stop using it. Your original file is not changed.`,
      { title: 'Remove document', confirmLabel: 'Remove document' },
    )
    if (!ok) return
    try {
      await remove(doc.id)
    } catch (e) {
      setUploadError(errorText(e))
    }
  }

  async function handleReindex(doc: Document) {
    try {
      await reindex(doc.id)
    } catch (e) {
      setUploadError(errorText(e))
    }
  }

  async function handleUpdateIndex() {
    setUploadError(null)
    setIndexNotice(null)
    try {
      await documentsReindexOutdated()
    } catch (e) {
      setUploadError(errorText(e))
    }
  }

  async function handleAddFolder() {
    setUploadError(null)
    setAddedNotice(null)
    let pickedPath: string | null = null
    try {
      pickedPath = await pickDocumentFolder()
    } catch (e) {
      setUploadError(errorText(e))
      return
    }
    if (!pickedPath) return
    setUploading(true)
    let id: string | null = null
    try {
      id = await addFolder(pickedPath)
    } catch (e) {
      setUploadError(errorText(e))
    } finally {
      setUploading(false)
    }
    if (id) await offerActiveNotebook([{ id, name: fileName(pickedPath) }], 'Folder added.')
  }

  async function handleRescanAll() {
    setRescanError(null)
    setIndexNotice(null)
    manualRescanRef.current = true
    // Trava o duplo clique antes do 1º evento de progresso.
    setRescanProgress({
      done: 0,
      total: watchedFolders.length,
      failed: 0,
      currentName: null,
      finished: false,
      automatic: false,
      summary: null,
    })
    try {
      await documentsRescanAllWatchedFolders()
    } catch (e) {
      manualRescanRef.current = false
      setRescanProgress(null)
      setRescanError(errorText(e))
    }
  }

  async function handleRescanFolder(folder: Document) {
    setUploadError(null)
    setIndexNotice(null)
    setScanningIds((prev) => new Set(prev).add(folder.id))
    try {
      const report = await rescanFolder(folder.id)
      setIndexNotice(folderRescanNotice(folder.alias ?? folder.name, report))
    } catch (e) {
      setUploadError(errorText(e))
    } finally {
      setScanningIds((prev) => {
        const next = new Set(prev)
        next.delete(folder.id)
        return next
      })
    }
  }

  function startEditAlias(folder: Document) {
    aliasDoneRef.current = false
    setEditingAliasId(folder.id)
    setAliasDraft(folder.alias ?? '')
  }

  // Enter e blur gravam; Escape descarta.
  async function finishAlias(folder: Document, save: boolean) {
    if (aliasDoneRef.current) return
    aliasDoneRef.current = true
    setEditingAliasId(null)
    const alias = aliasDraft.trim() || null
    if (!save || alias === (folder.alias ?? null)) return
    try {
      await documentsSetFolderAlias(folder.id, alias)
      await refresh()
    } catch (e) {
      setUploadError(errorText(e))
    }
  }

  async function handleRemoveFolder(folder: Document) {
    const label = folder.alias ?? folder.name
    const ok =
      folder.origin === 'ai'
        ? await confirm(
            `Delete "${label}"? The AI created this folder for a chat folder, and its saved pages are deleted from disk.`,
            { title: 'Delete folder and files', confirmLabel: 'Delete folder and files' },
          )
        : await confirm(
            `Remove "${label}" from the Knowledge Base? Notebooks and chat folders stop using its files. Your files on disk are not changed.`,
            { title: 'Remove from Knowledge Base', confirmLabel: 'Remove from Knowledge Base' },
          )
    if (!ok) return
    try {
      await removeFolder(folder.id)
    } catch (e) {
      setUploadError(errorText(e))
    }
  }

  async function handleRemoveOrphans() {
    const n = orphanFolders.length
    const names = orphanFolders.map((f) => `"${f.alias ?? f.name}"`).join(', ')
    const ok = await confirm(
      `Delete ${n} orphan web folder${n === 1 ? '' : 's'}? The chat folders that saved them no longer exist, and their saved pages are deleted from disk: ${names}.`,
      { title: 'Delete folders and files', confirmLabel: 'Delete folders and files' },
    )
    if (!ok) return
    for (const folder of orphanFolders) {
      try {
        await documentsDeleteWatchedFolder(folder.id)
      } catch (e) {
        setUploadError(errorText(e))
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
  // Por que o "Rescan" e o "Rescan all" estão travados.
  const rescanBusyTitle = rescanProgress
    ? rescanProgress.automatic
      ? 'Automatic check in progress'
      : 'Rescan all in progress'
    : undefined
  const standaloneFiles = documents.filter(
    (d) => d.docType === 'file' && !d.parentFolderId && documentMatchesFilter(d, filter),
  )
  const notebookIds = new Set(notebooks.map((n) => n.id))

  // Cadernos que usam o documento: as linhas explícitas e, na pasta de notas,
  // o caderno dono.
  function usedInIds(doc: Document): Set<string> {
    const ids = new Set([...(visibility.get(doc.id) ?? [])].filter((id) => notebookIds.has(id)))
    const owner = notesFolderOwner(doc)
    if (owner && notebookIds.has(owner)) ids.add(owner)
    return ids
  }

  function renderUsedIn(doc: Document) {
    const ids = usedInIds(doc)
    const first = ids.size === 1 ? (notebooks.find((n) => ids.has(n.id))?.name ?? null) : null
    const label = ids.size === 0 ? 'Not used' : ids.size === 1 ? (first ?? '1 notebook') : `${ids.size} notebooks`
    const isOpen = usedInOpen?.docId === doc.id
    const chatNote =
      doc.origin === 'ai' && !orphanIds.has(doc.id) ? ' Its chat folder also uses it.' : ''
    return (
      <button
        type="button"
        className={ids.size === 0 ? styles.usedInNone : styles.usedIn}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={`Choose the notebooks that use it.${chatNote}`}
        onClick={(e) => {
          const anchor = e.currentTarget
          setUsedInOpen(isOpen ? null : { docId: doc.id, anchor })
        }}
      >
        <span className={styles.usedInText}>{label}</span>
      </button>
    )
  }

  const usedInDoc = usedInOpen ? documents.find((d) => d.id === usedInOpen.docId) : undefined
  const addedNotebookName = addedNotice?.notebookId
    ? (notebooks.find((n) => n.id === addedNotice.notebookId)?.name ?? null)
    : null

  return createPortal(
    <>
      {confirmOpen && confirmModal}
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
              aria-label="Close"
              title="Close"
            >
              <X size={16} aria-hidden />
            </button>
          </header>

          <div className={styles.body} onScroll={closeUsedIn}>
            {!hasApiKey && (
              <div className={styles.keyBanner} role="status">
                <span>
                  Add your OpenRouter key to index documents. Without it, new documents and folders fail to index.
                </span>
                <button className={styles.secondary} type="button" onClick={onOpenSettings}>
                  Open Settings
                </button>
              </div>
            )}
            {rescanProgress && (
              <div className={styles.indexBanner} role="status">
                <div className={styles.indexBannerRow}>
                  <span>
                    {rescanProgress.automatic ? 'Checking folders for changes' : 'Rescanning folders'}:{' '}
                    {rescanProgress.done}/{rescanProgress.total}
                    {rescanProgress.failed > 0 && ` (${rescanProgress.failed} failed)`}
                  </span>
                  {rescanProgress.currentName && (
                    <span className={styles.indexCurrent} title={rescanProgress.currentName}>
                      {rescanProgress.currentName}
                    </span>
                  )}
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${rescanProgress.total > 0 ? (rescanProgress.done / rescanProgress.total) * 100 : 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
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
            {addedNotice && (
              <div className={styles.addedBanner} role="status">
                {addedNotice.notebookId && addedNotebookName ? (
                  <label className={styles.addedLabel}>
                    <span>{addedNotice.label} Use it in:</span>
                    <input
                      type="checkbox"
                      checked={addedNotice.checked}
                      onChange={(e) => void toggleAddedNotice(e.target.checked)}
                    />
                    <span className={styles.addedNotebook}>{addedNotebookName}</span>
                  </label>
                ) : (
                  <span>
                    {addedNotice.label} Choose the notebooks that use it in the Used in column.
                  </span>
                )}
                <button
                  className={styles.bannerClose}
                  type="button"
                  onClick={() => setAddedNotice(null)}
                  aria-label="Dismiss"
                  title="Dismiss"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
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
                  Add PDF, TXT or Markdown files, or a folder of them. Then choose the notebooks that use each
                  one as AI context.
                </p>
                <div className={styles.emptyActions}>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    <Plus size={12} aria-hidden />
                    {uploading ? 'Uploading…' : 'Add documents'}
                  </button>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleAddFolder}
                    disabled={uploading}
                  >
                    <Plus size={12} aria-hidden />
                    Add folder
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
                    <th className={styles.colUsedIn}>Used in</th>
                    <th className={styles.colActions}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder) => {
                    const childCount = documents.filter((d) => d.parentFolderId === folder.id).length
                    const scanning = folder.status === 'indexing' || scanningIds.has(folder.id)
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
                                  if (e.key === 'Enter') void finishAlias(folder, true)
                                  if (e.key === 'Escape') {
                                    e.stopPropagation()
                                    void finishAlias(folder, false)
                                  }
                                }}
                                onBlur={() => void finishAlias(folder, true)}
                                placeholder={folder.name}
                                aria-label={`Alias for folder ${folder.name}`}
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
                                    aria-label={`Edit alias of folder ${folder.name}`}
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
                          {/* Item ilegível na pasta: aviso, a pasta segue disponível. */}
                          {folder.status === 'available' && folder.errorMessage && (
                            <span className={styles.warnMsg} title={folder.errorMessage}>
                              {folder.errorMessage}
                            </span>
                          )}
                        </td>
                        <td className={styles.cellCount}>{childCount}</td>
                        <td className={styles.cellUsedIn}>{renderUsedIn(folder)}</td>
                        <td className={styles.cellActions}>
                          {folder.origin !== 'notes' && (
                            <>
                              <button
                                className={styles.secondary}
                                type="button"
                                onClick={() => handleRescanFolder(folder)}
                                disabled={scanning || rescanProgress !== null}
                                title={rescanBusyTitle}
                              >
                                {scanning ? 'Scanning…' : 'Rescan'}
                              </button>
                              <button
                                className={styles.danger}
                                type="button"
                                onClick={() => handleRemoveFolder(folder)}
                                aria-label={`${folder.origin === 'ai' ? 'Delete' : 'Remove'} folder ${folder.alias ?? folder.name}`}
                              >
                                {folder.origin === 'ai' ? 'Delete' : 'Remove'}
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
                      <td className={styles.cellUsedIn}>{renderUsedIn(doc)}</td>
                      <td className={styles.cellActions}>
                        {doc.status === 'error' && (
                          <button
                            className={styles.secondary}
                            type="button"
                            onClick={() => handleReindex(doc)}
                          >
                            Retry
                          </button>
                        )}
                        <button
                          className={styles.danger}
                          type="button"
                          onClick={() => handleRemove(doc)}
                          aria-label={`Remove ${doc.name}`}
                        >
                          Remove
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
            {rescanError ? (
              <p className={styles.errorText} role="alert">
                {rescanError}
              </p>
            ) : (
              <p className={styles.footerHint}>
                <span>Documents: PDF, TXT or Markdown.</span>
                <span>
                  {watchedFolders.length > 0
                    ? `${
                        hasApiKey
                          ? 'Watched folders are checked when you return to Monet'
                          : 'Add your OpenRouter key in Settings to check watched folders'
                      }${lastChecked !== null ? ` · Last checked ${relativeTime(lastChecked, now)}` : ''}`
                    : 'Indexing requires an internet connection.'}
                </span>
              </p>
            )}
            {documents.length > 0 && (
              <div className={styles.footerActions}>
                {orphanFolders.length > 0 && (
                  <button className={styles.secondary} type="button" onClick={handleRemoveOrphans}>
                    Delete orphan web folders ({orphanFolders.length})
                  </button>
                )}
                {watchedFolders.length > 0 && (
                  <button
                    className={styles.secondary}
                    type="button"
                    onClick={handleRescanAll}
                    disabled={rescanProgress !== null}
                    title={rescanBusyTitle}
                  >
                    {rescanProgress && !rescanProgress.automatic ? 'Rescanning…' : 'Rescan all'}
                  </button>
                )}
                <button
                  className={styles.primary}
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  title="PDF, TXT or Markdown"
                >
                  <Plus size={12} aria-hidden />
                  {uploading ? 'Uploading…' : 'Add documents'}
                </button>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={handleAddFolder}
                  disabled={uploading}
                >
                  <Plus size={12} aria-hidden />
                  Add folder
                </button>
              </div>
            )}
          </footer>
        </div>
      </div>
      {usedInOpen && usedInDoc && (
        <UsedInPopover
          anchor={usedInOpen.anchor}
          notebooks={notebooks}
          checkedIds={visibility.get(usedInDoc.id) ?? new Set()}
          ownerId={notesFolderOwner(usedInDoc)}
          onToggle={(notebookId, visible) => void handleToggleVisibility(usedInDoc.id, notebookId, visible)}
          onClose={closeUsedIn}
        />
      )}
    </>,
    document.body,
  )
}
