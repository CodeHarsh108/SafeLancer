const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Job = require('../models/Job');
const Contract = require('../models/Contract');
const Milestone = require('../models/Milestone');
const Negotiation = require('../models/Negotiation');
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

// POST /api/jobs — client only
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const Portfolio = require('../models/Portfolio');
    const portfolio = await Portfolio.findOne({ user: req.user.id });
    if (!portfolio || portfolio.completionPercent < 100) {
      return res.status(403).json({ message: 'Complete your profile to 100% before posting a job', completionPercent: portfolio?.completionPercent || 0 });
    }

    const {
      title, description, budget, skills, deadline,
      category, experienceLevel, verifiedOnly, advancePercent,
      phases, referenceFiles, nda, ipOwnership, latePenalty, autoReleaseHours
    } = req.body;

    // Validate budget and deadline
    if (!budget || Number(budget) < 1000) return res.status(400).json({ message: 'Budget must be at least ₹1000' });
    const deadlineDate = new Date(deadline);
    const minDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (deadlineDate < minDeadline) return res.status(400).json({ message: 'Deadline must be at least 7 days from today' });

    // Validate phases
    if (!phases || phases.length < 3) return res.status(400).json({ message: 'At least 3 phases are required' });
    const totalPercent = phases.reduce((sum, p) => sum + Number(p.budgetPercent || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.5) return res.status(400).json({ message: `Phase budget percentages must total 100% (currently ${totalPercent}%)` });

    // Generate scope hash
    const hashInput = title + description + phases.map(p => p.title + p.guideline).join('');
    const scopeHash = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16).toUpperCase();

    const job = new Job({
      client: req.user.id,
      title, description,
      budget: Number(budget),
      skills: skills || [],
      deadline,
      category: category || 'Other',
      experienceLevel: experienceLevel || 'Mid',
      verifiedOnly: verifiedOnly || false,
      advancePercent: advancePercent || 10,
      scopeHash,
      phases: phases || [],
      referenceFiles: referenceFiles || [],
      nda: nda || false,
      ipOwnership: ipOwnership || 'client',
      latePenalty: latePenalty || 0,
      autoReleaseHours: autoReleaseHours || 72
    });
    await job.save();

    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $inc: { projectsPosted: 1 } });
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs — public with filters
router.get('/', async (req, res) => {
  try {
    const { skills, minBudget, maxBudget, search, category, experienceLevel } = req.query;
    const query = { status: 'open' };
    if (skills) query.skills = { $in: skills.split(',').map(s => s.trim()) };
    if (minBudget) query.budget = { ...query.budget, $gte: Number(minBudget) };
    if (maxBudget) query.budget = { ...query.budget, $lte: Number(maxBudget) };
    if (search) query.title = { $regex: search, $options: 'i' };
    if (category) query.category = category;
    if (experienceLevel) query.experienceLevel = experienceLevel;

    const jobs = await Job.find(query).populate('client', 'name rating').sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/my-jobs — client
router.get('/my-jobs', auth, async (req, res) => {
  try {
    const jobs = await Job.find({ client: req.user.id })
      .populate('bids.freelancer', 'name rating totalJobsCompleted')
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/my-applications — freelancer sees all their applications
router.get('/my-applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') return res.status(403).json({ message: 'Freelancers only' });

    const jobs = await Job.find({ 'bids.freelancer': req.user.id })
      .populate('client', 'name rating')
      .sort({ updatedAt: -1 });

    const results = [];
    for (const job of jobs) {
      const bid = job.bids.find(b => b.freelancer.toString() === req.user.id);
      if (!bid) continue;

      let contractId = null;
      let negotiationId = null;

      if (bid.status === 'hired') {
        const contract = await Contract.findOne({ job: job._id, freelancer: req.user.id });
        if (contract) contractId = contract._id;
      }

      if (bid.status === 'negotiating') {
        const neg = await Negotiation.findOne({ job: job._id, freelancer: req.user.id, status: 'active' });
        if (neg) negotiationId = neg._id;
      }

      results.push({
        job: { _id: job._id, title: job.title, budget: job.budget, client: job.client, category: job.category, experienceLevel: job.experienceLevel },
        bid: bid.toObject(),
        contractId,
        negotiationId
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/:id — public
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'name email rating totalJobsCompleted')
      .populate('bids.freelancer', 'name rating totalJobsCompleted');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/jobs/:id/apply — freelancer applies with proposal only
router.post('/:id/apply', auth, async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') return res.status(403).json({ message: 'Freelancers only' });
    const Portfolio = require('../models/Portfolio');
    const portfolio = await Portfolio.findOne({ user: req.user.id });
    if (!portfolio || portfolio.completionPercent < 100) {
      return res.status(403).json({ message: 'Complete your profile to 100% before applying', completionPercent: portfolio?.completionPercent || 0 });
    }
    const job = await Job.findById(req.params.id);
    if (!job || job.status !== 'open') return res.status(400).json({ message: 'Job not available' });

    // Check verifiedOnly
    if (job.verifiedOnly && !portfolio.paymentVerified) {
      return res.status(403).json({ message: 'This job requires a verified freelancer. Please complete payment verification.' });
    }

    const already = job.bids.find(b => b.freelancer.toString() === req.user.id);
    if (already) return res.status(400).json({ message: 'Already applied' });

    job.bids.push({ freelancer: req.user.id, proposal: req.body.proposal });
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/:id/applications — client sees all applicants with profile
router.get('/:id/applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const job = await Job.findById(req.params.id)
      .populate('bids.freelancer', 'name email rating totalJobsCompleted onTimeDeliveryRate');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.client.toString() !== req.user.id) return res.status(403).json({ message: 'Not your job' });

    const Portfolio = require('../models/Portfolio');
    const freelancerIds = job.bids.map(b => b.freelancer?._id || b.freelancer);
    const portfolios = await Portfolio.find({ user: { $in: freelancerIds } });
    const portfolioMap = {};
    portfolios.forEach(p => { portfolioMap[p.user.toString()] = p; });

    const applications = job.bids.map(b => ({
      ...b.toObject(),
      portfolio: portfolioMap[(b.freelancer?._id || b.freelancer).toString()] || null
    }));

    res.json({ job: { _id: job._id, title: job.title, budget: job.budget, status: job.status }, applications });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Helper: auth guard for client + job ownership
async function getJobAndBid(req, res) {
  if (req.user.role !== 'client') { res.status(403).json({ message: 'Clients only' }); return null; }
  const job = await Job.findById(req.params.id);
  if (!job) { res.status(404).json({ message: 'Job not found' }); return null; }
  if (job.client.toString() !== req.user.id) { res.status(403).json({ message: 'Not your job' }); return null; }
  const bid = job.bids.id(req.params.bidId);
  if (!bid) { res.status(404).json({ message: 'Application not found' }); return null; }
  return { job, bid };
}

// PATCH .../shortlist
router.patch('/:id/applications/:bidId/shortlist', auth, async (req, res) => {
  try {
    const result = await getJobAndBid(req, res);
    if (!result) return;
    const { job, bid } = result;
    if (bid.status !== 'applied') return res.status(400).json({ message: 'Can only shortlist applied candidates' });
    bid.status = 'shortlisted';
    bid.shortlistedAt = new Date();
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH .../schedule-interview
router.patch('/:id/applications/:bidId/schedule-interview', auth, async (req, res) => {
  try {
    const result = await getJobAndBid(req, res);
    if (!result) return;
    const { job, bid } = result;
    if (bid.status !== 'shortlisted') return res.status(400).json({ message: 'Can only schedule interview for shortlisted candidates' });
    if (!req.body.scheduledAt) return res.status(400).json({ message: 'scheduledAt is required' });
    if (new Date(req.body.scheduledAt) <= new Date()) return res.status(400).json({ message: 'Interview must be scheduled in the future' });
    bid.interviewScheduledAt = new Date(req.body.scheduledAt);
    bid.meetingRoomId = 'interview-' + crypto.randomUUID();
    bid.status = 'interview_scheduled';
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH .../interview-done
router.patch('/:id/applications/:bidId/interview-done', auth, async (req, res) => {
  try {
    const result = await getJobAndBid(req, res);
    if (!result) return;
    const { job, bid } = result;
    if (bid.status !== 'interview_scheduled') return res.status(400).json({ message: 'Interview must be scheduled first' });
    bid.status = 'interviewed';
    bid.interviewDoneAt = new Date();
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH .../hire — direct hire using job phases
router.patch('/:id/applications/:bidId/hire', auth, async (req, res) => {
  try {
    const result = await getJobAndBid(req, res);
    if (!result) return;
    const { job, bid } = result;
    if (bid.status !== 'interviewed') return res.status(400).json({ message: 'Can only hire after interview' });

    const advancePercent = job.advancePercent || 10;
    const contract = new Contract({
      job: job._id,
      client: job.client,
      freelancer: bid.freelancer,
      amount: job.budget,
      scope: job.description,
      timeline: 30,
      milestoneCount: job.phases?.length || 3,
      advancePercent,
      status: 'active'
    });
    await contract.save();

    await createMilestonesForContract(contract, job.phases || [], advancePercent);

    job.bids.forEach(b => {
      if (b._id.toString() === bid._id.toString()) {
        b.status = 'hired';
        b.hiredAt = new Date();
      } else if (!['hired', 'rejected'].includes(b.status)) {
        b.status = 'rejected';
      }
    });
    job.status = 'in_progress';
    await job.save();

    res.json({ contract, job });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH .../negotiate
router.patch('/:id/applications/:bidId/negotiate', auth, async (req, res) => {
  try {
    const result = await getJobAndBid(req, res);
    if (!result) return;
    const { job, bid } = result;
    if (bid.status !== 'interviewed') return res.status(400).json({ message: 'Can only negotiate after interview' });

    const negotiation = new Negotiation({
      job: job._id,
      client: job.client,
      freelancer: bid.freelancer,
      status: 'active',
      currentRound: 1,
      maxRounds: 4,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      rounds: [{
        roundNumber: 1,
        proposedBy: req.user.id,
        proposedByRole: 'client',
        amount: job.budget,
        timeline: 30,
        scope: job.description,
        milestoneCount: job.phases?.length || 3,
        message: req.body.message || 'Starting negotiation from interview.',
        status: 'pending'
      }]
    });
    await negotiation.save();

    bid.status = 'negotiating';
    await job.save();

    res.json({ negotiationId: negotiation._id, job });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH .../reject
router.patch('/:id/applications/:bidId/reject', auth, async (req, res) => {
  try {
    const result = await getJobAndBid(req, res);
    if (!result) return;
    const { job, bid } = result;
    bid.status = 'rejected';
    if (req.body.reason) bid.rejectionReason = req.body.reason;
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/freelancers/browse
router.get('/freelancers/browse', async (req, res) => {
  try {
    const { skills, minRating, availability } = req.query;
    const Portfolio = require('../models/Portfolio');

    let portfolioFilter = { role: 'freelancer', isVisible: true };
    if (skills) portfolioFilter.skills = { $in: skills.split(',').map(s => s.trim()) };
    if (availability) portfolioFilter.availability = availability;

    const portfolios = await Portfolio.find(portfolioFilter).populate({
      path: 'user',
      select: 'name rating totalJobsCompleted onTimeDeliveryRate',
      match: minRating ? { rating: { $gte: Number(minRating) } } : {}
    });

    const results = portfolios
      .filter(p => p.user !== null)
      .sort((a, b) => (b.user.rating || 0) - (a.user.rating || 0));

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
