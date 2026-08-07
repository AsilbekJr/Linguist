import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, logout } from '../auth/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const getRequestUrl = (args) => (typeof args === 'string' ? args : args?.url || '');

const isPublicAuthRequest = (url) =>
  ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'].some((path) =>
    url.includes(path)
  );

let refreshPromise = null;

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  const url = getRequestUrl(args);

  if (result.error?.status === 401 && !isPublicAuthRequest(url)) {
    if (!refreshPromise) {
      refreshPromise = rawBaseQuery(
        { url: '/api/auth/refresh', method: 'POST' },
        api,
        extraOptions
      ).finally(() => {
        refreshPromise = null;
      });
    }

    const refresh = await refreshPromise;

    if (refresh.data?.token) {
      api.dispatch(
        setCredentials({
          user: refresh.data,
          token: refresh.data.token,
        })
      );
      result = await rawBaseQuery(args, api, extraOptions);
    } else if (refresh.error?.status === 401) {
      api.dispatch(logout());
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  keepUnusedDataFor: 180,
  refetchOnMountOrArgChange: 60,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Word', 'Challenge', 'Topic', 'User', 'Billing', 'Practice'],
  endpoints: (builder) => ({
    getWords: builder.query({
      query: () => '/api/words',
      providesTags: ['Word'],
      keepUnusedDataFor: 300,
    }),
    addWord: builder.mutation({
      query: (initialWord) => ({
        url: '/api/words',
        method: 'POST',
        body: initialWord,
      }),
      invalidatesTags: ['Word', 'Topic'],
    }),
    deleteWord: builder.mutation({
      query: (id) => ({
        url: `/api/words/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Word'],
    }),
    getReviewDue: builder.query({
      query: () => '/api/review/due',
      providesTags: ['Word'],
      keepUnusedDataFor: 60,
    }),
    checkReview: builder.mutation({
      query: ({ id, sentence }) => ({
        url: `/api/review/${id}/check`,
        method: 'POST',
        body: { sentence },
      }),
      invalidatesTags: ['Word', 'User'],
    }),
    /** 4 darajali baholash: 0=Again, 1=Hard, 2=Good, 3=Easy */
    gradeReview: builder.mutation({
      query: ({ id, grade }) => ({
        url: `/api/review/${id}/grade`,
        method: 'POST',
        body: { grade },
      }),
      invalidatesTags: ['Word', 'User'],
    }),
    quickReview: builder.mutation({
      query: ({ id, known }) => ({
        url: `/api/review/${id}/quick`,
        method: 'POST',
        body: { known },
      }),
      invalidatesTags: ['Word', 'User'],
    }),
    getReviewStats: builder.query({
      query: () => '/api/review/stats',
      providesTags: ['Word'],
      keepUnusedDataFor: 60,
    }),
    translateSpeaking: builder.mutation({
      query: (text) => ({
        url: '/api/speaking/translate',
        method: 'POST',
        body: { text },
      }),
    }),
    // `translateText` (/api/speaking/translate-text) olib tashlandi:
    // u umumiy tarjimon edi — o'rganish funksiyasi emas, lekin AI limitini yerdi.
    evaluateSpeaking: builder.mutation({
      query: ({ targetSentence, spokenText }) => ({
        url: '/api/speaking/evaluate',
        method: 'POST',
        body: { targetSentence, spokenText },
      }),
    }),
    chatRoleplay: builder.mutation({
      query: (data) => ({
        url: '/api/roleplay/chat',
        method: 'POST',
        body: data,
      }),
    }),
    askTeacher: builder.mutation({
      query: (data) => ({
        url: '/api/teacher/ask',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
    getCurrentChallenge: builder.query({
      query: () => '/api/challenge/current',
      providesTags: ['Challenge'],
      keepUnusedDataFor: 120,
    }),
    getChallengeHistory: builder.query({
      query: () => '/api/challenge/history',
      providesTags: ['Challenge'],
      keepUnusedDataFor: 300,
    }),
    completeChallenge: builder.mutation({
      query: (data) => ({
        url: '/api/challenge/complete',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Challenge'],
    }),
    getCurrentTopic: builder.query({
      query: () => '/api/topics/current',
      providesTags: ['Topic'],
      keepUnusedDataFor: 300,
    }),
    getTopicBacklog: builder.query({
      query: () => '/api/topics/backlog',
      providesTags: ['Topic'],
      keepUnusedDataFor: 120,
    }),
    /**
     * Mini-testni boshlash. Savollar SERVERDA yaratiladi va to'g'ri javob
     * mijozga yuborilmaydi — ilgari test butunlay brauzerda edi va uni
     * sessionStorage orqali o'tkazib yuborish mumkin edi.
     */
    startTopicQuiz: builder.mutation({
      query: () => ({
        url: '/api/topics/quiz/start',
        method: 'POST',
      }),
    }),
    submitTopicQuiz: builder.mutation({
      query: ({ quizId, answers }) => ({
        url: '/api/topics/quiz/submit',
        method: 'POST',
        body: { quizId, answers },
      }),
      invalidatesTags: ['Topic'],
    }),
    finishTopicDay: builder.mutation({
      query: (body = {}) => ({
        url: '/api/topics/finish',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Topic', 'User', 'Word'],
    }),
    login: builder.mutation({
      query: (credentials) => ({
        url: '/api/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    register: builder.mutation({
      query: (userData) => ({
        url: '/api/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    forgotPassword: builder.mutation({
      query: (email) => ({
        url: '/api/auth/forgot-password',
        method: 'POST',
        body: { email },
      }),
    }),
    resetPassword: builder.mutation({
      query: ({ token, password }) => ({
        url: '/api/auth/reset-password',
        method: 'POST',
        body: { token, password },
      }),
    }),
    getMe: builder.query({
      query: () => '/api/auth/me',
      providesTags: ['User'],
      keepUnusedDataFor: 300,
    }),
    getPracticeSession: builder.query({
      query: () => '/api/practice/session',
      providesTags: ['Practice'],
    }),
    getPracticePrompt: builder.mutation({
      query: (body) => ({
        url: '/api/practice/prompt',
        method: 'POST',
        body,
      }),
    }),
    checkPracticeSentence: builder.mutation({
      query: (body) => ({
        url: '/api/practice/check',
        method: 'POST',
        body,
      }),
    }),
    onboardUser: builder.mutation({
      query: (data) => ({
        url: '/api/auth/onboard',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
    syncDailyQuest: builder.mutation({
      query: (data) => ({
        url: '/api/auth/sync-quest',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
    /** Streak va kunlik reja foydalanuvchi zonasida hisoblanishi uchun */
    setTimezone: builder.mutation({
      query: (timezone) => ({
        url: '/api/auth/timezone',
        method: 'POST',
        body: { timezone },
      }),
    }),
    refreshToken: builder.mutation({
      query: () => ({
        url: '/api/auth/refresh',
        method: 'POST',
      }),
    }),
    logoutSession: builder.mutation({
      query: () => ({
        url: '/api/auth/logout',
        method: 'POST',
      }),
    }),
    getSubscription: builder.query({
      query: () => '/api/billing/subscription',
      providesTags: ['Billing', 'User'],
      keepUnusedDataFor: 300,
    }),
    createCheckoutSession: builder.mutation({
      query: (plan) => ({
        url: '/api/billing/checkout',
        method: 'POST',
        body: { plan },
      }),
    }),
    createPortalSession: builder.mutation({
      query: () => ({
        url: '/api/billing/portal',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetWordsQuery,
  useAddWordMutation,
  useDeleteWordMutation,
  useCheckReviewMutation,
  useGradeReviewMutation,
  useQuickReviewMutation,
  useGetReviewStatsQuery,
  useTranslateSpeakingMutation,
  useEvaluateSpeakingMutation,
  useChatRoleplayMutation,
  useAskTeacherMutation,
  useGetCurrentChallengeQuery,
  useGetChallengeHistoryQuery,
  useCompleteChallengeMutation,
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetMeQuery,
  useGetPracticeSessionQuery,
  useGetPracticePromptMutation,
  useCheckPracticeSentenceMutation,
  useGetReviewDueQuery,
  useGetCurrentTopicQuery,
  useGetTopicBacklogQuery,
  useStartTopicQuizMutation,
  useSubmitTopicQuizMutation,
  useFinishTopicDayMutation,
  useOnboardUserMutation,
  useSyncDailyQuestMutation,
  useSetTimezoneMutation,
  useRefreshTokenMutation,
  useLogoutSessionMutation,
  useGetSubscriptionQuery,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
} = apiSlice;
