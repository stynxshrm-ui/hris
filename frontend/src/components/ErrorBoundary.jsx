import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Something went wrong</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            This page ran into an unexpected error. Try refreshing or navigating away and back.
          </p>
        </div>
        <button
          onClick={this.reset}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={14} /> Try again
        </button>
        {import.meta.env.DEV && (
          <pre className="text-xs text-left text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 max-w-2xl w-full overflow-x-auto mt-2">
            {this.state.error.message}
          </pre>
        )}
      </div>
    )
  }
}
