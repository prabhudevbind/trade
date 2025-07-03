require("dotenv").config();
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const path = require("path");
const protobuf = require("protobufjs");
const UpstoxClient = require("upstox-js-sdk");
const { errorHandler } = require("./middleware/error.middleware");
const {
  initializeMarketDataService,
} = require("./services/marketData.service");
const os = require("os");
const cron = require("node-cron");
const axios = require("axios");
const fs = require("fs");
const redis = require("redis");
require("./cronjob/cronExpiryDates");
require("./cronjob/cronContestReset");
require("./cronjob/cronLeaderboard");
// --- REDIS CLIENT SETUP ---
const Redis = require("ioredis");
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null,
});
redisClient.on("connect", () => console.log("✅ Redis connected"));
redisClient.on("error", (err) => console.error("❌ Redis error:", err));

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;
const server = require("http").createServer(app);

// Import configuration
const config = require("./config/config");
const { authenticateToken } = require("./utils/verify");

// Initialize Upstox client
let protobufRoot = null;
let defaultClient = UpstoxClient.ApiClient.instance;
let apiVersion = "2.0";
let OAUTH2 = defaultClient.authentications["OAUTH2"];

// Use access token from configuration
if (!config.upstox.accessToken) {
  console.error(
    "Error: Upstox access token is not configured. Please set ACCESS_TOKEN in your .env file"
  );
  process.exit(1);
}

OAUTH2.accessToken = config.upstox.accessToken;

// WebSocket connection management
let upstoxWs = null;
let reconnectInterval = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000; // 5 seconds
let isConnecting = false;

// Subscription management
const instrumentSubscriptions = new Map(); // instrumentKey -> Set<socket.id>
const pendingSubscriptions = new Set(); // instrumentKeys waiting for connection
const subscriptionTimers = new Map(); // instrumentKey -> timeout id
const retryTimers = new Map(); // instrumentKey -> timeout id

// --- REDIS KEY FOR ACTIVE SUBSCRIPTIONS ---
const ACTIVE_SUBS_KEY = "active_instrument_keys";

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/v1", require("./routes/chart/niftychart.router"));
app.use("/api/v1", require("./routes/contest/payment.routes"));
app.use("/api/v1", require("./routes/contest/optionDetails.router"));
app.use("/api/v1", require("./routes/contest/general.routes"));
app.use("/api/v1/market", require("./routes/market/marketStream.router"));
app.use("/api/v1/roles", require("./routes/user/userRole.routes"));
app.use("/api/v1/users", require("./routes/user/user.routes"));
app.use("/api/v1/permissions", require("./routes/user/userPermission.routes"));
app.use(
  "/api/v1/user-activity-logs",
  require("./routes/user/userActivityLogRoutes")
);
app.use(
  "/api/v1/password-reset-tokens",
  require("./routes/user/passwordResetTokenRoutes")
);
app.use("/api/v1/sessions", require("./routes/user/auth.routes"));
app.use("/api/v1/user-sessions", require("./routes/user/userSessionRoutes"));
app.use(
  "/api/v1/smtp-details",
  authenticateToken,
  require("./routes/user/smtp.routes")
);
app.use("/api/v1", require("./utils/profileupload"));
app.use("/api/v1", require("./routes/contest/bulk.router"));
app.use("/api/v1", require("./routes/user/price.router"));
app.use("/api/v1", require("./routes/dashboard/dashboard.router"));
app.use("/api/v1/leaderboard", require("./routes/leaderboard.routes"));
// Error handling middleware
app.use(errorHandler);

// Memory management functions
function formatMemoryUsage(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function logMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const systemMemory = {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem(),
  };

  // console.log("\n📊 Memory Usage Statistics:");
  // console.log("─────────────────────────");
  // console.log("🔸 Process Memory:");
  // console.log(`   • Heap Used: ${formatMemoryUsage(memoryUsage.heapUsed)}`);
  // console.log(`   • Heap Total: ${formatMemoryUsage(memoryUsage.heapTotal)}`);
  // console.log(`   • RSS: ${formatMemoryUsage(memoryUsage.rss)}`);
  // console.log("🔸 System Memory:");
  // console.log(`   • Total: ${formatMemoryUsage(systemMemory.total)}`);
  // console.log(`   • Free: ${formatMemoryUsage(systemMemory.free)}`);
  // console.log(`   • Used: ${formatMemoryUsage(systemMemory.used)}`);
  // console.log(
  //   `   • Usage: ${((systemMemory.used / systemMemory.total) * 100).toFixed(
  //     2
  //   )}%`
  // );
  // console.log("─────────────────────────");
}

// Initialize protobuf
const initProtobuf = async () => {
  try {
    protobufRoot = await protobuf.load(
      path.join(__dirname, "MarketDataFeed.proto")
    );
    // console.log("✅ Protobuf schema loaded successfully");
    return true;
  } catch (error) {
    console.error("❌ Error loading protobuf:", error);
    throw error;
  }
};

// Decode protobuf data
const decodeProtobuf = (buffer) => {
  if (!protobufRoot) {
    throw new Error("Protobuf not initialized");
  }
  try {
    const MarketDataFeed = protobufRoot.lookupType(
      "com.upstox.marketdatafeeder.rpc.proto.FeedResponse"
    );
    const decodedMessage = MarketDataFeed.decode(buffer);
    return MarketDataFeed.toObject(decodedMessage, {
      longs: String,
      enums: String,
      bytes: String,
    });
  } catch (error) {
    console.error("Error decoding protobuf data:", error);
    return null;
  }
};

// Get market feed URL from Upstox API
const getMarketFeedUrl = async () => {
  return new Promise((resolve, reject) => {
    const apiInstance = new UpstoxClient.WebsocketApi();
    apiInstance.getMarketDataFeedAuthorize(apiVersion, (error, data) => {
      if (error) {
        console.error("❌ Upstox authorization error:", error);
        reject(error);
      } else {
        // console.log("✅ Upstox WebSocket URL obtained");
        resolve(data.data.authorizedRedirectUri);
      }
    });
  });
};

// Clean up subscription timers
const cleanupSubscriptionTimers = (instrumentKey) => {
  if (subscriptionTimers.has(instrumentKey)) {
    clearTimeout(subscriptionTimers.get(instrumentKey));
    subscriptionTimers.delete(instrumentKey);
  }
  if (retryTimers.has(instrumentKey)) {
    clearTimeout(retryTimers.get(instrumentKey));
    retryTimers.delete(instrumentKey);
  }
};

// Subscribe to instrument on Upstox WebSocket
// Enhanced debugging for WebSocket data reception
const subscribeToUpstoxInstrument = (instrumentKey) => {
  if (!upstoxWs || upstoxWs.readyState !== WebSocket.OPEN) {
    // console.log(
    //   `⏳ Adding ${instrumentKey} to pending subscriptions (WebSocket not ready)`
    // );
    pendingSubscriptions.add(instrumentKey);
    return false;
  }

  try {
    const subscriptionData = {
      guid: `sub-${instrumentKey}-${Date.now()}`,
      method: "sub",
      data: {
        mode: "ltpc", // Changed from "full" to "full" for richer data
        instrumentKeys: [instrumentKey],
      },
    };

    upstoxWs.send(Buffer.from(JSON.stringify(subscriptionData)));
    // console.log(
    //   `📡 Subscribed to Upstox for: ${instrumentKey} with mode: ${subscriptionData.data.mode}`
    // );

    // Enhanced logging for subscription confirmation
    // console.log(
    //   `📋 Subscription payload:`,
    //   JSON.stringify(subscriptionData, null, 2)
    // );

    // Set up timeout to detect if no data is received
    const timeoutId = setTimeout(() => {
      // console.warn(
      //   `⚠️  No data received for ${instrumentKey} after 15 seconds`
      // );
      // Try resubscribing with different mode
      // console.log(
      //   `🔄 Attempting resubscription with 'full' mode for ${instrumentKey}`
      // );
      resubscribeWithDifferentMode(instrumentKey);
    }, 2000);
    subscriptionTimers.set(instrumentKey, timeoutId);

    // Set up retry mechanism with exponential backoff
    const retryId = setTimeout(() => {
      // console.warn(
      //   `🔄 Retrying subscription for ${instrumentKey} after 45 seconds`
      // );
      subscribeToUpstoxInstrument(instrumentKey);
    }, 45000);
    retryTimers.set(instrumentKey, retryId);

    return true;
  } catch (error) {
    console.error(`❌ Error subscribing to ${instrumentKey}:`, error);
    return false;
  }
};

// Function to resubscribe with different mode
const resubscribeWithDifferentMode = (instrumentKey) => {
  if (!upstoxWs || upstoxWs.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    // First unsubscribe
    const unsubscriptionData = {
      guid: `unsub-${instrumentKey}-${Date.now()}`,
      method: "unsub",
      data: {
        instrumentKeys: [instrumentKey],
      },
    };
    upstoxWs.send(Buffer.from(JSON.stringify(unsubscriptionData)));
    // console.log(`📡 Unsubscribed from ${instrumentKey} before mode change`);

    // Wait a moment then resubscribe with full mode
    setTimeout(() => {
      const subscriptionData = {
        guid: `sub-${instrumentKey}-${Date.now()}`,
        method: "sub",
        data: {
          mode: "ltpc", // Try with full mode
          instrumentKeys: [instrumentKey],
        },
      };
      upstoxWs.send(Buffer.from(JSON.stringify(subscriptionData)));
      // console.log(`📡 Resubscribed to ${instrumentKey} with full mode`);
    }, 1000);
  } catch (error) {
    console.error(`❌ Error resubscribing to ${instrumentKey}:`, error);
  }
};

// Unsubscribe from instrument on Upstox WebSocket
const unsubscribeFromUpstoxInstrument = (instrumentKey) => {
  if (upstoxWs && upstoxWs.readyState === WebSocket.OPEN) {
    try {
      const unsubscriptionData = {
        guid: `unsub-${instrumentKey}-${Date.now()}`,
        method: "unsub",
        data: {
          instrumentKeys: [instrumentKey],
        },
      };

      upstoxWs.send(Buffer.from(JSON.stringify(unsubscriptionData)));
      // console.log(`📡 Unsubscribed from Upstox for: ${instrumentKey}`);
    } catch (error) {
      console.error(`❌ Error unsubscribing from ${instrumentKey}:`, error);
    }
  }

  // Clean up timers and pending subscriptions
  cleanupSubscriptionTimers(instrumentKey);
  pendingSubscriptions.delete(instrumentKey);
};

// Process pending subscriptions when WebSocket connects
const processPendingSubscriptions = () => {
  if (pendingSubscriptions.size > 0) {
    // console.log(
    //   `🔄 Processing ${pendingSubscriptions.size} pending subscriptions`
    // );
    const subscriptionsToProcess = Array.from(pendingSubscriptions);
    pendingSubscriptions.clear();

    subscriptionsToProcess.forEach((instrumentKey) => {
      if (instrumentSubscriptions.has(instrumentKey)) {
        subscribeToUpstoxInstrument(instrumentKey);
      }
    });
  }
};

// Connect to Upstox WebSocket with improved error handling
const connectUpstoxWebSocket = async (wsUrl) => {
  return new Promise((resolve, reject) => {
    if (isConnecting) {
      // console.log("⏳ Connection already in progress...");
      return;
    }

    isConnecting = true;
    // console.log(
    //   `🔗 Attempting to connect to Upstox WebSocket (Attempt ${
    //     connectionAttempts + 1
    //   })`
    // );

    const ws = new WebSocket(wsUrl, {
      headers: {
        "Api-Version": apiVersion,
        Authorization: "Bearer " + OAUTH2.accessToken,
      },
      followRedirects: true,
      perMessageDeflate: false,
    });

    const connectionTimeout = setTimeout(() => {
      console.error("❌ WebSocket connection timeout");
      ws.terminate();
      isConnecting = false;
      reject(new Error("Connection timeout"));
    }, 30000); // 30 second timeout

    ws.on("open", async () => {
      clearTimeout(connectionTimeout);
      // console.log("✅ Upstox WebSocket connected successfully");
      upstoxWs = ws;
      isConnecting = false;
      connectionAttempts = 0;

      // Clear any existing reconnect interval
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }

      // Process pending subscriptions
      processPendingSubscriptions();
      subscribePredefinedOptions();

      // --- Restore all active subscriptions from Redis ---
      await restoreActiveSubscriptions();

      resolve(ws);
    });

    ws.on("error", (error) => {
      clearTimeout(connectionTimeout);
      console.error("❌ Upstox WebSocket error:", error.message);
      isConnecting = false;
      connectionAttempts++;
      reject(error);
    });

    ws.on("close", (code, reason) => {
      clearTimeout(connectionTimeout);
      // console.log(
      //   `🔌 Upstox WebSocket disconnected. Code: ${code}, Reason: ${reason}`
      // );
      upstoxWs = null;
      isConnecting = false;

      // Move active subscriptions to pending
      for (const instrumentKey of instrumentSubscriptions.keys()) {
        pendingSubscriptions.add(instrumentKey);
      }

      // Schedule reconnection
      scheduleReconnection();
    });

    // Enhanced message handler with better debugging
    ws.on("message", async (data) => {
      try {
        if (data instanceof Buffer) {
          // console.log(`📦 Received binary data of size: ${data.length} bytes`);

          const decodedData = decodeProtobuf(data);
          if (decodedData) {
            // console.log(
            //   `📊 Decoded data structure:`,
            //   JSON.stringify(decodedData, null, 2)
            // );

            if (decodedData.feeds) {
              const receivedKeys = Object.keys(decodedData.feeds);
              // console.log(
              //   `📊 Received data for ${receivedKeys.length} instruments:`,
              //   receivedKeys
              // );

              for (const [instrumentKey, feed] of Object.entries(
                decodedData.feeds
              )) {
                cleanupSubscriptionTimers(instrumentKey);

                // Cache structure with extra info
                const cacheData = {
                  ...feed,
                  instrumentKey,
                  timestamp: Date.now(),
                  lastUpdated: new Date().toISOString(),
                };

                try {
                  await redisClient.set(
                    `option_live:${instrumentKey}`,
                    JSON.stringify(cacheData),
                    "EX",
                    2
                  );
                } catch (err) {
                  console.error(
                    `❌ Redis cache error for ${instrumentKey}:`,
                    err
                  );
                }

                // Emit to room (subscribed clients)
                const roomSize =
                  io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;
                if (roomSize > 0) {
                  io.to(instrumentKey).emit("marketData", {
                    instrumentKey,
                    data: cacheData,
                    timestamp: Date.now(),
                    mode: "realtime",
                  });
                }

                // Emit globally for all clients (if needed)
                io.emit("globalMarketData", {
                  instrumentKey,
                  data: cacheData,
                  timestamp: Date.now(),
                  mode: "realtime",
                });
              }
            } else if (decodedData.type) {
              // Handle different message types
              // console.log(`📩 Received message type: ${decodedData.type}`);
              if (decodedData.type === "ack") {
                // console.log(`✅ Subscription acknowledgment received`);
              } else if (decodedData.type === "error") {
                console.error(`❌ Error from Upstox:`, decodedData);
              }
            } else {
              // console.log(
              //   `⚠️  Received data without feeds or type:`,
              //   decodedData
              // );
            }
          } else {
            console.error(`❌ Failed to decode protobuf data`);
            // Log raw data for debugging
            // console.log(`🔍 Raw data (first 100 bytes):`, data.slice(0, 100));
          }
        } else {
          const message = data.toString();
          // console.log("📩 Received text message:", message);

          // Try to parse as JSON for subscription confirmations
          try {
            const jsonMessage = JSON.parse(message);
            // console.log("📋 Parsed JSON message:", jsonMessage);

            // Handle subscription confirmations
            if (jsonMessage.type === "connection_ack") {
              // console.log("✅ Connection acknowledged by Upstox");
            } else if (jsonMessage.type === "subscription_ack") {
              // console.log(
              //   "✅ Subscription acknowledged for:",
              //   jsonMessage.instrumentKeys
              // );
            }
          } catch (parseError) {
            // console.log("📝 Non-JSON text message received");
          }
        }
      } catch (error) {
        console.error("❌ Error processing WebSocket message:", error);
        console.error("🔍 Error stack:", error.stack);
      }
    });

    // Handle ping/pong for connection health
    ws.on("ping", () => {
      // console.log("🏓 Received ping from Upstox");
      ws.pong();
    });

    ws.on("pong", () => {
      // console.log("🏓 Received pong from Upstox");
    });
  });
};

// Function to validate instrument key format
const validateInstrumentKey = (instrumentKey) => {
  // NSE_FO format: NSE_FO|token_number
  const patterns = {
    NSE_EQ: /^NSE_EQ\|.+$/,
    NSE_FO: /^NSE_FO\|\d+$/,
    NSE_INDEX: /^NSE_INDEX\|.+$/,
    BSE_EQ: /^BSE_EQ\|.+$/,
    BSE_FO: /^BSE_FO\|\d+$/,
  };

  const segment = instrumentKey.split("|")[0];
  const pattern = patterns[segment];

  if (!pattern) {
    // console.warn(
    //   `⚠️ Unknown segment: ${segment} for instrument: ${instrumentKey}`
    // );
    return false;
  }

  const isValid = pattern.test(instrumentKey);
  if (!isValid) {
    console.warn(`⚠️ Invalid format for ${segment}: ${instrumentKey}`);
  }

  return isValid;
};

// Schedule reconnection with exponential backoff
const scheduleReconnection = () => {
  if (reconnectInterval || connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
    if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`
      );
    }
    return;
  }

  const delay = Math.min(
    RECONNECT_DELAY * Math.pow(2, connectionAttempts),
    60000
  ); // Max 60 seconds
  // console.log(`⏰ Scheduling reconnection in ${delay / 1000} seconds...`);

  reconnectInterval = setTimeout(async () => {
    reconnectInterval = null;
    try {
      await initUpstoxConnection();
    } catch (error) {
      console.error("❌ Reconnection failed:", error);
      scheduleReconnection();
    }
  }, delay);
};

// Initialize Upstox connection
const initUpstoxConnection = async () => {
  try {
    if (isConnecting || (upstoxWs && upstoxWs.readyState === WebSocket.OPEN)) {
      // console.log("⏳ Connection already exists or in progress");
      return;
    }

    const wsUrl = await getMarketFeedUrl();
    await connectUpstoxWebSocket(wsUrl);
    // console.log("✅ Upstox WebSocket connection established");
  } catch (error) {
    console.error("❌ Error connecting to Upstox:", error);
    connectionAttempts++;
    if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
      scheduleReconnection();
    }
  }
};

// Socket.IO setup
const { Server: SocketIOServer } = require("socket.io");
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Option Chain streaming
const {
  registerOptionChainSocket,
} = require("./routes/chart/niftychart.router");
registerOptionChainSocket(io);

// Market Data streaming
const {
  registerMarketStreamSocket,
} = require("./routes/market/marketStream.router");
const { marketDataService } = require("./services/marketData.service");
registerMarketStreamSocket(io, marketDataService);

// Restore subscriptions from Redis on startup or reconnect
async function restoreActiveSubscriptions() {
  try {
    const keys = await redisClient.smembers(ACTIVE_SUBS_KEY);
    if (keys && keys.length > 0) {
      // console.log(
      //   `🔄 Restoring ${keys.length} active subscriptions from Redis...`
      // );
      for (const key of keys) {
        if (!instrumentSubscriptions.has(key)) {
          instrumentSubscriptions.set(key, new Set());
        }
        subscribeToUpstoxInstrument(key);
      }
    }
  } catch (err) {
    console.error("❌ Error restoring active subscriptions from Redis:", err);
  }
}

// Add/remove instrumentKey to/from Redis set on subscribe/unsubscribe
async function addActiveSubscriptionKey(key) {
  try {
    await redisClient.sadd(ACTIVE_SUBS_KEY, key);
  } catch (e) {
    console.error("Redis sadd error:", e);
  }
}
async function removeActiveSubscriptionKey(key) {
  try {
    await redisClient.srem(ACTIVE_SUBS_KEY, key);
  } catch (e) {
    console.error("Redis srem error:", e);
  }
}

// Socket.IO connection handler
io.on("connection", (socket) => {
  // console.log(`🔌 Socket.IO client connected: ${socket.id}`);

  socket.on("subscribe", async (instrumentKey) => {
    if (!instrumentKey || typeof instrumentKey !== "string") {
      // console.error(
      //   `❌ Invalid instrumentKey received from ${socket.id}:`,
      //   instrumentKey
      // );
      socket.emit("subscriptionError", {
        instrumentKey,
        error: "Invalid instrument key format",
      });
      return;
    }

    // Validate instrument key format
    if (!validateInstrumentKey(instrumentKey)) {
      console.error(
        `❌ Invalid instrumentKey format from ${socket.id}:`,
        instrumentKey
      );
      socket.emit("subscriptionError", {
        instrumentKey,
        error: "Invalid instrument key format",
      });
      return;
    }

    // console.log(`📥 Subscribe request from ${socket.id} for: ${instrumentKey}`);

    // Join Socket.IO room
    socket.join(instrumentKey);

    // Add to subscriptions map
    if (!instrumentSubscriptions.has(instrumentKey)) {
      instrumentSubscriptions.set(instrumentKey, new Set());
      // Subscribe to Upstox for this instrument
      const subscribed = subscribeToUpstoxInstrument(instrumentKey);
      if (!subscribed) {
        console.warn(`⚠️ Failed to subscribe to Upstox for: ${instrumentKey}`);
      }
      // --- Add to Redis set ---
      addActiveSubscriptionKey(instrumentKey);
    }

    instrumentSubscriptions.get(instrumentKey).add(socket.id);

    const roomSize = io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;
    // console.log(
    //   `✅ Socket ${socket.id} subscribed to ${instrumentKey}. Room size: ${roomSize}`
    // );

    // --- SERVE REDIS CACHED DATA IMMEDIATELY FOR ALL INSTRUMENTS ---
    try {
      const cached = await redisClient.get(`option_live:${instrumentKey}`);
      if (cached) {
        socket.emit('marketData', {
            instrumentKey,
            data: JSON.parse(cached),
            timestamp: Date.now(),
            mode: 'cache'
        });
      }
    } catch (err) {
      console.error(`❌ Redis fetch error for ${instrumentKey}:`, err);
    }

    // Send confirmation to client
    socket.emit("subscriptionConfirmed", {
      instrumentKey,
      status: "subscribed",
      roomSize: roomSize,
      timestamp: Date.now(),
    });
  });

  // Unsubscribe from instrument
  socket.on("unsubscribe", (instrumentKey) => {
    if (!instrumentKey || typeof instrumentKey !== "string") {
      console.error(
        `❌ Invalid instrumentKey for unsubscribe from ${socket.id}:`,
        instrumentKey
      );
      return;
    }

    // console.log(`📤 Unsubscribe request from ${socket.id} for: ${instrumentKey}`);

    // Leave Socket.IO room
    socket.leave(instrumentKey);

    // Remove from subscriptions map
    if (instrumentSubscriptions.has(instrumentKey)) {
      instrumentSubscriptions.get(instrumentKey).delete(socket.id);
      if (instrumentSubscriptions.get(instrumentKey).size === 0) {
        instrumentSubscriptions.delete(instrumentKey);
        unsubscribeFromUpstoxInstrument(instrumentKey);
        // --- Remove from Redis set ---
        removeActiveSubscriptionKey(instrumentKey);
      }
    }

    const roomSize = io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;
    // console.log(
    //   `✅ Socket ${socket.id} unsubscribed from ${instrumentKey}. Room size: ${roomSize}`
    // );

    // Send confirmation to client
    socket.emit("unsubscriptionConfirmed", {
      instrumentKey,
      status: "unsubscribed",
    });
  });

  // Handle client requesting connection status
  socket.on("getConnectionStatus", () => {
    const status = {
      upstoxConnected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
      subscriptions: Array.from(instrumentSubscriptions.keys()),
      pendingSubscriptions: Array.from(pendingSubscriptions),
    };
    socket.emit("connectionStatus", status);
  });

  // Clean up on disconnect
  socket.on("disconnect", (reason) => {
    // console.log(
    //   `🔌 Socket.IO client disconnected: ${socket.id}, reason: ${reason}`
    // );

    // Clean up all subscriptions for this socket
    for (const [
      instrumentKey,
      subscribers,
    ] of instrumentSubscriptions.entries()) {
      if (subscribers.has(socket.id)) {
        subscribers.delete(socket.id);

        // If no more subscribers, unsubscribe from Upstox
        if (subscribers.size === 0) {
          instrumentSubscriptions.delete(instrumentKey);
          unsubscribeFromUpstoxInstrument(instrumentKey);
          // console.log(
          //   `🗑️  Cleaned up subscription for ${instrumentKey} (no more subscribers)`
          // );
        }
      }
    }
  });

  // FIX: Move requestData handler inside connection block
  socket.on("requestData", (instrumentKey) => {
    // console.log(`📋 Manual data request for: ${instrumentKey}`);

    // Send current subscription status
    const isSubscribed = instrumentSubscriptions.has(instrumentKey);
    const roomSize = io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;

    socket.emit("dataStatus", {
      instrumentKey,
      isSubscribed,
      roomSize,
      upstoxConnected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
      hasPendingSubscription: pendingSubscriptions.has(instrumentKey),
      timestamp: Date.now(),
    });

    // If subscribed but no recent data, try resubscribing
    if (isSubscribed && upstoxWs && upstoxWs.readyState === WebSocket.OPEN) {
      // console.log(
      //   `🔄 Attempting to refresh subscription for: ${instrumentKey}`
      // );
      subscribeToUpstoxInstrument(instrumentKey);
    }
  });
});

// Add periodic health check for subscriptions
setInterval(() => {
  // console.log(`📊 Subscription Health Check:`);
  // console.log(`   • Active subscriptions: ${instrumentSubscriptions.size}`);
  // console.log(`   • Pending subscriptions: ${pendingSubscriptions.size}`);
  // console.log(`   • Active timers: ${subscriptionTimers.size}`);
  // console.log(
  //   `   • Upstox connected: ${
  //     upstoxWs && upstoxWs.readyState === WebSocket.OPEN
  //   }`
  // );

  // Log all active subscriptions
  if (instrumentSubscriptions.size > 0) {
    // console.log(
    //   `   • Subscribed instruments:`,
    //   Array.from(instrumentSubscriptions.keys())
    // );
  }

  // Log pending subscriptions
  if (pendingSubscriptions.size > 0) {
    // console.log(`   • Pending instruments:`, Array.from(pendingSubscriptions));
  }
}, 60000); // Every minute

// Periodically send heartbeat to connected clients
setInterval(() => {
  io.emit("heartbeat", {
    timestamp: Date.now(),
    upstoxConnected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
    activeSubscriptions: instrumentSubscriptions.size,
  });
}, 30000); // Every 30 seconds

// Add this endpoint to verify instrument
app.get("/api/v1/verify-instrument/:instrumentKey", async (req, res) => {
  try {
    const instrumentKey = decodeURIComponent(req.params.instrumentKey);
    const apiInstance = new UpstoxClient.OptionsApi();

    // Try to get instrument details
    apiInstance.getOptionContracts(
      instrumentKey,
      "2025-07-3",
      (error, data) => {
        if (error) {
          res.json({ valid: false, error: error.message });
        } else {
          res.json({ valid: true, data });
        }
      }
    );
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});
// List of instrument keys to fetch expiry dates for
const EXPIRY_INSTRUMENTS = [
  "NSE_INDEX|Nifty 50",
  "NSE_INDEX|Nifty Bank",
  "NSE_INDEX|Nifty Fin Service",
];

const PREDEFINED_OPTION_KEYS = [
  "NSE_FO|56888",
  "NSE_FO|55994",
  "NSE_FO|55995",
  "NSE_FO|55996",
  "NSE_FO|55997",
  "NSE_FO|55998",
  "NSE_FO|55999",
  "NSE_FO|56000",
  "NSE_FO|56001",
  "NSE_FO|56002",
  "NSE_FO|56003",
  "NSE_FO|56004",
  "NSE_FO|56005",
  "NSE_FO|56006",
  "NSE_FO|56007",
  "NSE_FO|56008",
  "NSE_FO|56009",
  "NSE_FO|56010",
  "NSE_FO|56011",
  "NSE_FO|56012",
  "NSE_FO|56013",
  "NSE_FO|56014",
  "NSE_FO|56015",
  "NSE_FO|56016",
  "NSE_FO|56017",
  "NSE_FO|56018",
  "NSE_FO|56019",
  "NSE_FO|56020",
  "NSE_FO|56021",
  "NSE_FO|56022",
  "NSE_FO|56023",
  "NSE_FO|56024",
  "NSE_FO|56025",
  "NSE_FO|56026",
  "NSE_FO|56027",
  "NSE_FO|56028",
  "NSE_FO|56029",
  "NSE_FO|56030",
  "NSE_FO|56031",
  "NSE_FO|56032",
  "NSE_FO|56033",
  "NSE_FO|56034",
  "NSE_FO|56035",
  "NSE_FO|56036",
  "NSE_FO|56037",
  "NSE_FO|56038",
  "NSE_FO|56039",
  "NSE_FO|56040",
  "NSE_FO|56041",
  "NSE_FO|56042",
  "NSE_FO|65001",
  "NSE_FO|65002",
  "NSE_FO|65003",
  "NSE_FO|65004",
  "NSE_FO|65005",
  "NSE_FO|65006",
  "NSE_FO|65007",
  "NSE_FO|65008",
  "NSE_FO|65009",
  "NSE_FO|65010",
  "NSE_FO|65011",
  "NSE_FO|65012",
  "NSE_FO|65013",
  "NSE_FO|65014",
  "NSE_FO|65015",
  "NSE_FO|65016",
  "NSE_FO|65017",
  "NSE_FO|65018",
  "NSE_FO|65019",
  "NSE_FO|65020",
  "NSE_FO|65021",
  "NSE_FO|65022",
  "NSE_FO|65023",
  "NSE_FO|65024",
  "NSE_FO|65025",
  "NSE_FO|65026",
  "NSE_FO|65027",
  "NSE_FO|65028",
  "NSE_FO|65029",
  "NSE_FO|65030",
  "NSE_FO|65031",
  "NSE_FO|65032",
  "NSE_FO|65033",
  "NSE_FO|65034",
  "NSE_FO|65035",
  "NSE_FO|65036",
  "NSE_FO|65037",
  "NSE_FO|65038",
  "NSE_FO|65039",
  "NSE_FO|65040",
  "NSE_FO|65041",
  "NSE_FO|65042",
  "NSE_FO|65043",
  "NSE_FO|65044",
  "NSE_FO|65045",
  "NSE_FO|65046",
  "NSE_FO|65047",
  "NSE_FO|65048",
  "NSE_FO|65049",
  "NSE_FO|65050",
];

// 2. On Upstox WebSocket connection, subscribe to all predefined options
async function subscribePredefinedOptions() {
  for (const key of PREDEFINED_OPTION_KEYS) {
    if (!instrumentSubscriptions.has(key)) {
      instrumentSubscriptions.set(key, new Set(["server"])); // Server subscription mark करें
    }
    subscribeToUpstoxInstrument(key);
  }
}

// Start server
server.listen(PORT, async () => {
  // console.log(`🚀 Server running on port ${PORT}`);
  try {
    await initializeMarketDataService();
    await initProtobuf();
    await initUpstoxConnection();
    // console.log("✅ All services initialized successfully");

    // Start memory monitoring
    setInterval(logMemoryUsage, 5 * 60 * 1000); // Log every 5 minutes
  } catch (error) {
    console.error("❌ Failed to initialize services:", error);
  }
});

// Graceful shutdown handler
const gracefulShutdown = () => {
  // console.log("🛑 Shutting down gracefully...");
  // console.log("📊 Final Memory Usage:");
  logMemoryUsage();

  // Clear all timers
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }

  subscriptionTimers.forEach((timer) => clearTimeout(timer));
  retryTimers.forEach((timer) => clearTimeout(timer));

  // Close Socket.IO
  if (io) {
    io.close(() => {
      // console.log("✅ Socket.IO server closed");
    });
  }

  // Close Upstox WebSocket
  if (upstoxWs) {
    upstoxWs.close();
    // console.log("✅ Upstox WebSocket closed");
  }

  // Close HTTP server
  server.close(() => {
    // console.log("✅ HTTP server stopped");
    process.exit(0);
  });
};

// API: Get latest live option data for a predefined instrumentKey
app.get("/api/v1/option-live/:instrumentKey", async (req, res) => {
  try {
    const instrumentKey = decodeURIComponent(req.params.instrumentKey);
    // Validate instrument key
    if (!validateInstrumentKey(instrumentKey)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid instrument key format" });
    }
    if (!PREDEFINED_OPTION_KEYS.includes(instrumentKey)) {
      return res
        .status(404)
        .json({
          success: false,
          error: "Instrument key not in predefined list",
        });
    }
    const cached = await redisClient.get(`option_live:${instrumentKey}`);
    if (!cached) {
      return res
        .status(404)
        .json({
          success: false,
          error: "No live data found for this instrument key",
        });
    }
    return res.json({
      success: true,
      instrumentKey,
      data: JSON.parse(cached),
      timestamp: Date.now(),
      mode: "cache",
    });
  } catch (err) {
    console.error("❌ Error in /api/v1/option-live/:instrumentKey:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "Internal server error",
        details: err.message,
      });
  }
});

// Leaderboard real-time data endpoint
app.get("/api/v1/leaderboard/contest/:contestId/realtime", async (req, res) => {
  try {
    const contestId = req.params.contestId;
    const cached = await redisClient.get(`leaderboard:contest:${contestId}`);
    if (!cached) {
      return res.status(404).json({ error: "No leaderboard data found" });
    }
    res.json(JSON.parse(cached));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard", details: err.message });
  }
});

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, "../dist")));

// Handle React router
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

// API to update/insert .env key-value (admin only)
app.post("/api/v1/env", async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || typeof value === "undefined") {
      return res
        .status(400)
        .json({ success: false, error: "Missing key or value" });
    }

    const envPath = path.join(__dirname, "../.env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    const lines = envContent.split("\n");
    let found = false;
    const newLines = lines.map((line) => {
      if (line.startsWith(key + "=")) {
        found = true;
        return `${key}=${value}`;
      }
      return line;
    });

    if (!found) {
      newLines.push(`${key}=${value}`);
    }

    fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");
    res.json({
      success: true,
      message: found ? "Updated" : "Inserted",
      key,
      value,
    });
    // Restart the server after .env update
    // console.log("🔄 .env updated, restarting server...");
    process.exit(0);
  } catch (err) {
    console.error("Error updating .env:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update .env",
        details: err.message,
      });
  }
});

// Health check endpoint
app.get("/api/v1/health", (req, res) => {
  const status = {
    server: "running",
    upstoxWebSocket:
      upstoxWs && upstoxWs.readyState === WebSocket.OPEN
        ? "connected"
        : "disconnected",
    activeSubscriptions: instrumentSubscriptions.size,
    pendingSubscriptions: pendingSubscriptions.size,
    connectedClients: io.engine.clientsCount,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  };
  res.json(status);
});

module.exports = app;
