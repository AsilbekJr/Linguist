import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Loader2, User, Mail, Lock, ArrowRight, Check } from 'lucide-react';
import { useRegisterMutation } from '../../features/api/apiSlice';
import { setCredentials } from '../../features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { AuthHeading, Field, FormAlert, PasswordField } from './Field';

const MIN_PASSWORD = 8;

const Register = ({ onSwitchToLogin, onUserExists, onAuthSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const dispatch = useDispatch();
  const [register, { isLoading }] = useRegisterMutation();
  const passwordOk = password.length >= MIN_PASSWORD;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!passwordOk) {
      setErrorMsg(`Parol kamida ${MIN_PASSWORD} ta belgidan iborat bo'lishi kerak.`);
      return;
    }
    try {
      const userData = await register({ name, email, password }).unwrap();
      if (!userData?.token) {
        setErrorMsg("Server javobida token yo'q. Qayta urinib ko'ring.");
        return;
      }
      dispatch(setCredentials({ user: userData, token: userData.token }));
      onAuthSuccess?.();
    } catch (err) {
      console.error('Register Failed:', err);
      const message = err?.data?.message;
      if (message === 'User already exists') {
        setErrorMsg("Bu email allaqachon ro'yxatdan o'tgan — kirish sahifasiga o'tkazdik.");
        onUserExists?.(email);
      } else if (err?.status === 400 && message === 'Validation failed') {
        setErrorMsg(`Ism, email yoki parol noto'g'ri (parol kamida ${MIN_PASSWORD} belgi).`);
      } else {
        setErrorMsg(getApiErrorMessage(err, "Ro'yxatdan o'tish amalga oshmadi."));
      }
    }
  };

  return (
    <FadeIn>
      <AuthHeading title="Hisob yarating" subtitle="Bepul. Darajangizni aniqlab, kursni sizga moslaymiz." />

      <div className="space-y-4">
        {errorMsg && <FormAlert>{errorMsg}</FormAlert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Ismingiz"
            icon={User}
            type="text"
            autoComplete="given-name"
            placeholder="Masalan: Aziz"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
          <div className="space-y-2">
            <PasswordField
              label="Parol"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
            <p
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                passwordOk ? 'text-success' : 'text-muted-foreground'
              )}
            >
              <Check className={cn('size-3.5 transition-opacity', passwordOk ? 'opacity-100' : 'opacity-40')} />
              Kamida {MIN_PASSWORD} ta belgi
            </p>
          </div>

          <Button type="submit" size="xl" variant="brand" disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="animate-spin" /> : <>Boshlash <ArrowRight /></>}
          </Button>
        </form>

        <p className="pt-2 text-center text-sm text-muted-foreground">
          Hisobingiz bormi?{' '}
          <button type="button" onClick={onSwitchToLogin} className="font-bold text-primary hover:underline">
            Kirish
          </button>
        </p>
      </div>
    </FadeIn>
  );
};

export default Register;
