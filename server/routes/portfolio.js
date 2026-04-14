const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Portfolio = require('../models/Portfolio');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Calculate profile completion percentage based on role
function calcCompletion(role, data) {
  if (role === 'freelancer') {
    // Base 20%, max 100%
    let pct = 20;
    if (data.bio) pct += 15;
    if (data.skills && data.skills.length > 0) pct += 15;
    if (data.hourlyRate) pct += 10;
    if (data.githubUrl) pct += 10;
    if (data.linkedinUrl) pct += 5;
    if (data.portfolioUrl) pct += 5;
    if (data.projectSamples && data.projectSamples.length > 0) pct += 10;
    if (data.resumeUrl) pct += 10;
    return Math.min(100, pct);
  } else {
    // Client: base 20%
    let pct = 20;
    if (data.bio) pct += 20;
    if (data.companyName) pct += 15;
    if (data.industry) pct += 15;
    if (data.linkedinUrl) pct += 15;
    if (data.paymentVerified) pct += 15;
    return Math.min(100, pct);
  }
}

// GET /api/portfolio/:userId — public
router.get('/:userId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId })
      .populate('user', 'name email role rating totalJobsCompleted onTimeDeliveryRate');
    if (!portfolio) return res.status(404).json({ message: 'Portfolio not found' });
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/update
router.post('/update', auth, async (req, res) => {
  try {
    const { bio, skills, githubUrl, linkedinUrl, portfolioUrl, hourlyRate, availability, companyName, industry } = req.body;
    const update = { bio, skills, githubUrl, linkedinUrl, portfolioUrl, hourlyRate, availability, companyName, industry };

    // Fetch current portfolio to include existing projectSamples/resumeUrl in completion calc
    const existing = await Portfolio.findOne({ user: req.user.id });
    const mergedData = {
      ...update,
      projectSamples: existing?.projectSamples || [],
      resumeUrl: existing?.resumeUrl || '',
      paymentVerified: existing?.paymentVerified || false,
      role: existing?.role || req.user.role
    };
    update.completionPercent = calcCompletion(mergedData.role, mergedData);

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
