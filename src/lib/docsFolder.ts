import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { pickDocumentFolder } from './documents'

export interface DocsTreeNode {
  name: string
  relPath: string
  isDir: boolean
  children: DocsTreeNode[]
}

export interface DocsFolder {
  id: string
  root: string
  alias: string
}

export interface DocsChangedEvent {
  root: string
}

export async function docsTree(root: string): Promise<DocsTreeNode> {
  return invoke<DocsTreeNode>('docs_tree', { root })
}

export async function docsReadFile(
  root: string,
  relPath: string,
): Promise<string> {
  return invoke<string>('docs_read_file', { root, relPath })
}

// Devolve o id do watcher criado; o stop recebe esse id e derruba só ele.
export async function docsWatchStart(root: string): Promise<number> {
  return invoke<number>('docs_watch_start', { root })
}

export async function docsWatchStop(watchId: number): Promise<void> {
  await invoke('docs_watch_stop', { watchId })
}

export function onDocsChanged(
  handler: (event: DocsChangedEvent) => void,
): Promise<UnlistenFn> {
  return listen<DocsChangedEvent>('docs://changed', (e) => handler(e.payload))
}

// Reuso direto do diálogo de pasta da KB (documents_pick_folder) — não há
// comando novo para selecionar a pasta de documentação.
export const pickDocsFolder = pickDocumentFolder

// ─── Persistência (localStorage, mesmo regime de monet:reader-open-book) ────

const DOCS_FOLDERS_KEY = 'monet:docs-folders'
// Formato antigo (uma pasta só): lido uma vez para migrar e então removido.
const LEGACY_DOCS_FOLDER_KEY = 'monet:docs-folder'
const OPEN_DOC_KEY = 'monet:docs-open-doc'
const OPEN_FOLDER_KEY = 'monet:docs-open-folder'
const FONT_KEY = 'monet:docs-reader-font'
const MARGIN_KEY = 'monet:docs-reader-margin'

function isDocsFolder(v: unknown): v is DocsFolder {
  const f = v as Partial<DocsFolder> | null
  return (
    !!f &&
    typeof f.id === 'string' &&
    typeof f.root === 'string' &&
    typeof f.alias === 'string'
  )
}

export function loadDocsFolders(): DocsFolder[] {
  try {
    const raw = localStorage.getItem(DOCS_FOLDERS_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(isDocsFolder) : []
    }
    const legacy = localStorage.getItem(LEGACY_DOCS_FOLDER_KEY)
    if (!legacy) return []
    const old = JSON.parse(legacy) as Partial<DocsFolder>
    localStorage.removeItem(LEGACY_DOCS_FOLDER_KEY)
    localStorage.removeItem(OPEN_DOC_KEY)
    if (typeof old.root !== 'string' || typeof old.alias !== 'string') return []
    const migrated = [{ id: crypto.randomUUID(), root: old.root, alias: old.alias }]
    saveDocsFolders(migrated)
    return migrated
  } catch {
    return []
  }
}

export function saveDocsFolders(folders: DocsFolder[]): void {
  localStorage.setItem(DOCS_FOLDERS_KEY, JSON.stringify(folders))
}

// Último documento aberto por pasta ({ [folderId]: relPath }): retomada de
// leitura dentro do DocsReader.
function loadOpenDocs(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OPEN_DOC_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

export function loadOpenDoc(folderId: string): string | null {
  const relPath = loadOpenDocs()[folderId]
  return typeof relPath === 'string' ? relPath : null
}

export function saveOpenDoc(folderId: string, relPath: string): void {
  localStorage.setItem(
    OPEN_DOC_KEY,
    JSON.stringify({ ...loadOpenDocs(), [folderId]: relPath }),
  )
}

export function clearOpenDoc(folderId: string): void {
  const docs = loadOpenDocs()
  delete docs[folderId]
  localStorage.setItem(OPEN_DOC_KEY, JSON.stringify(docs))
}

// Pasta com o DocsReader aberto: entrar no Library retoma a leitura, como o
// monet:reader-open-book dos livros (um leitor por vez).
export function loadOpenDocsFolderId(): string | null {
  return localStorage.getItem(OPEN_FOLDER_KEY)
}

export function saveOpenDocsFolderId(folderId: string): void {
  localStorage.setItem(OPEN_FOLDER_KEY, folderId)
}

export function clearOpenDocsFolderId(): void {
  localStorage.removeItem(OPEN_FOLDER_KEY)
}

export function loadDocsReaderFont(): number | null {
  const raw = localStorage.getItem(FONT_KEY)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function saveDocsReaderFont(scale: number): void {
  localStorage.setItem(FONT_KEY, String(scale))
}

export function loadDocsReaderMargin(): number | null {
  const raw = localStorage.getItem(MARGIN_KEY)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function saveDocsReaderMargin(px: number): void {
  localStorage.setItem(MARGIN_KEY, String(px))
}

// Frontmatter YAML: remark-parse não conhece o bloco e o renderizaria como
// linha horizontal + texto. Remove só quando começa na linha 1 — um `---` no
// meio do documento é conteúdo legítimo.
export function stripFrontmatter(md: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(md)
  return match ? md.slice(match[0].length) : md
}

// Slug no estilo do GitHub (github-slugger): minúsculas, sem pontuação,
// espaços viram `-`, repetidos ganham sufixo `-1`, `-2`… É o que os links
// `[texto](#secao)` de documentação costumam assumir.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-')
}

// O renderMarkdown não gera `id` nos headings (as notas não precisam); o
// leitor de docs adiciona depois do sanitize para as âncoras funcionarem.
export function addHeadingIds(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const seen = new Map<string, number>()
  for (const h of doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    // Heading com id próprio (rótulo das notas de rodapé, citado por
    // aria-labelledby) fica como está.
    if (h.id) continue
    const base = slugify(h.textContent?.trim() ?? '')
    let id = base
    while (seen.has(id)) {
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      id = `${base}-${n}`
    }
    seen.set(id, 0)
    if (id) h.id = id
  }
  return doc.body.innerHTML
}
