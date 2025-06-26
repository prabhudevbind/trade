const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Constants for instrument keys
const INSTRUMENTS = [
  "NSE_INDEX|Nifty 50",
  "NSE_INDEX|Nifty Bank",
  "NSE_INDEX|Nifty Fin Service",
];

// --- Socket.IO Option Chain Streaming Handler ---
// Export a function to register with Socket.IO in server.js
function registerOptionChainSocket(io) {
  // Map: socket.id -> { interval, params }
  const optionChainIntervals = new Map();

  io.on('connection', (socket) => {
    // Subscribe to option chain
    socket.on('optionChain:subscribe', async ({ expiry_date, instrument_key = "NSE_INDEX|Nifty 50" }) => {
      if (!expiry_date) {
        socket.emit('optionChain:error', { success: false, message: 'expiry_date is required (format: YYYY-MM-DD)' });
        return;
      }
      // If already streaming for this socket, clear previous
      if (optionChainIntervals.has(socket.id)) {
        clearInterval(optionChainIntervals.get(socket.id).interval);
        optionChainIntervals.delete(socket.id);
      }
      // Start interval to fetch and emit data every 1s
      const interval = setInterval(async () => {
        try {
          const url = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(instrument_key)}&expiry_date=${expiry_date}`;
          const headers = {
            Accept: "application/json",
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          };
          const response = await axios.get(url, { headers });
          const optionChainData = response.data.data || [];
          if (optionChainData.length === 0) {
            socket.emit('optionChain:data', {
              success: false,
              message: 'No option chain data found for the given parameters',
              timestamp: new Date().toISOString()
            });
            return;
          }
          // Process and combine option chain data
          const processedData = optionChainData.map(strike => {
            const strikeData = {
              expiry: strike.expiry,
              strike_price: strike.strike_price,
              underlying_key: strike.underlying_key,
              underlying_spot_price: strike.underlying_spot_price,
              pcr: strike.pcr, // Put Call Ratio
              call_option: null,
              put_option: null
            };

            // Process Call Option Data
            if (strike.call_options) {
              const callMarketData = strike.call_options.market_data || {};
              const callGreeks = strike.call_options.option_greeks || {};
              
              // Convert OI to lots (assuming lot size of 50 for Nifty, adjust as needed)
              const lotSize = getLotSize(instrument_key);
              const callOILots = callMarketData.oi ? Math.round(callMarketData.oi / lotSize) : 0;
              const callPrevOILots = callMarketData.prev_oi ? Math.round(callMarketData.prev_oi / lotSize) : 0;
              const callOIChange = callOILots - callPrevOILots;

              strikeData.call_option = {
                instrument_key: strike.call_options.instrument_key,
                ltp: callMarketData.ltp || 0,
                volume: callMarketData.volume || 0,
                oi_quantity: callMarketData.oi || 0,
                oi_lots: callOILots,
                oi_change_lots: callOIChange,
                close_price: callMarketData.close_price || 0,
                bid_price: callMarketData.bid_price || 0,
                bid_qty: callMarketData.bid_qty || 0,
                ask_price: callMarketData.ask_price || 0,
                ask_qty: callMarketData.ask_qty || 0,
                greeks: {
                  delta: callGreeks.delta || 0,
                  gamma: callGreeks.gamma || 0,
                  theta: callGreeks.theta || 0,
                  vega: callGreeks.vega || 0,
                  iv: callGreeks.iv || 0,
                  pop: callGreeks.pop || 0
                }
              };
            }

            // Process Put Option Data
            if (strike.put_options) {
              const putMarketData = strike.put_options.market_data || {};
              const putGreeks = strike.put_options.option_greeks || {};
              
              // Convert OI to lots
              const lotSize = getLotSize(instrument_key);
              const putOILots = putMarketData.oi ? Math.round(putMarketData.oi / lotSize) : 0;
              const putPrevOILots = putMarketData.prev_oi ? Math.round(putMarketData.prev_oi / lotSize) : 0;
              const putOIChange = putOILots - putPrevOILots;

              strikeData.put_option = {
                instrument_key: strike.put_options.instrument_key,
                ltp: putMarketData.ltp || 0,
                volume: putMarketData.volume || 0,
                oi_quantity: putMarketData.oi || 0,
                oi_lots: putOILots,
                oi_change_lots: putOIChange,
                close_price: putMarketData.close_price || 0,
                bid_price: putMarketData.bid_price || 0,
                bid_qty: putMarketData.bid_qty || 0,
                ask_price: putMarketData.ask_price || 0,
                ask_qty: putMarketData.ask_qty || 0,
                greeks: {
                  delta: putGreeks.delta || 0,
                  gamma: putGreeks.gamma || 0,
                  theta: putGreeks.theta || 0,
                  vega: putGreeks.vega || 0,
                  iv: putGreeks.iv || 0,
                  pop: putGreeks.pop || 0
                }
              };
            }

            return strikeData;
          });

          // Sort by strike price
          processedData.sort((a, b) => a.strike_price - b.strike_price);

          // Calculate total OI and PCR
          const totalCallOI = processedData.reduce((sum, strike) => 
            sum + (strike.call_option?.oi_lots || 0), 0
          );
          const totalPutOI = processedData.reduce((sum, strike) => 
            sum + (strike.put_option?.oi_lots || 0), 0
          );
          const overallPCR = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 0;

          const streamData = {
            success: true,
            timestamp: new Date().toISOString(),
            underlying_info: {
              instrument_key: instrument_key,
              spot_price: processedData[0]?.underlying_spot_price || 0,
              expiry_date: expiry_date
            },
            summary: {
              total_strikes: processedData.length,
              total_call_oi_lots: totalCallOI,
              total_put_oi_lots: totalPutOI,
              overall_pcr: overallPCR
            },
            option_chain: processedData
          };

          socket.emit('optionChain:data', streamData);
        } catch (error) {
          let errorMessage = 'Failed to fetch option chain';
          if (error.response) {
            errorMessage = `API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
          }
          socket.emit('optionChain:error', {
            success: false,
            message: errorMessage,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }, 1000);
      optionChainIntervals.set(socket.id, { interval, params: { expiry_date, instrument_key } });
      socket.emit('optionChain:connected', { success: true, message: 'Connected to option chain stream', timestamp: new Date().toISOString() });
    });
    // Unsubscribe/cleanup
    socket.on('optionChain:unsubscribe', () => {
      if (optionChainIntervals.has(socket.id)) {
        clearInterval(optionChainIntervals.get(socket.id).interval);
        optionChainIntervals.delete(socket.id);
      }
      socket.emit('optionChain:disconnected', { success: true, message: 'Disconnected from option chain stream' });
    });
    socket.on('disconnect', () => {
      if (optionChainIntervals.has(socket.id)) {
        clearInterval(optionChainIntervals.get(socket.id).interval);
        optionChainIntervals.delete(socket.id);
      }
    });
  });
}

// Helper function to get lot size based on instrument
function getLotSize(instrumentKey) {
  // Common lot sizes for Indian markets
  const lotSizes = {
    "NSE_INDEX|Nifty 50": 50,
    "NSE_INDEX|Nifty Bank": 15,
    "NSE_INDEX|Nifty Fin Service": 40,
    "NSE_INDEX|Nifty IT": 50,
    "NSE_INDEX|Nifty Midcap Select": 75,
    // Add more instruments and their lot sizes as needed
  };
  
  return lotSizes[instrumentKey] || 50; // Default to 50 if not found
}

// Static endpoint to get single option chain snapshot
router.get("/option-chain", async (req, res) => {
  try {
    const { expiry_date, instrument_key = "NSE_INDEX|Nifty 50" } = req.query;

    if (!expiry_date) {
      return res.status(400).json({
        success: false,
        message: "expiry_date is required (format: YYYY-MM-DD)",
      });
    }

    const url = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(
      instrument_key
    )}&expiry_date=${expiry_date}`;
    
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    };

    const response = await axios.get(url, { headers });
    const optionChainData = response.data.data || [];

    if (optionChainData.length === 0) {
      return res.json({
        success: false,
        message: "No option chain data found for the given parameters",
      });
    }

    // Process data same as streaming version
    const processedData = optionChainData.map(strike => {
      const lotSize = getLotSize(instrument_key);
      
      const strikeData = {
        expiry: strike.expiry,
        strike_price: strike.strike_price,
        underlying_key: strike.underlying_key,
        underlying_spot_price: strike.underlying_spot_price,
        pcr: strike.pcr,
        call_option: null,
        put_option: null
      };

      if (strike.call_options) {
        const callMarketData = strike.call_options.market_data || {};
        const callGreeks = strike.call_options.option_greeks || {};
        const callOILots = callMarketData.oi ? Math.round(callMarketData.oi / lotSize) : 0;
        const callPrevOILots = callMarketData.prev_oi ? Math.round(callMarketData.prev_oi / lotSize) : 0;

        strikeData.call_option = {
          instrument_key: strike.call_options.instrument_key,
          ltp: callMarketData.ltp || 0,
          volume: callMarketData.volume || 0,
          oi_quantity: callMarketData.oi || 0,
          oi_lots: callOILots,
          oi_change_lots: callOILots - callPrevOILots,
          close_price: callMarketData.close_price || 0,
          bid_price: callMarketData.bid_price || 0,
          ask_price: callMarketData.ask_price || 0,
          greeks: {
            delta: callGreeks.delta || 0,
            gamma: callGreeks.gamma || 0,
            theta: callGreeks.theta || 0,
            vega: callGreeks.vega || 0,
            iv: callGreeks.iv || 0
          }
        };
      }

      if (strike.put_options) {
        const putMarketData = strike.put_options.market_data || {};
        const putGreeks = strike.put_options.option_greeks || {};
        const putOILots = putMarketData.oi ? Math.round(putMarketData.oi / lotSize) : 0;
        const putPrevOILots = putMarketData.prev_oi ? Math.round(putMarketData.prev_oi / lotSize) : 0;

        strikeData.put_option = {
          instrument_key: strike.put_options.instrument_key,
          ltp: putMarketData.ltp || 0,
          volume: putMarketData.volume || 0,
          oi_quantity: putMarketData.oi || 0,
          oi_lots: putOILots,
          oi_change_lots: putOILots - putPrevOILots,
          close_price: putMarketData.close_price || 0,
          bid_price: putMarketData.bid_price || 0,
          ask_price: putMarketData.ask_price || 0,
          greeks: {
            delta: putGreeks.delta || 0,
            gamma: putGreeks.gamma || 0,
            theta: putGreeks.theta || 0,
            vega: putGreeks.vega || 0,
            iv: putGreeks.iv || 0
          }
        };
      }

      return strikeData;
    });

    processedData.sort((a, b) => a.strike_price - b.strike_price);

    const totalCallOI = processedData.reduce((sum, strike) => 
      sum + (strike.call_option?.oi_lots || 0), 0
    );
    const totalPutOI = processedData.reduce((sum, strike) => 
      sum + (strike.put_option?.oi_lots || 0), 0
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      underlying_info: {
        instrument_key: instrument_key,
        spot_price: processedData[0]?.underlying_spot_price || 0,
        expiry_date: expiry_date
      },
      summary: {
        total_strikes: processedData.length,
        total_call_oi_lots: totalCallOI,
        total_put_oi_lots: totalPutOI,
        overall_pcr: totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 0
      },
      option_chain: processedData
    });

  } catch (error) {
    console.error("❌ Option Chain API Error:", error.message);
    
    let errorMessage = "Failed to fetch option chain";
    if (error.response) {
      errorMessage = `API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
    });
  }
});

// Add this function to find available expiry dates
async function findAvailableExpiryDates(instrumentKey) {
  const expiryDates = [];
  const today = new Date();
  
  // Try next 6 months of weekly expiries
  for (let i = 0; i < 250; i++) {
    // Add 7 days for each iteration
    const testDate = new Date(today);
    testDate.setDate(today.getDate() + (i * 1));
    
    // Format date as YYYY-MM-DD
    const formattedDate = testDate.toISOString().split('T')[0];
    
    try {
      const url = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(
        instrumentKey
      )}&expiry_date=${formattedDate}`;
      
      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      };

      const response = await axios.get(url, { headers });
      
      // If we get data, this is a valid expiry date
      if (response.data.data && response.data.data.length > 0) {
        expiryDates.push(formattedDate);
      }
    } catch (error) {
      // Skip failed requests
      continue;
    }
  }
  
  return expiryDates;
}

// Add this new endpoint to get expiry dates
router.get("/available-expiry-dates", async (req, res) => {
  try {
    const { instrument_key = "NSE_INDEX|Nifty 50" } = req.query;
    
    // Create the storage directory if it doesn't exist
    const storageDir = path.join(__dirname, './datas');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    const cacheFile = path.join(storageDir, `expiry_dates_${instrument_key.split('|')[1].toLowerCase().replace(/\s/g, '_')}.json`);
    
    // Check if we have cached data from today
    if (fs.existsSync(cacheFile)) {
      const cachedData = JSON.parse(fs.readFileSync(cacheFile));
      const cacheDate = new Date(cachedData.timestamp);
      const today = new Date();
      
      // Use cache if it's from today
      if (cacheDate.toDateString() === today.toDateString()) {
        return res.json({
          success: true,
          instrument_key: instrument_key,
          expiry_dates: cachedData.expiry_dates
        });
      }
    }
    
    // Find available expiry dates
    const expiryDates = await findAvailableExpiryDates(instrument_key);
    
    // Cache the results
    fs.writeFileSync(cacheFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      expiry_dates: expiryDates
    }));
    
    res.json({
      success: true,
      instrument_key: instrument_key,
      expiry_dates: expiryDates
    });

  } catch (error) {
    console.error("❌ Error fetching expiry dates:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expiry dates",
      error: error.message
    });
  }
});

module.exports = router;
module.exports.registerOptionChainSocket = registerOptionChainSocket;