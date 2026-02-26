import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from './features/auth/authSlice';
import { useGetWordsQuery, useGetReviewDueQuery } from './features/api/apiSlice';
import { ThemeToggle } from './components/ThemeToggle';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';

// Layouts & Pages
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Vocabulary from './pages/Vocabulary';
import Review from './pages/Review';
import SpeakingLab from './pages/SpeakingLab';
import Roleplay from './pages/Roleplay';
import Challenge from './pages/Challenge';
import TopicVocabulary from './pages/TopicVocabulary';

function App() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [showRegister, setShowRegister] = useState(false);
  const dispatch = useDispatch();

  // Watch for global 401s to log out
  const { isError: isWordsError, error: wordsError } = useGetWordsQuery(undefined, { skip: !isAuthenticated });
  const { isError: isReviewError, error: reviewError } = useGetReviewDueQuery(undefined, { skip: !isAuthenticated });

  useEffect(() => {
    if ((isWordsError && wordsError?.status === 401) || (isReviewError && reviewError?.status === 401)) {
      dispatch(logout());
    }
  }, [isWordsError, wordsError, isReviewError, reviewError, dispatch]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans flex items-center justify-center p-4">
        <div className="absolute top-4 right-4 z-50 pointer-events-auto">
            <ThemeToggle />
        </div>
        {showRegister ? (
           <Register onSwitchToLogin={() => setShowRegister(false)} />
        ) : (
           <Login onSwitchToRegister={() => setShowRegister(true)} />
        )}
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        {/* Default route inside DashboardLayout */}
        <Route index element={<Dashboard />} />
        
        {/* Feature Pages */}
        <Route path="vocabulary" element={<Vocabulary />} />
        <Route path="review" element={<Review />} />
        <Route path="speaking" element={<SpeakingLab />} />
        <Route path="roleplay" element={<Roleplay />} />
        <Route path="challenge" element={<Challenge />} />
        <Route path="topic" element={<TopicVocabulary />} />
        
        {/* Catch-all to redirect back to Dashboard if not found */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
