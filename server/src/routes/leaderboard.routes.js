const express = require("express");
const Redis = require("ioredis");
const leaderboardController = require("../controller/leaderboard.controller");
const { authenticateToken } = require("../utils/verify");
const {
  generateLeaderboard,
  triggerLeaderboardGeneration,
  getLeaderboardData,
  getUserLeaderboardPosition,
} = require("../cronjob/cronLeaderboard");
const prisma = require("../utils/prisma");

const router = express.Router();

// Redis client configuration
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null,
});

// Get latest leaderboard for a contest
router.get(
  "/contest/:contestId",
  leaderboardController.getLeaderboardByContest
);

// Get leaderboard history for a contest
router.get(
  "/contest/:contestId/history",
  leaderboardController.getLeaderboardHistory
);

// Get leaderboard for a user (all contests)
router.get("/user/:userId", leaderboardController.getUserLeaderboard);

// Authenticated user's leaderboard
router.get("/me", authenticateToken, leaderboardController.getUserLeaderboard);

// Get all winning history, optionally filtered by date range
router.get("/winning-history", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.winDate = {};
      if (startDate) where.winDate.gte = new Date(startDate + "T00:00:00.000Z");
      if (endDate) where.winDate.lte = new Date(endDate + "T23:59:59.999Z");
    }
    // Today's date range for leaderboard snapshot_time
    const today = startDate || new Date().toISOString().slice(0, 10);
    const leaderboardDateStart = new Date(today + "T00:00:00.000Z");
    const leaderboardDateEnd = new Date(today + "T23:59:59.999Z");

    const data = await prisma.winningHistory.findMany({
      where,
      orderBy: { winDate: "desc" },
      include: {
        user: true,
        // contest: true,
        leaderboard:true,
      },
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all winning history records (no filters)
router.get("/all-winning-history", async (req, res) => {
  try {
    const data = await prisma.winningHistory.findMany({
      orderBy: { winDate: "desc" },
      include: {
        user: {
          include: {
            walletTransactions: true,
          
          },
        },
      },
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get winning history for a user, optionally filtered by date range
router.get("/user/:userId/winning-history", async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    const where = { userId: parseInt(userId) };
    if (startDate || endDate) {
      where.winDate = {};
      if (startDate) where.winDate.gte = new Date(startDate + "T00:00:00.000Z");
      if (endDate) where.winDate.lte = new Date(endDate + "T23:59:59.999Z");
    }
    const data = await prisma.winningHistory.findMany({
      where,
      orderBy: { winDate: "desc" },
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Socket.IO implementation for real-time leaderboard
function registerLeaderboardSocket(io) {
  const activeSubscriptions = new Map();

  io.on("connection", (socket) => {
    console.log(`📊 Leaderboard client connected: ${socket.id}`);

    // Subscribe to real-time leaderboard updates
    socket.on("leaderboard:subscribe", async ({ contest_id, user_id }) => {
      try {
        if (!contest_id) {
          socket.emit("leaderboard:error", {
            success: false,
            message: "contest_id is required",
          });
          return;
        }

        // Join contest room
        socket.join(`contest:${contest_id}`);

        // Track subscription
        if (!activeSubscriptions.has(contest_id)) {
          activeSubscriptions.set(contest_id, new Set());
        }
        activeSubscriptions.get(contest_id).add(socket.id);

        // Send current leaderboard data
        const leaderboardData = await getLeaderboardData(contest_id);
        if (leaderboardData) {
          socket.emit("leaderboard:data", leaderboardData);

          // If user_id provided, send user-specific data
          if (user_id) {
            const userPosition = await getUserLeaderboardPosition(
              contest_id,
              user_id
            );
            if (userPosition) {
              socket.emit("leaderboard:userPosition", userPosition);
            }
          }
        }

        socket.emit("leaderboard:subscribed", {
          success: true,
          message: "Successfully subscribed to leaderboard updates",
          contest_id,
          clients_count: activeSubscriptions.get(contest_id).size,
        });
      } catch (error) {
        console.error("❌ Leaderboard subscription error:", error);
        socket.emit("leaderboard:error", {
          success: false,
          message: error.message,
        });
      }
    });

    // Subscribe to user-specific updates
    socket.on("leaderboard:subscribeUser", async ({ contest_id, user_id }) => {
      try {
        if (!contest_id || !user_id) {
          socket.emit("leaderboard:error", {
            success: false,
            message: "contest_id and user_id are required",
          });
          return;
        }

        // Join user-specific room
        socket.join(`user:${contest_id}:${user_id}`);

        // Send current user position
        const userPosition = await getUserLeaderboardPosition(
          contest_id,
          user_id
        );
        if (userPosition) {
          socket.emit("leaderboard:userPosition", userPosition);
        }

        socket.emit("leaderboard:userSubscribed", {
          success: true,
          message: "Successfully subscribed to user position updates",
          contest_id,
          user_id,
        });
      } catch (error) {
        console.error("❌ User subscription error:", error);
        socket.emit("leaderboard:error", {
          success: false,
          message: error.message,
        });
      }
    });

    // Get leaderboard rankings around a specific user
    socket.on(
      "leaderboard:getRankingAround",
      async ({ contest_id, user_id, range = 5 }) => {
        try {
          if (!contest_id || !user_id) {
            socket.emit("leaderboard:error", {
              success: false,
              message: "contest_id and user_id are required",
            });
            return;
          }

          const leaderboardData = await getLeaderboardData(contest_id);
          if (!leaderboardData) {
            socket.emit("leaderboard:error", {
              success: false,
              message: "Leaderboard data not found",
            });
            return;
          }

          const userIndex = leaderboardData.leaderboard.findIndex(
            (u) => u.userId === user_id
          );
          if (userIndex === -1) {
            socket.emit("leaderboard:error", {
              success: false,
              message: "User not found in leaderboard",
            });
            return;
          }

          const start = Math.max(0, userIndex - range);
          const end = Math.min(
            leaderboardData.leaderboard.length,
            userIndex + range + 1
          );
          const rankingAround = leaderboardData.leaderboard.slice(start, end);

          socket.emit("leaderboard:rankingAround", {
            success: true,
            contest_id,
            user_id,
            range,
            rankings: rankingAround,
            user_rank: userIndex + 1,
          });
        } catch (error) {
          console.error("❌ Ranking around error:", error);
          socket.emit("leaderboard:error", {
            success: false,
            message: error.message,
          });
        }
      }
    );

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`📊 Leaderboard client disconnected: ${socket.id}`);

      // Clean up subscriptions
      activeSubscriptions.forEach((clients, contest_id) => {
        if (clients.has(socket.id)) {
          clients.delete(socket.id);
          if (clients.size === 0) {
            activeSubscriptions.delete(contest_id);
          }
        }
      });
    });
  });

  // Periodic leaderboard updates
  setInterval(async () => {
    for (const contest_id of activeSubscriptions.keys()) {
      try {
        await triggerLeaderboardGeneration(contest_id);
        const leaderboardData = await getLeaderboardData(contest_id);
        io.to(`contest:${contest_id}`).emit(
          "leaderboard:data",
          leaderboardData
        );
      } catch (error) {
        console.error(
          `❌ Error updating leaderboard for contest ${contest_id}:`,
          error
        );
      }
    }
  }, 60000); // Update every minute
}

module.exports = {
  router,
  registerLeaderboardSocket,
};
