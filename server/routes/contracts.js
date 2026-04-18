const express = require('express');
const router = express.Router();
const Contract = require('../models/Contract');
const Milestone = require('../models/Milestone');
const auth = require('../middleware/auth');
const isTestMode = require('../utils/isTestMode');

// GET /api/contracts/my-contracts — client
router.get('/my-contracts', auth, async (req, res) => {
  try {
    const contracts = await Contract.find({ client: req.user.id })
      .populate('freelancer', 'name email rating')
      .populate('job', 'title')
      .sort({ createdAt: -1 });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/contracts/my-work — freelancer
router.get('/my-work', auth, async (req, res) => {
  try {
    const contracts = await Contract.find({ freelancer: req.user.id })
      .populate('client', 'name email rating')
      .populate('job', 'title')
      .sort({ createdAt: -1 });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/contracts/:id — with milestones
router.get('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('client', 'name email rating')
      .populate('freelancer', 'name email rating')
      .populate('job', 'title description');
    if (!contract) return res.status(404).json({ message: 'Not found' });

    const isParty = contract.client._id.toString() === req.user.id ||
      contract.freelancer._id.toString() === req.user.id ||
      req.user.role === 'admin';
    if (!isParty) return res.status(403).json({ message: 'Not your contract' });

    const milestones = await Milestone.find({ contract: contract._id }).sort({ milestoneNumber: 1 });
    res.json({ contract, milestones });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/contracts/:id/withdraw — client withdrawal with 50% rule
router.post('/:id/withdraw', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Not found' });
    if (contract.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    const milestones = await Milestone.find({ contract: contract._id });
    const total = milestones.length;

    const approved = milestones.filter(m => ['approved', 'released'].includes(m.status)).length;
    const inProgress = milestones.filter(m => ['in_progress', 'submitted', 'review', 'funded'].includes(m.status)).length;
    const completionRatio = total > 0 ? (approved + inProgress * 0.5) / total : 0;
    const completionPercent = Math.round(completionRatio * 100);

    if (completionRatio <= 0.5) {
      // Free withdrawal — refund all captured Razorpay payments
      for (const m of milestones) {
        if (['funded', 'in_progress'].includes(m.status)) {
          if (!isTestMode() && m.razorpayPaymentId && !m.razorpayPaymentId.startsWith('pay_test_')) {
            try {
              const Razorpay = require('razorpay');
              const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
              const refundAmt = m.clientTotal || m.amount;
              await razorpay.payments.refund(m.razorpayPaymentId, { amount: Math.round(refundAmt * 100) });
            } catch (e) {}
          }
          m.status = 'refunded';
          await m.save();
        }
      }
      contract.status = 'withdrawn';
      contract.withdrawnAt = new Date();
      await contract.save();
      return res.json({ allowed: true, completionPercent, message: 'Contract withdrawn. All frozen funds refunded.' });
    }

    const amountOwed = milestones
      .filter(m => ['in_progress', 'submitted', 'review', 'funded'].includes(m.status))
      .reduce((sum, m) => sum + m.amount, 0);

    res.json({
      allowed: false,
      completionPercent,
      amountOwed,
      message: `Work is ${completionPercent}% complete. You must pay ₹${amountOwed} before withdrawing.`
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
