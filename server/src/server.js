const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/error.middleware');
const { initializeMarketDataService } = require('./services/marketData.service');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use('/uploads', express.static('uploads'));

// Chart routes
app.use('/api/v1', require("./routes/chart/niftychart.router"));

// Contest routes
app.use('/api/v1', require('./routes/contest/payment.routes'));
app.use('/api/v1', require('./routes/contest/optionDetails.router'));
app.use('/api/v1', require("./routes/contest/general.routes"));

// Market data streaming routes
app.use('/api/v1/market', require('./routes/market/marketStream.router'));

// User management routes
app.use('/api/v1/roles', require('./routes/user/userRole.routes'));
app.use('/api/v1/users', require('./routes/user/user.routes'));
app.use('/api/v1/permissions', require('./routes/user/userPermission.routes'));
app.use('/api/v1/user-activity-logs', require('./routes/user/userActivityLogRoutes'));
app.use('/api/v1/password-reset-tokens', require('./routes/user/passwordResetTokenRoutes'));
app.use('/api/v1/sessions', require('./routes/user/auth.routes'));
app.use('/api/v1/user-sessions', require('./routes/user/userSessionRoutes'));
app.use('/api/v1/smtp-details', require('./routes/user/smtp.routes'));

// Utility routes
app.use('/api/v1', require('./utils/profileupload'));

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  
  // Initialize market data service
  try {
    await initializeMarketDataService();
    console.log('Market data service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize market data service:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

module.exports = app;