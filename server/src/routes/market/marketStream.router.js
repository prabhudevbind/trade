const express = require('express');
const { marketDataService } = require('../../services/marketData.service.js');

const router = express.Router();

// --- Socket.IO Market Data Streaming Handler ---
function registerMarketStreamSocket(io, marketDataService) {
  // Map: socket.id -> Set of instrumentKeys
  const socketSubscriptions = new Map();

  io.on('connection', (socket) => {
    // Subscribe to market data
    socket.on('market:subscribe', (instrumentKey) => {
      if (!instrumentKey) return;
      socket.join(instrumentKey);
      if (!socketSubscriptions.has(socket.id)) {
        socketSubscriptions.set(socket.id, new Set());
      }
      socketSubscriptions.get(socket.id).add(instrumentKey);
      // Add this socket as a streaming client for this instrument
      marketDataService.addSocketStreamingClient(instrumentKey, socket);
      console.log(`Socket ${socket.id} subscribed to market ${instrumentKey}`);
    });
    // Unsubscribe
    socket.on('market:unsubscribe', (instrumentKey) => {
      if (!instrumentKey) return;
      socket.leave(instrumentKey);
      if (socketSubscriptions.has(socket.id)) {
        socketSubscriptions.get(socket.id).delete(instrumentKey);
        if (socketSubscriptions.get(socket.id).size === 0) {
          socketSubscriptions.delete(socket.id);
        }
      }
      marketDataService.removeSocketStreamingClient(instrumentKey, socket);
      console.log(`Socket ${socket.id} unsubscribed from market ${instrumentKey}`);
    });
    // Clean up on disconnect
    socket.on('disconnect', () => {
      if (socketSubscriptions.has(socket.id)) {
        for (const instrumentKey of socketSubscriptions.get(socket.id)) {
          marketDataService.removeSocketStreamingClient(instrumentKey, socket);
        }
        socketSubscriptions.delete(socket.id);
      }
    });
  });
}

// Get connection status
router.get('/status', (req, res) => {
  try {
    const status = marketDataService.getConnectionStatus();
    res.json({
      success: true,
      data: {
        ...status,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error getting connection status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get connection status'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  const status = marketDataService.getConnectionStatus();
  const isHealthy = status.connected;
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'unhealthy',
    connection: status,
    timestamp: Date.now()
  });
});

// Force reconnection endpoint (for debugging)
router.post('/reconnect', async (req, res) => {
  try {
    console.log('Manual reconnection requested');
    await marketDataService.initConnection();
    res.json({
      success: true,
      message: 'Reconnection initiated'
    });
  } catch (error) {
    console.error('Manual reconnection failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reconnect',
      details: error.message
    });
  }
});

// Get active streams info
router.get('/streams', (req, res) => {
  try {
    const streams = [];
    marketDataService.streamingResponses.forEach((clients, instrumentKey) => {
      streams.push({
        instrumentKey,
        clientCount: clients.length,
        activeClients: clients.filter(client => !client.writableEnded).length
      });
    });

    res.json({
      success: true,
      data: {
        totalStreams: streams.length,
        streams: streams,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error getting streams info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get streams information'
    });
  }
});

module.exports = router;
module.exports.registerMarketStreamSocket = registerMarketStreamSocket;