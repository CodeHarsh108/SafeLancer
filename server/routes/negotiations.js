const express = require('express');
const router = express.Router();
const Negotiation = require('../models/Negotiation');
const Contract = require('../models/Contract');
const Milestone = require('../models/Milestone');
const Job = require('../models/Job');
const auth = require('../middleware/auth');

// Helper: generate milestones from contract + job phases
async function createMilestonesForContract(contract, phases = [], advancePercent = 10) {
  const total = contract.amount;
  const now = new Date();
  const days = contract.timeline || 30;
  const milestones = [];

  const advanceAmount = Math.round(total * advancePercent / 100);

  milestones.push({
    contract: contract._id,
    client: contract.client,
    freelancer: contract.freelancer,
    milestoneNumber: 0,
    isAdvance: true,
    title: `Advance Payment (${advancePercent}%)`,
    description: 'Initial advance — released after Phase 1 approval',
    amount: advanceAmount,
    deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    status: 'pending_deposit'
  });

  const remaining = total - advanceAmount;

  if (phases && phases.length > 0) {
    let allocated = 0;
    phases.forEach((phase, i) => {
      const isLast = i === phases.length - 1;
      const phaseAmount = isLast
        ? remaining - allocated
        : Math.round(remaining * phase.budgetPercent / 100);
      allocated += phaseAmount;

      milestones.push({
        contract: contract._id,
        client: contract.client,
        freelancer: contract.freelancer,
        milestoneNumber: i + 1,
        isAdvance: false,
        title: phase.title,
        description: `${phase.guideline}\n\nDeliverable: ${phase.deliverableType || 'Other'}`,
        amount: phaseAmount,
        deadline: phase.phaseDeadline || new Date(now.getTime() + (days / phases.length) * (i + 1) * 24 * 60 * 60 * 1000),
        status: 'pending_deposit'
      });
    });
  } else {
    const count = contract.milestoneCount || 3;
    const phaseAmount = Math.round(remaining / count);
    const daysPerPhase = Math.round(days / count);

    for (let i = 1; i <= count; i++) {
      milestones.push({
        contract: contract._id,
        client: contract.client,
        freelancer: contract.freelancer,
        milestoneNumber: i,
        isAdvance: false,
        title: `Phase ${i}`,
        description: contract.scope ? `Phase ${i} of: ${contract.scope}` : `Phase ${i}`,
        amount: i === count ? (remaining - phaseAmount * (count - 1)) : phaseAmount,
        deadline: new Date(now.getTime() + daysPerPhase * i * 24 * 60 * 60 * 1000),
        status: 'pending_deposit'
      });
    }
  }

  await Milestone.insertMany(milestones);
  return milestones;
}

// POST /api/negotiations/start — client starts negotiation
router.post('/start', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const { jobId, freelancerId } = req.body;
    const offer = req.body.initialOffer || req.body;
    const { amount, timeline, scope, milestoneCount, message } = offer;

    const negotiation = new Negotiation({
      job: jobId,
      client: req.user.id,
      freelancer: freelancerId,
      status: 'active',
      currentRound: 1,
      maxRounds: 4,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      rounds: [{
        roundNumber: 1,
        proposedBy: req.user.id,
        proposedByRole: 'client',
        amount,
        timeline,
        scope,
        milestoneCount: milestoneCount || 3,
        message,
        status: 'pending'
      }]
    });
    await negotiation.save();
    res.status(201).json(negotiation);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/negotiations/my-negotiations
router.get('/my-negotiations', auth, async (req, res) => {
  try {
    const query = req.user.role === 'client'
      ? { client: req.user.id }
      : { freelancer: req.user.id };
    const negotiations = await Negotiation.find(query)
      .populate('job', 'title')
      .populate('client', 'name')
      .populate('freelancer', 'name')
      .sort({ createdAt: -1 });
    res.json(negotiations);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/negotiations/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const neg = await Negotiation.findById(req.params.id)
      .populate('job', 'title description budget skills')
      .populate('client', 'name email rating')
      .populate('freelancer', 'name email rating')
      .populate('rounds.proposedBy', 'name role');
    if (!neg) return res.status(404).json({ message: 'Not found' });
    res.json(neg);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/negotiations/:id/respond
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const neg = await Negotiation.findById(req.params.id);
    if (!neg) return res.status(404).json({ message: 'Not found' });
    if (neg.status !== 'active') return res.status(400).json({ message: 'Negotiation is not active' });

    const isClient = neg.client.toString() === req.user.id;
    const isFreelancer = neg.freelancer.toString() === req.user.id;
    if (!isClient && !isFreelancer) return res.status(403).json({ message: 'Not your negotiation' });

    const { action, amount, timeline, scope, milestoneCount, message } = req.body;
    const lastRound = neg.rounds[neg.rounds.length - 1];
    lastRound.status = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'countered';
    lastRound.respondedAt = new Date();

    if (action === 'accept') {
      neg.status = 'agreed';
      neg.agreedAmount = lastRound.amount;
      neg.agreedTimeline = lastRound.timeline;
      neg.agreedScope = lastRound.scope;
      neg.agreedMilestoneCount = lastRound.milestoneCount || 3;
      neg.agreedAt = new Date();
      await neg.save();

      // Get job phases + advancePercent
      const job = await Job.findById(neg.job);
      const phases = job?.phases || [];
      const advancePercent = job?.advancePercent || 10;

      // Create Contract
      const contract = new Contract({
        job: neg.job,
        negotiation: neg._id,
        client: neg.client,
        freelancer: neg.freelancer,
        amount: neg.agreedAmount,
        scope: neg.agreedScope,
        timeline: neg.agreedTimeline,
        milestoneCount: phases.length || neg.agreedMilestoneCount,
        advancePercent,
        status: 'active'
      });
      await contract.save();

      // Update job status
      await Job.findByIdAndUpdate(neg.job, { status: 'in_progress' });

      // Create milestones from job phases
      const milestones = await createMilestonesForContract(contract, phases, advancePercent);

      return res.json({ negotiation: neg, contract, milestones });
    }

    if (action === 'reject') {
      neg.status = 'rejected';
      await neg.save();
      return res.json(neg);
    }

    if (action === 'counter') {
      if (neg.currentRound >= neg.maxRounds) {
        neg.status = 'expired';
        await neg.save();
        return res.status(400).json({ message: 'Max rounds reached. Negotiation expired.' });
      }
      neg.currentRound += 1;
      neg.rounds.push({
        roundNumber: neg.currentRound,
        proposedBy: req.user.id,
        proposedByRole: isClient ? 'client' : 'freelancer',
        amount: amount || lastRound.amount,
        timeline: timeline || lastRound.timeline,
        scope: scope || lastRound.scope,
        milestoneCount: milestoneCount || lastRound.milestoneCount,
        message,
        status: 'pending'
      });
      neg.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await neg.save();
      return res.json(neg);
    }

    res.status(400).json({ message: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
