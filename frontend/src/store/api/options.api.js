import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1", // Adjust based on your backend base URL
  }),
  tagTypes: ["Options"],
  endpoints: () => ({}),
});

export const optionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOptions: builder.query({
      query: ({ expiry_date, instrument_key = "NSE_INDEX|Nifty 50" }) => ({
        url: "/option-chain",
        params: { expiry_date, instrument_key },
      }),
      providesTags: ["Options"],
    }),
    getOptionDetails: builder.query({
      query: ({ instrument_key, interval = '1minute', days = 30, type = 'call', strike }) => ({
        url: `/option-details/${instrument_key}`,
        params: { interval, days, type, strike },
      }),
      providesTags: ['OptionDetails'],
    }),

    // Fetch available intervals and their limits
    getIntervals: builder.query({
      query: () => '/option-details/info/intervals',
      providesTags: ['Intervals'],
    }),

    // Fetch current market data for an option
    getCurrentMarketData: builder.query({
      query: ({ instrument_key }) => `/option-details/${instrument_key}/current`,
      providesTags: ['CurrentMarketData'],
    }),
    
  }),
});

export const { useGetOptionsQuery,useGetOptionDetailsQuery,
  useGetIntervalsQuery,
  useGetCurrentMarketDataQuery, } = optionApi;