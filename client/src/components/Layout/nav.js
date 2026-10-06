import {
  Home, BookOpen, BookHeart, Headphones, ScanText, BarChart3, CreditCard, Settings, MessagesSquare, AudioLines,
} from 'lucide-react';

/**
 * Navigatsiya bitta joyda — sidebar, pastki tab-bar va "Mashqlar" varag'i
 * shu ro'yxatdan quriladi. Ilgari havolalar uch joyda qo'lda takrorlanardi.
 */
export const PRIMARY_NAV = [
  { to: '/', label: 'Bugun', icon: Home, end: true },
  { to: '/topic', label: 'Kunlik sahna', short: 'Sahna', icon: BookHeart },
  { to: '/speak', label: 'Suhbat', icon: MessagesSquare },
  { to: '/vocabulary', label: "Lug'at", icon: BookOpen },
];

/**
 * Kunlik rejadan tashqari bonus mashq. "Gap tahlili" bu yerdan olib
 * tashlandi: umumiy AI vosita edi va kunlik tsiklga bog'lanmagan edi.
 * Endi u xato ko'rsatilgan joyda ochiladi (takrorlashda "Gapimni tushuntir",
 * Suhbat natijasida "Tahlil") — sahifa havola orqali ishlayveradi.
 */
export const PRACTICE_NAV = [
  { to: '/listening', label: 'Tinglash', hint: 'Bugungi dialogni eshitib yozish', icon: Headphones, tone: 'teal' },
  { to: '/diary', label: 'Ovoz kundaligi', hint: "O'sishingizni o'z qulog'ingiz bilan eshiting", icon: AudioLines, tone: 'pink' },
];

/** Menyuda yo'q, lekin sarlavhasi kerak bo'lgan sahifalar */
const HIDDEN_TITLES = [{ to: '/analysis', label: 'Gap tahlili', icon: ScanText }];

export const ACCOUNT_NAV = [
  { to: '/analytics', label: 'Natijalar', icon: BarChart3 },
  { to: '/pricing', label: 'Tariflar', icon: CreditCard },
  { to: '/settings', label: 'Sozlamalar', icon: Settings },
];

export const PRACTICE_PATHS = PRACTICE_NAV.map((i) => i.to);
const ALL_NAV = [...PRIMARY_NAV, ...PRACTICE_NAV, ...ACCOUNT_NAV, ...HIDDEN_TITLES];

/** Sahifa sarlavhasi (mobil top bar uchun) */
export const titleForPath = (pathname) => {
  const match = ALL_NAV.find((i) => pathname === i.to || (!i.end && pathname.startsWith(`${i.to}/`)));
  return match?.label || '';
};
