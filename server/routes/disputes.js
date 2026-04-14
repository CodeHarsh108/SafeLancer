const express = require('express');
const router = express.Router();
const Dispute = require('../models/Dispute');
const Milestone = require('../models/Milestone');
const auth = require('../middleware/auth');

// POST /api/disputes/raise — either party
router.post('/raise', auth, async (req, res) => {
  try {
    const { contractId, milestoneId, reason, type } = req.body;
    const dispute = new Dispute({
      contract: contractId,
      milestone: milestoneId || undefined,
      raisedBy: req.user.id,
      reason,
      type: type || 'manual',
      status: 'open'
    });
    await dispute.save();

    if (milestoneId) {
      await Milestone.findByIdAndUpdate(milestoneId, { status: 'disputed' });
    }
    res.status(201).json(dispute);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/disputes/:id/evidence
router.post('/:id/evidence', auth, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Not found' });
    dispute.evidence.push({
      submittedBy: req.user.id,
      description: req.body.description,
      fileUrl: req.body.fileUrl || ''
    });
    await dispute.save();
    res.json(dispute);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/disputes/:id/resolve — admin only
router.patch('/:id/resolve', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Not found' });

    const { resolution, splitPercent } = req.body;
    dispute.resolution = resolution;
    dispute.splitPercent = splitPercent;
    dispute.resolvedBy = req.user.id;
    dispute.resolvedAt = new Date();
    dispute.status = 'resolved';

    const isTestMode = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('placeholder');

    if (dispute.milestone) {
      const milestone = await Milestone.findById(dispute.milestone);
      if (milestone) {
        if (resolution === 'release_to_freelancer') {
          // In live mode: initiate payout to freelancer via Razorpay Payouts
          if (!isTestMode && milestone.razorpayPaymentId && !milestone.razorpayPaymentId.startsWith('pay_test_')) {
            // Razorpay Payouts API would be used here to transfer to freelancer's bank account
            console.log(`Release to freelancer for payment: ${milestone.razorpayPaymentId}`);
          }
          milestone.status = 'released';
          milestone.releasedAt = new Date();
        } else if (resolution === 'refund_to_client') {
          if (!isTestMode && milestone.razorpayPaymentId && !milestone.razorpayPaymentId.startsWith('pay_test_')) {
            const Razorpay = require('razorpay');
            const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
            await razorpay.payments.refund(milestone.razorpayPaymentId, { amount: Math.round(milestone.amount * 100) });
          }
          milestone.status = 'refunded';
        }
        await milestone.save();
      }
    }

    await dispute.save();
    res.json(dispute);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/disputes/admin/all — admin only
router.get('/admin/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    const disputes = await Dispute.find()
      .populate('contract', 'hashId amount')
      .populate('milestone', 'title amount status inaccuracyNote')
      .populate('raisedBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/disputes/contract/:contractId
router.get('/contract/:contractId', auth, async (req, res) => {
  try {
    const disputes = await Dispute.find({ contract: req.params.contractId })
      .populate('raisedBy', 'name')
      .populate('milestone', 'title');
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
