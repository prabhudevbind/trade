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

module.exports = router;

// Updated fetchHistoricalData function for your React component
const fetchHistoricalData = async (selectedTimeframe) => {
  setLoading(true);
  setError(null);
  
  try {
    const { toDate, fromDate } = getDateRange(selectedTimeframe);
    const interval = timeframes[selectedTimeframe].interval;
    const instrumentKey = encodeURIComponent(optionId); // URL encode the instrument key
    
    // Use the backend API endpoint
    const url = `http://localhost:5000/api/v1/historical-data/${instrumentKey}/${interval}/${toDate}/${fromDate}`;
    
    console.log('Fetching from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data?.data?.candles) {
      // Transform data for lightweight-charts
      const transformedData = result.data.data.candles.map(candle => ({
        time: new Date(candle[0]).getTime() / 1000, // Convert to Unix timestamp
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: candle[5] ? parseFloat(candle[5]) : 0 // Include volume if available
      })).sort((a, b) => a.time - b.time); // Sort by time ascending
      
      setData(transformedData);
      console.log(`Loaded ${transformedData.length} data points`);
    } else {
      throw new Error('Invalid data format received from API');
    }
  } catch (err) {
    setError(err.message);
    console.error('Error fetching data:', err);
  } finally {
    setLoading(false);
  }
};
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


// Function to update market data cache (called from WebSocket data)
function updateMarketDataCache(instrumentKey, marketData) {
  const processedData = {
    ...marketData,
    timestamp: new Date().toISOString(),
    last_update: Date.now()
  };
  
  marketDataCache.set(instrumentKey, processedData);
  console.log(`✅ Updated market data cache for ${instrumentKey}`);
}

// Export the router and update function
module.exports = router