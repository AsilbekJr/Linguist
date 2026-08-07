import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react';
import { useForgotPasswordMutation } from '../../features/api/apiSlice';

/**
 * Parolni tiklash so'rovi.
 *
 * Diqqat: muvaffaqiyat ekrani email topilgan-topilmaganidan qat'i nazar
 * ko'rsatiladi. Server ham ataylab bir xil javob qaytaradi — aks holda bu
 * sahifa "bu email ro'yxatdan o'tganmi?" degan savolga javob beradigan
 * vositaga aylanadi.
 */
const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await forgotPassword(email.trim()).unwrap();
    } catch {
      // Xatoni ham ko'rsatmaymiz — natija bir xil bo'lishi kerak
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-xl text-center">
        <MailCheck className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black mb-3">Havola yuborildi</h2>
        <p className="text-muted-foreground mb-2">
          Agar <span className="font-bold text-foreground">{email}</span> ro&apos;yxatdan
          o&apos;tgan bo&apos;lsa, parolni tiklash havolasi yuborildi.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Havola 1 soat davomida amal qiladi. Spam papkasini ham tekshiring.
        </p>
        <Link to="/login" className="text-primary font-bold inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Kirish sahifasiga
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-xl">
      <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
        Parolni unutdingizmi?
      </h2>
      <p className="text-muted-foreground text-sm mb-8">
        Email manzilingizni kiriting — tiklash havolasini yuboramiz.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email manzilingiz"
          className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !email.trim()}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Havola yuborish'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Kirishga qaytish
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
