import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Brain, FileText, SidebarSimple } from '@phosphor-icons/react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useConfirm } from '../../hooks/useConfirm'
import type { ChatConversation, ChatFolder } from '../../hooks/useChat'
import { ASSISTANT_FOLDER_NAME } from '../../hooks/useChat'
import styles from './ChatSidebar.module.css'

export interface ChatSidebarProps {
  conversations: ChatConversation[]
  folders: ChatFolder[]
  looseConversationIds: string[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  onCreateFolder: () => string
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onToggleFolderExpanded: (id: string, expanded: boolean) => void
  onNewConversationInFolder: (folderId: string) => void
  onMoveConversation: (
    convId: string,
    target:
      | { type: 'loose'; index?: number }
      | { type: 'folder'; folderId: string; index?: number }
  ) => void
  onRemoveConversationFromFolder: (convId: string) => void
  onReorderFolders: (newOrder: string[]) => void
  onReorderInFolder: (folderId: string, newOrder: string[]) => void
  onReorderLoose: (newOrder: string[]) => void
  onOpenFolderSystemPrompt: (folder: ChatFolder) => void
  onOpenFolderMemory: (folder: ChatFolder) => void
  onOpenFolderDocuments: (folder: ChatFolder) => void
  width: number
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onWidthChange: (w: number) => void
}

const MIN_WIDTH = 180
const MAX_WIDTH = 480

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
    aria-hidden="true"
  >
    <polyline points="6 3.5 10.5 8 6 12.5" />
  </svg>
)

const FolderIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 4.5a1 1 0 0 1 1-1h3.5l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5z" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="3" y1="8" x2="13" y2="8" />
  </svg>
)

const RemoveFromFolderIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {/* arrow exiting a small box */}
    <path d="M9 3h-5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h5" />
    <polyline points="11 5 14 8 11 11" />
    <line x1="6" y1="8" x2="14" y2="8" />
  </svg>
)

// Icone de "system prompt" / configuracao de IA na pasta — sparkle estilizado.
const SystemPromptIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 1.5l1.4 3.6L13 6.5l-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4L8 1.5z" />
    <path d="M12.5 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z" />
  </svg>
)

type ActiveDragKind = 'folder' | 'conv' | null

export function ChatSidebar({
  conversations,
  folders,
  looseConversationIds,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRenameConversation,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolderExpanded,
  onNewConversationInFolder,
  onMoveConversation,
  onRemoveConversationFromFolder,
  onReorderFolders,
  onReorderInFolder,
  onReorderLoose,
  onOpenFolderSystemPrompt,
  onOpenFolderMemory,
  onOpenFolderDocuments,
  width,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
}: ChatSidebarProps) {
  const { confirm, modal } = useConfirm()
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const editingInputRef = useRef<HTMLInputElement>(null)
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingConvName, setEditingConvName] = useState('')
  const convEditingInputRef = useRef<HTMLInputElement>(null)
  const [activeDragKind, setActiveDragKind] = useState<ActiveDragKind>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = width
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      currentWidthRef.current = next
      onWidthChange(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('monet:chat-sidebar-width', String(currentWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWidthChange])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const conversationById = useMemo(() => {
    const map = new Map<string, ChatConversation>()
    for (const c of conversations) map.set(c.id, c)
    return map
  }, [conversations])

  const folderIds = useMemo(() => folders.map((f) => `folder:${f.id}`), [folders])

  // Auto-foco no input quando entra em modo edicao
  useEffect(() => {
    if (editingFolderId && editingInputRef.current) {
      editingInputRef.current.focus()
      editingInputRef.current.select()
    }
  }, [editingFolderId])

  // Auto-foco no input quando entra em modo edicao (conversa)
  useEffect(() => {
    if (editingConvId && convEditingInputRef.current) {
      convEditingInputRef.current.focus()
      convEditingInputRef.current.select()
    }
  }, [editingConvId])

  function startCreateFolder() {
    const id = onCreateFolder()
    setEditingFolderId(id)
    setEditingFolderName('')
  }

  function commitFolderEdit() {
    if (!editingFolderId) return
    const trimmed = editingFolderName.trim()
    if (trimmed) {
      onRenameFolder(editingFolderId, trimmed)
    } else {
      // No name: BDD requires cancelling creation (and restoring name on rename).
      // Folders created with empty name are removed; rename with empty name is a no-op.
      const folder = folders.find((f) => f.id === editingFolderId)
      if (folder && folder.name.length === 0) {
        onDeleteFolder(editingFolderId)
      }
    }
    setEditingFolderId(null)
    setEditingFolderName('')
  }

  function cancelFolderEdit() {
    if (!editingFolderId) return
    const folder = folders.find((f) => f.id === editingFolderId)
    if (folder && folder.name.length === 0) {
      // Pasta criada e nunca nomeada: cancelar = remover
      onDeleteFolder(editingFolderId)
    }
    setEditingFolderId(null)
    setEditingFolderName('')
  }

  function startConvEdit(conv: ChatConversation) {
    if (editingFolderId) cancelFolderEdit()
    setEditingConvId(conv.id)
    setEditingConvName(conv.title)
  }

  function commitConvEdit() {
    if (!editingConvId) return
    const trimmed = editingConvName.trim().slice(0, 100)
    if (trimmed) {
      onRenameConversation(editingConvId, trimmed)
    }
    setEditingConvId(null)
    setEditingConvName('')
  }

  function cancelConvEdit() {
    if (!editingConvId) return
    setEditingConvId(null)
    setEditingConvName('')
  }

  async function handleDeleteFolder(folder: ChatFolder) {
    const hasConvs = folder.conversationIds.length > 0
    const message = hasConvs
      ? `Folder "${folder.name || 'unnamed'}" contains ${folder.conversationIds.length} conversation${folder.conversationIds.length === 1 ? '' : 's'}. Deleting the folder will permanently delete all conversations inside it.`
      : `Delete folder "${folder.name || 'unnamed'}"?`
    const ok = await confirm(message, {
      title: hasConvs ? 'Delete folder and conversations' : 'Delete folder',
      confirmLabel: 'delete',
    })
    if (ok) onDeleteFolder(folder.id)
  }

  // ───── DnD ─────────────────────────────────────────────────────────────

  function handleDragStart(event: { active: { id: string | number } }) {
    const id = String(event.active.id)
    if (id.startsWith('folder:')) setActiveDragKind('folder')
    else if (id.startsWith('conv:')) setActiveDragKind('conv')
    else setActiveDragKind(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragKind(null)
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    // Folder reorder
    if (activeId.startsWith('folder:') && overId.startsWith('folder:')) {
      const oldIndex = folderIds.indexOf(activeId)
      const newIndex = folderIds.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(folderIds, oldIndex, newIndex)
      onReorderFolders(reordered.map((s) => s.replace(/^folder:/, '')))
      return
    }

    // Conversation move/reorder
    if (activeId.startsWith('conv:')) {
      const convId = activeId.slice('conv:'.length)
      const sourceContainer = active.data.current?.sortable?.containerId as
        | string
        | undefined

      // Determina container destino
      let targetContainer: string | undefined
      let targetIndex: number | undefined

      if (overId.startsWith('folder:')) {
        // Drop no header de uma pasta -> entra nela. Se ja esta nela, no-op
        // (BDD: "Tentar mover conversa para a mesma pasta onde ja esta").
        if (sourceContainer === overId) return
        targetContainer = overId
        targetIndex = 0
      } else if (overId.startsWith('folder-body:')) {
        // Drop em pasta vazia/area-vazia
        targetContainer = `folder:${overId.slice('folder-body:'.length)}`
        targetIndex = undefined // fim
      } else if (overId === 'loose-body') {
        targetContainer = '__loose__'
        targetIndex = undefined // fim
      } else if (overId.startsWith('conv:')) {
        const overContainer = over.data.current?.sortable?.containerId as
          | string
          | undefined
        if (!overContainer) return
        targetContainer = overContainer
        // Indice = posicao do over no container destino
        const overConvId = overId.slice('conv:'.length)
        if (overContainer === '__loose__') {
          targetIndex = looseConversationIds.indexOf(overConvId)
        } else if (overContainer.startsWith('folder:')) {
          const fid = overContainer.slice('folder:'.length)
          const folder = folders.find((f) => f.id === fid)
          targetIndex = folder?.conversationIds.indexOf(overConvId) ?? undefined
        }
      } else {
        return
      }

      if (!targetContainer) return

      // Mesmo container -> reorder
      if (sourceContainer === targetContainer) {
        if (targetContainer === '__loose__') {
          const oldIndex = looseConversationIds.indexOf(convId)
          if (oldIndex === -1 || targetIndex === undefined) return
          if (oldIndex === targetIndex) return
          const reordered = arrayMove(
            looseConversationIds,
            oldIndex,
            targetIndex
          )
          onReorderLoose(reordered)
        } else if (targetContainer.startsWith('folder:')) {
          const fid = targetContainer.slice('folder:'.length)
          const folder = folders.find((f) => f.id === fid)
          if (!folder) return
          const oldIndex = folder.conversationIds.indexOf(convId)
          if (oldIndex === -1 || targetIndex === undefined) return
          if (oldIndex === targetIndex) return
          const reordered = arrayMove(
            folder.conversationIds,
            oldIndex,
            targetIndex
          )
          onReorderInFolder(fid, reordered)
        }
        return
      }

      // Container diferente -> mover
      if (targetContainer === '__loose__') {
        onMoveConversation(convId, { type: 'loose', index: targetIndex })
      } else if (targetContainer.startsWith('folder:')) {
        const fid = targetContainer.slice('folder:'.length)
        onMoveConversation(convId, {
          type: 'folder',
          folderId: fid,
          index: targetIndex,
        })
      }
    }
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`} aria-label="Conversations" style={{ width }}>
      {modal}
      {collapsed ? (
        <div className={styles.collapsedTop}>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={onToggleCollapsed}
            aria-label="expand conversations"
            title="expand conversations"
          >
            <SidebarSimple size={16} aria-hidden />
          </button>
        </div>
      ) : (
      <>
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={onToggleCollapsed}
          aria-label="collapse conversations"
          title="collapse conversations"
        >
          <SidebarSimple size={16} aria-hidden />
        </button>
        <button type="button" className={styles.newBtn} onClick={onNew}>
          <span className={styles.plus} aria-hidden="true">+</span>
          New conversation
        </button>
        <button
          type="button"
          className={styles.newFolderBtn}
          onClick={startCreateFolder}
          aria-label="new folder"
          title="new folder"
        >
          <FolderIcon />
          <span className={styles.plus} aria-hidden="true">+</span>
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveDragKind(null)}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.list}>
          {/* Folders */}
          <SortableContext
            id="__folders__"
            items={folderIds}
            strategy={verticalListSortingStrategy}
          >
            {folders.map((folder) => (
              <SortableFolder
                key={folder.id}
                folder={folder}
                conversationById={conversationById}
                activeId={activeId}
                editing={editingFolderId === folder.id}
                editingName={editingFolderName}
                onEditingNameChange={setEditingFolderName}
                inputRef={editingInputRef}
                onCommitEdit={commitFolderEdit}
                onCancelEdit={cancelFolderEdit}
                onStartEdit={(f) => {
                  if (editingConvId) cancelConvEdit()
                  setEditingFolderId(f.id)
                  setEditingFolderName(f.name)
                }}
                onSelectConv={onSelect}
                onDeleteConv={onDelete}
                onRemoveFromFolder={onRemoveConversationFromFolder}
                onNewConversation={() => onNewConversationInFolder(folder.id)}
                onToggleExpanded={() =>
                  onToggleFolderExpanded(folder.id, !folder.expanded)
                }
                onDeleteFolder={() => handleDeleteFolder(folder)}
                onOpenSystemPrompt={() => onOpenFolderSystemPrompt(folder)}
                onOpenFolderMemory={() => onOpenFolderMemory(folder)}
                onOpenFolderDocuments={() => onOpenFolderDocuments(folder)}
                isAnyConvDragging={activeDragKind === 'conv'}
                editingConvId={editingConvId}
                editingConvName={editingConvName}
                onEditingConvNameChange={setEditingConvName}
                convEditingInputRef={convEditingInputRef}
                onCommitConvEdit={commitConvEdit}
                onCancelConvEdit={cancelConvEdit}
                onStartConvEdit={startConvEdit}
              />
            ))}
          </SortableContext>

          {/* Loose conversations */}
          {(looseConversationIds.length > 0 || folders.length > 0) && (
            <div className={styles.looseLabel}>conversations</div>
          )}
          <SortableContext
            id="__loose__"
            items={looseConversationIds.map((id) => `conv:${id}`)}
            strategy={verticalListSortingStrategy}
          >
            {looseConversationIds.length === 0 && folders.length === 0 ? (
              <p className={styles.empty}>
                No conversations yet. Create one to get started.
              </p>
            ) : (
              looseConversationIds.map((cid) => {
                const conv = conversationById.get(cid)
                if (!conv) return null
                return (
                  <SortableConversation
                    key={cid}
                    conv={conv}
                    isActive={cid === activeId}
                    inFolder={false}
                    editing={editingConvId === cid}
                    editingName={editingConvName}
                    onEditingNameChange={setEditingConvName}
                    inputRef={convEditingInputRef}
                    onCommitEdit={commitConvEdit}
                    onCancelEdit={cancelConvEdit}
                    onStartEdit={startConvEdit}
                    onSelect={() => onSelect(cid)}
                    onDelete={() => onDelete(cid)}
                  />
                )
              })
            )}
            <LooseDropZone active={activeDragKind === 'conv'} />
          </SortableContext>
        </div>
      </DndContext>
      </>
      )}
    </aside>
  )
}

// ─── Sortable Folder ─────────────────────────────────────────────────────────

interface SortableFolderProps {
  folder: ChatFolder
  conversationById: Map<string, ChatConversation>
  activeId: string | null
  editing: boolean
  editingName: string
  onEditingNameChange: (v: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onCommitEdit: () => void
  onCancelEdit: () => void
  onStartEdit: (folder: ChatFolder) => void
  onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void
  onRemoveFromFolder: (convId: string) => void
  onNewConversation: () => void
  onToggleExpanded: () => void
  onDeleteFolder: () => void
  onOpenSystemPrompt: () => void
  onOpenFolderMemory: () => void
  onOpenFolderDocuments: () => void
  isAnyConvDragging: boolean
  editingConvId: string | null
  editingConvName: string
  onEditingConvNameChange: (v: string) => void
  convEditingInputRef: React.RefObject<HTMLInputElement | null>
  onCommitConvEdit: () => void
  onCancelConvEdit: () => void
  onStartConvEdit: (conv: ChatConversation) => void
}

function SortableFolder({
  folder,
  conversationById,
  activeId,
  editing,
  editingName,
  onEditingNameChange,
  inputRef,
  onCommitEdit,
  onCancelEdit,
  onStartEdit,
  onSelectConv,
  onDeleteConv,
  onRemoveFromFolder,
  onNewConversation,
  onToggleExpanded,
  onDeleteFolder,
  onOpenSystemPrompt,
  onOpenFolderMemory,
  onOpenFolderDocuments,
  isAnyConvDragging,
  editingConvId,
  editingConvName,
  onEditingConvNameChange,
  convEditingInputRef,
  onCommitConvEdit,
  onCancelConvEdit,
  onStartConvEdit,
}: SortableFolderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    over,
  } = useSortable({
    id: `folder:${folder.id}`,
    data: { type: 'folder' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  // Drop visual: quando uma conversa esta sendo arrastada por cima do header
  const showDropHighlight =
    isOver && over && String(over.id) === `folder:${folder.id}` &&
    /* nao reagir a drag de pasta sobre pasta */
    isAnyConvDragging

  return (
    <div className={styles.folder} ref={setNodeRef} style={style}>
      <div
        className={`${styles.folderHeader} ${showDropHighlight ? styles.folderHeaderDropOver : ''}`}
        onClick={() => {
          if (editing) return
          onToggleExpanded()
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return
          if (folder.name === ASSISTANT_FOLDER_NAME) return
          onStartEdit(folder)
        }}
        {...attributes}
        {...listeners}
      >
        <span
          className={styles.folderChevron}
          aria-label={folder.expanded ? 'collapse folder' : 'expand folder'}
        >
          <ChevronIcon open={folder.expanded} />
        </span>
        {editing ? (
          <input
            ref={inputRef}
            className={styles.folderRenameInput}
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onCommitEdit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancelEdit()
              }
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="folder name"
            aria-label="folder name"
          />
        ) : (
          <span className={styles.folderName}>
            {folder.name || 'unnamed'}
          </span>
        )}
        {!editing && (
          <>
            <button
              type="button"
              className={`${styles.folderSysPromptBtn} ${
                folder.visibleDocumentIds.length > 0
                  ? styles.folderSysPromptBtnActive
                  : ''
              }`}
              onClick={(e) => {
                e.stopPropagation()
                onOpenFolderDocuments()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`configure documents for ${folder.name || 'folder'}`}
              title={
                folder.visibleDocumentIds.length > 0
                  ? `${folder.visibleDocumentIds.length} document(s) active (click to edit)`
                  : 'select knowledge base documents for this folder'
              }
            >
              <FileText size={12} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.folderSysPromptBtn} ${
                folder.systemPrompt.trim().length > 0
                  ? styles.folderSysPromptBtnActive
                  : ''
              }`}
              onClick={(e) => {
                e.stopPropagation()
                onOpenSystemPrompt()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`configure system prompt for ${folder.name || 'folder'}`}
              title={
                folder.systemPrompt.trim().length > 0
                  ? 'system prompt active (click to edit)'
                  : 'set folder system prompt'
              }
            >
              <SystemPromptIcon />
            </button>
            <button
              type="button"
              className={`${styles.folderSysPromptBtn} ${
                folder.memory.trim().length > 0
                  ? styles.folderSysPromptBtnActive
                  : ''
              }`}
              onClick={(e) => {
                e.stopPropagation()
                onOpenFolderMemory()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`view folder memory for ${folder.name || 'folder'}`}
              title={
                folder.memory.trim().length > 0
                  ? 'folder memory active (click to view/edit)'
                  : 'view/edit folder memory'
              }
            >
              <Brain size={12} aria-hidden />
            </button>
            <span
              className={styles.folderActions}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.folderActionBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  onNewConversation()
                }}
                aria-label={`new conversation in ${folder.name || 'folder'}`}
                title="new conversation in this folder"
              >
                <PlusIcon />
              </button>
              {folder.name !== ASSISTANT_FOLDER_NAME && (
                <button
                  type="button"
                  className={`${styles.folderActionBtn} ${styles.folderActionBtnDelete}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteFolder()
                  }}
                  aria-label={`delete folder ${folder.name || ''}`}
                  title="delete folder"
                >
                  ×
                </button>
              )}
            </span>
          </>
        )}
      </div>

      {folder.expanded && (
        <FolderBody
          folder={folder}
          conversationById={conversationById}
          activeId={activeId}
          onSelectConv={onSelectConv}
          onDeleteConv={onDeleteConv}
          onRemoveFromFolder={onRemoveFromFolder}
          isAnyConvDragging={isAnyConvDragging}
          editingConvId={editingConvId}
          editingConvName={editingConvName}
          onEditingConvNameChange={onEditingConvNameChange}
          convEditingInputRef={convEditingInputRef}
          onCommitConvEdit={onCommitConvEdit}
          onCancelConvEdit={onCancelConvEdit}
          onStartConvEdit={onStartConvEdit}
        />
      )}
    </div>
  )
}

// ─── Folder body (drop zone + sortable list) ────────────────────────────────

interface FolderBodyProps {
  folder: ChatFolder
  conversationById: Map<string, ChatConversation>
  activeId: string | null
  onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void
  onRemoveFromFolder: (convId: string) => void
  isAnyConvDragging: boolean
  editingConvId: string | null
  editingConvName: string
  onEditingConvNameChange: (v: string) => void
  convEditingInputRef: React.RefObject<HTMLInputElement | null>
  onCommitConvEdit: () => void
  onCancelConvEdit: () => void
  onStartConvEdit: (conv: ChatConversation) => void
}

function FolderBody({
  folder,
  conversationById,
  activeId,
  onSelectConv,
  onDeleteConv,
  onRemoveFromFolder,
  isAnyConvDragging,
  editingConvId,
  editingConvName,
  onEditingConvNameChange,
  convEditingInputRef,
  onCommitConvEdit,
  onCancelConvEdit,
  onStartConvEdit,
}: FolderBodyProps) {
  const items = folder.conversationIds.map((id) => `conv:${id}`)
  return (
    <SortableContext
      id={`folder:${folder.id}`}
      items={items}
      strategy={verticalListSortingStrategy}
    >
      <div className={styles.folderBody}>
        {folder.conversationIds.length === 0 ? (
          <FolderEmptyDropZone folderId={folder.id} active={isAnyConvDragging} />
        ) : (
          <>
            {folder.conversationIds.map((cid) => {
              const conv = conversationById.get(cid)
              if (!conv) return null
              return (
                <SortableConversation
                  key={cid}
                  conv={conv}
                  isActive={cid === activeId}
                  inFolder
                  editing={editingConvId === cid}
                  editingName={editingConvName}
                  onEditingNameChange={onEditingConvNameChange}
                  inputRef={convEditingInputRef}
                  onCommitEdit={onCommitConvEdit}
                  onCancelEdit={onCancelConvEdit}
                  onStartEdit={onStartConvEdit}
                  onSelect={() => onSelectConv(cid)}
                  onDelete={() => onDeleteConv(cid)}
                  onRemoveFromFolder={() => onRemoveFromFolder(cid)}
                />
              )
            })}
            <FolderTailDropZone folderId={folder.id} active={isAnyConvDragging} />
          </>
        )}
      </div>
    </SortableContext>
  )
}

function FolderEmptyDropZone({
  folderId,
  active,
}: {
  folderId: string
  active: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-body:${folderId}` })
  return (
    <div
      ref={setNodeRef}
      className={
        active
          ? `${styles.folderDropZone} ${styles.folderDropZoneActive}`
          : styles.folderDropZone
      }
    >
      {!active && (
        <span className={styles.folderEmpty}>empty folder</span>
      )}
      {active && isOver && (
        <span className={styles.folderEmpty}>drop here</span>
      )}
    </div>
  )
}

function FolderTailDropZone({
  folderId,
  active,
}: {
  folderId: string
  active: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `folder-body:${folderId}` })
  return (
    <div
      ref={setNodeRef}
      className={
        active
          ? `${styles.folderDropZone} ${styles.folderDropZoneActive}`
          : styles.folderDropZone
      }
    />
  )
}

function LooseDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'loose-body' })
  return (
    <div
      ref={setNodeRef}
      className={
        active
          ? `${styles.looseDropZone} ${styles.looseDropZoneActive}`
          : styles.looseDropZone
      }
    />
  )
}

// ─── Sortable Conversation ────────────────────────────────────────────────────

interface SortableConversationProps {
  conv: ChatConversation
  isActive: boolean
  inFolder: boolean
  editing: boolean
  editingName: string
  onEditingNameChange: (v: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onCommitEdit: () => void
  onCancelEdit: () => void
  onStartEdit: (conv: ChatConversation) => void
  onSelect: () => void
  onDelete: () => void
  onRemoveFromFolder?: () => void
}

function SortableConversation({
  conv,
  isActive,
  inFolder,
  editing,
  editingName,
  onEditingNameChange,
  inputRef,
  onCommitEdit,
  onCancelEdit,
  onStartEdit,
  onSelect,
  onDelete,
  onRemoveFromFolder,
}: SortableConversationProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `conv:${conv.id}`,
    data: { type: 'conv' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const className = [
    isActive ? styles.convActive : styles.conv,
    isDragging ? styles.convDragging : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input')) return
        if (editing) return
        onStartEdit(conv)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className={styles.convRenameInput}
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onCommitEdit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancelEdit()
            }
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="conversation name"
          aria-label="conversation name"
        />
      ) : (
        <>
          <span className={styles.convTitle}>{conv.title}</span>
          <span
            className={styles.convActions}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {inFolder && onRemoveFromFolder && (
              <button
                type="button"
                className={styles.convActionBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveFromFolder()
                }}
                aria-label="remove from folder"
                title="remove from folder"
              >
                <RemoveFromFolderIcon />
              </button>
            )}
            <button
              type="button"
              className={`${styles.convActionBtn} ${styles.convActionBtnDelete}`}
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label="delete conversation"
              title="delete conversation"
            >
              ×
            </button>
          </span>
        </>
      )}
    </div>
  )
}
