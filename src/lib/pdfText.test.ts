import { describe, expect, it } from 'vitest'
import {
  cleanPdfPage,
  cleanPdfSelectionText,
  pdfItemsToLines,
  skippedNotice,
  type PdfLine,
  type PdfTextItem,
} from './pdfText'

// Textos inventados (Apêndice E do plano). Página de 800 de altura: o topo
// começa acima de 736 e o rodapé abaixo de 64.
const PAGE_HEIGHT = 800
const OPTS = { skipHeaders: true, language: 'fr' }

function line(text: string, y: number): PdfLine {
  return { text, y, height: 12 }
}

function item(str: string, y: number, hasEOL = false): PdfTextItem {
  return { str, hasEOL, y, height: 12 }
}

describe('pdfItemsToLines', () => {
  it('junta os itens da mesma linha e fecha no hasEOL', () => {
    const lines = pdfItemsToLines([
      item('La porte du ', 500),
      item('grenier', 500),
      item('', 500, true),
      item('était entrebâillée', 480, true),
    ])
    expect(lines).toEqual([
      { text: 'La porte du grenier', y: 500, height: 12 },
      { text: 'était entrebâillée', y: 480, height: 12 },
    ])
  })

  it('fecha a linha quando o y muda mais de meia altura, mesmo sem hasEOL', () => {
    const lines = pdfItemsToLines([item('Elle sursauta.', 500), item('— Je cherchais', 480)])
    expect(lines.map((l) => l.text)).toEqual(['Elle sursauta.', '— Je cherchais'])
  })

  it('sobrescrito (y dentro de meia altura) fica na mesma linha', () => {
    const lines = pdfItemsToLines([item('malle', 500), item('1', 504)])
    expect(lines.map((l) => l.text)).toEqual(['malle 1'])
  })

  it('ignora itens vazios e devolve lista vazia sem texto', () => {
    expect(pdfItemsToLines([item('', 500, true), item('  ', 480, true)])).toEqual([])
  })
})

describe('cleanPdfPage', () => {
  it('desfaz o hífen de quebra ("entrebâil-" + "lée")', () => {
    const { text } = cleanPdfPage(
      [line('La porte du grenier était entrebâil-', 500), line('lée et il n’y avait pas de lumière.', 480)],
      PAGE_HEIGHT,
      OPTS,
    )
    expect(text).toBe('La porte du grenier était entrebâillée et il n’y avait pas de lumière.')
  })

  it('mantém o hífen real ("peut-" + "être")', () => {
    const { text } = cleanPdfPage(
      [line('Il y avait de la lumière, il n’y avait peut-', 500), line('être personne.', 480)],
      PAGE_HEIGHT,
      OPTS,
    )
    expect(text).toBe('Il y avait de la lumière, il n’y avait peut-être personne.')
  })

  it('o hífen de "t-il" também fica', () => {
    const { text } = cleanPdfPage([line('Que fera-', 500), line('t-il demain ?', 480)], PAGE_HEIGHT, OPTS)
    expect(text).toBe('Que fera-t-il demain ?')
  })

  it('linhas sem hífen juntam com espaço', () => {
    const { text } = cleanPdfPage(
      [line('Au fond, une vieille malle', 500), line('pleine de lettres attendait.', 480)],
      PAGE_HEIGHT,
      OPTS,
    )
    expect(text).toBe('Au fond, une vieille malle pleine de lettres attendait.')
  })

  it('cabeçalho corrido, número de página e rodapé saem com skipHeaders', () => {
    const lines = [
      line('La Maison des dunes', 770),
      line('Élise monte au grenier à 21 h 30. La porte du grenier était', 500),
      line('entrebâillée et il n’y avait pas de lumière.', 480),
      line('42', 30),
    ]
    const result = cleanPdfPage(lines, PAGE_HEIGHT, OPTS)
    expect(result.text).toBe(
      'Élise monte au grenier à 21 h 30. La porte du grenier était entrebâillée et il n’y avait pas de lumière.',
    )
    expect(result.skipped).toEqual(['page number', 'header'])
  })

  it('"— 42 —" também é número de página, e o número romano', () => {
    expect(cleanPdfPage([line('Elle sursauta.', 500), line('— 42 —', 30)], PAGE_HEIGHT, OPTS)).toEqual({
      text: 'Elle sursauta.',
      skipped: ['page number'],
    })
    expect(cleanPdfPage([line('Elle sursauta.', 500), line('xii', 30)], PAGE_HEIGHT, OPTS).skipped).toEqual([
      'page number',
    ])
  })

  it('número de página no topo sai como page number, e o título corrido como header', () => {
    const result = cleanPdfPage(
      [line('42', 775), line('La Maison des dunes', 770), line('Elle sursauta.', 500)],
      PAGE_HEIGHT,
      OPTS,
    )
    expect(result.text).toBe('Elle sursauta.')
    expect(result.skipped).toEqual(['page number', 'header'])
  })

  it('rodapé sem pontuação de frase sai; nota de rodapé que termina em ponto fica', () => {
    const footer = cleanPdfPage([line('Elle sursauta.', 500), line('Éditions des dunes', 30)], PAGE_HEIGHT, OPTS)
    expect(footer).toEqual({ text: 'Elle sursauta.', skipped: ['footer'] })
    const note = cleanPdfPage(
      [line('Elle sursauta.', 500), line('1. Voir le chapitre 2.', 40), line('42', 25)],
      PAGE_HEIGHT,
      OPTS,
    )
    expect(note.text).toBe('Elle sursauta. 1. Voir le chapitre 2.')
    expect(note.skipped).toEqual(['page number'])
  })

  it('sem skipHeaders nada sai', () => {
    const lines = [line('La Maison des dunes', 770), line('Elle sursauta.', 500), line('42', 30)]
    const result = cleanPdfPage(lines, PAGE_HEIGHT, { ...OPTS, skipHeaders: false })
    expect(result.text).toBe('La Maison des dunes Elle sursauta. 42')
    expect(result.skipped).toEqual([])
  })

  it('parágrafo: linha curta que termina a frase e a seguinte abre com travessão ou maiúscula', () => {
    const { text } = cleanPdfPage(
      [
        line('Au fond, une vieille malle pleine de lettres attendait, sous un tas de vieux journaux.', 520),
        line('Elle sursauta.', 500),
        line('— Je cherchais seulement une lampe, répondit-elle.', 480),
      ],
      PAGE_HEIGHT,
      OPTS,
    )
    expect(text).toBe(
      'Au fond, une vieille malle pleine de lettres attendait, sous un tas de vieux journaux. Elle sursauta.\n— Je cherchais seulement une lampe, répondit-elle.',
    )
  })

  it('linha cheia que termina em ponto não abre parágrafo', () => {
    const { text } = cleanPdfPage(
      [
        line('La porte du grenier était entrebâillée et il n’y avait pas de lumière.', 500),
        line('Au fond, une vieille malle pleine de lettres attendait là, dans le noir.', 480),
      ],
      PAGE_HEIGHT,
      OPTS,
    )
    expect(text).not.toContain('\n')
  })

  it('página vazia dá texto vazio', () => {
    expect(cleanPdfPage([], PAGE_HEIGHT, OPTS)).toEqual({ text: '', skipped: [] })
  })
})

describe('cleanPdfSelectionText', () => {
  it('colapsa quebras e espaços e desfaz o hífen de quebra', () => {
    expect(cleanPdfSelectionText('La porte était entrebâil- lée\net il n’y avait   pas de lumière.', 'fr')).toBe(
      'La porte était entrebâillée et il n’y avait pas de lumière.',
    )
  })

  it('mantém o hífen real', () => {
    expect(cleanPdfSelectionText('Il y avait peut- être quelqu’un.', 'fr')).toBe('Il y avait peut-être quelqu’un.')
  })

  it('não mexe em travessão com espaços', () => {
    expect(cleanPdfSelectionText('Elle sursauta. - Je cherchais une lampe.', 'fr')).toBe(
      'Elle sursauta. - Je cherchais une lampe.',
    )
  })
})

// Hífen suspenso das línguas germânicas ("Ein- und Ausgang"): textos inventados. O hífen
// fica e o espaço depois dele também; a quebra de sílaba continua perdendo o hífen.
describe('hífen suspenso', () => {
  // As linhas do texto, de cima para baixo, numa página sem cabeçalho nem rodapé.
  function joined(texts: string[], language: string): string {
    const lines = texts.map((text, i) => line(text, 500 - 20 * i))
    return cleanPdfPage(lines, PAGE_HEIGHT, { skipHeaders: false, language }).text
  }

  // [língua, fim da linha, começo da linha seguinte, resultado]
  const SUSPENDED: Array<[string, string, string, string]> = [
    ['de', 'Der Ein-', 'und Ausgang ist offen.', 'Der Ein- und Ausgang ist offen.'],
    ['de', 'Der Ein-', 'oder Ausgang ist offen.', 'Der Ein- oder Ausgang ist offen.'],
    ['de', 'Der Ein-', 'bzw. Ausgang ist offen.', 'Der Ein- bzw. Ausgang ist offen.'],
    ['nl', 'Vul uw voor-', 'en achternaam in.', 'Vul uw voor- en achternaam in.'],
    ['nl', 'Kies hoofd-', 'of bijgerecht.', 'Kies hoofd- of bijgerecht.'],
    ['sv', 'Skriv för-', 'och efternamn.', 'Skriv för- och efternamn.'],
    ['sv', 'Skriv för-', 'eller efternamn.', 'Skriv för- eller efternamn.'],
    ['da', 'Skriv for-', 'og efternavn.', 'Skriv for- og efternavn.'],
    ['da', 'Skriv for-', 'eller efternavn.', 'Skriv for- eller efternavn.'],
    ['no', 'Skriv for-', 'og etternavn.', 'Skriv for- og etternavn.'],
    ['no', 'Skriv for-', 'eller etternavn.', 'Skriv for- eller etternavn.'],
  ]

  it.each(SUSPENDED)('%s: "%s" + "%s" fica com hífen e espaço', (language, end, start, expected) => {
    expect(joined([end, start], language)).toBe(expected)
    expect(cleanPdfSelectionText(`${end} ${start}`, language)).toBe(expected)
  })

  it('região no código não muda a regra (de-AT, nl-BE)', () => {
    expect(joined(['Der Ein-', 'und Ausgang ist offen.'], 'de-AT')).toBe('Der Ein- und Ausgang ist offen.')
    expect(joined(['Vul uw voor-', 'en achternaam in.'], 'nl-BE')).toBe('Vul uw voor- en achternaam in.')
  })

  it('a conjunção no começo da linha de uma palavra maior não conta: é quebra de sílaba', () => {
    expect(joined(['Het team is ver-', 'enigd en sterk.'], 'nl')).toBe('Het team is verenigd en sterk.')
  })

  it('a quebra de sílaba perde o hífen nessas línguas, como antes', () => {
    expect(joined(['Die Ausgangs-', 'tür ist offen.'], 'de')).toBe('Die Ausgangstür ist offen.')
    expect(joined(['De uit-', 'gang is open.'], 'nl')).toBe('De uitgang is open.')
    expect(joined(['Det finns en ut-', 'gång här.'], 'sv')).toBe('Det finns en utgång här.')
    expect(joined(['Der er en ud-', 'gang her.'], 'da')).toBe('Der er en udgang her.')
    expect(joined(['Det er en ut-', 'gang her.'], 'no')).toBe('Det er en utgang her.')
  })

  it('na seleção, só o hífen suspenso fica e a quebra de sílaba se desfaz', () => {
    expect(cleanPdfSelectionText('Die Ausgangs- tür und der Ein- und Ausgang.', 'de')).toBe(
      'Die Ausgangstür und der Ein- und Ausgang.',
    )
    expect(cleanPdfSelectionText('Der  Ein-\nund Ausgang', 'de')).toBe('Der Ein- und Ausgang')
  })

  it('numa língua sem a regra (pt, es) o texto sai como saía: a regra não vale para todas', () => {
    // O hífen e o espaço se perdem, como antes.
    expect(joined(['Der Ein-', 'und Ausgang ist offen.'], 'pt')).toBe('Der Einund Ausgang ist offen.')
    expect(cleanPdfSelectionText('Ein- und Ausgang', 'es')).toBe('Einund Ausgang')
  })
})

describe('fr e en dão o mesmo resultado de antes', () => {
  function joined(texts: string[], language: string): string {
    const lines = texts.map((text, i) => line(text, 500 - 20 * i))
    return cleanPdfPage(lines, PAGE_HEIGHT, { skipHeaders: false, language }).text
  }

  // Resultados da versão anterior (só fr e en tinham lista, só de hífen colado).
  it('na página', () => {
    expect(joined(['Il y avait peut-', 'être personne.'], 'fr')).toBe('Il y avait peut-être personne.')
    expect(joined(['Que fera-', 't-il demain ?'], 'fr')).toBe('Que fera-t-il demain ?')
    expect(joined(['La porte était entrebâil-', 'lée.'], 'fr')).toBe('La porte était entrebâillée.')
    expect(joined(['a state-', 'based approach'], 'en')).toBe('a state-based approach')
    expect(joined(['a state-', 'based approach'], 'fr')).toBe('a statebased approach')
    // A conjunção alemã, holandesa e escandinava não vale em fr nem em en.
    expect(joined(['Der Ein-', 'und Ausgang ist offen.'], 'fr')).toBe('Der Einund Ausgang ist offen.')
    expect(joined(['Der Ein-', 'und Ausgang ist offen.'], 'en')).toBe('Der Einund Ausgang ist offen.')
    expect(joined(['Vul uw voor-', 'en achternaam in.'], 'fr')).toBe('Vul uw voor-en achternaam in.')
    expect(joined(['Vul uw voor-', 'en achternaam in.'], 'en')).toBe('Vul uw vooren achternaam in.')
  })

  it('na seleção', () => {
    expect(cleanPdfSelectionText('Il y avait peut- être quelqu’un.', 'fr')).toBe('Il y avait peut-être quelqu’un.')
    expect(cleanPdfSelectionText('Il y avait peut- être quelqu’un.', 'en')).toBe('Il y avait peutêtre quelqu’un.')
    expect(cleanPdfSelectionText('a time- based plan', 'en')).toBe('a time-based plan')
    expect(cleanPdfSelectionText('Ein- und Ausgang', 'fr')).toBe('Einund Ausgang')
    expect(cleanPdfSelectionText('Ein- und Ausgang', 'en')).toBe('Einund Ausgang')
    expect(cleanPdfSelectionText('voor- en achternaam', 'fr')).toBe('voor-en achternaam')
    expect(cleanPdfSelectionText('voor- en achternaam', 'en')).toBe('vooren achternaam')
  })
})

describe('skippedNotice', () => {
  it('names what was left out, joined with "and" and without repeats', () => {
    expect(skippedNotice(['header', 'page number'])).toBe('Not read: page header and page number')
    expect(skippedNotice(['page number', 'page number'])).toBe('Not read: page number')
    expect(skippedNotice(['footer'])).toBe('Not read: page footer')
    expect(skippedNotice(['header', 'footer', 'page number'])).toBe(
      'Not read: page header, page footer and page number',
    )
  })

  it('nothing skipped gives no notice', () => {
    expect(skippedNotice([])).toBeNull()
  })
})
