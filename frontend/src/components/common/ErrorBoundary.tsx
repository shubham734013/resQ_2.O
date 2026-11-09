import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, Home, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled React Error Caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle ?? 'An unexpected error occurred';
      const description =
        this.props.fallbackDescription ??
        'A rendering error prevented this page from displaying properly. You can try recovering or return to the main dashboard.';

      return (
        <div
          role="alert"
          className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div className="w-full max-w-md bg-white border border-rose-200/90 rounded-2xl p-6 sm:p-8 shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px] font-mono text-slate-700 overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={this.handleReset}
                className="w-full sm:w-auto"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={this.handleReload}
                className="w-full sm:w-auto"
              >
                Reload
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Home className="w-3.5 h-3.5" />}
                onClick={this.handleGoHome}
                className="w-full sm:w-auto"
              >
                Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
