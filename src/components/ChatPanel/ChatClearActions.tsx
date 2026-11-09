import { Broom } from '@phosphor-icons/react'
import type { MouseEvent } from 'react'
import { useConfirm } from '../../hooks/useConfirm'
import styles from './ChatClearActions.module.css'

// Clear e Clear all dos chats. Clear apaga as perguntas e respostas da
// conversa, que fica (id, título renomeado, pasta e agente). Clear all apaga
// as conversas da pasta, que fica vazia. Pedem confirmação: não há desfazer.

interface ClearChatButtonProps {
  // Conversa aberta sem mensagens (ou rascunho): nada a limpar.
  disabled: boolean
  conversationTitle: string
  messageCount: number
  // Resposta sendo gerada: o Clear a interrompe.
  streaming: boolean
  onClear: () => void
  // Classe do botão de texto do chat que o recebe (mesmo visual de "New chat").
  className?: string
}

export function ClearChatButton({
  disabled,
  conversationTitle,
  messageCount,
  streaming,
  onClear,
  className,
}: ClearChatButtonProps) {
  const { confirm, modal } = useConfirm()
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        title="Delete all questions and answers in this conversation"
        onClick={async () => {
          const ok = await confirm(
            `The ${messageCount} message${messageCount === 1 ? '' : 's'} of "${conversationTitle}" will be deleted, and its next question starts without them.${streaming ? ' The answer being generated will be stopped.' : ''} The conversation stays, and so do the folder memory, prompt and documents.`,
            { title: 'Clear conversation', confirmLabel: 'clear' }
          )
          if (ok) onClear()
        }}
      >
        Clear
      </button>
      {modal}
    </>
  )
}

// Texto da confirmação do Clear all (também usado pela linha da pasta na
// ChatSidebar, que confirma com o modal dela).
export function clearAllMessage(folderName: string, count: number): string {
  return `${count === 1 ? 'The chat' : `The ${count} chats`} in "${folderName || 'this folder'}" will be deleted, with their questions and answers. The folder stays, and so do its memory, prompt and documents.`
}

export const CLEAR_ALL_CONFIRM = { title: 'Clear all chats', confirmLabel: 'delete all' }

interface ClearAllChatsTriggerProps {
  folderName: string
  // Conversas da pasta; 0 desabilita o botão.
  count: number
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  // Classe dos botões de ícone da pasta no chat que o recebe.
  className?: string
  iconSize?: number
  // Rótulo "Clear all" ao lado do ícone. Desligado só onde não cabe (linha da
  // pasta na sidebar e barra de título do Assistant, de 480 px): lá fica o
  // ícone com tooltip, e a confirmação diz o que será apagado.
  showLabel?: boolean
}

// Botão sem confirmação própria: quem usa confirma.
export function ClearAllChatsTrigger({
  folderName,
  count,
  onClick,
  className,
  iconSize = 12,
  showLabel = true,
}: ClearAllChatsTriggerProps) {
  const name = folderName || 'this folder'
  return (
    <button
      type="button"
      className={`${className ?? ''} ${showLabel ? styles.clearAll : ''}`}
      disabled={count === 0}
      aria-label={`clear all chats in ${name}`}
      title={count === 0 ? `No chats in "${name}"` : `Delete all chats in "${name}"`}
      onClick={onClick}
    >
      <Broom size={iconSize} aria-hidden />
      {showLabel && <span className={styles.clearAllLabel}>Clear all</span>}
    </button>
  )
}

interface ClearAllChatsButtonProps {
  folderName: string
  count: number
  onClearAll: () => void
  className?: string
  iconSize?: number
  showLabel?: boolean
}

// Clear all com o modal de confirmação próprio. Não usar dentro de um
// elemento clicável/arrastável: os eventos do modal (portal) sobem pela
// árvore do React até ele (a linha da pasta usa o Trigger).
export function ClearAllChatsButton({ folderName, count, onClearAll, className, iconSize, showLabel }: ClearAllChatsButtonProps) {
  const { confirm, modal } = useConfirm()
  return (
    <>
      <ClearAllChatsTrigger
        folderName={folderName}
        count={count}
        className={className}
        iconSize={iconSize}
        showLabel={showLabel}
        onClick={async () => {
          if (await confirm(clearAllMessage(folderName, count), CLEAR_ALL_CONFIRM)) onClearAll()
        }}
      />
      {modal}
    </>
  )
}
