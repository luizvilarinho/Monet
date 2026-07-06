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
import type { Note } from '../../types'
import { buildBaseExtensions } from '../Editor/extensions'
import { RemindersProvider } from '../Editor/RemindersContext'
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

    function loadOrCreateTodayNote() {
      loadChainRef.current = loadChainRef.current.then(doLoadOrCreateTodayNote)
    }

    loadOrCreateTodayNote()

    let unlisten: (() => void) | undefined
    void listen('keep-shown', () => {
      loadOrCreateTodayNote()
      editorRef.current?.commands.focus()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })

    return () => {
      cancelled = true
      unlisten?.()
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
  const headerDate = note?.title ?? formatCalendarTitle(new Date())
  const headerWeekday = getWeekdayName(parseCalendarTitle(headerDate) ?? new Date())

  return (
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
      <div className={styles.body}>
        <RemindersProvider value={remindersValue}>
          <EditorContent editor={editor} />
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
  )
}
