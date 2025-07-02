const cron = require("node-cron");
const prisma = require("../utils/prisma");
// cron.schedule("*/5 * * * *",
// --- CRON JOB: Reset all ongoing contests every night at 12:00 AM IST ---
cron.schedule("0 0 * * *",
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
        // Set start_time to 9:00 AM and end_time to 3:30 PM for tomorrow (IST)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // 9:00 AM
        const endOfDay = new Date(tomorrow);
        endOfDay.setHours(15, 30, 0, 0); // 3:30 PM
        await prisma.contest.update({
          where: { id: contestId },
          data: {
            start_time: tomorrow,
            end_time: endOfDay,
            status: "ongoing",
            updated_at: new Date(),
          },
        });
      }
    } catch (err) {
      // Optionally add error logging here
      console.error("Error resetting contests:", err);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

module.exports = {};