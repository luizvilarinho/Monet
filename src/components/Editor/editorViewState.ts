// Cursor e rolagem do editor por nota, para voltar a ela onde parou (aba Open,
// Alt+←, troca de nota pela lista). Só na memória: some ao fechar o app.
export interface EditorViewState {
  pos: number
  scrollTop: number
}

const states = new Map<string, EditorViewState>()

export function getEditorViewState(key: string): EditorViewState | undefined {
  return states.get(key)
}

export function setEditorViewState(key: string, state: EditorViewState): void {
  states.set(key, state)
}
