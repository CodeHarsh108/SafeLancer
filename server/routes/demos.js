const express = require('express');
const router = express.Router();
const DemoRequest = require('../models/DemoRequest');
const auth = require('../middleware/auth');

// POST /api/demos/request — client sends to freelancer
router.post('/request', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const { freelancerId, message, proposedAt } = req.body;
    const demo = new DemoRequest({
      client: req.user.id,
      freelancer: freelancerId,
      message,
      proposedAt: proposedAt ? new Date(proposedAt) : undefined
    });
    await demo.save();
    res.status(201).json(demo);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/demos/my-requests — client sees their sent requests
router.get('/my-requests', auth, async (req, res) => {
  try {
    const demos = await DemoRequest.find({ client: req.user.id })
      .populate('freelancer', 'name email rating')
      .sort({ createdAt: -1 });
    res.json(demos);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/demos/incoming — freelancer sees received requests
router.get('/incoming', auth, async (req, res) => {
  try {
    const demos = await DemoRequest.find({ freelancer: req.user.id })
      .populate('client', 'name email rating')
      .sort({ createdAt: -1 });
    res.json(demos);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/demos/:id/accept — freelancer accepts
router.patch('/:id/accept', auth, async (req, res) => {
  try {
    const demo = await DemoRequest.findById(req.params.id);
    if (!demo) return res.status(404).json({ message: 'Demo request not found' });
    if (demo.freelancer.toString() !== req.user.id) return res.status(403).json({ message: 'Not your request' });

    demo.status = 'accepted';
    demo.meetingRoomId = 'room-' + require('crypto').randomUUID();
    demo.meetingAt = req.body.meetingAt ? new Date(req.body.meetingAt) : new Date();
    await demo.save();
    res.json(demo);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/demos/:id/reject
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    const demo = await DemoRequest.findById(req.params.id);
    if (!demo) return res.status(404).json({ message: 'Not found' });
    if (demo.freelancer.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    demo.status = 'rejected';
    demo.rejectionReason = req.body.reason || '';
    await demo.save();
    res.json(demo);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/demos/:id/complete
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const demo = await DemoRequest.findById(req.params.id);
    if (!demo) return res.status(404).json({ message: 'Not found' });
    demo.status = 'completed';
    if (req.body.convertedToJob) {
      demo.convertedToJob = true;
      demo.jobId = req.body.jobId;
    }
    await demo.save();
    res.json(demo);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
