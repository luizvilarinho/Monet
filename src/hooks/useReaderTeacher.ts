import { useCallback, useMemo, useState } from 'react'
import type { Book, Note, VocabularyItem } from '../types'
import type { ReaderTeacher } from '../components/Reader/ReaderChatPanel'
import { baseLanguage } from '../lib/language'
import { findLanguageProfile, readProfileLevel, readProfileLine } from '../lib/languageProfile'
import { getReaderTeacher, setReaderTeacher } from '../lib/languageSettings'
import { buildTeacherBlock, savedWordsCount, teacherChipLabel } from '../lib/teacherContext'

// O professor de língua do chat do leitor: o interruptor (ligado por livro, desligado
// por padrão), o nível e as linhas Explain/Don't da nota de perfil, e o bloco que vai
// ao contexto efêmero com o vocabulário deste livro guardado na página. Só existe com
// as ferramentas de língua: sem elas, `available` é falso e o chat é o de sempre.
export function useReaderTeacher(params: {
  book: Book
  toolsOn: boolean
  nativeLanguage: string
  notes: Note[]
  disabledNotebookIds: ReadonlySet<string>
  // O vocabulário deste livro guardado na página que está na tela.
  pageItems: VocabularyItem[]
}): { teacher: ReaderTeacher; turnOn: () => void } {
  const { book, toolsOn, nativeLanguage, notes, disabledNotebookIds, pageItems } = params
  const [on, setOn] = useState(() => getReaderTeacher(book.id))
  const language = baseLanguage(book.language)

  const profile = useMemo(() => findLanguageProfile(notes, disabledNotebookIds), [notes, disabledNotebookIds])
  const level = profile ? readProfileLevel(profile.content, language) : null
  const explain = profile ? readProfileLine(profile.content, ['Explain']) : null
  const avoid = profile ? readProfileLine(profile.content, ["Don't", 'Avoid']) : null

  // Uma frase guardada é longa demais para a lista de palavras da página.
  const savedOnPage = useMemo(
    () =>
      pageItems
        .filter((item) => item.kind !== 'sentence')
        .map((item) => ({ text: item.text, sense: item.sense })),
    [pageItems],
  )
  const block = useMemo(
    () =>
      buildTeacherBlock({
        bookLanguage: language,
        nativeLanguage,
        level,
        explain,
        avoid,
        savedOnPage,
      }),
    [language, nativeLanguage, level, explain, avoid, savedOnPage],
  )

  const set = useCallback(
    (next: boolean) => {
      setOn(next)
      setReaderTeacher(book.id, next)
    },
    [book.id],
  )

  const teacher: ReaderTeacher = {
    available: toolsOn,
    on,
    onToggle: () => set(!on),
    block,
    chipLabel: teacherChipLabel(language, level, savedWordsCount(savedOnPage)),
  }
  return { teacher, turnOn: () => set(true) }
}
