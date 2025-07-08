const cron = require("node-cron");
const Redis = require("ioredis");
const prisma = require("../utils/prisma");

// Create a single Redis client instance that can be reused
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: true,
});

// Add Redis connection event handlers
redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err);
});

redisClient.on('close', () => {
  console.log('🔄 Redis client connection closed');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis client reconnecting...');
});

function getInitialCash() {
  return 100000;
}

// Enhanced Redis connection validation
async function validateRedisConnection() {
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('Redis connection validation failed:', error);
    return false;
  }
}

// Enhanced getLiveLTP function with proper Redis client validation
async function getLiveLTP(option) {
  console.log("Fetching live LTP for option:", {
    id: option.id,
    symbol: option.symbol,
    strike_price: option.strike_price,
    option_type: option.option_type,
    current_ltp: option.ltp
  });

  // Validate input parameters
  if (!option || !option.symbol || !option.expiry_date) {
    console.error("Invalid option data provided");
    return Number(option?.ltp || 0);
  }

  // Validate Redis client connection
  const isRedisConnected = await validateRedisConnection();
  if (!isRedisConnected) {
    console.error("Redis client is not available or connection failed");
    return Number(option?.ltp || 0);
  }

  const instrumentKey = `NSE_INDEX|${option.symbol}`;
  const expiryStr =
    typeof option.expiry_date === "string"
      ? option.expiry_date
      : option.expiry_date?.toISOString?.() || "";
  const expiryDateKey = expiryStr.split("T")[0];

  console.log("Cache lookup params:", {
    instrumentKey,
    expiryDateKey,
    strike_price: option.strike_price,
    option_type: option.option_type
  });

  try {
    // Try multiple cache keys in order of preference (most recent first)
    const cacheKeys = [
      `option_chain:current:NSE_INDEX|Nifty 50:${expiryDateKey}`,
      `option_chain:strikes:NSE_INDEX|Nifty 50:${expiryDateKey}`,
      `option_chain:summary:NSE_INDEX|Nifty 50:${expiryDateKey}`,
      `option_chain:strike:NSE_INDEX|Nifty 50:${expiryDateKey}:${option.strike_price}`,
    ];

    console.log("Checking cache for keys:", cacheKeys);
    
    for (const cacheKey of cacheKeys) {
      try {
        console.log(`Checking cache for key: ${cacheKey}`);
        const cached = await redisClient.get(cacheKey);

        if (cached) {
          const data = JSON.parse(cached);
          console.log(`Cached data found with key: ${cacheKey}`);

          const ltp = extractLTPFromData(data, option);

          if (ltp > 0) {
            console.log(`Found LTP from cache: ${ltp} for ${option.option_type} ${option.strike_price}`);
            return ltp;
          }
        } else {
          console.log(`No cached data found for key: ${cacheKey}`);
        }
      } catch (parseError) {
        console.error(
          `Error parsing cached data for key ${cacheKey}:`,
          parseError.message
        );
        continue;
      }
    }

    // If no cached data found, try to get relative time data
    console.log("Attempting to get relative time LTP...");
    const relativeLTP = await getRelativeTimeLTP(
      option,
      instrumentKey,
      expiryDateKey
    );
    if (relativeLTP > 0) {
      console.log(`Found relative time LTP: ${relativeLTP}`);
      return relativeLTP;
    }
  } catch (error) {
    console.error("Error fetching LTP from cache:", error);
  }

  // Fallback to the LTP from the option object
  const fallbackLtp = Number(option.ltp || 0);
  console.log(`Using fallback LTP: ${fallbackLtp}`);
  return fallbackLtp;
}

// Helper function to extract LTP from various data structures
function extractLTPFromData(data, option) {
  let ltp = 0;

  try {
    // Strategy 1: Check if data has direct call/put structure
    if (data.call || data.put) {
      if (option.option_type === "CE" && data.call) {
        ltp = Number(data.call.ltp || 0);
      } else if (option.option_type === "PE" && data.put) {
        ltp = Number(data.put.ltp || 0);
      }
    }
    // Strategy 2: Check if data is structured by strike price
    else if (data[option.strike_price]) {
      const strikeData = data[option.strike_price];
      if (option.option_type === "CE" && strikeData.call) {
        ltp = Number(strikeData.call.ltp || 0);
      } else if (option.option_type === "PE" && strikeData.put) {
        ltp = Number(strikeData.put.ltp || 0);
      }
    }
    // Strategy 3: Check if data has option_chain array
    else if (data.option_chain && Array.isArray(data.option_chain)) {
      const strike = data.option_chain.find(
        (s) => s.strike_price === option.strike_price
      );
      if (strike) {
        if (option.option_type === "CE" && strike.call_option) {
          ltp = Number(strike.call_option.ltp || 0);
        } else if (option.option_type === "PE" && strike.put_option) {
          ltp = Number(strike.put_option.ltp || 0);
        }
      }
    }
    // Strategy 4: Check if this is direct strike data
    else if (data.call_option || data.put_option) {
      if (option.option_type === "CE" && data.call_option) {
        ltp = Number(data.call_option.ltp || 0);
      } else if (option.option_type === "PE" && data.put_option) {
        ltp = Number(data.put_option.ltp || 0);
      }
    }
  } catch (error) {
    console.error("Error extracting LTP from data:", error);
  }

  return ltp;
}

// Get relative time data (recent historical data if current is not available)
async function getRelativeTimeLTP(option, instrumentKey, expiryDateKey) {
  console.log("Attempting to get relative time LTP data...");

  try {
    // Try to get time series data for the specific strike
    const timeSeriesKey = `option_chain:strike_ts:${instrumentKey}:${expiryDateKey}:${option.strike_price}`;

    // Get last 5 entries from the time series (most recent first)
    const recentData = await redisClient.zrevrange(
      timeSeriesKey,
      0,
      4,
      "WITHSCORES"
    );

    if (recentData && recentData.length > 0) {
      // Parse the most recent entry
      const mostRecentData = JSON.parse(recentData[0]);
      const timestamp = parseInt(recentData[1]);

      // Check if data is recent (within last 5 minutes)
      const now = Date.now();
      const dataAge = now - timestamp;
      const fiveMinutesInMs = 5 * 60 * 1000;

      if (dataAge <= fiveMinutesInMs) {
        const ltp =
          option.option_type === "CE"
            ? Number(mostRecentData.call_ltp || 0)
            : Number(mostRecentData.put_ltp || 0);

        if (ltp > 0) {
          console.log(
            `Found relative time LTP: ${ltp} (${Math.round(
              dataAge / 1000
            )}s ago)`
          );
          return ltp;
        }
      } else {
        console.log(
          `Time series data too old: ${Math.round(dataAge / 60000)} minutes`
        );
      }
    }

    // Try to get general time series data
    const generalTimeSeriesKey = `option_chain:timeseries:${instrumentKey}:${expiryDateKey}`;
    const generalData = await redisClient.zrevrange(
      generalTimeSeriesKey,
      0,
      2,
      "WITHSCORES"
    );

    if (generalData && generalData.length > 0) {
      console.log(
        "Found general time series data, but need to fetch full option chain for strike-specific data"
      );
      // Additional logic could be implemented here to fetch full option chain
    }

    // Try historical data as last resort
    const historicalKey = `option_chain:historical:${instrumentKey}:${expiryDateKey}`;
    const historicalData = await redisClient.get(historicalKey);

    if (historicalData) {
      const data = JSON.parse(historicalData);
      const ltp = extractLTPFromData(data, option);

      if (ltp > 0) {
        console.log(`Found LTP from historical data: ${ltp}`);
        return ltp;
      }
    }
  } catch (error) {
    console.error("Error getting relative time LTP:", error);
  }

  return 0;
}

function calculateRealizedPnL(trades) {
  let totalRealizedPnL = 0;

  const tradeGroups = new Map();

  trades.forEach((trade) => {
    const key = `${trade.option.symbol}_${trade.option.strike_price}_${trade.option.option_type}`;
    if (!tradeGroups.has(key)) {
      tradeGroups.set(key, []);
    }
    tradeGroups.get(key).push(trade);
  });

  tradeGroups.forEach((groupTrades) => {
    groupTrades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let position = 0;
    let averageBuyPrice = 0;
    let instrumentPnL = 0;

    groupTrades.forEach((trade) => {
      const quantity = Math.abs(trade.quantity);
      const price = Number(trade.price);

      if (trade.action === "buy") {
        const newTotalQuantity = position + quantity;
        if (newTotalQuantity > 0) {
          averageBuyPrice =
            (position * averageBuyPrice + quantity * price) / newTotalQuantity;
        }
        position += quantity;
      } else if (trade.action === "sell") {
        if (position > 0) {
          const sellQuantity = Math.min(quantity, position);
          const pnl = sellQuantity * price - sellQuantity * averageBuyPrice;
          instrumentPnL += pnl;
          position -= sellQuantity;
        }
      }
    });

    totalRealizedPnL += instrumentPnL;
  });

  return totalRealizedPnL;
}

function calculateUnrealizedPnL(positions) {
  let totalUnrealizedPnL = 0;

  positions.forEach((pos) => {
    const currentLtp = Number(pos.option.ltp);
    const avgEntryPrice = Number(pos.average_entry_price);
    const netQuantity = Number(pos.net_quantity);

    if (netQuantity === 0) {
      return;
    }

    const positionPnL = (currentLtp - avgEntryPrice) * netQuantity;
    totalUnrealizedPnL += positionPnL;
  });

  return totalUnrealizedPnL;
}

async function generateLeaderboard() {
  console.log("Starting leaderboard generation...");
  
  try {
    const activeContest = await prisma.contest.findFirst({
      where: { status: "ongoing" },
    });

    if (!activeContest) {
      console.log("No active contest found");
      return null;
    }

    console.log(`Found active contest: ${activeContest.id}`);

    const participants = await prisma.contestParticipant.findMany({
      where: { contest_id: activeContest.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            img: true,
          },
        },
        positions: {
          where: { net_quantity: { not: 0 } },
          include: { option: true },
        },
        trades: {
          include: { option: true },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    console.log(`Found ${participants.length} participants`);

    const leaderboard = [];

    for (const participant of participants) {
      console.log(`Processing participant: ${participant.user.username}`);
      
      const positionsWithLive = [];
      for (const pos of participant.positions) {
        const liveLtp = await getLiveLTP(pos.option);
        positionsWithLive.push({
          ...pos,
          option: { ...pos.option, ltp: liveLtp },
        });
      }

      const realizedPnL = calculateRealizedPnL(participant.trades);
      const unrealizedPnL = calculateUnrealizedPnL(positionsWithLive);
      const totalPnL = realizedPnL + unrealizedPnL;

      const initialCash = getInitialCash();
      const portfolioValue = initialCash + totalPnL;
      const roi = initialCash > 0 ? (totalPnL / initialCash) * 100 : 0;

      leaderboard.push({
        userId: participant.user.id,
        userName: participant.user.username,
        userImg: participant.user.img,
        virtualCash: Number(participant.virtual_cash) || 0,
        unrealizedPnL: unrealizedPnL,
        realizedPnL: realizedPnL,
        totalPnL: totalPnL,
        portfolioValue: portfolioValue,
        roi: roi,
        totalTrades: participant.trades?.length || 0,
        openPositions: positionsWithLive.length,
        profitLossStatus:
          totalPnL > 0 ? "PROFIT" : totalPnL < 0 ? "LOSS" : "BREAKEVEN",
        lastUpdated: new Date().toISOString(),
      });
    }

    // Sort leaderboard by total P&L in descending order
    leaderboard.sort((a, b) => b.totalPnL - a.totalPnL);

    // Assign ranks
    leaderboard.forEach((participant, index) => {
      participant.rank = index + 1;
    });

    // Generate summaries
    const strikesSummary = new Map();
    const ratesSummary = new Map();

    for (const participant of participants) {
      for (const pos of participant.positions) {
        const key = `${pos.option.symbol}_${pos.option.strike_price}_${pos.option.option_type}`;
        if (!strikesSummary.has(key)) {
          strikesSummary.set(key, {
            symbol: pos.option.symbol,
            strike: pos.option.strike_price,
            type: pos.option.option_type,
            positions: 0,
            totalQuantity: 0,
            avgLtp: 0,
            ltpSum: 0,
            ltpCount: 0,
          });
        }

        const summary = strikesSummary.get(key);
        summary.positions++;
        summary.totalQuantity += Math.abs(pos.net_quantity);
        summary.ltpSum += pos.option.ltp;
        summary.ltpCount++;
        summary.avgLtp = summary.ltpSum / summary.ltpCount;

        const rateKey = pos.option.symbol;
        if (!ratesSummary.has(rateKey)) {
          ratesSummary.set(rateKey, {
            symbol: pos.option.symbol,
            totalPositions: 0,
            callPositions: 0,
            putPositions: 0,
            avgCallLtp: 0,
            avgPutLtp: 0,
            callLtpSum: 0,
            putLtpSum: 0,
            callCount: 0,
            putCount: 0,
          });
        }

        const rateSummary = ratesSummary.get(rateKey);
        rateSummary.totalPositions++;

        if (pos.option.option_type === "CE") {
          rateSummary.callPositions++;
          rateSummary.callLtpSum += pos.option.ltp;
          rateSummary.callCount++;
          rateSummary.avgCallLtp =
            rateSummary.callLtpSum / rateSummary.callCount;
        } else if (pos.option.option_type === "PE") {
          rateSummary.putPositions++;
          rateSummary.putLtpSum += pos.option.ltp;
          rateSummary.putCount++;
          rateSummary.avgPutLtp = rateSummary.putLtpSum / rateSummary.putCount;
        }
      }
    }

    const leaderboardData = {
      contest_id: activeContest.id,
      snapshot_time: new Date(),
      total_participants: leaderboard.length,
      leaderboard: leaderboard,
      strikes_summary: Array.from(strikesSummary.entries()),
      rates_summary: Array.from(ratesSummary.entries()),
    };

    // Cache the leaderboard data
    try {
      await redisClient.setex(
        `leaderboard:contest:${activeContest.id}`,
        60, // 1 minute cache
        JSON.stringify(leaderboardData)
      );
      console.log("Leaderboard cached successfully");

      // Emit to WebSocket if available
      if (global.io) {
        global.io.emit("leaderboardUpdate", leaderboardData);
        console.log("Leaderboard broadcasted via WebSocket");
      }
    } catch (cacheError) {
      console.error("Error caching leaderboard:", cacheError);
    }

    // Save to database
    for (const participant of leaderboard) {
      try {
        await prisma.leaderboard.upsert({
          where: {
            contest_id_user_id_snapshot_time: {
              contest_id: activeContest.id,
              user_id: participant.userId,
              snapshot_time: leaderboardData.snapshot_time,
            },
          },
          update: {
            rank: participant.rank,
            portfolio_value: participant.portfolioValue,
            total_pnl: participant.totalPnL,
            unrealized_pnl: participant.unrealizedPnL,
            realized_pnl: participant.realizedPnL,
            roi: participant.roi,
            virtual_cash: participant.virtualCash,
            profit_loss_status: participant.profitLossStatus,
            snapshot_time: leaderboardData.snapshot_time,
          },
          create: {
            contest_id: activeContest.id,
            user_id: participant.userId,
            rank: participant.rank,
            portfolio_value: participant.portfolioValue,
            total_pnl: participant.totalPnL,
            unrealized_pnl: participant.unrealizedPnL,
            realized_pnl: participant.realizedPnL,
            roi: participant.roi,
            virtual_cash: participant.virtualCash,
            profit_loss_status: participant.profitLossStatus,
            snapshot_time: leaderboardData.snapshot_time,
          },
        });
      } catch (dbError) {
        console.error(`Error saving leaderboard for user ${participant.userId}:`, dbError);
      }
    }

    console.log(`Leaderboard generation completed. Total participants: ${leaderboard.length}`);
    return leaderboardData;
  } catch (error) {
    console.error("Error generating leaderboard:", error);
    throw error;
  }
}

function getMarketStatus() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();

  const isWeekday = day >= 1 && day <= 5;
  const isMarketTime =
    (hours === 9 && minutes >= 15) ||
    (hours > 9 && hours < 15) ||
    (hours === 15 && minutes <= 30);

  if (isWeekday && isMarketTime) {
    return "MARKET_OPEN";
  } else if (isWeekday && ((hours === 9 && minutes < 15) || hours < 9)) {
    return "PRE_MARKET";
  } else if (isWeekday && hours > 15) {
    return "POST_MARKET";
  } else {
    return "MARKET_CLOSED";
  }
}

async function triggerLeaderboardGeneration() {
  console.log("Manual leaderboard generation triggered");
  return await generateLeaderboard();
}

async function getLeaderboardData(contestId) {
  try {
    const cachedData = await redisClient.get(
      `leaderboard:contest:${contestId}`
    );

    if (cachedData) {
      console.log(`Retrieved cached leaderboard for contest ${contestId}`);
      return JSON.parse(cachedData);
    } else {
      console.log(`No cached leaderboard found for contest ${contestId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error retrieving leaderboard for contest ${contestId}:`, error);
    return null;
  }
}



// Schedule the cron job to run every minute
cron.schedule("* * * * *", async () => {
  console.log("Cron job triggered - generating leaderboard...");
  try {
    const marketStatus = getMarketStatus();
    console.log(`Market status: ${marketStatus}`);
    
    // Generate leaderboard regardless of market status for demo purposes
    // You can modify this logic based on your requirements
    await generateLeaderboard();
    console.log("Leaderboard generation completed successfully");
  } catch (error) {
    console.error("Error in scheduled leaderboard generation:", error);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  try {
    await redisClient.quit();
    console.log("Redis client disconnected");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  try {
    await redisClient.quit();
    console.log("Redis client disconnected");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

console.log("Leaderboard cron job service started");

module.exports = {
  generateLeaderboard,
  triggerLeaderboardGeneration,
  getLeaderboardData,
  getMarketStatus,
  redisClient, // Export the new utility
};