const express = require('express');
const cors = require('cors');

const { errorHandler } = require('./middleware/error.middleware');


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/v1',require("./routes/chart/niftychart.router"));
app.use('/api/v1',require('./routes/contest/payment.routes'));
// Routes
// const { authenticateToken } = require('./utils/verify');
app.use('/api/v1/roles',  require('./routes/user/userRole.routes'));
app.use('/api/v1/users',  require('./routes/user/user.routes'));
app.use('/api/v1/permissions',  require('./routes/user/userPermission.routes'));
app.use('/api/v1/user-activity-logs',  require('./routes/user/userActivityLogRoutes'));
app.use('/api/v1/password-reset-tokens',  require('./routes/user/passwordResetTokenRoutes'));
app.use('/api/v1/sessions',require('./routes/user/auth.routes'))
app.use('/api/v1/user-sessions', require('./routes/user/userSessionRoutes'))
app.use('/api/v1', require('./utils/profileupload'))
app.use('/api/v1/smtp-details', require('./routes/user/smtp.routes'));
app.use('/api/v1',require("./routes/contest/general.routes"))


// Error handling
app.use(errorHandler);
app.use('/uploads', express.static('uploads'));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
 