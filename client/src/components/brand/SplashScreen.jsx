import React from 'react';
import { LogoMark } from './Logo';

/**
 * Ishga tushish ekrani. Motion ishlatilmaydi — bu komponent Redux/PersistGate
 * tayyor bo'lguncha ko'rsatiladi va iloji boricha yengil bo'lishi kerak.
 */
export const SplashScreen = ({ title, hint }) => (
  <div className="app-backdrop fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background px-6 text-center">
    <div className="relative">
      <div className="absolute inset-0 -z-10 animate-ping rounded-3xl bg-primary/20 [animation-duration:2s]" />
      <LogoMark className="size-16 animate-scale-in drop-shadow-xl" />
    </div>
    {title && <h2 className="mt-8 text-xl font-extrabold">{title}</h2>}
    {hint && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{hint}</p>}
    <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="h-full w-1/3 animate-[shimmer-bar_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
    <span className="sr-only">Yuklanmoqda</span>
    <style>{`@keyframes shimmer-bar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
  </div>
);

export default SplashScreen;
