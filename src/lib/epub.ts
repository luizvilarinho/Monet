// Setup central do @likecoin/epubjs, espelhando o papel de lib/pdf.ts para o
// pdfjs: todo uso da lib no app passa por aqui — nenhum outro módulo importa
// `@likecoin/epubjs` direto.
//
// NUNCA passar `forceXMLDom: true` ao epubjs: é o único caminho que acorda o
// @xmldom/xmldom (advisory em aberto), hoje inerte porque o WebView2 tem
// DOMParser/XMLSerializer nativos.
import { Book as EpubjsBook, EpubCFI } from '@likecoin/epubjs'
import type { Contents, Location, NavItem, Rendition } from '@likecoin/epubjs'

// Tipos da lib reexportados: é o que permite ao EpubReader manipular book e
// rendition sem importar `@likecoin/epubjs` direto.
export type EpubBookHandle = EpubjsBook
export type EpubRendition = Rendition
export type EpubLocation = Location

// Tamanho da fatia (em caracteres) usada para gerar as locations. 1600 é o
// padrão do epubjs. O custo NÃO acompanha o tamanho do arquivo, e sim o nº de
// itens de spine — ver o comentário do `pause` em extractEpubInfo.
const LOCATION_CHARS = 1600

// Descritor de criptografia dentro do zip. O `getText` do epubjs remove a
// primeira barra do caminho, por isso ele vai com "/" na frente.
const ENCRYPTION_PATH = '/META-INF/encryption.xml'

// Os dois esquemas padrão de OFUSCAÇÃO DE FONTE também vivem em
// encryption.xml e NÃO são DRM — são comuns em livros de editora e o texto
// continua legível (só a fonte embutida fica ilegível). Qualquer outro
// algoritmo é DRM de verdade, e aí nenhuma biblioteca open source abre.
const FONT_OBFUSCATION_ALGORITHMS = [
  'http://www.idpf.org/2008/embedding',
  'http://ns.adobe.com/pdf/enc#RC',
]

// Marcas de erro, espelhando o `PasswordException` do pdfjs: aqui só se
// identifica a causa — a mensagem para o usuário é decidida pelo chamador.
export const EPUB_DRM_ERROR_NAME = 'EpubDrmException'
export const EPUB_TIMEOUT_ERROR_NAME = 'EpubTimeoutException'
export const EPUB_INCOMPLETE_ERROR_NAME = 'EpubIncompleteException'

// Teto de tempo do `extractEpubInfo`. O `Archive.request` do epubjs devolve um
// deferred SEM `.catch`: se o parse do arquivo lançar, a promise nunca settla e
// `generate()` não resolve nem rejeita. Sem este teto o `catch` de `importBook`
// nunca rodaria — arquivo copiado ficaria órfão em `books/`, sem rollback, e o
// botão de import ficaria preso em "Importing…" até reiniciar o app.
// 60 s é folgado de propósito: medido em Chrome (mesmo motor do WebView2), um
// EPUB de 120 seções leva ~2 s, um de 395 seções ~7 s, e um caso extremo de
// 1268 seções (10x o texto de um clássico completo) ~22 s.
const EXTRACT_TIMEOUT_MS = 60_000

export interface EpubInfo {
  title: string | null
  author: string | null
  // Nº de locations do livro — é o `totalPages` do EPUB (ordinal de leitura).
  locationCount: number
  // `locations.save()` serializado, para não regerar a cada abertura.
  locationsJson: string
}

function normalizeMetaString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isDrmProtected(encryptionXml: string): boolean {
  const doc = new DOMParser().parseFromString(encryptionXml, 'application/xml')
  const methods = Array.from(
    doc.getElementsByTagNameNS('*', 'EncryptionMethod'),
  )
  // XML ilegível ou sem nenhum método declarado: não dá para afirmar que é só
  // ofuscação de fonte, então trata como DRM.
  if (methods.length === 0) return true
  return methods.some(
    (m) =>
      !FONT_OBFUSCATION_ALGORITHMS.includes(m.getAttribute('Algorithm') ?? ''),
  )
}

// Abre o EPUB a partir dos bytes já lidos do disco. Usa `new Book()` +
// `open()` em vez de `ePub(data)` porque o construtor ENGOLE o erro de
// abertura (só emite um evento): com ele, um arquivo corrompido deixaria a
// promise pendurada para sempre em vez de rejeitar.
//
// `replacements` decide se os assets do livro viram blob URL:
// - 'none' no import, que só precisa de metadados e locations — num EPUB
//   grande esse trabalho extra é justamente o que faria o import parecer
//   travado;
// - 'blobUrl' na leitura, sem o qual imagens e CSS do livro não carregam.
async function openEpub(
  data: Uint8Array,
  replacements: 'none' | 'blobUrl',
): Promise<EpubjsBook> {
  const book = new EpubjsBook({ replacements })
  // Quem cria o book é quem o destrói se ele não chegar a ser devolvido — vale
  // para zip inválido, leitura do encryption.xml e DRM. Depois de devolvido, o
  // `finally` do chamador assume.
  try {
    await book.open(data.buffer as ArrayBuffer, 'binary')
    // `getText` devolve undefined quando o arquivo não existe no zip (o tipo da
    // lib promete `string`), então a ausência de encryption.xml cai aqui.
    const encryption = await book.archive.getText(ENCRYPTION_PATH)
    if (encryption && isDrmProtected(encryption)) {
      const err = new Error('DRM-protected EPUB')
      err.name = EPUB_DRM_ERROR_NAME
      throw err
    }
  } catch (err) {
    book.destroy()
    throw err
  }
  return book
}

// Gera as locations do livro já aberto e devolve QUANTOS itens de spine não
// puderam ser lidos. O `generate()` do epubjs resolve mesmo assim quando um
// item declarado no OPF está ausente do zip: as locations saem parciais e o
// livro fica com um total menor que o real, em silêncio. A falha só aparece
// aqui porque envolvemos o `process` — que também evita a unhandled rejection
// que o epubjs deixa escapar nesse caso (a fila dele rejeita sem handler).
async function generateLocations(book: EpubjsBook): Promise<number> {
  const locations = book.locations
  // O epubjs dorme `pause` ms entre CADA item de spine ao gerar as locations
  // (default 100 em locations.js), independente do tamanho do item: um livro
  // de 120 capítulos gastaria ~13 s só dormindo. Zerar não muda o resultado —
  // mesmo nº de locations e `save()` byte a byte idêntico, que é a premissa
  // que torna seguro cachear `locations_json` — e o loop continua cedendo o
  // thread a cada seção (setTimeout + rAF da fila interna), então a UI não
  // congela. O campo existe só no runtime; o .d.ts da lib não o declara.
  ;(locations as unknown as { pause: number }).pause = 0
  const process = locations.process.bind(locations)
  let unreadable = 0
  // Precisa ser trocado ANTES do generate(), que enfileira `this.process` de
  // uma vez para todos os itens de spine.
  locations.process = (section: Parameters<typeof process>[0]) =>
    process(section).catch(() => {
      unreadable += 1
      return []
    })
  await locations.generate(LOCATION_CHARS)
  return unreadable
}

async function readEpubInfo(data: Uint8Array): Promise<EpubInfo> {
  const book = await openEpub(data, 'none')
  try {
    if ((await generateLocations(book)) > 0) {
      // Importar assim gravaria um `totalPages` menor que o real, e o número
      // errado ficaria cacheado em locations_json para sempre. Vira erro de
      // import (com rollback da cópia) em vez de livro truncado em silêncio.
      const err = new Error(
        'EPUB declares spine items that are missing from the file',
      )
      err.name = EPUB_INCOMPLETE_ERROR_NAME
      throw err
    }
    const metadata = book.packaging.metadata
    return {
      title: normalizeMetaString(metadata.title),
      author: normalizeMetaString(metadata.creator),
      // Piso de 1: sem nenhuma location o livro entraria com totalPages 0 e o
      // clamp de `lastPage` no storage devolveria 0 ao abrir.
      locationCount: Math.max(1, book.locations.length()),
      locationsJson: book.locations.save(),
    }
  } finally {
    book.destroy()
  }
}

// Metadados do OPF + locations, tudo o que o import precisa. Rejeita com
// `EPUB_DRM_ERROR_NAME` em livro com DRM, com `EPUB_TIMEOUT_ERROR_NAME` se o
// epubjs não settlar, e com o erro do epubjs/JSZip em arquivo corrompido.
export async function extractEpubInfo(data: Uint8Array): Promise<EpubInfo> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('Timed out reading EPUB')
      err.name = EPUB_TIMEOUT_ERROR_NAME
      reject(err)
    }, EXTRACT_TIMEOUT_MS)
  })
  try {
    return await Promise.race([readEpubInfo(data), timeout])
  } finally {
    clearTimeout(timer)
  }
}

// ─── Leitura ─────────────────────────────────────────────────────────────

// Teto para o carregamento do sumário. O `loadNavigation` do epubjs
// (book.js:481) não tem `.catch`: se o arquivo de navegação estiver ausente ou
// ilegível, `book.loaded.navigation` NUNCA settla. Sem este teto o painel de
// sumário ficaria em "Loading…" para sempre.
const NAVIGATION_TIMEOUT_MS = 15_000

export interface EpubTocEntry {
  label: string
  // `null` quando o href do TOC não aponta para nenhum item de spine — o item
  // fica desabilitado, como o sumário do PDF faz com destino irresolúvel.
  href: string | null
  // Índice do item de spine e fragmento de âncora do href — a base da
  // resolução posição → capítulo (citação "capítulo + %").
  sectionIndex: number | null
  fragment: string | null
  items: EpubTocEntry[]
}

// Abre o EPUB para renderizar. Diferente do import, aqui os assets do livro
// precisam virar blob URL (imagens, CSS e fontes embutidas).
export async function openEpubForReading(
  data: Uint8Array,
): Promise<EpubBookHandle> {
  return openEpub(data, 'blobUrl')
}

function loadCachedLocations(book: EpubjsBook, cached: string): boolean {
  try {
    const parsed: unknown = JSON.parse(cached)
    if (!Array.isArray(parsed) || parsed.length === 0) return false
    if (!parsed.every((cfi) => typeof cfi === 'string' && cfi.length > 0)) {
      return false
    }
  } catch {
    return false
  }
  book.locations.load(cached)
  return true
}

// Deixa `book.locations` pronto para posicionar e medir progresso, usando o
// cache gravado no import. Cache ausente ou inválido (livro importado antes
// desta feature, JSON corrompido) apenas custa uma regeração — nunca impede a
// leitura, e por isso locations parciais aqui NÃO são erro, ao contrário do
// import. `regenerated` avisa o chamador de que há um cache novo a persistir.
export async function ensureEpubLocations(
  book: EpubBookHandle,
  cached: string | null,
): Promise<{ locationsJson: string; regenerated: boolean }> {
  if (cached && loadCachedLocations(book, cached)) {
    return { locationsJson: cached, regenerated: false }
  }
  await generateLocations(book)
  return { locationsJson: book.locations.save(), regenerated: true }
}

function mapTocItems(book: EpubjsBook, items: NavItem[]): EpubTocEntry[] {
  return items.map((item) => {
    const href = item.href ?? ''
    const section = href ? book.spine.get(href) : null
    return {
      label: (item.label ?? '').trim() || 'Untitled',
      href: href && section ? href : null,
      sectionIndex: section ? section.index : null,
      fragment: section ? hrefFragment(href) : null,
      items: mapTocItems(book, item.subitems ?? []),
    }
  })
}

// Parte `#ancora` de um href de TOC, se houver.
function hrefFragment(href: string): string | null {
  const i = href.indexOf('#')
  if (i < 0) return null
  const fragment = href.slice(i + 1)
  return fragment.length > 0 ? fragment : null
}

// Sumário do livro, já com os destinos resolvidos contra o spine. Devolve
// lista vazia para livro sem sumário utilizável.
export async function loadEpubToc(
  book: EpubBookHandle,
): Promise<EpubTocEntry[]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS)
  })
  try {
    const navigation = await Promise.race([book.loaded.navigation, timeout])
    return navigation ? mapTocItems(book, navigation.toc ?? []) : []
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

// CFI reportado como início da página atual, medido na hora. O `.d.ts` declara
// `currentLocation()` como um `DisplayedLocation` solto, mas o epubjs devolve o
// par start/end montado por `Rendition.located` — o cast fica aqui, junto com
// os outros desvios da lib.
function currentStartCfi(rendition: EpubRendition): string | null {
  const location = (
    rendition as unknown as { currentLocation: () => EpubLocation | undefined }
  ).currentLocation()
  return location?.start?.cfi ?? null
}

// Navega até `target` (CFI ou href do sumário).
//
// Uma passada só de `display` pode parar ANTES do alvo: o epubjs mede o offset
// do destino contra um iframe que ainda não terminou de expandir e clampa o
// scroll ao conteúdo já medido. Medido em Chrome (mesmo motor do WebView2):
// −108 locations (−30% do livro) ao aumentar a fonte e −22 ao retomar a
// leitura. A segunda passada acerta o alvo, e precisa ser imediata — esperar
// pelo reflow não muda nada. É barata: com a seção já montada, o epubjs só
// reposiciona o scroll.
export async function displayEpubAt(
  rendition: EpubRendition,
  target?: string,
): Promise<void> {
  await rendition.display(target)
  // A primeira passada já deixou o leitor num lugar válido: uma falha aqui
  // não pode derrubar a navegação.
  await rendition.display(target).catch(() => {})
}

// Retomada da leitura no CFI salvo, na página EXATA em que o usuário parou.
//
// `display` sozinho volta uma página. O CFI que o epubjs reporta como início
// da página (`location.start.cfi`, o valor que gravamos) é um ponto COLAPSADO
// antes da primeira palavra visível; quando a página começa no meio de um
// parágrafo, esse ponto cai numa quebra de linha — e um caret em quebra de
// linha é desenhado no FIM da linha anterior, isto é, na página ANTERIOR.
// Como o `display` ancora pelo x renderizado do alvo, a retomada para uma
// página atrás. Medido no container de 820 px (duas colunas, a largura real
// de uso): 14 das 40 primeiras páginas do livro caem assim, sempre exatamente
// uma página atrás — em coluna única, 12 de 40.
//
// A página certa é a única cujo início reportado é exatamente o CFI pedido: a
// comparação é a inversa da conta que gerou o valor salvo. Se a página em que
// caímos não for, a seguinte é. Sem correspondência exata em nenhuma das duas
// — a posição foi salva com outra largura de janela ou outro tamanho de
// fonte, e aí não existe página equivalente — volta ao destino original.
//
// A mesma correção NÃO vale para mudança de tamanho de fonte: lá a
// diagramação muda por definição, a comparação nunca casa, e o passo extra só
// custaria um pulo visível de ida e volta.
export async function resumeEpubAt(
  rendition: EpubRendition,
  cfi?: string,
): Promise<void> {
  await displayEpubAt(rendition, cfi)
  if (cfi == null) return
  if (currentStartCfi(rendition) === cfi) return
  await rendition.next().catch(() => {})
  if (currentStartCfi(rendition) === cfi) return
  await displayEpubAt(rendition, cfi)
}

// Repagina no tamanho atual do container. O `.d.ts` exige width/height, mas
// passá-los fixaria o container em pixels: o Stage guarda o tamanho recebido
// na criação ('100%') e nunca o atualiza, então uma medida em px gravada agora
// jamais voltaria a acompanhar o elemento pai. Chamar sem argumentos é o que
// faz o epubjs remedir pelo clientWidth/clientHeight.
export function resizeEpubRendition(rendition: EpubRendition): void {
  ;(rendition as unknown as { resize: () => void }).resize()
}

// ─── Anotação (Fase B2) ──────────────────────────────────────────────────

// Opacidade do preenchimento do grifo no EPUB — mesmo valor do leitor de PDF
// (HIGHLIGHT_OPACITY do Reader).
const HIGHLIGHT_FILL_OPACITY = '0.35'

// Modo de diagramação do texto: 'auto' = duas colunas acima de 800 px de
// largura (default do epubjs), 'none' = sempre coluna única.
export type EpubSpreadMode = 'auto' | 'none'

// Retângulo de um range em coordenadas do documento PAI (viewport do app).
// O range vive dentro do iframe; somar a posição do iframe é o que permite
// posicionar toolbar/popover fora dele.
export interface EpubScreenRect {
  left: number
  top: number
  width: number
  height: number
}

// Resolve um CFI no documento VIVO (a seção visível) e devolve o retângulo
// já traduzido para coordenadas do documento pai. `null` quando a seção do
// CFI não está sendo exibida ou o CFI não resolve.
function liveScreenRect(
  rendition: EpubRendition,
  cfi: string,
): EpubScreenRect | null {
  try {
    // `getRange` do rendition (não o do book): é o único que aponta para o
    // documento exibido no iframe — o do book carrega uma cópia separada.
    const range = rendition.getRange(cfi)
    if (!range) return null
    const frame = range.startContainer.ownerDocument?.defaultView
      ?.frameElement as HTMLElement | null
    if (!frame) return null
    const r = range.getBoundingClientRect()
    const f = frame.getBoundingClientRect()
    return {
      left: f.left + r.left,
      top: f.top + r.top,
      width: r.width,
      height: r.height,
    }
  } catch {
    return null
  }
}

export interface EpubSelectionInfo {
  cfiRange: string
  text: string
  rect: EpubScreenRect
}

// Seleção de texto dentro do iframe. O evento `selected` do epubjs dispara
// 250 ms após a seleção parar de mudar, com o CFI range já montado. O texto
// vem do range vivo (equivalente ao `book.getRange(cfi).toString()`).
// Seleção que não resolve num range visível (cruzando item de spine, CFI
// inválido) é descartada — nunca vira grifo quebrado.
export function onEpubSelection(
  rendition: EpubRendition,
  cb: (selection: EpubSelectionInfo) => void,
): () => void {
  const handler = (cfiRange: unknown) => {
    if (typeof cfiRange !== 'string') return
    try {
      const range = rendition.getRange(cfiRange)
      if (!range) return
      const text = range.toString().trim()
      if (!text) return
      const rect = liveScreenRect(rendition, cfiRange)
      if (!rect) return
      cb({ cfiRange, text, rect })
    } catch {
      // Range inválido ou seção fora da tela: degradar sem grifo.
    }
  }
  rendition.on('selected', handler)
  return () => {
    rendition.off('selected', handler)
  }
}

// Limpa a seleção do documento exibido (o `window.getSelection()` do app não
// alcança o iframe). O `.d.ts` declara `getContents()` como um Contents solto,
// mas o manager devolve um array — cast no padrão dos outros desvios da lib.
export function clearEpubSelection(rendition: EpubRendition): void {
  try {
    const contents = (
      rendition as unknown as { getContents: () => Contents[] }
    ).getContents()
    for (const c of contents) {
      c?.window?.getSelection()?.removeAllRanges()
    }
  } catch {
    // nenhuma view montada
  }
}

// Clique dentro do texto do livro (evento do iframe repassado pelo epubjs) —
// usado para fechar toolbar/popover, já que cliques dentro do iframe não
// chegam aos listeners do documento pai.
export function onEpubViewMouseDown(
  rendition: EpubRendition,
  cb: () => void,
): () => void {
  const handler = () => cb()
  rendition.on('mousedown', handler)
  return () => {
    rendition.off('mousedown', handler)
  }
}

// Desenha a marca de um grifo salvo. Devolve false quando o CFI não resolve
// mais (arquivo trocado por outra edição): a marca é pulada mas o item do
// painel continua legível e citável — a validação via `book.getRange` acontece
// ANTES porque o marks-pane quebraria ao medir um range inexistente.
export async function drawEpubHighlight(
  book: EpubBookHandle,
  rendition: EpubRendition,
  cfiRange: string,
  color: string,
): Promise<boolean> {
  const range = await book.getRange(cfiRange).catch(() => null)
  if (!range) return false
  try {
    rendition.annotations.highlight(cfiRange, {}, undefined, undefined, {
      fill: color,
      'fill-opacity': HIGHLIGHT_FILL_OPACITY,
    })
  } catch {
    return false
  }
  return true
}

export function removeEpubHighlight(
  rendition: EpubRendition,
  cfiRange: string,
): void {
  try {
    rendition.annotations.remove(cfiRange, 'highlight')
  } catch {
    // anotação inexistente nesta instância — nada a remover
  }
}

// Clique numa marca de grifo. A marca é um SVG no documento PAI (marks-pane
// sobre o iframe); o clique no texto grifado é detectado pelo proxy do
// marks-pane e chega aqui como `markClicked` com o CFI da anotação.
export function onEpubHighlightClick(
  rendition: EpubRendition,
  cb: (cfiRange: string) => void,
): () => void {
  const handler = (cfiRange: unknown) => {
    if (typeof cfiRange === 'string') cb(cfiRange)
  }
  rendition.on('markClicked', handler)
  return () => {
    rendition.off('markClicked', handler)
  }
}

// Posição de tela da marca de um grifo (para ancorar o popover), medida no
// documento vivo no momento do clique.
export function epubHighlightScreenRect(
  rendition: EpubRendition,
  cfiRange: string,
): EpubScreenRect | null {
  return liveScreenRect(rendition, cfiRange)
}

// Ordinal de leitura 1-based (mesmo valor gravado em `lastPage`) de um CFI
// qualquer — é o `page` do grifo no contrato do useHighlights.
export function epubLocationOrdinal(
  book: EpubBookHandle,
  cfi: string,
): number | null {
  try {
    // O `.d.ts` declara `locationFromCfi` devolvendo Location; no runtime é
    // um número (índice 0-based, -1 quando as locations não estão prontas).
    const loc = (
      book.locations.locationFromCfi as unknown as (c: string) => number
    )(cfi)
    return loc >= 0 ? loc + 1 : null
  } catch {
    return null
  }
}

// Percentual de leitura (0–100, inteiro) de um CFI qualquer, derivado das
// locations — usado no rótulo de citação de grifos fora da posição atual.
export function epubCfiPercentage(
  book: EpubBookHandle,
  cfi: string,
): number | null {
  try {
    const p = book.locations.percentageFromCfi(cfi)
    return typeof p === 'number' && Number.isFinite(p)
      ? Math.round(p * 100)
      : null
  } catch {
    return null
  }
}

// Texto da fatia de uma location (a "página" do EPUB, ~1600 chars) para o
// contexto do chat. Cada entrada de `locations` é um CFI RANGE que cobre
// exatamente os chars daquela fatia (ver Locations.parse do epubjs), então o
// round-trip pelo `getRange` devolve só ela — nunca o item de spine inteiro
// (que no arquivo de teste é 1,06 MB e estouraria o contexto).
export async function getEpubLocationText(
  book: EpubBookHandle,
  page: number,
): Promise<string | null> {
  let cfi: unknown
  try {
    cfi = book.locations.cfiFromLocation(page - 1)
  } catch {
    return null
  }
  if (typeof cfi !== 'string' || cfi.length === 0) return null
  try {
    const range = await book.getRange(cfi)
    const text = range.toString().replace(/\s+/g, ' ').trim()
    return text.length > 0 ? text : null
  } catch {
    return null
  }
}

interface FlatTocAnchor {
  label: string
  sectionIndex: number
  fragment: string | null
}

function flattenTocAnchors(entries: EpubTocEntry[]): FlatTocAnchor[] {
  const out: FlatTocAnchor[] = []
  const walk = (items: EpubTocEntry[]) => {
    for (const item of items) {
      if (item.href != null && item.sectionIndex != null) {
        out.push({
          label: item.label,
          sectionIndex: item.sectionIndex,
          fragment: item.fragment,
        })
      }
      walk(item.items)
    }
  }
  walk(entries)
  return out
}

// Capítulo de uma posição: a última âncora de TOC ≤ posição, comparando CFIs.
// "Capítulo" é sempre o NOME vindo do TOC, nunca um número gerado por nós.
// Entradas em seções anteriores à da posição são anteriores por definição
// (ordem do spine); na MESMA seção a comparação é pelo CFI do elemento da
// âncora — é o que resolve o caso do livro inteiro num único XHTML com 64
// âncoras de fragmento. Entradas com âncora irresolúvel são ignoradas.
// Devolve null quando nada precede a posição (capa/pré-textual ou livro sem
// TOC) — o chamador cai no fallback "só %".
export async function resolveEpubChapter(
  book: EpubBookHandle,
  toc: EpubTocEntry[],
  cfi: string,
): Promise<string | null> {
  const anchors = flattenTocAnchors(toc)
  if (anchors.length === 0) return null
  let spinePos: number
  try {
    spinePos = new EpubCFI(cfi).spinePos
  } catch {
    return null
  }
  const cfiCmp = new EpubCFI()
  // Documentos de seção carregados sob demanda e cacheados: a resolução de um
  // grifo fora da posição atual não pode recarregar o livro inteiro.
  const docs = new Map<number, Document | null>()
  const docOf = async (index: number): Promise<Document | null> => {
    if (docs.has(index)) return docs.get(index) ?? null
    const section = book.spine.get(index)
    let doc: Document | null = null
    if (section) {
      try {
        // O `.d.ts` declara `load` devolvendo Document; no runtime é uma
        // Promise<Element> (o documentElement da seção).
        const contents = (await section.load(
          book.load.bind(book),
        )) as unknown as Element | null
        doc = contents?.ownerDocument ?? null
      } catch {
        doc = null
      }
    }
    docs.set(index, doc)
    return doc
  }
  let best: FlatTocAnchor | null = null
  for (const anchor of anchors) {
    if (anchor.sectionIndex > spinePos) continue
    if (anchor.sectionIndex < spinePos || anchor.fragment == null) {
      // Seção anterior (qualquer ponto dela precede a posição) ou âncora de
      // início de seção (≤ qualquer posição dentro dela).
      best = anchor
      continue
    }
    const doc = await docOf(anchor.sectionIndex)
    const el = doc?.getElementById(anchor.fragment)
    if (!el) continue
    const section = book.spine.get(anchor.sectionIndex)
    if (!section) continue
    try {
      const elCfi = new EpubCFI(el, section.cfiBase).toString()
      if (cfiCmp.compare(elCfi, cfi) <= 0) best = anchor
    } catch {
      // âncora que não resolve nesta edição — ignorada
    }
  }
  return best?.label ?? null
}

// Alterna a diagramação (1 coluna ↔ spread de 2 colunas) em runtime. O epubjs
// recalcula o layout e repagina; o reposicionamento no CFI corrente fica a
// cargo do chamador (displayEpubAt), como na mudança de fonte.
export function setEpubSpread(
  rendition: EpubRendition,
  mode: EpubSpreadMode,
): void {
  rendition.spread(mode)
}
