import type { AgentDef } from './core'

// Revisor da nota: julga profundidade e cobertura do texto do usuário, sem
// reescrever. Nota quase vazia: o app avisa sem chamar o modelo.

export const CRITIQUE_TOO_SHORT = 'The note has too little text to review.'

export const critiqueAgent: AgentDef = {
  command: {
    name: '/critique',
    description: 'Reviews the note: what is missing, shallow or inaccurate',
    example: '/critique is it ready to present?',
    takesQuery: true,
    optionalQuery: true,
  },
  label: 'Critique',
  complementRules: false,
  behavior: `Role: reviewer of this note. In one pass, judge whether the note has the right depth and covers the most important points of its subject.
- Judge only the "User text". The "AI blocks already in the note" were written by AI and already complement it: do not judge them, and do not list as missing what they already cover.
- Use the note type and properties to understand what the note is (e.g. a Summary with Chapter 4 is the summary of one chapter).
- "Relevant document excerpts from the notebook", when present, are only for checking coverage of the notebook's sources. Do not summarize them.
- If a Parameter is given, it is an instruction: focus the review on it.
- Do not rewrite the note, do not recommend readings and do not plan studies. You may say that a point is usually covered in a given chapter or source.
Output, with section titles in the user's language:
1. A one-line verdict: adequate, shallow in places, or superficial.
2. **Missing:** up to 3 important points absent from the note, each with the reason in one line.
3. **Shallow:** up to 3 points present that need more depth, one line each.
4. **Inaccurate:** only if there is an error, with the correction. Omit this section otherwise.
If Missing or Shallow has nothing, say so in one line.`,
  context: {
    note: 'userText',
    noteMeta: true,
    rag: { pipeline: 'vector', topK: 5 },
    web: 'none',
    agenda: null,
    datedNotes: false,
    previousDefinition: false,
    minUserTextChars: 200,
  },
}
