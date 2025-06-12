const express = require("express");
const axios = require("axios");
const router = express.Router();

// Store real-time market data cache
const marketDataCache = new Map();



// Historical data endpoint with flexible date handling
router.get("/historical-data/:instrument_key/:interval/:to_date/:from_date?", async (req, res) => {
  try {
    // Extract parameters from the request
    const { instrument_key, interval, to_date, from_date } = req.params;
    
    // Validate interval
    const validIntervals = ['1minute', '30minute', 'day', 'week', 'month'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        success: false,
        message: "Invalid interval. Valid intervals: 1minute, 30minute, day, week, month",
        timestamp: new Date().toISOString()
      });
    }
    
    // Construct the API URL based on whether from_date is provided
    let url;
    if (from_date && from_date !== '') {
      url = `https://api.upstox.com/v2/historical-candle/${instrument_key}/${interval}/${to_date}/${from_date}`;
    } else {
      url = `https://api.upstox.com/v2/historical-candle/${instrument_key}/${interval}/${to_date}`;
    }
    
    console.log('Fetching from URL:', url);
    
    // Make the API call
    const response = await axios.get(url, {
      headers: { 
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    // Return the fetched data
    res.status(200).json({
      success: true,
      data: response.data,
      url: url,
      params: {
        instrument_key,
        interval,
        to_date,
        from_date: from_date || 'Not provided'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching historical data:', error.message);
    
    // Handle different types of errors
    let statusCode = 500;
    let errorMessage = "Error fetching historical data";
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || error.message;
    } else if (error.request) {
      errorMessage = "No response from API server";
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper endpoint to get data with automatic date calculation
router.get("/historical-data-auto/:instrument_key/:interval/:period", async (req, res) => {
  try {
    const { instrument_key, interval, period } = req.params;
    
    // Calculate dates based on period
    const toDate = new Date();
    const fromDate = new Date();
    
    switch(period) {
      case 'today':
        // Same day
        break;
      case 'week':
        fromDate.setDate(toDate.getDate() - 7);
        break;
      case 'month':
        fromDate.setMonth(toDate.getMonth() - 1);
        break;
      case 'quarter':
        fromDate.setMonth(toDate.getMonth() - 3);
        break;
      case 'year':
        fromDate.setFullYear(toDate.getFullYear() - 1);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid period. Valid periods: today, week, month, quarter, year"
        });
    }
    
    const toDateStr = toDate.toISOString().split('T')[0];
    const fromDateStr = fromDate.toISOString().split('T')[0];
    
    // Forward to main endpoint
    req.params.to_date = toDateStr;
    req.params.from_date = fromDateStr;
    
    // Call the main handler
    return router.handle(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error in auto date calculation",
      error: error.message
    });
  }
});



// API endpoint for real-time market data only
router.get("/market-data/:instrument_key", (req, res) => {
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
        message: "No real-time market data available for this instrument",
        instrument_key: decodedInstrumentKey,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching real-time market data",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// New endpoint specifically for today's complete intraday data
router.get("/today-intraday/:instrument_key/:interval", async (req, res) => {
  try {
    const { instrument_key, interval } = req.params;
    
    // Validate interval for intraday
    const validIntradayIntervals = ['1minute', '30minute'];
    if (!validIntradayIntervals.includes(interval)) {
      return res.status(400).json({
        success: false,
        message: "Invalid interval for intraday. Valid intervals: 1minute, 30minute",
        timestamp: new Date().toISOString()
      });
    }
    
    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // For intraday data, we need to use from_date parameter to get complete data
    const url = `https://api.upstox.com/v2/historical-candle/intraday/${instrument_key}/${interval}`;
    
    console.log('Fetching today\'s intraday data from URL:', url);
    
    const response = await axios.get(url, {
      headers: { 
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    // Combine with real-time data if available
    const decodedInstrumentKey = decodeURIComponent(instrument_key);
    const realTimeData = marketDataCache.get(decodedInstrumentKey);
    
    res.status(200).json({
      success: true,
      data: response.data,
      real_time_data: realTimeData || null,
      url: url,
      params: {
        instrument_key,
        interval,
        date: todayStr
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching today\'s intraday data:', error.message);
    
    let statusCode = 500;
    let errorMessage = "Error fetching today's intraday data";
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || error.message;
    } else if (error.request) {
      errorMessage = "No response from API server";
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// Export the router and update function
module.exports = router