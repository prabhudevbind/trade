const cron = require("node-cron");
const Redis = require("ioredis");
const prisma = require("../utils/prisma");

const redisClient = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null,
});

function getInitialCash() {
  return 100000;
}

// Enhanced function to get live LTP with multiple fallbacks
async function getLiveLTP(option) {
  const instrumentKey = `NSE_FO|${option.symbol}`;
  const expiryStr = typeof option.expiry_date === "string" 
    ? option.expiry_date 
    : option.expiry_date?.toISOString?.() || "";
  const expiryDateKey = expiryStr.split("T")[0];
  
  try {
    // Try multiple cache keys for better data retrieval
    const cacheKeys = [
      `option_chain:${instrumentKey}:${expiryDateKey}`,
      `option_chain:NSE_INDEX|Nifty 50:${expiryDateKey}`,
      `option_chain:NSE_INDEX|Nifty Bank:${expiryDateKey}`,
      `ltp:${instrumentKey}`,
      `live_price:${option.symbol}`
    ];

    for (const cacheKey of cacheKeys) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        
        // Try different data structures for LTP
        let ltp = null;
        
        // For option chain data
        if (data.option_chain && Array.isArray(data.option_chain)) {
          const strike = data.option_chain.find(s => s.strike_price === option.strike_price);
          if (strike) {
            if (option.option_type === 'CE' && strike.call_option) {
              ltp = strike.call_option.ltp;
            } else if (option.option_type === 'PE' && strike.put_option) {
              ltp = strike.put_option.ltp;
            }
          }
        }
        
        // For direct price data
        if (!ltp) {
          ltp = data.ltpc?.ltp || data.ff?.marketFF?.ltpc?.ltp || data.ltp || data.price;
        }
        
        if (ltp && ltp > 0) {
          console.log(`[LTP FOUND] ${option.symbol} - Strike: ${option.strike_price} - Type: ${option.option_type} - LTP: ${ltp}`);
          return Number(ltp);
        }
      }
    }
  } catch (error) {
    console.error(`[LTP ERROR] ${option.symbol}:`, error.message);
  }
  
  // Fallback to database LTP
  console.log(`[LTP FALLBACK] ${option.symbol} - Using DB LTP: ${option.ltp}`);
  return Number(option.ltp || 0);
}

// Calculate realized PnL from completed trades
function calculateRealizedPnL(trades) {
  const tradeGroups = new Map(); // Group by symbol and option type
  
  trades.forEach(trade => {
    const key = `${trade.option.symbol}_${trade.option.strike_price}_${trade.option.option_type}`;
    if (!tradeGroups.has(key)) {
      tradeGroups.set(key, []);
    }
    tradeGroups.get(key).push(trade);
  });

  let totalRealizedPnL = 0;

  tradeGroups.forEach((groupTrades, symbol) => {
    // Sort trades by timestamp
    groupTrades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let position = 0;
    let totalBuyValue = 0;
    let totalSellValue = 0;
    let averageBuyPrice = 0;
    
    groupTrades.forEach(trade => {
      const quantity = Math.abs(trade.quantity);
      const price = Number(trade.price);
      
      if (trade.action === 'buy') {
        const newTotalQuantity = position + quantity;
        if (newTotalQuantity > 0) {
          averageBuyPrice = ((position * averageBuyPrice) + (quantity * price)) / newTotalQuantity;
        }
        position += quantity;
        totalBuyValue += quantity * price;
      } else if (trade.action === 'sell') {
        if (position > 0) {
          const sellQuantity = Math.min(quantity, position);
          const sellValue = sellQuantity * price;
          const buyValue = sellQuantity * averageBuyPrice;
          
          totalRealizedPnL += sellValue - buyValue;
          totalSellValue += sellValue;
          position -= sellQuantity;
        }
      }
    });
  });

  return totalRealizedPnL;
}

// Calculate unrealized PnL from open positions
function calculateUnrealizedPnL(positions) {
  return positions.reduce((sum, pos) => {
    const currentLtp = Number(pos.option.ltp);
    const avgEntryPrice = Number(pos.average_entry_price);
    const netQuantity = Number(pos.net_quantity);
    
    if (netQuantity === 0) return sum;
    
    const positionPnL = (currentLtp - avgEntryPrice) * netQuantity;
    
    console.log(`[UNREALIZED PnL] ${pos.option.symbol} - Qty: ${netQuantity} - Entry: ${avgEntryPrice} - LTP: ${currentLtp} - PnL: ${positionPnL.toFixed(2)}`);
    
    return sum + positionPnL;
  }, 0);
}

// Calculate portfolio metrics
function calculatePortfolioMetrics(participant, realizedPnL, unrealizedPnL) {
  const virtualCash = Number(participant.virtual_cash) || 0;
  const initialCash = getInitialCash();
  
  // Total PnL = Realized + Unrealized
  const totalPnL = realizedPnL + unrealizedPnL;
  
  // Portfolio Value = Initial Cash + Total PnL
  const portfolioValue = initialCash + totalPnL;
  
  // ROI calculation
  const roi = initialCash > 0 ? (totalPnL / initialCash) * 100 : 0;
  
  // Calculate used capital (money invested in positions)
  const usedCapital = participant.positions.reduce((sum, pos) => {
    return sum + (Number(pos.average_entry_price) * Math.abs(pos.net_quantity));
  }, 0);
  
  // Available cash = Virtual cash - used capital
  const availableCash = virtualCash - usedCapital;
  
  return {
    virtualCash,
    realizedPnL,
    unrealizedPnL,
    totalPnL,
    portfolioValue,
    roi,
    usedCapital,
    availableCash
  };
}

async function generateLeaderboard() {
  try {
    console.log('[LEADERBOARD] Starting leaderboard generation...');
    
    // 1. Find the active contest
    const activeContest = await prisma.contest.findFirst({
      where: { status: "ongoing" },
    });
    
    if (!activeContest) {
      console.log('[LEADERBOARD] No active contest found');
      return;
    }

    console.log(`[LEADERBOARD] Processing contest: ${activeContest.id}`);

    // 2. Get all participants with their positions and trades
    const participants = await prisma.contestParticipant.findMany({
      where: { contest_id: activeContest.id },
      include: {
        user: { select: { id: true, username: true, img: true, email: true } },
        positions: { 
          where: { net_quantity: { not: 0 } }, // Only non-zero positions
          include: { option: true } 
        },
        trades: {
          include: { option: true },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    console.log(`[LEADERBOARD] Found ${participants.length} participants`);

    // 3. For each participant, calculate stats
    const leaderboard = [];
    const now = new Date();

    for (const participant of participants) {
      console.log(`[LEADERBOARD] Processing user: ${participant.user.username}`);
      
      // Get live LTP for each position
      const positionsWithLive = [];
      for (const pos of participant.positions) {
        const liveLtp = await getLiveLTP(pos.option);
        positionsWithLive.push({
          ...pos,
          option: { ...pos.option, ltp: liveLtp },
        });
      }

      // Calculate realized PnL from trades
      const realizedPnL = calculateRealizedPnL(participant.trades);
      
      // Calculate unrealized PnL from open positions
      const unrealizedPnL = calculateUnrealizedPnL(positionsWithLive);
      
      // Calculate portfolio metrics
      const metrics = calculatePortfolioMetrics(participant, realizedPnL, unrealizedPnL);
      
      console.log(`[LEADERBOARD] User: ${participant.user.username} | Realized: ${realizedPnL.toFixed(2)} | Unrealized: ${unrealizedPnL.toFixed(2)} | Total: ${metrics.totalPnL.toFixed(2)} | Portfolio: ${metrics.portfolioValue.toFixed(2)} | ROI: ${metrics.roi.toFixed(2)}%`);

      leaderboard.push({
        userId: participant.user.id,
        userName: participant.user.username,
        email: participant.user.email,
        userImg: participant.user.img,
        virtualCash: metrics.virtualCash,
        unrealizedPnL: metrics.unrealizedPnL,
        realizedPnL: metrics.realizedPnL,
        totalPnL: metrics.totalPnL,
        portfolioValue: metrics.portfolioValue,
        roi: metrics.roi,
        usedCapital: metrics.usedCapital,
        availableCash: metrics.availableCash,
        totalTrades: participant.trades.length,
        openPositions: positionsWithLive.length,
        snapshot_time: now,
      });
    }

    // 4. Sort by total PnL (descending) and assign rank
    leaderboard.sort((a, b) => b.totalPnL - a.totalPnL);
    leaderboard.forEach((p, i) => (p.rank = i + 1));

    // 5. Store leaderboard in Redis for real-time API/streaming
    try {
      const leaderboardData = {
        contest_id: activeContest.id,
        snapshot_time: now,
        total_participants: leaderboard.length,
        leaderboard: leaderboard,
      };

      await redisClient.setex(
        `leaderboard:contest:${activeContest.id}`,
        60 * 15, // expire in 15 minutes
        JSON.stringify(leaderboardData)
      );

      // Also store top 10 for quick access
      await redisClient.setex(
        `leaderboard:top10:${activeContest.id}`,
        60 * 15,
        JSON.stringify({
          ...leaderboardData,
          leaderboard: leaderboard.slice(0, 10)
        })
      );

      console.log(`[LEADERBOARD] Cached leaderboard for contest ${activeContest.id}`);

      // Emit to Socket.IO if available
      if (global.io) {
        global.io.emit("leaderboardUpdate", leaderboardData);
      }
    } catch (err) {
      console.error("[LEADERBOARD] Error caching leaderboard in Redis:", err);
    }

    // 6. Save to database (Leaderboard table)
    for (const p of leaderboard) {
      try {
        await prisma.leaderboard.upsert({
          where: {
            contest_id_user_id_snapshot_time: {
              contest_id: activeContest.id,
              user_id: p.userId,
              snapshot_time: p.snapshot_time,
            }
          },
          update: {
            rank: p.rank,
            portfolio_value: p.portfolioValue,
            total_pnl: p.totalPnL,
            unrealized_pnl: p.unrealizedPnL,
            realized_pnl: p.realizedPnL,
            roi: p.roi,
            virtual_cash: p.virtualCash,
            snapshot_time: p.snapshot_time,
          },
          create: {
            contest_id: activeContest.id,
            user_id: p.userId,
            rank: p.rank,
            portfolio_value: p.portfolioValue,
            total_pnl: p.totalPnL,
            unrealized_pnl: p.unrealizedPnL,
            realized_pnl: p.realizedPnL,
            roi: p.roi,
            virtual_cash: p.virtualCash,
            snapshot_time: p.snapshot_time,
          },
        });
      } catch (err) {
        console.error(`[LEADERBOARD] Error saving leaderboard for user ${p.userId}:`, err);
      }
    }

    console.log(`[LEADERBOARD] Successfully generated leaderboard with ${leaderboard.length} participants`);
    
    // Log top 3 for verification
    const top3 = leaderboard.slice(0, 3);
    console.log('[LEADERBOARD] Top 3:');
    top3.forEach((p, i) => {
      console.log(`${i + 1}. ${p.userName} - PnL: ${p.totalPnL.toFixed(2)} - ROI: ${p.roi.toFixed(2)}%`);
    });

  } catch (error) {
    console.error("[LEADERBOARD] Cron error:", error);
  }
}

// Enhanced cron scheduling with error handling
cron.schedule("*/2 * * * *", async () => {
  try {
    console.log(`[LEADERBOARD] Starting scheduled leaderboard generation at ${new Date().toISOString()}`);
    await generateLeaderboard();
    console.log(`[LEADERBOARD] Completed scheduled leaderboard generation at ${new Date().toISOString()}`);
  } catch (error) {
    console.error("[LEADERBOARD] Scheduled task error:", error);
  }
});

// Manual trigger function for testing
async function triggerLeaderboardGeneration() {
  console.log('[LEADERBOARD] Manual trigger initiated');
  await generateLeaderboard();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[LEADERBOARD] Shutting down gracefully...');
  await redisClient.quit();
  process.exit(0);
});

module.exports = {
  generateLeaderboard,
  triggerLeaderboardGeneration,
  calculateRealizedPnL,
  calculateUnrealizedPnL,
  calculatePortfolioMetrics,
};