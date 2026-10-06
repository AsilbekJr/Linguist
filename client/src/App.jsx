import { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  apiSlice,
  useGetMeQuery,
  useRestoreSessionMutation,
  useSetTimezoneMutation,
} from "./features/api/apiSlice";
import AuthLayout from "./components/Auth/AuthLayout";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import DashboardLayout from "./components/Layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import { PageSkeleton } from "./components/ui/primitives";
import { identify } from "./lib/analytics";

const Vocabulary = lazy(() => import("./pages/Vocabulary"));
const loadTopicPage = () => import("./pages/TopicVocabulary");
const TopicVocabulary = lazy(loadTopicPage);
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const ForgotPassword = lazy(() => import("./components/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/Auth/ResetPassword"));
const VerifyEmail = lazy(() => import("./components/Auth/VerifyEmail"));
const Listening = lazy(() => import("./pages/Listening"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Landing = lazy(() => import("./pages/Landing"));
const Settings = lazy(() => import("./pages/Settings"));
const Speak = lazy(() => import("./pages/Speak"));
const VoiceDiary = lazy(() => import("./pages/VoiceDiary"));
const SentenceAnalysis = lazy(() => import("./pages/SentenceAnalysis"));

// Lazy sahifa yuklanguncha — spinner o'rniga sahifa shaklidagi skelet:
// kontent qayerda paydo bo'lishi oldindan ko'rinadi va sakrash bo'lmaydi
const PageLoader = () => <PageSkeleton />;

function App() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const token = useSelector((state) => state.auth.token);
  const [loginPrefillEmail, setLoginPrefillEmail] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: me } = useGetMeQuery(undefined, { skip: !token });
  const [setTimezone] = useSetTimezoneMutation();
  const [restoreSession] = useRestoreSessionMutation();
  const userId = me?._id;
  const userLevel = me?.onboarding?.level;
  const userGoal = me?.onboarding?.goal;
  const userPlan = me?.subscription?.plan;
  const userStreak = me?.currentStreak;
  const userTimezone = me?.timezone;

  // Access token faqat xotirada: sahifa qayta ochilganda uni refresh cookie
  // orqali tiklaymiz. Shu vaqtda UI saqlangan keshdan chiziladi, so'rovlar
  // esa tiklanishni kutadi (apiSlice → baseQueryWithReauth).
  useEffect(() => {
    if (isAuthenticated && !token) {
      restoreSession();
    }
  }, [isAuthenticated, token, restoreSession]);

  useEffect(() => {
    if (isAuthenticated) {
      setLoginPrefillEmail("");
    }
  }, [isAuthenticated]);

  // Anonim ID'ni haqiqiy foydalanuvchiga bog'lash — busiz funnel
  // ro'yxatdan o'tish nuqtasida uzilib qoladi
  useEffect(() => {
    if (!userId) return;
    identify(userId, {
      level: userLevel,
      goal: userGoal,
      plan: userPlan,
      streak: userStreak,
    });
  }, [userId, userLevel, userGoal, userPlan, userStreak]);

  /**
   * Brauzer zonasini serverga yuboramiz.
   * Busiz streak va kunlik reja UTC bo'yicha hisoblanardi: O'zbekistonda
   * "kun" mahalliy soat 05:00 da almashib, kechqurungi mashq ertangi kunga
   * yozilardi va foydalanuvchi streak'ini bekorga yo'qotardi.
   */
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserZone && browserZone !== userTimezone) {
      setTimezone(browserZone)
        .unwrap()
        .catch(() => {
          // muhim emas — server default zonaga qaytadi
        });
    }
  }, [isAuthenticated, userId, userTimezone, setTimezone]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadTopicPage().catch(() => {});
    dispatch(
      apiSlice.util.prefetch("getCurrentTopic", undefined, { force: false }),
    );
  }, [isAuthenticated, dispatch]);

  // Obunani bekor qilish auth devoridan TASHQARIDA bo'lishi kerak: xatdagi
  // havolani bosgan odam login qilmagan bo'lishi mumkin va uni login sahifasiga
  // yuborish "spam" tugmasini bosishga olib keladi.
  if (window.location.pathname === "/unsubscribe") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Unsubscribe />
      </Suspense>
    );
  }

  // Parolni tiklash havolasi tizimga kirgan brauzerda ham ochilishi kerak.
  // Ilgari u ichki route'larga tushib "/" ga yo'naltirilardi: URL'dagi token
  // yo'qolar, parol o'zgarmas, foydalanuvchi esa "yangiladim" deb o'ylardi.
  // Email tasdiqlash havolasi ham xuddi shunday — kirgan-kirmaganidan qat'i nazar
  if (
    location.pathname === "/verify-email" ||
    (isAuthenticated && location.pathname === "/reset-password")
  ) {
    return (
      <Routes>
        <Route element={<AuthLayout />}>
          <Route
            path="/reset-password"
            element={
              <Suspense fallback={<PageLoader />}>
                <ResetPassword />
              </Suspense>
            }
          />
          <Route
            path="/verify-email"
            element={
              <Suspense fallback={<PageLoader />}>
                <VerifyEmail />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    );
  }

  if (!isAuthenticated) {
    // Haqiqiy route'lar: ilgari bu yerda shartli render bor edi, shuning uchun
    // /login yoki /reset-password kabi URL'lar umuman mavjud emas edi —
    // pochtadagi tiklash havolasini ochib bo'lmasdi.
    return (
      <Routes>
        {/* Tizimga kirmagan odam ilova nima ekanini ko'rsin — ilgari u
            to'g'ridan-to'g'ri login formasiga tushardi */}
        <Route
          index
          element={
            <Suspense fallback={<PageLoader />}>
              <Landing />
            </Suspense>
          }
        />
        <Route element={<AuthLayout />}>
          <Route
            path="/register"
            element={
              <Register
                onSwitchToLogin={() => navigate("/login")}
                onAuthSuccess={() => navigate("/")}
                onUserExists={(email) => {
                  setLoginPrefillEmail(email);
                  navigate("/login");
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
                key={loginPrefillEmail || "login"}
                initialEmail={loginPrefillEmail}
                onAuthSuccess={() => navigate("/")}
                onSwitchToRegister={() => {
                  setLoginPrefillEmail("");
                  navigate("/register");
                }}
              />
            }
          />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route
          path="vocabulary"
          element={
            <Suspense fallback={<PageLoader />}>
              <Vocabulary />
            </Suspense>
          }
        />
        {/* Gapirish va yoddan aytish endi kunlik sahnaning qadamlari */}
        <Route path="speaking" element={<Navigate to="/topic" replace />} />
        <Route path="challenge" element={<Navigate to="/topic" replace />} />
        <Route
          path="topic"
          element={
            <Suspense fallback={<PageLoader />}>
              <TopicVocabulary />
            </Suspense>
          }
        />
        <Route
          path="diary"
          element={
            <Suspense fallback={<PageLoader />}>
              <VoiceDiary />
            </Suspense>
          }
        />
        <Route
          path="speak"
          element={
            <Suspense fallback={<PageLoader />}>
              <Speak />
            </Suspense>
          }
        />
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
          path="analysis"
          element={
            <Suspense fallback={<PageLoader />}>
              <SentenceAnalysis />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
