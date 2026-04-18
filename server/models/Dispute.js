const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['milestone', 'manual', 'withdrawal', 'deadline_breach', 'payment_default', 'freelancer_exit'], default: 'manual' },
  reason: { type: String, required: true },
  evidence: [{
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: String,
    fileUrl: String,
    submittedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  resolution: { type: String, enum: ['release_to_freelancer', 'refund_to_client', 'split', null], default: null },
  splitPercent: Number,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  evidenceSummary: {
    submissionHashes: [String],
    videoHashes: [String],
    deadlineExtensionCount: { type: Number, default: 0 },
    inaccuracyNotes: [String],
    autoCompiled: { type: Boolean, default: false },
    compiledAt: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Dispute', disputeSchema);
