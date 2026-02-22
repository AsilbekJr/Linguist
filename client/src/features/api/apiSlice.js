import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ['Word'],
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

    translateSpeaking: builder.mutation({
      query: (text) => ({
        url: '/api/speaking/translate',
        method: 'POST',
        body: { text },
      }),
    }),
    evaluateSpeaking: builder.mutation({
      query: ({ targetSentence, spokenText }) => ({
        url: '/api/speaking/evaluate',
        method: 'POST',
        body: { targetSentence, spokenText },
      }),
    }),
  }),
});

export const {
  useGetWordsQuery,
  useAddWordMutation,
  useDeleteWordMutation,
  useTranslateSpeakingMutation,
  useEvaluateSpeakingMutation,
} = apiSlice;
