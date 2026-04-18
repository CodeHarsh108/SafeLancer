const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposal:   { type: String, required: true },
  status: {
    type: String,
    enum: ['applied', 'shortlisted', 'hired', 'rejected'],
    default: 'applied'
  },
  appliedAt:       { type: Date, default: Date.now },
  shortlistedAt:   Date,
  rejectionReason: String,
  hiredAt:         Date,
}, { timestamps: true });

const phaseSchema = new mongoose.Schema({
  title:           { type: String, required: true },
  guideline:       { type: String, required: true },
  guidelineHash:   { type: String },
  deliverableType: {
    type: String,
    enum: ['Code File', 'Design File', 'Document', 'APK', 'Video', 'Other'],
    default: 'Other'
  },
  budgetPercent:  { type: Number, required: true },
  phaseDeadline:  { type: Date, required: true },
  maxRevisions:   { type: Number, enum: [1, 2], default: 2 }
}, { _id: false });

const referenceFileSchema = new mongoose.Schema({
  url:          { type: String, required: true },
  fileHash:     { type: String, required: true },
  originalName: { type: String }
}, { _id: false });

const jobSchema = new mongoose.Schema({
  client:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true },
  description: { type: String, required: true },
  budget:      { type: Number, required: true },
  skills:      [{ type: String }],
  deadline:    { type: Date, required: true },
  status:      { type: String, enum: ['open', 'in_progress', 'completed', 'cancelled'], default: 'open' },
  bids:        [bidSchema],

  category:         { type: String, enum: ['Web Development', 'Mobile', 'Design', 'Data Science', 'DevOps', 'Content', 'Other'], default: 'Other' },
  experienceLevel:  { type: String, enum: ['Junior', 'Mid', 'Senior'], default: 'Mid' },
  verifiedOnly:     { type: Boolean, default: false },
  advancePercent:   { type: Number, enum: [10, 15, 20, 25], default: 10 },
  scopeHash:        { type: String },
  phases:           [phaseSchema],
  referenceFiles:   [referenceFileSchema]
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
