import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export type ActiveFormat = 'h1' | 'h2' | 'h3' | 'bold' | 'italic' | 'ul' | 'ol' | 'todo'

export function detectActiveFormats(view: EditorView): Set<ActiveFormat> {
  const active = new Set<ActiveFormat>()
  const { state } = view
  const sel = state.selection.main
  const lineText = state.doc.lineAt(sel.from).text

  if (/^# /.test(lineText)) active.add('h1')
  else if (/^## /.test(lineText)) active.add('h2')
  else if (/^### /.test(lineText)) active.add('h3')

  if (/^- \[[ x]\] /.test(lineText)) active.add('todo')
  else if (/^- /.test(lineText)) active.add('ul')
  else if (/^\d+\. /.test(lineText)) active.add('ol')

  if (!sel.empty) {
    const selText = state.doc.sliceString(sel.from, sel.to)
    const before2 = state.doc.sliceString(Math.max(0, sel.from - 2), sel.from)
    const after2 = state.doc.sliceString(sel.to, Math.min(state.doc.length, sel.to + 2))

    if (
      (selText.startsWith('**') && selText.endsWith('**') && selText.length >= 4) ||
      (before2 === '**' && after2 === '**')
    ) {
      active.add('bold')
    }

    if (!active.has('bold')) {
      const before1 = state.doc.sliceString(Math.max(0, sel.from - 1), sel.from)
      const before2c = state.doc.sliceString(Math.max(0, sel.from - 2), sel.from - 1)
      const after1 = state.doc.sliceString(sel.to, Math.min(state.doc.length, sel.to + 1))
      const after2c = state.doc.sliceString(sel.to + 1, Math.min(state.doc.length, sel.to + 2))
      if (
        (selText.startsWith('*') && selText.endsWith('*') && !selText.startsWith('**') && selText.length >= 2) ||
        (before1 === '*' && before2c !== '*' && after1 === '*' && after2c !== '*')
      ) {
        active.add('italic')
      }
    }
  }

  return active
}

function expandToWord(view: EditorView, from: number, to: number): { from: number; to: number } {
  const line = view.state.doc.lineAt(from)
  const text = line.text
  let start = from - line.from
  let end = to - line.from
  const before = start > 0 ? text[start - 1] : ''
  const after = end < text.length ? text[end] : ''
  if (!/\w/.test(before) && !/\w/.test(after)) return { from, to }
  while (start > 0 && /\w/.test(text[start - 1])) start--
  while (end < text.length && /\w/.test(text[end])) end++
  return { from: line.from + start, to: line.from + end }
}

function getSelectedLines(view: EditorView) {
  const { state } = view
  const sel = state.selection.main
  const lines = []
  for (let n = state.doc.lineAt(sel.from).number; n <= state.doc.lineAt(sel.to).number; n++) {
    lines.push(state.doc.line(n))
  }
  return lines
}

function stripBlockPrefix(text: string): string {
  return text
    .replace(/^#{1,6} /, '')
    .replace(/^- \[[ x]\] /, '')
    .replace(/^- /, '')
    .replace(/^\d+\. /, '')
}

export function toggleHeading(view: EditorView, level: 1 | 2 | 3) {
  const { state } = view
  const sel = state.selection.main
  const targetPrefix = '#'.repeat(level) + ' '
  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)
  const changes: { from: number; to: number; insert: string }[] = []

  for (let n = startLine.number; n <= endLine.number; n++) {
    const line = state.doc.line(n)
    const m = line.text.match(/^(#{1,6}) /)
    const currentPrefix = m ? m[0] : ''
    if (currentPrefix === targetPrefix) {
      changes.push({ from: line.from, to: line.from + currentPrefix.length, insert: '' })
    } else {
      changes.push({ from: line.from, to: line.from + currentPrefix.length, insert: targetPrefix })
    }
  }

  view.dispatch({ changes })
  view.focus()
}

export function toggleBold(view: EditorView) {
  const { state } = view
  const sel = state.selection.main
  let { from, to } = { from: sel.from, to: sel.to }

  if (from === to) {
    const exp = expandToWord(view, from, to)
    from = exp.from; to = exp.to
  } else if (!/[\s\n]/.test(state.doc.sliceString(from, to))) {
    const exp = expandToWord(view, from, to)
    from = exp.from; to = exp.to
  }

  if (from === to) { view.focus(); return }

  const text = state.doc.sliceString(from, to)
  const b2 = state.doc.sliceString(Math.max(0, from - 2), from)
  const a2 = state.doc.sliceString(to, Math.min(state.doc.length, to + 2))

  if (text.startsWith('**') && text.endsWith('**') && text.length >= 4) {
    view.dispatch({
      changes: [{ from, to: from + 2, insert: '' }, { from: to - 2, to, insert: '' }],
      selection: EditorSelection.range(from, to - 4),
    })
  } else if (b2 === '**' && a2 === '**') {
    view.dispatch({
      changes: [{ from: from - 2, to: from, insert: '' }, { from: to, to: to + 2, insert: '' }],
      selection: EditorSelection.range(from - 2, to - 2),
    })
  } else {
    view.dispatch({
      changes: [{ from, to: from, insert: '**' }, { from: to, to: to, insert: '**' }],
      selection: EditorSelection.range(from, to + 4),
    })
  }
  view.focus()
}

export function toggleItalic(view: EditorView) {
  const { state } = view
  const sel = state.selection.main
  let { from, to } = { from: sel.from, to: sel.to }

  if (from === to) {
    const exp = expandToWord(view, from, to)
    from = exp.from; to = exp.to
  } else if (!/[\s\n]/.test(state.doc.sliceString(from, to))) {
    const exp = expandToWord(view, from, to)
    from = exp.from; to = exp.to
  }

  if (from === to) { view.focus(); return }

  const text = state.doc.sliceString(from, to)
  const b1 = state.doc.sliceString(Math.max(0, from - 1), from)
  const b2c = state.doc.sliceString(Math.max(0, from - 2), from - 1)
  const a1 = state.doc.sliceString(to, Math.min(state.doc.length, to + 1))
  const a2c = state.doc.sliceString(to + 1, Math.min(state.doc.length, to + 2))

  const selIsItalic = text.startsWith('*') && text.endsWith('*') && !text.startsWith('**') && text.length >= 2
  const surroundIsItalic = b1 === '*' && b2c !== '*' && a1 === '*' && a2c !== '*'

  if (selIsItalic) {
    view.dispatch({
      changes: [{ from, to: from + 1, insert: '' }, { from: to - 1, to, insert: '' }],
      selection: EditorSelection.range(from, to - 2),
    })
  } else if (surroundIsItalic) {
    view.dispatch({
      changes: [{ from: from - 1, to: from, insert: '' }, { from: to, to: to + 1, insert: '' }],
      selection: EditorSelection.range(from - 1, to - 1),
    })
  } else {
    view.dispatch({
      changes: [{ from, to: from, insert: '*' }, { from: to, to: to, insert: '*' }],
      selection: EditorSelection.range(from, to + 2),
    })
  }
  view.focus()
}

export function toggleUnorderedList(view: EditorView) {
  const lines = getSelectedLines(view)
  const nonBlank = lines.filter(l => l.text.trim())
  const allBullets = nonBlank.length > 0 && nonBlank.every(l => /^- /.test(l.text))
  const changes: { from: number; to: number; insert: string }[] = []

  for (const line of lines) {
    if (!line.text.trim()) continue
    if (allBullets) {
      const m = line.text.match(/^- (?:\[[ x]\] )?/)
      if (m) changes.push({ from: line.from, to: line.from + m[0].length, insert: '' })
    } else {
      const stripped = stripBlockPrefix(line.text)
      changes.push({ from: line.from, to: line.from + (line.text.length - stripped.length), insert: '- ' })
    }
  }

  if (changes.length) view.dispatch({ changes })
  view.focus()
}

export function toggleOrderedList(view: EditorView) {
  const lines = getSelectedLines(view)
  const nonBlank = lines.filter(l => l.text.trim())
  const allOrdered = nonBlank.length > 0 && nonBlank.every(l => /^\d+\. /.test(l.text))
  const changes: { from: number; to: number; insert: string }[] = []
  let counter = 1

  for (const line of lines) {
    if (!line.text.trim()) continue
    if (allOrdered) {
      const m = line.text.match(/^\d+\. /)
      if (m) changes.push({ from: line.from, to: line.from + m[0].length, insert: '' })
    } else {
      const stripped = stripBlockPrefix(line.text)
      changes.push({ from: line.from, to: line.from + (line.text.length - stripped.length), insert: `${counter}. ` })
      counter++
    }
  }

  if (changes.length) view.dispatch({ changes })
  view.focus()
}

export function toggleTodo(view: EditorView) {
  const lines = getSelectedLines(view)
  const nonBlank = lines.filter(l => l.text.trim())
  const allTodo = nonBlank.length > 0 && nonBlank.every(l => /^- \[[ x]\] /.test(l.text))
  const changes: { from: number; to: number; insert: string }[] = []

  for (const line of lines) {
    if (!line.text.trim()) continue
    if (allTodo) {
      const m = line.text.match(/^- \[[ x]\] /)
      if (m) changes.push({ from: line.from, to: line.from + m[0].length, insert: '' })
    } else {
      const stripped = stripBlockPrefix(line.text)
      changes.push({ from: line.from, to: line.from + (line.text.length - stripped.length), insert: '- [ ] ' })
    }
  }

  if (changes.length) view.dispatch({ changes })
  view.focus()
}
