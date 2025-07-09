const express = require("express");
const axios = require("axios");
const Redis = require("ioredis");
const router = express.Router();

// Enhanced Redis client with connection pooling and clustering support
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null,
});

// Redis pub/sub client for real-time updates
const redisPublisher = redisClient.duplicate();
const redisSubscriber = redisClient.duplicate();

// Constants
const INSTRUMENTS = [
  "NSE_INDEX|Nifty 50",
  "NSE_INDEX|Nifty Bank",
  "NSE_INDEX|Nifty Fin Service",
];

const CACHE_CONFIG = {
  OPTION_CHAIN_TTL: 3000, // 30 seconds for live data
  PROCESSED_DATA_TTL: 5, // 5 seconds for processed data
  RATE_LIMIT_TTL: 60, // 1 minute for rate limiting
  EXPIRY_DATES_TTL: 3600, // 1 hour for expiry dates
  HISTORICAL_DATA_TTL: 86400, // 24 hours for historical data
  TICK_DATA_TTL: 300, // 5 minutes for tick data
};

// Rate limiting and API optimization
const API_RATE_LIMITER = {
  calls: 0,
  resetTime: Date.now() + 60000, // Reset every minute
  maxCalls: 60, // 60 calls per minute per instrument
};

// Global state management for API calls
const globalApiState = new Map();

// Add at the top of the file
let nextAllowedApiCallTime = 0;
const API_BACKOFF_MS = 2 * 60 * 1000; // 5 minutes

// Enhanced data storage functions
async function saveOptionChainToRedis(instrumentKey, expiryDate, optionChainData) {
  try {
    const timestamp = new Date().toISOString();
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Create multiple storage keys for different purposes
    const keys = {
      // Current live data
      current: `option_chain:current:${instrumentKey}:${expiryDate}`,
      
      // Historical data by date
      historical: `option_chain:historical:${instrumentKey}:${expiryDate}:${dateKey}`,
      
      // Tick data for detailed analysis
      tick: `option_chain:tick:${instrumentKey}:${expiryDate}:${Date.now()}`,
      
      // Strike-wise data for quick lookup
      strikes: `option_chain:strikes:${instrumentKey}:${expiryDate}`,
      
      // Summary data
      summary: `option_chain:summary:${instrumentKey}:${expiryDate}`,
      
      // Time series data
      timeseries: `option_chain:timeseries:${instrumentKey}:${expiryDate}:${dateKey}`,
    };

    // Use Redis pipeline for better performance
    const pipeline = redisClient.pipeline();

    // 1. Save current data
    pipeline.setex(keys.current, CACHE_CONFIG.OPTION_CHAIN_TTL, JSON.stringify(optionChainData));

    // 2. Save historical data (daily retention)
    pipeline.setex(keys.historical, CACHE_CONFIG.HISTORICAL_DATA_TTL, JSON.stringify(optionChainData));

    // 3. Save tick data for detailed analysis
    pipeline.setex(keys.tick, CACHE_CONFIG.TICK_DATA_TTL, JSON.stringify({
      timestamp,
      data: optionChainData,
      market_status: getMarketStatus(),
    }));

    // 4. Save strike-wise data for quick lookup
    const strikeData = {};
    optionChainData.option_chain.forEach(strike => {
      strikeData[strike.strike_price] = {
        call: strike.call_option,
        put: strike.put_option,
        underlying_spot: strike.underlying_spot_price,
        timestamp
      };
    });
    pipeline.setex(keys.strikes, CACHE_CONFIG.PROCESSED_DATA_TTL, JSON.stringify(strikeData));

    // 5. Save summary data
    const summaryData = {
      ...optionChainData.summary,
      underlying_info: optionChainData.underlying_info,
      timestamp,
      total_volume: calculateTotalVolume(optionChainData.option_chain),
      max_pain: calculateMaxPain(optionChainData.option_chain),
      atm_strike: findATMStrike(optionChainData.option_chain),
    };
    pipeline.setex(keys.summary, CACHE_CONFIG.PROCESSED_DATA_TTL, JSON.stringify(summaryData));

    // 6. Add to time series data (for charts and analysis)
    const timeSeriesData = {
      timestamp,
      spot_price: optionChainData.underlying_info.spot_price,
      total_call_oi: optionChainData.summary.total_call_oi_lots,
      total_put_oi: optionChainData.summary.total_put_oi_lots,
      pcr: optionChainData.summary.overall_pcr,
    };
    
    // Add to sorted set for time-based queries
    pipeline.zadd(keys.timeseries, Date.now(), JSON.stringify(timeSeriesData));
    
    // Keep only last 24 hours of time series data
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    pipeline.zremrangebyscore(keys.timeseries, 0, oneDayAgo);

    // 7. Save individual strike data for granular analysis
    for (const strike of optionChainData.option_chain) {
      const strikeKey = `option_chain:strike:${instrumentKey}:${expiryDate}:${strike.strike_price}`;
      const strikeTimeSeries = `option_chain:strike_ts:${instrumentKey}:${expiryDate}:${strike.strike_price}`;
      
      // Current strike data
      pipeline.setex(strikeKey, CACHE_CONFIG.PROCESSED_DATA_TTL, JSON.stringify(strike));
      
      // Strike time series
      const strikeTimeData = {
        timestamp,
        call_ltp: strike.call_option?.ltp || 0,
        put_ltp: strike.put_option?.ltp || 0,
        call_oi: strike.call_option?.oi_lots || 0,
        put_oi: strike.put_option?.oi_lots || 0,
        call_volume: strike.call_option?.volume || 0,
        put_volume: strike.put_option?.volume || 0,
      };
      
      pipeline.zadd(strikeTimeSeries, Date.now(), JSON.stringify(strikeTimeData));
      pipeline.zremrangebyscore(strikeTimeSeries, 0, oneDayAgo);
    }

    // 8. Update instrument metadata
    const metadataKey = `option_chain:metadata:${instrumentKey}`;
    const metadata = {
      last_updated: timestamp,
      available_expiries: await getAvailableExpiries(instrumentKey),
      active_strikes: optionChainData.option_chain.length,
      data_source: 'upstox_api',
    };
    pipeline.setex(metadataKey, CACHE_CONFIG.EXPIRY_DATES_TTL, JSON.stringify(metadata));

    // Execute all operations
    await pipeline.exec();

    // console.log(`✅ Option chain data saved to Redis for ${instrumentKey} ${expiryDate}`);
    
    // Also save to backup storage (optional)
    // await saveToBackupStorage(instrumentKey, expiryDate, optionChainData);

    return true;
  } catch (error) {
    console.error("❌ Error saving option chain data to Redis:", error);
    return false;
  }
}

// Enhanced data retrieval functions
async function getOptionChainFromRedis(instrumentKey, expiryDate, dataType = 'current') {
  try {
    let key;
    
    switch (dataType) {
      case 'current':
        key = `option_chain:current:${instrumentKey}:${expiryDate}`;
        break;
      case 'historical':
        const dateKey = new Date().toISOString().split('T')[0];
        key = `option_chain:historical:${instrumentKey}:${expiryDate}:${dateKey}`;
        break;
      case 'summary':
        key = `option_chain:summary:${instrumentKey}:${expiryDate}`;
        break;
      case 'strikes':
        key = `option_chain:strikes:${instrumentKey}:${expiryDate}`;
        break;
      default:
        key = `option_chain:current:${instrumentKey}:${expiryDate}`;
    }

    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("❌ Error retrieving option chain data from Redis:", error);
    return null;
  }
}

// Get time series data for charts
async function getTimeSeriesData(instrumentKey, expiryDate, hours = 24) {
  try {
    const key = `option_chain:timeseries:${instrumentKey}:${expiryDate}:${new Date().toISOString().split('T')[0]}`;
    const hoursAgo = Date.now() - (hours * 60 * 60 * 1000);
    
    const data = await redisClient.zrangebyscore(key, hoursAgo, '+inf', 'WITHSCORES');
    
    const timeSeries = [];
    for (let i = 0; i < data.length; i += 2) {
      timeSeries.push({
        ...JSON.parse(data[i]),
        score: data[i + 1]
      });
    }
    
    return timeSeries;
  } catch (error) {
    console.error("❌ Error retrieving time series data:", error);
    return [];
  }
}

// Helper functions for calculations
function calculateTotalVolume(optionChain) {
  return optionChain.reduce((total, strike) => {
    const callVolume = strike.call_option?.volume || 0;
    const putVolume = strike.put_option?.volume || 0;
    return total + callVolume + putVolume;
  }, 0);
}

function calculateMaxPain(optionChain) {
  let maxPain = 0;
  let minPain = Infinity;
  
  optionChain.forEach(strike => {
    const strikePrice = strike.strike_price;
    let totalPain = 0;
    
    optionChain.forEach(s => {
      const callOI = s.call_option?.oi_lots || 0;
      const putOI = s.put_option?.oi_lots || 0;
      
      if (strikePrice > s.strike_price) {
        totalPain += callOI * (strikePrice - s.strike_price);
      } else if (strikePrice < s.strike_price) {
        totalPain += putOI * (s.strike_price - strikePrice);
      }
    });
    
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPain = strikePrice;
    }
  });
  
  return maxPain;
}

function findATMStrike(optionChain) {
  if (optionChain.length === 0) return 0;
  
  const spotPrice = optionChain[0].underlying_spot_price;
  let closestStrike = optionChain[0].strike_price;
  let minDiff = Math.abs(spotPrice - closestStrike);
  
  optionChain.forEach(strike => {
    const diff = Math.abs(spotPrice - strike.strike_price);
    if (diff < minDiff) {
      minDiff = diff;
      closestStrike = strike.strike_price;
    }
  });
  
  return closestStrike;
}

function getMarketStatus() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();
  
  // Market hours: 9:15 AM to 3:30 PM, Monday to Friday
  const isWeekday = day >= 1 && day <= 5;
  const isMarketTime = (hours === 9 && minutes >= 15) || 
                      (hours > 9 && hours < 15) || 
                      (hours === 15 && minutes <= 30);
  
  if (isWeekday && isMarketTime) {
    return 'OPEN';
  } else if (isWeekday && ((hours === 9 && minutes < 15) || (hours < 9))) {
    return 'PRE_OPEN';
  } else if (isWeekday && hours > 15) {
    return 'CLOSED';
  } else {
    return 'HOLIDAY';
  }
}

// Backup storage function
async function saveToBackupStorage(instrumentKey, expiryDate, data) {
  try {
    const backupKey = `backup:option_chain:${instrumentKey}:${expiryDate}}`;
    await redisClient.setex(backupKey, 7 * 24 * 60 * 60, JSON.stringify(data)); // 7 days retention
  } catch (error) {
    console.error("❌ Error saving backup data:", error);
  }
}

// Enhanced Socket.IO implementation with Redis data storage
function registerOptionChainSocket(io) {
  const activeSubscriptions = new Map();
  const API_INTERVAL_MS = 1000;

  // Redis subscriber for broadcasting updates
  redisSubscriber.on('message', (channel, message) => {
    if (channel.startsWith('option_chain_update:')) {
      const [, instrumentKey, expiryDate] = channel.split(':');
      const key = `${instrumentKey}|${expiryDate}`;
      
      if (activeSubscriptions.has(key)) {
        const data = JSON.parse(message);
        // Broadcast to all clients subscribed to this key
        for (const socketId of activeSubscriptions.get(key).clients) {
          io.to(socketId).emit("optionChain:data", data);
        }
      }
    }
  });

  io.on("connection", (socket) => {
    console.log(`📡 Client connected: ${socket.id}`);

    socket.on("optionChain:subscribe", async ({ expiry_date, instrument_key = "NSE_INDEX|Nifty 50" }) => {
      try {
        if (!expiry_date) {
          socket.emit("optionChain:error", {
            success: false,
            message: "expiry_date is required (format: YYYY-MM-DD)",
          });
          return;
        }

        const subscriptionKey = `${instrument_key}|${expiry_date}`;
        
        // Add client to subscription
        if (!activeSubscriptions.has(subscriptionKey)) {
          activeSubscriptions.set(subscriptionKey, {
            clients: new Set(),
            interval: null,
            lastApiCall: 0,
            isActive: false
          });
        }
        
        const subscription = activeSubscriptions.get(subscriptionKey);
        subscription.clients.add(socket.id);

        // Subscribe to Redis pub/sub channel
        await redisSubscriber.subscribe(`option_chain_update:${instrument_key}:${expiry_date}`);

        // Send cached data immediately if available
        const cachedData = await getOptionChainFromRedis(instrument_key, expiry_date);
        if (cachedData) {
          socket.emit("optionChain:data", cachedData);
        }

        // Start API polling if not already active
        if (!subscription.isActive) {
          subscription.isActive = true;
          startApiPolling(instrument_key, expiry_date, subscriptionKey);
        }

        socket.emit("optionChain:subscribed", {
          success: true,
          message: "Successfully subscribed to option chain updates",
          instrument_key,
          expiry_date,
          clients_count: subscription.clients.size
        });

      } catch (error) {
        console.error("❌ Subscription error:", error);
        socket.emit("optionChain:error", {
          success: false,
          message: error.message,
        });
      }
    });

    // Add endpoint to get historical data
    socket.on("optionChain:getHistorical", async ({ expiry_date, instrument_key = "NSE_INDEX|Nifty 50", hours = 24 }) => {
      try {
        const timeSeriesData = await getTimeSeriesData(instrument_key, expiry_date, hours);
        socket.emit("optionChain:historicalData", {
          success: true,
          data: timeSeriesData,
          instrument_key,
          expiry_date
        });
      } catch (error) {
        socket.emit("optionChain:error", {
          success: false,
          message: error.message,
        });
      }
    });

    // Add endpoint to get summary data
    socket.on("optionChain:getSummary", async ({ expiry_date, instrument_key = "NSE_INDEX|Nifty 50" }) => {
      try {
        const summaryData = await getOptionChainFromRedis(instrument_key, expiry_date, 'summary');
        socket.emit("optionChain:summaryData", {
          success: true,
          data: summaryData,
          instrument_key,
          expiry_date
        });
      } catch (error) {
        socket.emit("optionChain:error", {
          success: false,
          message: error.message,
        });
      }
    });

    socket.on("optionChain:unsubscribe", async (payload = {}) => {
      const {
        expiry_date,
        instrument_key = "NSE_INDEX|Nifty 50",
      } = payload;

      if (!expiry_date) return;

      const subscriptionKey = `${instrument_key}|${expiry_date}`;
      
      if (activeSubscriptions.has(subscriptionKey)) {
        const subscription = activeSubscriptions.get(subscriptionKey);
        subscription.clients.delete(socket.id);

        if (subscription.clients.size === 0) {
          // Stop API polling and cleanup
          if (subscription.interval) {
            clearInterval(subscription.interval);
          }
          activeSubscriptions.delete(subscriptionKey);
          
          // Unsubscribe from Redis pub/sub
          await redisSubscriber.unsubscribe(`option_chain_update:${instrument_key}:${expiry_date}`);
        }
      }

      socket.emit("optionChain:unsubscribed", {
        success: true,
        message: "Successfully unsubscribed from option chain updates",
      });
    });

    socket.on("disconnect", async () => {
      console.log(`📡 Client disconnected: ${socket.id}`);
      
      // Remove socket from all subscriptions
      for (const [key, subscription] of activeSubscriptions.entries()) {
        subscription.clients.delete(socket.id);
        
        if (subscription.clients.size === 0) {
          if (subscription.interval) {
            clearInterval(subscription.interval);
          }
          
          const [instrumentKey, expiryDate] = key.split('|');
          await redisSubscriber.unsubscribe(`option_chain_update:${instrumentKey}:${expiryDate}`);
          activeSubscriptions.delete(key);
        }
      }
    });
  });

  // Enhanced API polling function with Redis storage
  async function startApiPolling(instrumentKey, expiryDate, subscriptionKey) {
    const subscription = activeSubscriptions.get(subscriptionKey);
    
    const pollData = async () => {
      try {
        if (!subscription || subscription.clients.size === 0) {
          return; // Stop if no clients
        }

        // Check rate limiting
        if (!canMakeApiCall(instrumentKey)) {
          console.log(`⏰ Rate limit reached for ${instrumentKey}, using cached data`);
          return;
        }

        // Check if we have recent data in cache
        const cachedData = await getOptionChainFromRedis(instrumentKey, expiryDate);
        const cacheAge = cachedData ? Date.now() - new Date(cachedData.timestamp).getTime() : Infinity;
        
        if (cacheAge < 1500) { // Use cached data if less than 1.5 seconds old
          return;
        }

        // Make API call
        const optionChainData = await fetchOptionChainFromAPI(instrumentKey, expiryDate);
        
        if (optionChainData) {
          // Save to Redis with comprehensive storage
          await saveOptionChainToRedis(instrumentKey, expiryDate, optionChainData);
          
          // Publish to Redis for all subscribers
          await redisPublisher.publish(
            `option_chain_update:${instrumentKey}:${expiryDate}`,
            JSON.stringify(optionChainData)
          );
        }

      } catch (error) {
        console.error(`❌ API polling error for ${instrumentKey}:`, error.message);
      }
    };

    // Initial call
    await pollData();

    // Set up interval
    subscription.interval = setInterval(pollData, API_INTERVAL_MS);
  }
}

// Enhanced caching functions with Redis storage
async function getCachedOptionChain(instrumentKey, expiryDate) {
  try {
    // Try to get from Redis first
    const data = await getOptionChainFromRedis(instrumentKey, expiryDate);
    
    if (data) {
      // Check if data is still fresh
      const dataAge = Date.now() - new Date(data.timestamp).getTime();
      if (dataAge < CACHE_CONFIG.OPTION_CHAIN_TTL * 1000) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error("❌ Cache retrieval error:", error);
    return null;
  }
}

async function cacheOptionChainData(instrumentKey, expiryDate, data) {
  try {
    // Save to Redis with comprehensive storage
    await saveOptionChainToRedis(instrumentKey, expiryDate, data);
  } catch (error) {
    console.error("❌ Cache storage error:", error);
  }
}

// Rate limiting function
function canMakeApiCall(instrumentKey) {
  const now = Date.now();
  const stateKey = `rate_limit:${instrumentKey}`;
  
  if (!globalApiState.has(stateKey)) {
    globalApiState.set(stateKey, {
      calls: 0,
      resetTime: now + 60000,
    });
  }
  
  const state = globalApiState.get(stateKey);
  
  if (now > state.resetTime) {
    state.calls = 0;
    state.resetTime = now + 60000;
  }
  
  if (state.calls >= API_RATE_LIMITER.maxCalls) {
    return false;
  }
  
  state.calls++;
  return true;
}

// Enhanced API call function
async function fetchOptionChainFromAPI(instrumentKey, expiryDate) {
  try {
    // Backoff logic: skip API call if in backoff period
    if (Date.now() < nextAllowedApiCallTime) {
      console.warn(`⏳ Skipping API call for ${instrumentKey} due to rate limit backoff`);
      return null;
    }

    const url = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiryDate}`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    };

    const response = await axios.get(url, { 
      headers,
      timeout: 5000, // 5 second timeout
    });

    const optionChainData = response.data.data || [];
    if (optionChainData.length === 0) {
      return null;
    }

    // Process the data
    const processedData = await processOptionChainData(optionChainData, instrumentKey, expiryDate);
    return processedData;

  } catch (error) {
    if (error.response && error.response.status === 429) {
      // Set backoff time
      nextAllowedApiCallTime = Date.now() + API_BACKOFF_MS;
      console.error(`❌ API call failed for ${instrumentKey}: 429 Too Many Requests. Backing off for 5 minutes.`);
    } else {
      console.error(`❌ API call failed for ${instrumentKey}:`, error.message);
    }
    return null;
  }
}

// Optimized data processing function
async function processOptionChainData(optionChainData, instrumentKey, expiryDate) {
  const lotSize = getLotSize(instrumentKey);
  
  const processedData = optionChainData.map((strike) => {
    const strikeData = {
      expiry: strike.expiry,
      strike_price: strike.strike_price,
      underlying_key: strike.underlying_key,
      underlying_spot_price: strike.underlying_spot_price,
      pcr: strike.pcr,
      call_option: null,
      put_option: null,
    };

    // Process Call Option Data
    if (strike.call_options) {
      const callMarketData = strike.call_options.market_data || {};
      const callGreeks = strike.call_options.option_greeks || {};
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
          pop: callGreeks.pop || 0,
        },
      };
    }

    // Process Put Option Data
    if (strike.put_options) {
      const putMarketData = strike.put_options.market_data || {};
      const putGreeks = strike.put_options.option_greeks || {};
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
          pop: putGreeks.pop || 0,
        },
      };
    }

    return strikeData;
  });

  // Sort by strike price
  processedData.sort((a, b) => a.strike_price - b.strike_price);

  // Calculate totals
  const totalCallOI = processedData.reduce((sum, strike) => sum + (strike.call_option?.oi_lots || 0), 0);
  const totalPutOI = processedData.reduce((sum, strike) => sum + (strike.put_option?.oi_lots || 0), 0);
  const overallPCR = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 0;

  return {
    success: true,
    timestamp: new Date().toISOString(),
    underlying_info: {
      instrument_key: instrumentKey,
      spot_price: processedData[0]?.underlying_spot_price || 0,
      expiry_date: expiryDate,
    },
    summary: {
      total_strikes: processedData.length,
      total_call_oi_lots: totalCallOI,
      total_put_oi_lots: totalPutOI,
      overall_pcr: overallPCR,
    },
    option_chain: processedData,
  };
}

// Helper function to get lot size
function getLotSize(instrumentKey) {
  const lotSizes = {
    "NSE_INDEX|Nifty 50": 50,
    "NSE_INDEX|Nifty Bank": 15,
    "NSE_INDEX|Nifty Fin Service": 40,
  };
  return lotSizes[instrumentKey] || 50;
}

// Helper function to get available expiries
async function getAvailableExpiries(instrumentKey) {
  const expiries = {
    "NSE_INDEX|Nifty 50": [
      "2025-07-03", "2025-07-10", "2025-07-17", "2025-07-24",
      "2025-07-31", "2025-08-28", "2025-09-25", "2025-12-24"
    ],
    "NSE_INDEX|Nifty Bank": [
      "2025-07-31", "2025-08-28", "2025-09-24", "2025-09-25",
      "2025-12-24", "2025-12-31"
    ],
    "NSE_INDEX|Nifty Fin Service": ["2025-07-31", "2025-08-28"]
  };
  return expiries[instrumentKey] || [];
}


// Enhanced REST endpoint with intelligent caching
router.get("/option-chain", async (req, res) => {
  try {
    const { expiry_date, instrument_key = "NSE_INDEX|Nifty 50" } = req.query;
    
    if (!expiry_date) {
      return res.status(400).json({
        success: false,
        message: "expiry_date is required (format: YYYY-MM-DD)",
      });
    }

    // Try multi-level caching
    let result = await getCachedOptionChain(instrument_key, expiry_date);
    
    if (!result) {
      // Try to get from raw cache
      const rawCacheKey = `option_chain:raw:${instrument_key}:${expiry_date}`;
      const rawCached = await redisClient.get(rawCacheKey);
      
      if (rawCached) {
        result = JSON.parse(rawCached);
      } else {
        // Make API call as last resort
        result = await fetchOptionChainFromAPI(instrument_key, expiry_date);
        
        if (!result) {
          return res.status(404).json({
            success: false,
            message: "No option chain data found for the given parameters",
          });
        }
        
        // Cache the result
        await cacheOptionChainData(instrument_key, expiry_date, result);
      }
    }

    res.json(result);

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

// Enhanced expiry dates endpoint with caching
router.get("/available-expiry-dates", async (req, res) => {
  try {
    const { instrument_key = "NSE_INDEX|Nifty 50" } = req.query;
    
    // Try to get from cache first
    const cacheKey = `expiry_dates:${instrument_key}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let expiry_dates = [];
    
    // Static expiry dates (in production, you might fetch these from API)
    if (instrument_key === "NSE_INDEX|Nifty 50") {
      expiry_dates = [
        "2025-07-03",
        "2025-07-10",
        "2025-07-17",
        "2025-07-24",
        "2025-07-31",
        "2025-08-28",
        "2025-09-25",
        "2025-12-24",
      ];
    } else if (instrument_key === "NSE_INDEX|Nifty Bank") {
      expiry_dates = [
        "2025-07-31",
        "2025-08-28",
        "2025-09-24",
        "2025-09-25",
        "2025-12-24",
        "2025-12-31",
      ];
    } else if (instrument_key === "NSE_INDEX|Nifty Fin Service") {
      expiry_dates = ["2025-07-31", "2025-08-28"];
    }

    const result = {
      success: true,
      instrument_key,
      expiry_dates,
      timestamp: new Date().toISOString(),
    };

    // Cache for 1 hour
    await redisClient.setex(cacheKey, CACHE_CONFIG.EXPIRY_DATES_TTL, JSON.stringify(result));
    
    res.json(result);

  } catch (error) {
    console.error("❌ Error fetching expiry dates:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expiry dates",
      error: error.message,
    });
  }
});
const {triggerLeaderboardGeneration}=require('../../cronjob/cronLeaderboard');
// Health check endpoint
// Health check endpoint
router.get("/health", async (req, res) => {
  try {
    // Check Redis connectivity
    const redisStatus = await redisClient.ping();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      redis_status: redisStatus === 'PONG' ? 'connected' : 'disconnected',
      api_rate_limits: Object.fromEntries(globalApiState.entries()),
    });
    triggerLeaderboardGeneration();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Cron job to update option chain data every 5 minutes
async function setupOptionChainUpdateCron() {
  console.log('🕒 Setting up option chain update cron job...');
  
  const updateOptionChains = async () => {
    try {
      console.log('📊 Running option chain update cron job...');
      
      // Update for each instrument and their respective expiry dates
      for (const instrumentKey of INSTRUMENTS) {
        const expiries = await getAvailableExpiries(instrumentKey);
        
        for (const expiryDate of expiries) {
          // Only process if expiry date is in the future
          if (new Date(expiryDate) > new Date()) {
            // console.log(`Updating option chain for ${instrumentKey} - ${expiryDate}`);
            
            // Fetch fresh data from API
            const optionChainData = await fetchOptionChainFromAPI(instrumentKey, expiryDate);
            
            if (optionChainData) {
              // Get existing data before overwriting
              const currentKey = `option_chain:current:${instrumentKey}:${expiryDate}`;
              const existingDataRaw = await redisClient.get(currentKey);
              let isDifferent = true;
              if (existingDataRaw) {
                try {
                  const existingData = JSON.parse(existingDataRaw);
                  // Compare by stringifying (can be optimized for large data)
                  isDifferent = JSON.stringify(existingData.option_chain) !== JSON.stringify(optionChainData.option_chain);
                } catch (e) {
                  isDifferent = true;
                }
              }
              if (isDifferent) {
                // Store the old data with a timestamp
                if (existingDataRaw) {
                  const historicalKey = `option_chain:historical:${instrumentKey}:${expiryDate}:${new Date().toISOString()}`;
                  await redisClient.setex(historicalKey, 86400, existingDataRaw); // Keep for 24 hours
                }
                // Save new data
                await saveOptionChainToRedis(instrumentKey, expiryDate, optionChainData);
                // Publish update notification
                await redisPublisher.publish(
                  `option_chain_update:${instrumentKey}:${expiryDate}`,
                  JSON.stringify(optionChainData)
                );
              // console.log(`✅ Updated option chain for ${instrumentKey} - ${expiryDate}`);
              } else {
                // console.log(`⏩ No change for ${instrumentKey} - ${expiryDate}, skipping save.`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in option chain ocron:', error);
    }
  };

  // Run immediately on startup
  await updateOptionChains();
  
  // Then run every 5 minutes
  setInterval(updateOptionChains, 5 * 60 * 1000);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  await redisClient.quit();
  await redisPublisher.quit();
  await redisSubscriber.quit();
  process.exit(0);
});

// Initialize cron job
setupOptionChainUpdateCron().catch(error => {
  console.error('Failed to initialize option chain update cron:', error);
});

module.exports = router;
module.exports.registerOptionChainSocket = registerOptionChainSocket;
module.exports.setupOptionChainUpdateCron = setupOptionChainUpdateCron;