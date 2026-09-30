import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useVerifyEmailMutation } from '../../features/api/apiSlice';
import { Button } from '@/components/ui/button';
import { FadeIn, IconTile } from '@/components/ui/primitives';
import { AuthHeading } from './Field';

/**
 * Xatdagi tasdiqlash havolasi.
 *
 * Tizimga kirgan yoki kirmagan brauzerda ham ishlaydi — xat ko'pincha
 * telefonda ochiladi, ilova esa kompyuterda. Token sahifa ochilishi bilan
 * yuboriladi: tugma bosishni kutish ortiqcha qadam bo'lardi.
 */
const VerifyEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [verifyEmail] = useVerifyEmailMutation();
  const [state, setState] = useState(token ? 'loading' : 'error');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // StrictMode'da effekt ikki marta ishlaydi — so'rov bir marta ketsin
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    verifyEmail(token)
      .unwrap()
      .then((res) => {
        setResult(res);
        setState('done');
      })
      .catch((err) => {
        setError(err?.data?.message || "Havola yaroqsiz yoki muddati tugagan.");
        setState('error');
      });
  }, [token, verifyEmail]);

  if (state === 'loading') {
    return (
      <FadeIn className="py-10 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Tasdiqlanmoqda…</p>
      </FadeIn>
    );
  }

  if (state === 'error') {
    return (
      <FadeIn className="text-center">
        <IconTile icon={AlertTriangle} tone="warning" size="lg" className="mx-auto mb-5" />
        <AuthHeading
          title="Havola ishlamadi"
          subtitle={
            token
              ? `${error} Ilovaga kiring va bannerdagi "Qayta yuborish" tugmasini bosing.`
              : "Havola to'liq emas. Uni pochtangizdan to'liq nusxalab qo'ying."
          }
        />
        <Button asChild size="lg" className="w-full">
          <Link to={isAuthenticated ? '/' : '/login'}>{isAuthenticated ? 'Ilovaga qaytish' : 'Kirish'}</Link>
        </Button>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="text-center">
      <IconTile icon={CheckCircle2} tone="success" size="lg" className="mx-auto mb-5 animate-pop" />
      <AuthHeading
        title={result?.alreadyVerified ? 'Email allaqachon tasdiqlangan' : 'Email tasdiqlandi'}
        subtitle="Endi parolni unutsangiz ham hisobingizni pochta orqali tiklay olasiz."
      />
      {result?.account && (
        <p className="mb-5 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm">
          Hisob: <strong className="break-all">{result.account}</strong>
        </p>
      )}
      <Button asChild size="lg" className="w-full">
        {isAuthenticated ? (
          <Link to="/" replace>
            Ilovaga qaytish
          </Link>
        ) : (
          <Link to="/login" replace state={{ email: result?.account }}>
            Kirish
          </Link>
        )}
      </Button>
    </FadeIn>
  );
};

export default VerifyEmail;
