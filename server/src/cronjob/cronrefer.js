const cron = require("node-cron")
const prisma = require("../utils/prisma")

// Cron job to reward referrers ₹50 when their referred user has a verified deposit and has joined a contest
async function rewardReferrers() {
  // Get all referrals where reward_amount < 50 (not yet rewarded)
  const referrals = await prisma.referral.findMany({
    where: { reward_amount: { lt: 50 } },
    include: { referred: true, referrer: true },
  })

  for (const referral of referrals) {
    const referredId = referral.referred_id
    // 1. Check if referred user has a verified wallet transaction
    const hasVerifiedDeposit = await prisma.walletTransaction.findFirst({
      where: {
        user_id: referredId,
        payment_verify: true,
        status: "SUCCESS",
      },
    })
    // 2. Check if referred user has joined any contest
    const hasJoinedContest = await prisma.contestParticipant.findFirst({
      where: { user_id: referredId },
    })
    // 3. If both true and not already rewarded, reward referrer
    if (hasVerifiedDeposit && hasJoinedContest) {
      // Add ₹50 to referrer's wallet
      await prisma.walletTransaction.create({
        data: {
          user_id: referral.referrer_id,
          amount: 50,
          type: "CREDIT",
          status: "SUCCESS",
          payment_method: "Referral Bonus",
          payment_verify: true,
        },
      })
      // Update referral as rewarded
      await prisma.referral.update({
        where: { id: referral.id },
        data: { reward_amount: 50 },
      })
      console.log(`Rewarded referrer ${referral.referrer_id} for referred user ${referredId}`)
    }
  }
}

// Schedule the cron job to run every 10 minutes
cron.schedule("*/10 * * * *", async () => {
  try {
    await rewardReferrers()
  } catch (e) {
    console.error("Referral cron error:", e)
  }
})

module.exports = rewardReferrers
