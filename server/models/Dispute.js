const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['milestone', 'manual', 'withdrawal'], default: 'manual' },
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
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Dispute', disputeSchema);
