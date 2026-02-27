import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ 
    baseUrl: API_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Word', 'Challenge', 'Topic'],
  endpoints: (builder) => ({
    getWords: builder.query({
      query: () => '/api/words',
      providesTags: ['Word'],
    }),
    addWord: builder.mutation({
      query: (initialWord) => ({
        url: '/api/words',
        method: 'POST',
        body: initialWord,
      }),
      invalidatesTags: ['Word'],
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
    }),
    checkReview: builder.mutation({
      query: ({ id, sentence }) => ({
        url: `/api/review/${id}/check`,
        method: 'POST',
        body: { sentence },
      }),
      invalidatesTags: ['Word'],
    }),

    translateSpeaking: builder.mutation({
      query: (text) => ({
        url: '/api/speaking/translate',
        method: 'POST',
        body: { text },
      }),
    }),
    translateText: builder.mutation({
      query: (data) => ({
        url: '/api/speaking/translate-text',
        method: 'POST',
        body: data,
      }),
    }),
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
    getCurrentChallenge: builder.query({
      query: () => '/api/challenge/current',
      providesTags: ['Challenge'],
    }),
    getChallengeHistory: builder.query({
      query: () => '/api/challenge/history',
      providesTags: ['Challenge'],
    }),
    completeChallenge: builder.mutation({
      query: (data) => ({
        url: '/api/challenge/complete',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Challenge'],
    }),

    // Topic Vocab
    getCurrentTopic: builder.query({
      query: () => '/api/topics/current',
      providesTags: ['Topic'],
    }),
    completeTopic: builder.mutation({
      query: () => ({
        url: '/api/topics/complete',
        method: 'POST',
      }),
      invalidatesTags: ['Topic'],
    }),

    // Auth
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
    getMe: builder.query({
      query: () => '/api/auth/me',
    }),
    onboardUser: builder.mutation({
      query: (data) => ({
        url: '/api/auth/onboard',
        method: 'POST',
        body: data,
      }),
    }),
    syncDailyQuest: builder.mutation({
      query: (data) => ({
        url: '/api/auth/sync-quest',
        method: 'POST',
        body: data,
      }),
    }),
  }),
});

export const {
  useGetWordsQuery,
  useAddWordMutation,
  useDeleteWordMutation,
  useCheckReviewMutation,
  useTranslateSpeakingMutation,
  useTranslateTextMutation,
  useEvaluateSpeakingMutation,
  useChatRoleplayMutation,
  useGetCurrentChallengeQuery,
  useGetChallengeHistoryQuery,
  useCompleteChallengeMutation,
  useLoginMutation,
  useRegisterMutation,
  useGetMeQuery,
  useGetReviewDueQuery,
  useGetCurrentTopicQuery,
  useCompleteTopicMutation,
  useOnboardUserMutation,
  useSyncDailyQuestMutation,
} = apiSlice;
