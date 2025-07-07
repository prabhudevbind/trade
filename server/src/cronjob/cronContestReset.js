const cron = require("node-cron");
const prisma = require("../utils/prisma");
// cron.schedule("*/5 * * * *",
// --- CRON JOB: Reset all ongoing contests every night at 12:00 AM IST ---
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      // Fetch all ongoing contests
      const ongoingContests = await prisma.contest.findMany({
        where: { status: "ongoing" },
      });

      if (!ongoingContests.length) {
        return;
      }

      for (const contest of ongoingContests) {
        const contestId = contest.id;

        // Find all participants for this contest
        const participants = await prisma.contestParticipant.findMany({
          where: { contest_id: contestId },
        });

        const participantIds = participants.map((p) => p.id);

        if (participantIds.length > 0) {
          // Delete all trades for these participants
          await prisma.trade.deleteMany({
            where: { contest_participant_id: { in: participantIds } },
          });

          // Delete all positions for these participants
          await prisma.position.deleteMany({
            where: { contest_participant_id: { in: participantIds } },
          });

          // Remove all participants
          await prisma.contestParticipant.deleteMany({
            where: { contest_id: contestId },
          });
        }

        // Set start_time to 9:00 AM IST and end_time to 3:30 PM IST for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 9:00 AM IST = 3:30 AM UTC (IST is UTC+5:30)
        const startTimeUTC = new Date(
          Date.UTC(
            tomorrow.getFullYear(),
            tomorrow.getMonth(),
            tomorrow.getDate(),
            3,
            30,
            0,
            0 // 9:00 AM IST = 3:30 AM UTC
          )
        );

        // 3:30 PM IST = 10:00 AM UTC (15:30 IST - 5:30 = 10:00 UTC)
        const endTimeUTC = new Date(
          Date.UTC(
            tomorrow.getFullYear(),
            tomorrow.getMonth(),
            tomorrow.getDate(),
            10,
            0,
            0,
            0 // 3:30 PM IST = 10:00 AM UTC
          )
        );

        // Convert to ISO strings for database storage
        const startTimeString = startTimeUTC.toISOString();
        const endTimeString = endTimeUTC.toISOString();

        await prisma.contest.update({
          where: { id: contestId },
          data: {
            start_time: startTimeString,
            end_time: endTimeString,
            status: "ongoing",
            updated_at: new Date(),
          },
        });
      }
    } catch (err) {
      console.error("Error resetting contests:", err);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

module.exports = {};
