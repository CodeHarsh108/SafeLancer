const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Contract = require('../models/Contract');
const auth = require('../middleware/auth');

// POST /api/jobs — client only
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const { title, description, budget, skills, deadline } = req.body;
    const job = new Job({ client: req.user.id, title, description, budget, skills, deadline });
    await job.save();
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs — public with filter
router.get('/', async (req, res) => {
  try {
    const { skills, minBudget, maxBudget, search } = req.query;
    const query = { status: 'open' };
    if (skills) {
      const skillArr = skills.split(',').map(s => s.trim());
      query.skills = { $in: skillArr };
    }
    if (minBudget) query.budget = { ...query.budget, $gte: Number(minBudget) };
    if (maxBudget) query.budget = { ...query.budget, $lte: Number(maxBudget) };
    if (search) query.title = { $regex: search, $options: 'i' };

    const jobs = await Job.find(query).populate('client', 'name rating').sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/my-jobs — client
router.get('/my-jobs', auth, async (req, res) => {
  try {
    const jobs = await Job.find({ client: req.user.id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/my-bids — freelancer
router.get('/my-bids', auth, async (req, res) => {
  try {
    const jobs = await Job.find({ 'bids.freelancer': req.user.id }).populate('client', 'name rating');
    res.json(jobs);
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

// POST /api/jobs/:id/bid — freelancer only
router.post('/:id/bid', auth, async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') return res.status(403).json({ message: 'Freelancers only' });
    const job = await Job.findById(req.params.id);
    if (!job || job.status !== 'open') return res.status(400).json({ message: 'Job not available' });

    const alreadyBid = job.bids.find(b => b.freelancer.toString() === req.user.id);
    if (alreadyBid) return res.status(400).json({ message: 'Already placed a bid' });

    job.bids.push({ freelancer: req.user.id, amount: req.body.amount, proposal: req.body.proposal });
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/jobs/:id/accept/:bidId — client only
router.patch('/:id/accept/:bidId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.client.toString() !== req.user.id) return res.status(403).json({ message: 'Not your job' });

    const bid = job.bids.id(req.params.bidId);
    if (!bid) return res.status(404).json({ message: 'Bid not found' });

    job.bids.forEach(b => b.status = 'rejected');
    bid.status = 'accepted';
    job.status = 'in_progress';
    await job.save();

    res.json({ job, acceptedBid: bid });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/jobs/freelancers/browse — filter-based freelancer browse
router.get('/freelancers/browse', async (req, res) => {
  try {
    const { skills, minRating, availability, maxRate } = req.query;
    const Portfolio = require('../models/Portfolio');
    const User = require('../models/User');

    let portfolioFilter = { role: 'freelancer', isVisible: true };
    if (skills) portfolioFilter.skills = { $in: skills.split(',').map(s => s.trim()) };
    if (availability) portfolioFilter.availability = availability;
    if (maxRate) portfolioFilter.hourlyRate = { $lte: Number(maxRate) };

    const portfolios = await Portfolio.find(portfolioFilter).populate({
      path: 'user',
      select: 'name email rating totalJobsCompleted onTimeDeliveryRate',
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
