import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Note, Tracker, TrackerMark } from '../types'
import { storage } from '../storage'
import { uniqueName } from '../lib/tasks'
import {
  autoTrackerColor,
  buildTrackerDays,
  DEFAULT_TRACKER_ICON,
  markSaveError,
  MAX_TRACKER_NAME,
  MAX_WEEKLY_TARGET,
  MIN_WEEKLY_TARGET,
} from '../lib/trackers'
import { emitTrackersChanged, loadAndSyncWithRetry, TRACKERS_CHANGED_EVENT } from '../lib/tasksEvents'

export type TrackerPatch = Partial<Pick<Tracker, 'name' | 'weeklyTarget' | 'color' | 'icon' | 'linkedTypeId'>>

function maxOrder(list: Array<{ sortOrder: number }>): number {
  return list.reduce((m, x) => Math.max(m, x.sortOrder), 0)
}

function clampTarget(n: number): number {
  return Math.min(MAX_WEEKLY_TARGET, Math.max(MIN_WEEKLY_TARGET, Math.round(n)))
}

// Nome aparado, obrigatório e único (sem caixa/acentos) entre `others`;
// lança para a UI.
function validName(name: string, others: Tracker[], exceptId: string | null): string {
  const { name: trimmed, clash } = uniqueName(name, MAX_TRACKER_NAME, others, exceptId)
  if (!trimmed) throw new Error('Name is required.')
  if (clash) {
    throw new Error(
      clash.archivedAt !== null
        ? 'An archived tracker has this name. Unarchive it?'
        : 'A tracker with this name already exists.'
    )
  }
  return trimmed
}

// Registro dos trackers de constância e das marcas por dia, no padrão do
// useNoteTypes: SQLite compartilhado entre janelas, recarrega em
// `trackers-changed` de outra janela e avisa a cada mutação. Uma instância por
// janela (o evento ignora a própria origem). `notes` e `todayKey` só alimentam
// os dias vindos de nota (`days`); o hook não conhece tipos de nota nem Calendar.
export function useTrackers(opts: { notes: Note[]; todayKey: string }) {
  const [trackers, setTrackers] = useState<Tracker[]>([])
  const [marks, setMarks] = useState<TrackerMark[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  // Falha ao gravar a marca de um dia: a linha curta da faixa e dos chips. Some na
  // próxima marca gravada.
  const [markError, setMarkError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // A 1ª leitura terminou: antes dela, a lista vazia não quer dizer "nenhum tracker".
  const [loaded, setLoaded] = useState(false)
  const trackersRef = useRef(trackers)
  trackersRef.current = trackers
  const marksRef = useRef(marks)
  marksRef.current = marks
  const todayKeyRef = useRef(opts.todayKey)
  todayKeyRef.current = opts.todayKey

  const reload = useCallback(async (): Promise<boolean> => {
    try {
      const [trackerList, markList] = await Promise.all([storage.getTrackers(), storage.getTrackerMarks()])
      setTrackers(trackerList)
      setMarks(markList)
      setLoadFailed(false)
      setLoaded(true)
      return true
    } catch (err) {
      console.error('failed to load trackers', err)
      setLoadFailed(true)
      return false
    }
  }, [])

  // A 1ª leitura cria as tabelas (escrita): se falhar, tenta de novo com espera,
  // senão a sessão inteira fica sem trackers.
  useEffect(() => {
    return loadAndSyncWithRetry(reload, TRACKERS_CHANGED_EVENT)
  }, [reload])

  const persist = useCallback(async (op: () => Promise<void>, what: string): Promise<boolean> => {
    try {
      await op()
      setSaveError(null)
      emitTrackersChanged()
      return true
    } catch (err) {
      console.error(`failed to ${what}`, err)
      setSaveError('Failed to save tracker.')
      return false
    }
  }, [])

  const active = useMemo(() => trackers.filter((t) => t.archivedAt === null), [trackers])
  // Dias de todos os trackers, arquivados incluídos: o modal confere os dias vindos
  // de nota antes de trocar o vínculo de qualquer um.
  const days = useMemo(
    () => buildTrackerDays(trackers, marks, opts.notes, opts.todayKey),
    [trackers, marks, opts.notes, opts.todayKey]
  )

  const createTracker = useCallback(
    async (name: string): Promise<Tracker> => {
      const list = trackersRef.current
      const now = Date.now()
      const tracker: Tracker = {
        id: `tr_${nanoid(8)}`,
        name: validName(name, list, null),
        weeklyTarget: 3,
        color: autoTrackerColor(list.length),
        icon: DEFAULT_TRACKER_ICON,
        sortOrder: maxOrder(list) + 1,
        linkedTypeId: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      setTrackers((l) => [...l, tracker])
      await persist(() => storage.saveTracker(tracker), 'create tracker')
      return tracker
    },
    [persist]
  )

  const updateTracker = useCallback(
    async (id: string, patch: TrackerPatch) => {
      const current = trackersRef.current.find((t) => t.id === id)
      if (!current) return
      const next: Tracker = { ...current, ...patch, updatedAt: Date.now() }
      if (patch.name !== undefined) next.name = validName(patch.name, trackersRef.current, id)
      if (patch.weeklyTarget !== undefined) {
        next.weeklyTarget = Number.isFinite(patch.weeklyTarget) ? clampTarget(patch.weeklyTarget) : current.weeklyTarget
      }
      setTrackers((list) => list.map((t) => (t.id === id ? next : t)))
      await persist(() => storage.saveTracker(next), 'save tracker')
    },
    [persist]
  )

  // `ids` = os ativos na ordem nova; os arquivados ficam atrás deles, na ordem
  // em que estavam. Grava só as linhas cujo sort_order mudou, uma execução por
  // linha (sem BEGIN/COMMIT: pool sqlx); falha parcial só deixa a ordem misturada.
  const reorderTrackers = useCallback(
    async (ids: string[]) => {
      const current = trackersRef.current
      const activeNow = current.filter((t) => t.archivedAt === null)
      const ordered = ids
        .map((id) => activeNow.find((t) => t.id === id))
        .filter((t): t is Tracker => !!t)
      if (ordered.length !== activeNow.length) return
      const before = new Map(current.map((t) => [t.id, t.sortOrder]))
      const next = [...ordered, ...current.filter((t) => t.archivedAt !== null)].map((t, i) => ({
        ...t,
        sortOrder: i,
      }))
      setTrackers(next)
      await persist(async () => {
        for (const t of next) if (before.get(t.id) !== t.sortOrder) await storage.saveTracker(t)
      }, 'reorder trackers')
    },
    [persist]
  )

  // Arquivar mantém o histórico (as marcas ficam) e tira o tracker de `active`.
  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const current = trackersRef.current.find((t) => t.id === id)
      if (!current) return
      const now = Date.now()
      const next: Tracker = { ...current, archivedAt: archived ? now : null, updatedAt: now }
      setTrackers((list) => list.map((t) => (t.id === id ? next : t)))
      await persist(() => storage.saveTracker(next), 'archive tracker')
    },
    [persist]
  )

  // Só sai da memória se o banco apagou (marcas e depois o tracker).
  const deleteTracker = useCallback(
    async (id: string) => {
      if (!(await persist(() => storage.deleteTracker(id), 'delete tracker'))) return
      setTrackers((list) => list.filter((t) => t.id !== id))
      setMarks((list) => list.filter((m) => m.trackerId !== id))
    },
    [persist]
  )

  const countMarks = useCallback((id: string): Promise<number> => storage.countTrackerMarks(id), [])

  // O erro de gravação (de marca ou de tracker) que o modal de gestão mostra e o
  // da marca na faixa e nos chips: quem abre o modal os limpa, para ele não
  // mostrar uma falha antiga sem contexto.
  const clearErrors = useCallback(() => {
    setSaveError(null)
    setMarkError(null)
  }, [])

  // Dia futuro não aceita marca. Atualização otimista; se não gravar, a memória
  // volta ao que era e o erro vai para `markError` (e `saveError`).
  const setMark = useCallback(
    async (trackerId: string, day: string, on: boolean) => {
      if (day > todayKeyRef.current) return
      const same = (m: TrackerMark) => m.trackerId === trackerId && m.day === day
      const previous = marksRef.current.find(same)
      const mark: TrackerMark = { trackerId, day, createdAt: Date.now() }
      setMarks((list) => (on ? (list.some(same) ? list : [...list, mark]) : list.filter((m) => !same(m))))
      if (await persist(() => storage.setTrackerMark(trackerId, day, on), 'save tracker mark')) {
        setMarkError(null)
        return
      }
      const name = trackersRef.current.find((t) => t.id === trackerId)?.name ?? 'tracker'
      setMarkError(markSaveError(name, day))
      setMarks((list) => {
        const rest = list.filter((m) => !same(m))
        return previous ? [...rest, previous] : rest
      })
    },
    [persist]
  )

  return {
    trackers,
    active,
    days,
    saveError: saveError ?? (loadFailed ? 'Failed to load trackers.' : null),
    markError,
    // A leitura falhou: a lista vazia não quer dizer "nenhum tracker".
    loadFailed,
    loaded,
    clearErrors,
    reload,
    createTracker,
    updateTracker,
    reorderTrackers,
    setArchived,
    deleteTracker,
    countMarks,
    setMark,
  }
}

export type TrackersRegistry = ReturnType<typeof useTrackers>
