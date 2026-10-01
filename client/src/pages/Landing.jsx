import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, Gauge, BookHeart, PenLine, Repeat2, Mic, Headphones, MessagesSquare, Flame, Snowflake,
  WifiOff, CheckCircle2, Volume2, Sparkles, ChevronDown, Star, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconTile } from '@/components/ui/primitives';
import { Logo, LogoMark } from '../components/brand/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { useScrolled } from '../hooks/useScrolled';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1];

/** Ko'rinishga kirganda paydo bo'ladi */
const Reveal = ({ children, delay = 0, className, as = 'div' }) => {
  const Comp = motion[as];
  return (
    <Comp
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </Comp>
  );
};

const SectionTitle = ({ eyebrow, title, text }) => (
  <Reveal className="mx-auto mb-12 max-w-2xl text-center">
    <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
    <h2 className="text-3xl font-extrabold leading-tight sm:text-[2.6rem]">{title}</h2>
    {text && <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{text}</p>}
  </Reveal>
);

// ─── Hero'dagi telefon maketi ─────────────────────────────────────────────
// Rasm emas — haqiqiy komponentlarga o'xshash kichik jonli maket: yengil,
// har ikki mavzuda to'g'ri ko'rinadi va hech qachon eskirib qolmaydi.
const PhoneMock = () => (
  <div className="relative mx-auto w-[300px] sm:w-[320px]">
    <div className="absolute -inset-10 -z-10 rounded-full bg-primary/25 blur-3xl" />
    <div className="rounded-[2.6rem] border border-border bg-card p-2.5 shadow-[0_40px_80px_-30px_color-mix(in_oklch,var(--primary)_55%,transparent)]">
      <div className="overflow-hidden rounded-[2.1rem] bg-background">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <LogoMark className="size-7" />
          <span className="inline-flex items-center gap-1 rounded-full bg-streak/12 px-2.5 py-1 text-xs font-bold text-streak">
            <Flame className="size-3.5" /> 12
          </span>
        </div>
        <div className="space-y-3 px-4 pb-5">
          <div className="hero-mesh rounded-2xl p-4 text-white">
            <p className="text-[11px] text-white/75">Payshanba, 2-oktabr</p>
            <p className="mt-0.5 text-lg font-extrabold">Xayrli kun, Aziza 👋</p>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 rounded-xl bg-white/12 p-2 text-xs font-semibold">
                <span className="inline-flex size-6 items-center justify-center rounded-lg bg-white text-primary">
                  <CheckCircle2 className="size-3.5" />
                </span>
                Kunlik sahna
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/12 p-2 text-xs font-semibold">
                <span className="inline-flex size-6 items-center justify-center rounded-lg bg-white/15">
                  <Repeat2 className="size-3.5" />
                </span>
                Takrorlash · 6 ta so&apos;z
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-extrabold tracking-tight">journey</p>
                <p className="font-ipa text-xs text-muted-foreground">/ˈdʒɜː.ni/</p>
              </div>
              <span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-card">
                <Volume2 className="size-4" />
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-primary">sayohat</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl border border-primary/40 bg-card p-1.5 ring-4 ring-primary/10">
            <span className="flex-1 truncate px-2 text-xs">Our journey to Khiva was long…</span>
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Send className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Suzuvchi belgilar */}
    <motion.div
      initial={{ opacity: 0, x: 20, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay: 0.9, duration: 0.6, ease: EASE }}
      className="glass absolute -right-24 top-10 hidden rounded-2xl border border-border p-3 shadow-xl sm:block"
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <CheckCircle2 className="size-5 text-success" /> To&apos;g&apos;ri!
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">4 kundan keyin yana chiqadi</p>
    </motion.div>
    <motion.div
      initial={{ opacity: 0, x: -20, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay: 1.1, duration: 0.6, ease: EASE }}
      className="glass absolute -left-24 bottom-14 hidden rounded-2xl border border-border p-3 shadow-xl sm:block"
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <Star className="size-4 fill-current text-xp" /> +5 so&apos;z
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Kunlik sahna bajarildi</p>
    </motion.div>
  </div>
);

const STEPS = [
  { icon: BookHeart, tone: 'primary', title: 'Sahna', text: "Hayotiy dialog, o'zbekcha tarjima va 3–7 ta yangi so'z. Kunning kalit gaplarini qo'shiq matni kabi yod olasiz — har davrada matn kamayadi." },
  { icon: MessagesSquare, tone: 'pink', title: 'Suhbat', text: "Sahna qahramoni bilan ovozli suhbat: dorixonada — farmatsevt, aeroportda — xodim. Bugungi so'zni aytishingiz bilan u yonadi." },
  { icon: Repeat2, tone: 'success', title: 'Takrorlash', text: "So'z va iboralar unutilay deganda qaytadi: tanib olishdan boshlab o'z gapingizni tuzishgacha." },
];

const FEATURES = [
  { icon: Gauge, tone: 'info', title: 'Darajani aniqlang', text: "2 daqiqalik moslashuvchan test. Kurs bilganingizdan boshlanadi — oddiy narsalarni qayta o'qimaysiz." },
  { icon: Sparkles, tone: 'pink', title: 'AI izohlar', text: "Suhbat va gaplaringizdagi xatoni o'zbek tilida tushuntiradi, to'g'ri variantni ovoz bilan eshittiradi." },
  { icon: Mic, tone: 'streak', title: 'Ovoz bilan', text: "Yod olish, suhbat va ibora kartalari — hammasi ovoz chiqarib. Ovozingiz hech qayerga yuborilmaydi." },
  { icon: Headphones, tone: 'teal', title: 'Tinglab yozish', text: "Bonus mashq: dialogni eshitib yozasiz — qaysi so'z tushib qolgani rangli ko'rsatiladi." },
  { icon: Snowflake, tone: 'info', title: 'Streak muzlatish', text: "Bir kun o'tkazib yuborsangiz, streak saqlanadi. Har oy 2 ta beriladi." },
  { icon: PenLine, tone: 'success', title: "O'z gapingiz", text: "Takrorlashning yuqori bosqichida so'z bilan o'zingiz gap tuzasiz — bu haqiqiy bilimni ko'rsatadi." },
];

const STAGES = [1, 2, 4, 7, 14, 30];

const FAQ = [
  { q: 'Bu bepulmi?', a: "Ha. Bepul tarifda kunlik sahna, takrorlash, tinglash va yoddan aytish mashqi to'liq ishlaydi, kuniga 15 ta AI tekshiruv bor. Ko'proq AI kerak bo'lsa — Pro tarif." },
  { q: 'AI limiti tugasa nima bo\'ladi?', a: "Takrorlash to'xtamaydi: so'z to'g'ri ishlatilgani tekshiriladi, ilova esa grammatika bu safar AI bilan tekshirilmaganini ochiq aytadi." },
  { q: 'Qaysi darajalar uchun?', a: "90 kunlik kurs: 90 mavzu va 900 so'z, A1 dan B2 gacha. Daraja testi sizni mos kundan boshlaydi." },
  { q: 'Telefonda ishlaydimi?', a: "Ha. Brauzerda ochib, \"Bosh ekranga qo'shish\" orqali ilova kabi o'rnatasiz — oflaynda ham ochiladi, kunlik eslatma yuborishi mumkin." },
  { q: "To'lov qanday?", a: "Hozircha xalqaro kartalar (Stripe). Uzcard/Humo uchun Payme va Click integratsiyasi rejada." },
];

const LandingNav = () => {
  const scrolled = useScrolled(8);
  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 pt-safe transition-[background-color,border-color,box-shadow] duration-300',
        scrolled ? 'glass border-b border-border shadow-sm' : 'border-b border-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="Bosh sahifa" className="mr-auto">
          <Logo />
        </Link>
        <ThemeToggle className="hidden sm:inline-flex" />
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link to="/login">Kirish</Link>
        </Button>
        <Button asChild size="sm" className="h-10 px-4">
          <Link to="/register">Boshlash</Link>
        </Button>
      </div>
    </header>
  );
};

const Landing = () => (
  <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
    <LandingNav />

    {/* ── Hero ─────────────────────────────────────────────────────────── */}
    <section className="app-backdrop relative px-4 pb-20 pt-28 sm:px-6 sm:pt-36 lg:pb-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
        <div className="text-center lg:text-left">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3.5 py-1.5 text-sm font-semibold text-primary"
          >
            <Sparkles className="size-4" /> O&apos;zbek tilida so&apos;zlashuvchilar uchun
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
            className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Ingliz tili — har kuni{' '}
            <span className="text-brand-gradient">15 daqiqada</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0"
          >
            CEFR bo&apos;yicha tuzilgan kunlik kurs: hayotiy dialoglar, so&apos;zni o&apos;z gapingizda
            ishlatib yodlash va unutay deganda qaytaradigan aqlli takrorlash.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <Button asChild size="xl" variant="brand">
              <Link to="/register">
                Bepul boshlash <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link to="/login">Hisobim bor</Link>
            </Button>
          </motion.div>
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground lg:justify-start"
          >
            {['Bepul', 'A1 → B2', "900 so'z · 90 mavzu", 'Oflayn ishlaydi'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" /> {t}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
        >
          <PhoneMock />
        </motion.div>
      </div>
    </section>

    {/* ── Qanday ishlaydi ──────────────────────────────────────────────── */}
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionTitle eyebrow="Qanday ishlaydi" title="Uch qadam — va bu odatga aylanadi" />
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="surface relative p-6 sm:p-7">
              <span className="absolute right-6 top-5 text-5xl font-extrabold text-muted-foreground/12 tabular">{i + 1}</span>
              <IconTile icon={s.icon} tone={s.tone} size="lg" />
              <h3 className="mt-5 text-xl font-extrabold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    {/* ── Metodika: 7 bosqich ──────────────────────────────────────────── */}
    <section className="bg-muted/40 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionTitle
          eyebrow="Metodika"
          title="Unutishdan oldin — takrorlash"
          text="Har to'g'ri javobdan keyin so'z keyingi bosqichga o'tadi va kechroq qaytadi. Xato qilsangiz — boshidan, 1 kundan. 7-bosqichdan keyin so'z yodlangan hisoblanadi."
        />
        <Reveal className="surface p-6 sm:p-8">
          <ol className="grid grid-cols-4 gap-y-6 sm:flex sm:items-center">
            {STAGES.map((days, i) => (
              <li key={days} className="flex items-center justify-center sm:flex-1 sm:justify-start">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 300, damping: 18 }}
                  className="flex flex-col items-center"
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-sm font-extrabold text-primary">
                    {i + 1}
                  </span>
                  <span className="mt-2 text-sm font-bold tabular">{days === 1 ? '1 kun' : `${days} kun`}</span>
                </motion.div>
                <span className="mx-2 hidden h-0.5 flex-1 rounded-full bg-gradient-to-r from-primary/40 to-primary/10 sm:block" />
              </li>
            ))}
            <li className="flex flex-col items-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8, type: 'spring', stiffness: 300, damping: 14 }}
                className="inline-flex size-12 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-lg"
              >
                <CheckCircle2 className="size-6" />
              </motion.span>
              <span className="mt-2 text-sm font-bold text-success">Yodlandi</span>
            </li>
          </ol>
        </Reveal>
      </div>
    </section>

    {/* ── Imkoniyatlar ─────────────────────────────────────────────────── */}
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionTitle eyebrow="Imkoniyatlar" title="Faqat so'z yodlash emas" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06} className="surface-interactive p-6">
              <IconTile icon={f.icon} tone={f.tone} />
              <h3 className="mt-4 text-lg font-extrabold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{f.text}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="size-4" /> Telefonga o&apos;rnatiladi va internetsiz ham ochiladi
        </Reveal>
      </div>
    </section>

    {/* ── Savollar ─────────────────────────────────────────────────────── */}
    <section className="bg-muted/40 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionTitle eyebrow="Savollar" title="Ko'p so'raladigan savollar" />
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={i * 0.04}>
              <details className="surface group p-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left font-bold">
                  {item.q}
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    {/* ── Yakuniy chaqiriq ─────────────────────────────────────────────── */}
    <section className="px-4 py-20 sm:px-6 lg:py-24">
      <Reveal className="hero-mesh noise relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl" />
        <LogoMark className="mx-auto mb-6 size-14 drop-shadow-xl" />
        <h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">Bugundan boshlang</h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-white/80">
          Darajangizni 2 daqiqada aniqlang — birinchi sahna shu zahoti ochiladi.
        </p>
        <Button asChild size="xl" className="mt-8 bg-white text-primary shadow-xl hover:bg-white/90">
          <Link to="/register">
            Bepul hisob ochish <ArrowRight />
          </Link>
        </Button>
      </Reveal>
    </section>

    <footer className="border-t border-border px-4 pb-safe sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <div className="flex items-center gap-5">
          <Link to="/login" className="hover:text-foreground">Kirish</Link>
          <Link to="/register" className="hover:text-foreground">Ro&apos;yxatdan o&apos;tish</Link>
          <ThemeToggle className="sm:hidden" />
        </div>
        <p>© {new Date().getFullYear()} Linguist</p>
      </div>
    </footer>
  </div>
);

export default Landing;
