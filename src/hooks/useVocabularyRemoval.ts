import { useCallback } from 'react'
import type { VocabularyItem } from '../types'
import type { ShowReaderToast } from '../components/Reader/ReaderToast'
import type { BookVocabulary } from './useBookVocabulary'

// Remover itens da lista (a aba e o popover da palavra marcada): sem confirmação,
// com um aviso que tem Undo. Não mexe na nota que já recebeu o item.
export function useVocabularyRemoval(params: { vocabulary: BookVocabulary; showToast: ShowReaderToast }) {
  const { vocabulary, showToast } = params
  return useCallback(
    async (items: VocabularyItem[]): Promise<void> => {
      if (items.length === 0) return
      try {
        for (const item of items) await vocabulary.remove(item.id)
      } catch (err) {
        console.error('failed to remove the vocabulary item', err)
        showToast({ message: "Couldn't remove the item. Try again.", tone: 'error' })
        return
      }
      showToast({
        message: items.length === 1 ? 'Removed from vocabulary' : `Removed ${items.length} items from vocabulary`,
        actions: [
          {
            label: 'Undo',
            // Um de cada vez, como o remove: cada gravação reverte para o retrato que
            // tirou, e em paralelo a falha de uma desfaria as que já tinham entrado.
            onClick: () =>
              void (async () => {
                try {
                  for (const item of items) await vocabulary.restore(item)
                } catch (err) {
                  console.error('failed to restore the vocabulary item', err)
                  showToast({ message: "Couldn't restore the item. Try again.", tone: 'error' })
                }
              })(),
          },
        ],
      })
    },
    [vocabulary, showToast],
  )
}
