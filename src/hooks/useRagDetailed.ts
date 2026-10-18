import { useCallback, useEffect, useState } from 'react'
import { RAG_DETAILED_KEY } from '../lib/rag'

// Avisa os outros componentes da mesma janela; o evento `storage` cobre as
// outras janelas (main × assistant).
const CHANGE_EVENT = 'monet:rag-detailed-change'

function readDetailed(): boolean {
  try {
    return localStorage.getItem(RAG_DETAILED_KEY) === '1'
  } catch {
    return false
  }
}

// Modo detalhado do RAG ("Retrieval details"): mostra o inspetor por resposta.
export function useRagDetailed(): [boolean, (value: boolean) => void] {
  const [detailed, setDetailedState] = useState(readDetailed)

  useEffect(() => {
    const sync = () => setDetailedState(readDetailed())
    // Só a chave do modo (key null = storage limpo): as gravações do chat da
    // outra janela disparam `storage` a cada chunk de streaming.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === RAG_DETAILED_KEY) sync()
    }
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setDetailed = useCallback((value: boolean) => {
    try {
      if (value) localStorage.setItem(RAG_DETAILED_KEY, '1')
      else localStorage.removeItem(RAG_DETAILED_KEY)
    } catch {
      // Sem storage: o modo fica só no estado desta janela.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
    setDetailedState(value)
  }, [])

  return [detailed, setDetailed]
}
