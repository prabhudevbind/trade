require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require("ws");
const path = require('path');
const protobuf = require("protobufjs");
const UpstoxClient = require("upstox-js-sdk");
const { errorHandler } = require('./middleware/error.middleware');
const { initializeMarketDataService } = require('./services/marketData.service');
const os = require('os');
const cron = require('node-cron');
const axios = require('axios');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;
const server = require('http').createServer(app);

// Import configuration
const config = require('./config/config');
const { authenticateToken } = require('./utils/verify');

// Initialize Upstox client
let protobufRoot = null;
let defaultClient = UpstoxClient.ApiClient.instance;
let apiVersion = "2.0";
let OAUTH2 = defaultClient.authentications["OAUTH2"];

// Use access token from configuration
if (!config.upstox.accessToken) {
    console.error('Error: Upstox access token is not configured. Please set ACCESS_TOKEN in your .env file');
    process.exit(1);
}

OAUTH2.accessToken = config.upstox.accessToken;
let upstoxWs = null;
const streamingResponses = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));


// Routes
app.use('/api/v1', require("./routes/chart/niftychart.router"));
app.use('/api/v1', require('./routes/contest/payment.routes'));
app.use('/api/v1', require('./routes/contest/optionDetails.router'));
app.use('/api/v1', require("./routes/contest/general.routes"));
app.use('/api/v1/market', require('./routes/market/marketStream.router'));
app.use('/api/v1/roles', require('./routes/user/userRole.routes'));
app.use('/api/v1/users', require('./routes/user/user.routes'));
app.use('/api/v1/permissions', require('./routes/user/userPermission.routes'));
app.use('/api/v1/user-activity-logs', require('./routes/user/userActivityLogRoutes'));
app.use('/api/v1/password-reset-tokens', require('./routes/user/passwordResetTokenRoutes'));
app.use('/api/v1/sessions', require('./routes/user/auth.routes'));
app.use('/api/v1/user-sessions', require('./routes/user/userSessionRoutes'));
app.use('/api/v1/smtp-details',authenticateToken, require('./routes/user/smtp.routes'));
app.use('/api/v1', require('./utils/profileupload'));
app.use('/api/v1', require('./routes/contest/bulk.router'));
app.use('/api/v1', require('./routes/user/price.router'));
app.use('/api/v1', require('./routes/dashboard/dashboard.router'));

// Error handling middleware
app.use(errorHandler);

// Add this function to format memory sizes
function formatMemoryUsage(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Add this function to log memory stats
function logMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
    };

    console.log('\n📊 Memory Usage Statistics:');
    console.log('─────────────────────────');
    console.log('🔸 Process Memory:');
    console.log(`   • Heap Used: ${formatMemoryUsage(memoryUsage.heapUsed)}`);
    console.log(`   • Heap Total: ${formatMemoryUsage(memoryUsage.heapTotal)}`);
    console.log(`   • RSS: ${formatMemoryUsage(memoryUsage.rss)}`);
    console.log('🔸 System Memory:');
    console.log(`   • Total: ${formatMemoryUsage(systemMemory.total)}`);
    console.log(`   • Free: ${formatMemoryUsage(systemMemory.free)}`);
    console.log(`   • Used: ${formatMemoryUsage(systemMemory.used)}`);
    console.log(`   • Usage: ${((systemMemory.used / systemMemory.total) * 100).toFixed(2)}%`);
    console.log('─────────────────────────');
}

// Start server
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    try {
        await initializeMarketDataService();
        await initProtobuf();
        await initUpstoxConnection();
        console.log('All services initialized successfully');

        // Start memory monitoring
        setInterval(logMemoryUsage, 5 * 60 * 1000); // Log every 5 minutes
        logMemoryUsage(); // Initial log
    } catch (error) {
        console.error('Failed to initialize services:', error);
    }
});

// Graceful shutdown handler
process.on('SIGINT', () => {
    console.log('Shutting down...');
    console.log('Final Memory Usage:');
    logMemoryUsage();
    
    streamingResponses.forEach((responses, instrumentKey) => {
        responses.forEach(res => {
            if (!res.writableEnded) {
                res.end('data: {"message": "Server shutting down"}\n\n');
            }
        });
    });
    
    server.close(() => {
        console.log('Server stopped');
        if (upstoxWs) upstoxWs.close();
        process.exit(0);
    });
});

// Initialize Upstox connection
const initUpstoxConnection = async () => {
  try {
    const wsUrl = await getMarketFeedUrl();
    console.log("WebSocket URL:", wsUrl);
    await connectUpstoxWebSocket(wsUrl);
    console.log("Upstox WebSocket connection established");
  } catch (error) {
    console.error("Error connecting to Upstox:", error);
    setTimeout(initUpstoxConnection, 5000);
  }
};

// Initialize protobuf
const initProtobuf = async () => {
  try {
    protobufRoot = await protobuf.load(path.join(__dirname, "MarketDataFeed.proto"));
    console.log("Protobuf schema loaded");
  } catch (error) {
    console.error("Error loading protobuf:", error);
    throw error;
  }
};

// Decode protobuf data
const decodeProtobuf = (buffer) => {
  if (!protobufRoot) throw new Error("Protobuf not initialized");
  const MarketDataFeed = protobufRoot.lookupType("com.upstox.marketdatafeeder.rpc.proto.FeedResponse");
  const decodedMessage = MarketDataFeed.decode(buffer);
  return MarketDataFeed.toObject(decodedMessage, {
    longs: String,
    enums: String,
    bytes: String,
  });
};

// Authorize market data feed
const getMarketFeedUrl = async () => {
  return new Promise((resolve, reject) => {
    let apiInstance = new UpstoxClient.WebsocketApi();
    apiInstance.getMarketDataFeedAuthorize(apiVersion, (error, data) => {
      if (error) {
        console.error("Authorization error:", error);
        reject(error);
      } else {
        resolve(data.data.authorizedRedirectUri);
      }
    });
  });
};

// Subscribe to an instrument
const subscribeToOption = (instrumentKey) => {
  if (upstoxWs && upstoxWs.readyState === WebSocket.OPEN) {
    const data = {
      guid: `sub-${instrumentKey}`,
      method: "sub",
      data: {
        mode: "full",
        instrumentKeys: [instrumentKey],
      },
    };
    upstoxWs.send(Buffer.from(JSON.stringify(data)));
    console.log(`Subscribed to: ${instrumentKey}`);
  } else {
    console.log(`Cannot subscribe to ${instrumentKey}: WebSocket not open`);
  }
};

// Unsubscribe from an instrument
const unsubscribeFromOption = (instrumentKey) => {
  if (upstoxWs && upstoxWs.readyState === WebSocket.OPEN) {
    const data = {
      guid: `unsub-${instrumentKey}`,
      method: "unsub",
      data: {
        instrumentKeys: [instrumentKey],
      },
    };
    upstoxWs.send(Buffer.from(JSON.stringify(data)));
    console.log(`Unsubscribed from: ${instrumentKey}`);
  }
};

// Connect to Upstox WebSocket
const connectUpstoxWebSocket = async (wsUrl) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: {
        "Api-Version": apiVersion,
        Authorization: "Bearer " + OAUTH2.accessToken,
      },
      followRedirects: true,
      perMessageDeflate: false
    });

    ws.on("open", () => {
      console.log("Upstox WebSocket connected");
      upstoxWs = ws;
      // Resubscribe to all active instruments
      streamingResponses.forEach((_, instrumentKey) => {
        subscribeToOption(instrumentKey);
      });
      resolve(ws);
    });

    ws.on("error", (error) => {
      console.error("Upstox WebSocket error:", error);
      reject(error);
    });

    ws.on("close", () => {
      console.log("Upstox WebSocket disconnected. Reconnecting in 5 seconds...");
      upstoxWs = null;
      streamingResponses.forEach((responses, instrumentKey) => {
        responses.forEach(res => {
          if (!res.writableEnded) {
            res.write('data: {"error": "WebSocket disconnected, reconnecting..."}\n\n');
          }
        });
      });
      setTimeout(initUpstoxConnection, 5000);
    });

    ws.on("message", async (data) => {
      try {
        if (data instanceof Buffer) {
          const decodedData = decodeProtobuf(data);
          if (decodedData.feeds) {
            for (const [instrumentKey, feed] of Object.entries(decodedData.feeds)) {
              if (streamingResponses.has(instrumentKey)) {
                const dataToSend = JSON.stringify({ instrumentKey, data: feed });
                streamingResponses.get(instrumentKey).forEach(res => {
                  if (!res.writableEnded) {
                    res.write(`data: ${dataToSend}\n\n`);
                  }
                });
              }
            }
          } else {
            console.log("No feeds in decoded data:", decodedData);
          }
        } else {
          console.log("Received non-buffer data:", data.toString());
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
  });
};

// Keep-alive for SSE connections
const sendKeepAlive = () => {
  streamingResponses.forEach((responses, instrumentKey) => {
    responses.forEach(res => {
      if (!res.writableEnded) {
        res.write(': keep-alive\n\n');
      }
    });
  });
};

// Start keep-alive interval
setInterval(sendKeepAlive, 15000); // Send keep-alive every 15 seconds

// Streaming endpoint
app.get('/stream/:instrumentKey', (req, res) => {
  const instrumentKey = decodeURIComponent(req.params.instrumentKey);
  console.log(`New stream request for: ${instrumentKey}`);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
  res.flushHeaders();

  // Send initial message
  res.write('data: {"message": "Streaming started"}\n\n');

  // Check WebSocket connection
  if (!upstoxWs || upstoxWs.readyState !== WebSocket.OPEN) {
    res.write('data: {"error": "WebSocket not connected, retrying..."}\n\n');
    initUpstoxConnection();
  } else {
    // Add response to streamingResponses
    if (!streamingResponses.has(instrumentKey)) {
      streamingResponses.set(instrumentKey, []);
      subscribeToOption(instrumentKey);
    }
    streamingResponses.get(instrumentKey).push(res);
  }

  // Handle client disconnection
  req.on('close', () => {
    console.log(`Client disconnected for: ${instrumentKey}`);
    const responses = streamingResponses.get(instrumentKey);
    if (responses) {
      const index = responses.indexOf(res);
      if (index > -1) responses.splice(index, 1);
      if (responses.length === 0) {
        streamingResponses.delete(instrumentKey);
        unsubscribeFromOption(instrumentKey);
      }
    }
    if (!res.writableEnded) {
      res.end();
    }
  });
});

// List of instrument keys to fetch expiry dates for
const EXPIRY_INSTRUMENTS = [
  'NSE_INDEX|Nifty 50',
  'NSE_INDEX|Nifty Bank',
  'NSE_INDEX|Nifty Fin Service',
  // Add more as needed
];

// Function to fetch expiry dates for all instruments
async function fetchAndCacheExpiryDates() {
  console.log('⏰ [CRON] Fetching expiry dates for all instruments...');
  for (const instrumentKey of EXPIRY_INSTRUMENTS) {
    try {
      const url = `http://localhost:${PORT}/api/v1/available-expiry-dates?instrument_key=${encodeURIComponent(instrumentKey)}`;
      const res = await axios.get(url);
      if (res.data && res.data.expiry_dates) {
        console.log(`✅ [CRON] Expiry dates updated for ${instrumentKey}:`, res.data.expiry_dates.length, 'dates');
      } else {
        console.warn(`⚠️  [CRON] No expiry dates found for ${instrumentKey}`);
      }
    } catch (err) {
      console.error(`❌ [CRON] Error fetching expiry dates for ${instrumentKey}:`, err.message);
    }
  }
}

// Schedule the cron job to run every day at 6:00 AM
cron.schedule('0 6 * * *', fetchAndCacheExpiryDates, {
  timezone: 'Asia/Kolkata',
});

// Optionally, run once at server start
// fetchAndCacheExpiryDates();

// Handle shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  console.log('Final Memory Usage:');
  logMemoryUsage();
  
  streamingResponses.forEach((responses, instrumentKey) => {
    responses.forEach(res => {
      if (!res.writableEnded) {
        res.end('data: {"message": "Server shutting down"}\n\n');
      }
    });
  });
  server.close(() => {
  console.log('Server stopped');
    if (upstoxWs) upstoxWs.close();
    process.exit(0);
  });
});



// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Handle React router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
module.exports = app;