const express = require('express');
const { marketDataService } = require('../../services/marketData.service.js');

const router = express.Router();

// Streaming endpoint for market data
router.get('/stream/:instrumentKey', (req, res) => {
  const instrumentKey = decodeURIComponent(req.params.instrumentKey);
  console.log(`New stream request for instrument: ${instrumentKey}`);

  // Validate instrument key
  if (!instrumentKey || instrumentKey.trim() === '') {
    return res.status(400).json({ error: 'Invalid instrument key' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
  res.flushHeaders();

  // Send initial connection message
  res.write('data: {"message": "Stream connected", "instrumentKey": "' + instrumentKey + '"}\n\n');

  // Check WebSocket connection status
  const connectionStatus = marketDataService.getConnectionStatus();
  if (!connectionStatus.connected) {
    res.write('data: {"error": "Market data service not connected, attempting reconnection..."}\n\n');
    // Try to reinitialize connection
    marketDataService.initConnection().catch(error => {
      console.error('Failed to reconnect:', error);
    });
  }

  // Add client to streaming service
  marketDataService.addStreamingClient(instrumentKey, res);

  // Handle client disconnection
  req.on('close', () => {
    console.log(`Client disconnected from stream: ${instrumentKey}`);
    marketDataService.removeStreamingClient(instrumentKey, res);
    
    if (!res.writableEnded) {
      res.end();
    }
  });

  // Handle client abort
  req.on('aborted', () => {
    console.log(`Client aborted stream: ${instrumentKey}`);
    marketDataService.removeStreamingClient(instrumentKey, res);
  });
});

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