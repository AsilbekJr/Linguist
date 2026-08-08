import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, logout } from '../auth/authSlice';

/**
 * Backend manzili.
 *
 * Zaxira qiymat FAQAT ishlab chiqish uchun. Deploy qilingan build'da
 * `VITE_API_URL` yozilmagan bo'lsa, ilova foydalanuvchining O'Z
 * kompyuteridagi 127.0.0.1:5000 ga murojaat qilishga urinadi — bu esa
 * https sahifadan http manzilga so'rov bo'lgani uchun brauzer tomonidan
 * bloklanadi ("mixed content") va sabab hech qayerda ko'rinmaydi.
 * Shuning uchun bu holatni baland ovozda aytamiz.
 */
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000');

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error(
    '[Linguist] VITE_API_URL sozlanmagan. Vercel → Settings → Environment Variables ' +
      "ga uni qo'shing va deploymentni qayta ishga tushiring. Aks holda hech qanday " +
      "so'rov ishlamaydi."
  );
}

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
      /**
       * Sessiyani uzaytirib bo'lmadi.
       *
       * `NO_REFRESH_COOKIE` — refresh cookie brauzerga umuman yetib
       * bormagan. Frontend (vercel.app) va backend (onrender.com) turli
       * domenlarda bo'lgani uchun bu cookie UCHINCHI TOMON hisoblanadi va
       * brauzer uni bloklashi mumkin. Natijada foydalanuvchi har 15
       * daqiqada jimgina chiqarib yuboriladi va sababi hech qayerda
       * ko'rinmaydi.
       *
       * Doimiy yechim — ikkalasini bitta domen ostiga olib kelish
       * (masalan app.domen.uz va api.domen.uz). Hozircha kamida sababni
       * ko'rsatamiz.
       */
      if (refresh.error?.data?.code === 'NO_REFRESH_COOKIE') {
        console.error(
          '[Linguist] Refresh cookie yetib kelmadi. Frontend va backend turli ' +
            'domenlarda bo\'lgani uchun brauzer uni uchinchi tomon cookie sifatida ' +
            'bloklagan bo\'lishi mumkin. Brauzer sozlamalarida shu sayt uchun ' +
            'cookie\'larga ruxsat bering yoki ikkala xizmatni bitta domen ostiga oling.'
        );
        try {
          sessionStorage.setItem('linguist_auth_hint', 'third_party_cookie');
        } catch {
          // shaxsiy rejim — muhim emas
        }
      }
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
  tagTypes: ['Word', 'Challenge', 'Topic', 'User', 'Billing', 'Practice', 'Listening', 'Notifications', 'Push'],
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
    getListeningSession: builder.query({
      query: () => '/api/listening/session',
      providesTags: ['Listening'],
      keepUnusedDataFor: 300,
    }),
    checkDictation: builder.mutation({
      query: ({ lineIndex, typed }) => ({
        url: '/api/listening/check',
        method: 'POST',
        body: { lineIndex, typed },
      }),
    }),
    completeListening: builder.mutation({
      query: () => ({
        url: '/api/listening/complete',
        method: 'POST',
      }),
      invalidatesTags: ['Listening', 'User'],
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
    getPushStatus: builder.query({
      query: () => '/api/push/status',
      providesTags: ['Push'],
    }),
    getPushPublicKey: builder.query({
      query: () => '/api/push/public-key',
    }),
    subscribePush: builder.mutation({
      query: (body) => ({ url: '/api/push/subscribe', method: 'POST', body }),
      invalidatesTags: ['Push'],
    }),
    unsubscribePush: builder.mutation({
      query: (endpoint) => ({
        url: '/api/push/unsubscribe',
        method: 'POST',
        body: { endpoint },
      }),
      invalidatesTags: ['Push'],
    }),
    sendTestPush: builder.mutation({
      query: () => ({ url: '/api/push/test', method: 'POST' }),
    }),
    getNotificationPrefs: builder.query({
      query: () => '/api/notifications/preferences',
      providesTags: ['Notifications'],
    }),
    updateNotificationPrefs: builder.mutation({
      query: (body) => ({ url: '/api/notifications/preferences', method: 'PUT', body }),
      invalidatesTags: ['Notifications'],
    }),
    unsubscribe: builder.mutation({
      query: (token) => ({
        url: '/api/notifications/unsubscribe',
        method: 'POST',
        body: { token },
      }),
    }),
    startPlacement: builder.mutation({
      query: () => ({ url: '/api/placement/start', method: 'POST' }),
    }),
    answerPlacement: builder.mutation({
      query: (body) => ({ url: '/api/placement/answer', method: 'POST', body }),
      invalidatesTags: (result) => (result?.done ? ['User', 'Topic', 'Listening'] : []),
    }),
    getPlacementResult: builder.query({
      query: () => '/api/placement/result',
      providesTags: ['User'],
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
  useGetListeningSessionQuery,
  useCheckDictationMutation,
  useCompleteListeningMutation,
  useChatRoleplayMutation,
  useAskTeacherMutation,
  useGetCurrentChallengeQuery,
  useGetChallengeHistoryQuery,
  useCompleteChallengeMutation,
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetPushStatusQuery,
  useGetPushPublicKeyQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useSendTestPushMutation,
  useGetNotificationPrefsQuery,
  useUpdateNotificationPrefsMutation,
  useUnsubscribeMutation,
  useStartPlacementMutation,
  useAnswerPlacementMutation,
  useGetPlacementResultQuery,
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
