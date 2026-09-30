import React, { useState } from 'react';
import { MailCheck, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useResendVerificationMutation } from '../features/api/apiSlice';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'linguist_verify_banner_dismissed';

const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Email tasdiqlanmaganini eslatuvchi banner.
 *
 * Bloklamaydi: ilovadan to'liq foydalanish mumkin. Yopilsa faqat shu
 * sessiya davomida ko'rinmaydi — keyingi ochilishda yana eslatadi,
 * aks holda odam uni bir marta yopib, parolni tiklay olmay qolardi.
 */
const EmailVerifyBanner = ({ user }) => {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [resend, { isLoading }] = useResendVerificationMutation();

  // `undefined` — eski keshdagi profil, serverdan hali javob yo'q
  if (!user || user.emailVerified !== false || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // shaxsiy rejim — muhim emas
    }
  };

  const handleResend = async () => {
    try {
      const res = await resend().unwrap();
      toast.success(res.message || 'Xat yuborildi');
    } catch (err) {
      toast.error(err?.data?.message || "Xatni yuborib bo'lmadi. Keyinroq urinib ko'ring.");
    }
  };

  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-3 rounded-2xl border border-warning/35 bg-warning/10 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 text-sm">
          <strong>Emailingizni tasdiqlang.</strong> Havola{' '}
          <span className="break-all font-semibold">{user.email}</span> manziliga yuborilgan. Tasdiqlansa, parolni
          unutganda hisobni tiklay olasiz. Xat "Spam" papkasiga ham tushishi mumkin.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
        <Button size="sm" variant="outline" onClick={handleResend} disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin" /> : 'Qayta yuborish'}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Bannerni yopish"
        >
          <X className="size-[18px]" />
        </button>
      </div>
    </div>
  );
};

export default EmailVerifyBanner;
