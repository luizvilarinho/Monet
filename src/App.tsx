import { useMemo, useState } from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { AiPanel } from './components/AiPanel/AiPanel'
import type { AiResponse, Note } from './types'
import './App.css'

function App() {
  const [notes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [aiOpen, setAiOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [responses] = useState<AiResponse[]>([])

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  )

  return (
    <div className="app">
      <Toolbar
        title={title}
        onTitleChange={setTitle}
        onExport={() => {}}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen((v) => !v)}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
      />
      <div className="workspace">
        <Sidebar
          notes={notes}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={() => {}}
        />
        <Editor
          value={activeNote?.content ?? content}
          onChange={setContent}
        />
        <AiPanel open={aiOpen} responses={responses} />
      </div>
    </div>
  )
}

export default App
