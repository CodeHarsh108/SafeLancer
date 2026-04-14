const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const User = require('../models/User');
const auth = require('../middleware/auth');

// POST /api/ratings/submit
router.post('/submit', auth, async (req, res) => {
  try {
    const { contractId, milestoneId, ratedUserId, stars, review, communication, quality, timeliness, professionalism } = req.body;

    const isClient = req.user.role === 'client';
    const rating = new Rating({
      contract: contractId,
      milestone: milestoneId || undefined,
      ratedBy: req.user.id,
      ratedUser: ratedUserId,
      role: isClient ? 'client_rating_freelancer' : 'freelancer_rating_client',
      stars,
      review: review || '',
      communication,
      quality,
      timeliness,
      professionalism
    });
    await rating.save();

    // Recalculate rolling average for ratedUser
    const allRatings = await Rating.find({ ratedUser: ratedUserId });
    const avg = allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length;
    await User.findByIdAndUpdate(ratedUserId, {
      rating: Math.round(avg * 10) / 10,
      totalJobsCompleted: allRatings.length
    });

    res.status(201).json(rating);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/ratings/user/:userId — public
router.get('/user/:userId', async (req, res) => {
  try {
    const ratings = await Rating.find({ ratedUser: req.params.userId, isVisible: true })
      .populate('ratedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/ratings/contract/:contractId
router.get('/contract/:contractId', auth, async (req, res) => {
  try {
    const ratings = await Rating.find({ contract: req.params.contractId })
      .populate('ratedBy', 'name role');
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
