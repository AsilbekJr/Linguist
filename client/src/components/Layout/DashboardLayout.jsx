import { useEffect, useState } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from '../Sidebar';
import OnboardingModal from '../Onboarding/OnboardingModal';
import InstallPrompt from '../InstallPrompt';
import { SplashScreen } from '../brand/SplashScreen';
import { MobileTopBar, MobileTabBar } from './MobileNav';
import { apiSlice, useGetMeQuery } from '../../features/api/apiSlice';
import { dayKeyInZone, watchDayChange } from '../../utils/dayRefresh';
import { PageSkeleton } from '../ui/primitives';
import { Button } from '../ui/button';
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
  const location = useLocation();
  const outlet = useOutlet();

  const { data: fullUser, isLoading, isError, isFetching, refetch } = useGetMeQuery();
  const user = fullUser || authUser;
  const [currentDay, setCurrentDay] = useState(() => dayKeyInZone(user?.timezone));
  const staleDay = Boolean(user?.today && user.today !== currentDay);
  const dailyPage = ['/', '/topic', '/speak', '/listening'].includes(location.pathname);
  const menuUser = staleDay ? { ...user, today: currentDay, dailyQuests: {}, week: [] } : user;
  const isOnboardingComplete = user?.onboarding?.completed === true;

  useEffect(() => {
    setCurrentDay(dayKeyInZone(user?.timezone));
    if (!user?.today) return;
    return watchDayChange({
      timezone: user.timezone, today: user.today,
      refresh: () => {
        setCurrentDay(dayKeyInZone(user.timezone));
        dispatch(apiSlice.util.invalidateTags(['User', 'Topic', 'Word', 'Speak', 'Listening']));
      },
    });
  }, [dispatch, user?.timezone, user?.today]);

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
      <Sidebar user={menuUser} />
      <MobileTopBar user={menuUser} />

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
              {staleDay && dailyPage ? (
                <div>
                  <p role="status" className="mb-4 text-sm text-muted-foreground">Bugungi kun yuklanmoqda…</p>
                  {isError ? (
                    <div className="surface p-5">
                      <p className="mb-3">Bugungi kunni yuklab bo&apos;lmadi. Internetni tekshirib qayta urining.</p>
                      <Button disabled={isFetching} onClick={refetch}>Qayta urinish</Button>
                    </div>
                  ) : <PageSkeleton cards={2} />}
                </div>
              ) : outlet}
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
