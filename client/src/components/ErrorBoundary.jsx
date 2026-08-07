import React from 'react';
import { trackError } from '../lib/analytics';

/**
 * Render xatolarini ushlaydi.
 *
 * Ilgari bu yo'q edi: bitta komponentdagi xato butun ilovani oq ekranga
 * aylantirardi va foydalanuvchi nima bo'lganini ham, nima qilishni ham
 * bilmasdi — faqat sahifani yopardi. Xato hech qayerga yozilmasdi ham.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render xatosi:', error, info);
    trackError(error, { componentStack: String(info?.componentStack || '').slice(0, 800) });
  }

  handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center shadow-xl">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-2xl font-black mb-3">Nimadir noto&apos;g&apos;ri ketdi</h1>
          <p className="text-muted-foreground mb-2">
            Sahifani ko&apos;rsatishda xatolik yuz berdi. Progressingiz saqlanib qoldi.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Bosh sahifaga qaytib qayta urinib ko&apos;ring.
          </p>

          <button
            type="button"
            onClick={this.handleReload}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Bosh sahifaga qaytish
          </button>

          {import.meta.env.DEV && (
            <pre className="mt-6 text-left text-xs bg-secondary/60 p-4 rounded-xl overflow-auto max-h-48 whitespace-pre-wrap">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
