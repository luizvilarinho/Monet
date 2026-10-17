import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { nanoid } from 'nanoid'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CALENDAR_NOTEBOOK_ID,
  formatCalendarTitle,
  getWeekdayName,
  parseCalendarTitle,
} from '../../lib/calendar'
import { storage } from '../../storage'
import type { Note, Notebook } from '../../types'
import { useTasks } from '../../hooks/useTasks'
import { useToday } from '../../hooks/useToday'
import { useTaskStatuses } from '../../hooks/useTaskStatuses'
import { DEFAULT_TASKS_ENV, TasksEnvProvider } from '../TasksView/TasksEnv'
import { buildBaseExtensions } from '../Editor/extensions'
import { RemindersProvider } from '../Editor/RemindersContext'
import { TasksProvider } from '../Editor/TasksContext'
import { taskStatusPluginKey, type TaskStatusStorage } from '../Editor/TaskStatus'
import { TimePicker } from '../Editor/TimePicker'
import styles from './KeepPanel.module.css'

function getMarkdown(editor: TiptapEditor): string {
  const storage = editor.storage as unknown as { markdown?: { getMarkdown(): string } }
  return storage.markdown?.getMarkdown() ?? editor.getText()
}

// Janela rápida Ctrl+K: edita a nota diária de HOJE do Calendar. A nota é
// recarregada do banco a cada exibição da janela (evento `keep-shown` emitido
// pelo Rust ao mostrar) — cobre edições feitas na main e a virada do dia.
export function KeepPanel() {
  const [note, setNote] = useState<Note | null>(null)
  const [firedIds, setFiredIds] = useState<Set<string>>(new Set())
  const [timePickerPos, setTimePickerPos] = useState<{ top: number; left: number } | null>(null)
  const timePickerInsertPosRef = useRef<number>(0)
  const noteRef = useRef<Note | null>(null)
  noteRef.current = note
  const todayKey = useToday()
  const { tasks, tasksById, updateTask, reload: reloadTasks } = useTasks()
  // Registro de status (SQLite) para o bloco `/tasks` mostrar nomes/cores custom.
  const { statuses } = useTaskStatuses()
  const tasksEnv = useMemo(() => ({ ...DEFAULT_TASKS_ENV, statuses }), [statuses])
  const reloadTasksRef = useRef(reloadTasks)
  reloadTasksRef.current = reloadTasks
  // Cadernos para o `#Projeto` dos blocos `/tasks` da nota.
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const loadNotebooks = () => {
    storage
      .getNotebooks()
      .then(setNotebooks)
      .catch((err) => console.error('keep: failed to load notebooks', err))
  }
  const loadNotebooksRef = useRef(loadNotebooks)
  loadNotebooksRef.current = loadNotebooks

  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildBaseExtensions('Quick note for today...'),
    content: '',
    editorProps: {
      attributes: {
        class: styles.proseEditor,
        spellcheck: 'true',
      },
      handleKeyDown: (view, event) => {
        // Gatilho "@" + seletor de horário — a nota da keep é sempre a nota
        // diária do Calendar, então o gatilho está sempre ativo aqui.
        if (event.key === '@') {
          event.preventDefault()
          const { from } = view.state.selection
          timePickerInsertPosRef.current = from
          const coords = view.coordsAtPos(from)
          setTimePickerPos({ top: coords.bottom + 4, left: coords.left })
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      const current = noteRef.current
      if (!current) return
      const md = getMarkdown(editor)
      const updated: Note = { ...current, content: md, updatedAt: Date.now() }
      noteRef.current = updated
      setNote(updated)
      void storage.saveNote(updated).catch((err) => {
        console.error('keep: failed to save note', err)
      })
    },
  })

  const editorRef = useRef(editor)
  editorRef.current = editor

  // Serializa as cargas da nota do dia: mount e `keep-shown` podem disparar
  // quase juntos (e o StrictMode duplica efeitos em dev) — duas execuções
  // concorrentes poderiam criar a nota de hoje em duplicata.
  const loadChainRef = useRef<Promise<void>>(Promise.resolve())

  // Carrega (ou cria) a nota diária de hoje e sincroniza o editor. Roda no
  // mount e a cada `keep-shown` — recomputa "hoje" a cada chamada, então a
  // virada do dia é coberta na próxima exibição da janela.
  useEffect(() => {
    if (!editor) return

    let cancelled = false

    async function doLoadOrCreateTodayNote() {
      try {
        const title = formatCalendarTitle(new Date())
        const all = await storage.getNotes()
        let today = all.find(
          (n) => n.notebookId === CALENDAR_NOTEBOOK_ID && n.title === title
        )
        if (!today) {
          const now = Date.now()
          today = {
            id: nanoid(),
            notebookId: CALENDAR_NOTEBOOK_ID,
            subjectId: null,
            title,
            content: '',
            tags: [],
            createdAt: now,
            updatedAt: now,
          }
          await storage.saveNote(today)
        }
        // Sincroniza o editor ANTES de ler os fired ids: se a leitura de
        // reminder_state falhar (ex.: migration quebrada em builds antigos do
        // MSI), a nota já está carregada no editor/noteRef e o autosave
        // continua funcionando. Antes o throw zereava noteRef e o texto
        // digitado se perdia.
        if (cancelled) return
        setNote(today)
        editorRef.current?.commands.setContent(today.content, { emitUpdate: false })

        const fired = await storage.getFiredReminderIds(today.id)
        if (cancelled) return
        setFiredIds(new Set(fired))
      } catch (err) {
        console.error('keep: failed to load today note', err)
      }
    }

    // `focus`: foca o editor só DEPOIS do setContent da recarga. A posição
    // explícita ('end') força o view.focus() mesmo com hasFocus() já true.
    function loadOrCreateTodayNote(opts: { focus?: boolean } = {}) {
      loadChainRef.current = loadChainRef.current.then(doLoadOrCreateTodayNote)
      if (opts.focus) {
        loadChainRef.current = loadChainRef.current.then(() => {
          editorRef.current?.commands.focus('end')
        })
      }
    }

    loadOrCreateTodayNote()
    loadNotebooksRef.current()

    let unlisten: (() => void) | undefined
    void listen('keep-shown', () => {
      loadOrCreateTodayNote({ focus: true })
      loadNotebooksRef.current()
      void reloadTasksRef.current()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })

    // A main escreveu na nota de hoje (Weekly review): recarrega para o
    // autosave daqui não sobrescrever o texto novo.
    let unlistenUpdated: (() => void) | undefined
    void listen<{ noteId: string }>('calendar-note-updated', (event) => {
      if (noteRef.current?.id === event.payload.noteId) loadOrCreateTodayNote()
    }).then((fn) => {
      if (cancelled) fn()
      else unlistenUpdated = fn
    })

    // Volta à janela por clique ou Alt+Tab: devolve o foco ao editor só se
    // nada mais o tem (ex.: TimePicker aberto). view.focus() preserva a seleção.
    let unlistenFocus: (() => void) | undefined
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return
        const ed = editorRef.current
        if (!ed) return
        const active = document.activeElement
        if (active && active !== document.body && active !== ed.view.dom) return
        ed.view.focus()
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlistenFocus = fn
      })

    return () => {
      cancelled = true
      unlisten?.()
      unlistenUpdated?.()
      unlistenFocus?.()
    }
  }, [editor])

  // Chips disparados pelo scheduler da main ficam riscados aqui também.
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined
    void listen<{ noteId: string; ids: string[] }>('reminders-fired', (event) => {
      const current = noteRef.current
      if (!current || event.payload.noteId !== current.id) return
      setFiredIds((prev) => {
        const next = new Set(prev)
        for (const id of event.payload.ids) next.add(id)
        return next
      })
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  // Status das tasks vinculadas → checkbox dos itens com task-ref (transação
  // só de meta, não dispara o autosave) e clique no checkbox → tabela.
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr
        .setMeta(taskStatusPluginKey, new Map(tasks.map((t) => [t.id, t.status])))
        .setMeta('addToHistory', false)
    )
  }, [editor, tasks])

  useEffect(() => {
    if (!editor) return
    const storage = editor.storage as unknown as { taskStatus: TaskStatusStorage }
    storage.taskStatus.onToggleLinked = (id, checked) => {
      void updateTask(id, { status: checked ? 'done' : 'todo' })
    }
  }, [editor, updateTask])

  function handleTimePickerConfirm(time: string) {
    setTimePickerPos(null)
    const ed = editorRef.current
    if (!ed) return
    const pos = timePickerInsertPosRef.current
    ed
      .chain()
      .focus()
      .insertContentAt(pos, [
        { type: 'reminderChip', attrs: { id: nanoid(), time } },
        { type: 'text', text: ' ' },
      ])
      .run()
  }

  function handleTimePickerCancel() {
    setTimePickerPos(null)
    const ed = editorRef.current
    if (!ed) return
    const pos = timePickerInsertPosRef.current
    ed.chain().focus().insertContentAt(pos, '@').run()
  }

  const remindersValue = useMemo(() => ({ firedIds }), [firedIds])
  const tasksValue = useMemo(
    () => ({
      tasksById,
      todayKey,
      notebooks,
      onToggleTask: (id: string, done: boolean) => {
        void updateTask(id, { status: done ? 'done' : 'todo' })
      },
    }),
    [tasksById, todayKey, notebooks, updateTask]
  )
  const headerDate = note?.title ?? formatCalendarTitle(new Date())
  const headerWeekday = getWeekdayName(parseCalendarTitle(headerDate) ?? new Date())

  return (
    <TasksEnvProvider value={tasksEnv}>
    <div className={styles.window}>
      <div className={styles.titlebar} data-tauri-drag-region>
        <span className={styles.title}>
          {headerDate} — {headerWeekday}
        </span>
        <div className={styles.titleActions}>
          <button
            type="button"
            className={styles.openBtn}
            onClick={() => {
              void invoke('open_main_window')
              void getCurrentWindow().hide()
            }}
          >
            Open Monet
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Close"
            title="Close (Ctrl+K)"
            onClick={() => {
              void getCurrentWindow().hide()
            }}
          >
            ×
          </button>
        </div>
      </div>
      <div
        className={styles.body}
        onMouseDown={(e) => {
          // Clique no padding do corpo (fora do ProseMirror) foca o editor:
          // abaixo do conteúdo vai para o fim; nas laterais/topo, para a linha
          // mais próxima. A barra de rolagem é ignorada.
          if (!editor || editor.view.dom.contains(e.target as Node)) return
          if (e.nativeEvent.offsetX >= e.currentTarget.clientWidth) return
          e.preventDefault()
          const rect = editor.view.dom.getBoundingClientRect()
          if (e.clientY > rect.bottom) {
            editor.commands.focus('end', { scrollIntoView: false })
            return
          }
          const hit = editor.view.posAtCoords({
            left: Math.min(Math.max(e.clientX, rect.left + 1), rect.right - 1),
            top: Math.min(Math.max(e.clientY, rect.top + 1), rect.bottom - 1),
          })
          editor.commands.focus(hit ? hit.pos : 'end', { scrollIntoView: false })
        }}
      >
        <RemindersProvider value={remindersValue}>
          <TasksProvider value={tasksValue}>
            <EditorContent editor={editor} className={styles.editorHost} />
          </TasksProvider>
        </RemindersProvider>
      </div>
      {timePickerPos && (
        <TimePicker
          position={timePickerPos}
          onConfirm={handleTimePickerConfirm}
          onCancel={handleTimePickerCancel}
        />
      )}
    </div>
    </TasksEnvProvider>
  )
}
