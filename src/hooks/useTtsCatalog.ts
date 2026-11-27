import { useEffect, useState } from 'react'
import { ttsCatalog, type TtsModel } from '../lib/speech'

export interface TtsCatalogState {
  models: TtsModel[]
  loading: boolean
  error: string | null
}

// Uma busca por sessão: os leitores e o Settings dividem o resultado. Falha não
// fica guardada, então abrir o Settings de novo tenta outra vez.
let loaded: TtsModel[] | null = null
let inflight: Promise<TtsModel[]> | null = null

function load(): Promise<TtsModel[]> {
  if (loaded) return Promise.resolve(loaded)
  if (!inflight) {
    inflight = ttsCatalog()
      .then((models) => {
        loaded = models
        return models
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'string' ? e : 'Could not load the voice models.'
}

// Lista de modelos de voz lida do catálogo do OpenRouter. Sem rede e sem cópia
// guardada, `models` fica vazio e quem usa mostra o modelo salvo como única
// opção. `enabled` false não busca nada (livro sem ferramentas de língua).
export function useTtsCatalog(enabled = true): TtsCatalogState {
  const [state, setState] = useState<TtsCatalogState>(() =>
    loaded ? { models: loaded, loading: false, error: null } : { models: [], loading: enabled, error: null },
  )

  useEffect(() => {
    if (!enabled) return
    if (loaded) {
      setState({ models: loaded, loading: false, error: null })
      return
    }
    let alive = true
    setState((current) => ({ ...current, loading: true }))
    load().then(
      (models) => alive && setState({ models, loading: false, error: null }),
      (e) => alive && setState({ models: [], loading: false, error: errorText(e) }),
    )
    return () => {
      alive = false
    }
  }, [enabled])

  return state
}
