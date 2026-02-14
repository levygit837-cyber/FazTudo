import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Error boundary for catching errors in production
const ErrorFallback = ({ error }: { error: Error }) => (
  <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
    <h1>Algo deu errado</h1>
    <p>Desculpe, ocorreu um erro inesperado.</p>
    <details style={{ marginTop: '1rem', color: '#666' }}>
      <summary>Detalhes do erro</summary>
      <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
        {error.message}
      </pre>
    </details>
  </div>
);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Erro capturado no ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento root não encontrado');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Service worker registration (optional)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.error('Falha ao registrar service worker:', error);
    });
  });
}
