import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { BellOff, Loader2, AlertTriangle } from 'lucide-react';
import { useUnsubscribeMutation } from '../features/api/apiSlice';

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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center shadow-xl">
        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Bajarilmoqda...</p>
          </>
        )}

        {state === 'done' && (
          <>
            <BellOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-black mb-3">Eslatmalar o&apos;chirildi</h1>
            <p className="text-muted-foreground mb-2">
              {email ? `${email} manziliga ` : ''}Endi kunlik eslatma yubormaymiz.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Fikringiz o&apos;zgarsa, ilova sozlamalaridan qayta yoqishingiz mumkin.
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full"
            >
              Ilovaga qaytish
            </Link>
          </>
        )}

        {(state === 'invalid' || state === 'error') && (
          <>
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black mb-3">Havola ishlamadi</h1>
            <p className="text-muted-foreground mb-8">
              Havolani pochtangizdan to&apos;liq nusxalab ko&apos;ring yoki ilova
              sozlamalaridan eslatmalarni o&apos;chiring.
            </p>
            <Link to="/" className="text-primary font-bold">
              Ilovaga o&apos;tish →
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
