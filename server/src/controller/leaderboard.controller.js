const prisma = require("../utils/prisma");
const redisClient=require('../utils/redisutil')

const CACHE_TTL = 60; // seconds

const leaderboardController = {
  // Get leaderboard for a contest (latest snapshot)
  async getLeaderboardByContest(req, res) {
    try {
      const { contestId } = req.params;
      const cacheKey = `leaderboard:contest:${contestId}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      // Get latest snapshot_time for this contest
      const latest = await prisma.leaderboard.findFirst({
        where: { contest_id: parseInt(contestId) },
        orderBy: { snapshot_time: "desc" },
      });
      if (!latest) {
        return res.status(404).json({ error: "No leaderboard found" });
      }
      // Get all leaderboard entries for this snapshot
      const entries = await prisma.leaderboard.findMany({
        where: {
          contest_id: parseInt(contestId),
          snapshot_time: latest.snapshot_time,
        },
        include: {
          user: { select: { id: true, username: true, img: true, email: true } },
        },
        orderBy: { rank: "asc" },
      });
      const result = { snapshot_time: latest.snapshot_time, leaderboard: entries };
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard", details: error.message });
    }
  },

  // Get leaderboard history for a contest
  async getLeaderboardHistory(req, res) {
    try {
      const { contestId } = req.params;
      const cacheKey = `leaderboard:history:${contestId}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const history = await prisma.leaderboard.findMany({
        where: { contest_id: parseInt(contestId) },
        orderBy: [{ snapshot_time: "desc" }, { rank: "asc" }],
        include: {
          user: { select: { id: true, username: true, img: true, email: true } },
        },
      });
      const result = { history };
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard history", details: error.message });
    }
  },

  // Get leaderboard for a user (all contests)
  async getUserLeaderboard(req, res) {
    try {
      const userId = req.user?.userId || req.params.userId;
      const cacheKey = `leaderboard:user:${userId}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const entries = await prisma.leaderboard.findMany({
        where: { user_id: parseInt(userId) },
        orderBy: [{ snapshot_time: "desc" }, { contest_id: "desc" }],
        include: {
          contest: { select: { id: true, name: true, start_time: true, end_time: true } },
        },
      });
      const result = { leaderboard: entries };
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user leaderboard", details: error.message });
    }
  },
};

module.exports = leaderboardController;