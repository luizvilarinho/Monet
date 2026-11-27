import { describe, expect, it } from 'vitest'
import { planPrefetch, type SentenceStatus } from './listenQueue'

const idle = (n: number): SentenceStatus[] => Array.from({ length: n }, () => 'idle')

describe('planPrefetch', () => {
  it('asks for the current sentence first and two ahead, two at a time', () => {
    expect(planPrefetch(0, idle(10))).toEqual([0, 1])
  })

  it('asks for the third as soon as one of the two is ready', () => {
    expect(planPrefetch(0, ['ready', 'loading', 'idle', 'idle'])).toEqual([2])
  })

  it('does not go past current + ahead', () => {
    expect(planPrefetch(0, ['ready', 'ready', 'ready', 'idle', 'idle'])).toEqual([])
    expect(planPrefetch(2, ['ready', 'ready', 'ready', 'ready', 'idle', 'idle', 'idle'])).toEqual([4])
  })

  it('never asks for more than maxInFlight loading requests', () => {
    expect(planPrefetch(0, ['loading', 'loading', 'idle'])).toEqual([])
    expect(planPrefetch(0, ['loading', 'idle', 'idle'])).toEqual([1])
    expect(planPrefetch(0, idle(5), 2, 3)).toEqual([0, 1, 2])
  })

  it('does not repeat a sentence that is loading, ready or in error', () => {
    expect(planPrefetch(0, ['ready', 'loading', 'error'])).toEqual([])
    expect(planPrefetch(1, ['ready', 'ready', 'error', 'idle'])).toEqual([3])
  })

  it('asks for nothing while the current sentence is in error', () => {
    expect(planPrefetch(1, ['ready', 'error', 'idle', 'idle'])).toEqual([])
  })

  it('stops at the end of the list', () => {
    expect(planPrefetch(3, idle(4))).toEqual([3])
    expect(planPrefetch(2, ['ready', 'ready', 'idle', 'idle'])).toEqual([2, 3])
  })

  it('a current sentence out of range or an empty list asks for nothing', () => {
    expect(planPrefetch(0, [])).toEqual([])
    expect(planPrefetch(5, idle(3))).toEqual([])
    expect(planPrefetch(-1, idle(3))).toEqual([])
  })

  it('a custom window', () => {
    expect(planPrefetch(1, idle(8), 3, 4)).toEqual([1, 2, 3, 4])
  })
})
