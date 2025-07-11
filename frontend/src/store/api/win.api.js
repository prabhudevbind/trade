import { apiSlice } from './apiSlice';

export const winApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get all winning history (no filters)
    getAllWinningHistory: builder.query({
      query: () => '/leaderboard/all-winning-history',
    }),
    // Get all winning history, optionally filtered by date range
    getWinningHistory: builder.query({
      query: ({ startDate, endDate } = {}) => {
        let url = '/leaderboard/winning-history';
        const params = [];
        if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
        if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
        if (params.length) url += `?${params.join('&')}`;
        return url;
      },
    }),
    // Get winning history for a user, optionally filtered by date range
    getUserWinningHistory: builder.query({
      query: ({ userId, startDate, endDate }) => {
        let url = `/leaderboard/user/${userId}/winning-history`;
        const params = [];
        if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
        if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
        if (params.length) url += `?${params.join('&')}`;
        return url;
      },
    }),
  }),
});

export const {
  useGetAllWinningHistoryQuery,
  useGetWinningHistoryQuery,
  useGetUserWinningHistoryQuery,
} = winApi;