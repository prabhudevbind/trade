import { apiSlice } from './apiSlice';

export const contestApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Contest Endpoints
    getContests: builder.query({
      query: () => '/contests',
      providesTags: ['Contest'],
    }),
    getContestById: builder.query({
      query: (id) => `/contests/${id}`,
      providesTags: ['Contest'],
    }),
    createContest: builder.mutation({
      query: (contest) => ({
        url: '/contests',
        method: 'POST',
        body: contest,
      }),
      invalidatesTags: ['Contest'],
    }),
    updateContest: builder.mutation({
      query: ({ id, ...contest }) => ({
        url: `/contests/${id}`,
        method: 'PUT',
        body: contest,
      }),
      invalidatesTags: ['Contest'],
    }),
    deleteContest: builder.mutation({
      query: (id) => ({
        url: `/contests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Contest'],
    }),

    // ContestParticipant Endpoints
    getContestParticipants: builder.query({
      query: () => '/contest-participants',
      providesTags: ['ContestParticipant'],
    }),
    getContestParticipantById: builder.query({
      query: (id) => `/contest-participants/${id}`,
      providesTags: ['ContestParticipant'],
    }),
    createContestParticipant: builder.mutation({
      query: (participant) => ({
        url: '/contest-participants',
        method: 'POST',
        body: participant,
      }),
      invalidatesTags: ['ContestParticipant'],
    }),
    updateContestParticipant: builder.mutation({
      query: ({ id, ...participant }) => ({
        url: `/contest-participants/${id}`,
        method: 'PUT',
        body: participant,
      }),
      invalidatesTags: ['ContestParticipant'],
    }),
    deleteContestParticipant: builder.mutation({
      query: (id) => ({
        url: `/contest-participants/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ContestParticipant'],
    }),

    // Option Endpoints
  
    getOptionById: builder.query({
      query: (id) => `/options/${id}`,
      providesTags: ['Option'],
    }),
    createOption: builder.mutation({
      query: (option) => ({
        url: '/options',
        method: 'POST',
        body: option,
      }),
      invalidatesTags: ['Option'],
    }),
    updateOption: builder.mutation({
      query: ({ id, ...option }) => ({
        url: `/options/${id}`,
        method: 'PUT',
        body: option,
      }),
      invalidatesTags: ['Option'],
    }),
    deleteOption: builder.mutation({
      query: (id) => ({
        url: `/options/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Option'],
    }),

    // Position Endpoints
    getPositions: builder.query({
      query: () => '/positions',
      providesTags: ['Position'],
    }),
    getPositionById: builder.query({
      query: (id) => `/positions/${id}`,
      providesTags: ['Position'],
    }),
    createPosition: builder.mutation({
      query: (position) => ({
        url: '/positions',
        method: 'POST',
        body: position,
      }),
      invalidatesTags: ['Position'],
    }),
    updatePosition: builder.mutation({
      query: ({ id, ...position }) => ({
        url: `/positions/${id}`,
        method: 'PUT',
        body: position,
      }),
      invalidatesTags: ['Position'],
    }),
    deletePosition: builder.mutation({
      query: (id) => ({
        url: `/positions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Position'],
    }),

    // Trade Endpoints
    getTrades: builder.query({
      query: () => '/trades',
      providesTags: ['Trade'],
    }),

    getMarketData: builder.query({
      query: () => '/trading-data',
      providesTags: ['MarketData'],
    }),
    getTradeById: builder.query({
      query: (id) => `/trades/${id}`,
      providesTags: ['Trade'],
    }),
    createTrade: builder.mutation({
      query: (trade) => ({
        url: '/trades',
        method: 'POST',
        body: trade,
      }),
      invalidatesTags: ['Trade'],
    }),
    updateTrade: builder.mutation({
      query: ({ id, ...trade }) => ({
        url: `/trades/${id}`,
        method: 'PUT',
        body: trade,
      }),
      invalidatesTags: ['Trade'],
    }),
    deleteTrade: builder.mutation({
      query: (id) => ({
        url: `/trades/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Trade'],
    }),

    // WalletTransaction Endpoints
    getWalletTransactions: builder.query({
      query: () => '/wallet-transactions',
      providesTags: ['WalletTransaction'],
    }),
    getWalletTransactionById: builder.query({
      query: (id) => `/wallet-transactions/${id}`,
      providesTags: ['WalletTransaction'],
    }),
    createWalletTransaction: builder.mutation({
      query: (transaction) => ({
        url: '/wallet-transactions',
        method: 'POST',
        body: transaction,
      }),
      invalidatesTags: ['WalletTransaction'],
    }),
    updateWalletTransaction: builder.mutation({
      query: ({ id, ...transaction }) => ({
        url: `/wallet-transactions/${id}`,
        method: 'PUT',
        body: transaction,
      }),
      invalidatesTags: ['WalletTransaction'],
    }),
    deleteWalletTransaction: builder.mutation({
      query: (id) => ({
        url: `/wallet-transactions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['WalletTransaction'],
    }),

    // ContestWinner Endpoints
    getContestWinners: builder.query({
      query: () => '/contest-winners',
      providesTags: ['ContestWinner'],
    }),
    getContestWinnerById: builder.query({
      query: (id) => `/contest-winners/${id}`,
      providesTags: ['ContestWinner'],
    }),
    createContestWinner: builder.mutation({
      query: (winner) => ({
        url: '/contest-winners',
        method: 'POST',
        body: winner,
      }),
      invalidatesTags: ['ContestWinner'],
    }),
    updateContestWinner: builder.mutation({
      query: ({ id, ...winner }) => ({
        url: `/contest-winners/${id}`,
        method: 'PUT',
        body: winner,
      }),
      invalidatesTags: ['ContestWinner'],
    }),
    deleteContestWinner: builder.mutation({
      query: (id) => ({
        url: `/contest-winners/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ContestWinner'],
    }),

    // Referral Endpoints
    getReferrals: builder.query({
      query: () => '/referrals',
      providesTags: ['Referral'],
    }),
    getReferralById: builder.query({
      query: (id) => `/referrals/${id}`,
      providesTags: ['Referral'],
    }),
    createReferral: builder.mutation({
      query: (referral) => ({
        url: '/referrals',
        method: 'POST',
        body: referral,
      }),
      invalidatesTags: ['Referral'],
    }),
    updateReferral: builder.mutation({
      query: ({ id, ...referral }) => ({
        url: `/referrals/${id}`,
        method: 'PUT',
        body: referral,
      }),
      invalidatesTags: ['Referral'],
    }),
    deleteReferral: builder.mutation({
      query: (id) => ({
        url: `/referrals/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Referral'],
    }),
  }),
});

export const {
  // Contest Hooks
  useGetContestsQuery,
  useGetContestByIdQuery,
  useCreateContestMutation,
  useUpdateContestMutation,
  useDeleteContestMutation,
  // ContestParticipant Hooks
  useGetContestParticipantsQuery,
  useGetContestParticipantByIdQuery,
  useCreateContestParticipantMutation,
  useUpdateContestParticipantMutation,
  useDeleteContestParticipantMutation,
  // Option Hooks
  // useGetOptionsQuery,
  useGetOptionByIdQuery,
  useCreateOptionMutation,
  useUpdateOptionMutation,
  useDeleteOptionMutation,
  // Position Hooks
  useGetPositionsQuery,
  useGetPositionByIdQuery,
  useCreatePositionMutation,
  useUpdatePositionMutation,
  useDeletePositionMutation,
  // Trade Hooks
  useGetTradesQuery,
  useGetTradeByIdQuery,
  useCreateTradeMutation,
  useUpdateTradeMutation,
  useDeleteTradeMutation,

  useGetMarketDataQuery,
  // WalletTransaction Hooks
  useGetWalletTransactionsQuery,
  useGetWalletTransactionByIdQuery,
  useCreateWalletTransactionMutation,
  useUpdateWalletTransactionMutation,
  useDeleteWalletTransactionMutation,
  // ContestWinner Hooks
  useGetContestWinnersQuery,
  useGetContestWinnerByIdQuery,
  useCreateContestWinnerMutation,
  useUpdateContestWinnerMutation,
  useDeleteContestWinnerMutation,
  // Referral Hooks
  useGetReferralsQuery,
  useGetReferralByIdQuery,
  useCreateReferralMutation,
  useUpdateReferralMutation,
  useDeleteReferralMutation,
} = contestApi;