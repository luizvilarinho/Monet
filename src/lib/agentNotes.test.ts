import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../hooks/useChat'
import type { AgentItemsPayload, AgentSearchInfo } from './agentItems'

// O storage e o índice de documentos são do app (Tauri): nenhum teste os toca.
vi.mock('../storage', () => ({ storage: {} }))
vi.mock('./documents', () => ({ notesIndexGetDisabledNotebooks: async () => [] }))

import { agentNoteDraft } from './agentNotes'

// O rascunho "Save radar profile": o botão dos dois balões (Chat e Anotações) vem de
// `agentNoteDraft`. Com uma nota de perfil conhecida pelo app na consulta, a proposta do
// modelo não vira botão; o Papers nunca o tem.

const PROPOSAL = ['Nothing new since 13/11/2026.', '', '**Radar profile**', 'Follow: rust, tokio', 'Sources: any', 'Ignore: nothing yet'].join('\n')

const search: AgentSearchInfo = {
  scopeKey: 'notebook:nb1',
  scopeLabel: 'notebook "ML"',
  since: '2026-11-13',
  windowNote: 'last check: 13/11/2026',
  queries: ['rust'],
  profile: false,
}

function message(patch: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', role: 'assistant', content: PROPOSAL, timestamp: '2026-11-20T10:00:00Z', agentId: 'radar', ...patch }
}

function withSearch(patch: Partial<AgentSearchInfo>): AgentItemsPayload {
  return { items: [], max: 8, scopeNotebookId: null, search: { ...search, ...patch } }
}

describe('agentNoteDraft: "Save radar profile"', () => {
  it('sem nota de perfil na consulta, a proposta do Radar vira o botão', () => {
    const draft = agentNoteDraft(message({ agentItems: withSearch({ hasProfileNote: false }) }), '2026-11-21')
    expect(draft).toMatchObject({ kind: 'radarProfile', messageId: 'm1' })
    expect(draft?.kind === 'radarProfile' && draft.profile.body).toBe('Follow: rust, tokio\nSources: any\nIgnore: nothing yet')
  })

  it('com nota de perfil na consulta, a proposta não vira botão (haja ou não linha do perfil no mapa de foco)', () => {
    expect(agentNoteDraft(message({ agentItems: withSearch({ hasProfileNote: true, profile: false }) }), '2026-11-21')).toBeNull()
    expect(agentNoteDraft(message({ agentItems: withSearch({ hasProfileNote: true, profile: true }) }), '2026-11-21')).toBeNull()
  })

  it('mensagem gravada antes do campo, ou sem payload (seguimento): o botão fica como antes', () => {
    expect(agentNoteDraft(message({ agentItems: withSearch({}) }), '2026-11-21')).toMatchObject({ kind: 'radarProfile' })
    expect(agentNoteDraft(message(), '2026-11-21')).toMatchObject({ kind: 'radarProfile' })
  })

  it('a trava vale só para o perfil do Radar: sem proposta no texto não há botão, com ou sem nota', () => {
    expect(agentNoteDraft(message({ content: 'Nothing new since 13/11/2026.' }), '2026-11-21')).toBeNull()
    expect(agentNoteDraft(message({ content: 'Nothing new.', agentItems: withSearch({ hasProfileNote: false }) }), '2026-11-21')).toBeNull()
  })

  it('o Papers nunca oferece o perfil do Radar, mesmo que a resposta traga o bloco', () => {
    expect(agentNoteDraft(message({ agentId: 'papers' }), '2026-11-21')).toBeNull()
    expect(agentNoteDraft(message({ agentId: 'papers', agentItems: withSearch({ hasProfileNote: false }) }), '2026-11-21')).toBeNull()
  })
})
