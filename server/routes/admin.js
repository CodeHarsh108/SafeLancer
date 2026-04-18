const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Dispute = require('../models/Dispute');
const Contract = require('../models/Contract');
const Portfolio = require('../models/Portfolio');
const auth = require('../middleware/auth');

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// GET /api/admin/stats
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const [totalUsers, totalFreelancers, totalClients, totalJobs, openJobs, inProgressJobs,
      completedJobs, totalDisputes, openDisputes, totalContracts, pendingVerifications] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'freelancer' }),
      User.countDocuments({ role: 'client' }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'open' }),
      Job.countDocuments({ status: 'in_progress' }),
      Job.countDocuments({ status: 'completed' }),
      Dispute.countDocuments(),
      Dispute.countDocuments({ status: 'open' }),
      Contract.countDocuments(),
      User.countDocuments({ role: 'freelancer', verificationStatus: 'pending' }),
    ]);

    res.json({
      users: { total: totalUsers, freelancers: totalFreelancers, clients: totalClients },
      jobs: { total: totalJobs, open: openJobs, inProgress: inProgressJobs, completed: completedJobs },
      disputes: { total: totalDisputes, open: openDisputes },
      contracts: { total: totalContracts },
      pendingVerifications,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/admin/freelancers/pending
router.get('/freelancers/pending', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: 'freelancer', verificationStatus: 'pending' })
      .select('name email createdAt verificationStatus')
      .sort({ createdAt: 1 });

    const portfolios = await Portfolio.find({ user: { $in: users.map(u => u._id) } })
      .select('user linkedinUrl githubUrl portfolioUrl skills bio completionPercent');

    const portfolioMap = {};
    portfolios.forEach(p => { portfolioMap[p.user.toString()] = p; });

    const result = users.map(u => {
      const p = portfolioMap[u._id.toString()] || {};
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        verificationStatus: u.verificationStatus,
        linkedin: p.linkedinUrl || '',
        github: p.githubUrl || '',
        portfolio: p.portfolioUrl || '',
        skills: p.skills || [],
        bio: p.bio || '',
        completionPercent: p.completionPercent || 0,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/admin/freelancers/:id/verify
router.post('/freelancers/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'freelancer' },
      { verificationStatus: status },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'Freelancer not found' });
    res.json({ success: true, verificationStatus: user.verificationStatus });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/admin/disputes/:id/full — all context for admin dispute review
router.get('/disputes/:id/full', auth, isAdmin, async (req, res) => {
  try {
    const Dispute = require('../models/Dispute');
    const Milestone = require('../models/Milestone');

    const dispute = await Dispute.findById(req.params.id)
      .populate({ path: 'contract', select: 'hashId amount status', populate: [
        { path: 'client', select: 'name email' },
        { path: 'freelancer', select: 'name email' }
      ]})
      .populate('milestone', 'title amount status submissionNote submissionFileUrl submissionFileHash submissionVideoUrl submissionVideoHash inaccuracyNote inaccuracyCount maxRevisions deadlineExtensions originalDeadline deadline submittedAt')
      .populate('raisedBy', 'name email role')
      .populate('evidence.submittedBy', 'name role');

    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    const milestones = await Milestone.find({ contract: dispute.contract._id })
      .select('milestoneNumber title amount status isAdvance submissionNote submissionFileUrl submissionFileHash submissionVideoUrl submissionVideoHash inaccuracyNote inaccuracyCount deadline submittedAt releasedAt')
      .sort({ milestoneNumber: 1 });

    let portfolioSamples = [];
    if (dispute.contract?.freelancer?._id) {
      const p = await Portfolio.findOne({ user: dispute.contract.freelancer._id })
        .select('projectSamples skills bio');
      portfolioSamples = p?.projectSamples || [];
    }

    res.json({ dispute, milestones, portfolioSamples });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/admin/users/:userId/ban
router.post('/users/:userId/ban', auth, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isBanned: true, banReason: reason || 'Banned by admin' },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/admin/users/:userId/unban
router.post('/users/:userId/unban', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isBanned: false, banReason: '', penaltyDue: 0 },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/admin/payments — full financial overview
router.get('/payments', auth, isAdmin, async (req, res) => {
  try {
    const Milestone = require('../models/Milestone');
    const Transaction = require('../models/Transaction');

    const HELD_STATUSES = ['funded', 'in_progress', 'submitted', 'review', 'approved', 'inaccurate_1', 'inaccurate_2', 'disputed'];
    const FUNDED_STATUSES = [...HELD_STATUSES, 'released', 'refunded'];

    // Fetch all milestones and all transactions in parallel
    const [milestones, transactions] = await Promise.all([
      Milestone.find({ status: { $in: FUNDED_STATUSES } })
        .populate({
          path: 'contract',
          select: 'hashId amount status advancePercent',
          populate: [
            { path: 'client', select: 'name email' },
            { path: 'freelancer', select: 'name email' },
            { path: 'job', select: 'title' },
          ]
        })
        .select('milestoneNumber title amount status isAdvance razorpayPaymentId submittedAt releasedAt deadline contract')
        .sort({ createdAt: 1 }),

      Transaction.find()
        .populate('freelancer', 'name email')
        .populate('contract', 'hashId')
        .populate('milestone', 'title milestoneNumber isAdvance')
        .sort({ createdAt: -1 })
        .limit(200),
    ]);

    // ── Summary totals ──────────────────────────────────────────────
    let totalFunded = 0, totalReleased = 0, totalRefunded = 0,
        totalHeld = 0, totalAdvanceHeld = 0, totalPayouts = 0,
        totalClientFees = 0, totalFreelancerFees = 0, totalPlatformEarnings = 0;

    for (const m of milestones) {
      totalFunded += m.amount;
      if (m.status === 'released')  totalReleased += m.amount;
      if (m.status === 'refunded')  totalRefunded += m.amount;
      if (HELD_STATUSES.includes(m.status)) totalHeld += m.amount;
      if (m.isAdvance && HELD_STATUSES.includes(m.status)) totalAdvanceHeld += m.amount;
      // Platform fees: client fee collected on all funded milestones; freelancer fee on released milestones
      if (m.clientFee) totalClientFees += m.clientFee;
      if (m.status === 'released' && m.freelancerFee) totalFreelancerFees += m.freelancerFee;
    }
    totalPlatformEarnings = totalClientFees + totalFreelancerFees;
    for (const t of transactions) totalPayouts += t.amount;

    // ── Advances breakdown ─────────────────────────────────────────
    const advances = milestones
      .filter(m => m.isAdvance)
      .map(m => ({
        _id: m._id,
        amount: m.amount,
        status: m.status,
        held: HELD_STATUSES.includes(m.status),
        contract: m.contract,
      }));

    // ── Per-contract breakdown ─────────────────────────────────────
    const contractMap = {};
    for (const m of milestones) {
      if (!m.contract?._id) continue;
      const cid = m.contract._id.toString();
      if (!contractMap[cid]) {
        contractMap[cid] = {
          contract: m.contract,
          milestones: [],
          totalFunded: 0, totalReleased: 0, totalHeld: 0, totalRefunded: 0,
        };
      }
      const entry = contractMap[cid];
      entry.milestones.push({
        _id: m._id,
        milestoneNumber: m.milestoneNumber,
        title: m.title,
        amount: m.amount,
        status: m.status,
        isAdvance: m.isAdvance,
        releasedAt: m.releasedAt,
        deadline: m.deadline,
      });
      entry.totalFunded += m.amount;
      if (m.status === 'released') entry.totalReleased += m.amount;
      if (m.status === 'refunded') entry.totalRefunded += m.amount;
      if (HELD_STATUSES.includes(m.status)) entry.totalHeld += m.amount;
    }

    // ── Per-client summary ─────────────────────────────────────────
    const clientMap = {};
    for (const entry of Object.values(contractMap)) {
      const client = entry.contract?.client;
      if (!client?._id) continue;
      const cid = client._id.toString();
      if (!clientMap[cid]) {
        clientMap[cid] = {
          client,
          contractCount: 0,
          totalDeposited: 0, totalHeld: 0, totalReleased: 0, totalRefunded: 0,
        };
      }
      clientMap[cid].contractCount++;
      clientMap[cid].totalDeposited  += entry.totalFunded;
      clientMap[cid].totalHeld       += entry.totalHeld;
      clientMap[cid].totalReleased   += entry.totalReleased;
      clientMap[cid].totalRefunded   += entry.totalRefunded;
    }

    res.json({
      summary: { totalFunded, totalReleased, totalRefunded, totalHeld, totalAdvanceHeld, totalPayouts, totalClientFees, totalFreelancerFees, totalPlatformEarnings },
      advances,
      contracts: Object.values(contractMap).sort((a, b) =>
        new Date(b.contract?.createdAt || 0) - new Date(a.contract?.createdAt || 0)),
      clientSummary: Object.values(clientMap).sort((a, b) => b.totalDeposited - a.totalDeposited),
      transactions,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
