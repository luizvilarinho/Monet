// Itens que o app monta para os agentes Radar e Papers (candidatos de busca) e
// o contrato do marcador [W3]/[P2]: o modelo escolhe e comenta pelo marcador, e
// o app desenha título, link, fonte, data, autores, ano e citações a partir do
// payload, então o modelo não inventa nenhum deles. Módulo puro (sem `storage`
// nem `@tauri-apps`).

import { dateKeyFromMs } from './calendar'

export interface WebItem {
  kind: 'web'
  key: string // 'W3' (marcador sem colchetes)
  section: 'news' | 'releases'
  title: string
  url: string
  source: string // host sem "www."
  date: string // YYYY-MM-DD (published_date do Tavily, normalizado)
  snippet: string // ≤ 300 caracteres (só para o bloco de candidatos; removido ao podar)
}

export interface PaperItem {
  kind: 'paper'
  key: string // 'P2'
  section: 'radar' | 'foundational' | 'recent'
  id: string // paperKey: 'doi:<doi>' ou 'openalex:W123'
  openalexId: string // 'W123'
  title: string
  authors: string[] // até 3 display_name, na ordem da obra
  authorCount: number
  year: number | null
  date: string | null // publication_date
  doi: string | null // normalizado: '10.xxxx/...', minúsculas
  url: string // https://doi.org/<doi>, senão landing do best_oa_location, senão o id OpenAlex
  citations: number
  type: string // tipo OpenAlex
  isOa: boolean
  pdfUrl: string | null // best_oa_location.pdf_url
  oaUrl: string | null // open_access.oa_url
  abstract: string | null // ≤ 1200 caracteres
}

export type AgentItem = WebItem | PaperItem

// O que a consulta fez: a linha que o app mostra acima da lista e o que a
// conversa precisa para o seguimento (janela do Radar e consulta anterior). Só
// assuntos, datas e rótulos curtos; nunca texto de nota.
export interface AgentSearchInfo {
  scopeKey: string // 'notebook:<id>' | 'tag:<tagKey>' | 'board:<typeId>' | 'all'
  scopeLabel: string // 'notebook "ML"' | 'tag #x' | 'board "Paper"' | 'all notebooks'
  since: string | null // YYYY-MM-DD, a janela do Radar; null no Papers (não tem janela)
  windowNote: string | null // de onde veio a janela ('last check: 13/11/2026'); null no Papers
  queries: string[] // as consultas que rodaram (assuntos e termos), sem repetidas
  profile: boolean // o perfil do Radar entrou no mapa de foco (no Papers, só a linha Ignore)
  // Havia uma nota de perfil do Radar na hora da consulta, mesmo que nenhuma linha dela tenha
  // entrado no mapa de foco (só o Follow, num escopo estreito). Não é o `profile`: aquele diz o
  // que entrou e alimenta o "radar profile" da linha do app; este trava o "Save radar profile"
  // (`radarProfileDraftAllowed`). Ausente em mensagem gravada antes do campo e no Papers.
  hasProfileNote?: boolean
}

export interface AgentItemsPayload {
  items: AgentItem[]
  max: number // 8 no Radar, 6 no Papers
  scopeNotebookId: string | null // caderno do escopo (pré-seleção do "Add to reading list")
  // Ausente em mensagem gravada antes do campo existir.
  search?: AgentSearchInfo
}

// A última consulta concluída de um agente na conversa e o dia local em que ela
// rodou.
export interface AgentRun {
  search: AgentSearchInfo
  ranOn: string | null // YYYY-MM-DD
}

interface PriorMessage {
  role: 'user' | 'assistant'
  agentId?: string
  agentItems?: AgentItemsPayload
  failed?: unknown
  interrupted?: unknown
  timestamp: string
}

// A consulta registrada na resposta (payload com `search`), de resposta concluída:
// a que falhou ou foi parada não conta.
function runOf(m: PriorMessage): AgentRun | null {
  const search = m.role === 'assistant' && !m.failed && !m.interrupted ? m.agentItems?.search : undefined
  if (!search) return null
  const ms = Date.parse(m.timestamp)
  return { search, ranOn: Number.isNaN(ms) ? null : dateKeyFromMs(ms) }
}

// A última resposta do assistant com consulta registrada. Só vale se for do mesmo
// agente; um Radar depois de um Papers começa do zero.
export function previousAgentRun(messages: PriorMessage[], agentId: string): AgentRun | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const run = runOf(messages[i])
    if (run) return messages[i].agentId === agentId ? run : null
  }
  return null
}

// Todas as consultas concluídas do agente na conversa, da mais recente à mais
// antiga (a janela do Radar procura entre elas a do escopo e do dia).
export function agentRuns(messages: PriorMessage[], agentId: string): AgentRun[] {
  const runs: AgentRun[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const run = messages[i].agentId === agentId ? runOf(messages[i]) : null
    if (run) runs.push(run)
  }
  return runs
}

// A lista de itens e a linha do app só valem numa resposta que terminou: o
// payload só é podado aos citados no fim real do turno, então num turno com erro
// ou Stop ele ainda guarda todos os candidatos. Sem itens ("Nothing new
// since…"), a linha aparece sozinha, desde que o payload tenha os dados da
// consulta (`search`).
export function hasAgentPayload(message: { agentItems?: AgentItemsPayload; failed?: unknown; interrupted?: unknown }): boolean {
  const payload = message.agentItems
  return !!payload && (payload.items.length > 0 || !!payload.search) && !message.failed && !message.interrupted
}

// De onde veio a janela, para a linha do app: 'first check of this scope: last 30
// days' → 'first check: last 30 days'; 'last check: 13/11/2026' → 'last check' (a data
// já é o "since"; num corte pelo teto de 90 dias a data da última consulta fica).
function windowLabel(note: string, since: string): string {
  return note
    .replace(/^first check of this scope/, 'first check')
    .replace(/^last check: (\d{2}\/\d{2}\/\d{4})/, (_, date: string) => (date === dmy(since) ? 'last check' : `last check ${date}`))
    .replace('; capped', ', capped')
}

// A linha que o app mostra acima da lista de itens (não vem do modelo): o escopo,
// a janela (só no Radar), o perfil quando entrou e as consultas feitas. Ex.:
// `Notebook "ML" · since 13/11/2026 (last check) · searched: graph neural networks`.
// null = mensagem gravada antes do campo `search` existir.
export function searchLine(search: AgentSearchInfo | undefined): string | null {
  if (!search) return null
  const scope = search.scopeLabel.charAt(0).toUpperCase() + search.scopeLabel.slice(1)
  const parts = [scope]
  if (search.since) {
    parts.push(`since ${dmy(search.since)}${search.windowNote ? ` (${windowLabel(search.windowNote, search.since)})` : ''}`)
  }
  if (search.profile) parts.push('radar profile')
  if (search.queries.length > 0) parts.push(`searched: ${search.queries.join(', ')}`)
  return parts.join(' · ')
}

// "Save radar profile" só aparece quando o app não sabia de uma nota de perfil na hora da
// consulta: com uma nota (`hasProfileNote`), a proposta do modelo, se vier, não vira botão
// (salvar criaria uma segunda nota, que valeria no lugar da do usuário). Sem o campo
// (mensagem antiga, ou sem payload), vale o que a resposta traz.
export function radarProfileDraftAllowed(message: { agentItems?: AgentItemsPayload }): boolean {
  return message.agentItems?.search?.hasProfileNote !== true
}

// Marcador de candidato: `[W3]`, `[P4]` ou com um espaço (`[W 3]`). O `(?!\()`
// evita casar com o texto de um link markdown (`[W3](url)`).
export const ITEM_MARKER_RE = /\[(W|P)\s?(\d{1,3})\](?!\()/g

const FIRST_MARKER_RE = new RegExp(ITEM_MARKER_RE.source)
const AUTHORS_SHOWN = 3
const LIST_LINE_RE = /^\s*[-*]\s/
const LIST_BULLET_RE = /^\s*[-*]\s+/

// '2026-11-18' → '18/11/2026'. Texto fora do formato volta como veio.
export function dmy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// Colchetes e parênteses do título não quebram o link markdown.
function escapeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().replace(/[[\]()]/g, (c) => `\\${c}`)
}

// Parênteses e espaços da URL (DOIs como `10.1016/S0140-6736(20)30183-5`) não
// fecham o destino do link antes da hora.
export function linkUrl(url: string): string {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20')
}

// Sobrenome = a última palavra do display_name.
function surname(displayName: string): string {
  const words = displayName.trim().split(/\s+/)
  return words[words.length - 1] ?? ''
}

// Autores como no prefixo: 'Smith, Lee, Chen' ou 'Smith, Lee, Chen et al.'
// (mais de 3 autores); '' sem autores.
export function paperAuthors(item: PaperItem): string {
  const names = item.authors.map(surname).filter(Boolean).slice(0, AUTHORS_SHOWN)
  if (names.length === 0) return ''
  return item.authorCount > AUTHORS_SHOWN ? `${names.join(', ')} et al.` : names.join(', ')
}

export function citationsText(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'citation' : 'citations'}`
}

// Prefixo que substitui o marcador:
// - web: `**[<título>](<url>)** (<fonte>, dd/mm/yyyy):`
// - artigo: `**[<título>](<url>)** (<autores>, <ano> · <N> citations · Open access):`
export function itemPrefix(item: AgentItem): string {
  const link = `**[${escapeTitle(item.title)}](${linkUrl(item.url)})**`
  if (item.kind === 'web') return `${link} (${item.source}, ${dmy(item.date)}):`
  const head = [paperAuthors(item), item.year === null ? 'n.d.' : String(item.year)].filter(Boolean).join(', ')
  const parts = [head, citationsText(item.citations)]
  if (item.isOa) parts.push('Open access')
  return `${link} (${parts.join(' · ')}):`
}

// Marcador → chave sem espaço nem zeros à esquerda ('W 3' → 'W3').
function markerKey(kind: string, digits: string): string {
  return `${kind}${Number(digits)}`
}

// Troca cada marcador por `resolve(key)`; null apaga o marcador e o espaço que
// ficaria duplicado (ou solto antes de pontuação).
function mapMarkers(text: string, resolve: (key: string) => string | null): string {
  let out = ''
  let last = 0
  for (const m of text.matchAll(ITEM_MARKER_RE)) {
    const start = m.index
    out += text.slice(last, start)
    last = start + m[0].length
    const replacement = resolve(markerKey(m[1], m[2]))
    if (replacement !== null) {
      out += replacement
      continue
    }
    const next = text[last]
    if (next === ' ' && (out === '' || /[ \n]$/.test(out))) last++
    else if (out.endsWith(' ') && next !== undefined && /[.,;:!?)]/.test(next)) out = out.slice(0, -1)
  }
  return out + text.slice(last)
}

// Título de seção: linha curta em negrito ("**News**"), com "#" ("## News") ou
// terminada em ":" ("News:").
function isSectionHeader(line: string): boolean {
  const t = line.trim()
  if (t === '' || t.length > 80 || LIST_LINE_RE.test(line)) return false
  return /^#{1,6}\s/.test(t) || /^(\*\*|__).+\1:?$/.test(t) || t.endsWith(':')
}

function itemsByKey(payload: AgentItemsPayload): Map<string, AgentItem> {
  return new Map(payload.items.map((item) => [item.key, item]))
}

// Exibição durante o streaming: expande os marcadores conhecidos e apaga os
// desconhecidos, sem remover linhas.
export function expandItemMarkers(content: string, payload: AgentItemsPayload): string {
  const byKey = itemsByKey(payload)
  return mapMarkers(content, (key) => {
    const item = byKey.get(key)
    return item ? itemPrefix(item) : null
  })
}

// Fim do turno, uma vez. Linha de lista cujo 1º marcador é desconhecido, ou
// está além do teto `max` de itens distintos, sai do texto (e o cabeçalho da
// seção que ficou sem nenhuma linha sai junto); nas demais linhas, o marcador
// conhecido e dentro do teto é expandido e o resto é apagado. O payload devolvido
// só tem os itens citados, na ordem da 1ª citação, sem o `snippet`.
export function finalizeAgentItems(
  content: string,
  payload: AgentItemsPayload
): { content: string; payload: AgentItemsPayload } {
  const byKey = itemsByKey(payload)
  const cited: AgentItem[] = []
  const isCited = (key: string) => cited.some((c) => c.key === key)
  // Conhecido e dentro do teto; o item novo entra na lista dos citados.
  const accept = (key: string): AgentItem | null => {
    const item = byKey.get(key)
    if (!item) return null
    if (isCited(key)) return item
    if (cited.length >= payload.max) return null
    cited.push(item)
    return item
  }

  // A seção vai de um cabeçalho ao próximo; sem nada que fique nela, o cabeçalho sai.
  const lines: (string | null)[] = []
  let header = -1 // posição do cabeçalho da seção aberta em `lines`
  let kept = 0 // linhas com conteúdo que ficaram nela
  let dropped = 0 // linhas de lista que saíram dela
  const closeSection = () => {
    if (header >= 0 && dropped > 0 && kept === 0) lines[header] = null
  }
  for (const line of content.split('\n')) {
    if (LIST_LINE_RE.test(line)) {
      const first = line.match(FIRST_MARKER_RE)
      if (first && !accept(markerKey(first[1], first[2]))) {
        dropped++
        continue
      }
      kept++
    } else if (isSectionHeader(line)) {
      closeSection()
      header = lines.length
      kept = 0
      dropped = 0
    } else if (line.trim() !== '') {
      kept++
    }
    lines.push(
      mapMarkers(line, (key) => {
        const item = accept(key)
        return item ? itemPrefix(item) : null
      })
    )
  }
  closeSection()

  return {
    content: lines.filter((line): line is string => line !== null).join('\n'),
    payload: {
      ...payload,
      items: cited.map((item) => (item.kind === 'web' ? { ...item, snippet: '' } : item)),
    },
  }
}

interface MessageWithItems {
  content: string
  agentItems?: AgentItemsPayload
}

// Fim real do turno (o done, ou a tool da memória) na mensagem do assistant: os
// marcadores viram título, link e fonte (só os citados), e o payload gravado fica
// só com os citados, sem o trecho. Sem nada no texto, `noResponse` o substitui.
export function finalizeMessageItems<T extends MessageWithItems>(m: T, noResponse: string): T {
  if (!m.agentItems) return m
  const fin = finalizeAgentItems(m.content, m.agentItems)
  return { ...m, content: fin.content.trim() ? fin.content : noResponse, agentItems: fin.payload }
}

// A mesma poda numa resposta que termina sem done (erro, Stop, corte na
// desmontagem, tool call sem handler): o payload de todos os candidatos (cerca de
// 30 KB, num localStorage com cota) não fica gravado, e os marcadores [W3] crus
// não vão no histórico enviado ao modelo. Com texto, os marcadores viram link e o
// payload fica só com os citados; sem texto (o balão vira erro), o payload sai.
export function settleMessageItems<T extends MessageWithItems>(m: T): T {
  if (!m.agentItems) return m
  if (m.content.trim() === '') return { ...m, agentItems: undefined }
  const fin = finalizeAgentItems(m.content, m.agentItems)
  return { ...m, content: fin.content, agentItems: fin.content.trim() ? fin.payload : undefined }
}

interface StoppableMessage {
  id: string
  content: string
  model?: string
  interrupted?: 'stopped' | 'cut'
  agentItems?: AgentItemsPayload
}

// Stop com o app ainda montando o contexto de um agente com pipeline de busca (Radar,
// Papers): o balão do assistant, ainda vazio, fica marcado como parado (e leva o modelo
// do turno), no estado de um Stop comum do chat, em vez de sair e deixar só a pergunta.
// O balão mostra "Stopped" e o Retry do chat. Só mexe no balão vazio, e o payload dos
// candidatos (se o app já o gravou) sai: sem texto, ele não serve a nada.
export function markStoppedBeforeReply<T extends StoppableMessage>(
  messages: T[],
  assistantId: string,
  model: string | undefined
): T[] {
  return messages.map((m) =>
    m.id === assistantId && m.content === ''
      ? { ...m, interrupted: 'stopped' as const, model: m.model ?? model, agentItems: undefined }
      : m
  )
}

// O texto do modelo depois do prefixo do item, na 1ª linha (de lista ou não)
// que começa com ele. Com o conteúdo já finalizado. '' quando não há.
export function citedItemReason(content: string, item: AgentItem): string {
  const prefix = itemPrefix(item)
  for (const line of content.split('\n')) {
    const text = line.replace(LIST_BULLET_RE, '').trimStart()
    if (text.startsWith(prefix)) return text.slice(prefix.length).trim()
  }
  return ''
}
