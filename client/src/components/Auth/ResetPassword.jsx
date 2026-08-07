import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useResetPasswordMutation } from '../../features/api/apiSlice';
import PasswordInput from './PasswordInput';

const MIN_LENGTH = 8;

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  if (!token) {
    return (
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-xl text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black mb-3">Havola to&apos;liq emas</h2>
        <p className="text-muted-foreground mb-8">
          Havolani pochtangizdan to&apos;liq nusxalab qo&apos;ying yoki yangisini so&apos;rang.
        </p>
        <Link to="/forgot-password" className="text-primary font-bold">
          Yangi havola so&apos;rash →
        </Link>
      </div>
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
      await resetPassword({ token, password }).unwrap();
      setDone(true);
      toast.success('Parol yangilandi');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(
        err?.data?.message ||
          "Havola yaroqsiz yoki muddati tugagan. Yangi havola so'rang."
      );
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-xl text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black mb-3">Parol yangilandi</h2>
        <p className="text-muted-foreground mb-8">
          Xavfsizlik uchun barcha qurilmalardagi sessiyalar yopildi.
          Endi yangi parol bilan kiring.
        </p>
        <Link to="/login" className="text-primary font-bold">
          Kirish →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-xl">
      <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
        Yangi parol
      </h2>
      <p className="text-muted-foreground text-sm mb-8">
        Kamida {MIN_LENGTH} ta belgidan iborat yangi parol o&apos;ylab toping.
      </p>

      {error && (
        <div className="bg-destructive/10 border border-destructive/40 text-destructive rounded-xl p-3 mb-5 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Yangi parol"
          autoComplete="new-password"
          required
        />
        <PasswordInput
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Parolni takrorlang"
          autoComplete="new-password"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Parolni saqlash'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
          Kirish sahifasiga qaytish
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
