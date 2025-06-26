const UpstoxClient = require("upstox-js-sdk");
const WebSocket = require("ws");
const path = require('path');
const protobuf = require("protobufjs");

class MarketDataService {
  constructor() {
    this.protobufRoot = null;
    this.defaultClient = UpstoxClient.ApiClient.instance;
    this.apiVersion = "2.0";
    this.OAUTH2 = this.defaultClient.authentications["OAUTH2"];
    this.OAUTH2.accessToken = process.env.ACCESS_TOKEN || "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI2UEI2TVkiLCJqdGkiOiI2ODMzZTlmMjRlOWRkNzVmNjYwODNhMWUiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc0ODIzMjY5MCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzQ4Mjk2ODAwfQ.8LD1EfOv2c6DkfDOfvB9yOtvHUHvBgIxks5nCLg7eq0";
    this.upstoxWs = null;
    this.streamingResponses = new Map();
    this.keepAliveInterval = null;
    this.reconnectTimeout = null;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.isInitialized = false;
    this.subscriptionQueue = new Set(); // Track pending subscriptions
    this.lastHeartbeat = Date.now();
    this.heartbeatInterval = null;
    this.socketStreamingClients = new Map(); // instrumentKey -> Set of sockets
  }

  // Initialize protobuf schema
  async initProtobuf() {
    try {
      // Try multiple possible paths for the proto file
      const possiblePaths = [
        path.join(__dirname, "../proto/MarketDataFeed.proto"),
        path.join(__dirname, "../../proto/MarketDataFeed.proto"),
        path.join(__dirname, "MarketDataFeed.proto"),
        path.join(process.cwd(), "MarketDataFeed.proto"),
        path.join(process.cwd(), "proto/MarketDataFeed.proto")
      ];

      for (const protoPath of possiblePaths) {
        try {
          this.protobufRoot = await protobuf.load(protoPath);
          console.log(`Protobuf schema loaded successfully from: ${protoPath}`);
          return true;
        } catch (error) {
          console.log(`Failed to load proto from ${protoPath}`);
        }
      }
      
      console.warn("Could not load protobuf schema from any path. Continuing without protobuf support.");
      return false;
    } catch (error) {
      console.error("Error initializing protobuf:", error);
      return false;
    }
  }

  // Get market data feed authorization URL
  async getMarketFeedUrl() {
    return new Promise((resolve, reject) => {
      const apiInstance = new UpstoxClient.WebsocketApi();
      apiInstance.getMarketDataFeedAuthorize(this.apiVersion, (error, data) => {
        if (error) {
          console.error("Market feed authorization error:", error);
          reject(new Error(`Authorization failed: ${error.message || error}`));
        } else {
          console.log("Market feed URL obtained:", data.data.authorizedRedirectUri);
          resolve(data.data.authorizedRedirectUri);
        }
      });
    });
  }

  // Connect to Upstox WebSocket
  async connectUpstoxWebSocket(wsUrl) {
    return new Promise((resolve, reject) => {
      console.log("Attempting to connect to WebSocket:", wsUrl);
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          "Api-Version": this.apiVersion,
          Authorization: "Bearer " + this.OAUTH2.accessToken,
        },
        followRedirects: true,
        perMessageDeflate: false,
        handshakeTimeout: 10000, // 10 second timeout
        maxPayload: 100 * 1024 * 1024 // 100MB max payload
      });

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          reject(new Error("WebSocket connection timeout"));
        }
      }, 15000);

      ws.on("open", () => {
        clearTimeout(connectionTimeout);
        console.log("Upstox WebSocket connected successfully");
        this.upstoxWs = ws;
        this.connectionRetries = 0;
        this.lastHeartbeat = Date.now();
        
        this.startKeepAlive();
        this.startHeartbeatMonitor();
        
        // Process subscription queue
        this.processSubscriptionQueue();
        
        // Resubscribe to all active instruments
        this.streamingResponses.forEach((_, instrumentKey) => {
          this.subscribeToInstrument(instrumentKey);
        });
        
        // Notify all clients about reconnection
        this.notifyClientsReconnection();
        
        resolve(ws);
      });

      ws.on("error", (error) => {
        clearTimeout(connectionTimeout);
        console.error("Upstox WebSocket error:", error);
        reject(error);
      });

      ws.on("close", (code, reason) => {
        clearTimeout(connectionTimeout);
        console.log(`Upstox WebSocket disconnected with code ${code}: ${reason.toString()}`);
        this.upstoxWs = null;
        this.stopKeepAlive();
        this.stopHeartbeatMonitor();
        
        // Notify all streaming clients about disconnection
        this.notifyClientsDisconnection();
        
        // Attempt reconnection after delay if not max retries reached
        if (this.connectionRetries < this.maxRetries) {
          this.connectionRetries++;
          const delay = Math.min(5000 * this.connectionRetries, 30000);
          // console.log(`Attempting reconnection in ${delay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`);
          this.reconnectTimeout = setTimeout(() => this.initConnection(), delay);
        } else {
          console.error("Max reconnection attempts reached. Manual intervention required.");
          this.notifyClientsMaxRetriesReached();
        }
      });

      ws.on("message", (data) => {
        this.lastHeartbeat = Date.now();
        this.handleWebSocketMessage(data);
      });

      ws.on("ping", (data) => {
        // console.log("Received ping from server");
        this.lastHeartbeat = Date.now();
      });

      ws.on("pong", (data) => {
        // console.log("Received pong from server");
        this.lastHeartbeat = Date.now();
      });
    });
  }

  // Start heartbeat monitor
  startHeartbeatMonitor() {
    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > 60000) { // 60 seconds without any message
        console.warn("No heartbeat received for 60 seconds, connection may be stale");
        if (this.upstoxWs && this.upstoxWs.readyState === WebSocket.OPEN) {
          this.upstoxWs.ping();
        }
      }
      
      if (timeSinceLastHeartbeat > 120000) { // 2 minutes without any message
        console.error("Connection appears dead, forcing reconnection");
        if (this.upstoxWs) {
          this.upstoxWs.terminate();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Stop heartbeat monitor
  stopHeartbeatMonitor() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Process subscription queue
  processSubscriptionQueue() {
    if (this.subscriptionQueue.size > 0) {
      console.log(`Processing ${this.subscriptionQueue.size} queued subscriptions`);
      this.subscriptionQueue.forEach(instrumentKey => {
        this.subscribeToInstrument(instrumentKey);
      });
      this.subscriptionQueue.clear();
    }
  }

  // Handle incoming WebSocket messages
  async handleWebSocketMessage(data) {
    try {
      if (data instanceof Buffer) {
        // Try to decode protobuf first if available
        if (this.protobufRoot) {
          try {
            const decodedData = this.decodeProtobuf(data);
            console.log("Decoded protobuf data:", JSON.stringify(decodedData, null, 2));
            
            if (decodedData.feeds) {
              for (const [instrumentKey, feed] of Object.entries(decodedData.feeds)) {
                console.log(`Broadcasting feed data for ${instrumentKey}:`, feed);
                this.broadcastToClients(instrumentKey, feed);
              }
            } else {
              console.log("No feeds found in decoded data");
            }
            return;
          } catch (protobufError) {
            console.warn("Protobuf decoding failed:", protobufError.message);
          }
        }
        
        // Fallback: Try to parse as JSON string
        try {
          const jsonString = data.toString('utf8');
          if (jsonString.trim()) {
            const jsonData = JSON.parse(jsonString);
            console.log("Received JSON data:", jsonData);
            this.handleJsonMessage(jsonData);
          }
        } catch (jsonError) {
          console.warn("JSON parsing failed:", jsonError.message);
          console.log("Raw binary data length:", data.length);
          
          // Try to interpret as simple binary format
          this.handleBinaryData(data);
        }
      } else {
        // Handle string messages
        try {
          const jsonData = JSON.parse(data.toString());
          console.log("Received WebSocket string message:", jsonData);
          this.handleJsonMessage(jsonData);
        } catch (error) {
          console.log("Received non-JSON string data:", data.toString());
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }

  // Handle JSON messages
  handleJsonMessage(jsonData) {
    if (jsonData.type === 'ack') {
      console.log("Subscription acknowledged:", jsonData);
    } else if (jsonData.type === 'feed' || jsonData.data) {
      const instrumentKey = jsonData.instrumentKey || jsonData.instrument_key;
      if (instrumentKey && jsonData.data) {
        console.log(`Broadcasting JSON feed data for ${instrumentKey}:`, jsonData.data);
        this.broadcastToClients(instrumentKey, jsonData.data);
      }
    } else if (jsonData.feeds) {
      // Handle feeds object
      for (const [instrumentKey, feed] of Object.entries(jsonData.feeds)) {
        console.log(`Broadcasting feeds data for ${instrumentKey}:`, feed);
        this.broadcastToClients(instrumentKey, feed);
      }
    }
  }

  // Handle binary data (fallback)
  handleBinaryData(data) {
    try {
      // Simple binary parsing - this is a fallback and may need adjustment
      // based on actual Upstox binary format
      console.log("Attempting simple binary parsing...");
      
      // For demonstration, create mock data
      // In reality, you'd need to parse according to Upstox's binary format
      const mockFeedData = {
        ltp: Math.random() * 1000 + 100,
        change: (Math.random() - 0.5) * 20,
        volume: Math.floor(Math.random() * 10000),
        timestamp: Date.now(),
        source: 'binary_fallback'
      };
      
      // Broadcast to all active instruments (fallback behavior)
      this.streamingResponses.forEach((_, instrumentKey) => {
        console.log(`Broadcasting fallback data for ${instrumentKey}:`, mockFeedData);
        this.broadcastToClients(instrumentKey, mockFeedData);
      });
    } catch (error) {
      console.error("Error handling binary data:", error);
    }
  }

  // Decode protobuf data
  decodeProtobuf(buffer) {
    if (!this.protobufRoot) {
      throw new Error("Protobuf not initialized");
    }
    
    try {
      const MarketDataFeed = this.protobufRoot.lookupType("com.upstox.marketdatafeeder.rpc.proto.FeedResponse");
      const decodedMessage = MarketDataFeed.decode(buffer);
      return MarketDataFeed.toObject(decodedMessage, {
        longs: String,
        enums: String,
        bytes: String,
      });
    } catch (error) {
      console.error("Protobuf decode error:", error);
      throw error;
    }
  }

  // Subscribe to an instrument
  subscribeToInstrument(instrumentKey) {
    if (this.upstoxWs && this.upstoxWs.readyState === WebSocket.OPEN) {
      const data = {
        guid: `sub-${instrumentKey}-${Date.now()}`,
        method: "sub",
        data: {
          mode: "full",
          instrumentKeys: [instrumentKey],
        },
      };
      
      try {
        const message = JSON.stringify(data);
        this.upstoxWs.send(message);
        console.log(`Successfully subscribed to instrument: ${instrumentKey}`);
        
        // Remove from queue if it was there
        this.subscriptionQueue.delete(instrumentKey);
        
        // Send test data after subscription (for testing)
        setTimeout(() => {
          const testData = {
            ltp: Math.random() * 1000 + 100,
            change: (Math.random() - 0.5) * 20,
            volume: Math.floor(Math.random() * 10000),
            timestamp: Date.now(),
            source: 'test_data_after_subscription'
          };
          // console.log(`Sending test data for ${instrumentKey}:`, testData);
          this.broadcastToClients(instrumentKey, testData);
        }, 2000);
        
      } catch (error) {
        console.error(`Error subscribing to ${instrumentKey}:`, error);
      }
    } else {
      console.warn(`Cannot subscribe to ${instrumentKey}: WebSocket not connected. Adding to queue.`);
      this.subscriptionQueue.add(instrumentKey);
    }
  }

  // Unsubscribe from an instrument
  unsubscribeFromInstrument(instrumentKey) {
    if (this.upstoxWs && this.upstoxWs.readyState === WebSocket.OPEN) {
      const data = {
        guid: `unsub-${instrumentKey}-${Date.now()}`,
        method: "unsub",
        data: {
          instrumentKeys: [instrumentKey],
        },
      };
      
      try {
        const message = JSON.stringify(data);
        this.upstoxWs.send(message);
        console.log(`Successfully unsubscribed from instrument: ${instrumentKey}`);
      } catch (error) {
        console.error(`Error unsubscribing from ${instrumentKey}:`, error);
      }
    }
    
    // Remove from subscription queue if present
    this.subscriptionQueue.delete(instrumentKey);
  }

  // Add client to streaming
  addStreamingClient(instrumentKey, response) {
    if (!this.streamingResponses.has(instrumentKey)) {
      this.streamingResponses.set(instrumentKey, []);
      this.subscribeToInstrument(instrumentKey);
    }
    
    this.streamingResponses.get(instrumentKey).push(response);
    console.log(`Client added for streaming: ${instrumentKey} (total clients: ${this.streamingResponses.get(instrumentKey).length})`);
    
    // Send current connection status to new client
    const status = this.getConnectionStatus();
    const statusMessage = {
      type: 'status',
      connected: status.connected,
      instrumentKey: instrumentKey,
      message: status.connected ? 'Connected and subscribed' : 'Connecting...',
      timestamp: Date.now()
    };
    
    try {
      response.write(`data: ${JSON.stringify(statusMessage)}\n\n`);
      // console.log(`Sent status to new client for ${instrumentKey}:`, statusMessage);
    } catch (error) {
      console.error('Error sending status to new client:', error);
    }
    
    // Send initial test data
    setTimeout(() => {
      const testData = {
        ltp: Math.random() * 1000 + 100,
        change: (Math.random() - 0.5) * 20,
        volume: Math.floor(Math.random() * 10000),
        timestamp: Date.now(),
        source: 'initial_test_data'
      };
      console.log(`Sending initial test data for ${instrumentKey}:`, testData);
      this.broadcastToClients(instrumentKey, testData);
    }, 1000);
  }

  // Remove client from streaming
  removeStreamingClient(instrumentKey, response) {
    const responses = this.streamingResponses.get(instrumentKey);
    if (responses) {
      const index = responses.indexOf(response);
      if (index > -1) {
        responses.splice(index, 1);
        console.log(`Client removed for ${instrumentKey} (remaining: ${responses.length})`);
      }
      
      if (responses.length === 0) {
        this.streamingResponses.delete(instrumentKey);
        this.unsubscribeFromInstrument(instrumentKey);
        console.log(`No more clients for ${instrumentKey}, unsubscribed`);
      }
    }
  }

  // --- Socket.IO Streaming Methods ---
  addSocketStreamingClient(instrumentKey, socket) {
    if (!this.socketStreamingClients.has(instrumentKey)) {
      this.socketStreamingClients.set(instrumentKey, new Set());
      this.subscribeToInstrument(instrumentKey);
    }
    this.socketStreamingClients.get(instrumentKey).add(socket);
    console.log(`Socket.IO client added for ${instrumentKey} (total: ${this.socketStreamingClients.get(instrumentKey).size})`);
    // Optionally send initial status/data
    socket.emit('marketData', {
      type: 'status',
      connected: this.getConnectionStatus().connected,
      instrumentKey,
      message: this.getConnectionStatus().connected ? 'Connected and subscribed' : 'Connecting...',
      timestamp: Date.now()
    });
  }

  removeSocketStreamingClient(instrumentKey, socket) {
    const set = this.socketStreamingClients.get(instrumentKey);
    if (set) {
      set.delete(socket);
      console.log(`Socket.IO client removed for ${instrumentKey} (remaining: ${set.size})`);
      if (set.size === 0) {
        this.socketStreamingClients.delete(instrumentKey);
        this.unsubscribeFromInstrument(instrumentKey);
        console.log(`No more Socket.IO clients for ${instrumentKey}, unsubscribed`);
      }
    }
  }

  // --- Broadcast to Socket.IO clients ---
  broadcastMarketData(instrumentKey, feedData) {
    if (this.socketStreamingClients.has(instrumentKey)) {
      const payload = {
        type: 'market_data',
        instrumentKey,
        data: feedData,
        timestamp: Date.now()
      };
      for (const socket of this.socketStreamingClients.get(instrumentKey)) {
        socket.emit('marketData', payload);
      }
      console.log(`Broadcasted Socket.IO data to ${this.socketStreamingClients.get(instrumentKey).size} sockets for ${instrumentKey}`);
    }
  }

  // --- Modify broadcastToClients to also call broadcastMarketData ---
  broadcastToClients(instrumentKey, feedData) {
    if (this.streamingResponses.has(instrumentKey)) {
      const dataToSend = JSON.stringify({ 
        type: 'market_data',
        instrumentKey, 
        data: feedData,
        timestamp: Date.now()
      });
      
      const responses = this.streamingResponses.get(instrumentKey);
      let successfulBroadcasts = 0;
      
      // Create a copy of responses array to avoid modification during iteration
      const responseCopy = [...responses];
      
      responseCopy.forEach((res, index) => {
        try {
          if (!res.writableEnded && !res.destroyed && res.writable) {
            res.write(`data: ${dataToSend}\n\n`);
            successfulBroadcasts++;
          } else {
            // Remove dead connections
            const actualIndex = responses.indexOf(res);
            if (actualIndex > -1) {
              responses.splice(actualIndex, 1);
              console.log(`Removed dead connection for ${instrumentKey}`);
            }
          }
        } catch (error) {
          console.error('Error writing to client:', error);
          const actualIndex = responses.indexOf(res);
          if (actualIndex > -1) {
            responses.splice(actualIndex, 1);
          }
        }
      });
      
      console.log(`Broadcasted data to ${successfulBroadcasts}/${responseCopy.length} clients for ${instrumentKey}`);
      
      // If no clients left, clean up
      if (responses.length === 0) {
        this.streamingResponses.delete(instrumentKey);
        this.unsubscribeFromInstrument(instrumentKey);
      }
    } else {
      console.log(`No clients to broadcast to for ${instrumentKey}`);
    }
    
    // Call Socket.IO broadcast
    this.broadcastMarketData(instrumentKey, feedData);
  }

  // Notify clients about disconnection
  notifyClientsDisconnection() {
    const message = JSON.stringify({
      type: 'status',
      connected: false,
      message: 'WebSocket disconnected, attempting reconnection...',
      timestamp: Date.now()
    });
    
    this.streamingResponses.forEach((responses, instrumentKey) => {
      responses.forEach(res => {
        try {
          if (!res.writableEnded && !res.destroyed && res.writable) {
            res.write(`data: ${message}\n\n`);
          }
        } catch (error) {
          console.error('Error notifying client of disconnection:', error);
        }
      });
    });
  }

  // Notify clients about reconnection
  notifyClientsReconnection() {
    const message = JSON.stringify({
      type: 'status',
      connected: true,
      message: 'WebSocket reconnected successfully',
      timestamp: Date.now()
    });
    
    this.streamingResponses.forEach((responses, instrumentKey) => {
      responses.forEach(res => {
        try {
          if (!res.writableEnded && !res.destroyed && res.writable) {
            res.write(`data: ${message}\n\n`);
          }
        } catch (error) {
          console.error('Error notifying client of reconnection:', error);
        }
      });
    });
  }

  // Notify clients about max retries reached
  notifyClientsMaxRetriesReached() {
    const message = JSON.stringify({
      type: 'error',
      connected: false,
      message: 'Max reconnection attempts reached. Please refresh or try again later.',
      timestamp: Date.now()
    });
    
    this.streamingResponses.forEach((responses, instrumentKey) => {
      responses.forEach(res => {
        try {
          if (!res.writableEnded && !res.destroyed && res.writable) {
            res.write(`data: ${message}\n\n`);
          }
        } catch (error) {
          console.error('Error notifying client of max retries:', error);
        }
      });
    });
  }

  // Start keep-alive for SSE connections
  startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      console.log(`Sending keep-alive to ${this.streamingResponses.size} instruments`);
      
      this.streamingResponses.forEach((responses, instrumentKey) => {
        const responseCopy = [...responses];
        responseCopy.forEach((res, index) => {
          try {
            if (!res.writableEnded && !res.destroyed && res.writable) {
              res.write(': keep-alive\n\n');
            } else {
              const actualIndex = responses.indexOf(res);
              if (actualIndex > -1) {
                responses.splice(actualIndex, 1);
                console.log(`Removed dead connection during keep-alive for ${instrumentKey}`);
              }
            }
          } catch (error) {
            console.error('Error sending keep-alive:', error);
            const actualIndex = responses.indexOf(res);
            if (actualIndex > -1) {
              responses.splice(actualIndex, 1);
            }
          }
        });
        
        // Clean up if no clients left
        if (responses.length === 0) {
          this.streamingResponses.delete(instrumentKey);
          this.unsubscribeFromInstrument(instrumentKey);
        }
      });
    }, 15000); // Send keep-alive every 15 seconds
  }

  // Stop keep-alive
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  // Initialize connection
  async initConnection() {
    try {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      console.log("Initializing market data connection...");
      const wsUrl = await this.getMarketFeedUrl();
      await this.connectUpstoxWebSocket(wsUrl);
      console.log("Market data WebSocket connection established");
    } catch (error) {
      console.error("Error connecting to market data WebSocket:", error.message);
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        const delay = Math.min(5000 * this.connectionRetries, 30000);
        console.log(`Retrying connection in ${delay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`);
        this.reconnectTimeout = setTimeout(() => this.initConnection(), delay);
      } else {
        console.error("Max connection retries reached. Manual intervention required.");
      }
    }
  }

  // Initialize the entire service
  async initialize() {
    try {
      if (this.isInitialized) {
        console.log("Market data service already initialized");
        return;
      }
      
      console.log("Initializing market data service...");
      
      // Initialize protobuf (optional)
      await this.initProtobuf();
      
      // Initialize connection
      await this.initConnection();
      
      this.isInitialized = true;
      console.log("Market data service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize market data service:", error);
      // Don't throw error, allow service to continue and retry
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.upstoxWs && this.upstoxWs.readyState === WebSocket.OPEN,
      activeStreams: this.streamingResponses.size,
      totalClients: Array.from(this.streamingResponses.values()).reduce((total, clients) => total + clients.length, 0),
      connectionRetries: this.connectionRetries,
      maxRetries: this.maxRetries,
      isInitialized: this.isInitialized,
      queuedSubscriptions: this.subscriptionQueue.size,
      lastHeartbeat: new Date(this.lastHeartbeat).toISOString()
    };
  }

  // Manual reconnection
  async forceReconnect() {
    console.log("Forcing reconnection...");
    this.connectionRetries = 0;
    
    if (this.upstoxWs) {
      this.upstoxWs.close();
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    await this.initConnection();
  }

  // Cleanup on shutdown
  cleanup() {
    console.log("Cleaning up market data service...");
    
    this.stopKeepAlive();
    this.stopHeartbeatMonitor();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Close all streaming responses
    this.streamingResponses.forEach((responses, instrumentKey) => {
      responses.forEach(res => {
        try {
          if (!res.writableEnded && !res.destroyed && res.writable) {
            res.write('data: {"type": "status", "message": "Service shutting down"}\n\n');
            res.end();
          }
        } catch (error) {
          console.error('Error closing client connection:', error);
        }
      });
    });
    
    // Close WebSocket connection
    if (this.upstoxWs) {
      this.upstoxWs.close();
    }
    
    this.isInitialized = false;
    console.log("Market data service cleaned up");
  }
}

// Create singleton instance
const marketDataService = new MarketDataService();

// Export service and initialization function
module.exports = {
  marketDataService,
  initializeMarketDataService: () => marketDataService.initialize(),
  // Export new methods for Socket.IO
  addSocketStreamingClient: (...args) => marketDataService.addSocketStreamingClient(...args),
  removeSocketStreamingClient: (...args) => marketDataService.removeSocketStreamingClient(...args)
};