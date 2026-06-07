import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  widgetId: string
  children: ReactNode
}

interface State {
  error: Error | null
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem', color: 'var(--color-error, red)', fontSize: '0.75rem' }}>
          <strong>{this.props.widgetId}</strong> failed to load
          <br />
          <code style={{ opacity: 0.7 }}>{this.state.error.message}</code>
        </div>
      )
    }
    return this.props.children
  }
}
