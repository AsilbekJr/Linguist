import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck, ArrowLeft, Mail } from 'lucide-react';
import { useForgotPasswordMutation } from '../../features/api/apiSlice';
import { Button } from '@/components/ui/button';
import { FadeIn, IconTile } from '@/components/ui/primitives';
import { AuthHeading, Field } from './Field';

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

  const backLink = (
    <Link
      to="/login"
      className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Kirish sahifasiga
    </Link>
  );

  if (sent) {
    return (
      <FadeIn key="sent" className="text-center">
        <IconTile icon={MailCheck} tone="success" size="lg" className="mx-auto mb-5 animate-pop" />
        <AuthHeading
          title="Pochtangizni tekshiring"
          subtitle={`Agar ${email} ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi.`}
        />
        <p className="-mt-3 mb-8 text-sm text-muted-foreground">
          Havola 1 soat amal qiladi. Xat kelmasa, &quot;Spam&quot; papkasini ham ko&apos;ring.
        </p>
        {backLink}
      </FadeIn>
    );
  }

  return (
    <FadeIn key="form">
      <AuthHeading title="Parolni tiklash" subtitle="Email manzilingizni kiriting — tiklash havolasini yuboramiz." />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="siz@misol.uz"
        />
        <Button type="submit" size="xl" variant="brand" disabled={isLoading || !email.trim()} className="w-full">
          {isLoading ? <Loader2 className="animate-spin" /> : 'Havola yuborish'}
        </Button>
      </form>
      <div className="mt-8 text-center">{backLink}</div>
    </FadeIn>
  );
};

export default ForgotPassword;
