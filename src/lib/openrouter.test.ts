import { describe, expect, it } from 'vitest'
import { readableChatError } from './openrouter'

describe('readableChatError', () => {
  it('mapeia os status HTTP que o Rust devolve em HTTP_ERROR', () => {
    expect(readableChatError('HTTP_ERROR', 'OpenRouter responded 401 Unauthorized')).toEqual({
      message: 'OpenRouter rejected your API key. Check it in Settings.',
      settings: true,
    })
    expect(readableChatError('HTTP_ERROR', 'OpenRouter responded 402 Payment Required')).toEqual({
      message: 'Your OpenRouter credits are out. Add credits, then try again.',
      settings: true,
    })
    expect(readableChatError('HTTP_ERROR', 'OpenRouter responded 429 Too Many Requests').message).toBe(
      'Too many requests to OpenRouter. Wait a moment, then try again.'
    )
    for (const s of ['500 Internal Server Error', '502 Bad Gateway', '503 Service Unavailable']) {
      const r = readableChatError('HTTP_ERROR', `OpenRouter responded ${s}`)
      expect(r.message).toBe('OpenRouter is having trouble right now. Try again in a few minutes.')
      expect(r.settings).toBe(false)
    }
  })

  it('outro status 4xx mostra o status sem inventar causa', () => {
    expect(readableChatError('HTTP_ERROR', 'OpenRouter responded 400 Bad Request').message).toBe(
      'OpenRouter returned an error (400 Bad Request).'
    )
  })

  it('aceita o código como mensagem quando o invoke rejeita só com a string', () => {
    expect(readableChatError(undefined, 'OPENROUTER_KEY_MISSING')).toEqual({
      message: 'Add your OpenRouter key in Settings to chat with the AI.',
      settings: true,
    })
    expect(readableChatError(undefined, 'INVALID_MODEL').message).toContain('Choose another model')
  })

  it('status sem código (erro de invoke com texto) também é mapeado', () => {
    expect(readableChatError(undefined, 'OpenRouter responded 402 Payment Required').settings).toBe(true)
    expect(readableChatError(undefined, 'request failed with status 429').message).toBe(
      'Too many requests to OpenRouter. Wait a moment, then try again.'
    )
    expect(readableChatError(undefined, 'HTTP 503 from upstream').message).toBe(
      'OpenRouter is having trouble right now. Try again in a few minutes.'
    )
  })

  it('número solto na mensagem não vira status HTTP', () => {
    expect(readableChatError(undefined, 'The prompt is over the max 500 tokens').message).toBe(
      'The prompt is over the max 500 tokens'
    )
  })

  it('erros de conexão e de stream ganham texto legível', () => {
    expect(readableChatError('NETWORK_ERROR', 'Could not connect to OpenRouter: dns error').message).toBe(
      'Could not reach OpenRouter. Check your connection and try again.'
    )
    expect(readableChatError('STREAM_TIMEOUT', 'Timeout waiting for response').message).toBe(
      'The model stopped responding. Try again.'
    )
    expect(readableChatError('STREAM_ERROR', 'Connection interrupted').message).toBe(
      'The connection to OpenRouter was interrupted. Try again.'
    )
  })

  it('erro do provedor e códigos desconhecidos mantêm a mensagem original', () => {
    expect(readableChatError('OPENROUTER_ERROR', 'Provider returned error')).toEqual({
      message: 'Provider returned error',
      settings: false,
    })
    expect(readableChatError('TOOL_CALL_INCOMPLETE', 'The response was cut off while calling a tool. Try again.').message).toBe(
      'The response was cut off while calling a tool. Try again.'
    )
    expect(readableChatError(undefined, '').message).toBe('Something went wrong. Try again.')
  })
})
