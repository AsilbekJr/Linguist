import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="app-backdrop flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <div className="surface w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <AlertTriangle className="size-8" />
          </div>
          <h1 className="text-2xl font-extrabold">Nimadir noto&apos;g&apos;ri ketdi</h1>
          <p className="mt-2 text-muted-foreground">
            Sahifani ko&apos;rsatishda xatolik yuz berdi. Progressingiz saqlanib qoldi.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button size="lg" onClick={this.handleReload}>Bosh sahifaga qaytish</Button>
            <Button size="lg" variant="ghost" onClick={() => window.location.reload()}>Sahifani yangilash</Button>
          </div>

          {import.meta.env.DEV && (
            <pre className="mt-6 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 text-left text-xs">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
