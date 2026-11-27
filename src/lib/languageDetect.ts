// Detecção local da língua de um texto (PDF sem metadado de língua), sem rede e
// sem dependência: a fração das palavras do texto que são palavras funcionais
// (artigos, preposições, pronomes, conjunções, auxiliares) de cada língua.
// Cobre as 7 línguas do uso real. Em dúvida devolve null, que vira "—" no
// Library e se corrige no "Change".

const MIN_WORDS = 40
// Fração mínima de palavras funcionais da língua vencedora no texto.
const MIN_SCORE = 0.12
// A vencedora precisa ter pelo menos 1,4× o escore da segunda.
const MIN_MARGIN = 1.4

// Com o apóstrofo, "l'homme" vira "l" e "homme" antes de contar.
const WORD_RE = /\p{L}+(?:['’]\p{L}+)?/gu

const FUNCTION_WORDS: Record<string, Set<string>> = {
  fr: words(
    'le la les l de d des du un une et est que qui dans pour pas ne n il elle au aux sur avec ce cette se son sa ses mais ou par plus on nous vous je j tu y en comme qu a ont était avait sont été ils elles',
  ),
  en: words(
    'the of and to a in is that it was for on are as with his her they at be this from have or by had not but what all were when we there an which their if will would she he you i your said him my been has its do so than could them about',
  ),
  pt: words(
    'o a os as de do da dos das em no na nos nas um uma uns umas e que é não para por com se mais como mas foi ao aos à às seu sua seus suas ele ela eles elas já também só muito era são está tem ser há isso',
  ),
  es: words(
    'el la los las de del en un una unos unas y que es no por con para se su sus lo al como más pero fue era son está tiene ser ha esto él ella ellos ya muy también sin sobre entre',
  ),
  it: words(
    'il lo la i gli le l d di del dello della dei degli delle in un una uno e che è non per con si più come ma fu era sono ha ho al alla nel nella su da anche molto ci questo quello lei lui loro',
  ),
  de: words(
    'der die das den dem des ein eine einen einem einer und ist nicht zu mit von für auf im in es sich auch als an er sie wir ich aber wie nach bei oder war wird hat dass so nur noch aus um',
  ),
  nl: words(
    'de het een en van in is dat op te zijn met voor niet aan er ook als bij maar om uit door ze hij zij we ik je dit die was waren heeft hebben wordt naar nog',
  ),
}

function words(list: string): Set<string> {
  return new Set(list.split(' '))
}

export function detectLanguage(text: string): string | null {
  const tokens = (text.toLowerCase().match(WORD_RE) ?? []).flatMap((w) => w.split(/['’]/))
  if (tokens.length < MIN_WORDS) return null
  const scores = Object.entries(FUNCTION_WORDS)
    .map(([language, set]) => ({
      language,
      score: tokens.filter((t) => set.has(t)).length / tokens.length,
    }))
    .sort((a, b) => b.score - a.score)
  const [best, second] = scores
  if (best.score < MIN_SCORE) return null
  if (best.score < MIN_MARGIN * second.score) return null
  return best.language
}
