import { describe, expect, it } from 'vitest'
import { detectLanguage } from './languageDetect'

// Textos inventados (Apêndice E do plano).
const FRENCH =
  "Élise monte au grenier à 21 h 30. La porte du grenier était entrebâillée et il n'y avait pas de lumière, alors elle monta en tâtonnant. Au fond, une vieille malle pleine de lettres attendait. « Ne fouille pas là-dedans », dit M. Arnaud, qui l'avait suivie sans bruit. Elle sursauta. — Je cherchais seulement une lampe, répondit-elle."
// 33 palavras: abaixo do mínimo de 40.
const ENGLISH =
  'The attic door was ajar and there was no light, so she climbed the stairs by feel. At the back, an old trunk full of letters was waiting for someone to open it.'

// A mesma cena, em cada língua que a heurística conhece (texto inventado, 55 a 65
// palavras): serve de caso positivo por língua e de par para a confusão entre
// português e espanhol, que dividem artigos, preposições e conjunções.
const PORTUGUESE =
  'Élise subiu ao sótão às nove e meia. A porta estava entreaberta e não havia luz, por isso ela foi subindo às apalpadelas. Ao fundo, um velho baú cheio de cartas esperava por ela. — Não mexa nisso — disse o senhor Arnaud, que a seguira sem fazer barulho. Ela se assustou. — Eu só procurava uma lâmpada — respondeu.'
const SPANISH =
  'Élise subió al desván a las nueve y media. La puerta estaba entreabierta y no había luz, así que fue subiendo a tientas. Al fondo, un viejo baúl lleno de cartas la esperaba. — No toques eso — dijo el señor Arnaud, que la había seguido sin hacer ruido. Ella se sobresaltó. — Solo buscaba una lámpara — respondió.'
// Outro registro (prosa descritiva, sem diálogo), também nas duas línguas vizinhas.
const PORTUGUESE_PROSE =
  'O professor entrou na sala com um livro debaixo do braço e pediu que todos se sentassem. Havia pouco barulho, porque os alunos já conheciam o seu humor quando alguém falava durante a explicação. Ele abriu o livro na página que tinha marcado na véspera e começou a ler em voz alta, devagar, sem levantar os olhos.'
const SPANISH_PROSE =
  'El profesor entró en la sala con un libro bajo el brazo y pidió que todos se sentaran. Había poco ruido, porque los alumnos ya conocían su humor cuando alguien hablaba durante la explicación. Abrió el libro en la página que había marcado la víspera y empezó a leer en voz alta, despacio, sin levantar los ojos.'
const ITALIAN =
  "Élise salì in soffitta alle nove e mezza. La porta era socchiusa e non c'era luce, così salì a tentoni. In fondo, un vecchio baule pieno di lettere la aspettava. — Non toccare quello — disse il signor Arnaud, che l'aveva seguita senza far rumore. Lei trasalì. — Cercavo solo una lampada — rispose."
const GERMAN =
  'Élise ging um halb zehn auf den Dachboden. Die Tür war angelehnt und es gab kein Licht, also tastete sie sich die Treppe hinauf. Ganz hinten wartete eine alte Truhe voller Briefe auf sie. — Fass das nicht an — sagte Herr Arnaud, der ihr leise gefolgt war. Sie erschrak. — Ich suchte nur eine Lampe — antwortete sie.'
const DUTCH =
  'Élise ging om half tien naar de zolder. De deur stond op een kier en er was geen licht, dus ze tastte zich de trap op. Helemaal achteraan wachtte een oude kist vol brieven op haar. — Blijf daar af — zei meneer Arnaud, die haar zonder geluid was gevolgd. Ze schrok. — Ik zocht alleen een lamp — antwoordde ze.'

describe('detectLanguage', () => {
  it('reconhece o francês', () => {
    expect(detectLanguage(FRENCH)).toBe('fr')
  })

  it('reconhece cada língua que a heurística conhece', () => {
    expect(detectLanguage(PORTUGUESE)).toBe('pt')
    expect(detectLanguage(SPANISH)).toBe('es')
    expect(detectLanguage(ITALIAN)).toBe('it')
    expect(detectLanguage(GERMAN)).toBe('de')
    expect(detectLanguage(DUTCH)).toBe('nl')
  })

  it('português e espanhol não se confundem, nem quando o trecho é curto ou sem diálogo', () => {
    // O trecho de 60 palavras e o mesmo cortado ao meio (cerca de 40 palavras).
    for (const [text, language] of [
      [PORTUGUESE, 'pt'],
      [SPANISH, 'es'],
      [PORTUGUESE_PROSE, 'pt'],
      [SPANISH_PROSE, 'es'],
    ] as const) {
      expect(detectLanguage(text)).toBe(language)
      const half = text.split(' ').slice(0, 44).join(' ')
      const detected = detectLanguage(half)
      // Em dúvida o certo é "não sei" (null, que vira "—"), nunca a língua vizinha.
      expect(detected === language || detected === null).toBe(true)
    }
  })

  it('reconhece o inglês', () => {
    expect(detectLanguage(`${ENGLISH} ${ENGLISH}`)).toBe('en')
  })

  it('texto curto (menos de 40 palavras) dá null', () => {
    expect(detectLanguage(ENGLISH)).toBeNull()
    expect(detectLanguage('La porte du grenier était entrebâillée.')).toBeNull()
    expect(detectLanguage('')).toBeNull()
  })

  it('números e símbolos dão null', () => {
    expect(detectLanguage('12 345 678 90 '.repeat(30))).toBeNull()
    expect(detectLanguage('§ ¶ © ® ™ — … « » '.repeat(30))).toBeNull()
  })

  it('texto misturado sem língua dominante dá null', () => {
    expect(detectLanguage(`${FRENCH} ${ENGLISH} ${ENGLISH}`)).toBeNull()
  })
})
