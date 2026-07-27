import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Error capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-lg w-full text-center">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Error en la página</h3>
            <p className="text-sm text-slate-500 mb-4 font-medium">
              Ocurrió un error inesperado al cargar esta sección.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            {this.props.showDetails && this.state.errorInfo && (
              <details className="text-left mb-4">
                <summary className="text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-600">
                  Detalles técnicos
                </summary>
                <pre className="mt-2 text-[10px] text-slate-400 bg-slate-50 rounded-xl p-3 overflow-auto max-h-[200px] font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw size={16} />
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
