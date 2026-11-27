import { describe, expect, it } from 'vitest'
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
