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

// Contest Routes
router.post('/contests', authenticateToken, contestController.createContest);
router.get('/contests', contestController.getAllContests);
router.get('/contests/:id', contestController.getContestById);
router.put('/contests/:id', contestController.updateContest);
router.delete('/contests/:id', contestController.deleteContest);

// ContestParticipant Routes
router.post('/contest-participants', contestParticipantController.createContestParticipant);
router.get('/contest-participants', contestParticipantController.getAllContestParticipants);
router.get('/contest-participants/:id', contestParticipantController.getContestParticipantById);
router.put('/contest-participants/:id', contestParticipantController.updateContestParticipant);
router.delete('/contest-participants/:id', contestParticipantController.deleteContestParticipant);

// Option Routes
router.post('/options', optionController.createOption);
router.get('/options', optionController.getAllOptions);
router.get('/options/:id', optionController.getOptionById);
router.put('/options/:id', optionController.updateOption);
router.delete('/options/:id', optionController.deleteOption);

// Position Routes
router.post('/positions', positionController.createPosition);
router.get('/positions', positionController.getAllPositions);
router.get('/positions/:id', positionController.getPositionById);
router.put('/positions/:id', positionController.updatePosition);
router.delete('/positions/:id', positionController.deletePosition);

// Trade Routes
router.post('/trades', tradeController.createTrade);
router.get('/trades', tradeController.getAllTrades);
router.get('/trades/:id', tradeController.getTradeById);
router.put('/trades/:id', tradeController.updateTrade);
router.delete('/trades/:id', tradeController.deleteTrade);

// WalletTransaction Routes
router.post('/wallet-transactions', walletTransactionController.createWalletTransaction);
router.get('/wallet-transactions', walletTransactionController.getAllWalletTransactions);
router.get('/wallet-transactions/:id', walletTransactionController.getWalletTransactionById);
router.put('/wallet-transactions/:id', walletTransactionController.updateWalletTransaction);
router.delete('/wallet-transactions/:id', walletTransactionController.deleteWalletTransaction);

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