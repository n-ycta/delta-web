import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode; fallback: (e: Error, reset: () => void) => ReactNode; resetKey?: unknown }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey?: unknown }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(e: Error) { console.error('[widget crashed]', e); }
  render() { return this.state.error ? this.props.fallback(this.state.error, () => this.setState({ error: null })) : this.props.children; }
}
