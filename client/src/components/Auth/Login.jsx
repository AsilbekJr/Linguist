import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { useLoginMutation } from '../../features/api/apiSlice';
import { setCredentials } from '../../features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/ui/primitives';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { AuthHeading, Field, FormAlert, PasswordField } from './Field';

/**
 * Sessiya uchinchi tomon cookie bloklangani uchun uzilgan bo'lsa, foydalanuvchi
 * "nega yana chiqib ketdim?" degan savol bilan qoladi. Sababni ko'rsatamiz.
 */
const readAuthHint = () => {
  try {
    const hint = sessionStorage.getItem('linguist_auth_hint');
    if (hint) sessionStorage.removeItem('linguist_auth_hint');
    return hint;
  } catch {
    return null;
  }
};

const Login = ({ onSwitchToRegister, initialEmail = '', onAuthSuccess }) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hint] = useState(readAuthHint);

  const dispatch = useDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const userData = await login({ email, password }).unwrap();
      if (!userData?.token) {
        setErrorMsg("Server javobida token yo'q. Qayta urinib ko'ring.");
        return;
      }
      dispatch(setCredentials({ user: userData, token: userData.token }));
      onAuthSuccess?.();
    } catch (err) {
      console.error('Login Failed:', err);
      if (err?.status === 401) {
        setErrorMsg("Email yoki parol noto'g'ri. Parolni unutgan bo'lsangiz, uni tiklashingiz mumkin.");
      } else {
        // Tarmoq, CORS va rate-limit holatlari bitta joyda tushuntiriladi
        setErrorMsg(getApiErrorMessage(err, "Server bilan bog'lanib bo'lmadi."));
      }
    }
  };

  return (
    <FadeIn>
      <AuthHeading title="Qaytganingizdan xursandmiz" subtitle="Hisobingizga kiring va o'qishni davom ettiring." />

      <div className="space-y-4">
        {hint === 'third_party_cookie' && !errorMsg && (
          <FormAlert tone="warning">
            Sessiya uzildi: brauzer sayt cookie&apos;sini bloklagan bo&apos;lishi mumkin. Qayta kiring —
            muammo takrorlansa, brauzer sozlamalarida shu sayt uchun cookie&apos;larga ruxsat bering.
          </FormAlert>
        )}
        {errorMsg && <FormAlert>{errorMsg}</FormAlert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Email"
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="siz@misol.uz"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="space-y-1.5">
            <PasswordField
              label="Parol"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                Parolni unutdingizmi?
              </Link>
            </div>
          </div>

          <Button type="submit" size="xl" variant="brand" disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="animate-spin" /> : <>Kirish <ArrowRight /></>}
          </Button>
        </form>

        <p className="pt-2 text-center text-sm text-muted-foreground">
          Hisobingiz yo&apos;qmi?{' '}
          <button type="button" onClick={onSwitchToRegister} className="font-bold text-primary hover:underline">
            Ro&apos;yxatdan o&apos;ting
          </button>
        </p>
      </div>
    </FadeIn>
  );
};

export default Login;
