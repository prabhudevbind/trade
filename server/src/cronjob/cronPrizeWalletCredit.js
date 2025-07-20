const cron = require("node-cron");
const prisma = require("../utils/prisma");

// Every minute, check for winningHistory entries to credit wallet after 10 minutes
cron.schedule("30 15 * * *", async () => {
  try {
    const now = new Date();
    // Find all winningHistory entries not yet credited, and awardedAt > 10 min ago
    const toCredit = await prisma.winningHistory.findMany({
      where: {
        // walletCredited: false,
        awardedAt: {
          lte: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
        },
      },
    });

    for (const win of toCredit) {
      try {
        await prisma.$transaction([
          prisma.walletTransaction.create({
            data: {
              user_id: win.userId,
              amount: win.amount,
              type: "CONTEST_WIN", // Use your TransactionType enum value
              status: "SUCCESS",   // Use your TransactionStatus enum value
              payment_method: "CONTEST_PRIZE",
            },
          }),
          prisma.user.update({
            where: { id: win.userId },
            data: {
              amounts: { increment: win.amount },
            },
          }),
          prisma.winningHistory.update({
            where: { id: win.id },
            data: { walletCredited: true },
          }),
        ]);
        console.log(`Wallet credited for user ${win.userId} (win id ${win.id})`);
      } catch (err) {
        console.error(`Error crediting wallet for win id ${win.id}:`, err);
      }
    }
  } catch (err) {
    console.error("❌ Error in wallet credit cron:", err);
  }
}, {
  timezone: "Asia/Kolkata",
});

module.exports = {};
