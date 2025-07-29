const cron = require("node-cron");
const prisma = require("../utils/prisma");

// Every day at 3:30 PM, check for winningHistory entries to credit wallet after 10 minutes
cron.schedule("30 15 * * *", async () => {
  try {
    const now = new Date();
    // Find all winningHistory entries not yet credited, and awardedAt > 10 min ago
    const toCredit = await prisma.winningHistory.findMany({
      where: {
        walletCredited: false, // ✅ This ensures we only process uncredited entries
        awardedAt: {
          lte: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
        },
      },
    });

    console.log(`Found ${toCredit.length} winning entries to credit`);

    for (const win of toCredit) {
      try {
        // ✅ Double-check before processing to avoid race conditions
        const winningEntry = await prisma.winningHistory.findUnique({
          where: { id: win.id },
          select: { walletCredited: true }
        });

        if (winningEntry?.walletCredited) {
          console.log(`Win id ${win.id} already credited, skipping`);
          continue;
        }

        await prisma.$transaction([
          // Create wallet transaction
          prisma.walletTransaction.create({
            data: {
              user_id: win.userId,
              amount: win.amount,
              type: "CONTEST_WIN", 
              status: "SUCCESS",   
              payment_method: "CONTEST_PRIZE",
              // ✅ Add reference to winning history for tracking
              reference_id: win.id.toString(),
              description: `Contest prize for win #${win.id}`,
            },
          }),
          // Update user wallet balance
          prisma.user.update({
            where: { id: win.userId },
            data: {
              amounts: { increment: win.amount },
            },
          }),
          // ✅ Mark as credited with timestamp
          prisma.winningHistory.update({
            where: { id: win.id },
            data: { 
              walletCredited: true,
              creditedAt: new Date(), // Add timestamp when credited
            },
          }),
        ], {
          // ✅ Add transaction timeout to prevent hanging transactions
          timeout: 10000, // 10 seconds
        });
        
        console.log(`✅ Wallet credited for user ${win.userId} (win id ${win.id}, amount: ${win.amount})`);
        
      } catch (err) {
        console.error(`❌ Error crediting wallet for win id ${win.id}:`, err);
        // ✅ Optional: Mark as failed for manual review
        try {
          await prisma.winningHistory.update({
            where: { id: win.id },
            data: { 
              creditError: err.message,
              lastCreditAttempt: new Date(),
            },
          });
        } catch (updateErr) {
          console.error(`Failed to log error for win id ${win.id}:`, updateErr);
        }
      }
    }
    
    if (toCredit.length > 0) {
      console.log(`✅ Processed ${toCredit.length} winning entries`);
    }
    
  } catch (err) {
    console.error("❌ Error in wallet credit cron:", err);
  }
}, {
  timezone: "Asia/Kolkata",
});

module.exports = {};