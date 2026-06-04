import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from './features/auth/authSlice';
import { apiSlice, useGetWordsQuery, useGetReviewDueQuery } from './features/api/apiSlice';
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
  const [showRegister, setShowRegister] = useState(false);
  const [loginPrefillEmail, setLoginPrefillEmail] = useState('');
  const dispatch = useDispatch();

  const { isError: isWordsError, error: wordsError } = useGetWordsQuery(undefined, { skip: !token });
  const { isError: isReviewError, error: reviewError } = useGetReviewDueQuery(undefined, { skip: !token });

  useEffect(() => {
    if (isAuthenticated) {
      setShowRegister(false);
      setLoginPrefillEmail('');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(apiSlice.util.prefetch('getReviewDue', undefined, { force: false }));
    dispatch(apiSlice.util.prefetch('getCurrentTopic', undefined, { force: false }));
    dispatch(apiSlice.util.prefetch('getMe', undefined, { force: false }));
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    if (!token) return;
    const inAuthGrace = lastAuthAt && Date.now() - lastAuthAt < 8000;
    if (inAuthGrace) return;
    if ((isWordsError && wordsError?.status === 401) || (isReviewError && reviewError?.status === 401)) {
      dispatch(logout());
    }
  }, [token, lastAuthAt, isWordsError, wordsError, isReviewError, reviewError, dispatch]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans flex items-center justify-center p-4">
        <div className="absolute top-4 right-4 z-50 pointer-events-auto">
          <ThemeToggle />
        </div>
        {showRegister ? (
          <Register
            onSwitchToLogin={() => setShowRegister(false)}
            onAuthSuccess={() => setShowRegister(false)}
            onUserExists={(email) => {
              setLoginPrefillEmail(email);
              setShowRegister(false);
            }}
          />
        ) : (
          <Login
            key={loginPrefillEmail || 'login'}
            initialEmail={loginPrefillEmail}
            onAuthSuccess={() => setShowRegister(false)}
            onSwitchToRegister={() => {
              setLoginPrefillEmail('');
              setShowRegister(true);
            }}
          />
        )}
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
