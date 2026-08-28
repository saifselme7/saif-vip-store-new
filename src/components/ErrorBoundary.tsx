import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional label used in the recovery UI, e.g. the page name. */
  label?: string
}

interface State {
  hasError: boolean
  message: string | null
}

/**
 * Route-level error boundary. Without it, any render error unmounts the
 * entire React root and the user is left with a black screen. This boundary
 * catches the crash, keeps the shell alive and offers a recovery path.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the real error for diagnostics — never swallow it silently.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ hasError: false, message: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-5 text-center" role="alert">
        <div className="w-16 h-16 rounded-full border border-saif-border flex items-center justify-center mb-6" aria-hidden="true">
          <AlertTriangle size={26} className="text-saif-accent" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-saif-text">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-saif-dim max-w-md leading-relaxed text-balance">
          {this.props.label ? `The ${this.props.label} hit an unexpected error.` : 'This page hit an unexpected error.'}{' '}
          Your bag and account are safe — nothing was lost.
        </p>
        {this.state.message && (
          <p className="mt-4 text-xs text-saif-faint font-mono max-w-md break-words" aria-label="Error details">
            {this.state.message}
          </p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button onClick={this.reset} className="btn btn-primary">
            <RotateCcw size={14} aria-hidden="true" /> Try Again
          </button>
          <a href="/" className="btn">
            <ArrowLeft size={14} aria-hidden="true" /> Back to Shop
          </a>
        </div>
      </div>
    )
  }
}
