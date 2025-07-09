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
              // Check if prize already awarded for this contest and user
              const existingWin = await prisma.winningHistory.findFirst({
                where: {
                  contestId: contest.id,
                  userId: entry.user_id,
                },
              });

              if (existingWin) {
                // Update existing record
                await prisma.winningHistory.update({
                  where: { id: existingWin.id },
                  data: {
                    amount: prize.amount,
                    rank: entry.rank,
                    awardedAt: now,
                  },
                });
                console.log(`Updated prize for user ${entry.user_id} for rank ${entry.rank}`);
              } else {
                // Create new record
                await prisma.winningHistory.create({
                  data: {
                    contestId: contest.id,
                    userId: entry.user_id,
                    rank: entry.rank,
                    amount: prize.amount,
                    awardedAt: now,
                  },
                });
                console.log(`Created new prize record for user ${entry.user_id} for rank ${entry.rank}`);
              }
            } catch (error) {
              console.error(`Error processing user ${entry.user_id}:`, error);
            }
          }
        }

        // Update contest status to completed after processing
        // await prisma.contest.update({
        //   where: { id: contest.id },
        //   data: { status: "completed" },
        // });
        
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