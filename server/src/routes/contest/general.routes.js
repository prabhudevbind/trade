const express = require('express');
const router = express.Router();
const {
  contestController,
  contestParticipantController,
  optionController,
  positionController,
  tradeController,
  walletTransactionController,
  contestWinnerController,
  referralController,
} = require('../../controller/controller');
const { authenticateToken } = require('../../utils/verify');
const { route } = require('./payment.routes');

// Contest Routes
router.post('/contests', authenticateToken, contestController.createContest);
router.get('/contests', contestController.getAllContests);
router.get('/contests/:id',authenticateToken, contestController.getContestById);
router.put('/contests/:id', contestController.updateContest);
router.delete('/contests/:id', contestController.deleteContest);

// ContestParticipant Routes
router.post('/contest-participants', authenticateToken,contestParticipantController.createContestParticipant);
router.get('/contest-participants',authenticateToken, contestParticipantController.getAllContestParticipants);
router.get('/contest-participants/active', authenticateToken, contestParticipantController.getActiveContestForUser);
router.get('/contest-participants/:id',authenticateToken, contestParticipantController.getContestParticipantById);
router.put('/contest-participants/:id', contestParticipantController.updateContestParticipant);
router.delete('/contest-participants/:id', contestParticipantController.deleteContestParticipant);

// Option Routes
router.post('/options', optionController.createOption);
router.get('/options', optionController.getAllOptions);
router.get('/options/:id', optionController.getOptionById);
router.put('/options/:id', optionController.updateOption);
router.delete('/options/:id', optionController.deleteOption);
// Sell (update) a position: PATCH /positions/:id/sell
router.patch('/positions/:id/sell', authenticateToken, positionController.sellPosition);
// Position Routes
router.post('/positions',authenticateToken, positionController.createPosition);
router.get('/positions',authenticateToken, positionController.getAllPositions);
router.get('/positions/:id', positionController.getPositionById);
router.put('/positions/:id',authenticateToken, positionController.updatePosition);
router.delete('/positions/:id', positionController.deletePosition);

router.get(
  '/trading-data',
  authenticateToken,
  contestParticipantController.getUserTradingData
);

// Trade Routes
router.post('/trades',authenticateToken, tradeController.createTrade);
router.get('/trades/active', authenticateToken, contestParticipantController.getUserActiveTrades);
router.get('/trades/leaderboard', authenticateToken, contestParticipantController.getActiveContestLeaderboard);
router.get('/trades',authenticateToken, tradeController.getAllTrades);
router.get('/trades/:id',authenticateToken, tradeController.getTradeById);
router.put('/trades/:id',authenticateToken, tradeController.updateTrade);
router.delete('/trades/:id',authenticateToken, tradeController.deleteTrade);

// WalletTransaction Routes
router.post('/wallet-transactions',authenticateToken, walletTransactionController.createWalletTransaction);
router.get('/wallet-transactions',authenticateToken, walletTransactionController.getAllWalletTransactions);
router.get('/wallet-transactions/:id',authenticateToken, walletTransactionController.getWalletTransactionById);
router.put('/wallet-transactions/:id',authenticateToken, walletTransactionController.updateWalletTransaction);
router.delete('/wallet-transactions/:id',authenticateToken, walletTransactionController.deleteWalletTransaction);

// ContestWinner Routes
router.post('/contest-winners', contestWinnerController.createContestWinner);
router.get('/contest-winners', contestWinnerController.getAllContestWinners);
router.get('/contest-winners/:id', contestWinnerController.getContestWinnerById);
router.put('/contest-winners/:id', contestWinnerController.updateContestWinner);
router.delete('/contest-winners/:id', contestWinnerController.deleteContestWinner);

// Referral Routes
router.post('/referrals', referralController.createReferral);
router.get('/referrals', referralController.getAllReferrals);
router.get('/referrals/:id', referralController.getReferralById);
router.put('/referrals/:id', referralController.updateReferral);
router.delete('/referrals/:id', referralController.deleteReferral);

module.exports = router;