import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { emitTo, listen } from '@tauri-apps/api/event'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { Warning, X } from '@phosphor-icons/react'
import { nanoid } from 'nanoid'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CALENDAR_NOTEBOOK_ID,
  formatCalendarTitle,
  getWeekdayName,
  parseCalendarTitle,
} from '../../lib/calendar'
import { storage } from '../../storage'
import type { AiResponse, Note, Notebook, NoteType } from '../../types'
import { useTasks } from '../../hooks/useTasks'
import { useToday } from '../../hooks/useToday'
import { useTaskStatuses } from '../../hooks/useTaskStatuses'
import { DEFAULT_TASKS_ENV, TasksEnvProvider } from '../TasksView/TasksEnv'
import { buildBaseExtensions } from '../Editor/extensions'
import { EditorResponsesProvider } from '../Editor/EditorResponsesContext'
import { RemindersProvider } from '../Editor/RemindersContext'
import { TasksProvider } from '../Editor/TasksContext'
import { taskStatusPluginKey, type TaskStatusStorage } from '../Editor/TaskStatus'
import { TimePicker } from '../Editor/TimePicker'
import { CalendarView } from '../CalendarView/CalendarView'
import { attachNoteImageOpener, useImageViewer } from '../ImageViewer/ImageViewer'
import { isTaskBodyNote, type TodosInfo } from '../../lib/tasks'
import { copyBodyNoteForOccurrence } from '../../lib/taskBodyNote'
import { isTodosNote } from '../../lib/noteTypes'
import { collectEmbedIds } from '../../lib/noteFileText'
import styles from './KeepPanel.module.css'

function getMarkdown(editor: TiptapEditor): string {
  const storage = editor.storage as unknown as { markdown?: { getMarkdown(): string } }
  return storage.markdown?.getMarkdown() ?? editor.getText()
}

const CALENDAR_COLLAPSED_KEY = 'monet:keep-calendar-collapsed'

function readCalendarCollapsed(): boolean {
  try {
    return localStorage.getItem(CALENDAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

// Janela rápida Ctrl+K: calendário à esquerda e, à direita, o corpo da nota
// diária do dia escolhido (HOJE ao abrir). A nota é recarregada do banco a cada
// exibição da janela (evento `keep-shown` emitido pelo Rust ao mostrar) —
// cobre edições feitas na main e a virada do dia.
export function KeepPanel() {
  const [note, setNote] = useState<Note | null>(null)
  // Todas as notas: pontos do calendário e cards do dia selecionado.
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [calendarCollapsed, setCalendarCollapsed] = useState(readCalendarCollapsed)
  // Remonta o calendário a cada exibição: volta ao mês e ao dia de hoje.
  const [calendarKey, setCalendarKey] = useState(0)
  // Dia da nota aberta no editor (recarga por `calendar-note-updated`).
  const dayRef = useRef<Date>(new Date())
  const [firedIds, setFiredIds] = useState<Set<string>>(new Set())
  const [timePickerPos, setTimePickerPos] = useState<{ top: number; left: number } | null>(null)
  const timePickerInsertPosRef = useRef<number>(0)
  const noteRef = useRef<Note | null>(null)
  noteRef.current = note
  // Nota do dia ainda só em memória: navegar pelos dias não cria nota; ela é
  // gravada na primeira edição (ou ao abrir na main).
  const draftNoteIdRef = useRef<string | null>(null)
  // Rascunho editado à espera da checagem da nota do dia no banco (ver
  // doMaterializeDraft): as edições ficam aqui, ainda sem gravar.
  const materializingRef = useRef<Note | null>(null)
  // Sobe a cada exibição: relê as respostas dos blocos de IA da nota.
  const [responsesTick, setResponsesTick] = useState(0)
  // Gravações de nota feitas aqui ainda sem aviso à main, que só relê o banco
  // ao ganhar foco: sem o aviso, a nota do dia aberta lá ficava velha até o F5.
  const noteWritesRef = useRef<Promise<unknown> | null>(null)
  const trackNoteWrite = (write: Promise<unknown>) => {
    noteWritesRef.current = Promise.all([noteWritesRef.current, write])
  }
  // Ao perder o foco (fechar, Ctrl+K, clicar fora): espera a última
  // gravação e avisa a main para reler as notas.
  const notifyMainRef = useRef(() => {})
  notifyMainRef.current = () => {
    const writes = noteWritesRef.current
    if (!writes) return
    noteWritesRef.current = null
    void writes.then(() =>
      emitTo('main', 'keep-notes-saved').catch((err) => console.warn('keep: notify main failed', err))
    )
  }
  // Edição local em gravação ou com a gravação falhada: a recarga do banco
  // (foco, `calendar-note-updated`, `keep-shown`) não substitui o texto daqui.
  // Só a última gravação (`writeSeqRef`) decide o estado de erro, que vale
  // para a nota que falhou (`failedNoteIdRef`).
  const pendingSavesRef = useRef(0)
  const failedNoteIdRef = useRef<string | null>(null)
  const writeSeqRef = useRef(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hasPendingLocalEdit = () =>
    pendingSavesRef.current > 0 ||
    materializingRef.current !== null ||
    (failedNoteIdRef.current !== null && failedNoteIdRef.current === noteRef.current?.id)
  const persistNote = (n: Note) => {
    pendingSavesRef.current++
    const seq = ++writeSeqRef.current
    trackNoteWrite(
      storage
        .saveNote(n)
        .then(
          () => {
            if (seq !== writeSeqRef.current) return
            failedNoteIdRef.current = null
            setSaveError(null)
          },
          (err) => {
            console.error('keep: failed to save note', err)
            if (seq !== writeSeqRef.current) return
            failedNoteIdRef.current = n.id
            setSaveError('Failed to save the note. Your text is still here.')
          }
        )
        .finally(() => {
          pendingSavesRef.current--
        })
    )
  }
  const retrySave = () => {
    const current = noteRef.current
    if (current) persistNote({ ...current, updatedAt: Date.now() })
  }
  const todayKey = useToday()
  const { tasks, tasksById, updateTaskFresh, reload: reloadTasks } = useTasks({
    // Recorrente concluída aqui: a ocorrência nova leva a cópia da nota-corpo,
    // como na main (que relê as notas no aviso ao perder o foco).
    onOccurrenceCreated: (from, occurrence) => {
      trackNoteWrite(
        copyBodyNoteForOccurrence(from, occurrence)
          .then((body) => (body ? updateTaskFresh(occurrence.id, { noteId: body.id }) : undefined))
          .catch((err) => console.error('keep: failed to copy the body note', err))
      )
    },
  })
  // Registro de status (SQLite) para o bloco `/tasks` mostrar nomes/cores custom.
  const { statuses } = useTaskStatuses()
  // Notas TODOS: título no chip das tasks do bloco `/tasks`; abrir vai para a main.
  const todosById = useMemo(
    () =>
      new Map<string, TodosInfo>(
        allNotes
          .filter(isTodosNote)
          .map((n) => [n.id, { id: n.id, title: n.title, notebookId: n.notebookId, archived: !!n.archivedAt }])
      ),
    [allNotes]
  )
  const tasksEnv = useMemo(
    () => ({
      ...DEFAULT_TASKS_ENV,
      statuses,
      todosById,
      onOpenNote: (noteId: string) => {
        void invoke('open_note_in_main', { noteId })
        void getCurrentWindow().hide()
      },
    }),
    [statuses, todosById]
  )
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
  // Tipos de nota para o ícone/nome do tipo nos cards do calendário.
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([])
  useEffect(() => {
    storage
      .getNoteTypes()
      .then(setNoteTypes)
      .catch((err) => console.error('keep: failed to load note types', err))
  }, [])

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
        // diária do Calendar. Como no editor da main: só no começo de palavra
        // (e-mail e "a@b" digitam normal) e fora de código.
        if (event.key === '@') {
          const { $from, empty } = view.state.selection
          const inCode = !!$from.parent.type.spec.code || $from.marks().some((m) => m.type.spec.code)
          const charBefore =
            $from.parentOffset > 0 ? view.state.doc.textBetween($from.pos - 1, $from.pos, '\n', '\n') : ''
          if (!empty || inCode || (charBefore !== '' && !/[\s([{"'“‘]/.test(charBefore))) return false
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
      setAllNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      // Primeira edição do rascunho do dia: grava depois de conferir se a nota
      // do dia já existe no banco; até lá as edições só se acumulam.
      if (draftNoteIdRef.current === updated.id) {
        draftNoteIdRef.current = null
        materializingRef.current = updated
        materializeDraftRef.current()
        return
      }
      if (materializingRef.current?.id === updated.id) {
        materializingRef.current = updated
        return
      }
      persistNote(updated)
    },
  })

  const editorRef = useRef(editor)
  editorRef.current = editor

  // Imagem da nota: clique nela selecionada (ou duplo clique) abre ampliada.
  const imageViewer = useImageViewer()
  const openImage = imageViewer.open
  useEffect(() => {
    if (!editor) return
    return attachNoteImageOpener(editor.view.dom, openImage)
  }, [editor, openImage])

  // Serializa as cargas da nota do dia: mount e `keep-shown` podem disparar
  // quase juntos (e o StrictMode duplica efeitos em dev) — duas execuções
  // concorrentes poderiam criar a nota do dia em duplicata.
  const loadChainRef = useRef<Promise<void>>(Promise.resolve())
  // Preenchidas pelo efeito abaixo; usadas pelo clique num dia do calendário,
  // pela 1ª edição do rascunho e pelo "Open in Monet".
  const loadDayRef = useRef<(date: Date, opts?: { focus?: boolean }) => void>(() => {})
  const materializeDraftRef = useRef<() => void>(() => {})

  // Carrega a nota diária do dia (ou um rascunho em memória, se o dia não
  // tem nota) e sincroniza o editor. Roda no mount e a cada `keep-shown` com
  // HOJE — recomputa a data a cada exibição, então a virada do dia é coberta —
  // e no clique de um dia do calendário.
  useEffect(() => {
    if (!editor) return

    let cancelled = false

    async function doLoadOrCreateDayNote(date: Date) {
      try {
        const title = formatCalendarTitle(date)
        // Gravação daqui durante a leitura (tecla com a keep já focada): a
        // versão local é mais nova que a lida.
        const seqBefore = writeSeqRef.current
        const all = await storage.getNotes()
        const local = noteRef.current
        const localNewer = hasPendingLocalEdit() || writeSeqRef.current !== seqBefore
        let today = all.find(
          (n) => n.notebookId === CALENDAR_NOTEBOOK_ID && n.title === title
        )
        // Fica a nota do dia aberta aqui se ela tem edição mais nova que a
        // leitura, ou se é o rascunho do dia e o banco ainda não tem a nota. Uma
        // nota do dia criada fora recebe o rascunho no doMaterializeDraft.
        const keepLocal =
          !!local &&
          local.notebookId === CALENDAR_NOTEBOOK_ID &&
          local.title === title &&
          (localNewer || (!today && draftNoteIdRef.current === local.id))
        if (keepLocal && local) {
          today = local
        } else if (!today) {
          // Sem nota no banco: um rascunho novo.
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
          draftNoteIdRef.current = today.id
          all.push(today)
        }
        // Sincroniza o editor ANTES de ler os fired ids: se a leitura de
        // reminder_state falhar (ex.: migration quebrada em builds antigos do
        // MSI), a nota já está carregada no editor/noteRef e o autosave
        // continua funcionando. Antes o throw zereava noteRef e o texto
        // digitado se perdia.
        if (cancelled) return
        dayRef.current = date
        if (keepLocal && local) {
          // Sem tocar no editor: a versão daqui substitui a lida na lista.
          setAllNotes([...all.filter((n) => n.id !== local.id), local])
        } else {
          if (local?.id !== today.id) {
            // Troca de nota: uma gravação da anterior ainda em voo não decide
            // o erro daqui, e a falha dela sai junto com o texto dela.
            ++writeSeqRef.current
            failedNoteIdRef.current = null
            setSaveError(null)
          }
          // Antes do setContent: um onUpdate imediato já grava na nota nova.
          noteRef.current = today
          setAllNotes(all)
          setNote(today)
          // Fora do desfazer: Ctrl+Z não traz o texto do dia carregado antes.
          editorRef.current
            ?.chain()
            .setMeta('addToHistory', false)
            .setContent(today.content, { emitUpdate: false })
            .run()
        }

        const fired = await storage.getFiredReminderIds(today.id)
        if (cancelled) return
        setFiredIds(new Set(fired))
      } catch (err) {
        console.error('keep: failed to load today note', err)
      }
    }

    // `focus`: foca o editor só DEPOIS do setContent da recarga. A posição
    // explícita ('end') força o view.focus() mesmo com hasFocus() já true.
    // `date` null = dia aberto no momento em que a carga roda (recarga): não
    // volta a um dia anterior se um clique de dia ainda estiver na fila.
    function loadOrCreateDayNote(date: Date | null, opts: { focus?: boolean } = {}) {
      loadChainRef.current = loadChainRef.current.then(() =>
        doLoadOrCreateDayNote(date ?? dayRef.current)
      )
      if (opts.focus) {
        loadChainRef.current = loadChainRef.current.then(() => {
          editorRef.current?.commands.focus('end')
        })
      }
    }
    loadDayRef.current = loadOrCreateDayNote

    // Relê do banco a nota aberta (a main gravou nela ou a janela voltou ao
    // foco), mantendo o cursor. Não substitui edição local pendente ou falhada.
    async function doReloadOpenNote() {
      const current = noteRef.current
      if (!current || hasPendingLocalEdit()) return
      // Uma gravação daqui durante a leitura deixa a versão lida velha.
      const seqBefore = writeSeqRef.current
      // undefined = erro de leitura (não mexe); null = nota apagada.
      const fresh = await storage.getNote(current.id).catch((err) => {
        console.error('keep: failed to reload note', err)
        return undefined
      })
      if (fresh === undefined || cancelled) return
      if (fresh === null) {
        await doLoadOrCreateDayNote(dayRef.current)
        return
      }
      const open = noteRef.current
      if (
        hasPendingLocalEdit() ||
        writeSeqRef.current !== seqBefore ||
        open?.id !== fresh.id ||
        fresh.content === open.content
      ) {
        return
      }
      noteRef.current = fresh
      setNote(fresh)
      setAllNotes((prev) => prev.map((n) => (n.id === fresh.id ? fresh : n)))
      const ed = editorRef.current
      if (!ed) return
      const { from } = ed.state.selection
      ed.chain()
        .setMeta('addToHistory', false)
        .setContent(fresh.content, { emitUpdate: false })
        .setTextSelection(from)
        .run()
    }

    function reloadOpenNote() {
      loadChainRef.current = loadChainRef.current.then(doReloadOpenNote)
    }

    // Rascunho que vai virar nota (1ª edição ou "Open in Monet"): a nota do
    // dia pode ter nascido no banco depois da carga (main, assistant). Se ela
    // existe, o texto do rascunho entra no fim dela e ela fica aberta; senão o
    // rascunho vira a nota. Assim nunca há duas notas do mesmo dia.
    async function doMaterializeDraft() {
      const draft = materializingRef.current
      if (!draft) return
      const existing = await storage
        .getNotes()
        .then((all) =>
          all.find((n) => n.notebookId === CALENDAR_NOTEBOOK_ID && n.title === draft.title && n.id !== draft.id)
        )
        .catch((err) => {
          console.error('keep: failed to look up the day note', err)
          return undefined
        })
      // Com as teclas digitadas durante a leitura.
      const latest = materializingRef.current ?? draft
      materializingRef.current = null
      if (!existing) {
        persistNote(latest)
        return
      }
      const typed = latest.content.trim() !== ''
      const merged: Note = typed
        ? {
            ...existing,
            content: [existing.content.trimEnd(), latest.content].filter((c) => c.trim()).join('\n\n'),
            updatedAt: Date.now(),
          }
        : existing
      setAllNotes((prev) => [...prev.filter((n) => n.id !== latest.id && n.id !== merged.id), merged])
      // Grava antes de qualquer await: uma tecla depois disso já grava sobre ela.
      if (typed) persistNote(merged)
      if (noteRef.current?.id !== latest.id) return
      noteRef.current = merged
      setNote(merged)
      const ed = editorRef.current
      if (ed) {
        // O texto digitado fica no fim, onde estava o cursor.
        ed.chain().setMeta('addToHistory', false).setContent(merged.content, { emitUpdate: false }).run()
        if (ed.isFocused) ed.commands.focus('end')
      }
      const fired = await storage.getFiredReminderIds(merged.id).catch(() => null)
      if (fired && noteRef.current?.id === merged.id) setFiredIds(new Set(fired))
    }
    materializeDraftRef.current = () => {
      loadChainRef.current = loadChainRef.current.then(doMaterializeDraft)
    }

    loadOrCreateDayNote(new Date())
    loadNotebooksRef.current()

    let unlisten: (() => void) | undefined
    void listen('keep-shown', () => {
      setCalendarKey((k) => k + 1)
      setResponsesTick((t) => t + 1)
      loadOrCreateDayNote(new Date(), { focus: true })
      loadNotebooksRef.current()
      void reloadTasksRef.current()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })

    // A main gravou a nota aberta (editor, Weekly review, assistant):
    // recarrega para o autosave daqui não sobrescrever o texto novo.
    // Com um rascunho aberto, qualquer nota do Calendar gravada pode ser a do
    // dia (criada na main): a recarga procura pelo título e troca para ela.
    let unlistenUpdated: (() => void) | undefined
    void listen<{ noteId: string }>('calendar-note-updated', (event) => {
      const open = noteRef.current
      if (!open) return
      if (open.id === event.payload.noteId || draftNoteIdRef.current === open.id) reloadOpenNote()
    }).then((fn) => {
      if (cancelled) fn()
      else unlistenUpdated = fn
    })

    // Volta à janela por clique ou Alt+Tab: relê a nota (a main pode ter
    // gravado nela) e devolve o foco ao editor só se nada mais o tem (ex.:
    // TimePicker aberto). view.focus() preserva a seleção.
    let unlistenFocus: (() => void) | undefined
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          notifyMainRef.current()
          return
        }
        reloadOpenNote()
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
      void updateTaskFresh(id, { status: checked ? 'done' : 'todo' })
    }
  }, [editor, updateTaskFresh])

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

  // Respostas dos blocos de IA da nota: o EmbedBlock lê do contexto. Relidas
  // quando os blocos mudam e a cada exibição (a main pode ter concluído uma).
  const [embedResponses, setEmbedResponses] = useState<AiResponse[]>([])
  const embedIdsKey = useMemo(
    () => [...new Set(collectEmbedIds(note?.content ?? ''))].join(','),
    [note?.content]
  )
  useEffect(() => {
    if (!embedIdsKey) {
      setEmbedResponses([])
      return
    }
    let cancelled = false
    storage
      .getResponsesByIds(embedIdsKey.split(','))
      .then((rows) => {
        if (!cancelled) setEmbedResponses(rows)
      })
      .catch((err) => console.warn('keep: failed to load AI responses', err))
    return () => {
      cancelled = true
    }
  }, [embedIdsKey, responsesTick])
  const responsesValue = useMemo(() => ({ responses: embedResponses }), [embedResponses])
  const tasksValue = useMemo(
    () => ({
      tasksById,
      todayKey,
      notebooks,
      onToggleTask: (id: string, done: boolean) => {
        void updateTaskFresh(id, { status: done ? 'done' : 'todo' })
      },
      statuses,
      onSetStatus: (id: string, status: string) => {
        void updateTaskFresh(id, { status })
      },
      todosTitle: (noteId: string) => todosById.get(noteId)?.title,
      currentNoteId: note?.id ?? null,
    }),
    [tasksById, todayKey, notebooks, updateTaskFresh, statuses, todosById, note?.id]
  )
  const headerDate = note?.title ?? formatCalendarTitle(new Date())
  const headerWeekday = getWeekdayName(parseCalendarTitle(headerDate) ?? new Date())
  const calendarNotes = useMemo(
    () => allNotes.filter((n) => n.notebookId === CALENDAR_NOTEBOOK_ID),
    [allNotes]
  )
  const datedNotes = useMemo(() => allNotes.filter((n) => !!n.date), [allNotes])
  const activeNotes = useMemo(() => allNotes.filter((n) => !isTaskBodyNote(n)), [allNotes])

  // "Open in Monet": a main abre a nota do dia exibido. Um rascunho vira nota
  // antes (a main relê o banco ao abrir), pela mesma checagem da 1ª edição
  // (pode virar a nota do dia que já existe), e uma gravação em voo é esperada.
  async function openInMain() {
    const current = noteRef.current
    try {
      if (!current) {
        await invoke('open_main_window')
      } else {
        if (draftNoteIdRef.current === current.id) {
          draftNoteIdRef.current = null
          materializingRef.current = current
          materializeDraftRef.current()
        }
        await loadChainRef.current
        await noteWritesRef.current
        await invoke('open_note_in_main', { noteId: (noteRef.current ?? current).id })
      }
    } catch (err) {
      console.warn('keep: open in main failed', err)
      void invoke('open_main_window')
    }
    void getCurrentWindow().hide()
  }

  function toggleCalendarCollapsed() {
    setCalendarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(CALENDAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // preferência de conveniência: sem storage, só não persiste
      }
      return next
    })
  }

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
            title="Open this day's note in the main window"
            onClick={() => void openInMain()}
          >
            Open in Monet
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
            <X size={14} aria-hidden />
          </button>
        </div>
      </div>
      {saveError && (
        <div className={styles.saveError} role="alert">
          <Warning size={14} aria-hidden />
          <span>{saveError}</span>
          <button type="button" className={styles.retryBtn} onClick={retrySave}>
            Retry
          </button>
        </div>
      )}
      <div className={styles.main}>
      <CalendarView
        key={calendarKey}
        notes={calendarNotes}
        datedNotes={datedNotes}
        notebooks={notebooks}
        noteTypes={noteTypes}
        recentlyActiveNotes={activeNotes}
        onDayClick={(date) => loadDayRef.current(date, { focus: true })}
        onNoteClick={(noteId) => {
          void invoke('open_note_in_main', { noteId })
          void getCurrentWindow().hide()
        }}
        width={calendarCollapsed ? 48 : 220}
        collapsed={calendarCollapsed}
        onToggleCollapsed={toggleCalendarCollapsed}
        resizable={false}
        tasks={tasks}
        todayKey={todayKey}
        onToggleTaskDone={(id, done) => {
          void updateTaskFresh(id, { status: done ? 'done' : 'todo' })
        }}
        onOpenTask={(taskId) => {
          void invoke('open_task_in_main', { taskId })
          void getCurrentWindow().hide()
        }}
      />
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
            <EditorResponsesProvider value={responsesValue}>
              <EditorContent editor={editor} className={styles.editorHost} />
            </EditorResponsesProvider>
          </TasksProvider>
        </RemindersProvider>
      </div>
      </div>
      {timePickerPos && (
        <TimePicker
          position={timePickerPos}
          onConfirm={handleTimePickerConfirm}
          onCancel={handleTimePickerCancel}
        />
      )}
      {imageViewer.viewer}
    </div>
    </TasksEnvProvider>
  )
}
