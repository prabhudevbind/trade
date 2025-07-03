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

async function getLiveLTP(option) {
  const instrumentKey = `NSE_FO|${option.symbol}`;
  try {
    const cached = await redisClient.get(
      `option_chain:${instrumentKey}:${option.expiry_date.split("T")[0]}`
    );
    console.log(cached);
    if (cached) {
      const data = JSON.parse(cached);
      console.log(data);
      return (
        data.ltpc?.ltp || data.ff?.marketFF?.ltpc?.ltp || data.ltp || option.ltp
      );
    }
  } catch (e) {
    // Ignore error, fallback to DB value
  }
  return option.ltp;
}

async function generateLeaderboard() {
  try {
    // 1. Find the active contest
    const activeContest = await prisma.contest.findFirst({
      where: { status: "ongoing" },
    });
    if (!activeContest) return;

    // 2. Get all participants with their positions and trades
    const participants = await prisma.contestParticipant.findMany({
      where: { contest_id: activeContest.id },
      include: {
        user: { select: { id: true, username: true, img: true, email: true } },
        positions: { include: { option: true } },
        trades: {
          include: { option: true },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    // 3. For each participant, calculate stats
    const leaderboard = [];
    const now = new Date();

    for (const participant of participants) {
      // Get live LTP for each position
      let positionsWithLive = [];
      for (const pos of participant.positions) {
        const liveLtp = Number(await getLiveLTP(pos.option));
        console.log(liveLtp);
        positionsWithLive.push({
          ...pos,
          option: { ...pos.option, ltp: liveLtp },
        });
        const instrumentKey = `NSE_FO|${pos.option.symbol}`;
        const expiryStr =
          typeof pos.option.expiry_date === "string"
            ? pos.option.expiry_date
            : pos.option.expiry_date?.toISOString?.() || "";
        const expiryDateKey = expiryStr.split("T")[0];
        const cached = await redisClient.get(
          `option_chain:${instrumentKey}:${expiryDateKey}`
        );
        console.log(cached);
        if (cached) {
          const data = JSON.parse(cached);
          console.log(data);
        }
        // Debug log for each position
        console.log(
          `[LEADERBOARD DEBUG] User: ${participant.user.username} | Symbol: ${
            pos.option.symbol
          } | Avg Buy: ${pos.average_entry_price} | LTP: ${liveLtp} | Qty: ${
            pos.net_quantity
          } | PnL: ${
            (liveLtp - Number(pos.average_entry_price)).toFixed(2) *
            pos.net_quantity
          }`
        );
      }

      // Calculate unrealized PnL (open positions)
      const unrealizedPnL = positionsWithLive.reduce((sum, pos) => {
        const ltp = Number(pos.option.ltp);
        const avg = Number(pos.average_entry_price);
        return sum + (ltp - avg) * pos.net_quantity;
      }, 0);

      // Calculate realized PnL from trades
      const realizedPnL = participant.trades.reduce((total, trade) => {
        const tradeValue = Number(trade.price) * Math.abs(trade.quantity);
        return trade.action === "sell"
          ? total + tradeValue
          : total - tradeValue;
      }, 0);

      // Portfolio value
      const virtualCash = Number(participant.virtual_cash) || 0;
      const portfolioValue = virtualCash + unrealizedPnL;
      const initialCash = getInitialCash();
      const totalPnL = portfolioValue - initialCash;
      const roi =
        initialCash > 0
          ? ((portfolioValue - initialCash) / initialCash) * 100
          : 0;

      leaderboard.push({
        userId: participant.user.id,
        userName: participant.user.username,
        email: participant.user.email,
        virtualCash,
        unrealizedPnL,
        realizedPnL,
        totalPnL,
        portfolioValue,
        roi,
        totalTrades: participant.trades.length,
        snapshot_time: now,
      });
    }

    // 4. Sort by portfolio value (descending) and assign rank
    leaderboard.sort((a, b) => b.portfolioValue - a.portfolioValue);
    leaderboard.forEach((p, i) => (p.rank = i + 1));

    // Store leaderboard in Redis for real-time API/streaming
    try {
      await redisClient.set(
        `leaderboard:contest:${activeContest.id}`,
        JSON.stringify({
          snapshot_time: now,
          leaderboard,
        }),
        "EX",
        60 * 15 // expire in 15 minutes
      );
      // Emit to Socket.IO if available (optional, see below)
      if (global.io) {
        global.io.emit("leaderboardUpdate", {
          contestId: activeContest.id,
          snapshot_time: now,
          leaderboard,
        });
      }
    } catch (err) {
      console.error("Error caching leaderboard in Redis:", err);
    }

    // 5. Save to database (Leaderboard table)
    for (const p of leaderboard) {
      try {
        await prisma.leaderboard.create({
          data: {
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
        // If duplicate (unique constraint), update instead
        if (err.code === "P2002") {
          await prisma.leaderboard.updateMany({
            where: {
              contest_id: activeContest.id,
              user_id: p.userId,
              snapshot_time: p.snapshot_time,
            },
            data: {
              rank: p.rank,
              portfolio_value: p.portfolioValue,
              total_pnl: p.totalPnL,
              unrealized_pnl: p.unrealizedPnL,
              realized_pnl: p.realizedPnL,
              roi: p.roi,
              virtual_cash: p.virtualCash,
            },
          });
        } else {
          console.error("Error saving leaderboard to DB:", err);
        }
      }
    }
  } catch (e) {
    console.error("Leaderboard cron error:", e);
  }
}

// Schedule every 15 minutes (adjust as needed)
cron.schedule("*/1 * * * *", generateLeaderboard);

module.exports = {};
