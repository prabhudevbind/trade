const cron = require("node-cron");
const prisma = require("../utils/prisma");
// cron.schedule(
//   "30 15 * * *",
// Run every day at 3:30 PM IST
cron.schedule("*/1 * * * *",
  async () => {
    try {
      console.log("🏆 Running daily prize distribution cron...");

      // Get all contests that ended today (or are ongoing and end before now)
      const now = new Date();
      const contests = await prisma.contest.findMany({
        where: {
        //   end_time: { lte: now },
          status: "ongoing",
        },
      });

      for (const contest of contests) {
        // Get the latest leaderboard snapshot for this contest
        const latestSnapshot = await prisma.leaderboard.findFirst({
          where: { contest_id: contest.id },
          orderBy: { snapshot_time: "desc" },
        });
        if (!latestSnapshot) continue;

        // Get all leaderboard entries for this snapshot, sorted by rank
        const leaderboard = await prisma.leaderboard.findMany({
          where: {
            contest_id: contest.id,
            snapshot_time: latestSnapshot.snapshot_time,
          },
          orderBy: { rank: "asc" },
        });

        // Get all prize slabs for this contest
        const prizes = await prisma.prizeDistribution.findMany({
          where: { contestId: contest.id },
        });

        // For each leaderboard entry, check if their rank is in any prize slab
        for (const entry of leaderboard) {
          const prize = prizes.find(
            (p) => entry.rank >= p.fromRank && entry.rank <= p.toRank
          );
          if (prize) {
            // Insert into WinningHistory (if not already awarded)
            await prisma.winningHistory.upsert({
              where: {
                contestId_userId_awardedAt: {
                  contestId: contest.id,
                  userId: entry.user_id,
                  awardedAt: now,
                },
              },
              update: {
                amount: prize.amount,
                rank: entry.rank,
              },
              create: {
                contestId: contest.id,
                userId: entry.user_id,
                rank: entry.rank,
                amount: prize.amount,
                awardedAt: now,
              },
            });
          }
        }

        // Optionally, update contest status to "completed"
        // await prisma.contest.update({
        //   where: { id: contest.id },
        //   data: { status: "completed" },
        // });
      }

      console.log("✅ Prize distribution completed.");
    } catch (err) {
      console.error("❌ Error in prize distribution cron:", err);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

module.exports = {};