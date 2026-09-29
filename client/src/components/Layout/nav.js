import {
  Home, BookOpen, BookHeart, Headphones, ScanText, AudioLines, Flame, BarChart3, CreditCard,
} from 'lucide-react';

/**
 * Navigatsiya bitta joyda — sidebar, pastki tab-bar va "Mashqlar" varag'i
 * shu ro'yxatdan quriladi. Ilgari havolalar uch joyda qo'lda takrorlanardi.
 */
export const PRIMARY_NAV = [
  { to: '/', label: 'Bugun', icon: Home, end: true },
  { to: '/topic', label: 'Kunlik sahna', short: 'Sahna', icon: BookHeart },
  { to: '/vocabulary', label: "Lug'at", icon: BookOpen },
];

export const PRACTICE_NAV = [
  { to: '/listening', label: 'Tinglash', hint: 'Dialogni eshitib yozish', icon: Headphones, tone: 'teal' },
  { to: '/analysis', label: 'Gap tahlili', hint: "Ega, kesim, so'z turkumlari", icon: ScanText, tone: 'info' },
  { to: '/speaking', label: 'Gapirish', hint: "O'zbekchadan inglizchaga", icon: AudioLines, tone: 'pink' },
  { to: '/challenge', label: '100 kun', hint: 'Har kuni yoddan aytish', icon: Flame, tone: 'streak' },
];

export const ACCOUNT_NAV = [
  { to: '/analytics', label: 'Natijalar', icon: BarChart3 },
  { to: '/pricing', label: 'Tariflar', icon: CreditCard },
];

export const PRACTICE_PATHS = PRACTICE_NAV.map((i) => i.to);

/** Sahifa sarlavhasi (mobil top bar uchun) */
export const titleForPath = (pathname) => {
  const all = [...PRIMARY_NAV, ...PRACTICE_NAV, ...ACCOUNT_NAV];
  const match = all.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  return match?.label || '';
};
