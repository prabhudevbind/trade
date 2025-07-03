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
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxLoadingTimeout: 5000,
  lazyConnect: true,
  // Connection pooling for high concurrency
  family: 4,
  keepAlive: true,
  // Optimized for high throughput
  connectTimeout: 10000,
  commandTimeout: 5000,
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
  OPTION_CHAIN_TTL: 2, // 2 seconds for live data
  PROCESSED_DATA_TTL: 5, // 5 seconds for processed data
  RATE_LIMIT_TTL: 60, // 1 minute for rate limiting
  EXPIRY_DATES_TTL: 3600, // 1 hour for expiry dates
};

// Rate limiting and API optimization
const API_RATE_LIMITER = {
  calls: 0,
  resetTime: Date.now() + 60000, // Reset every minute
  maxCalls: 60, // 60 calls per minute per instrument
};

// Global state management for API calls
const globalApiState = new Map();

// Enhanced Socket.IO implementation with Redis pub/sub
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
        const cacheKey = `option_chain:${instrument_key}:${expiry_date}`;
        
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
        const cachedData = await getCachedOptionChain(instrument_key, expiry_date);
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

  // Smart API polling function
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
        const cachedData = await getCachedOptionChain(instrumentKey, expiryDate);
        const cacheAge = cachedData ? Date.now() - new Date(cachedData.timestamp).getTime() : Infinity;
        
        if (cacheAge < 1500) { // Use cached data if less than 1.5 seconds old
          return;
        }

        // Make API call
        const optionChainData = await fetchOptionChainFromAPI(instrumentKey, expiryDate);
        
        if (optionChainData) {
          // Cache the processed data
          await cacheOptionChainData(instrumentKey, expiryDate, optionChainData);
          
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

// Enhanced caching functions
async function getCachedOptionChain(instrumentKey, expiryDate) {
  try {
    const cacheKey = `option_chain:${instrumentKey}:${expiryDate}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      const data = JSON.parse(cached);
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
    const cacheKey = `option_chain:${instrumentKey}:${expiryDate}`;
    
    // Use Redis pipeline for better performance
    const pipeline = redisClient.pipeline();
    pipeline.setex(cacheKey, CACHE_CONFIG.OPTION_CHAIN_TTL, JSON.stringify(data));
    
    // Also cache raw data for backup
    const rawCacheKey = `option_chain:raw:${instrumentKey}:${expiryDate}`;
    pipeline.setex(rawCacheKey, CACHE_CONFIG.PROCESSED_DATA_TTL, JSON.stringify(data));
    
    await pipeline.exec();
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
    console.error(`❌ API call failed for ${instrumentKey}:`, error.message);
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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  await redisClient.quit();
  await redisPublisher.quit();
  await redisSubscriber.quit();
  process.exit(0);
});

module.exports = router;
module.exports.registerOptionChainSocket = registerOptionChainSocket;