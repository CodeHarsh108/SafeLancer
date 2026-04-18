const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/transactions/my — freelancer's own transactions + wallet balance
router.get('/my', auth, async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') return res.status(403).json({ message: 'Freelancers only' });

    const [transactions, user] = await Promise.all([
      Transaction.find({ freelancer: req.user.id })
        .populate('contract', 'hashId')
        .populate('milestone', 'title milestoneNumber isAdvance')
        .sort({ createdAt: -1 })
        .limit(50),
      User.findById(req.user.id, 'walletBalance')
    ]);

    res.json({ walletBalance: user?.walletBalance || 0, transactions });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
