import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

// Erro de render em qualquer janela (main, keep ou assistant): mostra a tela de
// erro com Reload no lugar da janela em branco.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className={styles.screen} role="alert">
        <WarningCircle size={32} className={styles.icon} aria-hidden />
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>{error.message}</p>
        <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
          <ArrowClockwise size={14} aria-hidden />
          Reload
        </button>
      </div>
    )
  }
}
