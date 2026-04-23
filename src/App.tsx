import { useMemo, useState } from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { NotebookList } from './components/NotebookList/NotebookList'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { AiPanel } from './components/AiPanel/AiPanel'
import { useNotebooks } from './hooks/useNotebooks'
import { useNotes } from './hooks/useNotes'
import type { AiResponse, Note } from './types'
import './App.css'

function App() {
  const { notebooks, create: createNotebook, remove: removeNotebook } =
    useNotebooks()
  const {
    notes,
    save: saveNote,
    create: createNote,
    remove: removeNote,
  } = useNotes()

  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [responses] = useState<AiResponse[]>([])

  const allTags = useMemo(
    () =>
      Array.from(new Set(notes.flatMap((n) => n.tags))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [notes]
  )

  const notebookNotes = useMemo(
    () => notes.filter((n) => n.notebookId === activeNotebookId),
    [notes, activeNotebookId]
  )

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notebookNotes.filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [notebookNotes, search, activeTag])

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  )

  function updateActive(patch: Partial<Note>) {
    if (!activeNote) return
    void saveNote({ ...activeNote, ...patch, updatedAt: Date.now() })
  }

  async function handleCreateNotebook() {
    const name = window.prompt('nome do caderno')
    if (name === null) return
    const nb = await createNotebook(name)
    setActiveNotebookId(nb.id)
    setActiveId(null)
  }

  async function handleCreateNote() {
    if (!activeNotebookId) return
    const note = await createNote(activeNotebookId)
    setActiveId(note.id)
  }

  async function handleDeleteNotebook(id: string) {
    const childNotes = notes.filter((n) => n.notebookId === id)
    await Promise.all(childNotes.map((n) => removeNote(n.id)))
    await removeNotebook(id)
    if (activeNotebookId === id) {
      setActiveNotebookId(null)
      setActiveId(null)
    }
  }

  async function handleDeleteNote(id: string) {
    await removeNote(id)
    if (activeId === id) setActiveId(null)
  }

  return (
    <div className="app">
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        onExport={() => {}}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen((v) => !v)}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
      />
      <div className="workspace">
        <NotebookList
          notebooks={notebooks}
          activeId={activeNotebookId}
          onSelect={(id) => {
            setActiveNotebookId(id)
            setActiveId(null)
          }}
          onCreate={handleCreateNotebook}
          onDelete={handleDeleteNotebook}
          tags={allTags}
          activeTag={activeTag}
          onSelectTag={setActiveTag}
          onOpenSettings={() => {}}
        />
        <Sidebar
          notes={visibleNotes}
          activeId={activeId}
          notebookSelected={activeNotebookId !== null}
          onSelect={setActiveId}
          onCreate={handleCreateNote}
          onDelete={handleDeleteNote}
        />
        <Editor
          title={activeNote?.title ?? ''}
          onTitleChange={(title) => updateActive({ title })}
          tags={activeNote?.tags ?? []}
          onTagsChange={(tags) => updateActive({ tags })}
          value={activeNote?.content ?? ''}
          onChange={(content) => updateActive({ content })}
        />
        <AiPanel open={aiOpen} responses={responses} />
      </div>
    </div>
  )
}

export default App
