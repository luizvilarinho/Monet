import { useState } from 'react'
import { CaretDown, PencilSimple, Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { useTasksEnv } from './TasksEnv'
import { TASK_VIEWS, type TasksMainView } from './views'
import styles from './ViewMenu.module.css'

// Dropdown de visões ao lado do título "Tasks": visões built-in, visões salvas
// (renomear/excluir) e "Save current view…".
interface ViewMenuProps {
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
}

export function ViewMenu({ mainView, onMainViewChange }: ViewMenuProps) {
  const { savedViews, activeSavedViewId, onApplyView, onSaveView, onRenameView, onDeleteView } =
    useTasksEnv()
  const { confirm, modal } = useConfirm()
  const [open, setOpen] = useState(false)
  // Edição inline: 'new' = salvar a visão atual; id = renomear.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const activeSaved = savedViews.find((v) => v.id === activeSavedViewId) ?? null
  const label = activeSaved?.name ?? TASK_VIEWS.find((v) => v.id === mainView)?.label ?? 'List'

  function close() {
    setOpen(false)
    setEditing(null)
  }

  function commit() {
    const name = draft.trim()
    if (name) {
      if (editing === 'new') onSaveView(name)
      else if (editing) onRenameView(editing, name)
    }
    setEditing(null)
    setDraft('')
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm(`Delete saved view "${name}"?`, {
      title: 'Delete saved view',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (ok) onDeleteView(id)
  }

  return (
    <span
      className={styles.wrap}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close()
      }}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="view"
      >
        {label}
        <CaretDown size={10} weight="bold" aria-hidden />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {TASK_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="menuitemradio"
              aria-checked={!activeSaved && mainView === v.id}
              className={`${styles.item} ${!activeSaved && mainView === v.id ? styles.itemActive : ''}`}
              title={v.title}
              onClick={() => {
                onMainViewChange(v.id)
                close()
              }}
            >
              {v.label}
            </button>
          ))}
          {savedViews.length > 0 && <div className={styles.group}>Saved</div>}
          {savedViews.map((v) =>
            editing === v.id ? (
              <input
                key={v.id}
                className={styles.input}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setEditing(null)
                }}
                aria-label="view name"
              />
            ) : (
              <div key={v.id} className={styles.savedRow}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={v.id === activeSavedViewId}
                  className={`${styles.item} ${v.id === activeSavedViewId ? styles.itemActive : ''}`}
                  onClick={() => {
                    onApplyView(v)
                    close()
                  }}
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`rename ${v.name}`}
                  onClick={() => {
                    setEditing(v.id)
                    setDraft(v.name)
                  }}
                >
                  <PencilSimple size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`delete ${v.name}`}
                  onClick={() => void handleDelete(v.id, v.name)}
                >
                  <Trash size={12} aria-hidden />
                </button>
              </div>
            )
          )}
          <div className={styles.divider} />
          {editing === 'new' ? (
            <input
              className={styles.input}
              value={draft}
              autoFocus
              placeholder="View name…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(null)
              }}
              aria-label="view name"
            />
          ) : (
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                setEditing('new')
                setDraft('')
              }}
            >
              Save current view…
            </button>
          )}
        </div>
      )}
      {modal}
    </span>
  )
}
