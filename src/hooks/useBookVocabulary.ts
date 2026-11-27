import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book, VocabularyItem } from '../types'
import { storage } from '../storage'
import { baseLanguage } from '../lib/language'
import {
  buildVocabularyItem,
  findDuplicate,
  type SentMark,
  type VocabularyDraft,
} from '../lib/vocabulary'

function byCreatedAt(a: VocabularyItem, b: VocabularyItem): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1
}

// A lista de vocabulário de um livro (aba Vocabulary). Só carrega com `enabled`
// (as ferramentas de língua ligadas). Gravar e apagar são otimistas: na falha, o
// estado volta ao que era e a função rejeita, para quem chamou avisar.
export function useBookVocabulary(book: Book, enabled: boolean) {
  const [items, setItems] = useState<VocabularyItem[]>([])
  const itemsRef = useRef(items)
  // O ref anda junto com o estado: dois "Add" seguidos antes do render enxergam
  // um ao outro e a duplicata é pega.
  const commit = useCallback((next: VocabularyItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])
  const bookRef = useRef(book)
  bookRef.current = book
  // A carga da lista: um "Add" antes dela terminar espera por ela, para ver as
  // duplicatas e para a carga não tirar do estado o item recém-gravado.
  const loadedRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!enabled) {
      loadedRef.current = Promise.resolve()
      if (itemsRef.current.length > 0) commit([])
      return
    }
    let cancelled = false
    loadedRef.current = storage
      .getBookVocabulary(book.id)
      .then((list) => {
        if (!cancelled) commit(list)
      })
      .catch((err) => console.error('failed to load vocabulary', err))
    return () => {
      cancelled = true
    }
  }, [enabled, book.id, commit])

  // A língua do livro foi corrigida (o storage já corrigiu os itens no banco): os
  // itens em memória acompanham, senão o próximo upsert de um deles (o sentido, o
  // envio) devolveria a língua errada ao banco.
  const language = baseLanguage(book.language)
  useEffect(() => {
    const current = itemsRef.current
    if (!language || current.every((item) => item.language === language)) return
    commit(current.map((item) => (item.language === language ? item : { ...item, language })))
  }, [language, commit])

  // Guarda um item novo. 'duplicate' = o mesmo texto na mesma frase já está na
  // lista: nada é gravado.
  const add = useCallback(
    async (draft: VocabularyDraft): Promise<'added' | 'duplicate'> => {
      await loadedRef.current
      const item = buildVocabularyItem({ book: bookRef.current, ...draft })
      if (findDuplicate(itemsRef.current, item)) return 'duplicate'
      const before = itemsRef.current
      commit([...before, item])
      try {
        await storage.saveVocabularyItem(item)
      } catch (err) {
        commit(itemsRef.current.filter((i) => i.id !== item.id))
        throw err
      }
      return 'added'
    },
    [commit],
  )

  // Grava o item inteiro: devolve um removido (Undo) ou atualiza um que já está
  // na lista (o sentido de um item guardado sem tradução).
  const put = useCallback(
    async (item: VocabularyItem): Promise<void> => {
      const before = itemsRef.current
      const exists = before.some((i) => i.id === item.id)
      commit(exists ? before.map((i) => (i.id === item.id ? item : i)) : [...before, item].sort(byCreatedAt))
      try {
        await storage.saveVocabularyItem(item)
      } catch (err) {
        commit(before)
        throw err
      }
    },
    [commit],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const before = itemsRef.current
      commit(before.filter((i) => i.id !== id))
      try {
        await storage.deleteVocabularyItem(id)
      } catch (err) {
        commit(before)
        throw err
      }
    },
    [commit],
  )

  // Marca (ou, com null, desmarca) os itens como enviados a uma nota.
  const markSent = useCallback(
    async (ids: string[], sent: SentMark | null): Promise<void> => {
      if (ids.length === 0) return
      const before = itemsRef.current
      const wanted = new Set(ids)
      commit(
        before.map((i) =>
          wanted.has(i.id)
            ? {
                ...i,
                sentAt: sent?.at ?? null,
                sentNotebookId: sent?.notebookId ?? null,
                sentNoteId: sent?.noteId ?? null,
              }
            : i,
        ),
      )
      try {
        await storage.setVocabularySent(ids, sent)
      } catch (err) {
        commit(before)
        throw err
      }
    },
    [commit],
  )

  return { items, add, restore: put, update: put, remove, markSent }
}

export type BookVocabulary = ReturnType<typeof useBookVocabulary>
