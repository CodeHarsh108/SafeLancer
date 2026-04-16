const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  role: { type: String, enum: ['client', 'freelancer'], required: true },
  bio: { type: String, default: '' },
  skills: [{ type: String }],
  githubUrl: { type: String, default: '' },
  linkedinUrl: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
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
  // Client-specific new fields
  clientType: { type: String, enum: ['individual', 'business', ''], default: '' },
  avatarUrl: { type: String, default: '' },
  location: { type: String, default: '' },
  yearsHiring: { type: String, enum: ['first-time', '1-2', '3-5', '5+', ''], default: '' },
  preferredComm: { type: String, enum: ['async', 'sync', 'flexible', ''], default: '' },
  companySize: { type: String, enum: ['solo', '2-10', '11-50', '51-200', '200+', ''], default: '' },
  websiteUrl: { type: String, default: '' },
  projectsPosted: { type: Number, default: 0 },
  projectsCompleted: { type: Number, default: 0 },
  avgBudget: { type: Number, default: 0 },
  paymentVerified:        { type: Boolean, default: false },
  // Freelancer payout details
  payoutMethod:           { type: String, enum: ['bank', 'upi', ''], default: '' },
  bankAccountNumber:      { type: String, default: '' },
  ifscCode:               { type: String, default: '' },
  accountHolderName:      { type: String, default: '' },
  upiId:                  { type: String, default: '' },
  razorpayContactId:      { type: String, default: '' },
  razorpayFundAccountId:  { type: String, default: '' },
  payoutDetailsAdded:     { type: Boolean, default: false },
  completionPercent:      { type: Number, default: 20 },
  isVisible:              { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Portfolio', portfolioSchema);

