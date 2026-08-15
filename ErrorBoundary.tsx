import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    console.error("[ErrorBoundary] React state caught error during render:", error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] ComponentDidCatch stack trace:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
          <div className="max-w-2xl w-full box-border bg-white border border-red-200 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <svg className="w-8 h-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h1 className="text-xl font-bold">Error de Ejecución Encontrado</h1>
            </div>
            
            <p className="text-sm text-slate-600">
              Se ha detectado una excepción durante la inicialización o renderizado del componente:
            </p>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 overflow-x-auto text-xs font-mono text-red-400">
              <p className="font-bold text-red-300 mb-2">{this.state.error && this.state.error.toString()}</p>
              {this.state.error && this.state.error.stack && (
                <pre className="whitespace-pre-wrap opacity-80">{this.state.error.stack}</pre>
              )}
              {this.state.errorInfo && (
                <pre className="whitespace-pre-wrap mt-4 text-slate-400 opacity-80">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Reorganizar y Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

