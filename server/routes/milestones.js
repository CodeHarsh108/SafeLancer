const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const Milestone = require('../models/Milestone');
const Contract = require('../models/Contract');
const Job = require('../models/Job');
const Dispute = require('../models/Dispute');
const auth = require('../middleware/auth');
const { milestoneTransition } = require('../services/stateMachine');
const { analyzeVideo } = require('../utils/realityDefender');
const { uploadToImageKit } = require('../utils/imagekit');
const { performRelease } = require('../services/releaseService');
const isTestMode = require('../utils/isTestMode');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

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

    // Calculate 2% platform fee on both sides
    const clientFee = Math.round(milestone.amount * 0.02);
    const freelancerFee = Math.round(milestone.amount * 0.02);
    const clientTotal = milestone.amount + clientFee;
    const freelancerPayout = milestone.amount - freelancerFee;
    const platformFee = clientFee + freelancerFee;

    milestone.clientFee = clientFee;
    milestone.freelancerFee = freelancerFee;
    milestone.platformFee = platformFee;
    milestone.clientTotal = clientTotal;
    milestone.freelancerPayout = freelancerPayout;

    if (isTestMode()) {
      milestone.razorpayOrderId = 'order_test_' + Date.now();
    } else {
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      const order = await razorpay.orders.create({
        amount: Math.round(clientTotal * 100),
        currency: 'INR',
        receipt: milestone._id.toString(),
        notes: { milestoneId: milestone._id.toString() }
      });
      milestone.razorpayOrderId = order.id;
    }

    milestone.fundedAt = new Date();
    await milestone.save();
    const updated = await milestoneTransition(milestone._id, 'funded');

    // Advance payment funded in test mode → activate contract and start the job
    if (milestone.isAdvance && isTestMode()) {
      await Contract.findByIdAndUpdate(milestone.contract, { status: 'active' });
      const contract = await Contract.findById(milestone.contract);
      if (contract) await Job.findByIdAndUpdate(contract.job, { status: 'in_progress' });
    }

    res.json({ ...updated.toObject(), razorpayOrderId: updated.razorpayOrderId, razorpayKeyId: process.env.RAZORPAY_KEY_ID, clientTotal, clientFee, freelancerFee, freelancerPayout, platformFee });
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

    if (milestone.razorpayPaymentId) {
      return res.status(400).json({ message: 'Payment already verified for this milestone' });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ message: 'Razorpay not configured on server' });
    }

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
      const codeBuffer = files.file[0].buffer;
      milestone.submissionFileHash = crypto.createHash('sha256').update(codeBuffer).digest('hex');
      milestone.submissionFileUrl = await uploadToImageKit(codeBuffer, files.file[0].originalname, '/safelancer/submissions');
    }
    if (files.video?.[0]) {
      const videoBuffer = files.video[0].buffer;
      milestone.submissionVideoHash = crypto.createHash('sha256').update(videoBuffer).digest('hex');
      milestone.submissionVideoUrl = await uploadToImageKit(videoBuffer, files.video[0].originalname, '/safelancer/submissions');
    }
    await milestone.save();

    // Fire-and-forget: run deepfake detection in background so freelancer gets instant response
    if (files.video?.[0]) {
      const videoBuffer = files.video[0].buffer;
      const videoMime   = files.video[0].mimetype || 'video/mp4';
      const videoName   = files.video[0].originalname || 'demo.mp4';
      const milestoneId = milestone._id;

      // Mark as PENDING immediately so client can see it
      await Milestone.findByIdAndUpdate(milestoneId, { rdStatus: 'PENDING' });

      setImmediate(async () => {
        try {
          const result = await analyzeVideo(videoBuffer, videoName, videoMime);
          if (result) {
            await Milestone.findByIdAndUpdate(milestoneId, {
              rdRequestId:  result.requestId,
              rdStatus:     result.status,
              rdScore:      result.score,
              rdAnalyzedAt: new Date(),
              rdSimulated:  result.simulated || false,
            });
            console.log(`[RD] Milestone ${milestoneId}: ${result.status} (score ${result.score}) [simulated: ${!!result.simulated}]`);
          }
        } catch (e) {
          console.error('[RD] Background analysis failed:', e.message);
          await Milestone.findByIdAndUpdate(milestoneId, { rdStatus: 'UNABLE_TO_EVALUATE' });
        }
      });
    }

    // Transition: funded/in_progress → submitted → review in one call
    if (milestone.status === 'funded') await milestoneTransition(milestone._id, 'in_progress');
    await milestoneTransition(milestone._id, 'submitted');
    const updated = await milestoneTransition(milestone._id, 'review');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/milestones/:id/ai-check — returns RD deepfake detection result
// If still PENDING and requestId stored, re-polls RD for a fresh status.
router.get('/:id/ai-check', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });

    // Both client and freelancer of the contract may view this
    const isParty = [milestone.client.toString(), milestone.freelancer.toString()].includes(req.user.id);
    if (!isParty) return res.status(403).json({ message: 'Access denied' });

    // If analysis completed, return cached result immediately
    if (milestone.rdStatus && milestone.rdStatus !== 'PENDING') {
      return res.json({
        rdStatus:     milestone.rdStatus,
        rdScore:      milestone.rdScore,
        rdRequestId:  milestone.rdRequestId,
        rdAnalyzedAt: milestone.rdAnalyzedAt,
        rdSimulated:  milestone.rdSimulated,
      });
    }

    // If still PENDING and we have a real RD requestId (not local_*), try to poll RD
    if (milestone.rdStatus === 'PENDING' && milestone.rdRequestId && !milestone.rdRequestId.startsWith('local_')) {
      const axios = require('axios');
      try {
        const rdRes = await axios.get(
          `https://api.prd.realitydefender.xyz/api/media/users/${milestone.rdRequestId}`,
          { headers: { 'X-API-KEY': process.env.REALITY_DEFENDER_API_KEY, 'Content-Type': 'application/json' } }
        );
        const summary = rdRes.data?.resultsSummary;
        if (summary && summary.status && summary.status !== 'IN_PROGRESS') {
          await Milestone.findByIdAndUpdate(milestone._id, {
            rdStatus:     summary.status,
            rdScore:      summary.metadata?.finalScore ?? null,
            rdAnalyzedAt: new Date(),
          });
          return res.json({
            rdStatus:     summary.status,
            rdScore:      summary.metadata?.finalScore ?? null,
            rdRequestId:  milestone.rdRequestId,
            rdAnalyzedAt: new Date(),
          });
        }
      } catch (_) { /* RD not ready yet, fall through */ }
    }

    // Still processing
    return res.json({ rdStatus: milestone.rdStatus || 'PENDING', rdScore: null, rdRequestId: milestone.rdRequestId, rdAnalyzedAt: null, rdSimulated: milestone.rdSimulated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/milestones/:id/ai-recheck — re-downloads the video and re-runs analysis
router.post('/:id/ai-recheck', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Not found' });

    const isParty = [milestone.client.toString(), milestone.freelancer.toString()].includes(req.user.id);
    if (!isParty) return res.status(403).json({ message: 'Access denied' });

    if (!milestone.submissionVideoUrl) {
      return res.status(400).json({ message: 'No video uploaded for this milestone' });
    }

    // Mark as PENDING
    await Milestone.findByIdAndUpdate(milestone._id, { rdStatus: 'PENDING', rdScore: null, rdAnalyzedAt: null });
    res.json({ rdStatus: 'PENDING', message: 'Re-analysis started' });

    // Fire-and-forget: download video and re-analyze
    setImmediate(async () => {
      try {
        const axios = require('axios');
        const videoUrl = milestone.submissionVideoUrl;
        let videoBuffer;

        if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
          const response = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
          videoBuffer = Buffer.from(response.data);
        } else {
          const path = require('path');
          const fs = require('fs');
          const localPath = path.join(__dirname, '..', videoUrl);
          videoBuffer = fs.readFileSync(localPath);
        }

        const result = await analyzeVideo(videoBuffer, 'recheck_video.mp4', 'video/mp4');
        if (result) {
          await Milestone.findByIdAndUpdate(milestone._id, {
            rdRequestId:  result.requestId,
            rdStatus:     result.status,
            rdScore:      result.score,
            rdAnalyzedAt: new Date(),
            rdSimulated:  result.simulated || false,
          });
          console.log(`[RD] Recheck milestone ${milestone._id}: ${result.status} (score ${result.score})`);
        }
      } catch (e) {
        console.error('[RD] Recheck failed:', e.message);
        await Milestone.findByIdAndUpdate(milestone._id, { rdStatus: 'UNABLE_TO_EVALUATE' });
      }
    });
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
// Supports auth via Bearer header OR ?token= query param (for <a> download links)
router.get('/file/:milestoneId/:type', async (req, res) => {
  try {
    // Auth: accept both Bearer header and ?token= query param
    let user = null;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
      const jwt = require('jsonwebtoken');
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Not found' });

    const isClient = milestone.client.toString() === user.id;
    const isFreelancer = milestone.freelancer.toString() === user.id;
    if (!isClient && !isFreelancer) return res.status(403).json({ message: 'Forbidden' });

    if (isClient) {
      const isVideo = req.params.type === 'video';
      const videoAllowed = ['review', 'approved', 'released', 'inaccurate_1', 'disputed'].includes(milestone.status);
      const codeAllowed = ['approved', 'released'].includes(milestone.status);
      if (isVideo && !videoAllowed) return res.status(403).json({ message: 'Demo video will be available once the freelancer submits deliverables' });
      if (!isVideo && !codeAllowed) return res.status(403).json({ message: 'Code file is locked until the phase is approved' });
    }

    const storedUrl = req.params.type === 'video' ? milestone.submissionVideoUrl : milestone.submissionFileUrl;
    if (!storedUrl) return res.status(404).json({ message: 'File not uploaded yet' });

    // If it's a full URL (CDN / ImageKit), redirect to it
    if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
      return res.redirect(storedUrl);
    }

    // Local file: serve from disk
    const path = require('path');
    const fs = require('fs');
    const localPath = path.join(__dirname, '..', storedUrl); // storedUrl = /uploads/xxx
    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Extract original filename from the stored path (strip timestamp prefix)
    const basename = path.basename(localPath);
    const originalName = basename.replace(/^\d+-/, '') || basename;

    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    return res.sendFile(path.resolve(localPath));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;