import React, { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "./features/auth/authSlice";
import {
  apiSlice,
  useGetMeQuery,
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
const TopicVocabulary = lazy(() => import("./pages/TopicVocabulary"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const ForgotPassword = lazy(() => import("./components/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/Auth/ResetPassword"));
const Listening = lazy(() => import("./pages/Listening"));
const SpeakingLab = lazy(() => import("./pages/SpeakingLab"));
const Challenge = lazy(() => import("./pages/Challenge"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Analytics = lazy(() => import("./pages/Analytics"));
const SentenceAnalysis = lazy(() => import("./pages/SentenceAnalysis"));

// Lazy sahifa yuklanguncha — spinner o'rniga sahifa shaklidagi skelet:
// kontent qayerda paydo bo'lishi oldindan ko'rinadi va sakrash bo'lmaydi
const PageLoader = () => <PageSkeleton />;

function App() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const token = useSelector((state) => state.auth.token);
  const lastAuthAt = useSelector((state) => state.auth.lastAuthAt);
  const [loginPrefillEmail, setLoginPrefillEmail] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    data: me,
    isError: isMeError,
    error: meError,
  } = useGetMeQuery(undefined, { skip: !token });
  const [setTimezone] = useSetTimezoneMutation();

  useEffect(() => {
    if (isAuthenticated) {
      setLoginPrefillEmail("");
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
      setTimezone(browserZone)
        .unwrap()
        .catch(() => {
          // muhim emas — server default zonaga qaytadi
        });
    }
  }, [isAuthenticated, me, setTimezone]);

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(
      apiSlice.util.prefetch("getCurrentTopic", undefined, { force: false }),
    );
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
  if (window.location.pathname === "/unsubscribe") {
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
      <AuthLayout>
        <Routes>
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
        </Routes>
      </AuthLayout>
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
        <Route
          path="speaking"
          element={
            <Suspense fallback={<PageLoader />}>
              <SpeakingLab />
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
        <Route
          path="topic"
          element={
            <Suspense fallback={<PageLoader />}>
              <TopicVocabulary />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
