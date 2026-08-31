import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'var(--color-bg)'
        }}>
          <div className="neu-raised" style={{ padding: '40px', maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--color-danger)' }}>Terjadi Kesalahan</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Maaf, terjadi kesalahan pada sistem. Silakan muat ulang halaman.
            </p>
            <button 
              className="neu-raised" 
              style={{ 
                padding: '12px 24px', 
                border: 'none', 
                color: 'var(--color-primary)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onClick={() => window.location.reload()}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
