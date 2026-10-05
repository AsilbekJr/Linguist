import { useEffect } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from '../Sidebar';
import OnboardingModal from '../Onboarding/OnboardingModal';
import InstallPrompt from '../InstallPrompt';
import { SplashScreen } from '../brand/SplashScreen';
import { MobileTopBar, MobileTabBar } from './MobileNav';
import { apiSlice, useGetMeQuery } from '../../features/api/apiSlice';
import { watchDayChange } from '../../utils/dayRefresh';
import EmailVerifyBanner from '../EmailVerifyBanner';
import { stopTTSAudio } from '../../utils/audio';
import { titleForPath } from './nav';
import { ChevronRight } from 'lucide-react';

/**
 * Ilova qobig'i.
 *  - lg+: chapda sidebar, kontent to'liq balandlikda
 *  - lg dan kichik: yuqorida top bar, pastda tab-bar (bosh barmoq zonasi)
 *
 * Sahifalar almashganda kontent yumshoq paydo bo'ladi. `useOutlet` ishlatiladi:
 * `<Outlet/>` bilan chiqib ketayotgan sahifa animatsiya davomida allaqachon
 * YANGI sahifani ko'rsatib qo'yardi.
 */
const DashboardLayout = () => {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const location = useLocation();
  const outlet = useOutlet();

  const { data: fullUser, isLoading } = useGetMeQuery(undefined, { skip: !token });
  const user = fullUser || authUser;
  const isOnboardingComplete = user?.onboarding?.completed === true;

  useEffect(() => {
    if (!token || !user?.today) return;
    return watchDayChange({
      timezone: user.timezone, today: user.today,
      refresh: () => dispatch(apiSlice.util.invalidateTags(['User', 'Topic', 'Word', 'Speak', 'Listening'])),
    });
  }, [dispatch, token, user?.timezone, user?.today]);

  // Yangi sahifa tepadan boshlansin
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    return stopTTSAudio;
  }, [location.pathname]);

  // Login paytida saqlangan profil bo'lsa kutmaymiz: sahifa darhol chiziladi,
  // uning so'rovlari /me bilan PARALLEL ketadi. Ilgari hamma narsa /me javobini
  // kutardi — Render uyg'onayotganda bu 30-50 soniyalik bo'sh splash edi.
  // (Faqat onboarding tugagani ma'lum bo'lsa — aks holda onboarding oynasi bir
  // lahza ko'rinib, keyin yo'qolardi.)
  if (isLoading && authUser?.onboarding?.completed !== true) {
    return (
      <SplashScreen
        title="Tizimga kirilmoqda…"
        hint="Server uyqu rejimida bo'lsa, birinchi ochilish 1 daqiqagacha cho'zilishi mumkin."
      />
    );
  }

  if (!isOnboardingComplete) {
    return (
      <div className="app-backdrop min-h-dvh bg-background">
        <OnboardingModal />
      </div>
    );
  }

  return (
    <div className="app-backdrop min-h-dvh bg-background text-foreground">
      <a href="#main" className="sr-only z-50 rounded-xl bg-card px-4 py-3 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Asosiy mazmunga o'tish</a>
      <Sidebar user={user} />
      <MobileTopBar user={user} />

      <div className="lg:pl-[272px]">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10"
        >
          <EmailVerifyBanner user={user} />
          {location.pathname !== '/' && (
            <nav aria-label="Sahifa yo‘li" className="mb-5 flex items-center gap-2 text-sm">
              <Link to="/" className="rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Bugun</Link>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              <span aria-current="page" className="font-semibold text-muted-foreground">{titleForPath(location.pathname)}</span>
            </nav>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileTabBar />
      {/* Onboarding tugagandan keyingina taklif qilamiz — birinchi
          daqiqada ikkita modal foydalanuvchini bosib ketadi */}
      <InstallPrompt />
    </div>
  );
};

export default DashboardLayout;
