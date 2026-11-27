import { describe, expect, it } from 'vitest'
import { LANGUAGE_CODES } from './language'
import { findContextSentence, splitSentences } from './sentences'

// Textos inventados (Apêndice E do plano).
const FRENCH =
  "Élise monte au grenier à 21 h 30. La porte du grenier était entrebâillée et il n'y avait pas de lumière, alors elle monta en tâtonnant. Au fond, une vieille malle pleine de lettres attendait. « Ne fouille pas là-dedans », dit M. Arnaud, qui l'avait suivie sans bruit. Elle sursauta. — Je cherchais seulement une lampe, répondit-elle."
const ENGLISH =
  'The attic door was ajar and there was no light, so she climbed the stairs by feel. At the back, an old trunk full of letters was waiting for someone to open it.'

describe('splitSentences', () => {
  it('divide o parágrafo francês sem cortar "21 h 30" nem "M. Arnaud"', () => {
    expect(splitSentences(FRENCH, 'fr')).toEqual([
      'Élise monte au grenier à 21 h 30.',
      "La porte du grenier était entrebâillée et il n'y avait pas de lumière, alors elle monta en tâtonnant.",
      'Au fond, une vieille malle pleine de lettres attendait.',
      "« Ne fouille pas là-dedans », dit M. Arnaud, qui l'avait suivie sans bruit.",
      'Elle sursauta.',
      '— Je cherchais seulement une lampe, répondit-elle.',
    ])
  })

  it('divide o inglês', () => {
    expect(splitSentences(ENGLISH, 'en')).toEqual([
      'The attic door was ajar and there was no light, so she climbed the stairs by feel.',
      'At the back, an old trunk full of letters was waiting for someone to open it.',
    ])
  })

  it('não corta em abreviação, com ou sem ponto ("Mme", "Mme.")', () => {
    expect(splitSentences('Mme Lefèvre est arrivée. Elle a souri.', 'fr')).toEqual([
      'Mme Lefèvre est arrivée.',
      'Elle a souri.',
    ])
    expect(splitSentences('Mme. Lefèvre est arrivée. Elle a souri.', 'fr')).toEqual([
      'Mme. Lefèvre est arrivée.',
      'Elle a souri.',
    ])
    expect(splitSentences('Mr. Smith arrived late. He sat down.', 'en')).toEqual([
      'Mr. Smith arrived late.',
      'He sat down.',
    ])
  })

  it('não corta em inicial, em "J.-C." nem em número com vírgula', () => {
    expect(splitSentences('Elle écrivit à J. Arnaud hier.', 'fr')).toEqual(['Elle écrivit à J. Arnaud hier.'])
    expect(splitSentences('En 50 av. J.-C., Rome tomba.', 'fr')).toEqual(['En 50 av. J.-C., Rome tomba.'])
    expect(splitSentences('Il faisait 3,5 % de moins. Elle partit.', 'fr')).toEqual([
      'Il faisait 3,5 % de moins.',
      'Elle partit.',
    ])
  })

  it('junta quando o segmento seguinte começa com minúscula ou dígito', () => {
    expect(splitSentences('Elle lut le chap. suivant.', 'fr')).toEqual(['Elle lut le chap. suivant.'])
    expect(splitSentences('Il avait payé 5. 3 fois plus.', 'fr')).toEqual(['Il avait payé 5. 3 fois plus.'])
  })

  it('o diálogo com travessão em linha nova é um limite duro', () => {
    expect(splitSentences('— Tu viens ?\n— Oui.\n— Alors partons.', 'fr')).toEqual([
      '— Tu viens ?',
      '— Oui.',
      '— Alors partons.',
    ])
  })

  it('o travessão depois de uma frase abre outra fala, mesmo na mesma linha', () => {
    expect(splitSentences('— Tu viens ? — Oui. — Alors partons.', 'fr')).toEqual([
      '— Tu viens ?',
      '— Oui.',
      '— Alors partons.',
    ])
  })

  it('não corta dentro de « … » quando o segmento termina sem fechar a aspa', () => {
    expect(splitSentences('« Je ne sais pas. Peut-être demain. » dit-elle. Elle partit.', 'fr')).toEqual([
      '« Je ne sais pas. Peut-être demain. » dit-elle.',
      'Elle partit.',
    ])
  })

  it('parte a frase com mais de 400 caracteres na última vírgula antes do teto', () => {
    const clause = "la porte du grenier était entrebâillée et il n'y avait pas de lumière"
    const long = `${Array.from({ length: 10 }, () => clause).join(', ')}.`
    expect(long.length).toBeGreaterThan(400)
    const parts = splitSentences(long, 'fr')
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(400)
    expect(parts[0].endsWith(',')).toBe(true)
    expect(parts.join(' ').replace(/ ,/g, ',')).toBe(long)
  })

  it('sem vírgula, parte no último espaço antes do teto', () => {
    const long = Array.from({ length: 60 }, () => 'palavra').join(' ')
    const parts = splitSentences(long, 'pt')
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(400)
    expect(parts.join(' ')).toBe(long)
  })

  it('texto vazio dá lista vazia', () => {
    expect(splitSentences('', 'fr')).toEqual([])
    expect(splitSentences(' \n  \n', 'fr')).toEqual([])
  })
})

// Textos inventados. Em cada caso o Intl.Segmenter de verdade corta depois da
// abreviação (a frase seguinte começa com maiúscula, nome ou numeral romano) e a lista
// da língua desfaz o corte. As frases terminam em ponto normal, que continua cortando.
const ABBREVIATION_CASES: Array<[language: string, text: string, expected: string[]]> = [
  ['pt', 'O Sr. Silva e a Sra. Costa saíram. Eles voltaram.', ['O Sr. Silva e a Sra. Costa saíram.', 'Eles voltaram.']],
  ['pt', 'Veja o cap. I e o vol. II. Depois leia.', ['Veja o cap. I e o vol. II.', 'Depois leia.']],
  ['es', 'El Sr. García y la Dra. López salieron. Volvieron.', ['El Sr. García y la Dra. López salieron.', 'Volvieron.']],
  ['es', 'Hay ciudades, p. ej. Madrid y Lima. Basta.', ['Hay ciudades, p. ej. Madrid y Lima.', 'Basta.']],
  ['it', 'Il Sig. Rossi e il dott. Neri uscirono. Tornarono.', ['Il Sig. Rossi e il dott. Neri uscirono.', 'Tornarono.']],
  ['it', 'Città, ad es. Roma e Milano. Basta.', ['Città, ad es. Roma e Milano.', 'Basta.']],
  ['de', 'Herr Dr. Müller kam. Er lächelte.', ['Herr Dr. Müller kam.', 'Er lächelte.']],
  ['de', 'Es gibt Obst, z. B. Äpfel und Birnen. Sonst nichts.', ['Es gibt Obst, z. B. Äpfel und Birnen.', 'Sonst nichts.']],
  ['de', 'Es gibt Obst, z.B. Äpfel und Birnen. Sonst nichts.', ['Es gibt Obst, z.B. Äpfel und Birnen.', 'Sonst nichts.']],
  ['de', 'Wir gehen, d. h. Wir bleiben nicht. Ende.', ['Wir gehen, d. h. Wir bleiben nicht.', 'Ende.']],
  ['de', 'Siehe Kap. I und Bd. II. Dann weiter.', ['Siehe Kap. I und Bd. II.', 'Dann weiter.']],
  ['nl', 'Dhr. Jansen en mevr. de Vries gingen. Ze kwamen terug.', ['Dhr. Jansen en mevr. de Vries gingen.', 'Ze kwamen terug.']],
  ['nl', 'Steden, bijv. Amsterdam en Gouda. Klaar.', ['Steden, bijv. Amsterdam en Gouda.', 'Klaar.']],
  ['ca', 'El Sr. Puig i la Dra. Roca van sortir. Van tornar.', ['El Sr. Puig i la Dra. Roca van sortir.', 'Van tornar.']],
  ['ca', 'Ciutats, p. ex. Girona i Vic. Prou.', ['Ciutats, p. ex. Girona i Vic.', 'Prou.']],
  ['ro', 'Dl. Popescu și dna. Ionescu au ieșit. S-au întors.', ['Dl. Popescu și dna. Ionescu au ieșit.', 'S-au întors.']],
  ['ro', 'Vezi cap. I și vol. II. Apoi citește.', ['Vezi cap. I și vol. II.', 'Apoi citește.']],
  ['pl', 'Prof. Nowak i inż. Wiśniewski wyszli. Wrócili.', ['Prof. Nowak i inż. Wiśniewski wyszli.', 'Wrócili.']],
  ['pl', 'Miasta, np. Kraków i Gdańsk. Koniec.', ['Miasta, np. Kraków i Gdańsk.', 'Koniec.']],
  ['sv', 'Hr. Svensson kom. Han log.', ['Hr. Svensson kom.', 'Han log.']],
  ['sv', 'Städer, t.ex. Malmö och Lund. Slut.', ['Städer, t.ex. Malmö och Lund.', 'Slut.']],
  ['da', 'Hr. Jensen kom. Han smilede.', ['Hr. Jensen kom.', 'Han smilede.']],
  ['da', 'Byer, f.eks. Odense og Aarhus. Slut.', ['Byer, f.eks. Odense og Aarhus.', 'Slut.']],
  ['no', 'Hr. Hansen kom. Han smilte.', ['Hr. Hansen kom.', 'Han smilte.']],
  ['no', 'Byer, f.eks. Bergen og Oslo. Slutt.', ['Byer, f.eks. Bergen og Oslo.', 'Slutt.']],
  ['fi', 'Prof. Heikki tuli. Hän hymyili.', ['Prof. Heikki tuli.', 'Hän hymyili.']],
  ['fi', 'Kaupungit, esim. Turku ja Oulu. Loppu.', ['Kaupungit, esim. Turku ja Oulu.', 'Loppu.']],
  ['cs', 'Pan Dr. Novák přišel. Usmál se.', ['Pan Dr. Novák přišel.', 'Usmál se.']],
  ['cs', 'Města, např. Praha a Brno. Konec.', ['Města, např. Praha a Brno.', 'Konec.']],
  ['tr', 'Sn. Yılmaz geldi. Gülümsedi.', ['Sn. Yılmaz geldi.', 'Gülümsedi.']],
  ['tr', 'Şehirler, örn. Ankara ve İzmir. Son.', ['Şehirler, örn. Ankara ve İzmir.', 'Son.']],
]

describe('splitSentences: abreviações das línguas oferecidas', () => {
  it('há pelo menos um caso para cada língua além de fr e en', () => {
    const covered = new Set(ABBREVIATION_CASES.map(([language]) => language))
    for (const code of LANGUAGE_CODES) {
      if (code !== 'fr' && code !== 'en') expect(covered.has(code), code).toBe(true)
    }
  })

  it.each(ABBREVIATION_CASES)('%s: não corta em abreviação (%s)', (language, text, expected) => {
    expect(splitSentences(text, language)).toEqual(expected)
    // Sem a lista da língua o Segmenter corta: é a lista que faz a diferença.
    expect(splitSentences(text, 'xx')).not.toEqual(expected)
  })

  it('"z. B." com espaço fino ou inseparável no meio também junta', () => {
    for (const space of [' ', ' ']) {
      const text = `Es gibt Obst, z.${space}B. Äpfel und Birnen. Sonst nichts.`
      expect(splitSentences(text, 'de')).toEqual([`Es gibt Obst, z.${space}B. Äpfel und Birnen.`, 'Sonst nichts.'])
    }
  })

  it('o equivalente do "etc" junta com a frase seguinte, como em fr e en', () => {
    expect(splitSentences('Obst, Gemüse usw. Dann ging er.', 'de')).toEqual(['Obst, Gemüse usw. Dann ging er.'])
    expect(splitSentences('Frukt osv. Sedan gick han.', 'sv')).toEqual(['Frukt osv. Sedan gick han.'])
  })

  it('o ponto que fecha a frase continua cortando', () => {
    expect(splitSentences('Er kam spät. Sie war schon fort.', 'de')).toEqual(['Er kam spät.', 'Sie war schon fort.'])
    expect(splitSentences('Das war 500 v. Chr. Dann kam Rom.', 'de')).toEqual(['Das war 500 v. Chr.', 'Dann kam Rom.'])
    expect(splitSentences('Chegou cedo. Saiu tarde.', 'pt')).toEqual(['Chegou cedo.', 'Saiu tarde.'])
  })

  it('região no código não muda a lista (pt-BR, de-AT)', () => {
    expect(splitSentences('Dr. Silva chegou. Ele sorriu.', 'pt-BR')).toEqual(['Dr. Silva chegou.', 'Ele sorriu.'])
    expect(splitSentences('Hr. Schmidt kam. Er blieb.', 'de-AT')).toEqual(['Hr. Schmidt kam.', 'Er blieb.'])
  })

  it('a lista de uma língua não vale para as outras', () => {
    // "Hr." é alemão, "cap." é português: em fr e en continua cortando como antes.
    expect(splitSentences('Hr. Schmidt arrived. Dr. Jones left.', 'en')).toEqual([
      'Hr.',
      'Schmidt arrived.',
      'Dr. Jones left.',
    ])
    expect(splitSentences('Voir cap. I et vol. II. Puis chap. III.', 'fr')).toEqual([
      'Voir cap.',
      'I et vol. II.',
      'Puis chap. III.',
    ])
    expect(splitSentences('Dr. Silva chegou. Ele sorriu.', '')).toEqual(['Dr.', 'Silva chegou.', 'Ele sorriu.'])
  })
})

// Resultados da versão anterior (só fr e en tinham lista), para garantir que o
// francês e o inglês não mudaram.
describe('splitSentences: fr e en dão o mesmo resultado de antes', () => {
  const SAME_AS_BEFORE: Array<[string, string, string[]]> = [
    ['fr', 'Mme Lefèvre est arrivée. Elle a souri.', ['Mme Lefèvre est arrivée.', 'Elle a souri.']],
    ['fr', 'M. Arnaud est parti. Hr. Schmidt est resté.', ['M. Arnaud est parti.', 'Hr.', 'Schmidt est resté.']],
    ['fr', 'Le Sr. Silva est arrivé. Il a souri.', ['Le Sr.', 'Silva est arrivé.', 'Il a souri.']],
    ['fr', 'Il a acheté des pommes, etc. Puis il est parti.', ['Il a acheté des pommes, etc. Puis il est parti.']],
    ['fr', '« Je viens. Tu viens. » dit-il. Elle partit.', ['« Je viens. Tu viens. » dit-il.', 'Elle partit.']],
    ['en', 'Mr. Smith arrived. He sat down.', ['Mr. Smith arrived.', 'He sat down.']],
    ['en', 'Mrs. Brown met Dr. Jones, e.g. Tom. Then they left.', ['Mrs. Brown met Dr. Jones, e.g. Tom.', 'Then they left.']],
    ['en', 'Dr. Müller kam. z. B. Äpfel. d.h. Wir gehen.', ['Dr. Müller kam. z.', 'B. Äpfel. d.h.', 'Wir gehen.']],
    ['en', 'See ch. I and vol. II, etc. Then he left.', ['See ch. I and vol. II, etc. Then he left.']],
    ['en', 'Il dit : « Venez ici. Maintenant. » Puis il sortit.', ['Il dit : « Venez ici. Maintenant. » Puis il sortit.']],
  ]

  it.each(SAME_AS_BEFORE)('%s: %s', (language, text, expected) => {
    expect(splitSentences(text, language)).toEqual(expected)
  })
})

describe('splitSentences: aspas « » em qualquer língua', () => {
  it('não corta dentro de « … » ainda aberta, também fora do francês', () => {
    expect(splitSentences('« No sé. Quizá mañana. » dijo. Salió.', 'es')).toEqual([
      '« No sé. Quizá mañana. » dijo.',
      'Salió.',
    ])
    expect(splitSentences('« Não sei. Talvez amanhã. » disse. Saiu.', 'pt')).toEqual([
      '« Não sei. Talvez amanhã. » disse.',
      'Saiu.',
    ])
  })
})

describe('findContextSentence', () => {
  it('devolve a frase que contém a seleção', () => {
    expect(findContextSentence(FRENCH, 'entrebâillée', 'fr')).toBe(
      "La porte du grenier était entrebâillée et il n'y avait pas de lumière, alors elle monta en tâtonnant.",
    )
  })

  it('ignora diferença de espaço e de caixa', () => {
    expect(findContextSentence(FRENCH, '  ENTREBÂILLÉE\net il ', 'fr')).toBe(
      "La porte du grenier était entrebâillée et il n'y avait pas de lumière, alors elle monta en tâtonnant.",
    )
  })

  it('sem achar, devolve a própria seleção', () => {
    expect(findContextSentence(FRENCH, 'malle noire', 'fr')).toBe('malle noire')
    expect(findContextSentence('', 'malle', 'fr')).toBe('malle')
  })
})
