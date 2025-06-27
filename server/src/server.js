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
const fs = require('fs');

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
app.use('/api/v1/smtp-details', authenticateToken, require('./routes/user/smtp.routes'));
app.use('/api/v1', require('./utils/profileupload'));
app.use('/api/v1', require('./routes/contest/bulk.router'));
app.use('/api/v1', require('./routes/user/price.router'));
app.use('/api/v1', require('./routes/dashboard/dashboard.router'));

// Error handling middleware
app.use(errorHandler);

// Memory management functions
function formatMemoryUsage(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

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

// Initialize protobuf
const initProtobuf = async () => {
    try {
        protobufRoot = await protobuf.load(path.join(__dirname, "MarketDataFeed.proto"));
        console.log("✅ Protobuf schema loaded successfully");
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
        const MarketDataFeed = protobufRoot.lookupType("com.upstox.marketdatafeeder.rpc.proto.FeedResponse");
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
                console.log("✅ Upstox WebSocket URL obtained");
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
        console.log(`⏳ Adding ${instrumentKey} to pending subscriptions (WebSocket not ready)`);
        pendingSubscriptions.add(instrumentKey);
        return false;
    }

    try {
        const subscriptionData = {
            guid: `sub-${instrumentKey}-${Date.now()}`,
            method: "sub",
            data: {
                mode: "full", // Try "ltpc" mode for basic data
                instrumentKeys: [instrumentKey],
            },
        };

        upstoxWs.send(Buffer.from(JSON.stringify(subscriptionData)));
        console.log(`📡 Subscribed to Upstox for: ${instrumentKey} with mode: ${subscriptionData.data.mode}`);
        
        // Enhanced logging for subscription confirmation
        console.log(`📋 Subscription payload:`, JSON.stringify(subscriptionData, null, 2));

        // Set up timeout to detect if no data is received
        const timeoutId = setTimeout(() => {
            console.warn(`⚠️  No data received for ${instrumentKey} after 15 seconds`);
            // Try resubscribing with different mode
            console.log(`🔄 Attempting resubscription with 'ltpc' mode for ${instrumentKey}`);
            resubscribeWithDifferentMode(instrumentKey);
        }, 15000);
        subscriptionTimers.set(instrumentKey, timeoutId);

        // Set up retry mechanism with exponential backoff
        const retryId = setTimeout(() => {
            console.warn(`🔄 Retrying subscription for ${instrumentKey} after 45 seconds`);
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
        console.log(`📡 Unsubscribed from ${instrumentKey} before mode change`);

        // Wait a moment then resubscribe with ltpc mode
        setTimeout(() => {
            const subscriptionData = {
                guid: `sub-${instrumentKey}-${Date.now()}`,
                method: "sub",
                data: {
                    mode: "ltpc", // Try with ltpc mode
                    instrumentKeys: [instrumentKey],
                },
            };
            upstoxWs.send(Buffer.from(JSON.stringify(subscriptionData)));
            console.log(`📡 Resubscribed to ${instrumentKey} with ltpc mode`);
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
            console.log(`📡 Unsubscribed from Upstox for: ${instrumentKey}`);
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
        console.log(`🔄 Processing ${pendingSubscriptions.size} pending subscriptions`);
        const subscriptionsToProcess = Array.from(pendingSubscriptions);
        pendingSubscriptions.clear();
        
        subscriptionsToProcess.forEach(instrumentKey => {
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
            console.log("⏳ Connection already in progress...");
            return;
        }

        isConnecting = true;
        console.log(`🔗 Attempting to connect to Upstox WebSocket (Attempt ${connectionAttempts + 1})`);

        const ws = new WebSocket(wsUrl, {
            headers: {
                "Api-Version": apiVersion,
                Authorization: "Bearer " + OAUTH2.accessToken,
            },
            followRedirects: true,
            perMessageDeflate: false
        });

        const connectionTimeout = setTimeout(() => {
            console.error("❌ WebSocket connection timeout");
            ws.terminate();
            isConnecting = false;
            reject(new Error("Connection timeout"));
        }, 30000); // 30 second timeout

        ws.on("open", () => {
            clearTimeout(connectionTimeout);
            console.log("✅ Upstox WebSocket connected successfully");
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
            console.log(`🔌 Upstox WebSocket disconnected. Code: ${code}, Reason: ${reason}`);
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
            console.log(`📦 Received binary data of size: ${data.length} bytes`);
            
            const decodedData = decodeProtobuf(data);
            if (decodedData) {
                console.log(`📊 Decoded data structure:`, JSON.stringify(decodedData, null, 2));
                
                if (decodedData.feeds) {
                    const receivedKeys = Object.keys(decodedData.feeds);
                    console.log(`📊 Received data for ${receivedKeys.length} instruments:`, receivedKeys);

                    for (const [instrumentKey, feed] of Object.entries(decodedData.feeds)) {
                        // Clear timers for this instrument
                        cleanupSubscriptionTimers(instrumentKey);

                        // Log the actual feed data
                        console.log(`📈 Feed data for ${instrumentKey}:`, JSON.stringify(feed, null, 2));

                        // Get room size and emit data
                        const roomSize = io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;
                        if (roomSize > 0) {
                            console.log(`📤 Emitting data for ${instrumentKey} to ${roomSize} clients`);
                            io.to(instrumentKey).emit('marketData', { 
                                instrumentKey, 
                                data: feed,
                                timestamp: Date.now(),
                                mode: 'realtime'
                            });
                        } else {
                            console.log(`⚠️  No clients subscribed to ${instrumentKey}, but received data`);
                        }
                    }
                } else if (decodedData.type) {
                    // Handle different message types
                    console.log(`📩 Received message type: ${decodedData.type}`);
                    if (decodedData.type === 'ack') {
                        console.log(`✅ Subscription acknowledgment received`);
                    } else if (decodedData.type === 'error') {
                        console.error(`❌ Error from Upstox:`, decodedData);
                    }
                } else {
                    console.log(`⚠️  Received data without feeds or type:`, decodedData);
                }
            } else {
                console.error(`❌ Failed to decode protobuf data`);
                // Log raw data for debugging
                console.log(`🔍 Raw data (first 100 bytes):`, data.slice(0, 100));
            }
        } else {
            const message = data.toString();
            console.log("📩 Received text message:", message);
            
            // Try to parse as JSON for subscription confirmations
            try {
                const jsonMessage = JSON.parse(message);
                console.log("📋 Parsed JSON message:", jsonMessage);
                
                // Handle subscription confirmations
                if (jsonMessage.type === 'connection_ack') {
                    console.log("✅ Connection acknowledged by Upstox");
                } else if (jsonMessage.type === 'subscription_ack') {
                    console.log("✅ Subscription acknowledged for:", jsonMessage.instrumentKeys);
                }
            } catch (parseError) {
                console.log("📝 Non-JSON text message received");
            }
        }
    } catch (error) {
        console.error("❌ Error processing WebSocket message:", error);
        console.error("🔍 Error stack:", error.stack);
    }
});

        // Handle ping/pong for connection health
        ws.on('ping', () => {
            console.log('🏓 Received ping from Upstox');
            ws.pong();
        });

        ws.on('pong', () => {
            console.log('🏓 Received pong from Upstox');
        });
    });
};

// Function to validate instrument key format
const validateInstrumentKey = (instrumentKey) => {
    // NSE_FO format: NSE_FO|token_number
    const patterns = {
        'NSE_EQ': /^NSE_EQ\|.+$/,
        'NSE_FO': /^NSE_FO\|\d+$/,
        'NSE_INDEX': /^NSE_INDEX\|.+$/,
        'BSE_EQ': /^BSE_EQ\|.+$/,
        'BSE_FO': /^BSE_FO\|\d+$/,
    };
    
    const segment = instrumentKey.split('|')[0];
    const pattern = patterns[segment];
    
    if (!pattern) {
        console.warn(`⚠️ Unknown segment: ${segment} for instrument: ${instrumentKey}`);
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
            console.error(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`);
        }
        return;
    }

    const delay = Math.min(RECONNECT_DELAY * Math.pow(2, connectionAttempts), 60000); // Max 60 seconds
    console.log(`⏰ Scheduling reconnection in ${delay / 1000} seconds...`);

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
            console.log("⏳ Connection already exists or in progress");
            return;
        }

        const wsUrl = await getMarketFeedUrl();
        await connectUpstoxWebSocket(wsUrl);
        console.log("✅ Upstox WebSocket connection established");
    } catch (error) {
        console.error("❌ Error connecting to Upstox:", error);
        connectionAttempts++;
        if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
            scheduleReconnection();
        }
    }
};

// Socket.IO setup
const { Server: SocketIOServer } = require('socket.io');
const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Option Chain streaming
const { registerOptionChainSocket } = require('./routes/chart/niftychart.router');
registerOptionChainSocket(io);

// Market Data streaming
const { registerMarketStreamSocket } = require('./routes/market/marketStream.router');
const { marketDataService } = require('./services/marketData.service');
registerMarketStreamSocket(io, marketDataService);

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log(`🔌 Socket.IO client connected: ${socket.id}`);

    socket.on('subscribe', (instrumentKey) => {
        if (!instrumentKey || typeof instrumentKey !== 'string') {
            console.error(`❌ Invalid instrumentKey received from ${socket.id}:`, instrumentKey);
            socket.emit('subscriptionError', { 
                instrumentKey, 
                error: 'Invalid instrument key format' 
            });
            return;
        }

        // Validate instrument key format
        if (!validateInstrumentKey(instrumentKey)) {
            console.error(`❌ Invalid instrumentKey format from ${socket.id}:`, instrumentKey);
            socket.emit('subscriptionError', { 
                instrumentKey, 
                error: 'Invalid instrument key format' 
            });
            return;
        }

        console.log(`📥 Subscribe request from ${socket.id} for: ${instrumentKey}`);
        
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
        }
        
        instrumentSubscriptions.get(instrumentKey).add(socket.id);
        
        const roomSize = io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;
        console.log(`✅ Socket ${socket.id} subscribed to ${instrumentKey}. Room size: ${roomSize}`);

        // Send confirmation to client
        socket.emit('subscriptionConfirmed', { 
            instrumentKey, 
            status: 'subscribed',
            roomSize: roomSize,
            timestamp: Date.now()
        });
    });



    // Unsubscribe from instrument
    socket.on('unsubscribe', (instrumentKey) => {
        if (!instrumentKey || typeof instrumentKey !== 'string') {
            console.error(`❌ Invalid instrumentKey for unsubscribe from ${socket.id}:`, instrumentKey);
            return;
        }

        console.log(`📤 Unsubscribe request from ${socket.id} for: ${instrumentKey}`);
        
        // Leave Socket.IO room
        socket.leave(instrumentKey);

        // Remove from subscriptions map
        if (instrumentSubscriptions.has(instrumentKey)) {
            instrumentSubscriptions.get(instrumentKey).delete(socket.id);
            
            // If no more subscribers, unsubscribe from Upstox
            if (instrumentSubscriptions.get(instrumentKey).size === 0) {
                instrumentSubscriptions.delete(instrumentKey);
                unsubscribeFromUpstoxInstrument(instrumentKey);
            }
        }

        const roomSize = io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;
        console.log(`✅ Socket ${socket.id} unsubscribed from ${instrumentKey}. Room size: ${roomSize}`);

        // Send confirmation to client
        socket.emit('unsubscriptionConfirmed', { instrumentKey, status: 'unsubscribed' });
    });

    // Handle client requesting connection status
    socket.on('getConnectionStatus', () => {
        const status = {
            upstoxConnected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
            subscriptions: Array.from(instrumentSubscriptions.keys()),
            pendingSubscriptions: Array.from(pendingSubscriptions)
        };
        socket.emit('connectionStatus', status);
    });

    // Clean up on disconnect
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Clean up all subscriptions for this socket
        for (const [instrumentKey, subscribers] of instrumentSubscriptions.entries()) {
            if (subscribers.has(socket.id)) {
                subscribers.delete(socket.id);
                
                // If no more subscribers, unsubscribe from Upstox
                if (subscribers.size === 0) {
                    instrumentSubscriptions.delete(instrumentKey);
                    unsubscribeFromUpstoxInstrument(instrumentKey);
                    console.log(`🗑️  Cleaned up subscription for ${instrumentKey} (no more subscribers)`);
                }
            }
        }
    });

    // FIX: Move requestData handler inside connection block
    socket.on('requestData', (instrumentKey) => {
        console.log(`📋 Manual data request for: ${instrumentKey}`);
        
        // Send current subscription status
        const isSubscribed = instrumentSubscriptions.has(instrumentKey);
        const roomSize = io.sockets.adapter.rooms.get(instrumentKey)?.size || 0;
        
        socket.emit('dataStatus', {
            instrumentKey,
            isSubscribed,
            roomSize,
            upstoxConnected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
            hasPendingSubscription: pendingSubscriptions.has(instrumentKey),
            timestamp: Date.now()
        });
        
        // If subscribed but no recent data, try resubscribing
        if (isSubscribed && upstoxWs && upstoxWs.readyState === WebSocket.OPEN) {
            console.log(`🔄 Attempting to refresh subscription for: ${instrumentKey}`);
            subscribeToUpstoxInstrument(instrumentKey);
        }
    });
});

// Add periodic health check for subscriptions
setInterval(() => {
    console.log(`📊 Subscription Health Check:`);
    console.log(`   • Active subscriptions: ${instrumentSubscriptions.size}`);
    console.log(`   • Pending subscriptions: ${pendingSubscriptions.size}`);
    console.log(`   • Active timers: ${subscriptionTimers.size}`);
    console.log(`   • Upstox connected: ${upstoxWs && upstoxWs.readyState === WebSocket.OPEN}`);
    
    // Log all active subscriptions
    if (instrumentSubscriptions.size > 0) {
        console.log(`   • Subscribed instruments:`, Array.from(instrumentSubscriptions.keys()));
    }
    
    // Log pending subscriptions
    if (pendingSubscriptions.size > 0) {
        console.log(`   • Pending instruments:`, Array.from(pendingSubscriptions));
    }
}, 60000); // Every minute

// Periodically send heartbeat to connected clients
setInterval(() => {
    io.emit('heartbeat', { 
        timestamp: Date.now(),
        upstoxConnected: upstoxWs && upstoxWs.readyState === WebSocket.OPEN,
        activeSubscriptions: instrumentSubscriptions.size
    });
}, 30000); // Every 30 seconds


// Add this endpoint to verify instrument
app.get('/api/v1/verify-instrument/:instrumentKey', async (req, res) => {
    try {
        const instrumentKey = decodeURIComponent(req.params.instrumentKey);
        const apiInstance = new UpstoxClient.OptionsApi();
        
        // Try to get instrument details
        apiInstance.getOptionContracts(instrumentKey, '2025-01-30', (error, data) => {
            if (error) {
                res.json({ valid: false, error: error.message });
            } else {
                res.json({ valid: true, data });
            }
        });
    } catch (error) {
        res.json({ valid: false, error: error.message });
    }
});
// List of instrument keys to fetch expiry dates for
const EXPIRY_INSTRUMENTS = [
    'NSE_INDEX|Nifty 50',
    'NSE_INDEX|Nifty Bank',
    'NSE_INDEX|Nifty Fin Service',
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

// Start server
server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
        await initializeMarketDataService();
        await initProtobuf();
        await initUpstoxConnection();
        console.log('✅ All services initialized successfully');
        
        // Start memory monitoring
        setInterval(logMemoryUsage, 5 * 60 * 1000); // Log every 5 minutes
    } catch (error) {
        console.error('❌ Failed to initialize services:', error);
    }
});

// Graceful shutdown handler
const gracefulShutdown = () => {
    console.log('🛑 Shutting down gracefully...');
    console.log('📊 Final Memory Usage:');
    logMemoryUsage();

    // Clear all timers
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
    }
    
    subscriptionTimers.forEach(timer => clearTimeout(timer));
    retryTimers.forEach(timer => clearTimeout(timer));

    // Close Socket.IO
    if (io) {
        io.close(() => {
            console.log('✅ Socket.IO server closed');
        });
    }

    // Close Upstox WebSocket
    if (upstoxWs) {
        upstoxWs.close();
        console.log('✅ Upstox WebSocket closed');
    }

    // Close HTTP server
    server.close(() => {
        console.log('✅ HTTP server stopped');
        process.exit(0);
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Handle React router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// API to update/insert .env key-value (admin only)
app.post('/api/v1/env', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || typeof value === 'undefined') {
            return res.status(400).json({ success: false, error: 'Missing key or value' });
        }
        
        const envPath = path.join(__dirname, '../.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }
        
        const lines = envContent.split('\n');
        let found = false;
        const newLines = lines.map(line => {
            if (line.startsWith(key + '=')) {
                found = true;
                return `${key}=${value}`;
            }
            return line;
        });
        
        if (!found) {
            newLines.push(`${key}=${value}`);
        }
        
        fs.writeFileSync(envPath, newLines.join('\n'), 'utf-8');
        res.json({ success: true, message: found ? 'Updated' : 'Inserted', key, value });
    } catch (err) {
        console.error('Error updating .env:', err);
        res.status(500).json({ success: false, error: 'Failed to update .env', details: err.message });
    }
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
    const status = {
        server: 'running',
        upstoxWebSocket: upstoxWs && upstoxWs.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
        activeSubscriptions: instrumentSubscriptions.size,
        pendingSubscriptions: pendingSubscriptions.size,
        connectedClients: io.engine.clientsCount,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
    };
    res.json(status);
});

module.exports = app;