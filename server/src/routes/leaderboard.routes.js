const express = require("express");
const leaderboardController = require("../controller/leaderboard.controller");
const { authenticateToken } = require("../utils/verify");

const router = express.Router();

// Get latest leaderboard for a contest
router.get("/contest/:contestId", leaderboardController.getLeaderboardByContest);

// Get leaderboard history for a contest
router.get("/contest/:contestId/history", leaderboardController.getLeaderboardHistory);

// Get leaderboard for a user (all contests)
router.get("/user/:userId", leaderboardController.getUserLeaderboard);

// (Optional) Authenticated user's leaderboard
router.get("/me", authenticateToken, leaderboardController.getUserLeaderboard);

module.exports = router;