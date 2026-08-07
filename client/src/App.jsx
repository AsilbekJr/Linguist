import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from './features/auth/authSlice';
import { apiSlice, useGetMeQuery, useSetTimezoneMutation } from './features/api/apiSlice';
import { ThemeToggle } from './components/ThemeToggle';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Vocabulary from './pages/Vocabulary';
import Review from './pages/Review';
import Practice from './pages/Practice';
import TopicVocabulary from './pages/TopicVocabulary';
import { Loader2 } from 'lucide-react';
import { identify } from './lib/analytics';

const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/Auth/ResetPassword'));
const Listening = lazy(() => import('./pages/Listening'));
const SpeakingLab = lazy(() => import('./pages/SpeakingLab'));
const Roleplay = lazy(() => import('./pages/Roleplay'));
const Challenge = lazy(() => import('./pages/Challenge'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Analytics = lazy(() => import('./pages/Analytics'));
const TutorAI = lazy(() => import('./pages/TutorAI'));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[40vh]">
    <Loader2 className="w-10 h-10 animate-spin text-primary" />
    <p className="text-muted-foreground mt-4 text-sm">Yuklanmoqda...</p>
  </div>
);

function App() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const token = useSelector((state) => state.auth.token);
  const lastAuthAt = useSelector((state) => state.auth.lastAuthAt);
  const [loginPrefillEmail, setLoginPrefillEmail] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { data: me, isError: isMeError, error: meError } = useGetMeQuery(undefined, { skip: !token });
  const [setTimezone] = useSetTimezoneMutation();

  useEffect(() => {
    if (isAuthenticated) {
      setLoginPrefillEmail('');
    }
  }, [isAuthenticated]);

  // Anonim ID'ni haqiqiy foydalanuvchiga bog'lash — busiz funnel
  // ro'yxatdan o'tish nuqtasida uzilib qoladi
  useEffect(() => {
    if (!me?._id) return;
    identify(me._id, {
      level: me.onboarding?.level,
      goal: me.onboarding?.goal,
      plan: me.subscription?.plan,
      streak: me.currentStreak,
    });
  }, [me]);

  /**
   * Brauzer zonasini serverga yuboramiz.
   * Busiz streak va kunlik reja UTC bo'yicha hisoblanardi: O'zbekistonda
   * "kun" mahalliy soat 05:00 da almashib, kechqurungi mashq ertangi kunga
   * yozilardi va foydalanuvchi streak'ini bekorga yo'qotardi.
   */
  useEffect(() => {
    if (!isAuthenticated || !me) return;
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserZone && browserZone !== me.timezone) {
      setTimezone(browserZone).unwrap().catch(() => {
        // muhim emas — server default zonaga qaytadi
      });
    }
  }, [isAuthenticated, me, setTimezone]);

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(apiSlice.util.prefetch('getCurrentTopic', undefined, { force: false }));
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    if (!token) return;
    const inAuthGrace = lastAuthAt && Date.now() - lastAuthAt < 8000;
    if (inAuthGrace) return;
    if (isMeError && meError?.status === 401) {
      dispatch(logout());
    }
  }, [token, lastAuthAt, isMeError, meError, dispatch]);

  // Obunani bekor qilish auth devoridan TASHQARIDA bo'lishi kerak: xatdagi
  // havolani bosgan odam login qilmagan bo'lishi mumkin va uni login sahifasiga
  // yuborish "spam" tugmasini bosishga olib keladi.
  if (window.location.pathname === '/unsubscribe') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Unsubscribe />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    // Haqiqiy route'lar: ilgari bu yerda shartli render bor edi, shuning uchun
    // /login yoki /reset-password kabi URL'lar umuman mavjud emas edi —
    // pochtadagi tiklash havolasini ochib bo'lmasdi.
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans flex items-center justify-center p-4 sm:p-6">
        <div className="absolute top-4 right-4 z-50 pointer-events-auto">
          <ThemeToggle />
        </div>
        <Routes>
          <Route
            path="/register"
            element={
              <Register
                onSwitchToLogin={() => navigate('/login')}
                onAuthSuccess={() => navigate('/')}
                onUserExists={(email) => {
                  setLoginPrefillEmail(email);
                  navigate('/login');
                }}
              />
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Suspense fallback={<PageLoader />}>
                <ForgotPassword />
              </Suspense>
            }
          />
          <Route
            path="/reset-password"
            element={
              <Suspense fallback={<PageLoader />}>
                <ResetPassword />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <Login
                key={loginPrefillEmail || 'login'}
                initialEmail={loginPrefillEmail}
                onAuthSuccess={() => navigate('/')}
                onSwitchToRegister={() => {
                  setLoginPrefillEmail('');
                  navigate('/register');
                }}
              />
            }
          />
        </Routes>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="vocabulary" element={<Vocabulary />} />
        <Route path="review" element={<Review />} />
        <Route path="practice" element={<Practice />} />
        <Route
          path="speaking"
          element={
            <Suspense fallback={<PageLoader />}>
              <SpeakingLab />
            </Suspense>
          }
        />
        <Route
          path="roleplay"
          element={
            <Suspense fallback={<PageLoader />}>
              <Roleplay />
            </Suspense>
          }
        />
        <Route
          path="challenge"
          element={
            <Suspense fallback={<PageLoader />}>
              <Challenge />
            </Suspense>
          }
        />
        <Route path="topic" element={<TopicVocabulary />} />
        <Route
          path="listening"
          element={
            <Suspense fallback={<PageLoader />}>
              <Listening />
            </Suspense>
          }
        />
        <Route
          path="pricing"
          element={
            <Suspense fallback={<PageLoader />}>
              <Pricing />
            </Suspense>
          }
        />
        <Route
          path="analytics"
          element={
            <Suspense fallback={<PageLoader />}>
              <Analytics />
            </Suspense>
          }
        />
        <Route
          path="tutor"
          element={
            <Suspense fallback={<PageLoader />}>
              <TutorAI />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
