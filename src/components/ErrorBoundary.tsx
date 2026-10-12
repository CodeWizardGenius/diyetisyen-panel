import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Alt ağaçtaki render hatalarını yakalar ve beyaz ekran yerine nazik bir
 * hata ekranı gösterir. Sınıf bileşeni olmalı (hook karşılığı yok).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu."
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // Gerçek projede burada bir hata izleme servisine gönderilir.
    console.error("Uygulama hatası:", error, info);
  }

  private handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="error-boundary">
        <div className="card error-boundary-card">
          <span className="error-boundary-icon" aria-hidden="true">
            ⚠️
          </span>
          <h2>Bir şeyler ters gitti</h2>
          <p className="muted">
            Beklenmeyen bir hata oluştu. Verileriniz tarayıcıda güvende; sayfayı yenileyerek devam edebilirsiniz.
          </p>
          {this.state.message ? (
            <pre className="error-boundary-detail">{this.state.message}</pre>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            Sayfayı Yenile
          </button>
        </div>
      </div>
    );
  }
}
