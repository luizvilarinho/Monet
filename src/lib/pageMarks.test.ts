import { Window as HappyWindow } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PAGE_MARK_STYLE,
  buildJoinedNodeText,
  clearPageMarks,
  ensurePageMarkStyles,
  groupRangesByWindow,
  markEntryAtPoint,
  rangeFromNodeOffsets,
  setPageMarks,
} from './pageMarks'

function rangeOf(doc: Document, text: string): Range {
  const p = doc.createElement('p')
  p.textContent = text
  doc.body.append(p)
  const range = doc.createRange()
  range.selectNodeContents(p)
  return range
}

// O happy-dom não tem CSS.highlights nem Highlight: um registro simulado por
// janela mostra o que setPageMarks registra.
class FakeHighlight {
  ranges: Range[]
  constructor(...ranges: Range[]) {
    this.ranges = ranges
  }
}

// `CSS` é só um getter no happy-dom: o registro simulado entra por defineProperty
// e sai no afterEach.
const patched: Array<{ win: Window; name: string; descriptor: PropertyDescriptor | undefined }> = []

function patch(win: Window, name: string, value: unknown) {
  patched.push({ win, name, descriptor: Object.getOwnPropertyDescriptor(win, name) })
  Object.defineProperty(win, name, { configurable: true, writable: true, value })
}

function fakeRegistry(win: Window): Map<string, FakeHighlight> {
  const registry = new Map<string, FakeHighlight>()
  patch(win, 'CSS', { highlights: registry })
  patch(win, 'Highlight', FakeHighlight)
  return registry
}

// Outra janela com documento próprio, como o iframe do EPUB (o happy-dom não
// carrega a página de um <iframe> sem rede).
function makeOtherWindow(): { win: Window; doc: Document } {
  const other = new HappyWindow()
  return { win: other as unknown as Window, doc: other.document as unknown as Document }
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.querySelectorAll('#monet-page-marks').forEach((el) => el.remove())
})

afterEach(() => {
  clearPageMarks('listen')
  clearPageMarks('vocab')
  for (const { win, name, descriptor } of patched.splice(0).reverse()) {
    if (descriptor) Object.defineProperty(win, name, descriptor)
    else delete (win as unknown as Record<string, unknown>)[name]
  }
})

describe('groupRangesByWindow', () => {
  it('puts the ranges of the same document under one window, in order', () => {
    const a = rangeOf(document, 'La porte du grenier était entrebâillée.')
    const b = rangeOf(document, 'Elle sursauta.')
    const groups = groupRangesByWindow([a, b])
    expect(groups.size).toBe(1)
    expect(groups.get(window)).toEqual([a, b])
  })

  it('separates the ranges of an iframe (the EPUB) from the main window', () => {
    const { win, doc: frameDoc } = makeOtherWindow()
    const main = rangeOf(document, 'Au fond, une vieille malle.')
    const inFrame = rangeOf(frameDoc, 'Élise monte au grenier à 21 h 30.')
    const groups = groupRangesByWindow([main, inFrame])
    expect(groups.size).toBe(2)
    expect(groups.get(window)).toEqual([main])
    expect(groups.get(win)).toEqual([inFrame])
  })

  it('no ranges, no groups', () => {
    expect(groupRangesByWindow([]).size).toBe(0)
  })
})

describe('ensurePageMarkStyles', () => {
  it('injects one <style> per document, with both marks', () => {
    ensurePageMarkStyles(document)
    ensurePageMarkStyles(document)
    const styles = document.head.querySelectorAll('#monet-page-marks')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toBe(PAGE_MARK_STYLE)
    expect(PAGE_MARK_STYLE).toContain('::highlight(monet-listen)')
    expect(PAGE_MARK_STYLE).toContain('::highlight(monet-vocab)')
  })

  it('the grey of the listen mark has no hue', () => {
    const match = /::highlight\(monet-listen\)[^}]*rgba\((\d+), (\d+), (\d+)/.exec(PAGE_MARK_STYLE)
    expect(match).not.toBeNull()
    expect(match![1]).toBe(match![2])
    expect(match![2]).toBe(match![3])
  })
})

describe('setPageMarks and clearPageMarks', () => {
  it('registers the ranges under the mark name of the window that owns them', () => {
    const registry = fakeRegistry(window)
    const range = rangeOf(document, 'La porte du grenier était entrebâillée.')
    setPageMarks('listen', [range])
    expect(registry.get('monet-listen')?.ranges).toEqual([range])
    expect(document.head.querySelector('#monet-page-marks')).not.toBeNull()
  })

  it('replaces the previous ranges of the same mark and keeps the other mark', () => {
    const registry = fakeRegistry(window)
    const a = rangeOf(document, 'Elle sursauta.')
    const b = rangeOf(document, 'Au fond, une vieille malle.')
    setPageMarks('vocab', [a])
    setPageMarks('listen', [a])
    setPageMarks('listen', [b])
    expect(registry.get('monet-listen')?.ranges).toEqual([b])
    expect(registry.get('monet-vocab')?.ranges).toEqual([a])
  })

  it('each window has its own registry, and a window that no longer shows up is cleared', () => {
    const mainRegistry = fakeRegistry(window)
    const { win, doc: frameDoc } = makeOtherWindow()
    const frameRegistry = fakeRegistry(win)
    const inMain = rangeOf(document, 'Elle sursauta.')
    const inFrame = rangeOf(frameDoc, 'Élise monte au grenier à 21 h 30.')

    setPageMarks('listen', [inMain, inFrame])
    expect(mainRegistry.get('monet-listen')?.ranges).toEqual([inMain])
    expect(frameRegistry.get('monet-listen')?.ranges).toEqual([inFrame])
    expect(frameDoc.head.querySelector('#monet-page-marks')).not.toBeNull()

    // O capítulo trocou: só o documento principal tem o trecho agora.
    setPageMarks('listen', [inMain])
    expect(mainRegistry.has('monet-listen')).toBe(true)
    expect(frameRegistry.has('monet-listen')).toBe(false)
  })

  it('clearPageMarks removes the mark everywhere it was registered', () => {
    const registry = fakeRegistry(window)
    const range = rangeOf(document, 'Elle sursauta.')
    setPageMarks('listen', [range])
    clearPageMarks('listen')
    expect(registry.has('monet-listen')).toBe(false)
  })

  it('without CSS.highlights support the mark just does not show', () => {
    patch(window, 'CSS', {})
    patch(window, 'Highlight', undefined)
    expect(() => setPageMarks('listen', [rangeOf(document, 'Elle sursauta.')])).not.toThrow()
    expect(() => clearPageMarks('listen')).not.toThrow()
  })
})

describe('buildJoinedNodeText and rangeFromNodeOffsets', () => {
  function chapter(html: string): HTMLElement {
    const body = document.createElement('div')
    body.innerHTML = html
    document.body.append(body)
    return body
  }

  it('joins the text nodes of a chapter and keeps where each one starts', () => {
    const root = chapter('<p>Élise monte <em>au grenier</em> à 21 h 30.</p>')
    const { text, nodes } = buildJoinedNodeText(root)
    expect(text).toBe('Élise monte au grenier à 21 h 30.')
    expect(nodes.map((n) => n.node.textContent)).toEqual(['Élise monte ', 'au grenier', ' à 21 h 30.'])
    expect(nodes[1].start).toBe('Élise monte '.length)
  })

  it('puts a line break between blocks, so words from two paragraphs never glue', () => {
    const root = chapter('<p>Chapter 3</p><p>Elle sursauta.</p>')
    expect(buildJoinedNodeText(root).text).toBe('Chapter 3\nElle sursauta.')
  })

  it('a <br> and a block inside a block also break the text', () => {
    const root = chapter('<div>Élise<br>monte <blockquote>Au fond</blockquote> la malle</div>')
    expect(buildJoinedNodeText(root).text).toBe('Élise\nmonte \nAu fond\n la malle')
  })

  it('leaves script and style text out', () => {
    const root = chapter('<style>p { color: red }</style><p>Elle sursauta.</p><script>var a = 1</script>')
    expect(buildJoinedNodeText(root).text).toBe('Elle sursauta.')
  })

  it('builds a Range over the text, inside one node and across several', () => {
    const root = chapter('<p>Élise monte <em>au grenier</em> à 21 h 30.</p><p>Elle sursauta.</p>')
    const { text, nodes } = buildJoinedNodeText(root)
    const word = rangeFromNodeOffsets(document, nodes, text.indexOf('monte'), text.indexOf('monte') + 5)
    expect(word?.toString()).toBe('monte')
    const across = rangeFromNodeOffsets(document, nodes, text.indexOf('monte'), text.indexOf('à') + 1)
    expect(across?.toString()).toBe('monte au grenier à')
    const last = rangeFromNodeOffsets(document, nodes, text.indexOf('sursauta'), text.length)
    expect(last?.toString()).toBe('sursauta.')
  })

  it('a range from the end of one node to the start of the next stays in the right nodes', () => {
    const root = chapter('<p>malle<em>tte</em> grise</p>')
    const { nodes } = buildJoinedNodeText(root)
    const range = rangeFromNodeOffsets(document, nodes, 0, 5)
    expect(range?.toString()).toBe('malle')
    expect(range?.endContainer).toBe(nodes[0].node)
  })

  it('an offset outside the text gives no range', () => {
    const root = chapter('<p>Elle sursauta.</p>')
    const { nodes } = buildJoinedNodeText(root)
    expect(rangeFromNodeOffsets(document, nodes, 40, 50)).toBeNull()
    expect(rangeFromNodeOffsets(document, [], 0, 2)).toBeNull()
  })
})

describe('markEntryAtPoint', () => {
  const entry = (id: string, rects: Array<[number, number, number, number]>) => ({
    id,
    range: {
      getClientRects: () => rects.map(([left, top, right, bottom]) => ({ left, top, right, bottom })),
    },
  })

  it('finds the mark whose rectangle holds the point', () => {
    const marks = [entry('a', [[10, 10, 60, 24]]), entry('b', [[10, 40, 90, 54]])]
    expect(markEntryAtPoint(marks, 30, 47)?.id).toBe('b')
  })

  it('an expression on two lines has one rectangle per line', () => {
    const marks = [entry('a', [[200, 10, 260, 24], [10, 30, 70, 44]])]
    expect(markEntryAtPoint(marks, 40, 36)?.id).toBe('a')
    expect(markEntryAtPoint(marks, 100, 36)).toBeNull()
  })

  it('the first of the list wins when two marks hold the point', () => {
    const marks = [entry('word', [[10, 10, 60, 24]]), entry('sentence', [[0, 10, 300, 24]])]
    expect(markEntryAtPoint(marks, 30, 15)?.id).toBe('word')
  })

  it('a point outside every mark gives null', () => {
    expect(markEntryAtPoint([entry('a', [[10, 10, 60, 24]])], 80, 15)).toBeNull()
    expect(markEntryAtPoint([], 1, 1)).toBeNull()
  })
})
