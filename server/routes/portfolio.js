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

// GET /api/portfolio/:userId — public
router.get('/:userId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId }).populate('user', 'name email role rating totalJobsCompleted onTimeDeliveryRate');
    if (!portfolio) return res.status(404).json({ message: 'Portfolio not found' });
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/update
router.post('/update', auth, async (req, res) => {
  try {
    const { bio, skills, githubUrl, linkedinUrl, portfolioUrl, hourlyRate, availability, companyName } = req.body;
    const update = { bio, skills, githubUrl, linkedinUrl, portfolioUrl, hourlyRate, availability, companyName };
    // Calculate completion percent
    let filled = 1;
    if (bio) filled++;
    if (skills && skills.length > 0) filled++;
    if (githubUrl) filled++;
    if (hourlyRate) filled++;
    update.completionPercent = Math.min(100, Math.round((filled / 5) * 100));

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
    res.json({ sample, portfolio });
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
    res.json({ resumeUrl, portfolio });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
