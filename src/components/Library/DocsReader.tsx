import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CaretDown,
  CaretRight,
  FileText,
  SidebarSimple,
} from '@phosphor-icons/react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { renderMarkdown } from '../../lib/markdown'
import {
  addHeadingIds,
  clearOpenDoc,
  docsReadFile,
  docsTree,
  docsWatchStart,
  docsWatchStop,
  loadDocsReaderFont,
  loadDocsReaderMargin,
  loadOpenDoc,
  onDocsChanged,
  saveDocsReaderFont,
  saveDocsReaderMargin,
  saveOpenDoc,
  stripFrontmatter,
  type DocsFolder,
  type DocsTreeNode,
} from '../../lib/docsFolder'
import styles from './DocsReader.module.css'

export interface DocsReaderProps {
  folder: DocsFolder
  onBack: () => void
}

// Faixas idênticas às do EpubReader (duplicação deliberada — os leitores são
// independentes por decisão de arquitetura).
const MIN_FONT_SCALE = 0.8
const MAX_FONT_SCALE = 2
const FONT_SCALE_STEP = 0.1
const MIN_MARGIN_PX = 0
const MAX_MARGIN_PX = 160
const MARGIN_STEP_PX = 16
const DEFAULT_MARGIN_PX = 0
// Respiro mínimo entre o texto e a borda da folha (somado à margem do usuário).
const DOC_PADDING_X_PX = 40

// Diferente do EpubReader, o painel começa aberto: a árvore é a única forma
// de navegar e, sem documento aberto, escondê-la deixa a tela vazia.
const SIDE_PANEL_COLLAPSED_KEY = 'monet:docs-reader-sidepanel-collapsed'
const SIDE_PANEL_WIDTH = 280
const SIDE_PANEL_COLLAPSED_WIDTH = 48

// Rajadas de save de editor disparam vários eventos do notify; o debounce
// concentra tudo num re-scan só (o Rust emite um evento por batch).
const WATCH_DEBOUNCE_MS = 300

const FOLDER_ERROR =
  'This folder could not be found or opened. It may have been moved or deleted.'
const DOC_REMOVED_ERROR = 'This document was removed or renamed outside Monet.'
const DOC_READ_ERROR = 'This document could not be opened.'

// Documento aberto quando a pasta não tem um "último lido" salvo.
const DEFAULT_DOC_NAMES = ['readme.md', 'index.md']

type ScrollIntent =
  | { kind: 'top' }
  | { kind: 'restore'; top: number }
  | { kind: 'anchor'; id: string }

function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return 1
  const clamped = Math.min(Math.max(MIN_FONT_SCALE, value), MAX_FONT_SCALE)
  return Math.round(clamped * 100) / 100
}

function clampMargin(raw: number): number {
  const clamped = Math.min(MAX_MARGIN_PX, Math.max(MIN_MARGIN_PX, raw))
  return Math.round(clamped / MARGIN_STEP_PX) * MARGIN_STEP_PX
}

function fontSizeCss(scale: number): string {
  return `${Math.round(scale * 100)}%`
}

function findNode(node: DocsTreeNode, relPath: string): DocsTreeNode | null {
  if (node.relPath === relPath) return node
  for (const child of node.children) {
    const found = findNode(child, relPath)
    if (found) return found
  }
  return null
}

// Links relativos entre .md podem diferir no caso das letras do path real;
// a busca na árvore é case-insensitive e devolve o nó com o relPath canônico.
function findNodeCaseInsensitive(
  node: DocsTreeNode,
  relPath: string,
): DocsTreeNode | null {
  if (node.relPath.toLowerCase() === relPath.toLowerCase()) return node
  for (const child of node.children) {
    const found = findNodeCaseInsensitive(child, relPath)
    if (found) return found
  }
  return null
}

function collectDirPaths(node: DocsTreeNode, out: Set<string>): void {
  if (!node.isDir) return
  out.add(node.relPath)
  for (const child of node.children) collectDirPaths(child, out)
}

// README.md / index.md de uma pasta: alvo de links para a pasta (`guide/`) e
// documento inicial quando não há leitura a retomar.
function findDefaultDoc(dir: DocsTreeNode): DocsTreeNode | null {
  for (const name of DEFAULT_DOC_NAMES) {
    const found = dir.children.find(
      (c) => !c.isDir && c.name.toLowerCase() === name,
    )
    if (found) return found
  }
  return null
}

// Pastas ancestrais de um relPath ("a/b/c.md" → ["a", "a/b"]).
function ancestorDirs(relPath: string): string[] {
  const parts = relPath.split('/').slice(0, -1)
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
}

// O sanitize prefixa ids com `user-content-` (notas de rodapé do GFM); os ids
// dos headings são postos depois, sem prefixo. Tenta as duas formas.
function findAnchorTarget(container: HTMLElement, id: string): Element | null {
  return (
    container.querySelector(`#${CSS.escape(id)}`) ??
    container.querySelector(`#${CSS.escape(`user-content-${id}`)}`)
  )
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Resolve `href` (de um link relativo) contra o diretório do documento aberto,
// normalizando separadores e segmentos `.`/`..`; `/x.md` parte da raiz.
function resolveRelativePath(fromRelPath: string, href: string): string | null {
  const normalized = href.replace(/\\/g, '/')
  const segments = normalized.startsWith('/')
    ? []
    : fromRelPath.split('/').slice(0, -1)
  for (const seg of normalized.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (segments.length === 0) return null
      segments.pop()
    } else {
      segments.push(seg)
    }
  }
  return segments.join('/')
}

interface DocsTreeListProps {
  nodes: DocsTreeNode[]
  depth: number
  expanded: Set<string>
  activePath: string | null
  onToggleDir: (relPath: string) => void
  onOpenDoc: (relPath: string) => void
}

// Modelo: TocList do EpubReader — árvore recursiva com indentação por depth.
function DocsTreeList({
  nodes,
  depth,
  expanded,
  activePath,
  onToggleDir,
  onOpenDoc,
}: DocsTreeListProps) {
  return (
    <ul className={styles.tocList} data-depth={depth}>
      {nodes.map((node) => (
        <li key={node.relPath}>
          {node.isDir ? (
            <>
              <button
                type="button"
                className={styles.tocItem}
                title={node.name}
                aria-expanded={expanded.has(node.relPath)}
                onClick={() => onToggleDir(node.relPath)}
              >
                <span className={styles.tocItemIcon}>
                  {expanded.has(node.relPath) ? (
                    <CaretDown size={12} aria-hidden />
                  ) : (
                    <CaretRight size={12} aria-hidden />
                  )}
                </span>
                <span className={styles.tocItemLabel}>{node.name}</span>
              </button>
              {expanded.has(node.relPath) && node.children.length > 0 && (
                <DocsTreeList
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  activePath={activePath}
                  onToggleDir={onToggleDir}
                  onOpenDoc={onOpenDoc}
                />
              )}
            </>
          ) : (
            <button
              type="button"
              className={`${styles.tocItem} ${
                activePath === node.relPath ? styles.tocItemActive : ''
              }`}
              title={node.name}
              aria-current={activePath === node.relPath ? 'page' : undefined}
              onClick={() => onOpenDoc(node.relPath)}
            >
              <span className={styles.tocItemIcon}>
                <FileText size={12} aria-hidden />
              </span>
              <span className={styles.tocItemLabel}>{node.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function DocsReader({ folder, onBack }: DocsReaderProps) {
  const { id: folderId, root, alias } = folder
  const [tree, setTree] = useState<DocsTreeNode | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  // Documento selecionado na árvore. Continua selecionado quando some do disco:
  // save atômico de editor (remove + create) faz o arquivo voltar logo depois.
  const [currentDoc, setCurrentDoc] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  // Incrementa a cada carga bem-sucedida: dispara a decisão de scroll mesmo
  // quando o HTML relido é idêntico (docHtml não muda de valor).
  const [docVersion, setDocVersion] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [fontScale, setFontScale] = useState(() =>
    clampFontScale(loadDocsReaderFont() ?? 1),
  )
  const [marginPx, setMarginPx] = useState(() =>
    clampMargin(loadDocsReaderMargin() ?? DEFAULT_MARGIN_PX),
  )
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(
    () => localStorage.getItem(SIDE_PANEL_COLLAPSED_KEY) === '1',
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const treePanelRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef(tree)
  treeRef.current = tree
  const currentDocRef = useRef(currentDoc)
  currentDocRef.current = currentDoc
  // Leituras concorrentes (cliques rápidos, re-scan do watcher): só a última
  // pedida aplica o resultado.
  const loadSeqRef = useRef(0)
  // O que fazer com o scroll quando o HTML novo entrar na tela.
  const scrollIntentRef = useRef<ScrollIntent | null>(null)
  // Posição de leitura do doc que sumiu do disco, para restaurar se voltar.
  const missingScrollRef = useRef<number | null>(null)
  // Trazer o item ativo para a vista da árvore depois de expandir as pastas
  // ancestrais.
  const revealActiveRef = useRef(false)

  // React 19 reescreve o innerHTML sempre que o objeto { __html } muda de
  // identidade — sem memo, qualquer re-render (fonte, árvore) apagava a seleção.
  const docMarkup = useMemo(
    () => (docHtml === null ? undefined : { __html: docHtml }),
    [docHtml],
  )

  const openDoc = useCallback(
    async (
      relPath: string,
      opts?: { anchor?: string | null; preserveScroll?: boolean },
    ) => {
      const seq = ++loadSeqRef.current
      const preserve = opts?.preserveScroll ?? false
      // Releitura pelo watcher não mexe na árvore, exceto quando o doc tinha
      // sumido: a pasta dele saiu do conjunto de expandidas no re-scan.
      const reveal = !preserve || missingScrollRef.current != null
      if (!preserve) {
        missingScrollRef.current = null
        setDocError(null)
      }
      const keepScroll = preserve
        ? (missingScrollRef.current ?? scrollRef.current?.scrollTop ?? 0)
        : null
      setCurrentDoc(relPath)
      setDocLoading(true)
      try {
        const md = await docsReadFile(root, relPath)
        const html = addHeadingIds(await renderMarkdown(stripFrontmatter(md)))
        if (seq !== loadSeqRef.current) return
        missingScrollRef.current = null
        scrollIntentRef.current =
          keepScroll != null
            ? { kind: 'restore', top: keepScroll }
            : opts?.anchor
              ? { kind: 'anchor', id: opts.anchor }
              : { kind: 'top' }
        setDocError(null)
        setDocHtml(html)
        setDocVersion((v) => v + 1)
        if (reveal) {
          // Expande as pastas ancestrais para o item ativo aparecer na árvore.
          revealActiveRef.current = true
          const ancestors = ancestorDirs(relPath)
          setExpanded((prev) =>
            ancestors.every((d) => prev.has(d))
              ? prev
              : new Set([...prev, ...ancestors]),
          )
        }
        saveOpenDoc(folderId, relPath)
      } catch (e) {
        if (seq !== loadSeqRef.current) return
        const message = String(e)
        if (message.includes('Documentation folder')) {
          setFolderError(FOLDER_ERROR)
          return
        }
        const removed = message.includes('not found')
        setDocHtml(null)
        setDocError(removed ? DOC_REMOVED_ERROR : DOC_READ_ERROR)
        if (removed) clearOpenDoc(folderId)
      } finally {
        if (seq === loadSeqRef.current) setDocLoading(false)
      }
    },
    [root, folderId],
  )

  const refreshTree = useCallback(async (): Promise<DocsTreeNode> => {
    const next = await docsTree(root)
    setTree(next)
    // Pastas que sumiram do disco saem do conjunto de expandidas; as demais
    // mantêm o estado de expansão entre re-scans.
    const existing = new Set<string>()
    collectDirPaths(next, existing)
    setExpanded((prev) => new Set([...prev].filter((p) => existing.has(p))))
    return next
  }, [root])

  // Carga inicial: árvore + retomada do último documento aberto (ou o
  // README/index da raiz). Primeiro nível de pastas aberto por padrão.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await refreshTree()
        if (cancelled) return
        setExpanded(
          new Set(
            next.children.filter((c) => c.isDir).map((c) => c.relPath),
          ),
        )
        const saved = loadOpenDoc(folderId)
        const savedNode = saved ? findNode(next, saved) : null
        const target =
          savedNode && !savedNode.isDir ? savedNode : findDefaultDoc(next)
        if (target) await openDoc(target.relPath)
      } catch {
        if (!cancelled) setFolderError(FOLDER_ERROR)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshTree, openDoc, folderId])

  // Watcher em tempo real: o Rust observa a pasta recursivamente e emite
  // docs://changed; aqui o debounce transforma a rajada num re-scan só.
  // O watcher vive enquanto o DocsReader está montado (não vaza para o Library).
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    // Um re-scan por vez; evento durante um re-scan agenda mais um no fim.
    let refreshing = false
    let refreshAgain = false

    const refreshFromDisk = async () => {
      if (refreshing) {
        refreshAgain = true
        return
      }
      refreshing = true
      try {
        const next = await refreshTree()
        if (cancelled) return
        const current = currentDocRef.current
        if (!current) return
        if (!findNode(next, current)) {
          // Sumiu do disco: mostra o aviso mas mantém o doc selecionado — se
          // voltar num próximo evento (save atômico), reabre na mesma posição.
          if (missingScrollRef.current == null) {
            missingScrollRef.current = scrollRef.current?.scrollTop ?? 0
          }
          loadSeqRef.current++
          setDocHtml(null)
          setDocLoading(false)
          setDocError(DOC_REMOVED_ERROR)
          return
        }
        await openDoc(current, { preserveScroll: true })
      } catch {
        if (!cancelled) setFolderError(FOLDER_ERROR)
      } finally {
        refreshing = false
        if (refreshAgain && !cancelled) {
          refreshAgain = false
          void refreshFromDisk()
        }
      }
    }

    // Assina antes de ligar o watcher para não perder eventos no intervalo.
    const watchIdPromise = onDocsChanged((event) => {
      if (event.root !== root) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        if (!cancelled) void refreshFromDisk()
      }, WATCH_DEBOUNCE_MS)
    })
      .then((un) => {
        if (cancelled) {
          un()
          return null
        }
        unlisten = un
        return docsWatchStart(root)
      })
      .catch((e) => {
        console.error('failed to start docs watcher', e)
        return null
      })

    return () => {
      cancelled = true
      if (debounceTimer) clearTimeout(debounceTimer)
      if (unlisten) unlisten()
      void watchIdPromise.then((id) => {
        if (id != null) void docsWatchStop(id).catch(() => {})
      })
    }
  }, [root, refreshTree, openDoc])

  useEffect(() => {
    if (!revealActiveRef.current) return
    const active = treePanelRef.current?.querySelector('[aria-current="page"]')
    if (!active) return
    revealActiveRef.current = false
    active.scrollIntoView({ block: 'nearest' })
  }, [currentDoc, expanded, tree])

  // Aplica a decisão de scroll antes do paint, depois de cada carga.
  useLayoutEffect(() => {
    const intent = scrollIntentRef.current
    const el = scrollRef.current
    if (!intent || !el) return
    scrollIntentRef.current = null
    if (intent.kind === 'restore') {
      el.scrollTop = intent.top
    } else if (intent.kind === 'anchor') {
      const target = findAnchorTarget(el, intent.id)
      if (target) target.scrollIntoView()
      else el.scrollTop = 0
    } else {
      el.scrollTop = 0
    }
  }, [docVersion])

  useEffect(() => {
    saveDocsReaderFont(fontScale)
  }, [fontScale])

  useEffect(() => {
    saveDocsReaderMargin(marginPx)
  }, [marginPx])

  useEffect(() => {
    try {
      localStorage.setItem(
        SIDE_PANEL_COLLAPSED_KEY,
        sidePanelCollapsed ? '1' : '0',
      )
    } catch (err) {
      console.error('failed to persist docs reader side panel toggle', err)
    }
  }, [sidePanelCollapsed])

  function toggleDir(relPath: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(relPath)) next.delete(relPath)
      else next.add(relPath)
      return next
    })
  }

  function changeFontScale(next: number) {
    const scale = clampFontScale(next)
    if (scale !== fontScale) setFontScale(scale)
  }

  function changeMargin(next: number) {
    const margin = clampMargin(next)
    if (margin !== marginPx) setMarginPx(margin)
  }

  // Cliques no HTML renderizado: âncoras internas rolam no próprio container,
  // links http(s)/mailto abrem fora do app e links relativos abrem o documento
  // correspondente da árvore (sensação de wiki local). Link para pasta abre o
  // README/index dela; link sem extensão tenta o `.md` de mesmo nome.
  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchorEl = (e.target as HTMLElement).closest('a')
    if (!anchorEl) return
    const href = anchorEl.getAttribute('href')
    if (!href) return
    e.preventDefault()

    const container = scrollRef.current
    if (href.startsWith('#')) {
      const id = safeDecode(href.slice(1))
      if (container) findAnchorTarget(container, id)?.scrollIntoView()
      return
    }
    if (/^(https?:\/\/|mailto:)/i.test(href)) {
      void openUrl(href).catch((err) =>
        console.error('failed to open link', err),
      )
      return
    }
    // Outros esquemas (file:, ftp:…) não são abertos pelo leitor.
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return

    const current = currentDocRef.current
    const currentTree = treeRef.current
    if (!current || !currentTree) return
    const hashIndex = href.indexOf('#')
    const pathPart = (hashIndex === -1 ? href : href.slice(0, hashIndex)).split(
      '?',
    )[0]
    const anchor =
      hashIndex === -1 ? null : safeDecode(href.slice(hashIndex + 1)) || null
    const resolved = resolveRelativePath(current, safeDecode(pathPart))
    if (resolved == null) return

    let node = findNodeCaseInsensitive(currentTree, resolved)
    if (node?.isDir) node = findDefaultDoc(node)
    if (!node && !/\.md$/i.test(resolved)) {
      node = findNodeCaseInsensitive(currentTree, `${resolved}.md`)
    }
    if (!node || node.isDir) return
    if (node.relPath === current && anchor) {
      if (container) findAnchorTarget(container, anchor)?.scrollIntoView()
      return
    }
    void openDoc(node.relPath, { anchor })
  }

  if (folderError) {
    return (
      <div className={styles.reader}>
        <div className={styles.errorState}>
          <p className={styles.errorMessage}>{folderError}</p>
          <button type="button" className={styles.primary} onClick={onBack}>
            Back to Library
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.reader}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Library
        </button>
        <span className={styles.toolbarTitle} title={root}>
          {alias}
          {currentDoc && (
            <span className={styles.toolbarDoc}> / {currentDoc}</span>
          )}
        </span>

        <div className={styles.fontControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeFontScale(fontScale - FONT_SCALE_STEP)}
            disabled={fontScale <= MIN_FONT_SCALE}
            aria-label="Decrease text size"
          >
            −
          </button>
          <span className={styles.fontLabel}>{fontSizeCss(fontScale)}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeFontScale(fontScale + FONT_SCALE_STEP)}
            disabled={fontScale >= MAX_FONT_SCALE}
            aria-label="Increase text size"
          >
            +
          </button>
        </div>

        <div className={styles.fontControls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeMargin(marginPx - MARGIN_STEP_PX)}
            disabled={marginPx <= MIN_MARGIN_PX}
            aria-label="Decrease margin"
          >
            −
          </button>
          <span className={styles.fontLabel}>{marginPx}px</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => changeMargin(marginPx + MARGIN_STEP_PX)}
            disabled={marginPx >= MAX_MARGIN_PX}
            aria-label="Increase margin"
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.readerBody}>
        <aside
          className={`${styles.sidePanel} ${
            sidePanelCollapsed ? styles.sidePanelCollapsed : ''
          }`}
          style={{
            width: sidePanelCollapsed
              ? SIDE_PANEL_COLLAPSED_WIDTH
              : SIDE_PANEL_WIDTH,
          }}
          aria-label="Documentation navigation"
        >
          {sidePanelCollapsed ? (
            <div className={styles.sidePanelRail}>
              <button
                type="button"
                className={styles.sidePanelRailToggle}
                onClick={() => setSidePanelCollapsed(false)}
                aria-label="Expand panel"
                title="Expand"
              >
                <SidebarSimple size={16} aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <div className={styles.sidePanelHeader}>
                <button
                  type="button"
                  className={styles.sidePanelCollapseBtn}
                  onClick={() => setSidePanelCollapsed(true)}
                  aria-label="Collapse panel"
                  title="Collapse"
                >
                  <SidebarSimple size={16} aria-hidden />
                </button>
                <span className={styles.sidePanelTitle}>Documents</span>
              </div>
              <div ref={treePanelRef} className={styles.tocPanel}>
                {tree === null ? (
                  <p className={styles.tocEmpty}>Loading…</p>
                ) : tree.children.length === 0 ? (
                  <p className={styles.tocEmpty}>
                    No Markdown documents found in this folder.
                  </p>
                ) : (
                  <DocsTreeList
                    nodes={tree.children}
                    depth={0}
                    expanded={expanded}
                    activePath={currentDoc}
                    onToggleDir={toggleDir}
                    onOpenDoc={(relPath) => void openDoc(relPath)}
                  />
                )}
              </div>
            </>
          )}
        </aside>

        <div className={styles.pageArea}>
          <div className={styles.viewerSurface}>
            {/* A margem é padding do próprio container de scroll: a barra de
                rolagem fica colada na borda da folha, fora do padding. */}
            <div
              ref={scrollRef}
              className={styles.docScroll}
              style={{
                paddingLeft: DOC_PADDING_X_PX + marginPx,
                paddingRight: DOC_PADDING_X_PX + marginPx,
              }}
            >
              {docLoading && docHtml === null && !docError ? (
                <p className={styles.placeholderText}>Loading…</p>
              ) : docError ? (
                <p className={styles.placeholderText}>{docError}</p>
              ) : docMarkup ? (
                <div
                  className={styles.docContent}
                  style={{ fontSize: fontSizeCss(fontScale) }}
                  onClick={handleContentClick}
                  dangerouslySetInnerHTML={docMarkup}
                />
              ) : (
                <p className={styles.placeholderText}>
                  Select a document to start reading.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
