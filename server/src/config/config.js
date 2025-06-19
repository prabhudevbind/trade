const config = {
    port: process.env.PORT || 5001,
    nodeEnv: process.env.NODE_ENV || 'development',
    accessToken: process.env.ACCESS_TOKEN,
    
    // Upstox configuration
    upstox: {
        apiKey: process.env.UPSTOX_API_KEY,
        apiSecret: process.env.UPSTOX_API_SECRET,
        accessToken: process.env.ACCESS_TOKEN,
    },
    
    // Add other configuration as needed
};

// Validate required environment variables
const requiredEnvVars = ['ACCESS_TOKEN'];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: Required environment variable ${envVar} is missing`);
        process.exit(1);
    }
}

module.exports = config;
