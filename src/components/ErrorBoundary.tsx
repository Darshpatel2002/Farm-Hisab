import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '../lib/errors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches render-time crashes and shows a friendly recovery screen. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logError('render', error);
    console.error(info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-base text-slate-600">Please reload the app. Your saved data is safe.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-touch rounded-xl bg-brand-700 px-6 py-3 text-lg font-semibold text-white"
        >
          Reload app
        </button>
      </div>
    );
  }
}
