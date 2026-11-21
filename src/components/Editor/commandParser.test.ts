import { describe, expect, it } from 'vitest'
import { getToggleTitle, responseCommandText } from './commandParser'

describe('responseCommandText', () => {
  it('o comando e a query, sem espaços nas pontas; sem query, só o comando', () => {
    expect(responseCommandText({ command: '/define', query: '  RAG ' })).toBe('/define RAG')
    expect(responseCommandText({ command: '/critique', query: '' })).toBe('/critique')
  })

  it('/since com instrução: a linha da nota é a instrução que o usuário escreveu', () => {
    expect(responseCommandText({ command: '/since', query: '01/03/2026' })).toBe('/since 01/03/2026')
  })

  it('/since sem instrução: a query do título (data e origem) não entra, e a linha segue "/since"', () => {
    expect(responseCommandText({ command: '/since', query: '01/03/2026 (note created)' })).toBe('/since')
    expect(responseCommandText({ command: '/since', query: '15/09/2026 (last /since)' })).toBe('/since')
  })

  it('só o /since: a mesma forma em outro comando continua sendo a query dele', () => {
    expect(responseCommandText({ command: '/define', query: '01/03/2026 (note created)' })).toBe(
      '/define 01/03/2026 (note created)'
    )
  })
})

describe('título do bloco /since', () => {
  it('mostra a data de corte e a origem', () => {
    expect(getToggleTitle('/since', '01/03/2026 (note created)')).toBe('Since · 01/03/2026 (note created)')
    expect(getToggleTitle('/since', '')).toBe('Since')
  })
})
