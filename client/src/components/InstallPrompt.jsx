import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from './brand/Logo';
import { onInstallAvailable, promptInstall, isStandalone } from '../lib/pwa';
import { track } from '../lib/analytics';

const DISMISSED_KEY = 'linguist_install_dismissed_until';
const SNOOZE_DAYS = 14;

const isSnoozed = () => {
  try {
    const until = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    return Date.now() < until;
  } catch {
    return false;
  }
};

const snooze = () => {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
  } catch {
    // shaxsiy rejim — muhim emas
  }
};

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/**
 * "Bosh ekranga qo'shish" taklifi.
 *
 * Nega muhim: eslatma xat yuboradi, odam bosadi, lekin telefonda ilova
 * ekranida yo'q — har safar brauzerdan qidirish kerak. O'rnatilgan ilova
 * qaytish to'sig'ini sezilarli kamaytiradi.
 *
 * iOS Safari `beforeinstallprompt` ni qo'llab-quvvatlamaydi, shuning uchun
 * u yerda qo'lda ko'rsatma beriladi.
 */
const InstallPrompt = () => {
  const [available, setAvailable] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || isSnoozed()) return undefined;

    // iOS'da taklif hodisasi yo'q — o'zimiz ko'rsatamiz
    if (isIos()) {
      setShowIosHint(true);
      return undefined;
    }

    return onInstallAvailable(setAvailable);
  }, []);

  const dismiss = () => {
    snooze();
    setAvailable(false);
    setShowIosHint(false);
    track('pwa_install_dismissed');
  };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome !== 'accepted') snooze();
    setAvailable(false);
  };

  return (
    <AnimatePresence>
      {(available || showIosHint) && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 1.2 }}
          // Telefonda pastki tab-bar ustida turadi
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] z-40 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[22rem]"
          role="dialog"
          aria-label="Ilovani o'rnatish"
        >
          <div className="glass flex items-start gap-3 rounded-2xl border border-border p-4 shadow-2xl">
            <LogoMark className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Ilovani telefoningizga qo&apos;shing</p>
              {showIosHint ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Safari pastidagi <Share className="inline size-3 align-text-bottom" /> tugmasini bosing →{' '}
                  <span className="font-bold text-foreground">&quot;Bosh ekranga qo&apos;shish&quot;</span>.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">Bir bosishda ochiladi, oflaynda ham ishlaydi.</p>
                  <Button size="sm" className="mt-3" onClick={handleInstall}>
                    <Download /> O&apos;rnatish
                  </Button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Yopish"
              className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
