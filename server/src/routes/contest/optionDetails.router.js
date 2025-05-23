const express = require("express");
const axios = require("axios");
const WebSocket = require("ws");
const router = express.Router();

// Store active SSE connections for option details
const optionDetailConnections = new Map();

// Store real-time market data cache
const marketDataCache = new Map();

// API endpoint for option details with historical and real-time data
router.get("/option-details/:instrument_key", async (req, res) => {
  try {
    const { instrument_key } = req.params;
    const { 
      interval = "1minute", 
      days = 30,
      type = "call",
      strike 
    } = req.query;

    const decodedInstrumentKey = decodeURIComponent(instrument_key);
    
    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - parseInt(days));
    
    const toDateStr = toDate.toISOString().split('T')[0];
    const fromDateStr = fromDate.toISOString().split('T')[0];

    // Fetch historical candle data
    const historicalData = await fetchHistoricalData(
      decodedInstrumentKey, 
      interval, 
      toDateStr, 
      fromDateStr
    );

    // Get current market data if available
    const currentMarketData = marketDataCache.get(decodedInstrumentKey) || null;

    // Prepare response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      instrument_info: {
        instrument_key: decodedInstrumentKey,
        type: type,
        strike_price: strike,
        interval: interval,
        days_requested: days
      },
      historical_data: historicalData,
      current_market_data: currentMarketData,
      data_summary: {
        total_candles: historicalData?.candles?.length || 0,
        date_range: {
          from: fromDateStr,
          to: toDateStr
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error("❌ Option Details API Error:", error.message);
    
    let errorMessage = "Failed to fetch option details";
    if (error.response) {
      errorMessage = `API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// SSE endpoint for real-time option details streaming
router.get("/option-details-stream/:instrument_key", async (req, res) => {
  try {
    const { instrument_key } = req.params;
    const { 
      interval = "1minute", 
      days = 7,
      type = "call",
      strike 
    } = req.query;

    const decodedInstrumentKey = decodeURIComponent(instrument_key);
    const connectionId = `${decodedInstrumentKey}_${Date.now()}`;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
    res.flushHeaders();

    console.log(`🚀 Starting option details stream for ${decodedInstrumentKey}`);

    // Store connection
    optionDetailConnections.set(connectionId, {
      response: res,
      instrumentKey: decodedInstrumentKey,
      lastUpdate: Date.now()
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      success: true,
      message: "Connected to option details stream",
      instrument_key: decodedInstrumentKey,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Fetch initial historical data
    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - parseInt(days));
      
      const toDateStr = toDate.toISOString().split('T')[0];
      const fromDateStr = fromDate.toISOString().split('T')[0];

      const historicalData = await fetchHistoricalData(
        decodedInstrumentKey, 
        interval, 
        toDateStr, 
        fromDateStr
      );

      // Send initial historical data
      res.write(`data: ${JSON.stringify({
        type: "historical_data",
        success: true,
        timestamp: new Date().toISOString(),
        instrument_info: {
          instrument_key: decodedInstrumentKey,
          type: type,
          strike_price: strike,
          interval: interval
        },
        historical_data: historicalData,
        data_summary: {
          total_candles: historicalData?.candles?.length || 0,
          date_range: { from: fromDateStr, to: toDateStr }
        }
      })}\n\n`);

    } catch (error) {
      console.error("Error fetching initial historical data:", error);
      res.write(`data: ${JSON.stringify({
        type: "error",
        success: false,
        message: "Failed to fetch historical data",
        error: error.message,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }

    // Set up interval for real-time updates (every 1 second)
    const updateInterval = setInterval(() => {
      try {
        const connection = optionDetailConnections.get(connectionId);
        if (!connection) {
          clearInterval(updateInterval);
          return;
        }

        // Get current market data
        const currentMarketData = marketDataCache.get(decodedInstrumentKey);
        
        if (currentMarketData) {
          // Send real-time market data
          res.write(`data: ${JSON.stringify({
            type: "market_data",
            success: true,
            timestamp: new Date().toISOString(),
            instrument_key: decodedInstrumentKey,
            market_data: currentMarketData,
            last_updated: currentMarketData.timestamp || new Date().toISOString()
          })}\n\n`);
        } else {
          // Send heartbeat if no data
          res.write(`data: ${JSON.stringify({
            type: "heartbeat",
            success: true,
            timestamp: new Date().toISOString(),
            message: "Waiting for market data..."
          })}\n\n`);
        }

        // Update last update time
        connection.lastUpdate = Date.now();

      } catch (error) {
        console.error("Error in real-time update:", error);
        clearInterval(updateInterval);
        optionDetailConnections.delete(connectionId);
      }
    }, 1000);

    // Handle client disconnection
    req.on("close", () => {
      clearInterval(updateInterval);
      optionDetailConnections.delete(connectionId);
      res.end();
      console.log(`✅ Client disconnected from option details stream: ${decodedInstrumentKey}`);
    });

    req.on("error", (err) => {
      console.error("❌ Request error:", err);
      clearInterval(updateInterval);
      optionDetailConnections.delete(connectionId);
      res.end();
    });

  } catch (error) {
    console.error("❌ SSE Setup Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to set up streaming",
      error: error.message,
    });
  }
});

// Function to fetch historical candle data
async function fetchHistoricalData(instrumentKey, interval, toDate, fromDate) {
  try {
    const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`;
    
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    };

    console.log(`📊 Fetching historical data from: ${url}`);
    const response = await axios.get(url, { headers });
    
    if (response.data.status === "success" && response.data.data) {
      const candleData = response.data.data;
      
      // Process candles to a more readable format
      const processedCandles = candleData.candles?.map(candle => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        open_interest: candle[6]
      })) || [];

      return {
        candles: processedCandles,
        raw_candles: candleData.candles, // Keep original format too
        total_candles: processedCandles.length
      };
    } else {
      console.warn("No historical data available");
      return {
        candles: [],
        raw_candles: [],
        total_candles: 0
      };
    }

  } catch (error) {
    console.error("Error fetching historical data:", error.message);
    throw error;
  }
}

// Function to update market data cache (called from WebSocket data)
function updateMarketDataCache(instrumentKey, marketData) {
  const processedData = {
    ...marketData,
    timestamp: new Date().toISOString(),
    last_update: Date.now()
  };
  
  marketDataCache.set(instrumentKey, processedData);
  
  // Broadcast to active connections for this instrument
  optionDetailConnections.forEach((connection, connectionId) => {
    if (connection.instrumentKey === instrumentKey && connection.response) {
      try {
        connection.response.write(`data: ${JSON.stringify({
          type: "live_market_data",
          success: true,
          timestamp: new Date().toISOString(),
          instrument_key: instrumentKey,
          market_data: processedData
        })}\n\n`);
      } catch (error) {
        console.error("Error broadcasting to connection:", error);
        optionDetailConnections.delete(connectionId);
      }
    }
  });
}

// API endpoint to get available intervals and limits
router.get("/option-details/info/intervals", (req, res) => {
  res.json({
    success: true,
    available_intervals: {
      "1minute": {
        name: "1 Minute",
        max_duration_days: 30,
        description: "1-minute candles for the last month"
      },
      "30minute": {
        name: "30 Minutes", 
        max_duration_days: 365,
        description: "30-minute candles for the past year"
      },
      "day": {
        name: "Daily",
        max_duration_days: 365,
        description: "Daily candles for the past year"
      },
      "week": {
        name: "Weekly",
        max_duration_days: 3650,
        description: "Weekly candles for the past 10 years"
      },
      "month": {
        name: "Monthly",
        max_duration_days: 3650,
        description: "Monthly candles for the past 10 years"
      }
    },
    notes: [
      "1-minute and 30-minute data is available only for the last 6 months",
      "Use intraday API for current trading day data",
      "Only single instrument key per request is supported"
    ]
  });
});

// API endpoint to get current market data for an instrument
router.get("/option-details/:instrument_key/current", (req, res) => {
  try {
    const { instrument_key } = req.params;
    const decodedInstrumentKey = decodeURIComponent(instrument_key);
    
    const marketData = marketDataCache.get(decodedInstrumentKey);
    
    if (marketData) {
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        instrument_key: decodedInstrumentKey,
        market_data: marketData
      });
    } else {
      res.json({
        success: false,
        message: "No current market data available for this instrument",
        instrument_key: decodedInstrumentKey,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching current market data",
      error: error.message
    });
  }
});

// Cleanup function for stale connections
setInterval(() => {
  const now = Date.now();
  const staleTimeout = 60000; // 1 minute

  optionDetailConnections.forEach((connection, connectionId) => {
    if (now - connection.lastUpdate > staleTimeout) {
      console.log(`🧹 Cleaning up stale connection: ${connectionId}`);
      try {
        connection.response.end();
      } catch (error) {
        // Connection already closed
      }
      optionDetailConnections.delete(connectionId);
    }
  });
}, 30000); // Check every 30 seconds

// Export the update function so it can be called from your main WebSocket handler
module.exports = {
  router,
  updateMarketDataCache
};