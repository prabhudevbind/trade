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
    this.OAUTH2.accessToken = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI2UEI2TVkiLCJqdGkiOiI2ODMyYTIyNjg1YzJlZjI5Nzc1MmRlMmEiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6ZmFsc2UsImlhdCI6MTc0ODE0ODc3NCwiaXNzIjoidWRhcGktZ2F0ZXdheS1zZXJ2aWNlIiwiZXhwIjoxNzQ4MjEwNDAwfQ.7JvyQdr53SlhrrQ7sGEzle3ffKTBaK52XSEa78lTHmQ";
    this.upstoxWs = null;
    this.streamingResponses = new Map();
    this.keepAliveInterval = null;
    this.reconnectTimeout = null;
  }

  // Initialize protobuf schema
  async initProtobuf() {
    try {
      this.protobufRoot = await protobuf.load(path.join(__dirname, "../proto/MarketDataFeed.proto"));
      console.log("Protobuf schema loaded successfully");
    } catch (error) {
      console.error("Error loading protobuf schema:", error);
      throw error;
    }
  }

  // Get market data feed authorization URL
  async getMarketFeedUrl() {
    return new Promise((resolve, reject) => {
      const apiInstance = new UpstoxClient.WebsocketApi();
      apiInstance.getMarketDataFeedAuthorize(this.apiVersion, (error, data) => {
        if (error) {
          console.error("Market feed authorization error:", error.message);
          reject(error);
        } else {
          resolve(data.data.authorizedRedirectUri);
        }
      });
    });
  }

  // Connect to Upstox WebSocket
  async connectUpstoxWebSocket(wsUrl) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          "Api-Version": this.apiVersion,
          Authorization: "Bearer " + this.OAUTH2.accessToken,
        },
        followRedirects: true,
        perMessageDeflate: false
      });

      ws.on("open", () => {
        console.log("Upstox WebSocket connected successfully");
        this.upstoxWs = ws;
        this.startKeepAlive();
        
        // Resubscribe to all active instruments
        this.streamingResponses.forEach((_, instrumentKey) => {
          this.subscribeToInstrument(instrumentKey);
        });
        
        resolve(ws);
      });

      ws.on("error", (error) => {
        console.error("Upstox WebSocket error:", error);
        reject(error);
      });

      ws.on("close", () => {
        console.log("Upstox WebSocket disconnected. Attempting reconnection...");
        this.upstoxWs = null;
        this.stopKeepAlive();
        
        // Notify all streaming clients about disconnection
        this.notifyClientsDisconnection();
        
        // Attempt reconnection after 5 seconds
        this.reconnectTimeout = setTimeout(() => this.initConnection(), 5000);
      });

      ws.on("message", (data) => {
        this.handleWebSocketMessage(data);
      });
    });
  }

  // Handle incoming WebSocket messages
  async handleWebSocketMessage(data) {
    try {
      if (data instanceof Buffer) {
        const decodedData = this.decodeProtobuf(data);
        if (decodedData.feeds) {
          for (const [instrumentKey, feed] of Object.entries(decodedData.feeds)) {
            this.broadcastToClients(instrumentKey, feed);
          }
        }
      } else {
        console.log("Received non-buffer data:", data.toString());
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }

  // Decode protobuf data
  decodeProtobuf(buffer) {
    if (!this.protobufRoot) {
      throw new Error("Protobuf not initialized");
    }
    
    const MarketDataFeed = this.protobufRoot.lookupType("com.upstox.marketdatafeeder.rpc.proto.FeedResponse");
    const decodedMessage = MarketDataFeed.decode(buffer);
    return MarketDataFeed.toObject(decodedMessage, {
      longs: String,
      enums: String,
      bytes: String,
    });
  }

  // Subscribe to an instrument
  subscribeToInstrument(instrumentKey) {
    if (this.upstoxWs && this.upstoxWs.readyState === WebSocket.OPEN) {
      const data = {
        guid: `sub-${instrumentKey}`,
        method: "sub",
        data: {
          mode: "full",
          instrumentKeys: [instrumentKey],
        },
      };
      
      this.upstoxWs.send(Buffer.from(JSON.stringify(data)));
      console.log(`Subscribed to instrument: ${instrumentKey}`);
    } else {
      console.log(`Cannot subscribe to ${instrumentKey}: WebSocket not connected`);
    }
  }

  // Unsubscribe from an instrument
  unsubscribeFromInstrument(instrumentKey) {
    if (this.upstoxWs && this.upstoxWs.readyState === WebSocket.OPEN) {
      const data = {
        guid: `unsub-${instrumentKey}`,
        method: "unsub",
        data: {
          instrumentKeys: [instrumentKey],
        },
      };
      
      this.upstoxWs.send(Buffer.from(JSON.stringify(data)));
      console.log(`Unsubscribed from instrument: ${instrumentKey}`);
    }
  }

  // Add client to streaming
  addStreamingClient(instrumentKey, response) {
    if (!this.streamingResponses.has(instrumentKey)) {
      this.streamingResponses.set(instrumentKey, []);
      this.subscribeToInstrument(instrumentKey);
    }
    
    this.streamingResponses.get(instrumentKey).push(response);
    console.log(`Client added for streaming: ${instrumentKey}`);
  }

  // Remove client from streaming
  removeStreamingClient(instrumentKey, response) {
    const responses = this.streamingResponses.get(instrumentKey);
    if (responses) {
      const index = responses.indexOf(response);
      if (index > -1) {
        responses.splice(index, 1);
      }
      
      if (responses.length === 0) {
        this.streamingResponses.delete(instrumentKey);
        this.unsubscribeFromInstrument(instrumentKey);
        console.log(`No more clients for ${instrumentKey}, unsubscribed`);
      }
    }
  }

  // Broadcast data to clients
  broadcastToClients(instrumentKey, feedData) {
    if (this.streamingResponses.has(instrumentKey)) {
      const dataToSend = JSON.stringify({ 
        instrumentKey, 
        data: feedData,
        timestamp: Date.now()
      });
      
      const responses = this.streamingResponses.get(instrumentKey);
      responses.forEach(res => {
        if (!res.writableEnded) {
          res.write(`data: ${dataToSend}\n\n`);
        }
      });
    }
  }

  // Notify clients about disconnection
  notifyClientsDisconnection() {
    this.streamingResponses.forEach((responses) => {
      responses.forEach(res => {
        if (!res.writableEnded) {
          res.write('data: {"error": "WebSocket disconnected, reconnecting..."}\n\n');
        }
      });
    });
  }

  // Start keep-alive for SSE connections
  startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      this.streamingResponses.forEach((responses) => {
        responses.forEach(res => {
          if (!res.writableEnded) {
            res.write(': keep-alive\n\n');
          }
        });
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
      const wsUrl = await this.getMarketFeedUrl();
      console.log("Market data WebSocket URL obtained:", wsUrl);
      await this.connectUpstoxWebSocket(wsUrl);
      console.log("Market data WebSocket connection established");
    } catch (error) {
      console.error("Error connecting to market data WebSocket:", error.message);
      this.reconnectTimeout = setTimeout(() => this.initConnection(), 5000);
    }
  }

  // Initialize the entire service
  async initialize() {
    try {
      await this.initProtobuf();
      await this.initConnection();
      console.log("Market data service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize market data service:", error);
      throw error;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.upstoxWs && this.upstoxWs.readyState === WebSocket.OPEN,
      activeStreams: this.streamingResponses.size,
      totalClients: Array.from(this.streamingResponses.values()).reduce((total, clients) => total + clients.length, 0)
    };
  }

  // Cleanup on shutdown
  cleanup() {
    this.stopKeepAlive();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Close all streaming responses
    this.streamingResponses.forEach((responses) => {
      responses.forEach(res => {
        if (!res.writableEnded) {
          res.end('data: {"message": "Service shutting down"}\n\n');
        }
      });
    });
    
    // Close WebSocket connection
    if (this.upstoxWs) {
      this.upstoxWs.close();
    }
    
    console.log("Market data service cleaned up");
  }
}

// Create singleton instance
const marketDataService = new MarketDataService();

// Export service and initialization function
module.exports = {
  marketDataService,
  initializeMarketDataService: () => marketDataService.initialize()
};