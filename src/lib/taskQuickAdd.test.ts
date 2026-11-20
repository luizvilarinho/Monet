import { describe, expect, it } from 'vitest'
import type { Notebook } from '../types'
import { parseQuickAdd } from './taskQuickAdd'

// U9: abreviações que são palavras comuns ("ter", "sex", "dom") e frações
// ("1/3") só viram data no fim do texto, com ponto ou com `!`.

// Quinta-feira, 19/11/2026.
const TODAY = '2026-11-19'
const notebooks: Notebook[] = [{ id: 'nbw', name: 'Work', createdAt: 0, updatedAt: 0 }]

function parse(input: string) {
  return parseQuickAdd(input, { notebooks, todayKey: TODAY, ignored: new Set(), confirmed: new Set() })
}

describe('parseQuickAdd — palavras comuns e frações', () => {
  it('"ter" no início do título não é terça', () => {
    const r = parse('Ter acesso ao repositório')
    expect(r.scheduledDate).toBeNull()
    expect(r.title).toBe('Ter acesso ao repositório')
  })

  it('fração no meio do título não é data', () => {
    const r = parse('Revisar 1/3 do livro')
    expect(r.scheduledDate).toBeNull()
    expect(r.title).toBe('Revisar 1/3 do livro')
  })

  it('"sex" e "dom" soltos no meio do título ficam no título', () => {
    expect(parse('Reunião sex com o time').scheduledDate).toBeNull()
    expect(parse('Ler dom casmurro').scheduledDate).toBeNull()
  })

  it('abreviação no fim do texto vale', () => {
    const r = parse('Reunião sex')
    expect(r.scheduledDate).toBe('2026-11-20')
    expect(r.title).toBe('Reunião')
  })

  it('o fim do texto pode ter outros tokens depois da data', () => {
    const r = parse('Send report fri #Work')
    expect(r.scheduledDate).toBe('2026-11-20')
    expect(r.project).toEqual({ notebookId: 'nbw' })
    expect(r.title).toBe('Send report')
    expect(parse('Reunião sex #Work !!').scheduledDate).toBe('2026-11-20')
  })

  it('com ponto, a abreviação vale no meio do título', () => {
    const r = parse('Reunião ter. com o time')
    expect(r.scheduledDate).toBe('2026-11-24')
    expect(r.title).toBe('Reunião com o time')
  })

  it('com `!`, vale como deadline em qualquer posição', () => {
    const r = parse('Entregar !sex relatório')
    expect(r.dueDate).toBe('2026-11-20')
    expect(r.title).toBe('Entregar relatório')
    expect(parse('Revisar !1/12 capítulo').dueDate).toBe('2026-12-01')
  })

  it('nome completo do dia vale em qualquer posição', () => {
    const r = parse('Revisar terça o capítulo')
    expect(r.scheduledDate).toBe('2026-11-24')
    expect(r.title).toBe('Revisar o capítulo')
  })

  it('dd/mm no fim do texto vale', () => {
    const r = parse('Pagar conta 25/11')
    expect(r.scheduledDate).toBe('2026-11-25')
    expect(r.title).toBe('Pagar conta')
  })

  it('important sem glifo no rótulo', () => {
    const r = parse('Ligar !!')
    expect(r.important).toBe(true)
    expect(r.tokens.find((t) => t.kind === 'important')?.label).toBe('Important')
  })
})
