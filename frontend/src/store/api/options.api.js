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
  }),
});

export const { useGetOptionsQuery } = optionApi;