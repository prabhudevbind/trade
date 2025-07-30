const cron = require("node-cron");
const prisma = require("../utils/prisma");

// Run every day at 3:30 PM IST
cron.schedule("30 15 * * *", 
  async () => {
    try {
      console.log("🏆 Running daily prize distribution cron...");

      const now = new Date();
      
      // Get all contests that ended recently (within last 24 hours) and haven't been processed
      const contests = await prisma.contest.findMany({
        where: {
          // end_time: { lte: now },
          status: "ongoing", // Or add a "completed" status after processing
        },
      });

      for (const contest of contests) {
        console.log(`Processing contest ${contest.id}...`);
        
        // Get the latest leaderboard snapshot for this contest
        const latestSnapshot = await prisma.leaderboard.findFirst({
          where: { contest_id: contest.id },
          orderBy: { snapshot_time: "desc" },
        });
        
        if (!latestSnapshot) {
          console.log(`No leaderboard snapshot found for contest ${contest.id}`);
          continue;
        }

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
          orderBy: { fromRank: "asc" },
        });

        console.log(`Found ${leaderboard.length} participants and ${prizes.length} prize slabs`);

        // Process each leaderboard entry
        for (const entry of leaderboard) {
          const prize = prizes.find(
            (p) => entry.rank >= p.fromRank && entry.rank <= p.toRank
          );
          
          if (prize) {
            try {
              // Upsert winning history to handle unique constraint
              await prisma.winningHistory.upsert({
                where: {
                  contestId_userId: {
                    contestId: contest.id,
                    userId: entry.user_id,
                  },
                },
                update: {
                  amount: prize.amount,
                  rank: entry.rank,
                  awardedAt: now,
                  winDate: now,
                  leaderboardId: entry.id,
                },
                create: {
                  contestId: contest.id,
                  userId: entry.user_id,
                  rank: entry.rank,
                  amount: prize.amount,
                  awardedAt: now,
                  winDate: now,
                  leaderboardId: entry.id,
                },
              });
              console.log(`Upserted prize for user ${entry.user_id} for rank ${entry.rank}`);

              // Add winning amount to user's wallet and create WalletTransaction
              await prisma.$transaction([
                prisma.walletTransaction.create({
                  data: {
                    user_id: entry.user_id,
                    amount: prize.amount,
                    type: "CONTEST_WIN", // Use your TransactionType enum value
                    status: "SUCCESS",   // Use your TransactionStatus enum value
                    payment_method: "CONTEST_PRIZE",
                  },
                }),
                prisma.user.update({
                  where: { id: entry.user_id },
                  data: {
                    amount: { increment: prize.amount },
                  },
                }),
              ]);
              console.log(`Credited ₹${prize.amount} to user ${entry.user_id} wallet`);
            } catch (error) {
              console.error(`Error processing user ${entry.user_id}:`, error);
            }
          }
        }
        
        console.log(`Contest ${contest.id} marked as completed`);
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