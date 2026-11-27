import { useEffect, useMemo, useState } from 'react'
import type { Book, VocabularyItem } from '../types'
import { baseLanguage } from '../lib/language'
import { buildMatchTerms, type MatchTerm } from '../lib/vocabMatch'
import { storage } from '../storage'

// O que o leitor marca no texto: as palavras e frases guardadas neste livro e as
// dos outros livros da mesma língua. Os deste livro vêm da lista viva
// (`bookItems`: adicionar e remover marcam na hora); os dos outros são lidos uma
// vez por livro aberto. Livro de outra língua não recebe marca, e sem `enabled`
// (as ferramentas de língua desligadas, ou a chave "Mark in text") não há nada.
export function useVocabularyMarks(params: { book: Book; enabled: boolean; bookItems: VocabularyItem[] }) {
  const { book, enabled, bookItems } = params
  const language = baseLanguage(book.language)
  const [others, setOthers] = useState<VocabularyItem[]>([])
  // Título dos outros livros, para o popover dizer onde a palavra foi guardada.
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(() => new Map())

  useEffect(() => {
    if (!enabled || !language) {
      setOthers([])
      return
    }
    let cancelled = false
    void storage
      .getVocabularyByLanguage(language)
      .then((list) => {
        if (!cancelled) setOthers(list.filter((item) => item.bookId !== book.id))
      })
      .catch((err) => console.error('failed to load the vocabulary of the same language', err))
    return () => {
      cancelled = true
    }
  }, [enabled, language, book.id])

  const hasOthers = others.length > 0
  useEffect(() => {
    if (!hasOthers) return
    let cancelled = false
    void storage
      .getBooks()
      .then((books) => {
        if (!cancelled) setTitles(new Map(books.map((b) => [b.id, b.title])))
      })
      .catch((err) => console.error('failed to load the book titles', err))
    return () => {
      cancelled = true
    }
  }, [hasOthers])

  const items = useMemo(() => (enabled ? [...others, ...bookItems] : []), [enabled, others, bookItems])
  const terms = useMemo<MatchTerm[]>(() => buildMatchTerms(items), [items])
  return { items, terms, titles }
}
