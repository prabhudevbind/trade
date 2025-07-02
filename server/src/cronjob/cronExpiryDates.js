const cron = require("node-cron");
const axios = require("axios");

const PORT = process.env.PORT || 5001;

// List of instrument keys to fetch expiry dates for
const EXPIRY_INSTRUMENTS = [
  "NSE_INDEX|Nifty 50",
  "NSE_INDEX|Nifty Bank",
  "NSE_INDEX|Nifty Fin Service",
];

// Function to fetch expiry dates for all instruments
async function fetchAndCacheExpiryDates() {
  for (const instrumentKey of EXPIRY_INSTRUMENTS) {
    try {
      const url = `http://localhost:${PORT}/api/v1/available-expiry-dates?instrument_key=${encodeURIComponent(
        instrumentKey
      )}`;
      await axios.get(url);
      // Optionally add logging here
    } catch (err) {
      // Optionally add error logging here
    }
  }
}

// Schedule the cron job to run every day at 6:00 AM
cron.schedule("0 6 * * *", fetchAndCacheExpiryDates, {
  timezone: "Asia/Kolkata",
});

module.exports = {};