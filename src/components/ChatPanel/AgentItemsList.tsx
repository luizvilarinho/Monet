import { useEffect, useState, type ReactNode } from 'react'
import { Archive, ArrowSquareOut, BookmarkSimple, BookOpen, Books, Check, Funnel } from '@phosphor-icons/react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useConfirm } from '../../hooks/useConfirm'
import {
  citationsText,
  citedItemReason,
  dmy,
  searchLine,
  type AgentItem,
  type AgentItemsPayload,
  type PaperItem,
  type WebItem,
} from '../../lib/agentItems'
import type { AgentNoteDraft } from '../../lib/agentNotes'
import { addUrlToKb } from '../../lib/librarian'
import {
  emitMincerChanged,
  getTranscriptionModel,
  mincerStart,
  resolveSummaryModel,
  splitMincerError,
} from '../../lib/mincer'
import { openPaperInLibrary } from '../../lib/paperPdf'
import { paperPdfLink, readingListMatch, type ReadingListKeys } from '../../lib/papers'
import { loadReadingList, READING_LIST_CHANGED_EVENT } from '../../lib/paperSetup'
import { loadSummarySettings, resolveSummaryPrompt } from '../Mincer/presets'
import styles from './AgentItemsList.module.css'

// Lista de itens que o app montou para o Radar e o Papers, logo embaixo do texto
// do balão, com a linha do app acima dela (escopo, janela e consultas; também
// sozinha, numa resposta sem item). Itens web: Open, Send to Mincer e Add to
// KB. Artigos: Open, Add to reading list / In reading list (Archived, quando a
// nota Paper está arquivada) e Open in Library (só com o artigo na fila e um PDF
// de acesso aberto). Cada ação roda só no clique. Os estados "Queued in Mincer" e
// "In KB" ficam no componente e não persistem: ao reabrir a conversa, o botão
// volta ao rótulo de antes (um novo clique em "Add to KB" responde "In KB" sem
// gravar de novo). A fila de leitura é relida do banco, e o botão do artigo se
// ajusta sozinho.

export interface AgentItemActions {
  // Pasta da conversa; null = chat sem pasta (o "Add to KB" some).
  kb: {
    chatFolderId: string
    folderName: string
    webResearchEnabled: boolean
    setWebResearchEnabled: (enabled: boolean) => void
    registerAiSourcesFolder: (chatFolderId: string, aiFolderId: string) => void
  } | null
  onOpenNote: (notebookId: string, noteId: string) => void
  // "Add to reading list": abre o modal do Paper; o 2º argumento é o caderno do
  // escopo (pré-seleção), null quando o escopo não é um caderno. Ausente = sem o botão.
  onAddPaper?: (draft: Extract<AgentNoteDraft, { kind: 'paper' }>, defaultNotebookId: string | null) => void
  // Abre o livro na Library (main ou janela assistant). Ausente = sem "Open in Library".
  onOpenBook?: (bookId: string) => void
}

interface ItemState {
  mincer: 'idle' | 'sending' | 'queued'
  kb: 'idle' | 'adding' | 'added'
  book: 'idle' | 'downloading'
  error: string | null
}

const IDLE: ItemState = { mincer: 'idle', kb: 'idle', book: 'idle', error: null }

// youtube.com/watch, youtube.com/shorts/, youtu.be/ e m.youtube.com.
function isYoutubeUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') return u.pathname.length > 1
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return false
    return u.pathname === '/watch' || u.pathname.startsWith('/shorts/')
  } catch {
    return false
  }
}

function kbErrorText(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  if (/Tavily key not configured/i.test(text)) return 'Add to KB needs a Tavily key (Settings > Web Search).'
  return text
}

// A data do item web vem da busca e pode ser a da última atualização da página.
function itemMeta(item: AgentItem): ReactNode {
  if (item.kind === 'web') {
    return (
      <>
        {item.source} ·{' '}
        <span title="Date reported by the search; it can be the page's last update.">{dmy(item.date)}</span>
      </>
    )
  }
  return `${item.year ?? 'n.d.'} · ${citationsText(item.citations)}`
}

// Estado do PDF do artigo. Em coluna estreita o texto encurta (o texto inteiro
// fica no tooltip).
function PdfBadge({ full, short, title }: { full: string; short: string; title: string }) {
  return (
    <span className={styles.badge} title={title}>
      <span className={styles.badgeFull}>{full}</span>
      <span className={styles.badgeShort}>{short}</span>
    </span>
  )
}

interface Props {
  payload: AgentItemsPayload
  actions: AgentItemActions
  // Resposta em streaming: a lista só aparece com o turno terminado.
  disabled: boolean
  // Id e texto (já finalizado) da mensagem: o "Add to reading list" leva o
  // motivo que o modelo deu ao artigo.
  messageId: string
  content: string
}

export function AgentItemsList({ payload, actions, disabled, messageId, content }: Props) {
  const [states, setStates] = useState<Record<string, ItemState>>({})
  // Fila de leitura (notas Paper); null = ainda lendo.
  const [readingList, setReadingList] = useState<ReadingListKeys | null>(null)
  const { confirm, modal } = useConfirm()
  const hasPapers = payload.items.some((item) => item.kind === 'paper')

  // Só com artigos na lista: lê ao montar e a cada nota Paper criada. Falha conta
  // como fila vazia.
  useEffect(() => {
    if (!hasPapers || disabled) return
    let cancelled = false
    const load = () => {
      loadReadingList()
        .then((keys) => {
          if (!cancelled) setReadingList(keys)
        })
        .catch((err) => {
          console.warn('failed to load the reading list', err)
          if (!cancelled) setReadingList(new Map())
        })
    }
    load()
    window.addEventListener(READING_LIST_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(READING_LIST_CHANGED_EVENT, load)
    }
  }, [hasPapers, disabled])

  const line = searchLine(payload.search)
  if (disabled || (payload.items.length === 0 && !line)) return null

  const stateOf = (key: string): ItemState => states[key] ?? IDLE
  const patch = (key: string, next: Partial<ItemState>) =>
    setStates((prev) => ({ ...prev, [key]: { ...(prev[key] ?? IDLE), ...next } }))

  function open(item: AgentItem) {
    if (/^https?:\/\//i.test(item.url)) void openUrl(item.url)
  }

  async function sendToMincer(item: WebItem) {
    patch(item.key, { mincer: 'sending', error: null })
    try {
      const kind = isYoutubeUrl(item.url) ? 'youtube' : 'web_summary'
      const s = loadSummarySettings(kind === 'youtube' ? 'youtube' : 'web')
      await mincerStart({
        kind,
        source: item.url,
        options: {
          transcriptionModel: getTranscriptionModel(),
          summaryModel: resolveSummaryModel(),
          preset: s.presetId,
          summaryPrompt: resolveSummaryPrompt(s),
        },
      })
      void emitMincerChanged()
      patch(item.key, { mincer: 'queued' })
    } catch (err) {
      patch(item.key, { mincer: 'idle', error: splitMincerError(String(err)).message })
    }
  }

  async function addToKb(item: WebItem) {
    const kb = actions.kb
    if (!kb) return
    patch(item.key, { error: null })
    if (!kb.webResearchEnabled) {
      const ok = await confirm(
        '"Save web sources" is off in this folder. Turning it on lets the chat read saved pages and also lets the AI save the pages it finds in web searches here. Turn it on and add this page?',
        { title: 'Add to KB', confirmLabel: 'Turn on and add', destructive: false }
      )
      if (!ok) return
      kb.setWebResearchEnabled(true)
    }
    patch(item.key, { kb: 'adding' })
    try {
      const res = await addUrlToKb({
        chatFolderId: kb.chatFolderId,
        folderName: kb.folderName,
        url: item.url,
        title: item.title,
      })
      if (res.aiFolderId) kb.registerAiSourcesFolder(kb.chatFolderId, res.aiFolderId)
      patch(item.key, { kb: 'added' })
    } catch (err) {
      patch(item.key, { kb: 'idle', error: kbErrorText(err) })
    }
  }

  async function addToReadingList(item: PaperItem) {
    if (!actions.onAddPaper) return
    patch(item.key, { error: null })
    // Outra janela pode ter adicionado o artigo desde a última leitura: relê a
    // fila antes de abrir o modal, para não duplicar.
    try {
      const keys = await loadReadingList()
      setReadingList(keys)
      if (readingListMatch(item, keys)) return
    } catch (err) {
      console.warn('failed to load the reading list', err)
    }
    actions.onAddPaper(
      {
        kind: 'paper',
        messageId: `${messageId}:${item.key}`,
        paper: item,
        reason: citedItemReason(content, item),
        agentLabel: item.section === 'radar' ? 'Radar' : 'Papers',
      },
      payload.scopeNotebookId
    )
  }

  async function openInLibrary(item: PaperItem, note: { noteId: string; notebookId: string | null }) {
    patch(item.key, { book: 'downloading', error: null })
    try {
      const bookId = await openPaperInLibrary(item, { id: note.noteId, notebookId: note.notebookId })
      actions.onOpenBook?.(bookId)
      patch(item.key, { book: 'idle' })
    } catch (err) {
      patch(item.key, { book: 'idle', error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Ações do artigo depois do "Open": fila de leitura e PDF de acesso aberto.
  function paperActions(item: PaperItem, st: ItemState) {
    const match = readingList ? readingListMatch(item, readingList) : null
    const hasPdf = paperPdfLink(item) !== null
    return (
      <>
        {match ? (
          <button
            type="button"
            className={match.archived ? styles.btn : `${styles.btn} ${styles.btnOn}`}
            onClick={() => actions.onOpenNote(match.notebookId ?? '', match.noteId)}
            title={match.archived ? 'Archived Paper note · click to open' : "Open this paper's note"}
          >
            {match.archived ? (
              <Archive size={13} aria-hidden />
            ) : (
              <BookmarkSimple size={13} weight="fill" aria-hidden />
            )}
            {match.archived ? 'Archived' : 'In reading list'}
          </button>
        ) : (
          actions.onAddPaper && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => void addToReadingList(item)}
              disabled={!readingList}
              title="Create a Paper note for this article"
            >
              <BookmarkSimple size={13} aria-hidden />
              Add to reading list
            </button>
          )
        )}
        {hasPdf ? (
          match ? (
            actions.onOpenBook && (
              <button
                type="button"
                className={styles.btn}
                onClick={() => void openInLibrary(item, match)}
                disabled={st.book !== 'idle'}
                title="Download the open-access PDF and read it in the Library"
              >
                <BookOpen size={13} aria-hidden />
                {st.book === 'downloading' ? 'Downloading…' : 'Open in Library'}
              </button>
            )
          ) : (
            readingList && (
              <PdfBadge
                full="Open-access PDF"
                short="PDF available"
                title="Open-access PDF. Add it to your reading list to read it in the Library."
              />
            )
          )
        ) : (
          <PdfBadge
            full={item.isOa ? 'Open access (no direct PDF)' : 'No open-access PDF'}
            short="No PDF"
            title={item.isOa ? 'Open access (no direct PDF)' : 'No open-access PDF'}
          />
        )}
      </>
    )
  }

  return (
    <>
      {line && <p className={styles.searchLine}>{line}</p>}
      {payload.items.length > 0 && (
        <ul className={styles.list} aria-label="Items found">
          {payload.items.map((item) => {
            const st = stateOf(item.key)
            return (
              <li key={item.key} className={styles.item}>
                <div className={styles.row}>
                  <div className={styles.info}>
                    <span className={styles.title} title={item.title}>
                      {item.title}
                    </span>
                    <span className={styles.meta}>{itemMeta(item)}</span>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btn} onClick={() => open(item)} title="Open in your browser">
                      <ArrowSquareOut size={13} aria-hidden />
                      Open
                    </button>
                    {item.kind === 'web' && (
                      <button
                        type="button"
                        className={st.mincer === 'queued' ? styles.btnDone : styles.btn}
                        onClick={() => void sendToMincer(item)}
                        disabled={st.mincer !== 'idle'}
                        title={
                          isYoutubeUrl(item.url)
                            ? 'Queue this video in the Mincer (transcript and summary)'
                            : 'Queue this page in the Mincer (summary)'
                        }
                      >
                        {st.mincer === 'queued' ? <Check size={13} aria-hidden /> : <Funnel size={13} aria-hidden />}
                        {st.mincer === 'sending' ? 'Sending…' : st.mincer === 'queued' ? 'Queued in Mincer' : 'Send to Mincer'}
                      </button>
                    )}
                    {item.kind === 'web' && actions.kb && (
                      <button
                        type="button"
                        className={st.kb === 'added' ? styles.btnDone : styles.btn}
                        onClick={() => void addToKb(item)}
                        disabled={st.kb !== 'idle'}
                        title="Save this page's text to this folder's knowledge base"
                      >
                        {st.kb === 'added' ? <Check size={13} aria-hidden /> : <Books size={13} aria-hidden />}
                        {st.kb === 'adding' ? 'Adding…' : st.kb === 'added' ? 'In KB' : 'Add to KB'}
                      </button>
                    )}
                    {item.kind === 'paper' && paperActions(item, st)}
                  </div>
                </div>
                {st.error && (
                  <p className={styles.error} role="alert">
                    {st.error}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {modal}
    </>
  )
}
