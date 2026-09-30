import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useResetPasswordMutation } from '../../features/api/apiSlice';
import { clearLocalSession } from '../../utils/authHelpers';
import { Button } from '@/components/ui/button';
import { FadeIn, IconTile } from '@/components/ui/primitives';
import { AuthHeading, FormAlert, PasswordField } from './Field';

const MIN_LENGTH = 8;

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // Qaysi hisob tiklangani: Gmail nuqta va `+teg`ni e'tiborsiz qoldiradi,
  // shuning uchun bir qutiga bir nechta hisobning xati kelishi mumkin
  const [account, setAccount] = useState('');
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  if (!token) {
    return (
      <FadeIn className="text-center">
        <IconTile icon={AlertTriangle} tone="warning" size="lg" className="mx-auto mb-5" />
        <AuthHeading
          title="Havola to'liq emas"
          subtitle="Havolani pochtangizdan to'liq nusxalab qo'ying yoki yangisini so'rang."
        />
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">Yangi havola so&apos;rash</Link>
        </Button>
      </FadeIn>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Parol kamida ${MIN_LENGTH} ta belgidan iborat bo'lishi kerak.`);
      return;
    }
    if (password !== confirm) {
      setError('Parollar mos kelmadi.');
      return;
    }

    try {
      const res = await resetPassword({ token, password }).unwrap();
      const resetEmail = res?.account || '';
      // Login'da aynan shu email oldindan yoziladi
      const toLogin = () => navigate('/login', { replace: true, state: { email: resetEmail } });
      if (isAuthenticated) {
        // Server barcha sessiyalarni yopdi — shu qurilmada ham chiqamiz.
        // Chiqqach ilova boshqa route daraxtiga o'tadi va bu komponent qayta
        // yaratiladi, shuning uchun "tayyor" ekrani o'rniga darhol login'ga.
        toast.success(resetEmail ? `${resetEmail} paroli yangilandi` : 'Parol yangilandi');
        await clearLocalSession(dispatch);
        toLogin();
        return;
      }
      setAccount(resetEmail);
      setDone(true);
      toast.success('Parol yangilandi');
      setTimeout(toLogin, 4000);
    } catch (err) {
      setError(err?.data?.message || "Havola yaroqsiz yoki muddati tugagan. Yangi havola so'rang.");
    }
  };

  if (done) {
    return (
      <FadeIn className="text-center">
        <IconTile icon={CheckCircle2} tone="success" size="lg" className="mx-auto mb-5 animate-pop" />
        <AuthHeading
          title="Parol yangilandi"
          subtitle="Xavfsizlik uchun barcha qurilmalardagi sessiyalar yopildi. Endi yangi parol bilan kiring."
        />
        {account && (
          <p className="mb-5 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm">
            Hisob: <strong className="break-all">{account}</strong>
          </p>
        )}
        <Button asChild size="lg" className="w-full">
          <Link to="/login" replace state={{ email: account }}>
            Kirish
          </Link>
        </Button>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <AuthHeading title="Yangi parol" subtitle={`Kamida ${MIN_LENGTH} ta belgidan iborat yangi parol o'ylab toping.`} />
      <div className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Yangi parol"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <PasswordField
            label="Parolni takrorlang"
            icon={Lock}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Button type="submit" size="xl" variant="brand" disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="animate-spin" /> : 'Parolni saqlash'}
          </Button>
        </form>
        <div className="pt-2 text-center">
          <Link to="/login" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Kirish sahifasiga qaytish
          </Link>
        </div>
      </div>
    </FadeIn>
  );
};

export default ResetPassword;
