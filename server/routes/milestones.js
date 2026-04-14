const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Milestone = require('../models/Milestone');
const Dispute = require('../models/Dispute');
const auth = require('../middleware/auth');
const { milestoneTransition } = require('../services/stateMachine');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/milestones/contract/:contractId
router.get('/contract/:contractId', auth, async (req, res) => {
  try {
    const milestones = await Milestone.find({ contract: req.params.contractId }).sort({ milestoneNumber: 1 });
    res.json(milestones);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/milestones/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const m = await Milestone.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Not found' });
    res.json(m);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/milestones/:id/fund — client creates Razorpay order (escrow hold)
// Test mode: RAZORPAY_KEY_ID missing or contains 'placeholder' → uses mock order_test_* id
router.post('/:id/fund', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    const isTestMode = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('placeholder');

    if (isTestMode) {
      milestone.razorpayOrderId = 'order_test_' + Date.now();
    } else {
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      const order = await razorpay.orders.create({
        amount: Math.round(milestone.amount * 100),
        currency: 'INR',
        receipt: milestone._id.toString(),
        notes: { milestoneId: milestone._id.toString() }
      });
      milestone.razorpayOrderId = order.id;
    }

    await milestone.save();
    const updated = await milestoneTransition(milestone._id, 'funded');
    res.json({ ...updated.toObject(), razorpayOrderId: updated.razorpayOrderId, razorpayKeyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/start — freelancer marks in_progress
router.post('/:id/start', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.freelancer.toString() !== req.user.id) return res.status(403).json({ message: 'Freelancers only' });
    const updated = await milestoneTransition(milestone._id, 'in_progress');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/submit — freelancer uploads work
router.post('/:id/submit', auth, upload.single('file'), async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.freelancer.toString() !== req.user.id) return res.status(403).json({ message: 'Freelancers only' });

    let fileHash = req.body.fileHash;
    let fileUrl = req.body.fileUrl;

    if (req.file) {
      const buffer = fs.readFileSync(req.file.path);
      fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
      fileUrl = '/uploads/' + req.file.filename;
    }

    if (!fileHash) {
      fileHash = crypto.createHash('sha256').update(req.body.submissionNote || Date.now().toString()).digest('hex');
    }

    milestone.submissionNote = req.body.submissionNote || '';
    milestone.submissionFileHash = fileHash;
    milestone.submissionFileUrl = fileUrl;
    await milestone.save();

    // Two sequential transitions in one request: in_progress → submitted → review
    // submitted sets submittedAt + autoReleaseAt (72h); review is the state clients act on
    await milestoneTransition(milestone._id, 'submitted');
    const updated = await milestoneTransition(milestone._id, 'review');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/review — client approves or marks inaccurate
router.post('/:id/review', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    const { approved, note, inaccuracyNote, newDeadline } = req.body;

    if (approved) {
      milestone.reviewNote = note || '';
      await milestone.save();
      const updated = await milestoneTransition(milestone._id, 'approved');
      return res.json(updated);
    }

    // Inaccurate
    milestone.inaccuracyCount += 1;
    milestone.inaccuracyNote = inaccuracyNote || note || '';

    if (milestone.inaccuracyCount === 1) {
      milestone.originalDeadline = milestone.deadline;
      milestone.deadline = newDeadline ? new Date(newDeadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      milestone.deadlineExtendedAt = new Date();
      await milestone.save();
      const updated = await milestoneTransition(milestone._id, 'inaccurate_1');
      return res.json(updated);
    }

    if (milestone.inaccuracyCount >= 2) {
      await milestone.save();
      await milestoneTransition(milestone._id, 'inaccurate_2');
      const updated = await milestoneTransition(milestone._id, 'disputed');

      // Auto-create dispute
      await Dispute.create({
        milestone: milestone._id,
        contract: milestone.contract,
        raisedBy: req.user.id,
        type: 'milestone',
        reason: `Auto-dispute: Milestone "${milestone.title}" rejected twice. First: ${milestone.inaccuracyNote}. Second: ${inaccuracyNote || note}`
      });

      return res.json(updated);
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/release — client releases payment
router.post('/:id/release', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    const isTestMode = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('placeholder');
    if (milestone.razorpayPaymentId && !isTestMode && !milestone.razorpayPaymentId.startsWith('pay_test_')) {
      // Razorpay captures payment at checkout time; initiate refund if needed via razorpay.payments.refund()
      // Release = payout to freelancer (handled via Razorpay Payouts or manual)
    }

    const updated = await milestoneTransition(milestone._id, 'released');

    // Business rule: releasing Phase 1 (milestoneNumber===1) also unlocks the advance payment
    // Advance = milestoneNumber===0, isAdvance=true — it stays in 'approved' until Phase 1 releases
    if (milestone.milestoneNumber === 1) {
      const advanceMilestone = await Milestone.findOne({ contract: milestone.contract, milestoneNumber: 0, isAdvance: true });
      if (advanceMilestone && advanceMilestone.status === 'approved') {
        await milestoneTransition(advanceMilestone._id, 'released');
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/schedule-meeting
router.post('/:id/schedule-meeting', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    milestone.meetingScheduledAt = new Date(req.body.scheduledAt);
    milestone.meetingRoomId = 'milestone-' + require('crypto').randomUUID();
    milestone.meetingStatus = 'scheduled';
    await milestone.save();
    res.json(milestone);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
