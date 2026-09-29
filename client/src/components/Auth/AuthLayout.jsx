import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Repeat2, Mic, Headphones, CheckCircle2, Volume2 } from 'lucide-react';
import { Logo, LogoMark } from '../brand/Logo';
import { ThemeToggle } from '../ThemeToggle';

const FEATURES = [
  { icon: Repeat2, title: 'Oraliqli takrorlash', text: "So'z unutilay deganda qaytadi — 7 bosqichda yodlanadi" },
  { icon: Mic, title: "Gap tuzib o'rganish", text: "Yodlaganingizni tekshiradi: so'z bilan o'z gapingizni tuzasiz" },
  { icon: Headphones, title: 'Tinglab yozish', text: 'Kundalik dialoglarni eshitib, quloqni moslashtirasiz' },
];

/** Chap paneldagi "jonli" namuna — ilova nima qilishini so'zsiz ko'rsatadi */
const DEMO = [
  { word: 'journey', ipa: '/ˈdʒɜː.ni/', uz: 'sayohat', sentence: 'Our journey to Samarkand was amazing.' },
  { word: 'improve', ipa: '/ɪmˈpruːv/', uz: 'yaxshilamoq', sentence: 'I want to improve my English every day.' },
  { word: 'confident', ipa: '/ˈkɒn.fɪ.dənt/', uz: 'ishonchli', sentence: 'She feels confident at interviews now.' },
];

const DemoCard = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % DEMO.length), 3800);
    return () => clearInterval(t);
  }, []);
  const d = DEMO[i];

  return (
    <div className="relative h-[228px] w-full max-w-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={d.word}
          initial={{ opacity: 0, y: 24, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -1.5 }}
          exit={{ opacity: 0, y: -24, rotate: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 top-0 rounded-3xl border border-white/20 bg-white/12 p-5 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-extrabold tracking-tight">{d.word}</p>
              <p className="mt-1 font-ipa text-sm text-white/70">{d.ipa}</p>
            </div>
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/15">
              <Volume2 className="size-5" />
            </span>
          </div>
          <p className="mt-2 font-semibold text-white/90">{d.uz}</p>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white/12 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            <span className="italic text-white/90">{d.sentence}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const BrandPanel = () => (
  <div className="hero-mesh noise relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
    <div className="pointer-events-none absolute -right-24 top-1/4 size-96 rounded-full bg-fuchsia-400/25 blur-3xl" />
    <div className="pointer-events-none absolute -left-24 bottom-0 size-80 rounded-full bg-indigo-400/25 blur-3xl" />

    <div className="relative flex items-center gap-3 text-white">
      <LogoMark className="size-10 drop-shadow-lg" />
      <span className="text-xl font-extrabold tracking-tight">Linguist</span>
    </div>

    <div className="relative max-w-lg">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-[2.6rem] font-extrabold leading-[1.08] text-white xl:text-5xl"
      >
        Ingliz tili — har kuni 15 daqiqada.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mt-4 text-lg text-white/80"
      >
        O&apos;zbek tilida so&apos;zlashuvchilar uchun: CEFR bo&apos;yicha kunlik kurs, aqlli takrorlash va
        amaliy mashqlar.
      </motion.p>

      <div className="mt-10">
        <DemoCard />
      </div>

      <ul className="mt-4 space-y-4">
        {FEATURES.map((f, i) => (
          <motion.li
            key={f.title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.25 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start gap-3 text-white"
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <f.icon className="size-5" />
            </span>
            <span>
              <span className="block font-bold">{f.title}</span>
              <span className="block text-sm text-white/70">{f.text}</span>
            </span>
          </motion.li>
        ))}
      </ul>
    </div>

    <p className="relative text-sm text-white/60">A1 → B2 · 90 mavzu · 900 so&apos;z · oflayn ham ishlaydi</p>
  </div>
);

/**
 * Kirish/ro'yxatdan o'tish sahifalari uchun qobiq.
 * Ilgari forma bo'sh ekran o'rtasidagi yolg'iz karta edi — ilovaning nima
 * ekani yangi foydalanuvchiga umuman aytilmasdi.
 */
const AuthLayout = ({ children }) => (
  <div className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    <BrandPanel />
    <div className="app-backdrop relative flex flex-col pb-safe pt-safe">
      <div className="flex items-center justify-between p-4 sm:p-6">
        <Link to="/" aria-label="Bosh sahifa" className="lg:invisible">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-start justify-center px-5 pb-10 pt-6 sm:items-center sm:px-8 sm:pt-0">
        <div className="w-full max-w-[400px]">{children ?? <Outlet />}</div>
      </div>
    </div>
  </div>
);

export default AuthLayout;
