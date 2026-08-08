import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useLoginMutation } from '../../features/api/apiSlice';
import { setCredentials } from '../../features/auth/authSlice';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import PasswordInput from './PasswordInput';
import { getApiErrorMessage } from '../../utils/apiErrors';

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
        setErrorMsg(
          "Email yoki parol noto'g'ri. Parolni unutgan bo'lsangiz, quyidagi havoladan tiklang."
        );
      } else {
        // Tarmoq, CORS va rate-limit holatlari bitta joyda tushuntiriladi
        setErrorMsg(getApiErrorMessage(err, "Server bilan bog'lanib bo'lmadi."));
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-card p-5 sm:p-8 rounded-2xl sm:rounded-3xl border shadow-xl relative overflow-hidden z-10 transition-all">
       <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">Xush kelibsiz</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Linguist AI hisobingizga kiring</p>
       </div>

       {hint === 'third_party_cookie' && !errorMsg && (
            <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-xl mb-6 border border-amber-500/20">
                Sessiya uzildi: brauzer sayt cookie&apos;sini bloklagan bo&apos;lishi mumkin.
                Qayta kiring — muammo takrorlansa, brauzer sozlamalarida shu sayt uchun
                cookie&apos;larga ruxsat bering.
            </div>
       )}

       {errorMsg && (
            <div className="bg-destructive/10 text-destructive text-sm font-bold p-3 rounded-xl text-center mb-6 border border-destructive/20 animate-in fade-in slide-in-from-top-2">
                {errorMsg}
            </div>
       )}

       <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
          <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input 
                type="email" 
                placeholder="Email manzilingiz" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-12 h-12 sm:h-14 rounded-2xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 text-base sm:text-lg transition-all"
              />
          </div>
          
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parol"
            autoComplete="current-password"
          />

          <Button 
            type="submit" 
            disabled={isLoading}
            className="h-12 sm:h-14 mt-2 sm:mt-4 rounded-2xl text-base sm:text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 transition-all group overflow-hidden relative"
          >
             {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" /> : 'Kirish'}
          </Button>
       </form>

       <div className="mt-5 text-center relative z-10">
           <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
               Parolni unutdingizmi?
           </Link>
       </div>

       <div className="mt-6 text-center text-muted-foreground relative z-10 text-sm">
           Hisobingiz yo&apos;qmi?{' '}
           <button
             type="button"
             onClick={onSwitchToRegister}
             className="text-primary font-bold hover:underline"
           >
               Ro&apos;yxatdan o&apos;ting
           </button>
       </div>
    </div>
  );
};

export default Login;
