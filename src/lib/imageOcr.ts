import { invoke } from '@tauri-apps/api/core'
import { DATA_URL_RE } from './noteFileText'

// OCR local (Windows) das imagens base64 das notas, só para o texto enviado à IA
// (RAG e contexto efêmero da nota aberta).
// O backend guarda o resultado por hash; aqui só se evita repetir na sessão.

const OCR_IMAGE_RE = /^data:image\/(?!svg)/i

// Sem engine (nenhum idioma de OCR instalado): não tenta de novo na sessão.
let ocrUnavailable = false
// Imagens que falharam (formato não suportado, erro do WinRT): idem.
const failedHashes = new Set<string>()
// O debounce e o job da fila podem pedir a mesma imagem ao mesmo tempo.
const inflight = new Map<string, Promise<string | null>>()

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function runOcr(hash: string, dataUrl: string): Promise<string | null> {
  let pending = inflight.get(hash)
  if (!pending) {
    pending = invoke<string | null>('ocr_image', { hash, dataUrl })
      .then((text) => {
        if (text === null) ocrUnavailable = true
        return text
      })
      .catch((err) => {
        failedHashes.add(hash)
        console.warn('[Monet OCR] image skipped', err)
        return null
      })
      .finally(() => inflight.delete(hash))
    inflight.set(hash, pending)
  }
  return pending
}

// Mapa dataUrl → texto reconhecido (só imagens com texto). As faltantes no
// cache passam pelo OCR em série. Erros deixam a imagem sem texto.
export async function ocrTextsForContent(content: string): Promise<Map<string, string>> {
  const texts = new Map<string, string>()
  const dataUrls = [...new Set(content.match(DATA_URL_RE) ?? [])].filter((u) => OCR_IMAGE_RE.test(u))
  if (dataUrls.length === 0) return texts
  try {
    const hashes = await Promise.all(dataUrls.map(sha256Hex))
    const cached = await invoke<Record<string, string>>('ocr_cached', { hashes })
    for (let i = 0; i < dataUrls.length; i++) {
      let text: string | null | undefined = cached[hashes[i]]
      if (text === undefined) {
        if (ocrUnavailable || failedHashes.has(hashes[i])) continue
        text = await runOcr(hashes[i], dataUrls[i])
      }
      if (text) texts.set(dataUrls[i], text)
    }
  } catch (err) {
    console.warn('[Monet OCR] failed', err)
  }
  return texts
}
