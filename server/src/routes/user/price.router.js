const prisma = require('../../utils/prisma');
const express = require('express');
const router = express.Router();

// CREATE PrizeDistribution
router.post('/prize-distribution', async (req, res) => {
  try {
    const { contestId, fromRank, toRank, amount } = req.body;
    const prize = await prisma.prizeDistribution.create({
      data: { contestId: Number(contestId), fromRank, toRank, amount }
    });
    res.status(201).json(prize);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ all PrizeDistributions for a contest
router.get('/prize-distribution/:contestId', async (req, res) => {
  try {
    const { contestId } = req.params;
    const prizes = await prisma.prizeDistribution.findMany({
      where: { contestId: Number(contestId) },
      orderBy: [{ fromRank: 'asc' }]
    });
    res.json(prizes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE PrizeDistribution by id
router.put('/prize-distribution/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fromRank, toRank, amount } = req.body;
    const updated = await prisma.prizeDistribution.update({
      where: { id: Number(id) },
      data: { fromRank, toRank, amount }
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE PrizeDistribution by id
router.delete('/prize-distribution/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.prizeDistribution.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// BULK CREATE/REPLACE PrizeDistributions for a contest
router.post('/prize-distribution/bulk', async (req, res) => {
  try {
    const { contestId, prizes } = req.body;
    if (!contestId || !Array.isArray(prizes)) {
      return res.status(400).json({ error: 'contestId and prizes array required' });
    }
    // Delete existing prize distributions for this contest
    await prisma.prizeDistribution.deleteMany({ where: { contestId: Number(contestId) } });
    // Create new prize distributions
    const created = await prisma.prizeDistribution.createMany({
      data: prizes.map(prize => ({
        contestId: Number(contestId),
        fromRank: prize.fromRank,
        toRank: prize.toRank,
        amount: prize.prizePerWinner // Save per-winner amount
      }))
    });
    res.status(201).json({ success: true, count: created.count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;