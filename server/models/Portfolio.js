const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  role: { type: String, enum: ['client', 'freelancer'], required: true },
  bio: { type: String, default: '' },
  skills: [{ type: String }],
  githubUrl: { type: String, default: '' },
  linkedinUrl: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
  hourlyRate: { type: Number, default: 0 },
  availability: { type: String, enum: ['full-time', 'part-time', 'unavailable'], default: 'full-time' },
  projectSamples: [{
    title: String,
    description: String,
    fileUrl: String,
    fileHash: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  resumeUrl: { type: String, default: '' },
  industry: { type: String, default: '' },
  companyName: { type: String, default: '' },
  projectsPosted: { type: Number, default: 0 },
  projectsCompleted: { type: Number, default: 0 },
  avgBudget: { type: Number, default: 0 },
  paymentVerified: { type: Boolean, default: false },
  completionPercent: { type: Number, default: 20 },
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Portfolio', portfolioSchema);

