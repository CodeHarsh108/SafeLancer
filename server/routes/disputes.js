const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Dispute = require('../models/Dispute');
const Milestone = require('../models/Milestone');
const auth = require('../middleware/auth');
const { performRelease, performSplitRelease, performRefund } = require('../services/releaseService');
const isTestMode = require('../utils/isTestMode');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});

async function buildEvidenceSummary(milestone) {
  if (!milestone) return null;
  const hashes = [];
  const videoHashes = [];
  const inaccuracyNotes = [];
  if (milestone.submissionFileHash) hashes.push(milestone.submissionFileHash);
  if (milestone.submissionVideoHash) videoHashes.push(milestone.submissionVideoHash);
  if (milestone.inaccuracyNote) inaccuracyNotes.push(milestone.inaccuracyNote);
  return {
    submissionHashes: hashes,
    videoHashes,
    deadlineExtensionCount: milestone.deadlineExtensions?.length || 0,
    inaccuracyNotes,
    autoCompiled: true,
    compiledAt: new Date()
  };
}

// POST /api/disputes/raise
router.post('/raise', auth, async (req, res) => {
  try {
    const { contractId, milestoneId, reason, type } = req.body;

    let evidenceSummary = null;
    if (milestoneId) {
      const milestone = await Milestone.findById(milestoneId);
      if (milestone) {
        await Milestone.findByIdAndUpdate(milestoneId, { status: 'disputed' });
        evidenceSummary = await buildEvidenceSummary(milestone);
      }
    }

    const dispute = new Dispute({
      contract: contractId,
      milestone: milestoneId || undefined,
      raisedBy: req.user.id,
      reason,
      type: type || 'manual',
      status: 'open',
      evidenceSummary
    });
    await dispute.save();
    res.status(201).json(dispute);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/disputes/:id/evidence — text evidence
router.post('/:id/evidence', auth, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Not found' });
    if (dispute.status !== 'open') return res.status(400).json({ message: 'Dispute already resolved' });
    dispute.evidence.push({
      submittedBy: req.user.id,
      description: req.body.description,
      fileUrl: req.body.fileUrl || ''
    });
    await dispute.save();
    const populated = await Dispute.findById(dispute._id).populate('evidence.submittedBy', 'name role');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/disputes/:id/evidence-file — file upload evidence
router.post('/:id/evidence-file', auth, upload.single('file'), async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Not found' });
    if (dispute.status !== 'open') return res.status(400).json({ message: 'Dispute already resolved' });
    const fileUrl = req.file ? '/uploads/' + req.file.filename : '';
    dispute.evidence.push({
      submittedBy: req.user.id,
      description: req.body.description || req.file?.originalname || 'File evidence',
      fileUrl
    });
    await dispute.save();
    const populated = await Dispute.findById(dispute._id).populate('evidence.submittedBy', 'name role');
    res.json(populated);
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

    if (dispute.milestone) {
      const milestone = await Milestone.findById(dispute.milestone);
      if (milestone) {
        if (resolution === 'release_to_freelancer') {
          // Full release: payout freelancer + unlock deliverable + check project completion
          await performRelease(milestone);
        } else if (resolution === 'refund_to_client') {
          if (!isTestMode() && milestone.razorpayPaymentId && !milestone.razorpayPaymentId.startsWith('pay_test_')) {
            const Razorpay = require('razorpay');
            const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
            await razorpay.payments.refund(milestone.razorpayPaymentId, { amount: Math.round(milestone.amount * 100) });
          }
          // Mark refunded + check project completion
          await performRefund(milestone);
        } else if (resolution === 'split' && splitPercent != null) {
          const freelancerAmount = Math.round(milestone.amount * splitPercent / 100);
          const clientAmount = milestone.amount - freelancerAmount;
          if (!isTestMode() && milestone.razorpayPaymentId && !milestone.razorpayPaymentId.startsWith('pay_test_')) {
            const Razorpay = require('razorpay');
            const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
            if (clientAmount > 0) {
              await razorpay.payments.refund(milestone.razorpayPaymentId, { amount: Math.round(clientAmount * 100) });
            }
          }
          // Release milestone + payout only freelancer's share + record transaction
          await performSplitRelease(milestone, freelancerAmount);
        }
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
      .populate({ path: 'contract', select: 'hashId amount', populate: [
        { path: 'client', select: 'name email' },
        { path: 'freelancer', select: 'name email' }
      ]})
      .populate('milestone', 'title amount status submissionNote submissionFileUrl submissionFileHash submissionVideoUrl submissionVideoHash inaccuracyNote inaccuracyCount deadlineExtensions maxRevisions submittedAt')
      .populate('raisedBy', 'name email role')
      .populate('evidence.submittedBy', 'name role')
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
      .populate('raisedBy', 'name role')
      .populate('milestone', 'title amount status')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/disputes/:id — single dispute with full details
router.get('/:id', auth, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('contract', 'hashId amount client freelancer')
      .populate('milestone', 'title amount status inaccuracyNote deadlineExtensions submissionFileHash submissionVideoHash inaccuracyCount maxRevisions')
      .populate('raisedBy', 'name email role')
      .populate('evidence.submittedBy', 'name role');
    if (!dispute) return res.status(404).json({ message: 'Not found' });
    res.json(dispute);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
