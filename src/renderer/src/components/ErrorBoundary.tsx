import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Transparent variant for the player overlay window. */
  overlay?: boolean
}
interface State {
  error: Error | null
}

/**
 * Catches render-time crashes so a thrown component shows a recoverable message
 * instead of a blank window (especially important for the transparent overlay).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[renderer] uncaught error:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center text-ink ${
          this.props.overlay ? 'bg-black/90' : 'bg-surface'
        }`}
      >
        <p className="text-lg font-semibold">Something went wrong</p>
        <p className="max-w-md text-sm text-ink-muted">{error.message || 'Unexpected error.'}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white transition hover:brightness-110"
        >
          Reload view
        </button>
      </div>
    )
  }
}
