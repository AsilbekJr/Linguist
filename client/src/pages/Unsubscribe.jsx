import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { BellOff, Loader2, AlertTriangle } from 'lucide-react';
import { useUnsubscribeMutation } from '../features/api/apiSlice';
import { Button } from '@/components/ui/button';
import { IconTile } from '@/components/ui/primitives';
import { Logo } from '../components/brand/Logo';

/**
 * Obunani bekor qilish.
 *
 * ATAYLAB login talab qilmaydi. Xatdagi havolani bosgan odam parolini eslay
 * olmasa ham chiqib keta olishi kerak — aks holda u "spam" tugmasini bosadi
 * va bu butun domenning yetkazib berish obro'siga zarar qiladi.
 */
const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [unsubscribe] = useUnsubscribeMutation();
  const [state, setState] = useState('loading');
  const [email, setEmail] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    // StrictMode ikki marta ishga tushiradi — bir marta bajarilishini kafolatlaymiz
    if (ranRef.current) return;
    ranRef.current = true;

    unsubscribe(token)
      .unwrap()
      .then((res) => {
        setEmail(res?.email || '');
        setState('done');
      })
      .catch(() => setState('error'));
  }, [token, unsubscribe]);

  return (
    <div className="app-backdrop flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-foreground">
      <Logo className="mb-8" />
      <div className="surface w-full max-w-md p-8 text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-4 size-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Bajarilmoqda…</p>
          </>
        )}

        {state === 'done' && (
          <>
            <IconTile icon={BellOff} tone="muted" size="lg" className="mx-auto mb-5" />
            <h1 className="text-2xl font-extrabold">Eslatmalar o&apos;chirildi</h1>
            <p className="mt-2 text-muted-foreground">
              {email ? `${email} manziliga ` : ''}endi kunlik eslatma yubormaymiz.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fikringiz o&apos;zgarsa, ilovadagi &quot;Sozlamalar&quot; bo&apos;limidan qayta yoqishingiz mumkin.
            </p>
            <Button asChild size="lg" className="mt-8 w-full">
              <Link to="/">Ilovaga qaytish</Link>
            </Button>
          </>
        )}

        {(state === 'invalid' || state === 'error') && (
          <>
            <IconTile icon={AlertTriangle} tone="warning" size="lg" className="mx-auto mb-5" />
            <h1 className="text-2xl font-extrabold">Havola ishlamadi</h1>
            <p className="mt-2 text-muted-foreground">
              Havolani pochtangizdan to&apos;liq nusxalab ko&apos;ring yoki ilovadagi &quot;Sozlamalar&quot;
              bo&apos;limidan eslatmalarni o&apos;chiring.
            </p>
            <Button asChild size="lg" variant="outline" className="mt-8 w-full">
              <Link to="/">Ilovaga o&apos;tish</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
