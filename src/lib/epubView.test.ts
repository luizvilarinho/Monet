import { describe, expect, it } from 'vitest'
import { epubCfiInView, epubSelectionOccurrence } from './epub'

// CFIs inventados no formato do epubjs: item 4 do spine (/6/8), início e fim da tela.
const VIEW = {
  start: 'epubcfi(/6/8!/4/2/6/1:0)',
  end: 'epubcfi(/6/8!/4/2/20/1:40)',
}

describe('epubCfiInView', () => {
  it('a point between the start and the end of the screen is in view', () => {
    expect(epubCfiInView('epubcfi(/6/8!/4/2/10/1:5)', VIEW)).toBe(true)
    // As pontas valem.
    expect(epubCfiInView(VIEW.start, VIEW)).toBe(true)
    expect(epubCfiInView(VIEW.end, VIEW)).toBe(true)
  })

  it('a point before the start or after the end is out of view', () => {
    expect(epubCfiInView('epubcfi(/6/8!/4/2/4/1:0)', VIEW)).toBe(false)
    expect(epubCfiInView('epubcfi(/6/8!/4/2/22/1:0)', VIEW)).toBe(false)
    expect(epubCfiInView('epubcfi(/6/8!/4/2/20/1:41)', VIEW)).toBe(false)
  })

  it('another chapter is out of view, before or after', () => {
    expect(epubCfiInView('epubcfi(/6/6!/4/2/10/1:5)', VIEW)).toBe(false)
    expect(epubCfiInView('epubcfi(/6/10!/4/2/10/1:5)', VIEW)).toBe(false)
  })

  it('a range CFI (a selection) counts by its start', () => {
    expect(epubCfiInView('epubcfi(/6/8!/4/2/10,/1:5,/1:30)', VIEW)).toBe(true)
    expect(epubCfiInView('epubcfi(/6/8!/4/2/22,/1:5,/1:30)', VIEW)).toBe(false)
  })

  it('the same text stays in view when the screen grows, and leaves when it shrinks (font size)', () => {
    const point = 'epubcfi(/6/8!/4/2/18/1:3)'
    expect(epubCfiInView(point, VIEW)).toBe(true)
    // Fonte maior: a tela termina antes, o ponto sai dela, mas o início é o mesmo.
    expect(epubCfiInView(point, { start: VIEW.start, end: 'epubcfi(/6/8!/4/2/12/1:10)' })).toBe(false)
  })

  it('a CFI that cannot be compared does not interrupt the audio', () => {
    expect(epubCfiInView('not a cfi', VIEW)).toBe(true)
  })
})

describe('epubSelectionOccurrence', () => {
  // O documento do livro é um documento comum; o `rendition` só entrega o Range.
  function renditionWith(html: string, pick: (doc: Document) => Range) {
    const doc = document.implementation.createHTMLDocument('chapter')
    doc.body.innerHTML = html
    return { getRange: () => pick(doc) } as unknown as Parameters<typeof epubSelectionOccurrence>[0]
  }

  // Só o começo importa; o Range do happy-dom não confia em setStart/setEnd.
  function rangeOn(doc: Document, selector: string, word: string, nth: number): Range {
    const node = doc.querySelector(selector)!.firstChild as Text
    let from = -1
    for (let i = 0; i <= nth; i++) from = node.data.indexOf(word, from + 1)
    return { startContainer: node, startOffset: from } as unknown as Range
  }

  const PARAGRAPH = 'Elle prit la mallette. La malle était lourde. Elle ouvrit la malle avec effort.'

  it('counts the term before the selection in its block, whole words only', () => {
    const html = `<p id="p">${PARAGRAPH}</p>`
    // "malle" de "La malle": a primeira palavra inteira ("mallette" não conta).
    const first = renditionWith(html, (d) => rangeOn(d, '#p', 'malle', 1))
    expect(epubSelectionOccurrence(first, 'cfi', 'malle')).toBe(0)
    // A de "ouvrit la malle": a segunda.
    const second = renditionWith(html, (d) => rangeOn(d, '#p', 'malle', 2))
    expect(epubSelectionOccurrence(second, 'cfi', 'malle')).toBe(1)
  })

  it('a CFI that does not resolve counts zero', () => {
    const none = { getRange: () => null } as unknown as Parameters<typeof epubSelectionOccurrence>[0]
    expect(epubSelectionOccurrence(none, 'cfi', 'malle')).toBe(0)
  })
})
