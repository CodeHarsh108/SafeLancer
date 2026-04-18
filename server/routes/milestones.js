const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Milestone = require('../models/Milestone');
const Contract = require('../models/Contract');
const Job = require('../models/Job');
const Dispute = require('../models/Dispute');
const auth = require('../middleware/auth');
const { milestoneTransition } = require('../services/stateMachine');
const { performRelease } = require('../services/releaseService');
const isTestMode = require('../utils/isTestMode');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Helper: compile evidence summary for a milestone
async function compileEvidence(milestone) {
  const hashes = [];
  const videoHashes = [];
  if (milestone.submissionFileHash) hashes.push(milestone.submissionFileHash);
  if (milestone.submissionVideoHash) videoHashes.push(milestone.submissionVideoHash);

  const inaccuracyNotes = [];
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

// POST /api/milestones/:id/fund
router.post('/:id/fund', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    // Enforce sequential phase funding — phase N requires phase N-1 to be approved/released
    if (!milestone.isAdvance && milestone.milestoneNumber > 1) {
      const prev = await Milestone.findOne({ contract: milestone.contract, milestoneNumber: milestone.milestoneNumber - 1 });
      if (prev && !['approved', 'released'].includes(prev.status)) {
        return res.status(400).json({ message: `Phase ${milestone.milestoneNumber - 1} must be approved before funding Phase ${milestone.milestoneNumber}` });
      }
    }

    if (isTestMode()) {
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

    // Advance payment funded in test mode → activate contract and start the job
    if (milestone.isAdvance && isTestMode()) {
      await Contract.findByIdAndUpdate(milestone.contract, { status: 'active' });
      const contract = await Contract.findById(milestone.contract);
      if (contract) await Job.findByIdAndUpdate(contract.job, { status: 'in_progress' });
    }

    res.json({ ...updated.toObject(), razorpayOrderId: updated.razorpayOrderId, razorpayKeyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/verify-payment
router.post('/:id/verify-payment', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    milestone.razorpayPaymentId = razorpay_payment_id;
    await milestone.save();

    // If this is the advance milestone, activate the contract and start the job
    // Note: milestone is already 'funded' from the /fund call — do NOT transition again
    if (milestone.isAdvance) {
      await Contract.findByIdAndUpdate(milestone.contract, { status: 'active' });
      const contract = await Contract.findById(milestone.contract);
      if (contract) await Job.findByIdAndUpdate(contract.job, { status: 'in_progress' });
    }

    res.json({ success: true, milestoneId: milestone._id, contractId: milestone.contract });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// POST /api/milestones/:id/submit — freelancer uploads code file + demo video
router.post('/:id/submit', auth, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.freelancer.toString() !== req.user.id) return res.status(403).json({ message: 'Freelancers only' });
    if (milestone.isAdvance) return res.status(400).json({ message: 'Advance payment phase does not require file submission' });

    const allowedStates = ['funded', 'in_progress', 'inaccurate_1'];
    if (!allowedStates.includes(milestone.status)) {
      return res.status(400).json({ message: `Cannot submit in current state: ${milestone.status}` });
    }

    const files = req.files || {};

    // Both code file and demo video are required
    if (!files.file?.[0]) return res.status(400).json({ message: 'Code/deliverable file is required' });
    if (!files.video?.[0]) return res.status(400).json({ message: 'Demo video is required' });

    milestone.submissionNote = req.body.submissionNote || '';

    if (files.file?.[0]) {
      const codeBuffer = fs.readFileSync(files.file[0].path);
      milestone.submissionFileHash = crypto.createHash('sha256').update(codeBuffer).digest('hex');
      milestone.submissionFileUrl = '/uploads/' + files.file[0].filename;
    }
    if (files.video?.[0]) {
      const videoBuffer = fs.readFileSync(files.video[0].path);
      milestone.submissionVideoHash = crypto.createHash('sha256').update(videoBuffer).digest('hex');
      milestone.submissionVideoUrl = '/uploads/' + files.video[0].filename;
    }
    await milestone.save();

    // Transition: funded/in_progress → submitted → review in one call
    if (milestone.status === 'funded') await milestoneTransition(milestone._id, 'in_progress');
    await milestoneTransition(milestone._id, 'submitted');
    const updated = await milestoneTransition(milestone._id, 'review');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/extend-deadline — client extends deadline without changing status
router.post('/:id/extend-deadline', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    const allowedStates = ['funded', 'in_progress', 'submitted', 'review', 'inaccurate_1'];
    if (!allowedStates.includes(milestone.status)) {
      return res.status(400).json({ message: `Cannot extend deadline in status: ${milestone.status}` });
    }

    const { newDeadline, reason } = req.body;
    if (!newDeadline) return res.status(400).json({ message: 'newDeadline is required' });

    const nd = new Date(newDeadline);
    if (nd <= new Date()) return res.status(400).json({ message: 'New deadline must be in the future' });

    if (!milestone.originalDeadline) milestone.originalDeadline = milestone.deadline;
    milestone.deadline = nd;
    milestone.deadlineExtendedAt = new Date();
    milestone.deadlineExtensions.push({
      extendedAt: new Date(),
      newDeadline: nd,
      reason: reason || '',
      extendedBy: req.user.id
    });

    await milestone.save();
    res.json(milestone);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/review — client approves or disapproves (triggers reschedule)
router.post('/:id/review', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });
    if (milestone.isAdvance) return res.status(400).json({ message: 'Advance payment phase does not require review' });
    if (milestone.status !== 'review') return res.status(400).json({ message: 'Phase is not in review state' });

    const { approved, note, inaccuracyNote } = req.body;

    if (approved) {
      milestone.reviewNote = note || '';
      await milestone.save();
      await milestoneTransition(milestone._id, 'approved');
      // Auto-release immediately on approval — no separate release step needed
      const updated = await performRelease(milestone);
      return res.json(updated);
    }

    // Disapproval — increment reschedule count
    milestone.inaccuracyCount += 1;
    milestone.inaccuracyNote = inaccuracyNote || note || '';

    const maxRev = milestone.maxRevisions || 2;

    if (milestone.inaccuracyCount >= maxRev) {
      // Reschedule limit reached → auto-dispute
      await milestone.save();
      const updated = await milestoneTransition(milestone._id, 'disputed');
      const evidence = await compileEvidence(milestone);
      await Dispute.create({
        milestone: milestone._id,
        contract: milestone.contract,
        raisedBy: req.user.id,
        type: 'milestone',
        reason: `Auto-dispute: "${milestone.title}" disapproved ${milestone.inaccuracyCount}× (limit ${maxRev}). Last note: ${milestone.inaccuracyNote}`,
        evidenceSummary: evidence
      });
      return res.json(updated);
    }

    // Reschedule: extend deadline by 10% of original phase time
    if (!milestone.originalDeadline) milestone.originalDeadline = milestone.deadline;
    const originalDuration = milestone.originalDeadline.getTime() - new Date(milestone.createdAt).getTime();
    const extensionMs = Math.round(originalDuration * 0.1);
    const baseDate = Math.max(milestone.deadline.getTime(), Date.now());
    const nd = new Date(baseDate + extensionMs);

    milestone.deadline = nd;
    milestone.deadlineExtendedAt = new Date();
    milestone.deadlineExtensions.push({
      extendedAt: new Date(),
      newDeadline: nd,
      reason: `Disapproval #${milestone.inaccuracyCount}: ${milestone.inaccuracyNote}`,
      extendedBy: req.user.id
    });
    await milestone.save();
    const updated = await milestoneTransition(milestone._id, 'inaccurate_1');
    return res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/release — kept for dispute resolution / admin use
router.post('/:id/release', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });
    if (milestone.client.toString() !== req.user.id) return res.status(403).json({ message: 'Clients only' });

    const updated = await performRelease(milestone);
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

// GET /api/milestones/file/:milestoneId/:type — protected file download
// Client can only access after phase is approved; freelancer can always access their own uploads
router.get('/file/:milestoneId/:type', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Not found' });

    const isClient = milestone.client.toString() === req.user.id;
    const isFreelancer = milestone.freelancer.toString() === req.user.id;
    if (!isClient && !isFreelancer) return res.status(403).json({ message: 'Forbidden' });

    if (isClient) {
      const isVideo = req.params.type === 'video';
      const videoAllowed = ['review', 'approved', 'released', 'inaccurate_1', 'disputed'].includes(milestone.status);
      const codeAllowed = ['approved', 'released'].includes(milestone.status);
      if (isVideo && !videoAllowed) return res.status(403).json({ message: 'Demo video will be available once the freelancer submits deliverables' });
      if (!isVideo && !codeAllowed) return res.status(403).json({ message: 'Code file is locked until the phase is approved' });
    }

    const fileUrl = req.params.type === 'video' ? milestone.submissionVideoUrl : milestone.submissionFileUrl;
    if (!fileUrl) return res.status(404).json({ message: 'File not uploaded yet' });

    const filePath = path.join(__dirname, '..', fileUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found on disk' });

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
