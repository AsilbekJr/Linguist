import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, logout } from '../auth/authSlice';
import { createSessionQuery } from './sessionQuery';

import { API_URL } from '../../lib/apiUrl';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: 'include',
  timeout: 60000,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const { baseQuery: baseQueryWithReauth, refreshAccessToken } = createSessionQuery(rawBaseQuery, {
  credentials: setCredentials,
  logout,
  onMissingCookie: () => {
    try {
      sessionStorage.setItem('linguist_auth_hint', 'third_party_cookie');
    } catch {
      // Private browsing may disable storage.
    }
  },
});
export const apiSlice = createApi({
  reducerPath: 'api',
  keepUnusedDataFor: 180,
  refetchOnMountOrArgChange: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Word', 'Phrase', 'Topic', 'User', 'Billing', 'Listening', 'Notifications', 'Push', 'Telegram', 'VocabTopic', 'Speak'],
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
      invalidatesTags: ['Word', 'Topic', 'User'],
    }),
    previewWord: builder.mutation({
      query: (body) => ({ url: '/api/words/preview', method: 'POST', body }),
    }),
    getPhrases: builder.query({
      query: () => '/api/review/phrases',
      providesTags: ['Word', 'Phrase'],
    }),
    addPhrase: builder.mutation({
      query: (body) => ({ url: '/api/review/phrases', method: 'POST', body }),
      invalidatesTags: ['Phrase', 'User'],
    }),
    translatePhrase: builder.mutation({
      query: (body) => ({ url: '/api/review/phrases/translate', method: 'POST', body }),
    }),
    deleteWord: builder.mutation({
      query: (id) => ({
        url: `/api/words/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Word', 'User'],
    }),
    /** Ta'rifsiz qolgan so'zni tuzatish — tarmoq uzilganda qo'shilganlar uchun */
    refreshWord: builder.mutation({
      query: (id) => ({
        url: `/api/words/${id}/refresh`,
        method: 'POST',
      }),
      invalidatesTags: ['Word'],
    }),
    /** Sahnada yodlangan iboralar — o'zbekcha ma'nodan butun gapni aytish */
    getPhrasesDue: builder.query({
      query: () => '/api/review/phrases/due',
      providesTags: ['Word', 'Phrase'],
      keepUnusedDataFor: 60,
    }),
    checkPhrase: builder.mutation({
      query: ({ id, answer, source }) => ({ url: `/api/review/phrases/${id}/check`, method: 'POST', body: { answer, source } }),
      invalidatesTags: ['Phrase', 'User'],
    }),
    getReviewDue: builder.query({
      query: () => '/api/review/due',
      providesTags: ['Word'],
      keepUnusedDataFor: 60,
    }),
    /** Gap tekshiruvi — yozma yoki mikrofon transkripti */
    checkReview: builder.mutation({
      // mode: 'recognize' | 'recall' | 'sentence' — qaysi biri kerakligini server
      // `/review/due` javobida aytadi; boshqasi yuborilsa 409 MODE_MISMATCH
      query: ({ id, mode = 'sentence', answer, sentence, source }) => ({
        url: `/api/review/${id}/check`,
        method: 'POST',
        body: mode === 'sentence' ? { mode, sentence, source } : { mode, answer, source },
        ...(mode === 'recognize' ? { timeout: 20000 } : {}),
      }),
      invalidatesTags: ['Word', 'User'],
    }),
    /**
     * Tarjimasiz so'zga o'zbekcha tarjima. Javobda shu so'zning yangi topshirig'i
     * (`item`) keladi. Teg yangilanmaydi: "Bugun" sessiyasi o'z nusxasi bilan
     * davom etadi, lug'at esa keyingi tekshiruvdan keyin yangilanadi.
     */
    saveReviewTranslation: builder.mutation({
      query: ({ id, translation }) => ({
        url: `/api/review/${id}/translation`,
        method: 'POST',
        body: { translation },
      }),
    }),
    /** "Bilaman": so'zni takrorlashsiz yodlanganlarga o'tkazish (relearn bilan qaytariladi) */
    markWordKnown: builder.mutation({
      query: (id) => ({
        url: `/api/review/${id}/known`,
        method: 'POST',
      }),
      invalidatesTags: ['Word', 'User'],
    }),
    /** Yodlangan so'zni qayta yodlashga qaytarish (4-bosqichdan) */
    relearnWord: builder.mutation({
      query: (id) => ({
        url: `/api/review/${id}/relearn`,
        method: 'POST',
      }),
      invalidatesTags: ['Word', 'User'],
    }),
    /** Gapni ega/kesim va so'z turkumlariga ajratib tushuntirish */
    analyzeSentence: builder.mutation({
      query: (sentence) => ({
        url: '/api/analysis/sentence',
        method: 'POST',
        body: { sentence },
      }),
      invalidatesTags: ['User'],
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
    getCurrentTopic: builder.query({
      query: () => '/api/topics/current',
      providesTags: ['Topic'],
      keepUnusedDataFor: 300,
    }),
    /** "Sizning so'zlaringiz": lug'atdagi so'zlar bugungi mavzu gaplarida (mashq) */
    getActiveWords: builder.query({
      query: () => '/api/topics/active-words',
      providesTags: ['Topic'],
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
    getTelegramStatus: builder.query({
      query: () => '/api/telegram/status',
      providesTags: ['Telegram'],
    }),
    createTelegramLink: builder.mutation({
      query: () => ({ url: '/api/telegram/link', method: 'POST' }),
    }),
    unlinkTelegram: builder.mutation({
      query: () => ({ url: '/api/telegram/link', method: 'DELETE' }),
      invalidatesTags: ['Telegram'],
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
    getVocabTopics: builder.query({
      query: () => '/api/vocab-topics',
      providesTags: ['VocabTopic', 'Word'],
    }),
    getVocabTopic: builder.query({
      query: (id) => `/api/vocab-topics/${id}`,
      providesTags: (result, error, id) => [{ type: 'VocabTopic', id }, 'Word'],
    }),
    // words berilmasa — mavzudagi hamma so'z qo'shiladi
    addVocabTopicWords: builder.mutation({
      query: ({ id, words }) => ({
        url: `/api/vocab-topics/${id}/add`,
        method: 'POST',
        body: words ? { words } : {},
      }),
      invalidatesTags: (result, error, { id }) => ['VocabTopic', { type: 'VocabTopic', id }, 'Word', 'User'],
    }),
    /** "Bilaman": kutubxona so'zlarini yodlangan holda lug'atga qo'shish/o'tkazish */
    markVocabTopicKnown: builder.mutation({
      query: ({ id, words }) => ({
        url: `/api/vocab-topics/${id}/known`,
        method: 'POST',
        body: { words },
      }),
      invalidatesTags: (result, error, { id }) => ['VocabTopic', { type: 'VocabTopic', id }, 'Word', 'User'],
    }),
    startPlacement: builder.mutation({
      query: () => ({ url: '/api/placement/start', method: 'POST' }),
    }),
    answerPlacement: builder.mutation({
      query: (body) => ({ url: '/api/placement/answer', method: 'POST', body }),
      invalidatesTags: (result) => (result?.done ? ['User', 'Topic', 'Listening'] : []),
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
    verifyEmail: builder.mutation({
      query: (token) => ({
        url: '/api/auth/verify-email',
        method: 'POST',
        body: { token },
      }),
      // Banner yo'qolishi uchun profil qayta olinadi
      invalidatesTags: ['User'],
    }),
    resendVerification: builder.mutation({
      query: () => ({
        url: '/api/auth/resend-verification',
        method: 'POST',
      }),
    }),
    getMe: builder.query({
      query: () => '/api/auth/me',
      refetchOnMountOrArgChange: true,
      providesTags: ['User'],
      keepUnusedDataFor: 300,
    }),
    onboardUser: builder.mutation({
      query: (data) => ({
        url: '/api/auth/onboard',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
    /** Ism, daraja, maqsad, reja — faqat yuborilgan maydonlar o'zgaradi */
    updateProfile: builder.mutation({
      query: (body) => ({ url: '/api/auth/profile', method: 'PATCH', body }),
      // Reja kunlik so'zlar sonini, daraja esa sahnani o'zgartiradi
      invalidatesTags: ['User', 'Topic'],
    }),
    /** Boshqa qurilmalardagi sessiyalar yopiladi; javobda joriy qurilma uchun yangi token */
    changePassword: builder.mutation({
      query: (body) => ({ url: '/api/auth/change-password', method: 'POST', body }),
      // Google hisobida birinchi parol o'rnatilgach `hasPassword` o'zgaradi
      invalidatesTags: ['User'],
    }),
    /** `{ password }` — parolli hisob, `{ confirmEmail }` — Google (parolsiz) hisob */
    deleteAccount: builder.mutation({
      query: (body) => ({ url: '/api/auth/account', method: 'DELETE', body }),
    }),
    // ─── Suhbat ───────────────────────────────────────────────────────────
    getSpeakToday: builder.query({
      query: () => '/api/speak/today',
      providesTags: ['Speak', 'Topic'],
      keepUnusedDataFor: 60,
    }),
    startSpeak: builder.mutation({
      query: () => ({ url: '/api/speak/start', method: 'POST' }),
      invalidatesTags: ['Speak'],
    }),
    // Replika natijasi to'g'ridan-to'g'ri komponent holatiga yoziladi — har
    // gapdan keyin butun holatni qayta yuklash kechikish beradi
    speakTurn: builder.mutation({
      query: ({ id, text, via, seconds }) => ({ url: `/api/speak/${id}/turn`, method: 'POST', body: { text, via, seconds } }),
    }),
    speakHint: builder.mutation({
      query: (id) => ({ url: `/api/speak/${id}/hint`, method: 'POST' }),
    }),
    finishSpeak: builder.mutation({
      query: (id) => ({ url: `/api/speak/${id}/finish`, method: 'POST' }),
      invalidatesTags: ['Speak', 'User', 'Word'],
    }),
    googleLogin: builder.mutation({
      query: (credential) => ({ url: '/api/auth/google', method: 'POST', body: { credential } }),
    }),
    /**
     * Navbat bo'sh kunda "takrorlash" qadamini yopish. Server navbatni o'zi
     * tekshiradi — so'z qolgan bo'lsa 409 qaytaradi. (Eski `sync-quest`
     * mijozga ishonardi va olib tashlandi.)
     */
    completeReviewDay: builder.mutation({
      query: () => ({
        url: '/api/review/complete-day',
        method: 'POST',
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
      invalidatesTags: ['User', 'Topic', 'Word', 'Speak', 'Listening'],
    }),
    logoutSession: builder.mutation({
      query: () => ({
        url: '/api/auth/logout',
        method: 'POST',
      }),
    }),
    /** Ilova ochilganda sessiyani tiklash — natija `auth` holatiga yoziladi */
    restoreSession: builder.mutation({
      queryFn: async (_arg, api, extraOptions) => {
        const refresh = await refreshAccessToken(api, extraOptions);
        return refresh.data?.token ? { data: true } : { error: refresh.error || { status: 'CUSTOM_ERROR' } };
      },
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
  usePreviewWordMutation,
  useGetPhrasesQuery,
  useAddPhraseMutation,
  useTranslatePhraseMutation,
  useGetVocabTopicsQuery,
  useGetVocabTopicQuery,
  useAddVocabTopicWordsMutation,
  useMarkVocabTopicKnownMutation,
  useGetWordsQuery,
  useAddWordMutation,
  useDeleteWordMutation,
  useRefreshWordMutation,
  useCheckReviewMutation,
  useSaveReviewTranslationMutation,
  useRelearnWordMutation,
  useMarkWordKnownMutation,
  useAnalyzeSentenceMutation,
  useGetListeningSessionQuery,
  useCheckDictationMutation,
  useCompleteListeningMutation,
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetPushStatusQuery,
  useGetPushPublicKeyQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useSendTestPushMutation,
  useGetTelegramStatusQuery,
  useCreateTelegramLinkMutation,
  useUnlinkTelegramMutation,
  useGetNotificationPrefsQuery,
  useUpdateNotificationPrefsMutation,
  useUnsubscribeMutation,
  useStartPlacementMutation,
  useAnswerPlacementMutation,
  useGetMeQuery,
  useGetReviewDueQuery,
  useGetCurrentTopicQuery,
  useGetActiveWordsQuery,
  useStartTopicQuizMutation,
  useSubmitTopicQuizMutation,
  useFinishTopicDayMutation,
  useOnboardUserMutation,
  useCompleteReviewDayMutation,
  useGetPhrasesDueQuery,
  useCheckPhraseMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useDeleteAccountMutation,
  useSetTimezoneMutation,
  useLogoutSessionMutation,
  useRestoreSessionMutation,
  useVerifyEmailMutation,
  useGoogleLoginMutation,
  useGetSpeakTodayQuery,
  useStartSpeakMutation,
  useSpeakTurnMutation,
  useSpeakHintMutation,
  useFinishSpeakMutation,
  useResendVerificationMutation,
  useGetSubscriptionQuery,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
} = apiSlice;
