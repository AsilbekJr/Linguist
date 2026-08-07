import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
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

  if (!available && !showIosHint) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-6 md:max-w-sm">
      <div className="bg-card border border-primary/30 rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm">Ilovani telefoningizga qo&apos;shing</p>

          {showIosHint ? (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Safari pastidagi <Share className="w-3 h-3 inline align-text-bottom" /> tugmasini
              bosing → <span className="font-bold">&quot;Bosh ekranga qo&apos;shish&quot;</span>.
              Shunda har safar brauzerdan qidirmaysiz.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-1">
                Bir bosishda ochiladi, oflaynda ham ishlaydi.
              </p>
              <button
                type="button"
                onClick={handleInstall}
                className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-full hover:opacity-90 transition-opacity"
              >
                Qo&apos;shish
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Yopish"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
