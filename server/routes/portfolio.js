const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Portfolio = require('../models/Portfolio');
const auth = require('../middleware/auth');
const { calcCompletion } = require('../utils/profileCompletion');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/portfolio/:userId — public
router.get('/:userId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId })
      .populate('user', 'name role rating totalJobsCompleted onTimeDeliveryRate disputeRate');
    if (!portfolio) return res.status(404).json({ message: 'Portfolio not found' });
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/update
router.post('/update', auth, async (req, res) => {
  try {
    const {
      bio, skills, githubUrl, linkedinUrl, portfolioUrl, availability,
      companyName, industry,
      // new client fields
      clientType, location, yearsHiring, preferredComm, companySize, websiteUrl
    } = req.body;
    // Fetch current portfolio to include existing projectSamples/resumeUrl in completion calc
    const existing = await Portfolio.findOne({ user: req.user.id });
    const resolvedRole = existing?.role || req.user.role;
    const update = {
      bio, skills, githubUrl, linkedinUrl, portfolioUrl, availability,
      companyName, industry,
      clientType, location, yearsHiring, preferredComm, companySize, websiteUrl,
      role: resolvedRole   // always persist role so upsert creates it correctly
    };

    const mergedData = {
      ...update,
      projectSamples: existing?.projectSamples || [],
      resumeUrl: existing?.resumeUrl || '',
      avatarUrl: update.avatarUrl || existing?.avatarUrl || '',
      paymentVerified: existing?.paymentVerified || false,
    };
    update.completionPercent = calcCompletion(resolvedRole, mergedData);

    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/upload-avatar
router.post('/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const avatarUrl = '/uploads/' + req.file.filename;
    const existing = await Portfolio.findOne({ user: req.user.id });
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: { avatarUrl } },
      { new: true, upsert: true }
    );
    const mergedData = {
      ...portfolio.toObject(),
      avatarUrl,
      paymentVerified: existing?.paymentVerified || false,
      role: portfolio.role || req.user.role
    };
    const completion = calcCompletion(mergedData.role, mergedData);
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ avatarUrl, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/verify-payment
// In production this would be triggered by a Razorpay webhook after adding a payment method.
// For now it's a direct call clients can make to mark their payment method as verified.
router.post('/verify-payment', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: { paymentVerified: true } },
      { new: true, upsert: true }
    );
    const completion = calcCompletion(portfolio.role, portfolio);
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ paymentVerified: true, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/upload-sample
router.post('/upload-sample', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const buffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileUrl = '/uploads/' + req.file.filename;
    const sample = {
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      fileUrl,
      fileHash,
      uploadedAt: new Date()
    };
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $push: { projectSamples: sample } },
      { new: true }
    );
    // Recalculate completion after upload
    const completion = calcCompletion(portfolio.role, portfolio);
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ sample, portfolio, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/upload-resume
router.post('/upload-resume', auth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const resumeUrl = '/uploads/' + req.file.filename;
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: { resumeUrl } },
      { new: true }
    );
    // Recalculate completion after resume upload
    const completion = calcCompletion(portfolio.role, portfolio);
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ resumeUrl, portfolio, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
