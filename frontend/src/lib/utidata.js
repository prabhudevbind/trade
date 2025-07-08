export const socketServerUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:5001"
        : "https://trade.stockverses.com";